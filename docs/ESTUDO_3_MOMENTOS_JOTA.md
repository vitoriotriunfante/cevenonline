# ESTUDO — Jota do vendedor em 3 momentos do dia (11/11/2026)

> **Proposta do diretor (áudio de 10/11/2026):** simplificar. Três momentos no dia, sempre disparados pelo vendedor (ele cumprimenta, o Jota responde):
> 1. **Bom dia** → resumo dos 4 indicadores (faturamento, positivação, mix, recorrência) + **5 clientes de foco** (primeiro TAG/recorrência; se não houver, quem está há mais tempo sem compra). "Escreva *mais*" abre o menu.
> 2. **Almoço** → o que fez de manhã, o que vendeu, o que falta para a tarde.
> 3. **Fim do dia** → como foi o dia: visitas, tempo em rota, positivação, o que vendeu do +MIX.
>
> **Pergunta do Vitório:** faz sentido? Qual rotina o vendedor precisa? Estudo aprofundado antes de decidir.
> **Método:** dados reais do D1 de produção (rotina de 1.764 dias de rota de vendedores de varejo, uso do Jota, mensagens por dia), pesquisa em fontes do setor (fontes no fim). Nenhum número estimado.

## 1. Conclusão
**Sim, a proposta é a certa** — e os dados mostram três ajustes que a tornam mais forte:
1. **O momento deve ser escolhido pelo estado da rota, não só pelo relógio.** Metade dos vendedores termina a rota depois das 16h07 e 10% antes das 11h38. Um "fechamento do dia" às 15h30 chegaria para metade deles com a rota pela metade.
2. **Começar com um piloto de ~25 vendedores por 1 semana**, medindo se os 5 clientes de foco viram pedido. O WhatsApp do Jota é uma conexão não oficial (aparelho vinculado); 248 vendedores × 3 momentos seriam ~750 conversas/dia, **1,5× o dia mais movimentado que já tivemos (506 recebidas em 09/11)**, e a conta foi restringida em 10/11.
3. **O momento do meio do dia só pode sair quando o digitado e o check-in estiverem em tempo real** (correção em andamento hoje; ver `AUDITORIA_DADOS_2026-11-11.md`). Número errado no primeiro dia mata a confiança.

## 2. A rotina real do vendedor (medida)
1.764 dias de rota de vendedores de varejo, 6 dias úteis (03 a 06/11, 09 e 10/11), roteiro gravado no D1:

| Medida | Mediana | Faixa (10% a 90%) |
|---|---|---|
| Clientes na rota | **12** | 9 a 17 (25% a 75%) |
| Clientes visitados (check-in) | **10** | — |
| 1º check-in | **08h36** | 07h42 a 10h27 |
| Último check-out | **16h07** | 11h38 a 17h59 |
| Tempo em rota | **7h05** | — |
| Tempo por visita | **9 min** | até 35 min |

**Check-ins por hora** (todas as visitas): 07h 2% · 08h 11% · 09h 26% · 10h 42% · **11h 54%** · 12h 59% (queda do almoço) · 13h 67% · 14h 78% · 15h 88% · 16h 95% · 17h 99%.
→ Às 12h o vendedor já fez **mais da metade** das visitas; a tarde tem um 2º pico às 14h.

**Clientes de foco:** em **92%** dos dias há 5 ou mais clientes da rota sem compra no mês. Só em **11%** há 5 ou mais com a TAG recorrência — a regra do diretor (completar com "mais tempo sem compra") é necessária, não opcional. Mediana por rota: 12 sem compra no mês, 2 com TAG recorrência, 1 com outra TAG.

## 3. Como o Jota é usado hoje (medido)
| | Vendedores | Supervisores |
|---|---|---|
| Cadastrados | 248 | 66 |
| Já escreveram | 125 (50%) | 64 (97%) |
| Escreveram nos últimos 7 dias | 118 | 30 |
| Dias de uso (mediana) | **1** | **5** |
| Escreveram em 3 dias ou mais | 13 | 47 |
| Horários de pico | 8h, 13h–14h | **7h–8h, 14h, 16h–18h** |

- **O vendedor ainda não criou o hábito**: a maioria escreveu só no dia do cadastro. Um menu de 16 itens não cria hábito; uma resposta útil a um "bom dia" pode criar.
- **O supervisor já vive nos 3 momentos** (7h–8h, 14h, 16h–18h): exatamente os horários da proposta.
- **No menu, o item mais escolhido pelo vendedor é o 5 — clientes sem compra (29 vezes)**, depois "como estou" (12) e a Liga (8). Ou seja: o vendedor quer saber **com quem falar** e **como está** — o conteúdo do "bom dia".
- **O que os vendedores pediram no cadastro** (134 pedidos): comissão/RV (50 — dado que o Jota não tem; precisa ser dito com clareza), clientes sem compra, status do pedido, positivação, meta, mix.

