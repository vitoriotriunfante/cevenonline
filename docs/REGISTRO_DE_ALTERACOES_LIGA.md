# Registro de alterações da Liga Triunfante

**Regra (Vitório, 06/10/2026):** a liga oficial começa em **07/10/2026** (`vigente_desde` no regulamento). Até lá é **pré-temporada** (aparece no ranking, mas não vale remuneração). A partir de 07/10: regras congeladas por versão, dias fechados às 19h30 e conferência diária contra o CEVEN.

**Período de estabilidade:** só correção de erro, com teste. Regra, pontuação ou score novos NÃO entram no meio do período: ficam na lista abaixo para a próxima versão, e os gerentes são avisados antes de valer.

## Versão vigente
- **2026-10-07.2** (vigente desde 07/10/2026). Mudança da .1 para a .2: só o NOME da liga (agora "Brasileirão Triunfante — Liga da Virada"); nenhuma regra nem ponto mudou. Hash do regulamento guardado em `testes/rodar_testes.mjs` (LOCK_HASH).

## Pedidos para a próxima versão (não entram agora)
- (vazio)

## Histórico
- 06/10/2026 — versão 2026-10-07.1: Plus de Liderança só Compromisso e RET (+5 cada, Fair Play retirado); pênalti −4; Pedido na Rota qualificado; amarelo 10h/vermelho 11h (fuso +1h); acréscimos 16h30–18h; goleada = 10+ clientes comprovados; goleadas anteriores sem prova retiradas (284 chaves únicas: 241 comprovadamente abaixo de 10 clientes + 43 de 27–28/09 sem roteiro guardado); dias 27/09–05/10 fechados manualmente.
- 06/10/2026 — **Auditoria lance por lance** (`functions/_lib/auditoria_lance.js`, `/api/cron-auditoria-lances`): cada lance que conta pontos é conferido contra a regra oficial usando a prova gravada nele; roda a cada ~30 min e aparece em /divergencias. 1ª rodada real: 34 falhas em 1.270 lances (lances sem prova gravada). Defeito corrigido: lance registrado pela TV com obs só de sigla agora recebe a prova do coletor.
