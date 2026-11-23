// =========================================================================
// JOTA · functions/_lib/jota/respostas/resumo.js
// O QUE É: resumo, hoje, supervisor, vendedor, quanto falta.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { sn } from '../escopo.js';
import { N, P, R$, SUGESTAO, VAREJO, diasUteisRestantes, hojeSP, nome2, sem, titulo, vn } from '../base.js';
import { agrupa, kpisDoEscopo, listaNomes, pctTxt, supChave, supNome, supReal } from '../escopo.js';
import { diasUteisMes } from './gestao.js';
import { diasUteis as diasUteisGerot } from '../../fatos/dias.js';
// RITMO DO GEROT (17/11/2026, Vitorio: "ta errado sua tendencia"): captacao do mes / meta ideal de captacao de hoje, a regua do proprio GEROT.
// Vale para o Brasil e para a filial inteira (gerot_filial_mes). Sem esses campos devolve null e a resposta mostra a conta antiga.
async function ritmoGerot(B, E) {
  if (!(E.nacional || (!E.supervisor && !E.rca && !E.grupo && (E.filiais || []).length === 1))) return null;
  try { const G = await (await import('./gerot_painel.js')).lerGerotMes(B, E.nacional ? null : E.filiais); const x = G && (E.nacional ? G.T : G.F[0]); return x && x.cap != null && x.ideal ? x.cap / x.ideal * 100 : null; } catch (e) { return null; }
}
const txtRitmo = (r) => `📈 Ritmo (GEROT): *${r.toFixed(1).replace('.', ',')}%* do ideal`;

