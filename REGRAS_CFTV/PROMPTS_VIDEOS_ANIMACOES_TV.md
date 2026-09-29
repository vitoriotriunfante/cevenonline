# Prompts de Vídeo — Animações CFTV (Gemini)

> Status em 27/09/2026: Gol (4), Vermelho (3), Amarelo (3), Impedimento (3) e Pênalti (3) já
> têm vídeo real publicado. **Faltam: Defesa (3 variações) + Hat-Trick (1 vídeo) + Semana
> Invicta (1 vídeo)** — 5 vídeos no total. Ver `REGRAS_CFTV/LIVRO_DE_REGRAS_CFTV.md` para os
> critérios de cada lance e `public/animacoes/tv-animacoes.js` (`VIDEO_ARQUIVOS`) para onde
> plugar os arquivos prontos.

## Regras de geração (importante)

1. **Uma conversa nova no Gemini por lance** (não por variação) — evita repetição de cena/
   personagem entre os 3 vídeos do mesmo lance. Ex.: abra uma conversa só para "Vermelho",
   gere as 3 variações nela, depois abra outra conversa nova para "Amarelo".
2. **Duração alvo: 10-14 segundos** (o LANCE na TV corta entre esse tempo, ±3s de variação —
   ver `REGRAS_CFTV/LIVRO_DE_REGRAS_CFTV.md`, seção Dinâmica VAR). Vídeos mais longos são
   cortados pelo timer, então não precisa forçar exatamente esse tempo, só evitar vídeos muito
   curtos (menos de 8s corta cena antes da hora).
3. **Estilo visual consistente com os gols já prontos**: cenário de estádio/campo genérico
   (sem logo de time real), uniforme neutro (verde para "time da casa"/vendedor, vermelho/azul
   para o "adversário"/situação), câmera estilo transmissão de TV esportiva, iluminação de
   jogo noturno. Sem rostos de pessoas reais, sem marcas registradas de clubes.
4. **Sem áudio de narração** (a TV já tem seu próprio texto/beep) — só ambiente de estádio
   (torcida, apito) se o modelo gerar áudio por padrão.
5. Depois de gerar e baixar, nomear como `<lance>_1.mp4`, `<lance>_2.mp4`, `<lance>_3.mp4` e
   publicar em `/animacoes/videos/` (mesmo processo dos vídeos de gol). Atualizar
   `VIDEO_ARQUIVOS` em `public/animacoes/tv-animacoes.js` com os caminhos.

---

## 🟥 Vermelho (V01/V02 — devolução ou abandono de campo)

**Tom:** grave, disciplinar, sem comemoração — falta clara, juiz irredutível.

**Variação 1 — Cartão direto:**
> Cena de futebol amador em estádio genérico à noite, câmera de transmissão esportiva. Um
> árbitro central, de costas para a câmera, ergue o braço direito com um cartão vermelho bem
> visível, luz vermelha refletindo no cartão. Ao fundo, um jogador de uniforme verde anda em
> direção ao vestiário, cabisbaixo, gesticulando em protesto discreto. Torcida ao fundo
> desfocada, vaias baixas. Sem áudio de narração, só som ambiente de estádio. 10-12 segundos.

**Variação 2 — Devolução/expulsão em câmera lenta:**
> Câmera lenta cinematográfica (slow motion), estádio de futebol à noite, foco no cartão
> vermelho sendo erguido pelo árbitro, gotas de suor visíveis, expressão séria. Corte para um
> jogador de uniforme verde caminhando para fora do campo, olhando para trás uma vez. Luzes do
> estádio em tom avermelhado dramático. Sem narração. 10-14 segundos.

**Variação 3 — Reação da torcida:**
> Plano aberto de arquibancada reagindo com vaias e gestos de reprovação, corte rápido para o
> árbitro mostrando o cartão vermelho em close, corte final para o placar eletrônico do
> estádio piscando em vermelho. Câmera de transmissão esportiva profissional, iluminação
> noturna de estádio. Sem narração. 10-13 segundos.

---

## 🟨 Amarelo (A01 — rota sem venda até 10h)

**Tom:** advertência, tensão moderada — falta grave mas recuperável.

**Variação 1 — Cartão amarelo simples:**
> Estádio de futebol genérico, dia nublado, câmera de transmissão esportiva. Árbitro ergue um
> cartão amarelo com o braço estendido, expressão neutra mas firme. Jogador de uniforme verde
> ao lado, mãos na cintura, balançando a cabeça em concordância contrariada. Sem narração,
> som ambiente de campo. 8-10 segundos.

**Variação 2 — Advertência com apito:**
> Close no apito do árbitro sendo soprado (efeito visual de vibração sonora), corte para o
> cartão amarelo sendo erguido, corte para o time reorganizando a formação em campo, câmera
> aérea leve. Estádio genérico, luz de tarde. Sem narração. 8-11 segundos.

