const fs = require('fs');
const p = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/public/brasileirao.html';
let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const de = "// Atualiza sozinha quando sai uma versao nova do site (mesma regra das TVs)";
if (s.split(de).length !== 2) throw new Error('anc');
s = s.replace(de, () => "// Abre direto numa aba pelo endereco: /brasileirao#vendedores, #lances, #gabarito, #supervisores, #gerencias, #regulamento\nwindow.addEventListener('load', function () { var h = location.hash.replace('#', ''); if (['filiais', 'gerencias', 'supervisores', 'vendedores', 'lances', 'gabarito', 'regulamento'].indexOf(h) >= 0 && typeof switchTab === 'function') setTimeout(function () { switchTab(h); }, 600); });\n" + de);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
