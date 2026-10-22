# JOTA — Base de conhecimento (lida dos arquivos do CEVEN, 22/10/2026)

Fontes lidas: Triunfante/CEVEN (Jornada, Funcionalidades, Fundamentos, apresentação nacional, RET, Matinal, campanhas/TAGs, metas outubro, incentivo, War Room), CEVEN TELAS E ENDPOINTS (bíblia operacional, endpoints, modelo de dados, mapas de tela, PROJETO_MESTRE C1–C49, telas VENDEDOR/SUPERVISOR/GERENTE/ADMIN), CEVEN OFFLINE.

## 1. Hierarquia e perfis
- Vendedor (RCA) → Supervisor → Gerente da filial → Diretoria (Locomotiva). Tudo soma de baixo para cima, sem rateio.
- 11 filiais: TPH, ABC, API, TBL, TCV, TSJ, TCA, TBE, TPA, MCD, TCG. TPH (Vagner/Fábio) e MCD (Cleverson/Adriano) têm 2 gerentes; cada um vê só o seu grupo.
- Canais: VJ (varejo), PET VJ, FARMA, ESP = campo; AS, GER, SUP, etc. **Pedidos e valor digitado contam todos os canais**; KPIs de visita (rota, eficácia, positivação de visita) só o varejo de campo.
- Quem aparece = Gestão de Equipe (`mostra` SIM/NÃO). Nunca falar em "planilha".

## 2. KPIs (definições oficiais)
| KPI | Definição |
|---|---|
| Faturado líquido | Notas faturadas no mês menos devoluções. % da meta = faturado ÷ meta (igual à TV). |
| Pendente | Pedido digitado ainda não faturado. Nunca somar com faturado sem dizer. |
| Faturado + pendente | Só como "projeção do que já está na mão", rotulado. |
| Falta | Meta − faturado (0 se passou). |
| Positivação | CNPJs distintos com faturamento líquido > 0 no mês. Corte de 100% ou devolução integral não conta. |
| Meta do mês (out/2026) | SOMA das metas dos vendedores. Grupo: R$ 79,3 mi / 27.000 positivações; super meta R$ 88,7 mi / 27.747. |
| MN (matinal) | Quantidade/valor médio necessário por dia útil restante para bater a meta. |
| D-1 / M-1 | Ontem / mesmo período do mês anterior. |
| Visitas planejadas / realizadas | `total_programado` / `visitas_na_rota` do CEVEN (produtividade.dia). |
| Eficácia | Visitas com venda ÷ visitas planejadas. |
| Eficiência | Visitas realizadas ÷ planejadas. |
| Digitação | Valor digitado hoje (todos os canais). |
| Zerado | Vendedor sem nenhum pedido no dia (ou no mês, dependendo da pergunta: dizer qual). |
| Recorrência | Clientes com a tag RECORRÊNCIA (já deveriam comprar). Venda neles = DEFESA na Liga. Na premiação: meta de 80% da carteira possível. |
| Mix | SKUs distintos por cliente/pedido. Premiação peso 20%. |
| Devolução | Notas devolvidas no mês (valor, nº de notas, motivo por produto: pedido incompleto, cliente não pediu...). |
| Corte | Item pedido e não faturado (logística/estoque). |
| Ticket médio | Valor ÷ pedidos. 1ª compra varejo set/26: R$ 706. |

## 3. Telas do CEVEN (o que cada perfil vê)
- **Vendedor:** Dashboard (financeiro, positivação, produtividade de hoje, devolução no mês), Roteiro Hoje/Mês (clientes com status ABERTO/EFETIVADO/VISITADO/JUSTIFICADO/FORA_ROTA, tags de campanha, curva A/B/C), cliente aberto (Histórico do cliente e do vendedor: dias sem compra, pedidos, último pedido, mix de SKUs, "deixou de comprar"; PEX; +MIX; Tarefas), Mapa (estou aqui, meu roteiro, otimizar rota, prospects, LinkUp), Cadastros, Premiação, RET.
- **Supervisor:** Dashboard da equipe (gráficos e tabelas: Produtividade, Faturamento, Positivação, Compromisso do Dia), Matinal (D-1, M-1, meta, MN), **Compromisso do Dia** (positivação e faturamento por vendedor; não cria depois das 10h, só revisa), **Vespertina** (Plan × Real × Gap no fim do dia), Devoluções do time, Mapa com prospects (CNAE, endereço, CNPJ), Cadastros LinkUp (status e "com quem está"), Premiação (dele e dos vendedores), PA (planos de ação), RET.
- **RET (rota do supervisor):** visita com o vendedor; checklist em 4 etapas: Preparação 0/3, Gôndola 0/4, Negociação 0/4, Fechamento 0/3 → score da visita (%); observações e plano de ação (título, descrição, prazo, prioridade), acompanhado na tela PA.
- **Gerente:** Visão da Filial por supervisor/vendedor (Produtividade, Faturamento, Positivação; hoje e mês; PDF).
- **Admin:** "Fez / Não fez" por supervisor e dia: Compromissos e RETs.

