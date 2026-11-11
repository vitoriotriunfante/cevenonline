// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/jota/respostas/momentos.js
// O QUE E: os 3 MOMENTOS DO DIA do vendedor (proposta do diretor, 10/11/2026; estudo em docs/ESTUDO_3_MOMENTOS_JOTA.md; Vitorio 11/11: 'comecar com todos').
//   O vendedor cumprimenta ("bom dia", "oi Jota", "boa tarde") e o Jota responde o momento certo, escolhido pelo ESTADO DA ROTA (e pelo relogio):
//   ☀️ PLANO DO DIA  — 4 indicadores (faturamento, positivacao, mix, recorrencia) + 5 clientes de foco da rota de hoje
//   🍽️ MEIO DO DIA   — o que fez de manha, quantos dos 5 de foco ja compraram, o que falta para a tarde
//   🌙 FECHAMENTO    — visitas, tempo em rota, positivacao, vendido, +MIX, foco que virou pedido, Liga
// REGRAS: tudo do D1 (base unica); nunca inventa (sem dado = nao mostra a linha); maximo ~12 linhas; 1 dica de acao; tom de colega de equipe;
//   8 versoes de abertura/fechamento por momento (antispam: a estrutura muda, nao so o nome); a versao muda todo dia para o mesmo vendedor.
//   Os 5 de foco sao fixados na 1a resposta do dia (jota_foco_dia) para o meio do dia e o fechamento medirem quantos viraram pedido.
//   Chave de desligar: config_flags 'jota_momentos' = 'off' -> volta a saudacao de antes (menu).
// =========================================================================
import { N, R$, hojeSP, titulo, diasUteisRestantes } from '../base.js';
import { semCompraNaRota } from './rota.js';

const hhmm = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const minHM = (s) => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const fmtMin = (m) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
const pc = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '—');
const nome1 = (v) => titulo(String(v.nome || '').replace(/^CLT\s*-?\s*/i, '').split(/\s+/)[0] || '');
const hashN = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
// versao do dia: muda todo dia para o mesmo vendedor (dia do ano + vendedor), nunca a mesma de ontem
const versao = (v, momento, n = 8) => { const d = new Date(hojeSP() + 'T12:00:00Z'), doy = Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 0))) / 864e5); return (doy + hashN(v.filial + v.rca + momento)) % n; };

