# Auditoria de limpeza e LGPD — 25/10/2026 (noite)

Pedido do Vitório: "Audite um por um e me traga data do último uso, o que podemos perder e se tem o dado já disponível em outro lugar… vou apagar algo sem ter certeza?"
**Nada foi apagado nesta auditoria.** "Último uso" = último dado gravado no D1 por aquele endpoint (a Cloudflare não guarda histórico de chamadas por rota) + último commit do arquivo.

## 1. Os 17 endpoints sem chamador
| Endpoint | O que fazia | Último dado gravado / último commit | O que perdemos se apagar | O dado existe em outro lugar? | Decisão sugerida |
|---|---|---|---|---|---|
| cron-whatsapp-dispatcher | WhatsApp antigo (abertura + 11h/14h30/17h/18h30) | lê `consolidado_executivo_live`: último 08/09 11:42 · commit 11/09 | nada (lê tabela parada desde 08/09) | sim: motor `ceven-cron-whatsapp` (Projeto B) | apagar |
| cron-relatorio-horario | relatório de hora em hora pela Green API | não grava · commit 09/09 · **tem token Green escrito** | nada | sim: motor | apagar (segurança) |
| whatsapp/flash-alert | alerta relâmpago pela Green API | não grava · commit 21/09 | nada | sim: alertas do motor + JOTA | apagar |
| cron-matinal-04h | preparação das 4h | lê `roteiros_visitas`, `prospects_receita`, `anomalias_roteiro_auditoria`: **0 linhas** · commit 07/09 | nada | sim: motor 04:00 + base única | apagar |
| cron-aquecimento-matinal | aquecia o cache às 4h | lê `representantes` · commit 12/10 | nada | sim: varredura central (cron) | apagar |
| cron-fechamento-20h | fechamento do dia | grava `consolidado_diario_filial`: último 08/09 · commit 07/09 | 11 linhas de 08/09 (1 dia) | sim: fechamento da Liga 19h30 + motor 18:30 | apagar |
| consolidador-diario | consolidado do dia | mesma tabela, último 08/09 | idem | idem | apagar |
| historico | evolução ao longo do tempo | lê `rca_kpis`: 1 dia só (08/09) · commit 07/09 | nada | sim: banco de pedidos do Drive + vendas item a item | apagar |
| cliente-detalhe | ficha do cliente | `clientes_historico_compras`: **0 linhas** · commit 12/10 | nada | sim: JOTA (cliente/produto item a item) + +MIX | apagar |
| oportunidades-mix | +MIX antigo | `oportunidades_mix_gap`: **0 linhas** · commit 07/09 | nada | sim: +MIX atual (dataset) | apagar |
| pre-analise-rca | análise matinal do vendedor | `pre_analises_matinais`: tabela não existe · commit 07/09 | nada | — | apagar |
| anomalias-roteiro | auditoria de roteiro | 0 linhas · commit 07/09 | nada | sim: tv-vendedor / varredura | apagar |
| debug-ceven | teste de conexão com o CEVEN | não grava · commit 13/10 | um botão de diagnóstico | parcial: /api/saude | manter (diagnóstico) |
| onde | de qual país saem as Functions (CEVEN bloqueia fora do Brasil) | não grava · commit 16/10 | o único jeito de conferir o smart placement | não | **manter** |
| conferencia-supervisor | conferência do digitado por supervisor x Clube da Venda | lê `varredura_central_rca` (viva) · commit 13/10 | a ficha de conferência | o dado sim (central-snapshot), a ficha não | **manter** |
| cron-arvore | força atualizar a árvore supervisor → vendedores | não grava direto · commit 06/10 | atualização manual na hora | a varredura atualiza sozinha | manter (botão manual) |
| varredura-status | frescor da varredura | lê `varredura_central_rca` · usado pelos testes | quebra os testes | não | **manter** |

As 12 tabelas antigas (todas vazias ou paradas em 08/09) podem sair depois dos endpoints: mexe em `schema.sql` (compartilhado), então só com ok explícito.

