# MAPA COMPLETO DO CLUBE DA VENDA (TRADEPRO) — 79/79 TELAS

> **Data do mapeamento:** 27/11/2026 (dia-alvo de consulta: `2026-11-26`, último dia útil cheio)
> **Execução:** 100% online via GitHub Actions (4 shards paralelos + 2 passes cirúrgicos: runs `45992322458`, `46007739633` e `46015879256`)
> **Segurança:** Modo **100% somente leitura** (blacklist absoluta em botões de escrita/exclusão/liberação) e **zero PII nos logs** (`0` CNPJs e `0` CPFs expostos em repositório público).
> **Placar de cobertura:** **79 de 79 telas do menu descobertas e inventariadas (100%)** — 78 sem erro de navegação e 1 (`relatorioPedidoGPS.xhtml`) documentada com `Proxy Error` do servidor TradePro ao consultar sem autocomplete de Representante.

---

## 1. Resumo Executivo: o Ouro Novo Descoberto

Hoje o projeto coleta apenas **5 telas** do Clube da Venda (`relatorioVenda.xhtml` nos níveis filial/supervisor/vendedor, `relatorioCheckinCheckout.xhtml`, `relatorioJustificativaRoteiro.xhtml`, `painelPedido.xhtml`, `relatorioPedido.xhtml` por paginação HTML e `relatorioRoteiroConsolidadoGeral.xhtml` via Excel).

A varredura completa das **79 telas** revelou dados inéditos que substituem lacunas do CEVEN travado e da API ainda sem chave, além de acelerar e baratear a coleta atual:

| Descoberta | Tela (`.xhtml`) | Formato / Volume (amostra TCV / rede) | O que destrava imediatamente |
|---|---|---|---|
| **Carteira completa com GPS e dias sem visita** | `relatorioCarteiraClientes.xhtml` | **CSV** direto (`3.670` clientes em TCV em 44s, 18 colunas) | `Latitude`, `Longitude`, `Dias Sem Visita`, `Frequência`, `Visita`, `Status`, `Atividade Comercial`, `Comprador`, `Telefone`, `Representante`. Substitui `ficha_cliente` do CEVEN! |
| **Acompanhamento Diário consolidado em CSV** | `relatorioAcompanhamentoDiarioVenda.xhtml` | **CSV** direto (`52` linhas em TCV em 18s, 20 colunas) | Traz **`Primeiro Pedido`**, **`Ultimo Pedido`**, `Carteira`, `Objetivo Visitas`, `Visitas`, `Pedidos na Rota`, `Pedidos Fora de Rota`, `Nao Visita`, `Nao Venda`, `Valor`, `Eficiecia`, `Eficacia` sem precisar paginar tela! |
| **Pedido em Excel com 29 colunas (em 11s)** | `relatorioPedido.xhtml` | **XLS** (`351` pedidos em TCV em 10,9s vs 68 páginas HTML hoje) | Além de eliminar a paginação lenta, traz **`Prazo 1..5`**, **`Portador`**, **`Excluido`**, **`Atividade Comercial`**, **`Movimento`**, **`Operação`**, **`Total Desconto`**, **`Saldo DM`**, **`Telefone`**, **`Código Integração`**. |
| **Venda e positivação do dia por Fornecedor/Indústria** | `relatorioVenda.xhtml` | Tabela nativa na raiz (`89` indústrias) e por filial (`46` indústrias em TCV) | Traz `Fornecedor/Grupo de Fornecedores`, `Venda`, `% Venda`, `Positivação`, `% Positivação`, `SKUs`, `Total`, `Vendidos` **no dia (ao vivo)** — cobre o buraco de "venda do dia por indústria" antes do GEROT D+1! |
| **Cadastro Mestre de Produtos (estoque e códigos)** | `produto.xhtml` | **XLS** (`8.973` SKUs na rede) | `Código`, `Descrição`, `Descrição Simplificada`, `Fornecedor`, `Prioridade`, **`Estoque`**, `Quantidade Caixa`, `Unidade`, `Embalagem`, **`EAN 13`**, **`DUN 14`**. |
| **Cadastro Mestre de Representantes** | `representante.xhtml` | **XLS** (`66` linhas na página/filtro) | `Código`, `Nome`, `Telefone`, `Email`, `IMEI`, `Versão`, **`Supervisor`**, **`CodFilial`**, **`Tipo Canal`**, `Ativo`, `Online`, `Carga Pendente`, `Calcula Eficiência / Eficácia`, `Checkin e Checkout Obrigatórios`. Ajuda a cruzar canal e árvore junto ao GEROT! |
| **Horário de rota e Tempo Ocioso** | `relatorioAtendimento.xhtml` | Tabela + **XLS** | `Inicio Rota`, `Termino Rota`, **`Tempo Oscioso`**, `Rendimento`, `Total Troca`, `Roteiro`, `Visitas na Rota`. |
| **Quilometragem programada vs percorrida** | `relatorioQuilometragem.xhtml` | Tabela + botão `Excel` | `Coordenador`, `Representante`, `Data`, `Km programado`, `Km percorrido`, `Km diferença`. |
| **Combos promocionais (item a item e verba/estoque)** | `relatorioComboProduto.xhtml` & `relatorioCombosPromocionais.xhtml` & `cadastro_combo.xhtml` | Tabela + **XLSX/XLS** (`89` / `28` linhas em TCV) | `Código Combo`, `Descrição combo`, `Código Produto`, `Quantidade`, `Preço`, `% Desconto`, `Verba`, `Estoque inicial`, `Estoque atual`. |
| **Mix de Produtos (Foco / Promoção / Lançamento)** | `foco_atividade.xhtml` | Tabela (`3` registros ativos) | Tipo explicitamente classificado em `Foco`, `Promoção` e `Lançamento` com `Data Inicial`, `Data Final` e `Produto`. |
| **Telemetria antifraude do aparelho** | `relatorioBroadcast.xhtml` | Tabela filtrável por Ação | `GPS Modificado`, `Hora Alterada`, `Data Alterada`, `Modo Avião`, `Bateria Baixa`, `Dispositivo Desligado`, `Carga Recebida`, `Pedido Emitido`, `Roteiro Executado`. |
| **Finalização de Rota (Pedidos e Bonificações)** | `relatorioFinalizacaoRota.xhtml` | Tabela + **XLS** | `Código/ID`, `Representante/Nome`, `Data`, `Pedidos`, `Bonificação`. |
| **Metas cadastradas e Relatório de Metas** | `meta.xhtml` & `relatorioMeta.xhtml` | Tabela (`29.842` metas cadastradas!) + **XLS** | Metas por `Produto / Linha / Grupo Linha / Fornecedor / Cliente`, tipos `Positivação`, `Valor`, `Quantidade`, `Peso`, `Efetividade`, `Cadastro Ativo`, com `Meta`, `Realizado`, `% Realizado`, `Peso`, `Recorrente`. |

