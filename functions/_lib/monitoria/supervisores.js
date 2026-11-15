// =========================================================================
// MONITOR.IA · functions/_lib/monitoria/supervisores.js
// Ciclo completo de operacao para Supervisores (S1, S2, S3, S4, S5).
// Respeita modo (OFF | SIMULACAO_VITORIO | PRODUCAO) e trava de idempotencia.
// =========================================================================
import { hojeSP, N, R$, nome2, vn } from '../jota/base.js';
import { criaBase } from '../jota/fontes.js';
import { carregaEscopo, pctTxt, pessoaReal } from '../jota/escopo.js';
import { diasUteisMes, respMatinal } from '../jota/respostas/gestao.js';
import {
  BONEQUINHO_MIDIA,
  NUMEROS_VITORIO,
  formataS1Excecao,
  formataS2Supervisor,
  listarRegras,
  nomeClienteD1,
} from './motor.js';
import R from '../../../public/regras.js';

const FILIAIS_BR = ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];

export function formataS3Travados(Es) {
  const { tot, pass } = diasUteisMes();
  const faltam = Math.max(1, tot - pass);
  const vs = (Es.vend || []).filter((v) => pessoaReal(v) && v.meta > 0)
    .map((v) => ({ v, gapDia: Math.max(0, (v.meta || 0) - (v.fat || 0) - (v.pend || 0)) / faltam }))
    .sort((a, b) => b.gapDia - a.gapDia);
  const semVisita = vs.filter((x) => (x.v.visP || 0) > 0 && (x.v.visF || 0) === 0);
  const semPedido = vs.filter((x) => (x.v.visF || 0) > 0 && !(x.v.dig > 0));
  if (!semVisita.length && !semPedido.length) return null;

  const out = [`🚨 *Equipe Travada (10h30) — ${Es.nome}*`];
  if (semVisita.length) {
    out.push('', `🛑 *Sem check-in ainda (${semVisita.length}):*`);
    semVisita.slice(0, 5).forEach((x, i) => out.push(`${i + 1}. *${vn(x.v)}* — ${x.v.visP} na rota · precisa *${R$(x.gapDia)}/dia*`));
  }
  if (semPedido.length) {
    out.push('', `⏳ *Em rota sem pedido (${semPedido.length}):*`);
    semPedido.slice(0, 5).forEach((x, i) => out.push(`${i + 1}. *${vn(x.v)}* — ${x.v.visF} vis. · *R$ 0* · precisa *${R$(x.gapDia)}/dia*`));
  }
  if (semVisita[0]) {
    out.push('', `👉 *Ação imediata:* ligar agora para *${nome2(semVisita[0].v.nome)}* — confirmar saída para campo e 1º cliente.`);
  } else if (semPedido[0]) {
    out.push('', `👉 *Ação imediata:* ligar agora para *${nome2(semPedido[0].v.nome)}* — já fez ${semPedido[0].v.visF} visita(s) sem pedido; destravar objeção/mix.`);
  }
  return out.join('\n');
}

export function formataS5Fechamento(Es) {
  const { tot, pass } = diasUteisMes();
  const faltam = Math.max(1, tot - pass);
  const vs = (Es.vend || []).filter((v) => pessoaReal(v) && v.meta > 0);
  if (!vs.length) return null;
  const digHoje = vs.reduce((a, v) => a + (v.dig || 0), 0);
  const metaTot = vs.reduce((a, v) => a + (v.meta || 0), 0);
  const fatCart = vs.reduce((a, v) => a + (v.fat || 0) + (v.pend || 0), 0);
  const metaDia = Math.max(0, metaTot - fatCart) / faltam;
  const pctDia = metaDia > 0 ? (digHoje / metaDia) * 100 : 0;
  const devHoje = vs.reduce((a, v) => a + (v.devHoje || 0), 0);

  const destaques = [...vs].filter((v) => (v.dig || 0) > 0).sort((a, b) => (b.dig || 0) - (a.dig || 0)).slice(0, 3);
  const zeradosHoje = vs
    .filter((v) => !(v.dig > 0) && (v.visP || 0) > 0)
    .sort((a, b) => (b.meta || 0) - (a.meta || 0));

  const out = [
    `🌙 *Fechamento do Dia — ${Es.nome}*`,
    `📝 *Digitado hoje:* *${R$(digHoje)}*${metaDia > 0 ? ` / *${R$(metaDia)}/dia* (${pctTxt(pctDia)})` : ''} · Equipe: *${vs.length}*`,
  ];
  if (devHoje > 0) out.push(`↩️ *Devoluções hoje:* *${R$(devHoje)}*`);
  if (destaques.length) {
    out.push('', '🏆 *Destaques de hoje:*');
    destaques.forEach((v, i) => out.push(`${i + 1}. *${vn(v)}* — *${R$(v.dig)}*${v.ped ? ` (${v.ped} ped.)` : ''}`));
  }
  if (zeradosHoje.length) {
    out.push('', `⚠️ *Fecharam zerados na rota (${zeradosHoje.length}):*`);
    zeradosHoje.slice(0, 5).forEach((v, i) => out.push(`${i + 1}. *${vn(v)}*`));
    out.push('', `👉 *Amanhã 07h30:* começar o dia alinhando rota e mix com *${nome2(zeradosHoje[0].nome)}*.`);
  } else {
    out.push('', '🟢 *Zero vendedores com rota zerada hoje!*');
  }
  return out.join('\n');
}

