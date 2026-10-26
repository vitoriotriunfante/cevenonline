// =========================================================================
// FICHA DO ARQUIVO: functions/api/whatsapp/bot.js   (POST /api/whatsapp/bot?k=<BOT_WEBHOOK_KEY>)
// O QUE É: o JOTA, assistente do +MIX no WhatsApp (Vitorio, 22/10/2026: "o pessoal interagir com o +MIX: o gerente de TPH manda msg e interage com os dados da filial dele;
//          conversa natural e fluida, e alem do que perguntam nos tambem sugerimos coisas").
// FLUXO:   Evolution (numero Mais Mix Triunfante) -> webhook MESSAGES_UPSERT -> aqui.
//          1) confere a chave do webhook; ignora grupo, status e mensagem enviada pelo proprio numero
//          2) identifica QUEM mandou pelo celular (tabela bot_contatos no D1: nome, papel, filial, grupo). Numero desconhecido: nao responde nada.
//          3) entende a pergunta (respostas MONTADAS PELO CODIGO com os numeros da base = sem erro de conta); so a pergunta livre vai para a IA gratuita (Workers AI).
// ESCOPO (Vitorio, 22/10/2026: "eu sou nacional! se eu nao pergunto de uma filial especifica, vc precisa me dar todas"):
//          gerente = sempre a filial dele (e so o grupo dele em TPH/MCD); diretoria = a filial citada NA MENSAGEM, senao o BRASIL inteiro (11 filiais).
// ROTA = VAREJO (Vitorio, 22/10/2026): "vendedores de rota", visitas, eficacia e zerados contam so o varejo de campo (VJ, PET VJ, FARMA, ESP).
//          Totais de dinheiro (faturado, pendente, digitado, pedidos) somam todos.
// FONTES (mesma base da TV, nunca o CEVEN direto): /api/saude, /api/central-snapshot, /api/tv-mostra (Gestao de Equipe), /api/brasileirao-lances,
//          /api/tv-supervisores, dados_brasileirao.json (Liga), dados_mix.json (+MIX). Conhecimento: MAIS_MIX/JOTA/CONHECIMENTO.md.
// SEGREDOS (Cloudflare Pages, nunca no codigo): EVO_URL, EVO_KEY, EVO_INSTANCE, BOT_WEBHOOK_KEY.
// REGRA: nunca inventar nem estimar. Sem dado = "sem dado". Pertence ao Projeto B (WhatsApp), autorizado pelo Vitorio em 22/10/2026.
// =========================================================================
// DIVIDIDO EM 25/10/2026 (Vitório: "o arquivo do JOTA está grande demais... qual a solução?"): este arquivo só recebe a mensagem;
//   entender e responder ficam em functions/_lib/jota/ (um arquivo por assunto). Prova de que nada mudou: testes/jota_igualdade.mjs.
// =========================================================================
import { enviar, sem, so, tabelas, titulo, variantes } from '../../_lib/jota/base.js';
import { respondeIA, respostaPronta } from '../../_lib/jota/entende.js';
import { entendePorIA } from '../../_lib/jota/entende_ia.js';
import { aceitaTraducao } from '../../_lib/jota/base.js';
import { criaBase } from '../../_lib/jota/fontes.js';
import { RECLAMACAO, cadastraPorCodigo, ehSaudacao, enviarFigurinha, figurinhaPara, humaniza, primeiroNome, respSaudacao, transcreveAudio, varia } from '../../_lib/jota/persona.js';
import { respAjuda } from '../../_lib/jota/respostas/liga_mix.js';
import { respClientesDia } from '../../_lib/jota/respostas/rota.js';

