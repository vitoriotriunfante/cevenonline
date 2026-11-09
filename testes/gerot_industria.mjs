// TESTES DA RESPOSTA DE INDÚSTRIA (GEROT) — perguntas reais do Rudinei (05/11 e 09/11/2026). Ver docs/GEROT_ESTADO_E_PLANO.md seção 5.
// Nada volta ao ar se algum falhar. Roda em testes/rodar_testes.mjs.
import fs from 'fs';
import { entendeGerot, limpaNome } from '../functions/_lib/jota/respostas/gerot_industria.js';
const NOMES = JSON.parse(fs.readFileSync(new URL('./gerot_fornecedores.json', import.meta.url)));
const HOJE = '2026-11-09';
const casos = [
  ['me passe a venda da industria condor de api', (q) => q && q.industrias.join() === 'A - CONDOR SA' && q.filiais.join() === 'API' && !q.mes],
  ['joata, não foi esta informação que eu solicitei! preciso saber como esta a venda da Industria Condor da filial API', (q) => q && q.industrias.join() === 'A - CONDOR SA' && q.filiais.join() === 'API'],
  ['me passe a venda de condor de api do mes de outubro', (q) => q && q.mes === '2026-10' && q.filiais.join() === 'API' && q.industrias.length === 1],
  ['me passe a venda popr supervisor e vendedor de condor do mes de novmebro! vendas e positivação ! colocar a meta tbm de cada vendedor e listar tbm os vendedores com venda zero', (q) => q && q.recorte === 'supervisor_vendedor' && q.zerados && q.industrias.join() === 'A - CONDOR SA'],
  ['me passe a venda por industria de cada filial', (q) => q && q.porIndustria && q.todasFiliais],
  ['me passe a venda de todas as filiais por industria', (q) => q && q.porIndustria && q.todasFiliais],
  ['me passe como está a venda de condor do grupo triunfante', (q) => q && q.industrias.join() === 'A - CONDOR SA' && q.todasFiliais],
  ['Como esta a venda por industria da filial de TPA', (q) => q && q.porIndustria && q.filiais.join() === 'TPA'],
  ['Bom dia jota ! Me passe um resumo de como estão as vendas', (q) => q === null],
  ['Me passe a venda atualizada das filiais', (q) => q === null],
  ['como esta a marca propria em api', (q) => q && q.industrias.some((n) => /TRIUNFANTE/.test(n)) && q.filiais.join() === 'API'],
  ['condor por vendedor em tcv', (q) => q && q.recorte === 'vendedor' && q.filiais.join() === 'TCV'],
  ['+mix oreo', (q) => q === null],
  ['quem compra oreo em api', (q) => q === null],
  ['clientes que compraram mars em outubro', (q) => q === null],
  ['oreo', (q) => q === null],
  ['venda de super foods em tpa', (q) => q && q.industrias.join() === 'A - SUPER FOODS NUTRICAO ANIMAL LTDA'],
  ['como está a ferrero em tca', (q) => q && q.industrias.length === 1 && /FERRERO/.test(q.industrias[0]) && q.filiais.join() === 'TCA'],
  ['venda de mars no mes passado', (q) => q && q.mes === '2026-10' && q.industrias.every((n) => /MASTERFOODS/.test(n))],
  ['venda de bombril e philips de tpa', (q) => q && q.industrias.some((n) => /BOMBRIL/.test(n))],
];
let falhas = 0;
for (const [p, ok] of casos) { const q = entendeGerot(p, NOMES, HOJE); const passou = !!ok(q); if (!passou) falhas++; console.log((passou ? '  ok     - ' : '  FALHOU - ') + p.slice(0, 70) + (passou ? '' : ' => ' + JSON.stringify(q))); }
// continuação: "CONDOR" sozinho depois de uma pergunta de indústria de API
{ const ant = entendeGerot('venda por vendedor da industria arcor de api', NOMES, HOJE); const q = entendeGerot('CONDOR', NOMES, HOJE, ant); const passou = q && q.industrias.join() === 'A - CONDOR SA' && q.filiais.join() === 'API' && q.recorte === 'vendedor'; if (!passou) falhas++; console.log((passou ? '  ok     - ' : '  FALHOU - ') + 'continuação: "CONDOR" sozinho herda API e por vendedor'); }
{ const passou = limpaNome('A-1 HARIBO BRASIL..........-M-') === 'HARIBO BRASIL'; if (!passou) falhas++; console.log((passou ? '  ok     - ' : '  FALHOU - ') + 'limpa o nome "A-1 HARIBO"'); }
console.log(falhas ? `GEROT: ${falhas} FALHARAM` : 'GEROT: todos ok');
process.exit(falhas ? 1 : 0);
