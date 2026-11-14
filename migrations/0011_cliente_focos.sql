-- Persiste TAGs / Clientes Foco (RECORRENCIA, Combos, Scanntech, etc.) no D1
-- para nao depender apenas do roteiro em memoria quando o CEVEN oscilar.
CREATE TABLE IF NOT EXISTS cliente_focos (
  filial TEXT NOT NULL,
  rca TEXT NOT NULL,
  id_cliente TEXT NOT NULL,
  tag TEXT NOT NULL,
  origem TEXT DEFAULT 'ceven',
  atualizado_em TEXT,
  PRIMARY KEY (filial, rca, id_cliente, tag)
);
CREATE INDEX IF NOT EXISTS idx_cliente_focos_rca ON cliente_focos (filial, rca);

