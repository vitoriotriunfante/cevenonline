// PERGUNTAS REAIS QUE FALHARAM (auditoria 01/11/2026). Roda contra a base de producao, so leitura, nada e enviado. uso: node testes/jota_falhas_reais.mjs [filtro]
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
const DIR = { nome: 'VITORIO', papel: 'diretoria', filial: null, grupo: null };
const RUD = { nome: 'RUDINEI RIZATTI', papel: 'diretoria', filial: null, grupo: null };
const ALEX = { nome: 'ALEX SANDRO SOARES ELIAS', papel: 'supervisor', filial: 'TBE', supervisor: 'ALEX SANDRO SOARES ELIAS' };
const PAT = { nome: 'PATRICIA CHAVES MACHADO', papel: 'supervisor', filial: 'TBE', supervisor: 'PATRICIA CHAVES MACHADO' };
const VEND = { nome: 'VENDEDOR TESTE', papel: 'vendedor', filial: 'ABC', rca: '228' };
const P = [
  [DIR, 'batemos a meta?'], [DIR, 'faturou?'], [DIR, 'quanto faturado?'], [DIR, 'faturamento acumulado mês'], [DIR, 'como fechamos?'], [DIR, 'fechamento do mes? como estamos no acumulado'],
  [DIR, 'pessoal disse que já faturou tudo e o jota não leu'], [DIR, 'onde atacar positivação'], [DIR, 'qual equipe de supervisão está pior em relação à positivação?'], [DIR, 'qual a equipe de supervisão que está pior em relação à devolução?'], [DIR, 'me manda o resultado de agora aberto por filial'],
  [RUD, 'me passe como foi a venda por vendedor de bally em tcv, tph, tbl e tca'], [RUD, 'venda de bally por supervisor'], [RUD, 'venda por indústria de cada filial'], [RUD, 'resumo de grassi'], [RUD, 'como está a venda do grupo triunfante neste momento ?'], [RUD, 'gap pelos 3 meses'],
  [ALEX, 'como está a atualização do meu time pra este fechamento de outubro'], [ALEX, 'quanto falta de panasonic valor financeiro'], [ALEX, 'relatorio vendedor'], [ALEX, 'como estou no champion'], [PAT, 'como estou no champion'],
  [VEND, 'quanto vendi hoje'], [VEND, 'minha rota de hoje'], [VEND, 'quais clientes faltam visitar'], [VEND, 'clientes que não positivei'], [VEND, '+mix'], [VEND, 'o que oferecer'], [VEND, 'meus cortes'], [VEND, 'meus pedidos'], [VEND, 'como fechei setembro'], [VEND, 'quanto falta para a minha meta'],
];
const f = process.argv[2];
for (const [c, q] of P) {
  if (f && !q.includes(f)) continue;
  try { const r = await _teste.respostaPronta(_teste.criaBase(ORIGIN, {}), c, q, []); console.log(`[${c.papel}] ${q}\n  => ${r == null ? '(SEM RESPOSTA PRONTA: vai para a IA)' : String(r).replace(/\n+/g, ' / ').slice(0, 260)}`); }
  catch (e) { console.log(`[${c.papel}] ${q}\n  => ERRO ${e.message}`); }
}
limpa();
