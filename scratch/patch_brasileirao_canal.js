const fs = require('fs');
const rel = 'public/brasileirao.html';
let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); s = s.replace(de, () => para); };
const bloco = fs.readFileSync('scratch/canal_bloco.txt', 'utf8');

// ---------- HTML: seletor de canal + CSS ----------
tr("    <div class=\"header-actions\">\n", "    <div class=\"header-actions\">\n      <div class=\"canal-sw\" id=\"canal-sw\" title=\"Escolha o canal: Varejo (joga por dia) ou AS - Autosserviço (joga por semana). Série A e Gerências somam todos.\"><button id=\"canal-v\" class=\"on\" onclick=\"setCanal('VAREJO')\">🛒 Varejo</button><button id=\"canal-a\" onclick=\"setCanal('AS')\">🏬 AS</button></div>\n", 'sw');
tr("</style>", ".canal-sw{display:inline-flex;border:1px solid var(--border,#22304d);border-radius:10px;overflow:hidden}\n.canal-sw button{background:transparent;color:var(--tx,#e8eefc);border:0;padding:8px 14px;font:inherit;font-weight:800;cursor:pointer}\n.canal-sw button.on{background:var(--acc,#38bdf8);color:#04202e}\n</style>", 'css');
// ---------- HTML: ids para trocar titulos e cabecalhos ----------
tr("<h2>Liga dos Supervisores Comerciais</h2>\n          <div class=\"table-subtitle\">", "<h2 id=\"h-sup\">Liga dos Supervisores Comerciais</h2>\n          <div class=\"table-subtitle\" id=\"s-sup\">", 'h-sup');
tr("<h2>Artilharia & Desempenho dos Vendedores</h2>\n          <div class=\"table-subtitle\">", "<h2 id=\"h-vend\">Artilharia & Desempenho dos Vendedores</h2>\n          <div class=\"table-subtitle\" id=\"s-vend\">", 'h-vend');
tr("<h2>Lances do Dia — Auditoria Completa</h2>", "<h2 id=\"h-lances\">Lances do Dia — Auditoria Completa</h2>", 'h-lances');
tr("<h2 style=\"font-size:22px;margin-bottom:4px\">Gabarito do Dia — regras x lances reais</h2>", "<h2 id=\"h-gab\" style=\"font-size:22px;margin-bottom:4px\">Gabarito do Dia — regras x lances reais</h2>", 'h-gab');
tr("          <thead>\n            <tr>\n              <th style=\"width:60px\">Pos</th>\n              <th>Supervisor</th>", "          <thead>\n            <tr id=\"thr-sup\">\n              <th style=\"width:60px\">Pos</th>\n              <th>Supervisor</th>", 'thr-sup');
tr("          <thead>\n            <tr>\n              <th style=\"width:70px\">Posição</th>\n              <th>Vendedor (RCA)</th>", "          <thead>\n            <tr id=\"thr-vend\">\n              <th style=\"width:70px\">Posição</th>\n              <th>Vendedor (RCA)</th>", 'thr-vend');
// gabarito do AS: faseamento
tr("      <div style=\"overflow-x:auto\"><table class=\"tb-league\"><thead><tr><th style=\"width:25%\">Lance (regra oficial)</th>", "      <div id=\"gab-as-fase\" style=\"padding:0 20px 14px;display:none\"></div>\n      <div style=\"overflow-x:auto\"><table class=\"tb-league\"><thead><tr><th style=\"width:25%\">Lance (regra oficial)</th>", 'gab-fase');
// regulamento: bloco do AS + cartoes so do Varejo
tr("      <div class=\"rule-card\">\n        <h3>1. A Regra do Jogo: Cada Dia é uma Rodada (\"Você Contra o Seu Dia\")</h3>", "      <div class=\"rule-card\" id=\"reg-as\" style=\"display:none\">\n        <h3>🏬 Liga AS (Autosserviço) — o jogo é SEMANAL</h3>\n        <div id=\"reg-as-corpo\"></div>\n      </div>\n\n      <div class=\"rule-card so-varejo\">\n        <h3>1. A Regra do Jogo: Cada Dia é uma Rodada (\"Você Contra o Seu Dia\")</h3>", 'reg1');
tr("      <div class=\"rule-card\">\n        <h3>3. Bônus de Constância", "      <div class=\"rule-card so-varejo\">\n        <h3>3. Bônus de Constância", 'reg3');

