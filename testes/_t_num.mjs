// teste rapido: casos de 31/10/2026. Rogerio/TPA: numero depois da lista abre a curva. Gabriel/TCV: primeira pessoa nao herda o vendedor anterior.
import path from 'path'; import { fileURLToPath } from 'url';
import { carregaJota } from './_jota_loader.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = await carregaJota(raiz);
const U = 'https://ceven-cftv-matrix.pages.dev';
const rog = { nome: 'ROGERIO DORNELLES PASSOS', papel: 'supervisor', filial: 'TPA', supervisor: 'ROGERIO DORNELLES PASSOS' };
const gab = { nome: 'GABRIEL MONTEIRO GIROTO', papel: 'supervisor', filial: 'TCV', supervisor: 'VAGO - GABRIEL' };
const lista = await J._teste.respostaPronta(J._teste.criaBase(U, {}), rog, 'Curva negativa', []);
const curva = await J._teste.respostaPronta(J._teste.criaBase(U, {}), gab, 'Preciso da curva negativa do setor de 342', []);
const casos = [[rog, '6', ['Curva negativa'], lista], [rog, '(6)', ['6'], lista],
  [gab, 'Como estou no mes', ['Preciso da curva negativa do setor de 342'], curva], [gab, 'Como esta minha equipe geral?', ['Como estou no mes'], curva], [gab, 'Preciso saber do mês, geral do mês', ['Como esta minha equipe geral?'], curva], [gab, 'Como estou', [], curva]];
for (const [c, q, ant, ult] of casos) {
  const B = J._teste.criaBase(U, {}); B.ultOut = String(ult);
  let r; try { r = await J._teste.respostaPronta(B, c, q, ant); } catch (e) { r = 'ERRO ' + e.stack; }
  console.log(`\n==== ${c.nome.split(' ')[0]}: "${q}"\n${String(r).slice(0, 170)}`);
}
J.limpa();
