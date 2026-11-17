# JOTA — Plano para resolver hoje (16/11) e refinar amanhã (17/11)

> Vitório, 16/11/2026 22h: "vc tem milhares de conversas, análises, sabe o que perguntam e como perguntam, sabe o que queremos monitorar nos lances da Champions, sabe todos os KPIs do GEROT... a cada botão abre vendedor, supervisor, filial, cliente, por dia, por mês, acumulado, meses anteriores, médias... montar um plano para resolver tudo hoje e amanhã só refinar... Clube pegando pedidos e o GEROT pegando histórico... amanhã testar o GEROT desde as 06:00, de 30 em 30 minutos, para aprender os horários que realmente atualizam."
> Insumos prontos: [CATALOGO_RESPOSTAS_JOTA.md](CATALOGO_RESPOSTAS_JOTA.md) (40 intenções, 370/370 perguntas), [MAPA_DADOS_JOTA.md](MAPA_DADOS_JOTA.md) (44 dados, fontes, conflitos, lacunas), [REGUA_QUALIDADE_JOTA.md](REGUA_QUALIDADE_JOTA.md) (24 regras) e a bateria `testes/jota_regressao.mjs` (hoje: 8 de 10 casos-chave reprovados; 33% de erro grave na amostra).

## 1. Princípio
**Clube = o DIA** (pedido colocado, visita, check-in, justificativa; a cada 15 min). **GEROT = o OFICIAL e o HISTÓRICO** (faturado, carteira, meta, positivação, mix, devolução, cortes, TMF, pedidos com status e NF, carteira por item com motivo de bloqueio, positivação por cliente, recorrência, campo: 1º check-in, último checkout, tempo de visita, venda sem visita, cobertura). **CEVEN = fora** (teste de 16/11 22h: login de gerente só em TSJ e TCG e a cascata dá erro 500; nas outras 9, 522/timeout).
Todo número sai de uma camada única (`functions/_lib/fatos/`) com fonte e hora; zero só com leitura fresca; sem leitura do dia → a última leitura com a hora, nunca "R$ 0".

## 2. GEROT: o que extrair (já existe o robô online `pipeline/gerot_coletor_online.mjs`, botão "Extrair dados")
| Extração | Grão | Para quê |
|---|---|---|
| Já existe: Mês × Filial × Supervisor × Vendedor × Fornecedor (+ agregados) | vendedor × indústria | meta, faturado, carteira, positivação, indústrias |
| **Nova (pronta, falta o push): Mês × Filial × Vendedor × Cliente** | cliente | curva negativa, positivação por cliente, M-1/3M/A-1 |
| **Nova: Carteira Total ("Exportar planilha")** | pedido × item | status/situação, motivo de bloqueio, pedido nº, cliente, positivado no mês, indústria, caixas, valor → "pedido 1038000485", bloqueados, a faturar |
| **Nova: Pedidos** (Filial → Pedido) | pedido | data do pedido, data de faturamento, NF, faturado → "foi faturado?" |
| **Nova: Recorrência (lista de clientes)** | cliente | "quais clientes posso positivar na recorrência" |
| **Nova: Devoluções** (Filial → Pedido, com Motivo) | nota de devolução | data, valor, NF de venda e de devolução, pedido de origem, cliente, **motivo** → JOTA ("quem devolveu e por quê") e **Liga** (gol contra só nos 6 motivos comerciais; vermelho = "CLIENTE NAO PEDIU"), no lugar do CEVEN parado desde 11/11 |
| **Nova: Campo** (1º check-in, últ. checkout, tempo de visita, venda sem visita, cobertura) | vendedor/dia | reserva do Clube e Liga |
| **Nova: Visão Geral (cards)** | filial/Brasil | painel do diretor e da TV, igual ao GEROT |
**Teste de horário (17/11):** o robô roda das 06:00 às 21:00 de 30 em 30 min e grava a "Última atualização" e a "carga" que o GEROT mostra; ao fim do dia sabemos as janelas reais e ajustamos a agenda.

## 3. Respostas: o catálogo vira o roteador
1. Um roteador novo pelas 40 intenções do catálogo, na ordem: contestação/recado → número (pedido 7–10 dígitos, CNPJ 14, cliente 5–6, opção 1–4 só com menu aberto) → assunto (curva, recorrência, devolução, pedido, indústria, fechamento, liga…) → pessoa (filtra) → dia × mês.
2. Cada intenção tem um modelo de resposta (referência + farol, lista do pior para o melhor, ação com dono/cliente/prazo, rodapé curto de fonte e hora).
3. A régua entra no `testes/rodar_testes.mjs`: os casos-chave bloqueiam a publicação.

## 4. Proativo
Desenho já revisado (agenda 07:30/09:05/11:00/12:00/18:30 + gerente 12:00/18:45, silêncio sem dado fresco, "errado"/"pausa hoje", 20% de controle). Amanhã roda em **simulação**; nada é enviado. Antes, fechar a brecha: todo envio (inclusive monitoria) passa pela mesma trava de pausa/teto.
Disparo manual do diretor: hoje bloqueado pela pausa "só resposta" (desde a restrição do WhatsApp em 10/11). Proposta: comunicado manual da diretoria passa (com o teto antiban); robô continua bloqueado.

## 5. Ordem
**Hoje à noite:**
1. `git push` (libera Clube de 15 em 15 min e a carteira por cliente do GEROT).
2. GEROT: Carteira Total + Pedidos + lista de Recorrência no robô; tabelas no D1.
3. Camada `fatos` v1: dia (Clube), mês (GEROT), pedido (GEROT carteira/pedidos), cliente (GEROT cliente).
4. Roteador + modelos para os 10 casos-chave e as 10 intenções mais frequentes.
5. Régua bloqueando a publicação; publicar só se os casos-chave passarem.
**Amanhã:**
6. Teste de horário do GEROT (06:00–21:00, 30/30 min).
7. Bateria completa (todas as perguntas reais de 16 e 17/11); corrigir até < 5% de erro.
8. Proativo em simulação; leitura do Vitório + 2–3 supervisores.
9. Divulgar quando: casos-chave 100%, amostra < 5%, zero dado falso.
