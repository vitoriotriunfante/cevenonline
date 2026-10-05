const D = require('better-sqlite3');
const db = new D('c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/analises/pedidos_historico_ceven.db', { readonly: true });
const r = db.prepare("select count(*) n, sum(case when length(num_pedido)=length(rca_id)+6 and substr(num_pedido,1,length(rca_id))=rca_id then 1 else 0 end) casa from pedidos_historico").get();
console.log('pedidos_historico', r.n, 'numero = RCA+6 digitos:', r.casa, (100 * r.casa / r.n).toFixed(2) + '%');
console.log(db.prepare("select min(data_pedido) a, max(data_pedido) b, count(distinct substr(data_pedido,1,7)) meses from pedidos_historico where data_pedido >= '2020'").get());
console.log(db.prepare("select substr(data_pedido,1,7) m, count(*) n from pedidos_historico where data_pedido >= '2026-06' group by m order by m").all());
console.log(db.prepare("select num_pedido,rca_id,categoria_corte,vl_cortado from pedidos_historico where num_pedido like '60000403'").all());
