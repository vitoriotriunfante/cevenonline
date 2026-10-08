// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: varredura CENTRAL dos RCAs no CEVEN, gravada em varredura_central_rca (migration 0006). Todas as telas e o
//          WhatsApp leem DESSA tabela em vez de cada um bater no CEVEN pelos mesmos RCAs (decisão do Vitório,
//          29/09/2026: "não é tudo a mesma base?").
// REORGANIZADA EM CAMADAS (05/10/2026, pedido do Vitório: "varrer os pedidos, que é o mais importante, e os outros aos
//          poucos; deixar o mais próximo possível do TEMPO REAL"). Antes: tudo de todos a cada ~16 min (4,7 min de
//          varredura + guarda de 10 min), então o pedido chegava na TV com 5 a 20 minutos de atraso. Agora, a cada tick:
//   1. QUENTE  — produtividade (pedidos, valor digitado, positivação) de quem tem rota hoje ou já vendeu: TODO tick.
//   2. EVENTO  — rota (roteiro-hoje) só de quem acabou de mudar o pedido/valor: atualiza status, recorrência e mapa na hora.
//   3. MORNA   — rota de todos, em fatias (1/3 por tick) + produtividade de quem não tem rota (1/3 por tick).
//   4. FRIA    — dashboard (meta/faturado do mês) e devoluções, em fatias (1/10 por tick).
//   Partida a frio (menos de metade dos RCAs gravados hoje) ou ?forcar=1: varredura COMPLETA, como era antes.
// TRAVA ÚNICA: tabela varredura_slot (1 linha). Só uma rodada por vez => nunca passa de CONC (6) chamadas simultâneas ao
//          CEVEN por causa desta função. Trava expira sozinha (tick 150 s, completa 420 s) se a função cair no meio.
// ORÇAMENTO DE TEMPO: o tick para de buscar fatias quando passa de 100 s (a camada quente sempre vai primeiro).
// CONSUMIDORES: não mudam. Linhas continuam na mesma tabela; updated_at = última atualização de QUALQUER parte da linha.
// LOCK: respeita o lock global do WhatsApp (cron-lock.js) — pula o ciclo se o WhatsApp estiver ativo.
// REGRA: nunca inventa dado. Endpoint que falhar não altera o que já estava gravado (nunca zera por falha).
// NÃO CENTRALIZADO: /api/rca/historico-cliente/{id} (cada consumidor chama seletivamente).
// =========================================================================

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const HDR = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };
// LIMITE PRATICO DE CHAMADAS SIMULTANEAS AO CEVEN = 6 (decisao do Vitorio, 03/10/2026; medido: ate 6 nao muda
// a resposta, com 9 a latencia dobra). Antes: lotes de 20 RCAs x 4 chamadas = 80 simultaneas.
const CONC = 6;
const ORCAMENTO_TICK_MS = 100000;   // para de buscar fatias depois disso
const SLOT_TICK_S = 150, SLOT_COMPLETA_S = 420;
const PRAZO_PRODUTIVIDADE_MS = 70000;   // a etapa quente para de buscar aos 70 s e grava o que ja veio
const FATIAS_ROTA = 3;              // cada RCA tem a rota atualizada a cada 3 ticks (se nao mudou o pedido)
const FATIAS_FRIA = 10;             // dashboard a cada 10 ticks
const FATIAS_DEV = 3;               // devolucoes a cada 3 ticks (~7 min): para a TV bater com o WhatsApp

async function poolLimitado(tarefas, n, prazo) {
  const saida = new Array(tarefas.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(n, tarefas.length) }, async () => {
    while (true) {
      const k = proximo++;
      if (k >= tarefas.length) return;
      if (prazo && Date.now() > prazo) { saida[k] = undefined; continue; } // estourou o orcamento: pula (fica para o proximo tick)
      saida[k] = await tarefas[k]();
    }
  }));
  return saida;
}

