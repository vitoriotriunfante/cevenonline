// =========================================================================
// FICHA DO ARQUIVO: pipeline/clube_motor_coleta.mjs
// O QUE É: Motor Unificado SOMENTE LEITURA do Clube da Venda (TradePro).
//   - TIER 1 (tempo real): relatorioVenda (Filiais + Supervisores + Vendedores + Fornecedores ao vivo),
//     relatorioPedido via .xls (29 colunas por filial), relatorioAcompanhamentoDiarioVenda via .csv (20 colunas),
//     relatorioCheckinCheckout (via .xls), relatorioJustificativaRoteiro (via .xls) e painelPedido (nao_sinc).
//   - Inclui Clube Accounting Gate obrigatorio + logs 100% sem PII (repositório público).
// USO:
//   TP_USER=... TP_PASS=... node pipeline/clube_motor_coleta.mjs [AAAAMMDD] [--tier=1] [--dry-run] [--api]
// =========================================================================
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import os from 'os';

const BASE = 'https://grupotriunfante.tradepro.com.br/grupotriunfante/';
const UNIDADES = { 2: 'TCA', 3: 'ABC', 4: 'TCV', 5: 'API', 6: 'TPA', 7: 'TCG', 9: 'TBL', 10: 'TPH', 11: 'MCD', 12: 'TSJ', 13: 'TBE' };
const FILIAIS = Object.values(UNIDADES);

const hojeSP = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
const diaArg = process.argv.find((a) => /^\d{8}$/.test(a));
const dia = diaArg || hojeSP();
const diaIso = `${dia.slice(0, 4)}-${dia.slice(4, 6)}-${dia.slice(6, 8)}`;
const diaBR = `${dia.slice(6, 8)}/${dia.slice(4, 6)}/${dia.slice(0, 4)}`;

