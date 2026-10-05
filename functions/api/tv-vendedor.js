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
// Catalogo codigo -> industria (e categoria da Mondelez), gerado por gerar_catalogo_industrias.js e publicado em /catalogo_industrias.json
let CATALOGO = null;
async function carregaCatalogo(request) {
  if (CATALOGO) return CATALOGO;
  try {
    const r = await fetch(new URL('/catalogo_industrias.json', request.url));
    if (r.ok) CATALOGO = await r.json();
  } catch { /* sem catalogo: os gols ficam sem nivel (nunca inventa) */ }
  return CATALOGO;
}
// Industrias (e categorias Mondelez) do pedido de HOJE: so linha com valor > 0 (bonificacao R$ 0 nao conta); codigo fora do catalogo e ignorado.
function industriasDoPedido(skus, cat) {
  if (!cat || !Array.isArray(skus)) return { industrias: null, categorias: null };
  const ind = new Map(), ca = new Map();
  for (const it of skus) {
    const v = Number(it.total) || 0;
    if (v <= 0) continue;
    const cod = String(it.codigo);
    if (cat.i[cod]) ind.set(cat.i[cod], (ind.get(cat.i[cod]) || 0) + v);
    if (cat.c[cod]) ca.set(cat.c[cod], (ca.get(cat.c[cod]) || 0) + v);
  }
  const lista = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ n, v: Math.round(v * 100) / 100 }));
  return { industrias: lista(ind), categorias: lista(ca) };
}
// O historico do CLIENTE traz pedidos de TODOS os vendedores que o atendem (ex.: pasta Mars de outro RCA). O numero do pedido e o codigo do
// RCA + 6 digitos (177000874 = RCA 177). Pedido de outro vendedor nunca entra na analise (05/10/2026: corte de Twix da pasta Mars
// apareceu no boletim do vendedor 60, que nao vende Twix).
const ehPedidoDoRca = (numPedido, rca) => !!rca && new RegExp('^' + String(rca) + '[0-9]{6}$').test(String(numPedido || ''));
// tolerante: 1,5% dos pedidos tem 5 ou 7 digitos depois do codigo (108600094 = RCA 1086)
const ehPedidoTolerante = (numPedido, rca) => !!rca && new RegExp('^' + String(rca) + '[0-9]{5,7}$').test(String(numPedido || ''));
function analisaPedido(historico, cat, rca) {
  const todas = Array.isArray(historico?.ultimas_visitas) ? historico.ultimas_visitas : [];
  let iAtual = rca ? todas.findIndex((v) => ehPedidoDoRca(v.num_pedido, rca)) : (todas.length ? 0 : -1);
  if (iAtual < 0 && rca) iAtual = todas.findIndex((v) => ehPedidoTolerante(v.num_pedido, rca));
  if (iAtual < 0) return null; // sem pedido proprio do vendedor neste cliente: nao analisa (nunca usa pedido de outro vendedor)
  const atual = todas[iAtual];
  const dataAtual = String(atual.data_visita || '').slice(0, 10);
  // anteriores: historico do cliente, sem os pedidos de OUTROS vendedores do mesmo dia do pedido atual
  const anteriores = todas.filter((v, k) => k > iAtual && !(String(v.data_visita || '').slice(0, 10) === dataAtual && rca && !ehPedidoDoRca(v.num_pedido, rca)));
  const visitas = [atual, ...anteriores];
  if (!visitas.length) return null;
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
  // valor do pedido de HOJE (visita mais recente do cliente) — alimenta "VALOR DA VENDA" dos lances (antes vinha vazio: R$ 0)
  const valorAtual = Array.isArray(atual?.skus) ? atual.skus.reduce((s, item) => s + (Number(item.total) || 0), 0) : 0;
  const { industrias, categorias } = industriasDoPedido(atual?.skus, cat);
  return { skusAtual, mediaHistorica, dobrouMix: mediaHistorica != null ? mixDobrado(skusAtual, mediaHistorica) : false, bonificacao, dobradinhaQuinzenas, valorAtual, industrias, categorias };
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
    visitas_na_rota: num(dia.visitas_na_rota), // oficial do CEVEN: visitas realizadas na rota hoje
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
          checkin_horario: c.checkin_horario || null,
          checkout_horario: c.checkout_horario || null,
          lat: num(c.latitude),
          lon: num(c.longitude),
          checkout_lat: num(c.checkout_latitude),
          checkout_lon: num(c.checkout_longitude),
          // null = o CEVEN NAO informou as tags nesta leitura (diferente de false = informou e nao tem RECORRENCIA). Gol de resgate nao nasce sem a tag informada
          // (achado 05/10/2026: 3 gols de resgate em clientes COM a tag nasceram as 15:43, numa leitura sem o campo).
          recorrencia: Array.isArray(c.focos) ? c.focos.some((f) => String(f?.industria_foco || '').toUpperCase().includes('RECORRENCIA')) : null,
          valorVendaAtual: analisePorCliente?.[c.id_cliente]?.valorAtual || 0,
          dobrouMix: analisePorCliente?.[c.id_cliente]?.dobrouMix || false,
          bonificacao: analisePorCliente?.[c.id_cliente]?.bonificacao || false,
          dobradinhaQuinzenas: analisePorCliente?.[c.id_cliente]?.dobradinhaQuinzenas || false,
          industrias: analisePorCliente?.[c.id_cliente]?.industrias || null,
          categorias: analisePorCliente?.[c.id_cliente]?.categorias || null
        }))
      : null,
    falhas: [!dash && 'dashboard', !prod && 'produtividade', !Array.isArray(rot) && 'roteiro'].filter(Boolean),
    consultado_em: new Date().toISOString()
  };
}