**Variação 3 — Bola parada, reorganização:**
> Jogadores de uniforme verde se reposicionando após a falta assinalada, árbitro anotando algo
> em uma prancheta pequena, cartão amarelo ainda visível na mão. Câmera de transmissão
> esportiva, plano médio, estádio genérico. Sem narração. 8-10 segundos.

---

## 🚩 Impedimento (I01/I02 — visita relâmpago ou GPS fora do local)

**Tom:** técnico, seco, revisão rápida — não é falta grave, é erro de posicionamento. A AÇÃO
acontece (o jogador cruza a linha correndo), não só a reação depois.

**Variação 1 — Corrida e ultrapassagem da linha, ação real:**
> Câmera de transmissão esportiva, campo de futebol genérico, dia. Um jogador de uniforme
> verde corre em direção ao gol, recebe um passe e ultrapassa claramente a linha de marcação
> do último defensor antes da bola chegar — corpo visivelmente à frente. No instante seguinte
> o assistente de arbitragem na lateral levanta a bandeirinha de impedimento e o jogador para
> de correr, olhando para trás confuso. Ação contínua, sem cortes bruscos. 10-13 segundos.

**Variação 2 — Replay de posicionamento (estilo linha de impedimento):**
> Vista aérea de campo de futebol com uma linha amarela digital de "impedimento" desenhada
> sobre o gramado (estilo replay de transmissão de TV esportiva real), mostrando o exato
> momento em que um jogador de uniforme verde cruza a linha à frente do último defensor
> enquanto o passe é feito. Câmera zoom lento sobre a linha digital. Sem narração. 10-12
> segundos.

**Variação 3 — Corrida interrompida, frustração:**
> Jogador de uniforme verde em corrida de velocidade máxima em direção ao gol, apito soa,
> jogador freia bruscamente e derrapa alguns passos no gramado, leva as mãos à cabeça em
> frustração, árbitro assistente ao fundo com a bandeira ainda erguida. Câmera acompanha o
> movimento (tracking shot). Sem narração. 8-11 segundos.

---

## 🚨 Pênalti (P01/P02 — justificativa suspeita em cliente parado)

**Tom:** dramático e artístico, NÃO um "flagrante" realista — o contato é estilizado, em
câmera lenta cinematográfica desde o início, como um momento de tensão do jogo, não uma
acusação. Foco na emoção do lance (tensão, decisão do árbitro), não na violência do contato.

**Variação 1 — Carrinho estilizado em câmera lenta (ação principal):**
> Câmera de transmissão esportiva, estádio à noite, luzes fortes, TUDO em câmera lenta
> cinematográfica desde o primeiro frame (estilo comercial esportivo premium, não replay de
> falta real). Um atacante de uniforme vermelho conduz a bola dentro da grande área, um
> defensor de uniforme verde se aproxima e os dois disputam a bola em um lance de contato
> leve e estilizado — mais dança de movimento que violência, poeira dourada voando em câmera
> lenta artística, luz dramática. Corte para o árbitro central apontando para a marca do
> pênalti com gesto solene. Sem narração. 12-14 segundos.

**Variação 2 — Ângulo artístico, foco na tensão do momento:**
> Câmera em ângulo baixo cinematográfico, dentro da grande área de um estádio à noite, tudo em
> câmera lenta desde o início. Dois jogadores (uniforme vermelho e verde) em disputa estilizada
> pela bola, movimento fluido e quase coreografado, luzes do estádio criando silhuetas
> dramáticas. Sem quedas bruscas ou impacto violento — o foco é a tensão visual do momento, não
> o contato em si. Corte para o apito do árbitro e o braço apontando para a marca do pênalti.
> Câmera de transmissão esportiva profissional, tom cinematográfico. 12-14 segundos.

**Variação 3 — Replay artístico do lance (estilo VAR):**
> Replay em câmera lenta cinematográfica do lance na grande área: dois jogadores (uniforme
> verde e vermelho) em disputa de bola estilizada, movimento suave e dramático, sem violência
> ou queda brusca — como um still fotográfico em movimento. Moldura amarela de "VAR" sobreposta
> no canto da tela, indicando revisão. Sem narração, só efeito sonoro de "bip" de revisão.
> 10-13 segundos.

---

## 🧤 Defesa (D01/G08 — cliente recorrente positivado, "defesa milagrosa")

**Tom:** heroico, alívio, comemoração contida (não é gol, é "salvamento"). A AÇÃO completa: o
chute acontecendo, seguido da defesa — não só o resultado congelado.

