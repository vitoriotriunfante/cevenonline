// =========================================================================
// JOTA · functions/_lib/jota/respostas/resumo.js
// O QUE É: resumo, hoje, supervisor, vendedor, quanto falta.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { sn } from '../escopo.js';
import { N, P, R$, SUGESTAO, VAREJO, diasUteisRestantes, hojeSP, nome2, sem, titulo, vn } from '../base.js';
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
  const V = E.vend;
  const Vtotais = V.concat((E.ocultos || []).filter((o) => (o.fat > 0 || o.pend > 0 || o.dig > 0) && (!E.supervisor || sem(o.supervisor) === sem(E.supervisor) || (o.nome && sem(o.nome).includes(sem(E.supervisor))))));
  const G = agrupa(Vtotais, (v) => 'x').get('x') || { fat: 0, pend: 0, meta: 0 };
  const fat = (E.grupo || E.supervisor || E.rca) ? G.fat : f ? f.faturado : null, pend = (E.grupo || E.supervisor || E.rca) ? G.pend : f ? f.pendente : null, meta = (E.grupo || E.supervisor || E.rca) ? G.meta : f ? f.meta_fat : null;
  const Vr = V.filter((v) => v.varejo), z = Vr.filter((v) => v.zerado);
  const com = V.filter((v) => v.pct != null).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const L = [`📊 *${E.nome} agora* (${hora})`, `💰 Faturado: *${R$(fat)}* de ${R$(meta)} → *${P(fat || 0, meta)}*`, `⏳ Pendente: ${R$(pend)}`];
  if (!(E.grupo || E.supervisor || E.rca) && f) L.push(`👥 Positivação: ${N(f.positivados)} de ${N(f.meta_pos)} (${P(f.positivados, f.meta_pos)})`); else L.push(`👥 Positivação: ${N(G.pos)} de ${N(G.metaPos)} (${P(G.pos, G.metaPos)})`);
  L.push(`📝 Digitado hoje: *${R$((E.grupo || E.supervisor || E.rca) ? G.dig : f ? f.digitado_hoje : E.macro.dig)}* em *${N((E.grupo || E.supervisor || E.rca) ? G.ped : E.macro.pedidos)}* pedidos`,
    /* equipe sem rota de varejo (AS): a linha nao aparece (26/10/2026: '0 de 0') */ ...(Vr.reduce((a, v) => a + v.visP, 0) ? [`🚶 Rota do varejo hoje: ${Vr.reduce((a, v) => a + v.visF, 0)} de ${Vr.reduce((a, v) => a + v.visP, 0)} visitas · sem nenhuma visita: ${Vr.filter((v) => v.semVisita).length}`] : []),
    `🏁 Meta batida no mês (fat.+pend.): ${V.filter((v) => v.meta && v.fat + v.pend >= v.meta).length} de ${V.length} vendedores`, `↩️ Devoluções no mês: ${R$(V.reduce((a, v) => a + v.dev, 0))}`);
  const lc = await B.lances(); if (lc) { const Lf = (lc.lances || []).filter((l) => l.filial === fil && (!(E.grupo || E.supervisor || E.rca) || V.some((v) => v.rca === String(l.rca)))); L.push(`⚽ Hoje: ${Lf.filter((l) => l.nivel === 'gol').length} gol(s) · ${Lf.filter((l) => l.nivel === 'penalti').length} pênalti(s) · ${Lf.filter((l) => l.nivel === 'impedimento').length} impedimento(s)`); }
  if (!(E.grupo || E.supervisor || E.rca)) { const Gr = [...agrupa(V.filter((v) => v.grupo), (v) => v.grupo)]; if (Gr.length > 1) { L.push('*Por gerente:*'); for (const [g, x] of Gr) L.push(`• ${titulo(g)}: ${R$(x.fat)} (${pctTxt(x.pct)}) · pend. ${R$(x.pend)} · ${x.zerados} zerado(s)`); } }
  const lg = await B.liga(); const lf = lg && (lg.filiais || []).find((x) => x.sigla === fil); if (lf) L.push(`🏆 Liga: ${lf.pos}º de 11, ${lf.pts_tabela} pontos (${lf.vitorias}V ${lf.empates}E ${lf.derrotas}D)`);
  L.push(`⚠️ Zerados hoje (varejo com rota): *${z.length}*` + (z.length ? ' — ' + listaNomes(z) : ''));
  if (com.length) {
    const nMelhores = Math.min(2, Math.max(1, Math.floor(com.length / 2)));
    const melhores = com.slice(0, nMelhores);
    L.push(`✅ Melhores na meta: ${melhores.map((v) => `${vn(v)} ${pctTxt(v.pct)}`).join(' · ')}`);
    const restantes = com.filter((v) => !melhores.includes(v));
    const abaixo100 = restantes.filter((v) => (v.pct ?? 0) < 100);
    const maisAtras = abaixo100.length ? abaixo100.slice(-2).reverse() : restantes.slice(-1);
    if (maisAtras.length) {
      L.push(`🔻 Mais atrás: ${maisAtras.map((v) => `${vn(v)} ${pctTxt(v.pct)}`).join(' · ')}`);
    }
  }
  const sz = [...agrupa(Vr, (v) => v.supervisor || 'sem supervisor')].filter(([k]) => supReal(k)).sort((a, b) => b[1].zerados - a[1].zerados)[0];
  { const { tot, pass } = diasUteisMes(), esp = tot ? pass / tot * 100 : 0, pr = meta ? (fat || 0) / meta * 100 : null;
    if (pr != null) L.push('', `👀 *Leitura do Jota:* ${pr >= esp ? 'no ritmo ou acima' : pr >= esp * 0.9 ? 'jogo apertado, dá pra virar' : 'abaixo do ritmo, precisamos reagir'} (o calendário pede ${esp.toFixed(0)}% e estamos em ${pr.toFixed(1).replace('.', ',')}%).`); }
  const dicaEscopo = E.supervisor ? 'por vendedor' : 'por supervisor';
  L.push('', SUGESTAO + (E.supervisor && z.length ? `ligar agora para ${listaNomes(z, 3)}: rota de hoje sem pedido.` : !E.supervisor && sz && sz[1].zerados ? `falar com ${supNome(sz[0])}: ${sz[1].zerados} vendedor(es) da equipe sem pedido hoje.` : 'puxar os mais atrás na meta para fechar o mês.'), `_Peça "hoje", "${dicaEscopo}", "zerados", "falta", "liga", "ajuda"._`);
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
  const Vtotais = V.concat((E.ocultos || []).filter((o) => (o.fat > 0 || o.pend > 0 || o.dig > 0) && (!E.supervisor || sem(o.supervisor) === sem(E.supervisor) || (o.nome && sem(o.nome).includes(sem(E.supervisor))))));
  const tot = { ...(agrupa(Vtotais, () => 'x').get('x') || { dig: 0, ped: 0, visF: 0, visP: 0, comVenda: 0, zerados: 0 }) };
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
export async function respVendedor(B, E, v, opt = {}) {   /* opt.tudo = "ver mais": so as listas completas */
  const dn = diasUteisRestantes(); const falta = Math.max(0, v.meta - v.fat - (v.pend || 0)), faltaPos = v.metaPos != null && v.pos != null ? Math.max(0, v.metaPos - v.pos) : null;
  const L = [`🧑‍💼 *${v.rca} - ${titulo(v.nome)}* — ${v.filial} · sup. ${sn(v.supervisor, v.supCod)} · ${v.canal || 'sem canal'}`,
    `💰 Faturado: *${R$(v.fat)}* + pendente ${R$(v.pend)} de ${R$(v.meta)} → *${pctTxt(v.meta ? (v.fat + (v.pend || 0)) / v.meta * 100 : null)}* da meta (igual ao CEVEN)`, `🎯 Falta: ${R$(falta)}` + (falta && dn ? ` · ${R$(falta / dn)} por dia útil (${dn} dias)` : ''),
    `👥 Positivação: ${v.pos ?? 'sem dado'} de ${v.metaPos ?? 'sem dado'} (${P(v.pos, v.metaPos)})` + (faltaPos ? ` · faltam ${faltaPos} clientes` : ''),
    `📝 Hoje: ${R$(v.dig)} em ${v.ped} pedido(s)` + ` · ticket ${v.ped ? R$(v.dig / v.ped) : 'sem pedido hoje'}` + (v.varejo ? ` · visitas ${v.visF} de ${v.visP} · com venda ${v.comVenda}` : ''), `↩️ Devolução no mês: ${R$(v.dev)}`];
  if (v.varejo && v.visPlanMes) L.push(`📅 Rota do mês: ${v.visRealMes} de ${v.visPlanMes} visitas (${P(v.visRealMes, v.visPlanMes)})`);
  const lg = await B.liga(); const lv = lg && (lg.vendedores || []).find((x) => String(x.rca) === v.rca && x.filial === v.filial);
  if (lv) L.push(`🏆 Liga: ${lv.pos_brasil}º no Brasil · ${lv.pos_filial}º na filial · ${lv.pts_tabela} pts (${lv.vitorias}V ${lv.empates}E ${lv.derrotas}D)`);
  const mx = await B.mix(); const mv = mx && (mx.vendedores || []).find((x) => String(x.rca) === v.rca && x.filial === v.filial);
  if (mv) L.push(`🧺 +MIX: ${String(mv.mix_medio).replace('.', ',')} produtos/cliente · uso ${mv.uso_pct == null ? 'sem dado' : String(mv.uso_pct).replace('.', ',') + '%'}`);
  const lc = await B.lances(); const hj = lc ? (lc.lances || []).filter((l) => String(l.rca) === v.rca && l.filial === v.filial) : [];
  if (hj.length) { const c = {}; for (const l of hj) c[l.pontos_nome || l.nivel] = (c[l.pontos_nome || l.nivel] || 0) + 1; L.push(`⚽ Hoje na Liga: *${hj.reduce((a, l) => a + (l.pontos || 0), 0)} pontos* em ${hj.length} lance(s) — ` + Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${n}× ${k}`).join(' · ')); }
  // PROATIVO (Vitorio, 26/10/2026: "como faltam 15 positivacoes para ela, esses sao os clientes que ela ja visitou e nao vendeu esse mes... com a data da visita e
  // quanto tempo estao sem compras"). Fonte: roteiro do mes do vendedor (base). Visitou (check-in) e o cliente nao comprou no mes.
  if (faltaPos && Array.isArray(v.roteiroMes) && v.roteiroMes.length) {
    const mes = hojeSP().slice(0, 7), C = new Map();
    // quem COMPROU no mes = vendas item a item (pedido na visita ou fora dela); o status da rota sozinho nao enxerga pedido feito fora da visita
    const { vendasEscopo } = await import('./vendas.js'); const VM = await vendasEscopo(B, { ...E, filiais: [v.filial], rca: v.rca, vend: [v] }).catch(() => null);
    // ULTIMA COMPRA REAL = historico do +MIX (cnpj -> 'cod:AAMMDD', 60 dias antes do mes). A data_ultima_compra do roteiro nao serve: 75 clientes da Brenda
    // vinham com 05/12/2025 (valor-padrao do CEVEN). Fora do historico = sem compra nos ultimos 60 dias.
    let H = {}; try { H = JSON.parse(await B.raw(`public/mix_hist/${v.filial}.json`) || '{}').c || {}; } catch (e) { H = {}; }
    const ultH = (cnpj) => { const x = H[String(cnpj || '').replace(/\D/g, '')]; if (!x) return null; const m = String(x).split(',').map((p) => p.split(':')[1]).filter(Boolean).sort().pop(); return m ? `20${m.slice(0, 2)}-${m.slice(2, 4)}-${m.slice(4, 6)}` : null; };
    const compraram = new Set(((VM && VM.linhas) || []).filter((l) => String(l.r) === String(v.rca)).map((l) => String(l.c)));
    for (const r of v.roteiroMes) {
      const k = String(r.id_cliente || r.cnpj || ''); if (!k) continue;
      const c = C.get(k) || { nome: r.nome_cliente || r.razao_social || 'Cliente', vis: '', uc: ultH(r.cnpj) || '', comprou: false };
      if (/POSITIVADO|EFETIVADO/.test(String(r.status || ''))) c.comprou = true;
      
      if (r.checkin_horario && String(r.data_visita || '').slice(0, 10) <= hojeSP() && String(r.data_visita || '') > c.vis) c.vis = String(r.data_visita).slice(0, 10);
      C.set(k, c);
    }
    const dias = (d) => (d ? Math.round((Date.parse(hojeSP()) - Date.parse(d)) / 864e5) : null);
    const lista = [...C.entries()].filter(([k, c]) => c.vis && !c.comprou && !(c.uc >= mes) && !compraram.has(k)).map(([k, c]) => ({ k, ...c, sem: dias(c.uc) })).sort((a, b) => (a.sem ?? 9999) - (b.sem ?? 9999));   /* quem comprou ha menos tempo primeiro: mais facil de recuperar */
    // FORMATO LIMPO (Vitorio, 27/10/2026: "no whats fica confuso... mostrar o cabecalho Cliente / Ultima visita / Dias sem compra... 5 da rota de hoje que nao
    // compraram, 5 que ele ja visitou e nao compraram e dar a opcao de ver mais"). "ver mais" logo depois abre a lista inteira (respVerMais).
    const dd = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`, semTxt = (n) => (n == null ? '+60 dias' : n + ' dias');
    let rotaSem = []; try { const { semCompraNaRota } = await import('./rota.js'); rotaSem = (await semCompraNaRota(B, v)).sem; } catch (e) { rotaSem = []; }
    const naRota = new Set(rotaSem.map((x) => String(x.c.id_cliente)));
    const visit = lista.filter((c) => !naRota.has(String(c.k)));
    if (opt.tudo) {
      if (!rotaSem.length && !visit.length) return `${vn(v)}: nenhum cliente visitado e sem compra no mês.`;
      const B0 = [`📌 *Faltam ${faltaPos} positivações* — ${vn(v)}`];
      if (rotaSem.length) B0.push('', `*Na rota de hoje e sem compra no mês (${rotaSem.length}):*`, '_Cliente · Dias sem compra_', ...rotaSem.slice(0, 40).map((x) => `${titulo(x.c.nome_cliente || x.c.razao_social || 'cliente')} · ${semTxt(x.dias)}`));
      if (visit.length) B0.push('', `*Já visitados no mês e sem compra (${visit.length}):*`, '_Cliente · Última visita · Dias sem compra_', ...visit.slice(0, 40).map((c) => `${titulo(c.nome)} · ${dd(c.vis)} · ${semTxt(c.sem)}`));
      return B0.join('\n');
    }
    if (rotaSem.length || visit.length) {
      const parts = [];
      if (rotaSem.length) parts.push(`*${rotaSem.length}* na rota de hoje`);
      if (visit.length) parts.push(`*${visit.length}* já visitados no mês`);
      L.push(`📌 *Faltam ${faltaPos} positivações:* ` + parts.join(' e ') + ' ainda sem compra. Peça *"ver mais"* para ver a lista de clientes.');
    }
  } else if (opt.tudo) return `${vn(v)}: sem positivação faltando ou sem o roteiro do mês na base.`;
  L.push('', SUGESTAO + (v.zerado ? 'está com rota e sem pedido hoje: ligar já.' : falta > 0 ? `precisa de ${R$(falta / Math.max(dn, 1))} por dia útil; priorizar clientes curva A e o +MIX.` : 'meta financeira batida; buscar positivação e mix.'));
  return L.join('\n');
}
export async function totaisOficiais(B, E) {
  const Vtotais = E.vend.concat((E.ocultos || []).filter((o) => (o.fat > 0 || o.pend > 0 || o.dig > 0) && (!E.supervisor || sem(o.supervisor) === sem(E.supervisor) || (o.nome && sem(o.nome).includes(sem(E.supervisor))))));
  const x = { ...(agrupa(Vtotais, () => 'x').get('x') || { fat: 0, pend: 0, meta: 0, pos: 0, metaPos: 0 }) };
  if (E.grupo || E.supervisor || E.rca) return x;   /* grupo (TPH/MCD) ou equipe do supervisor: soma dos vendedores */
  const s = await B.saude(); const F = ((s && s.filiais) || []).filter((f) => E.filiais.includes(f.filial)); if (!F.length) return x;
  x.fat = F.reduce((a, f) => a + (f.faturado || 0), 0); x.pend = F.reduce((a, f) => a + (f.pendente || 0), 0); x.meta = F.reduce((a, f) => a + (f.meta_fat || 0), 0);
  x.pos = F.reduce((a, f) => a + (f.positivados || 0), 0); x.metaPos = F.reduce((a, f) => a + (f.meta_pos || 0), 0); x.pct = x.meta ? x.fat / x.meta * 100 : null; return x;
}
export async function respFalta(B, E) {
  const dn = diasUteisRestantes(); const x = await totaisOficiais(B, E);
  if (!x.meta) return 'Sem dado agora.';
  /* falta = meta - faturado - pendente (igual ao CEVEN) */ const falta = Math.max(0, x.meta - x.fat - (x.pend || 0)), fpos = Math.max(0, x.metaPos - x.pos);
  const L = [`🎯 *${E.nome} — quanto falta* (${dn} dias úteis seg–sex, sem descontar feriados)`, `💰 Meta ${R$(x.meta)} · faturado ${R$(x.fat)} + pendente ${R$(x.pend)} = *${pctTxt(x.meta ? (x.fat + (x.pend || 0)) / x.meta * 100 : null)}* da meta (igual ao CEVEN)`,
    `Falta (meta − faturado − pendente): *${R$(falta)}* → *${R$(dn ? falta / dn : falta)} por dia útil* (MN)`,
    `👥 Positivação: falta *${N(fpos)}* clientes → *${N(dn ? Math.ceil(fpos / dn) : fpos)} por dia útil*`, ''];
  // ABRE UM NIVEL ABAIXO (26/10/2026: o Allison recebia "quem mais falta (supervisor): Allison"): supervisor -> vendedores
  const porVend = !!E.supervisor;
  const G = porVend ? E.vend.filter((v) => v.meta > 0).map((v) => [vn(v), Math.max(0, v.meta - v.fat - (v.pend || 0)), { pct: v.meta ? (v.fat + (v.pend || 0)) / v.meta * 100 : null }]).sort((a, b) => b[1] - a[1])
    : [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([k]) => supReal(k)).map(([k, y]) => [k, Math.max(0, y.meta - y.fat - (y.pend || 0)), { ...y, pct: y.meta ? (y.fat + (y.pend || 0)) / y.meta * 100 : null }]).sort((a, b) => b[1] - a[1]);
  const nm = (k) => (E.nacional || porVend ? k : nome2(k));
  L.push(`*Quem mais falta (${E.nacional ? 'filial' : porVend ? 'vendedor' : 'supervisor'}):*`, ...G.slice(0, 10).map(([k, f, y]) => `• ${nm(k)}: ${R$(f)} (${pctTxt(y.pct)})`));
  L.push('', SUGESTAO + (G[0] ? `o maior buraco é ${nm(G[0][0])}: ${R$(G[0][1])}.` : 'manter o ritmo.'));
  return L.join('\n');
}

// "COMO FOI O DIA DO VENDEDOR X" (Vitorio, 27/10/2026: "as vezes a pessoa quer saber uma informacao basica... menos e mais"): so o dia. O mes vem em "e o mes?".
export async function respDiaVendedor(B, E, v) {
  const lc = await B.lances(); const hj = lc ? (lc.lances || []).filter((l) => String(l.rca) === v.rca && l.filial === v.filial) : [];
  const c = {}; for (const l of hj) c[l.pontos_nome || l.nivel] = (c[l.pontos_nome || l.nivel] || 0) + 1;
  return [`📝 *${vn(v)}* (${v.filial}) — *hoje*`,
    `Digitado: *${R$(v.dig)}* em ${v.ped} pedido(s)` + (v.ped ? ` · ticket ${R$(v.dig / v.ped)}` : ''),
    v.varejo ? `Visitas: ${v.visF} de ${v.visP} · com venda: ${v.comVenda}` : '',
    hj.length ? `⚽ Liga hoje: *${hj.reduce((a, l) => a + (l.pontos || 0), 0)} pontos* (${Object.entries(c).map(([k, n]) => `${n}× ${k}`).join(' · ')})` : '',
    '', '_Peça "e o mês?" para o acumulado do mês._'].filter((x) => x !== '').join('\n');
}

// TODOS OS VENDEDORES, UM POR UM (Rodrigo/API, 26/10/2026: "como esta todos os vendedores do meu time", "quero todos os vendedores um por um" -> resumo da equipe):
// uma linha por vendedor com o essencial (meta com pendente igual ao CEVEN, falta, positivacao, hoje). Menos e mais: detalhe = "vendedor <nome>".
export function respTodosVendedores(E) {
  const V = E.vend.filter((v) => v.meta > 0 || v.dig > 0).map((v) => ({ v, pct: v.meta ? (v.fat + (v.pend || 0)) / v.meta * 100 : null, falta: Math.max(0, v.meta - v.fat - (v.pend || 0)) })).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  if (!V.length) return `Sem vendedores com meta em ${E.nome} agora.`;
  return [`👥 *${E.nome} — vendedor por vendedor* (do mais atrás para o mais à frente)`, '',
    ...V.map(({ v, pct, falta }) => `• *${vn(v)}*: ${pct == null ? 'sem meta' : pctTxt(pct)} da meta · falta ${R$(falta)} · positivação ${v.pos ?? '—'}/${v.metaPos ?? '—'} · hoje ${R$(v.dig)}`),
    '',
    '📲 *Quer encaminhar a situação individual para cada um?*',
    'Digite *1* (ou mande *"1 por vendedor"*) que eu te envio uma mensagem individual pronta de cada vendedor para você encaminhar direto a eles no WhatsApp!',
    '',
    '_% = (faturado + pendente) ÷ meta, igual ao CEVEN. Peça "vendedor <nome>" para o detalhe de um._'].join('\n');
}

// MENSAGENS INDIVIDUAIS POR VENDEDOR PARA ENCAMINHAR (Vitorio, 29/10/2026):
// Quando o supervisor digita 1 (ou "um por um", "1 por vendedor"), envia uma mensagem por vendedor pronta para encaminhar no WhatsApp
export async function respMensagensPorVendedor(B, E) {
  const dn = diasUteisRestantes();
  const V = E.vend.filter((v) => v.meta > 0 || v.dig > 0 || v.fat > 0 || v.ped > 0).sort((a, b) => {
    const pa = a.meta ? (a.fat + (a.pend || 0)) / a.meta : 0;
    const pb = b.meta ? (b.fat + (b.pend || 0)) / b.meta : 0;
    return pa - pb;
  }).slice(0, 20);

  if (!V.length) return `Sem vendedores ativos em ${E.nome} para encaminhar.`;

  const msgs = [];
  for (const v of V) {
    const totalReal = v.fat + (v.pend || 0);
    const pct = v.meta ? totalReal / v.meta * 100 : null;
    const falta = Math.max(0, v.meta - totalReal);
    const superavit = Math.max(0, totalReal - v.meta);
    const faltaPos = v.metaPos != null && v.pos != null ? Math.max(0, v.metaPos - v.pos) : null;
    const pctPos = v.metaPos ? Math.round((v.pos || 0) / v.metaPos * 100) : null;

    let incentivo = '';
    if (pct >= 100) {
      incentivo = '🎉 *Meta batida! Sensacional!* Vamos acelerar agora para buscar o superávit e o topo da Liga!';
    } else if (pct >= 85) {
      incentivo = '⚡ *Falta muito pouco para bater a meta!* Foco total nos clientes da curva A e positivação para fechar com chave de ouro!';
    } else {
      incentivo = '💪 *Bora pra cima!* Cada cliente positivado e cada pedido contam muito. Foco nos clientes sem compra e no +MIX hoje!';
    }

    const card = [
      `🧑‍💼 *${v.rca} - ${nome2(v.nome)}* (${v.filial} · ${v.canal || 'varejo'})`,
      `🎯 *Meta do Mês:* ${R$(v.meta)}`,
      `💰 *Faturado + Pendente:* *${R$(totalReal)}* (${pctTxt(pct)})`,
      `   • Faturado: ${R$(v.fat)}`,
      `   • Pendente: ${R$(v.pend || 0)}`,
      falta > 0 ? `🔥 *Falta:* *${R$(falta)}*` + (dn ? ` (${R$(Math.round(falta / dn))}/dia útil nos ${dn} dias restantes)` : '') : `✅ *Superávit:* *${R$(superavit)}*`,
      `📍 *Positivação:* ${v.pos ?? '—'} de ${v.metaPos ?? '—'} clientes` + (pctPos != null ? ` (${pctPos}%)` : '') + (faltaPos ? ` · faltam ${faltaPos}` : ''),
      `📝 *Hoje:* ${R$(v.dig)} em ${v.ped || 0} pedido(s)` + (v.varejo && v.visP ? ` · Visitas: ${v.visF}/${v.visP}` : ''),
      '',
      incentivo
    ].filter(Boolean).join('\n');

    msgs.push(card);
  }

  return [`📋 *${E.nome}* — ${msgs.length} mensagens prontas para você encaminhar ao time no WhatsApp:`, ...msgs].join('\n⟪⟫\n');
}
