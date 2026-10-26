// =========================================================================
// JOTA · functions/_lib/jota/respostas/resumo.js
// O QUE É: resumo, hoje, supervisor, vendedor, quanto falta.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { sn } from '../escopo.js';
import { N, P, R$, SUGESTAO, VAREJO, diasUteisRestantes, nome2, sem, titulo, vn } from '../base.js';
import { agrupa, listaNomes, pctTxt, supChave, supNome, supReal } from '../escopo.js';
import { diasUteisMes } from './gestao.js';

// ---------------- RESPOSTAS ----------------
export async function respResumo(B, E) {
  const s = await B.saude(); const hora = s ? s.hora_sp : '';
  if (E.nacional) {
    const F = (s && s.filiais) || []; const t = F.reduce((a, f) => ({ fat: a.fat + (f.faturado || 0), pend: a.pend + (f.pendente || 0), meta: a.meta + (f.meta_fat || 0), pos: a.pos + (f.positivados || 0), mpos: a.mpos + (f.meta_pos || 0), dig: a.dig + (f.digitado_hoje || 0) }), { fat: 0, pend: 0, meta: 0, pos: 0, mpos: 0, dig: 0 });
    const V = E.vend.filter((v) => v.varejo); const z = V.filter((v) => v.zerado);
    const L = [`📊 *Brasil — 11 filiais* (${hora})`, `💰 Faturado: *${R$(t.fat)}* de ${R$(t.meta)} → *${P(t.fat, t.meta)}*`, `⏳ Pendente: ${R$(t.pend)}`, `👥 Positivação: ${N(t.pos)} de ${N(t.mpos)} (${P(t.pos, t.mpos)})`,
      `📝 Digitado hoje: *${R$(t.dig)}* em *${N(E.macro.pedidos)}* pedidos`, `🚶 Rota do varejo hoje: ${N(V.reduce((a, v) => a + v.visF, 0))} de ${N(V.reduce((a, v) => a + v.visP, 0))} visitas · zerados: ${z.length}`, '', '*Por filial (% da meta faturada):*'];
    for (const f of F.slice().sort((a, b) => (b.faturado / b.meta_fat) - (a.faturado / a.meta_fat))) {
      const zf = V.filter((v) => v.filial === f.filial && v.zerado).length;
      L.push(`• *${f.filial}* ${P(f.faturado || 0, f.meta_fat)} · ${R$(f.faturado)} · pend. ${R$(f.pendente)} · hoje ${R$(f.digitado_hoje)} · ${zf} zerado(s)`);
    }
    const pior = F.slice().sort((a, b) => (a.faturado / a.meta_fat) - (b.faturado / b.meta_fat))[0];
    L.push('', SUGESTAO + (pior ? `olhar ${pior.filial} (${P(pior.faturado || 0, pior.meta_fat)} da meta), a mais atrás no mês.` : 'acompanhar as filiais mais atrás.'), '_Peça uma filial (ex.: "TPH"), "zerados", "hoje", "liga", "ajuda"._');
    return L.join('\n');
  }
  const fil = E.filiais[0]; const f = s && (s.filiais || []).find((x) => x.filial === fil);
  const V = E.vend; const G = agrupa(V, (v) => 'x').get('x') || { fat: 0, pend: 0, meta: 0 };
  const fat = (E.grupo || E.supervisor || E.rca) ? G.fat : f ? f.faturado : null, pend = (E.grupo || E.supervisor || E.rca) ? G.pend : f ? f.pendente : null, meta = (E.grupo || E.supervisor || E.rca) ? G.meta : f ? f.meta_fat : null;
  const Vr = V.filter((v) => v.varejo), z = Vr.filter((v) => v.zerado), com = V.filter((v) => v.pct != null);
  const L = [`📊 *${E.nome} agora* (${hora})`, `💰 Faturado: *${R$(fat)}* de ${R$(meta)} → *${P(fat || 0, meta)}*`, `⏳ Pendente: ${R$(pend)}`];
  if (!(E.grupo || E.supervisor || E.rca) && f) L.push(`👥 Positivação: ${N(f.positivados)} de ${N(f.meta_pos)} (${P(f.positivados, f.meta_pos)})`); else L.push(`👥 Positivação: ${N(G.pos)} de ${N(G.metaPos)} (${P(G.pos, G.metaPos)})`);
  L.push(`📝 Digitado hoje: *${R$((E.grupo || E.supervisor || E.rca) ? G.dig : f ? f.digitado_hoje : E.macro.dig)}* em *${N((E.grupo || E.supervisor || E.rca) ? G.ped : E.macro.pedidos)}* pedidos`,
    `🚶 Rota do varejo hoje: ${Vr.reduce((a, v) => a + v.visF, 0)} de ${Vr.reduce((a, v) => a + v.visP, 0)} visitas · sem nenhuma visita: ${Vr.filter((v) => v.semVisita).length}`,
    `🏁 Meta batida no mês (fat.+pend.): ${V.filter((v) => v.meta && v.fat + v.pend >= v.meta).length} de ${V.length} vendedores`, `↩️ Devoluções no mês: ${R$(V.reduce((a, v) => a + v.dev, 0))}`);
  const lc = await B.lances(); if (lc) { const Lf = (lc.lances || []).filter((l) => l.filial === fil && (!(E.grupo || E.supervisor || E.rca) || V.some((v) => v.rca === String(l.rca)))); L.push(`⚽ Hoje: ${Lf.filter((l) => l.nivel === 'gol').length} gol(s) · ${Lf.filter((l) => l.nivel === 'penalti').length} pênalti(s) · ${Lf.filter((l) => l.nivel === 'impedimento').length} impedimento(s)`); }
  if (!(E.grupo || E.supervisor || E.rca)) { const Gr = [...agrupa(V.filter((v) => v.grupo), (v) => v.grupo)]; if (Gr.length > 1) { L.push('*Por gerente:*'); for (const [g, x] of Gr) L.push(`• ${titulo(g)}: ${R$(x.fat)} (${pctTxt(x.pct)}) · pend. ${R$(x.pend)} · ${x.zerados} zerado(s)`); } }
  const lg = await B.liga(); const lf = lg && (lg.filiais || []).find((x) => x.sigla === fil); if (lf) L.push(`🏆 Liga: ${lf.pos}º de 11, ${lf.pts_tabela} pontos (${lf.vitorias}V ${lf.empates}E ${lf.derrotas}D)`);
  L.push(`⚠️ Zerados hoje (varejo com rota): *${z.length}*` + (z.length ? ' — ' + listaNomes(z) : ''));
  if (com.length) L.push(`✅ Melhores na meta: ${com.slice(0, 2).map((v) => `${vn(v)} ${pctTxt(v.pct)}`).join(' · ')}`, `🔻 Mais atrás: ${com.slice(-2).reverse().map((v) => `${vn(v)} ${pctTxt(v.pct)}`).join(' · ')}`);
  const sz = [...agrupa(Vr, (v) => v.supervisor || 'sem supervisor')].filter(([k]) => supReal(k)).sort((a, b) => b[1].zerados - a[1].zerados)[0];
  { const { tot, pass } = diasUteisMes(), esp = tot ? pass / tot * 100 : 0, pr = meta ? (fat || 0) / meta * 100 : null;
    if (pr != null) L.push('', `👀 *Leitura do Jota:* ${pr >= esp ? 'no ritmo ou acima' : pr >= esp * 0.9 ? 'jogo apertado, dá pra virar' : 'abaixo do ritmo, precisamos reagir'} (o calendário pede ${esp.toFixed(0)}% e estamos em ${pr.toFixed(1).replace('.', ',')}%).`); }
  L.push('', SUGESTAO + (sz && sz[1].zerados ? `falar com ${supNome(sz[0])} — ${sz[1].zerados} vendedor(es) dele sem pedido hoje.` : 'puxar os mais atrás na meta para fechar o mês.'), '_Peça "hoje", "por supervisor", "zerados", "falta", "liga", "ajuda"._');
  return L.join('\n');
}

