-- =========================================================================
-- MIGRACAO 0017: CLUBE DA VENDA 100% (Parte 2 — Schema Completo + Indices)
-- 100% aditiva (ZERO DROP TABLE). Substitui todo DDL em runtime de clube-carga.js.
-- =========================================================================

-- 1) Tabelas base ja existentes (idempotente) + indices
CREATE TABLE IF NOT EXISTS clube_venda_dia (
  dia TEXT NOT NULL,
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  sup_cod TEXT,
  nome TEXT,
  total_pedido REAL,
  total_faturado REAL,
  roteiros REAL,
  visitas_rota REAL,
  ped_rota REAL,
  ped_fora REAL,
  ped_total REAL,
  media_sku REAL,
  eficiencia REAL,
  eficacia REAL,
  lido_em TEXT,
  mudou_em TEXT,
  PRIMARY KEY (dia, filial, rca)
);
CREATE INDEX IF NOT EXISTS idx_clube_venda_dia_fil_sup ON clube_venda_dia (dia, filial, sup_cod);

CREATE TABLE IF NOT EXISTS clube_coleta_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dia TEXT,
  lido_em TEXT,
  vendedores INTEGER,
  falhas TEXT,
  duracao_s INTEGER
);

CREATE TABLE IF NOT EXISTS clube_checkin (
  codigo TEXT,
  dia TEXT,
  filial TEXT,
  rca TEXT,
  nome TEXT,
  tipo TEXT,
  data_hora TEXT,
  cliente TEXT,
  cnpj TEXT,
  razao TEXT,
  fantasia TEXT,
  PRIMARY KEY (codigo, rca, tipo, data_hora)
);
CREATE INDEX IF NOT EXISTS idx_clube_checkin_dia ON clube_checkin (dia, filial, rca);

CREATE TABLE IF NOT EXISTS clube_justificativa (
  id TEXT PRIMARY KEY,
  dia TEXT,
  filial TEXT,
  sup_cod TEXT,
  rca TEXT,
  nome TEXT,
  cliente TEXT,
  cnpj TEXT,
  razao TEXT,
  fantasia TEXT,
  dias_sem_comprar REAL,
  motivo TEXT,
  data_hora TEXT,
  obs TEXT
);
CREATE INDEX IF NOT EXISTS idx_clube_just_dia ON clube_justificativa (dia, filial, rca);

CREATE TABLE IF NOT EXISTS clube_pedido (
  filial TEXT NOT NULL,
  pedido TEXT NOT NULL,
  dia TEXT,
  rca TEXT,
  id TEXT,
  pedido_winthor TEXT,
  cliente TEXT,
  razao TEXT,
  total REAL,
  confirmado TEXT,
  sincronizado TEXT,
  origem TEXT,
  tipo_bloqueio TEXT,
  data_inicial TEXT,
  data_emissao TEXT,
  data_recebimento TEXT,
  data_liberacao TEXT,
  hash TEXT,
  lido_em TEXT,
  PRIMARY KEY (filial, pedido)
);
CREATE INDEX IF NOT EXISTS ix_clube_pedido_dia ON clube_pedido (dia, filial, rca, cliente);
CREATE INDEX IF NOT EXISTS ix_clube_pedido_winthor ON clube_pedido (pedido_winthor);

-- 29 colunas no Excel de relatorioPedido.xhtml (14 colunas novas)
ALTER TABLE clube_pedido ADD COLUMN atividade_comercial TEXT;
ALTER TABLE clube_pedido ADD COLUMN movimento TEXT;
ALTER TABLE clube_pedido ADD COLUMN operacao TEXT;
ALTER TABLE clube_pedido ADD COLUMN portador TEXT;
ALTER TABLE clube_pedido ADD COLUMN prazo_1 TEXT;
ALTER TABLE clube_pedido ADD COLUMN prazo_2 TEXT;
ALTER TABLE clube_pedido ADD COLUMN prazo_3 TEXT;
ALTER TABLE clube_pedido ADD COLUMN prazo_4 TEXT;
ALTER TABLE clube_pedido ADD COLUMN prazo_5 TEXT;
ALTER TABLE clube_pedido ADD COLUMN total_desconto REAL;
ALTER TABLE clube_pedido ADD COLUMN saldo_dm REAL;
ALTER TABLE clube_pedido ADD COLUMN excluido TEXT;
ALTER TABLE clube_pedido ADD COLUMN telefone TEXT;
ALTER TABLE clube_pedido ADD COLUMN codigo_integracao TEXT;

