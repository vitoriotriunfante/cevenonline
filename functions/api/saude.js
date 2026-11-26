// =========================================================================
// FICHA DO ARQUIVO: functions/api/saude.js (v2 — Arquitetura GEROT + Clube)
// O QUE E: painel de controle (/saude) com saude do GEROT, Portao Contabil,
//   Clube da Venda, Gestao de Equipe, Lances, WhatsApp e Gabarito JOTA.
//   CEVEN antigo marcado como desligado/legado (zero alertas falsos).
// SO LEITURA: le exclusivamente D1 (fatos/) e endpoints GET internos.
// =========================================================================
import { foraDoHorario } from '../_lib/horario_reduzido.js';
import { filiaisGerot } from '../_lib/fatos/index.js';
import R from '../../public/regras.js';

const CORS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=10, s-maxage=10, stale-while-revalidate=5'
};
const FILIAIS = ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];

const hojeSP = () => R.hojeSP();
const horaSP = () => R.relogioSP().hm;
const utc = (s) => {
  if (!s) return NaN;
  const iso = String(s).includes('T') ? String(s) : String(s).replace(' ', 'T') + 'Z';
  return Date.parse(iso);
};
const safe = async (fn, padrao = null) => { try { return await fn(); } catch { return padrao; } };
let memSaude = { exp: 0, json: null };

