# MAPA DE DADOS DO JOTA — o que usar, onde, como e quando

> Vitório, 16/11/2026: "são tantas informações que vc tá se perdendo... dado X eu pego no lugar Y, se não tiver disponível pego no Z; uso esse dado no relatório a, b e c... todo um mapa do que usar, como usar, onde usar e quando usar".
> Este documento é o **dicionário de dados do JOTA**. Ele manda sobre as fontes do JOTA e completa [PLANO_JOTA_QUALIDADE_E_PROATIVIDADE.md](PLANO_JOTA_QUALIDADE_E_PROATIVIDADE.md) (o plano), [MAPA_DAS_FONTES.md](MAPA_DAS_FONTES.md) (o caminho do pedido), [BASE_UNICA.md](BASE_UNICA.md) e [GEROT_ESTADO_E_PLANO.md](GEROT_ESTADO_E_PLANO.md).
> Tudo que está aqui foi **medido no D1 de produção em 16/11/2026, entre 18h e 18h45 (Brasília)**, só com leitura, e conferido no código. Horários em Brasília (BRT), a não ser quando dito.

---

## 0. Regras gerais (valem para toda resposta)

1. **Uma definição por dado.** O nome do dado na resposta é o nome desta tabela. Dois números diferentes só aparecem juntos se tiverem nomes diferentes (ex.: "positivação" ≠ "clientes com pedido no mês").
2. **Fonte 1 fresca, senão fonte 2, senão fonte 3.** "Fresca" = dentro do frescor da coluna "Frescor". Toda resposta termina com a fonte e a hora de cada número usado: `Clube 18:39 · GEROT 16/11 17:27`.
3. **Zero só com prova.** "R$ 0", "0 visitas", "sem rota", "sem pedido", "nenhum cliente" só saem quando a fonte do dado **leu hoje** e está fresca. Sem leitura: "o Clube ainda não leu hoje · última leitura 15/11 20:08" + o que existe (o mês pelo GEROT).
4. **R$ soma de baixo para cima; positivação não.** Faturado, carteira, devolução e meta somam vendedor → supervisor → filial → Brasil (conferido: a soma dos vendedores do GEROT bate centavo a centavo com a filial). **Positivação é contagem de CNPJ distinto**: o mesmo cliente comprado por duas pastas conta duas vezes na soma. Positivação de supervisor/filial/Brasil se lê **no nível** (GEROT `gerot_supervisor_mes`/`gerot_filial_mes`), nunca somando vendedores.
5. **Pedido colocado ≠ faturado.** Dia = pedido colocado (Clube). Mês = faturado + carteira (GEROT). Premiação = só faturado do GEROT.
6. **Nada fora do D1.** O JOTA ainda lê arquivos do GitHub (`public/vendas_mes`, `mix_hist`, `mix_rec`, `dados_mix.json`, `dados_brasileirao.json`, `justificativas/`) e uma API externa (Premiação RV). Cada um está marcado abaixo como dívida.

### 0.1 Estado das fontes em 16/11/2026 (medido)

| Fonte | Tabela | Volume | Última leitura | Observação |
|---|---|---|---|---|
| **Clube — totais por vendedor** | `clube_venda_dia` | 563 vendedores hoje (2.813 no total, desde 12/11) | **18:39** · 1ª leitura do dia **14:53** | 18 rodadas hoje; 52/dia em 14–15/11. `total_faturado` vem **sempre 0** (coluna inútil) |
| Clube — check-in/out | `clube_checkin` | 7.062 hoje | rodada das 18:39 | `data_hora` em **horário de Brasília** |
| Clube — justificativa | `clube_justificativa` | 2.677 hoje | rodada das 18:39 | `data_hora` em **UTC** (pico 12–14h = 9–11h BRT). Fuso diferente do check-in: converter antes de comparar |
| Clube — rodadas | `clube_rodada`, `clube_coleta_status` | 18 hoje | 18:39 | `nao_sinc` (pedidos não integrados ao Winthor) = 512 |
| **GEROT — vendedor × indústria** | `gerot_vendas` | 3.686 linhas em nov (15.155 no total) | **17:27** (posição "Atual · 16/11/2026") | cargas 07h15, 09h15 … 19h15 seg–sáb + dom 20h15 (`gerot-coleta.yml`). 46 colunas |
| GEROT — vendedor / supervisor / filial | `gerot_vendedor_mes` / `gerot_supervisor_mes` / `gerot_filial_mes` | 600 / 115 / 11 | 17:21 | mesmas colunas, sem fornecedor |
| GEROT — recorrência | `gerot_recorrencia_pasta` | 655 (11 filiais, 93 sup., 551 vend.) | 17:23 | **só números** (objetivo, meta, positivados); **não tem a lista de clientes** |
| GEROT — recorrência (antiga) | `gerot_recorrencia` | 537 | 11/11 09:22 | parada desde 11/11; substituída pela `_pasta`. Ninguém deve ler |
| GEROT — carteira por cliente | `gerot_cliente_mes` | **não existe em produção** | — | só no código não publicado (`gerot-carga.js`, `gerot_coletor_online.mjs`) |
| CEVEN — base da varredura | `varredura_central_rca` | 552 linhas hoje; dashboard 178, roteiro 95, roteiro do mês 64, produtividade 89 | 09:02 | leituras parciais 14–16/11. **Trava global** em `functions/_middleware.js` bloqueia toda chamada ao CEVEN desde 16/11 15:05 (ordem do Vitório) |
| CEVEN — roteiro do mês (última leitura por vendedor) | `varredura_central_rca.roteiro_mes_json` | 613 vendedores | 470 de 613 com a última leitura em **11/11**; 64 em 16/11 | é a carteira e a rota planejada de hoje enquanto não existe a rota do Clube |
| Winthor (via CEVEN) — status do pedido | `pedido_status` | 29.652 | pedidos até **14/11** (37 pedidos); **0 pedidos de 16/11** | status congelado: 13/11 ainda com 462 "BLOQUEADO" |
| CEVEN — motivo da devolução | `devolucao_nota_motivo` | 3.456 notas | 16/11 08:09 | só notas que o CEVEN detalhou |
| Data Lake — ficha do cliente | `ficha_cliente` | 36.316 | 16/11 05:49 | pedidos e itens por cliente (origem CEVEN); `$.ult` = última compra |
| Liga | `tv_lances` | 79.671 | 16/11 11:32 | 2.300–2.600 lances/dia até 11/11 → **17–18/dia** desde 12/11 |
| Clientes foco / TAGs | `cliente_focos` | **0 linhas** | — | tabela criada (migration 0011), **nenhum código escreve nela**; 3 leitores |
| Meta (tela Filiais do CEVEN) | `meta_hierarquia` | 576 | 14/11 05:54 | difere do GEROT em 4 filiais (seção 2, C6) |
| Árvore do CEVEN | `arvore_supervisores` | 552 | 13/11 16:46 | |
| Gestão de Equipe | `config_equipe_soberana` (via `/api/tv-mostra`) | 1 JSON | 09/11 20:27 | fonte oficial de quem aparece |
| RET / compromisso | `supervisores_dia` | 44 | 16/11 09:00 | |
| Gerente (CEVEN) | `rota_gerente_dia`, `painel_gerente_dia` | 1.223 / 129 | 15/11 | gravadas em paralelo; nenhuma resposta usa |
| Premiação RV (API externa) | `cache_resposta` chave `rv2:2026-11` | 1 JSON (397 KB) | 16/11 10:02 | `cutoff` 20/11 |
| GitHub — vendas item a item / +MIX | `public/vendas_mes/`, `vendas_mes_anterior/`, `mix_hist/`, `mix_rec/`, `dados_mix.json` | por filial | **11/11** | gerados do CEVEN (`mix-dataset.yml`); parados |
| GitHub — Liga e justificativas | `public/dados_brasileirao.json`, `public/justificativas/` | | 16/11 14:48 / 04:36 | |
| Contatos do JOTA | `bot_contatos` | 371 (343 ativos: 248 vendedores, 64 supervisores, 15 gerentes, 5 diretoria, 1 CEO, 10 grupos) | 16/11 16:24 | |
| Tabelas vazias ou abandonadas | `pedidos_cortes_auditoria` (0), `oportunidades_mix_gap` (0), `rca_kpis` (até 08/09), `recorrencia_resumo_live` (até 24/10) | | | não usar |

