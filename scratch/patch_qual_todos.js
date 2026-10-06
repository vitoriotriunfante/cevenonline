const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ---- 1) texto da qualificacao enxuto (ate 6 industrias + "+N"), para caber no obs ----
ed('functions/_lib/qualificacao_gol.js', (s) => tr(s, "  const detalhe = lista.map((x) => `${x.n} ${brl(x.v)}`).join('; ');",
  "  const detalhe = lista.slice(0, 6).map((x) => `${x.n} ${brl(x.v)}`).join('; ') + (lista.length > 6 ? ` (+${lista.length - 6})` : '');", 'detalhe'));

// ---- 2) tv-vendedor: industrias/categorias do DIA do vendedor (uniao dos pedidos de hoje) ----
ed('functions/api/tv-vendedor.js', (s) => tr(s,
  "  return new Response(JSON.stringify(montarTv(id, dash, prod, rot, analisePorCliente)), { headers: cors });",
  "  const saida = montarTv(id, dash, prod, rot, analisePorCliente);\n" +
  "  // Industrias do DIA do vendedor (uniao dos pedidos de hoje): base do nivel dos gols que nao sao de um cliente so (Super Pedido, Goleada, Relampago, Hat-Trick...)\n" +
  "  const somaDia = (campo) => { const m = new Map(); Object.values(analisePorCliente).forEach((a) => (a[campo] || []).forEach((x) => m.set(x.n, (m.get(x.n) || 0) + x.v))); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ n, v: Math.round(v * 100) / 100 })); };\n" +
  "  saida.industrias_dia = somaDia('industrias'); saida.categorias_dia = somaDia('categorias');\n" +
  "  return new Response(JSON.stringify(saida), { headers: cors });", 'saida'));

// ---- 3) coletor: TODOS os gols levam o nivel (Campeao da Rodada fica de fora: e do mes, sem dado de industria do mes) ----
ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "    carteira: carteiraEfetiva(carteira, cl), campo, cl,", "    carteira: carteiraEfetiva(carteira, cl), campo, cl,\n    industriasDia: Array.isArray(d.industrias_dia) ? d.industrias_dia : null, categoriasDia: Array.isArray(d.categorias_dia) ? d.categorias_dia : null,", 'vend');
  s = tr(s, "function vend(id, canal, sup, d, carteira) {", "// Nivel (bronze a platina) do gol que nao e de um cliente so: usa as industrias de TODOS os pedidos do vendedor no dia\nconst provaQ = (v) => (qualificaGol(v.carteira, { industrias: v.industriasDia, categorias: v.categoriasDia }) || {}).texto;\nconst comQ = (v, p) => [p, provaQ(v)].filter(Boolean).join(' | ');\nfunction vend(id, canal, sup, d, carteira) {", 'helper');
  s = tr(s, "prova: `digitado do dia ${brl(v.dig)} (minimo R$ 15.000)` });", "prova: comQ(v, `digitado do dia ${brl(v.dig)} (minimo R$ 15.000)`) });", 'super');
  s = tr(s, "prova: `check-in as ${ultimoCheckin.hms} (antes das ${limiteRelampago}h)` });", "prova: comQ(v, `check-in as ${ultimoCheckin.hms} (antes das ${limiteRelampago}h)`) });", 'rel');
  s = s.replace(/prova: `check-in as \$\{ultimoCheckin\.hms\} \(janela \$\{Math\.floor\(acrIni \/ 60\)\}h\$\{String\(acrIni % 60\)\.padStart\(2, '0'\)\} ate \$\{acrFim \/ 60\}h00\)` \}\);/, (m) => 'prova: comQ(v, ' + m.slice('prova: '.length, -4) + ') });');
  s = tr(s, "prova: `3 check-ins em ${janelaMin} min: ${checkins[i].hms}, ${checkins[i + 1].hms}, ${checkins[i + 2].hms}` });", "prova: comQ(v, `3 check-ins em ${janelaMin} min: ${checkins[i].hms}, ${checkins[i + 1].hms}, ${checkins[i + 2].hms}`) });", 'hat');
  s = tr(s, "prova: `digitado ${brl(v.dig)} >= meta proporcional do dia ${brl(metaDiaria)}; check-in as ${ultimoCheckin.hms}` });", "prova: comQ(v, `digitado ${brl(v.dig)} >= meta proporcional do dia ${brl(metaDiaria)}; check-in as ${ultimoCheckin.hms}`) });", 'meta1t');
  s = tr(s, "prova: `${v.comVenda} com venda em ${v.feitas} visitas = ${Math.round(txConv)}%` });", "prova: comQ(v, `${v.comVenda} com venda em ${v.feitas} visitas = ${Math.round(txConv)}%`) });", 'conv');
  s = tr(s, "prova: `${v.comVenda} clientes positivados na rota (${v.pos || 0} pedidos, digitado ${brl(v.dig)})` });", "prova: comQ(v, `${v.comVenda} clientes positivados na rota (${v.pos || 0} pedidos, digitado ${brl(v.dig)})`) });", 'gole');
  return s;
});

