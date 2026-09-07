# 📚 BANCO DE PERGUNTAS E RESPOSTAS PRÉ-PRONTAS (FAQ CEVEN)
> **Mapeamento Contínuo e Automático de todas as perguntas, filtros e regras comerciais reais do usuário.**
> **Última Atualização:** 01/09/2026 14:23 (Inclusão do Módulo de CNAE, Inteligência de Mapa e Cruzamento de Prospects)

---

## 🎯 REGRAS DE OURO MANDATÓRIAS (MEMÓRIA PERMANENTE)
1. **Identidade das 11 Filiais Oficiais:** `ABC`, `TCV`, `API`, `TPH`, `TBL`, `TCA`, `MCD`, `TCG`, `TBE`, `TPA`, `TSJ`. Nunca agrupar por cidade/região geográfica.
2. **Autoridade de Vendedores:** Consultar estritamente o arquivo `representantes (7).csv`.
3. **Expurgo de Fantasmas/Supervisores:** Vendedores com 0 visitas na rota do dia E sem vendas no dia são expurgados da contagem de "sem venda".
4. **Visitas em Andamento (Regra de Não Distorção):**
   - No meio do dia (parciais das 10h, 12h, 14h), **SEMPRE** separar:
     * **Visitas Programadas (Dia Todo)**
     * **Visitas Já Realizadas (Manhã)**
     * **Visitas Pendentes (Tarde)**
     * **Visitas Convertidas em Venda**
     * **Taxa de Conversão Real** = `(Convertidas / Realizadas)` *(a taxa justa sobre o que já foi atendido)*
     * **Progresso da Rota** = `(Realizadas / Programadas)`
5. **Inteligência de CNAE & Mapa:** O CEVEN cruza os clientes da rota com os CNAEs da Receita Federal para:
   - Identificar a **Família de CNAE** (ex: 4712 - Minimercados, 4721 - Padarias/Doces, 4771 - Farmácias, 4789 - Pet Shops).
   - Indicar **prospects com alta aderência geográfica** na rota do RCA com base nos CNAEs que ele já atende com sucesso.
   - Recomendar o **Mix de Produtos com Maior Giro** para cada família de CNAE.
6. **Terminologia Comercial:** 
   - Nunca usar "inativos" para clientes sem compra recente. Usar **"Clientes sem compra a mais de 30 dias"**.
   - Nunca usar "positivação" genericamente. Usar **"Quantidade de Pedidos / Clientes Distintos"**.
7. **Formato de Tempo:** `HH:MM` (`00:48` = 48 minutos, `00:08` = 8 minutos, `01:12` = 1 hora e 12 minutos).
8. **Padrão Obrigatório de +MIX:** Citar o que o cliente parou de comprar + oportunidade de +MIX com pelo menos 2 clientes vizinhos reais compradores e o % de penetração.
9. **Formatação WhatsApp:** Quebras de linha duplas (`\n\n`), emojis estratégicos e blocos limpos sem tabelas colapsadas.

---

# 📑 CATEGORIAS DO BANCO DE PERGUNTAS

---

## 🗺️ PILAR 7: CNAE, Inteligência de Mapa e Cruzamento de Prospects

### ❓ P7.1: "No próprio CEVEN nós conseguimos buscar os CNAEs dos clientes? Na aba mapa ele cruza os prospects com os CNAEs?"
* **Resposta & Mecânica:**
  - **Sim, exatamente.** O CEVEN possui a base cadastral de clientes e prospects com os seguintes campos:
    * `cnae`: Código oficial da Receita Federal (ex: `4712100`, `4721104`, `4771701`).
    * `cnae_desc`: Descrição do ramo (ex: *"Minimercados, mercearias e armazéns"*, *"Comércio varejista de doces e bombons"*, *"Comércio varejista de produtos farmacêuticos"*).
    * `familia_cnae`: Raiz de 4 dígitos (ex: `4712`, `4721`).
  - **Como o Mapa do CEVEN cruza:**
    1. **Identificação do Perfil da Rota:** O CEVEN analisa os clientes que o RCA visita hoje. Se ele atende 5 clientes da família `4712` (Mercearias), o sistema busca na base de dados todos os comércios da mesma família no raio geográfico da rota (`dist_km`).
    2. **Cálculo de Aderência:** O sistema marca o motivo da recomendação: *"Você atende X cliente(s) da família CNAE 4712 neste roteiro"*.
    3. **Sugestão de Mix por CNAE:** Sugere os 3 produtos líderes de venda para aquele CNAE específico (ex: Mars/Snickers em docerias e farmácias; Esponjas 3M e Magic Toast em minimercados).
