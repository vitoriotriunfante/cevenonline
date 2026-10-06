const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

function comum(s) {
  // depois das 15h o ritmo acelera (antes: 16h) e o intervalo entre lances bons cai para 30 s
  s = tr(s, "const varGapS = () => (+P.get('vargap') || (sp().h >= 16 ? 90 : 180));", "const varGapS = () => (+P.get('vargap') || (sp().h >= 15 ? 90 : 180));", 'gap');
  s = tr(s, "const varMaxH = () => (+P.get('varmax') || (sp().h >= 16 ? 40 : 20));", "const varMaxH = () => (+P.get('varmax') || (sp().h >= 15 ? 40 : 20));", 'max');
  s = tr(s, "const ehBomLance = (x) => x.tipo === 'gol' || x.tipo === 'hattrick' || x.tipo === 'defesa'; // lance bom: sai sozinho, na frente e com intervalo curto (40 s)\n",
    "const ehBomLance = (x) => x.tipo === 'gol' || x.tipo === 'hattrick' || x.tipo === 'defesa'; // lance bom: sai sozinho, na frente e com intervalo curto (30 s depois das 15h, 40 s antes)\n" +
    "// FOCO EM GOL DEPOIS DAS 15H (Vitório, 06/10/2026: \"depois das 15 quero foco em gol e mais gols\"): lance ruim (pênalti, cartão, impedimento, gol contra) so aparece em resumo, no maximo 1 a cada 10 min\n" +
    "let ULT_RUIM = 0;\n" +
    "const ruimLiberado = () => sp().h < 15 || ESPERA.some((x) => ehBomLance(x) || x.tipo === 'semanainvicta') || Date.now() - ULT_RUIM >= 10 * 60e3;\n", 'bom');
  s = tr(s, "(bom ? Math.min(varGapS(), 40) : varGapS())", "(bom ? Math.min(varGapS(), sp().h >= 15 ? 30 : 40) : varGapS())", 'bomgap');
  return s;
}
ed('public/tvapp.html', (s) => {
  s = comum(s);
  s = tr(s, "  if (ESPERA.length && podeVAR(ESPERA.some(ehBomLance))) {", "  if (ESPERA.length && podeVAR(ESPERA.some(ehBomLance)) && ruimLiberado()) {", 'if');
  s = tr(s, "(ESPERA.length >= 4 ? {tipo: 'resumo', grupos: ESPERA.splice(0)} : ESPERA.shift())); // muita coisa ruim junta = 1 resumo só", "(ESPERA.length >= (sp().h >= 15 ? 2 : 4) ? {tipo: 'resumo', grupos: ESPERA.splice(0)} : ESPERA.shift())); // muita coisa ruim junta = 1 resumo só\n    if (iInv < 0 && iBom < 0) ULT_RUIM = Date.now();", 'item');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = comum(s);
  s = tr(s, "  if (ESPERA.length && podeVAR(ESPERA.some(ehBomLance))) {", "  if (ESPERA.length && podeVAR(ESPERA.some(ehBomLance)) && ruimLiberado()) {", 'if');
  s = tr(s, "(ESPERA.length >= 4 ? {tipo: 'resumo', grupos: ESPERA.splice(0)} : ESPERA.shift()));", "(ESPERA.length >= (sp().h >= 15 ? 2 : 4) ? {tipo: 'resumo', grupos: ESPERA.splice(0)} : ESPERA.shift())); if (iInv < 0 && iBom < 0) ULT_RUIM = Date.now();", 'item');
  return s;
});
console.log('tudo ok');