// acumulado do dia (rota = varejo)
export async function respHoje(B, E, t) {
  // equipe sem varejo (ex.: AS) pedindo 'rota de hoje' -> mostra a equipe toda (26/10/2026, Cristiano/TSJ recebeu '0 de 0')
  const soVarejo = /ROTA|VAREJO|CAMPO|\bVJ\b/.test(t) && E.vend.some((v) => v.varejo);
  const V = soVarejo ? E.vend.filter((v) => v.varejo) : E.vend;
  const rot = soVarejo ? ' (varejo de rota)' : '';
  const hora = (await B.saude() || {}).hora_sp || '';
  if (E.nacional) {
    const G = [...agrupa(V, (v) => v.filial)].sort((a, b) => b[1].dig - a[1].dig);
    const tot = { ...(agrupa(V, () => 'x').get('x') || { dig: 0, ped: 0, visF: 0, visP: 0, comVenda: 0, zerados: 0 }) };
    if (!soVarejo) { tot.dig = E.macro.dig; tot.ped = E.macro.pedidos; for (const g of G) { const m = E.porFilial[g[0]].macro; g[1].dig = m.dig; g[1].ped = m.pedidos; } G.sort((a, b) => b[1].dig - a[1].dig); }
    if (/TICKET/.test(t)) return [`🧾 *Ticket médio de hoje — Brasil${rot}*: *${tot.ped ? R$(tot.dig / tot.ped) : 'sem dado'}* (${R$(tot.dig)} ÷ ${N(tot.ped)} pedidos)`, ...G.map(([f, x]) => `• ${f}: ${x.ped ? R$(x.dig / x.ped) : 'sem dado'}`)].join('\n');
    return [`📝 *Hoje no Brasil${rot}* (${hora})`, `Digitado: *${R$(tot.dig)}* em *${N(tot.ped)}* pedidos · ticket ${tot.ped ? R$(tot.dig / tot.ped) : 'sem dado'}`, `Visitas da rota: ${N(tot.visF)} de ${N(tot.visP)} · com venda: ${N(tot.comVenda)} · zerados: ${tot.zerados}`, '',
      ...G.map(([f, x]) => `• *${f}* ${R$(x.dig)} · ${x.ped} ped. · visitas ${x.visF}/${x.visP} · ${x.zerados} zerado(s)`),
      soVarejo ? '' : '_Totais com todos os canais; peça "hoje rota" para só o varejo._', SUGESTAO + `ver os zerados da filial com mais vendedores sem pedido: ${(G.slice().sort((a, b) => b[1].zerados - a[1].zerados)[0] || [''])[0]}.`].filter((x) => x !== null).join('\n');
  }
  const tot = { ...(agrupa(V, () => 'x').get('x') || { dig: 0, ped: 0, visF: 0, visP: 0, comVenda: 0, zerados: 0 }) };
  if (!soVarejo && !E.grupo && !E.supervisor && !E.rca) { tot.dig = E.macro.dig; tot.ped = E.macro.pedidos; }
  if (/TICKET/.test(t)) return `🧾 *Ticket médio de hoje — ${E.nome}${rot}*: *${tot.ped ? R$(tot.dig / tot.ped) : 'sem dado'}* (${R$(tot.dig)} ÷ ${tot.ped} pedidos)`;
  const Vs = V.slice().sort((a, b) => b.dig - a.dig);
  const L = [`📝 *${E.nome} hoje${rot}* (${hora})`, `Digitado: *${R$(tot.dig)}* em *${tot.ped}* pedidos · ticket ${tot.ped ? R$(tot.dig / tot.ped) : 'sem dado'}`, ...(tot.visP ? [`Visitas da rota: ${tot.visF} de ${tot.visP} · com venda: ${tot.comVenda} · zerados: ${tot.zerados}`] : []), ''];
  for (const v of Vs.slice(0, 40)) L.push(`• ${v.zerado ? '⚠️' : v.dig > 0 ? '✅' : '▫️'} ${vn(v)}: ${R$(v.dig)} · ${v.ped} ped.` + (v.varejo ? ` · visitas ${v.visF}/${v.visP}` : ` · ${v.canal || 'sem canal'}`));
  if (Vs.length > 40) L.push(`… e mais ${Vs.length - 40}`);
  const z = V.filter((v) => v.zerado);
  L.push('', SUGESTAO + (z.length ? `cobrar quem tem rota e está sem pedido: ${listaNomes(z, 3)}.` : !tot.ped ? 'ainda sem pedido hoje; acompanhar a primeira visita de cada vendedor.' : V.some((v) => !v.ped) ? `ainda sem pedido hoje: ${listaNomes(V.filter((v) => !v.ped), 3)}.` : 'todo mundo com rota já tem pedido; focar em mix por cliente.'));
  return L.join('\n');
}

