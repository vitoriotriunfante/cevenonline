import { ocultosDaEquipe, lanceDeOculto } from '../_lib/equipe_ocultos.js';
import { ehFeriado, ehFimDeSemana } from '../_lib/feriados.js';
import { CEVEN_APP_SECRET } from '../_lib/ceven_auth.js';
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: registro dos LANCES da TV (pênaltis, cartões, supervisores) no D1 (tabela tv_lances,
//          migrations/0004_tv_lances.sql). É o que garante que um lance seja apitado UMA vez só,
//          mesmo com várias TVs abertas, recarregamentos ou aparelhos diferentes.
// PROJETO: CFTV/TV (não é WhatsApp).
// PREMISSA: 100% ONLINE - nada aqui pode depender do PC do Vitório (ver PREMISSA_ONLINE.md).
// POST {filial, lances:[{chave,nivel,rca,vendedor,...}]} -> registra (INSERT OR IGNORE) e devolve
//          { baseline, novos:[chaves realmente novas], total }.
//          "baseline" = primeira sincronização do dia dessa filial: o que já existia NÃO é apitado.
// GET  ?filial=TBL[&dia=YYYY-MM-DD] -> lances do dia (para histórico, ranking e "Revisar 30 min").
// AVISO: endpoint público (igual ao resto do site). Só guarda texto curto; validado e limitado.
// =========================================================================

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });

function agoraSP() { const c = R.relogioSP(); return { dia: c.dia, hora: c.hms }; }
const txt = (v, n = 200) => (v == null ? null : String(v).slice(0, n));
const int = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.trunc(+v) : null);

export async function onRequestGet({ request, env }) {
  if (!env.DB) return resp({ erro: 'banco indisponivel' }, 503);
  const u = new URL(request.url);
  const filial = (u.searchParams.get('filial') || '').toUpperCase();
  // filial=TODAS (13/10/2026): a TV da MATRIZ so via os lances que ELA mesma detectava (filial MTZ: 119 penaltis, 0 gol) e nunca os GOLS que o coletor grava
  // com a filial real. Com TODAS ela recebe os lances de todas as filiais (so leitura, mesmos filtros). Opcional: desde=HH:MM:SS (so os mais novos).
  const todas = filial === 'TODAS';
  if (!todas && !/^[A-Z]{3}$/.test(filial)) return resp({ erro: 'filial invalida' }, 400);
  const desde = /^\d{2}:\d{2}(:\d{2})?$/.test(u.searchParams.get('desde') || '') ? u.searchParams.get('desde') : '00:00:00';
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : agoraSP().dia;
  try {
    const { results } = await env.DB.prepare(
      todas
        ? `SELECT chave, nivel, rca, vendedor, supervisor, cliente_id, cliente, motivo, dias_sem_compra, ultima_compra, tempo_visita, obs, hora_sp, baseline, filial
           FROM tv_lances WHERE dia = ? AND filial != 'MTZ' AND nivel != 'marker' AND hora_sp >= ? ORDER BY hora_sp`
        : `SELECT chave, nivel, rca, vendedor, supervisor, cliente_id, cliente, motivo, dias_sem_compra, ultima_compra, tempo_visita, obs, hora_sp, baseline
       FROM tv_lances WHERE dia = ? AND filial = ? AND nivel != 'marker' ORDER BY hora_sp`
    ).bind(...(todas ? [dia, desde] : [dia, filial])).all();
    // Mesma regra da liga: nada de madrugada (lance de ontem repetido a meia-noite) e nada que foi tirado da liga com trilha (lances_excluidos_liga)
    const ex = new Set();
    try { const r2 = await env.DB.prepare('SELECT chave, motivo FROM lances_excluidos_liga WHERE dia = ?').bind(dia).all(); for (const e of r2.results || []) if (e && e.motivo) ex.add(e.chave); } catch { /* tabela ausente: segue sem exclusoes */ }
    const oc = await ocultosDaEquipe(new URL(request.url).origin);
    const limpos = (results || []).filter((r) => !lanceDeOculto(todas ? r : { ...r, filial }, oc) && String(r.hora_sp || '') >= '06:00:00' && !ex.has(String(r.chave || '').replace(/^[A-Z]{3}[|]/, '')) && !ex.has(r.chave));
    return resp({ dia, filial, lances: limpos });
  } catch (e) {
    return resp({ erro: 'falha ao ler: ' + e.message }, 500);
  }
}

