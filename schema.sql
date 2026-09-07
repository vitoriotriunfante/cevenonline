-- =========================================================================
-- SCHEMA COMPLETO CEVEN NOC MATRIX - 200+ DIMENSÕES ANALÍTICAS
-- Histórico Perpétuo, Zero Duplicação, Motor +MIX, PEX, Clientes, Prospects
-- e Horários de Consolidação Noturna (20h) e Preparação Matinal (04h)
-- =========================================================================

-- 1. FILIAIS (11 Filiais Oficiais)
CREATE TABLE IF NOT EXISTS filiais (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL
);

-- 2. REPRESENTANTES (519 RCAs Ativos)
CREATE TABLE IF NOT EXISTS representantes (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  setor TEXT,
  ativo BOOLEAN DEFAULT 1,
  versao_app TEXT,
  ultimo_acesso DATETIME,
  dias_sem_acesso INTEGER DEFAULT 0,
  dispositivo TEXT,
  FOREIGN KEY (filial_id) REFERENCES filiais(id)
);

-- 3. SNAPSHOT DIÁRIO DE KPIS POR RCA (30+ Métricas Diárias & Mensais)
CREATE TABLE IF NOT EXISTS rca_kpis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data DATE NOT NULL,
  filial_id TEXT NOT NULL,
  rca_codigo TEXT NOT NULL,
  
  -- Financeiro
  meta_fat REAL DEFAULT 0,
  fat_liq REAL DEFAULT 0,
  pendente REAL DEFAULT 0,
  falta REAL DEFAULT 0,
  pct_fat REAL DEFAULT 0,
  ticket_medio REAL DEFAULT 0,
  devolucao_total REAL DEFAULT 0,
  cortes_total REAL DEFAULT 0,

  -- Positivação e Carteira
  meta_cli INTEGER DEFAULT 0,
  real_cli INTEGER DEFAULT 0,
  falta_cli INTEGER DEFAULT 0,
  pct_pos REAL DEFAULT 0,
  clientes_distintos_mes INTEGER DEFAULT 0,

  -- Produtividade & Eficácia Diária
  dig_pedido_dia REAL DEFAULT 0,
  visitas_programadas_dia INTEGER DEFAULT 0,
  visitas_na_rota_dia INTEGER DEFAULT 0,
  visitas_com_venda_dia INTEGER DEFAULT 0,
  eficacia_pct_dia REAL DEFAULT 0,

  -- Produtividade Mensal
  visitas_plan_mes INTEGER DEFAULT 0,
  visitas_real_mes INTEGER DEFAULT 0,
  ped_rota_mes INTEGER DEFAULT 0,
  eficiencia_pct_mes REAL DEFAULT 0,

  -- Mix de SKUs
  skus_distintos_mes INTEGER DEFAULT 0,
  soma_skus_por_cliente INTEGER DEFAULT 0,
  media_skus_cliente REAL DEFAULT 0,
  skus_crescendo_count INTEGER DEFAULT 0,
  skus_queda_count INTEGER DEFAULT 0,
  skus_mantendo_count INTEGER DEFAULT 0,

  -- Engajamento e Dias Zerados
  dias_zerado_consecutivos INTEGER DEFAULT 0,
  acessou_hoje BOOLEAN DEFAULT 0,
  versao_app_snapshot TEXT,

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data, rca_codigo)
);

