# CFTV Matrix — Visão, Estado Atual e Próximos Passos

> Documento de continuidade. Criado em 23/09/2026 para que nenhuma sessão futura precise reconstruir o contexto.
> Atualizar sempre que uma decisão mudar. Documentos irmãos: `REGRAS_DE_NEGOCIO_CEVEN.md`, `MAPA_DEFINITIVO_ENDPOINTS_CEVEN.md`, `docs/DICIONARIO_CICLOS_WHATSAPP.md`, `OPERACAO_WHATSAPP/REGRAS_E_MEMORIA_OPERACIONAL.md`, `AUDITORIA_COMPLETA_PROJETO_23-09-2026.md`.

---

## 1. Visão (dita pelo Vitório em 23/09/2026)

O CFTV Matrix é a **central de monitoramento comercial ao vivo** das 11 filiais, pensada para ficar em TV/tela e alertar sozinha.

1. **Um link por filial / gerente** (modo TV travado na filial) **e um link central (matriz)** com todas as filiais.
2. Cada link **conecta na sessão do CEVEN e vai trocando (ronda) entre os vendedores** da filial, mostrando como a venda está.
3. **De tempo em tempo aparecem alertas** na tela.
4. **Os gatilhos são calculados dentro do próprio sistema** (não dependem de alguém olhar). Exemplos dados:
   - "Acabou de entrar uma devolução" → **notificar o vendedor**.
   - Evolução por hora: "às 08h: 0 pedidos, R$ 0 / às 09h: R$ 5.000 e 20 positivações / às 10h: R$ …, 4.000 positivações" — ou seja, **comparação entre snapshots horários** (delta).
5. Antes de evoluir: **documentar tudo** para não perder histórico de novo (este arquivo).

---

## 2. Arquitetura do CFTV hoje (o que existe no código)

### 2.1 Front-end — `public/index.html` (3771 linhas, arquivo único, Tailwind + Lucide)
- **Modo TV por URL:** `?filial=TBL` (11 siglas válidas: TBL, TPH, TCV, ABC, TCA, MCD, TCG, API, TBE, TPA, TSJ). Ativa `tv-mode-active`, esconde o login, mostra header "REC • CFTV AO VIVO", trava `lockedFilial` e **inicia a ronda automática** (`startPatrol`). *Este é o "link por filial" — já existe.*
- **Modo PC Master:** sem `?filial=`, abre um modal de login onde se escolhe filial (ou TODAS) e preset. *Este é o embrião do "link central".*
- `?theme=light|dark` força tema.
- **Matriz de câmeras** `#cftv-matrix`: cards por vendedor (`.cftv-card`), presets de grade `2x2`, `1+5` (1 master + 5), `3x3`, salvo em `localStorage.ceven_grid_preset`.
- **Ronda (patrol):** troca os vendedores exibidos a cada N segundos (`ceven_patrol_duration`, padrão 60s).
- **Radar por filial:** quais vendedores entram na ronda é escolhido em "Gerenciar Vendedores no Radar CFTV" e salvo em `localStorage` (`ceven_radar_reps_<FILIAL>`) — ou seja, **por navegador, não compartilhado**.
- **Atualização:** dados a cada 2 min (`init()` + `loadFlashAlerts()`); auto-reload da TV quando `/api/version` muda (checa a cada 30s).
- **Flash Alert modal:** lê `/api/flash-alerts?filial=` e mostra o 1º alerta (título, mensagem, impacto, drill-down de pedidos).
- Extras já presentes: sidebar de vendedores, envio de teste de WhatsApp (`/api/whatsapp/send-test`), resumo do dia (`/api/whatsapp/resumo-dia`), IA de WhatsApp (`/api/ia-whatsapp`), inteligência gerencial, radar horário (`/api/cron-radar-horario`).

