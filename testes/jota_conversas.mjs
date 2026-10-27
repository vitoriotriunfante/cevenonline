// =========================================================================
// CONVERSAS (estado da conversa / slot carryover, 27/10/2026): roda uma SEQUENCIA de perguntas da mesma pessoa, com o estado guardado entre elas (em memoria),
// como no WhatsApp. Cada passo tem o que a resposta TEM que conter. Uso: node testes/jota_conversas.mjs
// =========================================================================
import path from 'path'; import { fileURLToPath } from 'url';
import { carregaJota } from './_jota_loader.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = await carregaJota(raiz);
const tira = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const VIT = { papel: 'diretoria', nome: 'VITORIO', celular: 'teste-vitorio' };
const CONVERSAS = [
  ['Tamara: clientes, pedidos pendentes de quem ela vendeu', VIT, [
    ['clientes tamara tcv hoje', ['352 - TAMARA', 'ROTA DE HOJE']],
    ['+mix', ['ROTA DE HOJE DE 352']],
    ['quais clientes ela vendeu e não faturou ainda? qual status dos pedidos?', ['352 - TAMARA'], ['BRASIL']],
    ['e o mês?', ['352 - TAMARA'], ['BRASIL']]]],
  ['Vendedor 1067: devolução fica nele', VIT, [
    ['como está o vendedor 1067 de MCD?', ['1067']],
    ['devolução dele', ['1067'], ['DEVOLUCOES NO MES .. BRASIL']]]],
  ['TSJ: depois de falar da filial, continua nela', VIT, [
    ['como está TSJ hoje?', ['TSJ']],
    ['zerados', ['TSJ'], ['BRASIL']],
    ['pedidos bloqueados', ['TSJ'], ['BRASIL']]]],
  ['Brasil abre o escopo de novo', VIT, [
    ['como está TSJ?', ['TSJ']],
    ['e no Brasil?', ['BRASIL']]]],
  ['"gerente" não vira vendedor', VIT, [
    ['devoluções no Brasil aberta por filial, gerente, supervisor e vendedor', ['DEVOLU']],
    ['quantos pedidos feitos hoje?', [], ['GERENTE TPH']]]],
  ['Auditoria 27/10 — Bis em TSJ: desses, quais na rota de hoje', VIT, [
    ['Quem comprava bis 10 em TSJ e parou?', ['RECUPERACAO', 'TSJ']],
    ['Desses clientes que não compraram, tem algum na rota de hoje dos vendedores?', ['ROTA DE HOJE', 'BIS'], ['HA MAIS DE 30 DIAS']]]],
  ['Auditoria 27/10 — TSJ fica na conversa', VIT, [
    ['como está TSJ hoje?', ['TSJ']],
    ['Quantos e quais clientes que não compram a mais de 30 dias tem na rota hoje e o vendedor já visitou e não vendeu?', ['TSJ', '30 DIAS'], ['JOSEANNE']]]],
  ['Auditoria 27/10 — Evandro', { papel: 'diretoria', nome: 'EVANDRO SERVAT', celular: 'teste-evandro' }, [
    ['clientes da vendedora BRANDA, TPA, hoje', ['150 - BRENDA']],
    ['clientes dos vendedores da filial TBE', ['TBE', 'SEM COMPRA NO MES'], ['TBE AGORA']],
    ['lista completa dos vendedores SEM VISITA, hoje por filial', ['SEM NENHUMA VISITA']]]],
  ['Auditoria 27/10 — devolução do vendedor e do gerente', VIT, [
    ['Devolução do vendedor 1067, apenas do vendedor 1067.', ['1067']],
    ['Devolução apenas da filial MCD do gerente Adriano.', ['MCD', 'ADRIANO']]]],
];
let ok = 0, tot = 0; const falhas = [];
for (const [nome, perfil, passos] of CONVERSAS) {
  const mem = new Map(); const B = J._teste.criaBase('https://ceven-cftv-matrix.pages.dev', {});
  B.ctxLer = async (cel) => mem.get(cel) || null; B.ctxGravar = async (cel, x) => { mem.set(cel, x); };
  const ant = [];
  for (const [q, deve, nao = []] of passos) {
    tot++; let r; try { r = String(await J._teste.respostaPronta(B, perfil, q, ant.slice())); } catch (e) { r = 'ERRO ' + e.message; }
    const R = tira(r); const f1 = deve.filter((x) => !new RegExp(tira(x)).test(R)), f2 = nao.filter((x) => new RegExp(tira(x)).test(R));
    if (!f1.length && !f2.length) ok++; else falhas.push(`✗ [${nome}] "${q}"` + (f1.length ? `\n    faltou: ${f1.join(' | ')}` : '') + (f2.length ? `\n    não podia ter: ${f2.join(' | ')}` : '') + `\n    resposta: ${r.replace(/\n/g, ' ⏎ ').slice(0, 200)}`);
    ant.unshift(q);   /* WhatsApp: mais nova primeiro */
  }
}
J.limpa(); console.log(falhas.join('\n')); console.log(`\nCONVERSAS: ${ok} de ${tot} passos certos`); process.exit(falhas.length ? 1 : 0);
