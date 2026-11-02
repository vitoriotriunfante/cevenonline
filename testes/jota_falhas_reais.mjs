// PERGUNTAS REAIS QUE FALHARAM (auditoria 01/11/2026). Roda contra a base de producao, so leitura, nada e enviado. uso: node testes/jota_falhas_reais.mjs [filtro]
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
const DIR = { nome: 'VITORIO', papel: 'diretoria', filial: null, grupo: null };
const RUD = { nome: 'RUDINEI RIZATTI', papel: 'diretoria', filial: null, grupo: null };
const ALEX = { nome: 'ALEX SANDRO SOARES ELIAS', papel: 'supervisor', filial: 'TBE', supervisor: 'ALEX SANDRO SOARES ELIAS' };
const PAT = { nome: 'PATRICIA CHAVES MACHADO', papel: 'supervisor', filial: 'TBE', supervisor: 'PATRICIA CHAVES MACHADO' };
const VEND = { nome: 'VENDEDOR TESTE', papel: 'vendedor', filial: 'ABC', rca: '228' };
const WAS = { nome: 'WASHINGTON FLORES DA ROSA', papel: 'supervisor', filial: 'API', supervisor: 'WASHINGTON FLORES DA ROSA' };
const SUE = { nome: 'SUELI APARECIDA TEIXEIRA POLLI', papel: 'supervisor', filial: 'API', supervisor: 'SUELI APARECIDA TEIXEIRA POLLI' };
const CAR = { nome: 'CARLOS CAMARGO', papel: 'supervisor', filial: 'TCV', supervisor: 'CARLOS CAMARGO' };
const P = [
  [DIR, 'Você só mostrou os bloqueados?'], [DIR, 'De novo você divagou na resposta.'], [ALEX, 'Clientes vendedor  x hoje'], [DIR, 'clientes vendedor hoje'], [ALEX, 'De onde vc puxou a  meta ?'], [ALEX, 'top jota'], [ALEX, 'Você não me passou a meta, só informou o significado'], [ALEX, 'Devolução vendedor 309'], [ALEX, 'Como está minha equipe hoje'],
  [WAS, 'No Brasil qual a minha posição no AS'], [WAS, 'minha posição no Brasil no varejo'],
  [DIR, 'Como está a equipe da Priscila de TPH em positivação?'], [ALEX, 'Como eu a meta da colgate da equipe'], [ALEX, 'Do mês'], [DIR, 'Mas só da vendedora Josiane?'], [DIR, 'Quantos clientes a vendedora Luciana positivou com Arcor ?'], [DIR, 'meta da filial TCA'],
  [ALEX, 'Como estou na liga?'], [SUE, 'Quais clientes que não tem venda da Paola Franco?'], [SUE, 'Quais clientes Edinei não vendeu'], [ALEX, 'Qual roteiro da equipe hoje'], [DIR, 'Custo até agora no cloudfare'], [ALEX, 'Num brasileirão, é só contabilizado por pedidos faturados?'],
  [SUE, 'Como fechou o time'], [SUE, 'E os vendedores'], [SUE, 'Mês passado'], [SUE, 'ranking vendedores outubro'],
  [WAS, 'Fechamento time nível Brasil'], [WAS, 'Como esta minha posição ranking nível Brasil supervisor?'], [WAS, 'fechamento'],
  [DIR, 'batemos a meta?'], [DIR, 'faturou?'], [DIR, 'quanto faturado?'], [DIR, 'faturamento acumulado mês'], [DIR, 'como fechamos?'], [DIR, 'fechamento do mes? como estamos no acumulado'],
  [DIR, 'pessoal disse que já faturou tudo e o jota não leu'], [DIR, 'onde atacar positivação'], [DIR, 'qual equipe de supervisão está pior em relação à positivação?'], [DIR, 'qual a equipe de supervisão que está pior em relação à devolução?'], [DIR, 'me manda o resultado de agora aberto por filial'],
  [RUD, 'me passe como foi a venda por vendedor de bally em tcv, tph, tbl e tca'], [RUD, 'venda de bally por supervisor'], [RUD, 'venda por indústria de cada filial'], [RUD, 'resumo de grassi'], [RUD, 'como está a venda do grupo triunfante neste momento ?'], [RUD, 'gap pelos 3 meses'],
  [ALEX, 'como está a atualização do meu time pra este fechamento de outubro'], [ALEX, 'quanto falta de panasonic valor financeiro'], [ALEX, 'relatorio vendedor'], [ALEX, 'como estou no champion'], [PAT, 'como estou no champion'],
  [VEND, 'quanto vendi hoje'], [VEND, 'minha rota de hoje'], [VEND, 'quais clientes faltam visitar'], [VEND, 'clientes que não positivei'], [VEND, '+mix'], [VEND, 'o que oferecer'], [VEND, 'meus cortes'], [VEND, 'meus pedidos'], [VEND, 'como fechei setembro'], [VEND, 'quanto falta para a minha meta'],
];
// D1 de producao SO LEITURA: sem isso, respostas que dependem do banco caem em outro caminho e o teste acusa erro que nao existe. Qualquer escrita e recusada.
import { spawnSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const f = process.argv[2];
const ANT = { 'Do mês': ['positivação'], 'E os vendedores': ['Como fechou o time'], 'Mês passado': ['E os vendedores', 'Como fechou o time'] };
for (const [c, q] of P) {
  if (f && !q.includes(f)) continue;
  try { const r = await _teste.respostaPronta(_teste.criaBase(ORIGIN, { DB }), c, q, ANT[q] || []); console.log(`[${c.papel}] ${q}\n  => ${r == null ? '(SEM RESPOSTA PRONTA: vai para a IA)' : String(r).replace(/\n+/g, ' / ').slice(0, 260)}`); }
  catch (e) { console.log(`[${c.papel}] ${q}\n  => ERRO ${e.message}`); }
}
limpa();
