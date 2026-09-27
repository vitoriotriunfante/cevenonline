# Estado completo do projeto CFTV — registro central (a partir de 27/09/2026)

Este é o documento de memória real do projeto. A conversa no chat NÃO fica salva automaticamente
entre sessões — este arquivo (e os demais em `REGRAS_CFTV/`) é a fonte confiável do que foi
decidido e implementado. Atualizar sempre que algo mudar.

---

## 1. Resumo executivo (o que é o CFTV)

TV ao vivo estilo transmissão de futebol: cada evento de venda (bom ou ruim) vira um "lance",
com vídeo/animação, tela de "VAR revisando", e decisão final com o motivo e a ação recomendada.
Cobre matriz (`public/matrizapp.html`, 11 filiais) e filial individual (`public/tvapp.html`).

---

## 2. CORREÇÃO IMPORTANTE (27/09, tarde): Hat-Trick é DIÁRIO

O Vitório corrigiu: **o Hat-Trick é sempre diário — 3 pedidos em sequência no mesmo dia.** Não
existe "Hat-Trick de 3 dias/semanas" — isso foi uma leitura errada de um documento antigo
(`docs/DIRETRIZES_REGRAS_OPERACAO_E_APRESENTACAO_DIRETORIA_2026.md`, seção 2.3) que falava de
"3 vitórias consecutivas" num contexto de streak semanal, mas o Vitório esclareceu que o
conceito real do produto é só o diário. **O G06 (Hat-Trick) implementado no código já está
correto** (3 pedidos em até 120 minutos no mesmo dia) — não mexer nisso.

Ação: o aviso que coloquei no documento da liga sobre "não confundir os dois Hat-Tricks" fica
desatualizado agora que sabemos que só existe o diário — revisar/simplificar aquele texto depois
(baixa prioridade, não bloqueia nada técnico).

---

## 3. TODOS os 26 lances — status final (27/09, tarde)

Todos implementados e no ar. Fonte: `public/tvapp.html`, `public/matrizapp.html`,
`functions/api/tv-vendedor.js`. Detalhe técnico completo em
`REGRAS_CFTV/LIVRO_DE_REGRAS_CFTV.md`.

| Lance | Precisão | Onde calcula |
|---|---|---|
| G01 Gol Relâmpago (antes 9h) | ⏱️ Aproximada | `DIG_DETECTADO_EM`, tvapp/matrizapp |
| G02 Super Pedido ≥R$15k | ✅ Exata | `dig_hoje` |
| G03 Dobrou o Mix | ✅ Exata | `historico-cliente` (tv-vendedor.js) |
| G04 Dobradinha das Quinzenas | ✅ Exata | `historico-cliente`, mesma lógica de `analises/reconciliar_item6_slide2.py` |
| G05 Máquina de Conversão | ✅ Exata | `feitas`/`comVenda` |
| G06 Hat-Trick (3 pedidos/120min, DIÁRIO) | ⏱️ Aproximada | `DIG_HISTORICO` |
| G07 Drible da Vaca (>90d recuperado) | ✅ Exata | `ultima_compra` |
| G08 Defesa Milagrosa (=D01) | ✅ Exata | `focos` RECORRENCIA |
| G09 Goleada +10 clientes | ✅ Exata | `pos_hoje` |
| G10 Gol nos Acréscimos (depois 17h) | ⏱️ Aproximada | `DIG_DETECTADO_EM` |
| G11 Meta 1º Tempo (antes 14h) | ⏱️ Aproximada | `DIG_DETECTADO_EM` + `diasUteisMes()` |
| G12 Campeão da Rodada (100% meta) | ✅ Exata | `fat`/`meta` |
| V01 Devolução | ✅ Exata | `devolucao` |
| V02 Abandono de Campo | ✅ Exata | `feitas === 0` |
| V03 Bonificação sem venda | ✅ Exata | padrão: 2+ itens, soma R$0 (`ehBonificacao`) |
| A01 Rota sem venda até 10h/11h | ✅ Exata | `dig`/`pos` |
| P01 Estoque Suficiente >30d | ✅ Exata | motivo + dias |
| P02 Cliente Fechado >45d | ✅ Exata | motivo + dias |
| I01 Visita Relâmpago (00:00) | ✅ Exata | `tempo_visita` |
| I02 GPS fora de campo (>500m) | ✅ Exata | Haversine lat/lon |
| D01 = G08 | ✅ Exata | (mesmo que acima) |
| Supervisores (compromisso+RET) | ✅ Exata | `tv-supervisores.js` (secret corrigido hoje) |
| Reincidência pênalti (3+/dia) | ✅ Exata | contagem no LOG |

