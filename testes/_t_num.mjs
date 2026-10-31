// teste rapido: resposta so com numero depois da lista "Quem falta positivar" (Rogerio/TPA, 31/10/2026: "6" e "(6)" abriam o resumo do vendedor na IA)
import path from 'path'; import { fileURLToPath } from 'url';
import { carregaJota } from './_jota_loader.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = await carregaJota(raiz);
const c = { nome: 'ROGERIO DORNELLES PASSOS', papel: 'supervisor', filial: 'TPA', supervisor: 'ROGERIO DORNELLES PASSOS' };
const B0 = J._teste.criaBase('https://ceven-cftv-matrix.pages.dev', {});
const lista = await J._teste.respostaPronta(B0, c, 'Curva negativa', []);
for (const [q, ant] of [['6', ['Curva negativa']], ['(6)', ['6', 'Curva negativa']], ['6', ['6', 'Curva negativa']]]) {
  const B = J._teste.criaBase('https://ceven-cftv-matrix.pages.dev', {}); B.ultOut = String(lista);
  let r; try { r = await J._teste.respostaPronta(B, c, q, ant); } catch (e) { r = 'ERRO ' + e.stack; }
  console.log(`\n==== "${q}" depois de ${JSON.stringify(ant)}\n${String(r).slice(0, 260)}`);
}
J.limpa();
