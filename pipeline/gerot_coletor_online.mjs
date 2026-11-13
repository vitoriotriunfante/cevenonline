// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_coletor_online.mjs   (roda no GitHub Actions: .github/workflows/gerot-coleta.yml)
// O QUE É: coleta ONLINE do GEROT (Vitorio, semana de 02/11/2026: "industria vem do GEROT"; 09/11/2026: tirar do PC).
//   1) entra no painel com GEROT_EMAIL / GEROT_SENHA (segredos do GitHub), espera o painel montar (~430 MB)
//   2) "Extrair dados": periodo = mes pedido; CAMPOS = Mes, Filial, Supervisor, Vendedor, Fornecedor; CALCULOS = faturamento,
//      devolucao, positivacao, meta e carteira; "Baixar Excel"
//   3) le o Excel e envia ao D1 por /api/gerot-carga (so as linhas que mudaram)
// Uso: node pipeline/gerot_coletor_online.mjs [--meses=2026-11,2026-10] [--ensaio]   (sem --meses: mes atual; dias 1-5 tambem o anterior)
// Nunca inventa: coluna que o GEROT nao trouxe fica fora; a lista de colunas vai para o status da carga.
// Ver docs/GEROT_ESTADO_E_PLANO.md.
// =========================================================================
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const URL_GEROT = 'https://gerot.triunfanteadmvendas.com.br:8009';
const API = (process.env.SITE_CFTV || 'https://ceven-cftv-matrix.pages.dev') + '/api/gerot-carga';
const KEY = process.env.EVO_KEY, EMAIL = process.env.GEROT_EMAIL, SENHA = process.env.GEROT_SENHA;
const ENSAIO = process.argv.includes('--ensaio');
const SAIDA = process.env.GEROT_SAIDA || 'gerot_saida';
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CAMPOS = ['Mês', 'Filial', 'Supervisor', 'Vendedor', 'Fornecedor'];
const CAMPOS_VEND = ['Mês', 'Filial', 'Supervisor', 'Vendedor'];
const CAMPOS_SUP = ['Mês', 'Filial', 'Supervisor'];
const CAMPOS_FIL = ['Mês', 'Filial'];
// calculos (colunas) que interessam ao JOTA; o rotulo exato vem do GEROT e e conferido no log
const CALC = [/^Faturado líquido/i, /^Faturado bruto/i, /^Devolução \(R\$\)/i, /^Positivação \(filial/i, /^Positivação \+ Carteira/i, /^Meta de positivação/i, /^% Meta positivação/i,
  /^Realizado meta/i, /^Meta \(R\$\)/i, /^% Meta$/i, /^% Meta \(Pos \+ Cart\)/i, /Carteira/i, /^Captação/i, /^Meta clientes/i, /Tend[eê]ncia/i];

function mesesAlvo() {
  const a = process.argv.find((x) => x.startsWith('--meses='));
  if (a) return a.slice(8).split(',').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}$/.test(s));
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (d.getDate() > 5) return [cur];
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return [cur, `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`];
}
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

async function entra(page) {
  await page.goto(URL_GEROT + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await page.$('#lgEmail')) {
    if (!EMAIL || !SENHA) throw new Error('GEROT_EMAIL / GEROT_SENHA nao configurados');
    await page.fill('#lgEmail', EMAIL); await page.fill('#lgSenha', SENHA); await page.click('#lgBtn');
    log('login enviado');
  }
  for (let t = 0; t < 120; t++) {   // ate 10 min: o painel baixa ~430 MB
    await page.waitForTimeout(5000);
    const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (/Extrair dados/.test(txt) && /Visão Geral/i.test(txt)) { log('painel montado'); return txt; }
    const p = txt.match(/Baixando o painel:\s*([\d.,]+\s*MB de [\d.,]+\s*MB)/i);
    if (t % 6 === 0) log(p ? 'baixando ' + p[1] : 'aguardando painel...', page.url());
    if (/lgEmail|senha incorreta|inválid/i.test(txt) && t > 6) throw new Error('login recusado pelo GEROT');
  }
  throw new Error('painel do GEROT nao montou em 10 min');
}

