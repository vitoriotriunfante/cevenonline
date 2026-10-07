const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };
const VER = '2026-10-09.1';

// ===== tela da liga =====
ed('public/brasileirao.html', (s) => {
  s = tr(s, "  hattrick: { nome: 'Hat-Trick', pontos: 6, motivo: '3 pedidos seguidos em curto intervalo' },\n", "  hattrick: { nome: 'Hat-Trick', pontos: 6, motivo: '3 pedidos seguidos em curto intervalo' },\n  gol_mp_tripla: { nome: '🌟 Tripla de Marca Própria', pontos: 10, motivo: '3 clientes no dia com R$ 50+ de Marca Própria cada' },\n", 'rg');
  s = tr(s, "Dobradinha das Quinzenas e Gol de Marca Própria)", "Dobradinha das Quinzenas, Gol de Marca Própria e Tripla de Marca Própria)", 't1');
  s = tr(s, "na frente de qualquer outro lance. <strong>Valem iguais ao Varejo:</strong>", "na frente de qualquer outro lance. <strong>🌟 Tripla de Marca Própria (+10, a partir de 09/10/2026, no AS e no Varejo):</strong> 3 clientes diferentes no mesmo dia, cada um com R$ 50 ou mais de Marca Própria. <strong>Valem iguais ao Varejo:</strong>", 't2');
  s = tr(s, "      <div class=\"rule-card\" id=\"reg-as\" style=\"display:none\">", `      <div class="rule-card">
        <h3>🌟 Tripla de Marca Própria (a partir de 09/10/2026 · Varejo e AS)</h3>
        <p>
          Quem fecha <strong>3 ou mais clientes diferentes no mesmo dia</strong>, cada um com pedido de <strong>R$ 50 ou mais de Marca Própria Triunfante</strong>, ganha um gol extra: <strong>+10 pontos</strong>, o maior bônus da liga, <strong>um por vendedor por dia</strong>. Cada um dos 3 clientes continua valendo o seu Gol de Marca Própria (+8): a Tripla é um bônus por cima. É um bônus fixo, <strong>sem nível</strong> (bronze a platina). Ganha a <strong>🌟 estrela</strong> e é <strong>sempre exibido na TV</strong>, na frente de qualquer outro lance. Regra da versão 2026-10-09.1: não vale para dias anteriores a 09/10.
        </p>
      </div>

      <div class="rule-card" id="reg-as" style="display:none">`, 'card');
  return s;
});

