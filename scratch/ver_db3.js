const D = require('better-sqlite3');
const db = new D('c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/analises/pedidos_historico_ceven.db', { readonly: true });
const nao = db.prepare("select num_pedido, rca_id, filial_sigla, length(num_pedido) L from pedidos_historico where data_pedido >= '2026-09-01' and not (length(num_pedido)=length(rca_id)+6 and substr(num_pedido,1,length(rca_id))=rca_id)").all();
console.log('set/out nao casam:', nao.length);
const porLen = {}; nao.forEach(x => porLen[x.L] = (porLen[x.L] || 0) + 1); console.log('por tamanho', porLen);
console.log(nao.slice(0, 12).map(x => x.filial_sigla + ' rca ' + x.rca_id + ' ped ' + x.num_pedido).join('\n'));
// o mesmo numero aparece com rcas diferentes?
console.log(db.prepare("select count(*) n from (select num_pedido from pedidos_historico group by num_pedido having count(distinct rca_id)>1)").get());
console.log(db.prepare("select count(*) n, count(distinct num_pedido) d from pedidos_historico").get());
