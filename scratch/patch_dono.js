const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };
ed('functions/api/tv-vendedor.js', (s) => {
  s = tr(s, 'function analisaPedido(historico, cat) {\n  const visitas = Array.isArray(historico?.ultimas_visitas) ? historico.ultimas_visitas : [];\n  if (!visitas.length) return null;\n  const [atual, ...anteriores] = visitas;\n',
`// O historico do CLIENTE traz pedidos de TODOS os vendedores que o atendem (ex.: pasta Mars de outro RCA). O numero do pedido e o codigo do
// RCA + 6 digitos (177000874 = RCA 177). Pedido de outro vendedor nunca entra na analise (05/10/2026: corte de Twix da pasta Mars
// apareceu no boletim do vendedor 60, que nao vende Twix).
const ehPedidoDoRca = (numPedido, rca) => !!rca && new RegExp('^' + String(rca) + '[0-9]{6}$').test(String(numPedido || ''));
function analisaPedido(historico, cat, rca) {
  const todas = Array.isArray(historico?.ultimas_visitas) ? historico.ultimas_visitas : [];
  const iAtual = rca ? todas.findIndex((v) => ehPedidoDoRca(v.num_pedido, rca)) : (todas.length ? 0 : -1);
  if (iAtual < 0) return null; // sem pedido proprio do vendedor neste cliente: nao analisa (nunca usa pedido de outro vendedor)
  const atual = todas[iAtual];
  const dataAtual = String(atual.data_visita || '').slice(0, 10);
  // anteriores: historico do cliente, sem os pedidos de OUTROS vendedores do mesmo dia do pedido atual
  const anteriores = todas.filter((v, k) => k > iAtual && !(String(v.data_visita || '').slice(0, 10) === dataAtual && rca && !ehPedidoDoRca(v.num_pedido, rca)));
  const visitas = [atual, ...anteriores];
  if (!visitas.length) return null;
`, 'analisa');
  s = tr(s, 'const analise = analisaPedido(resultados[i], catalogo);', 'const analise = analisaPedido(resultados[i], catalogo, id);', 'call');
  return s;
});