## 4. O que o setor faz (pesquisa)
- **"Próxima melhor ação" para vendedor de campo** é o padrão em bens de consumo: a ferramenta diz, cliente a cliente, o que fazer hoje. Resultados publicados (de fornecedores, autodeclarados): +5 lojas visitadas por dia em CPG (MathCo); +14% de vendas em quem seguiu as sugestões, 2 a 6,5% atribuídos diretamente a elas (Aktana, farma); 5 a 8% de receita em programas de IA de "próxima melhor experiência" (McKinsey, B2B).
- **Poucas prioridades**: a Bain recomenda focar nos poucos "alavancas" de maior impacto e dar ao vendedor instruções claras **loja a loja** ("Perfect Store") — o equivalente aos 5 clientes de foco.
- **Rotina de início e fim do dia** (prática de gestão de vendas): reunião curta de manhã (até 15 min) com o plano; revisão no fim do dia começando pelo que deu certo. Não há estudo controlado sobre horário; é prática consagrada.
- **Mensagem que funciona é curta, no momento certo e relevante** (IQVIA, ciência comportamental para força de campo): recomendação empurrada sem contexto não é adotada.
- **Risco do canal**: conexões não oficiais (QR code / aparelho vinculado, como a Evolution) violam os termos do WhatsApp e podem ser restringidas sem aviso; o que reduz o risco é parecer conversa humana: **o vendedor escreve primeiro**, troca equilibrada (recebe ≈ envia), variar o texto, crescer aos poucos. A rota sem esse risco é a plataforma oficial (Cloud API), que tem custo por mensagem — **preços oficiais da Meta não puderam ser confirmados hoje** (página fora do ar para leitura); vários sites dizem que desde 01/10/2026 as respostas dentro da janela de 24 h passaram a ser cobradas.

## 5. Desenho recomendado
### 5.1 Qual momento responde: o estado da rota decide
| Momento | Quando responde | Por quê |
|---|---|---|
| ☀️ **Plano do dia** | rota ainda não começou **ou** antes das 11h com menos de 40% visitado | 1º check-in 08h36; 42% das visitas até as 11h |
| 🍽️ **Meio do dia** | rota em andamento (40% a 90% visitado) **ou** entre 11h e o fim da rota | almoço às 12h; 2º pico às 14h |
| 🌙 **Fechamento** | rota terminada (90%+ visitado ou último cliente com check-out) **ou** depois das 17h | último check-out 16h07 (mediana) |

### 5.2 Conteúdo (máximo ~10 linhas, 1 ação)
- ☀️ **Plano do dia**: 4 linhas de indicadores (faturamento x meta, positivação, mix do CEVEN, recorrência do GEROT) + **5 clientes de foco da rota de hoje** (nome · dias sem compra · 1 produto do +MIX) + "Escreva *mais*".
- 🍽️ **Meio do dia**: manhã (visitas, pedidos, R$) · **quantos dos 5 de foco já compraram** · o que falta para a tarde (clientes que faltam na rota; quanto precisa vender hoje para o ritmo da meta).
- 🌙 **Fechamento**: visitou X de Y · tempo em rota · positivou N · vendeu R$ · compraram do +MIX · **N dos 5 de foco viraram pedido** · pontos da Liga hoje.

### 5.3 Cada dado tem fonte e frescor (D1)
| Dado | Fonte | Frescor hoje | Pronto para |
|---|---|---|---|
| Faturamento x meta, positivação | dashboard do CEVEN | 2 min ✅ | todos |
| Mix do mês | produtividade do CEVEN (`mix_mes`) | diário ✅ | plano |
| Recorrência (meta 80%) | GEROT (lista do dia 1º) | 07h15 em diante ✅ | plano |
| Rota de hoje, TAGs | roteiro do dia | pronta à meia-noite ✅ | plano |
| "Sem compra no mês" | pedidos gravados + ficha | ficha destravada hoje ✅ | plano |
| Digitado / pedidos de hoje | pedidos gravados (Winthor + histórico) | **em correção hoje** ⚠️ | meio e fechamento |
| Check-in / visitas | roteiro (rodízio) + rota do gerente | **rodízio ~30 min** ⚠️ | meio e fechamento |
| Compraram do +MIX | itens do pedido de hoje | parcial ⚠️ | fechamento |
| Pontos da Liga | lances do dia | 5 min ✅ | fechamento |

