const fs = require('fs');
const p = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/functions/api/tv-lances.js';
let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const de = "  const { dia, hora } = agoraSP();\n  const iso = new Date().toISOString();\n  try {\n    // marcador do dia";
if (s.split(de).length !== 2) throw new Error('ancora');
s = s.replace(de, () => "  const { dia, hora } = agoraSP();\n  // Madrugada (antes das 06h) o CEVEN ainda serve o roteiro de ontem com o dia novo: nada e gravado (06/10/2026: 845 lances repetidos de ontem)\n  if (String(hora) < '06:00:00') return resp({ novos: [], ignorado: 'madrugada' });\n  const iso = new Date().toISOString();\n  try {\n    // marcador do dia");
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
