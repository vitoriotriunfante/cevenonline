-- Faturado/Meta do MÊS ao vivo (TV Executiva) — antes vinha de public/executiva_resumo_mes.json,
-- um arquivo estático nunca atualizado desde 27/09/2026 (achado em 29/09/2026: TV Executiva
-- mostrava faturamento de 2 dias atrás). Agora calculado na MESMA varredura de
-- cron-mapa-executivo.js, via /api/rca/dashboard (financeiro.faturado/meta, positivacao.realizado/meta).
-- PROJETO: CFTV/TV. Só adiciona colunas em resumo_executivo_live (já existe).
ALTER TABLE resumo_executivo_live ADD COLUMN mes_faturado REAL DEFAULT 0;
ALTER TABLE resumo_executivo_live ADD COLUMN mes_meta_faturado REAL DEFAULT 0;
ALTER TABLE resumo_executivo_live ADD COLUMN mes_positivados REAL DEFAULT 0;
ALTER TABLE resumo_executivo_live ADD COLUMN mes_meta_positivados REAL DEFAULT 0;
