-- Vitorio, 01/11/2026: maximo de 15 min de atraso em todo indicador. Hora da ultima leitura real de cada parte (updated_at anda com qualquer gravacao e nao prova nada).
ALTER TABLE varredura_central_rca ADD COLUMN dash_em TEXT;
ALTER TABLE varredura_central_rca ADD COLUMN dev_em TEXT;
