// =========================================================================
// API HISTÓRICO & EVOLUÇÃO TEMPORAL CEVEN NOC
// Permite consultas analíticas retroativas por data, filial e RCA.
// =========================================================================

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const dataRef = url.searchParams.get('data');
  const dataInicio = url.searchParams.get('inicio');
  const dataFim = url.searchParams.get('fim');
  const filial = url.searchParams.get('filial');
  const rca = url.searchParams.get('rca');

  try {
    if (!env || !env.DB) {
      return new Response(JSON.stringify({ error: 'D1 não vinculado' }), { status: 500 });
    }

    // 1. Consulta consolidada por Filial (Resumo Gerencial)
    if (!rca) {
      let query = `SELECT * FROM consolidado_diario_filial WHERE 1=1`;
      const params = [];

      if (dataRef) {
        query += ` AND data_snapshot = ?`;
        params.push(dataRef);
      } else if (dataInicio && dataFim) {
        query += ` AND data_snapshot BETWEEN ? AND ?`;
        params.push(dataInicio, dataFim);
      }

      if (filial && filial !== 'TODAS') {
        query += ` AND filial_id = ?`;
        params.push(filial.toUpperCase());
      }

      query += ` ORDER BY data_snapshot DESC, total_fat_liq DESC`;

      const stmt = env.DB.prepare(query);
      const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

      return new Response(JSON.stringify({
        tipo: 'FILIAL',
        total_registros: results.length,
        dados: results
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 2. Consulta de evolução temporal de um RCA específico
    let queryRca = `
      SELECT k.*, r.nome as rep_nome, f.codigo as filial_sigla 
      FROM rca_kpis k
      JOIN representantes r ON k.rca_codigo = r.codigo
      JOIN filiais f ON k.filial_id = f.id
      WHERE k.rca_codigo = ?
    `;
    const paramsRca = [rca];

    if (dataInicio && dataFim) {
      queryRca += ` AND k.data BETWEEN ? AND ?`;
      paramsRca.push(dataInicio, dataFim);
    }

    queryRca += ` ORDER BY k.data DESC LIMIT 90`;

    const { results: histRca } = await env.DB.prepare(queryRca).bind(...paramsRca).all();

    return new Response(JSON.stringify({
      tipo: 'RCA',
      rca_codigo: rca,
      total_registros: histRca.length,
      dados: histRca
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
