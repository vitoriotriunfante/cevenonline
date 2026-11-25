// =========================================================================
// FICHA DO ARQUIVO: pipeline/gerot_motor_coleta.mjs
// O QUE É: Coletor oficial do GEROT (HTTP puro + motor criarMotor(cubo), ZERO Playwright).
//   Le todas as 43 telas do painel via /painel/manifesto + blocos SHA-256 em 3 tiers:
//   - Tier 1 (toda janela par :40): Nucleo contabil (Filial/Sup/Vend/Forn/Dia/Cliente/ClienteForn/Pedido),
//     Dimensoes (Canal/Depto/Secao/Rede/Cidade/NF Dev), Carteira Total, Dev. Motivo (+vend),
//     DRE Performance, Curva Negativa Margem, Histograma Margem -> Portao Contabil.
//   - Tier 2 (00h, 06h, 14h BRT ou --tier=all): Cliven, Estoque FEFO, Estoque Winthor,
//     Cadastro de Clientes, Visao Campo (se presente no cubo).
//   - Tier 3 (00h, 14h BRT ou --tier=all): Recorrencia (Lista dia 1, faixas, clientes),
//     RFV (resumo + clientes), PMI, JBP por SKU.
//   - Sempre ao final: atualiza fatos_briefing_cache (BRASIL + 11 filiais, < 1500 tokens).
// SEGURANCA (repo publico): nunca imprime e-mail, senha, cookie, clientes, CNPJs ou valores em R$.
// =========================================================================
import crypto from 'crypto';
import zlib from 'zlib';
import { loginGerot, carregarCuboEMotor } from './gerot_motor_lib.mjs';

const API = (process.env.SITE_CFTV || 'https://ceven-cftv-matrix.pages.dev') + '/api/gerot-carga';
const KEY = process.env.EVO_KEY || '';
const EMAIL = process.env.GEROT_EMAIL || '';
const SENHA = process.env.GEROT_SENHA || '';

const ARGS = process.argv.slice(2);
const argVal = (p) => (ARGS.find((a) => a.startsWith(p + '=')) || '').slice(p.length + 1);
const ENSAIO = ARGS.includes('--ensaio');
const FORCAR = ARGS.includes('--forcar');
const MESES_ARG = argVal('--meses');
const TIER_ARG = (argVal('--tier') || 'auto').toLowerCase();

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const R2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const R4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10000) / 10000);
const frac = (num, den) => (den > 0 && num != null ? R4(num / den) : null);
const sha = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const nCnpj = (c) => String(c || '').replace(/\D/g, '').padStart(14, '0');
const SEP = '\u001f';
const nfDe = (np, fil, ped) => {
  if (!np) return '';
  const v = np[`${fil}|${ped}`] ?? np[ped];
  if (v == null) return '';
  return Array.isArray(v) ? String(v[0] || '') : String(v);
};
const fimDoMes = (m) => {
  const [y, mm] = m.split('-').map(Number);
  return `${m}-${String(new Date(Date.UTC(y, mm, 0)).getUTCDate()).padStart(2, '0')}`;
};
const mesMenos = (m, k) => {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mm - 1 - k, 1));
  return d.toISOString().slice(0, 7);
};
const fmtBrHora = (iso, comAno = true) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return '';
  return comAno ? `${m[3]}/${m[2]}/${m[1].slice(2)} ${m[4]}:${m[5]}` : `${m[3]}/${m[2]} ${m[4]}:${m[5]}`;
};
const fmtBrData = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

function horaBRT() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit'
  }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t)?.value || '';
  return { diaIso: `${g('year')}-${g('month')}-${g('day')}`, hora: Number(g('hour')) || 0 };
}

function tiersAtivos() {
  if (TIER_ARG === 'all' || TIER_ARG === 'todos') return new Set([1, 2, 3]);
  if (TIER_ARG === '1') return new Set([1]);
  if (TIER_ARG === '2') return new Set([1, 2]);
  if (TIER_ARG === '3') return new Set([1, 3]);
  const { hora } = horaBRT();
  if (hora <= 3) return new Set([1, 2, 3]);
  if (hora === 6 || hora === 7 || hora === 14 || hora === 15) return new Set([1, 2]);
  return new Set([1]);
}

async function api(method, query = '', body = null) {
  if (ENSAIO) return { ok: true, ensaio: true, hashes: {} };
  let lastErr = null;
  for (let t = 1; t <= 4; t++) {
    try {
      const r = await fetch(API + query, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Evo-Key': KEY },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(90000)
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(`D1 HTTP ${r.status}: ${txt.slice(0, 180)}`);
      return txt ? JSON.parse(txt) : { ok: true };
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 1500 * t));
    }
  }
  throw lastErr || new Error('falha D1');
}

async function enviaEmLotes(chave, itens, tam = 200, extrasPrimeiro = {}) {
  if (!itens.length) return 0;
  const lotes = [];
  for (let i = 0; i < itens.length; i += tam) lotes.push(itens.slice(i, i + tam));
  const temLimpeza = Object.keys(extrasPrimeiro).length > 0;
  let inicio = 0;
  if (temLimpeza) {
    await api('POST', '', { ...extrasPrimeiro, [chave]: lotes[0] });
    inicio = 1;
  }
  const conc = 3;
  for (let i = inicio; i < lotes.length; i += conc) {
    await Promise.all(lotes.slice(i, i + conc).map((lote) => api('POST', '', { [chave]: lote })));
  }
  return itens.length;
}
const todasChaves = (...maps) => {
  const s = new Set();
  for (const m of maps) if (m) for (const k of m.keys()) s.add(k);
  return s;
};

function criarHelpersDim(cubo) {
  const dim = cubo.dim || {};
  const FW = (cubo.clivenCad && cubo.clivenCad.f) || {};
  const CAD = (cubo.clivenCad && cubo.clivenCad.c) || {};
  const filCod = (dim.filial && dim.filial.cod) || [];
  const filNom = (dim.filial && dim.filial.nome) || [];

  // Mapa robusto nome/codigo -> sigla 3 letras (ABC, TPH, etc.)
  const filSiglaMap = new Map();
  filCod.forEach((c, i) => {
    const sg = String(filNom[i] || c || '').trim().toUpperCase().replace(/^TRIUNFANTE\s*-\s*/, '').slice(0, 3);
    if (/^[A-Z]{3}$/.test(sg)) {
      filSiglaMap.set(String(c).trim().toUpperCase(), sg);
      filSiglaMap.set(sg, sg);
      if (filNom[i]) filSiglaMap.set(String(filNom[i]).trim().toUpperCase(), sg);
    }
  });
  const paraSigla = (v) => {
    const k = String(v || '').trim().toUpperCase();
    if (filSiglaMap.has(k)) return filSiglaMap.get(k);
    const m = k.match(/\b([A-Z]{3})\b/);
    return m ? m[1] : k.slice(0, 3);
  };
  const siglaPorIdx = (fi) => paraSigla(filNom[fi] || filCod[fi]);
  const codFilPorSigla = (sg) => {
    const idx = filCod.findIndex((c, i) => siglaPorIdx(i) === sg);
    return idx >= 0 ? String(filCod[idx]) : sg;
  };
  const fornInfo = (foIdx) => {
    const cnpjRaw = String((dim.fornecedor && dim.fornecedor.cod && dim.fornecedor.cod[foIdx]) || '');
    const nome = String((dim.fornecedor && dim.fornecedor.nome && dim.fornecedor.nome[foIdx]) || cnpjRaw).trim();
    const c14 = nCnpj(cnpjRaw);
    const codW = FW[c14] != null ? String(FW[c14]) : '';
    const chave = codW && !/#\d+$/.test(nome) ? `${nome} #${codW}` : nome;
    return { nome, cnpjRaw, c14, codW: codW || cnpjRaw, chave };
  };
  const cliInfo = (clIdx) => {
    const cnpjRaw = String((dim.cliente && dim.cliente.cod && dim.cliente.cod[clIdx]) || '');
    const cad = CAD[cnpjRaw] || CAD[nCnpj(cnpjRaw)] || null;
    const nome = String((cad && cad[0]) || (dim.cliente && dim.cliente.nome && dim.cliente.nome[clIdx]) || cnpjRaw).trim();
    const codcli = cad && cad[4] ? String(cad[4]) : '';
    const uf = (cad && cad[1]) || '';
    const mun = (cad && cad[2]) || '';
    const status = (cad && cad[3]) || '';
    return { cnpj: cnpjRaw, codcli, cliente: codcli || cnpjRaw, nome, uf, mun, status };
  };
  return { dim, FW, CAD, paraSigla, siglaPorIdx, codFilPorSigla, fornInfo, cliInfo };
}

function calcMesesRef(mes, cubo, ate) {
  const fD = cubo.posicoes && cubo.posicoes[mes] ? cubo.posicoes[mes] : ate;
  const diaNum = Math.min(Number(fD.slice(8, 10)) || 28, 31);
  const ateDe = (m) => {
    const u = Number(fimDoMes(m).slice(8, 10));
    return `${m}-${String(Math.min(diaNum, u)).padStart(2, '0')}`;
  };
  const disp = new Set(cubo.meses || []);
  const m1 = mesMenos(mes, 1);
  const m2 = mesMenos(mes, 2);
  const m3 = mesMenos(mes, 3);
  const a1 = mesMenos(mes, 12);
  const bench = cubo.bench || cubo.mesBench || '2025-07';
  return {
    ate: fD,
    m1: disp.has(m1) ? { mes: m1, ate: ateDe(m1) } : null,
    m3: [m1, m2, m3].filter((m) => disp.has(m)).map((m) => ({ mes: m, ate: ateDe(m) })),
    a1: disp.has(a1) ? { mes: a1, ate: ateDe(a1) } : null,
    bench: disp.has(bench) ? { mes: bench, ate: fimDoMes(bench) } : null
  };
}

function indexarExtrair(res, campos, H) {
  const map = new Map();
  const dim = H.dim;
  const keyFn = (idx) => idx.map((v, j) => {
    const c = campos[j];
    if (c === 'fi') return H.siglaPorIdx(v);
    if (c === 'su') return String((dim.supervisor && dim.supervisor.cod && dim.supervisor.cod[v]) ?? v);
    if (c === 've') return String((dim.vendedor && dim.vendedor.cod && dim.vendedor.cod[v]) ?? v);
    if (c === 'fo') return H.fornInfo(v).chave;
    if (c === 'cl') return String((dim.cliente && dim.cliente.cod && dim.cliente.cod[v]) ?? v);
    if (c === 'ca') return String((dim.canal && dim.canal.cod && dim.canal.cod[v]) ?? v);
    if (c === 'sk') return String((dim.produto && dim.produto.cod && dim.produto.cod[v]) ?? v);
    if (c === 'dia') return String((dim.dia && dim.dia[v]) ?? v);
    if (c === 'pe') return String((dim.pedido && dim.pedido[v]) ?? v);
    return String(v);
  }).join(SEP);

  for (const r of (res && res.linhas) || []) {
    const k = keyFn(r.idx);
    const cur = map.get(k);
    if (!cur) {
      map.set(k, { ...r });
    } else {
      cur.bruto += r.bruto || 0;
      cur.devolucao += r.devolucao || 0;
      cur.desconto += r.desconto || 0;
      cur.bonificacao += r.bonificacao || 0;
      cur.troca += r.troca || 0;
      cur.cmv += r.cmv || 0;
      cur.impostos += r.impostos || 0;
      cur.positivacao += r.positivacao || 0;
      cur.itens += r.itens || 0;
      cur.pedidos += r.pedidos || 0;
      if (r.carteira != null) cur.carteira = (cur.carteira || 0) + r.carteira;
      if (r.carteiraPedidos != null) cur.carteiraPedidos = (cur.carteiraPedidos || 0) + r.carteiraPedidos;
      if (r.carteiraQt != null) cur.carteiraQt = (cur.carteiraQt || 0) + r.carteiraQt;
      if (r.carteiraCx != null) cur.carteiraCx = (cur.carteiraCx || 0) + r.carteiraCx;
      if (r.carteiraKg != null) cur.carteiraKg = (cur.carteiraKg || 0) + r.carteiraKg;
      cur.corteComercial += r.corteComercial || 0;
      cur.corteLogistico += r.corteLogistico || 0;
      if (r.corteUnComercial != null) cur.corteUnComercial = (cur.corteUnComercial || 0) + r.corteUnComercial;
      if (r.corteUnLogistico != null) cur.corteUnLogistico = (cur.corteUnLogistico || 0) + r.corteUnLogistico;
      if (r.meta != null) cur.meta = (cur.meta || 0) + r.meta;
      cur.captacao += r.captacao || 0;
      if (r.positivacaoCarteira != null) cur.positivacaoCarteira = (cur.positivacaoCarteira || 0) + r.positivacaoCarteira;
      if (r.positivacaoCaptacao != null) cur.positivacaoCaptacao = (cur.positivacaoCaptacao || 0) + r.positivacaoCaptacao;
      if (r.positivacaoClube != null) cur.positivacaoClube = (cur.positivacaoClube || 0) + r.positivacaoClube;
      if (r.positivacaoClubeInd != null) cur.positivacaoClubeInd = (cur.positivacaoClubeInd || 0) + r.positivacaoClubeInd;
    }
  }
  return { map, keyFn };
}

