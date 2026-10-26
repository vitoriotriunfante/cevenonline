// =========================================================================
// FICHA DO ARQUIVO: functions/api/tv-vendedores.js   (GET /api/tv-vendedores?filial=TBL&ids=12,34:AS,56&central=1)
// O QUE É: LOTE do /api/tv-vendedor (Vitório, 25/10/2026, auditoria de custo: "reveja tudo... redundâncias").
//   Antes cada TV fazia UMA requisição por vendedor a cada 90 s (40 a 100 por filial; a Matriz ~560) = o grosso das 26 milhões de
//   requisições/mês cobradas pela Cloudflare. Agora a tela pede até 30 vendedores numa chamada só; aqui dentro roda EXATAMENTE a mesma
//   função do /api/tv-vendedor (chamada direta, sem rede), então a resposta de cada vendedor é idêntica à de antes.
//   ids: lista separada por vírgula; ":AS" no fim do id = canal AS (mesmo efeito do &canal=AS).
// RESPOSTA: { filial, vendedores: { "<id>": <resposta do tv-vendedor> | null } }. Se o lote falhar, a tela volta a pedir um a um.
// =========================================================================
import { onRequestGet as umVendedor } from './tv-vendedor.js';

const MAX_IDS = 30, CONC = 6;

export async function onRequestGet(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);
  const filial = String(url.searchParams.get('filial') || '').toUpperCase().trim();
  const central = (url.searchParams.get('central') === '1' ? '&central=1' : '') + (url.searchParams.get('so_base') === '1' ? '&so_base=1' : '');   // so_base: nunca vai ao CEVEN (26/10/2026)
  const ids = String(url.searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!filial || !ids.length) return new Response(JSON.stringify({ erro: 'informe filial e ids' }), { status: 400, headers: cors });
  const out = {};
  const fila = [...ids];
  await Promise.all(Array.from({ length: Math.min(CONC, fila.length) }, async () => {
    while (fila.length) {
      const item = fila.shift();
      const [id, canal] = item.split(':');
      try {
        const req = new Request(`${url.origin}/api/tv-vendedor?filial=${filial}&id=${encodeURIComponent(id)}${central}${canal === 'AS' ? '&canal=AS' : ''}`);
        const r = await umVendedor({ ...ctx, request: req });
        out[id] = r && r.ok ? await r.json() : null;
      } catch (e) { out[id] = null; }
    }
  }));
  return new Response(JSON.stringify({ filial, vendedores: out }), { headers: cors });
}
