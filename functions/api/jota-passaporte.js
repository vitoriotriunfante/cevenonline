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
  // CONFERE COM A GESTAO DE EQUIPE (Vitorio, 09/11/2026: "fazer apenas com o cadastro correto... relacionar mais de uma informacao e nao apenas o nome").
  // Cruza filial + RCA + nome: se a pessoa existe na Gestao com outra filial/RCA, grava o da Gestao (o digitado fica em passaporte_cadastros);
  // se nao bate com ninguem, grava como digitou e marca 'NAO CONFERE' para o Vitorio decidir na liberacao.
  let filialG = filial, setorG = setor, supG = supervisor, confere = 'NAO CONFERE: vendedor nao encontrado na Gestao de Equipe';
  try {
    const semA = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    const pal = semA(nome).split(/[^A-Z]+/).filter((w) => w.length > 2 && !/^(DOS|DAS|DES)$/.test(w));
    const bate = (v) => semA(v.nome).split(/[^A-Z]+/).filter((w) => pal.includes(w)).length >= Math.min(2, pal.length);
    const mo = await (await fetch(new URL('/api/tv-mostra', request.url), { signal: AbortSignal.timeout(10000) })).json();
    const T = []; for (const [k, L] of Object.entries(mo.filiais || {})) for (const v of L) T.push({ ...v, fil: k.split('_')[0] });
    const exato = T.find((v) => v.fil === filial && String(Number(v.rca)) === String(Number(setor)));
    if (exato && bate(exato)) { confere = 'ok'; supG = String(exato.supervisor || supervisor).toUpperCase(); setorG = String(exato.rca); }
    else {
      const cand = T.filter((v) => bate(v) && (String(Number(v.rca)) === String(Number(setor)) || v.fil === filial));
      const unico = cand.length === 1 ? cand[0] : (T.filter(bate).length === 1 ? T.filter(bate)[0] : null);
      if (unico) { filialG = unico.fil; setorG = String(unico.rca); supG = String(unico.supervisor || supervisor).toUpperCase(); confere = `corrigido pela Gestao: digitou ${filial} ${setor}, na Gestao ${unico.fil} ${unico.rca} (${unico.nome})`; }
      else if (exato) confere = `NAO CONFERE: o RCA ${setor} da ${filial} e de ${exato.nome} na Gestao`;
    }
  } catch (e) { confere = 'NAO CONFERIDO: Gestao de Equipe indisponivel'; }
  try { await env.DB.prepare('ALTER TABLE bot_contatos ADD COLUMN confere_gestao TEXT').run(); } catch (e) {}

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
  `).bind(celChave, nome, filialG, supG, setorG, cpfLimpo, indicadores.slice(0, 1000), manterAtivo ? 1 : 0, novaSituacao).run();
  try { await env.DB.prepare('UPDATE bot_contatos SET confere_gestao = ? WHERE celular = ?').bind(confere, celChave).run(); } catch (e) {}

  // REGISTRO DE CADA ENVIO DO LINK (Vitorio, 09/11/2026: 'tem que ficar registrado TODOS os dados que eles preencheram'). Nunca sobrescreve.
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS passaporte_cadastros (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, nome TEXT, cpf TEXT, rca TEXT, filial TEXT, supervisor TEXT, indicadores TEXT, origem TEXT, dados TEXT)').run();
    await env.DB.prepare('INSERT INTO passaporte_cadastros (celular, nome, cpf, rca, filial, supervisor, indicadores, origem, dados) VALUES (?,?,?,?,?,?,?,?,?)').bind(celChave, nome, cpfLimpo, setor, filial, supervisor, indicadores.slice(0, 2000), 'link', JSON.stringify({ ...b, confere_gestao: confere }).slice(0, 4000)).run();
  } catch (e) {}

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
    `⚠️ *PASSO OBRIGATÓRIO AGORA:*
Salve este número nos seus contatos agora como *Jota (+MIX)* e me responda aqui com a palavra: *SIM*.
_Sem salvar o contato na sua agenda, o WhatsApp não entrega as nossas mensagens e o seu acesso não será ativado._

⏳ *Assim que aprovarmos o seu acesso, você receberá aqui mesmo no WhatsApp todas as instruções para usar o Jota no seu dia a dia!* 🚀`,
    '',
    `_Jota · Meu DNA é Triunfante!_`
  ].join('\n');

  // O VENDEDOR FALA PRIMEIRO (Vitorio, 10/11/2026, apos a restricao do WhatsApp "nao sera possivel iniciar novas conversas"): o Jota NAO manda mais
  // mensagem para quem acabou de preencher o passaporte. A pagina mostra o botao que abre a conversa com o Jota com "SIM" ja escrito.
  void msgObrigado; void enviar;
  let numeroJota = null;
  try {
    const base = String(env.EVO_URL || '').replace(/\/$/, ''), inst = env.EVO_INSTANCE || 'ceven-noc';
    const r = await fetch(`${base}/instance/fetchInstances?instanceName=${inst}`, { headers: { apikey: env.EVO_KEY }, signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => null), i0 = Array.isArray(j) ? j[0] : j;
    numeroJota = String((i0 && (i0.ownerJid || i0.owner || i0.number)) || '').replace(/\D/g, '') || null;
  } catch (e) { numeroJota = null; }

  return new Response(JSON.stringify({
    ok: true,
    whatsapp_enviado: false,
    numero_jota: numeroJota,
    mensagem: 'Cadastro recebido! Agora toque no botão para abrir a conversa com o Jota e mande o SIM.'
  }), { status: 200, headers: CORS });
}