// ---- 4) tv-lances: obs maior (700) e completa o obs do lance de hoje quando ele ainda nao tinha o nivel ----
ed('functions/api/tv-lances.js', (s) => {
  s = s.split('txt(l.obs, 300)').join('txt(l.obs, 700)');
  s = tr(s, "`UPDATE tv_lances SET obs = ? WHERE dia = ? AND filial = ? AND chave = ? AND (obs IS NULL OR obs = '')`\n        ).bind(txt(l.obs, 700), dia, filial, l.chave)",
    "`UPDATE tv_lances SET obs = ? WHERE dia = ? AND filial = ? AND chave = ? AND (obs IS NULL OR obs = '' OR (obs NOT LIKE '%[QUALIF:%' AND ? LIKE '%[QUALIF:%'))`\n        ).bind(txt(l.obs, 700), dia, filial, l.chave, txt(l.obs, 700))", 'update');
  return s;
});

// ---- 5) telas: nivel em TODOS os gols ----
const QNOVO =
"  const subCliente = ['inativo_recuperado', 'drible_vaca', 'recorrencia_salva', 'dobrou_mix', 'dobradinha_quinzenas'], subDia = ['super_pedido', 'conversao', 'relampago', 'acrescimos', 'meta1tempo', 'goleada', 'hattrick'];\n" +
"  const vQ = item.v || (item.a && item.a.v) || {};\n" +
"  // nivel (bronze a platina) em TODOS os gols (menos Campeao da Rodada): de cliente = pedido do cliente; do dia = industrias de todos os pedidos do vendedor hoje\n" +
"  const qGol = (typeof qualificaGolUI === 'function' && (item.tipo === 'gol' || item.tipo === 'hattrick'))\n" +
"    ? (subCliente.includes(subtipo) ? qualificaGolUI(carteiraEfetivaUI(vQ), item.c || (item.a && item.a.c))\n" +
"      : (subDia.includes(subtipo) || item.tipo === 'hattrick') ? qualificaGolUI(carteiraEfetivaUI(vQ), { industrias: vQ.d && vQ.d.industrias_dia, categorias: vQ.d && vQ.d.categorias_dia }) : null)\n" +
"    : null;\n";
for (const rel of ['public/tvapp.html', 'public/matrizapp.html']) {
  ed(rel, (s) => tr(s, "  const qGol = (item.tipo === 'gol' && ['inativo_recuperado', 'drible_vaca', 'recorrencia_salva', 'dobrou_mix', 'dobradinha_quinzenas'].includes(subtipo) && typeof qualificaGolUI === 'function')\n    ? qualificaGolUI(carteiraEfetivaUI(item.v || (item.a && item.a.v) || {}), item.c || (item.a && item.a.c)) : null;\n", QNOVO, rel + ' qGol'));
}

// ---- 6) regulamento + "Regionais" ----
for (const rel of ['config/pontuacao_brasileirao.json', 'public/pontuacao_brasileirao.json']) {
  ed(rel, (s) => {
    s = tr(s, '"gols_que_qualificam": ["gol_inativo (Resgate)", "gol_mix (Dobrou o Mix)", "gol_quinzenas (Dobradinha das Quinzenas)"],', '"gols_que_qualificam": "TODOS os gols, menos o Campeão da Rodada (que é do mês). Gol de cliente (Resgate, Dobrou o Mix, Quinzenas): indústrias do pedido do cliente. Gol do dia (Super Pedido, Goleada, Relâmpago, Acréscimos, Meta do 1º Tempo, Máquina de Conversão, Hat-Trick): indústrias de todos os pedidos do vendedor no dia.",', 'qual');
    s = tr(s, '"gols_que_nao_qualificam": "Gols do dia inteiro (Super Pedido, Goleada, Meta do 1o Tempo, etc.) continuam como estao.",', '"gols_que_nao_qualificam": "Campeão da Rodada (meta do mês).",', 'nao');
    s = tr(s, '"descricao": "A Liga dos Times (Gerente Regional): Resultado de todos os vendedores das filiais sob sua gestão."', '"descricao": "A Liga dos Times (Gerente): Resultado de todos os vendedores das filiais sob sua gestão."', 'desc');
    JSON.parse(s); return s;
  });
}
ed('public/brasileirao.html', (s) => {
  s = tr(s, '<h2>Campeonato de Gerências Regionais</h2>', '<h2>Campeonato de Gerências</h2>', 'gerencias');
  s = tr(s, "pq.textContent = 'Vale para o Resgate de Inativo, Dobrou o Mix e Dobradinha das Quinzenas. ' + gq.regra + ' ' + gq.carteira_so_mondelez;", "pq.textContent = 'Vale para TODOS os gols, menos o Campeão da Rodada (que é do mês). ' + gq.regra + ' ' + gq.carteira_so_mondelez + ' Gol de cliente (Resgate, Dobrou o Mix, Quinzenas): indústrias do pedido do cliente. Gol do dia (Super Pedido, Goleada, Relâmpago, Acréscimos, Meta do 1º Tempo, Conversão, Hat-Trick): indústrias de todos os pedidos do vendedor no dia.';", 'texto');
  return s;
});
console.log('tudo ok');
