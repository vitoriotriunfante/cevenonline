// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: ÁRVORE VIVA do CEVEN (supervisor -> vendedores de cada filial). Vitório, 06/10/2026: "temos que reorganizar as árvores do CEVEN
//          diariamente, pois mudam". O supervisor de cada vendedor vem SEMPRE do CEVEN (hoje), nunca de um nome guardado na Gestão de Equipe.
//          Em 06/10 a Gestão tinha o supervisor errado para 11 de 14 vendedores de TPA (equipes de Douglas e Anderson Giovani trocadas).
// COMO:    loga como o gerente de cada filial (/api/gerente-auth/login) e lê /api/gerente/tabelas-cascata (mesma fonte que o WhatsApp usa).
//          Grava no D1 (tabela arvore_supervisores) e /api/tv-mostra aplica por cima do supervisor da Gestão (a Gestão segue mandando em
//          mostra, canal e gerente/grupo). Atualiza sozinha: cron-lances chama garanteArvore() e renova se passou de ~45 min.
// SEGREDO: CEVEN_GERENTE_SENHA (Cloudflare Pages secret). Nunca no código.
// REGRA:   sem dado novo do CEVEN, mantém a última árvore gravada; sem árvore nenhuma, não altera nada (nunca inventa supervisor).
// =========================================================================
import { tokenAdmin } from './ceven_admin_token.js';
import { CEVEN_APP_SECRET } from './ceven_auth.js';
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
// UNIVERSO = TUDO O QUE EXISTE HOJE NO CEVEN (Vitorio, 20/10/2026: "o que vale e a base atual de vendedores no CEVEN... se ele e adm, interno, rca ou qualquer
// outra coisa... VC busca a arvore inteira todos os dias"). O CEVEN tem DUAS listas que nao batem: a do gerente (tabelas-cascata, 549 RCAs em 20/10) e a da
// administracao (admin/filiais/hierarquia, 464). A TV somava so a do gerente (R$ 80,56 mi) e a planilha so a da adm (R$ 79,16 mi). Agora a arvore = UNIAO das duas.
async function arvoreAdmin(env) {
  try {
    const tk = await tokenAdmin(env);
    if (!tk) return null;
    const r = await fetch(`${CEVEN}/api/admin/filiais/hierarquia?refreshMetas=false`, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const lista = await r.json();
    if (!Array.isArray(lista)) return null;
    const out = new Map();   // SIGLA -> [{rca, sup_id, sup_nome, nome}]
    for (const f of lista) {
      const sig = String(f.sigla || '').toUpperCase().slice(0, 3);
      const arr = out.get(sig) || out.set(sig, []).get(sig);
      for (const s of f.supervisores || []) for (const v of s.vendedores || []) if (v && v.id != null) arr.push({ rca: String(v.id), sup_id: String(s.id == null ? '' : s.id), sup_nome: limpaSup(s.nome || 'SEM SUPERVISOR'), nome: String(v.nome || '') });
    }
    return out;
  } catch { return null; }
}
export const GERENTES = [
  { sigla: 'TBE', filialKey: 'tbe1', loginNome: 'Diego' }, { sigla: 'TSJ', filialKey: 'tsj1', loginNome: 'Saldanha' },
  { sigla: 'MCD', filialKey: 'mcd1', loginNome: 'Cleverson' }, { sigla: 'TPH', filialKey: 'tph1', loginNome: 'Vagner' },
  { sigla: 'TCG', filialKey: 'tcg1', loginNome: 'Danilo' }, { sigla: 'TPA', filialKey: 'tpa1', loginNome: 'Leandro Souza' },
  { sigla: 'API', filialKey: 'api1', loginNome: 'Marcelo' }, { sigla: 'TCV', filialKey: 'tcv1', loginNome: 'Leonardo' },
  { sigla: 'ABC', filialKey: 'abc1', loginNome: 'Marcos Colling' }, { sigla: 'TCA', filialKey: 'tca1', loginNome: 'Becher' },
  { sigla: 'TBL', filialKey: 'tbl1', loginNome: 'Fabio Machado' }
];
const UA = { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json', 'X-App-Secret': CEVEN_APP_SECRET };
export const limpaSup = (n) => String(n || '').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').toUpperCase().replace(/\s+/g, ' ').trim();

async function tabela(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS arvore_supervisores (filial TEXT NOT NULL, rca TEXT NOT NULL, sup_id TEXT, sup_nome TEXT, atualizado_em TEXT, nome TEXT, canal TEXT, PRIMARY KEY (filial, rca))').run();
  for (const col of ['nome', 'canal']) { try { await env.DB.prepare(`ALTER TABLE arvore_supervisores ADD COLUMN ${col} TEXT`).run(); } catch { /* ja existe */ } }
}

// Lê a cascata de UMA filial: devolve [{rca, sup_id, sup_nome}] ou null se o CEVEN não respondeu
async function arvoreDaFilial(g, senha) {
  try {
    const lr = await fetch(`${CEVEN}/api/gerente-auth/login`, { method: 'POST', headers: UA, body: JSON.stringify({ filial: g.filialKey, nome: g.loginNome, password: senha }), signal: AbortSignal.timeout(15000) });
    if (!lr.ok) return null;
    const lj = await lr.json();
    const tk = lj.access_token || lj.token;
    if (!tk) return null;
    const cr = await fetch(`${CEVEN}/api/gerente/tabelas-cascata?filial=${g.filialKey}`, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(30000) });
    if (!cr.ok) return null;
    const cj = await cr.json();
    const out = new Map();
    for (const s of cj.supervisores || []) {
      for (const t of ['produtividade', 'faturamento', 'positivacao']) {
        for (const v of (s.tabelas && s.tabelas[t]) || []) {
          if (v && v.id != null && !out.has(String(v.id))) out.set(String(v.id), { rca: String(v.id), sup_id: String(s.supervisorId == null ? '' : s.supervisorId), sup_nome: limpaSup(s.supervisorNome), nome: String(v.nome || v.nome_rca || v.nomeRca || '').trim() });
        }
      }
    }
    return [...out.values()];
  } catch { return null; }
}

// CANAL DE CADA VENDEDOR = o do CEVEN (area_atuacao). Vitório, 07/10/2026: "tem cara de AS como o proprio CEVEN do Luciano e o cara tá como varejo": o canal da Gestão estava errado em
// dezenas de vendedores (33 de 54 conferidos). Guarda em canal_ceven (cache de 24 h, até 150 vendedores por chamada) e aplicaArvore passa a usar esse canal.
export async function atualizaCanais(env, limite = 150) {
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS canal_ceven (filial TEXT NOT NULL, rca TEXT NOT NULL, canal TEXT, em INTEGER, PRIMARY KEY (filial, rca))').run();
    // EXISTE NO CEVEN (26/10/2026, Vitorio: "o TCG 466 nem existe!"): o cadastro /api/filiais/X/representante/N responde 200 VAZIO para codigo sem representante (rota vaga),
    // mas o painel /api/rca/dashboard do mesmo codigo traz meta (TCG 466: R$ 800 mil). existe = 0 tira o codigo de meta e totais (functions/_lib/resumo_base.js).
    try { await env.DB.prepare('ALTER TABLE canal_ceven ADD COLUMN existe INTEGER').run(); } catch { /* ja existe */ }
    const { results } = await env.DB.prepare("SELECT a.filial AS filial, a.rca AS rca FROM arvore_supervisores a LEFT JOIN canal_ceven c ON c.filial = a.filial AND c.rca = a.rca WHERE c.em IS NULL OR c.existe IS NULL OR c.em < ? ORDER BY COALESCE(c.em, 0) LIMIT ?").bind(Date.now() - 24 * 3600e3, limite).all();
    const lista = results || [];
    for (let i = 0; i < lista.length; i += 10) {
      await Promise.all(lista.slice(i, i + 10).map(async (v) => {
        try {
          const x = await fetch(`${CEVEN}/api/filiais/${String(v.filial).toLowerCase()}1/representante/${v.rca}`, { headers: { 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(6000) });
          if (!x.ok) return;
          const txt = await x.text(); let canal = '', existe = 0;
          try { const j = JSON.parse(txt); if (j && (j.id != null || j.nome || j.name || j.area_atuacao)) existe = 1; canal = String((j && j.area_atuacao) || '').toUpperCase(); } catch { /* corpo vazio = codigo sem representante no CEVEN */ }
          await env.DB.prepare('INSERT OR REPLACE INTO canal_ceven (filial, rca, canal, em, existe) VALUES (?, ?, ?, ?, ?)').bind(v.filial, String(v.rca), canal, Date.now(), existe).run();
        } catch { /* tenta de novo na proxima rodada */ }
      }));
    }
    return lista.length;
  } catch { return 0; }
}

// Baixa as 11 filiais e grava no D1. Filial que falhar mantém a árvore anterior dela.
export async function atualizaArvore(env) {
  if (!env.DB) return { status: 'SEM_BANCO' };
  if (!env.CEVEN_GERENTE_SENHA) return { status: 'SEM_SEGREDO' };
  await tabela(env);
  const agora = new Date().toISOString();
  const resultados = await Promise.all(GERENTES.map(async (g) => ({ g, rows: await arvoreDaFilial(g, env.CEVEN_GERENTE_SENHA) })));
  // junta a lista da administracao: quem so existe nela entra tambem (RCA nnn sem supervisor, contas internas...). Falha na adm = segue so com a do gerente.
  const adm = await arvoreAdmin(env);
  let soAdm = 0;
  if (adm) for (const it of resultados) {
    const extra = adm.get(it.g.sigla) || [];
    if (!it.rows) { if (extra.length) { it.rows = extra.slice(); soAdm += extra.length; } continue; }
    const tem = new Set(it.rows.map((r) => r.rca));
    for (const r of extra) if (!tem.has(r.rca)) { it.rows.push(r); soAdm++; }
  }
  const ok = [], falhas = [];
  let gravados = 0;
  // canal (area_atuacao) ja conhecido + quem ja esta na Gestao (so quem NAO esta precisa do canal para entrar nas telas)
  const canalConhecido = new Map();
  try { const { results } = await env.DB.prepare('SELECT filial, rca, canal FROM arvore_supervisores WHERE canal IS NOT NULL').all(); for (const r of results || []) canalConhecido.set(`${r.filial}|${r.rca}`, r.canal); } catch { /* sem cache */ }
  const naGestao = new Set();
  try { const row = await env.DB.prepare('SELECT conteudo_json FROM config_equipe_soberana WHERE id = 1').first(); const j = row && JSON.parse(row.conteudo_json); for (const k of Object.keys((j && j.filiais) || {})) for (const v of j.filiais[k]) naGestao.add(`${k.split('_')[0].toUpperCase()}|${v.rca}`); } catch { /* sem Gestao */ }
  const precisaCanal = [];
  for (const { g, rows } of resultados) for (const r of rows || []) { const k = `${g.sigla}|${r.rca}`; if (canalConhecido.has(k)) r.canal = canalConhecido.get(k); else if (!naGestao.has(k)) precisaCanal.push({ g, r }); }
  for (let i = 0; i < precisaCanal.length; i += 8) {
    await Promise.all(precisaCanal.slice(i, i + 8).map(async ({ g, r }) => {
      try { const x = await fetch(`${CEVEN}/api/filiais/${g.filialKey}/representante/${r.rca}`, { headers: { 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(10000) }); if (x.ok) { const j = await x.json(); r.canal = String(j.area_atuacao || '').toUpperCase(); } } catch { /* tenta de novo na proxima */ }
    }));
  }
  for (const { g, rows } of resultados) {
    if (!rows || !rows.length) { falhas.push(g.sigla); continue; }
    const stmts = [];
    for (let i = 0; i < rows.length; i += 14) {
      const lote = rows.slice(i, i + 14);
      stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO arvore_supervisores (filial, rca, sup_id, sup_nome, atualizado_em, nome, canal) VALUES ${lote.map(() => '(?,?,?,?,?,?,?)').join(',')}`)
        .bind(...lote.flatMap((r) => [g.sigla, r.rca, r.sup_id, r.sup_nome, agora, r.nome || '', r.canal === undefined ? null : r.canal])));
    }
    stmts.push(env.DB.prepare('DELETE FROM arvore_supervisores WHERE filial = ? AND atualizado_em < ?').bind(g.sigla, agora));
    await env.DB.batch(stmts);
    ok.push(g.sigla); gravados += rows.length;
  }
  const canaisAtualizados = await atualizaCanais(env, 400);   // 26/10/2026: 150 -> 400 (conferencia diaria de quem existe no CEVEN fecha numa rodada)
  return { status: falhas.length ? 'PARCIAL' : 'ATUALIZADA', filiais_ok: ok, filiais_falharam: falhas, vendedores: gravados, so_na_lista_da_adm: soAdm, lista_adm: adm ? 'ok' : 'falhou', canais_atualizados: canaisAtualizados, atualizado_em: agora };
}

// Renova só se a árvore está velha (padrão 45 min). Devolve o status.
export async function garanteArvore(env, maxIdadeMin = 45) {
  if (!env.DB) return { status: 'SEM_BANCO' };
  try {
    await tabela(env);
    const r = await env.DB.prepare('SELECT MAX(atualizado_em) AS u FROM arvore_supervisores').first();
    if (r && r.u && (Date.now() - Date.parse(r.u)) / 60000 < maxIdadeMin) return { status: 'FRESCA', atualizado_em: r.u };
  } catch { /* segue e tenta atualizar */ }
  return atualizaArvore(env);
}

// Aplica a árvore viva sobre a resposta da equipe (corpo = { filiais: { SIG: [ {rca, supervisor, ...} ] } }). Muta e devolve o corpo.
export async function aplicaArvore(env, corpo) {
  if (!env.DB || !corpo || !corpo.filiais) return corpo;
  // canal do CEVEN por cima do canal da Gestao (a Gestao so manda em mostra/nao mostra, gerente e grupo; o canal real e o do CEVEN)
  try {
    const { results: cc } = await env.DB.prepare("SELECT filial, rca, canal FROM canal_ceven WHERE canal IS NOT NULL AND canal != ''").all();
    if (cc && cc.length) {
      const mc = new Map(cc.map((x) => [x.filial + '|' + x.rca, String(x.canal).toUpperCase()]));
      let trocados = 0;
      for (const chave of Object.keys(corpo.filiais)) {
        const sig = chave.split('_')[0].toUpperCase();
        for (const v of corpo.filiais[chave] || []) {
          const c = v && mc.get(sig + '|' + v.rca);
          if (c && c !== String(v.canal || '').toUpperCase()) { v.canal_gestao = v.canal || ''; v.canal = c; trocados++; }
        }
      }
      corpo.canais_do_ceven = { vendedores_com_canal_corrigido: trocados };
    }
  } catch { /* tabela ainda nao existe: segue com o canal da Gestao */ }
  try {
    const { results } = await env.DB.prepare('SELECT filial, rca, sup_nome, atualizado_em, nome, canal FROM arvore_supervisores').all();
    if (!results || !results.length) { corpo.arvore_viva = null; return corpo; }
    const mapa = new Map(results.map((r) => [`${r.filial}|${r.rca}`, r]));
    let ajustados = 0, ultima = '';
    for (const chave of Object.keys(corpo.filiais)) {
      const sig = chave.split('_')[0].toUpperCase();
      for (const v of corpo.filiais[chave] || []) {
        const a = v && mapa.get(`${sig}|${v.rca}`);
        if (!a) continue;
        if (a.atualizado_em > ultima) ultima = a.atualizado_em;
        if (a.sup_nome && a.sup_nome !== String(v.supervisor || '').toUpperCase().trim()) {
          v.supervisor_gestao = v.supervisor || '';
          v.supervisor = a.sup_nome;
          ajustados++;
        }
      }
    }
    // VENDEDORES NOVOS: quem esta na arvore do CEVEN e a Gestao ainda nao conhece entra na lista automaticamente (mostra = SIM). Quem NAO deve aparecer a Diretoria marca "nao mostra" na Gestao.
    // Nao entram: vaga (VAGO), conta do proprio supervisor/gerente, canal GER/SUP.
    const ja = new Set();
    for (const chave of Object.keys(corpo.filiais)) for (const v of corpo.filiais[chave] || []) ja.add(chave.split('_')[0].toUpperCase() + '|' + v.rca);
    const nomesSup = new Set(results.map((x) => x.sup_nome)); // conta de quem e supervisor em alguma filial nao e vendedor
    let novos = 0;
    for (const r of results) {
      const sig = r.filial, k = sig + '|' + r.rca;
      if (ja.has(k)) continue;
      const nome = limpaSup(r.nome);
      if (!nome || /^VAG[OA]\b/.test(nome) || /^GERENTE\b/.test(nome) || nomesSup.has(nome) || /^(GER|SUP)$/.test(String(r.canal || '').toUpperCase())) continue;
      // gerente/grupo: o mais comum entre os vendedores da Gestao que tem o mesmo supervisor (senao, o mais comum da filial)
      const todos = [];
      for (const chave of Object.keys(corpo.filiais)) if (chave.split('_')[0].toUpperCase() === sig) for (const v of corpo.filiais[chave] || []) todos.push(v);
      const mais = (lista, campo) => { const c = {}; lista.forEach((v) => { if (v[campo]) c[v[campo]] = (c[v[campo]] || 0) + 1; }); const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : ''; };
      const irmaos = todos.filter((v) => String(v.supervisor || '').toUpperCase().trim() === r.sup_nome);
      const base = irmaos.length ? irmaos : todos;
      const item = { rca: r.rca, nome, canal: String(r.canal || '').toUpperCase(), supervisor: r.sup_nome, gerente: mais(base, 'gerente'), grupo: mais(base, 'grupo'), mostra: true, motivo: '', auto_arvore: true };
      const chaveFilial = Object.keys(corpo.filiais).find((c) => c.split('_')[0].toUpperCase() === sig) || sig;
      (corpo.filiais[chaveFilial] = corpo.filiais[chaveFilial] || []).push(item);
      novos++;
    }
    corpo.arvore_viva = { atualizado_em: ultima, vendedores_com_supervisor_corrigido: ajustados, vendedores_novos_da_arvore: novos };
  } catch { corpo.arvore_viva = null; }
  return corpo;
}

// CASCATA DO DIA NA BASE (26/10/2026, Vitorio: "tem coisa que da pra ver sim na tela do gerente"): /api/gerente/tabelas-cascata traz, numa chamada por filial,
// visitas planejadas/realizadas HOJE, eficacia de hoje, faturamento e positivacao de TODOS os vendedores, e respondeu 200 no mesmo instante em que /api/rca/* dava 429
// (cota separada). Gravada inteira em cascata_dia (1 linha por filial por dia; 11 linhas por rodada, custo desprezivel).
// Usos: numero unico de visitas (/api/totais-dia) e saber QUEM teve visita/venda nova para buscar so o roteiro desses (lances).
const tokGer = new Map();   // filialKey -> { tk, ate }
export async function tokenGerente(g, senha) {
  const m = tokGer.get(g.filialKey);
  if (m && Date.now() < m.ate) return m.tk;
  const lr = await fetch(`${CEVEN}/api/gerente-auth/login`, { method: 'POST', headers: UA, body: JSON.stringify({ filial: g.filialKey, nome: g.loginNome, password: senha }), signal: AbortSignal.timeout(15000) });
  if (!lr.ok) return null;
  const lj = await lr.json().catch(() => null), tk = lj && (lj.access_token || lj.token);
  if (tk) tokGer.set(g.filialKey, { tk, ate: Date.now() + 20 * 60 * 1000 });
  return tk || null;
}
export async function gravaCascatas(env, dataRef, prazoMs = 30000) {
  if (!env.CEVEN_GERENTE_SENHA || !env.DB) return { status: 'SEM_SEGREDO_OU_D1' };
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS cascata_dia (filial TEXT NOT NULL, data_ref TEXT NOT NULL, json TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (filial, data_ref))').run();
  const fim = Date.now() + prazoMs, res = { lidas: 0, mudaram: 0, falhas: [] };
  await Promise.all(GERENTES.map(async (g) => {
    try {
      let tk = await tokenGerente(g, env.CEVEN_GERENTE_SENHA);
      if (!tk) { res.falhas.push(g.sigla + ':login'); return; }
      let r = await fetch(`${CEVEN}/api/gerente/tabelas-cascata?filial=${g.filialKey}`, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(Math.max(3000, fim - Date.now())) });
      if (r.status === 401) { tokGer.delete(g.filialKey); res.falhas.push(g.sigla + ':401'); return; }
      if (!r.ok) { res.falhas.push(g.sigla + ':' + r.status); return; }
      const j = await r.json();
      if (!j || !Array.isArray(j.supervisores)) { res.falhas.push(g.sigla + ':vazio'); return; }
      res.lidas++;
      const txt = JSON.stringify(j);
      const w = await env.DB.prepare("INSERT INTO cascata_dia (filial, data_ref, json, atualizado_em) VALUES (?, ?, ?, datetime('now')) ON CONFLICT (filial, data_ref) DO UPDATE SET json = excluded.json, atualizado_em = excluded.atualizado_em")   // sempre marca a hora da leitura: tv-lances so da cartao com cascata de menos de 10 min
        .bind(g.sigla, dataRef, txt).run();
      if (w && w.meta && w.meta.changes) res.mudaram++;
    } catch (e) { res.falhas.push(g.sigla + ':' + String(e.message || e).slice(0, 40)); }
  }));
  return res;
}

// ROTA PELO GERENTE, EM PARALELO (Vitorio, 01/11/2026: "cada gerente ve tudo"): /api/gerente/supervisor/roteiro-hoje traz a rota da equipe de cada supervisor numa chamada,
// fora da cota de /api/rca/*. Grava so em rota_gerente_dia: NADA le daqui ainda. /api/frescor compara com a leitura individual; a troca da fonte so depois de os numeros baterem.
export async function gravaRotasGerente(env, dataRef, prazoMs = 25000) {
  if (!env.CEVEN_GERENTE_SENHA || !env.DB) return { status: 'SEM_SEGREDO_OU_D1' };
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS rota_gerente_dia (data_ref TEXT NOT NULL, filial TEXT NOT NULL, supervisor_id TEXT NOT NULL, json TEXT NOT NULL, lido_em TEXT NOT NULL, PRIMARY KEY (data_ref, filial, supervisor_id))').run();
  const { results } = await env.DB.prepare('SELECT filial, json FROM cascata_dia WHERE data_ref = ?').bind(dataRef).all();
  const fila = [], fim = Date.now() + prazoMs, res = { supervisores: 0, lidos: 0, visitas: 0, falhas: {} };
  for (const c of results || []) { const g = GERENTES.find((x) => x.sigla === c.filial); let j = null; try { j = JSON.parse(c.json); } catch { continue; } if (g && j) for (const s of j.supervisores || []) if (s.supervisorId != null) fila.push({ g, id: s.supervisorId }); }
  res.supervisores = fila.length;
  const falha = (m) => { res.falhas[m] = (res.falhas[m] || 0) + 1; };
  let k = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {   // teto de 6 simultaneas
    while (k < fila.length && Date.now() < fim) {
      const { g, id } = fila[k++];
      try {
        const tk = await tokenGerente(g, env.CEVEN_GERENTE_SENHA);
        if (!tk) { falha('login'); continue; }
        const r = await fetch(`${CEVEN}/api/gerente/supervisor/roteiro-hoje?filial=${g.filialKey}&supervisorId=${id}`, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(10000) });
        if (r.status === 401) tokGer.delete(g.filialKey);
        if (!r.ok) { falha('http' + r.status); continue; }
        const a = await r.json();
        if (!Array.isArray(a)) { falha('formato'); continue; }
        res.lidos++; res.visitas += a.length;
        await env.DB.prepare("INSERT INTO rota_gerente_dia (data_ref, filial, supervisor_id, json, lido_em) VALUES (?, ?, ?, ?, datetime('now')) ON CONFLICT (data_ref, filial, supervisor_id) DO UPDATE SET json = excluded.json, lido_em = excluded.lido_em").bind(dataRef, g.sigla, String(id), JSON.stringify(a)).run();
      } catch (e) { falha(String((e && e.name) || 'erro')); }
    }
  }));
  res.nao_lidos_prazo = fila.length - k;
  // PAINEL DO GERENTE, EM PARALELO: /api/gerente/dashboard-cascata traz faturado, devolucao, pendente, metas e positivacao de cada vendedor. NADA le daqui ainda.
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS painel_gerente_dia (data_ref TEXT NOT NULL, filial TEXT NOT NULL, json TEXT NOT NULL, lido_em TEXT NOT NULL, PRIMARY KEY (data_ref, filial))').run();
  res.paineis = 0;
  for (let i = 0; i < GERENTES.length; i += 6) await Promise.all(GERENTES.slice(i, i + 6).map(async (g) => {
    try {
      const tk = await tokenGerente(g, env.CEVEN_GERENTE_SENHA);
      if (!tk) { falha('painel_login'); return; }
      const r = await fetch(`${CEVEN}/api/gerente/dashboard-cascata?filial=${g.filialKey}`, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) { falha('painel_http' + r.status); return; }
      const j = await r.json();
      if (!j || !Array.isArray(j.supervisores)) { falha('painel_formato'); return; }
      res.paineis++;
      await env.DB.prepare("INSERT INTO painel_gerente_dia (data_ref, filial, json, lido_em) VALUES (?, ?, ?, datetime('now')) ON CONFLICT (data_ref, filial) DO UPDATE SET json = excluded.json, lido_em = excluded.lido_em").bind(dataRef, g.sigla, JSON.stringify(j)).run();
    } catch (e) { falha('painel_' + String((e && e.name) || 'erro')); }
  }));
  return res;
}

// CLIENTES FOCO / TAGS (Vitorio, 16/11/2026: "as tags vc tem aqui .../admin... no gerot temos a lista completa... mas as tags devem ser consideradas"):
// le o admin 'Clientes Foco' (paginado) e grava em cliente_focos (filial, rca, id_cliente = CNPJ, tag = campanha). So tags ATIVAS; INSERT OR IGNORE
// (nunca apaga+regrava: custo do D1). gravar=false devolve so o formato (chaves do item) e a contagem por campanha.
export async function cargaClientesFoco(env, gravar = false) {
  const tk = await tokenAdmin(env);
  if (!tk) return { erro: 'login admin do CEVEN falhou' };
  const H = { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET };
  const sig = (f) => String(f || '').toUpperCase().replace(/\d+$/, '').slice(0, 3);
  const pick = (o, ...ks) => { for (const k of ks) if (o && o[k] != null && o[k] !== '') return o[k]; return null; };
  const out = { paginas: 0, itens: 0, ativos: 0, chaves: null, porCampanha: {}, gravados: 0, erros: [] };
  const linhas = [];
  let completo = false;
  for (let p = 1; p <= 300; p++) {
    let j = null;
    // 16/11/2026: na 1a carga o CEVEN cortou na pagina 101 (429). Ritmo de 0,6 s entre paginas e ate 4 novas tentativas no 429 (espera crescente).
    if (p > 1) await new Promise((ok) => setTimeout(ok, 600));
    let r = null;
    try {
      for (let t = 0; t < 5; t++) { r = await fetch(`${CEVEN}/api/admin/clientes-foco?page=${p}&limit=500`, { headers: H, signal: AbortSignal.timeout(30000) }); if (r.status !== 429 && r.status < 500) break;   /* 22/11/2026: 502 na pagina 13 -> tenta de novo */ await new Promise((ok) => setTimeout(ok, 3000 * (t + 1))); }
      if (!r.ok) { out.erros.push(`pagina ${p}: ${r.status}`); break; } j = await r.json();
    } catch (e) { out.erros.push(`pagina ${p}: ${String(e && e.message || e).slice(0, 80)}`); break; }
    const I = (j && Array.isArray(j.items)) ? j.items : [];
    out.paginas = p; out.itens += I.length; if (!out.chaves && I[0]) out.chaves = Object.keys(I[0]);
    for (const x of I) {
      const ativo = pick(x, 'ativo', 'active', 'is_active'); if (ativo === false || ativo === 0 || /^(nao|não|false|0)$/i.test(String(ativo))) continue;
      const cnpj = String(pick(x, 'cnpj', 'cnpj_cliente', 'cpf_cnpj') || '').replace(/\D/g, ''); if (!cnpj) continue;
      const tag = String(pick(x, 'industria_foco', 'campanha', 'nome_campanha', 'tag') || '').trim().toUpperCase(); if (!tag) continue;
      const fil = sig(pick(x, 'filial', 'filial_sigla', 'sigla', 'filial_key')); if (!/^[A-Z]{3}$/.test(fil)) continue;
      const rca = String(pick(x, 'id_vendedor', 'cod_vendedor', 'codusur', 'rca', 'id_representante', 'vendedor') || '').replace(/\D/g, '');
      out.ativos++; out.porCampanha[tag] = (out.porCampanha[tag] || 0) + 1;
      linhas.push([fil, rca, cnpj, tag]);
    }
    if (!I.length || (j && j.pages && p >= Number(j.pages))) { completo = !out.erros.length; break; }
  }
  out.completo = completo;
  if (gravar && linhas.length) {
    const agora = new Date().toISOString();
    for (let i = 0; i < linhas.length; i += 80) {
      const res = await env.DB.batch(linhas.slice(i, i + 80).map(([f, r, c, t]) => env.DB.prepare("INSERT OR IGNORE INTO cliente_focos (filial, rca, id_cliente, tag, origem, atualizado_em) VALUES (?, ?, ?, ?, 'admin_clientes_foco', ?)").bind(f, r, c, t, agora)));
      for (const x of res || []) out.gravados += (x && x.meta && x.meta.changes) || 0;
    }
    // AS TAGS MUDAM (Vitorio, 16/11/2026): com a leitura COMPLETA, sai do D1 o que saiu do admin (so as de origem admin; leitura parcial nunca apaga)
    if (completo) {
      const quer = new Set(linhas.map((x) => x.join('|')));
      const { results: ex } = await env.DB.prepare("SELECT filial, rca, id_cliente, tag FROM cliente_focos WHERE origem = 'admin_clientes_foco'").all();
      const sai = (ex || []).filter((x) => !quer.has([x.filial, x.rca, x.id_cliente, x.tag].join('|')));
      for (let i = 0; i < sai.length; i += 80) await env.DB.batch(sai.slice(i, i + 80).map((x) => env.DB.prepare('DELETE FROM cliente_focos WHERE filial = ? AND rca = ? AND id_cliente = ? AND tag = ?').bind(x.filial, x.rca, x.id_cliente, x.tag)));
      out.removidos = sai.length;
    }
  }
  return out;
}

// TESTE DE CONEXAO DO GERENTE (Vitorio, 16/11/2026: "o CEVEN voltou mas apenas para os gerentes... uma unidade por vez"): SO LEITURA, nao grava nada.
// Devolve status/tempo do login e da cascata e as contagens; nunca devolve senha nem token.
export async function diagGerente(env, filialSigla) {
  const sig = String(filialSigla || '').toUpperCase().slice(0, 3), g = GERENTES.find((x) => x.sigla === sig);
  if (!g) return { filial: sig, erro: 'filial desconhecida' };
  if (!env.CEVEN_GERENTE_SENHA) return { filial: sig, erro: 'sem segredo CEVEN_GERENTE_SENHA' };
  const out = { filial: sig, gerente: g.loginNome };
  let t0 = Date.now(), tk = null;
  try {
    const lr = await fetch(`${CEVEN}/api/gerente-auth/login`, { method: 'POST', headers: UA, body: JSON.stringify({ filial: g.filialKey, nome: g.loginNome, password: env.CEVEN_GERENTE_SENHA }), signal: AbortSignal.timeout(20000) });
    out.login = { status: lr.status, ms: Date.now() - t0 };
    if (lr.ok) { const lj = await lr.json().catch(() => null); tk = lj && (lj.access_token || lj.token); out.login.token = !!tk; } else out.login.corpo = (await lr.text().catch(() => '')).slice(0, 160);
  } catch (e) { out.login = { erro: String(e && e.message || e).slice(0, 160), ms: Date.now() - t0 }; }
  if (!tk) return out;
  t0 = Date.now();
  try {
    const r = await fetch(`${CEVEN}/api/gerente/tabelas-cascata?filial=${g.filialKey}`, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(30000) });
    out.cascata = { status: r.status, ms: Date.now() - t0 };
    if (r.ok) {
      const j = await r.json().catch(() => null), S = j && Array.isArray(j.supervisores) ? j.supervisores : [];
      out.cascata.supervisores = S.length;
      out.cascata.vendedores = S.reduce((a, s) => a + (Array.isArray(s.vendedores) ? s.vendedores.length : Array.isArray(s.rcas) ? s.rcas.length : 0), 0);
      out.cascata.chaves = j ? Object.keys(j).slice(0, 12) : [];
    } else out.cascata.corpo = (await r.text().catch(() => '')).slice(0, 160);
  } catch (e) { out.cascata = { erro: String(e && e.message || e).slice(0, 160), ms: Date.now() - t0 }; }
  return out;
}
export async function gravaCascataFilial(env, filialSigla, dataRef, prazoMs = 10000) {
  if (!env.CEVEN_GERENTE_SENHA || !env.DB) return null;
  const sig = String(filialSigla || '').toUpperCase().slice(0, 3);
  const g = GERENTES.find((x) => x.sigla === sig);
  if (!g) return null;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS cascata_dia (filial TEXT NOT NULL, data_ref TEXT NOT NULL, json TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (filial, data_ref))').run();
  try {
    let tk = await tokenGerente(g, env.CEVEN_GERENTE_SENHA);
    if (!tk) return null;
    let r = await fetch(`${CEVEN}/api/gerente/tabelas-cascata?filial=${g.filialKey}`, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(prazoMs) });
    if (r.status === 401) { tokGer.delete(g.filialKey); return null; }
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !Array.isArray(j.supervisores)) return null;
    const txt = JSON.stringify(j);
    await env.DB.prepare("INSERT INTO cascata_dia (filial, data_ref, json, atualizado_em) VALUES (?, ?, ?, datetime('now')) ON CONFLICT (filial, data_ref) DO UPDATE SET json = excluded.json, atualizado_em = excluded.atualizado_em").bind(g.sigla, dataRef, txt).run();
    return j;
  } catch (e) {
    return null;
  }
}


// GPS DAS VISITAS DE HOJE pelo CEVEN de cada GERENTE (22/11/2026, Vitorio: 'vc vai entrar na filial de cada um deles... vao ser 11 chamados'):
// fonte do IMPEDIMENTO POR GPS da Liga (o Clube nao traz coordenada). Grava ceven_gps_visita so com check-out, so quando mudou.
const nGps = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

export async function coletaGpsGerentes(env, dia, prazoMs = 200000) {
  if (!env.CEVEN_GERENTE_SENHA || !env.DB) return { status: 'SEM_SEGREDO_OU_D1' };
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ceven_gps_visita (dia TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, cliente TEXT NOT NULL, cli_lat REAL, cli_lon REAL, ci_lat REAL, ci_lon REAL, co_lat REAL, co_lon REAL, checkin TEXT, checkout TEXT, tempo TEXT, hash TEXT, lido_em TEXT, PRIMARY KEY (dia, filial, rca, cliente))').run();
  const fim = Date.now() + prazoMs, res = { filiais: 0, supervisores: 0, visitas_gps: 0, gravadas: 0, falhas: {} };
  const falha = (m) => { res.falhas[m] = (res.falhas[m] || 0) + 1; };
  await Promise.all(GERENTES.map(async (g) => {
    try {
      const tk = await tokenGerente(g, env.CEVEN_GERENTE_SENHA); if (!tk) return falha(g.sigla + ':login');
      const H = { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET };
      const p = await fetch(`${CEVEN}/api/gerente/dashboard-cascata?filial=${g.filialKey}`, { headers: H, signal: AbortSignal.timeout(20000) });
      if (!p.ok) return falha(g.sigla + ':painel' + p.status);
      const sups = ((await p.json()).supervisores || []).map((s) => s.supervisorId).filter((x) => x != null);
      res.filiais++; res.supervisores += sups.length;
      const linhas = [];
      for (const id of sups) {
        if (Date.now() > fim) { falha('prazo'); break; }
        try {
          const r = await fetch(`${CEVEN}/api/gerente/supervisor/roteiro-hoje?filial=${g.filialKey}&supervisorId=${id}`, { headers: H, signal: AbortSignal.timeout(15000) });
          if (!r.ok) { falha('rot' + r.status); continue; }
          const a = await r.json(); if (!Array.isArray(a)) continue;
          for (const v of a) {
            const coLat = nGps(v.checkout_latitude), coLon = nGps(v.checkout_longitude); if (coLat == null || coLon == null || !v.id_representante || !v.id_cliente) continue;
            const L = [dia, g.sigla, String(v.id_representante), String(v.id_cliente), nGps(v.latitude), nGps(v.longitude), nGps(v.checkin_latitude), nGps(v.checkin_longitude), coLat, coLon, v.checkin_horario || null, v.checkout_horario || null, v.tempo_visita || null];
            L.push(L.slice(4).join('|')); linhas.push(L);
          }
        } catch (e) { falha('rot_' + (e && e.name)); }
      }
      res.visitas_gps += linhas.length;
      for (let i = 0; i < linhas.length; i += 50) {
        const out = await env.DB.batch(linhas.slice(i, i + 50).map((L) => env.DB.prepare("INSERT INTO ceven_gps_visita (dia, filial, rca, cliente, cli_lat, cli_lon, ci_lat, ci_lon, co_lat, co_lon, checkin, checkout, tempo, hash, lido_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT (dia, filial, rca, cliente) DO UPDATE SET cli_lat=excluded.cli_lat, cli_lon=excluded.cli_lon, ci_lat=excluded.ci_lat, ci_lon=excluded.ci_lon, co_lat=excluded.co_lat, co_lon=excluded.co_lon, checkin=excluded.checkin, checkout=excluded.checkout, tempo=excluded.tempo, hash=excluded.hash, lido_em=excluded.lido_em WHERE ceven_gps_visita.hash IS NOT excluded.hash").bind(...L)));
        for (const x of out || []) res.gravadas += (x && x.meta && x.meta.changes) || 0;
      }
    } catch (e) { falha(g.sigla + ':' + String((e && e.message) || e).slice(0, 30)); }
  }));
  return res;
}


// DEVOLUCOES PELO CEVEN ADMIN (22/11/2026, Vitorio: "nao e possivel nao termos uma fonte sequer"): o admin entra como o vendedor (view-as) e le a lista de
// devolucoes (nota, data, cliente, R$) e o MOTIVO de cada nota nova. Prioridade: vendedores com devolucao nova no GEROT (gerot_pedido) nas ultimas 30 h;
// depois rodizio de todos do mes (o mais antigo checado primeiro). Grava ceven_devolucao_nota (INSERT OR IGNORE) e devolucao_nota_motivo (motivo oficial).
// Nunca assume: nota sem detalhe fica sem motivo e nao vira lance.
export async function coletaDevolucoesAdmin(env, dia, maxVend = 40, prazoMs = 150000) {
  const tk = await tokenAdmin(env); if (!tk) return { erro: 'login admin falhou' };
  const H = { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET };
  const HR = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'X-App-Secret': CEVEN_APP_SECRET };   // rota do vendedor: sem o token do admin (como o coletor antigo)
  const db = env.DB, fim = Date.now() + prazoMs, res = { vendedores: 0, notas_mes: 0, notas_novas: 0, motivos: 0, falhas: {} };
  const falha = (m) => { res.falhas[m] = (res.falhas[m] || 0) + 1; };
  await db.prepare('CREATE TABLE IF NOT EXISTS ceven_devolucao_nota (filial TEXT NOT NULL, rca TEXT NOT NULL, nota TEXT NOT NULL, data TEXT, valor REAL, cliente_id TEXT, cliente TEXT, visto_em TEXT, PRIMARY KEY (filial, rca, nota))').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS ceven_devolucao_checado (filial TEXT NOT NULL, rca TEXT NOT NULL, em TEXT, PRIMARY KEY (filial, rca))').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS devolucao_nota_motivo (rca TEXT NOT NULL, nota TEXT NOT NULL, nao_pediu INTEGER, motivos TEXT, resolvido_em TEXT, PRIMARY KEY (rca, nota))').run();
  const mes = dia.slice(0, 7);
  const pri = ((await db.prepare("SELECT DISTINCT filial, rca FROM gerot_pedido WHERE mes = ? AND rca IS NOT NULL AND em >= datetime('now', '-30 hours') AND json_extract(dados, '$.\"Devolução (R$)\"') > 0").bind(mes).all()).results || []);
  const rod = ((await db.prepare("SELECT v.filial, v.rca FROM (SELECT DISTINCT filial, rca FROM gerot_vendedor_mes WHERE mes = ?) v LEFT JOIN ceven_devolucao_checado c ON c.filial = v.filial AND c.rca = v.rca ORDER BY COALESCE(c.em, '') LIMIT ?").bind(mes, maxVend).all()).results || []);
  const fila = [], vistos = new Set(); for (const x of [...pri, ...rod]) { const k = x.filial + '|' + x.rca; if (!vistos.has(k) && fila.length < maxVend) { vistos.add(k); fila.push(x); } }
  let k = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (k < fila.length && Date.now() < fim) {
      const { filial, rca } = fila[k++], fk = String(filial).toLowerCase() + '1';
      try {
        const r = await fetch(`${CEVEN}/api/rca/devolucoes?filial=${fk}&id=${rca}`, { headers: HR, signal: AbortSignal.timeout(15000) });
        if (!r.ok) { falha('lista' + r.status); continue; }
        const L = await r.json(); const lista = Array.isArray(L) ? L : (L && (L.devolucoes || L.items || L.data)) || [];
        res.vendedores++;
        const doMes = lista.filter((n) => n && n.numnota && String(n.data || '').slice(0, 7) === mes && Number(n.vl_devolvido) > 0);
        res.notas_mes += doMes.length;
        if (doMes.length) { const w = await db.batch(doMes.map((n) => db.prepare("INSERT OR IGNORE INTO ceven_devolucao_nota (filial, rca, nota, data, valor, cliente_id, cliente, visto_em) VALUES (?,?,?,?,?,?,?,datetime('now'))").bind(filial, String(rca), String(n.numnota), String(n.data).slice(0, 10), Number(n.vl_devolvido) || 0, n.codcli != null ? String(n.codcli) : null, n.nomecli ? String(n.nomecli).slice(0, 80) : null))); for (const x of w) res.notas_novas += (x.meta && x.meta.changes) || 0; }
        const ja = new Set(((await db.prepare('SELECT nota FROM devolucao_nota_motivo WHERE rca = ?').bind(String(rca)).all()).results || []).map((x) => String(x.nota)));
        for (const n of doMes.filter((n) => !ja.has(String(n.numnota)))) {
          if (Date.now() > fim) break;
          const d = await fetch(`${CEVEN}/api/rca/devolucoes/${encodeURIComponent(n.numnota)}?filial=${fk}&id=${rca}`, { headers: HR, signal: AbortSignal.timeout(15000) }).catch(() => null);
          if (!d || !d.ok) { falha('motivo' + (d ? d.status : 'x')); continue; }
          const det = await d.json().catch(() => null); const arr = Array.isArray(det) ? det : (det && (det.itens || det.items || det.data)) || [];
          const motivos = [...new Set(arr.map((x) => String(x.motivo || '').trim().toUpperCase()).filter(Boolean))]; if (!motivos.length) { falha('sem_motivo'); continue; }
          const np = motivos.some((m) => /N[AÃ]O PEDIU/.test(m)) ? 1 : 0;
          await db.prepare("INSERT OR REPLACE INTO devolucao_nota_motivo (rca, nota, nao_pediu, motivos, resolvido_em) VALUES (?, ?, ?, ?, datetime('now'))").bind(String(rca), String(n.numnota), np, motivos.join(' / ').slice(0, 200)).run();
          res.motivos++;
        }
        await db.prepare("INSERT INTO ceven_devolucao_checado (filial, rca, em) VALUES (?, ?, datetime('now')) ON CONFLICT (filial, rca) DO UPDATE SET em = excluded.em").bind(filial, String(rca)).run();
      } catch (e) { falha(String((e && e.name) || 'erro')); }
    }
  }));
  res.prioridade = pri.length;
  return res;
}