// ---------------- RESPOSTAS ----------------
export async function posGerotFiliais(B) {
  const m = new Map();
  if (!B || !B.env || !B.env.DB) return m;
  try {
    const mes = hojeSP().slice(0, 7);
    const { results } = await B.env.DB.prepare("SELECT filial, coalesce(json_extract(dados,'$.\"Positivação (filial + CNPJ)\"'), json_extract(dados,'$.\"Positivação (filial)\"')) pos, coalesce(json_extract(dados,'$.\"Meta de positivação\"'), json_extract(dados,'$.\"Meta clientes\"')) meta_pos, json_extract(dados,'$.\"Faturado líquido (R$)\"') fat, json_extract(dados,'$.\"Carteira pendente (R$)\"') pend, json_extract(dados,'$.\"Meta (R$)\"') meta, json_extract(dados,'$.\"Devolução (R$)\"') dev FROM gerot_filial_mes WHERE mes = ?").bind(mes).all();
    for (const r of results || []) if (r.pos != null || r.fat != null) m.set(r.filial, {
      pos: Number(r.pos) || 0,
      metaPos: r.meta_pos != null ? Number(r.meta_pos) || 0 : null,
      fat: r.fat != null ? Number(r.fat) : null,
      pend: r.pend != null ? Number(r.pend) : null,
      meta: r.meta != null ? Number(r.meta) : null,
      dev: r.dev != null ? Number(r.dev) : null,
    });
  } catch { /* tabela ainda nao populada */ }
  return m;
}
// posGerotSupervisor removido em 23/11/2026: o total do supervisor era a linha do GEROT (equipe do GEROT) e as linhas eram a equipe da Gestao (conflito 1).
export async function respResumo(B, E) {
  const s = await B.saude();
  const hora = (s && s.hora_sp) || new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  if (E.nacional) {
    // BASE UNICA NO BRASIL (12/11/2026, Vitorio 'como esta o Brasil': 9 filiais 'sem dado · R$ 0' e a TSJ com o Brasil todo): o /api/saude soma so a leitura do
    // CEVEN de HOJE; com o CEVEN fora so a TSJ tinha linha. O Brasil agora sai SEMPRE da mesma base das filiais e dos vendedores (escopo: CEVEN + ultima leitura
    // real + Clube), vendedores + ocultos (macro soma tudo). O /api/saude fica so para a hora.
    let F = [];
    // FALLBACK DE SEGURANÇA (29/10/2026, Vitorio: 'Brasil R$ 0 de R$ 0' quando saude falha ou demora):
    // Se s.filiais vier vazio, monta a partir de E.vend e E.porFilial! NUNCA MOSTRAR BRASIL ZERADO!
    if (!F.length && E.vend && E.vend.length) {
      const mapaFil = new Map();
      for (const v of (E.vend || []).concat(E.ocultos || [])) {
        const x = mapaFil.get(v.filial) || { filial: v.filial, faturado: 0, pendente: 0, meta_fat: 0, positivados: 0, meta_pos: 0, digitado_hoje: 0 };
        x.faturado += (v.fat || 0);
        x.pendente += (v.pend || 0);
        x.meta_fat += (v.meta || 0);
        x.positivados += (v.pos || 0);
        x.meta_pos += (v.metaPos || 0);
        x.digitado_hoje += (v.dig || 0);
        mapaFil.set(v.filial, x);
      }
      if (E.porFilial) {
        for (const [sigla, dados] of Object.entries(E.porFilial)) {
          const x = mapaFil.get(sigla) || { filial: sigla, faturado: 0, pendente: 0, meta_fat: 0, positivados: 0, meta_pos: 0, digitado_hoje: 0 };
          if (dados.macro) x.digitado_hoje = dados.macro.dig || x.digitado_hoje;
          mapaFil.set(sigla, x);
        }
      }
      F = [...mapaFil.values()];
    }
    const gFil = await posGerotFiliais(B);
    for (const x of F) {
      const g = gFil.get(x.filial);
      if (g) {
        if (g.meta != null && g.meta > 0) x.meta_fat = g.meta;
        if (g.fat != null) x.faturado = g.fat;
        if (g.pend != null) x.pendente = g.pend;
        x.positivados = g.pos;
        if (g.metaPos != null) x.meta_pos = g.metaPos;
      }
    }
    const t = F.reduce((a, f) => ({ fat: a.fat + (f.faturado || 0), pend: a.pend + (f.pendente || 0), meta: a.meta + (f.meta_fat || 0), pos: a.pos + (f.positivados || 0), mpos: a.mpos + (f.meta_pos || 0), dig: a.dig + (f.digitado_hoje || 0) }), { fat: 0, pend: 0, meta: 0, pos: 0, mpos: 0, dig: 0 });
    if (!t.dig && E.macro) t.dig = E.macro.dig || 0;
    const { tot: duTotBr } = diasUteisMes(), duFaltBr = Math.max(1, diasUteisRestantes()), duDecBr = Math.max(1, duTotBr - duFaltBr + 1);
    const tendBr = t.meta ? (((t.fat + t.pend) / duDecBr) * duTotBr / t.meta) * 100 : 0;
    const V = E.vend.filter((v) => v.varejo); const z = V.filter((v) => v.zerado);
    // BRASIL PELO GEROT (Vitorio, 17/11/2026: "ta errado sua tendencia... incluir pendentes (carteira)... comparativos... e positivacao, que e o meu foco"):
    // mes = GEROT (faturado + carteira, ritmo de captacao do GEROT, mes passado ate o mesmo dia, meses fechados, positivacao com A-1/3M/M-1/Bench); hoje = Clube.
    const PG = await import('./gerot_painel.js'), GB = await PG.lerGerotMes(B).catch(() => null);
    if (GB && GB.T.fat != null) {
      const digF = new Map(F.map((f) => [f.filial, f.digitado_hoje || 0]));
      const ord = GB.F.slice().sort((a, b) => ((b.cap || 0) / (b.ideal || 1)) - ((a.cap || 0) / (a.ideal || 1))), pior = ord[ord.length - 1];
      return [`📊 *Brasil — 11 filiais* (${hora})`, ...PG.linhasVendas(GB, GB.T), ...PG.linhasPositivacao(GB, GB.T),
        `📝 Hoje (Clube): *${R$(t.dig)}* em *${N((E.macro && E.macro.pedidos) || (E.vend ? E.vend.reduce((a, v) => a + (v.ped || 0), 0) : 0))}* pedidos`, ...(V.some((v) => v.visP > 0) ? [`🚶 Rota do varejo hoje: ${N(V.reduce((a, v) => a + v.visF, 0))} de ${N(V.reduce((a, v) => a + v.visP, 0))} visitas · zerados: ${z.length}`] : []),
        '', '*Por filial (melhor ritmo primeiro):*', ...ord.map((f) => PG.linhaFilial(f) + ` · hoje ${R$(digF.get(f.filial) || 0)}`),
        '', SUGESTAO + (pior && pior.ideal ? `olhar ${pior.filial} (ritmo ${((pior.cap || 0) / pior.ideal * 100).toFixed(1).replace('.', ',')}% do ideal), a mais atrás no mês.` : 'acompanhar as filiais mais atrás.'),
        '_Peça uma filial (ex.: "TPH"), "positivação", "tendência", "zerados", "hoje", "liga"._', PG.fonteGerot(GB)].join('\n');
    }
    const L = [`📊 *Brasil — 11 filiais* (${hora})`, `💰 Faturado: *${R$(t.fat)}* de ${R$(t.meta)} → *${P(t.fat, t.meta)}*`, `⏳ Pendente: ${R$(t.pend)} · 📈 Tendência (conta do Jota, sem o GEROT): *${tendBr.toFixed(1).replace('.', ',')}%*`, `👥 Positivação: ${N(t.pos)} de ${N(t.mpos)} (${P(t.pos, t.mpos)})`,
      `📝 Digitado hoje: *${R$(t.dig)}* em *${N((E.macro && E.macro.pedidos) || (E.vend ? E.vend.reduce((a, v) => a + (v.ped || 0), 0) : 0))}* pedidos`, ...(V.some((v) => v.visP > 0) ? [`🚶 Rota do varejo hoje: ${N(V.reduce((a, v) => a + v.visF, 0))} de ${N(V.reduce((a, v) => a + v.visP, 0))} visitas · zerados: ${z.length}`] : []), '', '*Por filial (% da meta faturada):*'];
    for (const f of F.slice().sort((a, b) => (b.faturado / b.meta_fat) - (a.faturado / a.meta_fat))) {
      const zf = V.filter((v) => v.filial === f.filial && v.zerado).length;
      L.push(`• *${f.filial}* ${P(f.faturado || 0, f.meta_fat)} · ${R$(f.faturado)} · pend. ${R$(f.pendente)} · hoje ${R$(f.digitado_hoje)}` + (V.some((v) => v.visP > 0) ? ` · ${zf} zerado(s)` : ''));
    }
    const pior = F.slice().sort((a, b) => (a.faturado / a.meta_fat) - (b.faturado / b.meta_fat))[0];
    L.push('', SUGESTAO + (pior ? `olhar ${pior.filial} (${P(pior.faturado || 0, pior.meta_fat)} da meta), a mais atrás no mês.` : 'acompanhar as filiais mais atrás.'), '_Peça uma filial (ex.: "TPH"), "zerados", "hoje", "liga", "ajuda"._');
    return L.join('\n');
  }
  // BASE UNICA NA FILIAL (auditoria 12/11/2026): o /api/saude so tem a leitura do CEVEN de hoje (sem Clube nem reserva): o gerente via digitado zero ou o da madrugada.
  // Agora a filial sai da mesma base dos vendedores (vendedores + ocultos; digitado = macro da filial). s fica so para a hora.
  const fil = E.filiais[0]; const f = null;
  const V = E.vend;
  const Vtotais = V.concat(E.ocultos || []);
  const G = agrupa(Vtotais, (v) => 'x').get('x') || { fat: 0, pend: 0, meta: 0 };
  let fat = G.fat, pend = G.pend, meta = G.meta, devTotal = V.reduce((a, v) => a + v.dev, 0);
  let posVal = G.pos, metaPosVal = G.metaPos;
  // 23/11/2026 (dicionario, conflito 1): total do supervisor = SOMA DA EQUIPE DA GESTAO (gerot_vendedor_mes), a mesma tabela das linhas;
  // grupo e equipe: positivacao pela regra 4 (clientes distintos), nunca a soma dos vendedores. Filial: gerot_filial_mes.
  const K = await kpisDoEscopo(B, E);
  if (K) { fat = K.fat; pend = K.cart; meta = K.meta; devTotal = K.dev; posVal = K.pos; metaPosVal = K.metaPos; }
  else if (!(E.grupo || E.supervisor || E.rca)) {
    const g = (await posGerotFiliais(B)).get(fil);
    if (g) {
      if (g.meta != null && g.meta > 0) meta = g.meta;
      if (g.fat != null) fat = g.fat;
      if (g.pend != null) pend = g.pend;
      if (g.dev != null) devTotal = g.dev;
      posVal = g.pos;
      if (g.metaPos != null) metaPosVal = g.metaPos;
    }
  }
  const Vr = V.filter((v) => v.varejo), z = Vr.filter((v) => v.zerado);
  const com = V.filter((v) => v.pct != null).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const { tot: duTotF } = diasUteisMes(), duFaltF = Math.max(1, diasUteisRestantes()), duDecF = Math.max(1, duTotF - duFaltF + 1);
  const tendF = meta ? (((fat + pend) / duDecF) * duTotF / meta) * 100 : 0;
  const ritF = await ritmoGerot(B, E);
  const L = [`📊 *${E.nome} agora* (${hora})`, `💰 Faturado: *${R$(fat)}* + pendente ${R$(pend)} de ${R$(meta)} → *${P((fat || 0) + (pend || 0), meta)}* da meta`, `⏳ Pendente: ${R$(pend)} · ` + (K && K.ritmo != null ? txtRitmo(K.ritmo) + (K.nec != null && K.nec > 0 ? ` · precisa captar *${R$(K.nec)}*/dia útil` : '') : '📈 Ritmo: sem captação do GEROT')];   /* 23/11/2026: ritmo = captacao / meta ideal do GEROT em TODOS os niveis (3.7) */
  L.push(metaPosVal ? `👥 Positivação: ${N(posVal)} de ${N(metaPosVal)} (${P(posVal, metaPosVal)})` + (K && K.metaPosRotulo && !/do GEROT$/.test(K.metaPosRotulo) ? ` _(${K.metaPosRotulo})_` : '')
    : `👥 Positivação: *${N(posVal)}* clientes com faturado no mês` + (E.grupo || E.supervisor ? ' (clientes distintos do grupo, sem repetir) · meta de positivação do grupo ainda não definida' : ''));
  L.push(`📝 Digitado hoje: *${R$((E.grupo || E.supervisor || E.rca) ? G.dig : f ? f.digitado_hoje : E.macro.dig)}* em *${N((E.grupo || E.supervisor || E.rca) ? G.ped : E.macro.pedidos)}* pedidos`,
    /* equipe sem rota de varejo (AS): a linha nao aparece (26/10/2026: '0 de 0') */ ...(Vr.reduce((a, v) => a + v.visP, 0) ? [`🚶 Rota do varejo hoje: ${Vr.reduce((a, v) => a + v.visF, 0)} de ${Vr.reduce((a, v) => a + v.visP, 0)} visitas · sem nenhuma visita: ${Vr.filter((v) => v.semVisita).length}`] : []),
    `🏁 Meta batida no mês (fat.+pend.): ${V.filter((v) => v.meta && v.fat + v.pend >= v.meta).length} de ${V.length} vendedores`, `↩️ Devoluções no mês: ${R$(devTotal)}`);
  const lc = await B.lances(); if (lc) { const Lf = (lc.lances || []).filter((l) => l.filial === fil && (!(E.grupo || E.supervisor || E.rca) || V.some((v) => v.rca === String(l.rca)))); L.push(`⚽ Hoje: ${Lf.filter((l) => l.nivel === 'gol').length} gol(s) · ${Lf.filter((l) => l.nivel === 'penalti').length} pênalti(s) · ${Lf.filter((l) => l.nivel === 'impedimento').length} impedimento(s)`); }
  // TOTAL E LINHAS FECHAM (dicionario §0 regra 2, 23/11/2026): as linhas sao da mesma tabela do total (GEROT por vendedor) e a sobra vira 'fora das equipes'
  if (K && !E.rca) {
    const { linhasQueFecham } = await import('../../fatos/index.js');
    const linhaF = (nome, x) => x.fora ? `• _${nome}_: ${R$(x.fat)} · carteira ${R$(x.cart)} _(${x.negativo ? 'devolução lançada em RCA sem equipe: venda indústrias, histórico' : 'vendedores sem equipe na Gestão, histórico, vaga'})_` : `• ${nome}: ${R$(x.fat)} · carteira ${R$(x.cart)}` + (x.meta ? ` (${pctTxt((x.fat + x.cart) / x.meta * 100)})` : ' · sem meta');
    const tot = { fat, cart: pend, meta };
    // supervisor: a equipe aberta por vendedor (mesma tabela do total; sobra = vendedor da Gestao fora da leitura)
    if (E.supervisor) { const VS = Vtotais.filter((v) => v.fat || v.pend || v.meta).map((v) => ({ nome: vn(v), fat: v.fat || 0, cart: v.pend || 0, meta: v.meta || 0 })).sort((x, y) => y.fat - x.fat); if (VS.length) { L.push('', '*Por vendedor:*'); for (const x of linhasQueFecham(tot, VS)) L.push(linhaF(x.nome, x)); } }
    else if (!E.grupo) { const Gr = [...agrupa(Vtotais.filter((v) => v.grupo), (v) => v.grupo)]; if (Gr.length > 1) { L.push('', '*Por gerente:*'); for (const x of linhasQueFecham(tot, Gr.map(([g, y]) => ({ nome: titulo(g), fat: y.fat, cart: y.pend, meta: y.meta })))) L.push(linhaF(x.nome, x)); } }
    const S = [...agrupa(Vtotais, (v) => v.supervisor || 'sem supervisor')].map(([s, y]) => ({ nome: supReal(s) ? 'sup. ' + supNome(s) : 'Ligados ao gerente', fat: y.fat, cart: y.pend, meta: y.meta })).sort((a, b) => b.fat - a.fat);
    if (!E.supervisor && S.length > 1) { L.push('', '*Por supervisor:*'); for (const x of linhasQueFecham(tot, S.filter((y) => y.fat || y.cart))) L.push(linhaF(x.nome, x)); }
  }
  const lg = await B.liga(); const lf = lg && (lg.filiais || []).find((x) => x.sigla === fil); if (lf) L.push(`🏆 Liga: ${lf.pos}º de 11, ${lf.pts_tabela} pontos (${lf.vitorias}V ${lf.empates}E ${lf.derrotas}D)`);
  if (V.some((v) => v.visP > 0)) L.push(`⚠️ Zerados hoje (varejo com rota): *${z.length}*` + (z.length ? ' — ' + listaNomes(z) : ''));   /* dia sem rota nao fala de zerado (31/10/2026) */
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
    /* 23/11/2026 (dicionario 3.5/3.7): a leitura usa a regua do GEROT (captacao / meta ideal), nao 'so o faturado contra o calendario' */
    if (K && K.ritmo != null) L.push('', `👀 *Leitura do Jota:* ${K.ritmo >= 100 ? 'no ritmo ou acima' : K.ritmo >= 90 ? 'jogo apertado, dá pra virar' : 'abaixo do ritmo, precisamos reagir'} (ritmo do GEROT: captação em *${K.ritmo.toFixed(1).replace('.', ',')}%* do ideal de hoje).`); }
  const dicaEscopo = E.supervisor ? 'por vendedor' : 'por supervisor';
  L.push('', SUGESTAO + (E.supervisor && z.length ? `ligar agora para ${listaNomes(z, 3)}: rota de hoje sem pedido.` : !E.supervisor && sz && sz[1].zerados ? `falar com sup. ${supNome(sz[0])}: ${sz[1].zerados} vendedor(es) da equipe sem pedido hoje.` : 'puxar os mais atrás na meta para fechar o mês.'), `_Peça "hoje", "${dicaEscopo}", "zerados", "falta", "liga", "ajuda"._`);
  return L.join('\n');
}

