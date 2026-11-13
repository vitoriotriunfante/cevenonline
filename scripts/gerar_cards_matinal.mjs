// =========================================================================
// scripts/gerar_cards_matinal.mjs
// Gera cards PNG mobile-first da Matinal por supervisor, filial e Brasil
// usando Playwright Chromium e grava no D1 via POST /api/matinal-cards.
// =========================================================================
import { chromium } from 'playwright';

const BASE_URL = process.env.SITE_URL || 'https://ceven-cftv-matrix.pages.dev';
const EVO_KEY = process.env.EVO_KEY || '';

const sem = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const R = (v) => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR');
const N = (v) => Math.round(Number(v) || 0).toLocaleString('pt-BR');
const P = (v) => (Number(v) || 0).toFixed(1).replace('.', ',') + '%';
const clsTend = (p) => (p >= 95 ? 'ok' : p >= 75 ? 'warn' : 'bad');
const escHtml = (s) => String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function buildHtml({ titulo, subtitulo, kpis, colunas, linhas }) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    body { background: #0b1220; color: #e2e8f0; width: 880px; padding: 18px; }
    .card-root { background: #0b1220; }
    .hdr { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
    .hdr h1 { font-size: 20px; font-weight: 800; color: #f8fafc; }
    .badge { display: inline-block; background: #102a1d; color: #86efac; border: 1px solid #166534; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-top: 5px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    .kpi { background: #131c2e; border: 1px solid #24324d; border-radius: 10px; padding: 12px; }
    .kpi .lbl { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
    .kpi .val { font-size: 21px; font-weight: 800; margin: 4px 0 3px; color: #f8fafc; }
    .kpi .sub { font-size: 11.5px; color: #94a3b8; }
    .panel { background: #131c2e; border: 1px solid #24324d; border-radius: 10px; overflow: hidden; }
    .panel-hdr { padding: 10px 14px; border-bottom: 1px solid #24324d; display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #f1f5f9; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #1c2840; white-space: nowrap; }
    th { color: #94a3b8; font-weight: 700; font-size: 11px; text-transform: uppercase; background: #0f1727; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 700; font-size: 11.5px; }
    .ok { background: #102a1d; color: #4ade80; }
    .warn { background: #2e2008; color: #fbbf24; }
    .bad { background: #2e1114; color: #f87171; }
    .foot { margin-top: 8px; font-size: 11px; color: #64748b; text-align: right; }
  </style></head><body><div class="card-root" id="root">
    <div class="hdr"><div>
      <h1>☀️ Matinal — ${escHtml(titulo)}</h1>
      <div class="badge">🟢 ${escHtml(subtitulo)}</div>
    </div></div>
    <div class="kpis">${kpis.map((k) => `<div class="kpi"><div class="lbl">${escHtml(k.lbl)}</div><div class="val">${escHtml(k.val)}</div><div class="sub">${escHtml(k.sub)}</div></div>`).join('')}</div>
    <div class="panel">
      <div class="panel-hdr"><span>🎯 Prioridade da Matinal (pior tendência primeiro)</span><span style="color:#94a3b8">${linhas.length} linha(s)</span></div>
      <table><thead><tr>${colunas.map((c, i) => `<th${i > 0 ? ' class="num"' : ''}>${escHtml(c)}</th>`).join('')}</tr></thead>
      <tbody>${linhas.join('')}</tbody></table>
    </div>
    <div class="foot">Jota · Comercial Triunfante</div>
  </div></body></html>`;
}

function summarize(rows, dias, gerotPosicao) {
  const totMeta = rows.reduce((a, x) => a + x.meta, 0);
  const totVend = rows.reduce((a, x) => a + x.vend, 0);
  const totTend = rows.reduce((a, x) => a + x.tend, 0);
  const tendPct = totMeta ? (totTend / totMeta) * 100 : 0;
  const totPos = rows.reduce((a, x) => a + x.pos, 0);
  const totMetaPos = rows.reduce((a, x) => a + x.metaPos, 0);
  const totRota = rows.reduce((a, x) => a + x.rota, 0);
  const totBloqQ = rows.reduce((a, x) => a + x.bloqQtd, 0);
  const totBloqV = rows.reduce((a, x) => a + x.bloqVlr, 0);
  return {
    subtitulo: `Base D1 (independente do CEVEN) · GEROT: ${gerotPosicao || 'Atual'}`,
    kpis: [
      { lbl: 'Faturado + Carteira', val: R(totVend), sub: `de ${R(totMeta)} (${totMeta ? P((totVend / totMeta) * 100) : '0%'})` },
      { lbl: 'Tendência Fechamento', val: P(tendPct), sub: `${R(totTend)} · ${dias.dec}/${dias.tot} du (${dias.falt} rest.)` },
      { lbl: 'Positivação', val: N(totPos), sub: `de ${N(totMetaPos)} (${totMetaPos ? P((totPos / totMetaPos) * 100) : '—'})` },
      { lbl: 'Rota Hoje & Bloq.', val: `${N(totRota)} cli.`, sub: `${N(totBloqQ)} ped. bloq. (${R(totBloqV)})` }
    ]
  };
}

function rowVendHtml(v) {
  const pct = v.meta ? (v.vend / v.meta) * 100 : 0;
  const nome = `${v.rca} - ${v.vendedor}`.slice(0, 32);
  return `<tr>
    <td><strong>${escHtml(nome)}</strong></td>
    <td class="num">${R(v.meta)}</td>
    <td class="num">${R(v.vend)}</td>
    <td class="num">${P(pct)}</td>
    <td class="num"><span class="pill ${clsTend(v.tendPct)}">${P(v.tendPct)}</span></td>
    <td class="num">${R(v.precisaDia)}/d</td>
    <td class="num">${N(v.pos)}${v.metaPos ? '/' + N(v.metaPos) : ''}</td>
    <td class="num">${N(v.rota)}</td>
    <td class="num">${N(v.prospects)}</td>
    <td class="num">${v.bloqQtd ? `<span style="color:#f87171">${N(v.bloqQtd)} (${R(v.bloqVlr)})</span>` : '0'}</td>
  </tr>`;
}

async function main() {
  const localD1 = process.argv.includes('--local-d1');
  if (!EVO_KEY && !localD1) throw new Error('EVO_KEY nao definido (ou use --local-d1)');
  console.log('Lendo /api/matinal ...');
  const res = await fetch(`${BASE_URL}/api/matinal`);
  const d = await res.json();
  if (!d.ok) throw new Error('Falha /api/matinal: ' + JSON.stringify(d));

  const cols = ['Vendedor', 'Meta', 'Fat.+Cart.', '% Meta', 'Tendência', 'Precisa/Dia', 'Positiv.', 'Rota', 'Prosp.', 'Bloq.'];
  const jobs = [];

  // 1. Por supervisor
  const bySup = new Map();
  for (const v of d.vendedores) {
    const k = `${v.filial}|${v.cod_sup || sem(v.supervisor)}`;
    if (!bySup.has(k)) bySup.set(k, { filial: v.filial, cod_sup: String(v.cod_sup || ''), supervisor: v.supervisor || '', rows: [] });
    bySup.get(k).rows.push(v);
  }
  for (const [, g] of bySup) {
    if (!g.rows.length) continue;
    const sum = summarize(g.rows, d.dias, d.fonte.gerotPosicao);
    jobs.push({
      chave: `sup:${g.filial}:${g.cod_sup || sem(g.supervisor)}`,
      filial: g.filial, cod_sup: g.cod_sup, supervisor: g.supervisor,
      html: buildHtml({ titulo: `${g.supervisor || g.cod_sup} (${g.filial})`, ...sum, colunas: cols, linhas: g.rows.slice(0, 22).map(rowVendHtml) })
    });
  }

  // 2. Por filial (top 20 piores vendedores)
  const byFil = new Map();
  for (const v of d.vendedores) {
    if (!byFil.has(v.filial)) byFil.set(v.filial, []);
    byFil.get(v.filial).push(v);
  }
  for (const [fil, rows] of byFil) {
    const sum = summarize(rows, d.dias, d.fonte.gerotPosicao);
    jobs.push({
      chave: `fil:${fil}`, filial: fil, cod_sup: '', supervisor: '',
      html: buildHtml({ titulo: `Filial ${fil} (Top 20 prioridade)`, ...sum, colunas: cols, linhas: rows.slice(0, 20).map(rowVendHtml) })
    });
  }

  // 3. Brasil (por filial consolidado)
  const sumBr = summarize(d.vendedores, d.dias, d.fonte.gerotPosicao);
  const filRows = (d.filiais || []).slice().sort((a, b) => a.tendPct - b.tendPct).map((f) => {
    const sub = byFil.get(f.filial) || [];
    const rota = sub.reduce((a, x) => a + x.rota, 0), prosp = sub.reduce((a, x) => a + x.prospects, 0);
    const bq = sub.reduce((a, x) => a + x.bloqQtd, 0), bv = sub.reduce((a, x) => a + x.bloqVlr, 0);
    const pct = f.meta ? (f.vend / f.meta) * 100 : 0;
    const prec = d.dias.falt ? Math.max(0, f.meta - f.vend) / d.dias.falt : 0;
    return `<tr>
      <td><strong>${escHtml(f.filial)}</strong></td>
      <td class="num">${R(f.meta)}</td>
      <td class="num">${R(f.vend)}</td>
      <td class="num">${P(pct)}</td>
      <td class="num"><span class="pill ${clsTend(f.tendPct)}">${P(f.tendPct)}</span></td>
      <td class="num">${R(prec)}/d</td>
      <td class="num">${N(f.pos)}${f.metaPos ? '/' + N(f.metaPos) : ''}</td>
      <td class="num">${N(rota)}</td>
      <td class="num">${N(prosp)}</td>
      <td class="num">${bq ? `<span style="color:#f87171">${N(bq)} (${R(bv)})</span>` : '0'}</td>
    </tr>`;
  });
  jobs.push({
    chave: 'brasil', filial: 'BR', cod_sup: '', supervisor: '',
    html: buildHtml({ titulo: 'Brasil (11 Filiais)', ...sumBr, colunas: ['Filial', ...cols.slice(1)], linhas: filRows })
  });

  console.log(`Renderizando ${jobs.length} cards JPEG em Playwright...`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
  const prontos = [];
  for (const job of jobs) {
    await page.setContent(job.html, { waitUntil: 'load' });
    const buf = await page.locator('#root').screenshot({ type: 'jpeg', quality: 86 });
    prontos.push({ chave: job.chave, filial: job.filial, cod_sup: job.cod_sup, supervisor: job.supervisor, png_b64: buf.toString('base64') });
  }
  await browser.close();
  console.log(`Maior card: ${Math.round(Math.max(...prontos.map((x) => x.png_b64.length)) / 1024)} KB`);

  if (localD1) {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const { execSync } = await import('child_process');
    const escSql = (s) => `'${String(s || '').replace(/'/g, "''")}'`;
    const initSql = path.join(os.tmpdir(), `matinal_init_${Date.now()}.sql`);
    fs.writeFileSync(initSql, 'CREATE TABLE IF NOT EXISTS matinal_cards (chave TEXT PRIMARY KEY, data TEXT NOT NULL, filial TEXT, cod_sup TEXT, supervisor TEXT, png_b64 TEXT NOT NULL, atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP);\n', 'utf8');
    execSync(`npx wrangler d1 execute ceven_noc_d1 --remote --file "${initSql}"`, { stdio: 'inherit' });
    fs.unlinkSync(initSql);
    console.log(`Gravando ${prontos.length} cards no D1 em lotes de 5...`);
    for (let i = 0; i < prontos.length; i += 5) {
      const tmpSql = path.join(os.tmpdir(), `matinal_cards_${Date.now()}_${i}.sql`);
      const stmts = prontos.slice(i, i + 5).map((c) =>
        `INSERT INTO matinal_cards (chave, data, filial, cod_sup, supervisor, png_b64, atualizado_em) VALUES (${escSql(c.chave)}, ${escSql(d.hoje)}, ${escSql(c.filial)}, ${escSql(c.cod_sup)}, ${escSql(c.supervisor)}, ${escSql(c.png_b64)}, CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET data=excluded.data, filial=excluded.filial, cod_sup=excluded.cod_sup, supervisor=excluded.supervisor, png_b64=excluded.png_b64, atualizado_em=CURRENT_TIMESTAMP;`
      );
      fs.writeFileSync(tmpSql, stmts.join('\n'), 'utf8');
      execSync(`npx wrangler d1 execute ceven_noc_d1 --remote --file "${tmpSql}"`, { stdio: 'pipe' });
      fs.unlinkSync(tmpSql);
    }
    console.log(`OK: ${prontos.length} cards gravados no D1 para ${d.hoje}`);
    return;
  }

  console.log(`Enviando ${prontos.length} cards para /api/matinal-cards...`);
  for (let i = 0; i < prontos.length; i += 5) {
    const lote = prontos.slice(i, i + 5);
    const up = await fetch(`${BASE_URL}/api/matinal-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Evo-Key': EVO_KEY },
      body: JSON.stringify({ data: d.hoje, cards: lote })
    });
    const rj = await up.json();
    if (!up.ok || !rj.ok) throw new Error('Falha upload lote: ' + JSON.stringify(rj));
  }
  console.log(`OK: ${prontos.length} cards gravados para ${d.hoje}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

