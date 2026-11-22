# INVENTÁRIO COMPLETO — CEVEN várias telas (domingo, 22/11/2026)

> **Como foi feito:** leitura do código (worker-cron, 31 workflows, 89 endpoints, `functions/_lib`, `pipeline/`, `scripts/`, telas), **medição no D1 de produção** (só SELECT, 135 tabelas, contagem de linhas e última gravação), histórico real do GitHub Actions (`gh run list`), lista de segredos (só os nomes) e **o que está rodando no PC do Vitório agora** (tarefas agendadas do Windows e processos). Nada foi alterado, publicado ou commitado. Horários em **Brasília (BRT)**, salvo quando escrito UTC.
>
> **Para quem:** o Vitório (diretor comercial) lê as seções 1, 2, 5 e o resumo final. A pessoa técnica lê tudo.
>
> **Atenção ao ler as datas:** 20/11 foi feriado, 21/11 sábado e hoje é domingo. Tabela de dia útil (lances, check-in) sem gravação desde 19/11 é **normal**; segunda-feira 23/11 é o primeiro teste real. Marquei como **PARADA** só o que parou por outro motivo (quase sempre: CEVEN desligado em 16/11).

---

## 1. MAPA DE UMA PÁGINA

```
 FONTES                    COLETORES (quem busca)                          D1 ceven_noc_d1 (2,6 GB)            PRODUTOS
 ──────                    ──────────────────────                          ────────────────────────            ────────
 GEROT (portal BI)  ──►  GitHub: gerot-horario.yml (sonda 15 min)   ──►  gerot_* (20 tabelas)          ──►  JOTA (WhatsApp)
  faturado, carteira,      └► gerot-coleta.yml (Playwright, ~2 h)          gerot_cliente_mes 345 mil            Matinal (/matinal + cards)
  devolução, indústria,       gerot_coletor_online + gerot_carteira        gerot_pedido 203 mil                 Liga/Champions
  positivação do mês          + gerot_devolucoes → POST /api/gerot-carga   gerot_cliente_forn_mes 126 mil       TV (mês do GEROT)

 Clube da Venda     ──►  (1) PC do Vitório: tarefa Windows 15 min    ──►  clube_venda_dia, clube_rodada   ──►  JOTA, TV (dia),
  (TradePro)               clube_coletor.mjs --d1 (só totais do dia)       clube_checkin, clube_justificativa    Liga (lances),
  pedido colocado,       (2) GitHub: clube-coletor.yml (30 min)            clube_pedido, clube_roteiro           MONITOR.IA piloto,
  check-in, justificativa,  clube_coletor --api + clube_roteiro            → POST /api/clube-carga               totais do dia
  roteiro                   → POST /api/clube-carga

 CEVEN (travado)    ──►  worker-cron → /api/cron-ceven-admin (15 min) ──►  supervisores_dia (compromisso/RET) ──► JOTA (momentos),
  só admin + gerente       ?so=sup | gps | dev | tags                      ceven_gps_visita, ceven_devolucao_*    Liga (impedimento GPS,
  (functions/_middleware)  GitHub: tags-clientes-foco.yml (3x/dia)         cliente_focos (TAGs)                   gol contra), TV supervisores
                           GitHub: brasileirao-dataset.yml →               (plus_inputs.json, não vai ao D1)  ──► Liga (Plus de Liderança)
                             coletar_plus_lideranca.js (FORA da trava)

 Evolution (WhatsApp) ◄─► /api/whatsapp/bot (webhook do JOTA)        ◄─►  bot_msgs, bot_contatos, bot_contexto,     JOTA responde
                                                                          wa_cota, cache_resposta
 Gemini / OpenAI /         usados dentro do JOTA (entende.js, analista_senior.js, aprendizado.js) — não gravam dado de venda
 Anthropic / Workers AI

 Gestão de Equipe   ──►  telas /gestao-equipe e /divergencias        ──►  config_equipe_soberana  ──►  TODOS (quem aparece, supervisor, grupo)
 (decisão humana)          /api/equipe-*                                   (+ arvore_supervisores, canal_ceven)

 Google Drive       ──►  só os workflows antigos do CEVEN (desligados desde 16/11): pedidos_historico_ceven.db, historico_visitas.db, mix_gap_hist.db
 GitHub (repo PÚBLICO) ◄─ brasileirao-dataset.yml grava public/dados_brasileirao.json na main; a tela /brasileirao e o JOTA leem de raw.githubusercontent.com
```

**Quem manda no relógio:** o worker **`ceven-cron-sync`** (Cloudflare, conta vitorio.triunfante, publicado hoje 22/11 às 19:02) tem **um único gatilho**: a cada 15 min, nos minutos **:02, :17, :32 e :47**, todo dia. Dentro dele o código decide o que chamar pela hora de Brasília. A variável **`CEVEN_DESLIGADO = true`** (16/11) apaga todo o resto: os horários antigos do WhatsApp (07:45, 10:00, 11:30, 14:30, 17:00, 18:30), o aquecimento das 04:00, o Data Lake das 03:00 e os relógios da TV (varredura central a cada 2 min, lances a cada 5 min, mapa executivo, faturado do mês). **Nada disso roda.** Além disso o `wrangler.toml` do worker só declara o gatilho de 15 min; a tabela `GATILHOS` do código ficou morta mesmo que alguém mude a variável.

**Quem guarda os dados:** um banco só, o **D1 `ceven_noc_d1`** (2,6 GB; nas últimas 24 h: 4,4 milhões de consultas, 489 milhões de linhas lidas, 814 mil gravadas — num domingo).

---

## 2. AGENDA REAL (o que roda de verdade a partir de segunda 23/11)

"Reserva" = existe um segundo disparador (o `schedule:` do próprio GitHub, que atrasa de 1 a 7 h e às vezes não dispara, ou outra máquina).

