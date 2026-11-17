# JOTA — Plano de qualidade das respostas e de proatividade

> Vitório, 16/11/2026: "esse projeto é o da minha vida... auditar a qualidade e as informações de todas as respostas... fazer um plano para darmos as respostas corretas e sermos proativos com o que realmente importa"; "tudo precisa ter redundância".
> Este documento manda sobre o JOTA a partir de 16/11/2026. Ele continua o [MAPA_DAS_FONTES.md](MAPA_DAS_FONTES.md) de 13/11, cujos passos 1, 3, 4, 5 e 6 **não foram executados**, e por isso o dia 16/11 deu errado.
> Auditoria completa, pergunta por pergunta: [AUDITORIA_JOTA_2026-11-16.md](AUDITORIA_JOTA_2026-11-16.md).

---

## 1. O que aconteceu em 16/11 (medido no D1)

| Medida | Valor |
|---|---|
| Perguntas recebidas | 370 (de ~90 pessoas) |
| Respostas com problema | **233 (63%)** |
| Mensagens proativas não pedidas (analista + escalonamento) | **412** para ~45 supervisores, 07:33–14:48, a mesma mensagem até 13 vezes |
| Primeira leitura do dia do Clube da Venda | **14:53** (o robô roda no PC; nos dias anteriores começou entre 07:08 e 09:01) |
| CEVEN | fora desde 11/11 17:34 (volta prevista 17/11) |
| Lances da Liga | 2.300–2.600/dia até 11/11 → **17 a 18/dia de 12/11 em diante** |

### Problemas por tipo

| # | Problema | Respostas | Exemplo real |
|---|---|---|---|
| 1 | "R$ 0", "zerado", "0 visitas" sem nenhuma leitura do dia | 107 | Marcus (TPH 57) às 08:57 e 10:00: "Digitado R$ 0"; o Clube mostrou depois R$ 86.833 |
| 2 | "Rota: 0 PDVs" / "Você não tem rota hoje" | 57 | Todas as matinais de supervisor; Tamara, Willian, Vinicius |
| 3 | Contestação ou recado respondido com card de números | 17 | Sueli "Karina já vendeu"; Gessandro "tá com 3 pedidos"; Delinlson "João é PJ"; Pedro "compra centralizada" → BLOQUEADO (escopo) |
| 4 | "Ontem" errado na segunda-feira | 62 | 25 respostas com "Ontem (15/11): sem pedido" (domingo); outras 26 com 13/11 e 11 com 14/11 |
| 5 | Faturado negativo sem explicação | 14 | Ana Dourado "Faturado R$ -32.139"; Laura "R$ -4.746 · positivação 1 de 99" |
| 6 | Pessoa sem cadastro sem nenhuma resposta | 13 pessoas | Edivandro (5 mensagens, "meu CEVEN não está funcionando"), Cassiany (3), Cintia, Adriomar |
| 7 | "Sem dado na base" em vez de responder | 9 | Aleksandro 4×: "curva negativa", "clientes não positivados" |
| 8 | Pedido por número não encontrado | 5 | "status do pedido 1038000485", "477000212 foi faturado?" → lista genérica |
| 9 | Número de menu lido como nota | 7 | Washington "1" → "nota 1 anotada"; depois a mensagem dele virou "sugestão" |
| 10 | Pergunta analítica respondida com card pronto | 4 | Vitório: "quem comprava Arcor e parou em API" → card de metas |
| 11 | Números diferentes para a mesma coisa | — | Positivação API na mesma manhã: 1.279 de **3.528** (card "agora") × 1.280 de **3.737** (matinal) |
| 12 | Fechamento que só aplaude | todos os fechamentos | Eduardo: "Vendeu R$ 3.493 · positivou 3 · Valeu, time!" — não disse que 4 ficaram sem pedido (um com 108 dias sem comprar) |
| 13 | Outros (gol contra em motivo não comercial, "Vago" no nome, meta R$ 0, IA genérica, CNPJ/loja não achados) | 17 | ver auditoria |

