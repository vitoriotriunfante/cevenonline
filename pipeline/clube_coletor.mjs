// =========================================================================
// FICHA DO ARQUIVO: pipeline/clube_coletor.mjs
// O QUE É: robô SOMENTE LEITURA do Clube da Venda (TradePro), a ORIGEM do pedido digitado e da visita (Vitorio, 12/11/2026: CEVEN fora desde 11/11 17:34;
//   "como o CEVEN ta fora pode ser uma alternativa... vamos fazer"). Lê o Relatório de Vendas do dia: filial -> supervisor -> vendedor (total pedido, total faturado,
//   roteiros, visitas na rota, pedidos na rota/fora/total, média de SKU, eficiência, eficácia). Não clica em nada que altere dado.
// USO: TP_USER=... TP_PASS=... node pipeline/clube_coletor.mjs [AAAAMMDD] [--saida=arquivo.json] [--enviar]
//   --d1: grava no D1 de producao (tabela clube_venda_dia) pelo wrangler desta maquina. Sem --d1, so escreve o JSON (ensaio).
// RODA NO PC DO VITORIO (decisao dele, 12/11/2026: 'deixa aqui mesmo... nao precisa subir no github as senhas do trade'): divida registrada em PREMISSA_ONLINE.md.
// =========================================================================
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import os from 'os'; import { spawnSync } from 'child_process';
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
// 3) RELATORIOS DO DIA DA REDE INTEIRA (12/11/2026, Vitorio: "bora"): check-in/check-out, justificativas e pedidos NAO sincronizados com o Winthor.
//    Botao "Gerar" sem coordenador/representante = todos. So leitura (nunca clica em Novo/Editar/Excluir).
const diaBR = `${dia.slice(6)}/${dia.slice(4, 6)}/${dia.slice(0, 4)}`;
async function relatorio(pg, nomePg, todasPaginas) {
  try {
    await pg.goto(BASE + nomePg + '.xhtml', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}); await pg.waitForTimeout(4000);
    for (const id of await pg.evaluate(() => [...document.querySelectorAll('input')].filter((i) => /data(Inicial|Final|Visita)?.*_input$|data_input$/.test(i.id)).map((i) => i.id)).catch(() => [])) await pg.locator(`[id="${id}"]`).fill(diaBR).catch(() => {});
    await pg.getByRole('button', { name: 'Gerar' }).first().click({ noWaitAfter: true, timeout: 15000 });
    const ler = () => pg.evaluate(() => { const t = [...document.querySelectorAll('table')].find((x) => x.querySelectorAll('thead th').length > 3 && !/^D$/.test((x.querySelector('thead th') || {}).innerText || '')); if (!t) return null; return { cab: [...t.querySelectorAll('thead th')].map((x) => x.innerText.trim().replace(/\s+/g, ' ')), linhas: [...t.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.innerText.trim().replace(/\s+/g, ' '))).filter((l) => l.length > 3) }; }).catch(() => null);
    const pagin = () => pg.evaluate(() => { const p = document.querySelector('.ui-paginator-current'); return p ? p.innerText.replace(/\s+/g, ' ') : ''; }).catch(() => '');
    let T = null; for (let t = 0; t < 240 && !(T && T.linhas.length); t++) { await pg.waitForTimeout(1000); T = await ler(); if (T && !T.linhas.length && /Nenhum/i.test(await pg.evaluate(() => document.body.innerText).catch(() => ''))) break; }
    if (!T) return null;
    const p0 = await pagin(), total = Number((p0.match(/\((\d+)\s*regi/) || [])[1]) || T.linhas.length;
    const todas = [...T.linhas];
    if (todasPaginas && total > todas.length) {
      await pg.evaluate(() => { const s = document.querySelector('.ui-paginator-rpp-options'); if (s) { s.value = s.options[s.options.length - 1].value; s.dispatchEvent(new Event('change', { bubbles: true })); } }).catch(() => {});
      await pg.waitForTimeout(4000); const T1 = await ler(); todas.length = 0; todas.push(...((T1 && T1.linhas) || []));
      for (let n = 0; n < 200 && todas.length < total; n++) {
        const prox = pg.locator('.ui-paginator-next:not(.ui-state-disabled)').first(); if (!(await prox.count())) break;
        const antes = (await ler() || { linhas: [[]] }).linhas[0].join('|'); await prox.click({ noWaitAfter: true }).catch(() => {});
        for (let t = 0; t < 30; t++) { await pg.waitForTimeout(700); const Tn = await ler(); if (Tn && Tn.linhas.length && Tn.linhas[0].join('|') !== antes) { todas.push(...Tn.linhas); break; } }
      }
    }
    return { cab: T.cab, linhas: todas, total };
  } catch (e) { log(nomePg, 'falhou', String(e.message || e).slice(0, 120)); return null; }
}
const [CK, JU, PP] = await Promise.all([relatorio(pags[1], 'relatorioCheckinCheckout', false), relatorio(pags[2], 'relatorioJustificativaRoteiro', true), relatorio(pags[3], 'painelPedido', false)]);
// RCA do Clube -> filial: pelo codigo + nome dos vendedores lidos acima (o mesmo codigo pode existir em 2 filiais)
const porCod = new Map(); for (const v of vendedores) { if (!porCod.has(v.rca)) porCod.set(v.rca, []); porCod.get(v.rca).push(v); }
const semAc = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const filialDe = (cod, nome) => { const L = porCod.get(String(cod)) || []; if (L.length === 1) return L[0].filial; const m = L.find((v) => semAc(v.nome) === semAc(nome)); return m ? m.filial : null; };
const dataIso = (s) => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}:\d{2}(:\d{2})?)?/); return m ? `${m[3]}-${m[2]}-${m[1]}${m[4] ? ' ' + m[4] : ''}` : null; };
const idx = (T, nome) => T ? T.cab.findIndex((c) => semAc(c) === semAc(nome)) : -1;
const checkins = [], justificativas = [];
if (CK) { const i = { cod: idx(CK, 'Código'), tipo: idx(CK, 'Tipo'), dh: idx(CK, 'Data/Hora'), rca: idx(CK, 'ID'), nome: idx(CK, 'Representante'), cli: idx(CK, 'Código Cliente'), cnpj: idx(CK, 'CNPJ'), raz: idx(CK, 'Razão Social'), fan: idx(CK, 'Fantasia') };
  for (const l of CK.linhas) if (l[i.cod]) checkins.push({ codigo: l[i.cod], tipo: l[i.tipo], data_hora: dataIso(l[i.dh]), rca: l[i.rca], nome: l[i.nome], filial: filialDe(l[i.rca], l[i.nome]), cliente: l[i.cli], cnpj: l[i.cnpj], razao: l[i.raz], fantasia: l[i.fan] }); }
