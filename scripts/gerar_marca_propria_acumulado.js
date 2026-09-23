/**
 * Panorama ACUMULADO do mês (dia 1 até hoje) de Marcas Próprias: faturamento,
 * positivação, cortes e devoluções. Gera UMA mensagem geral (Vitório) E uma
 * por gerente (aberta por supervisor), não só o consolidado.
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

async function main() {
  const dataRef = process.argv[2] || new Date().toISOString().split('T')[0];
  const inicioMes = dataRef.slice(0, 8) + '01'; // YYYY-MM-01
  const codigosMP = carregarMarcaPropria();
  const placeholders = codigosMP.map(() => '?').join(',');

  const engineRepsMap = engine.carregarValidacaoVendedores();
  await engine.enriquecerCanalReal(engineRepsMap);
  function resolverGerente(sigla, rcaId) {
    const val = engineRepsMap[`${sigla}_${rcaId}`];
    if (val) return val.gerente;
    return (Object.values(engine.FILIAIS_MAP).find(f => f.sigla === sigla)?.gerente) || sigla;
  }
  function resolverSupervisor(sigla, rcaId) {
    const val = engineRepsMap[`${sigla}_${rcaId}`];
    return (val?.supNome || 'SUPERVISÃO GERAL').toUpperCase().trim();
  }
  function isRcaVarejoValido(sigla, rcaId) {
    const val = engineRepsMap[`${sigla}_${rcaId}`];
    return val && engine.isCanalVarejo(val.canal);
  }

  const db = new Database(path.join(__dirname, '..', 'analises', 'pedidos_historico_ceven.db'), { readonly: true });

  const vendas = db.prepare(`
    SELECT ph.filial_sigla, ph.rca_id, ph.nome_cliente, phi.codprod, phi.quantidade, phi.valor_total
    FROM pedidos_historico ph
    JOIN pedidos_historico_itens phi ON phi.chave_pedido = ph.chave
    WHERE ph.data_pedido BETWEEN ? AND ?
      AND phi.tipo_registro = 'VENDA'
      AND phi.codprod IN (${placeholders})
  `).all(inicioMes, dataRef, ...codigosMP).filter(r => isRcaVarejoValido(r.filial_sigla, r.rca_id));

  const precoMedioPorSku = {};
  db.prepare(`
    SELECT codprod, AVG(valor_total * 1.0 / quantidade) as preco
    FROM pedidos_historico_itens
    WHERE tipo_registro = 'VENDA' AND quantidade > 0 AND codprod IN (${placeholders})
    GROUP BY codprod
  `).all(...codigosMP).forEach(r => { precoMedioPorSku[r.codprod] = r.preco || 0; });

  const cortes = db.prepare(`
    SELECT ph.filial_sigla, ph.rca_id, phi.codprod, phi.quantidade, phi.valor_total
    FROM pedidos_historico ph
    JOIN pedidos_historico_itens phi ON phi.chave_pedido = ph.chave
    WHERE ph.data_pedido BETWEEN ? AND ?
      AND phi.tipo_registro = 'CORTE'
      AND phi.codprod IN (${placeholders})
  `).all(inicioMes, dataRef, ...codigosMP)
    .filter(r => isRcaVarejoValido(r.filial_sigla, r.rca_id))
    .map(r => ({
      ...r,
      valor_total: r.valor_total > 0 ? r.valor_total : (r.quantidade || 0) * (precoMedioPorSku[r.codprod] || 0)
    }));

  // Devoluções não têm rca_id direto ligado facilmente à árvore (usa rca_nome da tabela
  // de devolução, que já vem no formato certo) — mantém a granularidade por filial só.
  const devPlaceholders = codigosMP.map(() => '?').join(',');
  const devolucoes = db.prepare(`
    SELECT filial_codigo as filial_sigla, qtdev, vl_devolvido, data_devolucao
    FROM devolucoes_itens
    WHERE data_devolucao BETWEEN ? AND ?
      AND codprod IN (${devPlaceholders})
  `).all(inicioMes, dataRef, ...codigosMP);
  const devMaxData = db.prepare('SELECT MAX(data_devolucao) as max FROM devolucoes_itens').get().max;

  const FILIAIS_EXCLUIDAS = new Set(['TBE', 'TCG']);

  // porGerente: chave composta "SIGLA::gerente" — permite separar MCD/TPH por sub-gerente
  const porGerente = {};
  function getGerente(sigla, gerente) {
    const chave = `${sigla}::${gerente}`;
    if (!porGerente[chave]) {
      porGerente[chave] = {
        sigla, gerente, fat: 0, qtd: 0, positivados: new Set(),
        cortesValor: 0, cortesQtd: 0, devValor: 0, devQtd: 0,
        porSupervisor: {}
      };
    }
    return porGerente[chave];
  }

  vendas.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    const gerente = resolverGerente(r.filial_sigla, r.rca_id);
    const sup = resolverSupervisor(r.filial_sigla, r.rca_id);
    const g = getGerente(r.filial_sigla, gerente);
    g.fat += r.valor_total || 0;
    g.qtd += r.quantidade || 0;
    g.positivados.add(r.nome_cliente);
    if (!g.porSupervisor[sup]) g.porSupervisor[sup] = { fat: 0, positivados: new Set() };
    g.porSupervisor[sup].fat += r.valor_total || 0;
    g.porSupervisor[sup].positivados.add(r.nome_cliente);
  });
  cortes.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    const gerente = resolverGerente(r.filial_sigla, r.rca_id);
    const g = getGerente(r.filial_sigla, gerente);
    g.cortesValor += r.valor_total || 0;
    g.cortesQtd += r.quantidade || 0;
  });

  // Devoluções: só dá pra atribuir por FILIAL (não por gerente/sub-gerente), soma em
  // todos os gerentes daquela filial proporcionalmente não faz sentido — guarda à parte
  // por filial e mostra só no consolidado geral e uma vez por filial (não duplicado por sub-gerente).
  const devPorFilial = {};
  devolucoes.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    if (!devPorFilial[r.filial_sigla]) devPorFilial[r.filial_sigla] = { valor: 0, qtd: 0 };
    devPorFilial[r.filial_sigla].valor += r.vl_devolvido || 0;
    devPorFilial[r.filial_sigla].qtd += r.qtdev || 0;
  });

  // ===== Agregados gerais e por filial (pro Vitório) =====
  let totFat = 0, totQtd = 0, totCortesValor = 0, totCortesQtd = 0, totDevValor = 0, totDevQtd = 0;
  const totPositivados = new Set();
  const porFilialSoma = {};
  Object.values(porGerente).forEach(g => {
    totFat += g.fat; totQtd += g.qtd; totCortesValor += g.cortesValor; totCortesQtd += g.cortesQtd;
    g.positivados.forEach(c => totPositivados.add(c));
    if (!porFilialSoma[g.sigla]) porFilialSoma[g.sigla] = { fat: 0, positivados: new Set(), cortesValor: 0 };
    porFilialSoma[g.sigla].fat += g.fat;
    g.positivados.forEach(c => porFilialSoma[g.sigla].positivados.add(c));
    porFilialSoma[g.sigla].cortesValor += g.cortesValor;
  });
  Object.entries(devPorFilial).forEach(([sigla, d]) => { totDevValor += d.valor; totDevQtd += d.qtd; });

  const dataFmt = new Date(dataRef + 'T12:00:00').toLocaleDateString('pt-BR');
  const inicioFmt = new Date(inicioMes + 'T12:00:00').toLocaleDateString('pt-BR');
  const outDir = path.join(__dirname, '..', 'auditoria_mensagens', dataRef);
  fs.mkdirSync(outDir, { recursive: true });

  // ===== MENSAGEM GERAL (Vitório) =====
  let msgGeral = `🎯 *MARCAS PRÓPRIAS — ACUMULADO DO MÊS*\n📅 ${inicioFmt} a ${dataFmt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msgGeral += `💰 *Faturado no mês:* R$ ${fmtMoeda(totFat)}\n`;
  msgGeral += `📦 *Itens vendidos:* ${Math.round(totQtd)} un\n`;
  msgGeral += `✅ *PDVs positivados (distintos):* ${totPositivados.size}\n`;
  msgGeral += `✂️ *Cortes no mês:* R$ ${fmtMoeda(totCortesValor)} (${Math.round(totCortesQtd)} un)\n`;
  msgGeral += `🚛 *Devoluções no mês:* R$ ${fmtMoeda(totDevValor)} (${Math.round(totDevQtd)} un)\n\n`;
  msgGeral += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏢 *POR FILIAL*\n\n`;

  const ORDEM_FILIAIS = ['TPH', 'API', 'TBL', 'TCA', 'TSJ', 'TPA', 'ABC', 'TCV', 'MCD'];
  ORDEM_FILIAIS.forEach(sigla => {
    const f = porFilialSoma[sigla];
    const dev = devPorFilial[sigla];
    const nota = sigla === 'ABC' ? ' _(só 1 marca disponível)_' : '';
    if (!f) { msgGeral += `📍 *${sigla}:* R$ 0,00${nota}\n`; return; }
    msgGeral += `📍 *${sigla}:* R$ ${fmtMoeda(f.fat)} • ${f.positivados.size} PDVs • ✂️ R$ ${fmtMoeda(f.cortesValor)} • 🚛 R$ ${fmtMoeda(dev?.valor || 0)}${nota}\n`;
  });

  if (devMaxData < dataRef) {
    msgGeral += `\n_(Nota: devoluções só têm dado atualizado até ${devMaxData} — rodar analises/extrair_tudo_devolucoes_cadastros.js pra atualizar)_`;
  }
  fs.writeFileSync(path.join(outDir, '10_00__VITORIO_ACUMULADO_MES.txt'), msgGeral.trim(), 'utf8');

  // ===== MENSAGENS POR GERENTE (aberta por supervisor) =====
  let nGerentes = 0;
  Object.values(porGerente).forEach(g => {
    const dev = devPorFilial[g.sigla];
    let m = `🎯 *MARCAS PRÓPRIAS — ACUMULADO DO MÊS*\n📍 ${g.sigla} — ${(g.gerente || '').toUpperCase()} • ${inicioFmt} a ${dataFmt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    m += `💰 R$ ${fmtMoeda(g.fat)} • ${g.positivados.size} PDVs • ✂️ R$ ${fmtMoeda(g.cortesValor)} (${Math.round(g.cortesQtd)} un)`;
    if (dev) m += ` • 🚛 R$ ${fmtMoeda(dev.valor)} _(filial toda, não só esse sub-gerente)_`;
    m += `\n\n`;
    Object.entries(g.porSupervisor)
      .sort((a, b) => b[1].fat - a[1].fat)
      .forEach(([sup, v]) => {
        m += `👤 *${sup}* — R$ ${fmtMoeda(v.fat)} (${v.positivados.size} PDVs)\n`;
      });
    const nomeArquivo = `10_00__GERENTE_${g.sigla}_${g.gerente.replace(/[^a-zA-Z0-9]+/g, '_')}_ACUMULADO_MES.txt`;
    fs.writeFileSync(path.join(outDir, nomeArquivo), m.trim(), 'utf8');
    nGerentes++;
  });

  console.log(`Geral: R$ ${fmtMoeda(totFat)} | ${totPositivados.size} PDVs`);
  console.log(`${nGerentes} gerentes com acumulado do mês salvos em ${outDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
