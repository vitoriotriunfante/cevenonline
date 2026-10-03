// Confere a senha unica da Diretoria (a mesma da aprovacao) para entrar na Gestao de Equipe.
import { exigeSenhaEquipe } from '../_lib/senha_equipe.js';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Equipe-Senha',
  'Cache-Control': 'no-store'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const negado = await exigeSenhaEquipe(request, env, CORS);
  if (negado) return negado;
  return new Response(JSON.stringify({ sucesso: true }), { status: 200, headers: CORS });
}