const tierArg = (process.argv.find((a) => a.startsWith('--tier=')) || '--tier=1').split('=')[1];
const TIER = Number(tierArg) || 1;
const DRY_RUN = process.argv.includes('--dry-run');
const ENVIAR_API = process.argv.includes('--api') && !DRY_RUN;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const semAc = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const num = (s) => {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const t = String(s || '').replace(/[R$\s%]/g, '');
  if (!t) return null;
  const neg = /^-/.test(t);
  const abs = t.replace(/^-/, '');
  const norm = (abs.includes(',') && abs.includes('.')) ? abs.replace(/\./g, '').replace(',', '.')
    : abs.includes(',') ? abs.replace(',', '.')
    : abs;
  const v = Number(norm);
  return Number.isFinite(v) ? (neg ? -v : v) : null;
};
const dataIso = (s) => {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/);
  if (!m) return null;
  const ano = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}${m[4] ? ' ' + m[4] : ''}`;
};

async function garantirLogin(page) {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    await page.goto(BASE + 'login.xhtml', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(5000);
    if (!/login\.xhtml/i.test(page.url())) {
      const ok = await page.evaluate(() => /Relat[oó]rio de Vendas|Filiais/i.test((document.body && document.body.innerText) || '')).catch(() => false);
      if (ok) return true;
    }
    for (let t = 0; t < 3; t++) {
      try {
        await page.locator('input[id$=":j_username"], input[name$=":j_username"]').first().fill(process.env.TP_USER, { timeout: 15000 });
        await page.locator('input[id$=":j_password"], input[name$=":j_password"]').first().fill(process.env.TP_PASS, { timeout: 15000 });
        await page.locator('input[type=submit]').click({ noWaitAfter: true, timeout: 15000 });
        break;
      } catch { await page.waitForTimeout(3000); }
    }
    for (let t = 0; t < 100; t++) {
      await page.waitForTimeout(1000);
      const tx = await page.evaluate(() => (document.body && document.body.innerText) || '').catch(() => '');
      if (/Relat[oó]rio de Vendas|Filiais/.test(tx)) return true;
    }
    log(`garantirLogin tentativa ${tentativa} nao entrou (url=${page.url().slice(0, 60)}); retry...`);
  }
  throw new Error('login no Clube nao entrou');
}

async function extrairTabelasVenda(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
  if (/login\.xhtml/i.test(page.url())) {
    await garantirLogin(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
  }
  const fim = Date.now() + 35000;
  while (Date.now() < fim) {
    await page.waitForTimeout(800);
    const T = await page.evaluate(() => [...document.querySelectorAll('table')].map((t) => ({
      cab: [...t.querySelectorAll('thead th')].map((x) => x.innerText.trim().replace(/\s+/g, ' ')),
      linhas: [...t.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.innerText.trim().replace(/\s+/g, ' '))),
    }))).catch(() => []);
    const princ = T.find((x) => x.cab[0] === 'Código' || x.cab[0] === 'Unidade');
    const forn = T.find((x) => /^Fornecedor/i.test(x.cab[0] || ''));
    const nenhum = princ && princ.linhas.length === 1 && /Nenhum/i.test(princ.linhas[0].join(' '));
    if (princ && (princ.linhas.some((l) => /^\d+$/.test(l[0] || '')) || nenhum)) {
      return {
        principal: princ.linhas.filter((l) => /^\d+$/.test(l[0] || '')),
        fornecedores: forn ? forn.linhas.filter((l) => l.length >= 5 && l[0] && !/^TOTAL$/i.test(l[0])) : [],
      };
    }
  }
  return null;
}

const mapLinhaVenda = (l) => ({
  cod: l[0], nome: l[1], total_pedido: num(l[2]), total_faturado: num(l[3]), roteiros: num(l[4]),
  visitas_rota: num(l[5]), ped_rota: num(l[6]), ped_fora: num(l[7]), ped_total: num(l[8]),
  media_sku: num(l[9]), eficiencia: num(l[10]), eficacia: num(l[11]),
});

const mapFornecedor = (filial, l) => {
  const ehBrasil = filial === 'BRASIL';
  return {
    filial,
    fornecedor: String(l[0] || '').trim(),
    venda: num(l[1]),
    pct_venda: num(l[2]),
    positivacao: num(l[3]),
    pct_positivacao: num(l[4]),
    skus: ehBrasil ? null : num(l[5]),
    skus_total: ehBrasil ? null : num(l[6]),
    skus_vendidos: ehBrasil ? null : num(l[7]),
    filiais_lista: ehBrasil ? String(l[5] || '').trim() || null : null,
  };
};

async function selecionarFilialSelect(page, sig) {
  return page.evaluate((f) => {
    const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.text.trim() === 'TRIUNFANTE - ' + f));
    if (!s) return false;
    const opt = [...s.options].find((o) => o.text.trim() === 'TRIUNFANTE - ' + f);
    if (!opt) return false;
    if (s.value !== opt.value) {
      s.value = opt.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }, sig).catch(() => false);
}

async function preencherDatas(page) {
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('input')].filter((i) => /data.*_input$/i.test(i.id)).map((i) => i.id)
  ).catch(() => []);
  for (const id of ids) await page.locator(`[id="${id}"]`).fill(diaBR).catch(() => {});
}

function lerPlanilha(arq, anchorRegex) {
  const ext = path.extname(arq).toLowerCase();
  let rows;
  if (ext === '.csv') {
    const buf = fs.readFileSync(arq);
    const txtUtf = buf.toString('utf8');
    const txt = /Ã|/.test(txtUtf) ? buf.toString('latin1') : txtUtf;
    const wb = XLSX.read(txt, { type: 'string', raw: true });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: false });
  } else {
    const wb = XLSX.readFile(arq);
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: false });
  }
  const hi = rows.findIndex((r) => r && r.some((c) => anchorRegex.test(semAc(c))));
  if (hi < 0) return { cab: [], linhas: [] };
  return { cab: rows[hi].map(semAc), linhas: rows.slice(hi + 1) };
}

async function coletarPedidosFilial(page, sig, tmpDir) {
  await page.goto(BASE + 'relatorioPedido.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  if (/login\.xhtml/i.test(page.url())) {
    await garantirLogin(page);
    await page.goto(BASE + 'relatorioPedido.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
  }
  await preencherDatas(page);
  const okFil = await selecionarFilialSelect(page, sig);
  if (!okFil) throw new Error('sem select filial');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Gerar' }).first().click({ noWaitAfter: true, timeout: 15000 });

  let temDados = false, nenhum = false;
  for (let t = 0; t < 45; t++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => {
      const pag = document.querySelector('.ui-paginator-current')?.innerText || '';
      const txt = (document.body && document.body.innerText) || '';
      const hasTbl = [...document.querySelectorAll('table')].some((tb) =>
        tb.querySelectorAll('thead th').length >= 10 && tb.querySelectorAll('tbody tr').length > 0 && !/Nenhum/i.test(tb.innerText || '')
      );
      return { hasTbl, nenhum: /Nenhum registro|Nenhum pedido/i.test(txt), pag };
    }).catch(() => ({ hasTbl: false, nenhum: false }));
    if (st.nenhum) { nenhum = true; break; }
    if (st.hasTbl) { temDados = true; break; }
  }
  if (nenhum) return [];
  if (!temDados) throw new Error('timeout consulta');

  const btnExcel = page.locator('button, a, input[type=submit]').filter({ hasText: /^\s*(Excel|Exportar para Excel|Exportar Excel)\s*$/i }).first();
  if (!(await btnExcel.count())) throw new Error('sem botao Excel');
  const dlProm = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await btnExcel.click({ timeout: 15000 }).catch(() => {});
  const dl = await dlProm;
  if (!dl) throw new Error('download .xls falhou');

  const arq = path.join(tmpDir, `ped_${sig}.xls`);
  await dl.saveAs(arq);
  try {
    const { cab, linhas } = lerPlanilha(arq, /^(PEDIDO|ID DO REPRESENTANTE)$/);
    const ix = (n) => cab.indexOf(n);
    const I = {
      id: ix('ID DO REPRESENTANTE'), rep: ix('REPRESENTANTE'), ped: ix('PEDIDO'), pw: ix('PEDIDO WINTHOR'),
      cli: ix('CLIENTE'), raz: ix('RAZAO SOCIAL'), ativ: ix('ATIVIDADE COMERCIAL'), mov: ix('MOVIMENTO'),
      p1: ix('PRAZO 1'), p2: ix('PRAZO 2'), p3: ix('PRAZO 3'), p4: ix('PRAZO 4'), p5: ix('PRAZO 5'),
      op: ix('OPERACAO'), port: ix('PORTADOR'), desc: ix('TOTAL DESCONTO'), dm: ix('SALDO DM'),
      tot: ix('TOTAL'), bloq: ix('TIPO BLOQUEIO'), sinc: ix('SINCRONIZADO'), conf: ix('CONFIRMADO'),
      exc: ix('EXCLUIDO'), ori: ix('ORIGEM'), di: ix('DATA INICIAL'), de: ix('DATA EMISSAO'),
      dr: ix('DATA DE RECEBIMENTO'), dl: ix('DATA LIBERACAO'), tel: ix('TELEFONE'), cint: ix('CODIGO INTEGRACAO'),
    };
    const out = [];
    for (const r of linhas) {
      const pedRaw = String(r[I.ped] ?? '').replace(/\D/g, '');
      const idRaw = String(r[I.id] ?? '').replace(/\D/g, '');
      if (!pedRaw && !idRaw) continue;
      const repStr = String(r[I.rep] || '').trim();
      const mRep = repStr.match(/^\s*(\d+)\s*-\s*(.*)$/);
      out.push({
        filial: sig,
        id: idRaw || null,
        rca_xls: idRaw || (mRep ? mRep[1] : ''),
        nome: (mRep ? mRep[2] : repStr).trim(),
        pedido: pedRaw || null,
        pedido_winthor: String(r[I.pw] ?? '').replace(/\D/g, '') || null,
        cliente: String(r[I.cli] ?? '').replace(/\D/g, '') || null,
        razao: r[I.raz] ? String(r[I.raz]).trim() : null,
        atividade_comercial: I.ativ >= 0 && r[I.ativ] ? String(r[I.ativ]).trim() : null,
        movimento: I.mov >= 0 && r[I.mov] ? String(r[I.mov]).trim() : null,
        prazo_1: I.p1 >= 0 && r[I.p1] != null ? String(r[I.p1]).trim() : null,
        prazo_2: I.p2 >= 0 && r[I.p2] != null ? String(r[I.p2]).trim() : null,
        prazo_3: I.p3 >= 0 && r[I.p3] != null ? String(r[I.p3]).trim() : null,
        prazo_4: I.p4 >= 0 && r[I.p4] != null ? String(r[I.p4]).trim() : null,
        prazo_5: I.p5 >= 0 && r[I.p5] != null ? String(r[I.p5]).trim() : null,
        operacao: I.op >= 0 && r[I.op] ? String(r[I.op]).trim() : null,
        portador: I.port >= 0 && r[I.port] ? String(r[I.port]).trim() : null,
        total_desconto: I.desc >= 0 ? num(r[I.desc]) : null,
        saldo_dm: I.dm >= 0 ? num(r[I.dm]) : null,
        total: num(r[I.tot]) || 0,
        tipo_bloqueio: I.bloq >= 0 && r[I.bloq] ? String(r[I.bloq]).trim() : null,
        sincronizado: I.sinc >= 0 && r[I.sinc] ? String(r[I.sinc]).trim() : null,
        confirmado: I.conf >= 0 && r[I.conf] ? String(r[I.conf]).trim() : null,
        excluido: I.exc >= 0 && r[I.exc] ? String(r[I.exc]).trim() : null,
        origem: I.ori >= 0 && r[I.ori] ? String(r[I.ori]).trim() : null,
        data_inicial: I.di >= 0 ? dataIso(r[I.di]) : null,
        data_emissao: I.de >= 0 ? dataIso(r[I.de]) : null,
        data_recebimento: I.dr >= 0 ? dataIso(r[I.dr]) : null,
        data_liberacao: I.dl >= 0 ? dataIso(r[I.dl]) : null,
        telefone: I.tel >= 0 && r[I.tel] ? String(r[I.tel]).trim() : null,
        codigo_integracao: I.cint >= 0 && r[I.cint] ? String(r[I.cint]).trim() : null,
      });
    }
    return out;
  } finally {
    fs.rmSync(arq, { force: true });
  }
}

async function coletarAcompFilial(page, sig, tmpDir) {
  await page.goto(BASE + 'relatorioAcompanhamentoDiarioVenda.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  if (/login\.xhtml/i.test(page.url())) {
    await garantirLogin(page);
    await page.goto(BASE + 'relatorioAcompanhamentoDiarioVenda.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
  }
  await preencherDatas(page);
  const okFil = await selecionarFilialSelect(page, sig);
  if (!okFil) throw new Error('sem select filial');
  await page.waitForTimeout(1200);

  const btnCsv = page.locator('button, a, input[type=submit]').filter({ hasText: /^\s*Exportar para CSV\s*$/i }).first();
  if (!(await btnCsv.count())) throw new Error('sem botao CSV');
  const dlProm = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await btnCsv.click({ timeout: 15000 }).catch(() => {});
  const dl = await dlProm;
  if (!dl) throw new Error('download .csv falhou');

  const arq = path.join(tmpDir, `acomp_${sig}.csv`);
  await dl.saveAs(arq);
  try {
    const { cab, linhas } = lerPlanilha(arq, /^CODIGO VENDEDOR$/);
    const ix = (n) => cab.indexOf(n);
    const I = {
      sc: ix('CODIGO COORDENADOR'), sn: ix('COORDENADOR'), rca: ix('CODIGO VENDEDOR'), nome: ix('VENDEDOR'),
      cart: ix('CARTEIRA'), obj: ix('OBJECTIVO VISITAS') >= 0 ? ix('OBJECTIVO VISITAS') : ix('OBJETIVO VISITAS'),
      vis: ix('VISITAS'), pv: ix('PEDIDOS VENDA'), pr: ix('PEDIDOS NA ROTA'), pf: ix('PEDIDOS FORA DE ROTA'),
      tot: ix('TOTAL'), nv: ix('NAO VISITA'), nvd: ix('NAO VENDA'), p1: ix('PRIMEIRO PEDIDO'),
      pu: ix('ULTIMO PEDIDO'), val: ix('VALOR'), ef1: ix('EFICIECIA') >= 0 ? ix('EFICIECIA') : ix('EFICIENCIA'), ef2: ix('EFICACIA'),
    };
    const out = [];
    for (const r of linhas) {
      const rca = String(r[I.rca] ?? '').replace(/\D/g, '');
      if (!rca) continue;
      out.push({
        filial: sig,
        rca,
        sup_cod: I.sc >= 0 ? String(r[I.sc] ?? '').replace(/\D/g, '') || null : null,
        sup_nome: I.sn >= 0 && r[I.sn] ? String(r[I.sn]).trim() : null,
        nome: I.nome >= 0 && r[I.nome] ? String(r[I.nome]).trim() : null,
        carteira: I.cart >= 0 ? num(r[I.cart]) : null,
        objetivo_visitas: I.obj >= 0 ? num(r[I.obj]) : null,
        visitas: I.vis >= 0 ? num(r[I.vis]) : null,
        pedidos_venda: I.pv >= 0 ? num(r[I.pv]) : null,
        pedidos_rota: I.pr >= 0 ? num(r[I.pr]) : null,
        pedidos_fora: I.pf >= 0 ? num(r[I.pf]) : null,
        total_pedidos: I.tot >= 0 ? num(r[I.tot]) : null,
        nao_visita: I.nv >= 0 ? num(r[I.nv]) : null,
        nao_venda: I.nvd >= 0 ? num(r[I.nvd]) : null,
        primeiro_pedido: I.p1 >= 0 && r[I.p1] ? String(r[I.p1]).trim() : null,
        ultimo_pedido: I.pu >= 0 && r[I.pu] ? String(r[I.pu]).trim() : null,
        valor: I.val >= 0 ? num(r[I.val]) : null,
        eficiencia: I.ef1 >= 0 ? num(r[I.ef1]) : null,
        eficacia: I.ef2 >= 0 ? num(r[I.ef2]) : null,
      });
    }
    return out;
  } finally {
    fs.rmSync(arq, { force: true });
  }
}

async function coletarExcelRelatorio(pg, nomePg, tmpDir, anchorRegex) {
  await pg.goto(BASE + nomePg + '.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(3000);
  await preencherDatas(pg);
  await pg.getByRole('button', { name: 'Gerar' }).first().click({ noWaitAfter: true, timeout: 15000 });

  let status = 'wait';
  for (let t = 0; t < 180; t++) {
    await pg.waitForTimeout(1000);
    const st = await pg.evaluate(() => {
      const txt = (document.body && document.body.innerText) || '';
      const hasTbl = [...document.querySelectorAll('table')].some((x) => x.querySelectorAll('thead th').length > 3 && !/^D$/.test((x.querySelector('thead th') || {}).innerText || '') && x.querySelectorAll('tbody tr').length > 0 && !/Nenhum/i.test(x.innerText || ''));
      const pag = document.querySelector('.ui-paginator-current')?.innerText || '';
      return { hasTbl, nenhum: /Nenhum registro|Nenhum dado/i.test(txt), pag };
    }).catch(() => ({ hasTbl: false, nenhum: false, pag: '' }));
    if (st.nenhum) { status = 'vazio'; break; }
    if (st.hasTbl) { status = st.pag; break; }
  }
  if (status === 'vazio') return { rows: [], cab: [], total: 0 };
  if (status === 'wait') return null;

  const totalPag = Number((status.match(/\((\d+)\s*regi/) || [])[1]) || 0;
  const btnExcel = pg.locator('button, a, input[type=submit]').filter({ hasText: /^\s*(Excel|Exportar para Excel|Exportar Excel)\s*$/i }).first();
  if (await btnExcel.count()) {
    const dlProm = pg.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await btnExcel.click({ timeout: 15000 }).catch(() => {});
    const dl = await dlProm;
    if (dl) {
      const arq = path.join(tmpDir, `${nomePg}.xls`);
      await dl.saveAs(arq);
      try {
        const p = lerPlanilha(arq, anchorRegex);
        if (p.cab.length) return { cab: p.cab, rows: p.linhas, total: p.linhas.length };
      } finally {
        fs.rmSync(arq, { force: true });
      }
    }
  }
  return { cab: [], rows: [], total: totalPag, aviso: 'sem_excel' };
}

async function contarPainelPedido(pg) {
  await pg.goto(BASE + 'painelPedido.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(3000);
  await preencherDatas(pg);
  await pg.getByRole('button', { name: 'Gerar' }).first().click({ noWaitAfter: true, timeout: 15000 });
  for (let t = 0; t < 120; t++) {
    await pg.waitForTimeout(1000);
    const st = await pg.evaluate(() => {
      const pag = document.querySelector('.ui-paginator-current')?.innerText || '';
      const txt = (document.body && document.body.innerText) || '';
      const hasTbl = [...document.querySelectorAll('table')].some((x) => x.querySelectorAll('thead th').length > 3 && x.querySelectorAll('tbody tr').length > 0 && !/Nenhum/i.test(x.innerText || ''));
      return { hasTbl, nenhum: /Nenhum/i.test(txt), pag };
    }).catch(() => ({ hasTbl: false, nenhum: false, pag: '' }));
    if (st.nenhum) return 0;
    if (st.hasTbl) return Number((st.pag.match(/\((\d+)\s*regi/) || [])[1]) || 1;
  }
  return null;
}

if (!process.env.TP_USER || !process.env.TP_PASS) throw new Error('TP_USER / TP_PASS nao configurados');
if (TIER !== 1) throw new Error(`Tier ${TIER} sera implementado nas Ondas 2/3. Use --tier=1.`);

const t0 = Date.now();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clube-motor-'));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const pags = await Promise.all([0, 1, 2, 3].map(() => ctx.newPage()));

try {
  await garantirLogin(pags[0]);
  log(`Motor Clube TIER ${TIER} | Dia ${diaIso} | dry_run=${DRY_RUN}`);

  // 1) relatorioVenda: Raiz + 11 Filiais (Fornecedores ao vivo) + Supervisores + Vendedores
  const raiz = await extrairTabelasVenda(pags[0], `${BASE}relatorioVenda.xhtml?di=${dia}&df=${dia}&fo=-1`);
  const filiaisRaiz = new Map();
  const fornecedoresDia = [];
  if (raiz) {
    for (const l of raiz.principal) {
      const m = String(l[1] || '').match(/TRIUNFANTE\s*-\s*([A-Z]{3})\b/i);
      if (m) filiaisRaiz.set(m[1].toUpperCase(), num(l[3]) || 0); // col 3 = Total Pedido
    }
    for (const f of raiz.fornecedores) fornecedoresDia.push(mapFornecedor('BRASIL', f));
    log('Raiz filiais:', filiaisRaiz.size, '| Fornecedores Brasil:', raiz.fornecedores.length);
  }

  const tarefas = [], falhas = [];
  for (const [fi, sig] of Object.entries(UNIDADES)) {
    let rFil = await extrairTabelasVenda(pags[0], `${BASE}relatorioVenda.xhtml?di=${dia}&df=${dia}&fo=-1&fi=${fi}&n=PAUTA`);
    if (!rFil) rFil = await extrairTabelasVenda(pags[0], `${BASE}relatorioVenda.xhtml?di=${dia}&df=${dia}&fo=-1&fi=${fi}&n=PAUTA`);
    if (!rFil) { falhas.push(`${sig}:pauta`); log(sig, 'PAUTA FALHOU'); continue; }
    for (const s of rFil.principal) tarefas.push({ sig, fi, sup: s[0], supNome: s[1] });
    for (const f of rFil.fornecedores) fornecedoresDia.push(mapFornecedor(sig, f));
    log(sig, rFil.principal.length + ' sups |', rFil.fornecedores.length + ' fornecedores');
  }

  const vendedores = [];
  let k = 0;
  await Promise.all(pags.map(async (pg) => {
    while (k < tarefas.length) {
      const x = tarefas[k++];
      let rV = await extrairTabelasVenda(pg, `${BASE}relatorioVenda.xhtml?di=${dia}&df=${dia}&fo=-1&fi=${x.fi}&n=REPRESENTANTE&co=${x.sup}`);
      if (!rV) rV = await extrairTabelasVenda(pg, `${BASE}relatorioVenda.xhtml?di=${dia}&df=${dia}&fo=-1&fi=${x.fi}&n=REPRESENTANTE&co=${x.sup}`);
      if (!rV) { falhas.push(`${x.sig}:sup_${x.sup}`); continue; }
      for (const l of rV.principal) vendedores.push({ filial: x.sig, sup_cod: x.sup, sup_nome: x.supNome, ...mapLinhaVenda(l), rca: l[0] });
    }
  }));

  // 2) Pedidos (.xls por filial, 29 colunas) + Acompanhamento Diario (.csv por filial, 20 colunas) em 2 abas
  const pedidosRaw = [], acompMap = new Map();
  let kf = 0;
  await Promise.all([pags[0], pags[1]].map(async (pg) => {
    while (kf < FILIAIS.length) {
      const sig = FILIAIS[kf++];
      try {
        const ps = await coletarPedidosFilial(pg, sig, tmpDir);
        pedidosRaw.push(...ps);
        log(sig, 'pedidos .xls:', ps.length);
      } catch (e) {
        falhas.push(`${sig}:pedidos_xls(${String(e.message || e).slice(0, 40)})`);
        log(sig, 'pedidos .xls FALHOU:', String(e.message || e).slice(0, 80));
      }
      try {
        const acs = await coletarAcompFilial(pg, sig, tmpDir);
        for (const a of acs) acompMap.set(`${a.filial}|${a.rca}`, a);
        log(sig, 'acomp .csv:', acs.length);
      } catch (e) {
        falhas.push(`${sig}:acomp_csv(${String(e.message || e).slice(0, 40)})`);
        log(sig, 'acomp .csv FALHOU:', String(e.message || e).slice(0, 80));
      }
    }
  }));

  // Resolver RCA definitivo para pedidos
  const vendFilRca = new Set(vendedores.map((v) => `${v.filial}|${v.rca}`));
  const pedidos = pedidosRaw.map((p) => {
    const pwCand = p.pedido_winthor && p.pedido_winthor.length >= 7 ? p.pedido_winthor.slice(0, -6) : '';
    const pedCand = p.pedido && p.pedido.length >= 7 ? p.pedido.slice(0, -6) : '';
    let rca = p.rca_xls || '';
    if (!vendFilRca.has(`${p.filial}|${rca}`)) {
      if (pwCand && vendFilRca.has(`${p.filial}|${pwCand}`)) rca = pwCand;
      else if (pedCand && vendFilRca.has(`${p.filial}|${pedCand}`)) rca = pedCand;
    }
    return { ...p, rca: rca || p.rca_xls || '' };
  });

  // 3) Checkin/Checkout (.xls), Justificativas (.xls) e Painel de Pedidos (nao_sinc)
  const [ckRes, juRes, naoSinc] = await Promise.all([
    coletarExcelRelatorio(pags[1], 'relatorioCheckinCheckout', tmpDir, /^CODIGO$/),
    coletarExcelRelatorio(pags[2], 'relatorioJustificativaRoteiro', tmpDir, /^(ID|REPRESENTANTE)$/),
    contarPainelPedido(pags[3]),
  ]);

  const porCodVend = new Map();
  for (const v of vendedores) { if (!porCodVend.has(v.rca)) porCodVend.set(v.rca, []); porCodVend.get(v.rca).push(v); }
  const filialDe = (cod, nome) => {
    const L = porCodVend.get(String(cod)) || [];
    if (L.length === 1) return L[0].filial;
    const m = L.find((v) => semAc(v.nome) === semAc(nome));
    return m ? m.filial : null;
  };

  const checkins = [];
  if (ckRes && ckRes.cab.length) {
    const ix = (n) => ckRes.cab.indexOf(n);
    const I = { cod: ix('CODIGO'), tipo: ix('TIPO'), dh: ix('DATA E HORA'), rep: ix('REPRESENTANTE'), cli: ix('CODIGO CLIENTE'), cnpj: ix('CNPJ'), raz: ix('RAZAO SOCIAL'), fan: ix('FANTASIA') };
    for (const r of ckRes.rows) {
      if (!r[I.cod]) continue;
      const repStr = String(r[I.rep] || ''), m = repStr.match(/^\s*(\d+)\s*-\s*(.*)$/);
      const rca = m ? m[1] : '';
      const nomeR = (m ? m[2] : repStr).trim();
      checkins.push({ codigo: String(r[I.cod]).trim(), tipo: String(r[I.tipo] || '').trim(), data_hora: dataIso(r[I.dh]), rca, nome: nomeR, filial: filialDe(rca, nomeR), cliente: String(r[I.cli] || '').replace(/\D/g, ''), cnpj: String(r[I.cnpj] || '').trim(), razao: String(r[I.raz] || '').trim(), fantasia: String(r[I.fan] || '').trim() });
    }
  }
  const justificativas = [];
  if (juRes && juRes.cab.length) {
    const ix = (n) => juRes.cab.indexOf(n);
    const I = { id: ix('ID'), co: ix('COORDENADOR'), rep: ix('REPRESENTANTE'), cli: ix('CODIGO CLIENTE'), cnpj: ix('CPF/CNPJ'), raz: ix('RAZAO SOCIAL'), fan: ix('FANTASIA'), dias: ix('DIAS SEM COMPRAR'), mot: ix('MOTIVO NAO VISITA'), dh: ix('DATA'), obs: ix('OBSERVACAO') };
    for (const r of juRes.rows) {
      if (!r[I.id]) continue;
      const [rc, ...rn] = String(r[I.rep] || '').split(' - '), [sc] = String(r[I.co] || '').split(' - ');
      const rca = rc.trim(), nomeR = rn.join(' - ').trim();
      justificativas.push({ id: String(r[I.id]).trim(), sup_cod: sc.trim(), rca, nome: nomeR, filial: filialDe(rca, nomeR), cliente: String(r[I.cli] || '').replace(/\D/g, ''), cnpj: String(r[I.cnpj] || '').trim(), razao: String(r[I.raz] || '').trim(), fantasia: String(r[I.fan] || '').trim(), dias_sem_comprar: num(r[I.dias]), motivo: String(r[I.mot] || '').trim(), data_hora: dataIso(r[I.dh]), obs: r[I.obs] ? String(r[I.obs]).trim() : null });
    }
  }

  // 4) Clube Accounting Gate (zero PII)
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const somaVendedores = round2(vendedores.reduce((s, v) => s + (v.total_pedido || 0), 0));
  const somaFiliaisRaiz = round2([...filiaisRaiz.values()].reduce((s, v) => s + (v || 0), 0));
  const somaFornBrasil = round2(fornecedoresDia.filter((f) => f.filial === 'BRASIL').reduce((s, f) => s + (f.venda || 0), 0));
  const pedValidos = pedidos.filter((p) => !/BONIF/i.test(p.operacao || '') && !/^SIM$/i.test(p.excluido || ''));
  const somaPedidosXls = round2(pedValidos.reduce((s, p) => s + (p.total || 0), 0));
  const acompLista = [...acompMap.values()];
  const somaAcomp = round2(acompLista.reduce((s, a) => s + (a.valor || 0), 0));

  const gate = {
    dia: diaIso,
    tier: TIER,
    duracao_s: Math.round((Date.now() - t0) / 1000),
    vendedores: vendedores.length,
    fornecedores_dia: fornecedoresDia.length,
    acompanhamento_dia: acompLista.length,
    pedidos_xls: pedidos.length,
    pedidos_venda_validos: pedValidos.length,
    pct_pedidos_com_rca: pedidos.length ? round2((pedidos.filter((p) => p.rca).length / pedidos.length) * 100) : 100,
    checkins: checkins.length,
    justificativas: justificativas.length,
    nao_sinc: naoSinc,
    soma_vendedores: somaVendedores,
    soma_filiais_raiz: somaFiliaisRaiz,
    soma_fornecedores_brasil: somaFornBrasil,
    soma_pedidos_xls_venda: somaPedidosXls,
    soma_acompanhamento_csv: somaAcomp,
    falhas,
    aprovado: falhas.length === 0 && vendedores.length >= 300,
  };
  console.log('CLUBE_GATE ' + JSON.stringify(gate));

  if (ENVIAR_API) {
    if (!process.env.EVO_KEY) throw new Error('EVO_KEY nao configurada');
    const site = process.env.CEVEN_SITE_URL || 'https://ceven-cftv-matrix.pages.dev';
    const lidoEm = new Date().toISOString();
    const postClube = (payload) => fetch(`${site}/api/clube-carga`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Evo-Key': process.env.EVO_KEY },
      body: JSON.stringify({ dia: diaIso, lido_em: lidoEm, ...payload }),
      signal: AbortSignal.timeout(60000),
    }).then((x) => x.json());

    await postClube({
      vendedores,
      fornecedores_dia: fornecedoresDia.slice(0, 300),
      acompanhamento_dia: acompLista.slice(0, 300),
      rodada: { vendedores: vendedores.length, checkins: checkins.length, justificativas: justificativas.length, nao_sinc: naoSinc, falhas: falhas.join(', '), duracao_s: gate.duracao_s, gate_json: gate },
    });
    for (let i = 300; i < fornecedoresDia.length; i += 400) await postClube({ fornecedores_dia: fornecedoresDia.slice(i, i + 400) });
    for (let i = 300; i < acompLista.length; i += 400) await postClube({ acompanhamento_dia: acompLista.slice(i, i + 400) });
    for (let i = 0; i < pedidos.length; i += 300) await postClube({ pedidos: pedidos.slice(i, i + 300), sem_sync_status: i + 300 < pedidos.length });
    for (let i = 0; i < checkins.length; i += 600) await postClube({ checkins: checkins.slice(i, i + 600) });
    for (let i = 0; i < justificativas.length; i += 600) await postClube({ justificativas: justificativas.slice(i, i + 600) });
    log('API /api/clube-carga concluida');
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  await browser.close();
}
