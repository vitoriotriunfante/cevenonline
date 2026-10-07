// =========================================================================
// FICHA DO ARQUIVO: functions/api/bola-cheia.js
// O QUE É: entrega a BOLA CHEIA do dia (vencedor por filial, congelado às 18h) para a TV, a Matriz e o grupo. ?dia=AAAA-MM-DD (padrão: hoje).
//   ?rodar=1 = congela se já passou das 18h e ainda não congelou (idempotente; chamado pelo coletor de lances a cada 5 min). Ver functions/_lib/bola_cheia.js.
// =========================================================================
import { agoraSP, REGRAS_VERSAO } from '../_lib/liga_fechamento.js';
import { congelaBolaCheia, lerBolaCheia } from '../_lib/bola_cheia.js';
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: cors });
  const u = new URL(request.url), t = agoraSP();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : t.dia;
  try {
    if (u.searchParams.get('rodar') === '1') return new Response(JSON.stringify(await congelaBolaCheia(env, u.origin, dia, REGRAS_VERSAO)), { headers: cors });
    const r = await lerBolaCheia(env, dia);
    if (!r) return new Response(JSON.stringify({ dia, pendente: true, motivo: 'a Bola Cheia do dia é congelada às 18h', vencedores: [] }), { headers: cors });
    return new Response(JSON.stringify({ dia, pendente: false, congelado_em: r.cab.congelado_em, hora: r.cab.hora_sp, regras_versao: r.cab.regras_versao, vencedores: r.vencedores }), { headers: cors });
  } catch (e) { return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: cors }); }
}
