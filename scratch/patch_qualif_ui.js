const fs = require('fs');
const R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/';
function ed(rel, fn) {
  const p = R + rel; let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
  s = fn(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel);
}
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); return s.replace(de, () => para); };

// helper unico das telas (mesma escada de functions/_lib/qualificacao_gol.js)
ed('public/animacoes/tv-animacoes.js', (s) => s + `
// Gol qualificado (Vitório, 05/10/2026): nível pela quantidade de INDÚSTRIAS no pedido do cliente (carteira MONDELEZ: categorias).
// Mesma escada de functions/_lib/qualificacao_gol.js: 1 bronze +0 · 2 prata +1 · 3 ouro +2 · 4 diamante +3 · 5+ platina +4.
window.qualificaGolUI = function (carteira, c) {
  const so = String(carteira || '').toUpperCase() === 'MONDELEZ';
  const lista = c && (so ? c.categorias : c.industrias);
  if (!Array.isArray(lista) || !lista.length) return null;
  const E = [[5, 'PLATINA', 4], [4, 'DIAMANTE', 3], [3, 'OURO', 2], [2, 'PRATA', 1], [1, 'BRONZE', 0]];
  const d = E.find((e) => lista.length >= e[0]);
  const brl = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { nivel: d[1], extra: d[2], n: lista.length, unidade: so ? 'categoria' : 'indústria', detalhe: lista.map((x) => x.n + ' ' + brl(x.v)).join('; ') };
};
`);

const INFO_VELHO = "  const infoLiga = pontosLanceOficial(item.tipo, subtipo);\n";
const INFO_NOVO =
"  const infoLiga0 = pontosLanceOficial(item.tipo, subtipo);\n" +
"  // Gol qualificado: resgate/mix/quinzenas ganham nivel (bronze..platina) e extra de pontos pelas industrias do pedido\n" +
"  const qGol = (item.tipo === 'gol' && ['inativo_recuperado', 'drible_vaca', 'recorrencia_salva', 'dobrou_mix', 'dobradinha_quinzenas'].includes(subtipo) && typeof qualificaGolUI === 'function')\n" +
"    ? qualificaGolUI((item.v || (item.a && item.a.v) || {}).carteira, item.c || (item.a && item.a.c)) : null;\n" +
"  const infoLiga = qGol ? {...infoLiga0, nome: infoLiga0.nome + ' ' + qGol.nivel, pts: '+' + ((parseInt(infoLiga0.pts, 10) || 0) + qGol.extra) + ' PONTOS NA LIGA'} : infoLiga0;\n";
const QLN =
"  if (qGol && typeof dec === 'string') {\n" +
"    dec += '<div class=\"ln hot\"><b>QUALIFICAÇÃO</b><span>' + esc(qGol.nivel + ' (+' + qGol.extra + ' pts) — ' + qGol.n + ' ' + qGol.unidade + (qGol.n > 1 ? 's' : '') + ' no pedido: ' + qGol.detalhe) + '</span></div>';\n" +
"  }\n";
const TEMPO_ANC = "  // TEMPO NO CLIENTE em todo lance de cliente";

for (const rel of ['public/tvapp.html', 'public/matrizapp.html']) {
  ed(rel, (s) => {
    s = tr(s, INFO_VELHO, INFO_NOVO, rel + ' info');
    s = tr(s, TEMPO_ANC, QLN + TEMPO_ANC, rel + ' ln');
    return s;
  });
}
ed('public/tvapp.html', (s) => {
  s = tr(s, "id: r.id, nome: r.nome, canal: r.canal, sup: r.sup || '', campo, d, cl,", "id: r.id, nome: r.nome, canal: r.canal, carteira: r.carteira || '', sup: r.sup || '', campo, d, cl,", 'vend');
  s = tr(s, ".map(r => ({id: String(r.rca), nome: limpaNome(r.nome), canal: (r.canal || '').toUpperCase(), sup: limpaNome(r.supervisor), grupo: r.grupo || ''}));\n    listaMostra = true;", ".map(r => ({id: String(r.rca), nome: limpaNome(r.nome), canal: (r.canal || '').toUpperCase(), sup: limpaNome(r.supervisor), grupo: r.grupo || '', carteira: String(r.carteira || '').toUpperCase()}));\n    listaMostra = true;", 'reps');
  return s;
});
ed('public/matrizapp.html', (s) => {
  s = tr(s, "sup: limpaNome(r.supervisor), grupo: r.grupo || ''}));", "sup: limpaNome(r.supervisor), grupo: r.grupo || '', carteira: String(r.carteira || '').toUpperCase()}));", 'reps');
  s = tr(s, "return {sig, id: r.id, nome: r.nome, canal: r.canal, sup: r.sup, grupo: r.grupo || '',", "return {sig, id: r.id, nome: r.nome, canal: r.canal, carteira: r.carteira || '', sup: r.sup, grupo: r.grupo || '',", 'vend');
  return s;
});

// Gestao de Equipe: etiqueta da carteira (so Mondelez) ao lado do nome
ed('public/gestao-equipe.html', (s) => tr(s,
  "          <div style=\"font-weight:600;color:#fff;\">${r.nome}</div>\n",
  "          <div style=\"font-weight:600;color:#fff;\">${r.nome}${String(r.carteira || '').toUpperCase() === 'MONDELEZ' ? ' <span style=\"font-size:10px;background:#7c3aed;color:#fff;padding:1px 6px;border-radius:8px\" title=\"Carteira só Mondelez: o gol qualificado conta categorias, não indústrias\">SÓ MONDELEZ</span>' : ''}</div>\n", 'badge'));
console.log('ui ok');
