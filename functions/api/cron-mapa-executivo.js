// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: lê roteiro-hoje/produtividade de TODOS os RCAs ativos a partir da varredura central
//          (varredura_central_rca, ver ETAPA 2 abaixo — não chama mais o CEVEN direto aqui).
//          Grava dois resultados no D1:
//          1) mapa_executivo_live: clientes com lat/lon, para o mapa da TV Executiva.
//          2) resumo_executivo_live: agregados do dia (visitas, pedidos, digitado) por
//             filial + 'TODAS' nacional, para os cards "Visitas em Campo Hoje" e
//             "Pedidos Colocados" (que antes ficavam pregados em 0 — achado em 28/09/2026).
//          Substitui a dependência do SQLite local + Google Drive por dado 100% online
//          (ver PREMISSA_ONLINE.md).
// PROJETO: CFTV/TV. Isolado do pipeline do WhatsApp (pipeline/2_abertura_diaria.js) —
//          não grava em roteiros_visitas nem em nenhuma tabela usada pelos disparos.
// COMO RODA: chamado por GET /api/cron-mapa-executivo (sem parâmetro) pela própria
//          public/tv_executiva.html quando o cache no D1 está velho (>3min), OU por um
//          gatilho externo (GitHub Actions/Cloudflare Cron) se quisermos desacoplar do
//          tráfego da TV no futuro.
// REGRA: nunca inventa dado. Cliente sem latitude/longitude na resposta do CEVEN é
//          simplesmente ignorado no mapa (não entra) — nunca usamos coordenada aproximada.
//          Contadores de visita/pedido contam TODO cliente do roteiro, com ou sem lat/lon.
// CLIENTES RECORRENCIA (03/10/2026, decisao do Vitorio; substitui o antigo "Ouro na Mesa"): cliente do roteiro-hoje com a TAG
//          RECORRENCIA em focos[].industria_foco. Os "resgatados" sao os que tem a tag e POSITIVARAM hoje; para cada um busca o
//          valor real do pedido em /api/rca/historico-cliente/{id} (soma de skus[].total da visita mais recente).
// CANAL/COBRANÇA DE ROTA (decisão do Vitório, 28/09/2026 — vale para os 3 projetos: TV/CFTV,
//          WhatsApp (já implementado em pipeline/ceven_unified_engine.js CANAIS_VAREJO) e TV
//          Executiva): só entram nos agregados de VISITA/POSITIVAÇÃO os canais de campo — VJ,
//          PET VJ, FARMA, ESP. AS/PET AS (grandes contas, sem cobrança de roteiro) e GER/SUP
//          (gestão) NUNCA contam aqui. Canal vem da Gestao de Equipe (/api/tv-mostra),
//          mesma fonte que matrizapp.html/tvapp.html já usam — o D1 (representantes.setor) está
//          vazio, então usamos essa lista em vez dele.
// FATURADO/META DO MÊS: NÃO é calculado aqui. Fica em cron-faturado-mes.js.
// ETAPA 2 DA UNIFICAÇÃO (29/09/2026, decisão do Vitório: "não é tudo a mesma base? se deixar
//          tudo na mesma consulta facilita"): roteiro-hoje e produtividade agora vêm de
//          varredura_central_rca (migration 0006, gravada por cron-varredura-central.js) em vez
//          de chamar o CEVEN direto pra cada RCA — a central já fez essa mesma chamada. Se a
//          central estiver velha (>6min), este cron dispara ela primeiro (best-effort, sem
//          esperar) e usa o dado que tiver disponível no momento — nunca trava esperando a
//          central terminar. historico-cliente (resgate ouro, ticket médio) continua chamado
//          direto: é seletivo, não está centralizado (ver ficha de cron-varredura-central.js).
// =========================================================================

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const HDR = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };
const LOTE = 6; // chamadas simultaneas ao CEVEN (limite pratico de 6, decisao de 03/10/2026; antes 40)

async function getJson(url) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}

function dataHojeBrasilia() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  return `${p.year}-${p.month}-${p.day}`;
}

