const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const antesFim = (s, css, r) => { const i = s.indexOf('</style>'); if (i < 0) throw new Error('sem </style> ' + r); return s.slice(0, i) + css + s.slice(i); };

// TV da filial e Matriz: rodape com botoes que quebram linha (antes cortava "Som", "Revisar 30 min"), hero que rola em tela baixa
const RODAPE = `
/* ===== RESPONSIVO (Vitório, 06/10/2026) ===== */
footer { flex-wrap: wrap; row-gap: 6px; }
footer .msg { flex: 1 1 220px; min-width: 160px; }
#ctl { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; flex: 0 1 auto; max-width: 100%; }
#ctl button, #ctl a { padding: 5px clamp(6px, .7vw, 12px); font-size: clamp(10px, .85vw, 13px); line-height: 1.1; white-space: nowrap; }
@media (max-height: 880px) { main { padding-top: 8px; padding-bottom: 8px; } }
`;
ed('public/tvapp.html', (s) => {
  s = antesFim(s, RODAPE + `.master { overflow-y: auto; scrollbar-width: none; }
.master::-webkit-scrollbar { display: none; }
@media (max-height: 880px) { .master { padding: 14px 18px; gap: 10px; } }
`, 'tvapp');
  return s;
});
ed('public/matrizapp.html', (s) => antesFim(s, RODAPE, 'matriz'));

// TV Executiva: cabecalho nao tem mais altura fixa (o titulo ficava cortado em tela estreita)
ed('public/tv_executiva.html', (s) => antesFim(s, `
/* ===== RESPONSIVO (Vitório, 06/10/2026) ===== */
header { height: auto !important; min-height: 56px; flex-wrap: wrap; gap: 6px 14px; padding: 6px 16px !important; }
.header-left, .header-center, .header-right { flex-wrap: wrap; row-gap: 4px; }
.war-title { font-size: clamp(14px, 1.5vw, 20px) !important; }
.war-title span { font-size: clamp(11px, 1.1vw, 15px) !important; }
`, 'executiva'));

// Divergencias: celulas compactas e cabecalho que quebra linha (a coluna da direita era cortada)
ed('public/divergencias.html', (s) => {
  s = s.replace('th, td { text-align:left; padding:8px 12px; border-bottom:1px solid var(--linha); white-space:nowrap; }',
    'th, td { text-align:left; padding:clamp(5px,.6vw,8px) clamp(5px,.7vw,12px); font-size:clamp(11px,.95vw,14px); border-bottom:1px solid var(--linha); }\n  td.n, th.n { white-space:nowrap; }');
  s = s.replace('table { border-collapse:collapse; width:100%; min-width:720px; }', 'table { border-collapse:collapse; width:100%; min-width:0; }');
  return s;
});

// Gestao de Equipe: tabela encolhe (padding e fonte fluidos) e o cabecalho quebra linha
ed('public/gestao-equipe.html', (s) => antesFim(s, `
/* ===== RESPONSIVO (Vitório, 06/10/2026) ===== */
thead th { padding: clamp(7px, .8vw, 14px) clamp(5px, .8vw, 16px) !important; font-size: clamp(9px, .75vw, 11px) !important; white-space: normal !important; line-height: 1.2; }
tbody td { padding: clamp(6px, .7vw, 12px) clamp(5px, .8vw, 16px) !important; }
table { font-size: clamp(11px, .95vw, 13px) !important; }
`, 'gestao'));
console.log('tudo ok');
