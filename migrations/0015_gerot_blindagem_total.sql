-- =========================================================================
-- MIGRACAO 0015: GEROT Blindagem Total (Sprints 1.1, 1.2 e 1.3)
-- 16 tabelas + indices compostos para cobrir 43/43 telas e 79/79 calculos
-- =========================================================================

CREATE TABLE IF NOT EXISTS gerot_dim_agregado (
  mes TEXT NOT NULL,
  dim TEXT NOT NULL,
  filial TEXT NOT NULL DEFAULT '',
  chave TEXT NOT NULL,
  nome TEXT,
  dados TEXT NOT NULL,
  hash TEXT,
  em TEXT,
  PRIMARY KEY (mes, dim, filial, chave)
);
CREATE INDEX IF NOT EXISTS idx_gerot_dim_ag_lookup ON gerot_dim_agregado (mes, dim, filial);

CREATE TABLE IF NOT EXISTS gerot_cliven_resumo (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  cod_sup TEXT NOT NULL DEFAULT '',
  rca TEXT NOT NULL,
  vendedor TEXT,
  supervisor TEXT,
  gerente TEXT,
  perfil TEXT,
  clientes_carteira INTEGER,
  clientes_ativos INTEGER,
  clientes_bloq INTEGER,
  positivados INTEGER,
  aproveitamento_pct REAL,
  fat_mes REAL,
  m1 REAL,
  media_3m REAL,
  em TEXT,
  PRIMARY KEY (mes, filial, cod_sup, rca)
);
CREATE INDEX IF NOT EXISTS idx_gerot_cliven_fil_rca ON gerot_cliven_resumo (mes, filial, rca);

CREATE TABLE IF NOT EXISTS gerot_fefo (
  filial TEXT NOT NULL,
  sku TEXT NOT NULL,
  lote TEXT NOT NULL DEFAULT '',
  produto TEXT,
  fornecedor TEXT,
  depto TEXT,
  secao TEXT,
  marca TEXT,
  faixa TEXT,
  validade TEXT,
  dias_vencer INTEGER,
  pct_vida REAL,
  saldo REAL,
  valor REAL,
  venda_90d REAL,
  cobertura_dias REAL,
  risco INTEGER DEFAULT 0,
  quarentena INTEGER DEFAULT 0,
  acao_sugerida TEXT,
  prox_faixa_30 TEXT,
  prox_faixa_60 TEXT,
  prox_faixa_90 TEXT,
  carga TEXT,
  em TEXT,
  PRIMARY KEY (filial, sku, lote)
);
CREATE INDEX IF NOT EXISTS idx_gerot_fefo_fil_faixa ON gerot_fefo (filial, faixa, valor);
CREATE INDEX IF NOT EXISTS idx_gerot_fefo_forn ON gerot_fefo (fornecedor, faixa);

CREATE TABLE IF NOT EXISTS gerot_est_winthor (
  filial TEXT NOT NULL,
  sku TEXT NOT NULL,
  produto TEXT,
  fornecedor TEXT,
  depto TEXT,
  secao TEXT,
  dias_estoque REAL,
  valor REAL,
  caixas REAL,
  peso_kg REAL,
  disponivel REAL,
  estoque REAL,
  reservado REAL,
  bloqueado REAL,
  parado_90d INTEGER DEFAULT 0,
  ruptura INTEGER DEFAULT 0,
  curva_abc TEXT,
  carga TEXT,
  em TEXT,
  PRIMARY KEY (filial, sku)
);
CREATE INDEX IF NOT EXISTS idx_gerot_estwin_fil_abc ON gerot_est_winthor (filial, curva_abc);
CREATE INDEX IF NOT EXISTS idx_gerot_estwin_forn ON gerot_est_winthor (fornecedor);