CREATE TABLE IF NOT EXISTS clube_roteiro (
  dia TEXT NOT NULL,
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  cliente TEXT NOT NULL,
  nome TEXT,
  cnpj TEXT,
  razao TEXT,
  fantasia TEXT,
  cidade TEXT,
  bairro TEXT,
  endereco TEXT,
  recorrencia TEXT,
  dia_semana TEXT,
  hash TEXT,
  lido_em TEXT,
  PRIMARY KEY (dia, filial, rca, cliente)
);
CREATE INDEX IF NOT EXISTS ix_clube_roteiro_cli ON clube_roteiro (dia, filial, cliente);

CREATE TABLE IF NOT EXISTS clube_roteiro_leitura (
  dia TEXT PRIMARY KEY,
  filiais INTEGER,
  linhas INTEGER,
  lido_em TEXT
);

CREATE TABLE IF NOT EXISTS clube_rodada (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dia TEXT,
  lido_em TEXT,
  vendedores INTEGER,
  checkins INTEGER,
  justificativas INTEGER,
  nao_sinc INTEGER,
  falhas TEXT,
  duracao_s INTEGER
);
ALTER TABLE clube_rodada ADD COLUMN gate_json TEXT;

-- 2) TIER 1 NOVO: Fornecedores ao vivo no dia + Acompanhamento Diário (CSV)
CREATE TABLE IF NOT EXISTS clube_fornecedor_dia (
  dia TEXT NOT NULL,
  filial TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  venda REAL,
  pct_venda REAL,
  positivacao INTEGER,
  pct_positivacao REAL,
  skus INTEGER,
  skus_total INTEGER,
  skus_vendidos INTEGER,
  filiais_lista TEXT,
  hash TEXT,
  lido_em TEXT,
  PRIMARY KEY (dia, filial, fornecedor)
);
CREATE INDEX IF NOT EXISTS idx_clube_forn_dia ON clube_fornecedor_dia (dia, fornecedor);

CREATE TABLE IF NOT EXISTS clube_acompanhamento_dia (
  dia TEXT NOT NULL,
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  sup_cod TEXT,
  sup_nome TEXT,
  nome TEXT,
  carteira INTEGER,
  objetivo_visitas INTEGER,
  visitas INTEGER,
  pedidos_venda INTEGER,
  pedidos_rota INTEGER,
  pedidos_fora INTEGER,
  total_pedidos INTEGER,
  nao_visita INTEGER,
  nao_venda INTEGER,
  primeiro_pedido TEXT,
  ultimo_pedido TEXT,
  valor REAL,
  eficiencia REAL,
  eficacia REAL,
  hash TEXT,
  lido_em TEXT,
  PRIMARY KEY (dia, filial, rca)
);
CREATE INDEX IF NOT EXISTS idx_clube_acomp_sup ON clube_acompanhamento_dia (dia, filial, sup_cod);

-- 3) TIER 2 (Campo, Combos & Antifraude)
CREATE TABLE IF NOT EXISTS clube_atendimento_dia (
  dia TEXT NOT NULL,
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  sup_cod TEXT,
  nome TEXT,
  total_pedido REAL,
  total_troca REAL,
  roteiro INTEGER,
  visitas_rota INTEGER,
  rendimento REAL,
  inicio_rota TEXT,
  termino_rota TEXT,
  tempo_ocioso TEXT,
  hash TEXT,
  lido_em TEXT,
  PRIMARY KEY (dia, filial, rca)
);
CREATE INDEX IF NOT EXISTS idx_clube_atend_dia ON clube_atendimento_dia (dia, filial);

CREATE TABLE IF NOT EXISTS clube_km_dia (
  dia TEXT NOT NULL,
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  sup_cod TEXT,
  nome TEXT,
  km_programado REAL,
  km_percorrido REAL,
  km_diferenca REAL,
  hash TEXT,
  lido_em TEXT,
  PRIMARY KEY (dia, filial, rca)
);
CREATE INDEX IF NOT EXISTS idx_clube_km_dia ON clube_km_dia (dia, filial);

