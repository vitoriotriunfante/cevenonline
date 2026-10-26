// =========================================================================
// JOTA · functions/_lib/jota/respostas/oportunidades.js
// O QUE É: motivos de não venda, o que a base não tem, o que oferecer para o cliente (+MIX).
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { FILIAIS, N, P, SUGESTAO, hojeSP, nome2, sem, titulo, vn } from '../base.js';
import { MESES } from './periodos.js';
import { PARADAS, dIso, nomeIndustria } from './vendas.js';

// MOTIVOS DE NAO VENDA NO PERIODO (reuniao tensa 25/10/2026): resumo publicado toda noite pela rotina guardar-visitas (sem dado de cliente)
export async function respJustificativas(B, E, t, pessoa) {
  const arqs = await Promise.all(E.filiais.map((f) => B.raw(`public/justificativas/${f}.json`).then((x) => { try { return x ? { f, ...JSON.parse(x) } : null; } catch (e) { return null; } })));
  const ok = arqs.filter(Boolean); if (!ok.length) return '📋 _O resumo dos motivos de não venda é publicado toda noite às 22h; ainda não há arquivo para esta filial._';
  const hj = Number(hojeSP().replace(/-/g, '')), ini = Math.floor(hj / 100) * 100 + 1;
  let de = ini, ate = hj, nomeP = 'no mês';
  if (/MES PASSADO|MES ANTERIOR|SETEMBRO/.test(t)) { const m = Math.floor(ini / 100) % 100, a = Math.floor(ini / 10000); de = m === 1 ? (a - 1) * 10000 + 1201 : a * 10000 + (m - 1) * 100 + 1; ate = ini - 1; nomeP = 'no mês passado'; }
  else if (/SEMANA/.test(t)) { de = Number(new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10).replace(/-/g, '')); nomeP = 'nos últimos 7 dias'; }
  let rs = null, quem = E.nome;
  if (pessoa && pessoa.tipo === 'vend') { rs = new Set([pessoa.alvo.filial + '|' + pessoa.alvo.rca]); quem = vn(pessoa.alvo); }
  else if (pessoa && pessoa.tipo === 'sup') { rs = new Set(E.vend.filter((v) => v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial).map((v) => v.filial + '|' + v.rca)); quem = 'Equipe ' + nome2(pessoa.alvo.nome); }
  else if (E.grupo || E.supervisor || E.rca) rs = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const dentro = (f, r, d) => d >= de && d <= ate && (!rs || rs.has(f + '|' + r));
  const M = new Map(), V = new Map(); let visitas = 0, pos = 0, just = 0, ult = 0;
  for (const a of ok) {
    for (const [d, r, n, p] of a.rota || []) if (dentro(a.f, r, d)) { visitas += n; pos += p; if (d > ult) ult = d; }
    for (const [d, r, mot, n] of a.l || []) if (dentro(a.f, r, d)) { just += n; M.set(mot, (M.get(mot) || 0) + n); const k = a.f + '|' + r, x = V.get(k) || { n: 0, m: new Map() }; x.n += n; x.m.set(mot, (x.m.get(mot) || 0) + n); V.set(k, x); }
  }
  if (!visitas) return `📋 *Motivos de não venda — ${quem}* ${nomeP}: nenhuma visita registrada no período.`;
  const top = [...M].sort((a, b) => b[1] - a[1]);
  const nm = new Map(E.vend.map((v) => [v.filial + '|' + v.rca, v]));
  const dica = { 'ESTOQUE SUFICIENTE': 'cliente com estoque: oferecer itens que ele ainda não compra (+MIX) em vez do mesmo pedido', 'CLIENTE SEM INTERESSE': '"sem interesse" é o maior motivo: revisar oferta e preço com o supervisor e acompanhar uma rota', 'PEDIDO A DIGITAR': 'tem pedido "a digitar": cobrar a digitação no mesmo dia', 'RESPONSAVEL PELA COMPRA AUSENTE (COMPRADOR / DONO)': 'comprador ausente: combinar horário fixo de visita com o cliente' };
  const out = [`📋 *Motivos de não venda — ${quem}* · ${nomeP} (até ${dIso(ult || ate)})`, `Clientes na rota: *${N(visitas)}* · com justificativa de não venda: *${N(just)}* (${P(just, visitas)})`, '',
    '*Motivos mais dados:*', ...top.slice(0, 8).map(([m, n]) => `• ${titulo(m)}: ${N(n)} (${P(n, just)})`)];
  if (!(pessoa && pessoa.tipo === 'vend') && V.size > 1) {
    const vs = [...V].sort((a, b) => b[1].n - a[1].n).slice(0, 5);
    out.push('', '*Quem mais justificou:*', ...vs.map(([k, x]) => { const mm = [...x.m].sort((a, b) => b[1] - a[1])[0]; return `• ${nm.get(k) ? vn(nm.get(k)) : 'RCA ' + k.split('|')[1]}${E.nacional ? ' ' + k.split('|')[0] : ''}: ${N(x.n)} · mais "${titulo(mm[0])}"`; }));
  }
  out.push('', SUGESTAO + (dica[top[0] && top[0][0]] || 'cruzar o motivo principal com os clientes da rota de amanhã.'));
  return out.join('\n');
}
// O QUE A BASE NAO TEM: dizer com clareza e oferecer o que existe (regra: nunca inventar nem estimar)
export function respSemDado(t) {
  if (/SELL.?OUT|ESTOQUE (D[OEA]S?|NO|NOS|NA|NAS) |RUPTURA|GIRO NO (PDV|CLIENTE)/.test(t)) return '📭 *Sell-out, estoque e ruptura no cliente* eu não tenho: a nossa base é do que *nós vendemos* (sell-in), não do que o cliente vende ou tem na gôndola.\nO que eu tenho: quem comprou e quanto, dias sem comprar, quem comprava e parou, dia da semana e semana a semana. Ex.: "quem comprava Snickers e parou na TBL".';
  if (/\bSHARE\b|CONCORR|MARKET ?SHARE|PARTICIPACAO DE MERCADO/.test(t)) return '📭 *Share e concorrência* eu não tenho: não há dado de mercado na base (só as nossas vendas).\nO que eu tenho: nossa positivação e faturado por indústria, filial e vendedor, e a meta de cada indústria. Ex.: "como está a meta da Mondelez no Brasil?".';
  if (/MARGEM|\bLUCRO\b|LUCRATIV|RENTABIL|CUSTO DOS? PRODUTOS?|\bCMV\b/.test(t)) return '📭 *Margem, lucro e rentabilidade* eu não tenho: a base não traz custo nem preço de compra.\nO que eu tenho: faturado, preço médio de venda, devolução e corte. Ex.: "qual o preço médio do Snickers?".';
  if (/SEMESTRE|TRIMESTRE|MELHOR MES DO ANO|PIOR MES DO ANO|ANO PASSADO|ULTIMOS? \d+ MESES|NO ANO\b|ACUMULADO DO ANO|\bYTD\b/.test(t)) return '📭 *Histórico longo* (ano, semestre, ano passado) eu ainda não tenho aqui: comparo *este mês* com o *mês passado* (item a item, até o mesmo dia).\nEx.: "como estamos em relação ao mês passado?".';
  return null;
}
// O QUE OFERECER PARA O CLIENTE X = lista do +MIX daquele cliente (mesma do app do CEVEN; ja tira o que ele comprou nos ultimos 60 dias)
export async function respOferecer(B, E, t) {
  const arqs = await Promise.all(E.filiais.map((f) => B.raw(`public/mix_rec/${f}.json`).then((x) => { try { return x ? { f, ...JSON.parse(x) } : null; } catch (e) { return null; } })));
  const ok = arqs.filter(Boolean); if (!ok.length) return null;
  const rcas = (E.grupo || E.supervisor || E.rca) ? new Set(E.vend.map((v) => v.filial + '|' + v.rca)) : null;
  const toks = t.split(/[^A-Z0-9]+/).filter((w) => w.length > 2 && !PARADAS.has(w) && !FILIAIS.includes(w) && !/^(QUE|CLIENTE|LOJA|MERCADO|SUPERMERCADO|POSTO)$/.test(w));
  const num = (t.replace(/\D+/g, ' ').match(/\b\d{14}\b/) || [])[0];
  let best = null, bs = 0;
  for (const a of ok) for (const [cnpj, c] of Object.entries(a.clientes || {})) {
    if (rcas && !rcas.has(a.f + '|' + c.rca)) continue;
    const n = sem(c.n); const sc = (num && cnpj === num ? 10 : 0) + toks.filter((w) => n.split(/[^A-Z0-9]+/).includes(w)).length;
    if (sc > bs) { bs = sc; best = { f: a.f, cnpj, c }; }
  }
  if (!best || bs < Math.min(2, toks.length)) return null;
  const v = E.vend.find((x) => x.filial === best.f && String(x.rca) === String(best.c.rca));
  const rec = best.c.rec || [];
  if (!rec.length) return `🧺 *${titulo(best.c.n)}* (${best.f}${v ? ' · ' + vn(v) : ''}): o +MIX não tem produto novo para sugerir agora (ele já compra o que os parecidos compram).`;
  return [`🧺 *O que oferecer — ${titulo(best.c.n)}* (${best.c.a || 'cliente'} · ${best.f}${v ? ' · ' + vn(v) : ' · RCA ' + best.c.rca})`, ...rec.slice(0, 10).map(([cod, nome, ind]) => `• ${titulo(nome)} (${nomeIndustria([ind])}) · cód. ${cod}`), '', SUGESTAO + 'levar os 3 primeiros na próxima visita; são os que clientes parecidos compram e ele ainda não.', '_Lista do +MIX (sem o que ele comprou nos últimos 60 dias)._'].join('\n');
}
