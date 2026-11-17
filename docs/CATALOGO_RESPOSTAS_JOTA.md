# JOTA — Catálogo de intenções e modelos de resposta

> 16/11/2026. Proposta. **Ainda não está no código.** Continua o [PLANO_JOTA_QUALIDADE_E_PROATIVIDADE.md](PLANO_JOTA_QUALIDADE_E_PROATIVIDADE.md) (Fase 2: entender a pergunta) e usa como base as 370 perguntas reais da [AUDITORIA_JOTA_2026-11-16.md](AUDITORIA_JOTA_2026-11-16.md).
> Este catálogo define **o que** o JOTA entende e **como** responde. **De onde** vem cada dado é decidido no mapa de dados ([MAPA_DAS_FONTES.md](MAPA_DAS_FONTES.md) e a camada "fatos do dia" do plano). Os blocos citam os dados pelo nome de negócio.
> Régua: número sempre com referência e farol; abrir pelo desvio e pela causa; fechar com uma ação que diga quem faz, em qual cliente e até quando.

---

## 0. Como ler

- **40 intenções** em 7 grupos: A conversa, B momentos, C desempenho, D clientes, E pedidos, F indústria, G Liga e premiação.
- Cada intenção traz: exemplos reais de 16/11, cargo, **como reconhecer**, **o que NÃO é**, o **modelo** (WhatsApp, até ~15 linhas) e os **dados** de cada bloco.
- Nos modelos, `{...}` é dado a preencher. Nada no modelo é número real.
- Cargos: **V** vendedor · **S** supervisor · **G** gerente · **D** diretoria/CEO.

### Faróis (iguais em todas as respostas)

| Indicador | Referência | 🟢 | 🟡 | 🔴 |
|---|---|---|---|---|
| Faturamento do mês (faturado + a faturar ÷ meta) | **ritmo** = dias úteis passados ÷ dias úteis do mês. No **AS** vale o faseamento (60% até o dia 20) | ≥ 100% do ritmo | 90–99% | < 90% |
| Positivação do mês | meta de positivação × ritmo | ≥ 100% | 90–99% | < 90% |
| Recorrência | meta 80% do objetivo × ritmo | ≥ 100% | 90–99% | < 90% |
| Vendido hoje | **necessário do dia** = (meta − faturado − a faturar) ÷ dias úteis que faltam, contando hoje | ≥ 100% | 80–99% | < 80% |
| Visitas | durante o dia: média do próprio vendedor (ou da equipe) no mesmo horário nos últimos 10 dias úteis; no fechamento: rota planejada | ≥ média / 100% | ≥ 80% | < 80% |
| Eficácia (visitas com venda ÷ visitadas) | média do próprio vendedor nos últimos 20 dias úteis | ≥ média | ≥ 80% da média | < 80% |
| Devolução do mês | % do faturado, comparado com a média da filial | ≤ média | até 1,5× | > 1,5× |

- **⏳** = dia em andamento: antes do fechamento o vendido do dia aparece com ⏳ e o necessário do dia, sem vermelho.
- **⚪** = falta a referência (ex.: vendedor sem meta cadastrada). O JOTA mostra o número e diz "sem meta cadastrada", nada além disso.
- **Tendência** só aparece quando alguém pede previsão, e sempre com o rótulo "conta, não é número real" (regra do Vitório de 26/10).

### Estrutura padrão de toda resposta (no máximo ~15 linhas)

1. **Cabeçalho** (1 linha): quem · filial · período. Ex.: `*352 - Tamara Guedes* · TCV · hoje até 11:40`.
2. **Desvio e causa** (1–2 linhas): o que está fora do ritmo e por quê, em R$ ou em clientes.
3. **Números** (2–5 linhas): cada um com referência e farol.
4. **Lista** quando houver (até 5–8 linhas, pior primeiro, `código - nome` e o motivo), com "ver mais" se passar disso.
5. **Ação** (1–2 linhas, 👉): quem faz, em qual cliente e até quando.
6. **Rodapé** (1 linha, em itálico): fonte e hora. Ex.: `_Clube 11:40 · GEROT 16/11_`. Se faltar o dado do dia: `_Hoje ainda sem atualização (último: 15/11 20:08) · GEROT 16/11_`.

---

## 1. Ordem de decisão (o que olhar primeiro)

A mensagem passa por estas perguntas, nesta ordem. A primeira que responder "sim" define a intenção.

| # | Pergunta | Vai para |
|---|---|---|
| 1 | O número está liberado? | se não: **A10** |
| 2 | É áudio? | transcreve, mostra `🎙️ Entendi: "..."` (1 linha) e continua com o texto |
| 3 | É só emoji, 👍/👎, "nota N", ok, obrigado, figurinha ou risada? | **A4** |
| 4 | É número puro? | **regra dos números** (abaixo) |
| 5 | Contesta uma resposta ou um dado ("não procede", "já vendeu", "fez check-in")? | **A7** |
| 6 | Dá um recado ou uma exceção ("é PJ", "compra centralizada", "atestado")? | **A8** |
| 7 | Começa com "sugestão"? | **A6** |
| 8 | Tem número de pedido, CNPJ ou código de cliente? | **E2** / **D6** |
| 9 | Tem um **assunto** (curva, recorrência, pedidos, devolução, indústria, Liga, +MIX, rota…)? | a intenção do assunto, **filtrada** pela pessoa e pelo período citados |
| 10 | Cita uma pessoa e nenhum assunto? | **C9** (se for pergunta do dia) ou **C8** |
| 11 | Só tem período ou indicador ("hoje", "mês", "meta", "como estou")? | C1/C2/C5/C6/C11 |
| 12 | É saudação? | **A1** (o momento do dia) |
| 13 | Nada disso? | menu com os 3 assuntos mais prováveis. Nunca a IA genérica com números |

**Regra de ouro do roteamento: o assunto manda, a pessoa filtra.** "Curva negativa vendedora 10 de TSJ" é a curva negativa (D1) do vendedor 10, e não a ficha do vendedor. A ficha do vendedor (C8) só aparece quando não há assunto.

### Desambiguação — dia × mês

| Sinal na frase | Período |
|---|---|
| hoje, agora, do dia, até agora, já vendeu, parcial, atualiza/atualizado (em pergunta de números), "venda de hoje", "giro de hoje", "roteiro de hoje", a data de hoje (16/11) | **DIA** |
| mês, no mês, novembro (mês corrente), acumulado, meta, faturado/faturamento, a faturar, carteira, quanto falta, positivação (sem "hoje"), curva negativa (sem "hoje") | **MÊS** |
| "faturado até o momento" | **MÊS** (faturado é sempre do mês) |
| mês passado, mês anterior, outubro, setembro, "fechamento de {mês}", "fechou a meta?" | **MÊS FECHADO** (B3) |
| **"fechamento" sem mês, a partir das 17:00** | **DIA** (B2). Antes das 17:00 é o parcial do dia (C1/C5) com a linha "fechamento do dia às 18:30 · 7 = fechamento de outubro" |
| "fechamento do dia", "fechamento de hoje", "fechamento 16/11" | **DIA** (B2), em qualquer hora |
| "venda"/"vendeu"/"quanto vendi" sem período | **DIA** + 1 linha do mês |
| "como estou/estamos", "números", "resultado" sem período | o **momento do dia** (já traz o dia e o mês) |
| "ontem" | **último dia com venda**: na segunda é sábado se houve venda, senão sexta. A data vem sempre escrita |
| "meta do dia", "por dia", "para 85%" | **conta** (C3) |

### Desambiguação — vendedor × equipe × filial

| Cargo | Sem pessoa citada | Com pessoa citada |
|---|---|---|
| V | ele mesmo, sempre | outro vendedor: "eu só mostro os seus números" + os dele |
| S | "meu/minha", "time", "equipe", "nós", "estamos", "meus vendedores" = **a equipe**. "Equipe 57" ou "equipe 543" = o código dele mesmo | código, nome ou "setor N" de vendedor da equipe = **aquele vendedor**. Vendedor de outra equipe: diz de quem é e não abre |
| G | a filial (ou o grupo, em TPH e MCD) | supervisor = a equipe dele; vendedor = o vendedor |
| D | o Brasil (11 filiais) | filial citada = a filial; pessoa = a pessoa |

### Regra dos números (resolve o erro "nota 1 anotada")

| Formato (sem pontos, barras ou espaços) | É |
|---|---|
| 14 dígitos | **CNPJ** → D6 |
| 7 a 10 dígitos | **número de pedido** (começa pelo código do vendedor: 477000212, 1038000485, 48000991) → E2 |
| 5 a 6 dígitos | **código de cliente** → D6 |
| 1 a 4 dígitos, e a última mensagem do JOTA (até 10 min) numerou um menu ou uma lista | **opção ou item da lista** → A3 |
| 1 a 4 dígitos, nada numerado aberto, quem pergunta é S/G/D e o número é código de vendedor do escopo | **abrir o vendedor** → C8 |
| 1 a 4 dígitos sem nada aberto | menu, com "o {N} não está no menu" |
| "0" | volta ao menu |

**Número puro nunca é nota.** Nota só por 👍, 👎 ou "nota N".

### Desambiguação — contestação/recado × pergunta

- **Contestação** = afirma algo que contradiz a última resposta, ou nega a resposta. Não pede dado novo. Sinais: "não procede", "não confere", "errado/errada/incorreto", "não está atualizado", "já vendeu", "já fez check-in", "fez check-in antes das…", "iniciou às 08:33", "tá com 3 pedidos", "todos estão com pedido", "falta a Juliana" (logo depois de uma lista), um valor solto ("3.761,24 venda") logo depois de um R$ 0.
- **Recado** = informa uma exceção de pessoa ou de cliente. Sinais: "é PJ", "compra centralizada", "rede", "outro setor", "feriado", "atestado", "doente", "folga", "já acionei", "já estamos trabalhando", "falta produto no sistema", "não tem esse KPI (canal AS)".
- **Pergunta** = pede um dado ("quanto", "quais", "como está", "?", imperativo "me passa").
- Na dúvida entre contestação e pergunta ("Karina já vendeu hoje", sem ?): a resposta de **A7** já resolve as duas, porque começa conferindo agora o fato citado.

