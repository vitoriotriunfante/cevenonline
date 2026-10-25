# JOTA × todos os indicadores do projeto (25/10/2026)

Legenda: ✅ o Jota responde · 🟡 o dado existe no nosso site, falta ensinar · 🔴 não temos o dado (precisa de leitura nova do CEVEN) · ⚫ endpoint existe mas está vazio/quebrado

| # | Indicador | Onde aparece hoje | Fonte | Jota |
|---|---|---|---|---|
| 1 | Faturado líquido, meta, % da meta | TV, Matriz, Executiva, WhatsApp | /api/saude, central-snapshot | ✅ Brasil, filial, gerente, supervisor, vendedor |
| 2 | Pendente | TV, Executiva | idem | ✅ (sempre separado do faturado) |
| 3 | Falta e MN (por dia útil) | Matinal CEVEN, cockpit | cálculo | ✅ |
| 4 | Positivação do mês | TV, Executiva, Incentivo | saude, snapshot | ✅ |
| 5 | Digitado hoje, pedidos, ticket médio | TV, Executiva "Pedidos colocados" | snapshot | ✅ (todos os canais; "rota" = varejo) |
| 6 | Visitas na rota, eficácia, eficiência | TV, Matriz, Executiva | produtividade.dia / mes | ✅ (só varejo) |
| 7 | Zerados, sem nenhuma visita | TV (alertas), Matriz, WhatsApp 14:30/17:00 | snapshot | ✅ |
| 8 | Clientes da rota: visitados, sem venda, justificativa, check-in/out, tempo, fora da rota, faltam visitar | TV popup, Matriz | snapshot.roteiro | ✅ (cliente a cliente) |
| 9 | Meta batida no mês (fat.+pend.) | TV | snapshot | ✅ |
| 10 | Ranking (meta, positivação, hoje) | TV, Matriz | snapshot | ✅ |
| 11 | Devoluções do mês (R$, vendedor, filial) | TV, Executiva | snapshot | ✅ |
| 12 | Devoluções por motivo | /api/devolucoes-motivos | idem | ✅ (Brasil; por filial = nº de notas) |
| 13 | Recorrência na rota e positivados | TV Executiva ⭐ | mapa-executivo-live | ✅ |
| 14 | Resgates (parados >30 dias que compraram) | TV Executiva | mapa-executivo-live | ✅ |
| 15 | Lances da Liga (gol, defesa, pênalti, impedimento GPS/00:00, cartões, gol contra, hat-trick) com motivo | TV, Matriz, Lances do Dia | brasileirao-lances | ✅ |
| 16 | Champions: filial, supervisores, vendedor, posição, ▲▼, forma, pontos | /championstriunfante | dados_brasileirao.json | ✅ |
| 17 | Liga AS (fases, bônus, pontos) | /liga-as | /api/liga-as | ✅ |
| 18 | Bola Cheia do dia | TV | /api/bola-cheia | ✅ (congela 18h) |
| 19 | Semana Invicta, Campeão da Rodada | TV, Matriz | brasileirao-lances | ✅ via lances |
| 20 | Compromisso matinal e RET de hoje | Supervisores, TV | tv-supervisores | ✅ Brasil e filial |
| 21 | Compromisso e RET da semana | /supervisores | tv-supervisores-semana | ✅ |
| 22 | Incentivo Outubro (G1, G2, supervisor, gerência, prêmio se fechasse hoje) | /incentivo | /api/incentivo-outubro | ✅ (oficial) |
| 23 | +MIX: uso real, mix por cliente, quem compra produto | /mix | dados_mix.json | ✅ |
| 24 | +MIX: o que oferecer ao cliente X, clientes que compravam e pararam | /mix | mix_rec, mix_hist | 🟡 |
| 25 | Divergências com o CEVEN | /gestao-equipe, /divergencias | /api/divergencias | ✅ (diretoria) |
| 26 | Saúde da coleta (idade do dado) | /saude | /api/saude | 🟡 |
| 27 | Marca Própria (ciclo 10:00) | WhatsApp | motor do WhatsApp (Projeto B) | 🔴 não está no site |
| 28 | PDV em risco (07:45: última chance / alerta) | WhatsApp | motor do WhatsApp | 🔴 não está no site |
| 29 | Cortes, bloqueados, retidos | cockpit-matinal, inteligencia-gerencial | /api/inteligencia-gerencial | ⚫ endpoint vazio |
| 30 | Premiação RV do CEVEN (por KPI e peso) | CEVEN Premiação | CEVEN | 🔴 |
| 31 | Vespertina (Plan × Real × Gap) | CEVEN | CEVEN | 🔴 |
| 32 | Planos de Ação (PA), score da RET | CEVEN | CEVEN | 🔴 |
| 33 | Cadastros LinkUp (status, com quem está, bônus R$ 30) | CEVEN | CEVEN | 🔴 |
| 34 | D-1 e M-1 (ontem, mês passado) | Matinal CEVEN | histórico | 🔴 |
| 35 | Prospects por CNAE | Mapa CEVEN | prospecção (Data Lake) | 🔴 |
| 36 | Scanntech (sell-out, share) | apresentação | planilha | 🔴 |

## Conversa
- Diretoria sem filial = Brasil; gerente = só a filial dele (TPH/MCD só o grupo).
- Entende "ela/ele/dele" pela pergunta anterior (até 6 h).
- Pergunta fora da base vai para a IA gratuita, que é proibida de inventar.

## Proativo (a decidir com o Vitório)
Proposta: o Jota manda sozinho, para cada gerente, **só o que exige ação**, sem repetir os ciclos do WhatsApp (07:45, 10:00, 11:30, 14:30, 17:00, 18:30):
- 09:30: supervisores sem compromisso; vendedores com rota e nenhuma visita.
- 12:30: clientes com "pedido a digitar" ainda não digitados; recorrência não positivada.
- 16:00: quem está a ≤5 clientes do 110% do incentivo; impedimentos e pênaltis do dia.
- Gatilho imediato: vendedor com 3 impedimentos no dia; cliente que pediu e devolveu ("cliente não pediu").
