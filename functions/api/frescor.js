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
  return new Response(JSON.stringify({ dia, limite_min: 15, ...r, cascata, falhas }), { headers: CORS });
}
