import fs from 'fs';
import path from 'path';

const meses = ['2026-08', '2026-09', '2026-10', '2026-11'];
const sqlStatements = [];

// Limpar tabelas antes de popular
sqlStatements.push("DELETE FROM gerot_historico_industrias;");
sqlStatements.push("DELETE FROM gerot_historico_filiais;");
sqlStatements.push("DELETE FROM gerot_historico_supervisores;");

for (const mes of meses) {
  const filePath = path.resolve(`pipeline/gerot_consolidado/gerot_${mes}.json`);
  if (!fs.existsSync(filePath)) continue;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // 1. Fornecedores
  const fornecedores = data.dimensoes['Fornecedor'] || [];
  for (const f of fornecedores) {
    if (f.length < 5) continue;
    const nomeBruto = f[0].replace(/'/g, "''");
    const nomeLimpo = f[0].replace(/^\d+º/, '').replace(/—/, '').replace(/\d{14}$/, '').trim().replace(/'/g, "''").toUpperCase();

    sqlStatements.push(
      `INSERT INTO gerot_historico_industrias (mes, fornecedor, fornecedor_limpo, media_ponderada, faturado, faturado_carteira, captacao, positivacao, mix, cortes, devolucao, tmf) ` +
      `VALUES ('${mes}', '${nomeBruto}', '${nomeLimpo}', '${f[1] || ''}', '${f[2] || ''}', '${f[3] || ''}', '${f[4] || ''}', '${f[5] || ''}', '${f[6] || ''}', '${f[9] || ''}', '${f[10] || ''}', '${f[11] || ''}');`
    );
  }

  // 2. Filiais
  const filiais = data.dimensoes['Filial'] || [];
  for (const fil of filiais) {
    if (fil.length < 5) continue;
    const nomeFilial = fil[0].replace(/'/g, "''");
    sqlStatements.push(
      `INSERT INTO gerot_historico_filiais (mes, filial, media_ponderada, faturado, faturado_carteira, captacao, positivacao, mix, cortes, devolucao, tmf) ` +
      `VALUES ('${mes}', '${nomeFilial}', '${fil[1] || ''}', '${fil[2] || ''}', '${fil[3] || ''}', '${fil[4] || ''}', '${fil[5] || ''}', '${fil[6] || ''}', '${fil[9] || ''}', '${fil[10] || ''}', '${fil[11] || ''}');`
    );
  }

  // 3. Supervisores
  const supervisores = data.dimensoes['Supervisor'] || [];
  for (const sup of supervisores) {
    if (sup.length < 5) continue;
    const nomeSup = sup[0].replace(/'/g, "''");
    sqlStatements.push(
      `INSERT INTO gerot_historico_supervisores (mes, supervisor, media_ponderada, faturado, faturado_carteira, captacao, positivacao, mix, cortes, devolucao) ` +
      `VALUES ('${mes}', '${nomeSup}', '${sup[1] || ''}', '${sup[2] || ''}', '${sup[3] || ''}', '${sup[4] || ''}', '${sup[5] || ''}', '${sup[6] || ''}', '${sup[9] || ''}', '${sup[10] || ''}');`
    );
  }
}

const sqlOutput = sqlStatements.join('\n');
fs.writeFileSync('migrations/popular_gerot_d1.sql', sqlOutput, 'utf-8');
console.log(`✅ Gerado arquivo migrations/popular_gerot_d1.sql com ${sqlStatements.length} instruções.`);

