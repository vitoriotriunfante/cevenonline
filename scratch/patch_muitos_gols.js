const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

// MUITOS GOLS (Vitório, 06/10/2026: "eu quero ver muito muito muito gols"): gol, hat-trick e defesa saem SEMPRE sozinhos (nunca dentro de um resumo), passam na frente e o intervalo entre eles e curto (40 s)
const BOM = "const ehBomLance = (x) => x.tipo === 'gol' || x.tipo === 'hattrick' || x.tipo === 'defesa'; // lance bom: sai sozinho, na frente e com intervalo curto (40 s)\n";
ed('public/tvapp.html', (s) => {
  s = tr(s, "function podeVAR() {\n  const agora = Date.now(); while (VARS.length && agora - VARS[0] > 3600e3) VARS.shift();\n  return !emVAR && !FILA.length && VARS.length < varMaxH() && (!VARS.length || agora - VARS[VARS.length - 1] >= varGapS() * 1000);\n}",
    BOM + "function podeVAR(bom) {\n  const agora = Date.now(); while (VARS.length && agora - VARS[0] > 3600e3) VARS.shift();\n  return !emVAR && !FILA.length && VARS.length < varMaxH() * (bom ? 3 : 1) && (!VARS.length || agora - VARS[VARS.length - 1] >= (bom ? Math.min(varGapS(), 40) : varGapS()) * 1000);\n}", 'pode');
  s = tr(s, "  if (ESPERA.length && podeVAR()) {\n    const iInv = ESPERA.findIndex(x => x.tipo === 'semanainvicta'); /* Semana Invicta sai SEMPRE sozinha, nunca dentro de um resumo */\n    const item = iInv >= 0 ? ESPERA.splice(iInv, 1)[0] : (ESPERA.length >= 4 ? {tipo: 'resumo', grupos: ESPERA.splice(0)} : ESPERA.shift()); // muita coisa junta = 1 resumo só",
    "  if (ESPERA.length && podeVAR(ESPERA.some(ehBomLance))) {\n    const iInv = ESPERA.findIndex(x => x.tipo === 'semanainvicta'); /* Semana Invicta sai SEMPRE sozinha, nunca dentro de um resumo */\n    const iBom = ESPERA.findIndex(ehBomLance); /* gol, hat-trick e defesa saem sozinhos e na frente: o resumo fica so para o que e ruim */\n    const item = iInv >= 0 ? ESPERA.splice(iInv, 1)[0] : (iBom >= 0 ? ESPERA.splice(iBom, 1)[0] : (ESPERA.length >= 4 ? {tipo: 'resumo', grupos: ESPERA.splice(0)} : ESPERA.shift())); // muita coisa ruim junta = 1 resumo só", 'libera');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = tr(s, "function podeVAR() { const agora = Date.now(); while (VARS.length && agora - VARS[0] > 3600e3) VARS.shift(); return !emVAR && !FILA.length && VARS.length < varMaxH() && (!VARS.length || agora - VARS[VARS.length - 1] >= varGapS() * 1000); }",
    BOM + "function podeVAR(bom) { const agora = Date.now(); while (VARS.length && agora - VARS[0] > 3600e3) VARS.shift(); return !emVAR && !FILA.length && VARS.length < varMaxH() * (bom ? 3 : 1) && (!VARS.length || agora - VARS[VARS.length - 1] >= (bom ? Math.min(varGapS(), 40) : varGapS()) * 1000); }", 'pode');
  s = tr(s, "  if (ESPERA.length && podeVAR()) { const iInv = ESPERA.findIndex(x => x.tipo === 'semanainvicta'); /* Semana Invicta sai SEMPRE sozinha, nunca dentro de um resumo */\n    const item = iInv >= 0 ? ESPERA.splice(iInv, 1)[0] : (ESPERA.length >= 4 ? {tipo: 'resumo', grupos: ESPERA.splice(0)} : ESPERA.shift());",
    "  if (ESPERA.length && podeVAR(ESPERA.some(ehBomLance))) { const iInv = ESPERA.findIndex(x => x.tipo === 'semanainvicta'); /* Semana Invicta sai SEMPRE sozinha, nunca dentro de um resumo */\n    const iBom = ESPERA.findIndex(ehBomLance); /* gol, hat-trick e defesa saem sozinhos e na frente: o resumo fica so para o que e ruim */\n    const item = iInv >= 0 ? ESPERA.splice(iInv, 1)[0] : (iBom >= 0 ? ESPERA.splice(iBom, 1)[0] : (ESPERA.length >= 4 ? {tipo: 'resumo', grupos: ESPERA.splice(0)} : ESPERA.shift()));", 'libera');
  return s;
});
console.log('tudo ok');
