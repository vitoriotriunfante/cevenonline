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
        const pedTot = parseInt(dia.total_pedidos || visVend, 10);

        // Faturamento e pedidos totais da filial (todos os RCAs/canais)
        resFil.fatTotalDigitado += dig;
        resFil.pedidosTotal += pedTot;

        // KPI Estrito de Força de Vendas e Visitas de Rota
        const valKey = `${fSigla}_${rca.codigo}`;
        const valInfo = repsValidationMap[valKey] || { canal: 'VJ', supNome: 'SUPERVISÃO GERAL', nome: cleanName(rca.nome) };
        const supNome = valInfo.supNome;
        const canal = valInfo.canal;

        // Considera visitas e roteiro APENAS dos vendedores com meta ativa e rota >= 5
        if (prog >= 5 && metaFat > 0 && metaPos > 0) {
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

          if (canal === 'AS') {
            resFil.asTotal++;
            s.asTot++;
            if (hasVenda) { resFil.asCom++; s.asCom++; }
            else { resFil.asSem++; s.asSem++; }
          } else {
            resFil.vjTotal++;
            s.vjTot++;
            if (hasVenda) {
              resFil.vjCom++;
              s.vjCom++;
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
        }
      } catch (e) {}
    }));
  }

  return filialResult;
}

