// =========================================================================
// MONITOR.IA · PILOTO (21/11/2026) · functions/_lib/monitoria/piloto.js
// Decisao do Vitorio (21/11): piloto com os 2 supervisores de cada filial que mais conversam com o JOTA (22), sinais:
//   10h  ABERTURA   — vendedor de varejo com rota e sem visita + positivacao abaixo do ritmo do mes
//   12h  MEIO       — justificativas de nao venda da equipe ate agora + cartoes/penaltis da Liga
//   17h  TARDE      — idem
//   18h30 FECHAMENTO — o dia da equipe
// (hora LOCAL da filial: TCG, MCD e TCA tem 1 h a menos que Brasilia)
// Auditoria de 20-21/11: os alertas antigos (analista.js) saiam por fora do teto antiban, com texto de IA inventando numero, bloqueio de pedido ja
// faturado e 16 mensagens para a mesma pessoa. Aqui:
//   - os numeros saem das MESMAS funcoes do JOTA (carregaEscopo = Gestao de Equipe + GEROT + Clube): o alerta diz o que o JOTA diz;
//   - texto FIXO (a IA so reescreve se a chave monitoria_ia estiver ligada, e a reescrita so vale se TODO numero e TODO codigo ja estiver no texto fixo);
//   - liberacao PROPRIA (config_flags monitoria_liberada_ate) sem mexer na pausa geral; fora dela tudo fica so gravado como SOMBRA;
//   - teto antiban (cotaEnvio) + no maximo 1 por janela e 4 por dia por supervisor; nada em feriado/fim de semana; silencio se o Clube estiver velho (> 40 min).
// =========================================================================
import { carregaEscopo } from '../jota/escopo.js';
import { criaBase } from '../jota/fontes.js';
import { cotaEnvio, hojeSP, R$, N, titulo } from '../jota/base.js';
import { ehFeriado, ehFimDeSemana } from '../feriados.js';
import R from '../../../public/regras.js';

const FUSO1H = ['TCG', 'MCD', 'TCA'];
// 24/11/2026 (Vitorio): MONITOR.IA FASE I (somente supervisores), 4 alertas exatos:
//   09:30 BRT (todas as filiais incl. TCG/MCD/TCA) -> compromisso matinal nao lancado
//   10:00 local (11:00 BRT TCA/MCD/TCG)            -> vendedores de varejo sem check-in
//   12:00 / 16:00 local                             -> visitas em clientes +30 dias sem compra justificados sem venda
//   14:00 local (15:00 BRT TCG/MCD/TCA)            -> vendedores de varejo zerados (sem visita e/ou sem venda)
export const JANELAS = [
  { id: 'compromisso', ini: '09:30', fuso: 'BRT' },
  { id: 'sem_checkin', ini: '10:00', fuso: 'LOCAL' },
  { id: 'just30d_12h', ini: '12:00', fuso: 'LOCAL' },
  { id: 'zerados_14h', ini: '14:00', fuso: 'LOCAL' },
  { id: 'just30d_16h', ini: '16:00', fuso: 'LOCAL' },
];
const MAX_DIA = 5, CLUBE_MAX_MIN = 40, NL = String.fromCharCode(10);
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const nomeCurto = (s) => titulo(String(s || '').replace(/^(CLT|PJ)\s*-?\s*/i, '').toLowerCase()).split(' ').filter((w) => !/^(De|Da|Do|Dos|Das|E)$/.test(w)).slice(0, 2).join(' ');
const vn = (v) => `${v.rca} - ${nomeCurto(v.nome)}`;

