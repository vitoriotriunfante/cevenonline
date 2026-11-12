# PLANO DE CADÊNCIA — dado por dado (12/11/2026)

> Pedido do Vitório (12/11/2026): "avalie dado por dado o que realmente precisa ser populado em tempo real, o que dá para ser de meia em meia hora, de 1 em 1 hora, 1 vez por dia, 5 vezes por dia, 1 vez por semana… garantindo que durante o dia eu tenha tudo populado, mesmo que em horários diferentes para cada tipo de informação."
> Base: `docs/BASE_UNICA.md` §3 (quando cada dado muda, medido no histórico do D1), `docs/AUDITORIA_DADOS_2026-11-11.md`, regulamento da Liga (`public/pontuacao_brasileirao.json` 2026-10-19.2), medições de 12/11 (D1: 739 mi linhas lidas/24 h; CEVEN 500 desde 11/11 17:34).

## 1. Os princípios (valem para todos os dados)
1. **Cada dado tem a SUA cadência e a SUA fila.** Hoje é um único cron de 2 min fazendo tudo em 170 s; quando um passo atrasa, os outros ficam sem vez. Isso deixou a TBL sem produtividade em 11/11. Cada dado passa a ter janela e orçamento próprios.
2. **Nunca vazio, nunca zero falso.** Toda tela mostra o último valor real com a fonte e a hora ("CEVEN de 11/11 16:28", "GEROT 07:15"). Sem leitura nenhuma = "sem dado", nunca 0.
3. **Duas fontes, uma cobre a outra** (CEVEN + GEROT + Winthor), sempre com prioridade definida e conferência gravada.
4. **Durante o dia, só o que muda. À noite, tudo de novo e conferido.** A madrugada (00:30–06:00) tem a cota do CEVEN livre: relê todo mundo, confere e corrige. A manhã amanhece certa.
5. **Dia fechado da Liga não muda sozinho.** A conferência da noite só aponta divergência na auditoria; quem decide é o Vitório.
6. **A cota `/api/rca` (3–4 chamadas/min, ~200/h) é só para o que não existe em outro caminho**: check-in de quem o gerente não mostra, histórico do cliente com pedido novo e nota de devolução. O resto vai por caminhos em bloco (admin, gerente, Winthor, GEROT).

## 2. As cotas (o que temos para gastar)
| Caminho | Cota medida | Traz |
|---|---|---|
| `/api/rca/*` | 3–4/min (~200/h) para tudo junto | produtividade, roteiro-hoje, devoluções, histórico do cliente, prospecção |
| `/api/admin/view-as/rca/dashboard` | ~100/min | meta, faturado, pendente, devolução, positivação (1 vendedor por chamada) |
| `/api/admin/filiais/hierarquia`, `admin/supervisores/matriz-*` | 1 chamada = rede/filial inteira | detector de mudança, metas oficiais, RET, compromisso |
| `/api/gerente/*` (cascata, supervisor/roteiro-hoje, dashboard-cascata) | cota própria (cabeçalho: 100) | visitas plan/real de todos, rota com check-in/out de cada supervisor, painel |
| Winthor (`historico-vendedor` / consulta por número) | ~5 vendedores por rodada | todos os pedidos (inclui loja Mondelez e digitados no Winthor) |
| GEROT (GitHub Actions) | sem cota do CEVEN | indústria × vendedor: meta, faturado, carteira, devolução, positivação, recorrência |

## 3. Dado por dado
Legenda de cadência: **TR** = tempo real (2–5 min) · **10'** / **30'** / **1h** · **N×/dia** · **1×/dia (madrugada)** · **1×/semana** · **1×/mês**.

### 3.1 Precisa de tempo real (decide gol, cartão ou cobrança na hora)
| Dado | Quem usa | Por que essa cadência | Cadência | Caminho principal → reserva |
|---|---|---|---|---|
| **Pedidos do dia (aba P Winthor)**: número, cliente, valor, status | Liga (todos os gols de pedido: relâmpago, acréscimos, hat-trick, super, MP, qualificado, pedido na rota), Jota "vendido hoje", boletins, TV | pico de ~220 pedidos/h às 10–11h; gol tem que nascer no minuto | **TR**, guiado pelo detector (quem teve pendente subindo vai primeiro; rodízio garante todos a cada ≤ 2 h) | Winthor → histórico do vendedor (`/api/rca`) |
| **Detector de mudança** (pendente, faturado, positivação, devolução de cada vendedor) | ordena todas as filas | 1 chamada traz a rede inteira | **2 min** | admin hierarquia → admin dashboard (70/rodada) |
| **Check-in/out de manhã (07:00–10:30)** | Liga: 🟨 amarelo às 10h, 🟥 abandono, ⚡ relâmpago; Jota "quem não começou a rota" | o cartão sai às 10h: quem fez check-in às 09:58 não pode levar amarelo | **10'** (todos os supervisores) | rota do gerente por supervisor (`gerente/supervisor/roteiro-hoje`, cota própria) → `rca/roteiro-hoje` só de quem faltou |
| **Compromisso do supervisor** | Plus de Liderança (até 10h) | o CEVEN trava às 10h | **5'** até 10:30, 1 leitura final, **para** | `admin/supervisores/matriz-compromissos` |

