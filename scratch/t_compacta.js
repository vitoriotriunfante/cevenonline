const fs = require('fs'); const vm = require('vm');
global.window = global; global.document = { createElement: () => ({}), head: { appendChild() {} } };
const src = fs.readFileSync('c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/public/animacoes/tv-animacoes.js', 'utf8');
const i = src.indexOf('window.compactaDecHtml');
vm.runInThisContext(src.slice(i));
const dec = '<div class="ln hot"><b>FILIAL</b><span>TPH</span></div><div class="ln hot"><b>VENDEDOR</b><span>GIULIA (RCA 105)</span></div><div class="ln"><b>LANCE</b><span>X</span></div><div class="ln"><b>CHECK-IN</b><span>08:40</span></div><div class="ln"><b>SUPERVISOR</b><span>PRISCILA A D NASCIMENTO STRAPASSON LONGO</span></div>';
const out = compactaDecHtml(dec);
console.log((out.match(/class="ln[^"]* w"/g) || []).length, 'largas de 5 (esperado 2: LANCE e supervisor longo)');
