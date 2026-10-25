// =========================================================================
// FICHA DO ARQUIVO: functions/api/whatsapp/bot.js   (POST /api/whatsapp/bot?k=<BOT_WEBHOOK_KEY>)
// O QUE É: o JOTA, assistente do +MIX no WhatsApp (Vitorio, 22/10/2026: "o pessoal interagir com o +MIX: o gerente de TPH manda msg e interage com os dados da filial dele;
//          conversa natural e fluida, e alem do que perguntam nos tambem sugerimos coisas").
// FLUXO:   Evolution (numero Mais Mix Triunfante) -> webhook MESSAGES_UPSERT -> aqui.
//          1) confere a chave do webhook; ignora grupo, status e mensagem enviada pelo proprio numero
//          2) identifica QUEM mandou pelo celular (tabela bot_contatos no D1: nome, papel, filial, grupo). Numero desconhecido: nao responde nada.
//          3) entende a pergunta (respostas MONTADAS PELO CODIGO com os numeros da base = sem erro de conta); so a pergunta livre vai para a IA gratuita (Workers AI).
// ESCOPO (Vitorio, 22/10/2026: "eu sou nacional! se eu nao pergunto de uma filial especifica, vc precisa me dar todas"):
//          gerente = sempre a filial dele (e so o grupo dele em TPH/MCD); diretoria = a filial citada NA MENSAGEM, senao o BRASIL inteiro (11 filiais).
// ROTA = VAREJO (Vitorio, 22/10/2026): "vendedores de rota", visitas, eficacia e zerados contam so o varejo de campo (VJ, PET VJ, FARMA, ESP).
//          Totais de dinheiro (faturado, pendente, digitado, pedidos) somam todos.
// FONTES (mesma base da TV, nunca o CEVEN direto): /api/saude, /api/central-snapshot, /api/tv-mostra (Gestao de Equipe), /api/brasileirao-lances,
//          /api/tv-supervisores, dados_brasileirao.json (Liga), dados_mix.json (+MIX). Conhecimento: MAIS_MIX/JOTA/CONHECIMENTO.md.
// SEGREDOS (Cloudflare Pages, nunca no codigo): EVO_URL, EVO_KEY, EVO_INSTANCE, BOT_WEBHOOK_KEY.
// REGRA: nunca inventar nem estimar. Sem dado = "sem dado". Pertence ao Projeto B (WhatsApp), autorizado pelo Vitorio em 22/10/2026.
// =========================================================================
const so = (x) => String(x || '').replace(/\D/g, '');
const R$ = (n) => n == null || isNaN(n) ? 'sem dado' : 'R$ ' + Math.round(n).toLocaleString('pt-BR');
const P = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : 'sem dado');
const N = (n) => n == null || isNaN(n) ? 'sem dado' : Math.round(n).toLocaleString('pt-BR');
const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const nome2 = (n) => { const p = String(n || '').replace(/^CLT\s*-?\s*/i, '').split(' ').filter((w) => w && !/^(DE|DA|DO|DOS|DAS|E|A)$/i.test(w)); return titulo(p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0] || ''); };
const FILIAIS = ['TPH', 'ABC', 'API', 'TBL', 'TCV', 'TSJ', 'TCA', 'TBE', 'TPA', 'MCD', 'TCG'];
const FRX = /\b(ABC|API|MCD|TBE|TBL|TCA|TCG|TCV|TPA|TPH|TSJ)\b/;
const VAREJO = new Set(['VJ', 'PET VJ', 'FARMA', 'ESP']);
const SUGESTAO = '🎯 *Sugestão do Jota:* ';