---

## 2. Catálogo (40 intenções)

### Cobertura nas 370 perguntas de 16/11

**370 de 370 (100%) cabem numa das 40 intenções.** Para medir, rodei as palavras-chave deste catálogo sobre as 370 perguntas. Elas acertaram ~366 (≈ 99%). Os 4 erros foram corrigidos à mão e geraram as regras de desambiguação acima: "Quantos a minha equipe já vendeu" é pergunta e não contestação; "oportunidade de Arcor x mês passado" é F2 e não B3; "atualize… até agora do meu time" é dia; "Card equipe" do gerente é a filial.

| Intenção | Perguntas | Intenção | Perguntas |
|---|---|---|---|
| A3 Número de menu/lista/código | 61 | C8 Abrir um vendedor | 9 |
| A1 Saudação → momento | 52 | G1 Liga | 9 |
| B1 Matinal / plano do dia | 38 | E4 Devoluções | 8 |
| A4 Sinal curto (nota, ok, emoji) | 31 | | |
| A10 Acesso / sem cadastro | 16 | A6 Sugestão | 8 |
| A2 Menu | 15 | A8 Recado / exceção | 7 |
| E1 Pedidos (lista e status) | 15 | C6 Mês da equipe | 6 |
| A7 Contestação | 12 | C11 Filial / Brasil | 6 |
| C5 Dia da equipe | 8 | E2 Um pedido pelo número | 5 |
| C2 Meu mês | 9 | F2 Indústria analítica | 5 |
| G2 RV, comissão, aceleradores | 8 | demais 19 intenções | 0 a 5 cada (42 no total) |

Hoje 45% das mensagens (A1+B1+A2+A3) **não dizem o assunto**: são saudação, "matinal", "menu" ou um número. A qualidade do JOTA depende de acertar o **momento** e a **regra dos números**.

Intenções sem pergunta em 16/11, mas que estão no menu ou foram pedidas pelo diretor: **B2** (Luis Boeira, 18:16), **C9** (Tamara), **E3** cortes, **D7** prospecção e campanhas.

---

### GRUPO A — Conversa e controle

#### A1 · Saudação → momento do dia
- **Exemplos:** "Bom dia", "Oi", "Oii", "Oi jota", "Boa tarde jota", "Opa", "Olá", "Bom dia Jota!" (52).
- **Cargo:** todos.
- **Reconhecer:** a mensagem inteira é saudação (com ou sem "jota"), sem assunto.
- **Não é:** saudação + assunto ("Boa tarde jota! Preciso saber o meu Ranking" = G1); "Bom dia, já estamos trabalhando para isto" = A8.
- **Resposta:** o **momento** que vale para o cargo e para a hora:
  - **Plano do dia:** até o 1º check-in ou 11:00.
  - **Meio do dia:** 11:00–17:00.
  - **Fechamento:** depois das 17:00, ou rota concluída.
  - Para S, G e D: abertura, meio e fechamento da equipe, da filial ou do Brasil (B1, C5/C11, B2).
- **Modelo — vendedor, meio do dia:**
```
🍽️ Tamara, sua manhã até {hh:mm}:
🚶 Visitou {5} de {12} {farol vs. média no horário} · vendeu R$ {x} em {3} pedidos ⏳ (precisa R$ {y} hoje)
✅ Com pedido: {cliente}, {cliente}, {cliente}
🟡 Visitou e não vendeu: {código - cliente} · {motivo da justificativa} · {32} dias sem comprar
🔴 Falta visitar ({7}): {cliente} (foco · recorrência), {cliente}, {cliente}…
📊 Mês: {36,6}% da meta {🔴} · ritmo {52,6}% · faltam R$ {x} (R$ {y}/dia útil)
👉 Tarde: começar por {cliente} e {cliente} (foco); ligar para {cliente} antes das 15h.
_Clube {hh:mm} · GEROT {dd/mm}_
```
- **Dados:** rota do dia, check-in, pedidos do dia por cliente, justificativas, dias sem comprar, digitado do dia, faturado + a faturar + meta do mês, dias úteis, os 5 de foco do dia.
- Plano do dia e fechamento do vendedor: ver B1 e B2.

#### A2 · Menu
- **Exemplos:** "Menu", "Menu do jota", "0", "A0" (15).
- **Cargo:** V, S (G e D: a lista de exemplos de pergunta).
- **Reconhecer:** "menu", "0", "voltar", "opções", "o que você faz". Erro de digitação de 0 ("A0", "O") também conta.
- **Não é:** "Menu do jota" respondido pela IA (erro de 16/11, Alyfer).
- **Modelo:** o menu do cargo, sem cabeçalho de números e sem saudação longa. **Proposta para o menu do supervisor:** o item 7 vira "Fechamento: do dia (após 17h) ou do mês passado", porque não existe "fechamento do dia" no menu.
- **Dados:** nenhum.

#### A3 · Opção de menu, item de lista ou código
- **Exemplos:** "1", "2", "4", "55", "354", "Solicitei opção 2 menu" (61).
- **Reconhecer:** a regra dos números (seção 1). O marcador do último menu ou lista enviado vale 10 min.
- **Não é:** nota (nunca); número de pedido (7–10 dígitos).
- **Modelo:** a resposta da intenção escolhida. Se o número não existir: `O {9} não está neste menu (1 a 4). {menu do tema}`.
- **Caso de 16/11:** Washington "2" → "nota 2 anotada", e depois "Solicitei opção 2 menu" virou sugestão. **Correto:** abrir a opção 2. Quando a pessoa diz "opção N", abrir a opção N.

#### A4 · Sinal curto (nota, ok, obrigado, emoji, figurinha)
- **Exemplos:** "👍", "👎", "👍🏽", "Ok", "Obrigado", "Ok, obrigada!", "Kk", "🙏🏽👍🏽", "[figurinha]", "Nota 5", "sim" sem pergunta aberta (31).
- **Reconhecer:** mensagem sem letras de assunto: só emoji, ok, obrigado, kk, "nota N".
- **Não é:** "sim" logo depois de uma pergunta do JOTA (é A9); "👎" seguido de texto (o texto é A6).
- **Modelo:**
  - 👍, ok, obrigado: 1 linha curta, sem números. Ex.: `Tamo junto, Vaneza! ⚽`
  - 👎: `Poxa. O que veio errado? Me escreve em uma frase que eu confiro.` Se a pessoa responder, vai para A7 se for um dado, ou para A6.
- **Caso de 16/11:** Missaid "Ok, obrigada!" virou uma análise genérica da IA. **Nunca.**

#### A5 · Continuação
- **Exemplos:** "Mais", "Ver mais", "Setor 115" (depois de "recorrência setor 118"), "sim", "e o mês?", "por vendedor", "e em TPH?" (5).
- **Reconhecer:** mensagem curta que só modifica a anterior (período, pessoa, lugar, "mais"). Vale por 2 h de conversa.
- **Não é:** pergunta completa com assunto próprio.
- **Modelo:**
  - **A mesma intenção anterior com o modificador.**
  - "Mais" depois de lista truncada = o resto da lista.
  - "Mais" depois de um momento = o menu.
- **Caso de 16/11:** Edi "Setor 115" repetiu o setor 118. Deveria trazer a recorrência do 115.

#### A6 · Sugestão / comentário sobre o JOTA
- **Exemplos:** "Sugestão: não está aparecendo os números da minha última solicitação", "sugestão: poderia passar a curva negativa diária ou da semana", "Sugestão, trazer o acelerador que está em vigor", "Corte loja" (depois do 👎) (8).
- **Reconhecer:** começa com "sugestão", ou é o texto logo depois de um 👎.
- **Não é:** um pedido de dado escondido. Se a sugestão contém um pedido que o JOTA atende ("curva negativa da semana"), registra **e responde o pedido** em seguida.
- **Modelo:**
```
Anotado, Aleksandro. Vai para o time que me treina hoje.
Enquanto isso, o que você pediu: {resposta da intenção, se existir}
```

#### A7 · Contestação do dado
- **Exemplos:**
  - Anderson (TPA): "Informação não confere com a realidade", "Não procede".
  - Anderson (TPH): "Não esta atualizado??".
  - Leonardo: "Metas estão erradas", "Falta a Juliana".
  - Sueli: "Karina já vendeu hoje", "Todos estão com pedido".
  - Gessandro: "Tá com 03 pedidos", "3.761,24 venda".
  - Tiago: "Alcindo já havia realizado check-in, favor verificar".
  - Washington: "Vendedora fez check-in antes das 10hs… não procede", "Informação sobre varejo rota incorreto".
  - Gabriel: "Confirmar sobre o checkin, ele iniciou as 08:33".
  - Total: 12.
- **Cargo:** todos (quase sempre S).
- **Reconhecer:** os sinais de contestação da seção 1 e a referência a algo da última resposta (até 60 min).
- **Não é:** pergunta nova. **Nunca responder com o card de números de novo, nem com a IA ("DOSSIÊ 360°").**
- **Modelo:**
```
Entendi, vou conferir agora.
O que eu mostrei: {Karina sem pedido} · dado das {05:29}
Conferi agora no Clube ({11:16}): 1200 - Karina Silva · {2} pedidos · R$ {x} · {Mercado A, Mercado B}
✅ Você tem razão: o dado das {05:29} estava velho. Já corrigi para os próximos.
— ou —
O Clube ainda mostra {sem pedido} às {11:16}. Se ela digitou depois, aparece em até 15 min; te aviso se mudar.
_Registrado para auditoria_
```
- **Dados:** o dado mostrado e a hora dele; o mesmo dado conferido agora na fonte (pedidos do dia por vendedor, check-in com hora, meta do vendedor); registro da contestação.
- **Variação "metas erradas":** mostra a meta de cada vendedor e de onde ela vem (`meta cadastrada em {dd/mm}`). Avisa se algum vendedor está sem meta cadastrada. Não discute o número.
- **Variação "falta a Juliana":** diz se a Juliana está ou não na equipe na Gestão de Equipe e quem decide ("quem muda é a Gestão de Equipe").

