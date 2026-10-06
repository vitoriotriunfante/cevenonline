const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };
// Penalti: o ESTABELECIMENTO e o destaque (valor grande); motivo e dias sem compra viram o rotulo pequeno
ed('public/tvapp.html', (s) => tr(s,
  "`<div class=\"ln hot\"><b>${esc(a.c.nome)}</b><span>${esc(a.c.motivo)} · ${a.dias != null ? a.dias + 'd s/ compra' : 'sem compra'}${a.c.tempo_visita === '00:00' ? ' · visita de 0 min' : ''}</span></div>`",
  "`<div class=\"ln hot w\"><b>${esc(a.c.motivo)} · ${a.dias != null ? a.dias + ' dias sem compra' : 'sem compra'}${a.c.tempo_visita === '00:00' ? ' · visita de 0 min' : ''}</b><span>${esc(a.c.nome)}</span></div>`", 'tv'));
ed('public/matrizapp.html', (s) => tr(s,
  "`<div class=\"ln hot\"><b>${esc(a.c ? a.c.nome : '')}</b><span>${esc(a.c ? a.c.motivo : '')} · ${a.dias != null ? a.dias + 'd s/ compra' : 'sem compra'}</span></div>`",
  "`<div class=\"ln hot w\"><b>${esc(a.c ? a.c.motivo : '')} · ${a.dias != null ? a.dias + ' dias sem compra' : 'sem compra'}</b><span>${esc(a.c ? a.c.nome : '')}</span></div>`", 'mz'));
console.log('tudo ok');