// ---------- JS: bloco do canal (antes do carregamento) ----------
tr("window.addEventListener('load', carregarDados);\n", bloco + "\nwindow.addEventListener('load', aplicaCanalNaTela);\nwindow.addEventListener('load', carregarDados);\n", 'bloco');
// cabecalhos originais (para voltar do AS ao Varejo)
tr("let CANAL = 'VAREJO';\n", "let CANAL = 'VAREJO';\nconst THR_ORIG = {};\n['thr-vend', 'thr-sup'].forEach(id => { const e = document.getElementById(id); if (e) THR_ORIG[id] = e.innerHTML; });\nfunction restauraThead(id) { const e = document.getElementById(id); if (e && THR_ORIG[id] != null) e.innerHTML = THR_ORIG[id]; }\nlet PERIODO_LANCES = null;\n", 'thr');

// ---------- JS: vendedores e supervisores por canal ----------
tr("function filtrarSupervisores() {\n  if (!DADOS || !DADOS.supervisores) return;\n", "function filtrarSupervisores() {\n  if (!DADOS || !DADOS.supervisores) return;\n  if (CANAL === 'AS') { renderSupervisoresAS(); return; }\n  restauraThead('thr-sup');\n", 'fsup');
tr("  const filtrados = DADOS.supervisores.filter(s => {\n    const matchQ", "  const filtrados = DADOS.supervisores.filter(s => (s.canal || 'VAREJO') !== 'AS').filter(s => {\n    const matchQ", 'fsup2');
tr("function filtrarVendedores() {\n  if (!DADOS || !DADOS.vendedores) return;\n", "function filtrarVendedores() {\n  if (!DADOS || !DADOS.vendedores) return;\n  if (CANAL === 'AS') { renderVendedoresAS(); return; }\n  restauraThead('thr-vend');\n", 'fvend');
tr("  let lista = DADOS.vendedores;\n  const isBrasil = (f === 'BRASIL');", "  let lista = DADOS.vendedores.filter(v => (v.canal || 'VAREJO') !== 'AS');\n  const isBrasil = (f === 'BRASIL');", 'fvend2');

// ---------- JS: lances (dia no Varejo, semana no AS) ----------
tr("    let res = await fetch('/api/brasileirao-lances?' + qs.toString(), { cache: 'no-store' });\n    if (res.ok) {\n      const d = await res.json();\n      if (Array.isArray(d.lances)) {\n        lances = d.lances;\n        porNivel = d.porNivel || {};\n        total = d.total || lances.length;\n      }\n    }\n",
    "    const per = await buscarLancesPeriodo(dia, filial);\n    lances = per.lances; porNivel = per.porNivel; total = per.total; PERIODO_LANCES = per.periodo;\n", 'lances1');
tr("    LANCES_ATUAIS = lances;\n    LANCES_CARREGADOS_HOJE = true;", "    { const setAS = rcasDoAS(); lances = lances.filter(l => lanceDoCanal(l, setAS)); porNivel = {}; lances.forEach(l => { porNivel[l.nivel] = (porNivel[l.nivel] || 0) + 1; }); total = lances.length; }\n    LANCES_ATUAIS = lances;\n    LANCES_CARREGADOS_HOJE = true;", 'lances2');
tr("  const chips = [`<span style=\"background:var(--surface-hover);padding:6px 14px;border-radius:8px;font-weight:700;font-size:13px\">TOTAL: ${total}</span>`];", "  const chips = [`<span style=\"background:var(--surface-hover);padding:6px 14px;border-radius:8px;font-weight:700;font-size:13px\">TOTAL: ${total}</span>`];\n  if (CANAL === 'AS' && PERIODO_LANCES) chips.unshift(`<span style=\"background:var(--acc,#38bdf8);color:#04202e;padding:6px 14px;border-radius:8px;font-weight:800;font-size:13px\">AS · Semana ${PERIODO_LANCES.n} (${ddmm(PERIODO_LANCES.de)} a ${ddmm(PERIODO_LANCES.ate)})</span>`);", 'chips');
tr("      <td class=\"mono\">${esc(l.hora ? l.hora.slice(0,5) : '—')}</td>", "      <td class=\"mono\">${CANAL === 'AS' && l.dia ? esc(ddmm(l.dia)) + ' ' : ''}${esc(l.hora ? l.hora.slice(0,5) : '—')}</td>", 'hora');

