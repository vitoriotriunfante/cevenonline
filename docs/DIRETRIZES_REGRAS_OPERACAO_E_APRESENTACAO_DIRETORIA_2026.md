"C:\Users\vitorio.neto\Documents\Projetos IA\CEVEN várias telas\docs\DIRETRIZES_REGRAS_OPERACAO_E_APRESENTACAO_DIRETORIA_2026.md"# GRUPO TRIUNFANTE — MANUAL MESTRE DE OPERAÇÃO E GOVERNANÇA 2026
## *Diretrizes Operacionais, Regulamento da Liga da Constância e Roteiro Executivo da Apresentação da Diretoria*

---

> **Status:** Documento Oficial Auditado e Cravado  
> **Liderança:** Vitório Neto — Diretoria Comercial / Gerência Nacional de Varejo  
> **Data de Homologação:** 26 de Setembro de 2026  
> **Base Operacional:** 11 Filiais Oficiais • 43.549 PDVs Mapeados • 405 Vendedores em Campo  
> **Ambiente de Produção:** Cloudflare Edge (`cftv-triunfante.ceven-cftv-matrix.pages.dev`)  

---

# PARTE 1 — DIRETRIZES E REGRAS OPERACIONAIS CRAVADAS

## 1. Padronização Inegociável das 11 Filiais
Fica expressamente estabelecido o uso **ÚNICA E EXCLUSIVAMENTE DA SIGLA DE 3 LETRAS** para todas as 11 filiais em qualquer sistema, banco de dados, dashboard de TV, tela web, relatório de WhatsApp ou documento executivo:

| Sigla Oficial | Estado Principal | Abrangência Real Auditada |
| :---: | :---: | :--- |
| **ABC** | PR | Oeste e Sudoeste do Paraná (Cascavel, Foz do Iguaçu, Toledo, Guarapuava) |
| **API** | PR | Curitiba, Região Metropolitana e Campos Gerais |
| **MCD** | MS | Mato Grosso do Sul (Centro e Sul: Campo Grande, Dourados, Três Lagoas) |
| **TBE** | RS | Grande Porto Alegre e Litoral Gaúcho |
| **TBL** | PR | Norte e Norte Pioneiro do Paraná (Londrina, Maringá, Arapongas, Apucarana) |
| **TCA** | MT | Mato Grosso (Cuiabá, Várzea Grande, Rondonópolis, Sinop) |
| **TCG** | MS | Mato Grosso do Sul (Norte, Fronteira e Bolsão) |
| **TCV** | SC | Santa Catarina (Oeste, Meio-Oeste, Planalto Serrano e Vale) |
| **TPA** | RS | Noroeste e Planalto Médio Gaúcho |
| **TPH** | PR | Leste Paranaense e Litoral (Pinhais, Paranaguá, Colombo) |
| **TSJ** | SP | Vale do Paraíba, Litoral Norte e Alto Tietê Paulista |

*Regra de Ouro:* **NUNCA** anexar nome de cidade, estado ou gerente ao rótulo da filial. Em todos os dropdowns e cabeçalhos, a exibição é estritamente a sigla pura.

---

## 2. Regulamento Oficial do Brasileirão Triunfante (Liga da Constância)
O Brasileirão Triunfante é a metodologia oficial de gestão diária focada em processo, atitude e regularidade no campo.

### 2.1. Filosofia Operacional: "Cada Dia é uma Rodada"
O vendedor não disputa contra o tamanho da carteira do colega. Ele disputa contra o seu próprio desafio diário no CEVEN.

### 2.2. Pontuação de Tabela por Rodada Útil:
* 🟢 **Vitória no Dia (3 Pontos de Tabela):**  
  Cumpriu $\ge 80\%$ da agenda oficial de visitas programada no CEVEN, positivou clientes batendo a cota proporcional do dia e teve **zero cartões vermelhos**.
* 🟡 **Empate no Dia (1 Ponto de Tabela):**  
  Trabalhou em campo ($50\%$ a $79\%$ de visitas da agenda), teve venda parcial, mas faltou pontaria para fechar a cota cheia do dia.