-- 4. CONSOLIDADO DIÁRIO POR FILIAL (Fechamento Executivo das 11 Filiais)
CREATE TABLE IF NOT EXISTS consolidado_diario_filial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_snapshot DATE NOT NULL,
  filial_id TEXT NOT NULL,
  total_rcas_ativos INTEGER DEFAULT 0,
  rcas_zerados INTEGER DEFAULT 0,
  rcas_sem_acesso_app INTEGER DEFAULT 0,
  total_fat_liq REAL DEFAULT 0,
  total_meta_fat REAL DEFAULT 0,
  pct_atingimento REAL DEFAULT 0,
  total_pendente REAL DEFAULT 0,
  total_falta REAL DEFAULT 0,
  total_devolucoes REAL DEFAULT 0,
  total_cortes REAL DEFAULT 0,
  total_clientes_meta INTEGER DEFAULT 0,
  total_clientes_positivados INTEGER DEFAULT 0,
  pct_positivacao_geral REAL DEFAULT 0,
  total_visitas_planejadas INTEGER DEFAULT 0,
  total_visitas_efetivadas INTEGER DEFAULT 0,
  eficacia_visitas_media REAL DEFAULT 0,
  total_oportunidades_mix_estimado REAL DEFAULT 0,
  total_prospects_regiao INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data_snapshot, filial_id)
);

-- 5. HISTÓRICO & COMPORTAMENTO DE COMPRA DO CLIENTE (SKUs Subindo/Descendo/Deixou de Comprar)
CREATE TABLE IF NOT EXISTS clientes_historico_compras (
  id_cliente TEXT PRIMARY KEY,
  rca_codigo TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  cnpj TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  ultima_compra_data DATE,
  ultima_compra_valor REAL DEFAULT 0,
  dias_sem_compra INTEGER DEFAULT 0,
  total_pedidos_historico INTEGER DEFAULT 0,
  skus_ultima_venda_json TEXT, -- JSON com codigo, descricao, quantidade, delta (subindo/descendo)
  skus_deixou_de_comprar_json TEXT, -- JSON com skus que comprava e parou
  ultimas_visitas_json TEXT, -- JSON com histórico de visitas anteriores
  recados_ceven_json TEXT, -- JSON com recados e alertas individuais
  tags_oportunidade_json TEXT, -- JSON: ['RECORRENCIA 11/06', 'SEM COMPRAS P9+P08']
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. MOTOR +MIX (Oportunidades de Mix e Gap de Penetração Regional por Vizinhança)
CREATE TABLE IF NOT EXISTS oportunidades_mix_gap (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_snapshot DATE NOT NULL,
  rca_codigo TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  target_cnpj TEXT NOT NULL,
  id_cliente TEXT,
  razao_social TEXT,
  total_universo INTEGER DEFAULT 0,
  impacto_total_estimado REAL DEFAULT 0,
  industria TEXT NOT NULL,
  n_vizinhos_compram INTEGER DEFAULT 0,
  penetracao_pct REAL DEFAULT 0,
  impacto_industria REAL DEFAULT 0,
  produtos_top_json TEXT, -- JSON array de produtos com maior aderência
  vizinhos_compram_json TEXT, -- JSON array com nomes de clientes vizinhos que compram
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data_snapshot, rca_codigo, target_cnpj, industria)
);

-- 7. PROSPECTS DA RECEITA FEDERAL (Georreferenciamento e Capilaridade)
CREATE TABLE IF NOT EXISTS prospects_receita (
  cnpj TEXT PRIMARY KEY,
  rca_codigo TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnae TEXT,
  cnae_desc TEXT,
  familia_cnae TEXT,
  endereco TEXT,
  bairro TEXT,
  municipio TEXT,
  telefone TEXT,
  dist_km REAL,
  lat REAL,
  lon REAL,
  data_descoberta DATE NOT NULL,
  status_prospeccao TEXT DEFAULT 'DESCOBERTO', -- 'DESCOBERTO', 'VISITADO', 'CONVERTIDO'
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. DEVOLUÇÕES (Eventos Únicos Não-Redundantes)
CREATE TABLE IF NOT EXISTS devolucoes_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filial_id TEXT NOT NULL,
  numnota TEXT NOT NULL,
  codcli TEXT NOT NULL,
  rca_codigo TEXT NOT NULL,
  nomecli TEXT,
  cnpj TEXT,
  data_nota DATE,
  vl_devolvido REAL DEFAULT 0,
  motivo_devolucao TEXT,
  categoria_motivo TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(filial_id, numnota, codcli)
);

