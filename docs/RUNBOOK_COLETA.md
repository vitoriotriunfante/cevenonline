# Runbook — a coleta parou / a meta está errada / algo "sumiu" (12/10/2026)

Abra primeiro: **`https://ceven-cftv-matrix.pages.dev/saude`** (sala de controle; atualiza a cada 15 s, só leitura).

## 1. Leitura rápida do painel

| Sinal | Significa | O que fazer |
|---|---|---|
| Farol vermelho + "Coleta parada" | nenhuma gravação nos últimos 10 min em horário comercial | passo 2 |
| "CEVEN devolveu 401/403" | o CEVEN trocou a chave `X-App-Secret` | passo 3 |
| "CEVEN limitando (429)" | cota esgotada: nós ou outro app estão chamando demais | passo 4 |
| "Resumo do mês com N/11 filiais" | meta parcial na Matriz | passo 5 |
| "RCAs fora da Gestão" | RCA com meta no CEVEN que ninguém decidiu | decidir em `/gestao-equipe` → Divergências |
| "Nenhum vendedor marcado como REPRESENTANTE" | vínculo não aplicado | passo 6 |

## 2. Coleta parada
1. `/saude` → bloco **Rodadas de coleta**: se `último tick` tem mais de 8 min, o agendador (worker `ceven-cron-sync`) parou.
2. Cloudflare → Workers & Pages → `ceven-cron-sync` → **Triggers/Cron** (devem existir `*/2`, `4-59/5`, `2-59/5`, `2-59/15`) e **Logs** (`npx wrangler tail ceven-cron-sync`).
3. Se o worker está vivo mas a base não grava: `/api/varredura-status` e `/api/cron-varredura-central` (um tick manual; leva ~100 s). Resposta `OCUPADO` = há uma rodada em andamento (a trava expira sozinha em 150 s).
4. **Nunca** usar `?forcar=1` em dia útil: recomeça do início e, com o CEVEN lento, só reescreve os mesmos RCAs.

## 3. 401/403 do CEVEN
1. Abrir o painel admin do CEVEN (`/admin`) com o navegador, ver no bundle `assets/admin-*.js` o valor atual de `X-App-Secret`.
2. Trocar em: `functions/_lib/ceven_auth.js`, `functions/api/cron-varredura-central.js` (constante `CEVEN_APP_SECRET`), `functions/api/tv-vendedor.js`, secret `CEVEN_APP_SECRET` do GitHub (`gh secret set CEVEN_APP_SECRET`).
3. Publicar com `node publicar_tv.js "chave do CEVEN"`.

## 4. 429 (limite de chamadas)
- A varredura já pausa tudo pelo `Retry-After` do CEVEN. O cache de 20 min por cliente está em `cache_analise_cliente`.
- Se persistir: ver no `/saude` o gráfico "Chamadas por rodada"; reduzir `CONC` em `cron-varredura-central.js` ou espaçar o coletor de lances.

## 5. Meta errada na Matriz
- `GET /api/metas-mes` lê `resumo_executivo_live` (linha `TODAS`). Recalcular: `GET /api/cron-faturado-mes?forcar=1` (só lê o D1; é seguro).
- Desde 12/10 uma filial com menos de 90% dos RCAs lidos **não** sobrescreve o valor anterior.

## 6. Representantes (não cobrados)
- Fonte: planilha DEPARA, coluna **P "Tipo vendedor" = R**.
- Aplicar/atualizar: `node scripts/aplicar_vinculo_representantes.js "<DEPARA.xlsx>" --dry` (simula) e depois sem `--dry` (grava; guarda cópia em `scratch/`).
- Ajuste individual: `/gestao-equipe` (Diretoria) → coluna **Vínculo / Participa**.
- Regra única: `functions/_lib/participacao.js`.

## 7. Checklist de pré-jogo (23:00 da véspera)
1. `/saude` verde; 596 RCAs, 0 sem dashboard/produtividade/rota.
2. Meta geral na Matriz = soma dos RCAs (bloco "Metas").
3. 11/11 filiais no resumo do mês.
4. Representantes > 0 e nenhum com lance (`/api/tv-lances`).
5. Versão publicada e `git status` sem arquivo importante sem commit.
6. Ciclo de 04:00: conferir às 04:15 em `/saude` → WhatsApp.

## 8. O que NUNCA fazer
- `?forcar=1` na varredura em dia útil.
- Publicar (`wrangler pages deploy`) sem `publicar_tv.js` (as TVs não recarregam).
- Gravar `null` por cima de dado do CEVEN.
- Editar a Gestão de Equipe direto no D1 sem cópia de segurança.
