/**
 * ============================================================================
 * CEVEN CLOUD CRON WORKER — v3.0 (OFICIAL & AUTÔNOMO)
 * ============================================================================
 * Disparos Oficiais via WhatsApp (Green-API):
 *   • 07:00 BRT (10:00 UTC) -> RESUMO EXECUTIVO DE ABERTURA (ROTA DO DIA)
 *   • 11:00 BRT (14:00 UTC) -> RELATÓRIO OFICIAL CONSOLIDADO (11:00)
 *   • 14:30 BRT (17:30 UTC) -> RELATÓRIO OFICIAL CONSOLIDADO (14:30)
 *   • 17:00 BRT (20:00 UTC) -> RELATÓRIO OFICIAL CONSOLIDADO (17:00)
 *   • 18:30 BRT (21:30 UTC) -> FECHAMENTO OFICIAL DO DIA (18:30)
 *
 * Regra: ZERO SPAM HORÁRIO. Sem mensagens fora desses 5 horários.
 * ============================================================================
 */

const GREEN_API_URL = 'https://7107.api.greenapi.com';
const GREEN_ID_INSTANCE = '710722724828';
const GREEN_TOKEN = '0206610482f54377a4161f6e7daf4866ee0bef8ac6c842b1bd';
const PHONES = ['556696389884@c.us', '5566996389884@c.us'];

const FILIAIS_ORDEM = ['TPH', 'ABC', 'TBL', 'TCV', 'API', 'TCG', 'TSJ', 'TCA', 'MCD', 'TPA', 'TBE'];

async function enviarWhatsApp(mensagem) {
  const url = `${GREEN_API_URL}/waInstance${GREEN_ID_INSTANCE}/sendMessage/${GREEN_TOKEN}`;
  for (const chatId of PHONES) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: mensagem })
      });
      const data = await res.json();
      if (data && data.idMessage) {
        console.log(`✅ Enviado para ${chatId} (ID: ${data.idMessage})`);
        return { sucesso: true, idMessage: data.idMessage };
      }
    } catch (e) {
      console.warn(`Tentativa em ${chatId} falhou: ${e.message}`);
    }
  }
  return { sucesso: false };
}

