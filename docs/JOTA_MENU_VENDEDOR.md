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
