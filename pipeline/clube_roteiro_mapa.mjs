// =========================================================================
// FICHA DO ARQUIVO: pipeline/clube_roteiro_mapa.mjs   (GitHub Actions: .github/workflows/clube-roteiro-mapa.yml, so manual)
// O QUE E: a ROTA DO DIA COM OS NOMES pelo Clube ("Roteiro Consolidado Geral": Filial + periodo + botao Excel). Plano do JOTA, bloco D.
//   Mapa: tenta UMA filial, baixa o Excel e registra SO as colunas e a quantidade de linhas (repositorio publico: nada de cliente).
// =========================================================================
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import fs from 'fs'; import os from 'os'; import path from 'path';
const BASE = 'https://grupotriunfante.tradepro.com.br/grupotriunfante/';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const diaBR = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10).split('-').reverse().join('/');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(BASE + 'login.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForTimeout(5000);
await page.locator('[id="j_idt6:j_username"]').fill(process.env.TP_USER); await page.locator('[id="j_idt6:j_password"]').fill(process.env.TP_PASS); await page.locator('input[type=submit]').click({ noWaitAfter: true });
for (let t = 0; t < 60; t++) { await page.waitForTimeout(1000); if (/Relat[oó]rio de Vendas|Filiais/.test(await page.evaluate(() => document.body.innerText).catch(() => ''))) break; }
await page.goto(BASE + 'relatorioRoteiroConsolidadoGeral.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForTimeout(5000);
// opcoes do combo Filial (so os rotulos; o 1o vira o alvo)
const ops = await page.evaluate(() => [...document.querySelectorAll('select option, li.ui-selectonemenu-item')].map((o) => (o.innerText || o.textContent || '').trim()).filter(Boolean));
log('opcoes de filial:', JSON.stringify(ops.slice(0, 20)));
const alvo = ops.find((o) => /TCV|CASCAVEL|^4\b|4 -/i.test(o)) || ops.find((o) => !/Selecione/i.test(o));
// escolhe pelo combo PrimeFaces (label + item) ou pelo select escondido
const ok = await page.evaluate((lab) => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.text.trim() === lab)); if (s) { s.value = [...s.options].find((o) => o.text.trim() === lab).value; s.dispatchEvent(new Event('change', { bubbles: true })); return 'select'; } return null; }, alvo);
if (!ok) { await page.locator('.ui-selectonemenu').first().click().catch(() => {}); await page.waitForTimeout(800); await page.locator('li.ui-selectonemenu-item', { hasText: alvo }).first().click().catch(() => {}); }
await page.waitForTimeout(2000);
for (const id of await page.evaluate(() => [...document.querySelectorAll('input')].filter((i) => /data.*_input$/i.test(i.id)).map((i) => i.id))) await page.locator(`[id="${id}"]`).fill(diaBR).catch(() => {});
log('filial escolhida:', alvo ? alvo.replace(/[^A-Za-z0-9 -]/g, '').slice(0, 30) : 'nenhuma', '· modo', ok || 'menu');
const dl = page.waitForEvent('download', { timeout: 180000 }).catch(() => null);
await page.locator('button, a, input[type=submit]').filter({ hasText: /^\s*Excel\s*$/ }).first().click({ timeout: 10000 }).catch(async () => { await page.getByText('Excel', { exact: true }).first().click().catch(() => {}); });
const d = await dl;
if (!d) { log('Excel nao gerou arquivo em 3 min'); const msg = await page.evaluate(() => [...document.querySelectorAll('.ui-messages, .ui-growl, .ui-message')].map((x) => x.innerText.trim()).join(' | ')).catch(() => ''); log('mensagens da tela:', msg.slice(0, 200)); }
else {
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rot-')), 'rot.xlsx'); await d.saveAs(arq);
  const w = XLSX.readFile(arq), sh = w.Sheets[w.SheetNames[0]], rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  const hi = rows.findIndex((r) => r && r.filter((c) => c != null && c !== '').length >= 4);
  log(`EXCEL · abas ${JSON.stringify(w.SheetNames)} · ${rows.length - Math.max(hi, 0) - 1} linhas · colunas ${JSON.stringify(hi >= 0 ? rows[hi].map((c) => String(c || '').trim()) : [])}`);
}
await browser.close();
