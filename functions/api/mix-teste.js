/**
 * FICHA DO ARQUIVO: functions/api/mix-teste.js  (POST /api/mix-teste)
 * TESTE DO UNIVERSO DO +MIX (Vitório, 20/10/2026): o +MIX de hoje compara o cliente só com a carteira do próprio vendedor.
 * Aqui o mesmo cliente é consultado duas vezes no CEVEN: (a) universo = carteira do vendedor (como o app faz) e
 * (b) universo = clientes da filial inteira a até 3 km (qualquer vendedor). A tela /mix soma e mostra a diferença.
 * Só lê o CEVEN; não grava nada. Corpo: { rca, target, proprio: [cnpj], regiao: [cnpj] }.
 */
import { CEVEN_APP_SECRET } from '../_lib/ceven_auth.js';

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const so = (x) => String(x || '').replace(/\D/g, '');

async function gap(target, universo, rca) {
  try {
    const r = await fetch(`${CEVEN}/mixapi/mix/gap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET },
      body: JSON.stringify({ target_cnpj: target, universo_cnpjs: universo, limite: 100, raio_km: 3, cod_rca: Number(rca) }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) return null;
    const g = await r.json();
    if (!g || !g.disponivel) return null;
    const cods = {};
    for (const ind of g.industrias_gap || []) for (const p of ind.produtos || []) cods[String(p.codprod)] = [p.produto || '', ind.industria || '', p.penetracao ?? null];
    for (const p of g.produtos_top || []) if (!cods[String(p.codprod)]) cods[String(p.codprod)] = [p.produto || '', p.industria || '', p.penetracao ?? null];
    return { universo: g.total_universo ?? universo.length, cods };
  } catch { return null; }
}

export async function onRequestPost({ request }) {
  let b;
  try { b = await request.json(); } catch { return Response.json({ erro: 'corpo inválido' }, { status: 400 }); }
  const target = so(b.target), rca = so(b.rca);
  const lim = (l) => (Array.isArray(l) ? l.map(so).filter((x) => x.length === 14).slice(0, 400) : []);
  const proprio = lim(b.proprio), regiao = lim(b.regiao);
  if (target.length !== 14 || !proprio.length || !regiao.length) return Response.json({ erro: 'faltam dados' }, { status: 400 });
  const [a, r] = await Promise.all([gap(target, proprio, rca), gap(target, regiao, rca)]);
  return Response.json({ target, proprio: a, regiao: r }, { headers: { 'Cache-Control': 'no-store' } });
}
