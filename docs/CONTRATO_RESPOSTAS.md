# CONTRATO DE RESPOSTAS DO JOTA (e das telas) — entrega 3 · 22/11/2026

> **O que é:** para cada assunto que o time realmente pergunta (catálogo de 4.299 perguntas reais em `docs/CATALOGO_PERGUNTAS_REAIS.md`), por papel: a resposta padrão, os KPIs que ela usa (fichas do `docs/DICIONARIO_KPIS.md`), o rodapé obrigatório e o que é proibido.
> **Regra de mudança:** muda primeiro este contrato ou o dicionário (com a decisão do Vitório registrada no Histórico), depois o código. Código que foge do contrato é erro, mesmo que "pareça melhor".
> **Régua:** o gabarito (seção 5) roda antes de toda publicação. Não passou, não publica.

---

## 1. Regras que valem para TODA resposta (herdadas do dicionário §0)

1. **Um número, uma fonte.** Cada KPI vem da fonte oficial da ficha. Mês = GEROT · dia = Clube da Venda · supervisor em campo (compromisso, RET) e TAGs, devolução por nota, GPS = CEVEN admin/gerentes · equipe = Gestão de Equipe.
2. **Total e linhas fecham.** Total e linhas da mesma tabela e da mesma carga. Sobra = linha "fora das equipes".
3. **R$ soma; cliente não soma.** Positivação, recorrência, mix e % se leem no próprio nível; grupo/equipe sem número pronto = clientes distintos com faturado > 0 (dicionário §0 regra 4).
4. **Sem dado ≠ zero.** "sem leitura do <fonte> hoje · última <hora>".
5. **Rodapé com fonte e hora** de cada número: `GEROT · 10:34` · `Clube · 14:48` · `CEVEN admin · 08:15`.
6. **Escopo do papel:** vendedor vê só ele; supervisor só a equipe da Gestão de Equipe; gerente a filial (ou o grupo, em MCD e TPH); diretoria tudo. Pergunta sobre alguém fora do escopo: dizer que não é do escopo, sem número e sem dizer a quem pertence.
7. **Vendedor e supervisor = menu.** Qualquer jeito de perguntar cai num item do menu (lista na seção 3 e 4). Gerente e diretoria podem perguntar livre; o que não tem resposta pronta vai para a IA com as mesmas fontes.
8. **Domingo/feriado:** pergunta do DIA responde "sem rota hoje" e oferece o último dia útil; pergunta do MÊS responde normal.
9. **Sempre R$ e quantidade** quando o assunto é pedido, carteira, bloqueio, devolução.
10. **Um "por dia útil" só:** necessidade por dia = GEROT "Necessidade dia captação" (dicionário 3.8); ritmo = GEROT "% Meta Ideal captação" (3.7). Nenhuma outra conta com esse nome.

---

## 2. Rodapés padrão

| Origem | Rodapé |
|---|---|
| Mês (GEROT) | `_GEROT · posição DD/MM HH:MM_` |
| Dia (Clube) | `_🟢 Clube da Venda · HH:MM (pedidos colocados)_` |
| Carteira/bloqueio | `_Carteira Total do GEROT · HH:MM (valor conferido contra a tela)_` |
| Compromisso/RET/TAG/devolução/GPS | `_CEVEN admin · HH:MM_` |
| Liga | `_Liga: lances com prova · fechado até DD/MM_` |

---

## 3. VENDEDOR (1.254 perguntas reais) — menu de 16 itens

| Assunto (freq.) | Item do menu | Resposta padrão | KPIs (dicionário) | Proibido |
|---|---|---|---|---|
| Como estou / meta / quanto falta (12,9%) | 1 | faturado + carteira de meta (% Fat+Cart do GEROT), necessidade/dia do GEROT, positivação do nível, devolução, posição na Liga | 3.1, 3.4–3.6, 3.8, 3.9–3.10, 3.3 | 2 valores "por dia"; meta da hierarquia antiga |
| Liga / Champions (8,1%) | 2 | posição Brasil/filial, pontos, V/E/D, lances do dia com prova; "regras" = regulamento | 3.25 | pontuar sem prova |
| Premiação / RV (1,6%) | 3 | metas da premiação e como está; RV em R$ = "ainda não temos" | 3.4, 3.22 | inventar R$ de RV |
| Pedidos / bloqueados / travados (2,2%) | 4 | carteira do vendedor: bloqueado fin./com., pendente, montado, liberado (R$ e qtd), 10 mais antigos com dias | 3.11 | valor do Clube como R$ de bloqueio |
| Sem compra / curva negativa (3,3%) | 5 | clientes sem compra no mês (comprou mês passado?, última compra) | 3.19 | — |
| O que oferecer / +MIX (1,2%) | 6 | +MIX da rota de hoje (recompra 60 dias) | regra recompra | — |
| Mês passado / fechamento (3,5%) | 7 | fechamento do mês pedido (agosto em diante), indústrias do mês se houver | 3.26 | responder outro mês |
| Recorrência (2,9%) | 8 | objetivo, meta 80%, positivados (pasta do mês, no nível); mês fechado = "não gravado" | 3.18 | somar pasta velha |
| Rota (2,4%) | 9 | rota de hoje (Clube): clientes, check-in, pedido, justificativa | 3.15–3.16 | rota inventada |
| Prospecção (0,3%) | 10 | prospects perto da rota | — | — |
| Devoluções (1,1%) | 11 | devolução do mês por motivo (GEROT) + notas com motivo oficial | 3.3 | — |
| Ficha de cliente (0,8%) | 12 | histórico do cliente (GEROT + Clube), o que oferecer | 3.19 | "não achei" com compra no GEROT |
| Indústrias (1,7%) | 13 | metas por indústria; "positivação/meta de <indústria>" = essa indústria; fora do portfólio = dizer | 3.22 | cair no cartão geral |
| Carteira de clientes | 14 | quantos clientes, ativos, positivados | 3.9 | — |
| Campanhas / TAGs | 15 | TAGs do mês (admin), quem falta | 3.23 | — |
| Cortes | 16 | cortes do mês (GEROT) | 3.21 | — |
| Hoje / ontem / sábado (3,0%) | 1 (dia) | pedidos colocados do dia pedido (Clube), com a data | 3.13–3.14 | responder o mês |
| Vários assuntos na mesma mensagem | 1+N | cada item do menu citado, em sequência | — | responder só um |
| Saudação / número solto (20,7%) | menu / momento do dia | — | — | — |

