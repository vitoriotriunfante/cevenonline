// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: entrega à TV Executiva os pontos do mapa (clientes com lat/lon) E os agregados do
//          dia (visitas, pedidos, digitado por filial) lidos do D1 (mapa_executivo_live e
//          resumo_executivo_live, populados por cron-mapa-executivo.js). Sem SQLite local,
//          sem Google Drive, sem depender do PC de ninguém (PREMISSA_ONLINE.md).
// PROJETO: CFTV/TV. A varredura em si roda por fora, via GitHub Actions a cada 5min
//          (.github/workflows/tv-executiva-mapa-live.yml) — a varredura de 560 RCAs leva ~90s,
//          tempo demais para acoplar ao carregamento da TV (achado em 28/09/2026: o fetch sem
//          await daqui era cortado antes de terminar, e a TV nunca preenchia o D1 sozinha).
//          Aqui só LÊ o D1 (rápido) e dispara um fallback best-effort sem bloquear, caso o
//          cron externo esteja atrasado.
// FORMATO: shape do antigo public/mapa_pdvs_executiva.json (ouros/azul/verde) + campo novo
//          "resumo" ({TODAS:{...}, TBL:{...}, ...}) que alimenta os cards "Visitas em Campo
//          Hoje" e "Pedidos Colocados" (achado em 28/09/2026: ficavam pregados em 0).
// OURO NA MESA: cnpjsOuro (public/ouro_na_mesa_setembro.json, dataset mensal sem lat/lon) é
//          cruzado dentro de cron-mapa-executivo.js contra o roteiro-hoje ao vivo — os pontos
//          já vêm com coordenada real, sem precisar do SQLite/Drive (resolvido em 28/09/2026).
// =========================================================================

function dataHojeBrasilia() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  return `${p.year}-${p.month}-${p.day}`;
}

const STATUS_POSITIVADO = ['POSITIVADO', 'EFETIVADO'];

export async function onRequestGet({ env, request, waitUntil }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 (env.DB) não configurado' }), { status: 503, headers: cors });

  const dataRef = dataHojeBrasilia();

  // Dispara a atualização em segundo plano SEM esperar terminar — a varredura de 560 RCAs
  // pode levar minutos, e a TV não pode ficar travada esperando isso. O próprio
  // cron-mapa-executivo.js tem proteção de "cache fresco" (não refaz se rodou há <2min), então
  // chamar aqui sem aguardar é seguro: se já tiver uma varredura em andamento/recente, essa
  // chamada retorna rápido e não faz nada.
  const url = new URL(request.url);
  const disparo = fetch(`${url.origin}/api/cron-mapa-executivo`, { signal: AbortSignal.timeout(25000) }).catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(disparo); // garante que a varredura continue mesmo após a resposta ser enviada

  const [{ results: linhas }, { results: resumoRows }] = await Promise.all([
    env.DB.prepare(
      'SELECT id_cliente, cnpj, nome_cliente, cidade, filial_sigla, latitude, longitude, status, valor_pedido, eh_resgate_ouro, eh_ouro, updated_at FROM mapa_executivo_live WHERE data_ref = ?'
    ).bind(dataRef).all(),
    env.DB.prepare(
      'SELECT filial_sigla, visitas_feitas, visitas_rota, com_venda, sem_venda, pedidos_hoje, digitado_hoje, vendedores_com_venda, resgatados_hoje, valor_resgatado_hoje, soma_skus, soma_valor_pedidos, n_pedidos_com_sku, mes_faturado, mes_meta_faturado, mes_positivados, mes_meta_positivados, updated_at FROM resumo_executivo_live WHERE data_ref = ?'
    ).bind(dataRef).all()
  ]);

  const verde = [];
  const azul = [];
  const ouros = []; // clientes com a TAG RECORRENCIA no roteiro-hoje (03/10/2026: substitui o "Ouro na Mesa"; o nome do campo "ouros" foi mantido por compatibilidade)
  const resgates = []; // lista detalhada de clientes RECORRENCIA positivados hoje, pro card clicável
  for (const r of linhas || []) {
    const ponto = {
      lt: Math.round(r.latitude * 10000) / 10000,
      ln: Math.round(r.longitude * 10000) / 10000,
      f: r.filial_sigla,
      c: r.cnpj || r.id_cliente
    };
    if (r.eh_ouro) ouros.push(ponto);
    if (STATUS_POSITIVADO.includes(String(r.status).toUpperCase())) {
      azul.push(ponto);
      verde.push({ ...ponto, nome: r.nome_cliente, cidade: r.cidade, valor: r.valor_pedido || null });
      if (r.eh_resgate_ouro) resgates.push({ f: r.filial_sigla, nome: r.nome_cliente, cidade: r.cidade, c: r.cnpj || r.id_cliente });
    }
  }

  // Recorrencia na rota (todos os clientes da rota com a tag, com ou sem coordenada), gravada pelo cron do mapa
  const recorrencia = {};
  try {
    const { results: recRows } = await env.DB.prepare('SELECT filial_sigla, na_rota, positivados, pedidos_campo FROM recorrencia_resumo_live WHERE data_ref = ?').bind(dataRef).all();
    for (const r of recRows || []) recorrencia[r.filial_sigla] = { naRota: r.na_rota || 0, positivados: r.positivados || 0, pedidosCampo: r.pedidos_campo || 0 };
  } catch (e) { /* tabela ainda nao existe: a tela usa a contagem do mapa */ }

  const resumo = {};
  let atualizadoEmDados = null;
  for (const r of resumoRows || []) {
    const nPed = r.n_pedidos_com_sku || 0;
    resumo[r.filial_sigla] = {
      feitas: r.visitas_feitas, rota: r.visitas_rota, comVenda: r.com_venda, semVenda: r.sem_venda,
      pedidos: r.pedidos_hoje, digitado: r.digitado_hoje, vendedoresComVenda: r.vendedores_com_venda,
      resgatadosHoje: r.resgatados_hoje || 0, valorResgatadoHoje: r.valor_resgatado_hoje || 0,
      // Ticket Médio / Média de SKUs: real, calculado via historico-cliente (não estimativa) —
      // antes ficavam sempre "0,0"/"R$ 0" na TV Executiva, nunca alimentados (achado 28/09/2026).
      mediaSkus: nPed ? (r.soma_skus / nPed) : 0,
      ticketMedio: nPed ? (r.soma_valor_pedidos / nPed) : 0,
      // Faturado/Meta do MÊS ao vivo (migration 0005, 29/09/2026) — substitui
      // public/executiva_resumo_mes.json, que era estático e nunca se atualizava sozinho.
      mesFaturado: r.mes_faturado || 0,
      mesMetaFaturado: r.mes_meta_faturado || 0,
      mesPositivados: r.mes_positivados || 0,
      mesMetaPositivados: r.mes_meta_positivados || 0
    };
    if (!atualizadoEmDados || r.updated_at > atualizadoEmDados) atualizadoEmDados = r.updated_at;
  }

  return new Response(JSON.stringify({
    atualizadoEm: new Date().toISOString(),
    dadosAtualizadosEm: atualizadoEmDados,
    dataRef,
    totalAzul: azul.length,
    totalHoje: verde.length,
    ouros,
    azul,
    verde,
    resgates,
    recorrencia,
    resumo
  }), { headers: cors });
}
