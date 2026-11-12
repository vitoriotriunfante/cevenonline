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
if (!pronto) { await page.screenshot({ path: path.join(out, '00_falha.png') }); log('nao carregou'); await browser.close(); process.exit(1); }
log('painel carregado');
// expande todos os grupos do menu e lista os itens
await page.evaluate(() => { for (const b of document.querySelectorAll('button, [role=button]')) { const t = (b.innerText || '').trim(); if (/^(RESULTADO|COBERTURA|OPERAÇÃO|CAMPO|DRE PERFORMANCE|VISÃO .*)$/i.test(t)) { if (/fechado|collapsed/.test(b.className) || b.getAttribute('aria-expanded') === 'false') b.click(); } } });
await page.waitForTimeout(1500);
const itens = await page.evaluate(() => [...document.querySelectorAll('[data-v]')].map((e) => ({ v: e.getAttribute('data-v'), t: (e.innerText || '').trim().replace(/\s+/g, ' ') })).filter((x) => x.v));
fs.writeFileSync(path.join(out, 'menu.json'), JSON.stringify(itens, null, 1));
log('itens no menu:', itens.length);
const res = [];
for (const [i, it] of itens.entries()) {
  try {
    await page.keyboard.press('Escape').catch(() => {});
    const ok = await page.evaluate((v) => { const a = document.querySelector(`[data-v="${v}"]`); if (a) { a.scrollIntoView(); a.click(); } return !!a; }, it.v);
    if (!ok) { log('nao achei', it.v); continue; }
    await page.waitForTimeout(6000);
    const tela = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const tabelas = [...main.querySelectorAll('table')].map((t) => ({ cab: [...t.querySelectorAll('thead th, tr:first-child th')].map((x) => x.innerText.trim().replace(/\s+/g, ' ')), linhas: [...t.querySelectorAll('tbody tr')].slice(0, 8).map((r) => [...r.children].map((c) => c.innerText.trim().replace(/\s+/g, ' '))), total: t.querySelectorAll('tbody tr').length }));
      const botoes = [...main.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter((x) => x && x.length < 40);
      return { texto: main.innerText.slice(0, 12000), tabelas, botoes: [...new Set(botoes)] };
    });
    await page.screenshot({ path: path.join(out, String(i + 1).padStart(2, '0') + '_' + it.v.replace(/[^a-z0-9_-]/gi, '_') + '.png'), fullPage: true }).catch(() => {});
    // dialogo Extrair dados desta aba (so le os campos; nao baixa)
    let extrair = null;
    try {
      const b = page.getByText('Extrair dados', { exact: true }).first();
      if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 5000 }); await page.waitForTimeout(2500); extrair = await page.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog], .modal, .dialog, div')].filter((x) => /Baixar Excel|Gerar prévia/.test(x.innerText || '')).sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0]; return d ? d.innerText.slice(0, 6000) : null; }); await page.keyboard.press('Escape').catch(() => {}); await page.locator('button:has-text("×")').first().click({ timeout: 2000 }).catch(() => {}); }
    } catch { /* sem dialogo */ }
    res.push({ ordem: i + 1, ...it, ...tela, extrair });
    fs.writeFileSync(path.join(out, 'telas.json'), JSON.stringify(res, null, 1));
    log('ok', i + 1, it.v, it.t, 'tabelas', tela.tabelas.length);
  } catch (e) { log('erro', it.v, String(e.message || e).slice(0, 120)); }
}
log('FIM', res.length);
await browser.close();
