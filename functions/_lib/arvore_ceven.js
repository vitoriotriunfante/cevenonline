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
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS arvore_supervisores (filial TEXT NOT NULL, rca TEXT NOT NULL, sup_id TEXT, sup_nome TEXT, atualizado_em TEXT, PRIMARY KEY (filial, rca))').run();
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
          if (v && v.id != null && !out.has(String(v.id))) out.set(String(v.id), { rca: String(v.id), sup_id: String(s.supervisorId == null ? '' : s.supervisorId), sup_nome: limpaSup(s.supervisorNome) });
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
  for (const { g, rows } of resultados) {
    if (!rows || !rows.length) { falhas.push(g.sigla); continue; }
    const stmts = [];
    for (let i = 0; i < rows.length; i += 18) {
      const lote = rows.slice(i, i + 18);
      stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO arvore_supervisores (filial, rca, sup_id, sup_nome, atualizado_em) VALUES ${lote.map(() => '(?,?,?,?,?)').join(',')}`)
        .bind(...lote.flatMap((r) => [g.sigla, r.rca, r.sup_id, r.sup_nome, agora])));
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
    const { results } = await env.DB.prepare('SELECT filial, rca, sup_nome, atualizado_em FROM arvore_supervisores').all();
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
    corpo.arvore_viva = { atualizado_em: ultima, vendedores_com_supervisor_corrigido: ajustados };
  } catch { corpo.arvore_viva = null; }
  return corpo;
}
