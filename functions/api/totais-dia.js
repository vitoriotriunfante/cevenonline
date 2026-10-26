// =========================================================================
// FICHA DO ARQUIVO: functions/api/totais-dia.js   (GET /api/totais-dia[?filial=TBL])
// O QUE É: o ÚNICO lugar que calcula VISITAS PROGRAMADAS, VISITAS FEITAS e ZERADOS do dia (Vitório, 26/10/2026: "todos os dados precisam estar
//   iguais e corretos" — TV 1/3.013 e 225 zerados, PC 1/3.960 e 290, WhatsApp 4.220 + "Total" de arquivo de 23/09, tudo na mesma manhã).
//   TV, Matriz, celular e WhatsApp leem ESTE número; ninguém soma por conta própria.
// FONTE: produtividade de cada RCA gravada pela varredura central (varredura_central_rca), lida a CADA rodada (camada quente) — por isso é a
//   parte mais completa da base (roteiro é lido em fatias e leva 429 do CEVEN). Nunca vai ao CEVEN ao vivo.
// UNIVERSO: Gestão de Equipe (/api/tv-mostra, já cortada pela árvore viva), canais de VAREJO (public/regras.js), sem promotor e sem quem
//   tem participa.lances=false — o mesmo recorte de "campo" da Matriz.
// REGRAS: programadas = dia.total_programado; feitas = dia.visitas_na_rota; com rota = programadas > 0;
//   ZERADO = com rota e sem digitado e sem positivação hoje.
// COBERTURA: diz quantos vendedores do universo têm produtividade na base e quais faltam. completo=false => quem mostra não pode exibir
//   o número como total (mostra "lidos X de Y"). Nunca inventa nem completa com estimativa.
// =========================================================================
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
const CORS = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const FILIAIS = ['TBL', 'TPH', 'TCV', 'ABC', 'TCA', 'MCD', 'TCG', 'API', 'TBE', 'TPA', 'TSJ'];
const MAX_IDADE_S = 45 * 60;   // linha mais velha que isso não conta como lida (mesma tolerância do motor do WhatsApp, pipeline/fonte_base.js)
const num = (v) => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));
const ehPromotor = (r) => /^(PROMOTOR|PROMO|P)$/.test(String((r && r.vinculo) || '').toUpperCase());
const ehRep = (r) => !!(r && r.participa && r.participa.lances === false);
let cache = { exp: 0, corpo: null };

function vazio() { return { vendedores: 0, lidos: 0, com_rota: 0, programadas: 0, feitas: 0, zerados: 0, completo: false }; }
function soma(acc, v) {
  acc.vendedores++;
  if (!v.lido) return;
  acc.lidos++;
  if (v.com_rota) acc.com_rota++;
  acc.programadas += v.programadas || 0; acc.feitas += v.feitas || 0;
  if (v.zerado) acc.zerados++;
}
const fecha = (a) => { a.completo = a.vendedores > 0 && a.lidos === a.vendedores; return a; };

async function calcula(env, request) {
  const dia = R.hojeSP();
  const m = await (await fetch(new URL('/api/tv-mostra', request.url), { signal: AbortSignal.timeout(20000) })).json();
  if (!m || !m.filiais) throw new Error('Gestão de Equipe indisponível');
  const { results } = await env.DB.prepare('SELECT rca_codigo, filial_sigla, produtividade_json, updated_at FROM varredura_central_rca WHERE data_ref = ?').bind(dia).all();
  const agora = Date.now(), base = new Map();
  for (const r of results || []) base.set(String(r.filial_sigla).toUpperCase() + '|' + String(r.rca_codigo), r);

  const vendedores = [];
  for (const sig of FILIAIS) {
    const chaves = Object.keys(m.filiais).filter((k) => k === sig || k.startsWith(sig + '_'));
    for (const k of chaves) for (const r of m.filiais[k] || []) {
      if (!R.ehVarejo(r.canal) || ehPromotor(r) || ehRep(r)) continue;
      const linha = base.get(sig + '|' + String(r.rca));
      let d = null, idade = null;
      if (linha) {
        const t = Date.parse(String(linha.updated_at || '').replace(' ', 'T') + 'Z');
        idade = Number.isFinite(t) ? Math.round((agora - t) / 1000) : null;
        try { const p = JSON.parse(linha.produtividade_json || 'null'); d = p && p.dia ? p.dia : null; } catch (e) { d = null; }
      }
      const lido = !!d && idade != null && idade <= MAX_IDADE_S;
      const programadas = lido ? num(d.total_programado) || 0 : null;
      const dig = lido ? num(d.dig_pedido) || 0 : null, pos = lido ? num(d.positivacao) || 0 : null;
      vendedores.push({
        filial: sig, grupo: r.grupo || (k.includes('_') ? k.split('_').slice(1).join('_') : ''), rca: String(r.rca), nome: r.nome || null, supervisor: r.supervisor || '',
        canal: String(r.canal || '').toUpperCase(), lido, idade_s: idade,
        programadas, feitas: lido ? num(d.visitas_na_rota) || 0 : null, digitado: dig, positivados: pos,
        com_rota: lido ? programadas > 0 : null, zerado: lido ? programadas > 0 && !(dig > 0) && !(pos > 0) : null
      });
    }
  }
  const brasil = vazio(), filiais = {};
  for (const v of vendedores) {
    soma(brasil, v);
    const f = (filiais[v.filial] = filiais[v.filial] || { ...vazio(), grupos: {} });
    soma(f, v);
    if (v.grupo) soma((f.grupos[v.grupo] = f.grupos[v.grupo] || vazio()), v);
  }
  fecha(brasil);
  for (const f of Object.values(filiais)) { fecha(f); Object.values(f.grupos).forEach(fecha); }
  return {
    dia, gerado_em: new Date().toISOString(), fonte: 'varredura_central_rca.produtividade + Gestão de Equipe (varejo de campo)',
    regra: 'programadas=total_programado; feitas=visitas_na_rota; zerado=com rota e sem digitado e sem positivação',
    brasil, filiais, faltando: vendedores.filter((v) => !v.lido).map((v) => ({ filial: v.filial, rca: v.rca, nome: v.nome, idade_s: v.idade_s })), vendedores
  };
}

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: CORS });
  const u = new URL(request.url), filial = String(u.searchParams.get('filial') || '').toUpperCase();
  try {
    if (!(cache.corpo && Date.now() < cache.exp && cache.corpo.dia === R.hojeSP())) cache = { exp: Date.now() + 60 * 1000, corpo: await calcula(env, request) };
    const c = cache.corpo;
    const corpo = filial ? { ...c, filiais: { [filial]: c.filiais[filial] || null }, faltando: c.faltando.filter((v) => v.filial === filial), vendedores: c.vendedores.filter((v) => v.filial === filial) } : c;
    return new Response(JSON.stringify(corpo), { headers: CORS });
  } catch (e) { return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: CORS }); }
}
