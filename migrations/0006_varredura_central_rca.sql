-- Varredura central por RCA (etapa 1 da unificação, 29/09/2026): UMA única varredura dos 4
-- endpoints fixos por RCA (roteiro-hoje, produtividade, dashboard, devolucoes) que hoje são
-- buscados SEPARADAMENTE por cada consumidor (WhatsApp, TV Executiva/mapa, TV Executiva/faturado)
-- — cada um faz sua própria passada pelos mesmos ~560 RCAs, multiplicando a carga sobre o CEVEN
-- por N consumidores. Decisão do Vitório, 29/09/2026: "não é tudo a mesma base? se deixar tudo
-- na mesma consulta facilita".
--
-- Grava o payload cru de cada endpoint como JSON (colunas *_json) — cada consumidor extrai dali
-- só os campos que precisa, sem chamada nova ao CEVEN. historico-cliente (seletivo, depende de
-- regras de negócio por consumidor: cliente inativo 30d, foco de campanha, POSITIVADO/EFETIVADO
-- hoje) fica FORA desta tabela por ora — é a parte mais variável entre consumidores, cada um
-- decide se/quando buscar.
--
-- PROJETO: CFTV/TV + WhatsApp (tabela compartilhada de propósito — é o ponto de unificação).
CREATE TABLE IF NOT EXISTS varredura_central_rca (
  rca_codigo      TEXT NOT NULL,
  filial_sigla    TEXT NOT NULL,
  data_ref        DATE NOT NULL,
  roteiro_json    TEXT,  -- array cru de /api/rca/roteiro-hoje
  produtividade_json TEXT, -- objeto cru de /api/rca/produtividade
  dashboard_json  TEXT,  -- objeto cru de /api/rca/dashboard
  devolucoes_json TEXT,  -- array cru de /api/rca/devolucoes
  falhas          TEXT,  -- lista dos endpoints que falharam nesta varredura (nunca inventa dado no lugar)
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rca_codigo, data_ref)
);
CREATE INDEX IF NOT EXISTS idx_varredura_central_filial ON varredura_central_rca(filial_sigla, data_ref);
