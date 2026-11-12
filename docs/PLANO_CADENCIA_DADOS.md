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
| **Check-in/out de manhã (07:00–11:30; TCA, MCD e TCG até 12:30)** | Liga: 🟨 amarelo às 10h e 🟥 abandono às 11h (horário de Brasília; 1 h depois em TCA, MCD e TCG, que estão 1 h atrás), ⚡ relâmpago (check-in até 09h; 10h nessas 3); Jota "quem não começou a rota" | o cartão sai na hora: quem fez check-in às 09:58 não pode levar amarelo, nem às 10:58 o vermelho | **10'** (todos os supervisores) | rota do gerente por supervisor (`gerente/supervisor/roteiro-hoje`, cota própria) → `rca/roteiro-hoje` só de quem faltou |
| **Compromisso do supervisor** | Plus de Liderança (até 10h) | o CEVEN trava às 10h | **5'** até 10:30, 1 leitura final, **para** | `admin/supervisores/matriz-compromissos` |
| **TAGs dos clientes (Recorrência e as campanhas que o Vitório pilota durante o dia)** | Liga: 🧤 defesa (TAG Recorrência), 🦅 inativo (sem a TAG); Jota: rota com 🏷️, "clientes da TAG X", campanhas da equipe | hoje a TAG só chega dentro do roteiro (`focos` de cada cliente): TAG criada às 10h só aparece quando o roteiro daquele vendedor for relido | **15'** pela lista em bloco do admin (`/api/admin/clientes-foco` + `/campanhas`, ainda **não usada** em produção: a medir) → roteiro do vendedor |

### 3.2 Meia em meia hora
| Dado | Quem usa | Por que | Cadência | Caminho → reserva |
|---|---|---|---|---|
| **Check-in/out à tarde (11:30–19:00; TCA, MCD e TCG a partir de 12:30)** | Liga: 🚩 impedimento VAR, ⌛ acréscimos, pênaltis (justificativa); Jota rota | penalidade pode entrar com atraso de 30 min (fila do VAR) sem prejuízo; 1,9 visita/h por vendedor | **30'** | rota do gerente → `rca/roteiro-hoje` |
| **RET do supervisor** | Plus de Liderança, Jota do supervisor | ~1 visita/30 min por supervisor | **15'** de manhã (07:00–12:00), **30'** à tarde (12:00–19:00) | `admin/supervisores/matriz-ret` (1 por filial) |
| **Visitas plan/real e eficácia de cada vendedor** | Jota (momentos), TV, boletins | cascata traz a filial inteira numa chamada | **30'** (10' de manhã junto com o check-in) | `gerente/tabelas-cascata` → `rca/produtividade` só como conferência |
| **Status do pedido / corte / bloqueio** (pedidos abertos) | boletins (cortes, bloqueados), Jota "pendentes", gol cancelado | muda quando o faturamento anda | **30'** por vendedor com pedido aberto | Winthor por número → histórico do cliente |
| **Faturado, pendente e positivação do mês por vendedor** | Jota, TV, boletins, 🏆 campeão da rodada | quem mudou já vem pelo detector; o rodízio é só segurança | quem mudou: **TR**; todos: **30'** | admin dashboard → última leitura do mês → GEROT |

### 3.3 De hora em hora ou N vezes por dia
| Dado | Quem usa | Por que | Cadência | Caminho → reserva |
|---|---|---|---|---|
| **Devoluções (valor e nota)** | Liga: ⚽ gol contra, 🟥 vermelho "não pediu"; Jota; boletins | penaliza, mas não precisa ser no minuto; a nota chega com a data dela | valor: pelo detector (**TR**, de graça); nota e motivo: **1h**, só de quem teve devolução alterada | admin dashboard + `rca/devolucoes/{nota}` → GEROT (devolução por indústria) |
| **GEROT** (indústria × vendedor, recorrência) | painel de indústrias, Jota indústria, 🧤 defesa (recorrência), reserva do faturado | o GEROT carrega em janelas | **6×/dia**: 07:15, 09:15, 11:15, 14:15, 17:15, 19:15 (já existe) | — (é a reserva dos outros) |
| **Prospects** | Jota (prospecção), mapa | o vendedor pode olhar no app; o Jota mostra o que tiver com a data | **madrugada** (todos) + 09:30, 12:30, 15:30 só de quem tem rota hoje; se falhar, fica o último com a data | `ceven/prospeccao-roteiro` → último gravado |
| **Conferência GEROT × CEVEN** (meta, faturado, carteira, devolução, positivação por vendedor) | **só auditoria e aviso ao Vitório** — as telas não mostram as duas fontes lado a lado (12/11: "está deixando o povo confuso") | as duas fotos têm que ser do **mesmo momento**: em 11/11 o GEROT era de 14:10 e o CEVEN de 16:28 e não dá para separar atraso de divergência | a cada carga do GEROT: foto do CEVEN tirada logo depois, gravada junto; relatório de divergências para o Vitório de madrugada | — |
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
| **Batimento completo com o GEROT** | Vitório | toda madrugada: vendedor × indústria (meta, faturado, carteira, devolução, positivação) e filial; divergência acima do limite vai para o Vitório no WhatsApp com a lista (pedido de 12/11) |
| Auditoria em cascata (vendedor → diretoria) | relatório do Vitório | pronta às 06:00 |
| Compactação do histórico (dias antigos só com números) | custo do D1 | depende do OK do Vitório |

