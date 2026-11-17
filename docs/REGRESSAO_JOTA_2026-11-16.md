# Regressão do JOTA — 2026-11-16 (rapido)

Gerado por `node testes/jota_regressao.mjs --rapido` em 16/11/2026, 22:31:26 · código a3dee77b + alterações locais em functions/ · duração 3.6 min.
Régua: `testes/jota_regua.mjs` (regras em `docs/REGUA_QUALIDADE_JOTA.md`). O JOTA atual roda em modo seco contra o D1 de produção só leitura; histórico da conversa como estava na pergunta original, dados de agora; sem IA.

## Resumo

| Conjunto | Respostas | Com violação bloqueante | Com qualquer violação |
|---|---:|---:|---:|
| Casos-chave (JOTA atual) | 10 | 5 | 5 |
| Amostra de perguntas reais (JOTA atual) | 0 | 0 (—) | 0 (—) |
| Respostas que saíram em 2026-11-16 (produção, todas) | 446 | 283 (63%) | 319 (72%) |

## Casos-chave do diretor

| # | Quem | Pergunta | Resultado | Violações |
|---|---|---|---|---|
| K01 | Vitorio (diretoria) | Venda Tamara TCV hoje | ✅ aprovado |  |
| K02 | Vitorio (diretoria) | Quanto a Tamara de TCV vendeu hoje | ✅ aprovado |  |
| K03 | Vitorio (diretoria) | Curva Negativa vendedora Tamara TCV | ❌ REPROVADO | R02 NOTA_TECNICA: …Tradic Bg Hemmer (2 clientes) 🕒 Fontes: mês GEROT 16/11/2026 · hoje … · R06 ASSUNTO_ERRADO: assunto "curva_negativa" esperado; resposta começa com "🧑‍💼 352 - Tamara Guedes — TCV · sup. 543 - Vago Gabriel · VJ" · R15 VAGO_NO_NOME: …ara Guedes — TCV · sup. 543 - Vago Gabriel · VJ 💰 Faturado: R$ … · R24 EXPECTATIVA_DO_CASO: deveria listar os clientes sem compra no mês |
| K04 | Vitorio (diretoria) | Curva negativa Vendedora 10 de TSJ | ❌ REPROVADO | R02 NOTA_TECNICA: …s) · 5. Tang Uva (2 clientes) 🕒 Fontes: mês GEROT 16/11/2026 · hoje … · R06 ASSUNTO_ERRADO: assunto "curva_negativa" esperado; resposta começa com "🧑‍💼 10 - Fernanda Ferreira Barros — TSJ · sup. 63 - Ana Yamato · VJ" · R24 EXPECTATIVA_DO_CASO: devolveu outra coisa (ficha) em vez da lista de clientes sem compra no mês · R24 EXPECTATIVA_DO_CASO: deveria listar os clientes sem compra no mês |
| K05 | Renan Lechuk (vendedor TPH 128) | Quais clientes posso positivar na recorrência ainda? | ❌ REPROVADO | R02 NOTA_TECNICA: …enan: 🎯 Meta de recorrência (GEROT): objetivo 39 clientes · meta… · R07 LISTA_PEDIDA_SEM_LISTA: pediu quais clientes e não veio nenhum cliente · R08 NEGATIVA_CONTRADITORIA: "nenhum cliente com a tag recorrencia no roteiro (hoje e no mes)" mas a própria resposta diz "faltam 18" · R12 SEM_ACAO_FINAL: sem ação no fim · R24 EXPECTATIVA_DO_CASO: deveria listar os clientes da lista de recorrência ainda não positivados · R24 EXPECTATIVA_DO_CASO: resposta negativa pela tag do roteiro, sem consultar a lista de recorrência |
| K06 | Alex Sandro Soares Elias (supervisor TBE) | Atualiza os números de hoje do meu time | ✅ aprovado |  |
| K07 | Jonathan Fernandes (supervisor TPH) | status do pedido 1038000485 | ❌ REPROVADO | R02 NOTA_TECNICA: … · R$ 19.166 Status da última conferência de cada pedido (hora ao lado) · 0 de 35 conf… · R06 ASSUNTO_ERRADO: pediu o pedido 1038000485; a resposta não fala desse pedido · R16 TEXTO_LONGO: 50 linhas · R24 EXPECTATIVA_DO_CASO: deveria responder o pedido 1038000485 · R24 EXPECTATIVA_DO_CASO: lista genérica de pendentes em vez do pedido |
| K08 | Sueli Aparecida Teixeira Polli (supervisor API) | Karina já vendeu hoje | ❌ REPROVADO | R24 EXPECTATIVA_DO_CASO: deveria abrir pela Karina · R24 EXPECTATIVA_DO_CASO: respondeu a equipe inteira em vez da Karina |
| K09 | Luis Thiago Virtuoso Boeira (supervisor TBE) | Fechamento | ✅ aprovado |  |
| K10 | Luis Thiago Virtuoso Boeira (supervisor TBE) | Fechamento do dia 16/11/2026 | ✅ aprovado |  |

