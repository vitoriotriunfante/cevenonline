// =========================================================================
// API COCKPIT MATINAL — DADOS VIVOS DAS 11 FILIAIS
// Alimenta painel-gerente-matinal.html em tempo real
// =========================================================================

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const filial = (url.searchParams.get('filial') || 'TODAS').toUpperCase();

  try {
    // Busca dados compilados atualizados
    const res = await fetch(new URL('/dados_cockpit_todas_filiais_completo.json', request.url));
    if (res.ok) {
      const data = await res.json();
      if (filial !== 'TODAS' && data[filial]) {
        return new Response(JSON.stringify(data[filial]), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    return new Response(JSON.stringify({ erro: 'Dados não encontrados' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
