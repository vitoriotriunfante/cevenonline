// =========================================================================
// JOTA · functions/_lib/jota/respostas/gestao.js
// O QUE É: carteira, ritmo, gaps, rankings, comparações, dobradinha, aviso de equipe.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { N, P, R$, SUGESTAO, diasUteisRestantes, hojeSP, nome2, sem, titulo, vn } from '../base.js';
import { agrupa, carregaEscopo, pctTxt, pessoaReal, sn, supChave, supNome, supReal } from '../escopo.js';
import { totaisOficiais } from './resumo.js';
import { ehFeriado } from '../../feriados.js';

// ---------- PERGUNTAS DA REUNIAO DE 5 H (25/10/2026) que o dado do site ja responde ----------
export function diasUteisMes() {
  const [y, m, d] = hojeSP().split('-').map(Number), fim = new Date(Date.UTC(y, m, 0)).getUTCDate(); let tot = 0, pass = 0;
  for (let i = 1; i <= fim; i++) { const w = new Date(Date.UTC(y, m - 1, i)).getUTCDay(); if (w > 0 && w < 6 && !ehFeriado(`${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`)) { tot++; if (i < d) pass++; }   /* feriado nao e dia util (12/10) */ }
  return { tot, pass };
}
function diasUteisAgora() {
  const hoje = hojeSP(), { tot, pass } = diasUteisMes();
  const [y, m, d] = hoje.split('-').map(Number), w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const ehDU = w > 0 && w < 6 && !ehFeriado(hoje);
  const falt = Math.max(1, diasUteisRestantes()), dec = Math.max(1, Math.min(tot, pass + (ehDU ? 1 : 0)));
  return { hoje, tot, pass, dec, falt };
}
export async function respCarteira(B, E) {
  const x = await totaisOficiais(B, E); if (!x.meta) return 'Sem dado agora.';
  const soma = x.fat + x.pend, falta = Math.max(0, x.meta - soma);
  const out = [
    `💼 *Faturado + Pedidos Pendentes — ${E.nome}*`,
    `💰 Faturado oficial: *${R$(x.fat)}* de ${R$(x.meta)} (${P(x.fat, x.meta)})`,
    `⏳ Carteira liberada (pendente de faturamento): *${R$(x.pend)}*`,
    `📦 Projeção total na mão: *${R$(soma)}* (${P(soma, x.meta)} da meta)`,
    `🎯 Falta para a meta: *${R$(falta)}*`
  ];
  if (E.vend && E.vend.length > 1 && !E.nacional) {
    const porVend = E.vend.filter((v) => pessoaReal(v)).map((v) => ({
      v,
      fat: v.fat || 0,
      pend: v.pend || 0,
      soma: (v.fat || 0) + (v.pend || 0),
      meta: v.meta || 0,
      pct: v.meta ? ((v.fat || 0) + (v.pend || 0)) / v.meta * 100 : 0
    })).sort((a, b) => b.soma - a.soma);
    out.push('', `*Aberto por vendedor (Faturado + Carteira pendente):*`);
    out.push(...porVend.map((item, i) => `${i + 1}. *${vn(item.v)}*: faturado ${R$(item.fat)} + pendente ${R$(item.pend)} = *${R$(item.soma)}* (${pctTxt(item.pct)})`));
  } else {
    const G = [...agrupa(E.vend, (v) => (E.nacional ? v.filial : supChave(v, false)))].filter(([k]) => E.nacional || supReal(k)).map(([k, y]) => [k, y, y.meta ? (y.fat + y.pend) / y.meta * 100 : null]).sort((a, b) => (b[2] ?? -1) - (a[2] ?? -1));
    out.push('', `*Ranking por (faturado + carteira) ÷ meta — ${E.nacional ? 'filiais' : 'supervisores'}:*`);
    out.push(...G.map(([k, y, p], i) => `${i + 1}. ${E.nacional ? k : nome2(k)}: ${pctTxt(p)} · fat. ${R$(y.fat)} + cart. ${R$(y.pend)} · gap ${R$(Math.max(0, y.meta - y.fat - y.pend))}`));
  }
  out.push('', '_"Faturado + carteira" são pedidos liberados; pedidos bloqueados/crédito aguardam liberação financeira._');
  return out.join('\n');
}
// ---------- RITMO E NECESSIDADE = SO O GEROT (23/11/2026, docs/DICIONARIO_KPIS.md 3.7/3.8, conflitos 5 e 6) ----------
// ritmo = captacao / meta ideal de captacao de hoje; necessidade/dia = max(0, meta - captacao) / dias uteis restantes (convencao do GEROT).
// No nivel com linha propria (vendedor, filial) = o campo do GEROT; grupo/equipe/Brasil = soma das captacoes / soma das metas ideais. Sem captacao = sem ritmo (nunca a tendencia linear).
function ritmoDe(y, du) {
  const cap = y.cap, ideal = y.ideal, meta = y.meta || 0;
  if (cap == null || !ideal) return { pct: null, nec: null };
  return { pct: y.ritmo != null ? y.ritmo : cap / ideal * 100, nec: y.nec != null ? y.nec : (du.restantes > 0 ? Math.max(0, meta - cap) / du.restantes : null) };
}
// linhas um nivel abaixo, da MESMA tabela do total: Brasil -> filiais (gerot_filial_mes); filial/grupo -> equipes da Gestao (soma dos vendedores); supervisor -> vendedores
async function linhasRitmo(B, E, K) {
  if (E.nacional) return Object.entries(K.porFilial || {}).map(([k, y]) => ({ k, fat: y.fat, cart: y.cart, meta: y.meta, cap: y.cap, ideal: y.ideal, ritmo: y.ritmo, nec: y.nec }));
  if (E.rca) return [];
  const V = (E.vend || []).concat(E.ocultos || []).filter((v) => v.gerot);
  const chave = E.supervisor ? (v) => vn(v) : (v) => (supReal(v.supervisor || 'sem supervisor') ? 'sup. ' + supNome(supChave(v, false)) : 'Ligados ao gerente');
  const m = new Map();
  for (const v of V) { const k = chave(v), x = m.get(k) || { k, fat: 0, cart: 0, meta: 0, cap: 0, ideal: 0, n: 0, v }; x.fat += v.fat || 0; x.cart += v.pend || 0; x.meta += v.meta || 0; x.cap += v.cap || 0; x.ideal += v.ideal || 0; x.n++; m.set(k, x); }
  return [...m.values()].map((x) => (E.supervisor && x.n === 1 ? { ...x, ritmo: x.v.ritmo, nec: x.v.necDia } : x));
}
export async function respRitmo(B, E) { return respTendencia(B, E); }

