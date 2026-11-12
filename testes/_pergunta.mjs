// Pergunta solta ao JOTA de producao, SO LEITURA (seco). Uso: node testes/_pergunta.mjs '<json do contato>' 'pergunta'
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
import { spawnSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const { _teste } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const [cj, ...q] = process.argv.slice(2);
const B = _teste.criaBase('https://ceven-cftv-matrix.pages.dev', { DB });
const t0 = Date.now(); const r = await _teste.respostaPronta(B, JSON.parse(cj), q.join(' '), []);
console.log(String(r)); console.log('\n[' + (Date.now() - t0) + ' ms] _clube=' + B._clube + ' _reserva=' + B._reserva);
