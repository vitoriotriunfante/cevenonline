// =========================================================================
// FICHA DO ARQUIVO: functions/api/cron-conferencia-dia.js
// O QUE É: CONFERÊNCIA DIÁRIA contra o CEVEN (Vitório, 06/10/2026: "precisamos ser coesos no número"). Depois das 19h30 compara, vendedor por vendedor,
//          o que o nosso banco (D1, que alimenta TV, Matriz, Lances e Liga) tem com o que o CEVEN responde AGORA: digitado do dia e devoluções do dia.
//          Qualquer diferença acima de R$ 1,00 vira divergência listada em /divergencias (bloco "Conferência do dia").
//          Roda em fatias de 60 vendedores por chamada (chamado pelo coletor de lances a cada 5 min, 6 chamadas simultâneas no máximo ao CEVEN).
//          SOMENTE LEITURA do CEVEN. Nunca corrige número sozinha: aponta.
// USO:  GET /api/cron-conferencia-dia?rodar=1  -> confere a próxima fatia (só depois das 19h30, ou com forcar=1) e devolve o resumo
//       GET /api/cron-conferencia-dia          -> só o resumo do dia
// =========================================================================
import { agoraSP } from '../_lib/liga_fechamento.js';
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const FATIA = 60, CONC = 6, TOL = 1.0;
const arred = (x) => Math.round((Number(x) || 0) * 100) / 100;

async function getJson(url) {
  try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(12000) }); if (!r.ok) return null; return await r.json(); } catch { return null; }
}
async function pool(tarefas, n) {
  const saida = new Array(tarefas.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, tarefas.length) }, async () => { while (true) { const k = i++; if (k >= tarefas.length) return; saida[k] = await tarefas[k](); } }));
  return saida;
}

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: cors });
  const u = new URL(request.url), t = agoraSP();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : t.dia;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS conferencia_rca (dia TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, dig_d1 REAL, dig_ceven REAL, dev_d1 REAL, dev_ceven REAL, em TEXT, PRIMARY KEY (dia, filial, rca))').run();
    let rodou = 0, aviso = null;
    if (u.searchParams.get('rodar') === '1') {
      if (!(u.searchParams.get('forcar') === '1' || dia < t.dia || t.min >= 19 * 60 + 30)) aviso = 'a conferencia so roda depois das 19h30';
      else {
        const { results: faltam } = await env.DB.prepare(
          `SELECT v.filial_sigla AS filial, CAST(v.rca_codigo AS TEXT) AS rca, v.produtividade_json AS pj, v.devolucoes_json AS dj FROM varredura_central_rca v
            WHERE v.data_ref = ? AND NOT EXISTS (SELECT 1 FROM conferencia_rca c WHERE c.dia = v.data_ref AND c.filial = v.filial_sigla AND c.rca = CAST(v.rca_codigo AS TEXT)) LIMIT ?`
        ).bind(dia, FATIA).all();
        const linhas = await pool((faltam || []).map((r) => async () => {
          const fk = String(r.filial).toLowerCase() + '1';
          const [prod, dev] = await Promise.all([getJson(`${CEVEN}/api/rca/produtividade?filial=${fk}&id=${r.rca}`), getJson(`${CEVEN}/api/rca/devolucoes?filial=${fk}&id=${r.rca}`)]);
          if (!prod || !Array.isArray(dev)) return null; // CEVEN nao respondeu: tenta de novo na proxima fatia (nunca assume)
          let pj = null, dj = null; try { pj = JSON.parse(r.pj); } catch {} try { dj = JSON.parse(r.dj); } catch {}
          const devD1 = Array.isArray(dj) ? dj.filter((n) => String(n.data).slice(0, 10) === dia).reduce((s, n) => s + Math.abs(Number(n.vl_devolvido) || 0), 0) : 0;
          const devCeven = dev.filter((n) => String(n.data).slice(0, 10) === dia).reduce((s, n) => s + Math.abs(Number(n.vl_devolvido) || 0), 0);
          return { filial: r.filial, rca: r.rca, dig_d1: arred(pj && pj.dia && pj.dia.dig_pedido), dig_ceven: arred(prod.dia && prod.dia.dig_pedido), dev_d1: arred(devD1), dev_ceven: arred(devCeven) };
        }), CONC);
        const ok = linhas.filter(Boolean);
        const stmts = ok.map((x) => env.DB.prepare("INSERT OR REPLACE INTO conferencia_rca (dia, filial, rca, dig_d1, dig_ceven, dev_d1, dev_ceven, em) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(dia, x.filial, x.rca, x.dig_d1, x.dig_ceven, x.dev_d1, x.dev_ceven));
        for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
        rodou = ok.length;
      }
    }
    // RESUMO
    const tot = await env.DB.prepare('SELECT COUNT(*) AS n FROM varredura_central_rca WHERE data_ref = ?').bind(dia).first();
    const { results: ls } = await env.DB.prepare('SELECT c.filial, c.rca, c.dig_d1, c.dig_ceven, c.dev_d1, c.dev_ceven, r.nome FROM conferencia_rca c LEFT JOIN representantes r ON CAST(r.codigo AS TEXT) = c.rca WHERE c.dia = ?').bind(dia).all();
    const divergentes = [], porFilial = {};
    for (const l of ls || []) {
      const pf = (porFilial[l.filial] = porFilial[l.filial] || { dig_d1: 0, dig_ceven: 0, dev_d1: 0, dev_ceven: 0 });
      pf.dig_d1 += l.dig_d1; pf.dig_ceven += l.dig_ceven; pf.dev_d1 += l.dev_d1; pf.dev_ceven += l.dev_ceven;
      if (Math.abs(l.dig_d1 - l.dig_ceven) > TOL) divergentes.push({ filial: l.filial, rca: l.rca, nome: l.nome || null, campo: 'digitado do dia', nosso: l.dig_d1, ceven: l.dig_ceven });
      if (Math.abs(l.dev_d1 - l.dev_ceven) > TOL) divergentes.push({ filial: l.filial, rca: l.rca, nome: l.nome || null, campo: 'devolucoes do dia', nosso: l.dev_d1, ceven: l.dev_ceven });
    }
    for (const f of Object.values(porFilial)) for (const k of Object.keys(f)) f[k] = arred(f[k]);
    let fechados = [];
    try { const { results: fz } = await env.DB.prepare('SELECT dia, fechado_em, regras_versao, total_lances, total_pontos FROM liga_fechamento ORDER BY dia DESC LIMIT 15').all(); fechados = fz || []; } catch { /* ainda nao fechou nenhum dia */ }
    return new Response(JSON.stringify({ dia, fechados, conferidos: (ls || []).length, total: tot ? tot.n : 0, completo: !!tot && (ls || []).length >= tot.n, rodou_agora: rodou, aviso, tolerancia_reais: TOL, divergentes, por_filial: porFilial }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: cors });
  }
}
