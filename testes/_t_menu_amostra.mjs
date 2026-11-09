// TRIPLO CHECK DO MENU (09/11/2026): 2 varejo + 1 AS por filial, os 15 indices, producao SO LEITURA (nada e enviado).
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const A = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), saida = process.argv[3];
const ruim = (r) => r == null || /ERRO|Esse número não está|não achei a sua rota|undefined|NaN|\[object/i.test(String(r));
fs.writeFileSync(saida, '');
for (const a of A) {
  const V = { nome: a.nome, papel: 'vendedor', filial: a.filial, rca: a.rca };
  const menu = await _teste.respostaPronta(_teste.criaBase(ORIGIN, { DB }), V, 'menu', []).catch((e) => 'ERRO ' + e.message);
  const itens = [];
  for (let i = 1; i <= 15; i++) {
    const B = _teste.criaBase(ORIGIN, { DB }); B.ultOut = String(menu);
    let r; try { r = await _teste.respostaPronta(B, V, String(i), []); } catch (e) { r = 'ERRO ' + e.message; }
    itens.push({ i, ok: !ruim(r), txt: String(r).replace(/\n+/g, ' | ').slice(0, 160) });
  }
  const um = itens[0].txt, fat = (um.match(/Faturado: \*R\$ ([\d.]+)\*/) || [])[1], meta = (um.match(/de R\$ ([\d.]+) →/) || [])[1];
  fs.appendFileSync(saida, JSON.stringify({ ...a, menuOk: /MENU DO JOTA/.test(String(menu)), itens, jota_fat: fat || null, jota_meta: meta || null }) + '\n');
}
limpa();
