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
async function focoDoDia(B, v, sem) {
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
      const usados = new Set();
      foco.forEach((f, i) => { const recs = (M[f.cnpj] || {}).rec || [], r = recs.find((x) => !usados.has(String(x[0]))) || recs[0]; if (r) usados.add(String(r[0])); L.push(`${i + 1}. ${f.nome}${f.dias != null ? ` · ${f.dias} dias sem compra` : ''}${f.rec ? ' · 🔄' : f.tag ? ` · ${titulo(f.tag)}` : ''}${r ? ` · ofereça *${titulo(r[1])}*` : ''}`); });
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
