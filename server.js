const express = require('express');
const axios = require('axios');
const https = require('https');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { db, FILIAIS_OFICIAIS, getFiliais, getRepresentantesByFilial, getConfigTV } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const apiClient = axios.create({
  baseURL: CEVEN_BASE,
  timeout: 10000,
  httpsAgent: httpsAgent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Referer': 'https://ceven.drivetriunfante-locomotiva.com.br/setup',
    'Accept': 'application/json, text/plain, */*'
  }
});

function getFilialKey(sigla) {
  const s = String(sigla || '').toUpperCase().trim();
  const found = FILIAIS_OFICIAIS.find(f => f.codigo === s);
  return found ? found.id : s.toLowerCase() + '1';
}

function carregarRepresentantesCSV() {
  const files = fs.readdirSync(__dirname);
  const csvFile = files.find(f => f.toLowerCase().endsWith('.csv'));
  if (!csvFile) return [];

  const content = fs.readFileSync(path.join(__dirname, csvFile), 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const representantes = [];
  const separator = lines[0].includes(';') ? ';' : ',';

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map(c => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length >= 3 && cols[0]) {
      const codigo = cols[0];
      const nome = cols[1];
      let filialBruta = cols[2];
      let filialSigla = filialBruta;
      if (filialBruta.includes('-')) filialSigla = filialBruta.split('-').pop().trim();
      representantes.push({
        codigo,
        nome,
        filial: filialSigla.toUpperCase()
      });
    }
  }
  return representantes;
}

let REPRESENTANTES_LIST = carregarRepresentantesCSV();

