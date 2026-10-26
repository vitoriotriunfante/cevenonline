// =========================================================================
// PERGUNTAS REAIS DO JOTA (Vitorio, 26/10/2026: "tudo que eles e outros supervisores estao perguntando vc precisa organizar as respostas para caso outros
// supervisores facam a mesma pergunta... vamos ir aprendendo com o pessoal e ajustando as respostas").
// Cada pergunta que alguem fez de verdade e o JOTA errou vira um caso em MAIS_MIX/JOTA/perguntas_reais.json, com o perfil de quem perguntou e:
//   deve: lista de expressoes que a resposta TEM que conter (regex, sem acento/maiusculas importam);  nao: expressoes que NAO pode conter.
// Roda o JOTA de verdade (mesmo codigo do WhatsApp) com os dados de agora do site. Uso: node testes/jota_perguntas_reais.mjs
// =========================================================================
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { carregaJota } from './_jota_loader.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const casos = JSON.parse(fs.readFileSync(path.join(raiz, 'MAIS_MIX', 'JOTA', 'perguntas_reais.json'), 'utf8'));
const J = await carregaJota(raiz);
const tira = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
let ok = 0, falhas = [];
for (const c of casos) {
  const B = J._teste.criaBase('https://ceven-cftv-matrix.pages.dev', {});
  let r; try { r = String(await J._teste.respostaPronta(B, c.perfil, c.pergunta, c.anteriores || [])); } catch (e) { r = 'ERRO ' + e.message; }
  const R = tira(r);
  const faltou = (c.deve || []).filter((x) => !new RegExp(tira(x)).test(R)), sobrou = (c.nao || []).filter((x) => new RegExp(tira(x)).test(R));
  if (!faltou.length && !sobrou.length) ok++;
  else falhas.push(`✗ [${c.id}] ${c.perfil.nome} (${c.perfil.filial || 'Brasil'}): "${c.pergunta}"` + (faltou.length ? `\n    faltou: ${faltou.join(' | ')}` : '') + (sobrou.length ? `\n    não podia ter: ${sobrou.join(' | ')}` : '') + `\n    resposta: ${r.replace(/\n/g, ' ⏎ ').slice(0, 220)}`);
}
J.limpa();
console.log(falhas.join('\n'));
console.log(`\nPERGUNTAS REAIS: ${ok} de ${casos.length} certas`);
process.exit(falhas.length ? 1 : 0);
