/**
 * ============================================================================
 * CEVEN NOC — MOTOR UNIFICADO DE INTELIGÊNCIA OPERACIONAL (v4.0)
 * ============================================================================
 * Centraliza e automatiza:
 * 1. Coleta de Gestão de Campo (Compromissos & RETs dos 68 Supervisores);
 * 2. Apuração de Vendas Globais da Filial (Rota + Fora da Rota);
 * 3. KPI Estrito de Força de Vendas Varejo (VJ Zerados por Supervisor);
 * 4. Disparo Resiliente via WhatsApp (Evolution API).
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const XLSX = require('xlsx');

// Configurações de API
const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';
const CEVEN_USER = 'Vitorio';
const CEVEN_PASS = 'Triunfante@2026';

const EVO_URL = 'https://evolution-api-production-8999.up.railway.app';
const EVO_KEY = '143c2820271dfa4c2f6c920aff3205f0c5dec92d7c3f3dfaf90a9d8bb023eaaa';
const EVO_INSTANCE = 'ceven-noc';
const WHATSAPP_VITORIO = ['5541987525605'];

// Mapeamento Oficial das 11 Filiais
const FILIAIS_MAP = {
  abc1: { sigla: 'ABC', gerente: 'Marcos' },
  api1: { sigla: 'API', gerente: 'Marcelo' },
  mcd1: { sigla: 'MCD', gerente: 'Cleverson / Adriano' },
  tbe1: { sigla: 'TBE', gerente: 'Diego' },
  tbl1: { sigla: 'TBL', gerente: 'Fábio' },
  tca1: { sigla: 'TCA', gerente: 'Becher' },
  tcg1: { sigla: 'TCG', gerente: 'Danilo' },
  tcv1: { sigla: 'TCV', gerente: 'Leonardo' },
  tpa1: { sigla: 'TPA', gerente: 'Radke / Leandro' },
  tph1: { sigla: 'TPH', gerente: 'Vagner / Fábio' },
  tsj1: { sigla: 'TSJ', gerente: 'Saldanha' }
};

// Funções Utilitárias
function toBrt(iso) {
  if (!iso) return '-';
  const dt = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(dt);
}

function cleanName(name) {
  if (!name) return 'Não informado';
  return name.replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim();
}

// Classificação de canal real (area_atuacao do CEVEN). Grupos de negócio definidos por Vitório em 22/09/2026:
// Varejo = VJ + FARMA + PET VJ + ESP · AS = AS + PET AS · Excluídos de ambos: SUP, GER, NULO (sem classificação).
// Lista de exclusões adicionais (contas específicas) a ser fornecida por Vitório — ainda não aplicada.
const CANAIS_VAREJO = ['VJ', 'FARMA', 'PET VJ', 'ESP'];
const CANAIS_AS = ['AS', 'PET AS'];
function isCanalVarejo(canal) { return CANAIS_VAREJO.includes(canal); }
function isCanalAS(canal) { return CANAIS_AS.includes(canal); }

// Classifica risco de PDV: null = sem risco (comprou há <=30 dias)
// 'amarelo' = 1ª quinzena, sem compra há +30 dias (ainda tem 2ª visita este mês)
// 'vermelho' = 2ª quinzena, sem compra há +30 dias (não tem mais visita este mês)
function classificarRisco(dataUltimaCompraISO, hojeDate) {
  let diffDias = Infinity;
  if (dataUltimaCompraISO) {
    const dataCompra = new Date(dataUltimaCompraISO);
    diffDias = Math.floor((hojeDate - dataCompra) / 86400000);
  }
  if (diffDias <= 30) return null;
  return hojeDate.getDate() <= 15 ? 'amarelo' : 'vermelho';
}

function fmtMoeda(val) {
  return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function safeGet(url, maxRetries = 3, timeout = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(url, { timeout });
      return res.data;
    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }
      await new Promise(r => setTimeout(r, 600 * attempt));
    }
  }
  return null;
}

// 1. Autenticação no CEVEN Admin
async function getAdminToken() {
  const res = await axios.post(`${CEVEN_BASE}/api/admin/login`, {
    username: CEVEN_USER,
    password: CEVEN_PASS
  }, { timeout: 10000 });
  return res.data.access_token;
}

// Lista Oficial dos 14 Gerentes de Filial
const GERENTES_MAP = [
  { filial: 'TCA', gerente: 'BECHER', whatsapp: '556599438498' },
  { filial: 'TCG', gerente: 'DANILO', whatsapp: '556792831186' },
  { filial: 'MCD', gerente: 'CLEVERSON', whatsapp: '556599730698' },
  { filial: 'MCD', gerente: 'ADRIANO', whatsapp: '556799877927' },
  { filial: 'ABC', gerente: 'MARCOS', whatsapp: '554588226371' },
  { filial: 'TCV', gerente: 'LEONARDO', whatsapp: '554588210792' },
  { filial: 'TBL', gerente: 'FÁBIO', whatsapp: '554388683191' },
  { filial: 'API', gerente: 'MARCELO', whatsapp: '554188317101' },
  { filial: 'TPH', gerente: 'VAGNER', whatsapp: '554188559703' },
  { filial: 'TPH', gerente: 'FÁBIO', whatsapp: '556799877931' },
  { filial: 'TSJ', gerente: 'SALDANHA', whatsapp: '551291224077' },
  { filial: 'TBE', gerente: 'DIEGO', whatsapp: '554699047249' },
  { filial: 'TPA', gerente: 'RADKE', whatsapp: '554499092497' },
  { filial: 'TPA', gerente: 'LEANDRO', whatsapp: '554499427329' }
];

// 2. Carregar Mapa de Vendedores puramente da Árvore Viva do CEVEN (Zero Planilhas)
function carregarValidacaoVendedores() {
  const map = {};
  const onlineTreePath = path.join(__dirname, '../scripts/supervisores_11_filiais_completo.json');

  if (!fs.existsSync(onlineTreePath)) {
    console.error('ERRO CRÍTICO: Árvore de supervisores do CEVEN não encontrada em', onlineTreePath);
    return map;
  }

  try {
    const data = JSON.parse(fs.readFileSync(onlineTreePath, 'utf8'));

    // Mapeamento Oficial das Sub-Gerências de MCD e TPH
    const extrairGerente = (filial, supNome, gerenteBase) => {
      const s = (supNome || '').toUpperCase();
      if (filial === 'MCD') {
        if (s.includes('THIAGO') || s.includes('FLAVIO') || s.includes('JONATAS')) return 'Cleverson';
        if (s.includes('ALYFER') || s.includes('CARLOS ALAGUEZ') || s.includes('CLEOMAR')) return 'Adriano';
        return 'Cleverson';
      }
      if (filial === 'TPH') {
        if (s.includes('AILTON') || s.includes('CRISTIAN') || s.includes('PRISCILA') || s.includes('EDI CARLOS') || s.includes('BERTONI') || s.includes('VITOR MANUEL')) return 'Fábio';
        if (s.includes('LUCAS') || s.includes('ALLISON') || s.includes('DARROS') || s.includes('ANDREY') || s.includes('LUIZ') || s.includes('JEFFERSON') || s.includes('CLAUDETE')) return 'Vagner';
        return 'Fábio';
      }
      return gerenteBase;
    };

    for (const [sigla, f] of Object.entries(data)) {
      const gerentePadrao = f.gerente || `Gerente ${sigla}`;
      (f.cascata?.supervisores || []).forEach(s => {
        const supNome = cleanName(s.supervisorNome);
        const supCod = String(s.supervisorId || '');
        const gerenteOficial = extrairGerente(sigla, supNome, gerentePadrao);

        ['produtividade', 'faturamento', 'positivacao'].forEach(t => {
          (s.tabelas?.[t] || []).forEach(v => {
            const key = `${sigla}_${v.id}`;
            const metaFat = t === 'faturamento' ? parseFloat(v.meta || 0) : 0;
            const metaPos = t === 'positivacao' ? parseInt(v.meta || 0, 10) : 0;

            if (!map[key]) {
              map[key] = {
                filial: sigla,
                gerente: gerenteOficial,
                supCod,
                supNome: supNome || 'SUPERVISÃO GERAL',
                rca: String(v.id),
                nome: cleanName(v.nome),
                canal: 'VJ',
                metaFat,
                metaPos
              };
            } else {
              if (metaFat > 0) map[key].metaFat = metaFat;
              if (metaPos > 0) map[key].metaPos = metaPos;
              map[key].supNome = supNome || map[key].supNome;
              map[key].gerente = gerenteOficial;
            }
          });
        });
      });
    }
    console.log(`✅ Árvore viva do CEVEN carregada: ${Object.keys(map).length} vendedores mapeados diretamente dos endpoints.`);
  } catch (e) {
    console.error('Erro ao processar árvore de supervisores do CEVEN:', e.message);
  }

  return map;
}

// 3. Auditoria de Campo (Compromissos & RETs)
async function coletarAuditoriaCampo(token, dataRef) {
  console.log(`📡 Coletando auditoria de campo para ${dataRef}...`);
  const headers = { Authorization: 'Bearer ' + token };

  const [compRes, retRes] = await Promise.all([
    axios.get(`${CEVEN_BASE}/api/admin/supervisores/matriz-compromissos?dataInicio=${dataRef}&dataFim=${dataRef}`, { headers }),
    axios.get(`${CEVEN_BASE}/api/admin/supervisores/matriz-ret?dataInicio=${dataRef}&dataFim=${dataRef}`, { headers })
  ]);

  const allComp = compRes.data.supervisores || [];
  const allRet = retRes.data.supervisores || [];

  const resultadoPorFilial = {};

  for (const [fKey, meta] of Object.entries(FILIAIS_MAP)) {
    const sups = allComp.filter(s => s.filial === fKey);
    let countComp = 0;
    let countRet = 0;
    const supervisores = [];

    for (const s of sups) {
      const fezComp = (s.porDia && s.porDia[0]) || (s.dias && s.dias[0]) ? true : false;
      const sRet = allRet.find(r => r.id === s.id || r.nome === s.nome);
      const fezRet = (sRet && sRet.porDia && sRet.porDia[0]) || (sRet && sRet.dias && sRet.dias[0]) ? true : false;

      if (fezComp) countComp++;
      if (fezRet) countRet++;

      let retDetalhe = null;
      if (fezRet) {
        try {
          const detRes = await axios.get(`${CEVEN_BASE}/api/admin/ret/periodo?filial=${fKey}&supervisorName=${encodeURIComponent(s.nome)}&dataInicio=${dataRef}&dataFim=${dataRef}`, { headers, timeout: 8000 });
          const dia = detRes.data.dias?.[0];
          if (dia && dia.visitas && dia.visitas.length > 0) {
            let totalFotos = 0;
            dia.visitas.forEach(v => {
              totalFotos += (v.checklist?.photos?.length || (v.photo_url ? 1 : 0));
            });
            const rcaName = cleanName(dia.visitas[0]?.rca_name || '');
            const scores = dia.visitas.map(v => v.ia_score || 0);
            const scoreMedio = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

            retDetalhe = {
              pdvs: dia.visitas.length,
              primeiroCheckin: toBrt(dia.overview?.primeiroCheckin || dia.visitas[0]?.checkin_time),
              rca: rcaName,
              fotos: totalFotos,
              scoreMedio
            };
          }
        } catch (e) {}
      }

      supervisores.push({
        nome: cleanName(s.nome),
        fezComp,
        fezRet,
        retDetalhe
      });
    }

    // Montar texto de mensagem formatado (com linha em branco entre supervisores)
    let msg = `🏢 *FILIAL ${meta.sigla} — GESTÃO DE CAMPO*\n`;
    msg += `📅 ${dataRef.split('-').reverse().join('/')} • Gerente: ${meta.gerente}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `📊 *PAINEL DE ATIVIDADES (${sups.length} SUPERVISORES):*\n`;
    msg += `📝 Compromissos: *${countComp} de ${sups.length}* lançados\n`;
    msg += `🚗 Em Rota (RET): *${countRet} de ${sups.length}* em campo\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    supervisores.forEach(sup => {
      msg += `👤 *${sup.nome}*\n`;
      msg += `📝 Compromisso: ${sup.fezComp ? '✅ Lançado' : '❌ Não lançado'}\n`;
      if (sup.fezRet && sup.retDetalhe) {
        msg += `🚗 Rota (RET): ✅ Em campo (início às ${sup.retDetalhe.primeiroCheckin})\n`;
        msg += `└ 👥 RCA: ${sup.retDetalhe.rca}\n`;
        msg += `└ 📍 ${sup.retDetalhe.pdvs} PDV${sup.retDetalhe.pdvs > 1 ? 's' : ''} visitado${sup.retDetalhe.pdvs > 1 ? 's' : ''} • 📸 ${sup.retDetalhe.fotos} foto${sup.retDetalhe.fotos !== 1 ? 's' : ''} • Score: ${sup.retDetalhe.scoreMedio}%\n\n`;
      } else if (sup.fezRet) {
        msg += `🚗 Rota (RET): ✅ Em campo (dados sincronizando)\n\n`;
      } else {
        msg += `🚗 Rota (RET): ❌ Não iniciou (0 PDVs no sistema)\n\n`;
      }
    });

    resultadoPorFilial[meta.sigla] = {
      fKey,
      sigla: meta.sigla,
      gerente: meta.gerente,
      totalSups: sups.length,
      countComp,
      countRet,
      supervisores,
      texto: msg.trim()
    };
  }

  return resultadoPorFilial;
}

// 4. Coleta de Produtividade e Varejo Zerados
async function coletarVendasEZerados(repsValidationMap, dataRef) {
  console.log(`📡 Coletando produtividade e vendedores de varejo para ${dataRef}...`);
  const repsPath = path.join(__dirname, '../public/reps_data.json');
  const reps = JSON.parse(fs.readFileSync(repsPath, 'utf8'));

  const filialResult = {};
  for (const [fKey, meta] of Object.entries(FILIAIS_MAP)) {
    filialResult[meta.sigla] = {
      sigla: meta.sigla,
      gerente: meta.gerente,
      fatTotalDigitado: 0,
      pedidosTotal: 0,
      visitasReal: 0,
      visitasProg: 0,
      vjTotal: 0,
      vjCom: 0,
      vjSem: 0,
      asTotal: 0,
      asCom: 0,
      asSem: 0,
      inativosRota: 0,
      inativosRecuperados: 0,
      recorrenciaPositivados: 0,
      voltaPositivados: 0,
      cortesValor: 0,
      cortesQtd: 0,
      bloqueadosValor: 0,
      bloqueadosQtd: 0,
      itensCortados: [],
      devolucoesValor: 0,
      supervisores: {}
    };
  }

  const rcasComPedido = [];
  const BATCH = 8;
  for (let i = 0; i < reps.length; i += BATCH) {
    const lote = reps.slice(i, i + BATCH);
    await Promise.all(lote.map(async rca => {
      const fSigla = (rca.filial || '').toUpperCase();
      const filEntry = Object.entries(FILIAIS_MAP).find(([k, v]) => v.sigla === fSigla);
      if (!filEntry) return;

      const fKey = filEntry[0];
      const resFil = filialResult[fSigla];

      try {
        const [diaData, finData, devData] = await Promise.all([
          safeGet(`${CEVEN_BASE}/api/rca/produtividade?filial=${fKey}&id=${rca.codigo}`),
          safeGet(`${CEVEN_BASE}/api/rca/dashboard?filial=${fKey}&id=${rca.codigo}`),
          safeGet(`${CEVEN_BASE}/api/rca/devolucoes?filial=${fKey}&id=${rca.codigo}`)
        ]);

        const dia = diaData?.dia || {};
        const fin = finData?.financeiro || {};
        const pos = finData?.positivacao || {};
        const devs = Array.isArray(devData) ? devData : [];

        const prog = parseInt(dia.total_programado || dia.visitas_programadas || 0, 10);
        const metaFat = parseFloat(fin.meta || 0);
        const metaPos = parseInt(pos.meta || 0, 10);
        const dig = parseFloat(dia.dig_pedido || 0);
        const posDia = parseInt(dia.positivacao || 0, 10);
        const visReal = parseInt(dia.visitas_na_rota || 0, 10);
        const visVend = parseInt(dia.visitas_com_venda || 0, 10);
        const pedTot = Math.max(parseInt(dia.total_pedidos || 0, 10), posDia, visVend, dig > 0 ? 1 : 0);

        // Faturamento e pedidos totais da filial (todos os RCAs/canais)
        resFil.fatTotalDigitado += dig;
        resFil.pedidosTotal += pedTot;
        if (dig > 0 || pedTot > 0) {
          rcasComPedido.push({ filial: fSigla, fKey, codigo: rca.codigo, nome: cleanName(rca.nome) });
        }
        
        // Devoluções reais que entraram no dia de hoje (dataRef)
        devs.filter(d => d.data === dataRef).forEach(d => {
          resFil.devolucoesValor += Math.abs(parseFloat(d.vl_devolvido || d.valor || 0));
        });

        // KPI Estrito de Força de Vendas e Visitas de Rota
        const valKey = `${fSigla}_${rca.codigo}`;
        const valInfo = repsValidationMap[valKey] || { canal: 'VJ', supNome: 'SUPERVISÃO GERAL', nome: cleanName(rca.nome) };
        const supNome = valInfo.supNome;
        const canal = valInfo.canal;

        // Considera visitas e roteiro APENAS dos vendedores de VAREJO (VJ) com meta ativa e rota >= 5
        if (isCanalVarejo(canal) && prog >= 5 && metaFat > 0 && metaPos > 0) {
          resFil.visitasReal += visReal;
          resFil.visitasProg += prog;

          if (!resFil.supervisores[supNome]) {
            resFil.supervisores[supNome] = {
              vjTot: 0, vjCom: 0, vjSem: 0,
              asTot: 0, asCom: 0, asSem: 0,
              zeradosVj: []
            };
          }
          const s = resFil.supervisores[supNome];
          const hasVenda = (dig > 0 || posDia > 0 || visVend > 0);

          resFil.vjTotal++;
          s.vjTot++;
          if (hasVenda) {
            resFil.vjCom++;
            s.vjCom++;
            try {
              const clients = await safeGet(`${CEVEN_BASE}/api/rca/roteiro-hoje?filial=${fKey}&id=${rca.codigo}`) || [];
              const dataLimite = new Date();
              dataLimite.setDate(dataLimite.getDate() - 30);
              clients.forEach(c => {
                const isInativo = !c.data_ultima_compra || new Date(c.data_ultima_compra) < dataLimite;
                const comprou = c.status === 'CONCLUIDO' || (parseFloat(c.valor_pedido) || 0) > 0;
                if (isInativo) {
                  resFil.inativosRota++;
                  if (comprou) resFil.inativosRecuperados++;
                }
                if (comprou && (c.focos || []).some(f => (f.industria_foco || '').toUpperCase().includes('RECORRENCIA'))) {
                  resFil.recorrenciaPositivados++;
                }
                if (comprou && fSigla === 'TPH' && (c.focos || []).some(f => (f.industria_foco || '').toUpperCase().includes('VOLTA'))) {
                  resFil.voltaPositivados++;
                }
              });
            } catch (e) {}
          } else {
            resFil.vjSem++;
            s.vjSem++;
            s.zeradosVj.push({
              rca: rca.codigo,
              nome: cleanName(rca.nome),
              visReal,
              prog
            });
          }
        }
      } catch (e) {
        console.error(`[ERRO RCA ${rca.codigo} - ${fSigla}]:`, e.message);
      }
    }));
  }

  // 2. Varredura rápida de Cortes Comerciais/Logísticos e Pedidos Bloqueados de Hoje
  console.log(`🔍 Apurando Cortes e Bloqueados em tempo real nos ${rcasComPedido.length} vendedores com pedido hoje...`);
  const BATCH_ROT = 10;
  for (let i = 0; i < rcasComPedido.length; i += BATCH_ROT) {
    const lote = rcasComPedido.slice(i, i + BATCH_ROT);
    await Promise.all(lote.map(async r => {
      try {
        const roteiroData = await safeGet(`${CEVEN_BASE}/api/rca/roteiro-hoje?filial=${r.fKey}&id=${r.codigo}`);
        const pdvs = (roteiroData || []).filter(p => p.status === 'POSITIVADO' || p.status === 'EFETIVADO' || p.status === 'VISITADO');
        await Promise.all(pdvs.map(async p => {
          try {
            const histData = await safeGet(`${CEVEN_BASE}/api/rca/historico-cliente/${p.id_cliente}?filial=${r.fKey}&id=${r.codigo}`);
            const visitasHoje = (histData?.ultimas_visitas || []).filter(v => v.data_visita === dataRef && v.num_pedido);
            for (const v of visitasHoje) {
              const resFil = filialResult[r.filial];
              if (!resFil) return;

              const cat = (v.categoria_corte || '').toUpperCase();
              const itensCort = v.itens_cortados || [];
              const vlOrig = parseFloat(v.total_clube || v.valor_original || 0);
              const vlFat = parseFloat(v.vl_faturado_winthor || 0);

              // 1. Pedidos Bloqueados Hoje
              if (v.status_pedido === 'BLOQUEADO') {
                resFil.bloqueadosQtd++;
                resFil.bloqueadosValor += (vlFat > 0 ? vlFat : vlOrig);
              }

              // 2. Cortes Comerciais / Logística de Hoje
              const temCorte = (cat !== '' && cat !== 'SEM CORTE') || itensCort.length > 0;
              if (temCorte) {
                let valorCorte = 0;
                if (vlOrig > vlFat && vlFat > 0) {
                  valorCorte = vlOrig - vlFat;
                } else if (itensCort.length > 0) {
                  itensCort.forEach(it => {
                    valorCorte += (it.qt_cortada || 0) * (it.preco || 15);
                  });
                }
                if (valorCorte > 0) {
                  resFil.cortesQtd++;
                  resFil.cortesValor += valorCorte;
                  resFil.itensCortados.push({
                    rca: r.codigo,
                    vendedor: r.nome,
                    cliente: p.nome_cliente,
                    pedido: v.num_pedido,
                    tipo: cat || 'CORTE IDENTIFICADO',
                    valorCorte: Math.round(valorCorte * 100) / 100,
                    itens: itensCort
                  });
                }
              }
            }
          } catch (e) {}
        }));
      } catch (e) {}
    }));
  }

  return filialResult;
}

// 3B. Enriquecimento de Canal Real (area_atuacao) — sobrescreve o canal:'VJ' hardcoded
// pelo valor real do CEVEN. Valores observados até 22/09/2026: VJ, AS, SUP, ESP, ou nulo
// (~35% dos cadastros não têm area_atuacao preenchida no CEVEN — tratado como 'NULO').
async function enriquecerCanalReal(repsValidationMap) {
  const entries = Object.entries(repsValidationMap);
  const BATCH = 20;
  for (let i = 0; i < entries.length; i += BATCH) {
    const lote = entries.slice(i, i + BATCH);
    await Promise.all(lote.map(async ([key, val]) => {
      const filEntry = Object.entries(FILIAIS_MAP).find(([k, v]) => v.sigla === val.filial);
      if (!filEntry) return;
      const fKey = filEntry[0];
      try {
        const res = await axios.get(`${CEVEN_BASE}/api/filiais/${fKey}/representante/${val.rca}`, { timeout: 6000 });
        val.canal = res.data?.area_atuacao || 'NULO';
      } catch (e) {
        val.canal = 'NULO';
      }
    }));
  }
  return repsValidationMap;
}

// 4A. Leitura das Diretrizes Operacionais Dinâmicas
function carregarDiretrizesOperacionais(cliOverrides = {}) {
  const cfgPath = path.join(__dirname, '../config/diretrizes_operacionais.json');
  let config = {
    cnae_foco: {
      codigo: '5611',
      descricao: 'Restaurantes e Similares',
      ratios_por_filial: {
        TPH: 2.15, MCD: 3.80, TCV: 3.20, API: 2.10, ABC: 2.50,
        TSJ: 1.85, TCA: 3.60, TBE: 1.35, TCG: 3.90, TBL: 1.45, TPA: 1.95
      }
    },
    produtos_foco: [],
    campanhas_ativas: [
      { filial: 'TPH', tag: 'VOLTA', label: 'Campanha VOLTA COMIGO' }
    ],
    controles_dia: {
      silenciar_ciclos: []
    }
  };

  if (fs.existsSync(cfgPath)) {
    try {
      config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    } catch (e) {
      console.warn('⚠️ Erro ao ler config/diretrizes_operacionais.json:', e.message);
    }
  }

  // Overrides via argumentos de linha de comando
  if (cliOverrides['cnae-foco']) {
    config.cnae_foco = config.cnae_foco || {};
    config.cnae_foco.codigo = String(cliOverrides['cnae-foco']).trim();
  }
  if (cliOverrides['cnae-desc']) {
    config.cnae_foco = config.cnae_foco || {};
    config.cnae_foco.descricao = String(cliOverrides['cnae-desc']).trim();
  }
  if (cliOverrides['produtos-foco']) {
    const prods = String(cliOverrides['produtos-foco']).split(',').map(p => p.trim()).filter(Boolean);
    config.produtos_foco = prods.map(p => ({ nome: p, tag: p.toUpperCase(), motivo: 'Foco prioritário do dia' }));
  }
  if (cliOverrides['silenciar-ciclo']) {
    config.controles_dia = config.controles_dia || {};
    config.controles_dia.silenciar_ciclos = config.controles_dia.silenciar_ciclos || [];
    config.controles_dia.silenciar_ciclos.push(String(cliOverrides['silenciar-ciclo']).trim());
  }

  return config;
}

// 4B. Coleta Dinâmica de Abertura Matinal (Exclusivo Varejo Estrito)
async function coletarAberturaVarejo(repsValidationMap, diretrizes = null) {
  const dir = diretrizes || carregarDiretrizesOperacionais();
  const cnaeCodigo = dir?.cnae_foco?.codigo || '5611';
  const cnaeDesc = dir?.cnae_foco?.descricao || 'Restaurantes e Similares';
  const ratiosCnae = dir?.cnae_foco?.ratios_por_filial || {
    TPH: 2.15, MCD: 3.80, TCV: 3.20, API: 2.10, ABC: 2.50,
    TSJ: 1.85, TCA: 3.60, TBE: 1.35, TCG: 3.90, TBL: 1.45, TPA: 1.95
  };

  console.log(`📡 Coletando dados da rota de abertura matinal para Varejo (CNAE Foco: ${cnaeCodigo} · ${cnaeDesc})...`);
  const repsPath = path.join(__dirname, '../public/reps_data.json');
  const reps = JSON.parse(fs.readFileSync(repsPath, 'utf8'));

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);

  // Total de visitas planejadas hoje, TODAS as contas da árvore viva (todos os canais,
  // sem filtro de canal real — ver seção 9 do OPERACAO_WHATSAPP/REGRAS_E_MEMORIA_OPERACIONAL.md,
  // integração do campo `area_atuacao` ainda pendente pra excluir SUP/GER com precisão).
  let totalVisitasTodasContas = 0;
  try {
    const arvorePath = path.join(__dirname, '../scripts/supervisores_11_filiais_completo.json');
    if (fs.existsSync(arvorePath)) {
      const arvore = JSON.parse(fs.readFileSync(arvorePath, 'utf8'));
      Object.values(arvore).forEach(f => {
        (f.cascata?.supervisores || []).forEach(s => {
          (s.tabelas?.produtividade || []).forEach(v => {
            if (cleanName(v.nome).toUpperCase() !== 'INTERNO') {
              totalVisitasTodasContas += parseInt(v.visit_plan_hoje || 0, 10);
            }
          });
        });
      });
    }
  } catch (e) {}

  // resultado é indexado por chave composta "SIGLA::gerente" pra permitir separar
  // MCD e TPH em dois blocos (um por gerente) em vez de um bloco só com "/".
  const resultado = {};
  const getOrCriarBloco = (fSigla, gerente) => {
    const chave = `${fSigla}::${gerente}`;
    if (!resultado[chave]) {
      resultado[chave] = { sigla: fSigla, gerente, vjs: 0, visitas: 0, inativos: 0, rec: 0, volta: 0, prospects: 0 };
    }
    return resultado[chave];
  };

  const vjsValidos = reps.filter(r => {
    const fSigla = (r.filial || '').toUpperCase();
    const val = repsValidationMap[fSigla + '_' + r.codigo];
    return val && isCanalVarejo(val.canal) && val.metaFat > 0 && val.metaPos > 0;
  });

  const BATCH = 30;
  for (let i = 0; i < vjsValidos.length; i += BATCH) {
    const lote = vjsValidos.slice(i, i + BATCH);
    await Promise.all(lote.map(async rca => {
      const fSigla = (rca.filial || '').toUpperCase();
      const filEntry = Object.entries(FILIAIS_MAP).find(([k, v]) => v.sigla === fSigla);
      if (!filEntry) return;
      const fKey = filEntry[0];
      const valInfo = repsValidationMap[fSigla + '_' + rca.codigo] || {};
      const gerente = valInfo.gerente || FILIAIS_MAP[fKey].gerente;
      const rFil = getOrCriarBloco(fSigla, gerente);

      try {
        const url = `${CEVEN_BASE}/api/rca/roteiro-hoje?filial=${fKey}&id=${rca.codigo}`;
        const res = await axios.get(url, { timeout: 6000 });
        const clients = res.data || [];

        // Isolar a sincronização oficial mais recente (Clube da Venda)
        let rotaOficial = clients.filter(c => c.id >= 1083000 && c.id < 1085000);
        if (rotaOficial.length === 0) {
          const seen = new Set();
          const sorted = [...clients].sort((a, b) => b.id - a.id);
          rotaOficial = [];
          sorted.forEach(c => {
            if (!seen.has(c.id_cliente)) {
              seen.add(c.id_cliente);
              rotaOficial.push(c);
            }
          });
          rotaOficial.reverse();
        }

        if (rotaOficial.length >= 5) {
          rFil.vjs++;
          rFil.visitas += rotaOficial.length;
          rotaOficial.forEach(c => {
            if (!c.data_ultima_compra || new Date(c.data_ultima_compra) < dataLimite) {
              rFil.inativos++;
            }
            if ((c.focos || []).some(f => (f.industria_foco || '').toUpperCase().includes('RECORRENCIA'))) {
              rFil.rec++;
            }
            if (fSigla === 'TPH' && (c.focos || []).some(f => (f.industria_foco || '').toUpperCase().includes('VOLTA'))) {
              rFil.volta++;
            }
          });
        }
      } catch (e) {}
    }));
  }

  let totVj = 0, totVis = 0, totInat = 0, totRec = 0, totVolta = 0, totProsp = 0;
  Object.values(resultado).forEach(r => {
    const ratio = ratiosCnae[r.sigla] || 2.0;
    r.prospects = Math.round(r.visitas * ratio);
    totVj += r.vjs;
    totVis += r.visitas;
    totInat += r.inativos;
    totRec += r.rec;
    totVolta += r.volta;
    totProsp += r.prospects;
  });

  const pctInatGeral = totVis > 0 ? ((totInat / totVis) * 100).toFixed(1).replace('.', ',') : '0,0';
  const pctRecGeral = totVis > 0 ? ((totRec / totVis) * 100).toFixed(1).replace('.', ',') : '0,0';

  const dataFormatada = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  const quinzenaEmoji = new Date().getDate() <= 15 ? '🟡' : '🔴';
  const quinzenaLabel = new Date().getDate() <= 15 ? 'Alerta Preventivo' : 'Última Chance do Mês';

  let msg = `🌅 *ABERTURA MATINAL DE OPERAÇÃO (07:45)*\n`;
  msg += `📅 ${dataCapitalizada} • Grupo Triunfante\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `📌 *PANORAMA GERAL*\n`;
  msg += `👥 *Vendedores Varejo em Rota:* ${totVj}\n`;
  msg += `📍 *Visitas Planejadas:* ${totVis.toLocaleString('pt-BR')} PDVs (Varejo) de ${totalVisitasTodasContas.toLocaleString('pt-BR')} (Total)\n`;
  msg += `${quinzenaEmoji} *${quinzenaLabel}:* ${totInat.toLocaleString('pt-BR')} PDVs (${pctInatGeral}% da rota)\n`;
  msg += `🔄 *Recorrência na rota:* ${totRec.toLocaleString('pt-BR')} PDVs (${pctRecGeral}%)\n`;
  msg += `🏬 *Oportunidades CNAE ${cnaeCodigo} (${cnaeDesc}):* +${totProsp.toLocaleString('pt-BR')} PDVs\n`;
  msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🏢 *POR FILIAL (VAREJO)*\n\n`;

  // Ordenar filiais por volume de visitas
  const filiaisOrd = Object.values(resultado).sort((a, b) => b.visitas - a.visitas);
  filiaisOrd.forEach(f => {
    const pInat = f.visitas > 0 ? ((f.inativos / f.visitas) * 100).toFixed(1).replace('.', ',') : '0,0';
    const pRec = f.visitas > 0 ? ((f.rec / f.visitas) * 100).toFixed(1).replace('.', ',') : '0,0';

    msg += `📍 *${f.sigla} — ${f.gerente.toUpperCase()}*\n`;
    msg += `• Vendedores: ${f.vjs} • Visitas: ${f.visitas}\n`;
    msg += `• Sem compra +30d: ${f.inativos} (${pInat}%) • Recorrência: ${f.rec} (${pRec}%)\n`;
    if (f.sigla === 'TPH') {
      msg += `• 🔥 *Volta Comigo: ${f.volta} PDVs*\n`;
    }
    msg += `• CNAE ${cnaeCodigo}: +${f.prospects.toLocaleString('pt-BR')} PDVs\n\n`;
  });

  return { textoAbertura: msg.trim(), dadosAbertura: resultado, cnaeFoco: { codigo: cnaeCodigo, descricao: cnaeDesc } };
}

// 4C. Coleta de PDVs em Risco (Última Chance / Alerta Preventivo) — reaproveita o mesmo
// critério de "inativo +30 dias" já usado na abertura, só reclassificado pela quinzena do mês.
async function coletarAlertaRisco(repsValidationMap, dataHoje) {
  const repsPath = path.join(__dirname, '../public/reps_data.json');
  const reps = JSON.parse(fs.readFileSync(repsPath, 'utf8'));
  const hojeDate = new Date(dataHoje + 'T12:00:00');

  const vjsValidos = reps.filter(r => {
    const fSigla = (r.filial || '').toUpperCase();
    const val = repsValidationMap[fSigla + '_' + r.codigo];
    return val && isCanalVarejo(val.canal) && val.metaFat > 0 && val.metaPos > 0;
  });

  // porGerente["SIGLA::gerente"][supNome] = [ {cliente, vendedor, rca, dataUltimaCompra, valorUltimaCompra, risco, sigla} ]
  // Chave composta (filial + gerente) evita colisão entre gerentes de filiais diferentes com o mesmo nome (ex: "Fábio" existe em TBL e em TPH).
  const porGerente = {};

  const BATCH = 30;
  for (let i = 0; i < vjsValidos.length; i += BATCH) {
    const lote = vjsValidos.slice(i, i + BATCH);
    await Promise.all(lote.map(async rca => {
      const fSigla = (rca.filial || '').toUpperCase();
      const filEntry = Object.entries(FILIAIS_MAP).find(([k, v]) => v.sigla === fSigla);
      if (!filEntry) return;
      const fKey = filEntry[0];
      const valInfo = repsValidationMap[fSigla + '_' + rca.codigo] || {};
      const gerente = valInfo.gerente || FILIAIS_MAP[fKey].gerente;
      const chaveGerente = `${fSigla}::${gerente}`;
      const supNome = valInfo.supNome || 'SUPERVISÃO GERAL';

      try {
        const url = `${CEVEN_BASE}/api/rca/roteiro-hoje?filial=${fKey}&id=${rca.codigo}`;
        const res = await axios.get(url, { timeout: 6000 });
        const clients = res.data || [];

        let rotaOficial = clients.filter(c => c.id >= 1083000 && c.id < 1085000);
        if (rotaOficial.length === 0) {
          const seen = new Set();
          const sorted = [...clients].sort((a, b) => b.id - a.id);
          rotaOficial = [];
          sorted.forEach(c => {
            if (!seen.has(c.id_cliente)) {
              seen.add(c.id_cliente);
              rotaOficial.push(c);
            }
          });
          rotaOficial.reverse();
        }
        if (rotaOficial.length < 5) return;

        rotaOficial.forEach(c => {
          const risco = classificarRisco(c.data_ultima_compra, hojeDate);
          if (!risco) return;
          if (!porGerente[chaveGerente]) porGerente[chaveGerente] = {};
          if (!porGerente[chaveGerente][supNome]) porGerente[chaveGerente][supNome] = [];
          porGerente[chaveGerente][supNome].push({
            cliente: c.nome_cliente,
            vendedor: cleanName(rca.nome),
            rca: rca.codigo,
            sigla: fSigla,
            dataUltimaCompra: c.data_ultima_compra,
            valorUltimaCompra: parseFloat(c.valor_ultima_compra || 0),
            risco
          });
        });
      } catch (e) {}
    }));
  }

  return porGerente;
}

// Mensagem GERAL (só Vitório) — visão consolidada de todas as filiais
function formatarAlertaRiscoGeral(porGerente, horaLabel) {
  let totalVermelho = 0, totalAmarelo = 0;
  const porFilial = {};

  Object.values(porGerente).forEach(supMap => {
    Object.values(supMap).forEach(itens => {
      itens.forEach(it => {
        if (it.risco === 'vermelho') totalVermelho++; else totalAmarelo++;
        if (!porFilial[it.sigla]) porFilial[it.sigla] = { vermelho: 0, amarelo: 0 };
        if (it.risco === 'vermelho') porFilial[it.sigla].vermelho++; else porFilial[it.sigla].amarelo++;
      });
    });
  });

  const quinzena = new Date().getDate() <= 15 ? '1ª quinzena' : '2ª quinzena';

  let m = `🚨 *ALERTA DE PDVs EM RISCO — ${horaLabel}*\n`;
  m += `📅 ${new Date().toLocaleDateString('pt-BR')} • ${quinzena} do mês\n`;
  m += `🏢 *Grupo Triunfante — 11 Filiais*\n`;
  m += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  m += `🔴 *Última Chance do Mês:* ${totalVermelho} PDVs (2ª quinzena, +30d sem compra — não tem mais visita este mês)\n`;
  m += `🟡 *Alerta Preventivo:* ${totalAmarelo} PDVs (1ª quinzena, +30d sem compra — ainda tem a 2ª visita do mês)\n\n`;
  m += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  m += `📊 *POR FILIAL:*\n\n`;

  const filiaisOrd = Object.entries(porFilial).sort((a, b) => (b[1].vermelho + b[1].amarelo) - (a[1].vermelho + a[1].amarelo));
  filiaisOrd.forEach(([sigla, c]) => {
    m += `📍 *${sigla}:* 🔴 ${c.vermelho} • 🟡 ${c.amarelo}\n`;
  });

  return m.trim();
}

// Mensagem por GERENTE — aberta por supervisor que responde a ele
function formatarAlertaRiscoGerente(gerente, sigla, supervisoresMap, horaLabel) {
  let totalVermelho = 0, totalAmarelo = 0;
  Object.values(supervisoresMap).forEach(lista => lista.forEach(it => it.risco === 'vermelho' ? totalVermelho++ : totalAmarelo++));

  let m = `🚨 *PDVs EM RISCO — ${horaLabel}*\n`;
  m += `📍 *${sigla} — ${gerente.toUpperCase()}* • ${new Date().toLocaleDateString('pt-BR')}\n`;
  m += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  m += `🔴 Última Chance: ${totalVermelho}  •  🟡 Preventivo: ${totalAmarelo}\n\n`;

  const MAX_POR_SUPERVISOR = 5;
  Object.entries(supervisoresMap).forEach(([supNome, itens]) => {
    const ordenados = itens.sort((a, b) => b.valorUltimaCompra - a.valorUltimaCompra);
    m += `👤 *${supNome}* (${itens.length} em risco)\n`;
    ordenados.slice(0, MAX_POR_SUPERVISOR).forEach(it => {
      const emoji = it.risco === 'vermelho' ? '🔴' : '🟡';
      const dataFmt = it.dataUltimaCompra
        ? new Date(it.dataUltimaCompra).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : 'nunca';
      m += `  ${emoji} ${it.cliente} (${it.rca}) — ${dataFmt}\n`;
    });
    if (ordenados.length > MAX_POR_SUPERVISOR) {
      m += `  _+${ordenados.length - MAX_POR_SUPERVISOR} outros_\n`;
    }
    m += `\n`;
  });

  return m.trim();
}

// 5. Formatar Relatório de Vendas (Consolidado e Gerentes)
function formatarRelatoriosVendas(filialVendas, horaLabel) {
  const ranking = Object.values(filialVendas).map(f => {
    const fat = f.fatTotalDigitado || 0;
    const ped = f.pedidosTotal || 0;
    const vis = f.visitasReal || 0;
    const rot = f.visitasProg || 0;
    const efici = rot > 0 ? ((vis / rot) * 100).toFixed(1).replace('.', ',') : '0,0';
    const efica = rot > 0 ? ((ped / rot) * 100).toFixed(1).replace('.', ',') : '0,0';

    const pctCom = f.vjTotal > 0 ? Math.round((f.vjCom / f.vjTotal) * 100) : 0;
    const pctSem = f.vjTotal > 0 ? Math.round((f.vjSem / f.vjTotal) * 100) : 0;

    return {
      sigla: f.sigla,
      gerente: f.gerente,
      fat,
      ped,
      vis,
      rot,
      efici,
      efica,
      vjTotal: f.vjTotal,
      vjCom: f.vjCom,
      vjSem: f.vjSem,
      inativosRota: f.inativosRota || 0,
      inativosRecuperados: f.inativosRecuperados || 0,
      recorrenciaPositivados: f.recorrenciaPositivados || 0,
      voltaPositivados: f.voltaPositivados || 0,
      cortesValor: f.cortesValor || 0,
      cortesQtd: f.cortesQtd || 0,
      bloqueadosValor: f.bloqueadosValor || 0,
      bloqueadosQtd: f.bloqueadosQtd || 0,
      itensCortados: f.itensCortados || [],
      devolucoesValor: f.devolucoesValor || 0,
      pctCom,
      pctSem,
      supervisores: f.supervisores
    };
  });

  ranking.sort((a, b) => b.fat - a.fat);

  // Totais Gerais
  let totFat = 0, totPed = 0, totVis = 0, totRot = 0;
  let totVj = 0, totVjCom = 0, totVjSem = 0;
  let totInatRota = 0, totInatRec = 0, totRec = 0, totVolta = 0;
  let totCortes = 0, totCortesQtd = 0, totBloq = 0, totBloqQtd = 0, totDev = 0;
  ranking.forEach(r => {
    totFat += r.fat;
    totPed += r.ped;
    totVis += r.vis;
    totRot += r.rot;
    totVj += r.vjTotal;
    totVjCom += r.vjCom;
    totVjSem += r.vjSem;
    totInatRota += r.inativosRota;
    totInatRec += r.inativosRecuperados;
    totRec += r.recorrenciaPositivados;
    totVolta += r.voltaPositivados;
    totCortes += r.cortesValor;
    totCortesQtd += r.cortesQtd;
    totBloq += r.bloqueadosValor;
    totBloqQtd += r.bloqueadosQtd;
    totDev += r.devolucoesValor;
  });

  const pctGeralCom = totVj > 0 ? ((totVjCom / totVj) * 100).toFixed(1).replace('.', ',') : '0,0';
  const pctGeralSem = totVj > 0 ? ((totVjSem / totVj) * 100).toFixed(1).replace('.', ',') : '0,0';
  const eficiGeral = totRot > 0 ? ((totVis / totRot) * 100).toFixed(2).replace('.', ',') : '0,00';

  // Texto Consolidado da Diretoria
  const isFechamento = (horaLabel === '18:30');

  let msgConsolidado = '';
  if (isFechamento) {
    const blocosRanking = ranking.map((r, idx) => {
      let prefix = '🏢 ';
      if (idx === 0) prefix = '🥇 ';
      else if (idx === 1) prefix = '🥈 ';
      else if (idx === 2) prefix = '🥉 ';
      let b = `${prefix}*${idx + 1}. FILIAL ${r.sigla} — ${r.gerente.toUpperCase()}*\n`;
      b += `💰 Digitado Hoje: R$ ${fmtMoeda(r.fat)} • 📦 ${r.ped} pedidos\n`;
      let conquistas = [`🟢 Inativos Reativados: ${r.inativosRecuperados} PDVs`];
      if (r.recorrenciaPositivados > 0) conquistas.push(`🔄 Recorrência: ${r.recorrenciaPositivados} PDVs`);
      if (r.sigla === 'TPH' && r.voltaPositivados > 0) conquistas.push(`🔁 Volta Comigo: ${r.voltaPositivados} PDVs`);
      b += conquistas.join(' • ') + '\n';
      b += `✂️ Cortes: R$ ${fmtMoeda(r.cortesValor)} (${r.cortesQtd} ped) • 🔒 Bloqueados: R$ ${fmtMoeda(r.bloqueadosValor)} (${r.bloqueadosQtd} ped)\n`;
      b += `🚛 Devoluções Entradas Hoje: R$ ${fmtMoeda(r.devolucoesValor)}`;
      return b;
    });

    msgConsolidado = [
      `🏆 *BOLETIM DE FECHAMENTO OFICIAL DO DIA — 18:30*`,
      `📅 ${new Date().toLocaleDateString('pt-BR')} • Grupo Triunfante (11 Filiais)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📌 *RESULTADO FINANCEIRO DO DIA:*`,
      `💰 *Total Digitado Hoje:* R$ ${fmtMoeda(totFat)}`,
      `📦 *Total de Pedidos Colocados:* ${totPed.toLocaleString('pt-BR')} pedidos`,
      ``,
      `🟢 *CONQUISTAS E RECUPERAÇÃO DE BASE HOJE:*`,
      `🟢 *Inativos Reativados (+30d):* ${totInatRec.toLocaleString('pt-BR')} PDVs recuperados`,
      `🔄 *Positivados com TAG Recorrência:* ${totRec.toLocaleString('pt-BR')} PDVs`,
      `🔁 *Positivados com TAG Volta Comigo (TPH):* ${totVolta.toLocaleString('pt-BR')} PDVs`,
      ``,
      `🚨 *PERDAS E ATENÇÃO OPERACIONAL HOJE:*`,
      `✂️ *Cortes nos Pedidos de Hoje:* R$ ${fmtMoeda(totCortes)} (${totCortesQtd} pedidos afetados)`,
      `🔒 *Pedidos Bloqueados Hoje:* R$ ${fmtMoeda(totBloq)} (${totBloqQtd} pedidos retidos)`,
      `🚛 *Devoluções Entradas Hoje:* R$ ${fmtMoeda(totDev)}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🏆 *RANKING FINAL DE FECHAMENTO (11 FILIAIS):*`,
      ``,
      blocosRanking.join('\n\n')
    ].join('\n');
  } else {
    const blocosRanking = ranking.map((r, idx) => {
      let prefix = '🏢 ';
      if (idx === 0) prefix = '🥇 ';
      else if (idx === 1) prefix = '🥈 ';
      else if (idx === 2) prefix = '🥉 ';
      let b = `${prefix}*${idx + 1}. FILIAL ${r.sigla} — ${r.gerente.toUpperCase()}*\n`;
      b += `💰 Total Digitado: R$ ${fmtMoeda(r.fat)} • 📦 Pedidos: ${r.ped}\n`;
      b += `📍 Visitas Varejo: ${r.vis} de ${r.rot} (${r.efici}%) • Eficácia: ${r.efica}%\n`;
      b += `👥 Varejo com Pedido: ${r.vjCom} de ${r.vjTotal} (${r.pctCom}%) | 🚨 Varejo SEM PEDIDO: *${r.vjSem} (${r.pctSem}%)*\n`;
      b += `✂️ Cortes: R$ ${fmtMoeda(r.cortesValor)} (${r.cortesQtd} ped) • 🔒 Bloqueados: R$ ${fmtMoeda(r.bloqueadosValor)} (${r.bloqueadosQtd} ped)\n`;
      b += `🚛 Devoluções Entradas Hoje: R$ ${fmtMoeda(r.devolucoesValor)}`;
      return b;
    });

    msgConsolidado = [
      `📊 *RELATÓRIO OFICIAL CONSOLIDADO — ${horaLabel}*`,
      `📅 ${new Date().toLocaleDateString('pt-BR')}`,
      `🏢 *Grupo Triunfante — 11 Filiais*`,
      `⚡ Conciliado 100% com o Clube da Venda — Foco Exclusivo Varejo (VJ)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📌 *RESULTADO GERAL DA COMPANHIA:*`,
      `💰 *Total Digitado:* R$ ${fmtMoeda(totFat)}`,
      `📦 *Total de Pedidos:* ${totPed.toLocaleString('pt-BR')} pedidos`,
      `📍 *Visitas Realizadas:* ${totVis.toLocaleString('pt-BR')} de ${totRot.toLocaleString('pt-BR')} (${eficiGeral}%)`,
      ``,
      `🎯 *FORÇA DE VENDAS VAREJO:*`,
      `👥 *Total Varejo em Campo (Metas + Rota >= 5):* ${totVj} vendedores`,
      `✅ *Positivados no Dia:* ${totVjCom} vendedores (${pctGeralCom}%)`,
      `🚨 *Varejo Zerados (${horaLabel}):* *${totVjSem} vendedores (${pctGeralSem}%)*`,
      ``,
      `🚨 *PERDAS E ATENÇÃO OPERACIONAL HOJE:*`,
      `✂️ *Cortes nos Pedidos de Hoje:* R$ ${fmtMoeda(totCortes)} (${totCortesQtd} pedidos afetados)`,
      `🔒 *Pedidos Bloqueados Hoje:* R$ ${fmtMoeda(totBloq)} (${totBloqQtd} pedidos retidos)`,
      `🚛 *Devoluções Entradas Hoje:* R$ ${fmtMoeda(totDev)}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 *DESEMPENHO POR FILIAL (RANKING DE VENDAS)*`,
      ``,
      blocosRanking.join('\n\n')
    ].join('\n');
  }

  // Mensagens individuais por filial para os gerentes
  const mensagensGerentes = {};
  ranking.forEach(r => {
    let m = isFechamento ? `🏢 *BOLETIM DE FECHAMENTO OFICIAL — 18:30*\n` : `🏢 *RELATÓRIO OPERACIONAL — ${horaLabel}*\n`;
    m += `📅 ${new Date().toLocaleDateString('pt-BR')}\n`;
    m += `📍 *FILIAL ${r.sigla} — ${r.gerente.toUpperCase()}*\n`;
    m += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    m += `💰 *Total Digitado Hoje:* R$ ${fmtMoeda(r.fat)}\n`;
    m += `📦 *Pedidos Colocados:* ${r.ped} pedidos\n`;
    m += `📍 *Visitas Realizadas:* ${r.vis} de ${r.rot} (${r.efici}%)\n`;
    m += `👥 *Vendedores Varejo com Pedido:* ${r.vjCom} de ${r.vjTotal} (${r.pctCom}%)\n`;
    m += `✂️ *Cortes nos Pedidos de Hoje:* R$ ${fmtMoeda(r.cortesValor)} (${r.cortesQtd} pedidos afetados)\n`;
    m += `🔒 *Pedidos Bloqueados Hoje:* R$ ${fmtMoeda(r.bloqueadosValor)} (${r.bloqueadosQtd} pedidos retidos)\n`;
    m += `🚛 *Devoluções Entradas Hoje:* R$ ${fmtMoeda(r.devolucoesValor)}\n`;

    // Se houver cortes na filial, detalhar os primeiros para ação rápida do gerente
    if (r.itensCortados && r.itensCortados.length > 0) {
      m += `\n⚠️ *DETALHE DOS CORTES DE HOJE:*\n`;
      r.itensCortados.slice(0, 4).forEach(c => {
        const itemDestaque = c.itens?.[0]?.descricao || 'SKU em falta';
        m += `  ▫️ Cód. ${c.rca} • ${c.vendedor}: -R$ ${fmtMoeda(c.valorCorte)} em ${c.cliente} (${itemDestaque})\n`;
      });
      if (r.itensCortados.length > 4) {
        m += `  ▫️ _... e mais ${r.itensCortados.length - 4} pedidos com corte._\n`;
      }
    }

    if (isFechamento) {
      if (r.inativosRota > 0) {
        m += `🟢 *Recuperação de Inativos (+30d):* ${r.inativosRecuperados} de ${r.inativosRota} PDVs reativados hoje\n`;
      }
      m += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      m += `🏁 *FECHAMENTO DAS OPERAÇÕES DO DIA CONCLUÍDO.*\n`;
    } else {
      m += `\n🚨 *Varejo Zerados (${horaLabel}):* ${r.vjSem} (${r.pctSem}%)\n\n`;
      m += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      const supsComZerados = Object.entries(r.supervisores).filter(([k, v]) => v.vjSem > 0);
      if (supsComZerados.length > 0) {
        m += `🚨 *VENDEDORES DE VAREJO ZERADOS NO HORÁRIO (${horaLabel}):*\n`;
        m += `_(Visitas realizadas sem conversão de pedido)_\n\n`;
        supsComZerados.forEach(([supNome, s]) => {
          m += `👤 *Supervisor: ${supNome}* (${s.vjSem} zerados)\n`;
          s.zeradosVj.forEach(z => {
            m += `  ▫️ Cód. ${z.rca} • ${z.nome}: *${z.visReal} visitas feitas* (de ${z.prog} na rota) • R$ 0\n`;
          });
          m += `\n`;
        });
      } else {
        m += `✅ *PARABÉNS! 100% DOS VENDEDORES DE VAREJO POSITIVADOS HOJE!*\n\n`;
      }
    }

    mensagensGerentes[r.sigla] = m.trim();
  });

  return { msgConsolidado, mensagensGerentes };
}

// 6. Envio Resiliente via WhatsApp (com retry automático)
async function enviarWhatsapp(numero, texto, tentativas = 3) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const res = await axios.post(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
        number: numero,
        text: texto
      }, {
        headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
        timeout: 15000
      });
      return { sucesso: true, id: res.data?.key?.id || 'OK' };
    } catch (err) {
      console.warn(`  ⚠️ Tentativa ${i} falhou para ${numero}: ${err.message}`);
      if (i === tentativas) return { sucesso: false, erro: err.message };
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// 7. Ponto de Entrada Principal
async function main() {
  const args = {};
  process.argv.forEach((val, idx) => {
    if (val.startsWith('--')) {
      const parts = val.slice(2).split('=');
      args[parts[0]] = parts[1] || process.argv[idx + 1];
    }
  });

  const acao = args.acao || 'completo';
  const destino = args.destino || 'dry_run';
  const hora = args.hora || '11:00';
  const dataHoje = args.data || new Date().toISOString().split('T')[0];

  console.log(`\n==================================================`);
  console.log(`🚀 CEVEN UNIFIED ENGINE v4.0`);
  console.log(`📅 Data: ${dataHoje} | Hora: ${hora} | Ação: ${acao} | Destino: ${destino}`);
  console.log(`==================================================\n`);

  const diretrizes = carregarDiretrizesOperacionais(args);

  if (diretrizes.controles_dia?.silenciar_ciclos?.includes(hora)) {
    console.log(`⏸️ Ciclo [${hora}] está marcado em 'silenciar_ciclos' nas diretrizes operacionais. Execução abortada sem envio.`);
    return;
  }

  let gerentes = GERENTES_MAP;
  const gerPath = path.join(__dirname, '../scripts/gerentes_contatos.json');
  if (fs.existsSync(gerPath)) {
    try { gerentes = JSON.parse(fs.readFileSync(gerPath, 'utf8')); } catch (e) {}
  }
  const repsMap = carregarValidacaoVendedores();
  console.log(`📡 Enriquecendo canal real (area_atuacao) de ${Object.keys(repsMap).length} contas...`);
  await enriquecerCanalReal(repsMap);

  const CACHE_ABERTURA = path.join(__dirname, 'dados_abertura_matinal.json');

  // -1) Aquecimento Matinal (04:00 BRT): Coleta pesada noturna de todas as rotas
  if (acao === 'aquecimento_matinal') {
    console.log(`🌅 Executando AQUECIMENTO MATINAL (04:00 BRT)...`);
    console.log(`⚙️ Diretrizes ativas: CNAE ${diretrizes.cnae_foco.codigo} (${diretrizes.cnae_foco.descricao}) | ${diretrizes.produtos_foco.length} produtos em foco.`);
    const abertura = await coletarAberturaVarejo(repsMap, diretrizes);
    const payload = {
      data: dataHoje,
      geradoEm: new Date().toISOString(),
      diretrizesUsadas: {
        cnae: diretrizes.cnae_foco,
        produtos: diretrizes.produtos_foco
      },
      abertura
    };
    fs.writeFileSync(CACHE_ABERTURA, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`💾 Cache de abertura matinal salvo com sucesso em: ${CACHE_ABERTURA}`);
    console.log(`✅ Aquecimento noturno finalizado. Às 07:00 o disparo será instantâneo (< 10s)!`);
    return;
  }

  let token = null;
  try {
    token = await getAdminToken();
    console.log(`🔑 Sessão CEVEN Admin autenticada com sucesso.`);
  } catch (e) {
    console.warn(`⚠️ Erro ao autenticar no CEVEN Admin: ${e.message}`);
  }

  // 0) Abertura Matinal (07:00)
  if (acao === 'abertura') {
    let abertura = null;
    if (fs.existsSync(CACHE_ABERTURA)) {
      try {
        const cache = JSON.parse(fs.readFileSync(CACHE_ABERTURA, 'utf8'));
        if (cache.data === dataHoje && cache.abertura?.textoAbertura) {
          console.log(`⚡ Usando dados pré-processados do Aquecimento Matinal (${cache.geradoEm}). Disparo instantâneo!`);
          abertura = cache.abertura;
        } else {
          console.log(`⚠️ Cache existente é de outra data (${cache.data}). Coletando dados ao vivo...`);
        }
      } catch (e) {
        console.warn(`⚠️ Erro ao ler cache matinal: ${e.message}. Coletando dados ao vivo...`);
      }
    }

    if (!abertura) {
      console.log(`🔄 Coletando dados de abertura matinal ao vivo...`);
      abertura = await coletarAberturaVarejo(repsMap, diretrizes);
    }
    console.log(`✅ Dados de Abertura Matinal apurados com sucesso para 11 filiais.`);

    if (destino === 'vitorio' || destino === 'todos') {
      console.log(`🚀 Enviando Abertura Matinal para Vitório Neto (${WHATSAPP_VITORIO.join(', ')})...`);
      const telefones = Array.isArray(WHATSAPP_VITORIO) ? WHATSAPP_VITORIO : [WHATSAPP_VITORIO];
      for (const tel of telefones) {
        const r = await enviarWhatsapp(tel, abertura.textoAbertura);
        console.log(`  Abertura Matinal (${tel}) — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
      }
    } else {
      console.log(`\n--- PREVIEW ABERTURA MATINAL ---`);
      console.log(abertura.textoAbertura);
    }
  }

  // A) Gestão de Campo (Compromissos & RETs)
  if (acao === 'gestao_campo' || acao === 'completo') {
    if (token) {
      const auditoria = await coletarAuditoriaCampo(token, dataHoje);
      console.log(`✅ Auditoria de campo processada para 11 filiais.`);

      if (destino === 'vitorio' || destino === 'todos') {
        console.log(`🚀 Enviando Gestão de Campo Consolidada para Vitório Neto (${WHATSAPP_VITORIO})...`);

        let totSups = 0, totComp = 0, totRet = 0;
        const rankingFiliais = Object.values(auditoria).map(d => {
          totSups += d.totalSups;
          totComp += d.countComp;
          totRet += d.countRet;
          const pctComp = d.totalSups > 0 ? (d.countComp / d.totalSups) * 100 : 0;
          const pctRet = d.totalSups > 0 ? (d.countRet / d.totalSups) * 100 : 0;
          return {
            sigla: d.sigla,
            gerente: d.gerente,
            totalSups: d.totalSups,
            countComp: d.countComp,
            countRet: d.countRet,
            pctComp,
            pctRet
          };
        });

        // Ordenar por taxa de RET e Compromissos
        rankingFiliais.sort((a, b) => (b.pctRet + b.pctComp) - (a.pctRet + a.pctComp));

        const pctGeralComp = totSups > 0 ? ((totComp / totSups) * 100).toFixed(1).replace('.', ',') : '0,0';
        const pctGeralRet = totSups > 0 ? ((totRet / totSups) * 100).toFixed(1).replace('.', ',') : '0,0';

        const blocosRanking = rankingFiliais.map((f, idx) => {
          let prefix = '🏢 ';
          if (idx === 0) prefix = '🥇 ';
          else if (idx === 1) prefix = '🥈 ';
          else if (idx === 2) prefix = '🥉 ';
          return `${prefix}*${idx + 1}. FILIAL ${f.sigla} — ${f.gerente.toUpperCase()}*\n` +
                 `📝 Compromissos: *${f.countComp} de ${f.totalSups}* (${f.pctComp.toFixed(0)}%) • 🚗 Em Rota: *${f.countRet} de ${f.totalSups}* (${f.pctRet.toFixed(0)}%)`;
        });

        const semComp = totSups - totComp;
        const semRet = totSups - totRet;

        const resumoCampo = [
          `📋 *PAINEL EXECUTIVO — GESTÃO DE CAMPO (11 FILIAIS)*`,
          `📅 ${new Date().toLocaleDateString('pt-BR')} • ⏱️ Referência: ${hora}`,
          `🏢 *Grupo Triunfante*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `📌 *RESULTADO GERAL DA COMPANHIA:*`,
          `👥 *Supervisores em Campo:* ${totSups} supervisores`,
          `📝 *Compromissos Lançados:* ${totComp} de ${totSups} (${pctGeralComp}%)`,
          `🚗 *Em Rota (RET Ativo):* ${totRet} de ${totSups} (${pctGeralRet}%)`,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📊 *DESEMPENHO POR FILIAL (RANKING DE ATIVIDADE):*`,
          ``,
          blocosRanking.join('\n\n'),
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚠️ *ATENÇÃO OPERACIONAL:*`,
          `🚨 *${semComp} supervisores* sem compromisso lançado`,
          `🚨 *${semRet} supervisores* sem início de rota (RET) no sistema`
        ].join('\n');

        const telefones = Array.isArray(WHATSAPP_VITORIO) ? WHATSAPP_VITORIO : [WHATSAPP_VITORIO];
        for (const tel of telefones) {
          const r = await enviarWhatsapp(tel, resumoCampo.trim());
          console.log(`  Diretoria Geral (${tel}) — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
        }
        if (destino === 'todos') {
          await new Promise(res => setTimeout(res, 30000));
        }
      }

      if (destino === 'gerentes' || destino === 'todos') {
        console.log(`🚀 Disparando Gestão de Campo para os ${gerentes.length} gerentes...`);
        for (const g of gerentes) {
          const rel = auditoria[g.filial];
          if (rel && rel.texto) {
            const r = await enviarWhatsapp(g.whatsapp, rel.texto);
            console.log(`  [${g.filial}] Enviado para ${g.gerente} — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
            await new Promise(res => setTimeout(res, 30000));
          }
        }
      } else if (destino === 'dry_run') {
        console.log(`\n--- PREVIEW FILIAL ABC (GESTAO DE CAMPO) ---`);
        console.log(auditoria['ABC']?.texto);
      }
    }
  }

  // B) Vendas & Zerados do Varejo
  if (acao === 'vendas_zerados' || acao === 'completo') {
    const filialVendas = await coletarVendasEZerados(repsMap, dataHoje);
    const relatorios = formatarRelatoriosVendas(filialVendas, hora);
    console.log(`✅ Vendas e Varejo Zerados apurados com sucesso.`);

    if (destino === 'vitorio' || destino === 'todos') {
      console.log(`🚀 Enviando Consolidado para Vitório Neto (${WHATSAPP_VITORIO.join(', ')})...`);
      const telefones = Array.isArray(WHATSAPP_VITORIO) ? WHATSAPP_VITORIO : [WHATSAPP_VITORIO];
      for (const tel of telefones) {
        const r = await enviarWhatsapp(tel, relatorios.msgConsolidado);
        console.log(`  Diretoria Geral (${tel}) — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
      }
      if (destino === 'todos') {
        await new Promise(res => setTimeout(res, 30000));
      }
    }

    if (destino === 'gerentes' || destino === 'todos') {
      console.log(`🚀 Disparando Parciais de Varejo para os ${gerentes.length} gerentes...`);
      for (const g of gerentes) {
        const txt = relatorios.mensagensGerentes[g.filial];
        if (txt) {
          const r = await enviarWhatsapp(g.whatsapp, txt);
          console.log(`  [${g.filial}] Enviado para ${g.gerente} — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
          await new Promise(res => setTimeout(res, 30000));
        }
      }
    } else if (destino === 'dry_run') {
      console.log(`\n--- PREVIEW CONSOLIDADO GERAL (${hora}) ---`);
      console.log(relatorios.msgConsolidado);
    }
  }

  console.log(`\n🏁 Execução do ciclo ${hora} finalizada com sucesso.\n`);
}

module.exports = {
  getAdminToken,
  coletarAuditoriaCampo,
  coletarVendasEZerados,
  coletarAberturaVarejo,
  formatarRelatoriosVendas,
  carregarDiretrizesOperacionais,
  carregarValidacaoVendedores,
  enriquecerCanalReal,
  isCanalVarejo,
  isCanalAS,
  coletarAlertaRisco,
  formatarAlertaRiscoGeral,
  formatarAlertaRiscoGerente,
  enviarWhatsapp,
  GERENTES_MAP,
  FILIAIS_MAP,
  WHATSAPP_VITORIO
};

if (require.main === module) {
  main().catch(console.error);
}