### 3.2 Meia em meia hora
| Dado | Quem usa | Por que | Cadência | Caminho → reserva |
|---|---|---|---|---|
| **Check-in/out à tarde (10:30–19:00)** | Liga: 🚩 impedimento VAR, ⌛ acréscimos, pênaltis (justificativa); Jota rota | penalidade pode entrar com atraso de 30 min (fila do VAR) sem prejuízo; 1,9 visita/h por vendedor | **30'** | rota do gerente → `rca/roteiro-hoje` |
| **RET do supervisor** | Plus de Liderança, Jota do supervisor | ~1 visita/30 min por supervisor | **15'** de 07:00 a 19:00 | `admin/supervisores/matriz-ret` (1 por filial) |
| **Visitas plan/real e eficácia de cada vendedor** | Jota (momentos), TV, boletins | cascata traz a filial inteira numa chamada | **30'** (10' de manhã junto com o check-in) | `gerente/tabelas-cascata` → `rca/produtividade` só como conferência |
| **Status do pedido / corte / bloqueio** (pedidos abertos) | boletins (cortes, bloqueados), Jota "pendentes", gol cancelado | muda quando o faturamento anda | **30'** por vendedor com pedido aberto | Winthor por número → histórico do cliente |
| **Faturado, pendente e positivação do mês por vendedor** | Jota, TV, boletins, 🏆 campeão da rodada | quem mudou já vem pelo detector; o rodízio é só segurança | quem mudou: **TR**; todos: **30'** | admin dashboard → última leitura do mês → GEROT |

### 3.3 De hora em hora ou N vezes por dia
| Dado | Quem usa | Por que | Cadência | Caminho → reserva |
|---|---|---|---|---|
| **Devoluções (valor e nota)** | Liga: ⚽ gol contra, 🟥 vermelho "não pediu"; Jota; boletins | penaliza, mas não precisa ser no minuto; a nota chega com a data dela | valor: pelo detector (**TR**, de graça); nota e motivo: **1h**, só de quem teve devolução alterada | admin dashboard + `rca/devolucoes/{nota}` → GEROT (devolução por indústria) |
| **GEROT** (indústria × vendedor, recorrência) | painel de indústrias, Jota indústria, 🧤 defesa (recorrência), reserva do faturado | o GEROT carrega em janelas | **6×/dia**: 07:15, 09:15, 11:15, 14:15, 17:15, 19:15 (já existe) | — (é a reserva dos outros) |
| **Prospects** | Jota (prospecção), mapa | o vendedor pode olhar no app; o Jota mostra o que tiver com a data | **madrugada** (todos) + 09:30, 12:30, 15:30 só de quem tem rota hoje; se falhar, fica o último com a data | `ceven/prospeccao-roteiro` → último gravado |
| **Conferência GEROT × CEVEN** (meta, faturado, positivação por vendedor) | alarme, auditoria | diferença de janela é normal; o que importa é a tendência | **2×/dia**: 07:30 e 19:30, gravada | — |
| **Conferência Winthor × produtividade** (digitado) | auditoria | detecta pedido que não entrou | **1h** | — |

