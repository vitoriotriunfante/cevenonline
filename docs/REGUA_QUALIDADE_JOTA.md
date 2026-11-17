# Régua de qualidade do JOTA

Criada em 16/11/2026, depois da auditoria do dia (`docs/AUDITORIA_JOTA_2026-11-16.md`: 63% das respostas com problema).
A régua é um conjunto de regras **objetivas e verificáveis por código** que reprovam uma resposta do JOTA. Ela olha só o texto da pergunta,
o texto da resposta e um contexto mínimo (papel de quem perguntou, hora em Brasília, data, a resposta anterior e se a pessoa tem cadastro).

- Código: `testes/jota_regua.mjs` → `avaliar(pergunta, resposta, contexto)` devolve a lista de violações `{ id, nome, severidade, detalhe }`.
- Testes unitários com casos reais de 16/11: `node testes/jota_regua.mjs` (32 casos, positivos e negativos).
- Bateria de regressão que usa a régua: `node testes/jota_regressao.mjs --rapido | --completo` → `docs/REGRESSAO_JOTA_<data>.md`.
- **Severidade:** `bloqueia` = a resposta está errada e, quando a bateria for plugada no `testes/rodar_testes.mjs`, cancela a publicação (hoje só os casos-chave dão código de saída 1); `alerta` = entra na taxa e no relatório, mas não reprova sozinho.
- Ainda **não está plugada** no `testes/rodar_testes.mjs` (decisão do Vitório).

Notação: `q` = pergunta sem acento e em minúsculas; `r` = resposta sem `*`, `_` e `~`. "Linhas com conteúdo" = linhas da resposta sem a saudação ("Aqui está, X:", "Olha os números aí", "Bom dia, X! …:") e sem os rodapés padrão.

