// =========================================================================
// JOTA · functions/_lib/jota/escopo.js
// O QUE É: quem pode ver o quê (diretoria, gerente, supervisor, vendedor) e quem é a pessoa citada na pergunta.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { VAREJO, hojeSP, nome2, sem, so, vn } from './base.js';

// vendedores de uma filial (mostrados na Gestao de Equipe) + totais que somam TODOS (macro)
// codigo do supervisor pelo nome (preenchido ao carregar a equipe) -> supNome/sn mostram 'COD - Nome'
export const SUPCOD = new Map();
export const sn = (nome, cod) => { const c = cod || SUPCOD.get(sem(nome)); return (c ? c + ' - ' : '') + nome2(nome); };
export async function vendedoresDaFilial(B, filial, grupo, supervisor, soRca) {
  const [snap, mostra] = await Promise.all([B.snap(filial), B.mostra()]);
  const eq = new Map(); if (mostra && mostra.filiais) for (const [k, L] of Object.entries(mostra.filiais)) if (k.split('_')[0] === filial) for (const v of L) eq.set(String(v.rca), v);
  const vend = [], ocultos = [], outros = []; const macro = { pedidos: 0, dig: 0, devHoje: 0 };
  for (const [rca, r] of Object.entries((snap && snap.rcas) || {})) {
    const e = eq.get(rca);
    const d = r.dashboard || {}, fi = d.financeiro || {}, po = d.positivacao || {}, pd = (r.produtividade && r.produtividade.dia) || {}, pm = (r.produtividade && r.produtividade.mes) || {};
    macro.pedidos += pd.positivacao || 0; macro.dig += pd.dig_pedido || 0;
    macro.devHoje += (Array.isArray(r.devolucoes) ? r.devolucoes : []).filter((x) => String(x && x.data || '').slice(0, 10) === hojeSP()).reduce((t, x) => t + Math.abs(parseFloat(x.vl_devolvido || x.valor || 0) || 0), 0);
    if (!e) continue;   // fora da arvore do CEVEN de hoje = nao existe
    if (e.supervisor && e.sup_cod) SUPCOD.set(sem(e.supervisor), e.sup_cod);
    const varejo = VAREJO.has(String(e.canal || '').toUpperCase());
    const visP = pd.total_programado || (Array.isArray(r.roteiro) ? r.roteiro.length : 0);
    const visF = pd.visitas_na_rota || 0;
    const vObj = { filial, rca, nome: e.nome || d.nome || 'RCA ' + rca, supervisor: e.supervisor || '', supCod: e.sup_cod || '', grupo: e.grupo || '', gerente: e.gerente || '', canal: e.canal || '', varejo,
      /* meta = a da HIERARQUIA do CEVEN quando houver (tela do supervisor/gerente; 27/10/2026, Thiago/MCD) */ fat: fi.faturado || 0, pend: fi.pendente || 0, meta: r.meta_hier != null ? r.meta_hier : fi.meta || 0, dev: fi.devolucao || 0, pct: (r.meta_hier != null ? r.meta_hier : fi.meta) ? (fi.faturado || 0) / (r.meta_hier != null ? r.meta_hier : fi.meta) * 100 : null,
      pos: po.realizado ?? null, metaPos: po.meta ?? null, dig: pd.dig_pedido || 0, ped: pd.positivacao || 0, visP, visF, comVenda: pd.visitas_com_venda || 0,
      visPlanMes: pm.visit_plan || 0, visRealMes: pm.visit_real || 0,
      /* mes do PROPRIO vendedor, qualquer canal (detalhe do vendedor; os totais de rota seguem quem tem rota) */ roteiroMes: Array.isArray(r.roteiro_mes) ? r.roteiro_mes : null, mesV: { plan: pm.visit_plan ?? null, real: pm.visit_real ?? null, pedRota: pm.ped_rota_mes ?? null, efic: pm.eficiencia_pct ?? null },
      zerado: visP > 0 && !(pd.dig_pedido > 0), semVisita: visP > 0 && !visF, devolucoes: Array.isArray(r.devolucoes) ? r.devolucoes : [],
      /* devolucoes que ENTRARAM hoje (mesma regra do WhatsApp 17:00/18:30: d.data === hoje) */
      devHoje: (Array.isArray(r.devolucoes) ? r.devolucoes : []).filter((x) => String(x && x.data || '').slice(0, 10) === hojeSP()).reduce((t, x) => t + Math.abs(parseFloat(x.vl_devolvido || x.valor || 0) || 0), 0),
      vendeuHoje: (pd.dig_pedido || 0) > 0 || (pd.positivacao || 0) > 0 || (pd.visitas_com_venda || 0) > 0,
      rotaHoje: Array.isArray(r.roteiro) ? r.roteiro.filter((c) => String(c.data_visita || '').slice(0, 10) === hojeSP() || /FORA/i.test(String(c.status || ''))) : [],
      aVisitar: Array.isArray(r.roteiro) ? r.roteiro.filter((c) => String(c.data_visita || '').slice(0, 10) === hojeSP() && /^(ABERTO|AGENDADO)$/i.test(String(c.status || '')) && !c.checkin_horario) : [] };

    const ehMeuGrupo = !grupo || String(e.grupo || '').toUpperCase() === String(grupo).toUpperCase();
    const sSup = sem(supervisor || ''), sESup = sem(e.supervisor || '');
    const ehMeuSup = !supervisor || sESup === sSup || (sSup.length >= 4 && (sESup.includes(sSup) || sSup.includes(sESup))) || (sSup.split(/\s+/)[0] && sSup.split(/\s+/)[0] === sESup.split(/\s+/)[0] && sSup.split(/\s+/).pop() === sESup.split(/\s+/).pop());
    const ehMeuRca = !soRca || String(rca) === String(soRca);
    if (!ehMeuGrupo || !ehMeuSup || !ehMeuRca) {
      outros.push(vObj);
      continue;
    }
    const destino = e.mostra === false ? ocultos : vend;
    destino.push(vObj);
  }
  vend.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  return { vend, ocultos, outros, macro };
}

