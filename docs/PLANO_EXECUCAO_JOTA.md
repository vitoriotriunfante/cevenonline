# JOTA — Plano de execução até o ar (17 e 18/11/2026)

> Vitório, 17/11/2026: "e o plano para colocar tudo no ar? as horas de trabalho?" — estimativa do dev (16/11): 24–35 h. Este documento é a ordem de execução, com o critério de pronto de cada bloco. Atualizado a cada bloco entregue.
> Base: [CATALOGO_RESPOSTAS_JOTA.md](CATALOGO_RESPOSTAS_JOTA.md) (40 intenções) · [MAPA_DADOS_JOTA.md](MAPA_DADOS_JOTA.md) (fonte de cada dado) · [REGUA_QUALIDADE_JOTA.md](REGUA_QUALIDADE_JOTA.md) (24 regras) · `testes/jota_regressao.mjs`, `testes/_t_menu16.mjs`, `testes/_t_menu15_sup.mjs`.

## Regra de trabalho (para não repetir 16–17/11)
1. **Nenhuma resposta é trocada sem comparar com a que existia** (conteúdo, imagens, blocos) e com o modelo do catálogo. Nada sai a menos.
2. **Uma intenção = uma resposta.** Menu e texto livre caem na mesma função. Nada de interceptação solta no `entende.js`.
3. **A régua barra a publicação** (casos-chave + menus) — `publicar_tv.js` não publica se reprovar.
4. Toda resposta: fonte e hora curtas no rodapé; nunca "CEVEN"; nunca "R$ 0" sem leitura do dia.

## Blocos (ordem de execução)

| # | Bloco | Horas | Pronto quando |
|---|---|---|---|
| 1 | **Roteador por intenção** (`functions/_lib/jota/intencao.js`): classifica a mensagem nas 40 intenções do catálogo (contestação/recado → número de pedido/CNPJ/cliente → assunto → pessoa → dia×mês); menu do vendedor (16), do supervisor (15) e texto livre apontam para a mesma intenção. Chave em `config_flags` (`jota_intencao`): desliga e volta ao roteamento antigo. | 6–8 | as 25 perguntas de 17/11 do Vitório e as 12 da Tamara caem na intenção certa (teste offline, sem D1) |
| 2 | **Respostas das intenções mais usadas**, cada uma num lugar só: matinal da equipe (card do dia + card de indústrias + texto, dados de hoje), matinal/bom dia do vendedor (último dia útil, nunca "ontem 13/11"), equipe hoje, vendedor hoje, curva/sem compra (GEROT por cliente), rota de hoje (+ "sem compra com visita hoje"), carteira, pedido nº, devoluções, indústria (inclusive uma só: "Gonçalves em TBL"), tendência das filiais, positivação Brasil com carteira e mês anterior, menu do supervisor, "pare", sugestão. | 8–10 | menus 16/16 (vendedor) e 15/15 (supervisor) na régua; 0 menção a CEVEN |
| 3 | **GEROT — Carteira Total** (pedido × item, status, motivo de bloqueio, positivado no mês): 1 linha por pedido no D1, só o que mudou. **Devoluções, Cortes, Pedidos, Recorrência** pelo botão "Exportar Excel" (mapa de 17/11). | 6–8 | "pedido 1038000485" responde status/bloqueio/NF; devolução com motivo; recorrência com a lista do GEROT; cortes do mês |
| 4 | **Régua barrando a publicação** (casos-chave + amostra dos menus, modo rápido) | 1–2 | publicar com um caso-chave reprovado = publicação cancelada |
| 5 | **Imagens da matinal sob demanda** (só para quem pede, com os dados do momento) — precisa de uma chave do GitHub no site (decisão do Vitório) | 2–3 | supervisor pede matinal → texto na hora + cards em ~2 min |
| 6 | **MONITOR.IA em simulação** (agenda 07:30 / 09:05 / 11:00 / 12:00 / 18:30 do plano), grava o que mandaria, não envia | 3–4 | 1 dia de simulação lida pelo Vitório + 2 supervisores |
| 7 | **Liga desde 11/11** (recalcular sem gravar, antes × depois, auditoria) — com Carteira/Devoluções do bloco 3 | 3–4 | relatório por vendedor aprovado pelo Vitório |
| 8 | **Bateria completa** (todas as perguntas reais de 16 e 17/11) e correções até < 5% de erro | 4–6 | < 5% na régua; casos-chave 100% |
| | **Total** | **33–45 h** | |

