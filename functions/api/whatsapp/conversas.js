// =========================================================================
// FICHA DO ARQUIVO: functions/api/whatsapp/conversas.js   (GET /api/whatsapp/conversas?k=<BOT_WEBHOOK_KEY>&dias=7)
// O QUE É: leitura (SÓ LEITURA) do histórico de conversas do número Mais Mix Triunfante na Evolution, para achar quem escreveu
//          para o JOTA antes do cadastro (Vitório, 25/10/2026: "vários supervisores responderam... nome e no final o código deles").
// PROTEGIDO pela mesma chave do webhook do JOTA. Não envia nada. Não grava nada.
// RESPOSTA: { chats: [{ numero, nome_whatsapp, mensagens: [{ quando, de_mim, texto }] }] } dos últimos N dias (máx. 30).
// =========================================================================
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.BOT_WEBHOOK_KEY || u.searchParams.get('k') !== env.BOT_WEBHOOK_KEY) return new Response('nao autorizado', { status: 401 });
  if (!env.EVO_URL || !env.EVO_KEY) return new Response('EVO nao configurado', { status: 503 });
  const dias = Math.min(30, Number(u.searchParams.get('dias') || 7));
  const base = String(env.EVO_URL).replace(/\/$/, ''), inst = env.EVO_INSTANCE || 'ceven-noc';
  const evo = (rota, corpo) => fetch(`${base}${rota}/${inst}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.EVO_KEY }, body: JSON.stringify(corpo || {}), signal: AbortSignal.timeout(25000) }).then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => null) }));
  const desde = Math.floor(Date.now() / 1000) - dias * 86400;
  if (u.searchParams.get('recebidas') === '1') {   /* todas as mensagens RECEBIDAS desde N dias, direto pela data (a lista de conversas nao atualiza) */
    const r0 = await evo('/chat/findMessages', { where: {}, offset: 500, page: 1 });
    const pags = (r0.j && r0.j.messages && r0.j.messages.pages) || 1, arr = [];
    for (let pg = pags; pg >= Math.max(1, pags - 5); pg--) { const r = await evo('/chat/findMessages', { where: {}, offset: 500, page: pg }); arr.push(...((r.j && r.j.messages && r.j.messages.records) || [])); }
    const r = r0;
    const soCod = u.searchParams.get('so_cod') === '1';   /* privacidade: so mensagens com "COD <numero>" (o historico tem conversas pessoais) */
    const out = arr.map((x) => ({ quando: new Date(Number(x.messageTimestamp) * 1000).toISOString(), jid: x.key && x.key.remoteJid, tel: x.key && (x.key.senderPn || x.key.remoteJidAlt || ''), nome: x.pushName || '', texto: String((x.message && (x.message.conversation || (x.message.extendedTextMessage && x.message.extendedTextMessage.text))) || '').slice(0, 300) }))
      .filter((x) => x.texto && /@(s.whatsapp.net|lid)$/.test(String(x.jid)) && x.quando >= new Date(desde * 1000).toISOString() && (!soCod || /COD(IGO)?\.?\s*-?\s*\d{1,4}|^\s*\d{1,4}\s*$/i.test(x.texto))).sort((a, b) => a.quando.localeCompare(b.quando));
    const ts = arr.map((x) => Number(x.messageTimestamp) || 0).filter(Boolean).sort((a, b) => a - b);
    return new Response(JSON.stringify({ total: r.j && r.j.messages && r.j.messages.total, paginas: pags, lidas: arr.length, mais_antiga: ts.length ? new Date(ts[0] * 1000).toISOString() : null, mais_nova: ts.length ? new Date(ts[ts.length - 1] * 1000).toISOString() : null, mensagens: out }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  if (u.searchParams.get('config') === '1') {   /* so leitura: configuracoes da instancia (25/10/2026) */
    const g = (rota) => fetch(`${base}${rota}`, { headers: { apikey: env.EVO_KEY }, signal: AbortSignal.timeout(20000) }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }));
    const [st, ins] = await Promise.all([g(`/settings/find/${inst}`), g(`/instance/fetchInstances?instanceName=${inst}`)]);
    const i0 = Array.isArray(ins.j) ? ins.j[0] : ins.j;
    return new Response(JSON.stringify({ settings: st, instancia: i0 ? { name: i0.name, connectionStatus: i0.connectionStatus, integration: i0.integration, _count: i0._count, Setting: i0.Setting } : ins }).slice(0, 4000), { headers: { 'Content-Type': 'application/json' } });
  }
  const chats = await evo('/chat/findChats', {});
  const lista = Array.isArray(chats.j) ? chats.j : [];
  if (u.searchParams.get('contatos') === '1') {   /* agenda do aparelho conectado: quem foi salvo com "COD" no nome (25/10/2026) */
    let r = await evo('/chat/findContacts', { where: {} }); if (!Array.isArray(r.j) || !r.j.length) r = await evo('/chat/findContacts', {});
    if (u.searchParams.get('cru') === '1') return new Response(JSON.stringify({ status: r.status, amostra: Array.isArray(r.j) ? r.j.slice(0, 3) : r.j }).slice(0, 3000), { headers: { 'Content-Type': 'application/json' } });
    const L = Array.isArray(r.j) ? r.j : [];
    const lim = (x) => String(x || '');
    const achados = L.map((c) => ({ jid: lim(c.remoteJid || c.id), nome: lim(c.pushName || c.name || c.verifiedName || c.notify), salvo: lim(c.name || c.savedName || '') }))
      .filter((c) => /COD/i.test(c.nome + ' ' + c.salvo));
    return new Response(JSON.stringify({ total: L.length, com_cod: achados.length, campos: L[0] ? Object.keys(L[0]) : [], achados }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  if (u.searchParams.get('datas') === '1') { const ts = lista.map((c) => ({ jid: c.remoteJid, ult: Number(c.lastMessage && c.lastMessage.messageTimestamp) || 0, up: c.updatedAt })).sort((a, b) => b.ult - a.ult).slice(0, 15); return new Response(JSON.stringify({ desde, ts }), { headers: { 'Content-Type': 'application/json' } }); }
  if (u.searchParams.get('amostra') === '1') { const c0 = lista.find((c) => String(c.remoteJid || c.id || '').endsWith('@s.whatsapp.net')) || {}; const m0 = await evo('/chat/findMessages', { where: { key: { remoteJid: c0.remoteJid || c0.id } }, limit: 2 }); return new Response(JSON.stringify({ chat: c0, mensagens: m0 }).slice(0, 4000), { headers: { 'Content-Type': 'application/json' } }); }
  const out = [];
  for (const c of lista) {
    const jid = String(c.remoteJid || c.id || '');
    if (!/@(s.whatsapp.net|lid)$/.test(jid)) continue;   /* @lid = formato anonimo novo do WhatsApp */
    const ult = Number(c.lastMessage && c.lastMessage.messageTimestamp) || Math.floor(Date.parse(c.updatedAt || 0) / 1000) || 0;
    if (ult < desde) continue;   /* conversa parada antes do periodo: nem consulta */
    const m = await evo('/chat/findMessages', { where: { key: { remoteJid: jid } }, offset: 1000, page: 1 });
    const arr = (m.j && (m.j.messages && m.j.messages.records)) || (Array.isArray(m.j) ? m.j : []);
    const msgs = arr.map((x) => ({ quando: Number(x.messageTimestamp) || 0, de_mim: !!(x.key && x.key.fromMe), texto: String((x.message && (x.message.conversation || (x.message.extendedTextMessage && x.message.extendedTextMessage.text))) || '').slice(0, 400), nome: x.pushName || '' }))
      .filter((x) => x.quando >= desde && x.texto).sort((a, b) => a.quando - b.quando);
    if (!msgs.length) continue;
    const pn = (arr.find((x) => x.key && (x.key.senderPn || x.key.remoteJidAlt)) || {}).key || {};
    out.push({ telefone: String(pn.senderPn || pn.remoteJidAlt || '').split('@')[0], numero: jid.split('@')[0], nome_whatsapp: c.pushName || c.name || (msgs.find((x) => !x.de_mim && x.nome) || {}).nome || '', mensagens: msgs.map((x) => ({ quando: new Date(x.quando * 1000).toISOString(), de_mim: x.de_mim, texto: x.texto })) });
  }
  return new Response(JSON.stringify({ dias, total_chats: lista.length, com_mensagem: out.length, chats: out, diag: { findChats: chats.status } }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
