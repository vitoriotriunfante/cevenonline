// =========================================================================
// MEDIDOR DO JOTA — roda o banco de perguntas da reunião (MAIS_MIX/JOTA/reuniao/banco_perguntas.mjs) contra a base REAL (só leitura, nada é enviado).
// Gera >10 mil perguntas: cada modelo × nomes reais (filial, vendedor, supervisor, produto, indústria, cliente, período) × jeitos de escrever.
// Acerto = o JOTA deu resposta pronta E a resposta contém o que a necessidade pede (regex "espera").
// uso: node testes/jota_banco.mjs [--max=12000] [--seed=7]   -> MAIS_MIX/JOTA/reuniao/COBERTURA.md e cobertura.json
// =========================================================================
import fs from 'fs'; import os from 'os'; import path from 'path'; import { pathToFileURL, fileURLToPath } from 'url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const MAX = Number(arg('max', 12000)); let seed = Number(arg('seed', 7));
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (L) => L[Math.floor(rnd() * L.length)];
const tmp = path.join(os.tmpdir(), 'jota_banco_' + Date.now() + '.mjs');
fs.writeFileSync(tmp, fs.readFileSync(path.join(raiz, 'functions/api/whatsapp/bot.js'), 'utf8').replace("'../../../public/regras.js'", JSON.stringify(new URL('../public/regras.js', import.meta.url).href)));
const { _teste } = await import(pathToFileURL(tmp).href);
const { BANCO, PERIODOS, INDUSTRIAS, ESTILOS } = await import(pathToFileURL(path.join(raiz, 'MAIS_MIX/JOTA/reuniao/banco_perguntas.mjs')).href);
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
// nomes reais
const mostra = await (await fetch(ORIGIN + '/api/tv-mostra')).json();
const mix = await (await fetch('https://raw.githubusercontent.com/vitoriotriunfante/cevenonline/main/public/dados_mix.json')).json();
const VEND = [], SUPS = new Map();
for (const [k, L] of Object.entries(mostra.filiais || {})) for (const v of L) if (v.mostra !== false && /^(VJ|PET VJ|FARMA|ESP)$/.test(String(v.canal))) { VEND.push({ filial: k.split('_')[0], rca: String(v.rca), nome: v.nome }); if (v.supervisor) SUPS.set(k.split('_')[0] + '|' + v.supervisor, { filial: k.split('_')[0], nome: v.supervisor }); }
const PROD = [...new Set((mix.vendedores || []).flatMap((v) => (v.top_skus || []).map((s) => s.n)))];
const CLI = [...new Set((mix.vendedores || []).flatMap((v) => (v.pontos || []).map((p) => p[5])).filter(Boolean))];
const SUPL = [...SUPS.values()].filter((s) => !/^(GERENTE|VAGO|CLT)/i.test(s.nome));
const FIL = ['TPH', 'ABC', 'API', 'TBL', 'TCV', 'TSJ', 'TCA', 'TBE', 'TPA', 'MCD', 'TCG'];
// quem pergunta (perfis reais cadastrados)
const PERFIS = {
  diretoria: { nome: 'PAULO MICHELETO JUNIOR', papel: 'diretoria' },
  gerente: { nome: 'MARCELO', papel: 'gerente', filial: 'API' },
  supervisor: { nome: 'WASHINGTON FLORES DA ROSA', papel: 'supervisor', filial: 'API', supervisor: 'WASHINGTON FLORES DA ROSA' },
  vendedor: { nome: 'PAULO MICHELETO JUNIOR', papel: 'diretoria' },    // vendedor ainda nao e perfil do Jota (2o passo): medido como diretoria
  promotor: { nome: 'PAULO MICHELETO JUNIOR', papel: 'diretoria' },
  industria: { nome: 'PAULO MICHELETO JUNIOR', papel: 'diretoria' },
};
const curto = (s) => titulo(String(s).replace(/^CLT\s*-?\s*/i, '').split(' ')[0]);
function preenche(modelo, espera, cargo) {
  const perfil = PERFIS[cargo] || PERFIS.diretoria;
  const filial = perfil.filial || pick(FIL);
  const vs = VEND.filter((v) => v.filial === filial), v = pick(vs.length ? vs : VEND);
  const ss = SUPL.filter((s) => s.filial === filial), s = pick(ss.length ? ss : SUPL);
  const sNome = cargo === 'supervisor' ? perfil.supervisor : s.nome;
  const prod = pick(PROD), ind = pick(INDUSTRIAS), cli = pick(CLI), per = pick(PERIODOS);
  const m = { filial, vendedor: titulo(v.nome.split(' ').slice(0, 2).join(' ')), rca: v.rca, supervisor: titulo(sNome.split(' ').slice(0, 2).join(' ')), produto: titulo(prod), industria: ind, cliente: titulo(cli), periodo: per };
  const txt = modelo.replace(/\{(\w+)\}/g, (_, k) => m[k] ?? '');
  const extra = { industria: ind, produto_curto: curto(prod), supervisor_curto: curto(sNome), vendedor_curto: curto(v.nome) };
  const re = new RegExp(espera.source.replace(/\{(\w+)\}/g, (_, k) => String(extra[k] ?? m[k] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), espera.flags);
  return { txt, re, perfil };
}
// monta os casos
console.log('nomes:', VEND.length, 'vend', SUPL.length, 'sup', PROD.length, 'prod', CLI.length, 'cli');
const casos = [];
const porModelo = Math.max(1, Math.ceil(MAX / BANCO.reduce((t, b) => t + b.modelos.length * ESTILOS.length, 0)));
for (const b of BANCO) for (const mod of b.modelos) for (const est of ESTILOS) for (let i = 0; i < porModelo; i++) {
  const { txt, re, perfil } = preenche(mod, b.espera, b.cargo);
  casos.push({ n: b.n, intencao: b.intencao, cargo: b.cargo, pergunta: est(txt), re, perfil });
}
casos.length = Math.min(casos.length, MAX);
console.log(`casos: ${casos.length} (${BANCO.length} necessidades, ${BANCO.reduce((t, b) => t + b.modelos.length, 0)} modelos, ${ESTILOS.length} estilos)`);
// roda (base compartilhada: as fontes sao lidas uma vez so)
const B = _teste.criaBase(ORIGIN, {});
const R = new Map(); const t0 = Date.now(); let k = 0;
for (const c of casos) {
  let r = null, erro = null;
  try { r = await _teste.respostaPronta(B, c.perfil, c.pergunta, []); } catch (e) { erro = String(e.message || e); }
  const st = erro ? 'erro' : r == null ? 'sem_resposta' : c.re.test(r) ? 'acerto' : 'errada';
  const x = R.get(c.n) || { n: c.n, intencao: c.intencao, cargo: c.cargo, total: 0, acerto: 0, errada: 0, sem_resposta: 0, erro: 0, exemplos: [] };
  x.total++; x[st]++; if (st !== 'acerto' && x.exemplos.length < 3) x.exemplos.push({ st, pergunta: c.pergunta, resposta: String(erro || r || '').split('\n')[0].slice(0, 120) });
  R.set(c.n, x);
  if (++k % 100 === 0) console.log(k, c.n, c.intencao, Math.round(process.memoryUsage().heapUsed/1e6) + 'MB');
  if (k % 1000 === 0) console.log(`  ${k} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
fs.unlinkSync(tmp);
const L = [...R.values()].sort((a, b) => a.n - b.n);
const tot = L.reduce((t, x) => ({ total: t.total + x.total, acerto: t.acerto + x.acerto, errada: t.errada + x.errada, sem: t.sem + x.sem_resposta, erro: t.erro + x.erro }), { total: 0, acerto: 0, errada: 0, sem: 0, erro: 0 });
const pc = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '-');
const dir = path.join(raiz, 'MAIS_MIX/JOTA/reuniao');
fs.writeFileSync(path.join(dir, 'cobertura.json'), JSON.stringify({ quando: new Date().toISOString(), ...tot, necessidades: L }, null, 1));
const md = [`# Cobertura do JOTA no banco da reunião — ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, '',
  `**${tot.total.toLocaleString('pt-BR')} perguntas** · acerto **${pc(tot.acerto, tot.total)}** · resposta errada ${pc(tot.errada, tot.total)} · sem resposta pronta (cai na IA) ${pc(tot.sem, tot.total)} · erro ${tot.erro}`, '',
  '| # | Necessidade | Cargo | Perguntas | Acerto | Errada | Sem resposta | Exemplo de falha |', '|---|---|---|---|---|---|---|---|',
  ...L.map((x) => `| ${x.n} | ${x.intencao} | ${x.cargo} | ${x.total} | ${pc(x.acerto, x.total)} | ${pc(x.errada, x.total)} | ${pc(x.sem_resposta, x.total)} | ${x.exemplos[0] ? '`' + x.exemplos[0].pergunta.replace(/\|/g, '/') + '` → ' + x.exemplos[0].st + (x.exemplos[0].resposta ? ': ' + x.exemplos[0].resposta.replace(/\|/g, '/') : '') : ''} |`)].join('\n');
fs.writeFileSync(path.join(dir, 'COBERTURA.md'), md + '\n');
console.log(`\nACERTO ${pc(tot.acerto, tot.total)} | errada ${pc(tot.errada, tot.total)} | sem resposta ${pc(tot.sem, tot.total)} | erro ${tot.erro} | ${Math.round((Date.now() - t0) / 1000)} s`);
