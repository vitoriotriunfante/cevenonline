const fs = require('fs');
function ed(rel, fn) { let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); s = fn(s); fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok', rel); }
const tr = (s, de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); return s.replace(de, () => para); };

ed('functions/api/tv-vendedor.js', (s) => {
  s = tr(s, "  const [dash, prod, rot] = central\n    ? [central.dash, central.prod, central.rot]",
    "  let [dash, prod, rot] = central\n    ? [central.dash, central.prod, central.rot]", 'let');
  s = tr(s, "  // G03 (Dobrou o Mix) e V03 (Bonificação): só para clientes positivados HOJE",
"  // DADO DE ONTEM NA MANHA DE HOJE (Vitório, 07/10/2026: \"tô recebendo lance de ontem agora\"): na virada do dia o CEVEN ainda serve o roteiro e a produtividade de ONTEM.\n" +
"  // 1) roteiro com cliente de OUTRA data (data_visita) ou com check-in DEPOIS da hora de agora = roteiro de ontem: descarta (nenhum lance nasce dele).\n" +
"  // 2) ate as 10h: produtividade do dia com visitas/pedidos mas roteiro (com clientes) SEM nenhum check-in = produtividade de ontem: zera o 'dia'. Nunca inventa: so deixa de usar dado velho.\n" +
"  let rotaAntiga = false;\n" +
"  { const hojeSP = dataHojeBrasilia(), hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());\n" +
"    if (Array.isArray(rot) && rot.some((c) => (c.data_visita && String(c.data_visita).slice(0, 10) !== hojeSP) || (c.checkin_horario && String(c.checkin_horario).slice(0, 5) > hm))) { rot = []; rotaAntiga = true; }\n" +
"    if (!rotaAntiga && hm < '10:00' && prod && prod.dia && Array.isArray(rot) && rot.length > 0 && !rot.some((c) => c.checkin_horario) && (Number(prod.dia.visitas_na_rota) > 0 || Number(prod.dia.dig_pedido) > 0 || Number(prod.dia.positivacao) > 0)) {\n" +
"      prod = { ...prod, dia: { ...prod.dia, faturamento: 0, positivacao: 0, dig_pedido: 0, visitas_na_rota: 0, visitas_com_venda: 0, eficacia_pct: 0 } }; rotaAntiga = true; } }\n" +
"  // G03 (Dobrou o Mix) e V03 (Bonificação): só para clientes positivados HOJE", 'guard');
  s = tr(s, "  const saida = montarTv(id, dash, prod, rot, analisePorCliente);\n", "  const saida = montarTv(id, dash, prod, rot, analisePorCliente);\n  saida.rota_antiga = rotaAntiga; // true = o CEVEN ainda servia dado de ontem: esta leitura nao gera lance\n", 'saida');
  return s;
});
console.log('tudo ok');
