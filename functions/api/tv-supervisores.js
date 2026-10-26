// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: endpoint da TV (CFTV) com a situação dos SUPERVISORES de uma filial no dia:
//          lançou o compromisso ("matinal")? iniciou a rota (RET)?
// PROJETO: CFTV/TV (não é WhatsApp). O ciclo 11:30 do WhatsApp calcula o mesmo dado
//          (pipeline/ceven_unified_engine.js -> coletarAuditoriaCampo). Aqui é a versão da TV.
// LÊ: a BASE ÚNICA (D1 supervisores_dia / supervisores_ret_detalhe), gravada pelo coletor (functions/_lib/supervisores_coleta.js). Desde 26/10/2026 não fala com o CEVEN.
// SEGREDOS (Cloudflare Pages, produção): CEVEN_ADMIN_USER e CEVEN_ADMIN_PASS.
//          Configurar com: npx wrangler pages secret put CEVEN_ADMIN_USER --project-name ceven-cftv-matrix
// REGRA: nunca inventa dado; sem resposta do CEVEN devolve erro (a TV não mostra nada).
// AVISO: o site é público (links /tbl etc. sem senha). Este endpoint devolve só nome do
//        supervisor + 2 booleanos. Se isso passar a ser sensível, proteger com Cloudflare Access.
// =========================================================================

import { NAO_SUPERVISORES, normNome } from '../_lib/nao_supervisores.js';
import { supervisoresAtivos, ehAtivo } from '../_lib/sup_ativos.js';
import { comCache } from '../_lib/cache_borda.js';
import { lerSupervisoresDia } from '../_lib/supervisores_coleta.js';   // base unica (26/10/2026)
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
const limpa = (n) => String(n || '').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim();

async function semCache({ request, env }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  const filial = (new URL(request.url).searchParams.get('filial') || '').toLowerCase().replace(/1$/, '');
  if (!/^[a-z]{3}$/.test(filial)) return new Response(JSON.stringify({ erro: 'filial (sigla) obrigatória' }), { status: 400, headers: cors });

  // data de hoje no horário de Brasília
  const dia = R.hojeSP();

  // BASE UNICA (26/10/2026): compromissos e RET vem do D1, gravados pelo coletor (functions/_lib/supervisores_coleta.js). Nunca vai ao CEVEN daqui.
  const base = await lerSupervisoresDia(env, dia);
  const comp = base && base.compromissos && base.compromissos.j, ret = base && base.ret && base.ret.j;
  if (!comp || !ret) return new Response(JSON.stringify({ erro: 'sem dado na base ainda (compromissos/RET)' }), { status: 503, headers: cors });

  const ativos = await supervisoresAtivos(env);
  const key = filial + '1';
  const feito = (s) => !!(s && ((s.porDia && s.porDia[0]) || (s.dias && s.dias[0])));
  const supsComp = (comp.supervisores || []).filter((s) => s.filial === key && !NAO_SUPERVISORES.some((x) => x.nome === normNome(s.nome) && x.filial === filial.toUpperCase()) && ehAtivo(ativos, filial, s.nome)); // nao-supervisores (04/10/2026) ficam fora

  // Busca detalhes de RET (visitas e fotos) para quem iniciou rota
  const supervisores = await Promise.all(
    supsComp.map(async (s) => {
      const r = (ret.supervisores || []).find((x) => x.id === s.id || x.nome === s.nome);
      const fezRet = feito(r);
      let retDetalhe = null;

      if (fezRet) {
        try {
          const det = base.detalhe.get(key + '|' + s.nome) || null;
          const d0 = det && det.dias && det.dias[0];
          if (d0 && d0.visitas && d0.visitas.length) {
            const fotos = [];
            d0.visitas.forEach((v) => {
              if (v.photo_url) fotos.push({ url: v.photo_url, cliente: v.client_name, rca: v.rca_name, score: v.ia_score });
              (v.checklist?.photos || []).forEach((cp) => {
                if (cp && cp.url && !fotos.some((f) => f.url === cp.url)) {
                  fotos.push({ url: cp.url, cliente: v.client_name, rca: v.rca_name, score: v.ia_score });
                }
              });
            });
            const scores = d0.visitas.map((v) => v.ia_score || 0);
            const scoreMedio = Math.round(scores.reduce((a, b) => a + b, 0) / (scores.length || 1));
            retDetalhe = {
              pdvs: d0.visitas.length,
              primeiroCheckin: d0.overview?.primeiroCheckin ? d0.overview.primeiroCheckin.slice(11, 16) : null,
              ultimoCheckout: d0.overview?.ultimoCheckout ? d0.overview.ultimoCheckout.slice(11, 16) : null,
              rca: d0.visitas[0]?.rca_name ? limpa(d0.visitas[0].rca_name) : null,
              ultimoCliente: d0.visitas[d0.visitas.length - 1]?.client_name || null,
              scoreMedio,
              fotos: fotos.slice(0, 6) // Até 6 fotos da rota
            };
          }
        } catch {}
      }

      return {
        id: s.id,
        nome: limpa(s.nome),
        fez_compromisso: feito(s),
        iniciou_ret: fezRet,
        retDetalhe
      };
    })
  );

  return new Response(JSON.stringify({ data: dia, filial: filial.toUpperCase(), supervisores, consultado_em: new Date().toISOString(), base_compromissos_em: base.compromissos.em, base_ret_em: base.ret.em }), { headers: cors });
}

// CACHE (25/10/2026, custo Cloudflare): varias TVs/telas = 1 leitura da base a cada 5 min. ?fresco=1 ignora o cache.
export const onRequestGet = (ctx) => comCache(ctx, 300, semCache);
