export async function onRequestGet(context) {
  const { env } = context;
  
  const filiaisBase = [
    { filial_id: 'tbl1', filial_sigla: 'TBL', nome_gerente: 'Vitório Neto', whatsapp_numero: '5566996389884', ativo: 1, alertas_cortes: 1, resumo_abertura: 1, resumo_parcial: 1, resumo_fechamento: 1 },
    { filial_id: 'abc1', filial_sigla: 'ABC', nome_gerente: 'Gerente Comercial ABC', whatsapp_numero: '', ativo: 0, alertas_cortes: 1, resumo_abertura: 1, resumo_parcial: 1, resumo_fechamento: 1 },
    { filial_id: 'tcv1', filial_sigla: 'TCV', nome_gerente: 'Gerente Comercial TCV', whatsapp_numero: '', ativo: 0, alertas_cortes: 1, resumo_abertura: 1, resumo_parcial: 1, resumo_fechamento: 1 },
    { filial_id: 'api1', filial_sigla: 'API', nome_gerente: 'Gerente Comercial API', whatsapp_numero: '', ativo: 0, alertas_cortes: 1, resumo_abertura: 1, resumo_parcial: 1, resumo_fechamento: 1 },
    { filial_id: 'tsj1', filial_sigla: 'TSJ', nome_gerente: 'Gerente Comercial TSJ', whatsapp_numero: '', ativo: 0, alertas_cortes: 1, resumo_abertura: 1, resumo_parcial: 1, resumo_fechamento: 1 },
    { filial_id: 'cas1', filial_sigla: 'CAS', nome_gerente: 'Gerente Comercial CAS', whatsapp_numero: '', ativo: 0, alertas_cortes: 1, resumo_abertura: 1, resumo_parcial: 1, resumo_fechamento: 1 }
  ];

  if (env && env.DB) {
    try {
      const { results } = await env.DB.prepare(`
        SELECT filial_id, filial_sigla, nome_gerente, whatsapp_numero, ativo, alertas_cortes, resumo_abertura, resumo_parcial, resumo_fechamento
        FROM gerentes_filiais
      `).all();

      if (results && results.length > 0) {
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (_) {}
  }

  return new Response(JSON.stringify(filiaisBase), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { filial_id, filial_sigla, nome_gerente, whatsapp_numero, ativo, alertas_cortes, resumo_abertura, resumo_parcial, resumo_fechamento } = data;

    if (env && env.DB) {
      await env.DB.prepare(`
        INSERT INTO gerentes_filiais (filial_id, filial_sigla, nome_gerente, whatsapp_numero, ativo, alertas_cortes, resumo_abertura, resumo_parcial, resumo_fechamento)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(filial_id) DO UPDATE SET
          nome_gerente = excluded.nome_gerente,
          whatsapp_numero = excluded.whatsapp_numero,
          ativo = excluded.ativo,
          alertas_cortes = excluded.alertas_cortes,
          resumo_abertura = excluded.resumo_abertura,
          resumo_parcial = excluded.resumo_parcial,
          resumo_fechamento = excluded.resumo_fechamento,
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        filial_id,
        filial_sigla,
        nome_gerente,
        whatsapp_numero,
        ativo ? 1 : 0,
        alertas_cortes ? 1 : 0,
        resumo_abertura ? 1 : 0,
        resumo_parcial ? 1 : 0,
        resumo_fechamento ? 1 : 0
      ).run();
    }

    return new Response(JSON.stringify({ success: true, message: 'Configuração salva com sucesso!' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
