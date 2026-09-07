export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json().catch(() => ({}));
    const numero = data.numero || '5566996389884';
    const filial = data.filial || 'TBL';
    const gerente = data.gerente || 'Vitório Neto';

    const textoMensagem = `🟢 *CEVEN NOC · TESTE DE CONEXÃO WHATSAPP*

👋 Olá, *${gerente}*!
Você foi cadastrado como *Gerente da Filial ${filial}* no sistema de monitoramento inteligente do CEVEN.

✅ *Status:* Conexão Ativa e Operacional
📅 *Data/Hora:* 31/08/2026 às 19:50
📍 *Filial:* ${filial}

🔔 *Você receberá automaticamente neste canal:*
1️⃣ *08:00* 🌅 Resumo de Abertura (Metas & Roteiros do Dia)
2️⃣ *10:00* ⚠️ Alerta de Vendedores Zerados (Acompanhamento Manhã)
3️⃣ *12:00* 🍽️ Parcial de Almoço (Positivação & Ritmo de Vendas)
4️⃣ *14:00* 🚨 Alerta Crítico de Vendedores Zerados (Intervenção Tarde)
5️⃣ *18:30* 🌙 Fechamento Diário Consolidado (Faturamento, Devoluções & Top RCAs)

_Mensagem automática gerada pelo CEVEN NOC Intelligence Matrix._`;

    const encodedText = encodeURIComponent(textoMensagem);
    const whatsappWebLink = `https://api.whatsapp.com/send?phone=${numero.replace(/\D/g, '')}&text=${encodedText}`;

    // 2. Disparo Imediato via Green-API Cloud Gateway
    const greenApiUrl = (env && env.GREEN_API_URL) || 'https://7107.api.greenapi.com';
    const greenIdInstance = (env && env.GREEN_ID_INSTANCE) || '710722724828';
    const greenToken = (env && env.GREEN_API_TOKEN) || '0206610482f54377a4161f6e7daf4866ee0bef8ac6c842b1bd';

    let gatewayStatus = 'ready';
    let digits = numero.replace(/\D/g, '');
    if (!digits.startsWith('55')) digits = `55${digits}`;

    // Normaliza para o formato JID do WhatsApp (tenta com e sem o 9 no DDD)
    let candidatePhones = [digits];
    if (digits.length === 13 && digits.startsWith('55')) {
      // Ex: 5566996389884 -> 556696389884
      candidatePhones.push(digits.slice(0, 4) + digits.slice(5));
    }

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
          gatewayStatus = `entregue_green_api (${phone} - id: ${resJson.idMessage || 'ok'})`;
        }
      } catch (e) {
        gatewayStatus = 'erro: ' + e.message;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      status: gatewayStatus,
      numero: numero,
      filial: filial,
      gerente: gerente,
      mensagem: textoMensagem,
      whatsapp_link: whatsappWebLink
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
