// =========================================================================
// MONITOR.IA · functions/_lib/monitoria/roi.js
// Loop Fechado e Volume Destravado Auditavel: registra apenas disparos
// reais de PRODUCAO, expira casos de dias anteriores e audita no D1.
// =========================================================================
import { hojeSP } from '../jota/base.js';

export async function garantirTabelaRoi(db) {
  if (!db) return;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS monitoria_roi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      filial TEXT NOT NULL,
      supervisor TEXT NOT NULL,
      tipo TEXT NOT NULL,
      referencia TEXT NOT NULL,
      rca TEXT DEFAULT '',
      valor_em_risco REAL DEFAULT 0,
      valor_recuperado REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ABERTO',
      detalhe TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      resolvido_em TEXT,
      UNIQUE(data, tipo, referencia)
    )
  `).run().catch(() => {});
}

export async function expirarCasosAntigosRoi(db) {
  if (!db) return;
  await garantirTabelaRoi(db);
  const hoje = hojeSP();
  await db.prepare("UPDATE monitoria_roi SET status = 'EXPIRADO', resolvido_em = CURRENT_TIMESTAMP WHERE status = 'ABERTO' AND data < ?")
    .bind(hoje).run().catch(() => {});
}

export async function registrarCasoRoi(db, { data, filial, supervisor, tipo, referencia, rca = '', valor_em_risco = 0, detalhe = '' }) {
  if (!db || !referencia || !tipo) return;
  await garantirTabelaRoi(db);
  await db.prepare(`
    INSERT OR IGNORE INTO monitoria_roi (data, filial, supervisor, tipo, referencia, rca, valor_em_risco, status, detalhe)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ABERTO', ?)
  `).bind(
    data || hojeSP(),
    String(filial || ''),
    String(supervisor || ''),
    String(tipo),
    String(referencia),
    String(rca || ''),
    Number(valor_em_risco) || 0,
    String(detalhe || '').slice(0, 300)
  ).run().catch(() => {});
}

export async function auditarLoopFechadoRoi(db, Es, filial) {
  if (!db || !Es) return { auditados: 0, recuperados: 0 };
  await expirarCasosAntigosRoi(db);
  const hoje = hojeSP();
  const { results: abertos } = await db.prepare(
    "SELECT id, tipo, referencia, rca, valor_em_risco FROM monitoria_roi WHERE data = ? AND filial = ? AND status = 'ABERTO'"
  ).bind(hoje, filial).all().catch(() => ({ results: [] }));
  if (!abertos || !abertos.length) return { auditados: 0, recuperados: 0 };

  const vendMap = new Map((Es.vend || []).map((v) => [String(v.rca), v]));
  let recuperados = 0;

  for (const c of abertos) {
    if (c.tipo === 'BLOQUEIO_CRITICO') {
      const ped = await db.prepare('SELECT status, valor FROM pedido_status WHERE num = ? LIMIT 1')
        .bind(c.referencia).first().catch(() => null);
      if (ped && ped.status && ped.status !== 'BLOQUEADO' && ped.status !== 'CANCELADO') {
        const val = Number(ped.valor || c.valor_em_risco || 0);
        await db.prepare("UPDATE monitoria_roi SET status = 'RECUPERADO', valor_recuperado = ?, resolvido_em = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(val, c.id).run().catch(() => {});
        recuperados++;
      }
    } else if (c.tipo === 'EM_ROTA_SEM_PEDIDO' || c.tipo === 'SEM_CHECKIN' || c.tipo === 'OPORTUNIDADE_ROTA') {
      const v = vendMap.get(String(c.rca || c.referencia));
      if (v && Number(v.dig) > 0) {
        const tetoRisco = Number(c.valor_em_risco) > 0 ? Number(c.valor_em_risco) : Number(v.dig);
        const val = Math.min(Number(v.dig), tetoRisco);
        await db.prepare("UPDATE monitoria_roi SET status = 'RECUPERADO', valor_recuperado = ?, resolvido_em = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(val, c.id).run().catch(() => {});
        recuperados++;
      }
    }
  }
  return { auditados: abertos.length, recuperados };
}

export async function resumoRoiMonitoria(db) {
  if (!db) return { casos_abertos: 0, casos_recuperados: 0, casos_expirados: 0, taxa_resolucao_pct: 0, valor_em_risco_aberto: 0, valor_recuperado_total: 0, por_filial: [], recentes: [] };
  await expirarCasosAntigosRoi(db);
  const agg = await db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'ABERTO' THEN 1 ELSE 0 END) abertos,
      SUM(CASE WHEN status = 'RECUPERADO' THEN 1 ELSE 0 END) recuperados,
      SUM(CASE WHEN status = 'EXPIRADO' THEN 1 ELSE 0 END) expirados,
      COALESCE(SUM(CASE WHEN status = 'ABERTO' THEN valor_em_risco ELSE 0 END), 0) risco_aberto,
      COALESCE(SUM(CASE WHEN status = 'RECUPERADO' THEN valor_recuperado ELSE 0 END), 0) recuperado_total
    FROM monitoria_roi
    WHERE data >= date('now', '-30 days')
  `).first().catch(() => null);
  const { results: porFilial } = await db.prepare(`
    SELECT filial,
      SUM(CASE WHEN status = 'RECUPERADO' THEN 1 ELSE 0 END) recuperados,
      COUNT(*) total,
      COALESCE(SUM(CASE WHEN status = 'RECUPERADO' THEN valor_recuperado ELSE 0 END), 0) valor_recuperado
    FROM monitoria_roi
    WHERE data >= date('now', '-30 days')
    GROUP BY filial
    ORDER BY valor_recuperado DESC, recuperados DESC
    LIMIT 11
  `).all().catch(() => ({ results: [] }));
  const { results: recentes } = await db.prepare(
    "SELECT data, filial, supervisor, tipo, referencia, rca, valor_em_risco, valor_recuperado, status, detalhe, resolvido_em FROM monitoria_roi ORDER BY id DESC LIMIT 15"
  ).all().catch(() => ({ results: [] }));

  const abertos = Number(agg?.abertos || 0);
  const rec = Number(agg?.recuperados || 0);
  const exp = Number(agg?.expirados || 0);
  const tot = abertos + rec + exp;
  return {
    casos_abertos: abertos,
    casos_recuperados: rec,
    casos_expirados: exp,
    taxa_resolucao_pct: tot > 0 ? Math.round((rec / tot) * 1000) / 10 : 0,
    valor_em_risco_aberto: Number(agg?.risco_aberto || 0),
    valor_recuperado_total: Number(agg?.recuperado_total || 0),
    por_filial: porFilial || [],
    recentes: recentes || [],
  };
}
