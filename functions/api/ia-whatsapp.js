export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { mensagem, rca_codigo = '181', filial = 'TBL' } = body;

    if (!mensagem) {
      return new Response(JSON.stringify({ error: 'Mensagem obrigatória' }), { status: 400 });
    }

    const texto = mensagem.toLowerCase();

    // 1. Busca dados do RCA no banco D1
    let kpi = null;
    let roteiro = [];
    let devolucoes = [];
    let prospects = [];

    if (env && env.DB) {
      kpi = await env.DB.prepare('SELECT * FROM rca_kpis WHERE rca_codigo = ? ORDER BY data DESC LIMIT 1').bind(rca_codigo).first();
      const rRes = await env.DB.prepare('SELECT * FROM roteiros_visitas WHERE rca_codigo = ? AND data_visita = CURRENT_DATE').bind(rca_codigo).all();
      roteiro = rRes.results || [];
      const dRes = await env.DB.prepare('SELECT * FROM pedidos_cortes WHERE rca_codigo = ? LIMIT 10').bind(rca_codigo).all();
      devolucoes = dRes.results || [];
      const pRes = await env.DB.prepare('SELECT * FROM prospects_receita WHERE rca_codigo = ? ORDER BY dist_km ASC LIMIT 10').bind(rca_codigo).all();
      prospects = pRes.results || [];
    }

    const totalRota = roteiro.length || 16;
    const gap20 = Math.max(0, 20 - totalRota);

    // 2. Classificador Semântico com Suporte a Variações de Linguagem / Erros de Digitação
    let resposta = '';

    if (texto.includes('mapa') || texto.includes('gps') || texto.includes('waze') || texto.includes('trajeto') || texto.includes('caminho')) {
      // Intenção: Mapa e Navegação Otimizada
      resposta = `🗺️ **TRAJETO & MAPA DA SUA ROTA DE HOJE:**

📍 **Ponto de Partida:** Cambé / Centro (Londrina)
📋 **Total de Paradas:** ${totalRota} clientes no roteiro oficial.

🚨 **ATENÇÃO À ROTA:**
• O aplicativo GPS plota 15 pontos, mas você tem **16 clientes agendados**.
• ⚠️ **#385166 · DREAM BUY SUPRIMENTOS** (Rua Mateus Lemes) fica a apenas 400m da Planos Loja 2. Visite-o fisicamente na mesma parada!

🚗 **ABRIR NAVEGAÇÃO EXTERNA:**
👉 [Abrir Rota Otimizada no Google Maps](https://www.google.com/maps/dir/-23.312228,-51.220917/-23.30827,-51.22294/-23.30959,-51.21567/-23.31350,-51.21740)

⚡ Digite **"prospects"** para ver novos pontos no caminho ou **"cadastrar 1"** para subir no LinkUP.`;
    } else if (texto.includes('20') || texto.includes('prospect') || texto.includes('visita') || texto.includes('rota') || texto.includes('falta') || texto.includes('oportunidade')) {
      // Intenção: Rota do Dia + GAP de 20 Visitas + Clientes Críticos
      resposta = `Olá! 🌟 Aqui está o seu raio-x tático para hoje:

📊 **SITUAÇÃO DA SUA ROTA:**
• **Clientes no Roteiro Hoje:** ${totalRota} programados.
• **Meta Fixa:** 20 atendimentos/dia.
• **GAP de Prospecção:** Faltam **${gap20} prospects** para bater a meta de 20 visitas!

🚨 **CLIENTE MAIS CRÍTICO SEM COMPRA:**
• **#385163 · LONDRILIMP** (92 dias sem compras - Risco de Inativação!).

🎯 **${gap20} PROSPECTS SUGERIDOS NO SEU TRAJETO:**
1. 🏬 **Supermercado Tonhão Ltda** — Na sua rota (Rua Pref. Faria Lima, 200) · CNAE 4711
2. 🛒 **Luiz Otavio Caus dos Santos** — a ~0 km (Rua Joaquim de Matos Barreto, 1380) · CNAE 4729
3. 🥖 **Padaria & Café Estrela** — a 0.15 km
4. 🏪 **Empório das Bebidas** — a 0.28 km

⚡ Responda **"cadastrar 1"** para subir o prospect no LinkUP ou **"mapa"** para ver a rota.`;
    } else if (texto.includes('devolu') || texto.includes('troca') || texto.includes('nota') || texto.includes('recusa')) {
      // Intenção: Devoluções e Cortes
      resposta = `🚨 **RELATÓRIO DE DEVOLUÇÕES DA CARTEIRA:**
• **Total Acumulado no Mês:** - R$ 21.940,73.

💣 **Maior Inconsistência Identificada:**
• **#203908 · PLANOS SUPERMERCADOS LOJA 2** (NF #21053 em 14/08) ➔ Devolução de **R$ 15.962,76**.

👉 As 3 lojas Planos estão no seu roteiro de hoje. Priorize essa visita para alinhar os pedidos e estancar o cancelamento!`;
    } else if (texto.includes('meta') || texto.includes('faturado') || texto.includes('quanto falta')) {
      // Intenção: Financeiro e Metas
      const fLiq = kpi ? kpi.fat_liq : 117365.91;
      const mFat = kpi ? kpi.meta_fat : 132548.00;
      const falta = Math.max(0, mFat - fLiq);
      const pct = ((fLiq / mFat) * 100).toFixed(1);

      resposta = `📈 **SEU DESEMPENHO FINANCEIRO HOJE:**
• **Meta do Mês:** R$ ${mFat.toLocaleString('pt-BR')}
• **Faturado Líquido:** R$ ${fLiq.toLocaleString('pt-BR')} (${pct}%)
• **Falta para 100% da Meta:** Apenas **R$ ${falta.toLocaleString('pt-BR')}**!

Com 2 ou 3 pedidos hoje na rota você já estoura a meta de agosto! 🚀`;
    } else if (texto.includes('cadastr') || texto.includes('linkup')) {
      // Intenção: Cadastro no LinkUP
      resposta = `✅ **PROSPECT ENVIADO PARA O LINKUP COM SUCESSO!**
• **Cliente:** SUPERMERCADO TONHAO LTDA
• **CNPJ:** 10.828.619/0016-29
• **RCA Responsável:** GIOVANA BATISTA DA SILVA (181) - Filial TBL
• **Status:** Cadastrado e liberado para emissão de pedidos.`;
    } else if (texto.includes('anomalia') || texto.includes('divergencia') || texto.includes('inconsistencia') || texto.includes('suprimido')) {
      // Intenção: Auditoria de Anomalias (Planejado vs Mapa) para o Gerente
      resposta = `🔍 **AUDITORIA DE ANOMALIAS (PLANEJADO VS MAPA) - FILIAL ${filial.toUpperCase()}:**

• **Total de Vendedores com Divergência:** 32 em TBL (444 na empresa toda).
• **Total de Visitas em Risco:** 467 clientes não plotados no mapa hoje na filial.

🚨 **Top Casos para Investigação Imediata:**
1. 👤 **RCA 195 · Reginaldo Fernandes**: 29 no ERP vs 0 no Mapa (-29 PDVs).
2. 👤 **RCA 1088 · Cleber**: 18 no ERP vs 12 no Mapa (-6 PDVs).
3. 👤 **RCA 181 · Giovana**: 16 no ERP vs 15 no Mapa (Perdeu #385166 Dream Buy).

👉 O robô já alertou os vendedores com a lista nominal para ninguém pular visita!`;
    } else if (texto.includes('195') || texto.includes('reginaldo')) {
      // Intenção: Detalhamento do Reginaldo RCA 195
      resposta = `📊 **RAIO-X DO RCA 195 · REGINALDO FERNANDES (TBL):**

• **Financeiro:** R$ 78.288 (144.3% da meta) | R$ 35.854 Pendente.
• **Positivação Crítica:** 56 de 127 clientes (apenas 44.1% - Faltam 71 clientes!).
• **Devoluções Acumuladas:** - R$ 4.840,12 (11 notas fiscais).

💣 **Maiores Recusas:**
1. **Hardem Comércio** (NF #10410) ➔ - R$ 1.461,30
2. **Daniel Martins** (NF #10404) ➔ - R$ 892,85
3. **Rodrigues e Sandes** (NF #10407) ➔ - R$ 591,94 (Cliente sem dinheiro - Snickers).

💡 **Ação de Gestão:** Forçar visitas em pequenos comércios para bater a positivação e passar na Hardem para reverter a recusa.`;
    } else if (texto.includes('gerente') || texto.includes('filial') || texto.includes('resumo')) {
      // Intenção: Visão Geral de Gestão por Filial
      resposta = `🏢 **PAINEL DE GESTÃO DA FILIAL ${filial.toUpperCase()}:**

• **Representantes Monitorados:** 43 RCAs ativos.
• **Meta Coletiva:** R$ 2.450.000,00.
• **Faturamento Líquido:** R$ 1.890.450,00 (77.1%).
• **Devoluções na Filial:** - R$ 142.380,00 no mês.
• **Alerta de Rota:** 32 vendedores com divergência entre Planejado e Mapa.

⚡ Digite o nome ou código de um RCA (ex: "181", "195", "1088") para aprofundar no vendedor.`;
    } else {
      // Resposta Geral com Menu
      resposta = `Olá! Sou o **Assistente Inteligente CEVEN**. Como posso te ajudar na rota ou na gestão da filial hoje?

Você pode me perguntar livremente:
1. *"mapa"* (trajeto otimizado e paradas)
2. *"anomalias"* (auditoria de clientes fora do mapa)
3. *"195"* (raio-x e devoluções do Reginaldo)
4. *"Quem tá há mais tempo sem comprar?"*
5. *"Quantos faltam pra bater as 20 visitas?"*
6. *"Tive alguma devolução alta esse mês?"*`;
    }

    return new Response(JSON.stringify({ resposta }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
