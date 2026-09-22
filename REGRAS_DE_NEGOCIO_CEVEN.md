# 📜 REGISTRO DEFINITIVO DE REGRAS DE NEGÓCIO & ARQUITETURA CEVEN NOC

> **Documento Oficial de Engenharia & Requisitos Comerciais**
> Versão do Sistema: `v3.0.0-stable` | Atualização Contínua e Permanente

---

## 🎯 1. Princípio Fundamental de Arquitetura
O sistema **NUNCA** deve operar em modo parcial ou segmentado. Toda informação coletada deve ser **persistida integralmente no banco de dados relacional (`ceven_noc.db` / Cloudflare D1)** e no **Data Lake Bruto (`ceven_raw_payloads`)**, abrangendo todos os **519 vendedores (RCAs)** e todas as **11 filiais**.

---

## 🏢 2. As 11 Filiais Oficiais (Estritamente Siglas Oficiais da API)
1. **`TBL` (`tbl1`)**
2. **`TCV` (`tcv1`)**
3. **`TPH` (`tph1`)**
4. **`TSJ` (`tsj1`)**
5. **`TCA` (`tca1`)**
6. **`ABC` (`abc1`)**
7. **`TPA` (`tpa1`)**
8. **`TBE` (`tbe1`)**
9. **`API` (`api1`)**
10. **`MCD` (`mcd1`)**
11. **`TCG` (`tcg1`)**

---

## ⏰ 3. Ciclo de Vida dos Dados e Horários de Varredura
* **Varredura Noturna de Fechamento (20:00)**:
  * Fecha o faturamento líquido diário, pendências, positivação, eficácia e devoluções.
  * Grava o snapshot imutável em `rca_kpis` e `consolidado_diario_filial`.
* **Varredura Matinal de Abertura (04:00)**:
  * Popula a rota do novo dia, os prospects georreferenciados da Receita Federal e as oportunidades de recompra.
* **Virada de Mês (Dia 1)**:
  * Arquiva o consolidado mensal histórico e zera as rotas e metas ativas para o novo período sem perda de dados passados.

---

## 📱 4. As 4 Telas do Aplicativo CEVEN Vendedor

### 📊 Tela 1: "Dashboard" (Visão Geral e Fechamento)
* **Header**: Filial, Código RCA, Nome do Vendedor, Versão do App (ex: `v7.898`), Dias sem acesso (`Xd +MIX`).
* **Card Financeiro**: Meta (R$), Faturado Líquido (R$), Pendente (R$), Falta (R$), % Atingimento da Meta, Total de Devoluções no Mês (R$ e quantidade de notas).
* **Card Positivação**: Meta de Clientes, Realizado, Faltam, % de Positivação.
* **Card Produtividade**: Faturamento Hoje, Positivação Hoje, Digitação Hoje, Roteiro Hoje (com venda / total programado), Eficácia Diária (%).
* **Card Roteiro Mês**: Visitas Planejadas até hoje, Visitas Realizadas, Eficiência Mensal (%), Pedidos na Rota do Mês.
* **Card Mix Mês**: SKUs Distintos no mês, Clientes Distintos atendidos, Média SKU/Cliente.
* **Auditoria de Devoluções**: Lista aberta de notas fiscais devolvidas com número da NF, cliente, CNPJ, valor e produtos com motivos de recusa (`CLIENTE NAO PEDIU`, `DIVERGENCIA DE PRECO`, `AVARIA`, etc.).

---

### 📋 Tela 2: "Hoje" (Roteiro e Histórico Granular de Clientes)
* **Lista da Rota do Dia**: Sequência de clientes com status (`VISITADO`, `EFETIVADO`, `ABERTO`, `FORA_ROTA`) e tags de foco (`SEM COMPRAS P9+P08`, `NAO COMPROU SNICKERS CORE`, `RECORRENCIA DD/MM`).
* **Card Resumo do Cliente**: Dias sem compra (`Xd`), Total de Pedidos no histórico, Último Pedido (`R$`), MIX total de SKUs.
* **SKUs do Último Pedido (com Status de Mix)**:
  * 🔵 **`novo`**: Produto recém-adicionado na carteira.
  * 🔢 **Número (ex: `1900`, `8`)**: Quantidade penúltima comparativa (delta de volume $\uparrow$ subiu ou $\downarrow$ caiu).
  * ➖ **`—`**: Manteve a mesma quantidade.
