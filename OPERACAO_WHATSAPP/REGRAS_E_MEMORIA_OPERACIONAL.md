# Memória Operacional — Disparos WhatsApp CEVEN NOC

> Documento vivo. Atualizar sempre que uma regra for validada, um horário mudar, ou um bug for corrigido.
> Fonte de código: `pipeline/ceven_unified_engine.js` (Sistema A — único confirmado ativo, via `.github/workflows/ceven-cron-whatsapp.yml`).
> Última atualização: 22/09/2026.

---

## 1. Status atual (o que funciona, o que não funciona)

| Ciclo | Horário | Status | Motivo |
|---|---|---|---|
| Aquecimento | 04:00 BRT | ⚠️ Roda mas não é útil | Cache gerado não é commitado (mesmo bug do item 2) |
| Abertura | 07:00 → **mudando para 07:45** | 🔴 Quebrado | Depende da árvore de hierarquia que não existe no runner (ver seção 2) |
| Vendas/Zerados | 11:00, 14:30, 17:00, 18:30 | 🔴 Quebrado | Mesmo motivo acima |
| Gestão de Campo | 11:30 | 🟢 Funciona | Não depende da árvore de hierarquia (busca direto do CEVEN) |

## 2. BUG RAIZ — pendente de correção (aprovado, ainda não implementado)

`scripts/supervisores_11_filiais_completo.json` (gerado por `scripts/atualizar_arvore_viva_11_filiais.js`) é a fonte da hierarquia vendedor→supervisor→gerente. Ele:
- Existe localmente (gerado manualmente por Vitório de vez em quando)
- **Nunca é commitado** porque `.gitignore` linha 11 tem `scripts/` (ignora a pasta inteira)
- No runner do GitHub Actions, portanto, não existe → `carregarValidacaoVendedores()` retorna mapa vazio → todo ciclo que depende dele processa zero vendedores

**Correção combinada (ainda não aplicada):**
1. Rodar `atualizar_arvore_viva_11_filiais.js` no ciclo 04:00 e commitar o JSON de volta ao repo (mesmo padrão já usado hoje pro `dados_abertura_matinal.json`)
2. Abrir exceção no `.gitignore` só pra esse arquivo (não liberar `scripts/` inteiro)
3. Credenciais de login por gerente (`password: 'abc123'`, hardcoded no script) — confirmadas válidas por Vitório em 22/09/2026

## 3. Fontes de dados reais descobertas (não usar dado inventado quando essas existirem)

| Dado | Endpoint | Observação |
|---|---|---|
| Canal real do vendedor (V/A/E/F/G/P/Q/S) | `GET /api/filiais/{filialKey}/representante/{id}` → campo `area_atuacao` | Confirmado ao vivo: RCA 433 (MCD) = "ESP", bate com o painel do CEVEN. Ainda não integrado ao motor (hoje `canal: 'VJ'` é hardcoded pra todo mundo). |
| Prospecção real por CNAE | `GET /api/ceven/prospeccao-roteiro?cod_rca={id}&hoje=1&max=120` | Endpoint assíncrono — primeira chamada retorna `{"status":"processando"}`, precisa fazer polling até `{"status":"pronto", perfil_cnae:[...], prospects:[...]}`. Traz CNAE real da carteira do vendedor + prospects reais próximos (CNPJ, endereço, telefone, e-mail, aderência). Ainda não integrado — hoje a "Oportunidade no Mapa" da abertura é uma estimativa fake (`visitas × ratio fixo por filial`). |

## 4. Códigos de canal do CEVEN (área de atuação)

```
A - AS
E - ESP
F - FARMA
G - GER   (excluir de contagem — não é vendedor)
P - PET VJ
Q - PET AS
S - SUP   (excluir de contagem — não é vendedor)
V - VJ
```

## 5. Mapeamento Gerencial Forçado (Sub-Gerências MCD e TPH)

Fonte: `REGRAS_DE_NEGOCIO_CEVEN.md` seção 9, implementado em `extrairGerente()` no motor. **Validado e já correto no código** (conferido linha a linha em 22/09/2026).

### Filial MCD
- **Gerente Cleverson**: THIAGO DA SILVA CONEGUNDES, FLAVIO RUFINO, JONATAS DA SILVA DE OLIVEIRA
- **Gerente Adriano**: ALYFER PEREIRA MENDES, CARLOS ALAGUEZ DA SILVA, CLEOMAR DINIZ BARBOSA

