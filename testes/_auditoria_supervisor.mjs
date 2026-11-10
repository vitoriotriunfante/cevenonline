// AUDITORIA DO MENU DO SUPERVISOR (Vitorio, 10/11/2026): abre todos os indices e sub-opcoes como o supervisor e grava 1 MD por item. Producao SO LEITURA.
// uso: node testes/_auditoria_supervisor.mjs FILIAL "NOME DO SUPERVISOR"
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from "child_process"; import fs from "fs"; import path from "path";
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const [fil, nome] = process.argv.slice(2);
const { MENU_SUPERVISOR, SUB_SUPERVISOR } = await import('../functions/_lib/jota/respostas/liga_mix.js');
const V = { nome, papel: 'supervisor', filial: fil, supervisor: nome };
const dir = path.join('auditoria', `SUPERVISOR ${nome} - ${fil}`); fs.mkdirSync(dir, { recursive: true });
const pergunta = async (q, ult) => { const B = _teste.criaBase(ORIGIN, { DB }); B.ultOut = ult; try { return String(await _teste.respostaPronta(B, V, q, [])); } catch (e) { return 'ERRO ' + e.message; } };
const grava = (cod, titulo, passos, r) => fs.writeFileSync(path.join(dir, cod + '.md'), `# ${cod} — ${titulo}\n\n- Supervisor: ${nome} (${fil})\n- Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (dados de producao, so leitura)\n- O supervisor digitou: ${passos}\n\n## Resposta do Jota\n\n\`\`\`\n${r}\n\`\`\`\n`);
const menu = await pergunta('menu', '');
fs.writeFileSync(path.join(dir, '0 - menu.md'), `# Menu do supervisor\n\n\`\`\`\n${menu}\n\`\`\`\n`);
for (let k = 1; k <= MENU_SUPERVISOR.length; k++) {
  const r = await pergunta(String(k), menu); grava(String(k), MENU_SUPERVISOR[k - 1][0], `"${k}" logo depois do menu`, r); console.log('ok', k);
  if (/ver mais/i.test(r)) { const rm = await pergunta('ver mais', r); grava(k + ' - ver mais', MENU_SUPERVISOR[k - 1][0] + ' (ver mais)', `"${k}" e depois "ver mais"`, rm); }
  // lista numerada (vendedor/campanha): abre o item 1 e, no 15, navega no menu do vendedor (1 e 5)
  if (/[Dd]igite o número (do vendedor|da campanha|\(ex)/.test(r)) {
    const r1 = await pergunta('1', r); grava(k + ' - item 1', MENU_SUPERVISOR[k - 1][0] + ' (item 1 da lista)', `"${k}" e depois "1"`, r1);
    if (k === 15) for (const q of ['1', '5', '16']) { const rv = await pergunta(q, r1); grava(`15 - vendedor 1 - ${q}`, 'Menu do vendedor (item ' + q + ')', `"15", "1" e depois "${q}"`, rv); }
  }
  for (let s = 1; s <= (SUB_SUPERVISOR[k] || []).length; s++) { const rs = await pergunta(String(s), r); grava(`${k}.${s}`, SUB_SUPERVISOR[k][s - 1][0], `"${k}" e depois "${s}"`, rs); }
}
limpa();
