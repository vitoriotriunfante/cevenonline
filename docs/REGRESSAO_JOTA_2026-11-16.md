# Regressão do JOTA — 2026-11-16 (rapido)

Gerado por `node testes/jota_regressao.mjs --rapido` em 16/11/2026, 22:42:39 · código 475f9f6f + alterações locais em functions/ · duração 1.0 min.
Régua: `testes/jota_regua.mjs` (regras em `docs/REGUA_QUALIDADE_JOTA.md`). O JOTA atual roda em modo seco contra o D1 de produção só leitura; histórico da conversa como estava na pergunta original, dados de agora; sem IA.

## Resumo

| Conjunto | Respostas | Com violação bloqueante | Com qualquer violação |
|---|---:|---:|---:|
| Casos-chave (JOTA atual) | 10 | 2 | 2 |
| Amostra de perguntas reais (JOTA atual) | 0 | 0 (—) | 0 (—) |
| Respostas que saíram em 2026-11-16 (produção, todas) | 446 | 283 (63%) | 319 (72%) |

## Casos-chave do diretor

| # | Quem | Pergunta | Resultado | Violações |
|---|---|---|---|---|
| K01 | Vitorio (diretoria) | Venda Tamara TCV hoje | ✅ aprovado |  |
| K02 | Vitorio (diretoria) | Quanto a Tamara de TCV vendeu hoje | ✅ aprovado |  |
| K03 | Vitorio (diretoria) | Curva Negativa vendedora Tamara TCV | ✅ aprovado |  |
| K04 | Vitorio (diretoria) | Curva negativa Vendedora 10 de TSJ | ✅ aprovado |  |
| K05 | Renan Lechuk (vendedor TPH 128) | Quais clientes posso positivar na recorrência ainda? | ❌ REPROVADO | R02 NOTA_TECNICA: …enan: 🎯 Meta de recorrência (GEROT): objetivo 39 clientes · meta… · R07 LISTA_PEDIDA_SEM_LISTA: pediu quais clientes e não veio nenhum cliente · R08 NEGATIVA_CONTRADITORIA: "nenhum cliente com a tag recorrencia no roteiro (hoje e no mes)" mas a própria resposta diz "faltam 18" · R12 SEM_ACAO_FINAL: sem ação no fim · R24 EXPECTATIVA_DO_CASO: deveria listar os clientes da lista de recorrência ainda não positivados · R24 EXPECTATIVA_DO_CASO: resposta negativa pela tag do roteiro, sem consultar a lista de recorrência |
| K06 | Alex Sandro Soares Elias (supervisor TBE) | Atualiza os números de hoje do meu time | ✅ aprovado |  |
| K07 | Jonathan Fernandes (supervisor TPH) | status do pedido 1038000485 | ❌ REPROVADO | R13 SEM_DADO_ATENDIVEL: "nao achei" |
| K08 | Sueli Aparecida Teixeira Polli (supervisor API) | Karina já vendeu hoje | ✅ aprovado |  |
| K09 | Luis Thiago Virtuoso Boeira (supervisor TBE) | Fechamento | ✅ aprovado |  |
| K10 | Luis Thiago Virtuoso Boeira (supervisor TBE) | Fechamento do dia 16/11/2026 | ✅ aprovado |  |

## Taxa de reprovação por regra

| Regra | Severidade | JOTA atual (todos os casos rodados, n=10) | Amostra real (n=0) | Produção do dia (n=446) |
|---|---|---:|---:|---:|
| R01 FONTE_CEVEN | bloqueia | 0 (0%) | 0 (—) | 114 (26%) |
| R02 NOTA_TECNICA | alerta | 1 (10%) | 0 (—) | 183 (41%) |
| R03 ZERO_SEM_LEITURA | bloqueia | 0 (0%) | 0 (—) | 101 (23%) |
| R04 ROTA_ZERO | bloqueia | 0 (0%) | 0 (—) | 42 (9%) |
| R05 PERIODO_TROCADO | bloqueia | 0 (0%) | 0 (—) | 13 (3%) |
| R06 ASSUNTO_ERRADO | bloqueia | 0 (0%) | 0 (—) | 29 (7%) |
| R07 LISTA_PEDIDA_SEM_LISTA | bloqueia | 1 (10%) | 0 (—) | 4 (1%) |
| R08 NEGATIVA_CONTRADITORIA | bloqueia | 1 (10%) | 0 (—) | 4 (1%) |
| R09 CONTESTACAO_COM_CARD | bloqueia | 0 (0%) | 0 (—) | 16 (4%) |
| R10 NUMERO_COMO_NOTA | bloqueia | 0 (0%) | 0 (—) | 8 (2%) |
| R11 DUAS_CONTAS | bloqueia | 0 (0%) | 0 (—) | 1 (0%) |
| R12 SEM_ACAO_FINAL | alerta | 1 (10%) | 0 (—) | 18 (4%) |
| R13 SEM_DADO_ATENDIVEL | bloqueia | 1 (10%) | 0 (—) | 8 (2%) |
| R14 SEM_RESPOSTA | bloqueia | 0 (0%) | 0 (—) | 20 (4%) |
| R15 VAGO_NO_NOME | bloqueia | 0 (0%) | 0 (—) | 11 (2%) |
| R16 TEXTO_LONGO | alerta | 0 (0%) | 0 (—) | 17 (4%) |
| R17 INDICADOR_VAZIO | bloqueia | 0 (0%) | 0 (—) | 12 (3%) |
| R18 PLURAL_ERRADO | bloqueia | 0 (0%) | 0 (—) | 3 (1%) |
| R19 SUGESTAO_CONTRADIZ | bloqueia | 0 (0%) | 0 (—) | 1 (0%) |
| R20 EQUIPE_SEM_VENDEDOR | bloqueia | 0 (0%) | 0 (—) | 3 (1%) |
| R21 ONTEM_DOMINGO | bloqueia | 0 (0%) | 0 (—) | 24 (5%) |
| R22 FATURADO_NEGATIVO | alerta | 0 (0%) | 0 (—) | 5 (1%) |
| R23 IA_GENERICA | alerta | 0 (0%) | 0 (—) | 3 (1%) |
| R24 EXPECTATIVA_DO_CASO | bloqueia | 1 (10%) | 0 (—) | 0 (0%) |

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

