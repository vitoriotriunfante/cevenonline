// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/clube.js
// O QUE É: leitura UNICA do Clube da Venda (TradePro) gravado no D1 (tabela clube_venda_dia, robo pipeline/clube_coletor.mjs a cada 15 min).
//   Vitorio, 12/11/2026 (CEVEN fora desde 11/11 17:34): "bora pegar do clube entao visitas e vendas". O Clube e a ORIGEM do pedido digitado e da visita.
// REGRAS: so vale leitura de HOJE e com ate 45 min (senao: sem dado, nunca zero). Pedido do Clube = DIGITADO (esforco do dia); a Liga e a premiacao
//   continuam so com o pedido aceito no Winthor (o Clube nao gera gol). Positivacao do dia o Clube nao da por cliente: nunca e estimada.
// =========================================================================
export const CLUBE_MAX_IDADE_MS = 45 * 60 * 1000;
const mem = new Map();   // filial|dia -> { exp, v }

export async function lerClubeFilial(env, filial, dia) {
  if (!env || !env.DB) return null;
  const k = filial + '|' + dia, c = mem.get(k);
  if (c && Date.now() < c.exp) return c.v;
  let v = null;
  for (const espera of [0, 200, 500]) {
    if (espera) await new Promise((ok) => setTimeout(ok, espera));
    try {
      const { results } = await env.DB.prepare('SELECT * FROM clube_venda_dia WHERE dia = ? AND filial = ?').bind(dia, filial).all();
      const m = new Map();
      for (const r of results || []) {
        const idade = Date.now() - Date.parse(String(r.lido_em || ''));
        // 16/11/2026 (Vitorio 21:32 'Pedidos brasil hoje' -> R$ 0: o robo do Clube para as 20:45 e a regra de 45 min devolvia o CEVEN da madrugada):
        // vale a ULTIMA leitura de HOJE do Clube (a hora vai junto em lido_em); 'fresco' continua dizendo se tem menos de 45 min.
        if (idade >= 0) m.set(String(r.rca), r);
      }
      const lido = (results || []).map((r) => r.lido_em).filter(Boolean).sort().pop() || null;
      v = { rcas: m, lido_em: lido, fresco: m.size > 0 && !!lido && Date.now() - Date.parse(lido) <= CLUBE_MAX_IDADE_MS };
      break;
    } catch { v = null; }
  }
  if (!v) return { rcas: new Map(), lido_em: null, fresco: false, erro: true };   // nunca cacheia falha/D1 ocupado
  if (v.rcas.size > 0) mem.set(k, { exp: Date.now() + 20000, v });
  return v;
}

export async function lerClubeBrasil(env, dia) {
  if (!env || !env.DB) return null;
  for (const espera of [0, 250]) {
    if (espera) await new Promise((ok) => setTimeout(ok, espera));
    try {
      const { results } = await env.DB.prepare(
        'SELECT filial, COUNT(*) vends, COALESCE(SUM(total_pedido), 0) dig, COALESCE(SUM(ped_total), 0) ped, COALESCE(SUM(roteiros), 0) rot, COALESCE(SUM(visitas_rota), 0) vis, COALESCE(SUM(ped_rota), 0) ped_rota, MAX(lido_em) lido_em FROM clube_venda_dia WHERE dia = ? GROUP BY filial'
      ).bind(dia).all();
      const m = new Map();
      for (const r of results || []) if (r && r.filial) m.set(String(r.filial), r);
      return m;
    } catch { /* tenta novamente */ }
  }
  return null;
}

// produtividade do DIA montada so com o que o Clube tem (o resto fica de fora: nunca inventado)
export function diaDoClube(r) {
  if (!r) return null;
  return { dig_pedido: Number(r.total_pedido) || 0, total_pedidos: Number(r.ped_total) || 0, visitas_na_rota: Number(r.visitas_rota) || 0, total_programado: Number(r.roteiros) || 0,
    visitas_com_venda: Number(r.ped_rota) || 0, eficiencia_pct: r.eficiencia, eficacia_pct: r.eficacia, _fonte: 'clube', _lido_em: r.lido_em };
}