### 2.1b Deploy publicado (link master provável) — `https://ceven-cftv-matrix.pages.dev/`
- Indicado pelo Vitório em 23/09/2026 ("achei o link master eu acho"). Confirmado por consulta: abre a **"CENTRAL MULTI-FILIAIS • 519 RCAs MONITORADOS"**, seletor "TODAS AS 11 FILIAIS (ROTATIVO)" + botões por filial, "Ronda Dinâmica: 43 RCAs em patrulha", presets 2x2 / 1+5 / 3x3.
- Links por filial seguem o padrão `https://ceven-cftv-matrix.pages.dev/?filial=TBL` (a testar uma a uma).
- `/api/version` respondeu `v2.17.0-blocked-orders-6x-daily-schedule`, status ONLINE.
- **Como o deploy funciona (corrigido em 23/09/2026):** o projeto Pages **não tem integração com Git**; cada publicação é manual via `wrangler pages deploy` (produção = `--branch main`; o histórico mostra deploys "Production / main" e um "Preview / clean-v3"). O que estava no ar antes (`v2.17.0-...`) veio de um deploy manual feito a partir da árvore local. Push no GitHub não publica nada. Comando em `CLAUDE.md`.
- **`/mobile.html` existe** em `public/mobile.html` (idêntico em `main` e `clean-v3`; correção: uma leitura anterior minha da pasta estava truncada e sugeriu que não existia). Hoje é uma **visão por vendedor (RCA)**, com seletor de vendedores da filial (ex.: RCA 193 · TBL), KPIs do dia/mês, roteiro e um "Copiloto IA" — **não** é uma visão por filial. Nasceu como "CEVEN Mobile Simulator" (commit e07f6ad).
- **Objetivo do celular (Vitório, 23/09/2026):** poder ver **qualquer filial** pelo celular → app novo/mobile-first (a `mobile.html` atual é ponto de partida, não o alvo).
- **Decisão de conteúdo (Vitório, 23/09/2026):** a ronda deve mostrar **as informações mais importantes** de cada vendedor/filial, **não** a tela do CEVEN. O isolador de sessões (§2.4) e iframes ficam **descartados/adiados** para a TV. A TV atual foi considerada visualmente ruim → **redesenho** é prioridade.
- **Ordem combinada:** 1º TV (redesenho) + celular; 2º gatilhos por horário; 3º WhatsApp ao vendedor. Enquanto isso, quem assiste à TV avisa o vendedor.

### 2.2 Dois backends para a mesma tela (atenção — divergem)
| | Local (`server.js`, Express :3000) | Nuvem (`functions/api/*`, Cloudflare Pages + D1) |
|---|---|---|
| Sobe com | `INICIAR_CFTV.bat` (`node server.js`) | `wrangler.toml` (`ceven-cftv-matrix`, `public/` como saída) |
| Dados | Chama o CEVEN ao vivo (6 endpoints por vendedor) | Chama o CEVEN ao vivo **e** lê o D1 (`rca_kpis`, `devolucoes_auditoria`, `pedidos_cortes`, ...) |
| `/api/flash-alerts` | **MOCK fixo** (1 alerta de "corte coletivo SNICKERS MARACUJÁ") | Consulta real ao D1 (cortes, zerados, devoluções) — `functions/api/flash-alerts.js` |
| Banco | `ceven_noc.db` (SQLite, `database.js` + `schema.sql`) | `ceven_noc_d1` (D1, mesmo schema + `migrations/`) |

### 2.3 Endpoints usados por vendedor (fonte de verdade: CEVEN)
`/api/rca/dashboard`, `/api/rca/produtividade`, `/api/rca/devolucoes`, `/api/rca/roteiro-hoje`, `/api/rca/roteiro-mes`, `/api/ceven/prospeccao-roteiro`; para histórico de pedidos/cortes: `/api/rca/historico-cliente/{id}`. Detalhes em `MAPA_DEFINITIVO_ENDPOINTS_CEVEN.md`. **A API só expõe por RCA individual — não existe endpoint consolidado de filial** (por isso o intraday varre 519 RCAs).

### 2.4 Isolador de sessões — `pipeline/proxy_ceven_isolator.js`
- Abre **40 servidores HTTP locais (portas 6101–6140)** que são proxies do CEVEN. Cada porta é uma **origem diferente** para o navegador → `localStorage`/cookies isolados → **várias sessões logadas do CEVEN ao mesmo tempo** (uma por vendedor/gerente) sem uma derrubar a outra.
- Remove `X-Frame-Options` e `Content-Security-Policy` (permite `<iframe>`), libera CORS.
- `/reset?to=/setup` limpa a sessão daquela porta.
- **É a base técnica do "link que vai trocando o CEVEN dos vendedores".**
- Está **acoplado ao `server.js`** por uma alteração **ainda não commitada** (comentário no código: "22 iframes persistentes"). O `index.html` atual **não tem nenhum `<iframe>`** — os cards são renderizados a partir de JSON da API. Ou seja: o mecanismo de iframes/isolador foi iniciado (provavelmente na sessão que se perdeu) mas **não está ligado à tela do CFTV**. **A confirmar com o Vitório.**

