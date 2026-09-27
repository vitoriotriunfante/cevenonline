# Plano de execução — CFTV TV (retomar 27/09/2026, tarde)

Baseado em: `CEVEN_CFTV_REGRAS_LANCAMENTOS.md` (manual oficial) +
`docs/DIRETRIZES_REGRAS_OPERACAO_E_APRESENTACAO_DIRETORIA_2026.md` (regras da liga) +
`analises/CATALOGO_COMPLETO_ENDPOINTS_CEVEN.md` (dicionário com os 63 endpoints do CEVEN,
amostras reais de resposta — CONSULTAR ISSO PRIMEIRO antes de testar endpoint por endpoint) +
investigação de dados feita na manhã de 27/09 (datalake local + API ao vivo + HARs) +
tudo que corrigimos/aprendemos na madrugada de 26→27/09.

**Correção de credencial (27/09 manhã)**: `CEVEN_ADMIN_USER`/`CEVEN_ADMIN_PASS` estavam
desatualizados no Cloudflare Pages, quebrando o painel de supervisores da TV
(`tv-supervisores.js`). Testado, corrigido e republicado — confirmar que continua OK ao
retomar (`curl https://ceven-cftv-matrix.pages.dev/api/tv-supervisores?filial=abc`).

**CORREÇÃO IMPORTANTE (27/09, depois da investigação da manhã)**: o Vitório esclareceu que RET
(`ret-cliente`/`ret-periodo`/`ret-hoje`) é a visita de ACOMPANHAMENTO que o SUPERVISOR faz junto
com o vendedor em campo — não tem nada a ver com o horário da venda em si, e só existe nos
dias/clientes em que o supervisor foi junto (é esporádico, não acontece em toda venda). A seção
1.2 abaixo (que usava `checkin_time` do RET para inferir horário de pedido) **estava errada** —
deixada no documento para registro do que foi investigado e descartado, mas **não usar essa
abordagem**. G01/G06/G10/G11 continuam sem dado confiável e geral disponível hoje (voltando à
conclusão original, antes da investigação de ontem à noite).

---

## 0. Onde paramos (não mexer de novo sem necessidade)

- **Vídeo real funcionando**: motor reescrito para tocar dentro de um `<iframe>` isolado
  (`public/animacoes/player_video.html`), não mais `<video>` direto na página. Isso resolveu a
  tela preta que travava a Smart TV real (TBL).
- **Duração real por vídeo**: o player avisa a duração (`postMessage`) e a TV ajusta o cronômetro
  sozinha — não precisa mais cravar tempo fixo no código quando trocar de vídeo.
- **4 vídeos de gol no ar**: `gol_1` (10s), `gol_2` (20s), `gol_3` (29s), `gol_4` (10s), em
  `public/animacoes/videos/`. Sorteiam entre si, exceto quando o subtipo é conhecido
  (`super_pedido` → sempre `gol_1`, `inativo_recuperado` → sempre `gol_2`).
- **Todos os outros lances** (vermelho, amarelo, impedimento, pênalti, defesa) ainda são só
  vetorial (canvas) — sem vídeo gerado ainda.
- Nada foi commitado ainda nessa leva de mudanças — está tudo no working tree.

---

## 1. GRANDE DESCOBERTA DA MANHÃ — dados que eu tinha errado ao descartar

O Vitório pediu para reinvestigar com rigor os campos que eu tinha marcado como "sem dado
disponível". Ele tinha razão em cobrar isso — três achados novos mudam o que é viável:

### 1.1. Existe um banco de dados histórico local: `analises/pedidos_historico_ceven.db`
312 MB, atualizado 1x/dia (03:00 BRT) por 9 extratores (`pipeline/orquestrador_diario.js`).
29 tabelas, incluindo `pedidos`, `pedidos_historico`, `pedidos_historico_itens`,
`rca_produtividade_live`, `rca_dashboard_financeiro_live`, `devolucoes_itens`, `mix_gap_real`.
**Isso é uma fonte de dado adicional que eu não tinha inventariado antes** — qualquer cálculo
novo deve checar esse banco primeiro, além da API ao vivo.

