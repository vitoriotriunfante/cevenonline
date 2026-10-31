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
const memPedidosHoje = new Map(); // chave (dia|fil) -> { exp, json }

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 indisponivel' }), { status: 503, headers: cors });
  const u = new URL(request.url);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : hojeSP();
  const fil = (u.searchParams.get('filial') || '').toLowerCase();
  const ehSimples = u.searchParams.get('abertos') !== '1' && !u.searchParams.get('num');
  const chaveMem = `${dia}|${fil}`;
  if (ehSimples) {
    const c = memPedidosHoje.get(chaveMem);
    if (c && Date.now() < c.exp) return new Response(c.json, { headers: cors });
  }
  try {
    // OTIMIZACAO D1 (31/10/2026): se tem filial (ex: tbl1|%), o LIKE usa o PRIMARY KEY (chave) sem scan; se nao tem filial, usa criado_em >= inicioDoDia (idx_cache_analise_criado)
    const iniDiaMs = Date.parse(dia + 'T00:00:00-03:00') || (Date.now() - 2 * 86400000);
    const { results } = fil
      ? await env.DB.prepare("SELECT chave, json, criado_em FROM cache_analise_cliente WHERE chave LIKE ? ORDER BY criado_em DESC").bind(`${fil}1|%|%|${dia}|%`).all()
      : await env.DB.prepare("SELECT chave, json, criado_em FROM cache_analise_cliente WHERE criado_em >= ? AND chave LIKE ? ORDER BY criado_em DESC").bind(iniDiaMs - 3600000, `%|%|%|${dia}|%`).all();
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
    // STATUS MAIS RECENTE (26/10/2026): a linha do tempo (pedido_status, rechecada pelo coletor) manda sobre a 1a leitura; ?num= acha pedido de qualquer dia (15 dias)
    try {
      // ?abertos=1: todos os pedidos AINDA NAO FINAIS dos ultimos 15 dias (status mais recente), para "pendentes/bloqueados/liberados" de qualquer dia
      if (u.searchParams.get('abertos') === '1') {
        const rcaF = (u.searchParams.get('rca') || '').trim();
        const filF = (u.searchParams.get('filial') || '').toUpperCase().trim();
        let q = "SELECT num, filial, rca, id_cliente, data_pedido, status AS status_pedido, valor, itens_cortados, rechecado_em FROM pedido_status WHERE final = 0 AND data_pedido >= date('now', '-15 days')";
        const params = [];
        if (filF) { q += " AND filial = ?"; params.push(filF); }
        if (rcaF) { q += " AND rca = ?"; params.push(rcaF); }
        q += " ORDER BY data_pedido DESC";
        const { results: ab } = await env.DB.prepare(q).bind(...params).all();
        return new Response(JSON.stringify({ abertos: ab || [] }), { headers: cors });
      }
      const num = (u.searchParams.get('num') || '').replace(/\D/g, '');
      if (num) {
        const p = await env.DB.prepare('SELECT * FROM pedido_status WHERE num = ?').bind(num).first();
        const { results: h } = await env.DB.prepare('SELECT status, visto_em FROM pedido_status_hist WHERE num = ? ORDER BY visto_em').bind(num).all();
        return new Response(JSON.stringify({ num, pedido: p || null, linha_do_tempo: h || [] }), { headers: cors });
      }
      const { results: ps } = await env.DB.prepare('SELECT num, status, rechecado_em, final FROM pedido_status WHERE data_pedido = ?').bind(dia).all();
      const m = new Map((ps || []).map((x) => [x.num, x]));
      for (const p of pedidos) { const x = m.get(p.num); if (x) { p.status_pedido = x.status; p.conferido_em = x.rechecado_em; p.final = !!x.final; } }
    } catch { /* sem a linha do tempo: fica a 1a leitura */ }
    const bodyJson = JSON.stringify({ dia, clientes, analisados, pedidos });
    if (ehSimples) memPedidosHoje.set(chaveMem, { exp: Date.now() + 25000, json: bodyJson });
    return new Response(bodyJson, { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 200) }), { status: 500, headers: cors });
  }
}
