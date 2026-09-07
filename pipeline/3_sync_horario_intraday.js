/**
 * ============================================================================
 * PIPELINE 3 — SYNC HORÁRIO INTRADAY (09:00 às 18:00 BRT, de hora em hora)
 * Frequência: De hora em hora via GitHub Actions
 * O que faz:
 *   1. Varre 519 RCAs em lotes de 10 (controle de concorrência)
 *   2. Atualiza rca_kpis com fat_liq, positivação, pendente atual
 *   3. Detecta mudanças: pedidos desbloqueados, novas vendas, zerados
 *   4. Chama pipeline 4 para consolidar o resumo executivo
 *
 * IMPORTANTE: Os 519 fetches são NECESSÁRIOS porque a API do CEVEN só
 * expõe dados por RCA individual. Não existe endpoint de filial consolidada.
 * ============================================================================
 */

const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';

const FILIAIS = [
  { id: 'tbl1', codigo: 'TBL' }, { id: 'tcv1', codigo: 'TCV' },
  { id: 'tph1', codigo: 'TPH' }, { id: 'tsj1', codigo: 'TSJ' },
  { id: 'tca1', codigo: 'TCA' }, { id: 'abc1', codigo: 'ABC' },
  { id: 'tpa1', codigo: 'TPA' }, { id: 'tbe1', codigo: 'TBE' },
  { id: 'api1', codigo: 'API' }, { id: 'mcd1', codigo: 'MCD' },
  { id: 'tcg1', codigo: 'TCG' }
];

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (CEVEN-NOC-Pipeline/3.0)' },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Executa a varredura horária de todos os 519 RCAs.
 * @param {D1Database} db - Binding do Cloudflare D1
 * @param {string} dataHoje - Data no formato YYYY-MM-DD
 * @param {string} horaAtual - Hora no formato HH:MM
 * @returns {Object} Resultado com totais e alertas detectados
 */
