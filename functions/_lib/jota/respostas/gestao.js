// =========================================================================
// JOTA · functions/_lib/jota/respostas/gestao.js
// O QUE É: carteira, ritmo, gaps, rankings, comparações, dobradinha, aviso de equipe.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { N, P, R$, SUGESTAO, hojeSP, nome2, sem, titulo, vn } from '../base.js';
import { agrupa, pctTxt, pessoaReal, supChave, supNome, supReal } from '../escopo.js';
import { totaisOficiais } from './resumo.js';

// ---------- PERGUNTAS DA REUNIAO DE 5 H (25/10/2026) que o dado do site ja responde ----------
export function diasUteisMes() {
  const [y, m, d] = hojeSP().split('-').map(Number), fim = new Date(Date.UTC(y, m, 0)).getUTCDate(); let tot = 0, pass = 0;
  for (let i = 1; i <= fim; i++) { const w = new Date(Date.UTC(y, m - 1, i)).getUTCDay(); if (w > 0 && w < 6) { tot++; if (i < d) pass++; } }
  return { tot, pass };
}
export async function respCarteira(B, E) {
  const x = await totaisOficiais(B, E); if (!x.meta) return 'Sem dado agora.';
  const soma = x.fat + x.pend, falta = Math.max(0, x.meta - soma);
  const G = [...agrupa(E.vend, (v) => (E.nacional ? v.filial : supChave(v, false)))].filter(([k]) => E.nacional || supReal(k)).map(([k, y]) => [k, y, y.meta ? (y.fat + y.pend) / y.meta * 100 : null]).sort((a, b) => (b[2] ?? -1) - (a[2] ?? -1));
  return [`💼 *Faturado + carteira — ${E.nome}*`, `Faturado: *${R$(x.fat)}* · carteira (pendente): *${R$(x.pend)}*`, `Projeção do que já está na mão: *${R$(soma)}* de ${R$(x.meta)} → *${P(soma, x.meta)}*`, `Falta além da carteira: *${R$(falta)}* (${P(falta, x.meta)} da meta)`, '',
    `*Ranking por (faturado + carteira) ÷ meta — ${E.nacional ? 'filiais' : 'supervisores'}:*`, ...G.map(([k, y, p], i) => `${i + 1}. ${E.nacional ? k : nome2(k)}: ${pctTxt(p)} · fat. ${R$(y.fat)} + cart. ${R$(y.pend)} · gap ${R$(Math.max(0, y.meta - y.fat - y.pend))}`),
    '', '_"Faturado + carteira" é projeção: carteira ainda pode ser cortada ou bloqueada._'].join('\n');
}
export async function respRitmo(B, E) {
  const x = await totaisOficiais(B, E); if (!x.meta) return 'Sem dado agora.';
  const { tot, pass } = diasUteisMes(), esp = tot ? pass / tot * 100 : 0, real = x.fat / x.meta * 100;
  const tom = real >= esp ? '🟢 *No ritmo ou acima.* Golaço, mantém.' : real >= esp * 0.9 ? '🟡 *Jogo apertado*, dá para virar no segundo tempo.' : '🔴 *Abaixo do ritmo.* Precisamos reagir.';
  const G = [...agrupa(E.vend, (v) => (E.nacional ? v.filial : supChave(v, false)))].filter(([k]) => E.nacional || supReal(k)).map(([k, y]) => [k, y.meta ? y.fat / y.meta * 100 - esp : null]).sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0));
  return [`⏱️ *Ritmo da meta — ${E.nome}*`, `Dias úteis: ${pass} de ${tot} passados → o ritmo pede *${pctTxt(esp)}* da meta hoje (seg–sex, sem feriados)`, `Faturado: *${pctTxt(real)}* da meta`, tom, '',
    `*Mais atrás do ritmo (${E.nacional ? 'filiais' : 'supervisores'}):*`, ...G.slice(0, 6).map(([k, d]) => `• ${E.nacional ? k : nome2(k)}: ${d == null ? 'sem dado' : (d >= 0 ? '+' : '') + d.toFixed(1).replace('.', ',') + ' p.p.'}`)].join('\n');
}
export function respMaiorGap(E) {
  const V = E.vend.filter((v) => v.meta > 0 && pessoaReal(v)).map((v) => ({ v, gap: Math.max(0, v.meta - v.fat - v.pend) })).sort((a, b) => b.gap - a.gap).slice(0, 10);
  return [`🕳️ *Maior gap para a meta — ${E.nome}* (meta − faturado − carteira)`, ...V.map(({ v, gap }, i) => `${i + 1}. ${vn(v)} (RCA ${v.rca}${E.nacional ? ', ' + v.filial : ''}) — falta *${R$(gap)}* · ${pctTxt(v.pct)} · setor/sup. ${nome2(v.supervisor)}`), '', SUGESTAO + `sentar com ${nome2(V[0] && V[0].v.supervisor)} sobre ${nome2(V[0] && V[0].v.nome)} hoje.`].join('\n');
}
export function respRankingSupervisores(E) {
  const S = [...agrupa(E.vend, (v) => supChave(v, true))].filter(([k]) => supReal(k) && !/^VAGO/.test(k)).filter(([, x]) => x.meta > 0).sort((a, b) => (b[1].pct ?? -1) - (a[1].pct ?? -1));
  return [`👥 *Ranking dos supervisores — ${E.nome}* (% da meta faturada)`, '*Melhores:*', ...S.slice(0, 10).map(([k, x], i) => `${i + 1}. ${supNome(k)} — ${pctTxt(x.pct)} · ${R$(x.fat)}`), '*Mais atrás:*', ...S.slice(-8).reverse().map(([k, x]) => `• ${supNome(k)} — ${pctTxt(x.pct)} · ${x.zerados} zerado(s)`)].join('\n');
}
export function respRankingGerentes(E) {
  const G = [...agrupa(E.vend, (v) => v.filial + (v.grupo ? ' · ' + titulo(v.grupo) : ''))].filter(([, x]) => x.meta > 0).sort((a, b) => (b[1].pct ?? -1) - (a[1].pct ?? -1));
  return [`🧑‍💼 *Ranking dos gerentes* (% da meta faturada; TPH e MCD por gerente)`, ...G.map(([k, x], i) => `${i + 1}. ${k}${x.V[0] && x.V[0].gerente && !k.includes('·') ? ' — ' + titulo(x.V[0].gerente) : ''}: ${pctTxt(x.pct)} · ${R$(x.fat)} · pend. ${R$(x.pend)}`)].join('\n');
}
export async function respComparar(B, fs) {
  const s = await B.saude(); const F = ((s && s.filiais) || []).filter((f) => fs.includes(f.filial));
  if (F.length < 2) return null;
  const lin = (r, fn) => `${r}: ` + F.map((f) => `*${f.filial}* ${fn(f)}`).join(' × ');
  return [`⚖️ *${fs.join(' × ')}* (${s.hora_sp})`, lin('Faturado', (f) => `${P(f.faturado || 0, f.meta_fat)} (${R$(f.faturado)})`), lin('Pendente', (f) => R$(f.pendente)), lin('Positivação', (f) => `${P(f.positivados, f.meta_pos)} (${N(f.positivados)})`), lin('Digitado hoje', (f) => R$(f.digitado_hoje))].join('\n');
}
export async function respPontosPerdidos(B, E) {
  const lc = await B.lances(); if (!lc) return 'Não consegui ler os lances agora.';
  const rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const L = (lc.lances || []).filter((l) => E.filiais.includes(l.filial) && (!(E.grupo || E.supervisor || E.rca) || rcas.has(l.filial + '|' + l.rca)) && (l.pontos || 0) < 0);
  const G = {}; for (const l of L) { const k = l.pontos_nome || l.nivel; G[k] = G[k] || { n: 0, p: 0 }; G[k].n++; G[k].p += l.pontos; }
  const tot = L.reduce((a, l) => a + l.pontos, 0);
  return [`🚨 *Pontos perdidos hoje na Liga — ${E.nome}*: *${tot} pontos* em ${L.length} lance(s)`, ...Object.entries(G).sort((a, b) => a[1].p - b[1].p).map(([k, x]) => `• ${k}: ${x.n}× = ${x.p} pts`), '', '_Peça "pênaltis" ou "impedimentos" para ver quem e por quê._'].join('\n');
}
export function respMetaBatida(E) {
  const V = E.vend.filter((v) => v.meta > 0 && pessoaReal(v));
  const fat = V.filter((v) => v.fat >= v.meta).sort((a, b) => b.pct - a.pct), proj = V.filter((v) => v.fat < v.meta && v.fat + v.pend >= v.meta);
  return [`🏁 *Meta batida — ${E.nome}*`, `No faturado: *${fat.length} de ${V.length}* vendedores` + (fat.length ? ' — ' + fat.slice(0, 12).map((v) => `${vn(v)} ${pctTxt(v.pct)}`).join(', ') : ''), `Batem com a carteira (fat. + pend.): ${proj.length}` + (proj.length ? ' — ' + proj.slice(0, 10).map((v) => vn(v)).join(', ') : '')].join('\n');
}
export async function respDobradinha(B, E) {
  const mx = await B.mix(); if (!mx) return 'Não consegui ler o +MIX agora.';
  const rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const V = (mx.vendedores || []).filter((x) => E.filiais.includes(x.filial) && (!(E.grupo || E.supervisor || E.rca) || rcas.has(x.filial + '|' + x.rca)) && x.dobradinha_pct != null).sort((a, b) => b.dobradinha_pct - a.dobradinha_pct);
  if (!V.length) return 'Sem dado de dobradinha agora.';
  const f = (v) => `${vn(v)}${E.nacional ? ' ' + v.filial : ''}: ${String(v.dobradinha_pct).replace('.', ',')}%`;
  return [`🔁 *Dobradinha das quinzenas — ${E.nome}* (% dos clientes do mês que compraram nas duas quinzenas; +MIX, até ${mx.dados_ate || 'ontem'})`, '*Mais dobradinha:*', ...V.slice(0, 8).map((v) => '• ' + f(v)), '*Menos:*', ...V.slice(-5).reverse().map((v) => '• ' + f(v)), '', SUGESTAO + 'quem compra só numa quinzena é o primeiro da rota na segunda.'].join('\n');
}
export const SEM_HISTORICO = 'Esse eu ainda não tenho: precisa do *histórico diário* por vendedor (uma foto do dia guardada todo fim de tarde), que ainda não guardamos. Com ele eu respondo "dias seguidos sem pedido" e a comparação com o mesmo período do mês passado. Já está na lista da reunião de metas.';
export async function respInfoEquipe(env, c, texto) {
  try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS bot_avisos_equipe (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT DEFAULT CURRENT_TIMESTAMP, celular TEXT, quem TEXT, filial TEXT, texto TEXT, situacao TEXT DEFAULT \'novo\')').run();
    await env.DB.prepare('INSERT INTO bot_avisos_equipe (celular, quem, filial, texto) VALUES (?,?,?,?)').bind(c.celular || '', c.nome || '', c.filial || '', String(texto).slice(0, 500)).run(); } catch (e) { return 'Não consegui anotar agora. Me manda de novo em instantes.'; }
  return `📝 Anotado, ${titulo(String(c.nome || '').split(' ')[0])}. Mandei para a *Gestão de Equipe* decidir (ex.: tirar da cobrança, desconsiderar da leitura). Enquanto não for decidido lá, eu continuo mostrando a pessoa normalmente.`;
}
