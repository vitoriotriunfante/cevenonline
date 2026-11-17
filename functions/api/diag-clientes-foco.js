// =========================================================================
// FICHA DO ARQUIVO: functions/api/diag-clientes-foco.js   (GET /api/diag-clientes-foco?chave=...[&gravar=1])
// O QUE É: carga das TAGs do admin 'Clientes Foco' (RECORRENCIA, campanhas de industria) para cliente_focos no D1 (Vitorio, 16/11/2026).
//   Sem gravar=1: so mostra o formato e as contagens. Com gravar=1: grava as tags ATIVAS (INSERT OR IGNORE).
// PROTECAO: chave interna (config_flags 'jota_admin_token'). Nao devolve CNPJ nem cliente.
// =========================================================================
import { cargaClientesFoco } from '../_lib/arvore_ceven.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { chaveEvoValida } from '../_lib/chave_evo.js';

export async function onRequestGet({ env, request }) {
  // chave interna OU a chave do GitHub (agendamento: madrugada + 2x ao dia — as tags mudam)
  if (!(await chaveAdminOk(env, request)) && !(await chaveEvoValida(request, env))) return new Response('nao autorizado', { status: 401 });
  const gravar = new URL(request.url).searchParams.get('gravar') === '1';
  const r = await cargaClientesFoco(env, gravar);
  return new Response(JSON.stringify({ em: new Date().toISOString(), gravar, ...r }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
