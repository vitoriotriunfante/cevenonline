# BASE ÚNICA — um coletor, uma base, todos leem dela

> Decisão do Vitório (26/10/2026): "Precisamos ter uma base ÚNICA, alimentada pelos endpoints do CEVEN. Cada endpoint pega um tipo de informação e cada informação sofre ou não alterações durante o dia. TVs, PCs, WhatsApp, JOTA e +MIX leem essa base."
> Este documento é o lugar único do plano. Toda mudança de cadência ou de leitor é registrada aqui, com data.

## 1. Regra
1. **Só o coletor fala com o CEVEN.** Hoje o coletor é `functions/api/cron-varredura-central.js` (cron a cada 2 min).
2. **Todo o resto lê o D1.** TV, Matriz, celular, motor do WhatsApp, Liga, incentivo, JOTA, +MIX, conferências.
3. **Cada dado é buscado no ritmo em que muda** (medido abaixo), não "tudo de todos sempre".
4. **Sem 100% lido, nada sai** (tela mostra "aguardando", WhatsApp espera). Nunca soma parcial, nunca estimativa.

## 2. As duas cotas do CEVEN (medidas)
| Caminho | Cota | Quem usa hoje |
|---|---|---|
| `/api/rca/*` (X-App-Secret) | **3 a 4 chamadas/min** (~200/h) para TODOS os nossos sistemas juntos; passou disso, 429 por ~60 s | coletor, telas (até 26/10), motor do WhatsApp, lances, conferência, radar, vendedor-detalhe |
| `/api/admin/view-as/rca/*` (token admin) | **~100 chamadas/min** (medido 13/10) | coletor, só para `dashboard` |
| `/api/admin/filiais/hierarquia`, `/api/admin/supervisores/matriz-*` | 1 chamada traz a filial/rede inteira | coletor (hierarquia), tv-supervisores, motor |

**Conclusão:** a cota de `/api/rca/*` não comporta vários leitores. Ela é do coletor e de mais ninguém.

## 3. Quando cada dado muda (medido no histórico do D1)
Fontes: `varredura_central_rca` (roteiro de cada dia, 29/09 a 26/10) e `piloto_pedidos_intraday` (1,7 milhão de leituras de 03/10 a 25/10).

- **Rota do dia (`total_programado`, lista do roteiro):** já está pronta à **meia-noite** (a leitura das 00:07 já traz a rota final). Durante o dia só **6 a 19 vendedores** (1–3%) têm a rota alterada, espalhados entre 08h e 19h.
- **Visitas (check-in):** começam às 07h, pico 09h–10h (~4.200 check-ins/h na rede), 97% até 17h, quase zero depois das 19h. **Por vendedor: média 1,9 visita/hora; em 95% das horas até 4.** Último check-in do dia: 15h–17h na maioria; 98% terminam até 18h.
- **Pedidos (digitado/positivação):** 07h–23h, pico 10h–11h com ~220 pedidos novos/h vindos de ~160 vendedores. Ainda entram ~60/h às 19h e ~15/h até 23h.
- **Devolução:** chega como nota (data da nota) e altera `financeiro.devolucao` do dashboard. Conta na Liga e no incentivo — tratada como dado vivo, detectada pela mudança do dashboard (caminho admin).
- **Meta/faturado do mês (dashboard):** muda com faturamento/devolução; detectado pela hierarquia admin (1 chamada) e relido só quem mudou.
- **Compromisso do supervisor:** prazo **até 10h** (Plus de Liderança). Depois das 10h o dado do dia está fechado.
- **RET do supervisor:** ~1 visita a cada 30 min por supervisor (Vitório); 1 chamada por filial (`matriz-ret`) traz todos.
- **+MIX / histórico de compras:** fechado até ontem (D-1). Lido uma vez, de madrugada.
- **Árvore de vendedores/supervisores e metas:** uma vez por dia, de madrugada.