export const PRECISA_PROVA = /^(?:[A-Z]{3}[|])?(?:ven10|vis11|gol_inativo|gol_mix|gol_quinzenas|gol_marca_propria|gol_mp_tripla|gol_relampago|gol_acrescimos|gol_meta1t|gol_conversao|gol_goleada|gol_hattrick|hattrick|gol_super|gol_campeao|imp[|](?:gps|visita0))(?:[|]|$)/;

export async function onRequestPost({ request, env }) {
  if (!env.DB) return resp({ erro: 'banco indisponivel' }, 503);
  let b;
  try { b = await request.json(); } catch { return resp({ erro: 'json invalido' }, 400); }
  const filial = String(b.filial || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(filial)) return resp({ erro: 'filial invalida' }, 400);
  const lances = Array.isArray(b.lances) ? b.lances.slice(0, 200) : [];
  const { dia, hora } = agoraSP();
  // Madrugada (antes das 06h) o CEVEN ainda serve o roteiro de ontem com o dia novo: nada e gravado (06/10/2026: 845 lances repetidos de ontem)
  if (String(hora) < '06:00:00') return resp({ novos: [], ignorado: 'madrugada' });
  if (ehFeriado(dia)) return resp({ novos: [], ignorado: 'feriado' });
  if (ehFimDeSemana(dia)) return resp({ novos: [], ignorado: 'fim_de_semana' });   // fim de semana sem lance (Vitorio, 19/10/2026)   // feriado nao conta para a Liga (Vitorio, 13/10/2026)
  const iso = new Date().toISOString();
  try {
    // marcador do dia: se acabou de ser criado, esta é a 1ª sincronização do dia (baseline)
    const m = await env.DB.prepare(
      `INSERT OR IGNORE INTO tv_lances (dia, filial, chave, nivel, hora_sp, visto_em, baseline) VALUES (?, ?, '__marker__', 'marker', ?, ?, 1)`
    ).bind(dia, filial, hora, iso).run();
    const baseline = (m.meta && m.meta.changes) === 1;

    const ocP = await ocultosDaEquipe(new URL(request.url).origin); // vendedor OCULTO na Gestao de Equipe nao gera lance
    const validos = lances.filter((l) => l && !lanceDeOculto({ ...l, filial }, ocP) && typeof l.chave === 'string' && l.chave.length <= 120 && ['penalti', 'venda10', 'visita10', 'supervisor', 'gol', 'vermelho', 'impedimento', 'amarelo', 'defesa', 'golcontra', 'hattrick', 'pedido_rota', 'semanainvicta'].includes(l.nivel));
    // SEM COMPROVACAO NAO TEM LANCE (Vitorio, 08/10/2026: "isso nao estava proibido?"): a TV/Matriz nao grava lance que pontua so com a sigla no obs. Quem grava com prova e o coletor (a cada 5 min); sem prova o lance
    // nao entra no registro, nao pontua e nao vira popup. Pênalti, defesa, devolucao e pedido na rota se provam pelos proprios campos e seguem como antes.
    // Hat-trick: UM por vendedor por dia (a chave leva a hora do 3o check-in; check-in sincronizado tarde gerava outra trinca no mesmo dia)
    for (let i = validos.length - 1; i >= 0; i--) {
      const m = /^(?:[A-Z]{3}[|])?gol_hattrick[|]([^|]+)[|]/.exec(validos[i].chave); if (!m) continue;
      const ja = await env.DB.prepare("SELECT 1 AS x FROM tv_lances WHERE dia = ? AND rca = ? AND chave LIKE '%gol_hattrick|%' AND chave NOT LIKE ? LIMIT 1").bind(dia, String(validos[i].rca == null ? m[1] : validos[i].rca), '%' + validos[i].chave.replace(/^[A-Z]{3}[|]/, '')).first();
      if (ja) validos.splice(i, 1);
    }
    // CARTAO SO COM O CEVEN AO VIVO (Vitorio, 20/10/2026: "o cara tem que ter check-in, nao e isso?"; 45 de 72 amarelos sairam com o roteiro da meia-noite da base):
    // antes de gravar um amarelo (ven10) ou vermelho de abandono (vis10/vis11) NOVO, le o roteiro do vendedor no CEVEN agora. Qualquer check-in = sem cartao.
    // CEVEN nao respondeu = sem cartao (nunca pune sem prova); o coletor tenta de novo na proxima rodada.
    {
      const CARTAO = /^(?:[A-Z]{3}[|])?(ven10|vis10|vis11)[|]/;
      const cand = validos.filter((l) => CARTAO.test(l.chave));
      if (cand.length) {
        const { results: ja } = await env.DB.prepare("SELECT chave FROM tv_lances WHERE dia = ? AND filial = ? AND (chave LIKE '%ven10|%' OR chave LIKE '%vis10|%' OR chave LIKE '%vis11|%')").bind(dia, filial).all();
        const gravados = new Set((ja || []).map((x) => x.chave));
        const rcaDe = (l) => String(l.rca == null ? l.chave.split('|').pop() : l.rca);
        const rcas = [...new Set(cand.filter((l) => !gravados.has(l.chave)).map(rcaDe))];
        const temCheckin = new Map();
        for (let i = 0; i < rcas.length; i += 5) {
          await Promise.all(rcas.slice(i, i + 5).map(async (r) => {
            try {
              const x = await fetch(`https://ceven.drivetriunfante-locomotiva.com.br/api/rca/roteiro-hoje?filial=${filial.toLowerCase()}1&id=${r}`, { headers: { 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(12000) });
              const rot = x.ok ? await x.json() : null;
              if (Array.isArray(rot)) temCheckin.set(r, rot.some((c) => c && (c.checkin_horario || !['ABERTO', 'AGENDADO'].includes(c.status))));
            } catch (e) { /* sem resposta = sem cartao */ }
          }));
        }
        for (let i = validos.length - 1; i >= 0; i--) {
          const l = validos[i];
          if (!CARTAO.test(l.chave) || gravados.has(l.chave)) continue;
          if (temCheckin.get(rcaDe(l)) !== false) validos.splice(i, 1);   // tem check-in no CEVEN agora, ou o CEVEN nao confirmou: nao grava
        }
      }
    }
    const antes = validos.length;
    for (let i = validos.length - 1; i >= 0; i--) if (PRECISA_PROVA.test(validos[i].chave) && String(validos[i].obs || '').length <= 3) validos.splice(i, 1);
    const semProvaIgnorados = antes - validos.length;
    let novos = [];
    // Devolucao: uma NOTA gera UM lance na vida toda (a nota continua na janela de 3 dias e voltaria a cada dia).
    for (let i = validos.length - 1; i >= 0; i--) {
      // gol_campeao (meta do mes batida) tambem e UMA VEZ por vendedor no mes: a chave leva o mes e a condicao continua verdadeira nos dias seguintes
      // (achado 05/10/2026: ~92 "Campeao da Rodada" por dia, +8 pontos cada, repetidos todo dia e em todas as telas).
      if (/^([A-Z]{3}[|])?(ver_dev|golcontra_dev|gol_campeao|semanainvicta)[|]/.test(validos[i].chave)) {
        const ex = await env.DB.prepare('SELECT 1 AS x FROM tv_lances WHERE filial = ? AND chave = ? AND dia != ? LIMIT 1').bind(filial, validos[i].chave, dia).first();
        if (ex) validos.splice(i, 1);
      }
    }
    if (validos.length) {
      const stmts = validos.map((l) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO tv_lances (dia, filial, chave, nivel, rca, vendedor, supervisor, cliente_id, cliente, motivo, dias_sem_compra, ultima_compra, tempo_visita, obs, hora_sp, visto_em, baseline)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(dia, filial, l.chave, l.nivel, txt(l.rca, 20), txt(l.vendedor), txt(l.supervisor), txt(l.cliente_id, 30), txt(l.cliente), txt(l.motivo), int(l.dias_sem_compra), txt(l.ultima_compra, 10), txt(l.tempo_visita, 8), txt(l.obs, 700), hora, iso, baseline ? 1 : 0)
      );
      const rs = await env.DB.batch(stmts);
      novos = validos.filter((_, i) => rs[i].meta && rs[i].meta.changes === 1).map((l) => l.chave);
      // Prova do lance: se o lance ja existia sem prova (gravado antes por outra TV), completa o obs. Nunca sobrescreve prova existente.
      const completa = validos.filter((l, i) => !(rs[i].meta && rs[i].meta.changes === 1) && txt(l.obs, 700));
      if (completa.length) {
        await env.DB.batch(completa.map((l) => env.DB.prepare(
          `UPDATE tv_lances SET obs = ? WHERE dia = ? AND filial = ? AND chave = ? AND (obs IS NULL OR obs = '' OR length(obs) <= 3 OR (obs NOT LIKE '%[QUALIF:%' AND ? LIKE '%[QUALIF:%'))`
        ).bind(txt(l.obs, 700), dia, filial, l.chave, txt(l.obs, 700))));
      }
    }
    return resp({ dia, filial, baseline, novos, total: validos.length, sem_prova_ignorados: semProvaIgnorados });
  } catch (e) {
    return resp({ erro: 'falha ao gravar: ' + e.message }, 500);
  }
}
