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
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
export const GERENTES = [
  { sigla: 'TBE', filialKey: 'tbe1', loginNome: 'Diego' }, { sigla: 'TSJ', filialKey: 'tsj1', loginNome: 'Saldanha' },
  { sigla: 'MCD', filialKey: 'mcd1', loginNome: 'Cleverson' }, { sigla: 'TPH', filialKey: 'tph1', loginNome: 'Vagner' },
  { sigla: 'TCG', filialKey: 'tcg1', loginNome: 'Danilo' }, { sigla: 'TPA', filialKey: 'tpa1', loginNome: 'Leandro Souza' },
  { sigla: 'API', filialKey: 'api1', loginNome: 'Marcelo' }, { sigla: 'TCV', filialKey: 'tcv1', loginNome: 'Leonardo' },
  { sigla: 'ABC', filialKey: 'abc1', loginNome: 'Marcos Colling' }, { sigla: 'TCA', filialKey: 'tca1', loginNome: 'Becher' },
  { sigla: 'TBL', filialKey: 'tbl1', loginNome: 'Fabio Machado' }
];
const UA = { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' };
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
    const cr = await fetch(`${CEVEN}/api/gerente/tabelas-cascata?filial=${g.filialKey}`, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
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

// Baixa as 11 filiais e grava no D1. Filial que falhar mantém a árvore anterior dela.
export async function atualizaArvore(env) {
  if (!env.DB) return { status: 'SEM_BANCO' };
  if (!env.CEVEN_GERENTE_SENHA) return { status: 'SEM_SEGREDO' };
  await tabela(env);
  const agora = new Date().toISOString();
  const resultados = await Promise.all(GERENTES.map(async (g) => ({ g, rows: await arvoreDaFilial(g, env.CEVEN_GERENTE_SENHA) })));
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
      try { const x = await fetch(`${CEVEN}/api/filiais/${g.filialKey}/representante/${r.rca}`, { signal: AbortSignal.timeout(10000) }); if (x.ok) { const j = await x.json(); r.canal = String(j.area_atuacao || '').toUpperCase(); } } catch { /* tenta de novo na proxima */ }
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
  return { status: falhas.length ? 'PARCIAL' : 'ATUALIZADA', filiais_ok: ok, filiais_falharam: falhas, vendedores: gravados, atualizado_em: agora };
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
