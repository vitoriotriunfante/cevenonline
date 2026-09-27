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

**Status em 27/09 fim do dia**: Vermelho (3), Amarelo (3), Impedimento (3) e Pênalti (3) já
têm vídeo real publicado e no ar. **Falta só Defesa** (3 variações) para fechar os 6 lances
principais. Prompts em `REGRAS_CFTV/PROMPTS_VIDEOS_ANIMACOES_TV.md` — os prompts do Pênalti
foram revisados para tom estilizado/câmera lenta (não "flagrante realista", a pedido do
Vitório, para não soar como acusação ao vendedor).

**Hat-Trick e Semana Invicta**: hoje usam animação vetorial (já mostra os valores reais dos
3 pedidos dinamicamente). Vitório pediu vídeo de fundo genérico também para esses dois (1
vídeo cada, sem variações) — prompts já adicionados ao documento de prompts. Como isso muda
o fluxo (perde o "1º GOL·RX, 2º GOL·RY" aparecendo durante a cena, os valores só aparecem na
decisão final depois), ainda não foi implementado no código — só os prompts estão prontos.

**Gerar sempre em conversas SEPARADAS no Gemini** (lição aprendida: manter a mesma conversa
faz o Gemini repetir a cena anterior em vez de criar do zero).

---

## 5. Dinâmica VAR — CONCLUÍDA (27/09, fim do dia)

Estrutura implementada e validada ao vivo pelo Vitório (testou o Gol em `/testar`):
```
1. LANCE          → vídeo real (ou animação vetorial se não houver vídeo pronto)
2. VAR REVISANDO  → pausa dramática ~2.5s
3. REPLAY         → repete o MESMO vídeo do lance (arquivoFixo — não sorteia outro)
4. DECISÃO FINAL  → texto com nome/motivo/valor, fica 45s na tela
```
Implementado em `tvapp.html` (`proximoVAR`) e replicado em `teste-lances.html`
(`simulaLance`). **`matrizapp.html` ainda NÃO tem as fases 2 e 3** — só LANCE→DECISÃO direto
(decisão registrada, não é bug, é pendência de produto a confirmar com o Vitório se vale
igualar).

Bugs sérios encontrados e corrigidos nessa implementação (ver commits de 27/09):
- `tocaVideoLance` nunca estava exposta em `window` — todo vídeo real caía sempre no
  vetorial, silenciosamente, até isso ser corrigido.
- `iniciaReplay()` buscava o `<canvas>` depois que a tela VAR já tinha apagado ele do DOM —
  travava a sequência antes da decisão. Corrigido recriando o canvas antes do replay.
- `escolheVideo()` sorteava de novo a cada chamada — replay podia mostrar vídeo diferente do
  lance (ex: gol normal no lance, bicicleta no replay). Corrigido com `arquivoFixo`.
- Botão FECHAR ficava escondido atrás do vídeo real (`#ov` z-index 99 menor que
  `#video-lance-fixo` 9998). Corrigido: botão global fora de `#ov`, sempre no topo.

A faixa lateral sobreposta (nome/filial/motivo/valor por cima do vídeo desde o início) segue
**não implementada** — decisão explícita do Vitório foi focar em fechar a dinâmica LANCE→VAR→
REPLAY→DECISÃO primeiro; a faixa lateral fica pendente de retomada.

---

## 6. Outras pendências conhecidas (menor prioridade)

- `matrizapp.html` sem a dinâmica VAR→REPLAY completa (ver seção 5) — confirmar com o Vitório
  se vale igualar ao `tvapp.html` ou é intencional (a matriz alterna 11 filiais, pode não
  valer alongar cada lance).
- `tvapp.html`/`matrizapp.html` não esperam `videosProntos()` antes do primeiro lance real da
  sessão (só `teste-lances.html` faz isso) — risco baixo de cair no vetorial no 1º lance do
  dia por corrida, mas é o mesmo padrão de bug já corrigido em outros lugares.
- Critério de disparo da "Semana Invicta" como lance real (não só demo) ainda não foi fechado
  com o Vitório — discussão iniciada 27/09, ideia inicial de ≥80% dos vendedores com rota
  positivando todo dia útil da semana, não decidido.
- **Commits feitos localmente na branch `cftv-triunfante` (27/09), mas SEM PUSH ao remoto** —
  o push foi bloqueado pelo classificador de segurança do Claude Code por causa de um token
  do GitHub exposto na URL do remote (`ghp_...`). Vitório decidiu deixar só local por ora;
  fazer push manual quando quiser, ou resolver a exposição do token primeiro.
- `gestao-equipe.html`, `apresentacao-diretoria.html`, `brasileirao.html` e os endpoints
  `equipe-solicitacoes.js`/`equipe-salvar.js` foram recuperados de um commit órfão (hash
  `4f81029`) que nunca tinha entrado numa branch de verdade — agora commitados e publicados
  no domínio principal `ceven-cftv-matrix.pages.dev` (antes só existiam no domínio custom
  `cftv-triunfante.ceven-cftv-matrix.pages.dev`, fora do controle deste repositório).

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