---

## 1. Tabela mestre — um dado de negócio por linha

Legenda de frescor: **dia** = vale 30 min depois da leitura do Clube (`clube_venda_dia.lido_em`); **mês** = vale até a próxima carga do GEROT (`gerot_coleta_status.em`, ~2 h); **D-1** = fechado até ontem.
Coluna "Sem fonte": o que a resposta diz quando **nenhuma** fonte está fresca. Nunca zero.

### 1A. O DIA (Clube primeiro)

| # | Dado | Definição oficial | Fonte 1 | Fonte 2 | Fonte 3 | Frescor esperado · medido 16/11 | Sem fonte: mostrar | Onde é usado (hoje) |
|---|---|---|---|---|---|---|---|---|
| 1 | **Digitado do dia** (pedido colocado, R$ e nº) | Soma dos pedidos que o vendedor **colocou hoje no Clube**, operação VENDA (bonificação fora). Rótulo fixo: "pedido colocado ainda não é faturado" | `clube_venda_dia.total_pedido`, `ped_total` (dia, filial, rca) | GEROT `gerot_vendedor_mes` "Captação Dia (R$)" (pedido **integrado no Winthor** hoje, inclui televendas/loja; outra definição, rotular "captado no Winthor") | `pedido_status` (data_pedido = hoje, ≠ CANCELADO) — parado desde 14/11 | 30 min · Clube 18:39; GEROT 17:27 (Brasil: Clube R$ 2,75 mi × GEROT captação R$ 2,12 mi às 17:27) | "Clube ainda não leu hoje · última leitura <data hora>" | `escopo.js:vendedoresDaFilial` (via `central-snapshot.js` + `clube.js:diaDoClube`), `momentos.js:diaClube`/`respMomento*`, `resumo.js:respHoje`/`respDiaVendedor`, `rota.js:respDiaEquipe`, `gestao.js:respMatinal` (não usa: só GEROT) |
| 2 | **Pedidos do dia por cliente** (lista: nº Clube, nº Winthor, cliente, valor, status) | Cada pedido colocado hoje, com o vínculo nº Clube → nº Winthor | **não existe** (lacuna L1: `clube_pedido`) | `pedido_status` (nº Winthor, cliente, valor, status) — parado em 14/11 | `ficha_cliente.$.ped` (D-1) | 30 min · **sem fonte fresca** | "A lista pedido a pedido de hoje ainda não está na base; o Clube mostra N pedidos (R$ X)" | `vendas.js:respPedidosStatus`, `rota.js:semCompraNaRota` (pedidoHoje), `momentos.js:diaClube` (deduz quem comprou: visitou sem justificativa, só se bater com `ped_rota`) |
| 3 | **Rota do dia — quantidade** | Clientes programados para hoje no roteiro do vendedor (só canais V e P cobram) | `clube_venda_dia.roteiros` | `varredura_central_rca.roteiro_json` (CEVEN de hoje) | roteiro do mês gravado filtrado por `data_visita = hoje` | 30 min · Clube 18:39 (4.959 PDVs hoje) | "Rota de hoje ainda não lida" | `gestao.js:respMatinal` (**lê a tabela `roteiro_dia`, que não existe → "Rota 0 PDVs" em toda matinal**), `momentos.js:respMomento` ("Você não tem rota hoje no CEVEN"), `escopo.js` (visP) |
| 4 | **Rota do dia — lista de clientes** | Quem são os clientes programados hoje | **não existe no Clube gravado** (lacuna L2: Roteiro Pedido) | `roteiro_mes_json` gravado, `data_visita = hoje` — só se a contagem bater com `clube_venda_dia.roteiros`; rotular "planejado (roteiro lido em 11/11)" | `varredura.roteiro_json` de hoje (95 vendedores) | dia · lista de 11/11 para 470 vendedores | Só a quantidade do Clube, sem nomes | `central-snapshot.js` (`roteiro_planejado`, `rota_clube`), `rota.js:respMinhaRota`/`respRotaHojeCompleta`/`respAVisitar`/`respSemVisita`, `momentos.js:diaClube` (naoVisNomes) |
| 5 | **Visitas / check-in** | Cliente com check-in no app do Clube hoje (1º check-in, último check-out) | `clube_checkin` (BRT) + `clube_venda_dia.visitas_rota` | `varredura.roteiro_json.checkin_horario` (CEVEN) | `cascata_dia` (visit_real_hoje) | 30 min · 7.062 check-ins | "Visitas de hoje ainda não lidas" | `central-snapshot.js` (status VISITADO), `rota.js:respCheckinEquipe`, `momentos.js:diaClube`, `escopo.js` (visF) |
| 6 | **Justificativa de não venda** | Motivo registrado pelo vendedor no Clube + dias sem comprar | `clube_justificativa` (motivo, obs, dias_sem_comprar; **UTC**) | `varredura.roteiro_json.motivo_nao_visita` (CEVEN) | `public/justificativas/` (GitHub, resumo D-1) | 30 min · 2.677 | "Justificativas de hoje ainda não lidas" | `momentos.js:diaClube` (semPed), `central-snapshot.js` (JUSTIFICADO), `oportunidades.js:respJustificativas` (lê o JSON do GitHub) |
| 7 | **"Ontem"** | Último dia anterior a hoje, **não domingo nem feriado**, com leitura do Clube; para o vendedor, o último desses dias em que ele tinha rota (`roteiros > 0`) ou pedido (`ped_total > 0`). Data sempre escrita | `clube_venda_dia` | `pedido_status` (data_pedido) | — | D-1 | "Sem leitura do último dia útil" | **três contas diferentes hoje** (seção 2, C3): `momentos.js:ontemClubeResumo`, `gestao.js:respMatinal` (ontEq), `periodos.js:ontemClube`/`respPeriodoDias` |
| 8 | **Positivação do dia** | Clientes distintos **faturados** hoje | GEROT "Positivação do dia" (`gerot_vendedor_mes`) | — | — | mês (2 h) · 17:27 | "sem dado agora" | `entende.js:respostaInterna` (POSITIV + HOJE: lê `produtividade.dia.positivacao` do CEVEN, que não existe com o Clube → "sem dado") |
| 9 | **Clientes com pedido hoje** | Clientes distintos com pedido colocado hoje | lacuna L1 (`clube_pedido`) | `pedido_status` | — | 30 min · sem fonte | mostrar o **nº de pedidos** com o nome "pedidos", nunca como "positivação" | `escopo.js` grava `ped = total_pedidos` do Clube e as telas chamam de positivação (C11) |
| 10 | **Pedidos não integrados** | Pedido colocado no Clube sem nº do Winthor | `clube_rodada.nao_sinc` (total da rede) | — | — | 30 min · 512 | — | aviso ao Vitório (worker), não usado no JOTA |
| 11 | **Visita suspeita** | Check-in < 3 min sem pedido, várias no mesmo minuto | `clube_checkin` | — | — | 30 min | silêncio | não implementado (plano §4) |

