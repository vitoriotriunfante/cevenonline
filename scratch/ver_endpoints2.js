const D = require('better-sqlite3');
const db = new D('c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/analises/pedidos_historico_ceven.db', { readonly: true });
for (const r of db.prepare("select metodo, endpoint_path, autenticacao from catalogo_endpoints_ceven where endpoint_path like '/api/filiais%' or endpoint_path like '/api/ceven%' or endpoint_path like '/api/rca/lista%' or endpoint_path like '%public%'").all()) console.log(r.metodo, r.endpoint_path, '|', r.autenticacao);