## 4. Cadência de cada dado no coletor (alvo)
| Dado | Endpoint | Janela | Ritmo | Cota |
|---|---|---|---|---|
| Árvore, cadastro, metas | `gerente/tabelas-cascata`, `admin/filiais/hierarquia` | 00:30–03:30 | 1x/dia | admin |
| +MIX / histórico D-1 | (base de compras) | 00:30–03:30 | 1x/dia | — |
| **Rota do dia** | `rca/produtividade` + `rca/roteiro-hoje` | **00:30–06:00** | 1x de todos; depois só quem mudou | rca (madrugada livre: ~600 vendedores × 2 = 1.200 chamadas ≈ 5–6 h a 3,5/min → **começar 00:30**) |
| Detector de mudança (pedido, devolução, positivação, faturado) | `admin/filiais/hierarquia` + `admin/view-as/rca/dashboard` | 06:00–23:30 | a cada 2 min | admin |
| Pedido novo → produtividade + roteiro do vendedor | `rca/produtividade`, `rca/roteiro-hoje` | 07:00–23:30 | só de quem mudou, na hora | rca (~220/h no pico: no limite; ver §6) |
| Check-in sem pedido | `rca/roteiro-hoje` | 07:00–19:00 | rodízio: cada vendedor com rota a cada ~30 min (≤2 visitas perdidas de atraso) | rca |
| Compromisso | `admin/supervisores/matriz-compromissos` | 06:00–10:30 | a cada 5 min; depois das 10:30, 1 leitura final e **para** | admin |
| RET | `admin/supervisores/matriz-ret` | 07:00–19:00 | a cada 15 min (supervisor faz ~1 visita/30 min) | admin |
| Devolução (notas e motivo) | `rca/devolucoes`, `rca/devolucoes/{nota}` | dia todo | só de quem teve `financeiro.devolucao` alterado | rca |
| Histórico do cliente (lances, mix, corte) | `rca/historico-cliente/{id}` | dia todo | só cliente com pedido novo, 1x por pedido | rca |

## 5. Leitores (quem precisa sair do CEVEN e passar a ler a base)
| Leitor | Hoje | Alvo | Status |
|---|---|---|---|
| TV da filial (`tvapp.html`) / Matriz (`matrizapp.html`) | `tv-vendedor` ia ao CEVEN com base de +30 min | `so_base=1` (só D1) | commit 8dc66dd2, **não publicado** |
| Visitas/zerados (todas as telas + abertura) | cada um somava | `/api/totais-dia` | no ar 26/10 |
| `tv-vendedor` (coletor de lances, `central=1`) | ao vivo se base +30 min | só base | **feito 26/10** (`so_base=1&hist=1`) |
| `tv-supervisores` | admin ao vivo a cada tela | `supervisores_dia` + `supervisores_ret_detalhe` (coletor: compromissos 5 em 5 min até 10:30, RET 15 em 15 min) | **feito 26/10** (commit seguinte a b1cec486) |
| `tv-supervisores-semana` | admin ao vivo (semana) | dias anteriores gravados na mesma tabela | pendente (a tabela começa a acumular hoje) |
| `cron-lances`, `tv-lances` | `rca/devolucoes/{nota}`, `roteiro-hoje` ao vivo | base | **feito 26/10** (b1cec486): lances só base + histórico do cliente com pedido novo; prova do cartão pela cascata do gerente. Falta: `rca/devolucoes/{nota}` |
| `cron-mapa-executivo` | `historico-cliente` ao vivo | base (`cache_analise_cliente`) | pendente |
| `cron-radar-horario`, `cron-conferencia-dia` | `rca/produtividade`, `dashboard`, `devolucoes` ao vivo | base | pendente |
| `vendedor-detalhe` (celular) | 6 endpoints ao vivo | base | pendente |
| `incentivo-outubro`, `divergencias`, `saude` | ao vivo | base | pendente (levantar) |
| Motor do WhatsApp (`pipeline/ceven_unified_engine.js`) | base primeiro; CEVEN se linha +45 min; RET/compromisso ao vivo | só base | pendente |
| JOTA, +MIX | não verificado (código fora desta pasta) | base | levantar |

## 5b. Coletores paralelos que ainda existem (devem acabar — só o coletor central fala com o CEVEN)
| Onde | O que | Roda sozinho | Destino |
|---|---|---|---|
| `pipeline/orquestrador_diario.js` (GitHub 03:00, `ceven-cron-datalake.yml`) | 9 extratores de `analises/` (hierarquia, roteiros+prospecção, produtividade+RET, histórico de pedidos, histórico do vendedor, devoluções+LinkUp, metas) | sim | SQLite no GitHub/Drive (2ª base; alimenta o +MIX) → passar a gravar no D1 pelo coletor |
| `scripts/atualizar_arvore_viva_11_filiais.js`, `scripts/coletar_plus_lideranca.js`, `analises/gerar_dados_mix.js` (GitHub) | árvore, RET/compromisso, mix | sim | ler do D1 |
| `CEVEN OFFLINE/CEVEN_3_Celulares_Isolado.*` | abre o CEVEN no navegador | só quando aberto | fora do escopo da base |
| `CEVEN TELAS E ENDPOINTS/07_ENG_PIPELINE/*.py` | extratores manuais | não | aposentar |

