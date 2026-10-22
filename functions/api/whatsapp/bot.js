// =========================================================================
// FICHA DO ARQUIVO: functions/api/whatsapp/bot.js   (POST /api/whatsapp/bot?k=<BOT_WEBHOOK_KEY>)
// O QUE É: o ASSISTENTE DO +MIX NO WHATSAPP (Vitorio, 22/10/2026: "o pessoal interagir com o +MIX: o gerente de TPH manda msg e interage com os dados da filial dele;
//          conversa natural e fluida, e alem do que perguntam nos tambem sugerimos coisas").
// FLUXO:   Evolution (numero Mais Mix Triunfante) -> webhook MESSAGES_UPSERT -> aqui.
//          1) confere a chave do webhook; ignora grupo, status e mensagem enviada pelo proprio numero
//          2) identifica QUEM mandou pelo celular (tabela bot_contatos no D1: nome, papel, filial, supervisor). Numero desconhecido: nao responde nada.
//          3) grava a mensagem (bot_msgs) e responde pela Evolution.
// ETAPA 1 (agora): reconhece a pessoa e responde com o resumo da filial dela (mesma base da TV, /api/saude). Sem IA ainda.
// ETAPA 2 (agora): conversa livre com IA GRATUITA da Cloudflare (Workers AI, binding AI; Vitorio 22/10/2026: 'quero gratis, nao tenho orcamento').
//          A IA so recebe os dados da filial de quem pergunta e e proibida de inventar; sem IA disponivel, cai no resumo fixo.
// SEGREDOS (Cloudflare Pages, nunca no codigo): EVO_URL, EVO_KEY, EVO_INSTANCE, BOT_WEBHOOK_KEY.
// REGRA: nunca inventar dado. Sem dado = "sem dado". Pertence ao Projeto B (WhatsApp), autorizado pelo Vitorio em 22/10/2026.
// =========================================================================
const so = (x) => String(x || '').replace(/\D/g, '');
const brl = (n) => n == null || isNaN(n) ? 'sem dado' : 'R$ ' + Math.round(n).toLocaleString('pt-BR');
const pc = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : 'sem dado');
const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

// celular brasileiro com e sem o 9: 5541987525605 <-> 554187525605
function variantes(n) {
  const d = so(n); const out = new Set([d]);
  if (d.length === 13 && d.startsWith('55') && d[4] === '9') out.add(d.slice(0, 4) + d.slice(5));
  if (d.length === 12 && d.startsWith('55')) out.add(d.slice(0, 4) + '9' + d.slice(4));
  return [...out];
}

async function tabelas(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_contatos (celular TEXT PRIMARY KEY, nome TEXT, papel TEXT, filial TEXT, grupo TEXT, supervisor TEXT, ativo INTEGER DEFAULT 1, criado_em TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, nome TEXT, direcao TEXT, texto TEXT, msg_id TEXT)`).run();
}

async function enviar(env, numero, texto) {
  if (!env.EVO_URL || !env.EVO_KEY) return { ok: false, erro: 'EVO_URL/EVO_KEY nao configurados' };
  const inst = env.EVO_INSTANCE || 'ceven-noc';
  const r = await fetch(`${String(env.EVO_URL).replace(/\/$/, '')}/message/sendText/${inst}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.EVO_KEY },
    body: JSON.stringify({ number: numero, text: texto }), signal: AbortSignal.timeout(20000)
  });
  return { ok: r.ok, status: r.status };
}

// resumo da filial pela mesma base da TV (sem chamar o CEVEN)
async function resumoFilial(origin, filial) {
  try {
    const j = await fetch(`${origin}/api/saude`, { signal: AbortSignal.timeout(20000) }).then((r) => r.json());
    const f = (j.filiais || []).find((x) => x.filial === filial);
    if (!f) return `Não encontrei a filial ${filial} na base agora.`;
    return `📊 *${filial} agora* (${j.hora_sp})\n` +
      `Faturado + pendente: *${brl((f.faturado || 0) + (f.pendente || 0))}* de ${brl(f.meta_fat)} → *${pc((f.faturado || 0) + (f.pendente || 0), f.meta_fat)}* da meta\n` +
      `Positivados: *${f.positivados ?? 'sem dado'}* de ${f.meta_pos ?? 'sem dado'} → ${pc(f.positivados, f.meta_pos)}\n` +
      `Digitado hoje: ${brl(f.digitado_hoje)}`;
  } catch (e) { return 'Não consegui ler a base agora. Tente de novo em alguns minutos.'; }
}

