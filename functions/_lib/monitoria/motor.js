// =========================================================================
// MONITOR.IA · functions/_lib/monitoria/motor.js
// Motor declarativo de regras, eventos de dominio, simulacao e ROI.
// Nao chama o CEVEN; le apenas D1 (GEROT, Clube, pedido_status, roteiro_dia).
// =========================================================================
import { hojeSP, N } from '../jota/base.js';
import { criaBase } from '../jota/fontes.js';
import { carregaEscopo } from '../jota/escopo.js';
import { respMatinal, respRitmo, respMaiorGap } from '../jota/respostas/gestao.js';
import { respMarcaPropriaVivo } from '../jota/respostas/vendas.js';
import { respMetasIndustria } from '../jota/respostas/metas_industria.js';
import R from '../../../public/regras.js';

export const NUMEROS_VITORIO = ['554187525605', '5566996389884'];

export const BONEQUINHO_MIDIA = {
  BOPE_OPERACAO: '/figurinhas/bope/fig_02_operacao_positivacao.png',
  BOPE_TROPA: '/figurinhas/bope/fig_01_tropa_da_positivacao.png',
  BOPE_GUERRA: '/figurinhas/bope/03_bora_pra_guerra_das_metas.jpg',
};

export async function listarRegras(db) {
  const { results } = await db.prepare('SELECT * FROM regras_monitoria ORDER BY onda ASC, id ASC').all().catch(() => ({ results: [] }));
  return results || [];
}

export async function atualizarRegra(db, body) {
  const id = String(body.id || '').trim();
  if (!id) throw new Error('id obrigatorio');
  const campos = [];
  const vals = [];
  if (body.modo && ['OFF', 'SIMULACAO_VITORIO', 'PRODUCAO'].includes(body.modo)) { campos.push('modo = ?'); vals.push(body.modo); }
  if (body.ativo !== undefined) { campos.push('ativo = ?'); vals.push(body.ativo ? 1 : 0); }
  if (body.horario !== undefined) { campos.push('horario = ?'); vals.push(String(body.horario)); }
  if (body.bonequinho !== undefined) { campos.push('bonequinho = ?'); vals.push(String(body.bonequinho)); }
  if (!campos.length) return { ok: false, erro: 'nenhum campo valido' };
  campos.push("atualizado_em = datetime('now','-3 hours')");
  vals.push(id);
  await db.prepare(`UPDATE regras_monitoria SET ${campos.join(', ')} WHERE id = ?`).bind(...vals).run();
  return { ok: true, id };
}

export async function emitirEvento(db, ev) {
  const occurred = ev.occurred_at || new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  await db.prepare('INSERT OR IGNORE INTO domain_events (event_type, entity_key, filial, rca, payload_json, source, occurred_at) VALUES (?,?,?,?,?,?,?)')
    .bind(String(ev.event_type), String(ev.entity_key), ev.filial || null, ev.rca || null, ev.payload ? JSON.stringify(ev.payload) : null, ev.source || 'monitoria', occurred).run();
}

async function enviaTesteVitorio(origin, env, celDest, regra, destinoReal, midia, texto) {
  if (!env.EVO_URL || !env.EVO_KEY) return { ok: false, erro: 'EVO_URL/EVO_KEY ausentes' };
  const cfg = R.evoCfg(env);
  const tag = `🧪 *[TESTE MONITOR.IA · ${regra.id} (${regra.papel.toUpperCase()}) → iria para ${destinoReal}]*`;
  let okMidia = true;
  if (midia) {
    const rm = await R.enviarMidia(cfg, '/message/sendMedia', {
      number: celDest,
      mediatype: 'image',
      mimetype: midia.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
      media: origin + midia,
      caption: tag,
    });
    okMidia = !!rm.ok;
    await R.pausaEntreEnvios(2, 0.5, 1);
  }
  const corpo = midia ? String(texto || '').slice(0, 3800) : `${tag}\n\n${String(texto || '').slice(0, 3500)}`;
  const rt = await R.enviarTexto(cfg, celDest, corpo);
  return { ok: !!(rt.ok && okMidia), status: rt.status, erro: rt.erro || null };
}

