const B = 'https://ceven.drivetriunfante-locomotiva.com.br';
(async () => {
  const lr = await fetch(B + '/api/gerente-auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: JSON.stringify({ filial: 'tpa1', nome: 'Leandro Souza', password: process.env.GP }) });
  const lj = await lr.json().catch(() => ({})); const tk = lj.access_token || lj.token;
  console.log('login', lr.status, tk ? 'token ok' : JSON.stringify(lj).slice(0, 120));
  if (!tk) return;
  const cr = await fetch(B + '/api/gerente/tabelas-cascata?filial=tpa1', { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0' } });
  const c = await cr.json();
  console.log('cascata', cr.status, 'chaves', Object.keys(c).join(','), 'supervisores', (c.supervisores || []).length);
  for (const s of c.supervisores || []) {
    const ids = new Set(); ['produtividade', 'faturamento', 'positivacao'].forEach((t) => ((s.tabelas || {})[t] || []).forEach((v) => ids.add(v.id)));
    console.log(String(s.id || s.codigo || '?'), s.nome, '->', [...ids].sort((a, b) => a - b).join(','));
  }
  const s0 = (c.supervisores || [])[0]; console.log('exemplo chaves sup:', s0 && Object.keys(s0).join(','));
})();
