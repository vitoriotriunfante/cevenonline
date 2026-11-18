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
  // 18/11/2026 (Vitorio: "justificativas de nao venda: dia, mes, acumulado / vendedor - supervisor - gerente - diretoria"): HOJE e NO MES lado a lado, em todas as visoes
  const db = B.env && B.env.DB; if (!db) return null;
  const F = esc.filiais && esc.filiais.length ? esc.filiais : FILIAIS, ini = mesAtual() + '-01', hoje = hojeSP();
  const fr = esc.rcas && esc.rcas.length ? ` AND rca IN (${qs(esc.rcas)})` : '';
  let J0 = [], V0 = [], d0 = null, JH = [];
  try {
    J0 = (await db.prepare(`SELECT filial, rca, MAX(nome) nome, motivo, COUNT(*) n, SUM(CASE WHEN dia = ? THEN 1 ELSE 0 END) h FROM clube_justificativa WHERE dia >= ? AND filial IN (${qs(F)})${fr} GROUP BY filial, rca, motivo`).bind(hoje, ini, ...F, ...(esc.rcas || [])).all()).results || [];
    V0 = (await db.prepare(`SELECT SUM(roteiros) rot, SUM(CASE WHEN dia = ? THEN roteiros ELSE 0 END) rh FROM clube_venda_dia WHERE dia >= ? AND filial IN (${qs(F)})${fr}`).bind(hoje, ini, ...F, ...(esc.rcas || [])).all()).results || [];
    d0 = (await db.prepare('SELECT MIN(dia) a, MAX(dia) b, COUNT(DISTINCT dia) n FROM clube_justificativa WHERE dia >= ?').bind(ini).first()) || null;
    if (esc.rcas && esc.rcas.length === 1) JH = (await db.prepare('SELECT cliente, fantasia, razao, motivo, data_hora, dias_sem_comprar FROM clube_justificativa WHERE dia = ? AND filial = ? AND rca = ? ORDER BY data_hora').bind(hoje, F[0], String(esc.rcas[0])).all()).results || [];
  } catch (e) { return null; }
  if (!J0.length) return `📋 *Motivos de não venda — ${esc.nome}*: nenhuma justificativa no Clube da Venda neste mês.`;
  const per = d0 && d0.a ? `${d0.a.slice(8, 10)}/${d0.a.slice(5, 7)} a ${d0.b.slice(8, 10)}/${d0.b.slice(5, 7)}, ${d0.n} dias com leitura` : '';
  const tot = J0.reduce((a, x) => a + x.n, 0), toth = J0.reduce((a, x) => a + (Number(x.h) || 0), 0);
  const rot = V0.reduce((a, x) => a + (Number(x.rot) || 0), 0), roth = V0.reduce((a, x) => a + (Number(x.rh) || 0), 0);
  const tit = (m) => titulo(String(m || 'sem motivo').toLowerCase());
  const mot = new Map(); for (const x of J0) { const m = tit(x.motivo), o = mot.get(m) || { n: 0, h: 0 }; o.n += x.n; o.h += Number(x.h) || 0; mot.set(m, o); }
  const vend = new Map(); for (const x of J0) { const k = x.filial + '|' + x.rca; const o = vend.get(k) || { nome: `${x.rca} - ${nomeCurto(x.nome)}${F.length > 1 ? ' (' + x.filial + ')' : ''}`, n: 0, h: 0, m: new Map() }; o.n += x.n; o.h += Number(x.h) || 0; const m = tit(x.motivo), y = o.m.get(m) || { n: 0, h: 0 }; y.n += x.n; y.h += Number(x.h) || 0; o.m.set(m, y); vend.set(k, o); }
  const hm = (o) => `hoje *${N(o.h)}* · mês *${N(o.n)}*`;
  const L = [`📋 *Motivos de não venda — ${esc.nome}*`,
    `*Hoje:* ${N(toth)} justificativa(s)${roth ? ` de ${N(roth)} visitas planejadas (${pc(toth, roth)})` : ''}`,
    `*No mês:* ${N(tot)}${rot ? ` de ${N(rot)} visitas planejadas (${pc(tot, rot)})` : ''}${per ? ` · _${per}_` : ''}`];
  if (modo === 'vendedor') {
    L.push('', '*Vendedor × justificativa* _(hoje · mês)_:');
    for (const o of [...vend.values()].sort((a, b) => b.n - a.n).slice(0, 15)) L.push(`• *${o.nome}*: ${hm(o)} — ${[...o.m].sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([m, y]) => `${m} ${y.n}${y.h ? ` (${y.h} hoje)` : ''}`).join(' · ')}`);
  } else if (modo === 'just') {
    L.push('', '*Justificativa × vendedor* _(quem mais usou no mês)_:');
    for (const [m, o] of [...mot].sort((a, b) => b[1].n - a[1].n).slice(0, 8)) { const top = [...vend.values()].map((v) => [v.nome, (v.m.get(m) || { n: 0 }).n]).filter(([, q]) => q).sort((a, b) => b[1] - a[1]).slice(0, 3); L.push(`• *${m}* (${hm(o)}): ${top.map(([nm, q]) => `${nm} ${q}`).join(' · ')}`); }
  } else {
    L.push('', '*Motivos* _(hoje · mês)_:', ...[...mot].sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([m, o]) => `• ${m}: ${N(o.h)} · ${N(o.n)} (${pc(o.n, tot)})`));
    if (F.length > 1) { const pf = new Map(); for (const x of J0) { const o = pf.get(x.filial) || { n: 0, h: 0 }; o.n += x.n; o.h += Number(x.h) || 0; pf.set(x.filial, o); } L.push('', '*Por filial* _(hoje · mês)_:', [...pf].sort((a, b) => b[1].n - a[1].n).map(([f, o]) => `${f} ${N(o.h)}·${N(o.n)}`).join(' · ')); }
    if (!(esc.rcas && esc.rcas.length === 1)) L.push('', '*Quem mais justificou* _(hoje · mês)_:', ...[...vend.values()].sort((a, b) => b.n - a.n).slice(0, 5).map((o) => `• ${o.nome}: ${N(o.h)} · ${N(o.n)} · mais "${[...o.m].sort((a, b) => b[1].n - a[1].n)[0][0]}"`));
  }
  if (JH.length) L.push('', `*Hoje, cliente a cliente (${JH.length}):*`, ...JH.slice(0, 15).map((j) => `• ${String(j.data_hora || '').slice(11, 16)} · ${titulo(String(j.fantasia || j.razao || 'cliente').toLowerCase())} (#${j.cliente}) · ${tit(j.motivo)}`));
  L.push('', esc.rcas && esc.rcas.length === 1 ? '_Clube da Venda._' : '_Clube da Venda · peça "justificativas por vendedor" (vendedor × motivo) ou "justificativas por motivo" (motivo × vendedor)._');
  return L.join(String.fromCharCode(10));
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
  let A = [], P = [], M3 = [];
  try {
    // 18/11/2026: faturado por FILIAL x DIA do GEROT (a soma pelos pedidos deixava de fora notas sem pedido)
    const q = (mes, ate) => db.prepare(`SELECT filial, SUM(json_extract(dados, '$."Faturado líquido (R$)"')) f FROM gerot_filial_dia WHERE mes = ? AND data <= ? AND filial IN (${qs(F)}) GROUP BY filial`).bind(mes, ate, ...F).all();
    A = (await q(m0, hoje)).results || []; P = (await q(m1, lim1)).results || [];
    // Evandro, 18/11/2026: "media dos ultimos 3 meses ate a data" -> M-1, M-2 e M-3 ate o mesmo dia; so entra mes que o GEROT tem
    for (const k of [1, 2, 3]) { const mk = new Date(Date.UTC(y, m - 1 - k, 1)).toISOString().slice(0, 7); const r = (await q(mk, mk + '-' + dia)).results || []; if (r.length) M3.push({ mes: mk, r }); }
  } catch (e) { return null; }
  if (!P.length) return `📊 *Até a data — ${nome}*: ainda não tenho os pedidos de ${m1.slice(5)}/${m1.slice(0, 4)} do GEROT para comparar.`;
  const mapa = new Map(); for (const x of A) mapa.set(x.filial, { a: Number(x.f) || 0, p: 0 }); for (const x of P) { const o = mapa.get(x.filial) || { a: 0, p: 0 }; o.p = Number(x.f) || 0; mapa.set(x.filial, o); }
  const ta = [...mapa.values()].reduce((s, o) => s + o.a, 0), tp = [...mapa.values()].reduce((s, o) => s + o.p, 0);
  const dl = (a, b) => { if (!b) return ''; const d = (a / b - 1) * 100; return `${d >= 0 ? '▲ +' : '▼ '}${d.toFixed(1).replace('.', ',')}%`; };
  const L = [`📊 *Faturado até o dia ${dia} — ${nome}*`, `Este mês: *${R$(ta)}* · mês passado até o dia ${dia}: ${R$(tp)} → *${dl(ta, tp)}*`];
  const med = new Map(); for (const { r } of M3) for (const x of r) med.set(x.filial, (med.get(x.filial) || 0) + (Number(x.f) || 0) / M3.length);
  const tm = [...med.values()].reduce((s2, v) => s2 + v, 0);
  if (M3.length) L.push(`Média de ${M3.length === 3 ? '3 meses' : M3.length + ' mês(es) (' + M3.map((x) => x.mes.slice(5)).join(', ') + ')'} até o dia ${dia}: ${R$(tm)} → *${dl(ta, tm)}*`);
  if (mapa.size > 1) L.push('', '*Por filial:*', ...[...mapa].sort((a, b) => (b[1].a / (b[1].p || 1)) - (a[1].a / (a[1].p || 1))).map(([f, o]) => `• *${f}*: ${R$(o.a)} · mês passado ${R$(o.p)} ${dl(o.a, o.p)}${med.has(f) ? ' · média ' + R$(med.get(f)) + ' ' + dl(o.a, med.get(f)) : ''}`));
  L.push('', '_GEROT · faturado líquido pela data da nota, do dia 1º até o mesmo dia em cada mês._');
  return L.join('\n');
}

