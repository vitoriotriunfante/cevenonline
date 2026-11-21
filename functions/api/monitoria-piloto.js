// =========================================================================
// API: GET /api/monitoria-piloto   (functions/_lib/monitoria/piloto.js)   — 21/11/2026
// O agendador (worker-cron, de 15 em 15 min) chama UMA filial por vez: ?filial=TCV  -> roda a janela da hora local, se houver.
// Conferencia (sem enviar): ?filial=TCV&janela=meio&sombra=1&ver=1&forcar=1  ·  Lista do dia: ?hoje=1
// Chave: x-chave / ?chave= (admin do JOTA) ou X-Evo-Key. Envio real so com config_flags monitoria_liberada_ate no futuro.
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { executarPiloto } from '../_lib/monitoria/piloto.js';

const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: J });

export async function onRequestGet({ request, env }) {
  const kc = request.headers.get('x-chave') || '';
  const ok = (env.MONITORIA_CRON_KEY && kc && kc === env.MONITORIA_CRON_KEY) || (await chaveAdminOk(env, request)) || (await chaveEvoValida(request, env));
  if (!ok) return resp({ erro: 'nao autorizado' }, 401);
  const u = new URL(request.url), p = (k) => u.searchParams.get(k);
  if (p('hoje') === '1') {
    const dia = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    const { results } = await env.DB.prepare("SELECT regra_id, celular, destino_real, filial, modo, status, bonequinho motor, enviado_em, acao_pos_alerta, texto_preview FROM monitoria_envios WHERE data = ? AND regra_id LIKE 'PILOTO:%' ORDER BY filial, enviado_em").bind(dia).all();
    return resp({ dia, total: (results || []).length, envios: results || [] });
  }
  try {
    const r = await executarPiloto(u.origin, env, { filial: p('filial'), janela: p('janela') || null, sombra: p('sombra') === '1', teste: p('teste') === '1', ver: p('ver') === '1', forcar: p('forcar') === '1' });
    return resp(r);
  } catch (e) { return resp({ erro: String(e && e.message || e).slice(0, 300) }, 500); }
}
