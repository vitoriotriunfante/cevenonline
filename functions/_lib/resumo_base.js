// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/resumo_base.js
// O QUE É: calcula meta, faturado, carteira, positivação e digitado do dia
//   por filial e total BRASIL diretamente das fontes oficiais (GEROT + Clube /
//   CEVEN Partner API via fatos/dia.js). Zero leitura de varredura_central_rca,
//   meta_hierarquia ou cascata_dia.
// =========================================================================
import { digitadoPorFilial } from './fatos/dia.js';

export async function universoArvore(env) {
  try {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM arvore_supervisores').first();
    return !!(r && r.n >= 300);
  } catch {
    return false;
  }
}

let cacheResumo = { exp: 0, dataRef: null, res: null };

export async function calculaResumoMes(env, dataRef) {
  const agora = Date.now();
  if (cacheResumo.res && cacheResumo.dataRef === dataRef && agora < cacheResumo.exp) {
    return cacheResumo.res;
  }

  const mes = String(dataRef).slice(0, 7);
  const porFilial = {};
  const nova = () => ({ faturado: 0, pendente: 0, metaFaturado: 0, positivados: 0, metaPositivados: 0, digitado: 0, rcas: 0 });
  const total = nova();

  const [digRes, gfRes, rcaMesRes] = await Promise.all([
    digitadoPorFilial(env.DB, dataRef).catch(() => null),
    env.DB.prepare('SELECT UPPER(filial) AS f, dados FROM gerot_filial_mes WHERE mes = ?').bind(mes).all().catch(() => ({ results: [] })),
    env.DB.prepare('SELECT UPPER(filial) AS f, COUNT(DISTINCT rca) AS n FROM gerot_vendedor_mes WHERE mes = ? GROUP BY UPPER(filial)').bind(mes).all().catch(() => ({ results: [] })),
  ]);

  const rcaGerotPorFil = new Map();
  let totalRcasGerot = 0;
  for (const r of (rcaMesRes && rcaMesRes.results) || []) {
    const sig = String(r.f || '').toUpperCase();
    const n = Number(r.n) || 0;
    if (sig) {
      rcaGerotPorFil.set(sig, n);
      totalRcasGerot += n;
    }
  }

  for (const r of (gfRes && gfRes.results) || []) {
    const sig = String(r.f || '').toUpperCase();
    if (!sig) continue;
    let d = {};
    try { d = JSON.parse(r.dados || '{}'); } catch { continue; }
    const a = porFilial[sig] || (porFilial[sig] = nova());
    a.faturado = Number(d['Faturado líquido (R$)']) || 0;
    a.pendente = Number(d['Carteira pendente (R$)']) || 0;
    a.metaFaturado = Number(d['Meta (R$)']) || 0;
    a.positivados = Number(d['Positivação (filial + CNPJ)'] ?? d['Realizado meta']) || 0;
    a.metaPositivados = Number(d['Meta de positivação'] ?? d['Meta clientes']) || 0;
    a.rcas = rcaGerotPorFil.get(sig) || 0;
    total.faturado += a.faturado;
    total.pendente += a.pendente;
    total.metaFaturado += a.metaFaturado;
    total.positivados += a.positivados;
    total.metaPositivados += a.metaPositivados;
  }

  let deHoje = 0;
  if (digRes && digRes.porFilial) {
    for (const [sig, df] of digRes.porFilial) {
      const a = porFilial[sig] || (porFilial[sig] = nova());
      a.digitado = Number(df.digitado) || 0;
      if (!a.rcas) a.rcas = Number(df.rcas) || 0;
      deHoje += Number(df.rcas) || 0;
      total.digitado += a.digitado;
    }
  }

  total.rcas = totalRcasGerot || deHoje;
  const rcas = Math.max(total.rcas, deHoje);
  const semLeitura = Math.max(0, rcas - deHoje);

  const res = {
    dataRef,
    rcas,
    deHoje,
    anteriores: 0,
    semLeitura,
    maisAntiga: null,
    porFilial,
    total,
  };
  cacheResumo = { exp: agora + 45 * 1000, dataRef, res };
  return res;
}
