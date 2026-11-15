// =========================================================================
// MONITOR.IA · functions/_lib/monitoria/analista.js
// Agente Analista Comercial por Varredura Continua (sem hora marcada).
// O codigo calcula 100% dos numeros e sinais no D1; a IA decide se vale
// agir agora, escolhe a alavanca de maior impacto e redige o WhatsApp.
// =========================================================================
import { hojeSP, R$, nome2, vn } from '../jota/base.js';
import { criaBase } from '../jota/fontes.js';
import { carregaEscopo, pctTxt, pessoaReal } from '../jota/escopo.js';
import { diasUteisMes } from '../jota/respostas/gestao.js';
import { nomeForn } from '../jota/respostas/metas_industria.js';
import {
  NUMEROS_VITORIO,
  listarRegras,
  nomeClienteD1,
} from './motor.js';
import { auditarLoopFechadoRoi, registrarCasoRoi } from './roi.js';
import R from '../../../public/regras.js';

const MODELO_WORKERS_AI = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function horaMinSP() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

async function resolveGeminiKey(env) {
  let k = env?.GEMINI_API_KEY || env?.GOOGLE_AI_KEY || '';
  if (!k && env?.DB) {
    try {
      const r = await env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'gemini_api_key'").first();
      if (r && r.valor) k = String(r.valor);
    } catch {}
  }
  return k;
}

function pioresIndustriasEquipe(RV, rcas, espPct) {
  if (!RV || !Array.isArray(RV.metas) || !Array.isArray(RV.apu)) return [];
  const porInd = new Map();
  for (const [c, codInd, nomeInd, tipo, m] of RV.metas) {
    if (tipo !== 1 || !(m > 0) || !rcas.has(String(c))) continue;
    const k = String(codInd);
    const cur = porInd.get(k) || { cod: k, nome: nomeForn(nomeInd), meta: 0, fat: 0 };
    cur.meta += Number(m) || 0;
    porInd.set(k, cur);
  }
  for (const a of RV.apu) {
    const k = String(a[1]);
    if (!rcas.has(String(a[0])) || !porInd.has(k)) continue;
    porInd.get(k).fat += Number(a[2]) || 0;
  }
  return [...porInd.values()]
    .filter((x) => x.meta >= 5000)
    .map((x) => ({ ...x, pct: (x.fat / x.meta) * 100, gap: Math.max(0, x.meta - x.fat) }))
    .filter((x) => x.pct < espPct * 0.75 && x.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);
}