## 5c. Inventário: cada informação do CEVEN e se está GRAVADA na base (26/10/2026)
"Gravado" = fica no D1 e é atualizado; "não" = cada um busca ao vivo e nada fica. Tabelas criadas e **vazias** (nunca alimentadas): `clientes_historico_compras`, `roteiros_visitas`, `prospects_receita`, `linkup_cadastros_preparados`, `devolucoes_auditoria`, `pedidos_faturados_itens`.
| Informação | Endpoint | Gravado? | O que fazer |
|---|---|---|---|
| Roteiro do dia (status, check-in por cliente) | `rca/roteiro-hoje` (ou por supervisor, em teste) | **sim** (`varredura_central_rca`, por dia) | priorizar quem vendeu (feito, não publicado) |
| Produtividade do dia/mês | `rca/produtividade` | **sim** | — |
| Meta/faturado/pendente/devolução do mês | `rca/dashboard`, `admin/view-as/rca/dashboard` | **sim** | — |
| Devoluções (notas) | `rca/devolucoes` | **sim** | — |
| Motivo da devolução por nota | `rca/devolucoes/{nota}` | parcial (`devolucao_nota_motivo`, 1.806) | gravar toda nota nova (conta na Liga/incentivo) |
| Histórico do cliente (pedidos, itens, corte) | `rca/historico-cliente/{id}` | **não** (cache de 20 min) | gravar e só acrescentar pedido novo |
| Roteiro do mês | `rca/roteiro-mes`, `supervisor/roteiro-mes` | **não** | gravar de madrugada; o dia corrente vem do roteiro do dia |
| Prospecção (quem cadastrou) | `ceven/prospeccao-roteiro` | **não** (só no SQLite do datalake) | gravar no D1 |
| LinkUp (solicitações de cadastro) | `linkup/solicitacoes` | **não** (só SQLite) | gravar no D1 |
| Histórico do vendedor | `rca/historico-vendedor` | **não** (só SQLite) | gravar no D1 |
| Clientes-foco / campanhas | `rca/clientes-foco`, `admin/clientes-foco` | **não** | gravar 1x/dia |
| RET dos supervisores | `admin/supervisores/matriz-ret`, `admin/ret/periodo`, `gerente/supervisor/ret-hoje` | **não** (ao vivo em cada tela e no WhatsApp) | gravar a cada 15 min |
| Compromissos | `admin/supervisores/matriz-compromissos` | **não** | gravar a cada 5 min até 10:30 |
| Tabelas do supervisor / vespertina | `supervisor/tabelas`, `supervisor/vespertina` | **não** | avaliar (teste) |
| Árvore (supervisor de cada vendedor) | `gerente/tabelas-cascata` | **sim** (`arvore_supervisores`) | incluir visitas plan/real do dia da cascata |
| Hierarquia/metas admin | `admin/filiais/hierarquia` | usada como detector, **não** gravada | gravar |
| Notificações | `notificacoes/*` | não | só envio |

**Check-in na visão do supervisor:** nas gravações (22/09 e RETs), a tela do supervisor mostra o horário do check-in chamando `rca/roteiro-mes` **do vendedor** (campo `checkin_horario`); o `supervisor/roteiro-mes` gravado não trazia esse campo. O teste `/api/diag-supervisor-caminhos` confere os campos de HOJE.

## 6. Pontos em aberto
1. **TESTADO 26/10 08:45 (`/api/diag-admin-caminhos`):** o caminho admin `view-as/rca/*` serve **só `dashboard`** (200). `produtividade`, `roteiro-hoje`, `devolucoes` e `roteiro-mes` dão **404** (não existem). Produtividade/roteiro/devoluções ficam na cota de 3–4/min: por isso a madrugada (00:30) e reler só quem mudou são obrigatórios.
2. Madrugada antecipada para 00:30 (26/10, commit seguinte ao 8dc66dd2): pelos números a rota completa por `/api/rca/*` leva horas.
3. Tolerância dos boletins de vendas: ZERADA em 26/10 (decisão do Vitório), no ar no GitHub desde o push b46bdb78.

## 7. Histórico
- 26/10/2026 09:30–10:00 — Cascata do gerente gravada (`cascata_dia`, 11 filiais, cota separada). Roteiro de quem o gerente vê com visita nova vai primeiro. Lances e cartões sem chamada ao vivo de roteiro. Compromissos e RET gravados pelo coletor; `/api/tv-supervisores` lê só a base. Mapa: 34 → 33 rotinas chamando o CEVEN (tv-lances ainda cita o CEVEN em outro trecho; a coleta de supervisores entrou no lugar do tv-supervisores).
- 26/10/2026 — Documento criado. Medições do §3 feitas no D1 de produção. `/api/totais-dia` no ar. Telas `so_base`, madrugada 00:30 e redesenho imediato da Matriz publicados às 08:45 (tv-20261026-084506).
