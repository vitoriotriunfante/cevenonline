// =========================================================================
// FICHA DO ARQUIVO: functions/api/custo-freio.js   (GET/POST /api/custo-freio)
// O QUE É: o FREIO DE CUSTO (Vitório, 25/10/2026: "aceito gastar até uns 20 dólares... no máximo do máximo do máximo").
//          O guarda de custo (analises/guarda_custo.js, GitHub 08h/20h) liga quando a projeção do mês passa de US$ 15 e solta abaixo de US$ 12.
//          Em dias de fechamento de mês (dia >= 25), o freio é solto automaticamente para garantir monitoramento em tempo real.
// GET: estado (público, sem dado pessoal). POST: só com X-Evo-Key = EVO_KEY (o GitHub já tem).
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
import { agoraBrasilia, foraDoHorario } from '../_lib/horario_reduzido.js';
const CORS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const tabela = (db) => db.prepare('CREATE TABLE IF NOT EXISTS config_custo (chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TEXT)').run();

export async function onRequestGet({ request, env }) {
  await tabela(env.DB);
  const u = new URL(request.url);
  const ag = agoraBrasilia();
  if (u.searchParams.get('soltar') === '1' || ag.fechamentoMes) {
    const rAnt = await env.DB.prepare("SELECT valor FROM config_custo WHERE chave = 'freio'").first();
    const vAnt = rAnt ? JSON.parse(rAnt.valor || '{}') : {};
    if (vAnt.ligado || u.searchParams.get('soltar') === '1') {
      await env.DB.prepare("INSERT OR REPLACE INTO config_custo (chave, valor, atualizado_em) VALUES ('freio', ?, datetime('now'))")
        .bind(JSON.stringify({ ligado: false, projecao: vAnt.projecao ?? null, motivo_solto: ag.fechamentoMes ? 'fechamento_mes' : 'manual' })).run();
    }
  }
  const r = await env.DB.prepare("SELECT valor, atualizado_em FROM config_custo WHERE chave = 'freio'").first();
  const v = r ? JSON.parse(r.valor || '{}') : {};
  return new Response(JSON.stringify({
    ligado: !!v.ligado,
    projecao: v.projecao ?? null,
    motivo_solto: v.motivo_solto || null,
    fechamento_mes: ag.fechamentoMes,
    feriado_hoje: ag.feriado,
    fora_do_horario: foraDoHorario(),
    atualizado_em: r ? r.atualizado_em : null
  }), { headers: CORS });
}
export async function onRequestPost({ request, env }) {
  if (!(await chaveEvoValida(request, env))) return new Response('nao autorizado', { status: 401 });
  let b = {}; try { b = await request.json(); } catch (e) {}
  await tabela(env.DB);
  const ag = agoraBrasilia();
  // Nunca trava o freio em dia de fechamento de mês (dia >= 25)
  const ligarEfetivo = ag.fechamentoMes ? false : !!b.ligado;
  await env.DB.prepare("INSERT OR REPLACE INTO config_custo (chave, valor, atualizado_em) VALUES ('freio', ?, datetime('now'))")
    .bind(JSON.stringify({ ligado: ligarEfetivo, projecao: b.projecao ?? null, motivo_solto: ag.fechamentoMes && b.ligado ? 'fechamento_mes_protegido' : null })).run();
  return new Response(JSON.stringify({ ok: true, ligado: ligarEfetivo, fechamento_mes: ag.fechamentoMes }), { headers: CORS });
}
