// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: ETAPA 1 da unificação (decisão do Vitório, 29/09/2026: "não é tudo a mesma base? se
//          deixar tudo na mesma consulta facilita"). Varre TODOS os RCAs ativos chamando os 4
//          endpoints fixos por RCA — roteiro-hoje, produtividade, dashboard, devolucoes — UMA
//          ÚNICA VEZ, e grava o payload cru em varredura_central_rca (migration 0006). Objetivo
//          final: WhatsApp, TV Executiva (mapa + faturado) e futuramente CFTV/Brasileirão leem
//          TODOS dessa tabela em vez de cada um bater no CEVEN separadamente pelos mesmos RCAs.
// STATUS (29/09/2026): só GRAVA por enquanto. NENHUM consumidor lê daqui ainda — WhatsApp,
//          cron-mapa-executivo.js e cron-faturado-mes.js continuam com suas próprias varreduras,
//          intocados. Migrar cada consumidor pra ler daqui é o próximo passo, um de cada vez,
//          validando que o dado bate antes de trocar de vez (WhatsApp manda mensagem real pros
//          gerentes — errar isso tem custo alto, não dá pra trocar sem validar).
// NÃO CENTRALIZADO: /api/rca/historico-cliente/{id}, que cada consumidor chama seletivamente
//          (regras de negócio diferentes: cliente inativo 30d, foco de campanha, resgate de
//          "ouro na mesa", G03/V03 da TV) — fica de fora por ora, é a parte mais variável.
// LOCK: respeita o lock global do WhatsApp (cron-lock.js) — pula o ciclo se o WhatsApp estiver
//          ativo, igual aos outros crons da TV.
// REGRA: nunca inventa dado. Endpoint que falhar fica de fora do JSON gravado (campo null),
//          nunca usa valor de outro RCA ou de outro dia no lugar.
// =========================================================================

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const HDR = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };
// LIMITE PRATICO DE CHAMADAS SIMULTANEAS AO CEVEN = 6 (decisao do Vitorio, 03/10/2026; medido: ate 6 nao muda
// a resposta, com 9 a latencia dobra). Antes: lotes de 20 RCAs x 4 chamadas = 80 simultaneas.
const CONC = 6;

async function poolLimitado(tarefas, n) {
  const saida = new Array(tarefas.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (true) {
      const k = proximo++;
      if (k >= tarefas.length) return;
      saida[k] = await tarefas[k]();
    }
  }));
  return saida;
}

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

  if (!forcar) {
    const ultima = await env.DB.prepare(
      'SELECT MAX(updated_at) as u FROM varredura_central_rca WHERE data_ref = ?'
    ).bind(dataRef).first();
    if (ultima && ultima.u) {
      const idadeMs = Date.now() - new Date(ultima.u + 'Z').getTime();
      if (idadeMs < 10 * 60 * 1000) {
        return new Response(JSON.stringify({ status: 'CACHE_FRESCO', idade_s: Math.round(idadeMs / 1000) }), { headers: cors });
      }
    }

    const lock = await env.DB.prepare("SELECT dono, criado_em FROM cron_lock_global WHERE id = 1").first().catch(() => null);
    if (lock) {
      const idadeLockMs = Date.now() - new Date(lock.criado_em + 'Z').getTime();
      if (idadeLockMs < 20 * 60 * 1000) {
        return new Response(JSON.stringify({ status: 'PULADO_WHATSAPP_ATIVO', dono: lock.dono, idade_lock_s: Math.round(idadeLockMs / 1000) }), { headers: cors });
      }
    }
  }

  const { results: rcas } = await env.DB.prepare(
    'SELECT r.codigo, UPPER(COALESCE(f.codigo, r.filial_id)) as filial FROM representantes r LEFT JOIN filiais f ON r.filial_id = f.id WHERE r.ativo = 1'
  ).all();

  if (!rcas || !rcas.length) {
    return new Response(JSON.stringify({ erro: 'nenhum representante ativo encontrado no D1' }), { status: 502, headers: cors });
  }

  let ok = 0, comFalha = 0;
  const linhas = [];

  const ENDPOINTS = ['roteiro-hoje', 'produtividade', 'dashboard', 'devolucoes'];
  const tarefas = [];
  for (const rca of rcas) {
    const q = `filial=${String(rca.filial || '').toLowerCase() + '1'}&id=${rca.codigo}`;
    for (const ep of ENDPOINTS) tarefas.push(() => getJson(`${CEVEN}/api/rca/${ep}?${q}`));
  }
  const respostas = await poolLimitado(tarefas, CONC);
  const resultados = rcas.map((rca, idx) => ({
    rca,
    roteiro: respostas[idx * 4],
    produtividade: respostas[idx * 4 + 1],
    dashboard: respostas[idx * 4 + 2],
    devolucoes: respostas[idx * 4 + 3]
  }));
  {
    for (const { rca, roteiro, produtividade, dashboard, devolucoes } of resultados) {
      const falhas = [];
      if (!Array.isArray(roteiro)) falhas.push('roteiro');
      if (!produtividade) falhas.push('produtividade');
      if (!dashboard) falhas.push('dashboard');
      if (!Array.isArray(devolucoes)) falhas.push('devolucoes');
      if (falhas.length === 4) { comFalha++; continue; } // nenhum endpoint respondeu, nada pra gravar
      ok++;
      linhas.push({
        rca: String(rca.codigo),
        filial: String(rca.filial || '').toUpperCase(),
        roteiro: JSON.stringify(roteiro || null),
        produtividade: JSON.stringify(produtividade || null),
        dashboard: JSON.stringify(dashboard || null),
        devolucoes: JSON.stringify(devolucoes || null),
        falhas: falhas.join(',')
      });
    }
  }

  if (!linhas.length) {
    return new Response(JSON.stringify({ erro: 'CEVEN não respondeu nenhum RCA', rcas_total: rcas.length }), { status: 502, headers: cors });
  }

  const TAM_BATCH = 40;
  for (let i = 0; i < linhas.length; i += TAM_BATCH) {
    const fatia = linhas.slice(i, i + TAM_BATCH);
    const stmts = fatia.map((l) =>
      env.DB.prepare(
        `INSERT INTO varredura_central_rca (rca_codigo, filial_sigla, data_ref, roteiro_json, produtividade_json, dashboard_json, devolucoes_json, falhas, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (rca_codigo, data_ref) DO UPDATE SET
           filial_sigla = excluded.filial_sigla, roteiro_json = excluded.roteiro_json,
           produtividade_json = excluded.produtividade_json, dashboard_json = excluded.dashboard_json,
           devolucoes_json = excluded.devolucoes_json, falhas = excluded.falhas, updated_at = CURRENT_TIMESTAMP`
      ).bind(l.rca, l.filial, dataRef, l.roteiro, l.produtividade, l.dashboard, l.devolucoes, l.falhas)
    );
    await env.DB.batch(stmts);
  }

  return new Response(JSON.stringify({
    status: 'ATUALIZADO',
    data_ref: dataRef,
    rcas_total: rcas.length,
    rcas_gravados: ok,
    rcas_sem_nenhuma_resposta: comFalha,
    duracao_ms: Date.now() - t0
  }), { headers: cors });
}
