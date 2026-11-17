// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_carteira.mjs   (GitHub Actions: passo "Carteira Total" do .github/workflows/gerot-coleta.yml)
// O QUE É: CARTEIRA TOTAL do GEROT (OPERACAO > Carteira Total > "Exportar planilha": pedido x item em aberto, com Status, Situacao,
//   Motivo Bloqueio e Valor). Junta por pedido e grava no D1 (gerot_carteira, via /api/gerot-carga), so o que mudou; o pedido que saiu
//   da carteira (faturado ou cancelado) e removido, so quando o arquivo veio inteiro.
//   Vitorio, 17/11/2026: "mostrando pedidos do dia 12? ja nao mostrei que tem todos os pedidos no GEROT?" — status/bloqueio de cada pedido.
// REPOSITORIO PUBLICO: o log tem so contagens e nomes de colunas; nada de cliente, CNPJ ou valor; nenhum arquivo anexado.
// =========================================================================
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import fs from 'fs'; import path from 'path'; import os from 'os'; import crypto from 'crypto';

const EMAIL = process.env.GEROT_EMAIL, SENHA = process.env.GEROT_SENHA, KEY = process.env.EVO_KEY;
const API = (process.env.SITE_CFTV || 'https://ceven-cftv-matrix.pages.dev') + '/api/gerot-carga';
const ENSAIO = process.argv.includes('--ensaio');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
async function api(metodo, sufixo, corpo) {
  for (let t = 1; t <= 3; t++) {
    try {
      const r = await fetch(API + sufixo, { method: metodo, headers: { 'X-Evo-Key': KEY, 'Content-Type': 'application/json', 'User-Agent': 'ceven-gerot' }, body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(60000) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      if (r.status < 500) throw new Error(`HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    } catch (e) { if (t === 3) throw e; }
    await new Promise((ok) => setTimeout(ok, 3000 * t));
  }
}
const num = (v) => { if (v == null || v === '') return 0; if (typeof v === 'number') return v; const s = String(v).replace(/[R$\s]/g, ''); const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); return Number.isFinite(n) ? n : 0; };
const dataISO = (v) => { if (v == null || v === '') return null; if (typeof v === 'number') return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10); const t = String(v).trim(); let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`; m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null; };

function porPedido(arq) {
  const w = XLSX.readFile(arq), sh = w.Sheets[w.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  const hi = rows.findIndex((r) => r && r.some((c) => /^Pedido$/i.test(String(c || '').trim())) && r.some((c) => /^Filial$/i.test(String(c || '').trim())));
  if (hi < 0) throw new Error('planilha sem cabecalho Pedido/Filial');
  const H = rows[hi].map((c) => String(c || '').trim()), ix = (re) => H.findIndex((h) => re.test(h));
  const I = { ent: ix(/^Entrada$/i), fil: ix(/^Filial$/i), ped: ix(/^Pedido$/i), ori: ix(/^Origem$/i), st: ix(/^Status$/i), sit: ix(/^Situa[cç][aã]o$/i), mot: ix(/^Motivo Bloqueio$/i),
    cli: ix(/^Cliente$/i), cnpj: ix(/^CNPJ Cliente$/i), stc: ix(/^Status Cliente$/i), posm: ix(/^Positivado no m[eê]s$/i), sup: ix(/^Supervisor$/i), ven: ix(/^Vendedor$/i),
    forn: ix(/^Fornecedor$/i), qped: ix(/^Qt Pedida$/i), qfat: ix(/^Qt a Faturar$/i), val: ix(/^Valor item$/i) };
  const P = new Map();
  for (const r of rows.slice(hi + 1)) {
    if (!r || !r.some((c) => c != null && c !== '')) continue;
    const filial = String(r[I.fil] || '').trim().slice(0, 3).toUpperCase(), pedido = String(r[I.ped] ?? '').replace(/\D/g, '');
    if (!/^[A-Z]{3}$/.test(filial) || !pedido) continue;
    const k = filial + '|' + pedido;
    let x = P.get(k);
    if (!x) {
      const ven = String(I.ven >= 0 ? r[I.ven] || '' : ''), sup = String(I.sup >= 0 ? r[I.sup] || '' : '');
      x = { filial, pedido, entrada: dataISO(I.ent >= 0 ? r[I.ent] : null), origem: I.ori >= 0 ? String(r[I.ori] || '').trim() || null : null,
        status: I.st >= 0 ? String(r[I.st] || '').trim() || null : null, situacao: I.sit >= 0 ? String(r[I.sit] || '').trim() || null : null, motivo: I.mot >= 0 ? String(r[I.mot] || '').trim() || null : null,
        cliente: I.cli >= 0 ? String(r[I.cli] || '').trim() || null : null, cnpj: I.cnpj >= 0 ? String(r[I.cnpj] ?? '').replace(/\D/g, '') || null : null,
        status_cliente: I.stc >= 0 ? String(r[I.stc] || '').trim() || null : null, positivado: I.posm >= 0 ? String(r[I.posm] || '').trim() || null : null,
        rca: (ven.match(/^\s*(\d+)/) || [])[1] || null, vendedor: ven.replace(/^\s*\d+\s*-\s*/, '').trim() || null, sup_cod: (sup.match(/^\s*(\d+)/) || [])[1] || null,
        valor: 0, itens: 0, qped: 0, qfat: 0, fornecedores: [] };
      P.set(k, x);
    }
    x.valor += num(I.val >= 0 ? r[I.val] : 0); x.itens++; x.qped += num(I.qped >= 0 ? r[I.qped] : 0); x.qfat += num(I.qfat >= 0 ? r[I.qfat] : 0);
    const f = I.forn >= 0 ? String(r[I.forn] || '').trim() : ''; if (f && !x.fornecedores.includes(f) && x.fornecedores.length < 8) x.fornecedores.push(f);
  }
  const L = [...P.values()].map((x) => ({ ...x, valor: Math.round(x.valor * 100) / 100, hash: crypto.createHash('md5').update(JSON.stringify([x.status, x.situacao, x.motivo, Math.round(x.valor * 100), x.itens, x.qfat, x.rca, x.entrada])).digest('hex') }));
  return { L, cab: H, linhas: rows.length - hi - 1 };
}

const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
let falhou = false;
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto('https://gerot.triunfanteadmvendas.com.br:8009/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(4000);
  if (await page.$('#lgEmail')) { if (!EMAIL || !SENHA) throw new Error('GEROT_EMAIL / GEROT_SENHA nao configurados'); await page.fill('#lgEmail', EMAIL); await page.fill('#lgSenha', SENHA); await page.click('#lgBtn'); }
  let pronto = false;
  for (let t = 0; t < 150 && !pronto; t++) { await page.waitForTimeout(5000); const txt = await page.evaluate(() => document.body.innerText).catch(() => ''); pronto = /Extrair dados/.test(txt) && /Visão Geral/i.test(txt); }
  if (!pronto) throw new Error('painel nao montou');
  await page.evaluate(() => [...document.querySelectorAll('button,div,span')].filter((x) => /^(OPERAÇÃO|OPERACAO)$/i.test((x.innerText || '').trim())).forEach((x) => { try { x.click(); } catch (e) {} }));
  await page.waitForTimeout(1500);
  const achou = await page.evaluate(() => { const a = document.querySelector('[data-v="carteiraDet"]'); if (a) { a.scrollIntoView(); a.click(); } return !!a; });
  if (!achou) throw new Error('menu Carteira Total nao encontrado');
  await page.waitForTimeout(20000);
  const b = page.getByText(/Exportar planilha/i).first();
  if (!(await b.count())) throw new Error('botao Exportar planilha nao encontrado');
  const dl = page.waitForEvent('download', { timeout: 240000 }).catch(() => null);
  await b.click({ timeout: 15000 });
  const d = await dl; if (!d) throw new Error('exportar nao gerou arquivo em 4 min');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gerot-cart-')), arq = path.join(tmp, 'carteira.xlsx'); await d.saveAs(arq);
  const { L, cab, linhas } = porPedido(arq);
  fs.rmSync(tmp, { recursive: true, force: true });
  log(`carteira: ${linhas} itens · ${L.length} pedidos · colunas ${JSON.stringify(cab)} · com status ${L.filter((x) => x.status).length} · com vendedor ${L.filter((x) => x.rca).length}`);
  if (!ENSAIO && L.length) {
    const { hashes } = await api('GET', '?carteira=1');
    const muda = L.filter((x) => (hashes || {})[x.filial + '|' + x.pedido] !== x.hash);
    for (let i = 0; i < muda.length; i += 200) await api('POST', '', { carteira: muda.slice(i, i + 200) });
    // remove o que saiu da carteira, so com o arquivo inteiro (mais de 1000 pedidos e nenhuma filial sumida de uma vez)
    const atuais = new Set(L.map((x) => x.filial + '|' + x.pedido)), antigos = Object.keys(hashes || {});
    const sai = antigos.filter((k) => !atuais.has(k)), filAntes = new Set(antigos.map((k) => k.slice(0, 3))), filAgora = new Set(L.map((x) => x.filial));
    if (L.length > 1000 && [...filAntes].every((f) => filAgora.has(f))) { for (let i = 0; i < sai.length; i += 400) await api('POST', '', { carteira_remover: sai.slice(i, i + 400) }); log(`carteira: ${muda.length} gravados · ${sai.length} sairam da carteira`); }
    else log(`carteira: ${muda.length} gravados · remocao pulada (arquivo parcial?)`);
  }
} catch (e) { falhou = true; log('FALHA carteira:', String(e && e.message || e).slice(0, 200)); }
await browser.close();
process.exit(falhou ? 1 : 0);