#### A8 · Recado / exceção
- **Exemplos:**
  - Delinlson: "João é PJ", "o João Carlos é PJ não tem por que eu cobrar ele".
  - Pedro: "Ok, já acionada, porém a compra é centralizada por se tratar de uma rede".
  - Jonatas: "a Tatiana está com essa cidade no feriado e ela está fazendo em outro setor".
  - Giani: "a Gisandra tá na rota, só não conseguiu digitar porque falta os combos de bala no sistema".
  - Elienay: "o vendedor é do canal AS, não tem o KPI de abertura".
  - Arildo: "Bom dia, já estamos trabalhando para isto".
  - Carlos: "doente".
  - Total: 7.
- **Cargo:** S, G.
- **Reconhecer:** os sinais de recado da seção 1, e uma pessoa ou um cliente que se possa identificar (citado ou da conversa).
- **Não é:** pergunta. **Nunca "BLOQUEADO (escopo)"** (caso Pedro).
- **Modelo:**
```
Anotado: {469 - João Carlos Souza} é PJ.
Até {23/11} ele não entra nos avisos de {sem pedido / abertura de clientes}. Seu gerente vê essa exceção.
{Se o recado aponta problema de sistema: "Combos de bala sem aparecer no Clube: passei para o comercial às {hh:mm}."}
👉 Se mudar antes, é só escrever "voltar a cobrar João".
```
- **Dados:** cadastro de exceções (pessoa ou cliente, motivo, validade de 7 dias, quem registrou). A regra fixa do canal continua: no AS, rede centralizada nunca é cobrada como sem pedido.

#### A9 · Última atualização
- **Exemplos:** Milena: "Qual foi sua última atualização do banco de dados?"; "Não está atualizado??" (quando não aponta um dado específico) (2).
- **Reconhecer:** "atualização", "atualizado", "de quando é", "que horas é esse dado".
- **Não é:** "atualiza os números do meu time" (pede os números, C5).
- **Modelo:**
```
Meus dados agora ({hh:mm}):
• Vendas e visitas de hoje: {14:53} (atualiza a cada 15 min)
• Faturado, a faturar, meta e positivação do mês: {16/11 06:10}
• Liga: {14:45}
{Se uma fonte estiver atrasada: "Vendas de hoje ainda sem atualização desde {06:30}; já avisei o time."}
```

#### A10 · Acesso (número não liberado, ou a pessoa se identificando)
- **Exemplos:** Edivandro, Cassiany ("Qual meu faturamento"), Cintia, Adriomar, Laura Macedo, "Carlos Alaguez da Silva - cód 112" (o número ainda não ligado ao cadastro), "Código 283" (16).
- **Reconhecer:** o telefone não está ligado a um cadastro ativo; ou a mensagem é "nome + código" logo na primeira mensagem do dia.
- **Modelo:**
  - **Sem cadastro:** `Oi! Seu número ainda não está liberado no Jota. Peça ao seu supervisor para liberar pelo link do passaporte. Assim que liberar, eu respondo.` Uma vez por dia por número. O Vitório recebe a lista diária.
  - **Identificação ("cód 112"):** se o código bate com o cadastro desse telefone, `Achei você: 112 - Carlos Silva (MCD), supervisor.` e segue com o momento (A1). Se não bate, a mensagem de liberação acima.
- Respeita o modo só reativo: responde só a quem escreveu.

---

### GRUPO B — Momentos fixos

#### B1 · Matinal / plano do dia (pedido explícito)
- **Exemplos:** "Matinal", "matinal", "Matinal/Gessandro", "Matinal- 72", "Bom dia Jota, matinal da equipe 543", "Card de API matinal" (38).
- **Cargo:** S (a maioria), G, D, V.
- **Reconhecer:** "matinal" ou "plano do dia" em qualquer hora. "Matinal **resultado até hoje**" = C5.
- **Não é:** saudação (A1 escolhe pela hora; "matinal" força o plano do dia).
- **Modelo — supervisor:**
```
☀️ *Plano do dia · Equipe {16 - Gessandro Sperotto} (TCV)* · {16/11}
📅 Último dia (sex {13/11}): R$ {x} em {n} pedidos · {n} de {n} vendedores venderam
📊 Mês: {34,5}% da meta {🔴} · ritmo {52,6}% · gap R$ {x} (R$ {y}/dia útil)
👥 Positivação: {341} de {819} {🔴} · meta até hoje {431}
🚶 Hoje: {92} clientes na rota · {10} vendedores · {n} clientes sem compra no mês
💰 Onde está o gap (R$, maior primeiro):
• {347 - Paulo Oliveira}: R$ {x} abaixo do ritmo · {Arcor}
• {352 - Tamara Guedes}: R$ {x} · {Mars}
• {1057 - Graciela Bonamigo}: R$ {x}
👉 RET hoje com {347 - Paulo}: {Mercado A} e {Mercado B} (sem compra no mês, na rota de hoje).
_Clube {06:30} · GEROT {16/11}_
```
- **Dados:** vendas do último dia com venda; faturado + a faturar + meta do mês; ritmo (dias úteis); positivação e meta; rota do dia (clientes, vendedores); clientes sem compra no mês que estão na rota de hoje; gap por vendedor e por indústria.
- **Proibido:** "Rota: 0 PDVs" (erro de 16/11 em todas as matinais). Sem a rota de hoje lida, a linha some e entra `🚶 Rota de hoje ainda não chegou (último: {dd/mm hh:mm})`.
- **Modelo — vendedor:** o mesmo esqueleto, com 4 indicadores (faturamento, positivação, recorrência, mix) e os 5 clientes de foco da rota de hoje.

#### B2 · Fechamento do dia
- **Exemplos:** "Fechamento" (Luis Boeira, S, 18:16), "Fechamento do dia 16/11/2026" (Luis Boeira) e todas as saudações depois das 17:00.
- **Cargo:** V, S, G (para G, ver a proativa P7).
- **Reconhecer:**
  - "fechamento" **sem mês** a partir das 17:00;
  - "fechamento do dia/de hoje/{data de hoje}" a qualquer hora;
  - "como foi o dia";
  - saudação depois das 17:00.
- **Não é:** "fechamento de outubro", "fechamento do mês passado" (B3). Antes das 17:00, "fechamento" sem mês = o parcial (C1/C5) com a linha "fechamento do dia às 18:30 · 7 = mês passado".
- **Casos reprovados:**
  - Luis Boeira recebeu o fechamento de **outubro** às 18:16.
  - Depois recebeu um painel com "Varejo com rota: 0 de 0 com venda (sem dado)", "1 pedidos", "foco nos zerados" com 0 zerados e vários R$ 0.
  - O fechamento do vendedor só aplaudia ("Valeu, time!") e não dizia que 4 clientes ficaram sem pedido.
- **Modelo — supervisor:**
```
🌙 *Fechamento {16/11} · Equipe {295 - Luis Boeira} (TBE)*
📝 Vendeu R$ {x} em {n} pedidos · necessário do dia R$ {y} {🔴 74%}
🚶 Visitas {88} de {92} {🟢} · com venda {41} ({47}%) {🟡} média {52}%
📊 Mês: {41,2}% {🔴} ritmo {52,6}% · positivação {389} de {819} {🟡}
*Por vendedor (pior primeiro):*
🔴 {346 - Eduardo}: R$ {3.493} · vendeu {3} de {7} · {4} na mesa (resp. ausente) · {Panif. Romana 108 dias}
🔴 {347 - Paulo}: sem check-in · {9} clientes sem visita
🟡 {352 - Tamara}: R$ {x} · {6} de {12} · {2} sem visita ({Merc. X}, {Merc. Y})
🟢 {5} vendedores na meta do dia: {1057 - Graciela}, {…}
🏭 Abaixo do ritmo no mês: {Arcor} {23}% 🔴 · {Mars} {31}% 🔴
👉 Amanhã: {346 - Eduardo} liga para {Panif. Romana} até 10h · {347 - Paulo}: confirmar (OK/folga/atestado) · {Arcor} na rota do {Paulo}.
_Clube {18:15} · GEROT {16/11} · digite o código para abrir o vendedor_
```
- **Regras deste modelo:**
  - **Por vendedor:** quem vendeu, em quantos clientes, quem ficou **na mesa** (visitou e não vendeu) com o **motivo** da justificativa, quem ficou **sem visita**, com o nome do cliente mais importante (mais dias sem comprar ou recorrência).
  - **Ordem:** pior primeiro. Os vendedores 🟢 cabem numa linha só.
  - **Sem aplauso genérico.** Se todos estão 🟢, uma linha de reconhecimento com nome e número ("{1057 - Graciela}: 10 de 10 e R$ 9.800, maior do time").
  - **Linha sem dado some.** Nunca "0 de 0", "(sem dado)", "foco nos zerados" com 0 zerados, nem plural errado ("1 pedidos").
  - **Visitas que precisam de conferência:** check-in de menos de 3 min sem pedido, ou várias visitas no mesmo minuto, entram como `🔎 conferir: {vendedor} · {n} visitas em {hh:mm}`.
- **Modelo — vendedor:** o do plano, seção 6 (Eduardo e Marcus), com a linha do mês no topo e a ação do dia seguinte.
- **Dados:** vendas do dia (R$, pedidos, clientes) por vendedor; rota do dia; check-in (hora, duração); justificativas de não venda com motivo; dias sem comprar por cliente; faturado + a faturar + meta; positivação; indústrias × meta do mês; necessário do dia.

