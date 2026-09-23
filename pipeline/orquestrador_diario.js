/**
 * ORQUESTRADOR DIÁRIO — roda os 4 extratores que alimentam analises/pedidos_historico_ceven.db
 * na ordem certa (2 e 3 dependem do 1 já ter rodado). Continua mesmo se um passo falhar,
 * pra não travar os outros por causa de um problema pontual — e reporta no final o que
 * funcionou e o que não funcionou.
 *
 * Uso: node pipeline/orquestrador_diario.js
 */
const { spawn } = require('child_process');
const path = require('path');

const ANALISES = path.join(__dirname, '..', 'analises');

const PASSOS = [
  { nome: 'Hierarquia (supervisores/vendedores)', cmd: 'node', args: ['extrair_hierarquia_completa.js'] },
  { nome: 'PDVs + Prospects (base do dia)', cmd: 'python', args: ['coletar_todos_os_pdvs_e_prospects_100pct.py'] },
  { nome: 'Produtividade/Dashboard/RET ao vivo', cmd: 'python', args: ['extrair_produtividade_ret_dashboard_todos.py'] },
  { nome: 'Histórico de Pedidos', cmd: 'node', args: ['extrair_historico_completo_11_filiais.js'] },
  { nome: 'Devoluções + LinkUp', cmd: 'node', args: ['extrair_tudo_devolucoes_cadastros.js'] },
  { nome: 'Segmentos/Canal Real dos RCAs', cmd: 'node', args: ['extrair_segmentos_rcas.js'] },
  { nome: 'Metas e Produtividade dos RCAs', cmd: 'node', args: ['extrair_metas_dashboard_rcas.js'] },
  { nome: 'Premiação RV + Ticket Médio/Mix', cmd: 'python', args: ['extrair_premiacao_e_ret_novo_har.py'] }
];

function rodar(passo) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(70)}\n▶️  ${passo.nome}\n${'='.repeat(70)}`);
    const inicio = Date.now();
    const proc = spawn(passo.cmd, passo.args, { cwd: ANALISES, stdio: 'inherit' });
    proc.on('close', (code) => {
      const min = ((Date.now() - inicio) / 60000).toFixed(1);
      const ok = code === 0;
      console.log(`${ok ? '✅' : '❌'} ${passo.nome} — ${ok ? 'OK' : `falhou (código ${code})`} em ${min}min`);
      resolve({ nome: passo.nome, ok, min });
    });
    proc.on('error', (e) => {
      console.log(`❌ ${passo.nome} — erro ao iniciar: ${e.message}`);
      resolve({ nome: passo.nome, ok: false, erro: e.message });
    });
  });
}

async function main() {
  console.log(`🚀 ORQUESTRADOR DIÁRIO — ${new Date().toISOString()}`);
  const resultados = [];
  for (const passo of PASSOS) {
    resultados.push(await rodar(passo));
  }

  console.log(`\n${'='.repeat(70)}\n📋 RESUMO FINAL\n${'='.repeat(70)}`);
  resultados.forEach(r => console.log(`${r.ok ? '✅' : '❌'} ${r.nome}${r.min ? ` (${r.min}min)` : ''}${r.erro ? ` — ${r.erro}` : ''}`));

  const falhas = resultados.filter(r => !r.ok);
  if (falhas.length > 0) {
    console.log(`\n⚠️ ${falhas.length} de ${resultados.length} passos falharam.`);
    process.exitCode = 1;
  } else {
    console.log(`\n🎯 Todos os ${resultados.length} passos concluídos com sucesso.`);
  }
}

main();