## Agenda
- **17/11 (hoje):** blocos 1 e 2 (manhã/tarde), 4 (fim da tarde), 3 começa à noite (Carteira Total).
- **18/11:** bloco 3 (Devoluções, Cortes, Pedidos, Recorrência), 6 (simulação liga às 07:30), 7, 8.
- **Divulgação:** depois de 2 dias com casos-chave 100% (supervisores primeiro).

## Status (atualizar a cada entrega)
- [~] 1 Roteador por intenção — no ar 17/11 (pare, sugestão, contestação, matinal/bom dia de alguém, tendência, positivação, uma indústria, rota sem compra, cortes). Corrigido no mesmo dia: "venda do Brasil" virava indústria (Fvo Brasilia).
- [~] 2 Respostas das intenções — no ar 17/11: Brasil/tendência/positivação SÓ GEROT (`respostas/gerot_painel.js`: fat + carteira, ritmo = captação ÷ meta ideal do GEROT, captação M-1 até o mesmo dia, faturado M-1/3M/A-1, positivação M-1/3M/A-1/Bench); "precisa por dia útil" até o FIM DO MÊS (dia 20 é só faseamento AS); começo do dia do vendedor (rota × 20 visitas, 2 cadastros perto da rota, 5 clientes × 3 itens, lista completa); zerados com a lista dos sem visita; disparo manual da Central passa a pausa "só responder" (teto antiban mantido).
- [~] 3 GEROT — mapa feito (Carteira Total: 50.729 linhas, 24 colunas). 17/11: coletor pede positivação A-1/Bench, % meta fat+cart, mix, pedidos faturados; histórico nov/25 carregado (A-1); **pedidos do mês um por linha** (`gerot_pedido`: data, vendedor, cliente, pedido, NF, faturado, carteira) → "meus pedidos" do vendedor (`respostas/pedidos_gerot.js`). Falta: bloqueio/motivo (Carteira Total), Devoluções, Cortes, Recorrência.
- [ ] 4 Régua na publicação
- [ ] 5 Imagens sob demanda (aguarda decisão da chave do GitHub)
- [ ] 6 MONITOR.IA simulação
- [x] 7 Liga desde 11/11 — no ar 17/11 pelo Clube + GEROT (ver abaixo)
- [ ] 8 Bateria completa

## Fim do dia 17/11 — auditoria por papel e plano reajustado

**Auditoria por papel (17/11, ~19h):** `testes/auditoria_papeis.mjs` pergunta SECO ao JOTA de produção (`/api/jota-seco`, nada enviado) e passa na régua. Resultado em `docs/AUDITORIA_PAPEIS_2026-11-17.md`:
vendedor 14/14 · supervisor 10/11 (o 11º é rigor da régua: lista por vendedor com exemplos) · gerente 9/9 · diretoria 14/14.
**Amarração:** a Tamara vista por ela, pelo supervisor e pela diretoria traz os MESMOS números.
Menus: vendedor 15/16 e supervisor 14/15 (os reprovados eram falso positivo da régua).

**Corrigido na auditoria:** "bom dia" do vendedor devolvia o menu (agora = o começo do dia dele, o mesmo da diretoria); "quanto vendi hoje" vinha com o mês; "pedido 352001310" dava "não achei" (havia 2 rotas; agora as duas leem o GEROT); indústrias do vendedor/equipe liam a Premiação (fora do ar, "apuração até 20/11"); positivação de várias indústrias somava o cliente várias vezes (TPH 3.967 × 1.750 reais).

