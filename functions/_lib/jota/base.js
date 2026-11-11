// =========================================================================
// JOTA · functions/_lib/jota/base.js
// O QUE É: utilitários comuns (R$, %, nomes, envio de texto, tabelas do JOTA, data).
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import R from '../../../public/regras.js'; import { ehFeriado } from '../feriados.js'; // regras unicas (public/regras.js)

export const so = (x) => String(x || '').replace(/\D/g, '');
export const R$ = (n) => n == null || isNaN(n) ? 'sem dado' : 'R$ ' + Math.round(n).toLocaleString('pt-BR');
export const P = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : 'sem dado');
export const N = (n) => n == null || isNaN(n) ? 'sem dado' : Math.round(n).toLocaleString('pt-BR');
export const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
export const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
export const nome2 = (n) => { const p = String(n || '').replace(/^CLT\s*-?\s*/i, '').split(' ').filter((w) => w && !/^(DE|DA|DO|DOS|DAS|E|A)$/i.test(w)); return titulo(p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0] || ''); };
// vendedor sempre com CODIGO e CANAL (sugestao do Vitorio, 25/10/2026: "identifique sempre o vendedor com COD e se ele e AS ou varejo")
export const canalCurto = R.canalCurto;
// CODIGO SEMPRE NA FRENTE (Vitorio, 26/10/2026: 'TODA vez que falar de algum vendedor ou supervisor coloque sempre o codigo na frente')
export const vn = (v) => (v && v.rca ? `${v.rca} - ${nome2(v.nome)}${canalCurto(v.canal) ? ' (' + canalCurto(v.canal) + ')' : ''}` : nome2(v && v.nome));
export const FILIAIS = ['TPH', 'ABC', 'API', 'TBL', 'TCV', 'TSJ', 'TCA', 'TBE', 'TPA', 'MCD', 'TCG'];
export const FRX = /\b(ABC|API|MCD|TBE|TBL|TCA|TCG|TCV|TPA|TPH|TSJ)\b/;
export const VAREJO = new Set(R.CANAIS_VAREJO);
// RESPOSTA FRACA (25/10/2026): resposta de 'quebra-galho' (resumo geral quando so a filial bateu, 'nao achei venda de X' com palavra solta).
// O texto e o mesmo; a etiqueta faz o webhook perguntar primeiro a IA o que a pessoa quis dizer (functions/_lib/jota/entende_ia.js).
export const fraca = (txt, tipo = 'coringa', termo = '') => { if (txt == null) return txt; const s = new String(txt); s.fraca = tipo; s.termo = termo; return s; };
// a IA pode trocar uma resposta fraca? coringa: sim, se achou algo; 'nao achei X': so se a pergunta traduzida ainda fala de X (25/10/2026: 'positivacao de Hershey'
// virava 'positivacao geral' e a resposta honesta 'nao achei Hershey' era trocada por outra coisa); sem resposta: aceita tambem um 'nao achei'.
export const aceitaTraducao = (orig, nova, pergunta, ficha) => { if (!nova) return false; if (orig == null) return !nova.fraca || nova.fraca === 'naoachei'; if (orig.fraca === 'coringa') return true;
  if (orig.fraca === 'naoachei') { if (nova.fraca) return false; const temItem = ficha && (ficha.produto || ficha.industria);
    return !temItem || (!!orig.termo && sem(pergunta).includes(sem(orig.termo).split(' ')[0])); }   /* so recusa se a IA viu produto/industria e a traducao perdeu o nome */
  return false; };
export const SUGESTAO = '🎯 *Sugestão do Jota:* ';

