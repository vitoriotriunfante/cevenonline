const fs = require('fs');
const p = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/public/tvapp.html';
let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); s = s.replace(de, () => para); };
tr("  el.innerHTML = `<h2><span>Supervisores · matinal (compromisso) e rota (RET)</span><b>${supPend().length} pendente(s) de ${lista.length}</b></h2>` +\n    ord.map(",
   "  // painel gerencial da semana no TOPO, fixo (sticky) enquanto os cards rolam por baixo (Vitório, 06/10/2026)\n  const topoSem = `<div style=\"position:sticky;top:26px;z-index:6;background:var(--card);padding-bottom:6px;border-bottom:1px solid var(--line);max-height:44vh;overflow:auto\"><h2 style=\"margin:4px 0 2px\"><span>Painel gerencial da semana</span><b>fez = matinal + rota</b></h2>${supSemanaHtml(SEM && SEM.filiais && SEM.filiais[FIL], SEM)}</div>`;\n  el.innerHTML = `<h2><span>Supervisores · matinal (compromisso) e rota (RET)</span><b>${supPend().length} pendente(s) de ${lista.length}</b></h2>` + topoSem +\n    ord.map(", 'topo');
tr("    }).join('') + `<h2 style=\"margin-top:10px\"><span>Painel gerencial da semana</span><b>fez = matinal + rota</b></h2>` + supSemanaHtml(SEM && SEM.filiais && SEM.filiais[FIL], SEM);\n}", "    }).join('');\n}", 'fim');
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