### 1B. O MÊS (GEROT primeiro)

| # | Dado | Definição oficial | Fonte 1 | Fonte 2 | Fonte 3 | Frescor · medido | Sem fonte: mostrar | Onde é usado |
|---|---|---|---|---|---|---|---|---|
| 12 | **Faturado do mês** | "Faturado líquido (R$)" = bruto − devolução. Pode ser negativo: então mostrar "faturado R$ X − devolvido R$ Y" | `gerot_vendedor_mes` (vendedor), `gerot_supervisor_mes`, `gerot_filial_mes` | `varredura.dashboard_json.financeiro.faturado` (CEVEN, última leitura do mês) | `painel_gerente_dia` | 2 h · 17:27 | "sem leitura do GEROT hoje · última <posição>" | `escopo.js:vendedoresDaFilial` (soma `gerot_vendas`), `central-snapshot.js`, `resumo.js:totaisOficiais`/`posGerotFiliais`/`posGerotSupervisor`, `gestao.js:respMatinal`/`respCarteira`/`respTendencia`, `analista_senior.js`, `entende.js` (fechamento) |
| 13 | **Carteira (a faturar)** | "Carteira pendente (R$)": pedido integrado e ainda não faturado | GEROT idem ("Pedidos na carteira" = nº) | CEVEN `financeiro.pendente` | — | 2 h | idem | idem 12 |
| 14 | **Meta de faturamento** | "Meta (R$)" do GEROT por vendedor (= soma das indústrias) | `gerot_vendedor_mes."Meta (R$)"` | `meta_hierarquia.meta` (tela Filiais do CEVEN) | `cascata_dia` (meta da cascata) | 2 h · conferido: soma das indústrias = vendedor = filial | "meta não cadastrada" (nunca 0%) | `escopo.js` (GEROT se > 0, senão `meta_hier`), `central-snapshot.js` (`meta_hier`), `gestao.js`, `resumo.js` |
| 15 | **Atingimento** | Dois indicadores com nome: **"faturado: X% da meta"** = fat/meta (premiação) e **"com carteira: Y% da meta"** = (fat + carteira)/meta (decisão de 11/11 para o JOTA) | derivado de 12–14 | — | — | 2 h | — | `escopo.js` (`pct` = fat/meta, rankings), `momentos.js`/`gestao.js:respMatinal` ((fat+cart)/meta), cartão do vendedor ((fat+cart)/meta) — C5 |
| 16 | **Positivação do mês** | "Positivação (filial + CNPJ)": clientes distintos com faturamento líquido > 0 no mês, **lida no nível pedido** | GEROT (`gerot_vendedor_mes` / `_supervisor_mes` / `_filial_mes`) | CEVEN `dashboard.positivacao.realizado` | — | 2 h · TCV 352: **50** | "sem leitura" | `central-snapshot.js` (põe a do GEROT em `positivacao`), `escopo.js` (v.pos), `rota.js:respPositivacao`, `resumo.js:respVendedor`, `momentos.js`, `gestao.js:respMatinal` (soma vendedores — C2) |
| 17 | **Meta de positivação** | "Meta de positivação" do GEROT, lida no nível | GEROT idem | `meta_hierarquia.meta_pos` | — | 2 h · TCV 352: **99** | "meta não cadastrada" | idem 16. **Erro:** o código usa `"Meta de positivação" ?? "Meta clientes"`; "Meta clientes" é a carteira (133), não meta (C7) |
| 18 | **Carteira de clientes (nº)** | Clientes da pasta do vendedor no mês | GEROT "Meta clientes" (TCV 352: 133) | roteiro do mês gravado (clientes distintos; 133) | `gerot_cliente_mes` (quando existir) | 2 h | — | `rota.js:respClientesVend` ("com pedido no mês: 74 de 133") |
| 19 | **Clientes com pedido no mês** | Clientes da carteira com pedido colocado no mês (faturado ou não). **Não é positivação** | `pedido_status` (mês) + `public/vendas_mes` | `ficha_cliente.$.ult ≥ dia 1` | `gerot_cliente_mes` "Positivação + Carteira" (quando existir) | dia · pedidos parados em 14/11 | rotular "base até <data>" | `rota.js:clientesComPedidoNoMes`/`respClientesVend`/`respTagCampanhas`, `entende.js` (curva) |
| 20 | **Devolução — valor** | "Devolução (R$)" do mês | GEROT (vendedor × indústria) | CEVEN `financeiro.devolucao` | `macro_fora_arvore` (quem não está na árvore) | 2 h | "sem leitura" | `escopo.js` (v.dev, GEROT), `rota.js:respDevolucao` (**rodapé diz "Fonte: painel do CEVEN" com número do GEROT** — C9) |
| 21 | **Devolução do dia (notas)** | Notas de devolução com data de hoje | CEVEN `varredura.devolucoes_json` | — | — | parado (CEVEN) | "lista de notas indisponível desde <data>" | `escopo.js` (devHoje/devHojeCli), `rota.js:respDevolucao` |
| 22 | **Devolução — motivo** | Motivo oficial da nota (gera ou não gol contra) | `devolucao_nota_motivo` | — (lacuna L4) | — | só notas detalhadas · 3.456 | "motivo ainda não lido" | `api/devolucoes-motivos.js` → `indicadores.js:respDevMotivos`, Liga |
| 23 | **Cortes** | "Corte comercial/logístico/total (R$ e un)" do mês | GEROT (vendedor × indústria) | `pedido_status.itens_cortados_json` (por pedido, até 14/11) | `ficha_cliente.$.ped[].cortado` | 2 h | "sem leitura" | `operacao.js:valorCorte`/`operacao`, `vendas.js:respPedidosStatus`; o GEROT ainda **não é usado** para cortes no JOTA |
| 24 | **Tendência** | (fat + carteira) ÷ dias úteis decorridos × dias úteis do mês (seg–sex, sem feriado; hoje conta). Sempre rotulada "TENDÊNCIA (conta, não é número real)" | derivado de 12–14 + `feriados.js` | GEROT "Meta Ideal captação", "% Meta Ideal captação", "Necessidade dia captação" (números do GEROT, não projeção) | — | 2 h | — | **três implementações**: `gestao.js:respTendencia`, `gestao.js:respMatinal` (tend), `resumo.js:respResumo` ("Tendência (GEROT)"); dias úteis em `base.js:diasUteisRestantes` **e** `gestao.js:diasUteisAgora`/`diasUteisMes` |
| 25 | **Recorrência — números** | Lista do dia 1 (recuperação): objetivo, meta (80%), positivados, faturado | `gerot_recorrencia_pasta` — **só linhas da última carga** (`em` = máx) | — | — | 2 h · 17:23 | "sem leitura" | `indicadores.js:respRecorrencia`, `momentos.js:recorrenciaGerot` (**soma a linha velha da pasta antiga**: TCV 352 pasta 22, objetivo 5, de 11/11), `momentos.js:respMomentoDiretoria` |
| 26 | **Recorrência — lista de clientes** | CNPJs com a TAG "RECORRENCIA" no mês | `cliente_focos` (**vazia**; lacuna L6: gravar o admin Clientes Foco) | `roteiro_mes_json[].focos[].industria_foco` (CEVEN, 11/11) | — | 1x/dia · **sem fonte fresca** | "a lista de recorrência ainda não está na base (meta do GEROT: X, positivados Y)" — **nunca "nenhum cliente com a tag"** | `rota.js:respTagCampanhas` = `respRecorrenciaClientes` (lê só o roteiro; **meta = 80% dos clientes com TAG no roteiro**, ≠ GEROT — C8) |
| 27 | **Clientes foco / campanhas** | TAGs ativas: filial, CNPJ, campanha (`industria_foco`), cor, cód. vendedor, ativo | `cliente_focos` (vazia) ← CEVEN admin `/api/admin/clientes-foco` (14.165 itens, 29 páginas de 500, em 08/10) + `/campanhas` | `roteiro_mes_json[].focos` | Clube "Mix de Produtos/foco" (não testado) | 1x/dia · sem fonte | "campanhas ainda não carregadas hoje" | `central-snapshot.js` (lê `cliente_focos`), `monitoria/motor.js`, `monitoria/analista.js`, `rota.js:respCampanhasVendedor`/`respCampanhasEquipe`/`respTagSeparadoPorSupervisor` |