| Horário (BRT) | Dias | O que roda | Quem dispara | Reserva? | Manda mensagem? |
|---|---|---|---|---|---|
| 00:17 a 05:17, de hora em hora | seg-sáb | Clube da Venda (rota do dia já existe de madrugada) | só `schedule` do GitHub (clube-coletor.yml) | não | não |
| 03:00 | seg-sáb | TAGs Clientes Foco (CEVEN admin) → `cliente_focos` | `schedule` do GitHub (tags-clientes-foco.yml) | — (é ele a reserva do item das 06h) | não |
| 06:00 a 21:45, a cada 15 min | seg-sáb | **Sonda do GEROT** (lê só "última atualização"); se mudou, dispara a **coleta do GEROT** | worker → gerot-horario.yml → gerot-coleta.yml | sim: schedule 06:05-20:35 de 30 em 30 min | não |
| 07:17 e 21:17 | seg-sáb | **Coleta do GEROT fixa** (começo do dia e última carga) + Carteira + Devolução por motivo + lances da Liga + cards da Matinal (só se a hora for 06-08) | worker → gerot-coleta.yml | sim: schedule 07:15, 09:15 ... 19:15 e dom 20:15 | não |
| 06:00 a 20:45, a cada 15 min | seg-sáb | **CEVEN do admin**: compromisso/RET (`so=sup`), GPS das visitas pelo login dos gerentes (`so=gps`, 07-20h), devoluções (`so=dev`), TAGs (`so=tags`, 1x de manhã e 1x depois das 13h) | worker → /api/cron-ceven-admin | parcial (só TAGs: tags-clientes-foco.yml 03h/11h/15h) | não |
| 06:32 e 13:02 | seg-sáb | **Auditoria do JOTA por papel** (48 perguntas secas, régua) → `jota_auditoria` | worker → jota-auditoria.yml | sim: schedule 06:30 e 13:00 (pode rodar 2x) | não |
| 07:00 a 20:45, em :02 e :32 | seg-sáb | **Clube da Venda online** (vendas, check-in, justificativa, pedidos) + rota nominal (relê a cada 3 h) + árvore de supervisores (CEVEN gerente, se > 45 min) + **lances da Liga** (/api/liga-clube) | worker → clube-coletor.yml | sim: schedule :17 e :47 de 06h a 20h | não |
| a partir de 07:00, a cada 15 min (o dia inteiro, todo dia, inclusive domingo) | todos | **Clube da Venda no PC** (só totais por vendedor; não grava check-in nem justificativa) | **Tarefa do Windows "CEVEN Clube da Venda"** no notebook do Vitório | — | não |
| 07:00 a 21:45, a cada 15 min | seg-sáb | **Vigia das fontes** (Clube 60 min, GEROT 3 h, CEVEN admin 45 min, lances 90 min, agendador 40 min) | worker → /api/vigia-fontes | sim: vigia-fontes.yml 07:17-20:47 (**ainda nunca rodou**) | **sim, ao Vitório** (mas ver risco 6.3: hoje fica bloqueado) |
| 07:00 a 20:45, em :17 e :47 | seg-sáb | **Classificação da Liga** (scratch/build_brasileirao_dataset.py + Plus de Liderança no CEVEN admin) → commit de `public/dados_brasileirao.json` na main | worker → brasileirao-dataset.yml | não | não |
| 08:00 e 20:00 | todos | **Guarda de custo** Cloudflare (projeção do mês; > US$ 10 avisa; > US$ 15 liga o freio) | `schedule` do GitHub (guarda-custo.yml) | não | **sim, ao Vitório** (só se passar do limite) |
| 09:00 a 20:45, a cada 15 min, 1 chamada por filial (11) | seg-sex, sem feriado | **MONITOR.IA piloto** (janelas 10:00, 12:00, 17:00, 18:30 na hora local; TCG/MCD/TCA 1 h a menos) | worker → /api/monitoria-piloto?filial=X | não | **hoje não**: modo SOMBRA (só grava em `monitoria_envios`) |
| 19:17 | seg-sex, sem feriado | **Curador do JOTA** (lê perguntas/👎/sugestões do dia, grava aprendizados com Gemini) | worker → /api/cron-aprendizado | não | **sim, resumo ao Vitório** (só se gravar algo) |
| 22:00 | todos | Guardar visitas e justificativas no Drive | `schedule` do GitHub (guardar-visitas.yml) | não | não — **zumbi**: lê a base do CEVEN parada desde 16/11 |
| 22:17 | seg-sex | **Fechamento do dia da Liga** + Semana Invicta (idempotentes) | worker → /api/cron-fechamento-dia e /api/cron-semana-invicta | não | não |
| 20:15 | domingo | Coleta do GEROT do fim de semana (para a Matinal de segunda) | só `schedule` do GitHub | não | não |
| sob demanda | — | JOTA responde quem escreve (webhook da Evolution → /api/whatsapp/bot) | WhatsApp | — | sim, só resposta (pausa "só responder" até 2099) |
| 05:00 e 18:30 | todos | `run_pipeline_diario.py` (pasta "CEVEN TELAS E ENDPOINTS") | Tarefa do Windows "CEVEN_Lakehouse_Diario" | — | não — **falha todo dia** (código de saída 1) |

**Não roda mais (desligado ou de data única):** ceven-cron-whatsapp.yml (motor antigo, último 16/11), ceven-cron-marca-propria.yml (16/11), ceven-cron-datalake.yml (16/11) → e com ele ficha-clientes-d1.yml e mix-dataset.yml; prospects-coleta.yml (16/11); descoberta-codigos.yml (16/11); fechamento-outubro.yml (1/11). **Cuidado:** jota-boas-vindas.yml (`30 10 26 10 *`), jota-guia-supervisores.yml (`0 10 30 10 *`) e jota-convite-vendedores.yml (`0 14 31 10 *`) têm horário com **data fixa sem ano** — disparam de novo em 26, 30 e 31/10/2027 e mandam WhatsApp para supervisores.

**Só manual (ferramentas de mapeamento, sem agenda):** analise-sob-demanda, clube-mapa-telas, clube-roteiro-mapa, gerot-carteira, gerot-detalhe-mapa, gerot-devolucoes, gerot-inventario (nunca rodou), gerot-mapa-telas, jota-aviso-matinal, whatsapp-teste.

**Publicação do site:** tv-deploy.yml roda a cada push (43 vezes em 2 dias, todas "sucesso"), mas **não publica nada**: o segredo `CLOUDFLARE_API_TOKEN` não existe no GitHub, o passo de deploy é pulado. O site só muda quando alguém roda `node publicar_tv.js` no PC.

---

## 3. TABELAS DO D1 (135)

Legenda do estado: **VIVA** = gravou nas últimas 72 h por rotina automática · **FIM DE SEMANA** = de dia útil, última gravação 19/11, volta segunda · **MANUAL** = só gravou hoje porque alguém rodou à mão · **PARADA** = sem gravação há mais de 3 dias · **VAZIA/LEGADO** = nunca usada ou parada desde setembro/outubro. Última gravação convertida para BRT quando a coluna é UTC.

