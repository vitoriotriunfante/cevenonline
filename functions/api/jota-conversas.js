// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-conversas.js   (GET /api/jota-conversas?dias=7 — seção "Conversas" da tela /contatos)
// O QUE É: todas as perguntas feitas ao JOTA e o que ele respondeu (Vitório, 25/10/2026: "vamos conseguir monitorar TODAS as conversas?
//          e as respostas que não ajudarem? como vamos monitorar isso? vc terá acesso a todas as perguntas?").
// "NÃO AJUDOU" = (a) caiu na IA genérica (não tinha resposta pronta), (b) caiu no menu de ajuda, (c) a pessoa reclamou logo depois
//          ("não foi isso", "errado", "não entendi"), (d) erro de envio. Também lista quem escreveu e NÃO está cadastrado.
// SENHA: a mesma da Gestão de Equipe (X-Equipe-Senha). Só leitura.
// =========================================================================
import { exigeSenhaEquipe } from '../_lib/senha_equipe.js';
const CORS = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Equipe-Senha', 'Cache-Control': 'no-store' };
export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }
export async function onRequestGet({ request, env }) {
  const negado = await exigeSenhaEquipe(request, env, CORS); if (negado) return negado;
  const dias = Math.min(60, Number(new URL(request.url).searchParams.get('dias') || 7));
  for (const col of ['tipo TEXT', 'ajudou INTEGER', 'nota INTEGER']) { try { await env.DB.prepare(`ALTER TABLE bot_msgs ADD COLUMN ${col}`).run(); } catch (e) { /* ja existe */ } }
  const { results } = await env.DB.prepare(`SELECT m.id, m.quando, m.celular, m.direcao, m.texto, m.tipo, m.ajudou, m.nota, c.nome, c.papel, c.filial, c.situacao, c.ativo
    FROM bot_msgs m LEFT JOIN bot_contatos c ON c.celular = m.celular WHERE m.quando >= datetime('now', ?) AND m.direcao IN ('in','out','erro') ORDER BY m.celular, m.id`).bind(`-${dias} days`).all();
  const conv = []; const pend = new Map();
  for (const r of results || []) {
    if (r.direcao === 'in') { const x = { quando: r.quando, celular: r.celular, quem: r.nome || r.celular, papel: r.papel || 'não cadastrado', filial: r.filial || '', cadastrado: !!r.nome && r.ativo === 1, pergunta: r.texto, resposta: null, tipo: r.nome ? 'sem resposta' : 'não cadastrado', ajudou: null }; conv.push(x); pend.set(r.celular, x); }
    else { const x = pend.get(r.celular); if (x && x.resposta == null) { x.resposta = String(r.texto || '').slice(0, 600); x.tipo = r.direcao === 'erro' ? 'erro de envio' : (r.tipo || 'pronta'); x.ajudou = r.ajudou; x.nota = r.nota; pend.delete(r.celular); } }
  }
  for (const x of conv) x.nao_ajudou = x.ajudou === 0 || (x.nota != null && x.nota <= 2) || ['ia', 'ajuda', 'erro de envio', 'sem resposta'].includes(x.tipo);
  const notas = conv.filter((x) => x.nota != null).map((x) => x.nota);
  let sugestoes = []; try { const r = await env.DB.prepare("SELECT quando, nome, papel, filial, texto, sobre FROM bot_sugestoes WHERE quando >= datetime('now', ?) ORDER BY id DESC LIMIT 200").bind(`-${dias} days`).all(); sugestoes = r.results || []; } catch (e) { /* tabela ainda nao existe */ }
  conv.sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
  const cad = conv.filter((x) => x.cadastrado);
  const cont = (f) => cad.filter(f).length;
  return new Response(JSON.stringify({ dias, total: cad.length, prontas: cont((x) => ['pronta', 'saudacao', 'saudacao_primeira'].includes(x.tipo) && x.ajudou !== 0), ia: cont((x) => x.tipo === 'ia'), ajuda: cont((x) => x.tipo === 'ajuda'),
    reclamadas: cont((x) => x.ajudou === 0), nao_ajudou: cont((x) => x.nao_ajudou), nao_cadastrados: conv.filter((x) => !x.cadastrado).length, notas: notas.length, nota_media: notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length * 10) / 10 : null, sugestoes, conversas: conv.slice(0, 500) }), { headers: CORS });
}