---

## 2. Sonda Especial da `relatorioVenda.xhtml` (Tela Inicial / `Home`)

Consultada diretamente com parâmetros `?di=20261126&df=20261126&fo=-1`:

1. **Nível Raiz (`Filiais` — sem `fi`)**:
   - **Botões**: `Pesquisar`, `Excel`, `Gerar venda de todos RCAs` (ação AJAX na página, não gera download direto).
   - **Tabela 1 (14 linhas — 11 filiais + CTD/ADM + TBA + Total Grupo)**:
     `Unidade | Nome | Clientes sem Roteiro | Total Pedido | Total Faturado | Roteiros | Visitas na Rota | Pedidos (Rota / Fora / Total / Média SKU) | Eficiência | Eficácia`
   - **Tabela 2 — `Gráfico de Venda Fornecedores do Grupo` (89 linhas)**:
     `Fornecedor/Grupo de Fornecedores | Venda | % Venda | Positivação | % Positivação | FILIAIS`
   - **Excel (`relatorio_venda_excel.xls`, 14 linhas)**: exporta a Tabela 1 de Filiais.
2. **Nível Filial (`fi=4&n=PAUTA`, ex.: TCV)**:
   - **Tabela 1 (8 linhas de Coordenadores em TCV)**:
     `Código | Nome | Total Pedido | Total Faturado | Roteiros | Visitas na Rota | Pedidos (Rota / Fora / Total / Média SKU) | Eficiência | Eficácia | Saldo DM`
   - **Tabela 2 — Fornecedores da Filial (46 linhas em TCV)**:
     `Fornecedor/Grupo de Fornecedores | Venda | % Venda | Positivação | % Positivação | SKUs | Total | Vendidos`
   - **Excel (`relatorio_venda_excel.xls`, 8 linhas)**: exporta os Coordenadores da filial.

---

## 3. Legenda de Classificação

- **`JÁ COLETADA`**: já entra hoje em `clube_coletor.mjs` ou `clube_roteiro.mjs`.
- **`EXPANDIR`**: já coletamos a tela, mas existe exportação mais rica/rápida (XLS/CSV) ou tabela secundária (ex.: Fornecedores) não aproveitada.
- **`OURO NOVO`**: dado inédito de alto valor comercial/operacional para D1, JOTA, Liga ou TV.
- **`CADASTRO MESTRE`**: tabelas de referência/dimensão (`produto`, `representante`, `fornecedor`, `operacao`, `portador`, `motivoNaoVenda`, `meta`, etc.) ideais para carga diária ou semanal.
- **`ADMIN/OPERACIONAL`**: telas de manutenção/parametrização/liberação de uso interno no portal (não precisam de coleta contínua, ou exigem modo somente estrutura).

---

## 4. Inventário Completo das 79 Telas (Agrupado por Menu)

### 4.1 Menu `Home` e `Relatório` (38 telas)

