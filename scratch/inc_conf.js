const T = process.env.TEMP, fs = require('fs');
const dash = JSON.parse(fs.readFileSync(T + '/dash.json', 'utf8'))[0].results;
const canal = JSON.parse(fs.readFileSync(T + '/canal.json', 'utf8'))[0].results;
const mostra = JSON.parse(fs.readFileSync(T + '/mostra.json', 'utf8'));
const cv = new Map(canal.map((x) => [String(x.rca), x.canal]));
const VAREJO = ['VJ', 'FARMA', 'PET VJ', 'ESP'];
const gest = new Map(); // rca -> {mostra,sup,filial,grupo}
for (const [k, l] of Object.entries(mostra.filiais)) for (const x of l) gest.set(String(x.rca), { ...x, fk: k });
const porFil = {}, tot = { rcas: 0, meta: 0, real: 0 }, sups = new Set(), canais = {}, semG = [];
let todosMeta = 0;
for (const d of dash) {
  const g = gest.get(String(d.r)); const c = cv.get(String(d.r)) || (g && g.canal) || '';
  todosMeta += +d.m || 0;
  canais[c || '(vazio)'] = (canais[c || '(vazio)'] || 0) + 1;
  if (!g) { semG.push(d.r + ' ' + d.f); continue; }
  if (g.mostra === false) continue;
  if (!VAREJO.includes(c)) continue;
  const f = d.f; porFil[f] = porFil[f] || { rcas: 0, meta: 0, real: 0 };
  porFil[f].rcas++; porFil[f].meta += +d.m || 0; porFil[f].real += +d.p || 0;
  tot.rcas++; tot.meta += +d.m || 0; tot.real += +d.p || 0; sups.add(f + '|' + g.supervisor);
}
console.log('varejo visivel', tot, 'supervisores', sups.size, 'canais(varredura)', canais, 'sem gestao', semG.length);
console.log(porFil);
const col = { TPH: 4107, ABC: 3434, API: 3223, TBL: 2842, TCV: 2439, TSJ: 2175, TCA: 2159, TBE: 2148, TPA: 1861, MCD: 1376, TCG: 1235 };
for (const f of Object.keys(col)) console.log(f, 'ColN', col[f], 'soma metas CEVEN', Math.round((porFil[f] || {}).meta || 0));
console.log('soma todas as metas varredura', todosMeta);
