// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-convite-vendedores.js
// O QUE É: Disparo agendado para os SUPERVISORES (31/10/2026 às 11:00 BRT)
//          orientando a enviarem o Link Exclusivo do Passaporte Jota no grupo dos vendedores.
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { enviar, variantes, so, titulo } from '../_lib/jota/base.js';

const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export function textoConviteSupervisores(c) {
  const primeiroNome = titulo(String(c.nome || '').split(' ')[0]);
  const filial = (c.filial || '').toUpperCase();
  const linkUnico = 'https://ceven-cftv-matrix.pages.dev/passaporte-jota';

  return [
    `Bom dia, *${primeiroNome}*! 🚀`,
    '',
    `Chegou a hora de conectar o seu time de vendas da *${filial}* ao *Jota* ⚽!`,
    '',
    `Copie a mensagem abaixo e *envie agora no grupo de WhatsApp dos seus vendedores*:`,
    '',
    `────────────────────`,
    `📲 *PASSAPORTE OFICIAL JOTA — COMERCIAL TRIUNFANTE* ⚽`,
    '',
    `Pessoal, acessem o link exclusivo abaixo para conectar o seu WhatsApp ao *Jota* (nosso assistente comercial inteligente):`,
    '',
    `🔗 *Link de Acesso:* ${linkUnico}`,
    '',
    `Ao abrir o link, cadastre:`,
    `• *Nome Completo*`,
    `• *CPF*`,
    `• *Setor de Atendimento (Código RCA)*`,
    `• *Filial*`,
    `• *Supervisor*`,
    `• *Quais indicadores gostaria de ver ou quais perguntas gostaria de ter respondidas* (obrigatório)`,
    '',
    `⚠️ *IMPORTANTE:* O cadastro vale *apenas para Telefone Corporativo*.`,
    `Após preencher, você receberá uma mensagem de obrigado do Jota e, assim que aprovarmos os acessos, receberá todas as instruções de uso! 🚀`,
    `────────────────────`
  ].join('\n');
}

async function autorizado(request, env) {
  const u = new URL(request.url);
  const k = u.searchParams.get('k') || u.searchParams.get('chave') || request.headers.get('x-chave') || '';
  if (env.BOT_WEBHOOK_KEY && k === env.BOT_WEBHOOK_KEY) return true;
  if (await chaveEvoValida(request, env)) return true;
  if (await chaveAdminOk(env, request)) return true;
  return false;
}

async function obterSupervisoresPendentes(env) {
  const { results: contatos } = await env.DB.prepare(
    "SELECT celular, nome, filial, papel FROM bot_contatos WHERE papel = 'supervisor' AND ativo = 1 ORDER BY filial, nome"
  ).all();

  const { results: jaEnviados } = await env.DB.prepare(
    "SELECT DISTINCT celular, nome FROM bot_msgs WHERE tipo = 'convite_vendedores' AND direcao = 'out'"
  ).all();

  const enviadosNomes = new Set((jaEnviados || []).map((m) => String(m.nome || '').trim().toUpperCase()));
  const enviadosCels = new Set();
  for (const m of (jaEnviados || [])) {
    for (const v of variantes(m.celular)) enviadosCels.add(v);
  }

  const porNome = new Map();
  for (const c of (contatos || [])) {
    const nomeNorm = String(c.nome || '').trim().toUpperCase();
    if (enviadosNomes.has(nomeNorm)) continue;
    if (enviadosCels.has(so(c.celular))) continue;
    if (!porNome.has(nomeNorm)) porNome.set(nomeNorm, c);
  }
  return [...porNome.values()];
}

export async function onRequestGet({ request, env }) {
  if (!(await autorizado(request, env))) return new Response('nao autorizado', { status: 401 });
  const u = new URL(request.url);
  if (u.searchParams.get('previa') === '1') {
    const cExemplo = { nome: 'SERGIO OLIVEIRA', filial: 'TBL' };
    return new Response(textoConviteSupervisores(cExemplo), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const pendentes = await obterSupervisoresPendentes(env);
  return new Response(JSON.stringify({ total_pendentes: pendentes.length, pendentes }), { headers: J });
}

export async function onRequestPost({ request, env }) {
  if (!(await autorizado(request, env))) return new Response('nao autorizado', { status: 401 });
  const u = new URL(request.url);
  const cel = so(u.searchParams.get('celular') || '');
  if (!cel) return new Response(JSON.stringify({ ok: false, erro: 'celular obrigatorio' }), { status: 400, headers: J });

  const vs = variantes(cel);
  const c = await env.DB.prepare(
    `SELECT celular, nome, filial, papel FROM bot_contatos WHERE celular IN (${vs.map(() => '?').join(',')}) LIMIT 1`
  ).bind(...vs).first() || { celular: cel, nome: 'Supervisor', filial: 'Triunfante', papel: 'supervisor' };

  const texto = textoConviteSupervisores(c);
  const r = await enviar(env, c.celular, texto);
  if (r.ok) {
    await env.DB.prepare(
      "INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?, ?, 'out', ?, 'convite_vendedores')"
    ).bind(c.celular, c.nome, texto).run();
  }
  return new Response(JSON.stringify({ ok: !!r.ok, celular: c.celular, nome: c.nome, status: r.status }), { headers: J });
}
