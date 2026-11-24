# DICIONÁRIO DE KPIs — um número, uma fonte, uma conta

> **Para que serve:** o mesmo KPI sai com valores diferentes conforme a tela ou a resposta, porque cada código escolhe a sua fonte e a sua conta. Este documento diz, para cada KPI, **qual é a fonte oficial, como se soma de um nível para o outro e onde o código foge disso hoje**.
> **Leitores:** Vitório (diretor comercial) e quem mantém o código.
> **Situação:** PROPOSTA, 22/11/2026. Nenhum código foi alterado. Os números foram medidos no D1 de produção só com leitura (SELECT), com o GEROT na posição "atualizado 22/11/26 10:34" (carga gravada às 12h13) e o Clube de 19/11 (quinta-feira, dia normal), salvo quando o texto diz outra data.
> **Relação com outros documentos:** continua o [MAPA_DADOS_JOTA.md](MAPA_DADOS_JOTA.md) (16/11), que mapeou as fontes. Aqui o foco é a **conta de cada KPI por nível** e a lista de **arquivo:linha** que foge dela. Vários conflitos apontados em 16/11 continuam abertos e estão repetidos aqui com o número de hoje.

---

## 0. As regras que valem para todo KPI

1. **Uma fonte oficial por KPI.** A tela, a resposta do JOTA, a matinal, o "bom dia" e o proativo leem o mesmo campo da mesma tabela. Se a fonte oficial não tem o dado, a resposta diz "sem dado" (com a hora da última leitura). Não busca outra fonte com outro número, a não ser a reserva escrita aqui, e com o nome da reserva no rodapé.
2. **Total e linhas vêm da mesma carga.** Quando a resposta mostra um total e abre em linhas (filial → supervisores, supervisor → vendedores), as linhas são da mesma tabela e da mesma carga do total. Se sobrar diferença (vendedor fora das equipes, histórico, vaga, RCA 2 "venda indústrias"), aparece uma linha **"fora das equipes"** = total − soma das linhas. **Total e linhas sempre fecham.**
3. **R$ soma; contagem de cliente não soma.**
   - **Somam** de baixo para cima (conferido centavo a centavo no GEROT, 11 filiais): faturado líquido, faturado bruto, devolução, meta R$, carteira pendente, captação, meta ideal de captação, cortes R$, margem R$.
   - **Não somam**: positivação, meta de positivação, "Meta clientes", recorrência (objetivo, meta, positivados), percentuais e "necessidade por dia". O mesmo cliente comprado por duas pastas conta duas vezes na soma. Esses números se leem **no próprio nível**, ou se recalculam a partir dos clientes (regra 4).
4. **Positivação de um grupo que o GEROT não tem pronto** (equipe da Gestão de Equipe, grupo do gerente em MCD e TPH): conta os CNPJs do grupo em `gerot_cliente_mes` cujo **faturado líquido somado no grupo é maior que zero**. Conferido em 22/11: essa conta dá **exatamente** a positivação oficial das 11 filiais (MCD 943, TPH 2.238, TSJ 1.554...).
5. **Sem dado nunca vira zero.** "R$ 0", "0 pedidos", "0%" ou "sem rota" só aparecem quando a fonte leu hoje e leu zero. Sem leitura, a resposta diz "sem leitura do <fonte> hoje · última <data hora>".
6. **Toda resposta diz a fonte e a hora** de cada número: `GEROT posição 22/11 10:34 · Clube 14:48`.
7. **O nome segue a fonte.** Rótulo "CEVEN" só para número do CEVEN, "GEROT" só para número do GEROT. Hoje há rótulos trocados (seção 4, conflito 14).
8. **Dias úteis: uma conta só** (seção 2).

---

## 1. As fontes e quando atualizam (medido em 22/11/2026)

| Fonte | Tabelas no D1 | O que tem | Atualização medida | Hora a mostrar |
|---|---|---|---|---|
| **GEROT** (BI sobre o Winthor) | `gerot_filial_mes`, `gerot_supervisor_mes`, `gerot_vendedor_mes` (um JSON `dados` com 50 colunas), `gerot_vendas` (vendedor × indústria), `gerot_cliente_mes`, `gerot_cliente_forn_mes`, `gerot_carteira` (pedido a pedido), `gerot_pedido`, `gerot_pedido_entrada`, `gerot_recorrencia_pasta`, `gerot_devolucao_motivo(_vend)`, `gerot_filial_dia` | o **mês**: faturado, bruto, devolução, meta, carteira, captação, ritmo, necessidade, positivação, mix, margem, cortes, recorrência | `.github/workflows/gerot-coleta.yml`: 07h15, 09h15 … 19h15 BRT, seg–sáb; domingo 20h15 | `gerot_coleta_status.posicao` ("atualizado 22/11/26 10:34"). **A coluna `em` das linhas não é a hora da carga**: só muda quando o valor muda |
| **Clube da Venda** (app do vendedor) | `clube_venda_dia`, `clube_pedido`, `clube_checkin`, `clube_justificativa`, `clube_roteiro` | o **dia**: pedido colocado, rota, check-in, justificativa | a cada ~15 min (`clube_rodada.lido_em`: 18h33, 18h48, 19h03, 19h18 em 22/11) | `max(clube_venda_dia.lido_em)` do dia |
| **CEVEN admin** | `supervisores_dia` (compromisso/RET), `cliente_focos` (TAGs, 54.169 linhas, 11 filiais, gravada 19/11), `ceven_devolucao_nota` + `devolucao_nota_motivo`, `ceven_gps_visita` | compromisso, RET, TAGs, nota e motivo da devolução, GPS do gerente | compromisso 5 em 5 min até 10h30; RET 15 em 15 min | `supervisores_dia.atualizado_em` |
| **CEVEN vendedor** (legado) | `varredura_central_rca` (dashboard, produtividade, roteiro), `meta_hierarquia` (03 a 14/11), `cascata_dia`, `arvore_supervisores` (13/11) | o que o app do vendedor mostra | parado/travado desde 16/11 (trava do Vitório) | — (só reserva rotulada) |
| **Gestão de Equipe** | `config_equipe_soberana` (via `/api/tv-mostra`) | quem aparece, supervisor, grupo, canal, "mostra" | quando alguém salva | — |
| **Winthor via CEVEN** | `pedido_status` | status do pedido | esparso: 19/11 tem 3 a 30 pedidos por filial, contra 187 a 461 no Clube | não usar para total |

**Ordem de confiança por assunto:** mês = GEROT · dia = Clube · supervisor em campo = CEVEN admin · equipe = Gestão de Equipe. O CEVEN do vendedor fica só como reserva rotulada.

---

## 2. Dias úteis (uma conta só)

**Definição:** dia útil = segunda a sexta, sem feriado nacional (`functions/_lib/feriados.js`). Em novembro/2026: 19 dias úteis (2/11 e 20/11 são feriados).

**É a conta do GEROT** (conferido em 22/11, domingo): "Meta Ideal captação" = meta × 13 ÷ 19 (MCD: 9.680.000 × 13/19 = 6.623.157,89 ✔) e "Necessidade dia captação" = (meta − captação) ÷ 6 (MCD: (9.680.000 − 4.684.201,05) ÷ 6 = 832.633,16 ✔). Ou seja: **13 dias decorridos e 6 restantes**, e o domingo não conta nem de um lado nem do outro.

**Proposta:** uma função só em `functions/_lib/jota/base.js`, que devolve `{ total, decorridos, restantes }` com a convenção do GEROT. Antes de cada uso, conferir `restantes` contra o próprio GEROT da filial: `(Meta − Captação) ÷ Necessidade`.

**Onde o código conta diferente hoje:**

| Arquivo:linha | Conta | Diferença |
|---|---|---|
| `functions/_lib/jota/base.js:144` `diasUteisRestantes` | inclui hoje | referência (6 em 22/11) |
| `functions/_lib/jota/respostas/gestao.js:12` `diasUteisMes` / `:17` `diasUteisAgora` | decorridos = antes de hoje (+1 se hoje é útil) | 13 em 22/11 ✔ |
| `functions/_lib/jota/respostas/resumo.js:97`, `:153`, `:192-195` | decorridos = total − restantes + 1 | **14 no domingo** (13 no GEROT): a tendência sai menor no fim de semana |
| `functions/api/matinal.js:28-42` | restantes = total − decorridos, **sem hoje** | numa segunda-feira dá 1 dia a menos que `base.js` |
| `functions/_lib/monitoria/motor.js:150`, `analista.js:67` | restantes = total − passados | igual ao `base.js` em dia útil |
| `functions/api/cron-lances.js:39` (Projeto B) | **sem feriado** | conta 20/11 e 2/11 como dia útil |
| `functions/api/liga-clube.js:168` | com feriado, "até hoje" inclui hoje | — |

---

## 3. Os KPIs

Formato de cada ficha: **Definição** · **Fonte oficial** · **Por nível** · **Sem dado** · **Hoje fora da regra** (arquivo:linha e o que faz).