function indexarMetaPos(mpMap, campos, H) {
  const out = new Map();
  if (!mpMap) return out;
  const dim = H.dim;
  for (const [kIdx, val] of mpMap.entries()) {
    const idxs = kIdx === '' ? [] : kIdx.split('|').map(Number);
    const k = idxs.map((v, j) => {
      const c = campos[j];
      if (c === 'fi') return H.siglaPorIdx(v);
      if (c === 'su') return String((dim.supervisor && dim.supervisor.cod && dim.supervisor.cod[v]) ?? v);
      if (c === 've') return String((dim.vendedor && dim.vendedor.cod && dim.vendedor.cod[v]) ?? v);
      if (c === 'fo') return H.fornInfo(v).chave;
      return String(v);
    }).join(SEP);
    out.set(k, (out.get(k) || 0) + (Number(val) || 0));
  }
  return out;
}

function montaDadosComum(r, refs, opt = {}) {
  const fatLiq = R2(((r.bruto || 0) - (r.devolucao || 0)) / 100) || 0;
  const bruto = R2((r.bruto || 0) / 100) || 0;
  const dev = R2((r.devolucao || 0) / 100) || 0;
  const desc = R2((r.desconto || 0) / 100) || 0;
  const bonif = R2((r.bonificacao || 0) / 100) || 0;
  const troca = R2((r.troca || 0) / 100) || 0;
  const cmv = R2((r.cmv || 0) / 100) || 0;
  const imp = R2((r.impostos || 0) / 100) || 0;
  const mcRs = r.cmv != null ? R2(((r.bruto || 0) - (r.devolucao || 0) - (r.cmv || 0) - (r.bonificacao || 0)) / 100) : null;
  const meta = r.meta != null ? R2(r.meta / 100) : null;
  const cart = r.carteira != null ? R2(r.carteira / 100) : null;
  const cap = R2((r.captacao || 0) / 100) || 0;
  const pctMes = opt.pctMesCorrido || 0;
  const ideal = meta != null && pctMes > 0 ? R2(meta * pctMes) : null;
  const capDia = opt.capDia != null ? R2(opt.capDia / 100) : 0;
  const duRest = opt.diasUteisRestantes || 0;
  const necDia = meta != null && duRest > 0 ? R2(Math.max(0, meta - cap) / duRest) : (meta != null ? 0 : null);
  const pos = r.positivacao || 0;
  const posCart = r.positivacaoCarteira != null ? r.positivacaoCarteira : null;
  const posCapt = r.positivacaoCaptacao != null ? r.positivacaoCaptacao : null;
  const mp = opt.mp > 0 ? opt.mp : null;
  const mpc = opt.mpc > 0 ? opt.mpc : null;
  const rmp = mp ? (opt.usaClubeInd ? (r.positivacaoClubeInd ?? pos) : opt.usaClube ? (r.positivacaoClube ?? pos) : pos) : null;
  const corteC = R2((r.corteComercial || 0) / 100) || 0;
  const corteL = R2((r.corteLogistico || 0) / 100) || 0;
  const fatCart = cart != null ? R2(fatLiq + cart) : fatLiq;

  const d = {
    'Faturado líquido (R$)': fatLiq,
    'Faturado bruto (R$)': bruto,
    'Devolução (R$)': dev,
    '% Devolução s/ bruto': frac(dev, bruto),
    'Desconto (R$)': desc,
    'Bonificação a tabela (R$)': bonif,
    'Troca (R$)': troca,
    'Positivação A-1': refs.posA1 ?? null,
    'Positivação 3M (média)': refs.pos3M ?? null,
    'Positivação M-1': refs.posM1 ?? null,
    'Positivação do dia': opt.posDia ?? 0,
    'Positivação (filial + CNPJ)': pos,
    'Positivação + Carteira': posCart,
    'Realizado meta': rmp,
    'Meta de positivação': mp,
    '% Meta positivação': mp && rmp != null ? frac(rmp, mp) : null,
    '% Meta (Pos + Cart)': mpc && posCart != null ? frac(posCart, mpc) : null,
    'Positivação Bench jul/25': refs.posB ?? null,
    '% Bench positivação': refs.posB > 0 ? frac(pos, refs.posB) : null,
    'Positivação + Captação': posCapt,
    'Meta clientes': mpc,
    '% Meta (Pos + Capt)': mpc && posCapt != null ? frac(posCapt, mpc) : null,
    'SKU / Cliente (mix)': pos > 0 ? R2((r.itens || 0) / pos) : null,
    'Fat por Cliente (R$)': pos > 0 ? R2(fatLiq / pos) : null,
    'Pedidos faturados': r.pedidos || 0,
    'Margem de contribuição (R$)': mcRs,
    'Margem de contribuição (%)': fatLiq > 0 && mcRs != null ? frac(mcRs, fatLiq) : null,
    'Impostos PIS/COFINS (R$)': imp,
    'Meta (R$)': meta,
    '% Meta': meta > 0 ? frac(fatLiq, meta) : null,
    'Captação (R$)': cap,
    'Meta Ideal captação (R$)': ideal,
    '% Meta Ideal captação': ideal > 0 ? frac(cap, ideal) : null,
    'Captação Dia (R$)': capDia,
    'Necessidade dia captação (R$)': necDia,
    'Carteira pendente (R$)': cart,
    'Pedidos na carteira': r.carteiraPedidos ?? null,
    'Faturado + Carteira (R$)': fatCart,
    '% Meta (Fat + Cart)': meta > 0 ? frac(fatCart, meta) : null,
    'Volume em carteira (un)': r.carteiraQt ?? null,
    'Caixas em carteira': r.carteiraCx != null ? R2(r.carteiraCx) : null,
    'Peso líquido em carteira (kg)': r.carteiraKg != null ? R2(r.carteiraKg) : null,
    'Corte comercial (R$)': corteC,
    'Corte logístico (R$)': corteL,
    'Cortes total (R$)': R2(corteC + corteL),
    'Corte comercial (un)': r.corteUnComercial ?? 0,
    'Corte logístico (un)': r.corteUnLogistico ?? 0,
    'Cortes total (un)': (r.corteUnComercial || 0) + (r.corteUnLogistico || 0),
    'Captação M-1 (R$)': refs.capM1 ?? null
  };
  if (opt.tmf != null) d['TMF (dias)'] = R2(opt.tmf);
  if (opt.extras) Object.assign(d, opt.extras);
  return d;
}

function rfvSegmento(r, f, v) {
  const fv = (f + v) / 2;
  if (r === 4 && fv >= 3.5) return 'Campeões';
  if ((r === 3 && fv >= 2.5) || (r === 4 && fv >= 2.5 && fv < 3.5)) return 'Fiéis';
  if (r >= 3 && fv >= 1.5 && fv < 2.5) return 'Potenciais fiéis';
  if (r >= 3 && fv < 1.5) return 'Novos e promissores';
  if (r <= 2 && fv >= 2.5) return 'Em risco, alto valor';
  if (r >= 1 && r <= 2 && fv < 2.5) return 'Esfriando';
  return 'Perdidos';
}

function extrairHistogramaECurvaNeg(motor, cubo, H, mes, ate, pedMeta) {
  let B = null;
  try { B = motor.distMargem({ mes, ate }, 'item'); } catch { return { curvaNeg: [], hist: [] }; }
  if (!B || !B.n) return { curvaNeg: [], hist: [] };

  const dim = H.dim;
  const nPed = new Map(); // pedIdx -> stats
  const FAIXAS_DESC = [
    ['0%', (p) => p <= 0.0001],
    ['0% a 2%', (p) => p > 0.0001 && p <= 0.02],
    ['2% a 5%', (p) => p > 0.02 && p <= 0.05],
    ['5% a 10%', (p) => p > 0.05 && p <= 0.10],
    ['10% a 15%', (p) => p > 0.10 && p <= 0.15],
    ['15% a 20%', (p) => p > 0.15 && p <= 0.20],
    ['20% a 25%', (p) => p > 0.20 && p <= 0.25],
    ['25% a 30%', (p) => p > 0.25 && p <= 0.30],
    ['> 30%', (p) => p > 0.30]
  ];
  const FAIXAS_MG = [
    ['< 0%', (m) => m < 0],
    ['0% a 5%', (m) => m >= 0 && m < 0.05],
    ['5% a 10%', (m) => m >= 0.05 && m < 0.10],
    ['10% a 15%', (m) => m >= 0.10 && m < 0.15],
    ['15% a 20%', (m) => m >= 0.15 && m < 0.20],
    ['20% a 30%', (m) => m >= 0.20 && m < 0.30],
    ['> 30%', (m) => m >= 0.30]
  ];
  const histMap = new Map();
  const addHist = (fil, tipo, faixa, b, mc) => {
    const k = `${fil}|${tipo}|${faixa}`;
    const o = histMap.get(k) || { mes, filial: fil, tipo, faixa, itens: 0, b: 0, mc: 0 };
    o.itens++;
    o.b += b;
    o.mc += mc;
    histMap.set(k, o);
  };

  for (let e = 0; e < B.n; e++) {
    const b = B.b[e];
    if (!(b > 0)) continue;
    const cu = B.cu ? B.cu[e] : 0;
    const ds = B.ds ? B.ds[e] : 0;
    const mc = b - cu;
    const fil = H.siglaPorIdx(B.fi[e]);
    const pctDs = ds / b;
    const pctMc = mc / b;
    const fDs = (FAIXAS_DESC.find(([, fn]) => fn(pctDs)) || FAIXAS_DESC[8])[0];
    const fMg = (FAIXAS_MG.find(([, fn]) => fn(pctMc)) || FAIXAS_MG[6])[0];
    addHist('BRASIL', 'desconto', fDs, b, mc);
    addHist(fil, 'desconto', fDs, b, mc);
    addHist('BRASIL', 'margem', fMg, b, mc);
    addHist(fil, 'margem', fMg, b, mc);

    const peIdx = B.pe ? B.pe[e] : -1;
    const pedCod = dim.pedido && peIdx >= 0 ? String(dim.pedido[peIdx] || '') : '';
    if (!pedCod || pedCod === '0' || /^NFD/i.test(pedCod)) continue;
    const kP = `${fil}|${pedCod}`;
    let p = nPed.get(kP);
    if (!p) {
      p = {
        filial: fil, pedido: pedCod, fi: B.fi[e], su: B.su[e], ve: B.ve[e], cl: B.cl[e],
        sks: new Set(), b: 0, ds: 0, cu: 0, mgPerd: 0
      };
      nPed.set(kP, p);
    }
    p.sks.add(B.sk[e]);
    p.b += b;
    p.ds += ds;
    p.cu += cu;
    if (mc < 0) p.mgPerd += mc;
  }

  const notasPed = cubo.notasPed || {};
  const curvaNeg = [];
  for (const p of nPed.values()) {
    const mg = p.b - p.cu;
    if (mg >= 0) continue;
    const cli = H.cliInfo(p.cl);
    const rca = String((dim.vendedor && dim.vendedor.cod && dim.vendedor.cod[p.ve]) ?? '');
    const vNome = String((dim.vendedor && dim.vendedor.nome && dim.vendedor.nome[p.ve]) ?? rca);
    const supCod = String((dim.supervisor && dim.supervisor.cod && dim.supervisor.cod[p.su]) ?? '');
    const metaPed = pedMeta.get(`${p.filial}|${p.pedido}`) || {};
    const nf = String(metaPed.nf || nfDe(notasPed, p.filial, p.pedido) || '');
    curvaNeg.push({
      mes,
      filial: p.filial,
      pedido: p.pedido,
      nf,
      data: metaPed.data || ate,
      rca,
      vendedor: vNome,
      sup_cod: supCod,
      cliente: cli.nome,
      cnpj: cli.cnpj,
      itens: p.sks.size,
      fat_bruto: R2(p.b / 100),
      desconto_pct: frac(p.ds, p.b + p.ds),
      custo: R2(p.cu / 100),
      margem_rs: R2(mg / 100),
      margem_pct: frac(mg, p.b),
      margem_perdida: R2(p.mgPerd / 100)
    });
  }
  curvaNeg.sort((a, b) => a.margem_rs - b.margem_rs);

  const hist = [...histMap.values()].map((h) => ({
    mes: h.mes,
    filial: h.filial,
    tipo: h.tipo,
    faixa: h.faixa,
    itens: h.itens,
    fat_bruto: R2(h.b / 100),
    margem_rs: R2(h.mc / 100),
    margem_pct: frac(h.mc, h.b)
  }));
  return { curvaNeg: curvaNeg.slice(0, 600), hist };
}

