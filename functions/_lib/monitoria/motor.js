// =========================================================================
// MONITOR.IA · functions/_lib/monitoria/motor.js
// Motor declarativo de regras, eventos de dominio, simulacao e ROI.
// Nao chama o CEVEN; le apenas D1 (GEROT, Clube, pedido_status, roteiro_dia).
// =========================================================================
import { hojeSP, N, P, R$, titulo, nome2, vn } from '../jota/base.js';
import { criaBase } from '../jota/fontes.js';
import { carregaEscopo, agrupa, pctTxt, pessoaReal, supChave, supNome, supReal } from '../jota/escopo.js';
import { diasUteisMes, respMatinal } from '../jota/respostas/gestao.js';
import { respMarcaPropriaVivo, vendasEscopo } from '../jota/respostas/vendas.js';
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

export async function nomeClienteD1(db, filial, idCliente) {
  if (!db || !filial || !idCliente) return `#${idCliente}`;
  try {
    const row = await db.prepare("SELECT json_extract(json, '$.fantasia') f, json_extract(json, '$.nome') n FROM ficha_cliente WHERE filial = ? AND id_cliente = ? LIMIT 1")
      .bind(String(filial), String(idCliente)).first();
    const nm = row && (row.f || row.n);
    return nm ? `${titulo(String(nm).trim())} (#${idCliente})` : `#${idCliente}`;
  } catch {
    return `#${idCliente}`;
  }
}

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
    if (/^(🗺️\s*Rota hoje:\s*\*0\*|🏷️\s*Clientes com TAGs|🆕\s*Prospects perto)/.test(l)) continue;
    if (l.startsWith('*Principais pendentes') || l.startsWith('*Clientes da rota')) {
      emLista = true;
      out.push('', '*🎯 Top 5 alvos de hoje:*');
      continue;
    }
    if (emLista) {
      if (/^\d+\.\s/.test(l)) {
        if (countLista < 5) { out.push(l); countLista++; }
        continue;
      }
      if (l.startsWith('_… e mais')) continue;
      if (l.startsWith('👉')) { out.push('', '👉 _Responda 1 a 5 para abrir o cliente e o que oferecer._'); emLista = false; continue; }
    }
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function formataV4Acionavel(db, Ev, filial, rca) {
  const v = Ev.vend && Ev.vend[0];
  const nomeV = v ? vn(v) : `${rca} (${filial})`;
  const alvos = [];

  // 1. Prioriza clientes reais da carteira/rota do vendedor no D1 com TAG ou sem compra
  const cliLista = (v && Array.isArray(v.clientes) ? v.clientes : [])
    .filter((c) => c && (c.tags && c.tags.length || /SEM_COMPRA|PENDENTE/i.test(String(c.status || ''))))
    .slice(0, 3);
  for (const c of cliLista) {
    const nm = c.fantasia || c.nome || await nomeClienteD1(db, filial, c.id || c.cod);
    const motivo = (c.tags && c.tags.length) ? c.tags.slice(0, 2).map((t) => limpaTexto(t)).join(', ') : 'Sem compra no mês';
    alvos.push(`${alvos.length + 1}. *${titulo(String(nm))}* (${motivo})`);
  }

  // 2. Fallback para cliente_focos do D1 com Nome Fantasia resolvido
  if (!alvos.length) {
    const { results: rowsFocos } = await db.prepare('SELECT id_cliente, tag FROM cliente_focos WHERE filial = ? AND rca = ? LIMIT 15').bind(filial, rca).all().catch(() => ({ results: [] }));
    const porCli = new Map();
    for (const r of rowsFocos || []) {
      if (!porCli.has(r.id_cliente)) porCli.set(r.id_cliente, new Set());
      porCli.get(r.id_cliente).add(limpaTexto(r.tag));
    }
    for (const [idCli, tags] of [...porCli.entries()].slice(0, 3)) {
      const nm = await nomeClienteD1(db, filial, idCli);
      alvos.push(`${alvos.length + 1}. *${nm}* — [${[...tags].slice(0, 2).join(', ')}]`);
    }
  }

  if (!alvos.length) return null; // Sem oportunidade acionavel = zero spam
  return [
    `🎯 *Oportunidades Quentes — ${nomeV}*`,
    `Clientes da sua carteira prontos para ataque agora:`,
    '',
    ...alvos,
    '',
    '👉 _Responda 1 a 3 para ver última compra e mix sugerido._',
  ].join('\n');
}

