// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/cache_resposta.js
// O QUE É: guarda no D1 a ÚLTIMA resposta boa de um endpoint (ex.: supervisores do dia) para servir quando o CEVEN travar.
// POR QUE (Vitório, 15/10/2026 23h): o login de admin do CEVEN parou de responder e /supervisores ficou vazio nas 11 filiais.
// REGRA: nunca inventa — devolve o dado REAL da última leitura, com a hora dela (dado_de); a chave inclui o dia, então dado de ontem nunca aparece hoje.
// =========================================================================
export async function guardaResposta(env, chave, obj) {
  if (!env || !env.DB) return;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS cache_resposta (chave TEXT PRIMARY KEY, json TEXT, em INTEGER NOT NULL)').run();
    await env.DB.prepare('INSERT OR REPLACE INTO cache_resposta (chave, json, em) VALUES (?, ?, ?)').bind(chave, JSON.stringify(obj), Date.now()).run();
  } catch { /* cache e so reserva */ }
}
export async function leResposta(env, chave) {
  if (!env || !env.DB) return null;
  try {
    const r = await env.DB.prepare('SELECT json, em FROM cache_resposta WHERE chave = ?').bind(chave).first();
    return r ? { ...JSON.parse(r.json), reserva: true, dado_de: new Date(r.em).toISOString() } : null;
  } catch { return null; }
}
