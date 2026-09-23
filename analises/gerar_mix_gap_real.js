/**
 * Substitui mix_aderencia_regional (agrupamento por CIDADE, conceitualmente errado)
 * pela lógica REAL do CEVEN: pra cada PDV na rota de hoje, calcula o universo de
 * clientes num raio de 3km (usando lat/long do cadastro WinThor) e chama o mesmo
 * endpoint que o app usa (/mixapi/mix/gap) pra pegar o gap de indústria/produto real.
 *
 * Descoberto via HAR real do app (aba +MIX do roteiro-hoje) em 22/09/2026.
 */
const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');

const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';
const DB_PATH = path.join(__dirname, 'pedidos_historico_ceven.db');
const RAIO_KM = 3;
const MAX_UNIVERSO = 100;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function comTimeoutForcado(promessa, ms) {
  return Promise.race([promessa, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function chamarMixGap(targetCnpj, universoCnpjs, codRca) {
  try {
    const res = await comTimeoutForcado(
      axios.post(`${CEVEN_BASE}/mixapi/mix/gap`, {
        target_cnpj: targetCnpj,
        universo_cnpjs: universoCnpjs,
        limite: MAX_UNIVERSO,
        raio_km: RAIO_KM,
        cod_rca: codRca
      }, { timeout: 10000 }),
      12000
    );
    return res?.data || null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    DROP TABLE IF EXISTS mix_gap_real;
    CREATE TABLE mix_gap_real (
      cnpj_alvo        TEXT,
      nome_cliente     TEXT,
      filial_sigla     TEXT,
      rca_codigo       TEXT,
      total_universo   INTEGER,
      total_com_dados  INTEGER,
      impacto_total_estimado REAL,
      industria        TEXT,
      n_clientes_industria INTEGER,
      penetracao_pct   REAL,
      valor_universo   REAL,
      impacto_cliente  REAL,
      produto_top      TEXT,
      data_calculo     TEXT,
      PRIMARY KEY (cnpj_alvo, industria)
    );
  `);

  // Carrega os PDVs de hoje que têm CNPJ e lat/long válidos
  const pdvs = db.prepare(`
    SELECT DISTINCT cnpj, nome_fantasia, filial, rca_codigo, latitude, longitude
    FROM pdvs_roteiro_hoje_gps
    WHERE cnpj IS NOT NULL AND cnpj != '' AND latitude IS NOT NULL AND longitude IS NOT NULL
  `).all();
  console.log(`${pdvs.length} PDVs de hoje com CNPJ e geolocalização.`);

  // Carrega TODO o cadastro com lat/long uma vez em memória (mais rápido que consultar por PDV)
  const cadastro = db.prepare(`
    SELECT cnpj_limpo, latitude, longitude FROM rf_clientes_2026
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0
  `).all();
  console.log(`${cadastro.length} clientes no cadastro com geolocalização, pra calcular universo local.`);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO mix_gap_real (
      cnpj_alvo, nome_cliente, filial_sigla, rca_codigo, total_universo, total_com_dados,
      impacto_total_estimado, industria, n_clientes_industria, penetracao_pct,
      valor_universo, impacto_cliente, produto_top, data_calculo
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const hoje = new Date().toISOString().split('T')[0];
  let processados = 0, comSucesso = 0, semUniverso = 0;
  const inicio = Date.now();

  const BATCH = 15;
  for (let i = 0; i < pdvs.length; i += BATCH) {
    const lote = pdvs.slice(i, i + BATCH);
    await Promise.all(lote.map(async (pdv) => {
      const cnpjLimpo = String(pdv.cnpj).replace(/\D/g, '');
      // Bounding box grosseiro (~0.05 grau ~ 5km) antes do haversine preciso, pra não escanear 58k linhas sempre
      const candidatos = cadastro.filter(c =>
        Math.abs(c.latitude - pdv.latitude) < 0.05 && Math.abs(c.longitude - pdv.longitude) < 0.05
      );
      const universo = candidatos
        .map(c => ({ cnpj: c.cnpj_limpo, dist: haversine(pdv.latitude, pdv.longitude, c.latitude, c.longitude) }))
        .filter(c => c.dist <= RAIO_KM)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, MAX_UNIVERSO)
        .map(c => c.cnpj);

      processados++;
      if (universo.length < 3) { semUniverso++; return; }

      const data = await chamarMixGap(cnpjLimpo, universo, pdv.rca_codigo);
      if (!data || !data.disponivel) return;
      comSucesso++;

      const industrias = data.industrias_gap || [];
      industrias.slice(0, 5).forEach(ind => {
        insert.run(
          cnpjLimpo, pdv.nome_fantasia, pdv.filial, pdv.rca_codigo,
          data.total_universo, data.total_com_dados, data.impacto_total_estimado,
          ind.industria, ind.n_clientes, ind.penetracao, ind.valor_universo, ind.impacto_cliente,
          (ind.produtos && ind.produtos[0]?.produto) || '',
          hoje
        );
      });
    }));

    if ((i / BATCH) % 10 === 0) {
      const min = ((Date.now() - inicio) / 60000).toFixed(1);
      console.log(`  ${processados}/${pdvs.length} PDVs processados (${comSucesso} com gap real, ${semUniverso} sem universo suficiente) | ${min}min`);
    }
  }

  const totalMin = ((Date.now() - inicio) / 60000).toFixed(1);
  const totalLinhas = db.prepare('SELECT COUNT(*) as c FROM mix_gap_real').get().c;
  console.log(`\n✅ CONCLUÍDO em ${totalMin}min: ${processados} PDVs processados, ${comSucesso} com gap real, ${totalLinhas} linhas salvas em mix_gap_real.`);
}

main().catch(e => { console.error(e); process.exit(1); });