export function horaBRT(agora = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(agora);
}
// hora local da filial (HH:MM)
export function horaLocal(filial, agora = new Date()) {
  const d = new Date(agora.getTime() - (FUSO1H.includes(filial) ? 3600e3 : 0));
  return horaBRT(d);
}
export function janelaAgora(filial, agora = new Date()) {
  return JANELAS.find((j) => {
    const h = j.fuso === 'BRT' ? horaBRT(agora) : horaLocal(filial, agora);
    const [hh, mm] = h.split(':').map(Number), m = hh * 60 + mm;
    const [a, b] = j.ini.split(':').map(Number), ini = a * 60 + b;
    return m >= ini && m < ini + 30;
  }) || null;
}
const flag = async (db, k) => {
  for (const ms of [0, 250, 600]) {
    if (ms) await new Promise((ok) => setTimeout(ok, ms));
    try { const r = await db.prepare('SELECT valor FROM config_flags WHERE chave = ?').bind(k).first(); return r ? r.valor : null; } catch (e) {}
  }
  return null;
};

// 1) 09:30 BRT (todas as filiais, incluindo TCG/MCD/TCA): quem ainda nao lancou o compromisso do dia no CEVEN
async function textoCompromisso(ctx) {
  const { db, fil, equipe, hoje, supNome, horaBrt } = ctx;
  const r = await db.prepare("SELECT json, atualizado_em FROM supervisores_dia WHERE data_ref = ? AND tipo = 'compromissos'").bind(hoje).first().catch(() => null);
  if (!r || !r.json) return null;
  const ageMin = r.atualizado_em ? (Date.now() - Date.parse(String(r.atualizado_em).replace(' ', 'T') + 'Z')) / 60000 : 9999;
  if (ageMin > 90) return null;
  let j; try { j = JSON.parse(r.json); } catch { return null; }
  const alvo = sem(supNome);
  const s = (j.supervisores || []).find((x) => String(x.filial || '').toUpperCase().startsWith(fil) && (sem(x.nome) === alvo || sem(x.nome).startsWith(alvo) || alvo.startsWith(sem(x.nome))));
  if (!s || (s.porDia || [])[0] !== false) return null;
  return [
    `⏰ *Compromisso pendente — ${equipe}* · ${horaBrt} BRT`,
    '',
    `O compromisso do dia *ainda não foi lançado* no CEVEN (prazo às 10h00 BRT).`,
    '',
    `👉 Lançar o compromisso agora no painel do CEVEN.`
  ].join(NL);
}

// 2) 10:00 local (11:00 BRT TCA/MCD/TCG): vendedores de varejo com rota e sem check-in / pedido
async function textoSemCheckin(ctx) {
  const { db, fil, equipe, V, hoje } = ctx;
  const rcas = V.map((v) => String(Number(v.rca))).filter(Boolean);
  if (!rcas.length) return null;
  const inRca = rcas.join(',');
  const [vdRows, ckRows, pdRows] = await Promise.all([
    db.prepare(`SELECT CAST(rca AS INTEGER) r, roteiros, visitas_rota, ped_total FROM clube_venda_dia WHERE dia = ? AND filial = ? AND CAST(rca AS INTEGER) IN (${inRca})`).bind(hoje, fil).all().then((x) => x.results || []).catch(() => []),
    db.prepare(`SELECT DISTINCT CAST(rca AS INTEGER) r FROM clube_checkin WHERE dia = ? AND filial = ? AND tipo = 'CHECKIN' AND CAST(rca AS INTEGER) IN (${inRca})`).bind(hoje, fil).all().then((x) => x.results || []).catch(() => []),
    db.prepare(`SELECT DISTINCT CAST(rca AS INTEGER) r FROM clube_pedido WHERE dia = ? AND filial = ? AND CAST(rca AS INTEGER) IN (${inRca})`).bind(hoje, fil).all().then((x) => x.results || []).catch(() => []),
  ]);
  const vdMap = new Map(vdRows.map((x) => [String(x.r), x]));
  const ckSet = new Set(ckRows.map((x) => String(x.r)));
  const pdSet = new Set(pdRows.map((x) => String(x.r)));
  const semCk = V.filter((v) => {
    const r = String(Number(v.rca)), vd = vdMap.get(r);
    if (!vd || !(Number(vd.roteiros) > 0)) return false;
    if (Number(vd.visitas_rota) > 0 || ckSet.has(r)) return false;
    if (Number(vd.ped_total) > 0 || pdSet.has(r)) return false;
    return true;
  }).map((v) => ({ v, rot: Number((vdMap.get(String(Number(v.rca))) || {}).roteiros) || 0 }));
  if (!semCk.length) return null;
  return [
    `📍 *Sem check-in até ${ctx.hl} — ${equipe}*`,
    '',
    `*Vendedores de varejo com rota e sem check-in (${semCk.length}):*`,
    ...semCk.slice(0, 10).map((x) => `• ${vn(x.v)} · rota ${N(x.rot)}`),
    ...(semCk.length > 10 ? [`• e mais ${semCk.length - 10}`] : []),
    '',
    `👉 Ligar agora para *${vn(semCk[0].v)}* para iniciar a rota.`
  ].join(NL);
}