| id | nome | severidade | o que reprova | como detecta |
|---|---|---|---|---|
| R01 | FONTE_CEVEN | bloqueia | Citar "CEVEN" para o time ("Painel do CEVEN: …", "Dados do CEVEN lidos às …", "Você não tem rota hoje no CEVEN"). | `/\bceven\b/i` em `r`. |
| R02 | NOTA_TECNICA | alerta | Nota técnica de fonte ou leitura: GEROT, Winthor, D1, "lidos até", "leitura mais recente", "🕒 Fontes", "(lido 01:04)", "conferidos na última hora", DOSSIÊ, varredura. O rodapé padrão `🟢 Hoje (Clube da Venda · HH:MM): pedidos colocados.` (decisão de 12/11) é permitido. | regex dessas palavras fora das linhas de rodapé. |
| R03 | ZERO_SEM_LEITURA | bloqueia | "R$ 0", "0 pedidos", "0 visitas", "visitas: 0 de N", "sem rota", "não tem clientes na rota de hoje", **sem uma leitura do dia** que sustente o zero. | Achou um padrão de zero do dia e **não** há na resposta uma hora de leitura (`Clube da Venda · HH:MM`, `hoje Clube HH:MM`, `lidos até HH:MM`) **a partir das 06:00** e **até 3 h antes** da hora da resposta. |
| R04 | ROTA_ZERO | bloqueia | "Rota: 0 PDVs" / "rota 0" em card de equipe ou filial em dia útil (a matinal de 16/11 saiu assim para todas as equipes). | `/Rota:?\s*0\s*PDVs|\brota 0\b/i` em dia útil (seg–sex). |
| R05 | PERIODO_TROCADO | bloqueia | Pergunta do DIA respondida com a ficha do MÊS (ou com o "Fechamento de Outubro"), ou pergunta do MÊS respondida só com o dia. | Período da pergunta: DIA se `hoje`, `do dia`, `dia DD/MM`, `neste momento`; ou `fechamento` sem mês **depois das 17h** (Vitório, 16/11). MÊS se `mês`, `mensal`, `acumulado`, nome de mês, `fechamento de`. Período da resposta: nas 3 primeiras linhas com conteúdo, DIA se `hoje`, `digitado`, `vendeu/vendido`, `Dia da Equipe`, `Operação de hoje`, `apito final`, `placar`; senão MÊS se `faturado`, `da meta`, `Fechamento de <mês>`, `foto de`, `mês`, `Positivação:`, `Matinal`, `Ontem`. Reprova se os dois existem e são diferentes, ou se a pergunta é do DIA e a resposta traz `Fechamento de <mês>`. |
| R06 | ASSUNTO_ERRADO | bloqueia | Pergunta de um assunto respondida com outro. | Assunto pela pergunta → marcador obrigatório na resposta: **curva negativa / sem compra** (`curva negativ`, `sem compra`, `não compraram`, `ainda não positiv`, `quem parou`) → `curva negativa`/`ainda não compraram`/`clientes sem compra` **e** ao menos 1 cliente (`#código` ou `N dias sem compra`); **recorrência** (`recorr`) → `recorr`; **devolução** (`devolu/devolv`) → `devolu/devolv`; **pedido nº X** (número de 8 a 10 dígitos na pergunta, sem cnpj/telefone) → o mesmo número na resposta; **indústria** (nome de indústria do GEROT ou `indústria`/`fornecedor`) → o nome da indústria; pergunta analítica de indústria (`compar`, `quem`, `oportunidade`, `mais vend`, `parou`, `produtos`) respondida com "Metas das indústrias" sem lista → reprova; **prospects** → `prospec`; **liga** (`liga`, `champions`, `ranking`) → `liga/champions/º no Brasil/pts`; **pendentes/bloqueados** → `pendent/bloquead/liberad`; **cortes** → `corte`; **menu** (`menu`, `menu do jota`) → `MENU DO JOTA`; **aceleradores** → `acelerador`; **hora do dado** (`última atualização`) → hora ou `atualiz`; **+mix** → `mix`. Não se aplica a contestação (R09). |
| R07 | LISTA_PEDIDA_SEM_LISTA | bloqueia | Pediu "quais clientes / quem / lista / me manda os clientes" e não veio nenhum cliente. | `q` com `quais|quem|lista|liste|relação` + `cliente|loja|pdv|positivar` e a resposta sem linha de cliente (`#código`, `N dias sem compra` ou `1. Nome (#código)`). |
| R08 | NEGATIVA_CONTRADITORIA | bloqueia | Resposta negativa que contradiz a própria resposta ("nenhum cliente com a tag Recorrência" junto de "faltam 18"), ou que olhou a **tag do roteiro** quando a pergunta era a **lista de recorrência**. | `nenhum cliente …` + `faltam N` (N > 0) na mesma resposta; ou `nenhum cliente … com a tag` em pergunta de recorrência. |
| R09 | CONTESTACAO_COM_CARD | bloqueia | Contestação ou recado ("não procede", "metas estão erradas", "já tinha feito check-in", "tá com 3 pedidos", "todos estão com pedido", "é PJ", "3.761,24 venda", "falta a Juliana") respondido com card de números. Esperado: registrar o recado ("Anotado…") e, se for o caso, conferir. | `q` casa com a lista de padrões de contestação e a resposta é card (2+ "R$", ou `Dia da Equipe`, `Faturado:`, `Digitado`, `Pedidos Pendentes`, `Check-in e check-out`, `Sua equipe`, `🧑‍💼`, `Matinal`, `DOSSIÊ`) e não abre com `Anotado/Registrei/Valeu/Obrigado/Certo/Entendi`. |
| R10 | NUMERO_COMO_NOTA | bloqueia | Número solto (escolha de menu ou de lista) tratado como nota ("Obrigado pela nota 4"). A avaliação hoje é por 👍/👎. | `q` só com 1 a 3 dígitos e `r` com `obrigado pela nota` / `nota N anotada`, a menos que a resposta anterior tenha pedido nota de 1 a 5. |
| R11 | DUAS_CONTAS | bloqueia | Duas contas diferentes da mesma métrica na mesma resposta (ex.: curva negativa da Tamara: "já compraram 74 · ainda não compraram 59" e "positivação 50 de 99"). | Nas linhas de cabeçalho (fora itens de lista e linhas de recorrência) extrai: positivados (`Positivação X de Y`, `já compraram X`), base (Y), faltam (`Y−X`, `ainda não compraram N`, `faltam N clientes/positivações`), vendido hoje (`Digitado/Vendido hoje/Vendeu R$`), visitas (`visitas X de Y`), faturado (`Faturado: R$`). Mais de um valor para a mesma métrica reprova. |
| R12 | SEM_ACAO_FINAL | alerta | Pergunta que pede ação (curva, sem compra, zerados, recorrência, positivar, "o que fazer/melhorar", rota, fechamento, minha equipe/meu time) sem ação no fim. | Sem `👉`, `Sugestão do Jota`, `amanhã`, `ligar para`, `comece`, `prioridade`, `foco`, `o que fazer`, `próximo passo`, `visite`, `cobrar`, `atenção`. |
| R13 | SEM_DADO_ATENDIVEL | bloqueia | "Sem a produtividade do mês na base", "não está na base", "não achei", "não tenho acesso", "estou em treinamento" para pergunta que o JOTA atende (venda, faturado, meta, positivação, cliente, pedido, rota, visita, curva, recorrência, equipe, hoje, mês, corte, loja). | regex das frases de "sem dado" + pergunta com assunto atendível (e não é contestação). |
| R14 | SEM_RESPOSTA | bloqueia | Ninguém respondeu. Inclui **pessoa sem cadastro**: precisa receber o caminho do cadastro, nunca silêncio. | Resposta vazia (`''`/`ok`). Na produção, mensagem "picada" (outra mensagem da mesma pessoa em menos de 3 min, respondida junto) não conta. |
| R15 | VAGO_NO_NOME | bloqueia | "Vago" em nome de equipe ou supervisor ("Equipe Vago Gabriel", "sup. 543 - Vago Gabriel", "1130 - Vago Tcg"). | `/\bvago\b/i` em `r`. |
| R16 | TEXTO_LONGO | alerta | Mais de 35 linhas com texto. | contagem de linhas não vazias > 35. |
| R17 | INDICADOR_VAZIO | bloqueia | Indicador exibido sem dado: "0 de 0", "(sem dado)", "ticket sem dado", "R$ 0 (sem dado)". Indicador sem dado não aparece. | `/0 de 0\b|\(sem dado\)|ticket sem dado|:\s*sem dado/i`. |
| R18 | PLURAL_ERRADO | bloqueia | "1 pedidos", "1 clientes", "1 vendedores"… | `1 <plural>` fora de item de menu ("1 Pedidos a faturar 2 …"), fração ("0 de 1 vendedores") e início de linha. |
| R19 | SUGESTAO_CONTRADIZ | bloqueia | Sugestão que contradiz o dado da própria resposta: "foco nos zerados" com 0 zerados; "comece pelos ⚠️" sem nenhum ⚠️ na lista. | `foco nos zerados|comece pelos zerados|cobrar os zerados` + `zerados: 0`; `comece pelos ⚠️` sem linha `• ⚠️`. |
| R20 | EQUIPE_SEM_VENDEDOR | bloqueia | Fechamento/dia da equipe para supervisor ou gerente sem a lista **por vendedor** de quem ficou sem pedido ou sem visita. | Papel supervisor/gerente, pergunta do DIA com `fechamento`, `meu time`, `minha equipe` ou `equipe`, e nenhuma linha de item com `código - Nome` do vendedor. |
| R21 | ONTEM_DOMINGO | bloqueia | "Ontem (15/11)" numa segunda-feira: domingo não é o dia anterior de trabalho. | data de `Ontem (DD/MM)` cai num domingo. |
| R22 | FATURADO_NEGATIVO | alerta | "Faturado: R$ -32.139" sem explicar que é devolução. | `R$ -N` sem `devolu` na resposta. |
| R23 | IA_GENERICA | alerta | Texto genérico de modelo: "Infelizmente…", "DOSSIÊ 360°", "Peço desculpas", "não tenho acesso". | regex. |
| R24 | EXPECTATIVA_DO_CASO | bloqueia | Só nos **casos-chave do diretor**: a resposta não cumpre o "deve / não deve" definido para aquela pergunta (ex.: "Karina já vendeu hoje" tem que abrir pela Karina e não listar a equipe). | `expectativas` no contexto: `deve`/`naoDeve` (regex, opcionalmente só nas N primeiras linhas), `minClientes`, `minVendedores`, `so(ctx)` (condição, ex.: depois das 17h). |

