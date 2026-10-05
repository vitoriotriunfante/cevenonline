# CEVEN — Regras para o Claude (leia antes de mexer em qualquer coisa)

Este repositório tem **dois projetos independentes** que compartilham os mesmos dados. **Nunca misturar.** Antes de editar, descubra a qual projeto o pedido pertence. Se não estiver claro, pergunte.

## 🔒 REGRA DE OURO — UMA BRANCH SÓ, COMMIT SEMPRE (Vitório, 29/09/2026)

**Incidente grave em 29/09/2026:** existiam 9+ branches locais divergentes (`main-real`, `cftv-triunfante`, `cftv`, `clean-v3`, etc., além de uma `main` órfã de outro projeto). Trabalho de uma sessão inteira (regras da liga do Brasileirão, pontuação por lance, aba de auditoria, endpoints de gestão de equipe) ficou preso em branches/stashes nunca mesclados e **sumiu do site publicado** quando outra sessão trouxe só parte de uma branch pra outra (cherry-pick seletivo). Recuperado na sessão seguinte, mas só porque o commit não tinha sido apagado — poderia ter se perdido de vez.

**Regras permanentes a partir de agora:**
1. **Existe UMA branch só: `main`.** Nunca criar `git checkout -b` pra "trabalhar em algo novo" — se precisar isolar um experimento, avisar o Vitório antes. Nunca deixar trabalho terminado só numa branch de feature.
2. **Todo arquivo criado/editado na sessão é commitado em `main` antes de a sessão terminar** — mesmo que incompleto, mesmo que ainda vá mudar. Um commit "wip: em andamento" é infinitamente melhor que um arquivo untracked que uma sessão futura pode apagar sem saber que existia.
3. **Antes de qualquer `git checkout`, `git merge`, `git reset` ou troca de branch:** rodar `git status` e, se houver algo untracked ou modificado que pareça trabalho recente do Vitório (não gerado automaticamente), **parar e perguntar antes de prosseguir** — nunca assumir que "deve ser lixo".
4. **Arquivos de configuração que o código lê de `public/` ou `config/` (ex.: `pontuacao_brasileirao.json`) são tão importantes quanto código — commitar sempre**, nunca deixar como untracked "por enquanto".
5. Se em algum momento voltar a existir mais de uma branch local com commits não mesclados, isso é uma emergência a resolver **antes** de qualquer outro pedido — não deixar acumular.

## 🌐 PREMISSA INEGOCIÁVEL — TUDO RODA ONLINE (Vitório, 23/09/2026)

**O projeto CEVEN várias telas roda ONLINE. Nada — nenhum dado, arquivo, cálculo, publicação ou execução — pode depender do computador do Vitório (nem de qualquer computador pessoal).**

- Dados vêm de fontes online (API do CEVEN, Google Drive, Cloudflare D1, GitHub) — nunca de arquivo local.
- Quem executa é a nuvem (Cloudflare Pages/Functions/D1, GitHub Actions) — nunca "rodar no PC".
- Se uma tarefa hoje exige o PC (rodar script, copiar planilha, publicar à mão), isso é uma **dívida a eliminar**, nunca um padrão a repetir. Não criar novas dependências do PC; se for inevitável, avisar o Vitório e registrar em `PREMISSA_ONLINE.md`.
- Ver `PREMISSA_ONLINE.md` (lista das dependências do PC que ainda existem e o plano para eliminá-las).

