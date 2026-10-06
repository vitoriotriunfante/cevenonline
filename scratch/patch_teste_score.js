const fs = require('fs');
const p = 'testes/rodar_testes.mjs';
let s = fs.readFileSync(p, 'utf8');
const marca = 'console.log(`\\nRESULTADO';
const i = s.indexOf(marca);
if (i < 0) throw new Error('ancora');
const add = [
  "secao('8f. Score de desempenho da Matriz: 0 a 100, nunca negativo, lider = 100');",
  "{",
  "  const t = ler('public/matrizapp.html');",
  "  const ini = t.indexOf('const SCORE_PESOS'), fim = t.indexOf('const METRICA_FILIAL');",
  "  const fn = new Function(t.slice(ini, fim) + '; return scoresRelativos;')();",
  "  const mk = (sig, pctFat, pctPos, gols, pen, nZer, n, campo) => ({ sig, tem: true, pctFat, pctPos, gols, pen, nZer, n, campo: new Array(campo).fill(0) });",
  "  // numeros parecidos com os de 06/10/2026 (TCA e TCG tinham score NEGATIVO na formula antiga)",
  "  const stats = [mk('TBL', 9.6, 11.5, 11, 19, 3, 33, 30), mk('TPH', 14, 12.4, 11, 41, 7, 88, 62), mk('TCG', 1.1, 0.7, 4, 2, 6, 20, 15), mk('TCA', 3.1, 7, 7, 15, 12, 28, 25), mk('API', 5.3, 7.6, 14, 4, 2, 30, 28)];",
  "  const r = fn(stats);",
  "  const v = Object.values(r);",
  "  ok(v.every(x => x >= 0 && x <= 100), 'score de todas as filiais fica entre 0 e 100 (nenhum negativo): ' + JSON.stringify(r));",
  "  ok(Math.max(...v) === 100, 'o lider vale exatamente 100');",
  "  ok(r.TCG < r.TBL && r.TCA < r.API, 'quem tem menos resultado e mais perda fica abaixo (ordem faz sentido)');",
  "  ok(JSON.stringify(fn([mk('A', 0, 0, 0, 0, 0, 10, 8), mk('B', 0, 0, 0, 0, 0, 10, 8)])) === '{\"A\":100,\"B\":100}', 'sem nenhum dado nao inventa diferenca: todas empatam em 100');",
  "}",
  "", ""
].join('\n');
s = s.slice(0, i) + add + s.slice(i);
fs.writeFileSync(p, s);
console.log('ok');
