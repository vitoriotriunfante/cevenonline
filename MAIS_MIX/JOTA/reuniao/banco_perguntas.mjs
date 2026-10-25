// =========================================================================
// BANCO DE PERGUNTAS DO JOTA — saído da reunião de 5 h (ATA_REUNIAO_5H_2026-10-25.md)
// Cada item: n (nº da necessidade na ata), cargo que pergunta, intencao, modelos (jeitos de perguntar) e "espera":
//   regex que a RESPOSTA tem que conter para contar como acerto (não basta responder qualquer coisa).
// Marcadores: {filial} {vendedor} {rca} {supervisor} {produto} {industria} {periodo} — preenchidos com nomes reais pelo gerador.
// =========================================================================
export const BANCO = [
  // BLOCO 1 — grupo e filiais
  { n: 1, cargo: 'diretoria', intencao: 'resumo', espera: /Faturado/, modelos: ['como estamos?', 'como está o grupo hoje?', 'como esta {filial}?', 'resumo de {filial}', 'status da {filial}', 'panorama geral', 'como vai a {filial} hoje', 'situação da {filial}'] },
  { n: 2, cargo: 'diretoria', intencao: 'falta_mn', espera: /por dia útil|MN/, modelos: ['quanto falta pra bater a meta?', 'quanto falta por dia útil em {filial}?', 'qual o MN da {filial}?', 'quanto preciso vender por dia pra bater a meta', 'falta quanto pra meta de {filial}', 'quanto % falta para a meta?'] },
  { n: 3, cargo: 'diretoria', intencao: 'ranking_filiais', espera: /TPH|ABC|API|TBL/, modelos: ['ranking das filiais', 'qual filial está pior?', 'ranking das filiais do grupo triunfante', 'filiais por % da meta', 'qual a melhor filial do mês?'] },
  { n: 4, cargo: 'diretoria', intencao: 'faturado_mais_carteira', espera: /pend|carteira/i, modelos: ['ranking das filiais somando faturamento + carteira', 'somando faturado e carteira quanto falta pra meta em {filial}?', 'qual o volume financeiro total somando faturado e carteira', 'quanto cada supervisor tem entre faturado e carteira?', 'faturado mais o que temos a faturar, quanto falta?'] },
  { n: 5, cargo: 'gerente', intencao: 'pendente', espera: /[Pp]endente|carteira/, modelos: ['quanto tenho em carteira?', 'qual o pendente da {filial}?', 'qual a evolução da carteira', 'quanto temos a faturar?'] },
  { n: 6, cargo: 'diretoria', intencao: 'devolucao_motivo', espera: /[Dd]evolu/, modelos: ['devoluções do mês por motivo', 'quais os motivos de devolução?', 'devolução da {filial}', 'quanto devolveu {filial} no mês?', 'devolução comercial ou logística?'] },
  { n: 7, cargo: 'diretoria', intencao: 'corte', espera: /[Cc]orte/, modelos: ['cortes de hoje', 'quanto foi cortado hoje na {filial}?', 'cortes por filial', 'o que está cortando?'] },
  { n: 8, cargo: 'diretoria', intencao: 'industria_faturado', espera: /{industria}/i, modelos: ['quanto vendemos de {industria} no mês?', 'faturado de {industria} por filial', 'como está {industria} na {filial}?', 'venda da {industria} este mês'] },
  { n: 9, cargo: 'gerente', intencao: 'industria_positivacao', espera: /{industria}/i, modelos: ['como está a positivação de {industria} por carteira', 'quantos clientes compraram {industria} no mês?', 'positivação de {industria} na {filial}', 'positivação {industria} por vendedor'] },
  { n: 10, cargo: 'diretoria', intencao: 'positivacao', espera: /[Pp]ositiva/, modelos: ['positivação', 'como está a positivação?', 'quantos clientes positivamos no mês em {filial}?', 'falta quantos clientes pra meta de positivação?', 'positivação por filial'] },
  { n: 11, cargo: 'diretoria', intencao: 'comparacao_m1', espera: /mês passado|M-1|sem dado|não tenho/i, modelos: ['comparado com o mês passado como estamos?', 'estamos melhor que setembro?', 'qual filial caiu em relação ao mês passado?'] },
  { n: 12, cargo: 'diretoria', intencao: 'ritmo', espera: /dias úteis|ritmo|%/, modelos: ['estamos no ritmo da meta?', 'qual o ritmo da {filial}?', 'vamos bater a meta no ritmo atual?'] },
  // BLOCO 2 — filial por supervisor e vendedor
  { n: 13, cargo: 'gerente', intencao: 'por_supervisor', espera: /supervisor/i, modelos: ['abre por supervisor', 'por supervisor', '{filial} por supervisor', 'como estão meus supervisores?', 'resultado por equipe'] },
  { n: 14, cargo: 'gerente', intencao: 'pior_supervisor', espera: /supervisor|Sugestão/i, modelos: ['qual meu pior supervisor?', 'quem é o supervisor mais atrás?', 'qual supervisor mais vendeu hoje', 'melhor supervisor do mês'] },
  { n: 15, cargo: 'gerente', intencao: 'supervisor', espera: /{supervisor_curto}/i, modelos: ['supervisor {supervisor}', 'traz os resultados do supervisor {supervisor}', 'como está a equipe do {supervisor}?', 'ranking supervisor {supervisor}', 'vendedores do {supervisor}'] },
  { n: 16, cargo: 'diretoria', intencao: 'dias_sem_pedido', espera: /dias|sem dado|não tenho/i, modelos: ['quem está há 3 dias sem vender?', 'vendedores sem pedido há mais de 2 dias', 'quantos dias o {vendedor} está sem pedido?'] },
  { n: 17, cargo: 'gerente', intencao: 'sem_visita', espera: /visita/i, modelos: ['quem tem rota e não visitou ninguém?', 'visitas de hoje', 'eficácia da rota', 'quantas visitas foram feitas hoje?', 'eficiência da rota em {filial}'] },
  { n: 18, cargo: 'supervisor', intencao: 'faltam_visitar', espera: /faltam|Rota de hoje|sem rota/i, modelos: ['quais clientes ainda faltam visitar hoje?', 'clientes na rota de hoje', 'quem falta visitar do {vendedor}?', 'clientes em aberto na rota'] },
  { n: 19, cargo: 'gerente', intencao: 'bloqueados', espera: /[Bb]loque/, modelos: ['pedidos bloqueados de hoje', 'quanto está bloqueado na {filial}?', 'pedidos retidos no crédito', 'lista dos bloqueados'] },
  { n: 20, cargo: 'gerente', intencao: 'aguardando_winthor', espera: /WinThor|aguardando|parad/i, modelos: ['quais pedidos estão parados no winthor', 'pedidos aguardando winthor', 'tem pedido travado no winthor?'] },
  { n: 21, cargo: 'diretoria', intencao: 'ranking_supervisores_brasil', espera: /supervisor/i, modelos: ['ranking dos supervisores do grupo', 'melhores supervisores do Brasil', 'supervisores por % da meta'] },
  { n: 22, cargo: 'diretoria', intencao: 'ranking_gerentes', espera: /gerente|Vagner|Fabio|Marcelo/i, modelos: ['como está o ranking dos gerentes?', 'ranking de gerentes', 'qual gerente está melhor?'] },
  { n: 23, cargo: 'diretoria', intencao: 'comparar_filiais', espera: /×|TPH|ABC|API|TBL|TBE|TCV|TSJ|TCA|TPA|MCD|TCG/, modelos: ['compara {filial} com TPH', '{filial} x API', 'TBL versus TBE'] },
  // BLOCO 3 — supervisor e vendedor
  { n: 24, cargo: 'supervisor', intencao: 'hoje_por_vendedor', espera: /[Hh]oje|Digitado/, modelos: ['hoje', 'acumulado de hoje', 'acumulado de hoje dos vendedores de rota', 'quanto vendeu hoje cada vendedor', 'pedidos de hoje', 'digitado hoje'] },
  { n: 25, cargo: 'vendedor', intencao: 'cliente', espera: /cliente|sem dado|não/i, modelos: ['o que o cliente {cliente} comprou?', 'último pedido do cliente {cliente}', 'quanto tempo o {cliente} está sem comprar?', 'o que oferecer pro {cliente}?'] },
  { n: 26, cargo: 'supervisor', intencao: 'visitou_nao_vendeu', espera: /Visitou e não vendeu|rota|sem rota/i, modelos: ['quais clientes a {vendedor} visitou e não vendeu?', 'justificativas do {vendedor} hoje', 'quais clientes ela visitou e não vendeu? quais as justificativas'] },
  { n: 27, cargo: 'diretoria', intencao: 'produto_vendedor_periodo', espera: /{produto_curto}/i, modelos: ['quais os clientes que mais compraram {produto} {periodo} da vendedora {vendedor} {rca}', 'quem comprou {produto} {periodo} do {vendedor}?', 'clientes do {vendedor} que compraram {produto}'] },
  { n: 28, cargo: 'gerente', intencao: 'top_clientes_produto', espera: /{produto_curto}/i, modelos: ['quem são os 10 clientes que mais compraram {produto} no mês na {filial}', 'quem compra {produto}?', 'quem mais vende {produto}?', 'top clientes de {produto}'] },
  { n: 29, cargo: 'vendedor', intencao: 'incentivo', espera: /[Ii]ncentivo|G1|G2|110/, modelos: ['incentivo', 'quanto falta pro meu prêmio?', 'bati o gatilho?', 'quem já bateu 110%?', 'incentivo do {vendedor}', 'quanto falta pro premio'] },
  { n: 30, cargo: 'supervisor', intencao: 'impedimentos', espera: /[Ii]mpedimento|[Ll]ances/, modelos: ['impedimentos de hoje', 'quem fez check-in fora do cliente?', 'visitas de 00:00 hoje', 'pênaltis de hoje', 'cartões de hoje'] },
  { n: 31, cargo: 'gerente', intencao: 'maior_gap', espera: /falta|gap|R\$/i, modelos: ['qual vendedor com maior gap', 'quem está mais longe da meta?', 'maior buraco da {filial}'] },
  { n: 32, cargo: 'vendedor', intencao: 'mix', espera: /MIX|mix/, modelos: ['qual meu mix atual', '+mix', 'mais mix', 'quem usa o +mix?', 'mix por cliente da {filial}', 'quais vendedores de {filial} utilizaram o mais mix no ceven?'] },
  { n: 33, cargo: 'supervisor', intencao: 'dobradinha', espera: /[Dd]obradinha|quinzena|sem dado|não tenho/i, modelos: ['dobradinha por vendedor', 'clientes que compraram nas duas quinzenas', 'quem fez dobradinha?'] },
  { n: 34, cargo: 'supervisor', intencao: 'itens_hoje_vendedor', espera: /item|produto|ontem|sem dado|não tenho/i, modelos: ['o que o {vendedor} vendeu hoje item a item?', 'produtos vendidos hoje pelo {vendedor}'] },
  { n: 35, cargo: 'gerente', intencao: 'ticket', espera: /[Tt]icket/, modelos: ['qual o ticket médio de hoje?', 'ticket médio da {filial}', 'ticket do {vendedor}'] },
  { n: 35.1, cargo: 'diretoria', intencao: 'vendedor', espera: /{vendedor_curto}/i, modelos: ['como está o vendedor {vendedor}?', 'me passa mais detalhes do vendedor {vendedor}', 'vendedor {vendedor}', 'quanto vendeu o {vendedor} hoje?', 'detalhe a rota do mês do {vendedor}'] },
  { n: 35.2, cargo: 'diretoria', intencao: 'zerados', espera: /[Zz]erad/, modelos: ['zerados', 'quem está zerado?', 'quantos vendedores zeraram hoje?', 'quais vendedores zerados hoje em {filial}?', 'quais os zerados do {supervisor}?'] },
  { n: 35.3, cargo: 'diretoria', intencao: 'liga', espera: /Champions|Liga|pts/, modelos: ['liga', 'como estamos na liga?', 'em que posição a filial está no ranking atual?', 'qual a posição do {vendedor} na liga?', 'quantos pontos o {vendedor} tem na champions?', 'ranking dos vencedores do AS'] },
  { n: 35.4, cargo: 'gerente', intencao: 'pontos_penalizados', espera: /pênalti|penalti|pontos|[Ll]ances/i, modelos: ['quantos pontos fomos penalizados?', 'quantos pênaltis a {filial} tomou hoje?'] },
  { n: 35.5, cargo: 'diretoria', intencao: 'compromisso', espera: /[Cc]ompromisso|RET/, modelos: ['quem não fez RET hoje?', 'quantos supervisores não fizeram o compromisso?', 'compromisso da {filial}', 'quantos vendedores atingiram o compromisso alinhado na matinal?', 'gestão de campo por filial', 'compromisso da semana'] },
  { n: 35.6, cargo: 'diretoria', intencao: 'piores_positivacao', espera: /[Pp]ositiva/, modelos: ['liste os 10 piores vendedores em positivação', 'quem tá mal na positivação?', 'top 10 positivação'] },
  { n: 35.7, cargo: 'diretoria', intencao: 'ranking_vendedores', espera: /ranking|Melhores|Meta batida/i, modelos: ['ranking', 'top 10 hoje', 'melhores vendedores do mês', 'quais vendedores já bateram meta', 'quais vendedores de {filial} atingiram a meta de hoje?'] },
  // BLOCO 4 — indústria e promotor
  { n: 36, cargo: 'industria', intencao: 'industria_positivacao_vendedor', espera: /{industria}/i, modelos: ['quantos PDVs compraram {industria} no mês por vendedor?', 'positivação numérica de {industria} na {filial}', 'clientes {industria} por supervisor'] },
  { n: 37, cargo: 'industria', intencao: 'sku_positivacao', espera: /{produto_curto}/i, modelos: ['quantos clientes compraram {produto} no mês?', 'positivação do {produto} por filial', '{produto} em quantos clientes?'] },
  { n: 38, cargo: 'industria', intencao: 'recuperacao_industria', espera: /parar|pararam|recupera|{industria}/i, modelos: ['quem comprava {industria} e parou?', 'clientes que deixaram de comprar {industria}', 'lista de recuperação de {industria}'] },
  { n: 39, cargo: 'promotor', intencao: 'itens_loja', espera: /cliente|produto|sem dado|não/i, modelos: ['o que a loja {cliente} comprou na última semana?', 'produtos do cliente {cliente} no mês'] },
  { n: 40, cargo: 'industria', intencao: 'campanha_tag', espera: /tag|campanha|RECORR|sem dado|não tenho/i, modelos: ['quantos clientes com a tag FALTA FOCO MARS foram positivados?', 'campanha COMBO quantos compraram?', 'clientes da tag recorrência positivados', 'recorrência', 'reativados hoje'] },
  { n: 41, cargo: 'diretoria', intencao: 'marca_propria', espera: /Marca|MARCAS/i, modelos: ['marca própria', 'quanto vendemos de marca própria no mês?', 'como fechou marca própria ontem?', 'zipoca na {filial}'] },
  { n: 42, cargo: 'promotor', intencao: 'devolucao_avaria', espera: /[Dd]evolu/, modelos: ['devolução por avaria', 'devoluções por vencimento próximo', 'devoluções entradas hoje'] },
  { n: 43, cargo: 'industria', intencao: 'preco_medio', espera: /preço|médio|R\$/i, modelos: ['qual o preço médio do {produto}?', 'quanto saiu o {produto} em média?'] },
  { n: 44, cargo: 'gerente', intencao: 'produtos_mais_vendidos', espera: /produto|R\$/i, modelos: ['produtos mais vendidos da {filial} no mês', 'top 10 produtos do mês', 'qual produto mais vendeu ontem?'] },
  { n: 45, cargo: 'industria', intencao: 'queda_industria_m1', espera: /mês passado|M-1|sem dado|não tenho/i, modelos: ['qual indústria mais caiu em relação ao mês passado?', '{industria} caiu?'] },
  // BLOCO 5 — plano e cobrança
  { n: 46, cargo: 'diretoria', intencao: 'plano_do_dia', espera: /Sugestão do Jota/, modelos: ['o que eu faço hoje em {filial}?', 'como bater a meta de outubro?', 'quem cobrar hoje?', 'plano do dia'] },
  { n: 47, cargo: 'diretoria', intencao: 'relatorio', espera: /Relatório|relatório/, modelos: ['me manda o relatório das 18:30', 'boletim das 17h', 'relatório das 11:30', 'como fechou ontem?', 'quais horários das atualizações?'] },
  { n: 48, cargo: 'gerente', intencao: 'info_equipe', espera: /Gestão|registr|anot|pedido/i, modelos: ['{vendedor} está de atestado', '{vendedor} foi demitido, desconsidere', '{vendedor} está de férias'] },
  { n: 49, cargo: 'vendedor', intencao: 'portugues_ruim', espera: /./, modelos: ['qto falta pro meu premio', 'meus cliente que nao compro', 'cm ta a filial', 'zerado hj?', 'quem n visitou'] },
  { n: 50, cargo: 'diretoria', intencao: 'ajuda', espera: /Jota|pergunt/i, modelos: ['oi', 'ajuda', 'o que você sabe fazer?', 'menu', 'bom dia'] },
  { n: 50.1, cargo: 'diretoria', intencao: 'glossario', espera: /=/, modelos: ['o que é positivação?', 'o que é eficácia', 'o que é MN?', 'como funciona o impedimento?', 'o que é recorrência?'] },
];
export const PERIODOS = ['ontem', 'hoje', 'no mês', 'essa semana', 'esse mês'];
export const INDUSTRIAS = ['Mondelez', 'Mars', 'Arcor', 'Bagley', 'Condor', 'Ferrero', 'Nestle', 'Hershey', 'Fini', 'Dori'];
// variações de escrita (o pessoal escreve rápido, sem acento, abreviado)
export const ESTILOS = [
  (s) => s,
  (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, ''),
  (s) => s.toUpperCase(),
  (s) => s.replace(/\bvocê\b/g, 'vc').replace(/\bquanto\b/g, 'qto').replace(/\bpara\b|\bpra\b/g, 'p/').replace(/\bhoje\b/g, 'hj').replace(/\bnão\b/g, 'n'),
  (s) => 'Jota, ' + s,
  (s) => s.replace(/\?$/, '') + ' por favor',
  (s) => 'Pico pico, ' + s,
];