function extrairFefo(cubo, H) {
  const D = cubo.fefo;
  if (!D || !Array.isArray(D.linhas)) return [];
  const DAY = 864e5;
  const LIM = [0.4, 0.6, 0.8, 1.0];
  const FX = ['Verde', 'Amarelo', 'Laranja', 'Vermelho', 'Vencido', 'Sem informação'];
  const HOJE = new Date(String(D.carga || '').slice(0, 10) + 'T00:00:00');
  const dim = H.dim;
  const fMap = new Map();
  (dim.fornecedor && dim.fornecedor.cod || []).forEach((c, i) => {
    fMap.set(nCnpj(c), String(dim.fornecedor.nome[i] || c));
  });

  const fxEm = (val, vida, diasAdd) => {
    if (!val || !(vida > 0)) return 'Sem informação';
    const dFut = Math.round((val.getTime() - (HOJE.getTime() + diasAdd * DAY)) / DAY);
    const pct = 1 - dFut / vida;
    return dFut < 0 ? 'Vencido' : pct < LIM[0] ? 'Verde' : pct < LIM[1] ? 'Amarelo' : pct < LIM[2] ? 'Laranja' : 'Vermelho';
  };

  const rows = D.linhas.map((r) => {
    const val = r.val ? new Date(r.val + 'T00:00:00') : null;
    const ok = val && val.getFullYear() >= 2020 && r.vida > 0;
    const dias = ok ? Math.round((val - HOJE) / DAY) : null;
    const pct = ok ? 1 - dias / r.vida : null;
    const fxIdx = !ok ? 5 : dias < 0 ? 4 : pct < LIM[0] ? 0 : pct < LIM[1] ? 1 : pct < LIM[2] ? 2 : 3;
    const cob = r.v90 > 0 ? r.sal / (r.v90 / 90) : null;
    const risco = dias != null && dias >= 0 && (cob == null || cob > dias);
    const acao = fxIdx === 4 ? 'Retirar/descartar (vencido)'
      : fxIdx === 3 && risco ? 'Liquidar urgente (cob > validade)'
      : fxIdx === 2 && risco ? 'Acelerar giro / campanha'
      : r.q ? 'Em quarentena WMS' : '';
    const vlr = (Number(r.sal) || 0) * (Number(r.cus) || 0);
    return {
      filial: H.paraSigla(r.fc),
      sku: String(r.cod || r.sku || ''),
      lote: String(r.lote || ''),
      produto: String(r.nome || ''),
      fornecedor: fMap.get(nCnpj(r.fo)) || String(r.fo || ''),
      depto: String(r.dep || ''),
      secao: String(r.sec || ''),
      marca: String(r.marca || ''),
      faixa: FX[fxIdx],
      validade: String(r.val || ''),
      dias_vencer: dias,
      pct_vida: pct != null ? R4(pct) : null,
      saldo: R2(Number(r.sal) || 0),
      valor: R2(vlr),
      venda_90d: R2(Number(r.v90) || 0),
      cobertura_dias: cob != null ? R2(cob) : null,
      risco: risco ? 1 : 0,
      quarentena: r.q ? 1 : 0,
      acao_sugerida: acao,
      prox_faixa_30: fxEm(val, r.vida, 30),
      prox_faixa_60: fxEm(val, r.vida, 60),
      prox_faixa_90: fxEm(val, r.vida, 90),
      carga: String(D.carga || '').slice(0, 25),
      _crit: fxIdx >= 2 || risco || r.q ? 1 : 0
    };
  });
  const crit = rows.filter((x) => x._crit);
  const norm = rows.filter((x) => !x._crit).sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, 1200);
  return crit.concat(norm);
}

function extrairEstWinthor(cubo, H) {
  const W = cubo.estWin;
  if (!W || !Array.isArray(W.e)) return [];
  const P = W.p || {}, F = W.f || {}, iniF = W.ini || {};
  const acmIni = String(W.acmIni || '2026-07-01');
  const cargaDT = new Date(String(W.carga || '').slice(0, 16) + ':00');
  const depN = new Map(), secN = new Map();
  if (cubo.deptos) {
    (cubo.deptos.deptos || []).forEach((x) => depN.set(String(x[0]), x[1]));
    (cubo.deptos.secoes || []).forEach((x) => secN.set(String(x[0]), x[1]));
  }
  const rows = [];
  const porFil = new Map();

  for (const a of W.e) {
    const fc = String(a[0]), sku = String(a[1]);
    const fil = H.paraSigla(fc);
    const est = +a[2] || 0, res = +a[3] || 0, blq = +a[4] || 0, pen = +a[5] || 0, cus = +a[7] || 0;
    const dtS = String(a[9] || '');
    const mF = Array.isArray(a[10]) ? a[10] : [], mQ = Array.isArray(a[11]) ? a[11] : [];
    const p = P[sku] || ['', '', 0, 0, '', ''], fo = F[p[1]] || null;
    const ini = String(iniF[fc] || '');
    const dIni = ini > acmIni ? ini : acmIni;
    const diasAcm = Math.max(1, (cargaDT - new Date(dIni + 'T00:00:00')) / 864e5);
    const fatAcm = mF.reduce((s, x) => s + (+x || 0), 0);
    const fatDia = fatAcm / diasAcm;
    const disp = Math.max(est - Math.max(res, 0) - Math.max(blq, 0), 0);
    const valor = est * cus;
    const diasEst = fatDia > 0 ? valor / fatDia : (est > 0 ? 9999 : 0);
    const diasSem = dtS ? Math.round((cargaDT - new Date(dtS + 'T00:00:00')) / 864e5) : 999;
    const parado90 = est > 0 && diasSem >= 90 ? 1 : 0;
    const venda3m = mQ.slice(-3).some((q) => (+q || 0) > 0);
    const ruptura = disp <= 0 && (venda3m || pen > 0) ? 1 : 0;
    const r = {
      filial: fil,
      sku,
      produto: String(p[0] || ('Produto ' + sku)),
      fornecedor: fo ? String(fo[0]) : '',
      depto: depN.get(String(p[4] || '')) || String(p[4] || ''),
      secao: secN.get(String(p[5] || '')) || String(p[5] || ''),
      dias_estoque: R2(Math.min(9999, diasEst)),
      valor: R2(valor),
      caixas: (+p[2] || 0) > 0 ? R2(est / +p[2]) : 0,
      peso_kg: R2(est * (+p[3] || 0)),
      disponivel: R2(disp),
      estoque: R2(est),
      reservado: R2(res),
      bloqueado: R2(blq),
      parado_90d: parado90,
      ruptura,
      curva_abc: 'D',
      carga: String(W.carga || '').slice(0, 25),
      _fatAcm: fatAcm
    };
    rows.push(r);
    if (!porFil.has(fil)) porFil.set(fil, []);
    porFil.get(fil).push(r);
  }
  for (const lst of porFil.values()) {
    lst.sort((a, b) => b._fatAcm - a._fatAcm);
    const tot = lst.reduce((s, x) => s + x._fatAcm, 0) || 1;
    let ac = 0;
    for (const x of lst) {
      ac += x._fatAcm;
      const sh = ac / tot;
      x.curva_abc = sh <= 0.80 ? 'A' : sh <= 0.95 ? 'B' : sh <= 0.99 ? 'C' : 'D';
    }
  }
  const crit = rows
    .filter((x) => x.ruptura || x.parado_90d || x.curva_abc === 'A')
    .sort((a, b) => (b.ruptura - a.ruptura) || (b.parado_90d - a.parado_90d) || ((b.valor || 0) - (a.valor || 0)))
    .slice(0, 4500);
  const setK = new Set(crit.map((x) => `${x.filial}|${x.sku}`));
  const top = rows.filter((x) => !setK.has(`${x.filial}|${x.sku}`)).sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, Math.max(0, 5500 - crit.length));
  return crit.concat(top);
}

function extrairCadastroClientes(cubo, H, mes, ate) {
  const C = cubo.cadCli;
  if (!C || !Array.isArray(C.cli) || !Array.isArray(C.ev)) return [];
  const agg = new Map();
  const add = (fil, sup, rca, f) => {
    const k = `${fil}|${sup}|${rca}`;
    let o = agg.get(k);
    if (!o) {
      o = { mes, filial: fil, sup_cod: sup, rca, cadastrados: 0, cadastrados_dia: 0, ja_compraram: 0, pct_primeira_compra: 0, bloqueados: 0, excluidos: 0, saldo: 0 };
      agg.set(k, o);
    }
    f(o);
  };
  for (const e of C.ev) {
    const d = C.dias[e[0]];
    if (!d || d.slice(0, 7) !== mes || d > ate) continue;
    const c = C.cli[e[2]] || [];
    const fil = H.paraSigla(c[5]) || 'BRASIL';
    const sup = String(c[6] || '');
    const rca = String(c[7] || '');
    const prim = c[4];
    const apply = (o) => {
      if (e[1] === 0) {
        o.cadastrados++;
        if (d === ate) o.cadastrados_dia++;
        if (prim) o.ja_compraram++;
      } else if (e[1] === 1) {
        o.bloqueados++;
      } else if (e[1] === 2) {
        o.excluidos++;
      }
      o.saldo = o.cadastrados - o.bloqueados - o.excluidos;
      o.pct_primeira_compra = o.cadastrados > 0 ? R4(o.ja_compraram / o.cadastrados) : 0;
    };
    add('BRASIL', '', '', apply);
    if (/^[A-Z]{3}$/.test(fil)) {
      add(fil, '', '', apply);
      if (sup) add(fil, sup, '', apply);
      if (rca) add(fil, sup, rca, apply);
    }
  }
  return [...agg.values()];
}