export function respMaiorGap(E) {
  const V = E.vend.filter((v) => v.meta > 0 && pessoaReal(v)).map((v) => ({ v, gap: Math.max(0, v.meta - v.fat - v.pend) })).sort((a, b) => b.gap - a.gap).slice(0, 10);
  return [`🕳️ *Maior gap para a meta — ${E.nome}* (meta − faturado − carteira)`, ...V.map(({ v, gap }, i) => `${i + 1}. ${vn(v)}${E.nacional ? ' (' + v.filial + ')' : ''} — falta *${R$(gap)}* · ${pctTxt(v.pct)} · setor/sup. ${sn(v.supervisor, v.supCod)}`), '', SUGESTAO + `sentar com ${sn(V[0] && V[0].v.supervisor, V[0].v.supCod)} sobre ${nome2(V[0] && V[0].v.nome)} hoje.`].join('\n');
}
export function respRankingSupervisores(E) {
  const S = [...agrupa(E.vend, (v) => supChave(v, true))].filter(([k]) => supReal(k) && !/^VAGO/.test(k)).filter(([, x]) => x.meta > 0).sort((a, b) => (b[1].pct ?? -1) - (a[1].pct ?? -1));
  return [`👥 *Ranking dos supervisores — ${E.nome}* (% da meta: faturado + pendente)`, '*Melhores:*', ...S.slice(0, 10).map(([k, x], i) => `${i + 1}. ${supNome(k)} — ${pctTxt(x.pct)} · ${R$(x.fat)}`), '*Mais atrás:*', ...S.slice(-8).reverse().map(([k, x]) => `• ${supNome(k)} — ${pctTxt(x.pct)} · ${x.zerados} zerado(s)`)].join('\n');
}
export function respRankingGerentes(E) {
  const G = [...agrupa(E.vend, (v) => v.filial + (v.grupo ? ' · ' + titulo(v.grupo) : ''))].filter(([, x]) => x.meta > 0).sort((a, b) => (b[1].pct ?? -1) - (a[1].pct ?? -1));
  return [`🧑‍💼 *Ranking dos gerentes* (% da meta: faturado + pendente; TPH, MCD e TPA por gerente)`, ...G.map(([k, x], i) => `${i + 1}. ${k}${x.V[0] && x.V[0].gerente && !k.includes('·') ? ' — ' + titulo(x.V[0].gerente) : ''}: ${pctTxt(x.pct)} · ${R$(x.fat)} · pend. ${R$(x.pend)}`)].join('\n');
}
export async function respComparar(B, fs) {
  const esc = await carregaEscopo(B, { nome: fs.join(' × '), filiais: fs });
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const gFil = new Map();
  if (B && B.env && B.env.DB) {
    try {
      const mes = hojeSP().slice(0, 7);
      const { results } = await B.env.DB.prepare("SELECT filial, coalesce(json_extract(dados,'$.\"Positivação (filial + CNPJ)\"'), json_extract(dados,'$.\"Positivação (filial)\"')) pos, coalesce(json_extract(dados,'$.\"Meta de positivação\"'), json_extract(dados,'$.\"Meta clientes\"')) meta_pos FROM gerot_filial_mes WHERE mes = ?").bind(mes).all();
      for (const r of results || []) if (r.pos != null) gFil.set(r.filial, { pos: Number(r.pos) || 0, metaPos: r.meta_pos != null ? Number(r.meta_pos) || 0 : null });
    } catch { /* segue com soma */ }
  }
  const F = fs.map((sigla) => {
    const p = esc.porFilial && esc.porFilial[sigla];
    const vs = p ? (p.vend || []).concat(p.ocultos || []) : [];
    const g = agrupa(vs, () => 'x').get('x') || { fat: 0, pend: 0, meta: 0, pos: 0, metaPos: 0, dig: 0 };
    const gf = gFil.get(sigla);
    return { filial: sigla, faturado: g.fat, pendente: g.pend, meta_fat: g.meta, positivados: gf ? gf.pos : g.pos, meta_pos: gf && gf.metaPos != null ? gf.metaPos : g.metaPos, digitado_hoje: (p && p.macro && p.macro.dig) || g.dig };
  }).filter((f) => f.meta_fat > 0 || f.faturado > 0 || f.digitado_hoje > 0);
  if (F.length < 2) return null;
  const lin = (r, fn) => `${r}: ` + F.map((f) => `*${f.filial}* ${fn(f)}`).join(' × ');
  return [`⚖️ *${fs.join(' × ')}* (${hora})`, lin('Faturado', (f) => `${P(f.faturado || 0, f.meta_fat)} (${R$(f.faturado)})`), lin('Pendente', (f) => R$(f.pendente)), lin('Positivação', (f) => `${P(f.positivados, f.meta_pos)} (${N(f.positivados)})`), lin('Digitado hoje', (f) => R$(f.digitado_hoje))].join('\n');
}
export async function respPontosPerdidos(B, E) {
  const lc = await B.lances(); if (!lc) return 'Não consegui ler os lances agora.';
  const rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const L = (lc.lances || []).filter((l) => E.filiais.includes(l.filial) && (!(E.grupo || E.supervisor || E.rca) || rcas.has(l.filial + '|' + l.rca)) && (l.pontos || 0) < 0);
  const G = {}; for (const l of L) { const k = l.pontos_nome || l.nivel; G[k] = G[k] || { n: 0, p: 0 }; G[k].n++; G[k].p += l.pontos; }
  const tot = L.reduce((a, l) => a + l.pontos, 0);
  return [`🚨 *Pontos perdidos hoje na Liga — ${E.nome}*: *${tot} pontos* em ${L.length} lance(s)`, ...Object.entries(G).sort((a, b) => a[1].p - b[1].p).map(([k, x]) => `• ${k}: ${x.n}× = ${x.p} pts`), '', '_Peça "pênaltis" ou "impedimentos" para ver quem e por quê._'].join('\n');
}
export function respMetaBatida(E) {
  const V = E.vend.filter((v) => v.meta > 0 && pessoaReal(v));
  const fat = V.filter((v) => v.fat >= v.meta).sort((a, b) => b.pct - a.pct), proj = V.filter((v) => v.fat < v.meta && v.fat + v.pend >= v.meta);
  return [`🏁 *Meta batida — ${E.nome}*`, `No faturado: *${fat.length} de ${V.length}* vendedores` + (fat.length ? ' — ' + fat.slice(0, 12).map((v) => `${vn(v)} ${pctTxt(v.pct)}`).join(', ') : ''), `Batem com a carteira (fat. + pend.): ${proj.length}` + (proj.length ? ' — ' + proj.slice(0, 10).map((v) => vn(v)).join(', ') : '')].join('\n');
}
export async function respDobradinha(B, E) {
  const mx = await B.mix(); if (!mx) return 'Não consegui ler o +MIX agora.';
  const rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const V = (mx.vendedores || []).filter((x) => E.filiais.includes(x.filial) && (!(E.grupo || E.supervisor || E.rca) || rcas.has(x.filial + '|' + x.rca)) && x.dobradinha_pct != null).sort((a, b) => b.dobradinha_pct - a.dobradinha_pct);
  if (!V.length) return 'Sem dado de dobradinha agora.';
  const f = (v) => `${vn(v)}${E.nacional ? ' ' + v.filial : ''}: ${String(v.dobradinha_pct).replace('.', ',')}%`;
  return [`🔁 *Dobradinha das quinzenas — ${E.nome}* (% dos clientes do mês que compraram nas duas quinzenas; +MIX, até ${mx.dados_ate || 'ontem'})`, '*Mais dobradinha:*', ...V.slice(0, 8).map((v) => '• ' + f(v)), '*Menos:*', ...V.slice(-5).reverse().map((v) => '• ' + f(v)), '', SUGESTAO + 'quem compra só numa quinzena é o primeiro da rota na segunda.'].join('\n');
}
export const SEM_HISTORICO = 'Esse eu ainda não tenho: precisa do *histórico diário* por vendedor (uma foto do dia guardada todo fim de tarde), que ainda não guardamos. Com ele eu respondo "dias seguidos sem pedido" e a comparação com o mesmo período do mês passado. Já está na lista da reunião de metas.';
export async function respInfoEquipe(env, c, texto) {
  try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS bot_avisos_equipe (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, quem TEXT, filial TEXT, texto TEXT, situacao TEXT DEFAULT \'novo\')').run();
    await env.DB.prepare('INSERT INTO bot_avisos_equipe (celular, quem, filial, texto) VALUES (?,?,?,?)').bind(c.celular || '', c.nome || '', c.filial || '', String(texto).slice(0, 500)).run(); } catch (e) { return 'Não consegui anotar agora. Me manda de novo em instantes.'; }
  return `📝 Anotado, ${titulo(String(c.nome || '').split(' ')[0])}. Mandei para a *Gestão de Equipe* decidir (ex.: tirar da cobrança, desconsiderar da leitura). Enquanto não for decidido lá, eu continuo mostrando a pessoa normalmente.`;
}