### 3.1 Faturado líquido do mês
- **Definição:** notas faturadas no mês menos as devoluções. Pode ficar negativo (vendedor com mais devolução que venda). Para premiação, vale só este número.
- **Fonte oficial:** GEROT `"Faturado líquido (R$)"` em `gerot_filial_mes` / `gerot_supervisor_mes` / `gerot_vendedor_mes`. Hora = `gerot_coleta_status.posicao`.
- **Por nível:** vendedor = `gerot_vendedor_mes` (rca). Equipe da Gestão = soma dos vendedores dela. Grupo do gerente (MCD, TPH) = soma dos vendedores do grupo. Filial = `gerot_filial_mes`. Brasil = soma das 11 filiais. Quando abrir a filial em linhas, incluir a linha "fora das equipes" (regra 2). Exemplo MCD: o RCA 2 "CLT - VENDA INDÚSTRIAS" tem **−R$ 405.013** (devolução lançada nele) e não está em nenhuma equipe.
- **Sem dado:** sem a carga do GEROT do mês = "sem leitura do GEROT · última posição <...>". Reserva: último dashboard do CEVEN do mês, rotulado "CEVEN <data>".
- **Hoje fora da regra:**
  - `functions/_lib/jota/respostas/bomdia_gestao.js:28` (gerente): soma os supervisores e **tira** os que têm "Hist", "INTERNO" ou "EMPRESA" no nome → MCD **R$ 4.100.081** × oficial **R$ 3.695.067** (+R$ 405 mil); API +R$ 35 mil; TCG +R$ 26 mil; TPH +R$ 243 mil.
  - `public/tvapp.html:1458` (`renderTotais`): faturado da TV = soma dos vendedores **com mostra = SIM**, dividido pela meta **da filial inteira** → TBL **44,3%** (R$ 2,19 mi) × oficial **57,7%** (R$ 2,86 mi); TCG 18,1% × 21,2%. Simulação no D1 com a regra do código.
  - `functions/_lib/jota/escopo.js:47-59`: as linhas do JOTA só têm quem está na base do CEVEN. O RCA 2 de MCD não entra, então a soma dos grupos Cleverson + Adriano não fecha com a filial.
  - `functions/_lib/jota/entende.js:363-367` (posição do supervisor no Brasil): faturado = bruto − devolução do **dashboard do CEVEN** (`varredura_central_rca`), com o rótulo "(GEROT, mês fechado)".

### 3.2 Faturado bruto
- **Definição:** notas faturadas no mês, antes das devoluções.
- **Fonte oficial:** GEROT `"Faturado bruto (R$)"`, mesmas tabelas. Soma como o 3.1.
- **Uso:** só no fechamento do mês ("bruto − devolução") e na % de devolução.
- **Hoje fora da regra:** `entende.js:363` usa `financeiro.faturado_bruto` do CEVEN (ver 3.1).

### 3.3 Devolução
- **Definição (valor do mês):** R$ das notas devolvidas no mês. "% devolução" = devolução ÷ bruto (MCD: 18,7%).
- **Fonte oficial do valor:** GEROT `"Devolução (R$)"` por nível. Soma de baixo para cima.
- **Definição (nota e motivo):** cada nota devolvida, com data, cliente e motivo oficial. É o que gera vermelho ou gol contra na Liga.
- **Fonte oficial da nota e do motivo:** `ceven_devolucao_nota` + `devolucao_nota_motivo` (CEVEN admin). O total por motivo do mês: `gerot_devolucao_motivo` (filial) e `gerot_devolucao_motivo_vend` (vendedor).
- **Sem dado:** nota sem motivo lido = "motivo ainda não lido" (nunca vira gol contra).
- **Hoje fora da regra:**
  - `functions/_lib/jota/entende.js:1322`: rodapé "Devolução do mês no painel do CEVEN" sobre um número que vem do GEROT (`escopo.js:41`).
  - `functions/_lib/jota/escopo.js:56` e `:82`: "devolução de hoje" sai das notas do CEVEN (`r.devolucoes`, paradas desde a trava de 16/11).

### 3.4 Meta R$
- **Definição:** meta de faturamento do mês. A meta da filial é a soma das metas dos vendedores (regra de outubro/2026), o que o GEROT respeita (meta da filial = soma dos vendedores = soma das indústrias, nas 11 filiais).
- **Fonte oficial:** GEROT `"Meta (R$)"`. A reserva `meta_hierarquia` (tela Filiais do CEVEN) **parou entre 03 e 14/11** e difere em 4 filiais.
- **Por nível:** soma de baixo para cima (vendedor → equipe/grupo → filial → Brasil).
- **Sem dado:** "meta não cadastrada" (nunca 0%). Vendedor com meta 0 no GEROT **tem meta 0**: não busca outra fonte.
- **Diferença medida (GEROT × meta_hierarquia):** MCD **9.680.000 × 9.062.252**; TCA 6.740.000 × 6.330.000; TPH 11.000.000 × 10.614.937; TPA 6.800.000 × 6.775.134. Nas outras 7, iguais.
- **Hoje fora da regra:**
  - `functions/_lib/jota/escopo.js:69`: se a meta do GEROT do vendedor é 0, usa `meta_hier` (CEVEN). **MCD 416 Claudimir Pereira: meta GEROT R$ 0, meta_hierarquia R$ 1.636.296** (gravada em 03/11). São 5 vendedores e **R$ 1,92 mi de meta a mais** nas linhas do JOTA de MCD (vendedor, equipe, grupo, rankings).
  - `functions/api/central-snapshot.js:161` e `:182-183`: grava `meta_hier` (cascata e `meta_hierarquia`) no snapshot que alimenta a TV e o JOTA.
  - `functions/_lib/resumo_base.js:15`: a meta parte da `meta_hierarquia` e só é trocada pela do GEROT em `:132` quando a filial tem linha no GEROT.
  - `public/tvapp.html:1464`: rótulo **"Meta do mês (CEVEN)"** sobre o número do GEROT (vem de `/api/metas-mes` → `resumo_base.js:132`). `functions/api/metas-mes.js` também responde `fonte: 'base do CEVEN'`.

### 3.5 % da meta (atingimento)
- **Definição:** dois indicadores, sempre com nome:
  - **"faturado: X% da meta"** = faturado líquido ÷ meta. É o da premiação.
  - **"com carteira: Y% da meta"** = (faturado + carteira pendente) ÷ meta. É o do dia a dia (decisão de 11/11 e 21/11/2026).
- **Fonte oficial:** derivado de 3.1, 3.4 e 3.12 no mesmo nível. O GEROT já traz os dois: `"% Meta"` e `"% Meta (Fat + Cart)"`.
- **Por nível:** recalcular com os R$ do nível (soma). Nunca fazer média de percentuais.
- **Exemplo MCD:** faturado 38,2% · com carteira 39,9%.
- **Hoje fora da regra (a mesma mensagem mostra os dois sem dizer qual é):**
  - `functions/_lib/jota/respostas/resumo.js:156` mostra "(faturado + pendente) ÷ meta" e, na mesma resposta, `:177-178` ("Leitura do Jota") usa **só o faturado**: "o calendário pede 68% e estamos em 38,2%".
  - `functions/_lib/jota/respostas/gestao.js:55` (`respRitmo`): só faturado.
  - `functions/_lib/monitoria/analista.js:95` (`pctReal`): só faturado.
  - `public/tvapp.html:1460` e `:1493`: só faturado, sem o nome "faturado".
  - Rankings de `gestao.js:46`, `resumo.js:229-231` e `escopo.js:74`: com carteira (`escopo.js:74` corrigido em 21/11).

### 3.6 Faturado + carteira
- **Definição:** faturado líquido + carteira pendente (pedido já no Winthor e ainda não faturado). É "o que está na mão".
- **Fonte oficial:** GEROT `"Faturado + Carteira (R$)"` (igual a fat. + cart. nas 11 filiais).
- **Por nível:** soma.
- **Hoje fora da regra:** a carteira usada varia (ver 3.12).

### 3.7 Ritmo e tendência do mês
- **Definição oficial (régua do GEROT):** **ritmo = captação do mês ÷ meta ideal de captação de hoje** (`"% Meta Ideal captação"`). A meta ideal de hoje = meta × dias decorridos ÷ dias do mês. **No ritmo de hoje, fecha em ritmo × meta.** Não é projeção do JOTA: é a conta do GEROT.
  - Captação ≠ faturado + carteira: MCD captação R$ 4,68 mi × fat. + cart. R$ 3,87 mi (o faturado é líquido de devolução).
