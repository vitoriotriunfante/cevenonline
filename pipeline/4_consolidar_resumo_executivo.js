/**
 * ============================================================================
 * PIPELINE 4 — CONSOLIDAR RESUMO EXECUTIVO
 * Frequência: Chamado pelo pipeline 3 ao final, ou sob demanda
 * O que faz: Lê rca_kpis do dia, calcula totais por filial e Grupo,
 *            grava JSON compacto em consolidado_executivo_live.
 *            Tempo de execução: < 500ms (apenas queries SQL no D1).
 *
 * Usar quando: Precisa recalcular o consolidado sem refazer os 519 fetches.
 * ============================================================================
 */

const FILIAIS_SIGLAS = ['TBL', 'TCV', 'TPH', 'TSJ', 'TCA', 'ABC', 'TPA', 'TBE', 'API', 'MCD', 'TCG'];
const FILIAIS_MAP = {
  TBL: 'tbl1', TCV: 'tcv1', TPH: 'tph1', TSJ: 'tsj1', TCA: 'tca1',
  ABC: 'abc1', TPA: 'tpa1', TBE: 'tbe1', API: 'api1', MCD: 'mcd1', TCG: 'tcg1'
};

/**
 * Reconsolida o resumo executivo a partir dos KPIs já gravados no D1.
 * @param {D1Database} db - Binding do Cloudflare D1
 * @param {string} dataHoje - Data no formato YYYY-MM-DD
 * @param {string} horaAtual - Hora no formato HH:MM
 * @returns {Object} Resultado consolidado
 */
