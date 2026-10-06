const fs = require('fs'); const T = process.env.TEMP || '/tmp';
const raw = fs.readFileSync(T + '/goleadas.json', 'utf8'); const L = JSON.parse(raw.slice(raw.indexOf('[')))[0].results;
const D = require('better-sqlite3');
const db = new D('c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/analises/pedidos_historico_ceven.db', { readonly: true });
const maxDia = db.prepare('select max(data_pedido) m from pedidos_historico where data_pedido <= ?').get('2026-10-06').m;
console.log('lake tem pedidos ate', maxDia);
let ok = 0, falso = 0, sem = 0; const ex = [];
for (const l of L.filter((x) => x.dia <= maxDia)) {
  const r = db.prepare("select count(distinct id_cliente) c, count(*) p from pedidos_historico where data_pedido = ? and (cast(rca_id as text) = ? or (substr(num_pedido,1,length(?)) = ? and length(num_pedido) - length(?) between 5 and 7))").get(l.dia, String(l.rca), String(l.rca), String(l.rca), String(l.rca));
  if (!r || !r.p) { sem++; continue; }
  if (r.c >= 10) ok++; else { falso++; if (ex.length < 8) ex.push(`${l.dia} ${l.filial} ${l.rca} ${l.vendedor}: ${r.p} pedidos em ${r.c} clientes | obs: ${String(l.obs).slice(0, 60)}`); }
}
console.log({ confirmadas_com_10_clientes: ok, nao_confirmadas: falso, sem_dado_no_lake: sem });
console.log(ex.join('\n'));
