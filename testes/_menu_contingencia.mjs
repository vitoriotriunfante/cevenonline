// MENU EM CONTINGENCIA (Vitorio, 12/11/2026: CEVEN fora; "cada item tem que responder com o melhor dado que tiver"). Producao, SO LEITURA:
// roda todos os itens e subitens do menu do vendedor e do supervisor e grava o texto de cada resposta para conferencia.
// Uso: node testes/_menu_contingencia.mjs TCV 352
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
import { spawnSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const { _teste } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const [fil, rca] = process.argv.slice(2);
const { carregaEscopo } = await import('../functions/_lib/jota/escopo.js');
const Ev = await carregaEscopo(_teste.criaBase(ORIGIN, { DB }), { nome: 'x', filiais: [fil], grupo: null, supervisor: null, rca: String(rca), nacional: false });
const v = (Ev.vend || [])[0]; if (!v) throw new Error('vendedor nao achado');
const cV = { nome: v.nome, papel: 'vendedor', filial: fil, rca: String(rca) }, cS = { nome: v.supervisor, papel: 'supervisor', filial: fil, supervisor: v.supervisor };
const fala = async (c, q, ult = '') => { const B = _teste.criaBase(ORIGIN, { DB }); B.ultOut = ult; try { return String(await _teste.respostaPronta(B, c, q, [])); } catch (e) { return 'ERRO ' + e.message; } };
const out = [`# Menu em contingência — ${fil} ${rca} ${v.nome} (sup. ${v.supervisor}) — ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, ''];
const itensV = ['1', '1.1', '1.2', '1.3', '2', '2.1', '3', '4', '4.1', '4.2', '4.3', '4.4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'];
const itensS = ['1', '2', '3', '4', '4.1', '4.2', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'];
for (const [c, lst, rot] of [[cV, itensV, 'VENDEDOR'], [cS, itensS, 'SUPERVISOR']]) for (const q of lst) { const r = await fala(c, q); out.push(`## ${rot} ${q}`, '```', r.replace(/\n_Essa resposta ajudou[\s\S]*$/, '').slice(0, 1800), '```', ''); process.stdout.write(rot[0] + q + ' '); }
const arq = path.join('auditoria', `MENU CONTINGENCIA ${fil} ${rca}.md`); fs.mkdirSync('auditoria', { recursive: true }); fs.writeFileSync(arq, out.join('\n')); console.log('\n' + arq);
