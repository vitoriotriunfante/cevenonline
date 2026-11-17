// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_detalhe_mapa.mjs   (GitHub Actions: .github/workflows/gerot-detalhe-mapa.yml, so manual)
// O QUE E: como o DETALHAMENTO das telas Devolucoes e Cortes do GEROT monta o caminho (chips Motivo / Pedido / Cliente / Vendedor...)
//   Vitorio, 17/11/2026: "como nao tem o motivo? vc so vai ter que cruzar as telas!!! e cortes tambem tem por motivo igual o CEVEN".
//   SO LEITURA. Log publico: so o cabecalho do caminho, os rotulos das colunas, os TIPOS de linha (badge) e contagens. Nada de cliente, nota ou valor.
// =========================================================================
import { chromium } from 'playwright';
const EMAIL = process.env.GEROT_EMAIL, SENHA = process.env.GEROT_SENHA;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const page = await (await browser.newContext({ viewport: { width: 1700, height: 1100 }, ignoreHTTPSErrors: true })).newPage();
for (let t = 1; t <= 3; t++) { try { await page.goto('https://gerot.triunfanteadmvendas.com.br:8009/login', { waitUntil: 'domcontentloaded', timeout: 120000 }); break; } catch (e) { if (t === 3) throw e; await page.waitForTimeout(20000); } }
await page.waitForTimeout(4000);
if (await page.$('#lgEmail')) { await page.fill('#lgEmail', EMAIL); await page.fill('#lgSenha', SENHA); await page.click('#lgBtn'); }
for (let t = 0; t < 150; t++) { await page.waitForTimeout(5000); if (/Extrair dados/.test(await page.evaluate(() => document.body.innerText).catch(() => '')) && /Visão Geral/i.test(await page.evaluate(() => document.body.innerText).catch(() => ''))) break; }
await page.evaluate(() => [...document.querySelectorAll('button,div,span')].filter((x) => /^(RESULTADO|COBERTURA|OPERAÇÃO|OPERACAO|CAMPO)$/i.test((x.innerText || '').trim())).forEach((x) => { try { x.click(); } catch (e) {} }));
await page.waitForTimeout(1500);
// estado do detalhamento: cabecalho do caminho, colunas, chips ativos, tipos de linha (badges) e quantas linhas
const estado = () => page.evaluate(() => {
  const sec = [...document.querySelectorAll('div,section')].filter((d) => /^\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0];
  if (!sec) return { erro: 'sem detalhamento' };
  const t = sec.querySelector('table'), th = [...t.querySelectorAll('thead th')].map((x) => x.innerText.trim().replace(/\s+/g, ' '));
  const chips = [...sec.querySelectorAll('button')].map((b) => ({ t: (b.innerText || '').trim().replace(/\s+/g, ' '), on: /ativ|active|sel|on\b/i.test(b.className) || getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(b).color === 'rgb(255, 255, 255)' })).filter((x) => x.t && x.t.length < 25);
  const linhas = [...t.querySelectorAll('tbody tr')];
  const badges = {}; for (const tr of linhas) { const b = [...tr.querySelectorAll('span,small')].map((s) => (s.innerText || '').trim()).find((s) => /^[A-ZÇÃÕ ]{4,}$/.test(s) && s.length < 20) || '(sem badge)'; badges[b] = (badges[b] || 0) + 1; }
  return { caminho: th[0], colunas: th.slice(1), chips, linhas: linhas.length, badges };
});
const clicaChip = (nome) => page.evaluate((n) => { const sec = [...document.querySelectorAll('div,section')].filter((d) => /^\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; const b = sec && [...sec.querySelectorAll('button')].find((x) => (x.innerText || '').trim().replace(/^\d+\s*/, '') === n); if (b) b.click(); return !!b; }, nome);
for (const tela of ['devolucoes', 'cortes']) {
  try {
    await page.evaluate((v) => { const a = document.querySelector(`[data-v="${v}"]`); if (a) { a.scrollIntoView(); a.click(); } }, tela);
    await page.waitForTimeout(15000);
    log(`[${tela}] inicial`, JSON.stringify(await estado()));
    const seq = tela === 'devolucoes' ? ['Motivo', 'Pedido', 'Cliente', 'Vendedor'] : ['Pedido', 'Cliente', 'Vendedor'];
    for (const ch of seq) { const ok = await clicaChip(ch); await page.waitForTimeout(6000); log(`[${tela}] clique ${ch} (${ok ? 'achou' : 'NAO achou'})`, JSON.stringify(await estado())); }
    const exp = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Expandir tudo/i.test(x.innerText || '')); if (b) b.click(); return !!b; });
    await page.waitForTimeout(8000);
    log(`[${tela}] expandir tudo (${exp ? 'achou' : 'nao tem'})`, JSON.stringify(await estado()));
  } catch (e) { log(`[${tela}] erro: ${String(e.message || e).slice(0, 150)}`); }
}
await browser.close();
