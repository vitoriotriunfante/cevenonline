# Arquitetura Estratégica de Integração: CEVEN x GEROT

## 1. Princípios e Divisão de Papéis

| Pilar | CEVEN (Operação Ativa) | GEROT (Base Oficial & Inteligência) |
| :--- | :--- | :--- |
| **Papel Principal** | **Tempo Real (Live)** | **Oficial, Metas e Estratégia** |
| **Atualização** | Segundo a segundo / Minuto a minuto | Janelas programadas (09h, 11h, 13h, 15h, 17h, 19h...) |
| **Dados Exclusivos** | Lances ao vivo, atendimentos em andamento, TVs, alertas imediatos de vendedores | Metas por Indústria/Fornecedor, Histórico (M-1, YTD, 3M, Benchmarks), DRE/Margens, Devoluções e Cortes consolidados |
| **Autoridade** | Pulso da operação no momento exato | **Número Oficial Contábil/Comercial da Triunfante** |

---

## 2. Janelas de Sincronização do Robô GEROT
O GEROT processa cargas oficiais em blocos de 2 horas. O coletor automatizado sincronizará logo após as janelas de carga:
- **09h15** (Primeira consolidação matinal)
- **11h15** (Pré-almoço)
- **13h15** (Início da tarde)
- **15h15** (Ritmo da tarde)
- **17h15** (Fechamento de faturamento)
- **19h15** (Consolidação noturna diária)

---

## 3. Matriz de Auditoria Cruzada (CEVEN ⟷ GEROT)
Para garantir que a operação não divirja dos números oficiais:
1. **Auditoria de Faturamento & Carteira**: Comparar a captação do CEVEN com o Faturado + Carteira do GEROT em cada janela de 2h.
2. **Auditoria de Cortes e Devoluções**: O CEVEN detecta o pedido emitido; o GEROT confirma o que foi cortado na separação ou devolvido no transporte.
3. **Indicador de Delta (Δ)**: Alertar quando a divergência entre o tempo real e o oficial ultrapassar margens normais de processamento contábil.

---

## 4. Metas por Indústria & Atendimento ao Rudinei
- O CEVEN não possui o desdobramento de metas por fornecedor/indústria.
- O robô do GEROT coletará a visão **Resultado / Fornecedor** e **Mix de Produto / Fornecedor**.
- Quando o **Rudinei** ou a gerência solicitar a situação de indústrias específicas (ex: P&G, Bunge, Cargill, etc.), o **Jota** consulta essa base do GEROT e devolve:
  - Meta da Indústria no Mês
  - Realizado / Faturado até o momento
  - % de Atingimento
  - Carteira pendente daquela indústria

---

## 5. Suporte Estratégico à Diretoria e Gerentes
Cruzamento de inteligência comercial:
- **Comparativo Temporal**: M-1, YTD e Benchmark Jul/25.
- **RFV & Recorrência**: Clientes que positivavam todo mês e pararam de comprar.
- **DRE & Margem de Contribuição**: Quais equipes/filiais vendem com maior margem e menor desconto/bonificação.

