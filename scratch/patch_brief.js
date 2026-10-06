const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ---------- 1) regulamento: tira a justificativa literal ----------
for (const rel of ['config/pontuacao_brasileirao.json', 'public/pontuacao_brasileirao.json']) {
  ed(rel, (s) => {
    s = s.replace(/("gol_acrescimos": \{[^\n]*?"motivo": ")[^"]*"/, (m, a) => a + 'Pedido fechado no fim do expediente: check-in entre 16h30 e 18h00 (17h30 e 19h00 no fuso: TCG, MCD, TCA), sem desistir da rota. Check-in depois das 18h00 (19h00 no fuso) não vale. Vale a partir de 06/10/2026."');
    JSON.parse(s); return s;
  });
}

// ---------- 2) Goleada: so com CLIENTES positivados comprovados na rota (nao com a contagem de pedidos) ----------
ed('functions/api/cron-lances.js', (s) => tr(s,
  "    if ((v.pos || 0) >= 10) out.push({ chave: `gol_goleada|${v.id}`, nivel: 'gol', v, prova: `${v.pos} pedidos no dia (minimo 10)` });",
  "    // Goleada = 10 ou mais CLIENTES positivados, comprovados na rota (status POSITIVADO/EFETIVADO). A contagem de pedidos do CEVEN (positivacao) NAO prova clientes:\n" +
  "    // 06/10/2026, MCD 420: 12 pedidos de R$ 164 em media, 0 visitas, 0 clientes positivados na rota.\n" +
  "    if ((v.comVenda || 0) >= 10) out.push({ chave: `gol_goleada|${v.id}`, nivel: 'gol', v, prova: `${v.comVenda} clientes positivados na rota (${v.pos || 0} pedidos, digitado ${brl(v.dig)})` });", 'cron goleada'));
ed('public/tvapp.html', (s) => {
  s = tr(s, "    if ((v.pos || 0) >= 10) {\n      out.push({key: `gol_goleada|${v.id}`, nivel: 'gol', subtipo: 'goleada', v, valor: v.pos});", "    if ((v.comVenda || 0) >= 10) { // clientes positivados COMPROVADOS na rota (pedidos nao provam clientes)\n      out.push({key: `gol_goleada|${v.id}`, nivel: 'gol', subtipo: 'goleada', v, valor: v.comVenda});", 'tv goleada');
  return s;
});
ed('public/matrizapp.html', (s) => tr(s, "    if ((v.pos || 0) >= 10) {\n      out.push({key: `${sig}|gol_goleada|${v.id}`, sig, nivel: 'gol', subtipo: 'goleada', v, valor: v.pos});", "    if ((v.comVenda || 0) >= 10) { // clientes positivados COMPROVADOS na rota (pedidos nao provam clientes)\n      out.push({key: `${sig}|gol_goleada|${v.id}`, sig, nivel: 'gol', subtipo: 'goleada', v, valor: v.comVenda});", 'mz goleada'));

// ---------- 3) aviso dos cartoes das 10h/11h a partir do que o servidor registrou (a tela chegava depois do coletor e nunca avisava) ----------
ed('public/animacoes/tv-animacoes.js', (s) => s + `
// Cartoes por horario (amarelo 10h, vermelho de abandono 11h): o coletor do servidor registra no minuto exato; a tela nao os via como "novos".
// Aqui eles viram UM aviso por filial, uma vez por dia em cada navegador, ate 3 h depois do horario do lance.
window.cartoesDoServidor = function (rows, jaAvisou, marca, agoraSeg, secDe, sigDe) {
  const grupos = {};
  (rows || []).forEach(function (r) {
    const k = /(^|[|])ven10[|]/.test(r.chave) ? 'amarelos' : /(^|[|])vis11[|]/.test(r.chave) ? 'visita10' : null;
    if (!k) return;
    const idade = agoraSeg - secDe(r.hora_sp);
    if (!(idade >= 0 && idade <= 3 * 3600)) return;
    const sig = sigDe(r), gk = k + '|' + sig;
    if (jaAvisou(gk)) return;
    (grupos[gk] = grupos[gk] || { tipo: k, sig: sig, l: [], gk: gk }).l.push({ v: { id: r.rca, nome: r.vendedor, sup: r.supervisor || '' }, txt: r.obs || '', subtipo: /nenhuma visita/.test(r.obs || '') ? 'sem_checkin' : 'sem_venda' });
  });
  return Object.keys(grupos).map(function (g) { marca(g); return grupos[g]; });
};
`);
ed('public/matrizapp.html', (s) => {
  s = tr(s, "  LOG.sort((x, y) => secDe(x.t) - secDe(y.t)); store.set(K.seen + HOJE0, [...seen]); store.set(K.log + HOJE0, LOG);\n}\nlet primeiraSync = false, processando = false;",
    "  // cartoes das 10h (amarelo) e 11h (vermelho de abandono): um aviso por filial, uma vez por dia neste navegador\n" +
    "  { const av = new Set(store.get('ceven_brief_mtz_' + HOJE0, []));\n" +
    "    cartoesDoServidor(d.lances, g => av.has(g), g => av.add(g), secDe(sp().hms), secDe, r => (String(r.chave).match(/^([A-Z]{3})[|]/) || [])[1] || 'MTZ').forEach(g => ESPERA.push({tipo: g.tipo, sig: g.sig, l: g.l, score: 32}));\n" +
    "    store.set('ceven_brief_mtz_' + HOJE0, [...av]); }\n" +
    "  LOG.sort((x, y) => secDe(x.t) - secDe(y.t)); store.set(K.seen + HOJE0, [...seen]); store.set(K.log + HOJE0, LOG);\n}\nlet primeiraSync = false, processando = false;", 'mz brief');
  s = tr(s, "<span>${a.subtipo === 'sem_checkin' ? 'nenhuma visita / check-in de varejo' : (a.v ? a.v.feitas : 0) + '/' + (a.v ? a.v.rota : 0) + ' visitas · 0 pedidos'}", "<span>${a.txt ? esc(a.txt) : (a.subtipo === 'sem_checkin' ? 'nenhuma visita / check-in de varejo' : (a.v ? a.v.feitas : 0) + '/' + (a.v ? a.v.rota : 0) + ' visitas · 0 pedidos')}", 'mz txt amarelos');
  s = tr(s, "<span>${a.v ? a.v.feitas : 0}/${a.v ? a.v.rota : 0} visitas · digitado ${brl(a.v ? a.v.dig : 0)}</span>", "<span>${a.txt ? esc(a.txt) : (a.v ? a.v.feitas : 0) + '/' + (a.v ? a.v.rota : 0) + ' visitas · digitado ' + brl(a.v ? a.v.dig : 0)}</span>", 'mz txt grupo');
  return s;
});
ed('public/tvapp.html', (s) => {
  s = tr(s, "  LOG.sort((x, y) => secDe(x.t) - secDe(y.t)); store.set(K.seen + HOJE0, [...seen]); store.set(K.log + HOJE0, LOG);\n}\nasync function processa() {",
    "  // cartoes das 10h (amarelo) e 11h (vermelho de abandono): um aviso, uma vez por dia neste navegador\n" +
    "  { const av = new Set(store.get('ceven_brief_' + FIL + '_' + HOJE0, []));\n" +
    "    cartoesDoServidor(d.lances, g => av.has(g), g => av.add(g), secDe(sp().hms), secDe, () => FIL).forEach(g => ESPERA.push({tipo: g.tipo, l: g.l, score: 32}));\n" +
    "    store.set('ceven_brief_' + FIL + '_' + HOJE0, [...av]); }\n" +
    "  LOG.sort((x, y) => secDe(x.t) - secDe(y.t)); store.set(K.seen + HOJE0, [...seen]); store.set(K.log + HOJE0, LOG);\n}\nasync function processa() {", 'tv brief');
  s = tr(s, "<span>${a.subtipo === 'sem_checkin' ? 'nenhuma visita / check-in de varejo' : a.v.feitas + '/' + a.v.rota + ' visitas · 0 pedidos'}", "<span>${a.txt ? esc(a.txt) : (a.subtipo === 'sem_checkin' ? 'nenhuma visita / check-in de varejo' : a.v.feitas + '/' + a.v.rota + ' visitas · 0 pedidos')}", 'tv txt amarelos');
  s = tr(s, "<span>0/${a.v.rota} visitas — nenhum cliente da rota visitado</span>", "<span>${a.txt ? esc(a.txt) : '0/' + a.v.rota + ' visitas — nenhum cliente da rota visitado'}</span>", 'tv txt visita10');
  return s;
});
console.log('tudo ok');