// USO DA COLETA UNICA (03/10/2026): com ?central=1 (usado pela coleta de lances em cron-lances.js) os dados base
// (dashboard, produtividade e roteiro) vem do que a varredura central ja guardou no D1, se tiver menos de 15
// minutos; so o historico dos clientes positivados continua indo ao CEVEN, em no maximo 2 chamadas simultaneas.
// Se nao houver dado recente e completo, cai para a consulta direta ao CEVEN, como sempre foi.
function dataHojeBrasilia() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  return `${p.year}-${p.month}-${p.day}`;
}

async function lerCentral(env, id) {
  if (!env || !env.DB) return null;
  try {
    const row = await env.DB.prepare(
      'SELECT roteiro_json, produtividade_json, dashboard_json, updated_at FROM varredura_central_rca WHERE rca_codigo = ? AND data_ref = ?'
    ).bind(String(id), dataHojeBrasilia()).first();
    if (!row || !row.updated_at) return null;
    const idade = Date.now() - Date.parse(String(row.updated_at).replace(' ', 'T') + 'Z');
    if (!(idade >= 0 && idade < 15 * 60 * 1000)) return null;
    const lê = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
    const rot = lê(row.roteiro_json), prod = lê(row.produtividade_json), dash = lê(row.dashboard_json);
    return Array.isArray(rot) && prod && dash ? { rot, prod, dash } : null;
  } catch { return null; }
}

async function poolLimitado(tarefas, n) {
  const saida = new Array(tarefas.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(n, tarefas.length) }, async () => {
    while (true) {
      const k = proximo++;
      if (k >= tarefas.length) return;
      saida[k] = await tarefas[k]();
    }
  }));
  return saida;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const filial = (url.searchParams.get('filial') || '').toLowerCase().replace(/1$/, '');
  const id = url.searchParams.get('id');
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

  if (!/^[a-z]{3}$/.test(filial) || !id || !/^\d+$/.test(id)) {
    return new Response(JSON.stringify({ erro: 'filial (sigla) e id (numérico) obrigatórios' }), { status: 400, headers: cors });
  }
  const key = filial + '1';
  const q = `filial=${key}&id=${id}`;
  const usarCentral = url.searchParams.get('central') === '1';
  const central = usarCentral ? await lerCentral(env, id) : null;
  const [dash, prod, rot] = central
    ? [central.dash, central.prod, central.rot]
    : await Promise.all([
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
    const catalogo = await carregaCatalogo(request);
    const buscas = positivadosHoje.map((c) => () => getJson(`${CEVEN}/api/rca/historico-cliente/${c.id_cliente}?${q}`));
    // pela coleta de lances (central=1): no maximo 2 simultaneas; na tela da TV segue como antes
    const resultados = usarCentral ? await poolLimitado(buscas, 2) : await Promise.all(buscas.map((f) => f()));
    positivadosHoje.forEach((c, i) => {
      const analise = analisaPedido(resultados[i], catalogo, id);
      if (analise) analisePorCliente[c.id_cliente] = analise;
    });
  }
  return new Response(JSON.stringify(montarTv(id, dash, prod, rot, analisePorCliente)), { headers: cors });
}