## Taxa de reprovação por regra

| Regra | Severidade | JOTA atual (todos os casos rodados, n=10) | Amostra real (n=0) | Produção do dia (n=446) |
|---|---|---:|---:|---:|
| R01 FONTE_CEVEN | bloqueia | 0 (0%) | 0 (—) | 114 (26%) |
| R02 NOTA_TECNICA | alerta | 4 (40%) | 0 (—) | 183 (41%) |
| R03 ZERO_SEM_LEITURA | bloqueia | 0 (0%) | 0 (—) | 101 (23%) |
| R04 ROTA_ZERO | bloqueia | 0 (0%) | 0 (—) | 42 (9%) |
| R05 PERIODO_TROCADO | bloqueia | 0 (0%) | 0 (—) | 13 (3%) |
| R06 ASSUNTO_ERRADO | bloqueia | 3 (30%) | 0 (—) | 29 (7%) |
| R07 LISTA_PEDIDA_SEM_LISTA | bloqueia | 1 (10%) | 0 (—) | 4 (1%) |
| R08 NEGATIVA_CONTRADITORIA | bloqueia | 1 (10%) | 0 (—) | 4 (1%) |
| R09 CONTESTACAO_COM_CARD | bloqueia | 0 (0%) | 0 (—) | 16 (4%) |
| R10 NUMERO_COMO_NOTA | bloqueia | 0 (0%) | 0 (—) | 8 (2%) |
| R11 DUAS_CONTAS | bloqueia | 0 (0%) | 0 (—) | 1 (0%) |
| R12 SEM_ACAO_FINAL | alerta | 1 (10%) | 0 (—) | 18 (4%) |
| R13 SEM_DADO_ATENDIVEL | bloqueia | 0 (0%) | 0 (—) | 8 (2%) |
| R14 SEM_RESPOSTA | bloqueia | 0 (0%) | 0 (—) | 20 (4%) |
| R15 VAGO_NO_NOME | bloqueia | 1 (10%) | 0 (—) | 11 (2%) |
| R16 TEXTO_LONGO | alerta | 1 (10%) | 0 (—) | 17 (4%) |
| R17 INDICADOR_VAZIO | bloqueia | 0 (0%) | 0 (—) | 12 (3%) |
| R18 PLURAL_ERRADO | bloqueia | 0 (0%) | 0 (—) | 3 (1%) |
| R19 SUGESTAO_CONTRADIZ | bloqueia | 0 (0%) | 0 (—) | 1 (0%) |
| R20 EQUIPE_SEM_VENDEDOR | bloqueia | 0 (0%) | 0 (—) | 3 (1%) |
| R21 ONTEM_DOMINGO | bloqueia | 0 (0%) | 0 (—) | 24 (5%) |
| R22 FATURADO_NEGATIVO | alerta | 0 (0%) | 0 (—) | 5 (1%) |
| R23 IA_GENERICA | alerta | 0 (0%) | 0 (—) | 3 (1%) |
| R24 EXPECTATIVA_DO_CASO | bloqueia | 5 (50%) | 0 (—) | 0 (0%) |

