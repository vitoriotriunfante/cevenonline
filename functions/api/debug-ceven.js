// =========================================================================
// FICHA DO ARQUIVO: functions/api/debug-ceven.js
// O QUE É: diagnóstico SÓ LEITURA da trava (429) do CEVEN a partir do Cloudflare (de onde a coleta roda). Faz N chamadas SEQUENCIAIS a /api/rca/produtividade com
//          pausa configurável e devolve status, tempo e Retry-After de cada uma. Serve para medir a cota real por janela. Máximo 30 chamadas.
// USO:     GET /api/debug-ceven?n=12&pausa_ms=0[&filial=tbl1&id=186]
// =========================================================================
import { CEVEN_HDR } from '../_lib/ceven_auth.js';
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
export async function onRequestGet({ request }) {
  const u = new URL(request.url);
  const n = Math.min(30, Math.max(1, Number(u.searchParams.get('n')) || 10)), pausa = Math.min(5000, Number(u.searchParams.get('pausa_ms')) || 0);
  const filial = (u.searchParams.get('filial') || 'tbl1').toLowerCase(), base = Number(u.searchParams.get('id')) || 186;
  const out = [], t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const ini = Date.now();
    try {
      const r = await fetch(`${CEVEN}/api/rca/produtividade?filial=${filial}&id=${base + (i % 7)}`, { headers: CEVEN_HDR, signal: AbortSignal.timeout(15000) });
      await r.text();
      out.push({ i, http: r.status, ms: Date.now() - ini, retry_after: r.headers.get('retry-after') });
    } catch (e) { out.push({ i, http: 0, ms: Date.now() - ini, erro: String(e.message || e).slice(0, 60) }); }
    if (pausa) await new Promise((res) => setTimeout(res, pausa));
  }
  return new Response(JSON.stringify({ n, pausa_ms: pausa, total_ms: Date.now() - t0, ok: out.filter((x) => x.http === 200).length, r429: out.filter((x) => x.http === 429).length, chamadas: out }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
