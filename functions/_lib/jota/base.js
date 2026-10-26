// =========================================================================
// JOTA · functions/_lib/jota/base.js
// O QUE É: utilitários comuns (R$, %, nomes, envio de texto, tabelas do JOTA, data).
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import R from '../../../public/regras.js'; // regras unicas (public/regras.js)

export const so = (x) => String(x || '').replace(/\D/g, '');
export const R$ = (n) => n == null || isNaN(n) ? 'sem dado' : 'R$ ' + Math.round(n).toLocaleString('pt-BR');
export const P = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : 'sem dado');
export const N = (n) => n == null || isNaN(n) ? 'sem dado' : Math.round(n).toLocaleString('pt-BR');
export const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
export const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
export const nome2 = (n) => { const p = String(n || '').replace(/^CLT\s*-?\s*/i, '').split(' ').filter((w) => w && !/^(DE|DA|DO|DOS|DAS|E|A)$/i.test(w)); return titulo(p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0] || ''); };
// vendedor sempre com CODIGO e CANAL (sugestao do Vitorio, 25/10/2026: "identifique sempre o vendedor com COD e se ele e AS ou varejo")
export const canalCurto = R.canalCurto;
export const vn = (v) => (v && v.rca ? `${nome2(v.nome)} (${v.rca}${canalCurto(v.canal) ? ' · ' + canalCurto(v.canal) : ''})` : nome2(v && v.nome));
export const FILIAIS = ['TPH', 'ABC', 'API', 'TBL', 'TCV', 'TSJ', 'TCA', 'TBE', 'TPA', 'MCD', 'TCG'];
export const FRX = /\b(ABC|API|MCD|TBE|TBL|TCA|TCG|TCV|TPA|TPH|TSJ)\b/;
export const VAREJO = new Set(R.CANAIS_VAREJO);
export const SUGESTAO = '🎯 *Sugestão do Jota:* ';

// celular brasileiro com e sem o 9: 5541987525605 <-> 554187525605
export function variantes(n) {
  const d = so(n); const out = new Set([d]);
  if (d.length === 13 && d.startsWith('55') && d[4] === '9') out.add(d.slice(0, 4) + d.slice(5));
  if (d.length === 12 && d.startsWith('55')) out.add(d.slice(0, 4) + '9' + d.slice(4));
  return [...out];
}
export async function tabelas(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_contatos (celular TEXT PRIMARY KEY, nome TEXT, papel TEXT, filial TEXT, grupo TEXT, supervisor TEXT, ativo INTEGER DEFAULT 1, criado_em TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  for (const c of ['situacao TEXT', 'rca TEXT', 'atualizado_em TEXT']) { try { await db.prepare(`ALTER TABLE bot_contatos ADD COLUMN ${c}`).run(); } catch (e) { /* ja existe */ } }
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, nome TEXT, direcao TEXT, texto TEXT, msg_id TEXT)`).run();
  await db.prepare('CREATE TABLE IF NOT EXISTS bot_sugestoes (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, nome TEXT, papel TEXT, filial TEXT, texto TEXT, sobre TEXT)').run();
  for (const col of ['tipo TEXT', 'ajudou INTEGER', 'nota INTEGER']) { try { await db.prepare(`ALTER TABLE bot_msgs ADD COLUMN ${col}`).run(); } catch (e) { /* ja existe */ } }
}
export async function enviar(env, numero, texto) {
  if (!env.EVO_URL || !env.EVO_KEY) return { ok: false, erro: 'EVO_URL/EVO_KEY nao configurados' };
  const r = await R.evolution(R.evoCfg(env), '/message/sendText', { number: numero, text: texto });
  return { ok: r.ok, status: r.status };
}
export const hojeSP = () => R.hojeSP();
// dias uteis (seg-sex) que faltam no mes, contando hoje; feriados nao sao descontados (dito na resposta)
export function diasUteisRestantes() {
  const [y, m, d] = hojeSP().split('-').map(Number); let n = 0;
  const fim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let i = d; i <= fim; i++) { const w = new Date(Date.UTC(y, m - 1, i)).getUTCDay(); if (w > 0 && w < 6) n++; }
  return n;
}
