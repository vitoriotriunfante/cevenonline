// ==========================================================================================
// FICHA DO ARQUIVO: functions/_lib/jota/respostas/bomdia_gestao.js
// O QUE FAZ: o "BOM DIA" CASCATEADO da gestao — o mesmo comeco de dia do vendedor, consolidado (Vitorio, 18/11/2026: "a resposta para a Tamara veio top...
//   pq nao temos o mesmo bom dia cascateado? supervisor / gerente / diretoria... pensando em consolidados... o que um CEO diria?").
//   Supervisor = equipe (prioridades por vendedor) · gerente = filial (por supervisor) · diretoria = Brasil (por filial).
//   Ontem (Clube) · mes (GEROT: fat + carteira, ritmo, precisa/dia, positivacao x M-1) · hoje (rota do Clube, rota curta) · 3 prioridades · alertas · (sup) 5 clientes.
//   So GEROT e Clube. Sem dado = nao mostra a linha (nunca estima).
// ==========================================================================================
import { N, R$, hojeSP, titulo, FILIAIS } from '../base.js';

const J = (s) => { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };
const pc = (a, b) => (b ? Math.round(a / b * 100) + '%' : '—');
const qs = (a) => a.map(() => '?').join(',');
const nm2 = (s) => titulo(String(s || '').replace(/^(CLT|PJ)\s*-?\s*/i, '').toLowerCase()).split(' ').filter((w) => !/^(De|Da|Do|Dos|Das|E)$/.test(w)).slice(0, 2).join(' ');
const DSEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const ler = (d) => { const n = (k) => Number(d[k]) || 0; return { meta: n('Meta (R$)'), fat: n('Faturado líquido (R$)'), cart: n('Carteira pendente (R$)'), cap: d['Captação (R$)'] == null ? null : n('Captação (R$)'), ideal: n('Meta Ideal captação (R$)'), nec: d['Necessidade dia captação (R$)'] == null ? null : n('Necessidade dia captação (R$)'), capM1: n('Captação M-1 (R$)'), pos: n('Positivação (filial + CNPJ)'), posC: n('Positivação + Carteira'), metaPos: n('Meta de positivação'), posM1: n('Positivação M-1') }; };
const soma = (A) => A.reduce((a, x) => { for (const k of Object.keys(x)) if (typeof x[k] === 'number') a[k] = (a[k] || 0) + x[k]; return a; }, {});

