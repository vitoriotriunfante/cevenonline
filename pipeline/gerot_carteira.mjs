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

// VENDEDOR DO PEDIDO: Gestao de Equipe (/api/tv-mostra) por filial + nome. Ordem: codigo escrito na planilha > nome igual na filial > nome parecido
// (todas as palavras de um contidas no outro) e unico na filial > comeco do numero do pedido, so se esse codigo for da filial e o nome bater. Senao: null.
const semAc = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/^(CLT|PJ)\s*-?\s+/, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
let EQ = new Map();   // filial -> [{ rca, n }]
async function carregaEquipe() {
  try { const m = await (await fetch((process.env.SITE_CFTV || 'https://ceven-cftv-matrix.pages.dev') + '/api/tv-mostra', { signal: AbortSignal.timeout(30000) })).json();
    for (const [f, lista] of Object.entries(m.filiais || {})) for (const v of lista || []) if (v && v.rca != null) { const fil = String(f).toUpperCase().slice(0, 3); if (!EQ.has(fil)) EQ.set(fil, []); EQ.get(fil).push({ rca: String(v.rca), n: semAc(v.nome) }); }
  } catch (e) { log('sem a Gestao de Equipe: vendedor so pelo codigo escrito na planilha'); }
}
const bate = (a, b) => { if (!a || !b) return false; if (a === b) return true; const wa = a.split(' '), wb = b.split(' '); const [p, q] = wa.length <= wb.length ? [wa, wb] : [wb, wa]; return p.length >= 2 && p.every((w) => q.includes(w)); };
function rcaDoVendedor(filial, ven, pedido) {
  const cod = (String(ven).match(/^\s*(\d+)\s*-/) || [])[1]; if (cod) return cod;
  const n = semAc(String(ven).replace(/^\s*\d+\s*-\s*/, '')), L = EQ.get(filial) || [];
  const igual = L.filter((x) => x.n === n); if (igual.length === 1) return igual[0].rca;
  const par = L.filter((x) => bate(x.n, n)); if (par.length === 1) return par[0].rca;
  const pre = pedido.length > 6 ? String(Number(pedido.slice(0, -6))) : null, v = pre && L.find((x) => x.rca === pre);
  return v && (!n || bate(v.n, n) || v.n.split(' ')[0] === n.split(' ')[0]) ? pre : null;
}

