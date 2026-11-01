// =========================================================================
// FICHA DO ARQUIVO: functions/api/frescor.js
// O QUE E: atraso real de cada indicador, em minutos (Vitorio, 01/11/2026: "15 minutos no maximo de delay"). So leitura do D1. Conta quantos vendedores estao acima de 15 min em cada parte.
// =========================================================================
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
export async function onRequestGet({ env }) {
  const dia = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), linha = (c) => `SUM(${c} IS NULL) ${c}_nunca, SUM(${c} < datetime('now','-15 minutes')) ${c}_acima15, ROUND((julianday('now') - julianday(MIN(${c}))) * 1440) ${c}_pior_min`;
  const r = await env.DB.prepare(`SELECT COUNT(*) vendedores, ${['dash_em', 'dev_em', 'prod_em', 'roteiro_em'].map(linha).join(', ')} FROM varredura_central_rca WHERE data_ref = ?`).bind(dia).first();
  let falhas = null, cascata = null;
  try { falhas = (await env.DB.prepare("SELECT indicador, motivo, COUNT(*) vendedores, SUM(vezes) vezes, MAX(ultima) ultima FROM coleta_falhas GROUP BY indicador, motivo ORDER BY vendedores DESC").all()).results; } catch { /* tabela nasce na primeira rodada */ }
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
  return new Response(JSON.stringify({ dia, limite_min: 15, ...r, cascata, falhas, comparacao }), { headers: CORS });
}
