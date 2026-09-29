// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: varre TODOS os RCAs ativos (D1: tabela representantes) chamando
//          /api/rca/roteiro-hoje do CEVEN ao vivo. Grava dois resultados no D1:
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
// OURO NA MESA — RESGATADOS HOJE: cruza public/ouro_na_mesa_setembro.json (dataset mensal de
//          clientes visitados sem venda no mês) com os POSITIVADOS de hoje. Para cada resgate,
//          busca o valor real do pedido em /api/rca/historico-cliente/{id} (soma de skus[].total
//          da visita mais recente — roteiro-hoje NÃO traz esse valor, só o histórico do cliente).
// CANAL/COBRANÇA DE ROTA (decisão do Vitório, 28/09/2026 — vale para os 3 projetos: TV/CFTV,
//          WhatsApp (já implementado em pipeline/ceven_unified_engine.js CANAIS_VAREJO) e TV
//          Executiva): só entram nos agregados de VISITA/POSITIVAÇÃO os canais de campo — VJ,
//          PET VJ, FARMA, ESP. AS/PET AS (grandes contas, sem cobrança de roteiro) e GER/SUP
//          (gestão) NUNCA contam aqui. Canal vem da planilha MOSTRA_DISPAROS (/api/tv-mostra),
//          mesma fonte que matrizapp.html/tvapp.html já usam — o D1 (representantes.setor) está
//          vazio, então usamos essa lista em vez dele.
// FATURADO/META DO MÊS (migration 0005, 29/09/2026): antes a TV Executiva lia
//          public/executiva_resumo_mes.json, um arquivo estático nunca atualizado sozinho (achado
//          29/09/2026: mostrava faturamento de 2 dias atrás pro diretor). Agora, na MESMA
//          varredura, cada RCA também chama /api/rca/dashboard (igual tv-vendedor.js já faz) e
//          soma financeiro.faturado/meta + positivacao.realizado/meta por filial + 'TODAS'. TODO
//          RCA conta aqui (não só canal de campo) — faturado é da filial inteira, não só rota.
// =========================================================================

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const HDR = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };
const LOTE = 40; // RCAs em paralelo por vez — equilíbrio entre velocidade e não sobrecarregar o CEVEN

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

async function carregaCnpjsOuro(env, request) {
  try {
    const assetUrl = new URL('/ouro_na_mesa_setembro.json', request.url);
    const r = env.ASSETS ? await env.ASSETS.fetch(new Request(assetUrl)) : await fetch(assetUrl, { cache: 'no-store' });
    if (!r.ok) return new Set();
    const d = await r.json();
    return new Set(Array.isArray(d.cnpjsOuro) ? d.cnpjsOuro : []);
  } catch {
    return new Set();
  }
}