### 1.2. Horário exato de pedido — ❌ DESCARTADO (RET não é horário de venda)
~~O Vitório mostrou a tela real do app do CEVEN da vendedora (Tamara, TCV) com horário exato
por visita, o que apontou para `/api/rca/ret-cliente`/`ret-periodo` (checkin_time/checkout_time
em ISO completo, testado ao vivo, 200 OK).~~ **Essa pista estava certa quanto ao dado existir,
mas errada quanto ao que ele significa**: RET é a visita de acompanhamento que o SUPERVISOR faz
com o vendedor — só acontece esporadicamente, não em toda venda, e não representa o horário do
pedido em si. Cruzar isso com `historico-cliente` não dá horário confiável de pedido, porque a
maioria dos pedidos não tem RET associado.
- **Conclusão correta, confirmada duas vezes agora**: `pedidos_historico.data_pedido` (datalake)
  e `/api/rca/historico-cliente/{id}` (API) só têm **data**, nunca hora. Não existe hoje uma
  fonte confiável e geral de horário exato de pedido no CEVEN.
- **G06 (Hat-Trick) e G11 (Meta 1º Tempo) continuam sem dado suficiente** — exigem precisão
  entre pedidos (120min) ou corte exato (14h) que a aproximação abaixo não cobre com confiança.

### 1.2-bis. G01 e G10 — IMPLEMENTADOS via horário APROXIMADO (feito 27/09, tarde)
Em vez de esperar o CEVEN expor horário exato (pedido em paralelo, ver seção 9), usamos o
momento em que **a própria TV detecta** `dig_hoje` subir entre duas leituras (ciclo de ~90s)
como proxy do horário do pedido. Implementado em `tvapp.html` e `matrizapp.html`:
- Novo estado `DIG_DETECTADO_EM[id]` (ou `[sig|id]` na matriz): guarda `{valor, em}` sempre que
  o `dig_hoje` de um vendedor aumenta em relação à leitura anterior.
- **G01 (Gol Relâmpago)**: se a detecção aconteceu antes das 9h (10h fuso TCG/MCD/TCA).
- **G10 (Gol nos Acréscimos)**: se a detecção aconteceu às 17h ou depois (18h no mesmo fuso).
- Textos sempre marcados como aproximados ("detectado ~9h · aprox."), nunca apresentados como
  horário exato — mantém a regra "nunca inventa dado" do CLAUDE.md, é uma inferência assumida
  como tal.
- Margem de erro: até ~90s (intervalo do ciclo de leitura). Suficiente para lances de janela de
  horário do dia; **não usar essa mesma técnica para Hat-Trick/Meta 1º Tempo** (exigem precisão
  maior que a margem permite).
- **Ainda não testado na TV real** — próxima ação ao retomar é confirmar visualmente.

### 1.3. Bonificação sem venda (V03) — EXISTE UM PADRÃO REAL, não é campo direto
- Não existe campo `tipo_operacao`/`BONIFICACAO` em nenhuma tabela — isso está confirmado.
- MAS: `pedidos_historico_itens` tem `tipo_registro` (`VENDA` ou `CORTE`) e `valor_total`.
  **Encontrados pedidos reais no datalake com 2 a 9 itens do tipo `VENDA`, quantidade > 0, e
  soma total de `valor_total` = R$ 0,00** (ex.: `TBE1_176305_291000350`, 9 itens, soma zero).
  Isso é o padrão clássico de bonificação/brinde lançado como pedido normal.
- **Regra inferida viável para V03**: pedido com ≥2 itens de tipo `VENDA` e soma de
  `valor_total = 0` (ou muito próxima de zero) = bonificação disfarçada de venda. Precisa
  validar com o Vitório se esse limiar (2+ itens, soma zero) captura os casos reais sem gerar
  falso positivo (ex.: pedido cancelado com valor zerado por outro motivo — ver caso
  `220000261`, que era item misto com CORTE, não bonificação pura).

### 1.4. Conclusão: G04, G05, G08, G09, G12 — o Vitório está certo, "é só ajustar"
Não são "sem dado" — são cálculos que precisam ser escritos em cima do que já existe
(`qtd_skus`, `mix_mes.skus_distintos`, `focos` com tag RECORRENCIA, histórico de compras).
Tratar como trabalho de implementação, não como bloqueio de dado.

