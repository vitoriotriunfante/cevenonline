// =========================================================================
// FICHA: functions/api/jota-entende-teste.js   (POST /api/jota-entende-teste) — SÓ PARA MEDIR, NUNCA EM PRODUÇÃO
// O QUE É: devolve a "ficha" que a IA tira de cada pergunta (functions/_lib/jota/entende_ia.js), sem dado nenhum de venda.
// TRAVA: só funciona com a variável JOTA_TESTE=1, que existe apenas no "wrangler pages dev" do computador de quem mede
//        (testes/jota_entende_ia.mjs). No site publicado a variável não existe e a rota responde 404.
// =========================================================================
import { entendePorIA } from '../_lib/jota/entende_ia.js';
export async function onRequestPost({ request, env }) {
  if (env.JOTA_TESTE !== '1') return new Response('nao encontrado', { status: 404 });
  const lista = await request.json().catch(() => []);
  const out = [];
  const L = Array.isArray(lista) ? lista.slice(0, 400) : [];
  for (let i = 0; i < L.length; i += 8) out.push(...await Promise.all(L.slice(i, i + 8).map((x) => entendePorIA(env, x.perfil || { papel: 'diretoria' }, x.texto))));
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
}