## Piores casos (JOTA atual)

### 1. K05 · Renan Lechuk (vendedor TPH 128) — "Quais clientes posso positivar na recorrência ainda?"

- **R02 NOTA_TECNICA** (alerta): …enan: 🎯 Meta de recorrência (GEROT): objetivo 39 clientes · meta…
- **R07 LISTA_PEDIDA_SEM_LISTA** (bloqueia): pediu quais clientes e não veio nenhum cliente
- **R08 NEGATIVA_CONTRADITORIA** (bloqueia): "nenhum cliente com a tag recorrencia no roteiro (hoje e no mes)" mas a própria resposta diz "faltam 18"
- **R12 SEM_ACAO_FINAL** (alerta): sem ação no fim
- **R24 EXPECTATIVA_DO_CASO** (bloqueia): deveria listar os clientes da lista de recorrência ainda não positivados
- **R24 EXPECTATIVA_DO_CASO** (bloqueia): resposta negativa pela tag do roteiro, sem consultar a lista de recorrência

```
Olha os números aí, Renan:

🎯 *Meta de recorrência (GEROT)*: objetivo *39* clientes · meta 80% = *30* · positivados *12* (40,0% da meta · faltam *18*) · R$ 7.750
_Lista do dia 1º do GEROT: clientes com compra de 31 a 90 dias e nenhuma nos 30 dias antes do dia 1º._

🔄 128 - Renan Lechuk (varejo): nenhum cliente com a tag *Recorrência* no roteiro (hoje e no mês).

*0* Voltar ao menu

_🟢 Hoje (Clube da Venda · 22:25): pedidos colocados._

_Essa resposta ajudou? Responda 👍 ou 👎 · ou escreva *sugestão:* e o que melhorar_
```

### 2. K07 · Jonathan Fernandes (supervisor TPH) — "status do pedido 1038000485"

- **R02 NOTA_TECNICA** (alerta): … · R$ 19.166 Status da última conferência de cada pedido (hora ao lado) · 0 de 35 conf…
- **R06 ASSUNTO_ERRADO** (bloqueia): pediu o pedido 1038000485; a resposta não fala desse pedido
- **R16 TEXTO_LONGO** (alerta): 50 linhas
- **R24 EXPECTATIVA_DO_CASO** (bloqueia): deveria responder o pedido 1038000485
- **R24 EXPECTATIVA_DO_CASO** (bloqueia): lista genérica de pendentes em vez do pedido

```
Aqui está, Jonathan:

💼 *Clientes com Pedidos Pendentes de Faturamento (Liberados) — Equipe Jonathan Fernandes (TPH)*
Total: *35 pedido(s)* · *R$ 19.166*
_Status da última conferência de cada pedido (hora ao lado) · 0 de 35 conferidos na última hora._

*124 - Thaciane Castro (varejo)* — 7 pedido(s)
• Pedido 124000824 (13/11) · cliente #76183 · *R$ 1.226* · LIBERADO _(lido 01:04)_
• Pedido 124000825 (13/11) · cliente #338887 · *R$ 186* · LIBERADO _(lido 01:04)_
• Pedido 124000828 (13/11) · cliente #337825 · *R$ 138* · LIBERADO _(lido 01:04)_
• Pedido 124000827 (13/11) · cliente #316804 · *R$ 109* · LIBERADO _(lido 01:04)_
• Pedido 124000794 (10/11) · cliente #339018 · *R$ 356* · LIBERADO _(lido 01:04)_
• Pedido 124000792 (10/11) · cliente #334882 · *R$ 513* · LIBERADO _(lido 01:04)_
• Pedido 124000793 (10/11) · cliente #316099 · *R$ 1.642* · LIBERADO _(lido 01:04)_
*1039 - Marcelo Garrett (varejo)* — 7 pedido(s)
• Pedido 1039000630 (13/11) · cliente #392451 · *R$ 350* · LIBERADO
• Pedido 1039000636 (13/11) · cliente #325697 · *R$ 157* · LIBERADO
• Pedido 1039000631 (13/11) · cliente #325697 · *R$ 171* · LIBERADO
• Pedido 1039000632 (13/11) · cliente #325697 · *R$ 15* · LIBERADO
• Pedido 1039000638 (13/11) · cliente #320953 · *R$ 100* · LIBERADO
• Pedido 1039000634 (13/11) · cliente #320176 · *R$ 130* · LIBERADO
• Pedido 1039000627 (12/11) · cliente #335325 · *R$ 193* · LIBERADO…
```

