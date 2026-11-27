// =========================================================================
// FATOS · functions/_lib/fatos/dia.js
// O QUE É: camada ÚNICA de leitura do intraday (digitado, visitas, rota,
//   positivação do dia e métricas do Bola Cheia).
// FONTES OFICIAIS: Clube da Venda (clube_venda_dia, clube_pedido,
//   clube_acompanhamento_dia, clube_checkin) + GEROT (gerot_pedido) +
//   CEVEN Partner API fallback (ceven_api_pedidos, ceven_api_visitas).
// ZERO leitura de varredura_central_rca, cascata_dia ou meta_hierarquia.
// =========================================================================
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

async function allSeguro(db, sql, ...binds) {
  try {
    const { results } = await db.prepare(sql).bind(...binds).all();
    return results || [];
  } catch {
    return null;
  }
}

export async function digitadoPorFilial(db, dia) {
  const porFilial = new Map();
  const total = { digitado: 0, pedidos: 0, programadas: 0, feitas: 0, rcas: 0 };
  if (!db) return { dia, fonte: 'nenhuma', porFilial, total };

  let rows = await allSeguro(
    db,
    `SELECT UPPER(filial) AS filial, COUNT(*) AS rcas,
            COALESCE(SUM(total_pedido), 0) AS digitado,
            COALESCE(SUM(ped_total), 0) AS pedidos,
            COALESCE(SUM(roteiros), 0) AS programadas,
            COALESCE(SUM(visitas_rota), 0) AS feitas,
            MAX(lido_em) AS lido_em
       FROM clube_venda_dia
      WHERE dia = ?
      GROUP BY UPPER(filial)`,
    dia
  );

  let fonte = 'clube_venda_dia';
  if (!rows || !rows.length) {
    const alt = await allSeguro(
      db,
      `SELECT UPPER(filial) AS filial, COUNT(DISTINCT vendedor_id) AS rcas,
              COALESCE(SUM(valor_digitado), 0) AS digitado,
              COUNT(*) AS pedidos,
              0 AS programadas,
              0 AS feitas,
              MAX(sincronizado_em) AS lido_em
         FROM ceven_api_pedidos
        WHERE substr(data, 1, 10) = ? AND COALESCE(UPPER(status), '') NOT LIKE '%CANCEL%'
        GROUP BY UPPER(filial)`,
      dia
    );
    if (alt && alt.length) {
      rows = alt;
      fonte = 'ceven_api_pedidos';
    } else {
      rows = rows || [];
    }
  }

  for (const r of rows) {
    const sig = String(r.filial || '').toUpperCase().slice(0, 3);
    if (!sig) continue;
    const item = {
      filial: sig,
      rcas: Number(r.rcas) || 0,
      digitado: Number(r.digitado) || 0,
      pedidos: Number(r.pedidos) || 0,
      programadas: Number(r.programadas) || 0,
      feitas: Number(r.feitas) || 0,
      lido_em: r.lido_em || null,
    };
    porFilial.set(sig, item);
    total.rcas += item.rcas;
    total.digitado += item.digitado;
    total.pedidos += item.pedidos;
    total.programadas += item.programadas;
    total.feitas += item.feitas;
  }

  return { dia, fonte, porFilial, total };
}

export async function produtividadeDiaRede(db, dia) {
  const porRca = new Map();
  if (!db) return { dia, fonte: 'nenhuma', porRca };

  const agora = Date.now();
  const [vdRows, pedRowsRaw, acompRows] = await Promise.all([
    allSeguro(
      db,
      `SELECT UPPER(filial) AS filial, rca, roteiros, visitas_rota, ped_rota, ped_total,
              total_pedido, eficiencia, eficacia, lido_em
         FROM clube_venda_dia
        WHERE dia = ?`,
      dia
    ),
    allSeguro(
      db,
      `SELECT UPPER(filial) AS filial, rca, COUNT(DISTINCT cliente) AS pos_cli,
              COALESCE(SUM(valor_total), 0) AS dig_ped, COUNT(*) AS qtd_ped
         FROM clube_pedido
        WHERE dia = ?
          AND COALESCE(UPPER(excluido), '') NOT IN ('SIM', 'S', '1')
          AND COALESCE(UPPER(tipo_venda), '') NOT LIKE '%BONIF%'
        GROUP BY UPPER(filial), rca`,
      dia
    ),
    allSeguro(
      db,
      `SELECT UPPER(filial) AS filial, rca, primeiro_pedido, ultimo_pedido,
              objetivo_visitas, nao_visita, nao_venda, carteira
         FROM clube_acompanhamento_dia
        WHERE dia = ?`,
      dia
    ),
  ]);

  let pedRows = pedRowsRaw;
  if (pedRows === null) {
    pedRows = await allSeguro(
      db,
      `SELECT UPPER(filial) AS filial, rca, COUNT(DISTINCT cliente) AS pos_cli,
              COALESCE(SUM(valor_total), 0) AS dig_ped, COUNT(*) AS qtd_ped
         FROM clube_pedido
        WHERE dia = ?
        GROUP BY UPPER(filial), rca`,
      dia
    );
  }

  const pedMap = new Map();
  for (const r of pedRows || []) {
    pedMap.set(`${String(r.filial).toUpperCase()}|${String(r.rca)}`, r);
  }
  const acompMap = new Map();
  for (const r of acompRows || []) {
    acompMap.set(`${String(r.filial).toUpperCase()}|${String(r.rca)}`, r);
  }

  const chaves = new Set();
  const vdMap = new Map();
  for (const r of vdRows || []) {
    const k = `${String(r.filial).toUpperCase()}|${String(r.rca)}`;
    vdMap.set(k, r);
    chaves.add(k);
  }
  for (const k of pedMap.keys()) chaves.add(k);
  for (const k of acompMap.keys()) chaves.add(k);

  for (const k of chaves) {
    const [filial, rca] = k.split('|');
    const vd = vdMap.get(k);
    const ped = pedMap.get(k);
    const ac = acompMap.get(k);

    const lidoEm = (vd && vd.lido_em) || null;
    const t = lidoEm ? Date.parse(/T/.test(String(lidoEm)) ? String(lidoEm) : String(lidoEm).replace(' ', 'T') + 'Z') : NaN;
    const idade_s = Number.isFinite(t) ? Math.max(0, Math.round((agora - t) / 1000)) : null;

    const programadas = vd ? (num(vd.roteiros) || 0) : (ac && ac.objetivo_visitas != null ? num(ac.objetivo_visitas) || 0 : 0);
    const feitas = vd ? (num(vd.visitas_rota) || 0) : 0;
    const digitado = vd ? (num(vd.total_pedido) ?? (ped ? num(ped.dig_ped) || 0 : 0)) : (ped ? num(ped.dig_ped) || 0 : 0);

    let positivados = null;
    if (ped && num(ped.pos_cli) > 0) {
      positivados = Number(ped.pos_cli);
    } else if (vd) {
      positivados = Math.max(Number(vd.ped_rota) || 0, Number(vd.ped_total) > 0 ? 1 : 0);
    }

    porRca.set(k, {
      filial,
      rca,
      programadas,
      feitas,
      digitado: Number(digitado) || 0,
      positivados: positivados == null ? 0 : positivados,
      ped_rota: vd ? Number(vd.ped_rota) || 0 : 0,
      ped_total: vd ? Number(vd.ped_total) || 0 : (ped ? Number(ped.qtd_ped) || 0 : 0),
      lido_em: lidoEm,
      idade_s,
      primeiro_pedido: (ac && ac.primeiro_pedido) || null,
      ultimo_pedido: (ac && ac.ultimo_pedido) || null,
    });
  }

  return { dia, fonte: vdRows && vdRows.length ? 'clube_venda_dia' : (pedRows && pedRows.length ? 'clube_pedido' : 'nenhuma'), porRca };
}

