const fs = require('fs');
const p = 'testes/rodar_testes.mjs';
let s = fs.readFileSync(p, 'utf8');
const tr = (de, para, r) => { if (s.split(de).length !== 2) throw new Error('ancora ' + r + ' ' + (s.split(de).length - 1)); s = s.replace(de, () => para); };
tr("status: 'EFETIVADO', checkin_horario: '09:00:00' }, { id_cliente: '12'", "status: 'EFETIVADO', checkin_horario: '00:01:00' }, { id_cliente: '12'", 'hora');
tr("  { const r = await chamar('&central=1', linha(20));",
"  { // DADO DE ONTEM: roteiro com cliente de outra data, ou com check-in depois da hora de agora, nao pode gerar lance\n" +
"    const copia = rot.map((c) => ({ ...c }));\n" +
"    rot.splice(0, rot.length, { ...copia[0], data_visita: '2026-01-01' }, copia[1]);\n" +
"    let r = await chamar('&central=1', linha(3));\n" +
"    ok(r.corpo.rota_antiga === true && r.corpo.clientes.length === 0, 'roteiro com cliente de OUTRA data (ontem) e descartado: rota_antiga e nenhum cliente');\n" +
"    rot.splice(0, rot.length, { ...copia[0], data_visita: hoje, checkin_horario: '23:59:00' }, copia[1]);\n" +
"    r = await chamar('&central=1', linha(3));\n" +
"    ok(r.corpo.rota_antiga === true && r.corpo.clientes.length === 0, 'roteiro com check-in as 23:59 (depois da hora de agora) e descartado como dado de ontem');\n" +
"    rot.splice(0, rot.length, { ...copia[0], data_visita: hoje }, copia[1]);\n" +
"    r = await chamar('&central=1', linha(3));\n" +
"    ok(r.corpo.rota_antiga === false && r.corpo.clientes.length === 2, 'roteiro de hoje com check-in ja ocorrido continua valendo');\n" +
"    rot.splice(0, rot.length, ...copia);\n" +
"  }\n" +
"  { const r = await chamar('&central=1', linha(20));", 'testes');
fs.writeFileSync(p, s); console.log('ok');
