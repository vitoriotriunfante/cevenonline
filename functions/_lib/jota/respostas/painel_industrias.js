// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/jota/respostas/painel_industrias.js
// O QUE É: PAINEL DAS INDÚSTRIAS para a diretoria (sugestões do Rudinei, 09/11/2026 12:06 e 12:08; Vitorio 10/11/2026: 'taca o pau, monta').
//   Navegação por número: Brasil → Filial → Indústria → Supervisor → Vendedor (0 volta um nível).
//   Em cada nível, dois blocos: 💰 VENDAS (meta, faturado, a faturar, vendido, %, falta, média/dia, necessidade/dia)
//   e 👥 POSITIVAÇÃO (meta de clientes, positivados, %, faltam, média/dia, necessidade/dia).
//   TODAS as indústrias com venda entram; sem meta = "Sem meta cadastrada".
// FONTES (Vitorio, 10/11/2026: 'auditar GEROT x CEVEN e CEVEN x GEROT... pegar das duas fontes'):
//   GEROT (D1 gerot_vendas) = meta R$, faturado, carteira, positivação realizada; CEVEN (Premiação) = meta de clientes e positivação do CEVEN.
//   Quando as duas fontes divergem, mostra as duas (nunca escolhe uma em silêncio). O GEROT não traz meta de clientes (vazia de ago a nov/2026).
// DIAS: média = dias úteis (seg-sex) decorridos do dia 1 até ontem; necessidade = dias úteis de hoje até o dia 20 (fim da apuração).
// Nunca inventa: sem dado = "sem dado".
// =========================================================================
import { R$, N, titulo, nome2, FILIAIS, hojeSP } from '../base.js';
import { nomeForn } from './metas_industria.js';

const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const F = (d, k) => { const v = d && d[k]; return typeof v === 'number' ? v : (v == null || v === '' ? null : Number(v)); };
const qd = (x) => (x >= 100 ? N(Math.round(x)) : x.toFixed(1).replace('.', ','));
const pc = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '—');
const uteis = (y, m, d1, d2) => { let n = 0; for (let d = d1; d <= d2; d++) { const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); if (w > 0 && w < 6) n++; } return n; };
const FIM_APURACAO = 20;

function dias(mes) {
  const hoje = hojeSP(), [y, m] = mes.split('-').map(Number), fimMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (hoje.slice(0, 7) !== mes) return { passado: true, decorridos: uteis(y, m, 1, fimMes), restantes: 0 };   // mes fechado: media sobre os dias uteis do mes inteiro
  const d = Number(hoje.slice(8, 10));
  return { passado: false, decorridos: Math.max(1, uteis(y, m, 1, d - 1)), restantes: d <= FIM_APURACAO ? uteis(y, m, d, FIM_APURACAO) : 0 };
}

