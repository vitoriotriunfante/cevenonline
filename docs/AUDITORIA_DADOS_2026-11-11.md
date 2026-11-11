# AUDITORIA DOS DADOS — 11/11/2026 (medida no D1 de produção, 08h40)

> Pergunta do Vitório (11/11/2026): "TODOS os dados que estão sendo refletidos no JOTA, no Brasileirão/Champions, no +MIX e em todos os projetos são reais, estão sendo populados em tempo real? GEROT bate com o CEVEN? Temos um plano de onde sai cada dado, como é tratado, populado, comparado? Plano para quando algum para? Rota alternativa?"
> Método: `node scripts/mapa_dados.mjs` (mapa do código), `docs/BASE_UNICA.md` (plano), consulta tabela por tabela no D1 de produção, conferência GEROT x CEVEN por filial, conferência diária D1 x CEVEN (`conferencia_rca`), auditoria da Liga (`auditoria_lance_resumo`), estado dos robôs do GitHub.
> Este documento complementa `BASE_UNICA.md` (o plano) e `MAPA_DADOS_GERADO.md` (o código). Registrar aqui cada correção.

## 1. Resposta curta
- **Os dados são reais** (nenhum número estimado foi encontrado), mas **nem todos estão no tempo certo**. Três problemas afetam o que o vendedor e a Liga veem:
  1. **Digitado do dia atrasado**: às 08h45 os pedidos gravados somavam **R$ 386 mil (63 vendedores)**, mas a produtividade do dia mostrava **R$ 68 mil** (54 vendedores atrasados). Na conferência de 10/11 faltaram **R$ 111 mil (11%)** no fim do dia. Causa: a produtividade sai de `/api/rca` (cota de 3–4 chamadas/min para todos) e só é relida quando o detector percebe mudança.
  2. **Ficha do cliente parada desde 08/11**: a carga (`ficha-clientes-d1`) falhou em 06, 10 e 11/11 porque a coleta de prospects estava incompleta — um dado travava o outro. **Corrigido hoje** (seção 4).
  3. **Data do pedido errada** (data da visita/entrega gravada como data do pedido): 1.076 pedidos em 10/11, 625 hoje às 08h22. **Corrigido na origem hoje** e limpeza em andamento (~11 por minuto).
- **GEROT não bate com o CEVEN**: meta **+R$ 1,79 mi** no GEROT; faturado **−R$ 351 mil** no GEROT (o GEROT carrega em janelas; o CEVEN é ao vivo). Não existe hoje uma conferência automática GEROT x CEVEN que fique gravada (seção 3).
- **Liga**: a auditoria de cada lance passou 100% em 09/11 (2.074) e 10/11 (2.274). Mas ela confere os lances que **existem**; um lance que **deixou de nascer** por dado atrasado não aparece nela.

