-- Vitorio, 31/10/2026: o mesmo codigo de vendedor existe em varias filiais (2, 1035). Chave passa a ser filial + vendedor + dia.
CREATE TABLE varredura_central_rca_nova (
  rca_codigo TEXT NOT NULL, filial_sigla TEXT NOT NULL, data_ref DATE NOT NULL,
  roteiro_json TEXT, produtividade_json TEXT, dashboard_json TEXT, devolucoes_json TEXT, falhas TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, roteiro_em TEXT, prod_em TEXT, roteiro_mes_json TEXT,
  PRIMARY KEY (filial_sigla, rca_codigo, data_ref)
);
INSERT INTO varredura_central_rca_nova (rca_codigo, filial_sigla, data_ref, roteiro_json, produtividade_json, dashboard_json, devolucoes_json, falhas, updated_at, roteiro_em, prod_em, roteiro_mes_json)
  SELECT rca_codigo, filial_sigla, data_ref, roteiro_json, produtividade_json, dashboard_json, devolucoes_json, falhas, updated_at, roteiro_em, prod_em, roteiro_mes_json FROM varredura_central_rca;
DROP TABLE varredura_central_rca;
ALTER TABLE varredura_central_rca_nova RENAME TO varredura_central_rca;
CREATE INDEX idx_varredura_central_filial ON varredura_central_rca (filial_sigla, data_ref);
CREATE INDEX idx_varredura_central_data_ref ON varredura_central_rca (data_ref, filial_sigla);
CREATE INDEX idx_varredura_central_rca_data ON varredura_central_rca (rca_codigo, data_ref);