// celular brasileiro com e sem o 9: 5541987525605 <-> 554187525605
export function variantes(n) {
  const d = so(n); const out = new Set([d]);
  if (d.length === 13 && d.startsWith('55') && d[4] === '9') out.add(d.slice(0, 4) + d.slice(5));
  if (d.length === 12 && d.startsWith('55')) out.add(d.slice(0, 4) + '9' + d.slice(4));
  return [...out];
}
let tabelasJotaGarantidas = false;
export async function tabelas(db) {
  if (tabelasJotaGarantidas || !db) return;
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS bot_contatos (celular TEXT PRIMARY KEY, nome TEXT, papel TEXT, filial TEXT, grupo TEXT, supervisor TEXT, ativo INTEGER DEFAULT 1, criado_em TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
    for (const c of ['situacao TEXT', 'rca TEXT', 'atualizado_em TEXT', 'salvou_jota TEXT']) { try { await db.prepare(`ALTER TABLE bot_contatos ADD COLUMN ${c}`).run(); } catch (e) { /* ja existe */ } }
    await db.prepare(`CREATE TABLE IF NOT EXISTS bot_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, nome TEXT, direcao TEXT, texto TEXT, msg_id TEXT)`).run();
    await db.prepare('CREATE TABLE IF NOT EXISTS bot_sugestoes (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, nome TEXT, papel TEXT, filial TEXT, texto TEXT, sobre TEXT)').run();
    for (const col of ['tipo TEXT', 'ajudou INTEGER', 'nota INTEGER']) { try { await db.prepare(`ALTER TABLE bot_msgs ADD COLUMN ${col}`).run(); } catch (e) { /* ja existe */ } }
    // INDICES COMPLETOS DO JOTA NO D1 (31/10/2026 — elimina Full Table Scans em bot_msgs, bot_contatos e bot_sugestoes):
    await db.batch([
      db.prepare('CREATE INDEX IF NOT EXISTS idx_bot_msgs_cel_dir_id ON bot_msgs (celular, direcao, id DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_bot_msgs_cel_id ON bot_msgs (celular, id DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_bot_msgs_msgid_quando ON bot_msgs (msg_id, quando)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_bot_msgs_quando_dir ON bot_msgs (quando, direcao)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_bot_contatos_papel_filial ON bot_contatos (papel, filial, ativo)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_bot_sugestoes_quando ON bot_sugestoes (quando, id DESC)')
    ]);
    tabelasJotaGarantidas = true;
  } catch (e) {}
}
// TETO DIARIO ANTIBAN (Vitorio, 09/11/2026; banimentos de 30/10 = 743 saidas e 03/11 = 101 pessoas num dia):
// resposta a quem escreveu nas ultimas 24 h passa sempre; mensagem que o JOTA INICIA conta na cota do dia:
// no maximo WA_TETO_PESSOAS (40) pessoas diferentes e WA_TETO_MSGS (300) mensagens. Estourou = nao envia e registra.
export const TETO_PESSOAS = 40, TETO_MSGS = 300;
export async function cotaEnvio(env, d) {
  const db = env && env.DB; if (!db || !d) return { ok: true };
  try {
    const vs = variantes(d), ph = vs.map(() => '?').join(',');
    // SO RESPONDER (Vitorio, 11/11/2026: 'TUDO... EXATAMENTE TUDO QUE FOR PROATIVO NESSE PRIMEIRO MOMENTO NAO E PRA MANDAR... so vamos ser reativos'):
    // com a pausa valendo, so sai mensagem para quem escreveu nos ultimos 15 min (a resposta da pergunta dele); antes eram 24 h, o que deixava
    // passar aviso, campanha e boas-vindas para quem tinha escrito de manha. Sem pausa, volta a regra das 24 h.
    const pausa0 = await db.prepare("SELECT valor FROM config_flags WHERE chave = 'wa_pausa_proativa_ate'").first().catch(() => null);
    const emPausa = !!(pausa0 && pausa0.valor && new Date().toISOString() < String(pausa0.valor));
    const resp = await db.prepare(`SELECT 1 FROM bot_msgs WHERE celular IN (${ph}) AND direcao = 'in' AND quando > datetime('now', ?) LIMIT 1`).bind(...vs, emPausa ? '-15 minutes' : '-24 hours').first();
    if (resp) return { ok: true, resposta: true };
    if (emPausa) return { ok: false, erro: 'so resposta: pausa de mensagens proativas ate ' + pausa0.valor };
    // PAUSA POR RESTRICAO DO WHATSAPP (10/11/2026, 09h27: "nao sera possivel iniciar novas conversas"): ate a data em config_flags 'wa_pausa_proativa_ate'
    // o Jota so RESPONDE (quem escreveu nas 24 h); nada que ele inicie sai. A mensagem fica na fila ate vencer.
    const pausa = await db.prepare("SELECT valor FROM config_flags WHERE chave = 'wa_pausa_proativa_ate'").first().catch(() => null);
    if (pausa && pausa.valor && new Date().toISOString() < String(pausa.valor)) return { ok: false, erro: 'pausa: WhatsApp restringiu o inicio de conversas ate ' + pausa.valor };
    await db.prepare('CREATE TABLE IF NOT EXISTS wa_cota (dia TEXT, celular TEXT, n INTEGER DEFAULT 0, PRIMARY KEY (dia, celular))').run();
    const dia = R.hojeSP();
    const tot = await db.prepare('SELECT COUNT(*) p, COALESCE(SUM(n),0) m, SUM(celular = ?) ja FROM wa_cota WHERE dia = ?').bind(d, dia).first();
    const tetoP = Number(env.WA_TETO_PESSOAS || TETO_PESSOAS), tetoM = Number(env.WA_TETO_MSGS || TETO_MSGS);
    if ((tot.m || 0) >= tetoM) return { ok: false, erro: `teto antiban: ${tot.m} mensagens iniciadas hoje (limite ${tetoM})` };
    if (!tot.ja && (tot.p || 0) >= tetoP) return { ok: false, erro: `teto antiban: ${tot.p} pessoas abordadas hoje (limite ${tetoP})` };
    await db.prepare('INSERT INTO wa_cota (dia, celular, n) VALUES (?, ?, 1) ON CONFLICT (dia, celular) DO UPDATE SET n = n + 1').bind(dia, d).run();
    return { ok: true };
  } catch (e) { return { ok: true }; }   // falha do D1 nunca derruba a resposta
}
export async function enviar(env, numero, texto) {
  if (!env.EVO_URL || !env.EVO_KEY) return { ok: false, erro: 'EVO_URL/EVO_KEY nao configurados' };
  const s = String(numero || '').trim();
  const cfg = R.evoCfg(env);
  if (!s.endsWith('@g.us')) { const q = await cotaEnvio(env, so(s)); if (!q.ok) return { ok: false, status: 429, erro: q.erro, teto: true }; }
  if (s.endsWith('@g.us')) {
    const rG = await R.enviarTexto(cfg, s, texto);
    return { ok: rG.ok, status: rG.status, erro: rG.erro, resposta: rG.resposta };
  }
  const d = so(s);
  if (!d) return { ok: false, erro: 'numero vazio ou invalido' };
  let r = await R.enviarTexto(cfg, d, texto);
  // SERVIDOR DO WHATSAPP FORA (01/11/2026: Vitorio perguntou, o JOTA respondeu certo e o erro 530 perdeu a mensagem): tenta de novo em 5 s e 15 s. Nao repete erro 4xx (numero invalido, por exemplo).
  for (const ms of [5000, 15000]) { if (r.ok || !(Number(r.status) >= 500 || !r.status)) break; await new Promise((ok) => setTimeout(ok, ms)); r = await R.enviarTexto(cfg, d, texto); }
  if (r.ok) return { ok: true, status: r.status };
  // falha passageira da Evolution (31/10/2026: 4 respostas nao chegaram; Franco: "ja que voce nao quer responder meu bom dia"): tenta de novo antes de desistir
  if (!r.status || r.status >= 500) {
    await new Promise((ok) => setTimeout(ok, 1500));
    r = await R.enviarTexto(cfg, d, texto);
    if (r.ok) return { ok: true, status: r.status };
  }
  const alts = variantes(d).filter((v) => v !== d);
  for (const alt of alts) {
    const rAlt = await R.enviarTexto(cfg, alt, texto);
    if (rAlt.ok) return { ok: true, status: rAlt.status };
  }
  return { ok: false, status: r.status, erro: r.erro, resposta: r.resposta };
}
export const hojeSP = () => R.hojeSP();
// dias uteis (seg-sex, SEM feriado nacional: 11/11/2026, parecer do analista - 20/11 nao conta) que faltam no mes, contando hoje
export function diasUteisRestantes() {
  const [y, m, d] = hojeSP().split('-').map(Number); let n = 0;
  const fim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let i = d; i <= fim; i++) { const w = new Date(Date.UTC(y, m - 1, i)).getUTCDay(); if (w > 0 && w < 6 && !ehFeriado(`${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`)) n++; }
  return n;
}
