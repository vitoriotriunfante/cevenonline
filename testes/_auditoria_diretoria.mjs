// AUDITORIA DO PAINEL DAS INDUSTRIAS (diretoria; Rudinei, sugestoes de 09/11/2026). Producao SO LEITURA.
// uso: node testes/_auditoria_diretoria.mjs "RUDINEI RIZATTI"
import { fileURLToPath } from 'url'; import { carregaJota } from './_jota_loader.mjs';
const { _teste, limpa } = await carregaJota(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
import { spawnSync } from "child_process"; import fs from "fs"; import path from "path";
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const DB = { prepare(sql) { let a = []; const roda = () => { if (!/^\s*(SELECT|WITH)/i.test(sql)) return []; let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NO_COLOR: '1' } }); try { return JSON.parse(r.stdout)[0].results; } catch { return []; } }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; } }; return o; } };
const nome = process.argv[2] || 'RUDINEI RIZATTI';
const V = { nome, papel: 'diretoria', filial: '' };
const dir = path.join('auditoria', `DIRETORIA ${nome} - painel das industrias`); fs.mkdirSync(dir, { recursive: true });
// mesma ordem do WhatsApp (bot.js): primeiro a industria pelo GEROT, depois o Jota
const { respGerotIndustria } = await import('../functions/_lib/jota/respostas/gerot_industria.js');
let antQ = null;
const fala = async (q, ult) => { const B = _teste.criaBase(ORIGIN, { DB }); B.ultOut = ult; try { const g = await respGerotIndustria({ DB }, q, V, antQ).catch(() => null); antQ = q; if (g) return String(g); return String(await _teste.respostaPronta(B, V, q, [])); } catch (e) { return 'ERRO ' + e.message; } };
const grava = (cod, passos, r) => fs.writeFileSync(path.join(dir, cod + '.md'), `# ${cod}\n\n- Diretoria: ${nome}\n- Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (dados de producao, so leitura)\n- Digitou: ${passos}\n\n## Resposta do Jota\n\n\`\`\`\n${r}\n\`\`\`\n`);
// caminho completo de navegacao + as perguntas reais do Rudinei (05 e 09/11)
const passos = [['1 - Brasil', ['industrias']], ['2 - Brasil - TBL', ['industrias', '4']], ['3 - TBL - Mars', ['industrias', '4', '1']], ['4 - TBL - Mars - supervisor 1', ['industrias', '4', '1', '1']],
  ['5 - TBL - Mars - sup 1 - vendedor 1', ['industrias', '4', '1', '1', '1']], ['6 - voltar (0)', ['industrias', '4', '1', '1', '1', '0']], ['7 - industrias da API', ['industrias da API']],
  ['8 - painel de outubro', ['painel das industrias de outubro']], ['9 - outubro - TPH', ['painel das industrias de outubro', '1']],
  ['10 - real - condor da API', ['como está a venda da industria condor da filial API']], ['11 - real - condor de outubro', ['venda de condor de api do mes de outubro']],
  ['12 - real - condor por supervisor e vendedor', ['venda por supervisor e vendedor de condor de novembro, vendas e positivação, meta de cada vendedor e os com venda zero']],
  ['13 - real - todas as filiais', ['venda por industria de todas as filiais']]];
for (const [cod, qs] of passos) { let ult = '', r = ''; antQ = null; for (const q of qs) { r = await fala(q, ult); ult = r; } grava(cod, qs.map((q) => `"${q}"`).join(' → '), r); console.log('ok', cod); }
limpa();