// TENDENCIA DE FECHAMENTO (Vitorio, 26/10/2026: "pq vc nao pode fazer uma projecao? se vc tem o faturado + pendente... sabe quantos dias faltam... e matematica
// pura... so deixa claro que isso e tendencia... e da para atualizar diario"). Conta: ritmo = (faturado + pendente) / dias uteis decorridos (hoje conta);
// tendencia = ritmo x dias uteis do mes. Necessario = (meta - faturado - pendente) / dias uteis que faltam. Seg-sex, sem descontar feriado. Sempre rotulado TENDENCIA.
export async function respTendencia(B, E) {
  const { kpisDoEscopo } = await import('../escopo.js'), { diasUteis, linhasQueFecham } = await import('../../fatos/index.js');
  const K = await kpisDoEscopo(B, E), du = diasUteis();
  if (!K || !K.meta) return 'Sem dado do GEROT agora para ' + E.nome + '.';
  const pc1 = (x) => x.toFixed(1).replace('.', ',') + '%';
  const T = ritmoDe(K, du), fc = (K.fat || 0) + (K.cart || 0);
  const L0 = await linhasRitmo(B, E, K);
  const L = linhasQueFecham({ fat: K.fat, cart: K.cart, meta: K.meta }, L0.filter((x) => x.fat || x.cart || x.meta).map((x) => ({ ...x })), ['fat', 'cart', 'meta']).map((x) => (x.fora ? { ...x, k: 'fora das equipes' } : { ...x, r: ritmoDe(x, du) }));
  L.sort((a, b) => (a.fora ? 1 : b.fora ? -1 : (a.r.pct ?? 1e9) - (b.r.pct ?? 1e9)));
  const nivel = E.nacional ? 'filial' : E.supervisor ? 'vendedor' : 'supervisor';
  const out = [`📈 *Ritmo do mês — ${E.nome}* _(régua do GEROT: captação ÷ meta ideal de hoje)_`,
    `💰 Faturado *${R$(K.fat)}* + carteira ${R$(K.cart)} = *${R$(fc)}* = *${P(fc, K.meta)}* da meta (${R$(K.meta)})`,
    T.pct != null ? `📈 Captação do mês *${R$(K.cap)}* = *${pc1(T.pct)}* do ideal para hoje (${R$(K.ideal)}) → no ritmo de hoje fecha em *${pc1(T.pct)}* da meta` : '📈 Ritmo: sem captação do GEROT para este recorte (sem ritmo, não estimo).',
    du.restantes > 0 ? (T.nec != null ? `🎯 Precisa captar *${R$(T.nec)}* por dia útil nos ${du.restantes} dias úteis que faltam (necessidade do GEROT)` : '') : '🏁 Último dia útil do mês.',
    ...(K.capM1 ? [`📅 Mês passado até o mesmo dia: captação ${R$(K.capM1)} → hoje *${(K.cap / K.capM1 - 1) * 100 >= 0 ? '▲ +' : '▼ '}${((K.cap / K.capM1 - 1) * 100).toFixed(1).replace('.', ',')}%*`] : [])].filter(Boolean);
  if (L.length > 1) {
    out.push('', `*Por ${nivel} (pior ritmo primeiro):*`);
    for (const x of L.slice(0, 15)) out.push(x.fora ? `• _fora das equipes_: ${R$(x.fat)} faturado · carteira ${R$(x.cart)} _(${x.negativo ? 'devolução lançada em RCA sem equipe: venda indústrias, histórico' : 'sem equipe na Gestão, histórico, vaga'})_` : `• ${x.k}: ${R$(x.fat)} faturado · ritmo ${x.r.pct == null ? 'sem captação' : pc1(x.r.pct) + ' do ideal'}${x.r.nec ? ' · precisa ' + R$(x.r.nec) + '/dia' : ''}`);
    if (L.length > 15) out.push(`… e mais ${L.length - 15}`);
  }
  const pior = L.find((x) => !x.fora && x.r && x.r.pct != null);
  out.push('', `_Fonte: GEROT${K.posicao ? ' (posição ' + K.posicao + ')' : ''} · ritmo e necessidade = os do GEROT · dias úteis: ${du.decorridos} de ${du.total} (seg–sex, sem feriados)._`, SUGESTAO + (pior ? `atacar ${pior.k}, o pior ritmo.` : 'manter o ritmo.'));
  return out.join('\n');
}

