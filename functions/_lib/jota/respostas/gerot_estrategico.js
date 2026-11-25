// =========================================================================
// JOTA · functions/_lib/jota/respostas/gerot_estrategico.js
// O QUE É: 11 leituras estratégicas do GEROT 100% no D1 (Migration 0015), com
//   trava estrita por papel (vendedor só vê os próprios clientes/equipe; nunca vê
//   DRE/Curva de Margem/FEFO/Estoque Winthor/JBP SKU).
// Regras: nunca inventar ou estimar; rodapé com posição oficial do GEROT.
// =========================================================================
import { FILIAIS, N, P, R$, SUGESTAO, hojeSP, nome2, sem, titulo } from '../base.js';

const papelDe = (c) => String((c && c.papel) || '').toLowerCase();
const ehVendedor = (c, E) => papelDe(c) === 'vendedor' || Boolean(E && E.rca);
const ehBloqGerencial = (c, E) => ehVendedor(c, E);
const bloqueioMsg = (tema) => `🔒 *Acesso gerencial — ${tema}*\nEssa visão (${tema}) é restrita à supervisão, gerência e diretoria.\n\nNo seu acesso de vendedor, você pode consultar *RFV*, *PMI*, *Cliven*, *Recorrência*, *Cadastro de clientes* e sua *Curva negativa de clientes*.`;

const mesAtual = () => hojeSP().slice(0, 7);
const qs = (arr) => arr.map(() => '?').join(',');
const pct1 = (f) => (f == null || !Number.isFinite(Number(f)) ? '—' : `${(Number(f) * 100).toFixed(1).replace('.', ',')}%`);

async function mesOuUltimo(db, tabela) {
  const m0 = mesAtual();
  try {
    const r = await db.prepare(`SELECT 1 ok FROM ${tabela} WHERE mes = ? LIMIT 1`).bind(m0).first();
    if (r) return m0;
    const u = await db.prepare(`SELECT MAX(mes) m FROM ${tabela}`).first();
    return (u && u.m) || m0;
  } catch { return m0; }
}