const MODELO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
// DADOS DA FILIAL PARA O ASSISTENTE (22/10/2026: "so isso de dados? olha o tanto de coisa que tem na TV"): a MESMA base da TV/Matriz
//   /api/saude (totais), /api/central-snapshot (cada vendedor: meta, faturado, pendente, positivacao, digitado hoje, visitas), /api/tv-mostra (supervisor e grupo),
//   /api/brasileirao-lances (lances de hoje), dados_brasileirao.json (Liga) e dados_mix.json (+MIX). Valores ja formatados para a IA nao errar formato.
const R$ = (n) => n == null || isNaN(n) ? 'sem dado' : 'R$ ' + Math.round(n).toLocaleString('pt-BR');
const P = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : 'sem dado');
async function dadosDaFilial(origin, filial, env, grupo) {
  const out = {};
  const est = (p) => (env && env.ASSETS ? env.ASSETS.fetch(new Request(origin + p)) : fetch(origin + p)).then((r) => r.json());
  const api = (p) => fetch(origin + p, { signal: AbortSignal.timeout(25000) }).then((r) => r.json());
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [saude, snap, mostra, lances, liga, mix, supdia] = await Promise.all([api('/api/saude'), api('/api/central-snapshot?filial=' + filial), api('/api/tv-mostra'), api(`/api/brasileirao-lances?dia=${hoje}&filial=${filial}`), est('/dados_brasileirao.json'), est('/dados_mix.json'), api('/api/tv-supervisores?filial=' + filial)].map((p) => p.catch(() => null)));
  const f = saude && (saude.filiais || []).find((x) => x.filial === filial);
  if (f) out.filial_agora = { hora: saude.hora_sp, faturado: R$(f.faturado), meta_mes: R$(f.meta_fat), pct_meta: P(f.faturado || 0, f.meta_fat), pendente: R$(f.pendente), positivados_mes: `${f.positivados} de ${f.meta_pos} (${P(f.positivados, f.meta_pos)})`, digitado_hoje: R$(f.digitado_hoje) };
  // equipe: supervisor e grupo pela Gestao de Equipe
  const eq = new Map(); if (mostra && mostra.filiais) for (const [k, L] of Object.entries(mostra.filiais)) if (k.split('_')[0] === filial) for (const v of L) eq.set(String(v.rca), v);
  // lances de hoje por vendedor
  const lv = new Map(); for (const l of (lances && lances.lances) || []) { const k = String(l.rca); const x = lv.get(k) || {}; x[l.nivel] = (x[l.nivel] || 0) + 1; lv.set(k, x); }
  const vend = [];
  for (const [rca, r] of Object.entries((snap && snap.rcas) || {})) {
    const e = eq.get(rca); if (e && e.mostra === false) continue;
    if (grupo && (!e || String(e.grupo || '').toUpperCase() !== String(grupo).toUpperCase())) continue;
    const d = r.dashboard || {}, fi = d.financeiro || {}, po = d.positivacao || {}, pd = (r.produtividade && r.produtividade.dia) || {};
    const rot = Array.isArray(r.roteiro) ? r.roteiro.filter((c) => String(c.data_visita || '').slice(0, 10) === hoje) : [];
    const feitas = rot.filter((c) => c.checkin_horario).length;
    vend.push({ vendedor: (e && e.nome) || d.nome || 'RCA ' + rca, rca, supervisor: e ? e.supervisor : '', grupo: e ? e.grupo : '',
      fatN: fi.faturado || 0, pendN: fi.pendente || 0, metaN: fi.meta || 0, digN: pd.dig_pedido || 0, pedN: pd.positivacao || 0, devN: fi.devolucao || 0, visF: 0, visP: 0, pedidos_hoje: pd.positivacao || 0, pct_meta_fat: fi.meta ? +((fi.faturado || 0) / fi.meta * 100).toFixed(1) : null, faturado: R$(fi.faturado), pendente: R$(fi.pendente), meta: R$(fi.meta),
      positivacao: `${po.realizado ?? '?'} de ${po.meta ?? '?'}`, digitado_hoje: R$(pd.dig_pedido), visitas_hoje: `${feitas} de ${rot.length}`, zerado_hoje: rot.length > 0 && !(pd.dig_pedido > 0),
      lances_hoje: lv.get(rca) || {} });
    vend[vend.length - 1].visF = feitas; vend[vend.length - 1].visP = rot.length;
  }
  vend.sort((a, b) => (b.pct_meta_fat ?? -1) - (a.pct_meta_fat ?? -1));
  out._raw = vend.map((v) => ({ ...v, pct_num: v.pct_meta_fat }));
  // totais do dia como na TV (soma dos vendedores, sem rateio)
  const sm = (k) => vend.reduce((t, v) => t + (v[k] || 0), 0);
  out.dia = { pedidos_hoje: sm('pedN'), visitas_hoje: `${sm('visF')} de ${sm('visP')}`, zerados_hoje: vend.filter((v) => v.zerado_hoje).length, sem_nenhuma_visita: vend.filter((v) => v.visP > 0 && v.visF === 0).length,
    meta_batida_no_mes: vend.filter((v) => v.metaN && (v.fatN + v.pendN) >= v.metaN).length, /* igual a TV: faturado + pendente */ vendedores: vend.length, devolucoes_mes: R$(sm('devN')), penaltis_hoje: vend.reduce((t, v) => t + (v.lances_hoje.penalti || 0), 0), gols_hoje: vend.reduce((t, v) => t + (v.lances_hoje.gol || 0), 0) };
  out.vendedores = vend.map((v) => ({ ...v, pct_meta_fat: v.pct_meta_fat == null ? 'sem dado' : String(v.pct_meta_fat).replace('.', ',') + '%' }));
  // COMPROMISSO MATINAL e ROTA DO SUPERVISOR (RET) de hoje (22/10/2026: 'quantos supervisores nao fizeram o compromisso?')
  if (supdia && Array.isArray(supdia.supervisores)) out.supervisores_compromisso_ret = supdia.supervisores.filter((x) => !grupo || vend.some((v) => v.supervisor === x.nome))
    .map((x) => ({ supervisor: x.nome, fez_compromisso: !!x.fez_compromisso, iniciou_ret: !!x.iniciou_ret, ret_pdvs: x.retDetalhe ? x.retDetalhe.pdvs : 0, ret_primeiro_checkin: x.retDetalhe ? x.retDetalhe.primeiroCheckin : null }));
  out.zerados_hoje = vend.filter((v) => v.zerado_hoje).map((v) => `${v.vendedor} (${v.supervisor || 'sem supervisor'}, visitas ${v.visitas_hoje})`);
  if (lances) out.lances_hoje_filial = lances.porNivel;
  // supervisores (soma dos vendedores, sem rateio)
  const sup = new Map(); for (const v of vend) { const s = v.supervisor || 'sem supervisor'; const x = sup.get(s) || { vendedores: 0, zerados: 0, penaltis: 0, gols: 0 }; x.vendedores++; if (v.zerado_hoje) x.zerados++; x.penaltis += v.lances_hoje.penalti || 0; x.gols += v.lances_hoje.gol || 0; sup.set(s, x); }
  for (const v of vend) { const x = sup.get(v.supervisor || 'sem supervisor'); x.fat = (x.fat || 0) + v.fatN; x.pend = (x.pend || 0) + v.pendN; x.meta = (x.meta || 0) + v.metaN; x.dig = (x.dig || 0) + v.digN; }
  // por gerente (TPH e MCD tem 2): soma dos vendedores do grupo
  const ger = new Map(); for (const v of vend) { if (!v.grupo) continue; const x = ger.get(v.grupo) || { vendedores: 0, fat: 0, pend: 0, meta: 0, dig: 0, zerados: 0 }; x.vendedores++; x.fat += v.fatN; x.pend += v.pendN; x.meta += v.metaN; x.dig += v.digN; if (v.zerado_hoje) x.zerados++; ger.set(v.grupo, x); }
  out._ger = Object.fromEntries(ger);
  if (grupo) { const x = ger.get(String(grupo).toUpperCase()) || ger.get(grupo); if (x) out.filial_agora = { ...(out.filial_agora || {}), grupo, faturado: R$(x.fat), pendente: R$(x.pend), meta_mes: R$(x.meta), pct_meta: P(x.fat, x.meta), digitado_hoje: R$(x.dig), positivados_mes: 'por grupo: veja por supervisor' }; }
  for (const x of sup.values()) x.pct = x.meta ? x.fat / x.meta * 100 : null;
  out._sup = Object.fromEntries(sup);
  out.supervisores_hoje = Object.fromEntries([...sup].map(([k, x]) => [k, { vendedores: x.vendedores, zerados: x.zerados, penaltis: x.penaltis, gols: x.gols, pct_meta: x.pct == null ? 'sem dado' : x.pct.toFixed(1).replace('.', ',') + '%' }]));
  if (liga) { const lf = (liga.filiais || []).find((x) => x.sigla === filial); if (lf) out.liga_filial = `${lf.pos}º de 11, ${lf.pts_tabela} pontos (${lf.vitorias}V ${lf.empates}E ${lf.derrotas}D)`;
    out.liga_supervisores = (liga.supervisores || []).filter((x) => x.filial === filial && (!grupo || sup.has(x.supervisor))).map((x) => `${x.pos}º ${x.supervisor} (${x.pts_tabela} pts)`); }
  if (mix) out.mais_mix = (mix.vendedores || []).filter((x) => x.filial === filial).map((x) => `${x.nome}: mix ${String(x.mix_medio).replace('.', ',')} produtos/cliente, ${R$(x.faturado_por_cliente)}/cliente, uso do +MIX ${x.uso_pct == null ? 'sem dado' : String(x.uso_pct).replace('.', ',') + '%'}`);
  return out;
}
// RESPOSTAS PRONTAS (22/10/2026: "e se o gerente perguntar como esta minha filial? aberto por supervisor? dentro do supervisor por vendedor? como esta na liga?"):
// as perguntas principais tem resposta MONTADA PELO CODIGO com os numeros da base (sem IA = sem erro de conta). A IA so entra na pergunta livre.
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const nome2 = (n) => { const p = String(n || '').split(' ').filter((w) => w && !/^(DE|DA|DO|DOS|DAS|E|A)$/i.test(w)); return titulo(p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0] || ''); };
const pctN = (v) => v.pct_num == null ? 'sem dado' : v.pct_num.toFixed(1).replace('.', ',') + '%';
function respFilial(fil, d) {
  const a = d.filial_agora; if (!a) return `Não consegui ler ${fil} agora. Tente em alguns minutos.`;
  const V = d._raw || [], com = V.filter((v) => v.pct_num != null);
  const top = com.slice(0, 2), bx = com.slice(-2).reverse(), z = V.filter((v) => v.zerado_hoje);
  const L = [`📊 *${fil}${a.grupo ? ' · ' + titulo(a.grupo) : ''} agora* (${a.hora})`, `💰 Faturado: *${a.faturado}* de ${a.meta_mes} → *${a.pct_meta}*`, `⏳ Pendente: ${a.pendente}`, `👥 Positivação: ${a.positivados_mes}`, `📝 Digitado hoje: *${a.digitado_hoje}* em *${d.dia ? d.dia.pedidos_hoje : '?'}* pedidos`];
  if (d.dia) L.push(`🚶 Visitas hoje: ${d.dia.visitas_hoje} · sem nenhuma visita: ${d.dia.sem_nenhuma_visita}`, `🏁 Meta batida no mês: ${d.dia.meta_batida_no_mes} de ${d.dia.vendedores} vendedores`, `↩️ Devoluções no mês: ${d.dia.devolucoes_mes}`, `⚽ Hoje: ${d.dia.gols_hoje} gol(s) · ${d.dia.penaltis_hoje} pênalti(s)`);
  const G = Object.entries(d._ger || {}); if (!a.grupo && G.length > 1) { L.push('*Por gerente:*'); for (const [g, x] of G) L.push(`• ${titulo(g)}: ${R$(x.fat)} (${P(x.fat, x.meta)}) · pend. ${R$(x.pend)} · ${x.zerados} zerado(s)`); }
  if (d.liga_filial) L.push(`🏆 Liga: ${d.liga_filial}`);
  L.push(`⚠️ Zerados hoje: *${z.length}*` + (z.length ? ' — ' + z.slice(0, 4).map((v) => nome2(v.vendedor)).join(', ') + (z.length > 4 ? ` +${z.length - 4}` : '') : ''));
  if (top.length) L.push(`✅ Melhores na meta: ${top.map((v) => `${nome2(v.vendedor)} ${pctN(v)}`).join(' · ')}`);
  if (bx.length) L.push(`🔻 Mais atrás: ${bx.map((v) => `${nome2(v.vendedor)} ${pctN(v)}`).join(' · ')}`);
  const sz = Object.entries(d._sup || {}).sort((x, y) => y[1].zerados - x[1].zerados)[0];
  L.push('', sz && sz[1].zerados ? `🎯 *Sugestão do Jota:* falar com ${nome2(sz[0])} — ${sz[1].zerados} vendedor(es) dele sem pedido hoje.` : `🎯 *Sugestão do Jota:* puxar os mais atrás na meta para fechar o mês.`);
  L.push('_Peça "por supervisor", "supervisor Nome" ou "liga"._');
  return L.join('\n');
}
function respPorSupervisor(fil, d) {
  const S = Object.entries(d._sup || {}).filter(([k]) => k !== 'sem supervisor').sort((x, y) => (y[1].pct ?? -1) - (x[1].pct ?? -1));
  if (!S.length) return `Sem dados por supervisor de ${fil} agora.`;
  return [`👥 *${fil} por supervisor*`, ...S.map(([s, x]) => `• *${nome2(s)}* — fat. ${R$(x.fat)} (${x.pct == null ? 'sem dado' : x.pct.toFixed(1).replace('.', ',') + '%'}) · pend. ${R$(x.pend)} · ${x.vendedores} vend. · ${x.zerados} zerado(s)`),
    '', '_Peça "supervisor Nome" para ver os vendedores dele._'].join('\n');
}
function respSupervisor(fil, d, s) {
  const V = (d._raw || []).filter((v) => v.supervisor === s);
  if (!V.length) return `Não achei vendedores de ${titulo(s)} em ${fil}.`;
  const x = (d._sup || {})[s] || {};
  return [`👤 *${titulo(s)}* (${fil}) — ${x.pct == null ? 'sem dado' : x.pct.toFixed(1).replace('.', ',') + '%'} da meta`,
    ...V.map((v) => `• ${v.zerado_hoje ? '⚠️' : '✅'} *${nome2(v.vendedor)}* — fat. ${v.faturado} (${pctN(v)}) · pend. ${v.pendente} · hoje ${v.digitado_hoje} (${v.pedidos_hoje} ped.) · visitas ${v.visitas_hoje}`),
    '', V.some((v) => v.zerado_hoje) ? `🎯 *Sugestão do Jota:* ligar agora para ${V.filter((v) => v.zerado_hoje).slice(0, 3).map((v) => nome2(v.vendedor)).join(', ')} (sem pedido hoje).` : '🎯 *Sugestão do Jota:* equipe toda com pedido hoje; foco em mix nos próximos clientes.'].join('\n');
}
function respLiga(fil, d) {
  return [`🏆 *Champions Triunfante — ${fil}*`, d.liga_filial ? `Filial: *${d.liga_filial}*` : 'Filial: sem dado',
    ...(d.liga_supervisores || []).slice().sort((x, y) => parseInt(x) - parseInt(y)).slice(0, 10).map((x) => `• ${x}`), '', '_Ranking completo: ceven-cftv-matrix.pages.dev/championstriunfante_'].join('\n');
}
function respCompromisso(fil, d) {
  const S = d.supervisores_compromisso_ret; if (!S) return `Não consegui ler o compromisso dos supervisores de ${fil} agora.`;
  const semC = S.filter((x) => !x.fez_compromisso), semR = S.filter((x) => !x.iniciou_ret);
  return [`🗓️ *Supervisores de ${fil} hoje* (${S.length})`, `Compromisso matinal: *${S.length - semC.length} fizeram* · *${semC.length} não fizeram*` + (semC.length ? ' — ' + semC.map((x) => nome2(x.supervisor)).join(', ') : ''),
    `Rota com vendedor (RET): *${S.length - semR.length} iniciaram* · *${semR.length} não* ` + (semR.length ? '— ' + semR.map((x) => nome2(x.supervisor)).join(', ') : ''),
    ...S.filter((x) => x.iniciou_ret && x.ret_pdvs > 0).map((x) => `• ${nome2(x.supervisor)}: ${x.ret_pdvs} PDV(s) na RET, 1º check-in ${x.ret_primeiro_checkin || '—'}`),
    '', semC.length ? `🎯 *Sugestão do Jota:* cobrar o compromisso de ${semC.slice(0, 3).map((x) => nome2(x.supervisor)).join(', ')}.` : '🎯 *Sugestão do Jota:* todos fizeram o compromisso; acompanhar a execução das RETs.'].join('\n');
}
function respostaPronta(texto, fil, d) {
  const t = sem(texto);
  if (/COMPROMISSO|MATINAL|\bRET\b|ROTA DO SUPERVISOR|SUPERVISOR(ES)? (NA|EM) ROTA/.test(t)) return respCompromisso(fil, d);
  if (/LIGA|CHAMPIONS|RANKING|TABELA|CLASSIFICA/.test(t)) return respLiga(fil, d);
  const sups = Object.keys(d._sup || {}).filter((s) => s !== 'sem supervisor');
  const achou = sups.find((s) => sem(s).split(' ').filter((w) => w.length > 2).some((w) => new RegExp('\\b' + w + '\\b').test(t)) && /SUPERVIS|EQUIPE|TIME|VENDEDOR/.test(t))
    || sups.find((s) => t.includes(sem(s).split(' ').slice(0, 2).join(' ')));
  if (achou) return respSupervisor(fil, d, achou);
  if (/SUPERVIS|POR EQUIPE|ABERTO/.test(t)) return respPorSupervisor(fil, d);
  if (/COMO (ESTA|TA|VAI)|MINHA FILIAL|RESUMO|HOJE|PANORAMA|STATUS/.test(t)) return respFilial(fil, d);
  return null;
}

