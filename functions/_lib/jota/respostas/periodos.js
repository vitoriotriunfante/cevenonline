// =========================================================================
// JOTA · functions/_lib/jota/respostas/periodos.js
// O QUE É: comparação com o mês passado, dias sem pedido, clientes sem comprar.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { sn } from '../escopo.js';
import { N, R$, SUGESTAO, nome2, sem, so, titulo, vn } from '../base.js';
import { pessoaReal, supReal } from '../escopo.js';
import { SEM_VENDAS, achaIndustria, achaProdutos, dIso, nomeIndustria, somaPor, vendasEscopo } from './vendas.js';

// ---------- PERIODOS E COMPARACAO COM O MES PASSADO (Vitorio, 25/10/2026: "dados do dia, da semana, do mes... comparacao com mes passado...
// mes passado com esse mes ate agora... o negocio e complexo"). Regua: VALOR DOS PEDIDOS item a item (nao e o faturado liquido do painel do CEVEN;
// devolucao e corte entram diferente). Comparacao justa: este mes ATE o dia D x mes passado ATE o mesmo dia D.
export async function vendasAnterior(B, E) {
  const arqs = await Promise.all(E.filiais.map((f) => B.raw(`public/vendas_mes_anterior/${f}.json`).then((t) => { try { return t ? { f, ...JSON.parse(t) } : null; } catch (e) { return null; } })));
  const ok = arqs.filter(Boolean); if (!ok.length) return null;
  const restrito = E.grupo || E.supervisor || E.rca, rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const linhas = [], prod = {}, cli = {}; let de = '', ate = '';
  for (const a of ok) { de = a.de; ate = a.ate; for (const [k, v] of Object.entries(a.produtos || {})) if (!prod[k] || (!prod[k][1] && v[1])) prod[k] = v; for (const [k, v] of Object.entries(a.clientes || {})) cli[a.f + '|' + k] = v;
    for (const l of a.l || []) if (!restrito || rcas.has(a.f + '|' + l[1])) linhas.push({ f: a.f, d: l[0], r: l[1], c: l[2], p: l[3], q: l[4], v: l[5] }); }
  return { linhas, prod, cli, de, ate };
}
export const MESES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const delta = (a, b) => (b ? `${a >= b ? '▲' : '▼'} ${Math.abs((a / b - 1) * 100).toFixed(1).replace('.', ',')}%` : 'sem base');
export async function respComparaMes(B, E, t, pessoa) {
  const [A, Z] = await Promise.all([vendasEscopo(B, E), vendasAnterior(B, E)]);
  if (!A) return SEM_VENDAS;
  if (!Z) return '📦 _O mês anterior item a item ainda está sendo publicado (sai junto com o Data Lake). Tente daqui a pouco._';
  // filtro opcional: vendedor, industria ou produto citado
  let filtro = () => true, sobre = E.nome;
  if (pessoa && pessoa.tipo === 'vend') { filtro = (l) => l.f === pessoa.alvo.filial && l.r === pessoa.alvo.rca; sobre = vn(pessoa.alvo); }
  else if (pessoa && pessoa.tipo === 'sup') { const rs = new Set(E.vend.filter((v) => v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial).map((v) => v.filial + '|' + v.rca)); filtro = (l) => rs.has(l.f + '|' + l.r); sobre = 'Equipe ' + nome2(pessoa.alvo.nome); }
  const prodAll = { ...Z.prod, ...A.prod };
  const I = achaIndustria(t, { prod: prodAll });
  const Pr = I ? null : achaProdutos(t, { prod: prodAll }, E);
  const filtroP = I ? (l) => I.includes((prodAll[l.p] || [])[1]) : Pr ? (l) => Pr.cods.has(l.p) : () => true;
  const rotulo = I ? ' · ' + nomeIndustria(I) : Pr ? ' · ' + Pr.termo : '';
  // escopo sem nenhuma venda item a item neste mes (equipe interna, vendedor parado): dizer, nunca montar "R$ 0 x undefined" (26/10/2026)
  if (!A.linhas.length) return `📅 *${sobre}*: nenhuma venda item a item neste mês até agora — não há o que comparar com o mês passado.`;
  const ateA = A.linhas.reduce((m, l) => Math.max(m, l.d), 0), diaCorte = ateA % 100;
  const mesA = Math.floor(ateA / 100) % 100, mesZ = mesA === 1 ? 12 : mesA - 1;
  const LA = A.linhas.filter((l) => filtro(l) && filtroP(l));
  const LZall = Z.linhas.filter((l) => filtro(l) && filtroP(l)), LZ = LZall.filter((l) => l.d % 100 <= diaCorte);
  const sum = (L) => L.reduce((a, l) => a + l.v, 0), cli = (L) => new Set(L.map((l) => l.f + '|' + l.c)).size;
  const mix = (L) => { const m = new Map(); for (const l of L) { const k = l.f + '|' + l.c; (m.get(k) || m.set(k, new Set()).get(k)).add(l.p); } const a = [...m.values()]; return a.length ? a.reduce((s2, x) => s2 + x.size, 0) / a.length : 0; };
  const vA = sum(LA), vZ = sum(LZ), cA = cli(LA), cZ = cli(LZ), mA = mix(LA), mZ = mix(LZ);
  const L = [`📅 *${sobre}${rotulo} — ${MESES[mesA]} × ${MESES[mesZ]}* (até o dia ${diaCorte} de cada mês)`,
    `💰 Vendas: *${R$(vA)}* × ${R$(vZ)} → *${delta(vA, vZ)}*`, `👥 Clientes que compraram: *${N(cA)}* × ${N(cZ)} → ${delta(cA, cZ)}`, `🧺 Mix médio: ${mA.toFixed(1).replace('.', ',')} × ${mZ.toFixed(1).replace('.', ',')} produtos/cliente`, `_${MESES[mesZ]} inteiro: ${R$(sum(LZall))}._`];
  // quem mais caiu / subiu (filial no Brasil, supervisor na filial, vendedor na equipe)
  const chave = E.nacional ? (l) => l.f : (E.supervisor || (pessoa && pessoa.tipo === 'sup')) ? (l) => l.f + '|' + l.r : (l) => { const v = E.vend.find((x) => x.filial === l.f && x.rca === l.r); return (v && v.supervisor) || 'sem supervisor'; };
  if (!(pessoa && pessoa.tipo === 'vend')) {
    const ga = somaPor(LA, chave), gz = somaPor(LZ, chave);
    const D = [...new Set([...ga.keys(), ...gz.keys()])].filter((k) => E.nacional || supReal(k) || k.includes('|')).map((k) => [k, (ga.get(k) || { v: 0 }).v, (gz.get(k) || { v: 0 }).v]).filter((x) => x[2] > 0).sort((a, b) => (a[1] / a[2]) - (b[1] / b[2]));
    const nomeK = (k) => (E.nacional ? k : k.includes('|') ? vn(E.vend.find((v) => v.filial + '|' + v.rca === k) || { nome: 'RCA ' + k.split('|')[1] }) : nome2(k));
    if (D.length) {   /* so chama de "cresceram" quem cresceu de fato; o resto e "menores quedas" (25/10/2026) */
      const fmt = ([k, a, z]) => `• ${nomeK(k)}: ${R$(a)} × ${R$(z)} (${delta(a, z)})`;
      const cai = D.filter(([, a, z]) => a < z), sobe = D.filter(([, a, z]) => a >= z).reverse();
      if (cai.length) L.push('', '*Mais caíram:*', ...cai.slice(0, 4).map(fmt));
      if (sobe.length) L.push('*Cresceram:*', ...sobe.slice(0, 3).map(fmt));
      else if (cai.length > 4) L.push('*Menores quedas:*', ...cai.slice(-3).reverse().map(fmt));
    }
    if (D.length) L.push('', SUGESTAO + `entender a queda de ${nomeK(D[0][0])} (${delta(D[0][1], D[0][2])}) antes do fechamento.`);
  }
  L.push('_Régua: valor dos pedidos item a item (não é o faturado líquido do CEVEN)._');
  return L.join('\n');
}
// DIAS SEM PEDIDO (pelas datas dos pedidos item a item; ultimos 60 dias = mes atual + anterior)
export async function respDiasSemPedido(B, E, t) {
  const [A, Z] = await Promise.all([vendasEscopo(B, E), vendasAnterior(B, E)]); if (!A) return SEM_VENDAS;
  const ult = new Map(); for (const l of [...(Z ? Z.linhas : []), ...A.linhas]) { const k = l.f + '|' + l.r; if ((ult.get(k) || 0) < l.d) ult.set(k, l.d); }
  const ateA = A.linhas.reduce((m, l) => Math.max(m, l.d), 0);
  const uteis = (d1, d2) => { let n = 0; const a = new Date(Date.UTC(Math.floor(d1 / 10000), Math.floor(d1 / 100) % 100 - 1, d1 % 100)), b = new Date(Date.UTC(Math.floor(d2 / 10000), Math.floor(d2 / 100) % 100 - 1, d2 % 100)); for (let x = new Date(a.getTime() + 864e5); x <= b; x = new Date(x.getTime() + 864e5)) { const w = x.getUTCDay(); if (w > 0 && w < 6) n++; } return n; };
  const lim = Number((t.match(/(\d+)\s*DIAS?/) || [])[1]) || 3;
  const V = E.vend.filter((v) => v.varejo && pessoaReal(v)).map((v) => ({ v, d: ult.get(v.filial + '|' + v.rca) })).map((x) => ({ ...x, dias: x.d ? uteis(x.d, ateA) : 99 })).filter((x) => x.dias >= lim).sort((a, b) => b.dias - a.dias);
  if (!V.length) return `✅ *${E.nome}*: nenhum vendedor do varejo está há ${lim}+ dias úteis sem pedido (até ${dIso(ateA)}).`;
  return [`⏳ *${E.nome} — varejo há ${lim}+ dias úteis sem pedido* (até ${dIso(ateA)})`, ...V.slice(0, 20).map((x) => `• ${vn(x.v)}${E.nacional ? ' ' + x.v.filial : ''}: ${x.dias >= 99 ? 'sem pedido em 60 dias' : x.dias + ' dias úteis'} (último ${x.d ? dIso(x.d) : '—'}) · sup. ${sn(x.v.supervisor, x.v.supCod)}`), V.length > 20 ? `… e mais ${V.length - 20}` : '', '', SUGESTAO + `ligar hoje para ${vn(V[0].v)} e o supervisor ${sn(V[0].v.supervisor, V[0].v.supCod)}.`].filter((x) => x !== '').join('\n');
}
// CLIENTES SEM COMPRAR ha N dias (curva A = os que mais compraram no periodo): mes atual + anterior item a item
export async function respClientesSemComprar(B, E, t) {
  const [A, Z] = await Promise.all([vendasEscopo(B, E), vendasAnterior(B, E)]); if (!A) return SEM_VENDAS;
  const lim = Number((t.match(/(\d+)\s*DIAS?/) || [])[1]) || 30;
  const todas = [...(Z ? Z.linhas : []), ...A.linhas];
  const ateA = A.linhas.reduce((m, l) => Math.max(m, l.d), 0);
  const corte = Number(new Date(Date.UTC(Math.floor(ateA / 10000), Math.floor(ateA / 100) % 100 - 1, ateA % 100 - lim)).toISOString().slice(0, 10).replace(/-/g, ''));
  const C = new Map(); for (const l of todas) { const k = l.f + '|' + l.c; const x = C.get(k) || { v: 0, ult: 0, r: l.r }; x.v += l.v; if (l.d > x.ult) { x.ult = l.d; x.r = l.r; } C.set(k, x); }
  const ord = [...C.entries()].sort((a, b) => b[1].v - a[1].v); const topN = Math.max(1, Math.ceil(ord.length * 0.2));
  const curvaA = /CURVA A|GRANDES|MAIORES|IMPORTANTES/.test(t) ? new Set(ord.slice(0, topN).map((x) => x[0])) : null;
  const L = ord.filter(([k, x]) => x.ult <= corte && (!curvaA || curvaA.has(k)));
  const cli = { ...(A.cli || {}) };
  const dias = (d) => Math.round((Date.UTC(Math.floor(ateA / 10000), Math.floor(ateA / 100) % 100 - 1, ateA % 100) - Date.UTC(Math.floor(d / 10000), Math.floor(d / 100) % 100 - 1, d % 100)) / 864e5);
  if (!L.length) return `✅ *${E.nome}*: nenhum cliente ${curvaA ? 'curva A ' : ''}está há mais de ${lim} dias sem comprar (base: pedidos desde ${dIso(Z ? Z.linhas.reduce((m, l) => Math.min(m, l.d), 99999999) : 0)}).`;
  const vend = new Map(E.vend.map((v) => [v.filial + '|' + v.rca, v]));
  return [`🚨 *${E.nome} — clientes ${curvaA ? 'curva A (20% que mais compram) ' : ''}há mais de ${lim} dias sem comprar*: *${L.length}*`,
    ...L.slice(0, 15).map(([k, x]) => `• ${titulo(cli[k] || 'cliente ' + k.split('|')[1])} (#${k.split('|')[1]}${E.nacional ? ', ' + k.split('|')[0] : ''}) — ${dias(x.ult)} dias · comprou ${R$(x.v)} no período · ${vend.get(k.split('|')[0] + '|' + x.r) ? vn(vend.get(k.split('|')[0] + '|' + x.r)) : 'RCA ' + x.r}`),
    L.length > 15 ? `… e mais ${L.length - 15}` : '', '', SUGESTAO + 'colocar esses clientes na rota desta semana, começando pelos de maior valor.', '_Base: pedidos item a item do mês atual e do anterior._'].filter((x) => x !== '').join('\n');
}

