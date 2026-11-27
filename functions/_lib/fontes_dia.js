// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/fontes_dia.js
// O QUE É: Source Broker do intraday — informa frescor e disponibilidade
//   das 3 fontes oficiais (Clube da Venda, CEVEN Partner API, GEROT).
//   Leitura pura em D1; tolerante a tabelas ainda não criadas/populadas.
// =========================================================================
export const SLA_FRESCOR_MIN = 35;
export const SLA_GEROT_MIN = 180;

export function minDesde(iso) {
  if (!iso) return null;
  const s = String(iso).trim();
  const t = Date.parse(/T/.test(s) ? s : s.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

async function umSeguro(db, sql, ...binds) {
  try {
    const r = await db.prepare(sql).bind(...binds).first();
    return r || null;
  } catch {
    return null;
  }
}

export async function statusFontes(db, dia) {
  if (!db) {
    return {
      dia,
      sla_min: SLA_FRESCOR_MIN,
      clube: { em: null, idade_min: null, fresca: false },
      ceven_partner: { em: null, idade_min: null, fresca: false },
      gerot: { em: null, posicao: null, idade_min: null, fresca: false },
      melhor_intraday: 'nenhuma',
    };
  }

  const [clRod, clVd, partnerCur, gerotSt] = await Promise.all([
    umSeguro(db, 'SELECT MAX(lido_em) AS em FROM clube_rodada WHERE dia = ?', dia),
    umSeguro(db, 'SELECT MAX(lido_em) AS em FROM clube_venda_dia WHERE dia = ?', dia),
    umSeguro(db, "SELECT MAX(ultimo_sync_em) AS em FROM ceven_api_cursor WHERE status = 'ok'"),
    umSeguro(db, 'SELECT MAX(em) AS em, MAX(posicao) AS posicao FROM gerot_coleta_status'),
  ]);

  const clEm = (clRod && clRod.em) || (clVd && clVd.em) || null;
  const clMin = minDesde(clEm);
  const clFresca = clMin != null && clMin <= SLA_FRESCOR_MIN;

  const partnerEm = (partnerCur && partnerCur.em) || null;
  const partnerMin = minDesde(partnerEm);
  const partnerFresca = partnerMin != null && partnerMin <= SLA_FRESCOR_MIN;

  const gerotEm = (gerotSt && gerotSt.em) || null;
  const gerotMin = minDesde(gerotEm);
  const gerotFresca = gerotMin != null && gerotMin <= SLA_GEROT_MIN;

  let melhor_intraday = 'nenhuma';
  if (clFresca) melhor_intraday = 'clube';
  else if (partnerFresca) melhor_intraday = 'ceven_partner';
  else if (clEm) melhor_intraday = 'clube_stale';
  else if (partnerEm) melhor_intraday = 'ceven_partner_stale';

  return {
    dia,
    sla_min: SLA_FRESCOR_MIN,
    clube: { em: clEm, idade_min: clMin, fresca: clFresca },
    ceven_partner: { em: partnerEm, idade_min: partnerMin, fresca: partnerFresca },
    gerot: {
      em: gerotEm,
      posicao: (gerotSt && gerotSt.posicao) || null,
      idade_min: gerotMin,
      fresca: gerotFresca,
    },
    melhor_intraday,
  };
}
