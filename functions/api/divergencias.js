// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: LISTA VIVA de divergências de cadastro entre a PLANILHA (MOSTRA_DISPAROS), o BANCO (representantes) e o CEVEN, para o Vitório decidir
//          se cada divergência é VÁLIDA ou não. Somente leitura. Alimenta public/divergencias.html.
// REGRA DO VITÓRIO (05/10/2026): "essa é uma lista viva e sempre que tiver divergência eu preciso saber para olhar e ver se é válida ou não".
// SEÇÕES:  A) banco_fora_da_planilha  — vendedor ativo no banco/CEVEN que não está na planilha (com o movimento de hoje e a devolução do mês);
//          B) planilha_fora_do_banco  — vendedor da planilha que não está no banco (entra na varredura pela planilha, mas o cadastro precisa ser feito);
//          C) descobertos             — códigos achados pela varredura de descoberta (cron-descobre-codigos.js) com devolução no mês e fora de qualquer lista.
// NUNCA inventa: tudo vem do banco, da planilha e do que o CEVEN devolveu.
// =========================================================================
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });
const arred = (x) => Math.round((Number(x) || 0) * 100) / 100;

export async function onRequestGet({ env, request }) {
  if (!env.DB) return resp({ erro: 'D1 não configurado' }, 503);
  const origin = new URL(request.url).origin;
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  try {
    // PLANILHA
    const planilha = new Map(); // filial|codigo -> {nome, mostra, canal, supervisor}
    const porCodigoPlanilha = new Set();
    let planilhaOk = true;
    try {
      const mp = await (await fetch(`${origin}/api/tv-mostra`, { signal: AbortSignal.timeout(8000) })).json();
      for (const [sg, lista] of Object.entries((mp && mp.filiais) || {})) for (const x of Array.isArray(lista) ? lista : []) {
        if (!x || x.rca == null) continue;
        planilha.set(String(sg).toUpperCase() + '|' + x.rca, { nome: x.nome, mostra: x.mostra, canal: x.canal, supervisor: x.supervisor });
        porCodigoPlanilha.add(String(x.rca));
      }
    } catch { planilhaOk = false; }

    // BANCO
    const { results: reps } = await env.DB.prepare(
      'SELECT r.codigo, r.nome, r.ativo, UPPER(COALESCE(f.codigo, r.filial_id)) AS filial FROM representantes r LEFT JOIN filiais f ON r.filial_id = f.id'
    ).all();

    // MOVIMENTO DE HOJE (varredura central)
    const { results: mov } = await env.DB.prepare(
      `SELECT rca_codigo,
              CAST(COALESCE(json_extract(produtividade_json, '$.dia.positivacao'), 0) AS REAL) AS ped,
              CAST(COALESCE(json_extract(produtividade_json, '$.dia.dig_pedido'), 0) AS REAL) AS dig,
              CAST(COALESCE(json_extract(produtividade_json, '$.dia.total_programado'), 0) AS REAL) AS rota,
              CASE WHEN json_valid(devolucoes_json) AND json_type(devolucoes_json) = 'array' THEN json_array_length(devolucoes_json) ELSE 0 END AS notas,
              CASE WHEN json_valid(devolucoes_json) AND json_type(devolucoes_json) = 'array'
                   THEN COALESCE((SELECT SUM(json_extract(j.value, '$.vl_devolvido')) FROM json_each(devolucoes_json) j), 0) ELSE 0 END AS dev
         FROM varredura_central_rca WHERE data_ref = ?`
    ).bind(dia).all();
    const movDe = new Map((mov || []).map((m) => [String(m.rca_codigo), m]));

    const bancoSet = new Set();
    const bancoForaDaPlanilha = [];
    for (const r of reps || []) {
      const chave = r.filial + '|' + r.codigo;
      bancoSet.add(chave);
      if (!r.ativo || planilha.has(chave) || !planilhaOk) continue;
      const m = movDe.get(String(r.codigo)) || {};
      bancoForaDaPlanilha.push({
        filial: r.filial, codigo: String(r.codigo), nome: r.nome || null,
        rota_hoje: Number(m.rota) || 0, pedidos_hoje: Number(m.ped) || 0, digitado_hoje: arred(m.dig),
        notas_devolucao_mes: Number(m.notas) || 0, devolucao_mes: arred(m.dev),
        com_movimento: !!((Number(m.rota) || 0) > 0 || (Number(m.ped) || 0) > 0 || (Number(m.notas) || 0) > 0)
      });
    }
    bancoForaDaPlanilha.sort((a, b) => Number(b.com_movimento) - Number(a.com_movimento) || b.digitado_hoje - a.digitado_hoje || b.devolucao_mes - a.devolucao_mes);

    const planilhaForaDoBanco = [];
    for (const [chave, p] of planilha) {
      if (bancoSet.has(chave)) continue;
      const [filial, codigo] = chave.split('|');
      const m = movDe.get(codigo) || {};
      planilhaForaDoBanco.push({ filial, codigo, nome: p.nome, canal: p.canal, mostra: p.mostra, supervisor: p.supervisor, rota_hoje: Number(m.rota) || 0, pedidos_hoje: Number(m.ped) || 0, digitado_hoje: arred(m.dig) });
    }

    // DESCOBERTOS
    let descobertos = [], cursor = null;
    try {
      const { results } = await env.DB.prepare(
        "SELECT filial, codigo, notas_mes, devolucao_mes, rota_hoje, pedidos_hoje, dig_hoje, primeira_vez, atualizado_em, CASE WHEN primeira_vez >= datetime('now', '-3 days') THEN 1 ELSE 0 END AS nova FROM codigos_descobertos ORDER BY devolucao_mes DESC"
      ).all();
      descobertos = (results || []).map((d) => ({ ...d, devolucao_mes: arred(d.devolucao_mes), dig_hoje: arred(d.dig_hoje), nova: !!d.nova }));
      cursor = await env.DB.prepare('SELECT pos, ciclo, ciclo_inicio, ciclo_fim FROM descoberta_cursor WHERE id = 1').first();
    } catch { /* tabela ainda não existe: a varredura de descoberta ainda não rodou */ }

    return resp({
      gerado_em: new Date().toISOString(), dia, planilha_lida: planilhaOk,
      resumo: {
        banco_fora_da_planilha: bancoForaDaPlanilha.length,
        banco_fora_da_planilha_com_movimento: bancoForaDaPlanilha.filter((x) => x.com_movimento).length,
        planilha_fora_do_banco: planilhaForaDoBanco.length,
        codigos_descobertos: descobertos.length,
        codigos_descobertos_novos: descobertos.filter((d) => d.nova).length,
        devolucao_descoberta_mes: arred(descobertos.reduce((s, d) => s + d.devolucao_mes, 0))
      },
      varredura_descoberta: cursor || { pos: 0, ciclo: 0, aviso: 'ainda não rodou' },
      banco_fora_da_planilha: bancoForaDaPlanilha,
      planilha_fora_do_banco: planilhaForaDoBanco,
      descobertos
    });
  } catch (e) {
    return resp({ erro: String(e).slice(0, 300) }, 500);
  }
}
