const fs = require('fs');
const p = 'testes/rodar_testes.mjs';
let s = fs.readFileSync(p, 'utf8');
const marca = 'console.log(`\\nRESULTADO';
const i = s.indexOf(marca);
if (i < 0) throw new Error('ancora');
const add = [
  "secao('8d. Lances na tela: o que o coletor registrou nos ultimos 12 min tambem apita; depois das 16h o VAR acelera');",
  "for (const arq of ['public/tvapp.html', 'public/matrizapp.html']) {",
  "  const t = ler(arq);",
  "  ok(t.includes('const RECENTES = new Set()') && t.includes('ehRecente') && t.includes('RECENTES.has(a.key)') && t.includes('EXIB.add(a.key)'), arq + ': lance registrado pelo coletor nos ultimos 12 min entra na fila do VAR (a tela nao fica muda)');",
  "  ok(t.includes('(sp().h >= 16 ? 90 : 180)') && t.includes('(sp().h >= 16 ? 40 : 20)') && t.includes('varGapS() * 1000') && t.includes('varMaxH()'), arq + ': depois das 16h o VAR roda a cada 90 s e ate 40 por hora');",
  "}",
  "", ""
].join('\n');
s = s.slice(0, i) + add + s.slice(i);
fs.writeFileSync(p, s);
console.log('ok');
