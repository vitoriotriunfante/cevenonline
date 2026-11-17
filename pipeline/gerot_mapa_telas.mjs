// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_mapa_telas.mjs   (GitHub Actions: .github/workflows/gerot-mapa-telas.yml, so manual)
// O QUE É: MAPA das telas do GEROT que ainda nao extraimos (Vitorio, 16-17/11/2026: Carteira Total, Pedidos, Devolucoes, Cortes, Recorrencia).
//   SO LEITURA: entra em cada tela, clica em "Exportar planilha" e registra APENAS os nomes das colunas e a quantidade de linhas.
//   O repositorio e PUBLICO: nada de cliente, CNPJ ou valor no log; nada anexado; nada gravado no D1.
// =========================================================================
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import fs from 'fs'; import path from 'path'; import os from 'os';

const EMAIL = process.env.GEROT_EMAIL, SENHA = process.env.GEROT_SENHA;
const ALVO = /carteira|pedido|devolu|corte|recorr|troca/i;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto('https://gerot.triunfanteadmvendas.com.br:8009/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(4000);
if (await page.$('#lgEmail')) { if (!EMAIL || !SENHA) throw new Error('GEROT_EMAIL / GEROT_SENHA nao configurados'); await page.fill('#lgEmail', EMAIL); await page.fill('#lgSenha', SENHA); await page.click('#lgBtn'); }
let pronto = false;
for (let t = 0; t < 150 && !pronto; t++) {
  await page.waitForTimeout(5000);
  const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
  pronto = /Extrair dados/.test(txt) && /Visão Geral/i.test(txt);
}
if (!pronto) { log('painel nao montou'); await browser.close(); process.exit(1); }
log('painel montado');
// abre todos os grupos do menu lateral
await page.evaluate(() => [...document.querySelectorAll('button,div,span')].filter((x) => /^(RESULTADO|COBERTURA|OPERAÇÃO|OPERACAO|CAMPO)$/i.test((x.innerText || '').trim())).forEach((x) => { try { x.click(); } catch (e) {} }));
await page.waitForTimeout(1500);
const itens = await page.evaluate(() => [...document.querySelectorAll('[data-v]')].map((e) => ({ v: e.getAttribute('data-v'), t: (e.innerText || '').trim().replace(/\s+/g, ' ') })));
log('itens do menu:', JSON.stringify(itens.map((x) => `${x.v}=${x.t}`)));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gerot-mapa-'));
for (const it of itens.filter((x) => ALVO.test(x.v + ' ' + x.t))) {
  try {
    await page.evaluate((v) => { const a = document.querySelector(`[data-v="${v}"]`); if (a) { a.scrollIntoView(); a.click(); } }, it.v);
    await page.waitForTimeout(15000);
    const botoes = await page.evaluate(() => [...document.querySelectorAll('button,a')].map((b) => (b.innerText || '').trim()).filter((s) => /exportar|baixar|excel|planilha|extrair/i.test(s)));
    log(`[${it.v}] ${it.t} · botoes: ${JSON.stringify([...new Set(botoes)])}`);
    const b = page.getByText(/Exportar planilha/i).first();
    if (!(await b.count())) { log(`[${it.v}] sem "Exportar planilha"`); continue; }
    const dl = page.waitForEvent('download', { timeout: 180000 }).catch(() => null);
    await b.click({ timeout: 15000 }).catch(() => {});
    const d = await dl;
    if (!d) { log(`[${it.v}] exportar nao gerou arquivo em 3 min`); continue; }
    const arq = path.join(tmp, `${it.v}_${Date.now()}`); await d.saveAs(arq);
    const w = XLSX.readFile(arq); const sh = w.Sheets[w.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
    const hi = rows.findIndex((r) => r && r.filter((c) => c != null && c !== '').length >= 4);
    const cab = hi >= 0 ? rows[hi].map((c) => String(c || '').trim()) : [];
    log(`[${it.v}] EXPORT · ${rows.length - Math.max(hi, 0) - 1} linhas · ${cab.length} colunas · ${JSON.stringify(cab)}`);
    fs.rmSync(arq, { force: true });
  } catch (e) { log(`[${it.v}] erro: ${String(e && e.message || e).slice(0, 160)}`); }
}
fs.rmSync(tmp, { recursive: true, force: true });
await browser.close();
log('fim');