export async function montarDossieSupervisor(db, Es, filial, bloqs, hhmm, enviosHoje = [], extras = {}) {
  const { tot, pass } = diasUteisMes();
  const faltam = Math.max(1, tot - pass);
  const espPct = tot ? (pass / tot) * 100 : 0;
  const vs = (Es.vend || []).filter((v) => pessoaReal(v) && v.meta > 0);
  if (!vs.length) return null;

  const metaTot = vs.reduce((a, v) => a + (v.meta || 0), 0);
  const fatTot = vs.reduce((a, v) => a + (v.fat || 0), 0);
  const pendTot = vs.reduce((a, v) => a + (v.pend || 0), 0);
  const digHoje = vs.reduce((a, v) => a + (v.dig || 0), 0);
  const devHoje = vs.reduce((a, v) => a + (v.devHoje || 0), 0);
  const posReal = vs.reduce((a, v) => a + (v.pos || 0), 0);
  const posMeta = vs.reduce((a, v) => a + (v.metaPos || 0), 0);

  const gapTot = Math.max(0, metaTot - fatTot - pendTot);
  const metaDia = gapTot / faltam;
  const pctReal = metaTot ? (fatTot / metaTot) * 100 : 0;
  const pctCart = metaTot ? ((fatTot + pendTot) / metaTot) * 100 : 0;
  const pctDia = metaDia > 0 ? (digHoje / metaDia) * 100 : 0;

  const assinaturasJa = new Set((enviosHoje || []).map((e) => String(e.acao_pos_alerta || '')));
  const rcas = new Set(vs.map((v) => String(v.rca)));
  const nomePorRca = new Map(vs.map((v) => [String(v.rca), nome2(v.nome)]));

  const bloqsNovos = [];
  for (const b of (bloqs || [])) {
    if (b.filial !== filial || !rcas.has(String(b.rca)) || Number(b.valor) < 500) continue;
    const sig = `BLOQ:${b.num}`;
    if (assinaturasJa.has(sig)) continue;
    const cli = await nomeClienteD1(db, b.filial, b.id_cliente);
    bloqsNovos.push({ num: b.num, rca: b.rca, vendedor: nomePorRca.get(String(b.rca)) || `RCA ${b.rca}`, cliente: cli, valor: Number(b.valor), data: b.data_pedido, corte: b.categoria_corte || null, sig });
    if (bloqsNovos.length >= 4) break;
  }

  const cortesNovos = [];
  for (const c of (extras.cortes || [])) {
    if (c.filial !== filial || !rcas.has(String(c.rca)) || Number(c.valor) < 500 || !(Number(c.itens_cortados) > 0)) continue;
    const valCortado = Number(c.valor_winthor) > 0 ? Math.max(0, Number(c.valor) - Number(c.valor_winthor)) : Number(c.valor);
    if (valCortado < 300) continue;
    const sig = `CORTE:${c.num}`;
    if (assinaturasJa.has(sig)) continue;
    const cli = await nomeClienteD1(db, c.filial, c.id_cliente);
    cortesNovos.push({ num: c.num, rca: c.rca, vendedor: nomePorRca.get(String(c.rca)) || `RCA ${c.rca}`, cliente: cli, valor: Number(c.valor), valor_winthor: Number(c.valor_winthor || 0), valor_cortado: valCortado, itens_cortados: Number(c.itens_cortados), categoria_corte: c.categoria_corte || null, sig });
    if (cortesNovos.length >= 3) break;
  }

  const pesoLance = { penalti: 5, vermelho: 4, golcontra: 3, impedimento: 2, amarelo: 1 };
  const lancesRuins = (extras.lances || [])
    .filter((l) => l.filial === filial && rcas.has(String(l.rca)) && /^(penalti|vermelho|amarelo|impedimento|golcontra)$/.test(String(l.nivel || '')))
    .sort((a, b) => (pesoLance[b.nivel] || 0) - (pesoLance[a.nivel] || 0))
    .map((l) => ({
      nivel: l.nivel,
      rca: String(l.rca),
      vendedor: nome2(l.vendedor || ''),
      cliente: l.cliente || '',
      motivo: l.pontos_motivo || l.motivo || '',
      pontos: l.pontos || 0,
      sig: `LANCE:${l.nivel}:${l.rca}:${String(l.cliente || '').slice(0, 24)}`,
    }))
    .filter((l) => !assinaturasJa.has(l.sig));

  const comGap = vs
    .map((v) => {
      const gap = Math.max(0, (v.meta || 0) - (v.fat || 0) - (v.pend || 0));
      const posPct = v.metaPos > 0 ? ((v.pos || 0) / v.metaPos) * 100 : null;
      return {
        rca: String(v.rca),
        nome: vn(v),
        nomeCurto: nome2(v.nome),
        pct: v.meta ? ((v.fat || 0) + (v.pend || 0)) / v.meta * 100 : 0,
        gapDia: gap / faltam,
        dig: v.dig || 0,
        visP: v.visP || 0,
        visF: v.visF || 0,
        pos: v.pos || 0,
        metaPos: v.metaPos || 0,
        posPct,
        posGap: v.metaPos > 0 ? Math.max(0, v.metaPos - (v.pos || 0)) : 0,
      };
    })
    .sort((a, b) => b.gapDia - a.gapDia);

  const emRotaSemPedido = hhmm >= '09:30' ? comGap.filter((x) => x.visF >= 2 && x.dig === 0).slice(0, 4) : [];
  const semCheckin = hhmm >= '09:30' ? comGap.filter((x) => x.visP > 0 && x.visF === 0 && x.dig === 0).slice(0, 4) : [];
  const posTravada = hhmm >= '10:00' ? [...comGap].filter((x) => x.posPct !== null && x.posPct < espPct * 0.7 && x.posGap > 0).sort((a, b) => b.posGap - a.posGap).slice(0, 4) : [];
  const destaques = [...comGap].filter((x) => x.dig > 0).sort((a, b) => b.dig - a.dig).slice(0, 3);
  const piorMix = (extras.mixVendedores || [])
    .filter((m) => m.filial === filial && rcas.has(String(m.rca)) && Number(m.mix_medio) > 0)
    .sort((a, b) => Number(a.mix_medio) - Number(b.mix_medio))[0] || null;
  const pioresInd = pioresIndustriasEquipe(extras.rv, rcas, espPct);

  const opRota = [];
  const alvosCli = new Map();
  for (const x of comGap.filter((g) => g.dig === 0).slice(0, 4)) {
    const vOrig = vs.find((v) => String(v.rca) === x.rca);
    const abertos = (vOrig && Array.isArray(vOrig.aVisitar)) ? vOrig.aVisitar : [];
    const { results: focos } = await db.prepare('SELECT id_cliente, tag FROM cliente_focos WHERE filial = ? AND rca = ? LIMIT 8').bind(filial, x.rca).all().catch(() => ({ results: [] }));
    const cliAlvos = [];
    for (const c of abertos.slice(0, 2)) {
      const nm = c.fantasia || c.nome || await nomeClienteD1(db, filial, c.codcli || c.id_cliente);
      cliAlvos.push(nm);
    }
    if (!cliAlvos.length && focos && focos.length) {
      for (const f of focos.slice(0, 2)) {
        const nm = await nomeClienteD1(db, filial, f.id_cliente);
        cliAlvos.push(`${nm} [${f.tag}]`);
      }
    }
    if (cliAlvos.length) {
      alvosCli.set(x.rca, cliAlvos);
      opRota.push({ rca: x.rca, vendedor: x.nome, gapDia: x.gapDia, clientes: cliAlvos });
    }
  }
  for (const x of emRotaSemPedido) x.clientes_alvo = alvosCli.get(x.rca) || [];

  const sinais = [];
  if (bloqsNovos.length) sinais.push({ tipo: 'BLOQUEIO_CRITICO', sig: bloqsNovos[0].sig, detalhe: bloqsNovos });
  if (cortesNovos.length) sinais.push({ tipo: 'CORTE_PEDIDO', sig: cortesNovos[0].sig, detalhe: cortesNovos });
  if (emRotaSemPedido.length) sinais.push({ tipo: 'EM_ROTA_SEM_PEDIDO', sig: `ROTA0:${emRotaSemPedido.map((x) => x.rca).join(',')}`, detalhe: emRotaSemPedido });
  if (opRota.length && hhmm >= '08:00') sinais.push({ tipo: 'OPORTUNIDADE_ROTA', sig: `OPROTA:${opRota[0].rca}`, detalhe: opRota });
  if (semCheckin.length) sinais.push({ tipo: 'SEM_CHECKIN', sig: `CHECK0:${semCheckin.map((x) => x.rca).join(',')}`, detalhe: semCheckin });
  if (devHoje >= 500) sinais.push({ tipo: 'DEVOLUCAO_HOJE', sig: `DEV:${Math.round(devHoje)}`, detalhe: devHoje });
  if (lancesRuins.length) sinais.push({ tipo: 'CHAMPIONS_PENALIDADE', sig: lancesRuins[0].sig, detalhe: lancesRuins.slice(0, 3) });
  if (posTravada.length) sinais.push({ tipo: 'POSITIVACAO_TRAVADA', sig: `POS:${posTravada.map((x) => x.rca).join(',')}`, detalhe: posTravada });
  if (pioresInd.length && hhmm >= '10:00') {
    sinais.push({ tipo: 'INDUSTRIA_ATRASADA', sig: `IND:${pioresInd[0].cod}`, detalhe: pioresInd });
  }
  if (hhmm >= '11:00' && hhmm < '17:30' && metaDia > 0 && digHoje < metaDia * 0.5) {
    sinais.push({ tipo: 'RITMO_DIA_BAIXO', sig: `RITMO:${hhmm.slice(0, 2)}`, detalhe: { digHoje, metaDia, pctDia } });
  }
  if (piorMix && hhmm >= '10:30') {
    sinais.push({ tipo: 'MIX_BAIXO', sig: `MIX:${piorMix.rca}`, detalhe: { rca: piorMix.rca, nome: piorMix.nome, mix_medio: piorMix.mix_medio, uso_pct: piorMix.uso_pct } });
  }
  if (hhmm >= '07:30' && hhmm < '09:30' && !enviosHoje.length) {
    sinais.push({ tipo: 'ABERTURA_MANHA', sig: 'ABERTURA', detalhe: comGap.slice(0, 3) });
  }
  if (hhmm >= '17:30' && hhmm <= '19:00' && !assinaturasJa.has('FECHAMENTO')) {
    sinais.push({ tipo: 'FECHAMENTO_DIA', sig: 'FECHAMENTO', detalhe: { digHoje, metaDia, pctDia } });
  }

  const sinalNovo = sinais.find((s) => !assinaturasJa.has(s.sig));
  if (!sinalNovo) return null;

  return {
    supervisor: Es.nome,
    filial,
    horario_sp: hhmm,
    dia_util: `${pass}/${tot} (faltam ${faltam})`,
    resumo: {
      meta_mes: R$(metaTot),
      faturado: R$(fatTot),
      carteira: R$(pendTot),
      pct_fat: pctTxt(pctReal),
      pct_com_carteira: pctTxt(pctCart),
      esperado_hoje: pctTxt(espPct),
      meta_dia_necessaria: R$(metaDia),
      digitado_hoje: R$(digHoje),
      pct_meta_dia: pctTxt(pctDia),
      positivacao: posMeta > 0 ? `${posReal}/${posMeta} (${pctTxt((posReal / posMeta) * 100)})` : 'sem meta pos.',
      devolucao_hoje: R$(devHoje),
      piores_industrias_equipe: pioresInd.map((x) => ({ industria: x.nome, atingido: pctTxt(x.pct), gap: R$(x.gap) })),
    },
    sinal_principal: sinalNovo,
    todos_sinais: sinais.map((s) => s.tipo),
    top_gaps_dia: comGap.slice(0, 3).map((x) => ({
      vendedor: x.nome,
      pct_mes: pctTxt(x.pct),
      precisa_dia: R$(x.gapDia),
      digitado_hoje: R$(x.dig),
      visitas: `${x.visF}/${x.visP}`,
    })),
    destaques_hoje: destaques.map((x) => ({ vendedor: x.nome, digitado_hoje: R$(x.dig) })),
    ja_enviados_hoje: enviosHoje.length,
  };
}