### 3.5 Uma vez por semana / por mês
| Dado | Cadência |
|---|---|
| Roteiro do mês inteiro por vendedor (+MIX do mês) | **1×/mês** (dia 1) + **1×/semana** (domingo) para pegar cliente que entrou ou saiu; durante o dia só o check-in |
| Catálogo de indústrias, CNAE, linha corporativa, patrocinadores | **1×/semana** (domingo) ou quando o Vitório mudar |
| Limpeza: tabelas paradas (`mapa_executivo_live` 24/10, `rca_kpis` 24/09), caches velhos | **1×/semana** |

### 3.6 Fonte de cada dado: CEVEN, GEROT ou Winthor
Regra: vale a **principal**; se ela não tiver leitura de hoje, entra a **reserva** com a fonte e a hora na tela; a **conferência** grava a diferença das duas.
Medido em 11–12/11: o GEROT bate com o CEVEN em parte dos vendedores (TBL 189: R$ 67.080 nos dois) e fica **incompleto** em outros (TCV 352: R$ 4.424 × R$ 14.851; TBL 181: R$ 27.327 × R$ 76.874; TPA: 45 vendedores no GEROT × 64 no CEVEN). Por isso o GEROT ainda **não pode ser o total do vendedor**; é principal só onde ele é a única fonte (indústria, recorrência).

| Dado | Principal | Reserva | Conferência |
|---|---|---|---|
| Pedidos do dia (digitado, nº de pedidos) | **Winthor** (pedido_status) | produtividade do CEVEN | Winthor × produtividade, 1h |
| Status / corte / bloqueio do pedido | **Winthor** | histórico do cliente (CEVEN) | — |
| Faturado e pendente do mês (vendedor, supervisor, filial) | **CEVEN** (dashboard) | última leitura do CEVEN no mês → GEROT (faturado líquido + carteira) só se não houver nenhuma | GEROT × CEVEN, 07:30 e 19:30 |
| Meta do vendedor / filial | **CEVEN** (hierarquia oficial) | última leitura do mês | GEROT × CEVEN (meta) |
| Positivação do mês (clientes) | **CEVEN** | última leitura do mês | — (positivação do GEROT é por indústria: não soma) |
| Faturado, meta, carteira e positivação **por indústria** | **GEROT, só ele** (12/11: a resposta de indústrias não mistura mais o CEVEN) | — | auditoria noturna |
| Recorrência (meta 80%, TAG) | **GEROT** (tela Recorrência) | TAG do CEVEN no roteiro | — |
| Devolução (valor) | **CEVEN** (dashboard) | GEROT (devolução) | GEROT × CEVEN |
| Devolução (nota, motivo "não pediu") | **CEVEN** (`devolucoes/{nota}`) | — (sem nota: o vermelho espera, não pune sem prova) | — |
| Rota do dia, check-in/out, justificativa | **CEVEN** (rota do gerente) | `rca/roteiro-hoje` → roteiro do mês (lista sem status) | cascata (visitas) × rota |
| Visitas plan/real, eficácia | **CEVEN** (cascata do gerente) | produtividade do vendedor | — |
| RET e compromisso | **CEVEN** (admin matriz) | — | — |
| Prospects | **CEVEN** | último gravado, com a data | — |
| Histórico do cliente, ficha, +MIX | **CEVEN** (Data Lake D-1 + histórico) | último gravado | — |
| Árvore e canal | **CEVEN** + Gestão de Equipe (mostra/grupo) | última árvore | divergências na Gestão |

Quando o GEROT ficar completo (todos os vendedores e indústrias, batendo com o CEVEN por 5 dias seguidos na conferência), ele pode passar a reserva oficial do faturado total.

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

## 9. Inventário: tudo o que o projeto mostra e de qual dado depende (levantado no código em 12/11)
### 9.1 Liga (Champions) — cada lance e o dado que ele exige
| Lance | Dado de que depende | Cadência mínima do dado |
|---|---|---|
| 🏆 Campeão (meta do mês) | faturado + meta do vendedor | 30' |
| ⚽ Goleada (≥10 positivados no dia) · 💎 Super Pedido · ⏱️ Meta do 1º tempo (antes das 14h) | pedidos do dia (Winthor) + meta | TR |
| ⭐ Marca Própria · 🌟 Tripla MP · gol de patrocinador · Gol Qualificado (indústrias no pedido) | **itens** do pedido + catálogo de indústrias | TR (itens vêm com o pedido) |
| ⚡ Relâmpago (check-in até 09h / 10h no fuso) · ⌛ Acréscimos (16h30–18h / 17h30–19h) · 🔥 Hat-trick · ⚙️ Conversão · 📝 Pedido na rota | sequência de check-ins do roteiro + pedidos | 10' manhã / 30' tarde |
| 🦅 Inativo · 📦 Dobrou o Mix · 📅 Quinzenas | histórico do cliente (D-1) + pedido de hoje | madrugada + pedido em TR |
| 🧤 Defesa | TAG Recorrência + pedido | TAG 15' + pedido TR |
| 🟨 Amarelo (10h) · 🟥 Abandono (11h) | check-in | 10' até 11:30 (12:30 no fuso) |
| 🚩 Impedimento VAR (GPS > 500 m, visita 00:00) · 🚨 Pênaltis (justificativa) | check-out com GPS e justificativa | 30' |
| ⚽ Gol contra · 🟥 Vermelho "não pediu" | devolução com nota e motivo | 1h |
| Plus de Liderança | compromisso (até 10h) e RET | 5' / 15'–30' |