async function posFooter(db, mes) {
  try {
    const st = await db.prepare('SELECT posicao FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first();
    if (st && st.posicao) return `_Fonte: GEROT · ${st.posicao}_`;
  } catch {}
  return '_Fonte: GEROT (D1 oficial)_';
}

function escopoWhere(E, c, opts = {}) {
  const filCol = opts.filCol || 'filial';
  const rcaCol = opts.rcaCol || 'rca';
  const supCol = opts.supCol || 'sup_cod';
  const fils = (E && Array.isArray(E.filiais) && E.filiais.length) ? E.filiais : FILIAIS;
  const w = [];
  const bind = [];

  if (!E || !E.nacional || fils.length < FILIAIS.length) {
    w.push(`${filCol} IN (${qs(fils)})`);
    bind.push(...fils);
  }
  if (ehVendedor(c, E)) {
    const rca = String((c && c.rca) || (E && E.rca) || '');
    if (opts.temRca) {
      w.push(`${rcaCol} = ?`);
      bind.push(rca);
    }
  } else if ((E && E.supervisor) || (E && E.grupo)) {
    const rcas = [...new Set((E.vend || []).map((v) => String(v.rca)).filter(Boolean))];
    const sups = [...new Set((E.vend || []).map((v) => String(v.sup_cod || v.supCod || '')).filter(Boolean))];
    if (opts.temRca && rcas.length) {
      w.push(`${rcaCol} IN (${qs(rcas)})`);
      bind.push(...rcas);
    } else if (opts.temSup && sups.length) {
      w.push(`${supCol} IN (${qs(sups)})`);
      bind.push(...sups);
    }
  }
  return { sql: w.length ? w.join(' AND ') : '1=1', bind, fils };
}

function extraiIndustriaTexto(t) {
  const stops = new Set([
    'DE', 'DA', 'DO', 'DOS', 'DAS', 'EM', 'NO', 'NA', 'POR', 'JBP', 'SKU', 'SKUS', 'GEROT', 'MARGEM',
    'DRE', 'ESTOQUE', 'WINTHOR', 'FEFO', 'RFV', 'PMI', 'CADASTRO', 'CLIENTES', 'CLIVEN', 'CAMPO', 'TMF',
    'FILIAL', 'BRASIL', 'CURVA', 'NEGATIVA', 'QUAL', 'QUAIS', 'COMO', 'ESTA', 'ESTAO', 'HOJE', 'MES',
    'MAIOR', 'MAIORES', 'PIOR', 'PIORES', 'MELHOR', 'MELHORES', 'QUEDA', 'QUEDAS', 'CAIU', 'CAIRAM',
    'PERDA', 'PERDAS', 'RANKING', 'TOP', 'PRODUTO', 'PRODUTOS', 'ANALISE', 'VENDA', 'VENDAS', ...FILIAIS
  ]);
  const toks = String(t || '').split(/[^A-Z0-9]+/).filter((w) => w.length >= 4 && !stops.has(w));
  return toks[0] || '';
}

// 1) ESTOQUE FEFO
export async function respFefo(B, E, c, t) {
  if (ehBloqGerencial(c, E)) return bloqueioMsg('Estoque FEFO');
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const esc = escopoWhere(E, c, { temRca: false });
  const onde = E.nacional ? 'Brasil' : esc.fils.join(', ');
  let res = [];
  try {
    res = (await db.prepare(`SELECT filial, sku, lote, produto, fornecedor, faixa, validade, dias_vencer, valor, saldo, cobertura_dias, risco, quarentena, acao_sugerida, carga FROM gerot_fefo WHERE ${esc.sql}`).bind(...esc.bind).all()).results || [];
  } catch { return `📦 *Estoque FEFO — ${onde}*\nBase FEFO ainda não foi carregada nesta rodada.`; }
  if (!res.length) return `📦 *Estoque FEFO — ${onde}*\nAinda sem dados de lotes FEFO gravados no D1 para este escopo (roda automaticamente nos Tiers 2/3).`;

  let lista = res;
  if (/VENCID/.test(t)) lista = res.filter((x) => x.faixa === 'Vencido');
  else if (/VERMELH|CRITIC/.test(t)) lista = res.filter((x) => x.faixa === 'Vermelho' || x.faixa === 'Vencido');
  else if (/LARANJ/.test(t)) lista = res.filter((x) => x.faixa === 'Laranja');
  else if (/QUARENT/.test(t)) lista = res.filter((x) => x.quarentena);
  else if (/ATUAR|RISCO/.test(t)) lista = res.filter((x) => x.risco || x.faixa === 'Vencido');

  const porFx = new Map();
  let totVlr = 0, totRisco = 0, nRisco = 0, totQuar = 0;
  for (const r of res) {
    const v = Number(r.valor) || 0;
    totVlr += v;
    if (r.risco || r.faixa === 'Vencido') { totRisco += v; nRisco++; }
    if (r.quarentena) totQuar += v;
    const o = porFx.get(r.faixa) || { n: 0, v: 0 };
    o.n++;
    o.v += v;
    porFx.set(r.faixa, o);
  }
  const ordemFx = ['Vencido', 'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Sem informação'];
  const crit = (lista.some((x) => x.risco || x.faixa === 'Vencido' || x.faixa === 'Vermelho') ? lista.filter((x) => x.risco || x.faixa === 'Vencido' || x.faixa === 'Vermelho') : lista)
    .slice().sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0)).slice(0, 5);
  const carga = (res[0] && res[0].carga) ? ` · foto ${res[0].carga.slice(0, 10)}` : '';
  return [
    `🧪 *Estoque FEFO (Validade WMS) — ${onde}*${carga}`,
    `Total monitorado: *${R$(totVlr)}* (${N(res.length)} lotes) · 🚨 Em risco/vencido: *${R$(totRisco)}* (${N(nRisco)} lotes)` + (totQuar > 0 ? ` · 🔒 Quarentena: ${R$(totQuar)}` : ''),
    '',
    '*Por faixa de validade:*',
    ...ordemFx.filter((f) => porFx.has(f)).map((f) => { const x = porFx.get(f); return `• ${f}: *${N(x.n)}* lotes · ${R$(x.v)}`; }),
    ...(crit.length ? ['', '*Maiores valores críticos:*', ...crit.map((x, i) => `${i + 1}. [${x.filial}] *${titulo(x.produto).slice(0, 30)}* · ${x.faixa}${x.dias_vencer != null ? ` (${x.dias_vencer}d)` : ''} · ${R$(x.valor)}${x.acao_sugerida ? ` · ${x.acao_sugerida}` : ''}`)] : []),
    '',
    SUGESTAO + 'atacar primeiro os lotes *Vencidos* e *Vermelhos com risco* (cobertura > dias para vencer).',
    await posFooter(db, mesAtual())
  ].join('\n');
}

