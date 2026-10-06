const fs = require('fs');
const vm = require('vm');
for (const f of ['public/matrizapp.html', 'public/tvapp.html', 'public/animacoes/tv-animacoes.js']) {
  const s = fs.readFileSync('c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/' + f, 'utf8');
  const blocos = f.endsWith('.js') ? [s] : [...s.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  blocos.forEach((b, i) => { try { new vm.Script(b); console.log('ok', f, i); } catch (e) { console.log('ERRO', f, i, e.message); } });
}
// render do modulo com dados falsos
global.document = { createElement: () => ({}), head: { appendChild() {} } };
global.window = global;
new vm.Script(fs.readFileSync('c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/scratch/sup_modulo.js', 'utf8')).runInThisContext();
const sem = { hoje: '2026-10-06', dias: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'] };
const dia = (data, estado, comp, ret) => ({ data, estado, comp, ret });
const lista = [{ nome: 'RUDINEI', dias: [dia('2026-10-05', 'passado', true, true), dia('2026-10-06', 'passado', false, false), dia('2026-10-07', 'futuro', null, null), dia('2026-10-08', 'futuro', null, null), dia('2026-10-09', 'futuro', null, null)] },
  { nome: 'MARIA', dias: [dia('2026-10-05', 'passado', true, false), dia('2026-10-06', 'passado', true, true), dia('2026-10-07', 'futuro', null, null), dia('2026-10-08', 'futuro', null, null), dia('2026-10-09', 'futuro', null, null)] }];
const h = supSemanaHtml(lista, sem);
console.log(/FEZ/.test(h), /PENDENTE/.test(h), /PARCIAL/.test(h), /1\/1/.test(h), /0\/1/.test(h) === false ? 'sem 0/1' : '0/1');
console.log(supCardsHtml([{ nome: 'ANA', fez_compromisso: true, iniciou_ret: true, retDetalhe: { pdvs: 3, scoreMedio: 80, fotos: [{ url: 'https://x/y.jpg', cliente: 'C', score: 90 }] } }]).includes('<img'));
