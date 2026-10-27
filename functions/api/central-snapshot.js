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
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const hojeSP = () => R.hojeSP();
const parse = (s) => { if (s == null || s === '') return null; try { return JSON.parse(s); } catch (e) { return null; } };

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: cors });
  const u = new URL(request.url);
  const filial = String(u.searchParams.get('filial') || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(filial)) return new Response(JSON.stringify({ erro: 'filial (sigla de 3 letras) obrigatoria' }), { status: 400, headers: cors });
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : hojeSP();
  try {
    const { results } = await env.DB.prepare('SELECT * FROM varredura_central_rca WHERE data_ref = ? AND filial_sigla = ?').bind(dia, filial).all();
    const agora = Date.now(), rcas = {};
    for (const r of results || []) {
      const t = Date.parse(String(r.updated_at || '').replace(' ', 'T') + 'Z');
      rcas[r.rca_codigo] = { idade_s: Number.isFinite(t) ? Math.max(0, Math.round((agora - t) / 1000)) : null, produtividade: parse(r.produtividade_json), dashboard: parse(r.dashboard_json), devolucoes: parse(r.devolucoes_json), roteiro: parse(r.roteiro_json), roteiro_mes: parse(r.roteiro_mes_json) };   // roteiro_mes: 26/10/2026
    }
    // META DA HIERARQUIA (27/10/2026, Thiago/MCD sup. 62: "a meta no CEVEN e de 4.332.386,48"; o JOTA dizia 5.287.235): o painel do vendedor (dashboard do RCA)
    // ainda mostra meta de quem foi zerado/transferido na hierarquia (MCD 416 Claudimir: R$ 954.849 no painel x R$ 0 na tela do supervisor/gerente). meta_hier = a
    // meta da cascata do gerente gravada na base (cascata_dia, mesmo numero da tela do supervisor). Quem le decide usar; null = vendedor fora da cascata.
    try {
      const c = await env.DB.prepare('SELECT json FROM cascata_dia WHERE filial = ? ORDER BY data_ref DESC LIMIT 1').bind(filial).first();
      if (c) for (const s of JSON.parse(c.json).supervisores || []) for (const v of (s.tabelas && s.tabelas.faturamento) || []) if (v && v.id != null && rcas[String(v.id)]) rcas[String(v.id)].meta_hier = Number(v.meta) || 0;
    } catch { /* sem cascata: fica so o painel */ }
    return new Response(JSON.stringify({ filial, dia, gerado_em: new Date().toISOString(), total: Object.keys(rcas).length, rcas }), { headers: cors });
  } catch (e) { return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: cors }); }
}
