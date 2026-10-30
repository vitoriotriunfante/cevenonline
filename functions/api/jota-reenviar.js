// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-reenviar.js   (POST /api/jota-reenviar?chave=...)
// O QUE É: reenvia a RESPOSTA CERTA de perguntas que o JOTA respondeu errado (Vitorio, 26/10/2026: "nao vai responder a Missaid? e o Allison?").
//   Corpo: { celular, perguntas: ["..."], abertura: "texto antes", ensaio: true|false }. Ensaio = so devolve o texto (para conferir antes de enviar).
//   Cada pergunta passa pelo MESMO JOTA (respostaPronta) com o perfil do contato. Grava no historico (bot_msgs, tipo 'reenvio').
// PROTECAO: chave interna (functions/_lib/chave_admin_jota.js).
// =========================================================================
import { enviar, variantes } from '../_lib/jota/base.js';
import { respostaPronta } from '../_lib/jota/entende.js';
import { criaBase } from '../_lib/jota/fontes.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
export async function onRequestPost({ request, env }) {
  if (!(await chaveAdminOk(env, request))) return new Response('nao autorizado', { status: 401 });
  let b = {}; try { b = await request.json(); } catch (e) {}
  const vs = variantes(String(b.celular || ''));
  const c = vs.length ? await env.DB.prepare(`SELECT * FROM bot_contatos WHERE ativo = 1 AND celular IN (${vs.map(() => '?').join(',')}) LIMIT 1`).bind(...vs).first() : null;
  if (!c) return new Response(JSON.stringify({ erro: 'contato nao encontrado' }), { status: 404, headers: J });
  const B = criaBase(new URL(request.url).origin, env), partes = [];
  for (const q of (b.perguntas || []).slice(0, 4)) { let r = null; try { r = await respostaPronta(B, c, String(q), []); } catch (e) { r = null; } partes.push(r ? `❓ _${q}_\n\n${String(r)}` : `❓ _${q}_\n\nsem resposta`); }
  const texto = b.texto || [b.abertura || '', ...partes].filter(Boolean).join('\n\n━━━━━━━━━━━━━━━\n\n');
  if (b.ensaio !== false) return new Response(JSON.stringify({ contato: c.nome, texto }), { headers: J });
  const e = await enviar(env, c.celular, texto);
  await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?,?,?,?,?)').bind(c.celular, c.nome, e.ok ? 'out' : 'erro', texto.slice(0, 4000), 'reenvio').run();
  return new Response(JSON.stringify({ enviado: !!e.ok, contato: c.nome, detalhe: e }), { headers: J });
}
