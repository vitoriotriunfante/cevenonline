const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ============ GOL DE MARCA PROPRIA (pedido do Vitório, 05–07/10/2026; vale a partir de 08/10/2026) ============
// Pedido do cliente do dia com R$ 50 ou mais de MARCA PROPRIA (indústria "MARCA PROPRIA TRIUNFANTE"): lance PROPRIO, +8 pontos (acima de qualquer outro gol), qualificado pelas indústrias do pedido
// como os demais gols de cliente, ⭐ no popup, e sai SEMPRE: na frente de tudo, sozinho, sem esperar intervalo, nunca dentro de resumo. Vale no Varejo e no AS.
const DESDE = '2026-10-08', MIN = 50, PTS = 8;

// ----- regulamento (config + copia publica): regra nova => versao nova -----
for (const rel of ['config/pontuacao_brasileirao.json', 'public/pontuacao_brasileirao.json']) {
  ed(rel, (s) => {
    s = tr(s, '    "gol_super": {', '    "gol_marca_propria": { "nome": "⭐ Gol de Marca Própria", "pontos": ' + PTS + ', "motivo": "Pedido do cliente no dia com R$ ' + MIN + ' ou mais de MARCA PRÓPRIA (indústria Marca Própria Triunfante). É foco da empresa: lance próprio, o mais valioso dos gols, ganha a ESTRELA, nível (bronze a platina) pelas indústrias do pedido e é SEMPRE exibido na TV, um a um. Vale a partir de 08/10/2026, no Varejo e no AS." },\n    "gol_super": {', 'regra');
    JSON.parse(s); return s;
  });
}
ed('config/pontuacao_brasileirao.json', (s) => tr(s, '"versao_regras": "2026-10-07.2",\n  "vigente_desde": "2026-10-07",', '"versao_regras": "2026-10-08.1",\n  "vigente_desde": "2026-10-07",', 'versao'));
ed('functions/_lib/liga_fechamento.js', (s) => tr(s, "export const REGRAS_VERSAO = '2026-10-07.2';", "export const REGRAS_VERSAO = '2026-10-08.1';", 'ver'));

// ----- pontos no endpoint da liga -----
ed('functions/api/brasileirao-lances.js', (s) => tr(s, "  gol_goleada: {", "  gol_marca_propria: { nome: '⭐ Gol de Marca Própria', pontos: " + PTS + ", motivo: 'Pedido com R$ " + MIN + " ou mais de Marca Própria (foco da empresa)' },\n  gol_goleada: {", 'rp'));

// ----- coletor (servidor) -----
ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "      if (c.dobrouMix) out.push(", "      // GOL DE MARCA PROPRIA (a partir de 08/10/2026): pedido do cliente com R$ 50+ de Marca Propria Triunfante\n      { const mp = (c.industrias || []).filter((x) => /MARCA PROPRIA/.test(String(x.n || '').toUpperCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''))).reduce((a, x) => a + (Number(x.v) || 0), 0);\n        if (t.dia >= '" + DESDE + "' && mp >= " + MIN + " && ['POSITIVADO', 'EFETIVADO'].includes(c.status)) out.push({ chave: `gol_marca_propria|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: [`MARCA PROPRIA R$ ${mp.toFixed(2).replace('.', ',')} (minimo R$ " + MIN + ")`, provaPedidoHoje(c), (qualificaGol(v.carteira, c) || {}).texto].filter(Boolean).join(' | ') }); }\n      if (c.dobrouMix) out.push(", 'cron');
  return s;
});

// ----- TV e Matriz -----
const DETECTA = (prefixo, campoSig) =>
  "      // --- LANCE: GOL DE MARCA PROPRIA (a partir de 08/10/2026): pedido do cliente com R$ " + MIN + "+ de Marca Propria Triunfante ---\n" +
  "      { const mp = (c.industrias || []).filter(x => /marca propria/.test(String(x.n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))).reduce((a, x) => a + (Number(x.v) || 0), 0);\n" +
  "        if (HOJE0 >= '" + DESDE + "' && mp >= " + MIN + " && ['POSITIVADO', 'EFETIVADO'].includes(c.status)) out.push({key: `" + prefixo + "gol_marca_propria|${v.id}|${c.id}`, " + campoSig + "nivel: 'gol', subtipo: 'marca_propria', v, c, valor: mp}); }\n";