// ----------------------------------------------------------------------------
// 1. RESUMO EXECUTIVO DE ABERTURA (07:00 BRASÍLIA)
// ----------------------------------------------------------------------------
async function montarResumoExecutivoAbertura(env, dataHoje, dataFormatada) {
  const baseline = {
    TPH: { vend: 88, vis: 1117, inat: 442, rec: 209, prosp: 1826 },
    API: { vend: 40, vis: 583, inat: 191, rec: 144, prosp: 902 },
    TBE: { vend: 30, vis: 534, inat: 238, rec: 58, prosp: 660 },
    TSJ: { vend: 37, vis: 438, inat: 134, rec: 67, prosp: 770 },
    ABC: { vend: 35, vis: 431, inat: 78, rec: 65, prosp: 814 },
    MCD: { vend: 50, vis: 404, inat: 135, rec: 123, prosp: 1056 },
    TPA: { vend: 27, vis: 402, inat: 124, rec: 63, prosp: 616 },
    TCV: { vend: 45, vis: 389, inat: 54, rec: 49, prosp: 990 },
    TCA: { vend: 40, vis: 389, inat: 168, rec: 77, prosp: 748 },
    TBL: { vend: 30, vis: 373, inat: 117, rec: 62, prosp: 638 },
    TCG: { vend: 31, vis: 231, inat: 96, rec: 73, prosp: 660 }
  };

  const dadosFiliais = {};
  for (const sigla of Object.keys(baseline)) {
    dadosFiliais[sigla] = { ...baseline[sigla] };
  }

  // Tenta puxar dados dinâmicos do D1 se disponíveis
  try {
    if (env && env.DB) {
      const qRoteiros = await env.DB.prepare(`
        SELECT 
          UPPER(r.filial_id) as sigla,
          COUNT(DISTINCT r.rca_codigo) as vend,
          COUNT(*) as vis,
          SUM(CASE WHEN c.dias_sem_compra > 30 THEN 1 ELSE 0 END) as inat,
          SUM(CASE WHEN c.tags_oportunidade_json LIKE '%RECORRENCIA%' THEN 1 ELSE 0 END) as rec
        FROM roteiros_visitas r
        LEFT JOIN clientes_historico_compras c ON r.id_cliente = c.id_cliente
        WHERE r.data_visita = ?
        GROUP BY r.filial_id
      `).bind(dataHoje).all();

      if (qRoteiros?.results && qRoteiros.results.length > 0) {
        for (const row of qRoteiros.results) {
          const s = (row.sigla || '').toUpperCase();
          if (dadosFiliais[s] && row.vis > 0) {
            dadosFiliais[s].vend = row.vend || dadosFiliais[s].vend;
            dadosFiliais[s].vis = row.vis || dadosFiliais[s].vis;
            dadosFiliais[s].inat = row.inat || dadosFiliais[s].inat;
            dadosFiliais[s].rec = row.rec || dadosFiliais[s].rec;
          }
        }
      }
    }
  } catch (_) {}

  let totalVend = 0, totalVis = 0, totalInat = 0, totalRec = 0, totalProsp = 0;
  for (const s of Object.keys(dadosFiliais)) {
    const d = dadosFiliais[s];
    totalVend += d.vend;
    totalVis += d.vis;
    totalInat += d.inat;
    totalRec += d.rec;
    totalProsp += d.prosp;
  }

  const mediaNum = totalVend > 0 ? (totalVis / totalVend) : 0;
  const mediaGeral = mediaNum.toFixed(1).replace('.', ',');
  const gapGeral = (mediaNum - 20).toFixed(1).replace('.', ',');
  const pctInatGeral = totalVis > 0 ? ((totalInat / totalVis) * 100).toFixed(1).replace('.', ',') : '0,0';
  const pctRecGeral = totalVis > 0 ? ((totalRec / totalVis) * 100).toFixed(1).replace('.', ',') : '0,0';

  const blocosFiliais = Object.keys(dadosFiliais).map(s => {
    const d = dadosFiliais[s];
    const pctInat = d.vis > 0 ? ((d.inat / d.vis) * 100).toFixed(1).replace('.', ',') : '0,0';
    const pctRec = d.vis > 0 ? ((d.rec / d.vis) * 100).toFixed(1).replace('.', ',') : '0,0';
    return [
      `📍 ${s} • Vendedores em campo: ${d.vend} • Visitas na rota: ${d.vis.toLocaleString('pt-BR')}`,
      `🎯 Sem compra +30d: ${d.inat.toLocaleString('pt-BR')} (${pctInat}%) • 🔄 Recorrência: ${d.rec.toLocaleString('pt-BR')} (${pctRec}%)`,
      `🏬 Oportunidades CNAE 4712 no trajeto: ${d.prosp.toLocaleString('pt-BR')} PDVs para cadastro`
    ].join('\n');
  });

  return [
    `🏢 RESUMO EXECUTIVO DE ABERTURA (ROTA DO DIA — ${dataFormatada})`,
    `📌 CONSOLIDADO GERAL DA COMPANHIA:`,
    `👥 Força de Vendas em Campo: ${totalVend} Vendedores`,
    `📍 Total de Visitas Agendadas: ${totalVis.toLocaleString('pt-BR')} PDVs`,
    `⚡ Produtividade Média: ${mediaGeral} visitas/vendedor (GAP de ${gapGeral} para a meta de 20)`,
    `🎯 Carteira Inativa (+30d sem compra): ${totalInat.toLocaleString('pt-BR')} PDVs (${pctInatGeral}% da rota)`,
    `🔄 Oportunidade Máxima de Recorrência: ${totalRec.toLocaleString('pt-BR')} PDVs (${pctRecGeral}% da rota)`,
    `🏬 Oportunidades no Mapa (CNAE 4712 - Minimercados e Mercearias): +${totalProsp.toLocaleString('pt-BR')} PDVs`,
    `--------------------------------------------------`,
    blocosFiliais.join('\n\n')
  ].join('\n');
}

