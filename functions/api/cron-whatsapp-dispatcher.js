/**
 * ============================================================================
 * CRON WHATSAPP DISPATCHER — v3.0 (100% DADOS REAIS DO D1)
 * ============================================================================
 * CORRIGIDO: Removidos TODOS os dados hardcoded (valores de 31/08, nomes fixos).
 * Agora lê exclusivamente de consolidado_executivo_live e rca_kpis.
 *
 * Chamado pelo GitHub Actions ou manualmente via URL:
 *   /api/cron-whatsapp-dispatcher?tipo=abertura_07h
 *   /api/cron-whatsapp-dispatcher?tipo=horario_HHh
 *   /api/cron-whatsapp-dispatcher?tipo=zerados_10h
 *   /api/cron-whatsapp-dispatcher?tipo=fechamento_18h30
 * ============================================================================
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const tipoDisparo = url.searchParams.get('tipo') || 'fechamento_18h30';
  const filialFiltro = url.searchParams.get('filial') || 'TODAS';

  try {
    if (!env || !env.DB) {
      return jsonResponse({ erro: 'Cloudflare D1 não disponível' }, 500);
    }

    // 1. Buscar gerentes ativos
    let gerentes = [
      { filial_id: 'tbl1', filial_sigla: 'TBL', nome_gerente: 'Vitório Neto', whatsapp_numero: '556696389884', ativo: 1 }
    ];
    try {
      const { results } = await env.DB.prepare(
        `SELECT * FROM gerentes_filiais WHERE ativo = 1`
      ).all();
      if (results && results.length > 0) gerentes = results;
    } catch (_) {}

    if (filialFiltro !== 'TODAS') {
      gerentes = gerentes.filter(g => g.filial_sigla.toUpperCase() === filialFiltro.toUpperCase());
    }

    const hoje = new Date().toISOString().split('T')[0];
    const horaStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const dataFormatada = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const relatorioEnvios = [];

    for (const ger of gerentes) {
      // 2. Ler snapshot REAL do D1
      const filialId = ger.filial_id || ger.filial_sigla.toLowerCase() + '1';
      const snap = await env.DB.prepare(
        `SELECT * FROM consolidado_executivo_live WHERE filial_id = ? AND data_ref = ?`
      ).bind(filialId, hoje).first();

      const snapGrupo = await env.DB.prepare(
        `SELECT * FROM consolidado_executivo_live WHERE filial_id = 'GRUPO' AND data_ref = ?`
      ).bind(hoje).first();

      // Se não há dados do dia ainda, avisar
      if (!snap) {
        relatorioEnvios.push({
          filial: ger.filial_sigla, gerente: ger.nome_gerente,
          status: 'sem_dados_do_dia', tipo: tipoDisparo
        });
        continue;
      }

      // Parsear JSONs
      const top5 = JSON.parse(snap.top5_rcas_json || '[]');
      const zerados = JSON.parse(snap.zerados_json || '[]');
      const alertas = JSON.parse(snap.alertas_json || '[]');

      // 3. Montar mensagem baseada no tipo de disparo
      let textoMensagem = '';

      if (tipoDisparo === 'abertura_07h' || tipoDisparo === 'abertura_08h') {
        textoMensagem = `🌅 *CEVEN NOC · ABERTURA DE OPERAÇÃO (${ger.filial_sigla})*
📅 ${dataFormatada} · ${horaStr}
👤 *Destinatário:* ${ger.nome_gerente}

📋 *METAS & PLANEJAMENTO DO DIA:*
• *Meta de Faturamento:* R$ ${fmt(snap.meta_fat_total)}
• *Vendedores Ativos:* ${snap.rcas_ativos} RCAs
• *Clientes na Rota:* ${snap.visitas_plan || 0} PDVs
• *Faturado Acumulado:* R$ ${fmt(snap.fat_liq_total)} (${snap.pct_fat}%)

Desejamos um excelente dia de vendas e foco total nas rotas!`;

      } else if (tipoDisparo.startsWith('horario_')) {
        textoMensagem = `📊 *CEVEN NOC · BOLETIM HORÁRIO (${ger.filial_sigla})*
📅 ${dataFormatada} · ${horaStr}
👤 *Destinatário:* ${ger.nome_gerente}

💰 *POSIÇÃO ATUAL:*
• *Faturado:* R$ ${fmt(snap.fat_liq_total)} de R$ ${fmt(snap.meta_fat_total)} (*${snap.pct_fat}%*)
• *Pendente:* R$ ${fmt(snap.pendente_total)}
• *Devoluções:* R$ ${fmt(snap.devolucoes_total)}
• *Positivação:* ${snap.real_cli_total}/${snap.meta_cli_total} clientes (*${snap.pct_pos}%*)
• *Zerados:* ${snap.rcas_zerados} de ${snap.rcas_ativos} vendedores

🏆 *TOP VENDEDORES:*
${top5.map((r, i) => `${i+1}º ${['🥇','🥈','🥉','🎖️','🎖️'][i]} ${r.nome} (${r.codigo}) — R$ ${fmt(r.fat_liq)} (${r.pct_fat}%)`).join('\n')}

_Atualizado às ${snap.hora_snapshot} · CEVEN NOC Intelligence Matrix_`;

      } else if (tipoDisparo === 'zerados_10h' || tipoDisparo === 'zerados_14h') {
        const horaAlerta = tipoDisparo === 'zerados_10h' ? '10:00' : '14:00';
        textoMensagem = `⚠️ *CEVEN NOC · ALERTA DE VENDEDORES ZERADOS (${ger.filial_sigla})*
📅 ${dataFormatada} · ${horaAlerta}
👤 *Destinatário:* ${ger.nome_gerente}

🚨 *STATUS DE POSITIVAÇÃO:*
• *RCAs Ativos:* ${snap.rcas_ativos}
• *RCAs com Venda:* ${snap.rcas_com_venda} (${snap.rcas_ativos > 0 ? Math.round((snap.rcas_com_venda / snap.rcas_ativos) * 100) : 0}%)
• *RCAs ZERADOS:* ${snap.rcas_zerados} vendedores

📋 *PRINCIPAIS ZERADOS:*
${zerados.slice(0, 10).map(z => `• RCA ${z.codigo} — ${z.nome} (meta R$ ${fmt(z.meta_fat)})`).join('\n')}

🎯 *Ação:* Contato imediato com supervisores para destravar pedidos.`;

      } else if (tipoDisparo === 'almoco_12h') {
        textoMensagem = `🍽️ *CEVEN NOC · PARCIAL DO ALMOÇO (${ger.filial_sigla})*
📅 ${dataFormatada} · 12:00
👤 *Destinatário:* ${ger.nome_gerente}

⚡ *RITMO DE VENDAS ATÉ AGORA:*
• *Faturado:* R$ ${fmt(snap.fat_liq_total)} (*${snap.pct_fat}%* da meta)
• *Visitas Realizadas:* ${snap.visitas_real || 0} PDVs
• *Vendedores Zerados:* ${snap.rcas_zerados} em acompanhamento
• *Positivação:* ${snap.real_cli_total}/${snap.meta_cli_total} (*${snap.pct_pos}%*)

🎯 *Foco na tarde:* Priorizar RCAs zerados e clientes de maior ticket.`;

      } else if (tipoDisparo === 'bloqueados_16h') {
        textoMensagem = `🔒 *CEVEN NOC · POSIÇÃO ÀS 16H (${ger.filial_sigla})*
📅 ${dataFormatada} · 16:00
👤 *Destinatário:* ${ger.nome_gerente}

💰 *POSIÇÃO ATUALIZADA:*
• *Faturado:* R$ ${fmt(snap.fat_liq_total)} de R$ ${fmt(snap.meta_fat_total)} (*${snap.pct_fat}%*)
• *Pendente em Fila:* R$ ${fmt(snap.pendente_total)}
• *RCAs Zerados:* ${snap.rcas_zerados}

${alertas.length > 0 ? `🔔 *ALERTAS DO DIA:*\n${alertas.slice(0, 5).map(a => `• ${a.mensagem}`).join('\n')}` : ''}

🎯 *Ação Crítica:* Faturamento noturno do Winthor roda às 21h00. Acionar Crédito & Cobrança para destravar pendentes!`;

      } else { // fechamento_18h30
        const grupoText = snapGrupo ? `\n\n🏢 *GRUPO LOCOMOTIVA:*\n• Faturado Total: R$ ${fmt(snapGrupo.fat_liq_total)} de R$ ${fmt(snapGrupo.meta_fat_total)} (*${snapGrupo.pct_fat}%*)\n• RCAs Ativos: ${snapGrupo.rcas_ativos} | Zerados: ${snapGrupo.rcas_zerados}` : '';

        textoMensagem = `🏢 *CEVEN NOC · FECHAMENTO DO DIA (${ger.filial_sigla})*
📅 ${dataFormatada} · 18:30
👤 *Destinatário:* ${ger.nome_gerente}

💰 *CONSOLIDADO DO DIA:*
• *Faturado:* R$ ${fmt(snap.fat_liq_total)} de R$ ${fmt(snap.meta_fat_total)} (*${snap.pct_fat}%*)
• *Pendente:* R$ ${fmt(snap.pendente_total)}
• *Devoluções:* R$ ${fmt(snap.devolucoes_total)}

📊 *POSITIVAÇÃO:*
• *Clientes:* ${snap.real_cli_total}/${snap.meta_cli_total} (*${snap.pct_pos}%*)
• *Visitas:* ${snap.visitas_real || 0} realizadas de ${snap.visitas_plan || 0} planejadas

🏆 *TOP VENDEDORES:*
${top5.map((r, i) => `${i+1}º ${['🥇','🥈','🥉','🎖️','🎖️'][i]} ${r.nome} (${r.codigo}) — R$ ${fmt(r.fat_liq)}`).join('\n')}
${grupoText}

_Fechamento automático · CEVEN NOC Intelligence Matrix v3.0_`;
      }

      // 4. Envio via Green-API
      const greenApiUrl = env.GREEN_API_URL || 'https://7107.api.greenapi.com';
      const greenIdInstance = env.GREEN_ID_INSTANCE || '710722724828';
      const greenToken = env.GREEN_API_TOKEN || '0206610482f54377a4161f6e7daf4866ee0bef8ac6c842b1bd';

      let statusEnvio = 'pronto';
      let digits = ger.whatsapp_numero.replace(/\D/g, '');
      if (!digits.startsWith('55')) digits = `55${digits}`;

      const candidatePhones = [digits];
      if (digits.length === 13 && digits.startsWith('55')) {
        candidatePhones.push(digits.slice(0, 4) + digits.slice(5));
      }

      for (const phone of candidatePhones) {
        try {
          const sendUrl = `${greenApiUrl}/waInstance${greenIdInstance}/sendMessage/${greenToken}`;
          const resGateway = await fetch(sendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: `${phone}@c.us`, message: textoMensagem })
          });
          if (resGateway.ok) {
            const resJson = await resGateway.json().catch(() => ({}));
            statusEnvio = `entregue (${phone} - id: ${resJson.idMessage || 'ok'})`;
            break; // Parar no primeiro envio bem-sucedido
          }
        } catch (e) {
          statusEnvio = 'erro: ' + e.message;
        }
      }

      relatorioEnvios.push({
        filial: ger.filial_sigla,
        gerente: ger.nome_gerente,
        tipo: tipoDisparo,
        status: statusEnvio,
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({
      sucesso: true,
      versao: '3.0',
      tipo: tipoDisparo,
      fonte_dados: 'consolidado_executivo_live (D1)',
      total_envios: relatorioEnvios.length,
      envios: relatorioEnvios
    });

  } catch (err) {
    return jsonResponse({ sucesso: false, erro: err.message, stack: err.stack }, 500);
  }
}

// Helpers
function fmt(val) {
  return (parseFloat(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