export function formataS1Excecao(rawMatinal, Es) {
  const { tot, pass } = diasUteisMes();
  const faltam = Math.max(1, tot - pass);
  const vs = (Es.vend || []).filter((v) => pessoaReal(v) && v.meta > 0);
  const metaTot = vs.reduce((a, v) => a + (v.meta || 0), 0);
  const fatCart = vs.reduce((a, v) => a + (v.fat || 0) + (v.pend || 0), 0);
  const gapEquipe = Math.max(0, metaTot - fatCart);
  // 23/11/2026 (dicionario 3.8): precisa/dia = (meta - captacao) / dias restantes do GEROT, nao (meta - fat - cart) / dias
  const capEq = vs.some((v) => v.cap != null) ? vs.reduce((a, v) => a + (v.cap || 0), 0) : null, metaDiaEquipe = capEq != null ? Math.max(0, metaTot - capEq) / faltam : gapEquipe / faltam;
  const posReal = vs.reduce((a, v) => a + (v.pos || 0), 0);
  const posMeta = vs.reduce((a, v) => a + (v.metaPos || 0), 0);
  const rotaHoje = vs.reduce((a, v) => a + (v.visP || 0), 0);

  const mapaNomes = new Map((Es.vend || []).map((v) => [String(v.rca), vn(v)]));
  const linhas = limpaTexto(rawMatinal)
    .replace(/\*RCA (\d+)\*/g, (_, rca) => `*${mapaNomes.get(rca) || 'RCA ' + rca}*`)
    .split('\n');
  const out = [];
  let emPrio = false;
  let qtdPrio = 0;
  for (const l of linhas) {
    if (/^🗺️\s*Rota hoje:\s*\*0\* PDVs/.test(l)) continue;
    if (l.startsWith('🎯 *Prioridade')) {
      emPrio = true;
      out.push(`📌 *Meta diária p/ 100%:* *${R$(metaDiaEquipe)}/dia* (${faltam} dias úteis)`);
      if (posMeta > 0) out.push(`👥 *Positivação:* ${posReal}/${posMeta} (${pctTxt((posReal / posMeta) * 100)})${rotaHoje > 0 ? ` · Rota hoje: *${rotaHoje} PDVs*` : ''}`);
      out.push('', '🎯 *Foco hoje (vendedores abaixo de 80% de tendência):*');
      continue;
    }
    if (emPrio && /^\d+\.\s/.test(l)) {
      const m = l.match(/tend\.\s*\*(-?\d+)%\*/);
      const tend = m ? Number(m[1]) : 0;
      if (tend < 80 && !/R\$\s*0\/d/.test(l) && qtdPrio < 4) {
        out.push(l);
        qtdPrio++;
      }
      continue;
    }
    out.push(l);
  }
  if (emPrio && qtdPrio === 0) out.push('🟢 _Nenhum vendedor abaixo de 80% de tendência hoje._');

  const pior = vs
    .map((v) => ({ v, gapDia: Math.max(0, (v.meta || 0) - (v.fat || 0) - (v.pend || 0)) / faltam, pct: v.meta ? ((v.fat || 0) + (v.pend || 0)) / v.meta * 100 : 0 }))
    .filter((x) => x.gapDia > 0)
    .sort((a, b) => a.pct - b.pct)[0];
  if (pior) {
    out.push('', `👉 *Alinhamento 08h:* fechar compromisso de *${R$(pior.gapDia)}/dia* com *${nome2(pior.v.nome)}* e cobrar positivação na rota.`);
  }
  out.push('_Responda *"detalhar [nome]"* para ver clientes e mix sugerido._');
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function formataS2Supervisor(Es) {
  const { tot, pass } = diasUteisMes();
  const faltam = Math.max(1, tot - pass);
  const esp = tot ? (pass / tot) * 100 : 0;
  const vs = (Es.vend || []).filter((v) => pessoaReal(v) && v.meta > 0);
  const metaTot = vs.reduce((a, v) => a + (v.meta || 0), 0);
  const fatTot = vs.reduce((a, v) => a + (v.fat || 0), 0);
  const pendTot = vs.reduce((a, v) => a + (v.pend || 0), 0);
  const digHoje = vs.reduce((a, v) => a + (v.dig || 0), 0);
  const gapTot = Math.max(0, metaTot - fatTot - pendTot);
  const metaDia = gapTot / faltam;
  const real = metaTot ? (fatTot / metaTot) * 100 : 0;
  const realCart = metaTot ? ((fatTot + pendTot) / metaTot) * 100 : 0;
  const tom = real >= esp ? '🟢 *No ritmo ou acima.*' : real >= esp * 0.9 ? '🟡 *Ritmo apertado.*' : '🔴 *Abaixo do ritmo — agir hoje.*';

  const piores = vs
    .map((v) => {
      const gap = Math.max(0, (v.meta || 0) - (v.fat || 0) - (v.pend || 0));
      return { v, gap, gapDia: gap / faltam, pct: v.meta ? ((v.fat || 0) + (v.pend || 0)) / v.meta * 100 : 0 };
    })
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gapDia - a.gapDia)
    .slice(0, 5);
  const zeradosMes = vs.filter((v) => (v.fat || 0) === 0 && (v.pend || 0) === 0);

  const out = [
    `⏱️ *RET Unificada — ${Es.nome}*`,
    `Dia ${pass} de ${tot} úteis · Esperado: *${pctTxt(esp)}* · Fat.: *${pctTxt(real)}*${pendTot > 0 ? ` · c/ Cart.: *${pctTxt(realCart)}*` : ''}`,
    `📝 *Hoje:* *${R$(digHoje)}* digitado · *Precisa:* *${R$(metaDia)}/dia* (${faltam} du)`,
    tom,
  ];
  if (piores.length) {
    out.push('', '*Top 5 maiores gaps para recuperar hoje:*');
    piores.forEach((x, i) => {
      const rota = x.v.visP > 0 ? ` (${x.v.visF || 0}/${x.v.visP} vis.)` : '';
      out.push(`${i + 1}. *${vn(x.v)}* — ${pctTxt(x.pct)} · *${R$(x.gapDia)}/dia* · hoje: *${R$(x.v.dig || 0)}*${rota}`);
    });
  }
  if (zeradosMes.length) {
    out.push('', `⚠️ *Sem faturamento nem carteira no mês:* ${zeradosMes.slice(0, 5).map((v) => vn(v)).join(', ')}`);
  }
  if (piores[0]) {
    out.push('', `👉 *Ação agora:* ligar para *${nome2(piores[0].v.nome)}* — precisa de *${R$(piores[0].gapDia)}/dia* e digitou *${R$(piores[0].v.dig || 0)}* até agora.`);
  }
  out.push('_Responda *"industrias"* ou *"detalhar [nome]"* para agir no mix._');
  return out.join('\n');
}