### 1C. CLIENTE

| # | Dado | Definição oficial | Fonte 1 | Fonte 2 | Fonte 3 | Frescor · medido | Sem fonte: mostrar | Onde é usado |
|---|---|---|---|---|---|---|---|---|
| 28 | **Curva negativa** | Clientes da carteira do mês do vendedor **sem pedido no mês** (nem colocado, nem faturado), com dias desde a última compra | `gerot_cliente_mes` (positivação do mês = 0 e "Positivação + Carteira" = 0; M-1/3M para ordenar) — quando existir | roteiro do mês gravado − (`pedido_status` do mês ∪ `public/vendas_mes` ∪ `ficha_cliente.ult ≥ dia 1`) | — | 2 h · fonte 1 não existe; fonte 2 com carteira de 11/11 e pedidos até 14/11 | "lista até <data da base>" com a data; nunca "sem dado" se há leitura gravada | `entende.js:respostaInterna` (bloco "Curva negativa", linhas ~1408–1480), `entende.js` `curvaOuDirecao`, `periodos.js:respClientesSemComprar` (outra conta: só `vendas_mes` + `vendas_mes_anterior`) |
| 29 | **Última compra do cliente** | Data do último pedido real do cliente (qualquer vendedor da filial) | `ficha_cliente.$.ult` | `clube_justificativa.dias_sem_comprar` (fresco, só justificados) | `public/mix_hist/<filial>.json` (60 dias, 11/11) | D-1 · ficha 05:49 | "sem histórico na base" | `entende.js` (curva), `rota.js:respClientesVend`/`respAVisitar`/`semCompraNaRota`, `momentos.js:focoDoDia`. **Nunca** `roteiro.data_ultima_compra` (valores-padrão 1900/05-12-2025) |
| 30 | **Ficha / histórico do cliente** | Pedidos, itens, cortes do cliente | `ficha_cliente` | `historico_cliente` (CEVEN, 10.718) | — | D-1 | "sem histórico" | `motor_ficha.js`, `vendas.js:respCliente`, `entende.js` (CNPJ/código) |
| 31 | **+MIX / recomendação** | Produtos que o cliente não compra há > 60 dias e o +MIX recomenda | `public/mix_rec/<filial>.json` (GitHub) | — | — | D-1 · **parado em 11/11** | "recomendação de <data>" | `liga_mix.js:respMix`, `oportunidades.js:respOferecer`, `rota.js:respMixRotaHoje`, `momentos.js:mixRec` |
| 32 | **Mix do vendedor (SKU/cliente)** | Produtos distintos por cliente positivado no mês | Premiação RV `mix_vendedor` (`cache_resposta rv2`) | CEVEN `produtividade.mix_mes` | `clube_venda_dia.media_sku` (dia) | 30 min (RV) | "sem dado" | `momentos.js:respMomento` (v.mixMes, CEVEN), `metas_industria.js` (RV) |
| 33 | **Vendas item a item (produto, período)** | Pedidos por produto/cliente/dia | `public/vendas_mes/<filial>.json` | `vendas_mes_anterior` | `ficha_cliente` | D-1 · **parado em 11/11** | "base até <data>" | `vendas.js:vendasEscopo`/`respProduto`/`respIndustria`/`respTopProdutos`, `periodos.js`, `segmentos_pastas.js` |
| 34 | **Prospects** | CNPJs prospectados, com estado da coleta | `prospects_mapa` + `prospects_coleta_status` | — | — | 1x/dia · 16/11 14:13 | "coleta sem retorno" ≠ zero | `segmentos_pastas.js:respProspect*`, `gestao.js:respMatinal` |