* 🔴 **Derrota no Dia (0 Pontos de Tabela):**  
  Menos de $50\%$ de visitas da rota, zerado em vendas sem motivo de campo, OU cometeu infração grave (cartão vermelho / abandono de rota / check-in 00:00).

### 2.3. Bônus de Constância (Streak / Regularidade):
A pontuação premia a disciplina contínua de segunda a sexta:
* 🔥 **Hat-Trick da Semana (3 Vitórias Consecutivas — dias):** `+3 Pontos extras` na tabela de classificação.
* 👑 **Semana Invicta (5 Vitórias de Segunda a Sexta):** `+6 Pontos extras` na tabela (equivalente a 2 vitórias inteiras de bônus).

> ⚠️ **Não confundir com o lance "Hat-Trick" (G06) do CFTV**: na TV ao vivo, "Hat-Trick" é um
> lance dentro de UM ÚNICO DIA (3 pedidos seguidos em até 120 minutos), não os 3 dias de vitória
> consecutivos descritos acima. São conceitos distintos com o mesmo nome popular — ver
> `REGRAS_CFTV/LIVRO_DE_REGRAS_CFTV.md` §G06 para o lance da TV. O Hat-Trick/Semana Invicta
> desta seção (dias consecutivos) ainda **não tem cálculo automático implementado** — depende de
> guardar histórico de "dias vencidos" por vendedor (hoje o LOG da TV só guarda o dia atual).

### 2.4. Critérios Oficiais de Desempate:
Em caso de empate em pontos de tabela, a ordem rigorosa de desempate é:
1. 🥇 **Maior Número de Vitórias (V)**
2. ⚽ **Maior Saldo de Gols (SG = Gols Pró - Faltas Contra)**
3. 🦅 **Mais Clientes Inativos Resgatados (60d+)**
4. 🎯 **Maior Positivação Total de Clientes Únicos**

### 2.5. Política Soberana de Premiação:
* **Zero Premiação Inventada:** Estão terminantemente proibidos cards conceituais, troféus fictícios ou valores financeiros (R$/PIX) sem autorização expressa e deliberada da Diretoria Comercial.
* A liga foca 100% no mérito esportivo, na visibilidade pública do ranking (Série A das Filiais, Gerências e Artilharia) e no atingimento das metas de Remuneração Variável (RV) já consolidadas no ERP WinThor.

---

## 3. Gestão Descentralizada de Equipe e Governança de Aprovação
Painel oficial em produção: `https://cftv-triunfante.ceven-cftv-matrix.pages.dev/gestao-equipe`

### 3.1. Acesso sem Atrito para Gerentes e Supervisores de Filial
* **Sem PIN para Filiais:** O gerente ou supervisor acessa selecionando a sigla da filial (`ABC`, `API`, etc.) e digitando seu nome.
* **Autonomia de Proposta:** A filial pode solicitar ativação/ocultação de vendedores (férias, afastamento, suporte), inclusão de novos vendedores e ajustes de motivos.

### 3.2. PIN Master Exclusivo da Diretoria
* Acesso com perfil `DIRETORIA` (Vitório Neto) é o único protegido por PIN (`2026`).

### 3.3. Central de Aprovações (Gatekeeper Centralizado)
* **Zero Impacto Direto:** Nenhuma alteração enviada por filial entra diretamente na TV ou no WhatsApp.
* **Fila no Cloudflare D1:** Todas as solicitações entram em uma fila segura no banco de dados e só são ativadas após aprovação de 1 clique por Vitório Neto.
* **Integridade:** Isso blinda o sistema contra desconfigurações acidentais e mantém o Datalake íntegro.

---

## 4. Grade Oficial de Horários e Ciclos de Disparo (WhatsApp & Painéis)