// marca/desmarca checkboxes do dialogo "Extrair dados" pelo rotulo
async function ajustaDialogo(page, mes, modo = 'tudo', campos = CAMPOS) {
  const [ano, mm] = mes.split('-'), nomeMes = MESES_PT[Number(mm) - 1];
  return page.evaluate(({ ano, nomeMes, CAMPOS, CALC, modo }) => {
    const calc = CALC.map((s) => new RegExp(s.src, s.flags));
    const dlg = [...document.querySelectorAll('div,section')].filter((d) => /Extrair dados/.test(d.innerText || '') && /Baixar Excel/.test(d.innerText || '') && /CAMPOS/.test(d.innerText || '')).sort((a, b) => a.innerText.length - b.innerText.length)[0];
    if (!dlg) return { erro: 'dialogo nao encontrado' };
    window.__dlgHtml = dlg.outerHTML.slice(0, 200000);
    const caixas = [...dlg.querySelectorAll('input[type=checkbox]')].map((i) => ({ i, rot: ((i.closest('label') || i.parentElement || {}).innerText || '').replace(/\s*•\s*$/, '').trim() }));
    // secao de cada caixa = ultimo titulo (PERIODO / CAMPOS / CALCULOS) que aparece ANTES dela na pagina; ano = ultimo "2026"/"2025" antes dela
    // decide pelo ROTULO de cada caixa (09/11/2026: os titulos das secoes nao aparecem como texto no DOM)
    const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const TODOS_CAMPOS = ['Mês', 'Data', 'Filial', 'Canal Macro', 'Supervisor', 'Vendedor', 'Fornecedor', 'Rede', 'Cliente', 'Cidade', 'Produto'];
    // o ano: os meses aparecem primeiro para o ano mais recente (2026 antes de 2025). Conta a ordem de cada nome de mes.
    const ordemMes = {}; const vezDoAno = (x) => { ordemMes[x.rot] = (ordemMes[x.rot] || 0) + 1; return ordemMes[x.rot]; };
    const anoAtual = String(new Date().getFullYear()), vezAlvo = ano === anoAtual ? 1 : Number(anoAtual) - Number(ano) + 1;
    const tipo = (x) => MESES.includes(x.rot) ? 'PERI' : TODOS_CAMPOS.includes(x.rot) ? 'CAMP' : /filtros do topo/i.test(x.rot) ? 'FILT' : 'CALC';
    caixas.forEach((x) => { x.tipo = tipo(x); if (x.tipo === 'PERI') x.vez = vezDoAno(x); });
    const quer = (x) => {
      if (x.tipo === 'PERI') return x.rot === nomeMes && x.vez === vezAlvo;
      if (x.tipo === 'CAMP') return CAMPOS.includes(x.rot);
      if (x.tipo === 'FILT') return true;
      return calc.some((r) => r.test(x.rot));
    };
    for (const x of caixas) { if (modo === 'ler') break; if (modo === 'mes' && x.tipo !== 'PERI') continue; if (modo === 'resto' && x.tipo === 'PERI') continue; const q = quer(x); if (x.i.checked !== q) x.i.click(); }
    const marc = caixas.filter((x) => x.i.checked).map((x) => x.rot);
    return { marcados: marc, calculosDisponiveis: caixas.filter((x) => x.tipo === 'CALC').map((x) => x.rot), temMes: marc.includes(nomeMes), temCampos: CAMPOS.every((c) => marc.includes(c)) && caixas.filter((x) => x.tipo === 'CAMP' && x.i.checked).length === CAMPOS.length };
  }, { ano, nomeMes, CAMPOS: campos, CALC: CALC.map((r) => ({ src: r.source, flags: r.flags })), modo });
}