// 3) 14:00 local (15:00 BRT TCG/MCD/TCA): vendedores de varejo zerados (sem visita e/ou sem venda)
async function textoZerados14h(ctx) {
  const { db, fil, equipe, V, hoje } = ctx;
  const rcas = V.map((v) => String(Number(v.rca))).filter(Boolean);
  if (!rcas.length) return null;
  const inRca = rcas.join(',');
  const [vdRows, ckRows, pdRows] = await Promise.all([
    db.prepare(`SELECT CAST(rca AS INTEGER) r, roteiros, visitas_rota, ped_total FROM clube_venda_dia WHERE dia = ? AND filial = ? AND CAST(rca AS INTEGER) IN (${inRca})`).bind(hoje, fil).all().then((x) => x.results || []).catch(() => []),
    db.prepare(`SELECT DISTINCT CAST(rca AS INTEGER) r FROM clube_checkin WHERE dia = ? AND filial = ? AND tipo = 'CHECKIN' AND CAST(rca AS INTEGER) IN (${inRca})`).bind(hoje, fil).all().then((x) => x.results || []).catch(() => []),
    db.prepare(`SELECT DISTINCT CAST(rca AS INTEGER) r FROM clube_pedido WHERE dia = ? AND filial = ? AND CAST(rca AS INTEGER) IN (${inRca})`).bind(hoje, fil).all().then((x) => x.results || []).catch(() => []),
  ]);
  const vdMap = new Map(vdRows.map((x) => [String(x.r), x]));
  const ckSet = new Set(ckRows.map((x) => String(x.r)));
  const pdSet = new Set(pdRows.map((x) => String(x.r)));
  const semVis = [], visSemVenda = [];
  for (const v of V) {
    const r = String(Number(v.rca)), vd = vdMap.get(r);
    if (!vd || !(Number(vd.roteiros) > 0)) continue;
    const temVenda = Number(vd.ped_total) > 0 || pdSet.has(r);
    if (temVenda) continue;
    const vis = Number(vd.visitas_rota) || (ckSet.has(r) ? 1 : 0);
    if (vis === 0) semVis.push({ v, rot: Number(vd.roteiros) });
    else visSemVenda.push({ v, vis, rot: Number(vd.roteiros) });
  }
  if (!semVis.length && !visSemVenda.length) return null;
  const L = [`🚨 *Zerados às ${ctx.hl} — ${equipe}*`];
  if (semVis.length) L.push('', `*Sem visita e sem venda (${semVis.length}):*`, ...semVis.slice(0, 6).map((x) => `• ${vn(x.v)} · 0 de ${N(x.rot)} visitas`), ...(semVis.length > 6 ? [`• e mais ${semVis.length - 6}`] : []));
  if (visSemVenda.length) L.push('', `*Visitou na rota e ainda sem venda (${visSemVenda.length}):*`, ...visSemVenda.slice(0, 8).map((x) => `• ${vn(x.v)} · ${N(x.vis)}/${N(x.rot)} visitas · R$ 0`), ...(visSemVenda.length > 8 ? [`• e mais ${visSemVenda.length - 8}`] : []));
  const alvo = semVis[0] || visSemVenda[0];
  L.push('', `👉 Cobrar pedido agora com *${vn(alvo.v)}*.`);
  return L.join(NL);
}

