// INDICE LIMITADO DO VENDEDOR (09/11/2026): conversa em sequencia, producao SO LEITURA.
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from "child_process"; import fs from "fs"; import path from "path";
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
// depois do momento do supervisor, o numero digitado e o CODIGO do vendedor (06, 6, vendedor 6)
const MO = await import('../functions/_lib/jota/respostas/momentos.js'), { carregaEscopo } = await import('../functions/_lib/jota/escopo.js');
const nome = 'CRISTIANO RODRIGUES MACHADO', c = { nome, papel: 'supervisor', filial: 'TSJ', supervisor: nome };
const B = _teste.criaBase(ORIGIN, { DB }), Ev = await carregaEscopo(B, { nome: 'Equipe', filiais: ['TSJ'], grupo: null, supervisor: nome, nacional: false });
const m = await MO.respMomentoSupervisor(B, c, Ev, 'meio'); console.log(m.texto.split('\n').filter((l) => /^•|Digite/.test(l)).join('\n'));
for (const q of ['06', '6', 'vendedor 21', '99']) { const B2 = _teste.criaBase(ORIGIN, { DB }); B2.ultOut = m.texto; const r = String(await _teste.respostaPronta(B2, c, q, [])); console.log(`== "${q}" -> ${r.split('\n')[0]}`); }
limpa();
