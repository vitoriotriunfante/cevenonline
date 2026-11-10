// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-contatos.js   (GET/POST /api/jota-contatos — tela /contatos)
// O QUE É: gestão dos contatos do JOTA (Vitório, 25/10/2026: "precisamos ter dentro da tela saúde os contatos dos gerentes, supervisores e vendedores
//          (segundo passo) já ligados a um setor e filial, para que eu gerencie"; "cadastro automático: aqui eu vou precisar dar o OK").
// SENHA: a mesma da Gestão de Equipe (header X-Equipe-Senha). Sem senha, nada.
// GET  -> { contatos: [...], supervisores_arvore: [{filial, sup_id, sup_nome, grupo}] }
// POST { acao: 'salvar' | 'aprovar' | 'recusar' | 'desativar' | 'ativar', celular, nome, papel, filial, grupo, supervisor, rca }
//      'aprovar' libera um pedido pendente e avisa a pessoa no WhatsApp. Toda alteração fica em bot_contatos_log.
// TABELA: bot_contatos (do JOTA, nao e esquema compartilhado) + colunas situacao ('ativo'|'pendente'|'inativo'|'recusado') e rca.
// =========================================================================
import { exigeSenhaEquipe } from '../_lib/senha_equipe.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { tabelas as garanteTabelasEIndicesJota, cotaEnvio } from '../_lib/jota/base.js';
import { confereContatos } from '../_lib/confere_gestao.js';   // inconsistencias com a Gestao de Equipe e a arvore (09/11/2026)
import R from '../../public/regras.js'; // regras unicas (public/regras.js)

const CORS = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Equipe-Senha', 'Cache-Control': 'no-store' };
const PAPEIS = ['ceo', 'diretoria', 'gerente', 'supervisor', 'vendedor', 'grupo'];
const FILIAIS = ['TPH', 'ABC', 'API', 'TBL', 'TCV', 'TSJ', 'TCA', 'TBE', 'TPA', 'MCD', 'TCG'];
const so = (x) => String(x || '').replace(/\D/g, '');
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });

function detectarFiliaisDoGrupo(nome) {
  const n = String(nome || '').toUpperCase();
  const achadas = [];
  for (const f of FILIAIS) {
    if (new RegExp(`\\b${f}\\b`).test(n)) achadas.push(f);
  }
  if (!achadas.length) {
    if (/LONDRINA/.test(n)) achadas.push('TBL');
    if (/CUIAB/.test(n)) achadas.push('TCA');
    if (/ESTEIO/.test(n) && !achadas.length) achadas.push('TBE');
  }
  return achadas;
}

async function garante(db) {
  await garanteTabelasEIndicesJota(db);
  await db.prepare('CREATE TABLE IF NOT EXISTS bot_envio_fila (id INTEGER PRIMARY KEY AUTOINCREMENT, celular TEXT, numero TEXT, nome TEXT, texto TEXT, tipo TEXT, tentativas INTEGER DEFAULT 0, criado_em TEXT DEFAULT CURRENT_TIMESTAMP)').run();
  // supervisores da arvore que NAO devem aparecer em 'Sem acesso' (gerente, inativo...): decisao do Vitorio pela tela (26/10/2026)
  await db.prepare('CREATE TABLE IF NOT EXISTS bot_sem_acesso_excluidos (filial TEXT NOT NULL, sup_id TEXT NOT NULL, sup_nome TEXT, motivo TEXT, em TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (filial, sup_id))').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS bot_contatos_log (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, acao TEXT, antes TEXT, depois TEXT)').run();
}
const situacao = (c) => c.situacao || (c.ativo ? 'ativo' : 'inativo');

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

