# Parecer do analista sênior de vendas externo — 11/11/2026

> Revisão independente (agente sem participação na construção) das respostas reais do Jota em auditoria/ (vendedores Tamara TCV 352 e Giovana TBL 181; supervisores Victor Hugo TSJ, Sérgio TBL, Cristiano TSJ-AS; gerentes Marcos ABC e Vagner TPH; diretoria/painel das indústrias; cascata TCV).
> Ressalva do próprio analista: os momentos foram gerados forçados fora do horário; várias pastas são de 10/11 (antes de correções de 11/11).

## Notas
| Público | Nota |
|---|---|
| Vendedor | 6,0 |
| Supervisor | 5,5 |
| Gerente | 4,0 |
| Diretoria | 6,5 |

## Os 10 problemas, em ordem de impacto (resumo)
1. Números de **hoje** (vendido, pedidos, visitas, "com venda") diferentes entre telas e níveis (Tamara 1 x 4 x 9; Allison R$ 7.246 no gerente x R$ 202.147 ao abrir; TCV gerente x diretoria).
2. Cascata do gerente terminava em `null` no vendedor — **corrigido em 11/11 15h** (código da lista abre o vendedor; código fora da lista = mensagem).
3. Três **positivações** e várias **últimas compras** para o mesmo vendedor/cliente (CEVEN 13/99 x roteiro 46/133; datas diferentes por tela).
4. "Faturamento" mistura faturado e a faturar no plano do vendedor; listas de pendentes/bloqueados escondem pedidos ("em conferência ficam de fora").
5. Horizonte da meta: indústrias até o dia 20, vendedor até o fim do mês, **feriado 20/11 não descontado**, AS sem ritmo de faseamento.
6. Clientes de foco: escolhe o mais difícil (mais dias sem compra), produto oferecido não conversa com a TAG, e o "foco 0 de 45" precisa ser validado antes de virar KPI.
7. Exceções enterradas: "atenção" por R$ do dia (aponta "Supervisor 53" sem meta), mistura AS com varejo; rombos (Fabio Machado Mars TBL R$ -11.467 de R$ 680 mil) só no fim das listas.
8. Recorrência com duas metas na mesma tela (GEROT 72 x TAG 54) e arredondamento diferente.
9. Menu promete RV (pedido nº 1) e não entrega; itens repetidos (3/13/16); lances com códigos crus.
10. Nomes diferentes para o mesmo código, placeholders ("Vago", "531 - 531", "Supervisor 53"), clientes duplicados, etiquetas técnicas 〔...〕 visíveis; auditoria em cascata cobria pouco.

## Próximas 5 ações recomendadas
1. Função única do **hoje** para todas as telas (e só o plano no ar até passar no teste).
2. Um nome e um número por indicador (faturado / a faturar / bloqueado; uma positivação; uma última compra; uma meta de recorrência).
3. Calendário: descontar 20/11, ritmo até o dia 20 nas indústrias, faseamento no AS.
4. Refazer a regra do foco (recompra mais provável, produto da própria TAG) e validar o 0/45 à mão.
5. Bloco de exceções por R$ em risco no gerente e na diretoria; separar AS de varejo; eliminar placeholders; auditoria em cascata nas 11 filiais como trava antes de publicar.