// ---------- DEVOLUCAO POR MOTIVO (tela Devolucoes do GEROT) ----------
const LIGA_VERMELHO = /CLIENTE NAO PEDIU/, LIGA_GOLCONTRA = /SEM DINHEIRO|COND.{1,3}PAGTO|EMITIU COD|PEDIDO DUPLICADO|RECUSOU MERC|PRECO DIFERENTE/;
export async function respDevolucaoMotivo(B, filiais, nome) {
  const db = B.env && B.env.DB; if (!db) return null;
  const uma = filiais && filiais.length === 1 ? filiais[0] : '';
  let R = [], em = null;
  try { R = (await db.prepare('SELECT motivo, valor, notas, clientes, em FROM gerot_devolucao_motivo WHERE mes = ? AND filial = ? ORDER BY valor DESC').bind(mesAtual(), uma).all()).results || []; em = R[0] && R[0].em; } catch (e) { return null; }
  if (!R.length) return null;
  const tot = R.reduce((a, x) => a + (Number(x.valor) || 0), 0), notas = R.reduce((a, x) => a + (Number(x.notas) || 0), 0);
  const L = [`↩️ *Devolução por motivo — ${nome}* · ${mesAtual().slice(5)}/${mesAtual().slice(0, 4)}`, uma ? `Total *${R$(tot)}*` : `Total *${R$(tot)}* em *${N(notas)}* notas`, '_🟥 = cartão vermelho na Liga · ⚽ = gol contra na Liga_', ''];
  for (const x of R.slice(0, 14)) L.push(`${LIGA_VERMELHO.test(x.motivo) ? '🟥' : LIGA_GOLCONTRA.test(x.motivo) ? '⚽' : '•'} ${titulo(String(x.motivo).toLowerCase())}: *${R$(x.valor)}* (${pc(x.valor, tot)})${uma ? '' : ` · ${N(x.notas)} nota(s)`} · ${N(x.clientes)} cliente(s)`   /* 18/11: notas por filial nao bate com o total do GEROT (valor e clientes batem); fica fora ate corrigir a leitura */);
  if (R.length > 14) L.push(`… e mais ${R.length - 14} motivo(s)`);
  if (!uma) { try { const { results: F } = await db.prepare("SELECT filial, valor FROM gerot_devolucao_motivo WHERE mes = ? AND motivo = 'CLIENTE NAO PEDIU' AND filial <> '' ORDER BY valor DESC").bind(mesAtual()).all(); if (F && F.length) L.push('', '*"Cliente não pediu" por filial:* ' + F.map((x) => `${x.filial} ${R$(x.valor)}`).join(' · ')); } catch (e) { /* sem filial */ } }
  L.push('', `_GEROT · tela Devoluções, por motivo${em ? ' · lido ' + new Date(em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}. Peça "devolução por motivo TPH" para uma filial._`);
  return L.join(String.fromCharCode(10));
}

