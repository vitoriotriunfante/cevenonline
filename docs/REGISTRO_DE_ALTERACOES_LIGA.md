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
- 07/10/2026 — **Versão 2026-10-08.1 (vigente de 08/10/2026): Gol de Marca Própria.** Pedido do cliente no dia com R$ 50 ou mais de Marca Própria Triunfante: lance próprio, **+8** (o mais valioso dos gols), qualificado pelas indústrias, ⭐ no popup, exibido SEMPRE (na frente de tudo, sem intervalo, nunca em resumo), no Varejo e no AS. A versão .2 (só o nome da liga) e a .1 ficam no histórico. Também: canal vem do CEVEN; AS = semana como jogo; vendedor oculto não gera lance.

## 07/10/2026 — versão 2026-10-09.1: Tripla de Marca Própria (+10) e animação de estrelas
- **Nova regra (pedido do Vitório):** 3 ou mais clientes diferentes no mesmo dia, cada um com pedido de R$ 50+ de Marca Própria = **Tripla de Marca Própria, +10 pontos**, um por vendedor por dia, **Varejo e AS**, bônus fixo sem nível, sempre exibido na TV na frente de qualquer lance. Os 3 Gols de Marca Própria (+8 cada) continuam valendo; a Tripla é bônus por cima. **Vale a partir de 09/10/2026** (não retroativo). Gatilho 3 / pontos +10 foram sugestão minha, aceita com o "faz tudo".
- **Animação própria:** chuva de estrelas douradas (⭐ no Gol de Marca Própria, 🌟 na Tripla) por cima da animação/decisão, na TV da filial e na Matriz. Sem vídeo novo.
- Chave do lance: `gol_mp_tripla|<rca>`; auditoria exige prova "N clientes com R$ 50+ de MARCA PROPRIA no dia (minimo 3)" e recusa dia anterior a 09/10.
- Regulamento congelado: `versao_regras` e `REGRAS_VERSAO` = 2026-10-09.1; LOCK_HASH atualizado. **Avisar os gerentes** da nova versão.

## 07/10/2026 (tarde) — nome, supervisores, vermelho, incentivo
- Nome da liga nas telas: **Champions Triunfante** (o comentário interno do JSON de regras não foi mexido: quebraria a trava de regras congeladas).
- Cards do topo da tela da liga dizem "das FILIAIS"; coluna "Forma recente" virou "Últimos jogos".
- Supervisores (TV/Matriz//supervisores): só aparecem os que têm vendedor na árvore viva do CEVEN (`functions/_lib/sup_ativos.js`). Somem Cleber e Everton de TBL; Priscila, Fábio Furlan e "Gerente TBL" não aparecem.
- Vídeos próprios: `gol1_mp.mp4` (Gol de Marca Própria) e `gol2_mp.mp4` (Tripla), reservados fora do sorteio dos gols comuns.
- Cartão vermelho e gol contra por devolução saem sempre sozinhos (nunca dentro de resumo). Coletor: devolução só vale na filial a que o RCA pertence (código 1035 repete em TPA e TBE).
- **Incentivo de Varejo Outubro/2026**: `/incentivo` + `/api/incentivo-outubro` + `public/incentivo_outubro_2026.json`. Vale a positivação FECHADA do dashboard do CEVEN. Pendências do Vitório: universo (330 RCAs/53 sup. no cálculo x 306/48 do regulamento), metas (CEVEN 28.637 x Coluna N 27.000), fórmula "faturados+pendentes" do texto x positivação fechada.
- Descoberto: TV/Matriz não recebem `devolucoes_hoje` do tv-vendedor; vermelho/gol contra de devolução só chegam pelo coletor (ledger).
