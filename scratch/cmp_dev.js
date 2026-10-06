const fs = require('fs');
const reps = JSON.parse(fs.readFileSync(__dirname + '/reps4.json'))[0].results;
const hoje = '2026-10-06';
(async () => {
  const out = {};
  for (let i = 0; i < reps.length; i += 10) {
    await Promise.all(reps.slice(i, i + 10).map(async (r) => {
      try {
        const x = await fetch(`https://ceven.drivetriunfante-locomotiva.com.br/api/rca/devolucoes?filial=${r.fil.toLowerCase()}1&id=${r.codigo}`, { signal: AbortSignal.timeout(15000) });
        const j = await x.json();
        for (const n of Array.isArray(j) ? j : []) if (String(n.data).slice(0, 10) === hoje || n.data === hoje) {
          (out[r.fil] = out[r.fil] || []).push({ rca: r.codigo, nota: n.numnota, v: Number(n.vl_devolvido), data: n.data });
        }
      } catch (e) { (out.erro = out.erro || []).push(r.codigo + ' ' + e.message); }
    }));
  }
  for (const [f, l] of Object.entries(out)) console.log(f, Array.isArray(l) && typeof l[0] === 'object' ? l.length + ' notas ' + l.reduce((s, x) => s + Math.abs(x.v), 0).toFixed(2) : l.join(','));
  fs.writeFileSync(__dirname + '/dev_ceven.json', JSON.stringify(out));
})();