### 3.1 GEROT (fonte do mês e da indústria) — todas gravadas por `/api/gerot-carga` (que recebe do GitHub)
| Tabela | Para que serve | Quem lê | Linhas | Última gravação | Estado |
|---|---|---|---|---|---|
| gerot_cliente_mes | cliente × vendedor × mês (faturado, carteira, positivação) | JOTA (rota, matinal, gestão), arvore_ceven | 344.884 | 22/11 12:14 | VIVA |
| gerot_pedido | pedido a pedido do mês (nº, NF, cliente) | JOTA (pedidos), arvore_ceven | 203.129 | 22/11 12:18 | VIVA (consulta por `pedido` sem índice: 28 mi de linhas lidas/dia) |
| gerot_cliente_forn_mes | cliente × indústria × mês | JOTA gestão, Liga (mix) | 126.045 | 22/11 12:17 | VIVA |
| gerot_vendas | vendedor × indústria × mês | JOTA (indústria, escopo), central-snapshot | 33.536 | 22/11 11:01 | VIVA |
| gerot_pedido_entrada | 1ª vez que cada pedido apareceu na carteira (hora do gol) | Liga, JOTA rota | 15.357 | 22/11 11:09 | VIVA |
| gerot_carteira | Carteira Total: pedido em aberto, status, bloqueio | JOTA, Liga, matinal | 5.264 | 22/11 11:09 | VIVA |
| gerot_vendedor_mes | painel do vendedor no mês (meta, positivação) | JOTA, TV, matinal, arvore | 4.720 | 22/11 11:01 | VIVA |
| gerot_filial_dia | filial por dia | JOTA gestão | 1.248 | 22/11 11:03 | VIVA |
| gerot_supervisor_mes | supervisor no mês | JOTA, matinal | 899 | 22/11 11:01 | VIVA |
| gerot_devolucao_motivo_vend | devolução por motivo e vendedor (só 13h e 17h) | JOTA gestão | 982 | 21/11 17:44 | VIVA |
| gerot_recorrencia_pasta | recorrência por pasta | JOTA | 665 | 21/11 13:25 | VIVA |
| gerot_devolucao_motivo | devolução por motivo e filial | JOTA | 199 | 22/11 12:26 | VIVA |
| gerot_coleta_status | controle de cada carga (posição, linhas) | vigia, JOTA (frescor) | 130 | 22/11 12:13 | VIVA |
| gerot_filial_mes | filial no mês | JOTA, matinal | 55 | 22/11 11:01 | VIVA |
| gerot_horario | leituras da sonda ("última atualização" do GEROT) | ninguém lê (só diagnóstico) | 14 | 21/11 23:38 | VIVA (domingo sem sonda) |
| gerot_recorrencia | recorrência (versão antiga) | ninguém | 537 | 11/11 | PARADA — substituída por gerot_recorrencia_pasta |
| gerot_historico_filiais / _industrias / _supervisores | carga única de histórico (pipeline/gerar_sql_d1.mjs, manual) | whatsapp/gerot_inteligencia (só _industrias) | 96 / 300 / 390 | 06/11 | PARADA (era carga única) |

### 3.2 Clube da Venda (fonte do dia) — gravadas por `/api/clube-carga` (GitHub) e direto pelo PC (`--d1`)
| Tabela | Para que serve | Quem lê | Linhas | Última gravação | Estado |
|---|---|---|---|---|---|
| clube_venda_dia | totais do dia por vendedor (pedido colocado, visitas, roteiros) | JOTA (28 lugares), TV, totais-dia, matinal, Liga | 6.196 | 22/11 19:03 | VIVA (domingo = PC) |
| clube_rodada / clube_coleta_status | controle de cada rodada | vigia, MONITOR.IA, JOTA | 489 / 336 | 22/11 19:03 | VIVA |
| clube_pedido | pedido colocado, nº do Clube e do Winthor, bloqueio | JOTA (pedidos, rota), central-snapshot | 9.712 | 21/11 23:24 | VIVA |
| clube_checkin | check-in/out cliente a cliente | Liga, JOTA rota, TV vendedor | 43.446 | dia 20/11 | FIM DE SEMANA (sábado sem check-in gravado — conferir 23/11) |
| clube_justificativa | motivo de não venda | Liga (pênalti), JOTA | 18.714 | dia 20/11 | FIM DE SEMANA |
| clube_roteiro / clube_roteiro_leitura | rota do dia com nome do cliente | JOTA, TV vendedor | 10.658 / 2 | 19/11 18:45 | FIM DE SEMANA — **só 2 dias gravados (18 e 19/11); conferir segunda** |

### 3.3 CEVEN — só o que ainda é permitido (admin e gerente)
| Tabela | Para que serve | Quem grava | Quem lê | Linhas | Última | Estado |
|---|---|---|---|---|---|---|
| supervisores_dia | compromisso e RET do dia por supervisor | cron-ceven-admin (`so=sup`) | JOTA momentos, vigia | 46 | 22/11 16:33 | MANUAL hoje; de 16 a 21/11 nada. Volta segunda (worker publicado hoje) |
| supervisores_ret_detalhe | detalhe do RET | idem | supervisores_coleta | 285 | 11/11 | PARADA |
| cliente_focos | TAGs (recorrência, campanhas) | cron-ceven-admin `so=tags` **e** tags-clientes-foco.yml (duas rotas) | Liga, JOTA rota, central-snapshot | 54.169 | 19/11 11:55 | PARADA há 3 dias (TAGs de 20 e 21/11 não entraram) |
| ceven_gps_visita | GPS do check-in/out (impedimento da Liga) | cron-ceven-admin `so=gps` | liga-clube | **0** | nunca | **VAZIA — nunca gravou** (criada hoje; teste real segunda) |
| ceven_devolucao_nota / ceven_devolucao_checado | notas de devolução pelo admin (gol contra) | cron-ceven-admin `so=dev` | liga-clube | 1.029 / 256 | 22/11 16:35 | MANUAL hoje |
| devolucao_nota_motivo | motivo da nota de devolução | arvore_ceven (e cron-lances antigo) | Liga, JOTA | 3.751 | 22/11 16:35 | MANUAL hoje |
| arvore_supervisores | supervisor → vendedores (CEVEN gerente) | cron-arvore (via clube-coletor.yml) | Liga, TV, metas, divergências | 530 | 21/11 18:49 | VIVA |
| canal_ceven | canal (V, P, G, S...) de cada código | arvore_ceven, divergencias | tv-mostra, bola cheia, JOTA | 662 | 21/11 18:50 | VIVA |