**Liga (bloco 7) — NO AR 17/11:** `/api/liga-clube` (Clube + GEROT, mesmas chaves/provas do coletor antigo). 12, 13 e 16/11 gravados e refechados (cópia do fechamento anterior em `liga_fechamento_copia`); hoje grava sozinho depois de cada leitura do Clube e carga do GEROT. Venda na visita só com prova (pedido datado no GEROT, entrada no dia na Carteira Total, ou conta exata do Clube). Pênalti só com dias sem comprar provados.
Fora (sem fonte): marca própria / tripla / dobrou o mix / bonificação (itens do pedido), meta do 1º tempo, impedimento de GPS (Clube sem coordenada), devoluções, dobradinha das quinzenas. 12 e 13/11 ficaram parciais (pedido já faturado só tem a data do faturamento); daqui em diante a data de entrada fica guardada (`gerot_pedido_entrada`).
**Vendedor do pedido (Vitório, 17/11):** o número do pedido NÃO é prova do vendedor (10, 100 e 1000 podem ter o mesmo número; o que diferencia é a filial). Carteira: vendedor pelo nome na filial (Gestão de Equipe); o começo do número só vale se o nome confirmar.

### O que falta para o JOTA nota máxima (ordem)
| # | Bloco | Pronto quando |
|---|---|---|
| A | **Régua na publicação**: `publicar_tv.js` roda a auditoria por papel (modo rápido) e cancela se cair abaixo do último resultado | publicar com regressão = cancelado |
| B | **Auditoria diária automática** 06h30 e 13h (GitHub Actions → `/api/jota-seco`), relatório no D1 + aviso ao Vitório só se piorar | 2 dias seguidos sem regressão |
| C | **Bateria completa** com TODAS as perguntas reais de 16 e 17/11 (bot_msgs) pelo `/api/jota-seco` | < 5% reprovadas, casos-chave 100% |
| D | **Rota de hoje com nomes pelo Clube** (hoje vem do roteiro do mês gravado pelo CEVEN em 11/11) | começo do dia e "sem visita" sem CEVEN |
| E | **GEROT Devoluções** (motivo por nota) → "minhas devoluções", gol contra e vermelho da Liga | devolução por motivo nas 4 visões + Liga |
| F | **Itens do pedido** (GEROT com Produto) → marca própria / tripla / dobrou o mix da Liga e "+MIX" com o que o cliente comprou | lances de MP de volta |
| G | **Liga: meta do 1º tempo** (leituras do Clube ao longo do dia) e **quinzenas** (entrada guardada) | todos os gols com fonte |
| H | **MONITOR.IA em simulação** (grava o que mandaria, não envia) | 1 dia lido pelo Vitório + 2 supervisores |
| I | **Imagens sob demanda** (chave do GitHub no site — decisão do Vitório) | matinal com cards em ~2 min |