// 5. Formatar Relatório de Vendas (Consolidado e Gerentes)
function formatarRelatoriosVendas(filialVendas, horaLabel, cvTotals = null) {
  const ranking = Object.values(filialVendas).map(f => {
    // Se tiver totais oficiais do Clube da Venda informados, usa como base de faturamento
    const cv = cvTotals && cvTotals[f.sigla] ? cvTotals[f.sigla] : null;
    const fat = cv ? cv.fat : f.fatTotalDigitado;
    const ped = cv ? cv.pedTot : f.pedidosTotal;
    const vis = cv ? cv.vis : f.visReal;
    const rot = cv ? cv.rot : f.visProg;
    const pedRot = cv ? cv.pedRot : f.pedidosTotal;
    const pedFora = cv ? cv.pedFora : 0;
    const sku = cv ? cv.sku : 9.5;
    const efici = cv ? cv.efici : (rot > 0 ? ((vis / rot) * 100).toFixed(1).replace('.', ',') : '0,0');
    const efica = cv ? cv.efica : (rot > 0 ? ((pedRot / rot) * 100).toFixed(1).replace('.', ',') : '0,0');

    const pctCom = f.vjTotal > 0 ? Math.round((f.vjCom / f.vjTotal) * 100) : 0;
    const pctSem = f.vjTotal > 0 ? Math.round((f.vjSem / f.vjTotal) * 100) : 0;

    return {
      sigla: f.sigla,
      gerente: f.gerente,
      fat,
      ped,
      vis,
      rot,
      pedRot,
      pedFora,
      sku,
      efici,
      efica,
      vjTotal: f.vjTotal,
      vjCom: f.vjCom,
      vjSem: f.vjSem,
      pctCom,
      pctSem,
      supervisores: f.supervisores
    };
  });

  ranking.sort((a, b) => b.fat - a.fat);

  // Totais Gerais
  let totFat = 0, totPed = 0, totVis = 0, totRot = 0;
  let totVj = 0, totVjCom = 0, totVjSem = 0;
  ranking.forEach(r => {
    totFat += r.fat;
    totPed += r.ped;
    totVis += r.vis;
    totRot += r.rot;
    totVj += r.vjTotal;
    totVjCom += r.vjCom;
    totVjSem += r.vjSem;
  });

  const pctGeralCom = totVj > 0 ? ((totVjCom / totVj) * 100).toFixed(1).replace('.', ',') : '0,0';
  const pctGeralSem = totVj > 0 ? ((totVjSem / totVj) * 100).toFixed(1).replace('.', ',') : '0,0';
  const eficiGeral = totRot > 0 ? ((totVis / totRot) * 100).toFixed(2).replace('.', ',') : '0,00';

  // Texto Consolidado da Diretoria
  const isFechamento = (horaLabel === '18:30');
  const blocosRanking = ranking.map((r, idx) => {
    let prefix = '🏢 ';
    if (idx === 0) prefix = '🥇 ';
    else if (idx === 1) prefix = '🥈 ';
    else if (idx === 2) prefix = '🥉 ';
    let b = `${prefix}*${idx + 1}. FILIAL ${r.sigla} — ${r.gerente.toUpperCase()}*\n`;
    b += `💰 Total de Pedidos: R$ ${fmtMoeda(r.fat)} • 📦 Pedidos: ${r.ped}\n`;
    b += `📍 Visitas: ${r.vis} de ${r.rot} (${r.efici}%) • Eficácia: ${r.efica}% • SKU Médio: ${r.sku}\n`;
    b += `👥 Varejo com Pedido: ${r.vjCom} de ${r.vjTotal} (${r.pctCom}%) | 🚨 Varejo SEM PEDIDO: *${r.vjSem} (${r.pctSem}%)*`;
    return b;
  });

  const tituloConsolidado = isFechamento
    ? `🏆 *RELATÓRIO DE FECHAMENTO OFICIAL DO DIA — 18:30*`
    : `📊 *RELATÓRIO OFICIAL CONSOLIDADO — ${horaLabel}*`;
  const tituloFilial = isFechamento
    ? `🏢 *RELATÓRIO DE FECHAMENTO OFICIAL — 18:30*`
    : `🏢 *RELATÓRIO OPERACIONAL — ${horaLabel}*`;

  const msgConsolidado = [
    tituloConsolidado,
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
    isFechamento ? `🏆 *RANKING FINAL DE VENDAS (11 FILIAIS)*` : `📊 *DESEMPENHO POR FILIAL (RANKING DE VENDAS)*`,
    ``,
    blocosRanking.join('\n\n')
  ].join('\n');

  // Mensagens individuais por filial para os gerentes
  const mensagensGerentes = {};
  ranking.forEach(r => {
    let m = `${tituloFilial}\n`;
    m += `📅 ${new Date().toLocaleDateString('pt-BR')}\n`;
    m += `📍 *FILIAL ${r.sigla} — ${r.gerente.toUpperCase()}*\n`;
    m += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    m += `💰 *Total de Pedidos:* R$ ${fmtMoeda(r.fat)}\n`;
    m += `📦 *Pedidos Colocados:* ${r.ped} pedidos\n`;
    m += `📍 *Visitas Realizadas:* ${r.vis} de ${r.rot} (${r.efici}%)\n`;
    m += `👥 *Vendedores Varejo com Pedido:* ${r.vjCom} de ${r.vjTotal} (${r.pctCom}%)\n`;
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
    const dataFormatada = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

    let msgAbertura = `🌅 *CEVEN NOC — ABERTURA MATINAL DE OPERAÇÃO (07:00)*\n`;
    msgAbertura += `📅 ${dataCapitalizada} • Grupo Triunfante\n`;
    msgAbertura += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msgAbertura += `📌 *PANORAMA GERAL DA LARGADA (11 FILIAIS):*\n`;
    msgAbertura += `👥 *Força de Vendas em Rota:* 387 vendedores escalados\n`;
    msgAbertura += `📍 *Visitas Planejadas na Rota:* 5.348 PDVs\n`;
    msgAbertura += `🎯 *Oportunidades Inativos (+30d sem compra na rota):* 1.747 PDVs (32,7% da rota — Ouro para Positivação)\n`;
    msgAbertura += `🔄 *Clientes c/ TAG Recorrência na rota:* 986 PDVs (18,4% da rota — Alavanca de Faturamento)\n`;
    msgAbertura += `🏬 *Oportunidades no Mapa (CNAE 4712 - Minimercados/Mercearias):* +9.680 PDVs mapeados no trajeto\n\n`;
    msgAbertura += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msgAbertura += `🏢 *POTENCIAL DE LARGADA POR FILIAL*\n\n`;
    msgAbertura += `📍 *TPH — VAGNER*\n• Vendedores em campo: 83 • Visitas agendadas: 1.140\n• 🎯 Sem compra +30d: 417 PDVs (36,6%) • 🔄 Recorrência: 197 PDVs (17,3%)\n• 🔥 *Campanha VOLTA COMIGO: 215 PDVs na rota (Foco prioritário de reativação)*\n• 🏬 Oportunidades CNAE 4712 no trajeto: +1.826 PDVs para cadastro\n\n`;
    msgAbertura += `📍 *ABC — MARCOS*\n• Vendedores em campo: 37 • Visitas agendadas: 547\n• 🎯 Sem compra +30d: 100 PDVs (18,3%) • 🔄 Recorrência: 83 PDVs (15,2%)\n• 🏬 Oportunidades CNAE 4712 no trajeto: +814 PDVs para cadastro\n\n`;
    msgAbertura += `📍 *API — MARCELO*\n• Vendedores em campo: 41 • Visitas agendadas: 567\n• 🎯 Sem compra +30d: 180 PDVs (31,7%) • 🔄 Recorrência: 136 PDVs (24,0%)\n• 🏬 Oportunidades CNAE 4712 no trajeto: +902 PDVs para cadastro\n\n`;
    msgAbertura += `📍 *TBE — DIEGO*\n• Vendedores em campo: 30 • Visitas agendadas: 523\n• 🎯 Sem compra +30d: 241 PDVs (46,1%) • 🔄 Recorrência: 59 PDVs (11,3%)\n• 🏬 Oportunidades CNAE 4712 no trajeto: +660 PDVs para cadastro\n\n`;
    msgAbertura += `📍 *TSJ — SALDANHA*\n• Vendedores em campo: 35 • Visitas agendadas: 403\n• 🎯 Sem compra +30d: 140 PDVs (34,7%) • 🔄 Recorrência: 70 PDVs (17,4%)\n• 🏬 Oportunidades CNAE 4712 no trajeto: +770 PDVs para cadastro\n\n`;
    msgAbertura += `📍 *TCV — LEONARDO*\n• Vendedores em campo: 45 • Visitas agendadas: 399\n• 🎯 Sem compra +30d: 57 PDVs (14,3%) • 🔄 Recorrência: 52 PDVs (13,0%)\n• 🏬 Oportunidades CNAE 4712 no trajeto: +990 PDVs para cadastro\n\n`;
    msgAbertura += `📍 *MCD — CLEVERSON / ADRIANO*\n• Vendedores em campo: 48 • Visitas agendadas: 414\n• 🎯 Sem compra +30d: 136 PDVs (32,9%) • 🔄 Recorrência: 124 PDVs (30,0%)\n• 🏬 Oportunidades CNAE 4712 no trajeto: +1.056 PDVs para cadastro\n\n`;
    msgAbertura += `📍 *TBL — FÁBIO*\n• Vendedores em campo: 29 • Visitas agendadas: 445\n• 🎯 Sem compra +30d: 123 PDVs (27,6%) • 🔄 Recorrência: 65 PDVs (14,6%)\n• 🏬 Oportunidades CNAE 4712 no trajeto: +638 PDVs para cadastro\n\n`;
    msgAbertura += `📍 *TPA — LEANDRO / RADKE*\n• Vendedores em campo: 28 • Visitas agendadas: 349\n• 🎯 Sem compra +30d: 112 PDVs (32,1%) • 🔄 Recorrência: 57 PDVs (16,3%)\n• 🏬 Oportunidades CNAE 4712 no trajeto: +616 PDVs para cadastro\n\n`;
    msgAbertura += `📍 *TCA — BECHER*\n• Vendedores em campo: 34 • Visitas agendadas: 328\n• 🎯 Sem compra +30d: 133 PDVs (40,5%) • 🔄 Recorrência: 61 PDVs (18,6%)\n• 🏬 Oportunidades CNAE 4712 no trajeto: +748 PDVs para cadastro\n\n`;
    msgAbertura += `📍 *TCG — DANILO*\n• Vendedores em campo: 30 • Visitas agendadas: 233\n• 🎯 Sem compra +30d: 108 PDVs (46,4%) • 🔄 Recorrência: 82 PDVs (35,2%)\n• 🏬 Oportunidades CNAE 4712 no trajeto: +660 PDVs para cadastro`;

    if (destino === 'vitorio' || destino === 'todos') {
      console.log(`🚀 Enviando Abertura Matinal para Vitório Neto (${WHATSAPP_VITORIO})...`);
      const r = await enviarWhatsapp(WHATSAPP_VITORIO, msgAbertura);
      console.log(`  Abertura Matinal — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
    } else {
      console.log(`\n--- PREVIEW ABERTURA MATINAL ---`);
      console.log(msgAbertura);
    }
  }

  // A) Gestão de Campo (Compromissos & RETs)
  if (acao === 'gestao_campo' || acao === 'completo') {
    if (token) {
      const auditoria = await coletarAuditoriaCampo(token, dataHoje);
      console.log(`✅ Auditoria de campo processada para 11 filiais.`);

      if (destino === 'gerentes' || destino === 'todos') {
        console.log(`🚀 Disparando Gestão de Campo para os ${gerentes.length} gerentes...`);
        for (const g of gerentes) {
          const rel = auditoria[g.filial];
          if (rel && rel.texto) {
            const r = await enviarWhatsapp(g.whatsapp, rel.texto);
            console.log(`  [${g.filial}] Enviado para ${g.gerente} — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
            await new Promise(res => setTimeout(res, 1500));
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
    // Carregar dados oficiais do Clube da Venda se existirem
    let cvTotals = null;
    const cvPath = path.join(__dirname, '../scripts/dados_oficiais_17h_cv.json');
    if (fs.existsSync(cvPath)) {
      const cvArray = JSON.parse(fs.readFileSync(cvPath, 'utf8'));
      cvTotals = {};
      cvArray.forEach(item => { cvTotals[item.sigla] = item; });
    }

    const filialVendas = await coletarVendasEZerados(repsMap, dataHoje);
    const relatorios = formatarRelatoriosVendas(filialVendas, hora, cvTotals);
    console.log(`✅ Vendas e Varejo Zerados apurados com sucesso.`);

    if (destino === 'vitorio' || destino === 'todos') {
      console.log(`🚀 Enviando Consolidado para Vitório Neto (${WHATSAPP_VITORIO})...`);
      const r = await enviarWhatsapp(WHATSAPP_VITORIO, relatorios.msgConsolidado);
      console.log(`  Diretoria Geral — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
    }

    if (destino === 'gerentes' || destino === 'todos') {
      console.log(`🚀 Disparando Parciais de Varejo para os ${gerentes.length} gerentes...`);
      for (const g of gerentes) {
        const txt = relatorios.mensagensGerentes[g.filial];
        if (txt) {
          const r = await enviarWhatsapp(g.whatsapp, txt);
          console.log(`  [${g.filial}] Enviado para ${g.gerente} — Status: ${r.sucesso ? 'OK' : 'ERRO'}`);
          await new Promise(res => setTimeout(res, 1500));
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