async function formataS4Equipe(db, Es, filial, bloqs) {
  const rcas = new Set((Es.vend || []).map((v) => String(v.rca)));
  const meus = (bloqs || []).filter((b) => b.filial === filial && rcas.has(String(b.rca)) && Number(b.valor) >= 500).slice(0, 4);
  if (!meus.length) return null;

  const hoje = hojeSP();
  const soma = meus.reduce((a, b) => a + (Number(b.valor) || 0), 0);
  const linhas = [];
  let primeiroCli = '';
  for (let i = 0; i < meus.length; i++) {
    const b = meus[i];
    const cli = await nomeClienteD1(db, b.filial, b.id_cliente);
    if (i === 0) primeiroCli = cli;
    const quando = b.data_pedido && b.data_pedido !== hoje ? ` · ${b.data_pedido.slice(8, 10)}/${b.data_pedido.slice(5, 7)}` : ' · hoje';
    const corte = b.categoria_corte ? ` (${b.categoria_corte})` : (b.itens_cortados > 0 ? ` (${b.itens_cortados} it. cort.)` : '');
    linhas.push(`${i + 1}. *${cli}* · RCA ${b.rca} · #${b.num} — *${R$(b.valor)}*${quando}${corte}`);
  }
  return [
    `⚠️ *Bloqueios na sua Equipe (${filial} — Tempo Real)*`,
    `${meus.length} pedido(s) travado(s) somando *${R$(soma)}*:`,
    ...linhas,
    '',
    `👉 *Ação antes do corte:* acionar RCA ${meus[0].rca} para liberar *${primeiroCli}* (*${R$(meus[0].valor)}*) no crédito/preço.`,
  ].join('\n');
}

