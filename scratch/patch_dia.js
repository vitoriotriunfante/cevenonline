const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ---------- A) "Gerente Regional" nao existe ----------
ed('public/brasileirao.html', (s) => {
  s = tr(s, '<th>Gerente Regional</th>', '<th>Gerente</th>', 'th');
  s = tr(s, '• <strong>Gerente Regional:</strong> Base = Todos os vendedores das filiais sob sua gestão.', '• <strong>Gerente:</strong> Base = Todos os vendedores da sua filial (em TPH e MCD, que têm 2 gerentes, os vendedores de cada gerente).', 'regul');
  return s;
});
ed('public/gestao-equipe.html', (s) => tr(s, '<th>Gerente Regional</th>', '<th>Gerente</th>', 'th ge'));

// ---------- B) TV/Matriz so mostram lance de hoje de verdade (sem madrugada repetida nem lance tirado da liga) ----------
ed('functions/api/tv-lances.js', (s) => tr(s,
  "    return resp({ dia, filial, lances: results || [] });\n",
  "    // Mesma regra da liga: nada de madrugada (lance de ontem repetido a meia-noite) e nada que foi tirado da liga com trilha (lances_excluidos_liga)\n" +
  "    const ex = new Set();\n" +
  "    try { const r2 = await env.DB.prepare('SELECT chave, motivo FROM lances_excluidos_liga WHERE dia = ?').bind(dia).all(); for (const e of r2.results || []) if (e && e.motivo) ex.add(e.chave); } catch { /* tabela ausente: segue sem exclusoes */ }\n" +
  "    const limpos = (results || []).filter((r) => String(r.hora_sp || '') >= '06:00:00' && !ex.has(String(r.chave || '').replace(/^[A-Z]{3}[|]/, '')) && !ex.has(r.chave));\n" +
  "    return resp({ dia, filial, lances: limpos });\n", 'tvl'));
// log local do navegador volta limpo (o anterior guardava os lances repetidos de madrugada)
ed('public/tvapp.html', (s) => tr(s, 'log:`ceven_tv_log_${FIL}_`', 'log:`ceven_tv_log2_${FIL}_`', 'k tv'));
ed('public/matrizapp.html', (s) => tr(s, "log: 'ceven_mtz_log_'", "log: 'ceven_mtz_log2_'", 'k mz'));

// ---------- C) dias sem compra e hora na frente do motivo, no detalhe de penalti ----------
for (const rel of ['public/tvapp.html', 'public/matrizapp.html']) {
  ed(rel, (s) => {
    s = tr(s, "<span style=\"font-weight:700;color:${tipo === 'penalti' ? '#fca5a5' : 'var(--acc)'}\">${esc(it.motivo || it.detalhe)}</span>",
      "<span style=\"font-weight:700;color:${tipo === 'penalti' ? '#fca5a5' : 'var(--acc)'}\">${it.hora ? '<small style=\"opacity:.7;font-weight:600\">' + esc(String(it.hora).slice(0, 5)) + '</small> · ' : ''}${esc(it.motivo || it.detalhe)}${it.dias != null ? ' · <span style=\"color:#fcd34d\">' + it.dias + ' dias sem compra</span>' : ''}</span>", rel + ' modal');
    return s;
  });
}
ed('public/tvapp.html', (s) => tr(s, '          dias: e.dias_sem_compra,\n', '          dias: e.dias_sem_compra,\n          hora: e.t,\n', 'tv hora'));

// ---------- D) seletor do painel dentro do titulo (fixo no topo, ao lado do titulo) ----------
ed('public/animacoes/tv-animacoes.js', (s) => s + `
// Coloca o seletor de painel NO CABECALHO do quadro (titulo fixo no topo): so se troca o menu, o resto rola por baixo
window.painelComSeletor = function (i, escolhido, bloco) {
  const sel = window.painelSeletorHtml(i, escolhido).replace(' style="', ' style="margin:0 8px;flex:0 1 auto;');
  return String(bloco).replace('<b>', sel + '<b>');
};
`);
ed('public/matrizapp.html', (s) => tr(s, '${painelSeletorHtml(i, id)}${BLOCOS[id] || painelLancesBlocoHtml(id, LOG, esc, \'h3\')}', "${painelComSeletor(i, id, BLOCOS[id] || painelLancesBlocoHtml(id, LOG, esc, 'h3'))}", 'mz sel'));
ed('public/tvapp.html', (s) => tr(s, "const html = painelSeletorHtml(i, SL[i]) + (DEF[SL[i]] || painelLancesBlocoHtml(SL[i], LOG, esc, 'h2'));", "const html = painelComSeletor(i, SL[i], DEF[SL[i]] || painelLancesBlocoHtml(SL[i], LOG, esc, 'h2'));", 'tv sel'));

