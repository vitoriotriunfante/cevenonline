const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// SUPER PEDIDO DO AS = R$ 75.000 no dia (Vitório, 07/10/2026; base: Varejo R$ 15.000 = 5,8% dos vendedor-dias, AS R$ 75.000 = ~10%)
ed('functions/api/cron-lances.js', (s) => tr(s, "    if ((v.dig || 0) >= 15000) out.push({ chave: `gol_super|${v.id}`, nivel: 'gol', v, prova: comQ(v, `digitado do dia ${brl(v.dig)} (minimo R$ 15.000)`) });",
  "    const minSuper = v.canal === 'AS' ? 75000 : 15000; // AS tem pedido muito maior: R$ 75.000 no dia (Varejo R$ 15.000)\n    if ((v.dig || 0) >= minSuper) out.push({ chave: `gol_super|${v.id}`, nivel: 'gol', v, prova: comQ(v, `digitado do dia ${brl(v.dig)} (minimo R$ ${minSuper.toLocaleString('pt-BR')})`) });", 'cron'));
ed('public/tvapp.html', (s) => tr(s, "    if ((v.dig || 0) >= 15000) {\n      out.push({key: `gol_super|${v.id}`", "    if ((v.dig || 0) >= (v.canal === 'AS' ? 75000 : 15000)) { // AS: R$ 75.000 no dia\n      out.push({key: `gol_super|${v.id}`", 'tv'));
ed('public/matrizapp.html', (s) => tr(s, "    if ((v.dig || 0) >= 15000) {\n      out.push({key: `${sig}|gol_super|${v.id}`", "    if ((v.dig || 0) >= (v.canal === 'AS' ? 75000 : 15000)) { // AS: R$ 75.000 no dia\n      out.push({key: `${sig}|gol_super|${v.id}`", 'mz'));
// auditoria: o minimo vem escrito na propria prova
ed('functions/_lib/auditoria_lance.js', (s) => tr(s, "    m = /digitado do dia R\\$ ([\\d.,]+)/.exec(obs);\n    if (!m) falha('super pedido sem o valor digitado do dia'); else if (num(m[1]) < 15000) falha(`super pedido com digitado R$ ${m[1]} (mínimo R$ 15.000)`);",
  "    m = /digitado do dia R\\$ ([\\d.,]+)/.exec(obs);\n    const mm = /minimo R\\$ ([\\d.,]+)/.exec(obs), minimo = mm ? num(mm[1]) : 15000; // Varejo R$ 15.000; AS R$ 75.000 (o minimo vem escrito na prova)\n    if (!m) falha('super pedido sem o valor digitado do dia'); else if (![15000, 75000].includes(minimo)) falha(`super pedido com minimo estranho (R$ ${mm && mm[1]})`); else if (num(m[1]) < minimo) falha(`super pedido com digitado R$ ${m[1]} (mínimo R$ ${minimo.toLocaleString('pt-BR')})`);", 'aud'));
// tela: regras do AS (regulamento, gabarito)
ed('public/brasileirao.html', (s) => {
  s = tr(s, "    const mix = /^dobrou o mix/i.test(semAcento(c.textContent).replace(/^[^a-z0-9]+/, ''));\n    if (CANAL === 'AS' && mix) {", "    const nomeN = semAcento(c.dataset.orig ? c.dataset.orig.replace(/<[^>]*>/g, '') : c.textContent).replace(/^[^a-z0-9]+/, '').trim();\n    const mix = /^dobrou o mix/i.test(nomeN), superP = /^super pedido/i.test(nomeN);\n    if (CANAL === 'AS' && superP) { if (tds[2]) tds[2].textContent = 'AS: venda do dia (digitado) a partir de R$ 75.000 (no Varejo, R$ 15.000). Pedido grande é normal no Autosserviço.'; c.innerHTML = c.dataset.orig; }\n    else if (CANAL === 'AS' && mix) {", 'reg');
  s = tr(s, ".map(r => (CANAL === 'AS' && /^dobrou o mix/i.test(semAcento(r.nome)) ? { ...r, nome: NOME_MIX_AS, motivo:", ".map(r => (CANAL === 'AS' && /^super pedido/i.test(semAcento(r.nome)) ? { ...r, motivo: 'AS: venda do dia (digitado) a partir de R$ 75.000.' } : r)).map(r => (CANAL === 'AS' && /^dobrou o mix/i.test(semAcento(r.nome)) ? { ...r, nome: NOME_MIX_AS, motivo:", 'gab');
  s = tr(s, "Super Pedido (valor do AS em definição)", "Super Pedido (no AS a partir de R$ 75.000 no dia)", 'txt');
  return s;
});
console.log('tudo ok');
