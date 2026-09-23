/**
 * Panorama ACUMULADO do mês (dia 1 até hoje) de Marcas Próprias: faturamento,
 * positivação, cortes e devoluções. Complementa o gerar_marca_propria.js (que só
 * mostra o dia). Usa o mesmo banco local `analises/pedidos_historico_ceven.db`.
 */
const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const engine = require('../pipeline/ceven_unified_engine');

function carregarMarcaPropria() {
  const wb = XLSX.readFile(path.join(__dirname, '..', 'Produtos - Marcas Exclusivas.xls'));
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const codigos = [];
  data.forEach(r => {
    if ((r.FILIAIS_VENDA || '').includes('IGNORAR')) return;
    codigos.push(String(r.CODPROD));
  });
  return codigos;
}

function fmtMoeda(v) { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function limparNome(n) { return (n || '').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').toUpperCase().trim(); }

function main() {
  const dataRef = process.argv[2] || new Date().toISOString().split('T')[0];
  const inicioMes = dataRef.slice(0, 8) + '01'; // YYYY-MM-01
  const codigosMP = carregarMarcaPropria();
  const placeholders = codigosMP.map(() => '?').join(',');

  const engineRepsMap = engine.carregarValidacaoVendedores();
  const supParaGerente = {};
  Object.values(engineRepsMap).forEach(v => { supParaGerente[`${v.filial}::${limparNome(v.supNome)}`] = v.gerente; });
  function resolverGerente(sigla, supNome) {
    return supParaGerente[`${sigla}::${limparNome(supNome)}`]
      || (Object.values(engine.FILIAIS_MAP).find(f => f.sigla === sigla)?.gerente) || sigla;
  }

  const db = new Database(path.join(__dirname, '..', 'analises', 'pedidos_historico_ceven.db'), { readonly: true });

  // Vendas (faturamento + positivação)
  const vendas = db.prepare(`
    SELECT ph.filial_sigla, ph.supervisor_nome, ph.nome_cliente, phi.codprod, phi.quantidade, phi.valor_total
    FROM pedidos_historico ph
    JOIN pedidos_historico_itens phi ON phi.chave_pedido = ph.chave
    WHERE ph.data_pedido BETWEEN ? AND ?
      AND phi.tipo_registro = 'VENDA'
      AND phi.codprod IN (${placeholders})
  `).all(inicioMes, dataRef, ...codigosMP);

  // Cortes — o valor_total de um corte quase sempre vem 0/vazio na fonte (o CEVEN não
  // preenche isso). Mas dá pra calcular de verdade: pega o preço médio real de venda
  // desse mesmo SKU (de outros pedidos não cortados, no mesmo período) e multiplica
  // pela quantidade cortada — não fica sem valor só porque a fonte não preencheu.
  const precoMedioPorSku = {};
  db.prepare(`
    SELECT codprod, AVG(valor_total * 1.0 / quantidade) as preco
    FROM pedidos_historico_itens
    WHERE tipo_registro = 'VENDA' AND quantidade > 0 AND codprod IN (${placeholders})
    GROUP BY codprod
  `).all(...codigosMP).forEach(r => { precoMedioPorSku[r.codprod] = r.preco || 0; });

  const cortes = db.prepare(`
    SELECT ph.filial_sigla, phi.codprod, phi.quantidade, phi.valor_total
    FROM pedidos_historico ph
    JOIN pedidos_historico_itens phi ON phi.chave_pedido = ph.chave
    WHERE ph.data_pedido BETWEEN ? AND ?
      AND phi.tipo_registro = 'CORTE'
      AND phi.codprod IN (${placeholders})
  `).all(inicioMes, dataRef, ...codigosMP).map(r => ({
    ...r,
    valor_total: r.valor_total > 0 ? r.valor_total : (r.quantidade || 0) * (precoMedioPorSku[r.codprod] || 0)
  }));

  // Devoluções (ATENÇÃO: tabela desatualizada, só vai até 12/09 — ver nota no rodapé)
  const devPlaceholders = codigosMP.map(() => '?').join(',');
  const devolucoes = db.prepare(`
    SELECT filial_codigo as filial_sigla, qtdev, vl_devolvido, data_devolucao
    FROM devolucoes_itens
    WHERE data_devolucao BETWEEN ? AND ?
      AND codprod IN (${devPlaceholders})
  `).all(inicioMes, dataRef, ...codigosMP);
  const devMaxData = db.prepare('SELECT MAX(data_devolucao) as max FROM devolucoes_itens').get().max;

  const FILIAIS_EXCLUIDAS = new Set(['TBE', 'TCG']);
  const porFilial = {};
  function getFilial(sigla) {
    if (!porFilial[sigla]) porFilial[sigla] = { fat: 0, qtd: 0, positivados: new Set(), cortesValor: 0, cortesQtd: 0, devValor: 0, devQtd: 0 };
    return porFilial[sigla];
  }

  vendas.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    const f = getFilial(r.filial_sigla);
    f.fat += r.valor_total || 0;
    f.qtd += r.quantidade || 0;
    f.positivados.add(r.nome_cliente);
  });
  cortes.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    const f = getFilial(r.filial_sigla);
    f.cortesValor += r.valor_total || 0;
    f.cortesQtd += r.quantidade || 0;
  });
  devolucoes.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    const f = getFilial(r.filial_sigla);
    f.devValor += r.vl_devolvido || 0;
    f.devQtd += r.qtdev || 0;
  });

  let totFat = 0, totQtd = 0, totCortesValor = 0, totCortesQtd = 0, totDevValor = 0, totDevQtd = 0;
  const totPositivados = new Set();
  Object.values(porFilial).forEach(f => {
    totFat += f.fat; totQtd += f.qtd; totCortesValor += f.cortesValor; totCortesQtd += f.cortesQtd;
    totDevValor += f.devValor; totDevQtd += f.devQtd;
    f.positivados.forEach(c => totPositivados.add(c));
  });

  const dataFmt = new Date(dataRef + 'T12:00:00').toLocaleDateString('pt-BR');
  const inicioFmt = new Date(inicioMes + 'T12:00:00').toLocaleDateString('pt-BR');

  let msg = `🎯 *MARCAS PRÓPRIAS — ACUMULADO DO MÊS*\n📅 ${inicioFmt} a ${dataFmt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `💰 *Faturado no mês:* R$ ${fmtMoeda(totFat)}\n`;
  msg += `📦 *Itens vendidos:* ${Math.round(totQtd)} un\n`;
  msg += `✅ *PDVs positivados (distintos):* ${totPositivados.size}\n`;
  msg += `✂️ *Cortes no mês:* R$ ${fmtMoeda(totCortesValor)} (${Math.round(totCortesQtd)} un)\n`;
  msg += `🚛 *Devoluções no mês:* R$ ${fmtMoeda(totDevValor)} (${Math.round(totDevQtd)} un)\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏢 *POR FILIAL*\n\n`;

  const ORDEM_FILIAIS = ['TPH', 'API', 'TBL', 'TCA', 'TSJ', 'TPA', 'ABC', 'TCV', 'MCD'];
  ORDEM_FILIAIS.forEach(sigla => {
    const f = porFilial[sigla];
    const nota = sigla === 'ABC' ? ' _(só 1 marca disponível)_' : '';
    if (!f) { msg += `📍 *${sigla}:* R$ 0,00${nota}\n`; return; }
    msg += `📍 *${sigla}:* R$ ${fmtMoeda(f.fat)} • ${f.positivados.size} PDVs • ✂️ R$ ${fmtMoeda(f.cortesValor)} • 🚛 R$ ${fmtMoeda(f.devValor)}${nota}\n`;
  });

  if (devMaxData < dataRef) {
    msg += `\n_(Nota: devoluções só têm dado atualizado até ${devMaxData} — rodar analises/extrair_tudo_devolucoes_cadastros.js pra atualizar)_`;
  }

  const outDir = path.join(__dirname, '..', 'auditoria_mensagens', dataRef);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '10_00__VITORIO_ACUMULADO_MES.txt'), msg.trim(), 'utf8');
  console.log(msg);
}

main();
