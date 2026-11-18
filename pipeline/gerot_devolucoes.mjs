// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_devolucoes.mjs   (passo do .github/workflows/gerot-coleta.yml; tambem gerot-devolucoes.yml manual)
// O QUE E: DEVOLUCAO POR MOTIVO do GEROT (tela Devolucoes > Detalhamento > Motivo, aberto por filial).
//   Vitorio, 18/11/2026: "devolucoes... vc nao abriu por motivo quando eu pedi!!!" / "como nao tem o motivo? vc so vai ter que cruzar as telas".
//   O "Extrair dados" nao tem o campo motivo; a tela tem. Le a tabela da tela (motivo e, dentro dele, cada filial) e grava em gerot_devolucao_motivo.
// REPOSITORIO PUBLICO: o log tem so contagens. Nada de cliente, nota ou valor.
// =========================================================================
import { chromium } from 'playwright';
const EMAIL = process.env.GEROT_EMAIL, SENHA = process.env.GEROT_SENHA, KEY = process.env.EVO_KEY;
const API = (process.env.SITE_CFTV || 'https://ceven-cftv-matrix.pages.dev') + '/api/gerot-carga';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const mes = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
let falhou = false;
try {
  const page = await (await browser.newContext({ viewport: { width: 1700, height: 1100 }, ignoreHTTPSErrors: true })).newPage();
  for (let t = 1; t <= 3; t++) { try { await page.goto('https://gerot.triunfanteadmvendas.com.br:8009/login', { waitUntil: 'domcontentloaded', timeout: 120000 }); break; } catch (e) { if (t === 3) throw e; await page.waitForTimeout(20000); } }
  await page.waitForTimeout(4000);
  if (await page.$('#lgEmail')) { await page.fill('#lgEmail', EMAIL); await page.fill('#lgSenha', SENHA); await page.click('#lgBtn'); }
  for (let t = 0; t < 150; t++) { await page.waitForTimeout(5000); const tx = await page.evaluate(() => document.body.innerText).catch(() => ''); if (/Extrair dados/.test(tx) && /Visão Geral/i.test(tx)) break; }
  await page.evaluate(() => [...document.querySelectorAll('button,div,span')].filter((x) => /^(RESULTADO)$/i.test((x.innerText || '').trim())).forEach((x) => { try { x.click(); } catch (e) {} }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const a = document.querySelector('[data-v="devolucoes"]'); if (a) { a.scrollIntoView(); a.click(); } });
  await page.waitForTimeout(15000);
  const secSel = () => [...document.querySelectorAll('div,section')].filter((d) => /^\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0];
  // caminho = Motivo
  await page.evaluate(() => { const sec = [...document.querySelectorAll('div,section')].filter((d) => /^\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; const b = sec && [...sec.querySelectorAll('button')].find((x) => (x.innerText || '').trim().replace(/^\d+\s*/, '') === 'Motivo'); if (b) b.click(); });
  await page.waitForTimeout(8000);
  // abre cada motivo (seta da linha de 1o nivel), um por vez
  const nMot = await page.evaluate(() => { const sec = [...document.querySelectorAll('div,section')].filter((d) => /^\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; return sec ? sec.querySelectorAll('table tbody tr').length : 0; });
  for (let i = 0; i < nMot + 60; i++) {
    const abriu = await page.evaluate(() => {
      const sec = [...document.querySelectorAll('div,section')].filter((d) => /^\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (!sec) return false;
      for (const tr of sec.querySelectorAll('table tbody tr')) { if (tr.dataset.aberto) continue; if (/FILIAL/.test(tr.innerText || '')) continue; const b = [...tr.querySelectorAll('button,span,i,td')].find((x) => /^▸$/.test((x.innerText || '').trim())); tr.dataset.aberto = '1'; if (b) { b.click(); return true; } }
      return false;
    });
    if (!abriu) break; await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(3000);
  const T = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('div,section')].filter((d) => /^\s*Detalhamento/.test(d.innerText || '') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (!sec) return null;
    const t = sec.querySelector('table'), th = [...t.querySelectorAll('thead th')].map((x) => x.innerText.trim().replace(/\s+/g, ' ').toUpperCase());
    return { th, linhas: [...t.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim().replace(/\s+/g, ' '))) };
  });
  if (!T) throw new Error('detalhamento nao encontrado');
  const ix = (re) => T.th.findIndex((h) => re.test(h)), iDev = ix(/^DEVOLU/), iNot = ix(/NOTAS/), iCli = ix(/CLIENTES/);
  const num = (s) => { const t = String(s || '').replace(/[R$\s%]/g, ''); if (!t || t === '—') return 0; const neg = /^[-−]/.test(t); const v = Number(t.replace(/^[-−]/, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? (neg ? -v : v) : 0; };
  const out = []; let motivo = null;
  for (const L of T.linhas) {
    const rot = String(L[0] || '').replace(/^[▸▾]\s*/, '').trim(); if (!rot) continue;
    const mF = rot.match(/^([A-Z]{3})\b.*FILIAL/);
    const reg = { valor: num(L[iDev]), notas: num(L[iNot]), clientes: num(L[iCli]) };
    if (mF && motivo) out.push({ mes, motivo, filial: mF[1], ...reg }); else if (!mF) { motivo = rot.toUpperCase(); out.push({ mes, motivo, filial: '', ...reg }); }
  }
  const nM = out.filter((x) => !x.filial).length, nF = out.filter((x) => x.filial).length;
  log(`devolucao por motivo: ${nM} motivos · ${nF} linhas motivo x filial · colunas ${JSON.stringify(T.th.slice(0, 8))}`);
  if (nM) for (let i = 0; i < out.length; i += 200) {
    const r = await fetch(API, { method: 'POST', headers: { 'X-Evo-Key': KEY, 'Content-Type': 'application/json', 'User-Agent': 'ceven-gerot' }, body: JSON.stringify({ devmotivo: out.slice(i, i + 200), devmotivo_mes: mes, devmotivo_primeiro: i === 0 }), signal: AbortSignal.timeout(60000) });
    log('gravado', r.status);
  }
} catch (e) { falhou = true; log('FALHA devolucoes:', String(e && e.message || e).slice(0, 200)); }
await browser.close();
process.exit(falhou ? 1 : 0);