// ESCOPO: { nome, filiais:[...], grupo, nacional }
export async function carregaEscopo(B, esc) {
  const partes = await Promise.all(esc.filiais.map((f) => vendedoresDaFilial(B, f, esc.grupo, esc.supervisor, esc.rca)));
  const vend = partes.flatMap((p) => p.vend), ocultos = partes.flatMap((p) => p.ocultos || []), outros = partes.flatMap((p) => p.outros || []);
  const macro = partes.reduce((t, p) => ({ pedidos: t.pedidos + p.macro.pedidos, dig: t.dig + p.macro.dig, devHoje: t.devHoje + p.macro.devHoje }), { pedidos: 0, dig: 0, devHoje: 0 });
  return { ...esc, vend, ocultos, outros, macro, porFilial: Object.fromEntries(esc.filiais.map((f, i) => [f, partes[i]])) };
}
// chave de supervisor: "NOME|FIL" no Brasil; pseudo-supervisores (sem supervisor, GERENTE X, VAGO) nao entram em ranking nem sugestao
export const supChave = (v, nac) => (v.supervisor || 'sem supervisor') + (nac ? '|' + v.filial : '');
export const supNome = (k) => { const [s, f] = String(k).split('|'); return (/^sem supervisor$/i.test(s) ? 'Ligados ao gerente' : /^GERENTE/i.test(s) ? 'Ligados ao gerente' : sn(s)) + (f ? ' ' + f : ''); };
export const supReal = (k) => !/^(sem supervisor|GERENTE|VAGO)/i.test(String(k));
export const pessoaReal = (v) => !/^(VAGO|RCA\b|VENDA |GERENTE)/i.test(String(v.nome || ''));
export function agrupa(V, chave) {
  const m = new Map();
  for (const v of V) { const k = chave(v); const x = m.get(k) || { V: [], fat: 0, pend: 0, meta: 0, dig: 0, ped: 0, dev: 0, pos: 0, metaPos: 0, visP: 0, visF: 0, comVenda: 0, zerados: 0, semVisita: 0, varejo: 0 };
    x.V.push(v); x.fat += v.fat; x.pend += v.pend; x.meta += v.meta; x.dig += v.dig; x.ped += v.ped; x.dev += v.dev; x.pos += v.pos || 0; x.metaPos += v.metaPos || 0;
    x.visP += v.visP; x.visF += v.visF; x.comVenda += v.comVenda; if (v.zerado) x.zerados++; if (v.semVisita) x.semVisita++; if (v.varejo) x.varejo++; m.set(k, x); }
  for (const x of m.values()) x.pct = x.meta ? x.fat / x.meta * 100 : null;
  return m;
}
export const pctTxt = (x) => x == null ? 'sem dado' : x.toFixed(1).replace('.', ',') + '%';
export const listaNomes = (V, n = 4) => V.slice(0, n).map((v) => vn(v)).join(', ') + (V.length > n ? ` +${V.length - n}` : '');

