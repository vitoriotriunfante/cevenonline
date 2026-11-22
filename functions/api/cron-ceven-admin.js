// =========================================================================
// FICHA DO ARQUIVO: functions/api/cron-ceven-admin.js   (GET, chamado pelo worker-cron a cada 15 min, seg-sab 06h-20h)
// O QUE E: o CEVEN do ADMIN, so o que vem dele (Vitorio, 22/11/2026: "os RETs, compromissos e tags... ja tinha falado 5000 vezes que tinha que vir do admin").
//   - compromissos e RET dos supervisores: coletaSupervisores (ela mesma decide se e hora; grava supervisores_dia / supervisores_ret_detalhe)
//   - TAGs (clientes foco): 1x por dia, na 1a rodada depois das 06h, e de novo as 13h (cliente_focos; INSERT OR IGNORE; leitura completa tira o que saiu)
//   - GPS das visitas de hoje, pelo CEVEN de cada gerente (coletaGpsGerentes em functions/_lib/arvore_ceven.js -> ceven_gps_visita), 07h-20h: impedimento por GPS da Liga
// O resto do CEVEN continua bloqueado (functions/_middleware.js libera so estas rotas do admin e o roteiro do gerente).
// Chave: x-chave / ?chave= (jota_admin_token) ou MONITORIA_CRON_KEY do worker.
// =========================================================================
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { coletaSupervisores } from '../_lib/supervisores_coleta.js';
import { cargaClientesFoco } from '../_lib/arvore_ceven.js';
import R from '../../public/regras.js';

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequest({ request, env }) {
  const k = request.headers.get('x-chave') || new URL(request.url).searchParams.get('chave') || '';
  if (!(await chaveAdminOk(env, request)) && !(env.MONITORIA_CRON_KEY && k === env.MONITORIA_CRON_KEY)) return J({ erro: 'nao autorizado' }, 401);
  const u = new URL(request.url), forcar = u.searchParams.get('forcar') === '1', out = { em: new Date().toISOString() };
  try { out.supervisores = await coletaSupervisores(env, forcar); } catch (e) { out.supervisores = { erro: String(e.message || e).slice(0, 80) }; }
  // TAGs: 2x por dia (06h e 13h BRT) ou ?tags=1
  const rel = R.relogioSP(), marca = rel.dia + (rel.h >= 13 ? 'T' : 'M');
  let ult = null; try { ult = await env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'tags_admin_carga'").first(); } catch (e) {}
  if (u.searchParams.get('tags') === '1' || (rel.h >= 6 && (!ult || ult.valor !== marca))) {
    try {
      const r = await cargaClientesFoco(env, true);
      out.tags = { ativos: r.ativos, gravados: r.gravados, completo: r.completo, paginas: r.paginas, erros: (r.erros || []).slice(0, 3) };
      if (r.completo) await env.DB.prepare("INSERT INTO config_flags (chave, valor) VALUES ('tags_admin_carga', ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor").bind(marca).run();
    } catch (e) { out.tags = { erro: String(e.message || e).slice(0, 80) }; }
  }
  // GPS das visitas de hoje pelo CEVEN de cada GERENTE (impedimento por GPS da Liga): 07h-20h ou ?gps=1
  if (u.searchParams.get('gps') === '1' || (rel.h >= 7 && rel.h <= 20)) {
    try { const { coletaGpsGerentes } = await import('../_lib/arvore_ceven.js'); out.gps = await coletaGpsGerentes(env, rel.dia); } catch (e) { out.gps = { erro: String(e.message || e).slice(0, 80) }; }
  }
  return J(out);
}
