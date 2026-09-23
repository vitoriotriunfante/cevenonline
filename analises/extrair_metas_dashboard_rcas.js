const https = require('https');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'pedidos_historico_ceven.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const HIERARQUIA = JSON.parse(fs.readFileSync(path.join(__dirname, 'hierarquia_completa_ceven.json'), 'utf8'));

console.log('='.repeat(70));
console.log('🎯 EXTRAÇÃO DE METAS (FATURAMENTO E POSITIVAÇÃO) + PRODUTIVIDADE DOS RCAs');
console.log('='.repeat(70));

// 1. Criar tabela de metas e produtividade dos RCAs
db.exec(`
  CREATE TABLE IF NOT EXISTS rca_metas_dashboard (
    rca_id                 INTEGER,
    filial_codigo          TEXT,
    filial_sigla           TEXT,
    rca_nome               TEXT,
    supervisor_nome        TEXT,
    gerente_nome           TEXT,
    segmento_rca           TEXT,
    meta_faturamento       REAL,
    faturado_mes           REAL,
    faturado_pendente      REAL,
    devolucao_mes          REAL,
    atingimento_fat_pct    REAL,
    meta_positivacao       INTEGER,
    realizado_positivacao  INTEGER,
    atingimento_pos_pct    REAL,
    visit_plan_mes         INTEGER,
    visit_real_mes         INTEGER,
    eficiencia_visita_pct  REAL,
    skus_distintos_mes     INTEGER,
    PRIMARY KEY (rca_id, filial_codigo)
  );
`);

function fetchJsonUmaVez(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://ceven.drivetriunfante-locomotiva.com.br/dashboard'
      },
      timeout: 9000
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
function comTimeoutForcado(promessa, ms) {
  return Promise.race([promessa, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}
async function fetchJson(url, retries = 2) {
  for (let n = retries; n >= 1; n--) {
    const r = await comTimeoutForcado(fetchJsonUmaVez(url), 6000);
    if (r !== null) return r;
    if (n > 1) await new Promise(res => setTimeout(res, 300));
  }
  return null;
}

function normalizarFilial(val) {
  if (!val) return '';
  let s = String(val).trim().toUpperCase();
  if (s.includes('TSJ')) return 'TSJ';
  if (s.includes('TCV')) return 'TCV';
  if (s.includes('TBE')) return 'TBE';
  if (s.includes('ABC')) return 'ABC';
  if (s.includes('TPH')) return 'TPH';
  if (s.includes('MCD')) return 'MCD';
  if (s.includes('TCA')) return 'TCA';
  if (s.includes('API')) return 'API';
  if (s.includes('TCG')) return 'TCG';
  if (s.includes('TPA')) return 'TPA';
  if (s.includes('TBL')) return 'TBL';
  return s;
}

async function coletarMetas() {
  const lista = [];
  for (const f of HIERARQUIA) {
    const fKey = f.codigoFilial;
    const fSigla = normalizarFilial(f.filial);
    const gNome = Array.isArray(f.gerentes) ? f.gerentes.join(', ') : (f.gerentes || '');

    for (const s of f.supervisores) {
      for (const r of s.rcas) {
        if (!r.rcaId) continue;
        lista.push({
          rcaId: r.rcaId,
          rcaNome: r.rcaNome,
          filialKey: fKey,
          filialSigla: fSigla,
          supervisorNome: s.supervisorNome,
          gerenteNome: gNome
        });
      }
    }
  }

  console.log(`📋 Total de ${lista.length} RCAs para extrair Metas e Produtividade...`);

  // Pegar segmento existente
  const segMap = new Map();
  db.prepare("SELECT rca_id, filial_sigla, segmento_nome FROM rca_segmentos").all().forEach(r => {
    segMap.set(`${r.rca_id}_${r.filial_sigla}`, r.segmento_nome);
  });

  const insertMeta = db.prepare(`
    INSERT OR REPLACE INTO rca_metas_dashboard (
      rca_id, filial_codigo, filial_sigla, rca_nome, supervisor_nome, gerente_nome,
      segmento_rca, meta_faturamento, faturado_mes, faturado_pendente, devolucao_mes,
      atingimento_fat_pct, meta_positivacao, realizado_positivacao, atingimento_pos_pct,
      visit_plan_mes, visit_real_mes, eficiencia_visita_pct, skus_distintos_mes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const CONCURRENCY = 10;
  let idx = 0;
  let totalComMeta = 0;

  async function worker() {
    while (idx < lista.length) {
      const item = lista[idx++];
      const seg = segMap.get(`${item.rcaId}_${item.filialSigla}`) || 'VAREJO (VJ)';

      // 1. Chamar dashboard (metas financeiras e positivacao)
      const urlDash = `https://ceven.drivetriunfante-locomotiva.com.br/api/rca/dashboard?filial=${item.filialKey}&id=${item.rcaId}`;
      const dDash = await fetchJson(urlDash);

      // 2. Chamar produtividade (visitas e mix)
      const urlProd = `https://ceven.drivetriunfante-locomotiva.com.br/api/rca/produtividade?filial=${item.filialKey}&id=${item.rcaId}`;
      const dProd = await fetchJson(urlProd);

      let metaFat = 0, fatMes = 0, pendente = 0, dev = 0, atingFat = 0;
      let metaPos = 0, realPos = 0, atingPos = 0;
      let planVis = 0, realVis = 0, efVis = 0, skusDist = 0;

      if (dDash && dDash.financeiro) {
        metaFat = parseFloat(dDash.financeiro.meta) || 0;
        fatMes = parseFloat(dDash.financeiro.faturado) || 0;
        pendente = parseFloat(dDash.financeiro.pendente) || 0;
        dev = parseFloat(dDash.financeiro.devolucao) || 0;
        atingFat = parseFloat(dDash.financeiro.atingimento_pct) || 0;
      }

      if (dDash && dDash.positivacao) {
        metaPos = parseInt(dDash.positivacao.meta) || 0;
        realPos = parseInt(dDash.positivacao.realizado) || 0;
        atingPos = parseFloat(dDash.positivacao.atingimento_pct) || 0;
      }

      if (dProd && dProd.mes) {
        planVis = parseInt(dProd.mes.visit_plan) || 0;
        realVis = parseInt(dProd.mes.visit_real) || 0;
        efVis = parseFloat(dProd.mes.eficiencia_pct) || 0;
      }

      if (dProd && dProd.mix_mes) {
        skusDist = parseInt(dProd.mix_mes.skus_distintos) || 0;
      }

      insertMeta.run(
        item.rcaId,
        item.filialKey.toUpperCase(),
        item.filialSigla,
        item.rcaNome,
        item.supervisorNome,
        item.gerenteNome,
        seg,
        metaFat, fatMes, pendente, dev, atingFat,
        metaPos, realPos, atingPos,
        planVis, realVis, efVis, skusDist
      );

      if (metaFat > 0 || metaPos > 0) totalComMeta++;

      if (idx % 30 === 0 || idx === lista.length) {
        process.stdout.write(`  Progresso: ${idx}/${lista.length} | Com metas registradas: ${totalComMeta}\r`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\n\n🎉 EXTRAÇÃO DE METAS CONCLUÍDA! Total com metas: ${totalComMeta} de ${lista.length}`);
}

coletarMetas().then(() => {
  db.close();
}).catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
