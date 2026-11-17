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
  // 17/11/2026: PEDIDOS DO DIA do Clube (Relatorio de Pedido): um por pedido, so grava o que mudou
  if (Array.isArray(body.pedidos) && body.pedidos.length) {
    await db.prepare('CREATE TABLE IF NOT EXISTS clube_pedido (filial TEXT NOT NULL, pedido TEXT NOT NULL, dia TEXT, rca TEXT, id TEXT, pedido_winthor TEXT, cliente TEXT, razao TEXT, total REAL, confirmado TEXT, sincronizado TEXT, origem TEXT, tipo_bloqueio TEXT, data_inicial TEXT, data_emissao TEXT, data_recebimento TEXT, data_liberacao TEXT, hash TEXT, lido_em TEXT, PRIMARY KEY (filial, pedido))').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS ix_clube_pedido_dia ON clube_pedido (dia, filial, rca, cliente)').run();
    for (const x of body.pedidos) {
      if (!x || !x.filial || !(x.pedido || x.id)) continue;
      const h = [x.pedido_winthor, x.total, x.confirmado, x.sincronizado, x.tipo_bloqueio, x.data_emissao, x.data_liberacao, x.cliente, x.rca].join('|');
      stmts.push(db.prepare('INSERT INTO clube_pedido (filial, pedido, dia, rca, id, pedido_winthor, cliente, razao, total, confirmado, sincronizado, origem, tipo_bloqueio, data_inicial, data_emissao, data_recebimento, data_liberacao, hash, lido_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (filial, pedido) DO UPDATE SET rca = excluded.rca, pedido_winthor = excluded.pedido_winthor, cliente = excluded.cliente, razao = excluded.razao, total = excluded.total, confirmado = excluded.confirmado, sincronizado = excluded.sincronizado, origem = excluded.origem, tipo_bloqueio = excluded.tipo_bloqueio, data_emissao = excluded.data_emissao, data_recebimento = excluded.data_recebimento, data_liberacao = excluded.data_liberacao, hash = excluded.hash, lido_em = excluded.lido_em WHERE clube_pedido.hash IS NOT excluded.hash')
        .bind(String(x.filial), String(x.pedido || 'ID' + x.id), dia, x.rca || null, x.id ? String(x.id) : null, x.pedido_winthor || null, x.cliente || null, x.razao ? String(x.razao).slice(0, 120) : null, Number(x.total) || 0, x.confirmado || null, x.sincronizado || null, x.origem || null, x.tipo_bloqueio || null, x.data_inicial || null, x.data_emissao || null, x.data_recebimento || null, x.data_liberacao || null, h, lidoEm));
    }
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

