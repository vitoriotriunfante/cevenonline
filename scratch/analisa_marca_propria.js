const fs = require('fs');
const rows = JSON.parse(fs.readFileSync(__dirname + '/marca_propria.json'))[0].results;
const seen = new Set(), vals = [], semVal = [];
for (const r of rows) {
  const m = /MARCA PROPRIA[A-Z ]*? R\$ ([\d.]+,\d\d)/.exec(r.obs || '');
  const ped = (/PEDIDO DE HOJE: (\d+)/.exec(r.obs || '') || [])[1];
  if (!m || !ped) { semVal.push(r.chave); continue; }
  const k = r.dia + '|' + ped;
  if (seen.has(k)) continue; seen.add(k);
  vals.push(Number(m[1].replace(/\./g, '').replace(',', '.')));
}
vals.sort((a, b) => a - b);
const p = (q) => vals[Math.min(vals.length - 1, Math.floor(q * vals.length))];
console.log('linhas com MARCA PROPRIA:', rows.length, '| pedidos distintos lidos:', vals.length, '| sem valor lido:', semVal.length);
console.log('valor da marca propria no pedido: P10', p(0.1), 'P25', p(0.25), 'P50', p(0.5), 'P75', p(0.75), 'P90', p(0.9), 'max', vals[vals.length - 1]);
for (const lim of [20, 30, 50, 100, 200]) console.log('  >= R$', lim, ':', vals.filter((x) => x >= lim).length, 'de', vals.length);
const dias = {}; for (const r of rows) dias[r.dia] = (dias[r.dia] || 0) + 1; console.log('por dia (linhas):', JSON.stringify(dias));