### 3.4 Liga / Champions
| Tabela | Para que serve | Quem grava | Quem lê | Linhas | Última | Estado |
|---|---|---|---|---|---|---|
| tv_lances | todos os lances (gols, cartões, pênaltis) | /api/liga-clube (Clube+GEROT), tv-lances, reparos | brasileirao-lances, TV, JOTA, MONITOR.IA | 92.716 | dia 19/11 (mexida hoje 14:49) | FIM DE SEMANA |
| tv_lances_retirados | lances tirados pela auditoria | (reparo manual de hoje) | liga-clube | 1.387 | 22/11 12:45 | MANUAL |
| liga_fechamento / liga_dia_fechado / liga_fechamento_copia | dia congelado (placar oficial) | liga_fechamento.js, liga-clube | Liga, conferência | 45 / 64.723 / 32 | refechado hoje 14:51 (dias 10 a 19/11) | MANUAL hoje; automático só a partir de 23/11 22:17 |
| lances_excluidos_liga | lances excluídos no fechamento | liga_fechamento.js | Liga, TV, JOTA | 4.513 | 17/11 | PARADA (só grava quando fecha) |
| auditoria_lance_resumo / auditoria_lance_falha | auditoria lance por lance | cron-auditoria-lances | tela /brasileirao, /divergencias | 41 / 3.321 | 22/11 14:52 / 10/10 | MANUAL |
| semana_invicta_checada | controle da Semana Invicta | cron-semana-invicta | ele mesmo | 7 | 13/11 (semana 46) | PARADA — semana 47 (16-20/11) não foi conferida; conferir |
| bola_cheia / bola_cheia_dia / bola_cheia_as / bola_cheia_as_dia | Bola Cheia do dia (vencedor por filial às 18h) | _lib/bola_cheia.js, congelado pelo cron-lances | /api/bola-cheia (TV, Matriz) | 261 / 31 / 50 / 5 | 13/11 | **PARADA — Bola Cheia não congela desde 13/11** (quem congelava era o cron-lances, desligado) |
| notif_lance_enviado / notif_envio_log | sino do CEVEN para supervisores | cron-notificacoes-supervisores | ele mesmo | 39.771 / 9.050 | 16/11 | PARADA (CEVEN) |
| conferencia_rca | conferência D1 × CEVEN às 19h30 | cron-conferencia-dia | ele mesmo | 8.106 | 11/11 | PARADA (CEVEN) |
| coletor_estado | relógio do cron-lances | cron-lances | cron-lances | 1 | 16/11 | PARADA |

### 3.5 JOTA (WhatsApp)
| Tabela | Para que serve | Quem grava | Linhas | Última | Estado |
|---|---|---|---|---|---|
| bot_msgs | toda mensagem que entra e sai | whatsapp/bot e todos os envios | 15.893 | 22/11 | VIVA (16/11: 847 saídas; 22/11: 19) |
| bot_contexto | memória da conversa (filial/vendedor em foco) | jota/fontes | 502 | 22/11 19:08 | VIVA |
| cache_resposta | cache de respostas e telas | jota/fontes, cache_borda | 33 | 22/11 18:55 | VIVA |
| bot_sugestoes | sugestões e 👎 | bot, conversas, passaporte | 508 | 22/11 | VIVA |
| bot_contatos / bot_contatos_log | quem pode falar com o JOTA e papel | jota-contatos, passaporte, persona | 408 / 358 | 21/11 / 19/11 | VIVA |
| linha_corporativa | números corporativos (situação) | ninguém no código (carga manual) | 1.341 | 21/11 | MANUAL |
| wa_cota | teto antiban por dia | jota/base | 56 | dia 21/11 | VIVA |
| jota_foco_dia | clientes em foco do dia | jota/respostas/momentos | 608 | 19/11 23:18 | FIM DE SEMANA |
| jota_auditoria | resultado das auditorias por papel | /api/jota-auditoria | 73 | 22/11 19:08 | VIVA (hoje rodada no PC) |
| jota_aprendizados | aprendizados do curador | jota/aprendizado | 6 | 21/11 21:15 | **só 1 rodada na vida, manual** |
| passaporte_cadastros | cadastro do vendedor pelo link | jota-passaporte | 317 | 19/11 | VIVA (sob demanda) |
| bot_envio_fila | fila de envio que falhou | bot, jota-contatos | 27 | 18/11 | VIVA (sob demanda) |
| bot_avisos_equipe | avisos de mudança de equipe | jota/respostas/gestao | 6 | 17/11 | sob demanda |
| matinal_cards | 248 cards PNG da Matinal | scripts/gerar_cards_matinal.mjs (GitHub) | 248 | **17/11 06:35** | **PARADA — só existem os cards de 17/11** |
| jota_piloto, jota_campanha_sim, bot_reproc, bot_sem_acesso_excluidos | piloto 01/11, simulação 09/11, reprocesso, exclusões | — | 23 / 189 / 1 / 6 | 01/11 a 16/11 | PARADAS (eram pontuais) |

### 3.6 MONITOR.IA
| Tabela | Para que serve | Linhas | Última | Estado |
|---|---|---|---|---|
| monitoria_envios | todo alerta (enviado, simulado, sombra) | 183 | 21/11 09:13 (2 testes) | VIVA a partir de 23/11 (sombra) |
| regras_monitoria | regras do motor antigo (S1..S5) | 18 | 16/11 | PARADA |
| domain_events | eventos do detector antigo | 60 | 15/11 | PARADA |
| monitoria_roi | valor em risco/recuperado | 54 | 16/11 | PARADA |

### 3.7 Gestão de Equipe e controle
| Tabela | Para que serve | Linhas | Última | Estado |
|---|---|---|---|---|
| config_equipe_soberana | **quem aparece em tudo** (1 linha JSON) | 1 | 21/11 16:55 | VIVA |
| audit_alteracoes_equipe | histórico de mudanças da equipe | 58 | 21/11 16:55 | VIVA |
| solicitacoes_ajuste_equipe | pedidos dos gerentes | 49 | 19/11 | sob demanda |
| config_equipe_soberana_copia | cópia de segurança | 1 | 17/11 | sob demanda |
| equipe_tentativas | bloqueio de senha errada | 26 | 09/11 | sob demanda |
| config_flags | chaves e travas (pausa até 2099, token admin do JOTA, token admin do CEVEN, piloto) | 10 | — | VIVA (tem 2 credenciais guardadas: ok, fica no D1) |
| config_custo | freio de custo | 1 | 31/10 | sob demanda |
| tv_ping | sinal de vida das TVs | 61 | 22/11 19:14 | VIVA |
| d1_migrations | migrações aplicadas | 2 | 24/09 | — |

### 3.8 Base antiga do CEVEN (varredura central e afins) — tudo PARADO desde 16/11 (CEVEN desligado)
Gravadas por `cron-varredura-central`, `cron-lances`, `cron-mapa-executivo`, `cron-faturado-mes`, `arvore_ceven`, `ficha-carga` (Data Lake), `tv-vendedor`.

