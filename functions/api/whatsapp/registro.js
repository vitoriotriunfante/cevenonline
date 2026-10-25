// =========================================================================
// FICHA DO ARQUIVO: functions/api/whatsapp/registro.js   (POST /api/whatsapp/registro)
// O QUE É: o motor do WhatsApp (GitHub Actions) avisa aqui cada mensagem que enviou ou que falhou, para aparecer na tela
//          /contatos → Conversas (Vitório, 25/10/2026: "pq também não chega no conversas uai?").
// AUTORIZA: header X-Evo-Key igual ao segredo EVO_KEY (o GitHub já tem; sem segredo novo).
// GRAVA: bot_msgs com direcao 'motor' (enviada) ou 'motor_erro' (falhou) e tipo = ciclo (ex.: '07:45'). ~100 linhas/dia.
// NUNCA atrapalha o envio: o motor chama com timeout curto e ignora qualquer erro daqui.
// =========================================================================
import { chaveEvoValida } from '../../_lib/chave_evo.js';
export async function onRequestPost({ request, env }) {
  if (!(await chaveEvoValida(request, env))) return new Response('nao autorizado', { status: 401 });
  if (!env.DB) return new Response('sem D1', { status: 503 });
  let b = {}; try { b = await request.json(); } catch (e) { return new Response('json invalido', { status: 400 }); }
  const cel = String(b.celular || '').replace(/\D/g, '');
  if (!cel || !b.texto) return new Response('celular e texto obrigatorios', { status: 400 });
  await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?,?,?,?,?)')
    .bind(cel, b.nome || null, b.ok === false ? 'motor_erro' : 'motor', String(b.texto).slice(0, 4000), String(b.ciclo || '').slice(0, 20) || null).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}