// ---------- GAP POR CLIENTE x MEDIA DOS 3 MESES (Evandro Servat, 18/11/2026) ----------
// Media mensal do faturado liquido do cliente nos 3 meses fechados (GEROT, gerot_cliente_mes) x o que ele ja faturou neste mes.
// "Falta" = quanto falta para o cliente voltar a media (nao e projecao). So entra mes que o GEROT tem; a resposta diz quais.
export async function respGapClientes(B, e) {
  const db = B.env && B.env.DB; if (!db) return null;
  const m0 = mesAtual(), [y, m] = m0.split('-').map(Number), M = [1, 2, 3].map((k) => new Date(Date.UTC(y, m - 1 - k, 1)).toISOString().slice(0, 7));
  const F = e.filiais && e.filiais.length ? e.filiais : FILIAIS, R = e.rcas && e.rcas.length ? e.rcas.map(String) : null;
  let tem = [];
  try { tem = ((await db.prepare(`SELECT DISTINCT mes FROM gerot_cliente_mes WHERE mes IN (${qs(M)}) AND filial = ?`).bind(...M, F[0]).all()).results || []).map((x) => x.mes).sort(); } catch (e2) { return null; }
  if (!tem.length) return `📉 *Gap por cliente — ${e.nome}*: ainda não tenho os meses ${M.map((x) => x.slice(5)).join(', ')} por cliente do GEROT.`;
  const FAT = `json_extract(dados, '$."Faturado líquido (R$)"')`;
  const filtro = `mes IN (${qs([m0, ...tem])}) AND filial IN (${qs(F)})${R ? ` AND rca IN (${qs(R)})` : ''}`, binds = [m0, ...tem, ...F, ...(R || [])];
  const G = `SELECT filial, cliente, MAX(nome) nome, MAX(CASE WHEN mes = '${m0}' THEN rca END) rca, MAX(rca) rca2, SUM(CASE WHEN mes = '${m0}' THEN ${FAT} ELSE 0 END) atual, SUM(CASE WHEN mes <> '${m0}' THEN ${FAT} ELSE 0 END) / ${tem.length}.0 media FROM gerot_cliente_mes WHERE ${filtro} GROUP BY filial, cliente HAVING media > 0 AND atual < media`;
  let T = null, top = [], porF = [];
  try {
    [T, top, porF] = await Promise.all([
      db.prepare(`SELECT COUNT(*) n, SUM(media - atual) gap, SUM(CASE WHEN atual <= 0 THEN 1 ELSE 0 END) zer FROM (${G})`).bind(...binds).first(),
      db.prepare(`${G} ORDER BY (media - atual) DESC LIMIT 15`).bind(...binds).all().then((x) => x.results || []),
      F.length > 1 ? db.prepare(`SELECT filial, COUNT(*) n, SUM(media - atual) gap FROM (${G}) GROUP BY filial ORDER BY gap DESC`).bind(...binds).all().then((x) => x.results || []) : Promise.resolve([]),
    ]);
  } catch (e2) { return null; }
  if (!T || !T.n) return `📉 *Gap por cliente — ${e.nome}*: nenhum cliente abaixo da média mensal de ${tem.map((x) => x.slice(5)).join(', ')}.`;
  const dia = hojeSP().slice(8, 10), mm = tem.map((x) => x.slice(5) + '/' + x.slice(2, 4)).join(', ');
  const L = [`📉 *Clientes abaixo da média de ${tem.length === 3 ? '3 meses' : tem.length + ' mês(es)'} — ${e.nome}*`,
    `*${N(T.n)}* clientes faturaram menos este mês (até o dia ${dia}) do que a média mensal de ${mm} · faltam *${R$(T.gap)}* para voltarem à média`,
    `Desses, *${N(T.zer)}* ainda não faturaram nada no mês.`];
  if (porF.length) L.push('', '*Por filial (clientes · falta):*', ...porF.map((x) => `• *${x.filial}*: ${N(x.n)} · ${R$(x.gap)}`));
  L.push('', `*Maiores gaps:*`, '_Cliente · vendedor · este mês · média · falta_');
  // vendedor = 'codigo - Nome' (gerot_vendedor_mes do mes); o GEROT guarda meses antigos como 'H|NOME' -> mostra o nome
  const NV = new Map(); try { for (const r of (await db.prepare(`SELECT filial, rca, MAX(vendedor) v FROM gerot_vendedor_mes WHERE mes = ? AND filial IN (${qs(F)}) GROUP BY filial, rca`).bind(m0, ...F).all()).results || []) NV.set(r.filial + '|' + r.rca, r.v); } catch (e2) { /* so o codigo */ }
  const vend = (x) => { const r = String(x.rca || x.rca2 || ''); if (!r) return '—'; if (r.startsWith('H|')) return nomeCurto(r.slice(2)); const n = NV.get(x.filial + '|' + r); return n ? r + ' - ' + nomeCurto(n) : r; };
  for (const x of top) L.push(`• ${titulo(String(x.nome || 'cliente ' + x.cliente).toLowerCase())} (#${x.cliente}) · ${F.length > 1 ? x.filial + ' ' : ''}${vend(x)} · ${R$(x.atual)} · ${R$(x.media)} · *${R$(x.media - x.atual)}*`);
  L.push('', `_GEROT · faturado líquido por cliente; média dos meses fechados ${mm}. "Falta" é quanto falta para voltar à média, não é projeção._`);
  return L.join(String.fromCharCode(10));
}