- **Fonte oficial:** GEROT `"Captação (R$)"`, `"Meta Ideal captação (R$)"`, `"% Meta Ideal captação"`, `"Captação M-1 (R$)"` (mês passado até o mesmo dia).
- **Por nível:** vendedor, supervisor GEROT e filial = o `% Meta Ideal captação` do nível. Equipe da Gestão, grupo e Brasil = **soma da captação ÷ soma da meta ideal** (os dois somam). Nunca a média dos percentuais.
- **Sem dado:** sem captação no nível = "sem ritmo do GEROT"; **não cai para a tendência linear**.
- **Exemplo MCD hoje, 4 números para a mesma pergunta:**
  - **70,7%**: ritmo do GEROT (oficial). Aparece em `gestao.js:131`, `gerot_painel.js:60`, `bomdia_gestao.js:57`, `api/matinal.js:153`.
  - **58,4%**: tendência linear, (fat. + cart.) ÷ 13 × 19. Aparece em `gestao.js:131` quando falta a captação.
  - **54,2%**: a mesma conta com 14 dias decorridos no domingo. Aparece em `resumo.js:154` e `:195`, e rotulada **"Tendência (GEROT)"** em `resumo.js:112` e `:156`, embora seja conta do JOTA.
  - **38,2% contra 68% pedidos**: "Leitura do Jota" em `resumo.js:177`, só o faturado contra o calendário.
- **Hoje fora da regra:**
  - `resumo.js:13`: `ritmoGerot` só existe para filial e Brasil. **Supervisor, grupo e vendedor** recebem a tendência linear rotulada "(GEROT)".
  - `functions/_lib/jota/respostas/matinal.js:37` e `:61` (matinal do supervisor): ritmo = calendário (decorridos ÷ total) contra (fat. + cart.) ÷ meta.
  - `functions/_lib/monitoria/analista.js:68` e `:95`: calendário contra só faturado.

### 3.8 Necessidade por dia útil
- **Definição oficial:** quanto falta **captar** por dia útil para fechar a meta = máx(0, meta − captação) ÷ dias úteis restantes. É a `"Necessidade dia captação (R$)"` do GEROT.
- **Por nível:** vendedor, supervisor GEROT e filial = o campo do nível. **Grupo, equipe da Gestão e Brasil = máx(0, soma das metas − soma das captações) ÷ dias restantes.** Nunca somar as necessidades dos filhos: cada filho é cortado em zero e a soma infla.
- **Sem dado:** sem captação = "sem necessidade do GEROT". Não trocar por (meta − faturado − carteira), que é outra conta.
- **Exemplo MCD hoje (6 dias restantes):**
  - **R$ 832.633/dia**: GEROT (oficial).
  - **R$ 968.935/dia**: "quanto falta" do JOTA, (meta − fat. − cart.) ÷ 6 (`resumo.js:352`).
  - **R$ 907.689/dia**: soma das necessidades por indústria dos vendedores (`escopo.js:42`).
  - **R$ 832.633/dia**: soma das necessidades dos supervisores (bate só por acaso). Em TPH: 723.974 × 707.122 oficial.
  - TPH vendedor 100: GEROT **R$ 0/dia** (já passou da meta) × **R$ 269,81/dia** somando as indústrias (`escopo.js:42`).
- **Hoje fora da regra:**
  - `functions/_lib/jota/escopo.js:42`: soma a Necessidade de **cada indústria** (`gerot_vendas`) e usa como a do vendedor (`necDia`, lido em `resumo.js:258`).
  - `functions/_lib/jota/respostas/resumo.js:352` (`respFalta`), `:321` e `:458`: (meta − fat. − cart.) ÷ dias.
  - `functions/_lib/jota/respostas/gestao.js:221` (`respMaiorAtrasoMeta`): falta ÷ dias.
  - `functions/_lib/jota/respostas/momentos.js:258`, `:416`, `:499`, `:618`: (meta − fat. − cart.) ÷ dias, por vendedor, equipe e filial. Os momentos do dia comparam o digitado de hoje com esse número.
  - `functions/_lib/jota/respostas/matinal.js:61`: (meta − fat. − cart.) ÷ (total − passados).
  - `functions/_lib/monitoria/motor.js:150-156` ("Meta diária p/ 100%"): gap ÷ dias, com a soma dos vendedores.
  - `functions/api/matinal.js:209` (indústria por supervisor e filial): soma as necessidades.
  - `functions/_lib/jota/respostas/bomdia_gestao.js:32`: soma as necessidades dos filhos (supervisores ou vendedores).
  - `functions/_lib/jota/respostas/rota.js:187` e `resumo.js:353`: positivação por dia = ⌈falta ÷ dias⌉. É conta do JOTA; o GEROT não tem esse campo. Manter, mas com o nome "conta do Jota".

### 3.9 Positivação do mês (realizado)
- **Definição:** clientes (CNPJ) com **faturamento líquido maior que zero no mês**, contados no nível. O cliente comprado por duas pastas conta **uma** vez na filial.
- **Fonte oficial:** GEROT `"Positivação (filial + CNPJ)"` no nível (`gerot_vendedor_mes`, `gerot_supervisor_mes`, `gerot_filial_mes`). Brasil = soma das 11 filiais (CNPJ é por filial).
- **Grupo, equipe da Gestão e qualquer recorte sem linha pronta no GEROT:** regra 4, contar os CNPJs com faturado líquido somado > 0 em `gerot_cliente_mes`. Conferido: a conta reproduz as 11 filiais exatamente.
- **"Positivação + carteira"** (`"Positivação + Carteira"`): clientes faturados ou com pedido em carteira. É outro indicador e aparece com esse nome.
- **Sem dado:** "sem leitura do GEROT". A reserva do CEVEN (`dashboard.positivacao.realizado`) vai rotulada.
- **Exemplo do problema (soma de vendedores × oficial):**

| Filial | Oficial (GEROT filial) | Soma dos vendedores | Soma dos supervisores | Soma dos grupos |
|---|---|---|---|---|
| MCD | **943** | 1.234 | 1.223 | Cleverson 565 + Adriano 637 = 1.202 |
| TPH | **2.238** | 2.599 | 2.598 | Vagner 1.714 + Fábio 834 = 2.548 |
| TSJ | **1.554** | 1.978 | 1.977 | — |
| TPA | **1.169** | 1.366 | 1.366 | — |

- **Hoje fora da regra (somam positivação de filhos):**
  - `public/tvapp.html:1458-1465`: "Positivados no mês" da TV = soma dos vendedores sobre a meta da filial → **MCD 1.202 de 1.470 = 81,8%** × oficial **943 = 64,2%**; TSJ 88,5% × 71,6%; TPA 80,5% × 69,6%.
  - `functions/_lib/jota/respostas/bomdia_gestao.js:32` e `:59` ("bom dia" do gerente): soma os supervisores → **MCD 1.253 de 2.860 (44%)** × oficial **951 de 1.470 (65%)**, "com carteira".
  - `functions/_lib/jota/respostas/resumo.js:127-129` e `:157` (grupo, vendedor): soma os vendedores (`agrupa`).
  - `functions/_lib/jota/respostas/rota.js:176-177` (`respPositivacao`): o total é oficial, mas as linhas por supervisor e por filial somam os vendedores. Total e linhas não fecham. O texto de `:190` ("esta é a soma vendedor a vendedor") descreve as linhas, não o total.
  - `functions/_lib/monitoria/motor.js:157-158` e `functions/_lib/monitoria/analista.js:79-80`: somam os vendedores (o analista troca pelo GEROT do supervisor em `:91` só quando acha o código).
  - `functions/api/matinal.js:207` (indústria): soma a positivação de cada vendedor por indústria e filial.
  - `functions/_lib/jota/entende.js:876-878` (fechamento do mês de equipe, grupo e vendedor): soma os vendedores.
  - `functions/_lib/jota/entende.js:900-902` ("supervisor pior em positivação"): soma os vendedores.
  - `functions/_lib/jota/entende.js:365` (posição do supervisor no Brasil): soma o dashboard do CEVEN.
- **Já seguem a regra (modelo para os outros):** `functions/_lib/jota/respostas/painel_industrias.js:63-72` (`posReal`, no nível), `functions/_lib/jota/respostas/gestao_gerot.js` (cada nível na sua tabela), e `functions/_lib/jota/respostas/matinal.js:51-56` (clientes distintos em `gerot_cliente_mes`; só falta a regra "faturado somado > 0" em vez de "> 0 em alguma linha").

### 3.10 Meta de positivação
- **Definição:** quantos clientes o nível tem que positivar no mês.
- **Fonte oficial:** GEROT `"Meta de positivação"` no nível. **"Meta clientes" é a carteira, não meta** (em 427 vendedores os dois números são diferentes). Não usar "Meta clientes" como reserva.
- **Por nível:** vendedor, supervisor GEROT e filial = o campo do nível. A soma dos filhos **não** é a meta do pai: MCD soma dos vendedores 2.926 × filial **1.470**; TPA 3.835 × **1.680**; TPH 4.902 × **3.890**.
- **Grupo do gerente e equipe da Gestão:** o GEROT não tem a meta pronta. **Decisão do Vitório** (seção 5).
- **Sem dado:** "meta de positivação não cadastrada" (nunca 0%).
- **Hoje fora da regra:**
  - Reserva `"Meta de positivação" ?? "Meta clientes"` em `functions/api/matinal.js:54`, `functions/_lib/jota/respostas/gestao.js:306`, `resumo.js:24` e `:40`, `functions/api/central-snapshot.js:74`, `functions/_lib/resumo_base.js:134`, `functions/_lib/jota/analista_senior.js:82` e `:102`. Hoje a reserva não entra em nenhum vendedor (0 casos), mas entra no dia em que o GEROT trouxer a meta vazia.
  - `functions/_lib/resumo_base.js:133`: positivação `?? "Realizado meta"` (outra coluna).
  - `functions/_lib/jota/respostas/rota.js:178-185`: uma **terceira meta** ("Meta oficial de positivação (Premiação)", base temporária de 27/10) aparece junto com a do GEROT.
  - Todos os lugares de 3.9 que somam a positivação somam também a meta.

