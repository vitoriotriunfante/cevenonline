// =========================================================================
// API: GET /api/matinal?filial=XXX&sup=YYY
// Painel da Matinal 100% resiliente ao CEVEN (le direto do D1: GEROT + roteiro_dia + pedido_status + prospects_mapa)
// =========================================================================
import { ehFeriado, diaSemLance } from '../_lib/feriados.js';
import { diasUteis as diasUteisFatos, posicaoGerot, filiaisGerot, supervisoresGerot, vendedoresGerot, vendasFornecedorGerot } from '../_lib/fatos/index.js';
import { nomeForn } from '../_lib/jota/respostas/metas_industria.js';

const j = (obj, st = 200) => new Response(JSON.stringify(obj), {
  status: st,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

function hojeSP() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function ultimoDiaUtil(hoje) {
  const [y, m, d] = hoje.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 15; i++) {
    dt.setUTCDate(dt.getUTCDate() - 1);
    const iso = dt.toISOString().slice(0, 10);
    if (!diaSemLance(iso)) return iso;
  }
  return hoje;
}

function camposGerot(d = {}) {
  return {
    meta: Number(d['Meta (R$)']) || 0,
    fat: Number(d['Faturado líquido (R$)']) || 0,
    pend: Number(d['Carteira pendente (R$)']) || 0,
    capDia: Number(d['Captação Dia (R$)']) || 0,
    dev: Number(d['Devolução (R$)']) || 0,
    pos: Number(d['Positivação (filial + CNPJ)']) || 0,
    metaPos: Number(d['Meta de positivação'] ?? d['Meta clientes']) || 0,
    pi: d['% Meta Ideal captação'] == null ? null : Number(d['% Meta Ideal captação']),
    nd: d['Necessidade dia captação (R$)'] == null ? null : Number(d['Necessidade dia captação (R$)'])
  };
}
function parseDados(raw) {
  if (raw && typeof raw === 'object') return camposGerot(raw);
  try { return camposGerot(JSON.parse(raw || '{}')); } catch { return camposGerot({}); }
}

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return j({ erro: 'D1 indisponivel' }, 500);
  const u = new URL(request.url);
  const fil = (u.searchParams.get('filial') || '').toUpperCase().trim();
  const sup = (u.searchParams.get('sup') || '').trim();
  const hoje = hojeSP();
  // 24/11/2026: ultimo dia UTIL (seg-sex sem feriado — NUNCA sabado/domingo) com venda no Clube; reserva = ultimoDiaUtil(hoje)
  let ultUtil = ultimoDiaUtil(hoje);
  try {
    const { results: ds } = await env.DB.prepare("SELECT DISTINCT dia FROM clube_venda_dia WHERE dia < ? AND strftime('%w', dia) BETWEEN '1' AND '5' AND total_pedido > 0 ORDER BY dia DESC LIMIT 10").bind(hoje).all();
    const dOk = (ds || []).map((x) => x.dia).find((d) => !diaSemLance(d));
    if (dOk) ultUtil = dOk;
  } catch (e) { /* sem Clube: regra antiga */ }
  const mes = hoje.slice(0, 7);
  const du = diasUteisFatos();
  const dias = { tot: du.total, dec: du.decorridos, falt: du.restantes };

  try {
    const [gerotPosicao, filList, supList, vendList, rotaRows, pedRows, prospRows, ontRows, indRows] = await Promise.all([
      posicaoGerot(env.DB, mes).catch(() => null),
      filiaisGerot(env.DB, mes).catch(() => []),
      supervisoresGerot(env.DB, fil || null, mes).catch(() => []),
      vendedoresGerot(env.DB, fil || null, mes).catch(() => []),
      (fil
        /* rota do dia = roteiros do Clube de hoje (a tabela roteiro_dia nunca existiu) */
        ? env.DB.prepare('SELECT filial, rca, roteiros n FROM clube_venda_dia WHERE dia = ? AND filial = ?').bind(hoje, fil)
        : env.DB.prepare('SELECT filial, rca, roteiros n FROM clube_venda_dia WHERE dia = ?').bind(hoje)
      ).all().catch(() => ({ results: [] })),
      (fil
        /* 21/11/2026: bloqueados = Carteira Total do GEROT (pedido_status parou em 13/11 com o CEVEN fora); R$ = o do GEROT (preco x qt a faturar), nunca o Clube */
        ? env.DB.prepare("SELECT filial, rca, 'BLOQUEADO' status, COUNT(*) qtd, SUM(valor) vlr FROM gerot_carteira WHERE situacao LIKE 'Bloqueado%' AND filial = ? GROUP BY filial, rca").bind(fil)
        : env.DB.prepare("SELECT filial, rca, 'BLOQUEADO' status, COUNT(*) qtd, SUM(valor) vlr FROM gerot_carteira WHERE situacao LIKE 'Bloqueado%' GROUP BY filial, rca")
      ).all().catch(() => ({ results: [] })),
      (fil
        ? env.DB.prepare('SELECT filial, rca, COUNT(*) qtd FROM prospects_mapa WHERE filial = ? GROUP BY filial, rca').bind(fil)
        : env.DB.prepare('SELECT filial, rca, COUNT(*) qtd FROM prospects_mapa GROUP BY filial, rca')
      ).all().catch(() => ({ results: [] })),
      (fil
        /* 'ontem' = o ultimo dia util pelo Clube (pedido_status parou em 13/11 com o CEVEN fora); positivados do dia o Clube nao tem: fica null */
        ? env.DB.prepare('SELECT filial, rca, SUM(ped_total) qtd, SUM(total_pedido) vlr, NULL pos FROM clube_venda_dia WHERE filial = ? AND dia = ? GROUP BY filial, rca').bind(fil, ultUtil)
        : env.DB.prepare('SELECT filial, rca, SUM(ped_total) qtd, SUM(total_pedido) vlr, NULL pos FROM clube_venda_dia WHERE dia = ? GROUP BY filial, rca').bind(ultUtil)
      ).all().catch(() => ({ results: [] })),
      vendasFornecedorGerot(env.DB, { mes, filiais: fil ? [fil] : null }).then((results) => ({ results })).catch(() => ({ results: [] }))
    ]);

    const rotaMap = new Map();
    for (const r of rotaRows.results || []) {
      const clientes = Number(r.n) || 0;
      rotaMap.set(`${r.filial}|${r.rca}`, clientes);
    }

    // 22/11/2026: R$ dos bloqueados so quando a soma da Carteira Total bate (5%) com a 'Carteira pendente' do GEROT; senao so a quantidade
    let valorOk = false;
    try {
      const cpG = (filList || []).reduce((a, f) => a + (Number(f.cart != null ? f.cart : (f.d && f.d['Carteira pendente (R$)'])) || 0), 0);
      const sc = await env.DB.prepare(`SELECT SUM(valor) s FROM gerot_carteira${fil ? ' WHERE filial = ?' : ''}`).bind(...(fil ? [fil] : [])).first();
      const fAlvo = fil ? (filList || []).find((f) => f.filial === fil) : null;
      const cpF = fil ? (Number(fAlvo && (fAlvo.cart != null ? fAlvo.cart : fAlvo.d?.['Carteira pendente (R$)'])) || 0) : cpG;
      valorOk = cpF > 0 && Math.abs((Number(sc && sc.s) || 0) / cpF - 1) <= 0.05;
    } catch (e) { valorOk = false; }
    const pedMap = new Map();
    for (const p of pedRows.results || []) {
      const k = `${p.filial}|${p.rca}`;
      if (!pedMap.has(k)) pedMap.set(k, { bloqQtd: 0, bloqVlr: 0, libQtd: 0, libVlr: 0 });
      const cur = pedMap.get(k);
      if (p.status === 'BLOQUEADO') { cur.bloqQtd += Number(p.qtd) || 0; cur.bloqVlr += valorOk ? Number(p.vlr) || 0 : 0; }
      if (p.status === 'LIBERADO') { cur.libQtd += Number(p.qtd) || 0; cur.libVlr += Number(p.vlr) || 0; }
    }

    const prospMap = new Map();
    for (const pr of prospRows.results || []) {
      prospMap.set(`${pr.filial}|${pr.rca}`, Number(pr.qtd) || 0);
    }

    const ontMap = new Map();
    for (const o of ontRows.results || []) {
      ontMap.set(`${o.filial}|${o.rca}`, {
        qtd: Number(o.qtd) || 0,
        vlr: Number(o.vlr) || 0,
        pos: Number(o.pos) || 0
      });
    }

    const filiais = (filList || []).map((f) => {
      const m = parseDados(f.d);
      const vend = m.fat + m.pend;
      const tendPct = m.pi != null ? m.pi * 100 : 0, tend = m.meta * (tendPct / 100);   // ritmo do GEROT (captacao / meta ideal); tend = ritmo em R$ da meta, so para somar grupos
      return { filial: f.filial, ...m, vend, tend, tendPct, em: f.em };
    });

    const supervisores = (supList || []).map((s) => {
      const m = parseDados(s.d);
      const vend = m.fat + m.pend;
      const tendPct = m.pi != null ? m.pi * 100 : 0, tend = m.meta * (tendPct / 100);
      return { filial: s.filial, cod_sup: s.cod_sup, supervisor: s.supervisor, ...m, vend, tend, tendPct };
    });

    const vendedores = (vendList || [])
      .filter((v) => {
        const rcaS = v.rcaRaw || v.rca;
        if (String(rcaS || '').includes('|')) return false;
        if (/(Hist[oó]rico|\bVAGO\b)/i.test(String(v.vendedor || ''))) return false;
        if (sup && String(v.cod_sup) !== sup && !String(v.supervisor || '').toUpperCase().includes(sup.toUpperCase())) return false;
        return true;
      })
      .map((v) => {
        const m = parseDados(v.d);
        const rcaS = v.rcaRaw || v.rca;
        const vend = m.fat + m.pend;
        const tendPctG = m.pi != null ? m.pi * 100 : 0, tend = m.meta * (tendPctG / 100);   // 21/11/2026: ritmo do GEROT, igual ao texto
        const falta = Math.max(0, m.meta - vend);
        const k = `${v.filial}|${rcaS}`;
        const p = pedMap.get(k) || { bloqQtd: 0, bloqVlr: 0, libQtd: 0, libVlr: 0 };
        const ont = ontMap.get(k) || { qtd: 0, vlr: 0, pos: 0 };
        return {
          filial: v.filial,
          rca: rcaS,
          cod_sup: v.cod_sup,
          supervisor: v.supervisor,
          vendedor: v.vendedor,
          ...m,
          vend,
          pctMeta: m.meta ? (vend / m.meta) * 100 : 0,
          tend,
          tendPct: tendPctG,
          precisaDia: m.nd != null ? m.nd : (dias.falt ? falta / dias.falt : falta),
          rotaHoje: rotaMap.get(k) || 0,
          prospects: prospMap.get(k) || 0,
          bloqQtd: p.bloqQtd,
          bloqVlr: p.bloqVlr,
          libQtd: p.libQtd,
          libVlr: p.libVlr,
          ontQtd: ont.qtd,
          ontVlr: ont.vlr,
          ontPos: ont.pos
        };
      })
      .filter((v) => v.meta > 0 || v.fat !== 0 || v.pend !== 0 || v.ontVlr > 0 || v.rotaHoje > 0)
      .sort((a, b) => a.tendPct - b.tendPct || b.meta - a.meta);

    const accInd = (map, chave, ind, m) => {
      if (!map.has(chave)) map.set(chave, new Map());
      const sub = map.get(chave);
      if (!sub.has(ind)) sub.set(ind, { ind, meta: 0, fat: 0, pend: 0, pos: 0, piM: 0, nd: 0, temPi: false });
      const cur = sub.get(ind);
      cur.meta += m.meta;
      cur.fat += m.fat;
      cur.pend += m.pend;
      cur.pos += m.pos;
      if (m.pi != null && m.meta > 0) { cur.piM += m.meta * m.pi; cur.temPi = true; }   // 21/11/2026: ritmo do GEROT ponderado pela meta
      if (m.nd != null) cur.nd += m.nd;
    };
    const supIndMap = new Map(), filIndMap = new Map(), brIndMap = new Map();
    for (const r of indRows.results || []) {
      let d = {};
      try { d = JSON.parse(r.dados || '{}'); } catch { continue; }
      const ind = nomeForn(d.Fornecedor);
      if (!ind) continue;
      const m = parseDados(r.dados);
      const codSup = String(r.cod_sup || '').trim();
      if (codSup) accInd(supIndMap, `${r.filial}:${codSup}`, ind, m);
      accInd(filIndMap, r.filial, ind, m);
      accInd(brIndMap, 'brasil', ind, m);
    }
    // 23/11/2026 (docs/DICIONARIO_KPIS.md 3.22, conflito 7): positivacao por industria na filial e no Brasil = clientes distintos com faturado > 0
    // (gerot_cliente_forn_mes), nunca a soma dos vendedores (o mesmo cliente de duas pastas contava 2x). Brasil = soma das filiais (CNPJ e por filial).
    try {
      const { results: PF } = await env.DB.prepare("SELECT filial, fornecedor, count(*) n FROM (SELECT filial, max(fornecedor) fornecedor, forn_cod, cliente, sum(json_extract(dados, '$.\"Faturado líquido (R$)\"')) f FROM gerot_cliente_forn_mes WHERE mes = ? GROUP BY filial, forn_cod, cliente) WHERE f > 0 GROUP BY filial, forn_cod").bind(mes).all();
      const porFI = new Map();
      for (const r of PF || []) { const ind = nomeForn(r.fornecedor); if (!ind) continue; const k = r.filial + '|' + ind; porFI.set(k, (porFI.get(k) || 0) + (Number(r.n) || 0)); }
      if (porFI.size) {
        for (const [fil, sub] of filIndMap) for (const [ind, cur] of sub) cur.pos = porFI.get(fil + '|' + ind) || 0;
        const br = brIndMap.get('brasil'); if (br) for (const [ind, cur] of br) cur.pos = [...filIndMap.keys()].reduce((a, fil) => a + (porFI.get(fil + '|' + ind) || 0), 0);
      }
    } catch (e) { /* sem a tabela: fica a soma, que so vale como referencia */ }
    const fmtIndList = (sub) => [...(sub ? sub.values() : [])]
      .filter((x) => x.meta > 0 || x.fat !== 0 || x.pend !== 0 || x.pos > 0)
      .map((x) => {
        const vend = x.fat + x.pend;
        const tend = x.temPi ? x.piM : 0;   // 21/11/2026: ritmo do GEROT (captacao / meta ideal), nunca projecao
        return {
          ind: x.ind,
          meta: x.meta,
          fat: x.fat,
          pend: x.pend,
          vend,
          pctMeta: x.meta ? (vend / x.meta) * 100 : 0,
          tend,
          tendPct: x.meta ? (tend / x.meta) * 100 : 0,
          precisaDia: x.meta ? x.nd : 0,
          pos: x.pos
        };
      })
      .sort((a, b) => ((b.meta > 0) - (a.meta > 0)) || (a.meta > 0 && b.meta > 0 ? a.tendPct - b.tendPct || b.meta - a.meta : b.vend - a.vend));

    const industrias = {
      porSup: Object.fromEntries([...supIndMap.entries()].map(([k, sub]) => [k, fmtIndList(sub)])),
      porFilial: Object.fromEntries([...filIndMap.entries()].map(([k, sub]) => [k, fmtIndList(sub)])),
      brasil: fmtIndList(brIndMap.get('brasil'))
    };

    return j({
      ok: true,
      hoje,
      ontemData: ultUtil,
      mes,
      dias,
      fonte: {
        modo: 'D1 (GEROT + Clube da Venda)',
        gerotPosicao: gerotPosicao || null,
        gerotEm: filiais[0]?.em || null
      },
      filiais,
      supervisores,
      vendedores,
      industrias
    });
  } catch (e) {
    return j({ ok: false, erro: e.message }, 500);
  }
}

