// ==========================================================================================
// FICHA DO ARQUIVO: functions/_lib/jota/respostas/gerot_painel.js
// O QUE FAZ: os numeros do mes do Brasil / de uma filial SO PELO GEROT, com a carteira e os comparativos do proprio GEROT.
//   Uma conta so para "como esta o Brasil", "tendencia" e "positivacao" (Vitorio, 17/11/2026: "ta errado sua tendencia... precisa pegar os
//   dados do GEROT... incluir pendentes (carteira)... note o tanto de dados que tenho de faturamento e comparativos... e positivacao, que e o meu foco").
// FONTES (D1): gerot_filial_mes (mes atual: faturado, carteira, meta, captacao, meta ideal de captacao, necessidade/dia, captacao M-1 ate o mesmo dia,
//   positivacao e seus comparativos A-1, 3M, M-1, Bench); gerot_vendas (faturado dos meses fechados: M-1, media 3M, A-1).
// RITMO = o do GEROT: captacao do mes / meta ideal de captacao de hoje. Nao e projecao do Jota: e a regua do GEROT. Nada estimado.
// ==========================================================================================
import { N, R$, hojeSP } from '../base.js';

const K = {
  fat: 'Faturado líquido (R$)', cart: 'Carteira pendente (R$)', fc: 'Faturado + Carteira (R$)', meta: 'Meta (R$)',
  cap: 'Captação (R$)', ideal: 'Meta Ideal captação (R$)', nec: 'Necessidade dia captação (R$)', capM1: 'Captação M-1 (R$)', capDia: 'Captação Dia (R$)',
  pos: 'Positivação (filial + CNPJ)', posC: 'Positivação + Carteira', posM1: 'Positivação M-1', pos3M: 'Positivação 3M (média)', posA1: 'Positivação A-1',
  posDia: 'Positivação do dia', metaPos: 'Meta de positivação', dev: 'Devolução (R$)', corte: 'Cortes total (R$)',
};
const num = (d, k) => { const x = d[k]; return x == null || x === '' ? null : Number(x); };
const pct = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '—');
const delta = (a, b) => { if (!b) return ''; const d = (a / b - 1) * 100; return `${d >= 0 ? '▲ +' : '▼ '}${d.toFixed(1).replace('.', ',')}%`; };
const mi = (x) => (Math.abs(x) >= 1e6 ? `R$ ${(x / 1e6).toFixed(2).replace('.', ',')} mi` : R$(x));
const NOME_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesMenos = (mes, n) => { const [y, m] = mes.split('-').map(Number), d = new Date(Date.UTC(y, m - 1 - n, 1)); return d.toISOString().slice(0, 7); };
const rotMes = (mes) => `${NOME_MES[Number(mes.slice(5)) - 1]}/${mes.slice(2, 4)}`;

