import fs from 'fs';
const o = JSON.parse(fs.readFileSync('scratch/sugestoes_simulacao.json'));
const RES = { 'comissão/RV em R$': 'metas e como está (3 no menu; comissão em R$ não sai no Jota)', 'cortes do pedido': 'cortes do mês (4.4)', 'faseamento da semana': 'faseamento do AS (1.4)', 'promoções/combos': 'campanhas e combos do mês (15)', 'sugestão de pedido': 'o que oferecer (6)' };
const NAO = { 'estoque': 'estoque', 'arquivo Excel': 'Excel', 'cadastro/redes': 'cadastro de redes', 'Q2': 'Q2', 'diferença de pontos para o concorrente': 'posição dos colegas (cada um vê só a sua)', 'clientes que compraram só uma indústria': 'análise pontual (só gerente)', 'histórico de 2025': 'análise pontual (só gerente)' };
const out = { feita: [], atencao: [], nao_vai: [] };
for (const x of o.atencao) {
  const gaps = (x.resp.split('Ainda falta: ')[1] || '').replace(/\.$/, '').split(/, (?![^()]*\))/).filter(Boolean);
  let sit, resp;
  if (!gaps.length || /gerente API MARCELO/.test(x.quem)) { sit = 'atencao'; resp = x.resp; }
  else if (gaps.some((g) => /entrega/.test(g))) { sit = 'atencao'; resp = 'Em breve: acompanhamento da entrega (NEXUS). O resto já está no Jota: digite menu.'; }
  else { const r = gaps.filter((g) => RES[g]).map((g) => RES[g]), n = gaps.filter((g) => NAO[g]).map((g) => NAO[g]);
    if (!r.length && n.length && gaps.length === n.length && !/,|\bE\b/.test(x.t)) { sit = 'nao_vai'; resp = 'Não vai: ' + n.join(', ') + '.'; }
    else { sit = 'feita'; resp = 'Já está no Jota (digite menu): ' + [...new Set(r)].join(' · ') + (n.length ? '. Não temos: ' + [...new Set(n)].join(', ') + '.' : '.'); } }
  out[sit].push({ ...x, resp });
}
fs.writeFileSync('scratch/sugestoes_72.json', JSON.stringify(out, null, 1));
for (const k in out) { console.log('==', k, out[k].length); for (const a of out[k]) console.log(a.id, a.quem.slice(0, 40), '|', a.resp.slice(0, 120)); }
