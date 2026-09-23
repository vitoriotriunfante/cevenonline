const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';
const agent = new https.Agent({ rejectUnauthorized: false });

const FILIAIS_CONFIG = [
  { sigla: 'TBE', key: 'tbe1', gerentes: [{ nome: 'Diego', pass: 'abc123' }] },
  { sigla: 'TSJ', key: 'tsj1', gerentes: [{ nome: 'Saldanha', pass: 'abc123' }] },
  { sigla: 'MCD', key: 'mcd1', gerentes: [{ nome: 'Adriano', pass: 'abc123' }, { nome: 'Cleverson', pass: 'abc123' }] },
  { sigla: 'TPH', key: 'tph1', gerentes: [{ nome: 'Vagner', pass: 'abc123' }] }, // Bertoni desativado
  { sigla: 'TCG', key: 'tcg1', gerentes: [{ nome: 'Danilo', pass: 'abc123' }] },
  { sigla: 'TPA', key: 'tpa1', gerentes: [{ nome: 'Leandro Souza', pass: 'abc123' }, { nome: 'Christian Radke', pass: 'abc123' }] },
  { sigla: 'API', key: 'api1', gerentes: [{ nome: 'Fabio Colares', pass: 'abc123' }, { nome: 'Marcelo', pass: 'abc123' }] },
  { sigla: 'TCV', key: 'tcv1', gerentes: [{ nome: 'Leonardo', pass: 'abc123' }] },
  { sigla: 'ABC', key: 'abc1', gerentes: [{ nome: 'Marcos Colling', pass: 'abc123' }] },
  { sigla: 'TCA', key: 'tca1', gerentes: [{ nome: 'Becher', pass: 'abc123' }] },
  { sigla: 'TBL', key: 'tbl1', gerentes: [{ nome: 'Fabio Machado', pass: '123456', altPass: 'abc123' }] }
];

async function loginGerente(filialKey, nome, password, altPass) {
  const passwordsToTry = [password];
  if (altPass) passwordsToTry.push(altPass);

  for (const pw of passwordsToTry) {
    try {
      const res = await axios.post(`${CEVEN_BASE}/api/gerente-auth/login`, {
        filial: filialKey,
        nome,
        password: pw
      }, {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent: agent,
        timeout: 8000
      });
      if (res.data?.access_token) {
        return { token: res.data.access_token, nome, pw };
      }
    } catch (e) {}
  }
  return null;
}

