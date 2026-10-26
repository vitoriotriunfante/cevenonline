// =========================================================================
// JOTA · functions/_lib/jota/escopo.js
// O QUE É: quem pode ver o quê (diretoria, gerente, supervisor, vendedor) e quem é a pessoa citada na pergunta.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { VAREJO, hojeSP, nome2, sem, so, vn } from './base.js';

// vendedores de uma filial (mostrados na Gestao de Equipe) + totais que somam TODOS (macro)
// codigo do supervisor pelo nome (preenchido ao carregar a equipe) -> supNome/sn mostram 'COD - Nome'
export const SUPCOD = new Map();
export const sn = (nome, cod) => { const c = cod || SUPCOD.get(sem(nome)); return (c ? c + ' - ' : '') + nome2(nome); };
export async function vendedoresDaFilial(B, filial, grupo, supervisor, soRca) {
  const [snap, mostra] = await Promise.all([B.snap(filial), B.mostra()]);
  const eq = new Map(); if (mostra && mostra.filiais) for (const [k, L] of Object.entries(mostra.filiais)) if (k.split('_')[0] === filial) for (const v of L) eq.set(String(v.rca), v);
  const vend = [], ocultos = []; const macro = { pedidos: 0, dig: 0, devHoje: 0 };
  for (const [rca, r] of Object.entries((snap && snap.rcas) || {})) {
    const e = eq.get(rca);
    if (grupo && (!e || String(e.grupo || '').toUpperCase() !== String(grupo).toUpperCase())) continue;
    if (supervisor && (!e || sem(e.supervisor) !== sem(supervisor))) continue;   /* supervisor ve so a equipe dele (25/10/2026) */
    if (soRca && String(rca) !== String(soRca)) continue;   /* vendedor ve so os proprios numeros */
    const d = r.dashboard || {}, fi = d.financeiro || {}, po = d.positivacao || {}, pd = (r.produtividade && r.produtividade.dia) || {}, pm = (r.produtividade && r.produtividade.mes) || {};
    macro.pedidos += pd.positivacao || 0; macro.dig += pd.dig_pedido || 0;
    macro.devHoje += (Array.isArray(r.devolucoes) ? r.devolucoes : []).filter((x) => String(x && x.data || '').slice(0, 10) === hojeSP()).reduce((t, x) => t + Math.abs(parseFloat(x.vl_devolvido || x.valor || 0) || 0), 0);
    if (!e) continue;   // fora da arvore do CEVEN de hoje = nao existe
    // OCULTO NA GESTAO (26/10/2026, Francisco: 'setor 1028' = Adevane, oculto): fica fora das listas e totais, mas o JOTA o encontra quando citado (nome ou codigo)
    if (e.supervisor && e.sup_cod) SUPCOD.set(sem(e.supervisor), e.sup_cod);
    const destino = e.mostra === false ? ocultos : vend;
    const varejo = VAREJO.has(String(e.canal || '').toUpperCase());
    const visP = varejo ? pd.total_programado || 0 : 0, visF = varejo ? pd.visitas_na_rota || 0 : 0;
    destino.push({ filial, rca, nome: e.nome || d.nome || 'RCA ' + rca, supervisor: e.supervisor || '', supCod: e.sup_cod || '', grupo: e.grupo || '', gerente: e.gerente || '', canal: e.canal || '', varejo,
      fat: fi.faturado || 0, pend: fi.pendente || 0, meta: fi.meta || 0, dev: fi.devolucao || 0, pct: fi.meta ? (fi.faturado || 0) / fi.meta * 100 : null,
      pos: po.realizado ?? null, metaPos: po.meta ?? null, dig: pd.dig_pedido || 0, ped: pd.positivacao || 0, visP, visF, comVenda: varejo ? pd.visitas_com_venda || 0 : 0,
      visPlanMes: varejo ? pm.visit_plan || 0 : 0, visRealMes: varejo ? pm.visit_real || 0 : 0,
      /* mes do PROPRIO vendedor, qualquer canal (detalhe do vendedor; os totais de rota seguem so varejo) */ roteiroMes: Array.isArray(r.roteiro_mes) ? r.roteiro_mes : null, mesV: { plan: pm.visit_plan ?? null, real: pm.visit_real ?? null, pedRota: pm.ped_rota_mes ?? null, efic: pm.eficiencia_pct ?? null },
      zerado: varejo && visP > 0 && !(pd.dig_pedido > 0), semVisita: varejo && visP > 0 && !visF, devolucoes: Array.isArray(r.devolucoes) ? r.devolucoes : [],
      /* devolucoes que ENTRARAM hoje (mesma regra do WhatsApp 17:00/18:30: d.data === hoje) */
      devHoje: (Array.isArray(r.devolucoes) ? r.devolucoes : []).filter((x) => String(x && x.data || '').slice(0, 10) === hojeSP()).reduce((t, x) => t + Math.abs(parseFloat(x.vl_devolvido || x.valor || 0) || 0), 0),
      vendeuHoje: (pd.dig_pedido || 0) > 0 || (pd.positivacao || 0) > 0 || (pd.visitas_com_venda || 0) > 0,
      // AS tambem tem roteiro (26/10/2026, Missaid: 'quais clientes o setor 1108 visitou e nao vendeu?' -> 'nao e varejo de rota'): o detalhe do vendedor mostra o roteiro de quem tiver;
      // a regra 'rota so varejo' vale para cobranca e medias (eficacia, zerados), nao para responder sobre os clientes de um vendedor.
      rotaHoje: Array.isArray(r.roteiro) ? r.roteiro.filter((c) => String(c.data_visita || '').slice(0, 10) === hojeSP() || /FORA/i.test(String(c.status || ''))) : [],
      /* clientes da rota de HOJE ainda sem visita (status ABERTO/AGENDADO, sem check-in) */
      aVisitar: Array.isArray(r.roteiro) ? r.roteiro.filter((c) => String(c.data_visita || '').slice(0, 10) === hojeSP() && /^(ABERTO|AGENDADO)$/i.test(String(c.status || '')) && !c.checkin_horario) : [] });
  }
  vend.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  return { vend, ocultos, macro };
}