#### B3 · Fechamento de um mês que já fechou
- **Exemplos:** "Qual resultado do meu mês passado?" (Luan), menu 7 do vendedor ("Fechamento do mês passado"), "fechamento de outubro" (1, e o 7 do menu).
- **Cargo:** todos.
- **Reconhecer:** nome de mês anterior ao atual, "mês passado", "mês anterior", "fechou a meta?", "fechamento de {mês}".
- **Não é:** "fechamento" sem mês depois das 17h (B2); "aceleradores de outubro" (G2).
- **Modelo:**
```
🏁 *Outubro fechado · {440 - Luan Medeiros} (MCD)*
💰 Faturado líquido R$ {126.721} de R$ {125.683} → {100,8}% {🟢}
👥 Positivação {n} de {meta} → {x}% {farol}
🔄 Recorrência {n} de {meta 80%} {farol} · 🧺 Mix {x} itens/cliente {farol}
🏭 Indústrias: {n} de {n} batidas · abaixo: {Arcor} {x}% · {Mars} {x}%
↩️ Devolução {x}% do faturado {farol}
👉 Para novembro: {a indústria ou o KPI mais abaixo} · {n} clientes de outubro ainda sem compra em novembro (digite 5).
_Foto oficial de 31/10_
```
- **Dados:** foto oficial do fechamento do mês (faturado líquido, meta vigente, positivação, recorrência, mix, devolução, indústrias). Nada calculado por fora.

---

### GRUPO C — Desempenho

#### C1 · Meu dia (vendedor)
- **Exemplos:** "Venda de hoje" (Marcus), "Como está minhas vendas de hoje?" (Igor), o 1.1 do menu "Quanto vendi hoje" (2 + opções 1.1).
- **Cargo:** V.
- **Reconhecer:** sinal de DIA + primeira pessoa ou nenhuma pessoa.
- **Não é:** "como estou" sem período (A1 momento); "faturado" (C2).
- **Modelo:** o meio do dia (A1) no formato compacto: vendido ⏳ × necessário do dia, visitas × média no horário, clientes com pedido, na mesa (motivo), falta visitar, ação, rodapé.
- **Sem dado do dia:** a linha "Hoje: ainda sem atualização (último: {dd/mm hh:mm})" e depois o mês. **Nunca "Digitado R$ 0".** No caso do Marcus (TPH 57), o JOTA disse "R$ 0" às 08:57 e o Clube mostrou R$ 86.833 depois.

#### C2 · Meu mês (vendedor)
- **Exemplos:** "Meu faturado até o momento", "Meta X faturado", "Jota quantos eu já vendi esse mês?", "Agora me dê a meta de quantos eu já vendi", "Bom dia. Como está meu faturamento desse mês?", "Quantos já foi faturado?", "Meus números atualizados", "Como estamos?" (vendedor), menu 1 (9 + opções 1).
- **Cargo:** V.
- **Reconhecer:** sinal de MÊS, ou "como estou" com "meta/faturado".
- **Não é:** "quanto por dia para 85%" (C3); "quanto vou receber" (G2).
- **Modelo:**
```
*{354 - Vaneza Kvasney}* · TCV · AS · novembro até {16/11}
💰 Faturado R$ {89.075} + a faturar R$ {89.462} = R$ {178.537} de R$ {308.000}
📊 {58,0}% da meta {🟢} · alvo do faseamento {60}% até dia 20
👥 Positivação {n} de {meta} {farol} · 🔄 recorrência {n} de {meta 80%} {farol}
🎯 Faltam R$ {129.463} → R$ {x}/dia útil ({10} dias)
👉 {n} clientes da carteira ainda sem compra no mês: digite 5 para a lista.
_GEROT {16/11} · Clube {hh:mm}_
```
- **Faturado negativo:** `💰 Devolução maior que o faturado: R$ {x} faturado − R$ {y} devolvido = R$ {−z}` + `digite 11 para as notas`. Nunca "Faturado: R$ −32.139" cru (Ana Dourado, Laura, Anderson).
- **Dados:** faturado do mês, a faturar (carteira), meta, devolução do mês, positivação e meta, recorrência, dias úteis, clientes sem compra no mês.

#### C3 · Conta: quanto falta, por dia, % alvo, previsão
- **Exemplos:** "Jota quantos eu tenho que vender por dia para alcançar 85% da meta do financeiro" (Hild), "Quanto falta para atingir as metas?", "Meta do dia de Positivação" (Rodrigo, S), "Previsão de vendas TCG 544" (Milena), menu 1.2 e 1.4 (4).
- **Cargo:** todos.
- **Reconhecer:** "por dia", "{n}%", "quanto falta", "meta do dia", "previsão", "tendência", "faseamento".
- **Não é:** "+MIX da rota" (o erro com o Hild: a pergunta caiu na rota).
- **Modelo:**
```
*{183 - Hild Rodrigues}* · alvo 85% da meta
🎯 85% de R$ {x} = R$ {y}
💰 Já tem R$ {faturado} faturado + R$ {a faturar} a faturar = R$ {z}
➗ Falta R$ {y − z} ÷ {10} dias úteis = *R$ {w} por dia*
📝 Hoje: R$ {x} vendido ⏳ ({x}% do dia)
_Dias úteis seg–sex sem feriado · GEROT {16/11}_
```
- **Positivação do dia (S):** "faltam {n} clientes ÷ {10} dias = {n}/dia; hoje {n} positivados ⏳".
- **Previsão:** `📈 TENDÊNCIA (conta, não é número real): no ritmo de hoje fecha em {x}%`, mais o necessário por dia.
- **Dados:** meta, faturado, a faturar, positivação e meta, dias úteis do calendário com feriados, vendido do dia.

#### C4 · Positivação
- **Exemplos:** "Positivação" (Carlos, S), "Meta positivação" (Cleyton, V), "Qual a positivação total até o momento considerado faturado + carteira" (Marcelo, G; contada em C11) (2).
- **Cargo:** todos.
- **Reconhecer:** "positiv" sem "quem falta" e sem lista de clientes. Com "quem falta", "quais clientes" ou "não positivados" é D1/D2.
- **Modelo:**
```
👥 *Positivação · {escopo}* · novembro
{24} de {390} clientes da carteira ({6,2}%) · meta {x} → {farol} (ritmo {52,6}%)
Contando a carteira a faturar: {n} ({x}%)
🎯 Faltam {n} → {n}/dia útil
{S/G: os 3 piores vendedores: código - nome · n de n · farol}
👉 {n} clientes da rota de hoje ainda sem compra no mês: digite 5.
_GEROT {16/11}_
```
- **Dados:** positivação do mês (faturado, e com a carteira), meta de positivação, carteira, por vendedor.

#### C5 · Dia da equipe
- **Exemplos:**
  - "Atualiza os números de hoje do meu time" (o avaliador deu nota 2/10).
  - "Como está minha equipe hoje..", "Venda do dia", "Hoje", "Como estamos hoje" (Sueli), "Quantos a minha equipe já vendeu".
  - "Bom dia jota Matinal resultado até hoje da equipe 57", "Jota, por favor, atualize os dados, performance, até agora, do meu time", "Como está minha equipe no dia de hoje. Equipe 543".
  - Menu 1 do supervisor.
  - Total: 8.
- **Cargo:** S (G/D: C11).
- **Reconhecer:** sinal de DIA + equipe/time/nós/"estamos", ou nenhuma pessoa (S).
- **Não é:** "equipe no mês" (C6); "por vendedor" sem período (C7).
- **Caso reprovado:** a resposta era só uma lista de R$ por vendedor (nota 2/10). Faltava desvio, referência, quem está sem pedido e por quê, e ação.
- **Modelo:**
```
📋 *Equipe {28 - Sueli Polli} (API) · hoje até {11:16}*
⚠️ {2} de {4} ainda sem pedido · visitas {18} de {41} {🟡} (média no horário {24})
📝 Vendido R$ {4.120} em {6} pedidos ⏳ · necessário do dia R$ {14.300}
🔴 {1200 - Karina}: sem check-in · {10} clientes na rota
🔴 {529 - Paola}: {4} visitas · 0 pedido · {2}× "{sem dinheiro}"
🟢 {249 - Edinei}: R$ {2.900} · {3} pedidos · {5} de {11}
🟢 {1074 - Felipe}: R$ {1.220} · {3} pedidos · {6} de {10}
📊 Mês: {31,4}% {🔴} · ritmo {52,6}% · gap R$ {75.400}
👉 Agora: ligar para {Karina} (sem check-in) e ver com {Paola} {Mercado X} ({40} dias sem compra).
_Clube {11:15} · GEROT {16/11} · digite o código para abrir o vendedor_
```
- **"Sem pedido"** só com prova: Clube atualizado há 30 min ou menos e rota lida. Sem prova, a linha vira `Hoje ainda sem atualização (último: {hh:mm})` e a resposta segue com o mês e a rota.
- **Dados:** vendas do dia por vendedor (R$, pedidos), rota e check-in por vendedor, justificativas com motivo, média de visitas no horário, necessário do dia, faturado + a faturar + meta.