### Causas-raiz (são 6, e explicam quase tudo)

1. **O dia não tinha fonte.** Sem CEVEN e com o robô do Clube desligado até 14:53, o JOTA respondeu como se "nada lido" fosse "zero".
2. **O JOTA ainda usa o CEVEN como fonte principal** para rota, pedidos e produtividade. O Clube e o GEROT entraram como remendo, em alguns cards e não em outros, sem regra única de redundância.
3. **O entendimento da pergunta é fraco:** número de pedido, devolução, recado ou contestação, número de menu e perguntas analíticas caem no card errado.
4. **Não existe uma camada única de "fatos do dia".** Cada card calcula o seu: "ontem", meta de positivação e faturado saem diferentes em cada resposta.
5. **O agente proativo não tinha trava de dado nem de repetição.**
6. **Não existe teste com perguntas reais antes de publicar.** Por isso o erro aparece no WhatsApp do vendedor, e não no nosso teste.

---

## 2. Redundância: de onde vem cada dado (regra única)

Cada dado tem uma fonte principal e uma reserva. O JOTA usa a primeira que estiver **fresca** e diz qual usou e a hora. Só fica sem resposta quando **todas** falham. Nesse caso diz a última leitura real com a hora, nunca "0".

| Dado | 1ª fonte | 2ª fonte | 3ª fonte | Hoje | O que falta |
|---|---|---|---|---|---|
| Digitado do dia (R$, nº pedidos) | Clube (relatório de vendas, 15 min) | Winthor (pedido_status) | CEVEN produtividade | Clube ✅ (só quando o robô roda) | robô online |
| Pedido a pedido do dia (nº, cliente, valor, status) | Clube (Relatório de Pedido / painelPedido) | Winthor | CEVEN histórico | ❌ só contagem | **gravar a lista** (passo 1 do mapa) |
| Rota do dia (clientes planejados) | Clube (Roteiro Pedido) | roteiro do mês gravado (CEVEN 11/11) | — | só roteiro do mês de 11/11 | **ler o Roteiro do Clube** (passo 4) |
| Check-in/out (hora, cliente) | Clube | CEVEN | — | ✅ | — |
| Justificativa de não venda | Clube | CEVEN | — | ✅ gravada, quase não usada | usar no JOTA e na Liga |
| Faturado, carteira, devolução e meta do mês | GEROT | CEVEN dashboard | — | ✅ | regra única de meta (item 11) |
| Positivação e meta de positivação do mês | GEROT | CEVEN | — | ✅ mas com 2 metas diferentes | uma fonte só por tela |
| Venda e positivação por indústria | GEROT | Clube (por fornecedor) | — | ✅ mês | dia por indústria (passo 1) |
| Clientes sem compra, última compra, carteira | GEROT (dimensão Cliente) | ficha_cliente (Data Lake) | Clube (Carteira) | parcial | passo 3 do mapa |
| Devolução com motivo | CEVEN | GEROT (valor) | — | ❌ motivo parado desde 11/11 | achar o motivo no GEROT/Winthor |
| Status do pedido (bloqueado/liberado/faturado) | Clube (Relatório de Pedido) | Winthor | CEVEN | ❌ parado em 13/11 | passo 1 |
| TAGs (recorrência, foco) | Clube (Mix/foco) | roteiro gravado | — | só gravado | passo 4 |

**Regra de frescor:** dado do dia vale até 30 min após a leitura; dado do mês vale até a próxima posição do GEROT. Toda resposta termina com a fonte e a hora: `Clube 14:53 · GEROT 16/11`.

---

## 3. Plano de correção das respostas

