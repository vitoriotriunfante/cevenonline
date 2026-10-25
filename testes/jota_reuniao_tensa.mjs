// =========================================================================
// REUNIÃO TENSA DE 5 H com o JOTA (Vitório, 25/10/2026): CEO, diretores, 14 gerentes, supervisores, 20 vendedores e um representante
// de cada indústria perguntando sobre passado, presente, futuro e oportunidades. Roda contra a base REAL (só leitura, nada é enviado).
// Resultado por tema e por papel: acerto (trouxe o que pede) · honesto (disse que não tem o dado) · errada · sem resposta (IA) · erro.
// uso: node testes/jota_reuniao_tensa.mjs [--por=6] [--seed=11]  -> MAIS_MIX/JOTA/reuniao/REUNIAO_TENSA_<dia>.md e .json
// =========================================================================
import fs from 'fs'; import os from 'os'; import path from 'path'; import { pathToFileURL, fileURLToPath } from 'url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const POR = Number(arg('por', 6)); let seed = Number(arg('seed', 11));
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (L) => L[Math.floor(rnd() * L.length)];
const amostra = (L, n) => { const c = [...L]; const o = []; while (c.length && o.length < n) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; };
const tmp = path.join(os.tmpdir(), 'jota_reuniao_' + Date.now() + '.mjs');
fs.writeFileSync(tmp, fs.readFileSync(path.join(raiz, 'functions/api/whatsapp/bot.js'), 'utf8').replace("'../../../public/regras.js'", JSON.stringify(new URL('../public/regras.js', import.meta.url).href)));
const { _teste } = await import(pathToFileURL(tmp).href);
const { TEMAS, INDUSTRIAS_RV } = await import(pathToFileURL(path.join(raiz, 'MAIS_MIX/JOTA/reuniao/banco_reuniao_tensa.mjs')).href);
const { INDUSTRIAS } = await import(pathToFileURL(path.join(raiz, 'MAIS_MIX/JOTA/reuniao/banco_perguntas.mjs')).href);
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const curto = (s) => titulo(String(s).replace(/^CLT\s*-?\s*/i, '').split(' ')[0]);
const FIL = ['TPH', 'ABC', 'API', 'TBL', 'TCV', 'TSJ', 'TCA', 'TBE', 'TPA', 'MCD', 'TCG'];
// ---------- nomes reais ----------
const mostra = await (await fetch(ORIGIN + '/api/tv-mostra')).json();
const mix = await (await fetch('https://raw.githubusercontent.com/vitoriotriunfante/cevenonline/main/public/dados_mix.json')).json();
const VEND = []; const SUPS = new Map();
for (const [k, L] of Object.entries(mostra.filiais || {})) for (const v of L) if (v.mostra !== false && /^(VJ|PET VJ|FARMA|ESP)$/.test(String(v.canal))) { const f = k.split('_')[0]; VEND.push({ filial: f, rca: String(v.rca), nome: v.nome, supervisor: v.supervisor, grupo: v.grupo || '' }); if (v.supervisor && !/^(GERENTE|VAGO|CLT|SEM )/i.test(v.supervisor)) SUPS.set(f + '|' + v.supervisor, { filial: f, nome: v.supervisor }); }
const CLI = [...new Set((mix.vendedores || []).flatMap((v) => (v.pontos || []).map((p) => p[5])).filter(Boolean))];
const PRODUTOS = ['Snickers', 'Oreo', 'Trident', 'Bis', 'Club Social', 'Halls', 'Tortuguita', 'Lacta', 'Ketchup', 'Maionese', 'Trakinas', 'Tixan', 'Ypê', 'Marilan'];
// produtos que EXISTEM em cada filial (palavra de marca dos mais vendidos), lidos do mesmo arquivo que o Jota usa
const GENERICO = /^(BISC|LAVA|ROUP|CHOC|CHOCOLATE|BALA|PIR|PANO|LUVA|DESOD|REPEL|BATATA|SALGAD|BARRA|TABL|BOMBOM|LEITE|COM|SEM|LIQ|ORIGINAL|REFRIG|AGUA|SUCO|CAFE|ACUCAR|ARROZ|FEIJAO|OLEO|SABAO|DETERG|PAPEL|CREME|MOLHO|SALG|WAFER|GOMA|PIRULITO|CHICLE|DROPS|PASTILHA|ACHOC|BEB|BEBIDA|COOKIES|TORRADA|MISTURA|FERM|FARINHA|MARGARINA|BOLO|CEREAL|SALGADINHO|PET|ALIM|RACAO|SACHE|LATA|TUBO|CAIXA|DISPLAY|UNID|PACK)$/;
const PRODF = {}; for (const f of FIL) { try { const vm = JSON.parse(fs.readFileSync(path.join(raiz, `public/vendas_mes/${f}.json`), 'utf8')); const tot = new Map(); for (const l of vm.l) tot.set(l[3], (tot.get(l[3]) || 0) + l[5]);
  const ws = new Set(); for (const [c] of [...tot].sort((a, b) => b[1] - a[1]).slice(0, 80)) { const w = String((vm.produtos[c] || [''])[0]).split(/\s+/).find((x) => x.length > 3 && !GENERICO.test(x) && /^[A-Z]+$/.test(x)); if (w) ws.add(titulo(w)); } PRODF[f] = [...ws].slice(0, 25); } catch (e) { PRODF[f] = PRODUTOS; } }