**Aproximação explicada**: o CEVEN não expõe horário exato de pedido (só data). Usamos o
momento em que a TV detecta `dig_hoje` subir (ciclo ~90s) como proxy. Sempre marcado "aprox."
na tela. Pedido formal ao time do CEVEN para expor horário real: pendente de enviar (texto já
pronto, ver histórico de conversa anterior — reconstruir se necessário).

---

## 4. Vídeo real — arquitetura (resolvido depois de muitas tentativas)

**Causa raiz do bug "tela preta"**: o `<video>` vivia dentro de `#ov`, que é resetado
(`innerHTML = ''`) toda vez que um novo lance/teste abre — isso destruía o vídeo de forma
abrupta mesmo guardando a referência em JS. Correção: vídeo agora roda dentro de um `<iframe>`
isolado (`public/animacoes/player_video.html`), carregado num container FIXO
(`#video-lance-fixo`) que fica fora de `#ov` e nunca é resetado. Comunicação via `postMessage`.

**Duração real por vídeo**: o player avisa a duração assim que sabe (`loadedmetadata`) via
`postMessage({tipo:'duracao', segundos})`, e a página ajusta o cronômetro para aquele valor real
— nunca corta nem estica artificialmente. Teto de segurança de 30s se o aviso não chegar.

**4 vídeos de gol no ar** (`public/animacoes/videos/`): `gol_1.mp4` (10s), `gol_2.mp4` (20s),
`gol_3.mp4` (29s), `gol_4.mp4` (10s). Sorteiam entre si; `super_pedido`→sempre gol_1,
`inativo_recuperado`→sempre gol_2.

**Outros 5 lances (Vermelho, Amarelo, Impedimento, Pênalti, Defesa)**: ainda só vetorial
(desenho em canvas). Prompts prontos em `REGRAS_CFTV/PROMPTS_VIDEOS_ANIMACOES_TV.md` (3
variações cada = 15 vídeos). **Gerar em conversas SEPARADAS no Gemini** (lição aprendida: manter
a mesma conversa faz o Gemini repetir a cena anterior em vez de criar do zero).

---

## 5. Dinâmica VAR — o que falta (pedido do Vitório, ainda não implementado)

Estrutura correta pedida:
```
1. LANCE          → vídeo/animação chama atenção
2. VAR REVISANDO  → pausa dramática (JÁ EXISTE no motor vetorial antigo, falta reconectar ao vídeo)
3. REPLAY         → repete/destaca o lance de novo (falta implementar no caminho de vídeo)
4. DECISÃO FINAL  → fica tempo bom na tela com o "porquê" e direcionamento (JÁ EXISTE, 45s)
```

Hoje (vídeo): LANCE → decisão direto, sem fase 2 e 3. **Prioridade de hoje**: implementar essas
duas fases faltantes no caminho de vídeo, e também a faixa lateral com "o porquê" (nome, filial,
motivo, valor) SOBREPOSTA desde o início do vídeo (mockup já aprovado antes, publicado como
artifact — reconstruir se o link não estiver mais acessível).

---

## 6. Outras pendências conhecidas (menor prioridade)

- `functions/_lib/xlsx_mostra.js` órfão (decidir apagar ou manter fallback).
- `public/animacoes/teste_video.html` — página de diagnóstico do bug de vídeo, pode apagar.
- Nada foi commitado ainda em toda essa sessão — revisar `git status`/`git diff` com calma antes
  de commitar (muita coisa mudou, cuidado para não incluir lixo).
- Scores de prioridade da fila divergem do manual antigo (Gol manual=20, código=99) — decidir se
  alinha ou mantém como está (código prioriza gol mais agressivamente).

---

## 7. Correções de infraestrutura feitas hoje

- **Secrets `CEVEN_ADMIN_USER`/`CEVEN_ADMIN_PASS`** estavam desatualizados no Cloudflare Pages,
  quebrando `tv-supervisores.js`. Corrigido e republicado, confirmado funcionando.
- Endpoint de teste rápido: `curl https://ceven-cftv-matrix.pages.dev/api/tv-supervisores?filial=abc`

---

## 8. Erros de investigação registrados (para não repetir)

- **RET não é horário de venda**: `checkin_time`/`checkout_time` de `ret-cliente`/`ret-periodo`
  é do SUPERVISOR acompanhando o vendedor (visita esporádica), não do vendedor vendendo sozinho.
  Não usar para inferir horário de pedido.
- **`tempo_visita` (ex: "00:03") é DURAÇÃO, não horário do relógio** — confirmado pelo Vitório
  com print real do app.
- Conclusão válida: não existe fonte confiável de horário exato de pedido hoje — daí a
  aproximação por detecção da TV (seção 3 acima).