// nivel: 'supervisor' | 'gerente' | 'diretoria'. esc: { nome, filiais, supCod, rcas, primeiro }
export async function respBomDiaGestao(B, nivel, esc) {
  const db = B.env && B.env.DB; if (!db) return null;
  const hoje = hojeSP(), mes = hoje.slice(0, 7), F = esc.filiais && esc.filiais.length ? esc.filiais : FILIAIS;
  const rcas = esc.rcas && esc.rcas.length ? esc.rcas.map(String) : null, fr = rcas ? ` AND rca IN (${qs(rcas)})` : '';
  // filhos com o mes do GEROT
  let filhos = [];
  try {
    if (nivel === 'supervisor') filhos = ((await db.prepare(`SELECT rca, vendedor nome, dados FROM gerot_vendedor_mes WHERE mes = ? AND filial = ?${esc.supCod ? ' AND cod_sup = ?' : fr}`).bind(mes, F[0], ...(esc.supCod ? [String(esc.supCod)] : rcas || [])).all()).results || []).map((r) => ({ k: `${r.rca} - ${nm2(r.nome)}`, rca: String(r.rca), ...ler(J(r.dados)) }));
    else if (nivel === 'gerente') filhos = ((await db.prepare('SELECT cod_sup, supervisor nome, dados FROM gerot_supervisor_mes WHERE mes = ? AND filial = ?').bind(mes, F[0]).all()).results || []).filter((r) => !/Hist|INTERNO|EMPRESA/i.test(r.nome || '')).map((r) => ({ k: nm2(r.nome), sup: String(r.cod_sup), ...ler(J(r.dados)) }));
    else filhos = ((await db.prepare(`SELECT filial, dados FROM gerot_filial_mes WHERE mes = ? AND filial IN (${qs(F)})`).bind(mes, ...F).all()).results || []).map((r) => ({ k: r.filial, ...ler(J(r.dados)) }));
  } catch (e) { filhos = []; }
  if (nivel === 'supervisor' && esc.supCod && rcas) filhos = filhos.filter((x) => rcas.includes(x.rca) || true);
  const T = soma(filhos);
  // ontem (ultimo dia util com dado no Clube) e hoje
  let ont = null, hj = null, ontV = [];
  try {
    const dUlt = await db.prepare(`SELECT MAX(dia) d FROM clube_venda_dia WHERE dia < ? AND filial IN (${qs(F)})${fr} AND total_pedido > 0`).bind(hoje, ...F, ...(rcas || [])).first();
    if (dUlt && dUlt.d) {
      ont = await db.prepare(`SELECT ? dia, SUM(total_pedido) v, SUM(ped_total) p, SUM(visitas_rota) vis, SUM(roteiros) rot, SUM(CASE WHEN roteiros > 0 AND ped_total = 0 THEN 1 ELSE 0 END) zer, SUM(CASE WHEN roteiros > 0 AND visitas_rota = 0 THEN 1 ELSE 0 END) semv FROM clube_venda_dia WHERE dia = ? AND filial IN (${qs(F)})${fr}`).bind(dUlt.d, dUlt.d, ...F, ...(rcas || [])).first();
      if (nivel === 'supervisor') ontV = (await db.prepare(`SELECT rca, nome, roteiros, visitas_rota, ped_total FROM clube_venda_dia WHERE dia = ? AND filial = ?${fr} AND roteiros > 0 AND ped_total = 0`).bind(dUlt.d, F[0], ...(rcas || [])).all()).results || [];
    }
    hj = await db.prepare(`SELECT SUM(roteiros) rot, SUM(CASE WHEN roteiros > 0 THEN 1 ELSE 0 END) comRota, SUM(CASE WHEN roteiros > 0 AND roteiros < 20 THEN 1 ELSE 0 END) curta, SUM(visitas_rota) vis, SUM(total_pedido) v, MAX(lido_em) lido FROM clube_venda_dia WHERE dia = ? AND filial IN (${qs(F)})${fr}`).bind(hoje, ...F, ...(rcas || [])).first();
  } catch (e) { /* sem Clube */ }
  // alertas: bloqueados na carteira, "cliente nao pediu" do mes
  let bloq = null, naoPediu = null;
  try { bloq = await db.prepare(`SELECT COUNT(*) n FROM gerot_carteira WHERE situacao LIKE 'Bloqueado%' AND filial IN (${qs(F)})${fr}`).bind(...F, ...(rcas || [])).first(); } catch (e) { /* sem carteira */ }
  if (nivel !== 'supervisor') { try { const r = await db.prepare(`SELECT SUM(valor) v, SUM(notas) n FROM gerot_devolucao_motivo WHERE mes = ? AND motivo = 'CLIENTE NAO PEDIU' AND ${nivel === 'diretoria' && F.length > 1 ? "filial = ''" : 'filial = ?'}`).bind(mes, ...(nivel === 'diretoria' && F.length > 1 ? [] : [F[0]])).first(); if (r && r.v) naoPediu = r; } catch (e) { /* sem motivo */ } }
  // clientes a recuperar (so supervisor): compraram no mes passado e ainda nao compraram nem tem pedido
  let recup = [];
  if (nivel === 'supervisor' && rcas) { try { const { results } = await db.prepare(`SELECT rca, nome, dados FROM gerot_cliente_mes WHERE mes = ? AND filial = ?${fr}`).bind(mes, F[0], ...rcas).all(); recup = (results || []).map((r) => ({ rca: r.rca, nome: titulo(String(r.nome || '').toLowerCase()), d: J(r.dados) })).filter((x) => Number(x.d['Positivação M-1']) > 0 && !(Number(x.d['Positivação (filial + CNPJ)']) > 0) && !(Number(x.d['Positivação + Carteira']) > 0)); } catch (e) { recup = []; } }

  const p1 = String(esc.primeiro || '').split(' ')[0];
  const L = [`☀️ *Bom dia${p1 ? ', ' + titulo(p1.toLowerCase()) : ''}!* ${nivel === 'diretoria' ? 'O Brasil' : nivel === 'gerente' ? 'Sua filial' : 'Sua equipe'} para começar o dia — *${esc.nome}*`, ''];
  if (ont && ont.dia) L.push(`📅 *${DSEM[new Date(ont.dia + 'T12:00:00Z').getUTCDay()]} ${ont.dia.slice(8, 10)}/${ont.dia.slice(5, 7)}:* *${R$(ont.v || 0)}* em ${N(ont.p || 0)} pedidos · visitas ${N(ont.vis || 0)}/${N(ont.rot || 0)} (${pc(ont.vis || 0, ont.rot || 0)})${ont.zer ? ` · *${N(ont.zer)} zerado(s)*` : ''}${ont.semv ? ` · ${N(ont.semv)} sem visita` : ''}`);
  if (T.meta) {
    const ritmo = T.cap != null && T.ideal ? T.cap / T.ideal * 100 : null;
    L.push(`💰 *Mês:* fat. + carteira *${R$((T.fat || 0) + (T.cart || 0))}* = *${pc((T.fat || 0) + (T.cart || 0), T.meta)}* da meta (${R$(T.meta)})`);
    if (ritmo != null) L.push(`📈 Ritmo *${Math.round(ritmo)}%* do ideal${T.nec ? ` · precisa captar *${R$(T.nec)}*/dia útil` : ''}${T.capM1 ? ` · vs mês passado no mesmo dia ${T.cap >= T.capM1 ? '▲' : '▼'} ${Math.abs(Math.round((T.cap / T.capM1 - 1) * 100))}%` : ''}`);
  }
  if (T.metaPos) L.push(`👥 Positivação com carteira *${N(T.posC || T.pos || 0)}* de ${N(T.metaPos)} (*${pc(T.posC || T.pos || 0, T.metaPos)}*)${T.posM1 ? ` · mês passado inteiro ${N(T.posM1)}` : ''}`);
  if (hj && hj.rot) L.push(`🚶 *Hoje:* ${N(hj.rot)} clientes na rota de ${N(hj.comRota || 0)} vendedores${hj.curta ? ` · *${N(hj.curta)} com rota curta (<20)*: encaixar prospects e curva negativa` : ''}${hj.vis ? ` · já visitados ${N(hj.vis)}` : ''}`);
  // 3 prioridades: pior ritmo (com meta)
  const rit = (x) => (x.cap != null && x.ideal ? x.cap / x.ideal * 100 : x.meta ? ((x.fat || 0) + (x.cart || 0)) / x.meta * 100 : null);
  // sem contas de gerente/internas e sem quem tem menos de 2% da meta do grupo (18/11/2026: "Gerente Tph" e meta pequena apareciam como prioridade)
  const pri = filhos.filter((x) => x.meta > 0 && x.meta >= (T.meta || 0) * 0.02 && rit(x) != null && !/VAGO|GERENTE|VENDA EMPRESA|INTERNO/i.test(x.k)).sort((a, b) => rit(a) - rit(b));
  if (pri.length) {
    L.push('', `🎯 *Prioridades (pior ritmo primeiro):*`);
    pri.slice(0, 3).forEach((x, i) => L.push(`${i + 1}. *${x.k}*: ritmo ${Math.round(rit(x))}%${x.nec ? ` · precisa ${R$(x.nec)}/dia` : ''}${x.metaPos ? ` · positivação ${pc(x.posC || x.pos || 0, x.metaPos)}` : ''}`));
    const bom = pri[pri.length - 1]; if (pri.length > 3 && bom) L.push(`🏆 Melhor ritmo: *${bom.k}* (${Math.round(rit(bom))}%)`);
  }
  const al = [];
  if (ontV.length) al.push(`zerados ontem: ${ontV.slice(0, 4).map((v) => `${v.rca} - ${nm2(v.nome)}`).join(', ')}${ontV.length > 4 ? ' +' + (ontV.length - 4) : ''}`);
  if (bloq && bloq.n) al.push(`${N(bloq.n)} pedido(s) bloqueado(s) na carteira`);
  if (naoPediu) al.push(`"cliente não pediu" no mês: ${R$(naoPediu.v)} em ${N(naoPediu.n)} notas (cartão vermelho na Liga)`);
  if (al.length) L.push('', '⚠️ *Atenção:* ' + al.join(' · '));
  if (recup.length) { L.push('', `🔁 *Recuperar hoje (compraram no mês passado, ainda nada neste):* ${N(recup.length)} clientes — os 5 primeiros:`); (() => { const por = new Map(); for (const x of recup) { if (!por.has(x.rca)) por.set(x.rca, []); por.get(x.rca).push(x); } const out = []; for (let i = 0; out.length < 5 && i < 5; i++) for (const L0 of por.values()) if (L0[i] && out.length < 5) out.push(L0[i]); return out; })().forEach((x) => L.push(`• ${x.nome} · vendedor ${x.rca}`)); }
  // o que um CEO diria: uma frase de decisao
  if (nivel === 'diretoria' && pri.length) { const pior = pri[0]; L.push('', `🧭 *Onde eu atuaria hoje:* ${pior.k} (ritmo ${Math.round(rit(pior))}%)${pri[1] ? ` e ${pri[1].k} (${Math.round(rit(pri[1]))}%)` : ''} — cobrar rota completa e positivação da carteira.`); }
  L.push('', `_Mês: GEROT · dia: Clube da Venda${hj && hj.lido ? ' ' + new Date(hj.lido).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : ''}. Digite *menu* para ver tudo o que eu respondo._`);
  return L.join(String.fromCharCode(10));
}