### 3.4 Uma vez por dia (madrugada, 00:30–06:00, cota livre)
| Dado | Quem usa | Observação |
|---|---|---|
| Árvore (vendedor → supervisor → gerente) e canal | todos | +1 conferência às 12:00 (troca de equipe no meio do dia) |
| Metas oficiais (hierarquia) | todos | meta muda raramente; conferir às 12:00 também |
| **Releitura completa de todos os vendedores** (dashboard, produtividade, roteiro do dia, devoluções) | base inteira | é o que garante a manhã certa, mesmo que a tarde de ontem tenha falhado |
| Rota do dia (lista de clientes) | Jota rota, +MIX, Liga | fica pronta à meia-noite; só 1–3% mudam durante o dia (o check-in de 10'/30' pega) |
| Histórico do cliente (D-1) e ficha do cliente | Jota ficha, +MIX, 🦅 inativo, 📅 quinzenas, 📦 mix | fechado até ontem |
| +MIX do dia (a partir do roteiro do mês já gravado) | Jota, +MIX | só recalcula cliente que mudou |
| Fechamento e auditoria da Liga | Liga | fechamento 19:30 (já existe); auditoria lance a lance e conferência com o CEVEN de madrugada, **só aponta** |
| Auditoria em cascata (vendedor → diretoria) | relatório do Vitório | pronta às 06:00 |
| Compactação do histórico (dias antigos só com números) | custo do D1 | depende do OK do Vitório |

### 3.5 Uma vez por semana / por mês
| Dado | Cadência |
|---|---|
| Roteiro do mês inteiro por vendedor (+MIX do mês) | **1×/mês** (dia 1) + **1×/semana** (domingo) para pegar cliente que entrou ou saiu; durante o dia só o check-in |
| Catálogo de indústrias, CNAE, linha corporativa, patrocinadores | **1×/semana** (domingo) ou quando o Vitório mudar |
| Limpeza: tabelas paradas (`mapa_executivo_live` 24/10, `rca_kpis` 24/09), caches velhos | **1×/semana** |

## 4. Orçamento: cabe na cota?
- **`/api/rca` (~200/h):** sai a produtividade individual (vem pela cascata e pelo Winthor). Sobram: roteiro só de quem a rota do gerente não mostrou (estimativa a medir: < 30/h), histórico do cliente com pedido novo (~1 por pedido em rota; no pico ~150/h) e notas de devolução (< 10/h). **No pico das 10–11h fica no limite**: histórico do cliente entra em fila, com o Winthor nascendo o gol primeiro (os gols de cliente podem atrasar até 30').
- **Gerente (cota própria):** rota de ~99 supervisores a cada 10' = ~600 chamadas/h de manhã; a cada 30' = ~200/h à tarde. **A medir** quando o CEVEN voltar (cabeçalho mostra limite 100; falta saber a janela).
- **Admin:** hierarquia 30/h + dashboard 70 a cada 2 min = folga atual.
- **D1:** com o índice de 12/11 e o fim do JOIN pesado, a leitura cai de ~739 mi para ~160 mi linhas/dia (a medir em 13/11). Cada fila nova lê só o dia de hoje, com índice.

## 5. Como fica a arquitetura
1. **Um agendador, várias filas.** O cron de 2 min passa a chamar filas independentes, cada uma com janela, cadência e orçamento de tempo próprios (detector, Winthor, check-in, RET/compromisso, cascata, devolução, histórico do cliente). Uma fila atrasada não come o tempo das outras.
2. **Painel de frescor** (`/api/saude`): para cada dado, a última leitura, quantos do dia e o limite aceito; aviso no WhatsApp do Vitório quando passar do limite (no máximo 1×/h).
3. **Toda tela com fonte e hora** quando não for a leitura ao vivo (já feito no Jota rota em 12/11).

## 6. Estado em 12/11 09:20 (CEVEN com erro 500 desde 11/11 17:34)
- ✅ funcionando: admin `matriz-*` (RET/compromisso, 09:14), Winthor (29 pedidos de hoje), GEROT (última posição 11/11 15:21; carga em andamento), lances (4 hoje).
- ❌ parados: `/api/rca/*`, `view-as dashboard`, gerente (cascata, rota, painel): todos com 500.
- Base de hoje: Jota, TV e boletins usam o reforço (última leitura do CEVEN no mês + roteiro do mês), com fonte e hora.

## 7. Ordem de execução proposta
1. Separar as filas no cron (5.1) e criar o painel de frescor (5.2).
2. Check-in pela rota do gerente (10' manhã / 30' tarde) e visitas pela cascata. Libera a cota `/api/rca`.
3. Madrugada completa: releitura de todos, conferências, auditorias, +MIX.
4. Conferência GEROT × CEVEN gravada 2×/dia.
5. Compactação do histórico (com OK do Vitório).

## 8. Decisões do Vitório
1. Cadências da seção 3: aprovar ou ajustar alguma.
2. Liga: a conferência noturna só aponta divergência (recomendado) ou corrige sozinha os lances do dia?
3. Compactação do histórico antigo (só números nos dias anteriores, depois de exportar tudo).