function formataG1Executiva(rawMatinal, Eg) {
  const { tot, pass } = diasUteisMes();
  const faltam = Math.max(1, tot - pass);
  const cabecalho = limpaTexto(rawMatinal)
    .split('\n')
    .filter((l) => !/^(🎯 \*Prioridades|\d+\.\s|_… e mais|\s*$)/.test(l) && !/Rota(?: hoje)?:\s*\*0\* PDVs/.test(l));

  const sups = [...agrupa(Eg.vend, (v) => supChave(v, true))]
    .filter(([k, x]) => supReal(k) && !/^VAGO/.test(k) && x.meta > 0)
    .map(([k, x]) => {
      const gap = Math.max(0, (x.meta || 0) - (x.fat || 0) - (x.pend || 0));
      const esp = tot ? (pass / tot) * 100 : 1;
      const tend = x.pct != null && esp ? (x.pct / esp) * 100 : 0;
      return { k, x, gap, gapDia: gap / faltam, tend };
    })
    .sort((a, b) => (a.x.pct ?? 999) - (b.x.pct ?? 999));

  const out = [
    ...cabecalho,
    '',
    '*📊 Supervisores da filial (pior atingimento primeiro):*',
    ...sups.slice(0, 5).map((s, i) => `${i + 1}. *${supNome(s.k)}* — *${pctTxt(s.x.pct)}* (tend. ${Math.round(s.tend)}%) · precisa *${R$(s.gapDia)}/d* · ${s.x.zerados} zerado(s)`),
  ];
  if (sups[0]) {
    out.push('', `👉 *Ação gerencial:* cobrar plano de reversão de *${supNome(sups[0].k)}* ainda pela manhã.`);
  }
  return out.join('\n');
}

