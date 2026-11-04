// =========================================================================
// JOTA · functions/_lib/jota/respostas/segmentos_pastas.js
// O QUE É: Análise de segmentos (CNAE / ramo de atividade dos clientes)
// e controle de pastas de indústrias por filial / gerente / supervisor / vendedor.
// (Vitório, 30/10/2026: Cleverson MCD, Allison TPH, segmentos por CNPJ).
// =========================================================================

import { R$, P, N, titulo, nome2, vn, SUGESTAO, sem } from '../base.js';
import { analisaEstrategiaComGemini } from '../gemini.js';

// Pastas oficiais parametrizadas
export const REGRAS_PASTAS = {
  // Cleverson (MCD): só vende Colgate, Red Bull e AB Mauri. MP é do Adriano!
  MCD_CLEVERSON: {
    industrias_permitidas: ['COLGATE', 'RED BULL', 'AB MAURI'],
    marcas_proprias: false,
    aviso: 'A equipe do gestor Cleverson em MCD atua exclusivamente com Colgate, Red Bull e AB Mauri. Marcas Próprias (MP) pertencem ao gestor Adriano.'
  },
  // Allison (TPH): Vendedor 63 (Anderson)
  TPH_VEND_63: {
    industrias_permitidas: ['QUIMICA AMPARO', 'HEINZ BRASIL', 'MARS PET', 'LEAO', 'BR SPICE'],
    industrias_bloqueadas: ['MARS CHOC', 'TOPEI', 'TRIUNFANTE CORPORATIVO', 'HEINZ-HEMMER', 'HEINZ - HEMMER'],
    aviso: 'O vendedor 63 (Anderson / TPH) tem meta nas indústrias: Química Amparo, Heinz Brasil, Mars Pet, Leão e Br Spice. Não contabiliza Mars Choc, Topei, Triunfante Corporativo e Heinz-Hemmer.'
  }
};

// 1. RESPOSTA DE SEGMENTOS E RAMO DE ATIVIDADE (CNAE)
export async function respSegmentoCnae(B, E, t, pessoa) {
  let mx;
  try {
    mx = await B.mix() || {};
  } catch (e) {
    return '📊 Não consegui carregar a base de segmentos e CNAEs agora. Tente em alguns minutos.';
  }

  const V = (mx && mx.vendedores) || [];
  let alvoVend = null;

  if (pessoa && pessoa.tipo === 'vend') {
    alvoVend = V.find((v) => String(v.rca) === String(pessoa.alvo.rca) && v.filial === pessoa.alvo.filial);
  } else if (E.rca) {
    alvoVend = V.find((v) => String(v.rca) === String(E.rca) && v.filial === E.filiais[0]);
  }

  if (alvoVend && alvoVend.atividades && alvoVend.atividades.length) {
    const ativs = alvoVend.atividades.slice(0, 7);
    const totalCli = alvoVend.carteira || alvoVend.clientes || 1;
    const top = ativs[0];

    return [
      `🏪 *Perfil de Clientes por Segmento / CNAE — ${vn(alvoVend)}* (${alvoVend.filial})`,
      `Carteira mapeada: *${totalCli} clientes*`,
      '',
      `🏆 *Segmento onde mais vende:* *${top.c}* (${top.n} clientes · ${top.pct ? top.pct + '%' : P(top.n, totalCli)})`,
      '',
      '*Divisão por segmento na carteira:*',
      ...ativs.map((a, i) => `${i + 1}. *${a.c}*: ${a.n} clientes (${a.pct ? a.pct + '%' : P(a.n, totalCli)})`),
      '',
      SUGESTAO + `explorar o mix de produtos específicos para ${top.c}, onde está a maior concentração da sua rota!`
    ].join('\n');
  }

  // Visão equipe / supervisor / filial
  const vendsFiltrados = V.filter((v) => E.filiais.includes(v.filial) && (!E.supervisor || v.supervisor === E.supervisor));
  if (!vendsFiltrados.length) {
    return `📊 Não encontrei dados de segmento/CNAE para ${E.nome} na base do +MIX.`;
  }

  const mapaAtiv = new Map();
  let totGeral = 0;
  for (const v of vendsFiltrados) {
    for (const a of (v.atividades || [])) {
      mapaAtiv.set(a.c, (mapaAtiv.get(a.c) || 0) + (a.n || 0));
      totGeral += (a.n || 0);
    }
  }

  const ord = [...mapaAtiv.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!ord.length) return `📊 Os segmentos dos clientes de ${E.nome} ainda estão sendo compilados na base.`;

  return [
    `🏪 *Segmentos de Clientes mais Atendidos — ${E.nome}*`,
    `Total de clientes mapeados por CNAE: *${totGeral}*`,
    '',
    '*Principais segmentos de atuação:*',
    ...ord.map(([seg, qtd], i) => `${i + 1}. *${seg}*: ${qtd} clientes (${P(qtd, totGeral)})`),
    '',
    SUGESTAO + 'alinhar as campanhas e metas de indústria de acordo com os segmentos de maior força da equipe.'
  ].join('\n');
}