### Fase 0 — hoje e amanhã cedo (antes das 06:30 de 17/11)
| Entrega | Critério de aceite |
|---|---|
| **Robô do Clube na nuvem** (GitHub Actions, 15 em 15 min, 06:30–21:00, com alerta se falhar 2 rodadas) | 1ª leitura às 06:30; o dashboard de rodadas mostra todas as rodadas do dia |
| **Analista e escalonamento proativos parados** até a Fase 3 (sem apagar o código) | zero `monitoria_*` em `bot_msgs` |
| **Gol contra só nos 6 motivos** (feito em `entende.js`) | o teste de devolução mostra "não gera lance" em FALTA DE MERCADORIA |
| **Meio do dia e fechamento do vendedor cliente a cliente pelo Clube** (feito em `momentos.js`: com pedido, visitou e não vendeu com motivo e dias, na rota sem visita com nome, ação) | Eduardo e Marcus de 16/11 saem como na seção 6 |

### Fase 1 — fonte única e redundância (17 e 18/11)
1. **Camada única "fatos do dia"** (uma função, usada por todos os cards): digitado, pedidos, visitas, rota, justificativas, faturado, meta, positivação e devolução, cada um com fonte e hora. Os cards só formatam. Isso acaba com as duas metas e os três "ontens".
2. **"Ontem" = último dia com venda.** Na segunda, sábado se houve venda, senão sexta, com a data escrita.
3. **Robô do Clube lendo também:** lista de pedidos do dia (nº Clube, nº Winthor, cliente, valor, status, bloqueio), Roteiro Pedido (rota do dia cliente a cliente) e venda do dia por indústria. Os passos 1 e 4 do mapa.
4. **Zerado só com prova:** rota do dia lida e Clube lido há menos de 30 min mostrando 0 pedido. Sem prova, o JOTA diz "Clube ainda não leu hoje · última leitura 15/11 20:08" e mostra o mês pelo GEROT.
5. **Faturado negativo** passa a aparecer como "devolução maior que o faturado do mês: R$ X faturado − R$ Y devolvido".

### Fase 2 — entender a pergunta (18 a 20/11)
| Situação | Hoje | Correção |
|---|---|---|
| Número de 9–10 dígitos | ficha do vendedor / lista | ficha **daquele** pedido (status, valor, cliente, itens, corte, linha do tempo) |
| "1", "2"… logo após um menu (até 10 min) | nota | opção do menu; nota só depois de "Essa resposta ajudou?" sem menu aberto |
| Contestação ("não procede", "já vendeu", "fez check-in") | card de números | "Entendi, vou conferir": mostra a fonte e a hora do dado, confere no Clube na hora e responde o que achou; registra para auditoria |
| Recado ("é PJ", "compra centralizada", "está em outro setor", "já acionei") | card ou BLOQUEADO | confirma, guarda a exceção (vale 7 dias) e para de cobrar aquele caso |
| Devolução: "quem devolveu", "clientes que devolveram" | pendentes | lista de notas com cliente, valor e motivo |
| Conta: "quanto por dia para 85%" | +MIX | faz a conta (meta × 85% − faturado − carteira) ÷ dias úteis |
| Indústria analítica: "quem parou de comprar Arcor", "mais vendidos API × TCV", "oportunidade x mês passado" | card de metas | consulta ao GEROT por cliente/produto e mês |
| CNPJ / loja / código de cliente | "não achei" | busca em ficha_cliente + Clube + GEROT, com e sem pontuação |
| "Última atualização" | card | hora de cada fonte |
| Pessoa sem cadastro | silêncio | resposta na hora: "seu número ainda não está liberado; peça ao seu supervisor / Milena" + aviso diário ao Vitório com a lista |
| Aceleradores do mês | fechamento | texto oficial do mês (o que a Milena mandou no grupo) |