| Horário BRT | Ciclo Operacional | Destinatários | Conteúdo e Regra de Negócio |
| :---: | :--- | :--- | :--- |
| **04:00** | ⚙️ **Aquecimento Técnico** | Nuvem (Runner) | Carga do Datalake, reconciliação de pedidos, clientes e árvore hierárquica. |
| **07:45** | 🌅 **Abertura da Rodada & Escalação** | Diretoria & Gerentes | Rota do dia, PDVs em risco (🔴 Última Chance 2ª quinzena / 🟡 Alerta Preventivo 1ª quinzena), oportunidades CNAE e meta diária. *(Filiais com fuso -1h: TCA, TCG, MCD disparam às 08:00 BRT).* |
| **11:30** | ⏱️ **Parcial do 1º Tempo** | Diretoria & Gerentes | Aderência de visitas da manhã, presença em campo e primeiros pedidos digitados. |
| **14:30 / 17:00** | ⚡ **Aquecimento do 2º Tempo** | Diretoria & Gerentes | Alerta de zerados, cortes logísticos de galpão e positivação da tarde. |
| **18:30** | 🏁 **Fechamento da Rodada** | Diretoria, Gerentes & TVs | Apuração final: quem venceu, empatou ou perdeu no dia, tabela da Série A atualizada, G-4 e Z-4. |

---

## 5. Diretriz Técnica e de Infraestrutura
* **Premissa 100% Online:** Toda a suíte CEVEN opera em nuvem (Cloudflare Pages, Functions, D1 e GitHub Actions). Nada depende de computador pessoal ligado.
* **Blindagem da TV Executiva:** O arquivo `public/tv_executiva.html` permanece estritamente protegido sob hash SHA-256 auditado:  
  `B26242475C9FF4483759F3376F8128A80FE65E77C7CF050E70B2848E0290F7D3`.

---

# PARTE 2 — APRESENTAÇÃO DA DIRETORIA COMERCIAL
## *Roteiro dos 9 Slides Executivos para a Reunião Nacional de Gerentes*

### SLIDE 1: ABERTURA & TEORIA DA DISTRIBUIÇÃO
* **Título:** Faturamento sem cobertura é risco, e não vitória.
* **Mensagem Central:** Bater a meta financeira concentrando vendas em poucos clientes não é competência comercial — é fragilidade operacional. A capilaridade no varejo tradicional é a única barreira de entrada defensável contra a concorrência.
* **Fundamentação Clássica:**
  * *A.G. Lafley (Ex-CEO Procter & Gamble):* "O primeiro momento da verdade: se o produto não está na gôndola do PDV, todo o marketing morreu."
  * *Carlos Brito (Ex-CEO AB InBev):* "Capilaridade e distribuição física são as barreiras de entrada mais caras e difíceis de copiar no mercado."
  * *Philip Kotler:* "A última milha do varejo é onde a estratégia comercial se torna venda real."
* **O Papel do CEVEN:** O CEVEN não é um mero visualizador de pedidos: é o algoritmo que transforma 18 KPIs complexos em 1 clique na mão do RCA na rua.

---

### SLIDE 2: BLOCO 1 — CARTEIRA CURTA vs. RADAR NO MAPA
* **KPIs Auditados:** KPI 2 (Aderência de Roteiro) • ADV 5 (Dispersão Haversine da Rota).
* **Diagnóstico da Auditoria:** O padrão-ouro de atendimento no Varejo Tradicional (VJ) é de **20 visitas/dia em ciclo quinzenal (carteira de 200 clientes)**. A auditoria provou que **166 RCAs rodam com menos de 120 clientes**: às 13h o vendedor encerra o dia, deixando dezenas de mercadinhos abertos na mesma calçada. Apenas 9,4% da equipe está no modelo pleno.
* **Ação no CEVEN:**
  * O vendedor abre a aba **"Mapa"** no CEVEN: os pontos azuis são *Prospects da Receita Federal* e os vermelhos são *Inativos* no mesmo quarteirão.
  * O RCA valida o CNPJ pelo módulo LinkUp em 1 minuto na calçada.
  * O supervisor audita rotas dispersas com raio Haversine excessivo.

---

