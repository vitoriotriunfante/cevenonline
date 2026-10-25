// =========================================================================
// FICHA DO ARQUIVO: functions/api/pedidos-dia.js
// O QUE É: os PEDIDOS DO DIA de todos os clientes positivados (número, status, corte), lidos do banco — a mesma análise que o coletor de lances
//          (tv-vendedor, a cada 5 min, dentro da cota do CEVEN) grava em cache_analise_cliente. Alimenta "Cortes" e "Bloqueados" do WhatsApp.
// POR QUE (Vitório, 15/10/2026): o 17:00 e o 18:30 saíram zerados porque o motor perguntava ao CEVEN o histórico de cada cliente na hora do envio
//          e levava 429. "Motor único, uma fonte": o WhatsApp lê a base, não o CEVEN.
// USO:  GET /api/pedidos-dia?dia=AAAA-MM-DD[&filial=TBL]  ->  { dia, pedidos: [{ filial, rca, id_cliente, num, status_pedido, categoria_corte, itens_cortados, ... }], clientes }
// REGRA: só o que o CEVEN respondeu (falha nunca entra no cache). Nunca inventa: cliente sem análise simplesmente não aparece.
// =========================================================================
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const hojeSP = () => R.hojeSP();

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 indisponivel' }), { status: 503, headers: cors });
  const u = new URL(request.url);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : hojeSP();
  const fil = (u.searchParams.get('filial') || '').toLowerCase();
  try {
    const { results } = await env.DB.prepare("SELECT chave, json, criado_em FROM cache_analise_cliente WHERE chave LIKE ? ORDER BY criado_em DESC")
      .bind(`${fil ? fil + '1' : '%'}|%|%|${dia}|%`).all();
    const visto = new Set(), pedidos = [], analisados = {};   // analisados: FILIAL|RCA -> clientes positivados ja analisados (o motor confere a cobertura)
    let clientes = 0;
    for (const r of results || []) {
      const [key, rca, idCliente] = String(r.chave).split('|');
      const k = key + '|' + rca + '|' + idCliente;
      if (visto.has(k)) continue;   // a analise mais recente do cliente vale
      visto.add(k); clientes++;
      const kr = key.replace(/1$/, '').toUpperCase() + '|' + rca; analisados[kr] = (analisados[kr] || 0) + 1;
      let a = null; try { a = JSON.parse(r.json); } catch { continue; }
      const p = a && a.pedidoHoje;
      if (!p || !p.num || (p.data && p.data !== dia)) continue;   // so pedido DE HOJE
      pedidos.push({ filial: key.replace(/1$/, '').toUpperCase(), rca, id_cliente: idCliente, num: String(p.num), status_pedido: p.status_pedido || null,
        categoria_corte: p.categoria_corte || null, itens_cortados: p.itens_cortados || [], total_clube: p.total_clube, valor_original: p.valor_original,
        vl_faturado_winthor: p.vl_faturado_winthor, vl_perdido_logistica: p.vl_perdido_logistica, valor: p.valor, tem_corte_info: 'itens_cortados' in p, analisado_em: r.criado_em });
    }
    return new Response(JSON.stringify({ dia, clientes, analisados, pedidos }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 200) }), { status: 500, headers: cors });
  }
}
