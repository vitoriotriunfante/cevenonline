// =========================================================================
// FICHA DO ARQUIVO: functions/api/diag-supervisor-caminhos.js   (GET /api/diag-supervisor-caminhos?filial=TBL)
// O QUE É: teste (26/10/2026, Vitório: "se vc entrar nos gerentes e acessar os roteiros vc também consegue ver... não dá para fazer a chamada com mais de 1 vendedor?").
//   Pelas gravações das telas (HAR), /api/supervisor/roteiro-mes traz o roteiro de TODOS os vendedores de um supervisor numa chamada (1.448 linhas) e
//   /api/supervisor/tabelas a produtividade deles. Se servir com o login do gerente e não cair na cota de 3-4/min do /api/rca/*, o coletor troca ~600 chamadas por ~60.
// DEVOLVE: só contagens (linhas, linhas de hoje, status, vendedores, campos) e quantos 429 deu. Nenhum token, senha ou dado de cliente. Cache de 10 min.
// =========================================================================
import { GERENTES } from '../_lib/arvore_ceven.js';
import { CEVEN_APP_SECRET } from '../_lib/ceven_auth.js';
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const CORS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const cache = new Map();

async function chama(url, tk) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { ...(tk ? { Authorization: 'Bearer ' + tk } : {}), 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(30000) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { status: r.status, ms: Date.now() - t0, j };
  } catch (e) { return { status: 0, ms: Date.now() - t0, erro: String(e.message || e).slice(0, 100) }; }
}
function resumo(x, hoje) {
  const o = { status: x.status, ms: x.ms };
  if (Array.isArray(x.j)) {
    const deHoje = x.j.filter((c) => String(c.data_visita || '').slice(0, 10) === hoje), st = {};
    deHoje.forEach((c) => { st[c.status] = (st[c.status] || 0) + 1; });
    Object.assign(o, { linhas: x.j.length, linhas_hoje: deHoje.length, status_hoje: st, vendedores: new Set(x.j.map((c) => c.id_representante)).size, campos: Object.keys(x.j[0] || {}) });
  } else if (x.j && typeof x.j === 'object') o.chaves = Object.keys(x.j).slice(0, 15);
  return o;
}

export async function onRequestGet({ env, request }) {
  const sig = String(new URL(request.url).searchParams.get('filial') || 'TBL').toUpperCase();
  const c = cache.get(sig); if (c && Date.now() < c.exp) return new Response(c.corpo, { headers: CORS });
  const g = GERENTES.find((x) => x.sigla === sig);
  if (!g || !env.CEVEN_GERENTE_SENHA) return new Response(JSON.stringify({ erro: 'filial desconhecida ou sem CEVEN_GERENTE_SENHA' }), { status: 400, headers: CORS });
  const hoje = R.hojeSP(), out = { filial: sig, hoje, testado_em: new Date().toISOString() };
  const lr = await fetch(`${CEVEN}/api/gerente-auth/login`, { method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json', 'X-App-Secret': CEVEN_APP_SECRET }, body: JSON.stringify({ filial: g.filialKey, nome: g.loginNome, password: env.CEVEN_GERENTE_SENHA }), signal: AbortSignal.timeout(15000) });
  out.login_gerente = lr.status;
  const lj = lr.ok ? await lr.json().catch(() => null) : null, tk = lj && (lj.access_token || lj.token);
  if (!tk) return new Response(JSON.stringify(out), { headers: CORS });
  const cas = await chama(`${CEVEN}/api/gerente/tabelas-cascata?filial=${g.filialKey}`, tk);
  const sups = ((cas.j && cas.j.supervisores) || []).map((s) => s.supervisorId).filter((x) => x != null);
  out.cascata = { status: cas.status, ms: cas.ms, supervisores: sups.length };
  if (!sups.length) return new Response(JSON.stringify(out), { headers: CORS });
  const s0 = sups[0];
  out.supervisor_testado = String(s0);
  for (const e of ['supervisor/roteiro-mes', 'supervisor/tabelas', 'supervisor/produtividade', 'supervisor/dashboard', 'supervisor/rcas', 'gerente/supervisor/rcas']) {
    const q = e.startsWith('gerente/') ? `filial=${g.filialKey}&supervisorId=${s0}` : `filial=${g.filialKey}&id=${s0}`;
    out[e] = resumo(await chama(`${CEVEN}/api/${e}?${q}`, tk), hoje);
  }
  // COTA: roteiro de todos os supervisores da filial em sequência; conta 429
  const cota = { chamadas: 0, ok: 0, r429: 0, outros: 0, linhas_hoje: 0, vendedores: 0, ms_total: 0 };
  for (const s of sups) {
    const x = await chama(`${CEVEN}/api/supervisor/roteiro-mes?filial=${g.filialKey}&id=${s}`, tk);
    cota.chamadas++; cota.ms_total += x.ms;
    if (x.status === 200) { cota.ok++; if (Array.isArray(x.j)) { const h = x.j.filter((c) => String(c.data_visita || '').slice(0, 10) === hoje); cota.linhas_hoje += h.length; cota.vendedores += new Set(h.map((c) => c.id_representante)).size; } }
    else if (x.status === 429) cota.r429++; else cota.outros++;
  }
  out.cota_roteiro_todos_supervisores = cota;
  const corpo = JSON.stringify(out);
  cache.set(sig, { exp: Date.now() + 10 * 60 * 1000, corpo });
  return new Response(corpo, { headers: CORS });
}