export async function executarCicloSupervisores(origin, env, opts = {}) {
  const db = env.DB;
  const hoje = hojeSP();
  const regraId = String(opts.regra || 'S1').toUpperCase();
  if (!['S1', 'S2', 'S3', 'S4', 'S5'].includes(regraId)) {
    return { ok: false, erro: 'regra invalida para supervisores (use S1..S5)' };
  }

  const celTeste = String(opts.celularVitorio || NUMEROS_VITORIO[0]).replace(/\D/g, '');
  if (opts.enviarVitorio && !NUMEROS_VITORIO.includes(celTeste)) {
    return { ok: false, erro: 'Numero fora da whitelist de teste do Vitorio' };
  }

  const regras = await listarRegras(db);
  const regra = regras.find((r) => r.id === regraId) || { id: regraId, papel: 'supervisor', modo: 'SIMULACAO_VITORIO', ativo: 1, bonequinho: 'TEXTO' };
  if (!opts.forcar && (regra.ativo !== 1 || regra.modo === 'OFF')) {
    return { ok: true, regra: regraId, modo: regra.modo, ativo: regra.ativo, executados: 0, motivo: 'Regra desligada (OFF/inativa)' };
  }

  const { results: supsDb } = await db.prepare("SELECT celular, nome, filial, supervisor FROM bot_contatos WHERE papel = 'supervisor' AND ativo = 1 AND COALESCE(situacao,'ativo') = 'ativo' ORDER BY filial, nome").all().catch(() => ({ results: [] }));
  const filtroFiliais = Array.isArray(opts.filiais) && opts.filiais.length ? new Set(opts.filiais.map((f) => String(f).toUpperCase())) : null;
  const alvos = (supsDb || []).filter((s) => s.filial && (!filtroFiliais || filtroFiliais.has(String(s.filial).toUpperCase())));

  const B = criaBase(origin, env);
  const desde = new Date(Date.parse(hoje + 'T12:00:00Z') - 2 * 864e5).toISOString().slice(0, 10);
  const bloqs = regraId === 'S4'
    ? ((await db.prepare("SELECT num, filial, rca, id_cliente, data_pedido, valor, categoria_corte, itens_cortados FROM pedido_status WHERE status = 'BLOQUEADO' AND data_pedido >= ? ORDER BY valor DESC LIMIT 200").bind(desde).all().catch(() => ({ results: [] }))).results || [])
    : [];

  const limite = Number(opts.limite || (regra.modo === 'PRODUCAO' ? 15 : 30));
  const midia = BONEQUINHO_MIDIA[regra.bonequinho] || null;
  const cfg = env.EVO_URL && env.EVO_KEY ? R.evoCfg(env) : null;

  const resultados = [];
  let enviadosReal = 0;
  let amostraEnviada = false;

  for (const s of alvos) {
    if (resultados.length >= limite) break;
    const supNomeAlvo = s.supervisor || s.nome;
    const Es = await carregaEscopo(B, { nome: `${supNomeAlvo} (${s.filial})`, filiais: [s.filial], supervisor: supNomeAlvo }).catch(() => null);
    if (!Es || !Es.vend || !Es.vend.length) continue;

    let texto = null;
    if (regraId === 'S1') texto = formataS1Excecao(await respMatinal(B, Es), Es);
    else if (regraId === 'S2') texto = formataS2Supervisor(Es);
    else if (regraId === 'S3') texto = formataS3Travados(Es);
    else if (regraId === 'S4') texto = await formataS4Equipe(db, Es, s.filial, bloqs);
    else if (regraId === 'S5') texto = formataS5Fechamento(Es);
    if (!texto) continue;

    let status = 'SIMULADO';
    let celDestino = 'SIMULACAO';

    if (regra.modo === 'PRODUCAO') {
      const ja = await db.prepare("SELECT 1 FROM monitoria_envios WHERE regra_id = ? AND data = ? AND celular = ? AND status = 'ENVIADO' LIMIT 1")
        .bind(regraId, hoje, s.celular).first().catch(() => null);
      if (ja) continue;

      if (cfg) {
        if (enviadosReal > 0) await R.pausaEntreEnvios(4, 1, 2);
        if (midia && midia.endsWith('.webp')) {
          await R.enviarMidia(cfg, '/message/sendSticker', { number: s.celular, sticker: origin + midia });
          await R.pausaEntreEnvios(2, 0.5, 1);
        }
        const rt = await R.enviarTexto(cfg, s.celular, texto);
        status = rt.ok ? 'ENVIADO' : 'ERRO';
        celDestino = s.celular;
        if (rt.ok) enviadosReal++;
      }
    } else if (opts.enviarVitorio && !amostraEnviada && cfg) {
      const tag = `🧪 *[PILOTO SUPERVISORES · ${regraId} → ${s.nome} (${s.filial})]*`;
      if (midia && midia.endsWith('.webp')) {
        await R.enviarMidia(cfg, '/message/sendSticker', { number: celTeste, sticker: origin + midia });
        await R.pausaEntreEnvios(2, 0.5, 1);
      }
      const rt = await R.enviarTexto(cfg, celTeste, `${tag}\n\n${texto}`);
      status = rt.ok ? 'ENVIADO_TESTE' : 'ERRO_TESTE';
      celDestino = celTeste;
      amostraEnviada = true;
    }

    await db.prepare('INSERT INTO monitoria_envios (regra_id, data, celular, destino_real, papel, filial, rca, modo, texto_preview, bonequinho, status, enviado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime(\'now\',\'-3 hours\')) ON CONFLICT (regra_id, data, celular, modo) DO UPDATE SET texto_preview = excluded.texto_preview, bonequinho = excluded.bonequinho, status = excluded.status, enviado_em = excluded.enviado_em')
      .bind(regraId, hoje, celDestino, `${s.nome} (${s.filial})`, 'supervisor', s.filial, '', regra.modo, texto.slice(0, 3500), midia || regra.bonequinho, status).run();

    resultados.push({ supervisor: s.nome, filial: s.filial, status, preview: texto.slice(0, 300) });
  }

  return {
    ok: true,
    regra: regraId,
    modo: regra.modo,
    supervisores_elegiveis: alvos.length,
    processados: resultados.length,
    enviados_producao: enviadosReal,
    amostra_vitorio: amostraEnviada,
    resultados,
  };
}

