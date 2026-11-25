// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_inventario.mjs
// O QUE É: explorador SOMENTE LEITURA do GEROT (Vitorio, 12/11/2026: "analise profunda em todo o GEROT, item por item, indicador por indicador").
//   Entra em cada item do menu e grava o texto da tela (indicadores e tabelas), a foto e os campos do "Extrair dados" de cada aba. Nao grava no D1,
//   nao baixa planilha, nao envia nada. Roda no GitHub Actions (.github/workflows/gerot-inventario.yml, so manual) com os segredos GEROT_EMAIL / GEROT_SENHA.
// USO: node pipeline/gerot_inventario.mjs [pasta_saida]
// =========================================================================
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const out = process.argv[2] || 'gerot_inventario';
const EMAIL = process.env.GEROT_EMAIL, SENHA = process.env.GEROT_SENHA;
fs.mkdirSync(out, { recursive: true });
const log = (...a) => { const s = new Date().toISOString().slice(11, 19) + ' ' + a.join(' '); console.log(s); fs.appendFileSync(path.join(out, 'log.txt'), s + '\n'); };
const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
const apiDesc = new Map();
const esquema = (v, prof = 0) => {
  if (prof > 2 || v == null) return typeof v;
  if (Array.isArray(v)) return v.length ? [esquema(v[0], prof + 1)] : ['vazio'];
  if (typeof v === 'object') return Object.fromEntries(Object.keys(v).slice(0, 35).map((k) => [k, esquema(v[k], prof + 1)]));
  return typeof v;
};
page.on('response', async (res) => {
  try {
    const req = res.request(), ct = String(res.headers()['content-type'] || ''), u = new URL(res.url());
    if (!/json|javascript|api/i.test(ct) && !/\/api\//i.test(u.pathname)) return;
    if (/\.(js|css|png|jpg|svg|woff2?)$/i.test(u.pathname)) return;
    const k = req.method() + ' ' + u.pathname;
    if (!apiDesc.has(k)) {
      let chaves = null;
      if (/json/i.test(ct)) { try { chaves = esquema(await res.json()); } catch {} }
      apiDesc.set(k, { metodo: req.method(), caminho: u.pathname, params: [...u.searchParams.keys()], status: res.status(), chaves });
    }
  } catch {}
});
await page.goto('https://gerot.triunfanteadmvendas.com.br:8009/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(4000);
if (await page.$('#lgEmail')) { if (!EMAIL || !SENHA) throw new Error('GEROT_EMAIL / GEROT_SENHA nao configurados'); await page.fill('#lgEmail', EMAIL); await page.fill('#lgSenha', SENHA); await page.click('#lgBtn'); log('login enviado'); }
let pronto = false;
for (let t = 0; t < 150; t++) {
  await page.waitForTimeout(5000);
  const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
  if (await page.$('#lgEmail') && await page.locator('#lgEmail').isVisible().catch(() => false) && t > 6) { log('PEDIU LOGIN de novo: login salvo nao entrou'); break; }
  if (/Visão Geral|FATURADO × META|Extrair dados/.test(txt) && /R\$/.test(txt)) { pronto = true; break; }
  if (t % 6 === 0) log('carregando...', t * 5, 's');
}
if (!pronto) { log('nao carregou'); await browser.close(); process.exit(1); }
log('painel carregado');
// expande todos os grupos do menu e lista os itens (somente metadados, nada de dados/valores)
await page.evaluate(() => { for (const b of document.querySelectorAll('button, [role=button]')) { const t = (b.innerText || '').trim(); if (/^(RESULTADO|COBERTURA|OPERAÇÃO|ESTOQUE FEFO|CAMPO|DRE PERFORMANCE|VISÃO .*)$/i.test(t)) { if (/fechado|collapsed/.test(b.className) || b.getAttribute('aria-expanded') === 'false') b.click(); } } });
await page.waitForTimeout(1500);
const itens = await page.evaluate(() => [...document.querySelectorAll('[data-v]')].map((e) => ({ v: e.getAttribute('data-v'), t: (e.innerText || '').trim().replace(/\s+/g, ' ') })).filter((x) => x.v));
fs.writeFileSync(path.join(out, 'menu.json'), JSON.stringify(itens, null, 1));
log('itens no menu:', itens.length);
const resumo = [];
for (const [i, it] of itens.entries()) {
  try {
    await page.keyboard.press('Escape').catch(() => {});
    const ok = await page.evaluate((v) => { const a = document.querySelector(`[data-v="${v}"]`); if (a) { a.scrollIntoView(); a.click(); } return !!a; }, it.v);
    if (!ok) { log('nao achei', it.v); continue; }
    await page.waitForTimeout(5000);
    const meta = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const tabelas = [...main.querySelectorAll('table')].map((t) => ({ cab: [...t.querySelectorAll('thead th, tr:first-child th')].map((x) => x.innerText.trim().replace(/\s+/g, ' ')), linhas_total: t.querySelectorAll('tbody tr').length }));
      const botoes = [...main.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter((x) => x && x.length < 40);
      return { tabelas, botoes: [...new Set(botoes)] };
    });
    let extrairRotulos = null;
    try {
      const b = page.getByText('Extrair dados', { exact: true }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        extrairRotulos = await page.evaluate(() => {
          const d = [...document.querySelectorAll('[role=dialog], .modal, .dialog, div')].filter((x) => /Baixar Excel|Gerar prévia/.test(x.innerText || '')).sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
          return d ? [...d.querySelectorAll('label')].map((l) => (l.innerText || '').trim()).filter(Boolean) : null;
        });
        await page.keyboard.press('Escape').catch(() => {});
        await page.locator('button:has-text("×")').first().click({ timeout: 2000 }).catch(() => {});
      }
    } catch {}
    resumo.push({ ordem: i + 1, ...it, ...meta, extrair_rotulos: extrairRotulos });
    fs.writeFileSync(path.join(out, 'resumo_menus.json'), JSON.stringify(resumo, null, 1));
    fs.writeFileSync(path.join(out, 'endpoints_descobertos.json'), JSON.stringify([...apiDesc.values()], null, 1));
    log('ok', i + 1, it.v, it.t, 'tabelas', meta.tabelas.length, 'endpoints', apiDesc.size);
  } catch (e) { log('erro', it.v, String(e.message || e).slice(0, 120)); }
}
fs.writeFileSync(path.join(out, 'endpoints_descobertos.json'), JSON.stringify([...apiDesc.values()], null, 1));
log('FIM', resumo.length, 'endpoints:', apiDesc.size);
await browser.close();
