/**
 * ============================================================================
 * GITHUB ACTIONS RUNNER — Executa os pipelines e gera SQL para o D1
 * ============================================================================
 * Este script roda no ambiente do GitHub Actions (Node.js 20).
 * Faz os 519 fetches da API do CEVEN e gera um arquivo SQL para
 * sincronizar com o Cloudflare D1 via `wrangler d1 execute`.
 *
 * Uso: node pipeline/github_actions_runner.js --pipeline abertura --data 2026-09-08 --hora 07:00
 * ============================================================================
 */

const fs = require('fs');
const https = require('https');

const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';

const FILIAIS = [
  { id: 'tbl1', codigo: 'TBL' }, { id: 'tcv1', codigo: 'TCV' },
  { id: 'tph1', codigo: 'TPH' }, { id: 'tsj1', codigo: 'TSJ' },
  { id: 'tca1', codigo: 'TCA' }, { id: 'abc1', codigo: 'ABC' },
  { id: 'tpa1', codigo: 'TPA' }, { id: 'tbe1', codigo: 'TBE' },
  { id: 'api1', codigo: 'API' }, { id: 'mcd1', codigo: 'MCD' },
  { id: 'tcg1', codigo: 'TCG' }
];

// Parse args
const args = {};
process.argv.forEach((val, idx) => {
  if (val.startsWith('--')) args[val.slice(2)] = process.argv[idx + 1];
});

