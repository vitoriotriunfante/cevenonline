// =========================================================================
// FICHA DO ARQUIVO: functions/api/saude.js
// O QUE É: "painel da NASA" do sistema — um JSON único com a saúde da coleta de dados, do CEVEN, da Gestão de Equipe, dos lances,
//          do WhatsApp e das metas. Alimenta public/saude.html (/saude). Pedido do Vitório (12/10/2026): em vez de alerta no WhatsApp,
//          uma tela para ver tudo: base, acessos, velocidade, coleta.
// SÓ LEITURA: lê o D1 e faz UMA sonda ao CEVEN (1 chamada, cache de 45 s). Nada é gravado aqui. Nunca inventa dado: o que não deu para medir vem null.
// SEMÁFORO: ok | atencao | critico, por bloco, e `problemas[]` com o texto do que está errado.
// =========================================================================
import { CEVEN_HDR } from '../_lib/ceven_auth.js';
import { calculaResumoMes } from '../_lib/resumo_base.js';
import { foraDoHorario } from '../_lib/horario_reduzido.js';

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const FILIAIS = ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];

const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const horaSP = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
const utc = (s) => Date.parse(String(s).replace(' ', 'T') + 'Z');
const safe = async (fn, padrao = null) => { try { return await fn(); } catch { return padrao; } };