// ---------- CORTES DA GESTAO (comercial x logistico — o "motivo" do corte no GEROT) ----------
// Vitorio, 18/11/2026: "cortes tambem tem por motivo igual o CEVEN". A tela Cortes do GEROT abre o corte em COMERCIAL e LOGISTICO (nao ha outro motivo nela).
// Brasil = por filial; filial = por supervisor; supervisor/grupo = por vendedor. Mesmo numero da tela (gerot_*_mes).
export async function respCortesGestao(B, e) {
  const db = B.env && B.env.DB; if (!db) return null;
  const mes = mesAtual(), F = e.filiais && e.filiais.length ? e.filiais : FILIAIS;
  const C = `SUM(json_extract(dados, '$."Corte comercial (R$)"')) com, SUM(json_extract(dados, '$."Corte logístico (R$)"')) log, SUM(json_extract(dados, '$."Faturado bruto (R$)"')) bru`;
  let R = [], por = '';
  try {
    if (e.rcas && e.rcas.length) { por = 'vendedor'; R = (await db.prepare(`SELECT rca || ' - ' || vendedor k, ${C} FROM gerot_vendedor_mes WHERE mes = ? AND filial = ? AND rca IN (${qs(e.rcas)}) GROUP BY rca`).bind(mes, F[0], ...e.rcas.map(String)).all()).results || []; }
    else if (F.length === 1) { por = 'supervisor'; R = (await db.prepare(`SELECT cod_sup || ' - ' || supervisor k, ${C} FROM gerot_supervisor_mes WHERE mes = ? AND filial = ? GROUP BY cod_sup`).bind(mes, F[0]).all()).results || []; }
    else { por = 'filial'; R = (await db.prepare(`SELECT filial k, ${C} FROM gerot_filial_mes WHERE mes = ? AND filial IN (${qs(F)}) GROUP BY filial`).bind(mes, ...F).all()).results || []; }
  } catch (e2) { return null; }
  R = R.map((x) => ({ ...x, com: Number(x.com) || 0, log: Number(x.log) || 0, bru: Number(x.bru) || 0 })).filter((x) => x.com + x.log > 0).sort((a, b) => (b.com + b.log) - (a.com + a.log));
  const tc = R.reduce((a, x) => a + x.com, 0), tl = R.reduce((a, x) => a + x.log, 0), tb = R.reduce((a, x) => a + x.bru, 0);
  if (!R.length) return `✂️ *Cortes do mês — ${e.nome}*: nenhum corte no GEROT em ${mes.slice(5)}/${mes.slice(0, 4)}. 👏`;
  const nomeK = (k) => por === 'filial' ? `*${k}*` : String(k).replace(/^(\d+) - (.*)$/, (m, c, n) => `${c} - ${nomeCurto(n)}`);
  const L = [`✂️ *Cortes do mês — ${e.nome}*`, `Total *${R$(tc + tl)}*${tb ? ` (${pc(tc + tl, tb)} do faturado bruto)` : ''}`, `• Comercial: *${R$(tc)}* (${pc(tc, tc + tl)})`, `• Logístico: *${R$(tl)}* (${pc(tl, tc + tl)})`,
    '_Comercial = decisão de venda (preço, crédito, regra) · logístico = faltou produto no estoque._', '', `*Por ${por} (total · comercial · logístico):*`];
  for (const x of R.slice(0, 15)) L.push(`• ${nomeK(x.k)}: ${R$(x.com + x.log)} · ${R$(x.com)} · ${R$(x.log)}`);
  if (R.length > 15) L.push(`… e mais ${R.length - 15}`);
  L.push('', `_GEROT · tela Cortes (comercial × logístico é o motivo que o GEROT dá). Peça "cortes por indústria" ou "meus cortes" para o pedido._`);
  return L.join(String.fromCharCode(10));
}

