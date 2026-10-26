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
| `tv-vendedor` (coletor de lances, `central=1`) | ao vivo se base +30 min | só base | pendente |
| `tv-supervisores`, `tv-supervisores-semana` | admin ao vivo a cada tela | tabela de supervisores gravada pelo coletor | pendente |
| `cron-lances`, `tv-lances` | `rca/devolucoes/{nota}`, `roteiro-hoje` ao vivo | base | pendente |
| `cron-mapa-executivo` | `historico-cliente` ao vivo | base (`cache_analise_cliente`) | pendente |
| `cron-radar-horario`, `cron-conferencia-dia` | `rca/produtividade`, `dashboard`, `devolucoes` ao vivo | base | pendente |
| `vendedor-detalhe` (celular) | 6 endpoints ao vivo | base | pendente |
| `incentivo-outubro`, `divergencias`, `saude` | ao vivo | base | pendente (levantar) |
| Motor do WhatsApp (`pipeline/ceven_unified_engine.js`) | base primeiro; CEVEN se linha +45 min; RET/compromisso ao vivo | só base | pendente |
| JOTA, +MIX | não verificado (código fora desta pasta) | base | levantar |

## 6. Pontos em aberto
1. **TESTADO 26/10 08:45 (`/api/diag-admin-caminhos`):** o caminho admin `view-as/rca/*` serve **só `dashboard`** (200). `produtividade`, `roteiro-hoje`, `devolucoes` e `roteiro-mes` dão **404** (não existem). Produtividade/roteiro/devoluções ficam na cota de 3–4/min: por isso a madrugada (00:30) e reler só quem mudou são obrigatórios.
2. Madrugada antecipada para 00:30 (26/10, commit seguinte ao 8dc66dd2): pelos números a rota completa por `/api/rca/*` leva horas.
3. Tolerância dos boletins de vendas (2%): com a base completa de madrugada, zerar (decisão do Vitório pendente).

## 7. Histórico
- 26/10/2026 — Documento criado. Medições do §3 feitas no D1 de produção. `/api/totais-dia` no ar. Telas `so_base`, madrugada 00:30 e redesenho imediato da Matriz publicados às 08:45 (tv-20261026-084506).
