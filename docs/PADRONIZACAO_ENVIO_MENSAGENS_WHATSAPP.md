# 📱 PADRONIZAÇÃO OFICIAL DE DISPAROS DE WHATSAPP — CEVEN NOC

> **Status:** 100% IMPLEMENTADO E OPERACIONAL EM PRODUÇÃO  
> **Data de Atualização:** 21/09/2026  
> **Responsável:** Vitório Neto (Diretoria Geral / Inteligência Operacional)  
> **Código Fonte:** [`pipeline/ceven_unified_engine.js`](file:///c:/Users/vitorio.neto/Documents/Projetos%20IA/CEVEN%20v%C3%A1rias%20telas/pipeline/ceven_unified_engine.js)  
> **Automação Cloud:** [`.github/workflows/ceven-cron-whatsapp.yml`](file:///c:/Users/vitorio.neto/Documents/Projetos%20IA/CEVEN%20v%C3%A1rias%20telas/.github/workflows/ceven-cron-whatsapp.yml)  
> **Gateway de Envio:** Evolution API (Railway `ceven-noc`) com contingência Green-API

---

## ⏰ 1. Grade Horária Oficial em Produção

Todos os disparos abaixo já estão codificados, conectados às APIs reais do CEVEN e parametrizados na esteira do GitHub Actions:

| Horário (BRT) | Horário UTC | Ação no Motor | Destinatário | Descrição do Relatório |
| :---: | :---: | :---: | :--- | :--- |
| **07:00** | `10:00 UTC` | `abertura` | Diretoria Geral (Vitório Neto) | **Abertura Matinal**: Panorama da largada do Varejo (vendedores escalados com rota >= 5, volume de visitas, inativos +30d, recorrência e oportunidades CNAE 5611). |
| **11:00** | `14:00 UTC` | `vendas_zerados` | Diretoria Geral & 14 Gerentes | **1ª Parcial de Vendas**: Faturamento da manhã, ritmo de pedidos, eficácia de visitas e **lista nominal de vendedores zerados agrupados por supervisor**. |
| **11:30** | `14:30 UTC` | `gestao_campo` | Diretoria Geral & 14 Gerentes | **Gestão de Campo**: Auditoria dos 68 Supervisores (Compromissos lançados, RETs em campo, horário do 1º check-in, RCA acompanhado, fotos e IA Score). |
| **14:30** | `17:30 UTC` | `vendas_zerados` | Diretoria Geral & 14 Gerentes | **2ª Parcial (Tração da Tarde)**: Evolução do faturamento, novos positivados, saldo de zerados, **cortes comerciais do WinThor por pedido** e devoluções. |
| **17:00** | `20:00 UTC` | `vendas_zerados` | Diretoria Geral & 14 Gerentes | **3ª Parcial (Reta Final)**: Sprint final antes do encerramento das rotas, vendedores ainda zerados para cobrança de última hora, pedidos bloqueados e cortes. |
| **18:30** | `21:30 UTC` | `vendas_zerados` | Diretoria Geral & 14 Gerentes | **Fechamento Oficial do Dia**: Balanço final da companhia, ranking das 11 filiais, inativos reativados no dia, recorrência, saldo total de cortes e devoluções. |

---

## 👥 2. Destinatários Configurados no Sistema

### 🏢 Diretoria Geral
* **Vitório Neto**: Recebe todos os consolidados gerais da companhia (`5541987525605` e `556696389884`).

### 🏢 14 Gerentes Oficiais das 11 Filiais
*(Recebem o relatório individual focado na sua filial)*
1. **ABC** (Cascavel/Sudoeste): MARCOS (`554588226371`)
2. **API** (Pinhais/Curitiba): MARCELO (`554188317101`)
3. **MCD** (Mato Grosso): CLEVERSON (`556599730698`) e ADRIANO (`556799877927`)
4. **TBE** (Francisco Beltrão): DIEGO (`554699047249`)
5. **TBL** (Londrina): FÁBIO (`554388683191`)
6. **TCA** (Cuiabá): BECHER (`556599438498`)
7. **TCG** (Campo Grande): DANILO (`556792831186`)
8. **TCV** (Cascavel): LEONARDO (`554588210792`)
9. **TPA** (Passo Fundo): RADKE (`554499092497`) e LEANDRO (`554499427329`)
10. **TPH** (Palhoça/SC): VAGNER (`554188559703`) e FÁBIO (`556799877931`)
11. **TSJ** (São José dos Pinhais): SALDANHA (`551291224077`)

---

## 📋 3. Informações Contidas em Cada Relatório Implementado

### 🌅 1. Abertura Matinal (07:00)
* **Regra de Elegibilidade Varejo**: Vendedores de canal Varejo (VJ) com Meta Faturamento > 0, Meta Positivação > 0 e Rota ativa de hoje >= 5 clientes.
* **Métricas Apuradas**:
  * Total de VJs em campo;
  * Total de visitas agendadas para o dia;
  * Clientes sem compras há +30 dias na rota (oportunidade de ouro de positivação);
  * Clientes com TAG Recorrência na rota;
  * Campanha VOLTA COMIGO (exclusivo TPH);
  * Oportunidades do Radar de Prospecção CNAE 5611 (Restaurantes e similares) mapeadas no trajeto.

### 📊 2. Parciais Operacionais (11:00, 14:30 e 17:00)
* **Consolidado da Diretoria**:
  * Faturamento total digitado e total de pedidos;
  * Eficiência de visitas (% visitas realizadas vs programadas);
  * Total de VJs em campo, VJs positivados no dia (%) e **VJs Zerados no horário (%)**;
  * Cortes comerciais do CD acumulados (R$ e quantidade de pedidos);
  * Pedidos bloqueados no dia (R$ e quantidade);
  * Devoluções entradas hoje (R$);
  * Ranking de vendas das 11 filiais.
* **Mensagem Individual do Gerente**:
  * Total digitado e pedidos da filial;
  * Eficiência e eficácia da filial;
  * Total de vendedores Varejo com pedido vs zerados;
  * Detalhe dos cortes da filial: RCA, vendedor, cliente, valor cortado e SKU principal;
  * **Lista nominal dos vendedores zerados agrupados por supervisor**, com contagem de visitas feitas vs na rota e faturamento R$ 0.

### 🚗 3. Gestão de Campo — RETs & Compromissos (11:30)
* **Painel da Filial**:
  * Total de supervisores da filial;
  * Quantidade e % que lançaram Compromisso no CEVEN;
  * Quantidade e % que iniciaram rota de campo (RET);
* **Por Supervisor**:
  * Status do compromisso: ✅ Lançado ou ❌ Não lançado;
  * Status da Rota (RET):
    * Se em campo: Horário do primeiro check-in, nome do RCA acompanhado, quantidade de PDVs visitados, total de fotos registradas e IA Score (nota da qualidade da auditoria de 0 a 100%);
    * Se não iniciou: ❌ Não iniciou (0 PDVs no sistema).

### 🏆 4. Fechamento Oficial do Dia (18:30)
* **Consolidado Geral da Diretoria**:
  * Faturamento total digitado no dia e total de pedidos colocados;
  * Painel de Conquistas: Total de inativos reativados (+30d), positivados com recorrência e positivados da campanha Volta Comigo (TPH);
  * Painel de Perdas: Total consolidado de cortes comerciais, pedidos bloqueados e devoluções;
  * Ranking oficial de fechamento das 11 filiais (🥇, 🥈, 🥉, etc.) com todos os indicadores abertos.
* **Mensagem Individual do Gerente**:
  * Fechamento dos números da filial;
  * Conquistas de recuperação de inativos da filial;
  * Fechamento operacional e encerramento do expediente.

---

## 📝 4. Modelos Reais Gerados pelo Código Atual

---

### 🔹 MODELO REAL 1: Abertura Matinal (07:00) — Diretoria
```text
🌅 *CEVEN NOC — ABERTURA MATINAL DE OPERAÇÃO (07:00)*
📅 Segunda-feira, 21/09/2026 • Grupo Triunfante
━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 *PANORAMA GERAL DA LARGADA (FORÇA DE VENDAS VAREJO):*
👥 *Vendedores Varejo em Rota (Metas + Rota >= 5):* 431 vendedores
📍 *Visitas Planejadas na Rota:* 6.842 PDVs
🎯 *Oportunidades Inativos (+30d sem compra na rota):* 1.124 PDVs (16,4% da rota — Ouro para Positivação)
🔄 *Clientes c/ TAG Recorrência na rota:* 842 PDVs (12,3% da rota — Alavanca de Faturamento)
🏬 *Oportunidades no Mapa (CNAE 5611 - Restaurantes e Similares):* +14.280 PDVs mapeados no trajeto

━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 *POTENCIAL DE LARGADA POR FILIAL (VAREJO)*

📍 *TPH — VAGNER / FÁBIO*
• Vendedores em campo: 88 • Visitas agendadas: 1.412
• 🎯 Sem compra +30d: 248 PDVs (17,6%) • 🔄 Recorrência: 194 PDVs (13,7%)
• 🔥 Campanha VOLTA COMIGO: 42 PDVs na rota (Foco prioritário de reativação)
• 🏬 Oportunidades CNAE 5611 no trajeto: +3.036 PDVs para cadastro

📍 *TBL — FÁBIO*
• Vendedores em campo: 39 • Visitas agendadas: 624
• 🎯 Sem compra +30d: 98 PDVs (15,7%) • 🔄 Recorrência: 82 PDVs (13,1%)
• 🏬 Oportunidades CNAE 5611 no trajeto: +905 PDVs para cadastro

📍 *TCV — LEONARDO*
• Vendedores em campo: 53 • Visitas agendadas: 848
• 🎯 Sem compra +30d: 132 PDVs (15,6%) • 🔄 Recorrência: 104 PDVs (12,3%)
• 🏬 Oportunidades CNAE 5611 no trajeto: +2.714 PDVs para cadastro
```

---

### 🔹 MODELO REAL 2: Parcial de Vendas (11:00 / 14:30 / 17:00) — Consolidado Diretoria
```text
📊 *RELATÓRIO OFICIAL CONSOLIDADO — 14:30*
📅 21/09/2026
🏢 *Grupo Triunfante — 11 Filiais*
⚡ Conciliado 100% com o Clube da Venda — Foco Exclusivo Varejo (VJ)
━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 *RESULTADO GERAL DA COMPANHIA:*
💰 *Total Digitado:* R$ 1.124.580,90
📦 *Total de Pedidos:* 742 pedidos
📍 *Visitas Realizadas:* 3.412 de 6.842 (49,87%)

🎯 *FORÇA DE VENDAS VAREJO:*
👥 *Total Varejo em Campo (Metas + Rota >= 5):* 431 vendedores
✅ *Positivados no Dia:* 268 vendedores (62,2%)
🚨 *Varejo Zerados (14:30):* *163 vendedores (37,8%)*

🚨 *PERDAS E ATENÇÃO OPERACIONAL HOJE:*
✂️ *Cortes nos Pedidos de Hoje:* R$ 24.810,00 (28 pedidos afetados)
🔒 *Pedidos Bloqueados Hoje:* R$ 18.240,00 (12 pedidos retidos)
🚛 *Devoluções Entradas Hoje:* R$ 8.920,00

━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *DESEMPENHO POR FILIAL (RANKING DE VENDAS)*

🥇 *1. FILIAL TPH — VAGNER / FÁBIO*
💰 Total de Pedidos: R$ 248.510,20 • 📦 Pedidos: 164
📍 Visitas Varejo: 712 de 1.412 (50,4%) • Eficácia: 11,6%
👥 Varejo com Pedido: 58 de 88 (66%) | 🚨 Varejo SEM PEDIDO: *30 (34%)*
✂️ Cortes: R$ 5.120,00 (7 ped) • 🔒 Bloqueados: R$ 3.840,00 (3 ped)
🚛 Devoluções Entradas Hoje: R$ 2.140,00

🥈 *2. FILIAL TBL — FÁBIO*
💰 Total de Pedidos: R$ 142.850,40 • 📦 Pedidos: 68
📍 Visitas Varejo: 312 de 624 (50,0%) • Eficácia: 10,9%
👥 Varejo com Pedido: 24 de 39 (62%) | 🚨 Varejo SEM PEDIDO: *15 (38%)*
✂️ Cortes: R$ 4.120,50 (5 ped) • 🔒 Bloqueados: R$ 6.840,00 (3 ped)
🚛 Devoluções Entradas Hoje: R$ 1.250,00
```

---

### 🔹 MODELO REAL 3: Parcial de Vendas (14:30) — Enviado ao Gerente da Filial
```text
🏢 *RELATÓRIO OPERACIONAL — 14:30*
📅 21/09/2026
📍 *FILIAL TBL — FÁBIO*
━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *Total Digitado Hoje:* R$ 142.850,40
📦 *Pedidos Colocados:* 68 pedidos
📍 *Visitas Realizadas:* 312 de 624 (50,0%)
👥 *Vendedores Varejo com Pedido:* 24 de 39 (61,5%)
✂️ *Cortes nos Pedidos de Hoje:* R$ 4.120,50 (5 pedidos afetados)
🔒 *Pedidos Bloqueados Hoje:* R$ 6.840,00 (3 pedidos retidos)
🚛 *Devoluções Entradas Hoje:* R$ 1.250,00

⚠️ *DETALHE DOS CORTES DE HOJE:*
  ▫️ Cód. 181 • GIOVANA BATISTA: -R$ 71,80 em MINI MERCADO DEISY (SNICKERS ORIGINAL)
  ▫️ Cód. 174 • BRUNO GUSTAVO: -R$ 135,60 em MERCADO LIDER (TWIX CARAMELO)
  ▫️ Cód. 185 • ISIDIO VALDEVINO: -R$ 210,00 em AUTO POSTO IGUAÇU (BIS XTRA)

🚨 *Varejo Zerados (14:30):* 15 (38,5%)

━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 *VENDEDORES DE VAREJO ZERADOS NO HORÁRIO (14:30):*
_(Visitas realizadas sem conversão de pedido)_

👤 *Supervisor: SERGIO LOPES DE OLIVEIRA* (4 zerados)
  ▫️ Cód. 172 • ANDREA DO ROCIO: *8 visitas feitas* (de 18 na rota) • R$ 0
  ▫️ Cód. 176 • CARLOS ALBERTO: *6 visitas feitas* (de 16 na rota) • R$ 0
  ▫️ Cód. 182 • HELIO LEMOS: *7 visitas feitas* (de 20 na rota) • R$ 0
  ▫️ Cód. 189 • JORGE LUIZ: *5 visitas feitas* (de 15 na rota) • R$ 0

👤 *Supervisor: KLEBERSON BATISTA LIDUARIO* (3 zerados)
  ▫️ Cód. 191 • MARCELO AUGUSTO: *9 visitas feitas* (de 17 na rota) • R$ 0
  ▫️ Cód. 195 • REGINALDO ROSA: *6 visitas feitas* (de 16 na rota) • R$ 0
  ▫️ Cód. 197 • ROBERTO SANTOS: *4 visitas feitas* (de 14 na rota) • R$ 0
```

---

### 🔹 MODELO REAL 4: Gestão de Campo (11:30) — Enviado ao Gerente da Filial
```text
🏢 *FILIAL TBL — GESTÃO DE CAMPO*
📅 21/09/2026 • Gerente: Fábio
━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *PAINEL DE ATIVIDADES (7 SUPERVISORES):*
📝 Compromissos: *6 de 7* lançados
🚗 Em Rota (RET): *5 de 7* em campo

━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *FABIO FURLAN MACHADO*
📝 Compromisso: ✅ Lançado
🚗 Rota (RET): ✅ Em campo (início às 08:15)
└ 👥 RCA: BRUNO GUSTAVO NATAL (174)
└ 📍 4 PDVs visitados • 📸 12 fotos • Score: 94%

👤 *SERGIO LOPES DE OLIVEIRA*
📝 Compromisso: ✅ Lançado
🚗 Rota (RET): ✅ Em campo (início às 08:35)
└ 👥 RCA: GIOVANA BATISTA DA SILVA (181)
└ 📍 3 PDVs visitados • 📸 8 fotos • Score: 88%

👤 *KLEBERSON BATISTA LIDUARIO*
📝 Compromisso: ✅ Lançado
🚗 Rota (RET): ❌ Não iniciou (0 PDVs no sistema)

👤 *EVERTON APARECIDO DA SILVA*
📝 Compromisso: ❌ Não lançado
🚗 Rota (RET): ❌ Não iniciou (0 PDVs no sistema)
```

---

### 🔹 MODELO REAL 5: Fechamento Oficial (18:30) — Consolidado Diretoria
```text
🏆 *BOLETIM DE FECHAMENTO OFICIAL DO DIA — 18:30*
📅 21/09/2026 • Grupo Triunfante (11 Filiais)
━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 *RESULTADO FINANCEIRO DO DIA:*
💰 *Total Digitado Hoje:* R$ 1.845.620,15
📦 *Total de Pedidos Colocados:* 1.284 pedidos

🟢 *CONQUISTAS E RECUPERAÇÃO DE BASE HOJE:*
🟢 *Inativos Reativados (+30d):* 186 PDVs recuperados
🔄 *Positivados com TAG Recorrência:* 214 PDVs
🔁 *Positivados com TAG Volta Comigo (TPH):* 28 PDVs

🚨 *PERDAS E ATENÇÃO OPERACIONAL HOJE:*
✂️ *Cortes nos Pedidos de Hoje:* R$ 42.150,00 (48 pedidos afetados)
🔒 *Pedidos Bloqueados Hoje:* R$ 28.310,00 (19 pedidos retidos)
🚛 *Devoluções Entradas Hoje:* R$ 14.820,50
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 *RANKING FINAL DE FECHAMENTO (11 FILIAIS):*

🥇 *1. FILIAL TPH — VAGNER / FÁBIO*
💰 Digitado Hoje: R$ 385.410,20 • 📦 264 pedidos
🟢 Inativos Reativados: 42 PDVs • 🔄 Recorrência: 51 PDVs • 🔁 Volta Comigo: 28 PDVs
✂️ Cortes: R$ 8.420,00 (11 ped) • 🔒 Bloqueados: R$ 5.120,00 (4 ped)
🚛 Devoluções Entradas Hoje: R$ 3.140,00

🥈 *2. FILIAL TBL — FÁBIO*
💰 Digitado Hoje: R$ 242.180,50 • 📦 178 pedidos
🟢 Inativos Reativados: 26 PDVs • 🔄 Recorrência: 32 PDVs
✂️ Cortes: R$ 5.120,00 (6 ped) • 🔒 Bloqueados: R$ 3.400,00 (2 ped)
🚛 Devoluções Entradas Hoje: R$ 1.850,00

🥉 *3. FILIAL TCV — LEONARDO*
💰 Digitado Hoje: R$ 218.940,00 • 📦 152 pedidos
🟢 Inativos Reativados: 22 PDVs • 🔄 Recorrência: 28 PDVs
✂️ Cortes: R$ 4.310,00 (5 ped) • 🔒 Bloqueados: R$ 4.100,00 (3 ped)
🚛 Devoluções Entradas Hoje: R$ 2.100,00
```

---

### 🔹 MODELO REAL 6: Fechamento Oficial (18:30) — Enviado ao Gerente da Filial
```text
🏢 *BOLETIM DE FECHAMENTO OFICIAL — 18:30*
📅 21/09/2026
📍 *FILIAL TBL — FÁBIO*
━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *Total Digitado Hoje:* R$ 242.180,50
📦 *Pedidos Colocados:* 178 pedidos
📍 *Visitas Realizadas:* 548 de 624 (87,8%)
👥 *Vendedores Varejo com Pedido:* 33 de 39 (84,6%)
✂️ *Cortes nos Pedidos de Hoje:* R$ 5.120,00 (6 pedidos afetados)
🔒 *Pedidos Bloqueados Hoje:* R$ 3.400,00 (2 pedidos retidos)
🚛 *Devoluções Entradas Hoje:* R$ 1.850,00

⚠️ *DETALHE DOS CORTES DE HOJE:*
  ▫️ Cód. 181 • GIOVANA BATISTA: -R$ 71,80 em MINI MERCADO DEISY (SNICKERS ORIGINAL)
  ▫️ Cód. 174 • BRUNO GUSTAVO: -R$ 135,60 em MERCADO LIDER (TWIX CARAMELO)
  ▫️ Cód. 185 • ISIDIO VALDEVINO: -R$ 210,00 em AUTO POSTO IGUAÇU (BIS XTRA)

🟢 *Recuperação de Inativos (+30d):* 26 de 98 PDVs reativados hoje

━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 *FECHAMENTO DAS OPERAÇÕES DO DIA CONCLUÍDO.*
```

---

## 🗄️ 5. Backlog Futuro (Sugestões Guardadas)

*Envios individuais hiper-personalizados para a força de vendas (RCAs) guardados para fase posterior de implantação:*
* Raio-X Matinal da Rota do Vendedor (07:15)
* Termômetro Tático Intraday / Alerta de Queima de Rota (14:30)
* Fechamento Diário Individual do Vendedor (18:45)