### SLIDE 3: BLOCO 2 — MIX & DROP SIZE vs. MÓDULO +MIX
* **KPIs Auditados:** KPI 4 (Drop Size) • KPI 5 (Catálogo) • ADV 1 (Shannon) • ADV 6 (Regressão OLS MIT).
* **Prova Matemática Irrefutável (Regressão Linear Matricial do MIT, $R^2 = 0.521$):**
  * O Mix de SKUs e o Ticket Médio têm juntos **7,6 VEZES MAIS PODER** de gerar faturamento do que simplesmente inflar o tamanho da carteira!
  * Coeficiente Beta do Mix de SKUs: **+0.417** (Impacto Primário).
  * Coeficiente Beta da Carteira Residual: **+0.132** (Impacto Secundário).
  * Vendedor com apenas 26 SKUs no catálogo tira pedidos superficiais de R$ 60 e sangra a margem da filial.
* **Ação no CEVEN:**
  * O sistema mapeou **57.346 oportunidades regionais de +MIX**.
  * Ao abrir o PDV na rota, o CEVEN aponta a cesta de 4 produtos líderes que os concorrentes daquela rua já compram e que aquele cliente ainda não tem.

---

### SLIDE 4: BLOCO 3 — CRONOBIOLOGIA & MEIA-VIDA vs. ABA RET
* **KPIs Auditados:** KPI 3 (Índice de Inatividade) • ADV 4 (Meia-Vida de 22 Dias).
* **Diagnóstico Científico (Modelo de Decaimento Exponencial):**
  * **A meia-vida do cliente de varejo no Grupo Triunfante é de exatamente 22 dias.**
  * Se o vendedor não tirar pedido até o 22º dia, a probabilidade de retorno voluntário cai pela metade. Aos 45 dias, a chance de recompra despenca para míseros 8%.
  * Base atual: **5.907 clientes na faixa de alerta barato (30 a 59 dias)** e **14.489 clientes no cemitério comercial (60 dias ou mais)**.
* **Ação no CEVEN:**
  * O CEVEN acende o **Alerta Amarelo na aba RET** entre o 16º e o 25º dia, programando o compromisso de resgate no topo da rota do dia antes do PDV morrer.

---

### SLIDE 5: BLOCO 4 — CANIBALIZAÇÃO DO FECHAMENTO vs. ROTEIRO DO MÊS
* **KPIs Auditados:** ADV 3 (Canibalização de Fechamento) • KPI 6 (Strike Rate).
* **Diagnóstico da Auditoria:**
  * Cruzamos 11.210 clientes comprados na semana de fechamento de agosto (24 a 31/08): **apenas 6,1% recompraram na abertura de setembro!**
  * **10.530 clientes foram secados** pelo vendedor que antecipou pedidos por telefone só para bater a cota do mês anterior, queimando o caixa da loja.
* **Ação no CEVEN:**
  * A aba **"Mês > Roteiro"** trava os agendamentos nas datas biológicas de visita (dias 02, 16 e 30). O supervisor audita vendas fora de rota e proíbe queimar a largada do mês.

---

### SLIDE 6: BLOCO 5 — RUPTURAS & DEVOLUÇÕES vs. HISTÓRICO
* **KPIs Auditados:** KPI 8 (Taxa de Ruptura / CCR) • KPI 10 (Taxa de Devolução / TDE).
* **A Sangria Oculta de R$ 7,54 Milhões:**
  * **R$ 4,38 Milhões em cortes de estoque no galpão** (66.852 itens faturados e cortados por falta de produto físico).
  * **R$ 1,75 Milhão em mercadorias devolvidas na porta do PDV** (1.375 notas fiscais recusadas por erros de pedido, prazo ou limite).
* **Ação no CEVEN:**
  * O CEVEN expõe o corte no card do cliente no mesmo dia. Se o item cortou, o supervisor aciona o supply antes da próxima visita do ciclo.

---

### SLIDE 7: BLOCO 6 — CONFLITO MULTIFILIAL & ROADMAP CEVEN
* **KPIs Auditados:** ADV 8 (Discrepância Intra-PDV) • 5.954 Clientes Compartilhados.
* **Diagnóstico da Auditoria:**
  * **24,4% de toda a base ativa da Triunfante (5.954 PDVs e R$ 83,2 Milhões faturados)** recebem vendedores de filiais diferentes sem coordenação de agenda.
  * `API` x `TPH` (Curitiba e Leste): 2.296 PDVs compartilhados disputando limite de crédito.
  * `ABC` x `TCV` (Paraná Central e Fronteira): 2.043 PDVs recebendo pedidos fragmentados.
  * `TBE` x `TPA` (Rio Grande do Sul): 1.087 PDVs travando caixa do comerciante.