| Tabela | Linhas | Última | Quem ainda LÊ (e mostra dado velho) |
|---|---|---|---|
| varredura_central_rca | 27.966 | 16/11 09:02 | metas-mes, totais-dia, tv-vendedor, central-snapshot, divergencias, incentivo, winthor-divergencias, saude, bola_cheia — **ainda lida 3.440 vezes por dia** |
| pedido_status / pedido_status_hist | 30.516 / 93.627 | 21/11 23:25 (só o Clube acrescenta pela `pedido_status_fontes`) | JOTA (pedidos, bloqueio), pedidos-dia, tv-vendedor — **meio-viva** |
| cascata_dia | 228 | 16/11 07:04 | totais-dia, resumo_base, central-snapshot, tv-vendedor |
| resumo_executivo_live | 552 | 16/11 00:02 | mapa-executivo-live (Matriz), saude |
| meta_hierarquia | 576 | 14/11 | resumo_base (metas da TV), central-snapshot |
| historico_cliente / cache_analise_cliente | 10.718 / 2.541 | 16/11 | JOTA (oportunidades), tv-vendedor, pedidos-dia |
| ficha_cliente | 36.316 | 16/11 05:49 | JOTA (rota, ficha), Liga, MONITOR.IA |
| prospects_mapa / prospects_coleta_status | 58.544 / 652 | 16/11 | JOTA (prospects), matinal |
| rota_gerente_dia / painel_gerente_dia | 1.223 / 129 | 15-16/11 | JOTA momentos, frescor |
| winthor_fila / winthor_divergencias | 591 / 9.417 | 14-16/11 | tela /contatos (P. Winthor) |
| macro_fora_arvore, recheca_fila, pedido_leitura, coleta_falhas, saude_coleta, coleta_estado, varredura_slot | 54 a 2.203 | 15-16/11 | saude, frescor, central-snapshot |
| codigos_descobertos / descoberta_cursor | 27 / 1 | 16/11 | /divergencias |
| piloto_pedidos_intraday | **1.696.456** | 25/10 | ninguém — maior tabela do banco, morta há 4 semanas |
| mapa_executivo_live / recorrencia_resumo_live | 85.667 / 192 | 24/10 | mapa-executivo-live (Matriz) — **mapa da Matriz parado há 1 mês** |
| resumo_snapshot | 1 | 13/10 | ninguém |

### 3.9 VAZIAS ou LEGADO de setembro (podem ser apagadas depois de conferir; só a tela antiga `index.html` ainda lê)
`clientes_historico_compras` (0), `oportunidades_mix_gap` (0), `prospects_receita` (0), `devolucoes_auditoria` (0), `roteiros_visitas` (0), `anomalias_roteiro_auditoria` (0), `pedidos_cortes_auditoria` (0), `pedidos_faturados_itens` (0), `config_tv` (0), `flash_alerts` (0), `linkup_cadastros_preparados` (0), `briefings_ia_clientes` (0), `cron_lock_global` (0), `config_equipe_apoio` (0), `rca_kpis` (519, 24/09), `consolidado_diario_filial` (11, 24/09), `consolidado_executivo_live` (12, 24/09), `gerentes_filiais` (1, 24/09), `filiais` (11), `representantes` (560, sem data — ainda lido pela tela antiga e por /divergencias).

---

## 4. ENDPOINTS E SCRIPTS

### 4.1 Endpoints VIVOS (89 no total em `functions/api/`; estes têm quem chame e dado vivo)
| Grupo | Endpoints | Quem chama |
|---|---|---|
| JOTA | `whatsapp/bot` (webhook), `whatsapp/gerot_inteligencia` (importado pelo bot), `jota-seco`, `jota-auditoria`, `jota-contatos`, `jota-conversas`, `jota-passaporte`, `jota-reenviar` (manual), `jota-entende-teste` (testes), `pedidos-dia`, `devolucoes-motivos`, `liga-as` | Evolution, telas /contatos e /passaporte-jota, auditoria |
| Cargas | `gerot-carga`, `clube-carga`, `matinal-cards` | GitHub (coletores) |
| Liga | `liga-clube`, `brasileirao-lances`, `tv-lances`, `cron-fechamento-dia`, `cron-semana-invicta`, `cron-auditoria-lances` | GitHub (clube e GEROT), worker, telas |
| TV / Matriz | `tv-vendedor`, `tv-vendedores`, `tv-mostra`, `totais-dia`, `tv-supervisores`, `tv-supervisores-semana`, `tv-ping`, `version`, `bola-cheia`*, `metas-mes`*, `mapa-executivo-live`* | tvapp.html, matrizapp.html, tvs.html (* = responde, mas com dado parado: ver 4.3) |
| Equipe | `equipe-login`, `equipe-salvar`, `equipe-solicitacoes`, `equipe-decidir`, `divergencias` | /gestao-equipe, /divergencias |
| Matinal | `matinal` | /matinal |
| Agentes | `vigia-fontes`, `cron-ceven-admin`, `monitoria-piloto`, `cron-aprendizado`, `cron-arvore`, `diag-clientes-foco`, `monitoria` (tela) | worker, GitHub, /monitoria |
| Operação | `saude`, `telemetria-custo`, `custo-freio`, `mix-login`, `central-snapshot` (lê base parada), `frescor` (interno) | /saude, /custos-d1, guarda_custo |

### 4.2 Endpoints MORTOS
**Ninguém chama (nem tela, nem agenda, nem outro código):** `conferencia-supervisor`, `debug-ceven`, `diag-ceven-gerente`, `diag-premiacao`, `jota-ficha`, `jota-proativo` (a própria ficha diz "nenhum agendador chama"), `liga-repara-devolucao`, `liga-repara-pedido` (reparos de outubro, já usados), `onde`, `whatsapp/conversas`. Biblioteca sem uso: `functions/_lib/jota/resumo_mix.js`.

**Só eram chamados por agendas que o `CEVEN_DESLIGADO` apagou (código vivo, ninguém aciona):** `cron-varredura-central` (1.297 linhas — o maior arquivo), `cron-lances` (667), `cron-mapa-executivo`, `cron-faturado-mes`, `cron-piloto-pedidos`, `cron-monitoria` (analista antigo), `cron-notificacoes-supervisores`, `cron-conferencia-dia`, `cron-descobre-codigos`, `cron-lock`, `disparo-status`, `whatsapp/registro` (motor antigo), `varredura-status` (só testes).

**Campanhas de uma vez (já usadas):** `jota-boas-vindas`, `jota-cardapio`, `jota-convite-vendedores`, `jota-aviso-matinal`, `incentivo-outubro` (outubro acabou).

**Tela antiga `index.html` / `mobile.html` (painel de setembro):** `ia-whatsapp` (desligado, responde "use o JOTA"), `flash-alerts`, `inteligencia-gerencial`, `vendedor-detalhe`, `representantes`, `whatsapp/gerentes`, `cron-radar-horario` — leem tabelas vazias desde setembro; a tela ainda chama `/api/whatsapp/resumo-dia` e `/api/whatsapp/send-test`, **que não existem**. Também `cockpit-matinal` + `painel-gerente-matinal.html` (Matinal antiga, sem D1). `mix-teste` (tela /mix) chama o CEVEN → hoje devolve "CEVEN desligado". `tv_executiva.html` já diz "desativada em 25/10".