## 4. SUPERVISOR (2.025) — menu de 15 itens, escopo = equipe da Gestão de Equipe

| Assunto (freq.) | Resposta padrão | KPIs | Proibido |
|---|---|---|---|
| Equipe no mês / meta (20,1%) | total da equipe = soma da equipe (R$) + linhas por vendedor que fecham; positivação da equipe pela regra 4 | 3.1, 3.4, 3.9 | total de uma fonte e linhas de outra |
| Sem compra / quem falta positivar (11,7%) | por vendedor, com exemplos | 3.19 | — |
| Hoje / ontem / sábado (7,3%) | por vendedor: pedidos e R$ do dia (Clube), visitas; domingo = último dia útil | 3.13–3.15 | o mês no lugar do dia |
| Matinal (6,0%) | card da equipe | ficha matinal | — |
| Liga (4,6%) | posição da equipe e de cada vendedor | 3.25 | — |
| Recorrência (4,2%) | pasta da equipe, no nível | 3.18 | somar vendedores |
| Bloqueados / carteira (3,2%) | R$ e qtd, por vendedor e motivo, 10 mais antigos | 3.11 | — |
| Compromisso / RET | do admin; domingo = aviso | 3.24 | — |
| Um vendedor | ficha do vendedor (igual ao que ele vê); fora da equipe = "não é da sua equipe" | — | trocar pela própria equipe calado |

## 5. GERENTE (195) e DIRETORIA (825) — livre, escopo filial/grupo e Brasil

| Assunto | Gerente | Diretoria | KPIs | Proibido |
|---|---|---|---|---|
| Hoje / venda do dia | por supervisor e vendedor (Clube) | por filial (Clube) | 3.13 | "digitado da macro" com rótulo Clube |
| Mês / meta / ritmo | total da filial (GEROT da filial), linhas por supervisor que fecham (+"fora das equipes") | total Brasil + linhas por filial do GEROT da filial | 3.1–3.8 | cabeçalho oficial e linhas pela soma |
| Positivação | GEROT da filial; supervisor/grupo pela regra 4 | GEROT por filial | 3.9–3.10 | somar vendedores |
| Bloqueados / carteira | total, motivos, supervisores, vendedores (R$ e qtd) | total e POR FILIAL; "carteira TPH" abre a filial | 3.11 | abrir por motivo na diretoria |
| Indústrias | filial × indústria | Brasil/filial × indústria | 3.22 | — |
| Margem | filial ou grupo (só os vendedores do grupo) | por filial | 3.20 | margem da filial no grupo |
| Ranking | % e R$ da mesma base | idem | 3.5 | % de fat+cart com R$ só do faturado |
| Liga | filiais, gerentes, supervisores, vendedores | idem | 3.25 | — |
| Devolução por motivo | filial → supervisor → vendedor | Brasil por filial | 3.3 | — |

---

## 6. Gabarito (a régua que substitui a antiga)

- **Origem das perguntas:** as mais frequentes do catálogo por papel e assunto (mínimo 5 por linha das tabelas 3–5), com a forma como o time escreve (erros de digitação, áudio transcrito).
- **O que se confere em cada resposta:** (a) caiu no assunto/menu certo; (b) cada número bate com a fonte oficial da ficha (consulta no D1 no mesmo minuto); (c) total = soma das linhas; (d) rodapé com fonte e hora; (e) escopo respeitado.
- **Nota mínima para publicar:** 100% em (b), (c) e (e); 95% em (a) e (d). Uma falha em número ou escopo barra a publicação.
- **Arquivo:** `testes/gabarito.mjs` + `testes/gabarito_perguntas.json` (a criar).

---

## 7. Operação (entrega 4, resumo)

| Peça | Estado em 22/11 | Próximo passo |
|---|---|---|
| Camada única de leitura (`functions/_lib/fatos/`) | não existe; cada resposta lê do seu jeito | criar e migrar as respostas, começando pelos conflitos A do dicionário |
| Agendador | worker-cron (Cloudflare), 1 gatilho de 15 min; reserva parcial no GitHub | reserva do fechamento da Liga e da classificação no GitHub |
| Vigia das fontes + painel | no ar (`/fontes`), aviso no WhatsApp do Vitório | — |
| Auditoria diária | jota-auditoria 06h32 e 13h02 (régua antiga) | trocar pela régua do gabarito |
| Publicação | só do PC (`publicar_tv.js`) | segredo `CLOUDFLARE_API_TOKEN` no GitHub para publicar sem o PC |
| Clube no notebook | tarefa do Windows a cada 15 min | desligar a do PC depois de confirmar o worker na segunda |
| Segurança | senha dos gerentes do CEVEN em repositório público; token em texto no PC | Vitório troca a senha e revoga o token; código lê só de segredo |

## Histórico
- 22/11/2026 — criado a partir do inventário, do dicionário e do catálogo de perguntas reais (pedido do Vitório: "uma única fonte de dados consolidada... em todas o meu saldo tem que ser o mesmo").
