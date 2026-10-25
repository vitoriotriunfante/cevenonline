# Varredura geral do repositório — 25/10/2026 (noite)

Pedido do Vitório: "faz uma varredura geral em todos os arquivos, TODOS, todas as amarras, check redundâncias e tudo mais".
Método: script que lê os 741 arquivos rastreados no git e confere amarras (chamadas, imports, links, workflows), código morto, redundâncias, segredos e duplicados. Complementa `docs/MEGA_AUDITORIA_2026-10-25.md` (dados/custo).

## 1. Amarras — OK
| Verificação | Resultado |
|---|---|
| Telas/funções chamando endpoint que não existe | **0** (os 11 achados são rotas da API do próprio CEVEN e do app Mars Day, projeto à parte) |
| Links entre páginas quebrados | **0** |
| Workflows rodando script que não existe | **0** |
| Imports de arquivo inexistente | só em `scratch/` (remendos antigos que nunca rodam) |

## 2. 🔴 Segredos num repositório PÚBLICO (prioridade 1)
| Onde | O quê |
|---|---|
| 8 arquivos (`functions/_lib/arvore_ceven.js`, `ceven_auth.js`, `cron-varredura-central.js`, `tv-vendedor.js`, `tv-supervisores*.js`, `cron-mapa-executivo.js`) | chave do app do CEVEN (`X-App-Secret`) escrita no código |
| `analises/coletar_todos_os_pdvs_e_prospects_100pct.py` | token da prospecção do CEVEN |
| `functions/api/cron-relatorio-horario.js` (sem chamador) | token antigo de WhatsApp (Green API) |
| `docs/HISTORICO_INTEGRAL_CONVERSA_AUDITORIA.jsonl` (3,4 MB, 21/09) | histórico de conversa com 8 tokens de login (JWT) e 4 menções a senha |
| `public/vendas_mes*`, `dados_mix.json`, `mix_*`, `MAIS_MIX/JOTA/sabatinas/` | nomes de clientes, CNPJ e valores (o site também é público) |
**Ação recomendada:** (1) tornar o repositório GitHub **privado**; (2) trocar a chave/tokens no CEVEN e passar a ler de segredo (`env`), com uma constante única; (3) apagar o `.jsonl` do histórico e o token Green; (4) proteger `/mix` e os JSON de clientes com senha. Tudo só com ok do Vitório (mexe em compartilhado e no WhatsApp).

## 3. Redundâncias (risco de "número diferente" entre JOTA e WhatsApp)
| Lógica repetida | Onde | Risco |
|---|---|---|
| Regra de varejo (VJ, PET VJ, FARMA, ESP) | 12 arquivos | uma mudança em um lugar e não no outro = JOTA, TV e WhatsApp contando diferente |
| Chave do CEVEN | 34 arquivos | segurança + troca trabalhosa |
| Envio pela Evolution | 5 arquivos (motor, JOTA, contatos, dispatcher antigo, workflow de teste) | comportamento diferente de envio/erro |
| Data de hoje em Brasília | 9 arquivos | virada de dia diferente entre telas |
| Leitura da Gestão de Equipe (tv-mostra) | 22 arquivos | ok (é a fonte única), mas cada um aplica filtros próprios |
**Ação recomendada:** uma biblioteca comum `functions/_lib/regras.js` (varejo, data, formato R$) usada pelo site e pelo motor; teste que falha se alguém reescrever a regra em outro lugar.

## 4. Código morto
- **17 endpoints sem nenhum chamador** em produção: anomalias-roteiro, cliente-detalhe, conferencia-supervisor, consolidador-diario, cron-aquecimento-matinal, cron-arvore, cron-fechamento-20h, cron-matinal-04h, cron-relatorio-horario, cron-whatsapp-dispatcher, debug-ceven, historico, onde, oportunidades-mix, pre-analise-rca, whatsapp/flash-alert (+ varredura-status, usado só em teste). `whatsapp/bot` e `whatsapp/conversas` ficam (webhook e diagnóstico).
- **4 workflows antigos** só manuais que duplicam o relógio da Cloudflare: tv-varredura-central-cron (ainda chama o piloto desligado), tv-lances-cron, tv-faturado-mes-cron, tv-executiva-mapa-live (chama o mapa desligado).
- **scripts/**: 14 de 19 não são usados por nenhuma rotina. **scratch/**: 143 arquivos de remendos antigos. **OPERACAO_WHATSAPP/**: 109 (relatórios gerados; ok).
- 14 tabelas vazias no D1 (ver MEGA_AUDITORIA).

## 5. Peso
- 741 arquivos; `public/` = 155 MB (vídeos de gol ~2,2 MB cada, dados).
- No git: `MAIS_MIX/JOTA/OFICIAL - JOTA MANUAL DE USO .pptx` (9,3 MB) e `JOTA_pacote_v1.zip` (8,6 MB) — já extraídos onde precisa; podem sair do git.
- Duplicados exatos: `config/pontuacao_brasileirao.json` = `public/pontuacao_brasileirao.json` (intencional: a tela lê a cópia pública; manter sincronizados) e 2 arquivos do Mars Day.

## 6. O que NÃO foi mexido
Nada foi apagado nem alterado nesta varredura. Toda limpeza (apagar endpoints/workflows/scripts, segredos para env, repositório privado) depende do ok do Vitório — regra 5 do CLAUDE.md: "não apagar arquivos sem mostrar a lista antes".