// 2) ESTOQUE WINTHOR (PCEST)
export async function respEstWinthor(B, E, c, t) {
  if (ehBloqGerencial(c, E)) return bloqueioMsg('Estoque Winthor');
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const esc = escopoWhere(E, c, { temRca: false });
  const onde = E.nacional ? 'Brasil' : esc.fils.join(', ');
  let res = [];
  try {
    res = (await db.prepare(`SELECT filial, sku, produto, fornecedor, dias_estoque, valor, caixas, peso_kg, disponivel, estoque, reservado, bloqueado, parado_90d, ruptura, curva_abc, carga FROM gerot_est_winthor WHERE ${esc.sql}`).bind(...esc.bind).all()).results || [];
  } catch { return `🏭 *Estoque Winthor — ${onde}*\nBase de estoque ainda não carregada.`; }
  if (!res.length) return `🏭 *Estoque Winthor — ${onde}*\nAinda sem foto da \`pcest\` carregada no D1 (roda nos Tiers 2/3).`;

  const modoRupt = /RUPTURA/.test(t);
  const modoPar = /PARAD/.test(t);
  let vTot = 0, vDisp = 0, vBloq = 0, nRupt = 0, nPar = 0, vPar = 0, cx = 0;
  const porFil = new Map();
  for (const r of res) {
    const est = Number(r.estoque) || 0, cus = est > 0 ? (Number(r.valor) || 0) / est : 0;
    const v = Number(r.valor) || 0, vd = (Number(r.disponivel) || 0) * cus, vb = (Number(r.bloqueado) || 0) * cus;
    vTot += v; vDisp += vd; vBloq += vb; cx += Number(r.caixas) || 0;
    if (r.ruptura) nRupt++;
    if (r.parado_90d) { nPar++; vPar += v; }
    const f = porFil.get(r.filial) || { v: 0, r: 0, p: 0, vp: 0 };
    f.v += v;
    if (r.ruptura) f.r++;
    if (r.parado_90d) { f.p++; f.vp += v; }
    porFil.set(r.filial, f);
  }
  const dest = modoRupt
    ? res.filter((x) => x.ruptura).slice(0, 6)
    : modoPar
      ? res.filter((x) => x.parado_90d).sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0)).slice(0, 6)
      : [...porFil.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 6);

  return [
    `🏬 *Estoque Winthor (PCEST) — ${onde}*`,
    `Valor total: *${R$(vTot)}* (${N(cx)} cx) · Disponível: ${R$(vDisp)}` + (vBloq > 0 ? ` · Bloq.: ${R$(vBloq)}` : ''),
    `🚨 Rupturas (c/ venda recente): *${N(nRupt)} SKUs* · 🧊 Parados +90d: *${N(nPar)} SKUs* (${R$(vPar)})`,
    '',
    modoRupt ? '*Principais SKUs em ruptura:*' : modoPar ? '*Maiores estoques parados (+90d):*' : '*Por filial:*',
    ...(modoRupt || modoPar
      ? dest.map((x, i) => `${i + 1}. [${x.filial}] *${titulo(x.produto).slice(0, 32)}* · Curva ${x.curva_abc || '—'} · ${modoRupt ? 'Disp. 0' : `${R$(x.valor)} · ${Math.round(x.dias_estoque || 0)}d est.`}`)
      : dest.map(([f, x], i) => `${i + 1}. *${f}*: ${R$(x.v)} · ${N(x.r)} rupturas · ${N(x.p)} parados (${R$(x.vp)})`)),
    '',
    SUGESTAO + (nRupt > 0 ? 'revisar as rupturas de *Curva A* com compras e remanejar parados +90d.' : 'acompanhar cobertura dos itens parados +90d.'),
    await posFooter(db, mesAtual())
  ].join('\n');
}