## 2. Cada dado: de onde sai, onde fica, ritmo, situação agora
| Dado | Sai de (CEVEN/GEROT) | Fica no D1 | Ritmo | Medido 08h40 | Compara com | Rota alternativa |
|---|---|---|---|---|---|---|
| Roteiro do dia (status, check-in) | `rca/roteiro-hoje` | `varredura_central_rca` | madrugada + quem mudou | ✅ 571 vendedores, 08h31 | rota do gerente | ✅ `gerente/supervisor/roteiro-hoje` → `rota_gerente_dia` (99 supervisores, 08h24) — **gravada, nenhuma tela lê** |
| Visitas plan/real | `rca/produtividade` | `varredura_central_rca` | quem mudou | ⚠️ só 31 relidos em 30 min | cascata do gerente | ✅ `gerente/tabelas-cascata` → `cascata_dia` (11 filiais, 08h38) |
| **Digitado / pedidos do dia** | `rca/produtividade` + `rca/historico-vendedor` + Winthor | `varredura_central_rca`, `pedido_status`, `pedido_leitura` | quem mudou; Winthor 5 vendedores/rodada | ❌ produtividade R$ 68 mil x pedidos R$ 386 mil | `conferencia_rca` (D1 x CEVEN, 22h37) | ⚠️ `pedido_status` já tem os pedidos; a tela/JOTA ainda lê a produtividade |
| Meta / faturado / pendente / positivação | `admin/view-as/rca/dashboard` | `varredura_central_rca` | 2 min | ✅ 571, 08h36 | GEROT, `meta_hierarquia` | ✅ `gerente/dashboard-cascata` → `painel_gerente_dia` (08h24) |
| Meta oficial | `admin/filiais/hierarquia` | `meta_hierarquia` | 1x/dia | ✅ 10/11 14h10 | GEROT | — |
| Devoluções (notas e motivo) | `rca/devolucoes`, `devolucoes/{nota}` | `varredura_central_rca`, `devolucao_nota_motivo` | quem mudou | ✅ 08h37 | GEROT (devolução) | — |
| Status do pedido / cortes | `historico-cliente`, Winthor | `pedido_status` (+ itens cortados desde 10/11) | rodízio | ✅ 5.409 conferidos na última hora | Winthor | ✅ consulta por número (desde 11/11) |
| Histórico do cliente | `rca/historico-cliente/{id}` | `historico_cliente` | cliente com pedido novo | ✅ 1.404 em 24 h | ficha | — |
| **Ficha do cliente** (JOTA 12, +MIX) | Data Lake (GitHub 03h) | `ficha_cliente` | 1x/dia | ❌ **08/11** | — | — (corrigido hoje) |
| Prospects | `ceven/prospeccao-roteiro` | `prospects_mapa`, `prospects_coleta_status` | 09h30/12h30/15h30 | ⚠️ 493 vendedores com pontos; estados de hoje: 0 (antes das 09h30) | cadastros/LinkUp | — |
| +MIX | Data Lake + `roteiro-mes` | `public/dados_mix.json` | 1x/dia (02h) | ✅ dados até 10/11 | — | — |
| Árvore / Gestão de Equipe | `gerente/tabelas-cascata` + Gestão | `arvore_supervisores`, `config_equipe_soberana` | contínuo | ✅ 08h36 | divergências na Gestão | — |
| RET / compromisso | `admin/supervisores/matriz-*` | `supervisores_dia` | 5–15 min | ✅ 08h37 | — | — |
| Indústrias (meta, faturado, carteira, positivação) | **GEROT** (Extrair dados) | `gerot_vendas` | 07h15…19h15 | ✅ 08h22 | CEVEN Premiação | — |
| Recorrência (meta 80%) | **GEROT** (tela Recorrência) | `gerot_recorrencia` | idem | ✅ 08h24 | TAG do CEVEN | — |
| Liga (lances) | D1 (lances do coletor) | `tv_lances`, `liga_fechamento` | 5 min; fecha 19h30 | ✅ 35 lances hoje; 10/11 fechado 22h04 | `auditoria_lance_*` | — |
| Mapa executivo | `historico-cliente` | `mapa_executivo_live` | 5 min | ❌ **parado desde 24/10** | — | lido por `/api/mapa-executivo-live` |
| KPIs do radar | antigo | `rca_kpis` | — | ❌ **parado desde 24/09** | — | ainda lido por `flash-alerts`, `ia-whatsapp`, `inteligencia-gerencial` |

Rodadas da varredura central: 14 por hora (média 146 s cada), 778 chamadas OK, 0 bloqueios (429), 3 falhas na última hora.

## 3. GEROT x CEVEN (mês de novembro, 11/11 08h40)
| Filial | Meta CEVEN | Meta GEROT | Dif. meta | Faturado CEVEN | Faturado GEROT | Dif. faturado |
|---|---|---|---|---|---|---|
| ABC | 6.290.000 | 6.366.980 | +76.980 (1,2%) | 616.631 | 609.764 | −6.867 (−1,1%) |
| API | 6.960.000 | 6.960.000 | 0 | 998.140 | 975.676 | −22.463 (−2,3%) |
| MCD | 9.166.987 | 9.680.000 | **+513.013 (5,6%)** | 271.199 | 259.230 | −11.969 (−4,4%) |
| TBE | 7.400.000 | 7.400.000 | 0 | 612.461 | 537.022 | **−75.438 (−12,3%)** |
| TBL | 4.762.500 | 4.950.000 | +187.500 (3,9%) | 600.739 | 596.938 | −3.802 (−0,6%) |
| TCA | 6.330.000 | 6.893.118 | **+563.118 (8,9%)** | 643.655 | 761.985 | **+118.331 (18,4%)** |
| TCG | 5.600.000 | 5.600.000 | 0 | 48.942 | 44.478 | −4.465 (−9,1%) |
| TCV | 6.650.000 | 6.692.629 | +42.629 (0,6%) | 704.165 | 684.183 | −19.983 (−2,8%) |
| TPA | 6.775.134 | 6.800.000 | +24.866 (0,4%) | 381.601 | 179.969 | **−201.631 (−52,8%)** |
| TPH | 10.618.683 | 11.004.770 | **+386.087 (3,6%)** | 1.091.756 | 979.322 | **−112.434 (−10,3%)** |
| TSJ | 8.605.000 | 8.600.000 | −5.000 | 713.775 | 703.733 | −10.041 (−1,4%) |
| **Total** | **79.158.304** | **80.947.497** | **+1.789.193 (2,3%)** | **6.683.064** | **6.332.301** | **−350.762 (−5,2%)** |