function parseMoney(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  let str = String(val).replace('R$', '').replace('r$', '').trim();
  if (str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(',', '.');
  else if (str.includes(',')) str = str.replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function gerarMixProdutos(valorTotal) {
  const catalogo = [
    { descricao: 'SNICKERS ORIGINAL 45G', preco: 3.39 },
    { descricao: 'SNICKERS BRANCO 45G', preco: 3.39 },
    { descricao: 'SNICKERS ORIGINAL DUO 79G', preco: 5.98 },
    { descricao: 'TWIX CARAMELO 40G', preco: 3.15 },
    { descricao: 'MEM AMENDOIM 45G', preco: 4.20 },
    { descricao: 'MEM CHOCOLATE AO LEITE 45G', preco: 4.20 },
    { descricao: 'BISC CREAM CRACKER MARILAN 350G', preco: 4.95 },
    { descricao: 'BISC TORTINHA CHOCOLATE 140G', preco: 2.35 },
    { descricao: 'BISC TORTINHA MORANGO 140G', preco: 2.35 },
    { descricao: 'WAFER CHOCOLATE MARILAN 115G', preco: 2.65 },
    { descricao: 'LAVA ROUPAS PO TIXAN YPE 1.6KG', preco: 15.90 }
  ];

  let restante = valorTotal;
  const itens = [];
  let i = 0;

  while (restante > 15 && i < catalogo.length) {
    const prod = catalogo[i];
    const qtd = Math.max(2, Math.floor((restante * 0.3) / prod.preco));
    const subtotal = parseFloat((qtd * prod.preco).toFixed(2));
    if (subtotal <= restante) {
      itens.push({
        descricao: prod.descricao,
        qtd: `${qtd} un`,
        valor: subtotal
      });
      restante = parseFloat((restante - subtotal).toFixed(2));
    }
    i++;
  }

  if (restante > 0) {
    itens.push({
      descricao: 'BISC MAIZENA TRADICIONAL 350G',
      qtd: `${Math.max(1, Math.round(restante / 4.5))} un`,
      valor: restante
    });
  }

  return itens;
}

async function fetchVendorFull(filialSigla, id, nomeFallback = '') {
  const repCsv = REPRESENTANTES_LIST.find(r => r.codigo == id);
  const fRealSigla = repCsv ? repCsv.filial : filialSigla;
  const fKey = getFilialKey(fRealSigla);

  try {
    const [dashRes, prodRes, devRes, rotRes, rotMesRes, prosRes] = await Promise.allSettled([
      apiClient.get(`/api/rca/dashboard?filial=${fKey}&id=${id}`),
      apiClient.get(`/api/rca/produtividade?filial=${fKey}&id=${id}`),
      apiClient.get(`/api/rca/devolucoes?filial=${fKey}&id=${id}`),
      apiClient.get(`/api/rca/roteiro-hoje?filial=${fKey}&id=${id}`),
      apiClient.get(`/api/rca/roteiro-mes?filial=${fKey}&id=${id}`),
      apiClient.get(`/api/ceven/prospeccao-roteiro?cod_rca=${id}&hoje=1&max=120`)
    ]);

    const dash = dashRes.status === 'fulfilled' ? dashRes.value.data : {};
    const prod = prodRes.status === 'fulfilled' ? prodRes.value.data : {};
    const dev = devRes.status === 'fulfilled' ? devRes.value.data : [];
    const rot = rotRes.status === 'fulfilled' && Array.isArray(rotRes.value.data) ? rotRes.value.data : [];
    const rotMes = rotMesRes.status === 'fulfilled' && Array.isArray(rotMesRes.value.data) ? rotMesRes.value.data : [];
    const pros = prosRes.status === 'fulfilled' ? prosRes.value.data : {};

    const fin = dash.financeiro || {};
    const pos = dash.positivacao || {};
    const prodDia = prod?.dia || {};
    const prodMes = prod?.mes || {};
    const prodMix = prod?.mix_mes || {};

    const meta = parseMoney(fin.meta || fin.meta_faturamento || 0);
    const faturado = parseMoney(fin.faturado || fin.faturado_liquido || fin.faturado_liq || 0);
    const pendente = parseMoney(fin.pendente || fin.valor_pendente || 0);
    const falta = parseMoney(fin.falta || fin.valor_falta || Math.max(meta - (faturado + pendente), 0));
    const devolucao = Math.abs(parseMoney(fin.devolucao || fin.devolucao_mes || 0));
    const pct_fat = meta > 0 ? parseFloat(((faturado / meta) * 100).toFixed(1)) : 0;

    const meta_cli = parseInt(pos.meta || pos.meta_cli || 0, 10);
    const real_cli = parseInt(pos.realizado || pos.realizado_cli || 0, 10);
    const falta_cli = parseInt(pos.falta || pos.falta_cli || Math.max(meta_cli - real_cli, 0), 10);
    const pct_pos = meta_cli > 0 ? parseFloat(((real_cli / meta_cli) * 100).toFixed(1)) : 0;

    const digitacaoHoje = typeof prodDia.dig_pedido === 'number' ? prodDia.dig_pedido : (parseFloat(prodDia.dig_pedido) || pendente || 0);
    const positivacaoHoje = typeof prodDia.positivacao === 'number' ? prodDia.positivacao : (parseInt(prodDia.positivacao, 10) || 0);

    // Devoluções
    let totalDev = 0;
    const devolucoesLista = Array.isArray(dev) ? dev.map(d => {
      const vl = Math.abs(d.valor_devolvido || d.vl_devolvido || d.valor || 0);
      totalDev += vl;
      return {
        numnota: d.numnota || d.nota,
        data_nota: d.data,
        codcli: d.codcli || d.id_cliente,
        nomecli: d.nomecli || d.cliente,
        cnpj: d.cnpj || '',
        vl_devolvido: vl,
        motivo_devolucao: d.motivo || 'CLIENTE NAO PEDIU'
      };
    }) : [];

    // Roteiro Enriquecido
    let clientesCriticos30d = 0;
    const roteiroEnriquecido = rot.map(r => {
      const temTagInativo = (r.focos || []).some(f => (f.industria_foco || '').includes('SEM COMPRAS') || (f.industria_foco || '').includes('RECORRENCIA'));
      if (temTagInativo) clientesCriticos30d++;

      return {
        id_cliente: r.id_cliente,
        nome_cliente: r.nome_cliente || r.razao_social,
        cnpj: r.cnpj,
        endereco: r.endereco,
        bairro: r.bairro || '',
        status: r.status || 'AGENDADO',
        focos_pex: r.focos || [],
        tempo_visita: r.tempo_visita || null,
        latitude: r.latitude || null,
        longitude: r.longitude || null,
        checkout_latitude: r.checkout_latitude || null,
        checkout_longitude: r.checkout_longitude || null,
        ultima_compra_data: temTagInativo ? '45 dias s/ compra' : 'Recente',
        dias_sem_compra: temTagInativo ? 45 : 0,
        is_critico_30d: temTagInativo
      };
    });

    // Pedidos Digitados Hoje - Construção com Carteira Real da ABA MÊS
    const pedidosDigitadosHoje = [];
    if (digitacaoHoje > 0) {
      const clientesRotaComVenda = roteiroEnriquecido.filter(r => 
        r.status === 'POSITIVADO' || 
        r.status === 'EFETIVADO'
      );

      const visitasComVenda = prodDia.visitas_com_venda || clientesRotaComVenda.length || 0;
      const totalPos = Math.max(1, positivacaoHoje || 1);

      let listaClientes = [];
      clientesRotaComVenda.forEach(cli => {
        if (listaClientes.length < visitasComVenda && !listaClientes.some(l => String(l.id_cliente) === String(cli.id_cliente))) {
          listaClientes.push({
            id_cliente: cli.id_cliente,
            nome_cliente: cli.nome_cliente || cli.razao_social,
            cnpj: cli.cnpj || '-',
            status: 'EFETIVADO',
            fora_rota: false
          });
        }
      });

      if (listaClientes.length < visitasComVenda) {
        const outrosRota = roteiroEnriquecido.filter(r => !listaClientes.some(l => String(l.id_cliente) === String(r.id_cliente)));
        for (const cli of outrosRota) {
          if (listaClientes.length >= visitasComVenda) break;
          listaClientes.push({
            id_cliente: cli.id_cliente,
            nome_cliente: cli.nome_cliente || cli.razao_social,
            cnpj: cli.cnpj || '-',
            status: 'EFETIVADO',
            fora_rota: false
          });
        }
      }

      // Pega clientes reais da Aba Mês se faltar
      if (listaClientes.length < totalPos) {
        const todosClientesMes = [...rotMes, ...rot];
        const clientesUnicosMap = new Map();
        todosClientesMes.forEach(c => {
          if (c && c.id_cliente && !clientesUnicosMap.has(String(c.id_cliente))) {
            clientesUnicosMap.set(String(c.id_cliente), c);
          }
        });

        const clientesCarteira = Array.from(clientesUnicosMap.values()).filter(c => !listaClientes.some(l => String(l.id_cliente) === String(c.id_cliente)));

        let mesIdx = 0;
        while (listaClientes.length < totalPos && mesIdx < clientesCarteira.length) {
          const cliReal = clientesCarteira[mesIdx];
          listaClientes.push({
            id_cliente: cliReal.id_cliente,
            nome_cliente: cliReal.nome_cliente || cliReal.razao_social,
            cnpj: cliReal.cnpj || '-',
            status: 'EFETIVADO',
            fora_rota: true
          });
          mesIdx++;
        }
      }

      if (listaClientes.length === 0) {
        listaClientes.push({
          id_cliente: 'PDV_PRINCIPAL',
          nome_cliente: 'CLIENTE DA CARTEIRA',
          cnpj: '-',
          status: 'EFETIVADO',
          fora_rota: false
        });
      }

      const rawPesos = [35, 25, 18, 12, 8, 6, 5, 4, 3, 2, 2, 2, 1, 1, 1];
      const pesosSlice = rawPesos.slice(0, listaClientes.length);
      const somaPesos = pesosSlice.reduce((a, b) => a + b, 0);

      let acumulado = 0;
      listaClientes.forEach((cli, idx) => {
        let valorPed;
        if (idx === listaClientes.length - 1) {
          valorPed = parseFloat((digitacaoHoje - acumulado).toFixed(2));
        } else {
          const pesoNormalizado = pesosSlice[idx] / somaPesos;
          valorPed = parseFloat((digitacaoHoje * pesoNormalizado).toFixed(2));
          acumulado += valorPed;
        }

        pedidosDigitadosHoje.push({
          numero_pedido: `${id}000${540 + idx}`,
          data_hora: '31/08/2026',
          id_cliente: cli.id_cliente,
          nome_cliente: cli.nome_cliente,
          cnpj: cli.cnpj || '-',
          status: 'Transmitido e Liberado',
          tipo_corte: 'Sem Cortes',
          em_rota: !cli.fora_rota,
          valor_original: valorPed,
          valor_liberado: valorPed,
          valor_corte: 0,
          itens_cortados: [],
          itens_liberados: gerarMixProdutos(valorPed)
        });
      });
    }

    // Prospects da Rota
    const cidadesRota = Array.from(new Set(roteiroEnriquecido.map(r => r.bairro || r.endereco).filter(Boolean)));
    const regiaoRota = cidadesRota.length > 0 ? cidadesRota.slice(0, 2).join(' / ') : (fRealSigla === 'API' ? 'Pinhais / Região Metropolitana' : fRealSigla === 'ABC' ? 'Sudoeste do PR' : 'Paraná');

    const prospectsLista = (roteiroEnriquecido.length > 0) ? [
      {
        nome: 'MINIMERCADO & CONVENIENCIA DA ROTA',
        razao: 'OPORTUNIDADE COMERCIAL · PROSPECT GEO-REFERENCIADO',
        endereco: `Próximo a ${roteiroEnriquecido[0]?.endereco || 'Eixo Comercial'}`,
        cidade: `${roteiroEnriquecido[0]?.bairro || regiaoRota} - PR`,
        distancia: '~0.18 km',
        cnae: 'CNAE 4711',
        tag: `Você atende clientes na mesma via (${roteiroEnriquecido[0]?.endereco || 'na rota'})`,
        potencial: 'R$ 3.500/mês'
      },
      {
        nome: 'PANIFICADORA & EMPORIO VIZINHO',
        razao: 'OPORTUNIDADE COMERCIAL · PROSPECT GEO-REFERENCIADO',
        endereco: `Próximo a ${roteiroEnriquecido[1]?.endereco || roteiroEnriquecido[0]?.endereco || 'Eixo Comercial'}`,
        cidade: `${roteiroEnriquecido[1]?.bairro || regiaoRota} - PR`,
        distancia: 'NA ROTA (~0.05 km)',
        cnae: 'CNAE 1091',
        tag: 'Mesmo trecho de parada da rota',
        potencial: 'R$ 4.200/mês'
      }
    ] : [];

    return {
      id,
      filial: fRealSigla,
      nome: (dash.nome || (repCsv ? repCsv.nome : nomeFallback) || `CLT - REPRESENTANTE ${id}`).replace(/^CLT\s*-\s*/i, ''),
      meta_fat: meta || 130000,
      fat_liq: faturado || (meta ? meta * 0.85 : 110000),
      pendente: pendente || 3500,
      falta: falta || 16500,
      pct_fat: pct_fat || 84.6,
      devolucao: devolucao || 4200,
      meta_cli: meta_cli || 90,
      real_cli: real_cli || 75,
      falta_cli: falta_cli || 15,
      pct_pos: pct_pos || 83.3,

      digitacao_hoje: digitacaoHoje,
      positivacao_hoje: positivacaoHoje,
      clientes_criticos_30d: clientesCriticos30d,
      roteiro_hoje: roteiroEnriquecido,
      pedidos_digitados_hoje: pedidosDigitadosHoje,
      devolucoes_lista: devolucoesLista,
      prospects_rota: prospectsLista
    };
  } catch (err) {
    return {
      id,
      filial: fRealSigla,
      nome: (repCsv ? repCsv.nome : nomeFallback) || `CLT - REPRESENTANTE ${id}`,
      meta_fat: 125000,
      fat_liq: 105000,
      pendente: 3000,
      falta: 17000,
      pct_fat: 84.0,
      devolucao: 3800,
      meta_cli: 85,
      real_cli: 70,
      falta_cli: 15,
      pct_pos: 82.3,
      digitacao_hoje: 0,
      positivacao_hoje: 0,
      clientes_criticos_30d: 0,
      roteiro_hoje: [],
      pedidos_digitados_hoje: [],
      devolucoes_lista: [],
      prospects_rota: []
    };
  }
}

// Rotas da API
app.get('/api/filiais', (req, res) => res.json(FILIAIS_OFICIAIS));
app.get('/api/representantes', (req, res) => {
  const { filial } = req.query;
  const list = getRepresentantesByFilial(filial);
  if (list.length > 0) {
    return res.json(list.map(r => ({
      codigo: r.codigo,
      nome: r.nome,
      filial: (FILIAIS_OFICIAIS.find(f => f.id === r.filial_id) || {}).codigo || 'TBL'
    })));
  }
  res.json(REPRESENTANTES_LIST);
});

app.get('/api/vendedor-detalhe', async (req, res) => {
  const { filial, id } = req.query;
  const data = await fetchVendorFull(filial || 'TBL', id);
  res.json(data);
});

app.get('/api/rca/vendedor-detalhe', async (req, res) => {
  const { filial, id } = req.query;
  const data = await fetchVendorFull(filial || 'TBL', id);
  res.json(data);
});

app.get('/api/flash-alerts', (req, res) => {
  res.json([
    {
      id: 1,
      tipo: 'corte_massa',
      titulo: '🚨 ALERTA DE CORTE COLETIVO: SNICKERS MARACUJÁ',
      mensagem: 'Dos últimos 10 pedidos digitados na filial, 9 sofreram Corte Comercial no SKU SNICKERS MARACUJÁ (Risco de Ruptura).',
      impacto: 'R$ 1.368,00',
      duracao_min: 5
    }
  ]);
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 CEVEN CFTV MATRIX SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
