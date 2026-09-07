// =========================================================================
// API CLIENTE DETALHE CEVEN NOC
// Retorna histórico integral de compras, deltas de volume, auditoria de cortes
// e produtos que o cliente deixou de comprar.
// =========================================================================

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const codcli = url.searchParams.get('id') || url.searchParams.get('codcli');
  const filial = url.searchParams.get('filial') || 'TBL';

  if (!codcli) {
    return new Response(JSON.stringify({ error: 'ID do cliente obrigatório' }), { status: 400 });
  }

  try {
    if (env && env.DB) {
      const cliente = await env.DB.prepare(`
        SELECT * FROM clientes_historico_compras 
        WHERE id_cliente = ?
      `).bind(codcli).first();

      if (cliente) {
        return new Response(JSON.stringify({
          id_cliente: cliente.id_cliente,
          rca_codigo: cliente.rca_codigo,
          filial_id: cliente.filial_id,
          cnpj: cliente.cnpj,
          razao_social: cliente.razao_social,
          nome_fantasia: cliente.nome_fantasia,
          dias_sem_compra: cliente.dias_sem_compra,
          total_pedidos: cliente.total_pedidos_historico,
          ultima_compra_data: cliente.ultima_compra_data,
          ultima_compra_valor: cliente.ultima_compra_valor,
          skus_ultima_venda: cliente.skus_ultima_venda_json ? JSON.parse(cliente.skus_ultima_venda_json) : [],
          skus_deixou_de_comprar: cliente.skus_deixou_de_comprar_json ? JSON.parse(cliente.skus_deixou_de_comprar_json) : [],
          ultimas_visitas: cliente.ultimas_visitas_json ? JSON.parse(cliente.ultimas_visitas_json) : [],
          recados: cliente.recados_ceven_json ? JSON.parse(cliente.recados_ceven_json) : [],
          tags_oportunidade: cliente.tags_oportunidade_json ? JSON.parse(cliente.tags_oportunidade_json) : []
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 2. Fallback Inteligente ao Vivo na API do CEVEN
    const fKey = filial.toLowerCase().endsWith('1') ? filial.toLowerCase() : (filial.toLowerCase() + '1');
    const cevenUrl = `https://ceven.drivetriunfante-locomotiva.com.br/api/rca/historico-cliente/${codcli}?filial=${fKey}`;

    const cevenRes = await fetch(cevenUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (cevenRes.ok) {
      const h = await cevenRes.json();
      if (h) {
        // Grava no D1 de forma assíncrona se env.DB estiver disponível
        if (env && env.DB) {
          try {
            await env.DB.prepare(`
              INSERT OR REPLACE INTO clientes_historico_compras (
                id_cliente, rca_codigo, filial_id, cnpj, razao_social, nome_fantasia,
                ultima_compra_data, ultima_compra_valor, dias_sem_compra, total_pedidos_historico,
                skus_ultima_venda_json, skus_deixou_de_comprar_json, ultimas_visitas_json,
                recados_ceven_json, tags_oportunidade_json, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).bind(
              String(codcli), String(h.rca_codigo || '0'), filial.toUpperCase(), h.cnpj || null, h.razao_social || h.nome || null, h.nome_fantasia || h.nome || null,
              h.ultima_compra_data || null, parseFloat(h.ultima_compra_valor || 0), parseInt(h.dias_sem_compra || 0), parseInt(h.total_pedidos || 0),
              JSON.stringify(h.skus_ultima_venda || []), JSON.stringify(h.skus_parou || []), JSON.stringify(h.ultimas_visitas || []),
              JSON.stringify(h.recados || []), JSON.stringify(h.tags || [])
            ).run();
          } catch (d1Err) {
            console.warn('Erro ao salvar no D1:', d1Err.message);
          }
        }

        return new Response(JSON.stringify({
          id_cliente: codcli,
          rca_codigo: h.rca_codigo || '0',
          filial_id: filial.toUpperCase(),
          cnpj: h.cnpj || '',
          razao_social: h.razao_social || '',
          nome_fantasia: h.nome_fantasia || h.nome || '',
          dias_sem_compra: h.dias_sem_compra || 0,
          total_pedidos: h.total_pedidos || 0,
          ultima_compra_data: h.ultima_compra_data || null,
          ultima_compra_valor: h.ultima_compra_valor || 0,
          skus_ultima_venda: h.skus_ultima_venda || [],
          skus_deixou_de_comprar: h.skus_parou || [],
          ultimas_visitas: h.ultimas_visitas || [],
          recados: h.recados || [],
          tags_oportunidade: h.tags || [],
          origem: 'CEVEN_LIVE_SYNC'
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    return new Response(JSON.stringify({
      id_cliente: codcli,
      status: 'LOCAL_FALLBACK',
      message: 'Cliente não encontrado no CEVEN nem no D1'
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
