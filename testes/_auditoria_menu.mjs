// INDICE LIMITADO DO VENDEDOR (09/11/2026): conversa em sequencia, producao SO LEITURA.
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from "child_process"; import fs from "fs"; import path from "path";
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
// AUDITORIA DO MENU DO VENDEDOR (Vitorio, 10/11/2026): abre todos os indices e sub-opcoes como o vendedor e grava 1 MD por item. Producao SO LEITURA.
// uso: node testes/_auditoria_menu.mjs FILIAL RCA "NOME"
const [fil, rca, nome] = process.argv.slice(2);
const { MENU_VENDEDOR, SUB_VENDEDOR } = await import('../functions/_lib/jota/respostas/liga_mix.js');
const V = { nome, papel: 'vendedor', filial: fil, rca: String(rca) };
const dir = path.join('auditoria', `${nome} - ${fil} ${rca}`); fs.mkdirSync(dir, { recursive: true });
const pergunta = async (q, ult) => { const B = _teste.criaBase(ORIGIN, { DB }); B.ultOut = ult; try { return String(await _teste.respostaPronta(B, V, q, [])); } catch (e) { return 'ERRO ' + e.message; } };
const grava = (cod, titulo, passos, r) => fs.writeFileSync(path.join(dir, cod + '.md'), `# ${cod} — ${titulo}\n\n- Vendedor: ${nome} (${fil} ${rca})\n- Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (dados de producao, so leitura)\n- O vendedor digitou: ${passos}\n\n## Resposta do Jota\n\n\`\`\`\n${r}\n\`\`\`\n`);
const menu = await pergunta('menu', '');
fs.writeFileSync(path.join(dir, '0 - menu.md'), `# Menu do vendedor\n\n\`\`\`\n${menu}\n\`\`\`\n`);
for (let k = 1; k <= MENU_VENDEDOR.length; k++) {
  const r = await pergunta(String(k), menu); grava(String(k), MENU_VENDEDOR[k - 1][0], `"${k}" logo depois do menu`, r); console.log('ok', k);
  for (let s = 1; s <= (SUB_VENDEDOR[k] || []).length; s++) { const rs = await pergunta(String(s), r); grava(`${k}.${s}`, SUB_VENDEDOR[k][s - 1][0], `"${k}" e depois "${s}"`, rs); console.log('ok', k + '.' + s); }
}
limpa();