const PIPELINE = args.pipeline || 'intraday';
const DATA_HOJE = args.data || new Date().toISOString().split('T')[0];
const HORA_ATUAL = args.hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (CEVEN-NOC-GHA/3.0)' },
      timeout: 15000,
      rejectUnauthorized: false
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  console.log(`🚀 CEVEN NOC — GitHub Actions Runner v3.0`);
  console.log(`📅 Data: ${DATA_HOJE} | Hora: ${HORA_ATUAL} | Pipeline: ${PIPELINE}`);
  console.log(`========================================\n`);

  const sqlStatements = [];
  sqlStatements.push(`-- SYNC AUTOMÁTICO CEVEN NOC — ${DATA_HOJE} ${HORA_ATUAL}`);
  sqlStatements.push(`-- Pipeline: ${PIPELINE}`);
  sqlStatements.push(`-- Gerado pelo GitHub Actions Runner\n`);

  let totalRcas = 0;
  let totalErros = 0;

  for (const fil of FILIAIS) {
    console.log(`\n📡 Processando ${fil.codigo}...`);

    // Buscar lista de RCAs
    const rcasList = await fetchJson(`${CEVEN_BASE}/api/rcas?filial=${fil.id}`);
    if (!rcasList || !Array.isArray(rcasList) || rcasList.length === 0) {
      console.log(`  ⚠️ Sem RCAs para ${fil.codigo}`);
      totalErros++;
      continue;
    }

    console.log(`  ${rcasList.length} RCAs identificados`);

    let filFat = 0, filMeta = 0, filMetaCli = 0, filRealCli = 0;
    let filPendente = 0, filDev = 0;
    let filRcas = 0, filZerados = 0, filComVenda = 0;
    let filVisitasPlan = 0, filVisitasReal = 0;
    const topRcas = [];
    const zeradosList = [];

    // Processar em lotes de 10 com pause de 300ms
    const batchSize = 10;
    for (let i = 0; i < rcasList.length; i += batchSize) {
      const batch = rcasList.slice(i, i + batchSize);

      await Promise.all(batch.map(async (rca) => {
        const rcaId = String(typeof rca === 'object' ? (rca.id || rca.rcaId || rca.codigo) : rca);
        const rcaNome = (typeof rca === 'object' ? (rca.nome || `RCA ${rcaId}`) : `RCA ${rcaId}`).replace(/^CLT\s*-\s*/i, '');

        try {
          const [dash, prod] = await Promise.all([
            fetchJson(`${CEVEN_BASE}/api/rca/dashboard?filial=${fil.id}&id=${rcaId}`),
            fetchJson(`${CEVEN_BASE}/api/rca/produtividade?filial=${fil.id}&id=${rcaId}`)
          ]);

          if (!dash || !dash.financeiro) return;

          const fin = dash.financeiro || {};
          const pos = dash.positivacao || {};
          const prodDia = prod?.dia || {};

          const metaFat = parseFloat(fin.meta) || 0;
          const fatLiq = parseFloat(fin.faturado) || 0;
          const pendente = parseFloat(fin.pendente) || 0;
          const devolucao = parseFloat(fin.devolucao) || 0;
          const pctFat = metaFat > 0 ? parseFloat(((fatLiq / metaFat) * 100).toFixed(1)) : 0;

          const metaCli = parseInt(pos.meta, 10) || 0;
          const realCli = parseInt(pos.realizado, 10) || 0;
          const pctPos = metaCli > 0 ? parseFloat(((realCli / metaCli) * 100).toFixed(1)) : 0;

          const digitadoHoje = parseFloat(prodDia.dig_pedido) || 0;
          const visitasPlan = parseInt(prodDia.visitas_programadas) || 0;
          const visitasReal = parseInt(prodDia.visitas_na_rota) || 0;
          const visitasComVenda = parseInt(prodDia.visitas_com_venda) || 0;

          // SQL para rca_kpis
          sqlStatements.push(
            `INSERT OR REPLACE INTO rca_kpis (data, filial_id, rca_codigo, meta_fat, fat_liq, pendente, falta, pct_fat, devolucao_total, meta_cli, real_cli, falta_cli, pct_pos, dig_pedido_dia, visitas_programadas_dia, visitas_na_rota_dia, visitas_com_venda_dia, updated_at) VALUES (${esc(DATA_HOJE)}, ${esc(fil.codigo)}, ${esc(rcaId)}, ${metaFat}, ${fatLiq}, ${pendente}, ${Math.max(0, metaFat - fatLiq - pendente)}, ${pctFat}, ${devolucao}, ${metaCli}, ${realCli}, ${Math.max(0, metaCli - realCli)}, ${pctPos}, ${digitadoHoje}, ${visitasPlan}, ${visitasReal}, ${visitasComVenda}, CURRENT_TIMESTAMP);`
          );

          // Acumular totais
          filFat += fatLiq; filMeta += metaFat;
          filPendente += pendente; filDev += devolucao;
          filMetaCli += metaCli; filRealCli += realCli;
          filVisitasPlan += visitasPlan; filVisitasReal += visitasReal;
          filRcas++;

          if (fatLiq === 0 && digitadoHoje === 0) {
            filZerados++;
            zeradosList.push({ codigo: rcaId, nome: rcaNome, meta_fat: metaFat, visitas_rota: visitasPlan });
          } else {
            filComVenda++;
          }

          topRcas.push({ codigo: rcaId, nome: rcaNome, fat_liq: fatLiq, pct_fat: pctFat, meta_fat: metaFat });
          totalRcas++;
        } catch (err) {
          totalErros++;
        }
      }));

      if (i + batchSize < rcasList.length) await sleep(300);
    }

    // Ordenar e pegar top 5
    topRcas.sort((a, b) => b.fat_liq - a.fat_liq);
    const top5 = topRcas.slice(0, 5);

    const pctFatFil = filMeta > 0 ? parseFloat(((filFat / filMeta) * 100).toFixed(1)) : 0;
    const pctPosFil = filMetaCli > 0 ? parseFloat(((filRealCli / filMetaCli) * 100).toFixed(1)) : 0;
    const ticketMedio = filComVenda > 0 ? parseFloat((filFat / filComVenda).toFixed(2)) : 0;

    // SQL para consolidado_executivo_live da filial
    sqlStatements.push(
      `INSERT OR REPLACE INTO consolidado_executivo_live (filial_id, filial_sigla, data_ref, hora_snapshot, fat_liq_total, meta_fat_total, pct_fat, pendente_total, devolucoes_total, meta_cli_total, real_cli_total, pct_pos, rcas_ativos, rcas_zerados, rcas_com_venda, visitas_plan, visitas_real, ticket_medio, top5_rcas_json, zerados_json, updated_at) VALUES (${esc(fil.id)}, ${esc(fil.codigo)}, ${esc(DATA_HOJE)}, ${esc(HORA_ATUAL)}, ${filFat}, ${filMeta}, ${pctFatFil}, ${filPendente}, ${filDev}, ${filMetaCli}, ${filRealCli}, ${pctPosFil}, ${filRcas}, ${filZerados}, ${filComVenda}, ${filVisitasPlan}, ${filVisitasReal}, ${ticketMedio}, ${esc(JSON.stringify(top5))}, ${esc(JSON.stringify(zeradosList.slice(0, 20)))}, CURRENT_TIMESTAMP);`
    );

    console.log(`  ✅ ${fil.codigo}: R$ ${filFat.toLocaleString('pt-BR')} | ${filRcas} RCAs | ${filZerados} zerados`);
  }

  // Linha de GRUPO
  const grupoQuery = `INSERT OR REPLACE INTO consolidado_executivo_live (filial_id, filial_sigla, data_ref, hora_snapshot, fat_liq_total, meta_fat_total, pct_fat, rcas_ativos, rcas_zerados, rcas_com_venda, updated_at) SELECT 'GRUPO', 'GRUPO', ${esc(DATA_HOJE)}, ${esc(HORA_ATUAL)}, COALESCE(SUM(fat_liq_total), 0), COALESCE(SUM(meta_fat_total), 0), CASE WHEN SUM(meta_fat_total) > 0 THEN ROUND(SUM(fat_liq_total) / SUM(meta_fat_total) * 100, 1) ELSE 0 END, COALESCE(SUM(rcas_ativos), 0), COALESCE(SUM(rcas_zerados), 0), COALESCE(SUM(rcas_com_venda), 0), CURRENT_TIMESTAMP FROM consolidado_executivo_live WHERE data_ref = ${esc(DATA_HOJE)} AND filial_id != 'GRUPO';`;
  sqlStatements.push(grupoQuery);

  // Salvar arquivo SQL
  const sqlContent = sqlStatements.join('\n');
  fs.writeFileSync('d1_github_sync.sql', sqlContent);

  console.log(`\n========================================`);
  console.log(`📊 RESULTADO FINAL`);
  console.log(`  RCAs processados: ${totalRcas}`);
  console.log(`  Erros: ${totalErros}`);
  console.log(`  SQL gerado: ${Math.round(sqlContent.length / 1024)} KB`);
  console.log(`  Arquivo: d1_github_sync.sql`);
  console.log(`========================================`);
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
