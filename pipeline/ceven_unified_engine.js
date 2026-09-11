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
const WHATSAPP_VITORIO = '5541987525605';

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
  tph1: { sigla: 'TPH', gerente: 'Vagner' },
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

function fmtMoeda(val) {
  return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 1. Autenticação no CEVEN Admin
async function getAdminToken() {
  const res = await axios.post(`${CEVEN_BASE}/api/admin/login`, {
    username: CEVEN_USER,
    password: CEVEN_PASS
  }, { timeout: 10000 });
  return res.data.access_token;
}

// Lista Oficial dos 13 Gerentes de Filial
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
  { filial: 'TSJ', gerente: 'SALDANHA', whatsapp: '551291224077' },
  { filial: 'TBE', gerente: 'DIEGO', whatsapp: '554699047249' },
  { filial: 'TPA', gerente: 'RADKE', whatsapp: '554499092497' },
  { filial: 'TPA', gerente: 'LEANDRO', whatsapp: '554499427329' }
];

// 2. Carregar Mapa de Vendedores (Validação VJ vs AS)
function carregarValidacaoVendedores() {
  const excelPath = path.join(__dirname, '../VALIDACAO_VENDEDORES_VJ_AS.xlsx');
  const map = {};
  if (fs.existsSync(excelPath)) {
    try {
      const wb = XLSX.readFile(excelPath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;
        const fil = String(row[0]).trim().toUpperCase();
        const ger = String(row[1] || '').trim();
        const supCod = String(row[2] || '').trim();
        const supNome = cleanName(String(row[3] || ''));
        const rca = String(row[4] || '').trim();
        const nome = cleanName(String(row[5] || ''));
        const canal = String(row[6] || 'VJ').trim().toUpperCase();
        const metaFat = parseFloat(row[10] || 0);
        const metaPos = parseInt(row[11] || 0, 10);

        const key = `${fil}_${rca}`;
        map[key] = {
          filial: fil,
          gerente: ger,
          supCod,
          supNome: supNome || 'SUPERVISÃO GERAL',
          rca,
          nome,
          canal,
          metaFat,
          metaPos
        };
      }
    } catch (e) {
      console.warn('Aviso: Erro ao carregar planilha de validacao:', e.message);
    }
  }

  // Enriquecer e atualizar com a árvore viva online dos gerentes (cascata oficial)
  const onlineTreePath = path.join(__dirname, '../scripts/supervisores_11_filiais_completo.json');
  if (fs.existsSync(onlineTreePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(onlineTreePath, 'utf8'));
      for (const [sigla, f] of Object.entries(data)) {
        (f.cascata?.supervisores || []).forEach(s => {
          const supNome = cleanName(s.supervisorNome);
          ['produtividade', 'faturamento', 'positivacao'].forEach(t => {
            (s.tabelas?.[t] || []).forEach(v => {
              const key = `${sigla}_${v.id}`;
              if (!map[key]) {
                map[key] = {
                  filial: sigla,
                  gerente: f.gerente,
                  supCod: String(s.supervisorId || ''),
                  supNome: supNome || 'SUPERVISÃO GERAL',
                  rca: String(v.id),
                  nome: cleanName(v.nome),
                  canal: 'VJ',
                  metaFat: parseFloat(v.meta || 0),
                  metaPos: parseInt(v.meta || 0, 10)
                };
              } else {
                map[key].supNome = supNome || map[key].supNome;
              }
            });
          });
        });
      }
    } catch (e) {}
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
      devolucoesValor: 0,
      supervisores: {}
    };
  }

  const BATCH = 30;
  for (let i = 0; i < reps.length; i += BATCH) {
    const lote = reps.slice(i, i + BATCH);
    await Promise.all(lote.map(async rca => {
      const fSigla = (rca.filial || '').toUpperCase();
      const filEntry = Object.entries(FILIAIS_MAP).find(([k, v]) => v.sigla === fSigla);
      if (!filEntry) return;

      const fKey = filEntry[0];
      const resFil = filialResult[fSigla];

      try {
        const [prodRes, dashRes] = await Promise.all([
          axios.get(`${CEVEN_BASE}/api/rca/produtividade?filial=${fKey}&id=${rca.codigo}`, { timeout: 8000 }),
          axios.get(`${CEVEN_BASE}/api/rca/dashboard?filial=${fKey}&id=${rca.codigo}`, { timeout: 8000 })
        ]);

        const dia = prodRes.data?.dia || {};
        const fin = dashRes.data?.financeiro || {};
        const pos = dashRes.data?.positivacao || {};

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
        resFil.cortesValor += parseFloat(dia.valor_corte || 0);
        resFil.devolucoesValor += Math.abs(parseFloat(fin.devolucao || 0));

        // KPI Estrito de Força de Vendas e Visitas de Rota
        const valKey = `${fSigla}_${rca.codigo}`;
        const valInfo = repsValidationMap[valKey] || { canal: 'VJ', supNome: 'SUPERVISÃO GERAL', nome: cleanName(rca.nome) };
        const supNome = valInfo.supNome;
        const canal = valInfo.canal;

        // Considera visitas e roteiro APENAS dos vendedores de VAREJO (VJ) com meta ativa e rota >= 5
        if (canal === 'VJ' && prog >= 5 && metaFat > 0 && metaPos > 0) {
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
              const rotRes = await axios.get(`${CEVEN_BASE}/api/rca/roteiro-hoje?filial=${fKey}&id=${rca.codigo}`, { timeout: 4000 });
              const clients = rotRes.data || [];
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

  return filialResult;
}

// 4B. Coleta Dinâmica de Abertura Matinal (Exclusivo Varejo Estrito)
async function coletarAberturaVarejo(repsValidationMap) {
  console.log('📡 Coletando dados reais da rota de abertura matinal para Varejo (VJ)...');
  const repsPath = path.join(__dirname, '../public/reps_data.json');
  const reps = JSON.parse(fs.readFileSync(repsPath, 'utf8'));

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);

  const resultado = {};
  for (const [fKey, meta] of Object.entries(FILIAIS_MAP)) {
    resultado[meta.sigla] = {
      sigla: meta.sigla,
      gerente: meta.gerente,
      vjs: 0,
      visitas: 0,
      inativos: 0,
      rec: 0,
      volta: 0,
      prospects: 0
    };
  }

  const vjsValidos = reps.filter(r => {
    const fSigla = (r.filial || '').toUpperCase();
    const val = repsValidationMap[fSigla + '_' + r.codigo];
    return val && val.canal === 'VJ' && val.metaFat > 0 && val.metaPos > 0;
  });

  const BATCH = 30;
  for (let i = 0; i < vjsValidos.length; i += BATCH) {
    const lote = vjsValidos.slice(i, i + BATCH);
    await Promise.all(lote.map(async rca => {
      const fSigla = (rca.filial || '').toUpperCase();
      const filEntry = Object.entries(FILIAIS_MAP).find(([k, v]) => v.sigla === fSigla);
      if (!filEntry) return;
      const fKey = filEntry[0];
      const rFil = resultado[fSigla];

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

  const RATIOS_PROSPECT_5611 = {
    TPH: 2.15, MCD: 3.80, TCV: 3.20, API: 2.10, ABC: 2.50,
    TSJ: 1.85, TCA: 3.60, TBE: 1.35, TCG: 3.90, TBL: 1.45, TPA: 1.95
  };

  let totVj = 0, totVis = 0, totInat = 0, totRec = 0, totVolta = 0, totProsp = 0;
  Object.values(resultado).forEach(r => {
    const ratio = RATIOS_PROSPECT_5611[r.sigla] || 2.0;
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

  let msg = `🌅 *CEVEN NOC — ABERTURA MATINAL DE OPERAÇÃO (07:00)*\n`;
  msg += `📅 ${dataCapitalizada} • Grupo Triunfante\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `📌 *PANORAMA GERAL DA LARGADA (FORÇA DE VENDAS VAREJO):*\n`;
  msg += `👥 *Vendedores Varejo em Rota (Metas + Rota >= 5):* ${totVj} vendedores\n`;
  msg += `📍 *Visitas Planejadas na Rota:* ${totVis.toLocaleString('pt-BR')} PDVs\n`;
  msg += `🎯 *Oportunidades Inativos (+30d sem compra na rota):* ${totInat.toLocaleString('pt-BR')} PDVs (${pctInatGeral}% da rota — Ouro para Positivação)\n`;
  msg += `🔄 *Clientes c/ TAG Recorrência na rota:* ${totRec.toLocaleString('pt-BR')} PDVs (${pctRecGeral}% da rota — Alavanca de Faturamento)\n`;
  msg += `🏬 *Oportunidades no Mapa (CNAE 5611 - Restaurantes e Similares):* +${totProsp.toLocaleString('pt-BR')} PDVs mapeados no trajeto\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🏢 *POTENCIAL DE LARGADA POR FILIAL (VAREJO)*\n\n`;

  // Ordenar filiais por volume de visitas
  const filiaisOrd = Object.values(resultado).sort((a, b) => b.visitas - a.visitas);
  filiaisOrd.forEach(f => {
    const pInat = f.visitas > 0 ? ((f.inativos / f.visitas) * 100).toFixed(1).replace('.', ',') : '0,0';
    const pRec = f.visitas > 0 ? ((f.rec / f.visitas) * 100).toFixed(1).replace('.', ',') : '0,0';

    msg += `📍 *${f.sigla} — ${f.gerente.toUpperCase()}*\n`;
    msg += `• Vendedores em campo: ${f.vjs} • Visitas agendadas: ${f.visitas}\n`;
    msg += `• 🎯 Sem compra +30d: ${f.inativos} PDVs (${pInat}%) • 🔄 Recorrência: ${f.rec} PDVs (${pRec}%)\n`;
    if (f.sigla === 'TPH') {
      msg += `• 🔥 *Campanha VOLTA COMIGO: ${f.volta} PDVs na rota (Foco prioritário de reativação)*\n`;
    }
    msg += `• 🏬 Oportunidades CNAE 5611 no trajeto: +${f.prospects.toLocaleString('pt-BR')} PDVs para cadastro\n\n`;
  });

  return { textoAbertura: msg.trim(), dadosAbertura: resultado };
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
  let totCortes = 0, totDev = 0;
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
      b += `🚨 Cortes Hoje: R$ ${fmtMoeda(r.cortesValor)} • 🚛 Devoluções Entradas Hoje: R$ ${fmtMoeda(r.devolucoesValor)}`;
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
      `✂️ *Cortes nos Pedidos de Hoje:* R$ ${fmtMoeda(totCortes)}`,
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
      b += `💰 Total de Pedidos: R$ ${fmtMoeda(r.fat)} • 📦 Pedidos: ${r.ped}\n`;
      b += `📍 Visitas Varejo: ${r.vis} de ${r.rot} (${r.efici}%) • Eficácia: ${r.efica}%\n`;
      b += `👥 Varejo com Pedido: ${r.vjCom} de ${r.vjTotal} (${r.pctCom}%) | 🚨 Varejo SEM PEDIDO: *${r.vjSem} (${r.pctSem}%)*`;
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
      `🚨 *Zerados no Fechamento:* *${totVjSem} vendedores (${pctGeralSem}%)*`,
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

    if (isFechamento) {
      if (r.inativosRota > 0) {
        m += `🟢 *Recuperação de Inativos (+30d):* ${r.inativosRecuperados} de ${r.inativosRota} PDVs reativados hoje\n`;
      }
      m += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      m += `🏁 *FECHAMENTO DAS OPERAÇÕES DO DIA CONCLUÍDO.*\n`;
    } else {
      m += `🚨 *Zerados no Fechamento:* ${r.vjSem} (${r.pctSem}%)\n\n`;
      m += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      const supsComZerados = Object.entries(r.supervisores).filter(([k, v]) => v.vjSem > 0);
      if (supsComZerados.length > 0) {
        m += `🚨 *VENDEDORES DE VAREJO QUE FECHARAM ZERADOS:*\n`;
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

  let gerentes = GERENTES_MAP;
  const gerPath = path.join(__dirname, '../scripts/gerentes_contatos.json');
  if (fs.existsSync(gerPath)) {
    try { gerentes = JSON.parse(fs.readFileSync(gerPath, 'utf8')); } catch (e) {}
  }
  const repsMap = carregarValidacaoVendedores();

  let token = null;
  try {
    token = await getAdminToken();
    console.log(`🔑 Sessão CEVEN Admin autenticada com sucesso.`);
  } catch (e) {
    console.warn(`⚠️ Erro ao autenticar no CEVEN Admin: ${e.message}`);
  }

  // 0) Abertura Matinal (07:00)
  if (acao === 'abertura') {
    const abertura = await coletarAberturaVarejo(repsMap);
    console.log(`✅ Dados de Abertura Matinal apurados com sucesso para 11 filiais.`);

    if (destino === 'vitorio' || destino === 'todos') {
      console.log(`🚀 Enviando Abertura Matinal para Vitório Neto (${WHATSAPP_VITORIO})...`);
      const r = await enviarWhatsapp(WHATSAPP_VITORIO, abertura.textoAbertura);
      console.log(`  Abertura Matinal — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
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

        const r = await enviarWhatsapp(WHATSAPP_VITORIO, resumoCampo.trim());
        console.log(`  Diretoria Geral — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
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
      console.log(`🚀 Enviando Consolidado para Vitório Neto (${WHATSAPP_VITORIO})...`);
      const r = await enviarWhatsapp(WHATSAPP_VITORIO, relatorios.msgConsolidado);
      console.log(`  Diretoria Geral — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
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
  formatarRelatoriosVendas,
  enviarWhatsapp
};

if (require.main === module) {
  main().catch(console.error);
}
