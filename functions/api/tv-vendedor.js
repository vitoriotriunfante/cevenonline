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
const CEVEN_APP_SECRET = '23bae7bff90221ee91885ea3fc07ac9e0e2b498696b7a3f34ab6466b7da9190d';
const HDR = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'X-App-Secret': CEVEN_APP_SECRET };

async function getJson(url, ms = 20000) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(ms) });
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
// AS (Autosservico, Vitório 07/10/2026): cliente tem 100+ SKUs cadastrados, dobrar nao existe; 2 SKUs a MAIS que a media do cliente ja e gol.
function mixDobrado(skusAtual, mediaHistorica, canal) {
  if (skusAtual == null || mediaHistorica == null) return false;
  if (canal === 'AS') return skusAtual >= mediaHistorica + 2;
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
function analisaPedido(historico, cat, rca, hoje, canal) {
  const todas = Array.isArray(historico?.ultimas_visitas) ? historico.ultimas_visitas : [];
  let iAtual = rca ? todas.findIndex((v) => ehPedidoDoRca(v.num_pedido, rca)) : (todas.length ? 0 : -1);
  if (iAtual < 0 && rca) iAtual = todas.findIndex((v) => ehPedidoTolerante(v.num_pedido, rca));
  if (iAtual < 0) return null; // sem pedido proprio do vendedor neste cliente: nao analisa (nunca usa pedido de outro vendedor)
  const atual = todas[iAtual];
  const dataAtual = String(atual.data_visita || '').slice(0, 10);
  // O gol e do pedido de HOJE. Se o pedido de hoje ainda nao apareceu no historico, o 'atual' seria uma compra ANTIGA do cliente e geraria gol falso
  // (06/10/2026: dobradinha das quinzenas e industrias de um pedido de 22/09 saindo como gol de hoje). Sem pedido de hoje = sem analise.
  if (hoje && dataAtual !== hoje) return null;
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
  // pedido de hoje e (se houver dobradinha) os pedidos REAIS de cada quinzena do mes, com numero, data e valor (nunca estimativa)
  const pedidoHoje = { num: atual.num_pedido || null, status_pedido: atual.status_pedido || null, valor: Number(atual.total_clube) || valorAtual,
    // CORTE do pedido (15/10/2026): o WhatsApp le cortes e bloqueados daqui (/api/pedidos-dia) em vez de perguntar ao CEVEN cliente por cliente na hora do envio
    data: atual.data_visita ? String(atual.data_visita).slice(0, 10) : null, categoria_corte: atual.categoria_corte || null, itens_cortados: Array.isArray(atual.itens_cortados) ? atual.itens_cortados.map((it) => ({ qt_cortada: it.qt_cortada, preco: it.preco })) : [],
    total_clube: Number(atual.total_clube) || null, valor_original: Number(atual.valor_original) || null, vl_faturado_winthor: Number(atual.vl_faturado_winthor) || null, vl_perdido_logistica: Number(atual.vl_perdido_logistica) || null };
  let quinzenas = null;
  if (dobradinhaQuinzenas) {
    const doMes = todas.filter((v) => String(v.data_visita || '').slice(0, 7) === mesAtual && v.num_pedido && Number(v.total_clube) > 0);
    const grupo = (f) => { const pedidos = doMes.filter((v) => f(Number(String(v.data_visita).slice(8, 10)))).map((v) => ({ data: String(v.data_visita).slice(0, 10), num: v.num_pedido, valor: Number(v.total_clube) || 0, status: v.status_pedido || null })); return { valor: Math.round(pedidos.reduce((a, p) => a + p.valor, 0) * 100) / 100, pedidos }; };
    quinzenas = { q1: grupo((d) => d <= 15), q2: grupo((d) => d > 15) };
  }
  return { skusAtual, mediaHistorica, dobrouMix: mediaHistorica != null ? mixDobrado(skusAtual, mediaHistorica, canal) : false, bonificacao, dobradinhaQuinzenas, valorAtual, industrias, categorias, pedidoHoje, quinzenas };
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
          pedidoHoje: analisePorCliente?.[c.id_cliente]?.pedidoHoje || null,
          quinzenas: analisePorCliente?.[c.id_cliente]?.quinzenas || null,
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

// DEVOLVE O QUE A BASE TEM, MESMO INCOMPLETO (11/10/2026): antes, linha sem dashboard ou com mais de 15 min = 3 chamadas ao vivo; com o coletor de lances passando
// por todos os RCAs, isso estourava o limite do CEVEN (HTTP 429 para a chave inteira), a varredura central tambem era bloqueada e a base ficava cada vez mais velha.
// Agora o chamador busca ao vivo SO o pedaco que faltar. maxIdadeMs: 15 min na tela; 30 min no coletor de lances (central=1).
async function lerCentral(env, id, maxIdadeMs) {
  if (!env || !env.DB) return null;
  try {
    const row = await env.DB.prepare(
      'SELECT roteiro_json, produtividade_json, dashboard_json, updated_at FROM varredura_central_rca WHERE rca_codigo = ? AND data_ref = ?'
    ).bind(String(id), dataHojeBrasilia()).first();
    if (!row || !row.updated_at) return null;
    const idade = Date.now() - Date.parse(String(row.updated_at).replace(' ', 'T') + 'Z');
    if (!(idade >= 0 && idade < maxIdadeMs)) return null;
    const lê = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
    const rot = lê(row.roteiro_json), prod = lê(row.produtividade_json), dash = lê(row.dashboard_json);
    return { rot: Array.isArray(rot) ? rot : null, prod: prod || null, dash: dash || null };
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
  const canalVend = String(url.searchParams.get('canal') || '').toUpperCase() === 'AS' ? 'AS' : '';
  const central = usarCentral ? await lerCentral(env, id, 30 * 60 * 1000) : null;
  const c = central || {};
  // CEVEN LENTO (15/10/2026 23h: chamadas travando 20 s; a Matriz levava ate 78 s por vendedor e ficava em "carregando"): na coleta central, se a base
  // do dia ja tem o vendedor (mesmo com mais de 30 min), o CEVEN tem so 6 s para responder antes de usar a base.
  const temReserva = usarCentral && !central ? !!(await lerCentral(env, id, 24 * 60 * 60 * 1000)) : false;
  const msCeven = temReserva ? 6000 : 20000;
  let [dash, prod, rot] = await Promise.all([
    c.dash || getJson(`${CEVEN}/api/rca/dashboard?${q}`, msCeven),
    c.prod || getJson(`${CEVEN}/api/rca/produtividade?${q}`, msCeven),
    c.rot || getJson(`${CEVEN}/api/rca/roteiro-hoje?${q}`, msCeven)
  ]);
  const cevenFalhou = !dash || !prod || !rot;
  // RESERVA DA BASE (15/10/2026: o coletor de lances falhou em 400 de 548 vendedores — a base com mais de 30 min ia ao CEVEN e levava 429): se o CEVEN
  // recusar, usa o dado REAL do dia que a varredura central ja leu (mesmo mais velho). Nunca inventa: sem base do dia, segue como falha.
  if (!dash || !prod || !rot) {
    const reserva = await lerCentral(env, id, 24 * 60 * 60 * 1000);
    if (reserva) { dash = dash || reserva.dash; prod = prod || reserva.prod; rot = rot || reserva.rot; }
  }
  // DADO DE ONTEM NA MANHA DE HOJE (Vitório, 07/10/2026: "tô recebendo lance de ontem agora"): na virada do dia o CEVEN ainda serve o roteiro e a produtividade de ONTEM.
  // 1) roteiro com cliente de OUTRA data (data_visita) ou com check-in DEPOIS da hora de agora = roteiro de ontem: descarta (nenhum lance nasce dele).
  // 2) ate as 10h: produtividade do dia com visitas/pedidos mas roteiro (com clientes) SEM nenhum check-in = produtividade de ontem: zera o 'dia'. Nunca inventa: so deixa de usar dado velho.
  let rotaAntiga = false;
  { const hojeSP = dataHojeBrasilia(), hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    // 19/10/2026 (WhatsApp das 14:30 preso): check-in com hora A FRENTE do relogio (aparelho com hora errada, ex.: MCD 1063 'check-in 16:29' as 15h) com data_visita = HOJE
    // descartava o roteiro inteiro; os pedidos desses vendedores nunca eram analisados e o motor esperava para sempre. Agora a hora futura so condena o roteiro na virada
    // do dia (antes das 10h, quando o CEVEN ainda serve o de ontem) ou quando esta mais de 3 h a frente; relogio de aparelho adiantado a tarde nao derruba mais a rota.
    const minDe = (s) => { const [a, b] = String(s).slice(0, 5).split(':').map(Number); return a * 60 + (b || 0); };
    const futuro = (ck) => ck && String(ck).slice(0, 5) > hm && (hm < '10:00' || minDe(ck) - minDe(hm) > 180);
    if (Array.isArray(rot) && rot.some((c) => (c.data_visita && String(c.data_visita).slice(0, 10) !== hojeSP) || futuro(c.checkin_horario))) { rot = []; rotaAntiga = true; }
    // PRODUTIVIDADE DE ONTEM x VENDA DE HOJE (13/10/2026 08:30): esta regra zerava TODO vendedor com venda antes das 10h e roteiro ainda sem check-in. Em 13/10 isso descartou vendas
    // reais (TBE 312 R$ 8,6 mil, TCG 476, TBL 186...) e nenhum gol saiu o dia todo. Agora so zera se o 'dia' for IGUAL ao de um dia anterior ja gravado na base (dado velho de verdade).
    if (!rotaAntiga && hm < '10:00' && prod && prod.dia && Array.isArray(rot) && rot.length > 0 && !rot.some((c) => c.checkin_horario) && (Number(prod.dia.visitas_na_rota) > 0 || Number(prod.dia.dig_pedido) > 0 || Number(prod.dia.positivacao) > 0)) {
      let igualAnterior = true;   // sem como comparar (sem banco/sem historico): mantem o comportamento antigo
      if (env && env.DB) {
        try {
          const { results: ant } = await env.DB.prepare(
            "SELECT CAST(COALESCE(json_extract(produtividade_json,'$.dia.dig_pedido'),0) AS REAL) AS dig, CAST(COALESCE(json_extract(produtividade_json,'$.dia.positivacao'),0) AS REAL) AS pos, CAST(COALESCE(json_extract(produtividade_json,'$.dia.visitas_na_rota'),0) AS REAL) AS vis FROM varredura_central_rca WHERE rca_codigo = ? AND data_ref < ? AND data_ref >= date(?, '-7 days')"
          ).bind(String(id), hojeSP, hojeSP).all();
          if (ant && ant.length) {
            const d = Math.round(Number(prod.dia.dig_pedido) || 0), p = Number(prod.dia.positivacao) || 0, v = Number(prod.dia.visitas_na_rota) || 0;
            igualAnterior = ant.some((r) => Math.round(r.dig) === d && r.pos === p && r.vis === v);
          }
        } catch { igualAnterior = true; }
      }
      if (igualAnterior) { prod = { ...prod, dia: { ...prod.dia, faturamento: 0, positivacao: 0, dig_pedido: 0, visitas_na_rota: 0, visitas_com_venda: 0, eficacia_pct: 0 } }; rotaAntiga = true; }
    } }
  // G03 (Dobrou o Mix) e V03 (Bonificação): só para clientes positivados HOJE (evita 1 chamada
  // extra por cliente da rota inteira — geralmente são poucos positivados por dia, não os 10-20+
  // da rota completa).
  const positivadosHoje = Array.isArray(rot) ? rot.filter((c) => ['POSITIVADO', 'EFETIVADO'].includes(c.status)) : [];
  const analisePorCliente = {};
  if (positivadosHoje.length) {
    // CACHE DE 20 MIN NO D1 (11/10/2026): sem cache, cada TV aberta e o coletor de lances (a cada 5 min) buscavam o historico de TODO cliente positivado do dia
    // no CEVEN -- milhares de chamadas por rodada, o maior consumidor da cota da chave (o CEVEN passou a responder 429 para todo mundo). Agora o mesmo cliente
    // so volta ao CEVEN depois de 20 min, venha o pedido da TV, da Matriz ou do coletor. Falha do CEVEN nunca entra no cache.
    const dia = dataHojeBrasilia();
    const chaveCache = (c) => `${key}|${id}|${c.id_cliente}|${dia}|${canalVend}`;
    const emCache = new Map();
    if (env && env.DB) {
      try {
        await env.DB.prepare('CREATE TABLE IF NOT EXISTS cache_analise_cliente (chave TEXT PRIMARY KEY, json TEXT, criado_em INTEGER NOT NULL)').run();
        const chaves = positivadosHoje.map(chaveCache);
        const { results } = await env.DB.prepare(`SELECT chave, json FROM cache_analise_cliente WHERE criado_em > ? AND chave IN (${chaves.map(() => '?').join(',')})`)
          .bind(Date.now() - 20 * 60 * 1000, ...chaves).all();
        for (const r of results || []) emCache.set(r.chave, r.json);
      } catch { /* sem cache: segue ao vivo */ }
    }
    // CEVEN acabou de falhar nesta leitura: nao abre mais chamadas de historico agora (so o cache); os gols desses clientes saem na proxima rodada
    const faltam = usarCentral && cevenFalhou ? [] : positivadosHoje.filter((c) => !emCache.has(chaveCache(c)));
    const catalogo = faltam.length ? await carregaCatalogo(request) : null;
    // na coleta central, o primeiro historico que travar encerra os demais desta leitura (15/10/2026: 4 travamentos seguidos = 32 s num vendedor); ficam para a proxima rodada
    let travou = false;
    const buscas = faltam.map((c) => async () => {
      if (travou) return null;
      const r = await getJson(`${CEVEN}/api/rca/historico-cliente/${c.id_cliente}?${q}`, usarCentral ? 8000 : 20000);
      if (r == null && usarCentral) travou = true;
      return r;
    });
    // pela coleta de lances (central=1): no maximo 2 simultaneas; na tela da TV segue como antes
    const resultados = usarCentral ? await poolLimitado(buscas, 2) : await Promise.all(buscas.map((f) => f()));
    const novos = [];
    faltam.forEach((c, i) => {
      if (resultados[i] == null) return;   // CEVEN falhou: nao guarda
      const analise = analisaPedido(resultados[i], catalogo, id, dataHojeBrasilia(), canalVend);
      emCache.set(chaveCache(c), JSON.stringify(analise || null));
      novos.push([chaveCache(c), JSON.stringify(analise || null)]);
    });
    if (novos.length && env && env.DB) {
      try {
        await env.DB.batch(novos.map(([k, j]) => env.DB.prepare('INSERT INTO cache_analise_cliente (chave, json, criado_em) VALUES (?, ?, ?) ON CONFLICT (chave) DO UPDATE SET json = excluded.json, criado_em = excluded.criado_em').bind(k, j, Date.now())));
        if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM cache_analise_cliente WHERE criado_em < ?').bind(Date.now() - 2 * 86400000).run();
      } catch { /* cache e so economia: falha aqui nao muda a resposta */ }
    }
    positivadosHoje.forEach((c) => {
      let analise = null;
      try { analise = JSON.parse(emCache.get(chaveCache(c)) || 'null'); } catch {}
      if (analise) analisePorCliente[c.id_cliente] = analise;
    });
  }
  const saida = montarTv(id, dash, prod, rot, analisePorCliente);
  saida.rota_antiga = rotaAntiga; // true = o CEVEN ainda servia dado de ontem: esta leitura nao gera lance
  // Industrias do DIA do vendedor (uniao dos pedidos de hoje): base do nivel dos gols que nao sao de um cliente so (Super Pedido, Goleada, Relampago, Hat-Trick...)
  const somaDia = (campo) => { const m = new Map(); Object.values(analisePorCliente).forEach((a) => (a[campo] || []).forEach((x) => m.set(x.n, (m.get(x.n) || 0) + x.v))); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ n, v: Math.round(v * 100) / 100 })); };
  saida.industrias_dia = somaDia('industrias'); saida.categorias_dia = somaDia('categorias');
  return new Response(JSON.stringify(saida), { headers: cors });
}
