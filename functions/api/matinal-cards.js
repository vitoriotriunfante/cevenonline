// =========================================================================
// API: GET/POST /api/matinal-cards (header X-Evo-Key)
// Armazena os cards PNG mobile-first da Matinal gerados em Playwright para envio no WhatsApp (sem links).
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';

const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: J });

async function ensureTable(db) {
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS matinal_cards (chave TEXT PRIMARY KEY, data TEXT NOT NULL, filial TEXT, cod_sup TEXT, supervisor TEXT, png_b64 TEXT NOT NULL, atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP)'
  ).run();
}

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return j({ erro: 'D1 indisponivel' }, 500);
  if (!chaveEvoValida(request, env)) return j({ erro: 'nao autorizado' }, 401);
  await ensureTable(env.DB);
  const u = new URL(request.url);
  const data = u.searchParams.get('data') || '';
  const { results } = data
    ? await env.DB.prepare('SELECT chave, data, filial, cod_sup, supervisor, length(png_b64) bytes, atualizado_em FROM matinal_cards WHERE data = ? ORDER BY chave').bind(data).all()
    : await env.DB.prepare('SELECT chave, data, filial, cod_sup, supervisor, length(png_b64) bytes, atualizado_em FROM matinal_cards ORDER BY atualizado_em DESC LIMIT 200').all();
  return j({ ok: true, total: (results || []).length, cards: results || [] });
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) return j({ erro: 'D1 indisponivel' }, 500);
  if (!chaveEvoValida(request, env)) return j({ erro: 'nao autorizado' }, 401);
  let body;
  try { body = await request.json(); } catch { return j({ erro: 'JSON invalido' }, 400); }
  const cards = Array.isArray(body.cards) ? body.cards : [];
  if (!cards.length || cards.length > 30) return j({ erro: 'envie entre 1 e 30 cards por lote' }, 400);
  await ensureTable(env.DB);
  const stmts = [];
  for (const c of cards) {
    const dt = c && (c.data || body.data);
    if (!c || !c.chave || !dt || !c.png_b64) continue;
    stmts.push(
      env.DB.prepare(
        'INSERT INTO matinal_cards (chave, data, filial, cod_sup, supervisor, png_b64, atualizado_em) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET data=excluded.data, filial=excluded.filial, cod_sup=excluded.cod_sup, supervisor=excluded.supervisor, png_b64=excluded.png_b64, atualizado_em=CURRENT_TIMESTAMP'
      ).bind(String(c.chave), String(dt), String(c.filial || ''), String(c.cod_sup || ''), String(c.supervisor || ''), String(c.png_b64).replace(/^data:[^;]+;base64,/, ''))
    );
  }
  if (!stmts.length) return j({ erro: 'nenhum card valido' }, 400);
  await env.DB.batch(stmts);
  return j({ ok: true, gravados: stmts.length });
}
