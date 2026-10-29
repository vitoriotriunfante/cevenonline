// =========================================================================
// JOTA · functions/_lib/jota/fontes.js
// O QUE É: leitura das bases (site, GitHub, Premiação RV), cada fonte uma vez por pergunta.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { hojeSP, sem } from './base.js';

// ---------------- BASE (carregada sob demanda, cada fonte uma vez so) ----------------
export const REPO = 'vitoriotriunfante/cevenonline';
export const gh = (p) => fetch(`https://raw.githubusercontent.com/${REPO}/main/${p.split('/').map(encodeURIComponent).join('/')}`, { cf: { cacheTtl: 300, cacheEverything: true }, signal: AbortSignal.timeout(20000) }).then((r) => { if (!r.ok) throw new Error('gh ' + r.status); return r.text(); });
export function criaBase(origin, env) {
  const cache = {};
  const api = (p) => fetch(origin + p, { signal: AbortSignal.timeout(25000) }).then((r) => r.json()).catch(() => null);
  const est = (p) => (env && env.ASSETS ? env.ASSETS.fetch(new Request(origin + p)) : fetch(origin + p)).then((r) => r.json()).catch(() => null);
  const memo = (k, f) => cache[k] || (cache[k] = f());
  return {
    env,
    saude: () => memo('saude', () => api('/api/saude')),
    mostra: () => memo('mostra', () => api('/api/tv-mostra')),
    // VIRADA DO DIA (26/10/2026, 01h): a base de hoje so enche com a primeira coleta; ate la vinha VAZIA e toda pergunta de equipe saia 'R$ 0'
    // com texto quebrado. Agora: base de hoje vazia -> usa o ULTIMO DIA COM DADO REAL (ate 4 dias atras) e marca cache.baseDe para o aviso.
    snap: (f) => memo('snap' + f, async () => {
      const h = hojeSP(); const s = await api('/api/central-snapshot?filial=' + f + '&dia=' + h);
      // Auto-aquecimento: se a base de hoje da filial estiver com dado muito velho (> 25 min) em horário comercial, dispara varredura em background
      const maxIdade = s && s.rcas ? Math.max(...Object.values(s.rcas).map((r) => r.idade_s || 0)) : 9999;
      if (maxIdade > 1500) fetch(origin + '/api/cron-varredura-central?filial=' + f + '&forcar=1').catch(() => {});
      if (s && s.rcas && Object.keys(s.rcas).length) return s;
      for (let k = 1; k <= 4; k++) { const d = new Date(Date.parse(h + 'T12:00:00Z') - k * 864e5).toISOString().slice(0, 10); const o = await api('/api/central-snapshot?filial=' + f + '&dia=' + d);
        if (o && o.rcas && Object.keys(o.rcas).length) { cache.baseDe = d; return o; } }
      return s;
    }),
    baseDe: () => cache.baseDe || null,
    lances: () => memo('lances', () => api('/api/brasileirao-lances?dia=' + hojeSP())),
    sups: (f) => memo('sup' + f, () => api('/api/tv-supervisores?filial=' + f)),
    // Liga e +MIX: datasets gerados no GitHub (a copia do site pode estar velha); mesma ordem que as telas usam (26/10/2026)
    liga: () => memo('liga', () => gh('public/dados_brasileirao.json').then((t) => JSON.parse(t)).catch(() => est('/dados_brasileirao.json'))),
    mix: () => memo('mix', () => gh('public/dados_mix.json').then((t) => JSON.parse(t)).catch(() => est('/dados_mix.json'))),
    pedidosDia: () => memo('ped', () => api('/api/pedidos-dia?dia=' + hojeSP())),
    metaPosFilial: () => memo('mposf', () => api('/meta_positivacao_filial.json')),   /* meta de positivacao por filial (Premiacao), TEMPORARIA ate o CEVEN corrigir (27/10/2026) */
    pedidosAbertos: () => memo('pedab', () => api('/api/pedidos-dia?abertos=1')),   /* nao faturados dos ultimos 15 dias (linha do tempo) */
    pedidoNum: (n) => memo('pednum' + n, () => api('/api/pedidos-dia?num=' + n)),   /* pedido de qualquer dia (15 d) com a linha do tempo do status */
    raw: (p) => memo('raw' + p, () => gh(p).catch(() => (env && env.ASSETS ? env.ASSETS.fetch(new Request(origin + '/' + p.replace(/^public\//, ''))).then((r) => r.text()) : null))),
    // lista de arquivos da pasta: a API do GitHub limita 60 consultas/hora por IP (dividido com outros clientes da Cloudflare) -> guarda 30 min no D1
    pasta: (p) => memo('dir' + p, async () => {
      const db = env && env.DB, k = 'gh_dir:' + p;
      try { if (db) { await db.prepare('CREATE TABLE IF NOT EXISTS cache_resposta (chave TEXT PRIMARY KEY, corpo TEXT, tipo TEXT, em INTEGER)').run(); const r = await db.prepare('SELECT corpo, em FROM cache_resposta WHERE chave = ?').bind(k).first(); if (r && Date.now() - r.em < 30 * 60 * 1000) return JSON.parse(r.corpo); } } catch (e) {}
      const j = await fetch(`https://api.github.com/repos/${REPO}/contents/${p.split('/').map(encodeURIComponent).join('/')}?ref=main`, { headers: { 'User-Agent': 'jota-ceven', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const nomes = Array.isArray(j) ? j.map((a) => ({ name: a.name })) : null;
      if (nomes && db) { try { await db.prepare('INSERT INTO cache_resposta (chave, corpo, tipo, em) VALUES (?,?,?,?) ON CONFLICT (chave) DO UPDATE SET corpo = excluded.corpo, em = excluded.em').bind(k, JSON.stringify(nomes), 'json', Date.now()).run(); } catch (e) {} }
      if (nomes) return nomes;
      try { if (db) { const r = await db.prepare('SELECT corpo FROM cache_resposta WHERE chave = ?').bind(k).first(); if (r) return JSON.parse(r.corpo); } } catch (e) {}   /* GitHub recusou: usa a lista velha */
      return null;
    }),
    exec: () => memo('exec', () => api('/api/mapa-executivo-live')),
    incentivo: () => memo('inc', () => api('/api/incentivo-outubro')),
    ligaAs: () => memo('ligaas', () => api('/api/liga-as')),
    semana: (f) => memo('sem' + f, () => api('/api/tv-supervisores-semana?filial=' + f)),
    devMot: () => memo('devmot', () => api('/api/devolucoes-motivos')),
    bola: (f) => memo('bola' + f, () => api('/api/bola-cheia?filial=' + f)),
    diverg: () => memo('div', () => api('/api/divergencias')),
    rv: () => memo('rv', () => carregaRV(env)),
    // pedidos que o JOTA nao executa (mudanca de equipe, envio automatico): ficam em bot_sugestoes (painel de conversas) para a diretoria (26/10/2026)
    // ESTADO DA CONVERSA (dialogue state tracking, 27/10/2026): por pessoa, os "campos" da conversa (filial, vendedor, supervisor, assunto, periodo), valido 2 h.
    // Vitorio: "se estou falando de uma filial precisa falar sobre ela... se eu peco a nivel vendedor, ate que eu peca outra coisa, as respostas sao sobre aquele vendedor".
    ctxLer: async (cel) => { try { const db = env && env.DB; if (!db || !cel) return null; await db.prepare('CREATE TABLE IF NOT EXISTS bot_contexto (celular TEXT PRIMARY KEY, json TEXT, em INTEGER)').run();
      const r = await db.prepare('SELECT json, em FROM bot_contexto WHERE celular = ?').bind(String(cel)).first(); return r && Date.now() - r.em < 2 * 3600 * 1000 ? JSON.parse(r.json) : null; } catch (e) { return null; } },
    ctxGravar: async (cel, ctx) => { try { const db = env && env.DB; if (!db || !cel) return; await db.prepare('INSERT INTO bot_contexto (celular, json, em) VALUES (?,?,?) ON CONFLICT (celular) DO UPDATE SET json = excluded.json, em = excluded.em').bind(String(cel), JSON.stringify(ctx || {}), Date.now()).run(); } catch (e) { /* sem estado: segue sem */ } },
    registraPedido: async (tipo, texto, quem, c) => { try { const db = env && env.DB; if (!db || !c) return; const B_CTX = { c }; await db.prepare('INSERT INTO bot_sugestoes (celular, nome, papel, filial, texto, sobre) VALUES (?,?,?,?,?,?)').bind(B_CTX.c.celular || '', B_CTX.c.nome || '', B_CTX.c.papel || '', B_CTX.c.filial || '', `[PEDIDO ${tipo.toUpperCase()}] ${texto}`.slice(0, 1500), quem || '').run(); } catch (e) {} },
  };
}
// PREMIACAO RV (Vitorio, 25/10/2026: "as metas das industrias vc pega dentro do botao premiacao"): a mesma fonte do holerite simulado do CEVEN.
// /rv/api/metas = meta de cada vendedor por industria (tipo 1 = faturamento R$, tipo 0 = positivacao); /rv/api/apuracao-agregada = realizado
// (fat_f faturado, fat_v vendido = faturado + a faturar, pos_f/pos_v). Chave = codigo do fornecedor. Guardado 30 min no D1 (a apuracao leva ~20 s).
export const RV_API = 'https://mapa.drivetriunfante-lastmile.com.br/rv/api';
export async function carregaRV(env) {
  const mes = hojeSP().slice(0, 7), db = env && env.DB, k = 'rv2:' + mes;   /* rv2 (26/10/2026): + faseamento, mix do vendedor e metas de ticket/mix */
  let velho = null;
  try { if (db) { await db.prepare('CREATE TABLE IF NOT EXISTS cache_resposta (chave TEXT PRIMARY KEY, corpo TEXT, tipo TEXT, em INTEGER)').run(); const r = await db.prepare('SELECT corpo, em FROM cache_resposta WHERE chave = ?').bind(k).first(); if (r) { velho = JSON.parse(r.corpo); if (Date.now() - r.em < 30 * 60 * 1000) return velho; } } } catch (e) {}
  const get = (p) => fetch(RV_API + p, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(50000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [m, a, tm] = await Promise.all([get('/metas?mes=' + mes), get('/apuracao-agregada?mes=' + mes), get('/metas-tmmix?mes=' + mes)]);
  if (!m || !a || !Array.isArray(m.rows) || !Array.isArray(a.fornecedores)) return velho;   /* fonte fora: usa a ultima leitura (avisada pela data de corte) */
  const o = { mes, cutoff: a.cutoff || null, fechado: !!a.mes_fechado,
    metas: m.rows.map((x) => [String(x.cod_vendedor), String(x.id_fornecedor ?? x.cnpj_fornecedor), String(x.fornecedor || ''), Number(x.tipo_meta), Number(x.meta) || 0]),
    apu: a.fornecedores.map((x) => [String(x.CODUSUR), String(x.cnpj_fornecedor), Number(x.fat_f) || 0, Number(x.fat_v) || 0, Number(x.pos_f) || 0, Number(x.pos_v) || 0, Number(x.fase_f) || 0]),
    mixV: Object.fromEntries((a.mix_vendedor || []).map((x) => [String(x.CODUSUR), Number(x.mix_f) || 0])), posV: Object.fromEntries((a.pos_vendedor || []).map((x) => [String(x.CODUSUR), Number(x.pos_f) || 0])),
    tmmix: ((tm && tm.rows) || []).filter((x) => x.fornecedor).map((x) => [String(x.CODUSUR), String(x.fornecedor || '').replace(/\.+$/, '').trim(), Number(x.meta_tm) || 0, Number(x.meta_mix) || 0]) };
  try { if (db) await db.prepare('INSERT INTO cache_resposta (chave, corpo, tipo, em) VALUES (?,?,?,?) ON CONFLICT (chave) DO UPDATE SET corpo = excluded.corpo, em = excluded.em').bind(k, JSON.stringify(o), 'json', Date.now()).run(); } catch (e) {}
  return o;
}
