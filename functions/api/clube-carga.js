// =========================================================================
// FICHA DO ARQUIVO: functions/api/clube-carga.js (POST /api/clube-carga, header X-Evo-Key)
// O QUE É: recebe do coletor do Clube da Venda (pipeline/clube_coletor.mjs)
//   vendedores do dia, check-in/out e justificativas e grava no D1 de forma idempotente.
// Nao chama o CEVEN.
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';

const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: J });

export async function onRequestPost({ request, env }) {
  if (!(await chaveEvoValida(request, env))) return resp({ erro: 'nao autorizado' }, 401);
  let body = {};
  try { body = await request.json(); } catch { return resp({ erro: 'json invalido' }, 400); }
  const dia = String(body.dia || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return resp({ erro: 'dia obrigatorio (AAAA-MM-DD)' }, 400);
  const lidoEm = String(body.lido_em || new Date().toISOString());
  const db = env.DB;

  const cols = ['total_pedido', 'total_faturado', 'roteiros', 'visitas_rota', 'ped_rota', 'ped_fora', 'ped_total', 'media_sku', 'eficiencia', 'eficacia'];
  const stmts = [];

  for (const v of body.vendedores || []) {
    if (!v || !v.filial || !v.rca) continue;
    stmts.push(
      db.prepare(`INSERT INTO clube_venda_dia (dia, filial, rca, sup_cod, nome, ${cols.join(', ')}, lido_em, mudou_em) VALUES (${new Array(7 + cols.length).fill('?').join(',')}) ON CONFLICT (dia, filial, rca) DO UPDATE SET sup_cod = excluded.sup_cod, nome = excluded.nome, ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}, lido_em = excluded.lido_em, mudou_em = excluded.mudou_em WHERE ${cols.map((c) => `coalesce(clube_venda_dia.${c}, -1e9) <> coalesce(excluded.${c}, -1e9)`).join(' OR ')}`)
        .bind(dia, String(v.filial), String(v.rca), v.sup_cod || null, v.nome || null, ...cols.map((c) => v[c] ?? null), lidoEm, lidoEm)
    );
  }
  for (const c of body.checkins || []) {
    if (!c || !c.codigo || !c.rca) continue;
    stmts.push(
      db.prepare('INSERT OR IGNORE INTO clube_checkin (codigo, dia, filial, rca, nome, tipo, data_hora, cliente, cnpj, razao, fantasia) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .bind(String(c.codigo), dia, c.filial || null, String(c.rca), c.nome || null, c.tipo || null, c.data_hora || null, c.cliente || null, c.cnpj || null, c.razao || null, c.fantasia || null)
    );
  }
  for (const j of body.justificativas || []) {
    if (!j || !j.id) continue;
    stmts.push(
      db.prepare('INSERT OR IGNORE INTO clube_justificativa (id, dia, filial, sup_cod, rca, nome, cliente, cnpj, razao, fantasia, dias_sem_comprar, motivo, data_hora, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(String(j.id), dia, j.filial || null, j.sup_cod || null, j.rca || null, j.nome || null, j.cliente || null, j.cnpj || null, j.razao || null, j.fantasia || null, j.dias_sem_comprar ?? null, j.motivo || null, j.data_hora || null, j.obs || null)
    );
  }
  if (body.rodada) {
    const rd = body.rodada;
    stmts.push(
      db.prepare('INSERT INTO clube_rodada (dia, lido_em, vendedores, checkins, justificativas, nao_sinc, falhas, duracao_s) VALUES (?,?,?,?,?,?,?,?)')
        .bind(dia, lidoEm, rd.vendedores ?? null, rd.checkins ?? null, rd.justificativas ?? null, rd.nao_sinc ?? null, rd.falhas || '', rd.duracao_s ?? null)
    );
  }

  for (let i = 0; i < stmts.length; i += 80) {
    await db.batch(stmts.slice(i, i + 80));
  }
  return resp({ ok: true, dia, gravados: stmts.length });
}