### 1D. INDÚSTRIA

| # | Dado | Definição oficial | Fonte 1 | Fonte 2 | Fonte 3 | Frescor · medido | Sem fonte | Onde é usado |
|---|---|---|---|---|---|---|---|---|
| 35 | **Meta R$ por indústria** | "Meta (R$)" por vendedor × fornecedor | `gerot_vendas` | Premiação RV `metas` tipo 1 (conferido TCV 352: 9 indústrias iguais) | — | 2 h | "sem meta cadastrada" | `gerot_industria.js:respGerotIndustria`, `painel_industrias.js` (RV), `metas_industria.js` (RV), `entende.js` (~linha 401) |
| 36 | **Meta de positivação por indústria** | Clientes por fornecedor (ex.: Arcor 90 para TCV 352) | **só** Premiação RV `metas` tipo 0 (API externa) | — | — | 30 min (cache) | "o GEROT não traz meta de clientes por indústria" | `metas_industria.js:respMetasIndustria`, `painel_industrias.js` |
| 37 | **Faturado / carteira / positivação por indústria** | colunas do GEROT por fornecedor | `gerot_vendas` | RV `apuracao-agregada` (fat_f, fat_v, pos_f) | — | 2 h | "sem leitura" | `gerot_industria.js`, `painel_industrias.js`, `metas_industria.js`, `analista_senior.js` |
| 38 | **Venda do dia por indústria** | pedido colocado hoje por fornecedor | lacuna L3 (Clube, tabela por fornecedor) | GEROT D+0 nas cargas | — | — | "só o mês" | não existe |

### 1E. OPERAÇÃO, EQUIPE E LIGA

| # | Dado | Definição oficial | Fonte 1 | Fonte 2 | Fonte 3 | Frescor · medido | Sem fonte | Onde é usado |
|---|---|---|---|---|---|---|---|---|
| 39 | **Status do pedido** (bloqueado, liberado, montado, faturado, cortado) | Etapa do pedido no Winthor, com linha do tempo | `pedido_status` + `pedido_status_hist` | lacuna L5 (Clube Relatório de Pedido: "Tipo Bloqueio", "Pedido Winthor") | `ficha_cliente.$.ped[].status` | 15 min · **parado: pedidos até 14/11** | "status lido em <data>; pedidos de hoje ainda não estão na base" | `vendas.js:respPedidoNumero`/`respPedidosStatus`, `gestao.js:respBloqueioComercial`/`respMatinal` (bloqueados 7 dias), `escopo.js` (`winthor_fila`) |
| 40 | **Equipe / hierarquia / supervisor** | Quem aparece, de qual supervisor, grupo e canal | Gestão de Equipe (`config_equipe_soberana` via `/api/tv-mostra`) | `arvore_supervisores` (CEVEN, 13/11) | `clube_venda_dia.sup_cod` (hoje) · `gerot_vendedor_mes.cod_sup` | quando muda · 09/11 | divergência vai para o painel da Gestão de Equipe | `escopo.js:vendedoresDaFilial`/`carregaEscopo`/`achaPessoa`, `persona.js`, `gestao.js:respMatinal` (lê `arvore_supervisores.vend_nome`, **coluna inexistente**: a coluna é `nome`) |
| 41 | **Quem é quem no JOTA** | celular → papel, filial, rca, supervisor | `bot_contatos` (+ `linha_corporativa`) | — | — | ao vivo | "número ainda não liberado" (nunca silêncio) | `persona.js`, `api/whatsapp/bot.js` |
| 42 | **Liga (lances, classificação)** | Regras congeladas (`public/pontuacao_brasileirao.json`) | `tv_lances` (`/api/brasileirao-lances`) + `liga_fechamento` | `public/dados_brasileirao.json` (GitHub, 15 em 15 min) | — | 15 min · lances 17–18/dia desde 12/11 (gerador depende do CEVEN) | "a Liga está sem lances novos desde 11/11" | `liga_mix.js:respLances`/`respLiga`/`respRegrasLiga`, `momentos.js`, `resumo.js` |
| 43 | **RET / compromisso do supervisor** | visitas do supervisor e compromisso até 10h | `supervisores_dia` (`/api/tv-supervisores`) | — | — | 15 min · 09:00 | "sem leitura" | `liga_mix.js:respCompromisso`, `indicadores.js:respSemana` |
| 44 | **Incentivo / bola cheia** | regras do mês | `/api/incentivo-outubro`, `bola_cheia*` | — | — | — | — | `indicadores.js:respIncentivoOficial`, `respBola` |

---

## 2. Conflitos de definição (mesmo dado, contas diferentes) e a definição oficial

