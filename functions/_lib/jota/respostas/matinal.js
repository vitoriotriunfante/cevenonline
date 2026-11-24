// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/jota/respostas/matinal.js
// O QUE É: a MATINAL = a reuniao que o supervisor faz com o time de manha, ANTES da rota (Vitorio, 17/11/2026: "como eles nao te disseram que a matinal e
//   uma reuniao que o supervisor faz com o time de manha... antes deles irem pra rota?"). Diretrizes da diretoria: "Matinal diaria (08h): checagem do roteiro
//   do dia, alertas de clientes em risco e tags de +MIX antes do vendedor bater no primeiro cliente". Modelo: docs/CATALOGO_RESPOSTAS_JOTA.md (B1, plano do dia).
// O QUE TEM (nesta ordem): ultimo dia util · mes x ritmo (gap R$) · positivacao x meta ate hoje · rota de hoje (clientes sem compra nela) ·
//   onde esta o gap (vendedor e industria, maior R$ primeiro) · RET de hoje (com quem e em quais clientes) · fonte e hora.
// FONTES: GEROT (mes, por vendedor, por industria e por cliente) + Clube (ultimo dia util e rota de hoje) + roteiro planejado de hoje. Nunca CEVEN.
// =========================================================================
import { N, R$, hojeSP, titulo, vn } from '../base.js';
import { diasUteisMes } from './gestao.js';
import { diasUteis as diasUteisGerot } from '../../fatos/dias.js';

const DSEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const far = (r) => (r == null ? '⚪' : r >= 1 ? '🟢' : r >= 0.85 ? '🟡' : '🔴');
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const curtoInd = (f) => titulo(String(f || '').replace(/^[A-Z]\s*-\s*\d?\s*/, '').replace(/\s*#\d+\s*$/, '').replace(/\.{2,}.*$/, '').replace(/\b(LTDA|LTD|S\.?A\.?|S\/A|DO BRASIL|BRASIL|INDUSTRIA|IND|COMERCIO|COM|DIST|DISTRIBUIDORA|ALIMENTOS|E)\b\.?/gi, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ').toLowerCase());

export async function respPlanoDia(B, E) {
  if (!B || !B.env || !B.env.DB || !E || !(E.vend || []).length) return null;
  const db = B.env.DB, hoje = hojeSP(), mes = hoje.slice(0, 7);
  // EQUIPE = A DO GEROT (17/11/2026: a 1a versao montava pela Gestao de Equipe e perdeu o 125 - Claudio Branco da equipe do Jefferson; a matinal antiga e o card
  // usam o supervisor do GEROT). Numeros do mes do GEROT; da Gestao de Equipe so a rota de hoje e o canal de cada vendedor.
  const filE = [...new Set((E.filiais && E.filiais.length ? E.filiais : E.vend.map((v) => v.filial)))].filter(Boolean);
  if (!filE.length) return null;
  let GR = [];
  try { GR = (await db.prepare(`SELECT filial, rca, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ? AND filial IN (${filE.map(() => '?').join(',')})`).bind(mes, ...filE).all()).results || []; } catch (e) { GR = []; }
  const semAc = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  // 23/11/2026 (decisao do Vitorio: equipe = Gestao de Equipe; docs/DICIONARIO_KPIS.md 3.27): supervisor e grupo = os vendedores do escopo (Gestao), pelo codigo
  if (E.supervisor || E.grupo) { const kg = new Set(E.vend.concat(E.ocultos || []).map((v) => v.filial + '|' + String(Number(v.rca)))); GR = GR.filter((x) => kg.has(x.filial + '|' + String(Number(x.rca)))); }
  const EV = new Map(E.vend.map((v) => [v.filial + '|' + v.rca, v]));
  const V = GR.map((x) => { let d = {}; try { d = JSON.parse(x.dados || '{}'); } catch (e) { d = {}; } const e = EV.get(x.filial + '|' + x.rca) || {}; return { filial: x.filial, rca: String(x.rca), nome: x.vendedor || e.nome || '', canal: e.canal || '', rotaHoje: e.rotaHoje || [], meta: Number(d['Meta (R$)']) || 0, fat: Number(d['Faturado líquido (R$)']) || 0, pend: Number(d['Carteira pendente (R$)']) || 0, metaPos: Number(d['Meta de positivação']) || 0, cap: d['Captação (R$)'] == null ? null : Number(d['Captação (R$)']), ideal: Number(d['Meta Ideal captação (R$)']) || 0 }; })
    .filter((v) => (v.meta > 0 || v.fat > 0) && !/^VAGO\b/i.test(String(v.nome)));
  if (!V.length) return null;
  const fil = [...new Set(V.map((v) => v.filial))], qs = fil.map(() => '?').join(','), ks = new Set(V.map((v) => v.filial + '|' + v.rca));
  const DU = diasUteisGerot(), tot = DU.total, pass = DU.decorridos; const ritmo = tot ? pass / tot : 0, falt = Math.max(1, DU.restantes);   /* 23/11/2026: convencao do GEROT (dicionario §2) */
  const q = async (sql, ...b) => { try { return (await db.prepare(sql).bind(...b).all()).results || []; } catch (e) { return []; } };
  const [GC, GV, CH] = await Promise.all([
    q(`SELECT filial, rca, cliente, nome, dados FROM gerot_cliente_mes WHERE mes = ? AND filial IN (${qs})`, mes, ...fil),
    q(`SELECT filial, rca, fornecedor, json_extract(dados, '$."Meta (R$)"') m, json_extract(dados, '$."Faturado líquido (R$)"') fa, json_extract(dados, '$."Carteira pendente (R$)"') ca FROM gerot_vendas WHERE mes = ? AND filial IN (${qs})`, mes, ...fil),
    q(`SELECT filial, rca, roteiros, lido_em FROM clube_venda_dia WHERE dia = ? AND filial IN (${qs})`, hoje, ...fil),
  ]);
  // ultimo dia util (seg-sex, sem feriado) com venda da equipe, pelo Clube
  let ont = null;
  try {
    const { ehFeriado } = await import('../../feriados.js');
    const ds = await q(`SELECT dia FROM clube_venda_dia WHERE filial IN (${qs}) AND dia < ? AND strftime('%w', dia) BETWEEN '1' AND '5' GROUP BY dia HAVING SUM(total_pedido) > 0 ORDER BY dia DESC LIMIT 10`, ...fil, hoje);
    const dUlt = (ds.map((x) => x.dia).find((x) => x && !ehFeriado(x))) || null;
    if (dUlt) { const R = (await q(`SELECT filial, rca, total_pedido v, ped_total n FROM clube_venda_dia WHERE dia = ? AND filial IN (${qs})`, dUlt, ...fil)).filter((x) => ks.has(x.filial + '|' + x.rca)); ont = { d: dUlt, v: R.reduce((a, x) => a + (Number(x.v) || 0), 0), n: R.reduce((a, x) => a + (Number(x.n) || 0), 0), quem: R.filter((x) => Number(x.v) > 0).length }; }
  } catch (e) { ont = null; }
  // carteira por cliente (GEROT): positivacao da equipe sem contar o mesmo cliente duas vezes; quem esta sem compra e sem pedido
  const semCompra = new Map(), posCli = new Set(), cartCli = new Set(), fatCli = new Map();
  for (const x of GC) {
    if (!ks.has(x.filial + '|' + x.rca)) continue;
    let d = {}; try { d = JSON.parse(x.dados || '{}'); } catch (e) { d = {}; }
    const k = x.filial + '|' + x.cliente, pos = Number(d['Positivação (filial + CNPJ)']) || 0, pc = Number(d['Positivação + Carteira']) || 0, m1 = Number(d['Positivação M-1']) || 0;
    cartCli.add(k); fatCli.set(k, (fatCli.get(k) || 0) + (Number(d['Faturado líquido (R$)']) || 0));
    if (!(pos > 0) && !(pc > 0)) { const kk = x.filial + '|' + x.rca; if (!semCompra.has(kk)) semCompra.set(kk, new Map()); semCompra.get(kk).set(String(x.cliente), { nome: titulo(String(x.nome || 'Cliente').toLowerCase()), m1 }); }
  }
  for (const [k, f] of fatCli) if (f > 0) posCli.add(k);   /* regra 4 do dicionario: faturado liquido somado no grupo > 0 */
  // meta de positivacao: a soma dos vendedores NAO e a meta da equipe (3.10). Equipe da Gestao: a do supervisor no GEROT; grupo: nao definida
  let metaPos = 0; if (E.supervisor && !E.grupo) { try { const sc = (E.vend.find((v) => v.supCod) || {}).supCod; const r = sc ? await db.prepare('SELECT json_extract(dados, \'$."Meta de positivação"\') m FROM gerot_supervisor_mes WHERE mes = ? AND filial = ? AND cod_sup = ?').bind(mes, filE[0], String(sc)).first() : null; metaPos = r && r.m != null ? Number(r.m) : 0; } catch (e) { metaPos = 0; } } else if (E.rca) metaPos = V.reduce((a, v) => Math.max(a, Number(v.metaPos) || 0), 0);
  // mes da equipe (GEROT)
  const meta = V.reduce((a, v) => a + (v.meta || 0), 0), vend = V.reduce((a, v) => a + (v.fat || 0) + (v.pend || 0), 0), esp = meta * ritmo, gap = Math.max(0, esp - vend), capT = V.some((v) => v.cap != null) ? V.reduce((a, v) => a + (v.cap || 0), 0) : null, idealT = V.reduce((a, v) => a + (v.ideal || 0), 0), ritG = capT != null && idealT ? capT / idealT : null, porDia = capT != null && DU.restantes > 0 ? Math.max(0, meta - capT) / DU.restantes : null;   /* 23/11/2026: ritmo = captacao / meta ideal; precisa/dia = (meta - captacao) / dias restantes (GEROT, 3.7/3.8) */
  // rota de hoje: roteiros do Clube + clientes planejados sem compra no mes
  const ch = CH.filter((x) => ks.has(x.filial + '|' + x.rca)), rot = ch.reduce((a, x) => a + (Number(x.roteiros) || 0), 0), comRota = ch.filter((x) => Number(x.roteiros) > 0).length;
  const lido = ch.map((x) => x.lido_em).filter(Boolean).sort().pop();
  const naRotaSem = new Map(); let totNaRotaSem = 0;
  for (const v of V) { const sc = semCompra.get(v.filial + '|' + v.rca); if (!sc) continue; const L = (v.rotaHoje || []).filter((c) => sc.has(String(c.id_cliente))).map((c) => ({ id: String(c.id_cliente), ...sc.get(String(c.id_cliente)) })); if (L.length) { naRotaSem.set(v.filial + '|' + v.rca, L); totNaRotaSem += L.length; } }
  // onde esta o gap: vendedor (R$ abaixo do ritmo) e a industria que mais pesa nele
  const ind = new Map(); for (const g of GV) { const k = g.filial + '|' + g.rca; if (!ks.has(k)) continue; const m = Number(g.m) || 0; if (!m) continue; const a = m * ritmo - ((Number(g.fa) || 0) + (Number(g.ca) || 0)); if (a > 0 && (!ind.has(k) || a > ind.get(k).a)) ind.set(k, { a, f: curtoInd(g.fornecedor) }); }
  const gaps = V.map((v) => ({ v, a: (v.meta || 0) * ritmo - ((v.fat || 0) + (v.pend || 0)) })).filter((x) => x.a > 0).sort((a, b) => b.a - a.a);
  const ehAS = V.filter((v) => /^(AS|PET AS)/i.test(String(v.canal || ''))).length > V.length / 2;
  // RET: o vendedor com o maior gap que tem rota hoje; os clientes = sem compra no mes na rota dele (os que compraram no mes passado primeiro)
  const ret = gaps.find((x) => naRotaSem.has(x.v.filial + '|' + x.v.rca)) || gaps[0];
  const retCli = ret ? (naRotaSem.get(ret.v.filial + '|' + ret.v.rca) || [...((semCompra.get(ret.v.filial + '|' + ret.v.rca) || new Map()).entries())].map(([id, c]) => ({ id, ...c }))).sort((a, b) => b.m1 - a.m1).slice(0, 2) : [];
  const hora = lido ? new Date(lido).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : null;
  const L = [`☀️ *Matinal · ${E.nome || 'Equipe'}* · ${DSEM[new Date(hoje + 'T12:00:00Z').getUTCDay()]} ${dm(hoje)}`];
  if (ont) L.push(`📅 Último dia útil (${DSEM[new Date(ont.d + 'T12:00:00Z').getUTCDay()]} ${dm(ont.d)}): *${R$(ont.v)}* em *${N(ont.n)}* pedidos · ${N(ont.quem)} de ${N(V.length)} vendedores venderam`);
  if (meta) L.push(`📊 Mês: fat. + carteira *${Math.round(vend / meta * 100)}%* da meta` + (ritG != null ? ` · ritmo do GEROT ${far(ritG)} *${Math.round(ritG * 100)}%* do ideal` : ' · sem ritmo do GEROT') + (porDia != null ? ` · precisa captar ${R$(porDia)}/dia útil` : ''));
  if (ehAS && meta) { const alvo = meta * 0.6; L.push(`📐 Faseamento AS (60% até o dia 20): ${R$(vend)} de ${R$(alvo)} (${Math.round(vend / alvo * 100)}%)`); }
  if (posCli.size || metaPos) L.push(`👥 Positivação: *${N(posCli.size)}*` + (metaPos ? ` de ${N(Math.round(metaPos))} ${far(metaPos * ritmo ? posCli.size / (metaPos * ritmo) : null)} · meta até hoje ${N(Math.round(metaPos * ritmo))}` : '') + (cartCli.size ? ` · carteira ${N(cartCli.size)}` : ''));
  if (ch.length) L.push(rot ? `🚶 Hoje: *${N(rot)}* clientes na rota · ${N(comRota)} vendedores` + (totNaRotaSem ? ` · *${N(totNaRotaSem)} sem compra no mês* — prioridade na visita` : '') : `🚶 Ninguém da equipe com rota hoje${ehAS ? ' (equipe AS)' : ''}.`);
  else L.push('🚶 Rota de hoje: o Clube ainda não leu o dia.');
  if (gaps.length) {
    L.push('', '💰 *Onde está o gap* (R$ abaixo do ritmo, maior primeiro):');
    for (const x of gaps.slice(0, 4)) { const i = ind.get(x.v.filial + '|' + x.v.rca); const nr = (naRotaSem.get(x.v.filial + '|' + x.v.rca) || []).length; L.push(`• *${vn(x.v)}*: R$ ${N(Math.round(x.a))}` + (i ? ` · mais em ${i.f}` : '') + (nr ? ` · ${nr} sem compra na rota de hoje` : '')); }
  } else if (meta) L.push('', '🏆 Todos os vendedores no ritmo da meta do mês.');
  // INDUSTRIAS DA EQUIPE (17/11/2026, Vitorio: "nao mandou o resumo por industrias" — a matinal sempre teve o card de industrias): meta x fat.+carteira,
  // tendencia (ritmo de fechamento), quanto precisa por dia util e positivacao, pior tendencia primeiro. Mesmo conteudo do card 'Matinal — Industrias'.
  const IA = new Map();
  for (const g of GV) { if (!ks.has(g.filial + '|' + g.rca)) continue; const n = curtoInd(g.fornecedor); const x = IA.get(n) || { m: 0, v: 0 }; x.m += Number(g.m) || 0; x.v += (Number(g.fa) || 0) + (Number(g.ca) || 0); IA.set(n, x); }
  const decorr = Math.max(1, pass), IL = [...IA.entries()].filter(([, x]) => x.m > 0).map(([n, x]) => ({ n, ...x, tend: tot ? (x.v / decorr) * tot / x.m : null, dia: Math.max(0, x.m - x.v) / falt })).sort((a, b) => (a.tend ?? 0) - (b.tend ?? 0));
  if (IL.length) {
    const risco = IL.filter((x) => (x.tend ?? 0) < 0.8);
    L.push('', `🏭 *Indústrias* (${IL.length} com meta · ${risco.length} em risco, abaixo de 80% de tendência):`);
    for (const x of IL.slice(0, 8)) L.push(`${far(x.tend)} *${x.n}*: ${R$(x.v)} de ${R$(x.m)} (${Math.round(x.v / x.m * 100)}%) · tend. ${Math.round((x.tend || 0) * 100)}%` + (x.dia > 0 ? ` · precisa ${R$(x.dia)}/d` : ' · ✅ batida'));
    if (IL.length > 8) L.push(`… e mais ${IL.length - 8} (peça "indústrias da equipe")`);
  }
  if (ret) L.push('', `👉 *RET hoje:* ${vn(ret.v)}` + (retCli.length ? ` — ${retCli.map((c) => `${c.nome} (#${c.id})${c.m1 > 0 ? ' 🔁' : ''}`).join(' e ')}` : '') + '.');
  L.push(`_Clube ${hora || '—'} · GEROT ${dm(hoje)}_`);
  return L.join('\n');
}
