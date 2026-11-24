-- =========================================================================
-- MIGRACAO 0014: Blindagem do GEROT — controle de carga + 15 indices compostos
-- =========================================================================

CREATE TABLE IF NOT EXISTS gerot_carga_controle (
  lote_id TEXT NOT NULL,
  mes TEXT NOT NULL,
  etapa TEXT NOT NULL,
  status TEXT NOT NULL,
  filiais INTEGER NOT NULL DEFAULT 0,
  linhas INTEGER NOT NULL DEFAULT 0,
  gravadas INTEGER NOT NULL DEFAULT 0,
  removidas INTEGER NOT NULL DEFAULT 0,
  posicao TEXT,
  detalhe TEXT,
  iniciado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  PRIMARY KEY (lote_id, mes, etapa)
);

CREATE INDEX IF NOT EXISTS idx_gerot_carga_ctrl_mes_em ON gerot_carga_controle (mes, etapa, atualizado_em);
CREATE INDEX IF NOT EXISTS idx_gerot_vend_mes_sup ON gerot_vendedor_mes (mes, filial, cod_sup);
CREATE INDEX IF NOT EXISTS idx_gerot_vend_rca_mes ON gerot_vendedor_mes (filial, rca, mes);
CREATE INDEX IF NOT EXISTS idx_gerot_vendas_fil_rca ON gerot_vendas (mes, filial, rca);
CREATE INDEX IF NOT EXISTS idx_gerot_vendas_sup ON gerot_vendas (mes, filial, cod_sup);
CREATE INDEX IF NOT EXISTS idx_gerot_sup_mes_cod ON gerot_supervisor_mes (mes, cod_sup, filial);
CREATE INDEX IF NOT EXISTS idx_gerot_filial_dia_mes ON gerot_filial_dia (mes, filial, data);
CREATE INDEX IF NOT EXISTS idx_gerot_cli_cnpj ON gerot_cliente_mes (mes, filial, cnpj);
CREATE INDEX IF NOT EXISTS idx_gerot_cli_rca_mes ON gerot_cliente_mes (filial, rca, mes);
CREATE INDEX IF NOT EXISTS idx_gerot_clif_forn ON gerot_cliente_forn_mes (mes, filial, forn_cod, rca);
CREATE INDEX IF NOT EXISTS idx_gerot_pedido_mes_data ON gerot_pedido (mes, data, filial, rca);
CREATE INDEX IF NOT EXISTS idx_gerot_pedido_cnpj ON gerot_pedido (mes, filial, cnpj, data);
CREATE INDEX IF NOT EXISTS idx_gerot_carteira_sup ON gerot_carteira (filial, sup_cod, status);
CREATE INDEX IF NOT EXISTS idx_gerot_carteira_cnpj ON gerot_carteira (filial, cnpj, entrada);
CREATE INDEX IF NOT EXISTS idx_gerot_dev_vend_mes_rca ON gerot_devolucao_motivo_vend (mes, filial, rca);
CREATE INDEX IF NOT EXISTS idx_gerot_coleta_mes_em ON gerot_coleta_status (mes, em);