### Filial TPH
- **Gerente Vagner Pflanzer**: LUCAS RAMOS MONTAGNHANI, ALLISON ANTONIO FAGUNDES M PINHEIRO, RODRIGO DE ARRUDA DARROS, ANDREY CAMILLO PIRAGINE, LUIZ AUGUSTO RAMOS, JEFFERSON POLETTO, CLAUDETE DE SOUZA SCHULTZ
- **Gerente Fábio**: AILTON LUIZ ARENDT JUNIOR, CRISTIAN EDUARDO RAFFAELLI, PRISCILA A D NASCIMENTO STRAPASSON, EDI CARLOS MEIRA, RODRIGO BERTONI, CLT VITOR MANUEL PAULOS CORREIA

**Nota (22/09/2026):** Bertoni (TPH) está inativo/removido — decisão do Vitório foi "esquecer dele", sem necessidade de mudança no código porque ele nunca teve WhatsApp cadastrado, e seu "setor" já cai automaticamente no default do Fábio (comportamento correto por acidente, mantido assim). "Fabio Colares" (nome visto numa tela de login do CEVEN) não existe em nenhum lugar do código — não é gerente do nosso `GERENTES_MAP`, não precisa de ação.

## 6. Regra de "PDV em Risco" (🔴 Última Chance / 🟡 Alerta Preventivo)

Implementado em `coletarAlertaRisco` / `formatarAlertaRiscoGeral` / `formatarAlertaRiscoGerente` (22/09/2026).

**Contexto de negócio:** rota é quinzenal (cada PDV é visitado ~a cada 15 dias). Reaproveita o mesmo critério de "inativo" já usado no resto do sistema (>30 dias sem compra), só reclassificado pela metade do mês:

- **🔴 Última Chance do Mês**: hoje é dia >15 do mês (2ª quinzena) E o PDV está há mais de 30 dias sem comprar → não vai ter mais visita este mês.
- **🟡 Alerta Preventivo**: hoje é dia ≤15 do mês (1ª quinzena) E o PDV está há mais de 30 dias sem comprar → ainda tem a 2ª visita do mês pela frente.

**Destinos:**
- Versão **GERAL** (agregada por filial, sem nomes) → só pro Vitório, no relatório das 07:45.
- Versão **por gerente** (aberta por supervisor, com lista nominal de cliente/vendedor/data última compra) → um relatório dedicado por gerente, friso 07:45/08:00 (ver seção 7).

**Bug corrigido (22/09/2026):** TBL e TPH têm gerente com nome idêntico "Fábio" — a lógica agrupava só pelo nome do gerente e misturava os dois. Corrigido agrupando por chave composta `SIGLA::gerente`.

**Pendente de validação:** hoje (22/09) é 2ª quinzena, então só dá pra testar o 🔴. O 🟡 só será validado de verdade rodando entre os dias 1-15 do mês.

**Suspeita aberta (RESOLVIDA em 22/09/2026):** muitos PDVs de MCD apareciam com "última compra: 04/12/2025" repetida. Confirmado pelo Vitório: **é dado real, não bug** — MCD é operação nova (começou a rodar no mês anterior), então é esperado ter muitos PDVs ainda sem primeira venda ou com última compra antiga. Métrica considerada confiável. Vale re-checar esse padrão em filiais mais antigas se aparecer volume parecido lá (não confirmado ainda se é só MCD ou generalizado).

## 7. Horários (em revisão — ainda mudando)

| Ciclo | Horário atual no código | Horário-alvo (em ajuste) | Destino |
|---|---|---|---|
| Aquecimento | 04:00 BRT | mantém | Nenhum (só gera cache) |
| Abertura | 07:00 BRT | **07:45 BRT** | Só Vitório |
| Alerta de Risco (novo) | não existe ainda | **07:45 BRT** (maioria) / **08:00 BRT** (TCA, TCG, MCD — 1h atrás de fuso) | Vitório (geral) + gerentes (por supervisor) |
| Vendas/Zerados | 11:00, 14:30, 17:00 BRT | mantém | Vitório (consolidado) + 14 gerentes |
| Gestão de Campo | 11:30 BRT | mantém | Vitório (consolidado) + 14 gerentes |
| Fechamento | 18:30 BRT | mantém | Vitório (consolidado) + 14 gerentes |

