// =========================================================================
// FICHA DO ARQUIVO: pipeline/clube_mapa_telas.mjs   (GitHub Actions: .github/workflows/clube-mapa-telas.yml, so manual)
// O QUE E: MAPA das telas do Clube da Venda (TradePro) que ainda nao lemos — procurando a ROTA DO DIA COM OS NOMES dos clientes (plano do JOTA, bloco D:
//   hoje a lista nominal da rota sai do roteiro do mes gravado pelo CEVEN em 11/11). SO LEITURA: nao clica em nada que altere dado.
//   REPOSITORIO PUBLICO: o log tem so nomes de tela, colunas e contagens; nada de cliente, CNPJ ou valor.
// =========================================================================
import { chromium } from 'playwright';
const BASE = 'https://grupotriunfante.tradepro.com.br/grupotriunfante/';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const diaBR = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10).split('-').reverse().join('/');
if (!process.env.TP_USER || !process.env.TP_PASS) throw new Error('TP_USER / TP_PASS nao configurados');
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await page.goto(BASE + 'login.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForTimeout(5000);
await page.locator('[id="j_idt6:j_username"]').fill(process.env.TP_USER); await page.locator('[id="j_idt6:j_password"]').fill(process.env.TP_PASS); await page.locator('input[type=submit]').click({ noWaitAfter: true });
for (let t = 0; t < 60; t++) { await page.waitForTimeout(1000); if (/Relat[oó]rio de Vendas|Filiais/.test(await page.evaluate(() => document.body.innerText).catch(() => ''))) break; }
// todas as telas do menu (so o nome do arquivo .xhtml e o texto do item)
const links = await page.evaluate(() => [...document.querySelectorAll('a[href*=".xhtml"]')].map((a) => ({ h: (a.getAttribute('href') || '').split('?')[0].split('/').pop(), t: (a.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50) })).filter((x) => x.h));
const unicos = [...new Map(links.map((x) => [x.h, x])).values()];
log('telas do menu:', JSON.stringify(unicos.map((x) => `${x.h}=${x.t}`)));
// as que podem ter a rota/roteiro/agenda/visita: abre, tenta "Gerar" com a data de hoje, registra colunas e quantidade de linhas
// 17/11/2026, 2a rodada: so as telas de pedido/rota que o 1o mapa achou (PAGINAS=a.xhtml,b.xhtml); registra os botoes e tenta os de busca
const PAG = (process.env.PAGINAS || '').split(',').map((s) => s.trim()).filter(Boolean);
const alvoT = PAG.length ? unicos.filter((u) => PAG.includes(u.h)).concat(PAG.filter((h) => !unicos.some((u) => u.h === h)).map((h) => ({ h, t: '' }))) : unicos.filter((u) => /rot|rota|agenda|visita|roteiro|planej|cliente/i.test(u.h + ' ' + u.t)).slice(0, 12);
for (const x of alvoT) {
  try {
    await page.goto(BASE + x.h, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForTimeout(4000);
    for (const id of await page.evaluate(() => [...document.querySelectorAll('input')].filter((i) => /data.*_input$/i.test(i.id)).map((i) => i.id)).catch(() => [])) await page.locator(`[id="${id}"]`).fill(diaBR).catch(() => {});
    const botoes = await page.evaluate(() => [...document.querySelectorAll('button, input[type=submit], input[type=button], a.ui-button')].map((b) => (b.innerText || b.value || b.title || '').trim()).filter((s) => s && s.length < 30)).catch(() => []);
    log(`[${x.h}] botoes: ${JSON.stringify([...new Set(botoes)])}`);
    const gerar = page.locator('button, input[type=submit], input[type=button], a.ui-button').filter({ hasText: /Gerar|Pesquisar|Buscar|Filtrar|Consultar|Exibir|Listar|Atualizar/i }).first();
    const alt = page.locator('input[type=submit][value*="esquisar" i], input[type=submit][value*="erar" i], input[type=button][value*="esquisar" i]').first();
    const alvoB = (await gerar.count()) ? gerar : (await alt.count()) ? alt : null;
    if (alvoB) { await alvoB.click({ noWaitAfter: true, timeout: 10000 }).catch(() => {}); await page.waitForTimeout(25000); }
    const T = await page.evaluate(() => [...document.querySelectorAll('table')].map((t) => ({ cab: [...t.querySelectorAll('thead th')].map((c) => c.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean), n: t.querySelectorAll('tbody tr').length })).filter((t) => t.cab.length >= 3));
    const pag = await page.evaluate(() => { const p = document.querySelector('.ui-paginator-current'); return p ? p.innerText.replace(/\s+/g, ' ') : ''; }).catch(() => '');
    const filtros = await page.evaluate(() => [...document.querySelectorAll('label')].map((l) => l.innerText.trim()).filter((s) => s && s.length < 40).slice(0, 25)).catch(() => []);
    log(`[${x.h}] ${x.t} · filtros ${JSON.stringify(filtros)} · tabelas ${JSON.stringify(T.map((t) => ({ colunas: t.cab, linhas: t.n })))} · ${pag}`);
  } catch (e) { log(`[${x.h}] erro: ${String(e.message || e).slice(0, 120)}`); }
}
await browser.close();
