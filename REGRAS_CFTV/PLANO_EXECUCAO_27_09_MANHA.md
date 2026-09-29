# Plano de execução — implementar todos os lances (27/09/2026, manhã) — ✅ CONCLUÍDO

Objetivo: fechar hoje de manhã o cálculo de TODOS os lances do livro de regras que têm algum
caminho de dado (real ou aproximado), deixando marcado com clareza o que é exato e o que é
aproximado. **Meta atingida: G01-G12 (todos os 12 gols), V01-V03, A01, P01-P02, I01-I02, D01 e
Supervisores estão implementados e no ar (versão `tv-20260927-081335`).**
Ao final do dia de amanhã (28/09), validar G01/G06/G10/G11 (aproximados) contra pedidos reais.

---

## 0. Já feito (não mexer de novo)

- G02, G07, V01, V02, A01, P01, P02, I01, I02, D01/G08 — calculados, funcionando.
- G01, G10 — implementados via horário APROXIMADO (`DIG_DETECTADO_EM`).
- G06 (Hat-Trick), G11 (Meta 1º Tempo) — implementados via mesma aproximação, com histórico
  (`DIG_HISTORICO`) e cálculo de meta diária pro-rata (`diasUteisMes()`).
- G03 (Dobrou o Mix) e V03 (Bonificação sem venda) — implementados ao vivo em
  `functions/api/tv-vendedor.js`, usando `/api/rca/historico-cliente/{id}` só para clientes
  positivados hoje (evita custo de N chamadas por vendedor).
- G05 (Máquina de Conversão), G09 (Goleada +10), G12 (Campeão da Rodada) — implementados com
  campos já existentes (`feitas`, `comVenda`, `pos`, `fat`, `meta`).
- G04 (Dobradinha das Quinzenas) — implementado ao vivo, mesma lógica já usada na apresentação
  da diretoria (`analises/reconciliar_item6_slide2.py`): cliente comprou dia 1-15 E dia 16+ do
  mesmo mês.
- Secrets CEVEN_ADMIN corrigidos (painel de supervisores voltou a funcionar).
- Reincidência de pênalti — já existia.

---

## 1. G06 (Hat-Trick) e G11 (Meta 1º Tempo) — aproximados, com aviso

Mesma técnica do G01/G10 (`DIG_DETECTADO_EM`), estendendo:

**G06 — Hat-Trick (3 pedidos em até 120min):**
- Hoje `DIG_DETECTADO_EM` só guarda a ÚLTIMA detecção. Precisa virar um HISTÓRICO por
  vendedor no dia: cada vez que `dig_hoje` sobe, empilha `{valor, em}` numa lista
  (`DIG_HISTORICO[id]`).
- Lance dispara se existirem 3+ entradas nessa lista cujos timestamps de detecção (`em`) caibam
  numa janela de 120 minutos.
- **Aviso obrigatório na tela**: como a detecção tem ~90s de margem cada, 3 detecções em
  120min reais podem, no pior caso, ter sido captadas com folga menor — texto sempre com
  "aprox." e nunca "confirmado".

**G11 — Meta 1º Tempo (bateu meta diária antes das 14h):**
- Precisa da meta diária pro-rata: `metaMensal / diasUteisMes` (já temos `meta_fat` e dá pra
  calcular dias úteis do mês corrente em JS puro).
- Lance dispara se `dig_hoje >= metaDiaria` E a detecção desse cruzamento (primeira vez que
  `dig_hoje` ultrapassa a meta diária) aconteceu antes das 14h.
- Mesmo aviso de aproximação.

**Registrar em ambos os textos**: "Detectado ~Xh · aproximado (ciclo de leitura ~90s)".

---

## 2. V03 — Bonificação sem venda

Padrão identificado no datalake: pedido com 2+ itens tipo `VENDA`, quantidade > 0, soma de
`valor_total = 0`. Esse dado vem do **datalake local** (`pedidos_historico_itens`), não da API
ao vivo que a TV consulta — precisa decidir:
- Opção A: criar um endpoint novo (`functions/api/tv-bonificacao.js`) que reproduz essa
  consulta contra a API ao vivo do CEVEN (não o datalake, que só atualiza 1x/dia às 03h — não
  serve para "ao vivo").