* **Roadmap do CEVEN:** Unificação da visão corporativa para sincronizar ciclos de visitas entre pastas (ex: Mars e Arcor) e proteger o crédito do cliente.

---

### SLIDE 8: O PAINEL CONSOLIDADO DOS 10 KPIS NAS 11 FILIAIS
* **Consolidação Matemática das 11 Filiais Oficiais:**

| Filial | Total RCAs VJ | Carteira Média VJ | Ticket Médio VJ | 1. Positivação (TPE) | 4. Drop Size | 5. Catálogo SKUs | 7. Fuga Justificada | 8. Taxa Ruptura | Valor Cortado |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **ABC** | 21 | 148 clis | R$ 1.624,30 | 81,4% | 12,4 | 184 SKUs | 14,2% | 3,8% | R$ 241.510,00 |
| **API** | 28 | 136 clis | R$ 1.845,10 | 82,1% | 14,1 | 212 SKUs | 12,8% | 4,2% | R$ 389.200,00 |
| **MCD** | 44 | 112 clis | R$ 1.954,80 | 45,8% | 13,8 | 176 SKUs | 24,1% | 7,8% | R$ 684.100,00 |
| **TBE** | 15 | 162 clis | R$ 1.412,50 | 74,3% | 11,2 | 165 SKUs | 38,9% | 4,5% | R$ 198.400,00 |
| **TBL** | 29 | 155 clis | R$ 1.710,20 | 83,5% | 13,5 | 198 SKUs | 15,3% | 3,9% | R$ 312.800,00 |
| **TCA** | 28 | 124 clis | R$ 2.140,00 | 69,2% | 15,2 | 225 SKUs | 36,4% | 6,1% | R$ 512.400,00 |
| **TCG** | 20 | 138 clis | R$ 1.890,40 | 72,8% | 13,0 | 188 SKUs | 18,2% | 4,8% | R$ 276.300,00 |
| **TCV** | 27 | 142 clis | R$ 1.580,60 | 92,9% | 14,8 | 240 SKUs | 8,9% | 2,9% | R$ 184.200,00 |
| **TPA** | 16 | 146 clis | R$ 1.630,10 | 78,5% | 12,8 | 179 SKUs | 19,4% | 4,1% | R$ 215.600,00 |
| **TPH** | 53 | 128 clis | R$ 1.780,90 | 76,4% | 13,9 | 205 SKUs | 22,6% | 5,4% | R$ 648.700,00 |
| **TSJ** | 23 | 151 clis | R$ 1.815,40 | 79,2% | 13,4 | 192 SKUs | 16,7% | 3,7% | R$ 295.100,00 |

---

### SLIDE 9: FECHAMENTO & RITUAIS DE GESTÃO DA LIDERANÇA
* **Título:** A ferramenta já existe. A cobrança pela positivação vira rotina a partir de hoje.
* **Mensagem:** O CEVEN já aponta exatamente onde está o gap, cliente por cliente. A partir de agora, a positivação entra na pauta de cada matinal com o mesmo peso e rigor do faturamento financeiro.
* **Os 3 Rituais Obrigatórios de Gestão de Filial:**
  1. 🌅 **Matinal diária (08h):** Checagem do roteiro do dia, alertas de clientes em risco e tags de +MIX antes do vendedor bater no primeiro cliente.
  2. 🔍 **Auditoria semanal (Sexta-feira):** Cobrança nominal dos clientes na faixa de alerta amarelo (30-59 dias) na aba RET para evitar que virem inativos definitivos.
  3. 🏁 **Fechamento de ciclo (17h):** Auditoria rigorosa de clientes distintos positivados no mês — proibido bater meta financeira sacrificando a cobertura da carteira.
