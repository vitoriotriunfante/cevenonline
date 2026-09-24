// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: endpoint enxuto da TV (CFTV) — 1 vendedor, só dado AO VIVO do CEVEN.
// PROJETO: CFTV/TV (não é WhatsApp). Ver CLAUDE.md.
// REGRA: nunca inventa dado. Se o CEVEN não responder, devolve o campo como null
//        (a TV mostra "sem dado" e mantém a última leitura real).
// LÊ: /api/rca/dashboard, /api/rca/produtividade, /api/rca/roteiro-hoje (3 chamadas).
// ESPELHO LOCAL: a mesma lógica existe em server.js (rota /api/tv-vendedor) para
//        testar sem Cloudflare. Se mudar aqui, mudar lá.
// =========================================================================

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const HDR = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

async function getJson(url) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}

const num = (v) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

function montarTv(id, dash, prod, rot) {
  const fin = dash?.financeiro || {};
  const pos = dash?.positivacao || {};
  const dia = prod?.dia || {};
  return {
    id: String(id),
    nome: dash?.nome || null,
    meta_fat: num(fin.meta),
    faturado: num(fin.faturado),
    pendente: num(fin.pendente),
    devolucao: num(fin.devolucao),
    meta_cli: num(pos.meta),
    real_cli: num(pos.realizado),
    dig_hoje: num(dia.dig_pedido),
    pos_hoje: num(dia.positivacao),
    visitas_prog: num(dia.total_programado),
    visitas_com_venda: num(dia.visitas_com_venda),
    clientes: Array.isArray(rot)
      ? rot.map((c) => ({
          id: c.id_cliente,
          nome: c.nome_cliente || c.razao_social || null,
          status: c.status || null,
          motivo: c.motivo_nao_visita || null,
          obs: c.observacao_nao_visita || null,
          ultima_compra: c.data_ultima_compra ? String(c.data_ultima_compra).slice(0, 10) : null,
          valor_ultima: num(c.valor_ultima_compra),
          tempo_visita: c.tempo_visita || null
        }))
      : null,
    falhas: [!dash && 'dashboard', !prod && 'produtividade', !Array.isArray(rot) && 'roteiro'].filter(Boolean),
    consultado_em: new Date().toISOString()
  };
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const filial = (url.searchParams.get('filial') || '').toLowerCase().replace(/1$/, '');
  const id = url.searchParams.get('id');
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

  if (!/^[a-z]{3}$/.test(filial) || !id || !/^\d+$/.test(id)) {
    return new Response(JSON.stringify({ erro: 'filial (sigla) e id (numérico) obrigatórios' }), { status: 400, headers: cors });
  }
  const key = filial + '1';
  const q = `filial=${key}&id=${id}`;
  const [dash, prod, rot] = await Promise.all([
    getJson(`${CEVEN}/api/rca/dashboard?${q}`),
    getJson(`${CEVEN}/api/rca/produtividade?${q}`),
    getJson(`${CEVEN}/api/rca/roteiro-hoje?${q}`)
  ]);
  return new Response(JSON.stringify(montarTv(id, dash, prod, rot)), { headers: cors });
}
