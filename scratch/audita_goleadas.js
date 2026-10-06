const fs = require('fs'); const T = process.env.TEMP || '/tmp';
const raw = fs.readFileSync(T + '/goleadas.json', 'utf8'); const L = JSON.parse(raw.slice(raw.indexOf('[')))[0].results;
const B = 'https://ceven-cftv-matrix.pages.dev';
(async () => {
  console.log('goleadas no ledger:', L.length, '| por dia:', JSON.stringify(L.reduce((a, l) => (a[l.dia] = (a[l.dia] || 0) + 1, a), {})));
  const hoje = L.filter((l) => l.dia === '2026-10-06');
  for (const l of hoje) {
    const j = await (await fetch(`${B}/api/tv-vendedor?filial=${l.filial.toLowerCase()}&id=${l.rca}&central=1`)).json().catch(() => null);
    const c = (j && j.clientes) || []; const com = c.filter((x) => ['POSITIVADO', 'EFETIVADO'].includes(x.status)).length;
    console.log(l.filial, l.rca, l.vendedor, '| pos(pedidos) =', j && j.pos_hoje, '| clientes positivados na rota =', com, '| dig', j && Math.round(j.dig_hoje), '|', com >= 10 ? 'OK' : 'SEM COMPROVACAO');
  }
})();
