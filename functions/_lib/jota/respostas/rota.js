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
  const as = /\bAS\b|ATACADO/.test(t);
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
  return [`👥 *Positivação — ${E.nome}* (clientes com faturamento no mês)`, `*${N(x.pos)} de ${N(x.metaPos)}* (${P(x.pos, x.metaPos)}) · faltam ${N(Math.max(0, x.metaPos - x.pos))} → ${N(Math.ceil(Math.max(0, x.metaPos - x.pos) / Math.max(dn, 1)))} por dia útil`, '',
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
