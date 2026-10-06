// Atualiza a árvore viva do CEVEN (supervisor -> vendedores) AGORA e devolve o resultado. ?so_se_velha=1 só renova se passou de 45 min.
// Quem chama no dia a dia é o cron-lances (garanteArvore); este endpoint serve para forçar e conferir.
import { atualizaArvore, garanteArvore } from '../_lib/arvore_ceven.js';

export async function onRequestGet({ env, request }) {
  const velha = new URL(request.url).searchParams.has('so_se_velha');
  const r = velha ? await garanteArvore(env, 45) : await atualizaArvore(env);
  return new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
}
