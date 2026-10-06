const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ---------- modulo compartilhado: opcoes de painel + bloco generico de lances ----------
ed('public/animacoes/tv-animacoes.js', (s) => s + `
// ====================== PAINEIS ESCOLHIDOS PELO GESTOR (Vitório, 06/10/2026) ======================
// Cada quadro do Painel pode mostrar: alertas, justificativas, digitado, pênaltis ou a lista de cartões vermelhos/amarelos, gols, defesas, impedimentos, gol contra do dia.
window.PAINEIS_OPCOES = [['alertas', '🚨 Alertas ativos'], ['justificativas', '📝 Justificativas de hoje'], ['digitado', '💰 Digitado hoje · ranking'], ['penaltis', '🚨 Ranking de pênaltis'],
  ['vermelhos', '🟥 Cartões vermelhos de hoje'], ['amarelos', '🟨 Cartões amarelos de hoje'], ['gols', '⚽ Gols de hoje'], ['defesas', '🧤 Defesas de hoje'], ['impedimentos', '🚩 Impedimentos de hoje'], ['golcontra', '⚽ Gol contra (devoluções)']];
window.PAINEIS_PADRAO = ['alertas', 'justificativas', 'digitado', 'penaltis'];
window.painelSeletorHtml = function (i, escolhido) {
  return '<select class="psel" onchange="painelSlotSet(' + i + ', this.value)" style="background:#0f1626;color:#cbd5e1;border:1px solid #1e2a44;border-radius:6px;padding:2px 6px;font-size:12px;margin-bottom:4px;max-width:100%">' +
    window.PAINEIS_OPCOES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === escolhido ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
};
window.painelLancesBlocoHtml = function (id, log, esc, tag) {
  const NIV = { vermelhos: ['vermelho', 'venda10', 'visita10'], amarelos: ['amarelo'], gols: ['gol', 'hattrick'], defesas: ['defesa'], impedimentos: ['impedimento'], golcontra: ['golcontra'] };
  const op = window.PAINEIS_OPCOES.find(function (o) { return o[0] === id; });
  const niv = NIV[id];
  if (!op || !niv) return '';
  const l = (log || []).filter(function (e) { return niv.indexOf(e.nivel) >= 0; }).sort(function (a, b) { return String(b.t || '').localeCompare(String(a.t || '')); });
  const cab = '<' + tag + '><span>' + op[1] + '</span><b>' + l.length + '</b></' + tag + '>';
  if (!l.length) return cab + '<div style="color:var(--mut,#8b9bbd);padding:10px 0">Nenhum lance deste tipo hoje.</div>';
  return cab + l.slice(0, 80).map(function (e) {
    const quem = esc(e.vendedor || '') + (e.rca && e.rca !== 'sup' ? ' <span style="color:var(--mut,#8b9bbd)">(RCA ' + esc(e.rca) + ')</span>' : '');
    const onde = [e.sig || e.filial || '', e.cliente || '', e.motivo || '', e.supervisor ? 'sup. ' + e.supervisor : ''].filter(Boolean).map(esc).join(' · ');
    return '<div class="row" style="grid-template-columns:auto 1fr"><span class="tg" style="background:var(--card2,#131c30)">' + esc(String(e.t || '').slice(0, 5)) + '</span><div class="n">' + quem + '<small>' + onde + '</small></div></div>';
  }).join('');
};
`);

