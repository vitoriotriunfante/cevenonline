// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: metas do MÊS por filial, AO VIVO, direto do CEVEN (decisão do Vitório, 04/10/2026:
//          "pegar de CEVEN por CEVEN" — acabou o public/metas_mes.json estático, que era um print
//          do PNA de setembro e nunca se atualizava).
// COMO (desde 13/10/2026): calcula NA HORA, direto da base (varredura_central_rca), por functions/_lib/resumo_base.js — a mesma conta de todas as telas.
//       (antes lia as colunas de resumo_executivo_live, que o
//       cron-faturado-mes.js soma a cada ~15 min a partir do dashboard de cada RCA no CEVEN
//       (varredura_central_rca). Nenhuma chamada nova ao CEVEN aqui: é só leitura do D1.
// FORMATO: o mesmo do antigo metas_mes.json ({mes, filiais:{SIG:{meta_fat, meta_pos}}, total}),
//          para tvapp.html e matrizapp.html trocarem só o endereço.
// REGRA: nunca inventa dado. Sem linha no D1 ou meta zerada => a filial fica FORA do retorno e a
//        tela cai para a "soma dos vendedores" avisando no rótulo (comportamento que já existia).
//        O mês devolvido é o do data_ref mais recente; as telas só usam se for o mês atual.
// AVISO: o que o CEVEN mostra no dashboard dos vendedores é o que sai aqui. Se o CEVEN ainda não
//        carregou as metas do mês novo, o número é o que o CEVEN tem (é a fonte).
// =========================================================================

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=15' };
const resp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });

import { calculaResumoMes } from '../_lib/resumo_base.js';
import R from '../../public/regras.js'; // regras unicas (public/regras.js)

const hojeSP = () => R.hojeSP();

export async function onRequestGet({ env }) {
  if (!env.DB) return resp({ erro: 'D1 (env.DB) não configurado' }, 503);
  try {
    // DIRETO DA BASE, NA HORA (Vitorio, 13/10/2026: "e tudo direto da base"): nao le mais copia recalculada de tempos em tempos.
    // Soma SEMPRE todos os RCAs (leitura de hoje ou a ultima real; ver _lib/resumo_base.js) e diz quantos vieram de cada origem.
    const dataRef = hojeSP();
    const rb = await calculaResumoMes(env, dataRef);
    if (!rb.rcas || !rb.total.metaFaturado) return resp({ erro: 'sem metas na base de hoje ainda' }, 404);
    const filiais = {};
    for (const [sig, a] of Object.entries(rb.porFilial)) if (a.metaFaturado > 0) filiais[sig] = { meta_fat: a.metaFaturado, meta_pos: Math.round(a.metaPositivados) };
    return resp({
      mes: dataRef.slice(0, 7),
      fonte: 'base do CEVEN (varredura central), calculado na hora',
      data_ref: dataRef,
      atualizado_em: new Date().toISOString(),
      integridade: { rcas: rb.rcas, de_hoje: rb.deHoje, leitura_anterior: rb.anteriores, sem_leitura: rb.semLeitura, mais_antiga: rb.maisAntiga },
      filiais,
      total: { meta_fat: rb.total.metaFaturado, meta_pos: Math.round(rb.total.metaPositivados) }
    });
  } catch (e) {
    return resp({ erro: 'falha ao ler metas: ' + e.message }, 500);
  }
}