* **Últimas Visitas (Histórico Pedido a Pedido)**:
  * Data da visita, Número do Pedido WinThor, Status (`Faturado`, `Liberado`, `Bloqueado`), Categoria de Corte (`Corte Comercial`, `Corte Logística`, `Sem Corte`), Valor Faturado WinThor e Valor Original Digitado.
  * Lista nominal de todos os SKUs faturados com quantidade e preço.
  * **Lista nominal de todos os SKUs cortados com quantidade negativa (vermelho)** e perda financeira.
* **Deixou de Comprar**: Lista de produtos recorrentes que o cliente parou de comprar com valor histórico perdido.

---

### 🗺️ Tela 3: "Mapa" (Georreferenciamento & Prospecção)
* **Camada 1 - Meu Roteiro**: Pins azuis numerados de 1 a N da rota do dia.
* **Camada 2 - Prospecção (120)**: Pins laranjas com novos estabelecimentos da Receita Federal num raio de até 3.5km, classificados por IA com filtros CNAE (Padarias, Mercados, Doces, Hortifruti).
* **Camada 3 - Ex-Clientes (Reativar)**: Pins vermelhos representando clientes antigos cadastrados no WinThor que estão inativos no período.
* **Telemetria da Rota**: Total de paradas, KM total pelas ruas, tempo de volante, tempo de atendimento em loja e janela restante para prospecção.
* **Otimização OSRM**: Sequência lógica para menor quilometragem e exportação direta para navegação no Google Maps.

---

### 📅 Tela 4: "Mês" (Consolidado Mensal da Carteira)
* Visão acumulada de faturamento, metas, positivação, eficiência de roteiro e oportunidades de GAP +MIX regional.

---

## 🔄 5. Dinâmica da Aba "Mês", Ciclo do Pedido & Gatilhos Comerciais de IA

### 📈 A. Acumulação Progressiva (Dia 1 ao Dia 15)
* A aba **"Mês"** não nasce estática; ela é o **acumulador vivo da carteira**:
  * **Dia 1**: Rota tem 15 clientes ➔ 15 no "Hoje" e 15 no "Mês".
  * **Dia 2**: Rota tem 10 clientes ➔ 10 no "Hoje" e 25 acumulados no "Mês".
  * **Dia 15**: Como a maioria das rotas é quinzenal, por volta do 15º dia útil a carteira completa (~110 a 140 clientes) já está 100% populada no "Mês".

### ⚙️ B. Ciclo de Vida do Pedido & Mudança de Status (State Machine)
1. **Dia da Visita ("Hoje")**: O vendedor visita o cliente X e digita o pedido. O status fica como **`LIBERADO`** (pendente de faturamento no WinThor).
2. **Virada do Dia**: No dia seguinte, a aba "Hoje" vira para os novos clientes da rota. O cliente X sai do "Hoje" e permanece registrado na aba **"Mês"** com status `LIBERADO`.
3. **Faturamento / Corte (WinThor)**: Quando o CD processa a carga, o status muda de `LIBERADO` ➔ `FATURADO` (ou `CORTADO` / `BLOQUEADO`).
4. **Notificação Proativa no WhatsApp do Vendedor**:
   > 📢 *"Seu pedido do cliente VMW Supermercados que estava Liberado acabou de ser FATURADO (R$ 148,93) com corte de 1un Toffee e 7un Batata Palha."*

---

### 🚨 C. Gatilho de Salvamento de Positivação (Fim de Mês / Fora de Rota)
* **Cenário**: Entre os dias **20 e o último dia útil do mês**, clientes visitados no início do mês que ficaram **sem venda (`VISITADO`)** só teriam nova visita no mês seguinte pelo ciclo quinzenal regular.
* **Ação do Sistema**:
  1. Identifica os clientes visitados sem venda cuja data de visita tem mais de 5 dias.
  2. Calcula a distância desses clientes em relação à **rota ativa de hoje**.
  3. Dispara alerta no WhatsApp da vendedora recomendando um **Desvio Rápido / Fora de Rota** ou ligação/mensagem de WhatsApp para fechar o pedido de positivação antes da virada do mês.

---

