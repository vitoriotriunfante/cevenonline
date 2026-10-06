// Arvore viva do CEVEN: supervisor E vendedores vem do CEVEN de hoje; a Gestao de Equipe so manda em mostra/canal/grupo.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

export default async function (ok, RAIZ) {
  const require = createRequire(join(RAIZ, 'package.json'));
  const Database = require('better-sqlite3');
  const lib = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'arvore_ceven.js')).href);
  const db = new Database(':memory:');
  db.exec('CREATE TABLE config_equipe_soberana (id INTEGER PRIMARY KEY, conteudo_json TEXT)');
  db.prepare('INSERT INTO config_equipe_soberana (id, conteudo_json) VALUES (1, ?)').run(JSON.stringify({ filiais: { TPA: [{ rca: '134' }, { rca: '138' }, { rca: '150' }, { rca: '152' }] } }));
  const prep = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async run() { db.prepare(sql).run(...a); return {}; }, async first() { return db.prepare(sql).get(...a) || null; }, async all() { return { results: db.prepare(sql).all(...a) }; } }; return st; };
  const DB = { prepare: prep, async batch(l) { for (const s of l) await s.run(); } };

  // CEVEN falso: so TPA responde. Arvore dos prints de 06/10/2026 (Anderson Giovani x Douglas) + vendedores novos e casos que nao devem entrar
  const original = globalThis.fetch;
  const repres = { 1158: 'VJ', 1200: 'VJ', 1201: 'SUP' };
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (/gerente-auth\/login/.test(u)) { const b = JSON.parse(init.body); return b.filial === 'tpa1' ? { ok: true, json: async () => ({ access_token: 't' }) } : { ok: false, json: async () => ({}) }; }
    if (/tabelas-cascata/.test(u)) return { ok: true, json: async () => ({ supervisores: [
      { supervisorId: 29, supervisorNome: 'ANDERSON GIOVANI FERREIRA BOLTER', tabelas: { produtividade: [{ id: 137, nome: 'NILVIA B' }, { id: 150, nome: 'BRENDA' }, { id: 1200, nome: 'NOVO VENDEDOR TESTE' }], faturamento: [{ id: 137 }], positivacao: [{ id: 1201, nome: 'CONTA SUP' }] } },
      { supervisorId: 30, supervisorNome: 'CLT - DOUGLAS CRISTIANO DOS SANTOS', tabelas: { produtividade: [{ id: 134, nome: 'ANDERSON R' }, { id: 138, nome: 'ELISANGELA' }, { id: 1158, nome: 'VAGO 01' }], faturamento: [], positivacao: [{ id: 152, nome: 'RODRIGO C' }] } }
    ] }) };
    const m = u.match(/representante\/(\d+)/);
    if (m) return { ok: true, json: async () => ({ area_atuacao: repres[m[1]] || null }) };
    return { ok: false, json: async () => ({}) };
  };
  try {
    const env = { DB, CEVEN_GERENTE_SENHA: 'x' };
    const r = await lib.atualizaArvore(env);
    ok(r.status === 'PARCIAL' && r.filiais_ok.join() === 'TPA' && r.vendedores === 8, 'atualiza a arvore: TPA gravada (8 vendedores); filiais que o CEVEN nao respondeu ficam listadas como falha, sem apagar nada');
    ok((await lib.garanteArvore(env, 45)).status === 'FRESCA', 'arvore recente nao e baixada de novo (so renova depois de 45 min)');
    ok((await lib.atualizaArvore({ DB })).status === 'SEM_SEGREDO', 'sem o segredo CEVEN_GERENTE_SENHA nao tenta logar (credencial nunca no codigo)');

    // equipe da Gestao com supervisores VELHOS (o erro real de 06/10): a arvore viva corrige
    const corpo = { filiais: { TPA: [
      { rca: '134', supervisor: 'JEFERSON ANTONIO HOESER', gerente: 'Leandro', grupo: '' }, { rca: '138', supervisor: 'ANDERSON GIOVANI FERREIRA BOLTER', gerente: 'Leandro', grupo: '' },
      { rca: '150', supervisor: 'DOUGLAS CRISTIANO DOS SANTOS', gerente: 'Radke', grupo: '' }, { rca: '152', supervisor: 'DOUGLAS CRISTIANO DOS SANTOS', gerente: 'Leandro', grupo: '' }, { rca: '999', supervisor: 'FULANO' }
    ], TBL: [{ rca: '1', supervisor: 'SUP TBL' }] } };
    await lib.aplicaArvore(env, corpo);
    const sup = Object.fromEntries(corpo.filiais.TPA.map((v) => [v.rca, v.supervisor]));
    ok(sup['134'] === 'DOUGLAS CRISTIANO DOS SANTOS' && sup['138'] === 'DOUGLAS CRISTIANO DOS SANTOS' && sup['150'] === 'ANDERSON GIOVANI FERREIRA BOLTER' && sup['152'] === 'DOUGLAS CRISTIANO DOS SANTOS', 'supervisor passa a ser o do CEVEN de hoje (134 e 138 -> Douglas, 150 -> Anderson Giovani; "CLT - " sai do nome)');
    ok(sup['999'] === 'FULANO' && corpo.filiais.TBL[0].supervisor === 'SUP TBL' && corpo.filiais.TPA[0].supervisor_gestao === 'JEFERSON ANTONIO HOESER', 'vendedor que nao esta na arvore (ou filial sem arvore) nao muda; o nome antigo da Gestao fica guardado em supervisor_gestao');

    // vendedores novos da arvore entram sozinhos; vaga, conta de supervisor e canal SUP nao
    const novo = corpo.filiais.TPA.find((v) => v.rca === '1200');
    ok(novo && novo.mostra === true && novo.auto_arvore === true && novo.supervisor === 'ANDERSON GIOVANI FERREIRA BOLTER' && novo.canal === 'VJ' && novo.nome === 'NOVO VENDEDOR TESTE', 'vendedor novo da arvore do CEVEN entra na lista sozinho (mostra = SIM, supervisor e canal do CEVEN)');
    ok(!corpo.filiais.TPA.some((v) => v.rca === '1158' || v.rca === '1201') && corpo.arvore_viva.vendedores_novos_da_arvore === 2 && corpo.filiais.TPA.some((v) => v.rca === '137'), 'vaga ("VAGO 01") e canal SUP nao entram nas listas');
    ok(novo.gerente === 'Radke' || novo.gerente === 'Leandro', 'gerente do novo vem dos colegas da Gestao (nao inventa)');
  } finally { globalThis.fetch = original; }
}
