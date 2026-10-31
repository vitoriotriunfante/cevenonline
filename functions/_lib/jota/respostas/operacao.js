// =========================================================================
// JOTA · functions/_lib/jota/respostas/operacao.js
// O QUE É: operação do dia (cortes, bloqueios, devoluções), gestão de campo e relatórios do WhatsApp.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import R from '../../../../public/regras.js'; // regras unicas (public/regras.js)
import { N, P, R$, SUGESTAO, hojeSP, nome2, sem } from '../base.js';
import { supReal } from '../escopo.js';

// ---------- OPERACAO DO DIA (como o WhatsApp 17:00/18:30; Vitorio 26/10/2026: "veja como tem muita coisa que precisa aprender") ----------
// Cortes e bloqueados: /api/pedidos-dia com a MESMA regra do motor do WhatsApp (pipeline/ceven_unified_engine.js). Reativados (+30 d) e recorrencia: lances do dia.
export function valorCorte(v) {
  const cat = String(v.categoria_corte || '').toUpperCase(), it = v.itens_cortados || [];
  if (!((cat && cat !== 'SEM CORTE') || it.length)) return 0;
  const orig = parseFloat(v.total_clube || v.valor_original || 0) || 0, fat = parseFloat(v.vl_faturado_winthor || 0) || 0;
  if (orig > fat && fat > 0) return orig - fat;
  let c = 0; for (const x of it) if (Number(x.preco) > 0) c += (x.qt_cortada || 0) * Number(x.preco);
  if (!(c > 0) && Number(v.vl_perdido_logistica) > 0) c = Number(v.vl_perdido_logistica);
  return c;
}
export async function operacao(B, E) {
  const [pd, lc] = await Promise.all([B.pedidosDia(), B.lances()]);
  const rcas = new Set(E.vend.map((v) => v.filial + '|' + v.rca));
  const dentro = (fil, rca) => E.filiais.includes(fil) && (!(E.grupo || E.supervisor || E.rca) || rcas.has(fil + '|' + rca));
  const chave = (fil, rca) => { if (E.nacional) return fil; const v = E.vend.find((x) => x.filial === fil && x.rca === String(rca)); return (v && v.supervisor) || 'sem supervisor'; };
  const G = {}; const g = (k) => G[k] || (G[k] = { dig: 0, ped: 0, cortes: 0, nCortes: 0, bloq: 0, nBloq: 0, reat: 0, rec: 0, devHoje: 0, varejo: 0, vendeu: 0 });
  for (const v of (pd && pd.pedidos) || []) {
    if (!dentro(v.filial, v.rca)) continue;
    const x = g(chave(v.filial, v.rca)), vc = valorCorte(v);
    if (vc > 0) { x.cortes += vc; x.nCortes++; }
    if (v.status_pedido === 'BLOQUEADO') { const of = parseFloat(v.vl_faturado_winthor || 0) || 0; x.bloq += of > 0 ? of : (parseFloat(v.total_clube || v.valor_original || 0) || 0); x.nBloq++; }
  }
  for (const l of (lc && lc.lances) || []) {
    if (!dentro(l.filial, String(l.rca))) continue;
    const tipo = String(l.chave || '').replace(/^[A-Z]{3}\|/, '').split('|')[0];
    if (tipo === 'gol_inativo') g(chave(l.filial, l.rca)).reat++;
    if (l.nivel === 'defesa') g(chave(l.filial, l.rca)).rec++;
  }
  for (const v of E.vend) { const x = g(E.nacional ? v.filial : (v.supervisor || 'sem supervisor')); x.dig += v.dig; x.ped += v.ped; x.devHoje += v.devHoje; if (v.varejo && v.visP > 0) { x.varejo++; if (v.vendeuHoje) x.vendeu++; } }
  if (E.nacional) for (const f of E.filiais) { const m = E.porFilial[f].macro; const x = g(f); x.dig = m.dig; x.ped = m.pedidos; x.devHoje = m.devHoje; }
  const T = Object.values(G).reduce((a, x) => { for (const k in x) a[k] = (a[k] || 0) + x[k]; return a; }, {});
  if (!E.grupo && !E.supervisor && !E.rca && !E.nacional) { T.dig = E.macro.dig; T.ped = E.macro.pedidos; T.devHoje = E.macro.devHoje; }
  return { G, T, semPedidos: !pd, semLances: !lc };
}
export async function respOperacao(B, E, t) {
  const { G, T, semPedidos, semLances } = await operacao(B, E);
  const hora = ((await B.saude()) || {}).hora_sp || '';
  const L = [`📊 *Operação de hoje — ${E.nome}* (${hora})`, `💰 Digitado: *${R$(T.dig)}* · 📦 *${N(T.ped)}* pedidos`,
    `🎯 Varejo com rota: *${N(T.vendeu)} de ${N(T.varejo)}* com venda (${P(T.vendeu, T.varejo)}) · 🚨 zerados: ${N(T.varejo - T.vendeu)}`,
    `🟢 Inativos reativados (+30 d): *${N(T.reat)}* · 🔄 Recorrência positivada: *${N(T.rec)}*`,
    `✂️ Cortes: *${R$(T.cortes)}* (${N(T.nCortes)} pedidos) · 🔒 Bloqueados: *${R$(T.bloq)}* (${N(T.nBloq)} pedidos)`,
    `🚛 Devoluções entradas hoje: *${R$(T.devHoje)}*`];
  if (semPedidos) L.push('_Cortes e bloqueados: sem leitura agora._'); if (semLances) L.push('_Reativados e recorrência: sem leitura dos lances agora._');
  const foco = /CORTE/.test(t) ? 'cortes' : /BLOQUE|RETID/.test(t) ? 'bloq' : /REATIV|INATIV/.test(t) ? 'reat' : /RECORR/.test(t) ? 'rec' : /DEVOLU/.test(t) ? 'devHoje' : 'dig';
  const nomes = { cortes: 'cortes', bloq: 'bloqueados', reat: 'reativados', rec: 'recorrência', devHoje: 'devoluções de hoje', dig: 'digitado' };
  const S = Object.entries(G).filter(([k]) => E.nacional || supReal(k)).sort((a, b) => b[1][foco] - a[1][foco]);
  L.push('', `*${E.nacional ? 'Por filial' : 'Por supervisor'} (ordem: ${nomes[foco]}):*`);
  S.forEach(([k, x], i) => L.push(`${i < 3 ? ['🥇', '🥈', '🥉'][i] : '•'} *${E.nacional ? k : nome2(k)}* ${R$(x.dig)} · ${x.ped} ped. · reat. ${x.reat} · rec. ${x.rec} · cortes ${R$(x.cortes)} · bloq. ${R$(x.bloq)}`));
  const mb = S.slice().sort((a, b) => b[1].bloq - a[1].bloq)[0];
  L.push('', SUGESTAO + (mb && mb[1].bloq > 0 ? `${R$(mb[1].bloq)} bloqueados em ${E.nacional ? mb[0] : nome2(mb[0])}: liberar com o crédito hoje para faturar.` : 'sem bloqueio relevante; foco nos zerados.'));
  return L.join('\n');
}
// recorrencia e resgates do dia AGORA pelos lances (o mapa da Executiva foi desligado em 25/10/2026)
export async function respRecorrenciaLances(B, E) {
  const { G, T, semLances } = await operacao(B, E);
  if (semLances) return 'Não consegui ler os lances de hoje agora.';
  const S = Object.entries(G).filter(([k]) => E.nacional || supReal(k)).sort((a, b) => (b[1].rec + b[1].reat) - (a[1].rec + a[1].reat));
  return [`⭐ *Recorrência e reativados hoje — ${E.nome}*`, `🔄 Clientes da RECORRÊNCIA positivados (defesa +3): *${N(T.rec)}*`, `🟢 Inativos reativados (+30 dias sem compra): *${N(T.reat)}*`, '',
    ...S.slice(0, 15).map(([k, x]) => `• ${E.nacional ? k : nome2(k)}: recorrência ${x.rec} · reativados ${x.reat}`), '', SUGESTAO + 'cada recorrência positivada é defesa (+3) na Liga; cobrar os clientes da tag que ainda estão na rota.'].join('\n');
}
// GESTAO DE CAMPO por filial (como o WhatsApp 11:30): compromisso e RET em %
export async function respGestaoCampo(B, E) {
  const R = await Promise.all(E.filiais.map((f) => B.sups(f).then((j) => ({ f, S: ((j && j.supervisores) || []).filter((x) => !/^GERENTE/i.test(x.nome)) }))));
  const linhas = R.map(({ f, S }) => ({ f, n: S.length, c: S.filter((x) => x.fez_compromisso).length, r: S.filter((x) => x.iniciou_ret).length })).filter((x) => x.n);
  const tot = linhas.reduce((a, x) => ({ n: a.n + x.n, c: a.c + x.c, r: a.r + x.r }), { n: 0, c: 0, r: 0 });
  linhas.sort((a, b) => (b.c / b.n + b.r / b.n) - (a.c / a.n + a.r / a.n));
  return [`📋 *Gestão de campo — ${E.nome}*`, `👥 Supervisores: ${tot.n} · 📝 Compromissos: *${tot.c} de ${tot.n}* (${P(tot.c, tot.n)}) · 🚗 Em rota (RET): *${tot.r} de ${tot.n}* (${P(tot.r, tot.n)})`, '',
    ...linhas.map((x, i) => `${i < 3 ? ['🥇', '🥈', '🥉'][i] : '🏢'} ${x.f}: 📝 ${x.c}/${x.n} (${P(x.c, x.n)}) · 🚗 ${x.r}/${x.n} (${P(x.r, x.n)})`), '', '_Peça "quem não fez RET" para os nomes._'].join('\n');
}
// RELATORIOS DO WHATSAPP: o ultimo arquivo salvo no GitHub (o do Vitorio para a diretoria; o do gerente para ele)
export const CICLOS = [[/07[:H ]?45|ABERTURA|RISCO/, '07_45', '07:45 (abertura e risco)'], [/10[:H ]?(00)?\b|MARCAS? PROPRIAS?|\bMP\b/, '10_00', '10:00 (Marcas Próprias)'], [/11[:H ]?30|GESTAO DE CAMPO/, '11_30', '11:30 (gestão de campo)'],
  [/14[:H ]?30|PARCIAL/, '14_30', '14:30 (parcial da tarde)'], [/17[:H ]?(00)?\b|RETA FINAL|CONSOLIDADO/, '17_00', '17:00 (reta final)'], [/18[:H ]?30|FECHAMENTO|BOLETIM/, '18_30', '18:30 (fechamento)']];
