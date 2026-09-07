export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const filial = url.searchParams.get('filial');
    const rca = url.searchParams.get('rca');

    let query = 'SELECT * FROM anomalias_roteiro_auditoria WHERE 1=1';
    const params = [];

    if (filial) {
      query += ' AND filial_sigla = ?';
      params.push(filial.toUpperCase());
    }

    if (rca) {
      query += ' AND rca_codigo = ?';
      params.push(rca);
    }

    query += ' ORDER BY diferenca DESC, rca_nome ASC';

    let results = [];
    if (env && env.DB) {
      const stmt = env.DB.prepare(query);
      const res = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
      results = res.results || [];
    }

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