### 2.5 Fluxo de alertas que já existe (fora da tela)
- **WhatsApp por ciclos fixos** — `pipeline/ceven_unified_engine.js` (1618 linhas), disparado por `.github/workflows/ceven-cron-whatsapp.yml` (cron único `*/10 6-23 UTC seg-sex`, idempotente) e por `worker-cron/` (Cloudflare Worker só como gatilho externo). Ciclos: 04:00 aquecimento, 07:45 abertura, 11:30 gestão de campo, 14:30/17:00/18:30 vendas+zerados/fechamento. Envio via Evolution API, 14 gerentes, 30s entre envios. Ver `DICIONARIO_CICLOS_WHATSAPP.md`.
- **Snapshot horário** — `pipeline/3_sync_horario_intraday.js` varre 519 RCAs de hora em hora (09–18h), atualiza `rca_kpis`, detecta "pedidos desbloqueados, novas vendas, zerados" e consolida em `consolidado_executivo_live` (`pipeline/4_...`).
- **Radar horário** — `functions/api/cron-radar-horario.js` compara deltas e grava `flash_alerts` no D1 para as TVs.
- **Alerta WhatsApp de corte/devolução** — `functions/api/whatsapp/flash-alert.js` (POST, tipo `corte` | `devolucao`).
- **Gerentes** — tabela `gerentes_filiais` (`migrations/0003_gerentes_filiais.sql`; só TBL semeada) + `functions/api/whatsapp/gerentes.js`; contatos reais dos 14 gerentes em `scripts/gerentes_contatos.json` (usado pelo engine).

### 2.6 Modelo de dados (resumo — schema completo em `schema.sql`)
`filiais`, `representantes` (519 RCAs), `rca_kpis` (snapshot diário 30+ métricas), `consolidado_diario_filial`, `consolidado_executivo_live` (snapshot horário por filial + linha `GRUPO`), `clientes_historico_compras`, `pedidos_faturados_itens`, `pedidos_cortes_auditoria`, `devolucoes_auditoria`, `roteiros_visitas`, `flash_alerts`, `config_tv` (grid, rotação, intervalo/duração de alerta, tipos de alerta ativos: `corte_massa, zero_vendas, devolucoes, pex_perdido, meta_batida`), `gerentes_filiais`, entre outras.

---

## 3. Regras que valem para tudo (resumo — fonte: `REGRAS_DE_NEGOCIO_CEVEN.md`)
- **11 filiais** oficiais e **519 RCAs**; hierarquia Vendedor → Supervisor → Filial → Locomotiva é sempre **soma bottom-up** (sem rateio proporcional).
- **Canais (Cód. Área):** cobrança de rota/eficácia só em **V (VJ)** e **P (PET VJ)**; **G e S** (gerente/supervisor) ficam fora das médias; elegível = meta>0 e carteira/rota>0.
- **MCD e TPH** têm 2 gerentes cada (sub-gerências fixas na seção 9 das regras) — relevante para **"um link por gerente"**: nessas duas filiais o link por gerente **≠** link por filial.
- SKU **12229** (Batata Atlantic Especial KG) é sempre ignorado.
- **Proibido:** inventar pedidos, horários, rotas ou rateios; criar pedidos sintéticos.

---

## 4. Lacunas e riscos encontrados (não corrigidos — só registrados)

