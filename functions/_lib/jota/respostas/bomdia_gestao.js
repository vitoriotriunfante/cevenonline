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
  // 23/11/2026 (docs/DICIONARIO_KPIS.md, conflito 3): o TOTAL sai da camada functions/_lib/fatos no nivel de quem pergunta (filial = gerot_filial_mes,
  // equipe/grupo = soma dos vendedores da Gestao de Equipe, positivacao = clientes distintos). Antes somava os supervisores e tirava 'Hist/INTERNO/EMPRESA'
  // (MCD R$ 4,10 mi x 3,70 mi oficial; positivacao 44% x 65%). Os filhos servem so para as prioridades.
  const F8 = await import('../../fatos/index.js'), du = F8.diasUteis();
  let cfg = null; try { cfg = J(((await db.prepare('SELECT conteudo_json FROM config_equipe_soberana LIMIT 1').first()) || {}).conteudo_json); } catch (e) { cfg = null; }
  const gestao = cfg && cfg.filiais ? Object.entries(cfg.filiais).filter(([k]) => k.split('_')[0] === F[0]).flatMap(([, L]) => L || []) : [];
  if (nivel === 'gerente' && esc.grupo && !(esc.rcas && esc.rcas.length)) esc = { ...esc, rcas: gestao.filter((v) => String(v.grupo || '').toUpperCase() === String(esc.grupo).toUpperCase()).map((v) => String(v.rca)) };
  const rcas = esc.rcas && esc.rcas.length ? esc.rcas.map(String) : null, fr = rcas ? ` AND CAST(rca AS INTEGER) IN (${rcas.map(Number).filter((x) => !Number.isNaN(x)).join(',') || -1})` : '';
  const K = await (nivel === 'supervisor' ? F8.kpisMes(db, { nivel: 'equipe', filiais: [F[0]], rcas: rcas || [], supCod: esc.supCod }) : nivel === 'gerente' && esc.grupo ? F8.kpisMes(db, { nivel: 'grupo', filiais: [F[0]], grupo: esc.grupo, rcas: rcas || [] }) : F8.kpisMes(db, { nivel: F.length > 1 ? 'brasil' : 'filial', filiais: F })).catch(() => null);
  // filhos (prioridades): supervisor -> vendedores da equipe; gerente -> equipes da Gestao (soma dos vendedores); diretoria -> filiais
  let filhos = [];
  try {
    if (nivel === 'diretoria') filhos = ((await db.prepare(`SELECT filial, dados FROM gerot_filial_mes WHERE mes = ? AND filial IN (${qs(F)})`).bind(mes, ...F).all()).results || []).map((r) => ({ k: r.filial, ...ler(J(r.dados)) }));
    else {
      const VG = (await F8.vendedoresGerot(db, F[0], mes)) || [], por = new Map();
      const supDe = new Map(gestao.map((v) => [String(Number(v.rca)), String(v.supervisor || '')]));
      for (const x of VG) {
        if (rcas && !rcas.map((r) => String(Number(r))).includes(x.rca)) continue;
        const k = nivel === 'supervisor' ? `${x.rca} - ${nm2(x.vendedor)}` : (supDe.get(x.rca) || 'sem supervisor na Gestão');
        if (!por.has(k)) por.set(k, { k: nivel === 'supervisor' ? k : nm2(k), rca: x.rca, L: [], rcas: [] });
        por.get(k).L.push(ler(x.d)); por.get(k).rcas.push(x.rca);
      }
      filhos = [...por.values()].map((g) => { const s = soma(g.L); if (g.L.length > 1 || nivel !== 'supervisor') { s.nec = s.cap != null && du.restantes > 0 ? Math.max(0, (s.meta || 0) - s.cap) / du.restantes : null; } return { k: g.k, rca: g.rca, rcas: g.rcas, ...s }; });
      if (nivel === 'gerente') { const PG = await F8.positivacaoPorGrupos(db, F[0], new Map(filhos.map((x) => [x.k, x.rcas]))); for (const x of filhos) { const p = PG && PG.get(x.k); x.pos = p ? p.pos : null; x.posC = p ? p.posC : null; x.metaPos = null; } }
    }
  } catch (e) { filhos = []; }
  const T = K ? { meta: K.meta, fat: K.fat, cart: K.cart, cap: K.cap, ideal: K.ideal, nec: K.nec, capM1: K.capM1, pos: K.pos, posC: K.posC, metaPos: K.metaPos, posM1: K.posM1 } : {};
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
  if (T.metaPos) L.push(`👥 Positivação com carteira *${N(T.posC || T.pos || 0)}* de ${N(T.metaPos)} (*${pc(T.posC || T.pos || 0, T.metaPos)}*)${T.posM1 ? ` · mês passado inteiro ${N(T.posM1)}` : ''}${K && K.metaPosRotulo && !/do GEROT$/.test(K.metaPosRotulo) ? ` _(${K.metaPosRotulo})_` : ''}`);
  else if (T.pos != null) L.push(`👥 Positivação: *${N(T.pos)}* clientes faturados · com carteira *${N(T.posC || T.pos)}* (clientes distintos, sem repetir) · meta de positivação do grupo ainda não definida`);
  if (hj && hj.rot) L.push(`🚶 *Hoje:* ${N(hj.rot)} clientes na rota de ${N(hj.comRota || 0)} vendedores${hj.curta ? ` · *${N(hj.curta)} com rota curta (<20)*: encaixar prospects e curva negativa` : ''}${hj.vis ? ` · já visitados ${N(hj.vis)}` : ''}`);
  // 3 prioridades: pior ritmo (com meta)
  const rit = (x) => (x.cap != null && x.ideal ? x.cap / x.ideal * 100 : x.meta ? ((x.fat || 0) + (x.cart || 0)) / x.meta * 100 : null);
  // sem contas de gerente/internas e sem quem tem menos de 2% da meta do grupo (18/11/2026: "Gerente Tph" e meta pequena apareciam como prioridade)
  const pri = filhos.filter((x) => x.meta > 0 && x.meta >= (T.meta || 0) * 0.02 && rit(x) != null && !/VAGO|GERENTE|VENDA EMPRESA|INTERNO|SEM SUPERVISOR/i.test(x.k)).sort((a, b) => rit(a) - rit(b));
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