---

## 2. PRIORIDADE — dinâmica VAR corrigida (pedido explícito do Vitório)

A estrutura de exibição PRECISA seguir este fluxo, sempre, para qualquer lance (vídeo ou
vetorial):

```
1. LANCE           → vídeo/animação chama atenção (o que já temos)
2. VAR REVISANDO   → pausa dramática ("olha aqui, aconteceu algo") — JÁ EXISTE no motor
                      vetorial antigo ("VAR · REVISANDO O LANCE…" com scan), falta reconectar
                      ao fluxo com vídeo real
3. REPLAY          → repete/destaca o lance de novo (hoje: só acontece no vetorial, falta no
                      vídeo real)
4. DECISÃO FINAL   → fica um tempo bom na tela, com o "porquê" e o direcionamento de ação
                      (JÁ EXISTE — "DECISÃO DO VAR" com nome/motivo/veredito — mas falta
                      aparecer TAMBÉM sobreposto durante o vídeo, não só depois)
```

Hoje (vídeo): LANCE → decisão direto. Faltam as fases 2 e 3 (VAR revisando + replay) entre o
vídeo e a decisão — e a decisão final precisa continuar tendo o tempo bom na tela que já tem.

**Tarefa 2.1**: reestruturar `tocaVideoLance` (ou a lógica que a chama em `proximoVAR`) para
intercalar: vídeo (lance) → tela "VAR REVISANDO" (2-3s) → replay do vídeo (ou segmento dele) →
decisão em texto (mantém os 45s que já tem hoje).

**Tarefa 2.2**: a faixa lateral com "o porquê" (mockup já aprovado) aparece sobreposta desde o
início do vídeo, não só na fase de decisão — juntando com a tarefa 1 do plano anterior.

---

## 3. Gol — 4 variantes de pontuação (Normal / Legal / Lindo / de Placa)

Pedido do Vitório: em vez de vídeos aleatórios sem hierarquia, quer 4 NÍVEIS de gol, cada um
ligado a uma faixa de mérito real, especificado no projeto de pontuação (o manual/livro de
regras). Precisa alinhar critério ANTES de gerar prompt novo — ele pediu para eu reler
gol/impedimento/etc um por um e ver o que dá para calcular (feito na seção 1). Proposta a
validar com ele:

| Nível | Critério proposto | Fonte de dado |
|---|---|---|
| **Gol Normal** | Bateu a cota/meta proporcional do dia (qualquer venda que feche o dia "no verde") | `dig_hoje` vs meta diária pro-rata — já dá para calcular |
| **Gol Legal** | Pedido ≥ R$5.000 no dia (faixa intermediária) | `dig_hoje` — já calculável |
| **Gol Lindo** | Cliente inativo >90 dias recuperado (G07 atual) OU Dobrou o Mix (G03, novo — seção 1.4) | já calculável + novo |
| **Gol de Placa** | Super Pedido ≥ R$15.000 (G02 atual, o que hoje é só "gol") | já calculável |

Cada nível usa um vídeo próprio (já gerados: `gol_1` a `gol_4` — precisa decidir qual vídeo
mapeia para qual nível, hoje o mapeamento é só por 2 subtipos). Uniformização visual dos
prompts (mesma paleta, mesmo "uniforme" do personagem) para quando gerarmos os vídeos dos
outros lances — usar os 4 de gol como referência de estilo.

---

## 4. Cartão Amarelo — revisão específica pedida pelo Vitório

Ele pediu para trabalhar nisso mas ainda não detalhou o quê exatamente. Perguntar amanhã:
condição de disparo (hoje: A01, zero venda até 10h/11h), vídeo próprio, ou textos/veredito.

---

## 5. Hat-Trick e Semana Invicta — regra oficial confirmada, falta o cálculo

