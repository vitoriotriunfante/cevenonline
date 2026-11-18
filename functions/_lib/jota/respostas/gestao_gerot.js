// ==========================================================================================
// FICHA DO ARQUIVO: functions/_lib/jota/respostas/gestao_gerot.js
// O QUE FAZ: respostas de gestao (diretoria, gerente, supervisor) SO com GEROT e Clube da Venda — pedidas em 18/11/2026 por Vitorio, Evandro Servat e
//   Paulo Micheleto: devolucao com o numero do GEROT (todas as contas, igual a tela), margem das filiais (so diretoria e gerente), carteira por status e motivo,
//   justificativas de nao venda pelo Clube (com vendedor x justificativa e justificativa x vendedor), visitas do dia e do mes pelo Clube (filial / supervisor /
//   vendedor) e faturado ate a data contra o mes passado ate a mesma data. Nada estimado; sem dado = diz que nao tem.
// ==========================================================================================
import { N, R$, hojeSP, titulo, FILIAIS } from '../base.js';

const pc = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '—');
const nomeCurto = (s) => titulo(String(s || '').replace(/^(CLT|PJ)\s*-?\s*/i, '').toLowerCase()).split(' ').filter((w) => !/^(De|Da|Do|Dos|Das|E)$/.test(w)).slice(0, 2).join(' ');
const J = (s) => { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };
const mesAtual = () => hojeSP().slice(0, 7);
const qs = (a) => a.map(() => '?').join(',');
const fontesG = async (db) => { try { const st = await db.prepare('SELECT posicao FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mesAtual()).first(); return st && st.posicao ? st.posicao.replace(/^Atual\s*·\s*/, 'posição ') : ''; } catch (e) { return ''; } };

// ---------- DEVOLUCAO (GEROT, todas as contas: igual a tela do GEROT) ----------
// escopo: { filiais, supCod, rca, nome }. Brasil = por filial; filial = por supervisor; supervisor = por vendedor; rca sem filial = soma das filiais (ex.: codigo 2)
export async function respDevolucaoGerot(B, esc) {
  const db = B.env && B.env.DB; if (!db) return null;
  const mes = mesAtual(), K = '"Devolução (R$)"', F = esc.filiais && esc.filiais.length ? esc.filiais : FILIAIS;
  let R = [];
  try {
    if (esc.rca) R = (await db.prepare(`SELECT filial k, vendedor nome, SUM(json_extract(dados, '$.${K}')) d FROM gerot_vendedor_mes WHERE mes = ? AND rca = ? AND filial IN (${qs(F)}) GROUP BY filial`).bind(mes, String(esc.rca), ...F).all()).results || [];
    else if (esc.supCod) R = (await db.prepare(`SELECT rca || ' - ' || vendedor k, SUM(json_extract(dados, '$.${K}')) d FROM gerot_vendedor_mes WHERE mes = ? AND filial = ? AND cod_sup = ? GROUP BY rca`).bind(mes, F[0], String(esc.supCod)).all()).results || [];
    else if (F.length === 1) R = (await db.prepare(`SELECT cod_sup || ' - ' || supervisor k, SUM(json_extract(dados, '$.${K}')) d FROM gerot_supervisor_mes WHERE mes = ? AND filial = ? GROUP BY cod_sup`).bind(mes, F[0]).all()).results || [];
    else R = (await db.prepare(`SELECT filial k, SUM(json_extract(dados, '$.${K}')) d FROM gerot_filial_mes WHERE mes = ? AND filial IN (${qs(F)}) GROUP BY filial`).bind(mes, ...F).all()).results || [];
  } catch (e) { return null; }
  R = R.filter((x) => Number(x.d) > 0).sort((a, b) => b.d - a.d);
  const tot = R.reduce((a, x) => a + Number(x.d), 0), pos = await fontesG(db);
  if (!R.length) return `↩️ *Devoluções no mês — ${esc.nome}*: nenhuma devolução no GEROT em ${mes.slice(5)}/${mes.slice(0, 4)}.`;
  const rot = esc.rca ? 'Por filial' : esc.supCod ? 'Por vendedor' : F.length === 1 ? 'Por supervisor' : 'Por filial';
  const lim = (s) => (F.length === 1 || esc.rca ? titulo(String(s).toLowerCase()).replace(/^(\d+) - /, '$1 - ') : s);
  return [`↩️ *Devoluções no mês — ${esc.nome}*: *${R$(tot)}*`, `*${rot}:*`, ...R.slice(0, 15).map((x) => `• ${lim(x.k)}: ${R$(x.d)} (${pc(x.d, tot)})`), ...(R.length > 15 ? [`… e mais ${R.length - 15}`] : []),
    '', `_GEROT${pos ? ' (' + pos + ')' : ''} · todas as contas, igual à tela de Devoluções. Por motivo: peça *devolução por motivo*._`].join('\n');
}

// ---------- MARGEM (so diretoria e gerente) ----------
export async function respMargemGerot(B, filiais, nome) {
  const db = B.env && B.env.DB; if (!db) return null;
  const F = filiais && filiais.length ? filiais : FILIAIS;
  let R = []; try { R = (await db.prepare(`SELECT filial, dados FROM gerot_filial_mes WHERE mes = ? AND filial IN (${qs(F)})`).bind(mesAtual(), ...F).all()).results || []; } catch (e) { return null; }
  const L = R.map((r) => { const d = J(r.dados); return { f: r.filial, m: Number(d['Margem de contribuição (R$)']) || 0, fat: Number(d['Faturado líquido (R$)']) || 0 }; }).filter((x) => x.fat || x.m);
  if (!L.length) return `💹 *Margem — ${nome}*: sem a margem no GEROT agora.`;
  const tm = L.reduce((a, x) => a + x.m, 0), tf = L.reduce((a, x) => a + x.fat, 0), pos = await fontesG(db);
  return [`💹 *Margem de contribuição — ${nome}* · ${mesAtual().slice(5)}/${mesAtual().slice(0, 4)}`, `Total *${R$(tm)}* · *${pc(tm, tf)}* do faturado líquido (${R$(tf)})`,
    ...(L.length > 1 ? ['', '*Por filial (maior % primeiro):*', ...L.sort((a, b) => (b.m / (b.fat || 1)) - (a.m / (a.fat || 1))).map((x) => `• *${x.f}*: ${R$(x.m)} · *${pc(x.m, x.fat)}*`)] : []),
    '', `_GEROT${pos ? ' (' + pos + ')' : ''} · margem de contribuição sobre o faturado líquido. Visível só para diretoria e gerentes._`].join('\n');
}

// ---------- CARTEIRA POR STATUS E MOTIVO (Carteira Total) ----------
export async function respCarteiraStatus(B, filiais, rcas, nome) {
  const db = B.env && B.env.DB; if (!db) return null;
  const F = filiais && filiais.length ? filiais : FILIAIS;
  let R = [], V = [];
  try {
    R = (await db.prepare(`SELECT filial, situacao, COALESCE(NULLIF(motivo, ''), '') motivo, COUNT(*) n FROM gerot_carteira WHERE filial IN (${qs(F)})${rcas && rcas.length ? ` AND rca IN (${qs(rcas)})` : ''} GROUP BY filial, situacao, motivo`).bind(...F, ...(rcas || [])).all()).results || [];
    V = (await db.prepare(`SELECT filial, dados FROM gerot_filial_mes WHERE mes = ? AND filial IN (${qs(F)})`).bind(mesAtual(), ...F).all()).results || [];
  } catch (e) { return null; }
  if (!R.length) return `💼 *Carteira — ${nome}*: nenhum pedido em aberto na Carteira Total do GEROT.`;
  const porSit = new Map(); for (const r of R) { const s = titulo(String(r.situacao || 'Sem situação').toLowerCase()); const x = porSit.get(s) || { n: 0, mot: new Map(), fil: new Map() }; x.n += r.n; if (r.motivo) x.mot.set(titulo(r.motivo.toLowerCase()), (x.mot.get(titulo(r.motivo.toLowerCase())) || 0) + r.n); x.fil.set(r.filial, (x.fil.get(r.filial) || 0) + r.n); porSit.set(s, x); }
  const tot = R.reduce((a, r) => a + r.n, 0), val = V.reduce((a, r) => a + (Number(J(r.dados)['Carteira pendente (R$)']) || 0), 0);
  const L = [`💼 *Carteira em aberto por status — ${nome}*`, `*${N(tot)}* pedidos${!(rcas && rcas.length) && val ? ` · carteira pendente ${R$(val)} (GEROT)` : ''}`, ''];
  for (const [s, x] of [...porSit].sort((a, b) => b[1].n - a[1].n)) {
    L.push(`${/BLOQ/i.test(s) ? '🚫' : /LIBER/i.test(s) ? '🟢' : '⏳'} *${s}*: ${N(x.n)} (${pc(x.n, tot)})`);
    for (const [m, n] of [...x.mot].sort((a, b) => b[1] - a[1]).slice(0, 5)) L.push(`   • ${m}: ${N(n)}`);
    if (F.length > 1 && /BLOQ/i.test(s)) L.push(`   _por filial: ${[...x.fil].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(' · ')}_`);
  }
  L.push('', '_Carteira Total do GEROT (pedidos em aberto, com status e motivo do bloqueio). Valor por pedido: peça o número do pedido._');
  return L.join('\n');
}

// ---------- JUSTIFICATIVAS DE NAO VENDA (Clube da Venda) ----------
// esc: { filiais, rcas, nome, porVendedor }. modo: 'motivo' (padrao) | 'vendedor' (vendedor x justificativa) | 'just' (justificativa x vendedor)
export async function respJustificativas(B, esc, modo = 'motivo') {
  const db = B.env && B.env.DB; if (!db) return null;
  const F = esc.filiais && esc.filiais.length ? esc.filiais : FILIAIS, ini = mesAtual() + '-01';
  const fr = esc.rcas && esc.rcas.length ? ` AND rca IN (${qs(esc.rcas)})` : '';
  let J0 = [], V0 = [], d0 = null;
  try {
    J0 = (await db.prepare(`SELECT filial, rca, nome, motivo, COUNT(*) n FROM clube_justificativa WHERE dia >= ? AND filial IN (${qs(F)})${fr} GROUP BY filial, rca, motivo`).bind(ini, ...F, ...(esc.rcas || [])).all()).results || [];
    V0 = (await db.prepare(`SELECT filial, rca, SUM(roteiros) rot FROM clube_venda_dia WHERE dia >= ? AND filial IN (${qs(F)})${fr} GROUP BY filial, rca`).bind(ini, ...F, ...(esc.rcas || [])).all()).results || [];
    d0 = (await db.prepare('SELECT MIN(dia) a, MAX(dia) b FROM clube_justificativa WHERE dia >= ?').bind(ini).first()) || null;
  } catch (e) { return null; }
  if (!J0.length) return `📋 *Motivos de não venda — ${esc.nome}*: nenhuma justificativa no Clube da Venda neste mês.`;
  const per = d0 && d0.a ? `${d0.a.slice(8, 10)}/${d0.a.slice(5, 7)} a ${d0.b.slice(8, 10)}/${d0.b.slice(5, 7)}` : '';
  const tot = J0.reduce((a, x) => a + x.n, 0), rot = V0.reduce((a, x) => a + (Number(x.rot) || 0), 0);
  const mot = new Map(); for (const x of J0) { const m = titulo(String(x.motivo || 'sem motivo').toLowerCase()); mot.set(m, (mot.get(m) || 0) + x.n); }
  const vend = new Map(); for (const x of J0) { const k = x.filial + '|' + x.rca; const o = vend.get(k) || { nome: `${x.rca} - ${nomeCurto(x.nome)}${F.length > 1 ? ' (' + x.filial + ')' : ''}`, n: 0, m: new Map() }; o.n += x.n; const m = titulo(String(x.motivo || 'sem motivo').toLowerCase()); o.m.set(m, (o.m.get(m) || 0) + x.n); vend.set(k, o); }
  const L = [`📋 *Motivos de não venda — ${esc.nome}* · Clube da Venda${per ? ' (' + per + ')' : ''}`, `Justificativas: *${N(tot)}*${rot ? ` · visitas planejadas na rota: ${N(rot)} (${pc(tot, rot)})` : ''}`];
  if (modo === 'vendedor') {
    L.push('', '*Vendedor × justificativa (quem mais justificou):*');
    for (const o of [...vend.values()].sort((a, b) => b.n - a.n).slice(0, 15)) L.push(`• *${o.nome}*: ${N(o.n)} — ${[...o.m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, n]) => `${m} ${n}`).join(' · ')}`);
  } else if (modo === 'just') {
    L.push('', '*Justificativa × vendedor (quem mais usou cada motivo):*');
    for (const [m, n] of [...mot].sort((a, b) => b[1] - a[1]).slice(0, 8)) { const top = [...vend.values()].map((o) => [o.nome, o.m.get(m) || 0]).filter(([, q]) => q).sort((a, b) => b[1] - a[1]).slice(0, 3); L.push(`• *${m}* (${N(n)}): ${top.map(([nm, q]) => `${nm} ${q}`).join(' · ')}`); }
  } else {
    L.push('', '*Motivos:*', ...[...mot].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([m, n]) => `• ${m}: ${N(n)} (${pc(n, tot)})`));
    if (F.length > 1) { const pf = new Map(); for (const x of J0) pf.set(x.filial, (pf.get(x.filial) || 0) + x.n); L.push('', '*Por filial:*', [...pf].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${N(n)}`).join(' · ')); }
    L.push('', '*Quem mais justificou:*', ...[...vend.values()].sort((a, b) => b.n - a.n).slice(0, 5).map((o) => `• ${o.nome}: ${N(o.n)} · mais "${[...o.m].sort((a, b) => b[1] - a[1])[0][0]}"`));
  }
  L.push('', '_Peça "justificativas por vendedor" (vendedor × motivo) ou "justificativas por motivo" (motivo × vendedor)._');
  return L.join('\n');
}

// ---------- VISITAS (Clube da Venda): hoje e no mes, por filial / supervisor / vendedor ----------
export async function respVisitasClube(B, esc, por) {
  const db = B.env && B.env.DB; if (!db) return null;
  const F = esc.filiais && esc.filiais.length ? esc.filiais : FILIAIS, hoje = hojeSP(), ini = mesAtual() + '-01';
  const fr = esc.rcas && esc.rcas.length ? ` AND rca IN (${qs(esc.rcas)})` : '';
  let H = [], M = [], d0 = null;
  try {
    H = (await db.prepare(`SELECT filial, rca, nome, sup_cod, roteiros r, visitas_rota v, ped_rota p, lido_em FROM clube_venda_dia WHERE dia = ? AND filial IN (${qs(F)})${fr}`).bind(hoje, ...F, ...(esc.rcas || [])).all()).results || [];
    M = (await db.prepare(`SELECT filial, rca, MAX(nome) nome, MAX(sup_cod) sup_cod, SUM(roteiros) r, SUM(visitas_rota) v, SUM(ped_rota) p FROM clube_venda_dia WHERE dia >= ? AND filial IN (${qs(F)})${fr} GROUP BY filial, rca`).bind(ini, ...F, ...(esc.rcas || [])).all()).results || [];
    d0 = await db.prepare('SELECT MIN(dia) a FROM clube_venda_dia WHERE dia >= ?').bind(ini).first();
  } catch (e) { return null; }
  if (!M.length) return `🚶 *Visitas — ${esc.nome}*: sem leitura do Clube da Venda neste mês.`;
  const soma = (A) => A.reduce((a, x) => ({ r: a.r + (Number(x.r) || 0), v: a.v + (Number(x.v) || 0), p: a.p + (Number(x.p) || 0) }), { r: 0, v: 0, p: 0 });
  const th = soma(H), tm = soma(M), lido = H.map((x) => x.lido_em).filter(Boolean).sort().pop();
  const chave = (x) => (por === 'filial' ? x.filial : por === 'supervisor' ? x.filial + '|' + (x.sup_cod || '?') : x.filial + '|' + x.rca);
  const grp = new Map(); for (const x of M) { const k = chave(x); const o = grp.get(k) || { nome: por === 'filial' ? x.filial : por === 'supervisor' ? `sup. ${x.sup_cod || '?'}${F.length > 1 ? ' (' + x.filial + ')' : ''}` : `${x.rca} - ${nomeCurto(x.nome)}${F.length > 1 ? ' (' + x.filial + ')' : ''}`, m: { r: 0, v: 0, p: 0 }, h: { r: 0, v: 0, p: 0 } }; o.m = soma([o.m, x]); grp.set(k, o); }
  for (const x of H) { const o = grp.get(chave(x)); if (o) o.h = soma([o.h, x]); }
  // nome do supervisor (Gestao de Equipe via escopo, se veio)
  if (por === 'supervisor' && esc.supNomes) for (const [k, o] of grp) { const nm = esc.supNomes.get(k); if (nm) o.nome = nm; }
  const L = [`🚶 *Plano de visitas — ${esc.nome}*`, `*Hoje:* ${N(th.v)} de ${N(th.r)} visitas (${pc(th.v, th.r)}) · com pedido na rota ${N(th.p)} (eficácia ${pc(th.p, th.r)})`,
    `*Mês${d0 && d0.a ? ' (desde ' + d0.a.slice(8, 10) + '/' + d0.a.slice(5, 7) + ')' : ''}:* ${N(tm.v)} de ${N(tm.r)} visitas (${pc(tm.v, tm.r)}) · com pedido ${N(tm.p)} (${pc(tm.p, tm.r)})`, '',
    `*Por ${por} — menor aderência no mês primeiro (mês · hoje):*`];
  for (const o of [...grp.values()].filter((o) => o.m.r > 0).sort((a, b) => (a.m.v / a.m.r) - (b.m.v / b.m.r)).slice(0, 15)) L.push(`• ${o.nome}: ${pc(o.m.v, o.m.r)} (${N(o.m.v)}/${N(o.m.r)}) · hoje ${N(o.h.v)}/${N(o.h.r)}`);
  L.push('', `_Clube da Venda${lido ? ' · ' + new Date(lido).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : ''} · aderência = visitas feitas ÷ planejadas na rota. Peça por filial, por supervisor ou por vendedor._`);
  return L.join('\n');
}

// ---------- FATURADO ATE A DATA x MES PASSADO ATE A MESMA DATA (GEROT, pela data do faturamento) ----------
export async function respAteData(B, filiais, nome) {
  const db = B.env && B.env.DB; if (!db) return null;
  const F = filiais && filiais.length ? filiais : FILIAIS, hoje = hojeSP(), dia = hoje.slice(8, 10);
  const m0 = mesAtual(), [y, m] = m0.split('-').map(Number), m1 = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const lim1 = `${m1}-${dia}`;
  let A = [], P = [];
  try {
    const q = (mes, ate) => db.prepare(`SELECT filial, SUM(json_extract(dados, '$."Faturado líquido (R$)"')) f FROM gerot_pedido WHERE mes = ? AND data <= ? AND filial IN (${qs(F)}) GROUP BY filial`).bind(mes, ate, ...F).all();
    A = (await q(m0, hoje)).results || []; P = (await q(m1, lim1)).results || [];
  } catch (e) { return null; }
  if (!P.length) return `📊 *Até a data — ${nome}*: ainda não tenho os pedidos de ${m1.slice(5)}/${m1.slice(0, 4)} do GEROT para comparar.`;
  const mapa = new Map(); for (const x of A) mapa.set(x.filial, { a: Number(x.f) || 0, p: 0 }); for (const x of P) { const o = mapa.get(x.filial) || { a: 0, p: 0 }; o.p = Number(x.f) || 0; mapa.set(x.filial, o); }
  const ta = [...mapa.values()].reduce((s, o) => s + o.a, 0), tp = [...mapa.values()].reduce((s, o) => s + o.p, 0);
  const dl = (a, b) => { if (!b) return ''; const d = (a / b - 1) * 100; return `${d >= 0 ? '▲ +' : '▼ '}${d.toFixed(1).replace('.', ',')}%`; };
  const L = [`📊 *Faturado até o dia ${dia} — ${nome}*`, `Este mês: *${R$(ta)}* · mês passado até o dia ${dia}: ${R$(tp)} → *${dl(ta, tp)}*`];
  if (mapa.size > 1) L.push('', '*Por filial:*', ...[...mapa].sort((a, b) => (b[1].a / (b[1].p || 1)) - (a[1].a / (a[1].p || 1))).map(([f, o]) => `• *${f}*: ${R$(o.a)} · mês passado ${R$(o.p)} · ${dl(o.a, o.p)}`));
  L.push('', '_GEROT · faturado líquido pela data da nota, do dia 1º até o mesmo dia nos dois meses._');
  return L.join('\n');
}
