// Arvore viva do CEVEN: o supervisor de cada vendedor vem do CEVEN de hoje, nao do nome guardado na Gestao de Equipe.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

export default async function (ok, RAIZ) {
  const require = createRequire(join(RAIZ, 'package.json'));
  const Database = require('better-sqlite3');
  const lib = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'arvore_ceven.js')).href);
  const db = new Database(':memory:');
  const prep = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async run() { db.prepare(sql).run(...a); return {}; }, async first() { return db.prepare(sql).get(...a) || null; }, async all() { return { results: db.prepare(sql).all(...a) }; } }; return st; };
  const DB = { prepare: prep, async batch(l) { for (const s of l) await s.run(); } };

  // CEVEN falso: so TPA responde, com a arvore dos prints de 06/10/2026 (Anderson Giovani x Douglas)
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (/gerente-auth\/login/.test(u)) { const b = JSON.parse(init.body); return b.filial === 'tpa1' ? { ok: true, json: async () => ({ access_token: 't' }) } : { ok: false, json: async () => ({}) }; }
    if (/tabelas-cascata/.test(u)) return { ok: true, json: async () => ({ supervisores: [
      { supervisorId: 29, supervisorNome: 'ANDERSON GIOVANI FERREIRA BOLTER', tabelas: { produtividade: [{ id: 137 }, { id: 150 }, { id: 1120 }], faturamento: [{ id: 137 }], positivacao: [] } },
      { supervisorId: 30, supervisorNome: 'CLT - DOUGLAS CRISTIANO DOS SANTOS', tabelas: { produtividade: [{ id: 134 }, { id: 138 }, { id: 1032 }], faturamento: [], positivacao: [{ id: 152 }] } }
    ] }) };
    return { ok: false, json: async () => ({}) };
  };
  try {
    const env = { DB, CEVEN_GERENTE_SENHA: 'x' };
    const r = await lib.atualizaArvore(env);
    ok(r.status === 'PARCIAL' && r.filiais_ok.join() === 'TPA' && r.vendedores === 7, 'atualiza a arvore: TPA gravada (7 vendedores); filiais que o CEVEN nao respondeu ficam listadas como falha, sem apagar nada');
    ok((await lib.garanteArvore(env, 45)).status === 'FRESCA', 'arvore recente nao e baixada de novo (so renova depois de 45 min)');
    ok((await lib.atualizaArvore({ DB })).status === 'SEM_SEGREDO', 'sem o segredo CEVEN_GERENTE_SENHA nao tenta logar (credencial nunca no codigo)');

    // equipe da Gestao com supervisores VELHOS (o erro real de 06/10): a arvore viva corrige
    const corpo = { filiais: { TPA: [
      { rca: '134', supervisor: 'JEFERSON ANTONIO HOESER' }, { rca: '138', supervisor: 'ANDERSON GIOVANI FERREIRA BOLTER' }, { rca: '150', supervisor: 'DOUGLAS CRISTIANO DOS SANTOS' },
      { rca: '152', supervisor: 'DOUGLAS CRISTIANO DOS SANTOS' }, { rca: '999', supervisor: 'FULANO' }
    ], TBL: [{ rca: '1', supervisor: 'SUP TBL' }] } };
    await lib.aplicaArvore(env, corpo);
    const sup = Object.fromEntries(corpo.filiais.TPA.map((v) => [v.rca, v.supervisor]));
    ok(sup['134'] === 'DOUGLAS CRISTIANO DOS SANTOS' && sup['138'] === 'DOUGLAS CRISTIANO DOS SANTOS' && sup['150'] === 'ANDERSON GIOVANI FERREIRA BOLTER' && sup['152'] === 'DOUGLAS CRISTIANO DOS SANTOS', 'supervisor passa a ser o do CEVEN de hoje (134 e 138 -> Douglas, 150 -> Anderson Giovani; "CLT - " sai do nome)');
    ok(sup['999'] === 'FULANO' && corpo.filiais.TBL[0].supervisor === 'SUP TBL' && corpo.filiais.TPA[0].supervisor_gestao === 'JEFERSON ANTONIO HOESER' && corpo.arvore_viva.vendedores_com_supervisor_corrigido === 3, 'vendedor que nao esta na arvore (ou filial sem arvore) nao muda; o nome antigo da Gestao fica guardado em supervisor_gestao');
  } finally { globalThis.fetch = original; }
}
