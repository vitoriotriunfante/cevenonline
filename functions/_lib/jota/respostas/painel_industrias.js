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
// DIAS: média = dias úteis (seg-sex) decorridos do dia 1 até ontem; necessidade = dias úteis de hoje até o FIM DO MÊS (17/11/2026, Vitório: "até dia 20? de onde tirou isso" — dia 20 é só o faseamento do AS).
// Nunca inventa: sem dado = "sem dado".
// =========================================================================
import { R$, N, titulo, nome2, FILIAIS, hojeSP, sem } from '../base.js';
import { nomeForn } from './metas_industria.js';
import { ehFeriado } from '../../feriados.js';

const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const F = (d, k) => { const v = d && d[k]; return typeof v === 'number' ? v : (v == null || v === '' ? null : Number(v)); };
const qd = (x) => (x >= 100 ? N(Math.round(x)) : x.toFixed(1).replace('.', ','));
const pc = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '—');
const uteis = (y, m, d1, d2) => { let n = 0; for (let d = d1; d <= d2; d++) { const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); if (w > 0 && w < 6 && !ehFeriado(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)) n++; } return n; };   // 11/11/2026: feriado (20/11) nao e dia util

function dias(mes) {
  const hoje = hojeSP(), [y, m] = mes.split('-').map(Number), fimMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (hoje.slice(0, 7) !== mes) return { passado: true, decorridos: uteis(y, m, 1, fimMes), restantes: 0 };   // mes fechado: media sobre os dias uteis do mes inteiro
  const d = Number(hoje.slice(8, 10));
  return { passado: false, decorridos: Math.max(1, uteis(y, m, 1, d - 1)), restantes: uteis(y, m, d, fimMes) };
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
// POSITIVACAO REAL de varias industrias juntas (17/11/2026, auditoria: o total somava a positivacao de cada industria e o cliente que comprou de 3 industrias contava 3 vezes;
// TPH mostrava 3.967 com 1.750 clientes reais). Brasil/filial/equipe/vendedor = clientes distintos do GEROT (gerot_*_mes), com a meta de positivacao.
export async function posReal(env, mes, cam) {
  try {
    const db = env.DB, P = '"Positivação (filial + CNPJ)"', M = '"Meta de positivação"';
    const sel = (t) => `SELECT SUM(json_extract(dados, '$.${P}')) p, SUM(json_extract(dados, '$.${M}')) m FROM ${t} WHERE mes = ?`;
    let r;
    if (cam.rca) r = await db.prepare(sel('gerot_vendedor_mes') + ' AND filial = ? AND rca = ?').bind(mes, cam.fil, String(cam.rca)).first();
    else if (cam.sup) r = await db.prepare(sel('gerot_supervisor_mes') + ' AND filial = ? AND cod_sup = ?').bind(mes, cam.fil, String(cam.sup)).first();
    else if (cam.fil) r = await db.prepare(sel('gerot_filial_mes') + ' AND filial = ?').bind(mes, cam.fil).first();
    else r = await db.prepare(sel('gerot_filial_mes')).bind(mes).first();
    return r && r.p != null ? { pos: Number(r.p) || 0, meta: Number(r.m) || 0 } : null;
  } catch (e) { return null; }
}
function blocos(g, D, cevenOk, pr) {
  const vend = g.fat + g.cart, falta = Math.max(0, g.meta - vend);
  const L = ['💰 *Vendas*'];
  if (g.meta > 0) L.push(`Meta *${R$(g.meta)}* · faturado *${R$(g.fat)}* (${pc(g.fat, g.meta)}) · a faturar ${R$(g.cart)}`, `Vendido (fat. + a faturar) *${R$(vend)}* (${pc(vend, g.meta)}) · falta *${R$(falta)}*`);
  else L.push(`_Sem meta cadastrada_ · faturado *${R$(g.fat)}* · a faturar ${R$(g.cart)} · vendido *${R$(vend)}*`);
  L.push(`Média *${R$(g.fat / D.decorridos)}*/dia útil` + (D.passado ? ' (mês fechado)' : g.meta > 0 ? (D.restantes ? ` · precisa *${R$(falta / D.restantes)}*/dia útil (${D.restantes} até o fim do mês)` : ' · último dia do mês') : ''));
  // positivação: realizado GEROT; meta de clientes do CEVEN
  const meta = pr ? pr.meta : g.metaPosC, real = pr ? pr.pos : g.posG, faltaP = Math.max(0, meta - real);
  L.push(pr ? '👥 *Positivação* _(clientes distintos)_' : '👥 *Positivação*');
  if (pr === null) { L.push('_clientes distintos: sem a linha do GEROT agora (a soma por indústria repete o cliente, por isso não é mostrada)_'); return L; }
  if (meta > 0) L.push(`Meta *${N(meta)}* clientes${pr ? '' : ' (CEVEN)'} · positivados *${N(real)}* (${pc(real, meta)}) · faltam *${N(faltaP)}*`);
  else L.push(`Positivados *${N(real)}*` + ' · _o GEROT não traz meta de clientes por indústria_');
  L.push(`Média *${qd(real / D.decorridos)}*/dia útil` + (!D.passado && meta > 0 && D.restantes ? ` · precisa *${qd(faltaP / D.restantes)}*/dia útil` : ''));
  // AUDITORIA GEROT x CEVEN (Vitorio, 10/11/2026): diferenca entre as fontes aparece, nunca some
  if (cevenOk && g.temC) {
    const dPos = g.posC - real, dFat = g.fatC - g.fat;
    if (dPos || Math.abs(dFat) >= 1) L.push(`🔎 _GEROT x CEVEN:_ positivados GEROT ${N(real)} x CEVEN ${N(g.posC)}${dPos ? ` (${dPos > 0 ? '+' : ''}${N(dPos)})` : ' ✅'} · faturado GEROT ${R$(g.fat)} x CEVEN ${R$(g.fatC)}${Math.abs(dFat) >= 1 ? ` (${dFat > 0 ? '+' : ''}${R$(dFat)})` : ' ✅'}`);
    else L.push('🔎 _GEROT x CEVEN: iguais ✅_');
  }
  return L;
}
// a faturar em cada linha (Rudinei, 12/11/2026: 'nao ta pegando pedidos a faturar')
const linhaCurta = (rot, g) => `*${rot}*: ${g.meta > 0 ? `${R$(g.fat)} de ${R$(g.meta)} (${pc(g.fat, g.meta)}) · a faturar ${R$(g.cart)} · vendido ${pc(g.fat + g.cart, g.meta)}` : `${R$(g.fat)} · a faturar ${R$(g.cart)} · _sem meta_`}${g.metaPosC > 0 ? ` · ${N(g.posG)}/${N(g.metaPosC)} cli.` : g.posG ? ` · ${N(g.posG)} cli.` : ''}`;
const agrupa = (rs, k) => { const m = new Map(); for (const x of rs) { const c = k(x); if (!m.has(c)) m.set(c, []); m.get(c).push(x); } return m; };
const ordemInd = (a, b) => (b[1].meta > 0) - (a[1].meta > 0) || b[1].meta - a[1].meta || b[1].fat - a[1].fat;

// Supervisor = Gestão de Equipe (config_equipe_soberana); só aparece quem ATENDE a indústria (meta > 0 ou vendido >= 1% do total);
// contas internas/histórico/gerente/vago/negativo ficam na linha "fora das equipes / ajustes". Ordem única para exibição e navegação por número.
async function supGestaoMapa(env) {
  const m = new Map();
  try {
    const row = await env.DB.prepare('SELECT conteudo_json FROM config_equipe_soberana LIMIT 1').first();
    const cc = JSON.parse((row && row.conteudo_json) || '{}');
    for (const [k, Lc] of Object.entries(cc.filiais || {})) {
      const sig = k.split('_')[0];
      for (const v of Lc || []) if (v && v.rca != null && v.supervisor) m.set(sig + '|' + String(Number(v.rca)), String(v.supervisor));
    }
  } catch (e) { /* sem Gestao */ }
  return m;
}
function supervisoresQueAtendem(rs, cfgS) {
  const porSup = new Map(), foraRows = [], totG = soma(rs), totV = Math.abs(totG.fat + totG.cart) || 1;
  for (const x of rs) {
    const sg = cfgS.get(x.filial + '|' + String(Number(x.rca)));
    if (!sg || /^(GERENTE|VAGO|SUPERVISOR \d)/i.test(sg)) { foraRows.push(x); continue; }
    const kn = sem(sg);
    if (!porSup.has(kn)) porSup.set(kn, { id: 'G:' + kn, rot: titulo(nome2(sg)), rows: [] });
    porSup.get(kn).rows.push(x);
  }
  const ativos = [];
  for (const o of porSup.values()) {
    const g = soma(o.rows), vend = g.fat + g.cart;
    if (g.meta > 0 || (vend > 0 && vend >= totV * 0.01)) ativos.push([o.id, g, o.rot, o.rows]);
    else foraRows.push(...o.rows);
  }
  ativos.sort((a, b) => b[1].fat - a[1].fat);
  const foraG = foraRows.length ? soma(foraRows) : null;
  const temFora = foraG && (Math.abs(foraG.fat + foraG.cart) > 1 || foraG.meta > 0);
  return { ativos, foraG: temFora ? foraG : null };
}

// caminho: { mes, fil, ind, sup, rca }  -> texto com marcador 〔G:mes|fil|ind|sup|rca〕
export async function respPainelIndustrias(env, B, cam) {
  if (!env || !env.DB) return null;
  const mes = cam.mes || hojeSP().slice(0, 7), D = dias(mes), nm = NOME_MES[Number(mes.slice(5)) - 1];
  // INDUSTRIAS SO GEROT (Vitorio, 12/11/2026: 'GEROT x CEVEN e CEVEN x GEROT ta deixando o povo confuso... deixa industrias so pegando dados do GEROT'):
  // a parte do CEVEN (meta de clientes, positivados e faturado da Premiacao) nao entra mais na resposta; a conferencia das fontes vai para a auditoria noturna.
  const { L } = await base(env, B, mes, cam.fil || null), cevenOk = false;
  for (const x of L) { x.metaPosC = 0; x.posC = 0; x.fatC = 0; x.temC = false; }
  // 11/11/2026 (Rudinei: 'condor, Philips, sc Johnson e Baly em TCV'): cam.inds = varias industrias citadas; o painel mostra so elas (6o campo do marcador)
  const mk = `〔G:${mes}|${cam.fil || ''}|${cam.ind || ''}|${cam.sup || ''}|${cam.rca || ''}|${(cam.inds || []).join(',')}〕`;
  const st = await env.DB.prepare('SELECT posicao FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first().catch(() => null);
  const fonte = `_Fonte: GEROT${st && st.posicao ? ' (' + st.posicao.replace(/^Atual\s*·\s*/, 'posição ') + ')' : ''} · média = dias úteis decorridos; necessidade = dias úteis até o fim do mês._`;
  if (!L.length) return `🏭 *Painel das indústrias* · ${nm}\nNão há linha no GEROT para esse recorte e mês. Não vou estimar.\n\n${fonte}`;
  const cfgS = cam.ind && (cam.fil || cam.sup) ? await supGestaoMapa(env) : new Map();
  let rs = cam.inds && cam.inds.length ? L.filter((x) => cam.inds.includes(x.ind)) : L;
  if (cam.ind) rs = rs.filter((x) => x.ind === cam.ind);
  if (cam.sup) {
    if (String(cam.sup).startsWith('G:')) { const kn = String(cam.sup).slice(2); rs = rs.filter((x) => sem(cfgS.get(x.filial + '|' + String(Number(x.rca))) || '') === kn); }
    else rs = rs.filter((x) => x.sup === cam.sup);
  }
  if (cam.rca) rs = rs.filter((x) => x.rca === cam.rca);
  const out = [];
  const prM = cam.ind ? undefined : (cam.inds && cam.inds.length ? null : await posReal(env, mes, { ...cam, sup: String(cam.sup || '').startsWith('G:') ? null : cam.sup }));   // positivacao real (clientes distintos) quando ha varias industrias juntas
  // TODAS AS INDUSTRIAS DE UM VENDEDOR OU DE UMA EQUIPE (17/11/2026, auditoria: o item 13 do vendedor e o 9 do supervisor liam a Premiacao/RV, fora do ar;
  // agora a mesma fonte do painel da diretoria = GEROT). Sem navegacao por numero: para uma industria, o nome dela.
  if ((cam.rca || cam.sup) && !cam.ind && cam.fil) {
    if (!rs.length) return null;
    const x0 = rs[0] || {}, quem = cam.rca ? `${cam.rca} - ${nome2(x0.vend || '')}` : `Equipe ${nome2(x0.supNome || '')}`;
    const is = [...agrupa(rs, (x) => x.ind)].map(([k, v]) => [k, soma(v)]).filter(([, g]) => g.meta > 0 || g.fat > 0 || g.cart > 0).sort(ordemInd);
    const com = is.filter(([, g]) => g.meta > 0), semM = is.filter(([, g]) => !(g.meta > 0));
    out.push(`🏭 *Indústrias — ${quem}* (${cam.fil}) · ${nm}`, ...blocos(soma(rs), D, cevenOk, prM), '', `*Com meta (${com.length}):*`, ...com.map(([k, g], i) => `${i + 1}. ${linhaCurta(k, g)}`));
    if (semM.length) out.push('', `*Sem meta cadastrada, com venda (${semM.length}):*`, ...semM.map(([k, g], i) => `${com.length + i + 1}. ${linhaCurta(k, g)}`));
    out.push('', fonte);
    return out.join('\n');
  }
  // NIVEL 4: vendedor
  if (cam.rca) {
    const x0 = rs[0] || {}; out.push(`🏭 *${cam.ind} — ${cam.rca} - ${nome2(x0.vend || '')}* (${cam.fil}) · ${nm}`, ...blocos(soma(rs), D, cevenOk), '', '*0* Voltar ao supervisor');
  } else if (cam.sup) {
    // NIVEL 3: supervisor -> vendedores
    const x0 = rs[0] || {}; const supLabel = String(cam.sup).startsWith('G:') ? titulo(nome2(cfgS.get(x0.filial + '|' + String(Number(x0.rca))) || String(cam.sup).slice(2))) : `${cam.sup} - ${nome2(x0.supNome || '')}`;
    const vs = [...agrupa(rs, (x) => x.rca)].map(([k, v]) => [k, soma(v), v[0]]).sort((a, b) => (b[1].meta ? b[1].fat / b[1].meta : -1) - (a[1].meta ? a[1].fat / a[1].meta : -1) || b[1].fat - a[1].fat);
    out.push(`🏭 *${cam.ind} — sup. ${supLabel}* (${cam.fil}) · ${nm}`, ...blocos(soma(rs), D, cevenOk), '', `*Vendedores (${vs.length}):*`,
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
    // NIVEL 2: filial + industria -> supervisores (Gestão de Equipe + só quem atende; resto = fora das equipes / ajustes)
    const { ativos, foraG } = supervisoresQueAtendem(rs, cfgS);
    const rsEq = rs.filter((x) => { const sg = cfgS.get(x.filial + '|' + String(Number(x.rca))); return sg && !/^(GERENTE|VAGO|SUPERVISOR \d)/i.test(sg); });
    const zeroV = [...agrupa(rsEq, (x) => x.rca)].filter(([, v]) => { const g = soma(v); return !(g.fat > 0) && !(g.cart > 0); });
    const lFora = foraG ? [`• _fora das equipes / ajustes_: ${R$(foraG.fat)}${foraG.meta > 0 ? ' de ' + R$(foraG.meta) : ''} · a faturar ${R$(foraG.cart)}`] : [];
    out.push(`🏭 *${cam.ind} — ${cam.fil}* · ${nm}`, ...blocos(soma(rs), D, cevenOk), '', `*Supervisores que atendem (${ativos.length}):*`,
      ...ativos.map(([, g, rot], i) => `${i + 1}. ${linhaCurta(rot, g)}`), ...lFora,
      '', zeroV.length ? `📌 Vendedores das equipes sem venda dessa indústria na filial: *${zeroV.length}*` : '📌 Todos os vendedores das equipes com venda ou pedido dessa indústria ✅',
      '', '👉 *Digite o número do supervisor* para abrir a equipe · *0* volta à filial');
  } else if (cam.fil) {
    // NIVEL 1: filial -> industrias (com meta primeiro; depois as sem meta, todas com venda)
    const is = [...agrupa(rs, (x) => x.ind)].map(([k, v]) => [k, soma(v)]).filter(([, g]) => g.meta > 0 || g.fat > 0 || g.cart > 0).sort(ordemInd);
    const com = is.filter(([, g]) => g.meta > 0), semM = is.filter(([, g]) => !(g.meta > 0));
    out.push(`🏭 *Indústrias — ${cam.fil}* · ${nm}`, ...blocos(soma(rs), D, cevenOk, prM), '', `*Com meta (${com.length}):*`, ...com.map(([k, g], i) => `${i + 1}. ${linhaCurta(k, g)}`));
    if (semM.length) out.push('', `*Sem meta cadastrada, com venda (${semM.length}):*`, ...semM.map(([k, g], i) => `${com.length + i + 1}. ${linhaCurta(k, g)}`));
    out.push('', '👉 *Digite o número da indústria* para abrir por supervisor · *0* volta ao Brasil');
  } else {
    // NIVEL 0: Brasil -> filiais
    const fs = [...agrupa(rs, (x) => x.filial)].map(([k, v]) => [k, soma(v)]).sort((a, b) => FILIAIS.indexOf(a[0]) - FILIAIS.indexOf(b[0]));
    out.push(`🏭 *Painel das indústrias — Brasil* · ${nm}`, ...blocos(soma(rs), D, cevenOk, prM), '', '*Filiais:*', ...fs.map(([k, g], i) => `${i + 1}. ${linhaCurta(k, g)}`),
      '', '👉 *Digite o número da filial* para abrir as indústrias dela. Para outro mês: *painel das indústrias de outubro*.');
  }
  out.push('', fonte, mk);
  return out.join('\n');
}

// numero digitado depois de um nivel do painel: desce (1..n) ou sobe (0)
export async function respPainelNumero(env, B, marcador, k) {
  const [mes, fil, ind, sup, rca, indsTxt] = marcador.split('|'); const inds = indsTxt ? indsTxt.split(',').filter(Boolean) : null;
  if (k === 0) { if (rca) return respPainelIndustrias(env, B, { mes, fil, ind, sup }); if (sup) return respPainelIndustrias(env, B, { mes, fil, ind }); if (ind && fil) return respPainelIndustrias(env, B, { mes, fil, inds }); return respPainelIndustrias(env, B, { mes, inds }); }
  const { L } = await base(env, B, mes, fil || null);
  const cfgS = ind && (fil || sup) ? await supGestaoMapa(env) : new Map();
  let rs = inds ? L.filter((x) => inds.includes(x.ind)) : L;
  if (ind) rs = rs.filter((x) => x.ind === ind);
  if (sup) {
    if (String(sup).startsWith('G:')) { const kn = String(sup).slice(2); rs = rs.filter((x) => sem(cfgS.get(x.filial + '|' + String(Number(x.rca))) || '') === kn); }
    else rs = rs.filter((x) => x.sup === sup);
  }
  if (rca) return null;
  if (sup) { const vs = [...agrupa(rs, (x) => x.rca)].map(([k2, v]) => [k2, soma(v)]).sort((a, b) => (b[1].meta ? b[1].fat / b[1].meta : -1) - (a[1].meta ? a[1].fat / a[1].meta : -1) || b[1].fat - a[1].fat); const x = vs[k - 1]; return x ? respPainelIndustrias(env, B, { mes, fil, ind, sup, rca: x[0] }) : null; }
  if (ind && !fil) { const fs2 = [...agrupa(rs, (x) => x.filial)].map(([k2, v]) => [k2, soma(v)]).filter(([, g]) => g.meta > 0 || g.fat || g.cart).map(([k2]) => k2).sort((a, b) => FILIAIS.indexOf(a) - FILIAIS.indexOf(b)); const x = fs2[k - 1]; return x ? respPainelIndustrias(env, B, { mes, fil: x, ind }) : null; }
  if (ind) { const { ativos } = supervisoresQueAtendem(rs, cfgS); const x = ativos[k - 1]; return x ? respPainelIndustrias(env, B, { mes, fil, ind, sup: x[0] }) : null; }
  if (fil) { const is = [...agrupa(rs, (x) => x.ind)].map(([k2, v]) => [k2, soma(v)]).filter(([, g]) => g.meta > 0 || g.fat > 0 || g.cart > 0).sort(ordemInd); const x = is[k - 1]; return x ? respPainelIndustrias(env, B, { mes, fil, ind: x[0] }) : null; }
  const fs = [...agrupa(rs, (x) => x.filial)].map(([k2]) => k2).sort((a, b) => FILIAIS.indexOf(a) - FILIAIS.indexOf(b)); const x = fs[k - 1];
  return x ? respPainelIndustrias(env, B, { mes, fil: x, inds }) : null;
}