export async function onRequestGet({ request, env }) {
  const adminOk = await chaveAdminOk(env, request);
  if (!adminOk) {
    const negado = await exigeSenhaEquipe(request, env, CORS); if (negado) return negado;
  }
  await garante(env.DB);
  const { results } = await env.DB.prepare("SELECT c.*, EXISTS (SELECT 1 FROM bot_msgs m WHERE m.celular = c.celular AND m.direcao = 'out' AND m.tipo IN ('boas_vindas_aprovacao','cadastro_passaporte','convite_vendedores','boas_vindas')) AS pedido_salvar, (length(replace(replace(replace(COALESCE(c.cpf,''),'.',''),'-',''),' ','')) = 11 AND length(COALESCE(c.indicadores_desejados,'')) >= 5) AS via_link FROM bot_contatos c ORDER BY papel, filial, nome").all();   // pedido_salvar: recebeu o pedido de salvar o Jota e responder SIM (09/11/2026)
  const { results: arv } = await env.DB.prepare('SELECT DISTINCT filial, sup_id, sup_nome FROM arvore_supervisores ORDER BY filial, sup_nome').all().catch(() => ({ results: [] }));
  const { results: uso } = await env.DB.prepare("SELECT celular, COUNT(*) n, MAX(quando) ult FROM bot_msgs WHERE direcao = 'in' GROUP BY celular").all().catch(() => ({ results: [] }));
  const U = new Map((uso || []).map((r) => [r.celular, r]));
  const { results: exc } = await env.DB.prepare('SELECT * FROM bot_sem_acesso_excluidos').all().catch(() => ({ results: [] }));
  // LINHA CORPORATIVA (Vitorio, 01/11/2026): lista da operadora no D1 (linha_corporativa, pelos 8 ultimos digitos). Sinaliza na hora de liberar: ATIVO, SUSPENSO ou null = nao corporativa.
  const { results: lc } = await env.DB.prepare('SELECT fim8, status FROM linha_corporativa').all().catch(() => ({ results: [] }));
  const { results: pil } = await env.DB.prepare('SELECT celular FROM jota_piloto').all().catch(() => ({ results: [] }));
  const PIL = new Set((pil || []).map((x) => x.celular));   // estrelinha: vendedores do piloto da proatividade (jota_piloto)
  const LC = new Map((lc || []).map((x) => [x.fim8, x.status])), linhaDe = (cel) => LC.get(String(cel || '').replace(/\D/g, '').slice(-8)) || null;
  let INC = {}; try { const mo = await (await fetch(new URL('/api/tv-mostra', request.url), { signal: AbortSignal.timeout(10000) })).json(); INC = confereContatos((results || []).map((c) => ({ ...c, situacao: situacao(c) })), mo, arv || []); } catch (e) { INC = null; }
  return j({ sem_acesso_excluidos: exc || [], conferencia_ok: !!INC, contatos: (results || []).map((c) => ({ ...c, inconsistencias: INC ? (INC[c.celular] || []) : null, situacao: situacao(c), linha_corporativa: linhaDe(c.celular), piloto: PIL.has(c.celular), perguntas: (U.get(c.celular) || {}).n || 0, ultima: (U.get(c.celular) || {}).ult || null })), supervisores_arvore: arv || [], papeis: PAPEIS, filiais: FILIAIS });
}

async function enviar(env, numero, texto) {
  if (!env.EVO_URL || !env.EVO_KEY) return false;
  const q = await cotaEnvio(env, String(numero).replace(/\D/g, '')); if (!q.ok) return false;   // teto antiban do dia
  return (await R.enviarTexto(R.evoCfg(env), numero, texto)).ok;   // antiban 09/11/2026: passava sem digitando/hash
}

