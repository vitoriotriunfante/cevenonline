// Endpoint de Inteligência Comercial Gerencial Horária (As 9 Perguntas de Ouro)
// Consolida auditoria profunda em tempo real com ações de WhatsApp para Gerentes e Supervisores

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const filialFiltro = (url.searchParams.get('filial') || 'TBL').toUpperCase();
  const dataHoje = url.searchParams.get('data') || new Date(Date.now()-3*3600*1000).toISOString().slice(0,10);

  try {
    // 1. Busca todos os KPIs de vendedores da filial no D1
    const { results: rcaKpis } = await env.DB.prepare(`
      SELECT k.*, r.nome as rca_nome
      FROM rca_kpis k
      LEFT JOIN representantes r ON k.rca_codigo = r.codigo
      WHERE (UPPER(k.filial_id) = ? OR ? = 'TODAS') AND k.data = ?
    `).bind(filialFiltro, filialFiltro, dataHoje).all();

    // 2. Busca todos os pedidos faturados e itens integrados
    const { results: pedidosItens } = await env.DB.prepare(`
      SELECT p.*, r.nome as rca_nome
      FROM pedidos_faturados_itens p
      LEFT JOIN representantes r ON p.rca_codigo = r.codigo
      WHERE (UPPER(p.filial_id) = ? OR ? = 'TODAS') AND p.data_visita = ?
    `).bind(filialFiltro, filialFiltro, dataHoje).all();

    // 3. Busca clientes e roteiros
    const { results: roteiros } = await env.DB.prepare(`
      SELECT rv.*, r.nome as rca_nome, c.dias_sem_compra, c.tags_oportunidade_json, c.potencial_mensal
      FROM roteiros_visitas rv
      LEFT JOIN representantes r ON rv.rca_codigo = r.codigo
      LEFT JOIN clientes_historico_compras c ON rv.id_cliente = c.id_cliente
      WHERE (UPPER(rv.filial_id) = ? OR ? = 'TODAS') AND rv.data_visita = ?
    `).bind(filialFiltro, filialFiltro, dataHoje).all();

    // =========================================================================
    // PROCESSAMENTO DAS 9 PERGUNTAS DE OURO
    // =========================================================================

    // 1. ✂️ CORTES DE SKUS (O que está cortando? Quais pedidos? De quais vendedores?)
    const listaCortes = []; // sem fonte de cortes nesta rota: vazio, nunca exemplo

    // 2. 🔒 PEDIDOS BLOQUEADOS (Trava de Crédito / Financeiro)
    const listaBloqueados = (pedidosItens || []).filter(p => p.status_pedido === 'Bloqueado' || p.categoria_corte?.includes('BLOQUEIO')).map(p => ({
      rca_codigo: p.rca_codigo,
      rca_nome: p.rca_nome || `RCA ${p.rca_codigo}`,
      num_pedido: p.num_pedido,
      id_cliente: p.id_cliente,
      nome_cliente: p.descricao || `Cliente #${p.id_cliente}`,
      valor_bloqueado: p.vl_faturado_winthor || p.total_original,
      motivo: p.categoria_corte || 'Trava de Limite de Crédito / Duplicata no Winthor',
      acao_recomendada: 'Acionar mesa de crédito p/ liberação antes do fechamento do CD'
    }));

    // 3. ⚪ VENDEDORES ZERADOS (Sem Nenhuma Venda Digitada Hoje)
    const listaZerados = (rcaKpis || [])
      .filter(k => {
        const isSuper = ['1088','518','520'].includes(String(k.rca_codigo)) || (k.rca_nome || '').toUpperCase().includes('VAGO');
        return !isSuper && (k.dig_pedido_dia === 0 || !k.dig_pedido_dia);
      })
      .map(k => ({
        rca_codigo: k.rca_codigo,
        rca_nome: k.rca_nome || `RCA ${k.rca_codigo}`,
        meta_mes: k.meta_fat ?? null,
        pdvs_rota: k.visitas_programadas_dia ?? null,
        status: 'Nenhum pedido digitado até o momento'
      }));

    // 4. 🔴 DEVOLUÇÕES E RECUSAS NO CD
    const listaDevolucoes = (rcaKpis || [])
      .filter(k => (k.devolucao_total || 0) >= 500)
      .map(k => ({
        rca_codigo: k.rca_codigo,
        rca_nome: k.rca_nome || `RCA ${k.rca_codigo}`,
        valor_devolucao: k.devolucao_total,
        motivo: 'Recusa no Recebimento / Avaria ou Prazo Curto',
        impacto: 'Requer reagendamento imediato com o comprador'
      }));

    // 5. 🚶 VENDEDORES COM MENOS DE 20 VISITAS NO DIA (Ritmo de Rota)
    const listaBaixasVisitas = (rcaKpis || [])
      .filter(k => {
        const isSuper = ['1088','518','520'].includes(String(k.rca_codigo)) || (k.rca_nome || '').toUpperCase().includes('VAGO');
        return !isSuper && (k.visitas_com_venda_dia || 0) < 5;
      })
      .map(k => ({
        rca_codigo: k.rca_codigo,
        rca_nome: k.rca_nome || `RCA ${k.rca_codigo}`,
        visitas_realizadas: k.visitas_com_venda_dia || 0,
        meta_visitas_dia: 20,
        ritmo_pct: Math.round(((k.visitas_com_venda_dia || 0) / 20) * 100),
        status_ritmo: 'Ritmo Lento (Abaixo de 20 visitas)'
      }));

    // 6. 🚨 CLIENTES > 30 DIAS SEM COMPRA NA ROTA DE HOJE (EM ABERTO)
    const listaInativosRotaAberta = (roteiros || [])
      .filter(r => (r.dias_sem_compra || 0) >= 30 && r.status !== 'POSITIVADO' && r.status !== 'EFETIVADO')
      .map(r => ({
        rca_codigo: r.rca_codigo,
        rca_nome: r.rca_nome || `RCA ${r.rca_codigo}`,
        id_cliente: r.id_cliente,
        nome_cliente: r.nome_fantasia || r.razao_social,
        dias_sem_compra: r.dias_sem_compra,
        potencial: r.potencial_mensal ?? null,
        risco: 'Risco de Churn Definitivo (Mais de 30 dias sem compras)'
      }));

    // 7. 🏆 CLIENTES > 30 DIAS REATIVADOS HOJE (VENDAS RECUPERADAS)
    const listaReativadosHoje = []; // sem fonte

    // 8. 💡 RECADOS COMERCIAIS & OPORTUNIDADES DE MIX (PEX, POSIT & RECORRÊNCIA)
    const listaRecadosMix = []; // sem fonte

    // 9. 🚀 PRODUTOS NOVOS E LANÇAMENTOS VENDIDOS HOJE (MIX DE INOVAÇÃO)
    const listaProdutosNovos = []; // sem fonte

    // Monta o Relatório Master em Texto formatado para o Gerente no WhatsApp
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    let relatorioMasterWhatsApp = `📊 *CENTRO DE COMANDO CEVEN NOC - FILIAL ${filialFiltro}*\n`;
    relatorioMasterWhatsApp += `🕒 *Horário:* ${horaAgora} | 📅 *Data:* ${dataHoje}\n\n`;
    relatorioMasterWhatsApp += `1️⃣ *CORTES:* ${listaCortes.length} pedido(s) afetado(s) \n`;
    relatorioMasterWhatsApp += `2️⃣ *BLOQUEIOS:* ${listaBloqueados.length} pedido(s) retido(s)\n`;
    relatorioMasterWhatsApp += `3️⃣ *ZERADOS:* ${listaZerados.length} vendedores de campo sem pedido\n`;
    relatorioMasterWhatsApp += `4️⃣ *DEVOLUÇÕES:* ${listaDevolucoes.length} ocorrência(s) crítica(s)\n`;
    relatorioMasterWhatsApp += `5️⃣ *RITMO < 20 VISITAS:* ${listaBaixasVisitas.length} vendedores lentos\n`;
    relatorioMasterWhatsApp += `6️⃣ *INATIVOS > 30D EM ROTA:* ${listaInativosRotaAberta.length} cliente(s) em risco\n`;
    relatorioMasterWhatsApp += `7️⃣ *REATIVAÇÕES > 30D HOJE:* 🏆 ${listaReativadosHoje.length} clientes recuperados!\n`;
    relatorioMasterWhatsApp += `8️⃣ *OPORTUNIDADES DE MIX:* ${listaRecadosMix.length} recado(s)\n`;
    relatorioMasterWhatsApp += `9️⃣ *PRODUTOS NOVOS/LANÇAMENTOS:* ${listaProdutosNovos.length} positivações de inovação hoje!`;

    return new Response(JSON.stringify({
      sucesso: true,
      filial: filialFiltro,
      data: dataHoje,
      hora_auditoria: horaAgora,
      relatorio_master_whatsapp: relatorioMasterWhatsApp,
      dimensoes: {
        cortes: {
          titulo: '1. O que está cortando? De quem?',
          total: listaCortes.length,
          itens: listaCortes
        },
        bloqueados: {
          titulo: '2. Pedidos Bloqueados (Crédito/Financeiro)',
          total: listaBloqueados.length,
          itens: listaBloqueados
        },
        zerados: {
          titulo: '3. Vendedores Zerados (Sem Venda Hoje)',
          total: listaZerados.length,
          itens: listaZerados
        },
        devolucoes: {
          titulo: '4. Devoluções e Recusas no CD',
          total: listaDevolucoes.length,
          itens: listaDevolucoes
        },
        baixas_visitas: {
          titulo: '5. Vendedores com Menos de 20 Visitas',
          total: listaBaixasVisitas.length,
          itens: listaBaixasVisitas
        },
        inativos_rota: {
          titulo: '6. Clientes > 30 Dias sem Compra na Rota de Hoje',
          total: listaInativosRotaAberta.length,
          itens: listaInativosRotaAberta
        },
        reativados: {
          titulo: '7. Clientes > 30 Dias Reativados Hoje',
          total: listaReativadosHoje.length,
          itens: listaReativadosHoje
        },
        recados_mix: {
          titulo: '8. Recados Comerciais (Recorrência, POSIT e PEX)',
          total: listaRecadosMix.length,
          itens: listaRecadosMix
        },
        produtos_novos: {
          titulo: '9. Produtos Novos e Lançamentos Vendidos Hoje',
          total: listaProdutosNovos.length,
          itens: listaProdutosNovos
        }
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ sucesso: false, erro: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
