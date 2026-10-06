const B = 'https://ceven-cftv-matrix.pages.dev';
(async () => {
  const lj = await (await fetch(B + '/api/brasileirao-lances?dia=2026-10-06')).json();
  const por = {}; lj.lances.forEach((l) => { const k = (l.pontos_nome || l.nivel); por[k] = (por[k] || 0) + 1; });
  console.log('lances de hoje:', lj.total, JSON.stringify(por));
  const q = lj.lances.filter((l) => l.qualificacao); const nv = {}; q.forEach((l) => nv[l.qualificacao] = (nv[l.qualificacao] || 0) + 1);
  console.log('gols qualificados hoje:', q.length, JSON.stringify(nv));
  const casos = [['tcv', 340], ['tcv', 343], ['tcv', 347], ['tcg', 486], ['tcg', 487], ['tph', 78]];
  for (const [f, id] of casos) {
    const j = await (await fetch(`${B}/api/tv-vendedor?filial=${f}&id=${id}&central=1`)).json();
    const pos = (j.clientes || []).filter((c) => ['POSITIVADO', 'EFETIVADO'].includes(c.status));
    console.log(f.toUpperCase(), id, j.nome, '| positivados', pos.length, '|', pos.map((c) => `${(c.nome || '').slice(0, 18)}: ${c.industrias ? c.industrias.length + ' ind' : 'sem dado'}${c.dobrouMix ? ' MIX' : ''}${c.dobradinhaQuinzenas ? ' QUINZ' : ''}${(c.ultima_compra && (Date.now() - Date.parse(c.ultima_compra)) / 864e5 > 30) ? ' INATIVO' : ''}`).join(' | '));
  }
})();