## 2. Os 13 scripts de `scripts/`
**Correção da varredura:** o workflow `analise-sob-demanda.yml` roda **online** qualquer `.py` de `scripts/` pelo nome. Os estudos do +MIX não são lixo: são a caixa de ferramentas online. Ficam.
| Script | Para que serve | Online? | Decisão |
|---|---|---|---|
| auditoria_mix.py | auditoria do +MIX contra o plano (22/10) | sim (sob demanda) | manter |
| estudo_mix_antes_depois.py / _completo / _profundo | estudos de correlação +MIX x venda (20–21/10) | sim (sob demanda) | manter |
| exportar_mix_falhas.py, verificar_mix_acertos.py, mix_listas_vazias.py | provas para o time de dados do CEVEN | sim (sob demanda) | manter |
| **coletar_justificativas_visitas.js** | acumula o motivo de "visitou e não vendeu" (pedido de 23/09) | ✅ **resolvido 25/10**: substituído por `analises/guardar_visitas.js` + workflow `guardar-visitas.yml` (22h, lê a rota já gravada no D1, grava `historico_visitas.db` no Drive). Recuperado desde 29/09: 91.724 visitas, 43.924 com justificativa | pode sair |
| gerar_auditoria_mensagens.js | gera todas as mensagens do dia sem enviar (auditoria) | não (manual) | manter; é ferramenta de conferência do Projeto B |
| amostrar_cnae_nacional.js | amostra de prospecção por CNAE (22/09) | não | pode sair (estudo feito) |
| aplicar_vinculo_representantes.js, incluir_novos_arvore_liga.js | cargas únicas na Gestão de Equipe (12–13/10) | não | podem sair (hoje é pela própria Gestão de Equipe) |
| upload_drive_sem_rclone.js | subir arquivo pro Drive sem rclone | não | pode sair (workflows usam rclone) |

## 3. `scratch/` (143 arquivos)
- **1 em produção:** `build_brasileirao_dataset.py` (workflow `brasileirao-dataset.yml`). Fica.
- 2 referenciados em doc (`ux_popup.css`, `ux_popup_proposta.md`).
- 108 são remendos (`patch_*` etc.): scripts que já editaram outro arquivo uma vez. A conferência automática achou o texto novo de 50 deles no código atual; os outros 58 não dá para provar, porque o código evoluiu depois.
- 25 são testes ou consultas pontuais.
- **Garantia:** apagar do repositório não destrói nada. Tudo fica no histórico do git e volta com um comando (`git checkout <commit> -- scratch/arquivo`). Nada em `scratch/` é publicado nem roda.
- Lista arquivo por arquivo, com tipo e se foi achado no código: gerada na sessão (`scratch_aplicado.tsv`).

## 4. Manual e pacote do JOTA
`MAIS_MIX/JOTA/OFICIAL - JOTA MANUAL DE USO .pptx` (9,3 MB) e `JOTA_pacote_v1.zip` (8,6 MB): decisão do Vitório, "deixa no Drive". Vitório subiu no Drive (25/10); saíram do git (continuam na pasta local e no histórico).

## 5. LGPD — como está
| Camada | Situação |
|---|---|
| Senha | Gestão de Equipe (gravação), contatos do JOTA, conversas do JOTA e **+MIX (desde 25/10)** exigem a senha da Diretoria. 5 erros = 10 min bloqueado |
| Escopo no JOTA (o nosso "RLS") | cada contato só vê o seu pedaço: diretoria = Brasil; gerente = filial/grupo; supervisor = a equipe dele; vendedor = o próprio código. Número desconhecido não recebe nada |
| Conversas pessoais | a leitura do histórico da Evolution foi removida (só configuração) |
| D1 | não existe RLS de banco no D1. Quem protege é cada endpoint |
| 🔴 Repositório GitHub público | clientes, CNPJ e valores (`public/vendas_mes*`, `dados_mix.json`, `mix_*`, sabatinas), o histórico `docs/HISTORICO_INTEGRAL_CONVERSA_AUDITORIA.jsonl` (8 tokens de login) e a chave do CEVEN em `functions/_lib/ceven_auth.js` |
| 🟠 Endpoints abertos com dado pessoal | `/api/tv-mostra` e `/api/representantes`: nome completo de vendedores e supervisores. `/api/central-snapshot`: nomes de clientes da rota. `/api/whatsapp/gerentes` e `resumo-dia`: celular. `/api/oportunidades-mix` (morto): CNPJ |
| 🟠 Telas da TV | o link da filial é aberto (decisão de 23/09: "link travado", sem login), então quem tiver o link vê a operação da filial |

**Plano proposto (cada item precisa do ok):**
1. Tornar o repositório privado e dar ao JOTA um token de leitura.
2. Apagar o `.jsonl` do histórico e reescrever o histórico do git para tirar os tokens antigos.
3. Senha ou chave em `/api/whatsapp/*`, `representantes` e `oportunidades-mix` (ou apagar os mortos).
4. TV: um código por link de filial (o link continua fixo, mas sem o código não abre).
5. Trocar a chave do app do CEVEN, que hoje está no repositório público.

## 6. Biblioteca única (feito em 25/10)
`public/regras.js` é o único lugar com: os canais do varejo/AS/gestão, o SKU ignorado, a data e a hora de Brasília, o R$ e a chamada da Evolution. Quem usa: 32 Functions, TV, Matriz, Supervisores, Liga, o motor do WhatsApp e o gerador do +MIX. A chave do CEVEN ficou só em `functions/_lib/ceven_auth.js`; no motor ela vem do segredo do GitHub. O teste `testes/regra_unica.mjs` **falha** se alguém reescrever a regra em outro lugar. Exceções aguardando apagar: os 12 endpoints mortos acima e o `worker-cron/src/vigia.js`, que migra no próximo deploy do worker.
