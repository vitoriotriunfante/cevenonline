// =========================================================================
// FATOS · functions/_lib/fatos/kpis.js
// O QUE É: a camada ÚNICA de leitura dos KPIs do MÊS (docs/DICIONARIO_KPIS.md §0 e §3). Só lê o D1 (tabelas do GEROT).
// Regras que esta camada garante (não repetir a conta em outro lugar):
//   1. R$ SOMA de baixo para cima (faturado, bruto, devolução, meta, carteira, captação, meta ideal).
//   2. Positivação e meta de positivação NÃO somam: lidas no próprio nível (filial, supervisor GEROT, vendedor).
//      Grupo/equipe da Gestão = regra 4: CNPJs distintos com faturado líquido SOMADO > 0 em gerot_cliente_mes.
//      Brasil = soma das filiais (CNPJ é por filial). Nada da meta_hierarquia, nada de "Meta clientes".
//   3. Ritmo = captação ÷ meta ideal de captação (régua do GEROT). Necessidade/dia = máx(0, meta − captação) ÷ dias restantes
//      (no nível com linha pronta: o campo do GEROT). Nunca somar as necessidades dos filhos.
//   4. Sem dado = null (nunca zero inventado).
// =========================================================================
import { diasUteis, hojeBRT } from './dias.js';

export const CAMPO = {
  fat: 'Faturado líquido (R$)', bruto: 'Faturado bruto (R$)', dev: 'Devolução (R$)', meta: 'Meta (R$)',
  cart: 'Carteira pendente (R$)', pedCart: 'Pedidos na carteira', cap: 'Captação (R$)', ideal: 'Meta Ideal captação (R$)',
  nec: 'Necessidade dia captação (R$)', ritmo: '% Meta Ideal captação', pos: 'Positivação (filial + CNPJ)', posC: 'Positivação + Carteira',
  metaPos: 'Meta de positivação', posM1: 'Positivação M-1', margem: 'Margem de contribuição (R$)', capM1: 'Captação M-1 (R$)',
};
const SOMA = ['fat', 'bruto', 'dev', 'meta', 'cart', 'pedCart', 'cap', 'ideal', 'margem', 'capM1'];
const num = (x) => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x));
const parse = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
const rcaN = (r) => (/^\d+$/.test(String(r ?? '').trim()) ? String(Number(r)) : String(r ?? '').trim());

// posição da carga do GEROT ("23/11/26 08:34"), para o rodapé
export async function posicaoGerot(db) {
  try { const st = await db.prepare('SELECT posicao FROM gerot_coleta_status ORDER BY id DESC LIMIT 1').first(); return st && st.posicao ? String(st.posicao).replace(/^Atual\s*·\s*/i, '') : null; } catch { return null; }
}

// soma os R$ de várias linhas (JSON dados do GEROT); campo ausente em todas = null
function somaLinhas(L) {
  const o = {};
  for (const k of SOMA) { const vs = L.map((d) => num(d[CAMPO[k]])).filter((x) => x != null); o[k] = vs.length ? vs.reduce((a, b) => a + b, 0) : null; }
  return o;
}
// completa fat+cart, ritmo e necessidade. `nivelPronto` = o nível tem linha própria no GEROT (usa o campo do nível)
function completa(o, d, nivelPronto, du) {
  o.fc = o.fat != null ? o.fat + (o.cart || 0) : null;
  if (nivelPronto && d) {
    const r = num(d[CAMPO.ritmo]); o.ritmo = r != null ? r * 100 : (o.cap != null && o.ideal ? o.cap / o.ideal * 100 : null);
    o.nec = num(d[CAMPO.nec]); if (o.nec == null && o.cap != null && o.meta != null && du.restantes > 0) o.nec = Math.max(0, o.meta - o.cap) / du.restantes;
  } else {
    o.ritmo = o.cap != null && o.ideal ? o.cap / o.ideal * 100 : null;
    o.nec = o.cap != null && o.meta != null && du.restantes > 0 ? Math.max(0, o.meta - o.cap) / du.restantes : null;
  }
  o.pctFat = o.meta ? o.fat / o.meta * 100 : null;
  o.pctFc = o.meta ? o.fc / o.meta * 100 : null;
  o.dias = du;
  return o;
}

