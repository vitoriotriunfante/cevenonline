// =========================================================================
// FICHA DO ARQUIVO: functions/api/whatsapp/conversas.js   (GET /api/whatsapp/conversas?k=<BOT_WEBHOOK_KEY>)
// O QUE É: SÓ as configurações da instância do WhatsApp na Evolution (quantas mensagens/contatos/conversas ela guarda e as opções da instância).
// 25/10/2026: a primeira versão lia o histórico de mensagens para achar supervisores que escreveram "Nome COD". O histórico guardado na Evolution
// é o do celular antigo (conversas PESSOAIS, fev–jul/2026) e as mensagens novas não estão sendo guardadas. Por privacidade, a leitura de mensagens
// foi REMOVIDA: este endpoint não devolve nenhuma mensagem. Protegido pela chave do webhook do JOTA. Não envia nada.
// =========================================================================
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.BOT_WEBHOOK_KEY || u.searchParams.get('k') !== env.BOT_WEBHOOK_KEY) return new Response('nao autorizado', { status: 401 });
  if (!env.EVO_URL || !env.EVO_KEY) return new Response('EVO nao configurado', { status: 503 });
  const base = String(env.EVO_URL).replace(/\/$/, ''), inst = env.EVO_INSTANCE || 'ceven-noc';
  const g = (rota) => fetch(`${base}${rota}`, { headers: { apikey: env.EVO_KEY }, signal: AbortSignal.timeout(20000) }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }));
  if (u.searchParams.get('webhook') === '1') {   /* le a configuracao do webhook; com &base64=1 liga o envio do audio dentro do aviso (25/10/2026) */
    const w = await g(`/webhook/find/${inst}`);
    if (u.searchParams.get('base64') === '1' && w.j && w.j.url) {
      const corpo = { webhook: { enabled: true, url: w.j.url, events: w.j.events || ['MESSAGES_UPSERT'], byEvents: !!w.j.webhookByEvents, base64: true } };
      const r = await fetch(`${base}/webhook/set/${inst}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.EVO_KEY }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(20000) }).then(async (x) => ({ status: x.status, j: await x.json().catch(() => null) }));
      const w2 = await g(`/webhook/find/${inst}`);
      return new Response(JSON.stringify({ antes_base64: w.j.webhookBase64, set: r.status, depois_base64: w2.j && w2.j.webhookBase64, eventos: w2.j && w2.j.events }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ enabled: w.j && w.j.enabled, base64: w.j && w.j.webhookBase64, eventos: w.j && w.j.events, url_do_jota: !!(w.j && /whatsapp\/bot/.test(w.j.url || '')) }), { headers: { 'Content-Type': 'application/json' } });
  }
  const [st, ins] = await Promise.all([g(`/settings/find/${inst}`), g(`/instance/fetchInstances?instanceName=${inst}`)]);
  const i0 = Array.isArray(ins.j) ? ins.j[0] : ins.j;
  return new Response(JSON.stringify({ instancia: i0 ? { nome: i0.name, conexao: i0.connectionStatus, guardados: i0._count } : null, opcoes: st.j }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
