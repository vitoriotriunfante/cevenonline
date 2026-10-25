// =========================================================================
// FICHA: functions/_lib/cache_borda.js
// O QUE É: cache de resposta para endpoints que consultam o CEVEN ao vivo (Vitório, 25/10/2026: "faça os 5" — corte de custo e de carga no CEVEN).
//   Várias TVs/telas pedindo a mesma coisa em poucos minutos = UMA consulta ao CEVEN; as demais recebem a cópia.
//   Duas camadas, ambas grátis e sem gravar nada no D1: (1) cache da borda da Cloudflare (caches.default) e (2) memória da instância.
//   Parâmetros de "quebra-cache" (t, _, ts) são ignorados na chave. ?fresco=1 sempre vai ao CEVEN.
// =========================================================================
const MEM = new Map();
export async function comCache(ctx, ttlS, handler) {
  const url = new URL(ctx.request.url);
  if (url.searchParams.has('fresco')) return handler(ctx);
  for (const k of ['t', '_', 'ts']) url.searchParams.delete(k);
  url.searchParams.sort();
  const chave = url.toString();
  const m = MEM.get(chave);
  if (m && Date.now() - m.em < ttlS * 1000) return new Response(m.corpo, { status: 200, headers: { ...m.headers, 'X-Cache': 'MEM' } });
  let cache = null; try { cache = caches.default; } catch (e) { cache = null; }
  const req = new Request(chave, { method: 'GET' });
  if (cache) { try { const hit = await cache.match(req); if (hit) { const h = Object.fromEntries(hit.headers); delete h['cache-control']; return new Response(hit.body, { status: 200, headers: { ...h, 'Cache-Control': 'no-store', 'X-Cache': 'BORDA' } }); } } catch (e) { /* segue sem cache */ } }
  // (3) D1 (25/10/2026: o cache da borda nao funciona em *.pages.dev e cada requisicao cai numa instancia diferente). 1 linha por chave a cada ttl.
  const db = ctx.env && ctx.env.DB;
  if (db) {
    try {
      await db.prepare('CREATE TABLE IF NOT EXISTS cache_resposta (chave TEXT PRIMARY KEY, corpo TEXT, tipo TEXT, em INTEGER)').run();
      const r = await db.prepare('SELECT corpo, tipo, em FROM cache_resposta WHERE chave = ?').bind(chave).first();
      if (r && Date.now() - r.em < ttlS * 1000) { MEM.set(chave, { em: r.em, corpo: r.corpo, headers: { 'Content-Type': r.tipo || 'application/json' } }); return new Response(r.corpo, { status: 200, headers: { 'Content-Type': r.tipo || 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'X-Cache': 'D1' } }); }
    } catch (e) { /* sem cache no D1: segue */ }
  }
  const res = await handler(ctx);
  if (!res || res.status !== 200) return res;
  const corpo = await res.text();
  const headers = Object.fromEntries(res.headers);
  MEM.set(chave, { em: Date.now(), corpo, headers }); if (MEM.size > 200) MEM.delete(MEM.keys().next().value);
  if (db && corpo.length < 900000) { try { await db.prepare('INSERT INTO cache_resposta (chave, corpo, tipo, em) VALUES (?,?,?,?) ON CONFLICT (chave) DO UPDATE SET corpo = excluded.corpo, tipo = excluded.tipo, em = excluded.em').bind(chave, corpo, headers['content-type'] || 'application/json', Date.now()).run(); } catch (e) { /* segue */ } }
  if (cache) { try { const p = cache.put(req, new Response(corpo, { headers: { ...headers, 'Cache-Control': `public, max-age=${ttlS}` } })); if (ctx.waitUntil) ctx.waitUntil(p); else await p; } catch (e) { /* sem cache da borda */ } }
  return new Response(corpo, { status: 200, headers: { ...headers, 'X-Cache': 'MISS' } });
}
