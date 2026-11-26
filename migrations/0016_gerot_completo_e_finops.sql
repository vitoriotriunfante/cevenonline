-- =========================================================================
-- MIGRACAO 0016: GEROT 100% + FinOps Delta-by-Hash + Colunas Promovidas
-- =========================================================================

-- 1) Cliven 100% normalizado (cadastro de clientes + fatos Vendedor x Cliente x Fornecedor)
CREATE TABLE IF NOT EXISTS gerot_cliven_clientes (
  filial TEXT NOT NULL,
  cliente TEXT NOT NULL,
  cnpj TEXT,
  nome TEXT,
  cep TEXT,
  rede TEXT,
  uf TEXT,
  municipio TEXT,
  tipologia TEXT,
  status TEXT,
  motivo_bloqueio TEXT,
  hash TEXT,
  em TEXT,
  PRIMARY KEY (filial, cliente)
);
CREATE INDEX IF NOT EXISTS idx_gerot_clvcli_cnpj ON gerot_cliven_clientes (filial, cnpj);
CREATE INDEX IF NOT EXISTS idx_gerot_clvcli_rede ON gerot_cliven_clientes (filial, rede);

CREATE TABLE IF NOT EXISTS gerot_cliven_carteira (
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  rca_int INTEGER,
  cod_sup TEXT NOT NULL DEFAULT '',
  perfil TEXT,
  cliente TEXT NOT NULL,
  forn_cod TEXT NOT NULL,
  positivado INTEGER DEFAULT 0,
  fat_mes REAL,
  m1 REAL,
  media_3m REAL,
  ult_fat TEXT,
  hash TEXT,
  em TEXT,
  PRIMARY KEY (mes, filial, rca, cliente, forn_cod)
);
CREATE INDEX IF NOT EXISTS idx_gerot_clvcart_fil_rca ON gerot_cliven_carteira (mes, filial, rca_int);
CREATE INDEX IF NOT EXISTS idx_gerot_clvcart_forn ON gerot_cliven_carteira (mes, filial, forn_cod);
CREATE INDEX IF NOT EXISTS idx_gerot_clvcart_cli ON gerot_cliven_carteira (mes, filial, cliente);

-- 2) Desvio Mes (3/43) e Batalha Naval / Carrinho Ideal (1/43)
CREATE TABLE IF NOT EXISTS gerot_desvio_mes (
  mes TEXT NOT NULL,
  nivel TEXT NOT NULL,
  filial TEXT NOT NULL DEFAULT '',
  pai TEXT NOT NULL DEFAULT '',
  cod TEXT NOT NULL,
  nome TEXT,
  fat_liq REAL,
  meta REAL,
  delta_meta REAL,
  pct_meta REAL,
  peso_desvio REAL,
  hash TEXT,
  em TEXT,
  PRIMARY KEY (mes, nivel, filial, pai, cod)
);
CREATE INDEX IF NOT EXISTS idx_gerot_desvio_lookup ON gerot_desvio_mes (mes, nivel, filial);

CREATE TABLE IF NOT EXISTS gerot_batalha_carrinho (
  mes TEXT NOT NULL,
  tipo TEXT NOT NULL,
  filial TEXT NOT NULL,
  cod TEXT NOT NULL,
  nome TEXT,
  subcod TEXT NOT NULL DEFAULT '',
  subnome TEXT,
  valor REAL,
  meta REAL,
  gap REAL,
  itens INTEGER,
  dados TEXT,
  hash TEXT,
  em TEXT,
  PRIMARY KEY (mes, tipo, filial, cod, subcod)
);
CREATE INDEX IF NOT EXISTS idx_gerot_batcar_lookup ON gerot_batalha_carrinho (mes, tipo, filial);

-- 3) Colunas hash para Delta-by-Hash FinOps (Tier 2 / Tier 3 sem wipe)
ALTER TABLE gerot_fefo ADD COLUMN hash TEXT;
ALTER TABLE gerot_est_winthor ADD COLUMN hash TEXT;
ALTER TABLE gerot_rfv_clientes ADD COLUMN hash TEXT;
ALTER TABLE gerot_recorrencia_clientes ADD COLUMN hash TEXT;
ALTER TABLE gerot_jbp_sku ADD COLUMN hash TEXT;
ALTER TABLE gerot_curva_neg_margem ADD COLUMN hash TEXT;

