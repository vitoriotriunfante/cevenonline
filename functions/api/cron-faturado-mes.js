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
  const { results: linhasCentral } = await env.DB.prepare(
    'SELECT rca_codigo, filial_sigla, dashboard_json FROM varredura_central_rca WHERE data_ref = ?'
  ).bind(dataRef).all();

  if (!linhasCentral || !linhasCentral.length) {
    return new Response(JSON.stringify({ erro: 'varredura_central_rca ainda sem dado hoje — aguardando primeiro ciclo', dica: 'GET /api/cron-varredura-central' }), { status: 202, headers: cors });
  }

  // =====================================================================================================================================
  // REGRA DE INTEGRIDADE (Vitório, 13/10/2026: "soma parcial? JAMAIS"): o número publicado é SEMPRE a soma de TODOS os RCAs, cada um com a sua
  // última leitura REAL do CEVEN (a de hoje; se ainda não leu hoje, a mais recente dos 7 dias anteriores). Nunca se soma só quem já foi lido.
  // O snapshot (resumo_snapshot) diz quantos vieram de hoje, quantos de leitura anterior e quantos não têm leitura nenhuma. Tudo é gravado
  // numa ÚNICA transação (filiais + total + snapshot): nenhuma tela vê metade de uma atualização. Se menos de 90% dos RCAs têm QUALQUER leitura
  // (base nova/vazia), NÃO publica: mantém o último snapshot completo.
  // =====================================================================================================================================
  const ultimoConhecido = new Map();   // rca -> { dash, dia }
  try {
    const { results: prev } = await env.DB.prepare(
      "SELECT rca_codigo, data_ref, dashboard_json FROM varredura_central_rca WHERE data_ref < ? AND data_ref >= date(?, '-7 days') AND dashboard_json IS NOT NULL AND dashboard_json != 'null' ORDER BY data_ref"
    ).bind(dataRef, dataRef).all();
    for (const r of prev || []) { try { const d = JSON.parse(r.dashboard_json); if (d && d.financeiro) ultimoConhecido.set(String(r.rca_codigo), { dash: d, dia: r.data_ref }); } catch {} }   // ordenado por dia: o mais recente vence
  } catch { /* sem dias anteriores: so o de hoje */ }

  const agg = {};   // filial -> {faturado, metaFaturado, positivados, metaPositivados}
  const pega = (sig) => (agg[sig] = agg[sig] || { faturado: 0, metaFaturado: 0, positivados: 0, metaPositivados: 0 });
  let deHoje = 0, anteriores = 0, semLeitura = 0, maisAntiga = null;
  for (const l of linhasCentral) {
    let dash = null, origem = dataRef;
    try { const d = JSON.parse(l.dashboard_json); if (d && d.financeiro) dash = d; } catch {}
    if (dash) deHoje++;
    else {
      const u = ultimoConhecido.get(String(l.rca_codigo));
      if (u) { dash = u.dash; origem = u.dia; anteriores++; if (!maisAntiga || u.dia < maisAntiga) maisAntiga = u.dia; }
      else { semLeitura++; continue; }
    }
    const sig = String(l.filial_sigla || '').toUpperCase();
    const aFil = pega(sig), aNac = pega('TODAS');
    const fat = Number(dash?.financeiro?.faturado) || 0;
    const metaFat = Number(dash?.financeiro?.meta) || 0;
    const pos = Number(dash?.positivacao?.realizado) || 0;
    const metaPos = Number(dash?.positivacao?.meta) || 0;
    aFil.faturado += fat; aNac.faturado += fat;
    aFil.metaFaturado += metaFat; aNac.metaFaturado += metaFat;
    aFil.positivados += pos; aNac.positivados += pos;
    aFil.metaPositivados += metaPos; aNac.metaPositivados += metaPos;
  }
  const total = linhasCentral.length;
  const comLeitura = deHoje + anteriores;
  if (!Object.keys(agg).length || comLeitura < total * 0.9) {
    return new Response(JSON.stringify({ status: 'AGUARDANDO_LEITURA', motivo: 'menos de 90% dos RCAs com qualquer leitura: mantem o ultimo snapshot completo', rcas: total, de_hoje: deHoje, anteriores, sem_leitura: semLeitura }), { status: 200, headers: cors });
  }

  await env.DB.prepare('CREATE TABLE IF NOT EXISTS resumo_snapshot (data_ref TEXT PRIMARY KEY, versao INTEGER NOT NULL DEFAULT 1, gerado_em TEXT, rcas INTEGER, de_hoje INTEGER, anteriores INTEGER, sem_leitura INTEGER, mais_antiga TEXT, meta_fat REAL, faturado REAL, meta_pos REAL, positivados REAL)').run();
  const nac = agg.TODAS;
  // UMA transacao: filiais + total + snapshot
  const stmts = Object.entries(agg).map(([sig, a]) =>
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
  stmts.push(env.DB.prepare(
    `INSERT INTO resumo_snapshot (data_ref, versao, gerado_em, rcas, de_hoje, anteriores, sem_leitura, mais_antiga, meta_fat, faturado, meta_pos, positivados)
     VALUES (?, 1, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (data_ref) DO UPDATE SET versao = versao + 1, gerado_em = CURRENT_TIMESTAMP, rcas = excluded.rcas, de_hoje = excluded.de_hoje, anteriores = excluded.anteriores,
       sem_leitura = excluded.sem_leitura, mais_antiga = excluded.mais_antiga, meta_fat = excluded.meta_fat, faturado = excluded.faturado, meta_pos = excluded.meta_pos, positivados = excluded.positivados`
  ).bind(dataRef, total, deHoje, anteriores, semLeitura, maisAntiga, nac.metaFaturado, nac.faturado, nac.metaPositivados, nac.positivados));
  await env.DB.batch(stmts);

  return new Response(JSON.stringify({
    status: 'ATUALIZADO',
    data_ref: dataRef,
    rcas: total,
    de_hoje: deHoje,
    leitura_anterior: anteriores,
    sem_leitura: semLeitura,
    mais_antiga: maisAntiga,
    meta_fat: Math.round(nac.metaFaturado),
    filiais_gravadas: Object.keys(agg).length,
    duracao_ms: Date.now() - t0
  }), { headers: cors });
}