// ===== TV e Matriz =====
const ESTRELAS = `// Chuva de estrelas douradas por cima da animacao do Gol de Marca Propria e da Tripla (foco da empresa). Some sozinha.
function estrelasMP(item) {
  const sub = (item.a && item.a.subtipo) || item.subtipo; if (sub !== 'marca_propria' && sub !== 'mp_tripla') return;
  try {
    if (!document.getElementById('estrelasmp-css')) { const st = document.createElement('style'); st.id = 'estrelasmp-css'; st.textContent = '@keyframes estCai{from{transform:translateY(-12vh) rotate(0)}to{transform:translateY(112vh) rotate(360deg)}}#estrelasmp{position:fixed;inset:0;z-index:99999;pointer-events:none;overflow:hidden}#estrelasmp i{position:absolute;top:0;font-style:normal;animation:estCai linear forwards;filter:drop-shadow(0 0 8px #facc15)}'; document.head.appendChild(st); }
    const old = document.getElementById('estrelasmp'); if (old) old.remove();
    const d = document.createElement('div'); d.id = 'estrelasmp'; const n = sub === 'mp_tripla' ? 46 : 24, ic = sub === 'mp_tripla' ? '🌟' : '⭐';
    for (let k = 0; k < n; k++) { const e = document.createElement('i'); e.textContent = ic; e.style.left = (Math.random() * 98) + 'vw'; e.style.fontSize = (20 + Math.random() * 34) + 'px'; e.style.animationDuration = (3.5 + Math.random() * 4.5) + 's'; e.style.animationDelay = (Math.random() * 6) + 's'; d.appendChild(e); }
    document.body.appendChild(d); setTimeout(() => { try { d.remove(); } catch {} }, 14000);
  } catch {}
}
`;
const TEXTO_TRIPLA = "  if (subtipo === 'mp_tripla') return `🌟 TRIPLA DE MARCA PRÓPRIA! ${valor} clientes com R$ 50+ de Marca Própria hoje!`;\n";
for (const [rel, sig] of [['public/tvapp.html', ''], ['public/matrizapp.html', '${sig}|']]) {
  ed(rel, (s) => {
    // texto
    s = tr(s, "  if (subtipo === 'dobrou_mix') return `${c && c.nome} · dobrou o mix do cliente!`;\n", TEXTO_TRIPLA + "  if (subtipo === 'dobrou_mix') return `${c && c.nome} · dobrou o mix do cliente!`;\n", 'texto');
    // pontos
    s = tr(s, "  if (subtipo === 'marca_propria') return { nome: '⭐ Gol de Marca Própria', pts: '+8 PONTOS NA LIGA', cor: '#facc15' };\n", "  if (subtipo === 'marca_propria') return { nome: '⭐ Gol de Marca Própria', pts: '+8 PONTOS NA LIGA', cor: '#facc15' };\n  if (subtipo === 'mp_tripla') return { nome: '🌟 Tripla de Marca Própria', pts: '+10 PONTOS NA LIGA', cor: '#facc15' };\n", 'pts');
    // sempre exibido, na frente
    s = tr(s, "((x.a && x.a.subtipo) || x.subtipo) === 'marca_propria'; //", "['marca_propria', 'mp_tripla'].includes((x.a && x.a.subtipo) || x.subtipo); //", 'ehMP');
    s = s.replace(/score: a\.subtipo === 'marca_propria' \? 500/g, "score: ['marca_propria', 'mp_tripla'].includes(a.subtipo) ? 500");
    // deteccao local da Tripla: junto da Goleada (gol do dia)
    const ancGol = rel.includes('tvapp') ? "      out.push({key: `gol_goleada|${v.id}`, nivel: 'gol', subtipo: 'goleada', v, valor: v.comVenda});\n    }\n" : "      out.push({key: `${sig}|gol_goleada|${v.id}`, sig, nivel: 'gol', subtipo: 'goleada', v, valor: v.comVenda});\n    }\n";
    const chave = rel.includes('tvapp') ? "`gol_mp_tripla|${v.id}`" : "`${sig}|gol_mp_tripla|${v.id}`";
    const sigProp = rel.includes('tvapp') ? '' : ' sig,';
    s = tr(s, ancGol, ancGol + `    // --- LANCE: TRIPLA DE MARCA PROPRIA (a partir de 09/10/2026): 3+ clientes no dia com R$ 50+ de Marca Propria cada (+10, um por vendedor por dia) ---
    if (HOJE0 >= '2026-10-09') {
      const mpCli = (v.cl || []).filter(c => ['POSITIVADO', 'EFETIVADO'].includes(c.status) && (c.industrias || []).filter(x => /marca propria/.test(String(x.n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))).reduce((a, x) => a + (Number(x.v) || 0), 0) >= 50);
      if (mpCli.length >= 3) out.push({key: ${chave},${sigProp} nivel: 'gol', subtipo: 'mp_tripla', v, valor: mpCli.length});
    }
`, 'det');
    // animacao
    s = tr(s, "  window.__fechaAnimAtual = fecha;\n", "  window.__fechaAnimAtual = fecha;\n  estrelasMP(item);\n", 'anim');
    s = tr(s, "function pontosLanceOficial(", ESTRELAS + "function pontosLanceOficial(", 'fnEst');
    return s;
  });
}
console.log('tudo ok');