// ---------- Matriz: 4 quadros escolhiveis, preenchendo a tela ----------
ed('public/matrizapp.html', (s) => {
  const ini = s.indexOf("  el.innerHTML = `<h2><span>Painel Nacional · 11 filiais</span><b>${sp().hms}</b></h2>\n   <div class=\"grid4painel\">\n");
  const fimMarca = "   </div>`;\n}\nconst penaltisDeNacional";
  const fim = s.indexOf(fimMarca, ini);
  if (ini < 0 || fim < 0) throw new Error('bloco painel nacional');
  const miolo = s.slice(ini + "  el.innerHTML = `<h2><span>Painel Nacional · 11 filiais</span><b>${sp().hms}</b></h2>\n   <div class=\"grid4painel\">\n".length, fim);
  const partes = miolo.split('    <div class="pnl">\n').filter((x) => x.trim());
  if (partes.length !== 4) throw new Error('esperava 4 quadros, achei ' + partes.length);
  const limpa = (p) => p.replace(/\n    <\/div>\n$/, '').replace(/    <\/div>\n$/, '').replace(/\n$/, '');
  const ids = ['alertas', 'justificativas', 'digitado', 'penaltis'];
  const blocos = partes.map((p, i) => '    ' + ids[i] + ': `' + limpa(p).replace(/^\s+/, '') + '`').join(',\n');
  const novo =
"  const BLOCOS = {\n" + blocos + "\n  };\n" +
"  const SLOTS = painelSlots();\n" +
"  const html = `<h2><span>Painel Nacional · 11 filiais</span><b id=\"pnHms\"></b></h2><div class=\"grid4painel\">${SLOTS.map((id, i) => `<div class=\"pnl\">${painelSeletorHtml(i, id)}${BLOCOS[id] || painelLancesBlocoHtml(id, LOG, esc, 'h3')}</div>`).join('')}</div>`;\n" +
"  if (html !== PNL_HTML) { PNL_HTML = html; el.innerHTML = html; } // so redesenha quando muda: o menu aberto e a rolagem dos quadros nao se perdem a cada segundo\n" +
"  const hh = $('pnHms'); if (hh) hh.textContent = sp().hms;\n}\nconst penaltisDeNacional";
  s = s.slice(0, ini) + novo + s.slice(fim + fimMarca.length);
  s = tr(s, 'function renderPainelNacional() {', `let PNL_HTML = '';
function painelSlots() { const v = store.get('ceven_painel_slots_v1', PAINEIS_PADRAO); return Array.isArray(v) && v.length === 4 ? v : PAINEIS_PADRAO; }
window.painelSlotSet = (i, v) => { const sl = painelSlots().slice(); sl[i] = v; store.set('ceven_painel_slots_v1', sl); PNL_HTML = ''; render(); };
function renderPainelNacional() {`, 'fn');
  s = tr(s, "  if (!sup || !SUP_MANUAL) SUP_HTML = '';", "  if (!nacional) PNL_HTML = '';\n  if (!sup || !SUP_MANUAL) SUP_HTML = '';", 'reset');
  s = tr(s, '.grid4painel{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:8px}\n.pnl{background:var(--card2);border-radius:10px;padding:10px;max-height:280px;overflow-y:auto;position:relative}',
    '.grid4painel{display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,minmax(0,1fr));gap:10px;margin-top:8px;flex:1;min-height:0}\n.pnl{background:var(--card2);border-radius:10px;padding:10px;min-height:0;overflow-y:auto;position:relative}', 'css');
  return s;
});

// ---------- TV da filial: seletor em cada quadro, so redesenha quando muda ----------
ed('public/tvapp.html', (s) => {
  for (const n of [1, 2, 3, 4]) s = tr(s, "$('p" + n + "').innerHTML = ", 'BUFP.p' + n + ' = ', 'p' + n);
  s = tr(s, 'function renderPainel(vs) {', `const BUFP = {}, PNL_CACHE = [];
function painelSlots() { const v = store.get('ceven_painel_slots_v1', PAINEIS_PADRAO); return Array.isArray(v) && v.length === 4 ? v : PAINEIS_PADRAO; }
window.painelSlotSet = (i, v) => { const sl = painelSlots().slice(); sl[i] = v; store.set('ceven_painel_slots_v1', sl); PNL_CACHE[i] = null; render(); };
function renderPainel(vs) {`, 'fn');
  // depois do quarto quadro: monta os 4 quadros escolhidos
  const ancora = "  const p1h2 = document.querySelector('#p1 h2'); if (p1h2) { p1h2.style.cursor = 'pointer'; p1h2.onclick = () => abrirModalPainel('alertas'); }";
  s = tr(s, ancora,
"  const DEF = {alertas: BUFP.p1, justificativas: BUFP.p2, digitado: BUFP.p3, penaltis: BUFP.p4};\n" +
"  const SL = painelSlots();\n" +
"  [1, 2, 3, 4].forEach((n, i) => { const html = painelSeletorHtml(i, SL[i]) + (DEF[SL[i]] || painelLancesBlocoHtml(SL[i], LOG, esc, 'h2')); if (PNL_CACHE[i] !== html) { PNL_CACHE[i] = html; $('p' + n).innerHTML = html; } });\n" +
"  const idxAl = SL.indexOf('alertas'); const p1h2 = idxAl >= 0 ? document.querySelector('#p' + (idxAl + 1) + ' h2') : null; if (p1h2) { p1h2.style.cursor = 'pointer'; p1h2.onclick = () => abrirModalPainel('alertas'); }", 'ancora');
  return s;
});