### 3.11 Carteira por situação (bloqueado financeiro, bloqueado comercial, pendente, montado, liberado)
- **Definição:** pedidos já no Winthor e ainda não faturados, pela situação no Winthor. **Bloqueados = financeiro + comercial. Faturável = montado + liberado.** "Pendente" (situação) = sem carga.
- **Fonte oficial:** `gerot_carteira` (pedido a pedido: situação, motivo, valor, entrada). Valor e quantidade sempre juntos. A soma de `gerot_carteira.valor` bate **centavo a centavo** com a "Carteira pendente (R$)" das 11 filiais (22/11, 14h09).
- **Por nível:** soma pedido a pedido pelo `rca` do pedido. O supervisor e o grupo se montam pela equipe (regra de equipe, 3.27).
- **Sem dado:** sem a carteira de hoje = "carteira não lida hoje". Pedido sem valor = só a quantidade.
- **Exemplo TPH, "pedidos bloqueados", três respostas diferentes:**
  - **GEROT** `gerot_carteira`: **303 pedidos · R$ 549.971** (comercial 187 / R$ 235.714 + financeiro 116 / R$ 314.257). Oficial.
  - **Matinal do JOTA** (`gestao.js:288`): os mesmos 303 pedidos, mas com o valor do Clube: **R$ 487.703**.
  - **"Bloqueio comercial"** (`gestao.js:227-252`) e **analista sênior** (`analista_senior.js:62-65`): `pedido_status` dos últimos 7 dias: **26 pedidos · R$ 200.330**.
- **Hoje fora da regra:**
  - `functions/_lib/jota/respostas/gestao.js:288`: R$ do bloqueado = total do pedido no Clube (o próprio comentário de `gestao_gerot.js:54` e `:67` diz para nunca usar o Clube).
  - `functions/_lib/jota/respostas/gestao.js:231` e `functions/_lib/jota/analista_senior.js:62-65`: `pedido_status`, que é esparso.
  - `functions/_lib/jota/respostas/operacao.js:13-30`: bloqueados e cortes do dia pelo status do pedido do CEVEN.
- **Modelo certo:** `functions/_lib/jota/respostas/gestao_gerot.js:53-101` (`respCarteiraStatus`) e `:109` (`respCarteiraNivel`), e `functions/api/matinal.js:95` e `:119-126` (valor só quando a soma bate com o GEROT).

### 3.12 Carteira pendente (total)
- **Definição:** total da carteira (3.11) em R$; "Pedidos na carteira" = quantidade.
- **Fonte oficial:** GEROT `"Carteira pendente (R$)"` e `"Pedidos na carteira"` no nível. Igual à soma de `gerot_carteira`.
- **Por nível:** soma.
- **Hoje fora da regra:**
  - `functions/api/tv-vendedor.js:269`: o comentário diz que a carteira por vendedor "vem vazia no GEROT". Não vem: a soma dos vendedores bate com a filial nas 11. O código usa a do GEROT primeiro e só cai para `gerot_carteira` se faltar. Corrigir o comentário.
  - `bomdia_gestao.js:28` (gerente sem os supervisores "Hist/INTERNO/EMPRESA"): TPH R$ 2.260.517 × oficial R$ 2.336.937; TSJ R$ 1.005.910 × R$ 1.060.226.

### 3.13 Pedido colocado do dia (digitado)
- **Definição:** pedidos que o vendedor **colocou hoje no Clube**, operação venda. **Pedido colocado não é faturado** (pode ser cortado, bloqueado ou recusado). Rótulo fixo: "pedido colocado ainda não é faturado".
- **Fonte oficial proposta:** `clube_pedido` (pedido a pedido: nº do Clube, nº do Winthor, cliente, valor). Total do dia = `SUM(total)`; **nº de pedidos = `COUNT(DISTINCT pedido)`**; **clientes com pedido = `COUNT(DISTINCT cliente)`**. `clube_venda_dia.total_pedido` fica como conferência.
- **Por nível:** soma (R$ e pedidos). Clientes com pedido: contagem distinta no nível.
- **Sem dado:** antes da 1ª leitura do Clube do dia = "aguardando a 1ª leitura do Clube"; nunca "R$ 0".
- **O que foi medido em 19/11:**
  - **R$:** o Clube dá dois valores para o mesmo dia. TCV `clube_venda_dia` **R$ 1.001.761** × `clube_pedido` **R$ 868.983**; TPA R$ 609.827 × R$ 525.781; TBL R$ 915.208 × R$ 877.279; MCD R$ 578.016 × R$ 595.578. Antes de escolher: conferir com a tela do Clube qual soma inclui bonificação ou pedido cancelado.
  - **Quantidade:** `clube_venda_dia.ped_total` é na verdade **clientes com pedido**, não pedidos. Confere com `clube_pedido` (clientes distintos): ABC 320 × 319, MCD 178 × 178, TBE 176 × 176, TCA 230 × 230. Pedidos de verdade: ABC 420, MCD 235, TBE 187, TCA 271. As respostas "R$ X em N pedidos" (`resumo.js:203` e `:212`, `resumo.js:261`, `bomdia_gestao.js:53`, `matinal.js:76`) mostram **clientes** com o nome de "pedidos". `respQuemPediu` (`gestao_gerot.js:177`) mostra os pedidos de verdade.
- **Hoje fora da regra:**
  - `functions/_lib/jota/escopo.js:54`: `ped = total_pedidos` do Clube, chamado de "pedidos" e, em algumas telas, de "positivação".
  - `functions/api/tv-vendedor.js:163`: o digitado da TV = **o maior** entre a produtividade do CEVEN e a soma dos pedidos do roteiro.
  - `functions/_lib/resumo_base.js:18` e `:81`: digitado da produtividade do CEVEN, trocado pelo Clube em `:100-113`.
  - `functions/_lib/jota/escopo.js:23`: `pedido_status` como conferência (esparso, sem valor para total).

### 3.14 Positivação do dia / clientes com pedido hoje
- **Definição:** dois indicadores com nomes diferentes:
  - **"clientes com pedido hoje"** = clientes distintos com pedido colocado hoje (Clube).
  - **"positivação do dia (faturada)"** = clientes faturados hoje (GEROT `"Positivação do dia"`).
- **Fonte oficial:** `clube_pedido` (`COUNT(DISTINCT cliente)`) e GEROT `"Positivação do dia"`.
- **Hoje fora da regra (três contas com o nome "positivações hoje"):**
  - `public/tvapp.html:1466` e `:1496` + `functions/api/tv-vendedor.js:164`: só os clientes **da rota** com pedido (quem comprou fora da rota não entra).
  - `functions/_lib/jota/escopo.js:54`: `ped_total` do Clube (clientes com pedido, rota e fora).
  - `functions/_lib/jota/respostas/gerot_painel.js:81`: GEROT, faturada (hoje 0 em todas as filiais, porque o domingo não tem nota).

### 3.15 Rota, visitas e check-in
- **Definições:**
  - **Rota do dia** = clientes programados hoje (só canais V e P cobram rota). Fonte: `clube_venda_dia.roteiros`, com a lista em `clube_roteiro`.
  - **Visita** = cliente com **check-in** hoje (`clube_checkin`, primeiro check-in e último check-out).
  - **Atendimento na rota** (conta do Clube) = check-in **ou** justificativa **ou** pedido (`clube_venda_dia.visitas_rota`). É outro número e aparece com esse nome.
  - **Com venda na rota** = cliente da rota com pedido (`clube_pedido` do cliente). `clube_venda_dia.ped_rota` conta pedidos, não clientes.
- **Por nível:** soma (cada visita é de um vendedor).
- **Sem dado:** sem a leitura do Clube de hoje = "visitas de hoje ainda não lidas". A rota planejada do roteiro do mês aparece como "planejada", nunca como "a visitar".
- **Exemplo 19/11** (atendimentos do Clube × clientes com check-in): TCA **189 × 134**; MCD 257 × 266; TPH 626 × 585.
- **Hoje fora da regra:**
  - `functions/api/tv-vendedor.js:148` e `:166`: visita = check-in **ou** status (o maior dos dois).
  - `public/tvapp.html:674` (TV): visita = qualquer cliente que não esteja AGENDADO/ABERTO.
  - `functions/_lib/jota/escopo.js:65-66`: `visitas_rota` do Clube.
  - `functions/api/central-snapshot.js:168-170`: o maior entre a cascata do gerente e o Clube.
  - A Liga (`liga-clube.js:127`) usa só o check-in. É a definição certa para os lances.

