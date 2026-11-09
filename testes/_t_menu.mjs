// MENU DO VENDEDOR (09/11/2026): cada numero do menu cai numa resposta pronta. Producao SO LEITURA; nada e enviado.
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const V = { nome: 'GRACIELA BONAMIGO', papel: 'vendedor', filial: 'TCV', rca: '1057', celular: '5545999999999' };
const menu = await _teste.respostaPronta(_teste.criaBase(ORIGIN, { DB }), V, 'menu', []);
console.log('MENU =>', String(menu).split('\n').slice(0, 3).join(' | '));
for (let i = 1; i <= 13; i++) {
  const B = _teste.criaBase(ORIGIN, { DB }); B.ultOut = String(menu);
  try { const r = await _teste.respostaPronta(B, V, String(i), []); console.log(`\n[${i}] => ${r == null ? '(SEM RESPOSTA)' : String(r).replace(/\n+/g, ' | ').slice(0, 230)}`); }
  catch (e) { console.log(`\n[${i}] => ERRO ${e.message}`); }
}
limpa();
