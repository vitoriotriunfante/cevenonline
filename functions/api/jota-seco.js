// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-seco.js   (POST /api/jota-seco?chave=...)
// O QUE É: pergunta SECA ao JOTA de producao — mesma resposta que a pessoa receberia (respostaPronta, com o perfil dela), SEM ENVIAR NADA e sem gravar
//   historico. Para a auditoria por papel e a bateria do plano (docs/PLANO_EXECUCAO_JOTA.md, blocos 4 e 8). Vitorio, 17/11/2026: "faca uma ultra mega
//   auditoria em tudo... vendedor / supervisor / gerente / diretor".
// ENTRADA: { contato: { nome, papel, filial, rca, grupo, celular }, perguntas: ["...", ...] } (ate 6 por chamada)
// SAIDA: [{ pergunta, resposta, ms }]. Chave: jota_admin_token (?chave=). Nao envia WhatsApp, nao grava bot_msgs.
// =========================================================================
import { respostaPronta } from '../_lib/jota/entende.js';
import { criaBase } from '../_lib/jota/fontes.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { chaveEvoValida } from '../_lib/chave_evo.js';

export async function onRequestPost({ request, env }) {
  if (!(await chaveAdminOk(env, request)) && !(await chaveEvoValida(request, env))) return new Response(JSON.stringify({ erro: 'nao autorizado' }), { status: 401 });
  const b = await request.json().catch(() => ({}));
  const c = b && b.contato; if (!c || !c.papel) return new Response(JSON.stringify({ erro: 'contato com papel obrigatorio' }), { status: 400 });
  const out = [];
  const feitas = [];   // conversa: true = cada pergunta leva as anteriores (a mais recente primeiro), como no WhatsApp
  for (const q of (Array.isArray(b.perguntas) ? b.perguntas : []).slice(0, 6)) {
    const B = criaBase(new URL(request.url).origin, env), t0 = Date.now();
    let r = null; try { r = await respostaPronta(B, { ...c }, String(q), b.conversa ? feitas.slice().reverse() : []); feitas.push(String(q)); } catch (e) { r = 'ERRO: ' + String(e && e.message || e).slice(0, 200); }
    out.push({ pergunta: q, resposta: r == null ? null : String(r), ms: Date.now() - t0 });
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
