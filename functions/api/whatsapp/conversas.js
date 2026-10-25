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
  const [st, ins] = await Promise.all([g(`/settings/find/${inst}`), g(`/instance/fetchInstances?instanceName=${inst}`)]);
  const i0 = Array.isArray(ins.j) ? ins.j[0] : ins.j;
  return new Response(JSON.stringify({ instancia: i0 ? { nome: i0.name, conexao: i0.connectionStatus, guardados: i0._count } : null, opcoes: st.j }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