-- 9. ROTEIRO DE VISITAS DO DIA & ANOMALIAS
CREATE TABLE IF NOT EXISTS roteiros_visitas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_visita DATE NOT NULL,
  rca_codigo TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  id_cliente TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  endereco TEXT,
  bairro TEXT,
  municipio TEXT,
  ordem_visita INTEGER,
  status TEXT NOT NULL, -- 'POSITIVADO', 'VISITADO', 'AGENDADO', 'FORA_ROTA'
  focos_pex TEXT, -- JSON
  vl_pedido REAL DEFAULT 0,
  tempo_visita TEXT,
  num_pedido TEXT,
  hora_efetivacao TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data_visita, rca_codigo, id_cliente)
);

-- 10. ANOMALIAS DE ROTEIRO (Planejado vs Mapa GPS)
CREATE TABLE IF NOT EXISTS anomalias_roteiro_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_auditoria DATE NOT NULL,
  rca_codigo TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  total_planejado INTEGER DEFAULT 0,
  total_mapa INTEGER DEFAULT 0,
  diferenca INTEGER DEFAULT 0,
  clientes_suprimidos TEXT, -- JSON
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data_auditoria, rca_codigo)
);

-- 11. AUDITORIA DE PEDIDOS E CORTES (Ruptura por SKU)
CREATE TABLE IF NOT EXISTS pedidos_cortes_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  num_pedido TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  rca_codigo TEXT NOT NULL,
  id_cliente TEXT NOT NULL,
  nome_cliente TEXT,
  cod_item TEXT NOT NULL,
  descricao_item TEXT,
  data_pedido DATE NOT NULL,
  status_pedido TEXT NOT NULL,
  categoria_corte TEXT,
  vl_original REAL NOT NULL,
  vl_faturado REAL NOT NULL,
  vl_corte REAL NOT NULL,
  motivo_corte TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(filial_id, num_pedido, cod_item)
);

-- 11B. ITENS DOS PEDIDOS FATURADOS E CORTADOS (HISTÓRICO COMPLETO PEDIDO A PEDIDO)
CREATE TABLE IF NOT EXISTS pedidos_faturados_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente TEXT NOT NULL,
  rca_codigo TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  num_pedido TEXT NOT NULL,
  data_visita DATE NOT NULL,
  status_pedido TEXT NOT NULL,
  categoria_corte TEXT DEFAULT 'SEM CORTE',
  vl_faturado_winthor REAL DEFAULT 0,
  total_original REAL DEFAULT 0,
  tipo_item TEXT NOT NULL, -- 'FATURADO' ou 'CORTADO'
  codprod TEXT,
  descricao TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  vl_total REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pedidos_itens_cli ON pedidos_faturados_itens(id_cliente);
CREATE INDEX IF NOT EXISTS idx_pedidos_itens_num ON pedidos_faturados_itens(num_pedido);

-- 12. CONFIGURAÇÃO DA MATRIZ CFTV & FLASH ALERTS
CREATE TABLE IF NOT EXISTS config_tv (
  filial_id TEXT PRIMARY KEY,
  grid_default TEXT DEFAULT '1+5',
  tempo_rotacao_seg INTEGER DEFAULT 60,
  intervalo_alerta_min INTEGER DEFAULT 30,
  duracao_alerta_min INTEGER DEFAULT 5,
  alertas_ativos TEXT DEFAULT '["corte_massa", "zero_vendas", "devolucoes", "pex_perdido", "meta_batida"]'
);

CREATE TABLE IF NOT EXISTS flash_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filial_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  detalhes_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  exibido BOOLEAN DEFAULT 0
);

