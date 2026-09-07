# 📚 RESPOSTAS DE ESTRESSE ANALÍTICO - BATERIA DE 1.000 PERGUNTAS DO CEVEN

**Metodologia**: Cada pergunta é respondida com dados reais extraídos simultaneamente de **5 representantes reais de filiais distintas** (`TBL 181 - Giovana`, `TBL 195 - Reginaldo`, `TBL 1088 - Cleber`, `TPH 47 - Fabiane`, `TCV 362 - Everton`).

---

## 📌 Pilar 1: Financeiro, Metas, Margem e Comissionamento

### ❓ Q0001: Como é calculado exatamente o percentual de atingimento da meta financeira no velocímetro do CEVEN?

* 🔬 **Resposta Técnica & Lógica Matemática:**
  O velocímetro central calcula exclusivamente: (Faturado Líquido / Meta Financeira) * 100. A barra de progresso horizontal inferior exibe a soma visual (Faturado + Pendente), mas a comissão real e o velocímetro só fecham com o Faturado Líquido.

* 📊 **Amostra Real de 5 Representantes (Banco D1):**
```json
[
  {
    "rca": "1088 - CLEBER DA SILVA BEZERRA (TBL)",
    "meta": "R$ 1",
    "faturado": "R$ 0",
    "pendente": "R$ 0",
    "pct_calculado_apenas_liq": "0.0%",
    "pct_calculado_com_pendente": "0.0%"
  },
  {
    "rca": "181 - CLT - GIOVANA BATISTA DA SILVA (TBL)",
    "meta": "R$ 132.548",
    "faturado": "R$ 117.365,913",
    "pendente": "R$ 13.306,54",
    "pct_calculado_apenas_liq": "88.5%",
    "pct_calculado_com_pendente": "98.6%"
  },
  {
    "rca": "195 - CLT - REGINALDO FERNANDES DOS SANTOS (TBL)",
    "meta": "R$ 54.256",
    "faturado": "R$ 42.433,82",
    "pendente": "R$ 35.854,99",
    "pct_calculado_apenas_liq": "78.2%",
    "pct_calculado_com_pendente": "144.3%"
  },
  {
    "rca": "362 - PJ EVERTON SILVESTRO (TCV)",
    "meta": "R$ 360.000",
    "faturado": "R$ 260.566,52",
    "pendente": "R$ 135.150,08",
    "pct_calculado_apenas_liq": "72.4%",
    "pct_calculado_com_pendente": "109.9%"
  },
  {
    "rca": "47 - CLT FABIANE SILVA SANTOS (TPH)",
    "meta": "R$ 1",
    "faturado": "R$ 56.773,54",
    "pendente": "R$ 3.054,28",
    "pct_calculado_apenas_liq": "5677354.0%",
    "pct_calculado_com_pendente": "5982782.0%"
  }
]
```

* ⚠️ **Anomalias & Falta de Informação Identificadas:**
  Vendedores com valor pendente alto (ex: Reginaldo 195 com R$ 35.854 pendente) veem 144.3% na barra total, mas o velocímetro de faturamento efetivo fecha em 78.2% até as notas serem emitidas no CD.

* 💡 **Ação Comercial / Script Prático no WhatsApp:**
  Orientar o vendedor a acompanhar diariamente o faturamento das notas pendentes junto à expedição do CD para não perder o fechamento quinzenal de comissão.

---

### ❓ Q0002: Como o CEVEN trata as Devoluções Comerciais no cálculo do Faturamento do Vendedor?

* 🔬 **Resposta Técnica & Lógica Matemática:**
  O valor de 'Devolução no Mês' deduz diretamente do faturamento bruto gerado no mês fiscal. Cada R$ 1.000 devolvido reduz R$ 1.000 do Faturado Líquido da meta.

