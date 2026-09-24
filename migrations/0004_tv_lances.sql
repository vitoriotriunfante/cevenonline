-- Registro dos lances da TV (CFTV): garante que um mesmo lance seja apitado UMA vez
-- (mesmo com várias TVs abertas, recarregamentos ou aparelhos diferentes) e guarda o histórico do dia.
-- PROJETO: CFTV/TV. Tabela nova, não altera nada do WhatsApp.
CREATE TABLE IF NOT EXISTS tv_lances (
  dia TEXT NOT NULL,            -- YYYY-MM-DD (Brasília)
  filial TEXT NOT NULL,         -- sigla (TBL)
  chave TEXT NOT NULL,          -- identificador único do lance (ex.: pen|estoque|<rca>|<cliente>)
  nivel TEXT NOT NULL,          -- penalti | venda10 | visita10 | supervisor
  rca TEXT, vendedor TEXT, supervisor TEXT,
  cliente_id TEXT, cliente TEXT, motivo TEXT,
  dias_sem_compra INTEGER, ultima_compra TEXT, tempo_visita TEXT, obs TEXT,
  hora_sp TEXT NOT NULL,        -- HH:MM:SS em que a TV viu o lance pela primeira vez
  visto_em TEXT NOT NULL,       -- ISO UTC
  baseline INTEGER DEFAULT 0,   -- 1 = já existia quando o sistema começou a olhar o dia (não é apitado)
  PRIMARY KEY (dia, filial, chave)
);
CREATE INDEX IF NOT EXISTS idx_tv_lances_dia ON tv_lances(dia, filial);