### 3.16 Justificativas de não venda
- **Definição:** motivo registrado pelo vendedor no Clube para o cliente que não comprou, com "dias sem comprar".
- **Fonte oficial:** `clube_justificativa` (atenção: `data_hora` em UTC; o check-in está em horário de Brasília).
- **Por nível:** soma (contagem por motivo e por vendedor).
- **Regra:** "visitou e não vendeu" = justificou **e não tem pedido do cliente hoje** (`momentos.js:107-108`).
- **Hoje fora da regra:** os "dias sem comprar" do Clube e a última compra do GEROT/ficha dão números diferentes. `momentos.js:108` troca pela data do GEROT; `liga-clube.js:186-189` (pênalti) usa o número do Clube. Decidir uma (proposta: a do GEROT/ficha, como em `momentos.js`).

### 3.17 Mix (SKU por cliente)
- **Definição:** média de produtos diferentes por cliente positivado no mês.
- **Fonte oficial:** GEROT `"SKU / Cliente (mix)"` no nível. **Não soma nem faz média** entre filhos.
- **Hoje fora da regra:**
  - `functions/_lib/jota/respostas/resumo.js:268` (cartão do vendedor): mix da produtividade do CEVEN (`escopo.js:77`, `produtividade.mix_mes`), parado com a trava de 16/11.
  - `functions/api/vendedor-detalhe.js` (celular): `mix_mes` e `media_sku` do CEVEN e do Clube.
- **Modelo certo:** `gestao_gerot.js:426-450` (`respMixGerot`), cada nível na sua tabela.

### 3.18 Recorrência (objetivo, meta 80%, positivados)
- **Definição:** clientes da lista de recorrência do dia 1 (objetivo), meta = 80% do objetivo, positivados = clientes da lista que compraram no mês.
- **Fonte oficial:** `gerot_recorrencia_pasta`, no nível (`nivel = 'vendedor' | 'supervisor' | 'filial'`). Não soma entre filhos: MCD filial meta **185** × soma dos vendedores 338; TPA 537 × 1.145.
- **Vendedor com duas pastas no mês:** vale só a pasta atual (a que tem `sup` igual ao supervisor de hoje), não a soma.
- **Sem dado:** "recorrência sem leitura do GEROT". A lista de clientes vem de `cliente_focos` (TAG RECORRÊNCIA) e só lista nomes, nunca a meta.
- **Hoje fora da regra:**
  - `functions/_lib/jota/respostas/momentos.js:53` e `functions/_lib/jota/entende.js:488`: somam todas as pastas do vendedor. **TCV 352 Tamara: pasta 543 (objetivo 25, meta 20, positivados 11) + pasta 22 velha de 11/11 (objetivo 5) = objetivo 30.**
  - `momentos.js:363` e `entende.js:676`: supervisor achado por `nome LIKE '%primeiro segundo%'` (pode pegar outro supervisor com o mesmo nome).

### 3.19 Curva negativa / clientes sem compra no mês
- **Definição:** clientes da carteira do vendedor **sem faturamento e sem pedido em carteira no mês** (`"Positivação (filial + CNPJ)"` = 0 e `"Positivação + Carteira"` = 0), ordenados por quem comprou no mês passado.
- **Fonte oficial:** `gerot_cliente_mes`. Última compra: `ficha_cliente.$.ult` + pedidos do GEROT e do Clube (`rota.js:915` `ultimaCompraGerot`).
- **Por nível:** lista por vendedor; equipe e filial = união das listas (o mesmo CNPJ aparece uma vez).
- **Hoje fora da regra:**
  - `functions/_lib/jota/respostas/periodos.js:80-86` (`respClientesSemComprar`): usa os JSON do GitHub (`vendas_mes`), parados.
  - `functions/_lib/jota/respostas/resumo.js:279-298` ("faltam N positivações" no cartão do vendedor): roteiro do mês do CEVEN + `vendas_mes` + `mix_hist`.
  - Já seguem a regra: `entende.js:1520-1534`, `bomdia_gestao.js:49`, `matinal.js:51-56`, `gestao_gerot.js:321` (`respGapClientes`).

### 3.20 Margem
- **Definição:** margem de contribuição em R$ e em % (% = margem ÷ faturado líquido; MCD: 239.340 ÷ 3.695.067 = 6,48%, igual ao GEROT).
- **Fonte oficial:** GEROT `"Margem de contribuição (R$)"` (soma) e `"(%)"` (no nível, ou recalculada com as somas).
- **Hoje:** só `gestao_gerot.js:39-50` usa, e soma os R$ antes de dividir. Segue a regra.

### 3.21 Cortes
- **Definição:** itens que o Winthor tirou do pedido no mês, em R$ e em unidades, separados em comercial e logístico.
- **Fonte oficial:** GEROT `"Corte comercial / logístico / total (R$ e un)"` no nível. Soma.
- **Hoje fora da regra:** `functions/_lib/jota/respostas/operacao.js:13-30` e `vendas.js` (`respPedidosStatus`) usam o corte por pedido do CEVEN/`pedido_status` (esparso e parado). Modelo certo: `gestao_gerot.js:357-378` (`respCortesGestao`).

### 3.22 Indústrias (meta, faturado, carteira, positivação por fornecedor)
- **Fonte oficial:** `gerot_vendas` (vendedor × fornecedor): meta, faturado, carteira. Somam.
- **Positivação por indústria:** clientes distintos (`gerot_cliente_forn_mes`) ou o nível (`posReal`). **Nunca soma de vendedores.**
- **Meta de clientes por indústria:** só existe na Premiação (RV, API externa). Fica fora da base única até ser gravada no D1.
- **Hoje fora da regra:**
  - `functions/api/matinal.js:199-210` (painel da Matinal): positivação e necessidade por indústria somadas por supervisor, filial e Brasil.
  - `functions/_lib/jota/respostas/gerot_industria.js:95`, `:155`, `:158`: soma a positivação (pelo menos rotulada "soma dos vendedores").
  - `escopo.js:42`: Necessidade de cada indústria somada como a do vendedor (3.8).

### 3.23 TAGs / clientes foco
- **Definição:** campanhas ativas por cliente (RECORRÊNCIA, indústria foco), com vendedor e cor.
- **Fonte oficial:** `cliente_focos` (gravada pelo `cron-ceven-admin`; 54.169 linhas, 11 filiais, 19/11). Reserva: `roteiro_mes_json[].focos`.
- **Regra:** vendedor sem nenhuma TAG gravada = "TAGs desconhecidas" (a Liga não gera resgate nem defesa). Nunca "nenhum cliente com a TAG".
- **Atenção:** `docs/MAPA_DADOS_JOTA.md` (16/11) ainda diz "cliente_focos vazia". Já não está.

### 3.24 Compromisso e RET do supervisor
- **Fonte oficial:** `supervisores_dia` (`tipo = 'compromissos' | 'ret'`), lida por `/api/tv-supervisores`.
- **Regra:** compromisso fecha às 10h; depois só a leitura final. RET = visitas do supervisor com o vendedor.
- **Hoje:** fonte única. Sem conflito medido.

### 3.25 Lances da Liga (cada tipo e a sua prova)
Gerador atual: `functions/api/liga-clube.js` (Clube + GEROT). Regras e pontos: `public/pontuacao_brasileirao.json`. **Positivado = pedido do cliente** (no Clube ou no GEROT); a "conta do Clube que fecha" não vale mais como prova (`liga-clube.js:132-134`).