// carrega GEROT + CEVEN do mes e devolve linhas normalizadas por vendedor x industria
async function base(env, B, mes, filial) {
  const db = env.DB;
  const where = filial ? 'mes = ? AND filial = ?' : 'mes = ?', bind = filial ? [mes, filial] : [mes];
  const { results } = await db.prepare(`SELECT filial, rca, vendedor, cod_sup, supervisor, dados FROM gerot_vendas WHERE ${where}`).bind(...bind).all();
  const L = [];
  for (const r of results || []) { let d = {}; try { d = JSON.parse(r.dados || '{}'); } catch (e) { continue; }
    L.push({ filial: r.filial, rca: String(r.rca), vend: r.vendedor || '', sup: String(r.cod_sup || ''), supNome: r.supervisor || '', ind: nomeForn(d.Fornecedor), meta: F(d, 'Meta (R$)') || 0, fat: F(d, 'Faturado líquido (R$)') || 0, cart: F(d, 'Carteira pendente (R$)') || 0, posG: F(d, 'Positivação (filial + CNPJ)') || 0, metaPosC: 0, posC: 0, fatC: 0, temC: false }); }
  // CEVEN (Premiacao): so o mes atual; codigo do vendedor -> filial pela Gestao de Equipe
  let cevenMes = null;
  try {
    const RV = B && B.rv ? await B.rv() : null;
    if (RV && RV.mes && RV.mes.slice(0, 7) === mes) {
      cevenMes = RV.mes.slice(0, 7);
      const mo = await B.mostra(), filDe = new Map(), nomeDe = new Map(); for (const [k, Lm] of Object.entries((mo && mo.filiais) || {})) for (const v of Lm) { filDe.set(String(v.rca), k.split('_')[0]); nomeDe.set(String(v.rca), v.nome || ''); }
      const nomes = new Map(); for (const m of RV.metas) if (!nomes.has(m[1])) nomes.set(m[1], m[2]);
      const idx = new Map(); for (const x of L) idx.set(x.filial + '|' + x.rca + '|' + x.ind, x);
      const pega = (c, id) => { const fl = filDe.get(String(c)); if (!fl || (filial && fl !== filial)) return null; const ind = nomeForn(nomes.get(id)), k = fl + '|' + c + '|' + ind;
        if (!idx.has(k)) { const g = L.find((y) => y.filial === fl && y.rca === String(c)) || {}; const x = { filial: fl, rca: String(c), vend: g.vend || nomeDe.get(String(c)) || '', sup: g.sup || '', supNome: g.supNome || '', ind, meta: 0, fat: 0, cart: 0, posG: 0, metaPosC: 0, posC: 0, fatC: 0, temC: false, soCeven: true }; idx.set(k, x); L.push(x); }
        const x = idx.get(k); x.temC = true; return x; };
      for (const [c, id, , tipo, meta] of RV.metas) if (tipo !== 1) { const x = pega(c, id); if (x) x.metaPosC += Number(meta) || 0; }
      for (const [c, id, ff, , pf] of RV.apu) { const x = pega(c, id); if (x) { x.posC += Number(pf) || 0; x.fatC += Number(ff) || 0; } }
    }
  } catch (e) { /* sem CEVEN: so GEROT */ }
  return { L, cevenMes };
}

const soma = (rs) => rs.reduce((a, x) => ({ meta: a.meta + x.meta, fat: a.fat + x.fat, cart: a.cart + x.cart, posG: a.posG + x.posG, metaPosC: a.metaPosC + x.metaPosC, posC: a.posC + x.posC, fatC: a.fatC + x.fatC, temC: a.temC || x.temC }),
  { meta: 0, fat: 0, cart: 0, posG: 0, metaPosC: 0, posC: 0, fatC: 0, temC: false });

// os dois blocos do Rudinei
function blocos(g, D, cevenOk) {
  const vend = g.fat + g.cart, falta = Math.max(0, g.meta - g.fat);
  const L = ['💰 *Vendas*'];
  if (g.meta > 0) L.push(`Meta *${R$(g.meta)}* · faturado *${R$(g.fat)}* (${pc(g.fat, g.meta)}) · a faturar ${R$(g.cart)}`, `Vendido (fat. + a faturar) *${R$(vend)}* (${pc(vend, g.meta)}) · falta *${R$(falta)}*`);
  else L.push(`_Sem meta cadastrada_ · faturado *${R$(g.fat)}* · a faturar ${R$(g.cart)} · vendido *${R$(vend)}*`);
  L.push(`Média *${R$(g.fat / D.decorridos)}*/dia útil` + (D.passado ? ' (mês fechado)' : g.meta > 0 ? (D.restantes ? ` · precisa *${R$(falta / D.restantes)}*/dia útil (${D.restantes} até dia ${FIM_APURACAO})` : ' · apuração encerrada') : ''));
  // positivação: realizado GEROT; meta de clientes do CEVEN
  const meta = g.metaPosC, real = g.posG, faltaP = Math.max(0, meta - real);
  L.push('👥 *Positivação*');
  if (meta > 0) L.push(`Meta *${N(meta)}* clientes (CEVEN) · positivados *${N(real)}* (${pc(real, meta)}) · faltam *${N(faltaP)}*`);
  else L.push(`Positivados *${N(real)}*` + (cevenOk ? ' · _sem meta de clientes no CEVEN_' : ' · _meta de clientes: sem dado (o GEROT não traz; o CEVEN só tem o mês atual)_'));
  L.push(`Média *${qd(real / D.decorridos)}*/dia útil` + (!D.passado && meta > 0 && D.restantes ? ` · precisa *${qd(faltaP / D.restantes)}*/dia útil` : ''));
  // AUDITORIA GEROT x CEVEN (Vitorio, 10/11/2026): diferenca entre as fontes aparece, nunca some
  if (cevenOk && g.temC) {
    const dPos = g.posC - real, dFat = g.fatC - g.fat;
    if (dPos || Math.abs(dFat) >= 1) L.push(`🔎 _GEROT x CEVEN:_ positivados GEROT ${N(real)} x CEVEN ${N(g.posC)}${dPos ? ` (${dPos > 0 ? '+' : ''}${N(dPos)})` : ' ✅'} · faturado GEROT ${R$(g.fat)} x CEVEN ${R$(g.fatC)}${Math.abs(dFat) >= 1 ? ` (${dFat > 0 ? '+' : ''}${R$(dFat)})` : ' ✅'}`);
    else L.push('🔎 _GEROT x CEVEN: iguais ✅_');
  }
  return L;
}
const linhaCurta = (rot, g) => `*${rot}*: ${g.meta > 0 ? `${R$(g.fat)} de ${R$(g.meta)} (${pc(g.fat, g.meta)}) · vendido ${pc(g.fat + g.cart, g.meta)}` : `${R$(g.fat)} · _sem meta_`}${g.metaPosC > 0 ? ` · ${N(g.posG)}/${N(g.metaPosC)} cli.` : g.posG ? ` · ${N(g.posG)} cli.` : ''}`;
const agrupa = (rs, k) => { const m = new Map(); for (const x of rs) { const c = k(x); if (!m.has(c)) m.set(c, []); m.get(c).push(x); } return m; };
const ordemInd = (a, b) => (b[1].meta > 0) - (a[1].meta > 0) || b[1].meta - a[1].meta || b[1].fat - a[1].fat;

