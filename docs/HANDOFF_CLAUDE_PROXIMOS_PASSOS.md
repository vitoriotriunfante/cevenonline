# 📋 DOSSIÊ EXECUTIVO DE HANDOFF: O QUE ESTÁ FEITO, O QUE FALTA E GARGALOS PARA O CLAUDE

> **Data de Fechamento:** 09/11/2026  
> **Objetivo:** Documento mestre estruturado e sem ruído para colar diretamente no Claude (ou outra IA) e dar continuidade aos desenvolvimentos e correções prioritárias do ecossistema Triunfante (CEVEN, Jota WhatsApp, GEROT e Champions).

---

## 🎯 1. VISÃO GERAL DO AMBIENTE & REGRAS INEGOCIÁVEIS DO VITÓRIO

1. **Premissa 100% Online:**
   - Nada roda no PC local de forma perene. Banco de dados oficial de produção é o **Cloudflare D1 (`ceven_noc_d1`)** e nuvem **Cloudflare Pages/Functions**.
2. **Formatação Executiva de Mensagens do Jota (WhatsApp):**
   - **Assunto novo = linha nova** (espaçamento limpo, sem blocos densos de texto).
   - **Meta vs Real sempre explícito** (número com chão, sem jargão matemático como "média ponderada").
   - **Listas SEMPRE numeradas com índices (1, 2, 3...)**, NUNCA marcadores soltos (`•`), acompanhadas de atalho no rodapé:  
     `👉 Digite o número (ex.: 1) para ver a ficha/detalhe.`
   - **Zero SPAM e Zero envio em massa:** Apenas mensagens receptivas e reenvios pontuais autorizados.
3. **Restrição Absoluta de Contratos por Praça:**
   - Nunca assumir indústrias para uma filial sem checar `config/catalogo_produtos_por_filial.json`.  
   - Exemplo clássico de erro: **TPA NÃO VENDE** Ypê, SC Johnson, Marilan, Mondelez ou Mars. Vende exclusivamente Colgate (carro-chefe), MP Triunfante, EBBA, Super Foods, Sakura, Hero/Queensberry, Medix, Fantoni/Stolfi, Super Saúde, e os novos contratos de Novembro (**Bombril** e **Philips/Envision**).

---

## 🟢 2. O QUE JÁ FOI CONCLUÍDO (STATUS CONSOLIDADO)

1. **Extração Histórica Completa do GEROT:**
   - Realizada a raspagem histórica em filigrama dos meses fechados (**Agosto, Setembro, Outubro/2026**) e dinâmico (**Novembro/2026**).
   - Arquivos JSON salvos em `pipeline/gerot_consolidado/`.
   - Migration `0010_gerot_consolidado_historico.sql` e tabelas criadas no D1:
     - `gerot_historico_industrias`
     - `gerot_historico_filiais`
     - `gerot_historico_supervisores`
2. **Dicionário Comercial de Marcas / Indústrias:**
   - Implementado em `pipeline/dicionario_industrias.js` mapeando gírias e marcas comerciais reais (ex.: *Baly, MP, Ypê, Mars, Mondelez, Ferrero, Bombril, Philips/Envision*) para suas razões sociais do ERP/GEROT.
3. **Apresentações para as Indústrias (Markdown Gerado):**
   - Criados os 3 arquivos objetivos em `docs/apresentacoes_industria/`:
     - `01_CEVEN_FUNCIONALIDADES_VENDAS.md` (3 slides: Força de campo, Positivação/Cortes, Mix/Prospecção).
     - `02_JOTA_IA_AUMENTO_VENDAS.md` (2 slides: Colega de vendas no WhatsApp, Aceleração de metas).
     - `03_CHAMPIONS_LIGA_DA_CONSTANCIA.md` (3 slides: Cada dia é uma rodada, Lances esportivos, Engajamento).

---

## 🔴 3. O QUE DEU ERRADO NAS ÚLTIMAS MENSAGENS & GARGALOS CRÍTICOS DO JOTA

Durante os testes reais via WhatsApp, o Jota divagou e respondeu incorretamente / caiu em treinamento nas seguintes situações:

