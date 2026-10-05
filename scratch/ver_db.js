const D = require('better-sqlite3');
const db = new D('c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/analises/pedidos_historico_ceven.db', { readonly: true });
for (const t of db.prepare("select name from sqlite_master where type='table'").all()) {
  const n = db.prepare('select count(*) c from "' + t.name + '"').get().c;
  const cols = db.prepare('pragma table_info("' + t.name + '")').all().map((c) => c.name).join(',');
  console.log(t.name, n, '|', cols.slice(0, 230));
}
const pk = db.prepare("select name from sqlite_master where type='table' and name like '%pedido%'").all();
for (const t of pk) {
  const cols = db.prepare('pragma table_info("' + t.name + '")').all().map((c) => c.name);
  const d = cols.find((c) => /data/i.test(c));
  if (d) console.log(t.name, 'de', db.prepare('select min("' + d + '") a, max("' + d + '") b from "' + t.name + '"').get().a, 'ate', db.prepare('select max("' + d + '") b from "' + t.name + '"').get().b);
}