// ---------- DEVOLUCAO POR MOTIVO POR VENDEDOR (Motivo > Filial > Supervisor > Vendedor no GEROT; gerot_devolucao_motivo_vend) ----------
// esc: { filiais:[uma], rcas?:[...], nome }. Vendedor = so ele; supervisor/grupo = a equipe aberta por vendedor; filial = os vendedores com mais devolucao.
export async function respDevolucaoMotivoVend(B, esc) {
  const db = B.env && B.env.DB; if (!db) return null;
  const fil = esc.filiais && esc.filiais[0]; if (!fil) return null;
  const R = esc.rcas && esc.rcas.length ? esc.rcas.map(String) : null;
  let X = [], em = null;
  try { X = (await db.prepare(`SELECT motivo, rca, vendedor, valor, clientes, em FROM gerot_devolucao_motivo_vend WHERE mes = ? AND filial = ?${R ? ` AND rca IN (${qs(R)})` : ''}`).bind(mesAtual(), fil, ...(R || [])).all()).results || []; } catch (e) { return null; }
  if (!X.length) return null;
  em = X.reduce((a, x) => (x.em > a ? x.em : a), '');
  const tot = X.reduce((a, x) => a + (Number(x.valor) || 0), 0), um = R && R.length === 1;
  const mot = new Map(); for (const x of X) mot.set(x.motivo, (mot.get(x.motivo) || 0) + (Number(x.valor) || 0));
  const marca = (m) => (LIGA_VERMELHO.test(m) ? '🟥' : LIGA_GOLCONTRA.test(m) ? '⚽' : '•');
  const L = [`↩️ *Devolução por motivo — ${esc.nome}* · ${mesAtual().slice(5)}/${mesAtual().slice(0, 4)}`, `Total *${R$(tot)}*`, '_🟥 = cartão vermelho na Liga · ⚽ = gol contra na Liga_', ''];
  for (const [m, v] of [...mot].sort((a, b) => b[1] - a[1]).slice(0, 10)) L.push(`${marca(m)} ${titulo(String(m).toLowerCase())}: *${R$(v)}* (${pc(v, tot)})`);
  if (!um) {
    const pv = new Map(); for (const x of X) { const o = pv.get(x.rca) || { nome: `${x.rca} - ${nomeCurto(x.vendedor)}`, v: 0, m: new Map() }; o.v += Number(x.valor) || 0; o.m.set(x.motivo, (o.m.get(x.motivo) || 0) + (Number(x.valor) || 0)); pv.set(x.rca, o); }
    L.push('', '*Por vendedor (maior motivo):*');
    for (const o of [...pv.values()].sort((a, b) => b.v - a.v).slice(0, 12)) { const [m1, v1] = [...o.m].sort((a, b) => b[1] - a[1])[0]; L.push(`• *${o.nome}*: ${R$(o.v)} · ${marca(m1)} ${titulo(String(m1).toLowerCase())} ${R$(v1)}`); }
  }
  L.push('', `_GEROT · tela Devoluções (motivo › filial › supervisor › vendedor)${em ? ' · lido ' + new Date(em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}._`);
  return L.join(String.fromCharCode(10));
}