export const normArq = (s) => sem(s).replace(/[^A-Z0-9]+/g, '_');
export async function respRelatorio(B, c, t) {
  // VAZAMENTO 26/10/2026: o supervisor Rodrigo Farias recebeu o CONSOLIDADO NACIONAL (arquivo do Vitorio). Relatorio do WhatsApp: diretoria ve o consolidado,
  // gerente ve o da filial/grupo dele; supervisor e vendedor NAO recebem relatorio (perguntam a propria equipe).
  if (c.papel !== 'diretoria' && c.papel !== 'ceo' && c.papel !== 'gerente') return 'Os relatórios automáticos do WhatsApp são da gerência. Para a sua equipe, me pergunte "como está minha equipe?", "hoje" ou "zerados" que eu respondo na hora.';
  let ciclo = CICLOS.find(([re]) => re.test(t));
  if (!ciclo && /ONTEM|COMO FECHOU/.test(t)) ciclo = CICLOS[5];
  if (!ciclo) { const h = R.horaSP(); ciclo = h >= 19 ? CICLOS[5] : h >= 17 ? CICLOS[4] : h >= 15 ? CICLOS[3] : h >= 12 ? CICLOS[2] : h >= 10 ? CICLOS[1] : CICLOS[0]; }
  const dir = `OPERACAO_WHATSAPP/relatorios_por_horario/${ciclo[1]}`;
  const lista = await B.pasta(dir);
  let arqs = Array.isArray(lista) ? lista.filter((a) => a && /\.md$/.test(a.name)).map((a) => a.name) : null;
  if (!arqs) {   /* sem lista (GitHub limitou): tenta os nomes padrao */
    const hh = ciclo[1], F = c.filial || '', Gp = String(c.grupo || '').toUpperCase();
    const ac = (x) => x.replace('FABIO', 'FÁBIO'), Nm = String(c.nome || '').split(' ')[0].toUpperCase(), Tt = Nm.charAt(0) + Nm.slice(1).toLowerCase();
    arqs = c.papel === 'gerente' && F ? [...(Gp ? [`${hh}__${F}_${Gp}.md`, `${hh}__${F}_${ac(Gp)}.md`] : []), `${hh}__${F}.md`, `${hh}__GERENTE_${F}_${Nm}.md`, `${hh}__GERENTE_${F}_${Tt}.md`, `${hh}__GERENTE_${F}_${Nm.replace(/[^A-Z]/g, '_')}.md`, `${hh}__GERENTE_${F}_${Nm.replace('FABIO', 'F_BIO')}.md`, `${hh}__GERENTE_${F}_${Tt.replace('Fabio', 'F_bio')}.md`, ...(F === 'TPA' ? [`${hh}__GERENTE_TPA_Radke_Leandro.md`] : [])] : [`${hh}__VITORIO.md`];
    for (const n of arqs) { const t2 = await B.raw(`${dir}/${n}`); if (t2) { arqs = [n]; break; } }
  }
  let alvo = null;
  if (c.papel === 'gerente' && c.filial) {
    // nomes de arquivo variam: FABIO / FÁBIO / F_BIO (acento virou "_"). Compara as duas formas; arquivo com " - " no nome e copia antiga (descarta).
    const F = c.filial, v2 = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const alvos = (x) => [normArq(x), v2(x)].filter((y, i, a) => y && a.indexOf(y) === i);
    const G = alvos(c.grupo), PN = alvos(String(c.nome || '').split(' ')[0]);
    const sc = (n) => { if (/ - /.test(n)) return -1; const x = normArq(n), xr = v2(n); if (!x.includes('_' + F)) return -1; let s = 1; const tem = (L) => L.some((y) => x.includes(y) || xr.includes(y));
      if (G.length && tem(G)) s += 3; if (PN.length && tem(PN)) s += 2; if (!G.length && x === normArq(`${ciclo[1]}__${F}.md`)) s += 1; return s; };
    alvo = arqs.map((n) => [n, sc(n)]).filter((x) => x[1] >= 0).sort((a, b) => b[1] - a[1])[0];
    alvo = alvo && alvo[0];
  } else if (c.papel === 'diretoria' || c.papel === 'ceo') alvo = arqs.find((n) => /VITORIO/i.test(n));
  if (!alvo && ciclo[1] === '10_00' && ['TBE', 'TCG'].includes(c.filial)) return `${c.filial} não tem Marca Própria no catálogo (regra do relatório das 10:00); por isso não há relatório de MP para a filial.`;
  if (!alvo) return `Não achei o seu relatório das ${ciclo[2]}.`;
  const txt = await B.raw(`${dir}/${alvo}`);
  if (!txt) return `Não consegui ler o relatório das ${ciclo[2]} agora.`;
  const dt = (txt.match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1] || '';
  const hoje = hojeSP().split('-').reverse().join('/');
  const avisos = [];
  if (dt && dt !== hoje) avisos.push(`_Último disponível: ${dt} (o de hoje ainda não saiu ou não foi salvo)._`);
  if (/Faturado: R\$ 0,00 • 📦 0 itens/.test(txt) && ciclo[1] === '10_00') avisos.push('⚠️ _Este relatório saiu ZERADO por falha na coleta do dia (a lista de vendedores veio vazia do CEVEN). Não é venda zero; o número real não foi apurado._');
  return [`📄 *Relatório das ${ciclo[2]}*${dt ? ' — ' + dt : ''}`, ...avisos, '', txt.trim().slice(0, 6000)].join('\n');
}
