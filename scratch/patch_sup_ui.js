const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// modulo compartilhado (cards + semana) no fim do tv-animacoes.js
ed('public/animacoes/tv-animacoes.js', (s) => s + fs.readFileSync(R + 'scratch/sup_modulo.js', 'utf8').replace(/\r\n/g, '\n'));

// endpoints: nao-supervisores (decisao 04/10/2026) fora da conta
ed('functions/api/tv-supervisores-semana.js', (s) => {
  s = tr(s, "const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';", "import { NAO_SUPERVISORES, normNome } from '../_lib/nao_supervisores.js';\nconst CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';", 'imp');
  s = tr(s, '    const r = (ret.supervisores', '    if (NAO_SUPERVISORES.some((x) => x.nome === normNome(s.nome) && x.filial === sig)) continue; // decisao 04/10/2026: nao e supervisor\n    const r = (ret.supervisores', 'nao');
  return s;
});
ed('functions/api/tv-supervisores.js', (s) => {
  s = tr(s, "const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';", "import { NAO_SUPERVISORES, normNome } from '../_lib/nao_supervisores.js';\nconst CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';", 'imp');
  s = tr(s, 'const supsComp = (comp.supervisores || []).filter((s) => s.filial === key);', 'const supsComp = (comp.supervisores || []).filter((s) => s.filial === key && !NAO_SUPERVISORES.some((x) => x.nome === normNome(s.nome) && x.filial === filial.toUpperCase())); // nao-supervisores (04/10/2026) ficam fora', 'filtro');
  return s;
});

// Matriz: botao Supervisores + view no formato da filial + semana
ed('public/matrizapp.html', (s) => {
  s = tr(s, '<button id="bpainel"', '<button id="bsup" style="background:#4338ca;color:#fff;font-weight:800" title="Supervisores: compromisso, rota (RET), fotos e semana">👔 Supervisores</button><button id="bpainel"', 'btn');
  s = tr(s, 'const METRICA_FILIAL = {};', 'let SUP_MANUAL = false, SEMANA = null;\nconst METRICA_FILIAL = {};', 'decl');
  s = tr(s, 'function modoSup() { const t = sp(), m = t.h * 60 + t.m; return emJanelaSupPeriodica(m)', 'function modoSup() { if (SUP_MANUAL) return true; const t = sp(), m = t.h * 60 + t.m; return emJanelaSupPeriodica(m)', 'modo');
  s = tr(s, 'function renderSupView() {',
`// Supervisores no MESMO formato da filial (cards com compromisso, RET e fotos) + painel gerencial da semana; gira entre as 11 filiais
async function carregaSupsAgora() {
  await Promise.all(ORDEM.map(async (sig) => { const d = await j('/api/tv-supervisores?filial=' + sig, 30000); if (d && !d.erro && Array.isArray(d.supervisores)) SUPS[sig] = d.supervisores; }));
  const sm = await j('/api/tv-supervisores-semana', 30000); if (sm && !sm.erro) SEMANA = sm;
  render();
}
function renderSupFormatoFilial() {
  const sig = ORDEM[idxFil % ORDEM.length], el = $('det');
  const lista = (SUPS[sig] || []).filter(x => !ehSupFalso(x.nome));
  const pend = lista.filter(x => !x.fez_compromisso || !x.iniciou_ret).length;
  el.innerHTML = \`<h2><span>Supervisores · \${sig} · matinal (compromisso) e rota (RET)</span><b>\${SUPS[sig] ? pend + ' pendente(s) de ' + lista.length : 'carregando…'} · \${(idxFil % ORDEM.length) + 1} de \${ORDEM.length}</b></h2>\` +
    (SUPS[sig] ? supCardsHtml(lista) : '<div style="color:var(--mut);padding:12px 0">Aguardando dados dos supervisores…</div>') +
    \`<h2 style="margin-top:10px"><span>Painel gerencial da semana · \${sig}</span><b>fez = matinal + rota</b></h2>\` + supSemanaHtml(SEMANA && SEMANA.filiais && SEMANA.filiais[sig], SEMANA);
}
function renderSupView() {
  if (SUP_MANUAL) return renderSupFormatoFilial();`, 'view');
  s = tr(s, '  const ir = d => {', "  $('bsup').onclick = () => { SUP_MANUAL = !SUP_MANUAL; $('bsup').style.outline = SUP_MANUAL ? '3px solid #a5b4fc' : 'none'; if (SUP_MANUAL) { if (idxFil >= ORDEM.length) idxFil = 0; tFil = Date.now(); carregaSupsAgora(); } render(); };\n  setInterval(() => { if (SUP_MANUAL) carregaSupsAgora(); }, 5 * 60 * 1000);\n  const ir = d => {", 'handler');
  return s;
});

// Filial: painel gerencial da semana abaixo dos cards
ed('public/tvapp.html', (s) => {
  s = tr(s, 'let SUP = null;', "let SUP = null, SEM = null, semCarregando = false;\nasync function carregaSemana() { if (semCarregando) return; semCarregando = true; const d = await j('/api/tv-supervisores-semana?filial=' + FIL, 30000); if (d && !d.erro) SEM = d; semCarregando = false; renderSup(); }\nsetInterval(() => { if (typeof modoAtual === 'function' && modoAtual() === 'sup') carregaSemana(); }, 5 * 60 * 1000);", 'decl');
  s = tr(s, "function renderSup() {\n  const el = $('sup'), lista = supLista();", "function renderSup() {\n  if (!SEM && !semCarregando) carregaSemana();\n  const el = $('sup'), lista = supLista();", 'ini');
  s = tr(s, "    }).join('');\n}\n// RET/Compromissos em destaque periódico", "    }).join('') + `<h2 style=\"margin-top:10px\"><span>Painel gerencial da semana</span><b>fez = matinal + rota</b></h2>` + supSemanaHtml(SEM && SEM.filiais && SEM.filiais[FIL], SEM);\n}\n// RET/Compromissos em destaque periódico", 'fim');
  return s;
});
console.log('tudo ok');
