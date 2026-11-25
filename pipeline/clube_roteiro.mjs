// =========================================================================
// FICHA DO ARQUIVO: pipeline/clube_roteiro.mjs   (passo do .github/workflows/clube-coletor.yml)
// O QUE E: a ROTA DO DIA COM OS NOMES, das 11 filiais, pelo Clube da Venda ("Roteiro Consolidado Geral": Filial + data + botao Excel).
//   Plano do JOTA, bloco D (18/11/2026): a rota nominal deixa de depender do CEVEN. Grava em clube_roteiro (D1) via /api/clube-carga.
//   So rele se a ultima leitura do dia tem mais de 3 h (o Excel e o mesmo o dia todo; custo D1 = linhas gravadas e so o que mudou e gravado).
// REPOSITORIO PUBLICO: o log tem so contagens. Nada de cliente, CNPJ ou endereco.
// =========================================================================
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import fs from 'fs'; import os from 'os'; import path from 'path';
const BASE = 'https://grupotriunfante.tradepro.com.br/grupotriunfante/';
const SITE = process.env.CEVEN_SITE_URL || 'https://ceven-cftv-matrix.pages.dev';
const FILIAIS = ['TCA', 'ABC', 'TCV', 'API', 'TPA', 'TCG', 'TBL', 'TPH', 'MCD', 'TSJ', 'TBE'];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const diaIso = (process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))) || new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const diaBR = diaIso.split('-').reverse().join('/');
const semAc = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

// precisa ler? (ultima leitura do dia ha mais de 3 h, ou nunca)
if (!process.argv.includes('--forca')) {
  try {
    const st = await fetch(`${SITE}/api/clube-carga?roteiro_dia=${diaIso}`, { headers: { 'X-Evo-Key': process.env.EVO_KEY || '' }, signal: AbortSignal.timeout(30000) }).then((r) => r.json());
    const idade = st && st.lido_em ? (Date.now() - Date.parse(st.lido_em)) / 3600e3 : 99;
    if (st && st.filiais >= FILIAIS.length && idade < 3) { log(`rota de ${diaIso} lida ha ${idade.toFixed(1)} h (${st.filiais} filiais, ${st.linhas} linhas): nao precisa reler`); process.exit(0); }
  } catch (e) { log('status da rota indisponivel; lendo assim mesmo'); }
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(BASE + 'login.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForTimeout(5000);
for (let t = 0; t < 3; t++) { try { await page.locator('[id="j_idt6:j_username"]').fill(process.env.TP_USER, { timeout: 10000 }); await page.locator('[id="j_idt6:j_password"]').fill(process.env.TP_PASS, { timeout: 10000 }); await page.locator('input[type=submit]').click({ noWaitAfter: true, timeout: 10000 }); break; } catch { await page.waitForTimeout(3000); } }
let logado = false; for (let t = 0; t < 60; t++) { await page.waitForTimeout(1000); if (/Relat[oó]rio de Vendas|Filiais/.test(await page.evaluate(() => document.body.innerText).catch(() => ''))) { logado = true; break; } }
if (!logado) { log('FALHA: login no Clube nao entrou'); await browser.close(); process.exit(1); }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rot-'));
const linhas = [], lidas = [], falhas = [];
for (const fil of FILIAIS) {
  try {
    await page.goto(BASE + 'relatorioRoteiroConsolidadoGeral.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForTimeout(3500);
    const ok = await page.evaluate((f) => {
      const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.text.trim() === 'TRIUNFANTE - ' + f)); if (!s) return false;
      s.value = [...s.options].find((o) => o.text.trim() === 'TRIUNFANTE - ' + f).value; s.dispatchEvent(new Event('change', { bubbles: true })); return true;
    }, fil);
    if (!ok) { falhas.push(fil + ':sem opcao'); continue; }
    await page.waitForTimeout(1500);
    for (const id of await page.evaluate(() => [...document.querySelectorAll('input')].filter((i) => /data.*_input$/i.test(i.id)).map((i) => i.id))) await page.locator(`[id="${id}"]`).fill(diaBR).catch(() => {});
    const dl = page.waitForEvent('download', { timeout: 120000 }).catch(() => null);
    await page.locator('button, a, input[type=submit]').filter({ hasText: /^\s*Excel\s*$/ }).first().click({ timeout: 10000 }).catch(async () => { await page.getByText('Excel', { exact: true }).first().click().catch(() => {}); });
    const d = await dl; if (!d) { falhas.push(fil + ':sem excel'); continue; }
    const arq = path.join(dir, fil + '.xlsx'); await d.saveAs(arq);
    const w = XLSX.readFile(arq), rows = XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]], { header: 1, defval: null, raw: false });
    const hi = rows.findIndex((r) => r && r.some((c) => semAc(c) === 'CODIGO CLIENTE')); if (hi < 0) { falhas.push(fil + ':sem cabecalho'); continue; }
    const cab = rows[hi].map(semAc), ix = (n) => cab.indexOf(n);
    const I = { rca: ix('CODIGO'), nome: ix('NOME'), cli: ix('CODIGO CLIENTE'), cnpj: ix('CNPJ'), razao: ix('RAZAO SOCIAL'), fant: ix('FANTASIA'), cid: ix('CIDADE'), bai: ix('BAIRRO'), end: ix('ENDERECO'), rec: ix('RECORRENCIA'), data: ix('DATA DA VISITA'), dsem: ix('DIA DA SEMANA') };
    const v = (r, k) => (I[k] >= 0 && r[I[k]] != null ? String(r[I[k]]).trim() : '');
    let n = 0, outroDia = 0;
    for (const r of rows.slice(hi + 1)) {
      if (!r || !v(r, 'rca') || !v(r, 'cli')) continue;
      const dv = v(r, 'data'); const m = dv.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      const dIso = m ? `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : diaIso;
      if (dIso !== diaIso) { outroDia++; continue; }
      linhas.push({ filial: fil, rca: v(r, 'rca').replace(/\.0$/, ''), nome: v(r, 'nome'), cliente: v(r, 'cli').replace(/\.0$/, ''), cnpj: v(r, 'cnpj'), razao: v(r, 'razao'), fantasia: v(r, 'fant'), cidade: v(r, 'cid'), bairro: v(r, 'bai'), endereco: v(r, 'end'), recorrencia: v(r, 'rec'), dia_semana: v(r, 'dsem') });
      n++;
    }
    lidas.push(fil);
    log(`${fil}: ${n} visitas na rota · ${new Set(linhas.filter((x) => x.filial === fil).map((x) => x.rca)).size} vendedores${outroDia ? ' · ' + outroDia + ' de outro dia (fora)' : ''}`);
  } catch (e) { falhas.push(fil + ':' + String(e && e.message || e).slice(0, 60)); }
}
await browser.close();
log(`rota de ${diaIso}: ${linhas.length} visitas · ${lidas.length} filiais${falhas.length ? ' · falhas ' + falhas.join(', ') : ''}`);
if (process.argv.includes('--api') && process.env.EVO_KEY && lidas.length) {
  for (const fil of lidas) {
    const rotFil = linhas.filter((x) => x.filial === fil);
    const r = await fetch(`${SITE}/api/clube-carga`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Evo-Key': process.env.EVO_KEY }, body: JSON.stringify({ dia: diaIso, roteiro: rotFil, roteiro_filiais: [fil] }), signal: AbortSignal.timeout(120000) }).then((x) => x.json()).catch((e) => ({ erro: String(e) }));
    log('API /api/clube-carga', fil, JSON.stringify(r).slice(0, 260));
  }
}
process.exit(lidas.length ? 0 : 1);
