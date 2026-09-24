# PREMISSA INEGOCIÁVEL — O PROJETO RODA ONLINE

> Definida pelo Vitório em 23/09/2026. Vale para TODO o projeto CEVEN várias telas (TV/CFTV, WhatsApp, apresentações, análises, planilhas, documentos) e para qualquer pessoa ou IA que trabalhe nele.

**Nada pode depender do computador do Vitório.** Dados, cálculos, publicação e execução vivem online:
API do CEVEN · Google Drive · Cloudflare (Pages, Functions, D1) · GitHub (código e Actions).

## Regras práticas
1. Nenhuma tela/rotina lê arquivo local. Fonte é sempre online.
2. Nenhuma rotina precisa que o PC esteja ligado.
3. Nova funcionalidade só entra se rodar 100% online. Se algo exigir o PC, é dívida: registrar abaixo e planejar como eliminar.
4. Segredos (senhas, chaves) ficam em secrets do Cloudflare/GitHub — nunca no código nem no PC.

## Dependências do PC que AINDA existem (dívidas a eliminar) — atualizado em 23/09/2026
| # | Dependência | Onde | Como eliminar |
|---|---|---|---|
| 1 | **Publicar a TV** ainda é manual (`node publicar_tv.js`). **Workflow pronto:** `.github/workflows/tv-deploy.yml` publica sozinho a cada push em `clean-v3`. **Falta 1 passo do Vitório:** criar um token do Cloudflare (Account > Cloudflare Pages > Edit) e gravar no GitHub como secret `CLOUDFLARE_API_TOKEN`. Depois disso, `publicar_tv.js` vira só emergência | `publicar_tv.js`, `.github/workflows/tv-deploy.yml` | Criar o token e o secret (ver passos no fim deste arquivo) |
| 2 | **Lista de vendedores da TV**: já existe `/api/tv-mostra` (lê o Drive online, parser testado). **Falta apenas o segredo `GDRIVE_SA_JSON` no Cloudflare** (chave da service account do Google). Enquanto faltar, a TV usa a cópia publicada (do PC) e mostra aviso na tela | `functions/api/tv-mostra.js`, `functions/_lib/xlsx_mostra.js`; fallback `gerar_mostra_tv.js` | Configurar o segredo: `npx wrangler pages secret put GDRIVE_SA_JSON --project-name ceven-cftv-matrix` (colar o JSON da chave) |
| 3 | Servidor local para testes/uso: `INICIAR_CFTV.bat`, `server.js` | raiz | Descontinuar; o oficial é o Cloudflare |
| 4 | Scripts de análise/coleta rodados à mão (`scripts/`, `analises/`) | várias | Migrar os que forem oficiais para GitHub Actions (já existem 3 workflows) |
| 5 | Cópia local da planilha precisa ser igual à do Drive antes de publicar | processo manual | Resolvido pelo item 2 |

## Já está online (ok)
- Disparos de WhatsApp: GitHub Actions (cron) + Cloudflare Worker gatilho.
- Dados da TV: chamados ao vivo pelas Functions do Cloudflare (`/api/tv-vendedor`, `/api/tv-supervisores`, `/api/tv-lances` com D1).
- Login de administrador do CEVEN: segredo do Cloudflare (não está no código da TV).

## Como ligar a publicação automática (1 vez, ~3 minutos)
1. Cloudflare -> ícone do perfil -> **My Profile** -> **API Tokens** -> **Create Token** -> **Create Custom Token**.
2. Permissão: **Account** -> **Cloudflare Pages** -> **Edit**. Account Resources: a conta do projeto. Criar e **copiar o token**.
3. Gravar no GitHub (escolha um): no PowerShell `"COLE_O_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN --repo vitoriobergamobrazil/cevenonline`, ou no site: repositório -> Settings -> Secrets and variables -> Actions -> New repository secret (nome `CLOUDFLARE_API_TOKEN`).
4. GitHub -> Actions -> **TV CFTV — Publicar no Cloudflare** -> Run workflow -> marcar **sincronizar_chave_drive** (copia a chave do Google que já está no GitHub para o Cloudflare; dispensa achar o arquivo .json).
