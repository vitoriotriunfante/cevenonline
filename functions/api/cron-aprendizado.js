// =========================================================================
// API: GET/POST /api/cron-aprendizado
// Agente 1 — Curador & Aprendizado Contínuo do JOTA.
// Disparado pelo worker-cron às 19h15 BRT (seg-sex, sem feriados) ou manual.
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
import { executarCuradoriaAprendizado, carregarContextoAprendido } from '../_lib/jota/aprendizado.js';

const j = (obj, st = 200) => new Response(JSON.stringify(obj, null, 2), {
  status: st,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

async function autorizado(request, env) {
  const u = new URL(request.url);
  const k = u.searchParams.get('k') || request.headers.get('X-Cron-Key') || '';
  if (env.MONITORIA_CRON_KEY && k === env.MONITORIA_CRON_KEY) return true;
  if (env.BOT_WEBHOOK_KEY && k === env.BOT_WEBHOOK_KEY) return true;
  return await chaveEvoValida(request, env);
}

export async function onRequestGet({ request, env }) {
  if (!(await autorizado(request, env))) return j({ ok: false, erro: 'nao autorizado' }, 401);
  const u = new URL(request.url);
  if (u.searchParams.get('listar') === '1') {
    const ctx = await carregarContextoAprendido(env.DB, 20);
    return j({ ok: true, aprendizados: ctx });
  }
  const enviar = u.searchParams.get('enviar') !== '0';
  const forcar = u.searchParams.get('forcar') === '1';
  const res = await executarCuradoriaAprendizado(env, { enviar, forcar });
  return j(res);
}

export async function onRequestPost({ request, env }) {
  return onRequestGet({ request, env });
}