const contatos = JSON.parse(fs.readFileSync(path.join(raiz, 'MAIS_MIX/JOTA/sabatinas/_contatos.json'), 'utf8'));
// ---------- quem está na sala ----------
const SALA = {
  ceo: [{ nome: 'EDUARDO MUFFATO', papel: 'diretoria', rotulo: 'CEO Eduardo Muffato' }],
  diretor: ['EVANDRO SERVAT', 'PAULO MICHELETO JUNIOR', 'RUDINEI RIZATTI', 'VITORIO'].map((n) => ({ nome: n, papel: 'diretoria', rotulo: 'Diretor ' + titulo(n.split(' ')[0]) })),
  gerente: contatos.filter((c) => c.papel === 'gerente').map((c) => ({ ...c, rotulo: `Gerente ${c.filial}${c.grupo ? '/' + titulo(c.grupo) : ''}` })),
  supervisor: [...SUPS.values()].map((s) => ({ nome: s.nome, papel: 'supervisor', filial: s.filial, supervisor: s.nome, rotulo: `Supervisor ${s.filial} ${curto(s.nome)}` })),
  vendedor: [VEND.find((v) => v.filial === 'TBL' && v.rca === '181'), ...amostra(VEND.filter((v) => !(v.filial === 'TBL' && v.rca === '181')), 19)].filter(Boolean)
    .map((v) => ({ nome: v.nome, papel: 'vendedor', filial: v.filial, rca: v.rca, rotulo: `Vendedor ${v.filial} ${curto(v.nome)} (${v.rca})` })),
  industria: INDUSTRIAS_RV.map((i) => ({ nome: 'VITORIO', papel: 'diretoria', rotulo: `Representante ${i} (via diretor)`, industria_rv: i })),
};
console.log('na sala:', Object.entries(SALA).map(([k, v]) => `${k} ${v.length}`).join(' · '));
function preenche(modelo, espera, p) {
  const filial = p.filial || pick(FIL);
  const vs = VEND.filter((v) => v.filial === filial && (!p.grupo || String(v.grupo).toUpperCase() === String(p.grupo).toUpperCase()) && (p.papel !== 'supervisor' || v.supervisor === p.supervisor)); const v = p.papel === 'vendedor' ? VEND.find((x) => x.filial === p.filial && x.rca === p.rca) : pick(vs.length ? vs : VEND);
  const ss = [...SUPS.values()].filter((s) => s.filial === filial); const s = p.papel === 'supervisor' ? { nome: p.supervisor } : pick(ss.length ? ss : [...SUPS.values()]);
  const m = { filial, vendedor: titulo(v.nome.split(' ').slice(0, 2).join(' ')), rca: v.rca, supervisor: titulo(s.nome.split(' ').slice(0, 2).join(' ')), produto: pick(PRODF[filial] && PRODF[filial].length ? PRODF[filial] : PRODUTOS), industria: pick(INDUSTRIAS), industria_rv: p.industria_rv || pick(INDUSTRIAS_RV), cliente: titulo(pick(CLI)) };
  const txt = modelo.replace(/\{(\w+)\}/g, (_, k) => m[k] ?? '');
  const extra = { vendedor_curto: curto(v.nome), industria: m.industria };
  const re = new RegExp(espera.source.replace(/\{(\w+)\}/g, (_, k) => String(extra[k] ?? m[k] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), espera.flags);
  return { txt, re };
}
// ---------- monta a pauta ----------
const casos = [];
for (const T of TEMAS) for (const papel of T.papeis) for (const p of amostra(SALA[papel] || [], POR)) for (const mod of T.modelos) { const { txt, re } = preenche(mod, T.espera, p); casos.push({ tema: T.tema, papel, quem: p.rotulo, perfil: p, pergunta: txt, re, honesto: !!T.honesto }); }
console.log('perguntas na pauta:', casos.length);
// ---------- reunião ----------
const HON = /não tenho|sem dado|ainda não|não está na base|não consigo|não projeto|não faço projeção/i;
const B = _teste.criaBase(ORIGIN, {});
const t0 = Date.now(); let k = 0; const out = [];
for (const c of casos) {
  let r = null, erro = null;
  try { r = await _teste.respostaPronta(B, c.perfil, c.pergunta, []); } catch (e) { erro = String(e.message || e); }
  const quebrado = r && /undefined|NaN|\[object/.test(r);
  const st = erro ? 'erro' : r == null ? 'sem_resposta' : quebrado ? 'texto_quebrado' : c.re.test(r) ? (c.honesto ? 'honesto' : 'acerto') : HON.test(r) ? 'honesto' : 'errada';
  out.push({ tema: c.tema, papel: c.papel, quem: c.quem, pergunta: c.pergunta, status: st, resposta: String(erro || r || '').slice(0, 1500) });
  if (++k % 200 === 0) console.log(`  ${k}/${casos.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
fs.unlinkSync(tmp);
// ---------- ata ----------
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const dir = path.join(raiz, 'MAIS_MIX/JOTA/reuniao');
fs.writeFileSync(path.join(dir, `reuniao_tensa_${dia}.json`), JSON.stringify(out, null, 1));
const pc = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '-');
const agrupa = (f) => { const m = new Map(); for (const x of out) { const kk = f(x); const y = m.get(kk) || { n: 0, acerto: 0, honesto: 0, errada: 0, sem_resposta: 0, erro: 0, texto_quebrado: 0, ex: [] }; y.n++; y[x.status]++; if (!['acerto', 'honesto'].includes(x.status) && y.ex.length < 2) y.ex.push(x); m.set(kk, y); } return m; };
const tot = agrupa(() => 'tudo').get('tudo');
const linha = (nome, y) => `| ${nome} | ${y.n} | ${pc(y.acerto, y.n)} | ${pc(y.honesto, y.n)} | ${pc(y.errada, y.n)} | ${pc(y.sem_resposta, y.n)} | ${y.erro + y.texto_quebrado} |`;
const md = [`# Reunião tensa de 5 h com o JOTA — ${dia}`, '',
  `**${tot.n} perguntas** de ${Object.values(SALA).reduce((a, v) => a + v.length, 0)} participantes · acerto **${pc(tot.acerto, tot.n)}** · disse que não tem o dado ${pc(tot.honesto, tot.n)} · **resposta errada ${pc(tot.errada, tot.n)}** · sem resposta pronta ${pc(tot.sem_resposta, tot.n)} · erro ${tot.erro + tot.texto_quebrado}`, '',
  '## Por papel', '| Quem | Perguntas | Acerto | Sem o dado (honesto) | Errada | Sem resposta | Erro |', '|---|---|---|---|---|---|---|',
  ...[...agrupa((x) => x.papel)].map(([kk, y]) => linha(kk, y)), '',
  '## Por tema', '| Tema | Perguntas | Acerto | Sem o dado (honesto) | Errada | Sem resposta | Erro |', '|---|---|---|---|---|---|---|',
  ...[...agrupa((x) => x.tema)].map(([kk, y]) => linha(kk, y)), '',
  '## Falhas (exemplos por tema)', ...[...agrupa((x) => x.tema)].flatMap(([kk, y]) => y.ex.map((x) => `- **${kk}** · ${x.quem}: "${x.pergunta}" → *${x.status}*: ${x.resposta.split('\n')[0].slice(0, 160)}`))].join('\n');
fs.writeFileSync(path.join(dir, `REUNIAO_TENSA_${dia}.md`), md + '\n');
console.log(`\nACERTO ${pc(tot.acerto, tot.n)} | honesto ${pc(tot.honesto, tot.n)} | ERRADA ${pc(tot.errada, tot.n)} | sem resposta ${pc(tot.sem_resposta, tot.n)} | erro ${tot.erro + tot.texto_quebrado} | ${Math.round((Date.now() - t0) / 1000)} s`);
