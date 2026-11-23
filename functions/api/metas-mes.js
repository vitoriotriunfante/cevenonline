// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: metas do MÊS por filial (faturamento e positivação) para a TV da filial e a Matriz.
// FONTE (Vitorio, 23/11/2026: "A meta que precisa estar por filial de faturamento e positivacao... e do GEROT!"):
//   GEROT do mes atual, nivel FILIAL (gerot_filial_mes: 'Meta (R$)' e 'Meta de positivação'). Nunca soma de vendedores
//   (a positivacao nao soma: o mesmo cliente de duas pastas conta duas vezes — docs/DICIONARIO_KPIS.md 3.9/3.10).
//   Total Brasil = soma das 11 filiais (igual a tela Visao Geral do GEROT: R$ 80,67 mi e 28.050 clientes em 23/11).
//   Antes (13/10 a 22/11) lia a base do CEVEN (varredura_central_rca), parada desde 16/11.
// FORMATO: {mes, fonte, posicao, filiais:{SIG:{meta_fat, meta_pos, fat_liq, positivados, carteira}}, total} — o mesmo que tvapp/matrizapp ja leem.
// REGRA: sem a filial no GEROT do mes = fica fora (a tela avisa); nunca inventa.
// =========================================================================

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60, s-maxage=60' };
const resp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });
import R from '../../public/regras.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return resp({ erro: 'D1 (env.DB) não configurado' }, 503);
  try {
    const mes = R.hojeSP().slice(0, 7);
    const { results } = await env.DB.prepare('SELECT filial, dados FROM gerot_filial_mes WHERE mes = ?').bind(mes).all();
    const st = await env.DB.prepare('SELECT posicao FROM gerot_coleta_status ORDER BY id DESC LIMIT 1').first().catch(() => null);
    const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
    const filiais = {}; const total = { meta_fat: 0, meta_pos: 0, fat_liq: 0, positivados: 0, carteira: 0 };
    for (const r of results || []) {
      let d = {}; try { d = JSON.parse(r.dados || '{}'); } catch (e) { continue; }
      const f = { meta_fat: num(d['Meta (R$)']), meta_pos: num(d['Meta de positivação']), fat_liq: num(d['Faturado líquido (R$)']), positivados: num(d['Positivação (filial + CNPJ)']), carteira: num(d['Carteira pendente (R$)']) };
      if (!(f.meta_fat > 0)) continue;
      filiais[r.filial] = f;
      for (const k of Object.keys(total)) total[k] += f[k] || 0;
    }
    if (!Object.keys(filiais).length) return resp({ erro: 'sem metas do GEROT para ' + mes }, 404);
    return resp({ mes, fonte: 'GEROT (meta da filial)', posicao: st ? st.posicao : null, atualizado_em: new Date().toISOString(), filiais, total: { ...total, meta_pos: Math.round(total.meta_pos) } });
  } catch (e) {
    return resp({ erro: 'falha ao ler metas: ' + e.message }, 500);
  }
}
