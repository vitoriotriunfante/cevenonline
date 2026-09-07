// =========================================================================
// API CONSOLIDADOR DIÁRIO CEVEN NOC
// Executa varredura de KPIs, fecha o dia, persiste snapshots sem duplicação
// e arquiva o consolidado das 11 filiais e oportunidades de +MIX.
// =========================================================================

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const dataRef = url.searchParams.get('data') || new Date().toISOString().split('T')[0];

  try {
    if (!env || !env.DB) {
      return new Response(JSON.stringify({
        status: 'OFFLINE_LOCAL',
        message: 'Banco D1 não vinculado neste ambiente',
        data_fechamento: dataRef
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 1. Garante que as tabelas de consolidação existam
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS consolidado_diario_filial (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_snapshot DATE NOT NULL,
        filial_id TEXT NOT NULL,
        total_rcas_ativos INTEGER DEFAULT 0,
        rcas_zerados INTEGER DEFAULT 0,
        total_fat_liq REAL DEFAULT 0,
        total_meta_fat REAL DEFAULT 0,
        pct_atingimento REAL DEFAULT 0,
        total_pendente REAL DEFAULT 0,
        total_falta REAL DEFAULT 0,
        total_devolucoes REAL DEFAULT 0,
        total_clientes_meta INTEGER DEFAULT 0,
        total_clientes_positivados INTEGER DEFAULT 0,
        pct_positivacao_geral REAL DEFAULT 0,
        total_visitas_planejadas INTEGER DEFAULT 0,
        total_visitas_efetivadas INTEGER DEFAULT 0,
        total_oportunidades_mix_estimado REAL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(data_snapshot, filial_id)
      );

      CREATE TABLE IF NOT EXISTS oportunidades_mix_gap (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_snapshot DATE NOT NULL,
        rca_codigo TEXT NOT NULL,
        filial_id TEXT NOT NULL,
        target_cnpj TEXT NOT NULL,
        id_cliente TEXT,
        razao_social TEXT,
        total_universo INTEGER DEFAULT 0,
        impacto_total_estimado REAL DEFAULT 0,
        industria TEXT NOT NULL,
        n_vizinhos_compram INTEGER DEFAULT 0,
        penetracao_pct REAL DEFAULT 0,
        impacto_industria REAL DEFAULT 0,
        produtos_top_json TEXT,
        vizinhos_compram_json TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(data_snapshot, rca_codigo, target_cnpj, industria)
      );
    `);

    // 2. Executa a agregação e upsert na tabela consolidado_diario_filial para todas as 11 filiais
    const consolidadoQuery = `
      INSERT INTO consolidado_diario_filial (
        data_snapshot, filial_id, total_rcas_ativos, rcas_zerados, total_fat_liq, total_meta_fat,
        pct_atingimento, total_pendente, total_falta, total_devolucoes, total_clientes_meta,
        total_clientes_positivados, pct_positivacao_geral, total_visitas_planejadas,
        total_visitas_efetivadas, total_oportunidades_mix_estimado, updated_at
      )
      SELECT
        ? as data_snapshot,
        f.codigo as filial_id,
        COUNT(DISTINCT r.codigo) as total_rcas_ativos,
        SUM(CASE WHEN COALESCE(k.fat_liq, 0) = 0 THEN 1 ELSE 0 END) as rcas_zerados,
        COALESCE(SUM(k.fat_liq), 0) as total_fat_liq,
        COALESCE(SUM(k.meta_fat), 0) as total_meta_fat,
        CASE WHEN SUM(k.meta_fat) > 0 THEN ROUND((SUM(k.fat_liq) / SUM(k.meta_fat)) * 100, 2) ELSE 0 END as pct_atingimento,
        COALESCE(SUM(k.pendente), 0) as total_pendente,
        COALESCE(SUM(k.falta), 0) as total_falta,
        COALESCE(SUM(k.devolucao_total), 0) as total_devolucoes,
        COALESCE(SUM(k.meta_cli), 0) as total_clientes_meta,
        COALESCE(SUM(k.real_cli), 0) as total_clientes_positivados,
        CASE WHEN SUM(k.meta_cli) > 0 THEN ROUND((CAST(SUM(k.real_cli) AS REAL) / SUM(k.meta_cli)) * 100, 2) ELSE 0 END as pct_positivacao_geral,
        COALESCE(rot.total_planejadas, 0) as total_visitas_planejadas,
        COALESCE(rot.total_efetivadas, 0) as total_visitas_efetivadas,
        COALESCE(mix.total_mix, 0) as total_oportunidades_mix_estimado,
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
      GROUP BY f.codigo
      ON CONFLICT(data_snapshot, filial_id) DO UPDATE SET
        total_rcas_ativos = excluded.total_rcas_ativos,
        rcas_zerados = excluded.rcas_zerados,
        total_fat_liq = excluded.total_fat_liq,
        total_meta_fat = excluded.total_meta_fat,
        pct_atingimento = excluded.pct_atingimento,
        total_pendente = excluded.total_pendente,
        total_falta = excluded.total_falta,
        total_devolucoes = excluded.total_devolucoes,
        total_clientes_meta = excluded.total_clientes_meta,
        total_clientes_positivados = excluded.total_clientes_positivados,
        pct_positivacao_geral = excluded.pct_positivacao_geral,
        total_visitas_planejadas = excluded.total_visitas_planejadas,
        total_visitas_efetivadas = excluded.total_visitas_efetivadas,
        total_oportunidades_mix_estimado = excluded.total_oportunidades_mix_estimado,
        updated_at = CURRENT_TIMESTAMP;
    `;

    await env.DB.prepare(consolidadoQuery).bind(dataRef, dataRef, dataRef, dataRef).run();

    // 3. Retorna o relatório consolidado gerado
    const { results: filiaisConsolidadas } = await env.DB.prepare(`
      SELECT * FROM consolidado_diario_filial WHERE data_snapshot = ? ORDER BY total_fat_liq DESC
    `).bind(dataRef).all();

    return new Response(JSON.stringify({
      sucesso: true,
      data_fechamento: dataRef,
      total_filiais_processadas: filiaisConsolidadas.length,
      resumo: filiaisConsolidadas
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