export async function respMaiorAtrasoMeta(B, E) {
  if (!B || !B.env || !B.env.DB) return null;
  const mes = hojeSP().slice(0, 7), { dec, falt } = diasUteisAgora();
  const fil = (E.filiais || []).length ? E.filiais : ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
  const qs = fil.map(() => '?').join(',');
  const { results } = await B.env.DB.prepare(`SELECT filial, rca, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...fil).all().catch(() => ({ results: [] }));
  let rows = (results || []).map((r) => {
    let d = {}; try { d = JSON.parse(r.dados || '{}'); } catch {}
    const meta = Number(d['Meta (R$)']) || 0, fat = Number(d['Faturado líquido (R$)']) || 0, pend = Number(d['Carteira pendente (R$)']) || 0, vend = fat + pend;
    return { filial: r.filial, rca: r.rca, sup: r.supervisor || '', nome: r.vendedor || '', meta, vend, pct: meta > 0 ? (vend / meta) * 100 : null, falta: Math.max(0, meta - vend), nec: d['Necessidade dia captação (R$)'] == null ? null : Number(d['Necessidade dia captação (R$)']) };   /* 23/11/2026: precisa/dia = o do GEROT (3.8) */
  }).filter((x) => x.meta > 0 && x.falta > 0);
  if (E.supervisor) {
    const sAlvo = sem(E.supervisor);
    rows = rows.filter((x) => sem(x.sup).includes(sAlvo) || sAlvo.includes(sem(x.sup)));
  }
  if (!rows.length) return `Não há vendedores com meta em aberto no GEROT para ${E.nome}.`;
  rows.sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0) || b.falta - a.falta);
  return [
    `🐢 *Vendedores com maior atraso para a meta — ${E.nome}*`,
    `_Critério: menor % vendido (faturado + carteira) no GEROT · ${falt} dia(s) útil(eis) restante(s)_`,
    '',
    ...rows.slice(0, 12).map((x, i) => `${i + 1}. *${x.rca} - ${titulo(x.nome)}*${E.nacional ? ' (' + x.filial + ')' : ''}: *${x.pct.toFixed(1).replace('.', ',')}%* (${R$(x.vend)} de ${R$(x.meta)}) · falta ${R$(x.falta)}${x.nec != null ? ` · precisa captar ${R$(x.nec)}/dia (GEROT)` : ''}`),
    '',
    SUGESTAO + `cobrar plano de ação imediato de *${titulo(rows[0].nome)}* (${rows[0].pct.toFixed(1).replace('.', ',')}%).`
  ].join('\n');
}

export async function respBloqueioComercial(B, E) {
  // 23/11/2026 (docs/DICIONARIO_KPIS.md 3.11, conflito 8): bloqueados = gerot_carteira (pedido a pedido, situacao do Winthor; soma bate com a Carteira pendente
  // do GEROT centavo a centavo). Antes: pedido_status dos ultimos 7 dias (esparso: TPH 26 ped. R$ 200 mil x 303 ped. R$ 550 mil no GEROT).
  if (!B || !B.env || !B.env.DB) return null;
  const fil = (E.filiais || []).length && !E.nacional ? E.filiais : ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
  const rcas = E.rca ? [String(E.rca)] : (E.supervisor || E.grupo) && E.vend && E.vend.length ? E.vend.concat(E.ocultos || []).map((v) => String(v.rca)) : null;
  const { carteira, posicaoGerot } = await import('../../fatos/index.js');
  const C = await carteira(B.env.DB, { filiais: fil, rcas }); if (!C) return 'Sem leitura da carteira do GEROT agora.';
  const qs = fil.map(() => '?').join(','), fr = rcas ? ` AND CAST(rca AS INTEGER) IN (${rcas.map(Number).filter((x) => !Number.isNaN(x)).join(',') || -1})` : '';
  const { results } = await B.env.DB.prepare(`SELECT filial, rca, vendedor, pedido, cliente, entrada, valor, situacao, motivo FROM gerot_carteira WHERE situacao LIKE 'Bloqueado%' AND filial IN (${qs})${fr} ORDER BY valor DESC LIMIT 12`).bind(...fil).all().catch(() => ({ results: [] }));
  const pos = await posicaoGerot(B.env.DB);
  if (!C.bloqueado.n) return `✅ *Bloqueios — ${E.nome}*: nenhum pedido bloqueado na carteira do GEROT.\n_Carteira Total do GEROT · ${pos || 'sem hora'}_`;
  const dm = (d) => (d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}` : '');
  return [
    `🚫 *Pedidos bloqueados na carteira — ${E.nome}*`,
    `Total: *${N(C.bloqueado.n)} pedido(s)* · *${R$(C.bloqueado.v)}*`,
    `🔴 Bloqueado financeiro: *${R$(C.bloqFin.v)}* · ${N(C.bloqFin.n)} ped.`,
    `🟠 Bloqueado comercial: *${R$(C.bloqCom.v)}* · ${N(C.bloqCom.n)} ped.`,
    '', '*Maiores:*',
    ...(results || []).map((p) => `• Ped. *${p.pedido}* · ${p.rca} - ${titulo(String(p.vendedor || '').toLowerCase())} · ${titulo(String(p.cliente || '').toLowerCase()).slice(0, 30)} · *${R$(p.valor || 0)}* · ${String(p.situacao || '').replace(/^Bloqueado\s*/i, '').toLowerCase()}${p.entrada ? ' (' + dm(p.entrada) + ')' : ''}`),
    '', SUGESTAO + 'priorizar o destrave dos pedidos de maior valor com o financeiro/comercial.',
    `_Carteira Total do GEROT · ${pos || 'sem hora'}_`,
  ].join('\n');
}