// acumulado do dia (rota = varejo)
export async function respHoje(B, E, t) {
  // equipe sem varejo (ex.: AS) pedindo 'rota de hoje' -> mostra a equipe toda (26/10/2026, Cristiano/TSJ recebeu '0 de 0')
  const soVarejo = /ROTA|VAREJO|CAMPO|\bVJ\b/.test(t) && E.vend.some((v) => v.varejo);
  const V = soVarejo ? E.vend.filter((v) => v.varejo) : E.vend;
  const rot = soVarejo ? ' (varejo de rota)' : '';
  const sSaude = await B.saude();
  const hora = (sSaude && sSaude.hora_sp) || new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const { tot: duTot } = diasUteisMes(), duFalt = Math.max(1, diasUteisRestantes()), duDec = Math.max(1, duTot - duFalt + (duTot > duFalt ? 0 : 0));
  const ofi = await totaisOficiais(B, E).catch(() => null);
  const ofiVend = ofi && ofi.meta ? (ofi.fat + ofi.pend) : 0;
  const ofiTend = ofi && ofi.meta && duTot ? ((ofiVend / Math.max(1, duTot - (duFalt - 1))) * duTot / ofi.meta) * 100 : 0;
  const ritO = await ritmoGerot(B, E);
  // 23/11/2026 (Vitorio: 'onde ta 42 milhoes precisa colocar que e Faturado X + Carteira Y = Z'): o faturado (garantido) vem separado da carteira (pode ser cortada/excluida)
  const linhaGerot = ofi && ofi.meta ? `📊 Mês (GEROT): faturado *${R$(ofi.fat)}* (${P(ofi.fat, ofi.meta)}) + carteira ${R$(ofi.pend)} = *${R$(ofiVend)}* de ${R$(ofi.meta)} (*${P(ofiVend, ofi.meta)}*) · ` + (ofi.ritmo != null ? txtRitmo(ofi.ritmo) : '📈 Ritmo: sem captação do GEROT') : '';
  if (E.nacional) {
    const G = [...agrupa(V, (v) => v.filial)].sort((a, b) => b[1].dig - a[1].dig);
    const tot = { ...(agrupa(V, () => 'x').get('x') || { dig: 0, ped: 0, visF: 0, visP: 0, comVenda: 0, zerados: 0 }) };
    if (!soVarejo) { tot.dig = E.macro.dig; tot.ped = E.macro.pedidos; for (const g of G) { const m = E.porFilial[g[0]].macro; g[1].dig = m.dig; g[1].ped = m.pedidos; } G.sort((a, b) => b[1].dig - a[1].dig); }
    if (/TICKET/.test(t)) return [`🧾 *Ticket médio de hoje — Brasil${rot}*: *${tot.ped ? R$(tot.dig / tot.ped) : 'sem dado'}* (${R$(tot.dig)} ÷ ${N(tot.ped)} pedidos)`, ...G.map(([f, x]) => `• ${f}: ${x.ped ? R$(x.dig / x.ped) : 'sem dado'}`)].join('\n');
    return [`📝 *Hoje no Brasil${rot}* (${hora})`, `Digitado: *${R$(tot.dig)}* em *${N(tot.ped)}* pedidos${tot.ped ? ' · ticket ' + R$(tot.dig / tot.ped) : ''}`, ...(linhaGerot ? [linhaGerot] : []), ...(tot.visP ? [`Visitas da rota: ${N(tot.visF)} de ${N(tot.visP)} (com venda na rota: ${N(tot.comVenda)}) · zerados: ${tot.zerados}`] : []), '', '*Por filial:*',   /* dia sem rota nao fala de visita nem zerado (Vitorio, 31/10/2026: "hoje e venda") */
      ...G.map(([f, x]) => `• *${f}* ${R$(x.dig)} · ${x.ped} ped.` + (tot.visP ? ` · visitas ${x.visF}/${x.visP} · ${x.zerados} zerado(s)` : '')),
      soVarejo ? '' : '_Totais com todos os canais; peça "hoje rota" para só o varejo._', SUGESTAO + (tot.visP ? `ver os zerados da filial com mais vendedores sem pedido: ${(G.slice().sort((a, b) => b[1].zerados - a[1].zerados)[0] || [''])[0]}.` : `acionar a filial com menos venda digitada hoje: ${(G.slice().sort((a, b) => a[1].dig - b[1].dig)[0] || [''])[0]}.`)].filter((x) => x !== null).join('\n');
  }
  const Vtotais = V.concat(E.ocultos || []);
  const tot = { ...(agrupa(Vtotais, () => 'x').get('x') || { dig: 0, ped: 0, visF: 0, visP: 0, comVenda: 0, zerados: 0 }) };
  if (!soVarejo && !E.grupo && !E.supervisor && !E.rca) { tot.dig = E.macro.dig; tot.ped = E.macro.pedidos; }
  if (/TICKET/.test(t)) return `🧾 *Ticket médio de hoje — ${E.nome}${rot}*: *${tot.ped ? R$(tot.dig / tot.ped) : 'sem dado'}* (${R$(tot.dig)} ÷ ${tot.ped} pedidos)`;
  const Vs = V.slice().sort((a, b) => b.dig - a.dig);
  const L = [`📝 *${E.nome} hoje${rot}* (${hora})`, `Digitado: *${R$(tot.dig)}* em *${tot.ped}* pedidos${tot.ped ? ' · ticket ' + R$(tot.dig / tot.ped) : ''}`, ...(linhaGerot ? [linhaGerot] : []), ...(tot.visP ? [`Visitas da rota: ${tot.visF} de ${tot.visP} (com venda na rota: ${tot.comVenda}) · vendedores zerados: ${tot.zerados}`] : []), ''];
  let iVs = 0;
  for (const v of Vs.slice(0, 40)) {
    iVs++;
    const infoVis = v.visP ? ` · visitas ${v.visF}/${v.visP}` : '';
    L.push(`${iVs}. ${v.zerado ? '⚠️' : v.dig > 0 ? '✅' : '▫️'} *${vn(v)}*: ${R$(v.dig)} · ${v.ped || 0} ped.${infoVis}`);
  }
  if (Vs.length > 40) L.push(`… e mais ${Vs.length - 40}`);
  const z = V.filter((v) => v.zerado);
  { const lm = V.map((v) => v.pedLidoEm).filter(Boolean).sort()[0]; if (lm && !(B && B._clube)) L.splice(2, 0, `_Pedidos lidos até ${new Date(lm).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })} (leitura mais antiga)._`); }
  L.push('', '👉 *Digite o número* (ex.: 1) para ver a rota e o detalhe do vendedor.');
  // CEVEN fora (12/11/2026): sem as visitas de hoje, 'sem pedido' nao vira cobranca
  L.push('', SUGESTAO + (B && B._reserva && !B._clube ? 'ainda sem a leitura das visitas de hoje (Clube da Venda): quem está sem pedido não deve ser cobrado por isso agora.' : z.length ? `cobrar quem tem rota e está sem pedido: ${listaNomes(z, 3)}.` : !tot.ped ? 'ainda sem pedido hoje; acompanhar a primeira visita de cada vendedor.' : V.some((v) => !v.ped) ? `ainda sem pedido hoje: ${listaNomes(V.filter((v) => !v.ped), 3)}.` : 'todo mundo com rota já tem pedido; focar em mix por cliente.'));
  return L.join('\n');
}

