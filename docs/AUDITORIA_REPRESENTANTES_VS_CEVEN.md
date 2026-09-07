# 🔍 AUDITORIA EXECUTIVA: BASE DE REPRESENTANTES (CSV) VS. HIERARQUIA CEVEN (CASCATA)
> **Data:** 01/09/2026
> **Escopo:** Cruzamento integral dos 519 representantes do arquivo \`representantes (7).csv\` com a estrutura de 96 supervisores e 564 vendedores do CEVEN Gerente em 11 filiais.

---

## 📊 1. Resumo Consolidado do Cruzamento

| Indicador | Quantidade | Percentual / Observação |
| :--- | :---: | :--- |
| **Total de Registros no CSV** | **519** | Base cadastral de representantes |
| **Total de Registros no CEVEN (Cascata)** | **564** | Vendedores vinculados a supervisores |
| ✅ **Casamento Perfeito (Match Exato)** | **510** | **98,3%** dos vendedores do CSV estão conectados |
| ⚠️ **Presentes no CSV mas SEM SUPERVISOR** | **9** | Vendedores órfãos, sem rota ou vagas abertas |
| ℹ️ **Presentes no CEVEN mas FORA DO CSV** | **54** | RCAs dos próprios Supervisores/Gerentes (\`1000+\`) e inativos |

---

## 🏢 2. Comparativo Detalhado por Filial

| Filial | Qtd. no CSV | Qtd. no CEVEN | Casamento (Match) | Apenas no CSV (Sem Sup.) | Apenas no CEVEN (Adicionais) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **ABC** | 36 | 47 | **36 (100%)** | 0 | 11 |
| **API** | 45 | 56 | **45 (100%)** | 0 | 11 |
| **MCD** | 56 | 58 | **56 (100%)** | 0 | 2 |
| **TBE** | 39 | 44 | **39 (100%)** | 0 | 5 |
| **TBL** | 43 | 40 | **39 (90,7%)** | 4 | 1 |
| **TCA** | 44 | 49 | **44 (100%)** | 0 | 5 |
| **TCG** | 31 | 31 | **31 (100%)** | 0 | 0 |
| **TCV** | 53 | 57 | **53 (100%)** | 0 | 4 |
| **TPA** | 37 | 40 | **37 (100%)** | 0 | 3 |
| **TPH** | 92 | 99 | **88 (95,7%)** | 4 | 11 |
| **TSJ** | 43 | 43 | **42 (97,7%)** | 1 | 1 |
| **TOTAL** | **519** | **564** | **510 (98,3%)** | **9** | **54** |

---

## ⚠️ 3. Vendedores do CSV que NÃO aparecem conectados a nenhum Supervisor (9 Casos)

Estes 9 vendedores constam no arquivo CSV de representantes, mas **não possuem equipe/supervisor atribuído** na visão de cascata do CEVEN:

### 🏢 Filial TBL (4 casos):
1. **RCA `174`** — `CLT - JOSE ROBERTO DA SILVA` (Versão App: 7.895)
2. **RCA `178`** — `CLT - LUIZ CARLOS DE OLIVEIRA` (Versão App: 7.895)
3. **RCA `180`** — `VAGO` (Versão App: 7.892)
4. **RCA `525`** — `VAGO` (Versão App: 7.889)

### 🏢 Filial TPH (4 casos):
1. **RCA `107`** — `CLT ROBERTA DOS SANTOS CORREIA` (Versão App: 7.896)
2. **RCA `110`** — `CLT MARCOS ALEXANDRE DE VIVEIROS` (Versão App: 7.896)
3. **RCA `121`** — `VAGO 501` (Versão App: 7.892)
4. **RCA `129`** — `FABIANA MILANI CAMPOS` (Versão App: 7.892)

### 🏢 Filial TSJ (1 caso):
1. **RCA `31`** — `CLT - CLAUDEMIR GAUDENCIO PEREIRA` (Versão App: 7.896)

---

## ℹ️ 4. Por que existem 54 registros a mais no CEVEN?

A análise técnica comprovou que os 54 registros adicionais pertencem a:
1. **Códigos de Venda dos Supervisores e Gerentes (`1000+` ou `500+`):** No Winthor/CEVEN, os supervisores possuem um código RCA próprio para emissão de pedidos e ajustes (ex: `1005` Gerente API, `1100` Anderson Correia, `1101` Arildo Zago, `1016` Washington Flores, etc.).
2. **Contas de Inativos e Carteiras de Transição:** Pastas operacionais como `RCAS INATIVOS`, `LOJA MONDELEZ`, `INATIVO ABC`, `VAGO`.