#### C6 · Mês da equipe
- **Exemplos:** "Como está minha equipe no mês de novembro", "Passe as vendas de minha equipe mês novembro", "me passe como está minha equipe", "numeros geral da equipe", "Equipe" (Sueli), menu 2 do supervisor (6).
- **Cargo:** S.
- **Reconhecer:** equipe/time + sinal de MÊS, ou "equipe" sozinho de manhã cedo (antes do 1º check-in).
- **Modelo:**
```
📊 *Equipe {18 - Jorge Boni} (TCV) · novembro até {16/11}*
💰 R$ {x} faturado + R$ {y} a faturar = {14,2}% {🔴} · ritmo {52,6}% · gap R$ {z}
👥 Positivação {n} de {meta} {farol} · 🔄 recorrência {n} de {n} {farol}
*Gap por vendedor (R$ abaixo do ritmo):*
🔴 {363 - Valdir Dietrich}: {1,7}% · R$ {x} (devolução maior que o faturado)
🔴 {327 - Daniel Pessatto}: {x}% · R$ {x}
🟡 {366 - Zenilda Amaral}: {x}%
🟢 {354 - Vaneza Kvasney}: {58,0}%
🏭 Indústria mais abaixo: {Arcor} {x}% · R$ {x} de gap
👉 Prioridade da semana: {363 - Valdir}, {n} clientes sem compra (digite 5).
_GEROT {16/11}_
```
- **Dados:** faturado, a faturar, meta, positivação, recorrência e devolução por vendedor; indústrias da equipe.

#### C7 · Por vendedor (lista da equipe)
- **Exemplos:** "Por vendedor", "Por vendedor as vendas", "Relatório de como estão os resultados dos meus vendedores" (3).
- **Cargo:** S, G.
- **Reconhecer:** "por vendedor", "cada um", "meus vendedores", "ranking da equipe".
- **Não é:** a lista só com os nomes, para escolher (erro de 16/11: Jorge e Leonardo receberam só os nomes).
- **Modelo:** a tabela de C6 (dia: a de C5, se o período for o dia) com **todos** os vendedores, uma linha cada (até 15; acima disso, "ver mais"), pior primeiro, e no fim "digite o código para abrir".

#### C8 · Abrir um vendedor ou supervisor (ficha do mês)
- **Exemplos:** "Fabio Júlio 55", "57 Marcus Paulo", "58 Simone de Desu", "Vendedor 327", "E o vendedor 215", "me passe como está o setor 485", "Vendedora 62", "Quais são os atendimentos e vendas deste mês do vendedor Jovani Antonio de Moura?" (Milena), "Me mostre os resultados da carteira do supervisor Arildo" (Marcelo, G) (9).
- **Cargo:** S, G, D (V só a própria).
- **Reconhecer:** código e/ou nome de pessoa, **sem assunto** e sem sinal de dia.
- **Não é:** pessoa + assunto (a intenção do assunto); pessoa + hoje (C9).
- **Modelo:** **a mesma resposta que o próprio vendedor vê no item 1 dele** (C2), com o cabeçalho `sup. {16 - Gessandro}` e a linha `Hoje: R$ {x} ⏳ · {n} de {n} visitas` quando há dado do dia. No fim, `digite 1 a 16 para o menu dele`.
- **Supervisor aberto por G:** o C6 daquela equipe.
- **Nome que não existe:** `Não achei "Jovani Moura" em {escopo}. Mais parecidos: {código - nome}, {código - nome}.` Nunca "não achei Moura nas vendas" (procurou produto no lugar de pessoa).

#### C9 · Dia de um vendedor
- **Exemplos (caso reprovado pelo diretor):** "Venda Tamara TCV hoje", "Quanto a Tamara vendeu hoje". As duas devolviam a ficha do **mês**. Também "Karina já vendeu hoje" (A7).
- **Cargo:** S, G, D.
- **Reconhecer:** pessoa + sinal de DIA ("hoje", "agora", "vendeu hoje", "dia do").
- **Modelo:** o meio do dia ou o fechamento **do vendedor** (A1/B2), cliente a cliente, com o cabeçalho de quem pergunta:
```
📝 *{352 - Tamara Guedes}* · TCV · hoje até {14:53} · sup. {16 - Gessandro}
Vendeu R$ {x} em {n} pedidos ⏳ · necessário do dia R$ {y}
🚶 Visitou {n} de {n} {farol}
✅ Com pedido: {cliente} R$ {x} · {cliente} R$ {x}
🟡 Na mesa: {código - cliente} · {motivo} · {n} dias sem comprar
🔴 Sem visita: {cliente} (recorrência), {cliente}
📊 Mês: {36,6}% {🔴} · ritmo {52,6}%
👉 {Gessandro}: pedir a {Tamara} {cliente} ainda hoje.
_Clube {14:53}_
```

#### C10 · Zerados / sem pedido / sem check-in
- **Exemplos:** "Venda do dia e vendedores zerados" (Diego, G); "quem não fez check-in", "quem não visitou até 10h" (histórico) (1).
- **Cargo:** S, G, D.
- **Reconhecer:** "zerado", "sem pedido", "sem venda hoje", "não fez check-in", "não visitou".
- **Modelo:**
```
⚠️ *Sem pedido hoje · {TBE} até {14:13}* (varejo com rota)
{17} de {n} vendedores · {8} sem nenhuma visita
*{72 - Patricia Machado}* ({n}):
• {298 - Ronaldo Bica}: sem check-in · {n} na rota
• {código - nome}: {n} visitas · {motivo mais comum}
*{sup}* ({n}): …
👉 {Supervisores}: confirmar ausências até {15h} (OK/folga/atestado).
_Clube {14:10}_
```
- **Prova obrigatória:** Clube com menos de 30 min **e** pelo menos 95% dos vendedores atualizados. Sem isso, a resposta é `Ainda não dá para dizer quem zerou: vendas de hoje atualizadas até {hh:mm} para {n} de {n} vendedores.` (Em 16/11 saíram "17 zerados" antes de qualquer dado do dia.)
- **AS:** aparece, mas sem cobrança ("visualizar é tudo, cobrar é só varejo").

#### C11 · Filial / Brasil (gerente e diretoria)
- **Exemplos:** "Brasil hoje", "Como estamos hoje?" (D), "Pedidos hoje no Brasil", "Lendas [vendas] de hoje no Brasil", "Card equipe" (G), "Qual a positivação total…" (G) (6).
- **Cargo:** G (filial/grupo), D (Brasil ou filial citada).
- **Reconhecer:** G/D sem pessoa citada; "Brasil", sigla de filial, "grupo".
- **Modelo (dia ou mês pelo sinal; sem sinal = o momento):**
```
📊 *Brasil · 11 filiais · hoje até {13:10}*
📝 Vendido hoje R$ {x} em {n} pedidos ⏳ · necessário do dia R$ {y}
💰 Mês: {27,6}% {🔴} · ritmo {52,6}% · gap R$ {z}
👥 Positivação {x}% {farol} · ↩️ devolução {x}% {farol}
*Filiais (pior primeiro):*
🔴 {TCG} {x}% · gap R$ {x} · {n} sem pedido hoje
🔴 {TPA} {x}% · …
🟡 … · 🟢 {API}, {TCA}
👉 {Gerente TCG}: {o maior gap em R$ e onde: supervisor ou indústria}.
_Clube {13:05} · GEROT {16/11}_
```
- **Para o gerente:** as mesmas linhas por **supervisor**, com o número para abrir.

#### C12 · O que melhorar / o que fazer agora
- **Exemplos:** "Oque melhorar?", "E oque melhorar" (Anderson, Emillei) (3).
- **Cargo:** V, S.
- **Reconhecer:** "o que melhorar", "o que fazer", "onde focar", "como bater".
- **Não é:** a ficha do mês (erro de 16/11) nem um conselho genérico da IA.
- **Modelo:**
```
*{480 - Anderson Rodrigues}* · os 3 pontos que mais valem em R$:
1️⃣ {n} clientes da carteira sem compra no mês (média R$ {x}/cliente = R$ {y}) → {cliente}, {cliente}
2️⃣ {Arcor}: {x}% da meta 🔴 · {n} clientes compravam em outubro e não em novembro
3️⃣ Devolução R$ {x} ({x}% do faturado 🔴) · {n} notas "{motivo}"
👉 Amanhã: {cliente} e {cliente} na rota, com {Arcor} no pedido.
_GEROT {16/11}_
```
- **Dados:** curva negativa com o ticket médio do cliente, indústria × meta, quem comprou no mês anterior e não neste, devolução por motivo.

---

### GRUPO D — Clientes

#### D1 · Curva negativa (clientes sem compra no mês)
- **Exemplos:**
  - "Clientes que ainda não compraram esse mês" (Igor), "Jota precisa da curva negativa da semana" (Aleksandro), "me manda meus clientes sem compra" (áudio).
  - **"Curva negativa vendedora 10 de TSJ"** (caso reprovado: devolvia a ficha do vendedor).
  - Menu 5 (V e S).
  - Total: 2 + menu.
- **Cargo:** todos (S/G: por vendedor).
- **Reconhecer:** "curva negativa", "sem compra", "não compraram", "não positivados", "falta positivar", "inativos", "parados" **sem** "hoje/rota de hoje".
- **Não é:** "de hoje", "do giro de hoje", "do roteiro de hoje" (D2); "não compraram Mars" (F2).
- **Modelo:**
```
👥 *Sem compra em novembro · {10 - Nome} (TSJ)*
{51} de {99} clientes da carteira ({52}%) · positivação {farol} ritmo {52,6}%
*Maior valor primeiro (ticket médio · última compra · dias):*
• {370517 - Mercado X} · R$ {x} · {14/10} · {33} dias · 🔄 recorrência · na rota {qua}
• {código - cliente} · R$ {x} · {dd/mm} · {n} dias
… (até 8)
👉 {Nome}: {Mercado X} e {cliente} na rota de {quarta}; os {n} com mais de 60 dias, ligar até {sexta}.
_GEROT {16/11} · ver mais: "mais"_
```
- **"Da semana":** a mesma lista, filtrada para os clientes da rota da semana.
- **Sem a carteira do mês atualizada:** usa a última carteira conhecida e diz a data no rodapé (`carteira de 11/11`). **Nunca "sem a produtividade do mês na base".**
- **Dados:** carteira do mês, compra no mês (pedido ou faturado), última compra, ticket médio, TAGs (recorrência), dia da rota de cada cliente.