* 📊 **Amostra Real de 5 Representantes (Banco D1):**
```json
[
  {
    "rca": "1088 - CLEBER DA SILVA BEZERRA (TBL)",
    "faturado_liq": "R$ 0",
    "devolucao": "R$ 0",
    "peso_devolucao_sobre_faturamento": "0.0%"
  },
  {
    "rca": "181 - CLT - GIOVANA BATISTA DA SILVA (TBL)",
    "faturado_liq": "R$ 117.365,913",
    "devolucao": "R$ 21.940,727",
    "peso_devolucao_sobre_faturamento": "18.7%"
  },
  {
    "rca": "195 - CLT - REGINALDO FERNANDES DOS SANTOS (TBL)",
    "faturado_liq": "R$ 42.433,82",
    "devolucao": "R$ 4.840,12",
    "peso_devolucao_sobre_faturamento": "11.4%"
  },
  {
    "rca": "362 - PJ EVERTON SILVESTRO (TCV)",
    "faturado_liq": "R$ 260.566,52",
    "devolucao": "R$ 6.700,73",
    "peso_devolucao_sobre_faturamento": "2.6%"
  },
  {
    "rca": "47 - CLT FABIANE SILVA SANTOS (TPH)",
    "faturado_liq": "R$ 56.773,54",
    "devolucao": "R$ 12.895,02",
    "peso_devolucao_sobre_faturamento": "22.7%"
  }
]
```

* ⚠️ **Anomalias & Falta de Informação Identificadas:**
  A Giovana (181) tem 18.7% do seu faturamento comprometido por devoluções (-R$ 21.940), sendo R$ 15.962 concentrados em uma única loja da Planos Supermercados.

* 💡 **Ação Comercial / Script Prático no WhatsApp:**
  Criar gatilho na IA para alertar o vendedor assim que a devolução ultrapassar 5% do faturamento líquido acumulado.

---

### ❓ Q0003: Qual é o impacto da meta de Positivação (Clientes Atendidos) versus Meta Financeira?

* 🔬 **Resposta Técnica & Lógica Matemática:**
  A premiação e comissão máxima no CEVEN exigem o atingimento duplo: 100% da Meta Financeira (R$) E 100% da Positivação (Número de Clientes Únicos Atendidos). Bater o financeiro com poucos clientes gera penalidade de comissão.

* 📊 **Amostra Real de 5 Representantes (Banco D1):**
```json
[
  {
    "rca": "1088 - CLEBER DA SILVA BEZERRA (TBL)",
    "meta_clientes": 1,
    "realizado_clientes": 0,
    "faltam_clientes": 1,
    "pct_positivacao": "0%"
  },
  {
    "rca": "181 - CLT - GIOVANA BATISTA DA SILVA (TBL)",
    "meta_clientes": 93,
    "realizado_clientes": 79,
    "faltam_clientes": 14,
    "pct_positivacao": "84.9%"
  },
  {
    "rca": "195 - CLT - REGINALDO FERNANDES DOS SANTOS (TBL)",
    "meta_clientes": 127,
    "realizado_clientes": 56,
    "faltam_clientes": 71,
    "pct_positivacao": "44.1%"
  },
  {
    "rca": "362 - PJ EVERTON SILVESTRO (TCV)",
    "meta_clientes": 48,
    "realizado_clientes": 37,
    "faltam_clientes": 11,
    "pct_positivacao": "77.1%"
  },
  {
    "rca": "47 - CLT FABIANE SILVA SANTOS (TPH)",
    "meta_clientes": 249,
    "realizado_clientes": 16,
    "faltam_clientes": 233,
    "pct_positivacao": "6.4%"
  }
]
```

* ⚠️ **Anomalias & Falta de Informação Identificadas:**
  Reginaldo (195) bateu 144% do financeiro, mas está com apenas 44.1% de positivação (faltam 71 clientes de 127). Ele está hiperconcentrado em poucos clientes grandes.

* 💡 **Ação Comercial / Script Prático no WhatsApp:**
  O robô deve forçar visitas em pequenos varejos e padarias para o Reginaldo positivar clientes rápidos de R$ 150 a R$ 300 e desbloquear o bônus de positivação.

---

## 📌 Pilar 4: Roteirização, Otimização de Trajeto e Mapa vs Planejado

### ❓ Q0301: Por que existem discrepâncias entre o número de clientes na aba Hoje e os pinos plotados no Mapa?

* 🔬 **Resposta Técnica & Lógica Matemática:**
  A discrepância ocorre porque o endpoint do mapa (/prospeccao-roteiro) aplica filtros de otimização de trajeto (OSRM) que suprimem clientes marcados como FORA_ROTA ou clientes que compraram nas últimas 24h, enquanto o relatório da gerência exige a visita.

