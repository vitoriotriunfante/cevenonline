// teste com VARIAS mensagens anteriores na ordem do WhatsApp (MAIS NOVA PRIMEIRO): node testes/_t_seq2.mjs papel filial nome "pergunta" "anterior mais nova" "anterior mais velha"...
import path from 'path'; import { fileURLToPath } from 'url';
import { carregaJota } from './_jota_loader.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [papel, filial, nome, q, ...ant] = process.argv.slice(2);
const J = await carregaJota(raiz); const B = J._teste.criaBase('https://ceven-cftv-matrix.pages.dev', {});
console.log(String(await J._teste.respostaPronta(B, { papel, filial: filial || null, nome, supervisor: papel === 'supervisor' ? nome : null }, q, ant)));
J.limpa();