## 18/11 — andamento (perguntas do Evandro, do Micheleto e do Vitório)
- **No ar:** margem (só diretoria/gerente) · % de atingimento por filial · carteira por situação e motivo · plano de visitas e aderência por filial/supervisor/vendedor · justificativas vendedor × motivo e motivo × vendedor (Clube, todos os dias carregados) · devolução pelo GEROT (R$ 2.306.455 = tela) · **devolução por motivo** Brasil e por filial (29 motivos, 161 linhas motivo × filial; 🟥/⚽ marcam o que é cartão/gol contra na Liga) · faturado **até a data** × mês passado × **média dos 3 meses** (gerot_filial_dia; agosto e setembro carregando 18/11) · bom dia cascateado supervisor/gerente/diretoria.
- **Bloco D (rota com nomes) — NO AR 18/11:** `pipeline/clube_roteiro.mjs` (passo do clube-coletor; Roteiro Consolidado Geral, Excel por filial, relê a cada 3 h) grava `clube_roteiro`: 5.452 visitas, 11 filiais, 481 vendedores; bate com o "roteiros" do Relatório de Vendas do Clube (ABC 465/465, TSJ 403/403, TCG 234/234). Código do cliente = o mesmo do CEVEN e do check-in. 17 vendedores com rota e sem linha no Relatório de Vendas (vagos e sem movimento: TPH 105/109/110/113/121/127/56/82/95/1047, TCA 396/1028/1051, MCD 426/428, API 247, TPA 1077). `central-snapshot.js` monta a rota de hoje a partir dele (do CEVEN fica só focos). "Quem falta visitar" do vendedor = mesma conta da "minha rota" (Tamara 352: 7 na rota = Clube 7; 3 visitados = 3 check-ins).
- **Última compra = GEROT:** a ficha estava velha (Big Casa "42 dias" × GEROT 27/10 = 22). Vale a data mais recente entre ficha e `gerot_pedido` (ago–nov carregados) em minha rota, falta visitar, curva negativa e sem compra.
- **Cortes da gestão:** a tela Cortes do GEROT não tem "motivo" além de comercial × logístico; resposta por filial/supervisor/vendedor (Brasil R$ 1,49 mi: 64% comercial, 36% logístico).
- **Gap por cliente × média 3M (Evandro):** `respGapClientes` (gerot_cliente_mes ago/set/out): clientes abaixo da média mensal, quanto falta para voltar à média, maiores gaps com vendedor.
- **MONITOR.IA:** dossiê do supervisor passa a usar meta/faturado/carteira/necessidade-dia do GEROT (mesmos números do bom dia). Segue em simulação; não envia.
- **Devolução por motivo — notas por filial:** valor e clientes por filial somam o total do Brasil; a coluna de notas por filial vem 1/2 (errada). Fora da resposta até corrigir a leitura (log do próximo run mostra o texto cru).
- **Falta:** Liga MP/tripla/mix/bonificação (Produto) e impedimento GPS · MONITOR.IA dossiê só Clube+GEROT e simulação · auditoria ampla de novo (meta >95%) · decisão do Vitório: 13 vendedores só no GEROT e Cristiano 1098.

