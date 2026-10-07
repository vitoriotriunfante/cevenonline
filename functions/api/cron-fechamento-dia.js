// =========================================================================
// FICHA DO ARQUIVO: functions/api/cron-fechamento-dia.js
// O QUE É: fecha (congela) o dia da Liga Triunfante depois das 22h. Chamado pelo coletor de lances (cron-lances, a cada 5 min); idempotente.
//          Fecha o dia de hoje (se ja passou das 22h) e qualquer dia util anterior ainda aberto, a partir de 06/10/2026.
//          Dias anteriores a 06/10/2026 só fecham de propósito: /api/cron-fechamento-dia?dia=AAAA-MM-DD&manual=1
// Ver functions/_lib/liga_fechamento.js.
// =========================================================================
import { fechaDia, agoraSP } from '../_lib/liga_fechamento.js';
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const DIA_INICIAL = '2026-10-06';
const maisDias = (dia, n) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: cors });
  const u = new URL(request.url), origin = u.origin, t = agoraSP();
  try {
    const diaPedido = u.searchParams.get('dia');
    if (diaPedido && /^\d{4}-\d{2}-\d{2}$/.test(diaPedido)) {
      if (diaPedido < DIA_INICIAL && u.searchParams.get('manual') !== '1') return new Response(JSON.stringify({ status: 'RECUSADO', motivo: 'dia anterior a 06/10/2026 só fecha com manual=1' }), { headers: cors });
      return new Response(JSON.stringify(await fechaDia(env, origin, diaPedido)), { headers: cors });
    }
    const saida = [];
    for (let d = DIA_INICIAL; d <= t.dia; d = maisDias(d, 1)) saida.push(await fechaDia(env, origin, d));
    return new Response(JSON.stringify({ status: 'OK', dias: saida.filter((x) => x.status !== 'JA_FECHADO' || false) }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: cors });
  }
}