const num = (v) => { if (v == null || v === '') return null; if (typeof v === 'number') return v; const s = String(v).replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.'); const n = Number(s); return isFinite(n) ? n : String(v); };
const filialDe = (v) => (String(v || '').toUpperCase().match(/\b[A-Z]{3}\b/) || [''])[0];

function linhasDoExcel(arq, mes) {
  const w = XLSX.readFile(arq), sh = w.Sheets[w.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  const hi = rows.findIndex((r) => r && r.includes('Filial') && r.some((c) => /Vendedor/i.test(String(c || ''))));
  if (hi < 0) throw new Error('Excel sem cabecalho Filial/Vendedor: ' + JSON.stringify(rows[0]));
  const H = rows[hi].map((c) => String(c || '').trim());
  const ix = (re) => H.findIndex((h) => re.test(h));
  const iMes = ix(/^Mês$/), iFil = ix(/^Filial$/), iCs = ix(/^Cód\.? supervisor/i), iSup = ix(/^Supervisor$/i), iCv = ix(/^Cód\.? vendedor/i), iVen = ix(/^Vendedor$/i), iCf = ix(/^Cód\.? fornecedor/i), iFor = ix(/^Fornecedor$/i);
  if (iFor < 0) throw new Error('Excel sem a coluna Fornecedor: ' + H.join(' | '));
  const chaves = new Set([iMes, iFil, iCs, iSup, iCv, iVen, iCf, iFor]);
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    if (!r || !r.some((c) => c != null && c !== '')) continue;
    const m = iMes >= 0 && r[iMes] ? String(r[iMes]).slice(0, 7) : mes;
    if (m !== mes) continue;   // 09/11/2026: a janela pode ter outro mes marcado; so vale o mes pedido (senao grava zeros por cima do mes certo)
    const filial = filialDe(r[iFil]); const rca = String(iCv >= 0 ? r[iCv] ?? '' : '').trim() || String(r[iVen] || '').trim();
    const fornNome = String(r[iFor] || '').trim();
    // mesma industria com 2 codigos/CNPJs (ex.: Bagley 25987 e 25991): a chave leva o codigo, para nao apagar uma linha com a outra (09/11/2026)
    const forn = fornNome && iCf >= 0 && r[iCf] != null && r[iCf] !== '' ? `${fornNome} #${r[iCf]}` : fornNome;
    if (!filial || !rca || !forn || /^total/i.test(fornNome)) continue;
    const dados = {}; H.forEach((h, k) => { if (!chaves.has(k) && h) dados[h] = num(r[k]); });
    if (iCf >= 0) dados['Cód. fornecedor'] = r[iCf];
    dados['Fornecedor'] = fornNome;
    const linha = { mes: m, filial, rca, fornecedor: forn, cod_sup: iCs >= 0 ? r[iCs] : null, supervisor: iSup >= 0 ? r[iSup] : null, vendedor: iVen >= 0 ? r[iVen] : null, dados };
    linha.hash = crypto.createHash('md5').update(JSON.stringify([linha.cod_sup, linha.supervisor, linha.vendedor, dados])).digest('hex');
    out.push(linha);
  }
  return { linhas: out, colunas: H };
}

function linhasVendedorDoExcel(arq, mes) {
  const w = XLSX.readFile(arq), sh = w.Sheets[w.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  const hi = rows.findIndex((r) => r && r.includes('Filial') && r.some((c) => /Vendedor/i.test(String(c || ''))));
  if (hi < 0) throw new Error('Excel vendedor sem cabecalho Filial/Vendedor: ' + JSON.stringify(rows[0]));
  const H = rows[hi].map((c) => String(c || '').trim());
  const ix = (re) => H.findIndex((h) => re.test(h));
  const iMes = ix(/^Mês$/), iFil = ix(/^Filial$/), iCs = ix(/^Cód\.? supervisor/i), iSup = ix(/^Supervisor$/i), iCv = ix(/^Cód\.? vendedor/i), iVen = ix(/^Vendedor$/i);
  const chaves = new Set([iMes, iFil, iCs, iSup, iCv, iVen]);
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    if (!r || !r.some((c) => c != null && c !== '')) continue;
    const m = iMes >= 0 && r[iMes] ? String(r[iMes]).slice(0, 7) : mes;
    if (m !== mes) continue;
    const filial = filialDe(r[iFil]); const rca = String(iCv >= 0 ? r[iCv] ?? '' : '').trim() || String(r[iVen] || '').trim();
    const venNome = String(iVen >= 0 ? r[iVen] || '' : '').trim();
    if (!filial || !rca || /^total/i.test(venNome) || /^total/i.test(String(r[iFil] || ''))) continue;
    const dados = {}; H.forEach((h, k) => { if (!chaves.has(k) && h) dados[h] = num(r[k]); });
    const linha = { mes: m, filial, rca, cod_sup: iCs >= 0 ? r[iCs] : null, supervisor: iSup >= 0 ? r[iSup] : null, vendedor: venNome || null, dados };
    linha.hash = crypto.createHash('md5').update(JSON.stringify([linha.cod_sup, linha.supervisor, linha.vendedor, dados])).digest('hex');
    out.push(linha);
  }
  return { linhas: out, colunas: H };
}

function linhasAgregadoDoExcel(arq, mes, nivel) {
  const w = XLSX.readFile(arq), sh = w.Sheets[w.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  const hi = rows.findIndex((r) => r && r.includes('Filial'));
  if (hi < 0) throw new Error(`Excel ${nivel} sem cabecalho Filial: ` + JSON.stringify(rows[0]));
  const H = rows[hi].map((c) => String(c || '').trim());
  const ix = (re) => H.findIndex((h) => re.test(h));
  const iMes = ix(/^Mês$/), iFil = ix(/^Filial$/), iCs = ix(/^Cód\.? supervisor/i), iSup = ix(/^Supervisor$/i);
  const chaves = new Set([iMes, iFil, iCs, iSup]);
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    if (!r || !r.some((c) => c != null && c !== '')) continue;
    const m = iMes >= 0 && r[iMes] ? String(r[iMes]).slice(0, 7) : mes;
    if (m !== mes) continue;
    const filial = filialDe(r[iFil]);
    if (!filial || /^total/i.test(String(r[iFil] || ''))) continue;
    const dados = {}; H.forEach((h, k) => { if (!chaves.has(k) && h) dados[h] = num(r[k]); });
    if (nivel === 'supervisor') {
      const cod_sup = String(iCs >= 0 ? r[iCs] ?? '' : '').trim() || String(iSup >= 0 ? r[iSup] || '' : '').trim();
      const sup = String(iSup >= 0 ? r[iSup] || '' : '').trim();
      if (!cod_sup || /^total/i.test(sup)) continue;
      const linha = { mes: m, filial, cod_sup, supervisor: sup || null, dados };
      linha.hash = crypto.createHash('md5').update(JSON.stringify([sup, dados])).digest('hex');
      out.push(linha);
    } else {
      const linha = { mes: m, filial, dados };
      linha.hash = crypto.createHash('md5').update(JSON.stringify(dados)).digest('hex');
      out.push(linha);
    }
  }
  return out;
}

async function baixaExcelNivel(page, mes, alvo, campos, arqNome) {
  if (!(await page.getByText('Baixar Excel', { exact: true }).first().isVisible().catch(() => false))) {
    await page.getByText('Extrair dados', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(2000);
  }
  let aj = null;
  const ok = (x) => x && !x.erro && x.temCampos && (x.marcados || []).filter((m) => MESES_PT.includes(m)).join() === alvo;
  for (let k = 0; k < 4 && !ok(aj); k++) {
    await ajustaDialogo(page, mes, 'mes', campos); await page.waitForTimeout(1500);
    await ajustaDialogo(page, mes, 'resto', campos); await page.waitForTimeout(1500);
    aj = await ajustaDialogo(page, mes, 'ler', campos);
  }
  if (!ok(aj)) return null;
  let d = null;
  for (const passo of ['direto', 'previa']) {
    if (passo === 'previa') { await page.getByText('Gerar prévia', { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(15000); }
    const dl = page.waitForEvent('download', { timeout: 180000 }).catch(() => null);
    await page.getByText('Baixar Excel', { exact: true }).first().click();
    d = await dl; if (d) break;
  }
  if (!d) return null;
  const arq = path.join(SAIDA, arqNome); await d.saveAs(arq);
  return arq;
}

async function main() {
  if (!KEY && !ENSAIO) throw new Error('EVO_KEY nao configurado');
  fs.mkdirSync(SAIDA, { recursive: true });
  const meses = mesesAlvo(); log('meses:', meses.join(', '));
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let falhou = false;
  try {
    const txt = await entra(page);
    const posicao = (txt.match(/Atual\s*·\s*\d{2}\/\d{2}\/\d{4}/) || txt.match(/Última atualização:[^\n]+/) || [''])[0];
    log('posicao do GEROT:', posicao);
    for (const mes of meses) {
      try {
        // a janela do mes anterior pode ter ficado aberta: so clica em 'Extrair dados' se ela estiver fechada
        if (!(await page.getByText('Baixar Excel', { exact: true }).first().isVisible().catch(() => false))) await page.getByText('Extrair dados', { exact: true }).first().click({ force: true });
        await page.waitForTimeout(2500);
        // em etapas (09/11/2026): clicar no mes redesenha a janela e desmarca os campos
        let aj = null; const alvo = MESES_PT[Number(mes.slice(5)) - 1];
        const okDe = (x) => x && !x.erro && x.temCampos && (x.marcados || []).filter((m) => MESES_PT.includes(m)).join() === alvo;
        for (let k = 0; k < 4 && !okDe(aj); k++) {
          await ajustaDialogo(page, mes, 'mes'); await page.waitForTimeout(2000);
          await ajustaDialogo(page, mes, 'resto'); await page.waitForTimeout(1500);
          aj = await ajustaDialogo(page, mes, 'ler');
        }
        log('dialogo:', JSON.stringify(aj));
        if (aj.erro || !aj.temMes || !aj.temCampos || (aj.marcados || []).filter((x) => ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].includes(x)).length !== 1) throw new Error('nao consegui marcar periodo/campos de ' + mes + ': ' + (aj.erro || JSON.stringify(aj.marcados)));
        let d = null;
        for (const passo of ['direto', 'previa']) {
          if (passo === 'previa') { log('sem download direto: gerando previa'); await page.getByText('Gerar prévia', { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(20000); }
          const dl = page.waitForEvent('download', { timeout: 300000 }).catch(() => null);
          await page.getByText('Baixar Excel', { exact: true }).first().click();
          d = await dl; if (d) break;
        }
        if (!d) throw new Error('GEROT nao gerou o Excel'); const arq = path.join(SAIDA, `gerot_${mes}.xlsx`); await d.saveAs(arq);
        log('excel baixado:', arq, fs.statSync(arq).size, 'bytes');
        const { linhas, colunas } = linhasDoExcel(arq, mes);
        log(`${mes}: ${linhas.length} linhas · colunas: ${colunas.join(' | ')}`);
        if (!linhas.length) throw new Error('Excel sem linhas para ' + mes);
        let enviadas = 0;
        if (!ENSAIO) {
          const { hashes } = await api('GET', '?mes=' + mes);
          const mudou = linhas.filter((l) => hashes[`${l.filial}|${l.rca}|${l.fornecedor}|${l.cod_sup == null ? '' : l.cod_sup}`] !== l.hash);
          for (let i = 0; i < mudou.length; i += 200) { await api('POST', '', { linhas: mudou.slice(i, i + 200) }); enviadas += Math.min(200, mudou.length - i); }
          await api('POST', '', { status: { mes, linhas: linhas.length, enviadas, posicao, colunas } });
          // 12/11/2026: lista completa das chaves desta extracao -> o D1 apaga a linha que sumiu do GEROT (vendedor que trocou de supervisor etc.)
          if (linhas.length) { const lim = await api('POST', '', { vigentes: { mes, chaves: linhas.map((l) => `${l.filial}|${l.rca}|${l.fornecedor}|${l.cod_sup == null ? '' : l.cod_sup}`) } }).catch((e) => ({ erro: String(e.message || e) })); log('limpeza', mes, JSON.stringify(lim).slice(0, 160)); }
        }
        log(`${mes}: ${enviadas} linhas novas/alteradas gravadas no D1${ENSAIO ? ' (ensaio: nada gravado)' : ''}`);
        // PASSO 2 (13/11/2026): extracoes por VENDEDOR, SUPERVISOR e FILIAL (sem Fornecedor) para positivacao deduplicada oficial
        try {
          const arqV = await baixaExcelNivel(page, mes, alvo, CAMPOS_VEND, `gerot_vend_${mes}.xlsx`);
          if (arqV) {
            const { linhas: lv } = linhasVendedorDoExcel(arqV, mes);
            log(`${mes} vendedor: ${lv.length} linhas`);
            if (lv.length && !ENSAIO) {
              const { hashes: hv } = await api('GET', `?mes=${mes}&vendedor=1`);
              const mudouV = lv.filter((l) => hv[`${l.filial}|${l.rca}|${l.cod_sup == null ? '' : l.cod_sup}`] !== l.hash);
              let envV = 0;
              for (let i = 0; i < mudouV.length; i += 200) { await api('POST', '', { vendedores: mudouV.slice(i, i + 200) }); envV += Math.min(200, mudouV.length - i); }
              const limV = await api('POST', '', { vigentes_vend: { mes, chaves: lv.map((l) => `${l.filial}|${l.rca}|${l.cod_sup == null ? '' : l.cod_sup}`) } }).catch((e) => ({ erro: String(e.message || e) }));
              log(`${mes} vendedor: ${envV} gravadas no D1 · limpeza ${JSON.stringify(limV).slice(0, 120)}`);
            }
          }
          const arqS = await baixaExcelNivel(page, mes, alvo, CAMPOS_SUP, `gerot_sup_${mes}.xlsx`);
          if (arqS) {
            const ls = linhasAgregadoDoExcel(arqS, mes, 'supervisor');
            log(`${mes} supervisor: ${ls.length} linhas`);
            if (ls.length && !ENSAIO) {
              const { hashes: hs } = await api('GET', `?mes=${mes}&supervisor=1`);
              const mudouS = ls.filter((l) => hs[`${l.filial}|${l.cod_sup}`] !== l.hash);
              for (let i = 0; i < mudouS.length; i += 200) await api('POST', '', { supervisores: mudouS.slice(i, i + 200) });
              log(`${mes} supervisor: ${mudouS.length} gravadas no D1`);
            }
          }
          const arqF = await baixaExcelNivel(page, mes, alvo, CAMPOS_FIL, `gerot_fil_${mes}.xlsx`);
          if (arqF) {
            const lf = linhasAgregadoDoExcel(arqF, mes, 'filial');
            log(`${mes} filial: ${lf.length} linhas`);
            if (lf.length && !ENSAIO) {
              const { hashes: hf } = await api('GET', `?mes=${mes}&filial=1`);
              const mudouF = lf.filter((l) => hf[l.filial] !== l.hash);
              if (mudouF.length) await api('POST', '', { filiais: mudouF });
              log(`${mes} filial: ${mudouF.length} gravadas no D1`);
            }
          }
        } catch (ev) { log(`FALHA agregados ${mes}:`, ev.message); }
        await page.keyboard.press('Escape').catch(() => {});
        await page.locator('button:has-text("×")').first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1500);
      } catch (e) { falhou = true; log('FALHA', mes, e.message); try { fs.writeFileSync(path.join(SAIDA, `dialogo_${mes}.html`), String(await page.evaluate(() => window.__dlgHtml || ''))); } catch {} await page.screenshot({ path: path.join(SAIDA, `erro_${mes}.png`), fullPage: true }).catch(() => {}); }
    }
    // RECORRENCIA (Vitorio, 10/11/2026: 'a meta de recorrencia tem no GEROT... e so colocar para ler'): nao existe no 'Extrair dados';
    // abre a tela COBERTURA > Recorrencia e guarda texto, tabelas e print (reconhecimento; nao grava no D1 e nao derruba a coleta)
    try {
      // 10/11/2026: a janela 'Extrair dados' ficava aberta por cima do menu e o clique dava timeout -> fecha no 'x' e clica pelo DOM
      for (let k = 0; k < 3 && await page.getByText('Baixar Excel', { exact: true }).first().isVisible().catch(() => false); k++) { await page.keyboard.press('Escape').catch(() => {}); await page.locator('button:has-text("×")').first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500); }
      await page.evaluate(() => { const g = [...document.querySelectorAll('button')].find((b) => /^COBERTURA$/i.test((b.innerText || '').trim())); if (g && /fechado/.test(g.className)) g.click(); });
      await page.waitForTimeout(1000);
      const achou = await page.evaluate(() => { const a = document.querySelector('[data-v="recorrencia"]'); if (a) a.click(); return !!a; });
      if (!achou) throw new Error('link Recorrencia nao encontrado');
      await page.waitForTimeout(20000);
      // abre as linhas de cada filial da 'Lista do dia 1' (supervisor/vendedor), duas camadas
      // 10/11/2026: a seta e um elemento com o texto '▸' (nao botao); 'Recolher tudo' existe, entao tenta 'Expandir tudo' antes
      await page.evaluate(() => { const e = [...document.querySelectorAll('button,a,span,div')].find((x) => /^Expandir tudo$/i.test((x.innerText || '').trim())); if (e) e.click(); });
      await page.waitForTimeout(3000);
      for (let k = 0; k < 3; k++) { const n = await page.evaluate(() => { const S = [...document.querySelectorAll('table *')].filter((x) => x.children.length === 0 && (x.innerText || x.textContent || '').trim() === '▸'); S.forEach((x) => x.click()); return S.length; }); log('recorrencia: abrindo nivel', k + 1, '·', n, 'setas'); if (!n) break; await page.waitForTimeout(5000); }
      // o 'Extrair dados' desta tela tem calculos de recorrencia? (so le a lista, nao baixa)
      let calcRec = null;
      try { await page.getByText('Extrair dados', { exact: true }).first().click({ force: true }); await page.waitForTimeout(3000); calcRec = await ajustaDialogo(page, mesesAlvo()[0], 'ler'); await page.locator('button:has-text("×")').first().click({ timeout: 3000 }).catch(() => {}); } catch (e) { calcRec = { erro: e.message }; }
      log('recorrencia: calculos do Extrair dados nesta tela:', JSON.stringify(calcRec && calcRec.calculosDisponiveis ? calcRec.calculosDisponiveis.filter((x) => /recorr|recupera|faixa|dias/i.test(x)) : calcRec));
      const rec = await page.evaluate(() => ({ texto: document.body.innerText.slice(0, 120000), tabelas: [...document.querySelectorAll('table')].map((t) => t.outerHTML.slice(0, 300000)), selects: [...document.querySelectorAll('select')].map((s) => [...s.options].map((o) => o.text)) }));
      rec.calculos = calcRec;
      // GRAVA A 'LISTA DO DIA 1 - RECUPERACAO' (filial > supervisor > vendedor): objetivo, meta 80%, positivados, faturado... so o que mudou
      try {
        const ini = rec.texto.indexOf('Lista do dia'), fim = rec.texto.indexOf('Árvore de decomposição', ini), T = ini >= 0 ? rec.texto.slice(ini, fim > 0 ? fim : undefined) : '';
        const mm = T.match(/antes de 01\/(\d{2})\/(\d{4})/), mes = mm ? `${mm[2]}-${mm[1]}` : null;
        const n = (x) => { const s = String(x || '').replace(/R\$\s*/, '').replace(/−/g, '-').trim(); if (!s || s === '—') return null; const v = Number(s.replace(/\./g, '').replace(',', '.').replace('%', '')); return isFinite(v) ? v : null; };
        const linhas = []; let filial = null, sup = null;
        const re = /^(.+?) · (\d+)(SUPERVISOR|VENDEDOR)?\s*\n\t([^\n]+)/gm; let m;
        while (mes && (m = re.exec(T))) {
          const nome = m[1].replace(/^▸\s*/, '').trim(), cod = m[2], tipo = m[3], c = m[4].split('\t');
          const nivel = !tipo ? 'filial' : tipo === 'SUPERVISOR' ? 'supervisor' : 'vendedor';
          if (nivel === 'filial') { if (!/^[A-Z]{3}$/.test(nome)) continue; filial = nome; sup = null; }
          if (nivel === 'supervisor') sup = cod;
          if (!filial) continue;
          const x = { mes, filial, nivel, cod: nivel === 'filial' ? filial : cod, nome: nivel === 'filial' ? filial : nome, sup_cod: nivel === 'vendedor' ? sup : null,
            objetivo: n(c[0]), meta: n(c[1]), positivados: n(c[2]), faturado: n(c[4]), pdvs_afat: n(c[7]), vlr_afat: n(c[8]), pdvs_vend: n(c[9]) };
          x.hash = crypto.createHash('md5').update(JSON.stringify(x)).digest('hex'); linhas.push(x);
        }
        log('recorrencia:', linhas.length, 'linhas lidas (', ['filial', 'supervisor', 'vendedor'].map((k) => k + ' ' + linhas.filter((y) => y.nivel === k).length).join(' · '), ')');
        if (linhas.length && !ENSAIO) { for (let i = 0; i < linhas.length; i += 200) await api('POST', '', { recorrencia: linhas.slice(i, i + 200) }); log('recorrencia: enviada ao D1'); }
      } catch (e) { log('recorrencia: falha ao gravar', e.message); }
      fs.writeFileSync(path.join(SAIDA, 'recorrencia.json'), JSON.stringify(rec, null, 1));
      await page.screenshot({ path: path.join(SAIDA, 'recorrencia.png'), fullPage: true }).catch(() => {});
      log('recorrencia: tela lida ·', rec.tabelas.length, 'tabela(s) ·', rec.texto.slice(0, 1500).replace(/\s+/g, ' '));
    } catch (e) { log('recorrencia: nao abriu a tela', e.message); await page.screenshot({ path: path.join(SAIDA, 'recorrencia_erro.png'), fullPage: true }).catch(() => {}); }
  } catch (e) { falhou = true; log('FALHA', e.message); await page.screenshot({ path: path.join(SAIDA, 'erro_login.png'), fullPage: true }).catch(() => {}); }
  await browser.close();
  if (falhou) process.exit(1);
}
export { linhasDoExcel, linhasVendedorDoExcel };
if (/gerot_coletor_online.mjs$/.test(process.argv[1] || '')) main().catch((e) => { console.error(e); process.exit(1); });