// 3) DRE & MARGEM DE CONTRIBUIÇÃO (+ Histograma)
export async function respDreMargem(B, E, c, t) {
  if (ehBloqGerencial(c, E)) return bloqueioMsg('DRE & Margem de Contribuição');
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const mes = await mesOuUltimo(db, 'gerot_dre_mes');
  const esc = escopoWhere(E, c, { temRca: false });
  const onde = E.nacional ? 'Brasil' : esc.fils.join(', ');

  if (/HISTOGRAMA|FAIXA DE DESCONTO/.test(t)) {
    const fAlvo = E.nacional ? 'BRASIL' : esc.fils[0];
    const tipo = /MARGEM/.test(t) && !/DESCONTO/.test(t) ? 'margem' : 'desconto';
    let rows = [];
    try {
      rows = (await db.prepare('SELECT faixa, itens, fat_bruto, margem_rs, margem_pct FROM gerot_histograma_margem WHERE mes = ? AND filial = ? AND tipo = ? ORDER BY fat_bruto DESC').bind(mes, fAlvo, tipo).all()).results || [];
    } catch { rows = []; }
    if (!rows.length) return `📊 *Histograma (${tipo}) — ${fAlvo} (${mes})*\nAinda sem linhas gravadas no D1.`;
    return [
      `📊 *Histograma de ${tipo === 'desconto' ? 'Descontos' : 'Margem'} — ${fAlvo}* (${mes})`,
      ...rows.map((x) => `• *${x.faixa}*: ${R$(x.fat_bruto)} (${N(x.itens)} itens) · MC *${pct1(x.margem_pct)}* (${R$(x.margem_rs)})`),
      '',
      SUGESTAO + 'atacar as faixas acima de 10% de desconto onde a MC caiu abaixo de 18%.',
      await posFooter(db, mes)
    ].join('\n');
  }

  let totRow = null, subRows = [];
  try {
    if (E.nacional) {
      totRow = await db.prepare("SELECT * FROM gerot_dre_mes WHERE mes = ? AND filial = 'BRASIL' AND nivel = 'brasil' LIMIT 1").bind(mes).first();
      subRows = (await db.prepare("SELECT cod, nome, receita_liq, cmv, bonif_custo, comissao, mc_rs, mc_pct FROM gerot_dre_mes WHERE mes = ? AND nivel = 'filial' ORDER BY mc_rs DESC").bind(mes).all()).results || [];
    } else if (!E.supervisor && !E.grupo && esc.fils.length === 1) {
      totRow = await db.prepare("SELECT * FROM gerot_dre_mes WHERE mes = ? AND filial = ? AND nivel = 'filial' LIMIT 1").bind(mes, esc.fils[0]).first();
      subRows = (await db.prepare("SELECT cod, nome, receita_liq, cmv, bonif_custo, comissao, mc_rs, mc_pct FROM gerot_dre_mes WHERE mes = ? AND filial = ? AND nivel = 'supervisor' ORDER BY mc_rs DESC").bind(mes, esc.fils[0]).all()).results || [];
    } else if (E.supervisor) {
      const sups = [...new Set((E.vend || []).map((v) => String(v.sup_cod || v.supCod || '')).filter(Boolean))];
      if (sups.length) {
        totRow = await db.prepare(`SELECT * FROM gerot_dre_mes WHERE mes = ? AND filial = ? AND nivel = 'supervisor' AND cod IN (${qs(sups)}) LIMIT 1`).bind(mes, esc.fils[0], ...sups).first();
      }
      const rcas = [...new Set((E.vend || []).map((v) => String(v.rca)).filter(Boolean))];
      if (rcas.length) {
        subRows = (await db.prepare(`SELECT cod, nome, receita_liq, mc_rs, mc_pct FROM gerot_dre_mes WHERE mes = ? AND filial = ? AND nivel = 'vendedor' AND cod IN (${qs(rcas)}) ORDER BY mc_rs DESC`).bind(mes, esc.fils[0], ...rcas).all()).results || [];
      }
    }
  } catch { totRow = null; }

  if (!totRow) return `📉 *DRE Performance — ${onde} (${mes})*\nDRE ainda não carregada para este escopo no D1.`;
  return [
    `📊 *DRE Performance & Margem — ${onde}* (${mes})`,
    `• Fat. bruto: ${R$(totRow.fat_bruto)} · Devol.: −${R$(totRow.devolucao)}`,
    `• Receita líquida: *${R$(totRow.receita_liq)}*`,
    `• CMV: ${R$(totRow.cmv)} · Bonif.: ${R$(totRow.bonif_custo)} · Comissões: ${R$(totRow.comissao)}`,
    `• *Margem de Contribuição: ${R$(totRow.mc_rs)} (${pct1(totRow.mc_pct)})*`,
    totRow.desconto_rs != null ? `• Descontos totais: ${R$(totRow.desconto_rs)} (${pct1(totRow.desc_pct)}) · Política ${R$(totRow.desc_politica)} / Comercial ${R$(totRow.desc_comercial)}` : '',
    ...(subRows.length ? ['', `*${E.nacional ? 'Por filial' : E.supervisor ? 'Por vendedor' : 'Por supervisor'}:*`, ...subRows.slice(0, 6).map((s, i) => `${i + 1}. *${titulo(s.nome).slice(0, 26)}*: ${R$(s.mc_rs)} (*${pct1(s.mc_pct)}*)`)] : []),
    '',
    SUGESTAO + 'peça *"curva negativa de margem"* para ver os pedidos faturados no prejuízo.',
    await posFooter(db, mes)
  ].filter(Boolean).join('\n');
}

// 4) CURVA NEGATIVA DE MARGEM
export async function respCurvaNegMargem(B, E, c, t) {
  if (ehBloqGerencial(c, E)) return bloqueioMsg('Curva Negativa de Margem');
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const mes = await mesOuUltimo(db, 'gerot_curva_neg_margem');
  const esc = escopoWhere(E, c, { temRca: true, temSup: true });
  const onde = E.nacional ? 'Brasil' : esc.fils.join(', ');

  let rows = [];
  try {
    rows = (await db.prepare(`SELECT filial, pedido, nf, data, rca, vendedor, cliente, itens, fat_bruto, desconto_pct, custo, margem_rs, margem_pct, margem_perdida FROM gerot_curva_neg_margem WHERE mes = ? AND ${esc.sql} ORDER BY margem_rs ASC LIMIT 200`).bind(mes, ...esc.bind).all()).results || [];
  } catch { rows = []; }
  if (!rows.length) {
    return [
      `📉 *Curva Negativa de Margem — ${onde}* (${mes})`,
      'Nenhum pedido faturado com margem negativa registrado neste recorte.',
      '',
      '_Obs.: esta é a Curva Negativa de Margem (pedidos com prejuízo). Para clientes sem compra no mês, peça "curva negativa de clientes" ou "quem falta positivar"._',
      await posFooter(db, mes)
    ].join('\n');
  }

  const totPerd = rows.reduce((s, r) => s + (Number(r.margem_rs) || 0), 0);
  const totFat = rows.reduce((s, r) => s + (Number(r.fat_bruto) || 0), 0);
  return [
    `🚨 *Curva Negativa de Margem — ${onde}* (${mes})`,
    `Pedidos faturados com prejuízo: *${N(rows.length)}* · Fat. bruto: ${R$(totFat)} · *Margem negativa: ${R$(totPerd)}*`,
    '',
    '*Piores pedidos:*',
    ...rows.slice(0, 6).map((x, i) => `${i + 1}. [${x.filial}] Ped. *${x.pedido}* · ${titulo(x.cliente).slice(0, 22)} · ${titulo(x.vendedor).slice(0, 14)} · Desc. ${pct1(x.desconto_pct)} · *${R$(x.margem_rs)}* (${pct1(x.margem_pct)})`),
    '',
    '_Obs.: esta é a Curva Negativa de Margem (pedidos faturados com prejuízo). Para clientes sem compra no mês, peça "curva negativa de clientes" ou "quem falta positivar"._',
    SUGESTAO + 'travar a política comercial nos vendedores com recorrência de desconto alto.',
    await posFooter(db, mes)
  ].join('\n');
}