**Variação 1 — Chute e defesa espetacular, ação completa:**
> Câmera de transmissão esportiva, estádio à noite. Um atacante de uniforme vermelho chuta a
> bola forte em direção ao gol, de dentro da área. O goleiro de uniforme azul se estica
> horizontalmente no ar, na direção certa, e alcança a bola com a ponta dos dedos, desviando-a
> por cima do travessão. Corpo do goleiro caindo no gramado após a defesa, poeira/grama voando
> no impacto. Ação contínua desde o chute até a queda, sem cortes bruscos. Torcida ao fundo
> reagindo com alívio. Sem narração. 12-14 segundos.

**Variação 2 — Reação de alívio da equipe:**
> Goleiro de uniforme azul se levanta do gramado após a defesa, segurando a bola contra o
> peito, companheiros de time correndo para comemorar/abraçar, tapinhas nas costas. Câmera de
> transmissão esportiva, plano médio, estádio genérico à noite. Sem narração. 10-12 segundos.

**Variação 3 — Replay em câmera lenta da defesa:**
> Replay estilo transmissão de TV esportiva, câmera lenta cinematográfica da bola sendo
> desviada pela ponta dos dedos do goleiro (uniforme azul) por cima do travessão, ângulo baixo
> dramático, luzes do estádio refletindo na bola. Sem narração, som ambiente de torcida em
> êxtase. 10-14 segundos.

---

## 🔥 Hat-Trick (G06 — 3 pedidos em sequência)

**Tom:** celebração crescente, mesmo jogador, 3 momentos de gol no mesmo jogo. Vídeo de
FUNDO genérico (sem números/valores — esses continuam aparecendo na tela de decisão como
hoje). Uma variação só basta (não precisa de 3 versões, já que o Hat-Trick é mais raro).

**Vídeo único — 3 gols do mesmo jogador:**
> Câmera de transmissão esportiva, estádio à noite. Sequência de três comemorações de gol do
> mesmo jogador (uniforme laranja, número 9), cada uma em um momento diferente do jogo: 1)
> chute e bola entrando no gol, jogador correndo em comemoração; 2) segundo gol, jogador
> deslizando de joelhos no gramado comemorando; 3) terceiro gol, jogador sendo erguido pelos
> companheiros de time em comemoração eufórica, confete caindo. Transições suaves entre os
> três momentos (não cortes bruscos), sensação de crescendo/clímax. Torcida cada vez mais
> eufórica a cada gol. Sem narração, sem números/placar sobrepostos (o texto entra depois, na
> tela de decisão). 12-14 segundos.

## 👑 Semana Invicta (demo — critério de disparo ainda não definido)

**Tom:** vitória consistente, orgulho de equipe, tom mais "campanha" que lance único. Vídeo de
FUNDO genérico. Uma variação só.

**Vídeo único — equipe vitoriosa:**
> Câmera de transmissão esportiva, estádio à noite. Time inteiro (uniforme verde) comemorando
> junto no centro do campo, jogadores se abraçando em círculo, capitão erguendo os braços,
> confete e luzes de estádio ao fundo. Sensação de conquista coletiva (não gol individual).
> Câmera circular lenta ao redor do grupo. Sem narração. 10-13 segundos.

---

## Depois de gerar

1. Baixar os 15 arquivos, nomear `vermelho_1/2/3.mp4`, `amarelo_1/2/3.mp4`,
   `impedimento_1/2/3.mp4`, `penalti_1/2/3.mp4`, `defesa_1/2/3.mp4`.
2. Publicar em `public/animacoes/videos/` (mesmo lugar dos vídeos de gol).
3. Atualizar `VIDEO_ARQUIVOS` em `public/animacoes/tv-animacoes.js`:
   ```js
   const VIDEO_ARQUIVOS = {
     gol: ['/animacoes/videos/gol_1.mp4', ..., '/animacoes/videos/gol_4.mp4'],
     vermelho: ['/animacoes/videos/vermelho_1.mp4', '/animacoes/videos/vermelho_2.mp4', '/animacoes/videos/vermelho_3.mp4'],
     amarelo: ['/animacoes/videos/amarelo_1.mp4', '/animacoes/videos/amarelo_2.mp4', '/animacoes/videos/amarelo_3.mp4'],
     impedimento: ['/animacoes/videos/impedimento_1.mp4', '/animacoes/videos/impedimento_2.mp4', '/animacoes/videos/impedimento_3.mp4'],
     penalti: ['/animacoes/videos/penalti_1.mp4', '/animacoes/videos/penalti_2.mp4', '/animacoes/videos/penalti_3.mp4'],
     defesa: ['/animacoes/videos/defesa_1.mp4', '/animacoes/videos/defesa_2.mp4', '/animacoes/videos/defesa_3.mp4']
   };
   ```
4. Publicar com `node publicar_tv.js "mensagem"` — a checagem de vídeo (`testaVideo`) já
   detecta os novos arquivos automaticamente, sem precisar mexer em mais nada.
5. Testar cada lance em `/testar` antes de considerar pronto (mesmo processo do gol hoje).
