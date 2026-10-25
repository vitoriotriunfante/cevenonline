// Login do +MIX: confere a senha da Diretoria (EQUIPE_SENHA, com bloqueio apos 5 erros) e grava o cookie.
import { exigeSenhaEquipe } from '../_lib/senha_equipe.js';
import { marcaMix } from '../_middleware.js';

export async function onRequestPost({ request, env }) {
  const cors = { 'Content-Type': 'application/json' };
  const erro = await exigeSenhaEquipe(request, env, cors);
  if (erro) return erro;
  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Set-Cookie': `mix_ok=${await marcaMix(env)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict` } });
}
