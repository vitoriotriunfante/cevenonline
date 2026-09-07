# 🧠 Base de Conhecimento e Calibração da IA CEVEN (WhatsApp & Central NOC)

Este documento centraliza todas as regras de negócio, casos reais de teste, análises de telas e prompts calibrados para o treinamento e execução do **Agente de IA do WhatsApp** e do **Motor de Insights da TV NOC**.

---

## 📌 1. Regras de Negócio Estruturantes (Golden Rules)

### 🎯 Regra 1: Meta Fixa de 20 Visitas / Dia
* **Definição**: Todo vendedor precisa realizar no mínimo **20 atendimentos/dia**.
* **Fórmula do GAP**: $\text{GAP de Prospecção} = 20 - \text{Total de PDVs da Rota do Dia}$.
* **Comportamento da IA**:
  - Se o RCA tem 10 PDVs na rota, a IA sugere **10 prospects** da Receita Federal ordenados por menor distância em relação ao centróide da rota.
  - Se o RCA tem 18 PDVs na rota, a IA sugere **2 prospects**.

### 🏷️ Regra 2: Status `EFETIVADO` vs `FALTA POSITIVAR`
* **Definição**: Clientes com o badge verde **`EFETIVADO`** ou com pedido digitado na data de hoje **NÃO** devem ser listados como pendentes de positivação.
* **Exceção de Oportunidade / Corte**:
  - Se o cliente estiver `EFETIVADO`, mas o pedido tiver o badge amarelo **`Corte Comercial`**, a IA deve alertar a perda de faturamento e sugerir a reposição do SKU alternativo.

### ✂️ Regra 3: Auditoria de Cortes Comerciais & "Deixou de Comprar"
* **Definição**: Quando um pedido for liberado com valor faturado inferior ao digitado (ex: R$ 144,66 ➔ R$ 72,86):
  - A IA cruza o histórico com a seção **`Deixou de comprar`** do cliente.
  - Exemplo Real: No cliente `#210314 · MINI MERCADO DEISY`, o corte foi de **R$ 71,80** no item **SNICKERS ORIGINAL**.
  - Ação: Sugerir ao vendedor que ofereça itens alternativos das linhas P9/P08 antes de sair da rota.

### 🗺️ Regra 4: Auto-Cadastro no LinkUP
* **Definição**: Ao sugerir um prospect, o vendedor pode responder apenas **`cadastrar 1`** ou **`cadastrar 2`**.
* **Limpeza Obrigatória**: A IA deve remover automaticamente o prefixo `"CLT - "` do nome do vendedor (ex: `GIOVANA BATISTA DA SILVA`) e enviar o payload pronto para o LinkUP.

### 👑 GOLDEN RULES INVIOLÁVEIS:
1. **NUNCA ABRIR MÃO DE NENHUMA VISITA PLANEJADA**: Toda e qualquer visita agendada no roteiro do dia deve ser visitada. Nenhuma discrepância de mapa ou algoritmo pode suprimir um cliente da lista do vendedor.
2. **REGRA DAS 20 VISITAS/DIA**: Se a rota do dia tem $N$ clientes ($N < 20$), o sistema obrigatoriamente preenche o GAP com $20 - N$ prospects quentes no centróide do trajeto.
3. **AQUECIMENTO MATINAL DAS 04h00**: O cruzamento com a base da Receita Federal é processado de madrugada na nuvem para que às 06h00 todos os mapas estejam 100% quentes e instantâneos.
4. **NUNCA ESPECULAR OU DEDUZIR**: Toda resposta sobre clientes, faturamento, histórico ou rotas deve vir de consulta SQL direta ao banco de dados D1.
5. **ALERTA DE CORTES E RUPTURAS**: Ao abrir o dia, sempre alertar produtos cortados em pedidos anteriores (ex: Snickers) e oferecer substitutos de mix (P9/P08).
6. **CADASTRO LINKUP EM 1 CLIQUE**: Ao sugerir prospects da Receita, permitir cadastro instantâneo via comando `cadastrar 1`.

---

## 📚 2. Dataset de Perguntas & Respostas Calibradas (Fine-Tuning Q&A)

### 🔹 CASO 01: Consulta de Rota do Dia + Prospecção
**Entrada do Vendedor (RCA 181 - Giovana / TBL):**
> *"qual os pdvs falta eu positivar e se sobrar tempo quais pdvs devo prospectar hoje?"*