## 6. Como medir se funciona (piloto)
- **Quem**: ~25 vendedores — Tamara (TCV 352), Giovana (TBL 181) e as equipes do Victor Hugo (TSJ, 9) e do Sérgio (TBL), mais 1 equipe de outra filial. **1 semana.**
- **Indicador principal**: dos 5 clientes de foco, **quantos viraram pedido no dia** — comparado com clientes parecidos (mesma rota, sem compra no mês) dos vendedores fora do piloto.
- **Adoção**: % de dias em que o vendedor cumprimentou o Jota; quantos pediram "mais".
- **Canal**: recebidas ≈ enviadas; nenhum aviso de restrição.
- **Decisão no fim da semana**: liberar para todos, ajustar, ou parar.

## 7. O que precisa ser decidido
1. Aprovar o piloto (quem e quando começa).
2. Momento pelo **estado da rota** (recomendado) ou só pelo relógio.
3. Definições únicas: **mix = CEVEN** (produtos diferentes por cliente no mês) e **recorrência = GEROT** (lista do dia 1º, meta 80%).
4. O que responder sobre **comissão** (pedido nº 1 dos vendedores): hoje o Jota não tem o valor em R$.
5. Médio prazo: avaliar a **plataforma oficial do WhatsApp** (sem risco de restrição, com custo por mensagem) se o uso crescer para os 248 vendedores.

## Fontes
- MathCo — Next Best Action para vendedor de CPG: https://mathco.com/casestudies/enhancing-sales-effectiveness-through-next-best-action/
- PharmaForceIQ/Aktana — ativação de next best action: https://pharmaforceiq.com/biopharma-sales-case-study-next-best-action-activation/
- McKinsey — o futuro das vendas B2B com IA: https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/the-future-of-b2b-sales-how-growth-champions-rewire-their-playbooks-with-ai
- Bain — analytics transformando a execução de vendas (Perfect Store): https://www.bain.com/insights/how-advanced-analytics-is-transforming-sales-execution/
- IQVIA — ciência comportamental para performance de campo: https://www.iqvia.com/-/media/iqvia/pdfs/library/white-papers/iqvia-behavioral-sciences-white-paper.pdf
- Close — sales huddle: https://www.close.com/blog/sales-huddle · Center for Sales Strategy — coaching: https://blog.thecenterforsalesstrategy.com/a-step-by-step-guide-to-coaching-salespeople
- Z-API — boas práticas contra bloqueio: https://developer.z-api.io/en/tips/best-practices · Periskope — boas práticas: https://docs.periskope.app/get-started/best-practices
- Evolution API x Cloud API: https://pasqualepillitteri.it/pt/news/12976/integrar-whatsapp-evolution-api-cloud-api-meta
- Preço do WhatsApp (terceiros; não confirmado na Meta): https://www.courier.com/blog/whatsapp-pricing-changes-october-2026 · https://www.ycloud.com/blog/whatsapp-service-messages-24-hour-window-pricing

## 8. Decisões e entrega (11/11/2026)
- **Todos os vendedores desde o início** (Vitório): o vendedor fala primeiro; o Jota só responde quem pediu acesso pelo link (sem cadastro = nenhuma mensagem; pendente = 1 aviso por dia).
- **Proteções**: chave `config_flags.jota_momentos` (`off` = volta à saudação/menu, sem publicar); **vigia** na varredura (enviadas > 1,6× recebidas na última hora com 40+ enviadas, ou 10+ erros em 30 min → desliga e grava o motivo em `jota_momentos_motivo`); digitação humana 3 a 12 s (±20%) e pausa de 18 s+ entre mensagens.
- **Figurinha só para comemorar** (plano: dia alternado; meio: ritmo do dia batido; fechamento: 3+ clientes de foco viraram pedido).
- **8 versões** de abertura e de fechamento por momento, trocando a cada dia para o mesmo vendedor.
- **Dados**: % de faturamento = (faturado + a faturar) / meta, igual ao CEVEN; visitas = check-in individual **ou** rota do gerente; digitado = pedidos gravados; recorrência = GEROT por pasta (`gerot_recorrencia_pasta`, chave com o supervisor: o mesmo vendedor pode ter 2 pastas).
- Código: `functions/_lib/jota/respostas/momentos.js`; auditoria em `auditoria/<vendedor>/M - plano|meio|fechamento.md`.
