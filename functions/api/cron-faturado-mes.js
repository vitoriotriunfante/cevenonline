// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: agrega financeiro.faturado/meta e positivacao.realizado/meta do MÊS por filial +
//          'TODAS', a partir do dashboard já gravado em varredura_central_rca (migration 0006).
//          Grava em resumo_executivo_live (migration 0005), as mesmas colunas
//          mes_faturado/mes_meta_faturado/mes_positivados/mes_meta_positivados que a TV Executiva
//          lê via /api/mapa-executivo-live.
// PROJETO: CFTV/TV. Isolado do pipeline do WhatsApp.
// ETAPA 2 DA UNIFICAÇÃO (29/09/2026, decisão do Vitório: "não é tudo a mesma base? se deixar
//          tudo na mesma consulta facilita"): antes este cron chamava /api/rca/dashboard direto
//          pra cada RCA (própria varredura, lotes de 10, pausa entre lotes). Agora só lê o
//          dashboard_json que cron-varredura-central.js já gravou — sem chamada nova ao CEVEN,
//          sem lotes, sem pausa (é leitura de D1, rápida). Continua sem ler diretamente de
//          cron-mapa-executivo.js — os dois consomem a mesma central, cada um seu jeito.
// REGRA: nunca inventa dado. RCA sem dashboard gravado na central simplesmente não soma nada
//          (fica de fora do agregado daquele ciclo) — nunca usa valor de outro RCA/dia no lugar.
// =========================================================================

function dataHojeBrasilia() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  return `${p.year}-${p.month}-${p.day}`;
}

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

import { calculaResumoMes } from '../_lib/resumo_base.js';

export async function onRequestGet({ env, request }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 (env.DB) não configurado' }), { status: 503, headers: cors });

  const t0 = Date.now();
  const dataRef = dataHojeBrasilia();
  const forcar = new URL(request.url).searchParams.has('forcar');

  // Não refaz se rodou há menos de 12min (o próprio cron chama a cada 15min; essa proteção evita
  // rodar 2x seguidas se alguém disparar manual perto do horário do cron).
  if (!forcar) {
    const ultima = await env.DB.prepare(
      "SELECT MAX(updated_at) as u FROM resumo_executivo_live WHERE data_ref = ? AND mes_faturado > 0"
    ).bind(dataRef).first();
    if (ultima && ultima.u) {
      const idadeMs = Date.now() - new Date(ultima.u + 'Z').getTime();
      if (idadeMs < 12 * 60 * 1000) {
        return new Response(JSON.stringify({ status: 'CACHE_FRESCO', idade_s: Math.round(idadeMs / 1000) }), { headers: cors });
      }
    }
  }

  // WhatsApp tem prioridade (decisão do Vitório, 29/09/2026): pula este ciclo se o WhatsApp
  // estiver varrendo RCAs agora — nunca duas varreduras completas batendo no CEVEN ao mesmo
  // tempo. Ver functions/api/cron-lock.js.
  if (!forcar) {
    const lockGlobal = await env.DB.prepare(
      "SELECT dono, criado_em FROM cron_lock_global WHERE id = 1"
    ).first().catch(() => null);
    if (lockGlobal) {
      const idadeLockGlobalMs = Date.now() - new Date(lockGlobal.criado_em + 'Z').getTime();
      if (idadeLockGlobalMs < 20 * 60 * 1000) {
        return new Response(JSON.stringify({ status: 'PULADO_WHATSAPP_ATIVO', dono: lockGlobal.dono, idade_lock_s: Math.round(idadeLockGlobalMs / 1000) }), { headers: cors });
      }
    }
  }

  // LOCK contra execução concorrente (achado 29/09/2026: um disparo manual de teste rodou em
  // paralelo com o schedule automático — duas varreduras de 560 RCAs batendo no CEVEN ao mesmo
  // tempo, o oposto do que devia). Linha sentinela filial_sigla='_LOCK_' em resumo_executivo_live
  // (mesma tabela, sem precisar de migration nova). Se o lock tiver mais de 12min, considera
  // travado (worker morreu no meio) e libera sozinho — nunca fica preso pra sempre.
  const lockAtual = await env.DB.prepare(
    "SELECT updated_at FROM resumo_executivo_live WHERE filial_sigla = '_LOCK_' AND data_ref = ?"
  ).bind(dataRef).first();
  if (lockAtual && !forcar) {
    const idadeLockMs = Date.now() - new Date(lockAtual.updated_at + 'Z').getTime();
    if (idadeLockMs < 12 * 60 * 1000) {
      return new Response(JSON.stringify({ status: 'JA_EM_EXECUCAO', idade_lock_s: Math.round(idadeLockMs / 1000) }), { headers: cors });
    }
  }
  await env.DB.prepare(
    `INSERT INTO resumo_executivo_live (filial_sigla, data_ref, updated_at) VALUES ('_LOCK_', ?, CURRENT_TIMESTAMP)
     ON CONFLICT (filial_sigla, data_ref) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`
  ).bind(dataRef).run();

  try {
    return await executarVarredura(env, dataRef, t0, cors);
  } finally {
    await env.DB.prepare("DELETE FROM resumo_executivo_live WHERE filial_sigla = '_LOCK_' AND data_ref = ?").bind(dataRef).run();
  }
}

async function executarVarredura(env, dataRef, t0, cors) {
  // A conta fica em functions/_lib/resumo_base.js (a MESMA que a Matriz, a Executiva e o /saude usam, na hora, direto da base).
  // Este cron so mantem a tabela resumo_executivo_live em dia para quem ainda a consulta; nenhuma tela depende mais dela para o total do mes.
  const rb = await calculaResumoMes(env, dataRef);
  if (!rb.rcas) {
    return new Response(JSON.stringify({ erro: 'varredura_central_rca ainda sem dado hoje — aguardando primeiro ciclo', dica: 'GET /api/cron-varredura-central' }), { status: 202, headers: cors });
  }
  if (rb.deHoje + rb.anteriores < rb.rcas * 0.9) {
    return new Response(JSON.stringify({ status: 'AGUARDANDO_LEITURA', rcas: rb.rcas, de_hoje: rb.deHoje, leitura_anterior: rb.anteriores, sem_leitura: rb.semLeitura }), { headers: cors });
  }
  const stmts = [...Object.entries(rb.porFilial), ['TODAS', rb.total]].map(([sig, a]) =>
    env.DB.prepare(
      `INSERT INTO resumo_executivo_live (filial_sigla, data_ref, mes_faturado, mes_meta_faturado, mes_positivados, mes_meta_positivados, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (filial_sigla, data_ref) DO UPDATE SET
         mes_faturado = excluded.mes_faturado,
         mes_meta_faturado = excluded.mes_meta_faturado,
         mes_positivados = excluded.mes_positivados,
         mes_meta_positivados = excluded.mes_meta_positivados,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(sig, dataRef, a.faturado, a.metaFaturado, a.positivados, a.metaPositivados)
  );
  await env.DB.batch(stmts);   // uma transacao so
  return new Response(JSON.stringify({
    status: 'ATUALIZADO', data_ref: dataRef, rcas: rb.rcas, de_hoje: rb.deHoje, leitura_anterior: rb.anteriores, sem_leitura: rb.semLeitura,
    meta_fat: Math.round(rb.total.metaFaturado), filiais_gravadas: stmts.length, duracao_ms: Date.now() - t0
  }), { headers: cors });
}
