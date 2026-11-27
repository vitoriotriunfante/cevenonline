// =========================================================================
// FICHA DO ARQUIVO: functions/api/totais-dia.js   (GET /api/totais-dia[?filial=TBL])
// O QUE É: o ÚNICO lugar que calcula VISITAS PROGRAMADAS, VISITAS FEITAS e ZERADOS do dia.
//   TV, Matriz, celular e WhatsApp leem ESTE número; ninguém soma por conta própria.
// FONTE: functions/_lib/fatos/dia.js#produtividadeDiaRede (Clube da Venda) +
//   Gestão de Equipe (/api/tv-mostra), canais de VAREJO (public/regras.js),
//   sem promotor e sem quem tem participa.lances=false.
// ZERO leitura de varredura_central_rca ou cascata_dia.
// =========================================================================
import R from '../../public/regras.js';
import { produtividadeDiaRede } from '../_lib/fatos/dia.js';

const CORS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=10',
};
const FILIAIS = ['TBL', 'TPH', 'TCV', 'ABC', 'TCA', 'MCD', 'TCG', 'API', 'TBE', 'TPA', 'TSJ'];
const ehPromotor = (r) => /^(PROMOTOR|PROMO|P)$/.test(String((r && r.vinculo) || '').toUpperCase());
const ehRep = (r) => !!(r && r.participa && r.participa.lances === false);
let cache = { exp: 0, corpo: null };

function vazio() {
  return { vendedores: 0, lidos: 0, com_rota: 0, programadas: 0, feitas: 0, zerados: 0, completo: false };
}
function soma(acc, v) {
  acc.vendedores++;
  if (!v.lido) return;
  acc.lidos++;
  if (v.com_rota) acc.com_rota++;
  acc.programadas += v.programadas || 0;
  acc.feitas += v.feitas || 0;
  if (v.zerado) acc.zerados++;
}
const fecha = (a) => {
  a.completo = a.vendedores > 0 && a.lidos >= Math.ceil(a.vendedores * 0.9);
  return a;
};

async function calcula(env, request) {
  const dia = R.hojeSP();
  const [m, prod] = await Promise.all([
    fetch(new URL('/api/tv-mostra', request.url), { signal: AbortSignal.timeout(20000) }).then((r) => r.json()),
    produtividadeDiaRede(env.DB, dia),
  ]);
  if (!m || !m.filiais) throw new Error('Gestão de Equipe indisponível');

  const porRca = (prod && prod.porRca) || new Map();
  const vendedores = [];

  for (const sig of FILIAIS) {
    const chaves = Object.keys(m.filiais).filter((k) => k === sig || k.startsWith(sig + '_'));
    for (const k of chaves) {
      for (const r of m.filiais[k] || []) {
        if (!R.ehVarejo(r.canal) || ehPromotor(r) || ehRep(r)) continue;
        const d = porRca.get(`${sig}|${String(r.rca)}`) || null;
        const lido = !!d;
        const programadas = lido ? (Number(d.programadas) || 0) : null;
        const feitas = lido ? (Number(d.feitas) || 0) : null;
        const dig = lido ? (Number(d.digitado) || 0) : null;
        const pos = lido ? (Number(d.positivados) || 0) : null;
        vendedores.push({
          filial: sig,
          grupo: r.grupo || (k.includes('_') ? k.split('_').slice(1).join('_') : ''),
          rca: String(r.rca),
          nome: r.nome || null,
          supervisor: r.supervisor || '',
          canal: String(r.canal || '').toUpperCase(),
          lido,
          idade_s: d ? d.idade_s : null,
          programadas,
          feitas,
          digitado: dig,
          positivados: pos,
          com_rota: lido ? programadas > 0 : null,
          zerado: lido ? programadas > 0 && !(dig > 0) && !(pos > 0) : null,
        });
      }
    }
  }

  const brasil = vazio();
  const filiais = {};
  for (const v of vendedores) {
    soma(brasil, v);
    const f = (filiais[v.filial] = filiais[v.filial] || { ...vazio(), grupos: {} });
    soma(f, v);
    if (v.grupo) soma((f.grupos[v.grupo] = f.grupos[v.grupo] || vazio()), v);
  }
  fecha(brasil);
  for (const f of Object.values(filiais)) {
    fecha(f);
    Object.values(f.grupos).forEach((g) => fecha(g));
  }

  return {
    dia,
    gerado_em: new Date().toISOString(),
    fonte: 'Clube da Venda (fatos/dia) + Gestão de Equipe',
    regra: 'programadas=total_programado; feitas=visitas_na_rota; zerado=com rota e sem digitado e sem positivação',
    brasil,
    filiais,
    faltando: vendedores.filter((v) => !v.lido).map((v) => ({ filial: v.filial, rca: v.rca, nome: v.nome, idade_s: v.idade_s })),
    vendedores,
  };
}

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: CORS });
  const u = new URL(request.url);
  const filial = String(u.searchParams.get('filial') || '').toUpperCase();
  try {
    if (!(cache.corpo && Date.now() < cache.exp && cache.corpo.dia === R.hojeSP())) {
      cache = { exp: Date.now() + 60 * 1000, corpo: await calcula(env, request) };
    }
    const c = cache.corpo;
    const corpo = filial
      ? {
          ...c,
          filiais: { [filial]: c.filiais[filial] || null },
          faltando: c.faltando.filter((v) => v.filial === filial),
          vendedores: c.vendedores.filter((v) => v.filial === filial),
        }
      : c;
    return new Response(JSON.stringify(corpo), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: CORS });
  }
}