export async function consolidarResumoExecutivo(db, dataHoje, horaAtual) {
  const resultado = { filiais: [], grupo: null };

  let grupoFat = 0, grupoMeta = 0, grupoMetaCli = 0, grupoRealCli = 0;
  let grupoRcas = 0, grupoZerados = 0, grupoComVenda = 0;

  for (const sigla of FILIAIS_SIGLAS) {
    // Agregar todos os RCAs da filial do dia
    const { results } = await db.prepare(`
      SELECT
        COUNT(*) as total_rcas,
        SUM(CASE WHEN fat_liq = 0 AND dig_pedido_dia = 0 THEN 1 ELSE 0 END) as zerados,
        SUM(CASE WHEN fat_liq > 0 OR dig_pedido_dia > 0 THEN 1 ELSE 0 END) as com_venda,
        COALESCE(SUM(fat_liq), 0) as fat_total,
        COALESCE(SUM(meta_fat), 0) as meta_total,
        COALESCE(SUM(pendente), 0) as pendente_total,
        COALESCE(SUM(devolucao_total), 0) as dev_total,
        COALESCE(SUM(meta_cli), 0) as meta_cli_total,
        COALESCE(SUM(real_cli), 0) as real_cli_total,
        COALESCE(SUM(visitas_programadas_dia), 0) as visitas_plan,
        COALESCE(SUM(visitas_na_rota_dia), 0) as visitas_real
      FROM rca_kpis
      WHERE data = ? AND filial_id = ?
    `).bind(dataHoje, sigla).all();

    const agg = results?.[0] || {};

    // Top 5 RCAs da filial
    const { results: topRows } = await db.prepare(`
      SELECT rca_codigo as codigo, fat_liq, pct_fat, meta_fat
      FROM rca_kpis
      WHERE data = ? AND filial_id = ?
      ORDER BY fat_liq DESC
      LIMIT 5
    `).bind(dataHoje, sigla).all();

    // Lista de zerados
    const { results: zeradosRows } = await db.prepare(`
      SELECT rca_codigo as codigo, meta_fat, visitas_programadas_dia as visitas_rota
      FROM rca_kpis
      WHERE data = ? AND filial_id = ? AND fat_liq = 0 AND (dig_pedido_dia = 0 OR dig_pedido_dia IS NULL)
      ORDER BY meta_fat DESC
      LIMIT 20
    `).bind(dataHoje, sigla).all();

    // Buscar nomes dos RCAs para os tops e zerados
    async function enrichWithNames(rows) {
      for (const r of rows) {
        const rep = await db.prepare(
          `SELECT nome FROM representantes WHERE codigo = ?`
        ).bind(r.codigo).first();
        r.nome = rep?.nome || `RCA ${r.codigo}`;
      }
      return rows;
    }

    const top5 = await enrichWithNames(topRows || []);
    const zeradosList = await enrichWithNames(zeradosRows || []);

    const fatTotal = agg.fat_total || 0;
    const metaTotal = agg.meta_total || 0;
    const pctFat = metaTotal > 0 ? parseFloat(((fatTotal / metaTotal) * 100).toFixed(1)) : 0;
    const metaCliTotal = agg.meta_cli_total || 0;
    const realCliTotal = agg.real_cli_total || 0;
    const pctPos = metaCliTotal > 0 ? parseFloat(((realCliTotal / metaCliTotal) * 100).toFixed(1)) : 0;
    const rcasTotal = agg.total_rcas || 0;
    const rcasZerados = agg.zerados || 0;
    const rcasComVenda = agg.com_venda || 0;
    const ticketMedio = rcasComVenda > 0 ? parseFloat((fatTotal / rcasComVenda).toFixed(2)) : 0;

    // UPSERT no consolidado
    await db.prepare(`
      INSERT OR REPLACE INTO consolidado_executivo_live (
        filial_id, filial_sigla, data_ref, hora_snapshot,
        fat_liq_total, meta_fat_total, pct_fat, pendente_total,
        devolucoes_total,
        meta_cli_total, real_cli_total, pct_pos,
        rcas_ativos, rcas_zerados, rcas_com_venda,
        visitas_plan, visitas_real,
        ticket_medio,
        top5_rcas_json, zerados_json,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      FILIAIS_MAP[sigla], sigla, dataHoje, horaAtual,
      fatTotal, metaTotal, pctFat, agg.pendente_total || 0,
      agg.dev_total || 0,
      metaCliTotal, realCliTotal, pctPos,
      rcasTotal, rcasZerados, rcasComVenda,
      agg.visitas_plan || 0, agg.visitas_real || 0,
      ticketMedio,
      JSON.stringify(top5), JSON.stringify(zeradosList)
    ).run();

    resultado.filiais.push({ sigla, fat: fatTotal, meta: metaTotal, pct: pctFat, rcas: rcasTotal, zerados: rcasZerados });

    grupoFat += fatTotal;
    grupoMeta += metaTotal;
    grupoMetaCli += metaCliTotal;
    grupoRealCli += realCliTotal;
    grupoRcas += rcasTotal;
    grupoZerados += rcasZerados;
    grupoComVenda += rcasComVenda;
  }

  // Linha de GRUPO
  await db.prepare(`
    INSERT OR REPLACE INTO consolidado_executivo_live (
      filial_id, filial_sigla, data_ref, hora_snapshot,
      fat_liq_total, meta_fat_total, pct_fat,
      meta_cli_total, real_cli_total, pct_pos,
      rcas_ativos, rcas_zerados, rcas_com_venda,
      ticket_medio,
      updated_at
    ) VALUES ('GRUPO', 'GRUPO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    dataHoje, horaAtual,
    grupoFat, grupoMeta,
    grupoMeta > 0 ? parseFloat(((grupoFat / grupoMeta) * 100).toFixed(1)) : 0,
    grupoMetaCli, grupoRealCli,
    grupoMetaCli > 0 ? parseFloat(((grupoRealCli / grupoMetaCli) * 100).toFixed(1)) : 0,
    grupoRcas, grupoZerados, grupoComVenda,
    grupoComVenda > 0 ? parseFloat((grupoFat / grupoComVenda).toFixed(2)) : 0
  ).run();

  resultado.grupo = {
    fat: grupoFat, meta: grupoMeta,
    pct: grupoMeta > 0 ? parseFloat(((grupoFat / grupoMeta) * 100).toFixed(1)) : 0,
    rcas: grupoRcas, zerados: grupoZerados
  };

  console.log(`📊 Consolidado: R$ ${grupoFat.toLocaleString('pt-BR')} / R$ ${grupoMeta.toLocaleString('pt-BR')} | ${grupoRcas} RCAs | ${grupoZerados} zerados`);
  return resultado;
}
