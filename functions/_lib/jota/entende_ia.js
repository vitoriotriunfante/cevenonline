// =========================================================================
// JOTA · functions/_lib/jota/entende_ia.js — ENTENDER A PERGUNTA COM IA (Vitório, 25/10/2026: "faça esses dois logo")
// O QUE É: quando as palavras-chave não acham resposta, a IA NÃO responde: ela só TRADUZ a pergunta para um dos formatos que o JOTA
//   já responde com certeza (CATALOGO abaixo) e preenche os campos (filial, pessoa, código, produto, indústria, cliente). O código monta
//   a pergunta-padrão e a resposta sai das mesmas funções conferidas nas sabatinas. A IA nunca produz número.
//   Cada campo é conferido: filial tem que existir, código só dígitos, textos só letras. Intenção fora do catálogo = não usa.
//   A resposta começa com "_Entendi: ..._" para a pessoa ver na hora se o Jota entendeu certo.
// CUSTO: 1 chamada pequena ao Workers AI só quando as palavras-chave falham (cota grátis da Cloudflare; o guarda de custo vigia).
// =========================================================================
import { FILIAIS, sem } from './base.js';

export const CATALOGO = {
  resumo: ['como está {lugar}?', 'situação geral do mês de uma filial ou do grupo (como está o mês, fechamento do mês, panorama geral) — se a pergunta for sobre vendas ou digitado de hoje use a intenção "hoje"'],
  falta: ['quanto falta pra meta {lugar}?', 'quanto falta para bater a meta, MN por dia'],
  hoje: ['hoje {lugar}', 'o que foi vendido/digitado hoje, vendas de hoje, vendas agora, venda atualizada, digitado hoje, pedidos de hoje'],
  por_supervisor: ['por supervisor {lugar}', 'resultado aberto por supervisor'],
  supervisor: ['supervisor {pessoa}', 'resultado de um supervisor e sua equipe'],
  pior_supervisor: ['qual supervisor está puxando pra baixo {lugar}?', 'qual supervisor está pior / puxando para baixo / mais atrás'],
  ranking_supervisores: ['ranking dos supervisores {lugar}', 'ranking/comparação entre supervisores'],
  vendedor: ['como está o vendedor {pessoa} {codigo}?', 'resultado de um vendedor (RCA)'],
  rota_vendedor: ['quais clientes o vendedor {pessoa} {codigo} visitou hoje?', 'rota de hoje de um vendedor, visitas e justificativas do dia'],
  a_visitar: ['quais clientes faltam visitar hoje {lugar}?', 'clientes da rota que ainda faltam visitar hoje'],
  zerados: ['zerados {lugar}', 'vendedores sem pedido/sem vender nada hoje'],
  visitas: ['visitas de hoje {lugar}', 'visitas e eficácia da rota'],
  positivacao: ['positivação {lugar}', 'positivação GERAL (clientes positivados x meta), quando NÃO cita indústria, marca nem produto'],
  ranking: ['ranking {lugar}', 'melhores e piores vendedores'],
  liga: ['liga {lugar}', 'Champions Triunfante (campeonato/tabela das filiais): posição e pontos'],
  lances: ['pênaltis e impedimentos de hoje {lugar}', 'lances/penalidades da liga (campeonato): pênalti, impedimento, cartão, gol'],
  devolucao: ['devoluções do mês por motivo', 'devoluções'],
  cortes: ['cortes de hoje {lugar}', 'cortes e pedidos bloqueados'],
  compromisso: ['quem não fez RET hoje {lugar}?', 'compromisso do dia / RET dos supervisores'],
  carteira: ['quanto tem na carteira {lugar}?', 'pendente / a faturar / ainda não faturado'],
  incentivo: ['incentivo {lugar}', 'incentivo/bônus/prêmio extra do mês (110%, gatilho)'],
  mix: ['+mix {lugar}', 'uso do +MIX (ferramenta de sugestão de produtos)'],
  marca_propria: ['marca própria', 'vendas de marca própria (Zipoca, Skive, Calira, Mitbit, Bellarone)'],
  produto: ['quem compra {produto} {lugar}?', 'vendas de um produto: clientes, vendedores'],
  industria: ['positivação de {industria} {lugar}', 'vendas e positivação de uma indústria/fornecedor (quanto vende, quantos clientes) — sem falar de meta'],
  metas_industria: ['como está a meta da {industria} {lugar}?', 'META/OBJETIVO de uma indústria ou fornecedor (Premiação): faturado x meta, se vai bater'],
  metas_vendedor: ['metas das indústrias do vendedor {pessoa} {codigo}', 'METAS/OBJETIVOS por indústria/fornecedor de um vendedor'],
  dia_semana: ['qual dia da semana mais vende {produto} {lugar}?', 'melhor dia da semana de um produto'],
  semanal: ['vendas semanais de {produto} {lugar}', 'vendas semana a semana'],
  mensal: ['vendas mensais de {produto} {lugar}', 'este mês x mês passado de um produto'],
  compara_mes: ['como estamos em relação ao mês passado {lugar}?', 'comparação com o mês passado'],
  recuperacao: ['quem comprava {produto} e parou {lugar}?', 'clientes que pararam de comprar um produto/indústria'],
  sem_pedido: ['quem está há 3 dias sem pedido {lugar}?', 'vendedores há dias sem vender'],
  clientes_parados: ['clientes curva A sem comprar há mais de 30 dias {lugar}', 'clientes importantes/grandes parados, clientes que não compraram no mês'],
  motivos: ['motivos de não venda no mês {lugar}', 'por que os clientes não compram: motivos, justificativas, desculpas dos vendedores'],
  oferecer: ['o que oferecer pro cliente {cliente}?', 'sugestão de produtos para um cliente (+MIX)'],
  preco: ['qual o preço médio do {produto}?', 'preço médio de venda'],
  top_produtos: ['produtos mais vendidos no mês {lugar}', 'ranking de produtos'],
  ajuda: ['ajuda', 'menu do que o Jota sabe'],
};
const limpo = (s, n = 40) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 +&]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// monta a pergunta-padrao a partir da ficha (devolve null se a ficha nao serve)
export function perguntaDaFicha(f) {
  if (!f || !CATALOGO[f.intencao]) return null;
  const lugar = FILIAIS.includes(String(f.lugar || '').toUpperCase()) ? String(f.lugar).toUpperCase() : '';
  const v = { lugar: lugar ? 'em ' + lugar : '', pessoa: limpo(f.pessoa), codigo: String(f.codigo || '').replace(/\D/g, '').slice(0, 6), produto: limpo(f.produto), industria: limpo(f.industria), cliente: limpo(f.cliente, 60) };
  const modelo = CATALOGO[f.intencao][0];
  for (const k of ['pessoa', 'produto', 'industria', 'cliente']) if (modelo.includes('{' + k + '}') && !v[k]) return null;   /* campo obrigatorio vazio */
  if (modelo.includes('{codigo}') && !v.pessoa && !v.codigo) return null;
  return modelo.replace(/\{(\w+)\}/g, (_, k) => v[k] || '').replace(/\s+([?])/g, '$1').replace(/\s+/g, ' ').trim();
}