### 18/11 tarde — auditoria ampla 2 e correções
- **Auditoria ampla (78 pessoas, 1.254 perguntas, com as perguntas novas do Evandro/Micheleto):** **93,6%** (antes 89,1%). Diretoria 24/24 · gerente 148/156 · vendedor 684/722 · supervisor 318/352. As 12 "vazias" foram D1 sobrecarregado e minutos de publicação (não é bug).
- **Corrigido depois dela:** visita na rota = a conta do Clube (check-in OU justificativa OU pedido; API 268: 4 visitas = 4 pedidos sem check-in) — "fechamento" dizia 0 de 47 e "minha equipe" 5 de 47, agora os dois 5 de 47 · zero do dia sempre com a hora da leitura do Clube (R03) · "Vago" fora dos nomes (R15) · singular "1 cliente/1 ponto" (R18) · "rota 0" vira "sem rota hoje" (R04).
- **Carteira do GEROT:** "Valor item" vem em centavos (vários pedidos = 100,00× o Clube) → ÷100. Por pedido: marca própria (TRIUNFANTE BRASIL sem o palete 8171), indústrias e SKUs; guardados para sempre em gerot_pedido_entrada (o maior já visto). Hoje: 1.165 pedidos, 30 com R$ 50+ de MP. O total da carteira ainda fica ~50% do "Carteira pendente" do GEROT → valor em R$ da carteira continua fora das respostas.
- **Liga:** gol de marca própria, tripla e dobrou o mix (mesma regra do mixDobrado: SKUs do pedido × média dos pedidos anteriores do cliente — histórico começa 18/11, sem anterior = sem gol).
- **Devolução por vendedor (mapa):** tela abre um nível por vez; nível Pedido = pedido, data do faturamento, valor e data da devolução (sem motivo), 200 de 1.000+ linhas, abre em produtos. Mapa 3 procura o caminho motivo → filial → vendedor.
- **GPS do Clube (impedimento):** a tela abre mas só mostra um calendário sem escolher o Representante — precisa rodar por vendedor (pendente).
- **Auditoria ampla 3 (18/11 ~16h):** 93,3% — o /api/jota-seco não passava pelo acabamento do bot.js (rodapé do Clube, hora nos zeros, Vago, singular). Agora `functions/_lib/jota/acabamento.js` é a saída única do WhatsApp e da auditoria.
- **Justificativas:** sob D1 ocupado a leitura do Clube falhava e caía na resposta antiga do CEVEN ("até 16/11") → agora tenta de novo e, se falhar, pede para perguntar de novo. Ordem das palavras decide vendedor × justificativa / justificativa × vendedor.
- **Última compra = data do PEDIDO** (entrada no GEROT, pedido do Clube, ficha; a do GEROT faturado é a da nota) em todas as listas; pedido no mês = comprou; "visitou e não vendeu" sem quem fez pedido hoje. Tamara 352: minha rota, falta visitar, quanto vendi hoje e bom dia com os mesmos números.
- **Matriz da TV:** gols/pênaltis do dia pelo servidor (antes só lances dos últimos 15 min → "0 gol(s)"); VAR com todo lance novo para a tela.
- **Auditoria ampla 4 (18/11 ~17h):** **97,2%** (1.169/1.203) · supervisor 98,5% · gerente 98,5% · vendedor 96,5% · diretoria 16/18. Restante: "clientes sem compra com visita hoje" quando todos já compraram (régua), e "Não achei os seus dados" com o D1 ocupado → agora leitura falha não fica em cache e o vendedor é lido de novo.
- **Devolução por motivo até o VENDEDOR — no ar:** Motivo › Filial › Supervisor › Vendedor (657 níveis abertos em 16 min; 939 linhas; 404 vendedores; soma R$ 2.387.548 = total do GEROT R$ 2.387.516). Tabela gerot_devolucao_motivo_vend; coleta nas rodadas das 13h e 17h (gerot-coleta) ou manual (gerot-devolucoes modo=vendedor). Respostas: vendedor "minhas devoluções por motivo", supervisor/grupo por vendedor, gerente/diretoria "devolução por motivo por vendedor TPH". Liga (gol contra/vermelho) ainda precisa da DATA da devolução — o nível Pedido tem a data, mas sem motivo; próximo passo: cruzar.

## 21/11 — auditoria profunda (6 times) e correções
- Relatórios dos 6 times (supervisores, gerência, analistas, arquitetura, UI/UX, MONITOR.IA) na pasta de auditoria local (scratchpad); consolidado com plano até segunda.
- **MONITOR.IA piloto** (`functions/_lib/monitoria/piloto.js`, `/api/monitoria-piloto`): 22 supervisores (2 por filial, os que mais usam o JOTA), janelas 10h/12h/17h/18h30 na hora local, texto fixo (IA só com conferência, chave `monitoria_ia`), liberação própria `monitoria_liberada_ate` (sem mexer na pausa geral), teto antiban, máx. 4/dia, sem feriado/fim de semana, silêncio se Clube > 40 min, resposta "ok/não procede". Hoje em SOMBRA; worker-cron chama uma filial por vez. Decisão de liberar: segunda 10h.
- **Liga**: classificação religada (brasileirao-dataset de 30 em 30 min pelo worker-cron; lê os lances do Clube+GEROT).
- **Número é número** (Vitório): oculto/vago/fora da Gestão entra em todas as respostas; ocultar vale só para a Champions.
- **Mesma conta em todos os papéis**: % da meta = (faturado + pendente) ÷ meta; precisa/dia = "Necessidade dia captação" do GEROT; fechamento do mês passado pelo GEROT.
- **TPA com 2 gerentes** na Gestão: grupo RADKE (pasta Colgate) e LEANDRO (pasta Bombril, sup 544/545; 22 vendedores incl. Paulo Cholet 1194).
- Outras: IA livre não escreve número (`jota_ia_livre`), modo seguro, mais rápido (sem "digitando" simulado, cache 3 min), reação 👍, rodapé GEROT com hora, bloqueados com R$ (pedido do Clube), marcas comerciais → indústria, linhas suspensas (lista 21/11) destacadas em /contatos, filtro por RCA.
- **Publicação a partir da main** (21/11, 19h): testes do relógio atualizados para o CEVEN desligado; a trava do CEVEN no _middleware foi ao ar.
- **Pendente**: Liga gol contra/vermelho por devolução (GEROT não dá data + motivo juntos) e impedimento por GPS (Clube só por vendedor).