// 22/11/2026: CALIBRACAO DO VALOR. O 'Valor item' nao fecha com a tela (/100 = 0,35-0,8x; x qtd = 24-960x). A coleta le na TELA da Carteira Total o total
//   de cada situacao e testa as formulas candidatas; vale so a que bater (3%). Nenhuma bateu = valor fica null (o JOTA nao mostra R$). Log: so proporcoes.
export function lerAlvoTela(txt) {
  const n = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
  const tot = (txt.match(/CARTEIRA PENDENTE\s*\n\s*R\$\s*([\d.,]+)/i) || [])[1];
  const sit = {}; for (const m of txt.matchAll(/(Bloqueado Financeiro|Bloqueado Comercial|Pendente|Montado|Liberado)\s*\n\s*R\$\s*([\d.,]+)\s*·/gi)) sit[m[1].toLowerCase()] = n(m[2]);
  return { total: tot ? n(tot) : null, sit };
}
function porPedido(arq, alvo) {
  const w = XLSX.readFile(arq), sh = w.Sheets[w.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  const rowsW = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: false });
  const hi = rows.findIndex((r) => r && r.some((c) => /^Pedido$/i.test(String(c || '').trim())) && r.some((c) => /^Filial$/i.test(String(c || '').trim())));
  if (hi < 0) throw new Error('planilha sem cabecalho Pedido/Filial');
  const H = rows[hi].map((c) => String(c || '').trim()), ix = (re) => H.findIndex((h) => re.test(h));
  const I = { ent: ix(/^Entrada$/i), fil: ix(/^Filial$/i), ped: ix(/^Pedido$/i), ori: ix(/^Origem$/i), st: ix(/^Status$/i), sit: ix(/^Situa[cç][aã]o$/i), mot: ix(/^Motivo Bloqueio$/i),
    cli: ix(/^Cliente$/i), cnpj: ix(/^CNPJ Cliente$/i), stc: ix(/^Status Cliente$/i), posm: ix(/^Positivado no m[eê]s$/i), sup: ix(/^Supervisor$/i), ven: ix(/^Vendedor$/i),
    forn: ix(/^Fornecedor$/i), qped: ix(/^Qt Pedida$/i), qfat: ix(/^Qt a Faturar$/i), val: ix(/^Valor item$/i), sku: ix(/^SKU$/i), prod: ix(/^Produto$/i) };
  const P = new Map(), LN = [];
  const brl = (t) => { if (t == null) return 0; const q = String(t).replace(/[R$\s]/g, ''); if (!q) return 0; const v = q.includes(',') ? Number(q.replace(/\./g, '').replace(',', '.')) : Number(q); return Number.isFinite(v) ? v : 0; };
  for (let ri = hi + 1; ri < rows.length; ri++) {
    const r = rows[ri], rw = rowsW[ri] || [];
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
        // 17/11/2026 (Vitorio: "nao leve como verdade absoluta... o que diferencia e a filial"): o codigo do vendedor sai do NOME dele NA FILIAL (Gestao de Equipe);
        // o comeco do numero do pedido so e aceito quando e um vendedor daquela filial E o nome bate; sem isso, fica sem vendedor (nunca o vendedor errado)
        rca: rcaDoVendedor(filial, ven, pedido), vendedor: ven.replace(/^\s*\d+\s*-\s*/, '').trim() || null, sup_cod: (sup.match(/^\s*(\d+)/) || [])[1] || null,
        valor: 0, itens: 0, qped: 0, qfat: 0, fornecedores: [], mp: 0, _f: new Set(), _s: new Set() };
      P.set(k, x);
    }
    // 18/11/2026: o "Valor item" do GEROT vem em CENTAVOS -> divide por 100
    // 21/11/2026 (Vitorio: 'e so olhar nos arquivos do GEROT'): e o PRECO UNITARIO, nao o valor da linha. Linha = preco x Qt a faturar (sem ela, Qt pedida).
    //   A soma ficava 2-10x abaixo da tela (Bloqueio Comercial R$ 211 mil x R$ 442.445 do GEROT).
    const qL = num(I.qfat >= 0 ? r[I.qfat] : 0) || num(I.qped >= 0 ? r[I.qped] : 0) || 1, raw = num(I.val >= 0 ? r[I.val] : 0), txtV = brl(I.val >= 0 ? rw[I.val] : null);
    const cand = { A: raw / 100, B: raw / 100 * qL, C: txtV, D: txtV * qL, E: raw };
    const ln = { x, cand, sit: String(x.situacao || '').toLowerCase(), mpOk: false }; LN.push(ln);
    const vItem = cand.A;   // provisorio (so para os conjuntos de fornecedor/SKU); o valor final sai da calibracao
    x.itens++;
    // MARCA PROPRIA (Liga): fornecedor TRIUNFANTE BRASIL, sem o palete (SKU 8171 'TRIUNFANTE (NAO E MARCA PROPRIA)', regra de 10/11/2026)
    { const fN = String(I.forn >= 0 ? r[I.forn] || '' : '').toUpperCase(), sk = String(I.sku >= 0 ? r[I.sku] ?? '' : '').replace(/\D/g, ''), pN = String(I.prod >= 0 ? r[I.prod] || '' : '').toUpperCase();
      if (/TRIUNFANTE BRASIL|MARCA PROPRIA/.test(fN) && sk !== '8171' && !/PALLET|PALETE/.test(pN)) ln.mpOk = true;
      // 23/11/2026 (Vitorio: TOPEI 9169 BISC PALITO CREME AVELA CACAU conta como marca propria)
      if (sk === '9169' || /\bTOPEI\b/.test(fN)) ln.mpOk = true;
      if (fN && vItem > 0) x._f.add(fN); if (sk && vItem > 0) x._s.add(sk); } x.qped += num(I.qped >= 0 ? r[I.qped] : 0); x.qfat += num(I.qfat >= 0 ? r[I.qfat] : 0);
    const f = I.forn >= 0 ? String(r[I.forn] || '').trim() : ''; if (f && !x.fornecedores.includes(f) && x.fornecedores.length < 8) x.fornecedores.push(f);
  }
  // calibracao contra a tela
  const somas = {}; for (const k of Object.keys(LN[0] ? LN[0].cand : {})) somas[k] = LN.reduce((a, l) => a + (l.cand[k] || 0), 0);
  const razao = {}; let esc = null;
  if (alvo && alvo.total) for (const [k, v] of Object.entries(somas)) { razao[k] = Math.round((v / alvo.total) * 1000) / 1000; if (!esc && Math.abs(v / alvo.total - 1) <= 0.03) esc = k; }
  const porSit = {}; if (esc) for (const l of LN) porSit[l.sit] = (porSit[l.sit] || 0) + (l.cand[esc] || 0);
  const rSit = Object.fromEntries(Object.entries((alvo && alvo.sit) || {}).map(([k, v]) => [k, porSit[k] && v ? Math.round((porSit[k] / v) * 1000) / 1000 : null]));
  log('calibracao do valor: proporcao (soma / tela) por formula', JSON.stringify(razao), '· escolhida', esc || 'NENHUMA (valor fica null)', '· por situacao', JSON.stringify(rSit));
  for (const x of P.values()) { x.valor = esc ? 0 : null; x.mp = esc ? 0 : null; }
  if (esc) for (const l of LN) { l.x.valor += l.cand[esc] || 0; if (l.mpOk) l.x.mp += l.cand[esc] || 0; }
  const L = [...P.values()].map(({ _f, _s, ...x }) => ({ ...x, valor: x.valor == null ? null : Math.round(x.valor * 100) / 100, mp: x.mp == null ? null : Math.round(x.mp * 100) / 100, nforn: _f.size, skus: _s.size, hash: crypto.createHash('md5').update(JSON.stringify([x.status, x.situacao, x.motivo, x.valor == null ? null : Math.round(x.valor * 100), x.itens, x.qfat, x.rca, x.entrada, x.mp == null ? null : Math.round(x.mp * 100), _f.size, _s.size, 'cal'])).digest('hex') }));
  // 17/11/2026: o valor somado deu 25-82x o total do pedido no Clube. Log SO DO FORMATO (digitos trocados por 9, nada de valor) de Valor item, Qt Pedida e Caixas
  const fmt = (v) => (v == null ? 'null' : typeof v === 'number' ? 'numero' + (Number.isInteger(v) ? '-inteiro' : '-decimal') : String(v).replace(/[0-9]/g, '9').slice(0, 20));
  const amostra = rows.slice(hi + 1, hi + 400).filter(Boolean); const tipos = (k) => { const m = {}; for (const r of amostra) { const f = fmt(k >= 0 ? r[k] : null); m[f] = (m[f] || 0) + 1; } return JSON.stringify(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4)); };
  log('formato Valor item', tipos(I.val), '· Qt Pedida', tipos(I.qped), '· Caixas', tipos(H.findIndex((h) => /^Caixas$/i.test(h))));
  return { L, cab: H, linhas: rows.length - hi - 1 };
}