function mensagemFallback(d) {
  const s = d.sinal_principal;
  const r = d.resumo;
  if (s.tipo === 'BLOQUEIO_CRITICO') {
    const b0 = s.detalhe[0];
    return [
      `⚠️ *Pedido Bloqueado · ${R$(b0.valor)}*`,
      `Cliente *${b0.cliente}* · *${b0.vendedor || 'RCA ' + b0.rca}* (RCA ${b0.rca} · #${b0.num}).`,
      `📊 Hoje: *${r.digitado_hoje}* / *${r.meta_dia_necessaria}* (${r.pct_meta_dia}).`,
      '',
      `👉 *Ação agora:* acionar *${b0.vendedor || 'RCA ' + b0.rca}* para destravar crédito/preço antes do corte.`,
    ].join('\n');
  }
  if (s.tipo === 'EM_ROTA_SEM_PEDIDO') {
    const v0 = s.detalhe[0];
    const alvosTxt = v0.clientes_alvo && v0.clientes_alvo.length ? `\n🎯 Próximos alvos: *${v0.clientes_alvo.join('*, *')}*.` : '';
    return [
      `⏳ *Em Rota Sem Pedido · ${v0.nomeCurto}*`,
      `*${v0.nome}* já fez *${v0.visF} visitas* hoje com *R$ 0* (precisa *${R$(v0.gapDia)}/dia*).${alvosTxt}`,
      `📊 Equipe hoje: *${r.digitado_hoje}* / *${r.meta_dia_necessaria}* (${r.pct_meta_dia}).`,
      '',
      `👉 *Ação agora:* ligar para *${v0.nomeCurto}* e cobrar pedido nesses alvos agora.`,
    ].join('\n');
  }
  if (s.tipo === 'OPORTUNIDADE_ROTA') {
    const o0 = s.detalhe[0];
    return [
      `🎯 *Alvos Quentes na Rota · ${nome2(o0.vendedor)}*`,
      `*${o0.vendedor}* (precisa *${R$(o0.gapDia)}/dia*) tem clientes abertos hoje: *${o0.clientes.join('*, *')}*.`,
      '',
      `👉 *Ação agora:* direcionar *${nome2(o0.vendedor)}* para fechar pedido nesses clientes.`,
    ].join('\n');
  }
  if (s.tipo === 'SEM_CHECKIN') {
    const v0 = s.detalhe[0];
    return [
      `🛑 *Sem Check-in às ${d.horario_sp} · ${v0.nomeCurto}*`,
      `*${v0.nome}* tem *${v0.visP} PDVs* na rota hoje, *0 check-in* e *R$ 0* (precisa *${R$(v0.gapDia)}/dia*).`,
      '',
      `👉 *Ação agora:* ligar para *${v0.nomeCurto}* e confirmar início da rota.`,
    ].join('\n');
  }
  if (s.tipo === 'CHAMPIONS_PENALIDADE') {
    const l0 = s.detalhe[0];
    return [
      `⚽ *Alerta Champions · ${l0.nivel.toUpperCase()}*`,
      `*${l0.vendedor}* (RCA ${l0.rca}) no cliente *${l0.cliente || 'PDV'}* (${l0.motivo || 'penalidade'}).`,
      '',
      `👉 *Ação agora:* falar com *${l0.vendedor}* para corrigir na hora e evitar novos descontos na Liga.`,
    ].join('\n');
  }
  if (s.tipo === 'CORTE_PEDIDO') {
    const c0 = s.detalhe[0];
    return [
      `✂️ *Corte de ${R$(c0.valor_cortado || c0.valor)} · #${c0.num}*`,
      `*${c0.cliente}* · *${c0.vendedor || 'RCA ' + c0.rca}* (RCA ${c0.rca}) · *${c0.itens_cortados} itens cortados* de ${R$(c0.valor)}.`,
      '',
      `👉 *Ação agora:* acionar *${c0.vendedor || 'RCA ' + c0.rca}* para substituir SKU cortado antes de fechar a carga.`,
    ].join('\n');
  }
  if (s.tipo === 'POSITIVACAO_TRAVADA') {
    const p0 = s.detalhe[0];
    return [
      `👥 *Positivação Travada · ${p0.nomeCurto}*`,
      `Equipe em *${r.positivacao}*. *${p0.nome}* está em *${p0.pos}/${p0.metaPos}* (faltam ${p0.posGap} PDVs).`,
      '',
      `👉 *Ação agora:* cobrar de *${p0.nomeCurto}* abertura de novos PDVs já na rota de hoje.`,
    ].join('\n');
  }
  if (s.tipo === 'INDUSTRIA_ATRASADA') {
    const i0 = s.detalhe[0];
    return [
      `🏭 *Indústria Atrasada · ${i0.nome} (${pctTxt(i0.pct)})*`,
      `*${i0.nome}* está com gap de *${R$(i0.gap)}* no mês na sua equipe.`,
      '',
      `👉 *Ação agora:* puxar foco de *${i0.nome}* nos pedidos de hoje com o time.`,
    ].join('\n');
  }
  if (s.tipo === 'MIX_BAIXO') {
    const m0 = s.detalhe;
    return [
      `🧺 *Oportunidade +MIX · ${nome2(m0.nome || '')}*`,
      `RCA *${m0.rca} - ${nome2(m0.nome || '')}* está com média de apenas *${String(m0.mix_medio).replace('.', ',')} produtos/cliente*.`,
      '',
      `👉 *Ação agora:* cobrar uso da lista do +MIX antes de fechar cada pedido hoje.`,
    ].join('\n');
  }
  const g0 = d.top_gaps_dia[0];
  return [
    `🧠 *Ritmo do Dia · ${r.pct_meta_dia}*`,
    `Dia ${d.dia_util} · Fat.+Cart.: *${r.pct_com_carteira}* (esp. ${r.esperado_hoje}) · Hoje: *${r.digitado_hoje}* / *${r.meta_dia_necessaria}*.`,
    g0 ? `🎯 *Maior alavanca:* *${g0.vendedor}* (precisa *${g0.precisa_dia}/dia*, hoje *${g0.digitado_hoje}*).` : '',
    '',
    `👉 *Ação agora:* cobrar plano de pedido imediato do vendedor #1 de gap e positivação.`,
  ].filter(Boolean).join('\n');
}

