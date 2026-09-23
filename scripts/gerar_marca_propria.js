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

function main() {
  const dataRef = process.argv[2] || new Date().toISOString().split('T')[0];
  const codigosMP = carregarMarcaPropria();
  const placeholders = codigosMP.map(() => '?').join(',');

  // Hierarquia oficial (mesma fonte usada no resto do pipeline) para resolver o gerente
  // real por supervisor, incluindo o split de sub-gerência de MCD/TPH.
  const repsMap = engine.carregarValidacaoVendedores();
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
           phi.codprod, phi.descricao, phi.quantidade, phi.valor_total
    FROM pedidos_historico ph
    JOIN pedidos_historico_itens phi ON phi.chave_pedido = ph.chave
    WHERE ph.data_pedido = ?
      AND phi.tipo_registro = 'VENDA'
      AND phi.codprod IN (${placeholders})
  `).all(dataRef, ...codigosMP);

  // FILIAIS FORA DO ENVIO (não vendem marca própria)
  const FILIAIS_EXCLUIDAS = new Set(['TBE', 'TCG']);

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

  const outDir = path.join(__dirname, '..', 'auditoria_mensagens', dataRef);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '10_00__VITORIO.txt'), msgGeral.trim(), 'utf8');

  // ===== MENSAGENS POR GERENTE (aberta por supervisor) =====
  let nGerentes = 0;
  Object.values(porFilial).forEach(f => {
    let m = `🎯 *MARCAS PRÓPRIAS — 10:00*\n📍 ${f.sigla} — ${(f.gerente || '').toUpperCase()} • ${dataFmt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    m += `💰 R$ ${fmtMoeda(f.fatMP)} • ${f.positivados.size} PDVs positivados\n\n`;
    Object.entries(f.porSupervisor).forEach(([sup, v]) => {
      m += `👤 *${sup}* — R$ ${fmtMoeda(v.fat)} (${v.positivados.size} PDVs)\n`;
    });
    const nomeArquivo = `10_00__GERENTE_${f.sigla}_${f.gerente.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`;
    fs.writeFileSync(path.join(outDir, nomeArquivo), m.trim(), 'utf8');
    nGerentes++;
  });

  console.log(`Geral: R$ ${fmtMoeda(totalFat)} | ${totalPositivados.size} PDVs`);
  console.log(`${nGerentes} filiais com dado, salvos em ${outDir}`);
}

main();
