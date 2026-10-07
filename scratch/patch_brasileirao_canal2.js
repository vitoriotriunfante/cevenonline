const fs = require('fs');
const rel = 'public/brasileirao.html';
let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); s = s.replace(de, () => para); };
// a Liga AS vale a partir do inicio oficial: a semana mostra so os dias oficiais (a pre-temporada nao entra nas pontuacoes)
tr("  const dias = per.dias.filter(d => d <= hoje);\n", "  const inicio = (CANAL === 'AS' && DADOS && !DADOS.pre_temporada && DADOS.inicio_oficial) || '0000-00-00';\n  const dias = per.dias.filter(d => d <= hoje && d >= inicio);\n", 'inicio');
tr("`<span class=\"tag-badge tag-d\" title=\"${esc(b.nome)} — perdido\">${b.ate === 15 ? '15' : '25'}✗</span>` : `<span class=\"tag-badge tag-e\" title=\"${esc(b.nome)} — ainda em jogo\">${b.ate === 15 ? '15' : '25'}…</span>`", "`<span class=\"tag-badge tag-d\" title=\"${esc(b.nome)} — perdido\">dia ${b.ate} ✗</span>` : `<span class=\"tag-badge tag-e\" title=\"${esc(b.nome)} — ainda em jogo\">dia ${b.ate} ⏳</span>`", 'bonus');
tr("% da meta = (faturado + pendente) ÷ meta do mês, o mesmo número do app do CEVEN.", "% da meta = (faturado + pendente) dividido pela meta do mês, o mesmo número do app do CEVEN.", 'div');
tr("<span>• A pontuação é contra o seu próprio dia • 11 Filiais • 405 Vendedores em Campo</span>", "<span id=\"hdr-info\">• A pontuação é contra o seu próprio dia • 11 Filiais</span>", 'hdr');
tr("function renderizarTudo() {\n  if (!DADOS) return;\n", "function renderizarTudo() {\n  if (!DADOS) return;\n  { const hi = document.getElementById('hdr-info'); if (hi && DADOS.vendedores) { const as = DADOS.vendedores.filter(v => v.canal === 'AS').length; hi.textContent = '• A pontuação é contra o seu próprio dia (Varejo) e contra a sua semana (AS) • 11 Filiais • ' + (DADOS.vendedores.length - as) + ' Vendedores Varejo + ' + as + ' AS'; } }\n", 'info');
fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
