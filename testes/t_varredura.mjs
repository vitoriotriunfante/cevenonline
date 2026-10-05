// Testes da varredura central EM CAMADAS (functions/api/cron-varredura-central.js), sem rede e sem Cloudflare:
// D1 simulado com better-sqlite3 (mesmo SQL) e CEVEN simulado por fetch falso que mede quantas chamadas ficam abertas ao mesmo tempo.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function criaDB() {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE filiais (id INTEGER PRIMARY KEY, codigo TEXT);
    CREATE TABLE representantes (codigo TEXT, filial_id INTEGER, ativo INTEGER);
    CREATE TABLE cron_lock_global (id INTEGER PRIMARY KEY, dono TEXT, criado_em TEXT);
    CREATE TABLE varredura_central_rca (
      rca_codigo TEXT NOT NULL, filial_sigla TEXT NOT NULL, data_ref DATE NOT NULL,
      roteiro_json TEXT, produtividade_json TEXT, dashboard_json TEXT, devolucoes_json TEXT, falhas TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (rca_codigo, data_ref));
    INSERT INTO filiais VALUES (1, 'TBL'), (2, 'TBE');`);
  const wrap = (sql) => {
    const st = db.prepare(sql); let args = [];
    const o = {
      bind: (...a) => { args = a; return o; },
      all: async () => ({ results: st.all(...args) }),
      first: async () => st.get(...args) || null,
      run: async () => { const r = st.run(...args); return { meta: { changes: r.changes } }; }
    };
    return o;
  };
  return { prepare: wrap, batch: async (stmts) => { for (const s of stmts) await s.run(); }, _db: db };
}

// CEVEN falso. estado[rca] = { n_rota, pos, dig }. Registra chamadas e o pico de chamadas simultaneas.
function ativaCevenFalso(estado, opcoes = {}) {
  const reg = { chamadas: [], aberta: 0, pico: 0 };
  globalThis.fetch = async (url) => {
    reg.aberta++; reg.pico = Math.max(reg.pico, reg.aberta);
    await new Promise((r) => setTimeout(r, 4));
    reg.aberta--;
    const u = new URL(url); const ep = u.pathname.split('/').pop(); const id = u.searchParams.get('id');
    reg.chamadas.push(ep + ':' + id);
    if (opcoes.falha && opcoes.falha(ep, id)) return { ok: false, text: async () => '' };
    const e = estado[id] || { n_rota: 0, pos: 0, dig: 0 };
    let corpo;
    if (ep === 'roteiro-hoje') corpo = Array.from({ length: e.n_rota }, (_, i) => ({ id_cliente: id + '-' + i, status: i < e.pos ? 'EFETIVADO' : 'ABERTO', versao: e.versao || 1 }));
    else if (ep === 'produtividade') corpo = { dia: { positivacao: e.pos, dig_pedido: e.dig } };
    else if (ep === 'dashboard') corpo = { financeiro: { faturado: 1 }, v: e.versao || 1 };
    else corpo = [];
    return { ok: true, text: async () => JSON.stringify(corpo) };
  };
  return reg;
}

export default async function (ok) {
  const mod = await import(pathToFileURL(join(RAIZ, 'functions', 'api', 'cron-varredura-central.js')).href);
  const rodar = async (db, query = '') => (await mod.onRequestGet({ env: { DB: db }, request: new Request('https://x/api/cron-varredura-central' + query) })).json();
  const N = 12;
  const preenche = (db) => { for (let i = 1; i <= N; i++) db._db.prepare('INSERT INTO representantes VALUES (?, ?, 1)').run(String(i), i % 2 ? 1 : 2); };

  // estado inicial: RCAs 1-8 tem rota; 9-12 nao tem (ex.: televenda, loja)
  const estado = {}; for (let i = 1; i <= N; i++) estado[String(i)] = { n_rota: i <= 8 ? 5 : 0, pos: 0, dig: 0 };

  // 1) partida a frio = varredura completa, nunca mais que 6 chamadas ao mesmo tempo
  let db = criaDB(); preenche(db); let reg = ativaCevenFalso(estado);
  let r = await rodar(db);
  ok(r.modo === 'completa' && reg.chamadas.length === N * 4, `partida a frio faz a varredura completa (${reg.chamadas.length} chamadas = ${N} RCAs x 4 endpoints)`);
  ok(reg.pico <= 6, `varredura completa nunca passa de 6 chamadas ao mesmo tempo (pico ${reg.pico})`);

  // 2) tick em camadas: produtividade de quem tem rota; rota so em fatia; dashboard/devolucoes so em fatia
  reg = ativaCevenFalso(estado);
  r = await rodar(db);
  const cont = (ep) => reg.chamadas.filter((c) => c.startsWith(ep + ':')).length;
  ok(r.modo === 'tick', 'com os RCAs ja gravados hoje, a rodada vira tick em camadas');
  ok(cont('produtividade') >= 8 && cont('produtividade') < N, `tick busca produtividade de quem tem rota e so uma fatia de quem nao tem (${cont('produtividade')} de ${N})`);
  ok(cont('roteiro-hoje') <= Math.ceil(N / 3) + 1 && cont('dashboard') <= 2 && cont('devolucoes') <= 2, `rota, dashboard e devolucoes vao em fatias (rota ${cont('roteiro-hoje')}, dashboard ${cont('dashboard')}, devolucoes ${cont('devolucoes')})`);
  ok(reg.chamadas.length < N * 4 / 1.4, `o tick faz bem menos chamadas que a varredura completa (${reg.chamadas.length} contra ${N * 4})`);
  ok(reg.pico <= 6, `tick nunca passa de 6 chamadas ao mesmo tempo (pico ${reg.pico})`);

  // 3) pedido novo: a rota de quem mudou e buscada NA HORA (evento) e a produtividade ja fica gravada
  estado['3'].pos = 2; estado['3'].dig = 381; estado['3'].versao = 2;
  reg = ativaCevenFalso(estado);
  r = await rodar(db);
  const linha = db._db.prepare("SELECT roteiro_json, produtividade_json FROM varredura_central_rca WHERE rca_codigo = '3'").get();
  ok(reg.chamadas.includes('roteiro-hoje:3') && r.mudaram >= 1, 'pedido novo do RCA 3 dispara a busca da rota dele na hora (evento)');
  ok(JSON.parse(linha.produtividade_json).dia.positivacao === 2 && JSON.parse(linha.roteiro_json)[0].versao === 2, 'a linha do RCA 3 ja traz o pedido novo (2 pedidos) e a rota nova');

  // 4) trava unica: duas rodadas ao mesmo tempo => so uma roda, e o total nunca passa de 6
  reg = ativaCevenFalso(estado);
  const [a, b] = await Promise.all([rodar(db), rodar(db)]);
  ok([a.status, b.status].includes('OCUPADO') && [a.modo, b.modo].includes('tick'), 'duas rodadas simultaneas: uma roda e a outra espera (OCUPADO)');
  ok(reg.pico <= 6, `com duas rodadas disparadas juntas o CEVEN ainda recebe no maximo 6 chamadas ao mesmo tempo (pico ${reg.pico})`);

  // 5) trava expira sozinha se a funcao tinha caido no meio
  db._db.exec("UPDATE varredura_slot SET dono = 'tick:morto', criado_em = datetime('now', '-1 hour') WHERE id = 1");
  reg = ativaCevenFalso(estado);
  r = await rodar(db);
  ok(r.modo === 'tick', 'trava velha de uma rodada que caiu (1 hora) e liberada e a varredura segue');
  db._db.exec("UPDATE varredura_slot SET dono = 'tick:vivo', criado_em = datetime('now', '-20 seconds') WHERE id = 1");
  r = await rodar(db);
  ok(r.status === 'OCUPADO', 'trava recente de uma rodada em andamento (20 s) nao e furada');
  db._db.exec('UPDATE varredura_slot SET dono = NULL WHERE id = 1');

  // 6) falha do CEVEN nao apaga o que ja estava gravado
  const antes = db._db.prepare("SELECT produtividade_json FROM varredura_central_rca WHERE rca_codigo = '3'").get().produtividade_json;
  reg = ativaCevenFalso({ ...estado, 3: { n_rota: 5, pos: 99, dig: 99 } }, { falha: (ep, id) => id === '3' });
  r = await rodar(db);
  const depois = db._db.prepare("SELECT produtividade_json FROM varredura_central_rca WHERE rca_codigo = '3'").get().produtividade_json;
  ok(antes === depois, 'se o CEVEN falha para um RCA, o dado dele que ja estava gravado continua (nunca zera nem inventa)');

  // 7) rodizio: em 3 ticks todos os RCAs tem a rota atualizada pelo menos uma vez; dashboard/devolucoes giram em fatias
  const vistos = new Set(), vistosFria = new Set();
  for (let t = 0; t < 10; t++) {
    reg = ativaCevenFalso(estado);
    await rodar(db);
    reg.chamadas.filter((c) => c.startsWith('roteiro-hoje:')).forEach((c) => vistos.add(c.split(':')[1]));
    reg.chamadas.filter((c) => c.startsWith('dashboard:')).forEach((c) => vistosFria.add(c.split(':')[1]));
  }
  ok(vistos.size === N, `em 10 ticks todos os ${N} RCAs tiveram a rota atualizada (${vistos.size})`);
  ok(vistosFria.size === N, `em 10 ticks todos os ${N} RCAs tiveram dashboard/devolucoes atualizados (${vistosFria.size})`);
}
