/**
 * ============================================================================
 * PIPELINE 2 — ABERTURA DIÁRIA (07:00 BRT)
 * Frequência: 1x por dia às 07:00
 * O que faz: Busca roteiro do dia, metas, inativos +30d para cada RCA.
 *            Grava em roteiros_visitas e rca_kpis (snapshot de abertura).
 *            Cria a primeira linha do dia em consolidado_executivo_live.
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

/**
 * Executa a abertura diária: busca roteiros e metas de cada RCA.
 * @param {D1Database} db - Binding do Cloudflare D1
 * @param {string} dataHoje - Data no formato YYYY-MM-DD
 * @returns {Object} Resultado com totais
 */
export async function executarAberturaDiaria(db, dataHoje) {
  const resultado = { rcas_processados: 0, roteiros_gravados: 0, erros: [] };

  for (const fil of FILIAIS) {
    // 1. Buscar lista de RCAs da filial
    const rcasList = await fetchJson(`${CEVEN_BASE}/api/rcas?filial=${fil.id}`);
    if (!rcasList || !Array.isArray(rcasList)) {
      resultado.erros.push(`Sem RCAs em ${fil.codigo}`);
      continue;
    }

    let filialFat = 0, filialMeta = 0, filialMetaCli = 0, filialRealCli = 0;
    let filialVisitasPlan = 0, filialRcas = 0;

    // 2. Processar cada RCA em lotes de 10 (controle de concorrência)
    const batchSize = 10;
    for (let i = 0; i < rcasList.length; i += batchSize) {
      const batch = rcasList.slice(i, i + batchSize);

      await Promise.all(batch.map(async (rca) => {
        const rcaId = typeof rca === 'object' ? (rca.id || rca.rcaId || rca.codigo) : rca;
        const rcaNome = typeof rca === 'object' ? (rca.nome || `RCA ${rcaId}`) : `RCA ${rcaId}`;

        try {
          // Buscar dashboard (metas) e roteiro do dia
          const [dash, roteiro] = await Promise.all([
            fetchJson(`${CEVEN_BASE}/api/rca/dashboard?filial=${fil.id}&id=${rcaId}`),
            fetchJson(`${CEVEN_BASE}/api/rca/roteiro-hoje?filial=${fil.id}&id=${rcaId}`)
          ]);

          if (!dash) return;

          const fin = dash.financeiro || {};
          const pos = dash.positivacao || {};

          const metaFat = parseFloat(fin.meta) || 0;
          const fatLiq = parseFloat(fin.faturado) || 0;
          const pendente = parseFloat(fin.pendente) || 0;
          const metaCli = parseInt(pos.meta, 10) || 0;
          const realCli = parseInt(pos.realizado, 10) || 0;

          // Gravar snapshot de KPI de abertura
          await db.prepare(`
            INSERT OR REPLACE INTO rca_kpis (
              data, filial_id, rca_codigo,
              meta_fat, fat_liq, pendente, falta, pct_fat,
              meta_cli, real_cli, falta_cli, pct_pos,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            dataHoje, fil.codigo, String(rcaId),
            metaFat, fatLiq, pendente,
            Math.max(0, metaFat - fatLiq - pendente),
            metaFat > 0 ? parseFloat(((fatLiq / metaFat) * 100).toFixed(1)) : 0,
            metaCli, realCli, Math.max(0, metaCli - realCli),
            metaCli > 0 ? parseFloat(((realCli / metaCli) * 100).toFixed(1)) : 0
          ).run();

          // Gravar roteiro do dia
          if (roteiro && Array.isArray(roteiro)) {
            for (let idx = 0; idx < roteiro.length; idx++) {
              const cli = roteiro[idx];
              const cliId = cli.id || cli.codcli || `${rcaId}_${idx}`;
              await db.prepare(`
                INSERT OR REPLACE INTO roteiros_visitas (
                  data_visita, rca_codigo, filial_id, id_cliente, razao_social,
                  nome_fantasia, cnpj, endereco, bairro, municipio,
                  ordem_visita, status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AGENDADO', CURRENT_TIMESTAMP)
              `).bind(
                dataHoje, String(rcaId), fil.codigo, String(cliId),
                cli.razao_social || cli.nome_cliente || cli.nome || '',
                cli.nome_fantasia || cli.fantasia || '',
                cli.cnpj || '', cli.endereco || '', cli.bairro || '',
                cli.municipio || cli.cidade || '',
                idx + 1
              ).run();
              resultado.roteiros_gravados++;
            }
            filialVisitasPlan += roteiro.length;
          }

          filialFat += fatLiq;
          filialMeta += metaFat;
          filialMetaCli += metaCli;
          filialRealCli += realCli;
          filialRcas++;
          resultado.rcas_processados++;
        } catch (err) {
          resultado.erros.push(`RCA ${rcaId} (${fil.codigo}): ${err.message}`);
        }
      }));
    }

    // 3. Gravar snapshot de abertura para a filial
    await db.prepare(`
      INSERT OR REPLACE INTO consolidado_executivo_live (
        filial_id, filial_sigla, data_ref, hora_snapshot,
        fat_liq_total, meta_fat_total, pct_fat, pendente_total,
        meta_cli_total, real_cli_total, pct_pos,
        rcas_ativos, visitas_plan,
        updated_at
      ) VALUES (?, ?, ?, '07:00', ?, ?, ?, 0, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      fil.id, fil.codigo, dataHoje,
      filialFat, filialMeta,
      filialMeta > 0 ? parseFloat(((filialFat / filialMeta) * 100).toFixed(1)) : 0,
      filialMetaCli, filialRealCli,
      filialMetaCli > 0 ? parseFloat(((filialRealCli / filialMetaCli) * 100).toFixed(1)) : 0,
      filialRcas, filialVisitasPlan
    ).run();

    console.log(`✅ ${fil.codigo}: ${filialRcas} RCAs, ${filialVisitasPlan} visitas planejadas`);
  }

  console.log(`📊 Abertura concluída: ${resultado.rcas_processados} RCAs processados`);
  return resultado;
}
