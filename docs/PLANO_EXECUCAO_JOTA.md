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
- [ ] 7 Liga desde 11/11
- [ ] 8 Bateria completa
