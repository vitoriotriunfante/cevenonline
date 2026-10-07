const r = JSON.parse(require('fs').readFileSync(process.env.TEMP + '/sw.json', 'utf8'))[0].results;
const porDia = {}, hoje = '2026-10-07', topo = [];
let hojeN = 0, hojeV = 0;
for (const x of r) {
  let l; try { l = JSON.parse(x.devolucoes_json); } catch { continue; }
  for (const n of l) {
    const v = Number(n.vl_devolvido) || 0; const d = String(n.data || '').slice(0, 10);
    porDia[d] = (porDia[d] || 0) + v;
    if (d === hoje && v > 0) { hojeN++; hojeV += v; topo.push([v, x.filial_sigla, x.rca_codigo, n.numnota, n.nomecli]); }
  }
}
console.log('por dia', porDia);
console.log('hoje notas', hojeN, 'valor', hojeV.toFixed(2));
topo.sort((a, b) => b[0] - a[0]); console.log(topo.slice(0, 8));
