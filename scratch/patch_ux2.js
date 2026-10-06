const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };
const trasAlturaTv = [
  ['font-size:clamp(70px,9.5vw,190px)', 'font-size:clamp(64px,min(8vw,15vh),170px)'],
  ['font-size:clamp(32px,3.9vw,76px)', 'font-size:clamp(28px,min(3.5vw,6.6vh),70px)'],
  ['font-size:clamp(22px,1.95vw,40px)', 'font-size:clamp(18px,min(1.7vw,3.1vh),36px)'],
  ['font-size:clamp(14px,1.05vw,21px)', 'font-size:clamp(12px,min(.95vw,1.8vh),19px)'],
  ['font-size:clamp(30px,3vw,60px)', 'font-size:clamp(26px,min(2.6vw,4.9vh),54px)'],
  ['font-size:clamp(24px,2.5vw,48px)', 'font-size:clamp(20px,min(2.1vw,4vh),42px)'],
  ['width:min(1640px,94vw);max-height:94vh;overflow:hidden;', 'width:min(1640px,94vw);max-height:94vh;overflow:auto;scrollbar-width:none;'],
  ['#ov .dec .ln span{display:block;', '#ov .dec .ln>span{display:block;']
];
for (const rel of ['public/tvapp.html', 'public/matrizapp.html']) {
  ed(rel, (s) => {
    for (const [de, para] of trasAlturaTv) s = tr(s, de, para, rel + ' ' + de);
    // o RCA (span dentro do span do valor) fica pequeno e na mesma linha do nome
    s = tr(s, '#ov .dec .ln b{', '#ov .dec .ln span span{display:inline;font-size:.5em;font-weight:600;opacity:.75}\n#ov .dec .ln b{', rel + ' rca');
    return s;
  });
}
// amarelos: tambem com o selo (heroi "-3")
ed('public/tvapp.html', (s) => tr(s, "dec = item.l.slice(0, 8).map(a => `<div class=\"ln hot\"><b>${nomeComRca(a.v)}</b><span>${a.txt ? esc(a.txt) : (a.subtipo === 'sem_checkin'", "dec = seloLiga + item.l.slice(0, 8).map(a => `<div class=\"ln hot\"><b>${nomeComRca(a.v)}</b><span>${a.txt ? esc(a.txt) : (a.subtipo === 'sem_checkin'", 'tv selo amarelos'));
ed('public/matrizapp.html', (s) => tr(s, "dec = (item.l || []).slice(0, 8).map(a => `<div class=\"ln hot\"><b>${nomeComRca(a.v)}</b><span>${a.txt ? esc(a.txt) : (a.subtipo === 'sem_checkin'", "dec = seloLiga + (item.l || []).slice(0, 8).map(a => `<div class=\"ln hot\"><b>${nomeComRca(a.v)}</b><span>${a.txt ? esc(a.txt) : (a.subtipo === 'sem_checkin'", 'mz selo amarelos'));
console.log('tudo ok');