- **R13 SEM_DADO_ATENDIVEL** (bloqueia): "nao achei"

```
Olha os números aí, Jonathan:

🔎 Não achei o pedido *1038000485* na base recente de Equipe Jonathan Fernandes (TPH). Confere o número ou se pertence a outra filial/carteira?

_🟢 Hoje (Clube da Venda · 22:25): pedidos colocados._

_Essa resposta ajudou? Responda 👍 ou 👎 · ou escreva *sugestão:* e o que melhorar_
```

## Todos os casos rodados

| Caso | Quem | Pergunta | s | Violações (atual) | Violações (resposta que saiu) |
|---|---|---|---:|---|---|
| K01 | Vitorio (diretoria) | Venda Tamara TCV hoje | 1 | ✅ | R01 R02 R05 R15 R24 |
| K02 | Vitorio (diretoria) | Quanto a Tamara de TCV vendeu hoje | 1 | ✅ | R01 R02 R05 R15 R24 |
| K03 | Vitorio (diretoria) | Curva Negativa vendedora Tamara TCV | 56 | ✅ | R06 R12 R13 R24 R24 R24 |
| K04 | Vitorio (diretoria) | Curva negativa Vendedora 10 de TSJ | 50 | ✅ | R02 R06 R24 R24 |
| K05 | Renan Lechuk (vendedor TPH 128) | Quais clientes posso positivar na recorrência ainda? | 0 | R02 R07 R08 R12 R24 R24 | R02 R07 R08 R12 R24 R24 |
| K06 | Alex Sandro Soares Elias (supervisor TBE) | Atualiza os números de hoje do meu time | 0 | ✅ | ✅ |
| K07 | Jonathan Fernandes (supervisor TPH) | status do pedido 1038000485 | 2 | R13 | R02 R06 R16 R24 R24 |
| K08 | Sueli Aparecida Teixeira Polli (supervisor API) | Karina já vendeu hoje | 8 | ✅ | R03 R24 R24 |
| K09 | Luis Thiago Virtuoso Boeira (supervisor TBE) | Fechamento | 1 | ✅ | R17 R18 R19 R20 R24 |
| K10 | Luis Thiago Virtuoso Boeira (supervisor TBE) | Fechamento do dia 16/11/2026 | 1 | ✅ | R17 R18 R19 R20 R24 R24 R24 |

## Piores respostas que saíram no dia (produção)

- **Washington Flores Da Rosa (supervisor API)** — "Vendedora fez check-in antes das 10hs. Informação recebida dr não checkin não pr…": R01 FONTE_CEVEN, R02 NOTA_TECNICA, R03 ZERO_SEM_LEITURA, R09 CONTESTACAO_COM_CARD, R17 INDICADOR_VAZIO
- **Washington Flores Da Rosa (supervisor API)** — "Informação sobre varejo rota incorreto": R01 FONTE_CEVEN, R02 NOTA_TECNICA, R03 ZERO_SEM_LEITURA, R09 CONTESTACAO_COM_CARD, R17 INDICADOR_VAZIO
- **Gessandro Sperotto (supervisor TCV)** — "3.761,24 venda": R01 FONTE_CEVEN, R02 NOTA_TECNICA, R03 ZERO_SEM_LEITURA, R09 CONTESTACAO_COM_CARD, R17 INDICADOR_VAZIO
- **Tiago Martines Otaviano (supervisor MCD)** — "Alcindo ja havia realizado Check-in, favor verificar": R01 FONTE_CEVEN, R02 NOTA_TECNICA, R03 ZERO_SEM_LEITURA, R09 CONTESTACAO_COM_CARD, R17 INDICADOR_VAZIO
- **Aleksandro Rodrigo De Faria (vendedor ABC 224)** — "Quais clientes ainda nao positivado no giro de hoje": R05 PERIODO_TROCADO, R06 ASSUNTO_ERRADO, R07 LISTA_PEDIDA_SEM_LISTA, R13 SEM_DADO_ATENDIVEL
