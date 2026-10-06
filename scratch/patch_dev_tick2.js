const fs = require('fs');
const rel = 'functions/api/cron-varredura-central.js';
let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const a = s.indexOf("    const tarefasFria = ["), b = s.indexOf("    for (const { rca, campos } of camposPorRca.values())");
if (a < 0 || b < 0) throw new Error('ancora');
const novo =
"    // DEVOLUCOES primeiro (prioridade) e ponto de partida GIRANDO a cada tick: se o prazo estourar, nao e sempre o mesmo vendedor do fim da lista que fica sem atualizar\n" +
"    const rodar = (L) => { if (!L.length) return L; const k = (ciclo * 7) % L.length; return L.slice(k).concat(L.slice(0, k)); };\n" +
"    const itensFria = [...rodar(fatiaDev).map((rca) => ({ rca, tipo: 'devolucoes' })), ...rodar(fatiaDash).map((rca) => ({ rca, tipo: 'dashboard' }))];\n" +
"    const frias = await poolLimitado(itensFria.map((it) => () => getJson(urlRca(it.tipo, it.rca))), CONC, prazoFria);\n" +
"    const camposPorRca = new Map();\n" +
"    const campo = (rca) => { const k = String(rca.codigo); if (!camposPorRca.has(k)) camposPorRca.set(k, { rca, campos: {} }); return camposPorRca.get(k).campos; };\n" +
"    itensFria.forEach((it, i) => { const r = frias[i]; if (it.tipo === 'dashboard' && r) campo(it.rca).dashboard_json = JSON.stringify(r); if (it.tipo === 'devolucoes' && Array.isArray(r)) campo(it.rca).devolucoes_json = JSON.stringify(r); });\n";
s = s.slice(0, a) + novo + s.slice(b);
fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
