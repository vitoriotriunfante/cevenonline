const fs = require('fs');
const p = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas/pipeline/ceven_unified_engine.js';
let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora: ' + r + ' (' + (s.split(de).length - 1) + ')'); s = s.replace(de, () => para); };
tr("const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';",
"const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';\n" +
"// O historico do CLIENTE traz pedidos de TODOS os vendedores que o atendem (ex.: pasta Mars de outro RCA). O numero do pedido e o codigo do RCA\n" +
"// + 6 digitos (177000874 = RCA 177). Corte, bloqueio e 'comprou' so valem para o pedido do PROPRIO vendedor (Vitorio, 05/10/2026: corte de Twix da\n" +
"// pasta Mars apareceu no boletim do vendedor 60 e o mesmo pedido era contado para cada vendedor que visitou o cliente).\n" +
"function ehPedidoDoRca(numPedido, rca) {\n" +
"  const n = String(numPedido || ''), c = String(rca || '');\n" +
"  return !!c && n.length === c.length + 6 && n.startsWith(c) && /^[0-9]+$/.test(n.slice(c.length));\n" +
"}", 'helper');
tr("const visitasHoje = (histData?.ultimas_visitas || []).filter(v => v.data_visita === dataRef && v.num_pedido);",
   "const visitasHoje = (histData?.ultimas_visitas || []).filter(v => v.data_visita === dataRef && v.num_pedido && ehPedidoDoRca(v.num_pedido, r.codigo));", 'cortes');
tr("const ultimaVisita = hist?.ultimas_visitas?.[0];", "const ultimaVisita = (hist?.ultimas_visitas || []).find(v => ehPedidoDoRca(v.num_pedido, rca.codigo));", 'comprou');
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