| Arquivo (`.xhtml`) | Nome no Menu | Filtros principais | Botões úteis | Exportação (formato e colunas) | Colunas na tela / Observações | Classificação |
|---|---|---|---|---|---|---|
| `relatorioVenda.xhtml` | Home / Relatório de Vendas | Data Inicial, Data Final, Fornecedor, Vendas Coordenadores | Pesquisar, Excel, Gerar venda de todos RCAs | `Excel` (`.xls`: 14 filiais ou N coords) | Tabela principal (Filiais/Coords/RCAs) + **Tabela Fornecedores (89 rede / 46 filial)** | **`EXPANDIR`** |
| `relatorioAcompanhamentoDiarioVenda.xhtml` | Acomp. Diário Vendas | Filial, Coordenador, Mensal, Data Inicial, Data Final, Mês | Gerar, Exportar para CSV | `Exportar para CSV` (`.csv`: **52 linhas** em TCV) — `Data \| Codigo Coordenador \| Coordenador \| Codigo Vendedor \| Vendedor \| Carteira \| Objetivo Visitas \| Visitas \| Pedidos Venda \| Pedidos na Rota \| Pedidos Fora de Rota \| Total \| Nao Visita \| Nao Venda \| Primeiro Pedido \| Ultimo Pedido \| Valor \| Eficiecia \| Eficacia \| Filial` | Exige Coordenador no `Gerar`, mas o **CSV exporta a filial inteira** | **`OURO NOVO`** |
| `relatorioCarteiraClientes.xhtml` | Carteira de Clientes | Filial, Coordenador, Representante, Exibir Recorrência Única | Gerar, Exportar para CSV | `Exportar para CSV` (`.csv`: **3.670 linhas** em TCV) — `Codigo Cliente \| CNPJ \| Cliente \| Fantasia \| Atividade Comercial \| Cidade \| Bairro \| Endereço \| Latitude \| Longitude \| Comprador \| Telefone \| Frequência \| Visita \| Dias Sem Visita \| Status \| ID \| Representante` | Substitui cadastro/lat-long/dias sem visita do CEVEN | **`OURO NOVO`** |
| `relatorioPedido.xhtml` | Relatório de Pedido | Data Inicial/Final, Filial, Coordenador, Representante, Cliente, Origem, Tipo Bloqueio, Pedido, Pedidos Faturados/Excluídos, Venda Assistida | Gerar, Exportar para PDF, Excel (via filtro/tabela) | `Excel` (`.xls`: **351 linhas** em TCV) — `ID do Representante \| Representante \| Pedido \| Pedido Winthor \| Cliente \| Razão Social \| Atividade Comercial \| Movimento \| Prazo 1..5 \| Operação \| Portador \| Total Desconto \| Saldo DM \| Total \| Tipo Bloqueio \| Sincronizado \| Confirmado \| Excluido \| Origem \| Data Inicial \| Data Emissão \| Data de Recebimento \| Data Liberação \| Telefone \| Código Integração` | Tela traz 22 colunas; **Excel traz 29 colunas em 11s** | **`EXPANDIR`** |
| `painelPedido.xhtml` | Painel de Pedidos | Data Inicial/Final, Cliente, Filial, Coordenador, Representante, Sincronizado, Atualizar Tela | Gerar, Exportar para PDF | — | Monitora pedidos não sincronizados com o Winthor | **`JÁ COLETADA`** |
| `relatorioCheckinCheckout.xhtml` | Relatório de Checkin Checkout | Data Inicial/Final, Coordenador, Representante | Gerar, Excel | `Excel` (`.xls`: 39 linhas em TCV) — `CÓDIGO \| TIPO \| Data e Hora \| Representante \| Código Cliente \| CNPJ \| Razão Social \| Fantasia` | `Código \| Tipo \| Data/Hora \| ID \| Representante \| Código Cliente \| CNPJ \| Razão Social \| Fantasia` | **`JÁ COLETADA`** |
| `relatorioJustificativaRoteiro.xhtml` | Relatório Justificativa de Roteiro | Data Inicial/Final, Coordenador, Representante, Motivo Não Visita | Gerar, Excel | `Excel` (`.xls`: **3.429 linhas** na rede no dia!) | `ID \| Coordenador \| Representante \| Código Cliente \| CPF/CNPJ \| Razão Social \| Fantasia \| Dias Sem Comprar \| Motivo Não Visita \| Data \| Observação` | **`JÁ COLETADA`** |
| `relatorioRoteiroConsolidadoGeral.xhtml` | Roteiro Consolidado Geral | Filial, Data Inicial, Data Final | Excel | `Excel` (`.xls`: **370 linhas** para TCV/dia) | Baixa a rota nominal do dia com recorrência e dia da semana | **`JÁ COLETADA`** |
| `relatorioAtendimento.xhtml` | Relatório de Atendimento | Coordenador, Data Inicial | Gerar, Excel | `Excel` (`.xls`) — `Codigo \| Representante \| Total Pedido \| Total Troca \| Roteiros \| Visita nas Rotas` | Tela traz colunas extras: **`Rendimento \| Inicio Rota \| Termino Rota \| Tempo Oscioso`** | **`OURO NOVO`** |
| `relatorioQuilometragem.xhtml` | Relatório de Quilometragem | Data Inicial/Final, Coordenador, Representante, Valor do Km | Gerar, Excel | Botão `Excel` presente (não disparou download sem coord/rep selecionado) | `Coordenador \| Representante \| Data \| Km programado \| Km percorrido \| Km diferença` | **`OURO NOVO`** |
| `relatorioMeta.xhtml` | Relatório de Metas | Data Inicial/Final, Filial, Coordenador, Representante, Produto | Gerar, Excel | `Excel` (`.xls`: 5+ linhas) | `Mês \| Produto / Linha / Grupo Linha / Fornecedor / Cliente \| Representante / Coordenador / Filial \| Tipo Meta \| Meta \| Realizado \| Percentual Realizado` | **`OURO NOVO`** |
| `relatorioComboProduto.xhtml` | Relatório de Combo por Produto | Data Inicial/Final, Combo (8.637 opções!), Coordenador, Representante | Gerar, Excel | `Excel` (`.xlsx`: **89 linhas** em TCV) | `Representante \| Cliente \| Data \| Pedido \| Código Produto \| Descricao Produto \| Código Combo \| Descrição combo \| Quantidade \| Preço \| Percentual de Desconto do Combo` | **`OURO NOVO`** |
| `relatorioCombosPromocionais.xhtml` | Relatório de Combos Promocionais | Data Inicial/Final, Coordenador, Representante, Combo, Cliente, Inativo, Visualizar por Pedido | Pesquisar, Excel | `Excel` (`.xls`: **28 linhas** em TCV) | `RCA \| Nome \| Id combo \| Descrição combo \| Editável \| Qtd vendida \| Verba \| Estoque inicial \| Estoque atual` | **`OURO NOVO`** |
| `relatorioCombo.xhtml` | Relatório de Combos | Data Inicial/Final, Combo, Coordenador, Representante | Gerar | — | Lista vendas por combo selecionado | **`OURO NOVO`** |
| `relatorioFinalizacaoRota.xhtml` | Finalização Rota | Coordenador, Representante, Data Inicial/Final | Gerar, Excel | `Excel` (`.xls`) — `ID \| Nome \| Data \| Pedidos \| Bonificação` | `Código \| Representante \| Data \| Pedidos \| Bonificação` | **`OURO NOVO`** |
| `relatorioBroadcast.xhtml` | Alterações no Aparelho | Coordenador, Representante, Ação (25 tipos de evento!), Data Inicial/Final | Gerar | — | `Código \| Representante \| Ação \| Descrição da Ação \| Data/Hora` (GPS Modificado, Hora Alterada, Modo Avião, Bateria Baixa, etc.) | **`OURO NOVO`** |
| `relatorioRoteiroPedido.xhtml` | Roteiro Pedido | Data da Visita, Coordenador, Representante, Pesquisar por, Filtro, Fornecedor, 8 checkboxes de status | Gerar Relatório, Legenda | — | Exige Coordenador/Representante específico (sem Filial); retorna `Nenhum roteiro encontrado` sem seleção válida | **`ADMIN/OPERACIONAL`** |
| `relatorioRoteiroConsolidado.xhtml` | Roteiro Consolidado | Mensal*, Coordenador, Representante, Agrupar Datas de Visita Para Excel | Gerar | — | Visão mensal individual por RCA (coberta em escala pelo `Geral`) | **`ADMIN/OPERACIONAL`** |
| `relatorioPedidoVendedor.xhtml` | Relatório de Pedido Vendedor | Data Inicial/Final, Coordenador, Representante | Excel | Botão `Excel` (exige Coordenador/Representante) | Visão por vendedor | **`ADMIN/OPERACIONAL`** |
| `relatorioPedidoTradeZap.xhtml` | Relatório de Pedido TradeZap | Data Inicial/Final, Coordenador, Representante, Cliente | Gerar, Exportar para PDF | — | Pedidos originados via TradeZap | **`OURO NOVO`** |
| `relatorioPedidoGPS.xhtml` | Relatório de Pedido por GPS | Data Inicial/Final, Coordenador, Representante (autocomplete) | Gerar | — | Sem filtro de Filial; deu **`Proxy Error`** do Apache ao consultar sem autocomplete preenchido | **`ADMIN/OPERACIONAL`** |
| `rastreamento.xhtml` | Rastreamento | Data, Representante*, Cliente*, Alterar ponto Cliente, Rastreamento detalhado | Gerar, Buscar Coordenadas, Salvar (mapa) | — | Mapa Google Maps com trajeto, pins e `Distância percorrida(estimada)` | **`ADMIN/OPERACIONAL`** |
| `mapaVenda.xhtml` | Mapa de Vendas | Pesquisar por, Filtro, Data Inicial/Final, Representante, Fornecedor, Alterar Ponto | Gerar, Buscar Coordenadas, Salvar (mapa) | — | Mapa Google Maps de positivação geográfica | **`ADMIN/OPERACIONAL`** |
| `relatorioClienteFornecedor.xhtml` | Cliente/Fornecedor | Representante, Data Inicial/Final, Quantidade, Ordenação, Fornecedor (99 opções) | Gerar Relatório | — | Positivação cliente × fornecedor por representante (GEROT já cobre) | **`ADMIN/OPERACIONAL`** |
| `relatorioPotencialCompra.xhtml` | Potencial Compra | Coordenador, Representante, Cliente, Potencial por (Dia/Mês), Fornecedor, Data*, Incremento de Objetivo | Gerar | — | `Potencial Compra \| Potencial Incrementado` | **`ADMIN/OPERACIONAL`** |
| `relatorioMapaDeOportunidade.xhtml` | Relatório Mapa de Oportunidade | Data Inicial*, Coordenador, Representante, Fornecedor | Gerar | — | Exige Coordenador ou Representante informado para cruzar oportunidades | **`OURO NOVO`** |
| `relatorioDiasTrabalhados.xhtml` | Relatório Dias Trabalhados | Data Inicial/Final, Coordenador, Representante | Gerar | — | Apuração de dias trabalhados por vendedor | **`OURO NOVO`** |
| `relatorioFoto.xhtml` | Relatório de Fotos | Data Inicial/Final, Coordenador, Representante, Atividade Comercial | Gerar, PowerPoint | Exporta PowerPoint (`.pptx`) | Fotos de execução em PDV por atividade comercial | **`ADMIN/OPERACIONAL`** |
| `relatorio_couching5a5.xhtml` | Relatório de Formulário | Formulário (`Selecione`) | Gerar | — | Respostas de pesquisas / Coaching 5 a 5 | **`ADMIN/OPERACIONAL`** |
| `relatorioTitulo.xhtml` | Relatório de Titulos | Cliente* (obrigatório) | Gerar | — | Consulta pontual de títulos em aberto por cliente | **`ADMIN/OPERACIONAL`** |
| `relatorioTransferenciaDeDM.xhtml` | Relatório Transferência de DM | Data Inicial/Final, Tipo, Código Pedido | Pesquisar | — | Auditoria de transferência de saldo DM | **`ADMIN/OPERACIONAL`** |
| `relatorioCarga.xhtml` | Processamento de Carga | Data Inicial/Final, Status Carga | Gerar | — | `Arquivo Erro \| Data Inicial \| Data Final \| Status Carga` (`624` registros) — saúde de integração ERP ↔ Clube | **`OURO NOVO`** |
| `relatorioCargaPalm.xhtml` | Carga/Palm | Data Inicial/Final, Registro, Coordenador, Representante | Gerar | — | `Data de Recebimento \| Registro \| Representante \| Coordenador` | **`ADMIN/OPERACIONAL`** |
| `relatorio_auditoria.xhtml` | Relatório de Auditoria | Data Inicial/Final, Descrição, Usuário, Tipo | Pesquisar | — | Log de auditoria de ações de usuários no portal | **`ADMIN/OPERACIONAL`** |
| `rankingCampanha.xhtml` | Ranking Campanha | Ranking Campanha | — | — | 3 tabelas: Campanhas (`Descrição \| Data Inicial \| Data Final \| Ativo \| Observações`), Ranking (`Posição \| Pontos`), Clientes (`CNPJ \| Razão Social \| Data`) | **`ADMIN/OPERACIONAL`** |
| `rankingCampanhaFiliais.xhtml` | Ranking Campanha de Filiais | Ranking Campanha | — | — | Campanhas e ranking de filiais (`Posição \| Pontos \| Código \| Nome \| Filial`) | **`ADMIN/OPERACIONAL`** |
| `relatorioClientesSemRoteiro.xhtml` | Clientes Sem Roteiro (URL auxiliar da Home) | — (recebe contexto da `relatorioVenda.xhtml`) | — | — | Tela auxiliar ligada ao link `Clientes sem Roteiro` na Home | **`ADMIN/OPERACIONAL`** |
| `fatura.xhtml` | Fatura | — | — | — | Tela vazia / sem tabela para o perfil atual | **`ADMIN/OPERACIONAL`** |

