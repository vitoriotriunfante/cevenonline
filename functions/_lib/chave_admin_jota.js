// Chave de uso interno (Claude/Vitorio) para rotas administrativas do JOTA: guardada no D1 (config_flags 'jota_admin_token'), nunca no codigo. 26/10/2026.
export async function chaveAdminOk(env, request) {
  try {
    const k = new URL(request.url).searchParams.get('chave') || request.headers.get('x-chave') || '';
    if (!k || k.length < 24) return false;
    const r = await env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'jota_admin_token'").first();
    return !!(r && r.valor && r.valor === k);
  } catch { return false; }
}