// ---------- Brasileirao: largura responsiva + aba Gabarito ----------
ed('public/brasileirao.html', (s) => {
  s = s.split('max-width: 1500px;').join('max-width: min(1900px, 98vw);');
  s = tr(s, "    <button class=\"tab-btn\" onclick=\"switchTab('lances')\">📋 Lances do Dia</button>\n", "    <button class=\"tab-btn\" onclick=\"switchTab('lances')\">📋 Lances do Dia</button>\n    <button class=\"tab-btn\" onclick=\"switchTab('gabarito')\">🎯 Gabarito do Dia</button>\n", 'btn');
  s = tr(s, '  <!-- ABA 5: REGULAMENTO & TROFEUS -->', `  <!-- ABA: GABARITO DO DIA (regras x lances reais do dia, para acompanhar) -->
  <section id="tab-gabarito" class="tab-content">
    <div class="panel-card" style="padding:0">
      <div style="padding:20px">
        <h2 style="font-size:22px;margin-bottom:4px">Gabarito do Dia — regras x lances reais</h2>
        <p style="color:var(--tx-mut);font-size:13px;margin-bottom:14px">Cada regra da liga com os pontos oficiais e quantos lances reais do dia caíram nela. Nenhum número é estimado.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input type="date" id="gab-data" class="input-search" style="max-width:180px" onchange="carregarGabarito()">
          <select id="gab-filial" class="input-search" style="max-width:160px" onchange="carregarGabarito()"><option value="TODAS">Todas as filiais</option><option>TBL</option><option>TCV</option><option>TPH</option><option>ABC</option><option>API</option><option>TSJ</option><option>TBE</option><option>TPA</option><option>MCD</option><option>TCA</option><option>TCG</option></select>
          <button class="tab-btn" onclick="carregarGabarito()">🔄 Atualizar</button>
          <span id="gab-resumo" style="font-weight:700"></span>
        </div>
      </div>
      <div style="overflow-x:auto"><table class="tb-league"><thead><tr><th>Lance (regra oficial)</th><th style="text-align:center;width:90px">Pontos</th><th>Critério</th><th style="text-align:center;width:90px">Lances hoje</th><th style="text-align:center;width:120px">Pontos no dia</th></tr></thead><tbody id="tbody-gabarito"><tr><td colspan="5" style="text-align:center;padding:30px;color:var(--tx-mut)">Carregando…</td></tr></tbody></table></div>
    </div>
  </section>

  <!-- ABA 5: REGULAMENTO & TROFEUS -->`, 'sec');
  s = tr(s, "  if (tabId === 'lances' && !LANCES_CARREGADOS_HOJE) carregarLances();", "  if (tabId === 'lances' && !LANCES_CARREGADOS_HOJE) carregarLances();\n  if (tabId === 'gabarito') carregarGabarito();", 'tab');
  s = tr(s, 'function renderizarChipsResumo(porNivel, total) {', `// Gabarito do dia: junta as regras do config (pontuacao_brasileirao.json) com os lances reais do dia (endpoint de lances, ja sem duplicados e com extra do gol qualificado)
async function carregarGabarito() {
  const tb = document.getElementById('tbody-gabarito'), inp = document.getElementById('gab-data');
  if (!tb) return;
  if (inp && !inp.value) inp.value = hojeISOBrasilia();
  const dia = inp ? inp.value : hojeISOBrasilia(), fil = document.getElementById('gab-filial').value;
  tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--tx-mut)">Carregando…</td></tr>';
  try {
    const qs = new URLSearchParams({ dia }); if (fil && fil !== 'TODAS') qs.set('filial', fil);
    const [cfg, d] = await Promise.all([fetch('/pontuacao_brasileirao.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()), fetch('/api/brasileirao-lances?' + qs.toString(), { cache: 'no-store' }).then(r => r.json())]);
    const norm = (x) => [...String(x || '').toLowerCase().normalize('NFD')].filter(ch => /[a-z0-9 ]/.test(ch)).join('').replace(/ +/g, ' ').trim();
    const regras = Object.values(cfg.pontos_por_lance || {}).map(r => ({ ...r, n: norm(r.nome), qtd: 0, soma: 0 })).sort((a, b) => b.pontos - a.pontos);
    const outros = { nome: 'Outros (sem regra no gabarito)', pontos: null, motivo: 'Lance real do dia que não casou com nenhuma regra: conferir', qtd: 0, soma: 0 };
    (d.lances || []).forEach(l => {
      const ln = norm(l.pontos_nome);
      const cand = regras.filter(r => r.n && (ln === r.n || ln.startsWith(r.n + ' '))).sort((a, b) => b.n.length - a.n.length)[0];
      const alvo = cand || outros; alvo.qtd++; alvo.soma += Number(l.pontos) || 0;
    });
    const linhas = [...regras, ...(outros.qtd ? [outros] : [])];
    const totQ = linhas.reduce((a, r) => a + r.qtd, 0), totP = linhas.reduce((a, r) => a + r.soma, 0);
    document.getElementById('gab-resumo').textContent = totQ + ' lances · ' + (totP > 0 ? '+' : '') + totP + ' pontos no dia';
    tb.innerHTML = linhas.map(r => {
      const cor = r.pontos == null ? '#f59e0b' : r.pontos > 0 ? '#22c55e' : '#ef4444';
      return '<tr' + (r.qtd ? '' : ' style="opacity:.55"') + '><td style="font-weight:700;color:#fff">' + esc(r.nome) + '</td><td style="text-align:center"><b style="color:' + cor + '">' + (r.pontos == null ? '—' : (r.pontos > 0 ? '+' : '') + r.pontos) + '</b></td><td style="color:#cbd5e1;font-size:13px">' + esc(r.motivo || '') + '</td><td style="text-align:center;font-weight:800">' + r.qtd + '</td><td style="text-align:center;font-weight:800;color:' + (r.soma >= 0 ? '#22c55e' : '#ef4444') + '">' + (r.qtd ? (r.soma > 0 ? '+' : '') + r.soma : '—') + '</td></tr>';
    }).join('');
  } catch (e) {
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--bad)">Falha ao carregar o gabarito — tente de novo.</td></tr>';
  }
}

function renderizarChipsResumo(porNivel, total) {`, 'js');
  return s;
});
console.log('tudo ok');