| Lance | Prova exigida (fonte) | Linha | Observação |
|---|---|---|---|
| Pedido na rota | check-in do cliente (`clube_checkin`) + pedido do mesmo cliente e vendedor no dia (`clube_pedido`, `gerot_pedido`, `gerot_pedido_entrada`/`gerot_carteira` por CNPJ) | 137-142 | — |
| Defesa | o mesmo + TAG RECORRÊNCIA do CNPJ (`cliente_focos`) | 143 | — |
| Resgate de inativo | pedido do dia + última compra > 30 dias (varejo) / > 90 (AS), sem a TAG; vendedor com TAGs conhecidas | 144 | última compra: `ficha_cliente` + `gerot_pedido` |
| Hat-trick | 3 visitas seguidas com pedido | 147 | — |
| Máquina de conversão | 8+ visitas com check-in e 50%+ com pedido | 148 | — |
| Goleada | 10+ clientes visitados com pedido | 149 | — |
| Super pedido | digitado do dia ≥ R$ 15 mil (varejo) / R$ 75 mil (AS) | 150-151 | **usa o colocado do Clube** (`clube_venda_dia.total_pedido`). O `MAPA_DAS_FONTES.md` §5 diz "gol de pedido só com pedido aceito no Winthor" (ver conflito 12) |
| Relâmpago / Acréscimos | check-in com pedido antes das 9h (10h no fuso) / entre 16h30 e 18h (17h30 e 19h) | 153-156 | — |
| Dobradinha das quinzenas | pedido hoje + pedido do mesmo cliente de 1 a 15 (`gerot_pedido`) | 158 | 1.563 lances desde 17/11, o 2º tipo mais comum: vale uma auditoria |
| Marca própria / Tripla | R$ 50+ de MP no pedido (`gerot_pedido_entrada.mp`, limitado ao MP do cliente no mês em `gerot_cliente_forn_mes` 24318) / 3+ clientes assim | 160-164 | — |
| Dobrou o mix | SKUs do pedido de hoje × média dos pedidos anteriores (`gerot_pedido_entrada.skus`) | 163 | — |
| Meta do 1º tempo | digitado antes das 14h ≥ meta × dias úteis **até hoje** ÷ dias úteis do mês | 165-170 | o regulamento diz "meta proporcional **diária**"; a conta usa a **meta acumulada do mês** (4 lances em novembro). Ver conflito 12 |
| Campeão | faturado do mês (GEROT) ≥ meta (GEROT), 1 vez no mês | 173 | `pontuacao_brasileirao.json:58` ainda diz "no CEVEN" |
| Vermelho / gol contra de devolução | nota do dia (`ceven_devolucao_nota`) com motivo oficial (`devolucao_nota_motivo`): "CLIENTE NÃO PEDIU" = vermelho; motivo comercial = gol contra | 176-180 | sem motivo lido = nada |
| Pênalti | justificativa "estoque suficiente" + 30 dias sem comprar / "fechado" + 45 dias (`clube_justificativa.dias_sem_comprar`) | 188-189 | dias sem comprar do Clube (ver 3.16) |
| Impedimento 00:00 / GPS | check-in = check-out / check-out a mais de 500 m e até 5 km do cadastro (`ceven_gps_visita`) | 190, 194-202 | — |
| Amarelo / Vermelho de abandono | rota no Clube e nenhum check-in até 10h / 11h (11h / 12h no fuso) | 204-206 | — |

**Cabeçalho desatualizado:** `liga-clube.js:8-10` lista como "sem fonte ainda" marca própria, tripla, mix, meta do 1º tempo, GPS, devoluções e dobradinha, mas o código já gera todos eles.

### 3.26 Fechamento do mês
- **Definição:** a foto do mês fechado: faturado líquido (bruto − devolução), meta, positivação e o que ficou pendente.
- **Fonte oficial:** GEROT do mês fechado, **no nível**: `gerot_filial_mes` (filial e Brasil), `gerot_supervisor_mes` ou a regra de equipe (3.27), `gerot_vendedor_mes` (vendedor). Positivação no nível (3.9).
- **Hoje fora da regra:**
  - `functions/_lib/jota/entende.js:876-878`: equipe, grupo e vendedor = soma dos vendedores, com a positivação somada.
  - `functions/_lib/jota/entende.js:879-884`: a filial passa para o total do GEROT (correto), mas as linhas por vendedor (`:887-890`) continuam a soma. Total e linhas podem não fechar.
  - `functions/_lib/jota/entende.js:358-368` (posição do supervisor no Brasil): foto do **CEVEN** (`varredura_central_rca`), rotulada "(GEROT, mês fechado)".

### 3.27 Equipe e nome do supervisor (a dimensão que todos os KPIs usam)
- **Definição:** quem é de qual supervisor e grupo. **Fonte oficial (CLAUDE.md, 05/10): Gestão de Equipe.**
- **Medido em 22/11:**
  - em **60 vendedores** a Gestão de Equipe (`supervisor_gestao`) diz um supervisor e a árvore do CEVEN diz outro;
  - em **46 vendedores** a Gestão diz um e o GEROT (`cod_sup`) diz outro;
  - **78 vendedores** da Gestão não têm linha no GEROT;
  - 5 supervisores com meta no GEROT não têm ninguém com o nome deles na Gestão (MCD 542 Tiago Martines Otaviano, TBL 78 Fábio Furlan Machado, TCV 543 Gabriel Giroto, TPA 119 Rafael da Silva Carpena, TPH 55 Vitor Manuel Paulos Correia).
- **Por que importa:** o total do supervisor vem da linha do GEROT (equipe do GEROT) e as linhas vêm da Gestão (outra equipe). **MCD 62 Thiago da Silva Conegundes:**

| Recorte | Vendedores | Faturado | Meta |
|---|---|---|---|
| Linha do supervisor no GEROT (`gerot_supervisor_mes`) | 11 linhas (9 com valor) | **R$ 1.493.195** | **R$ 4.069.528** |
| Equipe pela árvore do CEVEN | 9 | R$ 1.493.195 | R$ 4.069.528 |
| **Equipe pela Gestão de Equipe** | 7 (414 e 1068 foram para outro supervisor) | **R$ 1.228.322** | **R$ 2.694.930** |

  Em 18 dos 75 supervisores com meta, a meta da linha do GEROT difere em mais de R$ 1 mil da soma da equipe da Gestão (TPA 31 Jeferson: R$ 800 mil × R$ 1,83 mi; TPA 30 Douglas: R$ 1,61 mi × R$ 587 mil).
- **Regra proposta:** equipe = Gestão de Equipe. **Total do supervisor = soma dos vendedores da equipe** (R$ pelo `gerot_vendedor_mes`, positivação pela regra 4). A linha `gerot_supervisor_mes` fica só como conferência e mostra a diferença no painel "Divergências" da Gestão. Casar sempre pelo **código** (vendedor e supervisor), nunca pelo nome.
- **Hoje fora da regra:**
  - `functions/_lib/arvore_ceven.js:186-188`: o `/api/tv-mostra` **sobrescreve** o supervisor da Gestão pelo da árvore do CEVEN (parada em 13/11) e guarda o da Gestão em `supervisor_gestao`. Todo leitor de `v.supervisor` (JOTA `escopo.js:89`, Liga `liga-clube.js:49`, TV) usa a árvore, não a Gestão.
  - `functions/_lib/jota/respostas/resumo.js:36-52` (`posGerotSupervisor`), `:140-149` e `:328-335` (`totaisOficiais`): total do supervisor = linha do GEROT; as linhas = `E.vend` (Gestão/árvore).
  - `functions/_lib/jota/respostas/gestao.js:156-158` (`respTendencia`), `:211-214` (`respMaiorAtrasoMeta`), `functions/_lib/jota/respostas/matinal.js:30` e `functions/api/matinal.js:165`: supervisor por **parte do nome** (`includes`).
  - `functions/_lib/jota/respostas/gestao.js:327-333` (`respMatinal`): pelo código do supervisor do GEROT (equipe do GEROT, não a da Gestão).
  - `functions/_lib/monitoria/analista.js:88-91`: linha do GEROT pelo código do primeiro vendedor da equipe.

---

## 4. Conflitos encontrados (do mais grave para o menos grave)

Gravidade: **A** = número errado na frente de gerente ou diretoria, ou total que não fecha com as linhas · **B** = o mesmo KPI com duas contas em telas diferentes · **C** = rótulo trocado ou risco que ainda não aparece.

