const B = 'https://ceven-cftv-matrix.pages.dev', C = 'https://ceven.drivetriunfante-locomotiva.com.br';
const G = [['TBE','tbe1','Diego'],['TSJ','tsj1','Saldanha'],['MCD','mcd1','Cleverson'],['TPH','tph1','Vagner'],['TCG','tcg1','Danilo'],['TPA','tpa1','Leandro Souza'],['API','api1','Marcelo'],['TCV','tcv1','Leonardo'],['ABC','abc1','Marcos Colling'],['TCA','tca1','Becher'],['TBL','tbl1','Fabio Machado']];
const limpa = (n) => String(n || '').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').toUpperCase().replace(/\s+/g, ' ').trim();
(async () => {
  const eq = await (await fetch(B + '/api/tv-mostra?t=' + Date.now())).json();
  console.log('arvore_viva:', JSON.stringify(eq.arvore_viva));
  let totSup = 0, totFora = 0, totNova = 0, totGestaoSo = 0;
  const novas = [];
  for (const [sig, fk, nome] of G) {
    const lr = await (await fetch(C + '/api/gerente-auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: JSON.stringify({ filial: fk, nome, password: 'abc123' }) })).json();
    const tk = lr.access_token || lr.token;
    const c = await (await fetch(C + '/api/gerente/tabelas-cascata?filial=' + fk, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0' } })).json();
    const arv = new Map(); const nomesVend = new Map();
    for (const s of c.supervisores || []) for (const t of ['produtividade', 'faturamento', 'positivacao']) for (const v of (s.tabelas || {})[t] || []) { if (!arv.has(String(v.id))) arv.set(String(v.id), limpa(s.supervisorNome)); nomesVend.set(String(v.id), v.nome || v.nome_rca || ''); }
    const lista = (eq.filiais[sig] || []);
    const naGestao = new Set(lista.map((v) => String(v.rca)));
    let erradoSup = 0;
    for (const v of lista) { const a = arv.get(String(v.rca)); if (a && a !== String(v.supervisor || '').toUpperCase().trim()) erradoSup++; }
    const soArvore = [...arv.keys()].filter((r) => !naGestao.has(r));
    const soGestao = lista.filter((v) => !arv.has(String(v.rca)));
    totSup += erradoSup; totNova += soArvore.length; totGestaoSo += soGestao.length;
    console.log(sig.padEnd(4), 'arvore', String(arv.size).padStart(3), '| Gestao', String(lista.length).padStart(3), '| supervisor divergente:', erradoSup, '| so na arvore (fora da Gestao):', soArvore.length, '| so na Gestao (fora da arvore):', soGestao.length, '(ocultos:', soGestao.filter((v) => !v.mostra).length + ')');
    soArvore.forEach((r) => novas.push(`${sig} ${r} ${nomesVend.get(r) || ''} -> ${arv.get(r)}`));
  }
  console.log('TOTAL supervisor divergente depois da correcao:', totSup, '| vendedores so na arvore:', totNova, '| so na Gestao:', totGestaoSo);
  console.log(novas.slice(0, 40).join('\n'));
})();
