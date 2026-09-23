/**
 * Ciclo 10:00 — Marcas Próprias. UM arquivo por destinatário (Vitório + cada gerente),
 * com HOJE e ACUMULADO DO MÊS juntos no mesmo arquivo. Usa o banco local
 * `analises/pedidos_historico_ceven.db` direto via SQL, sem varrer a API ao vivo.
 *
 * Regras de negócio (definidas com Vitório em 22/09/2026):
 * - TBE e TCG não vendem nenhuma marca própria — ficam de fora do envio
 * - ABC só tem 1 marca (Bellarone) — cobrar mais dele, não tratar com pena
 * - Sem ranking por ora — só visibilidade (consolidado + por filial + por supervisor)
 * - Zerados de hoje mostram há quantos dias o vendedor não vende MP (histórico), não só "zerou hoje"
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
function limparNome(n) { return (n || '').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim(); }

async function main() {
  const dataRef = process.argv[2] || new Date().toISOString().split('T')[0];
  const inicioMes = dataRef.slice(0, 8) + '01';
  const codigosMP = carregarMarcaPropria();
  const placeholders = codigosMP.map(() => '?').join(',');
  const dataFmt = new Date(dataRef + 'T12:00:00').toLocaleDateString('pt-BR');
  const inicioFmt = new Date(inicioMes + 'T12:00:00').toLocaleDateString('pt-BR');

  const repsMap = engine.carregarValidacaoVendedores();
  await engine.enriquecerCanalReal(repsMap);
  engine.aplicarMostraDisparos(repsMap);
  function resolverGerente(sigla, rcaId) {
    const val = repsMap[`${sigla}_${rcaId}`];
    if (val) return val.gerente;
    return (Object.values(engine.FILIAIS_MAP).find(f => f.sigla === sigla)?.gerente) || sigla;
  }
  function resolverSupervisor(sigla, rcaId) {
    const val = repsMap[`${sigla}_${rcaId}`];
    return (val?.supNome || 'SUPERVISÃO GERAL').toUpperCase().trim();
  }
  function isRcaVarejoValido(sigla, rcaId) {
    const val = repsMap[`${sigla}_${rcaId}`];
    return val && engine.isCanalVarejo(val.canal);
  }

  const db = new Database(path.join(__dirname, '..', 'analises', 'pedidos_historico_ceven.db'), { readonly: true });
  const FILIAIS_EXCLUIDAS = new Set(['TBE', 'TCG']);
  const ORDEM_FILIAIS = ['TPH', 'API', 'TBL', 'TCA', 'TSJ', 'TPA', 'ABC', 'TCV', 'MCD'];

  // =====================================================================
  // DADOS DE HOJE
  // =====================================================================
  const vendasHoje = db.prepare(`
    SELECT ph.filial_sigla, ph.rca_id, ph.nome_cliente,
           phi.codprod, phi.descricao, phi.quantidade, phi.valor_total
    FROM pedidos_historico ph
    JOIN pedidos_historico_itens phi ON phi.chave_pedido = ph.chave
    WHERE ph.data_pedido = ?
      AND phi.tipo_registro = 'VENDA'
      AND phi.codprod IN (${placeholders})
  `).all(dataRef, ...codigosMP).filter(r => isRcaVarejoValido(r.filial_sigla, r.rca_id));

  const todosPedidosHoje = db.prepare(`
    SELECT DISTINCT ph.filial_sigla, ph.rca_id, ph.rca_nome
    FROM pedidos_historico ph
    WHERE ph.data_pedido = ?
  `).all(dataRef);
  const rcasComMPHoje = new Set(vendasHoje.map(r => `${r.filial_sigla}_${r.rca_id}`));

  const ultimaVendaPorRca = {};
  db.prepare(`
    SELECT ph.filial_sigla, ph.rca_id, MAX(ph.data_pedido) as ultima_data
    FROM pedidos_historico ph
    JOIN pedidos_historico_itens phi ON phi.chave_pedido = ph.chave
    WHERE phi.tipo_registro = 'VENDA' AND phi.codprod IN (${placeholders})
    GROUP BY ph.filial_sigla, ph.rca_id
  `).all(...codigosMP).forEach(r => { ultimaVendaPorRca[`${r.filial_sigla}_${r.rca_id}`] = r.ultima_data; });
  function diasSemVenderMP(chaveRca) {
    const ultima = ultimaVendaPorRca[chaveRca];
    if (!ultima) return null;
    return { dias: Math.round((new Date(dataRef) - new Date(ultima)) / 86400000), ultima };
  }

  const hojePorGerente = {}; // "SIGLA::gerente" -> { sigla, gerente, fatMP, positivados, porSupervisor }
  function getHoje(sigla, gerente) {
    const chave = `${sigla}::${gerente}`;
    if (!hojePorGerente[chave]) hojePorGerente[chave] = { sigla, gerente, fatMP: 0, qtdItens: 0, positivados: new Set(), porSupervisor: {} };
    return hojePorGerente[chave];
  }
  vendasHoje.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    const gerente = resolverGerente(r.filial_sigla, r.rca_id);
    const sup = resolverSupervisor(r.filial_sigla, r.rca_id);
    const g = getHoje(r.filial_sigla, gerente);
    g.fatMP += r.valor_total || 0;
    g.qtdItens += r.quantidade || 0;
    g.positivados.add(r.nome_cliente);
    if (!g.porSupervisor[sup]) g.porSupervisor[sup] = { fat: 0, positivados: new Set() };
    g.porSupervisor[sup].fat += r.valor_total || 0;
    g.porSupervisor[sup].positivados.add(r.nome_cliente);
  });

  const zeradosPorGerente = {};
  todosPedidosHoje.forEach(p => {
    if (FILIAIS_EXCLUIDAS.has(p.filial_sigla)) return;
    const chaveRca = `${p.filial_sigla}_${p.rca_id}`;
    if (rcasComMPHoje.has(chaveRca)) return;
    if (!isRcaVarejoValido(p.filial_sigla, p.rca_id)) return;
    const gerente = resolverGerente(p.filial_sigla, p.rca_id);
    const sup = resolverSupervisor(p.filial_sigla, p.rca_id);
    const chave = `${p.filial_sigla}::${gerente}`;
    if (!zeradosPorGerente[chave]) zeradosPorGerente[chave] = {};
    if (!zeradosPorGerente[chave][sup]) zeradosPorGerente[chave][sup] = [];
    zeradosPorGerente[chave][sup].push({ nome: limparNome(p.rca_nome), hist: diasSemVenderMP(chaveRca) });
  });

  // =====================================================================
  // DADOS DO MÊS (ACUMULADO)
  // =====================================================================
  const vendasMes = db.prepare(`
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

  const cortesMes = db.prepare(`
    SELECT ph.filial_sigla, ph.rca_id, phi.codprod, phi.quantidade, phi.valor_total
    FROM pedidos_historico ph
    JOIN pedidos_historico_itens phi ON phi.chave_pedido = ph.chave
    WHERE ph.data_pedido BETWEEN ? AND ?
      AND phi.tipo_registro = 'CORTE'
      AND phi.codprod IN (${placeholders})
  `).all(inicioMes, dataRef, ...codigosMP)
    .filter(r => isRcaVarejoValido(r.filial_sigla, r.rca_id))
    .map(r => ({ ...r, valor_total: r.valor_total > 0 ? r.valor_total : (r.quantidade || 0) * (precoMedioPorSku[r.codprod] || 0) }));

  const devPlaceholders = codigosMP.map(() => '?').join(',');
  const devolucoesMes = db.prepare(`
    SELECT filial_codigo as filial_sigla, qtdev, vl_devolvido, data_devolucao
    FROM devolucoes_itens
    WHERE data_devolucao BETWEEN ? AND ?
      AND codprod IN (${devPlaceholders})
  `).all(inicioMes, dataRef, ...codigosMP);
  const devMaxData = db.prepare('SELECT MAX(data_devolucao) as max FROM devolucoes_itens').get().max;

  const mesPorGerente = {};
  function getMes(sigla, gerente) {
    const chave = `${sigla}::${gerente}`;
    if (!mesPorGerente[chave]) mesPorGerente[chave] = { sigla, gerente, fat: 0, qtd: 0, positivados: new Set(), cortesValor: 0, cortesQtd: 0, porSupervisor: {} };
    return mesPorGerente[chave];
  }
  vendasMes.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    const gerente = resolverGerente(r.filial_sigla, r.rca_id);
    const sup = resolverSupervisor(r.filial_sigla, r.rca_id);
    const g = getMes(r.filial_sigla, gerente);
    g.fat += r.valor_total || 0;
    g.qtd += r.quantidade || 0;
    g.positivados.add(r.nome_cliente);
    if (!g.porSupervisor[sup]) g.porSupervisor[sup] = { fat: 0, positivados: new Set() };
    g.porSupervisor[sup].fat += r.valor_total || 0;
    g.porSupervisor[sup].positivados.add(r.nome_cliente);
  });
  cortesMes.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    const gerente = resolverGerente(r.filial_sigla, r.rca_id);
    const g = getMes(r.filial_sigla, gerente);
    g.cortesValor += r.valor_total || 0;
    g.cortesQtd += r.quantidade || 0;
  });
  const devPorFilial = {};
  devolucoesMes.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    if (!devPorFilial[r.filial_sigla]) devPorFilial[r.filial_sigla] = { valor: 0, qtd: 0 };
    devPorFilial[r.filial_sigla].valor += r.vl_devolvido || 0;
    devPorFilial[r.filial_sigla].qtd += r.qtdev || 0;
  });

  // =====================================================================
  // MONTAGEM DOS ARQUIVOS (1 por destinatário)
  // =====================================================================
  const outDir = path.join(__dirname, '..', 'auditoria_mensagens', dataRef);
  fs.mkdirSync(outDir, { recursive: true });

  // ---- VITÓRIO: consolidado hoje + consolidado mês, tudo num arquivo ----
  let totFatHoje = 0, totItensHoje = 0;
  const totPositivadosHoje = new Set();
  const somaPorSiglaHoje = {};
  Object.values(hojePorGerente).forEach(g => {
    totFatHoje += g.fatMP; totItensHoje += g.qtdItens;
    g.positivados.forEach(c => totPositivadosHoje.add(c));
    if (!somaPorSiglaHoje[g.sigla]) somaPorSiglaHoje[g.sigla] = [];
    somaPorSiglaHoje[g.sigla].push({ gerente: g.gerente, fat: g.fatMP, positivados: g.positivados });
  });

  let totFatMes = 0, totQtdMes = 0, totCortesValorMes = 0, totCortesQtdMes = 0, totDevValorMes = 0, totDevQtdMes = 0;
  const totPositivadosMes = new Set();
  const somaPorSiglaMes = {};
  Object.values(mesPorGerente).forEach(g => {
    totFatMes += g.fat; totQtdMes += g.qtd; totCortesValorMes += g.cortesValor; totCortesQtdMes += g.cortesQtd;
    g.positivados.forEach(c => totPositivadosMes.add(c));
    if (!somaPorSiglaMes[g.sigla]) somaPorSiglaMes[g.sigla] = [];
    somaPorSiglaMes[g.sigla].push({ gerente: g.gerente, fat: g.fat, positivados: g.positivados, cortesValor: g.cortesValor });
  });
  Object.values(devPorFilial).forEach(d => { totDevValorMes += d.valor; totDevQtdMes += d.qtd; });

  let msgVitorio = `🎯 *MARCAS PRÓPRIAS — 10:00*\n📅 ${dataFmt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msgVitorio += `*ACUMULADO DO MÊS (${inicioFmt} a ${dataFmt})*\n`;
  msgVitorio += `💰 Faturado: R$ ${fmtMoeda(totFatMes)} • 📦 ${Math.round(totQtdMes)} itens • ✅ ${totPositivadosMes.size} PDVs\n`;
  msgVitorio += `✂️ Cortes: R$ ${fmtMoeda(totCortesValorMes)} (${Math.round(totCortesQtdMes)} un) • 🚛 Devoluções: R$ ${fmtMoeda(totDevValorMes)} (${Math.round(totDevQtdMes)} un)\n\n`;
  ORDEM_FILIAIS.forEach(sigla => {
    const lista = somaPorSiglaMes[sigla];
    const dev = devPorFilial[sigla];
    const nota = sigla === 'ABC' ? ' _(só 1 marca)_' : '';
    if (!lista) { msgVitorio += `📍 ${sigla}: R$ 0,00${nota}\n`; return; }
    lista.forEach(g => {
      msgVitorio += `📍 ${sigla} — ${g.gerente.toUpperCase()}: R$ ${fmtMoeda(g.fat)} • ${g.positivados.size} PDVs • ✂️ R$ ${fmtMoeda(g.cortesValor)} • 🚛 R$ ${fmtMoeda(dev?.valor || 0)}${nota}\n`;
    });
  });
  if (devMaxData < dataRef) {
    msgVitorio += `\n_(Nota: devoluções só têm dado até ${devMaxData} — rodar analises/extrair_tudo_devolucoes_cadastros.js)_`;
  }

  msgVitorio += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n*HOJE*\n`;
  msgVitorio += `💰 Faturado: R$ ${fmtMoeda(totFatHoje)} • 📦 ${Math.round(totItensHoje)} itens • ✅ ${totPositivadosHoje.size} PDVs\n\n`;
  ORDEM_FILIAIS.forEach(sigla => {
    const lista = somaPorSiglaHoje[sigla];
    const nota = sigla === 'ABC' ? ' _(só 1 marca)_' : '';
    if (!lista) { msgVitorio += `📍 ${sigla}: R$ 0,00${nota}\n`; return; }
    lista.forEach(g => {
      msgVitorio += `📍 ${sigla} — ${g.gerente.toUpperCase()}: R$ ${fmtMoeda(g.fat)} (${g.positivados.size} PDVs)${nota}\n`;
    });
  });
  fs.writeFileSync(path.join(outDir, '10_00__VITORIO.txt'), msgVitorio.trim(), 'utf8');

  // ---- POR GERENTE: hoje + zerados + mês, tudo num arquivo só ----
  const chavesTodas = new Set([...Object.keys(hojePorGerente), ...Object.keys(zeradosPorGerente), ...Object.keys(mesPorGerente)]);
  let nGerentes = 0;
  chavesTodas.forEach(chave => {
    const [sigla, gerente] = chave.split('::');
    const hoje = hojePorGerente[chave] || { fatMP: 0, positivados: new Set(), porSupervisor: {} };
    const zerados = zeradosPorGerente[chave] || {};
    const totalZerados = Object.values(zerados).reduce((a, l) => a + l.length, 0);
    const mes = mesPorGerente[chave] || { fat: 0, qtd: 0, positivados: new Set(), cortesValor: 0, cortesQtd: 0, porSupervisor: {} };
    const dev = devPorFilial[sigla];

    let m = `🎯 *MARCAS PRÓPRIAS — 10:00*\n📍 ${sigla} — ${gerente.toUpperCase()} • ${dataFmt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    m += `*ACUMULADO DO MÊS (${inicioFmt} a ${dataFmt})*\n`;
    m += `💰 R$ ${fmtMoeda(mes.fat)} • ${mes.positivados.size} PDVs • ✂️ R$ ${fmtMoeda(mes.cortesValor)} (${Math.round(mes.cortesQtd)} un)`;
    if (dev) m += ` • 🚛 R$ ${fmtMoeda(dev.valor)} _(filial toda)_`;
    m += `\n`;
    Object.entries(mes.porSupervisor)
      .sort((a, b) => b[1].fat - a[1].fat)
      .forEach(([sup, v]) => {
        m += `👤 ${sup} — R$ ${fmtMoeda(v.fat)} (${v.positivados.size} PDVs)\n`;
      });

    m += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n*HOJE*\n💰 R$ ${fmtMoeda(hoje.fatMP)} • ${hoje.positivados.size} PDVs positivados\n`;
    Object.entries(hoje.porSupervisor).forEach(([sup, v]) => {
      m += `👤 ${sup} — R$ ${fmtMoeda(v.fat)} (${v.positivados.size} PDVs)\n`;
    });

    if (totalZerados > 0) {
      m += `\n🚨 *ZERADOS EM MARCA PRÓPRIA HOJE (${totalZerados})*\n`;
      m += `_(fez pedido hoje, mas nenhum item era marca própria)_\n`;
      Object.entries(zerados).forEach(([sup, vendedores]) => {
        m += `\n👤 *${sup}*\n`;
        vendedores
          .sort((a, b) => (b.hist?.dias ?? 9999) - (a.hist?.dias ?? 9999))
          .forEach(v => {
            const tag = v.hist ? `${v.hist.dias}d sem vender MP` : 'nunca vendeu MP';
            m += `  • ${v.nome} — ${tag}\n`;
          });
      });
    }

    const nomeArquivo = `10_00__GERENTE_${sigla}_${gerente.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`;
    fs.writeFileSync(path.join(outDir, nomeArquivo), m.trim(), 'utf8');
    nGerentes++;
  });

  console.log(`Vitório: hoje R$ ${fmtMoeda(totFatHoje)} | mês R$ ${fmtMoeda(totFatMes)}`);
  console.log(`${nGerentes} gerentes (1 arquivo cada, hoje+mês juntos) salvos em ${outDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
