// =========================================================================
// MONITOR.IA · PILOTO (21/11/2026) · functions/_lib/monitoria/piloto.js
// Decisao do Vitorio (21/11): piloto com os 2 supervisores de cada filial que mais conversam com o JOTA (22), sinais:
//   10h  ABERTURA   — vendedor de varejo com rota e sem visita + positivacao abaixo do ritmo do mes
//   12h  MEIO       — justificativas de nao venda da equipe ate agora + cartoes/penaltis da Liga
//   17h  TARDE      — idem
//   18h30 FECHAMENTO — o dia da equipe
// (hora LOCAL da filial: TCG, MCD e TCA tem 1 h a menos que Brasilia)
// Auditoria de 20-21/11: os alertas antigos (analista.js) saiam por fora do teto antiban, com texto de IA inventando numero, bloqueio de pedido ja
// faturado e 16 mensagens para a mesma pessoa. Aqui:
//   - os numeros saem das MESMAS funcoes do JOTA (carregaEscopo = Gestao de Equipe + GEROT + Clube): o alerta diz o que o JOTA diz;
//   - texto FIXO (a IA so reescreve se a chave monitoria_ia estiver ligada, e a reescrita so vale se TODO numero e TODO codigo ja estiver no texto fixo);
//   - liberacao PROPRIA (config_flags monitoria_liberada_ate) sem mexer na pausa geral; fora dela tudo fica so gravado como SOMBRA;
//   - teto antiban (cotaEnvio) + no maximo 1 por janela e 4 por dia por supervisor; nada em feriado/fim de semana; silencio se o Clube estiver velho (> 40 min).
// =========================================================================
import { carregaEscopo } from '../jota/escopo.js';
import { criaBase } from '../jota/fontes.js';
import { cotaEnvio, hojeSP, R$, N, titulo } from '../jota/base.js';
import { ehFeriado, ehFimDeSemana } from '../feriados.js';
import R from '../../../public/regras.js';

const FUSO1H = ['TCG', 'MCD', 'TCA'];
export const JANELAS = [{ id: 'abertura', ini: '10:00' }, { id: 'meio', ini: '12:00' }, { id: 'tarde', ini: '17:00' }, { id: 'fechamento', ini: '18:30' }];
const MAX_DIA = 4, CLUBE_MAX_MIN = 40, NL = String.fromCharCode(10);
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const nomeCurto = (s) => titulo(String(s || '').replace(/^(CLT|PJ)\s*-?\s*/i, '').toLowerCase()).split(' ').filter((w) => !/^(De|Da|Do|Dos|Das|E)$/.test(w)).slice(0, 2).join(' ');
const vn = (v) => `${v.rca} - ${nomeCurto(v.nome)}`;

// hora local da filial (HH:MM)
export function horaLocal(filial, agora = new Date()) {
  const d = new Date(agora.getTime() - (FUSO1H.includes(filial) ? 3600e3 : 0));
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}
export function janelaAgora(filial, agora = new Date()) {
  const h = horaLocal(filial, agora), [hh, mm] = h.split(':').map(Number), m = hh * 60 + mm;
  return JANELAS.find((j) => { const [a, b] = j.ini.split(':').map(Number), ini = a * 60 + b; return m >= ini && m < ini + 30; }) || null;   // 30 min = 2 batidas do relogio (se a 1a falhar, a 2a tenta; o registro do dia impede repetir)
}
const flag = async (db, k) => { try { const r = await db.prepare('SELECT valor FROM config_flags WHERE chave = ?').bind(k).first(); return r ? r.valor : null; } catch (e) { return null; } };

// dias uteis do mes (para o ritmo da positivacao): seg-sex sem feriado
function diasUteis(hoje) {
  const [y, m] = hoje.split('-').map(Number), fim = new Date(Date.UTC(y, m, 0)).getUTCDate(); let tot = 0, ate = 0;
  for (let d = 1; d <= fim; d++) { const iso = `${hoje.slice(0, 8)}${String(d).padStart(2, '0')}`; if (ehFeriado(iso) || ehFimDeSemana(iso)) continue; tot++; if (iso <= hoje) ate++; }
  return { tot, ate };
}

