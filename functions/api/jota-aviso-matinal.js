// =========================================================================
// FICHA DO ARQUIVO: functions/api/jota-aviso-matinal.js
// O QUE É: envia o lembrete da Matinal pelo JOTA com o card modelo (Washington Rosa) para todos os grupos Locomotiva.
//   GET  ?k=<BOT_WEBHOOK_KEY>&previa=1       -> mostra o texto e os grupos alvo (nao envia)
//   GET  ?k=<BOT_WEBHOOK_KEY>                -> lista JIDs dos grupos Locomotiva pendentes
//   POST ?k=<BOT_WEBHOOK_KEY>&jid=120...@g.us -> envia para UM grupo (imagem do card + legenda) e grava em bot_msgs
// Regras: passa 100% por R.enviarMidia (public/regras.js), sem links, idempotente por (celular, tipo='aviso_matinal_locomotiva').
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
import R from '../../public/regras.js';

const MODOS = {
  matinal: {
    tipo: 'aviso_matinal_locomotiva',
    chave: 'sup:API:100',
    fileName: 'matinal_exemplo_washington.jpg',
    texto: () => (
      `{Pessoal|Time|Pessoal das filiais}, só lembrando que amanhã a *Matinal* é pelo *Jota* — usem à vontade! 💪\n\n` +
      `É só chamar o Jota no privado e mandar:\n` +
      `• *"Matinal"* (já sai o card executivo da sua equipe)\n` +
      `• *"Matinal [nome do supervisor ou filial]"* (ex.: _Matinal Washington_)\n` +
      `• Ou perguntar por áudio/texto: _"quem está zerado?"_, _"vendedor Fulano"_, _"bloqueados"_, _"liga"_\n\n` +
      `Segue acima o modelo do card da Matinal (exemplo da equipe do Washington Rosa - API), já com *Faturado + Carteira*, *Tendência*, *Positivação*, *Ontem (último dia útil)* e o ranking de prioridade. 🚀`
    )
  },
  industrias: {
    tipo: 'aviso_industrias_locomotiva',
    chave: 'ind:sup:API:100',
    fileName: 'matinal_industrias_exemplo_washington.jpg',
    texto: () => (
      `{Pessoal|Time|Pessoal das filiais}, novidade na *Matinal* pelo *Jota*: agora quando vocês pedirem *"Matinal"*, além do card da equipe, também já vai o *Card de Resumo de Indústrias* nos mesmos moldes! 🏭🔥\n\n` +
      `Acima está o exemplo da equipe do Washington Rosa (API): *Faturado + Carteira*, *Tendência*, *Positivação*, *Indústrias em risco (<80%)*, quanto falta e *Precisa/Dia* por indústria.\n\n` +
      `Amanhã na Matinal é só mandar *"Matinal"* no privado do Jota e usar à vontade! 💪`
    )
  }
};
const cfgModo = (u) => MODOS[u.searchParams.get('modo') === 'industrias' ? 'industrias' : 'matinal'];

const GRUPOS_BASE = [
  { celular: '120363425783096542@g.us', nome: 'Locomotiva Cascavel TCV' },
  { celular: '120363424997137820@g.us', nome: 'Locomotiva Cascavel ABC/ABA' },
  { celular: '120363426343875455@g.us', nome: 'Locomotiva Cuiabá - TCA' },
  { celular: '120363407763879313@g.us', nome: 'Locomotiva Londrina TBL' },
  { celular: '120363425801853559@g.us', nome: 'Locomotiva Pinhais API' },
  { celular: '120363426212015749@g.us', nome: 'Locomotiva Pinhais TPH' },
  { celular: '120363426611734651@g.us', nome: 'Locomotiva TSJ' },
  { celular: '120363420633236990@g.us', nome: 'Proj. Locomotiva Triunfante - MCD | TCG' },
  { celular: '120363406391080901@g.us', nome: 'Projeto Locomotiva Esteio - TBE' },
  { celular: '120363421891740142@g.us', nome: 'Projeto Locomotiva Esteio - TPA' }
];

async function gruposPendentes(env, tipo) {
  const { results: dbGrupos } = await env.DB.prepare(
    "SELECT DISTINCT celular, MAX(nome) AS nome FROM bot_msgs WHERE celular LIKE '%@g.us' AND UPPER(COALESCE(nome,'')) LIKE '%LOCOMOTIVA%' GROUP BY celular"
  ).all().catch(() => ({ results: [] }));
  const map = new Map();
  for (const g of GRUPOS_BASE) map.set(g.celular, g.nome);
  for (const g of dbGrupos || []) {
    if (g.celular && !map.has(g.celular)) map.set(g.celular, g.nome || g.celular);
  }
  const { results: jaEnviados } = await env.DB.prepare(
    'SELECT DISTINCT celular FROM bot_msgs WHERE tipo = ?'
  ).bind(tipo).all().catch(() => ({ results: [] }));
  const feitos = new Set((jaEnviados || []).map((x) => x.celular));
  return [...map.entries()]
    .filter(([cel]) => !feitos.has(cel))
    .map(([celular, nome]) => ({ celular, nome }));
}

export async function onRequestGet({ request, env }) {
  if (!(await autorizado(request, env))) return new Response('nao autorizado', { status: 401 });
  const u = new URL(request.url);
  const cfg = cfgModo(u);
  const pend = await gruposPendentes(env, cfg.tipo);
  if (u.searchParams.get('previa') === '1') {
    return new Response(JSON.stringify({ ok: true, tipo: cfg.tipo, chave: cfg.chave, texto: cfg.texto(), pendentes: pend }, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
  return new Response(JSON.stringify({ ok: true, tipo: cfg.tipo, pendentes: pend.map((g) => g.celular), detalhes: pend, total: pend.length }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestPost({ request, env }) {
  if (!(await autorizado(request, env))) return new Response('nao autorizado', { status: 401 });
  const u = new URL(request.url);
  const cfg = cfgModo(u);
  const jid = String(u.searchParams.get('jid') || '').trim();
  if (!jid.endsWith('@g.us')) {
    return new Response(JSON.stringify({ ok: false, erro: 'jid invalido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const pend = await gruposPendentes(env, cfg.tipo);
  const grupo = pend.find((g) => g.celular === jid);
  if (!grupo) {
    return new Response(JSON.stringify({ ok: false, motivo: 'grupo ja recebeu ou nao faz parte da lista Locomotiva' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const card = await env.DB.prepare(
    'SELECT data, png_b64 FROM matinal_cards WHERE chave = ? ORDER BY data DESC LIMIT 1'
  ).bind(cfg.chave).first();
  if (!card || !card.png_b64) {
    return new Response(JSON.stringify({ ok: false, erro: `card modelo ${cfg.chave} nao encontrado em matinal_cards` }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  const legenda = cfg.texto();
  const res = await R.enviarMidia(R.evoCfg(env), '/message/sendMedia', {
    number: grupo.celular,
    mediatype: 'image',
    mimetype: 'image/jpeg',
    media: String(card.png_b64).replace(/^data:[^;]+;base64,/, ''),
    caption: legenda,
    fileName: cfg.fileName
  });

  if (res && res.ok) {
    await env.DB.prepare(
      'INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?,?,?,?,?)'
    ).bind(grupo.celular, grupo.nome, 'out', legenda, cfg.tipo).run();
  }

  return new Response(JSON.stringify({ ok: !!(res && res.ok), tipo: cfg.tipo, jid: grupo.celular, nome: grupo.nome, cardData: card.data, status: res?.status || 0 }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
