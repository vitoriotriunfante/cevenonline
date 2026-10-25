# Mega auditoria — domingo 25/10/2026 (preparação para segunda 26/10)

Pedido do Vitório: "mega auditoria nos dados que coletamos, arquitetura de dados, funcionalidades e tudo mais... cirúrgicos... deixar tudo no gabarito para amanhã... redundâncias".
Método: tudo medido (D1 contado tabela a tabela, código varrido arquivo a arquivo, logs do GitHub Actions, endpoints testados em produção).

## 1. Corrigido hoje (publicado, testado 531/531 + simulador do JOTA)
| # | O quê | Ganho |
|---|---|---|
| 1 | Mapa da TV Executiva desligado (DELETE + regravar o mapa inteiro a cada 5 min) | ~70 mi linhas/semana no D1 = os US$ 160 da conta |
| 2 | piloto_pedidos_intraday desligado (1,7 mi linhas, **nenhum leitor**) | ~11 mi linhas/mês |
| 3 | Varredura, lances e faturado do mês: fora das 06h–21h e domingo, 1 rodada a cada 30 min | ~60% menos execuções noturnas |
| 4 | **TV e Matriz pedem vendedores em LOTE** (/api/tv-vendedores, 25 por chamada) — antes 1 requisição por vendedor a cada 90 s | ~95% das requisições das TVs (o grosso dos 26 mi/mês). Validado: 75/75 respostas idênticas |
| 5 | Cache (memória + D1) em tv-supervisores, tv-supervisores-semana, divergencias | N telas = 1 consulta ao CEVEN a cada 5–10 min |
| 6 | Bola Cheia: depois de mostrada, a tela para de consultar; checagem de versão 30 s → 60 s (tvapp e Matriz; a casca tv.html não foi mexida para não derrubar a tela cheia) | requisições |
| 7 | descoberta-codigos semanal (domingo 22h) | 14.800 consultas/dia ao CEVEN |
| 8 | /saude usa a mesma regra de horário (não alarma no domingo/noite) | sem alarme falso |
| 9 | JOTA: recorrência diz claramente "sem dado (TV Executiva desligada)" | sem número congelado |

Conferido em produção depois de publicar: 17 telas 200, 16 APIs 200 (< 3 s), saúde só com o aviso normal de 429 do CEVEN (1,5%).

## 2. O que já estava certo (correção da auditoria anterior)
- Motor do WhatsApp lê a base central (pipeline/fonte_base.js, desde 07/10) e o canal da Gestão de Equipe (13/10).
- cron-faturado-mes, incentivo, metas e o "Digitado hoje" da Matriz vêm da base central.

## 3. Mapa da coleta (uma fonte)
CEVEN → **varredura central** (D1 varredura_central_rca) → TV, Matriz, Liga, WhatsApp, JOTA, Incentivo, Metas.
Fora da base, por necessidade (dado que só existe no CEVEN): login admin, compromisso/RET (cache 5 min), motivo de devolução por nota (≤6/rodada), Data Lake noturno (histórico de pedidos, PDVs, mix gap) e captura +MIX 02:00.

## 4. Pendências que dependem de decisão do Vitório
| # | Achado | Risco | Proposta |
|---|---|---|---|
| A | **WhatsApp 14:30 de 23/10 não saiu**: login de admin do CEVEN deu timeout 5x e o motor ABORTA o ciclo inteiro, embora o login só sirva para compromisso/RET | ciclo perdido | enviar o ciclo com "compromisso/RET: sem dado agora" em vez de abortar (Projeto B — só com ordem) |
| B | **Chave X-App-Secret do CEVEN escrita no código** e o repositório GitHub é **PÚBLICO**; `VALIDACAO_VENDEDORES_VJ_AS.xlsx` (nomes) versionado | segurança | tornar o repositório privado (Actions continua grátis até 2.000 min/mês? hoje usamos ~1.300 min/semana → **ficaria pago**) ou mover a chave para segredo da Cloudflare e tirar a planilha |
| C | Arquivos do site público com dados de clientes (dados_mix.json, mix_*: CNPJ, nome, coordenada) sem login | exposição de dados | proteger /mix e os JSON com a mesma senha da Gestão |
| D | Data Lake: passo "Histórico do Vendedor" falha TODA noite (os mesmos ~80 RCAs sem resposta, contas vagas/novas) e gasta ~150 min | nada perdido para os outros 480; workflow fica vermelho | pular RCAs sem histórico há 3 noites e 1 tentativa por passada (cai para ~15 min) — mexer só depois de segunda |
| E | 18 endpoints sem nenhum chamador (anomalias-roteiro, cliente-detalhe, conferencia-supervisor, consolidador-diario, cron-aquecimento-matinal, cron-arvore, cron-fechamento-20h, cron-matinal-04h, cron-relatorio-horario, cron-whatsapp-dispatcher, debug-ceven, historico, onde, oportunidades-mix, pre-analise-rca, varredura-status, whatsapp/flash-alert; whatsapp/bot é webhook, fica) | confusão, código morto | apagar (lista mostrada; só com ok) |
| F | 14 tabelas vazias no D1 (roteiros_visitas, prospects_receita, pedidos_faturados_itens, pedidos_cortes_auditoria, oportunidades_mix_gap, linkup_cadastros_preparados, flash_alerts, devolucoes_auditoria, config_tv, config_equipe_apoio, clientes_historico_compras, briefings_ia_clientes, anomalias_roteiro_auditoria, resumo_snapshot) + piloto_pedidos_intraday (1,7 mi) e mapa_executivo_live (86 mil) sem uso | nenhum custo (armazenamento 0,18 GB de 5 GB grátis) | DROP das tabelas mortas (compartilhado: só com ok) |
| G | index.html / mobile.html (NOC antigo) ainda no ar em "/" e chamam endpoints legados (flash-alerts, inteligencia-gerencial vazio, cron-radar-horario que consulta o CEVEN) | carga se alguém abrir "/" | redirecionar "/" para /tvs |
| H | 4 workflows antigos só manuais, duplicando o relógio da Cloudflare (tv-varredura-central-cron, tv-lances-cron, tv-faturado-mes-cron, tv-executiva-mapa-live) | confusão | apagar |
| I | Recorrência e resgates do dia ficaram sem fonte (vinham do mapa) | JOTA/TV sem esse número | calcular na hora a partir do roteiro já gravado na base (só leitura, zero gravação) |
| J | Aviso de gasto na Cloudflare (US$ 10) + pedido de estorno dos US$ 160 | — | Vitório no painel |

## 5. Monitorar segunda 26/10
- 06:00: varredura volta a 2 min (partida a frio = leitura completa).
- 07:45 / 10:00 / 11:30 / 14:30 / 17:00 / 18:30: WhatsApp (risco A).
- Fim do dia: `npx wrangler d1 insights ceven_noc_d1 --sort-by=writes --timePeriod=1d` deve ficar < 1,5 mi linhas/dia; requisições da TV ~1/25 do que eram.