### 📦 D. Gatilho de Recuperação de Cortes de Estoque (Reabastecimento CD)
* **Cenário**: Pedidos emitidos no início do mês sofreram cortes de itens por falta de estoque no CD.
* **Ação do Sistema**:
  1. Detecta quando o estoque de um produto cortado é reabastecido no WinThor.
  2. Cruza com os clientes que tiveram corte desse SKU nos últimos 20 dias.
  3. Gera **mensagens prontas e personalizadas de WhatsApp** para o vendedor reenviar com 1 clique (ex: Pepino Burger Hemmer para Mercearia Lubacheski, Salgadinho MitBit para Posto Pegoraro, Butter Toffees para VMW).

---

## 🗄️ 6. Mapeamento das Tabelas Relacionais (`ceven_noc.db` / D1)
1. `rca_kpis` (36 colunas de indicadores diários)
2. `consolidado_diario_filial` (Totalizadores das 11 filiais)
3. `clientes_historico_compras` (Histórico da carteira com deltas de mix e perdas)
4. `pedidos_faturados_itens` (Pedidos detalhados com itens faturados e cortados)
5. `devolucoes_auditoria` (Notas fiscais devolvidas com itens e motivos)
6. `prospects_receita` (Base da Receita Federal geocodificada por CNAE)
7. `linkup_cadastros_preparados` (Fichas LinkUP pré-preenchidas para disparo instantâneo/WhatsApp)
8. `briefings_ia_clientes` (Dicas e argumentos táticos de vendas gerados por IA)
9. `oportunidades_mix_gap` (Penetração e GAP regional por vizinhança de CNPJs)
10. `ceven_raw_payloads` (Data Lake bruto com hash SHA-256)

## 👥 7. Regras Oficiais de Classificação de Canais (Tabela Mestre: Cód. Área WinThor / CEVEN)

> ⚠️ **REGRA DE NEGÓCIO SUPREMA — APLICÁVEL A TUDO NO PROJETO CEVEN VÁRIAS TELAS**:
> Toda e qualquer rotina, script, pipeline, auditoria, banco de dados e relatório (WhatsApp/Dashboard/TV) deve obrigatoriamente respeitar a taxonomia oficial de **Cód. Área**:

| Cód. Área (WinThor) | Tag CEVEN API | Descrição Oficial | Papel Operacional / Natureza da Carteira | Régua de Acompanhamento |
| :---: | :---: | :--- | :--- | :--- |
| **`A`** | **`AS`** | **AS** | Autosserviço tradicional / Atacados / Redes | Acompanhamento por volume financeiro e positivação de contas-chave (sem cobrança de visitas diárias de rota). |
| **`E`** | **`ESP`** | **ESPECIALISTA** | Linhas técnicas, contratos exclusivos ou produtos foco | Foco em mix técnico e conversão de metas de categoria especializada. |
| **`F`** | **`FARMA`** | **FARMACÊUTICO** | Canal Farma, drogarias e distribuidoras de medicamentos | Régua específica de positivação e sortimento farmacêutico. |
| **`G`** | **`GER`** | **GERENTE** | Contas gerenciais, corporativas ou de apoio da diretoria | Nível hierárquico de gestão (sem carteira operacional direta de rota). |
| **`P`** | **`PET VJ`** | **PET VAREJO** | Lojas Pet, agropecuárias e clínicas veterinárias de varejo | Roteiro estruturado de varejo diário, positivação de rota pet e recompra recorrente. |
| **`Q`** | **`PET AS`** | **PET AS** | Grandes redes de Pet Shop, Pet Centers e atacados pet | Grandes volumes, compras programadas e abastecimento de redes pet. |
| **`S`** | **`SUP`** | **SUPERVISOR** | Matrículas e contas de supervisão comercial | Nível hierárquico intermediário (gestão de equipe e vendas diretas/intervenção). |
| **`V`** | **`VJ`** | **VAREJO** | Varejo tradicional alimentar (mercados, padarias, mercearias) | Roteiro fixo diário de campo, cobrança rigorosa de visitas programadas, positivação e negativação. |

---

### 🛡️ B. Aplicação nos Filtros e Acompanhamentos do Sistema
1. **Cobrança de Rota Diária / Eficácia de Campo**:
   * Aplica-se estritamente aos canais de rota: **`V` (VAREJO)** e **`P` (PET VAREJO)**.
   * Canais corporativos / grandes contas (**`A` - AS**, **`Q` - PET AS**) não podem sofrer penalização de roteiro diário ou cálculo de visita em aberto.
2. **Camadas de Gestão**:
   * Contas com perfil **`G` (GERENTE)** e **`S` (SUPERVISOR)** são separadas das métricas de vendedores operacionais para não inflar ou distorcer médias da filial.