async function formataG3Executiva(B, Eg, filial) {
  const rv = await B.rv().catch(() => null);
  const rcaSup = new Map((Eg.vend || []).filter((v) => pessoaReal(v)).map((v) => [String(v.rca), supChave(v, true)]));
  const linhas = [];

  if (rv && Array.isArray(rv.metas) && Array.isArray(rv.apu)) {
    const porSup = new Map();
    const porInd = new Map();
    const apuMap = new Map(rv.apu.map((a) => [`${a[0]}|${a[1]}`, a]));

    for (const m of rv.metas) {
      const [rca, cnpj, forn, tipo, meta] = m;
      if (tipo !== 1 || meta <= 0 || !rcaSup.has(rca)) continue;
      const sup = rcaSup.get(rca);
      if (!supReal(sup) || /^VAGO/.test(sup)) continue;
      const a = apuMap.get(`${rca}|${cnpj}`);
      const fatV = a ? (a[3] || 0) : 0;

      if (!porSup.has(sup)) porSup.set(sup, { meta: 0, real: 0 });
      porSup.get(sup).meta += meta;
      porSup.get(sup).real += fatV;

      const indKey = forn || cnpj;
      if (!porInd.has(indKey)) porInd.set(indKey, { meta: 0, real: 0 });
      porInd.get(indKey).meta += meta;
      porInd.get(indKey).real += fatV;
    }

    const supsRank = [...porSup.entries()]
      .map(([k, x]) => ({ k, pct: x.meta ? (x.real / x.meta) * 100 : 0, real: x.real, meta: x.meta }))
      .sort((a, b) => a.pct - b.pct);
    const indsRank = [...porInd.entries()]
      .filter(([, x]) => x.meta > 0)
      .map(([nome, x]) => ({
        nome: titulo(nome.replace(/^[A-Z]\s*-\s*/i, '').replace(/\b(Industria|Produtos|Eletronicos|Comercio|Alimentos|Ltda|S\.?A\.?)\b/gi, '').replace(/\.+$/, '').trim()),
        pct: (x.real / x.meta) * 100,
        gap: Math.max(0, x.meta - x.real),
      }))
      .sort((a, b) => a.pct - b.pct);

    if (supsRank.length) {
      const corte = rv.cutoff && rv.cutoff <= hojeSP() ? rv.cutoff : hojeSP();
      linhas.push(`🏭 *Indústrias-Chave (Premiação RV) — ${filial}* _(corte ${corte})_`);
      linhas.push('', '*Por Supervisor (pior atingimento):*');
      supsRank.slice(0, 4).forEach((s, i) => linhas.push(`${i + 1}. *${supNome(s.k)}* — *${pctTxt(s.pct)}* (${R$(s.real)} / ${R$(s.meta)})`));
    }
    if (indsRank.length) {
      linhas.push('', '*Top 3 indústrias puxando a filial para baixo:*');
      indsRank.slice(0, 3).forEach((ind, i) => linhas.push(`${i + 1}. *${ind.nome}* — *${pctTxt(ind.pct)}* (gap ${R$(ind.gap)})`));
    }
  }

  const mpGerot = await marcaPropriaGerot(B && B.env && B.env.DB, [filial]);
  if (mpGerot && mpGerot.fatCart > 0) {
    linhas.push('', `🏷️ *Marca Própria (GEROT até ${mpGerot.ult}):* *${R$(mpGerot.fatCart)}* · *${N(mpGerot.posCart)}* positivados`);
    if (mpGerot.sups.length) {
      linhas.push(...mpGerot.sups.slice(0, 3).map(([sup, x]) => `• ${sup}: ${R$(x.fatCart)} (${N(x.posCart)} pos.)`));
    }
  }

  return linhas.length ? linhas.join('\n') : null;
}

