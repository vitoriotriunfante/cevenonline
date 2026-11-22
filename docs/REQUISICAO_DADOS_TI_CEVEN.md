# Pedido à TI do CEVEN — Endpoint único de dados

**Para:** Dev Sênior do CEVEN
**De:** Varejo Triunfante

## O que precisamos

Hoje fazemos centenas de chamadas por vendedor (`/api/rca/*`, `/api/admin/*`, `/api/gerente/*`) para montar os dados das 11 filiais. Os cálculos (TV, Liga, WhatsApp, +MIX) são feitos do nosso lado.

Pedimos **um endpoint único** que devolva os **dados brutos da rede inteira** (ou de uma filial), separados nos blocos abaixo, para gravarmos na nossa base.

## Como

```
GET /api/...?bloco=<nome>&filial=TODAS&data=2026-11-16&desde=2026-11-16T10:30:00-03:00
```

- `bloco`: um dos blocos abaixo.
- `filial`: `TODAS` ou a sigla (`TBL, TPH, TCV, ABC, TCA, MCD, TCG, API, TBE, TPA, TSJ`).
- `data`: dia de referência (padrão = hoje).
- `desde`: opcional; devolve só o que mudou depois desse horário (para as leituras frequentes).
- Retorno em JSON, com o horário da geração (`gerado_em`).
- Se alguma filial ou vendedor não puder ser lido, avisar no retorno (`falhas`), em vez de mandar vazio ou zero.
- Datas/horas com fuso de Brasília; valores numéricos (não texto).
- Mandar o vendedor e o supervisor como código + nome.

## Blocos, campos e frequência

| # | Bloco | Frequência | Horário |
|---|---|---|---|
| 1 | Equipe e metas | 1x por dia | pronto até 00:30 |
| 2 | Rota do dia | 1x por dia + alterações | pronto até 00:30 |
| 3 | Visitas (check-in/out) | a cada 2 min | 07:00 – 21:00 |
| 4 | Pedidos e itens | a cada 2 min | 07:00 – 23:30 |
| 5 | Resumo do mês por vendedor | a cada 15 min | 06:00 – 23:30 |
| 6 | Devoluções | a cada 15 min | 07:00 – 23:30 |
| 7 | Supervisores (compromisso e RET) | a cada 5 min até 10:30; RET a cada 15 min | 06:00 – 19:00 |
| 8 | Histórico de compras do cliente | 1x por dia (até ontem) | pronto até 03:30 |
| 9 | Prospects e cadastros | 1x por dia | pronto até 03:30 |

### 1. Equipe e metas
Por vendedor: filial, gerente, supervisor, vendedor, canal, ativo (sim/não), meta de faturamento do mês, meta de positivação do mês.
*(Hoje: `admin/filiais/hierarquia` e `gerente/tabelas-cascata` — as duas listas não batem; precisamos da lista completa.)*

### 2. Rota do dia
Por vendedor e cliente: data, ordem na rota, código do cliente, CNPJ, fantasia, latitude/longitude, data da última compra, tags do cliente (RECORRÊNCIA, FOCO, INATIVO etc.). Se um cliente for incluído ou retirado da rota durante o dia, informar.
Também a rota do mês (mesmos campos + data prevista da visita).
*(Hoje: `rca/roteiro-hoje`, `rca/roteiro-mes`, `rca/produtividade`, `rca/clientes-foco`.)*

### 3. Visitas (check-in / check-out)
Por vendedor e cliente: data, cliente na rota (sim/não), status da visita, horário do check-in, horário do check-out, latitude/longitude do check-in e do check-out, distância até o cliente (m), justificativa de não venda (motivo e observação).
*(Hoje: `rca/roteiro-hoje`.)*

### 4. Pedidos e itens
**Pedido:** número, filial, vendedor, cliente, CNPJ, data e hora, valor digitado, valor faturado, status (digitado, bloqueado, liberado, faturado, cancelado…), motivo do bloqueio, horário de cada mudança de status.
**Itens:** código do produto, descrição, código e nome do fornecedor/indústria, marca própria (sim/não), quantidade pedida, quantidade faturada, quantidade cortada, valor, motivo do corte.
*(Hoje: `rca/historico-vendedor`, `rca/historico-cliente/{id}`, `rca/pedidos-winthor`, `rca/liberacoes`.)*

### 5. Resumo do mês por vendedor
Faturado, pendente a faturar, positivação, devolução, digitado do dia, visitas planejadas e realizadas.
*(Hoje: `rca/dashboard`, `rca/produtividade`, `gerente/dashboard-cascata`.)* Servirá também para conferirmos nossos totais com a tela do CEVEN.

### 6. Devoluções
Por nota: número, data da nota, vendedor, cliente, valor, "não pediu" (sim/não), pedido de origem.
Por item: produto, quantidade, valor, **motivo oficial da devolução** (texto do CEVEN).
*(Hoje: `rca/devolucoes` e `rca/devolucoes/{nota}`.)*

### 7. Supervisores
**Compromisso:** supervisor, data, fez (sim/não), horário.
**RET:** supervisor, data, horário de início, e cada cliente/vendedor acompanhado com horário de check-in/check-out.
*(Hoje: `admin/supervisores/matriz-compromissos`, `matriz-ret`, `admin/ret/periodo`.)*

### 8. Histórico de compras do cliente
Item a item: cliente, CNPJ, vendedor, data, número do pedido/nota, produto, fornecedor/indústria, quantidade, valor.
**Primeira entrega: últimos 12 meses.** Depois, diariamente, só o dia anterior.
*(Hoje: `rca/historico-cliente/{id}`.)*

### 9. Prospects e cadastros
**Carteira completa** de cada vendedor (todos os clientes, não só os da rota do dia): código, CNPJ, razão social, fantasia, endereço, cidade, latitude/longitude, segmento, ativo/bloqueado.
**Prospects** por vendedor (inclusive domingo e feriado, sem rota): CNPJ, nome, cidade, latitude/longitude, distância, se já foi cadastrado e por quem. Por vendedor, informar se a leitura deu certo, para "sem prospects" não ser confundido com "não foi possível ler".
**Solicitações de cadastro (LinkUp):** CNPJ, vendedor, status, data.
*(Hoje: `ceven/prospeccao-roteiro`, `linkup/solicitacoes`.)*