function extrairRecorrenciaERfv(cubo, H, mes, ate, supNomes = new Map(), vendNomes = new Map(), cartPorCli = new Map()) {
  const REC_B = cubo.recencia;
  if (!REC_B || !REC_B.z) return null;
  const C = JSON.parse(zlib.inflateRawSync(Buffer.from(REC_B.z, 'base64')).toString('utf8'));
  const D = C.dic || {}, datas = C.datas || [];
  const ref = ate > C.posD0 ? C.posD0 : ate;
  const t0 = Date.parse(ref + 'T12:00:00Z');
  const d1Iso = mes + '-01';
  const tD1 = Date.parse(d1Iso + 'T12:00:00Z');
  const idade = (idx) => Math.round((t0 - Date.parse(datas[idx] + 'T12:00:00Z')) / 864e5);

  const clv = (cubo.clivenCart && cubo.clivenCart.rot && cubo.clivenCart.rot[mes]) || null;
  const rotFil = (clv && clv.fil) || {};
  const rotSup = (clv && clv.sup) || {};

  const fxMap = new Map(), rfvRes = new Map(), recPasta = new Map();
  const rfvClis = [], recClis = [];

  const incFx = (fil, sup, rca, fx, v3m) => {
    const k = `${fil}|${sup}|${rca}|${fx}`;
    const o = fxMap.get(k) || { mes, filial: fil, sup_cod: sup, rca, faixa: fx, clientes: 0, valor_3m: 0 };
    o.clientes++;
    o.valor_3m = R2(o.valor_3m + v3m);
    fxMap.set(k, o);
  };
  const incRfv = (fil, sup, rca, seg, v120) => {
    const k = `${fil}|${sup}|${rca}|${seg}`;
    const o = rfvRes.get(k) || { mes, filial: fil, sup_cod: sup, rca, segmento: seg, clientes: 0, valor_120d: 0 };
    o.clientes++;
    o.valor_120d = R2(o.valor_120d + v120);
    rfvRes.set(k, o);
  };
  const incDia1 = (fil, nivel, cod, sup, nome, obj, pos, fat, pAfat, vAfat) => {
    const k = `${fil}|${nivel}|${cod}|${sup}`;
    let o = recPasta.get(k);
    if (!o) {
      o = {
        mes, filial: fil, nivel, cod, sup_cod: sup, nome: nome || cod,
        objetivo: 0, meta: 0, positivados: 0, faturado: 0, pdvs_afat: 0, vlr_afat: 0, pdvs_vend: 0
      };
      recPasta.set(k, o);
    }
    o.objetivo += obj;
    o.meta = Math.round(o.objetivo * 0.8);
    o.positivados += pos;
    o.faturado = R2(o.faturado + fat);
    o.pdvs_afat += pAfat;
    o.vlr_afat = R2(o.vlr_afat + vAfat);
    o.pdvs_vend = o.positivados + o.pdvs_afat;
  };

  for (const l of C.linhas || []) {
    let w = -1;
    if (l[2] >= 0 && datas[l[2]] <= ref) w = 0;
    else if (l[6] >= 0 && datas[l[6]] <= ref) w = 1;
    if (w < 0) continue;
    const o = w ? 6 : 2;
    const fil = H.paraSigla(D.filial.cod[l[0]]);
    if (!/^[A-Z]{3}$/.test(fil)) continue;
    const cnpj = String(D.cliente.cod[l[1]] || '');
    const cNome = String(D.cliente.nome[l[1]] || cnpj);
    const cadCli = H.CAD[cnpj] || H.CAD[nCnpj(cnpj)] || null;
    const codCliRec = (cadCli && cadCli[4]) ? String(cadCli[4]) : cnpj;
    const suRec = String(D.supervisor.cod[l[o + 1]] || '');
    const veRec = String(D.vendedor.cod[l[o + 2]] || '');
    const rcasClv = rotFil[fil] && Array.isArray(rotFil[fil][cnpj]) && rotFil[fil][cnpj].length
      ? rotFil[fil][cnpj].map(String)
      : [veRec];
    const rcaPrim = rcasClv[0] || veRec;
    const supPrim = String(rotSup[rcaPrim] || suRec || '');

    const diasSem = idade(l[o]);
    const h = l[22] || [];
    let dc120 = 0, val120 = 0, val90 = 0, valMes = 0;
    let temD90_D31 = false, temD30_D1 = false, posMes = false;

    for (let j = 0; j < h.length; j += 3) {
      const dt = datas[h[j]];
      if (!dt || dt > ref) continue;
      const diffRef = Math.round((t0 - Date.parse(dt + 'T12:00:00Z')) / 864e5);
      const diffD1 = Math.round((tD1 - Date.parse(dt + 'T12:00:00Z')) / 864e5);
      const v = (Number(h[j + 1]) || 0) / 100;
      if (diffRef <= 120) {
        val120 += v;
        if (h[j + 2]) dc120++;
      }
      if (diffRef <= 90) val90 += v;
      if (dt.slice(0, 7) === mes) {
        valMes += v;
        if (h[j + 2]) posMes = true;
      }
      if (diffD1 >= 31 && diffD1 <= 90 && v > 0) temD90_D31 = true;
      if (diffD1 >= 1 && diffD1 <= 30 && v > 0) temD30_D1 = true;
    }

    const faixaRec = diasSem <= 30 ? '0-30d' : diasSem <= 60 ? '31-60d' : diasSem <= 90 ? '61-90d' : '>90d';
    incFx('BRASIL', '', '', faixaRec, val90);
    incFx(fil, '', '', faixaRec, val90);
    if (supPrim) incFx(fil, supPrim, '', faixaRec, val90);
    if (rcaPrim) incFx(fil, supPrim, rcaPrim, faixaRec, val90);

    const cRecCart = cartPorCli.get(`${fil}|${cnpj}`) || 0;
    if (diasSem >= 31 && diasSem <= 180) {
      recClis.push({
        mes, filial: fil, rca: rcaPrim, cliente: codCliRec,
        cnpj, nome: cNome, dias_sem_compra: diasSem, ultima_compra: datas[l[o]],
        fat_mes: R2(valMes), captado: R2(valMes + cRecCart), carteira: R2(cRecCart), faixa: faixaRec
      });
    }

    const rSc = diasSem <= 30 ? 4 : diasSem <= 60 ? 3 : diasSem <= 90 ? 2 : diasSem <= 120 ? 1 : 0;
    const fSc = dc120 >= 8 ? 4 : dc120 >= 4 ? 3 : dc120 >= 2 ? 2 : dc120 >= 1 ? 1 : 0;
    const vSc = val120 <= 0 ? 0 : val120 <= 30000 ? 1 : val120 <= 70000 ? 2 : val120 <= 100000 ? 3 : 4;
    const seg = rfvSegmento(rSc, fSc, vSc);

    incRfv('BRASIL', '', '', seg, val120);
    incRfv(fil, '', '', seg, val120);
    if (supPrim) incRfv(fil, supPrim, '', seg, val120);
    if (rcaPrim) incRfv(fil, supPrim, rcaPrim, seg, val120);

    rfvClis.push({
      mes, filial: fil, rca: rcaPrim, sup_cod: supPrim,
      cliente: codCliRec, cnpj, nome: cNome,
      segmento: seg, r_score: rSc, f_score: fSc, v_score: vSc,
      dias_sem_compra: diasSem, valor_120d: R2(val120), ultima_compra: datas[l[o]]
    });

    if (temD90_D31 && !temD30_D1) {
      const posFlag = posMes && valMes > 0 ? 1 : 0;
      const fVal = posFlag ? valMes : 0;
      const pAfat = !posFlag && cRecCart > 0 ? 1 : 0;
      const vAfat = cRecCart;
      const sNom = supNomes.get(supPrim) || (D.supervisor && D.supervisor.nome && D.supervisor.nome[l[o + 1]]) || supPrim;
      const vNom = vendNomes.get(rcaPrim) || (clv && clv.nomes && clv.nomes[rcaPrim]) || rcaPrim;
      incDia1(fil, 'filial', fil, '', fil, 1, posFlag, fVal, pAfat, vAfat);
      if (supPrim) incDia1(fil, 'supervisor', supPrim, '', sNom, 1, posFlag, fVal, pAfat, vAfat);
      if (rcaPrim) incDia1(fil, 'vendedor', rcaPrim, supPrim, vNom, 1, posFlag, fVal, pAfat, vAfat);
    }
  }

  const selecionaEquilibrado = (arr, teto = 7500, minPorRca = 15) => {
    const picked = new Set();
    const byRca = new Map();
    arr.forEach((x, idx) => {
      const k = `${x.filial}|${x.rca}`;
      let cnt = byRca.get(k) || 0;
      if (cnt < minPorRca) { picked.add(idx); byRca.set(k, cnt + 1); }
    });
    for (let idx = 0; idx < arr.length && picked.size < teto; idx++) picked.add(idx);
    return [...picked].slice(0, teto).map((idx) => arr[idx]);
  };
  recClis.sort((a, b) => a.dias_sem_compra - b.dias_sem_compra);
  const prioSeg = { 'Em risco, alto valor': 5, 'Campeões': 4, 'Fiéis': 3, 'Esfriando': 2, 'Potenciais fiéis': 1 };
  rfvClis.sort((a, b) => ((prioSeg[b.segmento] || 0) - (prioSeg[a.segmento] || 0)) || (b.valor_120d - a.valor_120d));

  const recPastaArr = [...recPasta.values()].map((x) => ({ ...x, hash: sha(x) }));
  return {
    faixas: [...fxMap.values()],
    recClientes: selecionaEquilibrado(recClis, 7500, 15),
    rfvResumo: [...rfvRes.values()],
    rfvClientes: selecionaEquilibrado(rfvClis, 7500, 15),
    recPasta: recPastaArr
  };
}

function extrairPmi(cubo, rfvData, H, mes) {
  // Se cubo.pmi vier pré-calculado usa direto; caso contrario deriva por filial/supervisor/vendedor sobre RFV+Recorrencia
  if (cubo.pmi && Array.isArray(cubo.pmi.linhas) && cubo.pmi.linhas.length) {
    return cubo.pmi.linhas.map((x) => ({
      mes,
      filial: H.paraSigla(x.filial || 'BRASIL'),
      nivel: String(x.nivel || 'filial'),
      cod: String(x.cod || ''),
      nome: String(x.nome || ''),
      ja_compra: R2(x.ja_compra || 0),
      pmi_historico: R2(x.pmi_historico || 0),
      pmi_mix: R2(x.pmi_mix || 0),
      reativar: R2(x.reativar || 0),
      recuperar: R2(x.recuperar || 0),
      aumentar_mix: R2(x.aumentar_mix || 0),
      desenvolver_share: R2(x.desenvolver_share || 0),
      abrir_novos: R2(x.abrir_novos || 0),
      potencial_total: R2(x.potencial_total || 0),
      clientes_ativos: Math.round(x.clientes_ativos || 0)
    }));
  }
  if (!rfvData) return [];
  const g = new Map();
  const add = (fil, nivel, cod, nome, f) => {
    const k = `${fil}|${nivel}|${cod}`;
    let o = g.get(k);
    if (!o) {
      o = { mes, filial: fil, nivel, cod, nome, ja_compra: 0, pmi_historico: 0, pmi_mix: 0, reativar: 0, recuperar: 0, aumentar_mix: 0, desenvolver_share: 0, abrir_novos: 0, potencial_total: 0, clientes_ativos: 0 };
      g.set(k, o);
    }
    f(o);
  };
  for (const c of rfvData.rfvClientes) {
    const medM = (c.valor_120d || 0) / 4;
    const apply = (o) => {
      o.clientes_ativos++;
      if (c.dias_sem_compra <= 30) {
        o.ja_compra += medM;
        o.aumentar_mix += medM * 0.15;
        o.desenvolver_share += medM * 0.10;
      } else if (c.dias_sem_compra <= 90) {
        o.recuperar += medM;
      } else {
        o.reativar += medM;
      }
      o.pmi_historico = R2(o.reativar + o.recuperar);
      o.pmi_mix = R2(o.aumentar_mix + o.desenvolver_share);
      o.potencial_total = R2(o.pmi_historico + o.pmi_mix + o.abrir_novos);
    };
    add('BRASIL', 'brasil', 'BRASIL', 'BRASIL', apply);
    add(c.filial, 'filial', c.filial, c.filial, apply);
    if (c.sup_cod) add(c.filial, 'supervisor', c.sup_cod, c.sup_cod, apply);
    if (c.rca) add(c.filial, 'vendedor', c.rca, c.rca, apply);
  }
  return [...g.values()].map((x) => ({ ...x, ja_compra: R2(x.ja_compra), reativar: R2(x.reativar), recuperar: R2(x.recuperar), aumentar_mix: R2(x.aumentar_mix), desenvolver_share: R2(x.desenvolver_share) }));
}

function detectarFiltros(motor, H, mes, ate, calcBr, eFil, eDia) {
  const dim = H.dim;
  const fiIdxPorSigla = new Map();
  ((dim.filial && dim.filial.cod) || []).forEach((_, i) => fiIdxPorSigla.set(H.siglaPorIdx(i), i));
  const veIdxPorCod = new Map();
  ((dim.vendedor && dim.vendedor.cod) || []).forEach((c, i) => {
    const s = String(c ?? '');
    if (!veIdxPorCod.has(s)) veIdxPorCod.set(s, i);
  });

  let filMode = 'idx';
  let probeSig = [...eFil.map.keys()].find((s) => ((eFil.map.get(s)?.bruto || 0) - (eFil.map.get(s)?.devolucao || 0)) > 0) || [...fiIdxPorSigla.keys()][0];
  if (probeSig) {
    const idx0 = fiIdxPorSigla.get(probeSig);
    const cod0 = H.codFilPorSigla(probeSig);
    const fTot = (calcBr && Number(calcBr.faturado)) || Infinity;
    const testa = (cand) => {
      try {
        const c = motor.calcular({ mes, ate, filiais: cand });
        const f = Number(c && c.faturado);
        return Number.isFinite(f) && f > 0 && f < fTot * 0.99;
      } catch { return false; }
    };
    if (testa([idx0])) filMode = 'idx';
    else if (testa([cod0])) filMode = 'cod';
    else if (testa([probeSig])) filMode = 'sigla';
  }
  const filtroFil = (sig) => {
    if (filMode === 'cod') return [H.codFilPorSigla(sig)];
    if (filMode === 'sigla') return [sig];
    const i = fiIdxPorSigla.get(sig);
    return i != null ? [i] : [H.codFilPorSigla(sig)];
  };

  let vendMode = filMode === 'cod' ? 'cod' : 'idx';
  const probeVe = [...veIdxPorCod.entries()].find(([c]) => /^\d+$/.test(c));
  if (probeVe) {
    const testaV = (cand) => {
      try {
        const r = motor.extrair({ mes, ate, vendedores: cand }, ['ve']);
        return r && Array.isArray(r.linhas) && r.linhas.length > 0 && r.linhas.length <= 5;
      } catch { return false; }
    };
    if (testaV([probeVe[1]])) vendMode = 'idx';
    else if (testaV([probeVe[0]])) vendMode = 'cod';
  }
  const filtroVend = (rca) => {
    if (vendMode === 'cod') return [String(rca)];
    const i = veIdxPorCod.get(String(rca));
    return i != null ? [i] : [String(rca)];
  };

  let diaMode = 'eDia';
  let capAteEsperada = 0;
  for (const [k, r] of eDia.map) {
    if (k.split(SEP)[1] === ate) capAteEsperada += r.captacao || 0;
  }
  const diaIdx = (dim.dia || []).indexOf(ate);
  const candsDia = [
    ['idx', diaIdx >= 0 ? [diaIdx] : null],
    ['iso', [ate]],
    ['num', [Number(ate.slice(8, 10))]]
  ];
  for (const [modo, cand] of candsDia) {
    if (!cand) continue;
    try {
      const r = motor.extrair({ mes, ate, dias: cand }, ['fi']);
      const linhas = (r && r.linhas) || [];
      if (linhas.length && linhas.length <= 15) {
        const soma = linhas.reduce((s, x) => s + (x.captacao || 0), 0);
        if (capAteEsperada > 0 ? Math.abs(soma - capAteEsperada) < Math.max(1000, capAteEsperada * 0.05) : soma < ((calcBr && calcBr.faturado * 50) || 1e9)) {
          diaMode = modo;
          break;
        }
      }
    } catch {}
  }
  const diaFilter = diaMode === 'idx' ? { mes, ate, dias: [diaIdx] }
    : diaMode === 'iso' ? { mes, ate, dias: [ate] }
    : diaMode === 'num' ? { mes, ate, dias: [Number(ate.slice(8, 10))] }
    : null;

  log(`FIL_MODE=${filMode} VEND_MODE=${vendMode} DIA_MODE=${diaMode}`);
  return { filtroFil, filtroVend, diaFilter, diaMode };
}