export async function syncHorarioIntraday(db, dataHoje, horaAtual) {
  const resultado = {
    rcas_processados: 0,
    alertas: [],
    erros: [],
    filiais_resumo: {}
  };

  // 1. Buscar estado anterior de cada RCA no D1 para comparar deltas
  const { results: kpisAnteriores } = await db.prepare(
    `SELECT rca_codigo, filial_id, fat_liq, pendente, real_cli, meta_cli, meta_fat, devolucao_total, pct_fat
     FROM rca_kpis WHERE data = ?`
  ).bind(dataHoje).all();

  const estadoAnterior = {};
  for (const k of (kpisAnteriores || [])) {
    estadoAnterior[k.rca_codigo] = k;
  }

  // 2. Processar filial por filial
  for (const fil of FILIAIS) {
    const rcasList = await fetchJson(`${CEVEN_BASE}/api/rcas?filial=${fil.id}`);
    if (!rcasList || !Array.isArray(rcasList)) {
      resultado.erros.push(`Sem RCAs em ${fil.codigo}`);
      continue;
    }

    let filFat = 0, filMeta = 0, filMetaCli = 0, filRealCli = 0;
    let filPendente = 0, filDev = 0, filCortes = 0;
    let filRcas = 0, filZerados = 0, filComVenda = 0;
    let filVisitasPlan = 0, filVisitasReal = 0, filPedidos = 0;
    const topRcas = [];
    const zeradosList = [];

    // Processar em lotes de 10 com pause de 200ms entre lotes
    const batchSize = 10;
    for (let i = 0; i < rcasList.length; i += batchSize) {
      const batch = rcasList.slice(i, i + batchSize);

      await Promise.all(batch.map(async (rca) => {
        const rcaId = String(typeof rca === 'object' ? (rca.id || rca.rcaId || rca.codigo) : rca);
        const rcaNome = (typeof rca === 'object' ? (rca.nome || `RCA ${rcaId}`) : `RCA ${rcaId}`).replace(/^CLT\s*-\s*/i, '');

        try {
          // 2 fetches por RCA: dashboard + produtividade
          const [dash, prod] = await Promise.all([
            fetchJson(`${CEVEN_BASE}/api/rca/dashboard?filial=${fil.id}&id=${rcaId}`),
            fetchJson(`${CEVEN_BASE}/api/rca/produtividade?filial=${fil.id}&id=${rcaId}`)
          ]);

          if (!dash || !dash.financeiro) return;

          const fin = dash.financeiro || {};
          const pos = dash.positivacao || {};
          const prodDia = prod?.dia || {};
          const prodMes = prod?.mes || {};

          const metaFat = parseFloat(fin.meta) || 0;
          const fatLiq = parseFloat(fin.faturado) || 0;
          const pendente = parseFloat(fin.pendente) || 0;
          const devolucao = parseFloat(fin.devolucao) || 0;
          const pctFat = metaFat > 0 ? parseFloat(((fatLiq / metaFat) * 100).toFixed(1)) : 0;

          const metaCli = parseInt(pos.meta, 10) || 0;
          const realCli = parseInt(pos.realizado, 10) || 0;
          const pctPos = metaCli > 0 ? parseFloat(((realCli / metaCli) * 100).toFixed(1)) : 0;

          const digitadoHoje = parseFloat(prodDia.dig_pedido) || 0;
          const visitasPlanDia = parseInt(prodDia.visitas_programadas) || 0;
          const visitasRotaDia = parseInt(prodDia.visitas_na_rota) || 0;
          const visitasComVenda = parseInt(prodDia.visitas_com_venda) || 0;

          // Gravar KPI atualizado
          await db.prepare(`
            INSERT OR REPLACE INTO rca_kpis (
              data, filial_id, rca_codigo,
              meta_fat, fat_liq, pendente, falta, pct_fat,
              devolucao_total,
              meta_cli, real_cli, falta_cli, pct_pos,
              dig_pedido_dia, visitas_programadas_dia, visitas_na_rota_dia,
              visitas_com_venda_dia,
              visitas_plan_mes, visitas_real_mes,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            dataHoje, fil.codigo, rcaId,
            metaFat, fatLiq, pendente,
            Math.max(0, metaFat - fatLiq - pendente), pctFat,
            devolucao,
            metaCli, realCli, Math.max(0, metaCli - realCli), pctPos,
            digitadoHoje, visitasPlanDia, visitasRotaDia,
            visitasComVenda,
            parseInt(prodMes?.visitas_planejadas) || 0,
            parseInt(prodMes?.visitas_realizadas) || 0
          ).run();

          // ===== DETECÇÃO DE DELTAS =====
          const anterior = estadoAnterior[rcaId];

          // A. Pedido desbloqueado (pendente caiu e faturado subiu)
          if (anterior && anterior.pendente > 0 && pendente < anterior.pendente && fatLiq > anterior.fat_liq) {
            const desbloqueado = anterior.pendente - pendente;
            resultado.alertas.push({
              tipo: 'pedido_desbloqueado',
              filial: fil.codigo,
              rca: rcaId,
              nome: rcaNome,
              valor: desbloqueado,
              mensagem: `✅ Pedido de R$ ${desbloqueado.toLocaleString('pt-BR', {minimumFractionDigits: 2})} de ${rcaNome} foi LIBERADO`
            });
          }

          // B. Meta batida nesta hora
          if (anterior && pctFat >= 100 && (anterior.pct_fat || 0) < 100) {
            resultado.alertas.push({
              tipo: 'meta_batida',
              filial: fil.codigo,
              rca: rcaId,
              nome: rcaNome,
              fat: fatLiq,
              mensagem: `🏆 ${rcaNome} (${fil.codigo}) bateu a meta! ${pctFat}%`
            });
          }

          // C. Flash venda (salto > R$ 3.000 na hora)
          if (anterior && anterior.fat_liq > 0) {
            const deltaFat = fatLiq - anterior.fat_liq;
            if (deltaFat >= 3000) {
              resultado.alertas.push({
                tipo: 'flash_venda',
                filial: fil.codigo,
                rca: rcaId,
                nome: rcaNome,
                delta: deltaFat,
                mensagem: `⚡ ${rcaNome} (${fil.codigo}) faturou +R$ ${deltaFat.toLocaleString('pt-BR')} na última hora`
              });
            }
          }

          // Acumular totais da filial
          filFat += fatLiq;
          filMeta += metaFat;
          filPendente += pendente;
          filDev += devolucao;
          filMetaCli += metaCli;
          filRealCli += realCli;
          filVisitasPlan += visitasPlanDia;
          filVisitasReal += visitasRotaDia;
          filRcas++;

          if (fatLiq === 0 && digitadoHoje === 0) {
            filZerados++;
            zeradosList.push({ codigo: rcaId, nome: rcaNome, meta_fat: metaFat, visitas_rota: visitasPlanDia });
          } else {
            filComVenda++;
          }

          // Para ranking top 5
          topRcas.push({ codigo: rcaId, nome: rcaNome, fat_liq: fatLiq, pct_fat: pctFat, meta_fat: metaFat });

          resultado.rcas_processados++;
        } catch (err) {
          resultado.erros.push(`RCA ${rcaId} (${fil.codigo}): ${err.message}`);
        }
      }));

      // Pause de 200ms entre lotes para não sobrecarregar a API do CEVEN
      if (i + batchSize < rcasList.length) await sleep(200);
    }

    // Ordenar top 5 por faturamento
    topRcas.sort((a, b) => b.fat_liq - a.fat_liq);
    const top5 = topRcas.slice(0, 5);

    // 3. Gravar consolidado_executivo_live da filial (UPSERT)
    await db.prepare(`
      INSERT OR REPLACE INTO consolidado_executivo_live (
        filial_id, filial_sigla, data_ref, hora_snapshot,
        fat_liq_total, meta_fat_total, pct_fat, pendente_total,
        devolucoes_total, cortes_total,
        meta_cli_total, real_cli_total, pct_pos,
        rcas_ativos, rcas_zerados, rcas_com_venda,
        visitas_plan, visitas_real, pedidos_dia,
        ticket_medio,
        top5_rcas_json, zerados_json,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      fil.id, fil.codigo, dataHoje, horaAtual,
      filFat, filMeta,
      filMeta > 0 ? parseFloat(((filFat / filMeta) * 100).toFixed(1)) : 0,
      filPendente, filDev,
      filMetaCli, filRealCli,
      filMetaCli > 0 ? parseFloat(((filRealCli / filMetaCli) * 100).toFixed(1)) : 0,
      filRcas, filZerados, filComVenda,
      filVisitasPlan, filVisitasReal,
      filComVenda > 0 ? parseFloat((filFat / filComVenda).toFixed(2)) : 0,
      JSON.stringify(top5),
      JSON.stringify(zeradosList.slice(0, 20))
    ).run();

    resultado.filiais_resumo[fil.codigo] = {
      fat: filFat, meta: filMeta, rcas: filRcas, zerados: filZerados
    };

    console.log(`✅ ${fil.codigo}: R$ ${filFat.toLocaleString('pt-BR')} | ${filRcas} RCAs | ${filZerados} zerados`);
  }

  // 4. Gravar linha de GRUPO (totais consolidados)
  const grupo = Object.values(resultado.filiais_resumo);
  const grupoFat = grupo.reduce((s, f) => s + f.fat, 0);
  const grupoMeta = grupo.reduce((s, f) => s + f.meta, 0);
  const grupoRcas = grupo.reduce((s, f) => s + f.rcas, 0);
  const grupoZerados = grupo.reduce((s, f) => s + f.zerados, 0);

  await db.prepare(`
    INSERT OR REPLACE INTO consolidado_executivo_live (
      filial_id, filial_sigla, data_ref, hora_snapshot,
      fat_liq_total, meta_fat_total, pct_fat,
      rcas_ativos, rcas_zerados, rcas_com_venda,
      updated_at
    ) VALUES ('GRUPO', 'GRUPO', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    dataHoje, horaAtual,
    grupoFat, grupoMeta,
    grupoMeta > 0 ? parseFloat(((grupoFat / grupoMeta) * 100).toFixed(1)) : 0,
    grupoRcas, grupoZerados, grupoRcas - grupoZerados
  ).run();

  console.log(`\n📊 GRUPO: R$ ${grupoFat.toLocaleString('pt-BR')} / R$ ${grupoMeta.toLocaleString('pt-BR')} (${grupoRcas} RCAs, ${grupoZerados} zerados)`);
  console.log(`🔔 ${resultado.alertas.length} alertas detectados`);

  return resultado;
}