### 9.2 Jota — ~80 respostas, agrupadas pelo dado
| Grupo | Respostas (arquivo) | Dado |
|---|---|---|
| Momentos (vendedor, supervisor, gerente) | `momentos.js` | snapshot (faturado, pendente, meta, visitas), pedidos Winthor, rota do gerente, RET/compromisso, recorrência GEROT, 5 clientes de foco do dia |
| Rota, carteira, TAGs, campanhas, positivação, a visitar, check-in da equipe | `rota.js` | roteiro do dia e do mês (com TAGs), ficha do cliente, pedidos do dia |
| Resumo, hoje, falta, vendedor, supervisor, todos | `resumo.js` | snapshot + lances + liga + +MIX |
| Gestão: ritmo, tendência, ranking, maior gap, meta batida, pontos perdidos, dobradinha, comparar | `gestao.js` | snapshot + lances + histórico de dias (D1) |
| Vendas: cliente, produto, preço, top produtos, pedido por número, pendentes, recuperação, MP ao vivo | `vendas.js` | pedidos do dia/abertos (Winthor), histórico do cliente, catálogo |
| Períodos: dias sem pedido, comparar mês, clientes sem comprar, positivados mês anterior | `periodos.js` | histórico guardado no D1 |
| Indústrias e metas de indústria, KPIs da premiação | `painel_industrias.js`, `gerot_industria.js`, `metas_industria.js` | **GEROT** (só ele, desde 12/11) |
| Indicadores: recorrência, devoluções e motivos, divergências, bola cheia, liga AS, semana, incentivo | `indicadores.js` | GEROT recorrência, devoluções com nota, D1 |
| Operação: relatório, gestão de campo, lances de recorrência | `operacao.js` | pedidos do dia, lances, RET |
| Oportunidades: oferecer (+MIX), justificativas | `oportunidades.js` | histórico do cliente, +MIX |
| Prospects, segmentos CNAE, pastas, mapas | `segmentos_pastas.js` | prospects (CEVEN), +MIX, CNAE |
| Liga: tabela, lances, regras, compromisso, mix, menus, glossário | `liga_mix.js` | lances, liga, +MIX, supervisores |

## 10. GEROT × CEVEN medido (11/11, CEVEN 16:28 × GEROT carga 14:10)
- **Faturado:** 327 vendedores batem (±2%), 128 com o CEVEN acima (+R$ 1,05 mi), 20 com o GEROT acima (−R$ 46 mil). Pedidos que viraram FATURADO entre 14:10 e 16:28 no nosso registro: R$ 466 mil (registro parcial). **Conclusão: com as fotos em horários diferentes não dá para separar atraso de divergência** → a conferência tem que tirar a foto do CEVEN logo depois de cada carga do GEROT (seção 3.3).
- **Faturado + carteira:** 163 batem nos dois; 46 batem no total mas não na divisão (ex.: Tamara: GEROT 4.424 + 15.805 = R$ 20,2 mil × CEVEN 14.851 + 5.802 = R$ 20,7 mil: o CEVEN já conta como faturado o que o GEROT ainda tem em carteira); 248 não batem nem no total (a maior parte é pedido digitado depois das 14:10, num dia de R$ 5 mi).
- **Diferenças de estrutura (não são horário):** 71 códigos só no GEROT (meta R$ 1,63 mi; ex.: TCA 402 Maycon Barboza R$ 135 mil faturado e meta R$ 250 mil, MCD 428 Gabriela Vieira Lopes meta R$ 575 mil, TBL 171 Almir R$ 187 mil de meta, API 2 "CLT - Venda Indústrias") → entram na Gestão de Equipe como divergência; vendedores com pendente alto no CEVEN e carteira zero no GEROT (TCG 483 Ana Carolina R$ 237 mil, TPH 50 R$ 116 mil, TPA 135 R$ 28 mil) → investigar o que o CEVEN chama de pendente nesses casos.
- **O GEROT parou em 11/11 14:10** (rodapé do próprio GEROT: "carga 11/11 14:10h"). O nosso robô rodou em 11/11 16:35, 19:19, 22:55 e 12/11 09:20 e recebeu os mesmos dados. O CEVEN parou às 17:34 do mesmo dia: possível causa comum na TI.
