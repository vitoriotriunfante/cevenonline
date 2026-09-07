export async function onRequestGet({ env }) {
  try {
    if (env && env.DB) {
      const { results } = await env.DB.prepare('SELECT * FROM filiais ORDER BY nome').all();
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Fallback estático
    const FILIAIS_OFICIAIS = [
      { id: 'tca1', codigo: 'TCA', nome: 'TCA' },
      { id: 'mcd1', codigo: 'MCD', nome: 'MCD' },
      { id: 'tcg1', codigo: 'TCG', nome: 'TCG' },
      { id: 'tcv1', codigo: 'TCV', nome: 'TCV' },
      { id: 'abc1', codigo: 'ABC', nome: 'ABC' },
      { id: 'tbl1', codigo: 'TBL', nome: 'TBL' },
      { id: 'api1', codigo: 'API', nome: 'API' },
      { id: 'tph1', codigo: 'TPH', nome: 'TPH' },
      { id: 'tbe1', codigo: 'TBE', nome: 'TBE' },
      { id: 'tpa1', codigo: 'TPA', nome: 'TPA' },
      { id: 'tsj1', codigo: 'TSJ', nome: 'TSJ' }
    ];
    return new Response(JSON.stringify(FILIAIS_OFICIAIS), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
