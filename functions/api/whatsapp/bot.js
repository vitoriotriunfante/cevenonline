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
async function dadosDaFilial(origin, filial) {
  const out = {};
  try { const j = await fetch(`${origin}/api/saude`, { signal: AbortSignal.timeout(20000) }).then((r) => r.json()); const f = (j.filiais || []).find((x) => x.filial === filial);
    if (f) out.agora = { hora: j.hora_sp, faturado: Math.round(f.faturado || 0), pendente: Math.round(f.pendente || 0), meta_faturamento: Math.round(f.meta_fat || 0), positivados: f.positivados, meta_positivacao: f.meta_pos, digitado_hoje: Math.round(f.digitado_hoje || 0), vendedores: f.rcas }; } catch (e) {}
  try { const b = await fetch(`${origin}/dados_brasileirao.json`, { signal: AbortSignal.timeout(20000) }).then((r) => r.json());
    const f = (b.filiais || []).find((x) => x.sigla === filial); if (f) out.liga_filial = { posicao: f.pos, pontos: f.pts_tabela, vitorias: f.vitorias, empates: f.empates, derrotas: f.derrotas };
    out.liga_supervisores = (b.supervisores || []).filter((x) => x.filial === filial).map((x) => ({ supervisor: x.supervisor, posicao: x.pos, pontos: x.pts_tabela }));
    out.liga_top_vendedores = (b.vendedores || []).filter((x) => x.filial === filial).sort((x, y) => x.pos_filial - y.pos_filial).slice(0, 10).map((x) => ({ vendedor: x.nome, supervisor: x.supervisor, posicao_na_filial: x.pos_filial, pontos: x.pts_tabela })); } catch (e) {}
  try { const m = await fetch(`${origin}/dados_mix.json`, { signal: AbortSignal.timeout(20000) }).then((r) => r.json());
    out.mix_vendedores = (m.vendedores || []).filter((x) => x.filial === filial).map((x) => ({ vendedor: x.nome, supervisor: x.supervisor, clientes_que_compraram_no_mes: x.clientes, mix_por_cliente: x.mix_medio, reais_por_cliente: x.faturado_por_cliente, pct_meta_faturamento: x.pct_meta_fat, uso_do_mais_mix_pct: x.uso_pct, dados_ate: m.dados_ate })); } catch (e) {}
  return out;
}
async function respondeIA(env, origin, c, texto, historico) {
  if (!env.AI) return null;
  const filiais = c.filial ? [c.filial] : (texto.toUpperCase().match(/(ABC|API|MCD|TBE|TBL|TCA|TCG|TCV|TPA|TPH|TSJ)/g) || []);
  const dados = {}; for (const f of [...new Set(filiais)].slice(0, 2)) dados[f] = await dadosDaFilial(origin, f);
  const sys = `Você é o assistente do +MIX da Triunfante no WhatsApp. Fala português do Brasil, de forma natural, curta (até 8 linhas) e direta, como um colega de vendas experiente.
Quem fala com você: ${titulo(c.nome)}, ${c.papel}${c.filial ? ' da filial ' + c.filial : ' (diretoria, vê todas as filiais)'}${c.grupo ? ', grupo ' + c.grupo : ''}.
REGRAS: 1) Use SOMENTE os números dos DADOS abaixo. Nunca invente, estime ou arredonde para cima; se o dado não estiver aqui, diga que não tem esse dado.
2) Fale só da filial dessa pessoa${c.filial ? ' (' + c.filial + ')' : ''}. 3) Termine sempre com UMA sugestão prática do que fazer agora, baseada nos dados (ex.: vendedor com mix baixo, posição na Liga).
4) Use *negrito* do WhatsApp com moderação. Sem tabelas.${filiais.length ? '' : ' 5) Se a pessoa não disse a filial, pergunte qual.'}
DADOS (JSON): ${JSON.stringify(dados).slice(0, 12000)}`;
  const msgs = [{ role: 'system', content: sys }, ...historico, { role: 'user', content: texto }];
  try { const r = await env.AI.run(MODELO, { messages: msgs, max_tokens: 500 }); const t = String((r && (r.response || r.result)) || '').trim(); return t || null; } catch (e) { return null; }
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