// 4) Visitas em clientes com +30 dias sem compra justificados sem venda (12h e 16h local)
async function textoJustificativa30d(ctx) {
  const { db, fil, equipe, V, hoje } = ctx;
  const rcas = V.map((v) => String(Number(v.rca))).filter(Boolean);
  if (!rcas.length) return null;
  const inRca = rcas.join(',');
  const [J, pdRows] = await Promise.all([
    db.prepare(`SELECT CAST(rca AS INTEGER) r, cliente, fantasia, razao, dias_sem_comprar, motivo, data_hora FROM clube_justificativa WHERE filial = ? AND CAST(rca AS INTEGER) IN (${inRca}) AND substr(data_hora, 1, 10) = ? AND dias_sem_comprar > 30 ORDER BY dias_sem_comprar DESC`).bind(fil, hoje).all().then((x) => x.results || []).catch(() => []),
    db.prepare(`SELECT CAST(rca AS INTEGER) r, cliente FROM clube_pedido WHERE dia = ? AND filial = ? AND CAST(rca AS INTEGER) IN (${inRca})`).bind(hoje, fil).all().then((x) => x.results || []).catch(() => []),
  ]);
  const comprouHoje = new Set(pdRows.map((p) => `${p.r}|${String(p.cliente || '')}`));
  const cand = J.filter((j) => j.cliente && !comprouHoje.has(`${j.r}|${String(j.cliente)}`));
  if (!cand.length) return null;
  let validos = cand;
  try {
    const { ultimaCompraGerot } = await import('../jota/respostas/rota.js');
    const ids = [...new Set(cand.map((j) => String(j.cliente)))];
    const U = await ultimaCompraGerot({ env: { DB: db } }, fil, ids, new Map());
    validos = [];
    for (const j of cand) {
      const u = U.get(String(j.cliente));
      const diasReais = u && u < hoje ? Math.max(0, Math.round((Date.parse(hoje) - Date.parse(u)) / 864e5)) : Number(j.dias_sem_comprar);
      if (diasReais > 30) validos.push({ ...j, dias: diasReais });
    }
  } catch (e) { validos = cand.map((j) => ({ ...j, dias: Math.round(Number(j.dias_sem_comprar) || 0) })); }
  if (!validos.length) return null;
  const nomeDe = (r) => { const v = V.find((x) => String(Number(x.rca)) === String(r)); return v ? vn(v) : String(r); };
  const top = validos.slice(0, 8);
  return [
    `⚠️ *Justificativas +30d sem venda — ${equipe}* · até ${ctx.hl}`,
    `*${N(validos.length)}* cliente(s) com mais de 30 dias sem comprar visitados e justificados sem pedido hoje:`,
    '',
    ...top.map((j) => `• *${titulo(String(j.fantasia || j.razao || 'Cliente #' + j.cliente).toLowerCase())}* (#${j.cliente}) · ${N(j.dias)}d\n   ${nomeDe(j.r)} · _${titulo(String(j.motivo || 'sem motivo').toLowerCase())}_`),
    ...(validos.length > 8 ? ['', `• e mais ${validos.length - 8} cliente(s)`] : []),
    '',
    `👉 Ligar com *${nomeDe(top[0].r)}* para tentar reverter *${titulo(String(top[0].fantasia || top[0].razao || '#' + top[0].cliente).toLowerCase())}*.`
  ].join(NL);
}