*(Total `Home` + `Relatório`: 1 `Home` + 36 `Relatório` + 1 `Outro` (`relatorioClientesSemRoteiro.xhtml`) = **38 telas**.)*

---

### 4.2 Menu `Cadastro` (35 telas)

| Arquivo (`.xhtml`) | Nome no Menu | Filtros | Botões úteis | Exportação | Colunas na tela / Volume | Classificação |
|---|---|---|---|---|---|---|
| `produto.xhtml` | Produto | Filial* | Limpar Filtros, **Excel** | `Excel` (`.xls`: **8.973 registros**) — `Código \| Descrição \| Descrição Simplificada \| Fornecedor \| Prioridade \| Estoque \| Quantidade Caixa \| Unidade \| Embalagem \| EAN 13 \| DUN 14` | `Foto \| Código \| Descrição \| Descrição Simplificada \| Fornecedor \| Prioridade \| Estoque \| Custo \| Quantidade Caixa \| Unidade \| Embalagem` (599 págs) | **`CADASTRO MESTRE`** |
| `representante.xhtml` | Representante | Filial, Supervisor, Online, Carga Pendente | **Excel**, Editar/Visualizar | `Excel` (`.xls`: **66 linhas** na página/filial) — `Foto \| Código \| Nome \| Telefone \| IMEI \| Versão \| Supervisor \| CodFilial \| Calcula Eficiência / Eficácia \| Checkin e Checkout Obrigatórios \| Ativo \| Online \| Tipo Canal \| Carga Pendente \| Email` | Cadastro completo do RCA com **`Supervisor`**, **`CodFilial`** e **`Tipo Canal`** | **`CADASTRO MESTRE`** |
| `fornecedor.xhtml` | Fornecedor | — | Editar/Visualizar | — | `CNPJ \| Razão Social \| Descrição Simplificada \| Permitir Pedido \| Raio X` (**102 registros**) | **`CADASTRO MESTRE`** |
| `filial.xhtml` | Filial | — | Limpar Filtros | — | `CNPJ \| Nome \| Unidade \| Telefone \| Endereço` (**14 registros**) | **`CADASTRO MESTRE`** |
| `linha.xhtml` | Linha | — | Limpar Filtros | — | `Código \| Descrição \| Descrição Simplificada \| codigo.integracao` (**225 registros**) | **`CADASTRO MESTRE`** |
| `atividadeComercial.xhtml` | Atividade Comercial | — | Editar/Visualizar | — | `ID \| Descrição` (**62 registros**, ex.: `AS-ATACADO`, `ROTA-FARMACIA`) | **`CADASTRO MESTRE`** |
| `motivoNaoVenda.xhtml` | Motivo de Não Venda | Observação Obrigatória, Excluído, Criar Checkin Checkout | Editar/Visualizar | — | `ID \| Descrição \| Observação Obrigatória \| Excluido \| Criar Checkin Checkout` (**11 registros**) | **`CADASTRO MESTRE`** |
| `operacao.xhtml` | Operação | Excluído, Permitir Pedido | Editar/Visualizar | — | `ID \| Descrição \| Liberado \| Excluido \| Permitir Pedido` (**19 registros**) | **`CADASTRO MESTRE`** |
| `portador.xhtml` | Portador | Permitir Pedido | Editar/Visualizar | — | `ID \| Descrição \| Tipo \| Permitir Pedido \| CodFilial` (**38 registros**) | **`CADASTRO MESTRE`** |
| `foco_atividade.xhtml` | Mix de Produtos | — | Novo, Editar/Visualizar | — | `ID \| Data Inicial \| Data Final \| Descrição \| Produto \| Tipo (Foco / Promoção / Lançamento)` (**3 registros**) | **`CADASTRO MESTRE`** |
| `meta.xhtml` | Meta | Data Inicial/Final, Filial Importação, Coordenador, Representante | Pesquisar | — | `ID \| Mês \| Produto/Linha/Grupo/Fornecedor/Cliente \| Representante/Coordenador/Filial \| Tipo Meta \| Meta \| Realizado \| % Realizado \| Peso \| Pontuação \| Recorrente \| Filial Importação` (**29.842 registros**) | **`CADASTRO MESTRE`** |
| `cadastro_combo.xhtml` | Combo | Filial | Pesquisar Por Produto | — | `ID \| Descrição \| Data Inicial \| Data Final \| Qtd. Itens por Brinde \| Qtd. Mínima Total \| Qtd. Total de Itens \| Agrupamento \| Editável` (**196 registros**) | **`CADASTRO MESTRE`** |
| `descontoProgressivo.xhtml` | Desconto Progressivo | — | Editar/Visualizar | — | `ID \| Descrição \| Data Inicial \| Data Final` (**35 registros**) | **`CADASTRO MESTRE`** |
| `restricao_compra.xhtml` | Restrição de Compra | — | Novo, Editar/Visualizar | — | `ID \| Descrição \| Data Inicial \| Data Final \| Quantidade \| Filtro \| Exclusivo \| Por Cliente \| Destino (CLUBE/TRADEZAP/MARS/E-Commerce/Yalo)` (**30 registros**) | **`CADASTRO MESTRE`** |
| `feriado.xhtml` | Feriados | — | Editar/Visualizar | — | `ID \| Descrição \| Cidade \| UF \| Data \| Todo ano?` (**25 registros**) | **`CADASTRO MESTRE`** |
| `roteiros.xhtml` | Roteiro | Filial, Coordenador, Representante, Cliente, Recorrência, Dia da semana, Status | Exportar para Excel, Exportar para PDF | Botão `Exportar para Excel` (requer filtro preenchido) | `ID \| Cliente \| Início \| Fim` (cadastro de recorrência; leitura diária já coberta pelo `relatorioRoteiroConsolidadoGeral.xhtml`) | **`ADMIN/OPERACIONAL`** |
| `consultaCliente.xhtml` | Consulta de Cadastro de Cliente | Cliente | Consultar | — | Consulta unitária por cliente | **`ADMIN/OPERACIONAL`** |
| `cadastro_clientes_palm.xhtml` | Cliente/Palm | Data Inicial/Final, Representante | Pesquisar, Limpar Filtros | — | `CNPJ \| Nome \| Razão Social \| Cidade \| Telefone \| Representante \| Data de Recebimento \| Sincronizado \| Efetivado \| Origem` (cadastros novos enviados do app) | **`OURO NOVO`** |
| `comboSicf.xhtml` | Combo de Campanha | — | Pesquisar Por Produto | — | `ID \| Código Combo \| Descrição \| Data Inicial \| Data Final \| Valor Mínimo \| Valor Máximo \| Ativo \| Qtd Máx \| Famílias \| Bloquear Verba` | **`ADMIN/OPERACIONAL`** |
| `mixIdeal.xhtml` | Mix Ideal | — | Novo, Editar | — | `ID \| Descrição \| Data Inicial \| Data Final` (0 ativos hoje) | **`ADMIN/OPERACIONAL`** |
| `formularioPesquisa.xhtml` | Formulário Pesquisa | — | Limpar Filtros | — | `Descrição \| Data Inicial \| Data Final \| Couching` (1 registro) | **`ADMIN/OPERACIONAL`** |
| `jornada_trabalho.xhtml` | Jornada de Trabalho | — | Novo, Editar *(estrutura apenas)* | — | `ID \| Descrição \| Tipo Jornada (Semanal/Sábado/Domingo) \| Início/Fim 1º e 2º períodos \| Tempo de Almoço` (**3 registros**) | **`CADASTRO MESTRE`** |
| `parametro.xhtml` | Parâmetro | Filial, Representante, Coordenador | Salvar | — | Regras operacionais do app (bloquear DM negativo, GPS, horário, prazo médio, raio justificativa, etc.) | **`ADMIN/OPERACIONAL`** |
| `parametroCliente.xhtml` | Parâmetros de Cliente | — | Novo, Editar | — | `ID \| CPF/CNPJ \| Cliente \| Permitido Troca \| Chatbot \| Venda Unidade \| Limite de crédito` (6 registros) | **`ADMIN/OPERACIONAL`** |
| `parametroFornecedor.xhtml` | Parâmetros de Fornecedor | — | Novo, Editar | — | `ID \| Fornecedor \| Qtd SKU Primeiro Pedido \| Qtd \| Desconto Financeiro \| Cálculo DM \| Destino` | **`ADMIN/OPERACIONAL`** |
| `parametroProposta.xhtml` | Parâmetros de Proposta | Representante, Coordenador | Salvar | — | `Aplicar DM \| Frequência recálculo \| Incremento Proposta 1..3 \| Indústrias` | **`ADMIN/OPERACIONAL`** |
| `elaboradorProposta.xhtml` | Elaborador de Proposta | Representante, Tipo Proposta*, Tabela de Preço* | Gerar *(estrutura apenas)* | — | `ID \| CNPJ \| Razão Social \| Código \| Representante \| Tabela de Preço \| Tipo Proposta \| Total \| Editável` | **`ADMIN/OPERACIONAL`** |
| `movimentacaoProposta.xhtml` | Movimentação de Proposta | Data Inicial/Final, Coordenador, Representante | Pesquisar *(estrutura apenas)* | — | `CNPJ Cliente \| Tipo Proposta \| Oferta Vinculante \| Status \| Valor Proposta \| Data \| Objeção Cliente \| Detalhamento Objeção` | **`ADMIN/OPERACIONAL`** |
| `movimentacaoRoteiro.xhtml` | Movimentação de Roteiro | Data Inicial/Final, Coordenador, Representante | Pesquisar *(estrutura apenas)* | — | `CNPJ Cliente \| Razão Social \| Data da Visita \| Status Visita \| Motivo de Não Atendimento \| Detalhamento Não Visita` | **`ADMIN/OPERACIONAL`** |
| `planoAcao.xhtml` | Plano de Ação | — | Novo, Editar *(estrutura apenas)* | — | `ID \| Data Análise \| ID Representante \| CNPJ Cliente \| Análise \| Ação \| Status \| Data da Visita \| Observações \| Fonte` | **`ADMIN/OPERACIONAL`** |
| `faixaCep.xhtml` | Faixa de CEP | — | Novo, Editar | — | `ID \| Cep Inicial \| Cep Final \| Prazo de Entrega` | **`ADMIN/OPERACIONAL`** |
| `faixaComissao.xhtml` | Faixa de Comissão | — | Novo, Editar | — | `ID \| Percentual \| Comissão \| Tipo \| Representante` | **`ADMIN/OPERACIONAL`** |
| `grupoProduto.xhtml` | Grupo Produto | — | Confirmar, Cancelar | — | `Código do Grupo \| Descrição` | **`ADMIN/OPERACIONAL`** |
| `lamina.xhtml` | Lamina | — | Novo, Editar | — | `Capa \| Descrição \| Qtd. Fotos` | **`ADMIN/OPERACIONAL`** |
| `ranking.xhtml` | Ranking | Filial | Novo, Editar | — | `ID \| Descrição \| Filial` | **`ADMIN/OPERACIONAL`** |