3. **Canais Verticais Especializados**:
   * Contas **`F` (FARMACÊUTICO)** e **`E` (ESPECIALISTA)** possuem metas e positivações segregadas para cálculo de campanhas e premiações.
4. **Filtro Rigoroso de Elegibilidade para Disparos Matinais / WhatsApp**:
   * ✅ **Meta Cadastrada Ativa**: `Meta Financeira > 0` ou `Meta Positivação > 0` para o mês corrente;
   * ✅ **Carteira e Rota Ativa**: `Carteira de Clientes > 0` e `Visitas Programadas no Dia > 0` (`total_programado > 0`).
   * Vendedores sem metas ou sem carteira alocada são reportados na auditoria de cadastro, mas excluídos do ranking diário de produtividade.

## 🏷️ 8. Marcas Exclusivas Próprias Triunfante (Campanhas, Boletins & Metas de Mix)

### A. Malha de Filiais Elegíveis por Marca Exclusiva
| Marca Própria | Categoria | Filiais Elegíveis (Venda Autorizada) | Total Filiais |
| :--- | :--- | :--- | :---: |
| **BELLARONE** | Conservas, Palmitos, Ovos de Codorna, Azeitonas, Cogumelos | **`API, ABC, TCA, TSJ, MCD, TPA, TBL`** | **7** |
| **SKIVE** | Batata Ondulada (37g / 80g) | **`API, TPH, TCA, TSJ, MCD, TPA, TBL, TCV`** | **8** |
| **MITBIT** | Salgadinhos de Trigo (35g / 90g) | **`API, TPH, TCA, TSJ, MCD, TPA, TBL, TCV`** | **8** |
| **CALIRA** | Batata Palha (Tradicional / Extra Fina 70g) | **`API, TPH, TCA, TSJ, MCD, TPA, TBL, TCV`** | **8** |
| **ZIPOCA** | Pipocas de Canjica de Milho Doce / Salgada (45g, 55g, 80g) | **`API, TPH, TCA, TSJ, MCD, TPA, TBL, TCV`** | **8** |

### ⛔ B. Exclusão Absoluta Obrigatória (Canal Institucional)
* **SKU `12229` — `BATATA ATLANTIC ESPECIAL KG` (Seção 1100)**:
  * **REGRA**: Deve ser **SEMPRE IGNORADA** em todos os boletins, relatórios de WhatsApp, rankings de positivação, metas de mix e auditorias de força de vendas.
  * **MOTIVO**: Produto de venda estritamente **Institucional (B2B Corporativo)**, não participando da dinâmica de rotas comerciais de Varejo (`VJ`), Autosserviço (`AS`) ou Boletins de Vendas.

---

## 👥 9. Mapeamento Gerencial Forçado (Sub-Gerências MCD e TPH)

Nas filiais **MCD** e **TPH**, a operação é segregada por Gerente Geral nos relatórios, auditorias e disparos diários de WhatsApp:

### 🏢 Filial MCD
* **Gerente Cleverson**:
  * Supervisores: `THIAGO DA SILVA CONEGUNDES`, `FLAVIO RUFINO`, `JONATAS DA SILVA DE OLIVEIRA`.
* **Gerente Adriano**:
  * Supervisores: `ALYFER PEREIRA MENDES`, `CARLOS ALAGUEZ DA SILVA`, `CLEOMAR DINIZ BARBOSA`.

### 🏢 Filial TPH
* **Gerente Vagner Pflanzer**:
  * Supervisores: `LUCAS RAMOS MONTAGNHANI`, `ALLISON ANTONIO FAGUNDES M PINHEIRO`, `RODRIGO DE ARRUDA DARROS`, `ANDREY CAMILLO PIRAGINE`, `LUIZ AUGUSTO RAMOS`, `JEFFERSON POLETTO`, `CLAUDETE DE SOUZA SCHULTZ`.
* **Gerente Fábio**:
  * Supervisores: `AILTON LUIZ ARENDT JUNIOR`, `CRISTIAN EDUARDO RAFFAELLI`, `PRISCILA A D NASCIMENTO STRAPASSON`, `EDI CARLOS MEIRA`, `RODRIGO BERTONI`, `CLT VITOR MANUEL PAULOS CORREIA`.

---
*Documento registrado e persistido no repositório.*

