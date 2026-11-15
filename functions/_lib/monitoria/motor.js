// =========================================================================
// MONITOR.IA · functions/_lib/monitoria/motor.js
// Motor declarativo de regras, eventos de dominio, simulacao e ROI.
// Nao chama o CEVEN; le apenas D1 (GEROT, Clube, pedido_status, roteiro_dia).
// =========================================================================
import { hojeSP, N, P, R$, titulo, nome2, vn } from '../jota/base.js';
import { criaBase } from '../jota/fontes.js';
import { carregaEscopo, agrupa, pctTxt, pessoaReal, supChave, supNome, supReal } from '../jota/escopo.js';
import { diasUteisMes, respMatinal } from '../jota/respostas/gestao.js';
import { respMarcaPropriaVivo } from '../jota/respostas/vendas.js';
import { respMetasIndustria } from '../jota/respostas/metas_industria.js';
import R from '../../../public/regras.js';

export const NUMEROS_VITORIO = ['554187525605', '5566996389884'];

export const BONEQUINHO_MIDIA = {
  BOPE_OPERACAO: '/figurinhas/bope/fig_02_operacao.webp',
  BOPE_TROPA: '/figurinhas/bope/fig_01_tropa.webp',
  BOPE_GUERRA: '/figurinhas/bope/fig_03_guerra.webp',
};

const limpaTexto = (s) => String(s || '')
  .replace(/_Fonte:[^\n]*_/g, '')
  .replace(/\s*·\s*rota 0\b/gi, '')
  .replace(/(\d+)\/(\d+)\s*du\b/g, 'Dia $1 de $2')
  .replace(/\bBon\b/g, 'Bongusto')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

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
  const tag = `🧪 *[MONITOR.IA · ${regra.id} (${regra.papel.toUpperCase()}) → ${destinoReal}]*`;
  let okMidia = true;
  if (midia) {
    const rm = midia.endsWith('.webp')
      ? await R.enviarMidia(cfg, '/message/sendSticker', { number: celDest, sticker: origin + midia })
      : await R.enviarMidia(cfg, '/message/sendMedia', { number: celDest, mediatype: 'image', mimetype: midia.endsWith('.jpg') ? 'image/jpeg' : 'image/png', media: origin + midia, caption: tag });
    okMidia = !!rm.ok;
    await R.pausaEntreEnvios(2, 0.5, 1);
  }
  const rt = await R.enviarTexto(cfg, celDest, `${tag}\n\n${String(texto || '').slice(0, 3500)}`);
  return { ok: !!(rt.ok && okMidia), status: rt.status, erro: rt.erro || null };
}

function formataV1Enxuta(rawMatinal) {
  const linhas = limpaTexto(rawMatinal).split('\n');
  const out = [];
  let emLista = false;
  let countLista = 0;
  for (const l of linhas) {
    if (l.startsWith('*Principais pendentes') || l.startsWith('*Clientes da rota')) {
      emLista = true;
      out.push('*🎯 Top 5 alvos de hoje:*');
      continue;
    }
    if (emLista) {
      if (/^\d+\.\s/.test(l)) {
        if (countLista < 5) { out.push(l); countLista++; }
        continue;
      }
      if (l.startsWith('_… e mais')) continue;
      if (l.startsWith('👉')) { out.push('👉 _Responda 1 a 5 para abrir a ficha e o que oferecer._'); emLista = false; continue; }
    }
    out.push(l);
  }
  return out.join('\n').trim();
}