CREATE TABLE IF NOT EXISTS clube_combo_venda (
  dia TEXT NOT NULL,
  filial TEXT NOT NULL,
  pedido TEXT NOT NULL,
  cod_produto TEXT NOT NULL,
  cod_combo TEXT NOT NULL,
  rca TEXT,
  cliente TEXT,
  desc_produto TEXT,
  desc_combo TEXT,
  quantidade REAL,
  preco REAL,
  pct_desconto REAL,
  hash TEXT,
  lido_em TEXT,
  PRIMARY KEY (dia, filial, pedido, cod_produto, cod_combo)
);
CREATE INDEX IF NOT EXISTS idx_clube_combovenda_rca ON clube_combo_venda (dia, filial, rca);

CREATE TABLE IF NOT EXISTS clube_combo_estoque (
  dia TEXT NOT NULL,
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  cod_combo TEXT NOT NULL,
  nome_rca TEXT,
  desc_combo TEXT,
  editavel TEXT,
  qtd_vendida REAL,
  verba REAL,
  estoque_inicial REAL,
  estoque_atual REAL,
  hash TEXT,
  lido_em TEXT,
  PRIMARY KEY (dia, filial, rca, cod_combo)
);
CREATE INDEX IF NOT EXISTS idx_clube_comboest_combo ON clube_combo_estoque (dia, cod_combo);

CREATE TABLE IF NOT EXISTS clube_alerta_aparelho (
  dia TEXT NOT NULL,
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  acao TEXT NOT NULL,
  data_hora TEXT NOT NULL,
  nome TEXT,
  descricao TEXT,
  lido_em TEXT,
  PRIMARY KEY (dia, filial, rca, acao, data_hora)
);
CREATE INDEX IF NOT EXISTS idx_clube_alerta_dia ON clube_alerta_aparelho (dia, acao, filial);

CREATE TABLE IF NOT EXISTS clube_saude_carga (
  dia TEXT NOT NULL,
  arquivo_erro TEXT NOT NULL,
  data_inicial TEXT NOT NULL,
  data_final TEXT,
  status_carga TEXT,
  lido_em TEXT,
  PRIMARY KEY (dia, arquivo_erro, data_inicial)
);

-- 4) TIER 3 (Carteira Viva & Cadastros Mestres)
CREATE TABLE IF NOT EXISTS clube_carteira_cliente (
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  cliente TEXT NOT NULL,
  cnpj TEXT,
  razao TEXT,
  fantasia TEXT,
  atividade_comercial TEXT,
  cidade TEXT,
  bairro TEXT,
  endereco TEXT,
  latitude REAL,
  longitude REAL,
  comprador TEXT,
  telefone TEXT,
  frequencia TEXT,
  visita TEXT,
  dias_sem_visita INTEGER,
  status TEXT,
  nome_rca TEXT,
  hash TEXT,
  lido_em TEXT,
  PRIMARY KEY (filial, rca, cliente)
);
CREATE INDEX IF NOT EXISTS idx_clube_cart_cli ON clube_carteira_cliente (filial, cliente);
CREATE INDEX IF NOT EXISTS idx_clube_cart_cnpj ON clube_carteira_cliente (cnpj);

CREATE TABLE IF NOT EXISTS clube_produto (
  codigo TEXT NOT NULL PRIMARY KEY,
  descricao TEXT,
  desc_simplificada TEXT,
  fornecedor TEXT,
  prioridade TEXT,
  estoque REAL,
  qtd_caixa REAL,
  unidade TEXT,
  embalagem TEXT,
  ean13 TEXT,
  dun14 TEXT,
  hash TEXT,
  lido_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_clube_prod_forn ON clube_produto (fornecedor);

CREATE TABLE IF NOT EXISTS clube_representante (
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  nome TEXT,
  supervisor TEXT,
  tipo_canal TEXT,
  telefone TEXT,
  email TEXT,
  imei TEXT,
  versao TEXT,
  ativo TEXT,
  online TEXT,
  carga_pendente TEXT,
  calcula_eficiencia TEXT,
  checkin_obrigatorio TEXT,
  hash TEXT,
  lido_em TEXT,
  PRIMARY KEY (filial, rca)
);

CREATE TABLE IF NOT EXISTS clube_mix_foco (
  id TEXT NOT NULL PRIMARY KEY,
  data_inicial TEXT,
  data_final TEXT,
  descricao TEXT,
  produto TEXT,
  tipo TEXT,
  hash TEXT,
  lido_em TEXT
);
