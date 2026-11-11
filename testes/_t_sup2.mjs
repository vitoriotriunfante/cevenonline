// INDICE LIMITADO DO VENDEDOR (09/11/2026): conversa em sequencia, producao SO LEITURA.
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from "child_process"; import fs from "fs"; import path from "path";
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const V = process.env.SUP === 'CRISTIANO' ? { nome: 'CRISTIANO RODRIGUES MACHADO', papel: 'supervisor', filial: 'TSJ', supervisor: 'CRISTIANO RODRIGUES MACHADO' } : process.env.SUP === 'SERGIO' ? { nome: 'SERGIO LOPES DE OLIVEIRA', papel: 'supervisor', filial: 'TBL', supervisor: 'SERGIO LOPES DE OLIVEIRA' } : { nome: 'VICTOR HUGO FONSECA CARVALHO', papel: 'supervisor', filial: 'TSJ', supervisor: 'VICTOR HUGO FONSECA CARVALHO' };
const fala = async (q, ult) => { const B = _teste.criaBase(ORIGIN, { DB }); B.ultOut = ult; try { return String(await _teste.respostaPronta(B, V, q, [])); } catch (e) { return 'ERRO ' + e.stack; } };
const curto = (r) => r.split('\n').slice(0, 8).join('\n') + (r.split('\n').length > 8 ? '\n  [...] ' + r.split('\n').slice(-3).join(' | ') : '');
let ult = '';
for (const q of process.argv.slice(2)) { if (q === '|') { ult = ''; continue; } const r = await fala(q, ult); console.log('===== "' + q + '"\n' + curto(r)); ult = r; }
limpa();
