# Cobertura do JOTA no banco da reunião — 25/10/2026, 15:28:42

**12.000 perguntas** · acerto **82,7%** · resposta errada 16,3% · sem resposta pronta (cai na IA) 1,0% · erro 0

| # | Necessidade | Cargo | Perguntas | Acerto | Errada | Sem resposta | Exemplo de falha |
|---|---|---|---|---|---|---|---|
| 1 | resumo | diretoria | 448 | 100,0% | 0,0% | 0,0% |  |
| 2 | falta_mn | diretoria | 336 | 100,0% | 0,0% | 0,0% |  |
| 3 | ranking_filiais | diretoria | 280 | 100,0% | 0,0% | 0,0% |  |
| 4 | faturado_mais_carteira | diretoria | 280 | 100,0% | 0,0% | 0,0% |  |
| 5 | pendente | gerente | 224 | 100,0% | 0,0% | 0,0% |  |
| 6 | devolucao_motivo | diretoria | 280 | 100,0% | 0,0% | 0,0% |  |
| 7 | corte | diretoria | 224 | 75,0% | 0,0% | 25,0% | `o que está cortando?` → sem_resposta |
| 8 | industria_faturado | diretoria | 224 | 0,0% | 100,0% | 0,0% | `quanto vendemos de Ferrero no mês?` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 9 | industria_positivacao | gerente | 224 | 0,0% | 100,0% | 0,0% | `como está a positivação de Fini por carteira` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 10 | positivacao | diretoria | 280 | 100,0% | 0,0% | 0,0% |  |
| 11 | comparacao_m1 | diretoria | 168 | 100,0% | 0,0% | 0,0% |  |
| 12 | ritmo | diretoria | 168 | 100,0% | 0,0% | 0,0% |  |
| 13 | por_supervisor | gerente | 280 | 100,0% | 0,0% | 0,0% |  |
| 14 | pior_supervisor | gerente | 224 | 100,0% | 0,0% | 0,0% |  |
| 15 | supervisor | gerente | 280 | 92,5% | 3,2% | 4,3% | `vendedores do Sem Supervisor` → errada: 👥 *API por supervisor* (% da meta faturada) |
| 16 | dias_sem_pedido | diretoria | 168 | 98,2% | 1,8% | 0,0% | `quantos dias o Venda Industrias esta sem pedido?` → errada: ✅ *Zerados hoje — Equipe Sem Supervisor: 0.* Nenhum vendedor do varejo com rota está sem pedido agora. |
| 17 | sem_visita | gerente | 280 | 100,0% | 0,0% | 0,0% |  |
| 18 | faltam_visitar | supervisor | 224 | 100,0% | 0,0% | 0,0% |  |
| 19 | bloqueados | gerente | 224 | 100,0% | 0,0% | 0,0% |  |
| 20 | aguardando_winthor | gerente | 168 | 0,0% | 100,0% | 0,0% | `quais pedidos estão parados no winthor` → errada: 📝 *API hoje* (11:34) |
| 21 | ranking_supervisores_brasil | diretoria | 168 | 100,0% | 0,0% | 0,0% |  |
| 22 | ranking_gerentes | diretoria | 168 | 100,0% | 0,0% | 0,0% |  |
| 23 | comparar_filiais | diretoria | 168 | 100,0% | 0,0% | 0,0% |  |
| 24 | hoje_por_vendedor | supervisor | 336 | 100,0% | 0,0% | 0,0% |  |
| 25 | cliente | vendedor | 224 | 79,9% | 0,4% | 19,6% | `o que oferecer pro Aviario Fenix?` → sem_resposta |
| 26 | visitou_nao_vendeu | supervisor | 168 | 100,0% | 0,0% | 0,0% |  |
| 27 | produto_vendedor_periodo | diretoria | 168 | 3,0% | 97,0% | 0,0% | `quais os clientes que mais compraram Oreo Mini Original ontem da vendedora Otavio Borges 484` → errada: Otavio Borges Possamai (TCG) não tem clientes na rota de hoje (fim de semana: sem rota). |
| 28 | top_clientes_produto | gerente | 224 | 4,0% | 96,0% | 0,0% | `quem são os 10 clientes que mais compraram Sab Palm Hidrata Saudavel Aloe no mês na API` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 29 | incentivo | vendedor | 336 | 99,7% | 0,3% | 0,0% | `incentivo do Loja Mondelez` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 30 | impedimentos | supervisor | 280 | 100,0% | 0,0% | 0,0% |  |
| 31 | maior_gap | gerente | 168 | 100,0% | 0,0% | 0,0% |  |
| 32 | mix | vendedor | 336 | 100,0% | 0,0% | 0,0% |  |
| 33 | dobradinha | supervisor | 168 | 100,0% | 0,0% | 0,0% |  |
| 34 | itens_hoje_vendedor | supervisor | 112 | 100,0% | 0,0% | 0,0% |  |
| 35 | ticket | gerente | 168 | 99,4% | 0,6% | 0,0% | `TICKET DO ARILDO ZAGO` → errada: 👤 *Arildo Zago* (API) — 42,7% da meta · fat. R$ 572.414 · pend. R$ 39.945 |
| 35.1 | vendedor | diretoria | 280 | 98,6% | 1,4% | 0,0% | `como está o vendedor Pj Adalberto por favor` → errada: 📊 *Brasil — 11 filiais* (11:34) |
| 35.2 | zerados | diretoria | 280 | 100,0% | 0,0% | 0,0% |  |
| 35.3 | liga | diretoria | 336 | 99,7% | 0,3% | 0,0% | `qual a posição do Loja Mondelez na liga por favor` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 35.4 | pontos_penalizados | gerente | 112 | 100,0% | 0,0% | 0,0% |  |
| 35.5 | compromisso | diretoria | 336 | 83,3% | 16,7% | 0,0% | `compromisso da semana` → errada: Não consegui ler a semana dos supervisores agora. |
| 35.6 | piores_positivacao | diretoria | 168 | 100,0% | 0,0% | 0,0% |  |
| 35.7 | ranking_vendedores | diretoria | 280 | 100,0% | 0,0% | 0,0% |  |
| 36 | industria_positivacao_vendedor | industria | 168 | 0,0% | 100,0% | 0,0% | `quantos PDVs compraram Arcor no mês por vendedor?` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 37 | sku_positivacao | industria | 168 | 3,0% | 97,0% | 0,0% | `quantos clientes compraram Bisc Bonobon Biscuit Original no mês?` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 38 | recuperacao_industria | industria | 168 | 0,0% | 100,0% | 0,0% | `quem comprava Fini e parou?` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 39 | itens_loja | promotor | 112 | 100,0% | 0,0% | 0,0% |  |
| 40 | campanha_tag | industria | 280 | 100,0% | 0,0% | 0,0% |  |
| 41 | marca_propria | diretoria | 224 | 75,0% | 25,0% | 0,0% | `zipoca na API` → errada: 📄 *Relatório das 14:30 (parcial da tarde)* — 22/10/2026 |
| 42 | devolucao_avaria | promotor | 168 | 100,0% | 0,0% | 0,0% |  |
| 43 | preco_medio | industria | 112 | 0,0% | 92,9% | 7,1% | `qual o preço médio do Tortug Leite?` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 44 | produtos_mais_vendidos | gerente | 168 | 0,0% | 100,0% | 0,0% | `produtos mais vendidos da API no mês` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 45 | queda_industria_m1 | industria | 112 | 50,0% | 50,0% | 0,0% | `Arcor caiu?` → errada: 📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta |
| 46 | plano_do_dia | diretoria | 224 | 100,0% | 0,0% | 0,0% |  |
| 47 | relatorio | diretoria | 128 | 100,0% | 0,0% | 0,0% |  |
