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

## 11. Achados de segurança fora do escopo de WhatsApp (registrados aqui pra não esquecer)

- `GET /api/admin/supervisores` retorna os **hashes bcrypt de senha de todos os supervisores** na resposta — não deveria vir no payload público da API.
- Credenciais do CEVEN (admin e Evolution API key) estão hardcoded em `pipeline/ceven_unified_engine.js` — considerar mover pra variáveis de ambiente/secrets do GitHub Actions.
- `RETs/` (pasta na raiz do repo) contém PDFs nominais de processos trabalhistas (CLT) de pessoas reais — dado sensível de RH versionado no git, recomendado remover.
