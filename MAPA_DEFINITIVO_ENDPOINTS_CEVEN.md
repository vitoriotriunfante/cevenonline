# MAPA DEFINITIVO DE ENDPOINTS E REGRAS DE NEGÓCIO DO CEVEN
**Documento Permanente de Arquitetura e Extração de Dados Oficiais da Locomotiva**

---

### 1. ESTRUTURA E ORIGEM DE CADA DADO NO CEVEN

| Dado / Indicador | Endpoint Oficial no CEVEN | Campo / Propriedade | Como Obter com Precisão Absoluta |
| :--- | :--- | :--- | :--- |
| **Rotas de Hoje (PDVs)** | `/api/rca/roteiro-hoje?filial={filial}&id={rcaId}` | `[ { id, nome_cliente, razao_social, cnpj, endereco } ]` | Tamanho do array retornado (ex: Cassiany = 3 clientes). Se vazio `[]`, RCA tem 0 rotas. |
| **Pedidos do Dia / D-1** | `/api/rca/historico-cliente/{clienteId}?filial={filial}&id={rcaId}` | `ultimas_visitas[].num_pedido`, `valor`, `data` | Percorrer os clientes do dia e capturar cada pedido emitido em `01/09/2026`. |
| **Status Real do Pedido** | `/api/rca/historico-cliente/{clienteId}?filial={filial}&id={rcaId}` | `ultimas_visitas[].status` | `Liberado` (pronto p/ faturar) ou `Bloqueado` (pendência comercial/crédito). |
| **Cortes Reais de Separação** | `/api/rca/historico-cliente/{clienteId}?filial={filial}&id={rcaId}` | `ultimas_visitas[].corte`, `itens_cortados[]` | Traz a tag oficial do CEVEN (`Corte Comercial`), o SKU cortado, o valor e a quantidade negativa (`-Xun`). Ex: Pedido `#204000363` ➔ `MEM CHOCOLATE AO LEITE` (`-3 un` / R$ 37,95). |
| **Devoluções Físicas D-1** | `/api/rca/devolucoes/{nfe}?filial={filial}&id={rcaId}` | `[ { codprod, descricao, qtdev, vl_devolvido, motivo } ]` | Lista de SKUs devolvidos com motivo oficial do Winthor (`CLIENTE NAO PEDIU`, `ATRASO NA ENTREGA`, etc.). |
| **Metas Financeiras (Mês)** | `/api/rca/dashboard?filial={filial}&id={rcaId}` | `financeiro.meta` | Meta oficial do mês em R$. |
| **Faturado Oficial (Mês)** | `/api/rca/dashboard?filial={filial}&id={rcaId}` | `financeiro.faturado` | Faturado líquido aprovado pelo Winthor. |
| **Carteira Pendente Total** | `/api/rca/dashboard?filial={filial}&id={rcaId}` | `financeiro.pendente` | Saldo total de pedidos retidos/em aberto na fila do Winthor. |
| **Metas e Positivação** | `/api/rca/dashboard?filial={filial}&id={rcaId}` | `positivacao.meta`, `positivacao.realizado` | Meta de clientes distintos e quantidade realizada. |
| **Produtividade de Campo** | `/api/rca/produtividade?filial={filial}&id={rcaId}` | `dia.visitas_na_rota`, `dia.visitas_com_venda`, `mix_mes.clientes_distintos` | Indicadores de eficácia, eficiência e mix atendido. |

---

### 2. REGRAS DE CONSOLIDAÇÃO HIERÁRQUICA (BOTTOM-UP)

1. **Vendedor (RCA):**
   * É a unidade fundamental e a fonte de verdade absoluta. Todos os dados nascem na consulta individual do RCA.
2. **Supervisor:**
   * `Supervisor = SUM(Vendedores vinculados a este supervisor na árvore oficial)`.
   * Não existe cálculo paralelo ou meta avulsa para supervisor.
3. **Filial:**
   * `Filial = SUM(Supervisores da filial)`.
4. **Locomotiva (Consolidado):**
   * `Locomotiva = SUM(11 Filiais)`.

---

### 3. PROIBIÇÕES ABSOLUTAS (NUNCA MAIS DESCUMPRIR)

* ❌ **PROIBIDO** inventar pedidos, horários de corte operacionais ("11:30") ou regras operacionais não documentadas.
* ❌ **PROIBIDO** aplicar divisões proporcionais arbitrárias sobre totais consolidados.
* ❌ **PROIBIDO** criar pedidos sintéticos ou números sequenciais falsos.
* ❌ **PROIBIDO** assumir rotas para gerentes ou contas de apoio sem consultar o `/api/rca/roteiro-hoje`.
* ❌ **PROIBIDO** ignorar o histórico real de cortes e status dentro de `historico-cliente`.
