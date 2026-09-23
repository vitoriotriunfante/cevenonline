const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';
const agent = new https.Agent({ rejectUnauthorized: false });

const GERENTES_CONFIG = [
  { sigla: 'TBE', filialKey: 'tbe1', gerenteOficial: 'Diego', loginNome: 'Diego' },
  { sigla: 'TSJ', filialKey: 'tsj1', gerenteOficial: 'Saldanha', loginNome: 'Saldanha' },
  { sigla: 'MCD', filialKey: 'mcd1', gerenteOficial: 'Cleverson / Adriano', loginNome: 'Cleverson' },
  { sigla: 'TPH', filialKey: 'tph1', gerenteOficial: 'Vagner / Fábio', loginNome: 'Vagner' },
  { sigla: 'TCG', filialKey: 'tcg1', gerenteOficial: 'Danilo', loginNome: 'Danilo' },
  { sigla: 'TPA', filialKey: 'tpa1', gerenteOficial: 'Radke / Leandro', loginNome: 'Leandro Souza' },
  { sigla: 'API', filialKey: 'api1', gerenteOficial: 'Marcelo', loginNome: 'Marcelo' },
  { sigla: 'TCV', filialKey: 'tcv1', gerenteOficial: 'Leonardo', loginNome: 'Leonardo' },
  { sigla: 'ABC', filialKey: 'abc1', gerenteOficial: 'Marcos', loginNome: 'Marcos Colling' },
  { sigla: 'TCA', filialKey: 'tca1', gerenteOficial: 'Becher', loginNome: 'Becher' },
  { sigla: 'TBL', filialKey: 'tbl1', gerenteOficial: 'Fábio', loginNome: 'Fabio Machado' }
];

async function obterTokenGerente(nome, filialKey) {
  try {
    const res = await axios.post(`${CEVEN_BASE}/api/gerente-auth/login`, {
      filial: filialKey,
      nome,
      password: 'abc123'
    }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Content-Type': 'application/json'
      },
      httpsAgent: agent,
      timeout: 10000
    });
    return res.data?.access_token || res.data?.token;
  } catch (err) {
    console.error(`  ❌ Erro login gerente ${nome} (${filialKey}):`, err.response?.status, err.message);
    return null;
  }
}

async function atualizarArvoreCompleta() {
  console.log(`\n==================================================`);
  console.log(`🌳 ATUALIZAÇÃO DA ÁRVORE VIVA CEVEN (11 FILIAIS)`);
  console.log(`==================================================\n`);

  const arvoreCompleta = {};
  let totalSupsGlobal = 0;
  let totalVendsGlobal = new Set();

  for (const g of GERENTES_CONFIG) {
    console.log(`🔄 Conectando filial ${g.sigla} (${g.filialKey}) via ${g.loginNome}...`);
    const token = await obterTokenGerente(g.loginNome, g.filialKey);

    if (!token) {
      console.warn(`  ⚠️ Não foi possível obter token para ${g.sigla}.`);
      continue;
    }

    try {
      // 1. Buscar lista de supervisores da filial
      const resSup = await axios.get(`${CEVEN_BASE}/api/gerente/supervisores?filial=${g.filialKey}`, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Mozilla/5.0' },
        httpsAgent: agent,
        timeout: 15000
      });
      const supervisores = Array.isArray(resSup.data) ? resSup.data : [];

      // 2. Buscar cascata completa (supervisores -> tabelas -> vendedores)
      const resCas = await axios.get(`${CEVEN_BASE}/api/gerente/tabelas-cascata?filial=${g.filialKey}`, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Mozilla/5.0' },
        httpsAgent: agent,
        timeout: 25000
      });
      const cascata = resCas.data || { supervisores: [] };

      // Contabilizar vendedores
      let vendsFilial = new Set();
      (cascata.supervisores || []).forEach(s => {
        ['produtividade', 'faturamento', 'positivacao'].forEach(t => {
          (s.tabelas?.[t] || []).forEach(v => {
            if (v.id) {
              vendsFilial.add(v.id);
              totalVendsGlobal.add(`${g.sigla}_${v.id}`);
            }
          });
        });
      });

      arvoreCompleta[g.sigla] = {
        filial: g.filialKey,
        sigla: g.sigla,
        gerente: g.gerenteOficial,
        totalSupervisores: supervisores.length,
        supervisores,
        cascata
      };

      totalSupsGlobal += supervisores.length;
      console.log(`  ✅ [${g.sigla}] ${supervisores.length} supervisores | ${vendsFilial.size} vendedores mapeados.`);

    } catch (err) {
      console.error(`  ❌ Erro ao baixar dados de ${g.sigla}:`, err.message);
    }
  }

  const outPath = path.join(__dirname, 'supervisores_11_filiais_completo.json');
  fs.writeFileSync(outPath, JSON.stringify(arvoreCompleta, null, 2), 'utf8');

  console.log(`\n==================================================`);
  console.log(`💾 Árvore viva gravada com sucesso em: ${outPath}`);
  console.log(`📊 Estatísticas Globais Atualizadas:`);
  console.log(`   • Filiais: ${Object.keys(arvoreCompleta).length}`);
  console.log(`   • Supervisores: ${totalSupsGlobal}`);
  console.log(`   • Vendedores/RCAs Únicos: ${totalVendsGlobal.size}`);
  console.log(`==================================================\n`);
}

if (require.main === module) {
  atualizarArvoreCompleta().catch(console.error);
}

module.exports = { atualizarArvoreCompleta };
