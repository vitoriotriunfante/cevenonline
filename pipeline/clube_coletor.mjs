// =========================================================================
// FICHA DO ARQUIVO: pipeline/clube_coletor.mjs
// O QUE É: robô SOMENTE LEITURA do Clube da Venda (TradePro), a ORIGEM do pedido digitado e da visita (Vitorio, 12/11/2026: CEVEN fora desde 11/11 17:34;
//   "como o CEVEN ta fora pode ser uma alternativa... vamos fazer"). Lê o Relatório de Vendas do dia: filial -> supervisor -> vendedor (total pedido, total faturado,
//   roteiros, visitas na rota, pedidos na rota/fora/total, média de SKU, eficiência, eficácia). Não clica em nada que altere dado.
// USO: TP_USER=... TP_PASS=... node pipeline/clube_coletor.mjs [AAAAMMDD] [--saida=arquivo.json] [--enviar]
//   --enviar: grava no D1 por /api/clube-carga (precisa CLUBE_CARGA_KEY). Sem --enviar, só escreve o JSON (ensaio).
// =========================================================================
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://grupotriunfante.tradepro.com.br/grupotriunfante/';
// numero da unidade no Clube -> sigla (tela "Filiais" do Relatório de Vendas)
const UNIDADES = { 2: 'TCA', 3: 'ABC', 4: 'TCV', 5: 'API', 6: 'TPA', 7: 'TCG', 9: 'TBL', 10: 'TPH', 11: 'MCD', 12: 'TSJ', 13: 'TBE' };
const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=').slice(1).join('=');
const hojeSP = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
const dia = (process.argv[2] && /^\d{8}$/.test(process.argv[2])) ? process.argv[2] : hojeSP();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const num = (s) => { const t = String(s || '').replace(/[R$\s%]/g, ''); const neg = /^-/.test(t); const v = Number(t.replace(/^-/, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? (neg ? -v : v) : null; };

async function tabelaCodigo(page, esperaMs = 30000) {
  const fim = Date.now() + esperaMs;
  while (Date.now() < fim) {
    await page.waitForTimeout(800);
    const T = await page.evaluate(() => [...document.querySelectorAll('table')].map((t) => ({ cab: [...t.querySelectorAll('thead th')].map((x) => x.innerText.trim().replace(/\s+/g, ' ')), linhas: [...t.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.innerText.trim().replace(/\s+/g, ' '))) }))).catch(() => []);
    const t = T.find((x) => x.cab[0] === 'Código' || x.cab[0] === 'Unidade');
    if (t && t.linhas.length && /^\d+$/.test((t.linhas[0] || [])[0] || '')) return t.linhas.filter((l) => /^\d+$/.test(l[0]));
    if (t && t.linhas.length === 1 && /Nenhum/i.test(t.linhas[0].join(' '))) return [];
  }
  return null;   // nao carregou: falha (nunca vira zero)
}
// linha: Código | Nome | Total Pedido | Total Faturado | Roteiros | Visitas na Rota | Rota | Fora | Total | Média SKU | Eficiência | Eficácia | [Saldo Inicial] | Saldo DM
const linha = (l) => ({ cod: l[0], nome: l[1], total_pedido: num(l[2]), total_faturado: num(l[3]), roteiros: num(l[4]), visitas_rota: num(l[5]), ped_rota: num(l[6]), ped_fora: num(l[7]), ped_total: num(l[8]), media_sku: num(l[9]), eficiencia: num(l[10]), eficacia: num(l[11]) });

async function entra(page) {
  await page.goto(BASE + 'login.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  for (let t = 0; t < 3; t++) {
    try { await page.locator('[id="j_idt6:j_username"]').fill(process.env.TP_USER, { timeout: 10000 }); await page.locator('[id="j_idt6:j_password"]').fill(process.env.TP_PASS, { timeout: 10000 }); await page.locator('input[type=submit]').click({ noWaitAfter: true, timeout: 10000 }); break; } catch { await page.waitForTimeout(3000); }
  }
  for (let t = 0; t < 60; t++) { await page.waitForTimeout(1000); const tx = await page.evaluate(() => document.body.innerText).catch(() => ''); if (/Relat[oó]rio de Vendas|Filiais/.test(tx)) return true; }
  throw new Error('login no Clube nao entrou');
}
const abre = async (page, q) => { await page.goto(BASE + `relatorioVenda.xhtml?di=${dia}&df=${dia}&fo=-1&${q}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}); return tabelaCodigo(page); };

if (!process.env.TP_USER || !process.env.TP_PASS) throw new Error('TP_USER / TP_PASS nao configurados');
const t0 = Date.now();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const p0 = await ctx.newPage(); await entra(p0); log('logado no Clube');
// 1) supervisores de cada filial
const tarefas = [], filiais = {};
for (const [fi, sig] of Object.entries(UNIDADES)) {
  let sups = await abre(p0, `fi=${fi}&n=PAUTA`); if (sups == null) sups = await abre(p0, `fi=${fi}&n=PAUTA`);
  filiais[sig] = { fi: Number(fi), supervisores: sups == null ? null : sups.map(linha) };
  log(sig, sups == null ? 'FALHOU' : sups.length + ' supervisores');
  for (const s of sups || []) tarefas.push({ sig, fi, sup: s[0], supNome: s[1] });
}
// 2) vendedores de cada supervisor, 4 abas em paralelo
const pags = [p0, ...(await Promise.all([1, 2, 3].map(() => ctx.newPage())))];
const vendedores = [], falhas = [];
let k = 0;
await Promise.all(pags.map(async (pg) => {
  while (k < tarefas.length) {
    const x = tarefas[k++];
    let L = await abre(pg, `fi=${x.fi}&n=REPRESENTANTE&co=${x.sup}`); if (L == null) L = await abre(pg, `fi=${x.fi}&n=REPRESENTANTE&co=${x.sup}`);
    if (L == null) { falhas.push(x.sig + ' sup ' + x.sup); continue; }
    for (const l of L) vendedores.push({ filial: x.sig, sup_cod: x.sup, sup_nome: x.supNome, ...linha(l), rca: l[0] });
  }
}));
await browser.close();
const res = { fonte: 'Clube da Venda (TradePro) · Relatório de Vendas', dia: `${dia.slice(0, 4)}-${dia.slice(4, 6)}-${dia.slice(6)}`, lido_em: new Date().toISOString(), duracao_s: Math.round((Date.now() - t0) / 1000), filiais, vendedores, falhas };
const porFil = {}; for (const v of vendedores) { const f = porFil[v.filial] || (porFil[v.filial] = { vend: 0, pedido: 0, ped: 0, visitas: 0, roteiros: 0 }); f.vend++; f.pedido += v.total_pedido || 0; f.ped += v.ped_total || 0; f.visitas += v.visitas_rota || 0; f.roteiros += v.roteiros || 0; }
log('vendedores', vendedores.length, 'falhas', falhas.length, 'tempo', res.duracao_s + 's');
for (const [f, x] of Object.entries(porFil)) log(f, x.vend + ' vend', 'R$ ' + Math.round(x.pedido).toLocaleString('pt-BR'), x.ped + ' ped', x.visitas + '/' + x.roteiros + ' visitas');
const saida = arg('saida') || `clube_${dia}.json`; fs.writeFileSync(saida, JSON.stringify(res)); log('gravado', saida);
if (process.argv.includes('--enviar')) {
  const r = await fetch((process.env.CLUBE_CARGA_URL || 'https://ceven-cftv-matrix.pages.dev') + '/api/clube-carga', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Clube-Key': process.env.CLUBE_CARGA_KEY || '' }, body: JSON.stringify(res) });
  log('carga', r.status, (await r.text()).slice(0, 300));
}