async function fetchHierarquia() {
  console.log('=== ATUALIZANDO HIERARQUIA CEVEN — FILIAL É ESTRITAMENTE A SIGLA ===\n');

  const dadosConsolidados = [];
  const resumoFiliais = [];
  const tabelaLinhas = [];

  for (const fil of FILIAIS_CONFIG) {
    console.log(`🏢 Processando Filial: ${fil.sigla} [${fil.key}]...`);

    let token = null;
    let gerenteAutenticado = null;
    const gerentesNomes = fil.gerentes.map(g => g.nome).join(', ');

    for (const g of fil.gerentes) {
      const auth = await loginGerente(fil.key, g.nome, g.pass, g.altPass);
      if (auth) {
        token = auth.token;
        gerenteAutenticado = auth.nome;
        break;
      }
    }

    if (!token) {
      console.error(`  ❌ Falha de login para filial ${fil.sigla}!`);
      continue;
    }

    // 1. Supervisores
    let supervisores = [];
    try {
      const supRes = await axios.get(`${CEVEN_BASE}/api/gerente/supervisores?filial=${fil.key}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        httpsAgent: agent,
        timeout: 10000
      });
      supervisores = supRes.data || [];
    } catch (e) {
      console.error(`  ⚠️ Erro supervisores ${fil.sigla}:`, e.message);
    }

    const filialEstrutura = {
      filial: fil.sigla,
      codigoFilial: fil.key,
      gerentes: gerentesNomes,
      totalSupervisores: supervisores.length,
      supervisores: []
    };

    let totalRcasFilial = 0;

    for (const sup of supervisores) {
      let rcas = [];
      try {
        const rcaRes = await axios.get(`${CEVEN_BASE}/api/gerente/supervisor/rcas?filial=${fil.key}&supervisorId=${sup.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          httpsAgent: agent,
          timeout: 10000
        });
        rcas = rcaRes.data || [];
      } catch (e) {
        console.error(`  ⚠️ Erro RCAs ${sup.nome}:`, e.message);
      }

      totalRcasFilial += rcas.length;

      filialEstrutura.supervisores.push({
        supervisorId: sup.id,
        supervisorNome: sup.nome,
        totalRcas: rcas.length,
        rcas: rcas.map(r => ({ rcaId: r.id, rcaNome: r.nome }))
      });

      if (rcas.length === 0) {
        tabelaLinhas.push({
          'Filial': fil.sigla,
          'Código Filial': fil.key.toUpperCase(),
          'Gerente(s)': gerentesNomes,
          'Supervisor ID': sup.id,
          'Supervisor Nome': sup.nome,
          'RCA ID': '-',
          'RCA Nome': '(Sem vendedores ativos vinculados)'
        });
      } else {
        for (const r of rcas) {
          tabelaLinhas.push({
            'Filial': fil.sigla,
            'Código Filial': fil.key.toUpperCase(),
            'Gerente(s)': gerentesNomes,
            'Supervisor ID': sup.id,
            'Supervisor Nome': sup.nome,
            'RCA ID': r.id,
            'RCA Nome': r.nome
          });
        }
      }
    }

    filialEstrutura.totalRcas = totalRcasFilial;
    dadosConsolidados.push(filialEstrutura);

    resumoFiliais.push({
      'Filial': fil.sigla,
      'Código Filial': fil.key.toUpperCase(),
      'Gerente(s)': gerentesNomes,
      'Supervisores': supervisores.length,
      'Vendedores (RCAs)': totalRcasFilial
    });

    console.log(`  ✅ ${fil.sigla}: ${supervisores.length} supervisores, ${totalRcasFilial} vendedores`);
  }

  // 1. JSON
  try {
    const jsonPath = path.join(__dirname, 'hierarquia_completa_ceven.json');
    fs.writeFileSync(jsonPath, JSON.stringify(dadosConsolidados, null, 2), 'utf-8');
    console.log(`💾 JSON salvo: ${jsonPath}`);
  } catch (e) {
    console.warn('⚠️ Não foi possível salvar JSON:', e.message);
  }

  // 2. Excel
  try {
    const wb = XLSX.utils.book_new();
    const wsTabela = XLSX.utils.json_to_sheet(tabelaLinhas);
    XLSX.utils.book_append_sheet(wb, wsTabela, 'Hierarquia');
    const wsResumo = XLSX.utils.json_to_sheet(resumoFiliais);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo_Filiais');
    const xlsxPath = path.join(__dirname, 'hierarquia_completa_ceven.xlsx');
    XLSX.writeFile(wb, xlsxPath);
    console.log(`📊 Excel salvo: ${xlsxPath}`);
  } catch (e) {
    console.warn('⚠️ Não foi possível salvar Excel (pode estar aberto no Excel):', e.message);
  }

  // 3. CSV
  try {
    const csvHeaders = ['Filial', 'Código Filial', 'Gerente(s)', 'Supervisor ID', 'Supervisor Nome', 'RCA ID', 'RCA Nome'];
    const csvRows = [csvHeaders.join(';')];
    for (const row of tabelaLinhas) {
      csvRows.push([
        `"${row['Filial']}"`,
        `"${row['Código Filial']}"`,
        `"${row['Gerente(s)']}"`,
        `"${row['Supervisor ID']}"`,
        `"${row['Supervisor Nome']}"`,
        `"${row['RCA ID']}"`,
        `"${row['RCA Nome']}"`
      ].join(';'));
    }
    const csvPath = path.join(__dirname, 'hierarquia_completa_ceven.csv');
    fs.writeFileSync(csvPath, '\uFEFF' + csvRows.join('\n'), 'utf-8');
    console.log(`📄 CSV salvo: ${csvPath}`);
  } catch (e) {
    console.warn('⚠️ O arquivo hierarquia_completa_ceven.csv está aberto no Excel/outro programa:', e.message);
  }

  // 4. Markdown
  try {
    let md = `# 🏛️ HIERARQUIA OFICIAL CEVEN (GRUPO TRIUNFANTE / LOCOMOTIVA)\n\n`;
    md += `> **Data de Atualização:** ${new Date().toISOString().slice(0, 10)}\n`;
    md += `> **Filiais:** Siglas oficiais (TBE, TSJ, MCD, TPH, TCG, TPA, API, TCV, ABC, TCA, TBL)\n`;
    md += `> **Código Filial:** Idêntico ao CSV clientes_rf (ABC1, TCV1, etc.)\n`;
    md += `> **Ambiente:** \`analises/\`\n\n`;

    md += `## 📌 Resumo por Filial\n\n`;
    md += `| Filial | Código Filial | Gerente(s) | Supervisores | Vendedores (RCAs) |\n`;
    md += `| :---: | :---: | :--- | :---: | :---: |\n`;

    let totalSup = 0;
    let totalRca = 0;

    for (const r of resumoFiliais) {
      md += `| **${r['Filial']}** | \`${r['Código Filial']}\` | ${r['Gerente(s)']} | **${r['Supervisores']}** | **${r['Vendedores (RCAs)']}** |\n`;
      totalSup += r['Supervisores'];
      totalRca += r['Vendedores (RCAs)'];
    }
    md += `| **TOTAL** | **11 Filiais** | **15 Gerentes** | **${totalSup}** | **${totalRca}** |\n\n`;

    md += `---\n\n## 🌳 Árvore Hierárquica por Filial\n\n`;

    for (const f of dadosConsolidados) {
      md += `### 🏢 Filial **${f.filial}** (\`${f.codigoFilial.toUpperCase()}\`)\n`;
      md += `- **Gerente(s):** ${f.gerentes}\n`;
      md += `- **Supervisores:** ${f.totalSupervisores} | **Vendedores:** ${f.totalRcas}\n\n`;

      for (const sup of f.supervisores) {
        md += `#### 👤 Supervisor: **${sup.supervisorNome}** (Cód: \`${sup.supervisorId}\`) — *${sup.totalRcas} RCAs*\n`;
        if (sup.rcas.length === 0) {
          md += `  - *(Nenhum RCA ativo vinculado)*\n`;
        } else {
          md += `| RCA ID | Nome do Vendedor |\n`;
          md += `| :---: | :--- |\n`;
          for (const rca of sup.rcas) {
            md += `| \`${rca.rcaId}\` | ${rca.rcaNome} |\n`;
          }
        }
        md += `\n`;
      }
      md += `---\n\n`;
    }

    const mdPath = path.join(__dirname, 'HIERARQUIA_OFICIAL_CEVEN.md');
    fs.writeFileSync(mdPath, md, 'utf-8');
    console.log(`📝 Markdown salvo: ${mdPath}`);
  } catch (e) {
    console.warn('⚠️ Não foi possível salvar Markdown:', e.message);
  }

  console.log('\nArquivos regenerados com sucesso em analises/!');
}

fetchHierarquia();
