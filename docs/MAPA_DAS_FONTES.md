# MAPA DAS FONTES — Clube, CEVEN, Winthor e GEROT (12/11/2026)

> Pedido do Vitório (12/11/2026): "agora temos fonte do CLUBE, CEVEN e GEROT... precisa entender de onde pega cada dado e montar um plano para juntar tudo... ou vamos nos perder"; "clube é pedido colocado... não quer dizer que vai ser faturado"; "o CEVEN pega o pedido, depois vai para o Winthor e vira outro número... fora que o CEVEN pega pedidos vindos direto do Winthor e da loja Mondelez".
> Medido no D1 e nas telas do Clube em 12/11/2026. Este documento manda sobre a seção 3.6 de `PLANO_CADENCIA_DADOS.md`.

## 1. O caminho do pedido (quem faz o quê)
```
VENDEDOR (app do Clube da Venda / TradePro)
  rota · check-in/out · justificativa · pedido COLOCADO (nº do Clube)
        │  sincroniza (hoje parada: 1.701 pedidos de 12/11 "Sincronizado = Não")
        ▼
WINTHOR (ERP) ── pedido ganha OUTRO número (nº do Winthor) ── crédito/bloqueio · liberação · montagem · corte · FATURAMENTO · devolução
   ▲   também entram direto no Winthor: televendas/digitados no ERP, loja Mondelez (Vtex), bonificação
   │
   ├── CEVEN (só lê e mostra): lê o Clube (rota, visitas, status) e o Winthor (P. Winthor, painel: faturado, pendente, meta, positivação)
   └── GEROT (BI): lê o Winthor em cargas (~2 h): faturado, carteira, devolução, meta e positivação por indústria, recorrência
```
- **Clube = o que o vendedor fez** (visita e pedido colocado). Não sabe se faturou.
- **Winthor = o que virou venda** (aceito, bloqueado, cortado, faturado, devolvido). É a verdade do pedido e da nota.
- **CEVEN = vitrine dos dois** (cai junto se o servidor dele cai: 11/11 17:34 em diante).
- **GEROT = número oficial consolidado** (com atraso de carga).

## 2. Vocabulário único (toda tela usa estas palavras, sempre com a fonte)
| Palavra | O que é | Fonte | Não confundir com |
|---|---|---|---|
| **Pedido colocado** (digitado) | o vendedor fechou o pedido no Clube | Clube | venda faturada |
| **Integrado** | o pedido chegou ao Winthor (tem nº do Winthor) | Clube (coluna "Pedido Winthor"/"Sincronizado") · Winthor | — |
| **Não integrado** | colocado e ainda sem nº do Winthor | Clube (Painel de Pedidos, "Sincronizado = Não") | pedido perdido (pode integrar depois) |
| **Bloqueado / liberado / montado** | etapa no Winthor | Winthor (P. Winthor; Clube "Tipo Bloqueio") | — |
| **A faturar** (carteira, pendente) | integrado e ainda não faturado | CEVEN "pendente" · GEROT "carteira" · Winthor | pedido colocado |
| **Faturado** | nota emitida | Winthor → CEVEN (dia) e GEROT (oficial) | colocado / a faturar |
| **Cortado** | item que o Winthor tirou do pedido | Winthor (P. Winthor itens) · GEROT (cortes) | cancelado |
| **Cancelado / devolvido** | saiu da venda | Winthor · CEVEN (nota e motivo da devolução) · GEROT (valor) | — |
| **Bonificação** | pedido sem venda (operação BONIFICACAO) | Clube (Operação) · Winthor | **nunca soma como venda** |

## 3. Identidade do pedido (onde nos perdíamos)
- Mesmo pedido, **dois números**: Clube **7001628** → Winthor **7000743**; Clube 10201831 → Winthor 10002201; às vezes igual (20000514).
- `pedido_status` (D1) e o CEVEN usam o **nº do Winthor** (ex.: 5003207).
- **Vínculo:** Relatório de Pedido do Clube traz "Pedido" (Clube) e "Pedido Winthor" (preenchido quando integra).
- Pedido que só existe no Winthor (televendas, digitado no ERP, loja Mondelez/Vtex que não passou pelo Clube): só em `pedido_status`, sem nº do Clube.
- **Regra de soma sem dupla contagem (por vendedor, por dia):**
  `colocado do dia = pedidos do Clube (operação VENDA, nº do Clube)  +  pedidos do Winthor do dia SEM vínculo com nenhum pedido do Clube`
  — bonificação fora; pedido do Clube que integrou não soma de novo pelo Winthor (o vínculo resolve).
- Hoje (12/11) o `?soma=1` usa o **total do Clube por vendedor** + Winthor só para códigos que o Clube não tem: **perde** o pedido feito direto no Winthor no código de um vendedor que também tem Clube. Corrigir com a lista de pedidos do Clube (seção 6, passo 1).

