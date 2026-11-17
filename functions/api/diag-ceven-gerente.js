// =========================================================================
// FICHA DO ARQUIVO: functions/api/diag-ceven-gerente.js   (GET /api/diag-ceven-gerente?chave=...&filial=TBE)
// O QUE É: teste de conexao com o CEVEN pelo login do GERENTE, uma filial por vez (Vitorio, 16/11/2026: "o CEVEN voltou mas apenas para os gerentes...
//   faca o teste e veja se consegue conectar... uma unidade por vez"). SO LEITURA: nao grava nada; devolve status, tempo e contagens.
// PROTECAO: chave interna (config_flags 'jota_admin_token'). Nunca devolve senha nem token.
// =========================================================================
import { diagGerente } from '../_lib/arvore_ceven.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';

export async function onRequestGet({ env, request }) {
  if (!(await chaveAdminOk(env, request))) return new Response('nao autorizado', { status: 401 });
  const filial = new URL(request.url).searchParams.get('filial') || '';
  const r = await diagGerente(env, filial);
  return new Response(JSON.stringify({ em: new Date().toISOString(), ...r }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
