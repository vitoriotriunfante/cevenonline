// =========================================================================
// PROVA DE IGUALDADE DO JOTA (Vitório, 25/10/2026: dividir o arquivo sem mudar nenhuma resposta).
// Roda a versão ANTIGA (bot.js de um commit, padrão HEAD) e a NOVA (a pasta atual) no MESMO processo, com:
//   relógio congelado, sorteio fixo e cada resposta das fontes (site, GitHub, Premiação) gravada na 1ª vez e reaproveitada.
// Assim as duas veem exatamente os mesmos dados. Exige respostas IDÊNTICAS, letra por letra. Sai com erro se alguma mudar.
// uso: node testes/jota_igualdade.mjs [--ref=HEAD] [--max=2000]
// =========================================================================
import { execSync } from 'child_process';
import { carregaJota } from './_jota_loader.mjs';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const REF = arg('ref', 'HEAD'), MAX = Number(arg('max', 4000));
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev';

// ---------- mundo congelado ----------
const AGORA = Date.now(); const DataReal = Date;
class DataFixa extends DataReal { constructor(...a) { super(...(a.length ? a : [AGORA])); } static now() { return AGORA; } }
globalThis.Date = DataFixa;
let semente = 1; Math.random = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const fetchReal = globalThis.fetch; const memo = new Map();
globalThis.fetch = async (u, o = {}) => {
  const url = typeof u === 'string' ? u : (u.url || String(u)); const k = (o.method || 'GET') + ' ' + url + ' ' + (o.body || '');
  if (!memo.has(k)) memo.set(k, (async () => { try { const r = await fetchReal(u, { ...o, signal: AbortSignal.timeout(90000) }); return { status: r.status, headers: [...r.headers], body: await r.text() }; } catch (e) { return { erro: String(e.message || e) }; } })());
  const x = await memo.get(k); if (x.erro) throw new Error(x.erro);
  return new Response(x.body, { status: x.status, headers: x.headers });
};

const { casos, raiz } = await import('./_casos_reuniao.mjs');
const EXTRA = [['diretoria', 'como estamos?'], ['diretoria', 'como está a meta da Mondelez no Brasil?'], ['diretoria', 'vendas mensais de Lacta em TBE'], ['diretoria', 'quais os motivos de não venda no mês em TBL?'], ['diretoria', 'o que oferecer pro cliente Mercolombo em TBL?'], ['diretoria', 'qual a projeção de fechamento?'], ['diretoria', 'estamos batendo as metas das indústrias da Giovana 181?'], ['diretoria', 'oi'], ['diretoria', 'ajuda']]
  .map(([p, q]) => ({ perfil: { nome: 'VITORIO', papel: p }, pergunta: q, quem: 'extra' }));
const lista = [...casos, ...EXTRA].slice(0, MAX);

const antigoTxt = execSync(`git show ${REF}:functions/api/whatsapp/bot.js`, { cwd: raiz, encoding: 'utf8', maxBuffer: 50e6 });
const ANT = await carregaJota(raiz, antigoTxt), NOV = await carregaJota(raiz);
const roda = async (J, c) => { semente = 1; const B = J._teste.criaBase(ORIGIN, {}); try { return await J._teste.respostaPronta(B, c.perfil, c.pergunta, []); } catch (e) { return 'ERRO: ' + e.message; } };
let iguais = 0; const difs = []; const t0 = DataReal.now();
for (const [i, c] of lista.entries()) {
  const a = await roda(ANT, c), b = await roda(NOV, c);
  if (a === b) iguais++; else difs.push({ c, a, b });
  if ((i + 1) % 300 === 0) console.log(`  ${i + 1}/${lista.length} (${Math.round((DataReal.now() - t0) / 1000)} s) · diferentes ${difs.length}`);
}
ANT.limpa(); NOV.limpa();
console.log(`\nIGUALDADE: ${iguais} de ${lista.length} respostas idênticas · diferentes: ${difs.length}`);
for (const d of difs.slice(0, 8)) {
  const la = String(d.a).split('\n'), lb = String(d.b).split('\n'); const i = la.findIndex((x, k) => x !== lb[k]);
  console.log(`\n--- ${d.c.quem}: "${d.c.pergunta}" (linha ${i + 1})\n antiga: ${String(la[i]).slice(0, 200)}\n nova:   ${String(lb[i]).slice(0, 200)}`);
}
process.exit(difs.length ? 1 : 0);