#### D2 · Rota de hoje a positivar
- **Exemplos:** "Quais clientes ainda não positivado no giro de hoje", "Curva negativa de hoje" (Aleksandro), "Quais clientes falta positivar Hemmer do roteiro de hoje" (Gessandro) (3).
- **Cargo:** V, S.
- **Reconhecer:** "não positivado / falta positivar / curva negativa / sem compra" + "hoje / giro / roteiro de hoje / rota de hoje".
- **Modelo:**
```
🎯 *Rota de hoje sem compra no mês · {Hemmer} ({código})*
{6} de {11} clientes de hoje ainda não compraram em novembro
• {cliente} · {45} dias · 🔄 recorrência · ✅ visitado {09:40} / ⏳ falta visitar
• {cliente} · {21} dias · 🟡 na mesa ({motivo})
…
👉 {Hemmer}: {cliente} (recorrência) antes do almoço.
_Clube {hh:mm} · rota de hoje_
```
- **Dados:** rota do dia, compra no mês por cliente, check-in e justificativa do dia, TAGs.

#### D3 · Minha rota de hoje / visitas / check-in
- **Exemplos:** "Minha rota hoje" (Tamara), "Minha rota de hoje" (Willian), menu 9 (V) e 8 (S) (2).
- **Cargo:** V, S.
- **Reconhecer:** "rota", "roteiro", "visitas", "check-in" sem "não positivado".
- **Modelo (V):**
```
🚶 *Rota de hoje · {352 - Tamara}* · {12} clientes
✅ {09:10} {cliente} · pedido R$ {x}
🟡 {10:05} {cliente} · {motivo}
⏳ {cliente} · 🔄 recorrência · {33} dias sem comprar
⏳ {cliente} · sem compra no mês
… (pela ordem da rota)
👉 Próximo: {cliente}.
_Clube {hh:mm}_
```
- **Proibido:** "Você não tem rota hoje" / "Rota: 0 PDVs" sem prova. Sem a rota de hoje: `Sua rota de hoje ainda não chegou (último: {dd/mm hh:mm}).` Mostra os clientes da rota desse dia da semana no roteiro do mês, com o rótulo "rota prevista do mês".
- **S:** uma linha por vendedor (visitas × média no horário, farol, próximo cliente); o código abre.

#### D4 · Recorrência
- **Exemplos:** "recorrencia" (Carlos), "Bom dia Jota Clientes recorrencia setor 118" (Edi), "Quais as recorrências de hoje?" (Marcos), **"Quais clientes posso positivar na recorrência ainda?"** (caso reprovado: respondia que não havia tag), menu 8 (V) e 6 (S) (3).
- **Cargo:** V, S.
- **Reconhecer:** "recorr".
- **Regra:** a meta e a lista de recorrência são do **GEROT** (objetivo do dia 1, meta 80%). A TAG da rota é só um complemento. Sem TAG na rota, a lista do GEROT responde. **Nunca "não há tag"** quando o GEROT tem a lista.
- **Modelo:**
```
🔄 *Recorrência · {530 - Marcos Nogueira}* · novembro
{9} de {28} compraram · meta 80% = {22} → faltam {13} {🔴} (ritmo {52,6}%)
*Ainda dá para positivar ({19}):*
• {cliente} · última {dd/mm} · na rota {hoje} ✅
• {cliente} · última {dd/mm} · rota {qui}
… (até 8; "hoje" = os da rota de hoje primeiro)
👉 {Marcos}: os {n} de hoje antes das 12h; os de quinta já com pedido sugerido (+MIX: digite 6).
_GEROT {16/11}_
```
- **Dados:** objetivo e lista de recorrência do mês, compra no mês por cliente, rota do dia e da semana.

#### D5 · +MIX / o que oferecer
- **Exemplos:** "Sugestão de Venda para cliente da rota" (Luiz), "Me manda o +mix da rota de hoje" (Poliana), menu 6 (V) e 10 (S) (2).
- **Cargo:** V (S/G: consolidado).
- **Reconhecer:** "mix", "+mix", "o que oferecer", "sugestão de venda", "o que vender".
- **Não é:** "sugestão:" (A6).
- **Modelo (V):**
```
🧺 *+MIX · rota de hoje · {314 - Luiz Pereira}* ({4} clientes)
*{cliente}* (sem compra no mês): {produto}, {produto}, {produto}
*{cliente}*: {produto}, {produto}
…
👉 Abrir o +MIX antes do pedido em {cliente} (maior potencial).
_+MIX {mês} · rota de hoje_
```
- **Sem rota de hoje:** `Sua rota de hoje ainda não chegou` + os clientes do dia da semana no roteiro do mês. Nunca "não tem clientes na rota de hoje" sem prova (Poliana, Hild).

#### D6 · Ficha de um cliente (código, CNPJ, loja)
- **Exemplos:** "298228", "04.757.459.004263" (CNPJ), "Consegue me passar o que teve de corte para loja 34" (Ana Dourado, AS) (3).
- **Cargo:** todos (dentro do escopo).
- **Reconhecer:** 5 a 6 dígitos; 14 dígitos com ou sem pontuação; "loja N" de rede (AS); "cliente {nome}".
- **Busca:** ficha do cliente, Clube e GEROT, com e sem pontuação. No AS, "loja 34" = a filial 34 da rede do vendedor.
- **Modelo:**
```
🏪 *{298228 - Cliente}* · {cidade} · {canal} · vendedor {483 - Ana Dourado}
Última compra {dd/mm} · R$ {x} · {n} dias · média R$ {x}/mês
Novembro: R$ {x} {farol vs. média} · indústrias: {Arcor}, {Mars}
✂️ Cortes no mês: R$ {x} · {produto} ({falta de estoque})
↩️ Devoluções: {n} notas · R$ {x}
👉 Oferecer: {produto}, {produto} (+MIX).
_GEROT {16/11} · Clube {hh:mm}_
```
- **Não achou:** `Não achei o CNPJ {04.757.459/0042-63} na sua carteira. É de outro vendedor? Me manda o código do cliente.`

#### D7 · Prospecção, campanhas e TAGs
- **Exemplos:** menu 10 e 15 (V), 12 e 13 (S); sem pergunta livre em 16/11.
- **Cargo:** V, S.
- **Reconhecer:** "prospec", "cliente novo", "campanha", "combo", "foco", "P11", nome de TAG.
- **Modelo:** campanha → `{n} de {n} clientes da TAG compraram {farol}` + a lista dos que faltam (até 8) + ação. Prospecção → os clientes perto da rota por tipo, com distância e a ação "visitar {cliente} na rota de {dia}".

---

### GRUPO E — Pedidos

#### E1 · Meus pedidos / pedidos da equipe (lista e status)
- **Exemplos:** "Meus pedidos", "Pedidos pendentes", "Pedidos bloqueados", "Qual seria esse bloqueio", "O que foi faturado dos meus pedidos", "Bom dia queria saber o que foi faturado do meus pedidos", "Como está os faturados e a faturar?", "Pedido pendente se foi faturado", "Preciso de informações sobre um pedido", "Jota atualize se meu time está com pedidos bloqueados ou pendentes" (15).
- **Cargo:** V, S.
- **Reconhecer:** "pedido(s)", "bloqueado", "pendente", "a faturar", "cancelado", "faturou", **sem** número de 7 a 10 dígitos.
- **Não é:** "quero a meta faturado e a faturar" (C2; em 16/11 foi para a lista de pedidos).
- **Modelo:**
```
📦 *Pedidos · {1087 - Poliana Almeida}* · últimos 7 dias
🔒 Bloqueados {2} · R$ {x} → {nº} {cliente} R$ {x} ({crédito/comercial, se souber})
⏳ A faturar {3} · R$ {x} · mais antigo de {dd/mm}
✅ Faturados {5} · R$ {x}
❌ Cancelados {1} · R$ {x}
👉 {Bloqueado de R$ {x} no {cliente}}: falar com o crédito hoje.
_Status de {hh:mm} · digite o nº do pedido para o detalhe_
```
- **"Preciso de informação sobre um pedido":** `Me manda o número do pedido (ex.: 1087000567).` e a lista acima.
- **Proibido:** o status parado sem dizer de quando (`Status da última conferência no CEVEN`). O rodapé é `Status de {dd/mm hh:mm}`; se tiver mais de 1 dia, `⚠️ status de {13/11}; pode ter mudado`.

#### E2 · Um pedido pelo número
- **Exemplos:** "Qual o status do pedido 1038000485" (Jonathan), "Queria saber se o pedido 477000212 foi faturado" (Elisandra), "382000940", "530001089", "48000991", "Consegue verificar se um pedido que digitei agora liberou?" (5).
- **Cargo:** V, S (o pedido tem que estar no escopo).
- **Reconhecer:** 7 a 10 dígitos (regra dos números). "o pedido que digitei agora" = o último pedido do dia daquele vendedor.
- **Teste de aceite:** a resposta **contém o número pedido**. Nunca lista genérica nem ficha do vendedor.
- **Modelo:**
```
📦 *Pedido {477000212}* · {477 - Elisandra Villanova}
{cliente} · R$ {x} · {n} itens · digitado {12/11 10:42}
Situação: ✅ Faturado em {13/11} · nota {nº}
{ou 🔒 Bloqueado ({motivo}) desde {hh:mm} · ⏳ Liberado, aguardando faturamento}
✂️ Corte: {produto} R$ {x} ({motivo})
Linha do tempo: digitado {..} → liberado {..} → faturado {..}
_Status de {hh:mm}_
```
- **Não achou:** `Não achei o pedido {477000212} entre os seus. Ele é de {data}? Confere o número.` Não manda outra coisa no lugar.

#### E3 · Cortes
- **Exemplos:** menu 16 (V) e 4.4; "corte" (Cláudio, Emillei pelo menu).
- **Reconhecer:** "corte", "cortou", "cortado".
- **Modelo:** `✂️ Cortes no mês: R$ {x} em {n} pedidos ({x}% do valor)` + por motivo + os 5 produtos mais cortados + o cliente mais afetado + ação (`oferecer substituto {produto}`).

