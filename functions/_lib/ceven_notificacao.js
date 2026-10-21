// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/ceven_notificacao.js
// O QUE É: envia uma NOTIFICAÇÃO (sino do CEVEN) para Master, Gerente e Supervisor de uma filial, pelo webhook oficial do CEVEN:
//          POST https://ceven.drivetriunfante-locomotiva.com.br/api/notificacoes/webhook/{filial}   (filial = tca1, abc1, tcv1, api1, tpa1, tcg1, tbl1, tph1, mcd1, tsj1, tbe1)
//          Headers: Content-Type: application/json + X-Webhook-Secret   |   Body: { origem, mensagem, supervisorId? }  (21/10/2026: o CEVEN confirmou que o campo e supervisorId, com I maiusculo; com "supervisorid" ia para todos os supervisores da filial)
//          supervisorid (13/10/2026): o CEVEN entrega SO ao supervisor desse id (alem de Master/Gerente da filial). Sem ele, a notificacao vai para todos os supervisores da filial.
// REGRAS:  - O segredo NUNCA fica no código: vem do segredo CEVEN_WEBHOOK_SECRET do Cloudflare Pages (env.CEVEN_WEBHOOK_SECRET). Nunca é registrado em log nem devolvido.
//          - Com supervisorId a notificação vai para aquele supervisor (e Master/Gerente da filial); sem supervisorId vai para todos os supervisores da filial.
//          - Quem decide o QUE e QUANDO enviar é o Vitório. Este módulo só envia; não decide nada sozinho.
// =========================================================================
export const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';
export const FILIAIS_NOTIFICACAO = ['tca1', 'abc1', 'tcv1', 'api1', 'tpa1', 'tcg1', 'tbl1', 'tph1', 'mcd1', 'tsj1', 'tbe1'];

// "TBL" ou "tbl1" -> "tbl1" (ou null se não for filial válida)
export function chaveFilial(f) {
  const s = String(f || '').trim().toLowerCase();
  const k = /^[a-z]{3}$/.test(s) ? s + '1' : s;
  return FILIAIS_NOTIFICACAO.includes(k) ? k : null;
}

export async function enviaNotificacao(env, filial, origem, mensagem, supervisorId = null) {
  const k = chaveFilial(filial);
  if (!k) return { ok: false, erro: 'filial invalida: ' + filial };
  if (!env || !env.CEVEN_WEBHOOK_SECRET) return { ok: false, erro: 'segredo CEVEN_WEBHOOK_SECRET nao configurado' };
  const o = String(origem || '').trim().slice(0, 80), m = String(mensagem || '').trim().slice(0, 1000);
  if (!o || !m) return { ok: false, erro: 'origem e mensagem sao obrigatorias' };
  try {
    const r = await fetch(`${CEVEN_BASE}/api/notificacoes/webhook/${k}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': env.CEVEN_WEBHOOK_SECRET },
      body: JSON.stringify(supervisorId != null && supervisorId !== '' && Number.isFinite(Number(supervisorId)) ? { origem: o, mensagem: m, supervisorId: Number(supervisorId) } : { origem: o, mensagem: m }),
      signal: AbortSignal.timeout(15000)
    });
    return { ok: r.ok, status: r.status, filial: k, supervisorid: supervisorId != null && supervisorId !== '' ? Number(supervisorId) : null };
  } catch (e) {
    return { ok: false, erro: 'falha de rede: ' + String(e.message || e).slice(0, 120), filial: k };
  }
}
