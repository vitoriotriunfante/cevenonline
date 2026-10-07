const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

// POR QUE E PENALTI em destaque (Vitório, 07/10/2026: "tem que dar um destaque no pq é penalti... aqui o B.O. é que o cara encerrou as atividades, mas quase não dá pra ler")
const FN = "const porqueHtml = (itens) => { const g = new Map(); itens.forEach((a) => { const m = String((a.c && a.c.motivo) || '').toUpperCase() || 'SEM JUSTIFICATIVA'; if (!g.has(m)) g.set(m, []); g.get(m).push(a); });\n" +
"  return [...g.entries()].map(([m, l]) => { const ds = l.map((a) => a.dias).filter((d) => d != null); const lo = ds.length ? Math.min(...ds) : null, hi = ds.length ? Math.max(...ds) : null; const par = l.length === 1 ? (lo != null ? 'cliente parado há ' + lo + ' dias' : 'cliente sem compra registrada') : l.length + ' clientes parados' + (lo != null ? ' (' + (lo === hi ? lo : lo + ' a ' + hi) + ' dias)' : ''); return `<div class=\"ln hot why\"><b>POR QUE É PÊNALTI</b><span>${esc(m)}<small> · ${esc(par)}</small></span></div>`; }).join(''); };\n";
const CSS = "#ov .dec>.ln.why{order:-1;grid-column:1/-1;background:var(--tomf);border:0;border-left:8px solid var(--tom);border-radius:12px;padding:1.2vh 1.4vw}\n" +
"#ov .dec>.ln.why>b{font-size:clamp(14px,min(1.1vw,2.1vh),22px);letter-spacing:.16em;color:var(--tom)}\n" +
"#ov .dec>.ln.why>span{font-size:clamp(30px,min(3.4vw,6.4vh),70px);font-weight:900;color:#fff;line-height:1.05}\n" +
"#ov .dec>.ln.why>span small{font-size:.42em;font-weight:700;color:var(--mut2)}\n";

ed('public/tvapp.html', (s) => {
  s = tr(s, "      dec = seloLiga + linhas({...cab, 'Cliente': c.nome, 'Justificativa': '!' + c.motivo, 'Sem comprar':", "      dec = seloLiga + porqueHtml(it) + linhas({...cab, 'Cliente': c.nome, 'Sem comprar':", 'single');
  s = tr(s, "      dec = seloLiga + linhas(cab) + it.slice(0, 5).map(a => `<div class=\"ln hot w est\"><b>${esc(a.c.motivo)} · ${a.dias != null ? a.dias + ' dias sem compra' : 'sem compra'}${a.c.tempo_visita === '00:00' ? ' · visita de 0 min' : ''}</b><span>${esc(a.c.nome)}</span></div>`).join('')",
    "      dec = seloLiga + porqueHtml(it) + linhas(cab) + it.slice(0, 5).map(a => `<div class=\"ln w est\"><b>${a.dias != null ? a.dias + ' dias sem compra' : 'sem compra'}${a.c.tempo_visita === '00:00' ? ' · visita de 0 min' : ''}</b><span>${esc(a.c.nome)}</span></div>`).join('')", 'multi');
  s = tr(s, "const INVICTA_AVISADA = new Set();\n", "const INVICTA_AVISADA = new Set();\n" + FN, 'fn');
  s = tr(s, "#ov .dec>.ln.est>span{font-size:clamp(24px,min(2.5vw,4.6vh),50px);font-weight:900;color:#fff;line-height:1.08}", "#ov .dec>.ln.est>span{font-size:clamp(20px,min(2vw,3.8vh),42px);font-weight:900;color:#fff;line-height:1.08}\n" + CSS.trimEnd(), 'css');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = tr(s, "dec = seloLiga + linhas({...cab, 'Cliente': c ? c.nome : '—', 'Justificativa': '!' + (c ? c.motivo : ''), 'Sem comprar':", "dec = seloLiga + porqueHtml(it) + linhas({...cab, 'Cliente': c ? c.nome : '—', 'Sem comprar':", 'single');
  s = tr(s, "    else dec = seloLiga + linhas(cab) + it.slice(0, 5).map(a => `<div class=\"ln hot w est\"><b>${esc(a.c ? a.c.motivo : '')} · ${a.dias != null ? a.dias + ' dias sem compra' : 'sem compra'}</b><span>${esc(a.c ? a.c.nome : '')}</span></div>`).join('');",
    "    else dec = seloLiga + porqueHtml(it) + linhas(cab) + it.slice(0, 5).map(a => `<div class=\"ln w est\"><b>${a.dias != null ? a.dias + ' dias sem compra' : 'sem compra'}</b><span>${esc(a.c ? a.c.nome : '')}</span></div>`).join('');", 'multi');
  s = tr(s, "const INVICTA_AVISADA = new Set();\n", "const INVICTA_AVISADA = new Set();\n" + FN, 'fn');
  s = tr(s, "#ov .dec>.ln.est>span{font-size:clamp(24px,min(2.5vw,4.6vh),50px);font-weight:900;color:#fff;line-height:1.08}", "#ov .dec>.ln.est>span{font-size:clamp(20px,min(2vw,3.8vh),42px);font-weight:900;color:#fff;line-height:1.08}\n" + CSS.trimEnd(), 'css');
  return s;
});

