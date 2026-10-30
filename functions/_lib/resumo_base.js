// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/resumo_base.js
// O QUE É: UMA função que calcula meta, faturado e positivação (por filial e total) DIRETO da base (varredura_central_rca), na hora.
//          Lida por /api/metas-mes, /api/mapa-executivo-live (campos do mês), /api/saude e pelo cron-faturado-mes.
// POR QUE (Vitório, 13/10/2026): "é tudo direto da base" — nenhum número de tela pode vir de uma cópia recalculada de tempos em tempos,
//          nem somar só parte dos RCAs. O que a Matriz mostra TEM que ser a base, no mesmo instante, para todas as telas.
// REGRA DE INTEGRIDADE: o total é SEMPRE a soma de TODOS os RCAs da base do dia. Cada RCA entra com a leitura de HOJE; se ainda não foi
//          lido hoje, com a última leitura REAL dos 7 dias anteriores (nunca estimada); se nunca foi lido, fica de fora e é CONTADO.
//          O retorno diz quantos vieram de hoje, de leitura anterior e sem leitura, para a tela poder avisar (nunca esconder).
// =========================================================================
// META OFICIAL = tela "Filiais" do CEVEN (admin/filiais/hierarquia), gravada em meta_hierarquia por filial e vendedor (27/10/2026); sem ela, a do painel do vendedor
const CAMPOS = `CAST(json_extract(dashboard_json, '$.financeiro.faturado') AS REAL) AS fat,
                CAST(json_extract(dashboard_json, '$.financeiro.pendente') AS REAL) AS pend,
                COALESCE((SELECT mh.meta FROM meta_hierarquia mh WHERE mh.filial = varredura_central_rca.filial_sigla AND mh.rca = varredura_central_rca.rca_codigo), CAST(json_extract(dashboard_json, '$.financeiro.meta') AS REAL)) AS meta,
                CAST(json_extract(dashboard_json, '$.positivacao.realizado') AS REAL) AS pos,
                CAST(json_extract(dashboard_json, '$.positivacao.meta') AS REAL) AS pmeta,   /* positivacao: a da tela Filiais esta incoerente (API 146, TCV 846); fica a do painel */
                CAST(COALESCE(json_extract(produtividade_json, '$.dia.dig_pedido'), 0) AS REAL) AS dig,
                (json_extract(dashboard_json, '$.financeiro') IS NOT NULL) AS tem`;

// UNIVERSO = ARVORE VIVA DO CEVEN (Vitorio, 13/10/2026: "a fonte soberana e o CEVEN, a arvore e viva"; o RCA 218 existia na nossa base com meta de R$ 166 mil e o app do
// CEVEN responde "representante nao encontrado"). RCA que NAO esta na arvore e fantasma do cadastro antigo: nao entra em meta, faturado nem lista. Sem arvore carregada
// (menos de 300 RCAs), nao filtra (nunca zera a base por falha da arvore).
export async function universoArvore(env) {
  try {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM arvore_supervisores').first();
    return !!(r && r.n >= 300);
  } catch { return false; }
}
// + so codigo que EXISTE no CEVEN (26/10/2026): rota vaga sem representante (TCG 466, TSJ 3...) tem meta no painel do CEVEN mas nao tem vendedor -> fora de meta e totais
const SO_ARVORE = ' AND EXISTS (SELECT 1 FROM arvore_supervisores a WHERE a.rca = varredura_central_rca.rca_codigo AND a.filial = varredura_central_rca.filial_sigla)'
  + ' AND NOT EXISTS (SELECT 1 FROM canal_ceven c WHERE c.rca = varredura_central_rca.rca_codigo AND c.filial = varredura_central_rca.filial_sigla AND c.existe = 0)';

let cacheResumo = { exp: 0, dataRef: null, res: null };
let tabelaMetaHierarquiaGarantida = false;

export async function calculaResumoMes(env, dataRef) {
  const agora = Date.now();
  if (cacheResumo.res && cacheResumo.dataRef === dataRef && agora < cacheResumo.exp) {
    return cacheResumo.res;
  }
  if (!tabelaMetaHierarquiaGarantida) {
    try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS meta_hierarquia (filial TEXT NOT NULL, rca TEXT NOT NULL, meta REAL, meta_pos REAL, atualizado_em TEXT, PRIMARY KEY (filial, rca))').run(); tabelaMetaHierarquiaGarantida = true; } catch { /* ja existe */ }
  }
  const filtra = await universoArvore(env);
  const F = filtra ? SO_ARVORE : '';
  const { results: hoje } = await env.DB.prepare(
    `SELECT rca_codigo AS r, filial_sigla AS f, ${CAMPOS} FROM varredura_central_rca WHERE data_ref = ?${F}`
  ).bind(dataRef).all();
  const linhas = hoje || [];
  const faltam = linhas.filter((l) => !l.tem).map((l) => String(l.r));
  const anterior = new Map();
  if (faltam.length) {
    const ph = faltam.map(() => '?').join(',');
    const { results: prev } = await env.DB.prepare(
      `SELECT rca_codigo AS r, data_ref AS dia, ${CAMPOS} FROM varredura_central_rca
        WHERE data_ref < ? AND data_ref >= date(?, '-7 days') AND dashboard_json IS NOT NULL AND dashboard_json != 'null' AND rca_codigo IN (${ph}) ORDER BY data_ref`
    ).bind(dataRef, dataRef, ...faltam).all();
    for (const p of prev || []) if (p.tem) anterior.set(String(p.r), p);   // ordenado por dia: o mais recente vence
  }
  const porFilial = {};
  const nova = () => ({ faturado: 0, pendente: 0, metaFaturado: 0, positivados: 0, metaPositivados: 0, digitado: 0, rcas: 0 });
  const total = nova();
  let deHoje = 0, anteriores = 0, semLeitura = 0, maisAntiga = null;
  // DIGITADO DE HOJE (13/10/2026): soma do dia de TODOS os RCAs da arvore, da mesma base. So conta a leitura de HOJE (nunca de dia anterior). Antes a Matriz lia o
  // digitado de uma copia (mapa_executivo_live, atualizada de tempos em tempos) e ficava R$ 20 mil abaixo da Sala de controle no mesmo minuto.
  for (const l of linhas) {
    const sigd = String(l.f || '').toUpperCase();
    const ad = porFilial[sigd] || (porFilial[sigd] = nova());
    ad.digitado += Number(l.dig) || 0; total.digitado += Number(l.dig) || 0;
  }
  for (const l of linhas) {
    let src = l;
    if (l.tem) deHoje++;
    else {
      const p = anterior.get(String(l.r));
      if (p) { src = p; anteriores++; if (!maisAntiga || p.dia < maisAntiga) maisAntiga = p.dia; }
      else { semLeitura++; continue; }
    }
    const sig = String(l.f || '').toUpperCase();
    const a = porFilial[sig] || (porFilial[sig] = nova());
    for (const alvo of [a, total]) {
      alvo.faturado += Number(src.fat) || 0; alvo.pendente += Number(src.pend) || 0;
      alvo.metaFaturado += Number(src.meta) || 0; alvo.positivados += Number(src.pos) || 0; alvo.metaPositivados += Number(src.pmeta) || 0;
      alvo.rcas++;
    }
  }
  const res = { dataRef, rcas: linhas.length, deHoje, anteriores, semLeitura, maisAntiga, porFilial, total };
  cacheResumo = { exp: agora + 25 * 1000, dataRef, res };
  return res;
}