// PRAZO DURO (08/10/2026): o AbortSignal nao cobre a leitura do CORPO da resposta; uma resposta do CEVEN que travava no meio prendia a rodada por ~9 min (a base de hoje ficou
// vazia a manha toda). Agora a chamada inteira (cabecalho + corpo) tem teto de 20 s; passou disso = null (fica para a proxima rodada), nunca trava o pool.
async function getJson(url) {
  const chamada = (async () => {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  })();
  chamada.catch(() => {});
  try {
    return await Promise.race([chamada, new Promise((resolve) => setTimeout(() => resolve(null), 20000))]);
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

const urlRca = (ep, rca) => `${CEVEN}/api/rca/${ep}?filial=${String(rca.filial || '').toLowerCase() + '1'}&id=${rca.codigo}`;
const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };

async function tomaSlot(env, dono, expiraS) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS varredura_slot (id INTEGER PRIMARY KEY CHECK (id = 1), dono TEXT, criado_em TEXT, ciclo INTEGER NOT NULL DEFAULT 0)').run();
  await env.DB.prepare('INSERT OR IGNORE INTO varredura_slot (id, dono, criado_em, ciclo) VALUES (1, NULL, NULL, 0)').run();
  const r = await env.DB.prepare(
    "UPDATE varredura_slot SET dono = ?, criado_em = CURRENT_TIMESTAMP, ciclo = ciclo + 1 WHERE id = 1 AND (dono IS NULL OR criado_em IS NULL OR criado_em < datetime('now', ?))"
  ).bind(dono, `-${expiraS} seconds`).run();
  const mudou = r && r.meta ? r.meta.changes : r && r.changes;
  if (!mudou) return null;
  const linha = await env.DB.prepare('SELECT ciclo FROM varredura_slot WHERE id = 1').first();
  return { ciclo: linha ? linha.ciclo : 1 };
}
async function soltaSlot(env, dono) {
  try { await env.DB.prepare('UPDATE varredura_slot SET dono = NULL WHERE id = 1 AND dono = ?').bind(dono).run(); } catch {}
}

async function gravaLote(env, stmts) {
  const TAM = 40;
  for (let i = 0; i < stmts.length; i += TAM) await env.DB.batch(stmts.slice(i, i + TAM));
}

// UPSERT parcial: so as colunas informadas mudam; as demais ficam como estavam. Linha nova entra com o que veio.
function upsertParcial(env, dataRef, rca, campos) {
  const cols = Object.keys(campos);
  const insCols = ['rca_codigo', 'filial_sigla', 'data_ref', ...cols, 'updated_at'];
  const marcas = ['?', '?', '?', ...cols.map(() => '?'), 'CURRENT_TIMESTAMP'].join(', ');
  const sets = [...cols.map((c) => `${c} = excluded.${c}`), 'updated_at = CURRENT_TIMESTAMP'].join(', ');
  return env.DB.prepare(
    `INSERT INTO varredura_central_rca (${insCols.join(', ')}) VALUES (${marcas})
     ON CONFLICT (rca_codigo, data_ref) DO UPDATE SET ${sets}`
  ).bind(String(rca.codigo), String(rca.filial || '').toUpperCase(), dataRef, ...cols.map((c) => campos[c]));
}

