// =========================================================================
// FICHA DO ARQUIVO: functions/api/frescor.js
// O QUE E: atraso real de cada indicador, em minutos (Vitorio, 01/11/2026: "15 minutos no maximo de delay"). So leitura do D1. Conta quantos vendedores estao acima de 15 min em cada parte.
// =========================================================================
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
export async function onRequestGet({ env }) {
  const dia = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), linha = (c) => `SUM(${c} IS NULL) ${c}_nunca, SUM(${c} < datetime('now','-15 minutes')) ${c}_acima15, ROUND((julianday('now') - julianday(MIN(${c}))) * 1440) ${c}_pior_min`;
  const r = await env.DB.prepare(`SELECT COUNT(*) vendedores, ${['dash_em', 'dev_em', 'prod_em', 'roteiro_em'].map(linha).join(', ')} FROM varredura_central_rca WHERE data_ref = ?`).bind(dia).first();
  let falhas = null, cascata = null;
  try { falhas = (await env.DB.prepare("SELECT indicador, motivo, COUNT(*) vendedores, SUM(vezes) vezes, MAX(ultima) ultima FROM coleta_falhas WHERE ultima > datetime('now','-60 minutes') GROUP BY indicador, motivo ORDER BY vendedores DESC").all()).results; } catch { /* tabela nasce na primeira rodada */ }
  try { cascata = await env.DB.prepare("SELECT COUNT(*) filiais, SUM(atualizado_em < datetime('now','-15 minutes')) acima15, ROUND((julianday('now') - julianday(MIN(atualizado_em))) * 1440) pior_min FROM cascata_dia WHERE data_ref = ?").bind(dia).first(); } catch { /* sem cascata */ }
  // PROVA ANTES DE TROCAR A FONTE: compara a chamada do gerente com a leitura individual feita ate 5 min dela. So isso diz se os numeros sao o mesmo numero.
  let comparacao = null;
  try {
    const { results: cs } = await env.DB.prepare('SELECT filial, json, atualizado_em FROM cascata_dia WHERE data_ref = ?').bind(dia).all();
    const { results: vs } = await env.DB.prepare('SELECT filial_sigla f, rca_codigo r, produtividade_json p, prod_em FROM varredura_central_rca WHERE data_ref = ? AND prod_em IS NOT NULL').bind(dia).all();
    const em = (t) => Date.parse(String(t).replace(' ', 'T') + 'Z'), mapa = new Map(), conta = {};
    for (const c of cs || []) for (const s of JSON.parse(c.json).supervisores || []) for (const v of (s.tabelas && s.tabelas.produtividade) || []) mapa.set(c.filial + '|' + v.id, { v, t: em(c.atualizado_em) });
    const cmp = (n, a, b) => { conta[n] = conta[n] || { comparados: 0, iguais: 0 }; conta[n].comparados++; if (Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.11) conta[n].iguais++; };
    for (const x of vs || []) { const c = mapa.get(x.f + '|' + x.r); if (!c || Math.abs(c.t - em(x.prod_em)) > 300000) continue; let p = null; try { p = JSON.parse(x.p); } catch { continue; } if (!p || !p.dia || !p.mes) continue; cmp('visitas_plan_hoje', c.v.visit_plan_hoje, p.dia.total_programado); cmp('visitas_real_hoje', c.v.visit_real_hoje, p.dia.visitas_na_rota); cmp('eficacia_hoje', c.v.eficacia_hoje_pct, p.dia.eficacia_pct); cmp('visitas_plan_mes', c.v.visit_plan_mes, p.mes.visit_plan); cmp('visitas_real_mes', c.v.visit_real_mes, p.mes.visit_real); }
    comparacao = conta;
  } catch { /* sem cascata ou colunas */ }
  // ROTA: gerente x leitura individual, por vendedor, com as duas leituras a ate 5 min uma da outra.
  let rota_gerente = null;
  try {
    const { results: gs } = await env.DB.prepare('SELECT filial, json, lido_em FROM rota_gerente_dia WHERE data_ref = ?').bind(dia).all();
    const { results: vs } = await env.DB.prepare('SELECT filial_sigla f, rca_codigo r, roteiro_json j, roteiro_em e FROM varredura_central_rca WHERE data_ref = ? AND roteiro_em IS NOT NULL').bind(dia).all();
    const em = (t) => Date.parse(String(t).replace(' ', 'T') + 'Z'), por = new Map();
    let pior = 0, visitas = 0, campos = null;
    for (const g of gs || []) { pior = Math.max(pior, (Date.now() - em(g.lido_em)) / 60000); for (const x of JSON.parse(g.json)) { visitas++; campos = campos || Object.keys(x); const k = g.filial + '|' + x.id_representante, o = por.get(k) || { n: 0, t: em(g.lido_em) }; o.n++; por.set(k, o); } }
    let comparados = 0, iguais = 0;
    for (const v of vs || []) { const o = por.get(v.f + '|' + v.r); if (!o || Math.abs(o.t - em(v.e)) > 300000) continue; let a = null; try { a = JSON.parse(v.j); } catch { continue; } if (!Array.isArray(a)) continue; comparados++; if (a.length === o.n) iguais++; }
    rota_gerente = { supervisores: (gs || []).length, visitas, pior_min: Math.round(pior), vendedores: por.size, comparados, iguais, campos };
  } catch { /* tabela nasce na primeira rodada */ }
  // FINANCEIRO: painel do gerente x painel individual, leituras a ate 5 min uma da outra. Diferenca menor que R$ 1 conta como igual.
  let painel_gerente = null;
  try {
    const { results: gs } = await env.DB.prepare('SELECT filial, json, lido_em FROM painel_gerente_dia WHERE data_ref = ?').bind(dia).all();
    const { results: vs } = await env.DB.prepare('SELECT filial_sigla f, rca_codigo r, dashboard_json j, dash_em e FROM varredura_central_rca WHERE data_ref = ? AND dash_em IS NOT NULL').bind(dia).all();
    const em = (t) => Date.parse(String(t).replace(' ', 'T') + 'Z'), por = new Map(), conta = {};
    let pior = 0;
    for (const g of gs || []) { pior = Math.max(pior, (Date.now() - em(g.lido_em)) / 60000); for (const s of JSON.parse(g.json).supervisores || []) for (const x of (s.dashboard && s.dashboard.rcas) || []) por.set(g.filial + '|' + x.id, { x, t: em(g.lido_em) }); }
    const cmp = (n, a, b) => { conta[n] = conta[n] || { comparados: 0, iguais: 0 }; conta[n].comparados++; if (Math.abs((Number(a) || 0) - (Number(b) || 0)) < 1) conta[n].iguais++; };
    for (const v of vs || []) { const o = por.get(v.f + '|' + v.r); if (!o || Math.abs(o.t - em(v.e)) > 300000) continue; let d = null; try { d = JSON.parse(v.j); } catch { continue; } if (!d || !d.financeiro) continue; cmp('faturado', o.x.faturado, d.financeiro.faturado); cmp('devolucao', o.x.devolucao, d.financeiro.devolucao); cmp('pendente', o.x.pendente, d.financeiro.pendente); cmp('meta', o.x.meta_financeira, d.financeiro.meta); cmp('positivado', o.x.positivado, d.positivacao && d.positivacao.realizado); }
    painel_gerente = { filiais: (gs || []).length, vendedores: por.size, pior_min: Math.round(pior), conta };
  } catch { /* tabela nasce na primeira rodada */ }
  return new Response(JSON.stringify({ dia, limite_min: 15, ...r, cascata, falhas, comparacao, rota_gerente, painel_gerente }), { headers: CORS });
}