1. **`server.js` viola a regra "proibido inventar dado"** (`fetchVendorFull`): gera `pedidos_digitados_hoje` **sintéticos** (pesos fixos 35/25/18…, número `id000540+`, data fixa `'31/08/2026'`, mix de produtos fictício de um catálogo hardcoded), `prospects_rota` com texto e potencial fixos, `dias_sem_compra: 45` fixo para qualquer inativo, e **valores-padrão falsos** quando a API falha (meta 125.000, fat 105.000, pct 84…). O mesmo `/api/flash-alerts` local é um mock. A versão Cloudflare (`functions/api/`) precisa ser auditada para o mesmo problema antes de servir de base.
2. **Não existe motor de gatilhos no CFTV.** Os alertas de hoje ou são mock (local) ou vêm de dois mecanismos separados (radar horário → D1; ciclos do WhatsApp). Falta um **único** lugar que compare snapshots e emita eventos.
3. **Não existe "link por gerente"** — só por filial. E nada de "link central" dedicado (hoje é o modo PC Master com modal de login).
4. **Não há notificação ao vendedor.** O WhatsApp só chega ao Vitório e aos 14 gerentes; não há cadastro de telefone de RCA (`representantes` não tem telefone) nem regra de opt-in. Definir isso antes do gatilho "devolução → avisar o vendedor".
5. **Seleção de vendedores da ronda fica em `localStorage`** — cada TV precisa ser configurada à mão e não reflete o cadastro real.
6. **Dois backends divergentes** (local mock/real vs. Cloudflare D1). É preciso decidir qual é o oficial para a TV.
7. **Segurança** (detalhe em `AUDITORIA_COMPLETA_PROJETO_23-09-2026.md` §3): senha `abc123`, API key da Evolution e token JWT hardcoded; `/api/admin/supervisores` do CEVEN expõe hashes. Pendentes de decisão. O isolador expõe proxy do CEVEN em `0.0.0.0` (rede local) sem autenticação — restringir a `127.0.0.1` se a TV não for outra máquina.
8. **Alteração não commitada** em `server.js` (isolador + rota `/analises`) e vários arquivos soltos na raiz/`analises/` — ver `git status`.
9. **Sem README** na raiz (apontado na auditoria).

---

## 5. Proposta de próximos passos (para decidir juntos — nada disso foi iniciado)

1. **Validar o entendimento** deste documento com o Vitório (seção 6 tem as perguntas).
2. **Definir a fonte única** da TV (local ou Cloudflare) e **remover os dados sintéticos** do caminho da TV.
3. **Links:** `?filial=XXX` (já existe) + `?gerente=<id>` (com MCD/TPH por sub-gerência) + link central (`/` ou `?matriz=1`) com ronda entre filiais. Guardar a lista de vendedores da ronda no banco/JSON, não em `localStorage`.
4. **Motor de gatilhos:** uma função que recebe `snapshot_anterior` e `snapshot_atual` (por RCA e por filial, vindos de `rca_kpis` / `consolidado_executivo_live`) e devolve eventos tipados. Candidatos já citados:
   - **Devolução nova** (nota nova em `/api/rca/devolucoes` que não estava no snapshot anterior) → alerta na TV + aviso ao vendedor.
   - **Evolução horária** (pedidos/R$/positivações por hora, com delta vs. hora anterior e vs. mesmo horário de ontem).
   - Já previstos no `config_tv`: `corte_massa`, `zero_vendas`, `pex_perdido`, `meta_batida`.
   - Regra de idempotência igual à do WhatsApp (não repetir o mesmo evento).
5. **Exibição:** fila de eventos com prioridade, respeitando `intervalo_alerta_min` e `duracao_alerta_min` do `config_tv`.
6. **Ligar (ou descartar) o isolador de sessões** conforme a decisão sobre iframes (pergunta 3 abaixo).

---

## 5b. Plano de implementação (ordem combinada em 23/09/2026)

**Regra de acesso (Vitório):** cada filial/gerente recebe **um link específico**, que fica fixo na TV daquela filial. Ninguém troca de filial nessa tela; só ajusta botões internos da própria filial. O link central (matriz) é o único que enxerga várias filiais. Hoje o `index.html` permite trocar de filial pelo seletor `master-filial` mesmo em `?filial=`, o que precisa ser removido no modo TV.

1. **Redesenho da TV** (dados reais, ronda com as informações principais) — proposta em `docs/proposta_tv/proposta_tv_tbl.html`.
2. **Links travados por filial/gerente** (`?filial=`, depois `?gerente=`, respeitando MCD e TPH) + link central.
3. **App de celular** para ver qualquer filial (a `public/mobile.html` atual é visão por vendedor e serve só de ponto de partida; o app novo é mobile-first e por filial). Precisa ser definido como o celular respeita a regra de link travado.
4. **Gatilhos por horário** (motor único de eventos por delta de snapshot; devolução nova, evolução horária, zerados, etc.).
5. **Notificação ao vendedor por WhatsApp** (depende de cadastro de telefones; fora do escopo até lá — quem assiste à TV avisa).
6. **Limpeza do `server.js` local** (remover dados sintéticos e mock de flash alert) e definição do backend oficial da TV.