---

### 4.3 Menus `Manutenção`, `Configuração` e `Liberação` (6 telas — Modo Estrutura Apenas)

| Menu | Arquivo (`.xhtml`) | Nome no Menu | Filtros | Botões na tela (NUNCA clicados) | Colunas / Função | Classificação |
|---|---|---|---|---|---|---|
| Manutenção | `couching5a5.xhtml` | Couching 5 a 5 | — | Responder | `Descrição \| Data Inicial \| Data Final` — preenchimento de formulário 5a5 | **`ADMIN/OPERACIONAL`** |
| Configuração | `perfilUsuario.xhtml` | Perfil de Usuário | — | Novo, Editar/Visualizar, Excluir | `ID \| Descrição` — perfis de permissão | **`ADMIN/OPERACIONAL`** |
| Configuração | `usuario.xhtml` | Usuário | Ativo | Novo, Editar/Visualizar, Duplicar, Alterar Senha | `Nome \| Telefone \| Email \| Login \| Perfil de Usuário \| Ativo` (15 registros/pág) | **`ADMIN/OPERACIONAL`** |
| Liberação | `calculaSenha.xhtml` | Liberação de Senha | Liberação de Senha (Financeiro, Margem DM, Fora de Rota, Prazo Médio, Bonificação, Liberação de Prazo), Cliente, Senha | Gerar | Gerador de senha de liberação para o app | **`ADMIN/OPERACIONAL`** |
| Liberação | `liberacaoPedido.xhtml` | Liberação de Pedido | Coordenador, Representante | Gerar, Liberar Pedido, Excluir Pedido, Total Por Fornecedor, Exportar para PDF | Fila de liberação: `Pedido \| Pedido Winthor \| Data \| Representante \| Cliente \| Cidade \| CNPJ \| Início \| Fim \| Dm do Pedido \| Valor \| Total Troca \| Total Desc. Financeiro \| Portador \| Prazo Médio \| Info. \| Tipo Bloqueio` | **`ADMIN/OPERACIONAL`** |
| Liberação | `reativaPedido.xhtml` | Reativar pedido | Data Inicial/Final, Coordenador, Representante | Pesquisar, Reativar *(via listagem)* | Reativação de pedidos cancelados/excluídos | **`ADMIN/OPERACIONAL`** |