// caminho: { mes, fil, ind, sup, rca }  -> texto com marcador 〔G:mes|fil|ind|sup|rca〕
export async function respPainelIndustrias(env, B, cam) {
  if (!env || !env.DB) return null;
  const mes = cam.mes || hojeSP().slice(0, 7), D = dias(mes), nm = NOME_MES[Number(mes.slice(5)) - 1];
  const { L, cevenMes } = await base(env, B, mes, cam.fil || null), cevenOk = !!cevenMes;
  const mk = `〔G:${mes}|${cam.fil || ''}|${cam.ind || ''}|${cam.sup || ''}|${cam.rca || ''}〕`;
  const st = await env.DB.prepare('SELECT posicao FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first().catch(() => null);
  const fonte = `_Fonte: GEROT${st && st.posicao ? ' (' + st.posicao.replace(/^Atual\s*·\s*/, 'posição ') + ')' : ''} · meta de clientes: CEVEN${cevenOk ? '' : ' (só no mês atual)'} · média = dias úteis decorridos; necessidade = dias úteis até o dia ${FIM_APURACAO}._`;
  if (!L.length) return `🏭 *Painel das indústrias* · ${nm}\nNão há linha no GEROT para esse recorte e mês. Não vou estimar.\n\n${fonte}`;
  let rs = L; if (cam.ind) rs = rs.filter((x) => x.ind === cam.ind); if (cam.sup) rs = rs.filter((x) => x.sup === cam.sup); if (cam.rca) rs = rs.filter((x) => x.rca === cam.rca);
  const out = [];
  // NIVEL 4: vendedor
  if (cam.rca) {
    const x0 = rs[0] || {}; out.push(`🏭 *${cam.ind} — ${cam.rca} - ${nome2(x0.vend || '')}* (${cam.fil}) · ${nm}`, ...blocos(soma(rs), D, cevenOk), '', '*0* Voltar ao supervisor');
  } else if (cam.sup) {
    // NIVEL 3: supervisor -> vendedores
    const x0 = rs[0] || {}; const vs = [...agrupa(rs, (x) => x.rca)].map(([k, v]) => [k, soma(v), v[0]]).sort((a, b) => (b[1].meta ? b[1].fat / b[1].meta : -1) - (a[1].meta ? a[1].fat / a[1].meta : -1) || b[1].fat - a[1].fat);
    out.push(`🏭 *${cam.ind} — sup. ${cam.sup} - ${nome2(x0.supNome || '')}* (${cam.fil}) · ${nm}`, ...blocos(soma(rs), D, cevenOk), '', `*Vendedores (${vs.length}):*`,
      ...vs.map(([k, g, x], i) => `${i + 1}. ${linhaCurta(`${k} - ${nome2(x.vend)}`, g)}`));
    const comMeta = vs.filter(([, g]) => g.meta > 0), zero = vs.filter(([, g]) => !(g.fat > 0) && !(g.cart > 0)), baixa = vs.filter(([, g]) => g.metaPosC > 0 && g.posG / g.metaPosC < 0.3);
    out.push('', '📌 *Sinais:*');
    if (comMeta.length) out.push(`• Melhor: ${comMeta[0][0]} - ${nome2(comMeta[0][2].vend)} (${pc(comMeta[0][1].fat, comMeta[0][1].meta)}) · pior: ${comMeta[comMeta.length - 1][0]} - ${nome2(comMeta[comMeta.length - 1][2].vend)} (${pc(comMeta[comMeta.length - 1][1].fat, comMeta[comMeta.length - 1][1].meta)})`);
    out.push(zero.length ? `• Sem venda dessa indústria (${zero.length}): ${zero.map(([k, , x]) => k + ' - ' + nome2(x.vend)).join(', ')}` : '• Todos com venda ou pedido dessa indústria ✅');
    if (baixa.length) out.push(`• Positivação abaixo de 30% da meta (${baixa.length}): ${baixa.map(([k, , x]) => k + ' - ' + nome2(x.vend)).join(', ')}`);
    const opp = comMeta.map(([k, g, x]) => [k, x, Math.max(0, g.meta - g.fat - g.cart)]).sort((a, b) => b[2] - a[2]).filter((y) => y[2] > 0).slice(0, 3);
    if (opp.length) out.push(`• Maior oportunidade (falta com carteira): ${opp.map(([k, x, f]) => `${k} - ${nome2(x.vend)} ${R$(f)}`).join(' · ')}`);
    out.push('', '👉 *Digite o número do vendedor* para abrir · *0* volta à indústria');
  } else if (cam.ind && !cam.fil) {
    // INDUSTRIA NO BRASIL (pergunta com industria citada e sem filial): blocos + filiais numeradas
    const fs2 = [...agrupa(rs, (x) => x.filial)].map(([k, v]) => [k, soma(v)]).filter(([, g]) => g.meta > 0 || g.fat || g.cart).sort((a, b) => FILIAIS.indexOf(a[0]) - FILIAIS.indexOf(b[0]));
    out.push(`🏭 *${cam.ind} — Brasil* · ${nm}`, ...blocos(soma(rs), D, cevenOk), '', '*Filiais:*', ...fs2.map(([k, g], i) => `${i + 1}. ${linhaCurta(k, g)}`),
      '', '👉 *Digite o número da filial* para abrir por supervisor · *0* volta ao painel');
  } else if (cam.ind) {
    // NIVEL 2: filial + industria -> supervisores
    const ss = [...agrupa(rs, (x) => x.sup)].map(([k, v]) => [k, soma(v), v[0], v]).sort((a, b) => b[1].fat - a[1].fat);
    const zeroV = [...agrupa(rs, (x) => x.rca)].filter(([, v]) => { const g = soma(v); return !(g.fat > 0) && !(g.cart > 0); });
    out.push(`🏭 *${cam.ind} — ${cam.fil}* · ${nm}`, ...blocos(soma(rs), D, cevenOk), '', `*Supervisores (${ss.length}):*`,
      ...ss.map(([k, g, x], i) => `${i + 1}. ${linhaCurta(`${k ? k + ' - ' : ''}${nome2(x.supNome || 'sem supervisor')}`, g)}`),
      '', zeroV.length ? `📌 Vendedores sem venda dessa indústria na filial: *${zeroV.length}*` : '📌 Todos os vendedores com venda ou pedido dessa indústria ✅',
      '', '👉 *Digite o número do supervisor* para abrir a equipe · *0* volta à filial');
  } else if (cam.fil) {
    // NIVEL 1: filial -> industrias (com meta primeiro; depois as sem meta, todas com venda)
    const is = [...agrupa(rs, (x) => x.ind)].map(([k, v]) => [k, soma(v)]).filter(([, g]) => g.meta > 0 || g.fat > 0 || g.cart > 0).sort(ordemInd);
    const com = is.filter(([, g]) => g.meta > 0), semM = is.filter(([, g]) => !(g.meta > 0));
    out.push(`🏭 *Indústrias — ${cam.fil}* · ${nm}`, ...blocos(soma(rs), D, cevenOk), '', `*Com meta (${com.length}):*`, ...com.map(([k, g], i) => `${i + 1}. ${linhaCurta(k, g)}`));
    if (semM.length) out.push('', `*Sem meta cadastrada, com venda (${semM.length}):*`, ...semM.map(([k, g], i) => `${com.length + i + 1}. ${linhaCurta(k, g)}`));
    out.push('', '👉 *Digite o número da indústria* para abrir por supervisor · *0* volta ao Brasil');
  } else {
    // NIVEL 0: Brasil -> filiais
    const fs = [...agrupa(rs, (x) => x.filial)].map(([k, v]) => [k, soma(v)]).sort((a, b) => FILIAIS.indexOf(a[0]) - FILIAIS.indexOf(b[0]));
    out.push(`🏭 *Painel das indústrias — Brasil* · ${nm}`, ...blocos(soma(rs), D, cevenOk), '', '*Filiais:*', ...fs.map(([k, g], i) => `${i + 1}. ${linhaCurta(k, g)}`),
      '', '👉 *Digite o número da filial* para abrir as indústrias dela. Para outro mês: *painel das indústrias de outubro*.');
  }
  out.push('', fonte, mk);
  return out.join('\n');
}

// numero digitado depois de um nivel do painel: desce (1..n) ou sobe (0)
export async function respPainelNumero(env, B, marcador, k) {
  const [mes, fil, ind, sup, rca] = marcador.split('|');
  if (k === 0) { if (rca) return respPainelIndustrias(env, B, { mes, fil, ind, sup }); if (sup) return respPainelIndustrias(env, B, { mes, fil, ind }); if (ind && fil) return respPainelIndustrias(env, B, { mes, fil }); return respPainelIndustrias(env, B, { mes }); }
  const { L } = await base(env, B, mes, fil || null);
  let rs = L; if (ind) rs = rs.filter((x) => x.ind === ind); if (sup) rs = rs.filter((x) => x.sup === sup);
  if (rca) return null;
  if (sup) { const vs = [...agrupa(rs, (x) => x.rca)].map(([k2, v]) => [k2, soma(v)]).sort((a, b) => (b[1].meta ? b[1].fat / b[1].meta : -1) - (a[1].meta ? a[1].fat / a[1].meta : -1) || b[1].fat - a[1].fat); const x = vs[k - 1]; return x ? respPainelIndustrias(env, B, { mes, fil, ind, sup, rca: x[0] }) : null; }
  if (ind && !fil) { const fs2 = [...agrupa(rs, (x) => x.filial)].map(([k2, v]) => [k2, soma(v)]).filter(([, g]) => g.meta > 0 || g.fat || g.cart).map(([k2]) => k2).sort((a, b) => FILIAIS.indexOf(a) - FILIAIS.indexOf(b)); const x = fs2[k - 1]; return x ? respPainelIndustrias(env, B, { mes, fil: x, ind }) : null; }
  if (ind) { const ss = [...agrupa(rs, (x) => x.sup)].map(([k2, v]) => [k2, soma(v)]).sort((a, b) => b[1].fat - a[1].fat); const x = ss[k - 1]; return x ? respPainelIndustrias(env, B, { mes, fil, ind, sup: x[0] }) : null; }
  if (fil) { const is = [...agrupa(rs, (x) => x.ind)].map(([k2, v]) => [k2, soma(v)]).filter(([, g]) => g.meta > 0 || g.fat > 0 || g.cart > 0).sort(ordemInd); const x = is[k - 1]; return x ? respPainelIndustrias(env, B, { mes, fil, ind: x[0] }) : null; }
  const fs = [...agrupa(rs, (x) => x.filial)].map(([k2]) => k2).sort((a, b) => FILIAIS.indexOf(a) - FILIAIS.indexOf(b)); const x = fs[k - 1];
  return x ? respPainelIndustrias(env, B, { mes, fil: x }) : null;
}
