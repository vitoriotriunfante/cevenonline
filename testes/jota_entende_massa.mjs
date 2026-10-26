// =========================================================================
// MEDIÇÃO EM MASSA: "ENTENDER COM IA" x "SÓ PALAVRAS-CHAVE" (Vitório, 25/10/2026: "não simulamos mais de 1000 perguntas?... roda").
// Pega as 1.448 perguntas da reunião tensa e reescreve CADA uma de 3 jeitos fora do padrão, POR REGRA (não pela IA, para o teste não
// ficar a favor dela): (1) sinônimos que o time usa, (2) abreviação/sem acento/WhatsApp, (3) frase coloquial com ordem trocada.
// Para cada reescrita: ANTES = só palavras-chave; DEPOIS = palavras-chave e, se não acharem ou se a resposta for "quebra-galho",
// a IA traduz e o código responde. Acerto = a resposta traz o que a pergunta pede (mesma regra da reunião).
// Precisa do site local com IA:  npx wrangler pages dev public --binding JOTA_TESTE=1 --port 8799
// uso: node testes/jota_entende_massa.mjs   -> MAIS_MIX/JOTA/reuniao/ENTENDE_IA_MASSA_<dia>.md
// =========================================================================
import fs from 'fs'; import path from 'path';
import { carregaJota } from './_jota_loader.mjs';
const { casos, raiz } = await import('./_casos_reuniao.mjs');
const URL_DEV = 'http://127.0.0.1:8799', ORIGIN = 'https://ceven-cftv-matrix.pages.dev';
const HON = /não tenho|sem dado|ainda não|não está na base|não consigo|não projeto|não faço projeção|Não achei/i;
// ---------- reescritas por regra ----------
const troca = (s, pares) => pares.reduce((x, [a, b]) => x.replace(a, b), s);
const SIN = [[/\bcomo está\b/gi, 'como anda'], [/\bcomo estamos\b/gi, 'como a gente tá'], [/\bquanto falta pra bater a meta\b/gi, 'quanto ainda precisa vender pra chegar no objetivo'], [/\bquanto falta\b/gi, 'quanto ainda precisa'],
  [/\bmeta\b/gi, 'objetivo'], [/\bmetas\b/gi, 'objetivos'], [/\bzerados\b/gi, 'quem não vendeu nada'], [/\bzerado\b/gi, 'sem venda nenhuma'], [/\bliga\b/gi, 'campeonato'], [/\bChampions\b/g, 'campeonato'],
  [/\bdevoluções\b/gi, 'mercadoria devolvida'], [/\bincentivo\b/gi, 'bônus'], [/\b\+mix\b/gi, 'mais mix'], [/\bpositivação\b/gi, 'clientes positivados'], [/\bvisitas\b/gi, 'visitação'],
  [/\bmês passado\b/gi, 'mês anterior'], [/\bvendas semanais\b/gi, 'vendas semana a semana'], [/\bvendas mensais\b/gi, 'vendas mês a mês'], [/\bquem mais vende\b/gi, 'quem vende mais'], [/\bclientes\b/gi, 'clientes'],
  [/\bpênaltis\b/gi, 'penalidades'], [/\bcortes\b/gi, 'produtos cortados'], [/\bcarteira\b/gi, 'pendente'], [/\bmarca própria\b/gi, 'nossas marcas'], [/\bsupervisores\b/gi, 'sups'], [/\bo que oferecer pro\b/gi, 'que produtos levar pro'],
  [/\bmotivos de não venda\b/gi, 'desculpas dos vendedores'], [/\bqual dia da semana mais vende\b/gi, 'em que dia mais sai'], [/\btem algum vendedor específico que vende mais\b/gi, 'quem é o vendedor que mais puxa']];
const ABR = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\bvoce\b/g, 'vc').replace(/\bquanto\b/g, 'qto').replace(/\b(para|pra)\b/g, 'p').replace(/\bhoje\b/g, 'hj').replace(/\bnao\b/g, 'n')
  .replace(/\besta\b/g, 'ta').replace(/\bque\b/g, 'q').replace(/\bporque|por que\b/g, 'pq').replace(/\bsupervisor\b/g, 'sup').replace(/\bvendedor\b/g, 'vend').replace(/[?!.]/g, '').trim();
const COL = (s) => { const f = (s.match(/\b(na|em|da|de|do) (TPH|ABC|API|TBL|TCV|TSJ|TCA|TBE|TPA|MCD|TCG)\b/) || []); let r = f[0] ? s.replace(f[0], '').replace(/\s+/g, ' ').trim() : s;
  r = r.replace(/\?$/, ''); const ab = ['me diz uma coisa, ', 'rapidinho: ', 'preciso saber ', 'consegue me falar ', 'e aí jota, '][r.length % 5]; return (f[2] ? `${f[2]}: ` : '') + ab + r.charAt(0).toLowerCase() + r.slice(1) + '?'; };
