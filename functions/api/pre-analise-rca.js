export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const rca = url.searchParams.get('id') || url.searchParams.get('rca') || '181';
    const filial = url.searchParams.get('filial');

    let query = 'SELECT * FROM pre_analises_matinais WHERE rca_codigo = ?';
    const params = [rca];

    if (filial) {
      query += ' AND filial_sigla = ?';
      params.push(filial.toUpperCase());
    }

    query += ' ORDER BY data_analise DESC LIMIT 1';

    let pre = null;
    if (env && env.DB) {
      pre = await env.DB.prepare(query).bind(...params).first();
    }

    if (!pre) {
      return new Response(JSON.stringify({ error: 'Pré-análise não encontrada para este RCA' }), { status: 404 });
    }

    return new Response(JSON.stringify(pre), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
