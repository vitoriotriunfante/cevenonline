// =========================================================================
// JOTA · functions/_lib/jota/respostas/rota.js
// O QUE É: rota do dia, a visitar, zerados, visitas, ranking, positivação, devolução.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { sn } from '../escopo.js';
import R from '../../../../public/regras.js'; // regras unicas (public/regras.js)
import { N, P, R$, SUGESTAO, diasUteisRestantes, hojeSP, nome2, sem, titulo, vn } from '../base.js';
import { agrupa, listaNomes, pctTxt, pessoaReal, supChave, supNome, supReal } from '../escopo.js';
import { totaisOficiais } from './resumo.js';

// DETALHE DO DETALHE (Vitorio, 25/10/2026): "quais clientes ela visitou e nao vendeu? quais as justificativas?" -> cliente a cliente, com check-in, tempo e motivo
export function respClientesDia(v, t) {
  const R = v.rotaHoje || [];
  if (!v.varejo && !R.length) return `${v.rca} - ${titulo(v.nome)} (${v.canal || 'sem canal'}) não tem roteiro de visitas hoje.`;
  if (!R.length) return `${v.rca} - ${titulo(v.nome)} (${v.filial}) não tem clientes na rota de hoje` + ([0, 6].includes(new Date(hojeSP() + 'T12:00:00Z').getUTCDay()) ? ' (fim de semana: sem rota).' : '.');
  const st = (c) => String(c.status || '').toUpperCase();
  const vendeu = (c) => /POSITIVADO|EFETIVADO/.test(st(c));
  const visitou = (c) => !!c.checkin_horario || /VISITADO|JUSTIFICADO|POSITIVADO|EFETIVADO/.test(st(c));
  const linha = (c) => `• ${titulo(c.nome_cliente || c.razao_social || 'cliente')} (#${c.id_cliente}) — ${st(c) || 'sem status'}` + (c.checkin_horario ? ` · ${c.checkin_horario}–${c.checkout_horario || '…'} (${c.tempo_visita || '?'})` : '') + (c.motivo_nao_visita ? ` · motivo: *${titulo(c.motivo_nao_visita)}*` : '') + (c.observacao_nao_visita ? ` · obs.: "${c.observacao_nao_visita}"` : '');
  const fora = R.filter((c) => /FORA/.test(st(c))), rota = R.filter((c) => !/FORA/.test(st(c)));
  const cab = `📋 *${v.rca} - ${titulo(v.nome)}* (${v.filial} · sup. ${sn(v.supervisor, v.supCod)}) — rota de hoje: ${rota.filter(visitou).length} visitados de ${rota.length} · com venda ${rota.filter(vendeu).length}` + (fora.length ? ` · fora da rota ${fora.length}` : '');
  let L, sug;
  if (/NAO VENDEU|SEM VENDA|JUSTIFICATIV|MOTIVO/.test(t)) {
    const S = rota.filter((c) => visitou(c) && !vendeu(c));
    const M = {}; for (const c of S) { const m = titulo(c.motivo_nao_visita || 'sem justificativa'); M[m] = (M[m] || 0) + 1; }
    L = [cab, '', `*Visitou e não vendeu (${S.length}):*`, ...S.map(linha), S.length ? '*Justificativas:* ' + Object.entries(M).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}×`).join(' · ') : ''];
    sug = S.some((c) => /PEDIDO A DIGITAR/i.test(c.motivo_nao_visita || '')) ? 'tem "pedido a digitar": cobrar a digitação hoje para não virar zerado.' : S.length ? 'rever com o supervisor os clientes sem venda e voltar nos de maior potencial.' : !rota.filter(visitou).length ? (fora.length ? `fez ${fora.length} visita(s) fora da rota e ainda não visitou os ${rota.length} cliente(s) da rota de hoje.` : 'nenhuma visita na rota ainda hoje: cobrar o início da rota.') : 'todas as visitas viraram venda.';
  } else {
    const falta = rota.filter((c) => !visitou(c));
    L = [cab, '', '*Visitados:*', ...rota.filter(visitou).map(linha), fora.length ? '*Fora da rota:*' : '', ...fora.map(linha), falta.length ? '*Ainda sem visita:*' : '', ...falta.map(linha)];
    sug = rota.filter((c) => !visitou(c)).length ? `faltam ${rota.filter((c) => !visitou(c)).length} cliente(s) na rota; priorizar os parados há mais tempo.` : 'rota de hoje concluída.';
  }
  return L.filter((x, i) => x !== '' || i === 1).join('\n').slice(0, 3800) + '\n\n' + SUGESTAO + sug;
}
// clientes da rota de hoje que ainda faltam visitar (Vitorio, 22/10/2026: "quais clientes ainda faltam visitar hoje?")
export function respAVisitar(E, pessoa) {
  const dias = (c) => { const d = String(c.data_ultima_compra || '').slice(0, 10); if (!d) return 'sem compra'; const n = Math.round((Date.parse(hojeSP()) - Date.parse(d)) / 864e5); return n + 'd sem compra'; };
  const cli = (c) => `• ${titulo(c.nome_cliente || c.razao_social || 'cliente ' + c.id_cliente)} (#${c.id_cliente}) · ${dias(c)}` + (Array.isArray(c.focos) && c.focos.length ? ' · ' + c.focos.map((f) => f.industria_foco).join('/') : '');
  if (pessoa && pessoa.tipo === 'vend') {
    const v = pessoa.alvo; if (!v.varejo && !(v.aVisitar || []).length && !(v.rotaHoje || []).length) return `${v.rca} - ${titulo(v.nome)} (${v.canal || 'sem canal'}) não tem roteiro de visitas hoje.`;
    const A = v.aVisitar;
    return [`📍 *${v.rca} - ${titulo(v.nome)}* (${v.filial}) — rota de hoje: ${v.visF} de ${v.visP} visitas feitas · *faltam ${A.length}*`, ...A.slice(0, 30).map(cli), A.length > 30 ? `… e mais ${A.length - 30}` : '',
      '', A.length ? SUGESTAO + `começar pelos parados há mais tempo e pelos com tag de campanha.` : SUGESTAO + 'rota de hoje concluída.'].filter((x) => x !== '').join('\n');
  }
  // VISUALIZAR E TUDO (Vitorio, 26/10/2026: "varejo entra para a cobranca... para visualizar e tudo"): AS e qualquer canal com roteiro entram nesta lista
  const V = E.vend.filter((v) => (v.rotaHoje || []).length && (!pessoa || (v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial)));
  const naRota = (v) => (v.rotaHoje || []).filter((c) => !/FORA/i.test(String(c.status || '')));
  const visitou = (c) => !!c.checkin_horario || /VISITADO|JUSTIFICADO|POSITIVADO|EFETIVADO/i.test(String(c.status || ''));
  const tot = V.reduce((a, v) => a + v.aVisitar.length, 0), prog = V.reduce((a, v) => a + naRota(v).length, 0), feitas = V.reduce((a, v) => a + naRota(v).filter(visitou).length, 0);
  const nome = pessoa ? titulo(pessoa.alvo.nome) + ' (' + pessoa.alvo.filial + ')' : E.nome;
  const L = [`📍 *Rota de hoje — ${nome}*`, `Clientes na rota: *${N(prog)}* · visitados: *${N(feitas)}* · *faltam ${N(tot)}*`, ''];
  if (E.nacional && !pessoa) { for (const [f, x] of [...agrupa(V, (v) => v.filial)].map(([f, x]) => [f, x.V.reduce((a, v) => a + v.aVisitar.length, 0)]).sort((a, b) => b[1] - a[1])) L.push(`• ${f}: faltam ${x}`); }
  else for (const v of V.filter((v) => v.aVisitar.length).sort((a, b) => b.aVisitar.length - a.aVisitar.length).slice(0, 25)) L.push(`• ${vn(v)}: faltam *${v.aVisitar.length}* de ${naRota(v).length}` + (pessoa ? ' — ' + v.aVisitar.slice(0, 3).map((c) => titulo(c.nome_cliente || '')).join(', ') + (v.aVisitar.length > 3 ? '…' : '') : ''));
  const pior = V.slice().sort((a, b) => b.aVisitar.length - a.aVisitar.length)[0];
  L.push('', pior && pior.aVisitar.length ? SUGESTAO + `${nome2(pior.nome)} tem ${pior.aVisitar.length} clientes por visitar.` : SUGESTAO + 'rota do dia concluída.', '_Peça "faltam visitar vendedor Nome" para a lista de clientes._');
  return L.join('\n');
}
export function respZerados(E) {
  const Z = E.vend.filter((v) => v.zerado), SV = E.vend.filter((v) => v.semVisita);
  if (!Z.length) return `✅ *Zerados hoje — ${E.nome}: 0.* Nenhum vendedor do varejo com rota está sem pedido agora.`;
  const G = [...agrupa(Z, (v) => supChave(v, E.nacional))].sort((a, b) => b[1].V.length - a[1].V.length);
  const L = [`⚠️ *Zerados hoje — ${E.nome}* (varejo com rota e sem pedido): *${Z.length}* · sem nenhuma visita: ${SV.length}`, ''];
  for (const [s, x] of G.slice(0, 15)) L.push(`*${supNome(s)}*: ` + x.V.map((v) => `${vn(v)} (${v.visF}/${v.visP} vis.)`).join(', '));
  if (G.length > 15) L.push(`… e mais ${G.length - 15} supervisores`);
  L.push('', SUGESTAO + `começar por ${supNome((G.find(([k]) => supReal(k)) || G[0])[0])}: ${G[0][1].V.length} zerado(s).`);
  return L.join('\n');
}
export function respVisitas(E) {
  const V = E.vend.filter((v) => v.varejo); const x = agrupa(V, () => 'x').get('x');
  if (!x) return 'Sem dado de rota agora.';
  const G = [...agrupa(V, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([k]) => supReal(k)).sort((a, b) => (b[1].visF / (b[1].visP || 1)) - (a[1].visF / (a[1].visP || 1)));
  const pm = V.reduce((a, v) => [a[0] + v.visRealMes, a[1] + v.visPlanMes], [0, 0]);
  return [`🚶 *Rota do varejo — ${E.nome}*`, `Hoje: *${N(x.visF)} de ${N(x.visP)}* visitas (${P(x.visF, x.visP)}) · com venda ${N(x.comVenda)} → eficácia *${P(x.comVenda, x.visP)}*`, `Mês: ${N(pm[0])} de ${N(pm[1])} visitas (eficiência ${P(pm[0], pm[1])})`, `Sem nenhuma visita hoje: ${x.semVisita}`, '',
    ...G.map(([k, y]) => `• ${E.nacional ? k : nome2(k)}: ${y.visF}/${y.visP} (${P(y.visF, y.visP)}) · eficácia ${P(y.comVenda, y.visP)}`),
    '', SUGESTAO + (x.semVisita ? `${x.semVisita} vendedor(es) com rota ainda sem visita: ${listaNomes(V.filter((v) => v.semVisita), 3)}.` : 'todos com visita; acompanhar a eficácia.'), '_Visitas e eficácia contam só o varejo de campo (rota)._'].join('\n');
}
// RANKING DE VENDEDORES (Vitorio, 25/10/2026: "como ta o ranking dos 10 melhores vendedores de varejo?" -> veio top + 10 piores com valor negativo e meta minuscula)
// Regras: so o que foi pedido (melhores OU piores; os dois so se pedir); varejo por padrao (AS se pedir); fora quem tem meta minuscula (distorce o %).
export function respRanking(E, t) {
  const pos = /POSITIVA/.test(t), hoje = /HOJE|\bHJ\b|\bDIA\b/.test(t) && !pos;
  // equipe so de AS (27/10/2026, Jorge/TCV: "passa ranking tcv" -> "nao achei vendedores de varejo"): o ranking e do canal que a equipe tem
  const as = /\bAS\b|ATACADO/.test(t) || (!E.vend.some((v) => v.varejo) && E.vend.some((v) => /^(AS|PET AS)$/.test(String(v.canal).toUpperCase())));
  const n = Math.min(30, Number((t.match(/\b(\d{1,2})\b/) || [])[1]) || (/\bDEZ\b/.test(t) ? 10 : /\bCINCO\b/.test(t) ? 5 : 10));
  const querPior = /PIOR|ATRAS|\bMAL\b|FUNDO|ULTIMOS|LANTERNA/.test(t), querMelhor = /MELHOR|TOP|DESTAQUE|LIDER|PRIMEIROS/.test(t) || !querPior;
  const canalOk = (v) => (as ? /^(AS|PET AS)$/.test(String(v.canal).toUpperCase()) : v.varejo);
  const minimo = pos ? (v) => (v.metaPos || 0) >= 40 : hoje ? () => true : (v) => (v.meta || 0) >= 10000;
  const V = E.vend.filter((v) => pessoaReal(v) && canalOk(v) && minimo(v) && (pos ? v.metaPos : hoje ? true : v.meta));
  const val = (v) => (pos ? v.pos / v.metaPos * 100 : hoje ? v.dig : v.pct ?? -1);
  const fmt = (v) => (pos ? `*${N(v.pos)}* de ${N(v.metaPos)} clientes (${P(v.pos, v.metaPos)})` : hoje ? `*${R$(v.dig)}* em ${v.ped} ped.` : `*${pctTxt(v.pct)}* · ${R$(v.fat)} de ${R$(v.meta)}`);
  const S = V.slice().sort((a, b) => val(b) - val(a));
  if (!S.length) return `Não achei vendedores ${as ? 'AS' : 'de varejo'} com dado para esse ranking em ${E.nome}.`;
  const crit = pos ? 'positivação do mês (% da meta de clientes)' : hoje ? 'digitado hoje' : '% da meta faturada no mês';
  const lin = (v, i) => `${i + 1}. ${vn(v)}${E.nacional ? ' · ' + v.filial : ''} — ${fmt(v)}`;
  const L = [`🏅 *${E.nome} — ${querMelhor && !querPior ? n + ' melhores' : querPior && !querMelhor ? n + ' mais atrás' : 'ranking'}, ${as ? 'AS' : 'varejo'}*`, `_Critério: ${crit}._`];
  if (querMelhor) L.push('', ...S.slice(0, n).map(lin));
  if (querPior) { const P2 = S.slice(-n).reverse(); L.push('', querMelhor ? '*Mais atrás:*' : '', ...P2.map((v, i) => lin(v, S.length - 1 - i - 0).replace(/^\d+\./, `${S.length - i}º`))); }
  L.push('', `_Fora do ranking: meta ${pos ? 'abaixo de 40 clientes' : 'abaixo de R$ 10 mil'} (distorce o %)${as ? '' : ' e quem não é varejo'}._`);
  L.push(SUGESTAO + (querPior && !querMelhor ? `conversar hoje com ${nome2(S[S.length - 1].nome)} e o supervisor ${nome2(S[S.length - 1].supervisor)}.` : `reconhecer ${nome2(S[0].nome)} no grupo da equipe: reconhecimento puxa o time.`));
  return L.filter((x, k, a) => !(x === '' && a[k - 1] === '')).join('\n');
}
export async function respPositivacao(B, E) {
  const x = await totaisOficiais(B, E); if (!x.metaPos) return 'Sem dado agora.';
  const dn = diasUteisRestantes();
  // ABRE UM NIVEL ABAIXO DE QUEM PERGUNTA (26/10/2026, Priscila: "pq ja nao respondeu aberto?"): diretoria -> filiais; gerente -> supervisores; supervisor -> vendedores
  const porVend = !!E.supervisor;
  const G = porVend ? E.vend.filter((v) => (v.metaPos || 0) > 0).map((v) => [vn(v), { pos: v.pos || 0, metaPos: Math.round(v.metaPos) }]).sort((a, b) => (b[1].pos / (b[1].metaPos || 1)) - (a[1].pos / (a[1].metaPos || 1)))
    : [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([k]) => supReal(k)).sort((a, b) => (b[1].pos / (b[1].metaPos || 1)) - (a[1].pos / (a[1].metaPos || 1)));
  // META OFICIAL DE POSITIVACAO POR FILIAL (Premiacao, 27.000 no grupo) — base TEMPORARIA ate o CEVEN corrigir a tela Filiais (27/10/2026)
  let oficial = '';
  if (!E.supervisor && !E.grupo && !E.rca) { const mp = await B.metaPosFilial(); if (mp && mp.metas && mp.mes === hojeSP().slice(0, 7)) {
    const mo = E.nacional ? mp.total : E.filiais.reduce((a, f) => a + (mp.metas[f] || 0), 0);
    if (mo) oficial = `🎯 *Meta oficial de positivação (Premiação): ${N(mo)} PDVs*` + (E.nacional ? ' no grupo' : '') + ' _(base temporária até o CEVEN corrigir a tela Filiais)_'; } }
  return [`👥 *Positivação — ${E.nome}* (clientes com faturamento no mês)`, ...(oficial ? [oficial] : []), `*${N(x.pos)} de ${N(x.metaPos)}* (${P(x.pos, x.metaPos)}) · faltam ${N(Math.max(0, x.metaPos - x.pos))} → ${N(Math.ceil(Math.max(0, x.metaPos - x.pos) / Math.max(dn, 1)))} por dia útil`, '',
    ...G.map(([k, y]) => `• ${E.nacional || porVend ? k : nome2(k)}: ${N(y.pos)} de ${N(y.metaPos)} (${P(y.pos, y.metaPos)}) · faltam ${N(Math.max(0, y.metaPos - y.pos))}`), '', SUGESTAO + (G.length ? `o mais atrás é ${E.nacional || porVend ? G[G.length - 1][0] : nome2(G[G.length - 1][0])}.` : 'sem meta de positivação cadastrada.'),
    E.nacional
      // BRASIL (Vitorio, 26/10/2026): deixar claro por que a soma passa da meta do grupo (27.000 PDVs) e o que nao entra
      ? '⚠️ _Atenção: esta é a *soma do CEVEN* (vendedor a vendedor). Ela fica *maior que a meta do grupo de 27.000 PDVs*, porque há filiais com mais de uma pasta: o mesmo cliente comprado por duas pastas conta duas vezes. Também *não entram* os PDVs com pedido ainda pendente de faturamento._'
      : '_Total = oficial da filial (igual à TV); a lista soma os vendedores mostrados._',
    E.nacional ? '❓ _Quer aberto por *supervisor* de alguma filial? É só pedir, ex.: "positivação TPH por supervisor"._' : !E.supervisor ? '❓ _Quer aberto por *vendedor* de algum supervisor? Ex.: "positivação do supervisor Nome"._' : ''].filter((x) => x !== '').join('\n');
}
export function respDevolucao(E, t = '') {
  // DEVOLUCAO DE HOJE (26/10/2026): notas com data de hoje, por filial/supervisor e vendedor
  // 'hoje' so quando colado em devolucao ('devolucao de hoje', 'hoje a devolucao'); 'hoje eu olhei... 3 milhoes de devolucao' e do MES
  if (/DEVOLU\w*\s+(DE\s+|DO\s+)?(HOJE|HJ)\b|\b(HOJE|HJ)\s+(\w+\s+){0,2}DEVOLU|ENTRADAS?\s+HOJE/.test(t) && !/MILH|COMO ASSIM/.test(t)) {
    const Vh = E.vend.filter((v) => v.devHoje > 0).sort((a, b) => b.devHoje - a.devHoje); const toth = E.vend.reduce((a, v) => a + (v.devHoje || 0), 0);
    const Gh = [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].map(([k, y]) => [k, y.V.reduce((a, v) => a + (v.devHoje || 0), 0)]).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]);
    if (!toth) return `↩️ *Devoluções de hoje — ${E.nome}*: nenhuma nota de devolução com data de hoje até agora.`;
    return [`↩️ *Devoluções de hoje — ${E.nome}*: *${R$(toth)}*`, `*Por ${E.nacional ? 'filial' : 'supervisor'}:*`, ...Gh.slice(0, 11).map(([k, x]) => `• ${E.nacional ? k : nome2(k)}: ${R$(x)}`),
      '*Vendedores:*', ...Vh.slice(0, 10).map((v) => `• ${nome2(v.nome)} (${v.rca}) ${E.nacional ? v.filial : ''}: ${R$(v.devHoje)}`)].join('\n');
  }
  const V = E.vend.filter((v) => v.dev > 0).sort((a, b) => b.dev - a.dev); const tot = E.vend.reduce((a, v) => a + v.dev, 0);
  const G = [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([, y]) => y.dev > 0).sort((a, b) => b[1].dev - a[1].dev);
  const notas = E.vend.flatMap((v) => v.devolucoes.map((d) => ({ ...d, vend: v.nome }))).filter((d) => d && (d.valor || d.vl_total || d.total));
  return [`↩️ *Devoluções no mês — ${E.nome}*: *${R$(tot)}*`, `*Por ${E.nacional ? 'filial' : 'supervisor'}:*`, ...G.slice(0, 10).map(([k, y]) => `• ${E.nacional ? k : nome2(k)}: ${R$(y.dev)}`), '*Vendedores com mais devolução:*', ...V.slice(0, 8).map((v) => `• ${vn(v)}${E.nacional ? ' ' + v.filial : ''}: ${R$(v.dev)}`),
    notas.length ? `_${notas.length} nota(s) detalhadas na base._` : '',
    '_Fonte: painel do CEVEN, só vendedores ativos. O GEROT mostra mais porque soma também devoluções lançadas em contas internas (ex.: VENDA EMPRESA) e códigos que não são de vendedor._', '', SUGESTAO + (V[0] ? `entender as devoluções de ${nome2(V[0].nome)} (${R$(V[0].dev)}).` : 'sem devoluções relevantes.')].filter(Boolean).join('\n');
}

// CHECK-IN / CHECK-OUT DA EQUIPE (26/10/2026, Anderson/TPA: "consegue relatorio de chek in e chek out da equipe" -> o JOTA recusou; Vitorio: "pq nao fornecer isso
// para os supervisores?"). Por vendedor, da rota de hoje (base): 1o check-in, ultimo check-out, visitas feitas, tempo somado dentro dos clientes. Detalhe cliente a
// cliente: "rota de hoje do <vendedor>".
export function respCheckinEquipe(E) {
  const seg = (x) => { const p = String(x || '').split(':').map(Number); return p.length >= 2 && p.every((n) => !isNaN(n)) ? p[0] * 3600 + p[1] * 60 + (p[2] || 0) : 0; };
  const hm = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  const L = [], semCheckin = [];
  for (const v of E.vend) {
    const R = (v.rotaHoje || []).filter((c) => !/FORA/i.test(String(c.status || '')));
    if (!R.length) continue;
    const ci = R.map((c) => c.checkin_horario).filter(Boolean).map((x) => String(x).slice(0, 5)).sort(), co = R.map((c) => c.checkout_horario).filter(Boolean).map((x) => String(x).slice(0, 5)).sort();
    if (!ci.length) { semCheckin.push(v); continue; }
    const dentro = R.reduce((a, c) => a + seg(c.tempo_visita), 0);
    L.push([ci[0], `• *${vn(v)}*: 1º check-in ${ci[0]} · último check-out ${co.length ? co[co.length - 1] : '—'} · ${ci.length} de ${R.length} visitas · ${hm(dentro)} dentro dos clientes`]);
  }
  if (!L.length && !semCheckin.length) return `📍 *${E.nome}* — ninguém da equipe tem rota de visitas hoje.`;
  return [`📍 *Check-in e check-out de hoje — ${E.nome}* (${hojeSP().slice(8, 10)}/${hojeSP().slice(5, 7)})`, ...L.sort((a, b) => a[0].localeCompare(b[0])).map((x) => x[1]),
    semCheckin.length ? `\n⚠️ *Sem nenhum check-in hoje:* ${semCheckin.map(vn).join(', ')}` : '', '', SUGESTAO + (semCheckin.length ? `ligar para ${vn(semCheckin[0])}: rota de hoje sem check-in.` : 'peça "rota de hoje do <vendedor>" para ver cliente a cliente, com os horários.')].filter((x) => x !== '').join('\n');
}

// ROTA DE HOJE: QUANTOS E QUEM AINDA NAO COMPROU NO MES (Vitorio, 27/10/2026: "quando perguntar quantos clientes na rota de hoje, pense que ele quer saber a
// quantidade e quais clientes nao compraram ainda esse mes... os outros ja compraram, se quiser a lista me pergunte... se ele quiser o +mix desses clientes
// pergunta apenas 'mais mix' e vc ja entende"). Comprou no mes = vendas item a item (ate ontem) + positivado hoje na rota. Dias sem compra = historico do +MIX.
export async function semCompraNaRota(B, v) {
  const mes = hojeSP().slice(0, 7), R0 = (v.rotaHoje || []).filter((c) => !/FORA/i.test(String(c.status || '')));
  const { vendasEscopo } = await import('./vendas.js');
  const VM = await vendasEscopo(B, { filiais: [v.filial], rca: v.rca, vend: [v] }).catch(() => null);
  const valorMes = new Map(); for (const l of ((VM && VM.linhas) || []).filter((l) => String(l.r) === String(v.rca))) valorMes.set(String(l.c), (valorMes.get(String(l.c)) || 0) + l.v);   /* R$ comprado no mes por cliente */
  const compraram = new Set(valorMes.keys());
  let H = {}; try { H = JSON.parse(await B.raw(`public/mix_hist/${v.filial}.json`) || '{}').c || {}; } catch (e) { H = {}; }
  const ult = (cnpj) => { const x = H[String(cnpj || '').replace(/\D/g, '')]; if (!x) return null; const m = String(x).split(',').map((p) => p.split(':')[1]).filter(Boolean).sort().pop(); return m ? `20${m.slice(0, 2)}-${m.slice(2, 4)}-${m.slice(4, 6)}` : null; };
  const vistos = new Set(), rota = [];
  for (const c of R0) { const k = String(c.id_cliente); if (vistos.has(k)) continue; vistos.add(k); rota.push(c); }
  const comprou = (c) => compraram.has(String(c.id_cliente)) || /POSITIVADO|EFETIVADO/i.test(String(c.status || '')) || String(c.data_ultima_compra || '').slice(0, 7) === mes;
  const sem = rota.filter((c) => !comprou(c)).map((c) => { const u = ult(c.cnpj); return { c, u, dias: u ? Math.round((Date.parse(hojeSP()) - Date.parse(u)) / 864e5) : null }; })
    .sort((a, b) => (b.dias ?? 999) - (a.dias ?? 999));
  return { rota, sem, valorMes };
}
export async function respRotaHojeResumo(B, E, v) {
  if (v) {
    const { rota, sem } = await semCompraNaRota(B, v);
    if (!rota.length) return `${vn(v)} (${v.filial}) não tem clientes na rota de hoje.`;
    return [`📋 *${vn(v)}* (${v.filial}) — *${rota.length} clientes* na rota de hoje.`, '',
      sem.length ? `Destes, *${sem.length} ainda não compraram no mês:*` : '✅ Todos já compraram no mês.', ...(sem.length ? ['_Cliente · Dias sem compra_'] : []),
      ...sem.slice(0, 25).map((x) => `${titulo(x.c.nome_cliente || x.c.razao_social || 'cliente')} · ${x.dias == null ? '+60 dias' : x.dias + ' dias'}`),   /* formato limpo (27/10/2026) */
      '', `Os outros *${rota.length - sem.length}* já compraram no mês; se quiser a lista, me pergunte.`, '', 'Boas vendas e foco no +MIX! _Peça "+mix" que eu trago o que oferecer para esses clientes._'].join('\n');
  }
  const L = [], tot = { r: 0, s: 0 };
  for (const x of E.vend) { const { rota, sem } = await semCompraNaRota(B, x); if (!rota.length) continue; tot.r += rota.length; tot.s += sem.length; L.push([sem.length, `• ${vn(x)}: ${rota.length} na rota · *${sem.length} sem compra no mês*`]); }
  if (!L.length) return `📋 *${E.nome}* — ninguém com clientes na rota de hoje.`;
  return [`📋 *Rota de hoje — ${E.nome}*: *${tot.r} clientes* · *${tot.s} ainda não compraram no mês*`, '', ...L.sort((a, b) => b[0] - a[0]).map((x) => x[1]), '',
    '_Peça "rota de hoje do <vendedor>" para ver quem são os clientes sem compra._', 'Boas vendas e foco no +MIX!'].join('\n');
}
// "+MIX" logo depois da rota de hoje: o que oferecer para os clientes da rota que ainda nao compraram no mes (lista do +MIX, a mesma do app)
export async function respMixRotaHoje(B, v) {
  // (Vitorio, 27/10/2026: "tinha que ser dos clientes dela que faltam... e talvez incluir dos que ja compraram algumas sugestoes simples dos itens que mais aparecem")
  const { rota, sem } = await semCompraNaRota(B, v);
  if (!rota.length) return `🧺 ${vn(v)} não tem clientes na rota de hoje.`;
  let M = {}; try { M = JSON.parse(await B.raw(`public/mix_rec/${v.filial}.json`) || '{}').clientes || {}; } catch (e) { M = {}; }
  const recDe = (c) => (M[String(c.cnpj || '').replace(/\D/g, '')] || {}).rec || [];
  const L = [`🧺 *+MIX — rota de hoje de ${vn(v)}* (${rota.length} clientes)`];
  if (sem.length) {
    L.push('', `*Ainda sem compra no mês (${sem.length}) — o que oferecer:*`);
    for (const x of sem.slice(0, 8)) { const r = recDe(x.c); L.push(`${titulo(x.c.nome_cliente || x.c.razao_social || 'cliente')}: ${r.length ? r.slice(0, 3).map(([, nome]) => titulo(nome)).join(' · ') : 'sem sugestão nova no +MIX'}`); }
  }
  // itens que mais aparecem nas listas do +MIX de TODOS os clientes da rota de hoje (inclusive quem ja comprou no mes): sugestao simples para levar
  const cont = new Map();
  for (const c of rota) for (const [cod, nome] of recDe(c).slice(0, 10)) { const k = String(cod); const x = cont.get(k) || { nome, n: 0 }; x.n++; cont.set(k, x); }
  const top = [...cont.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  if (top.length) L.push('', `*Para levar hoje (mais pedidos pelo +MIX nos ${rota.length} clientes da rota):*`, ...top.map((x) => `${titulo(x.nome)} · em ${x.n} cliente(s)`));
  if (!sem.length && !top.length) return `🧺 Todos os clientes da rota de hoje de ${vn(v)} já compraram no mês e o +MIX não tem sugestão nova para eles.`;
  return L.join('\n');
}

// CLIENTES DE RECORRENCIA E QUALQUER TAG / CAMPANHA (Vitorio, 28/10/2026: "consegue responder sobre todas as TAGS, certo? e não apenas recorrência... elas foram todas atualizadas agora").
// Tags conhecidas: RECORRENCIA, SEM COMPRAS P11, SEM COMPRAS LEAO, CAMPANHA BORGES, CHOCO INDEP, SNICKERS CORE, SNICKERS BRANCO, M&M,S CHOCO 40GR, M&M,S TUBO, TWIX 40GR, SKITTLES, TOFFEES, TORT, BISCUIT, BLOCK, BON, FLOW, CHAMP KITEKAT.
export function achaTagNaPergunta(t) {
  const s = sem(t);
  if (/RECORRENCIA/.test(s)) return { tag: 'RECORRENCIA', label: 'Recorrência', ehRec: true };
  if (/SEM COMPRAS? P1[01]|\bP10\b|\bP11\b/.test(s)) {
    const tem10 = /P10/.test(s), tem11 = /P11/.test(s);
    if (tem10 && tem11) return { tag: 'SEM COMPRAS P10|SEM COMPRAS P11|P10|P11', label: 'Sem Compras P10 e P11', ehRec: false };
    if (tem10) return { tag: 'SEM COMPRAS P10|P10', label: 'Sem Compras P10', ehRec: false };
    return { tag: 'SEM COMPRAS P11|P11', label: 'Sem Compras P11', ehRec: false };
  }
  if (/SEM COMPRAS? LEAO|SEM COMPRA LEAO/.test(s)) return { tag: 'SEM COMPRAS LEAO|LEAO', label: 'Sem Compras Leão', ehRec: false };
  if (/CAMPANHA BORGES|\bBORGES\b/.test(s)) return { tag: 'CAMPANHA BORGES|BORGES', label: 'Campanha Borges', ehRec: false };
  if (/CHOCO INDEP/.test(s)) return { tag: 'CHOCO INDEP', label: 'Choco Indep', ehRec: false };
  if (/SNICKERS CORE/.test(s)) return { tag: 'SNICKERS CORE', label: 'Snickers Core', ehRec: false };
  if (/SNICKERS BRANCO/.test(s)) return { tag: 'SNICKERS BRANCO', label: 'Snickers Branco', ehRec: false };
  if (/M&M|M AND M|MEM TUBO|M&M TUBO/.test(s)) return { tag: /TUBO/.test(s) ? 'M&M,S TUBO|TUBO' : 'M&M,S CHOCO 40GR|40GR', label: 'M&M', ehRec: false };
  if (/TWIX/.test(s)) return { tag: 'TWIX 40GR|TWIX', label: 'Twix 40g', ehRec: false };
  if (/SKITTLES/.test(s)) return { tag: 'SKITTLES', label: 'Skittles', ehRec: false };
  if (/TOFFEES/.test(s)) return { tag: 'TOFFEES', label: 'Toffees', ehRec: false };
  if (/CHAMP KITEKAT|KITEKAT/.test(s)) return { tag: 'CHAMP KITEKAT|KITEKAT', label: 'Champ Kitekat', ehRec: false };
  if (/BISCUIT/.test(s)) return { tag: 'BISCUIT', label: 'Biscuit', ehRec: false };
  if (/BLOCK/.test(s)) return { tag: 'BLOCK', label: 'Block', ehRec: false };
  if (/CHOCOLATE BON|\bBON\b/.test(s) && !/BOM DIA/.test(s)) return { tag: 'BON', label: 'Bon', ehRec: false };
  if (/FLOW/.test(s)) return { tag: 'FLOW', label: 'Flow', ehRec: false };
  return { tag: 'RECORRENCIA', label: 'Recorrência', ehRec: true };
}

export async function respTagCampanhas(B, E, v, t = '', c = null) {
  const tagInfo = achaTagNaPergunta(t);
  const padrao = tagInfo.tag.split('|').map((part) => part.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '.*?')).join('|');
  const tagRegex = new RegExp(padrao, 'i');
  const temTag = (cli) => (cli.focos || []).some((f) => tagRegex.test(sem(String(f.industria_foco || ''))));
  const mes = hojeSP().slice(0, 7), dd = (s) => (s && s >= '2000' ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—');
  const { vendasEscopo } = await import('./vendas.js'); const VM = await vendasEscopo(B, E).catch(() => null);
  const compraram = new Set(((VM && VM.linhas) || []).map((l) => l.f + '|' + l.c));
  const um = (x) => {
    const hoje = []; const vh = new Set();
    for (const cli of (x.rotaHoje || []).filter(temTag)) { if (vh.has(String(cli.id_cliente))) continue; vh.add(String(cli.id_cliente)); hoje.push(cli); }
    const mesC = new Map(); for (const cli of (x.roteiroMes || []).filter(temTag)) { const k = String(cli.id_cliente), u = String(cli.data_ultima_compra || '').slice(0, 10); const y = mesC.get(k) || { c: cli, u: '', comp: false }; if (u > y.u) y.u = u; if (/POSITIVADO|EFETIVADO/i.test(String(cli.status || ''))) y.comp = true; mesC.set(k, y); }
    for (const [k, y] of mesC) if (compraram.has(x.filial + '|' + k)) y.comp = true;
    for (const y of mesC.values()) if (y.comp) y.u = mes + '-01';
    const comprou = [...mesC.values()].filter((y) => y.comp).length, meta = Math.ceil(mesC.size * 0.8);
    return { hoje, mesC, comprou, meta };
  };
  const querListaCompleta = /LISTA COMPLETA|TODOS|TODAS|QUAIS|QUEM|QUERO A LISTA/.test(sem(t));
  if (!v && /QUANTOS/.test(t) && !/CADA|POR VENDEDOR|QUAIS|LISTA|QUEM/.test(t)) {
    let tag = 0, comp = 0; const hoje = [], porV = [];
    for (const x of E.vend) {
      const r = um(x); tag += r.mesC.size; comp += r.comprou;
      for (const cli of r.hoje) if (!(r.mesC.get(String(cli.id_cliente)) || {}).comp) {
        hoje.push(`• ${titulo(cli.nome_cliente || cli.razao_social || 'cliente')} — *${vn(x)}*`);
      }
      if (r.mesC.size) {
        porV.push([r.mesC.size - r.comprou, `• ${vn(x)}: mês *${r.comprou} de ${r.mesC.size}*` + (tagInfo.ehRec ? ` (meta ${r.meta})` : '') + (r.hoje.length ? ` · hoje *${r.hoje.length}* na rota` : '')]);
      }
    }
    const meta = Math.ceil(tag * 0.8);
    return [
      `🔄 *Tag: ${tagInfo.label} — ${E.nome}*`,
      `*${tag} clientes* com a tag no mês · já compraram *${comp}*` + (tagInfo.ehRec ? ` · faltam *${Math.max(0, meta - comp)}* para a meta da Premiação (${meta} = 80%)` : ` (${tag ? Math.round(comp / tag * 100) : 0}% positivados)`),
      '',
      hoje.length ? `📍 *Na rota de hoje e ainda sem compra (${hoje.length}):*\n` + hoje.join('\n') : `📍 Nenhum cliente com a tag sem compra na rota de hoje.`,
      '',
      `👥 *Por vendedor:*`,
      ...porV.sort((a, b) => b[0] - a[0]).map((x) => x[1]),
      '',
      SUGESTAO + (hoje.length ? `cobrar hoje os ${hoje.length} clientes da rota com os vendedores acima; ` : '') + `peça "tag ${tagInfo.label} do vendedor <nome>" para ver a lista completa de clientes dele.`
    ].join('\n');
  }
  if (v) {
    const r = um(v);
    if (!r.hoje.length && !r.mesC.size) return `🔄 ${vn(v)}: nenhum cliente com a tag *${tagInfo.label}* no roteiro (hoje e no mês).`;
    const hj = new Set(r.hoje.map((cli) => String(cli.id_cliente)));
    const naoMes = [...r.mesC.values()].filter((y) => !(y.u >= mes + '-01') && !hj.has(String(y.c.id_cliente)));
    const jaComp = [...r.mesC.values()].filter((y) => y.u >= mes + '-01');
    const limite = querListaCompleta ? 50 : 10;
    return [`🔄 *Tag: ${tagInfo.label} — ${vn(v)}*`,
      `Mês: *${r.comprou} de ${r.mesC.size}* clientes compraram` + (tagInfo.ehRec ? ` (meta = 80% = ${r.meta} · faltam ${Math.max(0, r.meta - r.comprou)})` : ` (${r.mesC.size ? Math.round(r.comprou / r.mesC.size * 100) : 0}%)`),
      ...(r.hoje.length ? ['', `*Na rota de hoje (${r.hoje.length}):*`, '_Cliente · Status · Última compra_', ...r.hoje.map((cli) => `${titulo(cli.nome_cliente || cli.razao_social || 'cliente')} · ${titulo(String(cli.status || 'aberto'))} · ${dd(String(cli.data_ultima_compra || '').slice(0, 10))}`)] : ['', '_Nenhum cliente dessa tag na rota de hoje._']),
      ...(naoMes.length ? ['', `*Ainda sem compra no mês (${naoMes.length}):*`, '_Cliente · Última compra_', ...naoMes.slice(0, limite).map((y) => `${titulo(y.c.nome_cliente || y.c.razao_social || 'cliente')} · ${dd(y.u)}`), ...(naoMes.length > limite ? [`… e mais ${naoMes.length - limite} clientes. Peça "lista completa" para ver mais.`] : [])] : []),
      ...(querListaCompleta && jaComp.length ? ['', `*Já compraram no mês (${jaComp.length}):*`, ...jaComp.slice(0, 30).map((y) => `✅ ${titulo(y.c.nome_cliente || y.c.razao_social || 'cliente')} · comprado`)] : [])
    ].join('\n');
  }
  const L = []; let tH = 0, tC = 0, tM = 0, tT = 0;
  const porSup = new Map();
  for (const x of E.vend) {
    const r = um(x); if (!r.hoje.length && !r.mesC.size) continue;
    tH += r.hoje.length; tC += r.comprou; tM += r.meta; tT += r.mesC.size;
    L.push([r.hoje.length, `• ${vn(x)}: hoje *${r.hoje.length}* na rota · mês ${r.comprou} de ${r.mesC.size}`]);
    const supK = x.supervisor || 'Sem Supervisor';
    const sObj = porSup.get(supK) || { nome: supK, cod: x.supCod || '', filial: x.filial, hoje: 0, comp: 0, total: 0, vends: [] };
    sObj.hoje += r.hoje.length; sObj.comp += r.comprou; sObj.total += r.mesC.size;
    sObj.vends.push({ v: x, r });
    porSup.set(supK, sObj);
  }
  if (!tH && !tT) return `🔄 *${E.nome}*: nenhum cliente com a tag *${tagInfo.label}* no roteiro.`;

  // VISÃO EXECUTIVA (Gerente / Diretoria, 28/10/2026): hierarquia gerencial é SUPERVISOR -> VENDEDOR!
  if (porSup.size > 1) {
    const cargo = c && c.papel === 'gerente' ? 'Gerente ' : c && c.papel === 'diretoria' ? 'Diretor ' : '';
    const nomeTrat = c && c.nome ? `${cargo}${titulo(String(c.nome).split(' ')[0])}` : (cargo || 'Gerente');
    const linhasSup = [...porSup.values()].sort((a, b) => b.hoje - a.hoje).map((s) => {
      const codStr = s.cod ? `${s.cod} - ` : '';
      return `• *${codStr}${nome2(s.nome)}:* hoje *${s.hoje}* na rota (${s.vends.length} vendedores) · mês ${s.comp} de ${s.total}`;
    });

    return [
      `🔄 *Tag: ${tagInfo.label} — ${E.nome}*`,
      `Caro ${nomeTrat}, aqui está o *consolidado por supervisor* (${porSup.size} equipes com *${tH} clientes* na rota de hoje · mês: ${tC} de ${tT} compraram):`,
      '',
      `👥 *Consolidado por Supervisor:*`,
      ...linhasSup,
      '',
      `📲 *Como agir agora:*`,
      `• Se quiser aberto por supervisor / vendedor, digite *1* que te mando uma mensagem por supervisor para você encaminhar ao time no WhatsApp!`,
      `• Ou peça "clientes do supervisor <nome>" para ver a lista de uma equipe específica agora.`
    ].join('\n');
  }

  return [`🔄 *Tag: ${tagInfo.label} — ${E.nome}*`, `Hoje na rota: *${tH} clientes* com a tag · Mês: *${tC} de ${tT}* compraram`, '', ...L.sort((a, b) => b[0] - a[0]).map((x) => x[1]), '', `_Peça "${tagInfo.label} do vendedor <nome>" para ver os clientes._`].join('\n');
}

// GERA MENSAGENS SEPARADAS POR SUPERVISOR (quando o gerente/diretoria digita 1)
export async function respTagSeparadoPorSupervisor(B, E, t = '') {
  const tagInfo = achaTagNaPergunta(t);
  const padrao = tagInfo.tag.split('|').map((part) => part.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '.*?')).join('|');
  const tagRegex = new RegExp(padrao, 'i');
  const temTag = (cli) => (cli.focos || []).some((f) => tagRegex.test(sem(String(f.industria_foco || ''))));
  const porSup = new Map();
  for (const x of E.vend) {
    const hoje = (x.rotaHoje || []).filter(temTag);
    if (!hoje.length) continue;
    const supK = x.supervisor || 'Sem Supervisor';
    const sObj = porSup.get(supK) || { nome: supK, cod: x.supCod || '', filial: x.filial, totalHoje: 0, vends: [] };
    sObj.totalHoje += hoje.length;
    sObj.vends.push({ v: x, clientes: hoje });
    porSup.set(supK, sObj);
  }
  if (!porSup.size) return `🔄 Não encontrei clientes na rota de hoje com a tag *${tagInfo.label}* em ${E.nome}.`;
  const msgs = [];
  for (const s of [...porSup.values()].sort((a, b) => b.totalHoje - a.totalHoje)) {
    const codStr = s.cod ? `COD ${s.cod} - ` : '';
    const linhas = [
      `📋 *Equipe ${codStr}${nome2(s.nome)} (${s.filial})*`,
      `Tag: *${tagInfo.label}* · *${s.totalHoje} clientes* na rota de hoje para positivar:`,
      ''
    ];
    for (const item of s.vends) {
      linhas.push(`🧑‍💼 *${vn(item.v)}* (${item.clientes.length}):`);
      for (const cli of item.clientes.slice(0, 15)) {
        linhas.push(`  • ${titulo(cli.nome_cliente || cli.razao_social || 'cliente')} (#${cli.id_cliente || ''})`);
      }
      if (item.clientes.length > 15) linhas.push(`  … e mais ${item.clientes.length - 15} clientes`);
      linhas.push('');
    }
    linhas.push('_Encaminhe para o supervisor cobrar o time agora! 🚀_');
    msgs.push(linhas.join('\n').trim());
  }
  return msgs.join('\n⟪⟫\n');
}
export const respRecorrenciaClientes = respTagCampanhas;

// ROTA DE HOJE COMPLETA (Vitorio, 27/10/2026: "quando quero saber da rota e importante saber quem ja comprou ou nao, se tem tag como recorrencia etc"; Marcio/ABC:
// "quais clientes a Nilva vai visitar hoje" vinha so com ABERTO). Cada cliente: status da visita · comprou no mes (ou dias sem compra) · tags do roteiro.
export async function respRotaHojeCompleta(B, v, soSemCompra = false) {
  // FORMATO COMPACTO (Vitorio, 27/10/2026: "ficou confuso... mini legenda no inicio, separar quem nao comprou e quem ja comprou, foco em quem nao comprou...
  // Nome · ⏳ · ❌ 28 dias · 🏷️ 1 ou 2 tags"; quem ja comprou: "Nome · ⏳ · ✔️ (R$) · 🏷️").
  const { rota, sem: semC, valorMes } = await semCompraNaRota(B, v);
  if (!rota.length) return `${vn(v)} (${v.filial}) não tem clientes na rota de hoje.`;
  const semMap = new Map(semC.map((x) => [String(x.c.id_cliente), x]));
  // tags: Recorrencia primeiro (e a que conta na Premiacao), depois as outras; no maximo 2
  const tags = (c) => { const T = [...new Set((c.focos || []).map((f) => titulo(String(f.industria_foco || '').trim())).filter(Boolean))].sort((a, b) => (/Recorrencia/i.test(b) ? 1 : 0) - (/Recorrencia/i.test(a) ? 1 : 0)); return T.slice(0, 2).join(', '); };
  const st = (c) => { const s = String(c.status || '').toUpperCase(); return /POSITIVADO|EFETIVADO/.test(s) ? '✅' : /VISITADO|JUSTIFICADO/.test(s) ? '👣' : '⏳'; };
  const nome = (c) => titulo(c.nome_cliente || c.razao_social || 'cliente');
  const nao = rota.filter((c) => semMap.has(String(c.id_cliente))), ja = rota.filter((c) => !semMap.has(String(c.id_cliente)));
  const linhaNao = (c) => { const x = semMap.get(String(c.id_cliente)), tg = tags(c); return `${nome(c)} · ${st(c)} · ❌ ${x.dias == null ? '+60' : x.dias} dias` + (tg ? ` · 🏷️ ${tg}` : ''); };
  const linhaJa = (c) => { const r = valorMes.get(String(c.id_cliente)), tg = tags(c); return `${nome(c)} · ${st(c)} · ✔️${r ? ' ' + R$(r) : ''}` + (tg ? ` · 🏷️ ${tg}` : ''); };
  return [`📋 *${vn(v)}* (${v.filial}) — rota de hoje: *${rota.length} clientes* · *${nao.length} ainda sem compra no mês*`,
    '_⏳ a visitar · 👣 visitado · ✅ vendeu hoje · ❌ sem compra (dias) · ✔️ já comprou no mês (R$) · 🏷️ tags_',
    ...(nao.length ? ['', `*Ainda não compraram no mês (${nao.length}):*`, ...nao.map(linhaNao)] : ['', '✅ Todos da rota de hoje já compraram no mês.']),
    ...(!soSemCompra && ja.length ? ['', `*Já compraram no mês (${ja.length}):*`, ...ja.sort((a, b) => (valorMes.get(String(b.id_cliente)) || 0) - (valorMes.get(String(a.id_cliente)) || 0)).map(linhaJa)] : []),
    '', 'Boas vendas! _Peça "+mix" para o que oferecer a quem não comprou._'].join('\n');
}

// "CLIENTES DO VENDEDOR" (Vitorio, 27/10/2026: "perguntei apenas sobre clientes... o que acha que eu quero saber? se ele comprou ou nao, se nao comprou a quantos dias
// e se ja visitei... e os que ja compraram, quantos"; "clientes tamara ontem" vinha so com o total; "acumulado" vinha o resumo do vendedor).
// periodo: 'hoje' (rota de hoje), 'ontem' (rota do ultimo dia com venda) ou 'mes' (carteira do mes). Sem dado novo: so base (roteiro, vendas item a item, historico +MIX).
export async function respClientesVend(B, v, periodo) {
  const { vendasEscopo } = await import('./vendas.js');
  const VM = await vendasEscopo(B, { filiais: [v.filial], rca: v.rca, vend: [v] }).catch(() => null);
  const Lv = ((VM && VM.linhas) || []).filter((l) => String(l.r) === String(v.rca));
  const porCli = new Map(); for (const l of Lv) { const x = porCli.get(String(l.c)) || { v: 0, dias: new Set() }; x.v += l.v; x.dias.add(l.d); porCli.set(String(l.c), x); }
  let H = {}; try { H = JSON.parse(await B.raw(`public/mix_hist/${v.filial}.json`) || '{}').c || {}; } catch (e) { H = {}; }
  const ultH = (cnpj) => { const x = H[String(cnpj || '').replace(/\D/g, '')]; if (!x) return null; const m = String(x).split(',').map((p) => p.split(':')[1]).filter(Boolean).sort().pop(); return m ? `20${m.slice(0, 2)}-${m.slice(2, 4)}-${m.slice(4, 6)}` : null; };
  const diasSem = (c) => { const u = ultH(c.cnpj); return u ? Math.round((Date.parse(hojeSP()) - Date.parse(u)) / 864e5) + ' dias' : '+60 dias'; };
  const nome = (c) => titulo(c.nome_cliente || c.razao_social || 'cliente');
  const visitou = (c) => !!c.checkin_horario || /VISITADO|JUSTIFICADO|POSITIVADO|EFETIVADO/i.test(String(c.status || ''));
  const comprouMes = (c) => porCli.has(String(c.id_cliente)) || /POSITIVADO|EFETIVADO/i.test(String(c.status || ''));
  const carteira = new Map(); for (const c of v.roteiroMes || []) { const k = String(c.id_cliente); if (!carteira.has(k)) carteira.set(k, c); }
  const nComp = [...carteira.values()].filter(comprouMes).length;
  // dois numeros, cada um com o que e (27/10/2026): positivacao do CEVEN = clientes com FATURAMENTO; carteira com pedido = inclui pedido ainda nao faturado
  const cab = `👥 Positivação (CEVEN, faturado): *${v.pos ?? '—'} de ${v.metaPos ?? '—'}* · com pedido no mês: *${nComp} de ${carteira.size}* da carteira`;
  if (periodo === 'mes') {
    const comp = [...carteira.values()].filter(comprouMes).map((c) => ({ c, r: (porCli.get(String(c.id_cliente)) || { v: 0 }).v })).sort((a, b) => b.r - a.r);
    const nao = [...carteira.values()].filter((c) => !comprouMes(c));
    return [`👥 *Clientes no mês — ${vn(v)}* (${v.filial})`, cab, '',
      `*Já compraram (${comp.length})* — os que mais compraram:`, '_Cliente · Comprado no mês_', ...comp.slice(0, 8).map((x) => `${nome(x.c)} · ${R$(x.r)}`), '',
      `*Ainda não compraram (${nao.length}):*`, '_Cliente · Visitado no mês? · Dias sem compra_', ...nao.slice(0, 8).map((c) => `${nome(c)} · ${visitou(c) ? 'sim' : 'não'} · ${diasSem(c)}`), '',
      '_Peça "ver mais" ou "curva negativa do vendedor" para a lista completa._'].join('\n');
  }
  if (periodo === 'ontem') {
    const ult = Lv.reduce((m, l) => Math.max(m, l.d), 0); if (!ult) return `${vn(v)}: sem venda item a item na base para ontem.`;
    const dia = `${String(ult).slice(0, 4)}-${String(ult).slice(4, 6)}-${String(ult).slice(6, 8)}`;
    const rota = []; const vis = new Set(); for (const c of v.roteiroMes || []) if (String(c.data_visita || '').slice(0, 10) === dia && !vis.has(String(c.id_cliente))) { vis.add(String(c.id_cliente)); rota.push(c); }
    const doDia = new Map(); for (const l of Lv.filter((l) => l.d === ult)) doDia.set(String(l.c), (doDia.get(String(l.c)) || 0) + l.v);
    const fora = [...doDia.keys()].filter((k) => !vis.has(k));
    const L = rota.map((c) => { const r = doDia.get(String(c.id_cliente)); return [r ? 0 : 1, `${nome(c)} · ${r ? '✅ comprou ' + R$(r) : visitou(c) ? '👣 visitado, sem venda' : '⏳ não visitado'} · ${comprouMes(c) ? 'já comprou no mês' : '❌ sem compra no mês (' + diasSem(c) + ')'}`]; }).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    return [`📋 *Rota de ${dIsoBR(dia)} — ${vn(v)}* (${v.filial}): *${rota.length} clientes* · *${rota.filter((c) => doDia.has(String(c.id_cliente))).length} compraram* · total ${R$([...doDia.values()].reduce((a, b) => a + b, 0))}`,
      cab, '', '_Cliente · Resultado do dia · Compra no mês_', ...L, ...(fora.length ? ['', `_+ ${fora.length} cliente(s) compraram fora da rota nesse dia._`] : [])].join('\n');
  }
  const r = await respRotaHojeCompleta(B, v, false);
  return r.replace('\n', '\n' + cab + '\n');
}
const dIsoBR = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

// "COMO ESTA O DIA DA MINHA EQUIPE" (Vitorio, 27/10/2026: "uma mensagem so, uma linha por vendedor focada na rota... e coloca a sugestao no final explicando o que
// fazer"). Ordem: quem mais precisa de atencao primeiro (sem pedido com rota, depois menos visitas feitas).
export async function respDiaEquipe(B, E) {
  const V = E.vend.filter((v) => v.varejo && v.visP > 0);
  const outros = E.vend.filter((v) => !(v.varejo && v.visP > 0));
  if (!V.length && !outros.length) return `📋 *${E.nome}* — ninguém com rota hoje.`;
  const L = [];
  for (const v of V) {
    let semMes = null; try { semMes = (await semCompraNaRota(B, v)).sem.length; } catch (e) { semMes = null; }
    const icone = !v.ped ? '⚠️' : v.visF >= v.visP ? '✅' : '🟡';
    L.push([!v.ped ? 0 : 1, v.visP ? v.visF / v.visP : 1, `${icone} *${vn(v)}* · ${v.visF}/${v.visP} visitas · ${v.comVenda} com venda · ${R$(v.dig)}` + (semMes != null ? ` · ${semMes} sem compra no mês` : '')]);
  }
  L.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const tot = V.reduce((a, v) => ({ f: a.f + v.visF, p: a.p + v.visP, d: a.d + v.dig, z: a.z + (v.ped ? 0 : 1) }), { f: 0, p: 0, d: 0, z: 0 });
  const totGeral = E.vend.reduce((s, v) => s + (v.dig || 0), 0);
  const as = outros.filter((v) => v.dig > 0 || v.ped > 0 || v.meta > 0).sort((a, b) => b.dig - a.dig);
  const totAS = outros.reduce((s, v) => s + (v.dig || 0), 0);
  const digTxt = outros.length && totAS > 0 ? `digitado *${R$(totGeral)}* (varejo ${R$(tot.d)} · AS ${R$(totAS)})` : `digitado *${R$(totGeral)}*`;
  return [`📋 *Dia da ${E.nome}* (${hojeSP().slice(8, 10)}/${hojeSP().slice(5, 7)})`, `Rota do varejo: *${tot.f} de ${tot.p}* visitas · ${digTxt} · *${tot.z}* vendedor(es) com rota e sem pedido`,
    '_⚠️ sem pedido · 🟡 rota em andamento · ✅ rota feita_', '', ...L.map((x) => x[2]),
    ...(as.length ? ['', `*AS e outros canais:* ` + as.map((v) => `${vn(v)} ${R$(v.dig)}`).join(' · ')] : []),
    '', SUGESTAO + (tot.z ? `comece pelos ⚠️ (rota e sem pedido). ` : '') + 'Para abrir um vendedor, mande o *nome* ou o *código* (ex.: "clientes 352"); para o *+MIX* da rota dele, depois mande "+mix"; para receber *cada vendedor em uma mensagem*, mande "um por um".'].join('\n');
}

// VENDEDORES SEM NENHUMA VISITA HOJE, na hierarquia (Vitorio, 27/10/2026: "so queria saber os sem nenhuma visita ainda... como sou da diretoria, teria que mostrar
// a hierarquia filial, supervisor, vendedor"; Evandro: "lista completa dos vendedores sem visita, hoje, por filial")
export function respSemVisita(E) {
  const V = E.vend.filter((v) => v.varejo && v.visP > 0 && !v.visF);
  if (!V.length) return `✅ *${E.nome}*: todo vendedor com rota hoje já fez pelo menos uma visita.`;
  const porF = new Map(); for (const v of V) { const f = porF.get(v.filial) || new Map(); const s = v.supervisor || 'sem supervisor'; (f.get(s) || f.set(s, []).get(s)).push(v); porF.set(v.filial, f); }
  const L = [`🚶 *Sem nenhuma visita hoje — ${E.nome}*: *${V.length}* vendedor(es) com rota (${hojeSP().slice(8, 10)}/${hojeSP().slice(5, 7)})`];
  for (const [f, S] of [...porF].sort((a, b) => [...b[1].values()].flat().length - [...a[1].values()].flat().length)) {
    if (E.nacional) L.push('', `*${f}* (${[...S.values()].flat().length})`);
    for (const [s, vs] of S) L.push(`${E.nacional ? '  ' : ''}_${sn(s)}_: ` + vs.map((v) => `${vn(v)} (0/${v.visP})`).join(' · '));
  }
  L.push('', SUGESTAO + 'ligar para os supervisores com mais vendedores parados; peça "clientes <vendedor>" para ver a rota de um.');
  return L.join('\n');
}

// CLIENTES NA ROTA DE HOJE, VISITADOS E SEM VENDA, PARADOS HA MAIS DE N DIAS (Vitorio, 27/10/2026: "quantos e quais clientes que nao compram a mais de 30 dias tem na
// rota hoje e o vendedor ja visitou e nao vendeu?") — do escopo (filial/equipe) ou do vendedor
export async function respRotaFiltro(B, E, t) {
  const n = Number((t.match(/(\d{1,3})\s*DIAS/) || [])[1]) || 30, soVisitados = /VISITOU|VISITAD|JA PASSOU/.test(t);
  const L = []; let tot = 0;
  for (const v of E.vend.filter((x) => (x.rotaHoje || []).length)) {
    const { sem: S } = await semCompraNaRota(B, v);
    const ok = S.filter((x) => (x.dias == null || x.dias > n) && (!soVisitados || !!x.c.checkin_horario || /VISITADO|JUSTIFICADO/i.test(String(x.c.status || ''))) && !/POSITIVADO|EFETIVADO/i.test(String(x.c.status || '')));
    if (!ok.length) continue; tot += ok.length;
    L.push('', `*${vn(v)}* — ${ok.length}`, ...ok.map((x) => `${titulo(x.c.nome_cliente || x.c.razao_social || 'cliente')} · ${x.dias == null ? '+60' : x.dias} dias`));
  }
  const cab = `📋 *${E.nome}* — clientes na rota de hoje${soVisitados ? ', já visitados e sem venda,' : ''} parados há mais de ${n} dias: *${tot}*`;
  return tot ? [cab, '_Cliente · Dias sem compra_', ...L].join('\n') : cab.replace(/: \*0\*$/, ': nenhum agora.');
}
