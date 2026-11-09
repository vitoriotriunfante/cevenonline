// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_coletor_online.mjs   (roda no GitHub Actions: .github/workflows/gerot-coleta.yml)
// O QUE É: coleta ONLINE do GEROT (Vitorio, semana de 02/11/2026: "industria vem do GEROT"; 09/11/2026: tirar do PC).
//   1) entra no painel com GEROT_EMAIL / GEROT_SENHA (segredos do GitHub), espera o painel montar (~430 MB)
//   2) "Extrair dados": periodo = mes pedido; CAMPOS = Mes, Filial, Supervisor, Vendedor, Fornecedor; CALCULOS = faturamento,
//      devolucao, positivacao, meta e carteira; "Baixar Excel"
//   3) le o Excel e envia ao D1 por /api/gerot-carga (so as linhas que mudaram)
// Uso: node pipeline/gerot_coletor_online.mjs [--meses=2026-11,2026-10] [--ensaio]   (sem --meses: mes atual; dias 1-5 tambem o anterior)
// Nunca inventa: coluna que o GEROT nao trouxe fica fora; a lista de colunas vai para o status da carga.
// Ver docs/GEROT_ESTADO_E_PLANO.md.
// =========================================================================
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const URL_GEROT = 'https://gerot.triunfanteadmvendas.com.br:8009';
const API = (process.env.SITE_CFTV || 'https://ceven-cftv-matrix.pages.dev') + '/api/gerot-carga';
const KEY = process.env.EVO_KEY, EMAIL = process.env.GEROT_EMAIL, SENHA = process.env.GEROT_SENHA;
const ENSAIO = process.argv.includes('--ensaio');
const SAIDA = process.env.GEROT_SAIDA || 'gerot_saida';
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CAMPOS = ['Mês', 'Filial', 'Supervisor', 'Vendedor', 'Fornecedor'];
// calculos (colunas) que interessam ao JOTA; o rotulo exato vem do GEROT e e conferido no log
const CALC = [/^Faturado líquido/i, /^Faturado bruto/i, /^Devolução \(R\$\)/i, /^Positivação \(filial/i, /^Positivação \+ Carteira/i, /^Meta de positivação/i, /^% Meta positivação/i,
  /^Realizado meta/i, /^Meta \(R\$\)/i, /^% Meta$/i, /^% Meta \(Pos \+ Cart\)/i, /Carteira/i, /^Captação/i, /^Meta clientes/i];

function mesesAlvo() {
  const a = process.argv.find((x) => x.startsWith('--meses='));
  if (a) return a.slice(8).split(',').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}$/.test(s));
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (d.getDate() > 5) return [cur];
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return [cur, `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`];
}
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
async function api(metodo, sufixo, corpo) {
  for (let t = 1; t <= 3; t++) {
    try {
      const r = await fetch(API + sufixo, { method: metodo, headers: { 'X-Evo-Key': KEY, 'Content-Type': 'application/json', 'User-Agent': 'ceven-gerot' }, body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(60000) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      if (r.status < 500) throw new Error(`HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    } catch (e) { if (t === 3) throw e; }
    await new Promise((ok) => setTimeout(ok, 3000 * t));
  }
}

async function entra(page) {
  await page.goto(URL_GEROT + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await page.$('#lgEmail')) {
    if (!EMAIL || !SENHA) throw new Error('GEROT_EMAIL / GEROT_SENHA nao configurados');
    await page.fill('#lgEmail', EMAIL); await page.fill('#lgSenha', SENHA); await page.click('#lgBtn');
    log('login enviado');
  }
  for (let t = 0; t < 120; t++) {   // ate 10 min: o painel baixa ~430 MB
    await page.waitForTimeout(5000);
    const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (/Extrair dados/.test(txt) && /Visão Geral/i.test(txt)) { log('painel montado'); return txt; }
    const p = txt.match(/Baixando o painel:\s*([\d.,]+\s*MB de [\d.,]+\s*MB)/i);
    if (t % 6 === 0) log(p ? 'baixando ' + p[1] : 'aguardando painel...', page.url());
    if (/lgEmail|senha incorreta|inválid/i.test(txt) && t > 6) throw new Error('login recusado pelo GEROT');
  }
  throw new Error('painel do GEROT nao montou em 10 min');
}

// marca/desmarca checkboxes do dialogo "Extrair dados" pelo rotulo
async function ajustaDialogo(page, mes) {
  const [ano, mm] = mes.split('-'), nomeMes = MESES_PT[Number(mm) - 1];
  return page.evaluate(({ ano, nomeMes, CAMPOS, CALC }) => {
    const calc = CALC.map((s) => new RegExp(s.src, s.flags));
    const dlg = [...document.querySelectorAll('div,section')].filter((d) => /Extrair dados/.test(d.innerText || '') && /Baixar Excel/.test(d.innerText || '') && /CAMPOS/.test(d.innerText || '')).sort((a, b) => a.innerText.length - b.innerText.length)[0];
    if (!dlg) return { erro: 'dialogo nao encontrado' };
    const caixas = [...dlg.querySelectorAll('input[type=checkbox]')].map((i) => ({ i, rot: ((i.closest('label') || i.parentElement || {}).innerText || '').replace(/\s*•\s*$/, '').trim() }));
    const blocos = [...dlg.querySelectorAll('*')].filter((e) => e.children.length < 3 && /^(PERÍODO|CAMPOS|CÁLCULOS)/i.test((e.innerText || '').trim()));
    const bloco = (nome) => { const b = blocos.find((e) => new RegExp('^' + nome, 'i').test(e.innerText.trim())); let p = b; while (p && p !== dlg && p.querySelectorAll('input[type=checkbox]').length < 3) p = p.parentElement; return p; };
    const bPer = bloco('PERÍODO'), bCam = bloco('CAMPOS'), bCal = bloco('CÁLCULOS');
    const anos = [...(bPer ? bPer.querySelectorAll('*') : [])].filter((e) => /^20\d\d$/.test((e.innerText || '').trim()) && e.children.length === 0);
    const anoDe = (inp) => { let a = null; for (const e of anos) if (e.compareDocumentPosition(inp) & Node.DOCUMENT_POSITION_FOLLOWING) a = e.innerText.trim(); return a; };
    const quer = (x) => {
      if (bPer && bPer.contains(x.i)) return anoDe(x.i) === ano && x.rot === nomeMes;
      if (bCam && bCam.contains(x.i)) return CAMPOS.includes(x.rot) || /filtros do topo/i.test(x.rot);
      if (bCal && bCal.contains(x.i)) return calc.some((r) => r.test(x.rot));
      return x.i.checked;
    };
    for (const x of caixas) { const q = quer(x); if (x.i.checked !== q) x.i.click(); }
    const marc = caixas.filter((x) => x.i.checked).map((x) => x.rot);
    return { marcados: marc, calculosDisponiveis: caixas.filter((x) => bCal && bCal.contains(x.i)).map((x) => x.rot), temMes: marc.includes(nomeMes) };
  }, { ano, nomeMes, CAMPOS, CALC: CALC.map((r) => ({ src: r.source, flags: r.flags })) });
}

const num = (v) => { if (v == null || v === '') return null; if (typeof v === 'number') return v; const s = String(v).replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.'); const n = Number(s); return isFinite(n) ? n : String(v); };
const filialDe = (v) => (String(v || '').toUpperCase().match(/\b[A-Z]{3}\b/) || [''])[0];

function linhasDoExcel(arq, mes) {
  const w = XLSX.readFile(arq), sh = w.Sheets[w.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  const hi = rows.findIndex((r) => r && r.includes('Filial') && r.some((c) => /Vendedor/i.test(String(c || ''))));
  if (hi < 0) throw new Error('Excel sem cabecalho Filial/Vendedor: ' + JSON.stringify(rows[0]));
  const H = rows[hi].map((c) => String(c || '').trim());
  const ix = (re) => H.findIndex((h) => re.test(h));
  const iMes = ix(/^Mês$/), iFil = ix(/^Filial$/), iCs = ix(/^Cód\.? supervisor/i), iSup = ix(/^Supervisor$/i), iCv = ix(/^Cód\.? vendedor/i), iVen = ix(/^Vendedor$/i), iCf = ix(/^Cód\.? fornecedor/i), iFor = ix(/^Fornecedor$/i);
  if (iFor < 0) throw new Error('Excel sem a coluna Fornecedor: ' + H.join(' | '));
  const chaves = new Set([iMes, iFil, iCs, iSup, iCv, iVen, iCf, iFor]);
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    if (!r || !r.some((c) => c != null && c !== '')) continue;
    const m = iMes >= 0 && r[iMes] ? String(r[iMes]).slice(0, 7) : mes;
    const filial = filialDe(r[iFil]); const rca = String(iCv >= 0 ? r[iCv] ?? '' : '').trim() || String(r[iVen] || '').trim();
    const forn = String(r[iFor] || '').trim();
    if (!filial || !rca || !forn || /^total/i.test(forn)) continue;
    const dados = {}; H.forEach((h, k) => { if (!chaves.has(k) && h) dados[h] = num(r[k]); });
    if (iCf >= 0) dados['Cód. fornecedor'] = r[iCf];
    const linha = { mes: m, filial, rca, fornecedor: forn, cod_sup: iCs >= 0 ? r[iCs] : null, supervisor: iSup >= 0 ? r[iSup] : null, vendedor: iVen >= 0 ? r[iVen] : null, dados };
    linha.hash = crypto.createHash('md5').update(JSON.stringify([linha.cod_sup, linha.supervisor, linha.vendedor, dados])).digest('hex');
    out.push(linha);
  }
  return { linhas: out, colunas: H };
}

async function main() {
  if (!KEY && !ENSAIO) throw new Error('EVO_KEY nao configurado');
  fs.mkdirSync(SAIDA, { recursive: true });
  const meses = mesesAlvo(); log('meses:', meses.join(', '));
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let falhou = false;
  try {
    const txt = await entra(page);
    const posicao = (txt.match(/Atual\s*·\s*\d{2}\/\d{2}\/\d{4}/) || txt.match(/Última atualização:[^\n]+/) || [''])[0];
    log('posicao do GEROT:', posicao);
    for (const mes of meses) {
      try {
        await page.getByText('Extrair dados', { exact: true }).first().click();
        await page.waitForTimeout(2500);
        const aj = await ajustaDialogo(page, mes);
        log('dialogo:', JSON.stringify(aj));
        if (aj.erro || !aj.temMes) throw new Error('nao consegui marcar o periodo ' + mes + ': ' + (aj.erro || ''));
        const dl = page.waitForEvent('download', { timeout: 600000 });
        await page.getByText('Baixar Excel', { exact: true }).first().click();
        const d = await dl; const arq = path.join(SAIDA, `gerot_${mes}.xlsx`); await d.saveAs(arq);
        log('excel baixado:', arq, fs.statSync(arq).size, 'bytes');
        const { linhas, colunas } = linhasDoExcel(arq, mes);
        log(`${mes}: ${linhas.length} linhas · colunas: ${colunas.join(' | ')}`);
        if (!linhas.length) throw new Error('Excel sem linhas para ' + mes);
        let enviadas = 0;
        if (!ENSAIO) {
          const { hashes } = await api('GET', '?mes=' + mes);
          const mudou = linhas.filter((l) => hashes[`${l.filial}|${l.rca}|${l.fornecedor}`] !== l.hash);
          for (let i = 0; i < mudou.length; i += 200) { await api('POST', '', { linhas: mudou.slice(i, i + 200) }); enviadas += Math.min(200, mudou.length - i); }
          await api('POST', '', { status: { mes, linhas: linhas.length, enviadas, posicao, colunas } });
        }
        log(`${mes}: ${enviadas} linhas novas/alteradas gravadas no D1${ENSAIO ? ' (ensaio: nada gravado)' : ''}`);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(1500);
      } catch (e) { falhou = true; log('FALHA', mes, e.message); await page.screenshot({ path: path.join(SAIDA, `erro_${mes}.png`), fullPage: true }).catch(() => {}); }
    }
  } catch (e) { falhou = true; log('FALHA', e.message); await page.screenshot({ path: path.join(SAIDA, 'erro_login.png'), fullPage: true }).catch(() => {}); }
  await browser.close();
  if (falhou) process.exit(1);
}
export { linhasDoExcel };
if (/gerot_coletor_online.mjs$/.test(process.argv[1] || '')) main().catch((e) => { console.error(e); process.exit(1); });
