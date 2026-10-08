// compara a BASE UNICA (/api/central-snapshot) com o CEVEN direto, RCA a RCA (amostra)
const B = 'https://ceven-cftv-matrix.pages.dev', C = 'https://ceven.drivetriunfante-locomotiva.com.br';
const FIL = ['tbl', 'tph', 'tcv', 'abc', 'tca', 'mcd', 'tcg', 'api', 'tbe', 'tpa', 'tsj'];
const j = async (u) => { try { const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
const N = (x) => (x == null ? null : Math.round(Number(x) * 100) / 100);
const cont = (l) => { const m = {}; (l || []).forEach((c) => (m[c.status] = (m[c.status] || 0) + 1)); return JSON.stringify(m); };
const soma = (l) => N((l || []).reduce((a, x) => a + (Number(x.vl_devolvido) || 0), 0));
(async () => {
  const tot = { rcas: 0, prod: 0, dash: 0, dev: 0, rot: 0, semBase: 0 }, difs = [];
  for (const f of FIL) {
    const snap = await j(`${B}/api/central-snapshot?filial=${f.toUpperCase()}`);
    if (!snap) { console.log(f, 'SEM SNAPSHOT'); continue; }
    const ids = Object.keys(snap.rcas).filter((id) => snap.rcas[id].produtividade && snap.rcas[id].dashboard).slice(0, 6);
    for (const id of ids) {
      const s = snap.rcas[id], k = `${f}1`;
      const [p, d, dv, ro] = await Promise.all([j(`${C}/api/rca/produtividade?filial=${k}&id=${id}`), j(`${C}/api/rca/dashboard?filial=${k}&id=${id}`), j(`${C}/api/rca/devolucoes?filial=${k}&id=${id}`), j(`${C}/api/rca/roteiro-hoje?filial=${k}&id=${id}`)]);
      tot.rcas++;
      const cmp = (nome, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) difs.push(`${f}/${id} ${nome} base=${JSON.stringify(a)} ceven=${JSON.stringify(b)} (idade ${s.idade_s}s)`); else tot[nome === 'prod' ? 'prod' : nome === 'dash' ? 'dash' : nome === 'dev' ? 'dev' : 'rot']++; };
      if (p) cmp('prod', [N(s.produtividade.dia.dig_pedido), s.produtividade.dia.positivacao, s.produtividade.dia.visitas_na_rota, s.produtividade.dia.total_programado], [N(p.dia.dig_pedido), p.dia.positivacao, p.dia.visitas_na_rota, p.dia.total_programado]);
      if (d) cmp('dash', [N(s.dashboard.financeiro.meta), N(s.dashboard.financeiro.faturado), N(s.dashboard.financeiro.pendente), s.dashboard.positivacao.realizado], [N(d.financeiro.meta), N(d.financeiro.faturado), N(d.financeiro.pendente), d.positivacao.realizado]);
      if (dv && s.devolucoes) cmp('dev', [s.devolucoes.length, soma(s.devolucoes)], [dv.length, soma(dv)]);
      if (ro && s.roteiro) cmp('rot', [s.roteiro.length, cont(s.roteiro)], [ro.length, cont(ro)]); else if (ro && !s.roteiro) tot.semBase++;
    }
  }
  console.log('RCAs comparados:', tot.rcas, '| iguais -> produtividade:', tot.prod, 'dashboard:', tot.dash, 'devolucoes:', tot.dev, 'roteiro:', tot.rot, '| roteiro sem base:', tot.semBase);
  console.log('DIFERENCAS (' + difs.length + '):'); difs.slice(0, 25).forEach((x) => console.log(' -', x));
})();
