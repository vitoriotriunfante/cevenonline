// =========================================================================
// JOTA · functions/_lib/jota/analista_senior.js
// Agente 2 — Analista Sênior Multi-IA para Gerentes, Diretoria e CEO:
//   Monta Dossiê 360° com dados reais do D1 (Resumo, Hoje, Supervisores, Liga,
//   Top Indústrias do gerot_vendas, Bloqueados/Cortes do pedido_status e
//   Aprendizados de campo) e roteia em cascata pelas melhores IAs disponíveis:
//   1) Gemini 2.5 Pro -> 2) Gemini 2.5 Flash -> 3) OpenAI GPT-4o ->
//   4) Anthropic Claude -> 5) Cloudflare Workers AI (Llama 3.3 70B).
//   Sempre validado por confereIA() para garantir zero números inventados.
// =========================================================================
import { hojeSP, R$, N, titulo } from './base.js';
import { confereIA } from './confere_ia.js';
import { nomeForn } from './respostas/metas_industria.js';
import { carregarContextoAprendido } from './aprendizado.js';

const MODELO_WORKERS_AI = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

async function resolveChave(env, envKeys, flagKey) {
  for (const k of envKeys) {
    if (env && env[k]) return String(env[k]).trim();
  }
  if (env?.DB && flagKey) {
    try {
      const r = await env.DB.prepare('SELECT valor FROM config_flags WHERE chave = ?').bind(flagKey).first();
      if (r && r.valor) return String(r.valor).trim();
    } catch {}
  }
  return '';
}