export function respPorSupervisor(E) {
  const S = [...agrupa(E.vend, (v) => supChave(v, E.nacional))].filter(([k]) => supReal(k)).sort((a, b) => (b[1].pct ?? -1) - (a[1].pct ?? -1));
  if (!S.length) return `Sem dados por supervisor de ${E.nome} agora.`;
  const L = [`👥 *${E.nome} por supervisor* (% da meta: faturado + pendente)`, ...S.map(([s, x]) => `• *${supNome(s)}* ${pctTxt(x.pct)} · ${R$(x.fat)} · pend. ${R$(x.pend)} · hoje ${R$(x.dig)} · ${x.zerados} zerado(s)`)];
  const pior = S[S.length - 1]; L.push('', SUGESTAO + `conversar com ${supNome(pior[0])} (${pctTxt(pior[1].pct)}), o mais atrás.`, '_Peça "supervisor Nome" para ver os vendedores dele._');
  return L.join('\n');
}
export function respSupervisor(E, s) {
  const V = E.vend.filter((v) => v.supervisor === s.nome && v.filial === s.filial);
  const x = agrupa(V, () => 'x').get('x');
  return [`👤 *${titulo(s.nome)}* (${s.filial}) — ${pctTxt(x.pct)} da meta · fat. ${R$(x.fat)} · pend. ${R$(x.pend)}`, `Positivação: ${x.pos} de ${x.metaPos} (${P(x.pos, x.metaPos)}) · hoje ${R$(x.dig)} em ${x.ped} ped. · visitas ${x.visF}/${x.visP}`, '',
    ...V.map((v) => `• ${v.zerado ? '⚠️' : '✅'} *${vn(v)}* ${pctTxt(v.pct)} · fat. ${R$(v.fat)} · pend. ${R$(v.pend)} · hoje ${R$(v.dig)} (${v.ped} ped.)` + (v.visP ? ` · visitas ${v.visF}/${v.visP}` : '')),
    '', V.some((v) => v.zerado) ? SUGESTAO + `ligar agora para ${listaNomes(V.filter((v) => v.zerado), 3)} (rota sem pedido hoje).` : SUGESTAO + 'equipe com pedido hoje; foco em mix nos próximos clientes.'].join('\n');
}
export async function respVendedor(B, E, v, opt = {}) {   /* opt.tudo = "ver mais": so as listas completas */
  // 16/11/2026 (Vitorio: "vc ainda ta usando merda de dados do CEVEN"): MES = GEROT (faturado, carteira, meta, devolucao, POSITIVACAO e meta de positivacao);
  // DIA = Clube (digitado, pedidos, rota, visitas). O CEVEN so entra se o GEROT nao tiver o vendedor. Rodape com a fonte e a hora de cada um.
  let gPos = null, gPosEm = null, DC = null;
  if (B.env && B.env.DB) {
    try {
      const g = await B.env.DB.prepare("SELECT json_extract(dados, '$.\"Positivação (filial + CNPJ)\"') p, json_extract(dados, '$.\"Meta de positivação\"') m, em FROM gerot_vendedor_mes WHERE mes = ? AND filial = ? AND rca = ? ORDER BY (json_extract(dados, '$.\"Meta de positivação\"') IS NULL), em DESC LIMIT 1").bind(hojeSP().slice(0, 7), String(v.filial), String(v.rca)).first();
      if (g && g.p != null) { gPos = { p: Number(g.p) || 0, m: g.m != null ? Number(g.m) : null }; }
      const st = await B.env.DB.prepare('SELECT posicao FROM gerot_coleta_status ORDER BY id DESC LIMIT 1').first(); gPosEm = st && st.posicao ? String(st.posicao).replace(/^Atual\s*·\s*/i, '') : null;
    } catch (e) { /* sem GEROT: fica o painel */ }
    try { const { diaClube } = await import('./momentos.js'); DC = await diaClube(B, v); } catch (e) { DC = null; }
  }
  if (gPos) { v = { ...v, pos: gPos.p, metaPos: gPos.m != null ? gPos.m : v.metaPos }; }
  if (DC) { const t = DC.t; v = { ...v, dig: Number(t.total_pedido) || 0, ped: Number(t.ped_total) || 0, visP: Number(t.roteiros) || 0, visF: Number(t.visitas_rota) || 0, comVenda: Number(t.ped_rota) || 0 }; }
  const dn = diasUteisGerot().restantes; const falta = Math.max(0, v.meta - v.fat - (v.pend || 0)), metaPosR = v.metaPos != null ? Math.round(v.metaPos) : null, faltaPos = metaPosR != null && v.pos != null ? Math.max(0, metaPosR - Math.round(v.pos)) : null;
  const L = [`🧑‍💼 *${v.rca} - ${titulo(v.nome)}* — ${v.filial} · sup. ${sn(v.supervisor, v.supCod)} · ${v.canal || 'sem canal'}`,
    `💰 Faturado: *${R$(v.fat)}* + pendente ${R$(v.pend)} de ${R$(v.meta)} → *${pctTxt(v.meta ? (v.fat + (v.pend || 0)) / v.meta * 100 : null)}* da meta`, `🎯 Falta: ${R$(falta)}` + (v.necDia != null && v.necDia > 0 ? ` · precisa captar ${R$(v.necDia)} por dia útil (GEROT, ${dn} dias)` : ''),
    (v.pos == null && metaPosR == null ? '👥 Positivação: sem dado agora' : `👥 Positivação: ${v.pos != null ? N(Math.round(v.pos)) : '—'} de ${metaPosR != null ? N(metaPosR) : '—'}${v.pos != null && metaPosR ? ` (${P(v.pos, metaPosR)})` : ''}`) + (faltaPos ? ` · faltam ${N(faltaPos)} ${faltaPos === 1 ? 'cliente' : 'clientes'}` : ''),
    /* 17/11/2026 (regua R03 as 06h: 'Hoje: R$ 0' antes da 1a leitura do Clube): sem leitura do dia, nunca zero */
    !DC ? `📝 Hoje: aguardando a 1ª leitura do Clube (a partir das 7h)` : `📝 Hoje: ${R$(v.dig)} em ${v.ped} ${v.ped === 1 ? 'pedido' : 'pedidos'}` + ` · ticket ${v.ped ? R$(v.dig / v.ped) : 'sem pedido hoje'}` + (v.visP ? ` · visitas ${v.visF} de ${v.visP} · com venda ${v.comVenda}` : ''), `↩️ Devolução no mês: ${R$(v.dev)}`];
  if (v.visPlanMes) L.push(`📅 Rota do mês: ${v.visRealMes} de ${v.visPlanMes} visitas (${P(v.visRealMes, v.visPlanMes)})`);
  const lg = await B.liga(); const lv = lg && (lg.vendedores || []).find((x) => String(x.rca) === v.rca && x.filial === v.filial);
  if (lv) L.push(`🏆 Liga: ${lv.pos_brasil}º no Brasil · ${lv.pos_filial}º na filial · ${lv.pts_tabela} pts (${lv.vitorias}V ${lv.empates}E ${lv.derrotas}D)`);
  const mx = await B.mix(); const mv = mx && (mx.vendedores || []).find((x) => String(x.rca) === v.rca && x.filial === v.filial);
  // 10/11/2026 (Vitorio: 'essa informacao vem de onde?'): o mix do vendedor e o do CEVEN (Produtividade > Mix do mes), igual a tela dele
  const n1 = (x) => (Math.round(x * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (v.mixMes && v.mixMes.clientes_distintos) L.push(`🧺 *Mix do mês:* *${n1(v.mixMes.soma_skus_por_cliente / v.mixMes.clientes_distintos)} produtos diferentes por cliente* · ${v.mixMes.skus_distintos} SKUs em ${v.mixMes.clientes_distintos} clientes`);
  // USO DO +MIX e PRODUTOS QUE MAIS INTRODUZIU (Vitorio, 10/11/2026): do estudo do +MIX (dados_mix.json, pedidos do mes x lista gravada antes da compra)
  if (mv && mv.clientes_com_lista) L.push(`📲 *Uso do +MIX:* ${mv.clientes_usou} de ${mv.clientes_com_lista} clientes compraram produto novo da lista do +MIX${mv.uso_pct != null ? ` (*${n1(mv.uso_pct)}%*)` : ''}`);
  // OS 5 PRODUTOS QUE O VENDEDOR MAIS VENDE (Vitorio, 10/11/2026: 'colocar os 5 produtos que cada vendedor mais vende apos esse diagnostico'): mais clientes no mes
  if (mv && Array.isArray(mv.top_skus) && mv.top_skus.length) L.push(`⭐ *Mais vendidos no mês* (nº de clientes que compraram): ` + mv.top_skus.slice(0, 5).map((p, i) => `${i + 1}. ${titulo(p.n || p.c)} (${p.cli} cliente${p.cli > 1 ? 's' : ''})`).join(' · '));
  if (mv && Array.isArray(mv.top_introduzidos) && mv.top_introduzidos.length) L.push(`🆕 *Produtos novos nos clientes* (não compravam há mais de 60 dias): ` + mv.top_introduzidos.map((p, i) => `${i + 1}. ${titulo(p.n || p.c)} (${p.cli} cliente${p.cli > 1 ? 's' : ''}${p.via_mix ? ', ' + p.via_mix + ' pelo +MIX' : ''})`).join(' · '));
  L.push(`🕒 Fontes: mês ${gPos || v.meta ? `GEROT${gPosEm ? ' ' + gPosEm : ''}` : 'sem GEROT'} · hoje ${DC && DC.lido ? `Clube ${DC.lido}` : 'Clube ainda sem leitura hoje'}`);
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
    { const { clientesComPedidoNoMes } = await import('./rota.js'); for (const k of await clientesComPedidoNoMes(B, [v.filial], v.rca)) compraram.add(k.split('|')[1]); }   // pedido do mes conta (09/11/2026)
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
  // acao concreta do dia (cliente parado ou sem visita, pelo Clube); sem isso, a conta do mes
  let acao = null; if (DC) { try { const { linhasDiaClube } = await import('./momentos.js'); acao = linhasDiaClube(DC, 'fechamento').L.find((x) => /^👉/.test(x)); } catch (e) { acao = null; } }
  L.push('', acao || (SUGESTAO + (v.necDia > 0 ? 'bater a necessidade do dia acima; peça "como foi o dia" para ver quem ficou sem pedido.' : falta > 0 ? 'peça "como foi o dia" para ver quem ficou sem pedido.' : 'meta financeira batida; buscar positivação e mix.')));
  return L.join('\n');
}
export async function totaisOficiais(B, E) {
  const Vtotais = E.vend.concat(E.ocultos || []);
  const x = { ...(agrupa(Vtotais, () => 'x').get('x') || { fat: 0, pend: 0, meta: 0, pos: 0, metaPos: 0 }) };
  // 23/11/2026 (dicionario, camada functions/_lib/fatos): todos os niveis pela mesma conta. Supervisor = soma da equipe da Gestao; grupo/equipe = positivacao regra 4.
  const K = await kpisDoEscopo(B, E);
  if (K) { x.fat = K.fat; x.pend = K.cart; x.meta = K.meta; x.dev = K.dev; x.pos = K.pos; x.metaPos = K.metaPos; x.metaPosRotulo = K.metaPosRotulo; x.cap = K.cap; x.ideal = K.ideal; x.ritmo = K.ritmo; x.nec = K.nec; x.dias = K.dias; x.posicao = K.posicao; x.pct = x.meta ? (x.fat + (x.pend || 0)) / x.meta * 100 : null; x.gerot = true; return x; }
  if (E.grupo || E.rca || E.supervisor) return x;
  const gFil = await posGerotFiliais(B);
  const gf = E.filiais.map((sig) => gFil.get(sig)).filter((g) => g && g.meta > 0);
  if (gf.length) {
    x.fat = gf.reduce((a, g) => a + (g.fat || 0), 0); x.pend = gf.reduce((a, g) => a + (g.pend || 0), 0); x.meta = gf.reduce((a, g) => a + (g.meta || 0), 0);
    x.pos = gf.reduce((a, g) => a + (g.pos || 0), 0); x.metaPos = gf.reduce((a, g) => a + (g.metaPos || 0), 0); x.pct = x.meta ? (x.fat + (x.pend || 0)) / x.meta * 100 : null; return x;
  }
  const s = await B.saude(); const F = ((s && s.filiais) || []).filter((f) => E.filiais.includes(f.filial)); if (!F.length) return x;
  x.fat = F.reduce((a, f) => a + (f.faturado || 0), 0); x.pend = F.reduce((a, f) => a + (f.pendente || 0), 0); x.meta = F.reduce((a, f) => a + (f.meta_fat || 0), 0);
  x.pos = F.reduce((a, f) => a + (f.positivados || 0), 0); x.metaPos = F.reduce((a, f) => a + (f.meta_pos || 0), 0); x.pct = x.meta ? (x.fat + (x.pend || 0)) / x.meta * 100 : null; return x;
}
export async function respFalta(B, E) {
  const dn = diasUteisGerot().restantes; const x = await totaisOficiais(B, E);
  if (!x.meta) return 'Sem dado agora.';
  /* falta = meta - faturado - pendente (igual ao CEVEN) */ const falta = Math.max(0, x.meta - x.fat - (x.pend || 0)), fpos = Math.max(0, x.metaPos - x.pos);
  const L = [`🎯 *${E.nome} — quanto falta* (${dn} dias úteis seg–sex, sem feriados)`, `💰 Meta ${R$(x.meta)} · faturado ${R$(x.fat)} + pendente ${R$(x.pend)} = *${pctTxt(x.meta ? (x.fat + (x.pend || 0)) / x.meta * 100 : null)}* da meta`,
    `Falta (meta − faturado − pendente): *${R$(falta)}*` + (x.nec != null ? ` · precisa captar *${R$(x.nec)} por dia útil* (GEROT: meta − captação ÷ ${dn} dias)` : ' · sem captação do GEROT'),
    (x.metaPos ? `👥 Positivação: falta *${N(fpos)}* clientes → *${N(dn ? Math.ceil(fpos / dn) : fpos)} por dia útil* _(conta do Jota)_` : `👥 Positivação: *${N(x.pos)}* clientes (meta de positivação do grupo ainda não definida)`), ''];
  // ABRE UM NIVEL ABAIXO (26/10/2026: o Allison recebia "quem mais falta (supervisor): Allison"): supervisor -> vendedores
  const porVend = !!E.supervisor;
  const G = porVend ? E.vend.filter((v) => v.meta > 0).map((v) => [vn(v), Math.max(0, v.meta - v.fat - (v.pend || 0)), { pct: v.meta ? (v.fat + (v.pend || 0)) / v.meta * 100 : null }]).sort((a, b) => b[1] - a[1])
    : [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([k]) => supReal(k)).map(([k, y]) => [k, Math.max(0, y.meta - y.fat - (y.pend || 0)), { ...y, pct: y.meta ? (y.fat + (y.pend || 0)) / y.meta * 100 : null }]).sort((a, b) => b[1] - a[1]);
  const nm = (k) => (E.nacional || porVend ? k : nome2(k));
  if (E.rca) return L.join('\n');   // o vendedor ve so o dele: sem ranking de supervisor nem "digite o numero da equipe" (teste da proatividade, 01/11/2026)
  L.push(`*Quem mais falta (${E.nacional ? 'filial' : porVend ? 'vendedor' : 'supervisor'}):*`, ...G.slice(0, 10).map(([k, f, y], i) => `${i + 1}. ${nm(k)}: ${R$(f)} (${pctTxt(y.pct)})`));
  if (!porVend && G.length) {
    L.push('', '💡 *Para abrir qualquer equipe por vendedor, digite apenas o número correspondente (ex: 1, 2...)*');
  }
  L.push('', SUGESTAO + (G[0] ? `o maior buraco é ${nm(G[0][0])}: ${R$(G[0][1])}.` : 'manter o ritmo.'));
  return L.join('\n');
}

// O DIA AINDA NAO COMECOU (17/11/2026, regua no menu do supervisor as 06h: "vendeu R$ 0 (0%) 🔴", "11 zerados", "apito final... atencao amanha" as 6 da manha).
// Antes das 7h, ou sem nenhuma visita nem venda na equipe, o 'hoje' e a rota PLANEJADA + o ultimo dia util; nunca zerado, farol vermelho ou fechamento.
export async function respPreDia(B, E) {
  if (!B || !B.env || !B.env.DB || !E || !(E.vend || []).length) return null;
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));
  const V = E.vend.filter((v) => v.ehVendedorReal !== false), fil = [...new Set(V.map((v) => v.filial))], qs = fil.map(() => '?').join(','), hoje = hojeSP();
  const ks = new Set(V.map((v) => v.filial + '|' + v.rca));
  let C = [];
  try { C = (await B.env.DB.prepare(`SELECT filial, rca, total_pedido, ped_total, roteiros, visitas_rota, lido_em FROM clube_venda_dia WHERE dia = ? AND filial IN (${qs})`).bind(hoje, ...fil).all()).results || []; } catch (e) { C = []; }
  C = C.filter((x) => ks.has(x.filial + '|' + x.rca));
  const dig = C.reduce((a, x) => a + (Number(x.total_pedido) || 0), 0), vis = C.reduce((a, x) => a + (Number(x.visitas_rota) || 0), 0);
  if (!(h < 7 || (C.length && dig === 0 && vis === 0 && h < 10))) return null;
  // antes da rota, o que o supervisor precisa e a MATINAL (a reuniao com o time), nao "espere as 7h" (Vitorio, 17/11/2026)
  // a matinal e a de sempre (card do dia + card de industrias + texto), com os dados de hoje
  try { const { respMatinal } = await import('./gestao.js'); const r = await respMatinal(B, E); if (r) return r; } catch (e) { /* segue o texto curto */ }
  const rot = C.reduce((a, x) => a + (Number(x.roteiros) || 0), 0), comRota = C.filter((x) => Number(x.roteiros) > 0).length;
  const lido = C.map((x) => x.lido_em).filter(Boolean).sort().pop();
  let ont = null;
  try { ont = await B.env.DB.prepare(`SELECT dia d, SUM(ped_total) n, SUM(total_pedido) v FROM clube_venda_dia WHERE filial IN (${qs}) AND dia < ? AND strftime('%w', dia) <> '0' GROUP BY dia HAVING SUM(total_pedido) > 0 ORDER BY dia DESC LIMIT 1`).bind(...fil, hoje).first(); } catch (e) { ont = null; }
  let ontV = null;
  if (ont && ont.d) { try { const { results } = await B.env.DB.prepare(`SELECT filial, rca, total_pedido v, ped_total n FROM clube_venda_dia WHERE dia = ? AND filial IN (${qs})`).bind(ont.d, ...fil).all(); const R = (results || []).filter((x) => ks.has(x.filial + '|' + x.rca)); ontV = { v: R.reduce((a, x) => a + (Number(x.v) || 0), 0), n: R.reduce((a, x) => a + (Number(x.n) || 0), 0) }; } catch (e) { ontV = null; } }
  const DSEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const hora = lido ? new Date(lido).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : null;
  return [`☀️ *${E.nome || 'Equipe'} — o dia ainda não começou*`,
    rot ? `🗺️ Rota de hoje: *${N(rot)}* visitas planejadas · ${N(comRota)} vendedor(es) com rota` : (C.length ? '🗺️ Ninguém da equipe com rota hoje.' : '🗺️ Rota de hoje: aguardando a 1ª leitura do Clube'),
    ont && ontV ? `📅 Último dia útil (${DSEM[new Date(ont.d + 'T12:00:00Z').getUTCDay()]} ${ont.d.slice(8, 10)}/${ont.d.slice(5, 7)}): *${R$(ontV.v)}* em *${N(ontV.n)}* pedidos` : '',
    '', `👉 As visitas começam às 7h. Peça "equipe hoje" depois para ver o andamento, ou "matinal" para o mês.`,
    hora ? `_Clube da Venda · ${hora}_` : ''].filter((x) => x !== '').join('\n');
}