export async function respFaseamentoSemana(B, E, t) {
  const mSem = String(t || '').match(/\b([1-4])[OA°º]?\s*SEMANA\b/);
  const hojeD = Number(hojeSP().slice(8, 10));
  const semNum = mSem ? Number(mSem[1]) : (hojeD <= 7 ? 1 : hojeD <= 14 ? 2 : hojeD <= 21 ? 3 : 4);
  const pctAlvo = Math.min(100, semNum * 25);
  let meta = 0, vend = 0;
  if (B && B.env && B.env.DB && !E.rca && !E.supervisor) {
    const mes = hojeSP().slice(0, 7), fil = (E.filiais || []).length ? E.filiais : ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
    const qs = fil.map(() => '?').join(',');
    const { results } = await B.env.DB.prepare(`SELECT dados FROM gerot_filial_mes WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...fil).all().catch(() => ({ results: [] }));
    for (const r of results || []) { try { const d = JSON.parse(r.dados || '{}'); meta += Number(d['Meta (R$)']) || 0; vend += (Number(d['Faturado líquido (R$)']) || 0) + (Number(d['Carteira pendente (R$)']) || 0); } catch {} }
  }
  if (!meta) { const x = await totaisOficiais(B, E); meta = x.meta; vend = (x.fat || 0) + (x.pend || 0); }
  if (!meta) return `Sem meta cadastrada para calcular o faseamento de ${E.nome}.`;
  const alvo = meta * (pctAlvo / 100), diff = vend - alvo;
  return [
    `📐 *Faseamento da ${semNum}ª semana — ${E.nome}*`,
    `🎯 Alvo acumulado da ${semNum}ª semana (${pctAlvo}% da meta): *${R$(alvo)}* (de ${R$(meta)})`,
    `💰 Realizado (faturado + carteira): *${R$(vend)}* (*${P(vend, meta)}* da meta)`,
    diff >= 0 ? `✅ *Acima do faseamento em ${R$(diff)}*` : `⏳ *Faltam ${R$(Math.abs(diff))}* para bater o faseamento da ${semNum}ª semana`,
    '',
    '_Nota: no AS, a regra oficial de faseamento é 60% da meta até o dia 20; aqui mostramos a referência semanal linear (25%/50%/75%/100%)._'
  ].join('\n');
}

export async function respMatinal(B, E) {
  if (!B || !B.env || !B.env.DB) return null;
  const { hoje, tot, dec, falt } = diasUteisAgora(), mes = hoje.slice(0, 7);
  const fil = (E.filiais || []).length ? E.filiais : ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
  const qs = fil.map(() => '?').join(',');
  const [stGerot, vendRes, rotaRes, pedRes, prospRes, arvRes] = await Promise.all([
    B.env.DB.prepare('SELECT posicao, em FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first().catch(() => null),
    B.env.DB.prepare(`SELECT filial, rca, cod_sup, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...fil).all().catch(() => ({ results: [] })),
    /* 16/11/2026 (mapa de dados: 'Rota 0 PDVs' em 57 respostas — a tabela roteiro_dia nao existe): rota do dia = roteiros do Clube de hoje */ B.env.DB.prepare(`SELECT filial, rca, roteiros n FROM clube_venda_dia WHERE dia = ? AND filial IN (${qs})`).bind(hoje, ...fil).all().catch(() => ({ results: [] })),
    /* 17/11/2026: bloqueados = Carteira Total do GEROT (situacao 'Bloqueado Comercial/Financeiro'), nao a linha do tempo parada do CEVEN */ B.env.DB.prepare(`SELECT c.filial, c.rca, COUNT(*) qtd, SUM(c.valor) vlr FROM gerot_carteira c WHERE c.filial IN (${qs}) AND c.situacao LIKE 'Bloqueado%' GROUP BY c.filial, c.rca`).bind(...fil)   /* 23/11/2026 (dicionario 3.11, conflito 8): valor = gerot_carteira.valor, que bate centavo a centavo com a Carteira pendente do GEROT (antes: total do Clube, TPH R$ 487.703 x 549.971) */.all().catch(() => ({ results: [] })),
    B.env.DB.prepare(`SELECT filial, rca, COUNT(*) qtd FROM prospects_mapa WHERE filial IN (${qs}) GROUP BY filial, rca`).bind(...fil).all().catch(() => ({ results: [] })),
    B.env.DB.prepare(`SELECT filial, rca, vend_nome FROM arvore_supervisores WHERE filial IN (${qs})`).bind(...fil).all().catch(() => ({ results: [] }))
  ]);
  const nomeArv = new Map();
  for (const a of arvRes.results || []) if (a.vend_nome && !/^\d+$/.test(String(a.vend_nome).trim())) nomeArv.set(`${a.filial}|${a.rca}`, a.vend_nome);
  for (const ev of E.vend || []) if (ev && ev.nome && !/^\d+$/.test(String(ev.nome).trim())) nomeArv.set(`${ev.filial}|${ev.rca}`, nomeArv.get(`${ev.filial}|${ev.rca}`) || ev.nome);
  const rotaMap = new Map();
  for (const r of rotaRes.results || []) {
    rotaMap.set(`${r.filial}|${r.rca}`, Number(r.n) || 0);
  }
  const pedMap = new Map();
  for (const p of pedRes.results || []) pedMap.set(`${p.filial}|${p.rca}`, { qtd: Number(p.qtd) || 0, vlr: Number(p.vlr) || 0 });
  const prospMap = new Map();
  for (const pr of prospRes.results || []) prospMap.set(`${pr.filial}|${pr.rca}`, Number(pr.qtd) || 0);

  let rows = (vendRes.results || []).map((v) => {
    let d = {}; try { d = JSON.parse(v.dados || '{}'); } catch {}
    const meta = Number(d['Meta (R$)']) || 0, fat = Number(d['Faturado líquido (R$)']) || 0, pend = Number(d['Carteira pendente (R$)']) || 0;
    const pos = Number(d['Positivação (filial + CNPJ)']) || 0, metaPos = Number(d['Meta de positivação'] ?? d['Meta clientes']) || 0;
    const cap = d['Captação (R$)'] == null ? null : Number(d['Captação (R$)']), ideal = Number(d['Meta Ideal captação (R$)']) || 0;   // 17/11/2026: ritmo do GEROT
    const vend = fat + pend, tend = cap != null && ideal > 0 ? meta * cap / ideal : dec ? (vend / dec) * tot : vend, tendPct = meta > 0 ? (tend / meta) * 100 : 0;
    const k = `${v.filial}|${v.rca}`, ped = pedMap.get(k) || { qtd: 0, vlr: 0 };
    const nmRaw = String(v.vendedor || '').trim();
    const nmArv = nomeArv.get(k);
    const nome = (!nmRaw || /^\d+$/.test(nmRaw) || nmRaw === String(v.rca)) ? (nmArv || '') : nmRaw;
    return {
      filial: v.filial, rca: v.rca, cod_sup: v.cod_sup, sup: v.supervisor || '', nome,
      meta, vend, pct: meta > 0 ? (vend / meta) * 100 : 0, tend, tendPct,
      precisaDia: d['Necessidade dia captação (R$)'] != null ? Math.max(0, Number(d['Necessidade dia captação (R$)']) || 0) : Math.max(0, meta - vend) / falt,   // 21/11/2026: a mesma conta do GEROT em todas as visoes
      pos, metaPos, rota: rotaMap.get(k) || 0, prospects: prospMap.get(k) || 0,
      bloqQtd: ped.qtd, bloqVlr: ped.vlr
    };
  }).filter((x) => x.meta > 0 || x.vend > 0);
  if (E.rca) rows = rows.filter((x) => String(x.rca) === String(E.rca));
  else if (E.supervisor) {
    const sAlvo = sem(typeof E.supervisor === 'object' ? (E.supervisor.nome || '') : E.supervisor);
    const toks = sAlvo.split(/\s+/).filter((w) => w.length > 2);
    // 17/11/2026 (bateria real: matinal de 14 supervisores "sem dados no GEROT"): o GEROT abrevia o nome ("PRISCILA A D NASCIMENTO STRAPASSON",
    // "ALLISON ANTONIO FAGUNDES M PINHEIRO"). Casa primeiro pelo CODIGO do supervisor; sem codigo, pelo primeiro + ultimo nome.
    const cods = new Set((E.vend || []).map((v) => String(v.supCod || '')).filter(Boolean));
    const porCod = cods.size ? rows.filter((x) => cods.has(String(x.cod_sup))) : [];
    const pu = (s) => { const w = sem(s).replace(/^(CLT|PJ)\s+/, '').split(/\s+/).filter((x) => x.length > 1); return w.length ? w[0] + '|' + w[w.length - 1] : ''; };
    rows = porCod.length ? porCod : rows.filter((x) => {
      const sx = sem(x.sup);
      return sx.includes(sAlvo) || sAlvo.includes(sx) || (toks.length && toks.every((w) => sx.includes(w))) || (pu(x.sup) && pu(x.sup) === pu(sAlvo));
    });
  }
  if (rows.length > 1) {
    const dedup = new Map();
    for (const x of rows) {
      const kd = `${x.filial}|${/^\d+$/.test(String(x.rca)) ? String(Number(x.rca)) : String(x.rca)}`;
      const ant = dedup.get(kd);
      if (!ant) { dedup.set(kd, { ...x }); continue; }
      ant.meta += x.meta; ant.vend += x.vend;
      ant.pct = ant.meta > 0 ? (ant.vend / ant.meta) * 100 : 0;
      ant.pos = Math.max(ant.pos, x.pos); ant.metaPos = Math.max(ant.metaPos, x.metaPos);
      ant.precisaDia = Math.max(0, ant.meta - ant.vend) / falt;
      ant.tend = dec ? (ant.vend / dec) * tot : ant.vend;
      ant.tendPct = ant.meta > 0 ? (ant.tend / ant.meta) * 100 : 0;
      if (!ant.nome && x.nome) ant.nome = x.nome;
    }
    rows = [...dedup.values()];
  }
  if (!rows.length) return `☀️ *Matinal — ${E.nome}*: sem dados no GEROT para este escopo agora.`;
  // 17/11/2026 (auditoria ampla): sem venda no mes e sem rota hoje (ferias/afastado?) = linha propria, nao prioridade
  const parado = (x) => x.meta > 0 && !(x.vend > 0) && !(x.rota > 0);
  const prio = () => rows.filter((x) => x.meta > 0 && !/\bVAGO\b/i.test(x.nome) && !parado(x));   // 17/11/2026 (bateria real): 'Vago' e vendedor sem meta nao sao prioridade
  const linhaParados = () => { const P = rows.filter((x) => parado(x) && !/\bVAGO\b/i.test(x.nome)); return P.length ? ['', `⚪ *Sem venda no mês e sem rota hoje (${P.length}):* ${P.slice(0, 6).map((x) => rotVend(x)).join(', ')}${P.length > 6 ? ' e mais ' + (P.length - 6) : ''}`] : []; };
  rows.sort((a, b) => a.tendPct - b.tendPct || b.meta - a.meta);

  const totMeta = rows.reduce((a, x) => a + x.meta, 0), totVend = rows.reduce((a, x) => a + x.vend, 0);
  const totTend = rows.reduce((a, x) => a + x.tend, 0), tendGeral = totMeta ? (totTend / totMeta) * 100 : 0;
  const totPos = rows.reduce((a, x) => a + x.pos, 0), totMetaPos = rows.reduce((a, x) => a + x.metaPos, 0);
  const temRotaHoje = (rotaRes.results || []).length > 0;   // sem leitura do Clube de hoje: nunca 'Rota 0'
  const rotaTxt = (pre) => temRotaHoje ? `${pre} *${N(rows.reduce((a, x) => a + x.rota, 0))}* PDVs` : `${pre} aguardando a 1ª leitura do Clube`;
  const totRota = rows.reduce((a, x) => a + x.rota, 0), totProsp = rows.reduce((a, x) => a + x.prospects, 0);
  const totBloqQtd = rows.reduce((a, x) => a + x.bloqQtd, 0), totBloqVlr = rows.reduce((a, x) => a + x.bloqVlr, 0);

  if (E.rca) {
    const x = rows[0];
    const [ontPed, ontVis, Ev] = await Promise.all([
      B.env.DB.prepare("SELECT data_pedido d, COUNT(*) qtd, SUM(valor) vlr, COUNT(DISTINCT id_cliente) pos FROM pedido_status WHERE filial = ? AND rca = ? AND data_pedido < ? AND status <> 'CANCELADO' GROUP BY data_pedido ORDER BY data_pedido DESC LIMIT 1").bind(x.filial, String(x.rca), hoje).first().catch(() => null),
      B.env.DB.prepare("SELECT data_ref d, json_extract(dashboard_json,'$.produtividade.dia.visitas_planejadas') vp, json_extract(dashboard_json,'$.produtividade.dia.visitas_realizadas') vr FROM varredura_central_rca WHERE filial_sigla = ? AND CAST(rca_codigo AS TEXT) = ? AND data_ref < ? ORDER BY data_ref DESC LIMIT 1").bind(x.filial, String(x.rca), hoje).first().catch(() => null),
      carregaEscopo(B, { ...E, filiais: [x.filial], rca: String(x.rca) }).catch(() => null)
    ]);
    const rHoje = (rotaRes.results || []).find((r) => r.filial === x.filial && String(r.rca) === String(x.rca));
    let clisHoje = [];
    if (rHoje && rHoje.json) {
      try {
        const p = JSON.parse(rHoje.json);
        clisHoje = Array.isArray(p) ? p : (Array.isArray(p.clientes) ? p.clientes : []);
      } catch {}
    }
    const vEsc = Ev && Ev.vend && Ev.vend[0];
    const rMes = (vEsc && Array.isArray(vEsc.roteiroMes)) ? vEsc.roteiroMes : [];
    const lim30 = new Date(Date.parse(hoje + 'T12:00:00Z') - 30 * 864e5).toISOString().slice(0, 10);
    const m1 = mes + '-01';
    const rawBase = clisHoje.length ? clisHoje : rMes.filter((c) => !/POSITIVADO|EFETIVADO/.test(String(c.status || '')) && String(c.data_ultima_compra || '').slice(0, 10) < m1);
    const seenCli = new Map();
    for (const c of rawBase) if (!seenCli.has(String(c.id_cliente))) seenCli.set(String(c.id_cliente), c);
    const baseClis = [...seenCli.values()];
    const mais30 = baseClis.filter((c) => {
      const u = String(c.data_ultima_compra || '').slice(0, 10);
      return !u || u < lim30;
    }).length;
    const tagCont = new Map();
    let comTags = 0;
    for (const c of baseClis) {
      const fcs = [].concat(c.focos || [], c.tags || [], c.campanhas || []).map((g) => typeof g === 'string' ? g : (g.industria_foco || g.nome || g.tag || '')).filter(Boolean);
      if (fcs.length) {
        comTags++;
        for (const tg of new Set(fcs)) tagCont.set(titulo(tg), (tagCont.get(titulo(tg)) || 0) + 1);
      }
    }
    const topTags = [...tagCont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, q]) => `${k} (${q})`).join(', ');
    clisHoje.sort((a, b) => {
      const aFeito = /EFETIVADO|COMPROU|VISITADO/i.test(String(a.status || '')) ? 1 : 0;
      const bFeito = /EFETIVADO|COMPROU|VISITADO/i.test(String(b.status || '')) ? 1 : 0;
      if (aFeito !== bFeito) return aFeito - bFeito;
      const aTag = [].concat(a.focos || [], a.tags || [], a.campanhas || []).length ? 0 : 1;
      const bTag = [].concat(b.focos || [], b.tags || [], b.campanhas || []).length ? 0 : 1;
      return aTag - bTag;
    });
    const listaAcao = clisHoje.length ? clisHoje : baseClis.slice().sort((a, b) => {
      const aTag = [].concat(a.focos || [], a.tags || [], a.campanhas || []).length ? 0 : 1;
      const bTag = [].concat(b.focos || [], b.tags || [], b.campanhas || []).length ? 0 : 1;
      if (aTag !== bTag) return aTag - bTag;
      return String(a.data_ultima_compra || '').localeCompare(String(b.data_ultima_compra || ''));
    });
    const titLista = clisHoje.length ? '*Principais da rota de hoje (digite o número para abrir):*' : '*Principais pendentes da carteira (digite o número para abrir):*';
    const dFmt = (s) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
    const linhaOntem = ontPed
      ? `📝 Vendeu *${R$(ontPed.vlr || 0)}* em *${N(ontPed.qtd || 0)}* ped. (*${N(ontPed.pos || 0)}* positivados)` + (ontVis && ontVis.d === ontPed.d && ontVis.vp != null ? ` · 🚶 *${N(ontVis.vr || 0)} de ${N(ontVis.vp)}* visitas` : '')
      : (ontVis && ontVis.vp != null ? `🚶 Visitas (${dFmt(ontVis.d)}): *${N(ontVis.vr || 0)} de ${N(ontVis.vp)}*` : '_Sem pedidos registrados no último dia._');
    const dataOnt = (ontPed && ontPed.d) || (ontVis && ontVis.d) || '';
    return [
      `☀️ *Sua Matinal — ${x.rca} - ${titulo(x.nome)}* (${dec}/${tot} du · faltam ${falt})`,
      '',
      `*📅 O dia de ontem${dataOnt ? ' (' + dFmt(dataOnt) + ')' : ''}:*`,
      linhaOntem,
      '',
      `*📊 Acumulado do mês:*`,
      `💰 Fat.+Cart.: *${R$(x.vend)}* / ${R$(x.meta)} (*${P(x.vend, x.meta)}*)`,
      `📈 Tendência: *${x.tendPct.toFixed(1).replace('.', ',')}%* · 🎯 Precisa: *${R$(x.precisaDia)}/dia*`,
      `👥 Positivação: *${N(x.pos)}*${x.metaPos ? ' / ' + N(x.metaPos) + ' (' + P(x.pos, x.metaPos) + ')' : ''}`,
      '',
      `*🎯 Programado para hoje:*`,
      clisHoje.length ? `🗺️ Clientes a visitar hoje: *${N(clisHoje.length)}* PDVs` : `🗺️ Rota hoje: *0* PDVs _(sem rota carregada hoje — usando carteira pendente)_`,
      `⏳ Clientes +30 dias sem compra: *${N(mais30)}*`,
      `🏷️ Clientes com TAGs pendentes: *${N(comTags)}*${topTags ? ' (' + topTags + ')' : ''}`,
      `🆕 Prospects perto da rota: *${N(x.prospects)}* · 🚫 Bloqueados: *${N(x.bloqQtd)}* (${R$(x.bloqVlr)})`,
      ...(listaAcao.length ? ['', titLista, ...listaAcao.slice(0, 10).map((cli, i) => {
        const tgs = [].concat(cli.focos || [], cli.tags || [], cli.campanhas || []).map((g) => typeof g === 'string' ? g : (g.industria_foco || g.nome || g.tag || '')).filter(Boolean);
        const tagStr = tgs.length ? ` [${tgs.slice(0, 2).join(', ')}]` : '';
        return `${i + 1}. ${titulo(cli.nome_cliente || cli.razao_social || 'cliente')} (#${cli.id_cliente})${tagStr}`;
      }), ...(listaAcao.length > 10 ? [`_… e mais ${listaAcao.length - 10} na lista._`] : []), '', '👉 _Responda o número de um cliente para ver última compra e o que oferecer._'] : [])
    ].join('\n');
  }

  const topChart = rows.slice(0, 14);
  if (topChart.length > 1) {
    const chartCfg = {
      type: 'horizontalBar',
      data: {
        labels: topChart.map((x) => `${x.rca} ${titulo(x.nome).split(' ').slice(0, 2).join(' ')}`.slice(0, 22)),
        datasets: [{
          label: '% Tendência da Meta',
          data: topChart.map((x) => Number(x.tendPct.toFixed(1))),
          backgroundColor: topChart.map((x) => x.tendPct >= 95 ? '#22c55e' : x.tendPct >= 75 ? '#f59e0b' : '#ef4444')
        }]
      },
      options: {
        legend: { display: false },
        title: { display: true, text: `Matinal ${E.nome} (${dec}/${tot} du) - % Tendencia`, fontColor: '#e2e8f0', fontSize: 15 },
        scales: {
          xAxes: [{ ticks: { beginAtZero: true, fontColor: '#cbd5e1' }, gridLines: { color: '#24324d' } }],
          yAxes: [{ ticks: { fontColor: '#e2e8f0', fontSize: 12 }, gridLines: { display: false } }]
        },
        plugins: { datalabels: { display: true, anchor: 'end', align: 'right', color: '#e2e8f0', formatter: (v) => v + '%' } }
      }
    };
    // 17/11/2026 (Vitorio: 'essa merda de imagem'): o grafico de barras NAO e a matinal; o formato e o card do dia + o card de industrias. Sem card do dia, so o texto.
    void chartCfg;
  }

  const posGerot = stGerot && stGerot.posicao ? ` · GEROT ${stGerot.posicao}` : '';
  // Tenta usar o card PNG mobile-first pre-gerado em Playwright no D1 (matinal_cards)
  let cardPng = null;
  let indCardPng = null;
  if (!E.rca) {
    try {
      const { results: cards } = await B.env.DB.prepare(
        // 17/11/2026 (Vitorio 05:49: texto de 17/11 com a IMAGEM de 15/11): so a imagem gerada HOJE; sem imagem do dia, vai so o texto (que esta certo)
        'SELECT chave, filial, cod_sup, supervisor, png_b64 FROM matinal_cards WHERE data = ?'
      ).bind(hoje).all();
      if (cards && cards.length) {
        if (E.supervisor) {
          const codAlvo = typeof E.supervisor === 'object' ? String(E.supervisor.cod_sup || '').trim() : '';
          const sAlvo = sem(typeof E.supervisor === 'object' ? (E.supervisor.nome || '') : E.supervisor);
          const toks = sAlvo.split(/\s+/).filter((w) => w.length > 2);
          const matchSup = (prefix) => cards.find((c) => fil.includes(c.filial) && c.chave.startsWith(prefix) && (() => {
            if (codAlvo && String(c.cod_sup || '').trim() === codAlvo) return true;
            const sx = sem(c.supervisor || '');
            return sx && (sx.includes(sAlvo) || sAlvo.includes(sx) || (toks.length && toks.every((w) => sx.includes(w))));
          })());
          const hit = matchSup('sup:');
          if (hit) cardPng = hit.png_b64;
          const hitInd = matchSup('ind:sup:');
          if (hitInd) indCardPng = hitInd.png_b64;
        } else if (!E.nacional && fil.length === 1) {
          const hit = cards.find((c) => c.chave === `fil:${fil[0]}`);
          if (hit) cardPng = hit.png_b64;
          const hitInd = cards.find((c) => c.chave === `ind:fil:${fil[0]}`);
          if (hitInd) indCardPng = hitInd.png_b64;
        } else if (E.nacional) {
          const hit = cards.find((c) => c.chave === 'brasil');
          if (hit) cardPng = hit.png_b64;
          const hitInd = cards.find((c) => c.chave === 'ind:brasil');
          if (hitInd) indCardPng = hitInd.png_b64;
        }
      }
    } catch {}
  }
  const rcaList = [...new Set(rows.map((r) => String(r.rca)))].slice(0, 150);
  let ontEq = null;
  if (rcaList.length) {
    const rQs = rcaList.map(() => '?').join(',');
    // 16/11/2026 ('Ontem (15/11)' = domingo em 25 respostas; pedido_status parado em 14/11): ultimo dia UTIL (seg-sab) com venda, pelo Clube
    ontEq = await B.env.DB.prepare(`SELECT dia d, SUM(ped_total) qtd, SUM(total_pedido) vlr FROM clube_venda_dia WHERE filial IN (${qs}) AND rca IN (${rQs}) AND dia < ? AND strftime('%w', dia) <> '0' GROUP BY dia HAVING SUM(total_pedido) > 0 ORDER BY dia DESC LIMIT 1`).bind(...fil, ...rcaList, hoje).first().catch(() => null);
  }
  const dFmtEq = (s) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
  const DSEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const linhaOntEq = ontEq ? `📅 *Último dia útil (${DSEM[new Date(ontEq.d + 'T12:00:00Z').getUTCDay()]} ${dFmtEq(ontEq.d)}):* *${R$(ontEq.vlr || 0)}* em *${N(ontEq.qtd || 0)}* pedidos` : '';
  const rotVend = (x) => x.nome ? `${x.rca} - ${titulo(x.nome)}` : `RCA ${x.rca}`;
  if (cardPng) {
    B._midia = { tipo: 'image', url: cardPng };
    if (indCardPng) B._midiaExtra = { tipo: 'image', url: indCardPng, caption: `🏭 *Resumo de Indústrias — ${E.nome}*` };
    return [
      `☀️ *Matinal — ${E.nome}* (${dec}/${tot} du · faltam ${falt}${posGerot})`,
      ...(linhaOntEq ? [linhaOntEq] : []),
      (totMeta ? `💰 Fat.+Cart.: *${R$(totVend)}* / ${R$(totMeta)} (*${P(totVend, totMeta)}*) · 📈 Ritmo: *${tendGeral.toFixed(1).replace('.', ',')}%*` : `💰 Fat.+Cart.: *${R$(totVend)}* · _meta do mês não cadastrada no GEROT para esta equipe_`),
      `👥 Positivação: *${N(totPos)}*${totMetaPos ? ' / ' + N(totMetaPos) + ' (' + P(totPos, totMetaPos) + ')' : ''} · ${rotaTxt('🗺️ Rota:')} · 🚫 Bloqueados: *${N(totBloqQtd)}* pedido(s)`,
      '',
      `🎯 *Prioridades de hoje:*`,
      ...prio().slice(0, 4).map((x, i) => `${i + 1}. *${rotVend(x)}*: ritmo *${x.tendPct.toFixed(0)}%* · precisa ${R$(x.precisaDia)}/d${x.rota ? " · rota " + x.rota : " · sem rota hoje"}${x.bloqQtd ? ' · 🚫' + x.bloqQtd : ''}`),
      ...linhaParados(),
      ...(posGerot ? ['', `_Fonte: ${posGerot.replace(/^\s*·\s*/, '')}._`] : ['', '_Fonte: GEROT / Clube da Venda._'])
    ].join('\n');
  }

  return [
    `☀️ *Matinal — ${E.nome}* (${dec}/${tot} du · faltam ${falt}${posGerot})`,
    ...(linhaOntEq ? [linhaOntEq] : []),
    (totMeta ? `💰 Fat.+Cart.: *${R$(totVend)}* / ${R$(totMeta)} (*${P(totVend, totMeta)}*)` : `💰 Fat.+Cart.: *${R$(totVend)}* · _meta do mês não cadastrada no GEROT para esta equipe_`),
    ...(totMeta ? [`📈 Ritmo (GEROT): *${tendGeral.toFixed(1).replace('.', ',')}%* do ideal`] : []),
    `👥 Positivação: *${N(totPos)}*${totMetaPos ? ' / ' + N(totMetaPos) + ' (' + P(totPos, totMetaPos) + ')' : ''}`,
    `${rotaTxt('🗺️ Rota hoje:')} · *${N(totProsp)}* prospects · 🚫 Bloqueados: *${N(totBloqQtd)}* pedido(s)`,
    '',
    `🎯 *Prioridade (pior tendência primeiro):*`,
    ...prio().slice(0, 10).map((x, i) => `${i + 1}. *${rotVend(x)}*: ritmo *${x.tendPct.toFixed(0)}%* (${P(x.vend, x.meta)}) · ${R$(x.precisaDia)}/d${x.rota ? " · rota " + x.rota : " · sem rota hoje"}${x.bloqQtd ? ' · 🚫' + x.bloqQtd : ''}`),
    ...(rows.length > 10 ? [`_… e mais ${rows.length - 10} vendedor(es) na equipe._`] : []),
    ...linhaParados(),
    ...(posGerot ? ['', `_Fonte: ${posGerot.replace(/^\s*·\s*/, '')}._`] : ['', '_Fonte: GEROT / Clube da Venda._']),
  ].join('\n');
}