### 4.3 Vivos mas mostrando dado PARADO (o pior tipo: parece funcionar)
| Onde aparece | Endpoint | Lê | Parado desde |
|---|---|---|---|
| Meta do mês na TV e Matriz | `metas-mes` (via `_lib/resumo_base.js`) | varredura_central_rca + meta_hierarquia | 16/11 e 14/11 |
| Mapa executivo da Matriz | `mapa-executivo-live` | mapa_executivo_live, resumo_executivo_live | 24/10 e 16/11 |
| Bola Cheia na TV | `bola-cheia` | bola_cheia_dia | 13/11 |
| "P. Winthor" em /contatos | `winthor-divergencias` | winthor_* | 14-16/11 |
| Ficha do cliente e prospects no JOTA | jota/entende, rota, segmentos | ficha_cliente, prospects_mapa | 16/11 |
| Divergências de código | `divergencias` | codigos_descobertos | 16/11 |
| Guardar visitas no Drive (22h) | guardar-visitas.yml | central-snapshot → varredura | 16/11 (roda todo dia sem guardar nada novo) |
| Fair Play da Liga | build_brasileirao_dataset.py | pedidos_historico_ceven.db do Drive | 16/11 |

### 4.4 DUPLICADOS (duas rotas buscando ou calculando a mesma coisa)
1. **Clube da Venda: 3 coletores** — tarefa do Windows no PC (a cada 15 min, todo dia), clube-coletor.yml disparado pelo worker (:02/:32) e o mesmo yml pelo `schedule` do GitHub (:17/:47). O do PC só grava totais (sem check-in nem justificativa).
2. **TAGs Clientes Foco: 2 coletores** — `cron-ceven-admin?so=tags` (worker, 2x/dia) e `tags-clientes-foco.yml` → `diag-clientes-foco` (GitHub, 3x/dia).
3. **Compromisso/RET do supervisor: 2 coletores** — `cron-ceven-admin?so=sup` (grava no D1) e `scripts/coletar_plus_lideranca.js` dentro do brasileirao-dataset.yml (a cada 30 min, grava só um arquivo de passagem para a Liga).
4. **Lances da Liga gravados 2 vezes** — `/api/liga-clube?grava=1` é chamado no fim do clube-coletor.yml **e** do gerot-coleta.yml (é idempotente, mas é o mesmo cálculo pesado em dobro).
5. **Auditoria do JOTA 2x** — worker (06:32/13:02) e `schedule` do GitHub (06:30/13:00, atrasa e roda de novo).
6. **"Quanto vendeu / metas" com 5 contas diferentes** — `_lib/resumo_base.js` (metas-mes, saude), `cron-faturado-mes` (morto), `totais-dia` (TV), `central-snapshot` (JOTA fora do Cloudflare), `_lib/jota/respostas/*` (GEROT + Clube). A TV usa a base parada para a meta e o JOTA usa o GEROT: **podem mostrar números diferentes**.
7. **Três motores de mensagem proativa** — `_lib/monitoria/analista.js` (antigo, mandou 412 msgs em 16/11; desligado), `_lib/monitoria/piloto.js` (novo, em sombra) e `jota-proativo` (sem uso).
8. **Dois vigias** — `worker-cron/src/vigia.js` (vigia dos disparos antigos; morto) e `/api/vigia-fontes` (novo).
9. **Duas Matinais** — `/matinal` + cards (viva) e `cockpit-matinal` + `painel-gerente-matinal.html` (antiga).
10. **Dois motores de WhatsApp** — `pipeline/ceven_unified_engine.js` (abandonado em 17/11, ainda no repositório e no worker desligado) e o envio do JOTA (`_lib/jota/base.js` → `public/regras.js`).

### 4.5 `pipeline/` e `scripts/`
- **Vivos (rodam no GitHub):** `pipeline/gerot_coletor_online.mjs`, `gerot_carteira.mjs`, `gerot_devolucoes.mjs`, `gerot_horario.mjs`, `clube_coletor.mjs` (também no PC), `clube_roteiro.mjs`; `scripts/gerar_cards_matinal.mjs`, `scripts/coletar_plus_lideranca.js`; `scratch/build_brasileirao_dataset.py` (**a classificação oficial da Liga mora na pasta de rascunhos**); `analises/guarda_custo.js`, `analises/guardar_visitas.js` (zumbi); `testes/auditoria_papeis.mjs`.
- **Ferramentas manuais (mapear telas):** `clube_mapa_telas`, `clube_roteiro_mapa`, `gerot_detalhe_mapa`, `gerot_devolucoes_mapa`, `gerot_inventario`, `gerot_mapa_telas`.
- **Mortos (CEVEN/WhatsApp antigo ou ninguém chama):** `ceven_unified_engine.js`, `orquestrador_diario.js`, `1_sync_cadastros_mestre.js` a `4_consolidar_resumo_executivo.js`, `github_actions_runner.js`, `fonte_base.js`, `ceven_header.js`, `coletar_historico_oficial.mjs`, `consultar_industria.js`, `extrair_filigrama_completo.mjs`, `gerar_sql_d1.mjs`, `atualizar_sinonimos_novos.mjs`, `auditoria_sugestoes_rotina.mjs`, `disparar_guia_supervisores.mjs`.
- **`scripts/`: 458 arquivos no PC, só 24 no Git** (`.gitignore` ignora `scripts/*`). Os 434 restantes são análises e disparos de setembro/outubro que **só existem no notebook**; 156 deles chamam o CEVEN direto (ver `docs/MAPA_DADOS_GERADO.md`, seção 4). `scratch/`: 408 arquivos, 218 sem commit.
- **`analises/`:** o Data Lake inteiro (extrair_*, gerar_dados_mix, gerar_mix_gap_real, coletar_todos_os_pdvs...) morreu junto com o ceven-cron-datalake.yml em 16/11.

---

## 5. AGENTES