### Fase 3 — trava de qualidade (junto com a Fase 1, antes de qualquer publicação)
1. **Bateria de regressão:** as 370 perguntas reais de 16/11 (e de cada dia daqui para frente) com a resposta esperada por tipo: "pedido 477000212" tem que conter 477000212; "Karina já vendeu" não pode ser card; nenhuma resposta com "R$ 0" sem leitura do dia. `testes/rodar_testes.mjs` reprova a publicação se uma piorar.
2. **Auditoria diária automática às 19:00:** o mesmo robô que gerou o [AUDITORIA_JOTA_2026-11-16.md](AUDITORIA_JOTA_2026-11-16.md) roda todo dia. O Vitório recebe no WhatsApp: perguntas, % com problema, os 5 piores casos e o que foi corrigido.
3. **Meta:** ≤ 5% de respostas com problema em 7 dias; **zero** dado falso.

---

## 4. Proatividade: o agente de apoio ao time

Avaliado por um analista de vendas sênior (nota 5,5) e por um gerente comercial de campo (nota 6) em 16/11. Esta é a versão revisada com as críticas dos dois.

### Princípios
- **Pensado em R$ e positivação, não em pontos da Liga.** O aviso mostra a oportunidade ("cliente parado há 108 dias"), não "vai virar pênalti".
- **Só dado que existe e está fresco:** leitura com menos de 30 min e pelo menos 95% dos vendedores lidos. Na dúvida, silêncio.
- **Mesmo número da TV e da Liga** (camada "fatos do dia").
- **Poucos horários fixos, casos agrupados.** Janela sem caso = não manda nada. Nada antes das 07:00, depois das 19:00, nem em fim de semana ou feriado.

### Agenda
| Hora | Para | Conteúdo | Fonte |
|---|---|---|---|
| 07:30 | supervisor | **Plano do dia:** 3 ações em R$ com nome e cliente. Diferença = meta × % dos dias úteis passados − (faturado + carteira), por vendedor e indústria, ordenada em R$; cruza com os clientes sem compra no mês que estão na rota de hoje | GEROT + rota |
| 09:05 | supervisor | Quem tem rota e não fez check-in (resposta: OK / folga / atestado) | Clube |
| 11:00 | supervisor | Clientes justificados com mais de 30 dias sem comprar, para ligar ainda hoje | Clube |
| 12:00 | supervisor | Rota atrasada: menos de 40% visitado, ou eficácia muito abaixo do histórico do próprio vendedor | Clube |
| 12:00 | gerente | Retrato curto: onde a filial perde e qual supervisor deve agir | GEROT + Clube |
| 18:30 | supervisor | Fechamento: por vendedor, quem comprou, quem ficou na mesa, quem ficou sem visita; o que muda amanhã | Clube + GEROT |
| 18:45 | gerente | Fechamento por supervisor, com escalonamentos dentro | idem |

Fora até a fonte existir: impedimento (o Clube não tem GPS do check-out), pedido bloqueado (o status está parado) e cliente foco sem pedido (falta o pedido por cliente). Voltam com a Fase 1, item 3.
A mais: **visita suspeita** (check-in de menos de 3 min sem pedido, várias visitas no mesmo minuto) vai para o fechamento, como "conferir".
Nos últimos 5 dias úteis do mês o foco muda: faturar a carteira e positivar as indústrias com meta em risco.

### Conversa e controle
- **Respostas que o agente entende:** "errado" (para aquele tipo de aviso para aquela pessoa e abre conferência), "pausa hoje", "OK / folga / atestado", "PJ / rede / centralizada" (exceção de 7 dias, visível ao gerente).
- **Regra fixa do canal:** no AS, rede de compra centralizada nunca é cobrada como "sem pedido".
- **Escalonamento ao gerente** só quando:
  - o caso é material e ainda reversível;
  - o supervisor recebeu o aviso, teve pelo menos 60 min e não respondeu;
  - o supervisor foi avisado de que o caso entraria no resumo do gerente.

  Sempre dentro do resumo do gerente, nunca avulso.
- **Medição honesta:** 20% dos casos sorteados ficam sem aviso, para comparar. O sucesso se mede em R$ e positivação recuperados. Nunca se usa a medição para pontuar pessoas.