const CANAIS_CAMPO = ['VJ', 'PET VJ', 'FARMA', 'ESP']; // cobrança de rota/visita — ver ficha do arquivo
// rca (codigo) -> canal, direto da Gestao de Equipe (mesma fonte que matrizapp.html/tvapp.html).
async function carregaCanalPorRca(env, request) {
  const mapa = new Map();
  const ocultos = new Set();
  try {
    const url = new URL(request.url);
    const r = await fetch(`${url.origin}/api/tv-mostra`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return mapa;
    const d = await r.json();
    const filiais = d?.filiais || {};
    for (const lista of Object.values(filiais)) {
      if (!Array.isArray(lista)) continue;
      for (const v of lista) {
        if (v && v.rca != null) {
          mapa.set(String(v.rca), String(v.canal || '').toUpperCase());
          if (v.mostra === false) ocultos.add(String(v.rca));
        }
      }
    }
  } catch {}
  mapa.ocultos = ocultos; // RCAs que a equipe oculta (mostra:false): fora da contagem de recorrencia
  return mapa;
}

export async function onRequestGet({ env, request, waitUntil }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 (env.DB) não configurado' }), { status: 503, headers: cors });

  const t0 = Date.now();
  const dataRef = dataHojeBrasilia();
  const forcar = new URL(request.url).searchParams.has('forcar');

  // Não refaz a varredura se já rodou há menos de 2 minutos (evita sobrecarregar o CEVEN
  // com pedidos concorrentes vindos de várias TVs abrindo ao mesmo tempo).
  if (!forcar) {
    const ultima = await env.DB.prepare(
      'SELECT MAX(updated_at) as u FROM mapa_executivo_live WHERE data_ref = ?'
    ).bind(dataRef).first();
    if (ultima && ultima.u) {
      const idadeMs = Date.now() - new Date(ultima.u + 'Z').getTime();
      if (idadeMs < 2 * 60 * 1000) {
        return new Response(JSON.stringify({ status: 'CACHE_FRESCO', idade_s: Math.round(idadeMs / 1000) }), { headers: cors });
      }
    }
  }

  // WhatsApp tem prioridade (decisão do Vitório, 29/09/2026): pula este ciclo se o WhatsApp
  // estiver varrendo RCAs agora — nunca duas varreduras completas batendo no CEVEN ao mesmo
  // tempo. Ver functions/api/cron-lock.js.
  if (!forcar) {
    const lock = await env.DB.prepare(
      "SELECT dono, criado_em FROM cron_lock_global WHERE id = 1"
    ).first().catch(() => null);
    if (lock) {
      const idadeLockMs = Date.now() - new Date(lock.criado_em + 'Z').getTime();
      if (idadeLockMs < 20 * 60 * 1000) {
        return new Response(JSON.stringify({ status: 'PULADO_WHATSAPP_ATIVO', dono: lock.dono, idade_lock_s: Math.round(idadeLockMs / 1000) }), { headers: cors });
      }
    }
  }

  // Dispara a varredura central se estiver velha (best-effort, não espera) — mesma lógica que já
  // existia aqui antes pra si mesmo, agora aponta pro endpoint central que outros consumidores
  // também usam.
  const url = new URL(request.url);
  const disparoCentral = fetch(`${url.origin}/api/cron-varredura-central`, { signal: AbortSignal.timeout(25000) }).catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(disparoCentral);

  const { results: linhasCentral } = await env.DB.prepare(
    'SELECT rca_codigo, filial_sigla, roteiro_json, produtividade_json FROM varredura_central_rca WHERE data_ref = ?'
  ).bind(dataRef).all();

  if (!linhasCentral || !linhasCentral.length) {
    return new Response(JSON.stringify({ erro: 'varredura_central_rca ainda sem dado hoje — aguardando primeiro ciclo', dica: 'GET /api/cron-varredura-central' }), { status: 202, headers: cors });
  }

  const rcas = linhasCentral.map((l) => ({ codigo: l.rca_codigo, filial: l.filial_sigla }));

  const pontos = [];
  let falhas = 0;
  const STATUS_POSITIVADO = ['POSITIVADO', 'EFETIVADO'];
  const STATUS_VISITADO = ['POSITIVADO', 'EFETIVADO', 'VISITADO', 'JUSTIFICADO']; // != AGENDADO/ABERTO (ainda não passou lá)
  // Agregados por filial + 'TODAS' (nacional) — mesma varredura, zero custo extra de rede.
  const agg = {}; // filial -> {feitas, rota, comVenda, semVenda, pedidos, digitado, rcasComVenda, resgatados, valorResgatado, somaSkus, somaValorPedidos, nPedidosComSku, mesFaturado, mesMetaFaturado, mesPositivados, mesMetaPositivados}
  const pega = (sig) => (agg[sig] = agg[sig] || { feitas: 0, rota: 0, comVenda: 0, semVenda: 0, pedidos: 0, digitado: 0, rcasComVenda: 0, resgatados: 0, valorResgatado: 0, somaSkus: 0, somaValorPedidos: 0, nPedidosComSku: 0, mesFaturado: 0, mesMetaFaturado: 0, mesPositivados: 0, mesMetaPositivados: 0 });
  // RECORRENCIA (decisao do Vitorio, 03/10/2026): substitui o antigo "Ouro na Mesa" (lista estatica de setembro).
  // Cliente de recorrencia = o roteiro-hoje do CEVEN traz a TAG RECORRENCIA em focos[].industria_foco (mesma regra da TV da filial).
  // As colunas eh_ouro / eh_resgate_ouro do D1 mantem o nome (schema compartilhado), mas passam a significar: eh_ouro = tem a tag; eh_resgate_ouro = tem a tag e positivou hoje.
  const ehRecorrencia = (c) => Array.isArray(c.focos) && c.focos.some((f) => String(f?.industria_foco || '').toUpperCase().includes('RECORRENCIA'));
  const canalPorRca = await carregaCanalPorRca(env, request);
  // RECORRENCIA na rota (04-05/10/2026): conta TODO cliente da rota de hoje com a tag, COM OU SEM coordenada
  // (antes so entrava quem tinha latitude/longitude: 818 no mapa contra 865 reais). Vendedor oculto pela equipe fica fora.
  const rec = {};
  const pegaRec = (s) => (rec[s] = rec[s] || { naRota: 0, positivados: 0, pedidosCampo: 0 });
  const candidatosResgate = []; // {cnpj, sig, rca, filialKey} — subconjunto de POSITIVADOS que também é resgate de ouro
  // Todo cliente POSITIVADO hoje de canal de campo entra aqui — usado pra calcular Ticket Médio e
  // Média de SKUs REAIS (via historico-cliente, roteiro-hoje não traz esses valores). Decisão do
  // Vitório, 28/09/2026: aceitar o custo extra de tempo (mais chamadas) pra ter esses 2 cards
  // (antes sempre "0,0" / "R$ 0", nunca alimentados) com dado real em vez de "—" pra sempre.
  const candidatosPositivados = []; // {idCli, sig, filialKey, rcaCodigo}

  // roteiro-hoje/produtividade já vêm prontos da varredura central (linhasCentral) — sem chamada
  // nova ao CEVEN aqui. LOTE não controla mais concorrência de rede (é tudo leitura de memória),
  // só divide o trabalho de agregação em pedaços, mantido pra não mudar o formato do código à toa.
  for (const l of linhasCentral) {
    const rca = { codigo: l.rca_codigo, filial: l.filial_sigla };
    let roteiro = null, prod = null;
    try { roteiro = JSON.parse(l.roteiro_json); } catch {}
    try { prod = JSON.parse(l.produtividade_json); } catch {}
    {
      if (!Array.isArray(roteiro)) { falhas++; continue; }
      const sig = String(rca.filial || '').toUpperCase();
      // Só entra nos agregados de visita/positivação se for canal de campo (VJ/PET VJ/FARMA/ESP)
      // — AS/PET AS/GER/SUP não têm cobrança de rota (ver ficha do arquivo, decisão 28/09/2026).
      const canalRca = canalPorRca.get(String(rca.codigo)) || '';
      // Vendedor OCULTO pela equipe (mostra:false) nao entra nos KPIs de campo (mesma regra das outras telas)
      const ocultoRca = !!(canalPorRca.ocultos && canalPorRca.ocultos.has(String(rca.codigo)));
      const ehCampo = CANAIS_CAMPO.includes(canalRca) && !ocultoRca;
      const aFil = ehCampo ? pega(sig) : null, aNac = ehCampo ? pega('TODAS') : null;
      // PEDIDOS COLOCADOS e VALOR DIGITADO entram de TODOS os vendedores, de qualquer canal (decisao do Vitorio,
      // 05/10/2026: "pedidos entra de tudo, a empresa quer saber de tudo"). Pedido digitado hoje = produtividade.dia.positivacao
      // (rota + FORA da rota). Ja VISITA, rota, positivacao de visita e eficacia continuam so do varejo (campo), porque o AS
      // pode visitar hoje e tirar o pedido so na semana seguinte: KPI de visita nao serve para ele.
      const digPedidoRca = Number(prod?.dia?.dig_pedido) || 0;
      const pedDigRca = Number(prod?.dia?.positivacao) || 0;
      { const aF = pega(sig), aN = pega('TODAS');
        aF.digitado += digPedidoRca; aN.digitado += digPedidoRca;
        aF.pedidos += pedDigRca; aN.pedidos += pedDigRca; }
      if (ehCampo) { pegaRec(sig).pedidosCampo += pedDigRca; pegaRec('TODAS').pedidosCampo += pedDigRca; } // so para a media pedidos/visita
      // VISITAS = contadores oficiais do CEVEN (produtividade.dia), os mesmos do app do vendedor: total_programado, visitas_na_rota,
      // visitas_com_venda. Antes a Executiva contava por status do roteiro e a Matriz contava outro jeito (incluia FORA_ROTA).
      if (ehCampo) {
        const dia = prod?.dia || {};
        const prog = Number(dia.total_programado) || 0, naRota = Number(dia.visitas_na_rota) || 0, comV = Number(dia.visitas_com_venda) || 0;
        aFil.rota += prog; aNac.rota += prog; aFil.feitas += naRota; aNac.feitas += naRota; aFil.comVenda += comV; aNac.comVenda += comV;
      }
      let rcaTeveVenda = false;
      for (const c of roteiro) {
        const status = String(c.status || '').toUpperCase();
        if (!ocultoRca && ehRecorrencia(c)) {
          pegaRec(sig).naRota++; pegaRec('TODAS').naRota++;
          if (STATUS_POSITIVADO.includes(status)) { pegaRec(sig).positivados++; pegaRec('TODAS').positivados++; }
        }
        if (ehCampo) {
          if (STATUS_POSITIVADO.includes(status)) {
            rcaTeveVenda = true;
          } else if (status === 'JUSTIFICADO' || (STATUS_VISITADO.includes(status) && c.motivo_nao_visita)) {
            aFil.semVenda++; aNac.semVenda++;
          }
        }
        if (STATUS_POSITIVADO.includes(status)) {
          const idCli = String(c.id_cliente || c.id || c.codcli || '');
          // Resgate de "Ouro na Mesa" conta pra QUALQUER canal que tenha vendido (não só campo) —
          // é sobre recuperar um cliente parado, não sobre cobrança de rota.
          if (idCli && ehRecorrencia(c)) {
            candidatosResgate.push({ idCli, sig, filialKey: `${sig.toLowerCase()}1`, rcaCodigo: String(rca.codigo) });
          }
          // Ticket Médio / Média de SKUs: só canal de campo, mesma regra dos agregados de rota.
          if (ehCampo && idCli) {
            candidatosPositivados.push({ idCli, sig, filialKey: `${sig.toLowerCase()}1`, rcaCodigo: String(rca.codigo) });
          }
        }

        const lat = Number(c.latitude), lon = Number(c.longitude);
        if (!lat || !lon || Number.isNaN(lat) || Number.isNaN(lon)) continue; // sem coordenada real: fica de fora do mapa
        const idCliente = String(c.id_cliente || c.id || c.codcli || '');
        if (!idCliente) continue;
        const ehOuro = ehRecorrencia(c);
        pontos.push({
          idCliente,
          cnpj: c.cnpj || null,
          nome: c.razao_social || c.nome_cliente || c.nome || null,
          cidade: c.municipio || c.cidade || null,
          filial: sig,
          rca: String(rca.codigo),
          lat, lon,
          status: c.status || 'AGENDADO',
          valor: Number(c.valor_ultima_compra || 0) || 0, // histórico do cliente (não é o pedido de hoje) — só usado como referência no card "Venda Expressiva"
          // Está na lista "Ouro na Mesa" do mês (visitado sem venda), independente de ter vendido
          // hoje ou não — alimenta a camada OURO do mapa. ehResgateOuro (abaixo) é o subconjunto
          // que JÁ vendeu hoje (resgatado).
          ehOuro: ehOuro ? 1 : 0,
          ehResgateOuro: STATUS_POSITIVADO.includes(status) && ehOuro ? 1 : 0
        });
      }
      if (ehCampo && rcaTeveVenda) { aFil.rcasComVenda++; aNac.rcasComVenda++; }
    }
  }

  if (!pontos.length) {
    return new Response(JSON.stringify({ erro: 'CEVEN não devolveu nenhum cliente com coordenada válida', falhas_rca: falhas, rcas_total: rcas.length }), { status: 502, headers: cors });
  }

  // Valor real do pedido + SKUs de cada cliente POSITIVADO hoje, via historico-cliente (roteiro-
  // hoje não traz esses valores — só o histórico do cliente tem). candidatosPositivados já inclui
  // todo resgate de ouro (resgate exige POSITIVADO), então 1 chamada serve pros dois cálculos —
  // não duplica historico-cliente pro mesmo cliente duas vezes.
  const idsResgate = new Set(candidatosResgate.map((c) => c.idCli + '|' + c.sig));
  for (let i = 0; i < candidatosPositivados.length; i += LOTE) {
    const lote = candidatosPositivados.slice(i, i + LOTE);
    const historicos = await Promise.all(
      lote.map((cand) => getJson(`${CEVEN}/api/rca/historico-cliente/${cand.idCli}?filial=${cand.filialKey}&id=${cand.rcaCodigo}`))
    );
    lote.forEach((cand, idx) => {
      const hist = historicos[idx];
      const visitaAtual = Array.isArray(hist?.ultimas_visitas) ? hist.ultimas_visitas[0] : null;
      const skus = Array.isArray(visitaAtual?.skus) ? visitaAtual.skus : [];
      const valorPedido = skus.reduce((soma, item) => soma + (Number(item.total) || 0), 0);
      const aFil = pega(cand.sig), aNac = pega('TODAS');
      if (skus.length) {
        aFil.somaSkus += skus.length; aNac.somaSkus += skus.length;
        aFil.somaValorPedidos += valorPedido; aNac.somaValorPedidos += valorPedido;
        aFil.nPedidosComSku++; aNac.nPedidosComSku++;
      }
      if (idsResgate.has(cand.idCli + '|' + cand.sig)) {
        aFil.resgatados++; aNac.resgatados++;
        aFil.valorResgatado += valorPedido; aNac.valorResgatado += valorPedido;
      }
    });
  }

  // Grava em lotes (D1 batch) — apaga o snapshot antigo do dia e insere o novo, tudo em uma
  // transação por lote (evita ficar com metade dado velho / metade novo se cair no meio).
  await env.DB.prepare('DELETE FROM mapa_executivo_live WHERE data_ref = ?').bind(dataRef).run();
  const TAM_BATCH = 80;
  for (let i = 0; i < pontos.length; i += TAM_BATCH) {
    const fatia = pontos.slice(i, i + TAM_BATCH);
    const stmts = fatia.map((p) =>
      env.DB.prepare(
        `INSERT OR REPLACE INTO mapa_executivo_live
         (id_cliente, cnpj, nome_cliente, cidade, filial_sigla, rca_codigo, latitude, longitude, status, valor_pedido, eh_resgate_ouro, eh_ouro, data_ref, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(p.idCliente, p.cnpj, p.nome, p.cidade, p.filial, p.rca, p.lat, p.lon, p.status, p.valor, p.ehResgateOuro, p.ehOuro, dataRef)
    );
    await env.DB.batch(stmts);
  }

  // NAO apaga a linha do dia: as colunas mes_* (faturado/meta/positivados do MES) sao gravadas por cron-faturado-mes e eram ZERADAS
  // aqui a cada rodada (a TV Executiva mostrava R$ 0 e 0% da meta; 05/10/2026). UPSERT so das colunas do dia.
  const stmtsResumo = Object.entries(agg).map(([sig, a]) =>
    env.DB.prepare(
      `INSERT INTO resumo_executivo_live
       (filial_sigla, data_ref, visitas_feitas, visitas_rota, com_venda, sem_venda, pedidos_hoje, digitado_hoje, vendedores_com_venda, resgatados_hoje, valor_resgatado_hoje, soma_skus, soma_valor_pedidos, n_pedidos_com_sku, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (filial_sigla, data_ref) DO UPDATE SET
         visitas_feitas = excluded.visitas_feitas, visitas_rota = excluded.visitas_rota, com_venda = excluded.com_venda, sem_venda = excluded.sem_venda,
         pedidos_hoje = excluded.pedidos_hoje, digitado_hoje = excluded.digitado_hoje, vendedores_com_venda = excluded.vendedores_com_venda,
         resgatados_hoje = excluded.resgatados_hoje, valor_resgatado_hoje = excluded.valor_resgatado_hoje, soma_skus = excluded.soma_skus,
         soma_valor_pedidos = excluded.soma_valor_pedidos, n_pedidos_com_sku = excluded.n_pedidos_com_sku, updated_at = CURRENT_TIMESTAMP`
    ).bind(sig, dataRef, a.feitas, a.rota, a.comVenda, a.semVenda, a.pedidos, a.digitado, a.rcasComVenda, a.resgatados, a.valorResgatado, a.somaSkus, a.somaValorPedidos, a.nPedidosComSku)
  );
  if (stmtsResumo.length) await env.DB.batch(stmtsResumo);

  // Recorrencia na rota por filial (tabela propria, criada aqui se nao existir)
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS recorrencia_resumo_live (filial_sigla TEXT NOT NULL, data_ref TEXT NOT NULL, na_rota INTEGER NOT NULL DEFAULT 0, positivados INTEGER NOT NULL DEFAULT 0, pedidos_campo INTEGER NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (filial_sigla, data_ref))').run();
    try { await env.DB.prepare('ALTER TABLE recorrencia_resumo_live ADD COLUMN pedidos_campo INTEGER NOT NULL DEFAULT 0').run(); } catch (e) { /* coluna ja existe */ }
    await env.DB.prepare('DELETE FROM recorrencia_resumo_live WHERE data_ref = ?').bind(dataRef).run();
    const stmtsRec = Object.entries(rec).map(([sig, a]) =>
      env.DB.prepare('INSERT OR REPLACE INTO recorrencia_resumo_live (filial_sigla, data_ref, na_rota, positivados, pedidos_campo, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(sig, dataRef, a.naRota, a.positivados, a.pedidosCampo));
    if (stmtsRec.length) await env.DB.batch(stmtsRec);
  } catch (e) { /* sem tabela de recorrencia a TV cai para a contagem do mapa */ }

  return new Response(JSON.stringify({
    status: 'ATUALIZADO',
    data_ref: dataRef,
    rcas_processados: rcas.length,
    rcas_sem_resposta: falhas,
    pontos_gravados: pontos.length,
    duracao_ms: Date.now() - t0
  }), { headers: cors });
}