// 5) RFV
export async function respRfv(B, E, c, t) {
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const mes = await mesOuUltimo(db, 'gerot_rfv_resumo');
  const esc = escopoWhere(E, c, { temRca: true, temSup: true });
  const onde = ehVendedor(c, E) ? `${nome2(c.nome)} (RCA ${c.rca})` : (E.nacional ? 'Brasil' : esc.fils.join(', '));

  let resumo = [], clis = [];
  try {
    resumo = (await db.prepare(`SELECT segmento, SUM(clientes) clis, SUM(valor_120d) v120 FROM gerot_rfv_resumo WHERE mes = ? AND ${esc.sql} GROUP BY segmento ORDER BY v120 DESC`).bind(mes, ...esc.bind).all()).results || [];
    const escC = escopoWhere(E, c, { temRca: true, temSup: true });
    clis = (await db.prepare(`SELECT filial, cliente, nome, segmento, dias_sem_compra, valor_120d, rca FROM gerot_rfv_clientes WHERE mes = ? AND ${escC.sql} ORDER BY CASE WHEN segmento LIKE 'Em risco%' THEN 0 ELSE 1 END, valor_120d DESC LIMIT 25`).bind(mes, ...escC.bind).all()).results || [];
  } catch { resumo = []; }

  if (!resumo.length) return `🎯 *Matriz RFV — ${onde} (${mes})*\nBase RFV ainda não carregada para este escopo no D1 (roda no Tier 3).`;
  const totC = resumo.reduce((s, x) => s + (Number(x.clis) || 0), 0);
  const totV = resumo.reduce((s, x) => s + (Number(x.v120) || 0), 0);
  const riscoCli = (/CAMPE/.test(t) ? clis.filter((x) => /Campe/i.test(x.segmento)) : clis.filter((x) => /risco/i.test(x.segmento))).slice(0, 5);

  return [
    `🎯 *Matriz RFV (120 dias) — ${onde}* (${mes})`,
    `Base: *${N(totC)} clientes* · Faturamento 120d: *${R$(totV)}*`,
    '',
    '*Segmentos:*',
    ...resumo.slice(0, 7).map((x) => `• *${x.segmento}*: ${N(x.clis)} cli. · ${R$(x.v120)} (${P(x.v120, totV)})`),
    ...(riscoCli.length ? ['', `*Prioridade (${/CAMPE/.test(t) ? 'Campeões' : 'Em risco, alto valor'}):*`, ...riscoCli.map((x, i) => `${i + 1}. *${titulo(x.nome).slice(0, 26)}* (#${x.cliente}) · ${x.dias_sem_compra}d sem compra · ${R$(x.valor_120d)}`)] : []),
    '',
    SUGESTAO + 'blindar primeiro os clientes *Em risco, alto valor* antes que passem de 120 dias.',
    await posFooter(db, mes)
  ].join('\n');
}

