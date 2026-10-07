import fs from 'fs';
const T = process.env.TEMP, R = 'c:/Users/vitorio.neto/Documents/Projetos IA/CEVEN várias telas';
const dash = JSON.parse(fs.readFileSync(T + '/dash.json', 'utf8'))[0].results;
const mostra = fs.readFileSync(T + '/mostra.json', 'utf8');
const cfg = fs.readFileSync(R + '/public/incentivo_outubro_2026.json', 'utf8');
globalThis.fetch = async (u) => { u = String(u); return { json: async () => JSON.parse(u.includes('tv-mostra') ? mostra : cfg) }; };
const env = { DB: { prepare: (sql) => ({ bind: () => ({ all: async () => ({ results: dash.map((x) => ({ r: x.r, f: x.f, m: x.m, p: x.p, u: '2026-10-07 17:40:00' })) }) }), first: async () => ({ d: '2026-10-07' }) }) } };
const { onRequestGet } = await import('file:///' + R + '/functions/api/incentivo-outubro.js');
const j = await (await onRequestGet({ request: new Request('https://x.pages.dev/api/incentivo-outubro'), env })).json();
if (j.erro) { console.log(j); process.exit(1); }
console.log(j.nacional, j.premio_se_fechasse_hoje, j.fora_do_calculo.sem_dashboard_n, j.fora_do_calculo);
console.log(j.filiais.map((f) => `${f.filial} r${f.rcas} real${f.real} colN${f.coluna_n} ${f.pct_coluna_n}% g:${f.gerentes.map((g) => g.grupo + ':' + g.pct).join(',')}`).join('\n'));
console.log(j.vendedores.slice(0, 3), j.supervisores.slice(0, 3));
fs.writeFileSync(T + '/inc_out.json', JSON.stringify(j));