async function respondeIA(env, origin, c, texto, historico) {
  if (!env.AI) return null;
  // filial: a do cadastro (gerente) ou a citada agora; senao a mais recente da conversa (diretoria)
  const FRX = /\b(ABC|API|MCD|TBE|TBL|TCA|TCG|TCV|TPA|TPH|TSJ)\b/;
  let fil = c.filial || (texto.toUpperCase().match(FRX) || [])[1];
  if (!fil) for (const h of [...historico].reverse()) { const m = String(h.content).toUpperCase().match(FRX); if (m) { fil = m[1]; break; } }
  const filiais = fil ? [fil] : [];
  const dados = {}; for (const f of filiais) dados[f] = await dadosDaFilial(origin, f, env, c.papel === 'gerente' ? c.grupo : null);
  if (fil) { const pronta = respostaPronta(texto, fil, dados[fil]); if (pronta) return pronta; }
  for (const f of filiais) { delete dados[f]._raw; delete dados[f]._sup; delete dados[f]._ger; }
  try { await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto) VALUES (?,?,?,?)').bind(c.celular, c.nome, 'debug', JSON.stringify(Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, Object.keys(v)])))).run(); } catch (e) {}
  const sys = `Você é o JOTA, o assistente do +MIX da Triunfante no WhatsApp: colega de vendas animado, direto, que usa a linguagem do futebol da Champions Triunfante quando cabe. Responde em português do Brasil como um gerente comercial experiente: natural, objetivo, sem enrolação.
Quem fala com você: ${titulo(c.nome)}, ${c.papel}${c.filial ? ' da filial ' + c.filial : ' (diretoria, vê todas as filiais)'}${c.grupo ? ', grupo ' + c.grupo : ''}.
COMO RESPONDER:
- Use SÓ os números dos DADOS, exatamente como estão escritos (já vêm formatados, ex.: "R$ 6.054.971", "50,3%"). Nunca invente, estime nem recalcule; se não tiver o dado, diga que não tem.
- Formato WhatsApp: *negrito* com UM asterisco de cada lado (nunca **). Uma ideia por linha. Use no máximo 10 linhas. Pode usar emoji com moderação (📊 ✅ ⚠️ 🎯).
- "Como está a filial": 1) faturado + pendente e % da meta; 2) positivação; 3) digitado hoje; 4) zerados hoje (cite até 3 nomes); 5) destaque e alerta de vendedor (maior e menor % da meta).
- Compromisso matinal e rota do supervisor (RET): campo supervisores_compromisso_ret.
- Pergunta sobre vendedor ou supervisor: use a lista de vendedores e supervisores. Pedidos de hoje: campo pedidos_hoje (filial em dia.pedidos_hoje).
- Sempre termine com *🎯 Sugestão:* UMA ação concreta e nominal baseada nos dados (ex.: cobrar o supervisor X pelos 3 zerados).
- Fale só da filial ${c.filial || 'que a pessoa pediu'}.${filiais.length ? '' : ' A pessoa não disse a filial: pergunte qual.'}
DADOS (JSON): ${JSON.stringify(dados).slice(0, 24000)}`;
  const msgs = [{ role: 'system', content: sys }, ...historico, { role: 'user', content: texto }];
  try { const r = await env.AI.run(MODELO, { messages: msgs, max_tokens: 700 }); const t = String((r && (r.response || r.result)) || '').trim().replace(/\*\*/g, '*').replace(/^#+\s*/gm, ''); return t || null; } catch (e) { return null; }
}

export async function onRequestPost({ request, env }) {
  const u = new URL(request.url);
  if (!env.BOT_WEBHOOK_KEY || u.searchParams.get('k') !== env.BOT_WEBHOOK_KEY) return new Response('nao autorizado', { status: 401 });
  let ev; try { ev = await request.json(); } catch { return new Response('ok'); }
  const d = ev && ev.data;
  if (!d || !d.key || d.key.fromMe) return new Response('ok');
  const jid = String(d.key.remoteJid || '');
  if (!jid.endsWith('@s.whatsapp.net')) return new Response('ok');   // grupo, status, broadcast: ignora
  const texto = String((d.message && (d.message.conversation || (d.message.extendedTextMessage && d.message.extendedTextMessage.text))) || '').trim();
  if (!texto) return new Response('ok');
  const cel = so(u.searchParams.get('seco') === '1' && u.searchParams.get('como') ? u.searchParams.get('como') : jid.split('@')[0]);
  await tabelas(env.DB);
  const vs = variantes(cel);
  const c = await env.DB.prepare(`SELECT * FROM bot_contatos WHERE ativo = 1 AND celular IN (${vs.map(() => '?').join(',')}) LIMIT 1`).bind(...vs).first();
  if (u.searchParams.get('seco') !== '1') await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, msg_id) VALUES (?,?,?,?,?)').bind(cel, c ? c.nome : null, 'in', texto.slice(0, 2000), d.key.id || null).run();
  if (!c) return new Response('ok');   // so responde quem esta cadastrado
  const primeiro = titulo(String(c.nome).split(' ')[0]);
  const { results: hist } = await env.DB.prepare("SELECT direcao, texto FROM bot_msgs WHERE celular = ? AND direcao IN ('in','out') AND quando >= datetime('now','-6 hours') ORDER BY id DESC LIMIT 7").bind(cel).all();
  const historico = (hist || []).slice(1).reverse().map((h) => ({ role: h.direcao === 'in' ? 'user' : 'assistant', content: h.texto }));
  let resp = await respondeIA(env, u.origin, c, texto, historico);
  if (!resp) {
  if (c.papel === 'diretoria' || !c.filial) {
    resp = `Oi, ${primeiro}! Sou o Jota, do +MIX. Me diga a filial (ex.: *TPH*) que eu mostro como ela está agora.`;
    const fil = (texto.toUpperCase().match(/\b(ABC|API|MCD|TBE|TBL|TCA|TCG|TCV|TPA|TPH|TSJ)\b/) || [])[1];
    if (fil) resp = await resumoFilial(u.origin, fil);
  } else {
    resp = `Oi, ${primeiro}! ` + await resumoFilial(u.origin, c.filial) + `\n\n_Em breve você vai poder perguntar do seu jeito (clientes, produtos, +MIX, Liga)._`;
  }
  }
  // teste sem enviar (?seco=1&como=CELULAR): devolve a resposta em vez de mandar no WhatsApp
  if (u.searchParams.get('seco') === '1') return new Response(resp, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const e = await enviar(env, cel, resp);
  await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto) VALUES (?,?,?,?)').bind(cel, c.nome, e.ok ? 'out' : 'erro', resp.slice(0, 2000)).run();
  return new Response('ok');
}
export async function onRequestGet() { return new Response('assistente +MIX: use POST (webhook da Evolution)', { status: 200 }); }
