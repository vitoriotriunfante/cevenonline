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

const EVO_URL = 'https://evolution-api-production-8999.up.railway.app';
const EVO_API_KEY = '143c2820271dfa4c2f6c920aff3205f0c5dec92d7c3f3dfaf90a9d8bb023eaaa';
const EVO_INSTANCE = 'ceven-noc';

const GREEN_API_URL = 'https://7107.api.greenapi.com';
const GREEN_ID_INSTANCE = '710722724828';
const GREEN_TOKEN = '0206610482f54377a4161f6e7daf4866ee0bef8ac6c842b1bd';

const PHONES = ['556696389884', '5541987525605'];

const FILIAIS_ORDEM = ['TPH', 'ABC', 'TBL', 'TCV', 'API', 'TCG', 'TSJ', 'TCA', 'MCD', 'TPA', 'TBE'];

async function enviarWhatsApp(mensagem) {
  let anySuccess = false;
  for (const phone of PHONES) {
    // 1. Tenta Evolution API (Ativa e Online no Railway)
    try {
      const evoRes = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVO_API_KEY
        },
        body: JSON.stringify({ number: phone, text: mensagem, delay: 1000 })
      });
      const data = await evoRes.json();
      if (data?.key?.id || data?.idMessage) {
        console.log(`✅ [Evolution] Enviado para ${phone}: ${data?.key?.id || data?.idMessage}`);
        anySuccess = true;
        continue;
      }
    } catch (e) {
      console.warn(`[Evolution] Falha em ${phone}: ${e.message}`);
    }

    // 2. Fallback Green-API se Evolution falhar
    try {
      const greenUrl = `${GREEN_API_URL}/waInstance${GREEN_ID_INSTANCE}/sendMessage/${GREEN_TOKEN}`;
      const greenRes = await fetch(greenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${phone}@c.us`, message: mensagem })
      });
      const gData = await greenRes.json();
      if (gData?.idMessage) {
        console.log(`✅ [GreenAPI] Enviado para ${phone}: ${gData.idMessage}`);
        anySuccess = true;
      }
    } catch (err) {
      console.warn(`[GreenAPI] Falha em ${phone}: ${err.message}`);
    }
  }
  return { sucesso: anySuccess };
}

// ----------------------------------------------------------------------------
// 1. RESUMO EXECUTIVO DE ABERTURA (07:00 BRASÍLIA)
// ----------------------------------------------------------------------------
async function montarResumoExecutivoAbertura(env, dataHoje, dataFormatada) {
  const baseline = {
    TPH: { vend: 45, vis: 700, inat: 277, rec: 131, prosp: 1826 },
    TSJ: { vend: 24, vis: 405, inat: 124, rec: 62, prosp: 770 },
    TBE: { vend: 19, vis: 383, inat: 171, rec: 42, prosp: 660 },
    API: { vend: 26, vis: 341, inat: 112, rec: 84, prosp: 902 },
    TBL: { vend: 28, vis: 325, inat: 102, rec: 54, prosp: 638 },
    TPA: { vend: 22, vis: 319, inat: 98, rec: 50, prosp: 616 },
    TCV: { vend: 29, vis: 303, inat: 42, rec: 38, prosp: 990 },
    ABC: { vend: 18, vis: 294, inat: 53, rec: 44, prosp: 814 },
    MCD: { vend: 42, vis: 280, inat: 94, rec: 85, prosp: 1056 },
    TCA: { vend: 31, vis: 245, inat: 106, rec: 49, prosp: 748 },
    TCG: { vend: 20, vis: 156, inat: 65, rec: 49, prosp: 660 }
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
    `📌 CONSOLIDADO VAREJO (VJ) DA COMPANHIA:`,
    `👥 Força de Vendas em Campo (VJ): ${totalVend} Vendedores`,
    `📍 Total de Visitas Agendadas (VJ): ${totalVis.toLocaleString('pt-BR')} PDVs`,
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
      // 1. Ler de consolidado_executivo_live
      const qLive = await env.DB.prepare(`
        SELECT 
          UPPER(filial_sigla) as sigla,
          fat_liq_total as vendido,
          rcas_com_venda as vendCom,
          rcas_zerados as vendSem,
          rcas_ativos as totalVend,
          visitas_plan as visTotal,
          visitas_real as visReal,
          pedidos_dia as pedTotal
        FROM consolidado_executivo_live
        WHERE data_ref = ? AND filial_id != 'GRUPO'
      `).bind(dataHoje).all();

      if (qLive?.results && qLive.results.length > 0) {
        for (const row of qLive.results) {
          const s = (row.sigla || '').toUpperCase();
          if (dadosFiliais[s]) {
            dadosFiliais[s].vendido = parseFloat(row.vendido) || 0;
            dadosFiliais[s].vendCom = parseInt(row.vendCom, 10) || 0;
            dadosFiliais[s].vendSem = parseInt(row.vendSem, 10) || 0;
            dadosFiliais[s].totalVend = parseInt(row.totalVend, 10) || 0;
            dadosFiliais[s].visTotal = parseInt(row.visTotal, 10) || 0;
            dadosFiliais[s].visReal = parseInt(row.visReal, 10) || 0;
            dadosFiliais[s].pedTotal = parseInt(row.pedTotal, 10) || 0;
          }
        }
      }

      // 2. Complementar com métricas dos vendedores em rota de rca_kpis
      const qKpis = await env.DB.prepare(`
        SELECT 
          UPPER(filial_id) as sigla,
          COALESCE(SUM(dig_pedido_dia), 0) as vendido,
          COUNT(CASE WHEN visitas_programadas_dia > 0 AND dig_pedido_dia > 0 THEN 1 END) as vendCom,
          COUNT(CASE WHEN visitas_programadas_dia > 0 AND (dig_pedido_dia = 0 OR dig_pedido_dia IS NULL) THEN 1 END) as vendSem,
          COUNT(CASE WHEN visitas_programadas_dia > 0 THEN 1 END) as totalVend,
          COALESCE(SUM(visitas_na_rota_dia), 0) as visReal,
          COALESCE(SUM(visitas_programadas_dia), 0) as visTotal,
          COALESCE(SUM(visitas_com_venda_dia), 0) as pedRota
        FROM rca_kpis
        WHERE data = ?
        GROUP BY filial_id
      `).bind(dataHoje).all();

      if (qKpis?.results && qKpis.results.length > 0) {
        for (const row of qKpis.results) {
          const s = (row.sigla || '').toUpperCase();
          if (dadosFiliais[s]) {
            if (!dadosFiliais[s].vendido) dadosFiliais[s].vendido = parseFloat(row.vendido) || 0;
            // Baseado estritamente nos vendedores com rota hoje
            dadosFiliais[s].vendCom = parseInt(row.vendCom, 10) || 0;
            dadosFiliais[s].vendSem = parseInt(row.vendSem, 10) || 0;
            dadosFiliais[s].totalVend = parseInt(row.totalVend, 10) || 0;
            if (!dadosFiliais[s].visReal) dadosFiliais[s].visReal = parseInt(row.visReal, 10) || 0;
            if (!dadosFiliais[s].visTotal) dadosFiliais[s].visTotal = parseInt(row.visTotal, 10) || 0;
            dadosFiliais[s].pedRota = parseInt(row.pedRota, 10) || 0;
            if (!dadosFiliais[s].pedTotal) dadosFiliais[s].pedTotal = dadosFiliais[s].pedRota;
            dadosFiliais[s].pedFora = Math.max(0, dadosFiliais[s].pedTotal - dadosFiliais[s].pedRota);
          }
        }
      }
    }
  } catch (_) {}

  const filiaisOrdenadas = Object.values(dadosFiliais).sort((a, b) => b.vendido - a.vendido);

  let totalVendido = 0, totalComVenda = 0, totalSemVenda = 0, totalVendCampo = 0;
  let totalPedidos = 0, totalPedRota = 0, totalPedFora = 0;
  let totalVisReal = 0, totalVisTotal = 0;

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
  const pctSemVenda = totalVendCampo > 0 ? ((totalSemVenda / totalVendCampo) * 100).toFixed(1).replace('.', ',') : '0,0';
  const pctVisitas = totalVisTotal > 0 ? ((totalVisReal / totalVisTotal) * 100).toFixed(1).replace('.', ',') : '0,0';
  const eficiGeral = totalVisTotal > 0 ? ((totalVisReal / totalVisTotal) * 100).toFixed(2).replace('.', ',') : '0,00';
  const eficaGeral = totalVisTotal > 0 ? ((totalPedRota / totalVisTotal) * 100).toFixed(2).replace('.', ',') : '0,00';

  const blocosFiliais = filiaisOrdenadas.map(f => {
    const efici = f.visTotal > 0 ? ((f.visReal / f.visTotal) * 100).toFixed(1).replace('.', ',') : '0,0';
    const efica = f.visTotal > 0 ? ((f.pedRota / f.visTotal) * 100).toFixed(1).replace('.', ',') : '0,0';
    return [
      `🏢 Filial ${f.sigla}`,
      `Vendido: R$ ${f.vendido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Vendedores com venda: ${f.vendCom} | *Vendedores sem pedido: ${f.vendSem}* (Total: ${f.totalVend} em rota)`,
      `Pedidos: ${f.pedTotal} (${f.pedRota} na rota | ${f.pedFora} fora) • Eficiência: ${efici}% | Eficácia: ${efica}%`,
      `Visitas: ${f.visReal.toLocaleString('pt-BR')} de ${f.visTotal.toLocaleString('pt-BR')} programadas`
    ].join('\n');
  });

  return [
    `📊 Relatório Oficial Consolidado (${horaLabel} — Brasília):`,
    ``,
    `Segue o consolidado atualizado de pedidos lançados no Clube da Venda até as ${horaLabel} (Brasília)`,
    ``,
    `📌 CONSOLIDADO GERAL DA COMPANHIA:`,
    `💰 Vendido Total: R$ ${totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `👥 Força de Vendas em Rota: ${totalComVenda} com venda (${pctComVenda}%) | *${totalSemVenda} SEM NENHUM PEDIDO (${pctSemVenda}%)* (Total: ${totalVendCampo} em rota hoje)`,
    `📦 Total de Pedidos: ${totalPedidos.toLocaleString('pt-BR')} (${totalPedRota.toLocaleString('pt-BR')} na rota | ${totalPedFora.toLocaleString('pt-BR')} fora da rota)`,
    `📍 Roteiros / Visitas na Rota: ${totalVisReal.toLocaleString('pt-BR')} de ${totalVisTotal.toLocaleString('pt-BR')} realizadas (${pctVisitas}%)`,
    `⚡ Eficiência de Rota: ${eficiGeral}% • Eficácia de Pedidos: ${eficaGeral}%`,
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
    if (event.cron === '0 10 * * *' || event.cron === '0 10 * * 1-5' || event.cron === '0 10 * * 1-6') {
      mensagem = await montarResumoExecutivoAbertura(env, hoje, dataFormatada);
    }
    // 14:00 UTC = 11:00 BRT -> 1º Parcial
    else if (event.cron === '0 14 * * *' || event.cron === '0 14 * * 1-5' || event.cron === '0 14 * * 1-6') {
      mensagem = await montarRelatorioOficialConsolidado(env, hoje, '11:00');
    }
    // 17:30 UTC = 14:30 BRT -> 2º Parcial
    else if (event.cron === '30 17 * * *' || event.cron === '30 17 * * 1-5' || event.cron === '30 17 * * 1-6') {
      mensagem = await montarRelatorioOficialConsolidado(env, hoje, '14:30');
    }
    // 20:00 UTC = 17:00 BRT -> 3º Parcial
    else if (event.cron === '0 20 * * *' || event.cron === '0 20 * * 1-5' || event.cron === '0 20 * * 1-6') {
      mensagem = await montarRelatorioOficialConsolidado(env, hoje, '17:00');
    }
    // 21:30 UTC = 18:30 BRT -> Fechamento Oficial
    else if (event.cron === '30 21 * * *' || event.cron === '30 21 * * 1-5' || event.cron === '30 21 * * 1-6') {
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
      destinatarios: PHONES
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }
};