- Verificar antes: a API ao vivo (`/api/rca/historico-cliente` ou outro endpoint) expõe os
  itens de um pedido individual com `valor_total`? Se sim, dá para calcular ao vivo. Se só o
  datalake tem essa granularidade, o lance ficaria defasado em até 1 dia (inaceitável para TV
  "ao vivo") — **checar isso ANTES de implementar**, pode não ser viável em tempo real.

---

## 3. G03 — Dobrou o Mix

- Fonte: `skus_ultima_venda` (histórico) vs. SKUs do pedido atual — ambos disponíveis via
  `/api/rca/historico-cliente/{id}` (já é uma chamada que talvez precise ser adicionada ao
  `tv-vendedor.js`, hoje ele não busca histórico de cliente, só roteiro/dashboard/produtividade).
- Critério do livro: `MixAtual >= 2 × MixHistórico` (ou MixAtual >= 10 se histórico <= 5).
- Implementação: por cliente positivado hoje, comparar contagem de SKUs do pedido mais recente
  vs. média histórica.

---

## 4. G04, G05, G09, G12 — implementar com o que já temos

- **G04 (Dobradinha das Quinzenas)**: cliente comprou 1-15 E 16-fim do mês. Dá para calcular
  com histórico de `data_pedido` (só data, isso já basta aqui — não precisa hora).
- **G05 (Máquina de Conversão)**: `visitas_com_venda / visitas_na_rota >= 50%` E
  `visitas_na_rota >= 8`. Campos já existem em `produtividade.dia`.
- **G09 (Goleada +10 Clientes)**: `pos_hoje >= 10` (clientes distintos positivados no dia) —
  campo já existe (`dig_hoje`/`pos_hoje` do dashboard).
- **G12 (Campeão da Rodada)**: `faturado / meta_fat >= 100%` antes do fim do mês — campos já
  existem (`fat`, `meta`).

Esses 4 não dependem de nenhuma investigação nova — são cálculos diretos sobre campos já
disponíveis em `tv-vendedor.js`. Prioridade alta, mais rápidos de fechar.

---

## 5. Vídeos para os 5 lances restantes

Prompts prontos (`REGRAS_CFTV/PROMPTS_VIDEOS_ANIMACOES_TV.md`). Gerar no Gemini em conversas
SEPARADAS por vídeo (lição de ontem). Salvar em `public/animacoes/videos/` com os nomes exatos,
depois restaurar as listas em `VIDEO_ARQUIVOS` (`tv-animacoes.js`) que hoje estão vazias para
vermelho/amarelo/impedimento/penalti/defesa.

---

## 6. Dinâmica VAR completa (pendente de ontem)

Reestruturar para: LANCE (vídeo) → VAR REVISANDO (pausa) → REPLAY → DECISÃO (texto, tempo bom
na tela). Hoje só tem LANCE → DECISÃO direto no caminho de vídeo. + faixa lateral com o
"porquê" sobreposta desde o início do vídeo (mockup já aprovado).

---

## 7. Ordem de execução sugerida (hoje de manhã)

1. **G04, G05, G09, G12** (seção 4) — mais rápidos, sem investigação extra, maior volume de
   lances novos funcionando de uma vez.
2. **G03** (seção 3) — precisa 1 chamada extra em `tv-vendedor.js`, mas dado já confirmado.
3. **G06, G11 aproximados** (seção 1) — estende o mecanismo que já existe (G01/G10).
4. **V03** (seção 2) — checar primeiro se dá para calcular ao vivo (não só no datalake) antes
   de implementar; se não der em tempo real, documentar como pendente e não inventar.
5. Testar tudo, publicar.
6. Se sobrar tempo: vídeos dos 5 lances (seção 5) e dinâmica VAR completa (seção 6) — essas duas
   são mais longas (dependem de geração externa no Gemini / reestruturação de UI).

**Ao final do dia 28/09**: revisar os lances aproximados (G01, G06, G10, G11) contra pedidos
reais do dia, decidir se a margem de erro está aceitável ou se precisa reduzir o intervalo de
leitura da TV (hoje ~90s) para ganhar precisão.
