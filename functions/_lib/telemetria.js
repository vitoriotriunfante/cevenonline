// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/telemetria.js
// O QUE É: Registro leve de contagem de leituras e execução de rotas D1
//          Permite auditar quantas linhas cada rota do sistema lê no banco
//          e identificar picos de consumo em tempo real.
// =========================================================================

export async function registraTelemetria(env, rota, linhasLidas = 0, ms = 0) {
  if (!env || !env.DB) return;
  try {
    const agora = new Date();
    const dia = agora.toISOString().slice(0, 10);
    const hora = String(agora.getHours()).padStart(2, '0') + ':00';

    await env.DB.prepare(`
      INSERT INTO d1_telemetria_rotas (rota, data_ref, hora_faixa, total_chamadas, total_linhas_lidas, ms_acumulado, ultimo_em)
      VALUES (?, ?, ?, 1, ?, ?, datetime('now'))
      ON CONFLICT (rota, data_ref, hora_faixa) DO UPDATE SET
        total_chamadas = total_chamadas + 1,
        total_linhas_lidas = total_linhas_lidas + excluded.total_linhas_lidas,
        ms_acumulado = ms_acumulado + excluded.ms_acumulado,
        ultimo_em = datetime('now')
    `).bind(rota, dia, hora, Math.max(0, linhasLidas), Math.max(0, ms)).run();
  } catch (e) {
    // telemetria nunca pode derrubar a rota principal
  }
}