---

## 5. Proposta para a Parte 2 — Motor Unificado do Clube (`clube_motor_coleta.mjs`)

Em vez de multiplicar coletores soltos e manter dependência do PC local, podemos organizar a coleta do Clube da Venda em **3 cadências (Tiers)** no mesmo padrão do GEROT, mesclando com GEROT + CEVEN em `functions/_lib/fatos/`:

### Tier 1 — Tempo Real (a cada 15 min, seg–sáb 07h–21h)
1. **`relatorioVenda.xhtml`** (já existente, expandir para ler também a tabela **Fornecedores** da raiz e por filial → nova `clube_fornecedor_dia`): resolve venda e positivação do dia por indústria antes do GEROT D+1.
2. **`relatorioPedido.xhtml` via Excel `.xls` por filial** (substituir a paginação HTML de 68 páginas!): 11 downloads de `.xls` em ~20s no total → alimenta `clube_pedido` com **todos os 29 campos** (`Prazo 1..5`, `Portador`, `Excluido`, `Saldo DM`, `Total Desconto`, `Código Integração`, `Tipo Bloqueio`, `Sincronizado`).
3. **`relatorioCheckinCheckout.xhtml` + `relatorioJustificativaRoteiro.xhtml` + `painelPedido.xhtml`**: mantidos no mesmo ciclo (já validados).
4. **`relatorioAcompanhamentoDiarioVenda.xhtml` (CSV)** (opcional no Tier 1 ou Tier 2 a cada 1h): captura `Primeiro Pedido`, `Ultimo Pedido`, `Carteira`, `Objetivo Visitas`, `Nao Visita`, `Nao Venda` em 1 chamada por filial (~18s).

