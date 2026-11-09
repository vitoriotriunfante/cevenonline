# GEROT — o que existe, o que falta e o plano (registro de 09/11/2026)

> Decisão do Vitório (semana de 02/11/2026): **indústria se responde pelo GEROT** (número oficial: metas por fornecedor, faturado, carteira, positivação, cortes, devolução). O CEVEN segue para o tempo real.
> Este documento existe porque o trabalho do GEROT foi feito entre 05 e 06/11 e **não foi registrado**. Toda mudança no GEROT se anota aqui.

## 1. O que é o GEROT
- Painel web interno: `https://gerot.triunfanteadmvendas.com.br:8009` (`/login` e `/painel`). Login por e-mail e senha (`#lgEmail`, `#lgSenha`, `#lgBtn`).
- Ao entrar, o painel **baixa ~430 MB** de dados para o navegador e monta a "Visão Geral". Tem o botão **"Extrair dados"** (exportação).
- Abas/dimensões: **Filial, Supervisor, Vendedor, Fornecedor, Cliente, Produto**; visões RESULTADO, COBERTURA (positivação), Mix por fornecedor.
- O GEROT atualiza em janelas de ~2 h (09h, 11h, 13h, 15h, 17h, 19h) — ver `docs/INTEGRACAO_CEVEN_GEROT.md`.

## 2. O que já foi feito (05–06/11/2026, no Antigravity)
| Peça | Onde | Situação |
|---|---|---|
| Robô de leitura (navegador automático com sessão salva) | `pipeline/extrair_filigrama_completo.mjs`, `pipeline/coletar_historico_oficial.mjs`, ~30 scripts em `scratch/` (`robo_gerot_persistente.mjs`, `baixar_excel_gerot.mjs`, `pegar_arcor_exato.mjs`...) | **Roda só no PC** (perfil em `scratch/perfil_gerot`). Viola a premissa online. |
| Extração de ago, set, out e nov/2026 | `pipeline/gerot_consolidado/gerot_2026-MM.json` | Cada dimensão **separada** (ranking com %), sem cruzar fornecedor × vendedor. Novembro parado em 05/11. |
| Carga no D1 | tabelas `gerot_historico_industrias`, `_filiais`, `_supervisores` (migration `0010`), carregadas por `migrations/popular_gerot_d1.sql` | **Carga única em 06/11 01:38**. Ninguém atualiza. Não tem vendedor nem indústria por filial. |
| Dicionário de marcas → razão social | `pipeline/dicionario_industrias.js` | Pronto (Condor → CONDOR SA, Baly, MP, Ypê, Bombril, Philips/Envision...). |
| Resposta do JOTA "Raio-X GEROT" | `functions/api/whatsapp/gerot_inteligencia.js` | Publicada em 09/11 09:36 e **desligada em 09/11 11:25**: casava a indústria errada (Condor → AEROFLEX) e chamava todos os meses de "Agosto". Religa com `GEROT_JOTA=1`, só depois dos testes da seção 5. |

**Segurança:** um script em `scratch/` tem o login do GEROT escrito no código. Precisa ir para segredo (GitHub Secrets) e sair do arquivo.

## 3. O que o Rudinei pede e o GEROT tem que responder
1. Venda de uma indústria (ex.: Condor) por **filial**, **supervisor** e **vendedor** — com **meta**, faturado, carteira, positivação.
2. **Mês escolhido** (outubro, novembro...), não sempre o mês atual.
3. **Vendedores com venda zero** daquela indústria.
4. Todas as filiais por indústria, incluindo as **indústrias novas** (TPA: Bombril, Philips/Envision).
5. Layout das sugestões dele (registradas no JOTA em 09/11 12:06 e 12:08): indicadores (meta, faturado, carteira, positivação) e listas numeradas.

## 4. Plano
1. **Coleta online** (GitHub Actions, sem PC): navegador automático entra no GEROT com o login em segredo, usa **"Extrair dados"** (linha a linha, já cruzado) e grava no D1 agregado por **mês × filial × fornecedor × supervisor × vendedor** (meta, faturado, carteira, positivação). Roda após cada janela do GEROT (09h15 ... 19h15). Grava só o que mudou (custo D1 = linhas gravadas).
2. **Resposta do JOTA nova**, lendo só essa tabela: entende indústria (dicionário), filial, mês e o recorte pedido (filial / supervisor / vendedor / zerados). Listas numeradas.
3. **Testes**: as perguntas reais do Rudinei de 05/11 e 09/11 viram casos fixos em `testes/` — nada é religado sem passar todos.

## 5. Testes obrigatórios antes de religar
- "como está a venda da industria condor da filial API" → Condor, API, mês atual.
- "venda de condor de api do mes de outubro" → outubro.
- "venda por supervisor e vendedor de condor de novembro, vendas e positivação, meta de cada vendedor e os com venda zero".
- "venda por industria de todas as filiais" → todas as filiais, todas as indústrias com meta.
- "CONDOR" sozinho (seguindo a conversa) → Condor no último recorte pedido.
- "resumo de como estão as vendas" → resumo geral (nunca procurar produto "Como").

## 6. Coleta online — construída em 09/11/2026
- Robô: `pipeline/gerot_coletor_online.mjs` (login por segredo, "Extrair dados" com Mês + Filial + Supervisor + Vendedor + Fornecedor e os cálculos de faturamento, devolução, positivação, meta e carteira; "Baixar Excel").
- Agenda: `.github/workflows/gerot-coleta.yml` — 09h15, 11h15, 13h15, 15h15, 17h15, 19h15, segunda a sábado; manual com "ensaio" (lê sem gravar) e escolha de meses (ex.: `2026-08,2026-09,2026-10` para o histórico).
- Gravação: `/api/gerot-carga` → D1 `gerot_vendas` (chave mês+filial+rca+fornecedor+supervisor; só grava o que mudou) e `gerot_coleta_status` (cada carga, com a posição do GEROT e as colunas que vieram).
- Prints e o Excel de cada rodada ficam 7 dias nos artefatos do GitHub (conferência).
- Falta: segredos `GEROT_EMAIL` e `GEROT_SENHA` no GitHub; 1º ensaio; carga do histórico; resposta do JOTA (seção 4, item 2).

## Histórico
- 05–06/11/2026: robô e carga única feitos no Antigravity (não registrados na época).
- 09/11/2026: resposta "Raio-X GEROT" publicada e desligada no mesmo dia; este documento criado.