// ---------- E) horarios dos lances: acrescimos so de 16h30 a 18h00 (17h30 a 19h00 no fuso) ----------
ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "      const limiteAcrescimos = v.fuso1h ? 18 : 17;\n      if (ultimoCheckin.hora >= limiteAcrescimos) out.push({ chave: `gol_acrescimos|${v.id}`, nivel: 'gol', v, prova: `check-in as ${ultimoCheckin.hms} (a partir das ${limiteAcrescimos}h)` });",
    "      // Acrescimos: check-in entre 16h30 e 18h00 (17h30 e 19h00 no fuso: TCG, MCD, TCA). Depois do limite NAO e aceito: ninguem trabalha fora do horario (Vitorio, 06/10/2026)\n" +
    "      const acrIni = (v.fuso1h ? 17 : 16) * 60 + 30, acrFim = (v.fuso1h ? 19 : 18) * 60;\n" +
    "      if (ultimoCheckin.horaMin >= acrIni && ultimoCheckin.horaMin <= acrFim) out.push({ chave: `gol_acrescimos|${v.id}`, nivel: 'gol', v, prova: `check-in as ${ultimoCheckin.hms} (janela ${Math.floor(acrIni / 60)}h${String(acrIni % 60).padStart(2, '0')} ate ${acrFim / 60}h00)` });", 'cron acr');
  return s;
});
ed('public/tvapp.html', (s) => {
  s = tr(s, "      const limiteAcrescimos = fuso1h ? 18 : 17;\n      if (ultimoCheckin.hora >= limiteAcrescimos && !out.some(", "      const acrIni = (fuso1h ? 17 : 16) * 60 + 30, acrFim = (fuso1h ? 19 : 18) * 60; // 16h30-18h00 (17h30-19h00 no fuso); depois do limite nao e aceito\n      if (ultimoCheckin.horaMin >= acrIni && ultimoCheckin.horaMin <= acrFim && !out.some(", 'tv acr');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = tr(s, "      const limiteAcrescimos = fuso1hMtz ? 18 : 17;\n      if (ultimoCheckin.hora >= limiteAcrescimos && !out.some(", "      const acrIni = (fuso1hMtz ? 17 : 16) * 60 + 30, acrFim = (fuso1hMtz ? 19 : 18) * 60; // 16h30-18h00 (17h30-19h00 no fuso); depois do limite nao e aceito\n      if (ultimoCheckin.horaMin >= acrIni && ultimoCheckin.horaMin <= acrFim && !out.some(", 'mz acr');
  return s;
});
for (const rel of ['config/pontuacao_brasileirao.json', 'public/pontuacao_brasileirao.json']) {
  ed(rel, (s) => {
    s = s.replace(/("gol_acrescimos": \{[^\n]*?"motivo": ")[^"]*"/, (m, a) => a + 'Pedido fechado no fim do expediente: check-in entre 16h30 e 18h00 (17h30 e 19h00 no fuso: TCG, MCD, TCA), sem desistir da rota. Depois do limite NÃO é aceito: ninguém trabalha fora do horário. Vale a partir de 06/10/2026."');
    s = s.replace(/("gol_relampago": \{[^\n]*?"motivo": ")[^"]*"/, (m, a) => a + 'Pedido fechado logo no início do dia: check-in antes das 09h00 (10h00 no fuso: TCG, MCD, TCA). Depois do limite o lance não vale."');
    JSON.parse(s);
    return s;
  });
}

// ---------- F) cartoes amarelos: UM popup por vez com a lista (nao 1 popup por vendedor) ----------
ed('public/tvapp.html', (s) => {
  s = tr(s, "novos.filter(a => ['vermelho', 'golcontra', 'impedimento', 'amarelo', 'defesa'].includes(a.nivel))", "novos.filter(a => ['vermelho', 'golcontra', 'impedimento', 'defesa'].includes(a.nivel))", 'tv lista');
  s = tr(s, "  ['visita10', 'venda10'].forEach(n => { const l = novos.filter(a => a.nivel === n); if (l.length) ESPERA.push({tipo: n, l}); });\n", "  ['visita10', 'venda10'].forEach(n => { const l = novos.filter(a => a.nivel === n); if (l.length) ESPERA.push({tipo: n, l}); });\n  { const l = novos.filter(a => a.nivel === 'amarelo'); if (l.length) ESPERA.push({tipo: 'amarelos', l, score: 20}); } // amarelos das 10h: um popup com a lista\n", 'tv push');
  s = tr(s, "  } else if (item.tipo === 'venda10') {\n    titulo = '🟥 CARTÃO VERMELHO';", "  } else if (item.tipo === 'amarelos') {\n    titulo = '🟨 CARTÕES AMARELOS'; sub = `${item.l.length} vendedor(es) COM ROTA sem pedido e/ou sem visita às ${LIMITE_H}h`; cls = 'f1';\n    dec = item.l.slice(0, 8).map(a => `<div class=\"ln hot\"><b>${nomeComRca(a.v)}</b><span>${a.subtipo === 'sem_checkin' ? 'nenhuma visita / check-in de varejo' : a.v.feitas + '/' + a.v.rota + ' visitas · 0 pedidos'}${a.v.sup && !ehSupFalso(a.v.sup) ? ' · sup. ' + esc(a.v.sup) : ''}</span></div>`).join('') + (item.l.length > 8 ? `<div class=\"ln\"><b>+${item.l.length - 8}</b><span>outros</span></div>` : '');\n    veredito = '🟨 Cobrar o compromisso da manhã: pedido e visita até as 10h. Quem continuar sem visita às 11h leva o vermelho.';\n  } else if (item.tipo === 'venda10') {\n    titulo = '🟥 CARTÃO VERMELHO';", 'tv branch');
  s = tr(s, "  if (tipo === 'amarelo') return { nome: 'Cartão Amarelo', pts: '-3 PONTOS NA LIGA', cor: '#eab308' };", "  if (tipo === 'amarelo' || tipo === 'amarelos') return { nome: 'Cartão Amarelo', pts: tipo === 'amarelos' ? '-3 PONTOS NA LIGA CADA' : '-3 PONTOS NA LIGA', cor: '#eab308' };", 'tv pts');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = tr(s, "  novos.filter(a => a.nivel === 'amarelo').forEach(a => {\n    ESPERA.push({tipo: 'amarelo', sig: a.sig, v: a.v, a, sub: 'Rota ativa sem vendas às 10h', score: ehFechamento ? 8 : 14});\n  });\n",
    "  { const por = {}; novos.filter(a => a.nivel === 'amarelo').forEach(a => (por[a.sig] = por[a.sig] || []).push(a)); Object.entries(por).forEach(([sig, l]) => ESPERA.push({tipo: 'amarelos', sig, l, score: (ehFechamento ? 8 : 14) + l.length / 4})); } // um popup por filial com a lista\n", 'mz push');
  s = tr(s, "  } else {\n    titulo = item.tipo === 'venda10' ? '🟥 CARTÃO VERMELHO' : '⛔ EXPULSÃO';", "  } else if (item.tipo === 'amarelos') {\n    titulo = '🟨 CARTÕES AMARELOS'; sub = `${item.sig} · ${(item.l || []).length} vendedor(es) COM ROTA sem pedido e/ou sem visita às ${LIMITE_H}h`; cls = 'f1';\n    dec = (item.l || []).slice(0, 8).map(a => `<div class=\"ln hot\"><b>${nomeComRca(a.v)}</b><span>${a.subtipo === 'sem_checkin' ? 'nenhuma visita / check-in de varejo' : (a.v ? a.v.feitas : 0) + '/' + (a.v ? a.v.rota : 0) + ' visitas · 0 pedidos'}${a.v && a.v.sup && !ehSupFalso(a.v.sup) ? ' · sup. ' + esc(a.v.sup) : ''}</span></div>`).join('') + ((item.l || []).length > 8 ? `<div class=\"ln\"><b>+${item.l.length - 8}</b><span>outros</span></div>` : '');\n    veredito = '🟨 Cobrar o compromisso da manhã: pedido e visita até as 10h. Quem continuar sem visita às 11h leva o vermelho.';\n  } else {\n    titulo = item.tipo === 'venda10' ? '🟥 CARTÃO VERMELHO' : '⛔ EXPULSÃO';", 'mz branch');
  s = tr(s, "  if (tipo === 'amarelo') return { nome: 'Cartão Amarelo', pts: '-3 PONTOS NA LIGA', cor: '#eab308' };", "  if (tipo === 'amarelo' || tipo === 'amarelos') return { nome: 'Cartão Amarelo', pts: tipo === 'amarelos' ? '-3 PONTOS NA LIGA CADA' : '-3 PONTOS NA LIGA', cor: '#eab308' };", 'mz pts');
  return s;
});
console.log('tudo ok');