Documento da Diretoria (seção 2.3): Hat-Trick = 3 vitórias consecutivas (+3 pontos), Semana
Invicta = 5 vitórias seg-sex (+6 pontos). "Vitória no dia" já está definida no mesmo documento
(seção 2.2: ≥80% agenda + cota proporcional + zero cartão vermelho). Falta decidir e
implementar onde persistir o histórico de "dias vencidos" por vendedor (LOG diário já existe em
localStorage, mas não acumula entre dias — precisaria de storage mais durável, tipo D1).

---

## 6. Reincidência de pênalti — JÁ EXISTE, não é pendência

Confirmado em `tvapp.html:529/537`: a partir do 3º pênalti do dia do mesmo vendedor, aparece
"REINCIDENTE, Xº pênalti hoje". Só validar visualmente se está destacado o bastante.

---

## 7. Scores de prioridade da fila — desalinhados do manual, decidir se corrige

| Lance | Manual documenta | Código usa hoje |
|---|---|---|
| Gol | 20 | 99 |
| Vermelho | 15 | 30 |
| Impedimento | 9 | 20 |

Perguntar ao Vitório: manter como está (gol quase sempre primeiro) ou realinhar ao manual?

---

## 8. Gerar vídeos para os outros 5 lances (+ eventualmente V03/G03/etc quando definidos)

Prompts prontos em `REGRAS_CFTV/PROMPTS_VIDEOS_ANIMACOES_TV.md`. Regras aprendidas ontem:
1. **Conversas SEPARADAS por vídeo no Gemini** — a repetição de cena nos primeiros gols
   aconteceu por manter contexto na mesma conversa.
2. Duração real de cada vídeo é respeitada automaticamente pelo player — não precisa cortar
   para caber em teto nenhum (teto de segurança é 30s, ajustável se precisar).
3. Nomes exatos esperados: `cartao_vermelho_1/2/3.mp4`, `cartao_amarelo_1/2/3.mp4`,
   `impedimento_1/2/3.mp4`, `penalti_1/2/3.mp4`, `defesa_1/2/3.mp4`, salvos em
   `public/animacoes/videos/`.
4. Depois de salvos, restaurar as listas em `VIDEO_ARQUIVOS` dentro de `tv-animacoes.js` (hoje
   vazias `[]` para esses 5 lances).

---

## 9. Limpeza técnica pendente (baixa prioridade)

- `functions/_lib/xlsx_mostra.js` órfão — decidir se apaga ou mantém como fallback.
- `public/animacoes/teste_video.html` — página de diagnóstico; pode apagar ou manter para
  futuros debugs.
- **Verificar/corrigir os secrets `CEVEN_ADMIN_USER`/`CEVEN_ADMIN_PASS`** no Cloudflare Pages —
  login está falhando em produção agora (`{"erro":"login no CEVEN falhou"}`, testado ao vivo
  27/09). NÃO bloqueia mais o horário real de pedido (resolvido via `ret-cliente`, público —
  ver seção 1.2), mas ainda afeta o painel de supervisores (`tv-supervisores.js`), que depende
  do login admin. Prioridade menor que antes, mas ainda vale corrigir.
- Commitar tudo — ainda nada da sessão de ontem/hoje foi commitado. Revisar `git status`/`git
  diff` com calma antes, para não incluir lixo por engano.

---

## Ordem sugerida para retomar

1. Perguntar ao Vitório: critério final dos 4 níveis de gol (item 3, agora usando só G02/G07/G03,
   sem G01/G06/G10/G11 — ver item 1.2) e o que exatamente mudar no cartão amarelo (item 4).
2. Implementar a dinâmica VAR completa — revisando → replay → decisão (item 2), incluindo a
   faixa lateral com o porquê sobreposta ao vídeo.
3. Implementar V03 (bonificação, item 1.3) e G03 (dobrou o mix) — os dois achados novos válidos
   da investigação de hoje (G01/G06/G10/G11 foram descartados, ver item 1.2).
4. Gerar os vídeos dos outros 5 lances, em conversas separadas no Gemini (item 8).
5. Se sobrar tempo: Hat-Trick/Semana Invicta (item 5, depende de decisão de storage) e scores
   de prioridade (item 7).
6. Commitar tudo (item 9) — fazer isso antes de acumular mais uma sessão de mudanças por cima.
