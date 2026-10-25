# JOTA proativo — plano (rascunho para aprovação do Vitório, 25/10/2026)

Pedido: "por enquanto gerente e supervisor... separe as coisas... organizar o que vai para cada um... o projeto do Jota se mistura com o do WhatsApp... não vamos mandar coisa diferente, dados e etc."
Pergunta-guia: **o que é informação que muda o jogo?** (problema, oportunidade, ranking — o que traz a galera para o time).

## 1. O que cada um JÁ recebe hoje (não repetir)
| Canal | Quem recebe | Quando | Conteúdo |
|---|---|---|---|
| WhatsApp (motor) | gerentes + Vitório | 07:45 | abertura + risco (PDV em risco por supervisor) |
| WhatsApp (motor) | gerentes + Vitório | 10:00 | Marca Própria |
| WhatsApp (motor) | gerentes + Vitório | 11:30 | gestão de campo (compromisso, RET, visitas) |
| WhatsApp (motor) | gerentes + Vitório | 14:30 · 17:00 | vendas, zerados, cortes, bloqueados, devoluções |
| WhatsApp (motor) | gerentes + Vitório | 18:30 | fechamento (digitado, pedidos, reativados, recorrência, ranking de filiais) |
| Sino do CEVEN | supervisor | de hora em hora (se ligado) | lances da equipe (gols, pênaltis, impedimentos) |
| TV / Matriz | todos | o dia inteiro | painel ao vivo |

➡️ **O gerente já recebe o placar 6 vezes por dia. O supervisor só recebe lances.** Ninguém recebe a *jogada* (qual cliente, qual produto, quanto dinheiro na mesa).

## 2. Regra de ouro: mesmos dados, mesmas regras
- O JOTA lê **a mesma base** que o motor do WhatsApp (varredura central, /api/pedidos-dia, lances, Gestão de Equipe). Regras iguais: macro soma todos os canais; visitas/zerados só varejo; faturado separado de pendente.
- **Trava de consistência:** antes de cada envio proativo, o JOTA confere o total de digitado/pedidos com o último relatório do WhatsApp do mesmo dia; diferença acima de 2% (fora o que entrou entre um horário e outro) = **não envia** e avisa o Vitório. Nunca dois números diferentes para o mesmo gerente.
- O proativo **não fala de nada que o ciclo do mesmo horário já falou**.

## 3. O que vai para cada um (separado)
### GERENTE — 1 mensagem por dia: "O jogo de hoje" (08:00), só com o que tem R$ na mesa
| Bloco | Exemplo de formato | Dado |
|---|---|---|
| 💰 Dinheiro na mesa ontem | "6 pedidos *magros* ontem: Mercado X costuma levar 10 itens / R$ 640, levou 5 / R$ 280. Faltou Oreo, Trident, Bis. Total na mesa R$ 1.900." | vendas item a item (média do cliente × pedido de ontem) |
| 🚨 Cliente grande escapando | "3 clientes curva A sem comprar há +20 dias; 2 estão na rota de hoje (Supermercado Y, R$ 4 mil/mês, Igor)." | histórico 60 d + rota de hoje |
| 🎯 Prêmio na mão | "5 vendedores a até 3 clientes do 110% (R$ 350 cada)." | incentivo |
| 🏆 Provocação | "API caiu de 3º para 4º na Champions; a TBL passou com 2 gols do Igor." | Liga |
| 🔒 Travado | "R$ 42 mil bloqueados desde ontem; maior: Atacadão Z (R$ 11 mil)." | pedidos do dia |
Máximo 8 linhas. Se não houver nada relevante, **não manda**.

### SUPERVISOR — mensagens de execução (o que fazer agora, com a equipe dele)
| Hora | O quê | Só se… |
|---|---|---|
| 07:30 | **Escalação**: por vendedor, os 3 clientes da rota que mais importam hoje (curva A parado, recorrência, maior oportunidade do +MIX) e o que oferecer | dia útil |
| 09:40 | "Faltam 20 min para o Compromisso do Dia" | ele não lançou |
| 11:00 | Quem da equipe ainda não visitou ninguém + o próximo cliente da rota | houver |
| 14:00 | "Pedido a digitar": visitados sem pedido digitado | houver |
| 18:00 | **Fecha o ciclo**: "dos 4 que estavam zerados às 11h, 3 venderam; falta o Fulano" | houve alerta no dia |
Lances **não** (o sino do CEVEN já manda). Máximo 3 mensagens por dia.

### VENDEDOR (depois, quando liberar) — o "pedido magro" na hora
"Você levou 5 itens no Mercado X; ele costuma levar 10. Na próxima, ofereça Oreo, Trident e Bis (+MIX)."

## 4. Ordem de implantação
1. Gerente — "O jogo de hoje" só para o Vitório por 2–3 dias (calibrar tom e conteúdo).
2. Supervisor — escalação 07:30 + fechamento 18:00 para 3–4 supervisores por 2 dias.
3. Abrir para todos os gerentes e supervisores.
4. Vendedor, quando os vendedores entrarem no JOTA.