// A SONDA NAO CHAMA MAIS O CEVEN (13/10/2026): cada atualizacao do painel gastava 1 das ~3 chamadas/min que o CEVEN deixa passar em /api/rca/* e ainda renovava o bloqueio.
// O estado vem do que a propria coleta registrou (ceven_ban_ate em coleta_estado).
async function sondaCeven(env) {
  const b = await safe(() => env.DB.prepare("SELECT valor FROM coleta_estado WHERE chave = 'ceven_ban_ate'").first());
  const ate = Number(b && b.valor) || 0, resta = Math.ceil((ate - Date.now()) / 1000);
  return { http: resta > 0 ? 429 : 200, ms: 0, retry_after: resta > 0 ? resta : null, em: new Date().toISOString(), derivada: true };
}

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 não configurado' }), { status: 503, headers: CORS });
  const origin = new URL(request.url).origin;
  const dia = hojeSP(), agora = Date.now(), hm = horaSP();
  const diaUtil = ![0, 6].includes(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay());
  const horarioComercial = !foraDoHorario();   /* mesma regra dos crons (25/10/2026): fora das 06h-21h e domingo a coleta roda a cada 30 min; nao alarma */
  const problemas = [];
  const add = (nivel, bloco, texto) => problemas.push({ nivel, bloco, texto });

  // ---------- 1. BASE (varredura central) ----------
  const linhas = (await safe(async () => (await env.DB.prepare(
    `SELECT rca_codigo AS r, filial_sigla AS f, updated_at AS ua,
            (dashboard_json IS NULL OR dashboard_json = 'null') AS sd, (produtividade_json IS NULL OR produtividade_json = 'null') AS sp,
            (roteiro_json IS NULL OR roteiro_json = 'null') AS sr, (devolucoes_json IS NULL OR devolucoes_json = 'null') AS sv,
            CAST(json_extract(dashboard_json, '$.financeiro.meta') AS REAL) AS meta, CAST(json_extract(dashboard_json, '$.financeiro.faturado') AS REAL) AS fat,
            CAST(json_extract(dashboard_json, '$.financeiro.pendente') AS REAL) AS pend, CAST(json_extract(dashboard_json, '$.positivacao.meta') AS REAL) AS pmeta,
            CAST(json_extract(dashboard_json, '$.positivacao.realizado') AS REAL) AS preal,
            CAST(json_extract(produtividade_json, '$.dia.dig_pedido') AS REAL) AS dig
       FROM varredura_central_rca WHERE data_ref = ?`).bind(dia).all()).results, [])) || [];
  const idades = linhas.map((l) => Math.round((agora - utc(l.ua)) / 1000)).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const base = {
    data_ref: dia, rcas: linhas.length,
    mais_novo_s: idades[0] ?? null, mediana_s: q(idades, 0.5), p90_s: q(idades, 0.9), mais_antigo_s: idades.length ? idades[idades.length - 1] : null,
    acima_15min: idades.filter((x) => x > 900).length,
    sem_dashboard: linhas.filter((l) => l.sd).length, sem_produtividade: linhas.filter((l) => l.sp).length,
    sem_rota: linhas.filter((l) => l.sr).length, sem_devolucoes: linhas.filter((l) => l.sv).length
  };
  // fora do horario comercial tambem avisa (16/10/2026 00h: base zerada e o painel dizia 'Todos os sistemas operando')
  if (!linhas.length) add(horarioComercial ? 'critico' : 'atencao', 'base', horarioComercial ? `Base de hoje VAZIA (${hm}). Nenhuma leitura gravada: coleta parada.` : `Base de hoje ainda vazia (${hm}): virada do dia, a coleta está lendo todos de novo.`);
  else {
    if (diaUtil && horarioComercial && base.mais_novo_s > 600) add('critico', 'base', `Coleta parada: a última gravação tem ${Math.round(base.mais_novo_s / 60)} min.`);
    else if (base.mais_novo_s > 300 && horarioComercial) add('atencao', 'base', `Última gravação há ${Math.round(base.mais_novo_s / 60)} min.`);
    if (base.sem_dashboard) add(base.sem_dashboard > 20 ? 'critico' : 'atencao', 'base', `${base.sem_dashboard} RCAs sem dashboard (meta/faturado).`);
    if (base.sem_produtividade) add(base.sem_produtividade > 20 ? 'critico' : 'atencao', 'base', `${base.sem_produtividade} RCAs sem produtividade (vendas do dia).`);
    if (base.sem_rota > 20) add('atencao', 'base', `${base.sem_rota} RCAs sem rota.`);
    if (base.acima_15min > 60 && horarioComercial) add('atencao', 'base', `${base.acima_15min} RCAs com leitura de mais de 15 min.`);
  }

  // ---------- 2. por filial ----------
  const porFilial = {};
  for (const f of FILIAIS) porFilial[f] = { filial: f, rcas: 0, sem_dashboard: 0, sem_produtividade: 0, sem_rota: 0, meta_fat: 0, faturado: 0, pendente: 0, meta_pos: 0, positivados: 0, digitado_hoje: 0, mais_antigo_s: 0 };
  for (const l of linhas) {
    const p = porFilial[l.f] || (porFilial[l.f] = { filial: l.f, rcas: 0, sem_dashboard: 0, sem_produtividade: 0, sem_rota: 0, meta_fat: 0, faturado: 0, pendente: 0, meta_pos: 0, positivados: 0, digitado_hoje: 0, mais_antigo_s: 0 });
    p.rcas++; p.sem_dashboard += l.sd ? 1 : 0; p.sem_produtividade += l.sp ? 1 : 0; p.sem_rota += l.sr ? 1 : 0;
    p.meta_fat += l.meta || 0; p.faturado += l.fat || 0; p.pendente += l.pend || 0; p.meta_pos += l.pmeta || 0; p.positivados += l.preal || 0; p.digitado_hoje += l.dig || 0;
    p.mais_antigo_s = Math.max(p.mais_antigo_s, Math.round((agora - utc(l.ua)) / 1000));
  }
  const filiais = Object.values(porFilial);
  for (const p of filiais) if (!p.rcas && linhas.length) add('critico', 'filiais', `${p.filial}: nenhum RCA na base de hoje.`);

  // ---------- 3. coleta (telemetria por tick) ----------
  const ticks = (await safe(async () => (await env.DB.prepare(
    "SELECT ts, modo, rcas, gravados, chamadas, ok, r429, r401, falhas, duracao_ms FROM saude_coleta WHERE ts > datetime('now', '-3 hours') ORDER BY ts"
  ).all()).results, [])) || [];
  // linha com modo terminado em '*' = rodada que COMECOU e ainda nao fechou (ou foi cortada pelo agendador): conta como sinal de vida, mas nao entra nas somas
  const concluidos = ticks.filter((t) => !String(t.modo || '').endsWith('*'));
  const cortadas60 = ticks.filter((t) => String(t.modo || '').endsWith('*') && agora - utc(t.ts) > 4 * 60000 && agora - utc(t.ts) <= 3600000).length;
  const ult60 = concluidos.filter((t) => agora - utc(t.ts) <= 3600000);
  const soma = (a, k) => a.reduce((x, t) => x + (t[k] || 0), 0);
  const estConc = await safe(async () => await env.DB.prepare("SELECT valor, motivo, atualizado_em FROM coleta_estado WHERE chave = 'conc'").first());
  const coleta = {
    concorrencia: estConc ? { atual: Number(estConc.valor), motivo: estConc.motivo, em: estConc.atualizado_em } : null,
    ticks_3h: concluidos.length, ticks_60min: ult60.length, rodadas_cortadas_60min: cortadas60,
    ultimo_tick_em: ticks.length ? ticks[ticks.length - 1].ts : null,
    chamadas_60min: soma(ult60, 'chamadas'), ok_60min: soma(ult60, 'ok'), r429_60min: soma(ult60, 'r429'), r401_60min: soma(ult60, 'r401'), falhas_60min: soma(ult60, 'falhas'),
    duracao_media_ms: ult60.length ? Math.round(soma(ult60, 'duracao_ms') / ult60.length) : null,
    taxa_sucesso_pct: soma(ult60, 'chamadas') ? Math.round((soma(ult60, 'ok') / soma(ult60, 'chamadas')) * 1000) / 10 : null,
    serie: concluidos.map((t) => ({ ts: t.ts, chamadas: t.chamadas, ok: t.ok, r429: t.r429, r401: t.r401, falhas: t.falhas, ms: t.duracao_ms, gravados: t.gravados }))
  };
  if (coleta.r401_60min > 0) add('critico', 'ceven', `CEVEN devolveu 401/403 ${coleta.r401_60min}x na última hora: a chave pode ter mudado.`);
  if (coleta.r429_60min > 20) add('atencao', 'ceven', `CEVEN limitando (429) ${coleta.r429_60min}x na última hora: cota esgotada.`);
  if (diaUtil && horarioComercial && ticks.length && agora - utc(ticks[ticks.length - 1].ts) > 8 * 60000) add('critico', 'coleta', 'Nenhum ciclo de coleta nos últimos 8 min: o agendador (worker-cron) pode estar parado.');

  // ---------- 4. CEVEN (sonda ao vivo) ----------
  const amostra = linhas[0];
  const sonda = await sondaCeven(env);
  if (sonda) {
    if (sonda.http === 401 || sonda.http === 403) add('critico', 'ceven', 'Sonda ao CEVEN recusada (401/403): chave inválida.');
    else if (sonda.http === 429) add('atencao', 'ceven', `Sonda ao CEVEN limitada (429), libera em ~${sonda.retry_after || '?'} s.`);
    else if (sonda.http === 0) add('critico', 'ceven', `CEVEN não respondeu (${sonda.erro || 'timeout'}).`);
    else if (sonda.http >= 500) add('critico', 'ceven', `CEVEN com erro ${sonda.http}.`);
    else if (sonda.ms > 5000) add('atencao', 'ceven', `CEVEN lento: ${(sonda.ms / 1000).toFixed(1)} s por chamada.`);
  }

  // ---------- 5. Gestão de Equipe + representantes ----------
  const mostra = await safe(async () => (await fetch(origin + '/api/tv-mostra', { signal: AbortSignal.timeout(10000) })).json());
  let equipe = null;
  if (mostra && mostra.filiais) {
    const reps = new Set(), semGestao = [];
    let total = 0, sim = 0, nao = 0, rep = 0;
    const naGestao = new Set();
    for (const lista of Object.values(mostra.filiais)) for (const v of lista) {
      total++; naGestao.add(String(v.rca));
      if (String(v.vinculo || '').toUpperCase().startsWith('REP')) { rep++; reps.add(String(v.rca)); }
      if (v.mostra === false) nao++; else sim++;
    }
    for (const l of linhas) if (!naGestao.has(String(l.r)) && (l.meta || 0) > 0) semGestao.push({ rca: l.r, filial: l.f, meta: Math.round(l.meta) });
    const repL = linhas.filter((l) => reps.has(String(l.r)));
    equipe = {
      origem: mostra.origem, atualizado_em: mostra.atualizado_em || null, atualizado_por: mostra.atualizado_por || null,
      total, mostra_sim: sim, mostra_nao: nao, representantes: rep,
      representantes_meta: Math.round(repL.reduce((a, l) => a + (l.meta || 0), 0)), representantes_faturado: Math.round(repL.reduce((a, l) => a + (l.fat || 0), 0)),
      fora_da_gestao_com_meta: semGestao.length, fora_da_gestao_meta: semGestao.reduce((a, x) => a + x.meta, 0), fora_da_gestao_top: semGestao.sort((a, b) => b.meta - a.meta).slice(0, 8)
    };
    if (mostra.origem !== 'd1') add('critico', 'equipe', 'Gestão de Equipe em CÓPIA ESTÁTICA (D1 indisponível).');
    if (!rep) add('atencao', 'equipe', 'Nenhum vendedor marcado como REPRESENTANTE na Gestão (vínculo ainda não aplicado).');
    if (semGestao.length) add('atencao', 'equipe', `${semGestao.length} RCAs com meta no CEVEN que NÃO estão na Gestão de Equipe (R$ ${Math.round(equipe.fora_da_gestao_meta).toLocaleString('pt-BR')}).`);
  } else add('critico', 'equipe', 'Gestão de Equipe não respondeu (/api/tv-mostra).');

  // ---------- 6. metas ----------
  const somaMeta = linhas.reduce((a, l) => a + (l.meta || 0), 0);
  const resumo = await safe(async () => (await env.DB.prepare("SELECT filial_sigla AS f, mes_meta_faturado AS meta, mes_faturado AS fat, updated_at AS ua FROM resumo_executivo_live WHERE data_ref = ? AND filial_sigla != '_LOCK_'").bind(dia).all()).results, []) || [];
  const todas = resumo.find((r) => r.f === 'TODAS');
  const nFilResumo = resumo.filter((r) => r.f !== 'TODAS' && r.meta > 0).length;
  const metas = {
    soma_dos_rcas: Math.round(somaMeta), resumo_todas: todas ? Math.round(todas.meta) : null, resumo_em: todas ? todas.ua : null,
    filiais_no_resumo: nFilResumo, bate: todas ? Math.abs(todas.meta - somaMeta) < 1000 : null
  };
  // INTEGRIDADE (mesma conta que a Matriz usa, direto da base): quantos RCAs entram com leitura de hoje, de dia anterior ou sem leitura
  const rb = await safe(async () => await calculaResumoMes(env, dia));
  if (rb) {
    metas.soma_dos_rcas = Math.round(rb.total.metaFaturado);
    metas.integridade = { rcas: rb.rcas, de_hoje: rb.deHoje, leitura_anterior: rb.anteriores, sem_leitura: rb.semLeitura, mais_antiga: rb.maisAntiga, meta_fat: Math.round(rb.total.metaFaturado), meta_pos: Math.round(rb.total.metaPositivados) };
    if (rb.semLeitura > 0) add('atencao', 'metas', `${rb.semLeitura} RCAs sem NENHUMA leitura nos ultimos 7 dias (fora da soma).`);
    if (rb.anteriores > 0) add(horarioComercial && hm > '09:00' ? 'critico' : 'atencao', 'metas', `${rb.anteriores} RCAs entram na soma com leitura de dia anterior (ainda sem leitura de hoje).`);
  }
  // CONSISTENCIA ENTRE TELAS: as duas fontes que a Matriz usa para o total tem que ser identicas
  const mm = await safe(async () => (await fetch(origin + '/api/metas-mes', { signal: AbortSignal.timeout(10000) })).json());
  const mx = await safe(async () => (await fetch(origin + '/api/mapa-executivo-live', { signal: AbortSignal.timeout(15000) })).json());
  if (mm && mm.total && mx && mx.resumo && mx.resumo.TODAS) {
    metas.matriz_mostra = Math.round(mm.total.meta_fat);
    metas.executiva_mostra = Math.round(mx.resumo.TODAS.mesMetaFaturado);
    if (Math.abs(mm.total.meta_fat - mx.resumo.TODAS.mesMetaFaturado) > 1) add('critico', 'metas', `Matriz (R$ ${metas.matriz_mostra.toLocaleString('pt-BR')}) e Executiva (R$ ${metas.executiva_mostra.toLocaleString('pt-BR')}) mostram metas diferentes.`);
  }
  if (linhas.length && nFilResumo < 11) add('atencao', 'metas', `Resumo do mês com ${nFilResumo}/11 filiais (a Matriz pode estar mostrando meta parcial).`);
  else if (todas && Math.abs(todas.meta - somaMeta) > Math.max(1000, somaMeta * 0.01)) add('atencao', 'metas', `Meta da Matriz (R$ ${Math.round(todas.meta).toLocaleString('pt-BR')}) difere da soma dos RCAs (R$ ${Math.round(somaMeta).toLocaleString('pt-BR')}); recalcula em até 15 min.`);

  // ---------- 7. lances do dia ----------
  const lances = await safe(async () => await env.DB.prepare("SELECT COUNT(*) AS n, MAX(hora_sp) AS ultima FROM tv_lances WHERE dia = ?").bind(dia).first());
  const porNivel = await safe(async () => (await env.DB.prepare("SELECT nivel, COUNT(*) AS n FROM tv_lances WHERE dia = ? GROUP BY nivel ORDER BY n DESC").bind(dia).all()).results, []) || [];
  const lancesBloco = { hoje: lances ? lances.n : null, ultimo_hora_sp: lances ? lances.ultima : null, por_nivel: porNivel };
  if (lances && lances.n === 0 && diaUtil && hm > '10:00') add('atencao', 'lances', 'Nenhum lance gravado hoje depois das 10h.');

  // ---------- 8. WhatsApp ----------
  const wpp = await safe(async () => (await fetch(origin + '/api/disparo-status', { signal: AbortSignal.timeout(12000) })).json());
  if (wpp && Array.isArray(wpp.problemas)) for (const p of wpp.problemas) add('critico', 'whatsapp', p.texto || `Disparo das ${p.hm} com problema`);

  // ---------- 9. publicação ----------
  const versao = await safe(async () => (await fetch(origin + '/api/version', { signal: AbortSignal.timeout(6000) })).json());

  const nivel = problemas.some((p) => p.nivel === 'critico') ? 'critico' : problemas.length ? 'atencao' : 'ok';
  return new Response(JSON.stringify({
    gerado_em: new Date(agora).toISOString(), hora_sp: hm, dia, dia_util: diaUtil, horario_comercial: horarioComercial, nivel, problemas,
    base, filiais, coleta, ceven: { sonda, requisicoes_60min: coleta.chamadas_60min, r429_60min: coleta.r429_60min, r401_60min: coleta.r401_60min, taxa_sucesso_pct: coleta.taxa_sucesso_pct },
    equipe, metas, lances: lancesBloco, whatsapp: wpp ? { dia_util: wpp.dia_util, horarios: wpp.horarios || [], erro: wpp.erro || null } : null, versao: versao ? versao.version : null
  }), { headers: CORS });
}
