// Teste funcional do FECHAMENTO DO DIA da liga (functions/_lib/liga_fechamento.js) e da leitura do dia fechado, sem rede:
// D1 simulado com better-sqlite3 e /api/brasileirao-lances falso.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function criaDB() {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
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

export default async function (ok) {
  const lib = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'liga_fechamento.js')).href);
  const env = { DB: criaDB() };
  let chamadas = 0;
  const lances = [
    { hora: '10:01:00', filial: 'ABC', nivel: 'gol', chave: 'gol_super|1', pontos: 5, rca: '1' },
    { hora: '11:00:00', filial: 'TBL', nivel: 'amarelo', chave: 'amarelo|2', pontos: -3, rca: '2' }
  ];
  globalThis.fetch = async (url) => { chamadas++; const u = new URL(url); return { ok: true, json: async () => ({ dia: u.searchParams.get('dia'), lances }) }; };

  // dia passado fecha; guarda lances e total de pontos
  const r1 = await lib.fechaDia(env, 'https://x.test', '2026-10-01');
  ok(r1.status === 'FECHADO' && r1.lances === 2 && r1.pontos === 2 && r1.regras_versao === lib.REGRAS_VERSAO, 'fechamento: dia passado fecha, grava 2 lances, 2 pontos e a versao das regras');
  // idempotente: nao busca de novo nem regrava
  const antes = chamadas;
  lances.push({ hora: '12:00:00', filial: 'ABC', nivel: 'gol', chave: 'gol_super|3', pontos: 5, rca: '3' }); // lance que chegaria depois do fechamento
  const r2 = await lib.fechaDia(env, 'https://x.test', '2026-10-01');
  ok(r2.status === 'JA_FECHADO' && chamadas === antes, 'fechamento: dia ja fechado nao e refeito (nao busca de novo)');
  // leitura devolve o congelado (2 lances), nao os 3 de agora
  const f = await lib.lerDiaFechado(env, '2026-10-01', '');
  ok(f && f.lances.length === 2 && f.cab.regras_versao === lib.REGRAS_VERSAO, 'dia fechado devolve os lances congelados (o lance que chegou depois NAO entra)');
  const fAbc = await lib.lerDiaFechado(env, '2026-10-01', 'ABC');
  ok(fAbc && fAbc.lances.length === 1 && fAbc.lances[0].filial === 'ABC', 'dia fechado filtra por filial');
  // dia aberto: null
  ok((await lib.lerDiaFechado(env, '2026-10-02', '')) === null, 'dia sem fechamento continua aberto (calculo ao vivo)');
  // hoje antes das 19h30 nao fecha
  const hoje = lib.agoraSP().dia, min = lib.agoraSP().min;
  const r3 = await lib.fechaDia(env, 'https://x.test', hoje);
  ok(min >= 22 * 60 ? ['FECHADO', 'JA_FECHADO'].includes(r3.status) : r3.status === 'AINDA_ABERTO', 'hoje antes das 22h o dia nao fecha');
  // dia sem lance (fim de semana) nao cria fechamento vazio
  lances.length = 0;
  const r4 = await lib.fechaDia(env, 'https://x.test', '2026-09-20');
  ok(r4.status === 'SEM_LANCES' && (await lib.lerDiaFechado(env, '2026-09-20', '')) === null, 'dia sem lances nao vira fechamento vazio');
  // falha de leitura nao fecha nada
  globalThis.fetch = async () => ({ ok: false, json: async () => null });
  const r5 = await lib.fechaDia(env, 'https://x.test', '2026-09-21');
  ok(r5.status === 'FALHOU' && (await lib.lerDiaFechado(env, '2026-09-21', '')) === null, 'se nao conseguir ler os lances, o dia continua aberto (nunca fecha vazio por erro)');
}
