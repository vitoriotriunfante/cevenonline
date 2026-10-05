const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };
ed('worker-cron/src/index.js', (s) => {
  s = tr(s, "const REPO = 'vitoriotriunfante/cevenonline';", "import { vigiarDisparos } from './vigia.js';\nconst REPO = 'vitoriotriunfante/cevenonline';", 'imp');
  s = tr(s, "    const tarefaTv = TAREFAS_TV[event.cron];\n    if (tarefaTv) {\n",
    "    const tarefaTv = TAREFAS_TV[event.cron];\n    if (tarefaTv) {\n      // VIGIA dos disparos de WhatsApp (05/10/2026): a cada 2 min confere se o disparo oficial do horario comecou; se nao, refaz 1 vez (ver vigia.js)\n      if (event.cron === '*/2 * * * *') {\n        try { for (const l of await vigiarDisparos(env)) console.log('[VIGIA] ' + l); } catch (e) { console.log('[VIGIA][ERRO] ' + (e && e.message ? e.message : e)); }\n      }\n", 'sched');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = tr(s, '  <span id="aviso" class="modo"', '  <span id="faixa-disparo" class="modo" style="display:none;background:#b91c1c;color:#fff;font-weight:800"></span>\n  <span id="aviso" class="modo"', 'span');
  s = tr(s, 'setInterval(autoScrollPaineis, 80);', `// Faixa vermelha: disparo oficial de WhatsApp que nao saiu (05/10/2026: o das 17h nao saiu e ninguem foi avisado)
async function checaDisparos() {
  const el = $('faixa-disparo'); if (!el) return;
  try {
    const j = await (await fetch('/api/disparo-status?t=' + Date.now(), {cache: 'no-store'})).json();
    const p = (j && j.problemas) || [];
    el.style.display = p.length ? '' : 'none';
    el.textContent = p.length ? '⚠ ' + p.map(x => x.texto).join(' · ') : '';
  } catch { el.style.display = 'none'; }
}
checaDisparos(); setInterval(checaDisparos, 5 * 60 * 1000);
setInterval(autoScrollPaineis, 80);`, 'js');
  return s;
});
