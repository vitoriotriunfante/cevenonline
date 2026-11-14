-- Fundacao do MONITOR.IA (Etapa 2): regras declarativas, eventos de dominio e log/ROI de envios
CREATE TABLE IF NOT EXISTS regras_monitoria (
  id TEXT PRIMARY KEY,
  onda INTEGER NOT NULL DEFAULT 1,
  papel TEXT NOT NULL,
  nome TEXT NOT NULL,
  horario TEXT,
  limiar_json TEXT,
  bonequinho TEXT NOT NULL DEFAULT 'TEXTO',
  modo TEXT NOT NULL DEFAULT 'SIMULACAO_VITORIO',
  ativo INTEGER NOT NULL DEFAULT 0,
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS domain_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  filial TEXT,
  rca TEXT,
  payload_json TEXT,
  source TEXT,
  occurred_at TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE(event_type, entity_key, occurred_at)
);
CREATE INDEX IF NOT EXISTS idx_domain_events_proc ON domain_events (processed_at, event_type);

CREATE TABLE IF NOT EXISTS monitoria_envios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  regra_id TEXT NOT NULL,
  data TEXT NOT NULL,
  celular TEXT NOT NULL,
  destino_real TEXT,
  papel TEXT,
  filial TEXT,
  rca TEXT,
  modo TEXT NOT NULL,
  texto_preview TEXT,
  bonequinho TEXT,
  status TEXT NOT NULL DEFAULT 'SIMULADO',
  acao_pos_alerta TEXT,
  enviado_em TEXT,
  UNIQUE(regra_id, data, celular, modo)
);
CREATE INDEX IF NOT EXISTS idx_monitoria_envios_data ON monitoria_envios (data, regra_id);

INSERT OR IGNORE INTO regras_monitoria (id, onda, papel, nome, horario, limiar_json, bonequinho, modo, ativo, atualizado_em) VALUES
  ('V1', 1, 'vendedor',   'Matinal Tática do Vendedor',               '07:30', '{}',                            'BOPE_OPERACAO', 'SIMULACAO_VITORIO', 1, datetime('now','-3 hours')),
  ('V2', 2, 'vendedor',   'Sem Início de Rota (0 visitas)',           '10:00', '{"min_visP":1,"max_visF":0}',   'TEXTO',         'SIMULACAO_VITORIO', 0, datetime('now','-3 hours')),
  ('V3', 2, 'vendedor',   'Em Rota Sem Pedido (Anti-Zerado)',         '13:30', '{"min_visP":1,"max_dig":0}',    'BOPE_GUERRA',   'SIMULACAO_VITORIO', 0, datetime('now','-3 hours')),
  ('V4', 1, 'vendedor',   'Oportunidade Quente (MP / Recorrência)',   '11:00', '{}',                            'BOPE_TROPA',    'SIMULACAO_VITORIO', 1, datetime('now','-3 hours')),
  ('V5', 2, 'vendedor',   'Pedido Bloqueado ou Cortado',              'EVENT', '{}',                            'TEXTO',         'SIMULACAO_VITORIO', 0, datetime('now','-3 hours')),
  ('V6', 2, 'vendedor',   'Fechamento Tático do Vendedor',            '17:45', '{}',                            'CLASSICO',      'SIMULACAO_VITORIO', 0, datetime('now','-3 hours')),
  ('S1', 1, 'supervisor', 'Matinal da Equipe + Compromisso',          '07:45', '{}',                            'CARD_PNG',      'SIMULACAO_VITORIO', 1, datetime('now','-3 hours')),
  ('S2', 1, 'supervisor', 'RET Unificada (pior ritmo + 5 focos)',     '09:30', '{}',                            'TEXTO',         'SIMULACAO_VITORIO', 1, datetime('now','-3 hours')),
  ('S3', 2, 'supervisor', 'Escalação: Equipe Travada / Zerados',      '10:30', '{}',                            'TEXTO',         'SIMULACAO_VITORIO', 0, datetime('now','-3 hours')),
  ('S4', 2, 'supervisor', 'Bloqueio / Corte Crítico da Equipe',       '12:00', '{"min_bloq_vlr":2000}',         'TEXTO',         'SIMULACAO_VITORIO', 0, datetime('now','-3 hours')),
  ('S5', 2, 'supervisor', 'Fechamento + Placar Liga/F1 da Equipe',    '18:00', '{}',                            'CLASSICO',      'SIMULACAO_VITORIO', 0, datetime('now','-3 hours')),
  ('G1', 1, 'gerente',    'Matinal Executiva da Filial',              '08:00', '{}',                            'CARD_PNG',      'SIMULACAO_VITORIO', 1, datetime('now','-3 hours')),
  ('G2', 2, 'gerente',    'Escalação por Exceção (Filial/Sup)',       '11:30', '{"pct_sem_visita":30}',         'TEXTO',         'SIMULACAO_VITORIO', 0, datetime('now','-3 hours')),
  ('G3', 1, 'gerente',    'Marca Própria & Indústrias-Chave',         '10:30', '{"dias_semana":[2,4]}',         'BOPE_TROPA',    'SIMULACAO_VITORIO', 1, datetime('now','-3 hours')),
  ('G4', 2, 'gerente',    'Fechamento Executivo da Filial',           '18:30', '{}',                            'CLASSICO',      'SIMULACAO_VITORIO', 0, datetime('now','-3 hours')),
  ('D1', 1, 'diretoria',  'Pulso Brasil (Manhã e Fechamento)',        '08:15', '{}',                            'CARD_PNG',      'SIMULACAO_VITORIO', 1, datetime('now','-3 hours')),
  ('D2', 1, 'diretoria',  'Auditoria & ROI do MONITOR.IA',            '19:00', '{}',                            'TEXTO',         'SIMULACAO_VITORIO', 1, datetime('now','-3 hours'));

