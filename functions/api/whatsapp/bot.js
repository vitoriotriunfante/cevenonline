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
async function dadosDaFilial(origin, filial, env) {
  const out = {};
  const est = (p) => (env && env.ASSETS ? env.ASSETS.fetch(new Request(origin + p)) : fetch(origin + p)).then((r) => r.json());
  const api = (p) => fetch(origin + p, { signal: AbortSignal.timeout(25000) }).then((r) => r.json());
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [saude, snap, mostra, lances, liga, mix] = await Promise.all([api('/api/saude'), api('/api/central-snapshot?filial=' + filial), api('/api/tv-mostra'), api(`/api/brasileirao-lances?dia=${hoje}&filial=${filial}`), est('/dados_brasileirao.json'), est('/dados_mix.json')].map((p) => p.catch(() => null)));
  const f = saude && (saude.filiais || []).find((x) => x.filial === filial);
  if (f) out.filial_agora = { hora: saude.hora_sp, faturado_mais_pendente: R$((f.faturado || 0) + (f.pendente || 0)), meta_mes: R$(f.meta_fat), pct_meta: P((f.faturado || 0) + (f.pendente || 0), f.meta_fat), pendente: R$(f.pendente), positivados_mes: `${f.positivados} de ${f.meta_pos} (${P(f.positivados, f.meta_pos)})`, digitado_hoje: R$(f.digitado_hoje) };
  // equipe: supervisor e grupo pela Gestao de Equipe
  const eq = new Map(); if (mostra && mostra.filiais) for (const [k, L] of Object.entries(mostra.filiais)) if (k.split('_')[0] === filial) for (const v of L) eq.set(String(v.rca), v);
  // lances de hoje por vendedor
  const lv = new Map(); for (const l of (lances && lances.lances) || []) { const k = String(l.rca); const x = lv.get(k) || {}; x[l.nivel] = (x[l.nivel] || 0) + 1; lv.set(k, x); }
  const vend = [];
  for (const [rca, r] of Object.entries((snap && snap.rcas) || {})) {
    const e = eq.get(rca); if (e && e.mostra === false) continue;
    const d = r.dashboard || {}, fi = d.financeiro || {}, po = d.positivacao || {}, pd = (r.produtividade && r.produtividade.dia) || {};
    const rot = Array.isArray(r.roteiro) ? r.roteiro.filter((c) => String(c.data_visita || '').slice(0, 10) === hoje) : [];
    const feitas = rot.filter((c) => c.checkin_horario).length;
    vend.push({ vendedor: (e && e.nome) || d.nome || 'RCA ' + rca, rca, supervisor: e ? e.supervisor : '', grupo: e ? e.grupo : '',
      pct_meta_fat: fi.meta ? +((fi.total_com_pendente || 0) / fi.meta * 100).toFixed(1) : null, faturado_mais_pendente: R$(fi.total_com_pendente), meta: R$(fi.meta),
      positivacao: `${po.realizado ?? '?'} de ${po.meta ?? '?'}`, digitado_hoje: R$(pd.dig_pedido), visitas_hoje: `${feitas} de ${rot.length}`, zerado_hoje: rot.length > 0 && !(pd.dig_pedido > 0),
      lances_hoje: lv.get(rca) || {} });
  }
  vend.sort((a, b) => (b.pct_meta_fat ?? -1) - (a.pct_meta_fat ?? -1));
  out.vendedores = vend.map((v) => ({ ...v, pct_meta_fat: v.pct_meta_fat == null ? 'sem dado' : String(v.pct_meta_fat).replace('.', ',') + '%' }));
  out.zerados_hoje = vend.filter((v) => v.zerado_hoje).map((v) => `${v.vendedor} (${v.supervisor || 'sem supervisor'}, visitas ${v.visitas_hoje})`);
  if (lances) out.lances_hoje_filial = lances.porNivel;
  // supervisores (soma dos vendedores, sem rateio)
  const sup = new Map(); for (const v of vend) { const s = v.supervisor || 'sem supervisor'; const x = sup.get(s) || { vendedores: 0, zerados: 0, penaltis: 0, gols: 0 }; x.vendedores++; if (v.zerado_hoje) x.zerados++; x.penaltis += v.lances_hoje.penalti || 0; x.gols += v.lances_hoje.gol || 0; sup.set(s, x); }
  out.supervisores_hoje = Object.fromEntries(sup);
  if (liga) { const lf = (liga.filiais || []).find((x) => x.sigla === filial); if (lf) out.liga_filial = `${lf.pos}º de 11, ${lf.pts_tabela} pontos (${lf.vitorias}V ${lf.empates}E ${lf.derrotas}D)`;
    out.liga_supervisores = (liga.supervisores || []).filter((x) => x.filial === filial).map((x) => `${x.pos}º ${x.supervisor} (${x.pts_tabela} pts)`); }
  if (mix) out.mais_mix = (mix.vendedores || []).filter((x) => x.filial === filial).map((x) => `${x.nome}: mix ${String(x.mix_medio).replace('.', ',')} produtos/cliente, ${R$(x.faturado_por_cliente)}/cliente, uso do +MIX ${x.uso_pct == null ? 'sem dado' : String(x.uso_pct).replace('.', ',') + '%'}`);
  return out;
}
async function respondeIA(env, origin, c, texto, historico) {
  if (!env.AI) return null;
  // filial citada agora ou nas ultimas mensagens (para 'e o supervisor X?' continuar na mesma filial)
  const conversa = [texto, ...historico.map((h) => h.content)].join(' ').toUpperCase();
  const filiais = c.filial ? [c.filial] : [...new Set(conversa.match(/\b(ABC|API|MCD|TBE|TBL|TCA|TCG|TCV|TPA|TPH|TSJ)\b/g) || [])];
  const dados = {}; for (const f of [...new Set(filiais)].slice(0, 2)) dados[f] = await dadosDaFilial(origin, f, env);
  try { await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto) VALUES (?,?,?,?)').bind(c.celular, c.nome, 'debug', JSON.stringify(Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, Object.keys(v)])))).run(); } catch (e) {}
  const sys = `Você é o assistente do +MIX da Triunfante no WhatsApp. Responde em português do Brasil como um gerente comercial experiente: natural, objetivo, sem enrolação.
Quem fala com você: ${titulo(c.nome)}, ${c.papel}${c.filial ? ' da filial ' + c.filial : ' (diretoria, vê todas as filiais)'}${c.grupo ? ', grupo ' + c.grupo : ''}.
COMO RESPONDER:
- Use SÓ os números dos DADOS, exatamente como estão escritos (já vêm formatados, ex.: "R$ 6.054.971", "50,3%"). Nunca invente, estime nem recalcule; se não tiver o dado, diga que não tem.
- Formato WhatsApp: *negrito* com UM asterisco de cada lado (nunca **). Uma ideia por linha. Use no máximo 10 linhas. Pode usar emoji com moderação (📊 ✅ ⚠️ 🎯).
- "Como está a filial": 1) faturado + pendente e % da meta; 2) positivação; 3) digitado hoje; 4) zerados hoje (cite até 3 nomes); 5) destaque e alerta de vendedor (maior e menor % da meta).
- Pergunta sobre vendedor ou supervisor: use a lista de vendedores e supervisores.
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
  const cel = so(jid.split('@')[0]);
  await tabelas(env.DB);
  const vs = variantes(cel);
  const c = await env.DB.prepare(`SELECT * FROM bot_contatos WHERE ativo = 1 AND celular IN (${vs.map(() => '?').join(',')}) LIMIT 1`).bind(...vs).first();
  await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, msg_id) VALUES (?,?,?,?,?)').bind(cel, c ? c.nome : null, 'in', texto.slice(0, 2000), d.key.id || null).run();
  if (!c) return new Response('ok');   // so responde quem esta cadastrado
  const primeiro = titulo(String(c.nome).split(' ')[0]);
  const { results: hist } = await env.DB.prepare("SELECT direcao, texto FROM bot_msgs WHERE celular = ? AND direcao IN ('in','out') AND quando >= datetime('now','-6 hours') ORDER BY id DESC LIMIT 7").bind(cel).all();
  const historico = (hist || []).slice(1).reverse().map((h) => ({ role: h.direcao === 'in' ? 'user' : 'assistant', content: h.texto }));
  let resp = await respondeIA(env, u.origin, c, texto, historico);
  if (!resp) {
  if (c.papel === 'diretoria' || !c.filial) {
    resp = `Oi, ${primeiro}! Sou o assistente do +MIX. Me diga a filial (ex.: *TPH*) que eu mostro como ela está agora.`;
    const fil = (texto.toUpperCase().match(/\b(ABC|API|MCD|TBE|TBL|TCA|TCG|TCV|TPA|TPH|TSJ)\b/) || [])[1];
    if (fil) resp = await resumoFilial(u.origin, fil);
  } else {
    resp = `Oi, ${primeiro}! ` + await resumoFilial(u.origin, c.filial) + `\n\n_Em breve você vai poder perguntar do seu jeito (clientes, produtos, +MIX, Liga)._`;
  }
  }
  const e = await enviar(env, cel, resp);
  await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto) VALUES (?,?,?,?)').bind(cel, c.nome, e.ok ? 'out' : 'erro', resp.slice(0, 2000)).run();
  return new Response('ok');
}
export async function onRequestGet() { return new Response('assistente +MIX: use POST (webhook da Evolution)', { status: 200 }); }
