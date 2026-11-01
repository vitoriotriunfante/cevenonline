// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-ficha.js
// O QUE E: teste do motor por ficha do JOTA (01/11/2026). Recebe uma pergunta e devolve a ficha que a IA preencheu e a conferida. Sem numero, sem banco e sem envio. Limite por instancia para nao gastar cota.
// =========================================================================
import { fichaPorIA } from '../_lib/jota/motor_ficha.js';
const CORS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
let usos = 0;
export async function onRequestGet({ request, env }) {
  const q = (new URL(request.url).searchParams.get('q') || '').slice(0, 300);
  if (!q) return new Response(JSON.stringify({ erro: 'q obrigatorio' }), { status: 400, headers: CORS });
  if (++usos > 500) return new Response(JSON.stringify({ erro: 'limite desta instancia' }), { status: 429, headers: CORS });
  return new Response(JSON.stringify((await fichaPorIA(env, q)) || { erro: 'ia sem resposta' }), { headers: CORS });
}
