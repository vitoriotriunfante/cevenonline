// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: gatilho do lance SEMANA INVICTA (vídeo semanainvicta_1/2). O ranking (scratch/build_brasileirao_dataset.py) já dá +3 pontos por semana invicta;
//          faltava AVISAR na TV/Matriz. Esta rotina confere a semana e grava um lance por vendedor que bateu Vitória em TODOS os dias úteis dela.
// REGRA (decisão do Vitório, 28/09/2026): Vitória no dia = soma dos pontos dos lances do dia >= faixas_pontos_liga.vitoria.min_pontos (hoje 11);
//          Semana Invicta = Vitória em todos os dias úteis esperados da semana (seg-sex sem feriado nacional), com a semana COMPLETA.
// MESMA CONTA DO RANKING: lê /api/brasileirao-lances (um dia por vez, já sem duplicados e sem o que foi retirado da liga) e a mesma régua; só entram vendedores
//          com mostra = SIM na Gestão de Equipe (como no ranking).
// QUANDO: o último dia útil da semana já passou das 19h (Brasília). Chamada de dentro do cron-lances (a cada ciclo); idempotente (tabela semana_invicta_checada).
// PARÂMETROS: ?semana=AAAA-MM-DD (qualquer dia da semana alvo)  ?dry=1 (só calcula e devolve, não grava nada)  ?forcar=1 (confere de novo mesmo já checada)
// GRAVA: lance nivel 'semanainvicta' em /api/tv-lances (filial do vendedor + MTZ para a Matriz); 1 vez por vendedor e semana (tv-lances barra repetição entre dias).
// NUNCA inventa: só vendedor com Vitória comprovada em todos os dias esperados.
// =========================================================================
const FERIADOS_2026 = new Set(['2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25']);
const INICIO_TEMPORADA = '2026-09-28';
const HORA_FECHAMENTO = 19;
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });

const somaDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const diaSemana = (iso) => new Date(Date.parse(iso + 'T12:00:00Z')).getUTCDay(); // 0 = domingo
function agoraBRT() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  return { iso: `${p.year}-${p.month}-${p.day}`, h: (+p.hour) % 24 };
}
// dias úteis esperados (seg-sex, sem feriado) da semana que contém `iso`
function diasUteisDaSemana(iso) {
  const dow = diaSemana(iso), segunda = somaDias(iso, -((dow + 6) % 7));
  const out = [];
  for (let i = 0; i < 5; i++) { const d = somaDias(segunda, i); if (!FERIADOS_2026.has(d)) out.push(d); }
  return { segunda, dias: out };
}
function chaveSemana(segunda) {
  // ISO week: a quinta-feira da semana define o ano e o número
  const quinta = new Date(Date.parse(somaDias(segunda, 3) + 'T12:00:00Z'));
  const ano = quinta.getUTCFullYear();
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const semana1 = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000);
  const num = Math.round((Date.UTC(quinta.getUTCFullYear(), quinta.getUTCMonth(), quinta.getUTCDate()) - semana1.getTime()) / (7 * 86400000)) + 1;
  return `${ano}-W${String(num).padStart(2, '0')}`;
}
const fmtBR = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

