// =========================================================================
// JOTA · functions/_lib/jota/respostas/indicadores.js
// O QUE É: recorrência, incentivo, Liga AS, semana, devoluções, Bola Cheia, divergências.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import R from '../../../../public/regras.js'; // regras unicas (public/regras.js)
import { FILIAIS, N, P, R$, SUGESTAO, nome2, sem, titulo, vn } from '../base.js';
import { pctTxt } from '../escopo.js';
import { respIncentivo } from './liga_mix.js';

// ---------- indicadores das outras telas (TV Executiva, /incentivo, Liga AS, Supervisores, Devolucoes, Bola Cheia, Divergencias) ----------
export async function respRecorrencia(B, E) {
  const x = await B.exec(); if (!x || !x.recorrencia) return 'Não consegui ler a recorrência agora.';
  const k = E.nacional ? 'TODAS' : E.filiais[0]; const r = x.recorrencia[k] || {}, s = (x.resumo || {})[k] || {};
  if (r.naRota == null) return `⭐ *Recorrência e resgates — ${E.nacional ? 'Brasil' : k}*: sem dado hoje. Esse número vinha da TV Executiva, desligada em 25/10/2026 (custo da Cloudflare).`;
  const L = [`⭐ *Recorrência e resgates — ${E.nacional ? 'Brasil' : k}* (hoje)`, `Clientes com tag RECORRÊNCIA na rota: *${N(r.naRota)}* · positivados: *${N(r.positivados)}* (${P(r.positivados || 0, r.naRota)})`, `Resgatados hoje (parados >30 dias que compraram): *${N(s.resgatadosHoje)}*`];
  if (E.nacional) for (const f of FILIAIS) { const a = x.recorrencia[f] || {}; L.push(`• ${f}: ${N(a.positivados)}/${N(a.naRota)} recorrência · ${N((x.resumo[f] || {}).resgatadosHoje)} resgate(s)`); }
  if (E.grupo) L.push('_Visão da filial inteira (a TV Executiva não separa por gerente)._');
  L.push('', r.naRota ? SUGESTAO + `cada cliente da recorrência positivado é DEFESA (+3) na Liga: cobrar os ${N(Math.max(0, r.naRota - (r.positivados || 0)))} que faltam.` : '_Sem rota com recorrência hoje._');
  return L.join('\n');
}
export async function respIncentivoOficial(B, E, pessoa) {
  const x = await B.incentivo(); if (!x || !x.nacional) return respIncentivo(E);
  const ok = (b) => b ? '✅' : '❌';
  if (pessoa && pessoa.tipo === 'vend') { const v = (x.vendedores || []).find((y) => y.rca === pessoa.alvo.rca && y.filial === pessoa.alvo.filial); if (v) return `🏆 *Incentivo — ${titulo(v.nome)}* (${v.filial})\nPositivação: *${v.real} de ${v.meta}* (${pctTxt(v.pct)})\nGatilho 1 (60% até 15/10, R$ 150): ${ok(v.g1)}${v.falta_g1 ? ' faltam ' + v.falta_g1 : ''}\nGatilho 2 (110% em 31/10, R$ 350): ${ok(v.g2)}${v.falta_g2 ? ' faltam ' + v.falta_g2 + ' clientes' : ''}\n_Régua de positivação da apuração oficial; o G2 também exige 110% do faturado._`; }
  if (pessoa && pessoa.tipo === 'sup') { const s = (x.supervisores || []).find((y) => y.nome === pessoa.alvo.nome && y.filial === pessoa.alvo.filial); if (s) return `🏆 *Incentivo — ${titulo(s.nome)}* (${s.filial}): ${s.real} de ${s.meta} positivações (${pctTxt(s.pct)}) ${ok(s.ok)}${s.falta ? ' · faltam ' + s.falta + ' para 110%' : ''} · R$ 300 se a equipe fizer 110%.`; }
  const p = x.premio_se_fechasse_hoje || {};
  const L = [`🏆 *Incentivo Outubro — ${E.nome}* (dados ${String(x.atualizado_em || '').slice(11, 16)})`];
  if (E.nacional) {
    L.push(`Positivação nacional: *${N(x.nacional.real)}* · meta do regulamento ${N(x.nacional.meta_regulamento)} (${pctTxt(x.nacional.pct_regulamento)}) · superação ${N(x.nacional.meta_superacao)} (${pctTxt(x.nacional.pct_superacao)})`,
      `💰 Se fechasse hoje: G1 ${R$(p.g1)} · G2 ${R$(p.g2)} · supervisores ${R$(p.sup)} · gerentes ${R$(p.ger)} → *${R$(p.total)}*`, '*Filiais (positivação vs alvo 110%):*');
    for (const f of (x.filiais || []).slice().sort((a, b) => b.pct_coluna_n - a.pct_coluna_n)) L.push(`• ${f.filial}: ${N(f.real)} de ${N(f.coluna_n)} (${pctTxt(f.pct_coluna_n)}) ${ok(f.ok)} · faltam ${N(f.falta)} p/ 110%`);
  } else {
    const f = (x.filiais || []).find((y) => y.filial === E.filiais[0]);
    if (f) { L.push(`Filial (meta do regulamento): ${N(f.real)} de ${N(f.coluna_n)} (${pctTxt(f.pct_coluna_n)}) ${ok(f.ok)} · faltam ${N(f.falta)} p/ 110% (${N(f.alvo110_coluna_n)})`); for (const g of f.gerentes || []) if (!E.grupo || sem(g.grupo) === sem(E.grupo)) L.push(`• Gerência ${g.gerente} (meta das pastas): ${N(g.real)} de ${N(g.meta)} (${pctTxt(g.pct)}) ${ok(g.ok)}`); }
    const S = (x.supervisores || []).filter((s) => s.filial === E.filiais[0] && (!(E.grupo || E.supervisor || E.rca) || E.vend.some((v) => v.supervisor === s.nome))).sort((a, b) => b.pct - a.pct);
    L.push('*Supervisores (R$ 300 com 110%):*', ...S.map((s) => `• ${nome2(s.nome)}: ${s.real}/${s.meta} (${pctTxt(s.pct)}) ${ok(s.ok)}${s.falta ? ' · faltam ' + s.falta : ''}`));
    const V = (x.vendedores || []).filter((v) => v.filial === E.filiais[0] && (!E.grupo || sem(v.grupo) === sem(E.grupo)) && (!E.supervisor || sem(v.supervisor) === sem(E.supervisor)));
    L.push(`Vendedores: G1 ✅ ${V.filter((v) => v.g1).length} de ${V.length} · G2 ✅ ${V.filter((v) => v.g2).length}`);
    const perto = V.filter((v) => !v.g2 && v.falta_g2 > 0 && v.falta_g2 <= 5).sort((a, b) => a.falta_g2 - b.falta_g2);
    if (perto.length) L.push(`Perto do G2 (≤5 clientes): ${perto.slice(0, 8).map((v) => `${vn(v)} (${v.falta_g2})`).join(', ')}`);
  }
  L.push('', SUGESTAO + 'focar quem está a poucos clientes do 110%: é prêmio garantido com pouco esforço.', '_Painel completo: ceven-cftv-matrix.pages.dev/incentivo_');
  return L.join('\n');
}
export async function respLigaAs(B, E, pessoa) {
  const x = await B.ligaAs(); if (!x || !x.vendedores) return 'Não consegui ler a Liga AS agora.';
  if (pessoa && pessoa.tipo === 'vend') { const v = x.vendedores.find((y) => y.rca === pessoa.alvo.rca && y.filial === pessoa.alvo.filial); if (v) return `🏆 *Liga AS — ${titulo(v.nome)}* (${v.filial}): *${v.pontos} pontos* · ${pctTxt(v.pct_hoje)} da meta (faturado + pendente) · fases: ${(v.fases || []).map((f) => `F${f.n} ${f.status === 'batida' ? '✅' : f.status === 'futuro' ? '⏳' : '❌'}`).join(' ')} · bônus: ${(v.bonus || []).map((b) => `${b.nome} ${b.status === 'batido' ? '✅' : b.status === 'perdido' ? '❌' : '⏳'}`).join(' · ')}`; }
  const V = x.vendedores.filter((v) => E.filiais.includes(v.filial)).sort((a, b) => b.pontos - a.pontos || b.pct_hoje - a.pct_hoje);
  const S = (x.supervisores || []).filter((v) => E.filiais.includes(v.filial)).sort((a, b) => b.pontos - a.pontos);
  return [`🏆 *Liga AS — ${E.nome}* (${x.mes})`, `_${(x.regras && x.regras.base) || ''}_`, '*Vendedores AS:*', ...V.slice(0, 10).map((v, i) => `${i + 1}. ${vn(v)}${E.nacional ? ' ' + v.filial : ''} — ${v.pontos} pts · ${pctTxt(v.pct_hoje)}`), '*Supervisores:*', ...S.slice(0, 6).map((s, i) => `${i + 1}. ${nome2(s.supervisor)}${E.nacional ? ' ' + s.filial : ''} — ${s.pontos} pts · ${pctTxt(s.pct_hoje)}`), '', '_ceven-cftv-matrix.pages.dev/liga-as_'].join('\n');
}
export async function respSemana(B, E) {
  const R = await Promise.all(E.filiais.map((f) => B.semana(f).then((j) => ({ f, S: j && j.filiais && j.filiais[f] }))));
  const sups = new Set(E.vend.map((v) => v.filial + '|' + v.supervisor));
  const all = R.flatMap(({ f, S }) => (S || []).filter((s) => !/^GERENTE/i.test(s.nome) && (!(E.grupo || E.supervisor || E.rca) || sups.has(f + '|' + s.nome))).map((s) => ({ ...s, filial: f })));
  if (!all.length) return 'Não consegui ler a semana dos supervisores agora.';
  const pass = (s) => (s.dias || []).filter((d) => d.estado !== 'futuro');
  const L = [`🗓️ *Semana dos supervisores — ${E.nome}* (compromisso / RET por dia útil até hoje)`];
  const rank = all.map((s) => ({ s, c: pass(s).filter((d) => d.comp).length, r: pass(s).filter((d) => d.ret).length, n: pass(s).length })).sort((a, b) => (a.c + a.r) - (b.c + b.r));
  for (const { s, c, r, n } of rank.slice(0, E.nacional ? 20 : 30)) L.push(`• ${nome2(s.nome)}${E.nacional ? ' ' + s.filial : ''}: compromisso ${c}/${n} · RET ${r}/${n}`);
  if (E.nacional && rank.length > 20) L.push(`… (${rank.length} supervisores; mostrando os 20 com menos dias)`);
  L.push('', SUGESTAO + `${nome2(rank[0].s.nome)} é quem menos fez na semana.`);
  return L.join('\n');
}
export async function respDevMotivos(B) {
  const x = await B.devMot(); if (!x) return null;
  const M = Object.entries(x.notas_por_motivo || {}).sort((a, b) => b[1] - a[1]);
  return [`↩️ *Devoluções por motivo — Brasil (${x.mes})*: ${N(x.notas_com_valor)} notas · ${R$(x.valor_total_devolvido)}`, ...M.slice(0, 10).map(([m, n]) => `• ${titulo(m)}: ${n} notas`), `Notas por filial: ${Object.entries(x.notas_por_filial || {}).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(' · ')}`, '_"Cliente não pediu" = cartão vermelho (−10); motivo comercial = gol contra (−4)._'].join('\n');
}
export async function respBola(B, E) {
  const R = await Promise.all(E.filiais.map((f) => B.bola(f).then((j) => ({ f, j }))));
  const L = ['⚽ *Bola Cheia do dia*'];
  for (const { f, j } of R) { if (!j) continue; if (j.pendente) { L.push(`• ${f}: ${j.motivo}`); if (E.nacional) break; continue; } L.push(`• ${f}: ${(j.vencedores || []).map((v) => nome2(v.nome || v.vendedor)).join(', ') || 'sem vencedor'}`); }
  return L.join('\n');
}
export async function respDivergencias(B) {
  const x = await B.diverg(); if (!x || !x.resumo) return 'Não consegui ler as divergências agora.';
  const r = x.resumo;
  return [`🔎 *Divergências com o CEVEN*`, `No CEVEN e fora da Gestão de Equipe: *${r.banco_fora_da_planilha}* (${r.banco_fora_da_planilha_com_movimento} com movimento hoje, ${R$(r.faturado_mes_fora_da_planilha)} faturado no mês)`, `Na Gestão e sem dado no CEVEN: ${r.planilha_fora_do_banco}`, `Códigos descobertos: ${r.codigos_descobertos} (${r.codigos_descobertos_novos} novos) · devolução descoberta no mês ${R$(r.devolucao_descoberta_mes)}`,
    '', SUGESTAO + 'decidir na Gestão de Equipe (painel "Divergências com o CEVEN").', '_ceven-cftv-matrix.pages.dev/gestao-equipe_'].join('\n');
}
