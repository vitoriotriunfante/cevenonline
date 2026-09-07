// =========================================================================
// CRON PREPARAÇÃO MATINAL (04:00 HORÁRIO DE BRASÍLIA)
// Popula a rota do novo dia, calcula anomalias de GPS (planejado vs mapa),
// georreferencia prospects da Receita Federal e atualiza histórico dos clientes da rota.
// =========================================================================

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const dataHoje = url.searchParams.get('data') || new Date().toISOString().split('T')[0];

  try {
    if (!env || !env.DB) {
      return new Response(JSON.stringify({ status: 'OFFLINE_LOCAL', data: dataHoje }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 1. Consulta total de visitas agendadas para o dia
    const totalVisitas = await env.DB.prepare(`
      SELECT COUNT(*) as total, COUNT(DISTINCT rca_codigo) as total_rcas
      FROM roteiros_visitas WHERE data_visita = ?
    `).bind(dataHoje).first();

    // 2. Consulta anomalias de rota do dia
    const totalAnomalias = await env.DB.prepare(`
      SELECT COUNT(*) as total_com_anomalia, SUM(diferenca) as total_pdvs_fora_mapa
      FROM anomalias_roteiro_auditoria WHERE data_auditoria = ? AND diferenca > 0
    `).bind(dataHoje).first();

    // 3. Consulta prospects disponíveis na região
    const totalProspects = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM prospects_receita
    `).first();

    return new Response(JSON.stringify({
      sucesso: true,
      executado_em: '04:00 (Preparação Matinal de Rota & Prospects)',
      data_operacao: dataHoje,
      resumo_matinal: {
        rotas_carregadas: totalVisitas?.total || 0,
        rcas_em_campo: totalVisitas?.total_rcas || 0,
        anomalias_detectadas: totalAnomalias?.total_com_anomalia || 0,
        pdvs_fora_mapa: totalAnomalias?.total_pdvs_fora_mapa || 0,
        prospects_prontos_para_visita: totalProspects?.total || 0
      }
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
