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

## 07/10/2026 (noite) — liga oficial começa em 13/10/2026 (versão 2026-10-13.1)
- Decisão do Vitório: **pré-temporada de 05/10 a 12/10** (não vale remuneração); **liga oficial desde 13/10/2026**. O ranking da pré-temporada conta os dias a partir de 05/10 (`pre_temporada_desde`).
- `vigente_desde` = 2026-10-13; `REGRAS_VERSAO` = `versao_regras` = 2026-10-13.1; LOCK_HASH atualizado; Liga AS: `AS_VALE_DESDE` = 2026-10-13. Gol de Marca Própria (08/10) e Tripla (09/10) entram em teste dentro da pré-temporada.
- **Avisar os gerentes** da data oficial.

## 07/10/2026 — Bola Cheia (18h)
- Decisão do Vitório: título "Bola Cheia" para o melhor vendedor de cada filial no dia (Varejo), **congelado às 18h** (não muda mais), sem pontos nem dinheiro; vídeo na TV da filial (o da própria filial) e na Matriz (os 11); só o primeiro de cada filial. Mínimo de 5 visitas no dia. AS = por semana (sexta): **etapa seguinte, ainda não feita**.
- Critério: mais pontos do dia na liga (lances auditados); desempate positivados, digitado, nome; pontos ≤ 0 = filial sem Bola Cheia. Tabelas `bola_cheia` e `bola_cheia_dia`; endpoint `/api/bola-cheia`; coletor congela a partir das 18h (horário de Brasília para todas as filiais). Prompt do vídeo: `docs/PROMPT_VIDEO_BOLA_CHEIA.md` (arquivo `bolacheia_1.mp4`; sem ele usa a animação em tela).

## 07/10/2026 (mega auditoria)
- **Achado 1 (corrigido):** `public/pontuacao_brasileirao.json` (o que a tela lê) estava diferente de `config/` — mostrava um texto antigo do Resgate ("OU cliente com TAG RECORRÊNCIA"), que contradiz a regra de 05/10 (Recorrência = Defesa). Agora são idênticos e há teste que exige isso.
- **Achado 2 (corrigido):** dataset do Brasileirão parou numa falha (HTTP 500 durante a publicação) e ficou velho; regerado, agora `pre_temporada=true`, oficial 13/10.
- **Achado 3 (corrigido, vale a partir do fechamento de 07/10):** ~11% dos lances do dia estão SEM PROVA (hoje: 82 de 224 amarelos das 10h/11h, 25 gols de cliente, 9 impedimentos de GPS, 7 vermelhos de abandono...). Origem: a TV/Matriz grava o lance primeiro, só com a sigla no `obs`, e o coletor não o confirma. Regra "sem comprovação não tem lance": o fechamento das 22h agora RETIRA da pontuação o lance reprovado pela auditoria (trilha em `lances_excluidos_liga`, motivo "AUDITORIA DO FECHAMENTO"); falha de cadastro (sem supervisor etc.) não retira. Valia só a partir de 13/10, foi antecipada para a pré-temporada para o Vitório ver o efeito.
- **Em aberto (causa raiz):** a TV decide o amarelo/gol no 1º segundo com dado possivelmente atrasado; o coletor (5 em 5 min) é quem comprova. Estudar tornar o coletor a única fonte de lance pontuável.
- (07/10 noite) Sem a expressão "não vale remuneração" nas telas (pill da pré-temporada e informações oficiais). **Auto-auditoria no Gabarito** a partir de 13/10 (ou `?auditoria=1`): auditados, aprovados, reprovados e retirados no fechamento, com o motivo de cada um (`carregaAuditoriaGabarito` em brasileirao.html; dados de `/api/cron-auditoria-lances`).
- (07/10 noite) Tela da liga: Artilharia de Vendedores ganhou **SG (saldo de gols)** como a dos supervisores; coluna "Bônus Streak" virou **"Bônus"** e não some mais (antes o CSS escondia a 11ª coluna abaixo de 1560 px). Responsivo por classes: ≤1360 esconde Supervisor e % Aprov; ≤1000 esconde Últimos jogos; ≤700 esconde V/E/D e a Filial vai para baixo do nome; cabeçalho, cartões e tabelas se ajustam ao celular.