async function formataV4Acionavel(db, B, Ev, filial, rca) {
  const v = Ev.vend && Ev.vend[0];
  const nomeV = v ? vn(v) : `${rca} (${filial})`;
  const { results: rowsFocos } = await db.prepare('SELECT id_cliente, tag FROM cliente_focos WHERE filial = ? AND rca = ? LIMIT 30').bind(filial, rca).all().catch(() => ({ results: [] }));
  const porCli = new Map();
  for (const r of rowsFocos || []) {
    if (!porCli.has(r.id_cliente)) porCli.set(r.id_cliente, new Set());
    porCli.get(r.id_cliente).add(r.tag);
  }
  const focos = [...porCli.entries()].slice(0, 5).map(([id_cliente, tags]) => ({ id_cliente, tags: [...tags].join(', ') }));
  const mp = limpaTexto(await respMarcaPropriaVivo(B, Ev, 'marca propria').catch(() => ''));
  const linhas = [`🎯 *Oportunidades Quentes — ${nomeV}*`];
  if (focos && focos.length) {
    linhas.push('', '*Clientes prioritários com TAG ativa:*');
    focos.forEach((f, i) => linhas.push(`${i + 1}. Cliente #${f.id_cliente} — [${limpaTexto(f.tags)}]`));
  }
  if (mp) linhas.push('', mp);
  linhas.push('', '👉 _Responda o código do cliente para ver última compra e mix sugerido._');
  return linhas.join('\n').trim();
}

function formataS2Supervisor(Es) {
  const { tot, pass } = diasUteisMes();
  const esp = tot ? (pass / tot) * 100 : 0;
  const vs = (Es.vend || []).filter((v) => pessoaReal(v) && v.meta > 0);
  const metaTot = vs.reduce((a, v) => a + (v.meta || 0), 0);
  const fatTot = vs.reduce((a, v) => a + (v.fat || 0), 0);
  const real = metaTot ? (fatTot / metaTot) * 100 : 0;
  const tom = real >= esp ? '🟢 *No ritmo ou acima.*' : real >= esp * 0.9 ? '🟡 *Ritmo apertado.*' : '🔴 *Abaixo do ritmo — agir hoje.*';

  const piores = vs
    .map((v) => ({ v, gap: Math.max(0, (v.meta || 0) - (v.fat || 0) - (v.pend || 0)), pct: v.meta ? ((v.fat || 0) + (v.pend || 0)) / v.meta * 100 : 0 }))
    .filter((x) => x.gap > 0)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);
  const zeradosHoje = vs.filter((v) => !(v.dig > 0) && !(v.fat > 0));

  const out = [
    `⏱️ *RET Unificada — ${Es.nome}*`,
    `Dia ${pass} de ${tot} úteis · Esperado: *${pctTxt(esp)}* · Faturado: *${pctTxt(real)}*`,
    tom,
  ];
  if (piores.length) {
    out.push('', '*Top 5 vendedores mais atrás (gap):*');
    piores.forEach((x, i) => out.push(`${i + 1}. *${vn(x.v)}* — ${pctTxt(x.pct)} · falta *${R$(x.gap)}*`));
  }
  if (zeradosHoje.length) {
    out.push('', `⚠️ *Sem venda no mês:* ${zeradosHoje.slice(0, 5).map((v) => vn(v)).join(', ')}`);
  }
  if (piores[0]) {
    out.push('', `👉 *Ação imediata:* alinhar rota de hoje com *${nome2(piores[0].v.nome)}* agora pela manhã.`);
  }
  return out.join('\n');
}

function limpaPrioridades(raw, Es) {
  const mapaNomes = new Map((Es.vend || []).map((v) => [String(v.rca), vn(v)]));
  return limpaTexto(raw)
    .replace(/\*RCA (\d+)\*/g, (_, rca) => `*${mapaNomes.get(rca) || 'RCA ' + rca}*`)
    .split('\n')
    .filter((l) => !/precisa R\$ 0\/d/.test(l))
    .join('\n')
    .trim();
}

function formataG1Executiva(raw, Eg) {
  const base = limpaPrioridades(raw, Eg);
  const sups = [...agrupa(Eg.vend, (v) => supChave(v, true))]
    .filter(([k, x]) => supReal(k) && !/^VAGO/.test(k) && x.meta > 0)
    .sort((a, b) => (a[1].pct ?? 999) - (b[1].pct ?? 999))
    .slice(0, 3);
  if (!sups.length) return base;
  return [base, '', '*Top 3 supervisores mais atrás:*', ...sups.map(([k, x], i) => `${i + 1}. ${supNome(k)} — ${pctTxt(x.pct)} · ${x.zerados} zerado(s)`)].join('\n');
}