### 3. K03 · Vitorio (diretoria) — "Curva Negativa vendedora Tamara TCV"

- **R02 NOTA_TECNICA** (alerta): …Tradic Bg Hemmer (2 clientes) 🕒 Fontes: mês GEROT 16/11/2026 · hoje …
- **R06 ASSUNTO_ERRADO** (bloqueia): assunto "curva_negativa" esperado; resposta começa com "🧑‍💼 352 - Tamara Guedes — TCV · sup. 543 - Vago Gabriel · VJ"
- **R15 VAGO_NO_NOME** (bloqueia): …ara Guedes — TCV · sup. 543 - Vago Gabriel · VJ 💰 Faturado: R$ …
- **R24 EXPECTATIVA_DO_CASO** (bloqueia): deveria listar os clientes sem compra no mês

```
Seguem os dados, Vitorio:

🧑‍💼 *352 - Tamara Guedes* — TCV · sup. 543 - Vago Gabriel · VJ
💰 Faturado: *R$ 29.885* + pendente R$ 5.483 de R$ 93.000 → *38,0%* da meta
🎯 Falta: R$ 57.633 · R$ 5.763 por dia útil (10 dias)
👥 Positivação: 50 de 99 (50,5%) · faltam 49 clientes
📝 Hoje: R$ 1.569 em 4 pedidos · ticket R$ 392 · visitas 10 de 10 · com venda 4
↩️ Devolução no mês: R$ 475
🏆 Liga: 87º no Brasil · 18º na filial · 36 pts (11V 3E 9D)
📲 *Uso do +MIX:* 1 de 11 clientes compraram produto novo da lista do +MIX (*9,1%*)
⭐ *Mais vendidos no mês* (nº de clientes que compraram): 1. Ch Tortug Huevitos (4 clientes) · 2. Turron Many (3 clientes) · 3. Pepino Burger Agridoce Vd Hemme (3 clientes) · 4. Tabl Rech Avela Choco Block (3 clientes) · 5. Tabl Choco Amendoim Block (3 clientes)
🆕 *Produtos novos nos clientes* (não compravam há mais de 60 dias): 1. Ch Tortug Huevitos (3 clientes) · 2. Bisc Tortug Rech Baunilha (2 clientes) · 3. Pepino Burger Agridoce Vd Hemme (2 clientes) · 4. Pir Plut Expl Melancia (2 clientes) · 5. Maionese Tradic Bg Hemmer (2 clientes)
🕒 Fontes: mês GEROT 16/11/2026 · hoje Clube 22:25

👉 *Amanhã cedo:* ligar para *Restaurante Boia Da Roca Ltda* (39 dias sem comprar) e marcar o pedido.
_👤 Igual ao que 352 - Tamara Guedes (varejo) vê no item 5 do menu dele · mande *menu* para voltar ao seu_

_🟢 Hoje (Clube da Venda · 22:25): pedidos colocados._

_Essa res…
```

### 4. K04 · Vitorio (diretoria) — "Curva negativa Vendedora 10 de TSJ"