export async function simularOnda1(origin, env, opts = {}) {
  const db = env.DB;
  const hoje = hojeSP();
  const celRaw = String(opts.celularVitorio || NUMEROS_VITORIO[0]).replace(/\D/g, '');
  if (opts.enviarVitorio && !NUMEROS_VITORIO.includes(celRaw)) {
    return { ok: false, erro: 'Numero fora da whitelist de teste do Vitorio' };
  }
  const celGravado = opts.enviarVitorio ? celRaw : (opts.celularVitorio || 'SIMULACAO');
  const filtroRegras = Array.isArray(opts.regras) && opts.regras.length ? new Set(opts.regras.map((x) => String(x).toUpperCase())) : null;

  const regras = await listarRegras(db);
  const ativas = regras.filter((r) => r.onda === 1 && r.ativo === 1 && r.modo !== 'OFF' && (!filtroRegras || filtroRegras.has(r.id)));
  const B = criaBase(origin, env);
  const amostras = [];
  let enviados = 0;

  const regPreview = async (regra, destinoReal, papel, filial, rca, texto) => {
    const midia = BONEQUINHO_MIDIA[regra.bonequinho] || null;
    let status = 'SIMULADO';
    let envioInfo = null;
    if (opts.enviarVitorio && (!opts.limiteEnvios || enviados < Number(opts.limiteEnvios))) {
      if (enviados > 0) await R.pausaEntreEnvios(3, 1, 2);
      envioInfo = await enviaTesteVitorio(origin, env, celRaw, regra, destinoReal, midia, texto);
      status = envioInfo.ok ? 'ENVIADO_TESTE' : 'ERRO_TESTE';
      enviados++;
    }
    await db.prepare('INSERT INTO monitoria_envios (regra_id, data, celular, destino_real, papel, filial, rca, modo, texto_preview, bonequinho, status, enviado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime(\'now\',\'-3 hours\')) ON CONFLICT (regra_id, data, celular, modo) DO UPDATE SET texto_preview = excluded.texto_preview, bonequinho = excluded.bonequinho, status = excluded.status, enviado_em = excluded.enviado_em')
      .bind(regra.id, hoje, celGravado, destinoReal, papel, filial || '', rca || '', regra.modo, String(texto || '').slice(0, 3500), midia || regra.bonequinho, status).run();
    amostras.push({ regra: regra.id, nome: regra.nome, horario: regra.horario, modo: regra.modo, destino_real: destinoReal, bonequinho: midia || regra.bonequinho, status, envio: envioInfo, preview: String(texto || '').slice(0, 500) });
  };

  // V1 e V4: Vendedor (352 Tamara Guedes - TCV)
  const rV1 = ativas.find((r) => r.id === 'V1');
  const rV4 = ativas.find((r) => r.id === 'V4');
  if (rV1 || rV4) {
    const Ev = await carregaEscopo(B, { nome: 'Tamara Guedes (TCV)', filiais: ['TCV'], rca: '352' }).catch(() => null);
    if (Ev) {
      if (rV1) await regPreview(rV1, '352 - Tamara Guedes (TCV)', 'vendedor', 'TCV', '352', await respMatinal(B, Ev));
      if (rV4) {
        const txtMp = await respMarcaPropriaVivo(B, Ev, 'marca propria').catch(() => null);
        await regPreview(rV4, '352 - Tamara Guedes (TCV)', 'vendedor', 'TCV', '352', txtMp || '🎯 *Oportunidade Quente (Marca Própria / Recorrência)*\nSem pendências críticas de Marca Própria no momento.');
      }
    }
  }

  // S1 e S2: Supervisor (Ederson Suonski - TPH)
  const rS1 = ativas.find((r) => r.id === 'S1');
  const rS2 = ativas.find((r) => r.id === 'S2');
  if (rS1 || rS2) {
    const Es = await carregaEscopo(B, { nome: 'Equipe Ederson Suonski (TPH)', filiais: ['TPH'], supervisor: 'EDERSON SUONSKI' }).catch(() => null);
    if (Es) {
      if (rS1) await regPreview(rS1, 'Ederson Suonski (TPH)', 'supervisor', 'TPH', '', await respMatinal(B, Es));
      if (rS2) {
        const [ritmo, gap] = await Promise.all([respRitmo(B, Es).catch(() => ''), Promise.resolve(respMaiorGap(Es))]);
        await regPreview(rS2, 'Ederson Suonski (TPH)', 'supervisor', 'TPH', '', [ritmo, gap].filter(Boolean).join('\n\n'));
      }
    }
  }

  // G1 e G3: Gerente (TCV)
  const rG1 = ativas.find((r) => r.id === 'G1');
  const rG3 = ativas.find((r) => r.id === 'G3');
  if (rG1 || rG3) {
    const Eg = await carregaEscopo(B, { nome: 'TCV', filiais: ['TCV'] }).catch(() => null);
    if (Eg) {
      if (rG1) await regPreview(rG1, 'Gerência TCV', 'gerente', 'TCV', '', await respMatinal(B, Eg));
      if (rG3) {
        const [mp, ind] = await Promise.all([
          respMarcaPropriaVivo(B, Eg, 'marca propria').catch(() => ''),
          respMetasIndustria(B, Eg, 'industrias', null).catch(() => ''),
        ]);
        await regPreview(rG3, 'Gerência TCV', 'gerente', 'TCV', '', [mp, ind].filter(Boolean).join('\n\n') || '🏭 *Marca Própria & Indústrias — TCV*\nSem dados no momento.');
      }
    }
  }

  // D1: Diretoria (Brasil)
  const rD1 = ativas.find((r) => r.id === 'D1');
  if (rD1) {
    const Ed = await carregaEscopo(B, { nome: 'Brasil', filiais: ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'], nacional: true }).catch(() => null);
    if (Ed) await regPreview(rD1, 'Diretoria (Brasil)', 'diretoria', 'BR', '', await respMatinal(B, Ed));
  }

  // D2: Auditoria & ROI do MONITOR.IA
  const rD2 = ativas.find((r) => r.id === 'D2');
  if (rD2) {
    const { results: stats } = await db.prepare('SELECT status, COUNT(*) q FROM monitoria_envios WHERE data = ? GROUP BY status').bind(hoje).all().catch(() => ({ results: [] }));
    const { results: evs } = await db.prepare('SELECT COUNT(*) q FROM domain_events').all().catch(() => ({ results: [{ q: 0 }] }));
    const txt = [
      `🤖 *Auditoria MONITOR.IA (${hoje})*`,
      `Regras Onda 1 ativas: *${ativas.length}* (modo seguro SIMULACAO_VITORIO)`,
      `Eventos de domínio registrados: *${N((evs && evs[0] && evs[0].q) || 0)}*`,
      ...(stats || []).map((s) => `• ${s.status}: ${N(s.q)}`),
    ].join('\n');
    await regPreview(rD2, 'Diretoria (Auditoria)', 'diretoria', 'BR', '', txt);
  }

  return { ok: true, data: hoje, regras_ativas: ativas.length, celular_teste: opts.enviarVitorio ? celRaw : 'SIMULACAO', enviados, amostras };
}
