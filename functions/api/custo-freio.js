// =========================================================================
// FICHA DO ARQUIVO: functions/api/custo-freio.js   (GET/POST /api/custo-freio)
// O QUE É: o FREIO DE CUSTO (Vitório, 25/10/2026: "aceito gastar até uns 20 dólares... no máximo do máximo do máximo").
//          O guarda de custo (analises/guarda_custo.js, GitHub 08h/20h) liga quando a projeção do mês passa de US$ 15 e solta abaixo de US$ 12.
//          Com o freio ligado, as rotinas da TV rodam a cada 30 min o dia todo (functions/_lib/horario_reduzido.js).
// GET: estado (público, sem dado pessoal). POST: só com X-Evo-Key = EVO_KEY (o GitHub já tem).
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
const CORS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const tabela = (db) => db.prepare('CREATE TABLE IF NOT EXISTS config_custo (chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TEXT)').run();

export async function onRequestGet({ env }) {
  await tabela(env.DB);
  const r = await env.DB.prepare("SELECT valor, atualizado_em FROM config_custo WHERE chave = 'freio'").first();
  const v = r ? JSON.parse(r.valor || '{}') : {};
  return new Response(JSON.stringify({ ligado: !!v.ligado, projecao: v.projecao ?? null, atualizado_em: r ? r.atualizado_em : null }), { headers: CORS });
}
export async function onRequestPost({ request, env }) {
  if (!(await chaveEvoValida(request, env))) return new Response('nao autorizado', { status: 401 });
  let b = {}; try { b = await request.json(); } catch (e) {}
  await tabela(env.DB);
  await env.DB.prepare("INSERT OR REPLACE INTO config_custo (chave, valor, atualizado_em) VALUES ('freio', ?, datetime('now'))").bind(JSON.stringify({ ligado: !!b.ligado, projecao: b.projecao ?? null })).run();
  return new Response(JSON.stringify({ ok: true, ligado: !!b.ligado }), { headers: CORS });
}