// ESCOPO: { nome, filiais:[...], grupo, nacional }
export async function carregaEscopo(B, esc) {
  const partes = await Promise.all(esc.filiais.map((f) => vendedoresDaFilial(B, f, esc.grupo, esc.supervisor, esc.rca)));
  const vend = partes.flatMap((p) => p.vend), ocultos = partes.flatMap((p) => p.ocultos || []);
  const macro = partes.reduce((t, p) => ({ pedidos: t.pedidos + p.macro.pedidos, dig: t.dig + p.macro.dig, devHoje: t.devHoje + p.macro.devHoje }), { pedidos: 0, dig: 0, devHoje: 0 });
  return { ...esc, vend, ocultos, macro, porFilial: Object.fromEntries(esc.filiais.map((f, i) => [f, partes[i]])) };
}
// chave de supervisor: "NOME|FIL" no Brasil; pseudo-supervisores (sem supervisor, GERENTE X, VAGO) nao entram em ranking nem sugestao
export const supChave = (v, nac) => (v.supervisor || 'sem supervisor') + (nac ? '|' + v.filial : '');
export const supNome = (k) => { const [s, f] = String(k).split('|'); return (/^sem supervisor$/i.test(s) ? 'Ligados ao gerente' : /^GERENTE/i.test(s) ? 'Ligados ao gerente' : sn(s)) + (f ? ' ' + f : ''); };
export const supReal = (k) => !/^(sem supervisor|GERENTE|VAGO)/i.test(String(k));
export const pessoaReal = (v) => !/^(VAGO|RCA\b|VENDA |GERENTE)/i.test(String(v.nome || ''));
export function agrupa(V, chave) {
  const m = new Map();
  for (const v of V) { const k = chave(v); const x = m.get(k) || { V: [], fat: 0, pend: 0, meta: 0, dig: 0, ped: 0, dev: 0, pos: 0, metaPos: 0, visP: 0, visF: 0, comVenda: 0, zerados: 0, semVisita: 0, varejo: 0 };
    x.V.push(v); x.fat += v.fat; x.pend += v.pend; x.meta += v.meta; x.dig += v.dig; x.ped += v.ped; x.dev += v.dev; x.pos += v.pos || 0; x.metaPos += v.metaPos || 0;
    x.visP += v.visP; x.visF += v.visF; x.comVenda += v.comVenda; if (v.zerado) x.zerados++; if (v.semVisita) x.semVisita++; if (v.varejo) x.varejo++; m.set(k, x); }
  for (const x of m.values()) x.pct = x.meta ? x.fat / x.meta * 100 : null;
  return m;
}
export const pctTxt = (x) => x == null ? 'sem dado' : x.toFixed(1).replace('.', ',') + '%';
export const listaNomes = (V, n = 4) => V.slice(0, n).map((v) => vn(v)).join(', ') + (V.length > n ? ` +${V.length - n}` : '');

