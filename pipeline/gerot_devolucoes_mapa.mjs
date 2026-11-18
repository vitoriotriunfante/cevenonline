// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_devolucoes_mapa.mjs   (gerot-devolucoes.yml com modo=mapa; manual)
// O QUE E: mapa de como os niveis (chips) da tela Devolucoes do GEROT se combinam, para chegar no VENDEDOR de cada devolucao por motivo.
//   1a rodada (18/11/2026): os chips sao UM nivel por vez. 2a: o nivel Pedido traz pedido, data do faturamento, valor e data da devolucao
//   (sem motivo), mostra 200 de 1.000+ linhas e abre em produtos. 3a (esta): o que abre embaixo de Motivo > Filial e embaixo de Vendedor.
// REPOSITORIO PUBLICO: o log tem so cabecalhos, rotulos fixos e contagens. Nada de cliente, nota ou valor.
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
const SEC = `[...document.querySelectorAll('div,section')].filter((d) => /^\\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]`;
const clica = (nome) => page.evaluate(([n, S]) => { const sec = eval(S); const b = sec && [...sec.querySelectorAll('button')].find((x) => (x.innerText || '').trim().replace(/^\d+\s*/, '') === n); if (b) { b.click(); return true; } return false; }, [nome, SEC]);
// expande a linha i (0 = primeira) e devolve a forma das linhas seguintes (palavras viram A, digitos 9; ficam so rotulos conhecidos)
const expande = (i) => page.evaluate(([idx, S]) => {
  const sec = eval(S), trs = [...sec.querySelectorAll('table tbody tr')], tr = trs[idx]; if (!tr) return { erro: 'sem linha ' + idx };
  const b = [...tr.querySelectorAll('button,span,i,td')].find((x) => /^[▸▶►]$/.test((x.innerText || '').trim())) || tr.querySelector('button'); if (b) b.click(); return { ok: !!b, antes: trs.length };
}, [i, SEC]);
const forma = (de, n) => page.evaluate(([d, q, S]) => {
  const sec = eval(S), trs = [...sec.querySelectorAll('table tbody tr')];
  const K = /^(FILIAL|MOTIVO|VENDEDOR|CLIENTE|PRODUTO|PEDIDO|NOTA|DEVOLU\w*|SUPERVISOR|GERENTE|FORNECEDOR|DATA|NF|VENDA|FATURADO|DEVOLVIDO|TCV|TPH|TSJ|TBL|TBE|TCA|TCG|API|ABC|MCD|TPA)$/i;
  return { linhas: trs.length, th: [...sec.querySelectorAll('thead th')].map((x) => x.innerText.trim().replace(/\s+/g, ' ')).slice(0, 3), formas: trs.slice(d, d + q).map((tr) => String(tr.innerText || '').replace(/[A-Za-zÀ-ú]{2,}/g, (w) => (K.test(w) ? w : 'A')).replace(/\d/g, '9').replace(/\s+/g, ' ').slice(0, 140)) };
}, [de, n, SEC]);

// A) MOTIVO -> expande o 1o motivo -> expande a 1a filial -> o que vem embaixo?
await clica('Motivo'); await page.waitForTimeout(7000);
log('A motivo', JSON.stringify(await forma(0, 2)));
log('A expande motivo', JSON.stringify(await expande(0))); await page.waitForTimeout(5000);
log('A filhos do motivo', JSON.stringify(await forma(1, 3)));
log('A expande filial', JSON.stringify(await expande(1))); await page.waitForTimeout(5000);
log('A netos (embaixo da filial)', JSON.stringify(await forma(2, 4)));
log('A expande neto', JSON.stringify(await expande(2))); await page.waitForTimeout(5000);
log('A bisnetos', JSON.stringify(await forma(3, 4)));
// B) VENDEDOR -> expande o 1o -> o que vem embaixo?
await clica('Vendedor'); await page.waitForTimeout(7000);
log('B vendedor', JSON.stringify(await forma(0, 2)));
log('B expande vendedor', JSON.stringify(await expande(0))); await page.waitForTimeout(5000);
log('B filhos do vendedor', JSON.stringify(await forma(1, 4)));
log('B expande filho', JSON.stringify(await expande(1))); await page.waitForTimeout(5000);
log('B netos', JSON.stringify(await forma(2, 4)));
await browser.close();