| # | Dado | Contas que existem hoje (medido) | Oficial | Por quê |
|---|---|---|---|---|
| C1 | **Positivação do vendedor** | TCV 352 Tamara: GEROT **50 de 99**; CEVEN 15/11 **48 de 99**; `rota.js:respClientesVend` "com pedido no mês **74 de 133**" (carteira do roteiro com pedido colocado) | **GEROT "Positivação (filial + CNPJ)" / "Meta de positivação"**. Os "74 de 133" passam a se chamar **"clientes com pedido no mês"** e nunca aparecem como positivação | Positivação = cliente com faturamento líquido > 0 (glossário do próprio JOTA, `liga_mix.js`). 133 é a carteira ("Meta clientes" do GEROT), não a meta |
| C2 | **Positivação da filial/supervisor/Brasil** | API: card "agora" **1.279 de 3.528** (GEROT filial) × matinal **1.280 de 3.737** (soma dos vendedores do GEROT). Brasil: soma das metas de positivação dos vendedores 32.377 × soma das 11 filiais 28.731 | **Linha do nível** (`gerot_filial_mes`, `gerot_supervisor_mes`); Brasil = soma das 11 filiais | O mesmo CNPJ em duas pastas conta duas vezes na soma de vendedores. R$ continua somando de baixo para cima (bate centavo a centavo) |
| C3 | **"Ontem"** | `momentos.js:ontemClubeResumo` = último dia **da rede** com venda > 0 → **domingo 15/11** (R$ 15.850, 10 pedidos) → "Ontem (15/11): sem pedido no Clube" para quase todos; `gestao.js:respMatinal` = último `data_pedido` em `pedido_status` → **13/11**; `periodos.js` = último dia do item a item → ≤ 11/11 | Linha 7 da tabela: último dia não domingo/feriado com leitura do Clube; para o vendedor, o último dia em que ele teve rota ou pedido | Na segunda o vendedor quer saber da sexta (ou do sábado se trabalhou). Uma função, uma data escrita |
| C4 | **Digitado do dia** | Clube R$ 2,75 mi × GEROT "Captação Dia" R$ 2,12 mi (17:27) × `pedido_status` (parado) × produtividade do CEVEN (parada) | **Clube `total_pedido`** = "pedido colocado". GEROT captação = "captado no Winthor", outro nome | O Clube é a origem do pedido e lê a cada 30 min; o GEROT só vê o que integrou e com 2 h de atraso. TPH tem captação GEROT > Clube (pedidos diretos no Winthor): somar o "Winthor sem vínculo" quando existir `clube_pedido` |
| C5 | **% da meta** | `escopo.js` `pct` = fat/meta (rankings, `respRanking`); cartão do vendedor, matinal e momentos = (fat + carteira)/meta | Dois indicadores com nome: **"faturado X%"** e **"com carteira Y%"**. Ranking e cartão usam o **mesmo** | Decisão de 11/11 ("mesma conta do CEVEN: (faturado + a faturar)/meta") vale para o JOTA; premiação é só faturado. O problema é usar os dois com o mesmo nome |
| C6 | **Meta R$** | GEROT × `meta_hierarquia` (CEVEN tela Filiais): MCD 9,68 mi × 9,06 mi; TCA 6,74 × 6,33; TPH 11,00 × 10,61; TPA 6,80 × 6,78 (outras 7 iguais) | **GEROT `gerot_vendedor_mes."Meta (R$)"`**; `meta_hierarquia` só de reserva | Decisão de 13/11 ("esquece o CEVEN... o GEROT é atualizado") é posterior à de 31/10 (BASE_UNICA: "fonte é o CEVEN"). Registrar em BASE_UNICA que a de 31/10 caiu |
| C7 | **Meta de positivação do vendedor** | código: `"Meta de positivação" ?? "Meta clientes"` (`gestao.js:respMatinal`, `analista_senior.js`, `resumo.js`); TCV 352: 99 × 133 | **"Meta de positivação"**, sem fallback. Sem ela: "meta não cadastrada" | "Meta clientes" é a carteira; usar como meta infla a meta em ~35% |
| C8 | **Recorrência — meta e positivados** | GEROT (TCV 352, pasta 543): objetivo 25 · meta 20 · positivados 8; `rota.js:respTagCampanhas`: meta = 80% dos clientes com TAG no roteiro do mês; `momentos.js:recorrenciaGerot` soma também a linha velha da pasta 22 (objetivo 5, gravada em 11/11) | **GEROT `gerot_recorrencia_pasta`, só as linhas da última carga**. A lista de clientes vem de `cliente_focos` (lacuna L6) e só lista nomes | Meta é do GEROT (Vitório 10/11: "a meta de recorrência tem no GEROT") |
| C9 | **Devolução** | número do GEROT (`escopo.js` v.dev) com rodapé "Fonte: painel do CEVEN... o GEROT mostra mais" em `rota.js:respDevolucao` | **GEROT "Devolução (R$)"**, rodapé "GEROT <posição>". Faturado negativo: "faturado R$ X − devolvido R$ Y" | O rótulo tem que dizer a fonte do número que está na tela |
| C10 | **Rota do dia** | matinal lê `roteiro_dia` (tabela inexistente) → "Rota 0 PDVs" (57 respostas em 16/11); `momentos.js` "Você não tem rota hoje no CEVEN"; Clube tem 4.959 PDVs programados hoje | Quantidade = **Clube `roteiros`**; lista = Roteiro do Clube (L2) → roteiro do mês gravado, rotulado "planejado", só se a quantidade bater | |
| C11 | **"Positivação" do dia** | `escopo.js` põe `ped = total_pedidos` (nº de pedidos do Clube) e telas chamam de positivação; `entende.js` lê `produtividade.dia.positivacao` do CEVEN (sem dado); GEROT tem "Positivação do dia" (faturada) | **Positivação do dia = GEROT "Positivação do dia"**; nº de pedidos se chama "pedidos" | Um pedido não é um cliente; cliente com 2 pedidos conta 2 |
| C12 | **Última compra** | `roteiro.data_ultima_compra` (valores-padrão), `ficha_cliente.ult`, `mix_hist`, `clube_justificativa.dias_sem_comprar` | **`ficha_cliente.ult`** (pedido real), corrigida pelo pedido do mês; Clube como 2ª | Decisão de 31/10: a data do roteiro não é confiável |
| C13 | **Tendência e dias úteis** | 3 contas de tendência e 2 de dias úteis (seção 1B, linha 24) | Uma função `fatos.tendencia()` + `base.js:diasUteisRestantes` | Mesmo número na matinal, no "como estou" e no resumo |
| C14 | **Equipe** | Gestão de Equipe × árvore do CEVEN × Clube (`sup_cod`) × GEROT (`cod_sup`) | **Gestão de Equipe** | CLAUDE.md (05/10: "esqueça a planilha"); as outras três só alimentam o painel de divergências |
| C15 | **Indústria** | 3 leitores: `gerot_industria.js` (GEROT), `painel_industrias.js` e `metas_industria.js` (RV + GEROT) | R$: GEROT; meta de clientes por indústria: RV (gravada no D1) | R$ conferidos iguais; o RV só acrescenta a meta de clientes |

---

## 3. Arquitetura recomendada: camada única de FATOS

### 3.1 Princípio
Toda resposta, cartão, matinal, momento e proativo pede o número para **uma** camada (`functions/_lib/fatos/`). A camada escolhe a fonte pela ordem desta tabela, mede o frescor e devolve o número **com a fonte e a hora**. Os arquivos de `respostas/` só formatam texto e **não fazem SQL**.