if (JU) { const i = { id: idx(JU, 'ID'), co: idx(JU, 'Coordenador'), rep: idx(JU, 'Representante'), cli: idx(JU, 'Código Cliente'), cnpj: idx(JU, 'CPF/CNPJ'), raz: idx(JU, 'Razão Social'), fan: idx(JU, 'Fantasia'), dias: idx(JU, 'Dias Sem Comprar'), mot: idx(JU, 'Motivo Não Visita'), dh: idx(JU, 'Data'), obs: idx(JU, 'Observação') };
  for (const l of JU.linhas) { if (!l[i.id]) continue; const [rc, ...rn] = String(l[i.rep] || '').split(' - '), [sc] = String(l[i.co] || '').split(' - '); justificativas.push({ id: l[i.id], sup_cod: sc.trim(), rca: rc.trim(), nome: rn.join(' - ').trim(), filial: filialDe(rc.trim(), rn.join(' - ')), cliente: l[i.cli], cnpj: l[i.cnpj], razao: l[i.raz], fantasia: l[i.fan], dias_sem_comprar: num(l[i.dias]), motivo: l[i.mot], data_hora: dataIso(l[i.dh]), obs: l[i.obs] || null }); } }
const naoSinc = PP ? PP.total : null;
log('check-in/out', CK ? checkins.length : 'FALHOU', '· justificativas', JU ? justificativas.length + ' de ' + JU.total : 'FALHOU', '· pedidos nao sincronizados com o Winthor', naoSinc == null ? 'FALHOU' : naoSinc);
await browser.close();
const res = { fonte: 'Clube da Venda (TradePro) · Relatório de Vendas', dia: `${dia.slice(0, 4)}-${dia.slice(4, 6)}-${dia.slice(6)}`, lido_em: new Date().toISOString(), duracao_s: Math.round((Date.now() - t0) / 1000), filiais, vendedores, falhas };
const porFil = {}; for (const v of vendedores) { const f = porFil[v.filial] || (porFil[v.filial] = { vend: 0, pedido: 0, ped: 0, visitas: 0, roteiros: 0 }); f.vend++; f.pedido += v.total_pedido || 0; f.ped += v.ped_total || 0; f.visitas += v.visitas_rota || 0; f.roteiros += v.roteiros || 0; }
log('vendedores', vendedores.length, 'falhas', falhas.length, 'tempo', res.duracao_s + 's');
for (const [f, x] of Object.entries(porFil)) log(f, x.vend + ' vend', 'R$ ' + Math.round(x.pedido).toLocaleString('pt-BR'), x.ped + ' ped', x.visitas + '/' + x.roteiros + ' visitas');
const saida = arg('saida') || `clube_${dia}.json`; fs.writeFileSync(saida, JSON.stringify(res)); log('gravado', saida);
if (process.argv.includes('--d1')) {
  // grava SO o que mudou (custo D1 = linhas gravadas): ON CONFLICT ... WHERE algum numero mudou
  const q = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
  const cols = ['total_pedido', 'total_faturado', 'roteiros', 'visitas_rota', 'ped_rota', 'ped_fora', 'ped_total', 'media_sku', 'eficiencia', 'eficacia'];
  const L = ['CREATE TABLE IF NOT EXISTS clube_venda_dia (dia TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, sup_cod TEXT, nome TEXT, ' + cols.map((c) => c + ' REAL').join(', ') + ', lido_em TEXT, mudou_em TEXT, PRIMARY KEY (dia, filial, rca));',
    'CREATE TABLE IF NOT EXISTS clube_coleta_status (id INTEGER PRIMARY KEY AUTOINCREMENT, dia TEXT, lido_em TEXT, vendedores INTEGER, falhas TEXT, duracao_s INTEGER);'];
  for (const v of vendedores) L.push(`INSERT INTO clube_venda_dia (dia, filial, rca, sup_cod, nome, ${cols.join(', ')}, lido_em, mudou_em) VALUES (${[res.dia, v.filial, v.rca, v.sup_cod, v.nome, ...cols.map((c) => v[c]), res.lido_em, res.lido_em].map(q).join(', ')}) ON CONFLICT (dia, filial, rca) DO UPDATE SET sup_cod = excluded.sup_cod, nome = excluded.nome, ${cols.map((c) => c + ' = excluded.' + c).join(', ')}, lido_em = excluded.lido_em, mudou_em = excluded.mudou_em WHERE ${cols.map((c) => 'coalesce(clube_venda_dia.' + c + ', -1e9) <> coalesce(excluded.' + c + ', -1e9)').join(' OR ')};`);
  // quem nao mudou: so a hora da leitura (1 UPDATE para todos), para o 'lido as' ser verdade
  L.push(`UPDATE clube_venda_dia SET lido_em = ${q(res.lido_em)} WHERE dia = ${q(res.dia)} AND (filial || '|' || rca) IN (${vendedores.map((v) => q(v.filial + '|' + v.rca)).join(', ') || "''"});`);
  L.push(`INSERT INTO clube_coleta_status (dia, lido_em, vendedores, falhas, duracao_s) VALUES (${q(res.dia)}, ${q(res.lido_em)}, ${vendedores.length}, ${q(falhas.join(', '))}, ${res.duracao_s});`);
  // check-in/out e justificativas: cada registro do Clube tem codigo proprio -> INSERT OR IGNORE (so o novo e gravado)
  L.push('CREATE TABLE IF NOT EXISTS clube_checkin (codigo TEXT, dia TEXT, filial TEXT, rca TEXT, nome TEXT, tipo TEXT, data_hora TEXT, cliente TEXT, cnpj TEXT, razao TEXT, fantasia TEXT, PRIMARY KEY (codigo, rca, tipo, data_hora));   /* 12/11/2026: o codigo do Clube se repete entre vendedores */',
    'CREATE INDEX IF NOT EXISTS idx_clube_checkin_dia ON clube_checkin (dia, filial, rca);',
    'CREATE TABLE IF NOT EXISTS clube_justificativa (id TEXT PRIMARY KEY, dia TEXT, filial TEXT, sup_cod TEXT, rca TEXT, nome TEXT, cliente TEXT, cnpj TEXT, razao TEXT, fantasia TEXT, dias_sem_comprar REAL, motivo TEXT, data_hora TEXT, obs TEXT);',
    'CREATE INDEX IF NOT EXISTS idx_clube_just_dia ON clube_justificativa (dia, filial, rca);',
    'CREATE TABLE IF NOT EXISTS clube_rodada (id INTEGER PRIMARY KEY AUTOINCREMENT, dia TEXT, lido_em TEXT, vendedores INTEGER, checkins INTEGER, justificativas INTEGER, nao_sinc INTEGER, falhas TEXT, duracao_s INTEGER);');
  for (const c of checkins) L.push(`INSERT OR IGNORE INTO clube_checkin (codigo, dia, filial, rca, nome, tipo, data_hora, cliente, cnpj, razao, fantasia) VALUES (${[c.codigo, res.dia, c.filial, c.rca, c.nome, c.tipo, c.data_hora, c.cliente, c.cnpj, c.razao, c.fantasia].map(q).join(', ')});`);
  for (const j of justificativas) L.push(`INSERT OR IGNORE INTO clube_justificativa (id, dia, filial, sup_cod, rca, nome, cliente, cnpj, razao, fantasia, dias_sem_comprar, motivo, data_hora, obs) VALUES (${[j.id, res.dia, j.filial, j.sup_cod, j.rca, j.nome, j.cliente, j.cnpj, j.razao, j.fantasia, j.dias_sem_comprar, j.motivo, j.data_hora, j.obs].map(q).join(', ')});`);
  L.push(`INSERT INTO clube_rodada (dia, lido_em, vendedores, checkins, justificativas, nao_sinc, falhas, duracao_s) VALUES (${[res.dia, res.lido_em, vendedores.length, CK ? checkins.length : null, JU ? justificativas.length : null, naoSinc, falhas.join(', '), Math.round((Date.now() - t0) / 1000)].map(q).join(', ')});`);
  const arqSql = path.join(os.tmpdir(), 'clube_carga.sql'); fs.writeFileSync(arqSql, L.join('\n'));
  const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'); const WR = fs.existsSync(npxDir) ? fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x)) : null;
  // ate 3 tentativas (12/11/2026: a 1a gravacao foi recusada com o D1 ocupado; a 2a passou)
  let r; for (let t = 1; t <= 3; t++) { r = WR ? spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--file', arqSql, '--yes'], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, NO_COLOR: '1' } }) : spawnSync('npx', ['wrangler', 'd1', 'execute', 'ceven_noc_d1', '--remote', '--file', arqSql, '--yes'], { encoding: 'utf8', shell: true }); if (r.status === 0) break; log('D1 tentativa', t, 'falhou; nova em 20 s'); await new Promise((ok) => setTimeout(ok, 20000)); }
  log('D1', r.status === 0 ? 'gravado' : 'FALHOU', (r.stdout || '').match(/rows_written[^,]*|Executed[^\n]*/g)?.slice(-2).join(' ') || (r.stderr || '').slice(0, 300));
}