function extrairM3Map(motor, refs, campos, H) {
  const soma = new Map();
  const n = (refs.m3 || []).length;
  if (!n) return new Map();
  for (const rM of refs.m3) {
    try {
      const ex = indexarExtrair(motor.extrair(rM, campos), campos, H).map;
      for (const [k, r] of ex) {
        soma.set(k, (soma.get(k) || 0) + (r.positivacao || 0));
      }
    } catch {}
  }
  const med = new Map();
  for (const [k, tot] of soma) med.set(k, R2(tot / n));
  return med;
}

async function processarMes(mes, { cubo, motor, meta }, tiers, posicao, loteId) {
  const H = criarHelpersDim(cubo);
  const dim = H.dim;
  const refs = calcMesesRef(mes, cubo, meta.posicaoD0 || fimDoMes(mes));
  const ate = refs.ate;
  log(`=== Processando ${mes} (ate ${ate}) tiers=${[...tiers].join(',')} ===`);

  const calcBr = motor.calcular({ mes, ate });
  const pctMes = calcBr && calcBr.pctMesCorrido != null ? calcBr.pctMesCorrido : (calcBr && calcBr.diasUteisTotal > 0 ? calcBr.diasUteisDecorridos / calcBr.diasUteisTotal : 0);
  const duRest = calcBr && calcBr.diasUteisTotal != null && calcBr.diasUteisDecorridos != null ? Math.max(0, calcBr.diasUteisTotal - calcBr.diasUteisDecorridos) : 0;

  // Extracoes base Tier 1 (em memoria: ms)
  const eFil = indexarExtrair(motor.extrair({ mes, ate }, ['fi']), ['fi'], H);
  const eSup = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 'su']), ['fi', 'su'], H);
  const eVen = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 'su', 've']), ['fi', 'su', 've'], H);
  const eVnd = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 'su', 've', 'fo']), ['fi', 'su', 've', 'fo'], H);
  const eDia = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 'dia']), ['fi', 'dia'], H);

  const { filtroFil, filtroVend, diaFilter } = detectarFiltros(motor, H, mes, ate, calcBr, eFil, eDia);

  // Meta positivacao
  const safeMp = (campos, camp) => {
    try { return indexarMetaPos(motor.metaPosExtrair({ mes, ate }, campos, camp), campos, H); }
    catch { return new Map(); }
  };
  const mpFil = safeMp(['fi'], false);
  const mpcFil = safeMp(['fi'], true);
  const mpSup = safeMp(['fi', 'su'], false);
  const mpcSup = safeMp(['fi', 'su'], true);
  const mpVen = safeMp(['fi', 'su', 've'], false);
  const mpcVen = safeMp(['fi', 'su', 've'], true);
  const mpVnd = safeMp(['fi', 'su', 've', 'fo'], false);

  // Positivacao / captacao do dia
  const capDiaFil = new Map(), capDiaSup = new Map(), capDiaVen = new Map(), capDiaVnd = new Map();
  if (diaFilter) {
    for (const [k, r] of indexarExtrair(motor.extrair(diaFilter, ['fi']), ['fi'], H).map) capDiaFil.set(k, r);
    for (const [k, r] of indexarExtrair(motor.extrair(diaFilter, ['fi', 'su']), ['fi', 'su'], H).map) capDiaSup.set(k, r);
    for (const [k, r] of indexarExtrair(motor.extrair(diaFilter, ['fi', 'su', 've']), ['fi', 'su', 've'], H).map) capDiaVen.set(k, r);
    for (const [k, r] of indexarExtrair(motor.extrair(diaFilter, ['fi', 'su', 've', 'fo']), ['fi', 'su', 've', 'fo'], H).map) capDiaVnd.set(k, r);
  } else {
    for (const [k, r] of eDia.map) {
      const [fil, dt] = k.split(SEP);
      if (dt === ate) capDiaFil.set(fil, r);
    }
  }

  // Referencias M-1, 3M, A-1, Bench
  const safeExt = (refObj, campos) => {
    if (!refObj) return new Map();
    try { return indexarExtrair(motor.extrair(refObj, campos), campos, H).map; }
    catch { return new Map(); }
  };
  const m1Fil = safeExt(refs.m1, ['fi']);
  const m1Sup = safeExt(refs.m1, ['fi', 'su']);
  const m1Ven = safeExt(refs.m1, ['fi', 'su', 've']);
  const m1Vnd = safeExt(refs.m1, ['fi', 'su', 've', 'fo']);
  const a1Fil = safeExt(refs.a1, ['fi']);
  const a1Sup = safeExt(refs.a1, ['fi', 'su']);
  const a1Ven = safeExt(refs.a1, ['fi', 'su', 've']);
  const a1Vnd = safeExt(refs.a1, ['fi', 'su', 've', 'fo']);
  const m3Fil = extrairM3Map(motor, refs, ['fi'], H);
  const m3Sup = extrairM3Map(motor, refs, ['fi', 'su'], H);
  const m3Ven = extrairM3Map(motor, refs, ['fi', 'su', 've'], H);
  const m3Vnd = extrairM3Map(motor, refs, ['fi', 'su', 've', 'fo'], H);
  const bFil = safeExt(refs.bench, ['fi']);
  const bSup = safeExt(refs.bench, ['fi', 'su']);
  const bVen = safeExt(refs.bench, ['fi', 'su', 've']);
  const bVnd = safeExt(refs.bench, ['fi', 'su', 've', 'fo']);

  // TMF por filial (via motor.calcular quando disponivel)
  const tmfPorFil = new Map();
  for (const sig of eFil.map.keys()) {
    try {
      const cf = motor.calcular({ mes, ate, filiais: filtroFil(sig) });
      const t = cf && (cf.tmf ?? cf.tmfDias);
      if (t != null && Number.isFinite(Number(t))) tmfPorFil.set(sig, Number(t));
    } catch {}
  }

  // 1) Filiais
  const filRows = [];
  for (const [sig, r] of eFil.map) {
    if (!/^[A-Z]{3}$/.test(sig)) continue;
    const d1 = capDiaFil.get(sig) || {}, rm1 = m1Fil.get(sig) || {}, ra1 = a1Fil.get(sig) || {}, rb = bFil.get(sig) || {};
    const dados = montaDadosComum(r, {
      posM1: rm1.positivacao ?? null, capM1: rm1.captacao != null ? R2(rm1.captacao / 100) : null,
      posA1: ra1.positivacao ?? null, pos3M: m3Fil.get(sig) ?? null, posB: rb.positivacao ?? null
    }, {
      pctMesCorrido: pctMes, diasUteisRestantes: duRest, capDia: d1.captacao || 0, posDia: d1.positivacao || 0,
      mp: mpFil.get(sig), mpc: mpcFil.get(sig), tmf: tmfPorFil.get(sig)
    });
    filRows.push({ mes, filial: sig, dados, hash: sha(dados) });
  }
  const { hashes: hf } = await api('GET', `?mes=${mes}&filial=1`);
  const mudouF = filRows.filter((x) => hf[x.filial] !== x.hash);
  if (mudouF.length) await api('POST', '', { filiais: mudouF });

  // 2) Supervisores (uniao de mes + M-1/3M/A-1/Bench para preservar historico como no Excel)
  const supNomes = new Map();
  (dim.supervisor && dim.supervisor.cod || []).forEach((c, i) => supNomes.set(String(c), String(dim.supervisor.nome[i] || c)));
  const supRows = [];
  for (const k of todasChaves(eSup.map, m1Sup, a1Sup, m3Sup, bSup)) {
    const r = eSup.map.get(k) || {};
    const [filial, cod_sup] = k.split(SEP);
    if (!/^[A-Z]{3}$/.test(filial || '') || !String(cod_sup || '').trim()) continue;
    const d1 = capDiaSup.get(k) || {}, rm1 = m1Sup.get(k) || {}, ra1 = a1Sup.get(k) || {}, rb = bSup.get(k) || {};
    const dados = montaDadosComum(r, {
      posM1: rm1.positivacao ?? null, capM1: rm1.captacao != null ? R2(rm1.captacao / 100) : null,
      posA1: ra1.positivacao ?? null, pos3M: m3Sup.get(k) ?? null, posB: rb.positivacao ?? null
    }, {
      pctMesCorrido: pctMes, diasUteisRestantes: duRest, capDia: d1.captacao || 0, posDia: d1.positivacao || 0,
      mp: mpSup.get(k), mpc: mpcSup.get(k), usaClube: true
    });
    supRows.push({ mes, filial, cod_sup, supervisor: supNomes.get(cod_sup) || cod_sup, dados, hash: sha(dados) });
  }
  const { hashes: hs } = await api('GET', `?mes=${mes}&supervisor=1`);
  const mudouS = supRows.filter((x) => hs[`${x.filial}|${x.cod_sup}`] !== x.hash);
  await enviaEmLotes('supervisores', mudouS, 200);
  if (supRows.length) await api('POST', '', { vigentes_sup: { mes, chaves: supRows.map((x) => `${x.filial}|${x.cod_sup}`) } });

  // 3) Vendedores
  const vendNomes = new Map();
  (dim.vendedor && dim.vendedor.cod || []).forEach((c, i) => vendNomes.set(String(c), String(dim.vendedor.nome[i] || c)));
  const vendRows = [];
  for (const k of todasChaves(eVen.map, m1Ven, a1Ven, m3Ven, bVen)) {
    const r = eVen.map.get(k) || {};
    const [filial, cod_sup, rca] = k.split(SEP);
    if (!/^[A-Z]{3}$/.test(filial || '') || !String(rca || '').trim()) continue;
    const d1 = capDiaVen.get(k) || {}, rm1 = m1Ven.get(k) || {}, ra1 = a1Ven.get(k) || {}, rb = bVen.get(k) || {};
    const dados = montaDadosComum(r, {
      posM1: rm1.positivacao ?? null, capM1: rm1.captacao != null ? R2(rm1.captacao / 100) : null,
      posA1: ra1.positivacao ?? null, pos3M: m3Ven.get(k) ?? null, posB: rb.positivacao ?? null
    }, {
      pctMesCorrido: pctMes, diasUteisRestantes: duRest, capDia: d1.captacao || 0, posDia: d1.positivacao || 0,
      mp: mpVen.get(k), mpc: mpcVen.get(k), usaClube: true
    });
    vendRows.push({ mes, filial, rca, cod_sup, supervisor: supNomes.get(cod_sup) || cod_sup, vendedor: vendNomes.get(rca) || rca, dados, hash: sha(dados) });
  }
  const { hashes: hv } = await api('GET', `?mes=${mes}&vendedor=1`);
  const mudouV = vendRows.filter((x) => hv[`${x.filial}|${x.rca}|${x.cod_sup}`] !== x.hash);
  await enviaEmLotes('vendedores', mudouV, 200);
  if (vendRows.length) await api('POST', '', { vigentes_vend: { mes, chaves: vendRows.map((x) => `${x.filial}|${x.rca}|${x.cod_sup}`) } });

  // 4) Vendas (Filial x Sup x Vend x Fornecedor)
  const fornMetaByChave = new Map();
  (dim.fornecedor && dim.fornecedor.cod || []).forEach((c, i) => {
    const info = H.fornInfo(i);
    fornMetaByChave.set(info.chave, info);
  });
  const vndRows = [];
  for (const k of todasChaves(eVnd.map, m1Vnd, a1Vnd, m3Vnd, bVnd)) {
    const r = eVnd.map.get(k) || {};
    const [filial, cod_sup, rca, fornecedor] = k.split(SEP);
    if (!/^[A-Z]{3}$/.test(filial || '') || !String(rca || '').trim() || !String(fornecedor || '').trim()) continue;
    const fInfo = fornMetaByChave.get(fornecedor) || { nome: fornecedor, cnpjRaw: '', codW: '' };
    const d1 = capDiaVnd.get(k) || {}, rm1 = m1Vnd.get(k) || {}, ra1 = a1Vnd.get(k) || {}, rb = bVnd.get(k) || {};
    const dados = montaDadosComum(r, {
      posM1: rm1.positivacao ?? null, capM1: rm1.captacao != null ? R2(rm1.captacao / 100) : null,
      posA1: ra1.positivacao ?? null, pos3M: m3Vnd.get(k) ?? null, posB: rb.positivacao ?? null
    }, {
      pctMesCorrido: pctMes, diasUteisRestantes: duRest, capDia: d1.captacao || 0, posDia: d1.positivacao || 0,
      mp: mpVnd.get(k), usaClubeInd: true,
      extras: {
        'CNPJ fornecedor': /^\d+$/.test(fInfo.cnpjRaw) ? Number(fInfo.cnpjRaw) : fInfo.cnpjRaw,
        'Cód. fornecedor': /^\d+$/.test(fInfo.codW) ? Number(fInfo.codW) : fInfo.codW,
        'Fornecedor': fInfo.nome
      }
    });
    vndRows.push({
      mes, filial, rca, fornecedor, cod_sup,
      supervisor: supNomes.get(cod_sup) || cod_sup,
      vendedor: vendNomes.get(rca) || rca,
      dados, hash: sha(dados)
    });
  }
  const { hashes: hvnd } = await api('GET', `?mes=${mes}`);
  const mudouVnd = vndRows.filter((x) => hvnd[`${x.filial}|${x.rca}|${x.fornecedor}|${x.cod_sup}`] !== x.hash);
  const envVnd = await enviaEmLotes('linhas', mudouVnd, 200);
  if (vndRows.length) await api('POST', '', { vigentes: { mes, chaves: vndRows.map((x) => `${x.filial}|${x.rca}|${x.fornecedor}|${x.cod_sup}`) } });
  log(`${mes} nucleo: fil=${filRows.length}(+${mudouF.length}) sup=${supRows.length}(+${mudouS.length}) vend=${vendRows.length}(+${mudouV.length}) forn=${vndRows.length}(+${envVnd})`);

  // 5) Filial x Dia
  const diaRows = [];
  for (const [k, r] of eDia.map) {
    const [filial, data] = k.split(SEP);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    const dados = montaDadosComum(r, {}, { pctMesCorrido: pctMes });
    diaRows.push({ mes, filial, data, dados, hash: sha(dados) });
  }
  const { hashes: hd } = await api('GET', `?mes=${mes}&dia=1`);
  await enviaEmLotes('dias', diaRows.filter((x) => hd[`${x.filial}|${x.data}`] !== x.hash), 200);

  // 6) Clientes (Mes x Filial x RCA x Cliente — inclui quem comprou em M-1 p/ Curva Negativa sem explodir linhas)
  const eCli = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 've', 'cl']), ['fi', 've', 'cl'], H);
  const m1Cli = safeExt(refs.m1, ['fi', 've', 'cl']);
  const a1Cli = safeExt(refs.a1, ['fi', 've', 'cl']);
  const m3Cli = extrairM3Map(motor, refs, ['fi', 've', 'cl'], H);
  const cliInfoMap = new Map();
  (dim.cliente && dim.cliente.cod || []).forEach((c, i) => cliInfoMap.set(String(c), H.cliInfo(i)));
  const cliRows = [];
  const cartPorCli = new Map();
  for (const k of todasChaves(eCli.map, m1Cli)) {
    const r = eCli.map.get(k) || {};
    const [filial, rca, cnpj] = k.split(SEP);
    const cInfo = cliInfoMap.get(cnpj) || { cnpj, cliente: cnpj, nome: cnpj };
    if (!/^[A-Z]{3}$/.test(filial || '') || !String(rca || '').trim() || !String(cInfo.cliente || '').trim()) continue;
    const rm1 = m1Cli.get(k) || {}, ra1 = a1Cli.get(k) || {};
    const cVal = r.carteira != null ? R2(r.carteira / 100) : 0;
    if (cVal > 0) cartPorCli.set(`${filial}|${cnpj}`, R2((cartPorCli.get(`${filial}|${cnpj}`) || 0) + cVal));
    const dados = {
      'Faturado líquido (R$)': R2(((r.bruto || 0) - (r.devolucao || 0)) / 100) || 0,
      'Devolução (R$)': R2((r.devolucao || 0) / 100) || 0,
      'Positivação A-1': ra1.positivacao ?? 0,
      'Positivação 3M (média)': m3Cli.get(k) ?? null,
      'Positivação M-1': rm1.positivacao ?? 0,
      'Positivação (filial + CNPJ)': r.positivacao || 0,
      'Positivação + Carteira': r.positivacaoCarteira ?? (r.positivacao || 0),
      'Carteira pendente (R$)': cVal
    };
    cliRows.push({ mes, filial, rca, cliente: cInfo.cliente, cnpj: cInfo.cnpj, nome: cInfo.nome, dados, hash: sha(dados) });
  }
  const { hashes: hc } = await api('GET', `?mes=${mes}&cliente=1`);
  const mudouCli = cliRows.filter((x) => hc[`${x.filial}|${x.rca}|${x.cliente}`] !== x.hash);
  await enviaEmLotes('clientes', mudouCli, 200);

  // 7) Cliente x Fornecedor
  const eCliF = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 've', 'cl', 'fo']), ['fi', 've', 'cl', 'fo'], H);
  const m1CliF = safeExt(refs.m1, ['fi', 've', 'cl', 'fo']);
  const a1CliF = safeExt(refs.a1, ['fi', 've', 'cl', 'fo']);
  const m3CliF = extrairM3Map(motor, refs, ['fi', 've', 'cl', 'fo'], H);
  const cfRows = [];
  for (const k of todasChaves(eCliF.map, m1CliF)) {
    const r = eCliF.map.get(k) || {};
    const [filial, rca, cnpj, fornChave] = k.split(SEP);
    const fat = R2(((r.bruto || 0) - (r.devolucao || 0)) / 100) || 0;
    const cart = r.carteira != null ? R2(r.carteira / 100) : 0;
    const rm1 = m1CliF.get(k) || {}, ra1 = a1CliF.get(k) || {}, p3m = m3CliF.get(k) ?? null;
    if (fat === 0 && cart === 0 && !(r.positivacao > 0) && !(rm1.positivacao > 0)) continue;
    const cInfo = cliInfoMap.get(cnpj) || { cnpj, cliente: cnpj };
    const fInfo = fornMetaByChave.get(fornChave) || { codW: fornChave, nome: fornChave };
    if (!/^[A-Z]{3}$/.test(filial || '') || !String(rca || '').trim() || !String(cInfo.cliente || '').trim() || !String(fInfo.codW || '').trim()) continue;
    const dados = {
      'Faturado líquido (R$)': fat,
      'Devolução (R$)': R2((r.devolucao || 0) / 100) || 0,
      'Positivação A-1': ra1.positivacao ?? null,
      'Positivação 3M (média)': p3m,
      'Positivação M-1': rm1.positivacao ?? 0,
      'Positivação (filial + CNPJ)': r.positivacao || 0,
      'Positivação + Carteira': r.positivacaoCarteira ?? (r.positivacao || 0),
      'Carteira pendente (R$)': cart
    };
    cfRows.push({
      mes, filial, rca, cliente: cInfo.cliente,
      forn_cod: fInfo.codW, fornecedor: fInfo.nome,
      dados, hash: sha(dados)
    });
  }
  const { hashes: hcf } = await api('GET', `?mes=${mes}&clienteforn=1`);
  await enviaEmLotes('clientes_forn', cfRows.filter((x) => hcf[`${x.filial}|${x.rca}|${x.cliente}|${x.forn_cod}`] !== x.hash), 200);

  // 8) Pedidos
  const ePed = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 've', 'cl', 'dia', 'pe']), ['fi', 've', 'cl', 'dia', 'pe'], H);
  const notasPed = cubo.notasPed || {};
  const pedMeta = new Map();
  const pedRowsMap = new Map();
  for (const [k, r] of ePed.map) {
    const [filial, rca, cnpj, data, pedido] = k.split(SEP);
    if (!pedido || pedido === '0') continue;
    const cInfo = cliInfoMap.get(cnpj) || { cnpj, cliente: cnpj, nome: cnpj };
    const nf = nfDe(notasPed, filial, pedido);
    const dataIso = /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
    pedMeta.set(`${filial}|${pedido}`, { nf, data: dataIso || ate });
    const kP = `${filial}|${pedido}|${nf}`;
    const prev = pedRowsMap.get(kP);
    if (!prev) {
      pedRowsMap.set(kP, { mes, filial, pedido, nf, rca, cliente: cInfo.cliente, cnpj: cInfo.cnpj, nome: cInfo.nome, data: dataIso, r: { ...r } });
    } else {
      prev.r.bruto += r.bruto || 0;
      prev.r.devolucao += r.devolucao || 0;
      prev.r.pedidos += r.pedidos || 0;
      prev.r.carteira = (prev.r.carteira || 0) + (r.carteira || 0);
      prev.r.carteiraPedidos = (prev.r.carteiraPedidos || 0) + (r.carteiraPedidos || 0);
      prev.r.corteComercial += r.corteComercial || 0;
      prev.r.corteLogistico += r.corteLogistico || 0;
      if (!prev.data && dataIso) prev.data = dataIso;
    }
  }
  const pedRows = [...pedRowsMap.values()].map((p) => {
    const cC = R2((p.r.corteComercial || 0) / 100) || 0;
    const cL = R2((p.r.corteLogistico || 0) / 100) || 0;
    const dados = {
      'Faturado líquido (R$)': R2(((p.r.bruto || 0) - (p.r.devolucao || 0)) / 100) || 0,
      'Devolução (R$)': R2((p.r.devolucao || 0) / 100) || 0,
      'Pedidos faturados': p.r.pedidos || 0,
      'Carteira pendente (R$)': p.r.carteira != null ? R2(p.r.carteira / 100) : 0,
      'Pedidos na carteira': p.r.carteiraPedidos || 0,
      'Corte comercial (R$)': cC,
      'Corte logístico (R$)': cL,
      'Cortes total (R$)': R2(cC + cL),
      'Corte comercial (un)': p.r.corteUnComercial || 0,
      'Corte logístico (un)': p.r.corteUnLogistico || 0,
      'Cortes total (un)': (p.r.corteUnComercial || 0) + (p.r.corteUnLogistico || 0)
    };
    return { mes: p.mes, filial: p.filial, pedido: p.pedido, nf: p.nf, rca: p.rca, cliente: p.cliente, cnpj: p.cnpj, nome: p.nome, data: p.data, dados, hash: sha(dados) };
  });
  const { hashes: hp } = await api('GET', `?mes=${mes}&pedido=1`);
  await enviaEmLotes('pedidos', pedRows.filter((x) => hp[`${x.filial}|${x.pedido}|${x.nf}`] !== x.hash), 200);

  // 9) Dimensoes agregadas (canal_macro, rede, cidade, depto, secao, nf_devolucao)
  const dimRows = [];
  const eCan = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 'ca']), ['fi', 'ca'], H);
  const canNomes = new Map();
  (dim.canal && dim.canal.cod || []).forEach((c, i) => canNomes.set(String(c), String(dim.canal.nome[i] || c)));
  for (const [k, r] of eCan.map) {
    const [filial, ca] = k.split(SEP);
    const dados = montaDadosComum(r, {}, { pctMesCorrido: pctMes });
    dimRows.push({ mes, dim: 'canal_macro', filial, chave: ca, nome: canNomes.get(ca) || ca, dados, hash: sha(dados) });
  }
  const eSk = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 'sk']), ['fi', 'sk'], H);
  const prodW = (cubo.estWin && cubo.estWin.p) || {};
  const depN = new Map(), secN = new Map();
  if (cubo.deptos) {
    (cubo.deptos.deptos || []).forEach((x) => depN.set(String(x[0]), x[1]));
    (cubo.deptos.secoes || []).forEach((x) => secN.set(String(x[0]), x[1]));
  }
  const grpDim = new Map();
  const addGrp = (dm, fil, ch, nome, r) => {
    const k = `${dm}|${fil}|${ch}`;
    const o = grpDim.get(k) || { dim: dm, filial: fil, chave: ch, nome, bruto: 0, dev: 0, mc: 0, meta: 0, cart: 0 };
    o.bruto += r.bruto || 0;
    o.dev += r.devolucao || 0;
    o.mc += (r.bruto || 0) - (r.devolucao || 0) - (r.cmv || 0) - (r.bonificacao || 0);
    o.cart += r.carteira || 0;
    grpDim.set(k, o);
  };
  for (const [k, r] of eSk.map) {
    const [filial, sku] = k.split(SEP);
    const p = prodW[sku];
    if (!p) continue;
    if (p[4]) addGrp('depto', filial, String(p[4]), depN.get(String(p[4])) || String(p[4]), r);
    if (p[5]) addGrp('secao', filial, String(p[5]), secN.get(String(p[5])) || String(p[5]), r);
  }
  const eFC = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 'cl']), ['fi', 'cl'], H);
  for (const [k, r] of eFC.map) {
    const [filial, cnpj] = k.split(SEP);
    const ci = cliInfoMap.get(cnpj) || H.cliInfo(-1);
    const cad = (cubo.clivenCad && cubo.clivenCad.c && cubo.clivenCad.c[cnpj]) || null;
    if (cad && cad[2]) addGrp('cidade', filial, `${cad[1] || ''}:${cad[2]}`, `${cad[2]}/${cad[1] || ''}`, r);
    else if (ci.mun) addGrp('cidade', filial, ci.mun, ci.mun, r);
  }
  for (const o of grpDim.values()) {
    const fat = R2((o.bruto - o.dev) / 100) || 0;
    const dados = { 'Faturado líquido (R$)': fat, 'Devolução (R$)': R2(o.dev / 100) || 0, 'Margem de contribuição (R$)': R2(o.mc / 100), 'Carteira pendente (R$)': R2(o.cart / 100) };
    dimRows.push({ mes, dim: o.dim, filial: o.filial, chave: o.chave, nome: o.nome, dados, hash: sha(dados) });
  }
  for (const p of pedRows) {
    if ((p.dados['Devolução (R$)'] || 0) <= 0) continue;
    const dados = { 'Devolução (R$)': p.dados['Devolução (R$)'], 'NF': p.nf, 'Cliente': p.nome, 'RCA': p.rca, 'Data': p.data };
    dimRows.push({ mes, dim: 'nf_devolucao', filial: p.filial, chave: `${p.pedido}|${p.nf}`, nome: p.nome || p.pedido, dados, hash: sha(dados) });
  }
  const { hashes: hdim } = await api('GET', `?mes=${mes}&dim=1`);
  await enviaEmLotes('dim_agregado', dimRows.filter((x) => hdim[`${x.dim}|${x.filial}|${x.chave}`] !== x.hash), 300);

  // 10) Carteira Total (somente no mes corrente)
  if (mes === horaBRT().diaIso.slice(0, 7)) {
    try {
      const det = motor.carteiraDetalhe({ mes, ate }, { teto: 500000 });
      const porPed = new Map();
      const EH_MP = (fn, sk, pr) => {
        if (/PALLET|PALETE/i.test(pr || '')) return false;
        if (String(sk) === '8171') return false;
        return /TRIUNFANTE BRASIL|MARCA PROPRIA/i.test(fn || '') || String(sk) === '9169';
      };
      for (const it of (det && det.linhas) || []) {
        const filial = H.paraSigla(it.filial);
        const k = `${filial}|${it.pedido}`;
        let p = porPed.get(k);
        if (!p) {
          p = {
            filial, pedido: String(it.pedido), rca: String(it.vendedorCod || ''),
            vendedor: String(it.vendedor || ''), sup_cod: String(it.supervisorCod || ''),
            entrada: String(it.data || '').slice(0, 10), origem: String(it.origem || ''),
            status: String(it.faixa || ''), situacao: String(it.situacao || ''),
            motivo: String(it.motivoBloq || ''), cliente: String(it.cliente || ''),
            cnpj: nCnpj(it.clienteCnpj).slice(0, 14), status_cliente: String(it.statusCli || ''),
            positivado: String(it.positivado || ''), valor: 0, itens: 0, qped: 0, qfat: 0,
            forns: new Set(), skus: new Set(), mp: 0
          };
          porPed.set(k, p);
        }
        const val = Number(it.valor) || 0;
        p.valor += val;
        p.itens++;
        p.qped += Number(it.qtPedida) || 0;
        p.qfat += Number(it.qtAFaturar) || 0;
        if (it.fornecedor) p.forns.add(String(it.fornecedor));
        if (it.produtoCod) p.skus.add(String(it.produtoCod));
        if (EH_MP(it.fornecedor, it.produtoCod, it.produto)) p.mp += val;
      }
      const cartRows = [...porPed.values()].map((p) => {
        const obj = {
          filial: p.filial, pedido: p.pedido, rca: p.rca, vendedor: p.vendedor, sup_cod: p.sup_cod,
          entrada: p.entrada, origem: p.origem, status: p.status, situacao: p.situacao, motivo: p.motivo,
          cliente: p.cliente, cnpj: p.cnpj, status_cliente: p.status_cliente, positivado: p.positivado,
          valor: R2(p.valor), itens: p.itens, qped: R2(p.qped), qfat: R2(p.qfat),
          fornecedores: [...p.forns].slice(0, 12), mp: R2(p.mp), nforn: p.forns.size, skus: p.skus.size
        };
        obj.hash = sha(obj);
        return obj;
      });
      const { hashes: hct } = await api('GET', '?carteira=1');
      const mudouCt = cartRows.filter((x) => hct[`${x.filial}|${x.pedido}`] !== x.hash);
      await enviaEmLotes('carteira', mudouCt, 200);
      const chavesAtuais = new Set(cartRows.map((x) => `${x.filial}|${x.pedido}`));
      const remover = Object.keys(hct || {}).filter((k) => !chavesAtuais.has(k));
      if (remover.length && cartRows.length > 50) {
        for (let i = 0; i < remover.length; i += 400) await api('POST', '', { carteira_remover: remover.slice(i, i + 400) });
      }
      log(`${mes} carteira: ${cartRows.length} pedidos (+${mudouCt.length}, -${remover.length})`);
    } catch (e) { log(`AVISO carteira ${mes}:`, e.message); }
  }

  // 11) Devolucao por motivo (global + filial + vendedor)
  try {
    const devRows = [];
    for (const m of motor.ranking({ mes, ate }, 'motivo') || []) {
      if (!(m.devolucao > 0)) continue;
      devRows.push({ motivo: m.nome, filial: '', valor: R2(m.devolucao), notas: m.pedidosDevolvidos || 0, clientes: m.clientesDevolveram || 0 });
    }
    for (const sig of eFil.map.keys()) {
      for (const m of motor.ranking({ mes, ate, filiais: filtroFil(sig) }, 'motivo') || []) {
        if (!(m.devolucao > 0)) continue;
        devRows.push({ motivo: m.nome, filial: sig, valor: R2(m.devolucao), notas: m.pedidosDevolvidos || 0, clientes: m.clientesDevolveram || 0 });
      }
    }
    for (let i = 0; i < devRows.length; i += 400) {
      await api('POST', '', { devmotivo_mes: mes, devmotivo_primeiro: i === 0, devmotivo: devRows.slice(i, i + 400) });
    }
    const devVendRows = [];
    for (const v of vendRows) {
      if (!((v.dados['Devolução (R$)'] || 0) > 0) || !/^\d+$/.test(v.rca)) continue;
      for (const m of motor.ranking({ mes, ate, filiais: filtroFil(v.filial), vendedores: filtroVend(v.rca) }, 'motivo') || []) {
        if (!(m.devolucao > 0)) continue;
        devVendRows.push({ mes, motivo: m.nome, filial: v.filial, rca: v.rca, sup_cod: v.cod_sup, vendedor: v.vendedor, valor: R2(m.devolucao), clientes: m.clientesDevolveram || 0 });
      }
    }
    await enviaEmLotes('devmotivo_vend', devVendRows, 400);
  } catch (e) { log(`AVISO devmotivo ${mes}:`, e.message); }

  // 12) DRE + Curva Negativa Margem + Histograma Margem
  try {
    const dreRows = [];
    const pushDre = (fil, nivel, cod, nome, l) => {
      const rec = R2((l.bruto || 0) - (l.devolucao || 0)) || 0;
      const cv = R2((l.cmv || 0) + (l.comissao || 0) + (l.bonificacao || 0) + (l.impostos || 0)) || 0;
      const mc = R2(rec - (l.cmv || 0) - (l.bonificacao || 0) - (l.comissao || 0)) || 0;
      const desc = R2((l.tabela || 0) - (l.bruto || 0)) || 0;
      dreRows.push({
        mes, filial: fil, nivel, cod: String(cod), nome: String(nome || cod),
        caixas: l.caixas != null ? R2(l.caixas) : null,
        peso_kg: l.pesoKg != null ? R2(l.pesoKg) : null,
        fat_bruto: R2(l.bruto), devolucao: R2(l.devolucao), receita_liq: rec,
        cmv: R2(l.cmv), comissao: R2(l.comissao), bonif_custo: R2(l.bonificacao), impostos: R2(l.impostos),
        custos_var: cv, mc_rs: mc, mc_pct: frac(mc, rec),
        desconto_rs: desc, desc_pct: frac(desc, l.tabela || rec),
        preco_tabela: R2(l.tabela), desc_politica: R2(l.descPolitica),
        desc_campanha: l.campanha != null ? R2(l.campanha) : null,
        desc_pol_encerrada: l.polRemovida != null ? R2(l.polRemovida) : null,
        desc_comercial: R2(Math.max(0, desc - (l.descPolitica || 0))),
        acima_tabela: R2(l.acimaTabela)
      });
    };
    const dreBr = motor.dre({ mes, ate });
    if (dreBr && dreBr.total) pushDre('BRASIL', 'brasil', 'BRASIL', 'BRASIL', dreBr.total);
    for (const l of (motor.dre({ mes, ate }, 'filial').linhas || [])) pushDre(H.paraSigla(l.nome || l.cod), 'filial', H.paraSigla(l.nome || l.cod), l.nome, l);
    for (const l of (motor.dre({ mes, ate }, 'fornecedor').linhas || [])) pushDre('BRASIL', 'fornecedor', l.cod, l.nome, l);
    for (const sig of eFil.map.keys()) {
      const fc = filtroFil(sig);
      for (const l of (motor.dre({ mes, ate, filiais: fc }, 'supervisor').linhas || [])) pushDre(sig, 'supervisor', l.cod, l.nome, l);
      for (const l of (motor.dre({ mes, ate, filiais: fc }, 'vendedor').linhas || [])) pushDre(sig, 'vendedor', l.cod, l.nome, l);
    }
    if (dreRows.length) await enviaEmLotes('dre_mes', dreRows, 300, { dre_limpar_mes: mes });
    const { curvaNeg, hist } = extrairHistogramaECurvaNeg(motor, cubo, H, mes, ate, pedMeta);
    if (curvaNeg.length) await enviaEmLotes('curva_neg_margem', curvaNeg, 300, { curva_neg_limpar_mes: mes });
    if (hist.length) await enviaEmLotes('histograma_margem', hist, 300, { hist_limpar_mes: mes });
    log(`${mes} margem: dre=${dreRows.length} curvaNeg=${curvaNeg.length} hist=${hist.length}`);
  } catch (e) { log(`AVISO dre/margem ${mes}:`, e.message); }

  // 13) PORTAO CONTABIL (trava de qualidade matematica)
  const portao = await api('POST', '', {
    portao_contabil: {
      mes, lote_id: loteId, posicao,
      colunas: Object.keys((filRows[0] && filRows[0].dados) || {}),
      linhas: vndRows.length, enviadas: envVnd, forcar: FORCAR, iniciado_em: loteId
    }
  });
  log(`${mes} PORTAO CONTABIL:`, JSON.stringify(portao));
  if (portao && portao.bloqueado && !FORCAR) {
    throw new Error(`Portao contabil bloqueou ${mes}: ${(portao.motivos || []).join(' | ')}`);
  }

  // ==================== TIER 2 ====================
  if (tiers.has(2)) {
    // Cliven resumo
    try {
      const rot = cubo.clivenCart && cubo.clivenCart.rot && cubo.clivenCart.rot[mes];
      if (rot && rot.fil) {
        const resC = [];
        for (const [sg, clientesObj] of Object.entries(rot.fil)) {
          const fil = H.paraSigla(sg);
          const porVend = new Map();
          for (const [cnpj, rcas] of Object.entries(clientesObj || {})) {
            const cad = H.CAD[cnpj] || H.CAD[nCnpj(cnpj)];
            if (!cad || (cad[3] !== 'A' && cad[3] !== 'B')) continue;
            for (const vCod of rcas || []) {
              const rca = String(vCod);
              let o = porVend.get(rca);
              if (!o) {
                const codSup = String((rot.sup && rot.sup[rca]) || '');
                o = {
                  mes, filial: fil, cod_sup: codSup, rca,
                  vendedor: vendNomes.get(rca) || (rot.nomes && rot.nomes[rca]) || rca,
                  supervisor: supNomes.get(codSup) || codSup,
                  gerente: '', perfil: '',
                  clientes_carteira: 0, clientes_ativos: 0, clientes_bloq: 0, positivados: 0,
                  aproveitamento_pct: 0, fat_mes: 0, m1: 0, media_3m: 0
                };
                porVend.set(rca, o);
              }
              o.clientes_carteira++;
              if (cad[3] === 'A') o.clientes_ativos++;
              else o.clientes_bloq++;
            }
          }
          for (const o of porVend.values()) {
            const vMatch = vendRows.filter((v) => v.filial === o.filial && v.rca === o.rca);
            o.fat_mes = R2(vMatch.reduce((s, v) => s + (v.dados['Faturado líquido (R$)'] || 0), 0));
            o.positivados = vMatch.reduce((m, v) => Math.max(m, v.dados['Positivação (filial + CNPJ)'] || 0), 0);
            o.aproveitamento_pct = o.clientes_ativos > 0 ? frac(o.positivados, o.clientes_ativos) : 0;
            resC.push(o);
          }
        }
        if (resC.length) await enviaEmLotes('cliven_resumo', resC, 300, { cliven_limpar_mes: mes });
        await api('POST', '', { controle: { lote_id: loteId, mes, etapa: 'cliven', status: 'OK', linhas: resC.length, gravadas: resC.length, posicao } });
      }
    } catch (e) { log(`AVISO cliven ${mes}:`, e.message); }

    // Cadastro clientes
    try {
      const cadRows = extrairCadastroClientes(cubo, H, mes, ate);
      if (cadRows.length) await enviaEmLotes('cadastro_clientes', cadRows, 300, { cad_limpar_mes: mes });
      await api('POST', '', { controle: { lote_id: loteId, mes, etapa: 'cadastro', status: 'OK', linhas: cadRows.length, gravadas: cadRows.length, posicao } });
    } catch (e) { log(`AVISO cadastro ${mes}:`, e.message); }

    // FEFO & Estoque Winthor (somente 1x por rodada, no primeiro mes)
    if (mes === horaBRT().diaIso.slice(0, 7)) {
      try {
        const fefo = extrairFefo(cubo, H);
        if (fefo.length) {
          await enviaEmLotes('fefo', fefo, 300, { fefo_limpar: true });
          await api('POST', '', { controle: { lote_id: loteId, mes, etapa: 'fefo', status: 'OK', linhas: fefo.length, gravadas: fefo.length, posicao } });
        }
      } catch (e) { log('AVISO fefo:', e.message); }
      try {
        const ew = extrairEstWinthor(cubo, H);
        if (ew.length) {
          await enviaEmLotes('est_winthor', ew, 300, { est_winthor_limpar: true });
          await api('POST', '', { controle: { lote_id: loteId, mes, etapa: 'est_winthor', status: 'OK', linhas: ew.length, gravadas: ew.length, posicao } });
        }
      } catch (e) { log('AVISO est_winthor:', e.message); }
    }

    // Visao Campo (se existir no cubo)
    try {
      const C = cubo.campo;
      if (C && Array.isArray(C.meses) && C.meses.includes(mes) && Array.isArray(C.linhas) && C.linhas.length) {
        const cRows = C.linhas
          .filter((l) => String(l.mes || l[0] || mes) === mes)
          .slice(0, 1200)
          .map((l) => ({
            mes,
            filial: H.paraSigla(l.filial || l[1] || 'BRASIL'),
            nivel: String(l.nivel || 'filial'),
            cod: String(l.cod || l.rca || l[1] || ''),
            nome: String(l.nome || ''),
            sup_cod: String(l.sup_cod || ''),
            eficiencia_pct: l.eficiencia ?? null,
            eficacia_pct: l.eficacia ?? null,
            hora_checkin: l.horaCkIn || null,
            hora_checkout: l.horaCkOut || null,
            min_visita: l.minVisita ?? null,
            min_rota: l.minRota ?? null,
            hora_ped1: l.horaPed1 || null,
            pct_ped18: l.pctPed18 ?? null,
            venda_captada: l.vendaCaptada ?? null,
            pedidos_captados: l.pedCaptados ?? null,
            venda_sem_visita: l.vendaSemVisita ?? null,
            pct_sem_visita: l.pctSemVisita ?? null,
            cobertura_pdv_pct: l.coberturaPdv ?? null,
            carteira_visitada_pct: l.carteiraVisitada ?? null,
            gerado_em: C.geradoEm || ''
          }));
        if (cRows.length) await enviaEmLotes('campo_mes', cRows, 300, { campo_limpar_mes: mes });
      }
    } catch (e) { log(`AVISO campo ${mes}:`, e.message); }
  }

  // ==================== TIER 3 ====================
  if (tiers.has(3)) {
    try {
      const rfvData = extrairRecorrenciaERfv(cubo, H, mes, ate, supNomes, vendNomes, cartPorCli);
      if (rfvData) {
        if (rfvData.recPasta.length) {
          for (let i = 0; i < rfvData.recPasta.length; i += 100) await api('POST', '', { recorrencia: rfvData.recPasta.slice(i, i + 100) });
        }
        if (rfvData.faixas.length) {
          await enviaEmLotes('recorrencia_faixas', rfvData.faixas, 300, { rec_fx_limpar_mes: mes });
        }
        if (rfvData.recClientes.length) {
          await enviaEmLotes('recorrencia_clientes', rfvData.recClientes, 300, { rec_cli_limpar_mes: mes });
        }
        if (rfvData.rfvResumo.length) {
          await enviaEmLotes('rfv_resumo', rfvData.rfvResumo, 300, { rfv_res_limpar_mes: mes });
        }
        if (rfvData.rfvClientes.length) {
          await enviaEmLotes('rfv_clientes', rfvData.rfvClientes, 300, { rfv_cli_limpar_mes: mes });
        }
        const pmiRows = extrairPmi(cubo, rfvData, H, mes);
        if (pmiRows.length) {
          await enviaEmLotes('pmi_mes', pmiRows, 300, { pmi_limpar_mes: mes });
        }
        log(`${mes} rec/rfv/pmi: pasta=${rfvData.recPasta.length} faixas=${rfvData.faixas.length} rfvCli=${rfvData.rfvClientes.length} pmi=${pmiRows.length}`);
      }
    } catch (e) { log(`AVISO rec/rfv/pmi ${mes}:`, e.message); }

    // JBP por SKU
    try {
      const eJbp = indexarExtrair(motor.extrair({ mes, ate }, ['fi', 'fo', 'sk']), ['fi', 'fo', 'sk'], H);
      const m1J = safeExt(refs.m1, ['fi', 'fo', 'sk']);
      const a1J = safeExt(refs.a1, ['fi', 'fo', 'sk']);
      const bJ = safeExt(refs.bench, ['fi', 'fo', 'sk']);
      const jRows = [];
      for (const [k, r] of eJbp.map) {
        const [filial, fornChave, sku] = k.split(SEP);
        const fat = R2(((r.bruto || 0) - (r.devolucao || 0)) / 100) || 0;
        const rm1 = m1J.get(k), ra1 = a1J.get(k), rb = bJ.get(k);
        const fM1 = rm1 ? R2(((rm1.bruto || 0) - (rm1.devolucao || 0)) / 100) : 0;
        const fInfo = fornMetaByChave.get(fornChave) || { nome: fornChave, codW: '' };
        const p = prodW[sku] || [];
        jRows.push({
          mes, filial, fornecedor: fInfo.nome, forn_cod: fInfo.codW, sku,
          produto: String(p[0] || sku),
          fat_liq: fat, meta: r.meta != null ? R2(r.meta / 100) : null,
          fat_m1: fM1, delta_m1: R2(fat - fM1), fat_3m: null,
          fat_a1: ra1 ? R2(((ra1.bruto || 0) - (ra1.devolucao || 0)) / 100) : null,
          fat_ytd: null, fat_lytd: null, pos: r.positivacao || 0,
          bench: rb ? R2(((rb.bruto || 0) - (rb.devolucao || 0)) / 100) : null
        });
      }
      jRows.sort((a, b) => Math.max(Math.abs(b.delta_m1 || 0), b.fat_liq || 0) - Math.max(Math.abs(a.delta_m1 || 0), a.fat_liq || 0));
      const topJ = jRows.slice(0, 4500);
      if (topJ.length) await enviaEmLotes('jbp_sku', topJ, 300, { jbp_limpar_mes: mes });
      log(`${mes} jbp_sku: ${topJ.length} de ${jRows.length}`);
    } catch (e) { log(`AVISO jbp ${mes}:`, e.message); }
  }

  // ==================== BRIEFING CACHE (IA low-token) ====================
  if (mes === horaBRT().diaIso.slice(0, 7)) {
    const cache = [];
    const buildSnap = (chave, nivel, fil, fRows) => {
      const fat = R2(fRows.reduce((s, x) => s + (x.dados['Faturado líquido (R$)'] || 0), 0));
      const metaV = R2(fRows.reduce((s, x) => s + (x.dados['Meta (R$)'] || 0), 0));
      const cart = R2(fRows.reduce((s, x) => s + (x.dados['Carteira pendente (R$)'] || 0), 0));
      const cap = R2(fRows.reduce((s, x) => s + (x.dados['Captação (R$)'] || 0), 0));
      const ideal = R2(fRows.reduce((s, x) => s + (x.dados['Meta Ideal captação (R$)'] || 0), 0));
      const dev = R2(fRows.reduce((s, x) => s + (x.dados['Devolução (R$)'] || 0), 0));
      const mc = R2(fRows.reduce((s, x) => s + (x.dados['Margem de contribuição (R$)'] || 0), 0));
      const p = {
        posicao, mes, escopo: chave,
        fat, meta: metaV, cart, fat_cart: R2(fat + cart),
        pct_fat: frac(fat, metaV), pct_fat_cart: frac(fat + cart, metaV),
        cap, ideal, ritmo: frac(cap, ideal),
        dev, mc_rs: mc, mc_pct: frac(mc, fat),
        piores_filiais: fil ? undefined : fRows.slice().sort((a, b) => (a.dados['% Meta (Fat + Cart)'] || 0) - (b.dados['% Meta (Fat + Cart)'] || 0)).slice(0, 5).map((x) => ({ f: x.filial, pct: x.dados['% Meta (Fat + Cart)'], gap: R2(Math.max(0, (x.dados['Meta (R$)'] || 0) - (x.dados['Faturado + Carteira (R$)'] || 0))) }))
      };
      const payload_json = JSON.stringify(p);
      cache.push({ chave, mes, carga_id: loteId, nivel, filial: fil || null, payload_json, tokens_est: Math.ceil(payload_json.length / 4), gerado_em: new Date().toISOString() });
    };
    buildSnap('BRASIL', 'brasil', null, filRows);
    for (const r of filRows) buildSnap(r.filial, 'filial', r.filial, [r]);
    await api('POST', '', { briefing_cache: cache });
    log(`${mes} briefing_cache: ${cache.length} chaves gravadas`);
  }
}