**Pendente de implementar:** split de horário 07:45 vs 08:00 pro Alerta de Risco por fuso (TCA/TCG/MCD ficam 1h atrás — no relógio BRT do workflow, isso significa disparar às 08:00 pra essas 3 filiais e 07:45 pras demais 8).

## 8. Ajustes de conteúdo já aplicados

- ✅ Corrigido rótulo "Total de Pedidos: R$ X" → "Total Digitado: R$ X" no bloco de ranking por filial do consolidado (`ceven_unified_engine.js:790`) — o valor sempre foi o faturamento digitado, só o texto estava errado.

## 9. Ajustes de conteúdo pedidos — status em 22/09/2026

Do relatório das 07:45 (abertura):
- [x] Tirar "CEVEN NOC" do título
- [x] Trocar cabeçalho da seção pra "📌 *PANORAMA GERAL*"
- [x] Canal real (`area_atuacao`) integrado — grupo Varejo = VJ+FARMA+PET VJ+ESP, grupo AS = AS+PET AS, excluindo SUP/GER/NULO. Aplicado em TODOS os relatórios do dia (zerados, cortes, alerta de risco), não só na abertura — decisão do Vitório em 22/09.
- [x] "Visitas Planejadas" em duas linhas: Total (todas as contas) e Varejo (canal real)
- [x] Bloco de filial separado em dois quando há 2 gerentes (MCD, TPH)
- [ ] **Pendente:** lista de exclusões de contas específicas — Vitório vai fornecer
- [ ] **Em andamento (22/09, rodando via nohup):** troca da estimativa fake de CNAE por dado real via `/api/ceven/prospeccao-roteiro` — amostragem completa de 284 vendedores válidos, um por vez (endpoint não suporta lote/paralelismo, é lento e não confiável em volume — ver seção 12). Depois de pronto, vira **cache semanal** (populado 1x, ex. segunda de manhã, reutilizado o resto da semana) em vez de recalculado a cada disparo.

Estrutural:
- [x] Implementado o Alerta de Risco (🔴/🟡) — hoje existe como script avulso de auditoria (`scripts/gerar_alerta_risco.js`), ainda não plugado no disparo automático do workflow
- [ ] Split de horário 07:45/08:00 por fuso (seção 7) — não implementado ainda
- [ ] Plugar o Alerta de Risco no `.github/workflows/ceven-cron-whatsapp.yml` como ciclo oficial

## 10. Ferramentas de auditoria criadas

- `scripts/gerar_auditoria_mensagens.js --hora=HH:MM` ou `--todos` — gera todas as mensagens de um ou todos os ciclos em arquivos `.txt` separados (consolidado + um por gerente), sem enviar nada, usando dado real do CEVEN. Saída em `auditoria_mensagens/<data>/`.
- `scripts/gerar_alerta_risco.js` — gera o Alerta de Risco (GERAL + um por gerente) na mesma pasta de saída.

## 12. Limitação real do endpoint de prospecção CNAE

`/api/ceven/prospeccao-roteiro` (assíncrono, `status: processando` → `pronto`) **não suporta chamadas em lote/paralelo de forma confiável** — testado com 6 em paralelo e travou (12 de 110 em 8 minutos). Hipótese: só processa rápido quando o próprio vendedor está logado no app naquele momento (gatilho client-side), não quando chamado em massa de fora. Solução adotada: processar sequencialmente (1 por vez, sem paralelismo), aceitar que é lento, rodar 1x por semana e cachear (não recalcular a cada disparo).

## 13. Arquivos de validação por horário

Pasta `OPERACAO_WHATSAPP/relatorios_por_horario/` — cópias em `.md` dos relatórios gerados para o Vitório aprovar ciclo por ciclo, nomeadas `<horario>__<destinatario>.md`. Ex: `07_45__VITORIO.md`, `07_45__GERENTE_MCD_Cleverson.md`.

**Observação aberta:** TPA tem 2 números de gerente cadastrados no `GERENTES_MAP` (Radke e Leandro), mas ao contrário de MCD/TPH não tem regra de sub-gerência por supervisor no código — os dois números hoje recebem o mesmo texto consolidado da filial inteira (não dividido). Perguntar ao Vitório se isso é intencional (ambos co-gerenciam igualmente) ou se TPA também precisa de divisão por supervisor como MCD/TPH.

## 14. Frente nova: Marca Própria (ciclo 10:00) + correção do histórico de pedidos

