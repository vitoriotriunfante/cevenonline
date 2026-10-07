const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ===== TV da filial e Matriz =====
const CSS_FN = `// BOLA CHEIA (18h): animacao em tela (CSS) usada quando nao ha video; bola quicando, confete e o nome do vencedor.
function animBolaCheia(ov, item) {
  try {
    if (!document.getElementById('bolacheia-css')) { const st = document.createElement('style'); st.id = 'bolacheia-css'; st.textContent = '@keyframes bcQuica{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-70px) rotate(180deg)}}@keyframes bcCai{from{transform:translateY(-10vh) rotate(0)}to{transform:translateY(110vh) rotate(540deg)}}@keyframes bcEntra{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}.bc{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(circle at 50% 40%,#14532d,#052e16 70%);color:#fef9c3;text-align:center;overflow:hidden}.bc .bola{font-size:150px;animation:bcQuica 1.1s ease-in-out infinite;filter:drop-shadow(0 20px 18px #0008)}.bc h1{margin:0;font-size:64px;letter-spacing:6px;color:#facc15;animation:bcEntra .8s both}.bc h2{margin:0;font-size:40px;animation:bcEntra 1s .3s both}.bc h3{margin:0;font-size:24px;color:#bbf7d0;animation:bcEntra 1s .6s both}.bc i{position:absolute;top:0;font-style:normal;animation:bcCai linear infinite}'; document.head.appendChild(st); }
    const b = item.bc || {}, nome = item.lista ? 'Os melhores de cada filial' : esc(b.vendedor || (item.v && item.v.nome) || ''), fil = item.lista ? (item.lista.length + ' filiais') : esc(b.filial || item.sig || '');
    let conf = ''; for (let k = 0; k < 40; k++) conf += '<i style="left:' + (Math.random() * 98).toFixed(1) + 'vw;font-size:' + (18 + Math.random() * 26).toFixed(0) + 'px;animation-duration:' + (3 + Math.random() * 4).toFixed(1) + 's;animation-delay:' + (Math.random() * 5).toFixed(1) + 's">' + ['⭐', '🎉', '✨', '⚽'][k % 4] + '</i>';
    ov.className = 'show'; ov.innerHTML = '<div class="bc">' + conf + '<div class="bola">⚽</div><h1>BOLA CHEIA</h1><h2>' + nome + '</h2><h3>' + fil + ' · melhor do dia</h3></div>';
  } catch (e) {}
}
`;
function bolaTela(sigExpr) {
  return `  } else if (item.tipo === 'bolacheia') {
    const bc = item.bc || {}, rs = bc.resumo || {};
    if (item.lista) { titulo = '🏆 BOLA CHEIA · TODAS AS FILIAIS'; sub = 'Melhor do dia de cada filial (congelada às 18h)'; cls = 'f1'; dec = item.lista.map(function (x) { return '<div class="ln hot"><b>' + esc(x.filial) + '</b><span>' + esc(x.vendedor) + ' · ' + (Number(x.pontos) || 0) + ' pts · ' + (x.positivados || 0) + ' positivados</span></div>'; }).join(''); veredito = '🏆 BOLA CHEIA congelada às 18h: resultado final, não muda mais. Parabéns a todos!'; } else {
    titulo = '🏆 BOLA CHEIA'; sub = item.sub || 'Melhor do dia da filial (congelada às 18h)'; cls = 'f1';
    dec = '<div class="ln hot"><b>FILIAL</b><span>' + esc(bc.filial || ${sigExpr}) + '</span></div><div class="ln hot"><b>VENDEDOR</b><span>' + esc(bc.vendedor || '') + ' <small>(RCA ' + esc(bc.rca || '') + ')</small></span></div>' + (bc.supervisor ? '<div class="ln"><b>SUPERVISOR</b><span>' + esc(bc.supervisor) + '</span></div>' : '') + '<div class="ln"><b>PONTOS NO DIA</b><span>' + (Number(bc.pontos) || 0) + ' (gols ' + (rs.gols || 0) + ' · defesas ' + (rs.defesas || 0) + (rs.negativos ? ' · lances negativos ' + rs.negativos : '') + ')</span></div><div class="ln"><b>RESUMO</b><span>' + (bc.visitas || 0) + ' visitas · ' + (bc.positivados || 0) + ' clientes positivados · digitado ' + brl(bc.digitado || 0) + '</span></div>';
    veredito = '🏆 BOLA CHEIA congelada às 18h: resultado final, não muda mais. Parabéns!';
    }
`;
}
function ligaFila(sigPush) {
  return `// BOLA CHEIA: depois das 18h busca o vencedor congelado do dia e avisa UMA vez neste navegador (a TV da filial so o da propria filial)
const BOLA_AVISADA = new Set();
async function checaBolaCheia() {
  try {
    if (sp().h < 18) return;
    const d = await j('/api/bola-cheia?dia=' + HOJE0, 15000); if (!d || d.erro || d.pendente) return;
    ${sigPush}
  } catch (e) {}
}
setInterval(checaBolaCheia, 60 * 1000); setTimeout(checaBolaCheia, 8000);
`;
}
function patchPlay(s, fim) {
  s = tr(s, `  if (item.tipo === 'semanainvicta') {\n    const ` + fim + ` = `, `  if (item.tipo === 'semanainvicta' || item.tipo === 'bolacheia') {\n    const ` + fim + ` = `, 'play');
  s = tr(s, `tocaVideoLance($('cvp'), 'semanainvicta', null, 12000, ` + fim + `) : null;\n    if (!animStop && typeof iniciaAnimSemanaInvicta === 'function')`,
    `tocaVideoLance($('cvp'), item.tipo === 'bolacheia' ? 'bolacheia' : 'semanainvicta', null, item.tipo === 'bolacheia' ? 20000 : 12000, ` + fim + `) : null;\n    if (!animStop && item.tipo === 'bolacheia') { animBolaCheia(ov, item); ov._t2 = setTimeout(` + fim + `, 9000); animStop = () => {}; }\n    else if (!animStop && typeof iniciaAnimSemanaInvicta === 'function')`, 'play2');
  return s;
}
ed('public/tvapp.html', (s) => {
  s = tr(s, "function pontosLanceOficial(", CSS_FN + "function pontosLanceOficial(", 'fn');
  s = tr(s, "  } else if (item.tipo === 'semanainvicta') {\n    titulo = '👑 SEMANA INVICTA';", bolaTela("FIL") + "  } else if (item.tipo === 'semanainvicta') {\n    titulo = '👑 SEMANA INVICTA';", 'tela');
  s = patchPlay(s, 'fimInv');
  // sai sempre sozinha, na frente
  s = tr(s, "const iInv = ESPERA.findIndex(x => x.tipo === 'semanainvicta');", "const iInv = ESPERA.findIndex(x => x.tipo === 'semanainvicta' || x.tipo === 'bolacheia');", 'fila');
  s = tr(s, "ESPERA.some((x) => ehBomLance(x) || ehGrave(x) || x.tipo === 'semanainvicta')", "ESPERA.some((x) => ehBomLance(x) || ehGrave(x) || x.tipo === 'semanainvicta' || x.tipo === 'bolacheia')", 'ruim');
  s = tr(s, "function enfileira(novos) {", ligaFila("const v = (d.vencedores || []).find((x) => x.filial === FIL); if (!v) return;\n    const k = 'bolacheia_' + HOJE0 + '_' + FIL; if (BOLA_AVISADA.has(k) || store.get(k, false)) return; BOLA_AVISADA.add(k); store.set(k, true);\n    ESPERA.push({tipo: 'bolacheia', sig: FIL, bc: v, v: {id: v.rca, nome: v.vendedor, sup: v.supervisor || '', canal: ''}, sub: 'Bola Cheia ' + FIL + ': melhor do dia (congelada às 18h)', score: 60});\n    liberaEspera();") + "function enfileira(novos) {", 'liga');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = tr(s, "function pontosLanceOficial(", CSS_FN + "function pontosLanceOficial(", 'fn');
  s = tr(s, "  } else if (item.tipo === 'semanainvicta') {\n    titulo = '👑 SEMANA INVICTA';", bolaTela("'MTZ'") + "  } else if (item.tipo === 'semanainvicta') {\n    titulo = '👑 SEMANA INVICTA';", 'tela');
  s = patchPlay(s, 'mostraDecisaoInv');
  s = tr(s, "const iInv = ESPERA.findIndex(x => x.tipo === 'semanainvicta');", "const iInv = ESPERA.findIndex(x => x.tipo === 'semanainvicta' || x.tipo === 'bolacheia');", 'fila');
  s = tr(s, "ESPERA.some((x) => ehBomLance(x) || ehGrave(x) || x.tipo === 'semanainvicta')", "ESPERA.some((x) => ehBomLance(x) || ehGrave(x) || x.tipo === 'semanainvicta' || x.tipo === 'bolacheia')", 'ruim');
  s = tr(s, "function enfileira(novos) {", ligaFila(`const lista = d.vencedores || []; if (!lista.length) return;
    const k = 'bolacheia_' + HOJE0 + '_MTZ'; if (BOLA_AVISADA.has(k) || store.get(k, false)) return; BOLA_AVISADA.add(k); store.set(k, true);
    ESPERA.push({tipo: 'bolacheia', sig: 'MTZ', lista, bc: lista[0], v: {id: lista[0].rca, nome: lista[0].vendedor, sup: '', canal: ''}, sub: 'Bola Cheia do dia: o melhor de cada filial (congelada às 18h)', score: 60});
    liberaEspera();`) + "function enfileira(novos) {", 'liga');
  return s;
});
console.log('tudo ok');
