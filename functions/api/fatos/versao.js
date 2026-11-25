// =========================================================================
// FATOS · functions/api/fatos/versao.js (GET /api/fatos/versao)
// O QUE É: endpoint leve (cache Edge 10s) com carga_id, mes e posicao ativos do GEROT.
// Permite que paineis e TVs saibam quando houve nova carga aprovada pelo Portao Contabil.
// =========================================================================
const CORS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=10'
};

export async function onRequestGet({ env }) {
  if (!env || !env.DB) {
    return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: CORS });
  }
  try {
    const f = await env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'gerot_versao_ativa'").first().catch(() => null);
    if (f && f.valor) {
      try {
        const j = JSON.parse(f.valor);
        if (j && j.carga_id) return new Response(JSON.stringify(j), { headers: CORS });
      } catch {}
    }
    const st = await env.DB.prepare('SELECT id, mes, posicao, em FROM gerot_coleta_status ORDER BY id DESC LIMIT 1').first().catch(() => null);
    return new Response(JSON.stringify({
      carga_id: st ? String(st.id) : null,
      mes: st ? st.mes : null,
      posicao: st ? st.posicao : null,
      gerado_em: st ? st.em : null
    }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e && e.message || e).slice(0, 160) }), { status: 500, headers: CORS });
  }
}