### Como liga
1. **3 a 5 dias em simulação** (incluindo uma segunda-feira). O Vitório e 2–3 supervisores marcam "procede / não procede" em cada aviso.
2. **Piloto em 1–2 filiais**, anunciado pelo gerente no grupo, que também diz que o robô antigo foi desligado.
3. **Expande só se em 30 dias:**
   - zero dado falso;
   - pelo menos 90% dos avisos "procede";
   - no máximo 4 avisos espontâneos por supervisor por dia;
   - pelo menos 70% dos supervisores do piloto pedindo para continuar.

---

## 5. Liga de 11/11 em diante

| Dia | Lances gravados | Dados disponíveis para refazer |
|---|---|---|
| 11/11 | 2.312 (parcial: CEVEN caiu 17:34) | pedidos gravados + resto do dia no Clube? (o Clube começou em 12/11) |
| 12/11 | 18 | 2.552 pedidos gravados + check-ins e justificativas do Clube |
| 13/11 | 17 | 2.328 pedidos + Clube |
| 16/11 | 18 | Clube (check-in, justificativa, totais); **sem pedido por cliente** até o robô gravar a lista |

**Pontuação do passado:** os 692 gols contra desde 05/10 foram conferidos e estão corretos (677 contam, todos com motivo comercial; 15 de 05/10 já ficam fora). Os 841 vermelhos de devolução são todos "CLIENTE NAO PEDIU".
**Recálculo:** cada dia é refeito sem gravar, com relatório antes e depois por vendedor. Depois passa pela auditoria lance a lance, fechamento e conferência. Só grava com OK do Vitório.

---

## 6. Como fica a resposta (exemplos reais de 16/11, rodados com dados de produção)

**Eduardo (TCV 346), fechamento:**
```
📊 Mês: 52,5% da meta · Positivação: 25/91
🚶 Rota: visitou 7 de 7 · rota completa
📝 Vendeu R$ 3.493 em 3 pedido(s)
✅ Com pedido: Mercado Torres, Bahianinho Serv Fest, Mercado Marques
🟡 Visitou e não vendeu (4):
• Panificadora Romana (#13353) · 108 dias sem comprar · Responsável pela compra ausente
• Mercado Oliveira (#10831) · Responsável pela compra ausente
• Supermecado Central (#8111) · Responsável pela compra ausente
• Aparecida Serafim (#11087) · Responsável pela compra ausente
👉 Amanhã cedo: ligar para Panificadora Romana (108 dias sem comprar) e marcar o pedido.
Clube da Venda · 17:09
```

**Marcus (TPH 57), fechamento:**
```
🚶 Rota: visitou 0 de 2 · 2 sem visita
📝 Vendeu R$ 86.833 em 1 pedido(s) (1 fora da rota)
🔴 Na rota e sem visita (2):
• Sm Jacomar (#81856) · Getulio Vargas · 16 dias sem comprar
• Sm Jacomar (#81850) · Br 376 Km 19 · 17 dias sem comprar
👉 Amanhã: visitar ou ligar para os dois Sm Jacomar.
```
(Hoje a rota vem do roteiro do mês gravado em 11/11. Com a Fase 1, item 3, vem do Roteiro do Clube.)

---

## 7. Decisões do Vitório
1. **Segredos `TP_USER` / `TP_PASS` no GitHub** para o robô do Clube rodar na nuvem. Sem isso, a Fase 0 não sai e 17/11 repete 16/11.
2. **Filiais do piloto do agente** (1 ou 2).
3. **Publicação:** Fase 0 assim que a bateria de 16/11 passar.

## 8. Histórico
- 16/11/2026 — Documento criado após a auditoria de 370 perguntas. Já feito no código (não publicado): gol contra só nos 6 motivos (`functions/_lib/jota/entende.js`); meio do dia e fechamento do vendedor cliente a cliente pelo Clube, com rota sem visita pelo roteiro do mês (`functions/_lib/jota/respostas/momentos.js`).