#### E4 · Devoluções
- **Exemplos:** "Devolução", "Minhas devolução", "Tenho devolu", "Oi, quero saber da minhas devolução, valor e clientes" (Laura), "Quais clientes devolveram" (Rodrigo), "Quais são os clientes que devolveram o pedido em novembro" (Ivayr, S), "devoluções do meu time" (Tiago, S), "Devolução hoje" (Vitório) (8).
- **Cargo:** todos.
- **Reconhecer:** "devolu", "devolveu", "devolveram", "retorno de mercadoria".
- **Não é:** pedidos pendentes (erro de 16/11, Ivayr).
- **Modelo:**
```
↩️ *Devoluções novembro · {1072 - Laura Albuquerque}*
R$ {5.257} em {16} notas · {x}% do faturado {🔴} (média da filial {x}%)
• {12/11} · nota {729} · {cliente} · R$ {x} · {motivo}
• …(até 8, maior primeiro)
Por motivo: {avaria} R$ {x} · {cliente não pediu} R$ {x} · {falta de mercadoria} R$ {x}
👉 {cliente} devolveu {2}×: confirmar o pedido com o comprador antes de digitar.
_GEROT {16/11}_
```
- **Liga:** a marca "gol contra" só nos 6 motivos comerciais (já está no código). Em FALTA DE MERCADORIA, AVARIA e similares não aparece nenhum rótulo de Liga.
- **S/G:** por vendedor (pior primeiro) e as notas do maior.

---

### GRUPO F — Indústria

#### F1 · Painel de indústria
- **Exemplos:** "Como está o resultado por indústria?" (Marcelo, G), "Painel indústrias de TCA", "Card indústrias de TCA", "Como estamos de Arcor em API e TCV?" (Vitório), menu 13 (V) e 9 (S) (4).
- **Cargo:** todos (cada um no seu escopo).
- **Reconhecer:** "indústria", "fornecedor", nome de indústria **sem** pergunta de cliente/produto/comparação.
- **Modelo:**
```
🏭 *Indústrias · {API}* · novembro
Total: R$ {x} de R$ {meta} → {25,0}% {🔴} ritmo {52,6}%
🔴 {Arcor} {23,5}% · gap R$ {x} · positivação {n} de {meta}
🔴 {Mars} {x}% · gap R$ {x}
🟡 {Condor} {x}%
🟢 {n} indústrias no ritmo
👉 {Arcor}: {n} clientes compravam em outubro e não em novembro (pergunte "quem parou de comprar Arcor").
_GEROT {16/11}_
```
- **Várias filiais citadas** (API e TCV): um bloco por filial, ou uma linha por filial se for uma indústria só.

#### F2 · Indústria analítica (quem parou, mais vendidos, oportunidade)
- **Exemplos (todos do Vitório e do Carlos):** "Quem comprava Arcor e parou na Filial API", "Quem comprou o Arcor em outubro e não comprou em novembro?", "Compare quais os produtos de Arcor que mais vendem na filial API e TCV", "Quais as maiores oportunidades de Arcor em API comparado ao mês passado?", "Clientes que ainda não compraram Mars" (5).
- **Cargo:** D, G, S (V: "quem dos meus clientes não comprou Mars").
- **Reconhecer:** indústria + (parou, deixou de comprar, não comprou, quem compra, mais vendidos, compare, oportunidade, x mês passado).
- **Não é:** o card de metas (erro de 16/11 nas 4 perguntas).
- **Modelos:**
  - **Quem parou:**
```
🏭 *Arcor · API · compraram em outubro e não em novembro*
{n} clientes · R$ {x} em outubro
• {código - cliente} · R$ {x} em out · vendedor {código - nome}
… (maior primeiro, até 8)
Por supervisor: {sup} {n} · {sup} {n}
👉 {sup com mais}: {n} clientes com rota até {sexta}.
_GEROT out × nov até {16/11}_
```
  - **Mais vendidos / compare:** top 5 produtos por filial, lado a lado (`{produto}: API R$ {x} · TCV R$ {x}`), e o produto forte numa filial e fraco na outra como oportunidade.
  - **Oportunidade × mês passado:** clientes e produtos com a maior queda em R$ de outubro para novembro, no mesmo número de dias úteis (o rodapé diz "até o {10}º dia útil").
- **Dados:** venda por cliente × indústria × produto × mês, positivação por indústria, vendedor e supervisor do cliente.

---

### GRUPO G — Liga e premiação

#### G1 · Liga (posição, lances, regras)
- **Exemplos:** "Como estou na champions", "CHAMPIONS", "Champi", "Qual minha colocação na champions", "Boa tarde jota! Preciso saber o meu Ranking na liga champions", "Como está o meu time na liga?", "como estou no brasileirão", "Minha positivação na Liga dos Campeões", "Meus lances de hoje", "Gols", menu 2 e 2.1–2.2 (9).
- **Cargo:** todos.
- **Reconhecer:** liga, champions (e erros de digitação), brasileirão, ranking, colocação, lance, gol, pênalti, cartão, impedimento, regra.
- **Modelo:**
```
🏆 *{380 - Vinicius Batista}* (TCA): {12}º no Brasil ({▲2}) · {2}º na filial
{58} pts · {17}V {1}E {5}D · forma {DVDDJ}
Hoje: {+8} até agora ({gol} {cliente} · {defesa} {cliente}) · faltam {3} para vencer
👉 Para virar vitória hoje: pedido em {cliente} (recorrência = defesa +3).
_Liga {hh:mm} · fechamento às 19h30_
```
- A ação fala do **cliente**, e os pontos vêm como consequência. Sem lances de hoje porque não há dado: `Lances de hoje ainda não calculados (vendas do dia sem atualização)`. Nunca "nenhum lance ainda" quando o dado não chegou.

#### G2 · RV, comissão, premiação e aceleradores
- **Exemplos:** "Como está minhas RV desse mês e o que falta para bater cada uma delas?" (Iracema), "Quero saber quanto vou receber de comissões referente ao pagamento de dezembro" (Rodrigo), "Sobre esse fechamento o que levo de premiação?" (Luan), "Os vendedores conseguem saber quanto vão receber de comissão?" (Milena), "Quais são os aceleradores de novembro?", "Mostre quais são os aceleradores para TCA", "Qual é os aceleradores do mês de outubro" (8).
- **Cargo:** todos.
- **Reconhecer:** comissão, RV, premiação, prêmio, salário, holerite, receber, acelerador.
- **Modelo:**
  - **RV/comissão** (o valor em R$ não está no JOTA, por decisão):
```
💰 O valor em R$ da premiação ainda não está no Jota.
O que conta na sua RV, como está agora ({62 - Iracema}):
• Faturamento (40%): {x}% {farol} · gatilho 85% → faltam R$ {x}
• Positivação (30%): {n} de {meta} {farol}
• Recorrência (10%): {n} de {meta} {farol} · Mix (20%): {x} {farol}
👉 O que mais pesa agora: {faturamento}, R$ {x}/dia útil para o gatilho.
```
  - **Aceleradores:** o texto oficial do mês (o que a Milena mandou no grupo), guardado como regra do mês, e o "como está" de cada um. **Sem texto oficial cadastrado:** `Os aceleradores de novembro ainda não foram cadastrados no Jota; pedi ao comercial.` Nunca o card da filial no lugar (Milena, Ivayr).

---

## 3. Regras comuns de tom e de forma

### Sempre
1. **Abrir pelo desvio.** A primeira linha depois do cabeçalho diz o que está fora e quanto vale em R$ ou em clientes.
2. **Todo número tem referência e farol.** Meta, ritmo, necessário do dia, média do próprio vendedor ou média da filial. Número solto só no rodapé.
3. **Toda resposta com desvio termina com uma ação:** quem faz (código - nome), em qual cliente e até quando ("até 10h", "na rota de quarta").
4. **Pessoas sempre com o código:** `436 - Lidia Blanco`, `sup. 16 - Gessandro Sperotto`. Primeiro e último nome. Setor sem vendedor = `setor 543 (sem vendedor)`.
5. **Rodapé de uma linha:** fonte e hora, em itálico. Se o dado do dia não chegou, o rodapé diz o último horário real.
6. **Mesmo número em todo lugar.** Positivação, meta, faturado e "ontem" saem da mesma camada de fatos do dia que a TV e a Liga usam.
7. **Escopo do cargo.** V vê o próprio; S vê a equipe aberta por vendedor; G vê a filial ou o grupo; D vê o Brasil. Pedido acima do escopo: uma frase educada e o dado do próprio escopo.
8. **Lista com o pior primeiro**, até 5–8 itens, e "mais" para o resto.
9. **Dia em andamento = ⏳**, sem vermelho antes do fechamento.
10. **Português de campo:** "na mesa" (visitou e não vendeu), "sem visita", "a faturar", "rota de hoje", "positivar".