-- 12. FICHAS LINKUP PRÉ-PREENCHIDAS
CREATE TABLE IF NOT EXISTS linkup_cadastros_preparados (
  cnpj TEXT PRIMARY KEY,
  rca_codigo TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  vendedor_nome TEXT,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnae TEXT,
  cnae_desc TEXT,
  endereco_rua TEXT,
  numero TEXT,
  bairro TEXT,
  municipio TEXT,
  uf TEXT,
  cep TEXT,
  telefone TEXT,
  dist_km REAL,
  status_linkup TEXT DEFAULT 'PRONTO_PARA_ENVIO',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. BRIEFINGS DE IA PARA CLIENTES E PROSPECTS
CREATE TABLE IF NOT EXISTS briefings_ia_clientes (
  cnpj TEXT PRIMARY KEY,
  rca_codigo TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  nome_cliente TEXT,
  ramo TEXT,
  bairro TEXT,
  cidade TEXT,
  frases_dicas_json TEXT,
  fatos_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. SNAPSHOT EXECUTIVO LIVE (A tabela que unifica tudo)
-- Gravada pelo cron horário do GitHub Actions, lida por WhatsApp e painel
-- Uma linha por filial por dia (UPSERT). Linha com filial_id='GRUPO' = total.
CREATE TABLE IF NOT EXISTS consolidado_executivo_live (
  filial_id       TEXT NOT NULL,
  filial_sigla    TEXT NOT NULL,
  data_ref        DATE NOT NULL,
  hora_snapshot   TEXT NOT NULL,       -- '14:00' — última hora de atualização

  -- Faturamento
  fat_liq_total   REAL DEFAULT 0,
  meta_fat_total  REAL DEFAULT 0,
  pct_fat         REAL DEFAULT 0,
  pendente_total  REAL DEFAULT 0,
  devolucoes_total REAL DEFAULT 0,
  cortes_total    REAL DEFAULT 0,

  -- Positivação
  meta_cli_total  INTEGER DEFAULT 0,
  real_cli_total  INTEGER DEFAULT 0,
  pct_pos         REAL DEFAULT 0,

  -- Operacional
  rcas_ativos     INTEGER DEFAULT 0,
  rcas_zerados    INTEGER DEFAULT 0,
  rcas_com_venda  INTEGER DEFAULT 0,
  visitas_plan    INTEGER DEFAULT 0,
  visitas_real    INTEGER DEFAULT 0,
  pedidos_dia     INTEGER DEFAULT 0,
  ticket_medio    REAL DEFAULT 0,

  -- Top RCAs e Zerados (JSON compacto)
  top5_rcas_json  TEXT,               -- JSON: [{codigo, nome, fat_liq, pct_fat}]
  zerados_json    TEXT,               -- JSON: [{codigo, nome, meta_fat, visitas_rota}]
  alertas_json    TEXT,               -- JSON: alertas de pedidos desbloqueados, etc.

  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(filial_id, data_ref)
);

-- =========================================================================
-- ÍNDICES DE ALTA PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_kpis_data_filial ON rca_kpis(data, filial_id);
CREATE INDEX IF NOT EXISTS idx_kpis_rca ON rca_kpis(rca_codigo, data);
CREATE INDEX IF NOT EXISTS idx_consolidado_data ON consolidado_diario_filial(data_snapshot, filial_id);
CREATE INDEX IF NOT EXISTS idx_cliente_rca ON clientes_historico_compras(rca_codigo);
CREATE INDEX IF NOT EXISTS idx_prospects_rca ON prospects_receita(rca_codigo, dist_km);
CREATE INDEX IF NOT EXISTS idx_mix_target ON oportunidades_mix_gap(target_cnpj, data_snapshot);
CREATE INDEX IF NOT EXISTS idx_roteiros_data_rca ON roteiros_visitas(data_visita, rca_codigo);
CREATE INDEX IF NOT EXISTS idx_exec_live_data ON consolidado_executivo_live(data_ref);
CREATE INDEX IF NOT EXISTS idx_exec_live_filial ON consolidado_executivo_live(filial_id, data_ref);
