# Plano: parar de quebrar, coletar mais rápido e separar representantes (12/10/2026)

Pedido do Vitório (12/10/2026, véspera do campeonato): "ROBUSTO, COMPLETO e DOCUMENTANDO". Este documento é o plano; o que for feito é registrado em `docs/CFTV_MATRIX_VISAO_E_ESTADO_ATUAL.md`.

## 1. Por que quebrou (causas, com evidência)

| # | Causa | Evidência |
|---|---|---|
| 1 | O CEVEN limita chamadas **por chave** (HTTP 429, Retry-After ~19 s). TV, Matriz, coletor de lances, varredura e WhatsApp dividem a mesma cota **sem nenhum controle central**. | 11/10: 429 em toda chamada; o `tv-vendedor` buscava o histórico de todo cliente positivado a cada tela/ciclo. |
| 2 | O CEVEN passou a exigir `X-App-Secret` em 09/10 **sem aviso**; ninguém testava o contrato todo dia. | WhatsApp abortou em 09/10 (401); a correção ficou só num PC, sem commit. |
| 3 | Gravação **sem proteção**: falha do CEVEN virava `null` por cima de dado bom; etapas só gravavam no fim. | 11/10: base com 217 sem dashboard; `?forcar=1` piorou. |
| 4 | **Ninguém é avisado** quando a coleta para. O vigia só cobre o disparo do WhatsApp. | 12/10: base vazia das 04:00 às 18:05 e ninguém soube. |
| 5 | Trabalho espalhado em sessões sem commit; deploy com árvore suja. | Ver Regra de Ouro do CLAUDE.md. |
| 6 | Resumo do mês gravava total parcial quando 4 filiais estavam sem leitura. | 12/10: meta R$ 58 mi na Matriz (certo: R$ 85,1 mi). |

## 2. Plano em quatro frentes

### Frente A — Detectar e avisar (antes de qualquer coisa)
1. **Sinal de vida** a cada 5 min (D1): frescor da base (mais novo / mediana), RCAs sem dashboard/produtividade/rota, contagem de 429 e 401 na última hora, último ciclo de WhatsApp.
2. **Alerta ao Vitório no WhatsApp** quando: base sem gravação há mais de 10 min em horário comercial; 401 do CEVEN (chave mudou); 429 contínuo por mais de 5 min; ciclo de WhatsApp não disparado.
3. **Teste de contrato diário às 03:30** (antes das 04:00): chama 1 endpoint de cada tipo com a chave e confere o formato. Falha = alerta antes do ciclo.
4. **Página `/saude`** com tudo isso numa tela.

### Frente B — Acelerar a coleta sem estourar a cota
1. **Medir** a cota real: rampa controlada (6, 8, 10 chamadas simultâneas) registrando 429; ajustar `CONC` pelo número, não por palpite.
2. **Orçamento central de chamadas** (token bucket no D1): toda chamada ao CEVEN (varredura, `tv-vendedor`, lances, WhatsApp) passa por ele, com prioridade: pedido novo > rota > produtividade > dashboard > devolução. Ao 429, todos pausam.
3. **Trocar 596 chamadas de dashboard por 1**: o painel admin do CEVEN entrega meta, faturado, a faturar e positivado de **todos os vendedores sob supervisor** em uma única chamada (`/api/admin/filiais/hierarquia`, 443 vendedores, 124 KB). Usar isso a cada 2 min; o dashboard por RCA fica só para os ~155 que não estão sob supervisor.
   - Pré-condição: login admin (`CEVEN_ADMIN_USER/PASS`) como secret no Cloudflare Pages (hoje só existe no GitHub).
   - Regra mantida: `refreshMetas=false` (nunca dispara o recálculo pesado do CEVEN).
4. Cache de 20 min por cliente (já publicado) e base central usada mesmo incompleta (já publicado).

### Frente C — Flags por vendedor (representantes e participação por tela)
Hoje a Gestão guarda `mostra` (SIM/NÃO), `canal`, `grupo`, `supervisor`. Não existe o conceito "representante" (PJ), que o Vitório não pode cobrar.

1. Novo campo **`vinculo`**: `CLT` | `REPRESENTANTE` (sugestão automática: nome começa com "PJ"; **o Vitório confirma na Gestão**).
2. Novo campo **`participa`**: um conjunto de flags por vendedor, cada uma ligada a uma tela/regra:
   `painel` · `meta_e_vendas` · `lances_positivos` · `cartoes_penaltis` · `zerados_cobranca` · `liga_brasileirao` · `incentivo` · `whatsapp_cobranca` · `ronda_tv`.
3. **Padrão por vínculo**: REPRESENTANTE = só `painel` e `meta_e_vendas` (aparece e soma, nunca é cobrado nem pontua). CLT = tudo ligado. O Vitório pode ligar/desligar qualquer flag individualmente.
4. **Um único ponto de decisão**: `functions/_lib/participacao.js`, lido por `cron-lances`, liga, incentivo, `tv-vendedor`, Matriz, motor do WhatsApp. Nenhuma tela decide por conta própria.
5. **Identificação visual**: selo "REP" nas telas onde ele aparece.
6. **Testes automáticos**: nenhum representante gera lance negativo, aparece na Liga, no incentivo, em zerados ou na cobrança do WhatsApp.
7. Meta e faturado do representante **continuam somando** nas filiais e na meta geral (decisão do Vitório: ver, mas não cobrar).

### Frente D — Governança e documentação
1. Runbook `docs/RUNBOOK_COLETA.md`: o que olhar, em ordem, quando a base para; como reiniciar; o que **nunca** fazer (`?forcar=1` em dia útil).
2. Checklist de pré-jogo (23:00 da véspera): sinais de vida verdes, contrato ok, 11 filiais com dashboard, meta geral = soma, 0 representante em lance.
3. Toda alteração em `cron-*`/`pipeline/` com commit imediato e registro neste documento.

## 3. Ordem de execução

| Quando | O quê | Depende de |
|---|---|---|
| Hoje à noite | Frente C itens 1 a 6 (flags + filtros + testes) | Vitório confirmar a regra de "representante" |
| Hoje à noite | Frente A itens 1 e 2 (sinal de vida + alerta) | nada |
| Antes das 04:00 | Teste de contrato (A3) | nada |
| Esta semana | Frente B (medir, orçamento central, hierarquia) | secret do admin no Cloudflare |
| Esta semana | Frente D (runbook, checklist) | nada |

## 4. O que NÃO dá para prometer

- Evitar que o CEVEN mude algo sem avisar: dá para **detectar em minutos e alertar**, não impedir.
- A cota do CEVEN é deles; o plano é gastar menos e avisar quando faltar.
