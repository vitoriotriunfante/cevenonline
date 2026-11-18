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
// 2a rodada (18/11/2026): nivel PEDIDO — rotulos fixos da linha (palavras que aparecem em >60% das linhas; o resto vira A/9), fim da lista e o que abre ao expandir
await clica('Pedido'); await page.waitForTimeout(8000);
const P = await page.evaluate(() => {
  const sec = [...document.querySelectorAll('div,section')].filter((d) => /^s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (!sec) return null;
  const trs = [...sec.querySelectorAll('table tbody tr')], txt = trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()));
  const freq = {}; for (const L of txt) for (const w of new Set(String(L[0] || '').split(/[s·|:]+/).filter(Boolean))) freq[w] = (freq[w] || 0) + 1;
  const fixo = new Set(Object.entries(freq).filter(([w, n]) => n > trs.length * 0.6 && !/d/.test(w)).map(([w]) => w));
  const molde = (t) => String(t || '').split(/(s+|·|||:)/).map((w) => (fixo.has(w) || /^(s+|·|||:)$/.test(w) || w === '') ? w : /^d+([./]d+)*$/.test(w) ? '9' : /d/.test(w) ? '9x' : 'A').join('').replace(/A( A)+/g, 'A…').slice(0, 160);
  const ult = trs[trs.length - 1];
  const fora = [...sec.querySelectorAll('button,a,span')].map((b) => (b.innerText || '').trim()).filter((t) => /mais|carregar|pr[oó]xim|todos|ver /i.test(t)).slice(0, 5);
  return { linhas: trs.length, fixos: [...fixo].slice(0, 30), moldes: txt.slice(0, 4).map((L) => molde(L[0])), colunas_2_3: txt.slice(0, 3).map((L) => [L[1], L[2]].map((x) => String(x || '').replace(/d/g, '9'))), ultima: molde(ult && ult.innerText), botoes_mais: fora };
});
log('pedido', JSON.stringify(P));
// expande a 1a linha
await page.evaluate(() => { const sec = [...document.querySelectorAll('div,section')].filter((d) => /^s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; const tr = sec && sec.querySelector('table tbody tr'); const b = tr && ([...tr.querySelectorAll('button,span,i,td')].find((x) => /^[▸▶►]$/.test((x.innerText || '').trim())) || tr.querySelector('button')); if (b) b.click(); });
await page.waitForTimeout(5000);
log('pedido expandido', JSON.stringify(await page.evaluate(() => { const sec = [...document.querySelectorAll('div,section')].filter((d) => /^s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; const trs = [...sec.querySelectorAll('table tbody tr')]; return { linhas: trs.length, filhos: trs.slice(1, 4).map((tr) => String(tr.innerText || '').replace(/[A-Za-zÀ-ú]{4,}/g, (w) => (/^(FILIAL|MOTIVO|VENDEDOR|CLIENTE|PRODUTO|PEDIDO|NOTA|DEVOLUw*|SUPERVISOR|GERENTE|FORNECEDOR)$/i.test(w) ? w : 'A')).replace(/d/g, '9').slice(0, 160)) }; })));
await browser.close();
