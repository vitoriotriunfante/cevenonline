const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };
const HELPERS =
"function ehPedidoDoRca(numPedido, rca) {\n" +
"  const n = String(numPedido || ''), c = String(rca || '');\n" +
"  return !!c && n.length === c.length + 6 && n.startsWith(c) && /^[0-9]+$/.test(n.slice(c.length));\n" +
"}\n" +
"// Tolerante: no Data Lake (set/out) 1,5% dos pedidos tem 5 ou 7 digitos depois do codigo (108600094 = RCA 1086; 5500000561 = RCA 550).\n" +
"function ehPedidoTolerante(numPedido, rca) {\n" +
"  const n = String(numPedido || ''), c = String(rca || '');\n" +
"  const resto = n.length - c.length;\n" +
"  return !!c && n.startsWith(c) && resto >= 5 && resto <= 7 && /^[0-9]+$/.test(n.slice(c.length));\n" +
"}\n" +
"// Dono do pedido entre os codigos conhecidos: primeiro o formato padrao (6 digitos), depois o tolerante; vence o codigo mais longo (RCA 10 x RCA 100).\n" +
"function donoDoPedido(numPedido, codigos) {\n" +
"  const n = String(numPedido || '');\n" +
"  if (!/^[0-9]+$/.test(n)) return '';\n" +
"  for (const teste of [ehPedidoDoRca, ehPedidoTolerante]) {\n" +
"    let melhor = '';\n" +
"    for (const c of codigos) if (c.length > melhor.length && teste(n, c)) melhor = c;\n" +
"    if (melhor) return melhor;\n" +
"  }\n" +
"  return n.length > 6 ? n.slice(0, -6) : '';\n" +
"}";
ed('pipeline/ceven_unified_engine.js', (s) => {
  const i = s.indexOf('function ehPedidoDoRca'); const f = s.indexOf('\n}\n', i) + 3;
  s = s.slice(0, i) + HELPERS + '\n' + s.slice(f);
  s = tr(s, "const codDono = ehPedidoDoRca(numPed, r.codigo) || numPed.length <= 6 ? String(r.codigo) : numPed.slice(0, -6);", "const codDono = donoDoPedido(numPed, codigosConhecidos) || String(r.codigo);", 'dono');
  s = tr(s, "  const donosPorCodigo = new Map(rcasComPedido.map(x => [String(x.codigo), x]));\n", "  const donosPorCodigo = new Map(rcasComPedido.map(x => [String(x.codigo), x]));\n  const codigosConhecidos = [...donosPorCodigo.keys()];\n", 'cods');
  s = tr(s, "find(v => ehPedidoDoRca(v.num_pedido, rca.codigo))", "find(v => ehPedidoDoRca(v.num_pedido, rca.codigo) || ehPedidoTolerante(v.num_pedido, rca.codigo))", 'comprou');
  return s;
});
ed('functions/api/tv-vendedor.js', (s) => {
  s = tr(s, "const ehPedidoDoRca = (numPedido, rca) => !!rca && new RegExp('^' + String(rca) + '[0-9]{6}$').test(String(numPedido || ''));",
    "const ehPedidoDoRca = (numPedido, rca) => !!rca && new RegExp('^' + String(rca) + '[0-9]{6}$').test(String(numPedido || ''));\n// tolerante: 1,5% dos pedidos tem 5 ou 7 digitos depois do codigo (108600094 = RCA 1086)\nconst ehPedidoTolerante = (numPedido, rca) => !!rca && new RegExp('^' + String(rca) + '[0-9]{5,7}$').test(String(numPedido || ''));", 'helper');
  s = tr(s, "  const iAtual = rca ? todas.findIndex((v) => ehPedidoDoRca(v.num_pedido, rca)) : (todas.length ? 0 : -1);",
    "  let iAtual = rca ? todas.findIndex((v) => ehPedidoDoRca(v.num_pedido, rca)) : (todas.length ? 0 : -1);\n  if (iAtual < 0 && rca) iAtual = todas.findIndex((v) => ehPedidoTolerante(v.num_pedido, rca));", 'iatual');
  return s;
});
ed('testes/rodar_testes.mjs', (s) => tr(s, "const ehDono = new Function(eng.slice(ini, fim) + '; return ehPedidoDoRca;')();", "const ehDono = new Function(eng.slice(ini, eng.indexOf('function donoDoPedido')) + '; return ehPedidoDoRca;')();\n    const dono = new Function(eng.slice(ini, eng.indexOf('\n}\n', eng.indexOf('function donoDoPedido')) + 3) + '; return donoDoPedido;')();\n    ok(dono('108600094', ['1086', '60']) === '1086' && dono('5500000561', ['550', '55']) === '550' && dono('10000123', ['10', '100']) === '10' && dono('100000123', ['10', '100']) === '100' && dono('1045000160', ['79', '1045']) === '1045', 'dono do pedido: formatos com 5 ou 7 digitos e codigos parecidos (10 x 100) resolvidos pelo codigo conhecido mais longo');", 'teste'));
