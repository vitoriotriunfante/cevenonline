const fs = require('fs');
// ---------- gerador ----------
{
  const rel = 'scratch/build_brasileirao_dataset.py';
  let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
  const ini = s.indexOf('# =====================================================================================================================\n# LIGA AS (Autosservico)');
  const fim = s.indexOf('# Exportar JSON Final');
  if (ini < 0 || fim < 0 || fim < ini) throw new Error('ancora gerador');
  s = s.slice(0, ini) + fs.readFileSync('scratch/bloco_as_py.txt', 'utf8') + s.slice(fim);
  fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok gerador');
}
// ---------- tela ----------
{
  const rel = 'public/brasileirao.html';
  let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
  const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); s = s.replace(de, () => para); };

  // lances que nao valem no AS (tipo do lance) + nomes das regras que nao valem
  tr("function lanceDoCanal(l, setAS) { const eAS = setAS.has(String(l.rca)); return CANAL === 'AS' ? eAS : !eAS; }",
     "// Lances que NAO valem no AS (dependem do horario ou das visitas do DIA; o AS visita um dia e vende em outro) — Vitório, 07/10/2026\nconst AS_TIPOS_FORA = ['ven10', 'vis10', 'vis11', 'gol_relampago', 'gol_acrescimos', 'gol_meta1t', 'gol_hattrick', 'hattrick', 'gol_conversao', 'gol_goleada'];\nconst AS_REGRAS_FORA = ['gol relampago', 'gol nos acrescimos', 'meta do 1', 'hat-trick', 'maquina de conversao', 'goleada', 'cartao amarelo', 'cartao vermelho / abandono', 'expulsao'];\nconst semAcento = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');\nconst regraForaDoAS = (nome) => { const n = semAcento(nome).replace(/^[^a-z0-9]+/, ''); return AS_REGRAS_FORA.some(r => n.startsWith(r)); };\nfunction lanceDoCanal(l, setAS) { const eAS = setAS.has(String(l.rca)); if (CANAL === 'AS') return eAS && !AS_TIPOS_FORA.includes(String(l.chave || '').replace(/^[A-Z]{3}[|]/, '').split('|')[0]); return !eAS; }", 'fora');
  // gabarito e regulamento sem as regras que nao valem no AS
  tr("    const regras = Object.values(cfg.pontos_por_lance || {}).map(r => ({ ...r, n: norm(r.nome), qtd: 0, soma: 0 })).sort((a, b) => b.pontos - a.pontos);", "    const regras = Object.values(cfg.pontos_por_lance || {}).filter(r => !(CANAL === 'AS' && regraForaDoAS(r.nome))).map(r => ({ ...r, n: norm(r.nome), qtd: 0, soma: 0 })).sort((a, b) => b.pontos - a.pontos);", 'gabfora');
  tr("function montaRegulamentoAS() {", "function filtraRegrasAS() {\n  const tb = document.getElementById('tbody-regulamento-pontos'); if (!tb) return;\n  tb.querySelectorAll('tr').forEach(tr => { const c = tr.querySelector('td'); tr.style.display = (CANAL === 'AS' && c && regraForaDoAS(c.textContent)) ? 'none' : ''; });\n}\n\nfunction montaRegulamentoAS() {", 'filtra');
  tr("  filtrarSupervisores(); filtrarVendedores(); montaRegulamentoAS();\n", "  filtrarSupervisores(); filtrarVendedores(); montaRegulamentoAS(); filtraRegrasAS();\n", 'chama');

  // artilharia AS: mesmo racional do varejo (V/E/D), a semana e o jogo
  const a = s.indexOf("function renderVendedoresAS() {"), b = s.indexOf("function montaGabaritoFase() {");
  if (a < 0 || b < 0) throw new Error('ancora render');
  const render = `function formaSemanas(L) { return (L || []).map(r => '<span class="dot-forma ' + r + '">' + r + '</span>').join('') || '<span style="color:var(--tx-mut);font-size:11px">—</span>'; }
function renderVendedoresAS() {
  const thr = document.getElementById('thr-vend'); if (!thr) return;
  thr.innerHTML = '<th style="width:70px">Posição</th><th>Vendedor (RCA)</th><th>Filial</th><th>Supervisor</th><th style="text-align:right">PG (Pontos)</th><th style="text-align:center">V</th><th style="text-align:center">E</th><th style="text-align:center">D</th><th style="text-align:center">% Aprov</th><th style="text-align:center">Forma (semanas)</th><th style="text-align:center">Placar acumulado</th><th style="text-align:center">Faseamento (S1–S4)</th><th style="text-align:center">Bônus</th><th style="text-align:center">% da meta</th>';
  const tb = document.getElementById('tbody-vendedores');
  const A = DADOS && DADOS.as;
  if (!A || !A.vendedores) { tb.innerHTML = '<tr><td colspan="14" style="text-align:center;padding:30px;color:var(--tx-mut)">' + (A && A.erro ? 'A Liga AS ainda não carregou (' + esc(A.erro) + ')' : 'Sem dados da Liga AS ainda.') + '</td></tr>'; return; }
  const q = (document.getElementById('busca-vend').value || '').toLowerCase(), f = document.getElementById('seletor-filial-vend').value, isBrasil = f === 'BRASIL';
  let lista = A.vendedores.filter(v => isBrasil || v.filial === f);
  if (q) lista = lista.filter(v => v.nome.toLowerCase().includes(q) || String(v.rca).includes(q) || (v.supervisor || '').toLowerCase().includes(q));
  tb.innerHTML = lista.slice(0, 150).map(v => {
    const pos = isBrasil ? v.pos_brasil : v.pos_filial, cls = pos <= 3 ? 'pos-g4' : 'pos-mid', sub = !isBrasil ? '<span style="font-size:10px;color:var(--tx-mut);display:block">(' + v.pos_brasil + 'º no Brasil)</span>' : '';
    const det = (v.semanas || []).filter(s => s.jogada).map(s => 'Semana ' + s.n + ': lances ' + s.pts_lances + ' + faseamento ' + s.pts_faseamento + ' + bônus ' + s.pts_bonus + ' = ' + s.score + ' (' + s.resultado + ')').join(' | ');
    return '<tr><td><span class="pos-box ' + cls + '">' + pos + 'º</span>' + sub + '</td><td><div style="font-weight:700;color:#fff">' + esc(v.nome) + '</div><div style="font-size:11px;color:var(--tx-mut)">RCA ' + esc(v.rca) + '</div></td>' +
      '<td><span class="tag-badge" style="background:rgba(56,189,248,0.15);color:var(--acc);">' + esc(v.filial) + '</span></td><td style="color:var(--tx-mut);font-size:12px;">' + esc(v.supervisor || '—') + '</td>' +
      '<td style="text-align:right" class="pts-cell">' + v.pts_tabela + '</td><td style="text-align:center"><span class="tag-badge tag-v">' + v.vitorias + '</span></td><td style="text-align:center"><span class="tag-badge tag-e">' + v.empates + '</span></td><td style="text-align:center"><span class="tag-badge tag-d">' + v.derrotas + '</span></td>' +
      '<td style="text-align:center;font-weight:700;color:var(--acc)">' + v.aprov + '%</td><td style="text-align:center"><div class="forma-container" title="' + esc(det) + '">' + formaSemanas(v.forma) + '</div></td>' +
      '<td style="text-align:center" title="' + esc(det) + '"><b>' + (v.pontos > 0 ? '+' : '') + v.pontos + '</b></td><td style="text-align:center"><div class="forma-container">' + (v.fases || []).map(faseDot).join('') + '</div></td><td style="text-align:center">' + bonusTxt(v.bonus) + '</td><td style="text-align:center">' + pctTxt(v.pct_hoje) + '</td></tr>';
  }).join('');
}

function renderSupervisoresAS() {
  const thr = document.getElementById('thr-sup'); if (!thr) return;
  thr.innerHTML = '<th style="width:60px">Pos</th><th>Supervisor</th><th>Filial</th><th>Gerente</th><th style="text-align:right">PG Total</th><th style="text-align:center">Pontos de faseamento (desempate)</th><th style="text-align:center">V</th><th style="text-align:center">E</th><th style="text-align:center">D</th><th style="text-align:center">% Aprov Equipe</th><th style="text-align:center">Forma (semanas)</th><th style="text-align:center">Equipe (com meta)</th><th style="text-align:center">Faseamento (S1–S4)</th><th style="text-align:center">Bônus</th><th style="text-align:center">% da meta da equipe</th>';
  const tb = document.getElementById('tbody-supervisores'), A = DADOS && DADOS.as;
  if (!A || !A.supervisores) { tb.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:30px;color:var(--tx-mut)">' + (A && A.erro ? 'A Liga AS ainda não carregou (' + esc(A.erro) + ')' : 'Sem dados da Liga AS ainda.') + '</td></tr>'; return; }
  const q = (document.getElementById('busca-sup').value || '').toLowerCase(), f = document.getElementById('filtro-sup-filial').value;
  const lista = A.supervisores.filter(s => (!f || s.filial === f) && (s.supervisor.toLowerCase().includes(q) || s.filial.toLowerCase().includes(q)));
  tb.innerHTML = lista.map(s => '<tr><td><span class="pos-box ' + (s.pos <= 5 ? 'pos-g4' : 'pos-mid') + '">' + s.pos + 'º</span></td><td><strong style="color:#fff">' + esc(s.supervisor) + '</strong></td>' +
    '<td><span class="tag-badge" style="background:rgba(56,189,248,0.15);color:var(--acc);">' + esc(s.filial) + '</span></td><td style="color:var(--tx-mut);font-size:12px;">' + esc(s.gerente || '—') + '</td>' +
    '<td style="text-align:right" class="pts-cell">' + s.pts_tabela + '</td><td style="text-align:center"><span class="tag-badge tag-v">+' + s.pontos_faseamento + '</span></td>' +
    '<td style="text-align:center"><span class="tag-badge tag-v">' + s.vitorias + '</span></td><td style="text-align:center"><span class="tag-badge tag-e">' + s.empates + '</span></td><td style="text-align:center"><span class="tag-badge tag-d">' + s.derrotas + '</span></td>' +
    '<td style="text-align:center;font-weight:700;color:var(--acc)">' + s.aprov + '%</td><td style="text-align:center"><div class="forma-container">' + formaSemanas(s.forma) + '</div></td><td style="text-align:center">' + s.com_meta + '/' + s.total_vendedores + '</td>' +
    '<td style="text-align:center"><div class="forma-container">' + (s.fases || []).map(faseDot).join('') + '</div></td><td style="text-align:center">' + bonusTxt(s.bonus) + '</td><td style="text-align:center">' + pctTxt(s.pct_hoje) + '</td></tr>').join('') || '<tr><td colspan="15" style="text-align:center;padding:30px;color:var(--tx-mut)">Nenhum supervisor AS para este filtro.</td></tr>';
}

`;
  s = s.slice(0, a) + render + s.slice(b);

  // textos: subtitulos e regulamento do AS
  tr("'Jogo SEMANAL • Pontos = lances da semana + faseamento da meta (20/40/60/110% = 10/20/30/40 pts) + bônus (100% até o dia 15 = +50; até o dia 25 = +25)'", "'Cada SEMANA é um jogo (mesmo racional do Varejo) • Placar da semana = lances + faseamento da meta (20/40/60/110% = 10/20/30/40) + bônus (100% até o dia 15 = +50; até o dia 25 = +25) • Mais de 10 = Vitória (3 pts) · 1 a 10 = Empate (1) · 0 ou menos = Derrota (0)'", 'sub1');
  tr("'Pontos da EQUIPE no faseamento da meta do mês + bônus; lances da equipe aparecem como informação'", "'Supervisor joga pela MAIORIA da equipe em Vitória na semana (igual ao Varejo); o faseamento e o bônus da equipe desempatam'", 'sub2');
  const r1 = s.indexOf("function montaRegulamentoAS() {"); const r2 = s.indexOf("\n}\n", r1) + 3;
  const novoReg = `function montaRegulamentoAS() {
  const box = document.getElementById('reg-as-corpo'); if (!box) return;
  box.innerHTML = \`
    <p>O <strong>AS (Autosserviço)</strong> joga por <strong>SEMANA</strong>, com o mesmo raciocínio do Varejo: a <strong>semana é o jogo</strong>. O vendedor visita num dia e coloca o pedido em outro, então as jogadas são computadas semanalmente. Vendedor e supervisor têm acompanhamento separado. Semanas: <strong>1ª</strong> dias 1–7 · <strong>2ª</strong> dias 8–14 · <strong>3ª</strong> dias 15–20 · <strong>4ª</strong> dias 21 até o fim do mês.</p>
    <p>🟢 <strong>Vitória na semana (3 pts de tabela):</strong> placar acima de 10 · 🟡 <strong>Empate (1 pt):</strong> de 1 a 10 · 🔴 <strong>Derrota (0):</strong> 0 ou negativo. <strong>Placar da semana</strong> = lances da semana + faseamento da semana + bônus que caiu nela. <strong>Supervisor:</strong> vitória quando mais de 50% da equipe AS venceu a semana (igual ao Varejo); faseamento e bônus da equipe desempatam.</p>
    <table class="tb-league" style="margin:10px 0 14px"><thead><tr><th>Faseamento (% da meta do mês no fim da semana)</th><th style="text-align:center">Meta</th><th style="text-align:center">Pontos no placar</th></tr></thead><tbody>
      <tr><td>1ª semana (até o dia 7)</td><td style="text-align:center">20%</td><td style="text-align:center"><b>+10</b></td></tr><tr><td>2ª semana (até o dia 14)</td><td style="text-align:center">40%</td><td style="text-align:center"><b>+20</b></td></tr>
      <tr><td>3ª semana (até o dia 20)</td><td style="text-align:center">60%</td><td style="text-align:center"><b>+30</b></td></tr><tr><td>4ª semana (até o fim do mês)</td><td style="text-align:center">110%</td><td style="text-align:center"><b>+40</b></td></tr>
      <tr><td>🥇 Bônus de primeira quinzena: bateu <strong>100%</strong> da meta até o dia 15</td><td style="text-align:center">100%</td><td style="text-align:center"><b>+50</b></td></tr><tr><td>🥈 Bateu <strong>100%</strong> da meta até o dia 25</td><td style="text-align:center">100%</td><td style="text-align:center"><b>+25</b></td></tr></tbody></table>
    <p style="font-size:13px;color:var(--tx-mut)">% da meta = (faturado + pendente) dividido pela meta do mês, o mesmo número do app do CEVEN. A semana de faseamento só pontua depois que o dia de fechamento termina. Sem meta cadastrada o vendedor não pontua no faseamento.</p>
    <p><strong>O que NÃO vale no AS</strong> (depende do horário ou das visitas do dia; o AS visita um dia e vende em outro): Gol Relâmpago, Gol nos Acréscimos, Meta do 1º Tempo, Hat-Trick, Máquina de Conversão, Goleada, Cartão Amarelo das 10h e Cartão Vermelho de abandono — eles saem da tabela de pontos abaixo. <strong>Valem iguais ao Varejo:</strong> Resgate de Inativo, Dobrou o Mix, Dobradinha das Quinzenas, Defesa, Super Pedido, Pedido Feito na Rota, devoluções, pênaltis e impedimento de GPS. <strong>Em definição:</strong> check-in por carteira (90% = +5 · 95% = +10 · 100% = +20), amarelo de venda sem check-in, gol de SKUs (2 a mais que a média, no lugar do "dobrou o mix"), marca própria (estrela e gol especial) e punição por falta de pedido (dia 5 = −5 · dia 10 = −10 · dia 20 = −20).</p>\`;
}
`;
  s = s.slice(0, r1) + novoReg + s.slice(r2);
  // depois que a tabela de pontos do regulamento carrega, esconde as regras que nao valem no AS
  fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok tela');
}
