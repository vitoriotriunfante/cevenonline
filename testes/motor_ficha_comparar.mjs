// COMPARA o motor por ficha com o caminho atual, nas perguntas reais, sem enviar nada. Le o arquivo local da auditoria (fora do Git). uso: node testes/motor_ficha_comparar.mjs [arquivo.json] [quantos]
import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const raiz = fileURLToPath(new URL('..', import.meta.url)), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motor_'));
const copia = (n) => { let s = fs.readFileSync(path.join(raiz, 'functions/_lib/jota', n), 'utf8'); s = s.replace(/(['"])[^'"]*public\/regras\.js\1/g, `'${pathToFileURL(path.join(raiz, 'public/regras.js')).href}'`).replace(/(from\s+)(['"])(\.[^'"]+)\.js\2/g, '$1$2$3.mjs$2'); fs.writeFileSync(path.join(tmp, n.replace(/\.js$/, '.mjs')), s); };
['motor_ficha.js', 'base.js', 'escopo.js'].forEach(copia);
const { fichaDaPergunta, respondeFicha } = await import(pathToFileURL(path.join(tmp, 'motor_ficha.mjs')).href);

// 1) CASOS FIXOS: soma e ordem conferidas a mao
const V = [
  { rca: '1', nome: 'ANA', filial: 'TBL', supervisor: 'SUP A', fat: 100, pend: 10, dev: 5, pos: 10, metaPos: 20, dig: 1, meta: 200 },
  { rca: '2', nome: 'BIA', filial: 'TBL', supervisor: 'SUP B', fat: 300, pend: 0, dev: 50, pos: 5, metaPos: 10, dig: 2, meta: 300 },
  { rca: '3', nome: 'CAU', filial: 'TPH', supervisor: 'SUP C', fat: 50, pend: 0, dev: 1, pos: 1, metaPos: 10, dig: 0, meta: 100 },
];
const E = { nome: 'Brasil', filiais: ['TBL', 'TPH'], nacional: true, vend: V };
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };
const r = (q) => respondeFicha(E, fichaDaPergunta(q)) || '';
ok(/R\$ 450 de R\$ 600 \(75,0%\)/.test(r('quanto batemos da meta')), 'meta total soma todos');
ok(/1\. TBL/.test(r('faturado por filial')), 'abertura por filial, melhor primeiro');
ok(/^1\. 2 - Bia/m.test(r('qual a pior devolução por vendedor')), 'pior devolucao = maior valor');
ok(/^1\. 3 - Cau/m.test(r('pior positivação por vendedor')), 'pior positivacao = menor %');
ok(fichaDaPergunta('quanto falta da meta colgate') === null, 'marca desconhecida: nao vira meta geral');
ok(/2 - Bia/.test(r('devolução vendedor 2')) && /R\$ 50/.test(r('devolução vendedor 2')), 'codigo do vendedor filtra');
ok(r('devolução vendedor 99') === '', 'codigo que nao esta no escopo: sem resposta');
ok(fichaDaPergunta('venda de bally por cliente') === null, 'assunto fora do motor nao recebe resposta parecida');
ok(respondeFicha({ ...E, supervisor: 'SUP A', nacional: false, filiais: ['TBL'] }, fichaDaPergunta('faturado por supervisor')) === null, 'supervisor nao abre outros supervisores');

// 2) PERGUNTAS REAIS: quantas o motor assume e como o caminho atual respondeu (arquivo local, com dados pessoais: nunca commitar)
const arq = process.argv[2] || path.join(raiz, 'scratch/auditoria_completa_perguntas.json');
if (fs.existsSync(arq)) {
  const P = JSON.parse(fs.readFileSync(arq, 'utf8')), A = P.map((p) => ({ p, f: fichaDaPergunta(p.pergunta) })).filter((x) => x.f);
  console.log(`\nperguntas: ${P.length} · o motor assume: ${A.length}`);
  for (const { p, f } of A.slice(0, Number(process.argv[3]) || 25)) console.log(`- "${String(p.pergunta).slice(0, 70)}" => ${f.indicadores.join('+')}${f.abertura ? ' por ' + f.abertura : ''}${f.ordem ? ' ' + f.ordem : ''} | hoje: ${p.status} | ${String(p.resposta_inicio || '').slice(0, 60).replace(/\n/g, ' ')}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
