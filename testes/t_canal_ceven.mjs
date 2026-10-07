// Testes: canal vindo do CEVEN (area_atuacao) por cima do canal da Gestao; vendedor oculto nao gera lance; Super Pedido do AS = R$ 75.000.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export default async function (ok) {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec("CREATE TABLE canal_ceven (filial TEXT NOT NULL, rca TEXT NOT NULL, canal TEXT, em INTEGER, PRIMARY KEY (filial, rca)); CREATE TABLE arvore_supervisores (filial TEXT NOT NULL, rca TEXT NOT NULL, sup_id TEXT, sup_nome TEXT, atualizado_em TEXT, nome TEXT, canal TEXT, PRIMARY KEY (filial, rca));");
  db.prepare('INSERT INTO canal_ceven VALUES (?, ?, ?, ?)').run('TBL', '198', 'AS', 1); // Luciano: CEVEN diz AS
  db.prepare('INSERT INTO canal_ceven VALUES (?, ?, ?, ?)').run('TBL', '10', '', 1);    // CEVEN sem canal: mantem o da Gestao
  db.prepare('INSERT INTO canal_ceven VALUES (?, ?, ?, ?)').run('TBL', '11', 'VJ', 1);  // igual: nao mexe
  const wrap = (sql) => { const st = db.prepare(sql); let a = []; const o = { bind: (...x) => { a = x; return o; }, all: async () => ({ results: st.all(...a) }), first: async () => st.get(...a) || null, run: async () => { const r = st.run(...a); return { meta: { changes: r.changes } }; } }; return o; };
  const env = { DB: { prepare: wrap } };
  const { aplicaArvore } = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'arvore_ceven.js')).href);
  const corpo = { filiais: { TBL: [{ rca: 198, nome: 'LUCIANO', canal: 'VJ', mostra: false }, { rca: 10, nome: 'B', canal: 'VJ' }, { rca: 11, nome: 'C', canal: 'VJ' }, { rca: 12, nome: 'D', canal: 'AS' }] } };
  await aplicaArvore(env, corpo);
  const [l, b, c, d] = corpo.filiais.TBL;
  ok(l.canal === 'AS' && l.canal_gestao === 'VJ', 'canal do CEVEN vale: Luciano (Gestao dizia VJ, CEVEN diz AS) passa a AS e guarda o canal da Gestao');
  ok(b.canal === 'VJ' && !b.canal_gestao && c.canal === 'VJ' && !c.canal_gestao && d.canal === 'AS', 'CEVEN sem canal ou igual a Gestao: nada muda; quem nao foi consultado fica como estava');
  ok(corpo.canais_do_ceven && corpo.canais_do_ceven.vendedores_com_canal_corrigido === 1, 'resposta informa quantos canais foram corrigidos');

  const oc = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'equipe_ocultos.js')).href);
  const set = new Set(['TBL|198']);
  ok(oc.lanceDeOculto({ filial: 'MTZ', chave: 'TBL|ven10|198', rca: '198' }, set) && oc.lanceDeOculto({ filial: 'TBL', chave: 'ven10|198', rca: 198 }, set) && !oc.lanceDeOculto({ filial: 'TBL', chave: 'ven10|199', rca: '199' }, set) && !oc.lanceDeOculto({ filial: 'TPH', chave: 'ven10|198', rca: '198' }, set), 'lance de vendedor OCULTO e reconhecido pela filial (tambem o gravado pela Matriz com prefixo) e pelo codigo; outra filial com o mesmo codigo nao');
  for (const [arq, trecho] of [['functions/api/brasileirao-lances.js', 'lanceDeOculto(l, ocultos)'], ['functions/api/tv-lances.js', 'lanceDeOculto({ ...r, filial }, oc)'], ['public/matrizapp.html', 'ocultosMz.has(sig']]) {
    ok(readFileSync(join(RAIZ, arq), 'utf8').includes(trecho), arq + ': vendedor oculto na Gestao nao gera nem mostra lance');
  }
  ok(readFileSync(join(RAIZ, 'functions/api/tv-lances.js'), 'utf8').includes('!lanceDeOculto({ ...l, filial }, ocP)'), 'tv-lances: o registro de lance novo tambem recusa vendedor oculto');
  const cl = readFileSync(join(RAIZ, 'functions/api/cron-lances.js'), 'utf8');
  ok(cl.includes("['AS', 'PET AS'].includes(v.canal) ? 75000 : 15000") && readFileSync(join(RAIZ, 'public/tvapp.html'), 'utf8').includes("['AS', 'PET AS'].includes(v.canal) ? 75000 : 15000") && readFileSync(join(RAIZ, 'public/matrizapp.html'), 'utf8').includes("['AS', 'PET AS'].includes(v.canal) ? 75000 : 15000"), 'Super Pedido: R$ 15.000 no Varejo e R$ 75.000 no AS (coletor, TV e Matriz)');
  const au = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'auditoria_lance.js')).href);
  const base = { vendedor: 'X', rca: '1', supervisor: 'S', hora: '12:00:00', pontos: 5, chave: 'gol_super|1' };
  ok(au.auditaLance({ ...base, obs: 'digitado do dia R$ 80.000 (minimo R$ 75.000)' }).falhas.length === 0 && au.auditaLance({ ...base, obs: 'digitado do dia R$ 16.000 (minimo R$ 15.000)' }).falhas.length === 0 && au.auditaLance({ ...base, obs: 'digitado do dia R$ 60.000 (minimo R$ 75.000)' }).falhas.length === 1, 'auditoria: o minimo do Super Pedido vem escrito na prova (15.000 Varejo ou 75.000 AS) e o valor tem que alcancar');
  // GOL DE MARCA PROPRIA (+8, a partir de 08/10/2026, Varejo e AS): lance proprio, sai na frente, estrela, qualificado
  const cfg = JSON.parse(readFileSync(join(RAIZ, 'config/pontuacao_brasileirao.json'), 'utf8')), pub = JSON.parse(readFileSync(join(RAIZ, 'public/pontuacao_brasileirao.json'), 'utf8'));
  ok(cfg.pontos_por_lance.gol_marca_propria.pontos === 8 && pub.pontos_por_lance.gol_marca_propria.pontos === 8 && Math.max(...Object.values(cfg.pontos_por_lance).filter((x, i, a) => x.nome.indexOf('Tripla') < 0).map(x => x.pontos)) === 8 && cfg.pontos_por_lance.gol_mp_tripla.pontos === 10 && pub.pontos_por_lance.gol_mp_tripla.pontos === 10, 'Gol de Marca Propria vale +8 (o mais valioso dos gols) e a Tripla de Marca Propria +10 (bonus por cima), em config e copia publica');
  ok(cl.includes("t.dia >= '2026-10-08' && mp >= 50") && readFileSync(join(RAIZ, 'public/tvapp.html'), 'utf8').includes("HOJE0 >= '2026-10-08' && mp >= 50") && readFileSync(join(RAIZ, 'public/matrizapp.html'), 'utf8').includes("HOJE0 >= '2026-10-08' && mp >= 50"), 'Gol de Marca Propria: pedido com R$ 50+ de Marca Propria, a partir de 08/10/2026, no coletor, na TV e na Matriz');
  ok(readFileSync(join(RAIZ, 'functions/api/brasileirao-lances.js'), 'utf8').includes('gol_marca_propria: {') && au.auditaLance({ ...base, chave: 'gol_marca_propria|1|2', pontos: 8, obs: 'MARCA PROPRIA R$ 61,25 (minimo R$ 50) | PEDIDO DE HOJE: 123 · BLOQUEADO' }).falhas.length === 0 && au.auditaLance({ ...base, chave: 'gol_marca_propria|1|2', pontos: 8, obs: 'MARCA PROPRIA R$ 30,00 (minimo R$ 50) | PEDIDO DE HOJE: 123' }).falhas.length === 1, 'pontos no endpoint da liga e auditoria do Gol de Marca Propria (valor na prova, minimo R$ 50 e pedido de hoje)');
  // TRIPLA DE MARCA PROPRIA (+10, a partir de 09/10/2026, Varejo e AS): 3+ clientes no dia com R$ 50+ de Marca Propria
  { const cl = readFileSync(join(RAIZ, 'functions/api/cron-lances.js'), 'utf8'), tv = readFileSync(join(RAIZ, 'public/tvapp.html'), 'utf8'), mz = readFileSync(join(RAIZ, 'public/matrizapp.html'), 'utf8');
    ok(cl.includes("t.dia >= '2026-10-09'") && cl.includes('gol_mp_tripla|') && tv.includes("HOJE0 >= '2026-10-09'") && mz.includes("HOJE0 >= '2026-10-09'") && tv.includes('estrelasMP(item)') && mz.includes('estrelasMP(item)'), 'Tripla de Marca Propria: coletor, TV e Matriz detectam (a partir de 09/10) e a animacao de estrelas esta ligada');
    ok(readFileSync(join(RAIZ, 'functions/api/brasileirao-lances.js'), 'utf8').includes('gol_mp_tripla: {')
      && au.auditaLance({ ...base, chave: 'gol_mp_tripla|1', pontos: 10, obs: '3 clientes com R$ 50+ de MARCA PROPRIA no dia (minimo 3): A R$ 60,00; B R$ 70,00; C R$ 55,00' }, { dia: '2026-10-09' }).falhas.length === 0
      && au.auditaLance({ ...base, chave: 'gol_mp_tripla|1', pontos: 10, obs: '2 clientes com R$ 50+ de MARCA PROPRIA no dia (minimo 3): A; B' }, { dia: '2026-10-09' }).falhas.length === 1
      && au.auditaLance({ ...base, chave: 'gol_mp_tripla|1', pontos: 10, obs: '3 clientes com R$ 50+ de MARCA PROPRIA no dia (minimo 3): A; B; C' }, { dia: '2026-10-08' }).falhas.length === 1, 'auditoria da Tripla: exige 3+ clientes na prova e recusa dia anterior a 09/10'); }
}
