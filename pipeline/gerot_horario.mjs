// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_horario.mjs   (roda no GitHub Actions: .github/workflows/gerot-horario.yml)
// O QUE É: TESTE DE HORARIO DO GEROT (Vitorio, 16/11/2026: "amanha testar o GEROT desde as 06:00... ver se tem atualizacao... aprender quais os
//   horarios que realmente funcionam"). SO LEITURA: entra no painel, le "Ultima atualizacao" e "carga" e grava no D1 (/api/gerot-carga, chave 'horario').
//   Nao baixa Excel, nao grava dado de venda. Repositorio publico: o log so mostra as horas lidas.
// =========================================================================
import { chromium } from 'playwright';

const URL_GEROT = 'https://gerot.triunfanteadmvendas.com.br:8009';
const API = (process.env.SITE_CFTV || 'https://ceven-cftv-matrix.pages.dev') + '/api/gerot-carga';
const KEY = process.env.EVO_KEY, EMAIL = process.env.GEROT_EMAIL, SENHA = process.env.GEROT_SENHA;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  if (!EMAIL || !SENHA) throw new Error('GEROT_EMAIL / GEROT_SENHA nao configurados');
  const t0 = Date.now();
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
  let r = { ok: false };
  try {
    await page.goto(URL_GEROT + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
    if (await page.$('#lgEmail')) { await page.fill('#lgEmail', EMAIL); await page.fill('#lgSenha', SENHA); await page.click('#lgBtn'); }
    let txt = '';
    for (let t = 0; t < 120; t++) {
      await page.waitForTimeout(5000);
      txt = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (/Última atualização:/i.test(txt) && /carga/i.test(txt)) break;
      if (/lgEmail|senha incorreta|inválid/i.test(txt) && t > 6) throw new Error('login recusado pelo GEROT');
    }
    const ultima = (txt.match(/Última atualização:\s*([^\n]+?)(?:\s+Fonte|\n|$)/i) || [])[1] || null;
    const carga = (txt.match(/carga\s*([0-9]{2}\/[0-9]{2}\s+[0-9]{2}:[0-9]{2}h?)/i) || [])[1] || null;
    const posicao = (txt.match(/Atual\s*·\s*\d{2}\/\d{2}\/\d{4}/) || [])[0] || null;
    r = { ok: !!(ultima || carga), lido_em: new Date().toISOString(), ultima, carga, posicao, segundos: Math.round((Date.now() - t0) / 1000) };
  } catch (e) {
    r = { ok: false, lido_em: new Date().toISOString(), erro: String(e && e.message || e).slice(0, 160), segundos: Math.round((Date.now() - t0) / 1000) };
  } finally { await browser.close().catch(() => {}); }
  log('GEROT horario:', JSON.stringify(r));
  if (KEY) {
    const resp = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Evo-Key': KEY }, body: JSON.stringify({ horario: r }) }).then((x) => x.text()).catch((e) => 'erro ' + e.message);
    log('D1:', String(resp).slice(0, 160));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