export async function onRequestGet({ env, request }) {
  if (!env.DB) return resp({ erro: 'D1 não configurado' }, 503);
  const url = new URL(request.url), origin = url.origin;
  const dry = url.searchParams.has('dry'), forcar = url.searchParams.has('forcar');
  const agora = agoraBRT();

  // semana alvo
  let alvo = url.searchParams.get('semana');
  let origemManual = !!alvo;
  if (alvo && !/^\d{4}-\d{2}-\d{2}$/.test(alvo)) return resp({ erro: 'semana deve ser AAAA-MM-DD' }, 400);
  if (!alvo) {
    // a semana mais recente cujo ULTIMO dia util esperado ja passou das 19h
    for (const base of [agora.iso, somaDias(agora.iso, -7)]) {
      const { dias } = diasUteisDaSemana(base);
      const ultimo = dias[dias.length - 1];
      if (!ultimo) continue;
      const fechou = ultimo < agora.iso || (ultimo === agora.iso && agora.h >= HORA_FECHAMENTO);
      if (fechou) { alvo = base; break; }
    }
    if (!alvo) return resp({ status: 'SEMANA_AINDA_ABERTA', agora: agora.iso });
  }
  const { segunda, dias: diasEsperados } = diasUteisDaSemana(alvo);
  const diasTemporada = diasEsperados.filter((d) => d >= INICIO_TEMPORADA);
  const semana = chaveSemana(segunda);
  if (!diasTemporada.length || diasTemporada.length !== diasEsperados.length) return resp({ status: 'SEMANA_FORA_DA_TEMPORADA', semana, dias: diasEsperados });
  const ultimo = diasEsperados[diasEsperados.length - 1];
  if (!origemManual && !(ultimo < agora.iso || (ultimo === agora.iso && agora.h >= HORA_FECHAMENTO))) return resp({ status: 'SEMANA_AINDA_ABERTA', semana });

  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS semana_invicta_checada (semana TEXT PRIMARY KEY, feito_em TEXT, qtd INTEGER)').run();
    if (!dry && !forcar) {
      const ja = await env.DB.prepare('SELECT semana, qtd FROM semana_invicta_checada WHERE semana = ?').bind(semana).first();
      if (ja) return resp({ status: 'JA_CHECADA', semana, invictas: ja.qtd });
    }

    // regua e equipe
    let minVitoria = 11;
    try { const c = await (await fetch(`${origin}/pontuacao_brasileirao.json`, { signal: AbortSignal.timeout(8000) })).json(); minVitoria = Number(c.faixas_pontos_liga.vitoria.min_pontos) || 11; } catch { /* mantem 11 */ }
    const mp = await (await fetch(`${origin}/api/tv-mostra`, { signal: AbortSignal.timeout(10000) })).json();
    const equipe = new Map();
    for (const [sig, lista] of Object.entries((mp && mp.filiais) || {})) for (const v of Array.isArray(lista) ? lista : []) if (v && v.rca != null && v.mostra) equipe.set(String(v.rca), { filial: String(sig).toUpperCase(), nome: v.nome, supervisor: v.supervisor || '' });
    if (!equipe.size) return resp({ erro: 'Gestão de Equipe sem vendedores: não confere' }, 502);

    // pontos por vendedor e dia (mesma fonte do ranking)
    const pontosDia = {};
    for (const dia of diasEsperados) {
      const j = await (await fetch(`${origin}/api/brasileirao-lances?dia=${dia}&limite=9000`, { signal: AbortSignal.timeout(30000) })).json();
      if (!Array.isArray(j.lances)) return resp({ erro: 'sem lances para ' + dia }, 502);
      const m = {};
      for (const l of j.lances) { const r = String(l.rca == null ? '' : l.rca); if (r) m[r] = (m[r] || 0) + (Number(l.pontos) || 0); }
      pontosDia[dia] = m;
    }
    const invictas = [];
    for (const [rca, info] of equipe) {
      const placar = diasEsperados.map((d) => (pontosDia[d] && pontosDia[d][rca]) || 0);
      if (placar.every((p) => p >= minVitoria)) invictas.push({ rca, ...info, placar });
    }

    let gravados = 0;
    if (!dry && invictas.length) {
      const porFilial = {};
      for (const v of invictas) {
        const obs = `Vitória em ${diasEsperados.length} de ${diasEsperados.length} dias úteis (${fmtBR(diasEsperados[0])} a ${fmtBR(ultimo)}) | pontos por dia: ${v.placar.join(', ')} | mínimo ${minVitoria} | +3 pontos na liga`;
        const base = { nivel: 'semanainvicta', rca: v.rca, vendedor: v.nome, supervisor: v.supervisor, motivo: `Semana Invicta ${semana}`, obs: obs.slice(0, 300) };
        (porFilial[v.filial] = porFilial[v.filial] || []).push({ ...base, chave: `semanainvicta|${v.rca}|${semana}` });
        (porFilial.MTZ = porFilial.MTZ || []).push({ ...base, chave: `${v.filial}|semanainvicta|${v.rca}|${semana}` });
      }
      for (const [filial, lances] of Object.entries(porFilial)) {
        const r = await fetch(`${origin}/api/tv-lances`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filial, lances }), signal: AbortSignal.timeout(20000) }).catch(() => null);
        if (r && r.ok) { const jj = await r.json().catch(() => null); gravados += (jj && jj.novos ? jj.novos.length : 0); }
      }
    }
    if (!dry) await env.DB.prepare("INSERT OR REPLACE INTO semana_invicta_checada (semana, feito_em, qtd) VALUES (?, datetime('now'), ?)").bind(semana, invictas.length).run();
    return resp({ status: dry ? 'SIMULACAO' : 'CHECADA', semana, dias: diasEsperados, min_pontos_vitoria: minVitoria, vendedores_na_equipe: equipe.size, invictas: invictas.length, gravados, lista: invictas.map((v) => ({ filial: v.filial, rca: v.rca, nome: v.nome, supervisor: v.supervisor, pontos_por_dia: v.placar })) });
  } catch (e) {
    return resp({ erro: String(e).slice(0, 300) }, 500);
  }
}
