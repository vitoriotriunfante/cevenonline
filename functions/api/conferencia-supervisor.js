// FICHA: conferência do digitado de hoje POR SUPERVISOR e por RCA (só leitura, da base varredura_central_rca) para comparar com o Clube da Venda,
// que agrupa por supervisor/coordenador. Uso: /api/conferencia-supervisor?filial=TPH   (sem 'filial' = todas). Nunca grava.
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: CORS });
  const filial = (new URL(request.url).searchParams.get('filial') || '').toUpperCase();
  const { results } = await env.DB.prepare(
    `SELECT v.filial_sigla AS filial, v.rca_codigo AS rca, a.sup_nome AS sup, a.nome AS nome,
            CAST(COALESCE(json_extract(v.produtividade_json, '$.dia.dig_pedido'), 0) AS REAL) AS dig,
            (v.produtividade_json IS NULL OR v.produtividade_json = 'null') AS sem_prod,
            CAST((julianday('now') - julianday(v.updated_at)) * 86400 AS INTEGER) AS idade_s
       FROM varredura_central_rca v
       JOIN arvore_supervisores a ON a.rca = v.rca_codigo AND a.filial = v.filial_sigla
      WHERE v.data_ref = ? ${filial ? 'AND v.filial_sigla = ?' : ''}`
  ).bind(...(filial ? [hojeSP(), filial] : [hojeSP()])).all();
  const sups = {};
  for (const r of results || []) {
    const k = `${r.filial}|${r.sup}`;
    const s = sups[k] || (sups[k] = { filial: r.filial, supervisor: r.sup, rcas: 0, digitado: 0, sem_prod: 0, idade_max_s: 0, vendedores: [] });
    s.rcas++; s.digitado += r.dig || 0; s.sem_prod += r.sem_prod ? 1 : 0; s.idade_max_s = Math.max(s.idade_max_s, r.idade_s || 0);
    s.vendedores.push({ rca: r.rca, nome: r.nome, dig: Math.round((r.dig || 0) * 100) / 100, idade_s: r.idade_s });
  }
  const lista = Object.values(sups).map((s) => ({ ...s, digitado: Math.round(s.digitado * 100) / 100 })).sort((a, b) => b.digitado - a.digitado);
  return new Response(JSON.stringify({ data_ref: hojeSP(), supervisores: lista }), { headers: CORS });
}
