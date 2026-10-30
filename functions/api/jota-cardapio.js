// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-cardapio.js
// O QUE É: Envio agendado do Guia Operacional / Comandos do JOTA para os SUPERVISORES (Vitório, 29/10/2026).
//   - GET  ?k=...&previa=1           -> prévia do texto puro (sem link, com exemplos)
//   - GET  ?k=...                    -> lista de supervisores pendentes (ativos, deduplicados, que ainda não receberam)
//   - POST ?k=...&celular=55...&modo=texto|documento -> envia para UM supervisor e grava em bot_msgs (tipo 'cardapio')
//   - POST ?k=...&todos=1&modo=texto -> processa lote com intervalo seguro
// Protegido por chave (BOT_WEBHOOK_KEY, chaveEvoValida ou chaveAdminOk).
// SEM LINKS: conforme instrução direta do Vitório ("não quero que eles tenham links por agora").
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { enviar, variantes, so } from '../_lib/jota/base.js';
import R from '../../public/regras.js';

const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

// TEXTO PURO COM EXEMPLOS PRÁTICOS (SEM NENHUM LINK)
export function textoSupervisores(c) {
  const primeiroNome = titulo(String(c.nome || '').split(' ')[0]);
  const filial = (c.filial || '').toUpperCase();

  return `Bom dia, ${primeiroNome}! 🤝\n\n` +
    `Preparei um resumo prático com os principais comandos do *Jota* para você usar no dia a dia da supervisão na filial *${filial}*.\n\n` +
    `Você pode consultar os dados da sua equipe a qualquer hora aqui no WhatsApp, digitando ou por *áudio* 🎙️:\n\n` +
    `👥 *MINHA EQUIPE & ROTAS*\n` +
    `• *como está minha equipe* → faturado, pendente, positivação e visitas\n` +
    `• *zerados hoje* → quem da sua equipe ainda não vendeu hoje\n` +
    `• *quem falta visitar* → lista de clientes restantes na rota\n\n` +
    `👤 *RAIO-X DO VENDEDOR*\n` +
    `• *vendedor [código]* → ex: _vendedor 1018_ (faturado, visitas e lances)\n` +
    `• *inativos vendedor [código]* → clientes sem compra recente\n` +
    `• *curva negativa* → clientes com queda de faturamento\n\n` +
    `📦 *MIX & OPORTUNIDADES*\n` +
    `• *+mix [indústria]* → ex: _+mix Mondelez_ ou _quem compra Oreo_\n` +
    `• *pedidos bloqueados* → pedidos retidos no crédito/financeiro\n` +
    `• *cliente [código]* → limite de crédito, títulos e histórico\n\n` +
    `🏆 *CHAMPIONS TRIUNFANTE*\n` +
    `• *liga* → posição da sua filial na tabela da Liga\n` +
    `• *gols de hoje* → vendas e lances comemorados do dia\n\n` +
    `🎨 *FIGURINHAS OFICIAIS*\n` +
    `• *quais figurinhas vc tem?* → catálogo para engajar nos grupos\n\n` +
    `💡 _Dica: Você não precisa decorar o texto exato. Pode perguntar do seu jeito com suas palavras ou mandar áudio!_\n\n` +
    `_Jota · Comercial Triunfante_`;
}

// Envio de Documento HTML (se solicitado)
async function enviarDocumentoHtml(env, numero, c, texto) {
  const d = so(numero);
  if (!d) return { ok: false, erro: 'numero invalido' };
  const urlCardapio = 'https://ceven-cftv-matrix.pages.dev/cardapio.html';
  const corpo = {
    number: d,
    mediatype: 'document',
    mimetype: 'text/html',
    caption: texto,
    media: urlCardapio,
    fileName: 'Guia_de_Comandos_Jota.html'
  };
  const r = await R.evolution(R.evoCfg(env), '/message/sendMedia', corpo);
  if (r.ok) return { ok: true, status: r.status };

  const alts = variantes(d).filter((v) => v !== d);
  for (const alt of alts) {
    const rAlt = await R.evolution(R.evoCfg(env), '/message/sendMedia', { ...corpo, number: alt });
    if (rAlt.ok) return { ok: true, status: rAlt.status };
  }
  return { ok: false, status: r.status, erro: r.erro, resposta: r.resposta };
}

