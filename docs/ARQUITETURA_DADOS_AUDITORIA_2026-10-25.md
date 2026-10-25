# Auditoria da arquitetura de dados — 25/10/2026

Pedido do Vitório (repetido ~10x): "revisar a arquitetura em relação aos dados coletados: o que é coletado com redundância, sem necessidade".
Gatilho: conta Cloudflare de US$ 166,94 (25/09–24/10), US$ 160 de D1 Rows Written.

## Regra que deveria valer (e NÃO vale hoje)
**Uma coleta só do CEVEN → uma base (D1) → todos leem dela**: TV, Matriz, WhatsApp, Liga, +MIX, JOTA. (Memória "motor único, uma fonte", pedida ~15x.)
Projetos separados = código separado. Dado = uma fonte só.

## Quem coleta do CEVEN hoje (em produção)
| # | Coletor | Quando | Lê do CEVEN | Grava | Situação |
|---|---|---|---|---|---|
| 1 | cron-varredura-central (TV) | a cada 2 min, **24 h, 7 dias** | produtividade, dashboard, roteiro, devoluções de ~560 RCAs | varredura_central_rca (~137 mil linhas/dia mesmo sem operação) | é a BASE CENTRAL; grava mesmo quando nada mudou |
| 2 | cron-piloto-pedidos | a cada 2 min, 24/7 | — (copia da base) | piloto_pedidos_intraday 367 mil linhas/dia | **nenhum leitor → DESLIGADO 25/10** |
| 3 | cron-mapa-executivo (TV Executiva) | a cada 5 min | historico-cliente por cliente positivado | mapa_executivo_live ~10 mi linhas/dia | **causa da conta → DESLIGADO 25/10** |
| 4 | cron-lances | a cada 5 min | 6 rotas do CEVEN por conta própria | tv_lances | **redundante**: devia ler a base central |
| 5 | cron-faturado-mes | a cada 15 min | dashboard | resumo_executivo_live (mes_*) | **redundante**: dashboard já está na base |
| 6 | Motor do WhatsApp (pipeline/ceven_unified_engine.js, GitHub Actions) | 04:00, 07:45, 10:00, 11:30, 14:30, 17:00, 18:30 | 7 rotas do CEVEN para TODOS os RCAs a cada ciclo (até 13 min) | arquivos | **redundante**: não lê a base central; coleta tudo de novo |
| 7 | Data Lake 03:00 (analises/*.py/js) | 1x/dia | histórico, PDVs, prospects, mix gap | Drive | necessário (dado que a varredura não pega) |
| 8 | mix-dataset | 02:00 seg–sex | mix gap, histórico | public/mix_* | necessário (noturno) |
| 9 | descoberta-codigos | 22:00 | 14.800 consultas (código × filial) | codigos_descobertos | avaliar: 1x/semana basta |
| 10 | Telas que chamam o CEVEN ao vivo | a cada abertura/refresh | tv-vendedor (8 rotas), tv-supervisores, tv-supervisores-semana, saude, incentivo, divergencias | — | **redundante** quando o dado já está na base |

## O que custa (medido no D1, últimos 7 dias)
- mapa_executivo_live: ~70 mi linhas/semana (desligado).
- piloto_pedidos_intraday: ~1,7–2,6 mi/semana (desligado).
- varredura_central_rca: ~1 mi/semana (grava sem mudança e de madrugada/fim de semana).
- resto: < 0,5 mi/semana.
- Sábado 24/10 (sem operação): 551 mil linhas. A cota grátis do mês (50 mi) já tinha acabado, então tudo foi cobrado; somam-se as requisições (26 mi no mês; 10 mi grátis) dos crons a cada 2 min e das TVs ligadas.

## Plano proposto (ordem de impacto)
1. ✅ Feito: desligar mapa executivo e piloto (sem leitor).
2. Varredura central só grava se o JSON mudou; fora do horário (antes de 06h, depois de 21h e domingo) roda a cada 30 min. (Gravação cai ~80%, requisições ~60%.)
3. cron-lances e cron-faturado-mes passam a ler a base central (zero chamada própria ao CEVEN).
4. Motor do WhatsApp lê a base central (central-snapshot) em vez de varrer o CEVEN a cada ciclo — Projeto B, só com ordem do Vitório. Ganho: ciclos de 13 min viram segundos e acabam os 429 do CEVEN.
5. Telas leem só a base (tv-vendedor etc. sem chamada ao vivo).
6. descoberta-codigos semanal.
7. Aviso de gasto na Cloudflare (US$ 10) + conferência semanal `wrangler d1 insights --sort-by=writes`.

## Execução (25/10/2026, ordem do Vitório: "faça os 5 e depois faça todos os testes")
1. ✅ Varredura central, lances e faturado do mês: fora do horário (antes 06h, depois 21h, domingo) 1 rodada a cada 30 min (`functions/_lib/horario_reduzido.js`). Sábado = dia útil. TV aceita base de até 45 min fora do horário (senão iria ao CEVEN).
   "Gravar só quando mudou" NÃO foi aplicado à varredura: as telas usam o horário de cada gravação para saber se o dado é fresco; sem ele iriam ao CEVEN ao vivo.
2. ✅ Já era assim (correção desta auditoria): cron-faturado-mes e incentivo leem a base; cron-lances lê as devoluções da base e só consulta o CEVEN para o MOTIVO de cada nota (dado que só existe lá; máx. 6 por rodada).
3. ✅ tv-supervisores (5 min), tv-supervisores-semana (10 min) e divergencias (5 min) com cache (`functions/_lib/cache_borda.js`: memória + D1; o cache da borda não funciona em *.pages.dev). Gestão de Equipe usa ?fresco=1.
4. ✅ Já era assim (correção desta auditoria): o motor do WhatsApp lê produtividade, dashboard, devoluções e roteiro da base central (pipeline/fonte_base.js, desde 07/10) e o canal da Gestão de Equipe (desde 13/10). Direto no CEVEN só ficam: login, compromisso/RET (matriz do dia) e detalhe da RET — dados que a base não tem.
5. ✅ descoberta-codigos semanal (domingo 22h).
Testes: 531/531 + varredura + WhatsApp gerentes + simulador do JOTA.
