
// ====================== SUPERVISORES: cards com fotos + painel gerencial da semana (Vitório, 06/10/2026) ======================
// Mesmo formato na Matriz (botão Supervisores) e na TV da filial. Fonte: /api/tv-supervisores (dia) e /api/tv-supervisores-semana (segunda a sexta).
(function () {
  const css = document.createElement('style');
  css.textContent =
    '.sxc{padding:12px 18px;border-radius:12px;background:var(--card2,#131c30);margin-bottom:8px}' +
    '.sxc.bad{background:#2a0a0a;border:2px solid var(--bad,#ef4444)}.sxc.warn{border:1px solid var(--warn,#f59e0b)}' +
    '.sxcab{display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:center;font-weight:700;font-size:20px}' +
    '.sxchip{font-size:14px;font-weight:800;padding:5px 12px;border-radius:99px;white-space:nowrap}' +
    '.sxok{background:#22c55e26;color:#86efac}.sxno{background:var(--bad,#ef4444);color:#fff}' +
    '.sxret{display:flex;gap:16px;flex-wrap:wrap;margin-top:6px;font-size:14px;color:var(--mut,#8b9bbd)}' +
    '.sxfotos{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.sxfotos img{width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--line,#1e2a44)}' +
    '.sxt{width:100%;border-collapse:separate;border-spacing:3px;margin-top:6px}.sxt th{color:var(--mut,#8b9bbd);font-size:12px;text-transform:uppercase;text-align:center;padding:4px;letter-spacing:.05em}' +
    '.sxt th:first-child,.sxt td:first-child{text-align:left}' +
    '.sxt td{text-align:center;padding:6px 4px;border-radius:6px;font-weight:800;font-size:14px;background:var(--card2,#131c30)}' +
    '.sxt td.n{font-weight:600;font-size:16px;background:transparent}.sxt td.fez{background:#14532d;color:#86efac}.sxt td.nao{background:#7f1d1d;color:#fecaca}' +
    '.sxt td.par{background:#78350f;color:#fde68a}.sxt td.pen{background:#1e293b;color:#cbd5e1}.sxt td.fut{color:var(--mut,#8b9bbd);font-weight:500}' +
    '.sxt td small{display:block;font-weight:500;font-size:11px;opacity:.85}.sxt td.tot{background:transparent;font-size:15px}';
  document.head.appendChild(css);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const peso = (x) => (!x.fez_compromisso && !x.iniciou_ret ? 0 : !x.fez_compromisso || !x.iniciou_ret ? 1 : 2);

  // cards do dia (nome, compromisso, rota/RET, PDVs, nota media e fotos) — lista de /api/tv-supervisores
  window.supCardsHtml = function (lista) {
    const ord = [...(lista || [])].sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome));
    if (!ord.length) return '<div style="color:var(--mut,#8b9bbd);padding:12px 0">Sem supervisores com dados no CEVEN.</div>';
    return ord.map((x) => {
      const d = x.retDetalhe;
      const ret = d ? '<div class="sxret"><span>📍 ' + d.pdvs + ' PDV(s) visitado(s)' + (d.primeiroCheckin ? ' · ' + e(d.primeiroCheckin) + (d.ultimoCheckout ? '–' + e(d.ultimoCheckout) : '') : '') + '</span>' +
        (d.scoreMedio != null ? '<span>⭐ Nota média ' + d.scoreMedio + '</span>' : '') + (d.rca ? '<span>RCA em rota: ' + e(d.rca) + '</span>' : '') + '</div>' +
        (Array.isArray(d.fotos) && d.fotos.length ? '<div class="sxfotos">' + d.fotos.slice(0, 6).map((f) => '<img src="' + e(f.url) + '" title="' + e(f.cliente || '') + (f.score != null ? ' · nota ' + f.score : '') + '" loading="lazy">').join('') + '</div>' : '') : '';
      return '<div class="sxc ' + (peso(x) === 0 ? 'bad' : peso(x) === 1 ? 'warn' : '') + '"><div class="sxcab"><span>' + e(x.nome) + '</span>' +
        '<span class="sxchip ' + (x.fez_compromisso ? 'sxok' : 'sxno') + '">' + (x.fez_compromisso ? '✅ Compromisso' : '❌ Sem compromisso') + '</span>' +
        '<span class="sxchip ' + (x.iniciou_ret ? 'sxok' : 'sxno') + '">' + (x.iniciou_ret ? '✅ Em rota (RET)' : '❌ RET não iniciou') + '</span></div>' + ret + '</div>';
    }).join('');
  };

  // painel gerencial da semana: supervisor x (seg..sex) = FEZ / PARCIAL / NÃO FEZ (fez = compromisso matinal E rota RET)
  window.supSemanaHtml = function (lista, semana) {
    if (!semana || !semana.dias) return '<div style="color:var(--mut,#8b9bbd);padding:8px 0">Carregando a semana dos supervisores…</div>';
    if (!lista || !lista.length) return '';
    const NOMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    const cab = '<tr><th>Supervisor</th>' + semana.dias.map((d, i) => '<th>' + NOMES[i] + '<br>' + d.slice(8, 10) + '/' + d.slice(5, 7) + '</th>').join('') + '<th>Semana</th></tr>';
    const linhas = lista.map((s) => {
      let fez = 0, total = 0;
      const tds = s.dias.map((dia) => {
        if (dia.estado === 'feriado') return '<td class="fut">feriado</td>';
        if (dia.estado === 'futuro') return '<td class="fut">—</td>';
        const hoje = dia.data === semana.hoje, ambos = dia.comp && dia.ret, algum = dia.comp || dia.ret;
        const det = '<small>matinal ' + (dia.comp ? '✓' : '✗') + ' · rota ' + (dia.ret ? '✓' : '✗') + '</small>';
        if (ambos) { fez++; total++; return '<td class="fez">FEZ' + det + '</td>'; }
        if (hoje && !algum) return '<td class="pen">PENDENTE' + det + '</td>'; // o dia de hoje ainda nao acabou: nao conta como "nao fez"
        total++;
        return algum ? '<td class="par">PARCIAL' + det + '</td>' : '<td class="nao">NÃO FEZ' + det + '</td>';
      }).join('');
      return '<tr><td class="n">' + e(s.nome) + '</td>' + tds + '<td class="tot">' + fez + '/' + total + '</td></tr>';
    }).join('');
    return '<table class="sxt">' + cab + linhas + '</table>';
  };
})();
