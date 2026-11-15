// =========================================================================
// API: GET/POST /api/monitoria
// Painel e motor do MONITOR.IA (regras declarativas, eventos e simulacao segura).
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { atualizarRegra, listarRegras, simularOnda1 } from '../_lib/monitoria/motor.js';
import { detectarEventos } from '../_lib/monitoria/detector.js';
import { executarCicloSupervisores } from '../_lib/monitoria/supervisores.js';

const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: J });

export async function onRequestGet({ env }) {
  const db = env.DB;
  const [regras, envios, eventos] = await Promise.all([
    listarRegras(db),
    db.prepare('SELECT id, regra_id, data, destino_real, papel, filial, rca, modo, bonequinho, status, acao_pos_alerta, enviado_em, substr(texto_preview, 1, 180) preview FROM monitoria_envios ORDER BY id DESC LIMIT 30').all().catch(() => ({ results: [] })),
    db.prepare('SELECT event_type, COUNT(*) total, SUM(CASE WHEN processed_at IS NULL THEN 1 ELSE 0 END) pendentes FROM domain_events GROUP BY event_type').all().catch(() => ({ results: [] })),
  ]);
  return resp({ ok: true, regras, envios: envios.results || [], eventos: eventos.results || [] });
}

export async function onRequestPost({ request, env }) {
  try {
    const evoOk = await chaveEvoValida(request, env);
    const admOk = !evoOk && await chaveAdminOk(env, request);
    if (!evoOk && !admOk) return resp({ erro: 'nao autorizado' }, 401);
    let body = {};
    try { body = await request.json(); } catch { return resp({ erro: 'json invalido' }, 400); }
    if (body.acao === 'config') return resp(await atualizarRegra(env.DB, body));
    if (body.acao === 'simular') {
      const origin = new URL(request.url).origin;
      return resp(await simularOnda1(origin, env, body));
    }
    if (body.acao === 'detectar') {
      const origin = new URL(request.url).origin;
      return resp(await detectarEventos(origin, env, body));
    }
    if (body.acao === 'ciclo_supervisores') {
      const origin = new URL(request.url).origin;
      return resp(await executarCicloSupervisores(origin, env, body));
    }
    return resp({ erro: 'acao invalida (use config, simular, detectar ou ciclo_supervisores)' }, 400);
  } catch (e) {
    return resp({ ok: false, erro: String((e && e.message) || e) }, 500);
  }
}