export async function marcaPropriaGerot(db, filiais) {
  if (!db || !Array.isArray(filiais) || !filiais.length) return null;
  const mes = hojeSP().slice(0, 7);
  const ph = filiais.map(() => '?').join(',');
  const { results } = await db.prepare(`SELECT filial, rca, supervisor, vendedor, dados, em FROM gerot_vendas WHERE mes = ? AND filial IN (${ph}) AND fornecedor LIKE '%#24318%'`)
    .bind(mes, ...filiais).all().catch(() => ({ results: [] }));
  if (!results || !results.length) return null;

  let fatCart = 0, posCart = 0, capDia = 0, ult = '';
  const porSup = new Map();
  for (const r of results) {
    let d = {};
    try { d = JSON.parse(r.dados || '{}'); } catch { continue; }
    const fc = Number(d['Faturado + Carteira (R$)']) || 0;
    const pc = Number(d['Positivação + Carteira']) || 0;
    const cd = Number(d['Captação Dia (R$)']) || 0;
    fatCart += fc; posCart += pc; capDia += cd;
    if (r.em && r.em > ult) ult = r.em;
    const sup = r.supervisor ? titulo(String(r.supervisor).trim()) : 'Sem supervisor';
    if (!porSup.has(sup)) porSup.set(sup, { fatCart: 0, posCart: 0 });
    porSup.get(sup).fatCart += fc;
    porSup.get(sup).posCart += pc;
  }
  const sups = [...porSup.entries()].sort((a, b) => a[1].fatCart - b[1].fatCart);
  return { fatCart, posCart, capDia, ult: ult ? ult.slice(0, 10) : mes, sups };
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
    if (!texto) return;
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

  const rV1 = ativas.find((r) => r.id === 'V1');
  const rV4 = ativas.find((r) => r.id === 'V4');
  if (rV1 || rV4) {
    const Ev = await carregaEscopo(B, { nome: 'Tamara Guedes (TCV)', filiais: ['TCV'], rca: '352' }).catch(() => null);
    if (Ev) {
      if (rV1) await regPreview(rV1, '352 - Tamara Guedes (TCV)', 'vendedor', 'TCV', '352', formataV1Enxuta(await respMatinal(B, Ev)));
      if (rV4) await regPreview(rV4, '352 - Tamara Guedes (TCV)', 'vendedor', 'TCV', '352', await formataV4Acionavel(db, Ev, 'TCV', '352'));
    }
  }

  const rS1 = ativas.find((r) => r.id === 'S1');
  const rS2 = ativas.find((r) => r.id === 'S2');
  if (rS1 || rS2) {
    const Es = await carregaEscopo(B, { nome: 'Equipe Ederson Suonski (TPH)', filiais: ['TPH'], supervisor: 'EDERSON SUONSKI' }).catch(() => null);
    if (Es) {
      if (rS1) await regPreview(rS1, 'Ederson Suonski (TPH)', 'supervisor', 'TPH', '', formataS1Excecao(await respMatinal(B, Es), Es));
      if (rS2) await regPreview(rS2, 'Ederson Suonski (TPH)', 'supervisor', 'TPH', '', formataS2Supervisor(Es));
    }
  }

  const rG1 = ativas.find((r) => r.id === 'G1');
  const rG3 = ativas.find((r) => r.id === 'G3');
  if (rG1 || rG3) {
    const Eg = await carregaEscopo(B, { nome: 'TCV', filiais: ['TCV'] }).catch(() => null);
    if (Eg) {
      if (rG1) await regPreview(rG1, 'Gerência TCV', 'gerente', 'TCV', '', formataG1Executiva(await respMatinal(B, Eg), Eg));
      if (rG3) await regPreview(rG3, 'Gerência TCV', 'gerente', 'TCV', '', await formataG3Executiva(B, Eg, 'TCV'));
    }
  }

  return { ok: true, data: hoje, regras_ativas: ativas.length, celular_teste: opts.enviarVitorio ? celRaw : 'SIMULACAO', enviados, amostras };
}