| # | Grav. | KPI | Onde (arquivo:linha) | O que acontece | Exemplo medido |
|---|---|---|---|---|---|
| 1 | A | Supervisor: total × linhas | `resumo.js:36-52`, `:140-149`, `:328-335`; `escopo.js:89-90`; `arvore_ceven.js:186-188` | total = equipe do GEROT; linhas = equipe da Gestão/árvore | MCD 62 Thiago: total **R$ 1,49 mi / meta 4,07 mi** × linhas **R$ 1,23 mi / meta 2,69 mi**; 18 de 75 supervisores com meta diferente |
| 2 | A | Positivação (TV da filial) | `tvapp.html:1458-1465` | soma os vendedores sobre a meta da filial | MCD **81,8%** (1.202 de 1.470) × oficial **64,2%** (943); TSJ 88,5% × 71,6%; TPA 80,5% × 69,6% |
| 3 | A | Faturado, carteira e positivação ("bom dia" do gerente) | `bomdia_gestao.js:28`, `:32` | soma os supervisores, tira os "Hist/INTERNO/EMPRESA" e soma a positivação | MCD faturado **R$ 4,10 mi × 3,70 mi**; positivação **44% × 65%**; TPH carteira R$ 2,26 mi × 2,34 mi |
| 4 | A | Meta R$ do vendedor | `escopo.js:69` (+ `central-snapshot.js:161`, `:183`) | meta 0 no GEROT → usa a `meta_hierarquia` de 03/11 | MCD 416 Claudimir: **R$ 0 (GEROT) × R$ 1.636.296**; +R$ 1,92 mi de meta em 5 vendedores de MCD |
| 5 | A | Necessidade por dia útil | `escopo.js:42`; `resumo.js:352`, `:258`, `:321`; `gestao.js:221`; `momentos.js:258`, `:416`, `:499`, `:618`; `matinal.js:61`; `motor.js:150-156`; `api/matinal.js:209`; `bomdia_gestao.js:32` | 4 contas: GEROT, (meta − fat. − cart.) ÷ dias, soma das indústrias, soma dos filhos | MCD **R$ 832.633 (GEROT) × R$ 968.935 (JOTA) × R$ 907.689 (indústrias)**; TPH vendedor 100: R$ 0 × R$ 269,81 |
| 6 | A | Ritmo / tendência | `resumo.js:112`, `:154-156`, `:177`, `:195`; `gestao.js:55`, `:131`; `matinal.js:37`; `analista.js:95` | 4 réguas, duas rotuladas "(GEROT)" sem ser do GEROT; supervisor e vendedor nunca recebem o ritmo do GEROT | MCD: **70,7% (GEROT) × 58,4% × 54,2% "Tendência (GEROT)" × "38,2% contra 68%"** |
| 7 | A | Positivação: grupo, linhas, proativo, fechamento | `resumo.js:127-129`; `rota.js:176-177`; `motor.js:157-158`; `analista.js:79-80`; `entende.js:876-878`, `:900-902`; `api/matinal.js:207` | soma de vendedores ou supervisores | MCD vendedores 1.234 · supervisores 1.223 · grupos 1.202 × oficial **943**; meta: soma 2.926 × **1.470** |
| 8 | B | Bloqueados (carteira) | `gestao.js:288`; `gestao.js:227-252`; `analista_senior.js:62-65`; `operacao.js:13-30` | 3 fontes: GEROT, valor do Clube, `pedido_status` 7 dias | TPH **303 ped. R$ 549.971 (GEROT) × R$ 487.703 (Clube) × 26 ped. R$ 200.330** |
| 9 | B | Faturado da filial na TV e nas linhas do JOTA | `tvapp.html:1458`; `escopo.js:47-59` | TV soma só "mostra = SIM"; o JOTA não tem os RCAs fora do CEVEN (RCA 2 de MCD, −R$ 405 mil) | TBL **44,3% × 57,7%**; MCD grupos não fecham com a filial por R$ 405 mil |
| 10 | B | Digitado e nº de pedidos do dia | `escopo.js:54`; `resumo.js:203`, `:212`, `:261`; `bomdia_gestao.js:53`; `matinal.js:76`; `gestao_gerot.js:177`; `tv-vendedor.js:163` | `clube_venda_dia` × `clube_pedido`; "pedidos" que são clientes; TV usa o maior de dois números | TCV 19/11 **R$ 1.001.761 × R$ 868.983**; ABC "320 pedidos" (são clientes) × 420 pedidos |
| 11 | B | Positivação do dia | `tv-vendedor.js:164`; `tvapp.html:1466`; `escopo.js:54`; `gerot_painel.js:81` | rota com pedido × clientes com pedido × faturada | — (definições diferentes com o mesmo nome) |
| 12 | B | Liga: super pedido e meta do 1º tempo | `liga-clube.js:150-151`, `:165-170`; `pontuacao_brasileirao.json:58` | super pedido com o colocado do Clube; meta do 1º tempo = meta acumulada do mês (regulamento: diária) | meta 1º tempo: 4 lances em novembro |
| 13 | B | Recorrência do vendedor | `momentos.js:53`; `entende.js:488`; `momentos.js:363`; `entende.js:676` | soma a pasta velha; supervisor por `LIKE` no nome | TCV 352: objetivo **30 × 25** |
| 14 | C | Rótulos trocados | `tvapp.html:1464`; `metas-mes.js` (`fonte`); `entende.js:367`, `:1322`; `resumo.js:112`, `:156`; `pontuacao_brasileirao.json:58`; `tv-vendedor.js:269`; `liga-clube.js:8-10` | "CEVEN" sobre número do GEROT e o contrário; comentários que não batem com o código | ver as fichas |
| 15 | C | Dias úteis | `resumo.js:97`, `:153`, `:192`; `api/matinal.js:40-41`; `cron-lances.js:39` | decorridos +1 no fim de semana; restantes sem hoje; um sem feriado | domingo 22/11: 14 × 13 decorridos |
| 16 | C | Visitas | `tv-vendedor.js:148`, `:166`; `tvapp.html:674`; `escopo.js:65-66`; `central-snapshot.js:168-170` | atendimento do Clube × check-in × "o maior" | TCA 19/11: **189 × 134** |
| 17 | C | Mix do vendedor | `resumo.js:268`; `escopo.js:77`; `vendedor-detalhe.js` | CEVEN parado × GEROT | — |
| 18 | C | "Meta clientes" como reserva da meta de positivação | `api/matinal.js:54`; `gestao.js:306`; `resumo.js:24`, `:40`; `central-snapshot.js:74`; `resumo_base.js:134`; `analista_senior.js:82`, `:102` | carteira usada como meta se a meta vier vazia | hoje 0 casos; 427 vendedores com os dois números diferentes |
| 19 | C | Curva negativa (2 contas) | `periodos.js:80-86`; `resumo.js:279-298` | JSON do GitHub parado × GEROT | — |

---

## 5. Decisões do Vitório (todas fechadas em 23/11/2026)

1. **Equipe do supervisor: Gestão de Equipe ou árvore do CEVEN?** **DECIDIDO (23/11):** Gestão de Equipe (`config_equipe_soberana`), com total do supervisor = soma da equipe dele (conflito 1) e linha explícita `fora das equipes` para fechamento dos totais.
2. **Meta de positivação de grupo e de equipe da Gestão** (MCD Cleverson/Adriano, TPH Vagner/Fábio): **DECIDIDO (23/11):** realizado pela regra 4 (clientes distintos em `gerot_cliente_mes`) + campo manual `metas_pos_grupo` na tela Gestão de Equipe (`public/gestao-equipe.html`, painel Diretoria gravando em `config_equipe_soberana`), lido por `functions/_lib/fatos/kpis.js`, `escopo.js`, `bomdia_gestao.js` e `/api/metas-mes`. Sem meta cadastrada = `null`.
3. **Digitado do dia:** **DECIDIDO (23/11) — mantido `clube_venda_dia` como fonte oficial.** Auditoria no D1 (`19/11` e `23/11`) comprovou que `clube_pedido` perdia RCAs homônimos ativos inteiros (`TCV 361` R$ 76.581/R$ 11.559, `TCV 364` R$ 31.835/R$ 4.113, `TPA 138` R$ 48.165/R$ 8.476, `TPA 1210` R$ 855/R$ 670) e outros RCAs (`TPA 1207/1208/1209`, parte de `TCV 362`), além de incluir `GERA` (MCD 19/11 R$ 209k) e `Recusado Winthor`. Corrigida a resolução de homônimos em `pipeline/clube_coletor.mjs`.
4. **Liga (3 regras + TOPEI 9169) — versão `2026-11-23.1`:** **DECIDIDO (23/11):** (a) `gol_meta1t` = meta diária (`meta / totU`); (b) `gol_super` = valor aceito no Winthor/GEROT do dia (sem dupla contagem e sem devolução); (c) pedido no `clube_pedido` antes das 10h/11h (11h/12h fuso) livra o cartão `ven10`/`vis11`, mantendo check-in obrigatório para gols de visita; (d) TOPEI restrito apenas ao SKU `9169` (*Bisc Palito Creme Avelã Cacau*) em `pipeline/gerot_carteira.mjs` com `f.forn_cod = '17097'` (*Indústria de Alim. Gonçalves Ltda*) incluído no `capMp` de `functions/api/liga-clube.js`.

## 6. Ordem sugerida de correção (quando o Vitório mandar)
1. Uma camada de leitura por KPI (o `functions/_lib/fatos/` proposto em `MAPA_DADOS_JOTA.md` §3), com a positivação por nível e a regra 4 para grupos. Resolve os conflitos 2, 3, 7, 9 e 13.
2. Equipe pela Gestão e total do supervisor = soma da equipe (conflito 1), depois da decisão 1.
3. Ritmo e necessidade só do GEROT, em todos os níveis (conflitos 5 e 6), e uma função de dias úteis (15).
4. Tirar a reserva `meta_hier` quando o GEROT tem o vendedor (conflito 4).
5. Carteira e bloqueados só de `gerot_carteira` (conflito 8).
6. Rótulos (conflito 14). Os cron-* e a Liga ficam por último (Projeto B, só com o pedido do Vitório).

Trava para não voltar: um teste em `testes/` que, para cada filial, compara o total de cada resposta com a soma das linhas (R$) e a positivação com `gerot_filial_mes`, e falha se não fechar.

---

