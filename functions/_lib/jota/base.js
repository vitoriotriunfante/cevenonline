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
export async function tabelas(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_contatos (celular TEXT PRIMARY KEY, nome TEXT, papel TEXT, filial TEXT, grupo TEXT, supervisor TEXT, ativo INTEGER DEFAULT 1, criado_em TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  for (const c of ['situacao TEXT', 'rca TEXT', 'atualizado_em TEXT']) { try { await db.prepare(`ALTER TABLE bot_contatos ADD COLUMN ${c}`).run(); } catch (e) { /* ja existe */ } }
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, nome TEXT, direcao TEXT, texto TEXT, msg_id TEXT)`).run();
  await db.prepare('CREATE TABLE IF NOT EXISTS bot_sugestoes (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, nome TEXT, papel TEXT, filial TEXT, texto TEXT, sobre TEXT)').run();
  for (const col of ['tipo TEXT', 'ajudou INTEGER', 'nota INTEGER']) { try { await db.prepare(`ALTER TABLE bot_msgs ADD COLUMN ${col}`).run(); } catch (e) { /* ja existe */ } }
}
export async function enviar(env, numero, texto) {
  if (!env.EVO_URL || !env.EVO_KEY) return { ok: false, erro: 'EVO_URL/EVO_KEY nao configurados' };
  const s = String(numero || '').trim();
  if (s.endsWith('@g.us')) {
    const rG = await R.evolution(R.evoCfg(env), '/message/sendText', { number: s, text: texto });
    return { ok: rG.ok, status: rG.status, erro: rG.erro, resposta: rG.resposta };
  }
  const d = so(s);
  if (!d) return { ok: false, erro: 'numero vazio ou invalido' };
  const r = await R.evolution(R.evoCfg(env), '/message/sendText', { number: d, text: texto });
  if (r.ok) return { ok: true, status: r.status };
  const alts = variantes(d).filter((v) => v !== d);
  for (const alt of alts) {
    const rAlt = await R.evolution(R.evoCfg(env), '/message/sendText', { number: alt, text: texto });
    if (rAlt.ok) return { ok: true, status: rAlt.status };
  }
  return { ok: false, status: r.status, erro: r.erro, resposta: r.resposta };
}
export const hojeSP = () => R.hojeSP();
// dias uteis (seg-sex) que faltam no mes, contando hoje; feriados nao sao descontados (dito na resposta)
export function diasUteisRestantes() {
  const [y, m, d] = hojeSP().split('-').map(Number); let n = 0;
  const fim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let i = d; i <= fim; i++) { const w = new Date(Date.UTC(y, m - 1, i)).getUTCDay(); if (w > 0 && w < 6) n++; }
  return n;
}
