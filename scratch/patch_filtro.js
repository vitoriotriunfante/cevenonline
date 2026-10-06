const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r); return s.replace(de, () => para); };
ed('functions/api/divergencias.js', (s) => {
  s = tr(s, "const velhas = linhas.filter((l) => { const c = mapa.get(l.filial + '|' + l.codigo); return !c || Date.now() - c.em > 6 * 3600e3; });", "const velhas = linhas.filter((l) => { const c = mapa.get(l.filial + '|' + l.codigo); return !c || Date.now() - c.em > 6 * 3600e3; }).slice(0, 20); // limite de chamadas por requisicao: completa nas proximas atualizacoes da tela", 'lim');
  return s;
});
ed('public/divergencias.html', (s) => {
  s = tr(s, "<div id=\"senhaBox\">", "<div id=\"senhaBox\" style=\"margin-bottom:6px\"><b>Filial</b> <select id=\"filtroFilial\" style=\"padding:7px 10px;border-radius:8px;border:1px solid var(--linha);background:var(--card);color:var(--tx)\"><option value=\"\">Todas</option></select></div>\n<div id=\"senhaBox\">", 'sel');
  s = tr(s, "  const dc = d.decisao || {nao_mostra: [], fora_da_gestao: []};\n", "  const dc0 = d.decisao || {nao_mostra: [], fora_da_gestao: []};\n  const selF = $('filtroFilial'); const filiaisL = [...new Set([...dc0.nao_mostra, ...dc0.fora_da_gestao].map(x => x.filial))].sort();\n  let fAtual = selF.value; if (!fAtual) { try { fAtual = localStorage.getItem('ceven_div_filial') || ''; } catch (e) {} }\n  selF.innerHTML = '<option value=\"\">Todas</option>' + filiaisL.map(f => `<option value=\"${f}\"${f === fAtual ? ' selected' : ''}>${f}</option>`).join('');\n  const fil = (L) => fAtual ? L.filter(x => x.filial === fAtual) : L;\n  const dc = {nao_mostra: fil(dc0.nao_mostra), fora_da_gestao: fil(dc0.fora_da_gestao)};\n", 'dc');
  s = tr(s, "$('btn').onclick = carrega;", "$('filtroFilial').onchange = () => { try { localStorage.setItem('ceven_div_filial', $('filtroFilial').value); } catch (e) {} carrega(); };\n$('btn').onclick = carrega;", 'on');
  return s;
});