### Tier 2 — Campo, Execução & Campanhas (a cada 2h, junto às janelas do GEROT)
1. **`relatorioAtendimento.xhtml` (HTML/XLS)**: `Inicio Rota`, `Termino Rota`, `Tempo Oscioso`, `Rendimento`.
2. **`relatorioQuilometragem.xhtml`**: `Km programado`, `Km percorrido`, `Km diferença`.
3. **`relatorioCombosPromocionais.xhtml` + `relatorioComboProduto.xhtml`**: verba e estoque de combos promocionais por RCA e produto.
4. **`relatorioBroadcast.xhtml`**: alertas antifraude (`GPS Modificado`, `Hora Alterada`, `Modo Avião`).
5. **`relatorioCarga.xhtml`**: saúde das cargas Winthor ↔ Clube.

### Tier 3 — Cadastros Mestres & Carteira (1x por dia, madrugada/05h BRT)
1. **`relatorioRoteiroConsolidadoGeral.xhtml` (XLS)**: já roda (rota do dia com nomes e recorrência).
2. **`relatorioCarteiraClientes.xhtml` (CSV por filial)**: atualiza carteira completa com **Latitude, Longitude, Dias Sem Visita, Status, Frequência, Comprador e Telefone** (`clube_carteira_cliente`), substituindo a base congelada `ficha_cliente` do CEVEN.
3. **`produto.xhtml` (XLS)**: catálogo de **8.973 SKUs** com estoque atual, EAN13, DUN14 e fornecedor (`clube_produto`).
4. **`representante.xhtml` (XLS) + `foco_atividade.xhtml` + `fornecedor.xhtml` + `operacao.xhtml` + `motivoNaoVenda.xhtml`**: árvore do Clube com `Tipo Canal`, itens Foco/Promoção/Lançamento e tabelas de domínio.

---

## 6. Validação & Limpeza Realizada

- **Sintaxe:** `node --check pipeline/clube_mapa_telas.mjs` aprovado antes da execução.
- **Cobertura final:** `79 / 79` telas do menu mapeadas (`faltando: []`), `0` CNPJs e `0` CPFs nos JSONs/logs.
- **Artefatos atualizados no repositório:**
  - [pipeline/clube_mapa_telas.mjs](file:///c:/Users/vitorio.neto/Documents/Projetos%20IA/CEVEN%20v%C3%A1rias%20telas/pipeline/clube_mapa_telas.mjs)
  - [.github/workflows/clube-mapa-telas.yml](file:///c:/Users/vitorio.neto/Documents/Projetos%20IA/CEVEN%20v%C3%A1rias%20telas/.github/workflows/clube-mapa-telas.yml)
  - [docs/CLUBE_MAPA_COMPLETO.md](file:///c:/Users/vitorio.neto/Documents/Projetos%20IA/CEVEN%20v%C3%A1rias%20telas/docs/CLUBE_MAPA_COMPLETO.md)
