// SIMULADOR DO JOTA: roda perguntas reais contra a base de PRODUCAO (somente leitura, nada e enviado).
// uso: node testes/t_jota.mjs [filtro]
import fs from 'fs'; import path from 'path'; import os from 'os'; import { pathToFileURL } from 'url';
const src = fs.readFileSync(new URL('../functions/api/whatsapp/bot.js', import.meta.url), 'utf8');
const tmp = path.join(os.tmpdir(), 'jota_bot_' + Date.now() + '.mjs'); fs.writeFileSync(tmp, src);
const { _teste } = await import(pathToFileURL(tmp).href);
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
const DIR = { nome: 'VITORIO', papel: 'diretoria', filial: null, grupo: null };
const GER_API = { nome: 'GERENTE API', papel: 'gerente', filial: 'API', grupo: null };
const GER_TPH = { nome: 'FABIO', papel: 'gerente', filial: 'TPH', grupo: 'FABIO' };
const P = [
 [DIR, 'Qual o acumulado de hoje dos vendedores de rota em API?'], [DIR, 'quem não fez RET hoje ?'], [DIR, 'quero saber quem não fez o RET em todo o brasil?'],
 [DIR, 'como estamos?'], [DIR, 'como está TPH?'], [DIR, 'hoje'], [DIR, 'zerados'], [DIR, 'quanto falta pra bater a meta?'], [DIR, 'ranking'], [DIR, 'top 10 hoje'],
 [DIR, 'positivação'], [DIR, 'visitas'], [DIR, 'eficácia da rota TBL'], [DIR, 'devoluções'], [DIR, 'pênaltis'], [DIR, 'impedimentos de hoje em TSJ'], [DIR, 'liga'],
 [DIR, '+mix'], [DIR, 'quem compra oreo?'], [DIR, 'incentivo'], [DIR, 'o que é positivação?'], [DIR, 'o que é eficácia'], [DIR, 'ajuda'], [DIR, 'oi'],
 [DIR, 'por supervisor em MCD'], [DIR, 'compromisso TSJ'], [DIR, 'como está a vendedora Tamara?'], [DIR, 'supervisor Kleberson'], [DIR, 'quanto vendeu o Gilmar hoje?'],
 [DIR, 'qual a posição do Gilmar na liga?'], [DIR, 'quem tá mal na positivação?'], [DIR, 'qual o ticket médio de hoje?'], [DIR, 'me fala do clima amanhã'],
 [DIR, 'responde sobre mais mix?'], [DIR, 'quantos clientes na rota hoje em TBL?'], [DIR, 'quantas visitas foram feitas hoje?'], [DIR, 'quantos pontos a Tamara tem na champions?'], [DIR, 'qual posição está o Gilmar Poteriko?'], [DIR, 'quais clientes ainda faltam visitar hoje?'], [DIR, 'quais clientes faltam visitar da vendedora Tamara?'], [DIR, 'falta visitar supervisor Kleberson'],
 [DIR, 'a Luana visitou 5 clientes já? quais?'], [DIR, 'quais clientes ela visitou e não vendeu? quais as justificativas que ela deu?', ['a Luana visitou 5 clientes já? quais?']],
 [DIR, 'incentivo TPH'], [DIR, 'incentivo do supervisor Kleberson'], [DIR, 'recorrência'], [DIR, 'resgates em TBL'], [DIR, 'liga AS'], [DIR, 'compromisso da semana TSJ'], [DIR, 'divergências'], [DIR, 'motivos de devolução'], [DIR, 'bola cheia'],
 [DIR, 'cortes e bloqueados de hoje'], [DIR, 'quantos inativos reativados hoje?'], [DIR, 'gestão de campo por filial'], [DIR, 'me manda o relatório das 18:30'], [DIR, 'como fechou ontem?'], [DIR, 'marca própria'], [DIR, 'devoluções entradas hoje'], [GER_TPH, 'me manda o boletim das 17h'], [GER_TPH, 'cortes de hoje'],
 [GER_API, 'como está minha filial?'], [GER_API, 'zerados'], [GER_API, 'por supervisor'], [GER_API, 'como está TPH?'], [GER_API, 'quem compra trident?'],
 [GER_TPH, 'como está?'], [GER_TPH, 'por supervisor'], [GER_TPH, 'liga'], [GER_TPH, 'hoje rota'], [GER_TPH, 'compromisso'],
];
const f = process.argv[2]; let erros = 0;
for (const [c, q, ant] of P) {
  if (f && !q.includes(f)) continue;
  const B = _teste.criaBase(ORIGIN, {}); const t0 = Date.now();
  let r; try { r = await _teste.respostaPronta(B, c, q, ant || []); } catch (e) { r = 'ERRO: ' + e.stack; erros++; }
  console.log(`\n==== [${c.nome}] ${q}  (${Date.now() - t0} ms)\n${r === null ? '(sem resposta pronta -> IA)' : r}`);
  if (r && /undefined|NaN|\[object/.test(r)) { erros++; console.log('!!!! TEXTO SUSPEITO'); }
}
fs.unlinkSync(tmp); console.log('\nerros:', erros);
