/**
 * Ciclo 10:00 — Marcas Próprias. Usa o banco local `analises/pedidos_historico_ceven.db`
 * (populado e mantido pelo extrair_historico_completo_11_filiais.js) em vez de varrer a
 * API ao vivo — muito mais rápido, e o dado já está lá.
 *
 * Regras de negócio (definidas com Vitório em 22/09/2026):
 * - TBE e TCG não vendem nenhuma marca própria — ficam de fora do envio
 * - ABC só tem 1 marca (Bellarone) — cobrar mais dele, não tratar com pena
 * - Sem ranking por ora — só visibilidade (consolidado + por filial + por supervisor)
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
    if ((r.FILIAIS_VENDA || '').includes('IGNORAR')) return; // exclusivo institucional
    codigos.push(String(r.CODPROD));
  });
  return codigos;
}

function fmtMoeda(v) { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

async function main() {
  const dataRef = process.argv[2] || new Date().toISOString().split('T')[0];
  const codigosMP = carregarMarcaPropria();
  const placeholders = codigosMP.map(() => '?').join(',');

  // Hierarquia oficial (mesma fonte usada no resto do pipeline) para resolver o gerente
  // real por supervisor, incluindo o split de sub-gerência de MCD/TPH.
  const repsMap = engine.carregarValidacaoVendedores();
  // IMPORTANTE: sem isso o canal fica hardcoded 'VJ' pra todo mundo (inclusive contas de
  // GERENTE/SUP), deixando essas contas passarem pelo filtro de "Varejo válido" por engano.
  await engine.enriquecerCanalReal(repsMap);
  function limparNome(n) {
    return (n || '').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').toUpperCase().trim();
  }
  const supParaGerente = {}; // "SIGLA::SUPNOME" -> gerente
  Object.values(repsMap).forEach(v => {
    const chave = `${v.filial}::${limparNome(v.supNome)}`;
    supParaGerente[chave] = v.gerente;
  });
  function resolverGerente(sigla, supNome) {
    const chave = `${sigla}::${limparNome(supNome)}`;
    if (supParaGerente[chave]) return supParaGerente[chave];
    return (engine.FILIAIS_MAP && Object.values(engine.FILIAIS_MAP).find(f => f.sigla === sigla)?.gerente) || sigla;
  }

  const db = new Database(path.join(__dirname, '..', 'analises', 'pedidos_historico_ceven.db'), { readonly: true });

  const rows = db.prepare(`
    SELECT ph.filial_sigla, ph.gerente_nome, ph.supervisor_nome, ph.nome_cliente,
           ph.rca_id, ph.rca_nome,
           phi.codprod, phi.descricao, phi.quantidade, phi.valor_total
    FROM pedidos_historico ph
    JOIN pedidos_historico_itens phi ON phi.chave_pedido = ph.chave
    WHERE ph.data_pedido = ?
      AND phi.tipo_registro = 'VENDA'
      AND phi.codprod IN (${placeholders})
  `).all(dataRef, ...codigosMP);

  // FILIAIS FORA DO ENVIO (não vendem marca própria)
  const FILIAIS_EXCLUIDAS = new Set(['TBE', 'TCG']);

  // Zerados de Marca Própria: vendedores de Varejo que fizeram pedido HOJE (de qualquer
  // produto) mas NENHUM item era marca própria — isso é o que dá pro gerente cobrar de
  // verdade, em vez de só ver quem vendeu pouco.
  const todosPedidosHoje = db.prepare(`
    SELECT DISTINCT ph.filial_sigla, ph.rca_id, ph.rca_nome, ph.supervisor_nome
    FROM pedidos_historico ph
    WHERE ph.data_pedido = ?
  `).all(dataRef);
  const rcasComMPHoje = new Set(rows.map(r => `${r.filial_sigla}_${r.rca_id}`));

  // Chave composta "SIGLA::gerente" — evita colisão entre gerentes de filiais diferentes
  // com o mesmo nome, e permite separar MCD/TPH em blocos por sub-gerente.
  const porFilial = {};
  rows.forEach(r => {
    if (FILIAIS_EXCLUIDAS.has(r.filial_sigla)) return;
    const gerente = resolverGerente(r.filial_sigla, r.supervisor_nome);
    const chaveFilial = `${r.filial_sigla}::${gerente}`;
    if (!porFilial[chaveFilial]) {
      porFilial[chaveFilial] = { sigla: r.filial_sigla, gerente, fatMP: 0, qtdItens: 0, positivados: new Set(), porSku: {}, porSupervisor: {} };
    }
    const f = porFilial[chaveFilial];
    f.fatMP += r.valor_total || 0;
    f.qtdItens += r.quantidade || 0;
    f.positivados.add(r.nome_cliente);
    if (!f.porSku[r.codprod]) f.porSku[r.codprod] = { qtd: 0, fat: 0, descricao: r.descricao };
    f.porSku[r.codprod].qtd += r.quantidade || 0;
    f.porSku[r.codprod].fat += r.valor_total || 0;
    const sup = (r.supervisor_nome || 'SUPERVISÃO GERAL').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim();
    if (!f.porSupervisor[sup]) f.porSupervisor[sup] = { fat: 0, positivados: new Set() };
    f.porSupervisor[sup].fat += r.valor_total || 0;
    f.porSupervisor[sup].positivados.add(r.nome_cliente);
  });

  // ===== MENSAGEM GERAL (Vitório) =====
  let totalFat = 0, totalItens = 0;
  const totalPositivados = new Set();
  Object.values(porFilial).forEach(f => { totalFat += f.fatMP; totalItens += f.qtdItens; f.positivados.forEach(c => totalPositivados.add(c)); });

  const dataFmt = new Date(dataRef + 'T12:00:00').toLocaleDateString('pt-BR');
  let msgGeral = `🎯 *MARCAS PRÓPRIAS — 10:00*\n📅 ${dataFmt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msgGeral += `💰 *Faturado Hoje:* R$ ${fmtMoeda(totalFat)}\n`;
  msgGeral += `📦 *Itens Vendidos:* ${Math.round(totalItens)} un\n`;
  msgGeral += `✅ *PDVs Positivados:* ${totalPositivados.size}\n\n`;
  msgGeral += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏢 *POR FILIAL*\n\n`;

  // Agrupar por filial pra exibição no geral (soma os sub-gerentes de MCD/TPH numa linha só)
  const somaPorSigla = {};
  Object.values(porFilial).forEach(f => {
    if (!somaPorSigla[f.sigla]) somaPorSigla[f.sigla] = { fat: 0, positivados: new Set(), gerentes: [] };
    somaPorSigla[f.sigla].fat += f.fatMP;
    f.positivados.forEach(c => somaPorSigla[f.sigla].positivados.add(c));
    somaPorSigla[f.sigla].gerentes.push(f.gerente);
  });

  const ORDEM_FILIAIS = ['TPH', 'API', 'TBL', 'TCA', 'TSJ', 'TPA', 'ABC', 'TCV', 'MCD'];
  ORDEM_FILIAIS.forEach(sigla => {
    const s = somaPorSigla[sigla];
    if (!s) { msgGeral += `📍 *${sigla}:* R$ 0,00 (0 PDVs)\n`; return; }
    const nota = sigla === 'ABC' ? ' _(só 1 marca disponível)_' : '';
    msgGeral += `📍 *${sigla} — ${s.gerentes.join(' / ').toUpperCase()}:* R$ ${fmtMoeda(s.fat)} (${s.positivados.size} PDVs)${nota}\n`;
  });

  // Monta zerados por chave "SIGLA::gerente" (mesmo padrão de agrupamento de porFilial)
  const zeradosPorFilial = {};
  todosPedidosHoje.forEach(p => {
    if (FILIAIS_EXCLUIDAS.has(p.filial_sigla)) return;
    const chaveRca = `${p.filial_sigla}_${p.rca_id}`;
    if (rcasComMPHoje.has(chaveRca)) return; // já vendeu MP hoje, não é zerado
    const val = repsMap[chaveRca];
    if (!val || !engine.isCanalVarejo(val.canal)) return; // só cobra de Varejo válido
    const gerente = resolverGerente(p.filial_sigla, p.supervisor_nome);
    const chaveFilial = `${p.filial_sigla}::${gerente}`;
    if (!zeradosPorFilial[chaveFilial]) zeradosPorFilial[chaveFilial] = {};
    const sup = (p.supervisor_nome || 'SUPERVISÃO GERAL').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim();
    if (!zeradosPorFilial[chaveFilial][sup]) zeradosPorFilial[chaveFilial][sup] = [];
    zeradosPorFilial[chaveFilial][sup].push(p.rca_nome.replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim());
  });

  const outDir = path.join(__dirname, '..', 'auditoria_mensagens', dataRef);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '10_00__VITORIO.txt'), msgGeral.trim(), 'utf8');

  // ===== MENSAGENS POR GERENTE (aberta por supervisor, com zerados de MP) =====
  let nGerentes = 0;
  const chavesTodas = new Set([...Object.keys(porFilial), ...Object.keys(zeradosPorFilial)]);
  chavesTodas.forEach(chaveFilial => {
    const f = porFilial[chaveFilial] || { sigla: chaveFilial.split('::')[0], gerente: chaveFilial.split('::')[1], fatMP: 0, positivados: new Set(), porSupervisor: {} };
    const zerados = zeradosPorFilial[chaveFilial] || {};
    const totalZerados = Object.values(zerados).reduce((a, l) => a + l.length, 0);

    let m = `🎯 *MARCAS PRÓPRIAS — 10:00*\n📍 ${f.sigla} — ${(f.gerente || '').toUpperCase()} • ${dataFmt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    m += `💰 R$ ${fmtMoeda(f.fatMP)} • ${f.positivados.size} PDVs positivados\n\n`;
    Object.entries(f.porSupervisor).forEach(([sup, v]) => {
      m += `👤 *${sup}* — R$ ${fmtMoeda(v.fat)} (${v.positivados.size} PDVs)\n`;
    });

    if (totalZerados > 0) {
      m += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚨 *ZERADOS EM MARCA PRÓPRIA HOJE (${totalZerados})*\n`;
      m += `_(fizeram pedido hoje, mas nenhum item era marca própria)_\n\n`;
      Object.entries(zerados).forEach(([sup, vendedores]) => {
        m += `👤 *${sup}*: ${vendedores.join(', ')}\n`;
      });
    }

    const nomeArquivo = `10_00__GERENTE_${f.sigla}_${f.gerente.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`;
    fs.writeFileSync(path.join(outDir, nomeArquivo), m.trim(), 'utf8');
    nGerentes++;
  });

  console.log(`Geral: R$ ${fmtMoeda(totalFat)} | ${totalPositivados.size} PDVs`);
  console.log(`${nGerentes} filiais com dado, salvos em ${outDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