CREATE TABLE IF NOT EXISTS gerot_dre_mes (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  nivel TEXT NOT NULL,
  cod TEXT NOT NULL,
  nome TEXT,
  caixas REAL,
  peso_kg REAL,
  fat_bruto REAL,
  devolucao REAL,
  receita_liq REAL,
  cmv REAL,
  comissao REAL,
  bonif_custo REAL,
  impostos REAL,
  custos_var REAL,
  mc_rs REAL,
  mc_pct REAL,
  desconto_rs REAL,
  desc_pct REAL,
  preco_tabela REAL,
  desc_politica REAL,
  desc_campanha REAL,
  desc_pol_encerrada REAL,
  desc_comercial REAL,
  acima_tabela REAL,
  em TEXT,
  PRIMARY KEY (mes, filial, nivel, cod)
);
CREATE INDEX IF NOT EXISTS idx_gerot_dre_mes_niv ON gerot_dre_mes (mes, nivel, filial);

CREATE TABLE IF NOT EXISTS gerot_curva_neg_margem (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  pedido TEXT NOT NULL,
  nf TEXT NOT NULL DEFAULT '',
  data TEXT,
  rca TEXT,
  vendedor TEXT,
  sup_cod TEXT,
  cliente TEXT,
  cnpj TEXT,
  itens INTEGER,
  fat_bruto REAL,
  desconto_pct REAL,
  custo REAL,
  margem_rs REAL,
  margem_pct REAL,
  margem_perdida REAL,
  em TEXT,
  PRIMARY KEY (mes, filial, pedido, nf)
);
CREATE INDEX IF NOT EXISTS idx_gerot_cnm_fil_rca ON gerot_curva_neg_margem (mes, filial, rca);
CREATE INDEX IF NOT EXISTS idx_gerot_cnm_fil_mg ON gerot_curva_neg_margem (mes, filial, margem_rs);

CREATE TABLE IF NOT EXISTS gerot_histograma_margem (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  tipo TEXT NOT NULL,
  faixa TEXT NOT NULL,
  itens INTEGER,
  fat_bruto REAL,
  margem_rs REAL,
  margem_pct REAL,
  em TEXT,
  PRIMARY KEY (mes, filial, tipo, faixa)
);

CREATE TABLE IF NOT EXISTS gerot_rfv_resumo (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  sup_cod TEXT NOT NULL DEFAULT '',
  rca TEXT NOT NULL DEFAULT '',
  segmento TEXT NOT NULL,
  clientes INTEGER,
  valor_120d REAL,
  em TEXT,
  PRIMARY KEY (mes, filial, sup_cod, rca, segmento)
);
CREATE INDEX IF NOT EXISTS idx_gerot_rfv_res_seg ON gerot_rfv_resumo (mes, filial, segmento);

CREATE TABLE IF NOT EXISTS gerot_rfv_clientes (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  sup_cod TEXT,
  cliente TEXT NOT NULL,
  cnpj TEXT,
  nome TEXT,
  segmento TEXT,
  r_score INTEGER,
  f_score INTEGER,
  v_score INTEGER,
  dias_sem_compra INTEGER,
  valor_120d REAL,
  ultima_compra TEXT,
  em TEXT,
  PRIMARY KEY (mes, filial, rca, cliente)
);
CREATE INDEX IF NOT EXISTS idx_gerot_rfv_cli_seg ON gerot_rfv_clientes (mes, filial, segmento, valor_120d);
CREATE INDEX IF NOT EXISTS idx_gerot_rfv_cli_rca ON gerot_rfv_clientes (mes, filial, rca, segmento);

CREATE TABLE IF NOT EXISTS gerot_pmi_mes (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  nivel TEXT NOT NULL,
  cod TEXT NOT NULL,
  nome TEXT,
  ja_compra REAL,
  pmi_historico REAL,
  pmi_mix REAL,
  reativar REAL,
  recuperar REAL,
  aumentar_mix REAL,
  desenvolver_share REAL,
  abrir_novos REAL,
  potencial_total REAL,
  clientes_ativos INTEGER,
  em TEXT,
  PRIMARY KEY (mes, filial, nivel, cod)
);
CREATE INDEX IF NOT EXISTS idx_gerot_pmi_niv ON gerot_pmi_mes (mes, nivel, filial);