// DIA DA EQUIPE (Vitorio, 16/11/2026, Allison/TPH: "Como foi a venda da minha equipe hj?" -> veio o painel do MES; avaliacao 'escola Ambev' da resposta
// do Alex: 2/10 — "numero sem referencia, sem quem ficou na mesa, sem acao"). Dia pelo Clube (ultima leitura, com a hora), meta do dia pelo GEROT
// (meta - faturado - carteira) / dias uteis restantes. Vendedores do pior para o melhor; clientes parados que ficaram na mesa; acao com dono e cliente.
export async function respHojeEquipe(B, E) {
  if (!B || !B.env || !B.env.DB || !E || !(E.vend || []).length) return null;
  const V = E.vend.filter((v) => v.ehVendedorReal !== false);
  if (!V.length) return null;
  const fil = [...new Set(V.map((v) => v.filial))], hoje = hojeSP(), qs = fil.map(() => '?').join(',');
  let C = [], J = [];
  try {
    [C, J] = await Promise.all([
      B.env.DB.prepare(`SELECT filial, rca, total_pedido, ped_total, ped_rota, roteiros, visitas_rota, lido_em FROM clube_venda_dia WHERE dia = ? AND filial IN (${qs})`).bind(hoje, ...fil).all().then((r) => r.results || []),
      B.env.DB.prepare(`SELECT filial, rca, cliente, fantasia, razao, dias_sem_comprar, motivo FROM clube_justificativa WHERE dia = ? AND filial IN (${qs})`).bind(hoje, ...fil).all().then((r) => r.results || []),
    ]);
  } catch (e) { return null; }
  if (!C.length) return null;   // sem leitura do Clube hoje: segue a resposta de antes
  const cl = new Map(C.map((x) => [x.filial + '|' + x.rca, x])), lido = C.map((x) => x.lido_em).filter(Boolean).sort().pop();
  const DUg = diasUteisGerot(), du = DUg.restantes || 1;
  const L0 = V.map((v) => {
    const c = cl.get(v.filial + '|' + v.rca) || null, dig = c ? Number(c.total_pedido) || 0 : 0;
    const metaDia = v.meta && v.necDia != null ? v.necDia : 0;   /* 23/11/2026: meta do dia = necessidade do GEROT (3.8) */
    const jus = J.filter((j) => j.filial === v.filial && String(j.rca) === String(v.rca));
    return { v, c, dig, ped: c ? Number(c.ped_total) || 0 : 0, rot: c ? Number(c.roteiros) || 0 : 0, vis: c ? Number(c.visitas_rota) || 0 : 0, metaDia, pct: metaDia ? dig / metaDia : (dig > 0 ? 9 : null), jus };
  });
  // 23/11/2026 (total = linhas): na filial inteira, o Clube de quem nao esta na lista (fora das equipes, televenda) entra no total e numa linha propria
  const foraC = !(E.supervisor || E.grupo || E.rca) ? C.filter((x) => !L0.some((y) => y.v.filial === x.filial && String(Number(y.v.rca)) === String(Number(x.rca)))) : [];
  const foraDig = foraC.reduce((a, x) => a + (Number(x.total_pedido) || 0), 0), foraPed = foraC.reduce((a, x) => a + (Number(x.ped_total) || 0), 0);
  const tDig = L0.reduce((a, x) => a + x.dig, 0) + foraDig, tMeta = V.some((v) => v.cap != null) && DUg.restantes > 0 ? Math.max(0, V.reduce((a, v) => a + (v.meta || 0), 0) - V.reduce((a, v) => a + (v.cap || 0), 0)) / DUg.restantes : 0 /* equipe: (meta - captacao) / dias, nunca a soma das necessidades */, tPed = L0.reduce((a, x) => a + x.ped, 0) + foraPed;
  const tRot = L0.reduce((a, x) => a + x.rot, 0), tVis = L0.reduce((a, x) => a + x.vis, 0);
  const far = (p) => p == null ? '⚪' : p >= 1 ? '🟢' : p >= 0.7 ? '🟡' : '🔴';
  const hora = lido ? new Date(lido).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '';
  const L = [`📋 *${E.nome || 'Equipe'} — hoje*`];
  L.push(tMeta ? `🎯 Meta do dia: *${R$(tMeta)}* → vendeu *${R$(tDig)}* (${Math.round(tDig / tMeta * 100)}%) ${far(tDig / tMeta)} · *${N(tPed)}* pedidos` : `📝 Vendeu *${R$(tDig)}* em *${N(tPed)}* pedidos`);
  if (tRot) L.push(`🚶 Rota: *${N(tVis)} de ${N(tRot)}* visitas` + (tRot - tVis > 0 ? ` · *${N(tRot - tVis)} sem visita*` : ' · completa'));
  const ord = [...L0].sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1));
  L.push('', '*Por vendedor (pior primeiro):*');
  for (const x of ord.slice(0, 15)) {
    const sp = x.jus.length ? ` · ${x.jus.length} justif.` : '';
    L.push(`${far(x.pct)} *${x.v.rca} - ${titulo(nome2(x.v.nome))}*: ${R$(x.dig)}${x.metaDia ? ` de ${R$(x.metaDia)}` : ''} · ${N(x.ped)} ped.` + (x.rot ? ` · ${x.vis}/${x.rot} vis.` : '') + sp);
  }
  if (ord.length > 15) L.push(`… e mais ${ord.length - 15} vendedores`);
  if (foraDig || foraPed) L.push(`⚪ _fora das equipes_: ${R$(foraDig)} · ${N(foraPed)} ped.`);
  const parados = J.filter((j) => Number(j.dias_sem_comprar) > 30 && L0.some((x) => x.v.filial === j.filial && String(x.v.rca) === String(j.rca))).sort((a, b) => Number(b.dias_sem_comprar) - Number(a.dias_sem_comprar));
  if (parados.length) {
    L.push('', `🟡 *Ficaram na mesa (visitados, sem pedido, +30 dias sem comprar): ${parados.length}*`);
    for (const j of parados.slice(0, 5)) { const vv = L0.find((x) => x.v.filial === j.filial && String(x.v.rca) === String(j.rca)); L.push(`• ${titulo(String(j.fantasia || j.razao || 'Cliente').toLowerCase())} (#${j.cliente}) · ${N(j.dias_sem_comprar)} dias · ${titulo(String(j.motivo || '').toLowerCase())} · ${vv ? vv.v.rca : j.rca}`); }
  }
  const pior = ord.find((x) => x.metaDia && (x.pct ?? 0) < 0.7);
  const acao = parados[0] ? `ligar com o *${parados[0].rca}* para *${titulo(String(parados[0].fantasia || parados[0].razao || 'cliente').toLowerCase())}* (${N(parados[0].dias_sem_comprar)} dias sem comprar)` : pior ? `falar com *${pior.v.rca} - ${titulo(nome2(pior.v.nome))}*: ${R$(pior.dig)} de ${R$(pior.metaDia)} hoje` : null;
  if (acao) L.push('', `👉 *Agora:* ${acao}.`);
  L.push(`_Clube da Venda · ${hora}_`);
  return L.join('\n');
}

