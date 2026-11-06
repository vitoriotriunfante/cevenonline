-- ============================================================================
-- MIGRATION: 0010_gerot_consolidado_historico.sql
-- Armazena histórico oficial do GEROT (Agosto a Novembro) com índices compostos
-- para suportar consultas do Jota / CEVEN com Custo Zero e alta performance.
-- ============================================================================

-- 1. Tabela de Fornecedores / Indústrias Oficial
CREATE TABLE IF NOT EXISTS gerot_historico_industrias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mes TEXT NOT NULL,                     -- '2026-08', '2026-09', '2026-10', '2026-11'
  fornecedor TEXT NOT NULL,              -- Razão Social oficial
  fornecedor_limpo TEXT NOT NULL,        -- Nome normalizado para busca rápida
  media_ponderada TEXT,                  -- '% atingimento meta'
  faturado TEXT,                         -- Valor faturado
  faturado_carteira TEXT,                -- Faturado + Carteira
  captacao TEXT,                         -- Valor de captação
  positivacao TEXT,                      -- Qtd clientes / %
  mix TEXT,                              -- Mix de produtos
  cortes TEXT,                           -- % de corte
  devolucao TEXT,                        -- % de devolução
  tmf TEXT,                              -- Tempo Médio Faturamento (dias)
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Índices Compostos para Custo Zero (Busca O(1) sem Table Scan)
CREATE INDEX IF NOT EXISTS idx_gerot_ind_mes_forn ON gerot_historico_industrias (mes, fornecedor_limpo);
CREATE INDEX IF NOT EXISTS idx_gerot_ind_forn ON gerot_historico_industrias (fornecedor_limpo);

-- 2. Tabela de Filiais Oficial
CREATE TABLE IF NOT EXISTS gerot_historico_filiais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mes TEXT NOT NULL,
  filial TEXT NOT NULL,
  media_ponderada TEXT,
  faturado TEXT,
  faturado_carteira TEXT,
  captacao TEXT,
  positivacao TEXT,
  mix TEXT,
  cortes TEXT,
  devolucao TEXT,
  tmf TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gerot_fil_mes ON gerot_historico_filiais (mes, filial);

-- 3. Tabela de Supervisores Oficial
CREATE TABLE IF NOT EXISTS gerot_historico_supervisores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mes TEXT NOT NULL,
  supervisor TEXT NOT NULL,
  media_ponderada TEXT,
  faturado TEXT,
  faturado_carteira TEXT,
  captacao TEXT,
  positivacao TEXT,
  mix TEXT,
  cortes TEXT,
  devolucao TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gerot_sup_mes ON gerot_historico_supervisores (mes, supervisor);

