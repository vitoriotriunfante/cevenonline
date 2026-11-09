// INDICE LIMITADO DO VENDEDOR (09/11/2026): conversa em sequencia, producao SO LEITURA.
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from "child_process"; import fs from "fs"; import path from "path";
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const V = { nome: 'GRACIELA BONAMIGO', papel: 'vendedor', filial: 'TCV', rca: '1057' };
let ult = 'MENU DO JOTA';
for (const q of ['1', '3', 'tem toblerone', 'campanha biscuit', 'Toblerone?']) {
  const B = _teste.criaBase(ORIGIN, { DB }); B.ultOut = ult;
  let r; try { r = await _teste.respostaPronta(B, V, q, []); } catch (e) { r = 'ERRO ' + e.message; }
  console.log(`\n>>> ${q}\n${String(r).split('\n').filter(Boolean).slice(0, 3).join(' | ').slice(0, 220)}${/〔|Opções do|Voltar ao menu/.test(String(r)) ? '\n    [rodape: ' + String(r).split('\n').slice(-6).join(' | ').slice(0, 200) + ']' : ''}`);
  ult = r;
}
limpa();