// Legado: apenas leitura passiva de coleta_estado (motor CEVEN desligado).
async function sondaCeven(env) {
  const b = await safe(() => env.DB.prepare("SELECT valor, atualizado_em FROM coleta_estado WHERE chave = 'ceven_ban_ate'").first());
  const ate = Number(b && b.valor) || 0;
  const resta = Math.ceil((ate - Date.now()) / 1000);
  return {
    status: 'desligado',
    legado: true,
    http: null,
    ms: 0,
    retry_after: resta > 0 ? resta : null,
    em: new Date().toISOString(),
    derivada: true
  };
}

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: CORS });
  const urlObj = new URL(request.url);
  if (memSaude.json && Date.now() < memSaude.exp && !urlObj.searchParams.has('fresco')) {
    return new Response(memSaude.json, { headers: CORS });
  }
  const origin = urlObj.origin;
  const dia = hojeSP(), mes = dia.slice(0, 7), agora = Date.now(), hm = horaSP();
  const diaUtil = ![0, 6].includes(R.relogioSP().dow);
  const horarioComercial = !foraDoHorario();
  const problemas = [];
  const add = (nivel, bloco, texto) => problemas.push({ nivel, bloco, texto });

  // ---------- 1. GEROT & PORTAO CONTABIL + BRIEFING CACHE ----------
  const [gerotSt, portaoCtrl, versaoAtivaRow, briefCountRow, filGerot, vendGerotRes] = await Promise.all([
    safe(() => env.DB.prepare('SELECT id, mes, linhas, enviadas, posicao, em FROM gerot_coleta_status ORDER BY id DESC LIMIT 1').first()),
    safe(() => env.DB.prepare("SELECT lote_id, status, filiais, linhas, gravadas, detalhe, atualizado_em FROM gerot_carga_controle WHERE etapa = 'portao_contabil' ORDER BY atualizado_em DESC LIMIT 1").first()),
    safe(() => env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'gerot_versao_ativa'").first()),
    safe(() => env.DB.prepare('SELECT COUNT(*) AS n, MAX(gerado_em) AS ult FROM fatos_briefing_cache WHERE mes = ?').bind(mes).first()),
    safe(() => filiaisGerot(env.DB, mes), []),
    safe(() => env.DB.prepare(
      `SELECT filial, COALESCE(rca_int, CAST(rca AS INTEGER)) AS rca_int,
              COALESCE(meta, CAST(json_extract(dados, '$."Meta (R$)"') AS REAL), 0) AS meta,
              COALESCE(fat_liq, CAST(json_extract(dados, '$."Faturado líquido (R$)"') AS REAL), 0) AS fat_liq,
              COALESCE(carteira, CAST(json_extract(dados, '$."Carteira pendente (R$)"') AS REAL), 0) AS carteira
         FROM gerot_vendedor_mes
        WHERE mes = ? AND rca NOT LIKE '%|%' AND COALESCE(rca_int, CAST(rca AS INTEGER)) > 0 AND COALESCE(rca_int, CAST(rca AS INTEGER)) <> 2`
    ).bind(mes).all())
  ]);

  let versaoAtiva = null;
  try { versaoAtiva = versaoAtivaRow && versaoAtivaRow.valor ? JSON.parse(versaoAtivaRow.valor) : null; } catch {}

  const gerotEm = (gerotSt && gerotSt.em) || (portaoCtrl && portaoCtrl.atualizado_em) || null;
  const gerotIdadeS = Number.isFinite(utc(gerotEm)) ? Math.max(0, Math.round((agora - utc(gerotEm)) / 1000)) : null;
  const portaoStatus = portaoCtrl ? portaoCtrl.status : (gerotSt ? 'OK' : null);

  if (!gerotSt && !(filGerot && filGerot.length)) {
    add('critico', 'gerot', 'Nenhuma carga GEROT encontrada no D1 para o mes atual.');
  } else {
    if (portaoStatus && !['OK', 'FORCADO'].includes(String(portaoStatus).toUpperCase())) {
      add('critico', 'gerot', `Portao Contabil GEROT em estado ${portaoStatus}: ${portaoCtrl?.detalhe || ''}`);
    }
    if (diaUtil && horarioComercial && gerotIdadeS != null && gerotIdadeS > 4 * 3600) {
      add('atencao', 'gerot', `Ultima carga GEROT ha ${Math.round(gerotIdadeS / 3600)} h (${gerotSt?.posicao || 'sem posicao'}).`);
    }
  }

  const gerot = {
    mes,
    posicao: (gerotSt && gerotSt.posicao) || (versaoAtiva && versaoAtiva.posicao) || null,
    atualizado_em: gerotEm,
    idade_s: gerotIdadeS,
    carga_id: (versaoAtiva && versaoAtiva.carga_id) || (portaoCtrl && portaoCtrl.lote_id) || (gerotSt ? String(gerotSt.id) : null),
    portao_status: portaoStatus,
    portao_detalhe: portaoCtrl ? portaoCtrl.detalhe : '',
    filiais_cobertas: (filGerot || []).length,
    briefing_chaves: briefCountRow ? Number(briefCountRow.n) || 0 : 0,
    linhas_ultimo_lote: gerotSt ? Number(gerotSt.linhas) || 0 : 0
  };

  // ---------- 2. CLUBE DA VENDA (intraday) ----------
  const [clubeSt, clubeDiaAgg, clubePedAgg] = await Promise.all([
    safe(() => env.DB.prepare('SELECT dia, lido_em, vendedores, falhas, duracao_s FROM clube_coleta_status ORDER BY id DESC LIMIT 1').first()),
    safe(() => env.DB.prepare('SELECT COUNT(*) AS rcas, COALESCE(SUM(total_pedido), 0) AS dig, MAX(lido_em) AS ult FROM clube_venda_dia WHERE dia = ?').bind(dia).first()),
    safe(() => env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS tot, MAX(lido_em) AS ult FROM clube_pedido WHERE dia = ?').bind(dia).first())
  ]);
  const clubeEm = (clubeDiaAgg && clubeDiaAgg.ult) || (clubeSt && clubeSt.lido_em) || null;
  const clubeIdadeS = Number.isFinite(utc(clubeEm)) ? Math.max(0, Math.round((agora - utc(clubeEm)) / 1000)) : null;
  if (diaUtil && hm >= '08:30' && hm <= '19:30') {
    if (!clubeDiaAgg || !(Number(clubeDiaAgg.rcas) > 0)) {
      add('atencao', 'clube', `Clube da Venda ainda sem leituras de hoje (${dia}).`);
    } else if (clubeIdadeS != null && clubeIdadeS > 45 * 60) {
      add('atencao', 'clube', `Ultima leitura do Clube da Venda ha ${Math.round(clubeIdadeS / 60)} min.`);
    }
  }
  const clube = {
    dia,
    lido_em: clubeEm,
    idade_s: clubeIdadeS,
    rcas_lidos: clubeDiaAgg ? Number(clubeDiaAgg.rcas) || 0 : 0,
    digitado_hoje: clubeDiaAgg ? Math.round(Number(clubeDiaAgg.dig) || 0) : 0,
    pedidos_hoje: clubePedAgg ? Number(clubePedAgg.n) || 0 : 0,
    duracao_s: clubeSt ? clubeSt.duracao_s : null,
    falhas: clubeSt ? clubeSt.falhas : null
  };

  // ---------- 3. GESTAO DE EQUIPE + CONCILIACAO GEROT ----------
  const mostra = await safe(async () => (await fetch(origin + '/api/tv-mostra', { signal: AbortSignal.timeout(10000) })).json());
  const gestaoKeys = new Set();
  const rcaGestaoSet = new Set();
  let equipe = null;
  const reps = new Set();
  if (mostra && mostra.filiais) {
    let total = 0, sim = 0, nao = 0, rep = 0;
    for (const [k, lista] of Object.entries(mostra.filiais)) {
      const f = k.split('_')[0];
      for (const v of lista || []) {
        total++;
        const rStr = String(Number(v.rca) || v.rca);
        gestaoKeys.add(`${f}|${rStr}`);
        rcaGestaoSet.add(rStr);
        if (String(v.vinculo || '').toUpperCase().startsWith('REP')) { rep++; reps.add(rStr); }
        if (v.mostra === false) nao++; else sim++;
      }
    }
    const vendGerotRows = (vendGerotRes && vendGerotRes.results) || [];
    const semGestaoMap = new Map();
    const repsSoma = { meta: 0, fat: 0 };
    for (const vg of vendGerotRows) {
      const f = vg.filial, r = String(vg.rca_int);
      if (reps.has(r)) {
        repsSoma.meta += Number(vg.meta) || 0;
        repsSoma.fat += Number(vg.fat_liq) || 0;
      }
      const key = `${f}|${r}`;
      if (!gestaoKeys.has(key) && (Number(vg.meta) > 0 || Math.abs(Number(vg.fat_liq)) > 0)) {
        const cur = semGestaoMap.get(key) || { filial: f, rca: r, meta: 0 };
        cur.meta += Math.round(Number(vg.meta) || 0);
        semGestaoMap.set(key, cur);
      }
    }
    const semGestao = [...semGestaoMap.values()].filter((x) => x.meta > 0).sort((a, b) => b.meta - a.meta);
    equipe = {
      origem: mostra.origem,
      atualizado_em: mostra.atualizado_em || null,
      atualizado_por: mostra.atualizado_por || null,
      total,
      mostra_sim: sim,
      mostra_nao: nao,
      representantes: rep,
      representantes_meta: Math.round(repsSoma.meta),
      representantes_faturado: Math.round(repsSoma.fat),
      fora_da_gestao_com_meta: semGestao.length,
      fora_da_gestao_meta: semGestao.reduce((a, x) => a + x.meta, 0),
      fora_da_gestao_top: semGestao.slice(0, 8)
    };
    if (mostra.origem !== 'd1') add('critico', 'equipe', 'Gestao de Equipe em COPIA ESTATICA (D1 indisponivel).');
    if (semGestao.length) add('atencao', 'equipe', `${semGestao.length} RCAs com meta no GEROT que NAO estao na Gestao de Equipe (R$ ${Math.round(equipe.fora_da_gestao_meta).toLocaleString('pt-BR')}).`);
  } else {
    add('critico', 'equipe', 'Gestao de Equipe nao respondeu (/api/tv-mostra).');
  }

  // ---------- 4. FILIAIS (100% FATOS GEROT + DIG CLUBE) ----------
  const digFilRes = await safe(() => env.DB.prepare('SELECT filial, SUM(total_pedido) AS dig FROM clube_venda_dia WHERE dia = ? GROUP BY filial').bind(dia).all());
  const digPorFil = new Map(((digFilRes && digFilRes.results) || []).map((r) => [r.filial, Number(r.dig) || 0]));
  const rcaCntPorFil = new Map();
  if (mostra && mostra.filiais) {
    for (const [k, l] of Object.entries(mostra.filiais)) {
      const f = k.split('_')[0];
      rcaCntPorFil.set(f, (rcaCntPorFil.get(f) || 0) + (l || []).length);
    }
  }
  const gerotPorFil = new Map((filGerot || []).map((r) => [r.filial, r]));
  const filiais = FILIAIS.map((f) => {
    const g = gerotPorFil.get(f);
    if (!g) add('atencao', 'filiais', `${f}: sem consolidado no GEROT em ${mes}.`);
    return {
      filial: f,
      rcas: rcaCntPorFil.get(f) || 0,
      meta_fat: g ? Math.round(g.meta || 0) : 0,
      faturado: g ? Math.round(g.fat || 0) : 0,
      pendente: g ? Math.round(g.cart || 0) : 0,
      meta_pos: g ? Math.round(g.metaPos || 0) : 0,
      positivados: g ? Math.round(g.pos || 0) : 0,
      digitado_hoje: Math.round(digPorFil.get(f) || 0),
      tmf_dias: g && g.tmf != null ? Number(g.tmf) : null,
      em_gerot: g ? g.em : null
    };
  });

  const somaMetaGerot = filiais.reduce((s, x) => s + (x.meta_fat || 0), 0);
  const mm = await safe(async () => (await fetch(origin + '/api/metas-mes', { signal: AbortSignal.timeout(10000) })).json());
  const matrizMeta = mm && mm.total && mm.total.meta_fat != null ? Math.round(mm.total.meta_fat) : null;
  const metas = {
    soma_dos_rcas: somaMetaGerot,
    resumo_todas: somaMetaGerot,
    matriz_mostra: matrizMeta,
    filiais_no_resumo: (filGerot || []).length,
    bate: matrizMeta == null ? null : Math.abs(somaMetaGerot - matrizMeta) <= 5
  };
  if (matrizMeta != null && Math.abs(somaMetaGerot - matrizMeta) > 5) {
    add('critico', 'metas', `Meta GEROT (R$ ${somaMetaGerot.toLocaleString('pt-BR')}) diverge da Matriz (R$ ${matrizMeta.toLocaleString('pt-BR')}).`);
  }

  // ---------- 5. LANCES, WHATSAPP E GABARITO ----------
  const [lances, porNivel, jotaAudit] = await Promise.all([
    safe(() => env.DB.prepare('SELECT COUNT(*) AS n, MAX(hora_sp) AS ultima FROM tv_lances WHERE dia = ?').bind(dia).first()),
    safe(() => env.DB.prepare('SELECT nivel, COUNT(*) AS n FROM tv_lances WHERE dia = ? GROUP BY nivel ORDER BY n DESC').bind(dia).all()),
    safe(() => env.DB.prepare('SELECT id, em, origem, ok, total FROM jota_auditoria ORDER BY id DESC LIMIT 1').first())
  ]);
  const lancesBloco = { hoje: lances ? lances.n : null, ultimo_hora_sp: lances ? lances.ultima : null, por_nivel: (porNivel && porNivel.results) || [] };
  if (lances && lances.n === 0 && diaUtil && hm > '10:30') add('atencao', 'lances', 'Nenhum lance gravado hoje depois das 10h30.');

  const wpp = await safe(async () => (await fetch(origin + '/api/disparo-status', { signal: AbortSignal.timeout(12000) })).json());
  if (wpp && Array.isArray(wpp.problemas)) {
    for (const p of wpp.problemas) add('critico', 'whatsapp', p.texto || `Disparo das ${p.hm} com problema`);
  }

  // ---------- 6. METADADOS LEGADO CEVEN (DESLIGADO) E VERSAO ----------
  const [estConc, sonda, versao] = await Promise.all([
    safe(() => env.DB.prepare("SELECT valor, motivo, atualizado_em FROM coleta_estado WHERE chave = 'conc'").first()),
    sondaCeven(env),
    safe(async () => (await fetch(origin + '/api/version', { signal: AbortSignal.timeout(6000) })).json())
  ]);
  const coleta = {
    status: 'desligado',
    concorrencia: estConc ? { atual: Number(estConc.valor), motivo: estConc.motivo, em: estConc.atualizado_em } : { atual: 0, motivo: 'Motor CEVEN desligado' },
    ticks_3h: 0, ticks_60min: 0, rodadas_cortadas_60min: 0, ultimo_tick_em: null,
    chamadas_60min: 0, ok_60min: 0, r429_60min: 0, r401_60min: 0, falhas_60min: 0,
    duracao_media_ms: null, taxa_sucesso_pct: null, serie: []
  };
  const base = {
    data_ref: dia,
    rcas: equipe ? equipe.total : 0,
    mais_novo_s: gerotIdadeS,
    mediana_s: gerotIdadeS,
    p90_s: gerotIdadeS,
    mais_antigo_s: gerotIdadeS,
    acima_15min: 0,
    sem_dashboard: 0, sem_produtividade: 0, sem_rota: 0, sem_devolucoes: 0
  };

  const nivel = problemas.some((p) => p.nivel === 'critico') ? 'critico' : problemas.length ? 'atencao' : 'ok';
  const outObj = {
    gerado_em: new Date(agora).toISOString(),
    hora_sp: hm,
    dia,
    dia_util: diaUtil,
    horario_comercial: horarioComercial,
    nivel,
    problemas,
    gerot,
    clube,
    base,
    filiais,
    coleta,
    ceven: {
      status: 'desligado',
      legado: true,
      sonda,
      requisicoes_60min: 0,
      r429_60min: coleta.r429_60min,
      r401_60min: coleta.r401_60min,
      taxa_sucesso_pct: null
    },
    equipe,
    metas,
    lances: lancesBloco,
    jota: jotaAudit ? { ultimo_em: jotaAudit.em, origem: jotaAudit.origem, ok: jotaAudit.ok, total: jotaAudit.total } : null,
    whatsapp: wpp ? { dia_util: wpp.dia_util, horarios: wpp.horarios || [], erro: wpp.erro || null } : null,
    versao: versao ? versao.version : null
  };
  memSaude = { exp: Date.now() + 15000, json: JSON.stringify(outObj) };
  return new Response(memSaude.json, { headers: CORS });
}