- **R02 NOTA_TECNICA** (alerta): …s) · 5. Tang Uva (2 clientes) 🕒 Fontes: mês GEROT 16/11/2026 · hoje …
- **R06 ASSUNTO_ERRADO** (bloqueia): assunto "curva_negativa" esperado; resposta começa com "🧑‍💼 10 - Fernanda Ferreira Barros — TSJ · sup. 63 - Ana Yamato · VJ"
- **R24 EXPECTATIVA_DO_CASO** (bloqueia): devolveu outra coisa (ficha) em vez da lista de clientes sem compra no mês
- **R24 EXPECTATIVA_DO_CASO** (bloqueia): deveria listar os clientes sem compra no mês

```
Seguem os dados, Vitorio:

🧑‍💼 *10 - Fernanda Ferreira Barros* — TSJ · sup. 63 - Ana Yamato · VJ
💰 Faturado: *R$ 76.534* + pendente R$ 16.036 de R$ 180.000 → *51,4%* da meta
🎯 Falta: R$ 87.430 · R$ 8.743 por dia útil (10 dias)
👥 Positivação: 90 de 104 (86,5%) · faltam 14 clientes
📝 Hoje: R$ 13.201 em 11 pedidos · ticket R$ 1.200 · visitas 15 de 15 · com venda 10
↩️ Devolução no mês: R$ 200
📅 Rota do mês: 122 de 137 visitas (89,1%)
🏆 Liga: 2º no Brasil · 1º na filial · 70 pts (20V 1E 2D)
📲 *Uso do +MIX:* 0 de 8 clientes compraram produto novo da lista do +MIX (*0,0%*)
⭐ *Mais vendidos no mês* (nº de clientes que compraram): 1. Trident Hortela (5 clientes) · 2. Trident Menta (5 clientes) · 3. Trident Melancia (5 clientes) · 4. Halls Extra Forte (4 clientes) · 5. Bis Ao Leite Multipack 3x (3 clientes)
🆕 *Produtos novos nos clientes* (não compravam há mais de 60 dias): 1. Halls Extra Forte (3 clientes) · 2. Trident Canela New (2 clientes) · 3. Trident Morango (2 clientes) · 4. Tang Laranja Docinha (2 clientes) · 5. Tang Uva (2 clientes)
🕒 Fontes: mês GEROT 16/11/2026 · hoje Clube 22:25
📌 *Faltam 14 positivações:* *7* na rota de hoje e *10* já visitados no mês ainda sem compra. Peça *"ver mais"* para ver a lista de clientes.

👉 *Amanhã cedo:* ligar para *Armazem Da Pousada* (47 dias sem comprar) e marcar o pedido.
_👤 Igual ao que 10 - Fernanda Barros (varejo) vê no ite…
```

### 5. K08 · Sueli Aparecida Teixeira Polli (supervisor API) — "Karina já vendeu hoje"

- **R24 EXPECTATIVA_DO_CASO** (bloqueia): deveria abrir pela Karina
- **R24 EXPECTATIVA_DO_CASO** (bloqueia): respondeu a equipe inteira em vez da Karina

```
Na mão, Sueli:

📋 *Dia da Equipe Sueli Polli (API)* (16/11)
💰 Digitado hoje: *R$ 31.169* em *24 pedidos*
🚶 Visitas da rota: *41 de 41* feitas

• ✅ *249 - Edinei Specht (varejo)*: R$ 18.609 · 15 ped. · 17/17 visitas (12 com venda) · 0 sem compra no mês
• ✅ *1200 - Karina Silva (varejo)*: R$ 6.632 · 5 ped. · 12/12 visitas (5 com venda) · 11 sem compra no mês
• ✅ *529 - Paola Franco (varejo)*: R$ 5.526 · 3 ped. · 9/9 visitas (3 com venda) · 0 sem compra no mês
• ✅ *1074 - Felipe Cardoso (varejo)*: R$ 401 · 1 ped. · 3/3 visitas (0 com venda) · 0 sem compra no mês

_Legenda: ⚠️ rota e sem pedido · ✅ pedido digitado · ◻️ sem pedido_
🎯 *Sugestão do Jota:* Para abrir um vendedor, mande o *nome* ou o *código* (ex.: "clientes 352"); para o *+MIX* da rota dele, depois mande "+mix"; para receber *cada vendedor em uma mensagem*, mande "um por um".

*0* Voltar ao menu

_🟢 Hoje (Clube da Venda · 22:25): pedidos colocados._

_Essa resposta ajudou? Responda 👍 ou 👎 · ou escreva *sugestão:* e o que melhorar_
```

