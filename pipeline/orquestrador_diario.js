/**
 * FICHA DO ARQUIVO
 * O QUE É: orquestrador que roda os 9 extratores (analises/*.js e *.py) na ordem certa
 *          (PDVs depende de hierarquia; produtividade depende de PDVs) e popula TODAS
 *          as tabelas de analises/pedidos_historico_ceven.db. Continua mesmo se um passo
 *          falhar (não trava os outros), e reporta no final o que funcionou/não funcionou.
 * RODA: todo dia às 03:00 BRT via .github/workflows/ceven-cron-datalake.yml (ou manual:
 *       `node pipeline/orquestrador_diario.js`).
 * LÊ: nada além do que cada extrator individual lê (API do CEVEN, principalmente).
 * ESCREVE: analises/pedidos_historico_ceven.db (todas as tabelas — ver PASSOS abaixo).
 * USADO POR: scripts/gerar_marca_propria.js, scripts/gerar_alerta_risco.js e qualquer
 *            relatório que leia esse banco (não os ciclos de WhatsApp em si, que puxam
 *            a API ao vivo direto — ver pipeline/ceven_unified_engine.js).
 * DEPENDE DE: o workflow que chama isso já baixou o banco do Google Drive antes (senão
 *             cria do zero) e faz upload de volta depois — ver ceven-cron-datalake.yml.
 * FRESCOR ESPERADO: 1x/dia. Se um passo aparecer "❌" no resumo final, só aquela tabela
 *                   ficou desatualizada — as outras 8 continuam valendo.
 *
 * Uso manual: node pipeline/orquestrador_diario.js
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
  { nome: 'Premiação RV + Ticket Médio/Mix', cmd: 'python', args: ['extrair_premiacao_e_ret_novo_har.py'] },
  { nome: 'Mix Gap Real (raio 3km, endpoint oficial)', cmd: 'node', args: ['gerar_mix_gap_real.js'] }
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