const ANCORA_MIX = "      // --- LANCE G03: DOBROU O MIX (calculado em tv-vendedor.js contra o histórico do cliente) ---\n";
const COMUM = (s) => {
  s = tr(s, "  if (subtipo === 'dobrou_mix') return `${c && c.nome} · dobrou o mix do cliente!`;", "  if (subtipo === 'marca_propria') return `${c && c.nome} · ⭐ GOL DE MARCA PRÓPRIA! R$ ${(Number(valor) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} de Marca Própria no pedido!`;\n  if (subtipo === 'dobrou_mix') return `${c && c.nome} · dobrou o mix do cliente!`;", 'texto');
  s = tr(s, "  if (subtipo === 'dobrou_mix') return { nome: 'Dobrou o Mix', pts: '+4 PONTOS NA LIGA', cor: '#22c55e' };", "  if (subtipo === 'marca_propria') return { nome: '⭐ Gol de Marca Própria', pts: '+" + PTS + " PONTOS NA LIGA', cor: '#facc15' };\n  if (subtipo === 'dobrou_mix') return { nome: 'Dobrou o Mix', pts: '+4 PONTOS NA LIGA', cor: '#22c55e' };", 'info');
  s = tr(s, "const subCliente = ['inativo_recuperado', 'drible_vaca', 'recorrencia_salva', 'dobrou_mix', 'dobradinha_quinzenas'],", "const subCliente = ['inativo_recuperado', 'drible_vaca', 'recorrencia_salva', 'dobrou_mix', 'dobradinha_quinzenas', 'marca_propria'],", 'sub');
  s = tr(s, "const ehBomLance = (x) =>", "const ehMarcaPropria = (x) => x.tipo === 'gol' && ((x.a && x.a.subtipo) || x.subtipo) === 'marca_propria'; // foco da empresa: sai SEMPRE, sozinho, na frente e sem esperar intervalo\nconst ehBomLance = (x) =>", 'proprio');
  return s;
};
ed('public/tvapp.html', (s) => {
  s = COMUM(s);
  s = tr(s, ANCORA_MIX, DETECTA('', '') + ANCORA_MIX, 'det');
  s = tr(s, "    ESPERA.unshift({tipo: 'gol', v: a.v, c: a.c, sub: textoGol(a.subtipo, a.valor, a.c, a.horaReal), score: 99});", "    ESPERA.unshift({tipo: 'gol', v: a.v, c: a.c, a, sub: textoGol(a.subtipo, a.valor, a.c, a.horaReal), score: a.subtipo === 'marca_propria' ? 500 : 99});", 'enf');
  s = tr(s, "function podeVAR(bom) {\n  const agora = Date.now(); while (VARS.length && agora - VARS[0] > 3600e3) VARS.shift();\n", "function podeVAR(bom, proprio) {\n  const agora = Date.now(); while (VARS.length && agora - VARS[0] > 3600e3) VARS.shift();\n  if (proprio) return !emVAR && !FILA.length; // Gol de Marca Propria: sem intervalo e sem limite por hora\n", 'pode');
  s = tr(s, "  if (ESPERA.length && podeVAR(ESPERA.some(ehBomLance)) && ruimLiberado()) {", "  if (ESPERA.length && podeVAR(ESPERA.some(ehBomLance), ESPERA.some(ehMarcaPropria)) && (ESPERA.some(ehMarcaPropria) || ruimLiberado())) {", 'lib1');
  s = tr(s, "    const iBom = ESPERA.findIndex(ehBomLance); /* gol, hat-trick e defesa saem sozinhos e na frente: o resumo fica so para o que e ruim */\n    const item = iInv >= 0 ? ESPERA.splice(iInv, 1)[0] : (iBom >= 0 ?", "    const iProp = ESPERA.findIndex(ehMarcaPropria); /* Gol de Marca Propria: o primeiro da fila, sempre sozinho */\n    const iBom = ESPERA.findIndex(ehBomLance); /* gol, hat-trick e defesa saem sozinhos e na frente: o resumo fica so para o que e ruim */\n    const item = iInv >= 0 ? ESPERA.splice(iInv, 1)[0] : (iProp >= 0 ? ESPERA.splice(iProp, 1)[0] : iBom >= 0 ?", 'lib2');
  s = tr(s, "    if (iInv < 0 && iBom < 0) ULT_RUIM = Date.now();", "    if (iInv < 0 && iBom < 0 && iProp < 0) ULT_RUIM = Date.now();", 'lib3');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = COMUM(s);
  s = tr(s, ANCORA_MIX, DETECTA('${sig}|', 'sig, ') + ANCORA_MIX, 'det');
  s = tr(s, "score: 28 + boost + Math.min(15, (a.valor || 0) / 3000)});", "score: a.subtipo === 'marca_propria' ? 500 : 28 + boost + Math.min(15, (a.valor || 0) / 3000)});", 'enf');
  s = tr(s, "function podeVAR(bom) { const agora = Date.now(); while (VARS.length && agora - VARS[0] > 3600e3) VARS.shift(); return !emVAR && !FILA.length &&", "function podeVAR(bom, proprio) { const agora = Date.now(); while (VARS.length && agora - VARS[0] > 3600e3) VARS.shift(); if (proprio) return !emVAR && !FILA.length; /* Gol de Marca Propria: sem intervalo e sem limite por hora */ return !emVAR && !FILA.length &&", 'pode');
  s = tr(s, "  if (ESPERA.length && podeVAR(ESPERA.some(ehBomLance)) && ruimLiberado()) {", "  if (ESPERA.length && podeVAR(ESPERA.some(ehBomLance), ESPERA.some(ehMarcaPropria)) && (ESPERA.some(ehMarcaPropria) || ruimLiberado())) {", 'lib1');
  s = tr(s, "    const iBom = ESPERA.findIndex(ehBomLance); /* gol, hat-trick e defesa saem sozinhos e na frente: o resumo fica so para o que e ruim */\n    const item = iInv >= 0 ? ESPERA.splice(iInv, 1)[0] : (iBom >= 0 ?", "    const iProp = ESPERA.findIndex(ehMarcaPropria); /* Gol de Marca Propria: o primeiro da fila, sempre sozinho */\n    const iBom = ESPERA.findIndex(ehBomLance); /* gol, hat-trick e defesa saem sozinhos e na frente: o resumo fica so para o que e ruim */\n    const item = iInv >= 0 ? ESPERA.splice(iInv, 1)[0] : (iProp >= 0 ? ESPERA.splice(iProp, 1)[0] : iBom >= 0 ?", 'lib2');
  s = tr(s, "if (iInv < 0 && iBom < 0) ULT_RUIM = Date.now();", "if (iInv < 0 && iBom < 0 && iProp < 0) ULT_RUIM = Date.now();", 'lib3');
  return s;
});
// auditoria: o gol de marca propria exige o valor na prova
ed('functions/_lib/auditoria_lance.js', (s) => tr(s, "  } else if (tipo === 'gol_campeao') {", "  } else if (tipo === 'gol_marca_propria') {\n    m = /MARCA PROPRIA R\$ ([\d.,]+) \(minimo R\$ (\d+)\)/.exec(obs);\n    if (!m) falha('gol de marca propria sem o valor de marca propria na prova'); else if (num(m[1]) < +m[2] || +m[2] < " + MIN + ") falha(`gol de marca propria com R$ ${m[1]} (minimo R$ " + MIN + ")`);\n    if (!/PEDIDO DE HOJE: \d+/.test(obs)) falha('gol de marca propria sem o pedido de hoje comprovado');\n  } else if (tipo === 'gol_campeao') {", 'aud'));
console.log('tudo ok');