// FECHAMENTO AS 22H (Vitório: "as 23:30 ja vai ter virado o CEVEN"); a conferencia roda logo depois (22h05)
ed('functions/_lib/liga_fechamento.js', (s) => {
  s = tr(s, "t.min >= 23 * 60 + 30))) return { dia, status: 'AINDA_ABERTO', motivo: 'o dia só fecha depois das 23h30 (vendedor que sincroniza o aparelho tarde ainda conta)' };", "t.min >= 22 * 60))) return { dia, status: 'AINDA_ABERTO', motivo: 'o dia só fecha depois das 22h (vendedor que sincroniza o aparelho tarde ainda conta; depois das 23h o CEVEN já virou o dia)' };", 'min');
  s = s.split('Depois das 23h30 (ou em qualquer dia anterior)').join('Depois das 22h (ou em qualquer dia anterior)').split('se já são 23h30 de hoje').join('se já são 22h de hoje');
  return s;
});
ed('functions/api/cron-fechamento-dia.js', (s) => s.split('depois das 23h30').join('depois das 22h').split('ja passou das 23h30').join('ja passou das 22h'));
ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "  // o dia fecha as 23h30; se esse horario passar em claro, o fechamento pega de manha (06h as 09h) o dia anterior ainda aberto\n  if (t.agoraMin >= 23 * 60 + 30 || (t.h >= 6 && t.h < 9)) {", "  // o dia fecha as 22h (depois das 23h o CEVEN ja virou o dia); se esse horario passar em claro, o fechamento pega de manha (06h as 09h) o dia anterior ainda aberto\n  if (t.agoraMin >= 22 * 60 || (t.h >= 6 && t.h < 9)) {", 'hook');
  s = tr(s, "  if (t.agoraMin >= 19 * 60 + 30) {\n    try { const rc", "  if (t.agoraMin >= 22 * 60 + 5) { // a conferencia roda depois do fechamento, antes do CEVEN virar o dia\n    try { const rc", 'conf');
  return s;
});
ed('functions/api/cron-conferencia-dia.js', (s) => s.replace("t.min >= 19 * 60 + 30)) aviso = 'a conferencia so roda depois das 19h30'", "t.min >= 22 * 60 + 5)) aviso = 'a conferencia so roda depois das 22h05'"));
ed('public/divergencias.html', (s) => s.split('a conferência começa às 19h30').join('a conferência começa às 22h05').split('roda sozinha depois das 19h30').join('roda sozinha depois das 22h05'));
ed('testes/rodar_testes.mjs', (s) => {
  s = s.replace("lib.includes('23 * 60 + 30') && lib.includes('INSERT OR IGNORE INTO liga_fechamento')", "lib.includes('t.min >= 22 * 60') && lib.includes('INSERT OR IGNORE INTO liga_fechamento')");
  s = s.replace("cr.includes('t.agoraMin >= 23 * 60 + 30') && cr.includes('t.agoraMin >= 19 * 60 + 30'), 'coletor chama o fechamento depois das 23h30 (e pela manha, se perdeu) e a conferencia depois das 19h30'", "cr.includes('t.agoraMin >= 22 * 60 ||') && cr.includes('t.agoraMin >= 22 * 60 + 5'), 'coletor chama o fechamento depois das 22h (e pela manha, se perdeu) e a conferencia depois das 22h05'");
  s = s.split('fechamento: so depois das 23h30,').join('fechamento: so depois das 22h,');
  return s;
});
ed('testes/t_fechamento.mjs', (s) => s.replace("min >= 23 * 60 + 30 ?", "min >= 22 * 60 ?").replace('hoje antes das 23h30 o dia nao fecha', 'hoje antes das 22h o dia nao fecha'));
console.log('tudo ok');
