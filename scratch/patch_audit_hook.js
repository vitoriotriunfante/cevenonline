const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "  // FECHAMENTO E CONFERENCIA DO DIA (Vitório",
"  // AUDITORIA LANCE POR LANCE (Vitório, 06/10/2026): a cada ~30 min (e depois do fechamento) confere a prova de cada lance que conta pontos\n" +
"  let auditoria = 'pulado';\n" +
"  if (t.h >= 8 && (t.m % 30) < 5) {\n" +
"    try { const ra = await fetch(`${origin}/api/cron-auditoria-lances?rodar=1`, { signal: AbortSignal.timeout(60000) }); const ja = await ra.json().catch(() => ({})); auditoria = ja.auditado ? `${ja.com_falha} falha(s) em ${ja.auditados}` : (ja.status || String(ra.status)); } catch { auditoria = 'falhou'; }\n" +
"  }\n\n" +
"  // FECHAMENTO E CONFERENCIA DO DIA (Vitório", 'hook');
  s = tr(s, "semana_invicta: invicta, arvore, fechamento, conferencia,", "semana_invicta: invicta, arvore, auditoria, fechamento, conferencia,", 'saida');
  return s;
});

ed('public/divergencias.html', (s) => {
  s = tr(s, "  let CONF = null; try {", "  let AUD = null; try { AUD = await (await fetch('/api/cron-auditoria-lances?t=' + Date.now())).json(); } catch (e) {}\n  let CONF = null; try {", 'fetch');
  s = tr(s, "  const decisaoHtml = confHtml + secao(", "  const audHtml = !AUD || AUD.erro ? '' : secao('Auditoria lance por lance (hoje)',\n    AUD.auditado ? `${nv(AUD.auditados)} lances auditados · ${nv(AUD.ok)} com prova correta · <b style=\"color:${AUD.com_falha ? 'var(--ruim)' : 'var(--ok)'}\">${nv(AUD.com_falha)} com falha</b> (atualizada às ${esc(AUD.em)} UTC, a cada ~30 min). Cada lance que conta pontos é conferido contra a regra oficial usando a prova gravada nele. Lance com falha aparece abaixo; quem decide retirar da liga é você.` : 'Ainda não rodou hoje: roda sozinha a cada 30 minutos a partir das 8h.',\n    AUD.auditado ? tabela([{t: 'Filial', f: l => '<b>' + esc(l.filial) + '</b>'}, {t: 'Hora', f: l => esc(l.hora || '')}, {t: 'Vendedor', f: l => esc(l.vendedor || '—') + ' <span style=\"color:var(--mut)\">(' + esc(l.rca) + ')</span>'}, {t: 'Lance', f: l => esc(l.regra)}, {t: 'Pontos', n: 1, f: l => nv(l.pontos)}, {t: 'O que falhou', f: l => (l.falhas || []).map(esc).join('; ')}], fAtual ? (AUD.falhos || []).filter(x => x.filial === fAtual) : (AUD.falhos || []), 'Nenhum lance com falha de prova.') : '');\n  const decisaoHtml = audHtml + confHtml + secao(", 'html');
  return s;
});
