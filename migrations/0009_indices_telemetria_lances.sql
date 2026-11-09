-- OTIMIZACAO DE CUSTO D1 (05/11/2026): indices e telemetria de selects / lances
-- 1. Indice especifico para a TV Matriz e busca de lances por horario
CREATE INDEX IF NOT EXISTS idx_tv_lances_dia_hora ON tv_lances (dia, hora_sp);
CREATE INDEX IF NOT EXISTS idx_tv_lances_filial_hora ON tv_lances (filial, dia, hora_sp);

-- 2. Tabela de metricas e auditoria de selects / trafego D1 para monitoramento em tempo real
CREATE TABLE IF NOT EXISTS d1_telemetria_rotas (
  rota TEXT NOT NULL,
  data_ref TEXT NOT NULL,       -- YYYY-MM-DD
  hora_faixa TEXT NOT NULL,      -- HH:00
  total_chamadas INTEGER DEFAULT 0,
  total_linhas_lidas INTEGER DEFAULT 0,
  ms_acumulado INTEGER DEFAULT 0,
  ultimo_em TEXT,
  PRIMARY KEY (rota, data_ref, hora_faixa)
);

