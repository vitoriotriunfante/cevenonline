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
import { hojeSP, R$, N, sem, titulo } from './base.js';
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
  const soRca = escIA?.rca ? String(escIA.rca) : null;
  const soSup = !soRca && escIA?.supervisor ? String(escIA.supervisor) : null;

  const [filGerotRows, supGerotRows, indRows, bloqRows, cartHojeRows, gerotStRow, aprendizados] = await Promise.all([
    soRca || soSup
      ? Promise.resolve({ results: [] })
      : (temFil
        ? db.prepare(`SELECT filial, dados FROM gerot_filial_mes WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...filiais)
        : db.prepare('SELECT filial, dados FROM gerot_filial_mes WHERE mes = ?').bind(mes)
      ).all().catch(() => ({ results: [] })),
    soRca
      ? Promise.resolve({ results: [] })
      : (temFil
        ? db.prepare(`SELECT filial, cod_sup, supervisor, dados FROM gerot_supervisor_mes WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...filiais)
        : db.prepare('SELECT filial, cod_sup, supervisor, dados FROM gerot_supervisor_mes WHERE mes = ?').bind(mes)
      ).all().catch(() => ({ results: [] })),
    soRca && filiais[0]
      ? db.prepare('SELECT filial, rca, cod_sup, supervisor, dados FROM gerot_vendas WHERE mes = ? AND filial = ? AND rca = ?').bind(mes, filiais[0], soRca).all().catch(() => ({ results: [] }))
      : (temFil
        ? db.prepare(`SELECT filial, rca, cod_sup, supervisor, dados FROM gerot_vendas WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...filiais)
        : db.prepare('SELECT filial, rca, cod_sup, supervisor, dados FROM gerot_vendas WHERE mes = ?').bind(mes)
      ).all().catch(() => ({ results: [] })),
    soRca && filiais[0]
      ? /* 23/11/2026 (dicionario 3.11, conflito 8): bloqueados = gerot_carteira, nunca pedido_status (esparso) */ db.prepare("SELECT 'BLOQUEADO' status, COUNT(*) qtd, SUM(valor) vlr FROM gerot_carteira WHERE filial = ? AND CAST(rca AS INTEGER) = ? AND situacao LIKE 'Bloqueado%'").bind(filiais[0], Number(soRca)).all().catch(() => ({ results: [] }))
      : (temFil
        ? db.prepare(`SELECT 'BLOQUEADO' status, COUNT(*) qtd, SUM(valor) vlr FROM gerot_carteira WHERE filial IN (${qs}) AND situacao LIKE 'Bloqueado%'`).bind(...filiais)
        : db.prepare("SELECT 'BLOQUEADO' status, COUNT(*) qtd, SUM(valor) vlr FROM gerot_carteira WHERE situacao LIKE 'Bloqueado%'")
      ).all().catch(() => ({ results: [] })),
    (soRca && filiais[0]
      ? db.prepare('SELECT filial, rca, cod_sup, supervisor, fornecedores FROM (SELECT c.filial, c.rca, "" cod_sup, "" supervisor, c.fornecedores FROM gerot_carteira c WHERE c.entrada = ? AND c.filial = ? AND CAST(c.rca AS INTEGER) = ?)').bind(hoje, filiais[0], Number(soRca))
      : temFil
        ? db.prepare(`SELECT filial, rca, sup_cod AS cod_sup, "" supervisor, fornecedores FROM gerot_carteira WHERE entrada = ? AND filial IN (${qs})`).bind(hoje, ...filiais)
        : db.prepare('SELECT filial, rca, sup_cod AS cod_sup, "" supervisor, fornecedores FROM gerot_carteira WHERE entrada = ?').bind(hoje)
    ).all().catch(() => ({ results: [] })),
    db.prepare('SELECT posicao, em FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first().catch(() => null),
    carregarContextoAprendido(db, 6)
  ]);

  const supMatches = (supNomeRow) => {
    if (!soSup) return true;
    const a = sem(soSup), b = sem(supNomeRow || '');
    return a && b && (a === b || b.includes(a) || a.includes(b));
  };

  let gMeta = 0, gFat = 0, gCart = 0, gPos = 0, gMetaPos = 0, gDev = 0, gCorte = 0, gDesc = 0, gBonif = 0;
  const gFiliais = [];
  for (const r of filGerotRows.results || []) {
    let d = {};
    try { d = JSON.parse(r.dados || '{}'); } catch { continue; }
    const meta = Number(d['Meta (R$)']) || 0, fat = Number(d['Faturado líquido (R$)']) || 0, cart = Number(d['Carteira pendente (R$)']) || 0;
    const pos = Number(d['Positivação (filial + CNPJ)'] ?? d['Positivação (filial)']) || 0, metaPos = Number(d['Meta de positivação'] ?? d['Meta clientes']) || 0;
    const dev = Number(d['Devolução (R$)']) || 0, corte = Number(d['Cortes total (R$)'] ?? d['Corte total (R$)']) || 0;
    const desc = Number(d['Desconto (R$)']) || 0, bonif = Number(d['Bonificação a tabela (R$)']) || 0;
    gMeta += meta; gFat += fat; gCart += cart; gPos += pos; gMetaPos += metaPos;
    gDev += dev; gCorte += corte; gDesc += desc; gBonif += bonif;
    gFiliais.push({ filial: r.filial, meta, fat, cart, vend: fat + cart, dev, corte, pctFat: meta ? (fat / meta) * 100 : 0, pctVend: meta ? ((fat + cart) / meta) * 100 : 0 });
  }
  gFiliais.sort((a, b) => a.pctVend - b.pctVend);

  const gSups = [];
  const supCodsAlvo = new Set();
  for (const r of supGerotRows.results || []) {
    if (soSup && !supMatches(r.supervisor)) continue;
    if (r.cod_sup) supCodsAlvo.add(String(r.cod_sup));
    let d = {};
    try { d = JSON.parse(r.dados || '{}'); } catch { continue; }
    const meta = Number(d['Meta (R$)']) || 0, fat = Number(d['Faturado líquido (R$)']) || 0, cart = Number(d['Carteira pendente (R$)']) || 0;
    if (soSup) {
      gMeta += meta; gFat += fat; gCart += cart;
      gPos += Number(d['Positivação (filial + CNPJ)'] ?? d['Positivação (filial)']) || 0;
      gMetaPos += Number(d['Meta de positivação'] ?? d['Meta clientes']) || 0;
      gDev += Number(d['Devolução (R$)']) || 0;
      gCorte += Number(d['Cortes total (R$)'] ?? d['Corte total (R$)']) || 0;
      gDesc += Number(d['Desconto (R$)']) || 0;
      gBonif += Number(d['Bonificação a tabela (R$)']) || 0;
    }
    if (meta <= 0) continue;
    gSups.push({ filial: r.filial, sup: r.supervisor, meta, fat, cart, vend: fat + cart, pctVend: ((fat + cart) / meta) * 100 });
  }
  gSups.sort((a, b) => a.pctVend - b.pctVend);

  const indFiltradas = (indRows.results || []).filter((r) => {
    if (!soSup) return true;
    return (r.cod_sup && supCodsAlvo.has(String(r.cod_sup))) || supMatches(r.supervisor);
  });
  if (soRca) {
    for (const r of indFiltradas) {
      let d = {}; try { d = JSON.parse(r.dados || '{}'); } catch { continue; }
      gMeta += Number(d['Meta (R$)']) || 0;
      gFat += Number(d['Faturado líquido (R$)']) || 0;
      gCart += Number(d['Carteira pendente (R$)']) || 0;
      gDev += Number(d['Devolução (R$)']) || 0;
    }
  }

  const extrasGerot = [
    gDev > 0 ? `Devolução: ${R$(gDev)}` : '',
    gCorte > 0 ? `Cortes: ${R$(gCorte)}` : '',
    gDesc > 0 ? `Desconto: ${R$(gDesc)}` : '',
    gBonif > 0 ? `Bonificação: ${R$(gBonif)}` : ''
  ].filter(Boolean).join(' | ');

  const gerotResumoTxt = gMeta > 0 ? [
    `=== RESUMO OFICIAL GEROT (${escIA.nome} · FONTE PRINCIPAL) ===`,
    `Meta: ${R$(gMeta)} | Faturado: ${R$(gFat)} (${(gFat / gMeta * 100).toFixed(1)}%) | Carteira Pendente: ${R$(gCart)} | Faturado + Carteira: ${R$(gFat + gCart)} (${((gFat + gCart) / gMeta * 100).toFixed(1)}%) | Positivação: ${N(gPos)}${gMetaPos ? ' / ' + N(gMetaPos) : ''}${extrasGerot ? ' | ' + extrasGerot : ''}`,
    `Filiais (pior % Fat+Cart primeiro): ${gFiliais.map((f) => `${f.filial} ${f.pctVend.toFixed(1)}% (Fat ${R$(f.fat)} + Cart ${R$(f.cart)} / Meta ${R$(f.meta)})`).join(' | ')}`,
    gSups.length ? `Piores Supervisores (% Fat+Cart): ${gSups.slice(0, 8).map((s) => `${s.sup} (${s.filial}) ${s.pctVend.toFixed(1)}% (${R$(s.vend)}/${R$(s.meta)})`).join(' | ')}` : ''
  ].filter(Boolean).join('\n') : '';

  const porInd = new Map();
  for (const r of indFiltradas) {
    let d = {};
    try { d = JSON.parse(r.dados || '{}'); } catch { continue; }
    const ind = nomeForn(d.Fornecedor);
    if (!ind) continue;
    const fil = String(r.filial || '').trim();
    const meta = Number(d['Meta (R$)']) || 0;
    const fat = Number(d['Faturado líquido (R$)']) || 0;
    const pend = Number(d['Carteira pendente (R$)']) || 0;
    const pos = Number(d['Positivação (filial + CNPJ)']) || 0;
    const cur = porInd.get(ind) || { ind, meta: 0, fat: 0, pend: 0, pos: 0, porFil: new Map() };
    cur.meta += meta;
    cur.fat += fat;
    cur.pend += pend;
    cur.pos += pos;
    if (fil && meta > 0) {
      const f = cur.porFil.get(fil) || { filial: fil, meta: 0, vend: 0 };
      f.meta += meta;
      f.vend += fat + pend;
      cur.porFil.set(fil, f);
    }
    porInd.set(ind, cur);
  }
  const minMetaInd = escIA.nacional ? 20000 : 3000;
  const todasInd = [...porInd.values()].filter((x) => x.meta > 0);
  const relevantesInd = todasInd.filter((x) => x.meta >= minMetaInd);
  const baseInd = relevantesInd.length >= 3 ? relevantesInd : todasInd;
  const topInd = baseInd
    .map((x) => {
      const vend = x.fat + x.pend;
      const pct = (vend / x.meta) * 100;
      const gap = Math.max(0, x.meta - vend);
      const filGaps = [...x.porFil.values()]
        .map((f) => ({ ...f, pct: (f.vend / f.meta) * 100, gap: Math.max(0, f.meta - f.vend) }))
        .filter((f) => f.gap > 0)
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 4);
      return { ...x, vend, pct, gap, filGaps };
    })
    .sort((a, b) => a.pct - b.pct || b.gap - a.gap)
    .slice(0, 12);

  const indTxt = topInd.length
    ? '=== INDÚSTRIAS COM MAIOR GAP NO ESCOPO (GEROT · COM FILIAIS) ===\n' + topInd.map((x) => {
      const filStr = x.filGaps.length > 1 || (escIA.nacional && x.filGaps.length)
        ? ` | Filiais no gap: ${x.filGaps.map((f) => `${f.filial} ${f.pct.toFixed(0)}% (falta ${R$(f.gap)})`).join(', ')}`
        : '';
      return `• ${x.ind}: Meta ${R$(x.meta)} | Fat+Cart ${R$(x.vend)} (${x.pct.toFixed(1)}%) | Falta ${R$(x.gap)} | Posit ${N(x.pos)}${filStr}`;
    }).join('\n')
    : '';

  const comPedHojeInd = new Set();
  for (const r of (cartHojeRows && cartHojeRows.results) || []) {
    if (soSup && !(r.cod_sup && supCodsAlvo.has(String(r.cod_sup)))) continue;
    let fs = [];
    try { fs = JSON.parse(r.fornecedores || '[]'); } catch { fs = []; }
    for (const f of Array.isArray(fs) ? fs : []) {
      const nm = nomeForn(typeof f === 'string' ? f : (f && (f.fornecedor || f.nome || f.desc)));
      if (nm) comPedHojeInd.add(nm);
    }
  }
  const indSemVendaMes = todasInd.filter((x) => (x.fat + x.pend) <= 0).map((x) => x.ind).sort();
  const indComPedidoHoje = todasInd.filter((x) => comPedHojeInd.has(x.ind)).map((x) => x.ind).sort();
  const indSemPedidoHoje = todasInd.filter((x) => !comPedHojeInd.has(x.ind)).map((x) => x.ind).sort();
  const gerotPos = gerotStRow && (gerotStRow.posicao || gerotStRow.em) ? `${gerotStRow.posicao || ''} (${gerotStRow.em ? new Date(gerotStRow.em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : ''})` : 'GEROT';
  const indZeroTxt = todasInd.length ? [
    `=== INDÚSTRIAS COM META: SEM VENDA NO MÊS E HOJE (${gerotPos}) ===`,
    `Total de indústrias com meta cadastrada no escopo: ${todasInd.length}`,
    `Sem venda no mês (faturado + carteira = 0): ${indSemVendaMes.length} de ${todasInd.length}` + (indSemVendaMes.length ? ` -> ${indSemVendaMes.join(', ')}` : ''),
    `Com pedidos na Carteira do GEROT hoje (${hoje}): ${indComPedidoHoje.length} de ${todasInd.length}` + (indComPedidoHoje.length && indComPedidoHoje.length <= 20 ? ` -> ${indComPedidoHoje.join(', ')}` : ''),
    `SEM pedido na Carteira do GEROT hoje (${hoje}): ${indSemPedidoHoje.length} de ${todasInd.length}` + (indSemPedidoHoje.length ? ` -> ${indSemPedidoHoje.join(', ')}` : ''),
    `Observação de fonte: os pedidos de hoje por indústria vêm da Carteira Total do GEROT (última carga ${gerotPos}); pedidos colocados no Clube da Venda depois dessa carga ou ainda não sincronizados no Winthor não detalham indústria.`
  ].join('\n') : '';

  const bloqTxt = (bloqRows.results || []).length
    ? '=== PEDIDOS BLOQUEADOS / CANCELADOS (ÚLTIMOS 7 DIAS) ===\n' + (bloqRows.results || []).map((b) => `• ${b.status}: ${N(b.qtd)} pedidos (${R$(b.vlr || 0)})`).join('\n')
    : '';

  const aprTxt = aprendizados
    ? `=== APRENDIZADOS RECENTES DO CAMPO (CURADOR JOTA) ===\n${aprendizados}`
    : '';

  return [gerotResumoTxt, indZeroTxt, indTxt, bloqTxt, aprTxt].filter(Boolean).join('\n\n');
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

  const papelNorm = String(c.papel || '').toLowerCase();
  const ehExec = ['diretoria', 'ceo', 'gerente', 'admin'].includes(papelNorm);
  const instrucaoFormato = ehExec
    ? `6. Formatação WhatsApp: use *negrito* com UM asterisco apenas em títulos e números-chave. NÃO inclua rodapé de avaliação ("Essa resposta ajudou?"). Estruture em:
   - 📊 *Diagnóstico Executivo* (causa-raiz baseada nos números)
   - 🔍 *Onde está o Gap / Alavanca* (equipes, indústrias com filiais ou bloqueios prioritários)
   - 🎯 *Plano de Ação Imediato* (3 a 5 ações práticas com meta numérica real)
   Termine convidando: "_Quer abrir algum detalhe por filial, supervisor ou indústria? Só pedir!_"`
    : `6. Formatação WhatsApp: seja direto, parceiro e prático (no máximo 15 linhas), usando *negrito* com UM asterisco apenas em títulos e números-chave. NÃO inclua rodapé de avaliação ("Essa resposta ajudou?"). Entregue:
   - O dado real que a pessoa pediu (do escopo dela, sem vazar dados de fora)
   - 💡 *O que fazer agora* (2 a 3 ideias práticas baseadas nos números)
   Termine com: "_Quer saber mais algum detalhe ou abrir a lista? Só chamar!_"`;

  const sysPrompt = `Você é o JOTA Sênior ⚽, Parceiro Comercial e Analista de Elite do Grupo Triunfante (+MIX & CEVEN).
Você está atendendo: ${titulo(c.nome)} (Cargo: ${String(c.papel || '').toUpperCase()}${c.filial ? ' — Filial ' + c.filial : ' — Visão Nacional Brasil 11 Filiais'}${c.grupo ? ' · Grupo ' + c.grupo : ''}).

REGRAS DE OURO (INVIOLÁVEIS):
1. Responda diretamente ao que foi perguntado com profundidade analítica: cruzando equipes/supervisores, indústrias, bloqueios, positivação e ritmo diário (sempre dentro do escopo de quem perguntou).
2. Use o bloco "RESUMO OFICIAL GEROT" como fonte principal para Meta, Faturado, Carteira Pendente e % de atingimento (nunca misture com números antigos do CEVEN quando houver GEROT).
3. Sempre que citar uma indústria em análise nacional/multi-filial, CITE OBRIGATORIAMENTE as filiais específicas que puxam o gap (pois o mix e o desempenho variam muito entre filiais).
4. NUNCA invente números, percentuais ou clientes que não estejam no DOSSIÊ abaixo. Se faltar algum dado granular para responder 100%, diga exatamente o que falta e entregue a melhor análise possível com os números reais disponíveis.
5. Agora é ${hojeSP().split('-').reverse().join('/')}, ${horaBrt}h em Brasília: use a saudação correta.
${instrucaoFormato}

DOSSIÊ 360° EM TEMPO REAL (${escIA.nome}):
${dossie}`;

  const stripRodape = (s) => String(s || '')
    .replace(/\n*_?Essa resposta ajudou\?[\s\S]*$/i, '')
    .replace(/\n*_?🟢 Hoje \(Clube da Venda[\s\S]*$/i, '')
    .trim();
  const histTxt = (historico || []).map((h) => `${h.role === 'user' ? 'Executivo' : 'Jota'}: ${stripRodape(h.content)}`).join('\n');
  const userPrompt = `${histTxt ? '--- HISTÓRICO RECENTE ---\n' + histTxt + '\n\n' : ''}--- PERGUNTA DO EXECUTIVO ---\n"${texto}"`;
  const fullPrompt = `${sysPrompt}\n\n${userPrompt}`;
  const fonteValidacao = fonteIA(dossie);

  const limpar = (s) => stripRodape(s).replace(/\*\*/g, '*').replace(/^#+\s*/gm, '').trim();
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
