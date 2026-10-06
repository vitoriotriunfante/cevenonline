const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

// popup que nao cabe na tela: reduz ate caber (o texto de baixo nao pode ser cortado)
const CABE =
"\n(function () { const ov = document.getElementById('ov'); if (!ov) return;\n" +
"  // POPUP DO VAR QUE NAO CABE (Vitório, 06/10/2026: \"tá explodindo um pouco pra fora ai embaixo\"): se o conteudo passa da altura da tela, reduz o cartao ate caber\n" +
"  const cabe = () => { const d = ov.querySelector('.dec'); if (!d) return;\n" +
"    d.style.transform = ''; d.style.margin = ''; d.style.maxHeight = ''; d.style.overflow = '';\n" +
"    if (d.scrollHeight <= d.clientHeight + 1) return;\n" +
"    d.style.maxHeight = 'none'; d.style.overflow = 'visible';\n" +
"    const nat = d.offsetHeight, disp = window.innerHeight * 0.9, s = Math.min(1, disp / nat);\n" +
"    if (s < 1) { d.style.transform = 'scale(' + s.toFixed(3) + ')'; d.style.transformOrigin = 'center center'; d.style.margin = (-(1 - s) * nat / 2) + 'px 0'; } };\n" +
"  new MutationObserver(() => requestAnimationFrame(cabe)).observe(ov, { childList: true });\n" +
"  window.addEventListener('resize', cabe); })();";

for (const rel of ['public/tvapp.html', 'public/matrizapp.html']) {
  ed(rel, (s) => {
    const marca = "document.addEventListener('click', (e) => { if (!m.contains(e.target)) m.classList.remove('on'); }); })();";
    return tr(s, marca, marca + CABE, rel + ' cabe');
  });
}

// score: o lider da lista = 100 e os demais proporcionais
ed('public/matrizapp.html', (s) => {
  s = tr(s, "const maxScore = Math.max(...stats.map(x => x.scorePositivo || 0), 100);", "const maxScore = Math.max(...stats.map(x => x.scorePositivo || 0), 0.0001); // o LIDER vira 100 e as demais filiais ficam proporcionais (Vitório, 06/10/2026)", 'max');
  s = tr(s, "`score dinâmico (líder: ${maxScore.toFixed(1)})`", "'score dinâmico (líder = 100)'", 'sub');
  s = tr(s, "const notaExibida = ehPositivo ? x.scorePositivo : x.nota;", "const notaExibida = ehPositivo ? Math.round(((x.scorePositivo || 0) / maxScore) * 1000) / 10 : x.nota;", 'nota');
  return s;
});
console.log('tudo ok');
