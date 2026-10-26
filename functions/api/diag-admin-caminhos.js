// =========================================================================
// FICHA DO ARQUIVO: functions/api/diag-admin-caminhos.js   (GET /api/diag-admin-caminhos)
// O QUE É: teste (26/10/2026, docs/BASE_UNICA.md §6.1) — o caminho de ADMIN do CEVEN (/api/admin/view-as/rca/*, cota ~100/min) serve tambem produtividade,
//   roteiro e devolucoes, ou so o dashboard? Se servir, o coletor unico sai da cota de 3-4/min do /api/rca/*.
// DEVOLVE: so o codigo HTTP, o tamanho e as chaves de cada resposta (nenhum dado de cliente, nenhum token). Cache de 10 min para nao gastar cota.
// =========================================================================
import { tokenAdmin } from '../_lib/ceven_admin_token.js';
import { CEVEN_APP_SECRET } from '../_lib/ceven_auth.js';
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const CORS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
let cache = { exp: 0, corpo: null };
export async function onRequestGet({ env, request }) {
  if (cache.corpo && Date.now() < cache.exp) return new Response(cache.corpo, { headers: CORS });
  const u = new URL(request.url), filial = (u.searchParams.get('filial') || 'tbl1').toLowerCase(), id = u.searchParams.get('id') || '171';
  const tk = await tokenAdmin(env);
  if (!tk) return new Response(JSON.stringify({ erro: 'sem token admin' }), { status: 503, headers: CORS });
  const H = { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET };
  const caminhos = ['dashboard', 'produtividade', 'roteiro-hoje', 'devolucoes', 'roteiro-mes'];
  const out = {};
  for (const c of caminhos) {
    try {
      const r = await fetch(`${CEVEN}/api/admin/view-as/rca/${c}?filial=${filial}&id=${id}`, { headers: H, signal: AbortSignal.timeout(15000) });
      const t = await r.text(); let chaves = null;
      try { const j = JSON.parse(t); chaves = Array.isArray(j) ? ['array', j.length, ...Object.keys(j[0] || {}).slice(0, 12)] : Object.keys(j || {}).slice(0, 12); } catch (e) {}
      out[c] = { status: r.status, bytes: t.length, chaves };
    } catch (e) { out[c] = { erro: String(e.message || e).slice(0, 120) }; }
  }
  cache = { exp: Date.now() + 10 * 60 * 1000, corpo: JSON.stringify({ testado_em: new Date().toISOString(), filial, id, caminhos: out }) };
  return new Response(cache.corpo, { headers: CORS });
}