---

## 5c. Alertas de gravidade definidos pelo Vitório (23/09/2026)

Todos são **por estado** (calculáveis só com a leitura atual da API — não exigem histórico), por isso podem entrar na v1.

| Nível | Regra | Dado (endpoint `/api/rca/roteiro-hoje` etc.) |
|---|---|---|
| 🔴 **Pênalti gravíssimo** | Justificativa de visita sem venda **"ESTOQUE SUFICIENTE"** em cliente com **mais de 30 dias sem compra** | `motivo_nao_visita` + `hoje − data_ultima_compra` |
| 🔴 **Pênalti gravíssimo** | Justificativa **cliente fechado** em cliente com **mais de 30 dias sem compra** *(a confirmar qual motivo: "ESTABELECIMENTO TEMPORARIAMENTE FECHADO" e/ou "ENCERROU AS ATIVIDADES")* | idem |
| 🔴 **Mais que vermelho** | **10:00 (horário de Brasília)** e vendedor VJ com rota **sem nenhuma venda** | `digitacao_hoje`, `positivacao_hoje`, `roteiro_hoje` |
| 🔴🔴 **Ainda mais vermelho** | **10:00 (Brasília)** e vendedor VJ com rota **sem nenhuma visita feita** (todos os clientes ainda `AGENDADO`/`ABERTO`) | `roteiro_hoje[].status` |

Observações técnicas: o relógio da regra das 10h deve usar `America/Sao_Paulo` (não o horário do aparelho). `dias_sem_compra` não vem pronto: é calculado. O `roteiro-hoje` não traz o horário da visita, só o status e a duração (`tempo_visita`) — "sem visita às 10h" = nenhum cliente com status diferente de agendado/aberto.

**Layout combinado (a validar):** ~10 min de ronda dos vendedores (agrupados por supervisor, na v2), ~10 min de painel de alertas, alternando a partir das 08:00. Ideias para o painel: precisam de ajuda agora, placar por supervisor, pulso por hora (exige histórico de snapshots), devoluções/cortes do dia, comemorações (meta batida / primeira venda).

**Supervisor/gerente:** aparecem no app do CEVEN, mas não nos endpoints `dashboard`/`produtividade`/`roteiro`/`representante`. Fontes: `/api/gerente/supervisores` e `/api/gerente/supervisor/rcas` (exigem login de gerente) ou `scripts/supervisores_11_filiais_completo.json` (não versionado; teria de virar JSON estático versionado, atualizado diariamente).

---

## 6. Perguntas em aberto para o Vitório

1. A tela do CFTV deve continuar **desenhando os cards com dados da API** (como hoje) ou **embutir o próprio app do CEVEN em iframes** (uma sessão por vendedor, via isolador 6101–6140)? "Passando / trocando o CEVEN dos vendedores" quer dizer exatamente qual das duas?
2. Como cada vendedor entra no CEVEN nas sessões isoladas — login/senha por vendedor ou há um acesso de gerente que enxerga todos?
3. "Notificar o vendedor": por **WhatsApp** direto ao RCA? De onde vem o telefone dele?
4. **Link por gerente** = só filtro de filial, ou precisa respeitar as sub-gerências de MCD e TPH (e talvez supervisor)?
5. Onde a TV roda: **PC local** (`INICIAR_CFTV.bat`) ou **Cloudflare Pages**?
6. Quais gatilhos entram primeiro (ordem de prioridade)?

---

## 7. Como rodar hoje
- Local: `INICIAR_CFTV.bat` (mata `node.exe`, abre `http://localhost:3000`, roda `node server.js`, que também sobe o isolador nas portas 6101–6140). TV de uma filial: `http://localhost:3000/?filial=TBL`.
- Nuvem: `wrangler pages deploy` (saída `public/`, D1 `ceven_noc_d1`).
- Disparos automáticos: GitHub Actions (`.github/workflows/ceven-cron-*.yml`); branch de trabalho `clean-v3`.
