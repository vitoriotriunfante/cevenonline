const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };
function ajusta(s, nomeSet, fn) {
  return tr(s,
    "novos = cands.filter(a => " + nomeSet + ".has(a.key) || RECENTES.has(a.key)); novos.forEach(",
    "novos = cands.filter(a => " + nomeSet + ".has(a.key)); if (!baseline && cands.length > novos.length) await " + fn + "(); /* tela ligada ha horas: o coletor ja gravou o lance, entao busca a lista do servidor ANTES de dar o lance como visto */ novos = cands.filter(a => " + nomeSet + ".has(a.key) || RECENTES.has(a.key)); novos.forEach(", 'ajusta');
}
ed('public/tvapp.html', (s) => ajusta(s, 'set', 'carregaLancesServidor'));
ed('public/matrizapp.html', (s) => ajusta(s, 'st', 'carregaLances'));