### 3.2 O tipo `Fato`
```js
/** @typedef {'fresco'|'velho'|'sem_leitura'|'sem_fonte'} Estado */
/** @typedef {{ valor:any, def:string, fonte:'Clube'|'GEROT'|'CEVEN'|'Winthor'|'DataLake'|'RV'|'Gestão', tabela:string,
 *              lido_em:string|null, idade_min:number|null, estado:Estado, reserva:boolean, obs?:string }} Fato */
/** @typedef {{ nivel:'vendedor'|'supervisor'|'grupo'|'filial'|'brasil', filial?:string, rca?:string, cod_sup?:string, grupo?:string }} Alvo */
```
- `def` = número da linha deste documento (ex.: `'D16'` positivação do mês) — rastreável na auditoria.
- `estado !== 'fresco'` ⇒ o formatador **não pode** escrever 0; escreve `semLeitura(fato)`.

### 3.3 Módulos e funções
| Arquivo | Função (assinatura) | Linhas do mapa |
|---|---|---|
| `fatos/index.js` | `criaFatos(env, { agora }) → F` (memoiza por pergunta; substitui os `B._pedHoje`, `B._gerotVend`, `B._escopoCache`) | — |
| `fatos/definicoes.js` | `DEF[id] = { nome, definicao, fontes:[...], validade_min, rotulo }` (esta tabela em código) | todas |
| `fatos/fontes_estado.js` | `F.estadoFontes(dia) → { clube:{ultima, primeira, rodadas}, gerot:{em, posicao}, ceven:{bloqueado, ultima}, pedidos:{ate}, datasets:{vendas_mes, mix} }` | §0.1 |
| `fatos/dia.js` | `F.digitado(alvo, dia?)`, `F.pedidosDia(alvo, dia?)`, `F.rotaDia(alvo)` → `{qtd, lista, fonte_lista}`, `F.visitas(alvo)`, `F.justificativas(alvo)`, `F.ontem(alvo)` → `{dia, ...digitado}` | 1–11 |
| `fatos/mes.js` | `F.mes(alvo, mes?)` → `{faturado, carteira, devolucao, bruto, meta, atg_faturado, atg_com_carteira, positivacao, meta_positivacao, carteira_clientes, cortes, captacao_dia, positivacao_dia}` (cada campo um `Fato`; positivação lida no nível); `F.tendencia(alvo)`; `F.recorrencia(alvo)` | 12–25 |
| `fatos/cliente.js` | `F.clientes(alvo, { filtro: 'sem_compra_mes'|'recorrencia'|'tag:<X>'|'rota_hoje' })` → lista com `{id, nome, cnpj, ultima_compra, dias, comprou_mes, visitou_hoje, motivo}`; `F.curvaNegativa(alvo)`; `F.ultimaCompra(filial, id)`; `F.ficha(filial, id|cnpj)` | 26–34 |
| `fatos/industria.js` | `F.industria(alvo, { fornecedor?, mes? })` (GEROT + meta de clientes do RV gravada no D1) | 35–38 |
| `fatos/pedido.js` | `F.pedido(num)` (nº Clube **ou** Winthor), `F.pedidosAbertos(alvo)` | 39 |
| `fatos/equipe.js` | `F.equipe(alvo)` (Gestão de Equipe; devolve `divergencias`), `F.pessoa(texto, escopo)` | 40–41 |
| `fatos/texto.js` | `rodape(fatos[]) → "Clube 18:39 · GEROT 16/11 17:27"`, `semLeitura(fato)`, `podeZero(fato)` | regra 2 e 3 |

### 3.4 O que hoje duplica lógica e deve passar a chamar a camada
| Hoje | Problema | Troca por |
|---|---|---|
| `functions/_lib/jota/escopo.js:vendedoresDaFilial` (mistura snapshot + `gerot_vendas` + `pedido_status` + `winthor_fila` + Clube) | coração de quase todas as respostas; chama nº de pedidos de positivação; % só faturado | `F.equipe` + `F.mes` + `F.digitado` (vira adaptador fino) |
| `functions/api/central-snapshot.js` (reserva CEVEN, GEROT, Clube, `cliente_focos`, meta_hier) | o JOTA herda as regras de mistura da TV/motor | o JOTA para de ler o snapshot (TV e motor do WhatsApp continuam; Projeto A/B não mexe) |
| `functions/_lib/clube.js:lerClubeFilial`/`diaDoClube` | idade 45 min aqui, 30 min no plano | `fatos/dia.js` |
| `respostas/momentos.js:diaClube`, `ontemClubeResumo`, `recorrenciaGerot` | "ontem" = domingo; soma pasta velha | `F.ontem`, `F.recorrencia`, `F.clientes(rota_hoje)` |
| `respostas/gestao.js:respMatinal`, `respTendencia`, `respCarteira`, `diasUteisAgora`/`diasUteisMes` | `roteiro_dia` inexistente; `vend_nome` inexistente; soma positivação; outra tendência | `F.mes`, `F.rotaDia`, `F.tendencia` |
| `respostas/resumo.js:posGerotFiliais`, `posGerotSupervisor`, `totaisOficiais`, `respHoje` | leitura própria do GEROT | `F.mes(alvo)` |
| `jota/analista_senior.js` (lê `gerot_*` e `pedido_status`) | 4ª cópia das contas | `F.mes`, `F.pedidosAbertos` |
| `respostas/rota.js:clientesComPedidoNoMes`, `semCompraNaRota`, `respClientesVend`, `respTagCampanhas`, `respPositivacao` | carteira, recorrência e positivação calculadas aqui | `F.clientes`, `F.recorrencia`, `F.mes` |
| `jota/entende.js` (curva negativa ~1408–1480, positivação hoje ~1130, fechamento ~348/~837, indústria ~401) | regra de negócio dentro do roteador de perguntas | `F.curvaNegativa`, `F.mes`, `F.industria` |
| `respostas/periodos.js:vendasAnterior`, `ontemClube`, `respClientesSemComprar`; `respostas/vendas.js:vendasEscopo` | leem JSON do GitHub parado em 11/11 | `F.clientes`/`F.vendasItem` (D1) |
| `respostas/gerot_industria.js`, `painel_industrias.js`, `metas_industria.js`; `jota/fontes.js:carregaRV` | 3 leitores de indústria + API externa ao vivo | `F.industria` (RV gravado por coletor) |
| `monitoria/analista.js`, `monitoria/motor.js` (lêem `cliente_focos`, GEROT) | proativo com outra conta | `F.*` (mesmo número da resposta) |

