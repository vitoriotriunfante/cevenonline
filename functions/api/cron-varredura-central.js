import { rodaAgora, foraDoHorario, freioCusto, agoraBrasilia } from '../_lib/horario_reduzido.js';   // custo Cloudflare: fora do horario, 1 rodada a cada 30 min (25/10/2026)
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
import { garanteTabelasPedido, gravaStatusPedidos } from '../_lib/pedido_status.js';   // pedidos do dia, com ou sem rota (31/10/2026)
import { coletaSupervisores } from '../_lib/supervisores_coleta.js';   // compromissos e RET na base (26/10/2026)
import { gravaCascatas } from '../_lib/arvore_ceven.js';   // cascata do gerente (visitas/eficacia de hoje de todos), cota separada (26/10/2026)
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
// ROTEIRO DO MES NA BASE (26/10/2026, Missaid: "curva negativa do setor 1108" = clientes da carteira do mes que ainda nao compraram): 1 leitura por vendedor por dia
// (cada data_ref nova comeca vazia = refeito todo dia). Madrugada: ate 40 por rodada; de dia: ate 8 (nao tirar a cota do roteiro de hoje, que gera os lances).
let colRoteiroMes = null;
async function garanteRoteiroMes(env) {
  if (colRoteiroMes !== null) return colRoteiroMes;
  try {
    const { results } = await env.DB.prepare("SELECT name FROM pragma_table_info('varredura_central_rca') WHERE name = 'roteiro_mes_json'").all();
    if (!results || !results.length) await env.DB.prepare('ALTER TABLE varredura_central_rca ADD COLUMN roteiro_mes_json TEXT').run();
    colRoteiroMes = true;
  } catch { colRoteiroMes = false; }
  return colRoteiroMes;
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

let indicesOtimizados = null;
async function garanteIndicesOtimizacao(env) {
  if (indicesOtimizados) return;
  try {
    await env.DB.batch([
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_varredura_central_data_ref ON varredura_central_rca (data_ref, filial_sigla)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_varredura_central_rca_data ON varredura_central_rca (rca_codigo, data_ref)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_cascata_dia_data ON cascata_dia (data_ref)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_pedido_status_final_cli ON pedido_status (final, data_pedido, filial, id_cliente)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_pedido_status_data ON pedido_status (data_pedido)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_pedido_status_hist_num ON pedido_status_hist (num, visto_em)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tv_lances_dia_filial ON tv_lances (dia, filial)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tv_lances_dia_rca ON tv_lances (dia, rca)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_tv_lances_filial_chave ON tv_lances (filial, chave)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_cache_analise_criado ON cache_analise_cliente (criado_em)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_saude_coleta_ts ON saude_coleta (ts)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_arvore_sup_id ON arvore_supervisores (sup_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bot_msgs_cel_dir_id ON bot_msgs (celular, direcao, id DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bot_msgs_cel_id ON bot_msgs (celular, id DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bot_msgs_msgid_quando ON bot_msgs (msg_id, quando)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bot_msgs_quando_dir ON bot_msgs (quando, direcao)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bot_contatos_papel_filial ON bot_contatos (papel, filial, ativo)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bot_sugestoes_quando ON bot_sugestoes (quando, id DESC)')
    ]);
    indicesOtimizados = true;
  } catch { indicesOtimizados = false; }
}
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
// chave do vendedor: filial + codigo (Vitorio, 31/10/2026: o mesmo codigo existe em varias filiais, ex.: 2 e 1035)
const kr = (r) => String(r.filial || '').toUpperCase() + '|' + r.codigo;
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
        if (r.status === 401 || r.status === 403) { anotaFalha(r.url, 'http' + r.status); tokenAdmin = { v: null, ate: 0 }; return; }
        if (r.status === 429) { anotaFalha(r.url, 'http429'); banAdminAte = Date.now() + (Number(r.headers.get('retry-after')) || 40) * 1000; proximo = lista.length; return; }
        if (!r.ok) { anotaFalha(r.url, 'http' + r.status); continue; }
        const j = await r.json();
        if (j && j.financeiro) { mapa.set(kr(rca), j); anotaOk(r.url); } else anotaFalha(r.url, 'sem_financeiro');
      } catch (e) { anotaFalha(`/rca/dashboard?filial=${String(rca.filial || '').toLowerCase()}1&id=${rca.codigo}`, String((e && e.name) || 'erro')); }
    }
  }));
  return mapa;
}
// TRAVA DE /api/rca/* (13/10/2026): ao primeiro 429 NAO se espera nem se insiste (cada tentativa renova o bloqueio): marca ate quando esta bloqueado e o resto da rodada nem chama.
let banRcaAte = 0;
let tickFim = Infinity;   // instante limite desta rodada (para o pacing decidir se vale esperar a janela da cota)
const hierVisto = new Map();   // rca -> ultimo valor da hierarquia que ja motivou um rebuscar (o painel admin tem metas em cache e pode divergir sempre do dashboard: nao rebusca em loop)
let metaGravadaEm = 0;
async function gravaMetaHierarquia(env, lista) {
  if (Date.now() - metaGravadaEm < 10 * 60 * 1000) return;
  const rows = [];
  for (const f of lista) { const sig = String(f.sigla || '').toUpperCase().slice(0, 3); for (const s of f.supervisores || []) for (const v of s.vendedores || []) if (v && v.id != null) rows.push([sig, String(v.id), Number(v.meta_financeira) || 0, Number(v.meta_positivacao) || 0]); }
  if (rows.length < 100) return;   /* resposta pequena demais = suspeita */
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS meta_hierarquia (filial TEXT NOT NULL, rca TEXT NOT NULL, meta REAL, meta_pos REAL, atualizado_em TEXT, PRIMARY KEY (filial, rca))').run();
  const { results } = await env.DB.prepare('SELECT filial, rca, meta, meta_pos FROM meta_hierarquia').all();
  const ant = new Map((results || []).map((x) => [x.filial + '|' + x.rca, x]));
  const mud = rows.filter(([f, r, m, p]) => { const a = ant.get(f + '|' + r); return !a || Math.abs((a.meta || 0) - m) > 0.01 || Math.abs((a.meta_pos || 0) - p) > 0.01; });
  const agora = new Date().toISOString();
  for (let i = 0; i < mud.length; i += 80) await env.DB.batch(mud.slice(i, i + 80).map(([f, r, m, p]) => env.DB.prepare('INSERT INTO meta_hierarquia (filial, rca, meta, meta_pos, atualizado_em) VALUES (?,?,?,?,?) ON CONFLICT (filial, rca) DO UPDATE SET meta = excluded.meta, meta_pos = excluded.meta_pos, atualizado_em = excluded.atualizado_em').bind(f, r, m, p, agora)));
  // QUEM SAIU DA LISTA OFICIAL SAI DA META (31/10/2026: so gravava, nunca apagava; na virada do mes ficaria meta velha). Trava: so com resposta de pelo menos 300 vendedores,
  // so das filiais que vieram na resposta, e no maximo 20% de uma vez (resposta parcial do CEVEN nao zera ninguem)
  if (rows.length >= 300) {
    const novos = new Set(rows.map(([f, r]) => f + '|' + r)), filiaisVieram = new Set(rows.map(([f]) => f));
    const sairam = (results || []).filter((x) => filiaisVieram.has(x.filial) && !novos.has(x.filial + '|' + x.rca));
    if (sairam.length && sairam.length <= rows.length * 0.2) for (let i = 0; i < sairam.length; i += 80) await env.DB.batch(sairam.slice(i, i + 80).map((x) => env.DB.prepare('DELETE FROM meta_hierarquia WHERE filial = ? AND rca = ?').bind(x.filial, x.rca)));
  }
  metaGravadaEm = Date.now();
}
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
    // META OFICIAL POR FILIAL E VENDEDOR (Vitorio, 27/10/2026: "a cascata e unica e a fonte e unica"): a tela "Filiais" do CEVEN (esta mesma hierarquia) e a meta
    // que vale. Grava em meta_hierarquia (filial, rca) SO o que mudou, no maximo a cada 10 min (custo D1 = linhas gravadas). Antes: so em memoria, por codigo sem
    // filial (1035 existe em TPA e TBE), e a meta usada vinha do painel do vendedor / cascata do gerente, que divergem em 5 filiais.
    try { await gravaMetaHierarquia(env, lista); } catch { /* sem gravar: fica a ultima gravada */ }
    const mapa = new Map();
    for (const f of lista) for (const s of f.supervisores || []) for (const v of s.vendedores || []) {
      mapa.set(String(f.sigla || '').toUpperCase().slice(0, 3) + '|' + v.id, { bruto: Number(v.faturado) || 0, pend: Number(v.a_faturar) || 0, meta: Number(v.meta_financeira) || 0, pmeta: Number(v.meta_positivacao) || 0, preal: Number(v.positivado) || 0 });
    }
    return mapa.size > 100 ? mapa : null;   // lista pequena demais = resposta suspeita: nao confia
  } catch { return null; }
}