## 7. Como foi medido (22/11/2026, só SELECT no D1 de produção)
- GEROT filial × soma dos vendedores × soma dos supervisores, 13 campos, 11 filiais (`gerot_filial_mes`, `gerot_vendedor_mes`, `gerot_supervisor_mes`, mês 2026-11).
- `gerot_vendas` somado por filial e por vendedor (Necessidade e positivação).
- `meta_hierarquia` × GEROT por filial e por vendedor.
- `gerot_carteira` por situação × "Carteira pendente"; bloqueados por três caminhos.
- Positivação recontada em `gerot_cliente_mes` (CNPJ com faturado líquido somado > 0), que reproduz as 11 filiais.
- Gestão de Equipe (`config_equipe_soberana`) × `arvore_supervisores` × `gerot_vendedor_mes.cod_sup`.
- Clube de 19/11: `clube_venda_dia` × `clube_pedido` × `clube_checkin` × `clube_justificativa` × `pedido_status`.
- `gerot_recorrencia_pasta` por nível; `tv_lances` por tipo desde 17/11.
- Simulação da TV (`renderTotais`) com a regra do código e os números do GEROT por vendedor.

## Histórico
- 22/11/2026 — Documento criado (proposta). Medido no D1 de produção, só leitura. Nenhum código alterado.
- 23/11/2026 — **Correções no código (camada `functions/_lib/fatos/`: `diasUteis`, `kpisMes`, `carteira`, `linhasQueFecham`, `positivacaoRegra4`, `positivacaoPorGrupos`).** Fichas tocadas, o que deixou de estar "fora da regra":
  - **Conflito 1 (3.27):** equipe = `config_equipe_soberana` (o JOTA não usa mais a troca pela árvore do `/api/tv-mostra`); total do supervisor = soma da equipe da Gestão em `gerot_vendedor_mes` (`escopo.js` `kpisDoEscopo`, `resumo.js` `totaisOficiais`/`respResumo`). Ex.: MCD 35 Alyfer: R$ 774.843 / meta 1.751.133 (linha GEROT) → R$ 517.435 / meta 1.250.511 (8 vendedores da Gestão). Filial/grupo abrem "Por supervisor" com a linha "fora das equipes" (total = linhas). A sobra pode ser NEGATIVA e é verdadeira: devolução lançada em RCA sem equipe (MCD RCA 2 −R$ 405 mil; API RCA 2 −R$ 35.451 + 261, 61, 247 = −R$ 37.633).
  - **Conflito 4 (3.4):** `escopo.js` lê o vendedor em `gerot_vendedor_mes` (antes soma das indústrias em `gerot_vendas`); filial com carga do GEROT: vendedor sem linha = 0, nunca `meta_hier` (MCD 416: R$ 1.636.296 → R$ 0). `central-snapshot.js:161/183` continua gravando `meta_hier` (só é lido quando a filial não tem GEROT).
  - **Conflito 2 (3.9):** TV de grupo (`?grupo=`) lê `/api/metas-mes?filial=&grupo=` (regra 4, sem meta de positivação); nunca soma vendedores. Corrigido também `GRUPO` não definido em `renderTotais` (quebrava os totais da TV).
  - **Conflito 3 (3.1/3.9/3.12):** `bomdia_gestao.js` total pela camada fatos (MCD fat.+cart. R$ 3.891.061, positivação 953 de 1.470 = 65%, antes 44%); gerente de grupo vê o grupo.
  - **Conflitos 5 e 6 (3.7/3.8):** ritmo = captação ÷ meta ideal e precisa/dia = necessidade do GEROT em `resumo.js` (resumo, hoje, vendedor, falta, meta do dia), `gestao.js` (`respTendencia`/`respRitmo` com linhas que fecham, `respMaiorAtrasoMeta`), `momentos.js` (4 lugares), `respostas/matinal.js` (equipe pela Gestão, positivação regra 4). Dias úteis na convenção do GEROT (14 decorridos e 5 restantes na segunda 23/11). Rótulos "Tendência (GEROT)" sobre conta do Jota retirados.
  - **Conflito 7 (3.9) parcial:** `rota.js` `respPositivacao` (linhas de filial = GEROT da filial; linhas de supervisor = regra 4). Pendentes: `motor.js:157`, `analista.js:79`, `entende.js:876/900`, `api/matinal.js:207`.
  - **Conflito 8 (3.11) parcial:** `gestao.js` bloqueados só `gerot_carteira` (valor e "Bloqueio comercial"). Pendentes: `analista_senior.js:62-65`, `operacao.js:13-30`.
- 23/11/2026 (noite) — **Publicado `tv-20261123-202225` · testes locais `543/543` · auditoria papéis `48/48` · Gabarito `209/209` (`PASSOU: 100% em todos os papéis e critérios`):**
  - Fechadas as decisões 2, 3 e 4 (camada `fatos/kpis.js` com TTL de 30s no cache de filial, positivação manual de grupo em `gestao-equipe.html`, `clube_venda_dia` oficial com fix de homônimos em `clube_coletor.mjs`, Liga `2026-11-23.1` + TOPEI SKU `9169` / fornecedor `17097`).
  - JOTA (`gestao_gerot.js`, `intencao.js`, `central-snapshot.js`, `painel_industrias.js`, `gerot_industria.js`, `escopo.js`, `resumo.js`, `liga_mix.js`): eliminadas as 9 falhas anteriores e os últimos desvios do Gabarito (`S068`, `G114/127/140`, `G141/142` com inclusão de `RCA <empresa>` PJ em `pessoaReal` e `foraC` para grupo/equipe, `D182-D185`, `D195/D206`, `D203/D205` rodapé da Liga). Indústrias agora filtram supervisores da Gestão de Equipe com atendimento ativo + linha `fora das equipes / ajustes`.
  - MONITOR.IA (`piloto.js`): corrigido falso "sem visita" (cruzando `clube_checkin` e `clube_pedido` + checagem de `roteiros > 0`) e linhas em branco quando `tv_lances.obs` é nulo; mantido em **SOMBRA** na terça 24/11 após auditoria das 43 mensagens de hoje.
- 24/11/2026 — **Liga AS, Dia Anterior Clube, Bom Dia Oportunidades, Sábado não é dia útil, MONITOR.IA Fase I & JOTA:**
  - **Liga AS (dupla auditoria):** `liga-as.js` + `gerot-carga.js` (`liga_as_foto_dia`) migraram de `varredura_central_rca` (CEVEN parado em 16/11) para o GEROT (`gerot_vendedor_mes`, `rca NOT LIKE '%|%'`); `tv-lances.js` bloqueia `pen|estoque|` e `pen|fechado|` sem justificativa/cliente sem compra (`dias_sem_compra > 0`); `scratch/build_brasileirao_dataset.py` e `public/brasileirao.html` acumulam temporada oficial out+nov (`13/10` em diante) com labels do canal AS.
  - **Sábado nunca é dia útil + Matinal:** `api/matinal.js` calcula último dia útil exclusivamente seg–sex sem feriado (`strftime('%w', dia) BETWEEN '1' AND '5'`), filtrando `|`, `Histórico`, `VAGO` e zerados ociosos; `scripts/gerar_cards_matinal.mjs` usa totais e positivação oficiais GEROT por supervisor/filial/Brasil; `bomdia_gestao.js` e `gestao_gerot.js` (`MAX(em)` na tabela de devolução por motivo) alinhados.
  - **Bom Dia de Oportunidades:** `momentos.js` (`abertura` diretoria/gerente/supervisor) não exibe vendas/zerados do dia e traz `🎯 Oportunidades de hoje` (visitas planejadas, `< 20` visitas, TAG Recorrência via PK `cliente_focos`, `+30d` via `ficha_cliente`, `prospects_mapa` e `gerot_carteira` bloqueados), além de esconder `"sem check-in"` antes das 09h30 para supervisores e somar `pedHojeCli` em `respOndeEsta`.
  - **Clube D-1:** `clube-carga.js?status_dia=` e `clube_coletor.mjs --api` garantem fechamento automático do dia útil anterior após meia-noite BRT (corrigindo corte das 20h50).
  - **JOTA:** `rota.js` carrega `Meta de positivação` oficial de `gerot_supervisor_mes`; `intencao.js` separa ranking de vendedores em positivação e roteamento de visitas por vendedor; `entende.js` + `analista_senior.js` encaminham perguntas analíticas executivas de indústrias sem venda para o Analista Sênior (GEROT mes/carteira), corrigem `Ver mais`/`Mais`, `Curva negativa` priorizando clientes na rota de hoje (`📍 na rota hoje`), `ehSaudacao`/pontuação/reclamações em `persona.js`/`bot.js`/`entende.js`, sinônimos do Curador e `rca NOT LIKE '%|%'` no fechamento (`entende.js:876`).
  - **MONITOR.IA Fase I (SOMBRA):** `piloto.js` restrito a supervisores com os 4 alertas (compromisso 09h30 BRT, sem check-in 10h00 locais, visitas em `+30d` justificadas sem venda 12h/16h, zerados 14h00 locais); trava pós-deploy de `publicar_tv.js` apontada para `testes/gabarito.mjs`.
