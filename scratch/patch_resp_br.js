const fs = require('fs');
const p = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/public/brasileirao.html';
let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');

// 1) tirar Super Pedido / Inativos (Vitório: "não quero monitorar isso à parte") e o quadro explicativo
const antes = s.length;
s = s.replace(/^\s*<th style="text-align:center;line-height:1\.25">Super Pedido<br>.*<\/th>\n/gm, '');
s = s.replace(/^\s*<th style="text-align:center;line-height:1\.25">Inativos<br>.*<\/th>\n/gm, '');
s = s.replace(/^\s*<td[^>]*>\$\{(f|v)\.super_pedidos\}<\/td>\n/gm, '');
s = s.replace(/^\s*<td[^>]*>\$\{(f|v)\.inativos_resgatados\}<\/td>\n/gm, '');
s = s.replace(/\n\s*<div style="margin:8px 0 0;padding:10px 14px;border-radius:10px;background:rgba\(56,189,248,\.08\)[\s\S]*?<\/div>/g, '');
if (/super_pedidos|inativos_resgatados|Super Pedido|dias com R\$ 15 mil/.test(s.replace(/<!--[\s\S]*?-->/g, ''))) {
  const sobra = s.split('\n').filter((l) => /super_pedidos|inativos_resgatados|Super Pedido|dias com R\$ 15 mil/.test(l)).map((l) => l.trim().slice(0, 120));
  console.log('AINDA RESTA:', sobra);
}

// 2) CSS responsivo (a pagina nao tinha nenhum @media): abas quebram linha, tabelas encolhem e escondem colunas secundarias em tela estreita
const RESP = `
/* ===== RESPONSIVO (Vitório, 06/10/2026: "a responsividade está muito ruim em todas as telas") ===== */
.header-top { gap: 10px; }
.nav-tabs { flex-wrap: wrap; overflow-x: visible; gap: 6px; row-gap: 6px; }
.tab-btn { padding: clamp(6px, .6vw, 10px) clamp(8px, .9vw, 16px); font-size: clamp(11px, .95vw, 13px); gap: 6px; }
main { padding: 0 clamp(8px, 1.6vw, 24px); }
.tb-league thead th { padding: clamp(7px, .8vw, 14px) clamp(5px, .75vw, 14px); font-size: clamp(9px, .72vw, 11px); letter-spacing: .04em; white-space: normal; line-height: 1.2; }
.tb-league td { padding: clamp(6px, .8vw, 14px) clamp(5px, .75vw, 14px); font-size: clamp(11px, .95vw, 13px); }
.tb-league thead th[style*="width:60px"], .tb-league thead th[style*="width:70px"] { width: auto !important; }
.hero-stats { grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: clamp(8px, 1vw, 16px); }
.stat-card { padding: clamp(10px, 1vw, 16px) clamp(12px, 1.2vw, 20px); }
@media (max-width: 1250px) {
  #tab-filiais .tb-league th:nth-child(4), #tab-filiais .tb-league td:nth-child(4) { display: none; }
  #tab-gerencias .tb-league th:nth-child(9), #tab-gerencias .tb-league td:nth-child(9), #tab-gerencias .tb-league th:nth-child(10), #tab-gerencias .tb-league td:nth-child(10) { display: none; }
  #tab-supervisores .tb-league th:nth-child(4), #tab-supervisores .tb-league td:nth-child(4) { display: none; }
  #tab-vendedores .tb-league th:nth-child(11), #tab-vendedores .tb-league td:nth-child(11) { display: none; }
  #tab-lances .tb-league th:nth-child(7), #tab-lances .tb-league td:nth-child(7) { display: none; }
}
@media (max-width: 1000px) {
  #tab-filiais .tb-league th:nth-child(8), #tab-filiais .tb-league td:nth-child(8), #tab-filiais .tb-league th:nth-child(9), #tab-filiais .tb-league td:nth-child(9) { display: none; }
  #tab-gerencias .tb-league th:nth-child(5), #tab-gerencias .tb-league td:nth-child(5) { display: none; }
  #tab-vendedores .tb-league th:nth-child(4), #tab-vendedores .tb-league td:nth-child(4), #tab-vendedores .tb-league th:nth-child(10), #tab-vendedores .tb-league td:nth-child(10) { display: none; }
  #tab-lances .tb-league th:nth-child(2), #tab-lances .tb-league td:nth-child(2) { display: none; }
  .header-top { flex-direction: column; align-items: flex-start; }
}
@media (max-width: 700px) {
  main { padding: 0 8px; }
  .tb-league td, .tb-league thead th { padding: 6px 4px; }
  #tab-supervisores .tb-league th:nth-child(6), #tab-supervisores .tb-league td:nth-child(6), #tab-gerencias .tb-league th:nth-child(3), #tab-gerencias .tb-league td:nth-child(3) { display: none; }
}
`;
const i = s.indexOf('</style>');
if (i < 0) throw new Error('sem </style>');
s = s.slice(0, i) + RESP + s.slice(i);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('ok; tamanho', antes, '->', s.length);
