// =========================================================================
// JOTA · functions/_lib/jota/respostas/vendas.js
// O QUE É: vendas item a item: produto, indústria, cliente, preço, top produtos, marca própria, recuperação.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { FILIAIS, N, P, R$, SUGESTAO, hojeSP, nome2, sem, titulo, vn } from '../base.js';
import { fraca } from '../base.js';
import { extrasTempo } from './metas_industria.js';

// ---------- VENDAS ITEM A ITEM (public/vendas_mes/<FIL>.json, gerado toda noite pelo +MIX com o banco do Data Lake) ----------
// Reuniao de 5 h (25/10/2026): produto x cliente x vendedor x dia, industria, preco medio, top produtos, marca propria. Dado ate ONTEM (nunca hoje).
export const SEM_VENDAS = '📦 _As vendas item a item chegam pelo Data Lake da madrugada (arquivo public/vendas_mes). Ainda não há arquivo para esta filial; tente depois das 06h._';
export const PARADAS = new Set(['NESTE', 'DESTE', 'NESSE', 'DESSE', 'NAQUELE', 'DAQUELE', 'SEM', 'NAO', 'DESSES', 'DESTES', 'DELES', 'ALGUM', 'ALGUNS', 'ROTA', 'TEM', 'ESTAO', 'QUAIS', 'VENDEDORES', 'COMPRARAM', 'COMPRAVA', 'COMPRAVAM', 'PAROU', 'PARARAM', 'DEIXOU', 'DEIXARAM', 'COMPRAR', 'RECUPERACAO', 'LISTA', 'COMO', 'ESTA', 'TA', 'ESTAO', 'VAI', 'ANDA', 'NOSSA', 'NOSSO', 'MINHA', 'TEM', 'TEMOS', 'QUAL', 'QUAIS', 'QUAL', 'QUEM', 'OS', 'AS', 'DO', 'DA', 'DE', 'DOS', 'DAS', 'NO', 'NA', 'NOS', 'EM', 'QUE', 'MAIS', 'COMPROU', 'COMPRARAM', 'COMPRA', 'COMPRAM', 'COMPRADO', 'CLIENTES', 'CLIENTE', 'TOP', 'MES', 'ONTEM', 'HOJE', 'SEMANA', 'ESSA', 'ESSE', 'ESTE', 'ESTA', 'VENDEDORA', 'VENDEDOR', 'PRODUTO', 'PRODUTOS', 'POSITIVACAO', 'QUANTOS', 'QUANTO', 'PRECO', 'MEDIO', 'SAIU', 'MEDIA', 'VENDE', 'VENDEU', 'VENDERAM', 'PELO', 'PELA', 'POR', 'PARA', 'PRA', 'COM', 'UM', 'UMA', 'MEU', 'MINHA', 'JOTA', 'FAVOR', 'PICO', 'ULTIMA', 'ULTIMO', 'LOJA', 'NUMERICA', 'PDVS', 'PDV', 'FILIAL', 'SUPERVISOR', 'EQUIPE', 'CARTEIRA', 'ITEM', 'ITENS', 'LISTA', 'SKU', 'FOCO', 'DIA', 'DIAS', 'SEMANAL', 'SEMANAIS', 'MENSAL', 'MENSAIS', 'VENDAS', 'VENDA', 'MELHOR', 'ESPECIFICO', 'ALGUM', 'ALGUMA', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO', 'VENDER', 'OFERECER', 'OFERTA', 'SUGERIR', 'PRO', 'PARA', 'ELE', 'ELA', 'SAI', 'SAEM', 'EVOLUCAO', 'POSITIVANDO', 'BEM', 'LEVAR', 'ITENS', 'OBJETIVO', 'OBJETIVOS', 'ESTAO', 'COMPRANDO', 'APOS', 'MEUS', 'MINHAS', 'NOSSOS', 'NOSSAS', 'COMPRARAM']);
export async function vendasEscopo(B, E) {
  const arqs = await Promise.all(E.filiais.map((f) => B.raw(`public/vendas_mes/${f}.json`).then((t) => { try { return t ? { f, ...JSON.parse(t) } : null; } catch (e) { return null; } })));
  const ok = arqs.filter(Boolean); if (!ok.length) return null;
  const restrito = E.grupo || E.supervisor || E.rca, rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const linhas = [], prod = {}, cli = {}; let ate = '';
  for (const a of ok) { if (a.ate > ate) ate = a.ate; for (const [k, v] of Object.entries(a.produtos || {})) if (!prod[k] || (!prod[k][1] && v[1])) prod[k] = v; for (const [k, v] of Object.entries(a.clientes || {})) cli[a.f + '|' + k] = v;
    for (const l of a.l || []) if (!restrito || rcas.has(a.f + '|' + l[1])) linhas.push({ f: a.f, d: l[0], r: l[1], c: l[2], p: l[3], q: l[4], v: l[5] }); }
  return { linhas, prod, cli, ate, filiais: ok.map((a) => a.f) };
}
export const dIso = (n) => { const s = String(n); return `${s.slice(6, 8)}/${s.slice(4, 6)}`; };
export function periodoDe(t, V) {
  const ult = V.linhas.reduce((m, l) => Math.max(m, l.d), 0);
  if (/\bONTEM\b/.test(t)) return { nome: 'ontem (' + dIso(ult) + ')', ok: (l) => l.d === ult, aviso: '' };
  if (/\bHOJE\b|\bHJ\b/.test(t)) return { nome: 'ontem (' + dIso(ult) + ')', ok: (l) => l.d === ult, aviso: '_Item a item vai até ontem; o de hoje entra na madrugada._' };
  if (/SEMANA/.test(t) && !/SEMANA(L|IS)|POR SEMANA|SEMANA A SEMANA|CADA SEMANA|DIA DA SEMANA/.test(t)) { const lim = Number(new Date(Date.UTC(+String(ult).slice(0, 4), +String(ult).slice(4, 6) - 1, +String(ult).slice(6, 8) - 6)).toISOString().slice(0, 10).replace(/-/g, '')); return { nome: 'últimos 7 dias', ok: (l) => l.d >= lim, aviso: '' }; }
  return { nome: 'no mês (até ' + dIso(ult) + ')', ok: () => true, aviso: '' };
}
// PALAVRAS GENERICAS NUNCA IDENTIFICAM INDUSTRIA NEM PRODUTO (26/10/2026: "o Brasil estava com 3 milhoes de devolucao" virou "Heinz Brasil"; "vendemos 45 milhoes" virou "Empresa Brasileira De")
export const GENERICAS = /^(SEM|NAO|BRASIL|BRASILEIRA|BRASILEIRO|BRASILEIRAS|EMPRESA|EMPRESAS|INDUSTRIA|INDUSTRIAS|ALIMENTOS|ALIMENTO|COMERCIO|DISTRIBUIDORA|DISTRIBUICAO|PRODUTOS|PRODUTO|GRUPO|LTDA|NACIONAL|CIA|COMPANHIA|DOCES|BEBIDAS|MES|DIA|HOJE|MILHOES|MILHAO|REAIS|VENDA|VENDAS|VENDEMOS|DEVOLUCAO|DEVOLUCOES)$/;
// acha produto(s) pelas palavras da pergunta (ex.: "snickers original" -> todos os SKUs com SNICKERS e ORIGINAL)
export function achaProdutos(t, V, E) {
  const nomesPessoas = new Set(E.vend.flatMap((v) => sem(v.nome).split(/\s+/)).concat(E.vend.flatMap((v) => sem(v.supervisor).split(/\s+/))));
  const toks = t.split(/[^A-Z0-9]+/).filter((w) => w.length > 2 && !PARADAS.has(w) && !FILIAIS.includes(w) && !nomesPessoas.has(w) && !/^\d+$/.test(w) && !GENERICAS.test(w));
  if (!toks.length) return null;
  let melhor = 0; const sc = {};
  for (const [cod, [des]] of Object.entries(V.prod)) { const d = sem(des); const n = toks.filter((w) => d.includes(w)).length; if (n) { sc[cod] = n; if (n > melhor) melhor = n; } }
  if (!melhor || (toks.length >= 2 && melhor < 2 && Object.values(sc).filter((x) => x === melhor).length > 40)) return null;
  const cods = Object.keys(sc).filter((c) => sc[c] === melhor);
  return { cods: new Set(cods), termo: titulo(toks.filter((w) => cods.some((c) => sem(V.prod[c][0]).includes(w))).join(' ')) };
}
// nome legivel da industria: tira codigo/prefixo ("A - ARCOR DO BRASIL LTDA" -> "Arcor do Brasil"), sem LTDA/S.A.
export function nomeIndustria(I) {
  const n = String(I[0] || '').replace(/^[A-Z0-9]{1,3}\s*-\s*/i, '').replace(/\b(LTDA|S\.?\s?A\.?|EIRELI|ME|EPP|IND(USTRIA)?|COM(ERCIO)?|DE ALIMENTOS)\b\.?/gi, '').replace(/\s+/g, ' ').trim();
  return titulo(n.split(' ').slice(0, 3).join(' ')) || titulo(String(I[0]));
}
// palavras da pergunta que sobram depois de tirar as palavras comuns (para dizer "nao achei X")
export function termoDaPergunta(t, E) {
  const nomes = new Set(E.vend.flatMap((v) => sem(v.nome).split(/\s+/)));
  return titulo(t.split(/[^A-Z0-9]+/).filter((w) => w.length > 2 && !PARADAS.has(w) && !FILIAIS.includes(w) && !nomes.has(w) && !/^\d+$/.test(w)).slice(0, 4).join(' '));
}
export const naoVende = (E, termo) => fraca(`🔎 Não achei venda de *${termo || 'esse produto'}* em ${E.nome} neste mês. Pode não estar no portfólio da filial (cada filial tem o seu catálogo) ou o nome está diferente. Tenta pelo código ou outra palavra do produto.`, 'naoachei', termo || '');
export function achaIndustria(t, V) {
  const inds = [...new Set(Object.values(V.prod).map((p) => p[1]).filter(Boolean))];
  // apelidos: como o time fala x como o fornecedor esta no catalogo (Mars = MASTERFOODS etc.)
  const APELIDO = { MARS: 'MASTERFOODS', MASTERFOODS: 'MASTERFOODS', NESTLE: 'NESTLE', GAROTO: 'GAROTO', PEPSICO: 'PEPSICO', KELLOGGS: 'KELLOGG', KELLOGG: 'KELLOGG' };
  const toks = t.split(/[^A-Z0-9]+/).filter((w) => w.length > 2 && !PARADAS.has(w) && !GENERICAS.test(w)).flatMap((w) => (APELIDO[w] ? [w, APELIDO[w]] : [w]));
  const hit = inds.filter((i) => toks.some((w) => sem(i).split(/[^A-Z0-9]+/).filter((x) => !GENERICAS.test(x)).includes(w)));
  return hit.length ? hit : null;
}
export const somaPor = (L, chave) => { const m = new Map(); for (const l of L) { const k = chave(l); const x = m.get(k) || { v: 0, q: 0, cli: new Set(), n: 0 }; x.v += l.v; x.q += l.q; x.cli.add(l.f + '|' + l.c); x.n++; m.set(k, x); } return m; };
export async function respProduto(B, E, t, pessoa) {
  const V = await vendasEscopo(B, E); if (!V) return SEM_VENDAS;
  const P = achaProdutos(t, V, E); if (!P) return /COMPR|PRODUTO|SKU|VEND/.test(t) && termoDaPergunta(t, E) ? naoVende(E, termoDaPergunta(t, E)) : null;
  const per = periodoDe(t, V);
  let L = V.linhas.filter((l) => P.cods.has(l.p) && per.ok(l));
  let quem = E.nome;
  if (pessoa && pessoa.tipo === 'vend') { L = L.filter((l) => l.f === pessoa.alvo.filial && l.r === pessoa.alvo.rca); quem = titulo(pessoa.alvo.nome) + ' (RCA ' + pessoa.alvo.rca + ')'; }
  if (!L.length) return `📦 *${P.termo}* — ${quem}, ${per.nome}: *nenhuma venda* encontrada.${per.aviso ? '\n' + per.aviso : ''}`;
  const C = [...somaPor(L, (l) => l.f + '|' + l.c)].sort((a, b) => b[1].v - a[1].v);
  const tot = L.reduce((a, l) => ({ v: a.v + l.v, q: a.q + l.q }), { v: 0, q: 0 });
  const vend = new Map(E.vend.map((v) => [v.filial + '|' + v.rca, vn(v)]));
  const porV = [...somaPor(L, (l) => l.f + '|' + l.r)].sort((a, b) => b[1].v - a[1].v).slice(0, 5);
  const toksP = sem(P.termo).split(/\s+/).filter(Boolean);
  const ex = await extrasTempo(B, E, L, t, (l, pm) => (pm ? toksP.every((w) => sem((pm[l.p] || [''])[0]).includes(w)) : P.cods.has(l.p)) && (!pessoa || pessoa.tipo !== 'vend' || (l.f === pessoa.alvo.filial && l.r === pessoa.alvo.rca)));
  return [`📦 *${P.termo}* — ${quem}, ${per.nome}`, `${R$(tot.v)} · ${N(tot.q)} un. · *${C.length} cliente(s)* · preço médio ${R$(tot.q ? tot.v / tot.q : null)}/un.`, per.aviso, '', `*Clientes que mais compraram:*`,
    ...C.slice(0, 10).map(([k, x], i) => `${i + 1}. ${titulo(V.cli[k] || k.split('|')[1])} (#${k.split('|')[1]}) — ${R$(x.v)} · ${N(x.q)} un.`),
    ...(pessoa ? [] : ['', '*Por vendedor:*', ...porV.map(([k, x]) => `• ${vend.get(k) || 'RCA ' + k.split('|')[1]} ${E.nacional ? k.split('|')[0] : ''}: ${R$(x.v)} · ${x.cli.size} cli.`)]),
    ...ex, '', SUGESTAO + `oferecer ${P.termo} nos clientes da rota que ainda não compraram (peça "quem comprava ${P.termo} e parou").`].filter((x) => x !== '').join('\n').replace(/\n\*Clientes/, '\n\n*Clientes');
}
export async function respIndustria(B, E, t, pessoa) {
  const V = await vendasEscopo(B, E); if (!V) return SEM_VENDAS;
  const I = achaIndustria(t, V); if (!I) return null;
  const per = periodoDe(t, V);
  const L = V.linhas.filter((l) => I.includes((V.prod[l.p] || [])[1]) && per.ok(l) && (!pessoa || pessoa.tipo !== 'vend' || (l.f === pessoa.alvo.filial && l.r === pessoa.alvo.rca)));
  const nomeI = nomeIndustria(I);
  if (!L.length) return `🏭 *${nomeI}* — ${E.nome}, ${per.nome}: nenhuma venda encontrada.`;
  const tot = L.reduce((a, l) => a + l.v, 0), clis = new Set(L.map((l) => l.f + '|' + l.c));
  const todosCli = new Set(V.linhas.filter(per.ok).map((l) => l.f + '|' + l.c));
  const porVend = /VENDEDOR|CARTEIRA|POR VEND/.test(t) || E.supervisor || E.grupo;
  const chave = E.nacional ? (l) => l.f : porVend ? (l) => l.f + '|' + l.r : (l) => { const v = E.vend.find((x) => x.filial === l.f && x.rca === l.r); return (v && v.supervisor) || 'sem supervisor'; };
  const vend = new Map(E.vend.map((v) => [v.filial + '|' + v.rca, vn(v)]));
  const G = [...somaPor(L, chave)].sort((a, b) => b[1].cli.size - a[1].cli.size);
  const SK = [...somaPor(L, (l) => l.p)].sort((a, b) => b[1].cli.size - a[1].cli.size).slice(0, 5);
  const ex = await extrasTempo(B, E, L, t, (l, pm) => I.includes(((pm || V.prod)[l.p] || [])[1]) && (!pessoa || pessoa.tipo !== 'vend' || (l.f === pessoa.alvo.filial && l.r === pessoa.alvo.rca)));
  return [`🏭 *${nomeI}* — ${E.nome}, ${per.nome}`, `Faturado: *${R$(tot)}* · positivação: *${N(clis.size)} clientes* (${P(clis.size, todosCli.size)} dos que compraram algo)`, '',
    `*Por ${E.nacional ? 'filial' : porVend ? 'vendedor' : 'supervisor'} (clientes · R$):*`, ...G.slice(0, 12).map(([k, x]) => `• ${E.nacional ? k : porVend ? (vend.get(k) || 'RCA ' + k.split('|')[1]) : nome2(k)}: ${x.cli.size} cli. · ${R$(x.v)}`),
    '*SKUs que mais positivam:*', ...SK.map(([c, x]) => `• ${titulo((V.prod[c] || [''])[0])}: ${x.cli.size} cli.`), ...ex, '', SUGESTAO + `peça "quem comprava ${nomeI} e parou" para a lista de recuperação.`].join('\n');
}
// RECUPERACAO (26/10/2026, Cristiano/TSJ: "Quem comprava TRIDENT GARRAFA e parou" so recebeu a contagem da filial): lista NOMINAL, do escopo de quem pergunta
// (supervisor = so a equipe dele), aberta por vendedor: comprou o produto/industria no mes passado e ainda NAO comprou neste mes.
export async function respRecuperacao(B, E, t) {
  const V = await vendasEscopo(B, E); if (!V) return SEM_VENDAS;
  const { vendasAnterior } = await import('./periodos.js'); const A = await vendasAnterior(B, E);
  if (!A) return '📦 _O mês anterior item a item ainda está sendo publicado (sai junto com o Data Lake). Tente daqui a pouco._';
  const VA = { ...V, prod: { ...A.prod, ...V.prod } };
  const I = achaIndustria(t, VA), Pr = I ? null : achaProdutos(t, VA, E); if (!I && !Pr) return naoVende(E, termoDaPergunta(t, E));
  const cods = new Set(Object.entries(VA.prod).filter(([c, p]) => (I ? I.includes(p[1]) : Pr.cods.has(c))).map(([c]) => c));
  const nome = I ? nomeIndustria(I) : Pr.termo;
  const agora = new Set(V.linhas.filter((l) => cods.has(l.p)).map((l) => l.f + '|' + l.c)), antes = new Map();
  for (const l of A.linhas) if (cods.has(l.p)) { const k = l.f + '|' + l.c; if (agora.has(k)) continue; const x = antes.get(k) || { r: l.r, f: l.f, v: 0 }; x.v += l.v; antes.set(k, x); }
  // "DESSES, QUAIS ESTAO NA ROTA DE HOJE?" (Vitorio, 27/10/2026, Bis em TSJ): so os que pararam e estao na rota de hoje do vendedor deles
  const naRotaHoje = /ROTA/.test(t) && /\bHOJE\b|\bHJ\b/.test(t);
  if (naRotaHoje) { const rh = new Set(); for (const v of E.vend) for (const c of v.rotaHoje || []) rh.add(v.filial + '|' + c.id_cliente); for (const k of [...antes.keys()]) if (!rh.has(k)) antes.delete(k); }
  if (naRotaHoje && !antes.size) return `🔁 *${nome}* (${E.nome}): nenhum dos clientes que pararam de comprar está na rota de hoje.`;
  if (!antes.size) return `🔁 *Recuperação — ${nome}* (${E.nome})\nNinguém parou: todo cliente que comprou ${nome} no mês passado já comprou de novo este mês.`;
  const vend = new Map(E.vend.map((v) => [v.filial + '|' + v.rca, vn(v)])), porV = new Map();
  for (const [k, x] of antes) { const kv = x.f + '|' + x.r; if (!porV.has(kv)) porV.set(kv, []); porV.get(kv).push([k, x]); }
  // citou vendedor (nome ou codigo) -> so a lista dele
  const toks = t.split(/[^A-Z0-9]+/).filter((w) => w.length > 2), citado = E.vend.filter((v) => sem(v.nome).split(/\s+/).some((w) => w.length > 3 && toks.includes(w)) || toks.includes(String(v.rca)));
  if (citado.length) { const ks = new Set(citado.map((v) => v.filial + '|' + v.rca)); for (const k of [...porV.keys()]) if (!ks.has(k)) porV.delete(k); }
  const totalCitado = [...porV.values()].reduce((s, L) => s + L.length, 0);
  const totalExibir = citado.length ? totalCitado : antes.size;
  const escopoNome = citado.length === 1 ? vn(citado[0]) : E.nome;
  const G = [...porV].sort((a, b) => b[1].length - a[1].length), out = [], MAX = 20; let n = 0;
  if (citado.length && !G.length) return `🔁 *Recuperação — ${nome}*\n${citado.map(vn).join(', ')}: nenhum cliente parou de comprar ${nome}.`;
  if (!citado.length && G.length > 1) out.push('', '*Por vendedor:* ' + G.map(([kv, L]) => `${vend.get(kv) || 'RCA ' + kv.split('|')[1]}: ${L.length}`).join(' · '));
  for (const [kv, L] of G) { if (!citado.length || G.length > 1) out.push('', `*${vend.get(kv) || 'RCA ' + kv.split('|')[1]}* — ${L.length} cliente(s)`);
    for (const [k, x] of L.sort((a, b) => b[1].v - a[1].v)) { if (n++ >= MAX) break; out.push(`• ${titulo((V.cli[k] || A.cli[k] || 'Cliente #' + k.split('|')[1]))} (#${k.split('|')[1]}) · ${R$(x.v)} no mês passado`); }
    if (n >= MAX) { out.push(`… e mais ${totalExibir - MAX} cliente(s).` + (!citado.length ? ` Peça "quem comprava ${nome} e parou" + o nome do vendedor para ver a lista dele.` : '')); break; } }
  return [`🔁 *Recuperação — ${nome}* (${escopoNome})`, `*${N(totalExibir)} clientes*` + (citado.length ? ` de *${escopoNome}*` : '') + ` compraram ${nome} no mês passado e *ainda não compraram este mês*` + (naRotaHoje ? ' — e *estão na rota de hoje*.' : '.'), ...out,
    '', SUGESTAO + (citado.length ? `conversar com ${vn(citado[0])} para recuperar esses clientes esta semana.` : 'distribuir a lista para os vendedores visitarem esta semana.')].join('\n');
}
export async function respCliente(B, E, t) {
  const V = await vendasEscopo(B, E); if (!V) return SEM_VENDAS;
  const toks = t.split(/[^A-Z0-9]+/).filter((w) => w.length > 2 && !PARADAS.has(w) && !FILIAIS.includes(w) && !GENERICAS.test(w));
  const num = (t.match(/#?(\d{3,7})\b/) || [])[1];
  if (num) {
    const k = Object.keys(V.cli).find((x) => x.endsWith('|' + num));
    if (k) return clienteDetalhe(E, V, k);
  }
  if (!toks.length) return null;
  // procura clientes que contenham as palavras da pergunta
  const hits = Object.entries(V.cli).map(([k, nome]) => {
    const n = sem(nome);
    const s = toks.filter((w) => n.includes(w)).length;
    return { k, nome, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);

  if (!hits.length) return null;
  const maxS = hits[0].s;
  const topHits = hits.filter((x) => x.s === maxS);

  // Se são várias lojas da mesma rede (ex.: Shibata, Muffato com múltiplas lojas):
  if (topHits.length > 1 && topHits.length <= 30) {
    const ids = new Set(topHits.map((x) => x.k));
    const L = V.linhas.filter((l) => ids.has(l.f + '|' + l.c));
    const tot = L.reduce((a, l) => a + l.v, 0);
    const porLoja = new Map();
    for (const h of topHits) porLoja.set(h.k, { nome: h.nome, v: 0 });
    for (const l of L) { const x = porLoja.get(l.f + '|' + l.c); if (x) x.v += l.v; }
    const termo = titulo(toks.join(' '));
    const Lj = [...porLoja.entries()].sort((a, b) => b[1].v - a[1].v);
    return [
      `🏪 *Rede / Lojas ${termo}* (${E.nome})`,
      `Total no mês: *${R$(tot)}* em *${Lj.length} loja(s)*`,
      '',
      '*Por loja (mês):*',
      ...Lj.map(([k, x]) => `• #${k.split('|')[1]} - ${titulo(x.nome)}: *${R$(x.v)}*`),
      '',
      SUGESTAO + 'peça "compra do cliente #' + (Lj[0] ? Lj[0][0].split('|')[1] : 'código') + '" para ver os produtos comprados por uma loja específica.'
    ].join('\n');
  }

  return clienteDetalhe(E, V, topHits[0].k);
}

function clienteDetalhe(E, V, melhor) {
  const L = V.linhas.filter((l) => l.f + '|' + l.c === melhor);
  const tot = L.reduce((a, l) => a + l.v, 0), dias = [...new Set(L.map((l) => l.d))].sort();
  const PR = [...somaPor(L, (l) => l.p)].sort((a, b) => b[1].v - a[1].v);
  const v = E.vend.find((x) => x.filial + '|' + x.rca === melhor.split('|')[0] + '|' + (L[0] || {}).r);
  return [`🏪 *${titulo(V.cli[melhor])}* (#${melhor.split('|')[1]}, ${melhor.split('|')[0]})${v ? ' · vendedor ' + vn(v) : ''}`, `No mês: *${R$(tot)}* em ${dias.length} dia(s) de compra · último: ${dIso(dias[dias.length - 1])} · ${PR.length} SKUs`, '',
    '*O que comprou (mês):*', ...PR.slice(0, 12).map(([c, x]) => `• ${titulo((V.prod[c] || [''])[0])}: ${N(x.q)} un. · ${R$(x.v)}`), PR.length > 12 ? `… e mais ${PR.length - 12} SKUs` : '',
    '', SUGESTAO + 'peça "o que oferecer" no +MIX deste cliente antes da próxima visita.'].filter((x) => x !== '').join('\n');
}
export async function respTopProdutos(B, E, t) {
  const V = await vendasEscopo(B, E); if (!V) return SEM_VENDAS;
  const per = periodoDe(t, V); const L = V.linhas.filter(per.ok);
  const PR = [...somaPor(L, (l) => l.p)].sort((a, b) => b[1].v - a[1].v).slice(0, 10);
  return [`🏆 *Produtos mais vendidos — ${E.nome}, ${per.nome}*`, ...PR.map(([c, x], i) => `${i + 1}. ${titulo((V.prod[c] || [''])[0])} — ${R$(x.v)} · ${x.cli.size} cli.`), per.aviso].filter(Boolean).join('\n');
}
export async function respPreco(B, E, t) {
  const V = await vendasEscopo(B, E); if (!V) return SEM_VENDAS;
  const P = achaProdutos(t, V, E); if (!P) return naoVende(E, termoDaPergunta(t, E));
  const L = V.linhas.filter((l) => P.cods.has(l.p) && l.q > 0 && l.v > 0);   /* sem bonificacao (R$ 0) */
  if (!L.length) return `Sem venda de ${P.termo} no mês em ${E.nome}.`;
  const pu = L.map((l) => l.v / l.q).sort((a, b) => a - b), tot = L.reduce((a, l) => ({ v: a.v + l.v, q: a.q + l.q }), { v: 0, q: 0 });
  const porF = [...somaPor(L, (l) => l.f)].map(([f, x]) => `• ${f}: ${R$(x.q ? x.v / x.q : null)} (média)`);
  const med = pu[Math.floor(pu.length / 2)], q1 = pu[Math.floor(pu.length * 0.1)], q9 = pu[Math.floor(pu.length * 0.9)];
  return [`💲 *Preço praticado — ${P.termo}* (${E.nome}, mês)`, `Preço típico: *${R$(med)}* por unidade de venda · faixa normal ${R$(q1)} a ${R$(q9)} (${N(L.length)} itens de pedido)`, ...(E.nacional ? porF : []),
    '_Unidade de venda = como foi digitado no pedido (caixa ou unidade). Bonificação (R$ 0) fora da conta._'].join('\n');
}
export async function respMarcaPropriaVivo(B, E, t) {
  const V = await vendasEscopo(B, E); if (!V) return null;
  const marca = (t.match(/ZIPOCA|CALIRA|MITBIT|BELLARONE|SKIVE/) || [])[0];
  const ehMP = (p) => /TRIUNFANTE/.test(sem((V.prod[p] || [])[1])) && (!marca || sem((V.prod[p] || [''])[0]).includes(marca));
  const per = periodoDe(t, V); const L = V.linhas.filter((l) => ehMP(l.p));
  const ult = V.linhas.reduce((m, l) => Math.max(m, l.d), 0);
  const mes = L.reduce((a, l) => a + l.v, 0), ont = L.filter((l) => l.d === ult).reduce((a, l) => a + l.v, 0);
  const G = [...somaPor(L, (l) => (E.nacional ? l.f : l.r))].sort((a, b) => b[1].v - a[1].v);
  const vend = new Map(E.vend.map((v) => [v.rca, vn(v)]));
  return [`🎯 *Marca Própria${marca ? ' — ' + titulo(marca) : ''}* (${E.nome}, mês até ${dIso(ult)})`, `Mês: *${R$(mes)}* · ${new Set(L.map((l) => l.f + '|' + l.c)).size} clientes · ontem: *${R$(ont)}*`, '',
    ...G.slice(0, 12).map(([k, x]) => `• ${E.nacional ? k : vend.get(k) || 'RCA ' + k}: ${R$(x.v)} · ${x.cli.size} cli.`), '_Fonte: vendas item a item (fornecedor Triunfante do catálogo)._'].join('\n');
}

// PEDIDO PELO NUMERO (Ivayr/TCA, 26/10/2026: "ja faturou o pedido 1190000030"; Vitorio: "vc tem o numero do pedido... status, o que veio no pedido, se teve corte").
// Fonte: base do dia (/api/pedidos-dia = analise do coletor, cache_analise_cliente): numero, status, valor, faturado no Winthor, corte e itens cortados.
// Escopo: so pedido de vendedor que a pessoa enxerga. Fora da base = diz a verdade.
export async function respPedidoNumero(B, E, t) {
  const num = (t.match(/\d{7,}/) || [''])[0]; if (!num) return null;
  const pd = await B.pedidosDia(); const P = ((pd && pd.pedidos) || []).find((p) => String(p.num) === num);
  const meu = (p) => E.nacional || E.vend.concat(E.ocultos || []).some((v) => v.filial === p.filial && String(v.rca) === String(p.rca));
  if (!P) {   /* pedido de outro dia: linha do tempo do status (pedido_status, desde 26/10/2026) */
    const o = await B.pedidoNum(num), x = o && o.pedido;
    if (x && meu(x)) {
      const v = E.vend.concat(E.ocultos || []).find((y) => y.filial === x.filial && String(y.rca) === String(x.rca));
      const dt = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const H = (o.linha_do_tempo || []);
      return [`🧾 *Pedido ${num}* — ${v ? vn(v) : 'RCA ' + x.rca} (${x.filial}) · cliente #${x.id_cliente} · pedido de ${String(x.data_pedido).slice(8, 10)}/${String(x.data_pedido).slice(5, 7)}`,
        `📌 *Status:* ${x.status}${x.final ? ' _(final)_' : ''} · conferido em ${dt(x.rechecado_em)}`, `💰 Valor: ${R$(x.valor)}` + (x.itens_cortados ? ` · ✂️ ${x.itens_cortados} item(ns) cortado(s)` : ''),
        H.length > 1 ? '🕒 *Linha do tempo:* ' + H.map((h) => `${h.status} ${dt(h.visto_em)}`).join(' → ') : ''].filter(Boolean).join('\n');
    }
  }
  if (!P) return `🔎 *Pedido ${num}*: não está na base de hoje. A base lê o pedido de cada cliente positivado dos vendedores acompanhados (Liga), alguns minutos depois de o pedido entrar; pedido de outro dia ou de código fora desse acompanhamento ainda não aparece aqui. _Anotei para a diretoria._`;
  if (!meu(P)) return `🔎 O pedido ${num} não é da sua equipe.`;
  const v = E.vend.concat(E.ocultos || []).find((x) => x.filial === P.filial && String(x.rca) === String(P.rca));
  const corte = (P.itens_cortados || []).length ? `✂️ *Corte:* ${P.categoria_corte || 'sim'} · ${P.itens_cortados.length} item(ns) cortado(s)` + (P.vl_perdido_logistica ? ` · ${R$(P.vl_perdido_logistica)} perdido` : '') : `✂️ Corte: ${P.categoria_corte || 'sem corte'}`;
  return [`🧾 *Pedido ${num}* — ${v ? vn(v) : 'RCA ' + P.rca} (${P.filial}) · cliente #${P.id_cliente}`,
    `📌 *Status:* ${P.status_pedido || 'sem status'}` + (/BLOQ/i.test(P.status_pedido || '') ? ' _(pendência comercial/crédito: ainda não fatura)_' : /LIBER/i.test(P.status_pedido || '') ? ' _(liberado para faturar)_' : ''),
    `💰 Valor do pedido: ${R$(P.total_clube || P.valor)}` + (P.vl_faturado_winthor ? ` · valor no Winthor: ${R$(P.vl_faturado_winthor)}` : ''),
    corte, `_Lido da base às ${new Date(P.analisado_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}._`].join('\n');
}

// PEDIDOS POR STATUS DO ESCOPO (Vitorio, 26/10/2026: "e se o supervisor perguntar quais pedidos estao bloqueados ainda hoje do time dele?").
// Base do dia (/api/pedidos-dia). Status e o da ULTIMA leitura do pedido (hora mostrada); a rechecagem ate FATURADO e a linha do tempo estao sendo ligadas.
export async function respPedidosStatus(B, E, t) {
  const alvo = t === 'PENDENTES' ? 'PENDENTES' : /BLOQUEAD/.test(t) ? 'BLOQUEADO' : /LIBERAD/.test(t) ? 'LIBERADO' : /CORTE|CORTAD/.test(t) ? 'CORTE' : null;
  const pd0 = await B.pedidosDia(); if (!pd0 || !Array.isArray(pd0.pedidos)) return '🧾 _Os pedidos do dia ainda não estão na base. Tente em alguns minutos._';
  // pendente/bloqueado/liberado de QUALQUER dia (linha do tempo, ultimos 15 dias) + os de hoje; status mais recente vence (27/10/2026)
  const pd = { pedidos: pd0.pedidos.slice() };
  if (alvo !== 'CORTE') { const ab = await B.pedidosAbertos(); const ja = new Set(pd.pedidos.map((p) => String(p.num)));
    for (const a of (ab && ab.abertos) || []) if (!ja.has(String(a.num))) pd.pedidos.push({ ...a, num: String(a.num), total_clube: a.valor, analisado_em: Date.parse(a.rechecado_em), data: a.data_pedido }); }
  const meus = new Map(E.vend.concat(E.ocultos || []).map((v) => [v.filial + '|' + v.rca, v]));
  const P = pd.pedidos.filter((p) => (E.nacional || meus.has(p.filial + '|' + p.rca)) && (alvo === 'CORTE' ? (p.itens_cortados || []).length : alvo === 'PENDENTES' ? !/FATURAD|CANCELAD/i.test(String(p.status_pedido || '')) : !alvo || String(p.status_pedido || '').toUpperCase() === alvo));
  const hm = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const titulo0 = alvo === 'CORTE' ? 'com corte' : alvo === 'PENDENTES' ? 'ainda não faturados' : alvo ? alvo.toLowerCase() + 's' : 'de hoje';
  if (!P.length) return `🧾 *Pedidos ${titulo0} — ${E.nome}*: nenhum na base agora.`;
  const porV = new Map(); for (const p of P) { const k = p.filial + '|' + p.rca; if (!porV.has(k)) porV.set(k, []); porV.get(k).push(p); }
  const tot = P.reduce((a, p) => a + (Number(p.total_clube || p.valor) || 0), 0), L = [`🧾 *Pedidos ${titulo0} — ${E.nome}*: *${P.length}* · ${R$(tot)}`, ''];
  let n = 0;
  for (const [k, ps] of [...porV].sort((a, b) => b[1].length - a[1].length)) {
    const v = meus.get(k); L.push(`*${v ? vn(v) : 'RCA ' + k.split('|')[1]}${E.nacional ? ' ' + k.split('|')[0] : ''}* — ${ps.length}`);
    for (const p of ps) { if (n++ >= 30) break; L.push(`• ${p.num}${p.data && p.data !== hojeSP() ? ' (' + String(p.data).slice(8, 10) + '/' + String(p.data).slice(5, 7) + ')' : ''} · cliente #${p.id_cliente} · ${R$(p.total_clube || p.valor)} · ${p.status_pedido || 'sem status'}` + ((p.itens_cortados || []).length ? ` · ✂️ ${p.itens_cortados.length} item(ns) cortado(s)` : '') + ` _(lido ${hm(p.analisado_em)})_`); }
    if (n >= 30) { L.push(`… e mais ${P.length - 30}. Peça por vendedor.`); break; }
  }
  L.push('', '_Status da última leitura de cada pedido (hora ao lado)._', SUGESTAO + (alvo === 'BLOQUEADO' ? 'bloqueado é pendência comercial/crédito: falar com o crédito hoje para liberar o faturamento.' : 'peça "pedido <número>" para o detalhe de um pedido.'));
  return L.join('\n');
}