## Projeto A — CFTV Matrix (TV + celular)
Central visual ao vivo das 11 filiais: link por filial/gerente, link central (matriz), ronda entre vendedores mostrando **as informações mais importantes** (não a tela do CEVEN), alertas por gatilho, e versão para celular.
- **Pertence a este projeto:** `public/` (index.html, mobile.html), `server.js`, `INICIAR_CFTV.bat`, `functions/api/` **exceto** `whatsapp/` e `cron-*`, `docs/CFTV_*`.
- **Branch de trabalho:** `main` (única branch do repositório desde 29/09/2026 — ver Regra de Ouro acima).
- **Como publica (confirmado 23/09/2026):** o Cloudflare Pages `ceven-cftv-matrix` **NÃO está ligado ao Git** (Git Provider = No). A publicação é **manual**, pelo terminal, na pasta do projeto: `npx wrangler pages deploy public --project-name ceven-cftv-matrix --branch main --commit-dirty=true`. A produção do Pages é a branch **`main`** (parâmetro `--branch`). Dar push no GitHub **não** atualiza o site. Publicar só quando o Vitório mandar.
- **REGRA — TVs se atualizam sozinhas (Vitório, 23/09/2026):** toda mudança publicada tem que chegar sozinha nas TVs já conectadas. Por isso **publicar SEMPRE com `node publicar_tv.js "mensagem"`** (ou `PUBLICAR_TV.bat`), que troca a versão em `functions/api/version.js` automaticamente e faz o deploy. A `tv.html` consulta `/api/version` a cada 30 s e recarrega quando muda. **Nunca** publicar direto com `wrangler` sem trocar a versão. O diário/lances do dia ficam no navegador (localStorage) e sobrevivem ao recarregamento.
- **Estrutura da TV (23/09/2026):** `public/tv.html` = **casca** (iframe 100%; cuida de tela cheia, link lembrado e atualização automática) e `public/tvapp.html` = a **tela real**. A casca nunca navega, por isso a tela cheia do navegador não sai quando publicamos. Alterar a casca (`tv.html`) é raro e derruba a tela cheia uma vez; o dia a dia é só `tvapp.html`.
- **Quem aparece na TV = Gestão de Equipe (Vitório, 23/09/2026; reforçado em 05/10/2026: "esqueça a planilha"):** a fonte é a tela **Gestão de Equipe** (`/gestao-equipe`, D1 `config_equipe_soberana`, servida por `/api/tv-mostra`), com `mostra` = SIM/NÃO e o supervisor de cada vendedor. **A planilha `VENDEDORES AUDITADOS.xlsx` do Drive NÃO é lida por nada** e pode ser apagada. `publicar_tv.js` roda `gerar_mostra_tv.js`, que só tira a cópia de reserva `public/mostra_vendedores.json` da própria Gestão de Equipe ao vivo. Divergências com o CEVEN (vendedor que o CEVEN tem e a Gestão não tem) são decididas **dentro da Gestão de Equipe** (painel "Divergências com o CEVEN", modo Diretoria).
- **Meta do mês = PNA oficial (Vitório, 23/09/2026):** a meta de faturamento e de positivação da FILIAL é a do PNA, gravada em `public/metas_mes.json` (print do CEVEN 'Metas por filial'; setembro/2026). **Nunca** usar a soma dos vendedores exibidos como meta da filial. Nos meses seguintes o Vitório define como atualizar; se o mês do arquivo não for o mês atual, a TV cai para a soma dos vendedores e avisa no rótulo.
- **Subdivisões de filial (Vitório, 24/09/2026):** uma filial pode ser dividida por gerente no campo `grupo` de cada vendedor na Gestão de Equipe (hoje `VAGNER`/`FABIO` em TPH e `CLEVERSON`/`ADRIANO` em MCD). Toda tela usa a filial canônica (nunca a chave com underscore). **Divisão nova = só preencher o `grupo` na Gestão de Equipe, sem mexer em código.** Link por gerente: `/tv?filial=TPH&grupo=VAGNER`. A matriz mostra o subtotal por grupo. O WhatsApp (11:30, 14:30, 17:00, 18:30) também sai por gerente nessas filiais.
- **Links da TV:** `https://ceven-cftv-matrix.pages.dev/tbl` (curto, um por filial: /tbl /tph /tcv /abc /tca /mcd /tcg /api /tbe /tpa /tsj) ou `/?filial=TBL`; ambos levam à tela nova `/tv`.
- **Link travado (decisão do Vitório, 23/09/2026):** cada filial/gerente tem um link específico que fica **fixo na TV**. **Ninguém troca de filial** nessa tela: sem seletor de filial nem login de escolha. Só se ajustam os botões **internos** daquela filial (ex.: tempo da ronda, layout, vendedores da ronda). Só o link central (matriz) enxerga várias filiais.
- Documento de referência: `docs/CFTV_MATRIX_VISAO_E_ESTADO_ATUAL.md` (atualizar a cada decisão).

## Projeto B — WhatsApp (disparos automáticos)
Ciclos 04:00 / 07:45 / 10:00 / 11:30 / 14:30 / 17:00 / 18:30 para Vitório e 14 gerentes. **Roda em produção a partir da `main` via GitHub Actions (worker-cron dispara sempre `ref: main`) — qualquer commit lá pode afetar envios reais.**
- **Pertence a este projeto:** `pipeline/ceven_unified_engine.js` e demais `pipeline/`, `.github/workflows/`, `worker-cron/`, `OPERACAO_WHATSAPP/`, `functions/api/whatsapp/`, `functions/api/cron-*`, `scripts/` versionados, `docs/*WHATSAPP*`, `docs/JUSTIFICATIVAS_*`.
- **Não mexer nele durante trabalho de TV/celular.**

## Compartilhado (não alterar sem o Vitório pedir explicitamente)
`schema.sql`, `database.js`, `migrations/`, `config/`, `REGRAS_DE_NEGOCIO_CEVEN.md`, `MAPA_DEFINITIVO_ENDPOINTS_CEVEN.md`. Mudança de schema afeta os dois projetos.

## Regras invioláveis
1. **PROIBIDO inventar dado.** Nada de pedidos sintéticos, valores-padrão falsos, rateios proporcionais, horários ou rotas presumidos. Se a API falhar, mostrar "sem dado" — nunca um número plausível.
2. Hierarquia sempre bottom-up: Vendedor → Supervisor → Filial → Locomotiva (soma, sem rateio).
3. Só canais **V** e **P** entram em cobrança de rota/eficácia; **G** e **S** fora das médias; SKU **12229** sempre ignorado.
4. **MCD** e **TPH** têm 2 gerentes cada (ver `REGRAS_DE_NEGOCIO_CEVEN.md` §9).
5. Não commitar nem fazer push sem o Vitório pedir. Não apagar arquivos sem mostrar a lista antes.
6. Não expor credenciais em código novo; usar variáveis de ambiente.

## Como trabalhar
- Vitório fala português; responder em português, direto, sem repetir o que ele já decidiu.
- Antes de propor algo grande, ler o documento do projeto correspondente.
- Registrar decisões novas no documento do projeto (`docs/CFTV_MATRIX_VISAO_E_ESTADO_ATUAL.md` ou `OPERACAO_WHATSAPP/REGRAS_E_MEMORIA_OPERACIONAL.md`) para não perder histórico.
