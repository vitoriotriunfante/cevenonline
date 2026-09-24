# CEVEN — Regras para o Claude (leia antes de mexer em qualquer coisa)

Este repositório tem **dois projetos independentes** que compartilham os mesmos dados. **Nunca misturar.** Antes de editar, descubra a qual projeto o pedido pertence. Se não estiver claro, pergunte.

## Projeto A — CFTV Matrix (TV + celular)
Central visual ao vivo das 11 filiais: link por filial/gerente, link central (matriz), ronda entre vendedores mostrando **as informações mais importantes** (não a tela do CEVEN), alertas por gatilho, e versão para celular.
- **Pertence a este projeto:** `public/` (index.html, mobile.html), `server.js`, `INICIAR_CFTV.bat`, `functions/api/` **exceto** `whatsapp/` e `cron-*`, `docs/CFTV_*`.
- **Branch de trabalho:** `cftv`.
- **Como publica (confirmado 23/09/2026):** o Cloudflare Pages `ceven-cftv-matrix` **NÃO está ligado ao Git** (Git Provider = No). A publicação é **manual**, pelo terminal, na pasta do projeto: `npx wrangler pages deploy public --project-name ceven-cftv-matrix --branch main --commit-dirty=true`. A produção do Pages é a branch **`main`** (parâmetro `--branch`). Dar push no GitHub **não** atualiza o site. Publicar só quando o Vitório mandar.
- **Links da TV:** `https://ceven-cftv-matrix.pages.dev/tbl` (curto, um por filial: /tbl /tph /tcv /abc /tca /mcd /tcg /api /tbe /tpa /tsj) ou `/?filial=TBL`; ambos levam à tela nova `/tv`.
- **Link travado (decisão do Vitório, 23/09/2026):** cada filial/gerente tem um link específico que fica **fixo na TV**. **Ninguém troca de filial** nessa tela: sem seletor de filial nem login de escolha. Só se ajustam os botões **internos** daquela filial (ex.: tempo da ronda, layout, vendedores da ronda). Só o link central (matriz) enxerga várias filiais.
- Documento de referência: `docs/CFTV_MATRIX_VISAO_E_ESTADO_ATUAL.md` (atualizar a cada decisão).

## Projeto B — WhatsApp (disparos automáticos)
Ciclos 04:00 / 07:45 / 10:00 / 11:30 / 14:30 / 17:00 / 18:30 para Vitório e 14 gerentes. **Roda em produção a partir da `clean-v3` via GitHub Actions — qualquer commit lá pode afetar envios reais.**
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