**Contexto (22/09/2026):** ciclo das 11:00 abandonado, substituído por um ciclo novo às 10:00 focado em Marcas Próprias (37 SKUs — Zipoca, Calira, Mitbit, Bellarone, Skive — arquivo `Produtos - Marcas Exclusivas.xls`). TBE e TCG não vendem nenhuma marca própria (fora do envio). ABC só tem 1 marca (Bellarone) — cobrar mais dele por ter só 1, não tratar com pena.

**Fonte de dado real confirmada:** `historico-cliente` já retorna item a item (`skus_winthor`/`skus` com `codprod`), então dá pra cruzar com os 37 CODPROD de marca própria sem precisar de endpoint novo. Protótipo em `scripts/prototipo_marca_propria.js` já validado com dado real de 22/09 (R$ 1.924,13 faturado, 26 PDVs positivados, ranking por marca: Bellarone > Mitbit > Skive > Calira).

**Vitório pediu: sem ranking por ora** (só visibilidade), formato ainda em definição.

**BUG RAIZ ENCONTRADO em `analises/extrair_historico_completo_11_filiais.js`:** o script só processa cada cliente UMA VEZ NA VIDA (linha `jaProcessados` filtrava clientes já com histórico salvo, pra nunca mais atualizar). Corrigido em 22/09 removendo esse filtro — agora reprocessa todos sempre, seguro porque o insert é `INSERT OR REPLACE` pela chave (filial+cliente+num_pedido).

**Rodada de correção em andamento (22/09, iniciada ~16:28):**
- Roda LOCALMENTE via `nohup` em `analises/extrair_historico_completo_11_filiais.js` (log: `analises/extracao_completa.log`), escrevendo em `analises/pedidos_historico_ceven.db`
- Etapa 1 (recoleta de clientes por filial): concluída, 43.319 clientes
- **CONCLUÍDO 100% em 22/09/2026**: 44.282 clientes, 106.260 pedidos, 2.378.509 itens vendidos, 168.086 itens cortados, R$ 172,6 milhões faturado, ZERO erros. Planilha gerada em `analises/AUDITORIA_COMPLETA_11_FILIAIS.xlsx`.
- **Bug de performance encontrado e corrigido durante a execução**: o `fetchJson` original relava no timeout nativo do `https.get`, que às vezes nunca disparava (trava real, CPU 0s, sem view de erro). Corrigido com trava de timeout forçada via `Promise.race` (independente do timeout do axios/https) — ver função `comTimeoutForcado` no script. Timeout ajustado pra 6s (esse endpoint responde em <1s no caso normal, diferente do prospeccao-roteiro) e concorrência subiu de 8 para 16, o que acelerou o ritmo em ~7x (de 6,6/min pra ~45/min em média).
- **Próximo passo:** migrar essa rotina pro GitHub Actions (rodar toda noite às 03h-04h, não depender da máquina do Vitório ligada)
- **É um processo LOCAL — morre se a máquina for desligada/hibernar.** Vitório avisou que vai fechar a máquina; combinado que ele avisa quando religar pra eu retomar
- **Retomar é seguro**: como o insert é idempotente por chave, basta rodar o script de novo do zero (ele vai reprocessar tudo de novo, ~10-14h) ou, melhor, adaptar pra continuar de onde parou (verificar último cliente processado)

**Decisão arquitetural pendente:** isso precisa rodar automaticamente às 03:00-04:00 TODA NOITE, o que exige migrar de "rodar local via nohup" pra "rodar no GitHub Actions" (nuvem, não depende da máquina do Vitório ligada) — hoje só está rodando local porque estamos em modo de correção pontual. Avaliar migração pro workflow `.github/workflows/ceven-cron-whatsapp.yml` (ou um novo workflow dedicado) quando essa base estiver estável.

## 15. Frente pausada: CNAE dinâmico via prospecção real

**Status:** abandonado temporariamente em 22/09/2026 após 6 estratégias diferentes falharem (paralelo, disparo em massa, sequencial simples, sequencial com timeout curto/longo, lotes de 10 com espera de 3min) — o processo trava sem aviso, CPU fica em 0s, nem timeout do axios dispara. Suspeita: contenção de rede por rodar 2 jobs pesados ao mesmo tempo na mesma máquina (não confirmado).

**Comportamento real do endpoint** (confirmado por print do app oficial do usuário): `/api/ceven/prospeccao-roteiro?cod_rca=X&hoje=1` cruza o roteiro com a base da Receita Federal, "pode levar alguns minutos na 1ª vez do dia" (por região/vendedor, aparentemente), depois responde em ~30s.

