// =========================================================================
// MONITOR.IA · functions/_lib/monitoria/detector.js
// Detector automatico de eventos e excecoes em tempo real (100% D1).
// Gera domain_events idempotentes e alertas acionaveis em modo seguro.
// =========================================================================
import { hojeSP, N, R$, vn } from '../jota/base.js';
import { criaBase } from '../jota/fontes.js';
import { carregaEscopo, agrupa, pessoaReal, supChave, supNome, supReal } from '../jota/escopo.js';
import { emitirEvento, nomeClienteD1, NUMEROS_VITORIO, BONEQUINHO_MIDIA } from './motor.js';
import R from '../../../public/regras.js';

const FILIAIS_BR = ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];

function diasAtrasSP(dias) {
  const ms = Date.parse(hojeSP() + 'T12:00:00Z') - dias * 864e5;
  return new Date(ms).toISOString().slice(0, 10);
}

export async function detectarEventos(origin, env, opts = {}) {
  const db = env.DB;
  const hoje = hojeSP();
  const desde = opts.desde || diasAtrasSP(3);
  const celRaw = String(opts.celularVitorio || NUMEROS_VITORIO[0]).replace(/\D/g, '');
  if (opts.enviarVitorio && !NUMEROS_VITORIO.includes(celRaw)) {
    return { ok: false, erro: 'Numero fora da whitelist de teste do Vitorio' };
  }

  const novos = [];
  const regEv = async (ev) => {
    await emitirEvento(db, ev);
    novos.push({ type: ev.event_type, key: ev.entity_key, filial: ev.filial || null, rca: ev.rca || null, payload: ev.payload });
  };

  // 1. PEDIDO_BLOQUEADO e PEDIDO_CORTADO (ultimos dias em pedido_status)
  const [{ results: bloqs }, { results: cortes }] = await Promise.all([
    db.prepare("SELECT num, filial, rca, id_cliente, data_pedido, valor FROM pedido_status WHERE status = 'BLOQUEADO' AND data_pedido >= ? ORDER BY valor DESC LIMIT 30").bind(desde).all().catch(() => ({ results: [] })),
    db.prepare('SELECT num, filial, rca, id_cliente, data_pedido, valor, itens_cortados, categoria_corte FROM pedido_status WHERE COALESCE(itens_cortados, 0) > 0 AND data_pedido >= ? ORDER BY valor DESC LIMIT 20').bind(desde).all().catch(() => ({ results: [] })),
  ]);

  for (const b of bloqs || []) {
    await regEv({
      event_type: 'PEDIDO_BLOQUEADO',
      entity_key: `BLOQ:${b.num}:${b.data_pedido}`,
      filial: b.filial,
      rca: b.rca,
      source: 'pedido_status',
      payload: { num: b.num, cliente: b.id_cliente, data: b.data_pedido, valor: Number(b.valor) || 0 },
    });
  }
  for (const c of cortes || []) {
    await regEv({
      event_type: 'PEDIDO_CORTADO',
      entity_key: `CORTE:${c.num}:${c.data_pedido}`,
      filial: c.filial,
      rca: c.rca,
      source: 'pedido_status',
      payload: { num: c.num, cliente: c.id_cliente, data: c.data_pedido, valor: Number(c.valor) || 0, itens: c.itens_cortados, cat: c.categoria_corte || '' },
    });
  }

  // 2. Excecoes operacionais da arvore Brasil (D1 central_snapshot)
  const B = criaBase(origin, env);
  const Ed = await carregaEscopo(B, { nome: 'Brasil', filiais: FILIAIS_BR, nacional: true }).catch(() => null);
  let resumoRiscoFiliais = [];
  if (Ed && Ed.vend) {
    const semInicio = Ed.vend.filter((v) => pessoaReal(v) && v.meta > 0 && (v.visP || 0) > 0 && (v.visF || 0) === 0);
    for (const v of semInicio.slice(0, 20)) {
      await regEv({
        event_type: 'SEM_INICIO_ROTA',
        entity_key: `SEMVIS:${hoje}:${v.filial}:${v.rca}`,
        filial: v.filial,
        rca: v.rca,
        source: 'central_snapshot',
        payload: { nome: vn(v), visP: v.visP, meta: v.meta },
      });
    }

    const porFilial = [...agrupa(Ed.vend, (v) => v.filial)]
      .map(([f, x]) => ({ filial: f, pct: x.pct || 0, fat: x.fat || 0, meta: x.meta || 0, bloqVlr: x.bloqVlr || 0, bloqQtd: x.bloqQtd || 0, zerados: x.zerados || 0 }))
      .filter((x) => x.meta > 0)
      .sort((a, b) => b.bloqVlr - a.bloqVlr);

    resumoRiscoFiliais = porFilial.filter((f) => f.bloqVlr >= 50000).slice(0, 5);
    for (const f of resumoRiscoFiliais) {
      await regEv({
        event_type: 'FILIAL_EM_RISCO',
        entity_key: `RISCO:${hoje}:${f.filial}`,
        filial: f.filial,
        source: 'central_snapshot',
        payload: f,
      });
    }

    const porSup = [...agrupa(Ed.vend, (v) => `${v.filial}|${supChave(v, true)}`)]
      .filter(([k, x]) => supReal(k.split('|')[1]) && x.zerados >= 3)
      .sort((a, b) => b[1].zerados - a[1].zerados)
      .slice(0, 5);
    for (const [k, x] of porSup) {
      const [filial, sup] = k.split('|');
      await regEv({
        event_type: 'EQUIPE_ZERADA',
        entity_key: `SUPZER:${hoje}:${filial}:${sup}`,
        filial,
        source: 'central_snapshot',
        payload: { supervisor: supNome(sup), zerados: x.zerados, pct: x.pct },
      });
    }
  }

  // 3. Montar alertas proativos em tempo real (1 por papel, com escopo estrito e Nome Fantasia)
  const topBloq = (bloqs || [])[0];
  const topCorte = (cortes || [])[0];

  // Escopo estrito do supervisor de teste (Ederson Suonski - TPH)
  const Es = await carregaEscopo(B, { nome: 'Equipe Ederson Suonski (TPH)', filiais: ['TPH'], supervisor: 'EDERSON SUONSKI' }).catch(() => null);
  const rcasSup = new Set((Es && Es.vend ? Es.vend : []).map((v) => String(v.rca)));
  const bloqsSup = (bloqs || []).filter((b) => b.filial === 'TPH' && rcasSup.has(String(b.rca))).slice(0, 4);

  const alertas = [];
  if (topBloq) {
    const cliNome = await nomeClienteD1(db, topBloq.filial, topBloq.id_cliente);
    const dtBr = String(topBloq.data_pedido || '').split('-').reverse().slice(0, 2).join('/');
    alertas.push({
      regra: 'V5',
      papel: 'vendedor',
      destino_real: `RCA ${topBloq.rca} (${topBloq.filial})`,
      bonequinho: BONEQUINHO_MIDIA.BOPE_GUERRA,
      texto: [
        `🚫 *Alerta em Tempo Real — Pedido Bloqueado*`,
        `*${cliNome}*`,
        `Pedido *#${topBloq.num}* · *${R$(topBloq.valor)}* · ${dtBr} (${topBloq.filial})`,
        ``,
        `👉 _Verifique limite/título com o financeiro agora para não perder o faturamento._`,
      ].join('\n'),
    });
  }
  if (bloqsSup.length) {
    const soma = bloqsSup.reduce((a, b) => a + (Number(b.valor) || 0), 0);
    const linhasSup = [];
    for (let i = 0; i < bloqsSup.length; i++) {
      const b = bloqsSup[i];
      const cliNome = await nomeClienteD1(db, b.filial, b.id_cliente);
      linhasSup.push(`${i + 1}. *${cliNome}* · RCA ${b.rca} · #${b.num} — *${R$(b.valor)}*`);
    }
    alertas.push({
      regra: 'S4',
      papel: 'supervisor',
      destino_real: 'Ederson Suonski (TPH)',
      bonequinho: BONEQUINHO_MIDIA.BOPE_OPERACAO,
      texto: [
        `⚠️ *Bloqueios na sua Equipe (TPH — Tempo Real)*`,
        `${bloqsSup.length} pedido(s) travado(s) somando *${R$(soma)}*:`,
        ...linhasSup,
        topCorte && topCorte.filial === 'TPH' && rcasSup.has(String(topCorte.rca))
          ? `\n✂️ *Corte recente:* #${topCorte.num} (RCA ${topCorte.rca}) · ${topCorte.itens_cortados} item(ns) · ${R$(topCorte.valor)}`
          : '',
        ``,
        `👉 _Priorize o destravamento com esses vendedores antes do corte logístico._`,
      ].filter(Boolean).join('\n'),
    });
  }
  if (resumoRiscoFiliais.length) {
    alertas.push({
      regra: 'G2',
      papel: 'gerente',
      destino_real: `Gerência (${resumoRiscoFiliais[0].filial})`,
      bonequinho: BONEQUINHO_MIDIA.BOPE_TROPA,
      texto: [
        `🚨 *Exceção em Tempo Real — Filiais com Bloqueio Alto*`,
        ...resumoRiscoFiliais.map((f, i) => `${i + 1}. *${f.filial}* — *${R$(f.bloqVlr)}* bloq. (${N(f.bloqQtd)} ped.) · ${N(f.zerados)} zerado(s)`),
        ``,
        `👉 _Acione os supervisores para destravar carteira ainda hoje._`,
      ].join('\n'),
    });
  }

  let enviados = 0;
  for (const a of alertas) {
    let status = 'SIMULADO';
    let envio = null;
    if (opts.enviarVitorio && env.EVO_URL && env.EVO_KEY) {
      if (enviados > 0) await R.pausaEntreEnvios(3, 1, 2);
      const cfg = R.evoCfg(env);
      const tag = `⚡ *[EVENTO TEMPO REAL · ${a.regra} (${a.papel.toUpperCase()}) → ${a.destino_real}]*`;
      if (a.bonequinho && a.bonequinho.endsWith('.webp')) {
        await R.enviarMidia(cfg, '/message/sendSticker', { number: celRaw, sticker: origin + a.bonequinho });
        await R.pausaEntreEnvios(2, 0.5, 1);
      }
      const rt = await R.enviarTexto(cfg, celRaw, `${tag}\n\n${a.texto}`);
      status = rt.ok ? 'ENVIADO_TESTE' : 'ERRO_TESTE';
      envio = { ok: !!rt.ok, status: rt.status };
      enviados++;
    }
    await db.prepare('INSERT INTO monitoria_envios (regra_id, data, celular, destino_real, papel, filial, rca, modo, texto_preview, bonequinho, status, enviado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime(\'now\',\'-3 hours\')) ON CONFLICT (regra_id, data, celular, modo) DO UPDATE SET texto_preview = excluded.texto_preview, bonequinho = excluded.bonequinho, status = excluded.status, enviado_em = excluded.enviado_em')
      .bind(a.regra, hoje, opts.enviarVitorio ? celRaw : 'SIMULACAO', a.destino_real, a.papel, '', '', 'SIMULACAO_VITORIO', a.texto.slice(0, 3500), a.bonequinho || 'TEXTO', status).run();
    a.status = status;
    a.envio = envio;
  }

  const { results: resumoEventos } = await db.prepare('SELECT event_type, COUNT(*) total FROM domain_events GROUP BY event_type ORDER BY total DESC').all().catch(() => ({ results: [] }));
  return { ok: true, hoje, desde, eventos_processados: novos.length, resumo_eventos: resumoEventos || [], enviados, alertas };
}