// "COMO FOI O DIA DO VENDEDOR X" (Vitorio, 27/10/2026: "as vezes a pessoa quer saber uma informacao basica... menos e mais"): so o dia. O mes vem em "e o mes?".
export async function respDiaVendedor(B, E, v) {
  const lc = await B.lances(); const hj = lc ? (lc.lances || []).filter((l) => String(l.rca) === v.rca && l.filial === v.filial) : [];
  const c = {}; for (const l of hj) c[l.pontos_nome || l.nivel] = (c[l.pontos_nome || l.nivel] || 0) + 1;
  // 16/11/2026 (avaliacao 'escola Ambev' da resposta do Alex: 2/10 — "numero sem referencia, sem quem ficou na mesa, sem acao"):
  // o dia vem do Clube cliente a cliente, com a meta do dia como referencia e a acao no fim.
  try {
    const { diaClube, linhasDiaClube } = await import('./momentos.js');
    const D = await diaClube(B, v);
    if (D) {
      const metaDia = v.meta && v.necDia != null && v.necDia > 0 ? v.necDia : null, dig = Number(D.t.total_pedido) || 0;
      const L = [`📝 *${vn(v)}* (${v.filial}) — *hoje*`];
      if (metaDia) L.push(`🎯 Meta do dia: *${R$(metaDia)}* → vendeu *${R$(dig)}* (${Math.round(dig / metaDia * 100)}%) ${dig >= metaDia ? '🟢' : dig >= metaDia * 0.7 ? '🟡' : '🔴'}`);
      else if (v.meta && falta === 0) L.push('🏆 Meta do mês já batida (faturado + a faturar).');
      const hh = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));
      const LD = linhasDiaClube(D, hh < 15 ? 'meio' : 'fechamento').L, iAcao = LD.findIndex((x) => /^👉/.test(x));
      // INDUSTRIAS (Vitorio, 16/11/2026: "ja nao conseguimos incluir dados da industria?"): GEROT do mes por vendedor x industria; as 3 maiores faltas em R$
      let LI = [];
      try {
        const { limpaNome } = await import('./gerot_industria.js');
        const { results: GI } = await B.env.DB.prepare("SELECT fornecedor f, json_extract(dados, '$.\"Meta (R$)\"') m, json_extract(dados, '$.\"Faturado líquido (R$)\"') fa, json_extract(dados, '$.\"Carteira pendente (R$)\"') ca, json_extract(dados, '$.\"Positivação (filial + CNPJ)\"') p FROM gerot_vendas WHERE mes = ? AND filial = ? AND rca = ?").bind(hojeSP().slice(0, 7), String(v.filial), String(v.rca)).all();
        const nomeI = (f) => titulo(limpaNome(f).replace(/\s*#\d+\s*$/, '').replace(/\b(LTDA|LTD|S\.?A\.?|S\/A|DO BRASIL|BRASIL|INDUSTRIA|IND|COMERCIO|COM|DIST|DISTRIBUIDORA|ALIMENTOS|E)\b\.?/gi, ' ').replace(/[.]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' '));
        const I = (GI || []).filter((x) => Number(x.m) > 0).map((x) => { const vend = (Number(x.fa) || 0) + (Number(x.ca) || 0); return { n: nomeI(x.f), m: Number(x.m), vend, falta: Math.max(0, Number(x.m) - vend), p: Number(x.p) || 0 }; }).sort((a, b) => b.falta - a.falta);
        if (I.length) {
          const bat = I.filter((x) => x.falta === 0).map((x) => x.n);
          LI = ['', `🏭 *Indústrias no mês* (fat. + a faturar · meta):`, ...I.filter((x) => x.falta > 0).slice(0, 3).map((x) => `• *${x.n}*: ${R$(x.vend)} de ${R$(x.m)} (${Math.round(x.vend / x.m * 100)}%) · faltam *${R$(x.falta)}* · ${N(x.p)} clientes`)];
          if (bat.length) LI.push(`✅ Meta batida: ${bat.join(', ')}`);
        }
      } catch (e) { LI = []; }
      if (iAcao >= 0) LD.splice(LD[iAcao - 1] === '' ? iAcao - 1 : iAcao, 0, ...LI); else LD.push(...LI);
      L.push(...LD);
      if (hj.length) L.push(`⚽ Liga hoje: *${hj.reduce((a, l) => a + (l.pontos || 0), 0)} pontos* (${Object.entries(c).map(([k, n]) => `${n}× ${k}`).join(' · ')})`);
      L.push('', '_Peça "e o mês?" para o acumulado do mês._');
      return L.join('\n');
    }
  } catch (e) { /* sem Clube: segue o resumo de antes */ }
  return [`📝 *${vn(v)}* (${v.filial}) — *hoje*`,
    `Digitado: *${R$(v.dig)}* em ${v.ped} pedido(s)` + (v.ped ? ` · ticket ${R$(v.dig / v.ped)}` : ''),
    v.visP ? `Visitas: ${v.visF} de ${v.visP} · com venda: ${v.comVenda}` : '',
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
    '_% = (faturado + pendente) ÷ meta. Peça "vendedor <nome>" para ver a ficha completa e encaminhar._'].join('\n');
}

