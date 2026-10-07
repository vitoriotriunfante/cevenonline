// =========================================================================
// FICHA DO ARQUIVO: functions/api/central-snapshot.js
// O QUE É: a BASE ÚNICA de dados dos RCAs para os consumidores que rodam FORA do Cloudflare (hoje: o motor do WhatsApp no GitHub Actions).
//   Devolve, por filial, o que a varredura central (cron-varredura-central, a cada 2 min) já gravou em varredura_central_rca:
//   produtividade, dashboard, devolucoes e roteiro de cada RCA, JÁ em JSON, com a idade de cada linha.
// POR QUÊ (Vitório, 07/10/2026, "um motor só alimentando várias fontes", pedido ~15x): o motor do WhatsApp perguntava ao CEVEN, RCA por RCA,
//   as MESMAS coisas que a varredura central já tinha (coleta de 3 a 13 min; o disparo das 18:30 estourou o tempo). Agora ele lê daqui e só
//   vai ao CEVEN no que a base não tem ou está velho. TV, Matriz, liga e WhatsApp passam a ver os MESMOS números.
// USO: GET /api/central-snapshot?filial=TBL[&dia=AAAA-MM-DD]  (dia padrão = hoje, horário de Brasília)
// REGRA: nunca inventa dado. Parte que não veio do CEVEN na varredura aparece como null (o consumidor busca no CEVEN).
// =========================================================================
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const hojeSP = () => { const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach((x) => (p[x.type] = x.value)); return `${p.year}-${p.month}-${p.day}`; };
const parse = (s) => { if (s == null || s === '') return null; try { return JSON.parse(s); } catch (e) { return null; } };

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: cors });
  const u = new URL(request.url);
  const filial = String(u.searchParams.get('filial') || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(filial)) return new Response(JSON.stringify({ erro: 'filial (sigla de 3 letras) obrigatoria' }), { status: 400, headers: cors });
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : hojeSP();
  try {
    const { results } = await env.DB.prepare('SELECT rca_codigo, updated_at, roteiro_json, produtividade_json, dashboard_json, devolucoes_json FROM varredura_central_rca WHERE data_ref = ? AND filial_sigla = ?').bind(dia, filial).all();
    const agora = Date.now(), rcas = {};
    for (const r of results || []) {
      const t = Date.parse(String(r.updated_at || '').replace(' ', 'T') + 'Z');
      rcas[r.rca_codigo] = { idade_s: Number.isFinite(t) ? Math.max(0, Math.round((agora - t) / 1000)) : null, produtividade: parse(r.produtividade_json), dashboard: parse(r.dashboard_json), devolucoes: parse(r.devolucoes_json), roteiro: parse(r.roteiro_json) };
    }
    return new Response(JSON.stringify({ filial, dia, gerado_em: new Date().toISOString(), total: Object.keys(rcas).length, rcas }), { headers: cors });
  } catch (e) { return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: cors }); }
}