-- 4) Colunas numericas promovidas + rca_int nas tabelas centrais GEROT
ALTER TABLE gerot_filial_mes ADD COLUMN fat_liq REAL;
ALTER TABLE gerot_filial_mes ADD COLUMN meta REAL;
ALTER TABLE gerot_filial_mes ADD COLUMN carteira REAL;
ALTER TABLE gerot_filial_mes ADD COLUMN captacao REAL;
ALTER TABLE gerot_filial_mes ADD COLUMN pos INTEGER;
ALTER TABLE gerot_filial_mes ADD COLUMN meta_pos INTEGER;
ALTER TABLE gerot_filial_mes ADD COLUMN mc_rs REAL;
ALTER TABLE gerot_filial_mes ADD COLUMN mc_pct REAL;
ALTER TABLE gerot_filial_mes ADD COLUMN cortes_rs REAL;
ALTER TABLE gerot_filial_mes ADD COLUMN tmf_dias REAL;

ALTER TABLE gerot_supervisor_mes ADD COLUMN fat_liq REAL;
ALTER TABLE gerot_supervisor_mes ADD COLUMN meta REAL;
ALTER TABLE gerot_supervisor_mes ADD COLUMN carteira REAL;
ALTER TABLE gerot_supervisor_mes ADD COLUMN captacao REAL;
ALTER TABLE gerot_supervisor_mes ADD COLUMN pos INTEGER;
ALTER TABLE gerot_supervisor_mes ADD COLUMN meta_pos INTEGER;
ALTER TABLE gerot_supervisor_mes ADD COLUMN mc_rs REAL;
ALTER TABLE gerot_supervisor_mes ADD COLUMN mc_pct REAL;
ALTER TABLE gerot_supervisor_mes ADD COLUMN cortes_rs REAL;

ALTER TABLE gerot_vendedor_mes ADD COLUMN rca_int INTEGER;
ALTER TABLE gerot_vendedor_mes ADD COLUMN fat_liq REAL;
ALTER TABLE gerot_vendedor_mes ADD COLUMN meta REAL;
ALTER TABLE gerot_vendedor_mes ADD COLUMN carteira REAL;
ALTER TABLE gerot_vendedor_mes ADD COLUMN captacao REAL;
ALTER TABLE gerot_vendedor_mes ADD COLUMN pos INTEGER;
ALTER TABLE gerot_vendedor_mes ADD COLUMN meta_pos INTEGER;
ALTER TABLE gerot_vendedor_mes ADD COLUMN mc_rs REAL;
ALTER TABLE gerot_vendedor_mes ADD COLUMN mc_pct REAL;
ALTER TABLE gerot_vendedor_mes ADD COLUMN cortes_rs REAL;

ALTER TABLE gerot_vendas ADD COLUMN rca_int INTEGER;
ALTER TABLE gerot_vendas ADD COLUMN fat_liq REAL;
ALTER TABLE gerot_vendas ADD COLUMN meta REAL;
ALTER TABLE gerot_vendas ADD COLUMN carteira REAL;
ALTER TABLE gerot_vendas ADD COLUMN captacao REAL;
ALTER TABLE gerot_vendas ADD COLUMN pos INTEGER;
ALTER TABLE gerot_vendas ADD COLUMN meta_pos INTEGER;
ALTER TABLE gerot_vendas ADD COLUMN mc_rs REAL;
ALTER TABLE gerot_vendas ADD COLUMN mc_pct REAL;
ALTER TABLE gerot_vendas ADD COLUMN cortes_rs REAL;

ALTER TABLE gerot_cliente_mes ADD COLUMN rca_int INTEGER;
ALTER TABLE gerot_cliente_mes ADD COLUMN fat_liq REAL;
ALTER TABLE gerot_cliente_mes ADD COLUMN carteira REAL;
ALTER TABLE gerot_cliente_mes ADD COLUMN pos INTEGER;

ALTER TABLE gerot_carteira ADD COLUMN rca_int INTEGER;
ALTER TABLE gerot_pedido ADD COLUMN rca_int INTEGER;

-- 5) Indices compostos por rca_int
CREATE INDEX IF NOT EXISTS idx_gerot_vend_mes_rcaint ON gerot_vendedor_mes (mes, filial, rca_int);
CREATE INDEX IF NOT EXISTS idx_gerot_vendas_mes_rcaint ON gerot_vendas (mes, filial, rca_int);
CREATE INDEX IF NOT EXISTS idx_gerot_cli_mes_rcaint ON gerot_cliente_mes (mes, filial, rca_int);
CREATE INDEX IF NOT EXISTS idx_gerot_cart_fil_rcaint ON gerot_carteira (filial, rca_int);
CREATE INDEX IF NOT EXISTS idx_gerot_ped_fil_rcaint ON gerot_pedido (filial, rca_int, data);
