# Prompts para gerar sprites das animações da TV CFTV (Gemini / Imagen)

## Como usar
1. Cole cada prompt abaixo no Gemini (geração de imagem), um de cada vez.
2. Peça fundo branco liso ou verde-chroma se ele não conseguir transparência direto (anote no próprio prompt, já incluído abaixo).
3. Baixe o PNG em resolução alta (peça "alta resolução" / 4K se a ferramenta permitir).
4. Me entregue os arquivos e eu integro no motor de animações. **O nome do vendedor/cliente NUNCA vai dentro da imagem** — isso continua sendo escrito por cima, em texto normal, pelo nosso próprio código, exatamente como já acontece hoje. A imagem gerada é só o "personagem/cenário" fixo e genérico; quem muda a cada lance é sempre o texto (nome, valor, motivo), nunca a arte.
5. Gere um personagem "base" primeiro (prompt 0) e, se o Gemini permitir referência de imagem anterior, use-o como referência nos demais para manter o mesmo estilo de personagem em todas as poses.

---

## 0. Personagem-base (gerar primeiro, serve de referência de estilo)
```
Crie uma ilustração vetorial 2D no estilo de motion graphics esportivo de TV (tipo vinheta de
transmissão de futebol), mostrando um jogador de futebol genérico, sem rosto detalhado (silhueta
esportiva), com camisa em tom azul (#38bdf8) e detalhes em branco, numa pose neutra de pé, corpo
atlético. Iluminação dramática de holofotes de estádio ao fundo, desfocados. Contornos limpos e
grossos, cores vibrantes, sem texto, sem logotipos, sem marca de nenhuma empresa. Fundo branco
liso (para eu remover depois) ou, se possível, fundo transparente. Alta resolução, composição
centralizada, o personagem ocupando o quadro inteiro.
```

## 1. GOL — comemoração (usado nos lances de venda alta, recuperação de cliente, meta batida)
```
Mesma ilustração vetorial 2D de motion graphics esportivo de TV do jogador genérico (camisa azul
#38bdf8, sem rosto detalhado, silhueta esportiva). Agora em pose de comemoração de gol: braços
erguidos para cima, correndo com alegria, corpo em diagonal como se estivesse deslizando de
joelhos no gramado. Linhas de movimento atrás dele, confete colorido no ar, luz de holofote forte
vindo de trás. Contornos limpos, cores vibrantes, sem texto, sem logotipos. Fundo branco liso ou
transparente. Alta resolução, composição centralizada.
```

## 2. CARTÃO VERMELHO — expulsão (devolução indevida, abandono de campo)
```
Mesma ilustração vetorial 2D de motion graphics esportivo de TV, agora um árbitro genérico (sem
rosto detalhado, uniforme preto de juiz de futebol) em pose séria, braço esticado para frente
mostrando um cartão vermelho brilhante bem próximo à câmera, como se estivesse expulsando alguém.
Apito na boca. Brilho vermelho dramático ao redor do cartão. Holofotes de estádio desfocados ao
fundo. Contornos limpos, cores vibrantes, sem texto, sem logotipos. Fundo branco liso ou
transparente. Alta resolução, composição centralizada.
```

## 3. CARTÃO AMARELO — advertência (rota sem venda)
```
Mesma ilustração vetorial 2D de motion graphics esportivo de TV, o mesmo árbitro genérico (sem
rosto detalhado, uniforme preto), agora mostrando um cartão amarelo brilhante com o braço
levantado, dedo indicador da outra mão apontando em advertência. Brilho amarelo ao redor do
cartão. Holofotes de estádio desfocados ao fundo. Contornos limpos, cores vibrantes, sem texto,
sem logotipos. Fundo branco liso ou transparente. Alta resolução, composição centralizada.
```

## 4. IMPEDIMENTO — VAR (check-in fantasma, GPS fora de campo)
```
Mesma ilustração vetorial 2D de motion graphics esportivo de TV, agora um bandeirinha genérico
(sem rosto detalhado, uniforme preto) correndo de lado na linha lateral, bandeira quadriculada
amarela e vermelha erguida no alto, corpo em movimento com leve desfoque de velocidade nas
pernas. Holofotes de estádio desfocados ao fundo. Contornos limpos, cores vibrantes, sem texto,
sem logotipos. Fundo branco liso ou transparente. Alta resolução, composição centralizada.
```

## 5. PÊNALTI — falta grave (estoque suficiente, cliente encerrado)
```
Mesma ilustração vetorial 2D de motion graphics esportivo de TV, o mesmo árbitro genérico (sem
rosto detalhado, uniforme preto), em pose dramática apontando o dedo para o chão marcando a
marca do pênalti, postura larga e firme. Linhas de velocidade radiais ao fundo remetendo a
replay em câmera lenta, um círculo vermelho de destaque no chão onde ele aponta. Holofotes de
estádio desfocados. Contornos limpos, cores vibrantes, sem texto, sem logotipos. Fundo branco
liso ou transparente. Alta resolução, composição centralizada.
```

## 6. DEFESA MILAGROSA — cliente recorrente salvo
```
Mesma ilustração vetorial 2D de motion graphics esportivo de TV, agora um goleiro genérico (sem
rosto detalhado, camisa verde #22c55e, luvas), em pose de voo horizontal no ar, corpo esticado ao
máximo defendendo uma bola que está quase escapando, rastro de movimento atrás dele. Holofotes de
estádio desfocados ao fundo. Contornos limpos, cores vibrantes, sem texto, sem logotipos. Fundo
branco liso ou transparente. Alta resolução, composição centralizada.
```

## 7. Fundo de estádio (opcional, cenário genérico reutilizável atrás de todas as cenas)
```
Ilustração de fundo de estádio de futebol à noite, gramado verde com listras de corte e linhas
brancas do campo, vista ampla em ângulo baixo, holofotes fortes desfocados ao fundo (efeito
bokeh), vinheta escura nas bordas, estilo de placa de fundo de transmissão de TV esportiva.
Sem pessoas, sem texto, sem logotipos. Alta resolução, formato widescreen 16:9.
```

---

## Observações técnicas
- Se o Gemini não conseguir fundo transparente direto, peça fundo branco liso — eu removo o
  branco por código (chroma key) na hora de integrar, sem precisar de outra ferramenta.
- Se possível, gere 2 ou 3 variações de cada pose (ex.: dois ângulos diferentes de comemoração de
  gol) para eu alternar aleatoriamente entre os lances e a tela não repetir sempre a mesma imagem.
- Não inclua nome de vendedor, nome de cliente, valores, logotipo da empresa ou qualquer texto
  dentro da imagem — tudo isso é escrito depois, por cima, pelo próprio código da TV.
