const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
const css = fs.readFileSync(R + 'scratch/ux_popup.css', 'utf8').replace(/\r\n/g, '\n').trim() + '\n';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }

const SELO_NOVO =
"  const TOM = {'#22c55e': 'g', '#eab308': 'y', '#facc15': 'y', '#f97316': 'o', '#ef4444': 'r', '#38bdf8': 'b'};\n" +
"  const ptsNum = String(infoLiga.pts).split(' ')[0]; // \"+7\"\n" +
"  const nomeSelo = qGol ? infoLiga0.nome : infoLiga.nome; // o nivel (bronze..platina) vira pilula\n" +
"  const seloLiga = infoLiga.pts ? `<div class=\"selo\" data-tom=\"${TOM[infoLiga.cor] || 'b'}\"><b class=\"sp\">${esc(ptsNum)}</b><span class=\"sn\">${esc(nomeSelo)}${qGol ? `<em class=\"nv nv-${esc(String(qGol.nivel).toLowerCase())}\">${esc(qGol.nivel)}</em>` : ''}</span><i class=\"sl\">${esc(String(infoLiga.pts).replace(/^\\S+\\s/, ''))}</i></div>` : '';";

for (const rel of ['public/tvapp.html', 'public/matrizapp.html']) {
  ed(rel, (s) => {
    // 1) CSS: troca TODAS as regras "#ov .dec ..." antigas (inclusive o bloco "POPUP COMPACTO") pelo CSS novo; preserva "#ov small"
    const ini = s.indexOf('#ov .dec{background:var(--card);border:3px solid var(--bad)');
    const marca = '#ov .dec>.vd{font-size:min(2.1vw,32px);margin-top:1.2vh}\n';
    const fimI = s.indexOf(marca, ini);
    if (ini < 0 || fimI < 0) throw new Error('bloco css antigo em ' + rel);
    const velho = s.slice(ini, fimI + marca.length);
    const small = (velho.split('\n').find((l) => l.startsWith('#ov small{')) || '#ov small{margin-top:2vh;color:var(--mut);font-size:16px}');
    s = s.slice(0, ini) + css + small + '\n' + s.slice(fimI + marca.length);
    // 2) selo novo
    const linhas = s.split('\n');
    const k = linhas.findIndex((l) => l.startsWith('  const seloLiga = infoLiga.pts ? `<div style="background:rgba(15,23,42,.9)'));
    if (k < 0) throw new Error('seloLiga em ' + rel);
    linhas[k] = SELO_NOVO;
    return linhas.join('\n');
  });
}
console.log('tudo ok');
