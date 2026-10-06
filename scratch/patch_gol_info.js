const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) { const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// ---- 1) tv-vendedor: so analisa o pedido DE HOJE do proprio vendedor; devolve pedido e quinzenas reais ----
ed('functions/api/tv-vendedor.js', (s) => {
  s = tr(s, 'function analisaPedido(historico, cat, rca) {', 'function analisaPedido(historico, cat, rca, hoje) {', 'sig');
  s = tr(s, "  const dataAtual = String(atual.data_visita || '').slice(0, 10);\n",
"  const dataAtual = String(atual.data_visita || '').slice(0, 10);\n" +
"  // O gol e do pedido de HOJE. Se o pedido de hoje ainda nao apareceu no historico, o 'atual' seria uma compra ANTIGA do cliente e geraria gol falso\n" +
"  // (06/10/2026: dobradinha das quinzenas e industrias de um pedido de 22/09 saindo como gol de hoje). Sem pedido de hoje = sem analise.\n" +
"  if (hoje && dataAtual !== hoje) return null;\n", 'hoje');
  s = tr(s, "  const { industrias, categorias } = industriasDoPedido(atual?.skus, cat);\n",
"  const { industrias, categorias } = industriasDoPedido(atual?.skus, cat);\n" +
"  // pedido de hoje e (se houver dobradinha) os pedidos REAIS de cada quinzena do mes, com numero, data e valor (nunca estimativa)\n" +
"  const pedidoHoje = { num: atual.num_pedido || null, status_pedido: atual.status_pedido || null, valor: Number(atual.total_clube) || valorAtual };\n" +
"  let quinzenas = null;\n" +
"  if (dobradinhaQuinzenas) {\n" +
"    const doMes = todas.filter((v) => String(v.data_visita || '').slice(0, 7) === mesAtual && v.num_pedido && Number(v.total_clube) > 0);\n" +
"    const grupo = (f) => { const pedidos = doMes.filter((v) => f(Number(String(v.data_visita).slice(8, 10)))).map((v) => ({ data: String(v.data_visita).slice(0, 10), num: v.num_pedido, valor: Number(v.total_clube) || 0, status: v.status_pedido || null })); return { valor: Math.round(pedidos.reduce((a, p) => a + p.valor, 0) * 100) / 100, pedidos }; };\n" +
"    quinzenas = { q1: grupo((d) => d <= 15), q2: grupo((d) => d > 15) };\n" +
"  }\n", 'dados');
  s = tr(s, 'bonificacao, dobradinhaQuinzenas, valorAtual, industrias, categorias };', 'bonificacao, dobradinhaQuinzenas, valorAtual, industrias, categorias, pedidoHoje, quinzenas };', 'ret');
  s = tr(s, "          industrias: analisePorCliente?.[c.id_cliente]?.industrias || null,\n", "          pedidoHoje: analisePorCliente?.[c.id_cliente]?.pedidoHoje || null,\n          quinzenas: analisePorCliente?.[c.id_cliente]?.quinzenas || null,\n          industrias: analisePorCliente?.[c.id_cliente]?.industrias || null,\n", 'montar');
  s = tr(s, 'analisaPedido(resultados[i], catalogo, id);', 'analisaPedido(resultados[i], catalogo, id, dataHojeBrasilia());', 'call');
  return s;
});

// ---- 2) cron-lances: prova do gol de quinzenas com os pedidos reais ----
ed('functions/api/cron-lances.js', (s) => {
  s = tr(s, "if (c.dobradinhaQuinzenas) out.push({ chave: `gol_quinzenas|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: (qualificaGol(v.carteira, c) || {}).texto });",
    "if (c.dobradinhaQuinzenas) out.push({ chave: `gol_quinzenas|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: [provaPedidoHoje(c), provaQuinzenas(c), (qualificaGol(v.carteira, c) || {}).texto].filter(Boolean).join(' | ') });", 'q');
  s = tr(s, "if (c.dobrouMix) out.push({ chave: `gol_mix|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: (qualificaGol(v.carteira, c) || {}).texto });",
    "if (c.dobrouMix) out.push({ chave: `gol_mix|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: [provaPedidoHoje(c), (qualificaGol(v.carteira, c) || {}).texto].filter(Boolean).join(' | ') });", 'mix');
  s = tr(s, "out.push({ chave: `gol_inativo|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: (qualificaGol(v.carteira, c) || {}).texto });",
    "out.push({ chave: `gol_inativo|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: [provaPedidoHoje(c), (qualificaGol(v.carteira, c) || {}).texto].filter(Boolean).join(' | ') });", 'ina');
  s = tr(s, 'function vend(id, canal, sup, d, carteira) {',
`// Prova do gol de cliente: pedido de hoje (numero, status, valor) e, na dobradinha, os pedidos reais de cada quinzena do mes
function provaPedidoHoje(c) {
  const p = c && c.pedidoHoje;
  return p && p.num ? \`PEDIDO DE HOJE: \${p.num} · \${p.status_pedido || 'sem status'} · \${brl(p.valor)}\` : '';
}
function provaQuinzenas(c) {
  const q = c && c.quinzenas;
  if (!q) return '';
  const fmt = (g) => \`\${brl(g.valor)} (\${g.pedidos.map((p) => p.data.slice(8, 10) + '/' + p.data.slice(5, 7) + ' ped ' + p.num + ' ' + brl(p.valor)).join('; ') || 'sem pedido'})\`;
  return \`QUINZENAS: total \${brl(q.q1.valor + q.q2.valor)} · 1a \${fmt(q.q1)} · 2a \${fmt(q.q2)}\`;
}
function vend(id, canal, sup, d, carteira) {`, 'helpers');
  return s;
});

// ---- 3) telas: linhas reais de pedido e quinzenas (sem estimativa) ----
ed('public/animacoes/tv-animacoes.js', (s) => s + `
// Linhas do popup de gol de cliente com os dados REAIS do CEVEN: pedido de hoje e, na dobradinha, pedidos de cada quinzena (Vitório, 06/10/2026: sem estimativa)
window.golClienteLinhasHtml = function (c, subt, brl, esc) {
  if (!c) return '';
  let h = '';
  const p = c.pedidoHoje;
  if (p && p.num) h += '<div class="ln"><b>PEDIDO DE HOJE</b><span>' + esc(p.num) + ' · ' + esc(p.status_pedido || 'sem status') + ' · ' + brl(p.valor) + '</span></div>';
  if (subt === 'dobradinha_quinzenas') {
    const q = c.quinzenas;
    if (!q) return h + '<div class="ln"><b>QUINZENAS</b><span>sem dado no CEVEN</span></div>';
    const lista = (g) => g.pedidos.length ? g.pedidos.map((x) => x.data.slice(8, 10) + '/' + x.data.slice(5, 7) + ' ped ' + esc(x.num) + ' ' + brl(x.valor)).join(' · ') : 'sem pedido';
    h += '<div class="ln hot"><b>FATURAMENTO TOTAL</b><span>' + brl(q.q1.valor + q.q2.valor) + '</span></div>';
    h += '<div class="ln"><b>1ª QUINZENA</b><span>' + brl(q.q1.valor) + ' · ' + lista(q.q1) + '</span></div>';
    h += '<div class="ln"><b>2ª QUINZENA</b><span>' + brl(q.q2.valor) + ' · ' + lista(q.q2) + '</span></div>';
  }
  return h;
};
`);
ed('public/matrizapp.html', (s) => {
  const i = s.indexOf("    if (subt === 'dobradinha_quinzenas') {\n      const vFatTotal");
  const f = s.indexOf("    } else {\n      const vVendaReal", i);
  if (i < 0 || f < 0) throw new Error('bloco quinzenas matriz');
  s = s.slice(0, i) + "    linhasExtra += golClienteLinhasHtml(cObj, subt, brl, esc);\n    if (subt === 'dobradinha_quinzenas') {\n" + s.slice(f);
  return s;
});
ed('public/tvapp.html', (s) => {
  const velho = "dec = `${seloLiga}<div class=\"ln hot\"><b>VENDEDOR</b><span>${nomeComRca(item.v)}</span></div><div class=\"ln\"><b>LANCE</b><span>${esc(item.sub || 'GOL DE PLACA')}</span></div>`;";
  return tr(s, velho, "const cGol = item.c || (item.a && item.a.c), subGol = (item.a && item.a.subtipo) || item.subtipo;\n    dec = `${seloLiga}<div class=\"ln hot\"><b>VENDEDOR</b><span>${nomeComRca(item.v)}</span></div><div class=\"ln\"><b>LANCE</b><span>${esc(item.sub || 'GOL DE PLACA')}</span></div>${typeof golClienteLinhasHtml === 'function' ? golClienteLinhasHtml(cGol, subGol, brl, esc) : ''}`;", 'tv gol');
});

// ---- 4) Matriz: o botao Painel (e prev/next do painel) sai do modo Supervisores ----
ed('public/matrizapp.html', (s) => {
  s = tr(s, '  const alternarPainel = () => {\n', "  const sairSup = () => { if (SUP_MANUAL) { SUP_MANUAL = false; $('bsup').style.outline = 'none'; } };\n  const alternarPainel = () => {\n    sairSup();\n", 'painel');
  return s;
});
console.log('tudo ok');