function formataD1Brasil(raw, Ed) {
  const base = limpaPrioridades(raw, Ed);
  const fils = [...agrupa(Ed.vend, (v) => v.filial)]
    .filter(([, x]) => x.meta > 0)
    .sort((a, b) => (a[1].pct ?? 999) - (b[1].pct ?? 999))
    .slice(0, 3);
  if (!fils.length) return base;
  return [base, '', '*Top 3 filiais mais atrás:*', ...fils.map(([f, x], i) => `${i + 1}. *${f}* — ${pctTxt(x.pct)} (${R$(x.fat)} / ${R$(x.meta)})`)].join('\n');
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
    amostras.push({ regra: regra.id, nome: regra.nome, horario: regra.horario, modo: regra.modo, destino_real: destinoReal, bonequinho: midia || regra.bonequinho, status, envio: envioInfo, preview: String(texto || '').slice(0, 600) });
  };

  // V1 e V4: Vendedor (352 Tamara Guedes - TCV)
  const rV1 = ativas.find((r) => r.id === 'V1');
  const rV4 = ativas.find((r) => r.id === 'V4');
  if (rV1 || rV4) {
    const Ev = await carregaEscopo(B, { nome: 'Tamara Guedes (TCV)', filiais: ['TCV'], rca: '352' }).catch(() => null);
    if (Ev) {
      if (rV1) await regPreview(rV1, '352 - Tamara Guedes (TCV)', 'vendedor', 'TCV', '352', formataV1Enxuta(await respMatinal(B, Ev)));
      if (rV4) await regPreview(rV4, '352 - Tamara Guedes (TCV)', 'vendedor', 'TCV', '352', await formataV4Acionavel(db, B, Ev, 'TCV', '352'));
    }
  }

  // S1 e S2: Supervisor (Ederson Suonski - TPH)
  const rS1 = ativas.find((r) => r.id === 'S1');
  const rS2 = ativas.find((r) => r.id === 'S2');
  if (rS1 || rS2) {
    const Es = await carregaEscopo(B, { nome: 'Equipe Ederson Suonski (TPH)', filiais: ['TPH'], supervisor: 'EDERSON SUONSKI' }).catch(() => null);
    if (Es) {
      if (rS1) await regPreview(rS1, 'Ederson Suonski (TPH)', 'supervisor', 'TPH', '', limpaPrioridades(await respMatinal(B, Es), Es));
      if (rS2) await regPreview(rS2, 'Ederson Suonski (TPH)', 'supervisor', 'TPH', '', formataS2Supervisor(Es));
    }
  }

  // G1 e G3: Gerente (TCV)
  const rG1 = ativas.find((r) => r.id === 'G1');
  const rG3 = ativas.find((r) => r.id === 'G3');
  if (rG1 || rG3) {
    const Eg = await carregaEscopo(B, { nome: 'TCV', filiais: ['TCV'] }).catch(() => null);
    if (Eg) {
      if (rG1) await regPreview(rG1, 'Gerência TCV', 'gerente', 'TCV', '', formataG1Executiva(await respMatinal(B, Eg), Eg));
      if (rG3) {
        const [mp, ind] = await Promise.all([
          respMarcaPropriaVivo(B, Eg, 'marca propria').catch(() => ''),
          respMetasIndustria(B, Eg, 'industrias', null).catch(() => ''),
        ]);
        await regPreview(rG3, 'Gerência TCV', 'gerente', 'TCV', '', limpaTexto([mp, ind].filter(Boolean).join('\n\n')) || '🏭 *Marca Própria & Indústrias — TCV*\nSem dados no momento.');
      }
    }
  }

  // D1: Diretoria (Brasil)
  const rD1 = ativas.find((r) => r.id === 'D1');
  if (rD1) {
    const Ed = await carregaEscopo(B, { nome: 'Brasil', filiais: ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'], nacional: true }).catch(() => null);
    if (Ed) await regPreview(rD1, 'Diretoria (Brasil)', 'diretoria', 'BR', '', formataD1Brasil(await respMatinal(B, Ed), Ed));
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