## Todos os casos rodados

| Caso | Quem | Pergunta | s | Violações (atual) | Violações (resposta que saiu) |
|---|---|---|---:|---|---|
| K01 | Vitorio (diretoria) | Venda Tamara TCV hoje | 90 | ✅ | R01 R02 R05 R15 R24 |
| K02 | Vitorio (diretoria) | Quanto a Tamara de TCV vendeu hoje | 90 | ✅ | R01 R02 R05 R15 R24 |
| K03 | Vitorio (diretoria) | Curva Negativa vendedora Tamara TCV | 87 | R02 R06 R15 R24 | R06 R12 R13 R24 R24 R24 |
| K04 | Vitorio (diretoria) | Curva negativa Vendedora 10 de TSJ | 68 | R02 R06 R24 R24 | R02 R06 R24 R24 |
| K05 | Renan Lechuk (vendedor TPH 128) | Quais clientes posso positivar na recorrência ainda? | 59 | R02 R07 R08 R12 R24 R24 | R02 R07 R08 R12 R24 R24 |
| K06 | Alex Sandro Soares Elias (supervisor TBE) | Atualiza os números de hoje do meu time | 55 | ✅ | ✅ |
| K07 | Jonathan Fernandes (supervisor TPH) | status do pedido 1038000485 | 25 | R02 R06 R16 R24 R24 | R02 R06 R16 R24 R24 |
| K08 | Sueli Aparecida Teixeira Polli (supervisor API) | Karina já vendeu hoje | 59 | R24 R24 | R03 R24 R24 |
| K09 | Luis Thiago Virtuoso Boeira (supervisor TBE) | Fechamento | 43 | ✅ | R17 R18 R19 R20 R24 |
| K10 | Luis Thiago Virtuoso Boeira (supervisor TBE) | Fechamento do dia 16/11/2026 | 2 | ✅ | R17 R18 R19 R20 R24 R24 R24 |

## Piores respostas que saíram no dia (produção)

- **Washington Flores Da Rosa (supervisor API)** — "Vendedora fez check-in antes das 10hs. Informação recebida dr não checkin não pr…": R01 FONTE_CEVEN, R02 NOTA_TECNICA, R03 ZERO_SEM_LEITURA, R09 CONTESTACAO_COM_CARD, R17 INDICADOR_VAZIO
- **Washington Flores Da Rosa (supervisor API)** — "Informação sobre varejo rota incorreto": R01 FONTE_CEVEN, R02 NOTA_TECNICA, R03 ZERO_SEM_LEITURA, R09 CONTESTACAO_COM_CARD, R17 INDICADOR_VAZIO
- **Gessandro Sperotto (supervisor TCV)** — "3.761,24 venda": R01 FONTE_CEVEN, R02 NOTA_TECNICA, R03 ZERO_SEM_LEITURA, R09 CONTESTACAO_COM_CARD, R17 INDICADOR_VAZIO
- **Tiago Martines Otaviano (supervisor MCD)** — "Alcindo ja havia realizado Check-in, favor verificar": R01 FONTE_CEVEN, R02 NOTA_TECNICA, R03 ZERO_SEM_LEITURA, R09 CONTESTACAO_COM_CARD, R17 INDICADOR_VAZIO
- **Aleksandro Rodrigo De Faria (vendedor ABC 224)** — "Quais clientes ainda nao positivado no giro de hoje": R05 PERIODO_TROCADO, R06 ASSUNTO_ERRADO, R07 LISTA_PEDIDA_SEM_LISTA, R13 SEM_DADO_ATENDIVEL
