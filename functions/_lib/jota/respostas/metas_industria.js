// =========================================================================
// JOTA · functions/_lib/jota/respostas/metas_industria.js
// O QUE É: metas das indústrias (Premiação RV) e dia da semana / semana a semana / mês a mês.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { FILIAIS, N, P, R$, SUGESTAO, nome2, sem, titulo, vn } from '../base.js';
import { MESES, delta, vendasAnterior } from './periodos.js';
import { PARADAS } from './vendas.js';

// nome legivel do fornecedor da Premiacao ("A-MARS CHOC" -> "Mars Choc", "A - QUIMICA AMPARO" -> "Quimica Amparo")
export const nomeForn = (n) => titulo(String(n || '').replace(/^[A-Z0-9]{1,3}\s*-\s*/i, '').replace(/\(.*?\)|\.{2,}/g, '').replace(/\s+/g, ' ').trim());
export async function respMetasIndustria(B, E, t, pessoa) {
  const RV = await B.rv();
  if (!RV) return '🏆 _A Premiação (metas por indústria) não respondeu agora. Tente em alguns minutos._';
  // escopo: vendedor citado > equipe do supervisor citado > escopo de quem pergunta
  let vend = E.vend, quem = E.nome;
  if (pessoa && pessoa.tipo === 'vend') { vend = [pessoa.alvo]; quem = vn(pessoa.alvo); }
  else if (pessoa && pessoa.tipo === 'sup') { vend = E.vend.filter((v) => v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial); quem = 'Equipe ' + nome2(pessoa.alvo.nome); }
  const cods = E.nacional && !pessoa ? null : new Set(vend.map((v) => String(v.rca)));
  const dentro = (c) => !cods || cods.has(c);
  // industria citada (pelo nome da Premiacao; Mars = MARS CHOC/MARS PET etc.)
  const nomes = new Map(); for (const m of RV.metas) if (!nomes.has(m[1])) nomes.set(m[1], m[2]);
  const toks = t.split(/[^A-Z0-9]+/).filter((w) => w.length > 2 && !PARADAS.has(w) && !['META', 'METAS', 'INDUSTRIA', 'INDUSTRIAS', 'BATENDO', 'BATEU', 'BATER', 'ESTAMOS', 'FORNECEDOR', 'FORNECEDORES', 'PREMIACAO', 'PREMIO', 'ATINGIMENTO', 'ATINGIU', 'OBJETIVO', 'OBJETIVOS', 'DELES', 'DELAS', 'BRASIL', 'LTDA', 'ALIMENTOS', 'ALIMENTAR', 'COMERCIAL', 'IND', 'DOCEIRA', 'CHOC', 'PET', 'FALTA', 'BATENDO', 'BATIDA', 'GRUPO', 'TODAS', 'TODOS', 'GERAL'].includes(w) && !FILIAIS.includes(w));
  // so o nome da PESSOA CITADA sai da busca (ha contas com nome de industria, ex.: vendedor 'MONDELEZ'; 25/10/2026)
  const pessoasT = new Set(pessoa && pessoa.alvo ? sem(pessoa.alvo.nome).split(/\s+/) : []);
  const alvoI = new Set([...nomes].filter(([, n]) => toks.some((w) => !pessoasT.has(w) && sem(n).split(/[^A-Z0-9]+/).includes(w))).map(([id]) => id));
  if (!alvoI.size && !/INDUSTRI|FORNECEDOR|FABRICANTE|PREMIA/.test(t)) return null;   /* meta sem industria = meta da filial/vendedor (outra resposta) */
  const G = new Map();   // id -> { meta, metaPos, fat, vend, pos, posV, porVend: Map }
  const g = (id) => { if (!G.has(id)) G.set(id, { meta: 0, metaPos: 0, fat: 0, ven: 0, pos: 0, posV: 0, pv: new Map() }); return G.get(id); };
  const gv = (x, c) => { if (!x.pv.has(c)) x.pv.set(c, { meta: 0, metaPos: 0, fat: 0, ven: 0, pos: 0 }); return x.pv.get(c); };
  for (const [c, id, , tipo, meta] of RV.metas) if (dentro(c) && (!alvoI.size || alvoI.has(id))) { const x = g(id), y = gv(x, c); if (tipo === 1) { x.meta += meta; y.meta += meta; } else { x.metaPos += meta; y.metaPos += meta; } }
  for (const [c, id, ff, fv, pf, pv] of RV.apu) if (dentro(c) && G.has(id)) { const x = G.get(id), y = gv(x, c); x.fat += ff; x.ven += fv; x.pos += pf; x.posV += pv; y.fat += ff; y.ven += fv; y.pos += pf; }
  const L = [...G].filter(([, x]) => x.meta > 0 || x.metaPos > 0);
  const corte = RV.cutoff ? RV.cutoff.split('-').reverse().slice(0, 2).join('/') : '?';
  const cab = `🏆 *Metas das indústrias — ${quem}* · ${MESES[+RV.mes.slice(5, 7)]} · _apuração até ${corte}_`;
  // filial de cada codigo (Gestao de Equipe): para o Brasil por filial e para dizer onde a industria tem meta
  const mo = await B.mostra(); const filDe = new Map(); for (const [k, Lm] of Object.entries((mo && mo.filiais) || {})) for (const v of Lm) filDe.set(String(v.rca), k.split('_')[0]);
  if (!L.length) {
    if (!alvoI.size) return `${cab}\nNenhuma meta por indústria cadastrada para ${quem} neste mês.`;
    const onde = [...new Set(RV.metas.filter((m) => alvoI.has(m[1]) && m[3] === 1).map((m) => filDe.get(m[0]) || 'fora da Gestão'))].sort();
    return `${cab}\nNenhuma meta de *${[...alvoI].map((i) => nomeForn(nomes.get(i))).join(', ')}* para ${quem} neste mês.${onde.length ? ` Essa indústria tem meta em: *${onde.join(', ')}*.` : ''}`;
  }
  const sel = (x) => (x.fat >= x.meta && x.meta ? '✅' : x.meta && x.fat / x.meta >= 0.8 ? '🟡' : '🔴');
  const linha = (n, x) => `${sel(x)} *${n}*: faturado ${R$(x.fat)} de ${R$(x.meta)} (${P(x.fat, x.meta)})${x.ven > x.fat ? ` · vendido ${R$(x.ven)} (${P(x.ven, x.meta)})` : ''}${x.metaPos ? ` · positivação ${N(x.pos)}/${N(x.metaPos)} (${P(x.pos, x.metaPos)})` : ''}`;
  if (alvoI.size) {   /* industria citada: total + quem esta puxando */
    const out = [cab];
    for (const [id, x] of L) {
      out.push('', linha(nomeForn(nomes.get(id)), x));
      if (x.pv.size > 1 && E.nacional && !pessoa) {   /* Brasil: por filial (soma dos vendedores, sem rateio) */
        const pf = new Map(); for (const [c, y] of x.pv) { const f = filDe.get(c) || 'fora da Gestão'; const z = pf.get(f) || { meta: 0, fat: 0 }; z.meta += y.meta; z.fat += y.fat; pf.set(f, z); }
        const lf = [...pf].filter(([, y]) => y.meta > 0).sort((a, b) => b[1].fat / b[1].meta - a[1].fat / a[1].meta);
        out.push(`*Por filial* (${lf.filter(([, y]) => y.fat >= y.meta).length} de ${lf.length} já bateram o faturado):`, ...lf.map(([f, y]) => `• ${f}: ${R$(y.fat)} de ${R$(y.meta)} (${P(y.fat, y.meta)})`));
      } else if (x.pv.size > 1) {
        const nm = new Map(E.vend.map((v) => [String(v.rca), v]));
        const pv = [...x.pv].filter(([, y]) => y.meta > 0).sort((a, b) => b[1].fat / (b[1].meta || 1) - a[1].fat / (a[1].meta || 1));
        out.push(`*Por vendedor* (${pv.filter(([, y]) => y.fat >= y.meta).length} de ${pv.length} já bateram o faturado):`, ...pv.slice(0, 8).map(([c, y]) => `• ${nm.get(c) ? vn(nm.get(c)) : 'RCA ' + c}: ${R$(y.fat)} de ${R$(y.meta)} (${P(y.fat, y.meta)})`));
        if (pv.length > 8) out.push(`… e mais ${pv.length - 8}. Os mais longe da meta: ${pv.slice(-3).map(([c]) => (nm.get(c) ? nome2(nm.get(c).nome) : 'RCA ' + c)).join(', ')}.`);
      }
    }
    out.push('', SUGESTAO + 'cobrar primeiro quem tem meta alta e está longe; peça "quem comprava ' + nomeForn(nomes.get([...alvoI][0])) + ' e parou" para a lista de clientes.', '_Vendido = faturado + a faturar. Valor oficial do prêmio = fechamento do mês._');
    return out.join('\n');
  }
  const ord = L.sort((a, b) => b[1].meta - a[1].meta);
  const bat = ord.filter(([, x]) => x.meta && x.fat >= x.meta).length, comMeta = ord.filter(([, x]) => x.meta).length;
  const tot = ord.reduce((a, [, x]) => ({ m: a.m + x.meta, f: a.f + x.fat, v: a.v + x.ven }), { m: 0, f: 0, v: 0 });
  return [cab, `*${bat} de ${comMeta} indústrias* com o faturado já batido · total ${R$(tot.f)} de ${R$(tot.m)} (${P(tot.f, tot.m)})${tot.v > tot.f ? ` · vendido ${R$(tot.v)} (${P(tot.v, tot.m)})` : ''}`, '',
    ...ord.slice(0, 15).map(([id, x]) => linha(nomeForn(nomes.get(id)), x)), ord.length > 15 ? `… e mais ${ord.length - 15} indústrias.` : '',
    '', SUGESTAO + 'pergunte "como está a meta da <indústria>" para ver quem está puxando para baixo.', '_✅ batida · 🟡 80% ou mais · 🔴 abaixo de 80% (faturado). Vendido = faturado + a faturar._'].filter((x) => x !== '').join('\n');
}
// DIA DA SEMANA / SEMANA A SEMANA / MES A MES de um produto ou industria (Vitorio, 25/10/2026: diretor apresentando para a industria:
// "qual dia mais vende o produto x? tem algum vendedor especifico? como estao as vendas mensais? e semanais?")
export const DSEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const dUtc = (d) => new Date(Date.UTC(Math.floor(d / 10000), Math.floor(d / 100) % 100 - 1, d % 100));
export async function extrasTempo(B, E, L, t, filtroLinha) {
  const out = [];
  if (/DIA DA SEMANA|QUAL DIA|QUE DIA|DIAS? (QUE |EM QUE )?(MAIS|MELHOR)|MELHOR DIA|DIA QUE MAIS|(SEGUNDA|TERCA|QUARTA|QUINTA|SEXTA|SABADO) OU /.test(t)) {
    const W = Array.from({ length: 7 }, () => ({ v: 0, dias: new Set() }));
    for (const l of L) { const w = dUtc(l.d).getUTCDay(); W[w].v += l.v; W[w].dias.add(l.d); }
    const R0 = W.map((x, i) => ({ i, v: x.v, n: x.dias.size, med: x.dias.size ? x.v / x.dias.size : 0 })).filter((x) => x.n);
    const top = [...R0].sort((a, b) => b.med - a.med);
    if (top.length) out.push('', `*Dia da semana (média por dia com venda):* o melhor é *${DSEM[top[0].i]}*`, ...R0.map((x) => `• ${DSEM[x.i]}: ${R$(x.med)}/dia · ${R$(x.v)} em ${x.n} dia(s)`));
  }
  if (/SEMANA(L|IS)|POR SEMANA|SEMANA A SEMANA|CADA SEMANA/.test(t)) {
    const S = new Map(); for (const l of L) { const d = dUtc(l.d); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); const k = d.toISOString().slice(0, 10); S.set(k, (S.get(k) || 0) + l.v); }
    const ini = dUtc(L.reduce((m, l) => Math.min(m, l.d), 99999999)).toISOString().slice(0, 10);
    out.push('', '*Semana a semana (segunda a domingo):*', ...[...S].sort().map(([k, v]) => { const d0 = k < ini ? ini : k; return `• semana de ${d0.slice(8, 10)}/${d0.slice(5, 7)}: ${R$(v)}`; }));
  }
  if (/MENSA|MES A MES|POR MES|CADA MES/.test(t)) {
    const Z = await vendasAnterior(B, E);
    const ateA = L.reduce((m, l) => Math.max(m, l.d), 0), dia = ateA % 100;
    const tA = L.reduce((a, l) => a + l.v, 0);
    if (Z) { const LZ = Z.linhas.filter((l) => filtroLinha(l, Z.prod));   /* catalogo do proprio mes passado: produto que nao vendeu neste mes tambem conta */ const tZ = LZ.reduce((a, l) => a + l.v, 0), tZd = LZ.filter((l) => l.d % 100 <= dia).reduce((a, l) => a + l.v, 0);
      out.push('', '*Mês a mês:*', `• este mês até dia ${dia}: ${R$(tA)}`, `• mês passado até o mesmo dia: ${R$(tZd)} (${delta(tA, tZd)})`, `• mês passado inteiro: ${R$(tZ)}`); }
    else out.push('', '_Mês passado item a item ainda não publicado: o mês a mês sai assim que ele chegar._');
  }
  return out;
}