// 2. RESPOSTA DE PASTAS E INDÚSTRIAS POR GESTOR / VENDEDOR
export function respPastas(c, t, pessoa) {
  const tUpper = String(t || '').toUpperCase();
  const filial = (c && c.filial) || '';

  // Caso Cleverson / MCD
  if (/CLEVERSON/i.test(c?.nome || '') || /MCD/.test(filial) && /CLEVERSON/.test(tUpper)) {
    return [
      '📂 *Pastas de Indústrias — Gestão Cleverson (MCD)*',
      '',
      'A equipe do gestor Cleverson em MCD atua exclusivamente com:',
      '• *Colgate*',
      '• *Red Bull*',
      '• *AB Mauri*',
      '',
      '📌 *Marcas Próprias (MP)*: pertence integralmente à equipe do gestor *Adriano* (MCD).',
      '',
      '💡 O Jota já está parametrizado para não cobrar e não exibir Marcas Próprias nas metas da equipe do Cleverson.'
    ].join('\n');
  }

  // Caso Allison / TPH
  if (/ALLISON/i.test(c?.nome || '') || (/TPH/.test(filial) && /63|ANDERSON/.test(tUpper))) {
    return [
      '📂 *Pastas de Indústrias — Vendedor 63 (Anderson) · Sup. Allison (TPH)*',
      '',
      '✅ *Indústrias que PERTENCEM à pasta:*',
      '• Química Amparo',
      '• Heinz Brasil',
      '• Mars Pet',
      '• Leão',
      '• Br Spice',
      '',
      '🚫 *Indústrias EXCLUÍDAS da pasta (não cobradas no mix):*',
      '• Mars Choc',
      '• Topei',
      '• Triunfante Corporativo - Ctd/adm',
      '• Heinz - Hemmer',
      '',
      '💡 Os relatórios de mix e metas do vendedor 63 consideram apenas as 5 indústrias oficiais da sua pasta.'
    ].join('\n');
  }

  return [
    '📂 *Parametrização de Pastas por Filial e Vendedor*',
    '',
    'Cada vendedor e supervisor possui sua pasta de indústrias vinculada à sua filial e grupo.',
    'Se houver alguma indústria atribuída incorretamente na sua visão, avise com "sugestão: ajustar pasta de <vendedor>" que o Jota atualiza os filtros na hora!'
  ].join('\n');
}

