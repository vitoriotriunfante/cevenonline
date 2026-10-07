const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

// Os ganchos dependiam do minuto exato do coletor (t.m < 5) e NAO rodaram (06/10 19h: nenhuma notificacao e nenhuma auditoria automatica). Agora o proprio endpoint decide pelo relogio.
ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "  if (t.h >= 9 && t.h <= 20 && t.m < 5) {\n    try { const rn", "  if (t.h >= 9 && t.h <= 20) { // o endpoint decide: 1 envio por hora cheia (nao depende do minuto exato do coletor)\n    try { const rn", 'notif');
  s = tr(s, "  if (t.h >= 8 && (t.m % 30) < 5) {\n    try { const ra = await fetch(`${origin}/api/cron-auditoria-lances?rodar=1`", "  if (t.h >= 8) { // o endpoint pula se a ultima auditoria tem menos de 25 min\n    try { const ra = await fetch(`${origin}/api/cron-auditoria-lances?rodar=1&se_velho=1`", 'audit');
  return s;
});
ed('functions/api/cron-notificacoes-supervisores.js', (s) => {
  s = tr(s, "      if (t.h < 9 || t.min > 20 * 60) return resp({ status: 'FORA_DO_HORARIO', motivo: 'so de 09h as 20h' });\n      const ult = await flag('notif_supervisores_ultimo');\n      if (ult && ult.startsWith(t.dia) && secDe(hms()) - secDe(ult.slice(11, 19)) < 55 * 60) return resp({ status: 'AGUARDANDO', motivo: 'ultimo envio ha menos de 55 min', ultimo: ult });",
    "      if (t.h < 9 || t.min > 20 * 60 + 59) return resp({ status: 'FORA_DO_HORARIO', motivo: 'so de 09h as 20h59' });\n      const ult = await flag('notif_supervisores_ultimo');\n      // UM envio por hora cheia: se o ultimo foi nesta mesma hora do relogio, espera a proxima hora\n      if (ult && ult.startsWith(t.dia) && ult.slice(11, 13) === String(t.h).padStart(2, '0')) return resp({ status: 'AGUARDANDO', motivo: 'ja enviou nesta hora; o proximo envio e na proxima hora cheia', ultimo: ult });", 'hora');
  return s;
});
ed('functions/api/cron-auditoria-lances.js', (s) => {
  s = tr(s, "    if (u.searchParams.get('rodar') === '1') {\n", "    let pular = false;\n    if (u.searchParams.get('rodar') === '1' && u.searchParams.get('se_velho') === '1') {\n      const rec = await env.DB.prepare(\"SELECT dia FROM auditoria_lance_resumo WHERE dia = ? AND em > datetime('now', '-25 minutes')\").bind(dia).first();\n      pular = !!rec;\n    }\n    if (u.searchParams.get('rodar') === '1' && !pular) {\n", 'velho');
  return s;
});
ed('testes/t_notif_supervisores.mjs', (s) => {
  s = tr(s, "ep.includes('55 * 60') && ", "ep.includes('ult.slice(11, 13)') && ", 'a');
  s = tr(s, "ok(ep.includes(\"'notif_supervisores')) !== '1'\")", "ok(ep.includes(\"'notif_supervisores')) !== '1'\")", 'b');
  s = tr(s, "cl.includes('t.h >= 9 && t.h <= 20 && t.m < 5')", "cl.includes('t.h >= 9 && t.h <= 20)') && cl.includes('se_velho=1')", 'c');
  s = tr(s, "no maximo 1 envio por hora,", "um envio por hora cheia (nao depende do minuto exato do coletor),", 'd');
  return s;
});
console.log('tudo ok');
