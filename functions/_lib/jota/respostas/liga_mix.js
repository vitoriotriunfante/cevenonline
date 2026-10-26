// =========================================================================
// JOTA · functions/_lib/jota/respostas/liga_mix.js
// O QUE É: lances, Liga, compromisso, +MIX, incentivo, glossário, ajuda.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import R from '../../../../public/regras.js'; // regras unicas (public/regras.js)
import { P, R$, SUGESTAO, nome2, sem, titulo, vn } from '../base.js';
import { agrupa, listaNomes, pctTxt } from '../escopo.js';

export async function respLances(B, E, t) {
  const lc = await B.lances(); if (!lc) return 'Não consegui ler os lances de hoje agora.';
  const rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  let L = (lc.lances || []).filter((l) => E.filiais.includes(l.filial) && (!(E.grupo || E.supervisor || E.rca) || rcas.has(l.filial + '|' + l.rca)));
  const tipos = [['PENALTI', 'penalti'], ['IMPEDIMENTO', 'impedimento'], ['VERMELHO', 'vermelho'], ['AMARELO', 'amarelo'], ['CARTAO', 'vermelho|amarelo'], ['GOL CONTRA', 'golcontra'], ['HAT', 'hattrick'], ['DEFESA', 'defesa'], ['GOL', 'gol']];
  const tp = tipos.find(([k]) => t.includes(k));
  const cont = {}; for (const l of L) cont[l.nivel] = (cont[l.nivel] || 0) + 1;
  const out = [`⚽ *Lances de hoje — ${E.nome}*`, Object.entries(cont).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(' · ') || 'nenhum lance ainda'];
  if (tp) {
    const re = new RegExp('^(' + tp[1] + ')$'); const S = L.filter((l) => re.test(l.nivel));
    out.push('', `*${titulo(tp[0])} (${S.length}):*`);
    for (const l of S.slice(0, 15)) out.push(`• ${l.hora ? l.hora.slice(0, 5) : ''} ${nome2(l.vendedor)}${E.nacional ? ' ' + l.filial : ''} — ${titulo(l.cliente || '')} · ${l.pontos > 0 ? '+' : ''}${l.pontos} · ${l.pontos_motivo || l.motivo || ''}`);
    if (S.length > 15) out.push(`… e mais ${S.length - 15}`);
    const quem = [...agrupa(S.map((l) => ({ ...l, nome: l.vendedor, fat: 0, pend: 0, meta: 0, dig: 0, ped: 0, dev: 0, visP: 0, visF: 0, comVenda: 0 })), (l) => l.vendedor)].sort((a, b) => b[1].V.length - a[1].V.length)[0];
    if (quem && tp[1] !== 'gol' && tp[1] !== 'defesa' && tp[1] !== 'hattrick') out.push('', SUGESTAO + `conversar com ${nome2(quem[0])} (${quem[1].V.length} lance(s) desse tipo hoje).`);
  } else out.push('', '_Peça "pênaltis", "impedimentos", "cartões", "gols" para ver quem e por quê._');
  return out.join('\n');
}
export async function respLiga(B, E, alvo) {
  const lg = await B.liga(); if (!lg) return 'Não consegui ler a Liga agora.';
  if (alvo) { const lv = (lg.vendedores || []).find((x) => String(x.rca) === alvo.rca && x.filial === alvo.filial); if (lv) { const mv = (lv.pos_brasil_ant || lv.pos_brasil) - lv.pos_brasil; return `🏆 *${titulo(lv.nome)}* (${lv.filial}): ${lv.pos_brasil}º no Brasil (${mv > 0 ? '▲' + mv : mv < 0 ? '▼' + -mv : '='} desde o último jogo) · ${lv.pos_filial}º na filial · ${lv.pts_tabela} pts · ${lv.vitorias}V ${lv.empates}E ${lv.derrotas}D · forma ${(lv.forma || []).slice(-5).join('')}`; } }
  if (E.nacional) {
    return ['🏆 *Champions Triunfante — Brasil*', '*Filiais:*', ...(lg.filiais || []).slice().sort((a, b) => a.pos - b.pos).map((f) => `${f.pos}º ${f.sigla} — ${f.pts_tabela} pts (${f.vitorias}V ${f.empates}E ${f.derrotas}D)`),
      '*Top 5 vendedores (varejo):*', ...(lg.vendedores || []).filter((v) => v.canal !== 'AS').sort((a, b) => a.pos_brasil - b.pos_brasil).slice(0, 5).map((v) => `${v.pos_brasil}º ${vn(v)} ${v.filial} — ${v.pts_tabela} pts`), ''].join('\n');
  }
  const fil = E.filiais[0]; const lf = (lg.filiais || []).find((x) => x.sigla === fil);
  const sups = new Set(E.vend.map((v) => v.supervisor));
  return [`🏆 *Champions Triunfante — ${E.nome}*`, lf ? `Filial: *${lf.pos}º de 11*, ${lf.pts_tabela} pts (${lf.vitorias}V ${lf.empates}E ${lf.derrotas}D)` : 'Filial: sem dado',
    '*Supervisores:*', ...(lg.supervisores || []).filter((x) => x.filial === fil && (!(E.grupo || E.supervisor || E.rca) || sups.has(x.supervisor))).sort((a, b) => a.pos - b.pos).slice(0, 10).map((x) => `${x.pos}º ${nome2(x.supervisor)} — ${x.pts_tabela} pts`),
    '*Top vendedores da filial:*', ...(lg.vendedores || []).filter((v) => v.filial === fil && (!(E.grupo || E.supervisor || E.rca) || E.vend.some((y) => y.rca === String(v.rca)))).sort((a, b) => a.pos_filial - b.pos_filial).slice(0, 5).map((v) => `${v.pos_filial}º ${vn(v)} — ${v.pts_tabela} pts (${v.pos_brasil}º Brasil)`),
    ''].join('\n');
}
export async function respCompromisso(B, E) {
  const R = await Promise.all(E.filiais.map((f) => B.sups(f).then((j) => ({ f, S: (j && j.supervisores) || null }))));
  const sups = new Set(E.vend.map((v) => v.filial + '|' + v.supervisor));
  const all = R.flatMap(({ f, S }) => (S || []).filter((x) => !/^GERENTE/i.test(x.nome) && (!(E.grupo || E.supervisor || E.rca) || sups.has(f + '|' + x.nome))).map((x) => ({ ...x, filial: f })));
  if (!all.length) return `Não consegui ler o compromisso dos supervisores de ${E.nome} agora.`;
  const semC = all.filter((x) => !x.fez_compromisso), semR = all.filter((x) => !x.iniciou_ret);
  const nm = (x) => nome2(x.nome) + (E.nacional ? ' ' + x.filial : '');
  const L = [`🗓️ *Supervisores — ${E.nome} hoje* (${all.length})`, `Compromisso matinal: *${all.length - semC.length} fizeram* · *${semC.length} não fizeram*`];
  if (semC.length) L.push('Não fizeram: ' + semC.map(nm).join(', '));
  L.push(`Rota com vendedor (RET): *${all.length - semR.length} iniciaram* · *${semR.length} não*`);
  if (semR.length) { if (E.nacional) { const G = {}; for (const x of semR) (G[x.filial] = G[x.filial] || []).push(nome2(x.nome)); for (const [f, n] of Object.entries(G)) L.push(`• *${f}* (${n.length}): ${n.join(', ')}`); } else L.push('Não iniciaram: ' + semR.map(nm).join(', ')); }
  if (!E.nacional) for (const x of all.filter((y) => y.iniciou_ret && y.retDetalhe && y.retDetalhe.pdvs)) L.push(`• ${nm(x)}: ${x.retDetalhe.pdvs} PDV(s) na RET, 1º check-in ${x.retDetalhe.primeiroCheckin || '—'}`);
  const falhou = R.filter((r) => !r.S).map((r) => r.f); if (falhou.length) L.push(`_Sem leitura agora: ${falhou.join(', ')}._`);
  L.push('', SUGESTAO + (semC.length ? `cobrar o compromisso de ${semC.slice(0, 3).map(nm).join(', ')}.` : semR.length ? `${semR.length} supervisor(es) sem RET hoje; cobrar presença em campo.` : 'todos fizeram compromisso e RET.'));
  return L.join('\n');
}
export async function respMix(B, E, t) {
  const mx = await B.mix(); if (!mx) return 'Não consegui ler o +MIX agora.';
  const rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const V = (mx.vendedores || []).filter((x) => E.filiais.includes(x.filial) && (!(E.grupo || E.supervisor || E.rca) || rcas.has(x.filial + '|' + x.rca)));
  // produto: "quem compra X", "produto X"
  const m = t.match(/(?:PRODUTO|QUEM COMPRA|QUEM VENDE|VENDE MAIS|SKU)\s+(?:O |A |DE |DO |DA )?([A-Z0-9 ]{3,})/);
  if (m) {
    const q = m[1].trim().split(/\s+/).filter((w) => w.length > 2 && !/^(MAIS|HOJE|MES|NO|NA|EM)$/.test(w));
    const hit = []; for (const v of V) for (const s of v.top_skus || []) if (q.length && q.every((w) => sem(s.n).includes(w))) hit.push({ v, s });
    if (!hit.length) return `Não achei "${titulo(q.join(' '))}" entre os produtos mais vendidos dos vendedores de ${E.nome} neste mês (${mx.mes || ''}). Tente outro nome do produto.`;
    hit.sort((a, b) => b.s.cli - a.s.cli);
    return [`🧺 *${titulo(hit[0].s.n)}* — quem mais vende em ${E.nome} (clientes no mês):`, ...hit.slice(0, 12).map(({ v, s }) => `• ${vn(v)}${E.nacional ? ' ' + v.filial : ''}: ${s.cli} clientes (${String(s.pct).replace('.', ',')}% da carteira atendida) · ${R$(s.val)}`), '', SUGESTAO + 'quem tem pouca penetração nesse produto pode oferecer no próximo cliente do +MIX.'].join('\n');
  }
  const tot = V.reduce((a, v) => ({ cli: a.cli + (v.clientes_com_lista || 0), usou: a.usou + (v.clientes_usou || 0) }), { cli: 0, usou: 0 });
  const S = V.slice().sort((a, b) => (b.mix_medio || 0) - (a.mix_medio || 0));
  const usam = V.filter((v) => v.uso_pct != null).sort((a, b) => b.uso_pct - a.uso_pct);
  return [`🧺 *+MIX — ${E.nome}* (${mx.mes || 'mês'}, dados até ${mx.dados_ate || '—'})`, `Uso real: *${tot.usou}* de *${tot.cli}* clientes com lista compraram produto recomendado (${P(tot.usou, tot.cli)})`,
    '*Mais mix por cliente:*', ...S.slice(0, 5).map((v) => `• ${vn(v)}${E.nacional ? ' ' + v.filial : ''}: ${String(v.mix_medio).replace('.', ',')} produtos/cliente · ${R$(v.faturado_por_cliente)}/cliente`),
    '*Menos mix por cliente:*', ...S.slice(-5).reverse().map((v) => `• ${vn(v)}${E.nacional ? ' ' + v.filial : ''}: ${String(v.mix_medio).replace('.', ',')} produtos/cliente`),
    usam.length ? `*Quem mais usa o +MIX:* ${usam.slice(0, 3).map((v) => `${vn(v)} ${String(v.uso_pct).replace('.', ',')}%`).join(' · ')}` : '',
    '', SUGESTAO + (S.length ? `${nome2(S[S.length - 1].nome)} tem o menor mix: abrir o +MIX em cada cliente antes do pedido.` : 'usar o +MIX antes de cada pedido.'), '_Peça "quem compra NOME DO PRODUTO"._'].filter(Boolean).join('\n');
}
export function respIncentivo(E) {
  const V = E.vend.filter((v) => v.varejo && v.meta && v.metaPos);
  const pf = (v) => v.fat / v.meta * 100, pp = (v) => v.pos / v.metaPos * 100;
  const ok = V.filter((v) => pf(v) >= 110 && pp(v) >= 110), quase = V.filter((v) => !ok.includes(v) && pf(v) >= 95 && pp(v) >= 95).sort((a, b) => Math.min(pf(b), pp(b)) - Math.min(pf(a), pp(a)));
  const g1 = V.filter((v) => pp(v) >= 60);
  return [`🏆 *Incentivo Outubro — ${E.nome}* (varejo)`, 'Regras: R$ 150 se ≥60% da positivação até 15/10 · R$ 350 se ≥110% positivação *e* ≥110% faturado em 31/10 · +R$ 30 por cliente novo do LinkUp com 1ª compra faturada.',
    `Hoje já com ≥110%/110%: *${ok.length} de ${V.length}*` + (ok.length ? ' — ' + listaNomes(ok, 6) : ''), `Perto (≥95% nos dois): ${quase.length}` + (quase.length ? ' — ' + quase.slice(0, 6).map((v) => `${vn(v)} (${pctTxt(pf(v))}/${pctTxt(pp(v))})`).join(', ') : ''),
    `Com ≥60% da positivação hoje: ${g1.length} de ${V.length}`, '_Valor oficial do prêmio = apuração da Premiação RV com faturado; aqui é a leitura de agora._', '', SUGESTAO + (quase.length ? `empurrar ${listaNomes(quase, 3)}: estão perto dos 110%.` : 'focar positivação: é a régua mais difícil.')].join('\n');
}
export const GLOSSARIO = [
  [/POSITIVA/, '*Positivação* = clientes (CNPJs distintos) com faturamento líquido > 0 no mês. Pedido 100% cortado ou devolvido inteiro não conta.'],
  [/\bMN\b|POR DIA UTIL|MEDIA NECESS/, '*MN* = quanto é preciso por dia útil restante para bater a meta (valor ou clientes).'],
  [/EFICACIA/, '*Eficácia* = visitas com venda ÷ visitas planejadas na rota (só varejo de campo).'],
  [/EFICIENCIA/, '*Eficiência* = visitas realizadas ÷ planejadas no mês (só varejo).'],
  [/RECORRENCIA/, '*Recorrência* = clientes com a tag RECORRÊNCIA, que já deveriam comprar. Vender neles é DEFESA na Liga (+3). Na premiação vale 10%.'],
  [/\bMIX\b/, '*Mix* = produtos (SKUs) diferentes por cliente. O *+MIX* recomenda o que os vizinhos do mesmo tipo compram (raio 3 km); comprou há 7–60 dias não recomenda.'],
  [/PENDENTE/, '*Pendente* = pedido digitado e ainda não faturado. O % da meta usa só o faturado.'],
  [/FATURAD/, '*Faturado líquido* = notas faturadas no mês menos devoluções.'],
  [/ZERAD/, '*Zerado* = vendedor do varejo com rota hoje e nenhum pedido digitado.'],
  [/\bRET\b/, '*RET* = rota do supervisor com o vendedor: checklist Preparação (3), Gôndola (4), Negociação (4), Fechamento (3) → score da visita e plano de ação.'],
  [/COMPROMISSO/, '*Compromisso do Dia* = o supervisor lança positivação e faturamento por vendedor até as 10h; a Vespertina compara com o realizado.'],
  [/PREMIA|\bRV\b/, '*Premiação RV* (varejo): Faturamento 40%, Positivação 30%, Recorrência 10%, Mix 20%; gatilho de 85% do faturamento mínimo.'],
  [/IMPEDIMENTO/, '*Impedimento* (−5): check-out fora do local (GPS entre 500 m e 5 km) ou check-in/check-out zerado (00:00).'],
  [/PENALTI/, '*Pênalti* (−6): ver o motivo no lance (regras da Liga).'],
  [/GOL CONTRA/, '*Gol contra* (−4): devolução por motivo comercial.'],
  [/VERMELHO/, '*Cartão vermelho* (−10): nenhuma visita até 10h ou devolução "cliente não pediu".'],
  [/DEFESA/, '*Defesa* (+3): venda em cliente com tag RECORRÊNCIA.'],
  [/LIGA|CHAMPIONS|PONTUA|VITORIA/, '*Liga*: vitória no dia = soma ≥ 11 pontos; lance só vale com prova; fechamento 19h30. Semana invicta +3.'],
];
export function respGlossario(t) { const h = GLOSSARIO.filter(([re]) => re.test(t)).map(([, s]) => s); return h.length ? h.join('\n\n') : null; }
export function respAjuda(c) {
  return [`Oi, ${titulo(String(c.nome).split(' ')[0])}! Sou o *Jota* ⚽, do +MIX. Pergunte do seu jeito, por exemplo:`, '• "como está?" / "como está TPH?"' + (c.papel === 'diretoria' ? ' (sem filial = Brasil todo)' : ''), '• "hoje" / "acumulado de hoje da rota"', '• "por supervisor" · "supervisor Nome" · "vendedor Nome"', '• "zerados" · "visitas" · "eficácia"', '• "quanto falta" · "positivação" · "ranking" · "top 10 hoje"', '• "devoluções" · "pênaltis" · "impedimentos" · "liga"', '• "compromisso" · "quem não fez RET"', '• "+mix" · "quem compra Oreo"', '• "incentivo" · "o que é positivação?"'].join('\n');
}
