// =========================================================================
// FICHA DO ARQUIVO: functions/api/diag-premiacao.js   (GET /api/diag-premiacao?chave=...&filial=TPH&cod=59)
// O QUE É: teste (26/10/2026, Vitorio: "e so olhar no gerente do Allison... ele consegue ver a premiacao dele"): com o login do GERENTE da filial, chama o
//   holerite da Premiacao (RV, /rv/api/holerite-resolve?token=...) e devolve a estrutura, para achar a meta de FASEAMENTO, ticket medio e mix do vendedor.
// PROTECAO: chave interna (dados de comissao).
// =========================================================================
import { GERENTES } from '../_lib/arvore_ceven.js';
import { CEVEN_APP_SECRET } from '../_lib/ceven_auth.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br', RV = 'https://mapa.drivetriunfante-lastmile.com.br/rv/api';
export async function onRequestGet({ env, request }) {
  if (!(await chaveAdminOk(env, request))) return new Response('nao autorizado', { status: 401 });
  const u = new URL(request.url), sig = String(u.searchParams.get('filial') || 'TPH').toUpperCase(), cod = u.searchParams.get('cod') || '';
  const g = GERENTES.find((x) => x.sigla === sig);
  const lr = await fetch(`${CEVEN}/api/gerente-auth/login`, { method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json', 'X-App-Secret': CEVEN_APP_SECRET }, body: JSON.stringify({ filial: g.filialKey, nome: g.loginNome, password: env.CEVEN_GERENTE_SENHA }) });
  const lj = lr.ok ? await lr.json().catch(() => null) : null, tk = lj && (lj.access_token || lj.token);
  if (!tk) return new Response(JSON.stringify({ erro: 'login gerente', status: lr.status }), { status: 502 });
  const out = {};
  // A tela do gerente pede ao CEVEN o LINK do holerite (/api/gerente/holerite-link), que traz o token proprio da Premiacao
  try { const hl = await fetch(`${CEVEN}/api/gerente/holerite-link?filial=${g.filialKey}${cod ? '&id=' + cod + '&rca=' + cod : ''}`, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET } }); const t = await hl.text(); out.holerite_link = { status: hl.status, corpo: t.slice(0, 600) };
    const m = t.match(/token=([A-Za-z0-9._\-]+)/); if (m) { for (const q of [`token=${m[1]}`, `token=${m[1]}&cod=${cod}`]) { const r = await fetch(`${RV}/holerite-resolve?${q}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(60000) }); out['resolve ' + q.replace(m[1], 'TKH')] = { status: r.status, corpo: (await r.text()).slice(0, 6000) }; } } } catch (e) { out.holerite_link = { erro: String(e.message || e) }; }
  for (const q of [`token=${tk}`, `token=${tk}&cod=${cod}`, `token=${tk}&codusur=${cod}`, `token=${tk}&mes=2026-10&cod=${cod}`]) {
    try { const r = await fetch(`${RV}/holerite-resolve?${q}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(60000) }); out[q.replace(tk, 'TK')] = { status: r.status, corpo: (await r.text()).slice(0, 3000) }; } catch (e) { out[q.replace(tk, 'TK')] = { erro: String(e.message || e) }; }
  }
  return new Response(JSON.stringify(out, null, 1), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