const variantes = [];
for (const c of casos) {
  const s = troca(c.pergunta, SIN);
  for (const [estilo, q] of [['sinônimos', s], ['abreviado', ABR(c.pergunta)], ['coloquial', COL(s)]]) if (q && q !== c.pergunta) variantes.push({ ...c, estilo, original: c.pergunta, pergunta: q });
}
console.log('reescritas:', variantes.length);
// ---------- antes: só palavras-chave ----------
const J = await carregaJota(raiz); const { _teste } = J;
const resp = async (perfil, q) => { try { return await _teste.respostaPronta(_teste.criaBase(ORIGIN, {}), perfil, q, []); } catch (e) { return 'ERRO ' + e.message; } };
const t0 = Date.now();
for (const [i, v] of variantes.entries()) { v.antes = await resp(v.perfil, v.pergunta); if ((i + 1) % 500 === 0) console.log(`  palavras-chave ${i + 1}/${variantes.length} (${Math.round((Date.now() - t0) / 1000)} s)`); }
// ---------- depois: IA nas que não acharam ou deram quebra-galho ----------
const precisa = variantes.filter((v) => v.antes == null || v.antes.fraca);
console.log('vão para a IA:', precisa.length);
for (let i = 0; i < precisa.length; i += 64) {
  const lote = precisa.slice(i, i + 64);
  const fichas = await fetch(URL_DEV + '/api/jota-entende-teste', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lote.map((v) => ({ perfil: v.perfil, texto: v.pergunta }))) }).then((r) => r.json()).catch(() => []);
  for (const [k, v] of lote.entries()) { const f = fichas[k]; if (f) { const r2 = await resp(v.perfil, f.pergunta); if (_teste.aceitaTraducao(v.antes, r2, f.pergunta, f.ficha)) { v.depois = r2; v.via = f.pergunta; } } }
  console.log(`  IA ${Math.min(i + 64, precisa.length)}/${precisa.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
J.limpa();
// ---------- resultado ----------
const st = (r, v) => (r == null ? 'nada' : v.re.test(String(r)) ? 'ok' : HON.test(String(r)) ? 'honesto' : 'errada');
const R = { antes: {}, depois: {} }, porEstilo = {}, porTema = {};
for (const v of variantes) {
  const a = st(v.antes, v), d = st(v.depois !== undefined ? v.depois : v.antes, v); v.sa = a; v.sd = d;
  R.antes[a] = (R.antes[a] || 0) + 1; R.depois[d] = (R.depois[d] || 0) + 1;
  for (const [M, k] of [[porEstilo, v.estilo], [porTema, v.tema]]) { const x = M[k] || (M[k] = { n: 0, a: 0, d: 0, ex: [] }); x.n++; if (a === 'ok' || a === 'honesto') x.a++; if (d === 'ok' || d === 'honesto') x.d++; else if (x.ex.length < 2) x.ex.push(v); }
}
const N = variantes.length, pc = (x) => ((x || 0) / N * 100).toFixed(1).replace('.', ',') + '%', pc2 = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '-');
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const md = [`# JOTA entendendo com IA — medição em massa (${dia})`, '', `**${N} perguntas** = as ${casos.length} da reunião tensa reescritas por regra (sinônimos, abreviado, coloquial). Foram para a IA: ${precisa.length}.`, '',
  '| | Acerto | Disse que não tem (honesto) | Errada | Sem resposta |', '|---|---|---|---|---|',
  `| Só palavras-chave | ${pc(R.antes.ok)} | ${pc(R.antes.honesto)} | ${pc(R.antes.errada)} | ${pc(R.antes.nada)} |`,
  `| Com a IA entendendo | ${pc(R.depois.ok)} | ${pc(R.depois.honesto)} | ${pc(R.depois.errada)} | ${pc(R.depois.nada)} |`, '',
  '## Por jeito de escrever (acerto + honesto)', '| Estilo | Perguntas | Antes | Depois |', '|---|---|---|---|', ...Object.entries(porEstilo).map(([k, x]) => `| ${k} | ${x.n} | ${pc2(x.a, x.n)} | ${pc2(x.d, x.n)} |`), '',
  '## Por tema (acerto + honesto)', '| Tema | Perguntas | Antes | Depois |', '|---|---|---|---|', ...Object.entries(porTema).map(([k, x]) => `| ${k} | ${x.n} | ${pc2(x.a, x.n)} | ${pc2(x.d, x.n)} |`), '',
  '## O que ainda falha (exemplos)', ...Object.entries(porTema).flatMap(([k, x]) => x.ex.map((v) => `- **${k}** · "${v.pergunta}" (original: "${v.original}") → ${v.sd}${v.via ? ` · IA entendeu: "${v.via}"` : ''}: ${String(v.depois !== undefined ? v.depois : v.antes).split('\n')[0].slice(0, 120)}`))].join('\n');
fs.writeFileSync(path.join(raiz, `MAIS_MIX/JOTA/reuniao/ENTENDE_IA_MASSA_${dia}.md`), md + '\n');
console.log(`\n${N} perguntas · ANTES acerto ${pc(R.antes.ok)} honesto ${pc(R.antes.honesto)} errada ${pc(R.antes.errada)} sem ${pc(R.antes.nada)} · DEPOIS acerto ${pc(R.depois.ok)} honesto ${pc(R.depois.honesto)} errada ${pc(R.depois.errada)} sem ${pc(R.depois.nada)}`);
