export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const filialSigla = (url.searchParams.get('filial') || 'TBL').toUpperCase();

    // Mapeamento de Sigla para filial_id no D1
    const filialMap = {
      'TBL': 'tbl1',
      'TPH': 'tph1',
      'TCV': 'tcv1',
      'TCA': 'tca1',
      'MCD': 'mcd1',
      'TCG': 'tcg1',
      'ABC': 'abc1',
      'API': 'api1',
      'TBE': 'tbe1',
      'TPA': 'tpa1',
      'TSJ': 'tsj1'
    };

    const filialId = filialMap[filialSigla] || 'tbl1';

    // 1. Busca Cortes Reais da Filial
    let cortes = [];
    try {
      const cRes = await env.DB.prepare(`
        SELECT numped, rca_codigo, rca_nome, codcli, nomecli, cnpj, sku_cortado, qtd_cortada, vl_corte, motivo_corte
        FROM pedidos_cortes
        WHERE filial_id = ?
        LIMIT 10
      `).bind(filialId).all();
      cortes = cRes.results || [];
    } catch (_) {}

    // 2. Busca Vendedores Reais com Faturamento Zerado no Mês/Dia na Filial
    let zerados = [];
    try {
      const zRes = await env.DB.prepare(`
        SELECT r.codigo, r.nome, k.meta_fat, k.fat_liq, k.pendente, k.meta_cli, k.real_cli,
               (SELECT COUNT(*) FROM roteiros_visitas v WHERE v.rca_codigo = r.codigo AND v.data_visita = CURRENT_DATE) as total_visitas_hoje
        FROM representantes r
        LEFT JOIN rca_kpis k ON r.codigo = k.rca_codigo AND k.data = CURRENT_DATE
        WHERE r.filial_id = ? AND (k.fat_liq = 0 OR k.fat_liq IS NULL) AND r.nome != 'VAGO'
        ORDER BY k.meta_fat DESC
        LIMIT 6
      `).bind(filialId).all();
      zerados = zRes.results || [];
    } catch (_) {}

    // 3. Busca Devoluções Reais da Filial
    let devolucoes = [];
    try {
      const dRes = await env.DB.prepare(`
        SELECT numnota, data, codcli, nomecli, rca_codigo, rca_nome, vl_devolvido, motivo_devolucao
        FROM devolucoes_auditoria
        WHERE filial_id = ?
        ORDER BY vl_devolvido DESC
        LIMIT 6
      `).bind(filialId).all();
      devolucoes = dRes.results || [];
    } catch (_) {}

    // 4. Busca Anomalias de Rota (Planejado vs Mapa) da Filial
    let anomalias = [];
    try {
      const aRes = await env.DB.prepare(`
        SELECT rca_codigo, rca_nome, total_planejado, total_mapa, diferenca, clientes_suprimidos
        FROM anomalias_roteiro_auditoria
        WHERE filial_id = ? AND data_auditoria = CURRENT_DATE
        ORDER BY diferenca DESC
        LIMIT 6
      `).bind(filialId).all();
      anomalias = aRes.results || [];
    } catch (_) {}

    // 0. Busca Alertas Recentes Gerados pelo Radar Horário
    let radarAlerts = [];
    try {
      const raRes = await env.DB.prepare(`
        SELECT id, filial_id, tipo, titulo, mensagem, detalhes_json, created_at
        FROM flash_alerts
        WHERE UPPER(filial_id) = ? OR UPPER(filial_id) = ? OR filial_id = 'TODAS'
        ORDER BY created_at DESC
        LIMIT 10
      `).bind(filialSigla, filialId).all();
      radarAlerts = raRes.results || [];
    } catch (_) {}

    const alerts = [];

    // Adiciona Alertas do Radar Horário
    radarAlerts.forEach((ra, idx) => {
      alerts.push({
        id: `radar_${ra.id || idx}`,
        tipo: ra.tipo,
        titulo: ra.titulo,
        mensagem: ra.mensagem,
        detalhes: ra.detalhes_json ? JSON.parse(ra.detalhes_json) : {},
        impacto: ra.tipo === 'flash_venda' ? '⚡ Salto Comercial' : ra.tipo === 'meta_batida' ? '🏆 100% Batida' : '⚠️ Atenção Tática',
        afetados: `Filial ${ra.filial_id}`,
        acao: ra.tipo === 'meta_batida' ? 'Reconhecimento / Parabéns' : 'Acompanhamento do Supervisor',
        duracao_min: 5,
        created_at: ra.created_at
      });
    });

    // Alerta 1: Cortes Reais
    if (cortes.length > 0) {
      const totalPerda = cortes.reduce((acc, c) => acc + (c.vl_corte || 0), 0);
      alerts.push({
        id: 1,
        tipo: 'corte_massa',
        titulo: `ALERTA DE CORTE COLETIVO: ${cortes[0].sku_cortado}`,
        mensagem: `Detectados cortes comerciais no SKU ${cortes[0].sku_cortado} na filial ${filialSigla}.`,
        impacto: `R$ ${totalPerda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        afetados: `${cortes.length} pedidos afetados`,
        acao: 'Ajustar Estoque no CD / Notificar Vendedores',
        duracao_min: 5,
        pedidos_lista: cortes.map(c => ({
          pedido: `#${c.numped}`,
          rca: `${c.rca_nome} (${c.rca_codigo})`,
          cliente: c.nomecli,
          item: `${c.qtd_cortada}un · ${c.sku_cortado}`,
          perda: `R$ ${(c.vl_corte || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          fone: '554399623169'
        }))
      });
    }

    // Alerta 2: Vendedores Zerados Reais de TBL
    if (zerados.length > 0) {
      const totalMetaPerdida = zerados.reduce((acc, z) => acc + (z.meta_fat || 0), 0);
      alerts.push({
        id: 2,
        tipo: 'zero_vendas',
        titulo: `VENDEDORES AINDA SEM FATURAMENTO (${filialSigla})`,
        mensagem: `${zerados.length} representantes cadastrados em ${filialSigla} ainda não pontuaram faturamento líquido hoje.`,
        impacto: `R$ ${totalMetaPerdida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        afetados: `${zerados.length} Vendedores Zerados`,
        acao: 'Cobrar Vendedores via WhatsApp',
        duracao_min: 5,
        pedidos_lista: zerados.map(z => ({
          pedido: 'SEM FATURAMENTO',
          rca: `${z.nome} (${z.codigo})`,
          cliente: `${z.total_visitas_hoje || 0} Visitas Agendadas`,
          item: `Meta Mês: R$ ${(z.meta_fat || 0).toLocaleString('pt-BR')}`,
          perda: `R$ ${(z.meta_fat || 0).toLocaleString('pt-BR')}`,
          fone: '554399623169'
        }))
      });
    }

    // Alerta 3: Devoluções Reais
    if (devolucoes.length > 0) {
      const totalDev = devolucoes.reduce((acc, d) => acc + (d.vl_devolvido || 0), 0);
      alerts.push({
        id: 3,
        tipo: 'devolucoes',
        titulo: `PICO DE DEVOLUÇÕES REGISTRADAS (${filialSigla})`,
        mensagem: `Total de R$ ${totalDev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em devoluções acumuladas na filial ${filialSigla}.`,
        impacto: `R$ ${totalDev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        afetados: `${devolucoes.length} NF Devolvidas`,
        acao: 'Visita Presencial p/ Reversão',
        duracao_min: 5,
        pedidos_lista: devolucoes.map(d => ({
          pedido: `NF #${d.numnota}`,
          rca: `${d.rca_nome || 'RCA'} (${d.rca_codigo})`,
          cliente: d.nomecli,
          item: d.motivo_devolucao || 'Sem Justificativa',
          perda: `R$ ${(d.vl_devolvido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          fone: '554399623169'
        }))
      });
    }

    // Alerta 4: Anomalias de Rota Reais
    if (anomalias.length > 0) {
      const totalSuprimidos = anomalias.reduce((acc, a) => acc + (a.diferenca || 0), 0);
      alerts.push({
        id: 4,
        tipo: 'anomalias_rota',
        titulo: `DIVERGÊNCIA DE ROTA: MAPA VS PLANEJADO (${filialSigla})`,
        mensagem: `${anomalias.length} vendedores de ${filialSigla} possuem visitas planejadas suprimidas no mapa do aplicativo.`,
        impacto: `${totalSuprimidos} Visitas Fora do Mapa`,
        afetados: `${anomalias.length} RCAs Afetados`,
        acao: 'Enviar Lista Nominal no WhatsApp',
        duracao_min: 5,
        pedidos_lista: anomalias.map(a => ({
          pedido: `${a.diferenca} Fora do Mapa`,
          rca: `${a.rca_nome} (${a.rca_codigo})`,
          cliente: `${a.total_planejado} no ERP vs ${a.total_mapa} no Mapa`,
          item: 'Filtro OSRM Indevido',
          perda: 'Risco de Positivação',
          fone: '554399623169'
        }))
      });
    }

    return new Response(JSON.stringify({ filial: filialSigla, alerts }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