// ---------- textos (fixos) ----------
async function textoAbertura(ctx) {
  const { db, fil, equipe, V, hoje } = ctx;
  const rcas = V.map((v) => String(Number(v.rca))).filter(Boolean);
  if (!rcas.length) return null;
  const inRca = rcas.join(',');
  // 23/11/2026 (auditoria das 43 sombras): checar clube_venda_dia.roteiros (>0, NUNCA cair em v.rotaHoje velho do CEVEN) e confirmar 0 check-in em clube_checkin + 0 pedidos antes de cobrar "sem visita"
  const [vdRows, ckRows, pdRows] = await Promise.all([
    db.prepare(`SELECT CAST(rca AS INTEGER) r, roteiros, visitas_rota, ped_total FROM clube_venda_dia WHERE dia = ? AND filial = ? AND CAST(rca AS INTEGER) IN (${inRca})`).bind(hoje, fil).all().then((x) => x.results || []).catch(() => []),
    db.prepare(`SELECT DISTINCT CAST(rca AS INTEGER) r FROM clube_checkin WHERE dia = ? AND filial = ? AND tipo = 'CHECKIN' AND CAST(rca AS INTEGER) IN (${inRca})`).bind(hoje, fil).all().then((x) => x.results || []).catch(() => []),
    db.prepare(`SELECT DISTINCT CAST(rca AS INTEGER) r FROM clube_pedido WHERE dia = ? AND filial = ? AND CAST(rca AS INTEGER) IN (${inRca})`).bind(hoje, fil).all().then((x) => x.results || []).catch(() => []),
  ]);
  const vdMap = new Map(vdRows.map((x) => [String(x.r), x]));
  const ckSet = new Set(ckRows.map((x) => String(x.r)));
  const pdSet = new Set(pdRows.map((x) => String(x.r)));
  const semVis = V.filter((v) => {
    const r = String(Number(v.rca)), vd = vdMap.get(r);
    if (!vd || !(Number(vd.roteiros) > 0)) return false;
    if (Number(vd.visitas_rota) > 0 || ckSet.has(r)) return false;
    if (Number(vd.ped_total) > 0 || pdSet.has(r)) return false;
    return true;
  }).map((v) => ({ v, rot: Number((vdMap.get(String(Number(v.rca))) || {}).roteiros) || 0 }));
  const { tot, ate } = diasUteis(hoje), esp = tot ? ate / tot : 0;
  const pos = V.filter((v) => Number(v.metaPos) > 0).map((v) => { const meta = Math.ceil(Number(v.metaPos)), p = Number(v.pos) || 0; return { v, p, meta, r: p / meta }; })
    .filter((x) => x.r < esp * 0.8).sort((a, b) => (a.r - esp) - (b.r - esp)).slice(0, 3);
  if (!semVis.length && !pos.length) return null;
  const L = [`🚶 *${equipe}* · ${ctx.hl}`];
  if (semVis.length) L.push('', `*Com rota e sem visita nem pedido até agora (${semVis.length}):*`, ...semVis.slice(0, 8).map((x) => `• ${vn(x.v)} · rota ${N(x.rot)}`), ...(semVis.length > 8 ? [`• e mais ${semVis.length - 8}`] : []));
  if (pos.length) L.push('', `*Positivação abaixo do ritmo* _(esperado hoje ${Math.round(esp * 100)}%)_:`, ...pos.map((x) => `• ${vn(x.v)}: ${N(x.p)} de ${N(x.meta)} (${Math.round(x.r * 100)}%) · faltam ${N(x.meta - x.p)}`));
  L.push('', `👉 ${semVis.length ? `Ligar agora para *${vn(semVis[0].v)}*.` : `Cobrar abertura de clientes de *${vn(pos[0].v)}*.`}`);
  return L.join(NL);
}
function descLance(c) {
  const head = String(c.obs || '').split('|')[0].trim();
  if (head) return head.slice(0, 90);
  if (c.motivo) return `justificativa ${titulo(String(c.motivo).toLowerCase())}${c.dias_sem_compra != null ? ` · ${c.dias_sem_compra}d` : ''}`.slice(0, 90);
  const ch = String(c.chave || '');
  if (ch.startsWith('pen|estoque|')) return 'pênalti: estoque suficiente (+30d)';
  if (ch.startsWith('pen|fechado|')) return 'pênalti: cliente fechado (+45d)';
  if (ch.startsWith('vis11|')) return 'cartão vermelho: 0 visitas/pedidos até 11h';
  if (ch.startsWith('ver_dev|')) return 'cartão vermelho: devolução "cliente não pediu"';
  return c.nivel === 'vermelho' ? 'cartão vermelho na Liga' : 'pênalti na Liga';
}
async function textoJustificativas(ctx, ate) {
  const { db, equipe, V, hoje, fil } = ctx; const rcas = V.map((v) => String(v.rca)); if (!rcas.length) return null;
  // 21/11/2026 (auditoria dos analistas): o 'dia' gravado e o da COLETA; vale a data/hora em que a justificativa foi feita (data_hora)
  let J = []; try { J = (await db.prepare(`SELECT rca, motivo, data_hora FROM clube_justificativa WHERE filial = ? AND rca IN (${rcas.map(() => '?').join(',')}) AND substr(data_hora, 1, 10) = ?`).bind(fil, ...rcas, hoje).all()).results || []; } catch (e) { return null; }
  let C = []; try { C = (await db.prepare(`SELECT rca, vendedor, nivel, chave, obs, motivo, dias_sem_compra, cliente, hora_sp FROM tv_lances WHERE dia = ? AND filial = ? AND nivel IN ('penalti', 'vermelho') AND rca IN (${rcas.map(() => '?').join(',')}) ORDER BY hora_sp`).bind(hoje, fil, ...rcas).all()).results || []; } catch (e) { C = []; }
  if (!J.length && !C.length) return null;
  const rot = V.reduce((a, v) => a + (Number(v.visP) || 0), 0);
  const mot = new Map(), pv = new Map(); for (const j of J) { const m = titulo(String(j.motivo || 'sem motivo').toLowerCase()); mot.set(m, (mot.get(m) || 0) + 1); pv.set(String(j.rca), (pv.get(String(j.rca)) || 0) + 1); }
  const nomeDe = (r) => { const v = V.find((x) => String(x.rca) === String(r)); return v ? vn(v) : String(r); };
  const L = [`📋 *Justificativas de não venda — ${equipe}* · até ${ate}`];
  if (J.length) {
    L.push(`*${N(J.length)}*${rot ? ` em ${N(rot)} visitas da rota (${Math.round(J.length / rot * 100)}%)` : ''}`, '', '*Motivos:*', ...[...mot].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, n]) => `• ${m}: ${N(n)}`));
    L.push('', '*Quem mais justificou:*', ...[...pv].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r, n]) => `• ${nomeDe(r)}: ${N(n)}`));
  }
  if (C.length) L.push('', `⚽ *Cartões e pênaltis na Liga hoje (${C.length}):*`, ...C.slice(0, 5).map((c) => `• ${String(c.hora_sp || '').slice(0, 5)} · ${nomeDe(c.rca)} · ${c.nivel === 'vermelho' ? '🟥' : '🥅'} ${descLance(c)}`));
  const top = [...pv].sort((a, b) => b[1] - a[1])[0];
  L.push('', `👉 ${top ? `Rever com *${nomeDe(top[0])}* os clientes justificados.` : `Falar com *${nomeDe(C[0].rca)}* sobre o lance.`}`);
  return L.join(NL);
}
async function textoFechamento(ctx) {
  const { db, equipe, V, hoje, fil } = ctx; const rcas = V.map((v) => String(v.rca)); if (!rcas.length) return null;
  let D = []; try { D = (await db.prepare(`SELECT rca, roteiros, visitas_rota, ped_total, total_pedido FROM clube_venda_dia WHERE dia = ? AND filial = ? AND rca IN (${rcas.map(() => '?').join(',')})`).bind(hoje, fil, ...rcas).all()).results || []; } catch (e) { return null; }
  if (!D.length) return null;
  const s = (k) => D.reduce((a, x) => a + (Number(x[k]) || 0), 0);
  if (!s('roteiros') && !s('ped_total')) return null;   // dia sem rota e sem pedido (sabado, ponte): nada a dizer
  let G = { g: 0, c: 0 }; try { G = (await db.prepare(`SELECT SUM(nivel IN ('gol','hattrick')) g, SUM(nivel IN ('penalti','vermelho')) c FROM tv_lances WHERE dia = ? AND filial = ? AND rca IN (${rcas.map(() => '?').join(',')})`).bind(hoje, fil, ...rcas).first()) || G; } catch (e) { /* sem liga */ }
  const zer = V.filter((v) => (Number(v.visP) || 0) > 0 && !(Number((D.find((x) => String(x.rca) === String(v.rca)) || {}).ped_total) > 0));
  const L = [`🌙 *Fechamento — ${equipe}*`, `🚶 Visitas: *${N(s('visitas_rota'))} de ${N(s('roteiros'))}*`, `📝 Pedidos: *${N(s('ped_total'))}* · *${R$(s('total_pedido'))}*`];
  if (Number(G.g) || Number(G.c)) L.push(`⚽ Liga: ${N(Number(G.g) || 0)} gol(s) · ${N(Number(G.c) || 0)} cartão(ões)/pênalti(s)`);
  if (zer.length) L.push('', `*Com rota e sem pedido hoje (${zer.length}):*`, ...zer.slice(0, 6).map((v) => `• ${vn(v)}`), ...(zer.length > 6 ? [`• e mais ${zer.length - 6}`] : []));
  L.push('', `👉 ${zer.length ? `Amanhã cedo: falar com *${vn(zer[0])}*.` : 'Todos com rota venderam hoje. 👏'}`);
  return L.join(NL);
}