// REGRA 4: clientes (CNPJ) com faturado líquido somado > 0 no recorte. rcas = null => filial inteira
export async function positivacaoRegra4(db, filial, rcas, mes = hojeBRT().slice(0, 7)) {
  if (rcas && !rcas.length) return { pos: 0, posC: 0 };
  const lista = rcas ? rcas.map((r) => Number(r)).filter((r) => !Number.isNaN(r)) : null;
  const filtro = lista ? ` AND CAST(rca AS INTEGER) IN (${lista.join(',') || -1})` : '';
  try {
    const r = await db.prepare(`SELECT sum(CASE WHEN f > 0 THEN 1 ELSE 0 END) pos, sum(CASE WHEN f > 0 OR c > 0 THEN 1 ELSE 0 END) posc FROM (SELECT coalesce(cnpj, cliente) k, sum(json_extract(dados, '$."Faturado líquido (R$)"')) f, sum(json_extract(dados, '$."Carteira pendente (R$)"')) c FROM gerot_cliente_mes WHERE mes = ? AND filial = ?${filtro} GROUP BY k)`).bind(mes, filial).first();
    return { pos: Number(r && r.pos) || 0, posC: Number(r && r.posc) || 0 };
  } catch { return { pos: null, posC: null }; }
}

// REGRA 4 PARA VÁRIOS GRUPOS DE UMA VEZ (linhas de uma resposta: supervisores, gerentes). grupos: Map(chave -> [rcas]). Devolve Map(chave -> { pos, posC }).
// Cada linha conta os seus clientes distintos: a soma das linhas pode passar do total (cliente comprado por duas equipes conta nas duas). Positivação não soma.
export async function positivacaoPorGrupos(db, filial, grupos, mes = hojeBRT().slice(0, 7)) {
  const pares = []; let i = 0; const nomes = new Map();
  for (const [g, rcas] of grupos) { const id = i++; nomes.set(id, g); for (const r of rcas || []) { const n = Number(r); if (!Number.isNaN(n)) pares.push(`(${n},${id})`); } }
  const out = new Map([...grupos.keys()].map((g) => [g, { pos: 0, posC: 0 }]));
  if (!pares.length) return out;
  try {
    const R = (await db.prepare(`WITH m(r, g) AS (VALUES ${pares.join(',')}) SELECT g, sum(CASE WHEN f > 0 THEN 1 ELSE 0 END) pos, sum(CASE WHEN f > 0 OR c > 0 THEN 1 ELSE 0 END) posc FROM (SELECT m.g g, coalesce(x.cnpj, x.cliente) k, sum(json_extract(x.dados, '$."Faturado líquido (R$)"')) f, sum(json_extract(x.dados, '$."Carteira pendente (R$)"')) c FROM gerot_cliente_mes x JOIN m ON CAST(x.rca AS INTEGER) = m.r WHERE x.mes = ? AND x.filial = ? GROUP BY m.g, k) GROUP BY g`).bind(mes, filial).all()).results || [];
    for (const r of R) out.set(nomes.get(Number(r.g)), { pos: Number(r.pos) || 0, posC: Number(r.posc) || 0 });
    return out;
  } catch { return null; }
}

// linhas de vendedor do GEROT de uma filial (cache por db+mes+filial com TTL de 30 s no isolate Cloudflare)
const CACHE = new WeakMap();
const TTL_VG = 30000;
export async function vendedoresGerot(db, filial, mes = hojeBRT().slice(0, 7)) {
  let c = CACHE.get(db); if (!c) { c = new Map(); CACHE.set(db, c); }
  const k = mes + '|' + filial, agora = Date.now(), hit = c.get(k);
  if (!hit || agora >= hit.exp) {
    const p = db.prepare('SELECT rca, cod_sup, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ? AND filial = ?').bind(mes, filial).all()
      .then((r) => (r.results || []).map((x) => ({ rca: rcaN(x.rca), cod_sup: String(x.cod_sup || ''), supervisor: x.supervisor, vendedor: x.vendedor, d: parse(x.dados) })))
      .catch(() => { c.delete(k); return null; });
    c.set(k, { exp: agora + TTL_VG, p });
  }
  return c.get(k).p;
}

