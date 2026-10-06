const fs = require('fs');
const p = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/public/brasileirao.html';
let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); s = s.replace(de, () => para); };
tr('.tb-league tbody tr { transition: background 0.15s; }',
`/* Gabarito e Lances do Dia: texto longo quebra linha em vez de ser cortado na lateral (Vitório, 06/10/2026) */
#tab-gabarito .tb-league { table-layout: fixed; }
#tab-gabarito .tb-league td { white-space: normal; word-break: break-word; padding: 9px 14px; }
#tab-lances .tb-league td:nth-child(n+4) { white-space: normal; word-break: break-word; }
#tab-lances .tb-league td { padding: 10px 12px; }
.tb-league tbody tr { transition: background 0.15s; }`, 'css');
tr('<thead><tr><th>Lance (regra oficial)</th>', '<thead><tr><th style="width:25%">Lance (regra oficial)</th>', 'th');
tr('      <a href="/matriz" class="btn-nav">📺 TV Matriz</a>', '      <a href="/matriz" class="btn-nav">📺 TV Matriz</a>\n      <a href="/supervisores" class="btn-nav" target="_blank" rel="noopener">👔 Supervisores</a>', 'nav');
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