export async function onRequestGet({ env, request }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 (env.DB) não configurado' }), { status: 503, headers: cors });
  const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });

  const t0 = Date.now();
  const dataRef = dataHojeBrasilia();
  const forcar = new URL(request.url).searchParams.has('forcar');

  // lock global do WhatsApp (prioridade sobre TV/CFTV)
  if (!forcar) {
    const lock = await env.DB.prepare('SELECT dono, criado_em FROM cron_lock_global WHERE id = 1').first().catch(() => null);
    if (lock) {
      const idadeLockMs = Date.now() - new Date(lock.criado_em + 'Z').getTime();
      if (idadeLockMs < 20 * 60 * 1000) return resp({ status: 'PULADO_WHATSAPP_ATIVO', dono: lock.dono, idade_lock_s: Math.round(idadeLockMs / 1000) });
    }
  }

  const { results: rcas } = await env.DB.prepare(
    'SELECT r.codigo, UPPER(COALESCE(f.codigo, r.filial_id)) as filial FROM representantes r LEFT JOIN filiais f ON r.filial_id = f.id WHERE r.ativo = 1'
  ).all();
  if (!rcas || !rcas.length) return resp({ erro: 'nenhum representante ativo encontrado no D1' }, 502);
  // LISTA = banco (representantes) + PLANILHA (tv-mostra): vendedor novo entra na planilha antes de entrar no banco (05/10/2026: RCAs 1121-1128 e 1097 ficavam fora da varredura,
  // da Executiva e do painel do mes; ex.: Jeferson/TPA R$ 93,7 mil faturados nao apareciam). Nunca inventa: so soma quem a planilha lista.
  try {
    const jaTem = new Set(rcas.map((r) => String(r.codigo)));
    const mp = await (await fetch(new URL('/api/tv-mostra', request.url), { signal: AbortSignal.timeout(8000) })).json();
    for (const [sg, lista] of Object.entries((mp && mp.filiais) || {})) for (const x of Array.isArray(lista) ? lista : []) {
      if (x && x.rca != null && !jaTem.has(String(x.rca))) { rcas.push({ codigo: String(x.rca), filial: String(sg).toUpperCase() }); jaTem.add(String(x.rca)); }
    }
  } catch { /* sem planilha: segue so com o banco */ }

  // estado de hoje: quem ja esta gravado, tem rota ou ja vendeu, e os valores anteriores (para detectar mudanca de pedido)
  const { results: estado } = await env.DB.prepare(
    `SELECT rca_codigo,
            COALESCE(json_array_length(roteiro_json), 0) AS n_rota,
            CAST(COALESCE(json_extract(produtividade_json, '$.dia.positivacao'), 0) AS REAL) AS pos,
            CAST(COALESCE(json_extract(produtividade_json, '$.dia.dig_pedido'), 0) AS REAL) AS dig,
            updated_at AS ua
       FROM varredura_central_rca WHERE data_ref = ?`
  ).bind(dataRef).all();
  const ant = new Map((estado || []).map((e) => [String(e.rca_codigo), e]));

  const completa = forcar || ant.size < Math.ceil(rcas.length * 0.5);   // partida a frio ou recuperacao
  const dono = (completa ? 'completa:' : 'tick:') + t0;
  const slot = await tomaSlot(env, dono, completa ? SLOT_COMPLETA_S : SLOT_TICK_S);
  if (!slot) {
    const l = await env.DB.prepare("SELECT dono, criado_em, ciclo, CAST((julianday('now') - julianday(criado_em)) * 86400 AS INTEGER) AS idade_s FROM varredura_slot WHERE id = 1").first().catch(() => null);
    return resp({ status: 'OCUPADO', motivo: 'outra rodada da varredura esta em andamento', slot: l || null });
  }

  try {
    // ---------- VARREDURA COMPLETA (partida a frio): os 4 endpoints de todos, como era ----------
    if (completa) {
      const ENDPOINTS = ['roteiro-hoje', 'produtividade', 'dashboard', 'devolucoes'];
      // PARTIDA A FRIO EM FATIAS QUE JA GRAVAM (07/10-08/10/2026): antes a varredura completa buscava 4 endpoints x ~600 RCAs (2.400 chamadas, 4 a 7 min) e so GRAVAVA no
      // fim; o gatilho cortava em 170 s e nada era gravado, entao a base ficava VAZIA a manha toda (08/10: 0 linhas ate as 09h40; WhatsApp, TV e liga sem a base unica).
      // Agora: so quem ainda nao esta gravado hoje (ou todos, com ?forcar=1), em fatias de 20 RCAs, gravando cada fatia assim que volta, ate o orcamento de tempo; a proxima rodada continua de onde parou.
      const faltam = forcar ? rcas : rcas.filter((r) => !ant.has(String(r.codigo)));
      let ok = 0, comFalha = 0, feitos = 0;
      for (let i = 0; i < faltam.length && Date.now() - t0 < ORCAMENTO_TICK_MS; i += 20) {
        const fatia = faltam.slice(i, i + 20);
        const tarefas = [];
        for (const rca of fatia) for (const ep of ENDPOINTS) tarefas.push(() => getJson(urlRca(ep, rca)));
        const respostas = await poolLimitado(tarefas, CONC);
        const stmts = [];
        fatia.forEach((rca, idx) => {
          const roteiro = respostas[idx * 4], produtividade = respostas[idx * 4 + 1], dashboard = respostas[idx * 4 + 2], devolucoes = respostas[idx * 4 + 3];
          const falhas = [];
          if (!Array.isArray(roteiro)) falhas.push('roteiro');
          if (!produtividade) falhas.push('produtividade');
          if (!dashboard) falhas.push('dashboard');
          if (!Array.isArray(devolucoes)) falhas.push('devolucoes');
          if (falhas.length === 4) { comFalha++; return; }
          ok++;
          stmts.push(upsertParcial(env, dataRef, rca, {
            roteiro_json: JSON.stringify(roteiro || null), produtividade_json: JSON.stringify(produtividade || null),
            dashboard_json: JSON.stringify(dashboard || null), devolucoes_json: JSON.stringify(devolucoes || null), falhas: falhas.join(',')
          }));
        });
        if (stmts.length) await gravaLote(env, stmts);
        feitos += fatia.length;
      }
      if (!ok && feitos && comFalha === feitos) return resp({ erro: 'CEVEN não respondeu nenhum RCA', rcas_total: rcas.length }, 502);
      return resp({ status: 'ATUALIZADO', modo: 'completa', data_ref: dataRef, rcas_total: rcas.length, faltavam: faltam.length, processados: feitos, rcas_gravados: ok, rcas_sem_nenhuma_resposta: comFalha, restam: Math.max(0, faltam.length - feitos), duracao_ms: Date.now() - t0 });
    }

    // ---------- TICK EM CAMADAS ----------
    const ciclo = slot.ciclo;
    const prazo = t0 + ORCAMENTO_TICK_MS;
    const quente = [], semRota = [];
    for (const rca of rcas) {
      const a = ant.get(String(rca.codigo));
      if (!a || a.n_rota > 0 || a.pos > 0 || a.dig > 0) quente.push(rca); else semRota.push(rca);
    }
    const stmts = [];
    const contagem = { quente: 0, evento: 0, rota: 0, semRota: 0, fria: 0, falhas: 0 };
    const jaBuscouRota = new Set();

    // 1. QUENTE: produtividade de quem tem rota / ja vendeu (+ 1/3 de quem nao tem rota, para nao perder televenda/loja)
    // Do MAIS ANTIGO para o mais novo (quem nunca foi gravado primeiro): se o CEVEN estiver lento e o prazo cortar a etapa, quem ficou de fora vai primeiro no proximo tick.
    const alvoProd = quente.concat(semRota.filter((_, i) => i % FATIAS_ROTA === ciclo % FATIAS_ROTA))
      .sort((x, y) => String((ant.get(String(x.codigo)) || {}).ua || '').localeCompare(String((ant.get(String(y.codigo)) || {}).ua || '')));
    contagem.semRota = alvoProd.length - quente.length;
    // PRAZO na etapa 1 (05/10/2026): antes nao tinha; com o CEVEN mais lento a etapa passava de 150 s, a funcao era cortada ANTES de gravar e a varredura parava por 30+ min.
    const prods = await poolLimitado(alvoProd.map((rca) => () => getJson(urlRca('produtividade', rca))), CONC, t0 + PRAZO_PRODUTIVIDADE_MS);
    const mudou = [];
    alvoProd.forEach((rca, i) => {
      const p = prods[i];
      if (!p) { contagem.falhas++; return; }
      contagem.quente++;
      stmts.push(upsertParcial(env, dataRef, rca, { produtividade_json: JSON.stringify(p) }));
      const a = ant.get(String(rca.codigo));
      const pos = num(p?.dia?.positivacao), dig = num(p?.dia?.dig_pedido);
      if (!a || pos !== num(a.pos) || dig !== num(a.dig)) mudou.push(rca);   // pedido novo (ou RCA novo): busca a rota agora
    });
    await gravaLote(env, stmts.splice(0));

    // 2. EVENTO: rota de quem mudou o pedido
    const rotasEvento = await poolLimitado(mudou.map((rca) => () => getJson(urlRca('roteiro-hoje', rca))), CONC, prazo + 20000);
    mudou.forEach((rca, i) => {
      const r = rotasEvento[i];
      if (!Array.isArray(r)) return;
      contagem.evento++;
      jaBuscouRota.add(String(rca.codigo));
      stmts.push(upsertParcial(env, dataRef, rca, { roteiro_json: JSON.stringify(r) }));
    });

    // 3. MORNA: rota de todos, em fatias (so quem ainda nao foi buscado por evento)
    const fatiaRota = rcas.filter((rca, i) => i % FATIAS_ROTA === ciclo % FATIAS_ROTA && !jaBuscouRota.has(String(rca.codigo)));
    const rotas = await poolLimitado(fatiaRota.map((rca) => () => getJson(urlRca('roteiro-hoje', rca))), CONC, prazo);
    fatiaRota.forEach((rca, i) => {
      if (!Array.isArray(rotas[i])) return;
      contagem.rota++;
      stmts.push(upsertParcial(env, dataRef, rca, { roteiro_json: JSON.stringify(rotas[i]) }));
    });
    await gravaLote(env, stmts.splice(0));

    // 4. FRIA: dashboard 1/10 por tick; DEVOLUCOES 1/3 por tick (Vitorio, 06/10/2026: "precisamos ser coesos no numero": com 1/10 a devolucao da TV/Lances ficava ~25 min
    // atrasada em relacao ao WhatsApp, que le o CEVEN ao vivo. Com 1/3 fica em ~7 min).
    const fatiaDash = rcas.filter((rca, i) => i % FATIAS_FRIA === ciclo % FATIAS_FRIA);
    const fatiaDev = rcas.filter((rca, i) => i % FATIAS_DEV === ciclo % FATIAS_DEV);
    // A etapa FRIA tem FATIA PROPRIA de tempo (05/10/2026): com o prazo geral, as etapas 1 a 3 consumiam os 100 s e a fria nunca rodava, entao painel (faturado do mes)
    // e devolucoes ficavam congelados no dado da varredura completa (ex.: TPA R$ 42 mil na Executiva contra R$ 133 mil no CEVEN).
    const prazoFria = Date.now() + 30000;
    // DEVOLUCOES primeiro (prioridade) e ponto de partida GIRANDO a cada tick: se o prazo estourar, nao e sempre o mesmo vendedor do fim da lista que fica sem atualizar
    const rodar = (L) => { if (!L.length) return L; const k = (ciclo * 7) % L.length; return L.slice(k).concat(L.slice(0, k)); };
    const itensFria = [...rodar(fatiaDev).map((rca) => ({ rca, tipo: 'devolucoes' })), ...rodar(fatiaDash).map((rca) => ({ rca, tipo: 'dashboard' }))];
    const frias = await poolLimitado(itensFria.map((it) => () => getJson(urlRca(it.tipo, it.rca))), CONC, prazoFria);
    const camposPorRca = new Map();
    const campo = (rca) => { const k = String(rca.codigo); if (!camposPorRca.has(k)) camposPorRca.set(k, { rca, campos: {} }); return camposPorRca.get(k).campos; };
    itensFria.forEach((it, i) => { const r = frias[i]; if (it.tipo === 'dashboard' && r) campo(it.rca).dashboard_json = JSON.stringify(r); if (it.tipo === 'devolucoes' && Array.isArray(r)) campo(it.rca).devolucoes_json = JSON.stringify(r); });
    for (const { rca, campos } of camposPorRca.values()) { contagem.fria++; stmts.push(upsertParcial(env, dataRef, rca, campos)); }
    await gravaLote(env, stmts.splice(0));

    // Encadeia o MAPA DA EXECUTIVA logo apos a rodada (05/10/2026): antes ele rodava em cron proprio de 5 em 5 min e o atraso se somava ao da varredura
    // (pedido novo levava ate ~8 min para chegar na Executiva). So se sobrou tempo antes de a trava expirar (150 s).
    let mapa = 'pulado';
    if (Date.now() - t0 < 105000) {
      try { const rm = await fetch(new URL('/api/cron-mapa-executivo', request.url), { signal: AbortSignal.timeout(30000) }); const jm = await rm.json().catch(() => ({})); mapa = jm.status || String(rm.status); } catch { mapa = 'falhou'; }
    }
    return resp({ status: 'ATUALIZADO', modo: 'tick', ciclo, data_ref: dataRef, rcas_total: rcas.length, ...contagem, mudaram: mudou.length, mapa, duracao_ms: Date.now() - t0 });
  } finally {
    await soltaSlot(env, dono);
  }
}