**Estratégia combinada com Vitório para retomar depois:** lotes de 10 vendedores — dispara os 10 (fire-and-forget), espera 3 minutos fixos, busca os 10 resultados, próximo lote. Script já implementado em `scripts/amostrar_cnae_nacional.js` com essa lógica. Rodar SOZINHO (não simultâneo com o job de histórico) na próxima tentativa, pra eliminar a variável de contenção de rede.

## 17. CNAE dinâmico — resultado real e regra de priorização

Amostragem completa concluída em 22/09/2026: **250 de 284 vendedores (88%)** com dado real via `/api/ceven/prospeccao-roteiro`, usando a estratégia de lotes de 10 (dispara → espera 3min → busca) — funcionou bem, ~93 minutos pro total. Resultado salvo em `auditoria_mensagens/2026-09-22/RANKING_CNAE_NACIONAL.json`.

**Ranking real (substituiu a suposição de que Restaurantes/5611 seria o principal — na real é só o 9º colocado):**
1. Comércio varejista de suvenires/bijuterias/artesanatos (4789) — 280 clientes
2. Padaria e confeitaria (4721) — 162 clientes
3. Atacado de alimentícios em geral (4639) — 132 clientes
4. Minimercados/mercearias (4712) — 126 clientes
5. Farmácias (4771) — 108 clientes
... (lista completa no JSON)
**Última posição (de propósito):** Tabacaria (4729) — apesar de ter o MAIOR volume (339 clientes), Vitório pediu pra colocar por último na priorização — não é CNAE de foco estratégico mesmo sendo o mais numeroso. Regra permanente: **nunca colocar Tabacaria no topo da lista de CNAE em foco**, mesmo que os dados digam que é o maior volume.

## 16. DIRETIVA DO VITÓRIO: "quero TUDO de todos os ENDPOINTS populado todo dia"

Isso não é uma correção pontual — é uma exigência estrutural recorrente (repetida "um milhão e 245 vezes" segundo o próprio Vitório). O banco `analises/pedidos_historico_ceven.db` tem ~27 tabelas, cada uma alimentada por um script Python/JS diferente, escrito em momentos diferentes, sem nenhum orquestrador único que rode todos todo dia. Resultado: cada tabela fica desatualizada de um jeito diferente, e cada vez que alguém precisa do dado, descobre a defasagem na hora, por acidente.

### Status de atualidade por tabela (checado e corrigido em 22/09/2026):

