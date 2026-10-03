// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: coletor do PILOTO "pedidos em 3 frentes" (etapa 6 do PROJETO_MESTRE, 03/10/2026).
//          Depois de cada varredura central, copia por vendedor os números do retrato mais
//          recente (dig_pedido, positivacao, visitas_com_venda, EFETIVADO, FORA_ROTA...) para a
//          tabela piloto_pedidos_intraday. O aumento de dig_pedido entre dois retratos marca a
//          "primeira detecção" do pedido, comparável ao horário de check-in da visita.
// SÓ LÊ varredura_central_rca e SÓ ESCREVE em piloto_pedidos_intraday (tabela do piloto).
//          NÃO chama o CEVEN. Idempotente: UNIQUE (data_ref, rca_codigo, origem_updated_at).
// QUEM CHAMA: .github/workflows/tv-varredura-central-cron.yml (passo após a varredura, sem
//          derrubar a varredura se falhar).
// SQL IGUAL AO ARQUIVO: PILOTO/coletor_piloto_pedidos.sql (pasta de documentação do projeto-mestre).
// REGRA: nunca inventa dado; vendedor sem retrato do dia não gera linha.
// =========================================================================

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

const SQL_COLETA = `
INSERT OR IGNORE INTO piloto_pedidos_intraday
  (data_ref, rca_codigo, filial_sigla, origem_updated_at, dig_pedido, positivacao, visitas_com_venda,
   total_programado, efetivados, fora_rota, visitados, abertos, ultimo_checkin)
SELECT v.data_ref, v.rca_codigo, v.filial_sigla, v.updated_at,
  json_extract(v.produtividade_json, '$.dia.dig_pedido'),
  CAST(json_extract(v.produtividade_json, '$.dia.positivacao') AS INTEGER),
  CAST(json_extract(v.produtividade_json, '$.dia.visitas_com_venda') AS INTEGER),
  CAST(json_extract(v.produtividade_json, '$.dia.total_programado') AS INTEGER),
  (SELECT COUNT(*) FROM json_each(v.roteiro_json) j WHERE json_extract(j.value, '$.status') = 'EFETIVADO'),
  (SELECT COUNT(*) FROM json_each(v.roteiro_json) j WHERE json_extract(j.value, '$.status') = 'FORA_ROTA'),
  (SELECT COUNT(*) FROM json_each(v.roteiro_json) j WHERE json_extract(j.value, '$.status') = 'VISITADO'),
  (SELECT COUNT(*) FROM json_each(v.roteiro_json) j WHERE json_extract(j.value, '$.status') = 'ABERTO'),
  (SELECT MAX(json_extract(j.value, '$.checkin_horario')) FROM json_each(v.roteiro_json) j)
FROM varredura_central_rca v
WHERE v.data_ref = date('now', '-3 hours')
  AND v.produtividade_json IS NOT NULL AND v.roteiro_json IS NOT NULL`;

export async function onRequestGet({ env }) {
  const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });
  try {
    if (!env.DB) return resp({ erro: 'banco D1 indisponivel' }, 500);
    const r = await env.DB.prepare(SQL_COLETA).run();
    return resp({ sucesso: true, linhas_novas: (r.meta && r.meta.changes) || 0 });
  } catch (e) {
    return resp({ sucesso: false, erro: String((e && e.message) || e) }, 500);
  }
}
