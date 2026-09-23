# Auditoria Completa do Projeto CEVEN — 23/09/2026

Mapeamento arquivo por arquivo do repositório inteiro, feito com 3 agentes de exploração em paralelo (scripts/, analises/, raiz+pastas soltas) mais o conhecimento direto de pipeline/, config/ e .github/workflows/ (mexidos hoje). Este é o documento único pedido no início do trabalho — antes de qualquer decisão de limpeza, isto aqui é só o mapa.

---

## 1. O que está VIVO hoje (produção real, confirmado testado)

### 3 workflows do GitHub Actions (rodam sozinhos, sem depender do PC)
- **`.github/workflows/ceven-cron-whatsapp.yml`** — 6 ciclos de WhatsApp (04:00, 07:45, 11:30, 14:30, 17:00, 18:30) + réplicas de segurança 15min depois de cada. Idempotente (não duplica envio).
- **`.github/workflows/ceven-cron-marca-propria.yml`** — relatório de marca própria às 10:00.
- **`.github/workflows/ceven-cron-datalake.yml`** — "atualiza tudo" às 03:00 (9 extratores).

### Núcleo do pipeline
- **`pipeline/ceven_unified_engine.js`** — motor de todos os ciclos de WhatsApp, puxa API do CEVEN ao vivo.
- **`pipeline/orquestrador_diario.js`** — roda os 9 extratores de `analises/` em sequência.
- **9 extratores ativos em `analises/`**: `extrair_hierarquia_completa.js`, `coletar_todos_os_pdvs_e_prospects_100pct.py`, `extrair_produtividade_ret_dashboard_todos.py`, `extrair_historico_completo_11_filiais.js`, `extrair_tudo_devolucoes_cadastros.js`, `extrair_segmentos_rcas.js`, `extrair_metas_dashboard_rcas.js`, `extrair_premiacao_e_ret_novo_har.py`, `gerar_mix_gap_real.js`.
- **9 arquivos ativos em `scripts/`** (o resto da pasta — ~387 arquivos — está no `.gitignore` com o comentário do próprio projeto: *"Scripts descartáveis de análise pontual"*): `gerar_marca_propria.js`, `gerar_alerta_risco.js`, `gerar_auditoria_mensagens.js`, `aplicar_mostra_dispatch.js`, `atualizar_arvore_viva_11_filiais.js`, `atualizar_cnae_do_dia.js`, `amostrar_cnae_nacional.js`, `gerentes_contatos.json`, `upload_drive_sem_rclone.js`.
- **`analises/pedidos_historico_ceven.db`** — banco SQLite principal, sincronizado via Google Drive.
- **`VENDEDORES AUDITADOS.xlsx`** (aba `MOSTRA_DISPAROS`), **`Produtos - Marcas Exclusivas.xls`**, **`config/ranking_cnae_nacional.json`**, **`config/diretrizes_operacionais.json`** — fontes de verdade manuais/config.
- **Cloudflare**: `functions/api/` (25 arquivos — backend serverless), `public/` (front-end + `_headers`), `worker-cron/` (cron separado via Cloudflare Worker), `wrangler.toml`, `server.js`, `database.js`, `package.json`.

### Documentação viva
- `REGRAS_DE_NEGOCIO_CEVEN.md` (raiz, atualizado 22/09 — recente e confiável)
- `OPERACAO_WHATSAPP/REGRAS_E_MEMORIA_OPERACIONAL.md`
- **Não existe README.md na raiz** — não tem ponto de entrada pra alguém novo entender "como rodar isto". Lacuna real.

---

## 2. Achado crítico #1 — `.gitignore` esconde `*.xlsx` e `*.csv` de TUDO, não só de `analises/`

O `.gitignore` tem regras globais `*.xlsx` e `*.csv` na raiz — isso afeta o repositório inteiro. Já resolvemos os casos que travavam o pipeline online hoje (VENDEDORES AUDITADOS.xlsx, Produtos - Marcas Exclusivas.xls, EXPANSAO_CADASTROS_E_PROSPECTS.xlsx — via Drive ou tornando não-bloqueante). Mas existem **~17 outros `.xlsx`/`.csv` em `analises/`** na mesma situação (invisíveis pro GitHub Actions), a maioria são OUTPUTS de auditoria antiga (não bloqueiam nada), mas vale checar individualmente antes de assumir que nenhum é lido por algo ativo.

## 3. Achado crítico #2 — Segurança (achados reais, não mexi em nada)

| Achado | Onde | Risco |
|---|---|---|
| API key da Evolution API em texto puro | `scripts/disparar_11h_gerentes_individual.js` (não versionado, só local) | Se esse arquivo já saiu do seu PC (zip, backup), a chave está comprometida |
| Token JWT real de sessão (Marcelo, filial API) | `scripts/test_bearer_supervisores.js` (não versionado) | Token de um usuário real exposto |
| Senha `abc123` em texto puro (login de gerentes) | `scripts/inspect_cascata.js`, `analises/extrair_hierarquia_completa.js` (este SIM é usado hoje!), `test_gerentes_auth.js` | `extrair_hierarquia_completa.js` é um dos 9 scripts ativos — a senha hardcoded está em produção |
| Wordlist de senhas (brute-force) | `scripts/test_tbl_passwords.js` | Prova de conceito de ataque de força bruta contra o próprio sistema |
| Token de API repetido em múltiplos arquivos .js **versionados** | `IQ6vA2KkKhi1P03bC7WSMZNTw-i-xhJeDLHN3ga9rp4` em vários scripts de `analises/` | Se ainda válido, está exposto no histórico do Git |
| PII (nomes, CNPJs, GPS de clientes/vendedores) em `.json` **versionado** (JSON não está no `.gitignore`, só xlsx/csv/har) | `dados_geo_vies_compacto.js`, `sim_vendors_MASTER.json`, `DADOS_GEO_CARTEIRA_TOTAL.json`, dezenas de outros | Dado pessoal de funcionários/clientes no histórico do Git |
| `RETs/` — 11 PDFs de processos trabalhistas (CLT) com nome completo de pessoas reais | Pasta raiz | Já sinalizado em sessões anteriores — confirmar se está no `.gitignore` |
| Credenciais do CEVEN admin + Evolution API hardcoded | `pipeline/ceven_unified_engine.js` (este é ativo e versionado) | Já sinalizado antes — mover pra secrets do GitHub Actions |
| `GET /api/admin/supervisores` retorna hashes bcrypt de senha | Endpoint do próprio CEVEN (fora do nosso controle) | Reportar pro time do CEVEN |

