// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: lock compartilhado simples entre os crons que varrem RCAs no CEVEN (WhatsApp, TV
//          Executiva/mapa, faturado-mes, e futuramente CFTV/Brasileirão) — pra NUNCA rodar duas
//          varreduras completas ao mesmo tempo (achado 29/09/2026: WhatsApp atrasado + cron de
//          5min da TV rodando junto contribuiu pra derrubar o CEVEN).
// PRIORIDADE (decisão do Vitório, 29/09/2026): WhatsApp sempre tem prioridade — "o do whatsapp
//          precisa rodar pois tem que enviar os relatório... aborta os outros enquanto ele roda".
//          Os crons da TV checam o lock antes de cada varredura e pulam o ciclo se o WhatsApp
//          estiver ativo (não esperam, não enfileiram — só tentam de novo no próximo ciclo).
// USO: POST /api/cron-lock?dono=whatsapp  → grava o lock (usado pelo workflow do WhatsApp no
//          início da execução). DELETE /api/cron-lock  → libera (usado no fim, sempre, mesmo se
//          o disparo falhar). GET /api/cron-lock  → { ativo: bool, dono, idade_s }, usado pelos
//          outros crons antes de rodar.
// AUTO-LIBERAÇÃO: lock com mais de 45min é considerado travado (workflow morreu no meio) e o GET
//          já reporta ativo=false — nunca trava os outros crons pra sempre por um job preso.
// PROJETO: CFTV/TV + WhatsApp (único arquivo tocado por ambos de propósito, é um lock).
// =========================================================================

const TABELA = 'cron_lock_global';
const LIMITE_IDADE_MS = 45 * 60 * 1000; // 45min — acima do timeout do disparo (40 min, desde 07/10/2026; antes 25 min e lock de 20: o lock soltava os crons da TV no meio do disparo)

async function garantirTabela(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ${TABELA} (id INTEGER PRIMARY KEY CHECK (id = 1), dono TEXT NOT NULL, criado_em DATETIME NOT NULL)`
  ).run();
}

export async function onRequestGet({ env }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 (env.DB) não configurado' }), { status: 503, headers: cors });
  await garantirTabela(env);

  const row = await env.DB.prepare(`SELECT dono, criado_em FROM ${TABELA} WHERE id = 1`).first();
  if (!row) return new Response(JSON.stringify({ ativo: false }), { headers: cors });

  const idadeMs = Date.now() - new Date(row.criado_em + 'Z').getTime();
  const ativo = idadeMs < LIMITE_IDADE_MS;
  return new Response(JSON.stringify({ ativo, dono: row.dono, idade_s: Math.round(idadeMs / 1000) }), { headers: cors });
}

export async function onRequestPost({ env, request }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 (env.DB) não configurado' }), { status: 503, headers: cors });
  await garantirTabela(env);

  const dono = new URL(request.url).searchParams.get('dono') || 'desconhecido';
  await env.DB.prepare(
    `INSERT INTO ${TABELA} (id, dono, criado_em) VALUES (1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET dono = excluded.dono, criado_em = excluded.criado_em`
  ).bind(dono).run();
  return new Response(JSON.stringify({ status: 'TRAVADO', dono }), { headers: cors });
}

export async function onRequestDelete({ env }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 (env.DB) não configurado' }), { status: 503, headers: cors });
  await garantirTabela(env);

  await env.DB.prepare(`DELETE FROM ${TABELA} WHERE id = 1`).run();
  return new Response(JSON.stringify({ status: 'LIBERADO' }), { headers: cors });
}