| Agente | O que faz | Quando roda | Manda mensagem a quem? | Estado amanhã (segunda 23/11) |
|---|---|---|---|---|
| **MONITOR.IA piloto** (`/api/monitoria-piloto`, `_lib/monitoria/piloto.js`) | Para os 22 supervisores do piloto (lista em `config_flags.monitoria_piloto`): 10h vendedor com rota e sem visita; 12h e 17h justificativas + cartões/pênaltis; 18h30 o dia da equipe. Números das mesmas funções do JOTA, texto fixo, teto 1 por janela e 4 por dia, fica calado se o Clube estiver com mais de 40 min | worker, seg-sex 09h-20h45, uma filial por chamada (janela na hora local) | **Ninguém por enquanto.** Só envia se `monitoria_liberada_ate` estiver no futuro — essa chave **não existe** → modo SOMBRA (grava em `monitoria_envios`) | Roda pela 1ª vez em dia útil. Esperado: linhas `PILOTO:` em `monitoria_envios` com status de sombra, zero WhatsApp. Conferir `?hoje=1` à tarde |
| **Analista Comercial antigo** (`cron-monitoria`, `_lib/monitoria/analista.js`) | Varredura de 15 em 15 min com texto de IA | não roda (ficou no ramo do CEVEN desligado) | — | Morto. Foi o que mandou 412 mensagens em 16/11 |
| **Analista Sênior** (`_lib/jota/analista_senior.js`) | Dentro do JOTA, para gerente/diretoria: monta dossiê com dado do D1 e pede texto a Gemini 2.5 Pro → Flash → OpenAI → Anthropic → Workers AI; `confereIA` barra número inventado | só quando alguém pergunta | só responde a quem perguntou | Normal (reativo) |
| **Curador** (`/api/cron-aprendizado`, `_lib/jota/aprendizado.js`) | Lê as conversas do dia, 👎 e sugestões; Gemini 2.5 Flash classifica; grava em `jota_aprendizados`; o JOTA usa esse contexto | worker, seg-sex 19:17 | **Resumo ao Vitório** (números em `NUMEROS_VITORIO`), direto pela Evolution (não passa pela pausa) — só se gravou algo | **1ª rodada automática da vida** (até hoje só rodou à mão em 21/11, 6 aprendizados). Conferir 19:20 se chegou o resumo |
| **Auditoria por papel** (`testes/auditoria_papeis.mjs` → `/api/jota-seco` → `/api/jota-auditoria`) | 48 perguntas secas (vendedor, supervisor, gerente, diretor) ao JOTA de produção, régua de qualidade, grava resultado no D1 (privado) | worker 06:32 e 13:02 seg-sáb + `schedule` 06:30/13:00 (reserva, roda de novo) | ninguém (nada é enviado) | Roda 2 a 4 vezes. Último resultado: 45 de 48 ok; bateria 17-22/11: 679 de 741 |
| **Vigia das fontes** (`/api/vigia-fontes`) | Confere a última leitura de Clube (60 min), GEROT (3 h), CEVEN admin (45 min), lances (90 min, dia útil 10-19h) e do próprio agendador (40 min); avisa 1x por fonte por dia e avisa quando volta | worker 07h-21h45 seg-sáb + reserva vigia-fontes.yml 07:17-20:47 | **Vitório (554187525605)** — **mas a mensagem passa pela pausa "só responder" (até 2099) e é bloqueada**, a não ser que o Vitório tenha escrito ao JOTA nos 15 min anteriores. Pior: o vigia marca "já avisei" antes de enviar, então não tenta de novo | Vai **detectar** e **não avisar**. Nunca rodou (`vigia_ultima` não existe). Precisa de correção antes de confiar |
| **Guarda de custo** (`analises/guarda_custo.js`) | Projeção do gasto Cloudflare do mês; liga/solta o freio | 08h e 20h todo dia (GitHub) | Vitório, se projeção > US$ 10 | Normal |

**Acoplamento escondido das chaves:** o worker manda `x-chave = MONITORIA_CRON_KEY`, mas esse segredo **não existe no site** (Pages tem só BOT_WEBHOOK_KEY, CEVEN_ADMIN_*, CEVEN_GERENTE_SENHA, CEVEN_WEBHOOK_SECRET, EQUIPE_SENHA, EVO_*, GDRIVE_SA_JSON, GEMINI_API_KEY). As rotas aceitam porque o valor bate com o `jota_admin_token` guardado no D1 (conclusão pelo envio do analista em 16/11). **Se alguém trocar o `jota_admin_token`, o worker deixa de ser aceito em vigia, CEVEN admin, MONITOR.IA e curador — sem erro visível.**

---

## 6. RISCOS

### 6.1 Pontos únicos de falha
1. **Worker `ceven-cron-sync` com um gatilho só** (a cada 15 min). Se ele parar, param juntos: sonda/coleta do GEROT (fica só o `schedule` atrasado do GitHub), CEVEN admin, MONITOR.IA, curador, fechamento da Liga às 22:17, classificação da Liga. O vigia que deveria avisar mora no mesmo worker; a reserva no GitHub nunca rodou.
2. **Fechamento da Liga e Semana Invicta**: só o worker, uma tentativa às 22:17 (seg-sex). Sem reserva. 17, 18 e 19/11 nunca fecharam e foram refechados à mão hoje.
3. **Classificação da Liga** depende de: GitHub Actions + script na pasta `scratch/` + commit na main + **repositório público** (a tela lê de raw.githubusercontent.com). Se o repositório virar privado, a Liga para.
4. **Token do GitHub do worker** (`GITHUB_TOKEN`, PAT): se vencer, nenhum workflow é disparado pelo worker (GEROT, Clube, Liga, auditoria). Conferir validade.
5. **Uma conta Evolution / um número do JOTA**: restrição do WhatsApp (10/11) já parou tudo uma vez; não há número reserva.
6. **D1 único** (2,6 GB): sem cópia de segurança agendada encontrada no código.

### 6.2 O que depende do PC do Vitório (fere a premissa "tudo online")
| Dependência | Onde | Situação |
|---|---|---|
| **Robô do Clube da Venda** | Tarefa Windows "CEVEN Clube da Venda" → `%USERPROFILE%\.ceven\rodar_clube.bat` → `RODAR_CLUBE.bat` → `clube_coletor.mjs --d1`, a cada 15 min desde 07:00, todo dia | Rodando agora. Redundante com o GitHub (que já tem TP_USER/TP_PASS), mas aos domingos é o único (o GitHub e o worker só rodam de segunda a sábado). Registrado em PREMISSA_ONLINE.md |
| **Publicar o site (TV, JOTA, Liga, telas)** | `node publicar_tv.js` no PC | tv-deploy.yml roda mas não publica (sem `CLOUDFLARE_API_TOKEN` no GitHub) |
| **Publicar o worker** | `npx wrangler deploy` em `worker-cron/` no PC | só manual |
| **434 scripts e 218 rascunhos sem Git** | `scripts/`, `scratch/` | só existem no notebook |
| Tarefas antigas falhando todo dia | "CEVEN_Lakehouse_Diario_05h/18h30" (pasta CEVEN TELAS E ENDPOINTS), "Triunfante - Auditoria KPIs" e "Morning News" (pasta Projetos IA\Pedidos) | código de saída 1 em todas hoje; não alimentam este projeto |
| Proxy local do CEVEN | `CEVEN OFFLINE\ceven-isolator.js` rodando desde 11/11 (portas 6101-6122) | outro projeto; chama o CEVEN direto quando usado |