// PEDIDOS DE UM PERIODO, DIA A DIA (26/10/2026, Vitorio: "quanto captamos de pedido do dia 19 para ca? aberto por dia" caiu no "hoje"). Dias fechados = valor dos
// pedidos item a item (Data Lake, ate ontem); hoje = digitado agora (mesma base do "hoje"). Nada estimado.
export function pedePeriodo(t) {
  const m = t.match(/(?:DESDE O? ?DIA|DO DIA|A PARTIR DO DIA|DIA)\s*(\d{1,2})\s*(?:PARA CA|PRA CA|ATE HOJE|ATE AGORA|EM DIANTE)/) || t.match(/(?:DE|DO DIA|DIA)\s*(\d{1,2})\s*(?:A|ATE|AO DIA)\s*(\d{1,2})\b/);
  return m ? { de: +m[1], ate: m[2] ? +m[2] : null } : null;
}
export async function respPeriodoDias(B, E, t, per) {
  const V = await vendasEscopo(B, E); if (!V) return SEM_VENDAS;
  const ult = V.linhas.reduce((m, l) => Math.max(m, l.d), 0), ym = Math.floor(ult / 100), hojeD = Number(new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ''));
  if (per.ontem) { per.de = ult % 100; per.ate = ult % 100; }   /* "ontem" = ultimo dia com pedido na base item a item (sabado/domingo/feriado pulam) */
  const de = ym * 100 + per.de, ate = per.ate ? ym * 100 + per.ate : hojeD;
  const porD = new Map(); for (const l of V.linhas) if (l.d >= de && l.d <= ate) { const x = porD.get(l.d) || { v: 0, cli: new Set() }; x.v += l.v; x.cli.add(l.f + '|' + l.c); porD.set(l.d, x); }
  const L = [...porD].sort((a, b) => a[0] - b[0]).map(([d, x]) => [dIso(d), x.v, x.cli.size + ' cli.']);
  if (ate >= hojeD && hojeD > ult) { const dig = (E.nacional || !(E.grupo || E.supervisor || E.rca)) ? E.macro.dig : E.vend.reduce((a, v) => a + (v.dig || 0), 0); L.push([dIso(hojeD) + ' (hoje, digitado até agora)', dig, '']); }
  const tot = L.reduce((a, x) => a + (x[1] || 0), 0);
  if (per.ontem) {   /* ontem: total + por vendedor (equipe) ou so o total (vendedor) */
    const Lo = V.linhas.filter((l) => l.d === ult), pv = new Map();
    for (const l of Lo) { const k = l.f + '|' + l.r; const x = pv.get(k) || { v: 0, cli: new Set() }; x.v += l.v; x.cli.add(l.c); pv.set(k, x); }
    const nomeV = (k) => { const v = E.vend.find((y) => y.filial + '|' + y.rca === k); return v ? vn(v) : 'RCA ' + k.split('|')[1]; };
    return [`🧾 *Ontem (${dIso(ult)}) — ${E.nome}*: *${R$(tot)}* em pedidos · ${new Set(Lo.map((l) => l.f + '|' + l.c)).size} clientes`,
      ...(E.vend.length > 1 ? ['', ...[...pv].sort((a, b) => b[1].v - a[1].v).map(([k, x]) => `• ${nomeV(k)}: ${R$(x.v)} · ${x.cli.size} cli.`)] : [])].join('\n');
  }
  return [`🧾 *Pedidos de ${String(per.de).padStart(2, '0')}/${String(ym % 100).padStart(2, '0')} ${per.ate ? 'a ' + String(per.ate).padStart(2, '0') : 'até hoje'} — ${E.nome}*`, `Total: *${R$(tot)}*`, '',
    ...L.map(([d, v, c]) => `• ${d}: ${R$(v)}${c ? ' · ' + c : ''}`), '', '_Dias fechados = valor dos pedidos item a item; hoje = digitado até agora._'].join('\n');
}