// ---------- JS: gabarito (dia no Varejo, semana no AS) ----------
tr("fetch('/api/brasileirao-lances?' + qs.toString(), { cache: 'no-store' }).then(r => r.json())]", "buscarLancesPeriodo(dia, fil).then(p => ({ lances: p.lances }))]", 'gab1');
tr("  if (!tb) return;\n  if (inp && !inp.value) inp.value = hojeISOBrasilia();", "  if (!tb) return;\n  montaGabaritoFase();\n  if (inp && !inp.value) inp.value = hojeISOBrasilia();", 'gab2');
tr("totQ + ' lances · ' + (totP > 0 ? '+' : '') + totP + ' pontos no dia'", "totQ + ' lances · ' + (totP > 0 ? '+' : '') + totP + (CANAL === 'AS' ? ' pontos na semana' : ' pontos no dia')", 'gab3');
// gabarito do faseamento (AS): quantos bateram cada semana
tr("function montaRegulamentoAS() {", `function montaGabaritoFase() {
  const box = document.getElementById('gab-as-fase'); if (!box) return;
  const A = DADOS && DADOS.as;
  if (CANAL !== 'AS' || !A || !A.vendedores) { box.style.display = 'none'; return; }
  const fil = document.getElementById('gab-filial').value, V = A.vendedores.filter(v => !fil || fil === 'TODAS' || v.filial === fil), S = (A.supervisores || []).filter(v => !fil || fil === 'TODAS' || v.filial === fil);
  const conta = (L, n) => { const c = { batida: 0, nao_batida: 0, em_andamento: 0, futuro: 0, sem_meta: 0 }; L.forEach(x => { const f = (x.fases || []).find(y => y.n === n); if (f) c[f.status] = (c[f.status] || 0) + 1; }); return c; };
  const linha = (n, nome, meta, pts) => { const a = conta(V, n), b = conta(S, n); const cel = (c) => '<span style="color:#4ade80;font-weight:800">' + c.batida + ' bateram</span> · <span style="color:#f87171">' + c.nao_batida + ' não</span>' + (c.em_andamento ? ' · <span style="color:#fbbf24">' + c.em_andamento + ' em andamento</span>' : '') + (c.futuro ? ' · <span style="color:var(--tx-mut)">' + c.futuro + ' a vir</span>' : ''); return '<tr><td style="font-weight:700;color:#fff">' + nome + '</td><td style="text-align:center">' + meta + '%</td><td style="text-align:center"><b>+' + pts + '</b></td><td>' + cel(a) + '</td><td>' + cel(b) + '</td></tr>'; };
  const bonus = (id) => { const f = (L) => L.filter(x => (x.bonus || []).some(b => b.id === id && b.status === 'batido')).length; return f(V) + ' vendedores · ' + f(S) + ' supervisores'; };
  box.style.display = '';
  box.innerHTML = '<h3 style="margin:6px 0 8px;font-size:16px">🏬 Faseamento do AS — quem bateu cada semana (' + V.length + ' vendedores · ' + S.length + ' supervisores)</h3><div style="overflow-x:auto"><table class="tb-league"><thead><tr><th>Semana</th><th style="text-align:center">Meta do mês</th><th style="text-align:center">Pontos</th><th>Vendedores</th><th>Supervisores (equipe)</th></tr></thead><tbody>' +
    linha(1, '1ª semana (até o dia 7)', 20, 10) + linha(2, '2ª semana (até o dia 14)', 40, 20) + linha(3, '3ª semana (até o dia 20)', 60, 30) + linha(4, '4ª semana (até o fim do mês)', 110, 40) +
    '<tr><td style="font-weight:700;color:#fff">🥇 100% até o dia 15</td><td style="text-align:center">100%</td><td style="text-align:center"><b>+50</b></td><td colspan="2">' + bonus('quinzena') + '</td></tr><tr><td style="font-weight:700;color:#fff">🥈 100% até o dia 25</td><td style="text-align:center">100%</td><td style="text-align:center"><b>+25</b></td><td colspan="2">' + bonus('dia25') + '</td></tr></tbody></table></div>';
}

function montaRegulamentoAS() {`, 'gabfase');

fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
