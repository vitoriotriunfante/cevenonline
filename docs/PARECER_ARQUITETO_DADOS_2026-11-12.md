# Parecer do arquiteto de dados sênior — 12/11/2026

> Revisão independente pedida pelo Vitório ("chame um arquiteto senior de dados para avaliar todas as nossas mudanças antes de fazer"), sobre `docs/PLANO_CADENCIA_DADOS.md` e os commits de 12/11. Nota do plano: **5/10**.

## Erros encontrados nas mudanças de 12/11 e o que foi feito
| # | Problema | Situação |
|---|---|---|
| 1 | O reforço do `central-snapshot` gravava a leitura de ontem **por cima** do dado de hoje. O motor do WhatsApp mandaria número de ontem como de hoje e a trava "sem 100% lido nada sai" deixava de valer | **Corrigido (4941dd8d):** reserva em campos separados (`dashboard_reserva`, `roteiro_planejado`, `reserva`); o motor não lê esses campos |
| 2 | Rota tirada do roteiro do mês sem status: "a visitar", "zerado" e "sem visita" afirmariam que ninguém visitou (zero falso) | **Corrigido:** rota planejada marcada com 📅 "sem status de visita de hoje"; não conta como zerado nem como sem visita; "a visitar" fica vazio |
| 3 | O GEROT virava o total do vendedor quando não havia leitura do CEVEN no mês | **Corrigido:** retirado |
| 4 | Sem a cascata de hoje, o snapshot usava a de **ontem** e mostrava visitas de 11/11 como de 12/11 | **Corrigido:** cascata de outro dia só serve para a meta |
| 5 | O snapshot (leitor) chamava o CEVEN ao vivo (5 s por chamada com o CEVEN fora) | **Corrigido:** só o coletor chama o CEVEN |
| 6 | Só 1 de ~80 respostas do JOTA mostrava de onde veio o número | **Corrigido:** etiqueta única no `bot.js`, em qualquer resposta que use a reserva |
| 7 | Fila da produtividade: a ordenação final jogava quem teve pedido novo para o fim | **Corrigido** |
| 8 | Índice criado à mão no banco, fora do código | **Corrigido:** registrado em `garanteIndicesOtimizacao` |
| 9 | Inventário do GEROT na mesma fila da coleta: podia cancelar a carga | **Corrigido:** fila própria; rodar fora das janelas |
| 10 | TV: reserva só para as telas; o coletor de lances nunca usa; rota planejada não entra | **Corrigido** (`tv-vendedor.js`) |

## Pendentes do parecer (ordem recomendada)
1. **Digitado por vendedor no boletim:** hoje é "Winthor ou zero". O Winthor lê ~5 vendedores por rodada (~4 h para todos). Usar o Winthor só quando a leitura do vendedor for recente; senão a produtividade, com marca. E **uma regra única** de inclusão (pedido de código fora da equipe soma ou não) para boletim, JOTA e TV.
2. **Data do pedido:** guardar de qual fonte veio a data (`data_fonte`), para não reler a cada 6 h e não sumir pedido.
3. **Medir as cotas pelos cabeçalhos** (`X-RateLimit-*`) por endpoint quando o CEVEN voltar e refazer o orçamento (§4 do plano estava otimista: o Winthor, a correção de datas e a recheca também usam `/api/rca`).
4. **`dado_frescor` + `/api/saude` + alarme** (fonte, lido_em, válido_até e estado de cada parte).
5. **Porteiro único da cota do CEVEN** (Durable Object com balde por família) + endpoints e gatilhos separados por fila.
6. **D1:** `roteiro_mes` em tabela mensal por hash; DDL fora do caminho quente; painel materializado para as TVs (`tv-vendedor` de 501 mil para ~20 mil execuções/dia); compactar dias antigos depois de exportar.
7. **GEROT:** gravar a hora da carga do próprio GEROT e o id da carga; excluir linha que não veio na carga mais recente; foto do CEVEN a cada carga; batimento com causa (estrutura, horário, definição, sem explicação) e alarme só para "sem explicação" em 2 cargas seguidas.

## O que NÃO fazer
- Mais camadas de reserva.
- `max(Winthor, produtividade)`.
- Aumentar cadência antes de medir.
- Migração grande durante a queda do CEVEN.
- Apagar histórico antes de exportar.
- Correção automática da Liga.
- Inventário do GEROT em horário de carga.

## Decisões do Vitório
1. Com o CEVEN fora, o boletim sai com "última leitura real de HH:MM" ou espera?
2. Rota sem leitura de hoje: "rota planejada, sem status" (como ficou) ou "sem dado"?
3. Total da filial em todos os produtos inclui pedido de código fora da equipe (loja, digitado no Winthor)?
4. Vendedor que sai da árvore no meio do mês continua somando até o fim do mês?
5. Aprova a mudança de schema (roteiro_mes em tabela própria, compactação com export, índice em migração)?
