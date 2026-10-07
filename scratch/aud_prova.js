const r = JSON.parse(require('fs').readFileSync(process.env.TEMP + '/led.json', 'utf8'))[0].results;
const g = new Map();
for (const x of r) {
  const canon = String(x.chave).replace(/^[A-Z]{3}\|/, ''); const fil = /^[A-Z]{3}\|/.test(x.chave) && x.filial === 'MTZ' ? x.chave.slice(0, 3) : x.filial;
  const id = x.dia + '|' + fil + '|' + canon; const e = g.get(id) || { dia: x.dia, nivel: x.nivel, tipo: canon.split('|')[0] === 'imp' || canon.split('|')[0] === 'pen' ? canon.split('|').slice(0, 2).join('|') : canon.split('|')[0], lo: 0 };
  e.lo = Math.max(e.lo, x.lo || 0); g.set(id, e);
}
const por = {};
for (const e of g.values()) { const k = e.dia + ' ' + e.tipo; const p = (por[k] = por[k] || { n: 0, sem: 0 }); p.n++; if (e.lo <= 3) p.sem++; }
const dias = {};
for (const [k, p] of Object.entries(por)) { const d = k.slice(0, 10); (dias[d] = dias[d] || { n: 0, sem: 0 }); dias[d].n += p.n; dias[d].sem += p.sem; }
console.log('por dia (lances distintos, sem prova):', dias);
const hoje = Object.entries(por).filter(([k]) => k.startsWith('2026-10-07')).map(([k, p]) => [k.slice(11), p.n, p.sem]).filter((x) => x[2] > 0).sort((a, b) => b[2] - a[2]);
console.log('hoje por tipo [tipo, total, sem prova]:', hoje.map((x) => x.join(':')).join(' | '));
