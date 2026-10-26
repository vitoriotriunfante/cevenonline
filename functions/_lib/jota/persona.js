// =========================================================================
// JOTA · functions/_lib/jota/persona.js
// O QUE É: jeito de falar do JOTA: saudação, figurinhas, áudio, cadastro por código.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import R from '../../../public/regras.js'; // regras unicas (public/regras.js)
import { N, hojeSP, sem, titulo } from './base.js';
import { diasUteisMes } from './respostas/gestao.js';

// ---------- PERSONA (MAIS_MIX/JOTA/PERSONA Claude Online.md; Vitorio 25/10/2026: "ta muito direto... quero uma persona... figurinhas... precisa ser mais HUMANO") ----------
export const FIG = (n) => `https://ceven-cftv-matrix.pages.dev/jota/figurinhas/${n}.webp`;
export function horaSP() { return R.horaSP(); }
export const diaSemana = () => new Date(hojeSP() + 'T12:00:00Z').getUTCDay();
export const cumprimento = () => { const h = horaSP(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
export const primeiroNome = (c) => titulo(String(c.nome || '').split(' ')[0]);
// tempo de jogo (persona: linguagem da Champions so quando cabe)
export function tempoDeJogo() { const h = horaSP(), d = diaSemana(); if (d === 0) return 'dia de folga'; if (h < 7) return 'antes do apito'; if (h < 10) return 'bola rolando'; if (h < 12) return 'primeiro tempo'; if (h < 14) return 'intervalo'; if (h < 17) return 'segundo tempo'; if (h < 19) return 'reta final'; return 'fim de jogo'; }
// escolhe uma frase diferente por pessoa e por hora (nao repete sempre a mesma)
export const varia = (lista, chave) => { let h = 0; const k = String(chave || '') + hojeSP() + horaSP(); for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return lista[h % lista.length]; };
// manchete pessoal: o numero que importa para QUEM pergunta (filial, grupo, equipe ou Brasil) + posicao na Liga
export async function manchete(B, c) {
  try {
    const s = await B.saude(); const F = (s && s.filiais) || [];
    let pct = null, nome = '', liga = '';
    if (c.papel === 'diretoria' || !c.filial) { const t = F.reduce((a, f) => ({ fat: a.fat + (f.faturado || 0), meta: a.meta + (f.meta_fat || 0) }), { fat: 0, meta: 0 }); pct = t.meta ? t.fat / t.meta * 100 : null; nome = 'O grupo'; }
    else if (c.papel === 'gerente' && !c.grupo) { const f = F.find((x) => x.filial === c.filial); if (f) pct = f.meta_fat ? f.faturado / f.meta_fat * 100 : null; nome = 'A ' + c.filial; }
    if (c.filial) { const lg = await B.liga(); const lf = lg && (lg.filiais || []).find((x) => x.sigla === c.filial); if (lf) liga = `${lf.pos}º na Champions`; }
    if (pct == null && !liga) return '';
    const { tot, pass } = diasUteisMes(); const esp = tot ? pass / tot * 100 : 0;
    const tom = pct == null ? '' : pct >= esp ? ' 📈 acima do ritmo' : pct >= esp * 0.9 ? `, jogo apertado (o calendário pede ${esp.toFixed(0)}%)` : `, abaixo do ritmo (o calendário pede ${esp.toFixed(0)}%)`;
    return [pct != null ? `${nome} está com *${pct.toFixed(1).replace('.', ',')}%* da meta${tom}` : '', liga].filter(Boolean).join(' · ') + '.';
  } catch (e) { return ''; }
}
export const ehSaudacao = (t) => /^(BOM DIA|BOA TARDE|BOA NOITE|OI+|OLA|E AI|EAI|FALA|SALVE|OPA|HEY|PICO ?PICO)( (JOTA|NOVAMENTE|DE NOVO|PESSOAL|TIME|TUDO BEM|TUDO BOM|BELEZA|MEU AMIGO|AMIGO|CHEFE))*[ !.,?]*$/.test(t);
export async function respSaudacao(B, c, primeiraVez) {
  const n = primeiroNome(c), d = diaSemana(), fds = d === 0 || d === 6;
  const papel = c.papel === 'diretoria' ? 'nas 11 filiais' : c.papel === 'gerente' ? `na ${c.filial}` : c.papel === 'supervisor' ? 'na sua equipe' : 'nos seus números';
  const ola = primeiraVez ? `${cumprimento()}, ${n}! Eu sou o *Jota*, o reforço do Comercial da Triunfante. Prazer! 💪`
    : varia([`${cumprimento()}, ${n}! Bom te ver por aqui.`, `${cumprimento()}, ${n}! Tudo certo por aí?`, `Opa, ${n}! ${cumprimento()}.`, `${cumprimento()}, ${n}! Pronto pra mais um dia de jogo?`], c.celular);
  const L = [ola];
  const m = await manchete(B, c); if (m) L.push(m);
  if (fds) L.push(d === 0 ? 'Hoje é domingo, as filiais estão paradas. Amanhã às 6h tudo volta a andar. Aproveita o descanso! 🙌' : 'Sábado tem rota mais curta: só algumas equipes rodam.');
  L.push('', varia([`Tô de olho ${papel}. Por onde quer começar?`, `O que você quer ver ${papel.replace(/^n/, 'n')}?`, `Me diz o que precisa que eu busco ${papel}.`], n),
    fds ? '• "como fechou sexta?"' : '• "como estamos?"', '• "zerados" · "quanto falta pra meta"', '• "liga" · "+mix"', '', '_A sua confiança é meu compromisso. Seu tempo, minha prioridade._');
  return L.join('\n');
}
// figurinha que combina com a resposta (no maximo 1 a cada 2 h por pessoa: figurinha demais vira spam)
export function figurinhaPara(resp, tipo) {
  if (tipo === 'saudacao_primeira') return '01_oi_eu_sou_o_jota';
  if (tipo === 'saudacao') return horaSP() < 12 ? '03_bom_dia_time' : '02_conta_comigo';
  const r = String(resp || '');
  if (/Zerados hoje[^\n]*\*[1-9]/.test(r)) return '13_zerado_nao';
  if (/Meta batida[^\n]*\*[1-9]|Golaço/.test(r)) return '07_meta_batida';
  if (/Champions Triunfante|Liga AS/.test(r)) return '06_golaco';
  if (/Relatório das 18:30|fechamento/i.test(r)) return '08_fechou_o_dia';
  if (/^🧺|\+MIX —/.test(r)) return '15_olha_o_mais_mix';
  if (/Rota de hoje|faltam \*\d/.test(r)) return '18_proximo_cliente';
  if (/quanto falta|Ritmo da meta|Abaixo do ritmo/i.test(r)) return '12_bora_destravar';
  if (/^👥 \*Positivação/.test(r)) return '05_bora_positivar';
  if (/sem dado|não tenho|Não consegui|ainda não tenho/i.test(r) && r.length < 400) return '20_sem_dado_agora';
  return null;
}
export async function enviarFigurinha(env, numero, nome) {
  if (!env.EVO_URL || !env.EVO_KEY || !nome) return false;
  return (await R.evolution(R.evoCfg(env), '/message/sendSticker', { number: numero, sticker: FIG(nome) })).ok;
}
// abertura humana: na primeira resposta do dia, chama pelo nome
export function humaniza(resp, c, primeiraDoDia) {
  if (!resp || !primeiraDoDia) return resp;
  const n = primeiroNome(c), tj = tempoDeJogo();
  const abre = varia([`${cumprimento()}, ${n}! Já separei pra você:`, `${cumprimento()}, ${n}! ${tj.charAt(0).toUpperCase() + tj.slice(1)} por aqui. Olha só:`, `Fala, ${n}! ${cumprimento()}. Vamos lá:`, `${cumprimento()}, ${n}! Buscando os números agora mesmo:`], c.celular);
  return abre + '\n\n' + resp;
}
// MONITORAMENTO (Vitorio: "vamos conseguir monitorar TODAS as conversas? e as respostas que nao ajudarem?"): toda resposta grava o TIPO
// (pronta | ia | ajuda | saudacao | cadastro | erro) e reclamacao logo depois ("nao foi isso", "errado", "nao entendi") marca a resposta anterior como NAO AJUDOU.
export const RECLAMACAO = /N(A|Ã)O (FOI|ERA|E) ISSO|NAO ENTENDI|NAO ENTENDEU|ERRAD|NAO AJUDOU|NAO RESPONDEU|DIVAGOU|NADA A VER|NAO TEM NADA|VOCE NAO|VC NAO|PERGUNTEI OUTRA|NAO PERGUNTEI|REPET|DE NOVO ISSO|INUTIL|NAO SERVE/;
// AUDIO (Vitorio, 25/10/2026: "da para colocar para receber audio?"): baixa o audio da Evolution e transcreve com o Whisper da Cloudflare (Workers AI,
// mesmo plano; ~200 min/dia cabem na cota gratis). Audio > 120 s nao e transcrito (custo). A transcricao vira a pergunta normal.
export async function transcreveAudio(env, d) {
  const am = d.message && (d.message.audioMessage || d.message.pttMessage);
  if (!am) return null;
  const seg = Number(am.seconds || 0);
  if (seg > 120) return { erro: 'longo', seg };
  if (!env.AI || !env.EVO_URL || !env.EVO_KEY) return { erro: 'sem_ia' };
  let b64 = d.message.base64 || null;
  if (!b64) {
    const r = await R.evolution(R.evoCfg(env), '/chat/getBase64FromMediaMessage', { message: { key: d.key, message: d.message, messageTimestamp: d.messageTimestamp }, convertToMp4: false }, 25000);
    const j = r.resposta; b64 = j && (j.base64 || (j.data && j.data.base64)) || null;
  }
  if (!b64) return { erro: 'download' };
  try { const out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: String(b64).replace(/^data:[^,]+,/, ''), language: 'pt' }); const txt = String((out && (out.text || out.transcription_info && out.text)) || '').trim(); return txt ? { texto: txt, seg } : { erro: 'vazio' }; }
  catch (e) { return { erro: 'whisper', detalhe: String(e && e.message || e).slice(0, 200) }; }
}
// CADASTRO AUTOMATICO DE SUPERVISOR (Vitorio, 25/10/2026: "vai achar um padrao: o nome e no final o codigo deles, ex.: Washington COD 100").
// Regra: o numero do codigo tem que existir na arvore do CEVEN (arvore_supervisores.sup_id) E o primeiro nome do supervisor tem que aparecer na mensagem
// (ou no nome do WhatsApp). Senao, nada acontece (numero desconhecido continua sem resposta). Gerente e diretoria so por cadastro manual.
export async function cadastraPorCodigo(env, cel, texto, pushName) {
  try {
    const t = sem(texto + ' ' + (pushName || ''));
    // 26/10/2026: supervisores se apresentaram como "Setor 72", "Equipe 33", "codigo 1037", "39 - Nome" e ficaram SEM RESPOSTA. Aceita todos os jeitos;
    // o nome pode estar em mensagem anterior (mandam picado). Cada numero candidato e conferido na arvore do CEVEN pelo nome.
    const nums = new Set();
    for (const re of [/\b(?:COD(?:IGO)?|SETOR|EQUIPE|COORDENADOR|SUPERVISOR|SUP)\.?\s*(?:DE\s+VENDAS\s*)?(?:N[O°º]?\.?\s*)?[-:]?\s*(\d{1,4})\b/g, /(?:^|\n)\s*(\d{1,4})\s*[-–]\s*[A-Z]/g, /\b(\d{1,4})\s+(?:TBE|TBL|TPH|TCV|ABC|TCA|MCD|TCG|API|TPA|TSJ)\b/g, /\bSETOR\s+(\d{1,4})\s+D[AO]\b/g]) { let mm; const tt = sem(String(texto)); while ((mm = re.exec(tt))) nums.add(mm[1]); }
    if (/^\d{1,4}$/.test(String(texto).trim())) nums.add(String(texto).trim());
    if (!nums.size) return null;
    let nomes = t;
    { const ant = await env.DB.prepare("SELECT texto FROM bot_msgs WHERE celular = ? AND direcao = 'in' ORDER BY id DESC LIMIT 4").bind(cel).all(); nomes += ' ' + sem((ant.results || []).map((x) => x.texto).join(' ')); }
    const { results } = await env.DB.prepare(`SELECT DISTINCT filial, sup_id, sup_nome FROM arvore_supervisores WHERE sup_id IN (${[...nums].map(() => '?').join(',')})`).bind(...nums).all();
    const ok = (results || []).find((r) => { const p = sem(r.sup_nome).replace(/^CLT\s*-?\s*/, '').split(/\s+/); return p[0] && nomes.includes(p[0]) && (p.length < 2 || p.slice(1).some((w) => w.length > 2 && nomes.includes(w))); });
    if (!ok) return null;
    const nome = String(ok.sup_nome).replace(/^CLT\s*-?\s*/i, '').trim();
    let grupo = null;
    try { const mo = await (await fetch('https://ceven-cftv-matrix.pages.dev/api/tv-mostra', { signal: AbortSignal.timeout(10000) })).json(); for (const [k, L] of Object.entries(mo.filiais || {})) for (const v of L) if (k.split('_')[0] === ok.filial && sem(v.supervisor) === sem(nome) && v.grupo) grupo = v.grupo; } catch (e) {}
    // PRECISA DO OK DO VITORIO (25/10/2026): entra como PENDENTE (ativo = 0); quem libera e a tela de contatos. Nunca reativa nem rebaixa quem ja existe.
    const ja = await env.DB.prepare('SELECT ativo FROM bot_contatos WHERE celular = ?').bind(cel).first();
    if (ja) return null;
    await env.DB.prepare("INSERT INTO bot_contatos (celular, nome, papel, filial, grupo, supervisor, ativo, situacao) VALUES (?,?,?,?,?,?,0,'pendente')").bind(cel, nome, 'supervisor', ok.filial, grupo, nome).run();
    return { nome, filial: ok.filial, cod: ok.sup_id };
  } catch (e) { return null; }
}
