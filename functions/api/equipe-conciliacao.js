import { exigeSenhaEquipe } from '../_lib/senha_equipe.js';

// =========================================================================
// CONCILIACAO AUTOMATICA DE EQUIPE (Gestao de Equipe <-> GEROT)
// GET /api/equipe-conciliacao (protegido por X-Equipe-Senha)
// Compara config_equipe_soberana contra gerot_vendedor_mes, gerot_cliven_resumo
// e gerot_supervisor_mes do mes ativo para identificar divergencias em 1 clique.
// =========================================================================

const CORS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Equipe-Senha',
  'Cache-Control': 'no-store'
};

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/^(CLT|PJ)\s*-?\s*/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const rcaKey = (f, r) => `${String(f || '').toUpperCase().slice(0, 3)}|${Number(r) || 0}`;

function safeJson(txt, padrao = null) {
  try { return JSON.parse(txt || 'null') ?? padrao; } catch { return padrao; }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const negado = await exigeSenhaEquipe(request, env, CORS);
  if (negado) return negado;
  if (!env?.DB) {
    return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: CORS });
  }

  try {
    const mesRow = await env.DB.prepare('SELECT MAX(mes) AS mes FROM gerot_vendedor_mes').first().catch(() => null);
    const mes = (mesRow && mesRow.mes) || new Date().toISOString().slice(0, 7);

    const [cfgRow, vendRes, clvRes] = await Promise.all([
      env.DB.prepare('SELECT conteudo_json FROM config_equipe_soberana LIMIT 1').first(),
      env.DB.prepare(
        `SELECT filial, rca, COALESCE(rca_int, CAST(rca AS INTEGER)) AS rca_int, cod_sup, supervisor, vendedor,
                COALESCE(meta, CAST(json_extract(dados, '$."Meta (R$)"') AS REAL), 0) AS meta,
                COALESCE(fat_liq, CAST(json_extract(dados, '$."Faturado líquido (R$)"') AS REAL), 0) AS fat_liq,
                COALESCE(carteira, CAST(json_extract(dados, '$."Carteira pendente (R$)"') AS REAL), 0) AS carteira
           FROM gerot_vendedor_mes
          WHERE mes = ? AND rca NOT LIKE '%|%' AND COALESCE(rca_int, CAST(rca AS INTEGER)) > 0 AND COALESCE(rca_int, CAST(rca AS INTEGER)) <> 2`
      ).bind(mes).all(),
      env.DB.prepare(
        'SELECT filial, rca, cod_sup, supervisor, vendedor, clientes_ativos, positivados FROM gerot_cliven_resumo WHERE mes = ?'
      ).bind(mes).all().catch(() => ({ results: [] }))
    ]);

    const soberana = safeJson(cfgRow && cfgRow.conteudo_json, { filiais: {} });
    const gerotMap = new Map();
    for (const r of (vendRes && vendRes.results) || []) {
      const k = rcaKey(r.filial, r.rca_int);
      const o = gerotMap.get(k) || {
        filial: r.filial,
        rca: String(r.rca_int),
        vendedor: r.vendedor || '',
        meta: 0,
        fat_liq: 0,
        carteira: 0,
        ativos_cliven: 0,
        positivados_cliven: 0,
        sups: new Map()
      };
      o.meta += Number(r.meta) || 0;
      o.fat_liq += Number(r.fat_liq) || 0;
      o.carteira += Number(r.carteira) || 0;
      if (!o.vendedor && r.vendedor) o.vendedor = r.vendedor;
      const sn = norm(r.supervisor);
      if (sn) o.sups.set(sn, String(r.supervisor).trim());
      gerotMap.set(k, o);
    }
    for (const r of (clvRes && clvRes.results) || []) {
      const rInt = Number(r.rca) || 0;
      if (rInt <= 0 || rInt === 2) continue;
      const k = rcaKey(r.filial, rInt);
      const o = gerotMap.get(k) || {
        filial: r.filial,
        rca: String(rInt),
        vendedor: r.vendedor || '',
        meta: 0,
        fat_liq: 0,
        carteira: 0,
        ativos_cliven: 0,
        positivados_cliven: 0,
        sups: new Map()
      };
      o.ativos_cliven += Number(r.clientes_ativos) || 0;
      o.positivados_cliven += Number(r.positivados) || 0;
      const sn = norm(r.supervisor);
      if (sn) o.sups.set(sn, String(r.supervisor).trim());
      gerotMap.set(k, o);
    }

    const gestaoMap = new Map();
    const duplicados_multi_pasta = [];
    let gestao_total = 0, gestao_sim = 0;

    for (const [chaveFil, lista] of Object.entries((soberana && soberana.filiais) || {})) {
      const fil = String(chaveFil).split('_')[0].toUpperCase();
      for (const v of lista || []) {
        const rInt = Number(v.rca) || 0;
        if (rInt <= 0) continue;
        gestao_total++;
        if (v.mostra !== false) gestao_sim++;
        const k = rcaKey(fil, rInt);
        if (gestaoMap.has(k)) {
          duplicados_multi_pasta.push({
            origem: 'gestao',
            filial: fil,
            rca: String(rInt),
            nome: v.nome || '',
            detalhe: `Duplicado na Gestao de Equipe (${gestaoMap.get(k).chaveFil} e ${chaveFil})`
          });
        }
        gestaoMap.set(k, { ...v, filial: fil, chaveFil, rcaInt: rInt });
      }
    }

    const novos_no_gerot = [];
    const supervisor_divergente = [];

    for (const [k, g] of gerotMap) {
      const temMov = g.meta > 0 || Math.abs(g.fat_liq) > 0 || g.carteira > 0 || g.ativos_cliven > 0;
      const supsGerot = [...g.sups.values()];
      if (g.sups.size > 1) {
        duplicados_multi_pasta.push({
          origem: 'gerot',
          filial: g.filial,
          rca: g.rca,
          nome: g.vendedor || '',
          detalhe: `${g.sups.size} pastas no GEROT: ${supsGerot.join(' / ')}`
        });
      }
      const gs = gestaoMap.get(k);
      if (!gs) {
        if (temMov) {
          novos_no_gerot.push({
            filial: g.filial,
            rca: g.rca,
            nome: g.vendedor || `RCA ${g.rca}`,
            supervisor_gerot: supsGerot[0] || '',
            meta: Math.round(g.meta),
            fat_liq: Math.round(g.fat_liq * 100) / 100,
            carteira: Math.round(g.carteira * 100) / 100,
            ativos_cliven: g.ativos_cliven
          });
        }
        continue;
      }
      if (gs.mostra !== false && temMov && g.sups.size > 0) {
        const supGestaoNorm = norm(gs.supervisor);
        if (!supGestaoNorm || !g.sups.has(supGestaoNorm)) {
          supervisor_divergente.push({
            filial: g.filial,
            rca: g.rca,
            nome: gs.nome || g.vendedor || '',
            chaveFil: gs.chaveFil,
            supervisor_gestao: gs.supervisor || '(vazio)',
            supervisor_gerot: supsGerot[0] || '',
            todos_supervisores_gerot: supsGerot,
            fat_liq: Math.round(g.fat_liq * 100) / 100
          });
        }
      }
    }

    const inativos_na_gestao = [];
    for (const [k, gs] of gestaoMap) {
      if (gs.mostra === false) continue;
      const g = gerotMap.get(k);
      const temMov = g && (g.meta > 0 || Math.abs(g.fat_liq) > 0 || g.carteira > 0 || g.ativos_cliven > 0);
      if (!temMov) {
        inativos_na_gestao.push({
          filial: gs.filial,
          rca: String(gs.rcaInt),
          nome: gs.nome || '',
          chaveFil: gs.chaveFil,
          supervisor_gestao: gs.supervisor || '',
          canal: gs.canal || '',
          vinculo: gs.vinculo || ''
        });
      }
    }

    novos_no_gerot.sort((a, b) => (b.meta - a.meta) || (b.fat_liq - a.fat_liq));
    inativos_na_gestao.sort((a, b) => a.filial.localeCompare(b.filial) || Number(a.rca) - Number(b.rca));
    supervisor_divergente.sort((a, b) => b.fat_liq - a.fat_liq);

    return new Response(JSON.stringify({
      ok: true,
      mes,
      resumo: {
        gestao_total,
        gestao_sim,
        gerot_rcas_ativos: [...gerotMap.values()].filter((g) => g.meta > 0 || Math.abs(g.fat_liq) > 0 || g.carteira > 0 || g.ativos_cliven > 0).length,
        novos: novos_no_gerot.length,
        inativos: inativos_na_gestao.length,
        supervisor_divergente: supervisor_divergente.length,
        duplicados: duplicados_multi_pasta.length
      },
      novos_no_gerot,
      inativos_na_gestao,
      supervisor_divergente,
      duplicados_multi_pasta
    }), { status: 200, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e && e.message || e) }), { status: 500, headers: CORS });
  }
}
