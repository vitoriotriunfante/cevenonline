const fs = require('fs');
const rel = 'public/matrizapp.html';
let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); s = s.replace(de, () => para); };
tr("const topo = '<div style=\"position:sticky;top:26px;z-index:6;background:var(--card);padding-bottom:6px;border-bottom:1px solid var(--line);max-height:44vh;overflow:auto\">' +", "const topo = '<div class=\"sup-col sup-sem\">' +", 'topo');
tr("controles + topo + cards;", "controles + '<div class=\"supsplit\">' + topo + '<div class=\"sup-col sup-cards\">' + cards + '</div></div>';", 'html');
tr("</style>", "/* Supervisores: tela DIVIDIDA (Vitório, 06/10/2026: o painel \"fez = matinal + rota\" sumia). Esquerda = painel da semana; direita = cards. Cada lado rola sozinho. */\n.supsplit{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;flex:1 1 auto;min-height:0;align-items:stretch}\n.sup-col{min-height:0;min-width:0;overflow-y:auto;scrollbar-width:thin;padding-right:4px}\n.sup-sem{border-right:1px solid var(--line);padding-right:12px}\n@media (max-width:1100px){.supsplit{display:flex;flex-direction:column}.sup-col{overflow:visible}.sup-sem{border-right:0;border-bottom:1px solid var(--line);padding-bottom:8px}}\n</style>", 'css');
fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