const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
let falhou = false;
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  // 17/11/2026 15h40: o GEROT demorou mais de 2 min para abrir o login e a carga caiu; ate 3 tentativas
  for (let t = 1; t <= 3; t++) { try { await page.goto('https://gerot.triunfanteadmvendas.com.br:8009/login', { waitUntil: 'domcontentloaded', timeout: 120000 }); break; } catch (e) { log(`login do GEROT nao abriu (tentativa ${t})`); if (t === 3) throw e; await page.waitForTimeout(20000); } }
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
  const alvo = lerAlvoTela(await page.evaluate(() => document.body.innerText).catch(() => ''));
  log('tela da carteira: total lido', alvo.total ? 'sim' : 'NAO', '· situacoes lidas', Object.keys(alvo.sit).join(', ') || 'nenhuma');
  const b = page.getByText(/Exportar planilha/i).first();
  if (!(await b.count())) throw new Error('botao Exportar planilha nao encontrado');
  const dl = page.waitForEvent('download', { timeout: 240000 }).catch(() => null);
  await b.click({ timeout: 15000 });
  const d = await dl; if (!d) throw new Error('exportar nao gerou arquivo em 4 min');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gerot-cart-')), arq = path.join(tmp, 'carteira.xlsx'); await d.saveAs(arq);
  await carregaEquipe();
  const { L, cab, linhas } = porPedido(arq, alvo);
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