export async function onRequestPost({ request, env }) {
  const u = new URL(request.url);
  if (!env.BOT_WEBHOOK_KEY || u.searchParams.get('k') !== env.BOT_WEBHOOK_KEY) return new Response('nao autorizado', { status: 401 });
  let ev; try { ev = await request.json(); } catch { return new Response('ok'); }
  const d = ev && ev.data;
  if (!d || !d.key || d.key.fromMe) return new Response('ok');
  const jid = String(d.key.remoteJid || '');
  // 25/10/2026: mensagens chegam tambem como "@lid" (identificador anonimo do WhatsApp). Antes eram DESCARTADAS sem gravar (supervisores que escreveram ficaram sem resposta).
  // O telefone real vem em key.senderPn / key.remoteJidAlt (Evolution v2). Grupo, status e canal continuam ignorados.
  if (!/@(s\.whatsapp\.net|lid)$/.test(jid)) return new Response('ok');
  const jidTel = jid.endsWith('@lid') ? String(d.key.senderPn || d.key.remoteJidAlt || d.key.participantPn || '') : jid;
  const destino = jidTel ? jidTel.split('@')[0] : jid;   /* para responder: telefone, ou o proprio @lid se o telefone nao vier */
  let texto = String((d.message && (d.message.conversation || (d.message.extendedTextMessage && d.message.extendedTextMessage.text))) || '').trim();
  let audio = null;
  if (!texto && d.message && (d.message.audioMessage || d.message.pttMessage)) { audio = await transcreveAudio(env, d); if (audio && audio.texto) texto = audio.texto; }
  if (!texto && !audio) return new Response('ok');
  const seco = u.searchParams.get('seco') === '1';
  const cel = so(seco && u.searchParams.get('como') ? u.searchParams.get('como') : (jidTel || jid).split('@')[0]);
  await tabelas(env.DB);
  const vs = variantes(cel);
  const c = await env.DB.prepare(`SELECT * FROM bot_contatos WHERE ativo = 1 AND celular IN (${vs.map(() => '?').join(',')}) LIMIT 1`).bind(...vs).first();
  if (!seco) await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, msg_id) VALUES (?,?,?,?,?)').bind(cel, c ? c.nome : null, 'in', (audio ? '[áudio] ' : '') + (texto || '(não transcrito: ' + (audio && audio.erro) + ')').slice(0, 2000), d.key.id || null).run();
  if (audio && !texto) {
    if (!c) return new Response('ok');
    const msg = audio.erro === 'longo' ? `Opa, ${titulo(String(c.nome).split(' ')[0])}! Esse áudio tem ${audio.seg} s; eu consigo ouvir até 2 minutos. Me manda em pedaços menores ou por escrito? 🎙️` : `Não consegui ouvir esse áudio agora 🎙️ Pode mandar de novo ou escrever?`;
    if (seco) return new Response(msg);
    await enviar(env, destino, msg); return new Response('ok');
  }
  if (!c) {   // so responde quem esta cadastrado — EXCETO o supervisor que se apresenta com "Nome ... COD 123" (codigo da arvore do CEVEN e nome batendo)
    const novo = await cadastraPorCodigo(env, cel, texto, d.pushName);
    if (!novo) return new Response('ok');
    const boas = `Fala, ${titulo(String(novo.nome).split(' ')[0])}! Eu sou o *Jota* ⚽, o assistente do Comercial da Triunfante.\nRecebi seu pedido de acesso como supervisor *${titulo(novo.nome)}* (${novo.filial}, COD ${novo.cod}).\nAssim que a diretoria liberar, eu te aviso aqui. _Meu DNA é Triunfante!_`;
    if (!seco) { const av = `🔔 *Jota — pedido de acesso*\n${titulo(novo.nome)} (${novo.filial}, COD ${novo.cod})\nCelular: ${cel}\nLiberar na tela de contatos: ceven-cftv-matrix.pages.dev/saude`; for (const t of ['554187525605']) { try { await enviar(env, t, av); } catch (e) {} } }
    if (seco) return new Response(boas, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    const e0 = await enviar(env, destino, boas);
    await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto) VALUES (?,?,?,?)').bind(cel, novo.nome, e0.ok ? 'out' : 'erro', boas).run();
    return new Response('ok');
  }
  const B = criaBase(u.origin, env);
  let resp = null, tipo = 'pronta';
  const tN = sem(texto);
  const jaFalou = await env.DB.prepare("SELECT COUNT(*) n, SUM(CASE WHEN direcao = 'out' AND date(quando, '-3 hours') = date('now', '-3 hours') THEN 1 ELSE 0 END) hoje FROM bot_msgs WHERE celular = ?").bind(cel).first().catch(() => ({ n: 1, hoje: 1 }));
  const primeiraVez = !jaFalou || !(jaFalou.n > 1), primeiraDoDia = !jaFalou || !(jaFalou.hoje > 0);
  // reclamacao: marca a ultima resposta como "nao ajudou" (vai para o painel de conversas)
  if (!seco && RECLAMACAO.test(tN)) { try { await env.DB.prepare("UPDATE bot_msgs SET ajudou = 0 WHERE id = (SELECT id FROM bot_msgs WHERE celular = ? AND direcao = 'out' ORDER BY id DESC LIMIT 1)").bind(cel).run(); } catch (e) {} }
  // FEEDBACK (Vitorio, 25/10/2026: "no inicio eu gostaria que as pessoas pudessem dar nota e sugestoes... se a resposta foi satisfatoria, trouxe dados corretos")
  const ultOut = await env.DB.prepare("SELECT id, texto, nota, quando FROM bot_msgs WHERE celular = ? AND direcao = 'out' ORDER BY id DESC LIMIT 1").bind(cel).first().catch(() => null);
  const ultIn = await env.DB.prepare("SELECT texto FROM bot_msgs WHERE celular = ? AND direcao = 'in' ORDER BY id DESC LIMIT 1 OFFSET 1").bind(cel).first().catch(() => null);
  const notaTxt = (texto.trim().match(/^(?:nota\s*)?([1-5])(?:\s*(?:\/\s*5|estrelas?))?[!. ]*$/i) || [])[1] || (/^\s*(👍|👍🏻|👍🏼|👍🏽)\s*$/.test(texto) ? '5' : /^\s*(👎|👎🏻|👎🏼|👎🏽)\s*$/.test(texto) ? '1' : null);
  const pediuMotivo = ultOut && /o que faltou ou veio errado/.test(ultOut.texto || '');
  const sug = (texto.match(/^\s*sugest(?:ã|a)o\s*[:\-]?\s*([\s\S]{3,})/i) || [])[1] || (pediuMotivo && !notaTxt ? texto : null);
  if (notaTxt && ultOut && ultOut.nota == null && Date.now() - Date.parse(ultOut.quando + 'Z') < 6 * 3600 * 1000) {
    const nota = Number(notaTxt);
    await env.DB.prepare('UPDATE bot_msgs SET nota = ?, ajudou = ? WHERE id = ?').bind(nota, nota >= 3 ? 1 : 0, ultOut.id).run();
    resp = nota >= 4 ? varia([`Valeu, ${primeiroNome(c)}! Nota ${nota} anotada. 💪`, `Obrigado pela nota ${nota}, ${primeiroNome(c)}! Isso me ajuda a melhorar.`], cel)
      : nota === 3 ? `Anotado, ${primeiroNome(c)}: nota 3. Se quiser, me conta o que deixaria a resposta nota 5 (escreva "sugestão: ...").`
      : `Poxa, ${primeiroNome(c)}, nota ${nota} anotada. *O que faltou ou veio errado?* Me escreve aqui que eu levo direto para o time que me treina.`;
    tipo = 'nota';
  } else if (sug) {
    await env.DB.prepare('INSERT INTO bot_sugestoes (celular, nome, papel, filial, texto, sobre) VALUES (?,?,?,?,?,?)').bind(cel, c.nome, c.papel, c.filial || '', sug.slice(0, 1500), (ultIn && ultIn.texto ? String(ultIn.texto).slice(0, 300) : '')).run();
    resp = `Anotado, ${primeiroNome(c)}! Sua sugestão foi para o time que me treina. 🙏 Obrigado por ajudar a deixar o Jota melhor.`;
    tipo = 'sugestao';
  }
  if (!resp && ehSaudacao(tN)) { resp = await respSaudacao(B, c, primeiraVez); tipo = primeiraVez ? 'saudacao_primeira' : 'saudacao'; }
  const { results: hist } = await env.DB.prepare("SELECT direcao, texto FROM bot_msgs WHERE celular = ? AND direcao IN ('in','out') AND quando >= datetime('now','-6 hours') ORDER BY id DESC LIMIT 7").bind(cel).all();
  const anteriores = (hist || []).filter((h) => h.direcao === 'in').map((h) => h.texto).filter((x) => x !== texto).slice(0, 4);
  if (!resp) try { resp = await respostaPronta(B, c, texto, anteriores); } catch (e) { resp = null; if (seco) return new Response('ERRO: ' + String(e && e.stack || e), { status: 500 }); try { await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto) VALUES (?,?,?,?)').bind(cel, c.nome, 'debug', 'erro: ' + String(e && e.stack || e).slice(0, 1500)).run(); } catch (x) {} }
  if (!resp && seco && u.searchParams.get('sem_ia') === '1') return new Response('(sem resposta pronta)', { status: 404 });
  // ENTENDER COM IA (25/10/2026): a IA traduz a pergunta para um formato que o Jota ja responde; o numero sai do codigo, nunca da IA
  if ((!resp || resp.fraca) && !(seco && u.searchParams.get('sem_ia') === '1')) {
    const ent = await entendePorIA(env, c, texto);
    if (ent) { try { const r2 = await respostaPronta(B, c, ent.pergunta, anteriores); if (aceitaTraducao(resp, r2, ent.pergunta, ent.ficha)) { resp = `_Entendi: "${ent.pergunta}"_

` + r2; tipo = 'entendida_ia'; } } catch (e) {} }
  }
  if (resp && resp.fraca) resp = String(resp);
  if (!resp) {
    const historico = (hist || []).slice(1).reverse().map((h) => ({ role: h.direcao === 'in' ? 'user' : 'assistant', content: h.texto }));
    resp = await respondeIA(env, B, c, texto, historico); if (resp) tipo = 'ia';
  }
  if (!resp) { resp = respAjuda(c); tipo = 'ajuda'; }
  if (tipo === 'pronta') resp = humaniza(resp, c, primeiraDoDia);
  if (['pronta', 'ia'].includes(tipo) && resp && !/o que faltou/.test(resp)) resp += '\n\n_Nota de 1 a 5 para essa resposta? Ou escreva "sugestão: ..."_';
  if (audio && audio.texto) resp = `🎙️ _Entendi: "${audio.texto.slice(0, 200)}"_\n\n` + resp;
  if (seco) return new Response(resp + (u.searchParams.get('fig') === '1' ? `\n\n[figurinha: ${figurinhaPara(resp, tipo) || 'nenhuma'} · tipo: ${tipo}]` : ''), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const e = await enviar(env, destino, resp);
  await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?,?,?,?,?)').bind(cel, c.nome, e.ok ? 'out' : 'erro', resp.slice(0, 4000), tipo).run();
  // figurinha (no maximo 1 a cada 2 h por pessoa)
  const fig = figurinhaPara(resp, tipo);
  if (fig && e.ok) { const ult = await env.DB.prepare("SELECT MAX(quando) q, (SELECT COUNT(*) FROM bot_msgs b WHERE b.celular = ? AND b.direcao = 'out' AND b.id > COALESCE((SELECT MAX(id) FROM bot_msgs x WHERE x.celular = ? AND x.direcao = 'figurinha'), 0)) desde FROM bot_msgs WHERE celular = ? AND direcao = 'figurinha'").bind(cel, cel, cel).first().catch(() => null);
    const ruim = /precisando reagir|Abaixo do ritmo|ERRO|devolu/i.test(resp) && !/^(saudacao)/.test(tipo);
    if (!ruim && (!ult || !ult.q || ult.desde >= 3 || Date.now() - Date.parse(ult.q + 'Z') > 2 * 3600 * 1000)) { const ok = await enviarFigurinha(env, destino, fig); if (ok) await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?,?,?,?,?)').bind(cel, c.nome, 'figurinha', fig, tipo).run(); } }
  return new Response('ok');
}
export async function onRequestGet() { return new Response('JOTA (+MIX): use POST (webhook da Evolution)', { status: 200 }); }
// exportado so para o simulador de perguntas (testes/t_jota.mjs)
export const _teste = { respostaPronta, criaBase, respClientesDia, aceitaTraducao };
