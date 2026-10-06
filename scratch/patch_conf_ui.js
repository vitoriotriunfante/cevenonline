const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

ed('functions/api/cron-conferencia-dia.js', (s) => {
  s = tr(s, "    return new Response(JSON.stringify({ dia, conferidos:", "    let fechados = [];\n    try { const { results: fz } = await env.DB.prepare('SELECT dia, fechado_em, regras_versao, total_lances, total_pontos FROM liga_fechamento ORDER BY dia DESC LIMIT 15').all(); fechados = fz || []; } catch { /* ainda nao fechou nenhum dia */ }\n    return new Response(JSON.stringify({ dia, fechados, conferidos:", 'fechados');
  return s;
});

ed('public/divergencias.html', (s) => {
  s = tr(s, "  PEND = {}; let FILA = [];\n", "  PEND = {}; let FILA = [];\n  let CONF = null; try { CONF = await (await fetch('/api/cron-conferencia-dia?t=' + Date.now())).json(); } catch (e) {}\n", 'fetch');
  s = tr(s, "  const decisaoHtml = secao(", "  const diff = (a, b) => (Number(a) - Number(b));\n  const confHtml = !CONF || CONF.erro ? '' : secao('Conferência do dia contra o CEVEN e dias fechados',\n    `${CONF.conferidos} de ${CONF.total} vendedores conferidos hoje (digitado e devoluções; tolerância R$ ${nv(CONF.tolerancia_reais)}) · ${(CONF.divergentes || []).length} divergência(s). A conferência roda sozinha depois das 19h30, em fatias. Dias já fechados (congelados, não mudam mais): ` + ((CONF.fechados || []).length ? CONF.fechados.map(x => x.dia.slice(8) + '/' + x.dia.slice(5, 7) + ' (' + x.total_lances + ' lances, ' + nv(x.total_pontos) + ' pts, regras ' + esc(x.regras_versao) + ')').join(' · ') : 'nenhum ainda'),\n    tabela([{t: 'Filial', f: l => '<b>' + esc(l.filial) + '</b>'}, {t: 'Vendedor', f: l => esc(l.nome || '—') + ' <span style=\"color:var(--mut)\">(' + esc(l.rca) + ')</span>'}, {t: 'O quê', f: l => esc(l.campo)}, {t: 'Nosso banco', n: 1, f: l => brl(l.nosso)}, {t: 'CEVEN agora', n: 1, f: l => brl(l.ceven)}, {t: 'Diferença', n: 1, f: l => '<b style=\"color:var(--ruim)\">' + brl(diff(l.nosso, l.ceven)) + '</b>'}], fAtual ? (CONF.divergentes || []).filter(x => x.filial === fAtual) : (CONF.divergentes || []), CONF.conferidos ? 'Nenhuma divergência nos vendedores já conferidos.' : 'Ainda não conferido hoje: a conferência começa às 19h30.'));\n  const decisaoHtml = confHtml + secao(", 'html');
  return s;
});