## 21/11 noite — GEROT inteiro, sonda e blocos A/B/C
- **Horário do GEROT (medido 17–21/11, 10 leituras):** atualiza de 2 em 2 h nas horas PARES — carga ~hh:11, painel "Última atualização" ~hh:33 (12:33, 14:33, 18:34, 20:33). O teste de horário (gerot-horario.yml, desde 16/11) dependia do schedule do GitHub e rodou 2×/dia em vez de 30.
- **Sonda no ar:** worker-cron dispara `gerot-horario.yml` de 15 em 15 min (seg–sáb 06h–21h45). `/api/gerot-carga` compara a "Última atualização" com a última coleta; mudou → a sonda dispara `gerot-coleta.yml` uma vez por atualização (`config_flags.gerot_coleta_pedida`). Reserva fixa 07h17 e 21h17. Devolução por vendedor nas coletas das 12–13h e 16–17h. Coleta completa leva 12–33 min, por isso não roda "de 20 em 20".
- **GEROT inteiro (Vitório: "pq não lemos tudo? já pedi umas 30x"):** PDF de 118 páginas / ~40 telas (Visão Geral, Faturamento, Desvio, Desconto, Bonificação, Captação, Cortes, Devoluções, Troca, Positivação, Fat por Cliente, Mix, TMF, Cliven, Recorrência, RFV, PMI, Cadastro, Carteira Total, Pedidos, JBP, Estoque FEFO/Onde Atuar, Visão Campo (12 KPIs), Visão MC, DRE, Margem, Curva Negativa, Histograma, Tabela Preço × MC). `gerot_mapa_telas.mjs` agora mapeia TODAS as telas e TODAS as exportações (rótulos sem número + colunas). Próximo: coletor único de todas as telas para o D1 a cada atualização.
- **Bloco A (régua na publicação):** nunca rodava (a chave só existia no arquivo local). Agora roda em toda publicação: 21/11 19h53 = 44/48.
- **Bloco B (auditoria diária):** disparada pelo worker-cron 06h32 e 13h02 (o schedule do GitHub atrasava até 7 h); WhatsApp ao Vitório só quando piora.
- **Régua:** `auditoria_ampla` e `bateria_real` fixavam a hora no início (rodadas de horas) → R03 reprovou 278 respostas com leitura fresca. Corrigido (hora da resposta). Auditoria 5 real = 90,2% (sábado à noite, sem rota: R05/R06/R17/R20).
- **Bateria real 18–21/11 (469 perguntas, 86,6%)** → corrigidos: mix de produto pelo GEROT; curva negativa por indústria/marca (nova coleta Cliente × Indústria, `gerot_cliente_forn_mes`); ficha do cliente pelo GEROT quando não comprou no mês; "Boa-tarde"; "não foi isso que eu pedi"; sem "igual ao CEVEN", "ticket sem dado", "0 de 0".
- **Sugestões (159 sem tratamento):** curador nunca rodou (estava no ramo do relógio desligado com o CEVEN) e não marca nada. Triadas 21/11: 62 feitas, 59 precisam de ação (34 = comissão, sem fonte), 24 ruído/cópia. A auditoria (jota-seco) gravava contestações repetidas — corrigido. Curador no relógio que funciona (seg–sex 19h17) e conta as sem tratamento.
- **TBE (Diego):** "quem falta positivar" contava o cliente 1x por código (H|/vago) → 3.357; agora por cliente: 911 de outubro sem compra = lista do GEROT.
- **Tio Patinhas (TBE 303):** notas em 09 e 16/11 com R$ 0 de venda no GEROT → curva negativa mostra "nota sem valor de venda".
- **Joseanne (TCA 408) amarelo 18/11:** pedidos 07:39/08:51 sem check-in; regra = check-in até 10h. **Decisão do Vitório:** pedido antes das 10h livra o amarelo?
- **Matinal em imagem:** cards só existiam de 17/11 (o "sob demanda" nunca foi ligado). Agora 1x por dia na coleta da manhã; card com ritmo e necessidade do GEROT (antes: projeção linear) e bloqueados da Carteira Total (antes: pedido_status parado); /api/matinal-cards aceitava sem chave (faltava await).

