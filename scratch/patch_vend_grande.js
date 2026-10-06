const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

ed('public/animacoes/tv-animacoes.js', (s) => tr(s,
  "    return larga ? m.replace('class=\"ln' + cls + '\"', 'class=\"ln' + cls + ' w\"') : m;",
  "    const extra = (/^VENDEDOR$/i.test(lab) ? ' vend' : '') + (larga ? ' w' : ''); // VENDEDOR vira o 2o destaque (nome grande logo abaixo dos pontos)\n    return extra ? m.replace('class=\"ln' + cls + '\"', 'class=\"ln' + cls + extra + '\"') : m;", 'compacta'));

const CSS =
"#ov .dec .ln.hot+.ln.hot,#ov .dec .ln.hot:has(+.ln.hot){grid-column:1/-1}\n" +
"/* VENDEDOR em destaque (Vitório, 06/10/2026: \"tem que aumentar o tamanho do nome\"): sobe logo abaixo dos pontos, em linha inteira e com nome grande */\n" +
"#ov .dec>h1{order:-4}#ov .dec>.selo{order:-3}#ov .dec>.vd{order:99}\n" +
"#ov .dec>.ln.vend{order:-2;grid-column:1/-1;background:none;border:0;border-left:6px solid var(--tom);border-radius:0;padding:.2vh 1.2vw}\n" +
"#ov .dec>.ln.vend>span{font-size:clamp(26px,min(2.8vw,5.2vh),58px);font-weight:900;color:#fff;line-height:1.05}\n";
for (const rel of ['public/tvapp.html', 'public/matrizapp.html']) {
  ed(rel, (s) => tr(s, '#ov .dec .ln.hot+.ln.hot,#ov .dec .ln.hot:has(+.ln.hot){grid-column:1/-1}\n', CSS, rel + ' css'));
}
console.log('tudo ok');
