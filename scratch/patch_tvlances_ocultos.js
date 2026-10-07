const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

ed('functions/api/tv-lances.js', (s) => {
  s = "import { ocultosDaEquipe, lanceDeOculto } from '../_lib/equipe_ocultos.js';\n" + s;
  s = tr(s, "    const limpos = (results || []).filter((r) => String(r.hora_sp || '') >= '06:00:00' &&",
    "    const oc = await ocultosDaEquipe(new URL(request.url).origin);\n    const limpos = (results || []).filter((r) => !lanceDeOculto({ ...r, filial }, oc) && String(r.hora_sp || '') >= '06:00:00' &&", 'get');
  s = tr(s, "    const validos = lances.filter((l) => l && typeof l.chave === 'string' &&",
    "    const ocP = await ocultosDaEquipe(new URL(request.url).origin); // vendedor OCULTO na Gestao de Equipe nao gera lance\n    const validos = lances.filter((l) => l && !lanceDeOculto({ ...l, filial }, ocP) && typeof l.chave === 'string' &&", 'post');
  return s;
});

// ===== Matriz: o navegador tambem nao pode criar alerta de vendedor oculto =====
ed('public/matrizapp.html', (s) => {
  s = tr(s, "  for (const sig of ORDEM) for (const v of vendedores(sig)) {\n    if (!v.cl) continue;\n",
    "  const ocultosMz = new Set(); Object.keys(MOSTRA || {}).forEach(k => (MOSTRA[k] || []).forEach(r => { if (r.mostra === false) ocultosMz.add(k.split('_')[0] + '|' + r.rca); }));\n  for (const sig of ORDEM) for (const v of vendedores(sig)) {\n    if (!v.cl) continue;\n    if (ocultosMz.has(sig + '|' + v.id)) continue; // oculto na Gestao de Equipe (afastado, ferias, teste): nao gera lance (Vitório, 07/10/2026)\n", 'oculto');
  return s;
});
console.log('tudo ok');
