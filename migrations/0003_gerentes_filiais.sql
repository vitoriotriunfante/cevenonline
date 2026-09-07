-- Tabela de Gerentes de Filiais para envio automatizado de Alertas e Resumos via WhatsApp
CREATE TABLE IF NOT EXISTS gerentes_filiais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filial_id TEXT NOT NULL UNIQUE,
    filial_sigla TEXT NOT NULL,
    nome_gerente TEXT NOT NULL,
    whatsapp_numero TEXT NOT NULL,
    ativo INTEGER DEFAULT 1,
    alertas_cortes INTEGER DEFAULT 1,
    resumo_abertura INTEGER DEFAULT 1,
    resumo_parcial INTEGER DEFAULT 1,
    resumo_fechamento INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cadastro inicial do Gerente da Filial TBL
INSERT OR REPLACE INTO gerentes_filiais 
(filial_id, filial_sigla, nome_gerente, whatsapp_numero, ativo, alertas_cortes, resumo_abertura, resumo_parcial, resumo_fechamento)
VALUES 
('tbl1', 'TBL', 'Vitório Neto', '5566996389884', 1, 1, 1, 1, 1);