## 4. Premiação RV (vendedor varejo, mensal)
- KPIs e pesos: Faturamento 40%, Positivação 30%, Recorrência 10%, Mix 20%, por fornecedor consolidado.
- Gatilho: 85% do faturamento mínimo; abaixo disso, premiação = 0.
- Aceleradores mensais por indústria (ex.: Condor positivação).
- Supervisor: potencial R$ 5.000 (exemplo de tela), apurado sobre o faturamento da equipe.

## 5. Incentivo Outubro/2026
- Gatilho 1: ≥ 60% da meta de positivação até 15/10 → R$ 150.
- Gatilho 2: ≥ 110% positivação **e** ≥ 110% financeira em 31/10 → R$ 350. Máximo por RCA: R$ 500.
- Supervisor: R$ 300 se a equipe fizer ≥ 110% nos dois. Gerência da filial: R$ 500 nas mesmas condições.
- Bônus expansão: + R$ 30 por cliente novo cadastrado via LinkUp e com 1ª compra faturada e entregue no mês, sem limite.
- Apuração: CEVEN Premiação RV / WinThor, só faturado.
- Metas por filial (R$ / positivação): TPH 11,94 mi / 4.107; ABC 6,07 mi / 3.434; API 6,07 mi / 3.223; TBL 4,92 mi / 2.842; TCV 6,42 mi / 2.439; TSJ 8,465 mi / 2.175; TCA 6,89 mi / 2.159; TBE 7,506 mi / 2.148; TPA 5,925 mi / 1.861; MCD 9,33 mi / 1.376; TCG 5,8 mi / 1.235.

## 6. +MIX
- Recomendação por cliente: produtos que os vizinhos do mesmo tipo compram (raio 3 km, universo ~50 clientes), "impacto estimado" em R$, indústrias com oportunidade da pasta do vendedor.
- Regra da casa: comprou há 7–60 dias = não recomendar; > 60 dias = recomendar; produto novo = 60 dias.
- Uso real (desde 21/10): lista gravada **antes** da compra; uso = cliente comprou produto que estava na lista.
- Dados: `dados_mix.json`, `mix_cubo.json`, `mix_rec/`, `mix_vend/`, `mix_cli/`, `mix_hist/`.

## 7. Campanhas / TAGs
- Formato: filial; cnpj; indústria foco; cor; vendedor. Exemplos: RECORRÊNCIA, SEM COMPRAS P11, FALTA FOCO MARS, VOLTA COMIGO, COMBO, CHAMP KITEKAT, Oportunidade Flow/Block/Tort/Toffees (Arcor), SEM COMPRAS LEÃO.
- Na tela, aparecem como etiquetas no cliente do roteiro.

## 8. Liga Champions (Brasileirão)
- Lances: gols (G01–G12: venda, resgate de inativo >30 dias, drible da vaca >90, super pedido, hat-trick...), defesa (venda em cliente RECORRÊNCIA, +3), cartões (amarelo −3, vermelho −10: "nenhuma visita até 10h", "cliente não pediu"), pênalti (−6), impedimento (−5: fora do local por GPS entre 500 m e 5 km ou check-in/check-out zerado 00:00), gol contra (−4: devolução comercial), campeão da rodada (1x por vendedor no mês), semana invicta (+3).
- Vitória do dia = soma ≥ 11. Lance só vale com prova. Fechamento às 19h30.
- Rankings: vendedor (Brasil e filial), supervisor e filial; "subiu/caiu desde o último jogo".

## 9. Ciclos do WhatsApp (o que o gerente já recebe)
04:00, 07:45 (abertura e risco), 10:00 (Marca Própria), 11:30 (gestão de campo), 14:30, 17:00 (vendas e zerados), 18:30 (fechamento). TPH/MCD por gerente.

## 10. Regras de resposta do JOTA
1. Nunca inventar nem estimar. Sem dado = "sem dado agora".
2. Faturado e pendente sempre separados.
3. Gerente de grupo (TPH/MCD) vê só o seu grupo; diretoria/master vê tudo.
4. Dizer de quando é o dado (hora da leitura).
5. Sempre terminar com uma "🎯 Sugestão do Jota" acionável (quem cobrar, qual cliente, qual produto).
