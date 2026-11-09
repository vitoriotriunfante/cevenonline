// =========================================================================
// FICHA DO ARQUIVO: functions/api/winthor-divergencias.js   (GET /api/winthor-divergencias)
// O QUE É: lista dos pedidos que o Winthor (botao "P. Winthor" do CEVEN) tem e o D1 NAO tinha, para conferir 1 a 1
//   (Vitorio, 09/11/2026: "quero uma lista para checar 1 a 1 com cod vendedor, cliente e numero do pedido").
//   Gravada pela varredura (cron-varredura-central.js, coletaPedidosWinthor) em winthor_divergencias; + resumo por vendedor (winthor_fila).
//   Mesma senha da Central do JOTA (/contatos). So le o D1; nao chama o CEVEN.
// =========================================================================
import { exigeSenhaEquipe } from '../_lib/senha_equipe.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
const CORS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });

export async function onRequestGet({ request, env }) {
  if (!(await chaveAdminOk(env, request))) { const negado = await exigeSenhaEquipe(request, env, CORS); if (negado) return negado; }
  const u = new URL(request.url), mes = /^\d{4}-\d{2}$/.test(u.searchParams.get('mes') || '') ? u.searchParams.get('mes') : new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 7);
  try {
    const { results: pedidos } = await env.DB.prepare("SELECT d.filial, d.rca, d.id_cliente, d.cliente, d.num, d.data_pedido, d.valor, d.status AS status_winthor, d.achado_em, p.status AS status_agora FROM winthor_divergencias d LEFT JOIN pedido_status p ON p.num = d.num WHERE substr(d.data_pedido, 1, 7) = ? ORDER BY d.filial, CAST(d.rca AS INTEGER), d.data_pedido, d.num").bind(mes).all();
    const { results: fila } = await env.DB.prepare('SELECT filial, rca, em, pedidos, faltavam, faltavam_valor FROM winthor_fila WHERE mes = ?').bind(mes).all().catch(() => ({ results: [] }));
    const { results: tot } = await env.DB.prepare("SELECT COUNT(DISTINCT filial || '|' || rca) n FROM varredura_central_rca WHERE data_ref = (SELECT MAX(data_ref) FROM varredura_central_rca)").all().catch(() => ({ results: [{ n: null }] }));
    return j({ mes, vendedores_lidos: (fila || []).length, vendedores_total: (tot && tot[0] && tot[0].n) || null, pedidos_divergentes: (pedidos || []).length, valor_divergente: (pedidos || []).reduce((a, x) => a + (Number(x.valor) || 0), 0), pedidos: pedidos || [], por_vendedor: fila || [] });
  } catch (e) {
    return j({ mes, vendedores_lidos: 0, pedidos_divergentes: 0, pedidos: [], por_vendedor: [], aviso: 'a coleta do Winthor ainda nao rodou' });
  }
}