// 6) PMI
export async function respPmi(B, E, c) {
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const mes = await mesOuUltimo(db, 'gerot_pmi_mes');
  const onde = ehVendedor(c, E) ? `${nome2(c.nome)} (RCA ${c.rca})` : (E.nacional ? 'Brasil' : E.filiais.join(', '));
  let tot = null, subs = [];
  try {
    if (ehVendedor(c, E)) {
      tot = await db.prepare("SELECT SUM(ja_compra) ja_compra, SUM(reativar) reativar, SUM(recuperar) recuperar, SUM(aumentar_mix) aumentar_mix, SUM(desenvolver_share) desenvolver_share, SUM(abrir_novos) abrir_novos, SUM(potencial_total) potencial_total, SUM(clientes_ativos) clientes_ativos FROM gerot_pmi_mes WHERE mes = ? AND filial = ? AND nivel = 'vendedor' AND cod = ?").bind(mes, c.filial, String(c.rca)).first();
    } else if (E.supervisor) {
      const sups = [...new Set((E.vend || []).map((v) => String(v.sup_cod || v.supCod || '')).filter(Boolean))];
      if (sups.length) tot = await db.prepare(`SELECT SUM(ja_compra) ja_compra, SUM(reativar) reativar, SUM(recuperar) recuperar, SUM(aumentar_mix) aumentar_mix, SUM(desenvolver_share) desenvolver_share, SUM(abrir_novos) abrir_novos, SUM(potencial_total) potencial_total, SUM(clientes_ativos) clientes_ativos FROM gerot_pmi_mes WHERE mes = ? AND filial = ? AND nivel = 'supervisor' AND cod IN (${qs(sups)})`).bind(mes, E.filiais[0], ...sups).first();
    } else if (E.nacional) {
      tot = await db.prepare("SELECT * FROM gerot_pmi_mes WHERE mes = ? AND filial = 'BRASIL' AND nivel = 'brasil' LIMIT 1").bind(mes).first();
      subs = (await db.prepare("SELECT filial cod, potencial_total, ja_compra FROM gerot_pmi_mes WHERE mes = ? AND nivel = 'filial' ORDER BY potencial_total DESC LIMIT 5").bind(mes).all()).results || [];
    } else {
      tot = await db.prepare(`SELECT SUM(ja_compra) ja_compra, SUM(reativar) reativar, SUM(recuperar) recuperar, SUM(aumentar_mix) aumentar_mix, SUM(desenvolver_share) desenvolver_share, SUM(abrir_novos) abrir_novos, SUM(potencial_total) potencial_total, SUM(clientes_ativos) clientes_ativos FROM gerot_pmi_mes WHERE mes = ? AND nivel = 'filial' AND filial IN (${qs(E.filiais)})`).bind(mes, ...E.filiais).first();
    }
  } catch { tot = null; }
  if (!tot || !(Number(tot.potencial_total) > 0 || Number(tot.ja_compra) > 0)) return `💡 *PMI (Potencial de Mercado) — ${onde} (${mes})*\nAinda sem dados PMI gravados no D1 (Tier 3).`;
  return [
    `💡 *PMI (Potencial de Mercado) — ${onde}* (${mes})`,
    `Base: ${N(tot.clientes_ativos)} clientes · Já compra (média): *${R$(tot.ja_compra)}* · 🚀 *Potencial extra: ${R$(tot.potencial_total)}*`,
    '',
    '*Alavancas:*',
    `• 🔁 Recuperar (31–90d): ${R$(tot.recuperar)} · Reativar (>90d): ${R$(tot.reativar)}`,
    `• 📦 Aumentar Mix: ${R$(tot.aumentar_mix)} · Desenvolver Share: ${R$(tot.desenvolver_share)}`,
    tot.abrir_novos > 0 ? `• 🆕 Abrir novos: ${R$(tot.abrir_novos)}` : '',
    ...(subs.length ? ['', '*Maior potencial por filial:*', ...subs.map((x, i) => `${i + 1}. *${x.cod}*: +${R$(x.potencial_total)} (base ${R$(x.ja_compra)})`)] : []),
    '',
    SUGESTAO + 'atacar primeiro *Recuperar* e *Aumentar Mix* nos clientes ativos.',
    await posFooter(db, mes)
  ].filter(Boolean).join('\n');
}

// 7) CADASTRO DE CLIENTES
export async function respCadastroClientes(B, E, c) {
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const mes = await mesOuUltimo(db, 'gerot_cadastro_clientes');
  const onde = ehVendedor(c, E) ? `${nome2(c.nome)} (RCA ${c.rca})` : (E.nacional ? 'Brasil' : E.filiais.join(', '));
  let tot = null, subs = [];
  try {
    if (ehVendedor(c, E)) {
      tot = await db.prepare("SELECT SUM(cadastrados) cadastrados, SUM(cadastrados_dia) cadastrados_dia, SUM(ja_compraram) ja_compraram, SUM(bloqueados) bloqueados, SUM(excluidos) excluidos, SUM(saldo) saldo FROM gerot_cadastro_clientes WHERE mes = ? AND filial = ? AND rca = ?").bind(mes, c.filial, String(c.rca)).first();
    } else if (E.nacional) {
      tot = await db.prepare("SELECT * FROM gerot_cadastro_clientes WHERE mes = ? AND filial = 'BRASIL' AND sup_cod = '' AND rca = '' LIMIT 1").bind(mes).first();
      subs = (await db.prepare("SELECT filial, cadastrados, ja_compraram, bloqueados, saldo FROM gerot_cadastro_clientes WHERE mes = ? AND filial <> 'BRASIL' AND sup_cod = '' AND rca = '' ORDER BY saldo DESC LIMIT 6").bind(mes).all()).results || [];
    } else {
      tot = await db.prepare(`SELECT SUM(cadastrados) cadastrados, SUM(cadastrados_dia) cadastrados_dia, SUM(ja_compraram) ja_compraram, SUM(bloqueados) bloqueados, SUM(excluidos) excluidos, SUM(saldo) saldo FROM gerot_cadastro_clientes WHERE mes = ? AND sup_cod = '' AND rca = '' AND filial IN (${qs(E.filiais)})`).bind(mes, ...E.filiais).first();
    }
  } catch { tot = null; }
  if (!tot || tot.cadastrados == null) return `📝 *Cadastro de Clientes — ${onde} (${mes})*\nSem movimentos de cadastro no D1 ainda.`;
  const taxa1 = tot.cadastrados > 0 ? tot.ja_compraram / tot.cadastrados : 0;
  return [
    `📝 *Cadastro de Clientes — ${onde}* (${mes})`,
    `• Novos cadastros: *${N(tot.cadastrados)}*` + (tot.cadastrados_dia ? ` (${N(tot.cadastrados_dia)} na última data)` : ''),
    `• Já compraram: *${N(tot.ja_compraram)}* (${pct1(taxa1)})`,
    `• Bloqueados: ${N(tot.bloqueados)} · Excluídos: ${N(tot.excluidos)} · *Saldo: ${tot.saldo >= 0 ? '+' : '−'}${N(Math.abs(tot.saldo))}*`,
    ...(subs.length ? ['', '*Saldo por filial:*', ...subs.map((x, i) => `${i + 1}. *${x.filial}*: +${N(x.cadastrados)} cad. (${N(x.ja_compraram)} c/ 1ª compra) · saldo ${x.saldo >= 0 ? '+' : ''}${N(x.saldo)}`)] : []),
    '',
    SUGESTAO + 'acompanhar os novos cadastrados que ainda não têm 1ª compra registrada.',
    await posFooter(db, mes)
  ].join('\n');
}

