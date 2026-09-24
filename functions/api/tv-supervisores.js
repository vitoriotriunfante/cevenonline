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

  const key = filial + '1';
  const feito = (s) => !!(s && ((s.porDia && s.porDia[0]) || (s.dias && s.dias[0])));
  const supervisores = (comp.supervisores || [])
    .filter((s) => s.filial === key)
    .map((s) => {
      const r = (ret.supervisores || []).find((x) => x.id === s.id || x.nome === s.nome);
      return { id: s.id, nome: limpa(s.nome), fez_compromisso: feito(s), iniciou_ret: feito(r) };
    });

  return new Response(JSON.stringify({ data: dia, filial: filial.toUpperCase(), supervisores, consultado_em: new Date().toISOString() }), { headers: cors });
}