// 3. ESTRATÉGIA DE RECUPERAÇÃO DE VENDAS / TOP CLIENTES (Caso Fábio TBL - 500 mil)
export async function respEstrategiaFabio(env, B, c, texto, E) {
  const filAlvo = (E.filiais && E.filiais.length === 1) ? E.filiais[0] : (E.filial || 'TBL');
  let ant, mes, reps;
  try {
    ant = JSON.parse(await B.raw(`public/vendas_mes_anterior/${filAlvo}.json`) || '{}');
    mes = JSON.parse(await B.raw(`public/vendas_mes/${filAlvo}.json`) || '{}');
    reps = JSON.parse(await B.raw('public/mostra_vendedores.json') || '{}');
  } catch (e) {
    return `📊 Base de fechamento de ${filAlvo} sendo compilada. Tente em alguns minutos.`;
  }

  const rcaMap = {};
  for (const v of ((reps.filiais && reps.filiais[filAlvo]) || [])) {
    rcaMap[String(v.rca)] = { nome: v.nome, supervisor: v.supervisor };
  }

  const totSet = {}, totOut = {}, cliNome = { ...(ant.clientes || {}), ...(mes.clientes || {}) }, rcaCli = {};

  for (const l of (ant.l || [])) {
    const cod = String(l[2]);
    totSet[cod] = (totSet[cod] || 0) + (l[5] || 0);
    rcaCli[cod] = String(l[1]);
  }

  for (const l of (mes.l || [])) {
    const cod = String(l[2]);
    totOut[cod] = (totOut[cod] || 0) + (l[5] || 0);
    rcaCli[cod] = String(l[1]);
  }

  const gaps = [];
  for (const [cod, vSet] of Object.entries(totSet)) {
    const vOut = totOut[cod] || 0;
    const gap = vSet - vOut;
    if (gap >= 5000) {
      const rInfo = rcaMap[rcaCli[cod]] || { nome: 'RCA ' + rcaCli[cod], supervisor: 'Outros ' + filAlvo };
      gaps.push({
        cod,
        nome: titulo(cliNome[cod] || 'Cliente ' + cod),
        rca: rcaCli[cod],
        rcaNome: nome2(rInfo.nome),
        supervisor: rInfo.supervisor || 'Geral ' + filAlvo,
        vSet: Math.round(vSet),
        vOut: Math.round(vOut),
        gap: Math.round(gap)
      });
    }
  }

  // Divisão estratégica solicitada (Vitório, 30/10/2026: geral, apenas faturamento ou positivação)
  const tNormE = sem(texto || '');
  const ehFocoFat = /APENAS FATURAMENTO|SO FATURAMENTO|FOCO FATURAMENTO/.test(tNormE);
  const ehFocoPos = /APENAS POSITIVACAO|SO POSITIVACAO|FOCO POSITIVACAO|\bPOSITIVACAO\b/.test(tNormE) && !ehFocoFat;
  const tituloFoco = ehFocoFat ? ' [Foco: Volume e Faturamento]' : ehFocoPos ? ' [Foco: Positivação e Inativos Zero]' : ' [Visão Geral]';

  let gapsFiltrados = gaps;
  if (ehFocoPos) {
    gapsFiltrados = gaps.filter((g) => g.vOut === 0);
  }

  gapsFiltrados.sort((a, b) => b.gap - a.gap);
  const totalGapGeral = gapsFiltrados.reduce((s, g) => s + g.gap, 0);

  // Agrupa por supervisor
  const porSup = {};
  for (const g of gapsFiltrados) {
    const s = g.supervisor;
    if (!porSup[s]) porSup[s] = [];
    porSup[s].push(g);
  }

  const supsOrd = Object.entries(porSup).sort((a, b) => {
    const sA = a[1].reduce((acc, x) => acc + x.gap, 0);
    const sB = b[1].reduce((acc, x) => acc + x.gap, 0);
    return sB - sA;
  });

  // Tenta gerar análise estratégica sênior via Gemini Generativo
  try {
    const dadosContexto = {
      filial: filAlvo,
      totalGapGeral,
      foco: ehFocoFat ? 'Volume e Faturamento' : ehFocoPos ? 'Positivação e Inativos Zero' : 'Geral',
      supervisores: supsOrd.slice(0, 5).map(([sup, lista]) => ({
        supervisor: sup,
        buracoTotal: lista.reduce((s, x) => s + x.gap, 0),
        topContasQueda: lista.slice(0, 3).map((g) => ({
          cliente: g.nome,
          codigo: g.cod,
          rca: `${g.rca} (${g.rcaNome})`,
          compraSetembro: g.vSet,
          compraOutubro: g.vOut,
          gapRecuperar: g.gap
        }))
      }))
    };
    const iaOut = await analisaEstrategiaComGemini({ env, B, c, texto, E, dadosContexto });
    if (iaOut && iaOut.length > 100) {
      return iaOut;
    }
  } catch (e) {
    console.error('Falha Gemini Estratégico:', e);
  }

  const out = [
    `🎯 *ESTRATÉGIA EXECUTIVA ${filAlvo} — PLANO DE RECUPERAÇÃO*${tituloFoco}`,
    `Análise de contas reais: *${gapsFiltrados.length} clientes Curva A/B* ${ehFocoPos ? 'sem nenhuma compra em Outubro' : 'com perda de faturamento em relação a Setembro'}.`,
    `💰 *Buraco total identificado:* *${R$(totalGapGeral)}*.`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  ];

  for (const [sup, lista] of supsOrd.slice(0, 4)) {
    const somaGap = lista.reduce((s, x) => s + x.gap, 0);
    out.push(`👤 *EQUIPE: Sup. ${nome2(sup)}* (Buraco Total: *${R$(somaGap)}*)`);
    out.push('*As 3 Maiores Contas para Fechar Hoje:*');
    for (const g of lista.slice(0, 3)) {
      const statusOut = g.vOut === 0 ? '❌ *ZERO em Outubro*' : `Comprou só ${R$(g.vOut)}`;
      out.push(`• *${g.nome}* (#${g.cod}) — RCA: ${g.rca} (${g.rcaNome})`);
      out.push(`  Set: ${R$(g.vSet)} ➔ Out: ${statusOut} | *Falta: ${R$(g.gap)}*`);
    }
    out.push('');
  }

  out.push(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📲 *MENSAGEM PRONTA PARA ENVIAR AOS SUPERVISORES:*',
    '',
    `_"Time ${filAlvo}, analisamos os clientes que compraram forte no mês passado e despencaram ou zeraram neste mês. O nosso gap está concentrado nas 3 maiores contas de cada equipe. Precisamos acionar esses clientes com reposição imediata para faturar ainda hoje. Foco total nelas!"_`,
    '',
    SUGESTAO + 'peça "prospecção vendedor <código>" para ver os clientes da rota de hoje de cada RCA.'
  );

  return out.join('\n');
}

