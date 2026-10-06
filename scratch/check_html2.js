const fs = require('fs'); const vm = require('vm');
for (const f of ['public/matrizapp.html', 'public/tvapp.html', 'public/brasileirao.html', 'public/animacoes/tv-animacoes.js']) {
  const s = fs.readFileSync('c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/' + f, 'utf8');
  const blocos = f.endsWith('.js') ? [s] : [...s.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  blocos.forEach((b, i) => { try { new vm.Script(b); console.log('ok', f, i); } catch (e) { console.log('ERRO', f, i, e.message); } });
}
