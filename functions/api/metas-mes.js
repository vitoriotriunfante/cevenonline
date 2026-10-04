// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: metas do MÊS por filial, AO VIVO, direto do CEVEN (decisão do Vitório, 04/10/2026:
//          "pegar de CEVEN por CEVEN" — acabou o public/metas_mes.json estático, que era um print
//          do PNA de setembro e nunca se atualizava).
// COMO: lê de resumo_executivo_live as colunas mes_meta_faturado / mes_meta_positivados, que o
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

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });

export async function onRequestGet({ env }) {
  if (!env.DB) return resp({ erro: 'D1 (env.DB) não configurado' }, 503);
  try {
    const ult = await env.DB.prepare('SELECT MAX(data_ref) AS d FROM resumo_executivo_live WHERE mes_meta_faturado > 0').first();
    const dataRef = ult && ult.d;
    if (!dataRef) return resp({ erro: 'sem metas no D1 ainda' }, 404);
    const { results } = await env.DB.prepare(
      'SELECT filial_sigla, mes_meta_faturado, mes_meta_positivados, updated_at FROM resumo_executivo_live WHERE data_ref = ?'
    ).bind(dataRef).all();
    const filiais = {};
    let total = null, atualizado = null;
    for (const r of results || []) {
      const mf = Number(r.mes_meta_faturado) || 0, mp = Math.round(Number(r.mes_meta_positivados) || 0); // meta de clientes e inteira (a soma dos dashboards pode vir fracionada)
      if (!atualizado || String(r.updated_at) > atualizado) atualizado = String(r.updated_at);
      if (r.filial_sigla === 'TODAS') { if (mf > 0) total = { meta_fat: mf, meta_pos: mp }; continue; }
      if (mf > 0) filiais[r.filial_sigla] = { meta_fat: mf, meta_pos: mp };
    }
    return resp({
      mes: String(dataRef).slice(0, 7),
      fonte: 'CEVEN ao vivo (soma dos dashboards dos RCAs, via resumo_executivo_live)',
      data_ref: dataRef,
      atualizado_em: atualizado,
      filiais,
      total: total || {
        meta_fat: Object.values(filiais).reduce((a, f) => a + f.meta_fat, 0),
        meta_pos: Object.values(filiais).reduce((a, f) => a + f.meta_pos, 0)
      }
    });
  } catch (e) {
    return resp({ erro: 'falha ao ler metas: ' + e.message }, 500);
  }
}
