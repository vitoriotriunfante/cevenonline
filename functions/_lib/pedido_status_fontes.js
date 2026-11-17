// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/pedido_status_fontes.js
// O QUE E: volta a alimentar pedido_status (a "linha do tempo" de cada pedido que ~15 respostas do JOTA leem) SEM o CEVEN, parado desde 13/11/2026.
//   Pedido = Clube da Venda (clube_pedido: numero no Winthor, vendedor, cliente, valor, dia). Status = GEROT: FATURADO (NF no 'Pedidos'),
//   BLOQUEADO / LIBERADO / MONTADO (situacao na Carteira Total); sem GEROT ainda: RECUSADO_WINTHOR ou AGUARDANDO_WINTHOR pelo proprio Clube.
//   Grava so o que mudou (e a mudanca vai para pedido_status_hist). Chamado no fim de cada carga do Clube (/api/clube-carga).
// =========================================================================
import { garanteTabelasPedido } from './pedido_status.js';

const statusDe = (c, ger) => {
  if (ger.fat) return 'FATURADO';
  if (ger.sit) { const s = ger.sit.toUpperCase(); if (s.startsWith('BLOQUEADO')) return 'BLOQUEADO'; if (s.startsWith('LIBERADO')) return 'LIBERADO'; if (s.startsWith('MONTADO')) return 'MONTADO'; return 'EM_CARTEIRA'; }
  if (/RECUSAD/i.test(c.tipo_bloqueio || '')) return 'RECUSADO_WINTHOR';
  return 'AGUARDANDO_WINTHOR';
};

export async function sincronizaPedidoStatus(env, desde) {
  const db = env.DB; if (!db) return { ok: false };
  await garanteTabelasPedido(env);
  let C = [];
  try { C = (await db.prepare('SELECT filial, rca, pedido, pedido_winthor, cliente, total, tipo_bloqueio, dia FROM clube_pedido WHERE dia >= ?').bind(desde).all()).results || []; } catch (e) { return { ok: false, erro: 'sem clube_pedido' }; }
  if (!C.length) return { ok: true, pedidos: 0 };
  const num = (c) => (c.pedido_winthor && Number(c.pedido_winthor) > 0 ? String(c.pedido_winthor) : String(c.pedido));
  const nums = [...new Set(C.map(num))];
  const ger = new Map(), ant = new Map();
  for (let i = 0; i < nums.length; i += 90) {
    const lote = nums.slice(i, i + 90), q = lote.map(() => '?').join(',');
    const [{ results: F }, { results: K }, { results: A }] = await Promise.all([
      db.prepare(`SELECT filial, pedido, SUM(json_extract(dados, '$."Faturado líquido (R$)"')) fat, MAX(nf) nf FROM gerot_pedido WHERE pedido IN (${q}) AND nf <> '' GROUP BY filial, pedido`).bind(...lote).all(),
      db.prepare(`SELECT filial, pedido, situacao FROM gerot_carteira WHERE pedido IN (${q})`).bind(...lote).all(),
      db.prepare(`SELECT num, status, valor FROM pedido_status WHERE num IN (${q})`).bind(...lote).all(),
    ]);
    for (const r of F || []) if (Number(r.fat) > 0) ger.set(r.filial + '|' + r.pedido, { ...(ger.get(r.filial + '|' + r.pedido) || {}), fat: true });
    for (const r of K || []) ger.set(r.filial + '|' + r.pedido, { ...(ger.get(r.filial + '|' + r.pedido) || {}), sit: r.situacao });
    for (const r of A || []) ant.set(r.num, r);
  }
  const agora = new Date().toISOString(), st = [];
  for (const c of C) {
    const n = num(c), s = statusDe(c, ger.get(c.filial + '|' + n) || {}), a = ant.get(n), v = Number(c.total) || null;
    if (a && a.status === s && Number(a.valor || 0) === Number(v || 0)) continue;   // nada mudou: nao grava
    st.push(db.prepare(`INSERT INTO pedido_status (num, filial, rca, id_cliente, data_pedido, status, valor, final, primeiro_em, atualizado_em, rechecado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (num) DO UPDATE SET status = excluded.status, valor = COALESCE(excluded.valor, pedido_status.valor), final = excluded.final, rechecado_em = excluded.rechecado_em,
      atualizado_em = CASE WHEN pedido_status.status = excluded.status THEN pedido_status.atualizado_em ELSE excluded.atualizado_em END`)
      .bind(n, String(c.filial), String(c.rca || ''), String(c.cliente || ''), String(c.dia), s, v, s === 'FATURADO' ? 1 : 0, agora, agora, agora));
    if (!a || a.status !== s) st.push(db.prepare('INSERT OR IGNORE INTO pedido_status_hist (num, status, visto_em) VALUES (?, ?, ?)').bind(n, s, agora));
  }
  for (let i = 0; i < st.length; i += 80) await db.batch(st.slice(i, i + 80));
  return { ok: true, pedidos: C.length, gravados: st.length };
}
