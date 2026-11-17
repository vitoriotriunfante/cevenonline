// =========================================================================
// FICHA: functions/_lib/monitoria/trava_envio.js
// POR QUE (16/11/2026): a pausa 'so resposta' (config_flags 'wa_pausa_proativa_ate', ligada ate 2099 desde a restricao do WhatsApp em 10/11) so era
//   aplicada no enviar() do JOTA (functions/_lib/jota/base.js). A monitoria envia por R.enviarTexto direto e mandou 412 mensagens nao pedidas em 16/11.
//   Toda mensagem da monitoria para pessoa real (analista, escalonamento, piloto de supervisores) passa por aqui. Teste para o Vitorio nao e bloqueado.
// =========================================================================
export async function pausaProativa(db) {
  try {
    const p = await db.prepare("SELECT valor FROM config_flags WHERE chave = 'wa_pausa_proativa_ate'").first();
    return !!(p && p.valor && new Date().toISOString() < String(p.valor));
  } catch (e) {
    return true;   // sem conseguir ler a trava: na duvida, nao envia
  }
}