### Gargalo 1: Falha em "Prospecção TCV 352" / "Prospect do Dia"
- **O que aconteceu:** O Jota respondeu: *"Estou em treinamento e ainda não sei responder isso"*.
- **Causa Raiz 1 (Bug de Código):** Em `functions/_lib/jota/respostas/segmentos_pastas.js`, a função `hojeSP()` era chamada na linha 340 mas **não estava no import** (`ReferenceError: hojeSP is not defined`), estourando exceção silenciosa capturada pelo catch de fallback.
- **Causa Raiz 2 (Reconhecimento do Vendedor):** O regex em `escopo.js` não tratava expressões como `TCV 352` ou `ROTA TCV 352` como explícitas, descartando o RCA `352 (Tamara Guedes)` e achando que era pergunta da filial `TCV`.
- **Causa Raiz 3 (Vendedor com nomes repetidos na filial):** Em TBE, existem dois Eduardos (`285 Eduardo Pereira` e `293 Eduardo Germano`). Ao perguntar `"prospects do vendedor Eduardo de TBE"`, o sistema empatava e abortava. Se a mensagem vem do próprio vendedor (`c.rca = 285`), o Jota precisa usar o RCA dele direto sem desempate.

### Gargalo 2: Resposta de Rota Geral em vez de Rota do Vendedor E Falta de Índices
- **O que aconteceu:** Ao digitar `"Rota tcv 352"`, o Jota respondeu com o consolidado da filial TCV (`Digitado: R$ 23.446 em 49 pedidos...`) com bolinhas (`•`), sem trazer a rota de clientes da vendedora Tamara Guedes e sem numeração de atalho.
- **Causa Raiz:** O regex de `hojeRota` em `entende.js` (linha 906) não capturava comandos curtos que iniciam com `ROTA <filial> <rca>`.

### Gargalo 3: Sincronização da Base do Mapa de Prospects no D1
- **Cenário:** O app mobile do CEVEN (Tela 3 - Mapa) possui 45 prospects geocodificados da Receita Federal (ex.: *Gloor Comércio de Alimentos*, *Bazar Rodrigues*).
- **Problema:** A tabela `prospects_mapa` e `prospects_coleta_status` no D1 dependem da carga do arquivo `analises/pedidos_historico_ceven.db` executada pelo script `scripts/carregar_ficha_d1.py`. Se o status não for `ok` para o dia de hoje (`hojeSP()`), o Jota trava e recusa passar a lista.

---

## 📌 4. CHECKLIST DO QUE O CLAUDE DEVE EXECUTAR / FINALIZAR

### Tarefa 1: Resolver o Lock Pendente do Git no Workspace
- O repositório local ficou com um revert travado e com um arquivo de trava (`.git/index.stash.42372.lock` ou pendência de revert).
- É necessário rodar `git revert --abort` ou destravar o índice para permitir novos commits limpos das alterações de `functions/_lib/jota/`.

### Tarefa 2: Consolidar os Patches no Motor do Jota
1. **`functions/_lib/jota/respostas/segmentos_pastas.js`**:
   - Garantir import de `hojeSP` de `../base.js`.
   - Se o usuário for vendedor cadastrado (`c.papel === 'vendedor'`), puxar diretamente `c.rca` e `c.filial` para ler os prospects do mapa daquele RCA, sem cair no fluxo de desempate.
2. **`functions/_lib/jota/escopo.js`**:
   - Manter no loop de números o regex explícito com `FRX` (reconhecendo `TCV 352`, `TBE 285`, `ROTA 352`, `PROSPECÇÃO 352`).
3. **`functions/_lib/jota/respostas/rota.js` e `resumo.js`**:
   - Garantir numeração sequencial obrigatória (`1.`, `2.`, `3.`) em todas as listas de rota e de vendedores do dia, acompanhada do call-to-action:
     `👉 Digite o número (ex.: 1) para abrir a ficha do cliente (+MIX).`
4. **`functions/api/whatsapp/bot.js`**:
   - Garantir que a chamada de `responderPerguntaGerotIndustria(env, texto, c)` não tenha declarações duplicadas e consulte o D1 imutável do GEROT para as 11 filiais.

### Tarefa 3: Responder o Rudinei Rizatti (Pendente da Semana Passada)
- Rudinei (celular `555181697377`) perguntou sobre a performance de indústrias em **TPA**.
- Responder no padrão calibrado com as marcas reais de TPA:
  - Carro-chefe: **Colgate-Palmolive**, **MP (Marcas Próprias Triunfante)**, **EBBA (Maguary/Dafruta)**, **Super Foods**, **Sakura**, etc.
  - Novos contratos da semana: **Philips (Envision)** e **Bombril** (reportar se já houve digitação ou abertura de carteira na semana).
- Enviar de forma única e sem SPAM via endpoint `/api/jota-reenviar`.

### Tarefa 4: Conceder mesmo acesso do Gerente Diego (TBE) para o seu Analista
- Número do analista: `+55 51 9519-0122` (cadastrar em `bot_contatos` com as mesmas permissões do Gerente Diego de TBE).