export async function metricasBolaCheiaDia(db, dia) {
  const out = new Map();
  if (!db) return out;

  const [vdRows, ckRows, pedClRowsRaw, pedGerotRows] = await Promise.all([
    allSeguro(db, 'SELECT UPPER(filial) AS filial, rca, visitas_rota, ped_rota, ped_total, total_pedido FROM clube_venda_dia WHERE dia = ?', dia),
    allSeguro(db, 'SELECT UPPER(filial) AS filial, rca, COUNT(DISTINCT cliente) AS vis_cli FROM clube_checkin WHERE dia = ? GROUP BY UPPER(filial), rca', dia),
    allSeguro(
      db,
      `SELECT UPPER(filial) AS filial, rca, COUNT(DISTINCT cliente) AS pos_cli, COALESCE(SUM(valor_total), 0) AS dig_ped
         FROM clube_pedido
        WHERE dia = ?
          AND COALESCE(UPPER(excluido), '') NOT IN ('SIM', 'S', '1')
          AND COALESCE(UPPER(tipo_venda), '') NOT LIKE '%BONIF%'
        GROUP BY UPPER(filial), rca`,
      dia
    ),
    allSeguro(db, 'SELECT UPPER(filial) AS filial, rca, COUNT(DISTINCT cliente) AS pos_cli FROM gerot_pedido WHERE data = ? GROUP BY UPPER(filial), rca', dia),
  ]);

  let pedClRows = pedClRowsRaw;
  if (pedClRows === null) {
    pedClRows = await allSeguro(
      db,
      'SELECT UPPER(filial) AS filial, rca, COUNT(DISTINCT cliente) AS pos_cli, COALESCE(SUM(valor_total), 0) AS dig_ped FROM clube_pedido WHERE dia = ? GROUP BY UPPER(filial), rca',
      dia
    );
  }

  const acc = (k) => {
    let e = out.get(k);
    if (!e) {
      e = { visitas: 0, positivados: 0, digitado: 0 };
      out.set(k, e);
    }
    return e;
  };

  for (const r of vdRows || []) {
    const e = acc(`${r.filial}|${r.rca}`);
    e.visitas = Math.max(e.visitas, Number(r.visitas_rota) || 0);
    e.positivados = Math.max(e.positivados, Number(r.ped_rota) || 0);
    e.digitado = Math.max(e.digitado, Number(r.total_pedido) || 0);
  }
  for (const r of ckRows || []) {
    const e = acc(`${r.filial}|${r.rca}`);
    e.visitas = Math.max(e.visitas, Number(r.vis_cli) || 0);
  }
  for (const r of pedClRows || []) {
    const e = acc(`${r.filial}|${r.rca}`);
    e.positivados = Math.max(e.positivados, Number(r.pos_cli) || 0);
    e.digitado = Math.max(e.digitado, Number(r.dig_ped) || 0);
  }
  for (const r of pedGerotRows || []) {
    const e = acc(`${r.filial}|${r.rca}`);
    e.positivados = Math.max(e.positivados, Number(r.pos_cli) || 0);
  }

  return out;
}

export async function metricasBolaCheiaSemana(db, dias) {
  const out = new Map();
  if (!db || !Array.isArray(dias) || !dias.length) return out;

  const porDia = await Promise.all(dias.map((d) => metricasBolaCheiaDia(db, d)));
  for (const mapaDia of porDia) {
    for (const [k, v] of mapaDia) {
      const e = out.get(k) || { positivados: 0, digitado: 0 };
      e.positivados += Number(v.positivados) || 0;
      e.digitado += Number(v.digitado) || 0;
      out.set(k, e);
    }
  }
  return out;
}