const CANAIS_CAMPO = ['VJ', 'PET VJ', 'FARMA', 'ESP']; // cobrança de rota/visita — ver ficha do arquivo
// rca (codigo) -> canal, direto da planilha MOSTRA_DISPAROS (mesma fonte que matrizapp.html/tvapp.html).
async function carregaCanalPorRca(env, request) {
  const mapa = new Map();
  try {
    const url = new URL(request.url);
    const r = await fetch(`${url.origin}/api/tv-mostra`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return mapa;
    const d = await r.json();
    const filiais = d?.filiais || {};
    for (const lista of Object.values(filiais)) {
      if (!Array.isArray(lista)) continue;
      for (const v of lista) {
        if (v && v.rca != null) mapa.set(String(v.rca), String(v.canal || '').toUpperCase());
      }
    }
  } catch {}
  return mapa;
}

export async function onRequestGet({ env, request }) {
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

  const { results: rcas } = await env.DB.prepare(
    'SELECT r.codigo, UPPER(COALESCE(f.codigo, r.filial_id)) as filial FROM representantes r LEFT JOIN filiais f ON r.filial_id = f.id WHERE r.ativo = 1'
  ).all();

  if (!rcas || !rcas.length) {
    return new Response(JSON.stringify({ erro: 'nenhum representante ativo encontrado no D1' }), { status: 502, headers: cors });
  }

  const pontos = [];
  let falhas = 0;
  const STATUS_POSITIVADO = ['POSITIVADO', 'EFETIVADO'];
  const STATUS_VISITADO = ['POSITIVADO', 'EFETIVADO', 'VISITADO', 'JUSTIFICADO']; // != AGENDADO/ABERTO (ainda não passou lá)
  // Agregados por filial + 'TODAS' (nacional) — mesma varredura, zero custo extra de rede.
  const agg = {}; // filial -> {feitas, rota, comVenda, semVenda, pedidos, digitado, rcasComVenda, resgatados, valorResgatado, somaSkus, somaValorPedidos, nPedidosComSku, mesFaturado, mesMetaFaturado, mesPositivados, mesMetaPositivados}
  const pega = (sig) => (agg[sig] = agg[sig] || { feitas: 0, rota: 0, comVenda: 0, semVenda: 0, pedidos: 0, digitado: 0, rcasComVenda: 0, resgatados: 0, valorResgatado: 0, somaSkus: 0, somaValorPedidos: 0, nPedidosComSku: 0, mesFaturado: 0, mesMetaFaturado: 0, mesPositivados: 0, mesMetaPositivados: 0 });
  const cnpjsOuro = await carregaCnpjsOuro(env, request);
  const canalPorRca = await carregaCanalPorRca(env, request);
  const candidatosResgate = []; // {cnpj, sig, rca, filialKey} — subconjunto de POSITIVADOS que também é resgate de ouro
  // Todo cliente POSITIVADO hoje de canal de campo entra aqui — usado pra calcular Ticket Médio e
  // Média de SKUs REAIS (via historico-cliente, roteiro-hoje não traz esses valores). Decisão do
  // Vitório, 28/09/2026: aceitar o custo extra de tempo (mais chamadas) pra ter esses 2 cards
  // (antes sempre "0,0" / "R$ 0", nunca alimentados) com dado real em vez de "—" pra sempre.
  const candidatosPositivados = []; // {idCli, sig, filialKey, rcaCodigo}

  for (let i = 0; i < rcas.length; i += LOTE) {
    const lote = rcas.slice(i, i + LOTE);
    const resultados = await Promise.all(
      lote.map(async (rca) => {
        const filialKey = String(rca.filial || '').toLowerCase() + '1';
        // roteiro-hoje: lista de clientes (status, lat/lon) para o mapa e contagem de visitas.
        // produtividade: dig_pedido = valor REAL digitado hoje pelo RCA (o roteiro NÃO traz esse
        // total — c.valor_ultima_compra é o histórico do cliente, não o pedido de hoje; usar ele
        // aqui sempre dava 0, achado em 28/09/2026). Mesma fonte que tv-vendedor.js já usa e que
        // o CFTV mostra correto.
        const [roteiro, prod, dash] = await Promise.all([
          getJson(`${CEVEN}/api/rca/roteiro-hoje?filial=${filialKey}&id=${rca.codigo}`),
          getJson(`${CEVEN}/api/rca/produtividade?filial=${filialKey}&id=${rca.codigo}`),
          getJson(`${CEVEN}/api/rca/dashboard?filial=${filialKey}&id=${rca.codigo}`)
        ]);
        return { rca, roteiro, prod, dash };
      })
    );
    for (const { rca, roteiro, prod, dash } of resultados) {
      if (!Array.isArray(roteiro)) { falhas++; continue; }
      const sig = String(rca.filial || '').toUpperCase();
      // Faturado/meta do MÊS: todo RCA soma aqui, é a filial inteira, não só canal de campo
      // (diferente dos agregados de visita/rota, que são só VJ/PET VJ/FARMA/ESP).
      {
        const aFilMes = pega(sig), aNacMes = pega('TODAS');
        const fat = Number(dash?.financeiro?.faturado) || 0;
        const metaFat = Number(dash?.financeiro?.meta) || 0;
        const pos = Number(dash?.positivacao?.realizado) || 0;
        const metaPos = Number(dash?.positivacao?.meta) || 0;
        aFilMes.mesFaturado += fat; aNacMes.mesFaturado += fat;
        aFilMes.mesMetaFaturado += metaFat; aNacMes.mesMetaFaturado += metaFat;
        aFilMes.mesPositivados += pos; aNacMes.mesPositivados += pos;
        aFilMes.mesMetaPositivados += metaPos; aNacMes.mesMetaPositivados += metaPos;
      }
      // Só entra nos agregados de visita/positivação se for canal de campo (VJ/PET VJ/FARMA/ESP)
      // — AS/PET AS/GER/SUP não têm cobrança de rota (ver ficha do arquivo, decisão 28/09/2026).
      const canalRca = canalPorRca.get(String(rca.codigo)) || '';
      const ehCampo = CANAIS_CAMPO.includes(canalRca);
      const aFil = ehCampo ? pega(sig) : null, aNac = ehCampo ? pega('TODAS') : null;
      if (ehCampo) {
        const digPedidoRca = Number(prod?.dia?.dig_pedido) || 0;
        aFil.digitado += digPedidoRca; aNac.digitado += digPedidoRca;
      }
      let rcaTeveVenda = false;
      for (const c of roteiro) {
        const status = String(c.status || '').toUpperCase();
        if (ehCampo) {
          aFil.rota++; aNac.rota++;
          if (STATUS_VISITADO.includes(status)) { aFil.feitas++; aNac.feitas++; }
          if (STATUS_POSITIVADO.includes(status)) {
            aFil.comVenda++; aNac.comVenda++; aFil.pedidos++; aNac.pedidos++;
            rcaTeveVenda = true;
          } else if (status === 'JUSTIFICADO' || (STATUS_VISITADO.includes(status) && c.motivo_nao_visita)) {
            aFil.semVenda++; aNac.semVenda++;
          }
        }
        if (STATUS_POSITIVADO.includes(status)) {
          const idCli = String(c.id_cliente || c.id || c.codcli || '');
          // Resgate de "Ouro na Mesa" conta pra QUALQUER canal que tenha vendido (não só campo) —
          // é sobre recuperar um cliente parado, não sobre cobrança de rota.
          const cnpjLimpo = String(c.cnpj || '').replace(/\D/g, '');
          if (idCli && cnpjLimpo && cnpjsOuro.has(cnpjLimpo)) {
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
        const cnpjLimpoPonto = String(c.cnpj || '').replace(/\D/g, '');
        const ehOuro = !!(cnpjLimpoPonto && cnpjsOuro.has(cnpjLimpoPonto));
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

  await env.DB.prepare('DELETE FROM resumo_executivo_live WHERE data_ref = ?').bind(dataRef).run();
  const stmtsResumo = Object.entries(agg).map(([sig, a]) =>
    env.DB.prepare(
      `INSERT OR REPLACE INTO resumo_executivo_live
       (filial_sigla, data_ref, visitas_feitas, visitas_rota, com_venda, sem_venda, pedidos_hoje, digitado_hoje, vendedores_com_venda, resgatados_hoje, valor_resgatado_hoje, soma_skus, soma_valor_pedidos, n_pedidos_com_sku, mes_faturado, mes_meta_faturado, mes_positivados, mes_meta_positivados, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(sig, dataRef, a.feitas, a.rota, a.comVenda, a.semVenda, a.pedidos, a.digitado, a.rcasComVenda, a.resgatados, a.valorResgatado, a.somaSkus, a.somaValorPedidos, a.nPedidosComSku, a.mesFaturado, a.mesMetaFaturado, a.mesPositivados, a.mesMetaPositivados)
  );
  if (stmtsResumo.length) await env.DB.batch(stmtsResumo);

  return new Response(JSON.stringify({
    status: 'ATUALIZADO',
    data_ref: dataRef,
    rcas_processados: rcas.length,
    rcas_sem_resposta: falhas,
    pontos_gravados: pontos.length,
    duracao_ms: Date.now() - t0
  }), { headers: cors });
}
