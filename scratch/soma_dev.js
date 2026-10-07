const r = JSON.parse(require('fs').readFileSync(process.env.TEMP + '/dev.json', 'utf8'))[0].results;
let t = 0; const m = {}, nf = new Set();
for (const x of r) {
  const mm = /R\$ ([\d.]+)/.exec(x.obs || ''); if (!mm) { console.log('sem valor', x.chave); continue; }
  const v = +mm[1].replace(/\./g, '');
  const k = x.chave.startsWith('ver') ? 'vermelho (cliente nao pediu)' : 'gol contra (outro motivo)';
  m[k] = (m[k] || 0) + v; t += v; nf.add(x.chave);
}
console.log(m, 'total R$', t, 'lances', r.length, 'distintos', nf.size);