| Tabela | Status | Script responsável |
|---|---|---|
| `pedidos_historico` / `pedidos_historico_itens` | ✅ CORRIGIDO — até 22/09, 106.260 pedidos | `analises/extrair_historico_completo_11_filiais.js` — tinha bug de "só processa 1x na vida", corrigido; timeout blindado |
| `devolucoes_notas` / `devolucoes_itens` | ✅ CORRIGIDO — até 22/09, 2.533 notas, R$ 3.147.834,53 | `analises/extrair_tudo_devolucoes_cadastros.js` — não rodava desde 12/09, timeout blindado |
| `pdvs_roteiro_hoje_gps` | ✅ CORRIGIDO — até 22/09, 5.176 PDVs (estava 8 dias parado, até 14/09) | `analises/coletar_todos_os_pdvs_e_prospects_100pct.py` |
| `prospects_mapa_radar` | ✅ ATUALIZADO junto — 8.172 prospects únicos capturados | mesmo script acima |
| `rca_produtividade_live`, `rca_dashboard_financeiro_live`, `rca_ret_execucao_hoje` | ✅ CORRIGIDO — 449 vendedores atualizados (dependiam do `pdvs_roteiro_hoje_gps`, que estava travado) | `analises/extrair_produtividade_ret_dashboard_todos.py` |
| `cadastros_linkup` | ✅ NÃO ERA BUG — estava fresco o tempo todo (até 22/09). O diagnóstico anterior comparou a coluna `criado_em` (texto `DD/MM/AAAA`, ordena errado) em vez de `criado_em_data` (ISO). Corrigido o diagnóstico, sem mudança de código necessária. | `analises/extrair_tudo_devolucoes_cadastros.js` |
| `hierarquia_completa_ceven.json` | ✅ CORRIGIDO — regerado em 22/09, todas as 11 filiais, TPH agora com 14 supervisores/92 vendedores (cobre Vagner e Fábio) | `analises/extrair_hierarquia_completa.js` |
| `rca_segmentos` | ✅ CORRIGIDO — 565 RCAs, distribuição real de canal confirmada (313 VJ, 135 AS, 46 não informado, 40 SUP, 15 PET VJ, 7 GER, 5 ESP, 2 PET AS, 2 FARMA). Timeout blindado. | `analises/extrair_segmentos_rcas.js` |
| `rca_metas_dashboard` | ✅ CORRIGIDO — 565 RCAs, 442 com metas registradas. Timeout blindado. | `analises/extrair_metas_dashboard_rcas.js` |
| `metas_premiacao_rv_setembro`, `apuracao_premiacao_rv_setembro`, `metas_ticket_medio_mix` | ✅ CORRIGIDO — 4.650 / 2.506 / 2.506 registros. O sub-endpoint TM/Mix precisou de timeout maior (35s→60s, a fonte realmente demora). **Atenção:** nome da tabela é fixo "setembro" — mês que vem alguém precisa criar `_outubro` ou generalizar o script pra não hardcodar o mês | `analises/extrair_premiacao_e_ret_novo_har.py` |
| `rf_clientes_2026` | ✅ CORRIGIDO — fonte trocada da CSV antiga (que na real também era um export do WinThor, só chamada de "RF" por engano) pro `Cadastro clientes WinThor 2026-09-16.xlsx` que o Vitório forneceu, 58.318 clientes, 56.938 com lat/long válida. **Esse arquivo é um export manual do WinThor — não tem endpoint de API. Vitório precisa gerar um novo periodicamente e colocar na raiz do projeto.** | `analises/enriquecer_clientes_rf_e_gerar_mix.js` (linha `XLSX_PATH`) |
| `mix_aderencia_regional` | ⚠️ CONCEITO ERRADO, SUBSTITUÍDO — essa tabela agrupava "aderência" por CIDADE inteira, mas o CEVEN de verdade calcula por **raio de 3km ao redor de cada PDV** (aba "+MIX" do roteiro). Achado o endpoint real `POST /mixapi/mix/gap` (via HAR do app), que recebe `target_cnpj + universo_cnpjs (num raio) + cod_rca` e devolve gap de indústria/produto real com estimativa de impacto financeiro. Substituído por `mix_gap_real`: calcula o universo localmente (haversine, usando lat/long do cadastro WinThor) e chama o endpoint oficial pra cada PDV da rota do dia. Testado: 5.173 PDVs, 98,2% de sucesso (5.082 com gap real), 9,3 minutos. **Cuidado ao usar:** valores com `total_com_dados` baixo (1-2 clientes na amostra) geram extrapolações extremas — o próprio app avisa que a % é "calculada sobre vizinhos com histórico de compra", filtrar por amostra mínima (ex: `total_com_dados >= 5`) antes de usar em qualquer ranking. | `analises/gerar_mix_gap_real.js` (novo) |

### Scripts que compõem o pipeline diário completo (rodar nessa ordem):
1. `analises/coletar_todos_os_pdvs_e_prospects_100pct.py` (gera `pdvs_roteiro_hoje_gps`, base pra tudo abaixo)
2. `analises/extrair_produtividade_ret_dashboard_todos.py` (depende do 1)
3. `analises/extrair_historico_completo_11_filiais.js` (pedidos)
4. `analises/extrair_tudo_devolucoes_cadastros.js` (devoluções + linkup)

### Próximo passo real (não fazer sozinho sem alinhar): 
Consolidar os 4 scripts acima num único orquestrador que roda em sequência 1x por dia, e virar o job oficial do GitHub Actions das 03h-04h — em vez de continuar dependendo de alguém lembrar de rodar cada um manualmente.

## 11. Achados de segurança fora do escopo de WhatsApp (registrados aqui pra não esquecer)

- `GET /api/admin/supervisores` retorna os **hashes bcrypt de senha de todos os supervisores** na resposta — não deveria vir no payload público da API.
- Credenciais do CEVEN (admin e Evolution API key) estão hardcoded em `pipeline/ceven_unified_engine.js` — considerar mover pra variáveis de ambiente/secrets do GitHub Actions.
- `RETs/` (pasta na raiz do repo) contém PDFs nominais de processos trabalhistas (CLT) de pessoas reais — dado sensível de RH versionado no git, recomendado remover.