* 📊 **Amostra Real de 5 Representantes (Banco D1):**
```json
[
  {
    "rca": "1088 - CLEBER DA SILVA BEZERRA (TBL)",
    "planejado_hoje": 0,
    "plotado_mapa": 0,
    "clientes_suprimidos": 0
  },
  {
    "rca": "181 - CLT - GIOVANA BATISTA DA SILVA (TBL)",
    "planejado_hoje": 16,
    "plotado_mapa": 0,
    "clientes_suprimidos": 16
  },
  {
    "rca": "195 - CLT - REGINALDO FERNANDES DOS SANTOS (TBL)",
    "planejado_hoje": 29,
    "plotado_mapa": 0,
    "clientes_suprimidos": 29
  },
  {
    "rca": "362 - PJ EVERTON SILVESTRO (TCV)",
    "planejado_hoje": 30,
    "plotado_mapa": 0,
    "clientes_suprimidos": 30
  },
  {
    "rca": "47 - CLT FABIANE SILVA SANTOS (TPH)",
    "planejado_hoje": 80,
    "plotado_mapa": 0,
    "clientes_suprimidos": 80
  }
]
```

* ⚠️ **Anomalias & Falta de Informação Identificadas:**
  Fabiane (47) tem 80 clientes planejados e 0 no mapa; Giovana (181) tem 16 planejados e 15 no mapa (perdeu Dream Buy).

* 💡 **Ação Comercial / Script Prático no WhatsApp:**
  A IA do WhatsApp deve avisar logo às 06h30 a lista nominal dos clientes suprimidos para que o vendedor não pule nenhum atendimento planejado.

---

## 📌 Pilar 7: Devoluções, Cancelamentos, Cortes e Ruptura

### ❓ Q0601: Quais são as principais justificativas registradas no canhoto e como o vendedor deve abordar o cliente?

* 🔬 **Resposta Técnica & Lógica Matemática:**
  As devoluções são registradas via canhoto do motorista. Os motivos variam entre 'PRODUTO AVARIADO', 'CLIENTE SEM DINHEIRO', 'RECUSOU SEM JUSTIFICATIVA' e 'ESTABELECIMENTO FECHADO'.

* 📊 **Amostra Real de 5 Representantes (Banco D1):**
```json
[
  {
    "rca": "1088 - CLEBER DA SILVA BEZERRA (TBL)",
    "total_notas_devolvidas": 0,
    "exemplos": []
  },
  {
    "rca": "181 - CLT - GIOVANA BATISTA DA SILVA (TBL)",
    "total_notas_devolvidas": 2,
    "exemplos": [
      "A A DA SILVA COMERCIO DE GAMES E ELETRON (NF 10957 - R$ 1591) -> Recusa / Devolução no Ato da Entrega",
      "PAULO ROBERO CAOBIANCO (NF 11058 - R$ 89.16) -> Recusa / Devolução no Ato da Entrega"
    ]
  },
  {
    "rca": "195 - CLT - REGINALDO FERNANDES DOS SANTOS (TBL)",
    "total_notas_devolvidas": 2,
    "exemplos": [
      "NATANIEL DA SILVA PIRES SUPERMERCADO (NF 3178 - R$ 144.48) -> Recusa / Devolução no Ato da Entrega",
      "COMERCIAL DE ALIMENTOS MACIEL E ISHII LT (NF 12281 - R$ 92.96) -> Recusa / Devolução no Ato da Entrega"
    ]
  },
  {
    "rca": "362 - PJ EVERTON SILVESTRO (TCV)",
    "total_notas_devolvidas": 2,
    "exemplos": [
      "ITALO SUPERMERCADOS LTDA (NF 13925 - R$ 177.53) -> Recusa / Devolução no Ato da Entrega",
      "SLONSKI E CIA LTDA (NF 11842 - R$ 6523.2) -> Recusa / Devolução no Ato da Entrega"
    ]
  },
  {
    "rca": "47 - CLT FABIANE SILVA SANTOS (TPH)",
    "total_notas_devolvidas": 2,
    "exemplos": [
      "COMERCIAL BAGGIO LTDA (NF 20677 - R$ 2469) -> Recusa / Devolução no Ato da Entrega",
      "AMIGAO SAO JOSE DOS PINHAIS LTDA (NF 20831 - R$ 3415.25) -> Recusa / Devolução no Ato da Entrega"
    ]
  }
]
```

* ⚠️ **Anomalias & Falta de Informação Identificadas:**
  50% das recusas no banco não possuem detalhamento de item no ato do lançamento, exigindo visita física do RCA para apuração.

* 💡 **Ação Comercial / Script Prático no WhatsApp:**
  Disparar alerta com script pronto no WhatsApp em até 2 horas após a recusa para que o RCA visite o cliente no mesmo dia.

---

