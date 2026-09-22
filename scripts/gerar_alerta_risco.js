const fs = require('fs');
const path = require('path');
const engine = require('../pipeline/ceven_unified_engine');

async function main() {
  const dataHoje = new Date().toISOString().split('T')[0];
  const repsMap = engine.carregarValidacaoVendedores();
  console.log(`Enriquecendo canal real (area_atuacao) de ${Object.keys(repsMap).length} contas...`);
  await engine.enriquecerCanalReal(repsMap);

  console.log('Coletando alerta de risco (isso pode levar alguns minutos)...');
  const porGerente = await engine.coletarAlertaRisco(repsMap, dataHoje);

  const outDir = path.join(__dirname, '..', 'auditoria_mensagens', dataHoje);
  fs.mkdirSync(outDir, { recursive: true });

  const geral = engine.formatarAlertaRiscoGeral(porGerente, '07:45');
  fs.writeFileSync(path.join(outDir, 'ALERTA_RISCO__GERAL.txt'), geral, 'utf8');
  console.log('-> Geral salvo.');

  let n = 0;
  for (const [chave, supMap] of Object.entries(porGerente)) {
    const [sigla, gerente] = chave.split('::');
    const texto = engine.formatarAlertaRiscoGerente(gerente, sigla, supMap, '07:45');
    const fname = `ALERTA_RISCO__${sigla}_${gerente.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`;
    fs.writeFileSync(path.join(outDir, fname), texto, 'utf8');
    n++;
  }
  console.log(`-> ${n} arquivos de gerente salvos em ${outDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
