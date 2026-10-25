// =========================================================================
// REUNIÃO TENSA DE 5 H — 25/10/2026 (noite). Vitório: "refaça aquela reunião de 5 hrs... pesada... tensa... abrindo dados no detalhe...
// CEO, diretores, gerentes, supervisores, uns 20 vendedores e um representante de cada indústria... passado, presente, futuro,
// oportunidades e tudo mais... o Jota conseguiria dar suporte a TODOS os temas? sem exceção? em todos os casos? todos os players?"
// Cada tema: quem pergunta (papéis), modelos e "espera" (o que a resposta TEM que trazer). "honesto" = resposta aceita quando o dado
// não existe na base, desde que o Jota diga isso claramente (nunca inventar).
// Marcadores: {filial} {vendedor} {rca} {supervisor} {produto} {industria} {industria_rv} {cliente}
// =========================================================================
const H = /não tenho|sem dado|ainda não|não está na base|não consigo|não projeto|não faço projeção/i;
export const TEMAS = [
  // ---------- PASSADO ----------
  { tema: 'Passado · mês passado', papeis: ['ceo', 'diretor', 'gerente', 'supervisor', 'vendedor'], espera: /setembro|mês passado|×/i, modelos: ['como estamos em relação ao mês passado?', 'comparado com setembro estamos melhor ou pior?', 'quanto vendemos em setembro até o mesmo dia?', 'o que caiu em relação ao mês passado?'] },
  { tema: 'Passado · vendedor x mês passado', papeis: ['ceo', 'diretor', 'gerente', 'supervisor'], espera: /setembro|×/i, modelos: ['o vendedor {vendedor} {rca} está melhor ou pior que o mês passado?', 'compare o {vendedor} {rca} com setembro'] },
  { tema: 'Passado · indústria/produto mês a mês', papeis: ['ceo', 'diretor', 'industria'], espera: /Mês a mês|×|setembro/i, modelos: ['vendas mensais de {produto} na {filial}', 'como está {industria} mês a mês na {filial}?', '{industria} caiu em relação ao mês passado?'] },
  { tema: 'Passado · ontem', papeis: ['diretor', 'gerente', 'supervisor'], espera: /ontem|Relatório|fechou/i, modelos: ['como fechou ontem?', 'qual produto mais vendeu ontem?', 'me manda o relatório das 18:30'] },
  { tema: 'Passado · ano/histórico longo', papeis: ['ceo', 'diretor'], espera: H, honesto: true, modelos: ['qual foi o melhor mês do ano?', 'como foi o primeiro semestre?', 'compare outubro com outubro do ano passado'] },
  // ---------- PRESENTE ----------
  { tema: 'Presente · resumo', papeis: ['ceo', 'diretor', 'gerente'], espera: /Faturado/, modelos: ['como estamos?', 'como está a {filial}?', 'resumo do grupo'] },
  { tema: 'Presente · quanto falta / MN', papeis: ['ceo', 'diretor', 'gerente', 'supervisor'], espera: /por dia útil|MN|falta/i, modelos: ['quanto falta pra bater a meta?', 'qual o MN da {filial}?', 'quanto falta por dia útil?'] },
  { tema: 'Presente · supervisores', papeis: ['diretor', 'gerente'], espera: /supervisor|Equipe/i, modelos: ['por supervisor', 'qual supervisor está puxando pra baixo?', 'supervisor {supervisor}', 'ranking dos supervisores'] },
  { tema: 'Presente · vendedor no detalhe', papeis: ['diretor', 'gerente', 'supervisor'], espera: /{vendedor_curto}|{rca}/i, modelos: ['como está o vendedor {vendedor} {rca}?', 'quanto vendeu o {vendedor} {rca} hoje?', 'quais clientes o {vendedor} {rca} visitou e não vendeu?'] },
  { tema: 'Presente · rota e visitas', papeis: ['diretor', 'gerente', 'supervisor'], espera: /visita|rota|Rota/i, modelos: ['visitas de hoje', 'quem tem rota e não visitou ninguém?', 'quais clientes faltam visitar hoje?', 'eficácia da rota'] },
  { tema: 'Presente · zerados', papeis: ['diretor', 'gerente', 'supervisor'], espera: /[Zz]erad/, modelos: ['zerados', 'quem está zerado hoje?'] },
  { tema: 'Presente · positivação', papeis: ['ceo', 'diretor', 'gerente', 'supervisor'], espera: /[Pp]ositiva/, modelos: ['positivação', 'quem tá mal na positivação?', 'positivação por supervisor'] },
  { tema: 'Presente · liga/Champions', papeis: ['ceo', 'diretor', 'gerente', 'supervisor', 'vendedor'], espera: /Champions|Liga|pts/, modelos: ['liga', 'como estamos na Champions?', 'qual a posição do {vendedor} na liga?'] },
  { tema: 'Presente · lances (pênalti, impedimento)', papeis: ['diretor', 'gerente', 'supervisor'], espera: /[Ll]ances|[Ii]mpedimento|[Pp]ênalti/, modelos: ['pênaltis de hoje', 'impedimentos de hoje', 'quem fez check-in fora do cliente?'] },
  { tema: 'Presente · devolução/corte/bloqueio', papeis: ['ceo', 'diretor', 'gerente'], espera: /[Dd]evolu|[Cc]orte|[Bb]loque/, modelos: ['devoluções do mês por motivo', 'cortes de hoje', 'pedidos bloqueados'] },
  { tema: 'Presente · compromisso/RET', papeis: ['diretor', 'gerente'], espera: /[Cc]ompromisso|RET/, modelos: ['quem não fez RET hoje?', 'compromisso da {filial}', 'gestão de campo por filial'] },
  { tema: 'Presente · carteira/pendente', papeis: ['diretor', 'gerente'], espera: /[Pp]endente|carteira/i, modelos: ['quanto tem na carteira?', 'faturado mais carteira por filial'] },
  { tema: 'Presente · incentivo', papeis: ['diretor', 'gerente', 'supervisor', 'vendedor'], espera: /[Ii]ncentivo|110|G1|G2/, modelos: ['incentivo', 'quantos vão ganhar o incentivo?', 'quanto falta pro meu prêmio?'] },
  { tema: 'Presente · marca própria', papeis: ['ceo', 'diretor'], espera: /Marca|MARCAS/i, modelos: ['marca própria', 'quanto vendemos de marca própria no mês?'] },
  // ---------- INDÚSTRIA (representante de cada uma, via diretor) ----------
  { tema: 'Indústria · metas (Premiação RV)', papeis: ['ceo', 'diretor', 'industria', 'gerente'], espera: /Metas das indústrias|Nenhuma meta/, modelos: ['como está a meta da {industria_rv} no Brasil?', 'estamos batendo a meta da {industria_rv} na {filial}?', 'estamos batendo as metas das indústrias na {filial}?', 'metas das indústrias do vendedor {vendedor} {rca}'] },
  { tema: 'Indústria · dia da semana que mais vende', papeis: ['industria', 'diretor'], espera: /Dia da semana|melhor é/i, modelos: ['qual dia da semana mais vende {produto} na {filial}?', 'melhor dia para vender {produto} na {filial}'] },
  { tema: 'Indústria · vendedor específico', papeis: ['industria', 'diretor'], espera: /Por vendedor|vendedor/i, modelos: ['tem algum vendedor específico que vende mais {produto} na {filial}?', 'quem mais vende {produto} na {filial}?'] },
  { tema: 'Indústria · semana a semana', papeis: ['industria', 'diretor'], espera: /Semana a semana/i, modelos: ['vendas semanais de {produto} na {filial}', 'como estão as vendas semanais de {produto} na {filial}?'] },
  { tema: 'Indústria · positivação e recuperação', papeis: ['industria', 'diretor', 'gerente'], espera: /{industria}|parou|pararam|recupera/i, modelos: ['positivação de {industria} por filial', 'quem comprava {industria} e parou?', 'clientes que compraram {industria} na {filial}'] },
  { tema: 'Indústria · preço médio', papeis: ['industria'], espera: /preço|médio|R\$/i, modelos: ['qual o preço médio do {produto}?'] },
  { tema: 'Indústria · sell-out / estoque no PDV', papeis: ['industria'], espera: H, honesto: true, modelos: ['qual o sell-out do {produto} nos supermercados?', 'quanto tem de estoque de {produto} nos clientes?', 'qual a ruptura do {produto} no PDV?'] },
  { tema: 'Indústria · share / concorrente', papeis: ['industria', 'ceo'], espera: H, honesto: true, modelos: ['qual o nosso share de chocolate na região?', 'como estamos contra a concorrência?'] },
  // ---------- FUTURO ----------
  { tema: 'Futuro · projeção de fechamento', papeis: ['ceo', 'diretor', 'gerente'], espera: /por dia útil|MN|ritmo|não projeto|não faço projeção|precisa/i, modelos: ['vamos bater a meta?', 'qual a projeção de fechamento do mês?', 'quanto vamos fechar outubro?', 'previsão de faturamento'] },
  { tema: 'Futuro · plano / quem cobrar', papeis: ['ceo', 'diretor', 'gerente', 'supervisor'], espera: /Sugestão do Jota/, modelos: ['o que eu faço hoje?', 'quem cobrar amanhã?', 'plano do dia', 'como bater a meta de outubro?'] },
  // ---------- OPORTUNIDADES ----------
  { tema: 'Oportunidades · clientes parados', papeis: ['diretor', 'gerente', 'supervisor', 'vendedor'], espera: /sem comprar|dias|parou|curva/i, modelos: ['clientes curva A sem comprar há mais de 30 dias', 'quem está há 3 dias sem pedido?', 'meus clientes que não compraram no mês'] },
  { tema: 'Oportunidades · +MIX', papeis: ['diretor', 'gerente', 'supervisor', 'vendedor'], espera: /MIX|mix/, modelos: ['+mix', 'quem mais usa o +mix?', 'o que oferecer pro cliente {cliente}?'] },
  { tema: 'Oportunidades · onde perdemos venda', papeis: ['ceo', 'diretor', 'gerente'], espera: /Sugestão|caíram|cort|devolu|sem comprar|parou/i, modelos: ['onde estamos perdendo venda?', 'quais as oportunidades da {filial}?', 'qual indústria mais caiu?'] },
  { tema: 'Oportunidades · motivos de não venda (justificativas)', papeis: ['ceo', 'diretor', 'gerente', 'supervisor'], espera: /motivo|justificativ|SEM INTERESSE|ESTOQUE|AUSENTE/i, modelos: ['quais os motivos de não venda no mês?', 'por que os clientes não compram na {filial}?', 'justificativas do mês do {vendedor} {rca}', 'quais clientes o {vendedor} {rca} visitou e não vendeu?'] },
  // ---------- FINANCEIRO / ESTRATÉGIA (CEO) ----------
  { tema: 'CEO · margem e rentabilidade', papeis: ['ceo'], espera: H, honesto: true, modelos: ['qual filial dá mais lucro?', 'qual a margem por indústria?', 'rentabilidade do vendedor {vendedor}'] },
  { tema: 'CEO · Premiação RV individual (holerite)', papeis: ['ceo', 'diretor', 'vendedor'], espera: /Metas das indústrias|Premia|RV|Incentivo|incentivo/i, modelos: ['quanto o {vendedor} {rca} vai ganhar de RV?', 'premiação do vendedor {vendedor} {rca}', 'quanto vou ganhar de premiação?'] },
  // ---------- VENDEDOR (o próprio) ----------
  { tema: 'Vendedor · eu mesmo', papeis: ['vendedor'], espera: /R\$|%|cliente|Liga|Metas|rota/i, modelos: ['como estou?', 'quanto falta pra minha meta?', 'quais clientes faltam visitar hoje?', 'minhas metas das indústrias', 'qual meu ranking?', 'o que eu vendi de {produto} no mês?'] },
];
export const INDUSTRIAS_RV = ['Mondelez', 'Colgate', 'Mars Pet', 'Mars Choc', 'Ferrero', 'Arcor', 'Heinz', 'Leão', 'Marilan', 'Ab Mauri', 'Cera Ingleza', 'Química Amparo', 'Condor', 'SC Johnson'];