export async function respPositivadosMesAnterior(B, E, t, pessoa) {
  const Z = await vendasAnterior(B, E);
  if (!Z || !Z.linhas.length) return '📦 _As vendas do mês anterior (setembro) ainda não estão disponíveis para esta filial._';
  let sobre = E.nome, linhas = Z.linhas;
  if (pessoa && pessoa.tipo === 'vend') {
    linhas = Z.linhas.filter((l) => l.f === pessoa.alvo.filial && String(l.r) === String(pessoa.alvo.rca));
    sobre = vn(pessoa.alvo);
  } else if (pessoa && pessoa.tipo === 'sup') {
    const rs = new Set(E.vend.filter((v) => v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial).map((v) => v.filial + '|' + v.rca));
    linhas = Z.linhas.filter((l) => rs.has(l.f + '|' + l.r));
    sobre = 'Equipe ' + nome2(pessoa.alvo.nome);
  }
  const porCli = new Map();
  for (const l of linhas) {
    const k = l.f + '|' + l.c;
    const item = porCli.get(k) || { cod: l.c, nome: Z.cli[k] || ('Cliente #' + l.c), tot: 0, itens: 0 };
    item.tot += l.v;
    item.itens += l.q;
    porCli.set(k, item);
  }
  const lista = [...porCli.values()].sort((a, b) => b.tot - a.tot);
  if (!lista.length) return `👥 *Clientes positivados em setembro — ${sobre}*: nenhuma compra registrada em setembro.`;
  const querTudo = /TODOS|TODAS|COMPLETA|LISTA COMPLETA|VER MAIS/i.test(sem(t));
  const n = querTudo ? (lista.length <= 120 ? lista.length : 80) : 25;
  const totalVal = lista.reduce((s, x) => s + x.tot, 0);
  const L = [
    `👥 *Clientes positivados em setembro — ${sobre}* (${E.filiais.join(', ')})`,
    `Total: *${lista.length} clientes positivados* · faturado *${R$(totalVal)}*`,
    '',
    '_Cliente · Faturado no mês_',
    ...lista.slice(0, n).map((x, i) => `${i + 1}. ${titulo(x.nome)} (#${x.cod}) — *${R$(x.tot)}*`),
    ...(lista.length > n ? ['', `… e mais ${lista.length - n} clientes. Peça "lista completa" para ver mais.`] : []),
    '',
    SUGESTAO + 'comparar com a curva negativa deste mês para resgatar quem comprou em setembro e ainda não comprou em outubro.'
  ];
  return L.join('\n');
}