// celular brasileiro com e sem o 9: 5541987525605 <-> 554187525605
function variantes(n) {
  const d = so(n); const out = new Set([d]);
  if (d.length === 13 && d.startsWith('55') && d[4] === '9') out.add(d.slice(0, 4) + d.slice(5));
  if (d.length === 12 && d.startsWith('55')) out.add(d.slice(0, 4) + '9' + d.slice(4));
  return [...out];
}
async function tabelas(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_contatos (celular TEXT PRIMARY KEY, nome TEXT, papel TEXT, filial TEXT, grupo TEXT, supervisor TEXT, ativo INTEGER DEFAULT 1, criado_em TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  for (const c of ['situacao TEXT', 'rca TEXT', 'atualizado_em TEXT']) { try { await db.prepare(`ALTER TABLE bot_contatos ADD COLUMN ${c}`).run(); } catch (e) { /* ja existe */ } }
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
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
// dias uteis (seg-sex) que faltam no mes, contando hoje; feriados nao sao descontados (dito na resposta)
function diasUteisRestantes() {
  const [y, m, d] = hojeSP().split('-').map(Number); let n = 0;
  const fim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let i = d; i <= fim; i++) { const w = new Date(Date.UTC(y, m - 1, i)).getUTCDay(); if (w > 0 && w < 6) n++; }
  return n;
}

// ---------------- BASE (carregada sob demanda, cada fonte uma vez so) ----------------
const REPO = 'vitoriotriunfante/cevenonline';
const gh = (p) => fetch(`https://raw.githubusercontent.com/${REPO}/main/${p.split('/').map(encodeURIComponent).join('/')}`, { cf: { cacheTtl: 300, cacheEverything: true }, signal: AbortSignal.timeout(20000) }).then((r) => { if (!r.ok) throw new Error('gh ' + r.status); return r.text(); });
function criaBase(origin, env) {
  const cache = {};
  const api = (p) => fetch(origin + p, { signal: AbortSignal.timeout(25000) }).then((r) => r.json()).catch(() => null);
  const est = (p) => (env && env.ASSETS ? env.ASSETS.fetch(new Request(origin + p)) : fetch(origin + p)).then((r) => r.json()).catch(() => null);
  const memo = (k, f) => cache[k] || (cache[k] = f());
  return {
    saude: () => memo('saude', () => api('/api/saude')),
    mostra: () => memo('mostra', () => api('/api/tv-mostra')),
    snap: (f) => memo('snap' + f, () => api('/api/central-snapshot?filial=' + f + '&dia=' + hojeSP())),
    lances: () => memo('lances', () => api('/api/brasileirao-lances?dia=' + hojeSP())),
    sups: (f) => memo('sup' + f, () => api('/api/tv-supervisores?filial=' + f)),
    // Liga e +MIX: datasets gerados no GitHub (a copia do site pode estar velha); mesma ordem que as telas usam (26/10/2026)
    liga: () => memo('liga', () => gh('public/dados_brasileirao.json').then((t) => JSON.parse(t)).catch(() => est('/dados_brasileirao.json'))),
    mix: () => memo('mix', () => gh('public/dados_mix.json').then((t) => JSON.parse(t)).catch(() => est('/dados_mix.json'))),
    pedidosDia: () => memo('ped', () => api('/api/pedidos-dia?dia=' + hojeSP())),
    raw: (p) => memo('raw' + p, () => gh(p).catch(() => null)),
    // lista de arquivos da pasta: a API do GitHub limita 60 consultas/hora por IP (dividido com outros clientes da Cloudflare) -> guarda 30 min no D1
    pasta: (p) => memo('dir' + p, async () => {
      const db = env && env.DB, k = 'gh_dir:' + p;
      try { if (db) { await db.prepare('CREATE TABLE IF NOT EXISTS cache_resposta (chave TEXT PRIMARY KEY, corpo TEXT, tipo TEXT, em INTEGER)').run(); const r = await db.prepare('SELECT corpo, em FROM cache_resposta WHERE chave = ?').bind(k).first(); if (r && Date.now() - r.em < 30 * 60 * 1000) return JSON.parse(r.corpo); } } catch (e) {}
      const j = await fetch(`https://api.github.com/repos/${REPO}/contents/${p.split('/').map(encodeURIComponent).join('/')}?ref=main`, { headers: { 'User-Agent': 'jota-ceven', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const nomes = Array.isArray(j) ? j.map((a) => ({ name: a.name })) : null;
      if (nomes && db) { try { await db.prepare('INSERT INTO cache_resposta (chave, corpo, tipo, em) VALUES (?,?,?,?) ON CONFLICT (chave) DO UPDATE SET corpo = excluded.corpo, em = excluded.em').bind(k, JSON.stringify(nomes), 'json', Date.now()).run(); } catch (e) {} }
      if (nomes) return nomes;
      try { if (db) { const r = await db.prepare('SELECT corpo FROM cache_resposta WHERE chave = ?').bind(k).first(); if (r) return JSON.parse(r.corpo); } } catch (e) {}   /* GitHub recusou: usa a lista velha */
      return null;
    }),
    exec: () => memo('exec', () => api('/api/mapa-executivo-live')),
    incentivo: () => memo('inc', () => api('/api/incentivo-outubro')),
    ligaAs: () => memo('ligaas', () => api('/api/liga-as')),
    semana: (f) => memo('sem' + f, () => api('/api/tv-supervisores-semana?filial=' + f)),
    devMot: () => memo('devmot', () => api('/api/devolucoes-motivos')),
    bola: (f) => memo('bola' + f, () => api('/api/bola-cheia?filial=' + f)),
    diverg: () => memo('div', () => api('/api/divergencias')),
  };
}

// vendedores de uma filial (mostrados na Gestao de Equipe) + totais que somam TODOS (macro)
async function vendedoresDaFilial(B, filial, grupo, supervisor) {
  const [snap, mostra] = await Promise.all([B.snap(filial), B.mostra()]);
  const eq = new Map(); if (mostra && mostra.filiais) for (const [k, L] of Object.entries(mostra.filiais)) if (k.split('_')[0] === filial) for (const v of L) eq.set(String(v.rca), v);
  const vend = []; const macro = { pedidos: 0, dig: 0, devHoje: 0 };
  for (const [rca, r] of Object.entries((snap && snap.rcas) || {})) {
    const e = eq.get(rca);
    if (grupo && (!e || String(e.grupo || '').toUpperCase() !== String(grupo).toUpperCase())) continue;
    if (supervisor && (!e || sem(e.supervisor) !== sem(supervisor))) continue;   /* supervisor ve so a equipe dele (25/10/2026) */
    const d = r.dashboard || {}, fi = d.financeiro || {}, po = d.positivacao || {}, pd = (r.produtividade && r.produtividade.dia) || {}, pm = (r.produtividade && r.produtividade.mes) || {};
    macro.pedidos += pd.positivacao || 0; macro.dig += pd.dig_pedido || 0;
    macro.devHoje += (Array.isArray(r.devolucoes) ? r.devolucoes : []).filter((x) => String(x && x.data || '').slice(0, 10) === hojeSP()).reduce((t, x) => t + Math.abs(parseFloat(x.vl_devolvido || x.valor || 0) || 0), 0);
    if (!e || e.mostra === false) continue;   // listas: so quem a Gestao de Equipe mostra
    const varejo = VAREJO.has(String(e.canal || '').toUpperCase());
    const visP = varejo ? pd.total_programado || 0 : 0, visF = varejo ? pd.visitas_na_rota || 0 : 0;
    vend.push({ filial, rca, nome: e.nome || d.nome || 'RCA ' + rca, supervisor: e.supervisor || '', grupo: e.grupo || '', canal: e.canal || '', varejo,
      fat: fi.faturado || 0, pend: fi.pendente || 0, meta: fi.meta || 0, dev: fi.devolucao || 0, pct: fi.meta ? (fi.faturado || 0) / fi.meta * 100 : null,
      pos: po.realizado ?? null, metaPos: po.meta ?? null, dig: pd.dig_pedido || 0, ped: pd.positivacao || 0, visP, visF, comVenda: varejo ? pd.visitas_com_venda || 0 : 0,
      visPlanMes: varejo ? pm.visit_plan || 0 : 0, visRealMes: varejo ? pm.visit_real || 0 : 0,
      zerado: varejo && visP > 0 && !(pd.dig_pedido > 0), semVisita: varejo && visP > 0 && !visF, devolucoes: Array.isArray(r.devolucoes) ? r.devolucoes : [],
      /* devolucoes que ENTRARAM hoje (mesma regra do WhatsApp 17:00/18:30: d.data === hoje) */
      devHoje: (Array.isArray(r.devolucoes) ? r.devolucoes : []).filter((x) => String(x && x.data || '').slice(0, 10) === hojeSP()).reduce((t, x) => t + Math.abs(parseFloat(x.vl_devolvido || x.valor || 0) || 0), 0),
      vendeuHoje: (pd.dig_pedido || 0) > 0 || (pd.positivacao || 0) > 0 || (pd.visitas_com_venda || 0) > 0,
      rotaHoje: varejo && Array.isArray(r.roteiro) ? r.roteiro.filter((c) => String(c.data_visita || '').slice(0, 10) === hojeSP() || /FORA/i.test(String(c.status || ''))) : [],
      /* clientes da rota de HOJE ainda sem visita (status ABERTO/AGENDADO, sem check-in) */
      aVisitar: varejo && Array.isArray(r.roteiro) ? r.roteiro.filter((c) => String(c.data_visita || '').slice(0, 10) === hojeSP() && /^(ABERTO|AGENDADO)$/i.test(String(c.status || '')) && !c.checkin_horario) : [] });
  }
  vend.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  return { vend, macro };
}

// ESCOPO: { nome, filiais:[...], grupo, nacional }
async function carregaEscopo(B, esc) {
  const partes = await Promise.all(esc.filiais.map((f) => vendedoresDaFilial(B, f, esc.grupo, esc.supervisor)));
  const vend = partes.flatMap((p) => p.vend);
  const macro = partes.reduce((t, p) => ({ pedidos: t.pedidos + p.macro.pedidos, dig: t.dig + p.macro.dig, devHoje: t.devHoje + p.macro.devHoje }), { pedidos: 0, dig: 0, devHoje: 0 });
  return { ...esc, vend, macro, porFilial: Object.fromEntries(esc.filiais.map((f, i) => [f, partes[i]])) };
}
// chave de supervisor: "NOME|FIL" no Brasil; pseudo-supervisores (sem supervisor, GERENTE X, VAGO) nao entram em ranking nem sugestao
const supChave = (v, nac) => (v.supervisor || 'sem supervisor') + (nac ? '|' + v.filial : '');
const supNome = (k) => { const [s, f] = String(k).split('|'); return (/^sem supervisor$/i.test(s) ? 'Ligados ao gerente' : /^GERENTE/i.test(s) ? 'Ligados ao gerente' : nome2(s)) + (f ? ' ' + f : ''); };
const supReal = (k) => !/^(sem supervisor|GERENTE|VAGO)/i.test(String(k));
const pessoaReal = (v) => !/^(VAGO|RCA\b|VENDA |GERENTE)/i.test(String(v.nome || ''));
function agrupa(V, chave) {
  const m = new Map();
  for (const v of V) { const k = chave(v); const x = m.get(k) || { V: [], fat: 0, pend: 0, meta: 0, dig: 0, ped: 0, dev: 0, pos: 0, metaPos: 0, visP: 0, visF: 0, comVenda: 0, zerados: 0, semVisita: 0, varejo: 0 };
    x.V.push(v); x.fat += v.fat; x.pend += v.pend; x.meta += v.meta; x.dig += v.dig; x.ped += v.ped; x.dev += v.dev; x.pos += v.pos || 0; x.metaPos += v.metaPos || 0;
    x.visP += v.visP; x.visF += v.visF; x.comVenda += v.comVenda; if (v.zerado) x.zerados++; if (v.semVisita) x.semVisita++; if (v.varejo) x.varejo++; m.set(k, x); }
  for (const x of m.values()) x.pct = x.meta ? x.fat / x.meta * 100 : null;
  return m;
}
const pctTxt = (x) => x == null ? 'sem dado' : x.toFixed(1).replace('.', ',') + '%';
const listaNomes = (V, n = 4) => V.slice(0, n).map((v) => nome2(v.nome)).join(', ') + (V.length > n ? ` +${V.length - n}` : '');

// ---------------- RESPOSTAS ----------------
async function respResumo(B, E) {
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
  const fat = (E.grupo || E.supervisor) ? G.fat : f ? f.faturado : null, pend = (E.grupo || E.supervisor) ? G.pend : f ? f.pendente : null, meta = (E.grupo || E.supervisor) ? G.meta : f ? f.meta_fat : null;
  const Vr = V.filter((v) => v.varejo), z = Vr.filter((v) => v.zerado), com = V.filter((v) => v.pct != null);
  const L = [`📊 *${E.nome} agora* (${hora})`, `💰 Faturado: *${R$(fat)}* de ${R$(meta)} → *${P(fat || 0, meta)}*`, `⏳ Pendente: ${R$(pend)}`];
  if (!(E.grupo || E.supervisor) && f) L.push(`👥 Positivação: ${N(f.positivados)} de ${N(f.meta_pos)} (${P(f.positivados, f.meta_pos)})`); else L.push(`👥 Positivação: ${N(G.pos)} de ${N(G.metaPos)} (${P(G.pos, G.metaPos)})`);
  L.push(`📝 Digitado hoje: *${R$((E.grupo || E.supervisor) ? G.dig : f ? f.digitado_hoje : E.macro.dig)}* em *${N((E.grupo || E.supervisor) ? G.ped : E.macro.pedidos)}* pedidos`,
    `🚶 Rota do varejo hoje: ${Vr.reduce((a, v) => a + v.visF, 0)} de ${Vr.reduce((a, v) => a + v.visP, 0)} visitas · sem nenhuma visita: ${Vr.filter((v) => v.semVisita).length}`,
    `🏁 Meta batida no mês (fat.+pend.): ${V.filter((v) => v.meta && v.fat + v.pend >= v.meta).length} de ${V.length} vendedores`, `↩️ Devoluções no mês: ${R$(V.reduce((a, v) => a + v.dev, 0))}`);
  const lc = await B.lances(); if (lc) { const Lf = (lc.lances || []).filter((l) => l.filial === fil && (!(E.grupo || E.supervisor) || V.some((v) => v.rca === String(l.rca)))); L.push(`⚽ Hoje: ${Lf.filter((l) => l.nivel === 'gol').length} gol(s) · ${Lf.filter((l) => l.nivel === 'penalti').length} pênalti(s) · ${Lf.filter((l) => l.nivel === 'impedimento').length} impedimento(s)`); }
  if (!(E.grupo || E.supervisor)) { const Gr = [...agrupa(V.filter((v) => v.grupo), (v) => v.grupo)]; if (Gr.length > 1) { L.push('*Por gerente:*'); for (const [g, x] of Gr) L.push(`• ${titulo(g)}: ${R$(x.fat)} (${pctTxt(x.pct)}) · pend. ${R$(x.pend)} · ${x.zerados} zerado(s)`); } }
  const lg = await B.liga(); const lf = lg && (lg.filiais || []).find((x) => x.sigla === fil); if (lf) L.push(`🏆 Liga: ${lf.pos}º de 11, ${lf.pts_tabela} pontos (${lf.vitorias}V ${lf.empates}E ${lf.derrotas}D)`);
  L.push(`⚠️ Zerados hoje (varejo com rota): *${z.length}*` + (z.length ? ' — ' + listaNomes(z) : ''));
  if (com.length) L.push(`✅ Melhores na meta: ${com.slice(0, 2).map((v) => `${nome2(v.nome)} ${pctTxt(v.pct)}`).join(' · ')}`, `🔻 Mais atrás: ${com.slice(-2).reverse().map((v) => `${nome2(v.nome)} ${pctTxt(v.pct)}`).join(' · ')}`);
  const sz = [...agrupa(Vr, (v) => v.supervisor || 'sem supervisor')].filter(([k]) => supReal(k)).sort((a, b) => b[1].zerados - a[1].zerados)[0];
  L.push('', SUGESTAO + (sz && sz[1].zerados ? `falar com ${supNome(sz[0])} — ${sz[1].zerados} vendedor(es) dele sem pedido hoje.` : 'puxar os mais atrás na meta para fechar o mês.'), '_Peça "hoje", "por supervisor", "zerados", "falta", "liga", "ajuda"._');
  return L.join('\n');
}

// acumulado do dia (rota = varejo)
async function respHoje(B, E, t) {
  const soVarejo = /ROTA|VAREJO|CAMPO|\bVJ\b/.test(t);
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
  if (!soVarejo && !E.grupo && !E.supervisor) { tot.dig = E.macro.dig; tot.ped = E.macro.pedidos; }
  if (/TICKET/.test(t)) return `🧾 *Ticket médio de hoje — ${E.nome}${rot}*: *${tot.ped ? R$(tot.dig / tot.ped) : 'sem dado'}* (${R$(tot.dig)} ÷ ${tot.ped} pedidos)`;
  const Vs = V.slice().sort((a, b) => b.dig - a.dig);
  const L = [`📝 *${E.nome} hoje${rot}* (${hora})`, `Digitado: *${R$(tot.dig)}* em *${tot.ped}* pedidos · ticket ${tot.ped ? R$(tot.dig / tot.ped) : 'sem dado'}`, `Visitas da rota: ${tot.visF} de ${tot.visP} · com venda: ${tot.comVenda} · zerados: ${tot.zerados}`, ''];
  for (const v of Vs.slice(0, 40)) L.push(`• ${v.zerado ? '⚠️' : v.dig > 0 ? '✅' : '▫️'} ${nome2(v.nome)}: ${R$(v.dig)} · ${v.ped} ped.` + (v.varejo ? ` · visitas ${v.visF}/${v.visP}` : ` · ${v.canal || 'sem canal'}`));
  if (Vs.length > 40) L.push(`… e mais ${Vs.length - 40}`);
  const z = V.filter((v) => v.zerado);
  L.push('', SUGESTAO + (z.length ? `cobrar quem tem rota e está sem pedido: ${listaNomes(z, 3)}.` : 'todo o varejo com rota já tem pedido; focar em mix por cliente.'));
  return L.join('\n');
}

function respPorSupervisor(E) {
  const S = [...agrupa(E.vend, (v) => supChave(v, E.nacional))].filter(([k]) => supReal(k)).sort((a, b) => (b[1].pct ?? -1) - (a[1].pct ?? -1));
  if (!S.length) return `Sem dados por supervisor de ${E.nome} agora.`;
  const L = [`👥 *${E.nome} por supervisor* (% da meta faturada)`, ...S.map(([s, x]) => `• *${supNome(s)}* ${pctTxt(x.pct)} · ${R$(x.fat)} · pend. ${R$(x.pend)} · hoje ${R$(x.dig)} · ${x.zerados} zerado(s)`)];
  const pior = S[S.length - 1]; L.push('', SUGESTAO + `conversar com ${supNome(pior[0])} (${pctTxt(pior[1].pct)}), o mais atrás.`, '_Peça "supervisor Nome" para ver os vendedores dele._');
  return L.join('\n');
}
function respSupervisor(E, s) {
  const V = E.vend.filter((v) => v.supervisor === s.nome && v.filial === s.filial);
  const x = agrupa(V, () => 'x').get('x');
  return [`👤 *${titulo(s.nome)}* (${s.filial}) — ${pctTxt(x.pct)} da meta · fat. ${R$(x.fat)} · pend. ${R$(x.pend)}`, `Positivação: ${x.pos} de ${x.metaPos} (${P(x.pos, x.metaPos)}) · hoje ${R$(x.dig)} em ${x.ped} ped. · visitas ${x.visF}/${x.visP}`, '',
    ...V.map((v) => `• ${v.zerado ? '⚠️' : '✅'} *${nome2(v.nome)}* ${pctTxt(v.pct)} · fat. ${R$(v.fat)} · pend. ${R$(v.pend)} · hoje ${R$(v.dig)} (${v.ped} ped.)` + (v.varejo ? ` · visitas ${v.visF}/${v.visP}` : '')),
    '', V.some((v) => v.zerado) ? SUGESTAO + `ligar agora para ${listaNomes(V.filter((v) => v.zerado), 3)} (rota sem pedido hoje).` : SUGESTAO + 'equipe com pedido hoje; foco em mix nos próximos clientes.'].join('\n');
}
async function respVendedor(B, E, v) {
  const dn = diasUteisRestantes(); const falta = Math.max(0, v.meta - v.fat), faltaPos = v.metaPos != null && v.pos != null ? Math.max(0, v.metaPos - v.pos) : null;
  const L = [`🧑‍💼 *${titulo(v.nome)}* — ${v.filial} · sup. ${nome2(v.supervisor)} · ${v.canal || 'sem canal'}`,
    `💰 Faturado: *${R$(v.fat)}* de ${R$(v.meta)} → *${pctTxt(v.pct)}* · pendente ${R$(v.pend)}`, `🎯 Falta: ${R$(falta)}` + (falta && dn ? ` · ${R$(falta / dn)} por dia útil (${dn} dias)` : ''),
    `👥 Positivação: ${v.pos ?? 'sem dado'} de ${v.metaPos ?? 'sem dado'} (${P(v.pos, v.metaPos)})` + (faltaPos ? ` · faltam ${faltaPos} clientes` : ''),
    `📝 Hoje: ${R$(v.dig)} em ${v.ped} pedido(s)` + (v.varejo ? ` · visitas ${v.visF} de ${v.visP} · com venda ${v.comVenda}` : ''), `↩️ Devolução no mês: ${R$(v.dev)}`];
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
async function totaisOficiais(B, E) {
  const x = { ...(agrupa(E.vend, () => 'x').get('x') || { fat: 0, pend: 0, meta: 0, pos: 0, metaPos: 0 }) };
  if (E.grupo || E.supervisor) return x;   /* grupo (TPH/MCD) ou equipe do supervisor: soma dos vendedores */
  const s = await B.saude(); const F = ((s && s.filiais) || []).filter((f) => E.filiais.includes(f.filial)); if (!F.length) return x;
  x.fat = F.reduce((a, f) => a + (f.faturado || 0), 0); x.pend = F.reduce((a, f) => a + (f.pendente || 0), 0); x.meta = F.reduce((a, f) => a + (f.meta_fat || 0), 0);
  x.pos = F.reduce((a, f) => a + (f.positivados || 0), 0); x.metaPos = F.reduce((a, f) => a + (f.meta_pos || 0), 0); x.pct = x.meta ? x.fat / x.meta * 100 : null; return x;
}
async function respFalta(B, E) {
  const dn = diasUteisRestantes(); const x = await totaisOficiais(B, E);
  if (!x.meta) return 'Sem dado agora.';
  const falta = Math.max(0, x.meta - x.fat), fpos = Math.max(0, x.metaPos - x.pos);
  const L = [`🎯 *${E.nome} — quanto falta* (${dn} dias úteis seg–sex, sem descontar feriados)`, `💰 Meta ${R$(x.meta)} · faturado ${R$(x.fat)} (${pctTxt(x.pct)}) · pendente ${R$(x.pend)}`,
    `Falta faturar: *${R$(falta)}* → *${R$(dn ? falta / dn : falta)} por dia útil* (MN)`, `Pendente cobre ${P(Math.min(x.pend, falta), falta || 1)} do que falta`,
    `👥 Positivação: falta *${N(fpos)}* clientes → *${N(dn ? Math.ceil(fpos / dn) : fpos)} por dia útil*`, ''];
  const G = [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([k]) => supReal(k)).map(([k, y]) => [k, Math.max(0, y.meta - y.fat), y]).sort((a, b) => b[1] - a[1]);
  L.push(`*Quem mais falta (${E.nacional ? 'filial' : 'supervisor'}):*`, ...G.slice(0, 8).map(([k, f, y]) => `• ${E.nacional ? k : nome2(k)}: ${R$(f)} (${pctTxt(y.pct)})`));
  L.push('', SUGESTAO + (G[0] ? `o maior buraco é ${E.nacional ? G[0][0] : nome2(G[0][0])}: ${R$(G[0][1])}.` : 'manter o ritmo.'));
  return L.join('\n');
}
// ---------- indicadores das outras telas (TV Executiva, /incentivo, Liga AS, Supervisores, Devolucoes, Bola Cheia, Divergencias) ----------
async function respRecorrencia(B, E) {
  const x = await B.exec(); if (!x || !x.recorrencia) return 'Não consegui ler a recorrência agora.';
  const k = E.nacional ? 'TODAS' : E.filiais[0]; const r = x.recorrencia[k] || {}, s = (x.resumo || {})[k] || {};
  if (r.naRota == null) return `⭐ *Recorrência e resgates — ${E.nacional ? 'Brasil' : k}*: sem dado hoje. Esse número vinha da TV Executiva, desligada em 25/10/2026 (custo da Cloudflare).`;
  const L = [`⭐ *Recorrência e resgates — ${E.nacional ? 'Brasil' : k}* (hoje)`, `Clientes com tag RECORRÊNCIA na rota: *${N(r.naRota)}* · positivados: *${N(r.positivados)}* (${P(r.positivados || 0, r.naRota)})`, `Resgatados hoje (parados >30 dias que compraram): *${N(s.resgatadosHoje)}*`];
  if (E.nacional) for (const f of FILIAIS) { const a = x.recorrencia[f] || {}; L.push(`• ${f}: ${N(a.positivados)}/${N(a.naRota)} recorrência · ${N((x.resumo[f] || {}).resgatadosHoje)} resgate(s)`); }
  if (E.grupo) L.push('_Visão da filial inteira (a TV Executiva não separa por gerente)._');
  L.push('', r.naRota ? SUGESTAO + `cada cliente da recorrência positivado é DEFESA (+3) na Liga: cobrar os ${N(Math.max(0, r.naRota - (r.positivados || 0)))} que faltam.` : '_Sem rota com recorrência hoje._');
  return L.join('\n');
}
async function respIncentivoOficial(B, E, pessoa) {
  const x = await B.incentivo(); if (!x || !x.nacional) return respIncentivo(E);
  const ok = (b) => b ? '✅' : '❌';
  if (pessoa && pessoa.tipo === 'vend') { const v = (x.vendedores || []).find((y) => y.rca === pessoa.alvo.rca && y.filial === pessoa.alvo.filial); if (v) return `🏆 *Incentivo — ${titulo(v.nome)}* (${v.filial})\nPositivação: *${v.real} de ${v.meta}* (${pctTxt(v.pct)})\nGatilho 1 (60% até 15/10, R$ 150): ${ok(v.g1)}${v.falta_g1 ? ' faltam ' + v.falta_g1 : ''}\nGatilho 2 (110% em 31/10, R$ 350): ${ok(v.g2)}${v.falta_g2 ? ' faltam ' + v.falta_g2 + ' clientes' : ''}\n_Régua de positivação da apuração oficial; o G2 também exige 110% do faturado._`; }
  if (pessoa && pessoa.tipo === 'sup') { const s = (x.supervisores || []).find((y) => y.nome === pessoa.alvo.nome && y.filial === pessoa.alvo.filial); if (s) return `🏆 *Incentivo — ${titulo(s.nome)}* (${s.filial}): ${s.real} de ${s.meta} positivações (${pctTxt(s.pct)}) ${ok(s.ok)}${s.falta ? ' · faltam ' + s.falta + ' para 110%' : ''} · R$ 300 se a equipe fizer 110%.`; }
  const p = x.premio_se_fechasse_hoje || {};
  const L = [`🏆 *Incentivo Outubro — ${E.nome}* (dados ${String(x.atualizado_em || '').slice(11, 16)})`];
  if (E.nacional) {
    L.push(`Positivação nacional: *${N(x.nacional.real)}* · meta do regulamento ${N(x.nacional.meta_regulamento)} (${pctTxt(x.nacional.pct_regulamento)}) · superação ${N(x.nacional.meta_superacao)} (${pctTxt(x.nacional.pct_superacao)})`,
      `💰 Se fechasse hoje: G1 ${R$(p.g1)} · G2 ${R$(p.g2)} · supervisores ${R$(p.sup)} · gerentes ${R$(p.ger)} → *${R$(p.total)}*`, '*Filiais (positivação vs alvo 110%):*');
    for (const f of (x.filiais || []).slice().sort((a, b) => b.pct_coluna_n - a.pct_coluna_n)) L.push(`• ${f.filial}: ${N(f.real)} de ${N(f.coluna_n)} (${pctTxt(f.pct_coluna_n)}) ${ok(f.ok)} · faltam ${N(f.falta)} p/ 110%`);
  } else {
    const f = (x.filiais || []).find((y) => y.filial === E.filiais[0]);
    if (f) { L.push(`Filial (meta do regulamento): ${N(f.real)} de ${N(f.coluna_n)} (${pctTxt(f.pct_coluna_n)}) ${ok(f.ok)} · faltam ${N(f.falta)} p/ 110% (${N(f.alvo110_coluna_n)})`); for (const g of f.gerentes || []) if (!E.grupo || sem(g.grupo) === sem(E.grupo)) L.push(`• Gerência ${g.gerente} (meta das pastas): ${N(g.real)} de ${N(g.meta)} (${pctTxt(g.pct)}) ${ok(g.ok)}`); }
    const S = (x.supervisores || []).filter((s) => s.filial === E.filiais[0] && (!(E.grupo || E.supervisor) || E.vend.some((v) => v.supervisor === s.nome))).sort((a, b) => b.pct - a.pct);
    L.push('*Supervisores (R$ 300 com 110%):*', ...S.map((s) => `• ${nome2(s.nome)}: ${s.real}/${s.meta} (${pctTxt(s.pct)}) ${ok(s.ok)}${s.falta ? ' · faltam ' + s.falta : ''}`));
    const V = (x.vendedores || []).filter((v) => v.filial === E.filiais[0] && (!E.grupo || sem(v.grupo) === sem(E.grupo)) && (!E.supervisor || sem(v.supervisor) === sem(E.supervisor)));
    L.push(`Vendedores: G1 ✅ ${V.filter((v) => v.g1).length} de ${V.length} · G2 ✅ ${V.filter((v) => v.g2).length}`);
    const perto = V.filter((v) => !v.g2 && v.falta_g2 > 0 && v.falta_g2 <= 5).sort((a, b) => a.falta_g2 - b.falta_g2);
    if (perto.length) L.push(`Perto do G2 (≤5 clientes): ${perto.slice(0, 8).map((v) => `${nome2(v.nome)} (${v.falta_g2})`).join(', ')}`);
  }
  L.push('', SUGESTAO + 'focar quem está a poucos clientes do 110%: é prêmio garantido com pouco esforço.', '_Painel completo: ceven-cftv-matrix.pages.dev/incentivo_');
  return L.join('\n');
}
async function respLigaAs(B, E, pessoa) {
  const x = await B.ligaAs(); if (!x || !x.vendedores) return 'Não consegui ler a Liga AS agora.';
  if (pessoa && pessoa.tipo === 'vend') { const v = x.vendedores.find((y) => y.rca === pessoa.alvo.rca && y.filial === pessoa.alvo.filial); if (v) return `🏆 *Liga AS — ${titulo(v.nome)}* (${v.filial}): *${v.pontos} pontos* · ${pctTxt(v.pct_hoje)} da meta (faturado + pendente) · fases: ${(v.fases || []).map((f) => `F${f.n} ${f.status === 'batida' ? '✅' : f.status === 'futuro' ? '⏳' : '❌'}`).join(' ')} · bônus: ${(v.bonus || []).map((b) => `${b.nome} ${b.status === 'batido' ? '✅' : b.status === 'perdido' ? '❌' : '⏳'}`).join(' · ')}`; }
  const V = x.vendedores.filter((v) => E.filiais.includes(v.filial)).sort((a, b) => b.pontos - a.pontos || b.pct_hoje - a.pct_hoje);
  const S = (x.supervisores || []).filter((v) => E.filiais.includes(v.filial)).sort((a, b) => b.pontos - a.pontos);
  return [`🏆 *Liga AS — ${E.nome}* (${x.mes})`, `_${(x.regras && x.regras.base) || ''}_`, '*Vendedores AS:*', ...V.slice(0, 10).map((v, i) => `${i + 1}. ${nome2(v.nome)}${E.nacional ? ' ' + v.filial : ''} — ${v.pontos} pts · ${pctTxt(v.pct_hoje)}`), '*Supervisores:*', ...S.slice(0, 6).map((s, i) => `${i + 1}. ${nome2(s.supervisor)}${E.nacional ? ' ' + s.filial : ''} — ${s.pontos} pts · ${pctTxt(s.pct_hoje)}`), '', '_ceven-cftv-matrix.pages.dev/liga-as_'].join('\n');
}
async function respSemana(B, E) {
  const R = await Promise.all(E.filiais.map((f) => B.semana(f).then((j) => ({ f, S: j && j.filiais && j.filiais[f] }))));
  const sups = new Set(E.vend.map((v) => v.filial + '|' + v.supervisor));
  const all = R.flatMap(({ f, S }) => (S || []).filter((s) => !/^GERENTE/i.test(s.nome) && (!(E.grupo || E.supervisor) || sups.has(f + '|' + s.nome))).map((s) => ({ ...s, filial: f })));
  if (!all.length) return 'Não consegui ler a semana dos supervisores agora.';
  const pass = (s) => (s.dias || []).filter((d) => d.estado !== 'futuro');
  const L = [`🗓️ *Semana dos supervisores — ${E.nome}* (compromisso / RET por dia útil até hoje)`];
  const rank = all.map((s) => ({ s, c: pass(s).filter((d) => d.comp).length, r: pass(s).filter((d) => d.ret).length, n: pass(s).length })).sort((a, b) => (a.c + a.r) - (b.c + b.r));
  for (const { s, c, r, n } of rank.slice(0, E.nacional ? 20 : 30)) L.push(`• ${nome2(s.nome)}${E.nacional ? ' ' + s.filial : ''}: compromisso ${c}/${n} · RET ${r}/${n}`);
  if (E.nacional && rank.length > 20) L.push(`… (${rank.length} supervisores; mostrando os 20 com menos dias)`);
  L.push('', SUGESTAO + `${nome2(rank[0].s.nome)} é quem menos fez na semana.`);
  return L.join('\n');
}
async function respDevMotivos(B) {
  const x = await B.devMot(); if (!x) return null;
  const M = Object.entries(x.notas_por_motivo || {}).sort((a, b) => b[1] - a[1]);
  return [`↩️ *Devoluções por motivo — Brasil (${x.mes})*: ${N(x.notas_com_valor)} notas · ${R$(x.valor_total_devolvido)}`, ...M.slice(0, 10).map(([m, n]) => `• ${titulo(m)}: ${n} notas`), `Notas por filial: ${Object.entries(x.notas_por_filial || {}).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(' · ')}`, '_"Cliente não pediu" = cartão vermelho (−10); motivo comercial = gol contra (−4)._'].join('\n');
}
async function respBola(B, E) {
  const R = await Promise.all(E.filiais.map((f) => B.bola(f).then((j) => ({ f, j }))));
  const L = ['⚽ *Bola Cheia do dia*'];
  for (const { f, j } of R) { if (!j) continue; if (j.pendente) { L.push(`• ${f}: ${j.motivo}`); if (E.nacional) break; continue; } L.push(`• ${f}: ${(j.vencedores || []).map((v) => nome2(v.nome || v.vendedor)).join(', ') || 'sem vencedor'}`); }
  return L.join('\n');
}
async function respDivergencias(B) {
  const x = await B.diverg(); if (!x || !x.resumo) return 'Não consegui ler as divergências agora.';
  const r = x.resumo;
  return [`🔎 *Divergências com o CEVEN*`, `No CEVEN e fora da Gestão de Equipe: *${r.banco_fora_da_planilha}* (${r.banco_fora_da_planilha_com_movimento} com movimento hoje, ${R$(r.faturado_mes_fora_da_planilha)} faturado no mês)`, `Na Gestão e sem dado no CEVEN: ${r.planilha_fora_do_banco}`, `Códigos descobertos: ${r.codigos_descobertos} (${r.codigos_descobertos_novos} novos) · devolução descoberta no mês ${R$(r.devolucao_descoberta_mes)}`,
    '', SUGESTAO + 'decidir na Gestão de Equipe (painel "Divergências com o CEVEN").', '_ceven-cftv-matrix.pages.dev/gestao-equipe_'].join('\n');
}
// ---------- OPERACAO DO DIA (como o WhatsApp 17:00/18:30; Vitorio 26/10/2026: "veja como tem muita coisa que precisa aprender") ----------
// Cortes e bloqueados: /api/pedidos-dia com a MESMA regra do motor do WhatsApp (pipeline/ceven_unified_engine.js). Reativados (+30 d) e recorrencia: lances do dia.
function valorCorte(v) {
  const cat = String(v.categoria_corte || '').toUpperCase(), it = v.itens_cortados || [];
  if (!((cat && cat !== 'SEM CORTE') || it.length)) return 0;
  const orig = parseFloat(v.total_clube || v.valor_original || 0) || 0, fat = parseFloat(v.vl_faturado_winthor || 0) || 0;
  if (orig > fat && fat > 0) return orig - fat;
  let c = 0; for (const x of it) if (Number(x.preco) > 0) c += (x.qt_cortada || 0) * Number(x.preco);
  if (!(c > 0) && Number(v.vl_perdido_logistica) > 0) c = Number(v.vl_perdido_logistica);
  return c;
}
async function operacao(B, E) {
  const [pd, lc] = await Promise.all([B.pedidosDia(), B.lances()]);
  const rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const dentro = (fil, rca) => E.filiais.includes(fil) && (!(E.grupo || E.supervisor) || rcas.has(fil + '|' + rca));
  const chave = (fil, rca) => { if (E.nacional) return fil; const v = E.vend.find((x) => x.filial === fil && x.rca === String(rca)); return (v && v.supervisor) || 'sem supervisor'; };
  const G = {}; const g = (k) => G[k] || (G[k] = { dig: 0, ped: 0, cortes: 0, nCortes: 0, bloq: 0, nBloq: 0, reat: 0, rec: 0, devHoje: 0, varejo: 0, vendeu: 0 });
  for (const v of (pd && pd.pedidos) || []) {
    if (!dentro(v.filial, v.rca)) continue;
    const x = g(chave(v.filial, v.rca)), vc = valorCorte(v);
    if (vc > 0) { x.cortes += vc; x.nCortes++; }
    if (v.status_pedido === 'BLOQUEADO') { const of = parseFloat(v.vl_faturado_winthor || 0) || 0; x.bloq += of > 0 ? of : (parseFloat(v.total_clube || v.valor_original || 0) || 0); x.nBloq++; }
  }
  for (const l of (lc && lc.lances) || []) {
    if (!dentro(l.filial, String(l.rca))) continue;
    const tipo = String(l.chave || '').replace(/^[A-Z]{3}\|/, '').split('|')[0];
    if (tipo === 'gol_inativo') g(chave(l.filial, l.rca)).reat++;
    if (l.nivel === 'defesa') g(chave(l.filial, l.rca)).rec++;
  }
  for (const v of E.vend) { const x = g(E.nacional ? v.filial : (v.supervisor || 'sem supervisor')); x.dig += v.dig; x.ped += v.ped; x.devHoje += v.devHoje; if (v.varejo && v.visP > 0) { x.varejo++; if (v.vendeuHoje) x.vendeu++; } }
  if (E.nacional) for (const f of E.filiais) { const m = E.porFilial[f].macro; const x = g(f); x.dig = m.dig; x.ped = m.pedidos; x.devHoje = m.devHoje; }
  const T = Object.values(G).reduce((a, x) => { for (const k in x) a[k] = (a[k] || 0) + x[k]; return a; }, {});
  if (!E.grupo && !E.supervisor && !E.nacional) { T.dig = E.macro.dig; T.ped = E.macro.pedidos; T.devHoje = E.macro.devHoje; }
  return { G, T, semPedidos: !pd, semLances: !lc };
}
async function respOperacao(B, E, t) {
  const { G, T, semPedidos, semLances } = await operacao(B, E);
  const hora = ((await B.saude()) || {}).hora_sp || '';
  const L = [`📊 *Operação de hoje — ${E.nome}* (${hora})`, `💰 Digitado: *${R$(T.dig)}* · 📦 *${N(T.ped)}* pedidos`,
    `🎯 Varejo com rota: *${N(T.vendeu)} de ${N(T.varejo)}* com venda (${P(T.vendeu, T.varejo)}) · 🚨 zerados: ${N(T.varejo - T.vendeu)}`,
    `🟢 Inativos reativados (+30 d): *${N(T.reat)}* · 🔄 Recorrência positivada: *${N(T.rec)}*`,
    `✂️ Cortes: *${R$(T.cortes)}* (${N(T.nCortes)} pedidos) · 🔒 Bloqueados: *${R$(T.bloq)}* (${N(T.nBloq)} pedidos)`,
    `🚛 Devoluções entradas hoje: *${R$(T.devHoje)}*`];
  if (semPedidos) L.push('_Cortes e bloqueados: sem leitura agora._'); if (semLances) L.push('_Reativados e recorrência: sem leitura dos lances agora._');
  const foco = /CORTE/.test(t) ? 'cortes' : /BLOQUE|RETID/.test(t) ? 'bloq' : /REATIV|INATIV/.test(t) ? 'reat' : /RECORR/.test(t) ? 'rec' : /DEVOLU/.test(t) ? 'devHoje' : 'dig';
  const nomes = { cortes: 'cortes', bloq: 'bloqueados', reat: 'reativados', rec: 'recorrência', devHoje: 'devoluções de hoje', dig: 'digitado' };
  const S = Object.entries(G).filter(([k]) => E.nacional || supReal(k)).sort((a, b) => b[1][foco] - a[1][foco]);
  L.push('', `*${E.nacional ? 'Por filial' : 'Por supervisor'} (ordem: ${nomes[foco]}):*`);
  S.forEach(([k, x], i) => L.push(`${i < 3 ? ['🥇', '🥈', '🥉'][i] : '•'} *${E.nacional ? k : nome2(k)}* ${R$(x.dig)} · ${x.ped} ped. · reat. ${x.reat} · rec. ${x.rec} · cortes ${R$(x.cortes)} · bloq. ${R$(x.bloq)}`));
  const mb = S.slice().sort((a, b) => b[1].bloq - a[1].bloq)[0];
  L.push('', SUGESTAO + (mb && mb[1].bloq > 0 ? `${R$(mb[1].bloq)} bloqueados em ${E.nacional ? mb[0] : nome2(mb[0])}: liberar com o crédito hoje para faturar.` : 'sem bloqueio relevante; foco nos zerados.'));
  return L.join('\n');
}
// recorrencia e resgates do dia AGORA pelos lances (o mapa da Executiva foi desligado em 25/10/2026)
async function respRecorrenciaLances(B, E) {
  const { G, T, semLances } = await operacao(B, E);
  if (semLances) return 'Não consegui ler os lances de hoje agora.';
  const S = Object.entries(G).filter(([k]) => E.nacional || supReal(k)).sort((a, b) => (b[1].rec + b[1].reat) - (a[1].rec + a[1].reat));
  return [`⭐ *Recorrência e reativados hoje — ${E.nome}*`, `🔄 Clientes da RECORRÊNCIA positivados (defesa +3): *${N(T.rec)}*`, `🟢 Inativos reativados (+30 dias sem compra): *${N(T.reat)}*`, '',
    ...S.slice(0, 15).map(([k, x]) => `• ${E.nacional ? k : nome2(k)}: recorrência ${x.rec} · reativados ${x.reat}`), '', SUGESTAO + 'cada recorrência positivada é defesa (+3) na Liga; cobrar os clientes da tag que ainda estão na rota.'].join('\n');
}
// GESTAO DE CAMPO por filial (como o WhatsApp 11:30): compromisso e RET em %
async function respGestaoCampo(B, E) {
  const R = await Promise.all(E.filiais.map((f) => B.sups(f).then((j) => ({ f, S: ((j && j.supervisores) || []).filter((x) => !/^GERENTE/i.test(x.nome)) }))));
  const linhas = R.map(({ f, S }) => ({ f, n: S.length, c: S.filter((x) => x.fez_compromisso).length, r: S.filter((x) => x.iniciou_ret).length })).filter((x) => x.n);
  const tot = linhas.reduce((a, x) => ({ n: a.n + x.n, c: a.c + x.c, r: a.r + x.r }), { n: 0, c: 0, r: 0 });
  linhas.sort((a, b) => (b.c / b.n + b.r / b.n) - (a.c / a.n + a.r / a.n));
  return [`📋 *Gestão de campo — ${E.nome}*`, `👥 Supervisores: ${tot.n} · 📝 Compromissos: *${tot.c} de ${tot.n}* (${P(tot.c, tot.n)}) · 🚗 Em rota (RET): *${tot.r} de ${tot.n}* (${P(tot.r, tot.n)})`, '',
    ...linhas.map((x, i) => `${i < 3 ? ['🥇', '🥈', '🥉'][i] : '🏢'} ${x.f}: 📝 ${x.c}/${x.n} (${P(x.c, x.n)}) · 🚗 ${x.r}/${x.n} (${P(x.r, x.n)})`), '', '_Peça "quem não fez RET" para os nomes._'].join('\n');
}
// RELATORIOS DO WHATSAPP: o ultimo arquivo salvo no GitHub (o do Vitorio para a diretoria; o do gerente para ele)
const CICLOS = [[/07[:H ]?45|ABERTURA|RISCO/, '07_45', '07:45 (abertura e risco)'], [/10[:H ]?(00)?\b|MARCAS? PROPRIAS?|\bMP\b/, '10_00', '10:00 (Marcas Próprias)'], [/11[:H ]?30|GESTAO DE CAMPO/, '11_30', '11:30 (gestão de campo)'],
  [/14[:H ]?30|PARCIAL/, '14_30', '14:30 (parcial da tarde)'], [/17[:H ]?(00)?\b|RETA FINAL|CONSOLIDADO/, '17_00', '17:00 (reta final)'], [/18[:H ]?30|FECHAMENTO|BOLETIM/, '18_30', '18:30 (fechamento)']];
const normArq = (s) => sem(s).replace(/[^A-Z0-9]+/g, '_');
async function respRelatorio(B, c, t) {
  let ciclo = CICLOS.find(([re]) => re.test(t));
  if (!ciclo && /ONTEM|COMO FECHOU/.test(t)) ciclo = CICLOS[5];
  if (!ciclo) { const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date())) % 24; ciclo = h >= 19 ? CICLOS[5] : h >= 17 ? CICLOS[4] : h >= 15 ? CICLOS[3] : h >= 12 ? CICLOS[2] : h >= 10 ? CICLOS[1] : CICLOS[0]; }
  const dir = `OPERACAO_WHATSAPP/relatorios_por_horario/${ciclo[1]}`;
  const lista = await B.pasta(dir);
  let arqs = Array.isArray(lista) ? lista.filter((a) => a && /\.md$/.test(a.name)).map((a) => a.name) : null;
  if (!arqs) {   /* sem lista (GitHub limitou): tenta os nomes padrao */
    const hh = ciclo[1], F = c.filial || '', Gp = String(c.grupo || '').toUpperCase();
    const ac = (x) => x.replace('FABIO', 'FÁBIO'), Nm = String(c.nome || '').split(' ')[0].toUpperCase(), Tt = Nm.charAt(0) + Nm.slice(1).toLowerCase();
    arqs = c.papel === 'gerente' && F ? [...(Gp ? [`${hh}__${F}_${Gp}.md`, `${hh}__${F}_${ac(Gp)}.md`] : []), `${hh}__${F}.md`, `${hh}__GERENTE_${F}_${Nm}.md`, `${hh}__GERENTE_${F}_${Tt}.md`, `${hh}__GERENTE_${F}_${Nm.replace(/[^A-Z]/g, '_')}.md`, `${hh}__GERENTE_${F}_${Nm.replace('FABIO', 'F_BIO')}.md`, `${hh}__GERENTE_${F}_${Tt.replace('Fabio', 'F_bio')}.md`, ...(F === 'TPA' ? [`${hh}__GERENTE_TPA_Radke_Leandro.md`] : [])] : [`${hh}__VITORIO.md`];
    for (const n of arqs) { const t2 = await B.raw(`${dir}/${n}`); if (t2) { arqs = [n]; break; } }
  }
  let alvo = null;
  if (c.papel === 'gerente' && c.filial) {
    // nomes de arquivo variam: FABIO / FÁBIO / F_BIO (acento virou "_"). Compara as duas formas; arquivo com " - " no nome e copia antiga (descarta).
    const F = c.filial, v2 = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const alvos = (x) => [normArq(x), v2(x)].filter((y, i, a) => y && a.indexOf(y) === i);
    const G = alvos(c.grupo), PN = alvos(String(c.nome || '').split(' ')[0]);
    const sc = (n) => { if (/ - /.test(n)) return -1; const x = normArq(n), xr = v2(n); if (!x.includes('_' + F)) return -1; let s = 1; const tem = (L) => L.some((y) => x.includes(y) || xr.includes(y));
      if (G.length && tem(G)) s += 3; if (PN.length && tem(PN)) s += 2; if (!G.length && x === normArq(`${ciclo[1]}__${F}.md`)) s += 1; return s; };
    alvo = arqs.map((n) => [n, sc(n)]).filter((x) => x[1] >= 0).sort((a, b) => b[1] - a[1])[0];
    alvo = alvo && alvo[0];
  } else alvo = arqs.find((n) => /VITORIO/i.test(n));
  if (!alvo && ciclo[1] === '10_00' && ['TBE', 'TCG'].includes(c.filial)) return `${c.filial} não tem Marca Própria no catálogo (regra do relatório das 10:00); por isso não há relatório de MP para a filial.`;
  if (!alvo) return `Não achei o seu relatório das ${ciclo[2]}.`;
  const txt = await B.raw(`${dir}/${alvo}`);
  if (!txt) return `Não consegui ler o relatório das ${ciclo[2]} agora.`;
  const dt = (txt.match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1] || '';
  const hoje = hojeSP().split('-').reverse().join('/');
  const avisos = [];
  if (dt && dt !== hoje) avisos.push(`_Último disponível: ${dt} (o de hoje ainda não saiu ou não foi salvo)._`);
  if (/Faturado: R\$ 0,00 • 📦 0 itens/.test(txt) && ciclo[1] === '10_00') avisos.push('⚠️ _Este relatório saiu ZERADO por falha na coleta do dia (a lista de vendedores veio vazia do CEVEN). Não é venda zero; o número real não foi apurado._');
  return [`📄 *Relatório das ${ciclo[2]}*${dt ? ' — ' + dt : ''}`, ...avisos, '', txt.trim().slice(0, 6000)].join('\n');
}
// DETALHE DO DETALHE (Vitorio, 25/10/2026): "quais clientes ela visitou e nao vendeu? quais as justificativas?" -> cliente a cliente, com check-in, tempo e motivo
function respClientesDia(v, t) {
  const R = v.rotaHoje || [];
  if (!v.varejo) return `${titulo(v.nome)} não é varejo de rota (${v.canal || 'sem canal'}); não tem roteiro de visitas.`;
  if (!R.length) return `${titulo(v.nome)} (${v.filial}) não tem clientes na rota de hoje` + ([0, 6].includes(new Date(hojeSP() + 'T12:00:00Z').getUTCDay()) ? ' (fim de semana: sem rota).' : '.');
  const st = (c) => String(c.status || '').toUpperCase();
  const vendeu = (c) => /POSITIVADO|EFETIVADO/.test(st(c));
  const visitou = (c) => !!c.checkin_horario || /VISITADO|JUSTIFICADO|POSITIVADO|EFETIVADO/.test(st(c));
  const linha = (c) => `• ${titulo(c.nome_cliente || c.razao_social || 'cliente')} (#${c.id_cliente}) — ${st(c) || 'sem status'}` + (c.checkin_horario ? ` · ${c.checkin_horario}–${c.checkout_horario || '…'} (${c.tempo_visita || '?'})` : '') + (c.motivo_nao_visita ? ` · motivo: *${titulo(c.motivo_nao_visita)}*` : '') + (c.observacao_nao_visita ? ` · obs.: "${c.observacao_nao_visita}"` : '');
  const fora = R.filter((c) => /FORA/.test(st(c))), rota = R.filter((c) => !/FORA/.test(st(c)));
  const cab = `📋 *${titulo(v.nome)}* (${v.filial} · sup. ${nome2(v.supervisor)}) — rota de hoje: ${rota.filter(visitou).length} visitados de ${rota.length} · com venda ${rota.filter(vendeu).length}` + (fora.length ? ` · fora da rota ${fora.length}` : '');
  let L, sug;
  if (/NAO VENDEU|SEM VENDA|JUSTIFICATIV|MOTIVO/.test(t)) {
    const S = rota.filter((c) => visitou(c) && !vendeu(c));
    const M = {}; for (const c of S) { const m = titulo(c.motivo_nao_visita || 'sem justificativa'); M[m] = (M[m] || 0) + 1; }
    L = [cab, '', `*Visitou e não vendeu (${S.length}):*`, ...S.map(linha), S.length ? '*Justificativas:* ' + Object.entries(M).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}×`).join(' · ') : ''];
    sug = S.some((c) => /PEDIDO A DIGITAR/i.test(c.motivo_nao_visita || '')) ? 'tem "pedido a digitar": cobrar a digitação hoje para não virar zerado.' : S.length ? 'rever com o supervisor os clientes sem venda e voltar nos de maior potencial.' : 'todas as visitas viraram venda.';
  } else {
    const falta = rota.filter((c) => !visitou(c));
    L = [cab, '', '*Visitados:*', ...rota.filter(visitou).map(linha), fora.length ? '*Fora da rota:*' : '', ...fora.map(linha), falta.length ? '*Ainda sem visita:*' : '', ...falta.map(linha)];
    sug = rota.filter((c) => !visitou(c)).length ? `faltam ${rota.filter((c) => !visitou(c)).length} cliente(s) na rota; priorizar os parados há mais tempo.` : 'rota de hoje concluída.';
  }
  return L.filter((x, i) => x !== '' || i === 1).join('\n').slice(0, 3800) + '\n\n' + SUGESTAO + sug;
}
// clientes da rota de hoje que ainda faltam visitar (Vitorio, 22/10/2026: "quais clientes ainda faltam visitar hoje?")
function respAVisitar(E, pessoa) {
  const dias = (c) => { const d = String(c.data_ultima_compra || '').slice(0, 10); if (!d) return 'sem compra'; const n = Math.round((Date.parse(hojeSP()) - Date.parse(d)) / 864e5); return n + 'd sem compra'; };
  const cli = (c) => `• ${titulo(c.nome_cliente || c.razao_social || 'cliente ' + c.id_cliente)} (#${c.id_cliente}) · ${dias(c)}` + (Array.isArray(c.focos) && c.focos.length ? ' · ' + c.focos.map((f) => f.industria_foco).join('/') : '');
  if (pessoa && pessoa.tipo === 'vend') {
    const v = pessoa.alvo; if (!v.varejo) return `${titulo(v.nome)} não é varejo de rota (${v.canal || 'sem canal'}).`;
    const A = v.aVisitar;
    return [`📍 *${titulo(v.nome)}* (${v.filial}) — rota de hoje: ${v.visF} de ${v.visP} visitas feitas · *faltam ${A.length}*`, ...A.slice(0, 30).map(cli), A.length > 30 ? `… e mais ${A.length - 30}` : '',
      '', A.length ? SUGESTAO + `começar pelos parados há mais tempo e pelos com tag de campanha.` : SUGESTAO + 'rota de hoje concluída.'].filter((x) => x !== '').join('\n');
  }
  const V = E.vend.filter((v) => v.varejo && (!pessoa || (v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial)));
  const tot = V.reduce((a, v) => a + v.aVisitar.length, 0), prog = V.reduce((a, v) => a + v.visP, 0), feitas = V.reduce((a, v) => a + v.visF, 0);
  const nome = pessoa ? titulo(pessoa.alvo.nome) + ' (' + pessoa.alvo.filial + ')' : E.nome;
  const L = [`📍 *Rota de hoje — ${nome}* (varejo)`, `Clientes na rota: *${N(prog)}* · visitados: *${N(feitas)}* · *faltam ${N(tot)}*`, ''];
  if (E.nacional && !pessoa) { for (const [f, x] of [...agrupa(V, (v) => v.filial)].map(([f, x]) => [f, x.V.reduce((a, v) => a + v.aVisitar.length, 0)]).sort((a, b) => b[1] - a[1])) L.push(`• ${f}: faltam ${x}`); }
  else for (const v of V.filter((v) => v.aVisitar.length).sort((a, b) => b.aVisitar.length - a.aVisitar.length).slice(0, 25)) L.push(`• ${nome2(v.nome)}: faltam *${v.aVisitar.length}* de ${v.visP}` + (pessoa ? ' — ' + v.aVisitar.slice(0, 3).map((c) => titulo(c.nome_cliente || '')).join(', ') + (v.aVisitar.length > 3 ? '…' : '') : ''));
  const pior = V.slice().sort((a, b) => b.aVisitar.length - a.aVisitar.length)[0];
  L.push('', pior && pior.aVisitar.length ? SUGESTAO + `${nome2(pior.nome)} tem ${pior.aVisitar.length} clientes por visitar.` : SUGESTAO + 'rota do dia concluída.', '_Peça "faltam visitar vendedor Nome" para a lista de clientes._');
  return L.join('\n');
}
function respZerados(E) {
  const Z = E.vend.filter((v) => v.zerado), SV = E.vend.filter((v) => v.semVisita);
  if (!Z.length) return `✅ *${E.nome}*: nenhum vendedor do varejo com rota está sem pedido agora.`;
  const G = [...agrupa(Z, (v) => supChave(v, E.nacional))].sort((a, b) => b[1].V.length - a[1].V.length);
  const L = [`⚠️ *Zerados hoje — ${E.nome}* (varejo com rota e sem pedido): *${Z.length}* · sem nenhuma visita: ${SV.length}`, ''];
  for (const [s, x] of G.slice(0, 15)) L.push(`*${supNome(s)}*: ` + x.V.map((v) => `${nome2(v.nome)} (${v.visF}/${v.visP} vis.)`).join(', '));
  if (G.length > 15) L.push(`… e mais ${G.length - 15} supervisores`);
  L.push('', SUGESTAO + `começar por ${supNome((G.find(([k]) => supReal(k)) || G[0])[0])}: ${G[0][1].V.length} zerado(s).`);
  return L.join('\n');
}
function respVisitas(E) {
  const V = E.vend.filter((v) => v.varejo); const x = agrupa(V, () => 'x').get('x');
  if (!x) return 'Sem dado de rota agora.';
  const G = [...agrupa(V, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([k]) => supReal(k)).sort((a, b) => (b[1].visF / (b[1].visP || 1)) - (a[1].visF / (a[1].visP || 1)));
  const pm = V.reduce((a, v) => [a[0] + v.visRealMes, a[1] + v.visPlanMes], [0, 0]);
  return [`🚶 *Rota do varejo — ${E.nome}*`, `Hoje: *${N(x.visF)} de ${N(x.visP)}* visitas (${P(x.visF, x.visP)}) · com venda ${N(x.comVenda)} → eficácia *${P(x.comVenda, x.visP)}*`, `Mês: ${N(pm[0])} de ${N(pm[1])} visitas (eficiência ${P(pm[0], pm[1])})`, `Sem nenhuma visita hoje: ${x.semVisita}`, '',
    ...G.map(([k, y]) => `• ${E.nacional ? k : nome2(k)}: ${y.visF}/${y.visP} (${P(y.visF, y.visP)}) · eficácia ${P(y.comVenda, y.visP)}`),
    '', SUGESTAO + (x.semVisita ? `${x.semVisita} vendedor(es) com rota ainda sem visita: ${listaNomes(V.filter((v) => v.semVisita), 3)}.` : 'todos com visita; acompanhar a eficácia.'), '_Visitas e eficácia contam só o varejo de campo (rota)._'].join('\n');
}
function respRanking(E, t) {
  const pos = /POSITIVA/.test(t), hoje = /HOJE|DIA\b/.test(t);
  const V = E.vend.filter((v) => pessoaReal(v) && (pos ? v.metaPos : hoje ? true : v.meta));
  const val = (v) => pos ? (v.metaPos ? v.pos / v.metaPos * 100 : -1) : hoje ? v.dig : v.pct ?? -1;
  const fmt = (v) => pos ? `${v.pos}/${Math.round(v.metaPos)} (${P(v.pos, v.metaPos)})` : hoje ? `${R$(v.dig)} (${v.ped} ped.)` : `${pctTxt(v.pct)} · ${R$(v.fat)}`;
  const S = V.slice().sort((a, b) => val(b) - val(a)); const n = /\b(10|DEZ)\b/.test(t) ? 10 : 5;
  const crit = pos ? 'positivação' : hoje ? 'digitado hoje' : '% da meta faturada';
  return [`🏅 *${E.nome} — ranking por ${crit}*`, '*Melhores:*', ...S.slice(0, n).map((v, i) => `${i + 1}. ${nome2(v.nome)}${E.nacional ? ' ' + v.filial : ''} — ${fmt(v)}`), '*Mais atrás:*' + (hoje ? ' _(varejo com rota hoje)_' : ''), ...(hoje ? S.filter((v) => v.varejo && v.visP > 0) : S).slice(-n).reverse().map((v) => `• ${nome2(v.nome)}${E.nacional ? ' ' + v.filial : ''} — ${fmt(v)}`),
    '', SUGESTAO + `reconhecer ${nome2(S[0] && S[0].nome)} e montar plano com ${nome2(((hoje ? S.filter((v) => v.varejo && v.visP > 0) : S).slice(-1)[0] || {}).nome)}.`].join('\n');
}
async function respPositivacao(B, E) {
  const x = await totaisOficiais(B, E); if (!x.metaPos) return 'Sem dado agora.';
  const dn = diasUteisRestantes();
  const G = [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([k]) => supReal(k)).sort((a, b) => (b[1].pos / (b[1].metaPos || 1)) - (a[1].pos / (a[1].metaPos || 1)));
  return [`👥 *Positivação — ${E.nome}* (clientes com faturamento no mês)`, `*${N(x.pos)} de ${N(x.metaPos)}* (${P(x.pos, x.metaPos)}) · faltam ${N(Math.max(0, x.metaPos - x.pos))} → ${N(Math.ceil(Math.max(0, x.metaPos - x.pos) / Math.max(dn, 1)))} por dia útil`, '',
    ...G.map(([k, y]) => `• ${E.nacional ? k : nome2(k)}: ${y.pos}/${y.metaPos} (${P(y.pos, y.metaPos)})`), '', SUGESTAO + `o mais atrás é ${E.nacional ? G[G.length - 1][0] : nome2(G[G.length - 1][0])}.`,
    '_Total = oficial da filial (igual à TV); a lista soma os vendedores mostrados._'].join('\n');
}
function respDevolucao(E) {
  const V = E.vend.filter((v) => v.dev > 0).sort((a, b) => b.dev - a.dev); const tot = E.vend.reduce((a, v) => a + v.dev, 0);
  const G = [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([, y]) => y.dev > 0).sort((a, b) => b[1].dev - a[1].dev);
  const notas = E.vend.flatMap((v) => v.devolucoes.map((d) => ({ ...d, vend: v.nome }))).filter((d) => d && (d.valor || d.vl_total || d.total));
  return [`↩️ *Devoluções no mês — ${E.nome}*: *${R$(tot)}*`, `*Por ${E.nacional ? 'filial' : 'supervisor'}:*`, ...G.slice(0, 10).map(([k, y]) => `• ${E.nacional ? k : nome2(k)}: ${R$(y.dev)}`), '*Vendedores com mais devolução:*', ...V.slice(0, 8).map((v) => `• ${nome2(v.nome)}${E.nacional ? ' ' + v.filial : ''}: ${R$(v.dev)}`),
    notas.length ? `_${notas.length} nota(s) detalhadas na base._` : '', '', SUGESTAO + (V[0] ? `entender as devoluções de ${nome2(V[0].nome)} (${R$(V[0].dev)}).` : 'sem devoluções relevantes.')].filter(Boolean).join('\n');
}
async function respLances(B, E, t) {
  const lc = await B.lances(); if (!lc) return 'Não consegui ler os lances de hoje agora.';
  const rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  let L = (lc.lances || []).filter((l) => E.filiais.includes(l.filial) && (!(E.grupo || E.supervisor) || rcas.has(l.filial + '|' + l.rca)));
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
async function respLiga(B, E, alvo) {
  const lg = await B.liga(); if (!lg) return 'Não consegui ler a Liga agora.';
  if (alvo) { const lv = (lg.vendedores || []).find((x) => String(x.rca) === alvo.rca && x.filial === alvo.filial); if (lv) { const mv = (lv.pos_brasil_ant || lv.pos_brasil) - lv.pos_brasil; return `🏆 *${titulo(lv.nome)}* (${lv.filial}): ${lv.pos_brasil}º no Brasil (${mv > 0 ? '▲' + mv : mv < 0 ? '▼' + -mv : '='} desde o último jogo) · ${lv.pos_filial}º na filial · ${lv.pts_tabela} pts · ${lv.vitorias}V ${lv.empates}E ${lv.derrotas}D · forma ${(lv.forma || []).slice(-5).join('')}`; } }
  if (E.nacional) {
    return ['🏆 *Champions Triunfante — Brasil*', '*Filiais:*', ...(lg.filiais || []).slice().sort((a, b) => a.pos - b.pos).map((f) => `${f.pos}º ${f.sigla} — ${f.pts_tabela} pts (${f.vitorias}V ${f.empates}E ${f.derrotas}D)`),
      '*Top 5 vendedores (varejo):*', ...(lg.vendedores || []).filter((v) => v.canal !== 'AS').sort((a, b) => a.pos_brasil - b.pos_brasil).slice(0, 5).map((v) => `${v.pos_brasil}º ${nome2(v.nome)} ${v.filial} — ${v.pts_tabela} pts`), '', '_ceven-cftv-matrix.pages.dev/championstriunfante_'].join('\n');
  }
  const fil = E.filiais[0]; const lf = (lg.filiais || []).find((x) => x.sigla === fil);
  const sups = new Set(E.vend.map((v) => v.supervisor));
  return [`🏆 *Champions Triunfante — ${E.nome}*`, lf ? `Filial: *${lf.pos}º de 11*, ${lf.pts_tabela} pts (${lf.vitorias}V ${lf.empates}E ${lf.derrotas}D)` : 'Filial: sem dado',
    '*Supervisores:*', ...(lg.supervisores || []).filter((x) => x.filial === fil && (!(E.grupo || E.supervisor) || sups.has(x.supervisor))).sort((a, b) => a.pos - b.pos).slice(0, 10).map((x) => `${x.pos}º ${nome2(x.supervisor)} — ${x.pts_tabela} pts`),
    '*Top vendedores da filial:*', ...(lg.vendedores || []).filter((v) => v.filial === fil && (!(E.grupo || E.supervisor) || E.vend.some((y) => y.rca === String(v.rca)))).sort((a, b) => a.pos_filial - b.pos_filial).slice(0, 5).map((v) => `${v.pos_filial}º ${nome2(v.nome)} — ${v.pts_tabela} pts (${v.pos_brasil}º Brasil)`),
    '', '_Ranking completo: ceven-cftv-matrix.pages.dev/championstriunfante_'].join('\n');
}
async function respCompromisso(B, E) {
  const R = await Promise.all(E.filiais.map((f) => B.sups(f).then((j) => ({ f, S: (j && j.supervisores) || null }))));
  const sups = new Set(E.vend.map((v) => v.filial + '|' + v.supervisor));
  const all = R.flatMap(({ f, S }) => (S || []).filter((x) => !/^GERENTE/i.test(x.nome) && (!(E.grupo || E.supervisor) || sups.has(f + '|' + x.nome))).map((x) => ({ ...x, filial: f })));
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
async function respMix(B, E, t) {
  const mx = await B.mix(); if (!mx) return 'Não consegui ler o +MIX agora.';
  const rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const V = (mx.vendedores || []).filter((x) => E.filiais.includes(x.filial) && (!(E.grupo || E.supervisor) || rcas.has(x.filial + '|' + x.rca)));
  // produto: "quem compra X", "produto X"
  const m = t.match(/(?:PRODUTO|QUEM COMPRA|QUEM VENDE|VENDE MAIS|SKU)\s+(?:O |A |DE |DO |DA )?([A-Z0-9 ]{3,})/);
  if (m) {
    const q = m[1].trim().split(/\s+/).filter((w) => w.length > 2 && !/^(MAIS|HOJE|MES|NO|NA|EM)$/.test(w));
    const hit = []; for (const v of V) for (const s of v.top_skus || []) if (q.length && q.every((w) => sem(s.n).includes(w))) hit.push({ v, s });
    if (!hit.length) return `Não achei "${titulo(q.join(' '))}" entre os produtos mais vendidos dos vendedores de ${E.nome} neste mês (${mx.mes || ''}). Tente outro nome do produto.`;
    hit.sort((a, b) => b.s.cli - a.s.cli);
    return [`🧺 *${titulo(hit[0].s.n)}* — quem mais vende em ${E.nome} (clientes no mês):`, ...hit.slice(0, 12).map(({ v, s }) => `• ${nome2(v.nome)}${E.nacional ? ' ' + v.filial : ''}: ${s.cli} clientes (${String(s.pct).replace('.', ',')}% da carteira atendida) · ${R$(s.val)}`), '', SUGESTAO + 'quem tem pouca penetração nesse produto pode oferecer no próximo cliente do +MIX.'].join('\n');
  }
  const tot = V.reduce((a, v) => ({ cli: a.cli + (v.clientes_com_lista || 0), usou: a.usou + (v.clientes_usou || 0) }), { cli: 0, usou: 0 });
  const S = V.slice().sort((a, b) => (b.mix_medio || 0) - (a.mix_medio || 0));
  const usam = V.filter((v) => v.uso_pct != null).sort((a, b) => b.uso_pct - a.uso_pct);
  return [`🧺 *+MIX — ${E.nome}* (${mx.mes || 'mês'}, dados até ${mx.dados_ate || '—'})`, `Uso real: *${tot.usou}* de *${tot.cli}* clientes com lista compraram produto recomendado (${P(tot.usou, tot.cli)})`,
    '*Mais mix por cliente:*', ...S.slice(0, 5).map((v) => `• ${nome2(v.nome)}${E.nacional ? ' ' + v.filial : ''}: ${String(v.mix_medio).replace('.', ',')} produtos/cliente · ${R$(v.faturado_por_cliente)}/cliente`),
    '*Menos mix por cliente:*', ...S.slice(-5).reverse().map((v) => `• ${nome2(v.nome)}${E.nacional ? ' ' + v.filial : ''}: ${String(v.mix_medio).replace('.', ',')} produtos/cliente`),
    usam.length ? `*Quem mais usa o +MIX:* ${usam.slice(0, 3).map((v) => `${nome2(v.nome)} ${String(v.uso_pct).replace('.', ',')}%`).join(' · ')}` : '',
    '', SUGESTAO + (S.length ? `${nome2(S[S.length - 1].nome)} tem o menor mix: abrir o +MIX em cada cliente antes do pedido.` : 'usar o +MIX antes de cada pedido.'), '_Peça "quem compra NOME DO PRODUTO"._', '_Detalhe por cliente: ceven-cftv-matrix.pages.dev/mix_'].filter(Boolean).join('\n');
}
function respIncentivo(E) {
  const V = E.vend.filter((v) => v.varejo && v.meta && v.metaPos);
  const pf = (v) => v.fat / v.meta * 100, pp = (v) => v.pos / v.metaPos * 100;
  const ok = V.filter((v) => pf(v) >= 110 && pp(v) >= 110), quase = V.filter((v) => !ok.includes(v) && pf(v) >= 95 && pp(v) >= 95).sort((a, b) => Math.min(pf(b), pp(b)) - Math.min(pf(a), pp(a)));
  const g1 = V.filter((v) => pp(v) >= 60);
  return [`🏆 *Incentivo Outubro — ${E.nome}* (varejo)`, 'Regras: R$ 150 se ≥60% da positivação até 15/10 · R$ 350 se ≥110% positivação *e* ≥110% faturado em 31/10 · +R$ 30 por cliente novo do LinkUp com 1ª compra faturada.',
    `Hoje já com ≥110%/110%: *${ok.length} de ${V.length}*` + (ok.length ? ' — ' + listaNomes(ok, 6) : ''), `Perto (≥95% nos dois): ${quase.length}` + (quase.length ? ' — ' + quase.slice(0, 6).map((v) => `${nome2(v.nome)} (${pctTxt(pf(v))}/${pctTxt(pp(v))})`).join(', ') : ''),
    `Com ≥60% da positivação hoje: ${g1.length} de ${V.length}`, '_Valor oficial do prêmio = apuração do CEVEN (Premiação RV) com faturado; aqui é a leitura de agora._', '', SUGESTAO + (quase.length ? `empurrar ${listaNomes(quase, 3)}: estão perto dos 110%.` : 'focar positivação: é a régua mais difícil.')].join('\n');
}
const GLOSSARIO = [
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
function respGlossario(t) { const h = GLOSSARIO.filter(([re]) => re.test(t)).map(([, s]) => s); return h.length ? h.join('\n\n') : null; }
function respAjuda(c) {
  return [`Oi, ${titulo(String(c.nome).split(' ')[0])}! Sou o *Jota* ⚽, do +MIX. Pergunte do seu jeito, por exemplo:`, '• "como está?" / "como está TPH?"' + (c.papel === 'diretoria' ? ' (sem filial = Brasil todo)' : ''), '• "hoje" / "acumulado de hoje da rota"', '• "por supervisor" · "supervisor Nome" · "vendedor Nome"', '• "zerados" · "visitas" · "eficácia"', '• "quanto falta" · "positivação" · "ranking" · "top 10 hoje"', '• "devoluções" · "pênaltis" · "impedimentos" · "liga"', '• "compromisso" · "quem não fez RET"', '• "+mix" · "quem compra Oreo"', '• "incentivo" · "o que é positivação?"'].join('\n');
}

// acha supervisor ou vendedor citado na mensagem (primeiro nome tem que bater)
const PAL = new Set(['COMO', 'ESTA', 'QUAL', 'QUAIS', 'HOJE', 'VENDEDOR', 'VENDEDORA', 'SUPERVISOR', 'SUPERVISORA', 'FILIAL', 'ROTA', 'MINHA', 'MEU', 'EQUIPE', 'TIME', 'DELE', 'DELA', 'QUANTO', 'FALTA', 'LIGA', 'BRASIL', 'TODOS', 'TODAS', 'SOBRE', 'ESTOU', 'ESTAMOS', 'ONTEM', 'MAIS', 'MENOS', 'PEDIDO', 'PEDIDOS', 'VENDA', 'VENDAS', 'META', 'POSICAO', 'TABELA', 'ANDA', 'VAI', 'PARA', 'COM']);
function achaPessoa(E, t) {
  const toks = t.split(/[^A-Z]+/).filter((w) => w.length > 2 && !PAL.has(w));
  if (!toks.length) return null;
  const score = (nome) => { const p = sem(nome).replace(/^CLT\s*-?\s*/, '').split(/\s+/); if (!toks.includes(p[0])) return 0; return 1 + p.slice(1).filter((w) => toks.includes(w)).length; };
  const querSup = /SUPERVIS|EQUIPE|TIME/.test(t), querVend = /VENDEDOR|\bRCA\b/.test(t);
  const sups = [...new Map(E.vend.filter((v) => v.supervisor).map((v) => [v.filial + '|' + v.supervisor, { nome: v.supervisor, filial: v.filial }])).values()];
  const bs = sups.map((s) => [s, score(s.nome)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  const bv = E.vend.map((v) => [v, score(v.nome)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  if (bs.length && !querVend && (querSup || !bv.length || bs[0][1] >= bv[0][1])) return { tipo: 'sup', alvo: bs[0][0], empate: bs.filter((x) => x[1] === bs[0][1]).map((x) => x[0]) };
  if (bv.length) return { tipo: 'vend', alvo: bv[0][0], empate: bv.filter((x) => x[1] === bv[0][1]).map((x) => x[0]) };
  return null;
}

async function respostaPronta(B, c, texto, anteriores) {
  const fm = sem(texto).match(FRX);
  const outra = (c.papel === 'gerente' || c.papel === 'supervisor') && c.filial && fm && fm[1] !== c.filial ? `_Você vê só ${c.filial}${c.grupo ? ' · ' + titulo(c.grupo) : ''}; outras filiais são com a diretoria._\n\n` : '';
  const r = await respostaInterna(B, c, texto, anteriores);
  return r && outra + r;
}
async function respostaInterna(B, c, texto, anteriores) {
  const t = sem(texto);
  // escopo: gerente = a filial dele; diretoria = a filial citada, senao o Brasil
  const fm = t.match(FRX);
  const preso = (c.papel === 'gerente' || c.papel === 'supervisor') && c.filial;
  const fil = preso ? c.filial : fm ? fm[1] : null;
  const grupo = preso ? c.grupo || null : null;
  const supervisor = c.papel === 'supervisor' ? c.supervisor || c.nome : null;
  const esc = fil ? { nome: supervisor ? 'Equipe ' + nome2(supervisor) + ' (' + fil + ')' : fil + (grupo ? ' · ' + titulo(grupo) : ''), filiais: [fil], grupo: supervisor ? null : grupo, supervisor, nacional: false } : { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true };
  if (/^(OI|OLA|E AI|AJUDA|MENU|INICIO|COMECAR|BOM DIA|BOA TARDE|BOA NOITE)\b[ !?.]*$|O QUE (VOCE|VC) (SABE|FAZ|RESPONDE)|^AJUDA/.test(t)) return respAjuda(c);
  if (/O QUE (E|EH|SIGNIFICA)|COMO FUNCIONA|COMO (E|EH) CALCULAD|QUE QUER DIZER|DEFINICAO/.test(t)) { const g = respGlossario(t); if (g) return g; }
  if (/DIVERGENC/.test(t) && c.papel === 'diretoria') return respDivergencias(B);
  if (/BOLA CHEIA/.test(t)) return respBola(B, esc);
  if (/SEMANA/.test(t) && /COMPROMISSO|\bRETS?\b|SUPERVISOR/.test(t)) return respSemana(B, await carregaEscopo(B, esc));
  if (/RELATORIO|BOLETIM|DISPARO|MENSAGEM DAS|MARCAS? PROPRIAS?|COMO FECHOU|\bONTEM\b/.test(t)) return respRelatorio(B, c, t);
  if (/GESTAO DE CAMPO|SUPERVISORES EM CAMPO|EM ROTA \(RET\)|RANKING DE ATIVIDADE/.test(t) || (/COMPROMISSO|\bRET\b/.test(t) && /POR FILIAL|RANKING|PERCENT|%/.test(t))) return respGestaoCampo(B, await carregaEscopo(B, esc));
  if (/CORTE|BLOQUEAD|RETID|PERDAS|OPERACAO|RANKING DE VENDAS|RANKING FINAL|FECHAMENTO DO DIA|DEVOLUC\w* (DE |ENTRADAS? )?HOJE|ENTRADAS? HOJE/.test(t)) return respOperacao(B, await carregaEscopo(B, esc), t);
  if (/RECORRENCIA|RESGAT|REATIVAD|INATIVOS? (RECUPERAD|REATIVAD)/.test(t) && !/O QUE (E|EH)/.test(t)) return respRecorrenciaLances(B, await carregaEscopo(B, esc));
  if (/MOTIVO/.test(t) && /DEVOLU/.test(t)) return respDevMotivos(B);
  if (/COMPROMISSO|MATINAL|\bRET\b|\bRETS\b|ROTA DO SUPERVISOR/.test(t)) return respCompromisso(B, await carregaEscopo(B, esc));
  if (/PENALTI|IMPEDIMENTO|CARTA|VERMELHO|AMARELO|GOL CONTRA|\bGOLS?\b|LANCES?\b|HAT ?TRICK|DEFESAS?\b/.test(t) && !/LIGA|CHAMPIONS|CLASSIFICA/.test(t)) return respLances(B, await carregaEscopo(B, esc), t);
  if (/\+ ?MIX|MAIS ?MIX|\bMIX\b|PRODUTO|QUEM COMPRA|\bSKU/.test(t)) return respMix(B, await carregaEscopo(B, esc), t);
  const E = await carregaEscopo(B, esc);
  let pessoa = achaPessoa(E, t);
  if (!pessoa && /\b(ELA|ELE|DELA|DELE|DESSA|DESSE|ESSA|ESSE|NELA|NELE|PRA ELA|PRA ELE|MESMA|MESMO)\b/.test(t)) for (const h of anteriores || []) { pessoa = achaPessoa(E, sem(h)); if (pessoa) break; }
  if (pessoa && pessoa.tipo === 'vend' && /QUA(L|IS) (OS )?CLIENTES?|QUAIS\??$|JUSTIFICATIV|MOTIVO|NAO VENDEU|SEM VENDA|VISITOU|VISITAD|CHECK|ONDE (ELA|ELE) (FOI|ESTA)|POSITIVOU|VENDEU (PARA|PRA)/.test(t)) return respClientesDia(pessoa.alvo, t);
  if (/INCENTIVO|GATILHO|110 ?%|\b110\b|BONUS|PREMIA/.test(t)) return respIncentivoOficial(B, E, pessoa);
  if (/LIGA (DO |DOS |DA )?AS\b|LIGA DO ATACADO/.test(t) || (pessoa && pessoa.tipo === 'vend' && /^(AS|PET AS)$/.test(pessoa.alvo.canal) && /LIGA|PONTOS|POSICAO|CHAMPIONS/.test(t))) return respLigaAs(B, E, pessoa);
  if (/LIGA|CHAMPIONS|CLASSIFICA|TABELA|POSICAO|PONTOS|PONTUACAO|COLOCAD/.test(t)) return respLiga(B, E, pessoa && pessoa.tipo === 'vend' ? pessoa.alvo : null);
  if (/FALTA(M)? (SER )?VISITA|NAO (FOI |FORAM )?VISITAD|AINDA (NAO )?(FORAM )?VISITAD|CLIENTES? (EM )?ABERTO|PENDENTES? (DE |NA )?(VISITA|ROTA)|SEM VISITA AINDA|CLIENTES? (NA|DA) ROTA|FALTA VISITAR|FALTAM VISITAR|QUEM FALTA VISITAR/.test(t)) return respAVisitar(E, pessoa);
  if (pessoa) {
    const amb = pessoa.empate.length > 1 ? `\n\n_Achei mais de um: ${pessoa.empate.slice(0, 5).map((x) => titulo(x.nome) + ' ' + x.filial).join(' · ')}. Mande o nome completo se não for este._` : '';
    return (pessoa.tipo === 'sup' ? respSupervisor(E, pessoa.alvo) : await respVendedor(B, E, pessoa.alvo)) + amb;
  }
  if (/ZERAD|SEM PEDIDO|SEM VENDA|NAO VENDEU|NAO VENDERAM|NINGUEM VENDEU/.test(t)) return respZerados(E);
  if (/DEVOLU/.test(t)) { const a = respDevolucao(E); const m = E.nacional ? await respDevMotivos(B) : null; return m ? a + '\n\n' + m : a; }
  if (/QUANTO FALTA|FALTA (PARA|PRA|BATER)|\bFALTA\b|POR DIA UTIL|\bMN\b|PRECISA (VENDER|FATURAR)/.test(t)) return respFalta(B, E);
  if (/RANKING|MELHOR|PIOR|\bTOP\b|DESTAQUE|MAIS ATRAS|QUEM (ESTA|TA) (BEM|MAL)/.test(t)) return respRanking(E, t);
  if (/VISITA|EFICACIA|EFICIENCIA|ROTEIRO|CHECK.?IN/.test(t) && !/ACUMULADO|DIGITAD/.test(t)) return respVisitas(E);
  if (/POSITIVA/.test(t)) return respPositivacao(B, E);
  if (/COMO (ESTA|TA|VAI|ESTAMOS|ANDA)|RESUMO|PANORAMA|STATUS|GERAL|SITUACAO/.test(t) && !/ACUMULADO|DIGITAD/.test(t)) return respResumo(B, E);
  if (/HOJE|ACUMULADO|DIGITAD|PEDIDOS?\b|TICKET|VENDEU|VENDERAM|\bDIA\b|ROTA|VAREJO/.test(t)) return respHoje(B, E, t);
  if (/SUPERVIS|POR EQUIPE|ABERT|POR GERENTE/.test(t)) return respPorSupervisor(E);
  if (fm || /BRASIL|TODAS|NACIONAL|REDE/.test(t)) return respResumo(B, E);
  return null;
}

// pergunta livre: IA gratuita com o resumo do escopo (nunca inventar)
async function respondeIA(env, B, c, texto, historico) {
  if (!env.AI) return null;
  const t = sem(texto); const fm = t.match(FRX); const fil = c.papel === 'gerente' && c.filial ? c.filial : fm ? fm[1] : null;
  let base; try { base = await respResumo(B, await carregaEscopo(B, fil ? { nome: fil, filiais: [fil], grupo: c.papel === 'gerente' ? c.grupo : null, nacional: false } : { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true })); } catch (e) { base = 'sem dado'; }
  const sys = `Você é o JOTA, o assistente do +MIX da Triunfante no WhatsApp: colega de vendas animado e direto, que usa a linguagem do futebol da Champions Triunfante quando cabe. Responde em português do Brasil como um gerente comercial experiente.
Quem fala com você: ${titulo(c.nome)}, ${c.papel}${c.filial ? ' da filial ' + c.filial : ' (diretoria nacional: sem filial citada = Brasil todo)'}${c.grupo ? ', grupo ' + c.grupo : ''}.
REGRAS: use SÓ os números do RESUMO abaixo, exatamente como estão; nunca invente, estime ou projete; sem o dado, diga que não tem e sugira uma pergunta que o Jota responde (ex.: "hoje", "zerados", "por supervisor", "vendedor Nome", "falta", "liga", "+mix", "quem compra Oreo", "compromisso", "devoluções", "pênaltis", "incentivo").
Rota, visitas e eficácia = só varejo de campo. Faturado e pendente sempre separados. Formato WhatsApp: *negrito* com UM asterisco; no máximo 10 linhas; termine com "🎯 *Sugestão do Jota:*" e UMA ação concreta.
RESUMO: ${base.slice(0, 6000)}`;
  try { const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [{ role: 'system', content: sys }, ...historico, { role: 'user', content: texto }], max_tokens: 600 }); const s = String((r && (r.response || r.result)) || '').trim().replace(/\*\*/g, '*').replace(/^#+\s*/gm, ''); return s || null; } catch (e) { return null; }
}

// CADASTRO AUTOMATICO DE SUPERVISOR (Vitorio, 25/10/2026: "vai achar um padrao: o nome e no final o codigo deles, ex.: Washington COD 100").
// Regra: o numero do codigo tem que existir na arvore do CEVEN (arvore_supervisores.sup_id) E o primeiro nome do supervisor tem que aparecer na mensagem
// (ou no nome do WhatsApp). Senao, nada acontece (numero desconhecido continua sem resposta). Gerente e diretoria so por cadastro manual.
async function cadastraPorCodigo(env, cel, texto, pushName) {
  try {
    const t = sem(texto + ' ' + (pushName || ''));
    const m = t.match(/\bCOD(?:IGO)?\.?\s*[-:]?\s*(\d{1,4})\b/) || t.match(/\b(?:COORDENADOR|SUPERVISOR|SUP)\.?\s*[-:]?\s*(\d{1,4})\b/) || String(texto).trim().match(/^(\d{1,4})$/);
    if (!m) return null;
    const { results } = await env.DB.prepare('SELECT DISTINCT filial, sup_id, sup_nome FROM arvore_supervisores WHERE sup_id = ?').bind(m[1]).all();
    // "23" sozinho numa mensagem: vale se a mensagem anterior do mesmo numero trouxe o nome
    let nomes = t;
    if (/^\d{1,4}$/.test(String(texto).trim())) { const ant = await env.DB.prepare("SELECT texto FROM bot_msgs WHERE celular = ? AND direcao = 'in' ORDER BY id DESC LIMIT 3").bind(cel).all(); nomes += ' ' + sem((ant.results || []).map((x) => x.texto).join(' ')); }
    const ok = (results || []).find((r) => { const p = sem(r.sup_nome).replace(/^CLT\s*-?\s*/, '').split(/\s+/); return p[0] && nomes.includes(p[0]) && (p.length < 2 || p.slice(1).some((w) => w.length > 2 && nomes.includes(w))); });
    if (!ok) return null;
    const nome = String(ok.sup_nome).replace(/^CLT\s*-?\s*/i, '').trim();
    let grupo = null;
    try { const mo = await (await fetch('https://ceven-cftv-matrix.pages.dev/api/tv-mostra', { signal: AbortSignal.timeout(10000) })).json(); for (const [k, L] of Object.entries(mo.filiais || {})) for (const v of L) if (k.split('_')[0] === ok.filial && sem(v.supervisor) === sem(nome) && v.grupo) grupo = v.grupo; } catch (e) {}
    // PRECISA DO OK DO VITORIO (25/10/2026): entra como PENDENTE (ativo = 0); quem libera e a tela de contatos. Nunca reativa nem rebaixa quem ja existe.
    const ja = await env.DB.prepare('SELECT ativo FROM bot_contatos WHERE celular = ?').bind(cel).first();
    if (ja) return null;
    await env.DB.prepare("INSERT INTO bot_contatos (celular, nome, papel, filial, grupo, supervisor, ativo, situacao) VALUES (?,?,?,?,?,?,0,'pendente')").bind(cel, nome, 'supervisor', ok.filial, grupo, nome).run();
    return { nome, filial: ok.filial, cod: ok.sup_id };
  } catch (e) { return null; }
}
export async function onRequestPost({ request, env }) {
  const u = new URL(request.url);
  if (!env.BOT_WEBHOOK_KEY || u.searchParams.get('k') !== env.BOT_WEBHOOK_KEY) return new Response('nao autorizado', { status: 401 });
  let ev; try { ev = await request.json(); } catch { return new Response('ok'); }
  const d = ev && ev.data;
  if (!d || !d.key || d.key.fromMe) return new Response('ok');
  const jid = String(d.key.remoteJid || '');
  // 25/10/2026: mensagens chegam tambem como "@lid" (identificador anonimo do WhatsApp). Antes eram DESCARTADAS sem gravar (supervisores que escreveram ficaram sem resposta).
  // O telefone real vem em key.senderPn / key.remoteJidAlt (Evolution v2). Grupo, status e canal continuam ignorados.
  if (!/@(s\.whatsapp\.net|lid)$/.test(jid)) return new Response('ok');
  const jidTel = jid.endsWith('@lid') ? String(d.key.senderPn || d.key.remoteJidAlt || d.key.participantPn || '') : jid;
  const destino = jidTel ? jidTel.split('@')[0] : jid;   /* para responder: telefone, ou o proprio @lid se o telefone nao vier */
  const texto = String((d.message && (d.message.conversation || (d.message.extendedTextMessage && d.message.extendedTextMessage.text))) || '').trim();
  if (!texto) return new Response('ok');
  const seco = u.searchParams.get('seco') === '1';
  const cel = so(seco && u.searchParams.get('como') ? u.searchParams.get('como') : (jidTel || jid).split('@')[0]);
  await tabelas(env.DB);
  const vs = variantes(cel);
  const c = await env.DB.prepare(`SELECT * FROM bot_contatos WHERE ativo = 1 AND celular IN (${vs.map(() => '?').join(',')}) LIMIT 1`).bind(...vs).first();
  if (!seco) await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, msg_id) VALUES (?,?,?,?,?)').bind(cel, c ? c.nome : null, 'in', texto.slice(0, 2000), d.key.id || null).run();
  if (!c) {   // so responde quem esta cadastrado — EXCETO o supervisor que se apresenta com "Nome ... COD 123" (codigo da arvore do CEVEN e nome batendo)
    const novo = await cadastraPorCodigo(env, cel, texto, d.pushName);
    if (!novo) return new Response('ok');
    const boas = `Fala, ${titulo(String(novo.nome).split(' ')[0])}! Eu sou o *Jota* ⚽, o assistente do Comercial da Triunfante.\nRecebi seu pedido de acesso como supervisor *${titulo(novo.nome)}* (${novo.filial}, COD ${novo.cod}).\nAssim que a diretoria liberar, eu te aviso aqui. _Meu DNA é Triunfante!_`;
    if (!seco) { const av = `🔔 *Jota — pedido de acesso*\n${titulo(novo.nome)} (${novo.filial}, COD ${novo.cod})\nCelular: ${cel}\nLiberar na tela de contatos: ceven-cftv-matrix.pages.dev/saude`; for (const t of ['554187525605']) { try { await enviar(env, t, av); } catch (e) {} } }
    if (seco) return new Response(boas, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    const e0 = await enviar(env, destino, boas);
    await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto) VALUES (?,?,?,?)').bind(cel, novo.nome, e0.ok ? 'out' : 'erro', boas).run();
    return new Response('ok');
  }
  const B = criaBase(u.origin, env);
  let resp = null;
  const { results: hist } = await env.DB.prepare("SELECT direcao, texto FROM bot_msgs WHERE celular = ? AND direcao IN ('in','out') AND quando >= datetime('now','-6 hours') ORDER BY id DESC LIMIT 7").bind(cel).all();
  const anteriores = (hist || []).filter((h) => h.direcao === 'in').map((h) => h.texto).filter((x) => x !== texto).slice(0, 4);
  try { resp = await respostaPronta(B, c, texto, anteriores); } catch (e) { resp = null; if (seco) return new Response('ERRO: ' + String(e && e.stack || e), { status: 500 }); try { await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto) VALUES (?,?,?,?)').bind(cel, c.nome, 'debug', 'erro: ' + String(e && e.stack || e).slice(0, 1500)).run(); } catch (x) {} }
  if (!resp && seco && u.searchParams.get('sem_ia') === '1') return new Response('(sem resposta pronta)', { status: 404 });
  if (!resp) {
    const historico = (hist || []).slice(1).reverse().map((h) => ({ role: h.direcao === 'in' ? 'user' : 'assistant', content: h.texto }));
    resp = await respondeIA(env, B, c, texto, historico);
  }
  if (!resp) resp = respAjuda(c);
  if (seco) return new Response(resp, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const e = await enviar(env, destino, resp);
  await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto) VALUES (?,?,?,?)').bind(cel, c.nome, e.ok ? 'out' : 'erro', resp.slice(0, 2000)).run();
  return new Response('ok');
}
export async function onRequestGet() { return new Response('JOTA (+MIX): use POST (webhook da Evolution)', { status: 200 }); }
// exportado so para o simulador de perguntas (testes/t_jota.mjs)
export const _teste = { respostaPronta, criaBase, respClientesDia };
