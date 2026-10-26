// teste rapido: node testes/_t_rapido.mjs "<papel>" "<filial|->" "<supervisor|->" "pergunta 1" "pergunta 2" ...
import path from 'path'; import { fileURLToPath } from 'url';
import { carregaJota } from './_jota_loader.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [papel, filial, sup, ...Q] = process.argv.slice(2);
const c = { nome: sup !== '-' ? sup : 'VITORIO', papel, filial: filial !== '-' ? filial : null, supervisor: sup !== '-' ? sup : null };
const J = await carregaJota(raiz);
for (const q of Q) { const B = J._teste.criaBase('https://ceven-cftv-matrix.pages.dev', {}); let r; try { r = await J._teste.respostaPronta(B, c, q, []); } catch (e) { r = 'ERRO ' + e.stack; } console.log(`\n==== ${q}\n${r}`); }
J.limpa();
