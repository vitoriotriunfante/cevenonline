import { rodaAgora, freioCusto } from '../_lib/horario_reduzido.js';   // custo Cloudflare: fora do horario, 1 rodada a cada 30 min (25/10/2026)
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

import { proximaConc, lerEstado, gravaEstado, CONC_PADRAO } from '../_lib/concorrencia.js';   // concorrencia adaptativa a cota do CEVEN (12/10/2026)
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
import { CEVEN_APP_SECRET } from '../_lib/ceven_auth.js';
export { CEVEN_APP_SECRET };
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const HDR = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'X-App-Secret': CEVEN_APP_SECRET };
// LIMITE PRATICO DE CHAMADAS SIMULTANEAS AO CEVEN = 6 (decisao do Vitorio, 03/10/2026; medido: ate 6 nao muda
// a resposta, com 9 a latencia dobra). Antes: lotes de 20 RCAs x 4 chamadas = 80 simultaneas.
const CONC = CONC_PADRAO;   // 4; o valor efetivo (2 a 6) vem de concAtual, ajustado sozinho pelo 429 de cada rodada   // 12/10/2026: com 6 o CEVEN devolvia 429 em ~15% das chamadas (264/hora) e cada 429 pausa a rodada inteira; 4 e o teste (limite pratico continua sendo 6)
// PRAZO GLOBAL RIGIDO (12/10/2026): o agendador desiste da chamada aos ~170 s e o que estava depois da etapa em curso (fria, telemetria, mapa) era perdido. Com o CEVEN a ~3,5 s por chamada
// os prazos somados passavam de 190 s: devolucoes e dashboard nunca rodavam e a base ficou com 235 RCAs sem devolucao. Agora tudo termina antes de PRAZO_GLOBAL_MS.
const PRAZO_GLOBAL_MS = 115000;   // medido em 12/10: com folga de chamadas em voo o tick terminava ~15 s depois do prazo (150 s)
const ORCAMENTO_TICK_MS = 70000;    // para de buscar fatias (morna) depois disso
const SLOT_TICK_S = 170, SLOT_COMPLETA_S = 420;   // a trava dura mais que o tick (115 s + folga) e menos que o proximo ciclo do agendador
const PRAZO_PRODUTIVIDADE_MS = 40000;   // a etapa quente para de buscar aos 50 s e grava o que ja veio
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
// PAUSA GLOBAL NO 429 (11/10/2026): o CEVEN limita pela CHAVE (X-App-Secret), entao TODAS as nossas chamadas dividem a mesma cota. Antes cada chamada esperava
// so 5 s (o CEVEN pedia 19) e tentava de novo, 6 em paralelo: as novas tentativas renovavam o bloqueio e a base parou de encher. Agora, ao primeiro 429,
// TODAS as chamadas desta rodada esperam o Retry-After inteiro antes de seguir.
let pausaAte = 0;
let concAtual = CONC_PADRAO;
// ROTEIRO_EM (13/10/2026): quando a rota de cada RCA foi lida pela ultima vez. Sem isso nao havia como saber se o roteiro de quem esta VENDENDO estava velho
// (13/10: TCG 476 tinha 8 clientes efetivados no CEVEN e a base mostrava 0, entao os gols de cliente nao saiam).
// PROD_EM (13/10/2026): quando a PRODUTIVIDADE (pedidos digitados do dia) de cada RCA foi lida pela ultima vez. updated_at nao serve: o dashboard pelo admin tambem o renova
// (conferencia TPH/TBE: Allison tinha 3 vendedores com digitado 0 e idade 5 min, mas a produtividade deles nao era lida). A fila de leitura ordena por prod_em.
let colProdEm = null;
async function garanteProdEm(env) {
  if (colProdEm !== null) return colProdEm;
  try {
    const { results } = await env.DB.prepare("SELECT name FROM pragma_table_info('varredura_central_rca') WHERE name = 'prod_em'").all();
    if (!results || !results.length) await env.DB.prepare('ALTER TABLE varredura_central_rca ADD COLUMN prod_em TEXT').run();
    colProdEm = true;
  } catch { colProdEm = false; }
  return colProdEm;
}
let colRoteiroEm = null;
async function garanteRoteiroEm(env) {
  if (colRoteiroEm !== null) return colRoteiroEm;
  try {
    const { results } = await env.DB.prepare("SELECT name FROM pragma_table_info('varredura_central_rca') WHERE name = 'roteiro_em'").all();
    if (!results || !results.length) await env.DB.prepare('ALTER TABLE varredura_central_rca ADD COLUMN roteiro_em TEXT').run();
    colRoteiroEm = true;
  } catch { colRoteiroEm = false; }
  return colRoteiroEm;
}   // lido de coleta_estado no inicio de cada rodada
// HIERARQUIA DO PAINEL ADMIN (12/10/2026): 1 chamada devolve meta, faturado BRUTO, a faturar e positivacao de ~443 vendedores. NAO substitui o dashboard (o painel mostra o bruto,
// antes das devolucoes; o dashboard do RCA mostra o liquido): serve para DESCOBRIR QUEM MUDOU e rebuscar so esses, e para pular o dashboard de quem esta identico.
// Qualquer falha (login, rede, formato) devolve null e a varredura segue exatamente como antes.
let tokenAdmin = { v: null, ate: 0 };
async function tokenDoAdmin(env) {
  if (!env.CEVEN_ADMIN_USER || !env.CEVEN_ADMIN_PASS) return null;
  try {
    if (!tokenAdmin.v || Date.now() > tokenAdmin.ate) {
      const r = await fetch(`${CEVEN}/api/admin/login`, { method: 'POST', headers: { ...HDR, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: env.CEVEN_ADMIN_USER, password: env.CEVEN_ADMIN_PASS }), signal: AbortSignal.timeout(6000) });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j.access_token) return null;
      tokenAdmin = { v: j.access_token, ate: Date.now() + 25 * 60 * 1000 };
    }
    return tokenAdmin.v;
  } catch { return null; }
}
// DASHBOARD DE TODOS PELO CAMINHO DO ADMIN (13/10/2026): em ~09:50 o CEVEN passou a limitar /api/rca/* a ~3 chamadas por minuto (medido: 3 a 4 e depois 429 por ~60 s),
// mas /api/admin/view-as/rca/dashboard NAO tem essa trava (15 chamadas em 1,5 s, todas 200). Mesmo formato do /api/rca/dashboard.
// MEDIDO (13/10): view-as tambem tem cota (~100 chamadas/min por usuario admin; 429 com Retry-After ~30 s). Por isso: no maximo ~90 por rodada, os MAIS ANTIGOS primeiro
// (ciclo completo de 550 em ~12 min), e ao primeiro 429 PARA e nao insiste.
let banAdminAte = 0;
async function dashboardsAdmin(env, lista, prazoMs) {
  const mapa = new Map();
  if (Date.now() < banAdminAte) return mapa;
  const tk = await tokenDoAdmin(env);
  if (!tk || !lista.length) return mapa;
  const prazo = Date.now() + prazoMs;
  let proximo = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (true) {
      const k = proximo++;
      if (k >= lista.length || Date.now() > prazo) return;
      const rca = lista[k];
      try {
        const r = await fetch(`${CEVEN}/api/admin/view-as/rca/dashboard?filial=${String(rca.filial || '').toLowerCase()}1&id=${rca.codigo}`, { headers: { ...HDR, Authorization: `Bearer ${tk}` }, signal: AbortSignal.timeout(8000) });
        if (r.status === 401 || r.status === 403) { tokenAdmin = { v: null, ate: 0 }; return; }
        if (r.status === 429) { banAdminAte = Date.now() + (Number(r.headers.get('retry-after')) || 40) * 1000; proximo = lista.length; return; }
        if (!r.ok) continue;
        const j = await r.json();
        if (j && j.financeiro) mapa.set(String(rca.codigo), j);
      } catch { /* proximo */ }
    }
  }));
  return mapa;
}
// TRAVA DE /api/rca/* (13/10/2026): ao primeiro 429 NAO se espera nem se insiste (cada tentativa renova o bloqueio): marca ate quando esta bloqueado e o resto da rodada nem chama.
let banRcaAte = 0;
let tickFim = Infinity;   // instante limite desta rodada (para o pacing decidir se vale esperar a janela da cota)
const hierVisto = new Map();   // rca -> ultimo valor da hierarquia que ja motivou um rebuscar (o painel admin tem metas em cache e pode divergir sempre do dashboard: nao rebusca em loop)
async function hierarquiaAdmin(env) {
  if (!env.CEVEN_ADMIN_USER || !env.CEVEN_ADMIN_PASS) return null;
  try {
    if (!tokenAdmin.v || Date.now() > tokenAdmin.ate) {
      const r = await fetch(`${CEVEN}/api/admin/login`, { method: 'POST', headers: { ...HDR, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: env.CEVEN_ADMIN_USER, password: env.CEVEN_ADMIN_PASS }), signal: AbortSignal.timeout(6000) });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j.access_token) return null;
      tokenAdmin = { v: j.access_token, ate: Date.now() + 25 * 60 * 1000 };
    }
    const r = await fetch(`${CEVEN}/api/admin/filiais/hierarquia?refreshMetas=false`, { headers: { ...HDR, Authorization: `Bearer ${tokenAdmin.v}` }, signal: AbortSignal.timeout(8000) });
    if (r.status === 401 || r.status === 403) { tokenAdmin = { v: null, ate: 0 }; return null; }
    if (!r.ok) return null;
    const lista = await r.json();
    if (!Array.isArray(lista)) return null;
    const mapa = new Map();
    for (const f of lista) for (const s of f.supervisores || []) for (const v of s.vendedores || []) {
      mapa.set(String(v.id), { bruto: Number(v.faturado) || 0, pend: Number(v.a_faturar) || 0, meta: Number(v.meta_financeira) || 0, pmeta: Number(v.meta_positivacao) || 0, preal: Number(v.positivado) || 0 });
    }
    return mapa.size > 100 ? mapa : null;   // lista pequena demais = resposta suspeita: nao confia
  } catch { return null; }
}