### 3.5 Travas para não voltar a acontecer
1. `testes/rodar_testes.mjs`: falha se aparecer `env.DB.prepare` em `functions/_lib/jota/respostas/` ou `entende.js` fora de uma lista que só encolhe (mesmo modelo de `docs/mapa_dados_base.json`).
2. Falha se uma resposta de teste tiver "R$ 0", "0 PDVs", "sem rota" ou "nenhum cliente" com o `Fato` em estado ≠ `fresco`.
3. Falha se uma resposta não tiver o rodapé de fontes.
4. A bateria das 370 perguntas de 16/11 passa antes de publicar (plano, Fase 3).

### 3.6 Ordem de troca (do que mais errou para o que menos errou)
1. `F.estadoFontes` + `podeZero` (107 respostas "R$ 0") → 2. `F.rotaDia` (57 "Rota 0 PDVs") → 3. `F.ontem` (62) → 4. `F.mes` com positivação por nível e `Meta de positivação` sem fallback (C1, C2, C7) → 5. `F.recorrencia` + `F.clientes` (curva, recorrência) → 6. `F.industria` → 7. `F.pedido`.

---

## 4. Lacunas: o que nenhuma fonte tem hoje e como obter

| # | Lacuna | Efeito hoje | Como obter (online, sem PC) |
|---|---|---|---|
| L1 | **Lista de pedidos do dia** (nº Clube, nº Winthor, cliente, valor, operação, sincronizado, bloqueio) | sem "meus pedidos de hoje", sem clientes com pedido hoje, sem vínculo Clube × Winthor, soma pode contar duas vezes | `pipeline/clube_coletor.mjs` já abre o `painelPedido` (só conta). Ler todas as páginas do **Relatório de Pedido** e gravar em `clube_pedido` (só o que mudou). Passo 1 do MAPA_DAS_FONTES, não executado |
| L2 | **Roteiro do dia cliente a cliente** | nomes da rota vêm do roteiro do mês de 11/11 | Clube "Roteiro Pedido" → `clube_roteiro_dia` 1x de madrugada + releitura de quem mudou |
| L3 | **Venda do dia por indústria** | indústria só no mês (GEROT) | tabela por fornecedor do Relatório de Vendas do Clube → `clube_venda_forn_dia` |
| L4 | **Motivo da devolução** (notas novas) | motivo parado; gol contra e vermelho da Liga dependem disso | inventário das abas do GEROT (`gerot-inventario.yml`, passo 3, não executado) para achar devolução por nota/motivo; senão `rca/devolucoes/{nota}` quando o CEVEN voltar (pelo coletor central; hoje bloqueado pela trava) |
| L5 | **Status do pedido sem o CEVEN** | `pedido_status` parado em 14/11 | colunas "Pedido Winthor", "Sincronizado", "Tipo Bloqueio" do Relatório de Pedido do Clube (junto com L1); faturado/carteira por pedido no GEROT "Extrair dados" com Pedido (a testar) |
| L6 | **Lista de clientes foco / recorrência / campanhas** | "nenhum cliente com a tag Recorrência" quando a lista existe | gravar CEVEN admin `/api/admin/clientes-foco` (todas as 29 páginas) + `/campanhas` em `cliente_focos` (já existe, vazia) 1x/dia **pelo coletor central** (endpoint admin; respeitar a trava enquanto o Vitório mantiver); reserva: tela Recorrência do GEROT abrindo até cliente; terceira: Clube "Mix de Produtos/foco". A cópia local em `CEVEN TELAS E ENDPOINTS/06_DATA_LAKE_DIARIO` tem só a página 1 (500 itens) e para em 08/10 |
| L7 | **Carteira por cliente** (positivação mês, M-1, 3M, A-1, carteira) | curva negativa depende do roteiro de 11/11 e de JSON do GitHub | publicar `gerot_cliente_mes` (código pronto, não publicado; a tabela não existe em produção) |
| L8 | **Vendas item a item, histórico e +MIX** | `vendas_mes`, `mix_hist`, `mix_rec`, `dados_mix.json` parados em 11/11 (dependem do CEVEN e do SQLite do Drive) | GEROT "Extrair dados" com Cliente + Produto (o robô já lista esses campos em `TODOS_CAMPOS`) gravando no D1; o +MIX passa a ler o D1 |
| L9 | **Meta de positivação por indústria no D1** | JOTA chama a API do RV ao vivo (fora da base única) | coletor grava `rv/api/metas` e `apuracao-agregada` no D1 1x/hora |
| L10 | **Clientes com pedido hoje / positivação colocada do dia** | nº de pedidos aparece como positivação | sai de L1 (CNPJ distinto em `clube_pedido`) |
| L11 | **Faturado do dia** | `clube_venda_dia.total_faturado` sempre 0 | GEROT por carga (diferença entre cargas) ou "Extrair dados" com Data; não usar o campo do Clube |
| L12 | **Fuso dos horários do Clube** | check-in em BRT, justificativa em UTC | normalizar no coletor (`clube-carga.js`) para BRT e documentar a coluna |
| L13 | **Trava de pausa não cobre todos os envios** | `config_flags.wa_pausa_proativa_ate = 2099-12-31` bloqueia tudo que o JOTA inicia **só** em `functions/_lib/jota/base.js:cotaEnvio` (chamada por `enviar`/`enviarImagem`). O analista de monitoria envia direto por `R.enviarTexto` em `functions/_lib/monitoria/analista.js` (linhas ~543 e ~556) sem passar por `cotaEnvio`: **412 mensagens proativas em 16/11** com a pausa ligada | todo envio (JOTA, monitoria, avisos, convites) passa por uma única porta (`base.js:enviar`) com a pausa, o teto antiban e a trava de dado fresco; teste que falha se aparecer `R.enviarTexto`/`enviarMidia` fora dessa porta. Até lá, o analista deve checar a mesma flag |

---

## 5. Histórico
- 16/11/2026 — Documento criado (arquiteto de dados), medindo o D1 de produção em 16/11 entre 18h e 18h45 BRT, só leitura. Achados novos nesta medição: `roteiro_dia` inexistente na matinal, `cliente_focos` vazia, "Meta clientes" usada como meta de positivação, "ontem" = domingo, linha velha de recorrência somada, fusos diferentes no Clube, `total_faturado` do Clube sempre 0, `gerot_cliente_mes` ainda não existe em produção, GEROT "Captação Dia" e "Positivação do dia" disponíveis e não usados, trava de pausa contornada pela monitoria.
