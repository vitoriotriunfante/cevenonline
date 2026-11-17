// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-auditoria.js
// O QUE É: guarda e mostra as AUDITORIAS POR PAPEL do JOTA (testes/auditoria_papeis.mjs, manual ou .github/workflows/jota-auditoria.yml 06h30 e 13h).
//   O relatorio tem nome de cliente e valores: fica no D1 (privado), nunca no repositorio (publico). Vitorio, 17/11/2026: "auditoria... vendedor / supervisor / gerente / diretor".
// POST (X-Evo-Key ou ?chave=): { resumo: {papel: {ok, total}}, falhas: [{papel, pergunta, regras, resposta}], amarracao } -> grava.
// GET  (?chave=): ultimas 20 auditorias (resumo) e as falhas da mais recente; &id=N abre uma.
// =========================================================================
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { chaveEvoValida } from '../_lib/chave_evo.js';
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const tabela = (db) => db.prepare('CREATE TABLE IF NOT EXISTS jota_auditoria (id INTEGER PRIMARY KEY AUTOINCREMENT, em TEXT, origem TEXT, ok INTEGER, total INTEGER, resumo_json TEXT, falhas_json TEXT, amarracao_json TEXT)').run();

export async function onRequestPost({ request, env }) {
  if (!(await chaveAdminOk(env, request)) && !(await chaveEvoValida(request, env))) return j({ erro: 'nao autorizado' }, 401);
  const b = await request.json().catch(() => null); if (!b || !b.resumo) return j({ erro: 'resumo obrigatorio' }, 400);
  await tabela(env.DB);
  const R = Object.values(b.resumo), ok = R.reduce((a, x) => a + (Number(x.ok) || 0), 0), total = R.reduce((a, x) => a + (Number(x.total) || 0), 0);
  const ant = await env.DB.prepare('SELECT ok, total FROM jota_auditoria ORDER BY id DESC LIMIT 1').first().catch(() => null);
  await env.DB.prepare('INSERT INTO jota_auditoria (em, origem, ok, total, resumo_json, falhas_json, amarracao_json) VALUES (?,?,?,?,?,?,?)')
    .bind(new Date().toISOString(), String(b.origem || 'manual').slice(0, 40), ok, total, JSON.stringify(b.resumo), JSON.stringify((b.falhas || []).slice(0, 200)).slice(0, 900000), JSON.stringify(b.amarracao || {})).run();
  const piorou = !!(ant && ant.total && total && ok / total < ant.ok / ant.total);
  return j({ ok: true, aprovadas: ok, total, anterior: ant ? `${ant.ok}/${ant.total}` : null, piorou });
}

export async function onRequestGet({ request, env }) {
  if (!(await chaveAdminOk(env, request))) return j({ erro: 'nao autorizado' }, 401);
  await tabela(env.DB);
  const id = Number(new URL(request.url).searchParams.get('id')) || null;
  if (id) return j(await env.DB.prepare('SELECT * FROM jota_auditoria WHERE id = ?').bind(id).first());
  const { results } = await env.DB.prepare('SELECT id, em, origem, ok, total, resumo_json FROM jota_auditoria ORDER BY id DESC LIMIT 20').all();
  const ult = await env.DB.prepare('SELECT falhas_json, amarracao_json FROM jota_auditoria ORDER BY id DESC LIMIT 1').first();
  return j({ auditorias: results || [], falhas_ultima: ult ? JSON.parse(ult.falhas_json || '[]') : [], amarracao_ultima: ult ? JSON.parse(ult.amarracao_json || '{}') : {} });
}
