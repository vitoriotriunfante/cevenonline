export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const filial = url.searchParams.get('filial');

  try {
    if (env && env.DB) {
      let query = 'SELECT r.*, UPPER(COALESCE(f.nome, f.codigo, r.filial_id)) as filial FROM representantes r LEFT JOIN filiais f ON r.filial_id = f.id';
      let params = [];
      if (filial && filial !== 'TODAS') {
        const fClean = filial.replace('1', '').toUpperCase();
        query += ' WHERE UPPER(r.filial_id) IN (?, ?, ?) OR UPPER(f.codigo) IN (?, ?, ?) OR UPPER(f.nome) IN (?, ?, ?)';
        params.push(fClean, fClean + '1', filial.toUpperCase(), fClean, fClean + '1', filial.toUpperCase(), fClean, fClean + '1', filial.toUpperCase());
      }
      query += ' ORDER BY r.nome';
      const { results } = await env.DB.prepare(query).bind(...params).all();
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