## 4. Cada dado: fonte principal, reserva e onde aparece
| Dado | Principal | Reserva | Conferência | Jota · TV · Boletim · Liga |
|---|---|---|---|---|
| Rota do dia (clientes) | CEVEN roteiro | roteiro do mês gravado (📅 planejada) · Clube Roteiro Pedido (a testar) | — | Jota rota, TV, Liga |
| Check-in / check-out (hora) | **Clube** (Checkin Checkout, rede inteira, 15 min) | CEVEN roteiro | Clube × CEVEN (cliente a cliente) | Jota rota; **Liga só depois da conferência** |
| Justificativa (motivo, dias sem comprar) | **Clube** | CEVEN | Clube × CEVEN | Liga pênaltis (depois da conferência) |
| Visitas e roteiros por vendedor | **Clube** (Relatório de Vendas) | CEVEN produtividade/cascata | Clube × CEVEN | Jota, TV, boletim |
| **Pedido colocado hoje** (R$, nº) | **Clube** + Winthor sem vínculo | Winthor (P. Winthor) | Clube × Winthor | Jota/TV/boletim "colocado"; **Liga não** |
| Integrado / não integrado | **Clube** (Painel de Pedidos) | — | — | aviso ao Vitório (1×/h), boletim |
| Status do pedido no Winthor, bloqueio, corte | **Winthor** (P. Winthor) | Clube (Tipo Bloqueio) · GEROT (cortes) | — | Jota pedidos/cortes; Liga (pedido aceito) |
| Faturado e a faturar do mês (vendedor) | **CEVEN** | última leitura do CEVEN → GEROT | GEROT × CEVEN (foto no mesmo momento) | Jota, TV, boletim |
| Faturado oficial / premiação | **GEROT** (foto congelada) | — | GEROT × contábil | premiação |
| Meta do vendedor/filial | CEVEN (hierarquia) | última leitura | GEROT | tudo |
| Indústria (meta, faturado, carteira, positivação) | **GEROT (só ele)** | — | auditoria noturna | Jota indústrias |
| Venda/positivação do dia por indústria | Clube (tabela por fornecedor) | — | GEROT (D+1) | (ainda não usado) |
| Recorrência | GEROT | TAG do CEVEN | — | Jota, Liga defesa |
| Devolução (valor) | CEVEN | GEROT | — | Jota, boletim |
| Devolução (nota e motivo) | CEVEN | — | — | Liga gol contra / vermelho |
| TAGs / campanhas | CEVEN (roteiro) | Clube "Mix de Produtos" (a testar, só leitura) | — | Jota, Liga defesa |
| Prospects | CEVEN | último gravado | — | Jota |
| RET / compromisso | CEVEN admin | — | — | Jota, Plus da Liga |
| Ficha / histórico do cliente / +MIX | Data Lake (CEVEN, D-1) | último gravado | — | Jota, +MIX, Liga inativo/mix/quinzenas |
| Equipe (quem aparece) | Gestão de Equipe | árvore do CEVEN · Clube (supervisor → vendedor) | divergências na Gestão | tudo |

## 5. Regras por produto
- **Jota / TV / boletim:** "hoje" = **pedido colocado** (Clube) com a frase "pedido colocado ainda não é faturado"; mês = faturado + a faturar (CEVEN/GEROT). Sempre com fonte e hora.
- **Liga:** gol de pedido só com pedido **aceito no Winthor** (nº do Winthor); check-in e justificativa do Clube só entram depois da conferência Clube × CEVEN (seção 6, passo 3) e com nova versão das regras.
- **Premiação:** só faturado do GEROT/Winthor, foto congelada; nunca colocado, nunca CEVEN ao vivo.

## 6. Plano para juntar tudo (ordem)
1. **Lista de pedidos do Clube no D1** (Relatório de Pedido, todas as páginas, a cada 15 min): nº Clube, nº Winthor, vendedor, cliente, valor, operação, origem, sincronizado, bloqueio, horários. Tabela `clube_pedido`.
2. **Uma soma só do "colocado do dia"** (seção 3) usada por Jota, TV e boletim; bonificação fora.
3. **Conferência Clube × CEVEN** em 11/11 (antes da queda): check-in cliente a cliente, visitas, vendas — `testes/_confere_clube_ceven.mjs` → `auditoria/CONFERE CLUBE x CEVEN 2026-11-11.md`. Só depois: check-in/justificativa do Clube na rota do Jota e na Liga.
4. **Conferência Clube × Winthor** diária: colocado × integrado × faturado por vendedor; pedido não integrado há mais de 2 h vira lista para a TI.
5. **GEROT × CEVEN** com foto no mesmo momento (já planejado) e limpeza da linha que sumiu (feito 12/11).
6. Atualizar o `scripts/mapa_dados.mjs`/`MAPA_DADOS_GERADO.md` com as tabelas do Clube.

## 7. Situação em 12/11/2026 17h
- CEVEN: erro 500 desde 11/11 17:34 (só admin matriz responde).
- **Integração Clube → Winthor parada:** 1.701 pedidos do dia sem sincronizar (subindo). Aviso ao Vitório no ar.
- GEROT: voltou (posição 12/11).
- Clube: robô no PC do Vitório a cada 15 min (vendas, visitas, check-in/out, justificativas, não integrados).
