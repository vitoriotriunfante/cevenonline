// =========================================================================
// JOTA · functions/_lib/jota/aprendizado.js
// Agente 1 — Curador & Aprendizado Contínuo:
//   Lê conversas (bot_msgs), avaliações 👎 (ajudou=0), sugestões e perguntas
//   sem resposta (bot_sugestoes), diagnostica lacunas via Gemini/Workers AI,
//   grava em `jota_aprendizados` e envia resumo diário ao Vitório (whitelist).
// =========================================================================
import { hojeSP } from './base.js';
import { NUMEROS_VITORIO } from '../monitoria/motor.js';
import R from '../../../public/regras.js';

const MODELO_WORKERS_AI = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export async function garantirTabelaAprendizados(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS jota_aprendizados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia TEXT NOT NULL,
    categoria TEXT NOT NULL,
    pergunta_exemplo TEXT NOT NULL,
    ocorrencias INTEGER DEFAULT 1,
    diagnostico TEXT NOT NULL,
    acao_sugerida TEXT NOT NULL,
    sinonimo_chave TEXT DEFAULT '',
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function carregarContextoAprendido(db, limite = 12) {
  if (!db) return '';
  try {
    await garantirTabelaAprendizados(db);
    const { results } = await db.prepare(
      'SELECT dia, categoria, pergunta_exemplo, diagnostico, sinonimo_chave FROM jota_aprendizados ORDER BY id DESC LIMIT ?'
    ).bind(limite).all();
    if (!results || !results.length) return '';
    return results.map((r) => `- [${r.dia} · ${r.categoria}] "${r.pergunta_exemplo}" -> ${r.diagnostico}${r.sinonimo_chave ? ' (sinônimo/regra: ' + r.sinonimo_chave + ')' : ''}`).join('\n');
  } catch {
    return '';
  }
}

async function resolveGeminiKey(env) {
  let k = env?.GEMINI_API_KEY || env?.GOOGLE_AI_KEY || '';
  if (!k && env?.DB) {
    try {
      const r = await env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'gemini_api_key'").first();
      if (r && r.valor) k = String(r.valor);
    } catch {}
  }
  return k;
}

async function sintetizarAprendizadosIA(env, amostra) {
  const prompt = `Você é o Agente Curador de Aprendizado do JOTA (assistente comercial de WhatsApp do Grupo Triunfante).
Analise as interações reais abaixo (sugestões do time, respostas marcadas com 👎 e perguntas sem resposta) e devolva EXCLUSIVAMENTE um JSON válido (array de objetos, máximo 6 itens) com os aprendizados mais acionáveis para melhorar o JOTA.

Formato exato de cada objeto:
{
  "categoria": "LACUNA_INTENCAO | SINONIMO_CAMPO | NOVO_DADO | MELHORIA_UX",
  "pergunta_exemplo": "texto curto real que o usuário mandou",
  "ocorrencias": 1,
  "diagnostico": "por que o Jota falhou ou o que o time pediu (1 frase objetiva)",
  "acao_sugerida": "ajuste técnico/regra prática no Jota (1 frase objetiva)",
  "sinonimo_chave": "termo -> intenção (opcional)"
}

DADOS REAIS DAS ÚLTIMAS 24H:
${JSON.stringify(amostra, null, 2)}`;

  const apiKey = await resolveGeminiKey(env);
  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(22000),
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2500, responseMimeType: 'application/json' }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const txt = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
        const parsed = JSON.parse(txt.replace(/^```json\s*|\s*```$/g, ''));
        if (Array.isArray(parsed)) return parsed.slice(0, 6);
      }
    } catch {}
  }

  if (env?.AI) {
    try {
      const r = await env.AI.run(MODELO_WORKERS_AI, {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1800,
        temperature: 0.2
      });
      const txt = String(r?.response || '').trim();
      const m = txt.match(/\[[\s\S]*\]/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (Array.isArray(parsed)) return parsed.slice(0, 6);
      }
    } catch {}
  }
  return [];
}

