const fs = require('fs');
const rel = 'functions/api/cron-varredura-central.js';
let s = fs.readFileSync(rel, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const de = s.slice(s.indexOf("    // 4. FRIA: dashboard e devolucoes, 1/10 por tick"), s.indexOf("    await gravaLote(env, stmts.splice(0));\n\n    // Encadeia"));
if (!de) throw new Error('ancora');
const para =
"    // 4. FRIA: dashboard 1/10 por tick; DEVOLUCOES 1/3 por tick (Vitorio, 06/10/2026: \"precisamos ser coesos no numero\": com 1/10 a devolucao da TV/Lances ficava ~25 min\n" +
"    // atrasada em relacao ao WhatsApp, que le o CEVEN ao vivo. Com 1/3 fica em ~7 min).\n" +
"    const fatiaDash = rcas.filter((rca, i) => i % FATIAS_FRIA === ciclo % FATIAS_FRIA);\n" +
"    const fatiaDev = rcas.filter((rca, i) => i % FATIAS_DEV === ciclo % FATIAS_DEV);\n" +
"    // A etapa FRIA tem FATIA PROPRIA de tempo (05/10/2026): com o prazo geral, as etapas 1 a 3 consumiam os 100 s e a fria nunca rodava, entao painel (faturado do mes)\n" +
"    // e devolucoes ficavam congelados no dado da varredura completa (ex.: TPA R$ 42 mil na Executiva contra R$ 133 mil no CEVEN).\n" +
"    const prazoFria = Date.now() + 30000;\n" +
"    const tarefasFria = [...fatiaDash.map((rca) => () => getJson(urlRca('dashboard', rca))), ...fatiaDev.map((rca) => () => getJson(urlRca('devolucoes', rca)))];\n" +
"    const frias = await poolLimitado(tarefasFria, CONC, prazoFria);\n" +
"    const camposPorRca = new Map();\n" +
"    const campo = (rca) => { const k = String(rca.codigo); if (!camposPorRca.has(k)) camposPorRca.set(k, { rca, campos: {} }); return camposPorRca.get(k).campos; };\n" +
"    fatiaDash.forEach((rca, i) => { const dash = frias[i]; if (dash) campo(rca).dashboard_json = JSON.stringify(dash); });\n" +
"    fatiaDev.forEach((rca, i) => { const dev = frias[fatiaDash.length + i]; if (Array.isArray(dev)) campo(rca).devolucoes_json = JSON.stringify(dev); });\n" +
"    for (const { rca, campos } of camposPorRca.values()) { contagem.fria++; stmts.push(upsertParcial(env, dataRef, rca, campos)); }\n";
s = s.replace(de, () => para);
s = s.replace("const FATIAS_FRIA = 10;             // dashboard/devolucoes a cada 10 ticks", "const FATIAS_FRIA = 10;             // dashboard a cada 10 ticks\nconst FATIAS_DEV = 3;               // devolucoes a cada 3 ticks (~7 min): para a TV bater com o WhatsApp");
fs.writeFileSync(rel, crlf ? s.replace(/\n/g, '\r\n') : s); console.log('ok');