### 6.3 Credenciais
- **Token do GitHub em texto puro** dentro do endereço do `origin` em `.git/config` deste repositório (só no PC, não vai ao Git). Quem copiar a pasta leva o token. Trocar por login do `gh`/gerenciador de credenciais e revogar o token.
- **Senha dos gerentes do CEVEN escrita no código e versionada num repositório PÚBLICO:** `scripts/atualizar_arvore_viva_11_filiais.js`, `analises/extrair_hierarquia_completa.js`, `scratch/confere_arvore.js`, `scratch/so_gestao.js` (e citada em `OPERACAO_WHATSAPP/REGRAS_E_MEMORIA_OPERACIONAL.md` e `docs/HISTORICO_INTEGRAL_CONVERSA_AUDITORIA.jsonl`). As Functions usam o segredo `CEVEN_GERENTE_SENHA`, mas a senha já está exposta no histórico do Git → **trocar a senha no CEVEN**. Mais 9 scripts só no PC têm senha escrita.
- **Dado de cliente no repositório público:** `public/mix_cli/`, `mix_vend/`, `mix_hist/`, `mix_rec/`, `vendas_mes/` (protegidos por senha no site, mas abertos no GitHub), `analises/atividade_por_cnpj.json` (1,6 MB), `analises/historico_justificativas_visitas.jsonl` (0,8 MB), `scripts/gerentes_contatos.json` e `MAIS_MIX/JOTA/sabatinas/_contatos.json` (telefones), `campanhas_extraordinarias/clientes_mars.json`. A senha do +MIX não protege nada enquanto o repositório for público.
- `config_flags` guarda `ceven_admin_token` e `jota_admin_token` no D1 (aceitável; não é código).

### 6.4 O que fala com o CEVEN fora da trava
A trava (`functions/_middleware.js`) **só vale dentro do site (Cloudflare Functions)**. Fora dela:
1. **`scripts/coletar_plus_lideranca.js`** — roda a cada 30 min (seg-sáb 07-20h) dentro do brasileirao-dataset.yml, login de admin e `/api/admin/supervisores/...` direto do GitHub. É o único que roda sozinho.
2. Workflows desligados que ainda chamam o CEVEN se alguém clicar: ceven-cron-datalake, mix-dataset, prospects-coleta, analise-sob-demanda, ceven-cron-whatsapp, ceven-cron-marca-propria.
3. `CEVEN OFFLINE\ceven-isolator.js` no PC e os 156 scripts manuais.
4. Dentro da trava, o que está liberado: admin (login, matriz de compromissos e RET, RET por período, clientes foco, devoluções view-as), `/api/rca/devolucoes`, gerente (login, roteiro de hoje do supervisor, supervisores, dashboard-cascata). `node scripts/mapa_dados.mjs --verificar` hoje: "187 arquivos chamam o CEVEN (base: 187); nenhum novo".

### 6.5 Outros riscos práticos
- **Vigia bloqueado pela pausa** (seção 5): o alarme não chega.
- **Matinal sem imagem**: `matinal_cards` só tem 17/11; a geração depende da coleta do GEROT cair entre 06h e 08h. Conferir segunda depois da coleta das 07:17.
- **Bola Cheia parada desde 13/11** e **Semana Invicta da semana 47 não conferida**.
- **GPS dos gerentes (`ceven_gps_visita`) nunca gravou** — o impedimento por GPS da Liga ainda não tem dado.
- **Rota nominal do Clube** só tem 18 e 19/11.
- **Campanhas com data fixa** voltam em out/2027 (seção 2).
- **Custo de leitura**: 489 milhões de linhas lidas num domingo; top consultas: `gerot_cliente_mes` com `json_extract` (38 mi), `gerot_pedido WHERE pedido = ?` sem índice (29 mi), `varredura_central_rca` parada (21 mi + 13 mi). Dentro da franquia (25 bi/mês), mas metade é leitura de tabela parada ou sem índice.
- **Maior tabela é lixo**: `piloto_pedidos_intraday` (1,7 milhão de linhas, parada desde 25/10).

---

## RESUMO — OS 10 MAIORES PROBLEMAS

1. **O alarme não toca:** o vigia das fontes manda o aviso pelo caminho do JOTA, que está em "só responder" até 2099; o aviso ao Vitório é bloqueado e marcado como enviado. Nunca rodou de verdade.
2. **O site não publica sozinho:** tv-deploy.yml roda "verde" em todo push, mas falta o `CLOUDFLARE_API_TOKEN`; TV, JOTA e Liga só mudam com `publicar_tv.js` no PC (e o worker só com `wrangler deploy` no PC).
3. **O Clube ainda roda no notebook** (tarefa do Windows a cada 15 min, todo dia), em triplicata com o GitHub; o domingo depende só do PC.
4. **Senha dos gerentes do CEVEN e dado de cliente (+MIX, CNPJ, telefones) estão num repositório público**; há também um token do GitHub em texto puro no `.git/config`. Trocar a senha, revogar o token, avaliar tornar o repositório privado (a Liga lê de lá — mudar isso antes).
5. **Telas vivas mostrando número de 16/11 ou mais velho:** meta do mês da TV/Matriz (base do CEVEN parada), mapa executivo (24/10), Bola Cheia (13/11), ficha do cliente e prospects do JOTA (16/11). TV e JOTA podem dar números diferentes.
6. **Um relógio só:** worker com um gatilho de 15 min comanda GEROT, CEVEN admin, MONITOR.IA, curador, Liga e fechamento; fechamento das 22:17 e classificação não têm reserva; as chaves do worker funcionam por coincidência com o `jota_admin_token`.
7. **Liga frágil:** classificação oficial é um script na pasta `scratch/`, fechamento automático só começa segunda, GPS dos gerentes nunca gravou, Semana Invicta 47 e Bola Cheia pendentes, Fair Play lê banco do Drive parado.
8. **Coleta duplicada:** Clube (3), TAGs (2), compromisso/RET (2), lances da Liga (2 por rodada), auditoria (2); e 5 contas diferentes de "quanto vendeu".
9. **Muito código morto:** ~35 endpoints sem uso ou só de agendas desligadas (inclusive os dois maiores, cron-varredura-central e cron-lances), tela antiga index.html chamando rotas que não existem, ~40 tabelas paradas ou vazias (a maior, 1,7 milhão de linhas, parada desde 25/10), 434 scripts que só existem no PC.
10. **CEVEN fora da trava:** `coletar_plus_lideranca.js` entra no CEVEN admin a cada 30 min direto do GitHub, por fora do `_middleware.js`; e três campanhas de WhatsApp de outubro vão disparar sozinhas de novo em outubro de 2027.
