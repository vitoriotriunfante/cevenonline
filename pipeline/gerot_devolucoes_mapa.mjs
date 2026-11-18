// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_devolucoes_mapa.mjs   (gerot-devolucoes.yml com modo=mapa; manual)
// O QUE E: mapa de como os niveis (chips) da tela Devolucoes do GEROT se combinam, para abrir MOTIVO -> PEDIDO (e chegar no vendedor pelo pedido).
// REPOSITORIO PUBLICO: o log tem so o cabecalho, a ordem dos niveis e contagens. Nada de cliente, nota ou valor.
// =========================================================================
import { chromium } from 'playwright';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const page = await (await browser.newContext({ viewport: { width: 1700, height: 1100 }, ignoreHTTPSErrors: true })).newPage();
for (let t = 1; t <= 3; t++) { try { await page.goto('https://gerot.triunfanteadmvendas.com.br:8009/login', { waitUntil: 'domcontentloaded', timeout: 120000 }); break; } catch (e) { if (t === 3) throw e; await page.waitForTimeout(20000); } }
await page.waitForTimeout(4000);
if (await page.$('#lgEmail')) { await page.fill('#lgEmail', process.env.GEROT_EMAIL); await page.fill('#lgSenha', process.env.GEROT_SENHA); await page.click('#lgBtn'); }
for (let t = 0; t < 150; t++) { await page.waitForTimeout(5000); const tx = await page.evaluate(() => document.body.innerText).catch(() => ''); if (/Extrair dados/.test(tx) && /Visão Geral/i.test(tx)) break; }
await page.evaluate(() => [...document.querySelectorAll('button,div,span')].filter((x) => /^(RESULTADO)$/i.test((x.innerText || '').trim())).forEach((x) => { try { x.click(); } catch (e) {} }));
await page.waitForTimeout(1500);
await page.evaluate(() => { const a = document.querySelector('[data-v="devolucoes"]'); if (a) { a.scrollIntoView(); a.click(); } });
await page.waitForTimeout(15000);
const estado = () => page.evaluate(() => {
  const sec = [...document.querySelectorAll('div,section')].filter((d) => /^\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (!sec) return null;
  const chips = [...sec.querySelectorAll('button')].map((b) => ({ t: (b.innerText || '').trim(), on: /ativo|active|on|sel/i.test(b.className) || b.getAttribute('aria-pressed') === 'true' })).filter((x) => x.t && !/^[▸▾×]$/.test(x.t));
  const t = sec.querySelector('table'), th = [...t.querySelectorAll('thead th')].map((x) => x.innerText.trim().replace(/\s+/g, ' '));
  const trs = [...t.querySelectorAll('tbody tr')];
  // padrao da 1a celula (so a forma: letras viram A, numeros viram 9) das 3 primeiras linhas
  const forma = trs.slice(0, 3).map((tr) => String((tr.querySelector('td') || {}).innerText || '').trim().replace(/[A-Za-zÀ-ú]+/g, 'A').replace(/\d+/g, '9').slice(0, 40));
  return { chips: chips.map((c) => (c.on ? '*' : '') + c.t).join(' '), th, linhas: trs.length, forma };
});
const clica = (nome) => page.evaluate((n) => { const sec = [...document.querySelectorAll('div,section')].filter((d) => /^\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; const b = sec && [...sec.querySelectorAll('button')].find((x) => (x.innerText || '').trim().replace(/^\d+\s*/, '') === n); if (b) { b.click(); return true; } return false; }, nome);
log('inicial', JSON.stringify(await estado()));
for (const passo of ['Motivo', 'Filial', 'Pedido', 'Vendedor', 'Pedido', 'Motivo']) {
  const ok = await clica(passo); await page.waitForTimeout(6000);
  log(`clique ${passo} (${ok ? 'achou' : 'nao achou'})`, JSON.stringify(await estado()));
}
// botoes/menus extras da secao (ordem dos niveis, limpar, exportar)
log('outros botoes', JSON.stringify(await page.evaluate(() => { const sec = [...document.querySelectorAll('div,section')].filter((d) => /^\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; return sec ? [...sec.querySelectorAll('button,select,input,a')].map((x) => (x.innerText || x.value || x.title || x.getAttribute('aria-label') || '').trim().slice(0, 30)).filter((x) => x && !/^[▸▾]$/.test(x)) : []; })));
await browser.close();
