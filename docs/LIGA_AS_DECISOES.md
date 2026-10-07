# Liga AS (Autosserviço) — decisões do Vitório e do Diretor (07/10/2026)

**Status:** em definição. Nada disso vale ainda. Plano: Liga AS em tabela separada do Varejo, **modo sombra** (calcula, não vale pontos) e valendo de verdade a partir de **01/11/2026**. Marca própria no Varejo entra como nova versão do regulamento, com data combinada e aviso aos gerentes (sugestão: segunda 13/10).

**Escopo:** 126 vendedores AS visíveis, 11 filiais, 33 supervisores. Acompanhamento SEPARADO para supervisor e para vendedor. Jogadas computadas por SEMANA (o AS visita num dia e põe pedido em outro).

## Decidido
- **Faseamento (meta do mês acumulada):** 1ª semana 20% · 2ª semana 40% · 3ª semana 60% · 4ª semana 110%. **A 3ª semana termina no dia 20.** (Fim das semanas: 1ª e 2ª a confirmar; suposição: 1–7, 8–14, 15–20, 21–fim.)
- **Bater a meta até o dia 25:** +25 pontos.
- **Bônus de primeira quinzena:** bater a meta (100%) até o dia 15. É BÔNUS justamente por ser difícil.
- **Check-in AS:** não precisa ser no dia; objetivo = pelo menos 1 visita por cliente da carteira. Acima de 90% = +5 · acima de 95% = +10 · 100% = +20.
- **Venda sem check-in:** advertir com cartão amarelo (regra de ordem: check-in antes de vender).
- **Gol de SKUs:** no AS não é "dobrar" (clientes têm 100+ SKUs): 2 SKUs a mais que a média do cliente já é gol.
- **Gol qualificado por indústria:** também no AS.
- **Marca própria (AS e Varejo):** ganha ESTRELA bônus e um gol diferente que passa na frente de tudo e mostra TODOS os lances.
- **Punitivo:** nenhum pedido até dia 05 = −5 · até dia 10 = −10 · até dia 20 = −20.
- **Devolução:** igual ao Varejo.

## Em aberto
- Pontos de cada fase do faseamento; semanas 1 e 2 (datas de fim).
- Pontos do bônus de primeira quinzena.
- Fonte do check-in (carteira e visitas por cliente no CEVEN) e pontos do amarelo; "check-in antes de vender" = no mesmo dia ou qualquer check-in anterior no mês.
- Pontos do gol de SKUs (simular antes de fixar).
- Marca própria: valor mínimo no pedido, pontos da estrela, regras de exibição.
- Punitivo: os descontos se somam (−35) ou vale só o maior?
- Regras do supervisor AS (proposta: faseamento da equipe somado + check-in da carteira da equipe).

## Atualização 07/10/2026 (respostas do Vitório) e primeira entrega
- Calendário confirmado: semana 1 = dias 1–7, 2 = 8–14, 3 = 15–**20**, 4 = 21–fim do mês.
- **Pontos do faseamento:** 10 / 20 / 30 / 40 (semanas 1 a 4). **Bônus de primeira quinzena (100% até o dia 15): +50.** Bônus "bateu a meta até o dia 25": +25.
- **Entregue em modo sombra:** `functions/_lib/liga_as.js` (regras), `/api/liga-as` (vendedores e supervisores, separados) e a página `/liga-as`. % da meta = (faturado + pendente) / meta do mês, igual ao app do CEVEN. Semana só pontua depois que o dia de fechamento termina. Supervisor = equipe somada. Os bônus de 15 e de 25 SOMAM (suposição, confirmar).
- Ainda em aberto: check-in da carteira, amarelo de venda sem check-in, gol de SKUs, marca própria, punitivo por falta de pedido (itens da lista acima).

## 07/10/2026 (tarde) — Liga AS integrada ao Brasileirão (Vitório: "não tem nada de modo sombra")
- **Sem modo sombra e sem página separada:** a Liga AS é oficial desde 07/10/2026 e faz parte do Brasileirão. No topo há o seletor **🛒 Varejo | 🏬 AS**. Artilharia, Liga dos Supervisores, Lances, Gabarito e Regulamento mostram o canal escolhido; **Série A (filiais) e Campeonato de Gerências somam todos os vendedores**. `/liga-as` agora só redireciona.
- **Varejo** continua por DIA. **AS** é por SEMANA: Lances da Semana e Gabarito da Semana (semanas 1–7, 8–14, 15–20, 21–fim; só dias oficiais), Regulamento do AS.
- **Artilharia AS:** PG = lances da semana + faseamento (10/20/30/40) + bônus (+50 até o dia 15, +25 até o dia 25). **Supervisores AS:** faseamento + bônus da equipe somada; lances da equipe como informação.
- **Lances que NÃO valem no AS (até a regra própria):** amarelo das 10h e vermelho de abandono 10h/11h (rotina diária). Devolução vale igual. Gerador: `scratch/build_brasileirao_dataset.py` (campo `canal` em vendedores e supervisores, bloco `as`).
- **Ainda sem decisão:** como o AS entra nos pontos de Série A e Gerências (hoje as duas tabelas seguem somando os resultados diários de todos os vendedores, como antes).

