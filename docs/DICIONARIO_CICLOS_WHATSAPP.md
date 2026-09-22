# Dicionário Oficial dos Ciclos de Disparo WhatsApp (CEVEN NOC)

Fonte: `pipeline/ceven_unified_engine.js` (Sistema A — único confirmado ativo via `.github/workflows/ceven-cron-whatsapp.yml`).

Cada ciclo abaixo documenta: gatilho, ação, quem recebe, e **campo a campo** o que entra na mensagem.

---

## 04:00 BRT — Aquecimento Noturno (`acao=aquecimento_matinal`)

- **Não envia mensagem nenhuma.** Só coleta dados pesados da rota de varejo de todas as filiais (`coletarAberturaVarejo`) e salva em cache local `pipeline/dados_abertura_matinal.json`.
- Existe para o ciclo das 07:00 ser instantâneo (reaproveita o cache em vez de coletar tudo de novo).
- **Hoje esse cache não é commitado no git** (mesmo bug do arquivo de hierarquia) — cada execução na nuvem recomeça do zero.

## 07:00 BRT — Abertura Matinal (`acao=abertura`)

- **Destinatário:** só Vitório (`WHATSAPP_VITORIO`). Não vai para gerentes.
- **Fonte de dados:** `coletarAberturaVarejo()` — por vendedor de Varejo (VJ) com rota ≥ 5 PDVs, busca `/api/rca/roteiro-hoje`.
- **Campos da mensagem:**
  - Total de vendedores de Varejo em rota (filtro: canal VJ + meta_fat>0 + meta_pos>0 + rota≥5)
  - Total de visitas planejadas na rota (soma de PDVs agendados)
  - PDVs "inativos" = sem compra há mais de 30 dias (ou nunca comprou) — contagem e % da rota
  - PDVs com TAG "RECORRENCIA" — contagem e %
  - Oportunidades no mapa: estimativa de PDVs do CNAE foco (padrão 5611 - Restaurantes) que ainda não estão cadastrados, calculada como `visitas × ratio_por_filial` (ratio é um número fixo configurado por filial em `config/diretrizes_operacionais.json`, **não é contagem real de PDVs**, é uma estimativa multiplicativa)
  - Por filial: vendedores em campo, visitas agendadas, % inativos, % recorrência, e (só TPH) contagem da campanha "Volta Comigo"

## 11:00 / 14:30 / 17:00 BRT — Parciais de Vendas & Zerados (`acao=vendas_zerados`)

- **Destinatários:** consolidado para Vitório + mensagem individual para cada um dos 14 gerentes (só a filial dele).
- **Fonte de dados:** `coletarVendasEZerados()` — por vendedor: `/api/rca/produtividade`, `/api/rca/dashboard`, `/api/rca/devolucoes`; depois `/api/rca/roteiro-hoje` + `/api/rca/historico-cliente/{id}` para apurar cortes/bloqueios PDV a PDV.
- **Campos do consolidado (Diretoria):**
  - Total digitado (R$) e total de pedidos, no dia inteiro (todos os canais, não só VJ)
  - Visitas realizadas vs. programadas (só VJ válido) e % eficiência
  - Total de vendedores VJ válidos, quantos positivaram, quantos estão "zerados" no horário
  - Cortes de hoje (R$ e qtd de pedidos afetados) — corte = diferença entre valor original do pedido e valor faturado, ou itens explicitamente cortados
  - Pedidos bloqueados hoje (R$ e qtd)
  - Devoluções que entraram hoje (R$)
  - Ranking das 11 filiais por faturamento digitado
- **Campos da mensagem individual do gerente (só a própria filial):**
  - Mesmos KPIs acima, recortados pra filial
  - Detalhe dos primeiros 4 cortes do dia (código do RCA, vendedor, cliente, valor, item)
  - Lista nominal dos vendedores VJ zerados no horário, **agrupados por supervisor**, com visitas feitas vs. programadas

**Regra de "zerado":** vendedor VJ válido sem digitação, sem positivação e sem visita-com-venda até aquele horário. É um corte no tempo — o mesmo vendedor pode estar "zerado às 11:00" e não estar mais "zerado às 14:30" se vender depois.

## 11:30 BRT — Gestão de Campo (`acao=gestao_campo`)

- **Destinatários:** consolidado para Vitório + mensagem individual por filial pros 14 gerentes.
- **Fonte de dados:** `coletarAuditoriaCampo()` — `/api/admin/supervisores/matriz-compromissos` e `/api/admin/supervisores/matriz-ret` (autenticado como admin), depois `/api/admin/ret/periodo` por supervisor com RET feito.
- **Campos:**
  - Por supervisor: se lançou "compromisso" do dia (planejamento) e se iniciou rota (RET) — com horário do primeiro check-in, nome do RCA que acompanhou, quantidade de PDVs visitados, fotos tiradas, score médio de IA do checklist
  - Ranking das filiais por % de compromissos + % de RET
  - Total de supervisores sem compromisso lançado e sem rota iniciada

**Este é o único ciclo que NÃO depende do arquivo de hierarquia `scripts/supervisores_11_filiais_completo.json`** — por isso é o único que funciona hoje mesmo com o bug.

## 18:30 BRT — Fechamento Oficial (`acao=vendas_zerados`, mesma função, `horaLabel='18:30'`)

- Mesma coleta do bloco de 11:00/14:30/17:00, mas o texto muda de formato (`isFechamento=true`):
  - Título vira "Boletim de Fechamento Oficial"
  - Ranking usa medalhas 🥇🥈🥉 e reordena por faturamento
  - Troca a seção de "zerados no horário" por "Recuperação de Inativos" (quantos PDVs inativos foram reativados hoje) e positivados por TAG Recorrência/Volta Comigo
  - Mensagem do gerente fecha com "Fechamento das operações do dia concluído" em vez da lista de zerados

---

## Envio técnico (vale pra todos os ciclos que mandam mensagem)

- Via **Evolution API** (self-hosted Railway), não GreenAPI
- Sequencial: Vitório primeiro, espera 30s, depois cada gerente um por um com 30s de intervalo — ~7 min pra completar os 14 gerentes
- 3 tentativas por envio, 2s fixos entre tentativas
- Falha de envio só aparece no log do GitHub Actions — ninguém é avisado automaticamente

## O que falta pra esse dicionário ficar 100% (pontos em aberto)

1. A "árvore de supervisores" (`scripts/supervisores_11_filiais_completo.json`) é gerada por `scripts/atualizar_arvore_viva_11_filiais.js`, que **ainda não está automatizado** — é o bug raiz que impede 07:00/11:00/14:30/17:00/18:30 de funcionar hoje (correção pendente de aprovação sua).
2. O ratio de "oportunidades no mapa" (07:00) é um número fixo por filial, não uma contagem real — vale confirmar se você quer manter essa estimativa ou trocar por dado real de outro endpoint.
3. Ainda não integrei o novo HAR de métricas de RV (`analises/ceven.drivetriunfante-locomotiva.com.br - Vendedor - 22-09.har`) — isso é next-step separado pra popular metas por indústria.
