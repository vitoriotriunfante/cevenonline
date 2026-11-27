# ARQUITETURA MESTRE TRI-FONTE (GEROT × CLUBE DA VENDA × CEVEN PARTNER API)

> **Data:** 27/11/2026  
> **Elaboração conjunta:** Equipe Técnica de Arquitetura (Dados & FinOps D1 · Resiliência/SRE · Conciliação & Auditoria 3-Way · Produtos & Migração Sem Quebra).  
> **Fontes validadas:**
> - **GEROT** (`43/43` telas mapeadas e coletadas — verdade contábil do mês)
> - **Clube da Venda / TradePro** (`79/79` telas mapeadas em [CLUBE_MAPA_COMPLETO.md](file:///c:/Users/vitorio.neto/Documents/Projetos%20IA/CEVEN%20v%C3%A1rias%20telas/docs/CLUBE_MAPA_COMPLETO.md) — verdade de campo e execução do dia)
> - **CEVEN Partner API** (`9/9` blocos testados ao vivo em `200 OK` — pedidos com itens em 120 ms, devoluções com itens/motivo em 151 ms, histórico 12 meses 102k+ linhas em `TBE` em 3,5 s, compromissos/RET)

---

## 1. Visão Geral & Topologia 100% Online (Zero PC Local)

| Fonte | Executor & Tecnologia | Cadência | Papel Soberano |
|---|---|---|---|
| **CEVEN Partner API** | **Cloudflare Worker (`*/5 * * * *`) → `/api/cron-ceven-partner`** (HTTP puro, cursor `?desde=`, ~120 ms/filial, zero Playwright) | **Hot (5 min):** `pedidos` (com itens/cortes/status), `visitas`<br>**Warm (15 min):** `devolucoes`, `supervisores`, `resumo_mes`<br>**Cold (diário 04h):** `equipe`, `rota`, `prospects_cadastros`, `historico_compras` (D-1) | Pedidos do Winthor (inclusive Televendas/Vtex Mondelez), itens de pedido, notas/itens de devolução, compromissos/RET e histórico 12 meses (`+MIX`). |
| **Clube da Venda** | **GitHub Actions único** (`clube_motor_coleta.mjs`, 1 sessão Playwright/run, `--tier=1/2/3`, **desliga tarefa Windows do PC**) | **Tier 1 (15 min):** `relatorioVenda` (+ Fornecedores ao vivo), `relatorioPedido` (`.xls` 29 cols), `relatorioAcompanhamentoDiarioVenda` (`.csv` 20 cols), `CheckinCheckout`, `Justificativas`, `PainelPedido`<br>**Tier 2 (2h):** `Atendimento` (Tempo Ocioso), `Quilometragem`, `Combos`, `Broadcast` (Antifraude), `Carga`<br>**Tier 3 (05h):** `Roteiro`, `CarteiraClientes` (`.csv` c/ GPS), `Produto` (8.973 SKUs), `Representante` (`Tipo Canal`), `Mix/Foco` | Origem do digitado do dia, horários exatos de check-in/out, justificativas + obs, venda do dia por indústria, GPS completo da carteira, estoque/códigos de SKU, combos, tempo ocioso, KM e antifraude. |
| **GEROT BI** | **Sonda 15 min + GitHub Actions HTTP** (`gerot_motor_coleta.mjs`) | Orientado a manifesto (~2h nas janelas pares) + `00h42 / 06h42 / 14h42 / 20h42` | **Verdade contábil oficial:** faturamento líq./bruto, margem, carteira, devoluções, metas R$/pos, Regra 4 de positivação, cortes, TMF, FEFO e dias úteis. |

**Eliminação de duplicidades e bombas-relógio:**
1. Aposentar tarefa do Windows `"CEVEN Clube da Venda"` no notebook e unificar `clube_coletor.mjs` + `clube_roteiro.mjs` dentro de `clube_motor_coleta.mjs`.
2. Desacoplar `/api/liga-clube?grava=1` para rodar no **`worker-cron` a cada 15 min** (independente de o login do Clube concluir).
3. Desligar duplicatas: `schedule` do GitHub vira reserva condicional (skip se último sync < 20 min); aposentar `tags-clientes-foco.yml`, `coletar_plus_lideranca.js`, `guardar-visitas.yml` e campanhas com data fixa de out/2027 (`jota-boas-vindas.yml`, `jota-guia-supervisores.yml`, `jota-convite-vendedores.yml`).
4. Corrigir `build_brasileirao_dataset.py` (retry com backoff + ler dias fechados congelados sem re-baixar setembro/outubro a cada 30 min — elimina os HTTP 500 por e-mail).
5. Atualizar `functions/_middleware.js` para liberar `/api/partner/*` mantendo o scraping legado bloqueado, corrigir `vigia-fontes.js` (bypass da pausa 2099 + `wa_cota` via `enviarAlertaOps`) e separar `MONITORIA_CRON_KEY` do `jota_admin_token`.

---

## 2. Matriz Soberana de Precedência Tri-Fonte (20 Indicadores)

> **Restrição comprovada no smoke test da Partner API (`TBE`):** `equipe.{gerente,canal}`, `rota.tags`, `visitas.{checkin_horario,checkout_horario,lat,lng,distancia_metros,observacao_nao_venda}`, `pedidos.{valor_faturado,motivo_bloqueio}`, `devolucoes.pedido_origem`, `supervisores.ret.checkout` e `carteira.{latitude,longitude,segmento}` vêm nulos nessa versão da Partner API. **O merge em `functions/_lib/fatos/` é obrigatório.**

| # | Indicador | Primária (**Ouro**) | Fallback 1 (**Prata**) | Merge Canônico |
|---|---|---|---|---|
| 1 | Faturamento, Margem, TMF, Cortes do Mês | **GEROT** (`fatos/kpis.js`) | Partner `resumo_mes` (com selo parcial) | GEROT oficial + dias úteis de `fatos/dias.js`. |
| 2 | Metas (R$ e Positivação) | **GEROT** + `config_equipe_soberana.metas_pos_grupo` | Partner `equipe` / Clube `relatorioMeta` | Positivação nunca soma entre equipes (Regra 4). |
| 3 | Carteira / A Faturar | **GEROT** (`gerot_carteira`) | Partner `pedidos` (abertos intraday) | GEROT dá `valor` e `situacao`; Partner soma delta aberto do dia + `itens`. |
| 4 | **Pedido Colocado Hoje** | **Clube `clube_pedido` ∪ Partner `pedidos` (somente Winthor direto)** | `clube_venda_dia` / `acomp.csv` | Sem dupla contagem via `erp_key = filial \| pedido_winthor`; bonificação/excluído fora! |
| 5 | Itens / Mix do Pedido | **Partner `pedidos.itens`** | Clube `ComboProduto` / `media_sku` | `itens` + `clube_produto` (8.973 SKUs, EAN/DUN/fornecedor). |
| 6 | Status / Bloqueio / Corte | **GEROT NF/Carteira + Partner `pedidos.status`** | Clube `clube_pedido` (`tipo_bloqueio`, `sincronizado`) | `FATURADO` > `BLOQUEADO/LIBERADO/MONTADO` > `AGUARDANDO_WINTHOR`. |
| 7 | **Venda Hoje por Indústria** | **Clube `clube_fornecedor_dia`** (`relatorioVenda` Fornecedores) | Partner `pedidos.itens` agrupado por fornecedor | Clube traz venda/pos/SKUs ao vivo + Partner soma Winthor direto. |
| 8 | Devoluções + Motivo + Nota | **GEROT** (R$ oficial) **+** **Partner `devolucoes`** (nota/itens/`nao_pediu`) | CEVEN Admin legado | Join por `(filial, numero_nota)`. |
| 9 | Rota Planejada | **Clube `clube_roteiro` ∪ Partner `rota`** | Clube isolado / Partner isolado | Clube dá recorrência/endereço; Partner dá ordem, lat/long, `data_ultima_compra`, `prospect`. |
| 10 | Check-in/out + GPS | **Clube `clube_checkin`** (timestamps) **+** `clube_carteira_cliente` (GPS PDV) | Partner `visitas` (`status`, `na_rota`) | Partner não traz horário de check-in/out; Clube é fonte única dos timestamps. |
| 11 | Justificativas Não-Venda | **Clube `clube_justificativa`** (com `obs` e `dias_sem_comprar`) | Partner `visitas` (`motivo_nao_venda`) | Clube traz observação completa e dias sem compra. |
| 12 | Efic./Eficácia/Ocioso/KM | **Clube Tier 1 + Tier 2** (`Atendimento`, `Quilometragem`) | Partner `visitas`/`rota` | 1º/último pedido, `tempo_ocioso`, início/término rota e KM programado vs percorrido. |
| 13 | Combos & Verba | **Clube Tier 2** (`CombosPromocionais`, `ComboProduto`, `cadastro_combo`) | — | Exclusivo do Clube. |
| 14 | Estoque SKU | **GEROT** (`gerot_est_winthor`, `gerot_fefo`) **+** **Clube `produto.xhtml`** | Clube `produto.xhtml` isolado | Saldo Winthor/validade FEFO + catálogo EAN/DUN/caixa/estoque app. |
| 15 | Carteira Clientes + GPS | **Clube `clube_carteira_cliente`** **+** **GEROT** **+** **Partner `carteira`** | Partner `carteira` | Clube traz Lat/Long de toda a carteira, `dias_sem_visita`, comprador, telefone. |
| 16 | **Histórico 12m / +MIX** | **Partner `historico_compras`** (`hist_cliente_forn_mes` no D1 + bruto 90d + 12m no R2) | GEROT `gerot_cliente_forn_mes` | Único granular 12m item-a-item para "o que cliente X parou de comprar". |
| 17 | Compromisso & RET Supervisor | **Partner `supervisores`** | CEVEN Admin legado | Substitui scraping admin antigo mantendo histórico diário. |
| 18 | Árvore Equipe & Canal | `config_equipe_soberana` **+** **Partner `equipe`** (sup) **+** **Clube `representante`** (`Tipo Canal`) | GEROT `gerot_vendedor_mes` | Partner traz `equipe` limpa em 1s; Clube preenche `Tipo Canal`. |
| 19 | Foco / TAGs / Campanhas | **Clube `foco_atividade`** **+** **GEROT** (`recorrencia`, `rfv`, `jbp`) **+** Partner `prospect` | `cliente_focos` | Substitui `rota.tags` vazio da Partner API. |
| 20 | Antifraude Aparelho | **Clube `relatorioBroadcast`** (`GPS Modificado`, `Hora Alterada`, `Modo Avião`) | — | Cruzamento ±15 min com check-in/pedido na auditoria (não altera contábil). |

---

## 3. Regra Anti-Dupla Contagem (Pedidos do Dia) & Failover Ativo-Ativo

1. **União disjunta `A ∪ B` por `(filial, dia)`:**
   - **A (`CLUBE_VALIDO`):** pedidos de `clube_pedido` excluindo `excluido = 'Sim'` e operações não-venda (`BONIFICACAO`, `TROCA`, `DEVOLUCAO`, `AMOSTRA`, `BRINDE`).
   - **B (`WINTHOR_DIRETO`):** pedidos de `ceven_api_pedidos` válidos cujo `erp_key = filial | pedido_winthor` **não** existe no conjunto vinculado de **A** (captura Televendas, digitados ERP e Loja Mondelez/Vtex sem duplicar nenhum pedido do Clube!).
   - **Nunca** somar `colocado_hoje` sobre `faturado + carteira` do GEROT; se quiser estimar "Mês + delta fora do GEROT", somar apenas pedidos de `A ∪ B` ausentes em `gerot_pedido` e `gerot_carteira`.
2. **Failover Ativo-Ativo (`functions/_lib/fontes_dia.js`, SLA = 35 min):**
   - Se o Clube passar de **35 min** sem coleta (ou falhar no login), `liga-clube.js`, `pedido_status_fontes.js`, `clube.js`, `totais-dia.js` e o JOTA chaveiam automaticamente para **`ceven_api_pedidos` + `ceven_api_visitas` + `ceven_api_devolucoes` + `gerot_*`**, marcando `_fonte: 'ceven_partner', _fallback: true` e bloqueando falso cartão de ausência por falha de coleta.

---

## 4. Schema D1 (`0018_ceven_partner_e_historico.sql`) + Plano FinOps (-100M reads/dia!)

### 4.1 Migration `0018` (100% aditiva, sem `DROP TABLE`)
- **Controle e Dimensões:** `ceven_api_cursor`, `dim_fornecedor_canonico`, `dim_fornecedor_alias`.
- **12 tabelas `ceven_api_*` (Delta-by-Hash):** `ceven_api_equipe`, `ceven_api_rota`, `ceven_api_visitas`, `ceven_api_pedidos`, `ceven_api_pedidos_itens` (90d), `ceven_api_resumo_mes`, `ceven_api_devolucoes`, `ceven_api_devolucoes_itens`, `ceven_api_supervisores_compromisso`, `ceven_api_supervisores_ret`, `ceven_api_historico_compras` (quente 90d) + `ceven_api_hist_cliente_forn_mes` (agregada 12+ meses permanente), `ceven_api_carteira`, `ceven_api_prospects`, `ceven_api_linkup`.
- **Séries Temporais & Auditoria (Pedido de Históricos do Vitório):**
  - `hist_intraday_snapshot`: série **hora-a-hora (08:00..20:00 BRT)** de colocado canônico, faturado MTD, carteira, meta, ritmo, check-ins e eficácia (Brasil/Filial/Sup permanentes; Vendedor 60d).
  - `hist_fechamento_dia`: **foto congelada** de todo fechamento diário (D+0 23:30 + ajuste D+1 pós-GEROT) em 4 níveis.
  - `hist_fechamento_mes`: histórico mensal oficial imutável (YoY / MoM / premiação, substituindo `gerot_historico_*`).
  - `auditoria_conciliacao_dia`: trilha horária de batimento 3-Way + Accounting Gate.

### 4.2 Otimização FinOps D1 (Compactação `historico_compras` + Índices Críticos)
- **Economia no `historico_compras` (~1,25M linhas nas 11 filiais):**
  - 12 meses brutos arquivados no **Cloudflare R2** (`~30 MB` gzip, 0 `rows_written` D1);
  - Agregado 12+ meses no D1 (`ceven_api_hist_cliente_forn_mes`, `~200k` linhas / `~38 MB`) + janela quente de **90 dias** item-a-item no D1 (`~300k` linhas / `~75 MB`), com sync diário incremental `D-1` (~120k writes/mês).
- **Índices que cortam >100 milhões de `rows_read`/dia:**
  1. `idx_gerot_pedido_ped_fil_nf` + `fat_liq REAL` (`-29M reads/dia` em `pedido_status_fontes.js`).
  2. `idx_gerot_cli_mes_regra4` + trocar `COALESCE(rca_int, CAST(...))` por `rca_int` em `fatos/kpis.js` (`-38M reads/dia`).
  3. `idx_gerot_carteira_ped_fil_sit` (covering index).
  4. Desligar leitores de `varredura_central_rca` (`-34M reads/dia`).
- **Limpeza (após backup & cutover):** `DROP TABLE` apenas quando autorizado em `piloto_pedidos_intraday` (1,7M linhas) e ~30 tabelas mortas sem leitores, levando o D1 de **2,8 GB → ~2,2 GB** mesmo com tudo novo dentro.

---

## 5. Auditoria Contábil 3-Way (`Accounting Gate` Unificado)

- **Camada A (Intra-Fonte):** GEROT (`G1..G4`), Clube (`C1..C4`: `vendedores ≥ 300`, `|vend - raiz| ≤ 1%`, `|ped_xls - vend| ≤ 1.5%`, `|forn_br - raiz| ≤ 3%`) e Partner (`P1`: 9/9 blocos `200 OK`).
- **Camada B (Cross-Fonte 3-Way):** `X1` Clube × Partner pedidos (`≤ 0.5%`, ou pedido `Sinc=Sim` ausente > 45 min), `X2` Partner × GEROT D-1 (`≤ 2%`), `X3` GEROT × Partner Metas (`≤ 0.1%`), `X4` GEROT × Partner Devoluções (`≤ 2%`), `X5` Clube × Partner Rotas/Visitas (`≤ 3%`), `X6` Clube Indústria D-1 × GEROT (`≤ 5%`).
- **Camada C (Fila Winthor > 2h):** `INT1` alerta crítico se `≥ 20 pedidos` ou `≥ R$ 50k` travados `> 2h` ou `> 15%` sem sincronizar após 10h30.
- **Camada D (Árvore 4-Way):** Gestão Soberana × GEROT × Partner `equipe` × Clube `representante` alimentando `/divergencias` e `/api/saude`.

---

## 6. Plano de Execução em Sprints (Sem Quebra: 543 testes + 252→275 Gabarito)

1. **Sprint 0 (Fundação & Resgate — hoje/amanhã):**
   - Publicar `functions/api/clube-carga.js` + disparar 1ª carga real do `clube_motor_coleta.mjs --tier=1`.
   - Desacoplar `/api/liga-clube` e ressuscitar `/api/bola-cheia` (parada desde 13/11) às 18h no `worker-cron`; consertar `vigia-fontes.js` (bypass pausa 2099); corrigir `build_brasileirao_dataset.py` (fim dos HTTP 500 por e-mail).
   - Criar `functions/_lib/fatos/dia.js` + `fontes_dia.js` e reconectar `resumo_base.js`, `totais-dia.js`, `bola_cheia.js` e `lances_faltantes.js`.
2. **Sprint 1 (CEVEN Partner API + Telas 100% Vivas + Clube Tier 2/3):**
   - Aplicar `migrations/0018_ceven_partner_e_historico.sql`, liberar `/api/partner/*` no `_middleware.js`, criar coletor incremental `/api/cron-ceven-partner` (5/15/60 min no Worker) + backfill histórico 12m para R2/`hist_cliente_forn_mes`.
   - Implementar **Tier 2** e **Tier 3** no `clube_motor_coleta.mjs` (Tempo Ocioso, KM, Combos, Broadcast, Carteira GPS 3.670+ cli/filial, Produto 8.973 SKUs, Representante).
   - Reconectar `mapa-executivo-live.js`, `tv-vendedor.js`, `central-snapshot.js` (fachada compatível sobre `fatos/`), `matinal.js`, `frescor.js`, `divergencias.js` e ativar `hist_intraday_snapshot` + `hist_fechamento_dia`.
3. **Sprint 2 (Novas Capacidades Tri-Fonte no JOTA + Gate 3-Way):**
   - Criar `fatos/{cliente,pedidos,devolucao,industria}.js`, aposentar `ficha_cliente`/`historico_cliente` no JOTA e lançar: *"o que cliente X parou de comprar"*, *"itens/corte do pedido"*, *"devoluções c/ motivo e produto"* e *"venda da indústria HOJE"*.
   - Expor `accounting_gate_3way` e fila Winthor >2h em `/api/saude` + expandir Gabarito `G253..G264`.
4. **Sprint 3 (Clube Tier 2 no JOTA & Liga Tri-Fonte Completa):**
   - Criar `fatos/campo.js` e lançar no JOTA: estoque SKU, combos ativos, tempo ocioso, KM, alertas GPS e carteira por dias sem visita (`G265..G275`, total **275/275**).
   - Evoluir `liga-clube.js` com failover ativo-ativo Clube ∪ Partner + `pipeline/build_brasileirao_dataset.py` lendo do D1.
5. **Sprint 4 (Limpeza Final & FinOps D1):**
   - Desligar tarefa Windows local, workflows zumbis/2027, endpoints mortos e submeter `DROP TABLE` das tabelas mortas (pós-backup R2) após aprovação do Vitório.
