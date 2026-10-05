# Auditoria do GPS de check-out (05/10/2026, 09h30)

Pedido do Vitório: "pessoal está reclamando que tem um monte de lance de impedimento com check-out longe do ponto de venda… pode ser inconsistência no palm; faça um pente fino".

## O que foi medido (hoje, 219 visitas com coordenada do cliente e do check-out, vendedores mostrados)
- **49% (107)** dos check-outs ficam a **mais de 20 km** do cliente (mediana 537 km), e **55 deles são exatamente o mesmo ponto** (-23,25 / -45,92) em 8 filiais diferentes: é um ponto-padrão (provavelmente localização por IP/operadora quando o palm não capta o GPS). Outros pontos-padrão: (-24,97 / -53,47) e (-22,89 / -47,05).
- **46% (101)** estão a até 100 m do cliente: o GPS funciona quando capta.
- Só **8** (3,7%) caíam na regra antiga (500 m a 20 km), **todos de TSJ**: 2 de Fernanda (o MESMO ponto de check-out para dois clientes diferentes, a 7,7 e 8,4 km: GPS parado), 2 de Waldemar (check-outs a 40 m um do outro, 600 m dos clientes e igual ao de outro vendedor: cadastro dos clientes 600 m errado) e 4 de André, Mônica e Érica (14 a 20 km depois de visitas de 8 a 25 min: posição aproximada).
- **Volume na liga (impedimentos de GPS):** 28/09 = 1.213 · 29/09 = 664 · 30/09 = 231 · 01/10 = 361 · 02/10 = 271 · 03/10 = 92 · 05/10 = 8 (até 09h30). Cada um vale **−5 pontos**. São **2.750 lances = 22%** de todos os lances auditados da temporada.

## Check-outs fora do padrão por filial
| Filial | Visitas | Check-out a mais de 20 km | Até 100 m |
|---|---|---|---|
| TBE | 30 | 29 (97%) | 1 |
| API | 26 | 16 (62%) | 10 |
| TBL | 32 | 19 (59%) | 13 |
| TSJ | 33 | 16 (48%) | 9 |
| TPA | 16 | 7 (44%) | 7 |
| ABC | 16 | 6 (38%) | 10 |
| TCV | 17 | 6 (35%) | 11 |
| TPH | 34 | 8 (24%) | 26 |
| MCD | 7 | 0 (0%) | 7 |
| TCG | 4 | 0 (0%) | 3 |
| TCA | 4 | 0 (0%) | 4 |

## Vendedores com mais check-outs com ponto-padrão (revisar o palm e a permissão de GPS)
| Vendedor | Filial | RCA | Visitas | Check-out a mais de 20 km |
|---|---|---|---|---|
| ROGER JESUS DA SILVA | TBE | 291 | 8 | 8 |
| PAOLA DE PAULA FRANCO | API | 529 | 5 | 5 |
| ANDRE LUIS SPOHR | TBE | 288 | 4 | 4 |
| HELIO LEMOS DA SILVA | TBE | 300 | 4 | 4 |
| RAFAEL DOS SANTOS CABRAL | TBL | 194 | 4 | 4 |
| EMILLEI CARNEIRO | TPH | 118 | 4 | 4 |
| NAJILA DE OLIVEIRA GOMES | TSJ | 8 | 4 | 4 |
| KAUE DOS SANTOS | ABC | 534 | 3 | 3 |
| MARIA MADALENA | API | 527 | 3 | 3 |
| GUILHERME KOWALSKI RAMOS | TBE | 307 | 3 | 3 |
| REGINALDO ROSA DA SILVA | TBL | 196 | 3 | 3 |
| EWERSON CANDIDO DE OLIVEIRA | TBL | 178 | 3 | 3 |
| JOSE GERALDO CARNEIRO | TBL | 187 | 3 | 3 |
| LUIS FELIPE PEREIRA | TCV | 349 | 3 | 3 |
| ORLI CLOVIS OLIVEIRA COSTA | TPA | 154 | 3 | 3 |

## O que foi mudado no sistema
Impedimento por GPS só vira lance quando o dado é confiável: **entre 500 m e 5 km** do cliente **e** com o ponto de check-out **não repetido** (±100 m) em outra visita do mesmo vendedor. Aplicado igual no coletor de lances, na TV da filial e na Matriz. Efeito nas visitas de hoje: **8 → 0**.

## Pendente de decisão do Vitório
Os 2.750 impedimentos de GPS dos dias 28/09 a 03/10 continuam valendo −5 cada na liga. Simulação sem eles: 79 vendedores sobem de pontos; Danilo (TCG) passa de 5º para 2º (5 → 7 pts), Saldanha e Radke/Leandro ganham 1 ponto cada; 62 de 67 supervisores mudam de posição (efeito do saldo de gols).

## Causa na origem (para a TI e o CEVEN)
A regra de negócio diz que o check-out longe do cliente nem deveria ser permitido, mas o CEVEN aceita check-out com ponto-padrão. Revisar: a permissão de localização/GPS do app nos palms (TBE: 29 de 30 visitas com ponto-padrão), a trava de distância no check-out e as coordenadas de cadastro dos clientes que aparecem de 500 m a 2 km fora.

## Hipóteses testadas depois (05/10/2026, a pedido do Vitório: "será que o B.O. não é a leitura / quantidade de caracteres?")
- **A leitura corta ou arredonda a coordenada? NÃO.** O CEVEN entrega `checkout_latitude` / `checkout_longitude` como número com 7 casas decimais, e o que a TV lê é idêntico à resposta crua (conferido no RCA 291 de TBE). O Clube da Venda e a TV leem o mesmo dado: o problema está **no que o app envia ao CEVEN**, antes de qualquer leitura.
- **Exemplo cru (RCA 291, TBE):** clientes cadastrados em torno de (-31,29 / -51,09); os 8 check-outs de 08:03 a 08:52 estão todos em (-23,2493 / -45,9245), variando só na 4ª a 5ª casa decimal (poucos metros): um aparelho parado a ~1.000 km dos clientes, com "ruído" de GPS. Não é ponto fixo de IP (que não teria ruído) nem erro de formato.
- **Será check-in/out feito remotamente, em lote? NÃO é o padrão geral.** Tempo de visita: GPS bom (≤500 m): mediana 11 min, 16% das visitas com até 2 min; ponto-padrão (>20 km): mediana 11 min, 13% até 2 min. As visitas com ponto-padrão duram como as outras. Casos isolados de visitas de 1 minuto em sequência (ex.: Roger, 4 clientes entre 08:03 e 08:08) existem nos dois grupos e são outro assunto (visita curta), não explicam o GPS.
- **Padrão por filial:** TBE 97% dos check-outs com ponto-padrão, API 62%, TBL 59%, TSJ 48%, TPA 44%, ABC 38%, TCV 35%, TPH 24%, MCD/TCG/TCA 0%. Um fator comum de filial (modelo de aparelho, chip/operadora, versão do app ou permissão de localização) é o primeiro suspeito.
- **Próximos passos:** (1) teste de campo: 2 ou 3 vendedores de TBE/API e 1 de MCD fazem check-in e check-out em frente ao cliente com a localização em "alta precisão" e comparamos os pontos; (2) perguntar ao desenvolvedor do CEVEN como o app obtém a posição do check-out (GPS, rede ou cache) e pedir que grave coordenada do check-in, precisão e origem; (3) levantar aparelho, operadora e versão do app dos vendedores de TBE.
