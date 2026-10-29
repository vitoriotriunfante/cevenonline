# MAPA DOS DADOS — GERADO DO CÓDIGO

> **Não editar à mão.** Gerado por `node scripts/mapa_dados.mjs` em 2026-10-29 15:12 UTC. Plano e decisões: [BASE_UNICA.md](BASE_UNICA.md).

## 1. Quem chama o CEVEN e RODA SOZINHO (32)
Meta: só `functions/api/cron-varredura-central.js`.

| Arquivo | Roda | Endpoints |
|---|---|---|
| `functions/api/cron-lances.js` | cron do site (worker-cron) | /api/rca, /api/rca/devolucoes/${encodeURIComponent, /api/rca/historico-cliente/${encodeURIComponent |
| `functions/api/cron-mapa-executivo.js` | cron do site (worker-cron) | /api/rca/historico-cliente//{id} |
| `functions/api/cron-varredura-central.js` | cron do site (worker-cron) | /api/admin/filiais/hierarquia, /api/admin/login, /api/admin/view-as/rca/dashboard, /api/rca, /api/rca//{id} |
| `analises/coletar_todos_os_pdvs_e_prospects_100pct.py` | GitHub Actions (datalake 03:00) | /api/ceven/prospeccao-roteiro, /api/rca/roteiro-hoje |
| `analises/extrair_hierarquia_completa.js` | GitHub Actions (datalake 03:00) | /api/gerente-auth/login, /api/gerente/supervisor/rcas, /api/gerente/supervisores |
| `analises/extrair_historico_completo_11_filiais.js` | GitHub Actions (datalake 03:00) | /api/rca/historico-cliente//{id}, /api/rca/roteiro-hoje, /api/rca/roteiro-mes |
| `analises/extrair_historico_vendedores.js` | GitHub Actions (datalake 03:00) | /api/rca/historico-vendedor |
| `analises/extrair_metas_dashboard_rcas.js` | GitHub Actions (datalake 03:00) | /api/rca/dashboard, /api/rca/produtividade |
| `analises/extrair_produtividade_ret_dashboard_todos.py` | GitHub Actions (datalake 03:00) | /api/rca/dashboard, /api/rca/produtividade, /api/rca/ret-hoje |
| `analises/extrair_segmentos_rcas.js` | GitHub Actions (datalake 03:00) | /api/filiais//{id}/representante//{id} |
| `analises/extrair_tudo_devolucoes_cadastros.js` | GitHub Actions (datalake 03:00) | /api/linkup/solicitacoes, /api/rca/devolucoes, /api/rca/devolucoes//{id} |
| `analises/gerar_mix_gap_real.js` | GitHub Actions (datalake 03:00) | (monta a URL dinamicamente) |
| `analises/gerar_dados_mix.js` | GitHub Actions (workflow) | /api/rca/roteiro-mes |
| `pipeline/ceven_header.js` | GitHub Actions (workflow) | (monta a URL dinamicamente) |
| `pipeline/ceven_unified_engine.js` | GitHub Actions (workflow) | /api/admin/login, /api/filiais//{id}/representante//{id}, /api/rca/dashboard, /api/rca/devolucoes, /api/rca/produtividade, /api/rca/roteiro-hoje |
| `scripts/atualizar_arvore_viva_11_filiais.js` | GitHub Actions (workflow) | /api/gerente-auth/login, /api/gerente/supervisores, /api/gerente/tabelas-cascata |
| `scripts/coletar_plus_lideranca.js` | GitHub Actions (workflow) | /api/admin/login, /api/admin/supervisores//{id} |
| `functions/_lib/arvore_ceven.js` | site (Cloudflare) | /api/admin/filiais/hierarquia, /api/filiais/${String, /api/filiais//{id}/representante//{id}, /api/gerente-auth/login, /api/gerente/tabelas-cascata |
| `functions/_lib/ceven_admin_token.js` | site (Cloudflare) | /api/admin/login |
| `functions/_lib/ceven_notificacao.js` | site (Cloudflare) | /api/notificacoes/webhook//{id} |
| `functions/_lib/supervisores_coleta.js` | site (Cloudflare) | /api/admin/ret/periodo, /api/admin/supervisores/matriz-compromissos, /api/admin/supervisores/matriz-ret |
| `functions/api/cron-conferencia-dia.js` | site (Cloudflare) | /api/rca/devolucoes, /api/rca/produtividade |
| `functions/api/cron-descobre-codigos.js` | site (Cloudflare) | /api/rca |
| `functions/api/cron-radar-horario.js` | site (Cloudflare) | /api/rca/dashboard, /api/rca/produtividade |
| `functions/api/debug-ceven.js` | site (Cloudflare) | /api/rca/produtividade |
| `functions/api/diag-premiacao.js` | site (Cloudflare) | /api/gerente-auth/login, /api/gerente/holerite-link |
| `functions/api/divergencias.js` | site (Cloudflare) | /api/filiais |
| `functions/api/mix-teste.js` | site (Cloudflare) | (monta a URL dinamicamente) |
| `functions/api/saude.js` | site (Cloudflare) | /api/metas-mes |
| `functions/api/tv-supervisores-semana.js` | site (Cloudflare) | /api/admin/supervisores/matriz-compromissos, /api/admin/supervisores/matriz-ret |
| `functions/api/tv-vendedor.js` | site (Cloudflare) | /api/rca/dashboard, /api/rca/historico-cliente//{id}, /api/rca/produtividade, /api/rca/roteiro-hoje |
| `functions/api/vendedor-detalhe.js` | site (Cloudflare) | /api/ceven/prospeccao-roteiro, /api/rca/dashboard, /api/rca/devolucoes, /api/rca/produtividade, /api/rca/roteiro-hoje, /api/rca/roteiro-mes |

## 2. Onde os dados são GRAVADOS
### 2a. Tabelas do D1 (base única) e quem escreve
| Tabela | Escrita por |
|---|---|
| `arvore_supervisores` | `functions/_lib/arvore_ceven.js`, `scratch/patch_arvore2.js` |
| `audit_alteracoes_equipe` | `functions/api/equipe-decidir.js`, `functions/api/equipe-salvar.js`, `functions/api/equipe-solicitacoes.js`, `scripts/aplicar_vinculo_representantes.js`, `scripts/incluir_novos_arvore_liga.js` |
| `auditoria_lance_falha` | `functions/api/cron-auditoria-lances.js` |
| `auditoria_lance_resumo` | `functions/api/cron-auditoria-lances.js` |
| `bola_cheia` | `functions/_lib/bola_cheia.js` |
| `bola_cheia_as` | `functions/_lib/bola_cheia.js` |
| `bola_cheia_as_dia` | `functions/_lib/bola_cheia.js` |
| `bola_cheia_dia` | `functions/_lib/bola_cheia.js` |
| `bot_avisos_equipe` | `functions/_lib/jota/respostas/gestao.js` |
| `bot_contatos` | `functions/api/jota-contatos.js`, `functions/api/whatsapp/bot.js`, `functions/_lib/jota/persona.js` |
| `bot_contatos_log` | `functions/api/jota-contatos.js` |
| `bot_contexto` | `functions/_lib/jota/fontes.js` |
| `bot_msgs` | `functions/api/jota-boas-vindas.js`, `functions/api/jota-reenviar.js`, `functions/api/whatsapp/bot.js`, `functions/api/whatsapp/registro.js` |
| `bot_sem_acesso_excluidos` | `functions/api/jota-contatos.js` |
| `bot_sugestoes` | `functions/api/jota-conversas.js`, `functions/api/whatsapp/bot.js`, `functions/_lib/jota/fontes.js` |
| `cache_analise_cliente` | `functions/api/tv-vendedor.js` |
| `cache_resposta` | `functions/_lib/cache_borda.js`, `functions/_lib/jota/fontes.js` |
| `canal_ceven` | `functions/api/divergencias.js`, `functions/_lib/arvore_ceven.js`, `scratch/patch_canal_ceven.js`, `scratch/patch_canal_ocultos_super.js` |
| `cancel` | `.github/workflows/ceven-cron-datalake.yml` |
| `cascata_dia` | `functions/_lib/arvore_ceven.js` |
| `clientes_historico_compras` | `scripts/sincronizar_filiais_faltantes.js` |
| `codigos_descobertos` | `functions/api/cron-descobre-codigos.js` |
| `coleta_estado` | `functions/api/cron-varredura-central.js`, `functions/_lib/concorrencia.js` |
| `coletor_estado` | `functions/api/cron-lances.js`, `scratch/patch_coletor.js` |
| `conferencia_rca` | `functions/api/cron-conferencia-dia.js` |
| `config_custo` | `functions/api/custo-freio.js` |
| `config_equipe_apoio` | `scripts/aplicar_vinculo_representantes.js`, `scripts/incluir_novos_arvore_liga.js` |
| `config_equipe_soberana` | `functions/api/equipe-decidir.js`, `functions/api/equipe-salvar.js`, `functions/api/equipe-solicitacoes.js`, `scripts/aplicar_vinculo_representantes.js`, `scripts/incluir_novos_arvore_liga.js`, `scratch/carteira_tbe.js`, `scratch/carteira_tcg_tsj.js` |
| `config_flags` | `functions/api/cron-notificacoes-supervisores.js`, `functions/api/disparo-status.js`, `functions/_lib/ceven_admin_token.js` |
| `consolidado_diario_filial` | `pipeline/github_actions_runner.js` |
| `consolidado_executivo_live` | `pipeline/2_abertura_diaria.js`, `pipeline/3_sync_horario_intraday.js`, `pipeline/4_consolidar_resumo_executivo.js`, `pipeline/github_actions_runner.js` |
| `descoberta_cursor` | `functions/api/cron-descobre-codigos.js` |
| `devolucao_nota_motivo` | `functions/api/cron-lances.js` |
| `equipe_tentativas` | `functions/_lib/senha_equipe.js` |
| `filiais` | `pipeline/1_sync_cadastros_mestre.js` |
| `flash_alerts` | `functions/api/cron-radar-horario.js` |
| `gerentes_filiais` | `functions/api/whatsapp/gerentes.js` |
| `historico_cliente` | `functions/api/tv-vendedor.js` |
| `lances_excluidos_liga` | `functions/_lib/liga_fechamento.js` |
| `liga_dia_fechado` | `functions/api/liga-repara-devolucao.js`, `functions/_lib/liga_fechamento.js`, `scratch/patch_teste_trava.js` |
| `liga_fechamento` | `functions/api/liga-repara-devolucao.js`, `functions/_lib/liga_fechamento.js`, `scratch/patch_fecha_2330.js`, `scratch/patch_penalti_motivo.js`, `scratch/patch_teste_trava.js` |
| `mapa_executivo_live` | `functions/api/cron-mapa-executivo.js` |
| `meta_hierarquia` | `functions/api/cron-varredura-central.js` |
| `notif_envio_log` | `functions/api/cron-notificacoes-supervisores.js` |
| `notif_lance_enviado` | `functions/api/cron-notificacoes-supervisores.js` |
| `pedido_status` | `functions/api/cron-lances.js`, `functions/_lib/pedido_status.js` |
| `pedido_status_hist` | `functions/api/cron-lances.js`, `functions/_lib/pedido_status.js` |
| `piloto_pedidos_intraday` | `functions/api/cron-piloto-pedidos.js` |
| `rca_kpis` | `functions/api/cron-radar-horario.js`, `pipeline/2_abertura_diaria.js`, `pipeline/3_sync_horario_intraday.js`, `pipeline/github_actions_runner.js` |
| `recorrencia_resumo_live` | `functions/api/cron-mapa-executivo.js` |
| `representantes` | `pipeline/1_sync_cadastros_mestre.js`, `scripts/adicionar_novos_setores_tbe.js` |
| `resumo_executivo_live` | `functions/api/cron-faturado-mes.js`, `functions/api/cron-mapa-executivo.js` |
| `roteiros_visitas` | `pipeline/2_abertura_diaria.js`, `scripts/sincronizar_filiais_faltantes.js` |
| `saude_coleta` | `functions/api/cron-varredura-central.js` |
| `semana_invicta_checada` | `functions/api/cron-semana-invicta.js` |
| `solicitacoes_ajuste_equipe` | `functions/api/equipe-solicitacoes.js` |
| `supervisores_dia` | `functions/_lib/supervisores_coleta.js` |
| `supervisores_ret_detalhe` | `functions/_lib/supervisores_coleta.js` |
| `tv_lances` | `functions/api/liga-repara-devolucao.js`, `functions/api/tv-lances.js`, `scratch/patch_qual_todos.js`, `scratch/patch_qual_todos2.js` |
| `tv_ping` | `functions/api/tv-ping.js` |
| `varredura_central_rca` | `functions/api/cron-varredura-central.js`, `scripts/popular_varredura_manual.mjs` |
| `varredura_slot` | `functions/api/cron-varredura-central.js` |

### 2b. Bancos SQLite (FORA da base única)
| Banco | Usado por |
|---|---|
| `ceven_noc.db` | `scripts/adicionar_media_skus_cli.js`, `scripts/ajustar_dim_clientes_cadastro.js`, `scripts/ajustar_dim_hierarquia_sem_status.js`, `scripts/ajustar_tabela_mix_oportunidades.js`, `scripts/aplicar_regra_top3_mix.js`, `scripts/aplicar_schema_datalake.js`, `scripts/aplicar_top3_por_industria.js`, `scripts/atualizar_area_atuacao_vj_as.js`, `scripts/atualizar_elisabete_oficial.js`, `scripts/atualizar_metas_carteira_geral.js`, `scripts/atualizar_rota_hoje_02set.js`, `scripts/auditoria_global_11_filiais.js`, `scripts/buscar_detalhe_clientes_pendentes.js`, `scripts/buscar_pedidos_cassiany_detalhe.js`, `scripts/calibrar_recuperacao_oficial.js`, `scripts/checar_tabelas_cortes.js`, `scripts/check_db_supervisores.js`, `scripts/check_filiais_supervisores.js`, `scripts/check_tables.py`, `scripts/coletar_fechamento_fat_pos.js`, `scripts/consolidar_cockpit_matinal_oficial.js`, `scripts/consultar_consolidado_real.js`, `scripts/consultar_painel_filial_api.js`, `scripts/criar_tabelas_dashboard_mapa.js`, `scripts/criar_tabelas_registro_diario.js`, `scripts/cron_sincronizacao_horaria.js`, `scripts/daemon_disparo_17h.js`, `scripts/daemon_disparo_18h.js`, `scripts/daemon_fechamento_19h_20h.js`, `scripts/daemon_fechamento_oficial.js`, `scripts/disparar_18h_imediato.js`, `scripts/disparar_boletim_oficial.js`, `scripts/executar_comparativo_17h.js`, `scripts/executar_fechamento_11h.js`, `scripts/executar_fechamento_otimizado.js`, `scripts/executar_relatorio_final_matinal.js`, `scripts/exibir_auditoria_final_rca_3.js`, `scripts/exibir_auditoria_rca_204.js`, `scripts/exibir_auditoria_rca_3.js`, `scripts/exibir_dados_mapa.js`, `scripts/explodir_abc_completo.js`, `scripts/extrair_cortes_reais_abc_hoje.js`, `scripts/extrair_dados_reais_tela.js`, `scripts/extrair_detalhes_avancados_cliente.js`, `scripts/gerar_abertura_matinal_07h.js`, `scripts/gerar_dados_todas_filiais_cockpit.js`, `scripts/gerar_dataset_completo_11_filiais.js`, `scripts/gerar_excel_final.js`, `scripts/gerar_fechamento_ao_vivo_11h.js`, `scripts/gerar_planilha_vj_as.js`, `scripts/gerar_proposta_08h.js`, `scripts/gerar_prospects_rca_1022.js`, `scripts/gerar_relatorio_acompanhamento_horario.js`, `scripts/gerar_relatorio_matinal_11_filiais.js`, `scripts/gerar_relatorio_sabado_05_09.js`, `scripts/gerar_sql_d1_as.js`, `scripts/gravar_corte_real_cassiany.js`, `scripts/ingerir_e_exibir_rca_completo.js`, `scripts/ingerir_filial_completa.js`, `scripts/ingerir_rca_204_cassiany.js`, `scripts/ingerir_rca_3_elisabete.js`, `scripts/ingerir_todas_11_filiais_completo.js`, `scripts/inicializar_schema_mestre.js`, `scripts/inspecionar_dashboard_mapa.js`, `scripts/inspecionar_dias_sem_compra.js`, `scripts/inspecionar_estrutura_tabelas.js`, `scripts/inspect_api_painel_details.js`, `scripts/inspect_db_tables.js`, `scripts/inspect_positivacao.js`, `scripts/inspect_tbl_kpis.js`, `scripts/investigar_pedidos_cassiany.js`, `scripts/pipeline_ingestao_mestre_ceven.js`, `scripts/popular_cadastros_novos_clientes.js`, `scripts/popular_dim_hierarquia.js`, `scripts/popular_dim_hierarquia_pura.js`, `scripts/popular_e_exibir_itens_pedido.js`, `scripts/preparar_dados_modais.js`, `scripts/salvar_dia1_oficial.js`, `scripts/salvar_mix_oportunidades_16684.js`, `scripts/salvar_prospects_mapa.js`, `scripts/scratch_check_metas.js`, `scripts/sincronizar_carteira_mes.js`, `scripts/sincronizar_ceven_vendedores_online.js`, `scripts/sincronizar_rotas_04_09_real.js`, `scripts/sync_d1_producao_horario.js`, `scripts/sync_prospects_tsj.js`, `scripts/varrer_pedidos_cassiany_todos.js` |
| `historico_visitas.db` | `analises/guardar_visitas.js` |
| `mix_gap_hist.db` | `analises/gerar_dados_mix.js` |
| `pedidos_historico_ceven.db` | `pipeline/ceven_unified_engine.js`, `analises/coletar_todos_os_pdvs_e_prospects_100pct.py`, `analises/enriquecer_clientes_rf_e_gerar_mix.js`, `analises/extrair_historico_completo_11_filiais.js`, `analises/extrair_historico_vendedores.js`, `analises/extrair_metas_dashboard_rcas.js`, `analises/extrair_premiacao_e_ret_novo_har.py`, `analises/extrair_produtividade_ret_dashboard_todos.py`, `analises/extrair_segmentos_rcas.js`, `analises/extrair_tudo_devolucoes_cadastros.js`, `analises/gerar_dados_mix.js`, `analises/gerar_mix_gap_real.js`, `scripts/auditoria_apresentacao_vs_db.js`, `scripts/auditoria_db_analises.js`, `scripts/auditoria_definitiva_apresentacao.js`, `scripts/check_dev_schema.js`, `scripts/coletar_plus_lideranca.js`, `scripts/gerar_marca_propria.js`, `scripts/inspect_schema_analises.js` |

### 2b2. Tabelas gravadas nesses bancos SQLite (FORA da base única)
| Tabela | Escrita por |
|---|---|
| `apuracao_premiacao_rv_setembro` | `analises/extrair_premiacao_e_ret_novo_har.py` |
| `cadastros_linkup` | `analises/extrair_tudo_devolucoes_cadastros.js` |
| `cadastros_novos_clientes` | `scripts/popular_cadastros_novos_clientes.js` |
| `clientes_completo` | `analises/enriquecer_clientes_rf_e_gerar_mix.js`, `analises/extrair_historico_completo_11_filiais.js`, `analises/extrair_segmentos_rcas.js` |
| `clientes_roteiro` | `analises/extrair_historico_completo_11_filiais.js` |
| `devolucoes_itens` | `analises/extrair_tudo_devolucoes_cadastros.js` |
| `devolucoes_notas` | `analises/extrair_tudo_devolucoes_cadastros.js` |
| `dim_clientes_cadastro` | `scripts/atualizar_elisabete_oficial.js`, `scripts/atualizar_rota_hoje_02set.js`, `scripts/ingerir_e_exibir_rca_completo.js`, `scripts/ingerir_filial_completa.js`, `scripts/ingerir_rca_204_cassiany.js`, `scripts/ingerir_rca_3_elisabete.js`, `scripts/ingerir_todas_11_filiais_completo.js`, `scripts/pipeline_ingestao_mestre_ceven.js`, `scripts/sincronizar_carteira_mes.js` |
| `dim_clientes_carteira_pasta` | `scripts/atualizar_elisabete_oficial.js`, `scripts/atualizar_rota_hoje_02set.js`, `scripts/executar_relatorio_final_matinal.js`, `scripts/extrair_detalhes_avancados_cliente.js`, `scripts/ingerir_e_exibir_rca_completo.js`, `scripts/ingerir_filial_completa.js`, `scripts/ingerir_rca_204_cassiany.js`, `scripts/ingerir_rca_3_elisabete.js`, `scripts/ingerir_todas_11_filiais_completo.js`, `scripts/pipeline_ingestao_mestre_ceven.js`, `scripts/sincronizar_carteira_mes.js` |
| `dim_hierarquia` | `scripts/popular_dim_hierarquia.js`, `scripts/popular_dim_hierarquia_pura.js` |
| `dim_prospects_mapa` | `scripts/atualizar_elisabete_oficial.js`, `scripts/ingerir_e_exibir_rca_completo.js`, `scripts/ingerir_filial_completa.js`, `scripts/ingerir_todas_11_filiais_completo.js`, `scripts/salvar_prospects_mapa.js`, `scripts/sync_prospects_tsj.js` |
| `fato_devolucoes` | `scripts/ingerir_e_exibir_rca_completo.js`, `scripts/ingerir_rca_204_cassiany.js`, `scripts/ingerir_rca_3_elisabete.js` |
| `fato_mix_oportunidades` | `scripts/aplicar_regra_top3_mix.js`, `scripts/aplicar_top3_por_industria.js`, `scripts/atualizar_elisabete_oficial.js`, `scripts/extrair_detalhes_avancados_cliente.js`, `scripts/ingerir_filial_completa.js`, `scripts/ingerir_rca_3_elisabete.js`, `scripts/ingerir_todas_11_filiais_completo.js`, `scripts/pipeline_ingestao_mestre_ceven.js`, `scripts/salvar_mix_oportunidades_16684.js` |
| `fato_pedidos` | `scripts/ingerir_e_exibir_rca_completo.js`, `scripts/ingerir_rca_204_cassiany.js`, `scripts/ingerir_rca_3_elisabete.js`, `scripts/pipeline_ingestao_mestre_ceven.js` |
| `fato_pedidos_itens` | `scripts/ingerir_e_exibir_rca_completo.js`, `scripts/ingerir_rca_204_cassiany.js`, `scripts/ingerir_rca_3_elisabete.js`, `scripts/pipeline_ingestao_mestre_ceven.js`, `scripts/popular_e_exibir_itens_pedido.js` |
| `fato_rca_dashboard_snapshot` | `scripts/adicionar_media_skus_cli.js`, `scripts/atualizar_elisabete_oficial.js`, `scripts/cron_sincronizacao_horaria.js`, `scripts/gerar_fechamento_ao_vivo_11h.js`, `scripts/ingerir_e_exibir_rca_completo.js`, `scripts/ingerir_filial_completa.js`, `scripts/ingerir_rca_204_cassiany.js`, `scripts/ingerir_rca_3_elisabete.js`, `scripts/ingerir_todas_11_filiais_completo.js`, `scripts/pipeline_ingestao_mestre_ceven.js` |
| `fato_skus_comportamento` | `scripts/extrair_detalhes_avancados_cliente.js` |
| `fato_visitas_roteiro` | `scripts/atualizar_elisabete_oficial.js`, `scripts/atualizar_rota_hoje_02set.js`, `scripts/cron_sincronizacao_horaria.js`, `scripts/ingerir_e_exibir_rca_completo.js`, `scripts/ingerir_filial_completa.js`, `scripts/ingerir_rca_204_cassiany.js`, `scripts/ingerir_rca_3_elisabete.js`, `scripts/ingerir_todas_11_filiais_completo.js`, `scripts/pipeline_ingestao_mestre_ceven.js` |
| `metas_premiacao_rv_setembro` | `analises/extrair_premiacao_e_ret_novo_har.py` |
| `metas_ticket_medio_mix` | `analises/extrair_premiacao_e_ret_novo_har.py` |
| `mix_aderencia_regional` | `analises/enriquecer_clientes_rf_e_gerar_mix.js` |
| `mix_gap` | `analises/gerar_dados_mix.js` |
| `mix_gap_real` | `analises/gerar_mix_gap_real.js` |
| `pdvs_roteiro_hoje_gps` | `analises/coletar_todos_os_pdvs_e_prospects_100pct.py` |
| `pedidos_historico` | `analises/extrair_historico_completo_11_filiais.js`, `analises/extrair_historico_vendedores.js`, `analises/extrair_segmentos_rcas.js` |
| `pedidos_historico_itens` | `analises/extrair_historico_completo_11_filiais.js`, `analises/extrair_historico_vendedores.js` |
| `prospects_mapa_radar` | `analises/coletar_todos_os_pdvs_e_prospects_100pct.py` |
| `prospects_receita` | `scripts/gerar_prospects_rca_1022.js` |
| `rca_dashboard_financeiro_live` | `analises/extrair_produtividade_ret_dashboard_todos.py` |
| `rca_kpis` | `scripts/calcular_visitas_vj.py`, `scripts/parsear_kpis_sql.py`, `scripts/sync_d1_producao_horario.js` |
| `rca_kpis_live` | `scripts/sincronizar_ceven_vendedores_online.js` |
| `rca_metas_dashboard` | `analises/extrair_metas_dashboard_rcas.js` |
| `rca_produtividade_live` | `analises/extrair_produtividade_ret_dashboard_todos.py` |
| `rca_ret_execucao_hoje` | `analises/extrair_produtividade_ret_dashboard_todos.py` |
| `rca_segmentos` | `analises/extrair_segmentos_rcas.js` |
| `registro_diario_filial` | `scripts/salvar_dia1_oficial.js` |
| `registro_diario_supervisor` | `scripts/salvar_dia1_oficial.js` |
| `registro_horario_snapshot` | `scripts/disparar_boletim_oficial.js` |
| `representantes` | `scripts/atualizar_area_atuacao_vj_as.js`, `scripts/atualizar_metas_carteira_geral.js`, `scripts/gerar_sql_d1_as.js` |
| `rf_clientes_2026` | `analises/enriquecer_clientes_rf_e_gerar_mix.js` |
| `roteiros_visitas` | `scripts/gerar_abertura_matinal_07h.js`, `scripts/sincronizar_rotas_04_09_real.js`, `scripts/sync_d1_producao_horario.js` |
| `visitas` | `analises/guardar_visitas.js` |
| `winthor_usuarios_vendas` | `analises/extrair_premiacao_e_ret_novo_har.py` |

### 2c. Google Drive (FORA da base única)
- `scripts/gerar_marca_propria.js`: `rclone copy gdrive:pedidos_historico_ceven.db analises/', { cwd: path.join(__dirname, '..'`
- `.github/workflows/analise-sob-demanda.yml`: `rclone copy gdrive:pedidos_historico_ceven.db analises/`; `rclone copy gdrive:mix_gap_hist.db analises/ || echo "sem historico do +MIX ainda"`
- `.github/workflows/brasileirao-dataset.yml`: `rclone copy gdrive:pedidos_historico_ceven.db analises/ || echo "Banco não baixou: Fair Pl`
- `.github/workflows/ceven-cron-datalake.yml`: `rclone copy gdrive:pedidos_historico_ceven.db analises/ || echo "Banco não encontrado no D`; `rclone copy analises/pedidos_historico_ceven.db gdrive:/`
- `.github/workflows/ceven-cron-marca-propria.yml`: `rclone copy gdrive:pedidos_historico_ceven.db analises/`
- `.github/workflows/guardar-visitas.yml`: `rclone copy gdrive:historico_visitas.db analises/ `; `rclone copy analises/historico_visitas.db gdrive:/ `
- `.github/workflows/mix-dataset.yml`: `rclone copy gdrive:pedidos_historico_ceven.db analises/ `; `rclone copy gdrive:mix_gap_hist.db analises/ || echo "histórico do +MIX ainda não existe: `; `rclone copy analises/mix_gap_hist.db gdrive:/; fi `

### 2d. Arquivos JSON gerados para o site
- `analises/gerar_dados_mix.js` (GitHub Actions (workflow)): `dados_mix.json`, `mix_cubo.json`
- `scripts/analisar_discrepancia_visitas.js` (manual): `scripts/discrepancias_visitas_api.json`
- `scripts/analisar_endpoints_har.js` (manual): `scripts/endpoints_har_descobertos.json`
- `scripts/analisar_geral_filial_abc.js` (manual): `analise_geral_abc.json`
- `scripts/analisar_metas_rotas.js` (manual): `scripts/vendedores_fantasmas_filiais.json`
- `scripts/analyze_tbl_rcas.js` (manual): `scripts/tbl_rcas_full_analysis.json`
- `scripts/auditar_compromissos_rets.js` (manual): `scripts/dados_auditoria_compromissos_rets.json`
- `scripts/auditar_cortes_devolucoes_faturado.js` (manual): `auditoria_cortes_devolucoes.json`
- `scripts/auditar_csv_ceven.js` (manual): `scripts/resultado_auditoria.json`
- `scripts/auditar_inativos_tpa_detalhado.js` (manual): `tpa_inativos_audit.json`
- `scripts/auditoria_definitiva_apresentacao.js` (manual): `AUDITORIA_DEFINITIVA_DADOS_APRESENTACAO.json`
- `scripts/buscar_prospects_petshop.js` (manual): `prospects_petshops.json`
- `scripts/calcular_consolidado_grupo_30d.js` (manual): `consolidado_grupo_30d.json`
- `scripts/calcular_efetividade_real_visitas.js` (manual): `efetividade_real_visitas.json`
- `scripts/calcular_efetividade_visitas_filiais.js` (manual): `efetividade_visitas_filiais.json`
- `scripts/calcular_recuperacao_inativos.js` (manual): `recuperacao_inativos_fechamento.json`
- `scripts/calcular_resumo_executivo_30d.js` (manual): `resumo_executivo_30d.json`
- `scripts/calibrar_recuperacao_oficial.js` (manual): `scripts/calibracao_oficial_15h.json`
- `scripts/coletar_abertura_08_09.js` (manual): `scripts/dados_abertura_08_09.json`
- `scripts/coletar_abertura_09_09_filtrado.js` (manual): `scripts/dados_abertura_09_09_filtrado.json`
- `scripts/coletar_clientes_distintos_todos_rcas.js` (manual): `scripts/clientes_distintos_carteira_mes.json`
- `scripts/coletar_consolidado_mes_todas_filiais.js` (manual): `scripts/consolidado_desde_01set_filiais.json`
- `scripts/coletar_detalhes_rets_hoje.js` (manual): `scripts/detalhes_rets_hoje.json`
- `scripts/coletar_fechamento_fat_pos.js` (manual): `scripts/fechamento_18h_fat_pos.json`
- `scripts/coletar_parcial_11h.js` (manual): `scripts/dados_parcial_11h_09_09.json`
- `scripts/coletar_parcial_16h.js` (manual): `scripts/dados_parcial_16h_09_09.json`
- `scripts/conciliar_17h_cv.js` (manual): `scripts/dados_oficiais_17h_cv.json`
- `scripts/consolidar_cockpit_matinal_oficial.js` (manual): `public/dados_cockpit_todas_filiais_completo.json`
- `scripts/consultar_devolucoes_tph_api.js` (manual): `scripts/resultado_devolucoes_tph_api.json`
- `scripts/disparar_11h_gerentes_individual.js` (manual): `scripts/log_disparo_11h_gerentes.json`
- `scripts/disparar_gerentes_individual_abertura.js` (manual): `scripts/log_disparo_gerentes_09_09.json`
- `scripts/disparar_gestao_campo_gerentes.js` (manual): `scripts/log_disparo_campo_gerentes.json`
- `scripts/disparar_teste_gerentes.js` (manual): `scripts/resultado_teste_gerentes.json`
- `scripts/executar_comparativo_17h.js` (manual): `scripts/resultado_ao_vivo_agora.json`
- `scripts/extract_all_11_filiais.js` (manual): `scripts/supervisores_11_filiais_completo.json`
- `scripts/extrair_ret_rodrigo_03.js` (manual): `scripts/ret_rodrigo_farias_03_09.json`
- `scripts/extrair_ret_rodrigo_04.js` (manual): `scripts/ret_rodrigo_farias_04_09.json`
- `scripts/extrair_ret_victor_hugo_08.js` (manual): `scripts/ret_victor_hugo_08_09.json`
- `scripts/extrair_zerados_por_supervisor.js` (manual): `scripts/vendedores_sem_pedido_agrupados.json`
- `scripts/extrator_hibrido_confiavel.js` (manual): `scripts/panorama_hibrido_api_validado.json`
- `scripts/fetch_supervisores_todas_filiais.js` (manual): `scripts/supervisores_todas_filiais.json`
- `scripts/gerar_abertura_por_supervisor_11_filiais.js` (manual): `scripts/dados_abertura_por_supervisor.json`
- `scripts/gerar_dados_reais_json.js` (manual): `public/dados_reais_telemetria.json`
- `scripts/gerar_dados_todas_filiais_cockpit.js` (manual): `public/dados_cockpit_todas_filiais.json`
- `scripts/gerar_dataset_completo_11_filiais.js` (manual): `public/dados_cockpit_todas_filiais_completo.json`
- `scripts/gerar_fechamento_sem_anomalias.js` (manual): `fechamento_executivo_sem_anomalias.json`
- `scripts/gerar_lista_completa_zerados_para_gerentes.js` (manual): `lista_zerados_para_gerentes.json`
- `scripts/gerar_relatorios_campo_filiais.js` (manual): `scripts/relatorios_campo_filiais_11h.json`
- `scripts/gerar_relatorio_api_hoje.js` (manual): `scripts/relatorio_api_hoje.json`
- `scripts/gerar_relatorio_sabado_05_09.js` (manual): `scripts/posicao_hoje_05_09.json`
- `scripts/gerar_varredura_todas_filiais_modelo.js` (manual): `varredura_todas_filiais_modelo.json`
- `scripts/gravar_corte_real_cassiany.js` (manual): `public/dados_cockpit_todas_filiais_completo.json`
- `scripts/preparar_dados_modais.js` (manual): `scripts/dados_modais_painel.json`
- `scripts/processar_filiais_real.js` (manual): `relatorio_real_abc_tcv.json`
- `scripts/processar_todas_filiais_mestre.js` (manual): `relatorio_todas_filiais_real.json`
- `scripts/reprocessar_metas_reais_zerados.js` (manual): `lista_zerados_com_metas_reais.json`
- `scratch/analisar_qualidade.mjs` (manual): `scratch/resumo_auditoria.json`
- `scratch/auditar_hoje_08h.mjs` (manual): `scratch/auditoria_hoje_08h.json`
- `scratch/audita_gols_hoje.js` (manual): `/gols_falsos.json`
- `scratch/cmp_dev.js` (manual): `/dev_ceven.json`
- `scratch/detalhar_perguntas.mjs` (manual): `scratch/auditoria_completa_perguntas.json`
- `scratch/extrair_auditoria.mjs` (manual): `scratch/dialogos_hoje.json`
- `scratch/t_incentivo.mjs` (manual): `/inc_out.json`

## 3. Chamam o CEVEN mas só rodam à mão (155)
`pipeline/1_sync_cadastros_mestre.js`, `pipeline/2_abertura_diaria.js`, `pipeline/3_sync_horario_intraday.js`, `pipeline/github_actions_runner.js`, `scripts/amostrar_cnae_nacional.js`, `scripts/analisar_cadastros_har.js`, `scripts/analisar_endpoints_har.js`, `scripts/analisar_geral_filial_abc.js`, `scripts/analisar_har_ceven.js`, `scripts/analisar_har_gerente.js`, `scripts/analisar_rota_helio.js`, `scripts/analisar_skus_tendencia_dilnei.js`, `scripts/analyze_tbl_rcas.js`, `scripts/atualizar_area_atuacao_vj_as.js`, `scripts/atualizar_elisabete_oficial.js`, `scripts/atualizar_metas_carteira_geral.js`, `scripts/atualizar_rota_hoje_02set.js`, `scripts/auditar_compromissos_rets.js`, `scripts/auditar_cortes_devolucoes_faturado.js`, `scripts/auditar_csv_real.js`, `scripts/auditar_inativos_tpa_detalhado.js`, `scripts/auditar_pedidos_ao_vivo.js`, `scripts/auditar_vendas_hoje.js`, `scripts/buscar_mix_cliente_16684.js`, `scripts/calcular_consolidado_grupo_30d.js`, `scripts/calcular_efetividade_real_visitas.js`, `scripts/calcular_efetividade_visitas_filiais.js`, `scripts/calcular_recuperacao_inativos.js`, `scripts/calcular_resumo_executivo_30d.js`, `scripts/calibrar_recuperacao_oficial.js`, `scripts/checar_status_pedidos_cassiany.js`, `scripts/check_blocked_status.js`, `scripts/check_files_exist.js`, `scripts/check_filiais_supervisores.js`, `scripts/check_gerentes_endpoint.js`, `scripts/check_login_details.js`, `scripts/check_lucianos_metas.js`, `scripts/coletar_abertura_08_09.js`, `scripts/coletar_abertura_09_09_filtrado.js`, `scripts/coletar_clientes_distintos_todos_rcas.js`, `scripts/coletar_consolidado_mes_todas_filiais.js`, `scripts/coletar_detalhes_rets_hoje.js`, `scripts/coletar_fechamento_fat_pos.js`, `scripts/coletar_justificativas_visitas.js`, `scripts/coletar_parcial_11h.js`, `scripts/coletar_parcial_16h.js`, `scripts/consultar_devolucoes_tph_api.js`, `scripts/consultar_filiais_oficiais.js`, `scripts/consultar_pdvs_ceven_online.js`, `scripts/consultar_rota_tamara_cnaes.js`, `scripts/cron_sincronizacao_horaria.js`, `scripts/daemon_agendador_whatsapp.js`, `scripts/daemon_disparo_17h.js`, `scripts/daemon_disparo_18h.js`, `scripts/daemon_fechamento_19h_20h.js`, `scripts/daemon_fechamento_oficial.js`, `scripts/disparar_18h_imediato.js`, `scripts/disparar_boletim_oficial.js`, `scripts/disparar_parcial_almoco_todas_filiais.js`, `scripts/estudo_mix_completo.py`, `scripts/executar_comparativo_17h.js`, `scripts/executar_fechamento_11h.js`, `scripts/executar_fechamento_otimizado.js`, `scripts/exibir_dados_mapa.js`, `scripts/extract_all_11_filiais.js`, `scripts/extrair_cortes_abc_paralelo.js`, `scripts/extrair_cortes_reais_abc_hoje.js`, `scripts/extrair_detalhes_avancados_cliente.js`, `scripts/extrair_rca_har.js`, `scripts/extrair_ret_rodrigo_03.js`, `scripts/extrair_ret_rodrigo_04.js`, `scripts/extrair_ret_victor_hugo_08.js`, `scripts/extrair_visitados_sem_venda_mes.js`, `scripts/extrair_zerados_por_supervisor.js`, `scripts/fetch_supervisores_todas_filiais.js`, `scripts/find_auth_in_har.js`, `scripts/gerar_abertura_matinal_07h.js`, `scripts/gerar_abertura_por_supervisor_11_filiais.js`, `scripts/gerar_auditoria_roteiro_inativos_11set.js`, `scripts/gerar_cockpit_matinal_real.js`, `scripts/gerar_fechamento_ao_vivo_11h.js`, `scripts/gerar_fechamento_sem_anomalias.js`, `scripts/gerar_lista_completa_zerados_para_gerentes.js`, `scripts/gerar_prospects_rca_1022.js`, `scripts/gerar_relatorios_campo_filiais.js`, `scripts/gerar_relatorio_ao_vivo_14h.js`, `scripts/gerar_relatorio_sabado_05_09.js`, `scripts/gerar_varredura_todas_filiais_modelo.js`, `scripts/identificar_vendedores_primeiras_vendas.js`, `scripts/ingerir_e_exibir_rca_completo.js`, `scripts/ingerir_filial_completa.js`, `scripts/ingerir_rca_204_cassiany.js`, `scripts/ingerir_rca_3_elisabete.js`, `scripts/ingerir_todas_11_filiais_completo.js`, `scripts/inspecionar_abc_hoje.js`, `scripts/inspecionar_dashboard_har.js`, `scripts/inspecionar_dashboard_mapa.js`, `scripts/inspecionar_json_cliente.js`, `scripts/inspecionar_mixapi_har.js`, `scripts/inspecionar_tela_mes.js`, `scripts/inspect_all_sources.js`, `scripts/inspect_andre_25.js`, `scripts/inspect_cascata.js`, `scripts/inspect_first_entries.js`, `scripts/inspect_frontend_login.js`, `scripts/inspect_gerente_har.js`, `scripts/inspect_gerente_headers.js`, `scripts/inspect_js_bundle.js`, `scripts/inspect_tbl_roles.js`, `scripts/inspect_views.js`, `scripts/inspect_vinicius_1075.js`, `scripts/investigar_pedidos_cassiany.js`, `scripts/list_har_texts.js`, `scripts/mapa_dados.mjs`, `scripts/parse_bundle.js`, `scripts/pipeline_ingestao_mestre_ceven.js`, `scripts/popular_cadastros_novos_clientes.js`, `scripts/popular_varredura_manual.mjs`, `scripts/processar_filiais_real.js`, `scripts/processar_todas_filiais_mestre.js`, `scripts/prototipo_marca_propria.js`, `scripts/rastrear_todos_cortes_abc_01set.js`, `scripts/reprocessar_metas_reais_zerados.js`, `scripts/sincronizar_13h15.js`, `scripts/sincronizar_carteira_mes.js`, `scripts/sincronizar_ceven_vendedores_online.js`, `scripts/sincronizar_disparar_16h.js`, `scripts/sincronizar_filiais_faltantes.js`, `scripts/sincronizar_real_12h.js`, `scripts/sincronizar_rotas_04_09_real.js`, `scripts/sync_d1_producao_horario.js`, `scripts/sync_prospects_tsj.js`, `scripts/testar_filial_tsj_param.js`, `scripts/testar_mix_gap_real.js`, `scripts/test_admin_rets_compromissos.js`, `scripts/test_all_on_tbl.js`, `scripts/test_bearer_supervisores.js`, `scripts/test_distinct_clients.js`, `scripts/test_reginaldo_195.js`, `scripts/test_tbl_extended.js`, `scripts/test_tbl_login.js`, `scripts/test_tbl_passwords.js`, `scripts/top_vendedores_hoje.js`, `scripts/varrer_carteira_completa_cortes_abc.js`, `scratch/audita_gols_hoje.js`, `scratch/cascata_tpa.js`, `scratch/cmp_dev.js`, `scratch/confere_arvore.js`, `scratch/patch_arvore2.js`, `scratch/patch_canal_ceven.js`, `scratch/patch_canal_ocultos_super.js`, `scratch/patch_motor.js`, `scratch/patch_sup_ui.js`, `scratch/so_gestao.js`, `scratch/valida_base.js`
