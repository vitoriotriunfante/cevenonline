// =========================================================================
// FICHA DO ARQUIVO: functions/api/telemetria-custo.js
// O QUE É: Dashboard e relatório de consumo do D1 em tempo real
//          Mostra quantidade de chamadas, linhas lidas e tempo de resposta
//          por rota e por faixa de horário, permitindo rastrear onde está o custo.
// =========================================================================

const CORS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store'
};
const resp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });

export async function onRequestGet({ request, env }) {
  if (!env.DB) return resp({ erro: 'banco indisponivel' }, 503);
  const u = new URL(request.url);
  const dia = u.searchParams.get('dia') || new Date().toISOString().slice(0, 10);

  try {
    // 1. Garante que a tabela existe
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS d1_telemetria_rotas (
        rota TEXT NOT NULL,
        data_ref TEXT NOT NULL,
        hora_faixa TEXT NOT NULL,
        total_chamadas INTEGER DEFAULT 0,
        total_linhas_lidas INTEGER DEFAULT 0,
        ms_acumulado INTEGER DEFAULT 0,
        ultimo_em TEXT,
        PRIMARY KEY (rota, data_ref, hora_faixa)
      )
    `).run();

    // 2. Consulta agregada por rota no dia
    const { results: porRota } = await env.DB.prepare(`
      SELECT 
        rota,
        SUM(total_chamadas) AS chamadas,
        SUM(total_linhas_lidas) AS linhas_lidas,
        ROUND(AVG(CAST(ms_acumulado AS REAL) / MAX(1, total_chamadas)), 1) AS media_ms,
        MAX(ultimo_em) AS ultimo_acesso
      FROM d1_telemetria_rotas
      WHERE data_ref = ?
      GROUP BY rota
      ORDER BY linhas_lidas DESC
    `).bind(dia).all();

    // 3. Consulta de lances por hora no dia para correlacionar com a movimentação real da equipe
    const { results: lancesPorHora } = await env.DB.prepare(`
      SELECT 
        substr(hora_sp, 1, 2) || ':00' AS faixa_hora,
        count(*) AS total_lances,
        count(DISTINCT rca) AS vendedores_com_lance
      FROM tv_lances
      WHERE dia = ? AND nivel != 'marker'
      GROUP BY 1
      ORDER BY 1
    `).bind(dia).all();

    // 4. Totais do dia
    let totalLidas = 0;
    let totalChamadas = 0;
    for (const r of porRota || []) {
      totalLidas += r.linhas_lidas || 0;
      totalChamadas += r.chamadas || 0;
    }

    return resp({
      dia,
      resumo: {
        total_chamadas: totalChamadas,
        total_linhas_lidas: totalLidas,
        rotas_ativas: (porRota || []).length
      },
      por_rota: porRota || [],
      lances_por_hora: lancesPorHora || []
    });
  } catch (e) {
    return resp({ erro: 'falha ao carregar telemetria: ' + e.message }, 500);
  }
}

