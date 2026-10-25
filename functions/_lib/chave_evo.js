// =========================================================================
// FICHA: functions/_lib/chave_evo.js — autorização das chamadas que vêm do GitHub (motor, boas-vindas, guarda de custo).
// POR QUÊ (25/10/2026): o EVO_KEY do GitHub e o do Cloudflare são chaves DIFERENTES e ambas válidas na Evolution (chave geral x chave da
//   instância). Comparar texto com texto dava 401. Regra: vale a chave igual à do Cloudflare OU qualquer chave que a PRÓPRIA Evolution aceite
//   (quem tem chave válida da Evolution já manda mensagem em nome do JOTA; não ganha poder novo aqui). Resultado guardado 10 min por instância.
// =========================================================================
const cache = new Map();
export async function chaveEvoValida(request, env) {
  const k = request.headers.get('x-evo-key') || '';
  if (!k) return false;
  if (env.EVO_KEY && k === env.EVO_KEY) return true;
  const c = cache.get(k);
  if (c && Date.now() - c.em < 10 * 60 * 1000) return c.ok;
  let ok = false;
  try {
    const base = String(env.EVO_URL || '').replace(/\/$/, '');
    const r = await fetch(`${base}/instance/connectionState/${env.EVO_INSTANCE || 'ceven-noc'}`, { headers: { apikey: k }, signal: AbortSignal.timeout(8000) });
    ok = r.ok;
  } catch (e) { ok = false; }
  cache.set(k, { ok, em: Date.now() });
  return ok;
}
