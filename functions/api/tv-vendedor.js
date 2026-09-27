// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: endpoint enxuto da TV (CFTV) — 1 vendedor, só dado AO VIVO do CEVEN.
// PROJETO: CFTV/TV (não é WhatsApp). Ver CLAUDE.md.
// REGRA: nunca inventa dado. Se o CEVEN não responder, devolve o campo como null
//        (a TV mostra "sem dado" e mantém a última leitura real).
// LÊ: /api/rca/dashboard, /api/rca/produtividade, /api/rca/roteiro-hoje (3 chamadas) +
//     /api/rca/historico-cliente/{id} SÓ para clientes POSITIVADO/EFETIVADO hoje (G03 Dobrou
//     o Mix) — nunca para toda a rota, seria caro demais (1 chamada extra por cliente vendido).
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

// G03 Dobrou o Mix: SKUs do último pedido >= 2x a média histórica (ou >=10 se histórico <=5).
function mixDobrado(skusAtual, mediaHistorica) {
  if (skusAtual == null || mediaHistorica == null) return false;
  if (mediaHistorica <= 5) return skusAtual >= 10;
  return skusAtual >= 2 * mediaHistorica;
}
// V03 Bonificação sem venda: padrão identificado no datalake (analises/pedidos_historico_ceven.db) —
// pedido com 2+ itens e soma de valor = R$0,00 é bonificação lançada como pedido normal. Aqui é
// calculado AO VIVO com o mesmo endpoint público (não depende do datalake, que só atualiza 1x/dia).
function ehBonificacao(skus) {
  if (!Array.isArray(skus) || skus.length < 2) return false;
  const soma = skus.reduce((s, item) => s + (Number(item.total) || 0), 0);
  return soma === 0;
}
// Extrai {skusAtual, mediaHistorica, dobrouMix, bonificacao} de um
// /api/rca/historico-cliente/{id}: usa a visita mais recente como "pedido atual" e a média das
// visitas ANTERIORES como histórico do mix (nunca inclui o próprio pedido atual na média, senão
// o cálculo fica enviesado).
function analisaPedido(historico) {
  const visitas = Array.isArray(historico?.ultimas_visitas) ? historico.ultimas_visitas : [];
  if (!visitas.length) return null;
  const [atual, ...anteriores] = visitas;
  const skusAtual = Array.isArray(atual?.skus) ? atual.skus.length : null;
  const bonificacao = ehBonificacao(atual?.skus);
  if (skusAtual == null && !bonificacao) return null;
  const mediaHistorica = anteriores.length ? anteriores.reduce((soma, v) => soma + (Array.isArray(v.skus) ? v.skus.length : 0), 0) / anteriores.length : null;
  // G04 Dobradinha das Quinzenas: cliente comprou na 1ª quinzena (dia 1-15) E na 2ª (dia 16-fim)
  // do MESMO mês corrente. Usa só data (dia 1-15 / 16+), nunca precisa de hora — dado 100%
  // confiável (mesma lógica já usada em analises/reconciliar_item6_slide2.py).
  const hojeISO = atual?.data_visita ? String(atual.data_visita).slice(0, 10) : null;
  const mesAtual = hojeISO ? hojeISO.slice(0, 7) : null;
  const diaAtual = hojeISO ? Number(hojeISO.slice(8, 10)) : null;
  let dobradinhaQuinzenas = false;
  if (mesAtual && diaAtual != null) {
    const comprouOutraQuinzena = anteriores.some((v) => {
      const dataV = v?.data_visita ? String(v.data_visita).slice(0, 10) : null;
      if (!dataV || dataV.slice(0, 7) !== mesAtual) return false; // só o mesmo mês
      const diaV = Number(dataV.slice(8, 10));
      return diaAtual <= 15 ? diaV > 15 : diaV <= 15; // a "outra" quinzena da atual
    });
    dobradinhaQuinzenas = comprouOutraQuinzena;
  }
  return { skusAtual, mediaHistorica, dobrouMix: mediaHistorica != null ? mixDobrado(skusAtual, mediaHistorica) : false, bonificacao, dobradinhaQuinzenas };
}

function montarTv(id, dash, prod, rot, analisePorCliente) {
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
          tempo_visita: c.tempo_visita || null,
          lat: num(c.latitude),
          lon: num(c.longitude),
          checkout_lat: num(c.checkout_latitude),
          checkout_lon: num(c.checkout_longitude),
          recorrencia: Array.isArray(c.focos) ? c.focos.some((f) => String(f?.industria_foco || '').toUpperCase().includes('RECORRENCIA')) : false,
          dobrouMix: analisePorCliente?.[c.id_cliente]?.dobrouMix || false,
          bonificacao: analisePorCliente?.[c.id_cliente]?.bonificacao || false,
          dobradinhaQuinzenas: analisePorCliente?.[c.id_cliente]?.dobradinhaQuinzenas || false
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
  // G03 (Dobrou o Mix) e V03 (Bonificação): só para clientes positivados HOJE (evita 1 chamada
  // extra por cliente da rota inteira — geralmente são poucos positivados por dia, não os 10-20+
  // da rota completa).
  const positivadosHoje = Array.isArray(rot) ? rot.filter((c) => ['POSITIVADO', 'EFETIVADO'].includes(c.status)) : [];
  const analisePorCliente = {};
  if (positivadosHoje.length) {
    const resultados = await Promise.all(
      positivadosHoje.map((c) => getJson(`${CEVEN}/api/rca/historico-cliente/${c.id_cliente}?${q}`))
    );
    positivadosHoje.forEach((c, i) => {
      const analise = analisaPedido(resultados[i]);
      if (analise) analisePorCliente[c.id_cliente] = analise;
    });
  }
  return new Response(JSON.stringify(montarTv(id, dash, prod, rot, analisePorCliente)), { headers: cors });
}
