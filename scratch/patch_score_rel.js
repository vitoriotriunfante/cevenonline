const fs = require('fs');
const rel = 'public/matrizapp.html';
let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); s = s.replace(de, () => para); };

// 1) funcao do score relativo (0 a 100, nunca negativo): cada item e medido contra as OUTRAS filiais
tr("const METRICA_FILIAL = {};",
"// SCORE DE DESEMPENHO 0 A 100 (Vitório, 06/10/2026: \"não dá para ter score negativo, precisamos ponderar os contextos\"). Nunca negativo e sem número inventado:\n" +
"// cada item e medido CONTRA AS OUTRAS FILIAIS (a melhor do item vale 100) e depois combinado com pesos. Contextos: tamanho da equipe (tudo por vendedor) e a meta de cada filial.\n" +
"//   Faturamento (% da meta) 30% · Positivacao (% da meta) 30% · Gols por vendedor 15% · Disciplina 25% (quanto MENOS penaltis por vendedor e zerados de campo, melhor).\n" +
"// O lider final vira 100 e as demais ficam proporcionais.\n" +
"const SCORE_PESOS = {fat: 30, pos: 30, gols: 15, disc: 25};\n" +
"function scoresRelativos(stats) {\n" +
"  const L = stats.filter(x => x.tem);\n" +
"  const maxDe = (f) => Math.max(...L.map(f), 0);\n" +
"  const tg = (x) => x.n ? (x.gols || 0) / x.n : 0, perda = (x) => (x.n ? (x.pen || 0) / x.n : 0) * 12 + (x.campo && x.campo.length ? (x.nZer || 0) / x.campo.length : 0) * 15;\n" +
"  const mFat = maxDe(x => x.pctFat || 0), mPos = maxDe(x => x.pctPos || 0), mGol = maxDe(tg), mPerda = maxDe(perda);\n" +
"  const bruto = {};\n" +
"  L.forEach(x => {\n" +
"    const a = mFat > 0 ? (x.pctFat || 0) / mFat * 100 : 0, b = mPos > 0 ? (x.pctPos || 0) / mPos * 100 : 0, c = mGol > 0 ? tg(x) / mGol * 100 : 0, d = mPerda > 0 ? (1 - perda(x) / mPerda) * 100 : 100;\n" +
"    bruto[x.sig] = (a * SCORE_PESOS.fat + b * SCORE_PESOS.pos + c * SCORE_PESOS.gols + d * SCORE_PESOS.disc) / 100;\n" +
"  });\n" +
"  const lider = Math.max(...Object.values(bruto), 0);\n" +
"  const saida = {};\n" +
"  Object.keys(bruto).forEach(k => { saida[k] = lider > 0 ? Math.round(bruto[k] / lider * 1000) / 10 : 0; });\n" +
"  return saida;\n" +
"}\n" +
"const METRICA_FILIAL = {};", 'fn');

// 2) renderRank usa o score relativo
tr("function renderRank(stats) {\n  const t = sp(), ehFechamento = t.h >= 15;", "function renderRank(stats) {\n  const t = sp(), ehFechamento = t.h >= 15;\n  const SCORE = scoresRelativos(stats);\n  stats.forEach(x => { x.scorePositivo = SCORE[x.sig] != null ? SCORE[x.sig] : 0; });", 'ini');
tr("const maxScore = Math.max(...stats.map(x => x.scorePositivo || 0), 0.0001); // o LIDER vira 100 e as demais filiais ficam proporcionais (Vitório, 06/10/2026)", "const maxScore = 100; // o score ja vem de 0 a 100, com o LIDER em 100 (ver scoresRelativos)", 'max');
tr("const notaExibida = ehPositivo ? Math.round(((x.scorePositivo || 0) / maxScore) * 1000) / 10 : x.nota;", "const notaExibida = ehPositivo ? (x.scorePositivo || 0) : x.nota;", 'nota');
tr("'Score Ponderado: Fat + Pos + Gols - Pênaltis - Zerados · Barra relativa à filial líder'", "'Score 0–100 · Faturamento 30% · Positivação 30% · Gols/vendedor 15% · Disciplina 25% (pênaltis e zerados) · cada item contra as demais filiais · líder = 100'", 'legenda');
fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