// acha supervisor ou vendedor citado na mensagem (primeiro nome tem que bater)
export const PAL = new Set(['SETOR', 'SETORES', 'COMO', 'ESTA', 'QUAL', 'QUAIS', 'HOJE', 'VENDEDOR', 'VENDEDORA', 'SUPERVISOR', 'SUPERVISORA', 'FILIAL', 'ROTA', 'MINHA', 'MEU', 'EQUIPE', 'TIME', 'DELE', 'DELA', 'QUANTO', 'FALTA', 'LIGA', 'BRASIL', 'TODOS', 'TODAS', 'SOBRE', 'ESTOU', 'ESTAMOS', 'ONTEM', 'MAIS', 'MENOS', 'PEDIDO', 'PEDIDOS', 'VENDA', 'VENDAS', 'META', 'POSICAO', 'TABELA', 'ANDA', 'VAI', 'PARA', 'COM']);
export function achaPessoa(E, t) {
  const toks = t.split(/[^A-Z]+/).filter((w) => (w.length > 2 || w === 'PJ') && !PAL.has(w));
  // primeiro nome vale mais; nome do meio tambem acha (27/10/2026: "vendedora Joyce" = 1114 APARECIDA JOYCE GOMES FERREIRA), com peso menor para nao roubar de quem tem o 1o nome
  const score = (nome) => { const p = sem(nome).replace(/^CLT\s*-?\s*/, '').split(/\s+/); if (!toks.includes(p[0])) return p.slice(1).some((w) => w.length > 3 && toks.includes(w) && !/^(DOS?|DAS?|SILVA|SANTOS|SOUZA|OLIVEIRA|PEREIRA|FERREIRA|COSTA|LIMA|ALVES|RODRIGUES|GOMES)$/.test(w)) ? 0.5 : 0; return 1 + p.slice(1).filter((w) => toks.includes(w)).length; };
  // CODIGO CITADO MANDA (sabatina 25/10/2026: "vendedor Ana Carolina 483" virou a Ana Broto 251): vale o codigo quando o nome bate com
  // aquele vendedor ou quando vem escrito "RCA/COD/codigo/vendedor 483". Numero solto ("top 10", "3 dias") nunca vira vendedor.
  // SUPERVISOR PELO CODIGO (27/10/2026, Priscila "meta da supervisora 97" pegou o vendedor 97): "supervisor(a) N" = o supervisor de codigo N
  const ms = t.match(/SUPERVISORA?\s*(?:COD(?:IGO)?\s*)?(\d{1,4})\b/);
  if (ms) { const v0 = E.vend.find((v) => String(v.supCod || '') === ms[1] || String(SUPCOD.get(sem(v.supervisor)) || '') === ms[1]); if (v0) return { tipo: 'sup', alvo: { nome: v0.supervisor, filial: v0.filial }, empate: [{ nome: v0.supervisor, filial: v0.filial }] }; }
  // VARIAS MENSAGENS JUNTAS ("100. 103. 1119"): vale o ULTIMO numero citado (o que a pessoa pediu por ultimo), nao o primeiro (27/10/2026, Priscila)
  for (const n of (t.match(/\b\d{1,5}\b/g) || []).reverse()) {
    const cand = E.vend.concat(E.ocultos || []).filter((v) => String(v.rca) === n);
    const explicito = new RegExp(`(RCA|COD|CODIGO|VENDEDORA?|VEND|SETOR)\\.?\\s*${n}\\b`).test(t) || (E.supervisor && !/\b(TOP|DIAS?|ULTIMOS?|PRIMEIROS?|MAIORES|MENORES)\s+\d/.test(t));   /* supervisor: numero do proprio time = vendedor (26/10/2026) */
    const bom = cand.map((v) => [v, score(v.nome)]).filter((x) => x[1] || explicito).sort((a, b) => b[1] - a[1]);
    if (bom.length) return { tipo: 'vend', alvo: bom[0][0], empate: [bom[0][0]] };
    // Setor explícito de outro supervisor da mesma filial (28/10/2026: Francisco perguntou "setor 378" e recebia consolidado da equipe)
    if (explicito && E.outros && E.outros.length) {
      const o = E.outros.find((v) => String(v.rca) === n);
      if (o) return { tipo: 'vend', alvo: o, empate: [o], outroSupervisor: true };
    }
  }
  if (!toks.length) return null;   /* 26/10/2026: so DEPOIS do codigo ("vendedor 59" nao tem palavra de nome e saia vazio) */
  const querSup = /SUPERVIS|EQUIPE|TIME/.test(t), querVend = /VENDEDOR|\bRCA\b/.test(t);
  const sups = [...new Map(E.vend.filter((v) => v.supervisor && supReal(v.supervisor)).map((v) => [v.filial + '|' + v.supervisor, { nome: v.supervisor, filial: v.filial }])).values()];
  const bs = sups.map((s) => [s, score(s.nome)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  const bv = E.vend.concat(E.ocultos || []).filter((v) => !/^(GERENTE|VAGO|RCA\b|VENDA |SUPERVIS)/i.test(String(v.nome || '')))   /* conta que nao e vendedor so pelo codigo (27/10/2026: "gerente" achava 1010 GERENTE TPH) */.map((v) => [v, score(v.nome)])   /* oculto na Gestao tambem e achado pelo NOME (26/10/2026: Anderson, "vendedor Bruno" = 153 oculto) */.filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  if (bs.length && !querVend && (querSup || !bv.length || bs[0][1] >= bv[0][1])) return { tipo: 'sup', alvo: bs[0][0], empate: bs.filter((x) => x[1] === bs[0][1]).map((x) => x[0]) };
  if (bv.length) return { tipo: 'vend', alvo: bv[0][0], empate: bv.filter((x) => x[1] === bv[0][1]).map((x) => x[0]) };
  // NOME COM ERRO DE DIGITACAO/AUDIO (27/10/2026: Evandro "Branda" = Brenda; "Josiane" = Joseanne): so com "vendedor(a)" na frente, 1 letra de diferenca no 1o nome
  // (ou som parecido: s/z, y/i, sem h), e so se for um unico vendedor; nunca adivinha entre varios
  const mv = t.match(/VENDEDORA?\s+([A-Z]{4,})/);
  if (mv) {
    const fon = (w) => w.replace(/H/g, '').replace(/Y/g, 'I').replace(/Z/g, 'S').replace(/([A-Z])\1+/g, '$1');
    const perto = (a, b) => { if (fon(a) === fon(b)) return true; if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; };
    const cand = E.vend.concat(E.ocultos || []).filter((v) => !/^(GERENTE|VAGO|RCA\b|VENDA )/i.test(String(v.nome || '')) && perto(sem(v.nome).split(/\s+/)[0] || '', mv[1]));
    if (cand.length === 1) return { tipo: 'vend', alvo: cand[0], empate: cand };
  }
  return null;
}
