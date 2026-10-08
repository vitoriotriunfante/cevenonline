const B = 'https://ceven-cftv-matrix.pages.dev';
const j = async (u) => (await fetch(u)).json();
(async () => {
  const [snap, mostra] = await Promise.all([j(B + '/api/central-snapshot?filial=TCV&dia=' + (process.argv[2] || '')), j(B + '/api/tv-mostra')]);
  const eq = {}; for (const [k, l] of Object.entries(mostra.filiais)) if (k.startsWith('TCV')) for (const x of l) eq[String(x.rca)] = x;
  console.log('snapshot TCV dia', snap.dia, 'linhas', snap.total);
  const hm = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
  for (const [rca, r] of Object.entries(snap.rcas)) {
    const e = eq[rca]; if (!e || !/GESSANDRO/i.test(e.supervisor || '')) continue;
    const ci = (r.roteiro || []).filter((c) => ['POSITIVADO', 'EFETIVADO'].includes(c.status) && c.checkin_horario).map((c) => c.checkin_horario).sort();
    let hat = null;
    for (let i = 0; i + 2 < ci.length; i++) { const jan = hm(ci[i + 2]) - hm(ci[i]); if (jan <= 120) { hat = `${ci[i]} ${ci[i + 1]} ${ci[i + 2]} (${jan} min)`; break; } }
    console.log(rca, (e.nome || '').slice(0, 28).padEnd(28), 'mostra', e.mostra, '| checkins c/venda:', ci.length, ci.join(' '), hat ? ' <== HAT-TRICK ' + hat : '');
  }
})();
