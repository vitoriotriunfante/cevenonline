// Worker de Aquecimento Matinal Automático (Executado via Cloudflare Cron Triggers / Webhook às 04h00)
export async function onRequestGet({ env }) {
  const inicio = Date.now();
  const logs = [];

  try {
    // 1. Busca todos os 519 representantes ativos do banco D1
    let reps = [];
    if (env && env.DB) {
      const res = await env.DB.prepare('SELECT codigo, nome, filial_id FROM representantes ORDER BY filial_id, codigo').all();
      reps = res.results || [];
    }

    if (reps.length === 0) {
      return new Response(JSON.stringify({ status: 'sem_reps', mensagem: 'Nenhum representante encontrado no banco' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logs.push(`Iniciando aquecimento matinal de ${reps.length} representantes às ${new Date().toISOString()}...`);

    // 2. Dispara o aquecimento progressivo na API do CEVEN
    const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';
    let aquecidos = 0;
    let falhas = 0;

    for (const r of reps) {
      try {
        const fId = r.filial_id || 'tbl1';
        // Dispara em paralelo para esquentar os 3 endpoints mais pesados
        await Promise.allSettled([
          fetch(`${CEVEN_BASE}/api/rca/dashboard?filial=${fId}&id=${r.codigo}`, { headers: { 'User-Agent': 'CEVEN-NOC-Cron/1.0' } }),
          fetch(`${CEVEN_BASE}/api/rca/roteiro-hoje?filial=${fId}&id=${r.codigo}`, { headers: { 'User-Agent': 'CEVEN-NOC-Cron/1.0' } }),
          fetch(`${CEVEN_BASE}/api/ceven/prospeccao-roteiro?cod_rca=${r.codigo}&hoje=1&max=120`, { headers: { 'User-Agent': 'CEVEN-NOC-Cron/1.0' } })
        ]);
        aquecidos++;
      } catch (e) {
        falhas++;
      }
    }

    const duracaoSegundos = ((Date.now() - inicio) / 1000).toFixed(1);

    return new Response(JSON.stringify({
      status: 'sucesso',
      total_representantes: reps.length,
      aquecidos_com_sucesso: aquecidos,
      falhas: falhas,
      tempo_execucao_segundos: duracaoSegundos,
      mensagem: `Cache matinal gerado com sucesso para toda a força de vendas!`
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'erro', mensagem: err.message }), { status: 500 });
  }
}
