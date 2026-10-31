// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-passaporte.js
// O QUE É: Recebe o cadastro do vendedor pelo link exclusivo (/passaporte-jota),
//          salva como pendente em bot_contatos (papel = 'vendedor', ativo = 0, situacao = 'pendente')
//          e dispara imediatamente no WhatsApp corporativo do vendedor a mensagem de obrigado do Jota.
// =========================================================================
import { enviar, so, tabelas, titulo, variantes } from '../_lib/jota/base.js';

const CORS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};

const FILIAIS_VALIDAS = ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, erro: 'Banco de dados indisponível.' }), { status: 503, headers: CORS });
  }

  let b = {};
  try {
    b = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, erro: 'Dados inválidos.' }), { status: 400, headers: CORS });
  }

  const nome = String(b.nome || '').trim().toUpperCase();
  const cpfLimpo = so(b.cpf || '');
  const setor = so(b.setor || '');
  const filial = String(b.filial || '').trim().toUpperCase();
  const supervisor = String(b.supervisor || '').trim().toUpperCase();
  const indicadores = String(b.indicadores || '').trim();
  let cel = so(b.celular || '');

  if (cel.length === 10 || cel.length === 11) {
    cel = '55' + cel;
  }

  if (nome.split(/\s+/).length < 2) {
    return new Response(JSON.stringify({ ok: false, erro: 'Informe seu Nome Completo.' }), { status: 400, headers: CORS });
  }
  if (cpfLimpo.length !== 11) {
    return new Response(JSON.stringify({ ok: false, erro: 'Informe um CPF válido com 11 dígitos.' }), { status: 400, headers: CORS });
  }
  if (!setor) {
    return new Response(JSON.stringify({ ok: false, erro: 'Informe o código do seu Setor de Atendimento (RCA).' }), { status: 400, headers: CORS });
  }
  if (!FILIAIS_VALIDAS.includes(filial)) {
    return new Response(JSON.stringify({ ok: false, erro: 'Selecione uma Filial válida.' }), { status: 400, headers: CORS });
  }
  if (!supervisor || supervisor.length < 2) {
    return new Response(JSON.stringify({ ok: false, erro: 'Informe o nome do seu Supervisor.' }), { status: 400, headers: CORS });
  }
  if (!cel.startsWith('55') || cel.length < 12 || cel.length > 13) {
    return new Response(JSON.stringify({ ok: false, erro: 'Informe seu WhatsApp Corporativo válido com DDD.' }), { status: 400, headers: CORS });
  }
  if (!indicadores || indicadores.length < 5) {
    return new Response(JSON.stringify({ ok: false, erro: 'Escreva quais indicadores você gostaria de ver ou quais perguntas gostaria de ter respondidas.' }), { status: 400, headers: CORS });
  }

  await tabelas(env.DB);
  try { await env.DB.prepare('ALTER TABLE bot_contatos ADD COLUMN cpf TEXT').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE bot_contatos ADD COLUMN indicadores_desejados TEXT').run(); } catch (e) {}

  // Verifica se já existe cadastro ativo para não desativar quem já está liberado
  const vs = variantes(cel);
  const jaExiste = await env.DB.prepare(
    `SELECT celular, ativo, situacao, papel FROM bot_contatos WHERE celular IN (${vs.map(() => '?').join(',')}) LIMIT 1`
  ).bind(...vs).first().catch(() => null);

  const celChave = jaExiste ? jaExiste.celular : cel;
  const manterAtivo = jaExiste && jaExiste.ativo === 1;
  const novaSituacao = manterAtivo ? 'ativo' : 'pendente';

  await env.DB.prepare(`
    INSERT INTO bot_contatos (celular, nome, papel, filial, supervisor, rca, cpf, indicadores_desejados, ativo, situacao, atualizado_em)
    VALUES (?, ?, 'vendedor', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(celular) DO UPDATE SET
      nome = excluded.nome,
      filial = excluded.filial,
      supervisor = excluded.supervisor,
      rca = excluded.rca,
      cpf = excluded.cpf,
      indicadores_desejados = excluded.indicadores_desejados,
      atualizado_em = CURRENT_TIMESTAMP
  `).bind(celChave, nome, filial, supervisor, setor, cpfLimpo, indicadores.slice(0, 1000), manterAtivo ? 1 : 0, novaSituacao).run();

  // Grava também em bot_sugestoes para aparecer direto no painel de sugestões da diretoria
  try {
    await env.DB.prepare(
      'INSERT INTO bot_sugestoes (celular, nome, papel, filial, texto, sobre) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(celChave, nome, 'vendedor', filial, `[PASSAPORTE JOTA - INDICADORES DESEJADOS] ${indicadores.slice(0, 1000)}`, `Setor ${setor} | Sup. ${supervisor}`).run();
  } catch (e) {}

  const primeiroNome = titulo(nome.split(/\s+/)[0]);
  const cpfFmt = cpfLimpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

  const msgObrigado = [
    `Olá, *${primeiroNome}*! Aqui é o *Jota* ⚽, o assistente oficial do Comercial da Triunfante!`,
    '',
    `✅ *Obrigado pelo seu cadastro!* Já recebi os seus dados corporativos:`,
    `• *Nome Completo:* ${titulo(nome)}`,
    `• *CPF:* ${cpfFmt}`,
    `• *Setor de Atendimento:* ${setor}`,
    `• *Filial:* ${filial}`,
    `• *Supervisor:* ${titulo(supervisor)}`,
    `• *Indicadores / Perguntas desejadas:* _"${indicadores.slice(0, 300)}"_`,
    '',
    `⏳ *Assim que aprovarmos o seu acesso, você receberá aqui mesmo no WhatsApp todas as instruções para usar o Jota no seu dia a dia!* 🚀`,
    '',
    `_Jota · Meu DNA é Triunfante!_`
  ].join('\n');

  const envio = await enviar(env, celChave, msgObrigado);

  try {
    await env.DB.prepare(
      'INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?, ?, ?, ?, ?)'
    ).bind(celChave, nome, envio.ok ? 'out' : 'erro', msgObrigado, 'cadastro_passaporte').run();
  } catch (e) {}

  return new Response(JSON.stringify({
    ok: true,
    whatsapp_enviado: !!envio.ok,
    mensagem: 'Cadastro recebido com sucesso! Confira a mensagem do Jota no seu WhatsApp Corporativo.'
  }), { status: 200, headers: CORS });
}
