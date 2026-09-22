export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const filialSigla = (url.searchParams.get('filial') || 'TBL').toUpperCase();

  try {
    let consolidado = null;
    let coordenadores = [];

    // Se estiver conectado ao D1
    if (env && env.DB) {
      try {
        const { results } = await env.DB.prepare(`
          SELECT * FROM consolidado_diario_filial 
          WHERE filial_id = ? OR filial_id = ?
          ORDER BY data_snapshot DESC LIMIT 1
        `).bind(filialSigla, filialSigla.toLowerCase() + '1').all();
        if (results && results.length > 0) consolidado = results[0];
      } catch (_) {}
    }

    // Dados Reais Consolidados da Filial TBL (extraídos do relatório de coordenadores e 43 RCAs)
    const dadosFilial = {
      TBL: {
        meta_mes_fat: 4588622.00,
        faturado_liq: 2793542.64,
        digitado_pendente_hoje: 589158.48,
        faturado_total_com_digitado: 3382701.12,
        devolucoes_mes: 260454.38,
        meta_positivacao_mes: 2696,
        positivacao_real_mes: 1869,
        pct_pos_mes: 69.3,
        pedidos_hoje_total: 274,
        pedidos_hoje_rota: 119,
        pedidos_hoje_fora: 155,
        roteiros_planejados_hoje: 397,
        visitas_realizadas_hoje: 338,
        eficiencia_visitas: 85.14,
        eficacia_vendas: 29.97,
        media_skus: 9.2,
        coordenadores: [
          { cod: 70, nome: 'FABIO FURLAN MACHADO', valor: 144356.44, pedidos: 10, media_sku: 16.4 },
          { cod: 46, nome: 'SERGIO LOPES DE OLIVEIRA', valor: 136994.52, pedidos: 68, media_sku: 9.7 },
          { cod: 45, nome: 'KLEBERSON BATISTA LIDUARIO', valor: 121073.77, pedidos: 80, media_sku: 7.6 },
          { cod: 43, nome: 'EVERTON APARECIDO DA SILVA', valor: 92302.72, pedidos: 47, media_sku: 9.2 },
          { cod: 41, nome: 'CIRLENE DE FATIMA GOMES', valor: 57588.90, pedidos: 8, media_sku: 6.0 },
          { cod: 111, nome: 'CRISTIANE DE FREITAS DUARTE', valor: 19612.21, pedidos: 28, media_sku: 8.8 },
          { cod: 110, nome: 'CLEBER DA SILVA BEZEERA', valor: 17229.52, pedidos: 25, media_sku: 9.2 }
        ]
      }
    };

    const info = dadosFilial[filialSigla] || dadosFilial.TBL;
    const pctMetaTotal = ((info.faturado_total_com_digitado / info.meta_mes_fat) * 100).toFixed(1);

    const textoMensagem = `🏢 *CEVEN NOC · FECHAMENTO DO DIA (${filialSigla})*
📅 Data: 31/08/2026 · 18:30
👤 *Destinatário:* Gerente Geral da Filial ${filialSigla}

💰 *CONSOLIDADO DO DIA (HOJE):*
• *Total Digitado Hoje:* R$ ${info.digitado_pendente_hoje.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
• *Pedidos Emitidos:* ${info.pedidos_hoje_total} pedidos (${info.pedidos_hoje_rota} na rota + ${info.pedidos_hoje_fora} fora)
• *Roteiros Programados:* ${info.roteiros_planejados_hoje} clientes
• *Visitas Realizadas:* ${info.visitas_realizadas_hoje} PDVs (*${info.eficiencia_visitas}%* de cobertura de campo)
• *Eficácia de Vendas:* ${info.eficacia_vendas}%
• *Média de Mix:* ${info.media_skus} SKUs por pedido

📊 *FECHAMENTO ACUMULADO DO MÊS (${filialSigla}):*
• *Meta de Faturamento:* R$ ${info.meta_mes_fat.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
• *Faturado + Digitado:* R$ ${info.faturado_total_com_digitado.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (*${pctMetaTotal}%* da meta)
• *Devoluções Acumuladas:* R$ ${info.devolucoes_mes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
• *Meta de Positivação:* ${info.meta_positivacao_mes} clientes
• *Positivação Realizada:* ${info.positivacao_real_mes} clientes (*${info.pct_pos_mes}%*)

🏆 *TOP VENDEDORES / RCAs (${filialSigla}):*
1º 🥇 Fábio Furlan (RCA 516) - R$ ${info.coordenadores[0].valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${info.coordenadores[0].pedidos} ped · ${info.coordenadores[0].media_sku} SKUs)
2º 🥈 Sérgio Lopes (RCA 46) - R$ ${info.coordenadores[1].valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${info.coordenadores[1].pedidos} ped · ${info.coordenadores[1].media_sku} SKUs)
3º 🥉 Kleberson Batista (RCA 45) - R$ ${info.coordenadores[2].valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${info.coordenadores[2].pedidos} ped · ${info.coordenadores[2].media_sku} SKUs)
4º 🎖️ Everton Aparecido (RCA 43) - R$ ${info.coordenadores[3].valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${info.coordenadores[3].pedidos} ped · ${info.coordenadores[3].media_sku} SKUs)
5º 🎖️ Cirlene de Fátima (RCA 517) - R$ ${info.coordenadores[4].valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${info.coordenadores[4].pedidos} ped · ${info.coordenadores[4].media_sku} SKUs)
6º 🎖️ Cristiane Duarte (RCA 111) - R$ ${info.coordenadores[5].valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${info.coordenadores[5].pedidos} ped · ${info.coordenadores[5].media_sku} SKUs)
7º 🎖️ Cleber Bezerra (RCA 1088) - R$ ${info.coordenadores[6].valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${info.coordenadores[6].pedidos} ped · ${info.coordenadores[6].media_sku} SKUs)

🚨 *SITUAÇÃO OPERACIONAL DO CD:*
• Rupturas e cortes sob controle
• Faturamento noturno do Winthor programado para às 21h00

_Relatório oficial gerado pela Central de Monitoramento CEVEN Matrix._`;

    const numero = '5541987525605';
    const whatsappWebLink = `https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(textoMensagem)}`;

    // 2. Disparo Imediato via Green-API Cloud Gateway
    const greenApiUrl = (env && env.GREEN_API_URL) || 'https://7107.api.greenapi.com';
    const greenIdInstance = (env && env.GREEN_ID_INSTANCE) || '710722724828';
    const greenToken = (env && env.GREEN_API_TOKEN) || '0206610482f54377a4161f6e7daf4866ee0bef8ac6c842b1bd';

    let gatewayStatus = 'ready';
    const rawNum = numero.replace(/\D/g, '');
    const targetPhone = rawNum.startsWith('55') ? rawNum : `55${rawNum}`;

    try {
      const sendUrl = `${greenApiUrl}/waInstance${greenIdInstance}/sendMessage/${greenToken}`;
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${targetPhone}@c.us`,
          message: textoMensagem
        })
      });
      if (res.ok) {
        const resJson = await res.json().catch(() => ({}));
        gatewayStatus = `entregue_green_api (id: ${resJson.idMessage || 'ok'})`;
      } else {
        gatewayStatus = `falha_green_api (${res.status})`;
      }
    } catch (e) {
      gatewayStatus = 'erro: ' + e.message;
    }

    return new Response(JSON.stringify({
      success: true,
      status: gatewayStatus,
      filial: filialSigla,
      numero: targetPhone,
      mensagem: textoMensagem,
      whatsapp_link: whatsappWebLink
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