### Nunca
1. **"R$ 0", "0 visitas", "zerado", "sem rota", "0 PDVs" ou "0 de 0" sem prova.** Prova = rota do dia lida e vendas do dia atualizadas há 30 min ou menos. Sem prova: "hoje ainda sem atualização (último: {dd/mm hh:mm})", e a resposta segue com o mês.
2. **Linha sem dado.** Ela some. Nada de "(sem dado)", "ticket sem dado", "foco nos zerados" com 0 zerados, ou indicador vazio.
3. **Faturado negativo cru.** Sempre "faturado R$ X − devolvido R$ Y".
4. **Card de números em resposta a contestação, recado, agradecimento ou emoji.**
5. **Outra coisa no lugar do que foi pedido.** Se não há como responder, dizer o que falta e o que vai ser feito. Nunca devolver a lista genérica, a ficha do vendedor ou o card de metas no lugar.
6. **Jargão técnico ou de bastidor:** "base", "D1", "leitura", "produtividade do mês na base", "roteiro gravado", "CEVEN fora", "conferência no CEVEN", "DOSSIÊ 360°", "GEROT Atual", "du", marcadores internos.
7. **"Ontem" num domingo ou feriado.** Ontem = último dia com venda, com a data.
8. **"Vago" como nome de equipe ou de vendedor.**
9. **Abertura de enchimento** em pergunta direta: "Olha os números aí", "Na mão", "Seguem os dados", "Aqui está". Só os momentos (A1/B1/B2) têm 1 linha de saudação, que varia por dia (antispam).
10. **Plural errado ou "pedido(s)".** "1 pedido", "3 pedidos".
11. **Ler número puro como nota.** A pesquisa "Essa resposta ajudou?" aparece no máximo 1 vez por pessoa por dia, e nunca depois de um menu ou lista numerada.
12. **IA genérica com conselho sem cliente e sem valor.** A IA só reescreve dado pronto; nunca responde contestação, recado, menu ou pergunta de número.
13. **Pontos da Liga como motivo da ação** (só em G1 e em uma linha do fechamento). A ação é em R$ e cliente.
14. **Projeção apresentada como número real.** Tendência só quando pedida e com o rótulo.
15. **Julgar o número oficial** (meta, faturado). No máximo avisar "vendedor sem meta cadastrada".
16. **Silêncio.** Quem não está liberado recebe a orientação; mensagem que não for entendida recebe o menu com 3 sugestões.
17. **Mais de ~15 linhas** numa mensagem (o "um por um" do supervisor sai em várias mensagens, cada uma dentro do limite).

---

## 4. Respostas proativas (agenda do plano)

Valem **só quando o Vitório religar o proativo**. Hoje o JOTA é só reativo (desde 11/11). O caminho é: simulação de 3–5 dias, depois piloto em 1–2 filiais, e só então expansão.

**Travas comuns:**
- dado fresco: atualizado há menos de 30 min e pelo menos 95% dos vendedores atualizados;
- janela sem caso = nada é enviado;
- nada antes das 07:00, depois das 19:00, em fim de semana ou feriado;
- no máximo 4 avisos espontâneos por supervisor por dia;
- casos agrupados numa mensagem só;
- respostas que o JOTA entende: OK / folga / atestado, PJ / rede / centralizada (exceção de 7 dias, A8), "errado" (A7), "pausa hoje".

São 5 do supervisor e 2 do gerente, como no plano.

#### P1 · 07:30 · Supervisor · Plano do dia
O modelo **B1 — supervisor**, com o gap em R$ por vendedor e por indústria e os clientes sem compra no mês que estão na rota de hoje. Termina com 3 ações:
```
👉 1. {347 - Paulo}: {Mercado A} e {Mercado B} hoje (sem compra no mês · R$ {x} de média)
   2. {352 - Tamara}: {Arcor} em {n} clientes da rota (Arcor {23}% 🔴)
   3. RET com {347 - Paulo}
```

#### P2 · 09:05 · Supervisor · Rota sem check-in
```
🚶 *09:05 · Equipe {16 - Gessandro}* · {2} com rota e sem check-in
• {347 - Paulo Oliveira}: {9} clientes na rota · último check-in {sex 13/11}
• {1057 - Graciela}: {10} clientes · {Mercado X} é recorrência
Responda: OK (já está na rua) · folga · atestado
_Clube {09:00}_
```
Só sai se algum vendedor estiver sem check-in **e** a média dele nesse horário for de pelo menos 1 visita.

#### P3 · 11:00 · Supervisor · Ligar ainda hoje (na mesa com mais de 30 dias)
```
📞 *11:00 · para ligar ainda hoje* · Equipe {16 - Gessandro}
• {346 - Eduardo} · {Panificadora Romana} · {108} dias sem comprar · "{responsável ausente}" às {09:40}
• {352 - Tamara} · {Mercado X} · {45} dias · 🔄 recorrência · "{sem dinheiro}"
👉 Ligar até 12h; se o comprador volta à tarde, {vendedor} passa de novo.
_Clube {10:55}_
```

#### P4 · 12:00 · Supervisor · Rota atrasada
Sai quando o vendedor visitou menos de 40% da rota **ou** a eficácia está abaixo de 80% da média dele:
```
⏱️ *12:00 · rota atrasada* · Equipe {16 - Gessandro}
• {347 - Paulo}: {2} de {11} visitas (média dele às 12h: {6}) {🔴}
• {352 - Tamara}: {6} visitas · {1} pedido (eficácia {17}% · média {48}%) {🔴}
👉 Ligar para {Paulo} agora; com {Tamara}, ver os {5} "na mesa" (digite 352).
_Clube {11:55}_
```

#### P5 · 18:30 · Supervisor · Fechamento do dia
O modelo **B2 — supervisor**: por vendedor quem vendeu, quem ficou na mesa e por quê, quem ficou sem visita, indústrias abaixo do ritmo, visitas a conferir e a ação de amanhã com dono, cliente e prazo.

#### P6 · 12:00 · Gerente · Retrato curto
```
🧭 *12:00 · {TPH} · onde a filial perde hoje*
📝 R$ {x} vendido ⏳ · necessário do dia R$ {y} · mês {x}% {🔴} ritmo {52,6}%
🔴 sup. {47 - Allison}: {4} vendedores sem pedido · {n} de {n} visitas {🔴}
🔴 sup. {96 - Jefferson}: {Arcor} {x}% · gap R$ {x}
🟢 {n} supervisores no ritmo
👉 {Allison}: ligar para {código - vendedor} e {código - vendedor} até 14h.
_Clube {11:55} · GEROT {16/11} · digite o código do supervisor_
```

#### P7 · 18:45 · Gerente · Fechamento por supervisor
```
🌙 *Fechamento {16/11} · {TPH}*
📝 Vendeu R$ {x} · necessário R$ {y} {farol} · visitas {n} de {n} {farol}
📊 Mês {x}% {farol} ritmo {52,6}% · positivação {n} de {n} {farol}
*Por supervisor (pior primeiro):*
🔴 {47 - Allison}: R$ {x} · {3} sem pedido · {12} na mesa · ⚠️ {347 - Paulo} sem check-in, sem resposta às 09:05
🟡 {96 - Jefferson}: …
🟢 {n} supervisores no ritmo
🏭 {Arcor} {x}% 🔴 · {Mars} {x}% 🔴
👉 Amanhã: {Allison} RET com {Paulo}; {Jefferson} {Arcor} em {n} clientes.
_Clube {18:40} · GEROT {16/11}_
```
O escalonamento ao gerente vai **dentro** desta mensagem e só entra quando:
- o caso é material e ainda reversível;
- o supervisor recebeu o aviso, teve pelo menos 60 min e não respondeu;
- o supervisor foi avisado de que o caso entraria no resumo do gerente.

---

## 5. Casos-teste obrigatórios (entram na bateria de regressão)

| Mensagem real | Cargo / hora | Tem que conter | Não pode conter |
|---|---|---|---|
| Venda Tamara TCV hoje | S/D, 10h | "352 - Tamara" + vendido hoje ou "sem atualização" + clientes do dia | "Faturado:" como 1ª linha (ficha do mês) |
| Quanto a Tamara vendeu hoje | S/D | o mesmo | o mesmo |
| Curva negativa vendedora 10 de TSJ | S/G/D | a lista de clientes sem compra do vendedor 10 | a ficha do vendedor |
| Quais clientes posso positivar na recorrência ainda? | V | "faltam" + a lista de clientes | "não há tag" |
| Atualiza os números de hoje do meu time | S, 11h | "sem pedido" com nome, motivo, necessário do dia, 👉 | só a lista de R$ por vendedor |
| Fechamento | S, 18:16 | data de hoje + por vendedor + 👉 Amanhã | "Outubro" |
| Fechamento do dia 16/11/2026 | S | por vendedor, na mesa com motivo, sem visita | "0 de 0", "(sem dado)", "1 pedidos", "foco nos zerados" com 0 |
| Fechamento do vendedor com 4 sem pedido | V, 17h+ | "Visitou e não vendeu (4)" + nomes | só "Valeu, time!" |
| Karina já vendeu hoje | S | "Conferi agora" + o dado da Karina com hora | o card da equipe |
| Não procede / Informação não confere | S | "vou conferir" + o dado e a hora | "DOSSIÊ", o card de números |
| João é PJ | S | "Anotado" + validade | o card do vendedor |
| Ok, já acionada, porém a compra é centralizada | S | "Anotado" + "centralizada" | "visão da diretoria" |
| 2 (logo depois de um menu) | S | a opção 2 | "nota" |
| Qual o status do pedido 1038000485 | S | "1038000485" | a lista de pendentes |
| 48000991 | V | "48000991" | a ficha do vendedor |
| Quantos tenho que vender por dia para 85% da meta | V | "85%" e "por dia" com valor | "+MIX", "rota" |
| Quem comprava Arcor e parou na Filial API | D | a lista de clientes | "Metas das indústrias" |
| Quais são os aceleradores de novembro? | D/S | o texto oficial, ou "ainda não cadastrados" | o card da filial |
| Bom dia (segunda, 08h) | V | "Último dia (sáb/sex dd/mm)" | "Ontem (15/11)" |
| Qualquer resposta antes da 1ª atualização do dia | todos | "sem atualização (último …)" | "R$ 0", "0 visitas", "sem rota", "0 PDVs" |
| Bom dia (número sem cadastro) | — | "ainda não está liberado" | silêncio |
| Ok, obrigada! | S | 1 linha | números, "O que fazer agora" |

---

## 6. Histórico
- 16/11/2026: catálogo criado a partir das 370 perguntas de 16/11 e dos casos reprovados pelo diretor (Tamara, curva do vendedor 10 de TSJ, recorrência, dia da equipe, fechamento que só aplaude, contestações, e o "Fechamento" do Luis Boeira às 18:16). Ainda não implementado.