// Autorização segura
async function autorizado(request, env) {
  const u = new URL(request.url);
  const k = u.searchParams.get('k') || u.searchParams.get('chave') || request.headers.get('x-chave') || '';
  if (env.BOT_WEBHOOK_KEY && k === env.BOT_WEBHOOK_KEY) return true;
  if (await chaveEvoValida(request, env)) return true;
  if (await chaveAdminOk(env, request)) return true;
  return false;
}

// Lista supervisores pendentes e deduplicados
async function obterSupervisoresPendentes(env) {
  const { results: contatos } = await env.DB.prepare(
    "SELECT celular, nome, filial, papel FROM bot_contatos WHERE papel = 'supervisor' AND ativo = 1 ORDER BY filial, nome"
  ).all();

  const { results: jaEnviados } = await env.DB.prepare(
    "SELECT DISTINCT celular, nome FROM bot_msgs WHERE tipo = 'cardapio' AND direcao = 'out'"
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

    if (!porNome.has(nomeNorm)) {
      porNome.set(nomeNorm, c);
    } else {
      // prefere celular com 13 dígitos se houver duplicata
      const atual = porNome.get(nomeNorm);
      if (c.celular.length > atual.celular.length) {
        porNome.set(nomeNorm, c);
      }
    }
  }

  const lista = [...porNome.values()];
  lista.sort((a, b) => a.filial.localeCompare(b.filial) || a.nome.localeCompare(b.nome));
  return lista;
}

export async function onRequestGet({ request, env }) {
  if (!(await autorizado(request, env))) return new Response('nao autorizado', { status: 401 });
  const u = new URL(request.url);

  if (u.searchParams.get('previa') === '1') {
    return new Response(textoSupervisores({ nome: 'MISSAID MAINARDES RAMOS', filial: 'ABC' }), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  const pendentes = await obterSupervisoresPendentes(env);
  return new Response(JSON.stringify({ pendentes, total: pendentes.length }), { headers: J });
}

export async function onRequestPost({ request, env }) {
  if (!(await autorizado(request, env))) return new Response('nao autorizado', { status: 401 });
  const u = new URL(request.url);
  const cel = so(u.searchParams.get('celular'));
  const modo = u.searchParams.get('modo') === 'documento' ? 'documento' : 'texto';
  const ensaio = u.searchParams.get('ensaio') === '1';

  if (!cel) {
    return new Response(JSON.stringify({ erro: 'celular obrigatorio (?celular=55...)' }), { status: 400, headers: J });
  }

  const vs = variantes(cel);
  const c = await env.DB.prepare(
    `SELECT * FROM bot_contatos WHERE ativo = 1 AND celular IN (${vs.map(() => '?').join(',')}) LIMIT 1`
  ).bind(...vs).first();

  if (!c) {
    return new Response(JSON.stringify({ erro: 'contato nao encontrado ou inativo em bot_contatos' }), { status: 404, headers: J });
  }

  const texto = textoSupervisores(c);

  if (ensaio) {
    return new Response(JSON.stringify({ ensaio: true, contato: c.nome, filial: c.filial, modo, texto }), { headers: J });
  }

  let envio = null;
  if (modo === 'documento') {
    envio = await enviarDocumentoHtml(env, c.celular, c, texto);
    // se falhar o envio de documento, fallback imediato para texto
    if (!envio.ok) {
      console.log(`[JOTA-CARDAPIO] Falha no documento (${envio.erro}), enviando como texto...`);
      envio = await enviar(env, c.celular, texto);
    }
  } else {
    envio = await enviar(env, c.celular, texto);
  }

  if (envio.ok) {
    await env.DB.prepare(
      "INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?,?,?,?,?)"
    ).bind(c.celular, c.nome, 'out', texto, 'cardapio').run();
  }

  return new Response(JSON.stringify({
    ok: !!envio.ok,
    celular: c.celular,
    nome: c.nome,
    modo,
    detalhe: envio
  }), { headers: J });
}
