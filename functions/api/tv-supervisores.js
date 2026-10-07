// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: endpoint da TV (CFTV) com a situação dos SUPERVISORES de uma filial no dia:
//          lançou o compromisso ("matinal")? iniciou a rota (RET)?
// PROJETO: CFTV/TV (não é WhatsApp). O ciclo 11:30 do WhatsApp calcula o mesmo dado
//          (pipeline/ceven_unified_engine.js -> coletarAuditoriaCampo). Aqui é a versão da TV.
// LÊ: CEVEN /api/admin/login + /api/admin/supervisores/matriz-compromissos e matriz-ret.
// SEGREDOS (Cloudflare Pages, produção): CEVEN_ADMIN_USER e CEVEN_ADMIN_PASS.
//          Configurar com: npx wrangler pages secret put CEVEN_ADMIN_USER --project-name ceven-cftv-matrix
// REGRA: nunca inventa dado; sem resposta do CEVEN devolve erro (a TV não mostra nada).
// AVISO: o site é público (links /tbl etc. sem senha). Este endpoint devolve só nome do
//        supervisor + 2 booleanos. Se isso passar a ser sensível, proteger com Cloudflare Access.
// =========================================================================

import { NAO_SUPERVISORES, normNome } from '../_lib/nao_supervisores.js';
import { supervisoresAtivos, ehAtivo } from '../_lib/sup_ativos.js';
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
let cache = { token: null, exp: 0 };

async function token(env) {
  if (cache.token && Date.now() < cache.exp) return cache.token;
  const r = await fetch(`${CEVEN}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ username: env.CEVEN_ADMIN_USER, password: env.CEVEN_ADMIN_PASS }),
    signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.access_token) return null;
  cache = { token: j.access_token, exp: Date.now() + 10 * 60 * 1000 };
  return cache.token;
}

async function getJson(url, tk) {
  try {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const limpa = (n) => String(n || '').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim();

export async function onRequestGet({ request, env }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  const filial = (new URL(request.url).searchParams.get('filial') || '').toLowerCase().replace(/1$/, '');
  if (!/^[a-z]{3}$/.test(filial)) return new Response(JSON.stringify({ erro: 'filial (sigla) obrigatória' }), { status: 400, headers: cors });
  if (!env.CEVEN_ADMIN_USER || !env.CEVEN_ADMIN_PASS) return new Response(JSON.stringify({ erro: 'segredos não configurados' }), { status: 503, headers: cors });

  const tk = await token(env);
  if (!tk) return new Response(JSON.stringify({ erro: 'login no CEVEN falhou' }), { status: 502, headers: cors });

  // data de hoje no horário de Brasília
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  const dia = `${p.year}-${p.month}-${p.day}`;

  const [comp, ret] = await Promise.all([
    getJson(`${CEVEN}/api/admin/supervisores/matriz-compromissos?dataInicio=${dia}&dataFim=${dia}`, tk),
    getJson(`${CEVEN}/api/admin/supervisores/matriz-ret?dataInicio=${dia}&dataFim=${dia}`, tk)
  ]);
  if (!comp || !ret) return new Response(JSON.stringify({ erro: 'CEVEN não respondeu (compromissos/RET)' }), { status: 502, headers: cors });

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
          const det = await getJson(
            `${CEVEN}/api/admin/ret/periodo?filial=${key}&supervisorName=${encodeURIComponent(s.nome)}&dataInicio=${dia}&dataFim=${dia}`,
            tk
          );
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

  return new Response(JSON.stringify({ data: dia, filial: filial.toUpperCase(), supervisores, consultado_em: new Date().toISOString() }), { headers: cors });
}