export async function executarCuradoriaAprendizado(env, opcoes = {}) {
  const db = env?.DB;
  if (!db) return { ok: false, erro: 'DB indisponivel' };
  await garantirTabelaAprendizados(db);
  const hoje = hojeSP();

  const [negativos, sugestoes, semResp] = await Promise.all([
    db.prepare(
      "SELECT id, quando, nome, celular, texto, ajudou FROM bot_msgs WHERE ajudou = 0 AND quando >= datetime('now', '-24 hours') ORDER BY id DESC LIMIT 20"
    ).all().catch(() => ({ results: [] })),
    db.prepare(
      "SELECT id, quando, nome, papel, filial, texto, sobre FROM bot_sugestoes WHERE quando >= datetime('now', '-24 hours') ORDER BY id DESC LIMIT 25"
    ).all().catch(() => ({ results: [] })),
    db.prepare(
      "SELECT id, quando, nome, celular, texto, tipo FROM bot_msgs WHERE direcao = 'in' AND quando >= datetime('now', '-24 hours') AND EXISTS (SELECT 1 FROM bot_msgs o WHERE o.celular = bot_msgs.celular AND o.direcao = 'out' AND o.tipo = 'ajuda' AND o.id > bot_msgs.id AND o.id <= bot_msgs.id + 3) ORDER BY id DESC LIMIT 20"
    ).all().catch(() => ({ results: [] }))
  ]);

  const amostra = {
    negativos: (negativos.results || []).map((r) => ({ nome: r.nome, texto: String(r.texto || '').slice(0, 180) })),
    sugestoes: (sugestoes.results || []).map((r) => ({ nome: r.nome, papel: r.papel, filial: r.filial, texto: String(r.texto || '').slice(0, 220), sobre: String(r.sobre || '').slice(0, 120) })),
    semResposta: (semResp.results || []).map((r) => ({ nome: r.nome, pergunta: String(r.texto || '').slice(0, 180) }))
  };

  const totalSinais = amostra.negativos.length + amostra.sugestoes.length + amostra.semResposta.length;
  if (!totalSinais) {
    return { ok: true, hoje, totalSinais: 0, gravados: 0, enviados: 0, motivo: 'nenhuma lacuna ou sugestao nas ultimas 24h' };
  }

  let itens = await sintetizarAprendizadosIA(env, amostra);
  if (!itens.length) {
    itens = [
      ...amostra.sugestoes.slice(0, 3).map((s) => ({
        categoria: 'MELHORIA_UX',
        pergunta_exemplo: s.texto,
        ocorrencias: 1,
        diagnostico: `Sugestão/ocorrência enviada por ${s.nome || 'usuário'} (${s.papel || ''} ${s.filial || ''})`,
        acao_sugerida: 'Revisar sugestão para incluir no fluxo do Jota.',
        sinonimo_chave: ''
      })),
      ...amostra.semResposta.slice(0, 3).map((q) => ({
        categoria: 'LACUNA_INTENCAO',
        pergunta_exemplo: q.pergunta,
        ocorrencias: 1,
        diagnostico: 'Pergunta caiu no menu de ajuda sem resposta direta.',
        acao_sugerida: 'Mapear intenção ou sinônimo no entende.js.',
        sinonimo_chave: ''
      }))
    ];
  }

  // Idempotencia diaria: remove registros anteriores do mesmo dia apenas se estiver reprocessando manualmente
  const jaTemHoje = await db.prepare('SELECT COUNT(*) qtd FROM jota_aprendizados WHERE dia = ?').bind(hoje).first().catch(() => ({ qtd: 0 }));
  let gravados = 0;
  if (!(jaTemHoje && jaTemHoje.qtd > 0) || opcoes.forcar) {
    if (opcoes.forcar) await db.prepare('DELETE FROM jota_aprendizados WHERE dia = ?').bind(hoje).run();
    for (const it of itens) {
      await db.prepare(
        'INSERT INTO jota_aprendizados (dia, categoria, pergunta_exemplo, ocorrencias, diagnostico, acao_sugerida, sinonimo_chave) VALUES (?,?,?,?,?,?,?)'
      ).bind(
        hoje,
        String(it.categoria || 'LACUNA_INTENCAO').slice(0, 40),
        String(it.pergunta_exemplo || '').slice(0, 300),
        Number(it.ocorrencias) || 1,
        String(it.diagnostico || '').slice(0, 400),
        String(it.acao_sugerida || '').slice(0, 400),
        String(it.sinonimo_chave || '').slice(0, 200)
      ).run();
      gravados++;
    }
  }

  let enviados = 0;
  // 21/11/2026 (Vitorio: '159 sugestoes sem tratamento... o robozinho se perdeu'): o resumo diario diz quantas estao paradas no painel
  const pend = await db.prepare("SELECT COUNT(*) n, MIN(quando) desde FROM bot_sugestoes WHERE situacao IS NULL OR situacao = 'nova'").first().catch(() => null);
  if (opcoes.enviar !== false && gravados > 0) {
    const linhas = [
      ...(pend && pend.n ? [`📥 *Sugestões sem tratamento no painel: ${pend.n}* (desde ${String(pend.desde || '').slice(8, 10)}/${String(pend.desde || '').slice(5, 7)}) — /contatos › Sugestões`, ''] : []),
      `🧠 *CURADOR JOTA — Aprendizado Diário (${hoje.split('-').reverse().join('/')})*`,
      `Sinais nas últimas 24h: *${amostra.sugestoes.length}* sugestões/falhas · *${amostra.negativos.length}* 👎 · *${amostra.semResposta.length}* sem resposta.`,
      '',
      ...itens.map((it, i) => `${i + 1}. *[${it.categoria}]* "${String(it.pergunta_exemplo || '').slice(0, 80)}"\n   • Diagnóstico: ${it.diagnostico}\n   • Ação: ${it.acao_sugerida}`)
    ].join('\n');
    const cfg = R.evoCfg(env);
    for (const num of NUMEROS_VITORIO) {
      const r = await R.enviarTexto(cfg, num, linhas);
      if (r && r.ok) enviados++;
    }
  }

  return { ok: true, hoje, totalSinais, gravados, enviados, sugestoes_sem_tratamento: pend ? pend.n : null, itens };
}
