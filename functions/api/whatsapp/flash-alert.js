export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json().catch(() => ({}));
    const tipo = data.tipo || 'corte'; // 'corte' ou 'devolucao'
    const filial = (data.filial || 'TBL').toUpperCase();
    const numero = data.numero || '556696389884';

    let textoMensagem = '';

    if (tipo === 'corte') {
      const sku = data.sku || '847291 - BISCOITO MARILAN TORTINHAS 140G';
      const qtd = data.qtd || '48 CX';
      const valor = data.valor || 'R$ 3.840,00';
      const rcas = data.rcas || 'RCA 174, RCA 192, RCA 196';

      textoMensagem = `⚡ *CEVEN NOC · FLASH ALERT: CORTE DE CD (${filial})*
📅 Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}

✂️ *RUPTURA DETECTADA NA SEPARAÇÃO DO CD:*
• *Item / SKU:* ${sku}
• *Quantidade Cortada:* ${qtd}
• *Impacto Financeiro:* ${valor}
• *RCAs Afetados:* ${rcas}

🎯 *Ação Recomendada:* Oferecer item substituto imediatamente antes do faturamento final do pedido.`;
    } else if (tipo === 'bloqueado') {
      const totalHoje = data.total_hoje || 'R$ 94.310,00 (11 pedidos)';
      const totalAnt = data.total_ant || 'R$ 54.610,50 (7 pedidos)';
      const totalGeral = data.total_geral || 'R$ 148.920,50';

      textoMensagem = `🔒 *CEVEN NOC · ALERTA DE PEDIDOS BLOQUEADOS (${filial})*
📅 Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}

🚨 *TOTAL EM RISCO DE NÃO FATURAR:* ${totalGeral}

📌 *1. Bloqueados de Hoje:* ${totalHoje}
• Maior Bloqueio: RCA 198 (Luciano) · R$ 32.400,00 (Limite Excedido)
• RCA 174 (Bruno) · R$ 18.750,00 (Título Vencido)

⚠️ *2. Bloqueados de Dias Anteriores (+24h/+48h):* ${totalAnt}
• RCA 193 (Marieli) · R$ 24.500,00 (Aguardando Fiador)
• RCA 196 (Reginaldo) · R$ 16.890,00 (Boleto Protestado)

🎯 *Ação Imediata:* Cobrança com financeiro e RCA antes do corte noturno do Winthor (21h).`;
    } else {
      const nf = data.nf || '184920';
      const valor = data.valor || 'R$ 4.250,80';
      const cliente = data.cliente || 'SUPERMERCADO BOM PRECO LTDA';
      const rca = data.rca || 'RCA 193 - Marieli Brum';
      const motivo = data.motivo || '02 - Mercadoria em desacordo';

      textoMensagem = `💣 *CEVEN NOC · ALERTA DE DEVOLUÇÃO REGISTRADA (${filial})*
📅 Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}

🚨 *NOVA NOTA DE DEVOLUÇÃO IDENTIFICADA:*
• *NF:* ${nf} · *Valor:* ${valor}
• *Cliente:* ${cliente}
• *Vendedor Responsável:* ${rca}
• *Motivo Informado:* ${motivo}

🎯 *Ação Imediata:* Supervisão acionar RCA para renegociação e reemissão de pedido.`;
    }

    // Disparo Green-API
    const greenApiUrl = (env && env.GREEN_API_URL) || 'https://7107.api.greenapi.com';
    const greenIdInstance = (env && env.GREEN_ID_INSTANCE) || '710722724828';
    const greenToken = (env && env.GREEN_API_TOKEN) || '0206610482f54377a4161f6e7daf4866ee0bef8ac6c842b1bd';

    let digits = numero.replace(/\D/g, '');
    if (!digits.startsWith('55')) digits = `55${digits}`;

    let candidatePhones = [digits];
    if (digits.length === 13 && digits.startsWith('55')) {
      candidatePhones.push(digits.slice(0, 4) + digits.slice(5));
    }

    let statusEnvio = 'pronto';
    for (const phone of candidatePhones) {
      try {
        const sendUrl = `${greenApiUrl}/waInstance${greenIdInstance}/sendMessage/${greenToken}`;
        const res = await fetch(sendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: `${phone}@c.us`,
            message: textoMensagem
          })
        });
        if (res.ok) {
          const resJson = await res.json().catch(() => ({}));
          statusEnvio = `entregue (${phone} - id: ${resJson.idMessage || 'ok'})`;
        }
      } catch (e) {
        statusEnvio = 'erro: ' + e.message;
      }
    }

    return new Response(JSON.stringify({
      sucesso: true,
      tipo_evento: tipo,
      filial: filial,
      status: statusEnvio,
      mensagem: textoMensagem
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ sucesso: false, erro: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
