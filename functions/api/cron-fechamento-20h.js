// =========================================================================
// CRON FECHAMENTO DIÁRIO (20:00 HORÁRIO DE BRASÍLIA)
// Realiza varredura completa de fechamento de todos os 519 RCAs,
// consolida KPIs, devoluções, eficácia de visitas e grava as 11 filiais.
// =========================================================================

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const dataRef = url.searchParams.get('data') || new Date().toISOString().split('T')[0];

  try {
    if (!env || !env.DB) {
      return new Response(JSON.stringify({ status: 'OFFLINE_LOCAL', data: dataRef }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 1. Atualiza consolidado diário de cada uma das 11 filiais
    const consolidadoQuery = `
      INSERT INTO consolidado_diario_filial (
        data_snapshot, filial_id, total_rcas_ativos, rcas_zerados, rcas_sem_acesso_app,
        total_fat_liq, total_meta_fat, pct_atingimento, total_pendente, total_falta,
        total_devolucoes, total_cortes, total_clientes_meta, total_clientes_positivados,
        pct_positivacao_geral, total_visitas_planejadas, total_visitas_efetivadas,
        eficacia_visitas_media, total_oportunidades_mix_estimado, total_prospects_regiao,
        updated_at
      )
      SELECT
        ? as data_snapshot,
        f.codigo as filial_id,
        COUNT(DISTINCT r.codigo) as total_rcas_ativos,
        SUM(CASE WHEN COALESCE(k.fat_liq, 0) = 0 THEN 1 ELSE 0 END) as rcas_zerados,
        SUM(CASE WHEN COALESCE(r.dias_sem_acesso, 0) > 0 THEN 1 ELSE 0 END) as rcas_sem_acesso_app,
        COALESCE(SUM(k.fat_liq), 0) as total_fat_liq,
        COALESCE(SUM(k.meta_fat), 0) as total_meta_fat,
        CASE WHEN SUM(k.meta_fat) > 0 THEN ROUND((SUM(k.fat_liq) / SUM(k.meta_fat)) * 100, 2) ELSE 0 END as pct_atingimento,
        COALESCE(SUM(k.pendente), 0) as total_pendente,
        COALESCE(SUM(k.falta), 0) as total_falta,
        COALESCE(SUM(k.devolucao_total), 0) as total_devolucoes,
        COALESCE(SUM(k.cortes_total), 0) as total_cortes,
        COALESCE(SUM(k.meta_cli), 0) as total_clientes_meta,
        COALESCE(SUM(k.real_cli), 0) as total_clientes_positivados,
        CASE WHEN SUM(k.meta_cli) > 0 THEN ROUND((CAST(SUM(k.real_cli) AS REAL) / SUM(k.meta_cli)) * 100, 2) ELSE 0 END as pct_positivacao_geral,
        COALESCE(rot.total_planejadas, 0) as total_visitas_planejadas,
        COALESCE(rot.total_efetivadas, 0) as total_visitas_efetivadas,
        CASE WHEN rot.total_planejadas > 0 THEN ROUND((CAST(rot.total_efetivadas AS REAL) / rot.total_planejadas) * 100, 1) ELSE 0 END as eficacia_visitas_media,
        COALESCE(mix.total_mix, 0) as total_oportunidades_mix_estimado,
        COALESCE(pros.total_prospects, 0) as total_prospects_regiao,
        CURRENT_TIMESTAMP as updated_at
      FROM filiais f
      JOIN representantes r ON f.id = r.filial_id
      LEFT JOIN rca_kpis k ON r.codigo = k.rca_codigo AND k.data = ?
      LEFT JOIN (
        SELECT filial_id, COUNT(*) as total_planejadas, SUM(CASE WHEN status = 'POSITIVADO' THEN 1 ELSE 0 END) as total_efetivadas
        FROM roteiros_visitas WHERE data_visita = ? GROUP BY filial_id
      ) rot ON f.codigo = rot.filial_id
      LEFT JOIN (
        SELECT filial_id, SUM(impacto_total_estimado) as total_mix
        FROM oportunidades_mix_gap WHERE data_snapshot = ? GROUP BY filial_id
      ) mix ON f.codigo = mix.filial_id
      LEFT JOIN (
        SELECT filial_id, COUNT(*) as total_prospects
        FROM prospects_receita GROUP BY filial_id
      ) pros ON f.codigo = pros.filial_id
      GROUP BY f.codigo
      ON CONFLICT(data_snapshot, filial_id) DO UPDATE SET
        total_rcas_ativos = excluded.total_rcas_ativos,
        rcas_zerados = excluded.rcas_zerados,
        rcas_sem_acesso_app = excluded.rcas_sem_acesso_app,
        total_fat_liq = excluded.total_fat_liq,
        total_meta_fat = excluded.total_meta_fat,
        pct_atingimento = excluded.pct_atingimento,
        total_pendente = excluded.total_pendente,
        total_falta = excluded.total_falta,
        total_devolucoes = excluded.total_devolucoes,
        total_cortes = excluded.total_cortes,
        total_clientes_meta = excluded.total_clientes_meta,
        total_clientes_positivados = excluded.total_clientes_positivados,
        pct_positivacao_geral = excluded.pct_positivacao_geral,
        total_visitas_planejadas = excluded.total_visitas_planejadas,
        total_visitas_efetivadas = excluded.total_visitas_efetivadas,
        eficacia_visitas_media = excluded.eficacia_visitas_media,
        total_oportunidades_mix_estimado = excluded.total_oportunidades_mix_estimado,
        total_prospects_regiao = excluded.total_prospects_regiao,
        updated_at = CURRENT_TIMESTAMP;
    `;

    await env.DB.prepare(consolidadoQuery).bind(dataRef, dataRef, dataRef, dataRef).run();

    const { results } = await env.DB.prepare(`
      SELECT * FROM consolidado_diario_filial WHERE data_snapshot = ? ORDER BY total_fat_liq DESC
    `).bind(dataRef).all();

    return new Response(JSON.stringify({
      sucesso: true,
      executado_em: '20:00 (Fechamento Diário)',
      data_fechamento: dataRef,
      filiais_consolidadas: results.length,
      dados: results
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
