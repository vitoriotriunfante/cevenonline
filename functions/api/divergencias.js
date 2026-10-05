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

// LEITURA: o que os numeros dizem sobre a divergencia (para o Vitorio decidir se e valida). Nunca decide por ele: so sugere e mostra os sinais.
function leitura(x) {
  const sinais = [];
  const vende = x.fat_mes > 0 || x.pedidos_hoje > 0;
  const temMeta = x.meta_fat > 0 || x.meta_pos > 0;
  if (x.fat_mes > 0 && !(x.meta_fat > 0)) sinais.push('vendeu no mes mas SEM meta cadastrada');
  if (temMeta && !(x.rota_hoje > 0) && !vende) sinais.push('tem meta mas nao tem rota nem venda');
  if (x.dias_sem_acesso != null && x.dias_sem_acesso >= 7 && (vende || x.rota_hoje > 0)) sinais.push('sem abrir o app ha ' + x.dias_sem_acesso + ' dias, mas tem movimento');
  if (x.pedidos_hoje > 0 && !(x.rota_hoje > 0)) sinais.push('vende sem rota (televenda/loja?)');
  let tipo, texto;
  if (vende && x.rota_hoje > 0) { tipo = 'produzindo'; texto = 'Vendedor ativo e produzindo: provavelmente deve entrar na planilha.'; }
  else if (vende) { tipo = 'vende_sem_rota'; texto = 'Vende mas nao tem rota (televenda, loja ou conta de apoio): confirmar se e vendedor.'; }
  else if (x.rota_hoje > 0) { tipo = 'rota_sem_venda'; texto = 'Tem rota hoje e nenhuma venda: vendedor ativo parado ou novo.'; }
  else if (x.devolucao_mes > 0 || x.notas_devolucao_mes > 0) { tipo = 'so_devolucao'; texto = 'So devolucao no mes: provavel ex-vendedor ou conta de apoio.'; }
  else if (temMeta) { tipo = 'meta_sem_atividade'; texto = 'Tem meta mas nenhuma atividade: conferir se esta ativo.'; }
  else { tipo = 'sem_atividade'; texto = 'Sem rota, venda, meta ou devolucao: provavel conta inativa ou vaga (sem decisao necessaria).'; }
  return { tipo, texto, sinais };
}

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
      'SELECT r.codigo, r.nome, r.ativo, r.setor, r.versao_app, r.ultimo_acesso, r.dias_sem_acesso, UPPER(COALESCE(f.codigo, r.filial_id)) AS filial FROM representantes r LEFT JOIN filiais f ON r.filial_id = f.id'
    ).all();

    // MOVIMENTO DE HOJE (varredura central)
    const { results: mov } = await env.DB.prepare(
      `SELECT rca_codigo,
              CAST(COALESCE(json_extract(produtividade_json, '$.dia.positivacao'), 0) AS REAL) AS ped,
              CAST(COALESCE(json_extract(produtividade_json, '$.dia.dig_pedido'), 0) AS REAL) AS dig,
              CAST(COALESCE(json_extract(produtividade_json, '$.dia.total_programado'), 0) AS REAL) AS rota,
              CAST(COALESCE(json_extract(produtividade_json, '$.dia.visitas_na_rota'), 0) AS REAL) AS vis,
              CAST(COALESCE(json_extract(dashboard_json, '$.financeiro.meta'), 0) AS REAL) AS meta_fat,
              CAST(COALESCE(json_extract(dashboard_json, '$.financeiro.faturado'), 0) AS REAL) AS fat_mes,
              CAST(COALESCE(json_extract(dashboard_json, '$.financeiro.pendente'), 0) AS REAL) AS pendente,
              CAST(COALESCE(json_extract(dashboard_json, '$.positivacao.meta'), 0) AS REAL) AS meta_pos,
              CAST(COALESCE(json_extract(dashboard_json, '$.positivacao.realizado'), 0) AS REAL) AS pos_mes,
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
        rota_hoje: Number(m.rota) || 0, visitas_hoje: Number(m.vis) || 0, pedidos_hoje: Number(m.ped) || 0, digitado_hoje: arred(m.dig),
        meta_fat: arred(m.meta_fat), fat_mes: arred(m.fat_mes), pendente: arred(m.pendente), meta_pos: Number(m.meta_pos) || 0, pos_mes: Number(m.pos_mes) || 0,
        notas_devolucao_mes: Number(m.notas) || 0, devolucao_mes: arred(m.dev),
        setor: r.setor || null, versao_app: r.versao_app || null, ultimo_acesso: r.ultimo_acesso || null, dias_sem_acesso: r.dias_sem_acesso == null ? null : Number(r.dias_sem_acesso),
        com_movimento: !!((Number(m.rota) || 0) > 0 || (Number(m.ped) || 0) > 0 || (Number(m.notas) || 0) > 0)
      });
    }
    for (const x of bancoForaDaPlanilha) x.leitura = leitura(x);
    bancoForaDaPlanilha.sort((a, b) => Number(b.com_movimento) - Number(a.com_movimento) || b.digitado_hoje - a.digitado_hoje || b.devolucao_mes - a.devolucao_mes);

    const planilhaForaDoBanco = [];
    for (const [chave, p] of planilha) {
      if (bancoSet.has(chave)) continue;
      const [filial, codigo] = chave.split('|');
      const m = movDe.get(codigo) || {};
      const it = { filial, codigo, nome: p.nome, canal: p.canal, mostra: p.mostra, supervisor: p.supervisor, rota_hoje: Number(m.rota) || 0, visitas_hoje: Number(m.vis) || 0, pedidos_hoje: Number(m.ped) || 0, digitado_hoje: arred(m.dig), meta_fat: arred(m.meta_fat), fat_mes: arred(m.fat_mes), meta_pos: Number(m.meta_pos) || 0, pos_mes: Number(m.pos_mes) || 0, notas_devolucao_mes: Number(m.notas) || 0, devolucao_mes: arred(m.dev), dias_sem_acesso: null };
      it.leitura = leitura(it);
      planilhaForaDoBanco.push(it);
    }

    // DESCOBERTOS
    let descobertos = [], cursor = null;
    try {
      const { results } = await env.DB.prepare(
        "SELECT filial, codigo, nome, meta_fat, fat_mes, meta_pos, notas_mes, devolucao_mes, rota_hoje, pedidos_hoje, dig_hoje, primeira_vez, atualizado_em, CASE WHEN primeira_vez >= datetime('now', '-3 days') THEN 1 ELSE 0 END AS nova FROM codigos_descobertos ORDER BY devolucao_mes DESC"
      ).all();
      descobertos = (results || []).map((d) => {
        const it = { ...d, devolucao_mes: arred(d.devolucao_mes), dig_hoje: arred(d.dig_hoje), meta_fat: arred(d.meta_fat), fat_mes: arred(d.fat_mes), meta_pos: Number(d.meta_pos) || 0, nova: !!d.nova, notas_devolucao_mes: d.notas_mes, digitado_hoje: arred(d.dig_hoje) };
        const nm = String(d.nome || '').toUpperCase();
        if (String(d.codigo) === '2' || /VENDAS? EMPRESA/.test(nm)) it.leitura = { tipo: 'conta_interna', texto: 'Conta interna da empresa (venda empresa): não é vendedor, sem decisão necessária.', sinais: [] };
        else if (/^VAGO/.test(nm)) it.leitura = { tipo: 'vaga', texto: 'Vaga em aberto: rota sem vendedor.', sinais: [] };
        else it.leitura = leitura(it);
        return it;
      });
      cursor = await env.DB.prepare('SELECT pos, ciclo, ciclo_inicio, ciclo_fim FROM descoberta_cursor WHERE id = 1').first();
    } catch { /* tabela ainda não existe: a varredura de descoberta ainda não rodou */ }

    return resp({
      gerado_em: new Date().toISOString(), dia, planilha_lida: planilhaOk,
      resumo: {
        banco_fora_da_planilha: bancoForaDaPlanilha.length,
        banco_fora_da_planilha_com_movimento: bancoForaDaPlanilha.filter((x) => x.com_movimento).length,
        banco_fora_produzindo: bancoForaDaPlanilha.filter((x) => x.leitura.tipo === 'produzindo').length,
        banco_fora_sem_atividade: bancoForaDaPlanilha.filter((x) => x.leitura.tipo === 'sem_atividade').length,
        faturado_mes_fora_da_planilha: arred(bancoForaDaPlanilha.reduce((s2, x) => s2 + x.fat_mes, 0)),
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
