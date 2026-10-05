const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

ed('functions/_lib/qualificacao_gol.js', (s) => s + `
// Carteira AUTO (TSJ): vendedor com MAIS de 90% do valor dos pedidos de hoje em Mondelez conta como carteira so Mondelez (Vitorio, 05/10/2026).
export function carteiraEfetiva(carteira, clientes) {
  const c0 = String(carteira || '').toUpperCase();
  if (c0 !== 'AUTO') return c0;
  let mond = 0, total = 0;
  for (const c of Array.isArray(clientes) ? clientes : []) for (const x of (c && c.industrias) || []) { total += Number(x.v) || 0; if (x.n === 'MONDELEZ BRASIL') mond += Number(x.v) || 0; }
  return total > 0 && mond / total > 0.9 ? 'MONDELEZ' : '';
}
`);
ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "import { qualificaGol } from", "import { qualificaGol, carteiraEfetiva } from", 'imp');
  s = tr(s, "carteira: carteira || '', campo, cl,", "carteira: carteiraEfetiva(carteira, cl), campo, cl,", 'vend');
  return s;
});
ed('public/animacoes/tv-animacoes.js', (s) => {
  s = tr(s, "window.qualificaGolUI = function (carteira, c) {\n  const so = String(carteira || '').toUpperCase() === 'MONDELEZ';",
    "// carteira AUTO (TSJ): mais de 90% do valor dos pedidos de hoje em Mondelez = carteira so Mondelez\nwindow.carteiraEfetivaUI = function (v) {\n  const c0 = String((v && v.carteira) || '').toUpperCase();\n  if (c0 !== 'AUTO') return c0;\n  let mond = 0, total = 0;\n  ((v && v.cl) || []).forEach((c) => (c.industrias || []).forEach((x) => { total += Number(x.v) || 0; if (x.n === 'MONDELEZ BRASIL') mond += Number(x.v) || 0; }));\n  return total > 0 && mond / total > 0.9 ? 'MONDELEZ' : '';\n};\nwindow.qualificaGolUI = function (carteira, c) {\n  const so = String(carteira || '').toUpperCase() === 'MONDELEZ';", 'ui');
  return s;
});
for (const rel of ['public/tvapp.html', 'public/matrizapp.html'])
  ed(rel, (s) => tr(s, "qualificaGolUI((item.v || (item.a && item.a.v) || {}).carteira, item.c", "qualificaGolUI(carteiraEfetivaUI(item.v || (item.a && item.a.v) || {}), item.c", rel));
ed('public/gestao-equipe.html', (s) => tr(s, "' <span style=\"font-size:10px;background:#7c3aed;color:#fff;padding:1px 6px;border-radius:8px\" title=\"Carteira só Mondelez: o gol qualificado conta categorias, não indústrias\">SÓ MONDELEZ</span>' : ''}",
  "' <span style=\"font-size:10px;background:#7c3aed;color:#fff;padding:1px 6px;border-radius:8px\" title=\"Carteira só Mondelez: o gol qualificado conta categorias, não indústrias\">SÓ MONDELEZ</span>' : (String(r.carteira || '').toUpperCase() === 'AUTO' ? ' <span style=\"font-size:10px;background:#475569;color:#fff;padding:1px 6px;border-radius:8px\" title=\"Automático: mais de 90% da venda do dia em Mondelez = conta categorias\">AUTO (&gt;90% MONDELEZ)</span>' : '')}", 'badge'));