// KPIs DO MÊS de um recorte.
//   nivel: 'brasil' | 'filial' | 'vendedor' | 'equipe' (supervisor pela Gestão de Equipe) | 'grupo' (gerente em MCD/TPH)
//   filiais: ['MCD'] (brasil: lista ou vazio = todas) · rcas: códigos dos vendedores (vendedor/equipe/grupo) · supCod: código do supervisor (só para a meta de positivação de referência)
// Devolve { fonte, posicao, fat, bruto, dev, meta, cart, pedCart, fc, cap, ideal, ritmo (%), nec (R$/dia), pctFat, pctFc, pos, posC, metaPos, metaPosRotulo, dias } ou null sem GEROT.
export async function kpisMes(db, { nivel, filiais = [], rcas = null, supCod = null, grupo = null, mes = hojeBRT().slice(0, 7) } = {}) {
  if (!db) return null;
  const du = diasUteis(), posicao = await posicaoGerot(db);
  if (nivel === 'brasil' || nivel === 'filial') {
    let R = []; try { R = (await db.prepare('SELECT filial, dados FROM gerot_filial_mes WHERE mes = ?').bind(mes).all()).results || []; } catch { return null; }
    if (filiais && filiais.length) R = R.filter((r) => filiais.includes(r.filial));
    if (!R.length) return null;
    const D = R.map((r) => parse(r.dados)), o = somaLinhas(D);
    const s = (k) => { const vs = D.map((d) => num(d[CAMPO[k]])).filter((x) => x != null); return vs.length ? vs.reduce((a, b) => a + b, 0) : null; };
    o.pos = s('pos'); o.posC = s('posC'); o.metaPos = s('metaPos'); o.posM1 = s('posM1'); o.metaPosRotulo = 'meta de positivação do GEROT';
    o.porFilial = Object.fromEntries(R.map((r, i) => { const x = completa({ ...somaLinhas([D[i]]), pos: num(D[i][CAMPO.pos]), posC: num(D[i][CAMPO.posC]), metaPos: num(D[i][CAMPO.metaPos]) }, D[i], true, du); return [r.filial, x]; }));
    return { fonte: 'GEROT', posicao, nivel, ...completa(o, D.length === 1 ? D[0] : null, D.length === 1, du) };
  }
  // vendedor, equipe, grupo: uma filial, lista de RCAs
  const filial = filiais[0]; if (!filial) return null;
  const VG = await vendedoresGerot(db, filial, mes); if (!VG) return null;
  if (!VG.length) return null;   /* filial sem carga do GEROT no mês */
  const alvo = new Set((rcas || []).map(rcaN));
  const L = VG.filter((x) => alvo.has(x.rca));
  const o = somaLinhas(L.map((x) => x.d));
  for (const k of SOMA) if (o[k] == null) o[k] = 0;   /* vendedor sem linha no GEROT com a filial carregada = sem venda e sem meta no mês */
  const umaLinha = nivel === 'vendedor' && L.length === 1;
  if (umaLinha) { o.pos = num(L[0].d[CAMPO.pos]); o.posC = num(L[0].d[CAMPO.posC]); o.metaPos = num(L[0].d[CAMPO.metaPos]); o.metaPosRotulo = 'meta de positivação do GEROT'; }
  else {
    const r4 = await positivacaoRegra4(db, filial, [...alvo], mes); o.pos = r4.pos; o.posC = r4.posC;
    if (nivel === 'vendedor') { const ms = L.map((x) => num(x.d[CAMPO.metaPos])).filter((x) => x != null); o.metaPos = ms.length ? Math.max(...ms) : null; o.metaPosRotulo = 'meta de positivação do GEROT'; }
    else {
      // meta de positivação do grupo (manual na Gestao de Equipe) ou da equipe (supervisor no GEROT)
      o.metaPos = null; o.metaPosRotulo = null;
      if (nivel === 'equipe' && supCod) { try { const s = await db.prepare('SELECT dados FROM gerot_supervisor_mes WHERE mes = ? AND filial = ? AND cod_sup = ?').bind(mes, filial, String(supCod)).first(); const m = s ? num(parse(s.dados)[CAMPO.metaPos]) : null; if (m != null) { o.metaPos = m; o.metaPosRotulo = 'meta de positivação do supervisor no GEROT'; } } catch { /* sem linha */ } }
      else if (nivel === 'grupo' && grupo) {
        try {
          const c = parse(((await db.prepare('SELECT conteudo_json FROM config_equipe_soberana LIMIT 1').first()) || {}).conteudo_json);
          const mg = c && c.metas_pos_grupo ? num(c.metas_pos_grupo[String(filial).toUpperCase() + '|' + String(grupo).toUpperCase()]) : null;
          if (mg != null && mg > 0) { o.metaPos = Math.round(mg); o.metaPosRotulo = 'meta de positivação do grupo (Gestão de Equipe)'; }
        } catch { /* sem meta manual */ }
      }
    }
  }
  return { fonte: 'GEROT', posicao, nivel, filial, n: L.length, ...completa(o, umaLinha ? L[0].d : null, umaLinha, du) };
}