// TELEMETRIA (12/10/2026): cada tick grava 1 linha em saude_coleta (chamadas, 429, 401, falhas) para o painel /saude e para os alertas. Zera a cada rodada.
const T = { chamadas: 0, ok: 0, r429: 0, r401: 0, falhas: 0 };
let tickId = null;
async function abreTick(env, modo, rcas) {
  tickId = null;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS saude_coleta (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT DEFAULT CURRENT_TIMESTAMP, modo TEXT, rcas INTEGER, gravados INTEGER, chamadas INTEGER, ok INTEGER, r429 INTEGER, r401 INTEGER, falhas INTEGER, duracao_ms INTEGER)').run();
    const r = await env.DB.prepare('INSERT INTO saude_coleta (modo, rcas, gravados, chamadas, ok, r429, r401, falhas, duracao_ms) VALUES (?,?,0,0,0,0,0,0,NULL)').bind(modo + '*', rcas).run();   // 'tick*' = em andamento (se o agendador cortar a rodada, a linha fica assim e o /saude sabe que ela COMECOU)
    tickId = r && r.meta ? r.meta.last_row_id : null;
  } catch { tickId = null; }
}
async function salvaBan(env) {
  try { await env.DB.prepare("INSERT INTO coleta_estado (chave, valor, motivo, atualizado_em) VALUES ('ceven_ban_ate', ?, 'bloqueio de /api/rca/* (429) ate este instante (ms)', CURRENT_TIMESTAMP) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = CURRENT_TIMESTAMP").bind(banRcaAte).run(); } catch { /* nunca derruba */ }
}
async function registraTick(env, modo, rcas, gravados, duracaoMs) {
  await salvaBan(env);
  try {
    if (tickId) {
      await env.DB.prepare('UPDATE saude_coleta SET modo = ?, rcas = ?, gravados = ?, chamadas = ?, ok = ?, r429 = ?, r401 = ?, falhas = ?, duracao_ms = ? WHERE id = ?')
        .bind(modo, rcas, gravados, T.chamadas, T.ok, T.r429, T.r401, T.falhas, duracaoMs, tickId).run();
      tickId = null;
    } else {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS saude_coleta (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT DEFAULT CURRENT_TIMESTAMP, modo TEXT, rcas INTEGER, gravados INTEGER, chamadas INTEGER, ok INTEGER, r429 INTEGER, r401 INTEGER, falhas INTEGER, duracao_ms INTEGER)').run();
    await env.DB.prepare('INSERT INTO saude_coleta (modo, rcas, gravados, chamadas, ok, r429, r401, falhas, duracao_ms) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(modo, rcas, gravados, T.chamadas, T.ok, T.r429, T.r401, T.falhas, duracaoMs).run();
    }
    if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM saude_coleta WHERE ts < datetime('now', '-3 days')").run();
  } catch { /* telemetria nunca derruba a coleta */ }
  // CONCORRENCIA ADAPTATIVA: reduz ao ver 429, sobe devagar quando calmo (regras em _lib/concorrencia.js)
  try {
    const est = await lerEstado(env);
    const prox = proximaConc({ conc: concAtual, calmos: est.calmos, chamadas: T.chamadas, r429: T.r429 });
    await gravaEstado(env, prox);
  } catch { /* nunca derruba a coleta */ }
}
async function getJson(url, tentativas = 2) {
  for (let t = 0; t < tentativas; t++) {
    try {
      if (/\/api\/rca\//.test(url) && Date.now() < banRcaAte) {
        // PACING: cota do CEVEN ~3 chamadas por janela de ~60 s. Se a janela abre ainda dentro desta rodada, espera e chama (rende ~6 por rodada em vez de 3); senao, pula.
        const resta = banRcaAte - Date.now();
        if (resta <= 35000 && Date.now() + resta + 1500 < tickFim) await new Promise((res) => setTimeout(res, resta + 1000));
        else { T.bloqueadas = (T.bloqueadas || 0) + 1; return null; }
      }
      const espera = pausaAte - Date.now();
      if (espera > 0) await new Promise((res) => setTimeout(res, Math.min(espera, 8000)));   // no maximo 8 s de pausa por chamada: o prazo global manda
      const chamada = (async () => {
        T.chamadas++;
        const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(12000) });
        if (r.status === 401 || r.status === 403) T.r401++;
        if (r.status === 429) {
          T.r429++;
          const waitS = Number(r.headers.get('retry-after')) || 60;
          if (/\/api\/rca\//.test(url)) { banRcaAte = Math.max(banRcaAte, Date.now() + waitS * 1000); return null; }   // /api/rca: bloqueado ate o Retry-After; nao insiste
          pausaAte = Math.max(pausaAte, Date.now() + Math.min(waitS, 30) * 1000);
          return 'RETRY';
        }
        if (!r.ok) { T.falhas++; return null; }
        const txt = await r.text();
        T.ok++;
        return txt ? JSON.parse(txt) : null;
      })();
      chamada.catch(() => {});
      const res = await Promise.race([chamada, new Promise((resolve) => setTimeout(() => resolve(null), 14000))]);
      if (res === 'RETRY') continue;
      return res;
    } catch {
      if (t === tentativas - 1) return null;
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
  return null;
}

function dataHojeBrasilia() { return R.hojeSP(); }

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
  const comRoteiro = colRoteiroEm === true && cols.includes('roteiro_json');
  const comProd = colProdEm === true && cols.includes('produtividade_json');
  const insCols = ['rca_codigo', 'filial_sigla', 'data_ref', ...cols, 'updated_at', ...(comRoteiro ? ['roteiro_em'] : []), ...(comProd ? ['prod_em'] : [])];
  const marcas = ['?', '?', '?', ...cols.map(() => '?'), 'CURRENT_TIMESTAMP', ...(comRoteiro ? ['CURRENT_TIMESTAMP'] : []), ...(comProd ? ['CURRENT_TIMESTAMP'] : [])].join(', ');
  const sets = [...cols.map((c) => `${c} = excluded.${c}`), 'updated_at = CURRENT_TIMESTAMP', ...(comRoteiro ? ['roteiro_em = CURRENT_TIMESTAMP'] : []), ...(comProd ? ['prod_em = CURRENT_TIMESTAMP'] : [])].join(', ');
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
  const urlParams = new URL(request.url).searchParams;
  const forcar = urlParams.has('forcar');
  const filialParam = (urlParams.get('filial') || '').toUpperCase().trim();
  // POPULACAO DA MADRUGADA (Vitorio, 26/10/2026: "vc nao roda toda a populacao de todos os dados na madrugada?"): a rota do dia (total_programado) ja existe cedo e nao muda.
  // Das 00:30 as 06:00 (seg-sab) roda a cada 2 min com o CEVEN livre e le TODOS os vendedores antes do expediente; antes so rodava a cada 30 min ate as 06h e a rota
  // so era lida no pico da manha, com 429: as 08h ainda faltavam vendedores. Durante o dia so rele quem teve pedido novo (camada quente).
  // MEDIDO (docs/BASE_UNICA.md): a rota do dia ja esta pronta as 00:07; ~600 vendedores a 3-4 chamadas/min levam horas, por isso comeca 00:30.
  const rel = R.relogioSP(), madrugada = rel.dow !== 0 && rel.min >= 30 && rel.min < 6 * 60;
  if (!forcar && !filialParam && !env.TESTE_SEM_HORARIO && !madrugada && !rodaAgora(2, undefined, await freioCusto(env))) return resp({ status: 'FORA_DO_HORARIO', regra: 'antes das 06h, depois das 21h e domingo: a cada 30 min' });

  // lock global do WhatsApp (prioridade sobre TV/CFTV)
  if (!forcar && !filialParam) {
    const lock = await env.DB.prepare('SELECT dono, criado_em FROM cron_lock_global WHERE id = 1').first().catch(() => null);
    if (lock) {
      const idadeLockMs = Date.now() - new Date(lock.criado_em + 'Z').getTime();
      if (idadeLockMs < 20 * 60 * 1000) return resp({ status: 'PULADO_WHATSAPP_ATIVO', dono: lock.dono, idade_lock_s: Math.round(idadeLockMs / 1000) });
    }
  }

  const { results: rcasRaw } = await env.DB.prepare(
    'SELECT r.codigo, UPPER(COALESCE(f.codigo, r.filial_id)) as filial FROM representantes r LEFT JOIN filiais f ON r.filial_id = f.id WHERE r.ativo = 1'
  ).all();
  if (!rcasRaw || !rcasRaw.length) return resp({ erro: 'nenhum representante ativo encontrado no D1' }, 502);
  let rcas = [...rcasRaw];
  // LISTA = banco (representantes) + PLANILHA (tv-mostra): vendedor novo entra na planilha antes de entrar no banco
  try {
    const jaTem = new Set(rcas.map((r) => String(r.codigo)));
    const mp = await (await fetch(new URL('/api/tv-mostra', request.url), { signal: AbortSignal.timeout(8000) })).json();
    for (const [sg, lista] of Object.entries((mp && mp.filiais) || {})) for (const x of Array.isArray(lista) ? lista : []) {
      if (x && x.rca != null && !jaTem.has(String(x.rca))) { rcas.push({ codigo: String(x.rca), filial: String(sg).toUpperCase() }); jaTem.add(String(x.rca)); }
    }
  } catch { /* sem planilha: segue so com o banco */ }

  // SO A ARVORE VIVA (13/10/2026): RCA fora da arvore do CEVEN e fantasma do cadastro antigo (o app diz 'nao encontrado'); nao gasta chamada nem entra nos totais.
  let foraDaArvore = 0;
  try {
    const { results: arv } = await env.DB.prepare('SELECT filial, rca FROM arvore_supervisores').all();
    if (arv && arv.length >= 300) {
      const naArvore = new Set(arv.map((a) => String(a.filial).toUpperCase() + '|' + a.rca));
      const antes = rcas.length;
      rcas = rcas.filter((r) => naArvore.has(String(r.filial).toUpperCase() + '|' + String(r.codigo)));
      foraDaArvore = antes - rcas.length;
      // E quem esta na arvore e nao estava na lista (RCA novo, VAGO, conta nova)? Entra: o universo e a arvore do CEVEN inteira.
      const jaTem = new Set(rcas.map((r) => String(r.filial).toUpperCase() + '|' + String(r.codigo)));
      for (const a of arv) { const k = String(a.filial).toUpperCase() + '|' + a.rca; if (!jaTem.has(k)) { rcas.push({ codigo: String(a.rca), filial: String(a.filial).toUpperCase() }); jaTem.add(k); } }
      // limpa as linhas de HOJE dos fantasmas (derivadas; voltam sozinhas se o RCA entrar na arvore): assim nenhuma tela/consulta soma quem o CEVEN nao tem
      if (!filialParam) await env.DB.prepare("DELETE FROM varredura_central_rca WHERE data_ref = ? AND NOT EXISTS (SELECT 1 FROM arvore_supervisores a WHERE a.rca = varredura_central_rca.rca_codigo AND a.filial = varredura_central_rca.filial_sigla)").bind(dataRef).run().catch(() => {});
    }
  } catch { /* sem arvore: segue com a lista inteira */ }

  if (filialParam) {
    rcas = rcas.filter((r) => r.filial === filialParam);
    if (!rcas.length) return resp({ erro: `nenhum representante encontrado para filial ${filialParam}` }, 404);
  }

  // estado de hoje: quem ja esta gravado, tem rota ou ja vendeu, e os valores anteriores (para detectar mudanca de pedido)
  const temRoteiroEm = await garanteRoteiroEm(env);
  const temProdEm = await garanteProdEm(env);
  const { results: estado } = await env.DB.prepare(
    `SELECT rca_codigo,
            COALESCE(json_array_length(roteiro_json), 0) AS n_rota,
            CAST(COALESCE(json_extract(produtividade_json, '$.dia.positivacao'), 0) AS REAL) AS pos,
            CAST(COALESCE(json_extract(produtividade_json, '$.dia.dig_pedido'), 0) AS REAL) AS dig,
            (dashboard_json IS NULL OR dashboard_json = 'null') AS sem_dash,
            CAST(json_extract(dashboard_json, '$.financeiro.faturado_bruto') AS REAL) AS d_bruto,
            CAST(json_extract(dashboard_json, '$.financeiro.pendente') AS REAL) AS d_pend,
            CAST(json_extract(dashboard_json, '$.financeiro.devolucao') AS REAL) AS d_dev,
            CAST(json_extract(dashboard_json, '$.financeiro.meta') AS REAL) AS d_meta,
            CAST(json_extract(dashboard_json, '$.positivacao.meta') AS REAL) AS d_pmeta,
            CAST(json_extract(dashboard_json, '$.positivacao.realizado') AS REAL) AS d_preal,
            (produtividade_json IS NULL OR produtividade_json = 'null') AS sem_prod,
            ${temRoteiroEm ? 'roteiro_em AS roteiro_em,' : "NULL AS roteiro_em,"}
            (roteiro_json IS NULL OR roteiro_json = 'null') AS sem_rota,
            ${temProdEm ? 'prod_em' : 'NULL'} AS pe,
            updated_at AS ua
       FROM varredura_central_rca WHERE data_ref = ?`
  ).bind(dataRef).all();
  const ant = new Map((estado || []).map((e) => [String(e.rca_codigo), e]));

  const completa = forcar || filialParam || ant.size < Math.ceil(rcas.length * 0.5);   // partida a frio ou recuperacao
  const dono = (completa ? 'completa:' : 'tick:') + (filialParam ? filialParam + ':' : '') + t0;
  const slot = filialParam ? { ciclo: 1 } : await tomaSlot(env, dono, completa ? SLOT_COMPLETA_S : SLOT_TICK_S);
  if (!slot) {
    const l = await env.DB.prepare("SELECT dono, criado_em, ciclo, CAST((julianday('now') - julianday(criado_em)) * 86400 AS INTEGER) AS idade_s FROM varredura_slot WHERE id = 1").first().catch(() => null);
    return resp({ status: 'OCUPADO', motivo: 'outra rodada da varredura esta em andamento', slot: l || null });
  }

  // CONTADORES SO DEPOIS DE TER A TRAVA (12/10/2026): antes eram zerados por qualquer requisicao, inclusive as que voltavam OCUPADO, e corrompiam a contagem da rodada em andamento.
  T.chamadas = T.ok = T.r429 = T.r401 = T.falhas = 0;
  tickFim = Date.now() + PRAZO_GLOBAL_MS - 15000;
  concAtual = (await lerEstado(env)).conc;
  try {
    const b = await env.DB.prepare("SELECT valor FROM coleta_estado WHERE chave = 'ceven_ban_ate'").first();
    banRcaAte = Math.max(0, Number(b && b.valor) || 0);
  } catch { banRcaAte = 0; }
  await abreTick(env, completa ? 'completa' : 'tick', rcas.length);
  try {
    // ---------- VARREDURA COMPLETA (partida a frio): os 4 endpoints de todos, como era ----------
    if (completa) {
      const ENDPOINTS = ['roteiro-hoje', 'produtividade', 'dashboard', 'devolucoes'];
      // PARTIDA A FRIO EM FATIAS QUE JA GRAVAM (07/10-08/10/2026): antes a varredura completa buscava 4 endpoints x ~600 RCAs (2.400 chamadas, 4 a 7 min) e so GRAVAVA no
      // fim; o gatilho cortava em 170 s e nada era gravado, entao a base ficava VAZIA a manha toda (08/10: 0 linhas ate as 09h40; WhatsApp, TV e liga sem a base unica).
      // Agora: so quem ainda nao esta gravado hoje (ou todos, com ?forcar=1), em fatias de 20 RCAs, gravando cada fatia assim que volta, ate o orcamento de tempo; a proxima rodada continua de onde parou.
      // forcar NAO recomeca do primeiro RCA (11/10/2026: so os ~20 primeiros eram atualizados a cada chamada): vai primeiro quem nunca foi gravado,
      // depois quem esta sem dashboard, depois o mais antigo; assim cada chamada avanca e a proxima continua dali.
      const ordem = (r) => { const a = ant.get(String(r.codigo)); return !a ? '0' : (a.sem_dash ? '1' : '2') + String(a.ua || ''); };
      const faltam = (forcar ? [...rcas] : rcas.filter((r) => !ant.has(String(r.codigo)))).sort((x, y) => ordem(x).localeCompare(ordem(y)));
      let ok = 0, comFalha = 0, feitos = 0;
      for (let i = 0; i < faltam.length && Date.now() - t0 < ORCAMENTO_TICK_MS; i += 20) {
        const fatia = faltam.slice(i, i + 20);
        const tarefas = [];
        for (const rca of fatia) for (const ep of ENDPOINTS) tarefas.push(() => getJson(urlRca(ep, rca)));
        const respostas = await poolLimitado(tarefas, concAtual);
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
          // NUNCA grava null por cima de dado bom: so entra o que o CEVEN respondeu (antes uma falha apagava o que ja estava na base).
          const campos = { falhas: falhas.join(',') };
          if (Array.isArray(roteiro)) campos.roteiro_json = JSON.stringify(roteiro);
          if (produtividade) campos.produtividade_json = JSON.stringify(produtividade);
          if (dashboard) campos.dashboard_json = JSON.stringify(dashboard);
          if (Array.isArray(devolucoes)) campos.devolucoes_json = JSON.stringify(devolucoes);
          stmts.push(upsertParcial(env, dataRef, rca, campos));
        });
        if (stmts.length) await gravaLote(env, stmts);
        feitos += fatia.length;
      }
      await registraTick(env, 'completa', rcas.length, ok, Date.now() - t0);
      if (!ok && feitos && comFalha === feitos) return resp({ erro: 'CEVEN não respondeu nenhum RCA', rcas_total: rcas.length }, 502);
      return resp({ status: 'ATUALIZADO', modo: 'completa', data_ref: dataRef, rcas_total: rcas.length, faltavam: faltam.length, processados: feitos, rcas_gravados: ok, rcas_sem_nenhuma_resposta: comFalha, restam: Math.max(0, faltam.length - feitos), duracao_ms: Date.now() - t0 });
    }

    // ---------- TICK EM CAMADAS ----------
    const ciclo = slot.ciclo;
    const prazo = t0 + ORCAMENTO_TICK_MS;
    const quente = [], semRota = [];
    for (const rca of rcas) {
      const a = ant.get(String(rca.codigo));
      // linha SEM produtividade ou SEM rota (falha anterior) tambem e quente: antes parecia 'sem rota e sem venda' e ficava na fila de 1/3 (11/10/2026)
      if (!a || a.sem_prod || a.sem_rota || a.n_rota > 0 || a.pos > 0 || a.dig > 0) quente.push(rca); else semRota.push(rca);
    }
    const stmts = [];
    const contagem = { quente: 0, evento: 0, rota: 0, semRota: 0, fria: 0, falhas: 0 };
    const jaBuscouRota = new Set();

    // -1. QUEM MUDOU (hierarquia do painel admin): dashboard so de quem teve o bruto, o a faturar, a meta ou a positivacao alterados.
    const hier = await hierarquiaAdmin(env);
    const dashIgual = new Set(), dashMudou = [];
    if (hier) {
      const dif = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) >= 0.5;
      for (const rca of rcas) {
        const h = hier.get(String(rca.codigo)), a = ant.get(String(rca.codigo));
        if (!h || !a || a.sem_dash || a.d_bruto == null) continue;
        const cod = String(rca.codigo), assinatura = JSON.stringify(h);
        if (dif(h.bruto, a.d_bruto) || dif(h.pend, a.d_pend) || dif(h.meta, a.d_meta) || dif(h.pmeta, a.d_pmeta) || dif(h.preal, a.d_preal)) {
          if (hierVisto.get(cod) === assinatura) dashIgual.add(cod);   // ja rebuscado para este mesmo valor: a diferenca restante e do cache do painel admin
          else { dashMudou.push(rca); hierVisto.set(cod, assinatura); }
        } else dashIgual.add(cod);
      }
    }
    contagem.hier = hier ? { vendedores: hier.size, mudaram: dashMudou.length, iguais: dashIgual.size } : 'indisponivel';

    // 0. LACUNA DE DASHBOARD PRIMEIRO (11/10/2026): a etapa fria fica no fim e com o CEVEN limitando (429) nunca chegava a rodar; 217 RCAs ficaram o dia sem meta/faturado
    // (o /incentivo deixava esses vendedores de fora). Agora ate 15 por tick logo no inicio: ~15 chamadas, fecha a lacuna em ~30 min sem estourar a cota.
    // 0a. DASHBOARD DE TODOS PELO ADMIN (sem a trava): grava meta/faturado/devolucao/pendente/positivacao de TODOS e descobre quem teve PEDIDO NOVO ou DEVOLUCAO NOVA.
    const maisAntigosPrimeiro = rcas.slice().sort((x, y) => { const k = (r) => { const a = ant.get(String(r.codigo)); return !a ? '' : String(a.ua || ''); }; return k(x).localeCompare(k(y)); }).slice(0, 70);   // 21/10/2026: 90 -> 70 (Vitorio: "da uma baixada"); a varredura usava quase toda a cota do admin e o app dele dava Too Many Requests
    const dashAdm = await dashboardsAdmin(env, maisAntigosPrimeiro, 35000);
    const admMudou = new Set(), devMudou = new Set();
    const viaAdmin = dashAdm.size > 0 || Date.now() < banAdminAte || tokenAdmin.v != null;   // caminho do admin ativo (mesmo sem ler nada por estar em espera de cota)
    if (viaAdmin) {
      for (const rca of rcas) {
        const cod = String(rca.codigo), d = dashAdm.get(cod), a = ant.get(cod);
        if (!d) continue;
        stmts.push(upsertParcial(env, dataRef, rca, { dashboard_json: JSON.stringify(d) }));
        if (a) {
          const pend = Number(d.financeiro && d.financeiro.pendente) || 0, preal = Number(d.positivacao && d.positivacao.realizado) || 0, dev = Number(d.financeiro && d.financeiro.devolucao) || 0;
          if (a.d_pend != null && (Math.abs(pend - a.d_pend) >= 0.5 || preal !== (Number(a.d_preal) || 0))) admMudou.add(cod);
          if (a.d_dev != null && Math.abs(dev - a.d_dev) >= 0.5) devMudou.add(cod);
        }
        contagem.fria++;
      }
      await gravaLote(env, stmts.splice(0));
    }
    contagem.admin = { lidos: dashAdm.size, pedido_novo: admMudou.size, devolucao_nova: devMudou.size };
    {
      const semDashPri = viaAdmin ? [] : rcas.filter((rca) => { const a = ant.get(String(rca.codigo)); return a && a.sem_dash; });
      const lacuna = viaAdmin ? [] : semDashPri.concat(dashMudou).slice(0, 60);   // sem dashboard primeiro; depois quem a hierarquia diz que mudou
      const ds = await poolLimitado(lacuna.map((rca) => () => getJson(urlRca('dashboard', rca), 1)), concAtual, Date.now() + 10000);
      lacuna.forEach((rca, i) => { if (ds[i]) { contagem.fria++; stmts.push(upsertParcial(env, dataRef, rca, { dashboard_json: JSON.stringify(ds[i]) })); } });
      await gravaLote(env, stmts.splice(0));
    }

    // 1. QUENTE: produtividade de quem tem rota / ja vendeu (+ 1/3 de quem nao tem rota, para nao perder televenda/loja)
    // Do MAIS ANTIGO para o mais novo (quem nunca foi gravado primeiro): se o CEVEN estiver lento e o prazo cortar a etapa, quem ficou de fora vai primeiro no proximo tick.
    // GUIADO POR MUDANCA (13/10/2026 10:50): o CEVEN passou a limitar por IP (2 chamadas e 429 por ~60 s). ~300 chamadas por rodada nao fecham mais. Com a hierarquia do admin
    // (1 chamada, tempo real) sabemos QUEM mudou: produtividade so de quem mudou + quem nunca foi lido + um rodizio curto de seguranca. Sem hierarquia, volta ao comportamento antigo.
    const idsMudou = new Set(dashMudou.map((r) => String(r.codigo)));
    const kBase = (r) => { const a = ant.get(String(r.codigo)); return !a ? '0' : (a.sem_prod ? '1' : '2') + String(a.pe || ''); };
    let candidatos;
    if (viaAdmin) {
      // cota de /api/rca/*: ~3 a 4 chamadas por minuto => ~8 por rodada. Primeiro PEDIDO NOVO, depois nunca lidos hoje, depois o mais antigo.
      const ordem = (r) => { const cod = String(r.codigo), a = ant.get(cod); return admMudou.has(cod) ? '0' : (!a || a.sem_prod) ? '1' : '2' + String(a.pe || ''); };
      candidatos = rcas.slice().sort((x, y) => ordem(x).localeCompare(ordem(y))).slice(0, 14);
    } else if (hier) {
      const prioritarios = rcas.filter((r) => { const a = ant.get(String(r.codigo)); return idsMudou.has(String(r.codigo)) || !a || a.sem_prod; });
      const idsPri = new Set(prioritarios.map((r) => String(r.codigo)));
      const rodizio = quente.filter((r) => !idsPri.has(String(r.codigo))).sort((x, y) => kBase(x).localeCompare(kBase(y))).slice(0, 40);
      const rodizioSemRota = semRota.filter((r) => !idsPri.has(String(r.codigo)) && ((Number(r.codigo) || 0) % 8) === (ciclo % 8));
      candidatos = prioritarios.concat(rodizio, rodizioSemRota);
    } else {
      candidatos = quente.concat(semRota.filter((_, i) => i % FATIAS_ROTA === ciclo % FATIAS_ROTA));
    }
    const alvoProd = candidatos
      .sort((x, y) => { const k = (r) => { const a = ant.get(String(r.codigo)); return !a ? '0' : (a.sem_prod ? '1' : '2') + String(a.pe || ''); }; return k(x).localeCompare(k(y)); });   // sem linha, depois sem produtividade, depois o mais antigo
    contagem.semRota = Math.max(0, alvoProd.length - quente.length);
    contagem.alvoProd = alvoProd.length;
    // PRAZO na etapa 1 (05/10/2026): antes nao tinha; com o CEVEN mais lento a etapa passava de 150 s, a funcao era cortada ANTES de gravar e a varredura parava por 30+ min.
    // GRAVA EM LOTES DE 18 (11/10/2026): com o CEVEN a ~3,5 s por chamada, a etapa buscava tudo e so gravava no fim; uma chamada pendurada estourava o tempo da funcao ANTES de gravar
    // e a base ficou 40+ min sem nenhuma leitura nova. Agora cada lote e gravado assim que volta; o que o prazo cortar fica para o proximo tick.
    const mudou = [];
    const inicioMaxLote = t0 + PRAZO_PRODUTIVIDADE_MS - 15000;
    for (let i = 0; i < alvoProd.length && Date.now() < inicioMaxLote; i += 18) {
      const lote = alvoProd.slice(i, i + 18);
      const prods = await poolLimitado(lote.map((rca) => () => getJson(urlRca('produtividade', rca), 2)), concAtual, t0 + PRAZO_PRODUTIVIDADE_MS);
      lote.forEach((rca, k) => {
        const p = prods[k];
        if (!p) { contagem.falhas++; return; }
        contagem.quente++;
        stmts.push(upsertParcial(env, dataRef, rca, { produtividade_json: JSON.stringify(p) }));
        const a = ant.get(String(rca.codigo));
        const pos = num(p?.dia?.positivacao), dig = num(p?.dia?.dig_pedido);
        if (!a || a.sem_rota || pos !== num(a.pos) || dig !== num(a.dig)) mudou.push(rca);   // pedido novo (ou RCA novo): busca a rota agora
      });
      await gravaLote(env, stmts.splice(0));
    }

    // 2. EVENTO: rota de quem mudou o pedido
    const rotasEvento = await poolLimitado((viaAdmin ? mudou.slice(0, 6) : mudou).map((rca) => () => getJson(urlRca('roteiro-hoje', rca))), concAtual, t0 + 60000);
    mudou.forEach((rca, i) => {
      const r = rotasEvento[i];
      if (!Array.isArray(r)) return;
      contagem.evento++;
      jaBuscouRota.add(String(rca.codigo));
      stmts.push(upsertParcial(env, dataRef, rca, { roteiro_json: JSON.stringify(r) }));
    });

    // 2b. QUEM ESTA VENDENDO (pos > 0 ou digitado > 0): roteiro renovado a cada rodada, os mais velhos primeiro (ate 40). E dele que saem os gols de CLIENTE
    // (resgate, mix, quinzenas, pedido na rota); com a rota velha o gol so aparecia minutos depois, ou nunca (13/10/2026).
    if (temRoteiroEm && !viaAdmin && Date.now() - t0 < 55000) {   // so se a rodada ainda esta cedo: passar de 170 s faz o agendador cortar tudo
      const vendendo = rcas.filter((r) => { const a = ant.get(String(r.codigo)); return a && (a.pos > 0 || a.dig > 0) && !jaBuscouRota.has(String(r.codigo)); })
        .sort((x, y) => String((ant.get(String(x.codigo)) || {}).roteiro_em || '').localeCompare(String((ant.get(String(y.codigo)) || {}).roteiro_em || ''))).slice(0, 40);
      const rv = await poolLimitado(vendendo.map((rca) => () => getJson(urlRca('roteiro-hoje', rca), 1)), concAtual, Date.now() + 14000);
      vendendo.forEach((rca, i) => {
        if (!Array.isArray(rv[i])) return;
        contagem.vendendo = (contagem.vendendo || 0) + 1;
        jaBuscouRota.add(String(rca.codigo));
        stmts.push(upsertParcial(env, dataRef, rca, { roteiro_json: JSON.stringify(rv[i]) }));
      });
    }

    // 2c. ROTEIRO DE QUEM TEM ROTA, MESMO SEM VENDER (20/10/2026, TSJ: 7 amarelos as 10h em vendedores com check-in desde as 08:26): no caminho do admin o roteiro
    // so era renovado para quem teve PEDIDO novo; quem visitava sem vender ficava com o roteiro da meia-noite (tudo ABERTO). Agora ate 10 por rodada, os mais velhos primeiro.
    if (viaAdmin && temRoteiroEm && Date.now() - t0 < 70000) {
      // PEDIDO PRIMEIRO (26/10/2026, Vitorio: "olha o tanto de lance que ja era para ter saido"): as 08:55, 41 vendedores com pedido e so 11 com o pedido no roteiro gravado;
      // sem roteiro novo nao nasce lance. Agora vai primeiro quem VENDEU e tem a produtividade mais nova que o roteiro (pedido ainda fora da rota gravada); depois o mais velho.
      const atrasado = (a) => (a.pos > 0 || a.dig > 0) && String(a.pe || '') > String(a.roteiro_em || '') ? '0' : '1';
      const comRota = rcas.filter((r) => { const a = ant.get(String(r.codigo)); return a && (a.n_rota > 0 || a.pos > 0 || a.dig > 0) && !jaBuscouRota.has(String(r.codigo)); })
        .sort((x, y) => { const k = (r) => { const a = ant.get(String(r.codigo)) || {}; return atrasado(a) + String(a.roteiro_em || ''); }; return k(x).localeCompare(k(y)); }).slice(0, 10);
      const rr = await poolLimitado(comRota.map((rca) => () => getJson(urlRca('roteiro-hoje', rca), 1)), concAtual, Date.now() + 15000);
      comRota.forEach((rca, i) => {
        if (!Array.isArray(rr[i])) return;
        contagem.rota_renovada = (contagem.rota_renovada || 0) + 1;
        jaBuscouRota.add(String(rca.codigo));
        stmts.push(upsertParcial(env, dataRef, rca, { roteiro_json: JSON.stringify(rr[i]) }));
      });
      await gravaLote(env, stmts.splice(0));
    }

    // 3. MORNA: rota de todos, em fatias (so quem ainda nao foi buscado por evento)
    const fatiaRota = viaAdmin ? [] : rcas.filter((rca, i) => i % FATIAS_ROTA === ciclo % FATIAS_ROTA && !jaBuscouRota.has(String(rca.codigo)));
    const rotas = await poolLimitado(fatiaRota.map((rca) => () => getJson(urlRca('roteiro-hoje', rca))), concAtual, prazo);
    fatiaRota.forEach((rca, i) => {
      if (!Array.isArray(rotas[i])) return;
      contagem.rota++;
      stmts.push(upsertParcial(env, dataRef, rca, { roteiro_json: JSON.stringify(rotas[i]) }));
    });
    await gravaLote(env, stmts.splice(0));

    // 4. FRIA: dashboard 1/10 por tick; DEVOLUCOES 1/3 por tick (Vitorio, 06/10/2026: "precisamos ser coesos no numero": com 1/10 a devolucao da TV/Lances ficava ~25 min
    // atrasada em relacao ao WhatsApp, que le o CEVEN ao vivo. Com 1/3 fica em ~7 min).
    // DASHBOARD: quem esta SEM dashboard hoje vai primeiro (ate 30 por tick) + a fatia normal de 1/10. Antes so a fatia 1/10 entrava e ficava atras das ~200 devolucoes,
    // que consumiam os 30 s: 195 de 596 RCAs ficaram sem meta/faturado do mes (11/10/2026).
    const semDash = rcas.filter((rca) => { const a = ant.get(String(rca.codigo)); return a && a.sem_dash; }).slice(0, 30);
    const idsDash = new Set(semDash.map((r) => String(r.codigo)));
    const fatiaDash = viaAdmin ? [] : semDash.concat(rcas.filter((rca, i) => i % FATIAS_FRIA === ciclo % FATIAS_FRIA && !idsDash.has(String(rca.codigo)) && !dashIgual.has(String(rca.codigo))));   // identico na hierarquia = pula
    const fatiaDev = viaAdmin
      ? rcas.filter((rca) => devMudou.has(String(rca.codigo))).slice(0, 6)
      : hier
      ? rcas.filter((rca, i) => idsMudou.has(String(rca.codigo)) || i % (FATIAS_DEV * 2) === ciclo % (FATIAS_DEV * 2))   // com a hierarquia: quem mudou + 1/6 por rodada
      : rcas.filter((rca, i) => i % FATIAS_DEV === ciclo % FATIAS_DEV);
    // A etapa FRIA tem FATIA PROPRIA de tempo (05/10/2026): com o prazo geral, as etapas 1 a 3 consumiam os 100 s e a fria nunca rodava, entao painel (faturado do mes)
    // e devolucoes ficavam congelados no dado da varredura completa (ex.: TPA R$ 42 mil na Executiva contra R$ 133 mil no CEVEN).
    const prazoFria = Date.now() + 30000;
    // DEVOLUCOES primeiro (prioridade) e ponto de partida GIRANDO a cada tick: se o prazo estourar, nao e sempre o mesmo vendedor do fim da lista que fica sem atualizar
    const rodar = (L) => { if (!L.length) return L; const k = (ciclo * 7) % L.length; return L.slice(k).concat(L.slice(0, k)); };
    // Dashboard e devolucoes com PRAZO PROPRIO cada (20 s + 20 s dentro do orcamento do tick): um nao come o tempo do outro.
    const itensDev = rodar(fatiaDev).map((rca) => ({ rca, tipo: 'devolucoes' }));
    const itensDash = fatiaDash.map((rca) => ({ rca, tipo: 'dashboard' }));
    const itensFria = [...itensDev, ...itensDash];
    const buscaFria = (L, ms) => poolLimitado(L.map((it) => () => getJson(urlRca(it.tipo, it.rca))), concAtual, Date.now() + ms);
    const folga = Math.max(0, t0 + PRAZO_GLOBAL_MS - 8000 - Date.now());   // 8 s para gravar, telemetria e responder
    const frias = [...(await buscaFria(itensDev, Math.min(20000, folga * 0.5))), ...(await buscaFria(itensDash, Math.min(20000, folga * 0.4)))];
    const camposPorRca = new Map();
    const campo = (rca) => { const k = String(rca.codigo); if (!camposPorRca.has(k)) camposPorRca.set(k, { rca, campos: {} }); return camposPorRca.get(k).campos; };
    itensFria.forEach((it, i) => { const r = frias[i]; if (it.tipo === 'dashboard' && r) campo(it.rca).dashboard_json = JSON.stringify(r); if (it.tipo === 'devolucoes' && Array.isArray(r)) campo(it.rca).devolucoes_json = JSON.stringify(r); });
    for (const { rca, campos } of camposPorRca.values()) { contagem.fria++; stmts.push(upsertParcial(env, dataRef, rca, campos)); }
    await gravaLote(env, stmts.splice(0));

    // Encadeia o MAPA DA EXECUTIVA logo apos a rodada (05/10/2026): antes ele rodava em cron proprio de 5 em 5 min e o atraso se somava ao da varredura
    // (pedido novo levava ate ~8 min para chegar na Executiva). So se sobrou tempo antes de a trava expirar (150 s).
    // telemetria ANTES da etapa do mapa (que pode demorar ate 30 s e estourar o prazo do agendador)
    await registraTick(env, 'tick', rcas.length, contagem.quente + contagem.evento + contagem.rota + contagem.fria, Date.now() - t0);
    let mapa = 'pulado';
    if (Date.now() - t0 < 85000) {
      try { const rm = await fetch(new URL('/api/cron-mapa-executivo', request.url), { signal: AbortSignal.timeout(30000) }); const jm = await rm.json().catch(() => ({})); mapa = jm.status || String(rm.status); } catch { mapa = 'falhou'; }
    }
    return resp({ status: 'ATUALIZADO', modo: 'tick', ciclo, data_ref: dataRef, rcas_total: rcas.length, ...contagem, mudaram: mudou.length, mapa, duracao_ms: Date.now() - t0 });
  } finally {
    if (!filialParam) await soltaSlot(env, dono);
  }
}