CREATE TABLE IF NOT EXISTS gerot_cadastro_clientes (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  sup_cod TEXT NOT NULL DEFAULT '',
  rca TEXT NOT NULL DEFAULT '',
  cadastrados INTEGER,
  cadastrados_dia INTEGER,
  ja_compraram INTEGER,
  pct_primeira_compra REAL,
  bloqueados INTEGER,
  excluidos INTEGER,
  saldo INTEGER,
  em TEXT,
  PRIMARY KEY (mes, filial, sup_cod, rca)
);
CREATE INDEX IF NOT EXISTS idx_gerot_cad_fil ON gerot_cadastro_clientes (mes, filial);

CREATE TABLE IF NOT EXISTS gerot_recorrencia_faixas (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  sup_cod TEXT NOT NULL DEFAULT '',
  rca TEXT NOT NULL DEFAULT '',
  faixa TEXT NOT NULL,
  clientes INTEGER,
  valor_3m REAL,
  em TEXT,
  PRIMARY KEY (mes, filial, sup_cod, rca, faixa)
);
CREATE INDEX IF NOT EXISTS idx_gerot_recfx_fil ON gerot_recorrencia_faixas (mes, filial, faixa);

CREATE TABLE IF NOT EXISTS gerot_recorrencia_clientes (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  cliente TEXT NOT NULL,
  cnpj TEXT,
  nome TEXT,
  dias_sem_compra INTEGER,
  ultima_compra TEXT,
  fat_mes REAL,
  captado REAL,
  carteira REAL,
  faixa TEXT,
  em TEXT,
  PRIMARY KEY (mes, filial, rca, cliente)
);
CREATE INDEX IF NOT EXISTS idx_gerot_reccli_rca ON gerot_recorrencia_clientes (mes, filial, rca, dias_sem_compra);

CREATE TABLE IF NOT EXISTS gerot_campo_mes (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  nivel TEXT NOT NULL,
  cod TEXT NOT NULL,
  nome TEXT,
  sup_cod TEXT NOT NULL DEFAULT '',
  eficiencia_pct REAL,
  eficacia_pct REAL,
  hora_checkin TEXT,
  hora_checkout TEXT,
  min_visita REAL,
  min_rota REAL,
  hora_ped1 TEXT,
  pct_ped18 REAL,
  venda_captada REAL,
  pedidos_captados INTEGER,
  venda_sem_visita REAL,
  pct_sem_visita REAL,
  cobertura_pdv_pct REAL,
  carteira_visitada_pct REAL,
  gerado_em TEXT,
  em TEXT,
  PRIMARY KEY (mes, filial, nivel, cod, sup_cod)
);
CREATE INDEX IF NOT EXISTS idx_gerot_campo_niv ON gerot_campo_mes (mes, nivel, filial);

CREATE TABLE IF NOT EXISTS gerot_jbp_sku (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  fornecedor TEXT,
  forn_cod TEXT,
  sku TEXT NOT NULL,
  produto TEXT,
  fat_liq REAL,
  meta REAL,
  fat_m1 REAL,
  delta_m1 REAL,
  fat_3m REAL,
  fat_a1 REAL,
  fat_ytd REAL,
  fat_lytd REAL,
  pos INTEGER,
  bench REAL,
  em TEXT,
  PRIMARY KEY (mes, filial, sku)
);
CREATE INDEX IF NOT EXISTS idx_gerot_jbp_forn ON gerot_jbp_sku (mes, filial, fornecedor);
CREATE INDEX IF NOT EXISTS idx_gerot_jbp_delta ON gerot_jbp_sku (mes, filial, delta_m1);

CREATE TABLE IF NOT EXISTS fatos_briefing_cache (
  chave TEXT PRIMARY KEY,
  mes TEXT NOT NULL,
  carga_id TEXT NOT NULL,
  nivel TEXT NOT NULL,
  filial TEXT,
  payload_json TEXT NOT NULL,
  tokens_est INTEGER,
  gerado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fatos_brief_mes ON fatos_briefing_cache (mes, nivel, filial);