// TELEMETRIA (12/10/2026): cada tick grava 1 linha em saude_coleta (chamadas, 429, 401, falhas) para o painel /saude e para os alertas. Zera a cada rodada.
const T = { chamadas: 0, ok: 0, r429: 0, r401: 0, falhas: 0 };
// FALHA NUNCA EM SILENCIO (Vitorio, 01/11/2026: "uma chamada da erro, vc nao resolve e simplesmente ignora"; medido: ~7% das chamadas sem resultado e painel com 0 falhas).
// Cada falha fica em coleta_falhas com vendedor, indicador e motivo ate a mesma leitura dar certo. /api/frescor mostra.
const falhasTick = new Map(), okTick = new Set();
const chaveFalha = (url) => { const m = /\/rca\/([\w-]+)\?filial=([a-z]+)1&id=(\w+)/i.exec(String(url)); return m ? `${m[2].toUpperCase()}|${m[3]}|${m[1]}` : null; };
function anotaFalha(url, motivo) { const k = chaveFalha(url); if (k) { falhasTick.set(k, motivo); okTick.delete(k); } }
function anotaOk(url) { const k = chaveFalha(url); if (k) { okTick.add(k); falhasTick.delete(k); } }
async function gravaFalhas(env) {
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS coleta_falhas (filial TEXT NOT NULL, rca TEXT NOT NULL, indicador TEXT NOT NULL, motivo TEXT, vezes INTEGER, primeira TEXT, ultima TEXT, PRIMARY KEY (filial, rca, indicador))').run();
    const { results } = await env.DB.prepare('SELECT filial, rca, indicador FROM coleta_falhas').all();
    const resolvidas = (results || []).filter((x) => okTick.has(`${x.filial}|${x.rca}|${x.indicador}`));   // so apaga o que existia: custo D1 = linhas gravadas
    const st = [...falhasTick].map(([k, motivo]) => { const [f, r, i] = k.split('|'); return env.DB.prepare("INSERT INTO coleta_falhas (filial, rca, indicador, motivo, vezes, primeira, ultima) VALUES (?,?,?,?,1,datetime('now'),datetime('now')) ON CONFLICT (filial, rca, indicador) DO UPDATE SET motivo = excluded.motivo, vezes = vezes + 1, ultima = excluded.ultima").bind(f, r, i, motivo); })
      .concat(resolvidas.map((x) => env.DB.prepare('DELETE FROM coleta_falhas WHERE filial = ? AND rca = ? AND indicador = ?').bind(x.filial, x.rca, x.indicador)));
    for (let i = 0; i < st.length; i += 80) await env.DB.batch(st.slice(i, i + 80));
  } catch { /* telemetria nunca derruba a coleta */ }
  falhasTick.clear(); okTick.clear();
}
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
  await gravaFalhas(env);
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
          anotaFalha(url, 'http429');
          if (/\/api\/rca\//.test(url)) { banRcaAte = Math.max(banRcaAte, Date.now() + waitS * 1000); return null; }   // /api/rca: bloqueado ate o Retry-After; nao insiste
          pausaAte = Math.max(pausaAte, Date.now() + Math.min(waitS, 30) * 1000);
          return 'RETRY';
        }
        if (!r.ok) { T.falhas++; anotaFalha(url, 'http' + r.status); return null; }
        const txt = await r.text();
        if (!txt) { T.ok++; anotaFalha(url, 'corpo_vazio'); return null; }
        const obj = JSON.parse(txt);   // antes de contar como certa: resposta invalida e falha
        T.ok++;
        anotaOk(url);
        return obj;
      })();
      chamada.catch(() => {});
      const res = await Promise.race([chamada, new Promise((resolve) => setTimeout(() => { anotaFalha(url, 'limite_14s'); resolve(null); }, 14000))]);
      if (res === 'RETRY') continue;
      return res;
    } catch (e) {
      T.falhas++;
      anotaFalha(url, String((e && e.name) || 'erro'));
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
// hora da ultima leitura real de cada parte (Vitorio, 01/11/2026: 15 min no maximo); updated_at anda com qualquer gravacao e nao prova nada. Criada como prod_em.
let colLeitura = false;
async function garanteColLeitura(env) {
  if (colLeitura) return;
  const { results } = await env.DB.prepare("SELECT name FROM pragma_table_info('varredura_central_rca') WHERE name IN ('dash_em', 'dev_em')").all();
  const tem = new Set((results || []).map((r) => r.name));
  for (const c of ['dash_em', 'dev_em']) if (!tem.has(c)) await env.DB.prepare(`ALTER TABLE varredura_central_rca ADD COLUMN ${c} TEXT`).run();
  colLeitura = true;
}
function upsertParcial(env, dataRef, rca, campos) {
  const cols = Object.keys(campos);
  const comRoteiro = colRoteiroEm === true && cols.includes('roteiro_json');
  const comProd = colProdEm === true && cols.includes('produtividade_json');
  const insCols = ['rca_codigo', 'filial_sigla', 'data_ref', ...cols, 'updated_at', ...(comRoteiro ? ['roteiro_em'] : []), ...(comProd ? ['prod_em'] : []), ...(colLeitura && cols.includes('dashboard_json') ? ['dash_em'] : []), ...(colLeitura && cols.includes('devolucoes_json') ? ['dev_em'] : [])];
  const marcas = ['?', '?', '?', ...cols.map(() => '?'), 'CURRENT_TIMESTAMP', ...(comRoteiro ? ['CURRENT_TIMESTAMP'] : []), ...(comProd ? ['CURRENT_TIMESTAMP'] : []), ...(colLeitura && cols.includes('dashboard_json') ? ['CURRENT_TIMESTAMP'] : []), ...(colLeitura && cols.includes('devolucoes_json') ? ['CURRENT_TIMESTAMP'] : [])].join(', ');
  const sets = [...cols.map((c) => `${c} = excluded.${c}`), 'updated_at = CURRENT_TIMESTAMP', ...(comRoteiro ? ['roteiro_em = CURRENT_TIMESTAMP'] : []), ...(comProd ? ['prod_em = CURRENT_TIMESTAMP'] : []), ...(colLeitura && cols.includes('dashboard_json') ? ['dash_em = CURRENT_TIMESTAMP'] : []), ...(colLeitura && cols.includes('devolucoes_json') ? ['dev_em = CURRENT_TIMESTAMP'] : [])].join(', ');
  return env.DB.prepare(
    `INSERT INTO varredura_central_rca (${insCols.join(', ')}) VALUES (${marcas})
     ON CONFLICT DO UPDATE SET ${sets}`
  ).bind(String(rca.codigo), String(rca.filial || '').toUpperCase(), dataRef, ...cols.map((c) => campos[c]));
}

// PEDIDOS DO DIA, COM OU SEM ROTA (31/10/2026: no sabado sem rota nada era gravado por cliente; pedido fora da rota so entrava na madrugada). So le quem teve o digitado alterado
// desde a ultima leitura, ate 6 vendedores por rodada, e grava so pedido cujo numero ainda nao existe (Vitorio: "o numero do pedido e o mesmo e nao vai gravar de novo").
async function coletaPedidosDoDia(env, dataRef) {
  if (Date.now() < banRcaAte) return { pulado: 'cota' };
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS pedido_leitura (data_ref TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, dig REAL, PRIMARY KEY (data_ref, filial, rca))').run();
  const { results } = await env.DB.prepare(`SELECT v.filial_sigla f, v.rca_codigo r, CAST(json_extract(v.produtividade_json, '$.dia.dig_pedido') AS REAL) d FROM varredura_central_rca v
    LEFT JOIN pedido_leitura p ON p.data_ref = v.data_ref AND p.filial = v.filial_sigla AND p.rca = v.rca_codigo
    WHERE v.data_ref = ? AND CAST(json_extract(v.produtividade_json, '$.dia.dig_pedido') AS REAL) > 0 AND (p.dig IS NULL OR p.dig <> CAST(json_extract(v.produtividade_json, '$.dia.dig_pedido') AS REAL)) LIMIT 6`).bind(dataRef).all();
  let lidos = 0, novos = 0;
  for (const x of results || []) {
    const key = String(x.f).toLowerCase() + '1';
    const r = await fetch(`${CEVEN}/api/rca/historico-vendedor?filial=${key}&id=${x.r}&expandido=true`, { headers: HDR, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!r) continue;
    if (r.status === 429) { banRcaAte = Date.now() + ((Number(r.headers.get('x-ratelimit-reset')) || 30) + 2) * 1000; break; }
    if (!r.ok) continue;
    const j = await r.json().catch(() => null);
    if (!j || !Array.isArray(j.ultimas_visitas)) continue;
    const doDia = j.ultimas_visitas.filter((v) => v && v.num_pedido && String(v.data_visita || '').slice(0, 10) >= dataRef);
    if (doDia.length) {
      await garanteTabelasPedido(env);
      const nums = [...new Set(doDia.map((v) => String(v.num_pedido)))];
      const ja = new Set();
      for (let i = 0; i < nums.length; i += 80) { const p = nums.slice(i, i + 80); const { results: e } = await env.DB.prepare(`SELECT num FROM pedido_status WHERE num IN (${p.map(() => '?').join(',')})`).bind(...p).all(); for (const y of e || []) ja.add(y.num); }
      const porCli = new Map();
      for (const v of doDia) if (!ja.has(String(v.num_pedido))) { const c = String(v.id_cliente || ''); if (!porCli.has(c)) porCli.set(c, []); porCli.get(c).push(v); }
      for (const [c, L] of porCli) { await gravaStatusPedidos(env, key, x.r, c, L); novos += L.length; }
    }
    await env.DB.prepare('INSERT INTO pedido_leitura (data_ref, filial, rca, dig) VALUES (?,?,?,?) ON CONFLICT (data_ref, filial, rca) DO UPDATE SET dig = excluded.dig').bind(dataRef, x.f, x.r, x.d).run();
    lidos++;
  }
  return { lidos, novos };
}

// MACRO FORA DA ARVORE (Vitorio, 31/10/2026: "eles tem CEVEN, so nao sao monitorados... macro indicadores tem que pegar tudo"): codigos sem supervisor (2 em cada filial, 1035 TPA...) concentram
// devolucao que nao entrava em nenhum total. Lista vinda do GEROT de outubro, conferida no CEVEN. Tabela propria com filial na chave, porque varredura_central_rca tem 1 linha por codigo.
const MACRO_CODIGOS = ['ABC|2', 'API|2', 'MCD|2', 'TBE|2', 'TBL|2', 'TCA|2', 'TCG|2', 'TCV|2', 'TPA|2', 'TPH|2', 'TSJ|2', 'TPA|1035', 'TPH|264', 'TPH|240', 'TBL|180', 'TPH|1101', 'TPH|256', 'TPH|238', 'TCG|1059', 'TCG|428', 'TPH|265', 'TCV|221', 'TCG|1065', 'TPH|81', 'ABC|353', 'ABC|110', 'TPH|110'];
async function coletaMacroForaArvore(env, limite = 3) {
  if (Date.now() < banRcaAte) return { pulado: 'cota' };
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS macro_fora_arvore (filial TEXT NOT NULL, rca TEXT NOT NULL, mes TEXT NOT NULL, dev_mes REAL, notas_json TEXT, em TEXT, PRIMARY KEY (filial, rca, mes))').run();
  const mes = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 7);
  const { results } = await env.DB.prepare('SELECT filial, rca, em FROM macro_fora_arvore WHERE mes = ?').bind(mes).all();
  const quando = new Map((results || []).map((x) => [x.filial + '|' + x.rca, x.em || '']));
  const fila = MACRO_CODIGOS.slice().sort((a, b) => String(quando.get(a) || '').localeCompare(String(quando.get(b) || ''))).slice(0, limite);
  let lidos = 0;
  for (const k of fila) {
    const [f, r] = k.split('|');
    const x = await fetch(`${CEVEN}/api/rca/devolucoes?filial=${f.toLowerCase()}1&id=${r}`, { headers: HDR, signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (!x) continue;
    if (x.status === 429) { banRcaAte = Date.now() + ((Number(x.headers.get('x-ratelimit-reset')) || 30) + 2) * 1000; break; }
    if (!x.ok) continue;
    const t = await x.text(); let A = []; try { A = t.trim() ? JSON.parse(t) : []; } catch { continue; }
    if (!Array.isArray(A)) continue;
    const doMes = A.filter((n) => String(n.data || '').startsWith(mes));
    await env.DB.prepare('INSERT INTO macro_fora_arvore (filial, rca, mes, dev_mes, notas_json, em) VALUES (?,?,?,?,?,?) ON CONFLICT (filial, rca, mes) DO UPDATE SET dev_mes = excluded.dev_mes, notas_json = excluded.notas_json, em = excluded.em').bind(f, r, mes, doMes.reduce((a, n) => a + (Number(n.vl_devolvido) || 0), 0), JSON.stringify(doMes.map((n) => ({ d: n.data, c: n.codcli, v: n.vl_devolvido }))), new Date().toISOString()).run();
    lidos++;
  }
  return { lidos };
}

// RECHECAGEM ATE FATURAR (Vitorio, 31/10/2026: "pedido que identifiquei como bloqueado tenho que checar ate ele virar faturado"; 810 "bloqueados", a maioria ja faturada, quase geraram ligacao
// a todos os gerentes). Era 4 clientes por rodada para 3 mil em aberto. Agora 1 chamada por vendedor atualiza TODOS os pedidos abertos dele; vai primeiro quem tem o pedido checado ha mais tempo.
async function rechecaAbertosPorVendedor(env, limite = 6, prazo = Infinity) {
  if (Date.now() < banRcaAte) return { pulado: 'cota' };
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS recheca_fila (filial TEXT NOT NULL, rca TEXT NOT NULL, em TEXT, PRIMARY KEY (filial, rca))').run();
  const { results: V } = await env.DB.prepare("SELECT p.filial, p.rca, COALESCE(f.em, '') ult FROM pedido_status p LEFT JOIN recheca_fila f ON f.filial = p.filial AND f.rca = p.rca WHERE p.final = 0 AND p.data_pedido >= date('now', '-15 days') GROUP BY p.filial, p.rca ORDER BY ult, MIN(CASE WHEN p.status LIKE 'BLOQ%' THEN 0 ELSE 1 END) LIMIT ?").bind(limite).all();
  let lidos = 0, mudaram = 0;
  const FINAL = /FATURAD|CANCELAD|DEVOLVID/i;
  for (const x of V || []) {
    if (Date.now() > prazo) break;
    const r = await fetch(`${CEVEN}/api/rca/historico-vendedor?filial=${String(x.filial).toLowerCase()}1&id=${x.rca}&expandido=true`, { headers: HDR, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!r) continue;
    if (r.status === 429) { banRcaAte = Date.now() + ((Number(r.headers.get('x-ratelimit-reset')) || 30) + 2) * 1000; break; }
    if (!r.ok) continue;
    const j = await r.json().catch(() => null);
    if (!j || !Array.isArray(j.ultimas_visitas)) continue;
    const m = new Map(j.ultimas_visitas.filter((v) => v && v.num_pedido).map((v) => [String(v.num_pedido), v]));
    const { results: ab } = await env.DB.prepare("SELECT num, status FROM pedido_status WHERE filial = ? AND rca = ? AND final = 0 AND data_pedido >= date('now', '-15 days')").bind(x.filial, x.rca).all();
    const agora = new Date().toISOString(), st = [];
    for (const p of ab || []) {
      const v = m.get(p.num), novo = v && String(v.status_pedido || '').toUpperCase().trim();
      if (novo && novo !== p.status) { mudaram++; st.push(env.DB.prepare('UPDATE pedido_status SET status = ?, final = ?, valor = COALESCE(?, valor), valor_winthor = COALESCE(?, valor_winthor), atualizado_em = ?, rechecado_em = ? WHERE num = ?').bind(novo, FINAL.test(novo) ? 1 : 0, Number(v.total_clube) || null, Number(v.vl_faturado_winthor) || null, agora, agora, p.num), env.DB.prepare('INSERT OR IGNORE INTO pedido_status_hist (num, status, visto_em) VALUES (?, ?, ?)').bind(p.num, novo, agora)); }
    }
    // so marca como conferido o pedido que veio na resposta; a fila anda por recheca_fila, para pedido que nunca vem nao travar o vendedor nem parecer confirmado
    for (const p of ab || []) if (m.has(p.num)) st.push(env.DB.prepare('UPDATE pedido_status SET rechecado_em = ?, confirmado_em = ? WHERE num = ?').bind(agora, agora, p.num));
    st.push(env.DB.prepare('INSERT INTO recheca_fila (filial, rca, em) VALUES (?,?,?) ON CONFLICT (filial, rca) DO UPDATE SET em = excluded.em').bind(x.filial, x.rca, agora));
    for (let i = 0; i < st.length; i += 80) await env.DB.batch(st.slice(i, i + 80));
    lidos++;
  }
  return { lidos, mudaram };
}

export async function onRequestGet({ env, request }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 (env.DB) não configurado' }), { status: 503, headers: cors });
  // DIAGNOSTICO (?diag=1): uma chamada de cada caminho, com status e tempo, sem gravar nada
  if (new URL(request.url).searchParams.get('diag') === '1') {
    const out = {}, mede = async (nome, url, h) => { const t = Date.now(); try { const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(15000) }); const x = await r.text(); out[nome] = { http: r.status, ms: Date.now() - t, bytes: x.length, reset: r.headers.get('x-ratelimit-reset') }; } catch (e) { out[nome] = { erro: e.name, ms: Date.now() - t }; } };
    await mede('produtividade', `${CEVEN}/api/rca/produtividade?filial=tbl1&id=185`, HDR);
    const tk = await tokenDoAdmin(env).catch(() => null); out.token_admin = !!tk;
    if (tk) await mede('view_as', `${CEVEN}/api/admin/view-as/rca/dashboard?filial=tbl1&id=185`, { ...HDR, Authorization: `Bearer ${tk}` });
    return new Response(JSON.stringify(out), { headers: cors });
  }
  const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });

  const t0 = Date.now();
  await garanteColLeitura(env);
  const dataRef = dataHojeBrasilia();
  const urlParams = new URL(request.url).searchParams;
  const forcar = urlParams.has('forcar');
  const filialParam = (urlParams.get('filial') || '').toUpperCase().trim();
  // ROTEIRO DO MES NA HORA (26/10/2026): ?rmes=ABC:1108,TCA:1028 le o roteiro do mes desses vendedores agora e grava na base (pergunta de supervisor esperando)
  if (urlParams.get('rmes')) {
    if (!(await garanteRoteiroMes(env))) return resp({ erro: 'coluna roteiro_mes_json indisponivel' }, 500);
    const alvo = String(urlParams.get('rmes')).split(',').map((x) => x.split(':')).filter((x) => /^[A-Z]{3}$/i.test(x[0] || '') && /^\d+$/.test(x[1] || '')).slice(0, 10).map(([f, c]) => ({ filial: f.toUpperCase(), codigo: c }));
    const out = {};
    for (const rca of alvo) { const r = await getJson(urlRca('roteiro-mes', rca), 2); if (Array.isArray(r)) { await gravaLote(env, [upsertParcial(env, dataRef, rca, { roteiro_mes_json: JSON.stringify(r) })]); out[rca.filial + ':' + rca.codigo] = r.length; } else out[rca.filial + ':' + rca.codigo] = 'falhou'; }
    return resp({ status: 'ROTEIRO_MES', data_ref: dataRef, lidos: out });
  }
  // POPULACAO DA MADRUGADA (Vitorio, 26/10/2026: "vc nao roda toda a populacao de todos os dados na madrugada?"): a rota do dia (total_programado) ja existe cedo e nao muda.
  // Das 00:30 as 06:00 (seg-sab) roda a cada 2 min com o CEVEN livre e le TODOS os vendedores antes do expediente; antes so rodava a cada 30 min ate as 06h e a rota
  // so era lida no pico da manha, com 429: as 08h ainda faltavam vendedores. Durante o dia so rele quem teve pedido novo (camada quente).
  // MEDIDO (docs/BASE_UNICA.md): a rota do dia ja esta pronta as 00:07; ~600 vendedores a 3-4 chamadas/min levam horas, por isso comeca 00:30.
  const rel = R.relogioSP(), agBr = agoraBrasilia(), madrugada = rel.dow !== 0 && !agBr.feriado && rel.min >= 30 && rel.min < 6 * 60;
  const noiteTodos = foraDoHorario() && !madrugada;   // Vitorio, 31/10/2026: "pode ler de meia em meia hora, mas tem que ler todos": 3 rodadas seguidas a cada 30 min, 200 dashboards cada, cobrem os ~580
  if (!forcar && !filialParam && !env.TESTE_SEM_HORARIO && !madrugada && !rodaAgora(noiteTodos ? 6 : 2, undefined, await freioCusto(env))) return resp({ status: 'FORA_DO_HORARIO', regra: 'antes das 06h, depois das 21h, domingo e feriado: a cada 30 min' });

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
    const jaTem = new Set(rcas.map(kr));
    const mp = await (await fetch(new URL('/api/tv-mostra', request.url), { signal: AbortSignal.timeout(8000) })).json();
    for (const [sg, lista] of Object.entries((mp && mp.filiais) || {})) for (const x of Array.isArray(lista) ? lista : []) {
      if (x && x.rca != null && !jaTem.has(String(sg).toUpperCase() + '|' + x.rca)) { rcas.push({ codigo: String(x.rca), filial: String(sg).toUpperCase() }); jaTem.add(String(sg).toUpperCase() + '|' + x.rca); }
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
  await garanteIndicesOtimizacao(env);
  const temRoteiroEm = await garanteRoteiroEm(env);
  const temProdEm = await garanteProdEm(env);
  const { results: estado } = await env.DB.prepare(
    `SELECT rca_codigo, filial_sigla, dash_em,
            COALESCE(json_array_length(roteiro_json), 0) AS n_rota,
            (SELECT COUNT(*) FROM json_each(COALESCE(roteiro_json, '[]')) WHERE json_extract(value, '$.status') NOT IN ('ABERTO', 'AGENDADO')) AS n_feitas_rot,
            CAST(COALESCE(json_extract(produtividade_json, '$.dia.positivacao'), 0) AS REAL) AS pos,
            CAST(COALESCE(json_extract(produtividade_json, '$.dia.dig_pedido'), 0) AS REAL) AS dig,
            (dashboard_json IS NULL OR dashboard_json = 'null') AS sem_dash,
            (devolucoes_json IS NULL OR devolucoes_json = 'null') AS sem_dev,
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
  const ant = new Map((estado || []).map((e) => [String(e.filial_sigla).toUpperCase() + '|' + e.rca_codigo, e]));
  // VISITAS DO GERENTE x ROTEIRO GRAVADO (26/10/2026): a cascata do gerente (cota separada) diz quantas visitas cada vendedor ja fez hoje; se for mais do que o roteiro
  // gravado mostra, o roteiro esta atrasado e vai primeiro (e dele que nascem os lances). Sem cascata do dia, segue a ordem antiga.
  const feitasGer = new Map();
  try {
    // CASCATA NO INÍCIO DA RODADA (29/10/2026): grava a cascata de todas as filiais no inicio (leva ~1-2 s, cota separada).
    // Assim a rodada ja comeca sabendo quem teve visita hoje e nunca perde as visitas se a rodada estourar o prazo depois.
    await gravaCascatas(env, dataRef, 15000);
  } catch (e) { /* segue com a existente */ }
  try {
    const { results: cs } = await env.DB.prepare('SELECT filial, json FROM cascata_dia WHERE data_ref = ?').bind(dataRef).all();
    for (const c of cs || []) { const j = JSON.parse(c.json); for (const s of j.supervisores || []) for (const v of (s.tabelas && s.tabelas.produtividade) || []) if (v && v.id != null) feitasGer.set(String(c.filial).toUpperCase() + '|' + v.id, Number(v.visit_real_hoje) || 0); }
  } catch (e) { /* tabela ainda nao existe no primeiro tick */ }

  // RECUPERACAO SOZINHA (31/10/2026: das 14:31 em diante o tick fez 48 chamadas com 0 sucesso por rodada e a base parou, enquanto a varredura completa funcionava): 2 ticks seguidos sem nenhum sucesso = esta rodada vai pela completa
  let tickTravado = false;
  try { const { results: ult } = await env.DB.prepare("SELECT ok, chamadas FROM saude_coleta WHERE modo IN ('tick', 'completa') ORDER BY id DESC LIMIT 2").all();   /* depois de uma completa com sucesso, o tick e testado de novo */ tickTravado = !filialParam && (ult || []).length === 2 && ult.every((x) => !x.ok && x.chamadas > 0); } catch { /* segue o normal */ }
  // AVISO (Vitorio, 31/10/2026): coleta travada avisa no WhatsApp da diretoria, no maximo 1 vez por hora; antes ninguem via ate alguem olhar
  if (tickTravado) { try {
    const av = await env.DB.prepare("SELECT valor FROM coleta_estado WHERE chave = 'aviso_coleta_em'").first();
    if (!av || Date.now() - Number(av.valor) > 3600000) {
      await env.DB.prepare("INSERT INTO coleta_estado (chave, valor, motivo, atualizado_em) VALUES ('aviso_coleta_em', ?, 'ultimo aviso de coleta travada', datetime('now')) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em").bind(Date.now()).run();
      const eu = await env.DB.prepare("SELECT celular FROM bot_contatos WHERE nome = 'VITORIO' AND papel = 'diretoria' LIMIT 1").first();
      if (eu) await R.enviarTexto(R.evoCfg(env), eu.celular, '⚠️ *Coleta do CEVEN travada:* as 2 últimas rodadas não tiveram nenhum sucesso. Entrando no modo de recuperação; a base pode estar atrasada.');
    }
  } catch { /* o aviso nunca derruba a coleta */ } }
  const completa = forcar || filialParam || tickTravado || ant.size < Math.ceil(rcas.length * 0.5);   // partida a frio ou recuperacao
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
      const ordem = (r) => { const a = ant.get(kr(r)); return !a ? '0' : (a.sem_dash ? '1' : '2') + String(a.ua || ''); };
      const faltam = (forcar ? [...rcas] : rcas.filter((r) => !ant.has(kr(r)))).sort((x, y) => ordem(x).localeCompare(ordem(y)));
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
      const a = ant.get(kr(rca));
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
        const h = hier.get(kr(rca)), a = ant.get(kr(rca));
        if (!h || !a || a.sem_dash || a.d_bruto == null) continue;
        const cod = kr(rca), assinatura = JSON.stringify(h);
        if (dif(h.bruto, a.d_bruto) || dif(h.pend, a.d_pend) || dif(h.meta, a.d_meta) || dif(h.pmeta, a.d_pmeta) || dif(h.preal, a.d_preal)) {
          if (hierVisto.get(cod) === assinatura) dashIgual.add(cod);   // ja rebuscado para este mesmo valor: a diferenca restante e do cache do painel admin
          else dashMudou.push(rca);   // hierVisto so depois de ler: quem nao coube na rodada continua na frente da fila
        } else dashIgual.add(cod);
      }
    }
    contagem.hier = hier ? { vendedores: hier.size, mudaram: dashMudou.length, iguais: dashIgual.size } : 'indisponivel';

    // 0. LACUNA DE DASHBOARD PRIMEIRO (11/10/2026): a etapa fria fica no fim e com o CEVEN limitando (429) nunca chegava a rodar; 217 RCAs ficaram o dia sem meta/faturado
    // (o /incentivo deixava esses vendedores de fora). Agora ate 15 por tick logo no inicio: ~15 chamadas, fecha a lacuna em ~30 min sem estourar a cota.
    // 0a. DASHBOARD DE TODOS PELO ADMIN (sem a trava): grava meta/faturado/devolucao/pendente/positivacao de TODOS e descobre quem teve PEDIDO NOVO ou DEVOLUCAO NOVA.
    // Quem a hierarquia diz que mudou vem primeiro (auditoria 31/10/2026: updated_at anda com qualquer gravacao, e dashboard velho de R$ 785 mil ficava no fim da fila)
    const idsMudouDash = new Set(dashMudou.map(kr));
    const maisAntigosPrimeiro = rcas.slice().sort((x, y) => { const k = (r) => { const a = ant.get(kr(r)); return (idsMudouDash.has(kr(r)) ? '0' : '1') + (!a ? '' : String(a.dash_em || '')); }; return k(x).localeCompare(k(y)); }).slice(0, noiteTodos ? 200 : 70);   // 21/10/2026: 90 -> 70 (Vitorio: "da uma baixada"); a varredura usava quase toda a cota do admin e o app dele dava Too Many Requests
    const dashAdm = await dashboardsAdmin(env, maisAntigosPrimeiro, noiteTodos ? 60000 : 35000);
    const admMudou = new Set(), devMudou = new Set();
    const viaAdmin = dashAdm.size > 0 || Date.now() < banAdminAte || tokenAdmin.v != null;   // caminho do admin ativo (mesmo sem ler nada por estar em espera de cota)
    for (const r of dashMudou) if (dashAdm.has(kr(r)) || !viaAdmin) hierVisto.set(kr(r), JSON.stringify(hier.get(kr(r))));
    if (viaAdmin) {
      for (const rca of rcas) {
        const cod = kr(rca), d = dashAdm.get(cod), a = ant.get(cod);
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
      const semDashPri = viaAdmin ? [] : rcas.filter((rca) => { const a = ant.get(kr(rca)); return a && a.sem_dash; });
      const lacuna = viaAdmin ? [] : semDashPri.concat(dashMudou).slice(0, 60);   // sem dashboard primeiro; depois quem a hierarquia diz que mudou
      const ds = await poolLimitado(lacuna.map((rca) => () => getJson(urlRca('dashboard', rca), 1)), concAtual, Date.now() + 10000);
      lacuna.forEach((rca, i) => { if (ds[i]) { contagem.fria++; stmts.push(upsertParcial(env, dataRef, rca, { dashboard_json: JSON.stringify(ds[i]) })); } });
      await gravaLote(env, stmts.splice(0));
    }

    // 1. QUENTE: produtividade de quem tem rota / ja vendeu (+ 1/3 de quem nao tem rota, para nao perder televenda/loja)
    // Do MAIS ANTIGO para o mais novo (quem nunca foi gravado primeiro): se o CEVEN estiver lento e o prazo cortar a etapa, quem ficou de fora vai primeiro no proximo tick.
    // GUIADO POR MUDANCA (13/10/2026 10:50): o CEVEN passou a limitar por IP (2 chamadas e 429 por ~60 s). ~300 chamadas por rodada nao fecham mais. Com a hierarquia do admin
    // (1 chamada, tempo real) sabemos QUEM mudou: produtividade so de quem mudou + quem nunca foi lido + um rodizio curto de seguranca. Sem hierarquia, volta ao comportamento antigo.
    const idsMudou = new Set(dashMudou.map((r) => kr(r)));
    const kBase = (r) => { const a = ant.get(kr(r)); return !a ? '0' : (a.sem_prod ? '1' : '2') + String(a.pe || ''); };
    let candidatos;
    if (viaAdmin) {
      // cota de /api/rca/*: ~3 a 4 chamadas por minuto => ~8 por rodada. Primeiro PEDIDO NOVO ou VISITA NOVA HOJE, depois nunca lidos hoje, depois o mais antigo.
      const ordem = (r) => {
        const cod = kr(r), a = ant.get(cod);
        const temVisitaNova = (feitasGer.get(cod) || 0) > (Number(a && a.n_feitas_rot) || 0);
        return (admMudou.has(cod) || temVisitaNova) ? '0' : (!a || a.sem_prod) ? '1' : '2' + String(a.pe || '');
      };
      candidatos = rcas.slice().sort((x, y) => ordem(x).localeCompare(ordem(y))).slice(0, 16);
    } else if (hier) {
      const prioritarios = rcas.filter((r) => { const a = ant.get(kr(r)); return idsMudou.has(kr(r)) || !a || a.sem_prod; });
      const idsPri = new Set(prioritarios.map((r) => kr(r)));
      const rodizio = quente.filter((r) => !idsPri.has(kr(r))).sort((x, y) => kBase(x).localeCompare(kBase(y))).slice(0, 40);
      const rodizioSemRota = semRota.filter((r) => !idsPri.has(kr(r)) && ((Number(r.codigo) || 0) % 8) === (ciclo % 8));
      candidatos = prioritarios.concat(rodizio, rodizioSemRota);
    } else {
      candidatos = quente.concat(semRota.filter((_, i) => i % FATIAS_ROTA === ciclo % FATIAS_ROTA));
    }
    const alvoProd = candidatos
      .sort((x, y) => { const k = (r) => { const a = ant.get(kr(r)); return !a ? '0' : (a.sem_prod ? '1' : '2') + String(a.pe || ''); }; return k(x).localeCompare(k(y)); });   // sem linha, depois sem produtividade, depois o mais antigo
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
        const a = ant.get(kr(rca));
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
      jaBuscouRota.add(kr(rca));
      stmts.push(upsertParcial(env, dataRef, rca, { roteiro_json: JSON.stringify(r) }));
    });

    // 2b. QUEM ESTA VENDENDO (pos > 0 ou digitado > 0): roteiro renovado a cada rodada, os mais velhos primeiro (ate 40). E dele que saem os gols de CLIENTE
    // (resgate, mix, quinzenas, pedido na rota); com a rota velha o gol so aparecia minutos depois, ou nunca (13/10/2026).
    if (temRoteiroEm && !viaAdmin && Date.now() - t0 < 55000) {   // so se a rodada ainda esta cedo: passar de 170 s faz o agendador cortar tudo
      const vendendo = rcas.filter((r) => { const a = ant.get(kr(r)); return a && (a.pos > 0 || a.dig > 0) && !jaBuscouRota.has(kr(r)); })
        .sort((x, y) => String((ant.get(kr(x)) || {}).roteiro_em || '').localeCompare(String((ant.get(kr(y)) || {}).roteiro_em || ''))).slice(0, 40);
      const rv = await poolLimitado(vendendo.map((rca) => () => getJson(urlRca('roteiro-hoje', rca), 1)), concAtual, Date.now() + 14000);
      vendendo.forEach((rca, i) => {
        if (!Array.isArray(rv[i])) return;
        contagem.vendendo = (contagem.vendendo || 0) + 1;
        jaBuscouRota.add(kr(rca));
        stmts.push(upsertParcial(env, dataRef, rca, { roteiro_json: JSON.stringify(rv[i]) }));
      });
    }

    // 2c. ROTEIRO DE QUEM TEM ROTA, MESMO SEM VENDER (20/10/2026, TSJ: 7 amarelos as 10h em vendedores com check-in desde as 08:26): no caminho do admin o roteiro
    // so era renovado para quem teve PEDIDO novo; quem visitava sem vender ficava com o roteiro da meia-noite (tudo ABERTO). Agora ate 10 por rodada, os mais velhos primeiro.
    if (viaAdmin && temRoteiroEm && Date.now() - t0 < 70000) {
      // PEDIDO PRIMEIRO (26/10/2026, Vitorio: "olha o tanto de lance que ja era para ter saido"): as 08:55, 41 vendedores com pedido e so 11 com o pedido no roteiro gravado;
      // sem roteiro novo nao nasce lance. Agora vai primeiro quem VENDEU e tem a produtividade mais nova que o roteiro (pedido ainda fora da rota gravada); depois o mais velho.
      const atrasado = (a) => (feitasGer.get(String(a.filial_sigla).toUpperCase() + '|' + a.rca_codigo) || 0) > (Number(a.n_feitas_rot) || 0) ? '0' : (a.pos > 0 || a.dig > 0) && String(a.pe || '') > String(a.roteiro_em || '') ? '1' : '2';   // 0 = gerente ve visita nova; 1 = vendeu
      const comRota = rcas.filter((r) => { const a = ant.get(kr(r)); return a && (a.n_rota > 0 || a.pos > 0 || a.dig > 0 || (feitasGer.get(kr(r)) || 0) > (Number(a.n_feitas_rot) || 0)) && !jaBuscouRota.has(kr(r)); })
        .sort((x, y) => { const k = (r) => { const a = ant.get(kr(r)) || {}; return atrasado(a) + String(a.roteiro_em || ''); }; return k(x).localeCompare(k(y)); }).slice(0, 40);   // 26/10/2026: 10 -> 40. Medido: rodadas de ~30 chamadas terminavam em 20 s (de 115) com 0-6 recusas; o limite era nosso. A pausa do 429 freia sozinha
      const rr = await poolLimitado(comRota.map((rca) => () => getJson(urlRca('roteiro-hoje', rca), 1)), concAtual, Math.min(Date.now() + 45000, t0 + PRAZO_GLOBAL_MS - 20000));
      comRota.forEach((rca, i) => {
        if (!Array.isArray(rr[i])) return;
        contagem.rota_renovada = (contagem.rota_renovada || 0) + 1;
        jaBuscouRota.add(kr(rca));
        stmts.push(upsertParcial(env, dataRef, rca, { roteiro_json: JSON.stringify(rr[i]) }));
      });
      await gravaLote(env, stmts.splice(0));
    }

    // 3. MORNA: rota de todos, em fatias (so quem ainda nao foi buscado por evento)
    const fatiaRota = viaAdmin ? [] : rcas.filter((rca, i) => i % FATIAS_ROTA === ciclo % FATIAS_ROTA && !jaBuscouRota.has(kr(rca)));
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
    const semDash = rcas.filter((rca) => { const a = ant.get(kr(rca)); return a && a.sem_dash; }).slice(0, 30);
    const idsDash = new Set(semDash.map((r) => kr(r)));
    const fatiaDash = viaAdmin ? [] : semDash.concat(rcas.filter((rca, i) => i % FATIAS_FRIA === ciclo % FATIAS_FRIA && !idsDash.has(kr(rca)) && !dashIgual.has(kr(rca))));   // identico na hierarquia = pula
    // QUEM ESTA SEM DEVOLUCAO HOJE VAI PRIMEIRO, em qualquer modo (26/10/2026: no modo admin so entrava quem 'mudou' e 274 de 562 vendedores passaram o dia sem
    // devolucao gravada; o WhatsApp das 17:00 ficou esperando a base completar e nao saiu). Ate 25 por rodada, antes da fatia normal.
    const semDev = rcas.filter((rca) => { const a = ant.get(kr(rca)); return !a || a.sem_dev; }).slice(0, 25), idsSemDev = new Set(semDev.map((r) => kr(r)));
    const fatiaDev0 = viaAdmin
      ? rcas.filter((rca) => devMudou.has(kr(rca))).slice(0, 6)
      : hier
      ? rcas.filter((rca, i) => idsMudou.has(kr(rca)) || i % (FATIAS_DEV * 2) === ciclo % (FATIAS_DEV * 2))   // com a hierarquia: quem mudou + 1/6 por rodada
      : rcas.filter((rca, i) => i % FATIAS_DEV === ciclo % FATIAS_DEV);
    const fatiaDev = semDev.concat(fatiaDev0.filter((rca) => !idsSemDev.has(kr(rca))));
    // A etapa FRIA tem FATIA PROPRIA de tempo (05/10/2026): com o prazo geral, as etapas 1 a 3 consumiam os 100 s e a fria nunca rodava, entao painel (faturado do mes)
    // e devolucoes ficavam congelados no dado da varredura completa (ex.: TPA R$ 42 mil na Executiva contra R$ 133 mil no CEVEN).
    const prazoFria = Date.now() + 30000;
    // DEVOLUCOES primeiro (prioridade) e ponto de partida GIRANDO a cada tick: se o prazo estourar, nao e sempre o mesmo vendedor do fim da lista que fica sem atualizar
    const rodar = (L) => { if (!L.length) return L; const k = (ciclo * 7) % L.length; return L.slice(k).concat(L.slice(0, k)); };
    // Dashboard e devolucoes com PRAZO PROPRIO cada (20 s + 20 s dentro do orcamento do tick): um nao come o tempo do outro.
    const itensDev = semDev.concat(rodar(fatiaDev.slice(semDev.length))).map((rca) => ({ rca, tipo: 'devolucoes' }));
    const itensDash = fatiaDash.map((rca) => ({ rca, tipo: 'dashboard' }));
    const itensFria = [...itensDev, ...itensDash];
    const buscaFria = (L, ms) => poolLimitado(L.map((it) => () => getJson(urlRca(it.tipo, it.rca))), concAtual, Date.now() + ms);
    const folga = Math.max(0, t0 + PRAZO_GLOBAL_MS - 8000 - Date.now());   // 8 s para gravar, telemetria e responder
    const frias = [...(await buscaFria(itensDev, Math.min(20000, folga * 0.5))), ...(await buscaFria(itensDash, Math.min(20000, folga * 0.4)))];
    const camposPorRca = new Map();
    const campo = (rca) => { const k = kr(rca); if (!camposPorRca.has(k)) camposPorRca.set(k, { rca, campos: {} }); return camposPorRca.get(k).campos; };
    itensFria.forEach((it, i) => { const r = frias[i]; if (it.tipo === 'dashboard' && r) campo(it.rca).dashboard_json = JSON.stringify(r); if (it.tipo === 'devolucoes' && Array.isArray(r)) campo(it.rca).devolucoes_json = JSON.stringify(r); });
    for (const { rca, campos } of camposPorRca.values()) { contagem.fria++; stmts.push(upsertParcial(env, dataRef, rca, campos)); }
    await gravaLote(env, stmts.splice(0));

    // Encadeia o MAPA DA EXECUTIVA logo apos a rodada (05/10/2026): antes ele rodava em cron proprio de 5 em 5 min e o atraso se somava ao da varredura
    // (pedido novo levava ate ~8 min para chegar na Executiva). So se sobrou tempo antes de a trava expirar (150 s).
    // telemetria ANTES da etapa do mapa (que pode demorar ate 30 s e estourar o prazo do agendador)
    // ROTEIRO DO MES (26/10/2026): quem ainda nao tem o do dia, ate 40 (madrugada) ou 8 (dia) por rodada
    if (await garanteRoteiroMes(env) && Date.now() - t0 < 80000) {
      try {
        const { results: semMes } = await env.DB.prepare('SELECT rca_codigo, filial_sigla FROM varredura_central_rca WHERE data_ref = ? AND roteiro_mes_json IS NULL').bind(dataRef).all();
        const falta = new Set((semMes || []).map((x) => String(x.filial_sigla).toUpperCase() + '|' + x.rca_codigo));
        const alvo = rcas.filter((r) => falta.has(kr(r))).slice(0, madrugada ? 40 : 8);
        const rm = await poolLimitado(alvo.map((rca) => () => getJson(urlRca('roteiro-mes', rca), 1)), concAtual, Math.min(Date.now() + 25000, t0 + PRAZO_GLOBAL_MS - 15000));
        alvo.forEach((rca, i) => { if (Array.isArray(rm[i])) { stmts.push(upsertParcial(env, dataRef, rca, { roteiro_mes_json: JSON.stringify(rm[i]) })); contagem.roteiro_mes = (contagem.roteiro_mes || 0) + 1; } });
        await gravaLote(env, stmts.splice(0));
      } catch (e) { contagem.roteiro_mes_erro = String(e.message || e).slice(0, 80); }
    }
    // SUPERVISORES E RET (26/10/2026): grava compromissos e RET com prazo
    if (Date.now() - t0 < 95000) {
      try { contagem.supervisores = await coletaSupervisores(env); } catch (e) { contagem.supervisores = { erro: String(e.message || e).slice(0, 80) }; }
    } else {
      contagem.supervisores = 'pulado_prazo';
    }
    if (Date.now() - t0 < 90000) { try { contagem.pedidos_dia = await coletaPedidosDoDia(env, dataRef); } catch (e) { contagem.pedidos_dia = { erro: String(e.message || e).slice(0, 80) }; } }
    if (!env.TESTE_SEM_HORARIO && Date.now() - t0 < 95000) { try { contagem.macro = await coletaMacroForaArvore(env); } catch (e) { contagem.macro = { erro: String(e.message || e).slice(0, 80) }; } }
    if (Date.now() - t0 < 95000) { try { contagem.recheca = await rechecaAbertosPorVendedor(env, noiteTodos ? 90 : 15, t0 + 150000);   /* todos os ~250 vendedores com pedido aberto: ~30 min de dia e a cada 30 min de noite (31/10/2026) */ } catch (e) { contagem.recheca = { erro: String(e.message || e).slice(0, 80) }; } }
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