## Casos-chave do diretor (bateria `testes/jota_regressao.mjs`)

| # | Quem | Pergunta | O que tem de acontecer |
|---|---|---|---|
| K01 | Vitório (diretoria) | Venda Tamara TCV hoje | Abrir pela Tamara e pelo DIA (vendeu hoje), não pela ficha do mês. |
| K02 | Vitório | Quanto a Tamara de TCV vendeu hoje | Idem. |
| K03 | Vitório | Curva Negativa vendedora Tamara TCV | Curva negativa com a lista de clientes sem compra no mês (≥ 3); nunca "sem a produtividade"; uma conta só. |
| K04 | Vitório | Curva negativa Vendedora 10 de TSJ | Lista de clientes sem compra no mês, não a ficha do vendedor. |
| K05 | Renan Lechuk (vendedor TPH 128) | Quais clientes posso positivar na recorrência ainda? | Lista de clientes da recorrência ainda não positivados; nunca "nenhum cliente com a tag Recorrência" sem olhar a lista. |
| K06 | Alex Elias (supervisor TBE) | Atualiza os números de hoje do meu time | Dia da equipe aberto por vendedor. |
| K07 | Jonathan Fernandes (supervisor TPH) | status do pedido 1038000485 | O pedido 1038000485, não a lista de pendentes. |
| K08 | Sueli Polli (supervisora API) | Karina já vendeu hoje | Abrir pela Karina, sem listar a equipe inteira. |
| K09 | Luis Thiago Boeira (supervisor TBE, 101) | Fechamento | Depois das 17h = fechamento do DIA (nunca "Fechamento de Outubro"), com quem ficou sem pedido/visita por vendedor. |
| K10 | Luis Thiago Boeira | Fechamento do dia DD/MM/AAAA | Sem "0 de 0 (sem dado)", sem "1 pedidos", sem "foco nos zerados" com 0 zerados, com a lista por vendedor. |

## Limites conhecidos

- Heurística de texto: pega o que é verificável pela forma (assunto, período, contradição, zero sem leitura). Não confere se o número está certo — isso continua com a conferência Clube × CEVEN e a auditoria lance a lance.
- R03 aceita qualquer zero que venha com leitura do dia recente; um zero falso com leitura recente passa.
- R09 depende da lista de padrões de contestação; recado com palavras novas escapa. Acrescentar padrões a partir das auditorias.
- Na regressão, o JOTA roda sem chave de IA: perguntas que em produção iriam para a IA aparecem com a resposta pronta ou "em treinamento".