// CARTEIRA (pedido a pedido) só de gerot_carteira. escopo: { filiais, rcas }. Devolve por situação { v, n } + bloqueados e faturável.
export async function carteira(db, { filiais = [], rcas = null } = {}) {
  if (!db) return null;
  const w = [], b = [];
  if (filiais && filiais.length) { w.push(`filial IN (${filiais.map(() => '?').join(',')})`); b.push(...filiais); }
  if (rcas) { const l = rcas.map(Number).filter((x) => !Number.isNaN(x)); w.push(`CAST(rca AS INTEGER) IN (${l.join(',') || -1})`); }
  let R; try { R = (await db.prepare(`SELECT situacao, count(*) n, sum(valor) v FROM gerot_carteira${w.length ? ' WHERE ' + w.join(' AND ') : ''} GROUP BY situacao`).bind(...b).all()).results || []; } catch { return null; }
  const o = { porSituacao: {}, total: { v: 0, n: 0 }, bloqueado: { v: 0, n: 0 }, bloqFin: { v: 0, n: 0 }, bloqCom: { v: 0, n: 0 }, faturavel: { v: 0, n: 0 } };
  const add = (a, r) => { a.v += Number(r.v) || 0; a.n += Number(r.n) || 0; };
  for (const r of R) {
    const s = String(r.situacao || 'sem situação'); o.porSituacao[s] = { v: Number(r.v) || 0, n: Number(r.n) || 0 }; add(o.total, r);
    if (/^Bloqueado/i.test(s)) { add(o.bloqueado, r); if (/Financ/i.test(s)) add(o.bloqFin, r); else if (/Comerc/i.test(s)) add(o.bloqCom, r); }
    if (/Montado|Liberado/i.test(s)) add(o.faturavel, r);
  }
  return o;
}

// TOTAL E LINHAS FECHAM (regra 2): acrescenta a linha "fora das equipes" = total − soma das linhas, nos campos R$ pedidos.
// linhas: [{ nome, fat, ... }]; campos: ['fat','cart','meta']. Só acrescenta se a diferença passar de R$ 1 em algum campo.
export function linhasQueFecham(total, linhas, campos = ['fat', 'cart', 'meta'], nome = 'fora das equipes') {
  if (!total) return linhas;
  const resto = { nome, fora: true };
  let tem = false;
  for (const c of campos) {
    if (total[c] == null) continue;
    const s = linhas.reduce((a, l) => a + (Number(l[c]) || 0), 0), dif = total[c] - s;
    resto[c] = dif; if (Math.abs(dif) > 1) tem = true;
  }
  // 23/11/2026 (auditoria: 'fora das equipes: R$ -37.63x' na API) — CAUSA medida no D1: RCAs que nao estao em nenhuma equipe tem faturado NEGATIVO
  //   (devolucao lancada neles: API RCA 2 'venda industrias' -R$ 35.451, RCA 261 -R$ 1.877, 61, 247). Soma de TODOS os vendedores do GEROT = total da filial
  //   centavo a centavo. A sobra negativa e verdadeira e fica, com o nome certo (resto.negativo), para total = soma das linhas.
  resto.negativo = campos.some((c) => (Number(resto[c]) || 0) < -1);
  return tem ? linhas.concat([resto]) : linhas;
}