// IA so reescreve com conferencia: todo numero e todo codigo 'NNN -' do texto novo tem que existir no texto fixo
export function confereReescrita(fixo, novo) {
  if (!novo || novo.length > fixo.length * 1.4) return false;
  const nums = (s) => (String(s).match(/\d[\d.,]*/g) || []).map((x) => x.replace(/[.,]$/, ''));
  const base = new Set(nums(fixo)); return nums(novo).every((n) => base.has(n));
}
async function talvezIA(env, db, fixo) {
  if (String(await flag(db, 'monitoria_ia') || '') !== 'on' || !env.AI) return { texto: fixo, motor: 'fixo' };
  try {
    const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [
      { role: 'system', content: 'Você reescreve alertas de WhatsApp para supervisores de vendas em português do Brasil. Mantenha EXATAMENTE os mesmos números, códigos e nomes, na mesma ordem. Não acrescente nenhum número, nome, cliente, valor, data ou porcentagem. Não invente nada. Só deixe o texto mais humano e direto. Devolva só o texto.' },
      { role: 'user', content: fixo }] });
    const novo = String((r && (r.response || r.result)) || '').trim();
    return confereReescrita(fixo, novo) ? { texto: novo, motor: 'ia_conferida' } : { texto: fixo, motor: 'fixo (ia reprovada na conferencia)' };
  } catch (e) { return { texto: fixo, motor: 'fixo (ia falhou)' }; }
}