// 4. CLIENTES PARA PROSPECÇÃO NO MAPA (CEVEN MAPAS / PROSPECÇÃO NA ROTA)
export async function respProspeccaoMapas(B, E, t, pessoa) {
  let mx;
  try {
    mx = await B.mix() || {};
  } catch (e) {
    mx = {};
  }

  const V = (mx && mx.vendedores) || [];
  let alvoVend = null;

  // Extrai RCA direto da mensagem se citado (ex: "prospecção 115", "setor 290", "prospecção vendedor 115")
  const mRca = String(t || '').match(/\b(?:VENDEDOR|RCA|SETOR|COD(?:IGO)?\s*)?(\d{1,5})\b/);
  const codCitado = mRca ? mRca[1] : null;

  // Filtro de segmento / CNAE solicitado (Vitório, 30/10/2026: "apenas postos e conveniências")
  const tNorm = sem(t || '');
  let filtroSeg = null;
  let nomeFiltroSeg = '';
  if (/POSTO|CONVENIENCIA|COMBUSTIVEL/.test(tNorm)) {
    filtroSeg = /POSTO|CONVENIENCIA|COMBUSTIVEL|LUBRIFICANTE/i;
    nomeFiltroSeg = 'Postos e Conveniências';
  } else if (/PADARIA|CONFEITARIA|PANIF/.test(tNorm)) {
    filtroSeg = /PADARIA|CONFEITARIA|PANIFIC/i;
    nomeFiltroSeg = 'Padarias e Confeitarias';
  } else if (/MERCADO|MERCEARIA|SUPERMERCADO/.test(tNorm)) {
    filtroSeg = /MERCADO|MERCEARIA|SUPERMERCADO|HIPERMERCADO/i;
    nomeFiltroSeg = 'Mercados e Mercearias';
  } else if (/FARMACIA|DROGARIA/.test(tNorm)) {
    filtroSeg = /FARMACIA|DROGARIA/i;
    nomeFiltroSeg = 'Farmácias e Drogarias';
  } else if (/BAR\b|LANCHONETE|RESTAURANTE/.test(tNorm)) {
    filtroSeg = /BAR\b|LANCHONETE|RESTAURANTE/i;
    nomeFiltroSeg = 'Bares e Restaurantes';
  }

  if (pessoa && pessoa.tipo === 'vend') {
    alvoVend = V.find((v) => String(v.rca) === String(pessoa.alvo.rca) && (!pessoa.alvo.filial || v.filial === pessoa.alvo.filial)) || pessoa.alvo;
  } else if (codCitado && !['10', '20', '30', '50'].includes(codCitado)) {
    alvoVend = V.find((v) => String(v.rca) === codCitado && (!E.filiais || !E.filiais.length || E.filiais.includes(v.filial))) ||
               V.find((v) => String(v.rca) === codCitado) ||
               (E.vend || []).find((v) => String(v.rca) === codCitado);
  } else if (E.rca) {
    alvoVend = V.find((v) => String(v.rca) === String(E.rca) && v.filial === E.filiais[0]) || (E.vend || []).find((v) => String(v.rca) === String(E.rca));   // vendedor sem rota hoje tambem ve os prospects dele (02/11/2026)
  } else if (E.vend && E.vend.length === 1) {
    alvoVend = V.find((v) => String(v.rca) === String(E.vend[0].rca) && v.filial === E.vend[0].filial) || E.vend[0];
  }

  // Base unica: so le a base; a chamada ao CEVEN daqui foi retirada em 31/10/2026 (docs/BASE_UNICA.md)
  if (alvoVend) {
    const db = B.env && B.env.DB;
    if (!db) return `📍 *Prospects — ${vn(alvoVend)}*: a base de prospecção não está disponível agora; não vou afirmar que está sem pontos.`;
    let status;
    try {
      status = await db.prepare('SELECT data_ref, estado, total FROM prospects_coleta_status WHERE filial = ? AND rca = ?')
        .bind(String(alvoVend.filial), String(alvoVend.rca)).first();
    } catch (e) {
      return `📍 *Prospects — ${vn(alvoVend)}*: não consegui consultar o estado da coleta; não vou afirmar que está sem pontos.`;
    }
    if (!status || status.data_ref !== hojeSP() || status.estado !== 'ok') {
      return `📍 *Prospects — ${vn(alvoVend)}*: a coleta de hoje não confirmou a lista desse vendedor. Pode estar pendente; não vou afirmar que está sem pontos.`;
    }
    let prs;
    try {
      const { results } = await db.prepare('SELECT cnpj, json FROM prospects_mapa WHERE filial = ? AND rca = ?')
        .bind(String(alvoVend.filial), String(alvoVend.rca)).all();
      prs = (results || []).map((r) => ({ cnpj: r.cnpj, ...JSON.parse(r.json) })).sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
    } catch (e) {
      return `📍 *Prospects — ${vn(alvoVend)}*: falha ao ler a lista da base; não vou afirmar que está sem pontos.`;
    }
    if (filtroSeg && prs.length) { const fi = prs.filter((p) => filtroSeg.test(p.cnae || '') || filtroSeg.test(p.razao || '') || filtroSeg.test(p.fantasia || '')); if (fi.length) prs = fi; }
    if (prs.length) return [
      `📍 *Prospects — ${vn(alvoVend)}* (${alvoVend.filial})${nomeFiltroSeg ? ` [Foco: ${nomeFiltroSeg}]` : ''}`, `${prs.length} na lista do CEVEN; os 5 mais perto da rota:`, '',
      ...prs.slice(0, 5).map((p, i) => `${i + 1}. *${titulo(p.fantasia || p.razao || 'Sem nome')}* (${p.cnae || 'sem CNAE'})\n   📍 CNPJ: ${p.cnpj}${p.km != null ? ' · ' + String(p.km).replace('.', ',') + ' km' : ''}${p.tel ? '\n   📞 ' + p.tel : ''}${p.lat && p.lon ? '\n   🌐 https://maps.google.com/?q=' + p.lat + ',' + p.lon : ''}`),
      '', SUGESTAO + 'passar nesses pontos durante a rota e cadastrar no LinkUp.'].join('\n');
    return `📍 *Prospecção no Mapa — ${vn(alvoVend)}*: a coleta de hoje foi concluída e confirmou 0 prospects.`;
  }

  // Visão equipe / supervisor
  return [
    `📍 *Prospecção de Clientes no Mapa — ${E.nome}*`,
    '',
    'Para ver a lista de clientes para prospectar no trajeto da rota:',
    '• Me pergunte: *"prospecção vendedor <código>"* (ex: "prospecção vendedor 115")',
    '• Ou cite o nome: *"prospects da rota do Claudio"*',
    '',
    '💡 O Jota cruza a localização dos clientes da rota de hoje com a base da Receita e do CEVEN Mapas para indicar estabelecimentos comerciais vizinhos que ainda não compram!'
  ].join('\n');
}
