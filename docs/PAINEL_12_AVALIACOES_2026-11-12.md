# Painel multidisciplinar — 12 avaliações (12/11/2026)

> Pedido do Vitório: "submeta a avaliação de um gerente sênior, um analista, um arquiteto de dados, uma equipe multidisciplinar... pelo menos umas 10 avaliações". Doze especialistas independentes, mesmo contexto, só leitura. Decisões avaliadas:
> **D1** boletim com o CEVEN fora sai marcado (sem cobrança) × espera · **D2** "macro soma tudo" (total inclui código fora da equipe) · **D3** gols só de pedido nascem do pedido (Winthor), sempre · **D4** pedir à TI acesso direto aos pedidos no Winthor.

## Placar (nota 0–10; todos aprovaram, quase sempre com condição)
| Avaliador | D1 | D2 | D3 | D4 | Veredito |
|---|---|---|---|---|---|
| Gerente comercial sênior | 7 | 8 | 6 | 9 | parcial |
| Diretor comercial | 8 | 7 | 6 | 9 | parcial |
| Supervisor de campo | 8 | 7 | 6 | 9 | parcial |
| Analista de BI | 8 | 7 | 7 | 9 | parcial |
| Arquiteto de dados (2º) | 7 | 8 | 6 | 9 | parcial |
| Gamificação (Liga) | 8 | 7 | 7 | 9 | parcial |
| Governança de dados | 7 | 7 | 6 | 8 | parcial |
| SRE / integração ERP | 8 | 7 | 7 | 9 | parcial |
| RH / relações de trabalho | 9 | 8 | 7 | 8 | sim |
| Comunicação / UX WhatsApp | 7 | 8 | 8 | 9 | sim |
| Controladoria | 8 | 7 | 8 | 9 | parcial |
| Segurança / LGPD | 8 | 7 | 8 | 6 | parcial |
| **Média** | **7,8** | **7,3** | **6,8** | **8,6** | 2 sim · 10 parcial |

## Condições de consenso
**D1 — boletim marcado (aprovado por 12/12):**
- "PARCIAL — X de Y vendedores lidos às HH:MM" **na mesma linha do valor** (o print circula sem cabeçalho). Aviso no topo.
- Cobertura medida pela **hora da leitura**, não por linha existente. Abaixo de um corte (proposto **80%**; Governança pediu 95%, Arquiteto 100% por nível) não sai total: só "sem leitura completa (X/Y)".
- **Sem** ranking, lista de zerados/sem visita, % da meta, ritmo ou comparação com ontem em cima de parcial.
- **Na volta do CEVEN:** mensagem "✅ CEVEN voltou às HH:MM, números refeitos" + errata do boletim; segurar zerados até a releitura completa.
- Teste automático que reprova número de reserva sem fonte/hora em qualquer resposta.

**D2 — macro soma tudo (12/12):**
- Linha fixa em **todos** os produtos: `Equipe R$ A + Fora da equipe R$ B (N pedidos) = Total` — a cascata fecha à vista.
- **% da meta só com a equipe** (meta desde out/2026 = soma dos vendedores; 5 avaliadores: senão o atingimento infla).
- Sem duplicar pelo número do pedido; fora da equipe só agregado (sem cliente/número); decidir os 71 códigos só no GEROT (R$ 1,63 mi de meta) e o grupo de TPH/MCD.

**D3 — gols de pedido (12/12 com condição; a mais fraca):**
- **Rodada Técnica** (Gamificação, RH, Governança, BI, Diretor): dia com CEVEN fora na janela dos cartões (gatilho objetivo escrito antes, ex.: < 80% com leitura até 11h) **não conta Vitória/Empate/Derrota, não quebra sequência**; gols de pedido só no saldo e desempate; ninguém leva cartão. Sem isso, a mudança piora a justiça (supervisor/filial/gerente perdem "a maioria" por falha da fonte).
- Vigência **futura** (vários: 01/12), comunicado escrito antes, versão visível; nunca retroativo.
- Só pedido de **origem do próprio vendedor**; um gol por número de pedido; consolidar mesmo cliente/dia; fora bonificação, SKU 12229, canais G/S; cancelado/cortado até 19h30 desfaz (depois: só auditoria).
- Meta do 1º tempo e Campeão dependem de meta/horário: fora (RH, Governança) ou com hora de emissão provada (Gamificação).
- **Não resolve esta queda sozinha:** o "Winthor" hoje vem pela API do CEVEN (SRE, Arquiteto).

**D4 — acesso direto ao Winthor (12/12; Segurança 6 só pela ordem):**
- **A TI empurra** (HTTPS POST para endpoint nosso) a partir de **réplica/view só leitura**; nunca abrir o Oracle/Winthor para a internet; token próprio + HMAC com hora (não reaproveitar a `EVO_KEY`); rodízio 90 dias.
- Incremental pela data de alteração, chave filial+número, cancelamento como status, **batimento cardíaco** mesmo sem pedido, frescor 5–15 min.
- Campos mínimos: número, filial, vendedor que digitou, cliente, data/hora, status, valor digitado e atendido, itens; sem CPF/telefone/endereço.
- Dicionário de status assinado pela TI; 5–10 dias de conciliação antes de virar fonte principal.
- **Antes:** perguntar à TI a causa da queda — GEROT (14:10) e CEVEN (17:34) caíram no mesmo dia; se a causa for o banco do Winthor, o acesso novo cai junto.

## O que o time não tinha considerado (agrupado)
1. **% da meta inflado** pela D2 (Diretor, Gerente, Governança, BI, Controladoria).
2. **Dicionário de métricas versionado** (digitado, positivado, pedido válido para gol, faturado) — pedido desmembrado, bonificação, troca, data de digitação × faturamento (BI, Governança, Controladoria).
3. **Alertas desligados desde 04/11** (`cron-varredura-central.js`: "alertas técnicos não vão pro WhatsApp") — ninguém foi avisado da queda; alarmes por canal fora do WhatsApp + monitor externo do worker (SRE).
4. **Falha de causa comum** entre CEVEN, GEROT e "Winthor" (SRE, Arquiteto, UX).
5. **Pedido digitado por televendas/escritório no código de outro** durante a queda: regra de reatribuição ao dono do cliente (Supervisor, RH, Gerente).
6. **Número da premiação = Winthor/GEROT congelado** (3º dia útil), nunca CEVEN ao vivo; competência e estorno (pedido 30/11 faturado 01/12, devolução de mês anterior) (Controladoria — discorda do §3.6 do plano).
7. **Pessoas:** representante PJ fora de cartão por horário (risco de vínculo); contestação formal em 48 h; TV/grupo só o positivo, negativo no privado; nada fora da jornada para CLT (RH).
8. **Segurança:** chave fixa do CEVEN em `functions/_lib/ceven_auth.js`, senhas em `scratch/` versionado, sessão do GEROT em `scratch/perfil_gerot/`; `EVO_KEY` com dupla função; só 14 de 71 endpoints com chave (`vendedor-detalhe` expõe CNPJ/endereço; `debug-ceven` gasta a cota); prints nos artefatos (Segurança).
9. `pedido_status.valor` congela a 1ª leitura (corte/cancelamento não entram) (Arquiteto).
