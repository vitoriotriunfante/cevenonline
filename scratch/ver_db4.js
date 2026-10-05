const D = require('better-sqlite3');
const db = new D('c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/analises/pedidos_historico_ceven.db', { readonly: true });
const vend = new Set(db.prepare('select id from vendedores').all().map((x) => String(x.id)));
const rows = db.prepare("select num_pedido, rca_id from pedidos_historico where data_pedido >= '2026-09-01'").all();
let casa = 0, outroConhecido = 0, desconhecido = 0; const exDesc = [];
for (const r of rows) {
  const n = String(r.num_pedido), c = String(r.rca_id);
  if (n.length === c.length + 6 && n.startsWith(c)) { casa++; continue; }
  const pre = n.slice(0, -6);
  if (n.length > 6 && vend.has(pre)) outroConhecido++; else { desconhecido++; if (exDesc.length < 8) exDesc.push(n + ' (rca ' + c + ')'); }
}
console.log({ total: rows.length, casa, outro_vendedor_conhecido: outroConhecido, prefixo_desconhecido: desconhecido }, exDesc.join(' | '));