**Resposta Calibrada da IA:**
```text
Olá, Giovana! 🌟 Aqui está o seu raio-x de atendimento para hoje:

✅ JÁ POSITIVADOS HOJE (2 PDVs):
• Mini Mercado Maffei (#181000639)
• Mini Mercado Deisy (#210314) ⚠️ Pedido #181000633 cortou R$ 71,80 no Snickers Original. Vale ofertar outro SKU do mix!

📍 FALTAM POSITIVAR NA ROTA (8 PDVs):
1. Sup Castro (#191160) — Oportunidade: Repor Skittles
2. Panificadora Central (#197928) — Sem compra há 22 dias
3. Mercearia do Japonês (#203417)
4. Conveniência Petrópolis (#209242)
5. Auto Posto Tigrão (#213922)
6. Padaria Pão de Mel (#214550)
7. Supermercado Alvorada (#215880)
8. Empório São Francisco (#218902)

🎯 PROSPECTS NO SEU CAMINHO (Para bater as 20 visitas):
1. Mercearia Londrina Centro — 0.02 km (CNAE Mercadorias)
2. Padaria & Café Estrela — 0.05 km (CNAE Panificação)
3. Empório das Bebidas — 0.08 km (CNAE Bebidas/Doces)
4. Mini Mercado Aliança — 0.12 km
5. Cantinho do Pão — 0.15 km
6. Drogamais Norte — 0.18 km
7. Conveniência 24 Horas — 0.22 km
8. Mercearia da Esquina — 0.30 km
9. Supermercado Bom Preço — 0.35 km
10. Banca & Bomboniere Central — 0.40 km

⚡ AÇÕES RÁPIDAS:
• Digite "cadastrar 1" para cadastrar o prospect no LinkUP.
• Digite "mapa" para abrir o trajeto no Google Maps / Waze.
```

---

### 🔹 CASO 02: Consulta de Histórico de SKU (Maffei / Snickers Macchiato)
**Entrada do Vendedor:**
> *"o cliente MINI MERCADO MAFFEI LTDA teve qual comportamento no ultimo pedido em relação ao SKU SNICKERS MACCHIATO?"*

**Resposta Calibrada da IA:**
```text
Analisando o histórico do cliente MINI MERCADO MAFFEI LTDA (#181000639):

🍫 SKU: SNICKERS MACCHIATO 20UN
• Penúltima Visita: Comprou 20 unidades.
• Última Visita: Manteve a compra de 20 unidades.
• Status de Variação (Delta): 0 (Volume Estável — marcado com "—" na tabela).

💡 Insight de Venda: O cliente tem giro constante no Macchiato (20un por ciclo). Oportunidade de apresentar as novas versões da linha Snickers para aumentar o ticket!
```

---

### 🔹 CASO 03: Alerta de Corte em Massa (Notificação para o Gerente)
**Gatilho do Sistema:** Mais de 5 pedidos com corte no mesmo SKU na filial `TBL`.

**Mensagem no WhatsApp do Gerente de TBL:**
```text
🚨 ALERTA NOC TRIUNFANTE — FILIAL TBL 🚨

Identificamos Corte Comercial Coletivo em andamento:
📦 SKU: SNICKERS MARACUJÁ 20UN
📊 Impacto: 9 de 10 pedidos sofreram corte.
💰 Perda Acumulada: R$ 1.368,00.

RCAs Afetados:
• Giovana Batista (181) — Pedido #181000639 (Perda: R$ 67,80)
• Carlos Alberto (204) — Pedido #181000642 (Perda: R$ 135,60)
• Fernando Dias (221) — Pedido #181000645 (Perda: R$ 67,80)
• Marcos Antonio (227) — Pedido #181000648 (Perda: R$ 203,40)
• Lucas Pereira (235) — Pedido #181000650 (Perda: R$ 135,60)

👉 Ação Recomendada: Verificar estoque físico no CD Barueri ou acionar RCAs para substituição imediata de SKU.
```

---

### 🔹 CASO 05: Abertura Real da Rota (Giovana 181 - 27/08/2026)
**Contexto Extraído das Telas Oficiais:**
* **Financeiro**: Meta R$ 132.548 | Faturado Líq. R$ 117.365,91 | Pendente R$ 13.306,54 | **Falta apenas R$ 1.875,55 para bater 100% da meta do mês (98.6%)!**
* **Positivação**: 79/93 clientes (84.9% - faltam 14 clientes).
* **Produtividade Hoje**: 0 vendas / 0 faturamento (Início do dia).
* **Roteiro do Dia**: 16 PDVs programados na lista do Hoje.
* **Inconsistência Técnica Detectada**: No Dashboard/Hoje constam **16 programados**, mas no Mapa constam apenas **15 geolocalizados** (1 PDV sem coordenadas/geocodificação no cadastro).
* **GAP para 20 Visitas/Dia**: $20 - 16 = \mathbf{4\text{ prospects}}$ sugeridos no centróide da rota (Maringá/Londrina).

**Destaques de Mix nos Primeiros Clientes:**
1. `#190088 · BAR E MERCEARIA JR`: Tag `NAO COMPROU SNICKERS CORE`.
2. `#191160 · PADARIA DO PEDRINHO`: Tag `FALTA 1 FOCO P09: SKITTLES`.
3. `#208032 · PANIFICADORA HORA DO PAO`: Tag `SEM COMPRAS P9+P08`.
4. `#203910 · PLANOS SUPERMERCADOS`: Tag `SEM COMPRAS P9+P08`.