// MENSAGENS INDIVIDUAIS POR VENDEDOR PARA ENCAMINHAR (Vitorio, 29/10/2026):
// Quando o supervisor digita 1 (ou "um por um", "1 por vendedor"), envia uma mensagem por vendedor pronta para encaminhar no WhatsApp
export async function respMensagensPorVendedor(B, E) {
  // BLOQUEIO DEFINITIVO ANTISPAM: O Jota NUNCA cospe lote de mensagens de equipe de uma vez só no WhatsApp.
  return [
    '⚠️ *Envio individual seguro (Antispam)*',
    '',
    'Para proteger o número contra bloqueios no WhatsApp e evitar disparos em lote, as mensagens devem ser consultadas por vendedor.',
    '',
    '👉 *Peça o vendedor específico:*',
    'Exemplo: *"vendedor ' + (E.vend && E.vend[0] ? E.vend[0].rca : '123') + '"* ou *"vendedor ' + (E.vend && E.vend[0] ? E.vend[0].nome.split(' ')[0] : 'Nome') + '"*.',
    'Eu te devolvo a ficha individual pronta para você encaminhar com segurança!'
  ].join('\n');
  
  /* CÓDIGO ANTIGO DE LOTE DESATIVADO PARA PREVENÇÃO DE BAN */
  const _desativado = async () => {
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
      `📝 *Hoje:* ${R$(v.dig)} em ${v.ped || 0} pedido(s)` + (v.visP ? ` · Visitas: ${v.visF}/${v.visP}` : ''),
      '',
      incentivo
    ].filter(Boolean).join('\n');

    msgs.push(card);
  }

  return '';
  };
}