// IA so reescreve com conferencia: todo numero e todo codigo 'NNN -' do texto novo tem que existir no texto fixo
export function confereReescrita(fixo, novo) {
  if (!novo || novo.length > fixo.length * 1.4) return false;
  const nums = (s) => (String(s).match(/\d[\d.,]*/g) || []).map((x) => x.replace(/[.,]$/, ''));
  const base = new Set(nums(fixo)); return nums(novo).every((n) => base.has(n));
}
async function talvezIA(env, db, fixo) {
  if (String(await flag(db, 'monitoria_ia') || '') !== 'on' || !env.AI) return { texto: fixo, motor: 'fixo' };
  try {
    const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [
      { role: 'system', content: 'Você reescreve alertas de WhatsApp para supervisores de vendas em português do Brasil. Mantenha EXATAMENTE os mesmos números, códigos e nomes, na mesma ordem. Não acrescente nenhum número, nome, cliente, valor, data ou porcentagem. Não invente nada. Só deixe o texto mais humano e direto. Devolva só o texto.' },
      { role: 'user', content: fixo }] });
    const novo = String((r && (r.response || r.result)) || '').trim();
    return confereReescrita(fixo, novo) ? { texto: novo, motor: 'ia_conferida' } : { texto: fixo, motor: 'fixo (ia reprovada na conferencia)' };
  } catch (e) { return { texto: fixo, motor: 'fixo (ia falhou)' }; }
}