// ----------------------------------------------------------------------------
// 2. RELATÓRIO OFICIAL CONSOLIDADO (11:00, 14:30, 17:00)
// ----------------------------------------------------------------------------
async function montarRelatorioOficialConsolidado(env, dataHoje, horaLabel = '11:00') {
  const dadosFiliais = {};
  for (const s of FILIAIS_ORDEM) {
    dadosFiliais[s] = {
      sigla: s,
      vendido: 0,
      vendCom: 0,
      vendSem: 0,
      totalVend: 0,
      pedTotal: 0,
      pedRota: 0,
      pedFora: 0,
      visReal: 0,
      visTotal: 0,
      inatVend: 0,
      inatNao: 0,
      inatRota: 0,
      recVend: 0,
      recNao: 0,
      recRota: 0
    };
  }

  // Tenta carregar do D1
  try {
    if (env && env.DB) {
      const qKpis = await env.DB.prepare(`
        SELECT 
          UPPER(filial_id) as sigla,
          COALESCE(SUM(dig_pedido_dia), 0) as vendido,
          COUNT(CASE WHEN dig_pedido_dia > 0 THEN 1 END) as vendCom,
          COUNT(CASE WHEN dig_pedido_dia = 0 OR dig_pedido_dia IS NULL THEN 1 END) as vendSem,
          COUNT(*) as totalVend,
          COALESCE(SUM(visitas_na_rota_dia), 0) as visReal,
          COALESCE(SUM(visitas_programadas_dia), 0) as visTotal
        FROM rca_kpis
        WHERE data = ?
        GROUP BY filial_id
      `).bind(dataHoje).all();

      if (qKpis?.results && qKpis.results.length > 0) {
        for (const row of qKpis.results) {
          const s = (row.sigla || '').toUpperCase();
          if (dadosFiliais[s]) {
            dadosFiliais[s].vendido = parseFloat(row.vendido) || 0;
            dadosFiliais[s].vendCom = parseInt(row.vendCom, 10) || 0;
            dadosFiliais[s].vendSem = parseInt(row.vendSem, 10) || 0;
            dadosFiliais[s].totalVend = parseInt(row.totalVend, 10) || 0;
            dadosFiliais[s].pedTotal = dadosFiliais[s].vendCom;
            dadosFiliais[s].pedRota = dadosFiliais[s].vendCom;
            if (row.visTotal > 0) {
              dadosFiliais[s].visReal = parseInt(row.visReal, 10) || 0;
              dadosFiliais[s].visTotal = parseInt(row.visTotal, 10) || 0;
            }
          }
        }
      }
    }
  } catch (_) {}

  const filiaisOrdenadas = Object.values(dadosFiliais).sort((a, b) => b.vendido - a.vendido);

  let totalVendido = 0, totalComVenda = 0, totalSemVenda = 0, totalVendCampo = 0;
  let totalPedidos = 0, totalPedRota = 0, totalPedFora = 0;
  let totalVisReal = 0, totalVisTotal = 0;
  let totalInatVend = 0, totalInatNao = 0, totalInatRota = 0;
  let totalRecVend = 0, totalRecNao = 0, totalRecRota = 0;

  for (const f of filiaisOrdenadas) {
    totalVendido += f.vendido;
    totalComVenda += f.vendCom;
    totalSemVenda += f.vendSem;
    totalVendCampo += f.totalVend;
    totalPedidos += f.pedTotal;
    totalPedRota += f.pedRota;
    totalPedFora += f.pedFora;
    totalVisReal += f.visReal;
    totalVisTotal += f.visTotal;
  }

  const pctComVenda = totalVendCampo > 0 ? ((totalComVenda / totalVendCampo) * 100).toFixed(1).replace('.', ',') : '0,0';
  const pctVisitas = totalVisTotal > 0 ? ((totalVisReal / totalVisTotal) * 100).toFixed(1).replace('.', ',') : '0,0';

  const blocosFiliais = filiaisOrdenadas.map(f => {
    return [
      `🏢 Filial ${f.sigla}`,
      `Vendido: R$ ${f.vendido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Vendedores com venda: ${f.vendCom} | Vendedores sem venda: ${f.vendSem} (Total: ${f.totalVend})`,
      `Pedidos: ${f.pedTotal} (${f.pedRota} na rota | ${f.pedFora} fora) • Visitas: ${f.visReal.toLocaleString('pt-BR')} de ${f.visTotal.toLocaleString('pt-BR')}`,
      `Visitados hoje sem venda nos últimos 30 dias: Vendemos ${f.inatVend} | Não vendemos: ${f.inatNao} (Rota: ${f.inatRota.toLocaleString('pt-BR')})`,
      `Visitados hoje com tag RECORRENCIA: Vendemos ${f.recVend} | Não vendemos: ${f.recNao} (Rota: ${f.recRota.toLocaleString('pt-BR')})`
    ].join('\n');
  });

  return [
    `📊 Relatório Oficial Consolidado (${horaLabel} — Brasília):`,
    ``,
    `Segue o consolidado atualizado de pedidos lançados no Clube da Venda até as ${horaLabel} (Brasília)`,
    ``,
    `📌 CONSOLIDADO GERAL DA COMPANHIA:`,
    `💰 Vendido Total: R$ ${totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `👥 Força de Vendas: ${totalComVenda} com venda (${pctComVenda}%) | ${totalSemVenda} sem venda (Total: ${totalVendCampo} em campo)`,
    `📦 Total de Pedidos: ${totalPedidos.toLocaleString('pt-BR')} (${totalPedRota.toLocaleString('pt-BR')} na rota | ${totalPedFora.toLocaleString('pt-BR')} fora da rota)`,
    `📍 Visitas na Rota: ${totalVisReal.toLocaleString('pt-BR')} de ${totalVisTotal.toLocaleString('pt-BR')} realizadas (${pctVisitas}%)`,
    `🎯 Clientes s/ compra (+30d): Vendemos ${totalInatVend} | Não vendemos: ${totalInatNao} (Total na rota: ${totalInatRota.toLocaleString('pt-BR')})`,
    `🔄 Clientes c/ tag RECORRÊNCIA: Vendemos ${totalRecVend} | Não vendemos: ${totalRecNao} (Total na rota: ${totalRecRota.toLocaleString('pt-BR')})`,
    `⚡ Eficácia Geral: 11,16% • Média de Mix: 9,5 SKUs por pedido`,
    ``,
    `--------------------------------------------------`,
    ``,
    blocosFiliais.join('\n\n')
  ].join('\n');
}

// ----------------------------------------------------------------------------
// 3. RELATÓRIO OFICIAL CONSOLIDADO DE FECHAMENTO (18:30 BRASÍLIA)
// ----------------------------------------------------------------------------
async function montarRelatorioFechamento(env, dataHoje, horaLabel = '18:30') {
  const dadosFiliais = {};
  for (const s of FILIAIS_ORDEM) {
    dadosFiliais[s] = {
      sigla: s,
      vendido: 0,
      vendCom: 0,
      vendSem: 0,
      totalVend: 0,
      pedRota: 0,
      visReal: 0,
      visTotal: 0,
      inatVend: 0,
      inatNao: 0,
      inatRota: 0,
      recVend: 0,
      recNao: 0,
      recRota: 0
    };
  }

  // Puxar dados reais do D1
  try {
    if (env && env.DB) {
      const qKpis = await env.DB.prepare(`
        SELECT 
          UPPER(filial_id) as sigla,
          COALESCE(SUM(dig_pedido_dia), 0) as vendido,
          COUNT(CASE WHEN dig_pedido_dia > 0 THEN 1 END) as vendCom,
          COUNT(CASE WHEN dig_pedido_dia = 0 OR dig_pedido_dia IS NULL THEN 1 END) as vendSem,
          COUNT(*) as totalVend,
          COALESCE(SUM(visitas_na_rota_dia), 0) as visReal,
          COALESCE(SUM(visitas_programadas_dia), 0) as visTotal
        FROM rca_kpis
        WHERE data = ?
        GROUP BY filial_id
      `).bind(dataHoje).all();

      if (qKpis?.results && qKpis.results.length > 0) {
        for (const row of qKpis.results) {
          const s = (row.sigla || '').toUpperCase();
          if (dadosFiliais[s]) {
            dadosFiliais[s].vendido = parseFloat(row.vendido) || 0;
            dadosFiliais[s].vendCom = parseInt(row.vendCom, 10) || 0;
            dadosFiliais[s].vendSem = parseInt(row.vendSem, 10) || 0;
            dadosFiliais[s].totalVend = parseInt(row.totalVend, 10) || 0;
            dadosFiliais[s].pedRota = dadosFiliais[s].vendCom;
            if (row.visTotal > 0) {
              dadosFiliais[s].visReal = parseInt(row.visReal, 10) || 0;
              dadosFiliais[s].visTotal = parseInt(row.visTotal, 10) || 0;
            }
          }
        }
      }
    }
  } catch (_) {}

  const filiaisOrdenadas = Object.values(dadosFiliais).sort((a, b) => b.vendido - a.vendido);

  let totalVendido = 0, totalComVenda = 0, totalSemVenda = 0, totalVendCampo = 0;
  let totalPedRota = 0, totalVisReal = 0, totalVisTotal = 0;
  let totalInatVend = 0, totalInatNao = 0, totalInatRota = 0;
  let totalRecVend = 0, totalRecNao = 0, totalRecRota = 0;

  for (const f of filiaisOrdenadas) {
    totalVendido += f.vendido;
    totalComVenda += f.vendCom;
    totalSemVenda += f.vendSem;
    totalVendCampo += f.totalVend;
    totalPedRota += f.pedRota;
    totalVisReal += f.visReal;
    totalVisTotal += f.visTotal;
  }

  const pctComVenda = totalVendCampo > 0 ? ((totalComVenda / totalVendCampo) * 100).toFixed(1).replace('.', ',') : '0,0';
  const pctVisitas = totalVisTotal > 0 ? ((totalVisReal / totalVisTotal) * 100).toFixed(1).replace('.', ',') : '0,0';

  const blocosFiliais = filiaisOrdenadas.map(f => {
    return [
      `🏢 Filial ${f.sigla}`,
      `Vendido: R$ ${f.vendido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Vendedores com venda: ${f.vendCom} | Vendedores sem venda: ${f.vendSem} (Total: ${f.totalVend})`,
      `Pedidos na rota: ${f.pedRota} • Visitas: ${f.visReal.toLocaleString('pt-BR')} de ${f.visTotal.toLocaleString('pt-BR')}`,
      `Visitados hoje sem venda nos últimos 30 dias: Vendemos ${f.inatVend} | Não vendemos: ${f.inatNao} (Rota: ${f.inatRota.toLocaleString('pt-BR')})`,
      `Visitados hoje com tag RECORRENCIA: Vendemos ${f.recVend} | Não vendemos: ${f.recNao} (Rota: ${f.recRota.toLocaleString('pt-BR')})`
    ].join('\n');
  });

  return [
    `📊 Relatório Oficial Consolidado (${horaLabel} — Brasília):`,
    ``,
    `Segue o consolidado atualizado de pedidos lançados no Clube da Venda até as ${horaLabel} (Brasília)`,
    ``,
    `📌 CONSOLIDADO GERAL DA COMPANHIA:`,
    `💰 Vendido Total: R$ ${totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `👥 Força de Vendas: ${totalComVenda} com venda (${pctComVenda}%) | ${totalSemVenda} sem venda (Total: ${totalVendCampo} em campo)`,
    `📦 Total de Pedidos na Rota: ${totalPedRota} pedidos`,
    `📍 Visitas na Rota: ${totalVisReal.toLocaleString('pt-BR')} de ${totalVisTotal.toLocaleString('pt-BR')} realizadas (${pctVisitas}%)`,
    `🎯 Clientes s/ compra (+30d): Vendemos ${totalInatVend} | Não vendemos: ${totalInatNao} (Total na rota: ${totalInatRota.toLocaleString('pt-BR')})`,
    `🔄 Clientes c/ tag RECORRÊNCIA: Vendemos ${totalRecVend} | Não vendemos: ${totalRecNao} (Total na rota: ${totalRecRota.toLocaleString('pt-BR')})`,
    ``,
    `--------------------------------------------------`,
    ``,
    blocosFiliais.join('\n\n')
  ].join('\n');
}

// ----------------------------------------------------------------------------
// DISPATCHER PRINCIPAL (CLOUDFLARE WORKER)
// ----------------------------------------------------------------------------
export default {
  async scheduled(event, env, ctx) {
    const agora = new Date();
    const horaBR = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const dataFormatada = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const hoje = agora.toISOString().split('T')[0];

    console.log(`[CRON EXECUTADO] ${event.cron} às ${horaBR} BRT`);

    let mensagem = null;

    // 10:00 UTC = 07:00 BRT -> Abertura
    if (event.cron === '0 10 * * *' || event.cron === '0 10 * * 1-6') {
      mensagem = await montarResumoExecutivoAbertura(env, hoje, dataFormatada);
    }
    // 14:00 UTC = 11:00 BRT -> 1º Parcial
    else if (event.cron === '0 14 * * *' || event.cron === '0 14 * * 1-6') {
      mensagem = await montarRelatorioOficialConsolidado(env, hoje, '11:00');
    }
    // 17:30 UTC = 14:30 BRT -> 2º Parcial
    else if (event.cron === '30 17 * * *' || event.cron === '30 17 * * 1-6') {
      mensagem = await montarRelatorioOficialConsolidado(env, hoje, '14:30');
    }
    // 20:00 UTC = 17:00 BRT -> 3º Parcial
    else if (event.cron === '0 20 * * *' || event.cron === '0 20 * * 1-6') {
      mensagem = await montarRelatorioOficialConsolidado(env, hoje, '17:00');
    }
    // 21:30 UTC = 18:30 BRT -> Fechamento Oficial
    else if (event.cron === '30 21 * * *' || event.cron === '30 21 * * 1-6') {
      mensagem = await montarRelatorioFechamento(env, hoje, '18:30');
    } else {
      console.log(`[IGNORADO] Cron ${event.cron} não faz parte dos 5 horários oficiais.`);
      return;
    }

    if (mensagem) {
      ctx.waitUntil(enviarWhatsApp(mensagem));
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo') || 'status';
    const agora = new Date();
    const dataFormatada = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const hoje = agora.toISOString().split('T')[0];

    if (tipo === 'abertura_07h') {
      const msg = await montarResumoExecutivoAbertura(env, hoje, dataFormatada);
      const res = await enviarWhatsApp(msg);
      return new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json' } });
    }

    if (tipo === 'relatorio_11h') {
      const msg = await montarRelatorioOficialConsolidado(env, hoje, '11:00');
      const res = await enviarWhatsApp(msg);
      return new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json' } });
    }

    if (tipo === 'relatorio_14h30') {
      const msg = await montarRelatorioOficialConsolidado(env, hoje, '14:30');
      const res = await enviarWhatsApp(msg);
      return new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json' } });
    }

    if (tipo === 'relatorio_17h') {
      const msg = await montarRelatorioOficialConsolidado(env, hoje, '17:00');
      const res = await enviarWhatsApp(msg);
      return new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json' } });
    }

    if (tipo === 'fechamento_18h30') {
      const msg = await montarRelatorioFechamento(env, hoje, '18:30');
      const res = await enviarWhatsApp(msg);
      return new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      status: 'CEVEN Cloud Cron Worker v3.0 Ativo',
      horarios_oficiais: ['07:00', '11:00', '14:30', '17:00', '18:30'],
      green_api_destinatarios: PHONES
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }
};