// LE O MES DO GEROT: por filial e total (soma). filiais = null => todas
export async function lerGerotMes(B, filiais = null) {
  if (!B || !B.env || !B.env.DB) return null;
  const db = B.env.DB, mes = hojeSP().slice(0, 7);
  let R = []; try { R = (await db.prepare('SELECT filial, dados FROM gerot_filial_mes WHERE mes = ?').bind(mes).all()).results || []; } catch (e) { return null; }
  if (filiais && filiais.length) R = R.filter((r) => filiais.includes(r.filial));
  if (!R.length) return null;
  const F = R.map((r) => { let d = {}; try { d = JSON.parse(r.dados || '{}'); } catch (e) { d = {}; } const o = { filial: r.filial }; for (const [k, lab] of Object.entries(K)) o[k] = num(d, lab); o.bench = (() => { const kb = Object.keys(d).find((x) => /^Positivação Bench/i.test(x)); return kb ? { rot: kb.replace(/^Positivação Bench\s*/i, ''), v: Number(d[kb]) } : null; })(); return o; });
  const T = { filial: 'Brasil' };
  for (const k of Object.keys(K)) { const vs = F.map((x) => x[k]).filter((x) => x != null); T[k] = vs.length ? vs.reduce((a, b) => a + b, 0) : null; }
  const bs = F.map((x) => x.bench).filter(Boolean); T.bench = bs.length ? { rot: bs[0].rot, v: bs.reduce((a, b) => a + b.v, 0) } : null;
  if (T.fc == null && T.fat != null) T.fc = (T.fat || 0) + (T.cart || 0);
  for (const x of F) if (x.fc == null && x.fat != null) x.fc = (x.fat || 0) + (x.cart || 0);
  // faturado dos meses fechados (gerot_vendas): M-1, media dos 3 ultimos, mesmo mes do ano passado
  const meses = [mesMenos(mes, 1), mesMenos(mes, 2), mesMenos(mes, 3), mesMenos(mes, 12)];
  const H = new Map();
  try {
    const qs = meses.map(() => '?').join(',');
    const { results } = await db.prepare(`SELECT mes, filial, SUM(json_extract(dados, '$."Faturado líquido (R$)"')) fat FROM gerot_vendas WHERE mes IN (${qs}) GROUP BY mes, filial`).bind(...meses).all();
    for (const r of results || []) if (!filiais || !filiais.length || filiais.includes(r.filial)) H.set(r.mes + '|' + r.filial, Number(r.fat) || 0);
  } catch (e) { /* sem historico: sem comparativo de faturado */ }
  const hist = (fil) => { const v = (m) => (fil ? H.get(m + '|' + fil) : [...H.entries()].filter(([k]) => k.startsWith(m + '|')).reduce((a, [, x]) => a + x, 0)) ?? null;
    const tem = (m) => (fil ? H.has(m + '|' + fil) : [...H.keys()].some((k) => k.startsWith(m + '|')));
    const m1 = tem(meses[0]) ? v(meses[0]) : null, tres = [0, 1, 2].every((i) => tem(meses[i])) ? (v(meses[0]) + v(meses[1]) + v(meses[2])) / 3 : null, a1 = tem(meses[3]) ? v(meses[3]) : null;
    return { m1, tres, a1 }; };
  T.hist = hist(null); for (const x of F) x.hist = hist(x.filial);
  let pos = null; try { const st = await db.prepare('SELECT posicao FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first(); pos = st && st.posicao ? st.posicao.replace(/^Atual\s*·\s*/, '') : null; } catch (e) { /* sem status */ }
  return { mes, F, T, pos, meses };
}

// LINHAS DO MES (vendas + ritmo + comparativos) para um total (Brasil ou filial)
export function linhasVendas(G, x) {
  const L = [];
  if (x.fat != null) L.push(`💰 Faturado *${mi(x.fat)}* + carteira ${mi(x.cart || 0)} = *${mi(x.fc || 0)}*` + (x.meta ? ` → *${pct(x.fc || 0, x.meta)}* da meta de ${mi(x.meta)}` : ''));
  if (x.cap != null && x.ideal) L.push(`📈 Captação do mês *${mi(x.cap)}* = *${pct(x.cap, x.ideal)}* do ideal para hoje (${mi(x.ideal)}) → no ritmo de hoje fecha em *${pct(x.cap, x.ideal)}* da meta`);
  if (x.nec != null && x.nec > 0) L.push(`🎯 Precisa captar *${mi(x.nec)}* por dia útil até o fim do mês`);
  if (x.capM1) L.push(`📅 Mês passado até o mesmo dia: captação ${mi(x.capM1)} → hoje *${delta(x.cap || 0, x.capM1)}*`);
  const h = x.hist || {}, hs = [];
  if (h.m1 != null) hs.push(`${rotMes(G.meses[0])} ${mi(h.m1)}`);
  if (h.tres != null) hs.push(`média 3M ${mi(h.tres)}`);
  if (h.a1 != null) hs.push(`${rotMes(G.meses[3])} ${mi(h.a1)}`);
  if (hs.length) L.push(`🗓️ Faturado de meses fechados: ${hs.join(' · ')}`);
  return L;
}
// LINHAS DA POSITIVACAO com os comparativos do GEROT
export function linhasPositivacao(G, x) {
  const L = [];
  if (x.pos == null) return L;
  L.push(`👥 Positivação: *${N(x.pos)}* faturados · com carteira *${N(x.posC || x.pos)}*` + (x.metaPos ? ` de ${N(x.metaPos)} → *${pct(x.posC || x.pos, x.metaPos)}* (faturado ${pct(x.pos, x.metaPos)})` : ''));
  const c = [];
  if (x.posM1) c.push(`M-1 ${N(x.posM1)} (${delta(x.posC || x.pos, x.posM1)})`);
  if (x.pos3M) c.push(`3M ${N(Math.round(x.pos3M))} (${delta(x.posC || x.pos, x.pos3M)})`);
  if (x.posA1) c.push(`A-1 ${N(x.posA1)} (${delta(x.posC || x.pos, x.posA1)})`);
  if (x.bench && x.bench.v) c.push(`Bench ${x.bench.rot} ${N(x.bench.v)} (${delta(x.posC || x.pos, x.bench.v)})`);
  if (c.length) L.push(`   comparado (com carteira × mês inteiro): ${c.join(' · ')}`);
  if (x.posDia != null) L.push(`   positivação do dia: *${N(x.posDia)}*`);
  return L;
}
export const fonteGerot = (G) => `_Fonte: GEROT${G.pos ? ` (${G.pos})` : ''} · ritmo = captação ÷ meta ideal de captação do GEROT · comparativos de positivação = mês inteiro._`;

// UMA LINHA POR FILIAL (Brasil): % fat+cart, ritmo, mes passado ate o mesmo dia, positivacao com carteira
export function linhaFilial(x) {
  return `• *${x.filial}* ${pct(x.fc || 0, x.meta)} (fat.+cart.)` + (x.ideal ? ` · ritmo *${pct(x.cap || 0, x.ideal)}*` : '') + (x.capM1 ? ` · vs mês passado ${delta(x.cap || 0, x.capM1)}` : '') + (x.metaPos ? ` · pos. ${pct(x.posC || x.pos || 0, x.metaPos)}` : '');
}

// RESPOSTAS
export async function respBrasilGerot(B, filiais = null, titulo = null) {
  const G = await lerGerotMes(B, filiais); if (!G) return null;
  const x = filiais && filiais.length === 1 ? G.F[0] : G.T;
  const L = [`📊 *${titulo || (filiais && filiais.length === 1 ? filiais[0] : 'Brasil — 11 filiais')}* · ${rotMes(G.mes)}`, ...linhasVendas(G, x), ...linhasPositivacao(G, x)];
  if (!(filiais && filiais.length === 1) && G.F.length > 1) { L.push('', '*Por filial (melhor ritmo primeiro):*'); for (const f of G.F.slice().sort((a, b) => ((b.cap || 0) / (b.ideal || 1)) - ((a.cap || 0) / (a.ideal || 1)))) L.push(linhaFilial(f)); }
  L.push('', fonteGerot(G));
  return L.join('\n');
}
export async function respPositivacaoGerot(B, filiais = null) {
  const G = await lerGerotMes(B, filiais); if (!G) return null;
  const um = filiais && filiais.length === 1, x = um ? G.F[0] : G.T;
  const L = [`👥 *Positivação — ${um ? filiais[0] : 'Brasil'}* · ${rotMes(G.mes)}`, ...linhasPositivacao(G, x)];
  if (!um && G.F.length > 1) {
    L.push('', '*Por filial (com carteira ÷ meta · vs M-1 mês inteiro):*');
    for (const f of G.F.slice().sort((a, b) => ((b.posC || b.pos || 0) / (b.metaPos || 1)) - ((a.posC || a.pos || 0) / (a.metaPos || 1)))) L.push(`• *${f.filial}*: ${N(f.posC || f.pos || 0)}${f.metaPos ? ` de ${N(f.metaPos)} (${pct(f.posC || f.pos || 0, f.metaPos)})` : ''}${f.posM1 ? ` · M-1 ${N(f.posM1)} (${delta(f.posC || f.pos || 0, f.posM1)})` : ''}`);
  }
  L.push('', fonteGerot(G));
  return L.join('\n');
}