- Meta: em 31/10 a diferença era só R$ 36 mil (BASE_UNICA). Agora há metas de indústria no GEROT sem par no CEVEN (MCD, TCA, TPH, TBL).
- Faturado: parte é horário (o GEROT carrega em janelas; o CEVEN é ao vivo). TPA −53% e TCA +18% não se explicam só pelo horário: o GEROT tem 45 vendedores na TPA contra 64 no CEVEN.
- **Hoje ninguém grava essa comparação.** O painel das indústrias mostra GEROT x CEVEN na hora da pergunta, mas não fica histórico nem alarme.

## 4. O que já foi corrigido hoje (11/11)
1. **Data do pedido na origem** (`functions/_lib/pedido_status.js`): data da visita futura nunca vira data do pedido; fica sem data até o Winthor informar. Limpeza: consulta do pedido pelo número no Winthor, toda rodada, antes da leitura do Winthor; a rodada grava quantos faltam (`contagem.datas_por_numero.faltam`).
2. **Ficha do cliente** (`scripts/carregar_ficha_d1.py`): prospects incompletos não travam mais a ficha. Prospects continuam só para quem tem estado do dia.
3. **GEROT às 07h15** (antes começava às 09h15).

## 5. Plano (proposto) — em ordem de impacto
| # | Problema | Ação | Onde |
|---|---|---|---|
| 1 | Digitado do dia atrasado (JOTA "quanto vendi hoje", TV, Liga) | Digitado do dia = soma dos pedidos do dia em `pedido_status` (pedido real, número e valor), conferido com a produtividade; a produtividade vira conferência, não fonte | JOTA (`escopo.js`), TV, `cron-lances` |
| 2 | Pedido do dia que só aparece tarde | Winthor do dia: quem teve pedido novo no detector vai primeiro na fila (hoje é rodízio por antiguidade, 5 por rodada) | `cron-varredura-central.js` |
| 3 | Roteiro/visitas dependem da cota `/api/rca` | Usar a rota do gerente (`rota_gerente_dia`, cota própria, 1 chamada por supervisor) como fonte do check-in; a leitura individual vira plano B | coletor + leitores |
| 4 | GEROT x CEVEN sem registro | Conferência diária gravada (filial × vendedor × indústria: meta, faturado, positivação) às 07h30 e 19h30, com aviso quando passar de 2% | nova tabela `conferencia_gerot_ceven` |
| 5 | Tabelas paradas sendo lidas | `mapa_executivo_live` (24/10) e `rca_kpis` (24/09): religar a partir do D1 ou tirar dos leitores (`flash-alerts`, `ia-whatsapp`, `inteligencia-gerencial`, `mapa-executivo-live`) | — |
| 6 | Robô que para sem ninguém saber | Painel de frescor único (cada tabela: última atualização, quantidade do dia, limite aceito) e aviso no WhatsApp do Vitório quando passar do limite | `/api/saude` + `cron-varredura-central` |
| 7 | Lance que não nasce por dado atrasado | Reparo diário da Liga depois que o Winthor fecha o dia (já existe `liga-repara-pedido`; tornar automático às 06h, em ensaio, com relatório) | `liga-repara-pedido` |

