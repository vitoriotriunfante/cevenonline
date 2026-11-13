// =========================================================================
// JOTA · functions/_lib/jota/respostas/gestao.js
// O QUE É: carteira, ritmo, gaps, rankings, comparações, dobradinha, aviso de equipe.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { N, P, R$, SUGESTAO, hojeSP, nome2, sem, titulo, vn } from '../base.js';
import { agrupa, carregaEscopo, pctTxt, pessoaReal, sn, supChave, supNome, supReal } from '../escopo.js';
import { totaisOficiais } from './resumo.js';
import { ehFeriado } from '../../feriados.js';

// ---------- PERGUNTAS DA REUNIAO DE 5 H (25/10/2026) que o dado do site ja responde ----------
export function diasUteisMes() {
  const [y, m, d] = hojeSP().split('-').map(Number), fim = new Date(Date.UTC(y, m, 0)).getUTCDate(); let tot = 0, pass = 0;
  for (let i = 1; i <= fim; i++) { const w = new Date(Date.UTC(y, m - 1, i)).getUTCDay(); if (w > 0 && w < 6 && !ehFeriado(`${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`)) { tot++; if (i < d) pass++; }   /* feriado nao e dia util (12/10) */ }
  return { tot, pass };
}
export async function respCarteira(B, E) {
  const x = await totaisOficiais(B, E); if (!x.meta) return 'Sem dado agora.';
  const soma = x.fat + x.pend, falta = Math.max(0, x.meta - soma);
  const out = [
    `💼 *Faturado + Pedidos Pendentes — ${E.nome}*`,
    `💰 Faturado oficial: *${R$(x.fat)}* de ${R$(x.meta)} (${P(x.fat, x.meta)})`,
    `⏳ Carteira liberada (pendente de faturamento): *${R$(x.pend)}*`,
    `📦 Projeção total na mão: *${R$(soma)}* (${P(soma, x.meta)} da meta)`,
    `🎯 Falta para a meta: *${R$(falta)}*`
  ];
  if (E.vend && E.vend.length > 1 && !E.nacional) {
    const porVend = E.vend.filter((v) => pessoaReal(v)).map((v) => ({
      v,
      fat: v.fat || 0,
      pend: v.pend || 0,
      soma: (v.fat || 0) + (v.pend || 0),
      meta: v.meta || 0,
      pct: v.meta ? ((v.fat || 0) + (v.pend || 0)) / v.meta * 100 : 0
    })).sort((a, b) => b.soma - a.soma);
    out.push('', `*Aberto por vendedor (Faturado + Carteira pendente):*`);
    out.push(...porVend.map((item, i) => `${i + 1}. *${vn(item.v)}*: faturado ${R$(item.fat)} + pendente ${R$(item.pend)} = *${R$(item.soma)}* (${pctTxt(item.pct)})`));
  } else {
    const G = [...agrupa(E.vend, (v) => (E.nacional ? v.filial : supChave(v, false)))].filter(([k]) => E.nacional || supReal(k)).map(([k, y]) => [k, y, y.meta ? (y.fat + y.pend) / y.meta * 100 : null]).sort((a, b) => (b[2] ?? -1) - (a[2] ?? -1));
    out.push('', `*Ranking por (faturado + carteira) ÷ meta — ${E.nacional ? 'filiais' : 'supervisores'}:*`);
    out.push(...G.map(([k, y, p], i) => `${i + 1}. ${E.nacional ? k : nome2(k)}: ${pctTxt(p)} · fat. ${R$(y.fat)} + cart. ${R$(y.pend)} · gap ${R$(Math.max(0, y.meta - y.fat - y.pend))}`));
  }
  out.push('', '_"Faturado + carteira" são pedidos liberados; pedidos bloqueados/crédito aguardam liberação financeira._');
  return out.join('\n');
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
  return [`🕳️ *Maior gap para a meta — ${E.nome}* (meta − faturado − carteira)`, ...V.map(({ v, gap }, i) => `${i + 1}. ${vn(v)}${E.nacional ? ' (' + v.filial + ')' : ''} — falta *${R$(gap)}* · ${pctTxt(v.pct)} · setor/sup. ${sn(v.supervisor, v.supCod)}`), '', SUGESTAO + `sentar com ${sn(V[0] && V[0].v.supervisor, V[0].v.supCod)} sobre ${nome2(V[0] && V[0].v.nome)} hoje.`].join('\n');
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
  const esc = await carregaEscopo(B, { nome: fs.join(' × '), filiais: fs });
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const gFil = new Map();
  if (B && B.env && B.env.DB) {
    try {
      const mes = hojeSP().slice(0, 7);
      const { results } = await B.env.DB.prepare("SELECT filial, coalesce(json_extract(dados,'$.\"Positivação (filial + CNPJ)\"'), json_extract(dados,'$.\"Positivação (filial)\"')) pos, coalesce(json_extract(dados,'$.\"Meta de positivação\"'), json_extract(dados,'$.\"Meta clientes\"')) meta_pos FROM gerot_filial_mes WHERE mes = ?").bind(mes).all();
      for (const r of results || []) if (r.pos != null) gFil.set(r.filial, { pos: Number(r.pos) || 0, metaPos: r.meta_pos != null ? Number(r.meta_pos) || 0 : null });
    } catch { /* segue com soma */ }
  }
  const F = fs.map((sigla) => {
    const p = esc.porFilial && esc.porFilial[sigla];
    const vs = p ? (p.vend || []).concat(p.ocultos || []) : [];
    const g = agrupa(vs, () => 'x').get('x') || { fat: 0, pend: 0, meta: 0, pos: 0, metaPos: 0, dig: 0 };
    const gf = gFil.get(sigla);
    return { filial: sigla, faturado: g.fat, pendente: g.pend, meta_fat: g.meta, positivados: gf ? gf.pos : g.pos, meta_pos: gf && gf.metaPos != null ? gf.metaPos : g.metaPos, digitado_hoje: (p && p.macro && p.macro.dig) || g.dig };
  }).filter((f) => f.meta_fat > 0 || f.faturado > 0 || f.digitado_hoje > 0);
  if (F.length < 2) return null;
  const lin = (r, fn) => `${r}: ` + F.map((f) => `*${f.filial}* ${fn(f)}`).join(' × ');
  return [`⚖️ *${fs.join(' × ')}* (${hora})`, lin('Faturado', (f) => `${P(f.faturado || 0, f.meta_fat)} (${R$(f.faturado)})`), lin('Pendente', (f) => R$(f.pendente)), lin('Positivação', (f) => `${P(f.positivados, f.meta_pos)} (${N(f.positivados)})`), lin('Digitado hoje', (f) => R$(f.digitado_hoje))].join('\n');
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

// TENDENCIA DE FECHAMENTO (Vitorio, 26/10/2026: "pq vc nao pode fazer uma projecao? se vc tem o faturado + pendente... sabe quantos dias faltam... e matematica
// pura... so deixa claro que isso e tendencia... e da para atualizar diario"). Conta: ritmo = (faturado + pendente) / dias uteis decorridos (hoje conta);
// tendencia = ritmo x dias uteis do mes. Necessario = (meta - faturado - pendente) / dias uteis que faltam. Seg-sex, sem descontar feriado. Sempre rotulado TENDENCIA.
export async function respTendencia(B, E) {
  let x = null, G = null, fonteTxt = '_Dias úteis seg–sex, sem feriados; atualiza a cada consulta com o faturado + pendente de agora._';
  const { tot, pass } = diasUteisMes(), dec = Math.min(tot, pass + 1), falt = Math.max(0, tot - dec);
  const tend = (y) => { const s = (y.fat || 0) + (y.pend || 0); const t = dec ? s / dec * tot : s; return { s, t, pct: y.meta ? t / y.meta * 100 : null, nec: falt ? Math.max(0, y.meta - s) / falt : 0, rit: dec ? s / dec : s }; };
  if (B && B.env && B.env.DB) {
    try {
      const mes = hojeSP().slice(0, 7), db = B.env.DB;
      const ler = (s) => { try { const d = JSON.parse(s || '{}'); return { meta: Number(d['Meta (R$)']) || 0, fat: Number(d['Faturado líquido (R$)']) || 0, pend: Number(d['Carteira pendente (R$)']) || 0 }; } catch { return { meta: 0, fat: 0, pend: 0 }; } };
      const somaG = (arr) => arr.reduce((a, b) => ({ meta: a.meta + b.meta, fat: a.fat + b.fat, pend: a.pend + b.pend }), { meta: 0, fat: 0, pend: 0 });
      const st = await db.prepare('SELECT posicao FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first().catch(() => null);
      const pos = st && st.posicao ? ` (${st.posicao.replace(/^Atual\s*·\s*/, 'posição ')})` : '';
      if (E.nacional) {
        const { results } = await db.prepare('SELECT filial, dados FROM gerot_filial_mes WHERE mes = ?').bind(mes).all();
        if (results && results.length) {
          const rows = results.map((r) => [r.filial, ler(r.dados)]).filter(([, y]) => y.meta > 0);
          x = somaG(rows.map(([, y]) => y));
          G = rows.map(([k, y]) => [k, y, tend(y)]).sort((a, b) => (a[2].pct ?? 0) - (b[2].pct ?? 0));
        }
      } else if (!E.supervisor && !E.rca && E.filiais && E.filiais.length === 1) {
        const fil = E.filiais[0];
        const fRow = await db.prepare('SELECT dados FROM gerot_filial_mes WHERE mes = ? AND filial = ?').bind(mes, fil).first();
        const { results: sRows } = await db.prepare('SELECT cod_sup, supervisor, dados FROM gerot_supervisor_mes WHERE mes = ? AND filial = ?').bind(mes, fil).all();
        if (fRow) {
          x = ler(fRow.dados);
          G = (sRows || []).map((r) => [titulo(r.supervisor || r.cod_sup), ler(r.dados)]).filter(([, y]) => y.meta > 0).map(([k, y]) => [k, y, tend(y)]).sort((a, b) => (a[2].pct ?? 0) - (b[2].pct ?? 0));
        }
      } else if (E.supervisor && E.filiais && E.filiais.length) {
        const { results: vRows } = await db.prepare('SELECT rca, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ? AND filial = ?').bind(mes, E.filiais[0]).all();
        const alvoSup = sem(E.supervisor);
        const meus = (vRows || []).filter((r) => sem(r.supervisor || '').includes(alvoSup) || alvoSup.includes(sem(r.supervisor || '')));
        if (meus.length) {
          const rows = meus.map((r) => [`${r.rca} - ${titulo(r.vendedor || '')}`, ler(r.dados)]);
          x = somaG(rows.map(([, y]) => y));
          G = rows.filter(([, y]) => y.meta > 0).map(([k, y]) => [k, y, tend(y)]).sort((a, b) => (a[2].pct ?? 0) - (b[2].pct ?? 0));
        }
      } else if (E.rca && E.filiais && E.filiais.length) {
        const { results: vRows } = await db.prepare('SELECT rca, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ? AND filial = ? AND rca = ?').bind(mes, E.filiais[0], String(E.rca)).all();
        if (vRows && vRows.length) { x = somaG(vRows.map((r) => ler(r.dados))); G = []; }
      }
      if (x && x.meta > 0) fonteTxt = `_Fonte: GEROT${pos} · dias úteis seg–sex (sem feriados); tendência = ritmo × ${tot} dias úteis._`;
    } catch { /* fallback totaisOficiais */ }
  }
  if (!x || !x.meta) {
    x = await totaisOficiais(B, E); if (!x.meta) return 'Sem dado agora.';
    G = [...agrupa(E.vend, (v) => (E.nacional ? v.filial : E.supervisor ? v.filial + '|' + v.rca : supChave(v, false)))].filter(([k]) => E.nacional || E.supervisor || supReal(k))
      .map(([k, y]) => [k, y, tend(y)]).filter(([, y]) => y.meta > 0).sort((a, b) => (a[2].pct ?? 0) - (b[2].pct ?? 0));
  }
  const T = tend(x);
  const nome = (k) => (fonteTxt.startsWith('_Fonte: GEROT') ? k : (E.nacional ? k : E.supervisor ? vn(E.vend.find((v) => v.filial + '|' + v.rca === k) || { nome: k }) : supNome(k)));
  return [`📈 *TENDÊNCIA de fechamento — ${E.nome}* _(conta, não é número real: mantém o ritmo de hoje até o fim do mês)_`,
    `💰 Faturado + carteira: *${R$(T.s)}* em ${dec} de ${tot} dias úteis → ritmo de *${R$(T.rit)}/dia*`,
    `📈 Se mantiver esse ritmo: fecha em *${R$(T.t)}* = *${P(T.t, x.meta)}* da meta (${R$(x.meta)})`,
    falt ? `🎯 Para bater a meta: precisa de *${R$(T.nec)}/dia* nos ${falt} dias úteis que faltam (${T.rit ? (T.nec / T.rit).toFixed(1).replace('.', ',') + 'x o ritmo atual' : 'sem ritmo'})` : '🏁 Último dia útil do mês.',
    ...(G && G.length ? ['', `*Tendência por ${E.nacional ? 'filial' : E.supervisor ? 'vendedor' : 'supervisor'} (do pior para o melhor):*`,
      ...G.slice(0, 12).map(([k, , r]) => `• ${nome(k)}: ${r.pct == null ? 'sem meta' : r.pct.toFixed(1).replace('.', ',') + '%'} · precisa ${R$(r.nec)}/dia`)] : []),
    '', fonteTxt,
    SUGESTAO + (G && G[0] ? `atacar ${nome(G[0][0])}, a pior tendência.` : 'manter o ritmo.')].join('\n');
}

export async function respMaiorAtrasoMeta(B, E) {
  if (!B || !B.env || !B.env.DB) return null;
  const mes = hojeSP().slice(0, 7), { tot, pass } = diasUteisMes(), dec = Math.min(tot, pass + 1), falt = Math.max(1, tot - dec);
  const fil = (E.filiais || []).length ? E.filiais : ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
  const qs = fil.map(() => '?').join(',');
  const { results } = await B.env.DB.prepare(`SELECT filial, rca, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...fil).all().catch(() => ({ results: [] }));
  let rows = (results || []).map((r) => {
    let d = {}; try { d = JSON.parse(r.dados || '{}'); } catch {}
    const meta = Number(d['Meta (R$)']) || 0, fat = Number(d['Faturado líquido (R$)']) || 0, pend = Number(d['Carteira pendente (R$)']) || 0, vend = fat + pend;
    return { filial: r.filial, rca: r.rca, sup: r.supervisor || '', nome: r.vendedor || '', meta, vend, pct: meta > 0 ? (vend / meta) * 100 : null, falta: Math.max(0, meta - vend) };
  }).filter((x) => x.meta > 0 && x.falta > 0);
  if (E.supervisor) {
    const sAlvo = sem(E.supervisor);
    rows = rows.filter((x) => sem(x.sup).includes(sAlvo) || sAlvo.includes(sem(x.sup)));
  }
  if (!rows.length) return `Não há vendedores com meta em aberto no GEROT para ${E.nome}.`;
  rows.sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0) || b.falta - a.falta);
  return [
    `🐢 *Vendedores com maior atraso para a meta — ${E.nome}*`,
    `_Critério: menor % vendido (faturado + carteira) no GEROT · ${falt} dia(s) útil(eis) restante(s)_`,
    '',
    ...rows.slice(0, 12).map((x, i) => `${i + 1}. *${x.rca} - ${titulo(x.nome)}*${E.nacional ? ' (' + x.filial + ')' : ''}: *${x.pct.toFixed(1).replace('.', ',')}%* (${R$(x.vend)} de ${R$(x.meta)}) · falta ${R$(x.falta)} (${R$(x.falta / falt)}/d)`),
    '',
    SUGESTAO + `cobrar plano de ação imediato de *${titulo(rows[0].nome)}* (${rows[0].pct.toFixed(1).replace('.', ',')}%).`
  ].join('\n');
}

export async function respBloqueioComercial(B, E) {
  if (!B || !B.env || !B.env.DB) return null;
  const fil = (E.filiais || []).length ? E.filiais : ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
  const qs = fil.map(() => '?').join(',');
  let sql = `SELECT filial, rca, num, id_cliente, data_pedido, valor, status FROM pedido_status WHERE filial IN (${qs}) AND data_pedido >= date('now', '-3 hours', '-7 days') AND status LIKE '%BLOQUEAD%'`;
  const bind = [...fil];
  if (E.rca) { sql += ' AND rca = ?'; bind.push(String(E.rca)); }
  else if (E.supervisor && E.vend && E.vend.length) {
    const rcas = E.vend.map((v) => String(v.rca)).filter(Boolean);
    if (rcas.length) { sql += ` AND rca IN (${rcas.map(() => '?').join(',')})`; bind.push(...rcas); }
  }
  sql += ' ORDER BY valor DESC LIMIT 200';
  const { results } = await B.env.DB.prepare(sql).bind(...bind).all().catch(() => ({ results: [] }));
  if (!results || !results.length) return `✅ *Bloqueios — ${E.nome}*: nenhum pedido bloqueado nos últimos 7 dias na base.`;
  const tot = results.reduce((a, p) => a + (Number(p.valor) || 0), 0);
  const nomeV = (f, r) => { const v = (E.vend || []).find((x) => x.filial === f && String(x.rca) === String(r)); return v ? `${r} - ${titulo(v.nome)}` : `RCA ${r}`; };
  return [
    `🚫 *Pedidos bloqueados (últimos 7 dias) — ${E.nome}*`,
    `Total: *${N(results.length)} pedido(s)* · *${R$(tot)}*`,
    '',
    ...results.slice(0, 12).map((p) => `• Ped. *${p.num}* · ${nomeV(p.filial, p.rca)} · cli. #${p.id_cliente} · *${R$(p.valor || 0)}* (${String(p.data_pedido).slice(8, 10)}/${String(p.data_pedido).slice(5, 7)})`),
    ...(results.length > 12 ? [`_… e mais ${results.length - 12} pedido(s) bloqueado(s)._`] : []),
    '',
    SUGESTAO + 'priorizar o destrave dos pedidos de maior valor com o financeiro/comercial.'
  ].join('\n');
}

export async function respFaseamentoSemana(B, E, t) {
  const mSem = String(t || '').match(/\b([1-4])[OA°º]?\s*SEMANA\b/);
  const hojeD = Number(hojeSP().slice(8, 10));
  const semNum = mSem ? Number(mSem[1]) : (hojeD <= 7 ? 1 : hojeD <= 14 ? 2 : hojeD <= 21 ? 3 : 4);
  const pctAlvo = Math.min(100, semNum * 25);
  let meta = 0, vend = 0;
  if (B && B.env && B.env.DB && !E.rca && !E.supervisor) {
    const mes = hojeSP().slice(0, 7), fil = (E.filiais || []).length ? E.filiais : ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
    const qs = fil.map(() => '?').join(',');
    const { results } = await B.env.DB.prepare(`SELECT dados FROM gerot_filial_mes WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...fil).all().catch(() => ({ results: [] }));
    for (const r of results || []) { try { const d = JSON.parse(r.dados || '{}'); meta += Number(d['Meta (R$)']) || 0; vend += (Number(d['Faturado líquido (R$)']) || 0) + (Number(d['Carteira pendente (R$)']) || 0); } catch {} }
  }
  if (!meta) { const x = await totaisOficiais(B, E); meta = x.meta; vend = (x.fat || 0) + (x.pend || 0); }
  if (!meta) return `Sem meta cadastrada para calcular o faseamento de ${E.nome}.`;
  const alvo = meta * (pctAlvo / 100), diff = vend - alvo;
  return [
    `📐 *Faseamento da ${semNum}ª semana — ${E.nome}*`,
    `🎯 Alvo acumulado da ${semNum}ª semana (${pctAlvo}% da meta): *${R$(alvo)}* (de ${R$(meta)})`,
    `💰 Realizado (faturado + carteira): *${R$(vend)}* (*${P(vend, meta)}* da meta)`,
    diff >= 0 ? `✅ *Acima do faseamento em ${R$(diff)}*` : `⏳ *Faltam ${R$(Math.abs(diff))}* para bater o faseamento da ${semNum}ª semana`,
    '',
    '_Nota: no AS, a regra oficial de faseamento é 60% da meta até o dia 20; aqui mostramos a referência semanal linear (25%/50%/75%/100%)._'
  ].join('\n');
}

export async function respMatinal(B, E) {
  if (!B || !B.env || !B.env.DB) return null;
  const hoje = hojeSP(), mes = hoje.slice(0, 7), { tot, pass } = diasUteisMes();
  const dec = Math.min(tot, pass + 1), falt = Math.max(1, tot - dec);
  const fil = (E.filiais || []).length ? E.filiais : ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];
  const qs = fil.map(() => '?').join(',');
  const [stGerot, vendRes, rotaRes, pedRes, prospRes] = await Promise.all([
    B.env.DB.prepare('SELECT posicao, em FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first().catch(() => null),
    B.env.DB.prepare(`SELECT filial, rca, cod_sup, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ? AND filial IN (${qs})`).bind(mes, ...fil).all().catch(() => ({ results: [] })),
    B.env.DB.prepare(`SELECT filial, rca, json FROM roteiro_dia WHERE data = ? AND filial IN (${qs})`).bind(hoje, ...fil).all().catch(() => ({ results: [] })),
    B.env.DB.prepare(`SELECT filial, rca, COUNT(*) qtd, SUM(valor) vlr FROM pedido_status WHERE filial IN (${qs}) AND data_pedido >= date('now', '-3 hours', '-7 days') AND status = 'BLOQUEADO' GROUP BY filial, rca`).bind(...fil).all().catch(() => ({ results: [] })),
    B.env.DB.prepare(`SELECT filial, rca, COUNT(*) qtd FROM prospects_mapa WHERE filial IN (${qs}) GROUP BY filial, rca`).bind(...fil).all().catch(() => ({ results: [] }))
  ]);
  const rotaMap = new Map();
  for (const r of rotaRes.results || []) {
    let n = 0; try { const p = JSON.parse(r.json || '[]'); n = Array.isArray(p) ? p.length : (Array.isArray(p.clientes) ? p.clientes.length : 0); } catch {}
    rotaMap.set(`${r.filial}|${r.rca}`, n);
  }
  const pedMap = new Map();
  for (const p of pedRes.results || []) pedMap.set(`${p.filial}|${p.rca}`, { qtd: Number(p.qtd) || 0, vlr: Number(p.vlr) || 0 });
  const prospMap = new Map();
  for (const pr of prospRes.results || []) prospMap.set(`${pr.filial}|${pr.rca}`, Number(pr.qtd) || 0);

  let rows = (vendRes.results || []).map((v) => {
    let d = {}; try { d = JSON.parse(v.dados || '{}'); } catch {}
    const meta = Number(d['Meta (R$)']) || 0, fat = Number(d['Faturado líquido (R$)']) || 0, pend = Number(d['Carteira pendente (R$)']) || 0;
    const pos = Number(d['Positivação (filial + CNPJ)']) || 0, metaPos = Number(d['Meta de positivação'] ?? d['Meta clientes']) || 0;
    const vend = fat + pend, tend = dec ? (vend / dec) * tot : vend, tendPct = meta > 0 ? (tend / meta) * 100 : 0;
    const k = `${v.filial}|${v.rca}`, ped = pedMap.get(k) || { qtd: 0, vlr: 0 };
    return {
      filial: v.filial, rca: v.rca, cod_sup: v.cod_sup, sup: v.supervisor || '', nome: v.vendedor || '',
      meta, vend, pct: meta > 0 ? (vend / meta) * 100 : 0, tend, tendPct,
      precisaDia: Math.max(0, meta - vend) / falt,
      pos, metaPos, rota: rotaMap.get(k) || 0, prospects: prospMap.get(k) || 0,
      bloqQtd: ped.qtd, bloqVlr: ped.vlr
    };
  }).filter((x) => x.meta > 0 || x.vend > 0);
  if (E.rca) rows = rows.filter((x) => String(x.rca) === String(E.rca));
  else if (E.supervisor) {
    const sAlvo = sem(typeof E.supervisor === 'object' ? (E.supervisor.nome || '') : E.supervisor);
    const toks = sAlvo.split(/\s+/).filter((w) => w.length > 2);
    rows = rows.filter((x) => {
      const sx = sem(x.sup);
      return sx.includes(sAlvo) || sAlvo.includes(sx) || (toks.length && toks.every((w) => sx.includes(w)));
    });
  }
  if (!rows.length) return `☀️ *Matinal — ${E.nome}*: sem dados no GEROT para este escopo agora.`;
  rows.sort((a, b) => a.tendPct - b.tendPct || b.meta - a.meta);

  const totMeta = rows.reduce((a, x) => a + x.meta, 0), totVend = rows.reduce((a, x) => a + x.vend, 0);
  const totTend = rows.reduce((a, x) => a + x.tend, 0), tendGeral = totMeta ? (totTend / totMeta) * 100 : 0;
  const totPos = rows.reduce((a, x) => a + x.pos, 0), totMetaPos = rows.reduce((a, x) => a + x.metaPos, 0);
  const totRota = rows.reduce((a, x) => a + x.rota, 0), totProsp = rows.reduce((a, x) => a + x.prospects, 0);
  const totBloqQtd = rows.reduce((a, x) => a + x.bloqQtd, 0), totBloqVlr = rows.reduce((a, x) => a + x.bloqVlr, 0);

  const topChart = rows.slice(0, 14);
  if (topChart.length > 1) {
    const chartCfg = {
      type: 'horizontalBar',
      data: {
        labels: topChart.map((x) => `${x.rca} ${titulo(x.nome).split(' ').slice(0, 2).join(' ')}`.slice(0, 22)),
        datasets: [{
          label: '% Tendência da Meta',
          data: topChart.map((x) => Number(x.tendPct.toFixed(1))),
          backgroundColor: topChart.map((x) => x.tendPct >= 95 ? '#22c55e' : x.tendPct >= 75 ? '#f59e0b' : '#ef4444')
        }]
      },
      options: {
        legend: { display: false },
        title: { display: true, text: `Matinal ${E.nome} (${dec}/${tot} du) - % Tendencia`, fontColor: '#e2e8f0', fontSize: 15 },
        scales: {
          xAxes: [{ ticks: { beginAtZero: true, fontColor: '#cbd5e1' }, gridLines: { color: '#24324d' } }],
          yAxes: [{ ticks: { fontColor: '#e2e8f0', fontSize: 12 }, gridLines: { display: false } }]
        },
        plugins: { datalabels: { display: true, anchor: 'end', align: 'right', color: '#e2e8f0', formatter: (v) => v + '%' } }
      }
    };
    B._midia = { tipo: 'image', url: `https://quickchart.io/chart?w=900&h=${Math.max(360, topChart.length * 36 + 110)}&bkg=%230b1220&c=${encodeURIComponent(JSON.stringify(chartCfg))}` };
  }

  const posGerot = stGerot && stGerot.posicao ? ` · GEROT ${stGerot.posicao}` : '';
  return [
    `☀️ *Matinal — ${E.nome}* (${dec}/${tot} du · faltam ${falt}${posGerot})`,
    `💰 Fat.+Cart.: *${R$(totVend)}* / ${R$(totMeta)} (*${P(totVend, totMeta)}*)`,
    `📈 Tendência: *${tendGeral.toFixed(1).replace('.', ',')}%* (*${R$(totTend)}*)`,
    `👥 Positivação: *${N(totPos)}*${totMetaPos ? ' / ' + N(totMetaPos) + ' (' + P(totPos, totMetaPos) + ')' : ''}`,
    `🗺️ Rota hoje: *${N(totRota)}* PDVs · *${N(totProsp)}* prospects · 🚫 Bloq.: *${N(totBloqQtd)}* (${R$(totBloqVlr)})`,
    '',
    `🎯 *Prioridade (pior tendência primeiro):*`,
    ...rows.slice(0, 10).map((x, i) => `${i + 1}. *${x.rca} - ${titulo(x.nome)}*: tend. *${x.tendPct.toFixed(0)}%* (${P(x.vend, x.meta)}) · ${R$(x.precisaDia)}/d · rota ${x.rota}${x.bloqQtd ? ' · 🚫' + x.bloqQtd : ''}`),
    ...(rows.length > 10 ? [`_… e mais ${rows.length - 10} vendedor(es) na equipe._`] : [])
  ].join('\n');
}
