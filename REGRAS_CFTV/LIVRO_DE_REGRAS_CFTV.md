# Livro de Regras — CFTV (lances da TV)

> Fonte de verdade dos lances (gols, cartões, pênaltis, impedimentos, defesas) mostrados nas TVs
> de filial (`tvapp.html`) e matriz (`matrizapp.html`). Atualizar sempre que um lance mudar de
> critério. Ver também `docs/CFTV_MATRIX_VISAO_E_ESTADO_ATUAL.md` (arquitetura geral do projeto).

## Status de implementação (27/09/2026)

Todos os lances abaixo estão implementados em `public/tvapp.html` e `public/matrizapp.html`
(função `calcAlertas`), com cálculo idêntico nos dois arquivos. **Regra inviolável: nunca inventa
dado** — quando o CEVEN não expõe o dado exato (ex.: horário do pedido), a TV usa uma aproximação
e **sempre avisa isso no texto** (sufixo "· aprox."), nunca finge precisão que não existe.

| Cód | Lance | Critério | Fonte do dado |
|---|---|---|---|
| G01 | Gol Relâmpago | 1º pedido do dia detectado antes das 9h (10h TCG/MCD/TCA) | **Aproximado**: horário em que a TV percebeu `dig_hoje` subir (ciclo ~90s) |
| G02 | Gol de Placa (Super Pedido) | `dig_hoje` ≥ R$ 15.000 | Exato — `/api/tv-vendedor` |
| G03 | Dobrou o Mix | SKUs do pedido ≥ 2× a média histórica do cliente (ou ≥10 se histórico ≤5) | Exato — `/api/rca/historico-cliente/{id}`, calculado ao vivo |
| G04 | Dobradinha das Quinzenas | Cliente comprou na 1ª E na 2ª quinzena do mês | Exato — mesmo endpoint, mesma lógica do slide executivo |
| G05 | Máquina de Conversão | ≥8 visitas feitas e taxa de conversão ≥50% | Exato |
| G06 | Hat-Trick | 3+ pedidos detectados em até 120min | **Aproximado** (mesma base do G01, erro acumulado maior) |
| G07 | Drible da Vaca | Cliente inativo há >90 dias, recuperado com venda hoje | Exato |
| G08 | Defesa Milagrosa | Cliente recorrente, positivado no dia da rota | Exato (ver D01, mesmo evento, nível diferente) |
| G09 | Goleada | ≥10 clientes positivados no dia | Exato |
| G10 | Gol nos Acréscimos | Pedido detectado depois das 17h (18h TCG/MCD/TCA) | **Aproximado**, mesma base do G01 |
| G11 | Meta do 1º Tempo | Bateu a meta diária pro-rata (dias úteis) antes das 14h | **Aproximado** |
| G12 | Campeão da Rodada | 100% da meta mensal batida | Exato |
| V01 | Cartão Vermelho — Devolução | Devolução "cliente não pediu" no dia | Exato |
| V02 | Cartão Vermelho — Abandono | 10h (11h fuso) e zero visitas feitas, com rota | Exato |
| V03 | Bonificação Disfarçada | Pedido com 2+ itens e soma de valor = R$0 | Exato — calculado ao vivo, mesmo padrão do datalake |
| A01 | Cartão Amarelo | 10h (11h fuso) e rota ativa sem nenhuma venda | Exato |
| P01 | Pênalti — Estoque Suficiente | Justificativa "ESTOQUE SUFICIENTE" e >30 dias sem compra | Exato |
| P02 | Pênalti — Cliente Fechado | Justificativa "FECHADO"/"ENCERROU" e >45 dias sem compra | Exato |
| I01 | Impedimento — Visita Relâmpago | Tempo de visita = 00:00 | Exato |
| I02 | Impedimento — GPS Fora | Check-out a mais de 500m do cadastro do cliente | Exato (Haversine) |
| D01 | Defesa | Mesmo evento do G08, nível "defesa" na fila de exibição | Exato |

## Hat-Trick — definição única (Vitório, 27/09/2026)

**Só existe um Hat-Trick: o diário (G06) — 3 pedidos em sequência (até 120min de janela).** Não
existe conceito de "Hat-Trick semanal" ou "3 dias consecutivos" como lance de produto. Qualquer
menção a isso em documentação antiga está incorreta e deve ser removida.

A animação de Hat-Trick (`iniciaAnimHatTrick` em `tv-animacoes.js`) mostra o vendedor e os 3
valores reais dos incrementos de `dig_hoje` detectados na janela — nunca nome de cliente
inventado (não temos esse dado por pedido individual, só o total do dia). Quando não há nome
real disponível, mostra "PEDIDO 1/2/3".

"Semana Invicta" (animação vetorial já pronta, `iniciaAnimSemanaInvicta`) **ainda não é um lance
real** — só existe como demo no menu de teste (`/testar`). Critério de disparo pendente de
definição com o Vitório (discutido em 27/09: ideia inicial de ≥80% dos vendedores com rota
positivando em todo dia útil da semana, mas não fechado ainda).

## Dinâmica VAR (Vitório, 27/09/2026)

Todo lance com vídeo real segue a sequência: **LANCE (vídeo) → VAR REVISANDO (pausa dramática,
~2.5s) → REPLAY (o mesmo vídeo, mais curto) → DECISÃO (texto com nome/motivo/valor, fica 45s na
tela)**. Objetivo: dar tempo de alguém ver o que aconteceu (bom ou ruim) e agir — comemorar ou
cobrar o vendedor.

Lances sem vídeo real (hoje: tudo exceto "gol") caem direto na animação vetorial dedicada,
seguida da tela de decisão.

## Vídeos reais (Gemini)

Hoje só "gol" tem vídeos prontos: `gol_1.mp4` (super pedido), `gol_2.mp4` (cliente recuperado),
`gol_3.mp4`, `gol_4.mp4` (variações gerais, sorteadas). Publicados em `/animacoes/videos/` no
Cloudflare (não versionados no git — arquivo binário).

Pendente: gerar os 15 vídeos dos outros 5 lances (Vermelho, Amarelo, Impedimento, Pênalti,
Defesa — 3 variações cada). Prompts em `REGRAS_CFTV/PROMPTS_VIDEOS_ANIMACOES_TV.md` (a recriar —
ver pendências). Gerar em conversas SEPARADAS no Gemini para evitar repetição de cena.

## Ferramentas de teste

- `/testar` — bancada isolada com todos os botões de animação (gol, cartões, impedimento,
  pênalti, defesa, hat-trick, semana invicta), sem precisar abrir uma filial real.
- `/debugvideo` — toca os vídeos reais e mostra um log de eventos do `<video>` (loadstart,
  stalled, ended, error) na tela, para diagnosticar travamento em Smart TV real sem acesso ao
  console do navegador.
