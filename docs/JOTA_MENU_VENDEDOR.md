# JOTA — Menu do Vendedor (mapeamento de 09/11/2026)

> Pedido do Vitório (09/11/2026): mapear TODAS as conversas dos vendedores e fechar o JOTA do vendedor num menu de respostas prontas,
> com quantos itens forem precisos para responder **99%** das perguntas (não um número fixo). Resposta pronta = montada pelo código com o dado do D1, igual para todos, testada.

## 1. Base do mapeamento (D1 `bot_msgs` + `bot_sugestoes`, papel = vendedor, até 09/11/2026)
- 52 vendedores escreveram (de 137 ativos); 172 mensagens recebidas.
- 65 são "Sim", notas (1–5) e cumprimentos; 3 são respostas automáticas de WhatsApp Business do próprio vendedor (risco de robô conversando com robô).
- **104 perguntas reais.** 192 "indicadores desejados" do cadastro.

## 2. Curva de cobertura (perguntas reais)
| # | Tema | Perguntas | Acumulado | Hoje o JOTA... |
|---|---|---|---|---|
| 1 | Meta x realizado / "como estou" / faturamento / positivação | 23 | 22% | responde (resumo do vendedor) |
| 2 | Liga / Champions (posição, pontos, regras, prêmio) | 15 | 37% | responde parte; "até que lugar premia" caiu nas Metas da Premiação |
| 3 | Comissão / salário / RMV / premiação em R$ | 14 | 50% | **não responde**: diz "em breve" ou devolve meta/rota. O CEVEN tem: tela **Premiação → Holerite simulado** (`/api/rca/holerite-link`), com faturamento líquido, RV faturado, RV vendido e total do mês |
| 4 | Mês passado / fechamento de outubro | 10 | 60% | responde (foto do mês) quando entende; "RMV do mês passado" respondeu errado |
| 5 | Mix / o que oferecer / indústrias para melhorar | 10 | 69% | responde (+MIX) |
| 6 | Recorrência (quem falta no mês) | 8 | 77% | responde |
| 7 | Rota (hoje, próximo dia, "segunda-feira", roteiro de amanhã) | 7 | 84% | hoje sim; outro dia não |
| 8 | Pedidos pendentes / bloqueados / a faturar | 4 | 88% | responde |
| 9 | Prospecção do dia | 3 | 90% | responde quando a coleta do dia está ok |
| 10 | Clientes sem compra / curva negativa / quantos clientes tenho | 3 | 93% | responde |
| 11 | "Ver mais" (continuar a lista) | 2 | 95% | responde |
| 12 | Campanha (acompanhamento) | 1 | 96% | — |
| 13 | Cliente específico (histórico por código ou CNPJ) | 1 | 97% | responde (ficha) |
| — | Continuação da conversa ("No Brasil", "não me mandou o que pedi") | 3 | 100% | resolve pela pergunta anterior, não é item novo |

**Peso do cadastro (o que eles querem e ainda não pediram muito):** comissão/RMV 56% · clientes sem compra 39% · status de pedido/entrega/bloqueio 31% · meta x realizado 22% · mix/o que oferecer 19% · positivação 19% · recorrência 6% · campanhas 6%.

## 3. Proposta de menu (13 itens + continuação)
1. Como estou (meta x realizado, faturado + pendente, positivação, quanto falta por dia)
2. Minha posição na Liga (pontos, quanto falta para o próximo, regras e prêmio)
3. Minha premiação / RV do mês (holerite simulado do CEVEN)
4. Fechamento do mês passado (faturado, meta, RV)
5. O que oferecer (+MIX) a um cliente (código ou CNPJ) e indústrias para melhorar
6. Recorrência: quem falta no mês
7. Minha rota (hoje e próximo dia de rota)
8. Meus pedidos (pendentes, bloqueados, a faturar, status/entrega)
9. Prospecção do dia
10. Clientes sem compra no mês
11. Campanhas do mês
12. Ficha de um cliente (histórico e SKUs)
13. Ver mais / continuar

Regras do menu: o vendedor digita o número **ou** escreve do jeito dele; a frase é sempre encaixada num item; fora do menu = "ainda não está no menu" + vira sugestão. **Sem resposta livre de IA para vendedor.** Cada item tem teste fixo com as perguntas reais da seção 2.

## 4. O que falta construir
- Item 3 (premiação/RV): trazer o holerite simulado para a base única (a varredura central é quem fala com o CEVEN) e responder dali.
- Item 7: rota de outro dia ("segunda-feira", "amanhã").
- Item 8: status de entrega (31% do cadastro).
- Trava: não responder a resposta automática de WhatsApp Business.

## 5. Remapeamento e menu no ar (09/11/2026, noite)
Base nova: **164 perguntas reais de 82 vendedores** (104 mensagens eram só sim/oi/notas) + **229 passaportes** (indicadores desejados).

| Tema | Perguntas | Passaporte |
|---|---|---|
| Meta x realizado / como estou | 21% | 35% |
| Liga / Champions | 16% | 1% |
| Comissão / RV / premiação | 9% | **52%** |
| Mês passado / fechamento | 8% | 7% |
| Pedidos (status, bloqueados, entrega) | 7% | 33% |
| Mix / o que oferecer | 7% | 21% |
| Recorrência | 6% | 6% |
| Rota | 5% | 3% |
| Clientes sem compra | 4% | 37% |
| Prospecção | 2% | 1% |
| Devolução | — | 5% |
| Ficha de cliente | — | 2% |
Sem tema (12%): continuação de conversa, cadastro, "tem Toblerone?", "quantos clientes eu tenho", número de pedido, conversa solta.

**Menu no ar** (`functions/_lib/jota/respostas/liga_mix.js` MENU_VENDEDOR; rota dos números em `entende.js`): "menu", "ajuda", "oi" ou pergunta não entendida mostram o menu; o número logo depois do menu abre o item; depois de outra lista o número segue sendo o item daquela lista.
1 Como estou · 2 Liga · 3 Premiação (metas; RV em R$ ainda no CEVEN › Premiação) · 4 Meus pedidos · 5 Clientes sem compra · 6 +MIX da rota de hoje · 7 Fechamento do mês passado · 8 Recorrência · 9 Minha rota · 10 Prospecção · 11 Devoluções · 12 Ficha de um cliente.
Teste com dado real (só leitura): `node testes/_t_menu.mjs` — os 12 itens respondem para a Graciela (TCV 1057).
Falta: RV em R$ (holerite do CEVEN na base), produto ("tem X?"), rota de outro dia, carteira ("quantos clientes tenho").

## 6. Índice limitado (09/11/2026, noite — regra do Vitório)
- Para o **vendedor**, tudo passa pelo índice: qualquer texto recebe o índice de volta (com "Entendi que você quer o N" quando o assunto é reconhecido); a resposta pronta sai só pelo número.
- 15 índices; sub-índices em 1 (hoje, meta, quanto falta, por indústria), 2 (posição, lances, regras), 4 (todos, bloqueados, a faturar, cancelados) e 9 (rota, quem falta visitar). Digita 4.2, ou só 2 logo depois das opções do 4. **0** volta ao menu.
- Passam direto (precisam de dado digitado): código/CNPJ do cliente, "tem <produto>", "campanha <nome>", SIM de confirmação, número de cliente quando a última resposta é uma lista de clientes.
- RV/comissão (índice 3): "não tenho os dados do RV" + metas e como está até agora (ou o fechamento, se for mês passado).
- Sem a nota "de 1 a 5" para vendedor (o número é escolha do índice).
- Teste em conversa com dado real (só leitura): `node testes/_t_indice.mjs`.