// ---------- execucao por filial ----------
export async function executarPiloto(origin, env, opts = {}) {
  const db = env.DB, fil = String(opts.filial || '').toUpperCase(), hoje = hojeSP();
  if (!/^[A-Z]{3}$/.test(fil)) return { erro: 'filial obrigatoria' };
  if (!opts.forcar && (ehFeriado(hoje) || ehFimDeSemana(hoje))) return { filial: fil, silencio: 'feriado ou fim de semana' };
  const jan = opts.janela ? JANELAS.find((j) => j.id === opts.janela) : janelaAgora(fil);
  if (!jan) return { filial: fil, silencio: 'fora das janelas', hora_local: horaLocal(fil) };
  // quem esta no piloto
  let lista = []; try { lista = JSON.parse(await flag(db, 'monitoria_piloto') || '[]'); } catch (e) { lista = []; }
  const cels = lista.map(String);
  if (!cels.length) return { filial: fil, silencio: 'piloto vazio' };
  const { results: C } = await db.prepare(`SELECT celular, nome, papel, filial, supervisor FROM bot_contatos WHERE celular IN (${cels.map(() => '?').join(',')}) AND filial = ? AND ativo = 1`).bind(...cels, fil).all();
  if (!C || !C.length) return { filial: fil, silencio: 'ninguem desta filial no piloto' };
  // Clube fresco (o dia vem dele); velho = silencio (16/11: 'sem check-in' falso com a leitura parada desde 05:29)
  const cl = await db.prepare('SELECT MAX(lido_em) l FROM clube_rodada WHERE dia = ?').bind(hoje).first().catch(() => null);
  const idade = cl && cl.l ? (Date.now() - Date.parse(cl.l)) / 60000 : 9999;
  if (idade > CLUBE_MAX_MIN && !opts.forcar) return { filial: fil, janela: jan.id, silencio: `Clube da Venda lido ha ${Math.round(idade)} min` };
  const de = String(await flag(db, 'monitoria_liberada_de') || '');
  const ate = String(await flag(db, 'monitoria_liberada_ate') || '');
  const agoraIso = new Date().toISOString();
  const liberado = ate > agoraIso && (!de || agoraIso >= de) && !opts.sombra;
  const modo = opts.teste ? 'TESTE' : liberado ? 'PILOTO' : 'SOMBRA';
  const B = criaBase(origin, env), hl = horaLocal(fil), out = [];
  for (const s of C) {
    const regra = `PILOTO:${jan.id}`;
    try {
      const ja = await db.prepare("SELECT status FROM monitoria_envios WHERE regra_id = ? AND data = ? AND celular = ? AND modo = ?").bind(regra, hoje, s.celular, modo).first();
      if (ja && !opts.teste) { out.push({ sup: s.nome, status: 'JA_FEITO' }); continue; }
      const nDia = await db.prepare("SELECT COUNT(*) n FROM monitoria_envios WHERE regra_id LIKE 'PILOTO:%' AND data = ? AND celular = ? AND status = 'ENVIADO'").bind(hoje, s.celular).first();
      if (modo === 'PILOTO' && Number(nDia && nDia.n) >= MAX_DIA) { out.push({ sup: s.nome, status: 'TETO_DIA' }); continue; }
      const supNome = s.supervisor || s.nome;
      const Es = await carregaEscopo(B, { nome: 'Equipe ' + nomeCurto(supNome), filiais: [fil], grupo: null, supervisor: supNome });
      const sSup = sem(supNome);
      // so vendedor de varejo de verdade (nunca o proprio supervisor, gerente, vago ou setor)
      const V = (Es.vend || []).filter((v) => v.varejo && v.ehVendedorReal !== false && sem(v.nome) !== sSup && !/SUPERVISOR|GERENTE|VAGO|SETOR/.test(sem(v.nome)));
      const ctx = { db, fil, hoje, hl, V, equipe: `Equipe ${nomeCurto(supNome)}` };
      const fixo = jan.id === 'abertura' ? await textoAbertura(ctx) : jan.id === 'fechamento' ? await textoFechamento(ctx) : await textoJustificativas(ctx, hl);
      if (!fixo) { out.push({ sup: s.nome, status: 'NADA_A_DIZER' }); continue; }
      const { texto: t0, motor } = await talvezIA(env, db, fixo);
      const texto = `${t0}${NL}${NL}_Responda *ok* se já tratou ou *não procede* se estiver errado._`;
      let status = modo === 'PILOTO' ? 'ENVIANDO' : modo;
      await db.prepare('INSERT OR IGNORE INTO monitoria_envios (regra_id, data, celular, destino_real, papel, filial, rca, modo, texto_preview, bonequinho, status, enviado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(regra, hoje, s.celular, s.nome, 'supervisor', fil, '', modo, texto.slice(0, 1800), motor, status, new Date().toISOString()).run();
      if (modo === 'PILOTO') {
        // teto antiban: falha do D1 aqui = nao envia (a cota do JOTA libera quando o D1 falha; o proativo nao)
        await db.prepare('SELECT COUNT(*) n FROM wa_cota WHERE dia = ?').bind(hoje).first();
        const cota = await cotaEnvio(env, s.celular, { manual: true });
        if (!cota.ok) status = 'BLOQUEADO_COTA';
        else { const cfg = env.EVO_URL && env.EVO_KEY ? R.evoCfg(env) : null; const rt = cfg ? await R.enviarTexto(cfg, s.celular, texto) : { ok: false }; status = rt && rt.ok ? 'ENVIADO' : 'ERRO'; }
        await db.prepare('UPDATE monitoria_envios SET status = ? WHERE regra_id = ? AND data = ? AND celular = ? AND modo = ?').bind(status, regra, hoje, s.celular, modo).run();
        if (status === 'ENVIADO') await db.prepare("INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?, ?, 'out', ?, 'monitoria_piloto')").bind(s.celular, s.nome, texto.slice(0, 2500)).run().catch(() => {});
      }
      out.push({ sup: s.nome, status, motor, texto: opts.ver ? texto : undefined });
    } catch (e) { out.push({ sup: s.nome, status: 'ERRO', erro: String(e && e.message || e).slice(0, 160) }); }
  }
  return { filial: fil, janela: jan.id, hora_local: hl, modo, clube_min: Math.round(idade), resultados: out };
}
