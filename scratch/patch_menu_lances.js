const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

const CSS = "\n/* Testes de animação dentro de um menu (Vitório, 06/10/2026: a fileira de botões embaixo ficou horrível) */\n" +
  "#mtest{display:none;position:fixed;right:12px;bottom:calc(var(--rodape-h,64px) + 8px);z-index:60;background:#0f1a33;border:1px solid #2b3a63;border-radius:12px;padding:10px;gap:6px;flex-wrap:wrap;max-width:min(520px,92vw);box-shadow:0 10px 30px rgba(0,0,0,.5)}\n" +
  "#mtest.on{display:flex}#mtest button{flex:1 1 140px}\n";

for (const rel of ['public/tvapp.html', 'public/matrizapp.html']) {
  ed(rel, (s) => {
    s = tr(s, '    <button id="bt-gol" ', '    <button id="bmenu" style="background:#1e293b;color:#e2e8f0;font-weight:700" title="Testar as animações dos lances">🎬 Lances ▾</button>\n    <div id="mtest">\n    <button id="bt-gol" ', 'ini');
    s = tr(s, 'title="Testar animação de Semana Invicta">👑 Invicta</button>\n', 'title="Testar animação de Semana Invicta">👑 Invicta</button>\n    </div>\n', 'fim');
    s = tr(s, '<script>\n\'use strict\';', '<script>\n\'use strict\';\n(function () { const b = document.getElementById(\'bmenu\'), m = document.getElementById(\'mtest\'); if (!b || !m) return; b.addEventListener(\'click\', (e) => { e.stopPropagation(); m.classList.toggle(\'on\'); }); document.addEventListener(\'click\', (e) => { if (!m.contains(e.target)) m.classList.remove(\'on\'); }); })();', 'js');
    s = tr(s, '</style>', CSS + '</style>', 'css');
    return s;
  });
}
// Fair Play sai do título das telas
ed('public/matrizapp.html', (s) => {
  s = s.split('Desempenho & Fair Play').join('Desempenho');
  s = s.split('Score & Fair Play').join('Score');
  return s;
});
// Pedido Feito na Rota tambem qualificado
ed('functions/api/cron-lances.js', (s) => tr(s, "out.push({ chave: `pedido_rota|${v.id}|${c.id}`, nivel: 'pedido_rota', v, c });", "out.push({ chave: `pedido_rota|${v.id}|${c.id}`, nivel: 'pedido_rota', v, c, prova: [provaPedidoHoje(c), (qualificaGol(v.carteira, c) || {}).texto].filter(Boolean).join(' | ') });", 'rota'));
console.log('tudo ok');
