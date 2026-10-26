// =========================================================================
// MEDIÇÃO "ENTENDER COM IA" x "PALAVRAS-CHAVE" (Vitório, 25/10/2026: só ligar se errar menos).
// Perguntas escritas de jeitos FORA do padrão (como gente de verdade escreve). Para cada uma:
//   ANTES  = só palavras-chave (respostaPronta);  DEPOIS = palavras-chave e, se não acharem, a IA traduz e o código responde.
//   Acerto = a resposta traz o que a pergunta pede (regex). Também conta resposta ERRADA (respondeu outra coisa) — o pior caso.
// Precisa do site rodando localmente com IA:  npx wrangler pages dev public --binding JOTA_TESTE=1 --port 8799
// uso: node testes/jota_entende_ia.mjs [--url=http://127.0.0.1:8799]
// =========================================================================
import path from 'path'; import { fileURLToPath } from 'url';
import { carregaJota } from './_jota_loader.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_DEV = (process.argv.find((x) => x.startsWith('--url=')) || '--url=http://127.0.0.1:8799').slice(6);
const D = { nome: 'VITORIO', papel: 'diretoria' }, G = { nome: 'MARCELO', papel: 'gerente', filial: 'API' };
// [perfil, pergunta, o que a resposta TEM que trazer]
const P = [
  [D, 'me fala como anda a TBL', /Faturado/], [D, 'tbl ta como hj', /Faturado/], [D, 'situação da filial de Cascavel TCV', /Faturado/], [D, 'qual o panorama da TPH nesse momento', /Faturado/],
  [D, 'quanto ainda precisamos faturar para chegar na meta da ABC', /por dia útil|MN/], [D, 'falta muito pra ABC fechar a meta?', /por dia útil|MN/], [D, 'qto precisa vender por dia em TSJ pra bater', /por dia útil|MN/],
  [D, 'a equipe do supervisor Kleberson como ta', /Kleberson|Equipe/i], [D, 'me dá os números do time do Igor', /Igor|Equipe/i],
  [D, 'e a Giovana 181 como foi no mês', /Giovana/i], [D, 'situação da vendedora Tamara', /Tamara/i],
  [D, 'quem ainda não tirou pedido hoje na API', /[Zz]erad/], [D, 'tem vendedor sem vender nada hoje em TBL?', /[Zz]erad/],
  [D, 'como foram as visitas da rota hoje em TPH', /visita|Rota/i], [D, 'a rota rodou bem hoje na MCD?', /visita|Rota/i],
  [D, 'quantos clientes compraram no mês em TCA', /[Pp]ositiva/], [D, 'positivamos quantos clientes na TBE até agora', /[Pp]ositiva/],
  [D, 'quem são os campeões de vendas em TBL', /Melhores|ranking|meta/i], [D, 'os vendedores que mais estão performando', /Melhores|ranking|meta/i],
  [D, 'em que lugar a TPH está no campeonato', /Champions|Liga|pts/], [D, 'tabela do campeonato das filiais', /Champions|Liga|pts/],
  [D, 'teve penalidade hoje no campeonato?', /[Ll]ances|[Pp]ênalti|[Ii]mpedimento/],
  [D, 'quanto voltou de mercadoria esse mês e por quê', /[Dd]evolu/], [D, 'motivo das mercadorias devolvidas', /[Dd]evolu/],
  [D, 'teve corte de produto hoje?', /[Cc]orte/], [D, 'os supervisores fizeram o ret?', /[Cc]ompromisso|RET/],
  [D, 'quanto temos de pedido pendente para faturar', /[Pp]endente|carteira/i], [D, 'o que ainda não foi faturado na TPH', /[Pp]endente|carteira/i],
  [D, 'como está o prêmio extra do mês', /[Ii]ncentivo|110/], [D, 'quantos vão levar o bônus do mês', /[Ii]ncentivo|110/],
  [D, 'a ferramenta de sugestão de produtos tá sendo usada?', /MIX|mix/], [D, 'como vai o uso do mais mix pela turma', /MIX|mix/],
  [D, 'como foram as vendas da nossa marca', /Marca|MARCAS/i], [D, 'zipoca e skive como estão', /Marca|MARCAS/i],
  [D, 'quem são os clientes que levam Trakinas em TBE', /Trakinas/i], [D, 'onde a gente vende mais Tixan em TBL', /Tixan/i],
  [D, 'a Marilan tá positivando bem em TBL?', /Marilan/i], [D, 'como a mondelez anda em TBE', /Mondelez/i],
  [D, 'a Heinz vai bater o objetivo deles?', /Metas das indústrias|Heinz/i], [D, 'objetivo da Colgate em MCD como está', /Metas das indústrias|Colgate/i], [D, 'a Giovana 181 tá batendo os objetivos dos fornecedores?', /Metas das indústrias/],
  [D, 'em que dia o Snickers sai mais em TBL', /Dia da semana|melhor é/i], [D, 'Snickers vende mais segunda ou sexta em TBL?', /Dia da semana|melhor é/i],
  [D, 'evolução semanal do Snickers em TBL', /Semana a semana/i], [D, 'Snickers semana após semana em TBL', /Semana a semana/i],
  [D, 'Snickers este mês contra setembro em TBL', /Mês a mês|×|setembro/i], [D, 'Lacta cresceu ou caiu em TBE em relação ao mês anterior', /Mês a mês|×|setembro/i],
  [D, 'estamos vendendo mais ou menos que em setembro', /setembro|×/], [D, 'outubro tá melhor que setembro na TPH?', /setembro|×/],
  [D, 'clientes que deixaram de levar Snickers em TBL', /parou|pararam|recupera|Snickers/i], [D, 'quem sumiu de comprar Marilan em TBL', /parou|pararam|recupera|Marilan/i],
  [D, 'tem vendedor parado há dias na TBL?', /dias/], [D, 'clientes grandes que pararam de comprar na TBL', /sem comprar|dias|curva/i],
  [D, 'por que os clientes não estão comprando na TBL', /[Mm]otivo/], [D, 'quais desculpas os vendedores deram no mês em TCA', /[Mm]otivo/],
  [D, 'que produtos levar pro Mercolombo em TBL', /oferecer|Mercolombo/i], [D, 'sugestão de itens pro cliente Mercolombo', /oferecer|Mercolombo/i],
  [D, 'a quanto está saindo o Snickers em média', /preço|médio/i], [D, 'quais itens mais saíram no mês em TBL', /produto|R\$/i],
  [G, 'como ta minha filial', /Faturado/], [G, 'quem n vendeu nada hj', /[Zz]erad/], [G, 'meus supervisores como estão', /supervisor|Equipe/i], [G, 'qto falta p meta', /por dia útil|MN/],
];
const J = await carregaJota(raiz); const { _teste } = J;
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
const fichas = await fetch(URL_DEV + '/api/jota-entende-teste', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(P.map(([perfil, texto]) => ({ perfil, texto }))) }).then((r) => r.json());
const R = { antes: { ok: 0, errada: 0, nada: 0 }, depois: { ok: 0, errada: 0, nada: 0 } }; const linhas = [];
for (const [i, [perfil, q, re]] of P.entries()) {
  const B = _teste.criaBase(ORIGIN, {});
  let a = null; try { a = await _teste.respostaPronta(B, perfil, q, []); } catch (e) {}
  let d = a, via = 'palavras';
  if ((!d || d.fraca) && fichas[i]) { try { const r2 = await _teste.respostaPronta(_teste.criaBase(ORIGIN, {}), perfil, fichas[i].pergunta, []); if (r2 && !r2.fraca) { d = r2; via = 'IA → "' + fichas[i].pergunta + '"'; } } catch (e) {} }
  if (a != null) a = String(a); if (d != null) d = String(d);
  const st = (r) => (r == null ? 'nada' : re.test(r) ? 'ok' : 'errada');
  R.antes[st(a)]++; R.depois[st(d)]++;
  linhas.push(`${st(a).padEnd(6)} → ${st(d).padEnd(6)} | ${q}${d !== a ? '  [' + via + ']' : ''}${st(d) === 'errada' ? '\n          resposta: ' + String(d).split('\n')[0].slice(0, 110) : ''}`);
}
J.limpa();
console.log(linhas.join('\n'));
const pc = (x) => (x / P.length * 100).toFixed(1).replace('.', ',') + '%';
console.log(`\n${P.length} perguntas fora do padrão\nSÓ PALAVRAS-CHAVE: acerto ${pc(R.antes.ok)} · errada ${pc(R.antes.errada)} · sem resposta ${pc(R.antes.nada)}\nCOM A IA ENTENDENDO: acerto ${pc(R.depois.ok)} · errada ${pc(R.depois.errada)} · sem resposta ${pc(R.depois.nada)}`);