// 8) CLIVEN (APROVEITAMENTO DE CARTEIRA)
export async function respCliven(B, E, c) {
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const mes = await mesOuUltimo(db, 'gerot_cliven_resumo');
  const esc = escopoWhere(E, c, { temRca: true, temSup: true, supCol: 'cod_sup' });
  const onde = ehVendedor(c, E) ? `${nome2(c.nome)} (RCA ${c.rca})` : (E.nacional ? 'Brasil' : esc.fils.join(', '));
  let tot = null, rows = [];
  try {
    tot = await db.prepare(`SELECT COUNT(DISTINCT filial||'|'||rca) setor, SUM(clientes_carteira) cart, SUM(clientes_ativos) ativos, SUM(clientes_bloq) bloq, SUM(positivados) pos, SUM(fat_mes) fat FROM gerot_cliven_resumo WHERE mes = ? AND ${esc.sql}`).bind(mes, ...esc.bind).first();
    rows = (await db.prepare(`SELECT filial, rca, vendedor, clientes_ativos, positivados, aproveitamento_pct, fat_mes FROM gerot_cliven_resumo WHERE mes = ? AND ${esc.sql} AND clientes_ativos >= 15 ORDER BY aproveitamento_pct ASC LIMIT 5`).bind(mes, ...esc.bind).all()).results || [];
  } catch { tot = null; }
  if (!tot || !(Number(tot.cart) > 0)) return `📒 *Cliven (Carteira Oficial) — ${onde} (${mes})*\nAinda sem dados do Cliven gravados no D1 (Tier 2).`;
  return [
    `📒 *Cliven (Aproveitamento da Carteira) — ${onde}* (${mes})`,
    `Setores: *${N(tot.setor)}* · Carteira: *${N(tot.cart)}* cli. (Ativos ${N(tot.ativos)} · Bloq. ${N(tot.bloq)})`,
    `Positivados: *${N(tot.pos)}* (${P(tot.pos, tot.ativos)} dos ativos) · Fat. mês: ${R$(tot.fat)}`,
    ...(rows.length && !ehVendedor(c, E) ? ['', '*Menores aproveitamentos (ativos >= 15):*', ...rows.map((x, i) => `${i + 1}. [${x.filial}] *${x.rca} - ${nome2(x.vendedor)}*: ${N(x.positivados)}/${N(x.clientes_ativos)} (*${pct1(x.aproveitamento_pct)}*)`)] : []),
    '',
    SUGESTAO + 'cobrar os vendedores com menor aproveitamento da carteira ativa.',
    await posFooter(db, mes)
  ].join('\n');
}

// 9) VISÃO CAMPO GEROT
export async function respCampoGerot(B, E, c) {
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const mes = await mesOuUltimo(db, 'gerot_campo_mes');
  const esc = escopoWhere(E, c, { temRca: false });
  const onde = E.nacional ? 'Brasil' : esc.fils.join(', ');
  let rows = [];
  try {
    const nivel = E.nacional ? 'filial' : (ehVendedor(c, E) ? 'vendedor' : 'filial');
    const extraSql = ehVendedor(c, E) ? ` AND cod = ?` : '';
    const bind = ehVendedor(c, E) ? [mes, nivel, ...esc.bind, String(c.rca)] : [mes, nivel, ...esc.bind];
    rows = (await db.prepare(`SELECT filial, cod, nome, eficiencia_pct, eficacia_pct, hora_checkin, hora_checkout, min_visita, min_rota, hora_ped1, cobertura_pdv_pct, carteira_visitada_pct, gerado_em FROM gerot_campo_mes WHERE mes = ? AND nivel = ? AND ${esc.sql}${extraSql} ORDER BY eficacia_pct DESC LIMIT 12`).bind(...bind).all()).results || [];
  } catch { rows = []; }
  if (!rows.length) {
    return [
      `🚗 *Visão Campo (GEROT · Synapse) — ${onde}* (${mes})`,
      'O bloco *Visão Campo* não estava conectado dentro do arquivo atual do painel GEROT.',
      '👉 Para check-in e visitas em tempo real hoje, peça *"visitas"* ou *"gestão de campo"*!'
    ].join('\n');
  }
  const fPct = (v) => (v == null ? '—' : `${((Number(v) <= 2 ? Number(v) * 100 : Number(v))).toFixed(1).replace('.', ',')}%`);
  return [
    `🚗 *Visão Campo (GEROT · Synapse) — ${onde}* (${mes})`,
    ...rows.slice(0, 8).map((x) => `• *${x.nome || x.filial}*: Efic. ${fPct(x.eficacia_pct)} · Efic.rota ${fPct(x.eficiencia_pct)} · 1º ck ${x.hora_checkin || '—'} · Visita ${x.min_visita || '—'}m`),
    '',
    await posFooter(db, mes)
  ].join('\n');
}

