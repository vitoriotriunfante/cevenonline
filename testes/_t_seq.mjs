// teste rapido de pergunta COM a anterior (contexto): node testes/_t_seq.mjs papel filial nome "anterior" "pergunta"
import path from 'path'; import { fileURLToPath } from 'url';
import { carregaJota } from './_jota_loader.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [papel, filial, nome, ant, q] = process.argv.slice(2);
const J = await carregaJota(raiz); const B = J._teste.criaBase('https://ceven-cftv-matrix.pages.dev', {});
console.log(String(await J._teste.respostaPronta(B, { papel, filial: filial || null, nome, supervisor: papel === 'supervisor' ? nome : null }, q, [ant])));
J.limpa();
