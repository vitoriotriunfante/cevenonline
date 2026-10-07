// =========================================================================
// FICHA DO ARQUIVO: functions/api/liga-as.js
// O QUE É: Liga AS (Autosserviço), FASEAMENTO da meta do mês, OFICIAL desde 13/10/2026 (pré-temporada de 05 a 12/10). Vendedor e supervisor SEPARADOS.
//          GET /api/liga-as?mes=AAAA-MM[&filial=TBL]
// FONTE:   vendedores AS = canal "AS" e mostra ≠ NÃO na Gestão de Equipe (/api/tv-mostra, já com o supervisor da árvore viva do CEVEN);
//          meta e faturado do mês de cada dia = foto do fim do dia guardada pela varredura central (varredura_central_rca.dashboard_json). Só leitura. Nunca inventa.
// REGRAS:  functions/_lib/liga_as.js  ·  decisões: docs/LIGA_AS_DECISOES.md
// =========================================================================
import { calculaFaseamento, somaSnaps, AS_FASES, AS_BONUS, AS_MODO, AS_VALE_DESDE } from '../_lib/liga_as.js';
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export async function onRequestGet({ env, request }) {
  if (!env.DB) return resp({ erro: 'D1 nao configurado' }, 503);
  const u = new URL(request.url), hoje = hojeSP();
  const mes = /^\d{4}-\d{2}$/.test(u.searchParams.get('mes') || '') ? u.searchParams.get('mes') : hoje.slice(0, 7);
  const fFil = (u.searchParams.get('filial') || '').toUpperCase();
  try {
    const mp = await (await fetch(`${u.origin}/api/tv-mostra`, { signal: AbortSignal.timeout(15000) })).json();
    const pessoas = [];
    for (const [k, lista] of Object.entries((mp && mp.filiais) || {})) {
      const filial = k.split('_')[0].toUpperCase();
      if (fFil && filial !== fFil) continue;
      for (const v of Array.isArray(lista) ? lista : []) if (v && v.rca != null && ['AS', 'PET AS'].includes(String(v.canal || '').toUpperCase()) && v.mostra !== false) pessoas.push({ filial, rca: String(v.rca), nome: v.nome, supervisor: v.supervisor || '' });
    }
    const { results } = await env.DB.prepare(
      `SELECT data_ref AS dia, filial_sigla AS filial, CAST(rca_codigo AS TEXT) AS rca,
              CAST(json_extract(dashboard_json, '$.financeiro.meta') AS REAL) AS meta,
              CAST(json_extract(dashboard_json, '$.financeiro.faturado') AS REAL) AS faturado,
              CAST(json_extract(dashboard_json, '$.financeiro.pendente') AS REAL) AS pendente
         FROM varredura_central_rca WHERE data_ref >= ? AND data_ref <= ? AND dashboard_json IS NOT NULL AND json_valid(dashboard_json)`
    ).bind(`${mes}-01`, `${mes}-31`).all();
    const foto = new Map(); // filial|rca -> {dia: {meta, faturado, pendente}}
    for (const r of results || []) { const k = r.filial + '|' + r.rca; if (!foto.has(k)) foto.set(k, {}); foto.get(k)[r.dia] = { meta: r.meta, faturado: r.faturado, pendente: r.pendente }; }

    const vendedores = pessoas.map((p) => {
      const snaps = foto.get(p.filial + '|' + p.rca) || {};
      return { ...p, ...calculaFaseamento(snaps, mes, hoje), _snaps: snaps };
    });
    // supervisor = a equipe somada (so quem tem meta)
    const porSup = new Map();
    for (const v of vendedores) { if (!v.supervisor) continue; const k = v.filial + '|' + v.supervisor; if (!porSup.has(k)) porSup.set(k, { filial: v.filial, supervisor: v.supervisor, equipe: [] }); porSup.get(k).equipe.push(v); }
    const supervisores = [...porSup.values()].filter((g) => !/^(GERENTE |VENDA EMPRESA|RCAS INATIVOS)/i.test(g.supervisor)).map((g) => ({
      filial: g.filial, supervisor: g.supervisor, vendedores: g.equipe.length, com_meta: g.equipe.filter((v) => v.meta_mes > 0).length,
      ...calculaFaseamento(somaSnaps(g.equipe.map((v) => v._snaps)), mes, hoje)
    })).sort((a, b) => b.pontos - a.pontos || a.filial.localeCompare(b.filial));
    for (const v of vendedores) delete v._snaps;
    vendedores.sort((a, b) => b.pontos - a.pontos || (b.pct_hoje || 0) - (a.pct_hoje || 0));
    return resp({ mes, hoje, modo: AS_MODO, vale_pontos_desde: AS_VALE_DESDE, regras: { fases: AS_FASES, bonus: AS_BONUS, base: '(faturado + pendente) / meta do mes, igual ao % do app do CEVEN' },
      totais: { vendedores: vendedores.length, vendedores_com_meta: vendedores.filter((v) => v.meta_mes > 0).length, supervisores: supervisores.length }, supervisores, vendedores });
  } catch (e) {
    return resp({ erro: String(e.message || e).slice(0, 300) }, 500);
  }
}
