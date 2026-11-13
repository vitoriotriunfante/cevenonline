// =========================================================================
// API: GET /api/matinal?filial=XXX&sup=YYY
// Painel da Matinal 100% resiliente ao CEVEN (le direto do D1: GEROT + roteiro_dia + pedido_status + prospects_mapa)
// =========================================================================
import { ehFeriado } from '../_lib/feriados.js';

const j = (obj, st = 200) => new Response(JSON.stringify(obj), {
  status: st,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

function hojeSP() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function diasUteis(hoje) {
  const [y, m, d] = hoje.split('-').map(Number);
  const fim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let tot = 0, pass = 0;
  for (let i = 1; i <= fim; i++) {
    const w = new Date(Date.UTC(y, m - 1, i)).getUTCDay();
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    if (w > 0 && w < 6 && !ehFeriado(iso)) {
      tot++;
      if (i < d) pass++;
    }
  }
  const dec = Math.min(tot, pass + 1);
  return { tot, dec, falt: Math.max(0, tot - dec) };
}

function parseDados(raw) {
  try {
    const d = JSON.parse(raw || '{}');
    return {
      meta: Number(d['Meta (R$)']) || 0,
      fat: Number(d['Faturado líquido (R$)']) || 0,
      pend: Number(d['Carteira pendente (R$)']) || 0,
      capDia: Number(d['Captação Dia (R$)']) || 0,
      dev: Number(d['Devolução (R$)']) || 0,
      pos: Number(d['Positivação (filial + CNPJ)']) || 0,
      metaPos: Number(d['Meta de positivação'] ?? d['Meta clientes']) || 0
    };
  } catch {
    return { meta: 0, fat: 0, pend: 0, capDia: 0, dev: 0, pos: 0, metaPos: 0 };
  }
}

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return j({ erro: 'D1 indisponivel' }, 500);
  const u = new URL(request.url);
  const fil = (u.searchParams.get('filial') || '').toUpperCase().trim();
  const sup = (u.searchParams.get('sup') || '').trim();
  const hoje = hojeSP();
  const mes = hoje.slice(0, 7);
  const dias = diasUteis(hoje);

  try {
    const [stGerot, filRows, supRows, vendRows, rotaRows, pedRows, prospRows] = await Promise.all([
      env.DB.prepare('SELECT posicao, em FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first().catch(() => null),
      env.DB.prepare('SELECT filial, dados, em FROM gerot_filial_mes WHERE mes = ? ORDER BY filial').bind(mes).all(),
      (fil
        ? env.DB.prepare('SELECT filial, cod_sup, supervisor, dados FROM gerot_supervisor_mes WHERE mes = ? AND filial = ? ORDER BY supervisor').bind(mes, fil)
        : env.DB.prepare('SELECT filial, cod_sup, supervisor, dados FROM gerot_supervisor_mes WHERE mes = ? ORDER BY filial, supervisor').bind(mes)
      ).all(),
      (fil
        ? env.DB.prepare('SELECT filial, rca, cod_sup, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ? AND filial = ? ORDER BY vendedor').bind(mes, fil)
        : env.DB.prepare('SELECT filial, rca, cod_sup, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ? ORDER BY filial, vendedor').bind(mes)
      ).all(),
      (fil
        ? env.DB.prepare('SELECT filial, rca, json FROM roteiro_dia WHERE data = ? AND filial = ?').bind(hoje, fil)
        : env.DB.prepare('SELECT filial, rca, json FROM roteiro_dia WHERE data = ?').bind(hoje)
      ).all().catch(() => ({ results: [] })),
      (fil
        ? env.DB.prepare("SELECT filial, rca, status, COUNT(*) qtd, SUM(valor) vlr FROM pedido_status WHERE filial = ? AND data_pedido >= date('now', '-3 hours', '-7 days') AND status IN ('BLOQUEADO','LIBERADO') GROUP BY filial, rca, status").bind(fil)
        : env.DB.prepare("SELECT filial, rca, status, COUNT(*) qtd, SUM(valor) vlr FROM pedido_status WHERE data_pedido >= date('now', '-3 hours', '-7 days') AND status IN ('BLOQUEADO','LIBERADO') GROUP BY filial, rca, status")
      ).all().catch(() => ({ results: [] })),
      (fil
        ? env.DB.prepare('SELECT filial, rca, COUNT(*) qtd FROM prospects_mapa WHERE filial = ? GROUP BY filial, rca').bind(fil)
        : env.DB.prepare('SELECT filial, rca, COUNT(*) qtd FROM prospects_mapa GROUP BY filial, rca')
      ).all().catch(() => ({ results: [] }))
    ]);

    const rotaMap = new Map();
    for (const r of rotaRows.results || []) {
      let clientes = 0;
      try {
        const parsed = JSON.parse(r.json || '[]');
        clientes = Array.isArray(parsed) ? parsed.length : (Array.isArray(parsed.clientes) ? parsed.clientes.length : 0);
      } catch { clientes = 0; }
      rotaMap.set(`${r.filial}|${r.rca}`, clientes);
    }

    const pedMap = new Map();
    for (const p of pedRows.results || []) {
      const k = `${p.filial}|${p.rca}`;
      if (!pedMap.has(k)) pedMap.set(k, { bloqQtd: 0, bloqVlr: 0, libQtd: 0, libVlr: 0 });
      const cur = pedMap.get(k);
      if (p.status === 'BLOQUEADO') { cur.bloqQtd += Number(p.qtd) || 0; cur.bloqVlr += Number(p.vlr) || 0; }
      if (p.status === 'LIBERADO') { cur.libQtd += Number(p.qtd) || 0; cur.libVlr += Number(p.vlr) || 0; }
    }

    const prospMap = new Map();
    for (const pr of prospRows.results || []) {
      prospMap.set(`${pr.filial}|${pr.rca}`, Number(pr.qtd) || 0);
    }

    const filiais = (filRows.results || []).map((f) => {
      const m = parseDados(f.dados);
      const vend = m.fat + m.pend;
      const tend = dias.dec ? (vend / dias.dec) * dias.tot : vend;
      return { filial: f.filial, ...m, vend, tend, tendPct: m.meta ? (tend / m.meta) * 100 : 0, em: f.em };
    });

    const supervisores = (supRows.results || []).map((s) => {
      const m = parseDados(s.dados);
      const vend = m.fat + m.pend;
      const tend = dias.dec ? (vend / dias.dec) * dias.tot : vend;
      return { filial: s.filial, cod_sup: s.cod_sup, supervisor: s.supervisor, ...m, vend, tend, tendPct: m.meta ? (tend / m.meta) * 100 : 0 };
    });

    const vendedores = (vendRows.results || [])
      .filter((v) => !sup || String(v.cod_sup) === sup || String(v.supervisor || '').toUpperCase().includes(sup.toUpperCase()))
      .map((v) => {
        const m = parseDados(v.dados);
        const vend = m.fat + m.pend;
        const tend = dias.dec ? (vend / dias.dec) * dias.tot : vend;
        const falta = Math.max(0, m.meta - vend);
        const k = `${v.filial}|${v.rca}`;
        const p = pedMap.get(k) || { bloqQtd: 0, bloqVlr: 0, libQtd: 0, libVlr: 0 };
        return {
          filial: v.filial,
          rca: v.rca,
          cod_sup: v.cod_sup,
          supervisor: v.supervisor,
          vendedor: v.vendedor,
          ...m,
          vend,
          pctMeta: m.meta ? (vend / m.meta) * 100 : 0,
          tend,
          tendPct: m.meta ? (tend / m.meta) * 100 : 0,
          precisaDia: dias.falt ? falta / dias.falt : falta,
          rotaHoje: rotaMap.get(k) || 0,
          prospects: prospMap.get(k) || 0,
          bloqQtd: p.bloqQtd,
          bloqVlr: p.bloqVlr,
          libQtd: p.libQtd,
          libVlr: p.libVlr
        };
      })
      .sort((a, b) => a.tendPct - b.tendPct || b.meta - a.meta);

    return j({
      ok: true,
      hoje,
      mes,
      dias,
      fonte: {
        modo: 'D1 Offline-Resiliente (GEROT + CEVEN snapshot)',
        gerotPosicao: stGerot?.posicao || null,
        gerotEm: stGerot?.em || filiais[0]?.em || null
      },
      filiais,
      supervisores,
      vendedores
    });
  } catch (e) {
    return j({ ok: false, erro: e.message }, 500);
  }
}

