const fs = require('fs');
const rel = 'functions/api/cron-lances.js';
let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); s = s.replace(de, () => para); };
tr("  // AUDITORIA LANCE POR LANCE (Vitório, 06/10/2026)",
"  // NOTIFICACOES DE LANCES PARA OS SUPERVISORES (Vitório, 06/10/2026): a cada hora cheia (09h a 20h) uma notificacao por supervisor no sino do CEVEN. Desligado por padrao (config_flags).\n" +
"  let notifSup = 'pulado';\n" +
"  if (t.h >= 9 && t.h <= 20 && t.m < 5) {\n" +
"    try { const rn = await fetch(`${origin}/api/cron-notificacoes-supervisores?rodar=1`, { signal: AbortSignal.timeout(60000) }); const jn = await rn.json().catch(() => ({})); notifSup = jn.status ? jn.status + (jn.notificacoes != null ? ` (${jn.ok}/${jn.notificacoes})` : '') : String(rn.status); } catch { notifSup = 'falhou'; }\n" +
"  }\n\n" +
"  // AUDITORIA LANCE POR LANCE (Vitório, 06/10/2026)", 'hook');
tr("semana_invicta: invicta, arvore, auditoria,", "semana_invicta: invicta, arvore, notifSup, auditoria,", 'saida');
fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