## 07/10/2026 (tarde, 2) — AS joga por SEMANA com o MESMO racional do Varejo
- **A semana é o jogo.** Placar da semana = lances da semana + faseamento da semana (10/20/30/40) + bônus que caiu nela (+50 até dia 15; +25 até dia 25). Faixas iguais às do Varejo: mais de 10 = Vitória (3 pts de tabela) · 1 a 10 = Empate (1) · 0 ou menos = Derrota (0). **Supervisor AS** = maioria da equipe em Vitória na semana; faseamento/bônus da equipe desempatam.
- **NÃO valem no AS** (dependem de horário ou das visitas do dia): amarelo 10h, vermelho de abandono, Gol Relâmpago, Gol nos Acréscimos, Meta do 1º Tempo, Hat-Trick, Máquina de Conversão, Goleada. Saem do placar, dos Lances/Gabarito da Semana e da tabela do regulamento do AS.
- **Valem iguais ao Varejo:** Resgate de Inativo, Dobrou o Mix (até a regra de +2 SKUs), Dobradinha das Quinzenas, Defesa, Super Pedido (limite ainda a definir para o AS), Pedido Feito na Rota, devoluções, pênaltis, impedimento de GPS, Campeão da Rodada.

## 07/10/2026 (tarde, 3) — decisões sobre Super Pedido, Campeão e Mix no AS
- **Campeão da Rodada (+8): SAI do AS** (o bônus de 100% da meta já cumpre esse papel).
- **Dobrou o Mix: SAI do AS; fica só o gol de +2 SKUs** ("Gol de Mix (+2 SKUs)"): pedido com 2 ou mais SKUs a MAIS que a média histórica do cliente (e não 2×). Mesmo +4 e mesmo nível por indústrias do Dobrou o Mix até o Vitório definir outro valor. O coletor, as TVs e a Matriz passam `&canal=AS` ao `/api/tv-vendedor` para o vendedor AS.
- **Super Pedido no AS (aguardando escolha):** base nos dias 29/09 a 06/10 (dias úteis, só vendedor-dia com venda): AS P50 R$ 11.924 · P75 R$ 29.113 · P90 R$ 75.346 · P95 R$ 111.688. Varejo: P50 R$ 2.745 · P95 R$ 15.735 (os R$ 15.000 do Varejo = 5,8% dos vendedor-dias). No AS, R$ 15.000 seria 42% dos vendedor-dias; para a mesma raridade do Varejo (~6%) o corte do AS fica perto de R$ 100.000 no dia; R$ 75.000 daria ~10%.

## 07/10/2026 (tarde, 4) — canal vem do CEVEN; ocultos fora dos lances; Super Pedido do AS
- **O canal de cada vendedor é o do CEVEN (area_atuacao), não o da Gestão** (Vitório: "tem cara de AS como o próprio CEVEN do Luciano e o cara tá como varejo"). `canal_ceven` (cache 24 h, atualizada pelo `cron-arvore`) é aplicada por `aplicaArvore` sobre o canal da Gestão (`canal_gestao` guarda o antigo). 75 correções: 37 VJ→SUP (contas pessoais de supervisor, 13 delas visíveis), 8 VJ→GER, 13 VJ→PET VJ, 9 VJ→AS, 2 AS→VJ, 4 VJ→ESP, 2 VJ→PET AS. **Grupos de negócio (Vitório, 22/09/2026): Varejo = VJ + FARMA + PET VJ + ESP · AS = AS + PET AS · fora de ambos: SUP, GER, NULO.** O gerador exclui SUP/GER da liga.
- **Vendedor OCULTO na Gestão não gera nem mostra lance** (Luciano J Silva, TBL 198, afastado, aparecia em "cartões amarelos de hoje" por alerta calculado no navegador da Matriz): `brasileirao-lances` e `tv-lances` filtram (`functions/_lib/equipe_ocultos.js`), `tv-lances` recusa lance novo de oculto e a Matriz não calcula alerta de oculto. 88 lances do dia 06/10 e 6 de 07/10 eram de ocultos (não valiam no ranking, mas apareciam nas listas e no gabarito).
- **Super Pedido do AS = R$ 75.000 no dia** (Varejo continua R$ 15.000). A prova do lance traz o mínimo; a auditoria confere.

## 07/10/2026 (tarde, 5) — Gol de Marca Própria (pedido do Vitório desde 05/10; implementado com padrões, ajustáveis)
- **Regra (padrões escolhidos por mim, o Vitório pode trocar):** pedido do cliente no dia com **R$ 50 ou mais de Marca Própria Triunfante**; **+8 pontos** (acima de qualquer outro gol; Campeão e Goleada eram +8/+7); qualificado (bronze a platina) pelas indústrias do pedido; ⭐ no popup; **sai sempre, um a um, na frente de tudo, sem esperar intervalo e nunca dentro de resumo**. Vale no Varejo e no AS. **Começa em 08/10/2026** (versão de regras 2026-10-08.1) para não mudar o dia de hoje.
- **Base do valor mínimo:** nos pedidos qualificados de 05 a 07/10 com Marca Própria, a mediana foi R$ 61 (P75 R$ 138, máx. R$ 420); R$ 50 pega ~60% e corta valores simbólicos.
- **O que foi esquecido:** o pedido estava na lista "em definição" desde 05/10 e eu não cobrei os padrões. Desde 07/10 está implementado.
- **Divergências:** /divergencias ganhou "C. Sem canal no CEVEN" e "D. Canal: o CEVEN passou a valer".