export async function analisarComIA(env, dossie) {
  const sys = `Você é o Analista Comercial Sênior do MONITOR.IA (distribuidora Triunfante / +MIX).
Analise o dossiê JSON abaixo de um supervisor de vendas e decida:
1) Vale mandar mensagem no WhatsApp AGORA para fazê-lo vender mais hoje? (se já atingiu ritmo forte e não há bloqueio/vendedor travado, responda enviar=false)
2) Se enviar=true, escreva uma mensagem curta (máx 5 linhas), escaneável em 5 segundos no celular, começando a linha 1 pelo problema e valor em R$ (NÃO repita o nome do supervisor no título), citando o nome do vendedor, SEM inventar nenhum número (use APENAS os valores do JSON), com uma linha em branco antes de fechar com "👉 *Ação agora:* ...".

Responda SOMENTE JSON válido:
{"enviar": true, "prioridade": "ALTA", "motivo": "resumo curto", "mensagem": "texto whatsapp"}`;

  const userMsg = JSON.stringify(dossie);
  const geminiKey = await resolveGeminiKey(env);

  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${sys}\n\nDossiê:\n${userMsg}` }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.enviar === 'boolean') {
          return { ...parsed, motor_ia: 'gemini-2.5-flash' };
        }
      }
    } catch {}
  }

  if (env && env.AI) {
    try {
      const r = await env.AI.run(MODELO_WORKERS_AI, {
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 380,
        temperature: 0.2,
      });
      const txt = String((r && (r.response ?? r.result)) || '');
      const parsed = typeof (r && r.response) === 'object' ? r.response : JSON.parse((txt.match(/\{[\s\S]*\}/) || ['null'])[0]);
      if (parsed && typeof parsed.enviar === 'boolean') {
        return { ...parsed, motor_ia: MODELO_WORKERS_AI };
      }
    } catch {}
  }

  return {
    enviar: true,
    prioridade: dossie.sinal_principal.tipo === 'BLOQUEIO_CRITICO' ? 'ALTA' : 'MEDIA',
    motivo: dossie.sinal_principal.tipo,
    mensagem: mensagemFallback(dossie),
    motor_ia: 'deterministico',
  };
}

export async function executarAnalistaComercial(origin, env, opts = {}) {
  const db = env.DB;
  const hoje = hojeSP();
  const hhmm = String(opts.horario_sp || horaMinSP());

  const celTeste = String(opts.celularVitorio || NUMEROS_VITORIO[0]).replace(/\D/g, '');
  if (opts.enviarVitorio && !NUMEROS_VITORIO.includes(celTeste)) {
    return { ok: false, erro: 'Numero fora da whitelist de teste do Vitorio' };
  }

  const regras = await listarRegras(db);
  const regra = regras.find((r) => r.id === 'ANALISTA') || { id: 'ANALISTA', papel: 'supervisor', modo: 'SIMULACAO_VITORIO', ativo: 1 };
  if (!opts.forcar && (regra.ativo !== 1 || regra.modo === 'OFF')) {
    return { ok: true, regra: 'ANALISTA', modo: regra.modo, ativo: regra.ativo, processados: 0, motivo: 'Regra ANALISTA desligada' };
  }

  const { results: supsDb } = await db.prepare("SELECT celular, nome, filial, supervisor FROM bot_contatos WHERE papel = 'supervisor' AND ativo = 1 AND COALESCE(situacao,'ativo') = 'ativo' ORDER BY filial, nome").all().catch(() => ({ results: [] }));
  const filtroFiliais = Array.isArray(opts.filiais) && opts.filiais.length ? new Set(opts.filiais.map((f) => String(f).toUpperCase())) : null;
  const alvos = (supsDb || []).filter((s) => s.filial && (!filtroFiliais || filtroFiliais.has(String(s.filial).toUpperCase())));

  const B = criaBase(origin, env);
  const desde = new Date(Date.parse(hoje + 'T12:00:00Z') - 2 * 864e5).toISOString().slice(0, 10);
  const [bloqsRes, cortesRes, lancesData, mixData, rvData] = await Promise.all([
    db.prepare("SELECT num, filial, rca, id_cliente, data_pedido, valor, categoria_corte FROM pedido_status WHERE status = 'BLOQUEADO' AND data_pedido >= ? ORDER BY valor DESC LIMIT 200").bind(desde).all().catch(() => ({ results: [] })),
    db.prepare("SELECT num, filial, rca, id_cliente, data_pedido, valor, valor_winthor, itens_cortados, categoria_corte FROM pedido_status WHERE data_pedido >= ? AND itens_cortados > 0 AND valor >= 500 ORDER BY itens_cortados DESC, valor DESC LIMIT 200").bind(desde).all().catch(() => ({ results: [] })),
    B.lances().catch(() => null),
    B.mix().catch(() => null),
    B.rv().catch(() => null),
  ]);
  const bloqs = bloqsRes.results || [];
  const cortes = cortesRes.results || [];

  const limite = Number(opts.limite || (regra.modo === 'PRODUCAO' ? 30 : 65));
  const maxPorDia = Number(opts.maxPorDia || 4);
  const cfg = env.EVO_URL && env.EVO_KEY ? R.evoCfg(env) : null;

  const resultados = [];
  let alertasGerados = 0;
  let silencios = 0;
  let enviadosReal = 0;
  let amostraEnviada = false;

  for (const s of alvos) {
    if (alertasGerados >= limite) break;

    const enviosHoje = (await db.prepare("SELECT acao_pos_alerta, enviado_em FROM monitoria_envios WHERE regra_id = 'ANALISTA' AND data = ? AND destino_real = ?")
      .bind(hoje, s.nome).all().catch(() => ({ results: [] }))).results || [];
    if (enviosHoje.length >= maxPorDia) continue;

    const supNomeAlvo = s.supervisor || s.nome;
    const Es = await carregaEscopo(B, { nome: `${supNomeAlvo} (${s.filial})`, filiais: [s.filial], supervisor: supNomeAlvo }).catch(() => null);
    if (!Es || !Es.vend || !Es.vend.length) continue;

    if (regra.modo === 'PRODUCAO') {
      await auditarLoopFechadoRoi(db, Es, s.filial);
    }

    const dossie = await montarDossieSupervisor(db, Es, s.filial, bloqs, hhmm, enviosHoje, {
      cortes,
      lances: lancesData?.lances || [],
      mixVendedores: mixData?.vendedores || [],
      rv: rvData,
    });
    if (!dossie) continue;

    // Cruzamento MONITOR.IA <-> JOTA: le contexto recente do supervisor no JOTA (ultimas 3h em bot_msgs)
    if (s.celular) {
      const jotaMsgs = (await db.prepare(
        "SELECT direcao, substr(texto, 1, 180) texto, quando FROM bot_msgs WHERE celular = ? AND direcao IN ('in','out') AND quando >= datetime('now','-3 hours') ORDER BY id DESC LIMIT 4"
      ).bind(String(s.celular)).all().catch(() => ({ results: [] }))).results || [];
      if (jotaMsgs.length) dossie.conversa_jota_recente = jotaMsgs.reverse();
    }

    const decisao = await analisarComIA(env, dossie);
    if (!decisao || !decisao.enviar || !decisao.mensagem) {
      silencios++;
      continue;
    }

    let status = 'SIMULADO';
    let celDestino = 'SIMULACAO';
    if (regra.modo === 'PRODUCAO' && cfg) {
      if (enviadosReal > 0) await R.pausaEntreEnvios(4, 1, 2);
      const rt = await R.enviarTexto(cfg, s.celular, decisao.mensagem);
      status = rt.ok ? 'ENVIADO' : 'ERRO';
      celDestino = s.celular;
      if (rt.ok) {
        enviadosReal++;
        // Registra em bot_msgs para que o JOTA saiba o que o MONITOR.IA acabou de cobrar se o supervisor responder no WhatsApp
        await db.prepare(
          "INSERT INTO bot_msgs (celular, direcao, texto, tipo) VALUES (?, 'out', ?, 'monitoria_analista')"
        ).bind(String(s.celular), String(decisao.mensagem).slice(0, 1500)).run().catch(() => {});
      }
    } else if (opts.enviarVitorio && !amostraEnviada && cfg) {
      const rt = await R.enviarTexto(cfg, celTeste, `🧪 *[SIMULAÇÃO ANALISTA IA · ${s.nome}]*\n\n${decisao.mensagem}`);
      if (rt.ok) {
        amostraEnviada = true;
        status = 'AMOSTRA_VITORIO';
        celDestino = celTeste;
      }
    }

    await db.prepare(
      'INSERT INTO monitoria_envios (regra_id, data, celular, destino_real, papel, filial, rca, modo, bonequinho, status, texto_preview, acao_pos_alerta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      'ANALISTA',
      hoje,
      celDestino,
      s.nome,
      'supervisor',
      s.filial,
      '',
      regra.modo,
      decisao.motor_ia,
      status,
      String(decisao.mensagem).slice(0, 600),
      dossie.sinal_principal.sig
    ).run().catch(() => {});

    if (status === 'ENVIADO') {
      const sp = dossie.sinal_principal;
      if (sp.tipo === 'BLOQUEIO_CRITICO' && sp.detalhe[0]) {
        await registrarCasoRoi(db, { data: hoje, filial: s.filial, supervisor: s.nome, tipo: sp.tipo, referencia: sp.detalhe[0].num, rca: sp.detalhe[0].rca, valor_em_risco: sp.detalhe[0].valor, detalhe: sp.detalhe[0].cliente });
      } else if ((sp.tipo === 'EM_ROTA_SEM_PEDIDO' || sp.tipo === 'SEM_CHECKIN' || sp.tipo === 'OPORTUNIDADE_ROTA') && sp.detalhe[0]) {
        await registrarCasoRoi(db, { data: hoje, filial: s.filial, supervisor: s.nome, tipo: sp.tipo, referencia: sp.detalhe[0].rca, rca: sp.detalhe[0].rca, valor_em_risco: sp.detalhe[0].gapDia || 0, detalhe: sp.detalhe[0].vendedor || sp.detalhe[0].nome });
      }
    }

    alertasGerados++;
    resultados.push({
      supervisor: s.nome,
      filial: s.filial,
      status,
      sinal: dossie.sinal_principal.tipo,
      prioridade: decisao.prioridade,
      motor: decisao.motor_ia,
      preview: String(decisao.mensagem).slice(0, 260),
    });
  }

  return {
    ok: true,
    regra: 'ANALISTA',
    modo: regra.modo,
    horario_sp: hhmm,
    supervisores_elegiveis: alvos.length,
    silencios_ia: silencios,
    processados: resultados.length,
    enviados_producao: enviadosReal,
    amostra_vitorio: amostraEnviada,
    resultados,
  };
}

