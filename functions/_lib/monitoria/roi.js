// =========================================================================
// MONITOR.IA · functions/_lib/monitoria/roi.js
// Loop Fechado e Volume Destravado Auditavel: registra apenas disparos
// reais de PRODUCAO, expira casos de dias anteriores e audita no D1.
// =========================================================================
import { hojeSP, R$ } from '../jota/base.js';
import R from '../../../public/regras.js';

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
      escalonado_em TEXT,
      UNIQUE(data, tipo, referencia)
    )
  `).run().catch(() => {});
  await db.prepare('ALTER TABLE monitoria_roi ADD COLUMN escalonado_em TEXT').run().catch(() => {});
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

export async function escalonarCasosAbertosGerente(db, env, { cfg = null, maxPorRodada = 3 } = {}) {
  if (!db) return { avaliados: 0, escalonados: 0 };
  await garantirTabelaRoi(db);
  const hoje = hojeSP();
  const { results: vencidos } = await db.prepare(`
    SELECT id, filial, supervisor, tipo, referencia, rca, valor_em_risco, detalhe
    FROM monitoria_roi
    WHERE data = ? AND status = 'ABERTO' AND escalonado_em IS NULL
      AND criado_em <= datetime('now', '-2 hours')
    ORDER BY valor_em_risco DESC, id ASC
    LIMIT ?
  `).bind(hoje, maxPorRodada).all().catch(() => ({ results: [] }));
  if (!vencidos || !vencidos.length) return { avaliados: 0, escalonados: 0 };

  let escalonados = 0;
  for (const c of vencidos) {
    const ger = await db.prepare(
      "SELECT nome, celular FROM bot_contatos WHERE UPPER(filial) = UPPER(?) AND LOWER(papel) = 'gerente' AND ativo = 1 AND celular IS NOT NULL LIMIT 1"
    ).bind(String(c.filial || '')).first().catch(() => null);
    if (!ger || !ger.celular || !cfg) continue;

    const msg = [
      `🚨 *Escalonamento >2h · ${c.filial}*`,
      `Alerta *${c.tipo}* (${c.detalhe || c.referencia}) em aberto há mais de 2h com *${c.supervisor}*${c.valor_em_risco > 0 ? ` · ${R$(c.valor_em_risco)}` : ''}.`,
      '',
      `👉 *Ação agora:* cobrar retorno de *${c.supervisor}* para destravar antes do fechamento do dia.`,
    ].join('\n');

    if (escalonados > 0) await R.pausaEntreEnvios(4, 1, 2);
    const rt = await R.enviarTexto(cfg, ger.celular, msg);
    if (rt && rt.ok) {
      escalonados++;
      await db.prepare('UPDATE monitoria_roi SET escalonado_em = CURRENT_TIMESTAMP WHERE id = ?').bind(c.id).run().catch(() => {});
      await db.prepare("INSERT INTO bot_msgs (celular, direcao, texto, tipo) VALUES (?, 'out', ?, 'monitoria_escalonamento')")
        .bind(String(ger.celular), msg.slice(0, 1500)).run().catch(() => {});
    }
  }
  return { avaliados: vencidos.length, escalonados };
}

export async function resumoRoiMonitoria(db) {
  if (!db) return { casos_abertos: 0, casos_recuperados: 0, casos_expirados: 0, taxa_resolucao_pct: 0, tempo_medio_min: null, valor_em_risco_aberto: 0, valor_recuperado_total: 0, por_filial: [], recentes: [] };
  await expirarCasosAntigosRoi(db);
  const agg = await db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'ABERTO' THEN 1 ELSE 0 END) abertos,
      SUM(CASE WHEN status = 'RECUPERADO' THEN 1 ELSE 0 END) recuperados,
      SUM(CASE WHEN status = 'EXPIRADO' THEN 1 ELSE 0 END) expirados,
      COALESCE(SUM(CASE WHEN status = 'ABERTO' THEN valor_em_risco ELSE 0 END), 0) risco_aberto,
      COALESCE(SUM(CASE WHEN status = 'RECUPERADO' THEN valor_recuperado ELSE 0 END), 0) recuperado_total,
      ROUND(AVG(CASE WHEN status = 'RECUPERADO' AND resolvido_em IS NOT NULL AND criado_em IS NOT NULL THEN (julianday(resolvido_em) - julianday(criado_em)) * 1440 END), 0) tempo_medio_min
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
    "SELECT data, filial, supervisor, tipo, referencia, rca, valor_em_risco, valor_recuperado, status, detalhe, resolvido_em, escalonado_em FROM monitoria_roi ORDER BY id DESC LIMIT 15"
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
    tempo_medio_min: agg?.tempo_medio_min != null ? Number(agg.tempo_medio_min) : null,
    valor_em_risco_aberto: Number(agg?.risco_aberto || 0),
    valor_recuperado_total: Number(agg?.recuperado_total || 0),
    por_filial: porFilial || [],
    recentes: recentes || [],
  };
}