async function montarComplemento360(env, escIA) {
  const db = env?.DB;
  if (!db) return '';
  const hoje = hojeSP();
  const mes = hoje.slice(0, 7);
  const filiais = Array.isArray(escIA?.filiais) ? escIA.filiais : [];
  const qs = filiais.map(() => '?').join(',');
  const temFil = filiais.length > 0 && !escIA.nacional;

  const [filGerotRows, supGerotRows, indRows, bloqRows, aprendizados] = await Promise.all([
    (temFil
      ? db.prepare(`SELECT filial, dados FROM gerot_filial_mes WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...filiais)
      : db.prepare('SELECT filial, dados FROM gerot_filial_mes WHERE mes = ?').bind(mes)
    ).all().catch(() => ({ results: [] })),
    (temFil
      ? db.prepare(`SELECT filial, supervisor, dados FROM gerot_supervisor_mes WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...filiais)
      : db.prepare('SELECT filial, supervisor, dados FROM gerot_supervisor_mes WHERE mes = ?').bind(mes)
    ).all().catch(() => ({ results: [] })),
    (temFil
      ? db.prepare(`SELECT filial, dados FROM gerot_vendas WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...filiais)
      : db.prepare('SELECT filial, dados FROM gerot_vendas WHERE mes = ?').bind(mes)
    ).all().catch(() => ({ results: [] })),
    (temFil
      ? db.prepare(`SELECT status, COUNT(*) qtd, SUM(valor) vlr FROM pedido_status WHERE filial IN (${qs}) AND data_pedido >= date('now', '-3 hours', '-7 days') AND status IN ('BLOQUEADO','CANCELADO') GROUP BY status`).bind(...filiais)
      : db.prepare("SELECT status, COUNT(*) qtd, SUM(valor) vlr FROM pedido_status WHERE data_pedido >= date('now', '-3 hours', '-7 days') AND status IN ('BLOQUEADO','CANCELADO') GROUP BY status")
    ).all().catch(() => ({ results: [] })),
    carregarContextoAprendido(db, 6)
  ]);

  let gMeta = 0, gFat = 0, gCart = 0, gPos = 0, gMetaPos = 0;
  const gFiliais = [];
  for (const r of filGerotRows.results || []) {
    let d = {};
    try { d = JSON.parse(r.dados || '{}'); } catch { continue; }
    const meta = Number(d['Meta (R$)']) || 0, fat = Number(d['Faturado líquido (R$)']) || 0, cart = Number(d['Carteira pendente (R$)']) || 0;
    const pos = Number(d['Positivação (filial + CNPJ)']) || 0, metaPos = Number(d['Meta de positivação'] ?? d['Meta clientes']) || 0;
    gMeta += meta; gFat += fat; gCart += cart; gPos += pos; gMetaPos += metaPos;
    gFiliais.push({ filial: r.filial, meta, fat, cart, vend: fat + cart, pctFat: meta ? (fat / meta) * 100 : 0, pctVend: meta ? ((fat + cart) / meta) * 100 : 0 });
  }
  gFiliais.sort((a, b) => a.pctVend - b.pctVend);

  const gSups = [];
  for (const r of supGerotRows.results || []) {
    let d = {};
    try { d = JSON.parse(r.dados || '{}'); } catch { continue; }
    const meta = Number(d['Meta (R$)']) || 0, fat = Number(d['Faturado líquido (R$)']) || 0, cart = Number(d['Carteira pendente (R$)']) || 0;
    if (meta <= 0) continue;
    gSups.push({ filial: r.filial, sup: r.supervisor, meta, fat, cart, vend: fat + cart, pctVend: ((fat + cart) / meta) * 100 });
  }
  gSups.sort((a, b) => a.pctVend - b.pctVend);

  const gerotResumoTxt = gMeta > 0 ? [
    `=== RESUMO OFICIAL GEROT (${escIA.nome} · FONTE PRINCIPAL) ===`,
    `Meta: ${R$(gMeta)} | Faturado: ${R$(gFat)} (${(gFat / gMeta * 100).toFixed(1)}%) | Carteira Pendente: ${R$(gCart)} | Faturado + Carteira: ${R$(gFat + gCart)} (${((gFat + gCart) / gMeta * 100).toFixed(1)}%) | Positivação: ${N(gPos)}${gMetaPos ? ' / ' + N(gMetaPos) : ''}`,
    `Filiais (pior % Fat+Cart primeiro): ${gFiliais.map((f) => `${f.filial} ${f.pctVend.toFixed(1)}% (Fat ${R$(f.fat)} + Cart ${R$(f.cart)} / Meta ${R$(f.meta)})`).join(' | ')}`,
    gSups.length ? `Piores Supervisores (% Fat+Cart): ${gSups.slice(0, 8).map((s) => `${s.sup} (${s.filial}) ${s.pctVend.toFixed(1)}% (${R$(s.vend)}/${R$(s.meta)})`).join(' | ')}` : ''
  ].filter(Boolean).join('\n') : '';

  const porInd = new Map();
  for (const r of indRows.results || []) {
    let d = {};
    try { d = JSON.parse(r.dados || '{}'); } catch { continue; }
    const ind = nomeForn(d.Fornecedor);
    if (!ind) continue;
    const cur = porInd.get(ind) || { ind, meta: 0, fat: 0, pend: 0, pos: 0 };
    cur.meta += Number(d['Meta (R$)']) || 0;
    cur.fat += Number(d['Faturado líquido (R$)']) || 0;
    cur.pend += Number(d['Carteira pendente (R$)']) || 0;
    cur.pos += Number(d['Positivação (filial + CNPJ)']) || 0;
    porInd.set(ind, cur);
  }
  const topInd = [...porInd.values()]
    .filter((x) => x.meta > 0)
    .map((x) => ({ ...x, vend: x.fat + x.pend, pct: ((x.fat + x.pend) / x.meta) * 100, gap: Math.max(0, x.meta - (x.fat + x.pend)) }))
    .sort((a, b) => a.pct - b.pct || b.meta - a.meta)
    .slice(0, 12);

  const indTxt = topInd.length
    ? '=== INDÚSTRIAS COM MAIOR GAP NO ESCOPO (GEROT) ===\n' + topInd.map((x) => `• ${x.ind}: Meta ${R$(x.meta)} | Fat+Cart ${R$(x.vend)} (${x.pct.toFixed(1)}%) | Falta ${R$(x.gap)} | Posit ${N(x.pos)}`).join('\n')
    : '';

  const bloqTxt = (bloqRows.results || []).length
    ? '=== PEDIDOS BLOQUEADOS / CANCELADOS (ÚLTIMOS 7 DIAS) ===\n' + (bloqRows.results || []).map((b) => `• ${b.status}: ${N(b.qtd)} pedidos (${R$(b.vlr || 0)})`).join('\n')
    : '';

  const aprTxt = aprendizados
    ? `=== APRENDIZADOS RECENTES DO CAMPO (CURADOR JOTA) ===\n${aprendizados}`
    : '';

  return [gerotResumoTxt, indTxt, bloqTxt, aprTxt].filter(Boolean).join('\n\n');
}

async function chamarGemini(apiKey, model, promptCompleto, thinkingBudget = 1024) {
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(24000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: promptCompleto }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 6000, thinkingConfig: { thinkingBudget } }
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  const cand = data?.candidates?.[0];
  if (!cand || cand.finishReason === 'MAX_TOKENS') return null;
  const txt = (cand?.content?.parts || []).map((p) => p.text || '').join('').trim();
  return txt || null;
}

async function chamarOpenAI(apiKey, sysPrompt, userPrompt) {
  if (!apiKey) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(22000),
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.2,
      max_tokens: 2200,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content || '').trim() || null;
}

async function chamarAnthropic(apiKey, sysPrompt, userPrompt) {
  if (!apiKey) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    signal: AbortSignal.timeout(22000),
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 2200,
      temperature: 0.2,
      system: sysPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  return String(data?.content?.[0]?.text || '').trim() || null;
}

export async function respondeAnalistaSenior({ env, B, c, texto, historico, escIA, dossieBase, fonteIA, dossieComplementar }) {
  const extra360 = await montarComplemento360(env, escIA);
  // Se o GEROT oficial esta disponivel, NAO mistura com resumo/meta/faturado antigos do CEVEN
  const usaSoGerot = extra360.includes('=== RESUMO OFICIAL GEROT');
  const dossie = [extra360, usaSoGerot ? (dossieComplementar || '') : dossieBase].filter(Boolean).join('\n\n').slice(0, 16000);
  const horaBrt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false });

  const sysPrompt = `Você é o JOTA Sênior ⚽, Consultor Executivo e Analista Comercial de Elite do Grupo Triunfante (+MIX & CEVEN).
Você está atendendo: ${titulo(c.nome)} (Cargo: ${String(c.papel || '').toUpperCase()}${c.filial ? ' — Filial ' + c.filial : ' — Visão Nacional Brasil 11 Filiais'}${c.grupo ? ' · Grupo ' + c.grupo : ''}).

REGRAS DE OURO (INVIOLÁVEIS):
1. Responda a perguntas complexas ("cabeludas") com profundidade analítica: cruzando equipes/supervisores, indústrias, bloqueios, positivação e ritmo diário.
2. Use o bloco "RESUMO OFICIAL GEROT" como fonte principal para Meta, Faturado, Carteira Pendente e % de atingimento (nunca misture com números antigos do CEVEN quando houver GEROT).
3. NUNCA invente números, percentuais ou clientes que não estejam no DOSSIÊ abaixo. Se faltar algum dado granular para responder 100%, diga exatamente o que falta e entregue a melhor análise possível com os números reais disponíveis.
3. Agora é ${hojeSP().split('-').reverse().join('/')}, ${horaBrt}h em Brasília: use a saudação correta.
4. Formatação WhatsApp: use *negrito* com UM asterisco apenas em títulos e números-chave. Estruture em:
   - 📊 *Diagnóstico Executivo* (causa-raiz baseada nos números)
   - 🔍 *Onde está o Gap / Alavanca* (equipes, indústrias ou bloqueios prioritários)
   - 🎯 *Plano de Ação Imediato* (3 a 5 ações práticas com meta numérica real)

DOSSIÊ 360° EM TEMPO REAL (${escIA.nome}):
${dossie}`;

  const histTxt = (historico || []).map((h) => `${h.role === 'user' ? 'Executivo' : 'Jota'}: ${h.content}`).join('\n');
  const userPrompt = `${histTxt ? '--- HISTÓRICO RECENTE ---\n' + histTxt + '\n\n' : ''}--- PERGUNTA DO EXECUTIVO ---\n"${texto}"`;
  const fullPrompt = `${sysPrompt}\n\n${userPrompt}`;
  const fonteValidacao = fonteIA(dossie);

  const limpar = (s) => s.trim().replace(/\*\*/g, '*').replace(/^#+\s*/gm, '');
  const validar = (txt) => txt && confereIA(txt, fonteValidacao).ok;

  const [geminiKey, openaiKey, anthropicKey] = await Promise.all([
    resolveChave(env, ['GEMINI_API_KEY', 'GOOGLE_AI_KEY'], 'gemini_api_key'),
    resolveChave(env, ['OPENAI_API_KEY'], 'openai_api_key'),
    resolveChave(env, ['ANTHROPIC_API_KEY'], 'anthropic_api_key')
  ]);

  // 1. Gemini 2.5 Pro (raciocinio profundo)
  try {
    const rPro = await chamarGemini(geminiKey, 'gemini-2.5-pro', fullPrompt, 2048);
    if (validar(rPro)) return { texto: limpar(rPro), modelo: 'gemini-2.5-pro' };
  } catch {}

  // 2. Gemini 2.5 Flash
  try {
    const rFlash = await chamarGemini(geminiKey, 'gemini-2.5-flash', fullPrompt, 1024);
    if (validar(rFlash)) return { texto: limpar(rFlash), modelo: 'gemini-2.5-flash' };
  } catch {}

  // 3. OpenAI GPT-4o (se configurada)
  try {
    const rOai = await chamarOpenAI(openaiKey, sysPrompt, userPrompt);
    if (validar(rOai)) return { texto: limpar(rOai), modelo: 'gpt-4o' };
  } catch {}

  // 4. Anthropic Claude (se configurada)
  try {
    const rAnt = await chamarAnthropic(anthropicKey, sysPrompt, userPrompt);
    if (validar(rAnt)) return { texto: limpar(rAnt), modelo: 'claude-3-5-sonnet' };
  } catch {}

  // 5. Workers AI (Llama 3.3 70B)
  if (env?.AI) {
    try {
      const r = await env.AI.run(MODELO_WORKERS_AI, {
        messages: [
          { role: 'system', content: sysPrompt },
          ...(historico || []).slice(-4),
          { role: 'user', content: texto }
        ],
        max_tokens: 1800,
        temperature: 0.25
      });
      const out = String(r?.response || '').trim();
      if (validar(out)) return { texto: limpar(out), modelo: 'llama-3.3-70b' };
    } catch {}
  }

  return null;
}
