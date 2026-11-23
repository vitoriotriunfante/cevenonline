// AS 15 OPCOES DO MENU DO SUPERVISOR (Vitorio, 16/11/2026: "as 16 perguntas do vendedor... ja sao respondidas?"): producao SO LEITURA + regua de qualidade.
// Uso: node testes/_t_menu16.mjs [FILIAL RCA "NOME"]   (padrao: TCV 352 TAMARA GUEDES)
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
import { spawnSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const { avaliar } = await import('./jota_regua.mjs');
const { MENU_SUPERVISOR: MENU_VENDEDOR } = await import('../functions/_lib/jota/respostas/liga_mix.js');
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const memo = new Map();
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); if (memo.has(q)) return memo.get(q); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); let out = []; try { out = JSON.parse(r.stdout)[0].results; } catch { out = []; } memo.set(q, out); return out; }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const [fil = 'API', nome = 'WASHINGTON FLORES DA ROSA', cel = '554187014801'] = process.argv.slice(2); const rca = 'sup';
const c = { nome, papel: 'supervisor', filial: fil, supervisor: nome, celular: cel };
const out = [`# As 15 opções do menu do supervisor — ${rca} - ${nome} (${fil})`, '', `Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · produção, só leitura · régua de qualidade aplicada`, ''];
let ok = 0;
for (let k = 1; k <= MENU_VENDEDOR.length; k++) {
  const B = _teste.criaBase('https://ceven-cftv-matrix.pages.dev', { DB }); B.ultOut = '';
  let r = ''; const t0 = Date.now();
  try { r = String(await _teste.respostaPronta(B, c, String(k), []) || ''); } catch (e) { r = 'ERRO ' + (e && e.message); }
  const v = avaliar(MENU_VENDEDOR[k - 1][0], r, { papel: 'supervisor' }) || [];
  const bloq = v.filter((x) => x.severidade === 'bloqueia' || x.bloqueia);
  if (!bloq.length && r && !/^ERRO/.test(r)) ok++;
  console.log(`${k}. ${MENU_VENDEDOR[k - 1][0]} · ${Math.round((Date.now() - t0) / 1000)}s · ${bloq.length ? 'REPROVA: ' + bloq.map((x) => x.id || x.regra).join(',') : 'ok'}`);
  out.push(`## ${k}. ${MENU_VENDEDOR[k - 1][0]}`, '', bloq.length ? `❌ ${bloq.map((x) => `${x.id} ${x.nome}: ${x.detalhe || ''}`).join(' · ')}` : (v.length ? `⚠️ ${v.map((x) => x.id || x.regra).join(',')}` : '✅'), '', '```', r.slice(0, 2500), '```', '');
}
out.splice(3, 0, `**Resultado: ${ok} de ${MENU_VENDEDOR.length} sem violação bloqueante.**`, '');
fs.writeFileSync(`docs/MENU15_SUPERVISOR_${fil}_${rca}.md`, out.join('\n'));
console.log(`\n${ok} de ${MENU_VENDEDOR.length} ok · docs/MENU15_SUPERVISOR_${fil}_${rca}.md`);
limpa();