export function respPorSupervisor(E) {
  const S = [...agrupa(E.vend, (v) => supChave(v, E.nacional))].filter(([k]) => supReal(k)).sort((a, b) => (b[1].pct ?? -1) - (a[1].pct ?? -1));
  if (!S.length) return `Sem dados por supervisor de ${E.nome} agora.`;
  const L = [`👥 *${E.nome} por supervisor* (% da meta faturada)`, ...S.map(([s, x]) => `• *${supNome(s)}* ${pctTxt(x.pct)} · ${R$(x.fat)} · pend. ${R$(x.pend)} · hoje ${R$(x.dig)} · ${x.zerados} zerado(s)`)];
  const pior = S[S.length - 1]; L.push('', SUGESTAO + `conversar com ${supNome(pior[0])} (${pctTxt(pior[1].pct)}), o mais atrás.`, '_Peça "supervisor Nome" para ver os vendedores dele._');
  return L.join('\n');
}
export function respSupervisor(E, s) {
  const V = E.vend.filter((v) => v.supervisor === s.nome && v.filial === s.filial);
  const x = agrupa(V, () => 'x').get('x');
  return [`👤 *${titulo(s.nome)}* (${s.filial}) — ${pctTxt(x.pct)} da meta · fat. ${R$(x.fat)} · pend. ${R$(x.pend)}`, `Positivação: ${x.pos} de ${x.metaPos} (${P(x.pos, x.metaPos)}) · hoje ${R$(x.dig)} em ${x.ped} ped. · visitas ${x.visF}/${x.visP}`, '',
    ...V.map((v) => `• ${v.zerado ? '⚠️' : '✅'} *${vn(v)}* ${pctTxt(v.pct)} · fat. ${R$(v.fat)} · pend. ${R$(v.pend)} · hoje ${R$(v.dig)} (${v.ped} ped.)` + (v.varejo ? ` · visitas ${v.visF}/${v.visP}` : '')),
    '', V.some((v) => v.zerado) ? SUGESTAO + `ligar agora para ${listaNomes(V.filter((v) => v.zerado), 3)} (rota sem pedido hoje).` : SUGESTAO + 'equipe com pedido hoje; foco em mix nos próximos clientes.'].join('\n');
}
export async function respVendedor(B, E, v) {
  const dn = diasUteisRestantes(); const falta = Math.max(0, v.meta - v.fat), faltaPos = v.metaPos != null && v.pos != null ? Math.max(0, v.metaPos - v.pos) : null;
  const L = [`🧑‍💼 *${v.rca} - ${titulo(v.nome)}* — ${v.filial} · sup. ${sn(v.supervisor, v.supCod)} · ${v.canal || 'sem canal'}`,
    `💰 Faturado: *${R$(v.fat)}* de ${R$(v.meta)} → *${pctTxt(v.pct)}* · pendente ${R$(v.pend)}`, `🎯 Falta: ${R$(falta)}` + (falta && dn ? ` · ${R$(falta / dn)} por dia útil (${dn} dias)` : ''),
    `👥 Positivação: ${v.pos ?? 'sem dado'} de ${v.metaPos ?? 'sem dado'} (${P(v.pos, v.metaPos)})` + (faltaPos ? ` · faltam ${faltaPos} clientes` : ''),
    `📝 Hoje: ${R$(v.dig)} em ${v.ped} pedido(s)` + ` · ticket ${v.ped ? R$(v.dig / v.ped) : 'sem pedido hoje'}` + (v.varejo ? ` · visitas ${v.visF} de ${v.visP} · com venda ${v.comVenda}` : ''), `↩️ Devolução no mês: ${R$(v.dev)}`];
  if (v.varejo && v.visPlanMes) L.push(`📅 Rota do mês: ${v.visRealMes} de ${v.visPlanMes} visitas (${P(v.visRealMes, v.visPlanMes)})`);
  const lg = await B.liga(); const lv = lg && (lg.vendedores || []).find((x) => String(x.rca) === v.rca && x.filial === v.filial);
  if (lv) L.push(`🏆 Liga: ${lv.pos_brasil}º no Brasil · ${lv.pos_filial}º na filial · ${lv.pts_tabela} pts (${lv.vitorias}V ${lv.empates}E ${lv.derrotas}D)`);
  const mx = await B.mix(); const mv = mx && (mx.vendedores || []).find((x) => String(x.rca) === v.rca && x.filial === v.filial);
  if (mv) L.push(`🧺 +MIX: ${String(mv.mix_medio).replace('.', ',')} produtos/cliente · uso ${mv.uso_pct == null ? 'sem dado' : String(mv.uso_pct).replace('.', ',') + '%'}`);
  const lc = await B.lances(); const hj = lc ? (lc.lances || []).filter((l) => String(l.rca) === v.rca && l.filial === v.filial) : [];
  if (hj.length) { const c = {}; for (const l of hj) c[l.pontos_nome || l.nivel] = (c[l.pontos_nome || l.nivel] || 0) + 1; L.push(`⚽ Hoje na Liga: *${hj.reduce((a, l) => a + (l.pontos || 0), 0)} pontos* em ${hj.length} lance(s) — ` + Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${n}× ${k}`).join(' · ')); }
  L.push('', SUGESTAO + (v.zerado ? 'está com rota e sem pedido hoje: ligar já.' : falta > 0 ? `precisa de ${R$(falta / Math.max(dn, 1))} por dia útil; priorizar clientes curva A e o +MIX.` : 'meta financeira batida; buscar positivação e mix.'));
  return L.join('\n');
}
export async function totaisOficiais(B, E) {
  const x = { ...(agrupa(E.vend, () => 'x').get('x') || { fat: 0, pend: 0, meta: 0, pos: 0, metaPos: 0 }) };
  if (E.grupo || E.supervisor || E.rca) return x;   /* grupo (TPH/MCD) ou equipe do supervisor: soma dos vendedores */
  const s = await B.saude(); const F = ((s && s.filiais) || []).filter((f) => E.filiais.includes(f.filial)); if (!F.length) return x;
  x.fat = F.reduce((a, f) => a + (f.faturado || 0), 0); x.pend = F.reduce((a, f) => a + (f.pendente || 0), 0); x.meta = F.reduce((a, f) => a + (f.meta_fat || 0), 0);
  x.pos = F.reduce((a, f) => a + (f.positivados || 0), 0); x.metaPos = F.reduce((a, f) => a + (f.meta_pos || 0), 0); x.pct = x.meta ? x.fat / x.meta * 100 : null; return x;
}
export async function respFalta(B, E) {
  const dn = diasUteisRestantes(); const x = await totaisOficiais(B, E);
  if (!x.meta) return 'Sem dado agora.';
  const falta = Math.max(0, x.meta - x.fat), fpos = Math.max(0, x.metaPos - x.pos);
  const L = [`🎯 *${E.nome} — quanto falta* (${dn} dias úteis seg–sex, sem descontar feriados)`, `💰 Meta ${R$(x.meta)} · faturado ${R$(x.fat)} (${pctTxt(x.pct)}) · pendente ${R$(x.pend)}`,
    `Falta faturar: *${R$(falta)}* → *${R$(dn ? falta / dn : falta)} por dia útil* (MN)`, `Pendente cobre ${P(Math.min(x.pend, falta), falta || 1)} do que falta`,
    `👥 Positivação: falta *${N(fpos)}* clientes → *${N(dn ? Math.ceil(fpos / dn) : fpos)} por dia útil*`, ''];
  // ABRE UM NIVEL ABAIXO (26/10/2026: o Allison recebia "quem mais falta (supervisor): Allison"): supervisor -> vendedores
  const porVend = !!E.supervisor;
  const G = porVend ? E.vend.filter((v) => v.meta > 0).map((v) => [vn(v), Math.max(0, v.meta - v.fat), { pct: v.pct }]).sort((a, b) => b[1] - a[1])
    : [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([k]) => supReal(k)).map(([k, y]) => [k, Math.max(0, y.meta - y.fat), y]).sort((a, b) => b[1] - a[1]);
  const nm = (k) => (E.nacional || porVend ? k : nome2(k));
  L.push(`*Quem mais falta (${E.nacional ? 'filial' : porVend ? 'vendedor' : 'supervisor'}):*`, ...G.slice(0, 10).map(([k, f, y]) => `• ${nm(k)}: ${R$(f)} (${pctTxt(y.pct)})`));
  L.push('', SUGESTAO + (G[0] ? `o maior buraco é ${nm(G[0][0])}: ${R$(G[0][1])}.` : 'manter o ritmo.'));
  return L.join('\n');
}
