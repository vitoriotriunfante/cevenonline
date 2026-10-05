const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) {
  const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
  s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel);
}
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ---- 1) tv-vendedor: industrias e categorias do pedido do dia, por cliente ----
ed('functions/api/tv-vendedor.js', (s) => {
  s = tr(s, 'function analisaPedido(historico) {', `// Catalogo codigo -> industria (e categoria da Mondelez), gerado por gerar_catalogo_industrias.js e publicado em /catalogo_industrias.json
let CATALOGO = null;
async function carregaCatalogo(request) {
  if (CATALOGO) return CATALOGO;
  try {
    const r = await fetch(new URL('/catalogo_industrias.json', request.url));
    if (r.ok) CATALOGO = await r.json();
  } catch { /* sem catalogo: os gols ficam sem nivel (nunca inventa) */ }
  return CATALOGO;
}
// Industrias (e categorias Mondelez) do pedido de HOJE: so linha com valor > 0 (bonificacao R$ 0 nao conta); codigo fora do catalogo e ignorado.
function industriasDoPedido(skus, cat) {
  if (!cat || !Array.isArray(skus)) return { industrias: null, categorias: null };
  const ind = new Map(), ca = new Map();
  for (const it of skus) {
    const v = Number(it.total) || 0;
    if (v <= 0) continue;
    const cod = String(it.codigo);
    if (cat.i[cod]) ind.set(cat.i[cod], (ind.get(cat.i[cod]) || 0) + v);
    if (cat.c[cod]) ca.set(cat.c[cod], (ca.get(cat.c[cod]) || 0) + v);
  }
  const lista = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ n, v: Math.round(v * 100) / 100 }));
  return { industrias: lista(ind), categorias: lista(ca) };
}
function analisaPedido(historico, cat) {`, 'analisa');
  s = tr(s, '  return { skusAtual, mediaHistorica, dobrouMix: mediaHistorica != null ? mixDobrado(skusAtual, mediaHistorica) : false, bonificacao, dobradinhaQuinzenas, valorAtual };',
    '  const { industrias, categorias } = industriasDoPedido(atual?.skus, cat);\n  return { skusAtual, mediaHistorica, dobrouMix: mediaHistorica != null ? mixDobrado(skusAtual, mediaHistorica) : false, bonificacao, dobradinhaQuinzenas, valorAtual, industrias, categorias };', 'ret');
  s = tr(s, '          dobradinhaQuinzenas: analisePorCliente?.[c.id_cliente]?.dobradinhaQuinzenas || false\n',
    '          dobradinhaQuinzenas: analisePorCliente?.[c.id_cliente]?.dobradinhaQuinzenas || false,\n          industrias: analisePorCliente?.[c.id_cliente]?.industrias || null,\n          categorias: analisePorCliente?.[c.id_cliente]?.categorias || null\n', 'montar');
  s = tr(s, '  const analisePorCliente = {};\n  if (positivadosHoje.length) {', '  const analisePorCliente = {};\n  if (positivadosHoje.length) {\n    const catalogo = await carregaCatalogo(request);', 'cat');
  s = tr(s, 'const analise = analisaPedido(resultados[i]);', 'const analise = analisaPedido(resultados[i], catalogo);', 'call');
  return s;
});

// ---- 2) cron-lances: nivel e extra gravados na prova do gol ----
ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, 'function vend(id, canal, sup, d) {', "import { qualificaGol } from '../_lib/qualificacao_gol.js';\nfunction vend(id, canal, sup, d, carteira) {", 'vend');
  s = tr(s, '    id, nome: d.nome, canal, sup: sup || \'\', campo, cl,', '    id, nome: d.nome, canal, sup: sup || \'\', carteira: carteira || \'\', campo, cl,', 'vend2');
  s = tr(s, "canalMapa.set(String(v2.rca), { canal: String(v2.canal || '').toUpperCase(), sup: v2.supervisor || '' });", "canalMapa.set(String(v2.rca), { canal: String(v2.canal || '').toUpperCase(), sup: v2.supervisor || '', carteira: String(v2.carteira || '').toUpperCase() });", 'mapa');
  s = tr(s, 'const v = vend(codigo, info.canal, info.sup, d);', 'const v = vend(codigo, info.canal, info.sup, d, info.carteira);', 'vend3');
  s = tr(s, "out.push({ chave: `gol_inativo|${v.id}|${c.id}`, nivel: 'gol', v, c });", "out.push({ chave: `gol_inativo|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: (qualificaGol(v.carteira, c) || {}).texto });", 'g1');
  s = tr(s, "if (c.dobrouMix) out.push({ chave: `gol_mix|${v.id}|${c.id}`, nivel: 'gol', v, c });", "if (c.dobrouMix) out.push({ chave: `gol_mix|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: (qualificaGol(v.carteira, c) || {}).texto });", 'g2');
  s = tr(s, "if (c.dobradinhaQuinzenas) out.push({ chave: `gol_quinzenas|${v.id}|${c.id}`, nivel: 'gol', v, c });", "if (c.dobradinhaQuinzenas) out.push({ chave: `gol_quinzenas|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: (qualificaGol(v.carteira, c) || {}).texto });", 'g3');
  return s;
});

// ---- 3) endpoint de lances: soma o extra do carimbo aos pontos do gol ----
ed('functions/api/brasileirao-lances.js', (s) => {
  s = tr(s, 'function achaPontuacao(chave, nivel) {', "import { lerQualif } from '../_lib/qualificacao_gol.js';\nfunction achaPontuacao(chave, nivel) {", 'imp');
  s = tr(s, '      const pont = achaPontuacao(l.chave, l.nivel);\n', "      const pont0 = achaPontuacao(l.chave, l.nivel);\n      const q = lerQualif(l.obs); // gol qualificado: so existe em lance gravado de 05/10/2026 em diante\n      const pont = q ? { ...pont0, pontos: pont0.pontos + q.extra, nome: pont0.nome + ' ' + q.nivel } : pont0;\n", 'pont');
  s = tr(s, '        pontos_motivo: pont.motivo\n', '        pontos_motivo: pont.motivo,\n        qualificacao: q ? q.nivel : null,\n        extra_qualificacao: q ? q.extra : 0\n', 'out');
  return s;
});
console.log('servidor ok');