## 22/11/2026 (domingo) - Auditoria lance por lance da Champions (Vitorio: "lance so com evidencia")
- Prova de pedido: 842 lances (710 pedido na rota, 97 defesa, 35 resgate) sem pedido do cliente no GEROT nem no Clube -> retirados (copia em tv_lances_retirados).
- Conta do Clube que deduzia venda (visitas sem justificativa = pedidos) removida: venda so com pedido do cliente.
- Recalculo de 17-19/11 das fontes: 351 lances com prova gravados; 257 sem prova retirados (venda deduzida, quinzenas com o mesmo pedido); 68 conflitos defesa x inativo resolvidos pela TAG do dia; 1 penalti sem dias retirado.
- Todos os dias 03-19/11 refechados (copia em liga_fechamento_copia). Fechamento 22h17 seg-sex e semana invicta voltaram ao worker-cron (estavam no cron-lances desligado).
- CEVEN: admin (compromisso, RET, TAGs) e gerente (GPS das visitas) liberados so nessas rotas; impedimento por GPS volta em 23/11.
- TV: cartao do vendedor com o mes do GEROT e a rota do dia pelo Clube.
- SEM FONTE AINDA: gol contra / vermelho por devolucao (GEROT so da motivo por mes, sem nota e data).
- (22/11, tarde) Pontos que subiram no refechamento: 58 copias MTZ de lances retirados (retiradas) + 161 lances de 03-11/11 gravados depois do fechamento original das 22h (retirados). Dias 03-11 ficaram abaixo do original.
- Devolucao: CEVEN (rota do vendedor) le nota, data e motivo; 893 notas/167 vendedores. 85 lances 17-19/11 gerados; 391 de 03-16/11 conferem 100% com o motivo; 249 que o coletor antigo nao leu foram gravados (reparo, mesmo metodo de outubro). Todos os dias refechados; auditoria de prova 26.156 lances, 0 falha.
- Trava no motor: lance retirado pela auditoria nunca volta; defesa x inativo nunca os dois no mesmo cliente/dia.
- Placar: 11 filiais, gerentes e 71 supervisores batem com a soma dos vendedores (time do supervisor = canal da maioria).
- JOTA bateria real 17-22/11: 89,9% (661/735). Corrigidos: domingo so barra pergunta do dia; singular com negrito; fechamento de agosto/setembro (vendedor caia no menu do mes passado); bloqueado comercial/financeiro; cartao no mes. Vazias (15) = saudacao/IA que o teste seco nao roda.
