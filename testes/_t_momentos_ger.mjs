// INDICE LIMITADO DO VENDEDOR (09/11/2026): conversa em sequencia, producao SO LEITURA.
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from "child_process"; import fs from "fs"; import path from "path";
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
// 3 MOMENTOS DO GERENTE + cascata (gerente -> supervisor -> vendedor). Producao, so leitura.
const MO = await import('../functions/_lib/jota/respostas/momentos.js'), { carregaEscopo } = await import('../functions/_lib/jota/escopo.js');
const [fil, nome, grupo] = process.argv.slice(2).length ? process.argv.slice(2) : ['ABC', 'MARCOS', ''];
const c = { nome, papel: 'gerente', filial: fil, grupo: grupo || null };
const dir = `auditoria/GERENTE ${nome} - ${fil}${grupo ? ' ' + grupo : ''}`; fs.mkdirSync(dir, { recursive: true });
const grava = (cod, passos, txt) => fs.writeFileSync(`${dir}/${cod}.md`, `# ${cod}\n\n- Gerente: ${nome} (${fil}${grupo ? ' · ' + grupo : ''})\n- Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (producao, so leitura)\n- Digitou: ${passos}\n\n## Resposta do Jota\n\n\`\`\`\n${txt}\n\`\`\`\n`);
for (const mo of ['abertura', 'meio', 'fechamento']) {
  const B = _teste.criaBase(ORIGIN, { DB });
  const Ev = await carregaEscopo(B, { nome: fil, filiais: [fil], grupo: grupo || null, supervisor: null, nacional: false });
  let txt; try { const m = await MO.respMomentoGerente(B, c, Ev, mo); txt = m ? m.texto : 'SEM RESPOSTA'; } catch (e) { txt = 'ERRO ' + e.stack; }
  grava('M - ' + mo, '"bom dia" (momento forcado)', txt); console.log(`===== ${mo}\n${txt}`);
  if (mo === 'meio') {   // cascata: 1 -> supervisor 1; depois 1 -> vendedor 1 da lista dele
    const fala = async (q, ult) => { const B2 = _teste.criaBase(ORIGIN, { DB }); B2.ultOut = ult; try { return String(await _teste.respostaPronta(B2, c, q, [])); } catch (e) { return 'ERRO ' + e.stack; } };
    const r1 = await fala('1', txt); grava('M - meio - supervisor 1', '"bom dia" e depois "1"', r1); console.log('===== meio -> 1 (supervisor)\n' + r1.slice(0, 700));
    const r2 = await fala('1', r1); grava('M - meio - supervisor 1 - vendedor 1', '"bom dia", "1" e depois "1"', r2); console.log('===== -> 1 (vendedor)\n' + r2.slice(0, 400));
    const r3 = await fala('5', r2); grava('M - meio - supervisor 1 - vendedor 1 - item 5', '"bom dia", "1", "1" e depois "5"', r3); console.log('===== -> 5 (curva do vendedor)\n' + r3.slice(0, 400));
  }
}
limpa();