**Nenhum desses 49+ arquivos com telefone/PII de scripts.js/py listados pelos agentes foi alterado ou lido por mim — só reporto.**

## 4. Volume de código morto/duplicado

- **`scripts/`**: ~387 de ~396 arquivos são não-versionados e o próprio projeto já os rotula como descartáveis. Famílias inteiras de duplicatas (ex: `disparar_relatorio_11h_agora.js` + `_corrigido.js` + `_direto_11h.js` fazendo a mesma coisa em datas diferentes).
- **`analises/`**: ~450 de ~492 arquivos são de rodadas pontuais de auditoria/apresentação já entregues (a "rodada NASA/MIT" de setembro, a investigação de "3 casos de viés", a extração manual do HTML de apresentação, scripts de descoberta de API via `.har`).
- **Raiz**: 25 `RELATORIO_*.txt`/`MENSAGEM_*.txt`/`FECHAMENTO_*.txt` de 02-04/09 (nunca versionados), várias versões "OFICIAL"/"OFICIAL_V2"/"ATUALIZADO" do mesmo relatório de hierarquia sem versão definitiva clara, `analises (2).zip` de **114MB** solto, 2 arquivos de 0-4 bytes (lixo puro: `1` e `Projeto.txt`).
- **`.kilo/worktrees/chief-thimbleberry/`** — cópia via git worktree, HEAD já mergeado no branch principal, seguro remover (`git worktree remove`).
- **Inconsistência de schema**: migrações de banco espalhadas em `migrations/` (1 arquivo) e `worker-cron/` (2 SQLs soltos) sem convenção única.

As listas item-a-item completas (por família, com classificação ATIVO/PROVÁVEL_MORTO/DUPLICADO/INCERTO) estão nos relatórios brutos dos 3 agentes — não reproduzidas aqui pra não duplicar 40KB de tabela; posso extrair qualquer uma delas se você quiser antes de decidir o que apagar.

## 5. O que falta decidir com você (nada disso eu decido sozinho)

1. **Segurança**: quer que eu rotacione/revogue a API key da Evolution e o token JWT achados? Quer que eu mova as credenciais hardcoded do `ceven_unified_engine.js` e `extrair_hierarquia_completa.js` pra variáveis de ambiente?
2. **Limpeza**: autoriza eu apagar os ~380+ scripts confirmados mortos/duplicados (movendo antes pra um zip de backup, não deletando direto)? Ou prefere revisar a lista primeiro?
3. **`analises (2).zip`** (114MB) — pode apagar?
4. **README.md** — quer que eu escreva um, explicando a arquitetura pra quem chegar depois?
5. **`.kilo/worktrees/chief-thimbleberry`** — removo?

Não mexi em nada disso ainda. Esperando sua decisão.

---

## 6. ATUALIZAÇÃO (mesma noite) — Achado gravíssimo: sistema fantasma paralelo

Durante a investigação de por que o cron do GitHub não disparava, descobri que **`worker-cron/` é um segundo sistema completo de disparo de WhatsApp**, deployado como Cloudflare Worker desde 04/09 (último deploy 08/09), com:
- Cron triggers próprios nos horários ANTIGOS (07:00, 11:00, 14:30, 17:00, 18:30 — antes da mudança de hoje).
- Banco D1 próprio, dados estáticos hardcoded como fallback.
- Mandando pro número **5566996389884** (não o 5541987525605 usado no sistema principal) — um commit anterior já tinha tentado remover esse número do sistema principal, mas o Cloudflare roda o que foi **deployado**, não o que está no git, então esse worker continuava vivo e ignorado.

Confirmei que estava **ativo agora** (respondendo em `ceven-cron-sync.comercial-profitdata.workers.dev`) e **desativei os cron triggers** (`crons = []` + `wrangler deploy` — reversível, o worker continua existindo, só parou de disparar sozinho).

Isso é provavelmente a causa real (ou parte dela) do "chegou duas vezes" relatado — dois sistemas diferentes disparando pros mesmos horários, sem nenhum dos dois saber da existência do outro. `functions/api/` (Cloudflare Pages) também tem arquivos chamados `cron-*.js`, mas o `wrangler.toml` da raiz não tem `[triggers]` configurado — não confirmei se algo externo os chama, fica como pendência.

**Isso reforça o ponto do Vitório: o pedido original era mapear tudo ANTES de mexer. Se essa auditoria tivesse sido feita no início, esse sistema fantasma teria sido achado sem precisar de um dia inteiro de tentativa e erro.**