export async function onRequestPost({ request, env }) {
  const adminOk = await chaveAdminOk(env, request);
  if (!adminOk) {
    const negado = await exigeSenhaEquipe(request, env, CORS); if (negado) return negado;
  }
  await garante(env.DB);
  let b; try { b = await request.json(); } catch { return j({ erro: 'json invalido' }, 400); }
  // ABA "SEM ACESSO" (26/10/2026): excluir/reincluir da lista e enviar a lista para o(s) gerente(s) ativo(s) da filial pelo WhatsApp
  if (b.acao === 'excluir_sem_acesso' || b.acao === 'reincluir_sem_acesso') {
    const f = String(b.filial || '').toUpperCase(), id = String(b.sup_id || '');
    if (!FILIAIS.includes(f) || !id) return j({ erro: 'filial e codigo obrigatorios' }, 400);
    if (b.acao === 'excluir_sem_acesso') await env.DB.prepare('INSERT OR REPLACE INTO bot_sem_acesso_excluidos (filial, sup_id, sup_nome, motivo) VALUES (?,?,?,?)').bind(f, id, String(b.sup_nome || ''), String(b.motivo || '')).run();
    else await env.DB.prepare('DELETE FROM bot_sem_acesso_excluidos WHERE filial = ? AND sup_id = ?').bind(f, id).run();
    return j({ ok: true });
  }
  if (b.acao === 'enviar_sem_acesso') {
    const f = String(b.filial || '').toUpperCase(), lista = Array.isArray(b.lista) ? b.lista.slice(0, 40) : [];
    if (!FILIAIS.includes(f) || !lista.length) return j({ erro: 'filial e lista obrigatorias' }, 400);
    const { results: ger } = await env.DB.prepare("SELECT celular, nome FROM bot_contatos WHERE papel = 'gerente' AND filial = ? AND COALESCE(situacao, CASE WHEN ativo = 1 THEN 'ativo' ELSE 'inativo' END) = 'ativo'").bind(f).all();
    if (!ger || !ger.length) return j({ erro: 'nenhum gerente ativo cadastrado para ' + f }, 404);
    const tit = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase());
    const texto = `📲 *Jota — supervisores da ${f} ainda sem acesso*\n\nPara liberar, cada um manda no WhatsApp do Jota (este número) o *nome + código de supervisor*, por exemplo: "Maria Silva, supervisora, código 45".\n\n` + lista.map((s) => `• ${tit(s.sup_nome)} (código ${s.sup_id})`).join('\n');
    const enviados = []; for (const g of ger) { if (await enviar(env, g.celular, texto)) enviados.push(g.nome); }
    return j({ ok: true, enviados });
  }
  if (b.acao === 'sincronizar_grupos') {
    const cfg = R.evoCfg(env);
    if (!cfg.url || !cfg.key) return j({ erro: 'Evolution API nao configurada' }, 500);
    const rG = await R.evolutionGet(cfg, '/group/fetchAllGroups', { getParticipants: 'false' }, 30000);
    if (!rG.ok || !Array.isArray(rG.resposta)) {
      return j({ erro: 'Falha ao consultar grupos na Evolution API', status: rG.status, detalhe: rG.erro || rG.resposta }, 502);
    }
    const gruposSincronizados = [];
    for (const g of rG.resposta) {
      const jid = String(g.id || '').trim();
      const nomeG = String(g.subject || g.name || 'Grupo WhatsApp').trim();
      if (!jid.endsWith('@g.us')) continue;
      const fils = detectarFiliaisDoGrupo(nomeG);
      const filialPrincipal = fils[0] || null;
      const grupoExtras = fils.length > 1 ? fils.join(',') : null;
      await env.DB.prepare(`INSERT INTO bot_contatos (celular, nome, papel, filial, grupo, ativo, situacao, atualizado_em) VALUES (?, ?, 'grupo', ?, ?, 1, 'ativo', CURRENT_TIMESTAMP)
        ON CONFLICT(celular) DO UPDATE SET nome=excluded.nome, papel='grupo', filial=COALESCE(excluded.filial, bot_contatos.filial), grupo=COALESCE(excluded.grupo, bot_contatos.grupo), atualizado_em=CURRENT_TIMESTAMP`)
        .bind(jid, nomeG, filialPrincipal, grupoExtras).run();
      gruposSincronizados.push({ jid, nome: nomeG, filial: filialPrincipal, filiais: fils, tamanho: g.size || null });
    }
    return j({ ok: true, total: gruposSincronizados.length, grupos: gruposSincronizados });
  }
  // CONTROLE DA MENSAGEM DE LIBERACAO pela tela (Vitorio, 02/11/2026: "eu preciso poder controlar tudo"): reenviar poe na fila com o numero atual do contato; cancelar tira da fila
  if (b.acao === 'reenviar_liberacao' || b.acao === 'cancelar_fila') {
    const celR = so(b.celular);
    await env.DB.prepare("DELETE FROM bot_envio_fila WHERE celular = ? AND tipo = 'boas_vindas_aprovacao'").bind(celR).run();
    if (b.acao === 'cancelar_fila') return j({ ok: true });
    const u = await env.DB.prepare("SELECT nome, texto FROM bot_msgs WHERE celular = ? AND tipo = 'boas_vindas_aprovacao' ORDER BY id DESC LIMIT 1").bind(celR).first();
    if (!u) return j({ erro: 'nenhuma mensagem de liberacao para esse numero' }, 404);
    await env.DB.prepare("INSERT INTO bot_envio_fila (celular, numero, nome, texto, tipo) VALUES (?, ?, ?, ?, 'boas_vindas_aprovacao')").bind(celR, celR, u.nome, String(u.texto).replace(/^\[NAO ENTREGUE[^\]]*\] /, '')).run();
    return j({ ok: true });
  }
  if (b.acao === 'disparo_individual') {
    const rawCel = String(b.celular || '').trim();
    const ehGrupo = rawCel.endsWith('@g.us');
    let cel = ehGrupo ? rawCel : so(rawCel);
    if (!ehGrupo) {
      if (cel.startsWith('0')) cel = cel.replace(/^0+/, '');
      if ((cel.length === 10 || cel.length === 11) && !cel.startsWith('55')) cel = '55' + cel;
    }
    const texto = String(b.texto || '').trim();
    const nome = String(b.nome || 'Contato').trim();
    const tipo = String(b.tipo || 'comunicado_diretoria').trim();
    const anexo = b.anexo && typeof b.anexo === 'object' ? b.anexo : null;
    const audioBase64 = b.audio_base64 ? String(b.audio_base64).trim() : '';

    const figurinha = /^\d{2}_[a-z0-9_]+$/.test(String(b.figurinha || '')) ? String(b.figurinha) : '';

    if (!cel || (!texto && !anexo && !audioBase64 && !figurinha)) {
      return j({ erro: 'celular/grupo e conteúdo (texto, anexo, áudio ou figurinha) são obrigatórios' }, 400);
    }

    if (!ehGrupo) { const q = await cotaEnvio(env, cel); if (!q.ok) return j({ ok: false, celular: cel, erro: q.erro, teto: true }, 429); }   // antiban 09/11/2026
    const cfg = R.evoCfg(env);
    const alts = [cel];
    if (!ehGrupo) {
      if (cel.length === 13 && cel.startsWith('55') && cel[4] === '9') alts.push(cel.slice(0, 4) + cel.slice(5));
      if (cel.length === 12 && cel.startsWith('55')) alts.push(cel.slice(0, 4) + '9' + cel.slice(4));
    }

    const evoTry = async (caminho, payloadBuilder) => {
      for (const num of alts) {
        const r = caminho === '/message/sendText' ? await R.enviarTexto(cfg, num, payloadBuilder(num).text, { puro: true, delayMs: payloadBuilder(num).delay }) : await R.enviarMidia(cfg, caminho, payloadBuilder(num));
        if (r.ok) return r;
      }
      // segunda passada (31/10/2026: 10 de 90 comunicados falharam na mesma manha)
      await new Promise((ok) => setTimeout(ok, 1500));
      const r2 = caminho === '/message/sendText' ? await R.enviarTexto(cfg, alts[0], payloadBuilder(alts[0]).text, { puro: true, delayMs: payloadBuilder(alts[0]).delay }) : await R.enviarMidia(cfg, caminho, payloadBuilder(alts[0]));
      return r2.ok ? r2 : { ok: false };
    };

    let ok = false;

    // 1. Se tiver anexo (imagem, pdf, planilha, vídeo, documento)
    if (anexo && anexo.base64) {
      const mtype = String(anexo.mimetype || 'application/octet-stream');
      const mediaType = mtype.startsWith('image/') ? 'image' : mtype.startsWith('video/') ? 'video' : 'document';
      const rMedia = await evoTry('/message/sendMedia', (num) => ({
        number: num,
        mediatype: mediaType,
        mimetype: mtype,
        caption: texto || '',
        media: String(anexo.base64).replace(/^data:[^;]+;base64,/, ''),
        fileName: anexo.nome || 'arquivo'
      }));
      ok = !!rMedia.ok;
    } else if (texto) {
      // 2. Se não tiver anexo, envia o texto protegido com Spintax, Zero-Width e presença humana ("composing")
      const tSeguro = R.textoAntiban(texto);
      const delay = R.delayDigitacao(tSeguro);
      const rTxt = await evoTry('/message/sendText', (num) => ({
        number: num,
        text: tSeguro,
        delay: delay,
        presence: 'composing',
        linkPreview: false
      }));
      ok = !!rTxt.ok;
    }

    // 3. Se tiver áudio gravado (nota de voz do WhatsApp), envia em seguida
    if (audioBase64) {
      const limpoAudio = audioBase64.replace(/^data:[^;]+;base64,/, '');
      const rAudio = await evoTry('/message/sendWhatsAppAudio', (num) => ({
        number: num,
        audio: limpoAudio
      }));
      if (!rAudio.ok) {
        const rFallback = await evoTry('/message/sendMedia', (num) => ({
          number: num,
          mediatype: 'audio',
          mimetype: 'audio/ogg; codecs=opus',
          media: limpoAudio,
          fileName: 'audio.ogg'
        }));
        ok = ok || !!rFallback.ok;
      } else {
        ok = true;
      }
    }

    // 4. Figurinha do Jota escolhida na tela /contatos
    if (figurinha) {
      const url = `${new URL(request.url).origin}/jota/figurinhas/${figurinha}.webp`;
      const rFig = await evoTry('/message/sendSticker', (num) => ({ number: num, sticker: url }));
      if (!texto && !anexo && !audioBase64) ok = !!rFig.ok;
      try { await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?, ?, ?, ?, ?)').bind(cel, nome, rFig.ok ? 'figurinha' : 'erro', figurinha, tipo).run(); } catch (e) {}
      if (!texto && !anexo && !audioBase64) return j({ ok, celular: cel });
    }

    const resumoLog = [
      anexo ? `[📎 Anexo: ${anexo.nome || 'arquivo'}]` : '',
      audioBase64 ? '[🎙️ Áudio de Voz]' : '',
      texto
    ].filter(Boolean).join(' ');

    try {
      await env.DB.prepare('INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?, ?, ?, ?, ?)').bind(cel, nome, ok ? 'out' : 'erro', resumoLog || '[Mídia]', tipo).run();
    } catch (e) {}
    return j({ ok, celular: cel });
  }
  const rawId = String(b.celular || '').trim();
  const ehGrpSalvar = rawId.endsWith('@g.us');
  const cel = ehGrpSalvar ? rawId : so(rawId);
  // recusar e desativar valem para qualquer cadastro: ID interno do WhatsApp (15 digitos) entrou como pedido e nao saia da lista (01/11/2026)
  if (!ehGrpSalvar && !['recusar', 'desativar'].includes(String(b.acao || '')) && (cel.length < 12 || cel.length > 13 || !cel.startsWith('55'))) return j({ erro: 'celular deve ter DDI 55 + DDD + numero (ex.: 5541999998888)' }, 400);
  const antes = await env.DB.prepare('SELECT * FROM bot_contatos WHERE celular = ?').bind(cel).first();
  const log = (acao, depois) => env.DB.prepare('INSERT INTO bot_contatos_log (celular, acao, antes, depois) VALUES (?,?,?,?)').bind(cel, acao, JSON.stringify(antes || null), JSON.stringify(depois || null)).run();
  const acao = String(b.acao || '');
  if (acao === 'salvar') {
    const papel = String(b.papel || '').toLowerCase();
    if (!PAPEIS.includes(papel)) return j({ erro: 'papel invalido' }, 400);
    const filial = (papel === 'diretoria' || papel === 'ceo') ? null : String(b.filial || '').toUpperCase() || null;
    if (papel !== 'diretoria' && papel !== 'ceo' && papel !== 'grupo' && !FILIAIS.includes(filial)) return j({ erro: 'filial obrigatoria para ' + papel }, 400);
    const nome = String(b.nome || '').trim().toUpperCase(); if (!nome) return j({ erro: 'nome obrigatorio' }, 400);
    const sup = papel === 'supervisor' ? String(b.supervisor || nome).trim().toUpperCase() : papel === 'vendedor' ? String(b.supervisor || '').trim().toUpperCase() || null : null;
    const grupo = b.grupo ? String(b.grupo).trim().toUpperCase() : null, rca = papel === 'vendedor' ? so(b.rca) || null : null;
    if (papel === 'vendedor' && !rca) return j({ erro: 'vendedor precisa do codigo RCA' }, 400);
    const sit = antes ? situacao(antes) : 'ativo';
    await env.DB.prepare(`INSERT INTO bot_contatos (celular, nome, papel, filial, grupo, supervisor, rca, ativo, situacao, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(celular) DO UPDATE SET nome=excluded.nome, papel=excluded.papel, filial=excluded.filial, grupo=excluded.grupo, supervisor=excluded.supervisor, rca=excluded.rca, atualizado_em=CURRENT_TIMESTAMP`)
      .bind(cel, nome, papel, filial, grupo, sup, rca, sit === 'ativo' ? 1 : 0, sit).run();
    await log('salvar', { nome, papel, filial, grupo, sup, rca });
    return j({ ok: true });
  }
  if (!antes) return j({ erro: 'contato nao encontrado' }, 404);
  const muda = async (ativo, sit) => { await env.DB.prepare('UPDATE bot_contatos SET ativo = ?, situacao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE celular = ?').bind(ativo, sit, cel).run(); await log(acao, { situacao: sit }); };
  if (acao === 'aprovar' || acao === 'ativar') {
    await muda(1, 'ativo');
    // MENSAGEM DE APROVACAO (desligada em 04/11/2026 apos o bloqueio; religada em 09/11/2026 pelo Vitorio): passa pelo teto diario antiban
    let avisado = false;
    if (acao === 'aprovar') {
      const p = String(antes.nome || '').split(' ')[0];
      const pNome = p.charAt(0) + p.slice(1).toLowerCase();
      // BOAS-VINDAS CURTAS E VARIADAS (Vitorio, 10/11/2026, apos a restricao do WhatsApp): 10 textos curtos; as instrucoes saem so quando o vendedor pedir (menu)
      const BV = [
        (n) => `Fala, *${n}*! Seu acesso ao *Jota* ⚽ foi liberado. Me mande *menu* quando quiser ver o que eu respondo.`,
        (n) => `*${n}*, acesso liberado! ✅ Sou o *Jota*. Escreva *menu* para ver as opções.`,
        (n) => `Oi, *${n}*! Pronto, já pode usar o *Jota* ⚽. É só me mandar *menu*.`,
        (n) => `*${n}*, tudo certo com o seu acesso ao *Jota*! 🚀 Digite *menu* para começar.`,
        (n) => `Bem-vindo(a), *${n}*! O *Jota* está liberado para você. Mande *menu* e escolha o número.`,
        (n) => `*${n}*, seu acesso foi aprovado ⚽. Quando quiser, me escreva *menu*.`,
        (n) => `Liberado, *${n}*! 👊 Sou o *Jota* (+MIX). Digite *menu* para ver o que eu faço.`,
        (n) => `Oi, *${n}*! Acesso ao *Jota* ativo. Escreva *menu* para ver as perguntas que eu respondo.`,
        (n) => `*${n}*, já pode me usar! ⚽ Mande *menu* e eu te mostro as opções.`,
        (n) => `Tudo pronto, *${n}*! O *Jota* está liberado. Para começar, digite *menu*.`
      ];
      const msgLib = antes.papel === 'vendedor'
        ? BV[Math.floor(Math.random() * BV.length)](pNome)
        : `Fala, ${pNome}! Seu acesso ao *Jota* foi liberado ⚽\nVocê vê ${antes.papel === 'supervisor' ? 'a sua equipe' : antes.papel === 'gerente' ? 'a sua filial' : 'os seus dados'}.\n\nExperimenta: "como está minha equipe?", "zerados", "faltam visitar", "vendedor Nome", "liga".\n_Meu DNA é Triunfante!_`;
      // NUNCA EM RAJADA (09/11/2026: "Aprovar todos" mandaria 10 seguidas): a mensagem entra na fila; a varredura solta
      // 2 por rodada com pausa humana e respeita o teto do dia. O bot_msgs 'out' e gravado quando sair de fato.
      try { await env.DB.prepare("DELETE FROM bot_envio_fila WHERE celular = ? AND tipo = 'boas_vindas_aprovacao'").bind(cel).run(); await env.DB.prepare("INSERT INTO bot_envio_fila (celular, numero, nome, texto, tipo) VALUES (?, ?, ?, ?, 'boas_vindas_aprovacao')").bind(cel, cel, antes.nome, msgLib).run(); avisado = 'na_fila'; } catch (e) { avisado = false; }
    }
    return j({ ok: true, avisado });
  }
  if (acao === 'recusar') { await muda(0, 'recusado'); return j({ ok: true }); }
  if (acao === 'desativar') { await muda(0, 'inativo'); return j({ ok: true }); }
  // SUSPENSO (Vitorio, 09/11/2026): acesso parado ate o vendedor responder SIM (salvar o contato). Nao manda nada: o aviso sai quando ELE escrever.
  if (acao === 'suspender') {
    await muda(0, 'suspenso');
    // AVISO DA SUSPENSAO (Vitorio, 09/11/2026: "nao envie tudo de uma vez... respeite o antispam... varie o tipo de msg"): vai para a FILA
    // (cron-varredura: 2 por rodada, pausa humana, teto do dia) com um de varios textos; o SIM reativa sozinho (bot.js).
    const p0 = String(antes.nome || '').split(' ')[0], pN = p0.charAt(0) + p0.slice(1).toLowerCase();
    const MODELOS = [
      `⚠️ *${pN}*, o seu acesso ao *Jota* foi *suspenso* porque ainda não recebemos a sua confirmação.

Para voltar: salve este número como *Jota (+MIX)* e me responda aqui com a palavra *SIM*.`,
      `Oi, *${pN}*! Aqui é o *Jota* ⚽. Seu acesso está *suspenso* até você confirmar o contato.

*Obrigatório:* salve este número na sua agenda como *Jota (+MIX)* e responda *SIM*. O acesso volta na hora.`,
      `*${pN}*, falta só um passo para liberar o *Jota* de novo: salve este número como *Jota (+MIX)* e me mande *SIM*.

Sem isso o acesso fica *suspenso*.`,
      `Atenção, *${pN}*: o *Jota* está *suspenso* para o seu número. 📵

Salve o contato como *Jota (+MIX)* e responda aqui com *SIM* para reativar.`
    ];
    const msgS = MODELOS[Math.floor(Math.random() * MODELOS.length)];
    try { await env.DB.prepare("DELETE FROM bot_envio_fila WHERE celular = ? AND tipo = 'suspenso_aviso'").bind(cel).run(); await env.DB.prepare("INSERT INTO bot_envio_fila (celular, numero, nome, texto, tipo) VALUES (?, ?, ?, ?, 'suspenso_aviso')").bind(cel, cel, antes.nome, msgS).run(); } catch (e) {}
    return j({ ok: true, aviso: 'na_fila' });
  }
  return j({ erro: 'acao invalida' }, 400);
}
