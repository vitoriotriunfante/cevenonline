const fs = require('fs');
const rel = 'functions/_lib/notif_supervisores.js';
let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const a = s.indexOf("  const saida = [];\n  for (const g of porSup.values()) {");
const b = s.indexOf("  return saida.sort(");
if (a < 0 || b < 0) throw new Error('ancora');
const novo = [
"  const saida = [];",
"  for (const g of porSup.values()) {",
"    const cont = {};",
"    let pontos = 0;",
"    for (const l of g.lances) { const c = categoria(l); cont[c] = (cont[c] || 0) + 1; pontos += Number(l.pontos) || 0; }",
"    const soma = (c) => Math.round(g.lances.filter((l) => categoria(l) === c).reduce((x, l) => x + (Number(l.pontos) || 0), 0) * 10) / 10;",
"    // linha de resumo com um emoji por tipo",
"    const EMOJI = { gol: '⚽', 'hat-trick': '🔥', defesa: '🧤', 'pênalti': '🚨', impedimento: '🚩', amarelo: '🟨', 'gol contra': '😬', vermelho: '🟥', 'pedido na rota': '📝', lance: '•' };",
"    const resumo = Object.entries(cont).sort((x, y) => y[1] - x[1]).map(([c, n]) => `${EMOJI[c] || '•'} ${n} ${n === 1 ? c : (PLURAL[c] || c)} (${sinal(soma(c))})`).join('  ·  ');",
"    const cab = `📊 ${titulo(g.supervisor)} · sua equipe${de && ate ? ` (${hm(de)}–${hm(ate)})` : ''}\nSaldo: ${sinal(Math.round(pontos * 10) / 10)} pts\n${resumo}`;",
"    // detalhe por VENDEDOR (mesmo lance repetido vira \"6 impedimentos\"), separado em o que deu certo e o que pede atenção",
"    const porVend = new Map();",
"    for (const l of g.lances) { if (categoria(l) === 'pedido na rota') continue; const k = l.vendedor || '—'; if (!porVend.has(k)) porVend.set(k, { nome: k, bons: new Map(), maus: new Map(), total: 0 }); const v = porVend.get(k); const nome = Number(l.pontos) >= 0 ? limpa(l.pontos_nome || l.nivel) : (PLURAL1[categoria(l)] || categoria(l)); const m = Number(l.pontos) >= 0 ? v.bons : v.maus; const e = m.get(nome) || { n: 0, p: 0, cat: categoria(l) }; e.n++; e.p += Number(l.pontos) || 0; m.set(nome, e); v.total += Number(l.pontos) || 0; }",
"    const fmtItem = ([nome, e]) => (e.n > 1 ? `${e.n} ${e.cat !== 'lance' && PLURAL[e.cat] && Number(e.p) < 0 ? PLURAL[e.cat] : nome + ' ×'}` : nome) + ` (${sinal(Math.round(e.p * 10) / 10)})`;",
"    const bons = [...porVend.values()].filter((v) => v.bons.size).sort((x, y) => y.total - x.total);",
"    const maus = [...porVend.values()].filter((v) => v.maus.size).sort((x, y) => x.total - y.total);",
"    const linhasBoas = bons.map((v) => `• ${titulo(v.nome, 2)} — ${[...v.bons.entries()].map(fmtItem).join(' · ')}`);",
"    const linhasMas = maus.map((v) => `• ${titulo(v.nome, 2)} — ${[...v.maus.entries()].map(fmtItem).join(' · ')}`);",
"    // monta respeitando o limite: corta as linhas do fim de cada bloco e avisa quantas ficaram de fora",
"    let texto = cab, fora = 0;",
"    const bloco = (tit, linhas) => { if (!linhas.length) return; let t = '\n\n' + tit; let usou = 0; for (const ln of linhas) { if ((texto + t + '\n' + ln).length > LIMITE_TEXTO - 50) break; t += '\n' + ln; usou++; } if (usou) texto += t; fora += linhas.length - usou; };",
"    bloco('✅ O QUE DEU CERTO', linhasBoas);",
"    bloco('⚠️ ATENÇÃO', linhasMas);",
"    if (fora) texto += `\n\n(+${fora} vendedor(es): veja na Liga)`;",
"    saida.push({ filial: g.filial, supervisor: g.supervisor, texto, chaves: g.lances.map((l) => l.chave), qtd: g.lances.length, pontos: Math.round(pontos * 10) / 10 });",
"  }",
""
].join('\n');
s = s.slice(0, a) + novo + s.slice(b);
// auxiliares
s = s.replace("const PLURAL = {", [
"const MINUSCULAS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);",
"// \"BRUNO GUSTAVO NATAL\" -> \"Bruno Gustavo Natal\" (ou, com max=2, \"Bruno Natal\": primeiro e ultimo nome)",
"function titulo(nome, max) { let p = String(nome || '').trim().toLowerCase().split(/\s+/).filter(Boolean); if (max && p.length > max) p = [p[0], p[p.length - 1]]; return p.map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' '); }",
"const limpa = (s) => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();",
"const PLURAL1 = { 'pênalti': 'pênalti', impedimento: 'impedimento', amarelo: 'cartão amarelo', vermelho: 'cartão vermelho', 'gol contra': 'gol contra' };",
"const PLURAL = {"].join('\n'));
fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