const MODELO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export async function entendePorIA(env, c, texto) {
  if (!env || !env.AI) return null;
  const lista = Object.entries(CATALOGO).map(([k, [, d]]) => `- ${k}: ${d}`).join('\n');
  const sys = `Você classifica perguntas de gestores comerciais de uma distribuidora (filiais: ${FILIAIS.join(', ')}). NÃO responda a pergunta.
Devolva SOMENTE um JSON: {"intencao": "<uma das intenções abaixo ou nenhuma>", "lugar": "<sigla da filial citada ou vazio>", "pessoa": "<nome de vendedor/supervisor citado ou vazio>", "codigo": "<código RCA citado ou vazio>", "produto": "<produto/marca citado ou vazio>", "industria": "<indústria/fornecedor citado ou vazio>", "cliente": "<nome do cliente citado ou vazio>"}
Intenções:
${lista}
Regras: use "nenhuma" se a pergunta não se encaixa em nenhuma. Copie nomes exatamente como escritos. Não invente filial, pessoa, produto ou código que não estejam na pergunta.
Quem pergunta: ${c.papel}${c.filial ? ' da filial ' + c.filial : ''}.`;
  try {
    const r = await env.AI.run(MODELO, { messages: [{ role: 'system', content: sys }, { role: 'user', content: String(texto).slice(0, 400) }], max_tokens: 160, temperature: 0 });
    const s = String((r && (r.response ?? r.result)) || '');
    const j = typeof (r && r.response) === 'object' ? r.response : JSON.parse((s.match(/\{[\s\S]*\}/) || ['null'])[0]);
    if (!j || j.intencao === 'nenhuma') return null;
    const p = perguntaDaFicha(j);
    return p ? { ficha: j, pergunta: p } : null;
  } catch (e) { return null; }
}