// acha supervisor ou vendedor citado na mensagem (primeiro nome tem que bater)
export const PAL = new Set(['SETOR', 'SETORES', 'COMO', 'ESTA', 'QUAL', 'QUAIS', 'HOJE', 'VENDEDOR', 'VENDEDORA', 'SUPERVISOR', 'SUPERVISORA', 'FILIAL', 'ROTA', 'MINHA', 'MEU', 'EQUIPE', 'TIME', 'DELE', 'DELA', 'QUANTO', 'FALTA', 'LIGA', 'BRASIL', 'TODOS', 'TODAS', 'SOBRE', 'ESTOU', 'ESTAMOS', 'ONTEM', 'MAIS', 'MENOS', 'PEDIDO', 'PEDIDOS', 'VENDA', 'VENDAS', 'META', 'POSICAO', 'TABELA', 'ANDA', 'VAI', 'PARA', 'COM']);
export function achaPessoa(E, t) {
  const toks = t.split(/[^A-Z]+/).filter((w) => (w.length > 2 || w === 'PJ') && !PAL.has(w));
  const score = (nome) => { const p = sem(nome).replace(/^CLT\s*-?\s*/, '').split(/\s+/); if (!toks.includes(p[0])) return 0; return 1 + p.slice(1).filter((w) => toks.includes(w)).length; };
  // CODIGO CITADO MANDA (sabatina 25/10/2026: "vendedor Ana Carolina 483" virou a Ana Broto 251): vale o codigo quando o nome bate com
  // aquele vendedor ou quando vem escrito "RCA/COD/codigo/vendedor 483". Numero solto ("top 10", "3 dias") nunca vira vendedor.
  for (const n of t.match(/\b\d{1,5}\b/g) || []) {
    const cand = E.vend.concat(E.ocultos || []).filter((v) => String(v.rca) === n);
    const explicito = new RegExp(`(RCA|COD|CODIGO|VENDEDORA?|VEND|SETOR)\\.?\\s*${n}\\b`).test(t) || (E.supervisor && !/\b(TOP|DIAS?|ULTIMOS?|PRIMEIROS?|MAIORES|MENORES)\s+\d/.test(t));   /* supervisor: numero do proprio time = vendedor (26/10/2026) */
    const bom = cand.map((v) => [v, score(v.nome)]).filter((x) => x[1] || explicito).sort((a, b) => b[1] - a[1]);
    if (bom.length) return { tipo: 'vend', alvo: bom[0][0], empate: [bom[0][0]] };
  }
  if (!toks.length) return null;   /* 26/10/2026: so DEPOIS do codigo ("vendedor 59" nao tem palavra de nome e saia vazio) */
  const querSup = /SUPERVIS|EQUIPE|TIME/.test(t), querVend = /VENDEDOR|\bRCA\b/.test(t);
  const sups = [...new Map(E.vend.filter((v) => v.supervisor && supReal(v.supervisor)).map((v) => [v.filial + '|' + v.supervisor, { nome: v.supervisor, filial: v.filial }])).values()];
  const bs = sups.map((s) => [s, score(s.nome)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  const bv = E.vend.concat(E.ocultos || []).map((v) => [v, score(v.nome)])   /* oculto na Gestao tambem e achado pelo NOME (26/10/2026: Anderson, "vendedor Bruno" = 153 oculto) */.filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  if (bs.length && !querVend && (querSup || !bv.length || bs[0][1] >= bv[0][1])) return { tipo: 'sup', alvo: bs[0][0], empate: bs.filter((x) => x[1] === bs[0][1]).map((x) => x[0]) };
  if (bv.length) return { tipo: 'vend', alvo: bv[0][0], empate: bv.filter((x) => x[1] === bv[0][1]).map((x) => x[0]) };
  return null;
}