// ---------- execucao por filial ----------
export async function executarPiloto(origin, env, opts = {}) {
  const db = env.DB, fil = String(opts.filial || '').toUpperCase(), hoje = hojeSP();
  if (!/^[A-Z]{3}$/.test(fil)) return { erro: 'filial obrigatoria' };
  if (!opts.forcar && (ehFeriado(hoje) || ehFimDeSemana(hoje))) return { filial: fil, silencio: 'feriado ou fim de semana' };
  const jan = opts.janela ? JANELAS.find((j) => j.id === opts.janela) : janelaAgora(fil);
  if (!jan) return { filial: fil, silencio: 'fora das janelas', hora_local: horaLocal(fil), hora_brt: horaBRT() };
  // Fase I: SOMENTE supervisores (22 piloto ou todos os supervisores ativos se flag monitoria_publico = 'todos_supervisores')
  const publico = String(await flag(db, 'monitoria_publico') || 'piloto');
  let C = [];
  if (publico === 'todos_supervisores') {
    C = (await db.prepare("SELECT celular, nome, papel, filial, supervisor FROM bot_contatos WHERE papel = 'supervisor' AND filial = ? AND ativo = 1").bind(fil).all().catch(() => ({ results: [] }))).results || [];
  } else {
    let lista = []; try { lista = JSON.parse(await flag(db, 'monitoria_piloto') || '[]'); } catch (e) { lista = []; }
    const cels = lista.map(String);
    if (!cels.length) return { filial: fil, silencio: 'piloto vazio' };
    C = (await db.prepare(`SELECT celular, nome, papel, filial, supervisor FROM bot_contatos WHERE celular IN (${cels.map(() => '?').join(',')}) AND filial = ? AND papel = 'supervisor' AND ativo = 1`).bind(...cels, fil).all().catch(() => ({ results: [] }))).results || [];
  }
  if (!C || !C.length) return { filial: fil, silencio: 'nenhum supervisor desta filial no publico' };
  // Clube fresco para alertas do Clube (compromisso de 09:30 le o CEVEN Admin, nao exige Clube fresco)
  const cl = await db.prepare('SELECT MAX(lido_em) l FROM clube_rodada WHERE dia = ?').bind(hoje).first().catch(() => null);
  const idade = cl && cl.l ? (Date.now() - Date.parse(cl.l)) / 60000 : 9999;
  if (jan.id !== 'compromisso' && idade > CLUBE_MAX_MIN && !opts.forcar) return { filial: fil, janela: jan.id, silencio: `Clube da Venda lido ha ${Math.round(idade)} min` };
  const de = String(await flag(db, 'monitoria_liberada_de') || '');
  const ate = String(await flag(db, 'monitoria_liberada_ate') || '');
  const agoraIso = new Date().toISOString();
  const liberado = ate > agoraIso && (!de || agoraIso >= de) && !opts.sombra;
  const modo = opts.teste ? 'TESTE' : liberado ? 'PILOTO' : 'SOMBRA';
  const B = criaBase(origin, env), hl = horaLocal(fil), horaBrt = horaBRT(), out = [];
  for (const s of C) {
    const regra = `PILOTO:${jan.id}`;
    try {
      const ja = await db.prepare("SELECT status FROM monitoria_envios WHERE regra_id = ? AND data = ? AND celular = ? AND modo = ?").bind(regra, hoje, s.celular, modo).first();
      if (ja && !opts.teste) { out.push({ sup: s.nome, status: 'JA_FEITO' }); continue; }
      const nDia = await db.prepare("SELECT COUNT(*) n FROM monitoria_envios WHERE regra_id LIKE 'PILOTO:%' AND data = ? AND celular = ? AND status = 'ENVIADO'").bind(hoje, s.celular).first();
      if (modo === 'PILOTO' && Number(nDia && nDia.n) >= MAX_DIA) { out.push({ sup: s.nome, status: 'TETO_DIA' }); continue; }
      const supNome = s.supervisor || s.nome;
      let fixo = null;
      if (jan.id === 'compromisso') {
        fixo = await textoCompromisso({ db, fil, hoje, horaBrt, supNome, equipe: `Equipe ${nomeCurto(supNome)}` });
      } else {
        const Es = await carregaEscopo(B, { nome: 'Equipe ' + nomeCurto(supNome), filiais: [fil], grupo: null, supervisor: supNome });
        const sSup = sem(supNome);
        const V = (Es.vend || []).filter((v) => v.varejo && v.ehVendedorReal !== false && sem(v.nome) !== sSup && !/SUPERVISOR|GERENTE|VAGO|SETOR/.test(sem(v.nome)));
        const ctx = { db, fil, hoje, hl, V, equipe: `Equipe ${nomeCurto(supNome)}` };
        fixo = jan.id === 'sem_checkin' ? await textoSemCheckin(ctx) : jan.id === 'zerados_14h' ? await textoZerados14h(ctx) : await textoJustificativa30d(ctx);
      }
      if (!fixo) { out.push({ sup: s.nome, status: 'NADA_A_DIZER' }); continue; }
      const { texto: t0, motor } = await talvezIA(env, db, fixo);
      const texto = `${t0}${NL}${NL}_Responda *ok* se já tratou ou *não procede* se estiver errado._`;
      let status = modo === 'PILOTO' ? 'ENVIANDO' : modo;
      await db.prepare('INSERT OR IGNORE INTO monitoria_envios (regra_id, data, celular, destino_real, papel, filial, rca, modo, texto_preview, bonequinho, status, enviado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(regra, hoje, s.celular, s.nome, 'supervisor', fil, '', modo, texto.slice(0, 1800), motor, status, new Date().toISOString()).run();
      if (modo === 'PILOTO') {
        await db.prepare('SELECT COUNT(*) n FROM wa_cota WHERE dia = ?').bind(hoje).first();
        const cota = await cotaEnvio(env, s.celular, { manual: true });
        if (!cota.ok) status = 'BLOQUEADO_COTA';
        else { const cfg = env.EVO_URL && env.EVO_KEY ? R.evoCfg(env) : null; const rt = cfg ? await R.enviarTexto(cfg, s.celular, texto) : { ok: false }; status = rt && rt.ok ? 'ENVIADO' : 'ERRO'; }
        await db.prepare('UPDATE monitoria_envios SET status = ? WHERE regra_id = ? AND data = ? AND celular = ? AND modo = ?').bind(status, regra, hoje, s.celular, modo).run();
        if (status === 'ENVIADO') await db.prepare("INSERT INTO bot_msgs (celular, nome, direcao, texto, tipo) VALUES (?, ?, 'out', ?, 'monitoria_piloto')").bind(s.celular, s.nome, texto.slice(0, 2500)).run().catch(() => {});
      }
      out.push({ sup: s.nome, status, motor, texto: opts.ver ? texto : undefined });
    } catch (e) { out.push({ sup: s.nome, status: 'ERRO', erro: String(e && e.message || e).slice(0, 160) }); }
  }
  return { filial: fil, janela: jan.id, fuso: jan.fuso, hora_local: hl, hora_brt: horaBrt, publico, modo, clube_min: Math.round(idade), resultados: out };
}
