const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };
ed('public/brasileirao.html', (s) => {
  // cabecalho do Varejo: + Saldo de Gols (SG), classes de responsividade, "Bônus"
  s = tr(s, `              <th>Supervisor</th>
              <th style="text-align:right">PG (Pontos)</th>
              <th style="text-align:center">V</th>
              <th style="text-align:center">E</th>
              <th style="text-align:center">D</th>
              <th style="text-align:center">% Aprov</th>
              <th style="text-align:center" title="Resultado dos últimos 5 dias (V = vitória, E = empate, D = derrota); o mais recente fica à direita">Últimos jogos</th>
              <th style="text-align:center">Bônus Streak</th>`,
`              <th class="cv-sup">Supervisor</th>
              <th style="text-align:right">PG (Pontos)</th>
              <th style="text-align:center" class="cv-ved">V</th>
              <th style="text-align:center" class="cv-ved">E</th>
              <th style="text-align:center" class="cv-ved">D</th>
              <th style="text-align:center" title="Saldo de gols: pontos positivos menos pontos negativos de todos os lances">SG</th>
              <th style="text-align:center" class="cv-aprov">% Aprov</th>
              <th style="text-align:center" class="cv-forma" title="Resultado dos últimos 5 dias (V = vitória, E = empate, D = derrota); o mais recente fica à direita">Últimos jogos</th>
              <th style="text-align:center" title="Bônus de constância: 3 vitórias seguidas +3 · semana invicta +3">Bônus</th>`, 'thead');
  s = tr(s, `<tr><td colspan="13" style="text-align:center;padding:30px;color:var(--tx-mut)">Carregando Vendedores...</td></tr>`, `<tr><td colspan="14" style="text-align:center;padding:30px;color:var(--tx-mut)">Carregando Vendedores...</td></tr>`, 'colspan');
  // linhas do Varejo
  s = tr(s, `        <td style="color:var(--tx-mut);font-size:12px;">\${v.supervisor || '—'}</td>
        <td style="text-align:right" class="pts-cell">\${v.pts_tabela}</td>
        <td style="text-align:center"><span class="tag-badge tag-v">\${v.vitorias}</span></td>
        <td style="text-align:center"><span class="tag-badge tag-e">\${v.empates}</span></td>
        <td style="text-align:center"><span class="tag-badge tag-d">\${v.derrotas}</span></td>
        <td style="text-align:center;font-weight:700;color:var(--acc)">\${v.aprov}%</td>
        <td style="text-align:center"><div class="forma-container" title="\${formaTitulo}">\${formaHtml}</div></td>
        <td style="text-align:center">\${streakHtml}</td>`,
`        <td class="cv-sup" style="color:var(--tx-mut);font-size:12px;">\${v.supervisor || '—'}</td>
        <td style="text-align:right" class="pts-cell">\${v.pts_tabela}</td>
        <td class="cv-ved" style="text-align:center"><span class="tag-badge tag-v">\${v.vitorias}</span></td>
        <td class="cv-ved" style="text-align:center"><span class="tag-badge tag-e">\${v.empates}</span></td>
        <td class="cv-ved" style="text-align:center"><span class="tag-badge tag-d">\${v.derrotas}</span></td>
        <td style="text-align:center;font-weight:700;color:\${(v.sg || 0) >= 0 ? 'var(--ok,#22c55e)' : 'var(--bad,#ef4444)'}" title="Gols pró \${v.gp || 0} · gols contra \${v.gc || 0}">\${(v.sg || 0) >= 0 ? '+' + (v.sg || 0) : v.sg}</td>
        <td class="cv-aprov" style="text-align:center;font-weight:700;color:var(--acc)">\${v.aprov}%</td>
        <td class="cv-forma" style="text-align:center"><div class="forma-container" title="\${formaTitulo}">\${formaHtml}</div></td>
        <td style="text-align:center">\${streakHtml}</td>`, 'linhas');
  // responsividade da tabela de vendedores: por CLASSE (a coluna Bonus nunca some; antes sumia a 11a coluna)
  s = tr(s, `  #tab-vendedores .tb-league th:nth-child(11), #tab-vendedores .tb-league td:nth-child(11) { display: none; }\n`, '', 'r1');
  s = tr(s, `  #tab-vendedores .tb-league th:nth-child(4), #tab-vendedores .tb-league td:nth-child(4), #tab-vendedores .tb-league th:nth-child(10), #tab-vendedores .tb-league td:nth-child(10) { display: none; }\n`, `  .cv-sup, .cv-aprov { display: none; }\n`, 'r2');
  s = tr(s, `@media (max-width: 700px) {\n  main { padding: 0 8px; }`, `@media (max-width: 1000px) {\n  .cv-forma { display: none; }\n}\n@media (max-width: 700px) {\n  .cv-ved { display: none; }\n  .tag-badge { padding: 2px 6px; font-size: 11px; }\n  .nav-tabs { flex-wrap: wrap; }\n  main { padding: 0 8px; }`, 'r3');
  return s;
});
console.log('tudo ok');
