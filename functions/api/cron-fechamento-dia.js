// =========================================================================
// FICHA DO ARQUIVO: functions/api/cron-fechamento-dia.js
// O QUE É: fecha (congela) o dia da Liga Triunfante depois das 22h. Chamado pelo coletor de lances (cron-lances, a cada 5 min); idempotente.
//          Fecha o dia de hoje (se ja passou das 22h) e qualquer dia util anterior ainda aberto, a partir de 06/10/2026.
//          Dias anteriores a 06/10/2026 só fecham de propósito: /api/cron-fechamento-dia?dia=AAAA-MM-DD&manual=1
// Ver functions/_lib/liga_fechamento.js.
// =========================================================================
import { fechaDia, agoraSP } from '../_lib/liga_fechamento.js';
import { lancesFaltantes } from '../_lib/lances_faltantes.js';
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
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
    // ALARME DE LANCE FALTANDO (Vitorio, 01/11/2026: "evitar de qualquer maneira"): dia fechado com pedido e check-in sem lance avisa a diretoria uma vez, sem mexer em ponto.
    try {
      const fech = await env.DB.prepare('SELECT dia FROM liga_fechamento WHERE dia = ?').bind(t.dia).first(), ja = await env.DB.prepare("SELECT 1 x FROM coleta_estado WHERE chave = ?").bind('aviso_lances_' + t.dia).first();
      if (fech && !ja) {
        const F = await lancesFaltantes(env, t.dia, null);
        await env.DB.prepare("INSERT INTO coleta_estado (chave, valor, motivo, atualizado_em) VALUES (?, ?, 'lances faltando no fechamento', datetime('now'))").bind('aviso_lances_' + t.dia, F.length).run();
        if (F.length) { const eu = await env.DB.prepare("SELECT celular FROM bot_contatos WHERE nome = 'VITORIO' AND papel = 'diretoria' LIMIT 1").first(); if (eu) await R.enviarTexto(R.evoCfg(env), eu.celular, `⚠️ *Liga, fechamento de ${t.dia}:* ${F.length} lance(s) com pedido e check-in ainda não nasceram. Nenhum ponto foi alterado.`); }
      }
    } catch { /* o alarme nunca derruba o fechamento */ }
    return new Response(JSON.stringify({ status: 'OK', dias: saida.filter((x) => x.status !== 'JA_FECHADO' || false) }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: cors });
  }
}