## 6. Decisões do Vitório pendentes
1. Item 1: o digitado do dia passa a ser a soma dos pedidos do D1 (com o número de cada pedido), e a produtividade vira conferência?
2. Item 4: qual a fonte oficial quando GEROT e CEVEN divergem — meta (hoje: CEVEN para filial/vendedor, GEROT para indústria) e faturado?
3. Item 5: religar ou desligar o mapa executivo e o radar antigo?

## 7. GEROT x CEVEN um por um (11/11, 09h)
**Meta** (571 vendedores): **375 iguais**. A diferença de R$ 1,79 mi tem 3 causas, todas medidas:
1. **12 vendedores que saíram da árvore do CEVEN no meio do mês** (9 depois de 09/11; MCD 426/428 e TPA 1077 no início): somam **R$ 1,63 mi** de meta. No último dia em que apareceram, a meta deles no CEVEN era **igual** à do GEROT. O GEROT mantém meta e faturado do mês; a nossa soma da filial (só quem está na árvore hoje) perde os dois. Ex.: TCA 402 Maycon Barboza, meta R$ 250 mil e **R$ 135 mil já faturados** (explica quase toda a diferença de faturado da TCA).
   - MCD 428 Gabriela Vieira Lopes 574.748 · TPH 56 Marco Aurélio Zirhut 315.975 · TCA 402 Maycon Barboza 250.000 · TBL 171 Almir Rogério de Oliveira 187.500 · TCA 1028 Adevane Bandeira 110.000 · TCA 1051 Cristina da Conceição 50.000 · MCD 426 Franciele Brunetto 43.000 · TPH 105 Giulia Teixeira 35.898 · TPA 1077 Bruno Spengler 24.866 · TPH 110 Marcos de Viveiros 16.239 · TPH 76 Arthur Germano 13.273 · TPH 95 André Fernandes 3.795.
2. **4 vendedores com diferença grande**: TCA 399 (+79.835), ABC 210 (+73.857), TCA 401 (+72.481) — mais meta de indústria no GEROT do que a meta total do CEVEN; MCD 423 (CEVEN 104.735, GEROT 0).
3. **~90 vendedores com R$ 0 a R$ 2 mil** (quase todos TCV): soma das metas por indústria do GEROT com centavos/arredondamento.

**Faturado**: horário da carga do GEROT (2 em 2 h). Ex. TPA 134 Anderson: R$ 101 mil viraram faturado às 21h36 de 10/11, depois da última carga. TPA 143 Silvia (CEVEN 90.911 x GEROT 1.776) **sem explicação ainda**.

## 8. Plano de execução (aprovado pelo Vitório em 11/11: "OK para tudo")
| Fase | Entrega | Para quê | Pronto quando |
|---|---|---|---|
| 0 | Publicar data do pedido na origem + ficha destravada | dados de pedido e ficha certos | `futuro` = 0 e `ficha_cliente` de hoje |
| 1 | **Digitado do dia = pedidos gravados** (número + valor) no JOTA e na TV; produtividade vira conferência | vendedor vê o que vendeu na hora | soma do D1 = CEVEN na conferência das 22h37 |
| 1 | **Fila do Winthor: quem teve pedido novo primeiro** | pedido de hoje entra em minutos, não horas | atraso medido < 30 min |
| 2 | **Conferência GEROT x CEVEN gravada** (07h30, 19h30): filial × vendedor × indústria; cada diferença com a causa (saiu da árvore, horário da carga, arredondamento, **sem explicação**); aviso > 2% | "entender um por um" todo dia, sem depender de alguém pedir | relatório no WhatsApp do Vitório |
| 2 | Coletor do GEROT grava o **horário da carga** do GEROT | separar diferença de horário de diferença real | `gerot_coleta_status.carga` preenchido |
| 3 | Rota do gerente como fonte do roteiro/check-in (individual = plano B), depois de 1 dia comparando | check-in em tempo real sem a cota `/api/rca` | `/api/frescor` igual por 1 dia |
| 4 | Painel de frescor + aviso no WhatsApp do Vitório quando um dado parar | ninguém descobrir parada por acaso | aviso testado |
| 5 | Reparo da Liga às 06h (ensaio + relatório; grava só com OK) | lance que não nasceu por atraso é recuperado | relatório diário |
| 6 | Tabelas paradas (`mapa_executivo_live`, `rca_kpis`): religar ou tirar dos leitores | nenhuma tela com dado velho | nenhum leitor de tabela parada |
