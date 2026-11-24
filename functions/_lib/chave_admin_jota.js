// Chave de uso interno (Claude/Vitorio) para rotas administrativas do JOTA: guardada no D1 (config_flags 'jota_admin_token'), nunca no codigo. 26/10/2026.
let _tok = null, _tokEm = 0;
export async function chaveAdminOk(env, request) {
  try {
    const k = new URL(request.url).searchParams.get('chave') || request.headers.get('x-chave') || '';
    if (!k || k.length < 24) return false;
    if (_tok && Date.now() - _tokEm < 300000) return _tok === k;
    for (const ms of [0, 250, 600]) {
      if (ms) await new Promise((ok) => setTimeout(ok, ms));
      try {
        const r = await env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'jota_admin_token'").first();
        if (r && r.valor) { _tok = r.valor; _tokEm = Date.now(); return _tok === k; }
        return false;
      } catch {}
    }
    return false;
  } catch { return false; }
}
