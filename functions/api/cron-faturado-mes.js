// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: varre TODOS os RCAs ativos chamando /api/rca/dashboard (único endpoint que traz
//          financeiro.faturado/meta e positivacao.realizado/meta do MÊS — não vem em
//          roteiro-hoje nem em produtividade, ver MAPA_DEFINITIVO_ENDPOINTS_CEVEN.md). Grava o
//          agregado por filial + 'TODAS' em resumo_executivo_live (migration 0005), as mesmas
//          colunas mes_faturado/mes_meta_faturado/mes_positivados/mes_meta_positivados que a
//          TV Executiva lê via /api/mapa-executivo-live.
// PROJETO: CFTV/TV. Isolado do pipeline do WhatsApp.
// POR QUE É UM CRON SEPARADO (decisão do Vitório, 29/09/2026): cron-mapa-executivo.js já chama
//          roteiro-hoje + produtividade pra TODOS os RCAs a cada 5min (lotes de 40). Tentamos
//          somar uma 3ª chamada (dashboard) nesse mesmo cron e isso quase certamente contribuiu
//          pra sobrecarregar o CEVEN — o sistema caiu por completo minutos depois (achado
//          29/09/2026, ver auditorias_historico/). Vitório: "cuidado pra não sermos nós a
//          derrubar ele com muitas requisições... tem que ir buscando aos poucos e em lotes".
//          Por isso: cron PRÓPRIO, mais espaçado (15min, nunca ao mesmo tempo que o de 5min),
//          lotes bem menores (10, não 40) e uma pausa entre lotes — nunca dispara os ~560 RCAs
//          de uma vez.
// REGRA: nunca inventa dado. RCA sem resposta do CEVEN simplesmente não soma nada (fica de fora
//          do agregado daquele ciclo) — nunca usa valor de outro RCA ou de outro dia no lugar.
// =========================================================================

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const HDR = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };
const LOTE = 10; // bem menor que o cron de 5min (40) — decisão do Vitório, 29/09/2026
const PAUSA_ENTRE_LOTES_MS = 400; // dá um respiro ao CEVEN entre lotes, não dispara tudo de uma vez

async function getJson(url) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}

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
  const { results: rcas } = await env.DB.prepare(
    'SELECT r.codigo, UPPER(COALESCE(f.codigo, r.filial_id)) as filial FROM representantes r LEFT JOIN filiais f ON r.filial_id = f.id WHERE r.ativo = 1'
  ).all();

  if (!rcas || !rcas.length) {
    return new Response(JSON.stringify({ erro: 'nenhum representante ativo encontrado no D1' }), { status: 502, headers: cors });
  }

  const agg = {}; // filial -> {faturado, metaFaturado, positivados, metaPositivados}
  const pega = (sig) => (agg[sig] = agg[sig] || { faturado: 0, metaFaturado: 0, positivados: 0, metaPositivados: 0 });
  let falhas = 0;

  for (let i = 0; i < rcas.length; i += LOTE) {
    const lote = rcas.slice(i, i + LOTE);
    const resultados = await Promise.all(
      lote.map(async (rca) => {
        const filialKey = String(rca.filial || '').toLowerCase() + '1';
        const dash = await getJson(`${CEVEN}/api/rca/dashboard?filial=${filialKey}&id=${rca.codigo}`);
        return { rca, dash };
      })
    );
    for (const { rca, dash } of resultados) {
      if (!dash) { falhas++; continue; }
      const sig = String(rca.filial || '').toUpperCase();
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
    if (i + LOTE < rcas.length) await espera(PAUSA_ENTRE_LOTES_MS);
  }

  if (!Object.keys(agg).length) {
    return new Response(JSON.stringify({ erro: 'CEVEN não respondeu nenhum RCA', falhas, rcas_total: rcas.length }), { status: 502, headers: cors });
  }

  // INSERT ... ON CONFLICT DO UPDATE, não UPDATE puro — a linha (filial, data_ref) pode ainda não
  // existir se este cron rodar antes do cron-mapa-executivo.js (ordem entre os dois crons não é
  // garantida). Só mexe nas colunas do mês, preserva visitas/pedidos/digitado se a linha já
  // existir (evita corrida entre os dois crons apagando dado um do outro).
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
  await env.DB.batch(stmts);

  return new Response(JSON.stringify({
    status: 'ATUALIZADO',
    data_ref: dataRef,
    rcas_processados: rcas.length,
    rcas_sem_resposta: falhas,
    filiais_gravadas: Object.keys(agg).length,
    duracao_ms: Date.now() - t0
  }), { headers: cors });
}
