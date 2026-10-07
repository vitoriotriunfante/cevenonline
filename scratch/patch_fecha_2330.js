const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

// O dia fecha as 23h30 (nao 19h30): vendedor que sincroniza o aparelho no fim da tarde/noite (caso da Tania, 18h30) ainda tem os lances do dia contados. Vitório, 07/10/2026.
ed('functions/_lib/liga_fechamento.js', (s) => {
  s = tr(s, "t.min >= 19 * 60 + 30))) return { dia, status: 'AINDA_ABERTO', motivo: 'o dia só fecha depois das 19h30' };", "t.min >= 23 * 60 + 30))) return { dia, status: 'AINDA_ABERTO', motivo: 'o dia só fecha depois das 23h30 (vendedor que sincroniza o aparelho tarde ainda conta)' };", 'min');
  s = s.split('Depois das 19h30 (ou em qualquer dia anterior)').join('Depois das 23h30 (ou em qualquer dia anterior)');
  s = s.split('se já são 19h30 de hoje').join('se já são 23h30 de hoje');
  return s;
});
ed('functions/api/cron-fechamento-dia.js', (s) => {
  s = s.split('depois das 19h30').join('depois das 23h30').split('ja passou das 19h30').join('ja passou das 23h30');
  return s;
});
ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "  if (t.agoraMin >= 19 * 60 + 30) {\n    try { const rf = await fetch(`${origin}/api/cron-fechamento-dia`, { signal: AbortSignal.timeout(50000) }); const jf = await rf.json().catch(() => ({})); fechamento = jf.status || String(rf.status); } catch { fechamento = 'falhou'; }\n",
    "  // o dia fecha as 23h30; se esse horario passar em claro, o fechamento pega de manha (06h as 09h) o dia anterior ainda aberto\n  if (t.agoraMin >= 23 * 60 + 30 || (t.h >= 6 && t.h < 9)) {\n    try { const rf = await fetch(`${origin}/api/cron-fechamento-dia`, { signal: AbortSignal.timeout(50000) }); const jf = await rf.json().catch(() => ({})); fechamento = jf.status || String(rf.status); } catch { fechamento = 'falhou'; }\n  }\n  if (t.agoraMin >= 19 * 60 + 30) {\n", 'hook');
  return s;
});
ed('testes/rodar_testes.mjs', (s) => {
  s = tr(s, "ok(lib.includes('19 * 60 + 30') && lib.includes('INSERT OR IGNORE INTO liga_fechamento')", "ok(lib.includes('23 * 60 + 30') && lib.includes('INSERT OR IGNORE INTO liga_fechamento')", 'a');
  s = tr(s, "cr.includes('t.agoraMin >= 19 * 60 + 30'), 'coletor chama o fechamento e a conferencia depois das 19h30'", "cr.includes('t.agoraMin >= 23 * 60 + 30') && cr.includes('t.agoraMin >= 19 * 60 + 30'), 'coletor chama o fechamento depois das 23h30 (e pela manha, se perdeu) e a conferencia depois das 19h30'", 'b');
  s = s.split("fechamento: so depois das 19h30,").join("fechamento: so depois das 23h30,");
  return s;
});
ed('testes/t_fechamento.mjs', (s) => {
  s = tr(s, "min >= 19 * 60 + 30 ? ['FECHADO', 'JA_FECHADO'].includes(r3.status) : r3.status === 'AINDA_ABERTO', 'hoje antes das 19h30 o dia nao fecha'", "min >= 23 * 60 + 30 ? ['FECHADO', 'JA_FECHADO'].includes(r3.status) : r3.status === 'AINDA_ABERTO', 'hoje antes das 23h30 o dia nao fecha'", 'c');
  return s;
});
console.log('tudo ok');