async function main() {
  if (!KEY && !ENSAIO) throw new Error('EVO_KEY nao configurado');
  const t0 = Date.now();
  const cookie = await loginGerot(EMAIL, SENHA);
  const loaded = await carregarCuboEMotor(cookie, { conc: 12, log });
  const { meta, cubo, motor } = loaded;
  const tiers = tiersAtivos();
  const ultSemH = fmtBrHora(meta.geradoEm, true) || fmtBrHora(new Date(Date.now() - 3 * 3600e3).toISOString(), true);
  const posBr = fmtBrData(meta.posicaoD0 || meta.posicao);
  const posicao = `Atual · ${posBr} · atualizado ${ultSemH}`;
  const loteId = new Date().toISOString();

  const { diaIso } = horaBRT();
  const mesAtual = diaIso.slice(0, 7);
  let meses = MESES_ARG ? MESES_ARG.split(',').map((s) => s.trim()).filter(Boolean) : [mesAtual];
  if (!MESES_ARG && Number(diaIso.slice(8, 10)) <= 5 && (cubo.meses || []).includes(mesMenos(mesAtual, 1))) {
    meses.push(mesMenos(mesAtual, 1));
  }
  log('MESES:', meses.join(', '), '| TIERS:', [...tiers].join(','), '| POSICAO:', posicao);
  log('CUBO_KEYS:', Object.keys(cubo || {}).join(','));
  log('MOTOR_KEYS:', Object.keys(motor || {}).join(','));

  for (const m of meses) {
    await processarMes(m, loaded, tiers, posicao, loteId);
  }
  log(`Concluido em ${Math.round((Date.now() - t0) / 1000)}s`);
}

main().catch((e) => {
  console.error('ERRO gerot_motor_coleta:', e && e.message ? e.message : e);
  process.exit(1);
});