// 10) JBP POR SKU
export async function respJbpSku(B, E, c, t) {
  if (ehBloqGerencial(c, E)) return bloqueioMsg('JBP por SKU');
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const mes = await mesOuUltimo(db, 'gerot_jbp_sku');
  const esc = escopoWhere(E, c, { temRca: false });
  const onde = E.nacional ? 'Brasil' : esc.fils.join(', ');
  const termo = extraiIndustriaTexto(t);
  let rows = [];
  try {
    const filtroInd = termo ? ' AND UPPER(fornecedor) LIKE ?' : '';
    const bind = termo ? [mes, ...esc.bind, `%${termo}%`] : [mes, ...esc.bind];
    const order = /QUEDA|CAIU|PERD|PIOR/.test(t) ? 'delta_m1 ASC' : 'fat_liq DESC';
    rows = (await db.prepare(`SELECT filial, fornecedor, sku, produto, fat_liq, fat_m1, delta_m1, pos FROM gerot_jbp_sku WHERE mes = ? AND ${esc.sql}${filtroInd} ORDER BY ${order} LIMIT 8`).bind(...bind).all()).results || [];
  } catch { rows = []; }
  if (!rows.length) return `📈 *JBP por SKU — ${onde} (${mes})*\nAinda sem linhas de SKU gravadas${termo ? ` para "${termo}"` : ''} no D1 (Tier 3).`;
  return [
    `📈 *JBP por SKU (${/QUEDA|CAIU|PERD|PIOR/.test(t) ? 'Maiores quedas vs M-1' : 'Top Faturamento'}) — ${onde}* (${mes})`,
    ...rows.map((x, i) => `${i + 1}. [${x.filial}] *${titulo(x.produto).slice(0, 28)}* (#${x.sku}): ${R$(x.fat_liq)} (Δ M-1 ${x.delta_m1 >= 0 ? '+' : '−'}${R$(Math.abs(x.delta_m1 || 0))}) · ${N(x.pos)} cli.`),
    '',
    SUGESTAO + 'atacar os SKUs líderes em queda vs M-1 junto ao fornecedor.',
    await posFooter(db, mes)
  ].join('\n');
}

// 11) TMF (TEMPO MÉDIO DE FATURAMENTO)
export async function respTmf(B, E, c) {
  const db = B && B.env && B.env.DB;
  if (!db) return null;
  const mes = await mesOuUltimo(db, 'gerot_filial_mes');
  const esc = escopoWhere(E, c, { temRca: false });
  const onde = E.nacional ? 'Brasil' : esc.fils.join(', ');
  let rows = [];
  try {
    rows = (await db.prepare(`SELECT filial, json_extract(dados, '$."TMF (dias)"') tmf, json_extract(dados, '$."Pedidos faturados"') peds FROM gerot_filial_mes WHERE mes = ? AND ${esc.sql}`).bind(mes, ...esc.bind).all()).results || [];
  } catch { rows = []; }
  const ok = rows.filter((x) => x.tmf != null && Number.isFinite(Number(x.tmf))).sort((a, b) => Number(b.tmf) - Number(a.tmf));
  if (!ok.length) return `⏱️ *TMF (Tempo Médio de Faturamento) — ${onde} (${mes})*\nO campo TMF ainda não foi populado na carga atual de \`gerot_filial_mes\`.`;
  const somaPed = ok.reduce((s, x) => s + (Number(x.peds) || 1), 0);
  const med = ok.reduce((s, x) => s + Number(x.tmf) * (Number(x.peds) || 1), 0) / (somaPed || 1);
  return [
    `⏱️ *TMF (Pedido → Faturamento) — ${onde}* (${mes})`,
    `Média ponderada: *${med.toFixed(2).replace('.', ',')} dias*`,
    '',
    ...ok.map((x, i) => `${i + 1}. *${x.filial}*: *${Number(x.tmf).toFixed(2).replace('.', ',')} dias* (${N(x.peds)} ped.)`),
    '',
    SUGESTAO + 'investigar bloqueios de crédito/logística na filial com maior TMF.',
    await posFooter(db, mes)
  ].join('\n');
}
