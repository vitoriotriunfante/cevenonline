const B = 'https://ceven-cftv-matrix.pages.dev', C = 'https://ceven.drivetriunfante-locomotiva.com.br';
const G = [['TBE','tbe1','Diego'],['TSJ','tsj1','Saldanha'],['MCD','mcd1','Cleverson'],['TPH','tph1','Vagner'],['TCG','tcg1','Danilo'],['TPA','tpa1','Leandro Souza'],['API','api1','Marcelo'],['TCV','tcv1','Leonardo'],['ABC','abc1','Marcos Colling'],['TBL','tbl1','Fabio Machado']];
(async () => {
  const eq = await (await fetch(B + '/api/tv-mostra?t=' + Date.now())).json();
  for (const [sig, fk, nome] of G) {
    const lr = await (await fetch(C + '/api/gerente-auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: JSON.stringify({ filial: fk, nome, password: 'abc123' }) })).json();
    const tk = lr.access_token || lr.token;
    const c = await (await fetch(C + '/api/gerente/tabelas-cascata?filial=' + fk, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0' } })).json();
    const arv = new Set(); for (const s of c.supervisores || []) for (const t of ['produtividade', 'faturamento', 'positivacao']) for (const v of (s.tabelas || {})[t] || []) arv.add(String(v.id));
    const so = (eq.filiais[sig] || []).filter((v) => !arv.has(String(v.rca)));
    for (const v of so) {
      const d = await (await fetch(`${B}/api/tv-vendedor?filial=${sig.toLowerCase()}&id=${v.rca}&central=1`)).json().catch(() => ({}));
      console.log(sig, v.rca, (v.nome || '').slice(0, 30).padEnd(30), 'canal', v.canal, 'mostra', v.mostra, '| sup:', (v.supervisor || '-').slice(0, 24), '| meta', Math.round(d.meta_fat || 0), 'dig hoje', Math.round(d.dig_hoje || 0), 'rota', (d.clientes || []).length);
    }
  }
})();