// KPIs DA PREMIACAO (Vitorio, 26/10/2026: Allison perguntou meta de mix, ticket medio e faseamento e o JOTA nao sabia). Regras lidas do proprio codigo da Premiacao
// (mapa.drivetriunfante-lastmile.com.br/rv/Apuracao_RV.html): Ticket medio (MC/KA) = Meta Faturamento / Meta Positivacao, realizado = faturado / positivados;
// Faseamento (MC/KA) = 60% da meta de faturamento, faturado ate o dia 20 (cutoff da Premiacao); Mix = itens por cliente (meta por industria = media 3 meses + 5%);
// Recorrencia (so Varejo, no lugar do ticket medio) = meta 80% dos clientes com a tag RECORRENCIA na carteira do mes.
export async function respKpisPremiacao(B, E, t, pessoa) {
  const RV = await B.rv();
  if (!RV) return '🏆 _A Premiação não respondeu agora. Tente em alguns minutos._';
  let vend = E.vend, quem = E.nome;
  if (pessoa && pessoa.tipo === 'vend') { vend = [pessoa.alvo]; quem = vn(pessoa.alvo); }
  else if (pessoa && pessoa.tipo === 'sup') { vend = E.vend.filter((v) => v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial); quem = 'Equipe ' + nome2(pessoa.alvo.nome); }
  const cods = new Set(vend.map((v) => String(v.rca))), ehAS = (v) => /^(AS|PET AS)$/i.test(String(v.canal || ''));
  const codAS = new Set(vend.filter(ehAS).map((v) => String(v.rca)));
  let metaFat = 0, metaFatAS = 0, fat = 0, fase = 0;
  for (const [c, , , tipo, m] of RV.metas || []) if (tipo === 1 && cods.has(c)) { metaFat += m; if (codAS.has(c)) metaFatAS += m; }
  for (const a of RV.apu || []) if (cods.has(a[0])) { fat += a[2]; if (codAS.has(a[0])) fase += a[6] || 0; }
  const metaPos = vend.reduce((s, v) => s + (Number(v.metaPos) || 0), 0), pos = vend.reduce((s, v) => s + ((RV.posV && RV.posV[String(v.rca)]) ?? (Number(v.pos) || 0)), 0);
  const pc = (r, m) => (m > 0 ? ' → *' + (r / m * 100).toFixed(1).replace('.', ',') + '%*' : '');
  const L = [`🏆 *Metas da Premiação — ${quem}* (${RV.mes}${RV.cutoff ? ', apuração até ' + RV.cutoff.slice(8, 10) + '/' + RV.cutoff.slice(5, 7) : ''})`, ''];
  L.push(`💰 *Faturamento:* ${R$(fat)} de ${R$(metaFat)}${pc(fat, metaFat)}`);
  L.push(`👥 *Positivação:* ${N(pos)} de ${N(Math.round(metaPos))} clientes${pc(pos, metaPos)}`);
  if (codAS.size) {
    const metaTM = metaPos > 0 ? metaFat / metaPos : null, tm = pos > 0 ? fat / pos : null;
    L.push(`🧾 *Ticket médio (AS):* ${tm != null ? R$(tm) : 'sem dado'} de ${metaTM != null ? R$(metaTM) : 'sem meta'}${tm != null && metaTM ? pc(tm, metaTM) : ''} _(meta = meta de faturamento ÷ meta de positivação)_`);
    L.push(`📅 *Faseamento (AS):* ${R$(fase)} de ${R$(metaFatAS * 0.6)}${pc(fase, metaFatAS * 0.6)} _(60% da meta de faturamento até o dia 20)_`);
  }
  // mix: realizado do vendedor; meta por industria (Premiacao) so quando o vendedor e citado
  const mixR = vend.map((v) => [v, RV.mixV && RV.mixV[String(v.rca)]]).filter((x) => x[1] != null);
  if (vend.length === 1 && mixR.length) {
    const M = (RV.tmmix || []).filter((x) => x[0] === String(vend[0].rca) && x[3] > 0).sort((a, b) => b[3] - a[3]);
    L.push(`🧺 *Mix:* ${String(mixR[0][1]).replace('.', ',')} itens por cliente` + (M.length ? ` · meta por indústria: ${M.slice(0, 6).map((x) => `${nomeForn(x[1])} ${Math.round(x[3])}`).join(' · ')}` : ''));
  } else if (mixR.length) L.push(`🧺 *Mix (itens por cliente):* ${mixR.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v, m]) => `${nome2(v.nome)} ${String(m).replace('.', ',')}`).join(' · ')}`, '_A meta de mix na Premiação é por indústria e por vendedor (média dos 3 últimos meses + 5%); peça "meta de mix do vendedor 59" para ver a de cada um._');
  // recorrencia (varejo): carteira do mes com a tag RECORRENCIA
  const VR = vend.filter((v) => !ehAS(v) && Array.isArray(v.roteiroMes) && v.roteiroMes.length);
  if (VR.length) {
    const ini = RV.mes + '-01'; let uni = 0, real = 0;
    for (const v of VR) { const cli = new Map(); for (const c of v.roteiroMes) if ((c.focos || []).some((f) => /RECORRENCIA/i.test(f.industria_foco || ''))) { const u = String(c.data_ultima_compra || '').slice(0, 10); const k = String(c.id_cliente); if (!cli.has(k) || u > cli.get(k)) cli.set(k, u); } uni += cli.size; real += [...cli.values()].filter((u) => u >= ini).length; }
    if (uni) L.push(`🔄 *Recorrência (varejo):* ${N(real)} de ${N(Math.ceil(uni * 0.8))} clientes${pc(real, Math.ceil(uni * 0.8))} _(meta 80% dos ${N(uni)} clientes com a tag)_`);
  } else if (vend.some((v) => !ehAS(v))) L.push('🔄 *Recorrência (varejo):* _carteira do mês ainda sendo lida na base; peça de novo mais tarde._');
  // o KPI perguntado vem primeiro (26/10/2026: 'foco em mix' trazia o mix no meio)
  { const alvo = /\bMIX\b/.test(t) ? '🧺' : /TICKET/.test(t) ? '🧾' : /FASEAMENTO|FASIAMENTO/.test(t) ? '📅' : /RECORRENCIA/.test(t) ? '🔄' : null;
    if (alvo) { const i = L.findIndex((x) => x.startsWith(alvo)); if (i > 2) { const tira = L.splice(i, L[i + 1] && L[i + 1].startsWith('_') ? 2 : 1); L.splice(2, 0, ...tira, ''); } } }
  L.push('', SUGESTAO + (metaFat > fat ? `faltam ${R$(metaFat - fat)} de faturamento para a meta da Premiação.` : 'meta de faturamento da Premiação batida; buscar os outros KPIs.'));
  return L.join('\n');
}
