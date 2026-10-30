-- OTIMIZACAO DE CUSTO D1 (29/10/2026): indices criticos para eliminar Full Table Scans.
-- Evita a leitura desnecessaria de dezenas de milhares de linhas por query a cada ciclo de TV/crons.

CREATE INDEX IF NOT EXISTS idx_varredura_central_data_ref ON varredura_central_rca (data_ref, filial_sigla);
CREATE INDEX IF NOT EXISTS idx_cascata_dia_data ON cascata_dia (data_ref);
CREATE INDEX IF NOT EXISTS idx_pedido_status_final_cli ON pedido_status (final, data_pedido, filial, id_cliente);
