/**
 * ============================================================================
 * PIPELINE 1 — SYNC CADASTROS MESTRE
 * Frequência: 1x por semana (ou sob demanda)
 * O que faz: Sincroniza a lista de filiais, RCAs e supervisores do CEVEN
 *            para o Cloudflare D1. Não toca em dados do dia.
 * Execução: node pipeline/1_sync_cadastros_mestre.js (local)
 *           ou via GitHub Actions workflow_dispatch
 * ============================================================================
 */

const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';

const FILIAIS = [
  { id: 'tbl1', codigo: 'TBL', nome: 'Três Lagoas' },
  { id: 'tcv1', codigo: 'TCV', nome: 'Três Lagoas CV' },
  { id: 'tph1', codigo: 'TPH', nome: 'Três Lagoas PH' },
  { id: 'tsj1', codigo: 'TSJ', nome: 'São José' },
  { id: 'tca1', codigo: 'TCA', nome: 'Tangará da Serra' },
  { id: 'abc1', codigo: 'ABC', nome: 'ABC' },
  { id: 'tpa1', codigo: 'TPA', nome: 'Pontes e Lacerda' },
  { id: 'tbe1', codigo: 'TBE', nome: 'Três Lagoas BE' },
  { id: 'api1', codigo: 'API', nome: 'Aparecida' },
  { id: 'mcd1', codigo: 'MCD', nome: 'Maracaju' },
  { id: 'tcg1', codigo: 'TCG', nome: 'Campo Grande' }
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
 * Roda a sincronização de cadastros mestre.
 * @param {D1Database} db - Binding do Cloudflare D1
 * @returns {Object} Resultado com totais sincronizados
 */
export async function syncCadastrosMestre(db) {
  const resultado = { filiais: 0, rcas: 0, erros: [] };

  // 1. Upsert filiais
  for (const f of FILIAIS) {
    await db.prepare(
      `INSERT OR REPLACE INTO filiais (id, codigo, nome) VALUES (?, ?, ?)`
    ).bind(f.id, f.codigo, f.nome).run();
    resultado.filiais++;
  }

  // 2. Para cada filial, buscar lista de RCAs
  for (const fil of FILIAIS) {
    try {
      const rcasList = await fetchJson(`${CEVEN_BASE}/api/rcas?filial=${fil.id}`);
      if (!rcasList || !Array.isArray(rcasList)) {
        resultado.erros.push(`Falha ao buscar RCAs de ${fil.codigo}`);
        continue;
      }

      // Batch insert de RCAs
      for (const rca of rcasList) {
        const rcaId = typeof rca === 'object' ? (rca.id || rca.rcaId || rca.codigo) : rca;
        const rcaNome = typeof rca === 'object' ? (rca.nome || rca.razao || `RCA ${rcaId}`) : `RCA ${rcaId}`;

        await db.prepare(
          `INSERT OR REPLACE INTO representantes (codigo, nome, filial_id, ativo) VALUES (?, ?, ?, 1)`
        ).bind(String(rcaId), rcaNome.replace(/^CLT\s*-\s*/i, ''), fil.id).run();
        resultado.rcas++;
      }

      console.log(`✅ ${fil.codigo}: ${rcasList.length} RCAs sincronizados`);
    } catch (err) {
      resultado.erros.push(`Erro em ${fil.codigo}: ${err.message}`);
    }
  }

  console.log(`📊 Total: ${resultado.filiais} filiais, ${resultado.rcas} RCAs`);
  return resultado;
}

// Se executado como módulo standalone via Node.js (para uso local)
if (typeof process !== 'undefined' && process.argv[1]?.includes('1_sync_cadastros_mestre')) {
  console.log('🔄 Executando sync de cadastros mestre localmente...');
  console.log('⚠️ Para execução local, use: node scripts/ingestao_massiva_ceven.js');
  console.log('   Este módulo é projetado para rodar no Cloudflare Worker ou GitHub Actions.');
}