export async function momentosLigados(B) {
  if (!B.env || !B.env.DB) return true;
  try { const r = await B.env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'jota_momentos'").first(); return !(r && /^(off|0|nao|desligado)$/i.test(String(r.valor || ''))); } catch (e) { return true; }
}

// qual momento: pelo estado da rota (estudo 11/11: 1o check-in 08h36, 54% das visitas ate 12h, ultimo check-out 16h07, 90% ate 17h59)
export function qualMomento(v) {
  const m = minHM(hhmm()), R = Array.isArray(v.rotaHoje) ? v.rotaHoje.filter((c) => !/FORA/i.test(String(c.status || ''))) : [];
  const prog = R.length, feitas = R.filter((c) => minHM(c.checkin_horario) != null).length, frac = prog ? feitas / prog : 0;
  if (m >= 17 * 60 || (prog && frac >= 0.9)) return 'fechamento';
  if (m < 11 * 60 && frac < 0.4) return 'plano';
  return 'meio';
}

async function recorrenciaGerot(B, v) {
  try { return await B.env.DB.prepare("SELECT sum(objetivo) objetivo, sum(meta) meta, sum(positivados) positivados FROM gerot_recorrencia_pasta WHERE mes = ? AND filial = ? AND nivel = 'vendedor' AND cod = ? HAVING count(*) > 0").bind(hojeSP().slice(0, 7), String(v.filial), String(v.rca)).first(); } catch (e) { return null; }
}
// CHECK-IN PELA ROTA DO GERENTE (plano de 11/11, item 3): /api/gerente/supervisor/roteiro-hoje, cota propria do gerente, lida no fim de cada rodada.
// Traz status e tem_checkin por cliente (sem horario). Visitado = check-in na leitura individual OU na rota do gerente.
async function rotaGerente(B, v) {
  const M = new Map(); if (!B.env || !B.env.DB) return M;
  try { const { results } = await B.env.DB.prepare('SELECT json FROM rota_gerente_dia WHERE data_ref = ? AND filial = ?').bind(hojeSP(), String(v.filial)).all();
    for (const r of results || []) { let a = []; try { a = JSON.parse(r.json); } catch (e) { continue; } for (const c of a) if (String(c.id_representante) === String(v.rca)) M.set(String(c.id_cliente), c); } } catch (e) { /* sem tabela */ }
  return M;
}
async function mixRec(B, v) { try { return JSON.parse(await B.raw(`public/mix_rec/${v.filial}.json`) || '{}').clientes || {}; } catch (e) { return {}; } }

// 5 de foco: da rota de hoje, sem compra no mes; primeiro TAG recorrencia, depois outra TAG, depois mais tempo sem compra
function escolheFoco(sem) {
  const rec = (x) => (x.c.focos || []).some((f) => /RECORR/i.test(f.industria_foco || '')), tag = (x) => (x.c.focos || []).some((f) => f.industria_foco && !/RECORR/i.test(f.industria_foco));
  const ord = (a, b) => (b.dias ?? 999) - (a.dias ?? 999);
  return [...sem.filter(rec).sort(ord), ...sem.filter((x) => !rec(x) && tag(x)).sort(ord), ...sem.filter((x) => !rec(x) && !tag(x)).sort(ord)].slice(0, 5);
}
export async function focoDoDia(B, v, sem) {
  const db = B.env && B.env.DB, dia = hojeSP();
  if (db) {
    try {
      await db.prepare('CREATE TABLE IF NOT EXISTS jota_foco_dia (dia TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, clientes_json TEXT, em TEXT, PRIMARY KEY (dia, filial, rca))').run();
      const r = await db.prepare('SELECT clientes_json FROM jota_foco_dia WHERE dia = ? AND filial = ? AND rca = ?').bind(dia, String(v.filial), String(v.rca)).first();
      if (r && r.clientes_json) return JSON.parse(r.clientes_json);
    } catch (e) { /* sem tabela: escolhe na hora */ }
  }
  const F = escolheFoco(sem).map((x) => ({ id: String(x.c.id_cliente), nome: titulo(x.c.nome_cliente || x.c.razao_social || 'cliente'), dias: x.dias, cnpj: String(x.c.cnpj || '').replace(/\D/g, ''), rec: (x.c.focos || []).some((f) => /RECORR/i.test(f.industria_foco || '')), tag: (x.c.focos || []).map((f) => f.industria_foco).filter((t) => t && !/RECORR/i.test(t))[0] || null }));
  if (db && F.length) { try { await db.prepare('INSERT OR IGNORE INTO jota_foco_dia (dia, filial, rca, clientes_json, em) VALUES (?,?,?,?,?)').bind(dia, String(v.filial), String(v.rca), JSON.stringify(F), new Date().toISOString()).run(); } catch (e) { /* segue */ } }
  return F;
}

const ABRE = {
  plano: [(n) => `☀️ Bom dia, ${n}! Bora pra mais um dia de jogo.`, (n) => `☀️ Bom dia, ${n}! Separei o seu plano de hoje.`, (n) => `Bom dia, ${n}! ☀️ Olha como você começa o dia:`, (n) => `☀️ Opa, ${n}, bom dia! Seu resumo antes de pegar a estrada:`,
    (n) => `Bom dia, ${n}! 💪 Aqui vai o seu ponto de partida de hoje.`, (n) => `☀️ ${n}, bom dia! Antes do primeiro cliente, dá uma olhada:`, (n) => `Bom dia, ${n}! ⚽ O time conta com você hoje. Seus números:`, (n) => `☀️ Bom dia, ${n}! Café na mão? Seu dia em poucas linhas:`],
  meio: [(n) => `🍽️ E aí, ${n}! Metade do dia: olha como está.`, (n) => `Opa, ${n}! 🍽️ Hora de ver a manhã e planejar a tarde.`, (n) => `🍽️ ${n}, boa! Seu meio de dia em resumo:`, (n) => `Fala, ${n}! 🍽️ Como foi a manhã e o que falta:`,
    (n) => `🍽️ Oi, ${n}! Pausa rápida para o placar do dia:`, (n) => `${n}, bom te ver! 🍽️ Seu dia até agora:`, (n) => `🍽️ Tudo certo, ${n}? Aqui vai o seu parcial:`, (n) => `Opa, ${n}! ⚽ Fim do primeiro tempo. O placar:`],
  fechamento: [(n) => `🌙 Fechando o dia, ${n}! Olha o que você fez hoje:`, (n) => `🌙 ${n}, missão do dia: aqui vai o seu balanço.`, (n) => `Boa, ${n}! 🌙 Seu dia em números:`, (n) => `🌙 Fim de jogo, ${n}! Seu resultado de hoje:`,
    (n) => `${n}, dia batalhado! 🌙 O resumo:`, (n) => `🌙 Oi, ${n}! Como foi o seu dia:`, (n) => `🌙 Valeu pelo dia, ${n}! Olha o placar:`, (n) => `${n}, apito final! 🌙 Seu dia:`],
};
const FECHA = {
  plano: ['Bora pra cima! 🚀', 'Bom trabalho hoje! 💪', 'Conta comigo no caminho. ⚽', 'Foco nesses 5 e o dia rende! 🎯', 'Vamos juntos! 🙌', 'Boas vendas! 🛒', 'Hoje é dia de positivar! ✅', 'Sucesso na rota! 🚗'],
  meio: ['A tarde é sua! 💪', 'Bora fechar forte! 🚀', 'Ainda dá tempo, vamos! ⚽', 'Segue firme! 🙌', 'Tarde boa pra positivar! ✅', 'Conta comigo! 💪', 'Vamos virar esse jogo! ⚽', 'Bora pra próxima! 🚗'],
  fechamento: ['Descansa que amanhã tem mais! 🙌', 'Obrigado pelo dia! 💪', 'Amanhã a gente vai com tudo! 🚀', 'Bom descanso! 🌙', 'Orgulho do seu dia! ⚽', 'Valeu, time! 🙌', 'Amanhã tem mais jogo! ⚽', 'Recarrega as energias! 🔋'],
};
const RODAPE = '_Quer ver mais? Escreva *mais*._';

export async function respMomento(B, c, Ev, momentoForcado = null) {
  const v = Ev && Ev.vend && Ev.vend[0]; if (!v) return null;
  const momento = momentoForcado || qualMomento(v), n = nome1(v) || 'time', ix = versao(v, momento);
  const { rota, sem, pedidoHoje } = await semCompraNaRota(B, v).catch(() => ({ rota: [], sem: [], pedidoHoje: new Map() }));
  const foco = await focoDoDia(B, v, sem);
  const comprouHoje = (id) => (pedidoHoje && pedidoHoje.has(String(id)));
  const comprouMes = (id) => !sem.some((x) => String(x.c.id_cliente) === String(id));
  const L = [ABRE[momento][ix](n), ''];
  // mesma conta do CEVEN e do item 1 do Jota (11/11): % = (faturado + a faturar) / meta; falta = meta - faturado - a faturar
  const vend = (v.fat || 0) + (v.pend || 0), falta = Math.max(0, (v.meta || 0) - vend), du = diasUteisRestantes(), porDia = du ? falta / du : 0;
  if (momento === 'plano') {
    const g = await recorrenciaGerot(B, v);
    if (v.meta > 0) L.push(`💰 Faturamento: *${pc(vend, v.meta)}* da meta (${R$(vend)} de ${R$(v.meta)}, com ${R$(v.pend || 0)} a faturar)`);
    if (v.metaPos) L.push(`👥 Positivação: *${N(v.pos || 0)} de ${N(v.metaPos)}* clientes`);
    if (v.mixMes && v.mixMes.clientes_distintos) L.push(`🧺 Mix: *${(v.mixMes.soma_skus_por_cliente / v.mixMes.clientes_distintos).toFixed(1).replace('.', ',')}* produtos por cliente`);
    if (g && g.meta) L.push(`🔄 Recorrência: *${N(g.positivados || 0)} de ${N(g.meta)}* da meta`);
    if (foco.length) {
      const M = await mixRec(B, v);
      L.push('', `🎯 *Seus ${foco.length} clientes de foco hoje:*`);
      const usados = new Set(), repNome = new Set(foco.map((f) => f.nome).filter((nm, i, arr) => arr.indexOf(nm) !== i));
      foco.forEach((f, i) => { const recs = (M[f.cnpj] || {}).rec || [], r = recs.find((x) => !usados.has(String(x[0]))) || recs[0]; if (r) usados.add(String(r[0])); L.push(`${i + 1}. ${f.nome}${repNome.has(f.nome) ? ` (#${f.id})` : ''}${f.dias != null ? ` · ${f.dias} dias sem compra` : ''}${f.rec ? ' · 🔄' : f.tag ? ` · ${titulo(f.tag)}` : ''}${r ? ` · ofereça *${titulo(r[1])}*` : ''}`); });
    } else if (rota.length) L.push('', '✅ Todos os clientes da sua rota de hoje já compraram no mês. Hoje é dia de aumentar o mix! 🧺');
    else L.push('', '📅 Você não tem rota hoje no CEVEN.');
    if (porDia > 0) L.push('', `💡 Para o ritmo da meta, o dia de hoje pede *${R$(porDia)}*.`);
  } else {
    const RG = await rotaGerente(B, v), R = rota, feitas = R.filter((x) => minHM(x.checkin_horario) != null || Number((RG.get(String(x.id_cliente)) || {}).tem_checkin) === 1), ci = feitas.map((x) => minHM(x.checkin_horario)), co = R.map((x) => minHM(x.checkout_horario)).filter((x) => x != null);
    const fFeitos = foco.filter((f) => comprouHoje(f.id) || comprouMes(f.id));
    if (momento === 'meio') {
      L.push(`🚶 Visitas: *${feitas.length} de ${R.length}*` + (R.length - feitas.length ? ` · faltam ${R.length - feitas.length}` : ''));
      L.push(`📝 Vendido hoje: *${R$(v.dig || 0)}*` + (v.ped ? ` em ${N(v.ped)} cliente(s)` : ''));
      if (foco.length) L.push(`🎯 Foco do dia: *${fFeitos.length} de ${foco.length}* já compraram`);
      const naoVis = foco.filter((f) => !feitas.some((x) => String(x.id_cliente) === f.id) && !comprouHoje(f.id));
      if (porDia > 0) { const fh = Math.max(0, porDia - (v.dig || 0)); L.push(fh > 0 ? `💰 Para o ritmo da meta faltam *${R$(fh)}* hoje` : '💰 Ritmo da meta de hoje: *batido!* 🎉'); }
      if (naoVis.length) L.push('', `💡 Na tarde, não esquece: *${naoVis.slice(0, 3).map((f) => f.nome).join('*, *')}*.`);
      else if (R.length - feitas.length) L.push('', `💡 Restam ${R.length - feitas.length} clientes na rota: cada um é uma chance de positivar.`);
    } else {
      L.push(`🚶 Visitou *${feitas.length} de ${R.length}* clientes da rota`);
      if (ci.length && co.length) L.push(`⏱️ Tempo em rota: *${fmtMin(Math.max(...co) - Math.min(...ci))}* (${String(Math.floor(Math.min(...ci) / 60)).padStart(2, '0')}h${String(Math.min(...ci) % 60).padStart(2, '0')} às ${String(Math.floor(Math.max(...co) / 60)).padStart(2, '0')}h${String(Math.max(...co) % 60).padStart(2, '0')})`);
      L.push(`📝 Vendeu hoje: *${R$(v.dig || 0)}*` + (v.ped ? ` · positivou *${N(v.ped)}* cliente(s)` : ''));
      if (foco.length) L.push(`🎯 Foco do dia: *${fFeitos.length} de ${foco.length}* viraram pedido`);
      try { const lc = await B.lances(); const hj = lc ? (lc.lances || []).filter((l) => String(l.rca) === String(v.rca) && l.filial === v.filial) : []; if (hj.length) L.push(`⚽ Liga hoje: *${hj.reduce((a, l) => a + (l.pontos || 0), 0)} pontos* em ${hj.length} lance(s)`); } catch (e) { /* sem liga */ }
      const faltaF = foco.filter((f) => !comprouHoje(f.id) && !comprouMes(f.id));
      L.push('', fFeitos.length >= 3 ? `🏆 Dia forte no foco! ${fFeitos.length} dos ${foco.length} clientes compraram.` : faltaF.length ? `💡 Para a próxima visita: *${faltaF.slice(0, 2).map((f) => f.nome).join('* e *')}* seguem sem compra no mês.` : '💡 Amanhã tem rota nova: bora repetir!');
    }
  }
  L.push('', FECHA[momento][(ix + 3) % 8], RODAPE, `〔M:${momento}〕`);
  // INCENTIVO (Vitorio, 11/11/2026: 'para incentivar as vezes seria necessario'): figurinha 'bora destravar' quando o dia esta fraco (nunca bronca)
  const focoOk = foco.filter((f) => comprouHoje(f.id) || comprouMes(f.id)).length;
  const incentiva = momento === 'meio' ? (foco.length > 0 && focoOk === 0 && porDia > 0 && (v.dig || 0) < porDia * 0.5) : momento === 'fechamento' ? (foco.length > 0 && focoOk === 0) : false;
  return { texto: L.join('\n'), momento, incentiva, comemora: momento === 'fechamento' ? (foco.length && foco.filter((f) => comprouHoje(f.id) || comprouMes(f.id)).length >= 3) : momento === 'meio' ? (porDia > 0 && (v.dig || 0) >= porDia) : (ix % 2 === 0) };
}

// =========================================================================
// 3 MOMENTOS DO SUPERVISOR (Vitorio, 11/11/2026: 'manda bala'; estudo em docs/ESTUDO_3_MOMENTOS_SUPERVISOR.md)
//   ☀️ ABERTURA DA EQUIPE  — KPIs da equipe (faseamento no AS), compromisso ate 10h, RET sugerida (vendedor mais atras do ritmo + 5 de foco dele), quem comecou a rota
//   🍽️ MEIO DO DIA         — visitas, vendido, quem tem rota e esta sem pedido (para ligar), foco da equipe, vendedores numerados
//   🌙 FECHAMENTO          — visitas, positivacao, vendido, foco que virou pedido, 3 melhores do dia, quem precisa de atencao, Liga da equipe
// O numero de um vendedor da lista abre o menu dele (marcador 〔MS:momento〕; o indice do supervisor trata). Mesmos 5 de foco do vendedor (jota_foco_dia).
// =========================================================================
const semAc = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const ehAS = (v) => /^(AS|PET)/i.test(String(v.canal || ''));
const curto = (v) => `${v.rca} - ${titulo(String(v.nome || '').replace(/^CLT\s*-?\s*/i, '').split(/\s+/).filter((w) => !/^(DE|DA|DO|DOS|DAS|E)$/i.test(w)).slice(0, 2).join(' '))}`;

async function statusSupervisor(B, filial, nomeSup) {
  const out = { compromisso: null, ret: null };
  if (!B.env || !B.env.DB) return out;
  try {
    const { results } = await B.env.DB.prepare("SELECT tipo, json FROM supervisores_dia WHERE data_ref = ? AND tipo IN ('compromissos','ret')").bind(hojeSP()).all();
    const alvo = semAc(nomeSup);
    for (const r of results || []) {
      let j; try { j = JSON.parse(r.json); } catch (e) { continue; }
      const s = (j.supervisores || []).find((x) => String(x.filial || '').toUpperCase().startsWith(String(filial)) && (semAc(x.nome) === alvo || semAc(x.nome).startsWith(alvo) || alvo.startsWith(semAc(x.nome))));
      if (s) out[r.tipo === 'ret' ? 'ret' : 'compromisso'] = (s.porDia || [])[0] === true;
    }
  } catch (e) { /* sem dado */ }
  return out;
}
async function recorrenciaEquipe(B, filial, nomeSup) {
  try { return await B.env.DB.prepare("SELECT objetivo, meta, positivados FROM gerot_recorrencia_pasta WHERE mes = ? AND filial = ? AND nivel = 'supervisor' AND upper(nome) LIKE ? ORDER BY em DESC LIMIT 1").bind(hojeSP().slice(0, 7), String(filial), '%' + semAc(nomeSup).split(' ').slice(0, 2).join(' ') + '%').first(); } catch (e) { return null; }
}

export function qualMomentoEquipe(V) {
  const m = minHM(hhmm());
  let prog = 0, feitas = 0;
  for (const v of V) { const R = Array.isArray(v.rotaHoje) ? v.rotaHoje.filter((c) => !/FORA/i.test(String(c.status || ''))) : []; prog += R.length; feitas += R.filter((c) => minHM(c.checkin_horario) != null).length; }
  const frac = prog ? feitas / prog : 0;
  if (m >= 17 * 60 || (prog && frac >= 0.9)) return 'fechamento';
  if (m < 10 * 60 + 30 && frac < 0.4) return 'abertura';
  return 'meio';
}

const ABRE_S = {
  abertura: [(n) => `☀️ Bom dia, ${n}! O plano da sua equipe hoje:`, (n) => `☀️ ${n}, bom dia! Antes do time sair, olha o placar:`, (n) => `Bom dia, ${n}! ⚽ Sua equipe começa assim:`, (n) => `☀️ Opa, ${n}! Seu ponto de partida com o time:`,
    (n) => `Bom dia, ${n}! 💪 Onde a equipe está e onde focar:`, (n) => `☀️ ${n}, bom dia! O resumo do time em poucas linhas:`, (n) => `Bom dia, ${n}! 🎯 O dia da equipe começa aqui:`, (n) => `☀️ Bom dia, ${n}! Café na mão? O time hoje:`],
  meio: [(n) => `🍽️ ${n}, metade do dia! Como está o time:`, (n) => `Opa, ${n}! 🍽️ O parcial da equipe:`, (n) => `🍽️ E aí, ${n}! Onde agir agora:`, (n) => `${n}, boa! 🍽️ A manhã da equipe em resumo:`,
    (n) => `🍽️ Oi, ${n}! O time até agora:`, (n) => `Fala, ${n}! ⚽ Fim do primeiro tempo da equipe:`, (n) => `🍽️ ${n}, pausa rápida: o placar do time:`, (n) => `Opa, ${n}! 🍽️ Quem precisa de você agora:`],
  fechamento: [(n) => `🌙 Fechando o dia, ${n}! O balanço da equipe:`, (n) => `🌙 ${n}, apito final! Como o time foi:`, (n) => `Boa, ${n}! 🌙 O dia da equipe em números:`, (n) => `🌙 Fim de jogo, ${n}! O resultado do time:`,
    (n) => `${n}, dia batalhado! 🌙 O resumo da equipe:`, (n) => `🌙 Oi, ${n}! Como foi o dia do time:`, (n) => `🌙 Valeu pelo dia, ${n}! O placar da equipe:`, (n) => `${n}, missão do dia! 🌙 A equipe:`],
};
const FECHA_S = {
  abertura: ['Bora com o time! 🚀', 'Bom jogo hoje! ⚽', 'Conta comigo! 💪', 'Foco na RET e o dia rende! 🎯', 'Vamos juntos! 🙌', 'Boas vendas para a equipe! 🛒', 'Hoje é dia de positivar! ✅', 'Sucesso, técnico! 🏆'],
  meio: ['A tarde é do time! 💪', 'Bora virar o jogo! ⚽', 'Ainda dá tempo! 🚀', 'Segue firme com a equipe! 🙌', 'Uma ligação agora muda o dia! 📞', 'Conta comigo! 💪', 'Bora pra cima! 🚀', 'Tarde boa pra positivar! ✅'],
  fechamento: ['Descansa que amanhã tem mais! 🙌', 'Obrigado pelo dia! 💪', 'Amanhã a gente vai com tudo! 🚀', 'Bom descanso! 🌙', 'Orgulho do time! ⚽', 'Valeu, técnico! 🏆', 'Amanhã tem mais jogo! ⚽', 'Recarrega as energias! 🔋'],
};

export async function respMomentoSupervisor(B, c, Ev, momentoForcado = null) {
  const V = (Ev && Ev.vend ? Ev.vend : []).filter((v) => v.ehVendedorReal !== false).sort((a, b) => Number(a.rca) - Number(b.rca));
  if (!V.length) return null;
  const nomeSup = c.supervisor || c.nome, filial = String(c.filial || V[0].filial), n = titulo(String(c.nome || '').split(/\s+/)[0]) || 'time';
  const momento = momentoForcado || qualMomentoEquipe(V), ix = versao({ filial, rca: 'S' + semAc(nomeSup) }, momento);
  const vend = (v) => (v.fat || 0) + (v.pend || 0);
  // KPIs da equipe = TODOS os vendedores da equipe (inclusive setor vago), igual ao item 2 do menu (11/11: R$ 540 mil x R$ 600 mil no Victor Hugo); listas = so pessoas
  const TODOS = ((Ev && Ev.vend) || V).concat((Ev && Ev.ocultos) || []);   // + ocultos da Gestao que estao na arvore do CEVEN (mesma regra do item 2: 'tudo que existe hoje no CEVEN soma')
  const soma = (f) => TODOS.reduce((a, v) => a + (Number(f(v)) || 0), 0);
  const soAS = !V.some((v) => Array.isArray(v.rotaHoje) && v.rotaHoje.length);
  // por vendedor: rota, visitas (individual ou rota do gerente), vendido hoje, foco do dia (o MESMO do vendedor)
  const linhas = [];
  for (const v of V) {
    const x = { v, prog: 0, feitas: 0, dig: v.dig || 0, foco: [], focoOk: 0, pct: v.meta ? vend(v) / v.meta : null };
    if (Array.isArray(v.rotaHoje) && v.rotaHoje.length) {
      const RG = await rotaGerente(B, v);
      const { rota, sem, pedidoHoje } = await semCompraNaRota(B, v).catch(() => ({ rota: [], sem: [], pedidoHoje: new Map() }));
      x.prog = rota.length; x.feitas = rota.filter((r) => minHM(r.checkin_horario) != null || Number((RG.get(String(r.id_cliente)) || {}).tem_checkin) === 1).length;
      x.foco = await focoDoDia(B, v, sem);
      const semIds = new Set(sem.map((s) => String(s.c.id_cliente)));
      x.focoOk = x.foco.filter((f) => (pedidoHoje && pedidoHoje.has(f.id)) || !semIds.has(f.id)).length;
    }
    linhas.push(x);
  }
  const L = [ABRE_S[momento][ix](n), ''];
  const meta = soma((v) => v.meta), vd = soma(vend), du = diasUteisRestantes(), porDia = du ? Math.max(0, meta - vd) / du : 0;
  const dig = soma((v) => v.dig), prog = linhas.reduce((a, x) => a + x.prog, 0), feitas = linhas.reduce((a, x) => a + x.feitas, 0);
  const fTot = linhas.reduce((a, x) => a + x.foco.length, 0), fOk = linhas.reduce((a, x) => a + x.focoOk, 0);
  const lista = [];
  const linhaV = (x, extra) => { lista.push(x.v); return `• *${curto(x.v)}*${extra ? ' · ' + extra : ''}`; };   // 11/11/2026: sem posicao; o numero digitado e o CODIGO do vendedor
  if (momento === 'abertura') {
    // as duas partes explicitas (11/11: o item 2 mostra so o faturado em %; aqui faturado + a faturar, como o CEVEN)
    if (meta > 0) L.push(`💰 Faturamento: *${pc(vd, meta)}* da meta com o a faturar · faturado ${R$(soma((v) => v.fat))} (${pc(soma((v) => v.fat), meta)}) + a faturar ${R$(soma((v) => v.pend))} de ${R$(meta)}`);
    const vAS = TODOS.filter(ehAS);
    if (vAS.length) { const m = vAS.reduce((a, v) => a + (v.meta || 0), 0), f = vAS.reduce((a, v) => a + (v.fat || 0), 0); if (m > 0) L.push(`📐 Faseamento AS (60% até o dia 20): *${pc(f, m * 0.6)}* do alvo (${R$(f)} de ${R$(m * 0.6)})`); }
    const mp = soma((v) => v.metaPos); if (mp) L.push(`👥 Positivação: *${N(soma((v) => v.pos))} de ${N(mp)}* clientes`);
    const mx = TODOS.filter((v) => v.mixMes && v.mixMes.clientes_distintos);
    if (mx.length) L.push(`🧺 Mix: *${(mx.reduce((a, v) => a + v.mixMes.soma_skus_por_cliente, 0) / mx.reduce((a, v) => a + v.mixMes.clientes_distintos, 0)).toFixed(1).replace('.', ',')}* produtos por cliente`);
    const g = await recorrenciaEquipe(B, filial, nomeSup); if (g && g.meta) L.push(`🔄 Recorrência: *${N(g.positivados || 0)} de ${N(g.meta)}* da meta`);
    const st = await statusSupervisor(B, filial, nomeSup);
    if (st.compromisso === true) L.push('', '✅ Compromisso de hoje: *feito*');
    else if (st.compromisso === false) L.push('', minHM(hhmm()) < 10 * 60 ? '⏰ Compromisso de hoje: *ainda não feito* · prazo até as 10h' : '⚠️ Compromisso de hoje: *não feito*');
    // RET sugerida: vendedor de rota mais atras do ritmo da meta, com os 5 de foco dele
    const cand = linhas.filter((x) => x.prog && x.pct != null).sort((a, b) => a.pct - b.pct)[0];
    if (cand) { L.push('', `🚗 *RET sugerida: ${curto(cand.v)}* (${pc(vend(cand.v), cand.v.meta)} da meta, o mais atrás da equipe)`); if (cand.foco.length) { const rep = new Set(cand.foco.map((f) => f.nome).filter((nm, i, a) => a.indexOf(nm) !== i)); L.push(`   Foco dele hoje: ${cand.foco.slice(0, 5).map((f) => f.nome + (rep.has(f.nome) ? ` (#${f.id})` : '')).join(' · ')}`); } }
    if (!soAS) { const semCk = linhas.filter((x) => x.prog && !x.feitas); L.push('', `🚶 Rota: *${linhas.filter((x) => x.feitas).length} de ${linhas.filter((x) => x.prog).length}* vendedores já começaram` + (semCk.length ? ` · ainda sem check-in: ${semCk.slice(0, 4).map((x) => curto(x.v)).join(', ')}` : '')); }
    if (porDia > 0) L.push(`💡 Para o ritmo da meta, a equipe precisa de *${R$(porDia)}* por dia útil.`);
  } else if (momento === 'meio') {
    if (!soAS) L.push(`🚶 Visitas: *${feitas} de ${prog}*`);
    L.push(`📝 Vendido hoje: *${R$(dig)}*` + (soma((v) => v.ped) ? ` em ${N(soma((v) => v.ped))} cliente(s)` : ''));
    if (fTot) L.push(`🎯 Foco da equipe: *${fOk} de ${fTot}* clientes já compraram`);
    const ligar = linhas.filter((x) => x.prog && x.feitas && !(x.dig > 0)).sort((a, b) => b.feitas - a.feitas);
    if (ligar.length) { L.push('', '📞 *Ligar agora (rota e sem pedido):*'); for (const x of ligar.slice(0, 5)) L.push(linhaV(x, `${x.feitas} de ${x.prog} visitas · R$ 0`)); }
    const resto = linhas.filter((x) => !ligar.includes(x)).sort((a, b) => (b.dig || 0) - (a.dig || 0));
    if (resto.length) { L.push('', '*Equipe hoje:*'); for (const x of resto.slice(0, 12)) L.push(linhaV(x, `${R$(x.dig)}${x.prog ? ` · ${x.feitas}/${x.prog} visitas` : ''}${x.foco.length ? ` · foco ${x.focoOk}/${x.foco.length}` : ''}`)); }
    L.push('', `👉 *Digite o código do vendedor* (ex.: *${(lista[0] || V[0]).rca}*) para abrir o menu dele.`);
  } else {
    if (!soAS) L.push(`🚶 Visitas: *${feitas} de ${prog}*`);
    L.push(`📝 Vendido hoje: *${R$(dig)}* · positivou *${N(soma((v) => v.ped))}* cliente(s)`);
    if (fTot) L.push(`🎯 Foco da equipe: *${fOk} de ${fTot}* viraram pedido`);
    try { const lc = await B.lances(); const rcas = new Set(V.map((v) => v.filial + '|' + v.rca)); const hj = lc ? (lc.lances || []).filter((l) => rcas.has(l.filial + '|' + String(l.rca))) : []; if (hj.length) L.push(`⚽ Liga hoje: *${hj.reduce((a, l) => a + (l.pontos || 0), 0)} pontos* da equipe em ${hj.length} lance(s)`); } catch (e) { /* sem liga */ }
    const top = linhas.filter((x) => x.dig > 0).sort((a, b) => b.dig - a.dig).slice(0, 3);
    if (top.length) { L.push('', '🏆 *Destaques do dia (para elogiar):*'); for (const x of top) L.push(linhaV(x, `${R$(x.dig)}${x.foco.length ? ` · foco ${x.focoOk}/${x.foco.length}` : ''}`)); }
    const aten = linhas.filter((x) => x.prog && !(x.dig > 0)).slice(0, 4);
    if (aten.length) { L.push('', '👀 *Atenção amanhã (rota e sem pedido hoje):*'); for (const x of aten) L.push(linhaV(x, `${x.feitas} de ${x.prog} visitas`)); }
    if (lista.length) L.push('', `👉 *Digite o código do vendedor* (ex.: *${(lista[0] || V[0]).rca}*) para abrir o menu dele.`);
  }
  L.push('', FECHA_S[momento][(ix + 3) % 8], '_Quer ver mais? Escreva *mais*._', `〔MS:${momento}〕`);
  const comemora = momento === 'fechamento' ? (fTot > 0 && fOk / fTot >= 0.5) : momento === 'meio' ? (porDia > 0 && dig >= porDia * 0.5) : (ix % 2 === 0);
  const incentiva = !comemora && (momento === 'meio' ? (fTot > 0 && fOk === 0 && dig < porDia * 0.25) : momento === 'fechamento' ? (fTot > 0 && fOk === 0) : false);
  return { texto: L.join('\n'), momento, comemora, incentiva, vendedores: lista.map((v) => ({ filial: v.filial, rca: String(v.rca), nome: v.nome })) };
}

// =========================================================================
// 3 MOMENTOS DO GERENTE (Vitorio, 11/11/2026: 'falta o do gerente... ele ve resumo dos supervisores... dai abre por supervisor... depois abre por vendedor')
//   Mesma base do vendedor e do supervisor. Filial (ou grupo, em TPH/MCD) -> supervisores numerados -> o numero abre o MOMENTO DO SUPERVISOR -> o numero abre o vendedor.
//   O que os gerentes pedem (144 mensagens): numeros por supervisor, faturado + carteira, venda de hoje, piores vendedores, sem pedido hoje.
// =========================================================================
export function supervisoresDaEquipe(V) {
  const m = new Map();
  for (const v of V) { const s = String(v.supervisor || 'sem supervisor'); if (!m.has(s)) m.set(s, []); m.get(s).push(v); }
  return [...m.entries()].filter(([s]) => !/^(sem supervisor|GERENTE)/i.test(s)).sort((a, b) => a[0].localeCompare(b[0]));
}
const ABRE_G = {
  abertura: [(n, f) => `☀️ Bom dia, ${n}! A ${f} começa o dia assim:`, (n, f) => `Bom dia, ${n}! ⚽ O plano da ${f} hoje:`, (n, f) => `☀️ ${n}, bom dia! Onde a ${f} está e onde focar:`, (n, f) => `☀️ Opa, ${n}! Seu ponto de partida na ${f}:`,
    (n, f) => `Bom dia, ${n}! 💪 A ${f} em poucas linhas:`, (n, f) => `☀️ Bom dia, ${n}! O placar da ${f}:`, (n, f) => `Bom dia, ${n}! 🎯 O dia da ${f} começa aqui:`, (n, f) => `☀️ ${n}, café na mão? A ${f} hoje:`],
  meio: [(n, f) => `🍽️ ${n}, metade do dia! Como está a ${f}:`, (n, f) => `Opa, ${n}! 🍽️ O parcial da ${f}:`, (n, f) => `🍽️ E aí, ${n}! Onde agir na ${f}:`, (n, f) => `${n}, boa! 🍽️ A manhã da ${f}:`,
    (n, f) => `🍽️ Oi, ${n}! A ${f} até agora:`, (n, f) => `Fala, ${n}! ⚽ Fim do primeiro tempo da ${f}:`, (n, f) => `🍽️ ${n}, o placar da ${f}:`, (n, f) => `Opa, ${n}! 🍽️ Quem precisa de você na ${f}:`],
  fechamento: [(n, f) => `🌙 Fechando o dia, ${n}! O balanço da ${f}:`, (n, f) => `🌙 ${n}, apito final na ${f}:`, (n, f) => `Boa, ${n}! 🌙 O dia da ${f} em números:`, (n, f) => `🌙 Fim de jogo, ${n}! A ${f} hoje:`,
    (n, f) => `${n}, dia batalhado! 🌙 A ${f}:`, (n, f) => `🌙 Oi, ${n}! Como foi o dia da ${f}:`, (n, f) => `🌙 Valeu pelo dia, ${n}! O placar da ${f}:`, (n, f) => `${n}, missão do dia! 🌙 A ${f}:`],
};
export async function respMomentoGerente(B, c, Ev, momentoForcado = null) {
  const V = (Ev && Ev.vend ? Ev.vend : []).filter((v) => v.ehVendedorReal !== false);
  if (!V.length) return null;
  const TODOS = ((Ev && Ev.vend) || V).concat((Ev && Ev.ocultos) || []);
  const filial = String(c.filial || V[0].filial), nomeF = filial + (c.grupo ? ' · ' + titulo(c.grupo) : ''), n = titulo(String(c.nome || '').split(/\s+/)[0]) || 'time';
  const momento = momentoForcado || qualMomentoEquipe(V), ix = versao({ filial, rca: 'G' + (c.grupo || '') }, momento);
  const vend = (v) => (v.fat || 0) + (v.pend || 0), soma = (L, f) => L.reduce((a, v) => a + (Number(f(v)) || 0), 0);
  // visitas = mesma conta do supervisor e do vendedor: check-in individual OU tem_checkin na rota do gerente (11/11: 67 x 69 na equipe do Eder)
  const RGf = new Map(); try { const { results } = await B.env.DB.prepare('SELECT json FROM rota_gerente_dia WHERE data_ref = ? AND filial = ?').bind(hojeSP(), filial).all(); for (const r of results || []) { let a2 = []; try { a2 = JSON.parse(r.json); } catch (e) { continue; } for (const x of a2) RGf.set(String(x.id_representante) + '|' + String(x.id_cliente), x); } } catch (e) { /* sem rota do gerente */ }
  const visitas = (L) => { let p = 0, f = 0; for (const v of L) { const vis = new Set(), R = Array.isArray(v.rotaHoje) ? v.rotaHoje.filter((x) => !/FORA/i.test(String(x.status || '')) && !vis.has(String(x.id_cliente)) && vis.add(String(x.id_cliente))) : []; p += R.length; f += R.filter((x) => minHM(x.checkin_horario) != null || Number((RGf.get(String(v.rca) + '|' + String(x.id_cliente)) || {}).tem_checkin) === 1).length; } return { p, f }; };
  const S = supervisoresDaEquipe(V), meta = soma(TODOS, (v) => v.meta), vd = soma(TODOS, vend), du = diasUteisRestantes(), porDia = du ? Math.max(0, meta - vd) / du : 0;
  const st = momento === 'abertura' ? await Promise.all(S.map(([s]) => statusSupervisor(B, filial, s))) : [];
  const L = [ABRE_G[momento][ix](n, nomeF), ''];
  if (meta > 0) L.push(`💰 Faturamento: *${pc(vd, meta)}* da meta com o a faturar · faturado ${R$(soma(TODOS, (v) => v.fat))} (${pc(soma(TODOS, (v) => v.fat), meta)}) + a faturar ${R$(soma(TODOS, (v) => v.pend))} de ${R$(meta)}`);
  const vi = visitas(V), dig = soma(V, (v) => v.dig);
  if (momento === 'abertura') {
    const mp = soma(TODOS, (v) => v.metaPos); if (mp) L.push(`👥 Positivação: *${N(soma(TODOS, (v) => v.pos))} de ${N(mp)}* clientes`);
    const vAS = TODOS.filter(ehAS); if (vAS.length) { const m = soma(vAS, (v) => v.meta), f = soma(vAS, (v) => v.fat); if (m > 0) L.push(`📐 Faseamento AS (60% até o dia 20): *${pc(f, m * 0.6)}* do alvo`); }
    try { const g = await B.env.DB.prepare("SELECT objetivo, meta, positivados FROM gerot_recorrencia_pasta WHERE mes = ? AND filial = ? AND nivel = 'filial' LIMIT 1").bind(hojeSP().slice(0, 7), filial).first(); if (g && g.meta && !c.grupo) L.push(`🔄 Recorrência: *${N(g.positivados || 0)} de ${N(g.meta)}* da meta`); } catch (e) { /* sem GEROT */ }
    const semComp = S.filter((x, i) => st[i] && st[i].compromisso === false).map(([s]) => titulo(s.split(' ')[0]));
    if (st.length) L.push(`🗓️ Compromisso: *${S.length - semComp.length} de ${S.length}* supervisores` + (semComp.length ? ` · faltam: ${semComp.join(', ')}` : ' ✅'));
    if (porDia > 0) L.push(`💡 Para o ritmo da meta, a ${filial} precisa de *${R$(porDia)}* por dia útil.`);
  } else {
    if (vi.p) L.push(`🚶 Visitas: *${vi.f} de ${vi.p}*`);
    L.push(`📝 Vendido hoje: *${R$(dig)}*` + (soma(V, (v) => v.ped) ? ` em ${N(soma(V, (v) => v.ped))} cliente(s)` : ''));
    const semPed = V.filter((v) => Array.isArray(v.rotaHoje) && v.rotaHoje.some((x) => minHM(x.checkin_horario) != null) && !(v.dig > 0));
    if (semPed.length) L.push(`📞 Vendedores com visita e sem pedido: *${semPed.length}* · escreva *zerados* para ver quem são`);
    if (momento === 'fechamento') { try { const lc = await B.lances(); const rcas = new Set(V.map((v) => v.filial + '|' + v.rca)); const hj = lc ? (lc.lances || []).filter((l) => rcas.has(l.filial + '|' + String(l.rca))) : []; if (hj.length) L.push(`⚽ Liga hoje: *${hj.reduce((a, l) => a + (l.pontos || 0), 0)} pontos* da ${filial}`); } catch (e) { /* sem liga */ } }
  }
  L.push('', '*Supervisores:*');
  S.forEach(([s, Vs], i) => { const vs = visitas(Vs), d = soma(Vs, (v) => v.dig), m = soma(Vs, (v) => v.meta);
    const extra = momento === 'abertura' ? `${m ? pc(soma(Vs, vend), m) + ' da meta' : 'sem meta'}${st[i] && st[i].compromisso === false ? ' · ⏰ sem compromisso' : st[i] && st[i].compromisso ? ' · ✅' : ''}` : `hoje ${R$(d)}${vs.p ? ` · ${vs.f}/${vs.p} visitas` : ''}${m ? ` · ${pc(soma(Vs, vend), m)} da meta` : ''}`;
    L.push(`${i + 1}. *${titulo(s.split(' ').slice(0, 2).join(' '))}* · ${extra}`); });
  if (momento !== 'abertura') { const ordem = S.map(([s, Vs]) => [s, soma(Vs, (v) => v.dig)]).sort((a, b) => b[1] - a[1]); if (ordem.length > 1) L.push('', `🏆 Melhor do dia: *${titulo(ordem[0][0].split(' ')[0])}* (${R$(ordem[0][1])}) · 👀 atenção: *${titulo(ordem[ordem.length - 1][0].split(' ')[0])}* (${R$(ordem[ordem.length - 1][1])})`); }
  L.push('', '👉 *Digite o número do supervisor* para abrir a equipe dele.', '', FECHA_S[momento === 'abertura' ? 'abertura' : momento][(ix + 3) % 8], '_Quer ver mais? Escreva *mais*._', `〔MG:${momento}〕`);
  const comemora = momento === 'fechamento' ? (porDia > 0 && dig >= porDia) : momento === 'meio' ? (porDia > 0 && dig >= porDia * 0.5) : (ix % 2 === 0);
  return { texto: L.join('\n'), momento, comemora, incentiva: false, supervisores: S.map(([s]) => s) };
}
