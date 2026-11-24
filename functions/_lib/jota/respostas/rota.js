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
  const linha = (c) => `• ${titulo(c.nome_cliente || c.razao_social || 'cliente')} (#${c.id_cliente}) — ${st(c) || 'sem status'}` + (c.checkin_horario ? ` · ${c.checkin_horario}–${c.checkout_horario || '…'}${(() => { if (c.tempo_visita) return ` (${c.tempo_visita})`; const a = String(c.checkin_horario).match(/^(\d{1,2}):(\d{2})/), b = String(c.checkout_horario || '').match(/^(\d{1,2}):(\d{2})/); if (!a || !b) return ''; const m = (+b[1] * 60 + +b[2]) - (+a[1] * 60 + +a[2]); return m >= 0 ? ` (${m} min)` : ''; })()}` : '') + (c.motivo_nao_visita ? ` · motivo: *${titulo(c.motivo_nao_visita)}*` : '') + (c.observacao_nao_visita ? ` · obs.: "${c.observacao_nao_visita}"` : '');
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
  const cli = (c, i) => `${i + 1}. ${titulo(c.nome_cliente || c.razao_social || 'cliente ' + c.id_cliente)} (#${c.id_cliente}) · ${dias(c)}` + (Array.isArray(c.focos) && c.focos.length ? ' · ' + c.focos.map((f) => f.industria_foco).join('/') : '');
  if (pessoa && pessoa.tipo === 'vend') {
    const v = pessoa.alvo; if (!v.varejo && !(v.aVisitar || []).length && !(v.rotaHoje || []).length) return `${v.rca} - ${titulo(v.nome)} (${v.canal || 'sem canal'}) não tem roteiro de visitas hoje.`;
    const A = v.aVisitar;
    // 18/11/2026: formato combinado (legenda no topo; embaixo so emoji/numero de dias sem compra)
    const dN = (c) => { const d = String(c.data_ultima_compra || '').slice(0, 10); return d ? Math.max(0, Math.round((Date.parse(hojeSP()) - Date.parse(d)) / 864e5)) : null; };
    return [`📍 *${v.rca} - ${titulo(v.nome)}* (${v.filial}) — faltam *${A.length}* de ${(v.rotaHoje || []).length} na rota de hoje · ${v.visF} visitada(s)`, A.length ? '_⏳ a visitar · nº = dias sem compra · 🆕 sem compra registrada · 🏷️ tag_' : '', ...A.sort((x, y) => (dN(y) ?? 9999) - (dN(x) ?? 9999)).slice(0, 30).map((c, i) => `${i + 1}. ${titulo(c.nome_cliente || c.razao_social || 'cliente ' + c.id_cliente)} (#${c.id_cliente}) · ⏳ · ${diasTxt(dN(c))}${tagsCurtas(c)}`), A.length > 30 ? `… e mais ${A.length - 30}` : '',
      '', A.length ? SUGESTAO + `começar pelos parados há mais tempo e pelos com tag de campanha. _Digite o número para abrir o cliente._` : SUGESTAO + 'rota de hoje concluída.'].filter((x) => x !== '').join('\n');
  }
  // VISUALIZAR E TUDO (Vitorio, 26/10/2026: "varejo entra para a cobranca... para visualizar e tudo"): AS e qualquer canal com roteiro entram nesta lista
  const V = E.vend.filter((v) => (v.rotaHoje || []).length && (!pessoa || (v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial)));
  const naRota = (v) => (v.rotaHoje || []).filter((c) => !/FORA/i.test(String(c.status || '')));
  const visitou = (c) => !!c.checkin_horario || /VISITADO|JUSTIFICADO|POSITIVADO|EFETIVADO/i.test(String(c.status || ''));
  const tot = V.reduce((a, v) => a + v.aVisitar.length, 0), prog = V.reduce((a, v) => a + naRota(v).length, 0), feitas = V.reduce((a, v) => a + naRota(v).filter(visitou).length, 0);
  const nome = pessoa ? titulo(pessoa.alvo.nome) + ' (' + pessoa.alvo.filial + ')' : E.nome;
  const L = [`📍 *Rota de hoje — ${nome}*`, `Clientes na rota: *${N(prog)}* · visitados: *${N(feitas)}* · *faltam ${N(tot)}*`, ''];
  if (E.nacional && !pessoa) {
    for (const [f, x] of [...agrupa(V, (v) => v.filial)].map(([f, x]) => [f, x.V.reduce((a, v) => a + v.aVisitar.length, 0)]).sort((a, b) => b[1] - a[1])) L.push(`• ${f}: faltam ${x}`);
  } else {
    const vendsComFalta = V.filter((v) => v.aVisitar.length).sort((a, b) => b.aVisitar.length - a.aVisitar.length);
    let idxAV = 0;
    for (const v of vendsComFalta.slice(0, 15)) {
      L.push(`*${vn(v)}* — faltam *${v.aVisitar.length}* de ${naRota(v).length}:`);
      for (const c of v.aVisitar.slice(0, 10)) {
        L.push(`  ${cli(c, idxAV++)}`);
      }
      if (v.aVisitar.length > 10) L.push(`  … e mais ${v.aVisitar.length - 10} cliente(s)`);
      L.push('');
    }
  }
  const pior = V.slice().sort((a, b) => b.aVisitar.length - a.aVisitar.length)[0];
  L.push(pior && pior.aVisitar.length ? SUGESTAO + `${nome2(pior.nome)} tem ${pior.aVisitar.length} clientes por visitar.` : SUGESTAO + 'rota do dia concluída.');
  return L.join('\n');
}
// ZERADOS (Vitorio, 17/11/2026: "zerados tem que mostrar TODOS do varejo... sem visita separado para dar mais visibilidade, e penalti pior que tudo...
// nao vender e uma coisa, nao visitar e pior de tudo... dos visitados, quantos clientes estao sem venda a mais de 30 dias, e a opcao de ver eles").
// Ordem: 1) SEM NENHUMA VISITA (o pior) 2) TODOS os zerados do varejo (visitou e nao vendeu), com quantos clientes visitados hoje estao 30+ dias sem comprar
// (Clube: justificativa do dia com dias sem comprar). Sem corte de lista. Detalhe dos clientes: "visitados sem compra 30 dias".
async function justif30(B, E) {
  const M = new Map(); if (!B || !B.env || !B.env.DB) return M;
  try {
    const fil = E.filiais && E.filiais.length ? E.filiais : [...new Set(E.vend.map((v) => v.filial))];
    const { results } = await B.env.DB.prepare(`SELECT filial, rca, cliente, fantasia, razao, dias_sem_comprar d, motivo, obs FROM clube_justificativa WHERE dia = ? AND filial IN (${fil.map(() => '?').join(',')}) AND CAST(dias_sem_comprar AS INTEGER) > 30 ORDER BY CAST(dias_sem_comprar AS INTEGER) DESC`).bind(hojeSP(), ...fil).all();
    for (const r of results || []) { const k = r.filial + '|' + r.rca; if (!M.has(k)) M.set(k, []); if (!M.get(k).some((x) => String(x.cliente) === String(r.cliente))) M.get(k).push(r); }
  } catch (e) { /* sem Clube: sem a contagem */ }
  return M;
}
export async function respZerados(E, B = null) {
  const VJ = E.vend.filter((v) => v.varejo && pessoaReal(v));
  const SV = VJ.filter((v) => v.zerado && v.semVisita), Z = VJ.filter((v) => v.zerado && !v.semVisita), FORA = VJ.filter((v) => v.semVisita && v.vendeuHoje);
  if (!Z.length && !SV.length) return `✅ *Zerados hoje — ${E.nome}: 0.* Todo o varejo com rota já vendeu hoje.${FORA.length ? `\n\nℹ️ _Fora dos zerados: *${FORA.length}* vendedor(es) já venderam hoje (fora da rota), sem check-in na rota. Escreva *sem visita* para ver._` : ''}`;
  const J = await justif30(B, E), j30 = (v) => (J.get(v.filial + '|' + v.rca) || []).length;
  const L = [`⚠️ *Zerados hoje — ${E.nome}* (varejo com rota)`, `🚨 Sem nenhuma visita: *${SV.length}* · 🟡 visitou e não vendeu: *${Z.length}*`];
  const bloco = (lista, fmt) => { const G = [...agrupa(lista, (v) => supChave(v, E.nacional))].sort((a, b) => b[1].V.length - a[1].V.length); for (const [k, x] of G) { L.push(`*${supNome(k)}* (${x.V.length}):`); for (const v of x.V) L.push(fmt(v)); } };
  if (SV.length) {
    L.push('', `🚨 *SEM NENHUMA VISITA E SEM VENDA (${SV.length})* — o pior: rota parada`);
    bloco(SV, (v) => `• ${vn(v)} · 0 de ${v.visP} clientes`);
  }
  if (Z.length) {
    L.push('', `🟡 *VISITOU E NÃO VENDEU (${Z.length})*`);
    bloco(Z, (v) => `• ${vn(v)} · ${v.visF} de ${v.visP} visitas${j30(v) ? ` · *${j30(v)} visitado(s) há 30+ dias sem comprar*` : ''}`);
  }
  const tot30 = VJ.reduce((a, v) => a + j30(v), 0), z30 = Z.reduce((a, v) => a + j30(v), 0);
  if (tot30) L.push('', `📌 No varejo de ${E.nome}, *${tot30} cliente(s)* visitados hoje estão há mais de 30 dias sem comprar${z30 ? ` (${z30} deles com os zerados acima)` : ''}. Escreva *visitados sem compra* para ver quem são e o que fazer.`);
  if (FORA.length) L.push('', `ℹ️ _Fora dos zerados: *${FORA.length}* vendedor(es) já venderam hoje (fora da rota), sem check-in na rota. Escreva *sem visita* para ver._`);
  const pior = SV.length ? SV : Z;
  L.push('', SUGESTAO + (SV.length ? `ligar agora para quem está sem nenhuma visita: ${listaNomes(SV, 3)}.` : `começar pelos zerados com cliente parado: ${listaNomes(Z.slice().sort((a, b) => j30(b) - j30(a)), 3)}.`));
  void pior;
  return L.join('\n');
}
// O QUE FAZER COM O CLIENTE VISITADO QUE NAO COMPRA HA 30+ DIAS: acao pelo motivo que o vendedor registrou no Clube (regra fixa, sem inventar)
const ACAO_MOTIVO = [
  [/ESTOQUE/, 'oferecer o que ele não tem (mix novo / +MIX) e combinar o próximo pedido'],
  [/AUSENTE|COMPRADOR|DONO|RESPONSAVEL/, 'ligar hoje para o comprador e agendar retorno'],
  [/PRECO|CONCORR/, 'supervisor avaliar condição/preço com o vendedor'],
  [/DIGITAR|DIGITA/, 'cobrar a digitação do pedido hoje'],
  [/FECHAD|ENCERR/, 'confirmar se fechou mesmo (supervisor); se fechou, pedir a inativação e tirar da rota'],
  [/SEM INTERESSE|NAO QUER/, 'supervisor ir junto na próxima visita com oferta/condição'],
  [/NAO ENTREGUE|ENTREGA/, 'ver com a logística a entrega do pedido anterior e avisar o cliente'],
  [/FINANCEIR|CREDITO|LIMITE|BLOQUE|INADIMPL/, 'ver o financeiro/limite com o supervisor'],
  [/SEM DINHEIRO|CAIXA/, 'oferecer pedido menor ou prazo; voltar na data combinada'],
];
const acaoDe = (m) => { const t = sem(String(m || '')); const a = ACAO_MOTIVO.find(([re]) => re.test(t)); return a ? a[1] : 'supervisor conversar com o vendedor sobre esse cliente'; };
export async function respVisitadosSemCompra(E, B) {
  const J = await justif30(B, E), VJ = E.vend.filter((v) => v.varejo && pessoaReal(v));
  const L = [`📌 *Visitados hoje e 30+ dias sem comprar — ${E.nome}*`];
  let n = 0;
  for (const v of VJ.slice().sort((a, b) => (J.get(b.filial + '|' + b.rca) || []).length - (J.get(a.filial + '|' + a.rca) || []).length)) {
    const cs = J.get(v.filial + '|' + v.rca) || []; if (!cs.length) continue;
    L.push('', `*${vn(v)}* (${cs.length}):`);
    for (const c of cs) { n++; L.push(`• ${titulo(String(c.fantasia || c.razao || 'Cliente #' + c.cliente).toLowerCase())} (#${c.cliente}) · ${N(c.d)} · ${titulo(String(c.motivo || 'sem motivo').toLowerCase())}
   👉 ${acaoDe(c.motivo)}`); }
  }
  if (!n) return `✅ *${E.nome}*: nenhum cliente visitado hoje está há mais de 30 dias sem comprar (Clube da Venda).`;
  L.splice(1, 0, `*${n}* cliente(s) · _nº = dias sem compra · motivo do Clube · 👉 o que fazer_`);
  L.push('', '_Clube da Venda · justificativas de hoje._');
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
  const V0 = E.vend.filter((v) => pessoaReal(v) && canalOk(v) && (pos ? v.metaPos : hoje ? true : v.meta));
  const comMin = V0.filter((v) => minimo(v));
  const V = (pos && comMin.length < 3) ? V0 : comMin;
  const val = (v) => (pos ? v.pos / v.metaPos * 100 : hoje ? v.dig : v.pct ?? -1);
  const fmt = (v) => (pos ? `*${N(v.pos)}* de ${N(v.metaPos)} clientes (${P(v.pos, v.metaPos)})` : hoje ? `*${R$(v.dig)}* em ${v.ped} ped.` : `*${pctTxt(v.pct)}* · ${R$(v.fat)} de ${R$(v.meta)}`);
  const S = V.slice().sort((a, b) => val(b) - val(a));
  if (!S.length) return `Não achei vendedores ${as ? 'AS' : 'de varejo'} com dado para esse ranking em ${E.nome}.`;
  // inicio de mes: ranking de todo mundo com 0,0% nao e ranking, e nao ha quem "reconhecer" (Sueli/API, 01/11/2026)
  if (!pos && !hoje && !S.some((v) => Number(v.fat) > 0)) return `📭 ${E.nome}: ninguém faturou neste mês ainda, então não há ranking.\nPara o mês que fechou, peça *fechamento do mês passado por vendedores*.`;
  const crit = pos ? 'positivação do mês (% da meta de clientes)' : hoje ? 'digitado hoje' : '% da meta no mês (faturado + pendente)';
  const lin = (v, i) => `${i + 1}. ${vn(v)}${E.nacional ? ' · ' + v.filial : ''} — ${fmt(v)}`;
  const L = [`🏅 *${E.nome} — ${querMelhor && !querPior ? n + ' melhores' : querPior && !querMelhor ? n + ' mais atrás' : 'ranking'}, ${as ? 'AS' : 'varejo'}*`, `_Critério: ${crit}._`];
  if (querMelhor) L.push('', ...S.slice(0, n).map(lin));
  if (querPior) { const P2 = S.slice(-n).reverse(); L.push('', querMelhor ? '*Mais atrás:*' : '', ...P2.map((v, i) => lin(v, S.length - 1 - i - 0).replace(/^\d+\./, `${S.length - i}º`))); }
  L.push('', `_Fora do ranking: meta ${pos ? 'abaixo de 40 clientes' : 'abaixo de R$ 10 mil'} (distorce o %)${as ? '' : ' e quem não é varejo'}._`);
  L.push(SUGESTAO + (querPior && !querMelhor ? `conversar hoje com ${nome2(S[S.length - 1].nome)} e o supervisor ${nome2(S[S.length - 1].supervisor)}.` : `reconhecer ${nome2(S[0].nome)} no grupo da equipe: reconhecimento puxa o time.`));
  return L.filter((x, k, a) => !(x === '' && a[k - 1] === '')).join('\n');
}
export async function respPositivacao(B, E) {
  const x = await totaisOficiais(B, E); if (x.pos == null) return 'Sem dado agora.';
  const { diasUteis, positivacaoPorGrupos } = await import('../../fatos/index.js'), dn = diasUteis().restantes;
  const temMeta = Number(x.metaPos) > 0;
  // ABRE UM NIVEL ABAIXO DE QUEM PERGUNTA (26/10/2026, Priscila: "pq ja nao respondeu aberto?"): diretoria -> filiais; gerente -> supervisores; supervisor -> vendedores
  const porVend = !!E.supervisor;
  const G = porVend ? E.vend.filter((v) => (v.metaPos || 0) > 0).map((v) => [vn(v), { pos: v.pos || 0, metaPos: Math.round(v.metaPos) }]).sort((a, b) => (b[1].pos / (b[1].metaPos || 1)) - (a[1].pos / (a[1].metaPos || 1)))
    : [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([k]) => supReal(k));
  // 23/11/2026 (dicionario 3.9, conflito 7): linha de filial = positivacao da filial no GEROT; linha de supervisor = clientes distintos da equipe (regra 4). Nunca a soma dos vendedores.
  if (!porVend && B.env && B.env.DB) {
    if (E.nacional) { const { kpisMes } = await import('../../fatos/index.js'); const K = await kpisMes(B.env.DB, { nivel: 'brasil' }); if (K && K.porFilial) for (const [k, y] of G) { const f = K.porFilial[k]; if (f) { y.pos = f.pos || 0; y.metaPos = f.metaPos || 0; } } }
    else {
      const [PG, supRows] = await Promise.all([
        positivacaoPorGrupos(B.env.DB, E.filiais[0], new Map(G.map(([k, y]) => [k, y.V.map((v) => v.rca)]))),
        B.env.DB.prepare(`SELECT cod_sup, supervisor, json_extract(dados, '$."Meta de positivação"') mp FROM gerot_supervisor_mes WHERE mes = ? AND filial = ?`).bind(hojeSP().slice(0, 7), E.filiais[0]).all().then((r) => r.results || []).catch(() => []),
      ]);
      const mpPorCod = new Map(), mpPorNome = new Map(), supNomePorCod = new Map();
      for (const r of supRows) {
        const mp = Math.round(Number(r.mp) || 0);
        if (r.cod_sup && r.supervisor) supNomePorCod.set(String(Number(r.cod_sup)), sem(r.supervisor));
        if (!(mp > 0)) continue;
        if (r.cod_sup) mpPorCod.set(String(Number(r.cod_sup)), mp);
        const nm = sem(r.supervisor);
        if (nm) mpPorNome.set(nm, mp);
      }
      const achaMetaSup = (k, y) => {
        const nk = sem(k), toks = nk.split(/\s+/).filter(Boolean);
        if (mpPorNome.has(nk)) return mpPorNome.get(nk);
        for (const [nm, mp] of mpPorNome) if (toks.length >= 2 && nm.includes(toks[0]) && nm.includes(toks[1])) return mp;
        for (const v of y.V || []) {
          const cs = v.supCod ? String(Number(v.supCod)) : '';
          if (cs && mpPorCod.has(cs)) {
            const nmDono = supNomePorCod.get(cs) || '';
            if (!nmDono || (toks[0] && nmDono.includes(toks[0]))) return mpPorCod.get(cs);
          }
        }
        return 0;
      };
      for (const [k, y] of G) {
        if (PG) y.pos = (PG.get(k) || {}).pos || 0;
        y.metaPos = achaMetaSup(k, y);
      }
    }
  }
  G.sort((a, b) => {
    const am = Number(a[1].metaPos) > 0, bm = Number(b[1].metaPos) > 0;
    if (am !== bm) return bm - am;
    return am ? ((b[1].pos / b[1].metaPos) - (a[1].pos / a[1].metaPos)) : ((b[1].pos || 0) - (a[1].pos || 0));
  });
  const GcomMeta = G.filter(([, y]) => Number(y.metaPos) > 0);
  const GpiorPool = GcomMeta.length ? GcomMeta : G.filter(([, y]) => Number(y.pos) > 0);
  const piorSupOuFil = GpiorPool.length ? GpiorPool[GpiorPool.length - 1] : null;
  // META OFICIAL DE POSITIVACAO POR FILIAL (Premiacao, 27.000 no grupo) — base TEMPORARIA ate o CEVEN corrigir a tela Filiais (27/10/2026)
  let oficial = '';
  if (!E.supervisor && !E.grupo && !E.rca && typeof B.metaPosFilial === 'function') {
    try {
      const mp = await B.metaPosFilial();
      if (mp && mp.metas && mp.mes === hojeSP().slice(0, 7)) {
        const mo = E.nacional ? mp.total : E.filiais.reduce((a, f) => a + (mp.metas[f] || 0), 0);
        if (mo) oficial = `🎯 *Meta oficial de positivação (Premiação): ${N(mo)} PDVs*` + (E.nacional ? ' no grupo' : '') + ' _(base temporária até o CEVEN corrigir a tela Filiais)_';
      }
    } catch (e) {}
  }
  return [`👥 *Positivação — ${E.nome}* (clientes com faturamento no mês)`, ...(oficial ? [oficial] : []), (temMeta ? `*${N(x.pos)} de ${N(x.metaPos)}* (${P(x.pos, x.metaPos)}) · faltam ${N(Math.max(0, x.metaPos - x.pos))} → ${N(Math.ceil(Math.max(0, x.metaPos - x.pos) / Math.max(dn, 1)))} por dia útil _(conta do Jota: falta ÷ ${dn} dias úteis)_` + (x.metaPosRotulo && !/do GEROT$/.test(x.metaPosRotulo) ? ` _(${x.metaPosRotulo})_` : '') : `*${N(x.pos)}* clientes com faturado no mês (clientes distintos, sem repetir) · meta de positivação do grupo ainda não definida`), '',
    /* 21/11/2026 (R17 'Rcas Inativos: 0 de 0 (sem dado)'): grupo sem positivacao e sem meta nao tem numero para mostrar */ ...G.filter(([, y]) => Number(y.pos) || Number(y.metaPos)).map(([k, y]) => `• ${E.nacional || porVend ? k : nome2(k)}: ${N(y.pos)}${Number(y.metaPos) ? ` de ${N(y.metaPos)} (${P(y.pos, y.metaPos)}) · faltam ${N(Math.max(0, y.metaPos - y.pos))}` : ' _(sem meta)_'}`), '', SUGESTAO + (piorSupOuFil ? `o mais atrás é ${E.nacional || porVend ? piorSupOuFil[0] : nome2(piorSupOuFil[0])}.` : 'sem meta de positivação cadastrada.'),
    E.nacional
      // BRASIL (Vitorio, 26/10/2026): deixar claro por que a soma passa da meta do grupo (27.000 PDVs) e o que nao entra
      ? '_Total = soma das 11 filiais no GEROT (o CNPJ é contado uma vez em cada filial); cada linha é a positivação oficial da filial. Não entram os PDVs com pedido ainda pendente de faturamento._'
      : porVend ? '_Total = clientes distintos da equipe (um cliente comprado por dois vendedores conta uma vez); cada linha é a positivação do vendedor no GEROT._' : '_Total = positivação oficial do GEROT; cada linha conta os clientes distintos da equipe (positivação não soma: o mesmo cliente pode estar em duas equipes)._',
    E.nacional ? '❓ _Quer aberto por *supervisor* de alguma filial? É só pedir, ex.: "positivação TPH por supervisor"._' : !E.supervisor ? '❓ _Quer aberto por *vendedor* de algum supervisor? Ex.: "positivação do supervisor Nome"._' : ''].filter((x) => x !== '').join('\n');
}
export function respDevolucao(E, t = '') {
  // DEVOLUCAO DE HOJE (26/10/2026): notas com data de hoje, por filial/supervisor e vendedor
  // 'hoje' so quando colado em devolucao ('devolucao de hoje', 'hoje a devolucao'); 'hoje eu olhei... 3 milhoes de devolucao' e do MES
  if (/DEVOLU\w*\s+(DE\s+|DO\s+)?(HOJE|HJ)\b|\b(HOJE|HJ)\s+(\w+\s+){0,2}DEVOLU|ENTRADAS?\s+HOJE/.test(t) && !/MILH|COMO ASSIM/.test(t)) {
    const Vh = E.vend.filter((v) => v.devHoje > 0).sort((a, b) => b.devHoje - a.devHoje); const toth = E.vend.reduce((a, v) => a + (v.devHoje || 0), 0);
    const Gh = [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].map(([k, y]) => [k, y.V.reduce((a, v) => a + (v.devHoje || 0), 0)]).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]);
    if (!toth) return `↩️ *Devoluções de hoje — ${E.nome}*: nenhuma nota de devolução com data de hoje até agora.`;
    const cliHoje = new Set(E.vend.flatMap((v) => (v.devHojeCli || []).map((c) => v.filial + '|' + c))).size;   /* "quantos clientes deram devolucao hoje?" (31/10/2026) */
    return [`↩️ *Devoluções de hoje — ${E.nome}*: *${R$(toth)}* em *${N(cliHoje)} cliente(s)*`, `*Por ${E.nacional ? 'filial' : 'supervisor'}:*`, ...Gh.slice(0, 11).map(([k, x]) => `• ${E.nacional ? k : nome2(k)}: ${R$(x)}`),
      '*Vendedores:*', ...Vh.slice(0, 10).map((v) => `• ${nome2(v.nome)} (${v.rca}) ${E.nacional ? v.filial : ''}: ${R$(v.devHoje)}`)].join('\n');
  }
  const V = E.vend.filter((v) => v.dev > 0).sort((a, b) => b.dev - a.dev); const tot = E.vend.reduce((a, v) => a + v.dev, 0);
  const G = [...agrupa(E.vend, (v) => E.nacional ? v.filial : supChave(v, false))].filter(([, y]) => y.dev > 0).sort((a, b) => b[1].dev - a[1].dev);
  const notas = E.vend.flatMap((v) => v.devolucoes.map((d) => ({ ...d, vend: v.nome }))).filter((d) => d && (d.valor || d.vl_total || d.total));
  return [`↩️ *Devoluções no mês — ${E.nome}*: *${R$(tot)}*`, `*Por ${E.nacional ? 'filial' : 'supervisor'}:*`, ...G.slice(0, 10).map(([k, y]) => `• ${E.nacional ? k : nome2(k)}: ${R$(y.dev)}`),
    // pediu a abertura por supervisor no Brasil (sabatina 01/11/2026); "nao pediu" avisa que o total e de todos os motivos, em vez de parecer filtrado
    ...(E.nacional && /SUPERVISOR/.test(t) ? ['*Por supervisor:*', ...[...agrupa(E.vend, (v) => supChave(v, true))].filter(([k, y]) => supReal(k) && y.dev > 0).sort((a, b) => b[1].dev - a[1].dev).slice(0, 15).map(([k, y]) => `• ${supNome(k)}: ${R$(y.dev)}`)] : []),
    ...(/NAO PEDIU/.test(t) ? ['_Atenção: estes totais incluem todos os motivos, não só "cliente não pediu". Peça *devoluções por motivo* para a separação no Brasil._'] : []),
    '*Vendedores com mais devolução:*', ...V.slice(0, 8).map((v) => `• ${vn(v)}${E.nacional ? ' ' + v.filial : ''}: ${R$(v.dev)}`),
    notas.length ? `_${notas.length} nota(s) detalhadas na base._` : '',
    '', '', SUGESTAO + (V[0] ? `entender as devoluções de ${nome2(V[0].nome)} (${R$(V[0].dev)}).` : 'sem devoluções relevantes.')].filter(Boolean).join('\n');
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
// POSITIVADO = PEDIDO (Vitorio; 09/11/2026): clientes com pedido no mes ate hoje (D1 pedido_status; nunca cancelado nem data futura).
// Devolve Set de 'FILIAL|id_cliente'. Usado na rota de hoje, nas tags (recorrencia) e em 'visitados que nao compraram'.
export async function clientesComPedidoNoMes(B, filiais, rca = null) {
  const out = new Set(); const db = B && B.env && B.env.DB; if (!db || !filiais || !filiais.length) return out;
  try {
    const hj = hojeSP(), ini = hj.slice(0, 8) + '01';
    const { results } = await db.prepare(`SELECT filial, id_cliente FROM pedido_status WHERE filial IN (${filiais.map(() => '?').join(',')}) ${rca ? 'AND rca = ?' : ''} AND data_pedido >= ? AND data_pedido <= ? AND status <> 'CANCELADO'`).bind(...filiais.map(String), ...(rca ? [String(rca)] : []), ini, hj).all();
    for (const p of results || []) out.add(String(p.filial) + '|' + String(p.id_cliente));
  } catch (e) { /* sem a tabela: so o faturado */ }
  return out;
}
export async function semCompraNaRota(B, v) {
  const R0 = (v.rotaHoje || []).filter((c) => !/FORA/i.test(String(c.status || '')));
  const { vendasEscopo } = await import('./vendas.js');
  const VM = await vendasEscopo(B, { filiais: [v.filial], rca: v.rca, vend: [v] }).catch(() => null);
  const valorMes = new Map(); for (const l of ((VM && VM.linhas) || []).filter((l) => String(l.r) === String(v.rca))) valorMes.set(String(l.c), (valorMes.get(String(l.c)) || 0) + l.v);   /* R$ comprado no mes por cliente */
  const compraram = new Set(valorMes.keys());
  // POSITIVADO = PEDIDO (Vitorio; 09/11/2026: Tamara TCV 352 tinha 7 pedidos hoje e o Jota disse 'ainda nao compraram'):
  // pedido do mes ate hoje no D1 (pedido_status: liberado, bloqueado, aguardando Winthor ou faturado; nunca cancelado nem com data futura) conta como compra.
  const pedidoHoje = new Map();
  if (B.env && B.env.DB) {
    try {
      const hj = hojeSP(), ini = hj.slice(0, 8) + '01';
      const { results } = await B.env.DB.prepare("SELECT id_cliente, data_pedido, status, valor FROM pedido_status WHERE filial = ? AND rca = ? AND data_pedido >= ? AND data_pedido <= ? AND status <> 'CANCELADO'").bind(String(v.filial), String(v.rca), ini, hj).all();
      for (const p of results || []) {
        const k = String(p.id_cliente); compraram.add(k);
        if (!valorMes.has(k)) valorMes.set(k, Number(p.valor) || 0);
        if (p.data_pedido === hj) pedidoHoje.set(k, (pedidoHoje.get(k) || 0) + (Number(p.valor) || 0));
      }
    } catch (e) { /* sem a tabela: fica so o faturado */ }
  }
  const ultimasCompras = new Map();
  let historicoCompleto = false;
  if (B.env && B.env.DB && R0.length) {
    try {
      const ids = [...new Set(R0.map((c) => String(c.id_cliente)))];
      for (let i = 0; i < ids.length; i += 80) {
        const lote = ids.slice(i, i + 80);
        const { results } = await B.env.DB.prepare(`SELECT id_cliente, json_extract(json, '$.ult') AS ultima_compra FROM ficha_cliente WHERE filial = ? AND id_cliente IN (${lote.map(() => '?').join(',')})`)
          .bind(String(v.filial), ...lote).all();
        for (const r of results || []) {
          const d = String(r.ultima_compra || '').slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= '2020-01-01' && d <= hojeSP()) ultimasCompras.set(String(r.id_cliente), d);
        }
        // 18/11/2026: ultima compra = data do PEDIDO mais recente (ficha, GEROT pela entrada do pedido, Clube) — mesma conta de todas as listas
        await ultimaCompraGerot(B, v.filial, lote, ultimasCompras);
      }
      historicoCompleto = true;
    } catch (e) {
      historicoCompleto = false;
    }
  }
  let H = {}; try { H = JSON.parse(await B.raw(`public/mix_hist/${v.filial}.json`) || '{}').c || {}; } catch (e) { H = {}; }
  const ult = (c) => {
    const daFicha = ultimasCompras.get(String(c.id_cliente));
    if (daFicha) return daFicha;
    const x = H[String(c.cnpj || '').replace(/\D/g, '')];
    if (!x) return null;
    const m = String(x).split(',').map((p) => p.split(':')[1]).filter(Boolean).sort().pop();
    return m ? `20${m.slice(0, 2)}-${m.slice(2, 4)}-${m.slice(4, 6)}` : null;
  };
  const vistos = new Set(), rota = [];
  for (const c of R0) { const k = String(c.id_cliente); if (vistos.has(k)) continue; vistos.add(k); rota.push(c); }
  // 18/11/2026: pedido no mes (data do pedido no GEROT/Clube) = comprou no mes (Big Casa: pedido 17/11 aparecia em 'ainda nao comprou' com '1 dia')
  const iniMes = hojeSP().slice(0, 8) + '01';
  const comprou = (c) => compraram.has(String(c.id_cliente)) || /POSITIVADO|EFETIVADO/i.test(String(c.status || '')) || String(ultimasCompras.get(String(c.id_cliente)) || '') >= iniMes;
  const sem = rota.filter((c) => !comprou(c)).map((c) => { const u = ult(c); return { c, u, dias: u ? Math.round((Date.parse(hojeSP()) - Date.parse(u)) / 864e5) : null }; })
    .sort((a, b) => (b.dias ?? 999) - (a.dias ?? 999));
  return { rota, sem, valorMes, historicoCompleto, pedidoHoje };
}
export async function respRotaHojeResumo(B, E, v) {
  if (v) {
    const { rota, sem } = await semCompraNaRota(B, v);
    if (!rota.length) return `${vn(v)} (${v.filial}) não tem clientes na rota de hoje.`;
    return [`📋 *${vn(v)}* (${v.filial}) — *${rota.length} clientes* na rota de hoje.`, '',
      sem.length ? `Destes, *${sem.length} ainda não compraram no mês:*` : '✅ Todos já compraram no mês.', ...(sem.length ? ['_Cliente · Dias sem compra_'] : []),
      ...sem.slice(0, 25).map((x) => `${titulo(x.c.nome_cliente || x.c.razao_social || 'cliente')} · ${x.dias == null ? 'sem histórico na base' : x.dias + ' dias'}`),
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
    // 17/11/2026 (Tamara: "Horrivel o layout. Nao consegui ler"): um bloco por cliente, um produto por linha
    L.push('', `*Ainda sem compra no mês (${sem.length}) — o que oferecer:*`);
    for (const x of sem.slice(0, 8)) { const r = recDe(x.c); L.push('', `🏪 *${titulo(x.c.nome_cliente || x.c.razao_social || 'cliente')}*`, ...(r.length ? r.slice(0, 3).map(([, nome]) => `   • ${titulo(nome)}`) : ['   • sem sugestão nova no +MIX'])); }
  }
  // itens que mais aparecem nas listas do +MIX de TODOS os clientes da rota de hoje (inclusive quem ja comprou no mes): sugestao simples para levar
  const cont = new Map();
  for (const c of rota) for (const [cod, nome] of recDe(c).slice(0, 10)) { const k = String(cod); const x = cont.get(k) || { nome, n: 0 }; x.n++; cont.set(k, x); }
  const top = [...cont.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  if (top.length) L.push('', `📦 *Leve na bolsa hoje* (os que mais aparecem nos ${rota.length} clientes da rota):`, ...top.map((x) => `   • ${titulo(x.nome)} — ${x.n} cliente${x.n > 1 ? 's' : ''}`));
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
  for (const k of await clientesComPedidoNoMes(B, [...new Set((E.vend || []).map((x) => x.filial))])) compraram.add(k);   // pedido do mes conta (09/11/2026)
  // TAGS DO ADMIN 'CLIENTES FOCO' (Vitorio, 16/11/2026: "as tags vc tem aqui .../admin... as tags devem ser consideradas"): cliente_focos (filial + CNPJ + campanha),
  // gravado de madrugada e 2x ao dia. O cliente tem a tag se o roteiro diz OU se o CNPJ dele esta na lista do admin para a filial.
  const tagSet = new Set();
  try { const F = [...new Set((E.vend || []).map((x) => x.filial))]; if (F.length && B.env && B.env.DB) { const { results } = await B.env.DB.prepare(`SELECT filial, id_cliente, tag FROM cliente_focos WHERE filial IN (${F.map(() => '?').join(',')})`).bind(...F).all(); for (const r of results || []) if (tagRegex.test(sem(String(r.tag || '')))) tagSet.add(r.filial + '|' + String(r.id_cliente).replace(/\D/g, '')); } } catch (e) { /* sem tabela */ }
  const temTagV = (x) => (cli) => temTag(cli) || tagSet.has(x.filial + '|' + String(cli.cnpj || '').replace(/\D/g, ''));
  // carteira do mes sem a leitura de hoje (CEVEN fora): o ultimo roteiro do mes gravado no D1, so para quem esta sendo perguntado
  const garanteMes = async (x) => { if (Array.isArray(x.roteiroMes) && x.roteiroMes.length) return; try { const rm = await B.env.DB.prepare("SELECT roteiro_mes_json j FROM varredura_central_rca WHERE rca_codigo = ? AND filial_sigla = ? AND roteiro_mes_json IS NOT NULL AND substr(data_ref, 1, 7) = ? ORDER BY data_ref DESC LIMIT 1").bind(String(x.rca), String(x.filial), mes).first(); const arr = rm && rm.j ? JSON.parse(rm.j) : null; const l = Array.isArray(arr) ? arr : (arr && Object.values(arr).find(Array.isArray)) || []; if (l.length) x.roteiroMes = l; } catch (e) { /* sem roteiro */ } };
  if (v) await garanteMes(v); else if ((E.vend || []).length <= 15) for (const x of E.vend) await garanteMes(x);
  // comprou no mes = tambem a ultima compra da ficha do cliente dentro do mes (as vendas gravadas pararam em 11/11 com o CEVEN fora)
  try { for (const x of (v ? [v] : (E.vend || []).slice(0, 15))) { const ids = [...new Set((x.roteiroMes || []).filter(temTagV(x)).map((cli) => String(cli.id_cliente)))]; for (let i = 0; i < ids.length; i += 80) { const pp = ids.slice(i, i + 80); const { results } = await B.env.DB.prepare(`SELECT id_cliente, json_extract(json, '$.ult') u FROM ficha_cliente WHERE filial = ? AND id_cliente IN (${pp.map(() => '?').join(',')})`).bind(String(x.filial), ...pp).all(); for (const r of results || []) if (r.u && String(r.u).slice(0, 10) >= mes + '-01') compraram.add(x.filial + '|' + r.id_cliente); } } } catch (e) { /* sem ficha */ }
  const um = (x) => {
    const temTag = temTagV(x);
    const hoje = []; const vh = new Set();
    for (const cli of (x.rotaHoje || []).filter(temTag)) { if (vh.has(String(cli.id_cliente))) continue; vh.add(String(cli.id_cliente)); hoje.push(cli); }
    const mesC = new Map(); for (const cli of (x.roteiroMes || []).filter(temTag)) { const k = String(cli.id_cliente), u = String(cli.data_ultima_compra || '').slice(0, 10); const y = mesC.get(k) || { c: cli, u: '', comp: false }; if (u > y.u) y.u = u; if (/POSITIVADO|EFETIVADO/i.test(String(cli.status || ''))) y.comp = true; mesC.set(k, y); }
    for (const [k, y] of mesC) if (compraram.has(x.filial + '|' + k)) y.comp = true;
    for (const y of mesC.values()) if (y.comp) y.u = mes + '-01';
    const comprou = [...mesC.values()].filter((y) => y.comp).length, meta = Math.ceil(mesC.size * 0.8);
    return { hoje, mesC, comprou, meta };
  };
  const querListaCompleta = /LISTA(GEM)? COMPLETA|TODOS|TODAS|QUAIS|QUEM|QUERO A LISTA|RELACAO COMPLETA|RELAÇÃO COMPLETA|LISTAGEM/i.test(sem(t));
  // O PROPRIO VENDEDOR (09/11/2026, Graciela TCV 1057: "quais sao meus clientes de recorrencia" recebeu a contagem da 'equipe' de 1 pessoa):
  // escopo de um vendedor so = a lista dele, sempre
  if (!v && ((c && c.papel === 'vendedor') || (E.vend && E.vend.length === 1)) && E.vend && E.vend.length) v = E.vend.find((x) => !c || !c.rca || String(x.rca) === String(c.rca)) || E.vend[0];
  if (!v && (/QUANTOS/.test(t) || !/CADA|POR VENDEDOR|QUAIS|LISTA|QUEM/.test(t) || /EQUIPE|TIME|RESUMO|META|MINHA META/i.test(t))) {
    let tag = 0, comp = 0; const hoje = [], porV = [];
    for (const x of E.vend) {
      const r = um(x); tag += r.mesC.size; comp += r.comprou;
      for (const cli of r.hoje) if (!(r.mesC.get(String(cli.id_cliente)) || {}).comp) {
        hoje.push(`• ${titulo(cli.nome_cliente || cli.razao_social || 'cliente')} — *${vn(x)}*`);
      }
      if (r.mesC.size) {
        const falta = Math.max(0, r.meta - r.comprou);
        porV.push({
          diff: r.mesC.size - r.comprou,
          vend: x,
          comprou: r.comprou,
          total: r.mesC.size,
          falta,
          ehRec: tagInfo.ehRec,
          meta: r.meta,
          hojeLen: r.hoje.length
        });
      }
    }
    const meta = Math.ceil(tag * 0.8);
    const numE = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const numL = (i) => numE[i] || `${i + 1}.`;
    const porVLinhas = porV.sort((a, b) => b.diff - a.diff).map((item, i) =>
      `${numL(i)} *${vn(item.vend)}*: mês *${item.comprou} de ${item.total}*` + (item.ehRec ? ` (meta ${item.meta} · faltam ${item.falta})` : '') + (item.hojeLen ? ` · hoje *${item.hojeLen}* na rota` : '')
    );
    return [
      `🔄 *Tag: ${tagInfo.label} — ${E.nome}*`,
      `*${tag} clientes* com a tag no mês · já compraram *${comp}*` + (tagInfo.ehRec ? ` · faltam *${Math.max(0, meta - comp)}* para a meta da Premiação (${meta} = 80%)` : ` (${tag ? Math.round(comp / tag * 100) : 0}% positivados)`),
      '',
      hoje.length ? `📍 *Na rota de hoje e ainda sem compra (${hoje.length}):*\n` + hoje.join('\n') : `📍 Nenhum cliente com a tag sem compra na rota de hoje.`,
      '',
      `👥 *Por vendedor:*`,
      ...porVLinhas,
      '',
      SUGESTAO + (hoje.length ? `cobrar hoje os ${hoje.length} clientes da rota com os vendedores acima; ` : '') + `digite o número (ex: *1* ou *2*) para ver os clientes daquele vendedor.`
    ].join('\n');
  }
  if (v) {
    const r = um(v);
    // 16/11/2026 (Renan TPH 128 e regua R08: 'nenhum cliente com a tag' junto de 'faltam 18' da meta do GEROT): sem a tag no roteiro nao quer dizer que
    // nao ha clientes de recorrencia — a lista oficial e a do GEROT (Recorrencia, 'Lista do dia 1º'), que ainda nao esta gravada cliente a cliente.
    if (!r.hoje.length && !r.mesC.size) return `🔄 ${vn(v)}: a lista de clientes da recorrência deste mês ainda não chegou aqui cliente a cliente. Por enquanto, peça a *curva negativa* (clientes sem compra no mês) — os da recorrência estão dentro dela.`;
    const hj = new Set(r.hoje.map((cli) => String(cli.id_cliente)));
    const naoMes = [...r.mesC.values()].filter((y) => !(y.u >= mes + '-01') && !hj.has(String(y.c.id_cliente)));
    const jaComp = [...r.mesC.values()].filter((y) => y.u >= mes + '-01');
    const limite = querListaCompleta ? (naoMes.length <= 100 ? naoMes.length : 60) : 15;
    return [`🔄 *Tag: ${tagInfo.label} — ${vn(v)}*`,
      // 17/11/2026 (auditoria ampla: duas contas da mesma meta, GEROT "faltam 3" x tag "faltam 4"): a meta oficial e a do GEROT (linha de cima); aqui so a lista da tag
      `Clientes com a tag: *${r.mesC.size}* · já compraram no mês: *${r.comprou}*` + (tagInfo.ehRec ? '' : ` (${r.mesC.size ? Math.round(r.comprou / r.mesC.size * 100) : 0}%)`),
      ...(r.hoje.length ? ['', `*Na rota de hoje (${r.hoje.length}):*`, '_Cliente · Status · Última compra_', ...r.hoje.map((cli, i) => `${i + 1}. ${titulo(cli.nome_cliente || cli.razao_social || 'cliente')} (#${cli.id_cliente}) · ${titulo(String(cli.status || 'aberto'))} · ${dd(String(cli.data_ultima_compra || '').slice(0, 10))}`)] : ['', '_Hoje nenhum deles está na sua rota: ligue ou encaixe na visita._']),
      ...(naoMes.length ? ['', `*Ainda sem compra no mês (${naoMes.length}):*`, '_Cliente · Última compra_', ...naoMes.slice(0, limite).map((y, i) => `${r.hoje.length + i + 1}. ${titulo(y.c.nome_cliente || y.c.razao_social || 'cliente')} (#${y.c.id_cliente}) · ${dd(y.u)}`), ...(naoMes.length > limite ? [`… e mais ${naoMes.length - limite} clientes. Peça "lista completa" para ver mais.`] : [])] : []),
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
    const cargo = c && c.papel === 'gerente' ? 'Gerente ' : c && (c.papel === 'diretoria' || c.papel === 'ceo') ? 'Diretor ' : '';
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
  const { rota, sem: semC, valorMes, historicoCompleto, pedidoHoje } = await semCompraNaRota(B, v);
  if (!rota.length) return `${vn(v)} (${v.filial}) não tem clientes na rota de hoje.`;
  const semMap = new Map(semC.map((x) => [String(x.c.id_cliente), x]));
  // tags: Recorrencia primeiro (e a que conta na Premiacao), depois as outras; no maximo 2
  const tags = (c) => { const T = [...new Set((c.focos || []).map((f) => titulo(String(f.industria_foco || '').trim())).filter(Boolean))].sort((a, b) => (/Recorrencia/i.test(b) ? 1 : 0) - (/Recorrencia/i.test(a) ? 1 : 0)); return T.slice(0, 2).join(', '); };
  const st = (c) => { const s = String(c.status || '').toUpperCase(); if (s === 'PLANEJADO' && !(pedidoHoje && pedidoHoje.has(String(c.id_cliente)))) return '📅'; return (pedidoHoje && pedidoHoje.has(String(c.id_cliente))) || /POSITIVADO|EFETIVADO/.test(s) ? '✅' : /VISITADO|JUSTIFICADO/.test(s) ? '👣' : '⏳'; };
  const nome = (c) => titulo(c.nome_cliente || c.razao_social || 'cliente');
  const nao = rota.filter((c) => semMap.has(String(c.id_cliente))), ja = rota.filter((c) => !semMap.has(String(c.id_cliente)));
  let idxGlobal = 0;
  void st; void tags;
  const linhaNao = (c) => { idxGlobal++; const x = semMap.get(String(c.id_cliente)); return `${idxGlobal}. ${nome(c)} (#${c.id_cliente}) · ${emojiVisita(c, pedidoHoje)} · ${diasTxt(x.dias)}${tagsCurtas(c)}`; };
  const linhaJa = (c) => { idxGlobal++; const r = valorMes.get(String(c.id_cliente)); return `${idxGlobal}. ${nome(c)} (#${c.id_cliente}) · ${emojiVisita(c, pedidoHoje)} · ${r ? R$(r) : '✔️'}${tagsCurtas(c)}`; };
  return [`📋 *${vn(v)}* (${v.filial}) — rota de hoje: *${rota.length} clientes* · *${nao.length} ainda sem compra no mês*`,
    LEGENDA_ROTA,
    ...(nao.length ? ['', `*Ainda não compraram no mês (${nao.length}):*`, ...nao.map(linhaNao)] : ['', '✅ Todos da rota de hoje já compraram no mês.']),
    ...(!soSemCompra && ja.length ? ['', `*Já compraram no mês (${ja.length}):*`, ...ja.sort((a, b) => (valorMes.get(String(b.id_cliente)) || 0) - (valorMes.get(String(a.id_cliente)) || 0)).map(linhaJa)] : []),
    ...(!historicoCompleto && semC.some((x) => x.dias == null) ? ['', '_Não consegui confirmar a última compra de todos os clientes; não estimei os dias sem histórico._'] : []),
    '', '👉 *Digite o número* (ex.: 1) para abrir a ficha do cliente e o que oferecer no balcão (+MIX).'].join('\n');
}

// PADRAO DE LISTA DE CLIENTES (Vitorio, 27/10 e 17/11/2026: "legenda no inicio e so os emojis embaixo... dias sem compra apenas o numero... foco na informacao"):
// uma legenda no topo; cada linha = numero. Nome (#codigo) · situacao (emoji) · dias sem compra (so o numero) ou R$ do mes · 🏷️ tag.
export const LEGENDA_ROTA = '_⏳ a visitar · 👣 visitou · ⚠️ justificou · ✅ vendeu hoje · nº = dias sem compra · 🆕 sem compra registrada · 🏷️ tag_';
export function emojiVisita(c, pedidoHoje) {
  const s = String(c.status || '').toUpperCase();
  if ((pedidoHoje && pedidoHoje.has(String(c.id_cliente))) || /POSITIVADO|EFETIVADO/.test(s)) return '✅';
  if (/JUSTIFICADO/.test(s)) return '⚠️';
  if (c.checkin_horario || /VISITADO/.test(s)) return '👣';
  return '⏳';
}
export const tagsCurtas = (c) => { const T = [...new Set((c.focos || []).map((f) => titulo(String(f && f.industria_foco || '').trim().toLowerCase())).filter(Boolean))].sort((a, b) => (/Recorr/i.test(b) ? 1 : 0) - (/Recorr/i.test(a) ? 1 : 0)); return T.length ? ' · 🏷️ ' + T.slice(0, 2).join(', ') : ''; };
export const diasTxt = (d) => (d == null ? '🆕' : d === 0 ? 'hoje' : String(d));

// "MINHA ROTA" DO VENDEDOR (Vitorio, 01/11/2026): como esta o mes, quantos clientes hoje, quem ja comprou e quem nao, numerados; ele digita o numero e recebe a ficha do cliente.
export async function respMinhaRota(B, v) {
  const { rota, sem: semC, valorMes, pedidoHoje } = await semCompraNaRota(B, v);
  const mes = v.semDash ? ['📊 *Seu mês:* sem leitura recente no momento.'] : [`📊 *Seu mês:* faturado ${R$(v.fat || 0)} + pendente ${R$(v.pend || 0)} de ${R$(v.meta || 0)}`, `👥 Positivação: ${v.pos || 0} de ${Math.round(v.metaPos || 0)}`];
  if (!rota.length && v.semRota) return [`📋 *${vn(v)}*`, ...mes, '', '⚠️ A rota de hoje ainda não foi lida. Peça de novo daqui a pouco.'].join('\n');
  if (!rota.length) return [`📋 *${vn(v)}*`, ...mes, '', 'Você não tem clientes na rota de hoje.'].join('\n');
  const semMap = new Map(semC.map((x) => [String(x.c.id_cliente), x])), nao = rota.filter((c) => semMap.has(String(c.id_cliente))), ja = rota.filter((c) => !semMap.has(String(c.id_cliente)));
  const nome = (c) => titulo(c.nome_cliente || c.razao_social || 'cliente');
  const situacaoVisita = (c) => {
    const s = String(c.status || '').toUpperCase();
    if ((pedidoHoje && pedidoHoje.has(String(c.id_cliente))) || /POSITIVADO|EFETIVADO/.test(s)) return '✅ vendeu hoje';
    if (/JUSTIFICADO/.test(s)) return '⚠️ justificado';
    if (c.checkin_horario || /VISITADO/.test(s)) return '👣 visitado';
    if (/ABERTO|AGENDADO/.test(s)) return '⏳ a visitar';
    return s || 'sem status de visita';
  };
  const tags = (c) => {
    const itens = Array.isArray(c.focos) ? [...new Set(c.focos.map((f) => String(f?.industria_foco || '').trim()).filter(Boolean))] : [];
    return itens.length ? ` · 🏷️ ${itens.join(', ')}` : '';
  };
  void situacaoVisita; void tags;
  let i = 0; const linha = (c, fim) => `${++i}. ${nome(c)} (#${c.id_cliente}) · ${emojiVisita(c, pedidoHoje)} · ${fim}${tagsCurtas(c)}`;
  const L = [`📋 *${vn(v)}* — rota de hoje: *${rota.length} clientes* · *${nao.length} sem compra no mês*`, '', LEGENDA_ROTA];   /* 17/11/2026 (bateria real): rota de hoje comeca pelo dia, sem o bloco do mes */
  if (nao.length) L.push('', `*Ainda não compraram no mês (${nao.length}):*`, ...nao.map((c) => linha(c, diasTxt(semMap.get(String(c.id_cliente)).dias))));
  if (ja.length) L.push('', `*Já compraram no mês (${ja.length}):*`, ...ja.map((c) => { const r = valorMes.get(String(c.id_cliente)); return linha(c, r ? R$(r) : '✔️'); }));
  // "COMECE POR X E OFERECA Y" (proatividade, 01/11/2026): quem esta ha mais tempo sem comprar, ainda sem check-in, com a lista do +MIX. Sem lista, nao sugere nada.
  let M = {}; try { M = JSON.parse(await B.raw(`public/mix_rec/${v.filial}.json`) || '{}').clientes || {}; } catch (e) { M = {}; }
  const recDe = (c) => (M[String(c.cnpj || '').replace(/\D/g, '')] || {}).rec || [];
  const diasDe = (c) => { const d = semMap.get(String(c.id_cliente)).dias; return d == null ? 9999 : d; };
  const primeiro = nao.filter((c) => !c.checkin_horario && recDe(c).length).sort((a, b) => diasDe(b) - diasDe(a))[0];
  if (primeiro) L.push('', `🎯 *Comece por:* ${nome(primeiro)} (#${primeiro.id_cliente})`, `Ofereça: ${recDe(primeiro).slice(0, 3).map(([, n]) => titulo(n)).join(', ')}`);
  L.push('', '*Digite o número* do cliente para ver a ficha dele.');
  return L.join('\n');
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
  const diasSem = (c) => { const u = ultH(c.cnpj); return u ? Math.round((Date.parse(hojeSP()) - Date.parse(u)) / 864e5) + ' dias' : 'sem histórico de compra na base'; };
  const nome = (c) => titulo(c.nome_cliente || c.razao_social || 'cliente');
  const visitou = (c) => !!c.checkin_horario || /VISITADO|JUSTIFICADO|POSITIVADO|EFETIVADO/i.test(String(c.status || ''));
  const comprouMes = (c) => porCli.has(String(c.id_cliente)) || /POSITIVADO|EFETIVADO/i.test(String(c.status || ''));
  const carteira = new Map(); for (const c of v.roteiroMes || []) { const k = String(c.id_cliente); if (!carteira.has(k)) carteira.set(k, c); }
  const nComp = [...carteira.values()].filter(comprouMes).length;
  // dois numeros, cada um com o que e (27/10/2026): positivacao oficial = clientes com FATURAMENTO (GEROT/CEVEN); carteira com pedido = inclui pedido ainda nao faturado
  const fontePos = v.reforco && v.reforco.financeiro && /GEROT.*positiva/i.test(String(v.reforco.financeiro.fonte || '')) ? 'GEROT' : 'base';
  const cab = `👥 Positivação (${fontePos}, faturado): *${v.pos ?? '—'} de ${v.metaPos ?? '—'}* · com pedido no mês: *${nComp} de ${carteira.size}* da carteira`;
  if (periodo === 'mes') {
    const comp = [...carteira.values()].filter(comprouMes).map((c) => ({ c, r: (porCli.get(String(c.id_cliente)) || { v: 0 }).v })).sort((a, b) => b.r - a.r);
    const nao = [...carteira.values()].filter((c) => !comprouMes(c));
    return [`👥 *Clientes no mês — ${vn(v)}* (${v.filial})`, cab, '',
      `*Já compraram (${comp.length})* — os que mais compraram:`, '_Cliente · Comprado no mês_', ...comp.slice(0, 8).map((x, i) => `${i + 1}. ${nome(x.c)} (#${x.c.id_cliente}) · ${R$(x.r)}`), '',
      `*Ainda não compraram (${nao.length}):*`, '_Cliente · Visitado no mês? · Dias sem compra_', ...nao.slice(0, 8).map((c, i) => `${comp.slice(0, 8).length + i + 1}. ${nome(c)} (#${c.id_cliente}) · ${visitou(c) ? 'sim' : 'não'} · ${diasSem(c)}`), '',
      '_Digite o número do cliente para ver a ficha, ou peça "ver mais" para a lista completa._'].join('\n');
  }
  if (periodo === 'ontem') {
    const ult = Lv.reduce((m, l) => Math.max(m, l.d), 0); if (!ult) return `${vn(v)}: sem venda item a item na base para ontem.`;
    const dia = `${String(ult).slice(0, 4)}-${String(ult).slice(4, 6)}-${String(ult).slice(6, 8)}`;
    const rota = []; const vis = new Set(); for (const c of v.roteiroMes || []) if (String(c.data_visita || '').slice(0, 10) === dia && !vis.has(String(c.id_cliente))) { vis.add(String(c.id_cliente)); rota.push(c); }
    const doDia = new Map(); for (const l of Lv.filter((l) => l.d === ult)) doDia.set(String(l.c), (doDia.get(String(l.c)) || 0) + l.v);
    const fora = [...doDia.keys()].filter((k) => !vis.has(k));
    const L = rota.map((c) => { const r = doDia.get(String(c.id_cliente)); return [r ? 0 : 1, `${nome(c)} (#${c.id_cliente}) · ${r ? '✅ comprou ' + R$(r) : visitou(c) ? '👣 visitado, sem venda' : '⏳ não visitado'} · ${comprouMes(c) ? 'já comprou no mês' : '❌ sem compra no mês (' + diasSem(c) + ')'}`]; }).sort((a, b) => a[0] - b[0]).map((x, i) => `${i + 1}. ${x[1]}`);
    return [`📋 *Rota de ${dIsoBR(dia)} — ${vn(v)}* (${v.filial}): *${rota.length} clientes* · *${rota.filter((c) => doDia.has(String(c.id_cliente))).length} compraram* · total ${R$([...doDia.values()].reduce((a, b) => a + b, 0))}`,
      cab, '', '_Cliente · Resultado do dia · Compra no mês_', ...L, ...(fora.length ? ['', `_+ ${fora.length} cliente(s) compraram fora da rota nesse dia._`] : [])].join('\n');
  }
  const r = await respRotaHojeCompleta(B, v, false);
  return r.replace('\n', '\n' + cab + '\n');
}
const dIsoBR = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

// "COMO ESTA O DIA DA MINHA EQUIPE" / "TIME HOJE"
// Vitório, 30/10/2026: Não separar artificialmente varejo x outros canais! Ninguém perguntou se é rota ou varejo.
// Equipes de AS, Key Account ou mistas devem ver todos os vendedores em linhas individuais com layout limpo e profissional.
export async function respDiaEquipe(B, E) {
  const totGeral = E.vend.reduce((s, v) => s + (v.dig || 0), 0);
  const totPed = E.vend.reduce((s, v) => s + (v.ped || 0), 0);
  const VcomRota = E.vend.filter((v) => (v.visP || 0) > 0);
  const temRota = VcomRota.length > 0;

  // 1. Equipe sem rota de visitas de rua (ex.: AS / Key Account / Televendas / Cristiano TSJ)
  if (!temRota) {
    const Vs = E.vend.slice().sort((a, b) => (b.dig || 0) - (a.dig || 0));
    const zerados = Vs.filter((v) => !v.ped && !v.dig);
    const cab = [
      `📋 *Dia da ${E.nome}* (${hojeSP().slice(8, 10)}/${hojeSP().slice(5, 7)})`,
      `💰 Digitado hoje: *${R$(totGeral)}* em *${totPed} pedido(s)*` + (totPed ? ` · ticket médio ${R$(totGeral / totPed)}` : ''),
      ''
    ];
    const linhas = Vs.map((v) => {
      const icone = v.dig > 0 ? '✅' : '◻️';
      const pedTxt = v.ped ? ` · ${v.ped} ped.` : ' · sem pedido hoje';
      return `• ${icone} *${vn(v)}*: ${R$(v.dig)}${pedTxt}`;
    });
    const lidoMin = Vs.map((v) => v.pedLidoEm).filter(Boolean).sort()[0];
    if (lidoMin && !(B && B._clube)) cab.splice(2, 0, `_Pedidos lidos até ${new Date(lidoMin).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })} (leitura mais antiga da equipe)._`);
    // CEVEN fora (12/11/2026): sem as visitas de hoje, 'sem pedido' nao vira cobranca
    const sugestao = B && B._reserva && !B._clube ? 'ainda sem a leitura das visitas de hoje (Clube da Venda): quem está sem pedido não deve ser cobrado por isso agora.' : zerados.length
      ? `ainda sem pedido hoje: ${zerados.map((z) => nome2(z.nome)).slice(0, 3).join(', ')}.`
      : 'equipe inteira com pedidos digitados hoje! Golaço!';
    return [
      ...cab,
      ...linhas,
      '',
      SUGESTAO + sugestao
    ].join('\n');
  }

  // 2. Equipe com vendedores em rota de visitas (varejo ou mista)
  const L = [];
  for (const v of E.vend) {
    let semMes = null;
    if ((v.visP || 0) > 0) {
      try { semMes = (await semCompraNaRota(B, v)).sem.length; } catch (e) { semMes = null; }
    }
    const temVisita = (v.visP || 0) > 0;
    const icone = (temVisita && !v.ped) ? '⚠️' : v.dig > 0 ? '✅' : '◻️';
    const visTxt = temVisita ? ` · ${v.visF}/${v.visP} visitas (${v.comVenda} com venda)` : '';
    const semMesTxt = semMes != null ? ` · ${semMes} sem compra no mês` : '';
    const pedTxt = v.ped ? ` · ${v.ped} ped.` : (temVisita ? ' · sem pedido' : ' · sem pedido hoje');
    const prioridade = (temVisita && !v.ped) ? 0 : v.dig > 0 ? 1 : 2;
    L.push({
      prio: prioridade,
      dig: v.dig || 0,
      texto: `• ${icone} *${vn(v)}*: ${R$(v.dig)}${pedTxt}${visTxt}${semMesTxt}`
    });
  }
  L.sort((a, b) => a.prio - b.prio || b.dig - a.dig);

  const totVisF = VcomRota.reduce((s, v) => s + (v.visF || 0), 0);
  const totVisP = VcomRota.reduce((s, v) => s + (v.visP || 0), 0);
  const totZeradosRota = VcomRota.filter((v) => !v.ped).length;

  const cab = [
    `📋 *Dia da ${E.nome}* (${hojeSP().slice(8, 10)}/${hojeSP().slice(5, 7)})`,
    `💰 Digitado hoje: *${R$(totGeral)}* em *${totPed} ${totPed === 1 ? 'pedido' : 'pedidos'}*`,
    `🚶 Visitas da rota: *${totVisF} de ${totVisP}* feitas` + (totZeradosRota > 0 ? ` · *${totZeradosRota} ${totZeradosRota === 1 ? 'vendedor' : 'vendedores'} com rota e sem pedido*` : ''),
    ''
  ];

  return [
    ...cab,
    ...L.map((x) => x.texto),
    '',
    '_Legenda: ⚠️ rota e sem pedido · ✅ pedido digitado · ◻️ sem pedido_',
    SUGESTAO + (totZeradosRota ? `comece pelos ⚠️ (rota e sem pedido). ` : '') + 'Para abrir um vendedor, mande o *nome* ou o *código* (ex.: "clientes 352"); para o *+MIX* da rota dele, depois mande "+mix"; para receber *cada vendedor em uma mensagem*, mande "um por um".'
  ].join('\n');
}

// VENDEDORES SEM NENHUMA VISITA HOJE, na hierarquia (Vitorio, 27/10/2026: "so queria saber os sem nenhuma visita ainda... como sou da diretoria, teria que mostrar
// a hierarquia filial, supervisor, vendedor"; Evandro: "lista completa dos vendedores sem visita, hoje, por filial")
// Evandro (04/11/2026): separar e agrupar Varejo e AS em blocos distintos (separados por --- ou seções claras)
export function respSemVisita(E) {
  const V = E.vend.filter((v) => v.visP > 0 && !v.visF);
  if (!V.length) return `✅ *${E.nome}*: todo vendedor com rota hoje já fez pelo menos uma visita.`;

  const ehAS = (v) => /^(AS|FARMA|KEY|ATACADO)\b/i.test(String(v.canal || '').trim()) || /\bAS\b/i.test(String(v.supervisor || ''));
  const Varejo = V.filter((v) => !ehAS(v));
  const AS = V.filter(ehAS);

  const montaBloco = (tituloCanal, lista) => {
    if (!lista.length) return `📍 *${tituloCanal}*: todos com rota hoje já fizeram visita.`;
    const porF = new Map();
    for (const v of lista) {
      const f = porF.get(v.filial) || new Map();
      const s = v.supervisor || 'sem supervisor';
      (f.get(s) || f.set(s, []).get(s)).push(v);
      porF.set(v.filial, f);
    }
    const L = [`🚶 *${tituloCanal} — Sem visita hoje* (${lista.length} vendedores):`];
    for (const [f, S] of [...porF].sort((a, b) => [...b[1].values()].flat().length - [...a[1].values()].flat().length)) {
      L.push('', `*${f}* (${[...S.values()].flat().length})`);
      for (const [s, vs] of S) {
        L.push(`  _${sn(s)}_: ` + vs.map((v) => `${vn(v)} (0/${v.visP}${v.vendeuHoje ? ' · já vendeu' : ''})`).join(' · '));
      }
    }
    return L.join('\n');
  };

  const partes = [];
  if (Varejo.length) partes.push(montaBloco('VAREJO', Varejo));
  if (AS.length) partes.push(montaBloco('AS (AUTOSSERVIÇO)', AS));

  const resposta = partes.join('\n\n---\n\n') + '\n\n' + SUGESTAO + 'ligar para os supervisores com mais vendedores parados; peça "clientes <vendedor>" para ver a rota de um.';
  return resposta;
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

// CAMPANHAS DO VENDEDOR (Vitorio, 09/11/2026, indice 15 do menu): as tags de campanha dos clientes do roteiro do mes (foco por industria),
// quantos clientes cada uma tem e quantos ja compraram no mes (faturado ou pedido do mes). Recorrencia fica no indice 8.
export async function respCampanhasVendedor(B, v, escolha = null, todos = false) {
  const R = Array.isArray(v.roteiroMes) ? v.roteiroMes : [];
  if (!R.length) return `🏷️ *Campanhas — ${vn(v)}*: não há roteiro do mês na base para montar as campanhas dos seus clientes.`;
  const { vendasEscopo } = await import('./vendas.js'); const VM = await vendasEscopo(B, { filiais: [v.filial], rca: v.rca, vend: [v] }).catch(() => null);
  const compraram = new Set(((VM && VM.linhas) || []).filter((l) => String(l.r) === String(v.rca)).map((l) => String(l.c)));
  for (const k of await clientesComPedidoNoMes(B, [v.filial], v.rca)) compraram.add(k.split('|')[1]);
  // MESMA CONTA DA CURVA (5) (auditoria Tamara 10/11/2026: carteira 42 x curva 46): status positivado no roteiro ou ultima compra dentro do mes tambem conta
  { const m1 = hojeSP().slice(0, 7) + '-01'; for (const c of (Array.isArray(v.roteiroMes) ? v.roteiroMes : [])) if (/POSITIVADO|EFETIVADO/.test(String(c.status || '')) || String(c.data_ultima_compra || '').slice(0, 10) >= m1) compraram.add(String(c.id_cliente)); }
  const T = new Map();
  for (const c of R) for (const f of c.focos || []) {
    const tag = titulo(String(f.industria_foco || '').trim()); if (!tag || /recorr/i.test(tag)) continue;
    if (!T.has(tag)) T.set(tag, new Map()); T.get(tag).set(String(c.id_cliente), c);
  }
  if (!T.size) return `🏷️ *Campanhas — ${vn(v)}*: nenhum cliente do seu roteiro do mês tem tag de campanha.`;
  const L = [...T.entries()].map(([tag, cs]) => { const tot = cs.size, comp = [...cs.keys()].filter((k) => compraram.has(k)).length; return { tag, tot, comp }; }).sort((a, b) => (b.tot - b.comp) - (a.tot - a.comp));
  // CAMPANHA ESCOLHIDA PELO NUMERO (Vitorio, 10/11/2026): a TAG exata da lista e a mesma conta da lista (antes 'Skittles' juntava 'Skittles Sem Compras P11': 16 de 66 virava 19 de 97)
  if (escolha) {
    const x = L.find((y) => y.tag === escolha); if (!x) return `🏷️ Não achei a campanha *${escolha}* no seu roteiro do mês.`;
    const cs = [...T.get(x.tag).values()], hojeIds = new Set((v.rotaHoje || []).map((c) => String(c.id_cliente)));
    const falta = cs.filter((c) => !compraram.has(String(c.id_cliente))), hoje = falta.filter((c) => hojeIds.has(String(c.id_cliente))), resto = falta.filter((c) => !hojeIds.has(String(c.id_cliente)));
    const dd = (s) => (s && s >= '2000' ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : 'sem compra'), lin = (c, i) => `${i + 1}. ${titulo(c.nome_cliente || c.razao_social || 'cliente')} (#${c.id_cliente}) · última compra ${dd(String(c.data_ultima_compra || '').slice(0, 10))}`;
    const lim = todos ? 200 : 20;
    return [`🏷️ *${x.tag} — ${vn(v)}*`, `*${x.comp} de ${x.tot}* clientes já compraram · faltam *${x.tot - x.comp}*`,
      ...(hoje.length ? ['', `📍 *Na rota de hoje e sem compra (${hoje.length}):*`, ...hoje.map((c, i) => lin(c, i))] : ['', '_Nenhum cliente dessa campanha sem compra na rota de hoje._']),
      ...(resto.length ? ['', `*Outros sem compra no mês (${resto.length}):*`, ...resto.slice(0, lim).map((c, i) => lin(c, hoje.length + i)), ...(resto.length > lim ? [`_… e mais ${resto.length - lim}. Peça *ver mais*._`] : [])] : []),
      '', SUGESTAO + (hoje.length ? `comece pelos ${hoje.length} da rota de hoje.` : 'encaixe esses clientes nas próximas visitas.')].join('\n');
  }
  return [`🏷️ *Campanhas e TAGs do mês — ${vn(v)}*`, '_Todas as TAGs do seu roteiro do mês (combos, foco, P11…), menos recorrência (essa é o 8) · quantos clientes já compraram (faturado ou pedido)_', '',
    ...L.map((x, i) => `${i + 1}. *${x.tag}*: ${x.comp} de ${x.tot} clientes já compraram · faltam *${x.tot - x.comp}*`),
    '', '👉 *Digite o número da campanha* para ver os clientes que faltam.'].join('\n');
}

// MINHA CARTEIRA (indice 14 do menu): quantos clientes o vendedor tem no roteiro do mes, a meta de positivacao do CEVEN e quantos ja compraram
export async function respCarteiraVendedor(B, v) {
  // CARTEIRA PELO GEROT (17/11/2026, regua: item 14 respondia "Roteiro do mes: sem dado na base"): carteira por cliente do GEROT, a mesma conta da curva (5)
  if (B.env && B.env.DB) {
    try {
      const { results: GC } = await B.env.DB.prepare('SELECT dados FROM gerot_cliente_mes WHERE mes = ? AND filial = ? AND rca = ?').bind(hojeSP().slice(0, 7), String(v.filial), String(v.rca)).all();
      if (GC && GC.length) {
        const D = GC.map((x) => { try { return JSON.parse(x.dados || '{}'); } catch (e) { return {}; } });
        const n = (d, k) => Number(d[k]) || 0;
        const comp = D.filter((d) => n(d, 'Positivação (filial + CNPJ)') > 0).length, cart = D.filter((d) => !(n(d, 'Positivação (filial + CNPJ)') > 0) && n(d, 'Positivação + Carteira') > 0).length;
        const m1 = D.filter((d) => n(d, 'Positivação M-1') > 0).length, semNada = D.length - comp - cart;
        const voltou = D.filter((d) => n(d, 'Positivação (filial + CNPJ)') > 0 && !(n(d, 'Positivação M-1') > 0)).length;
        return [`👥 *Minha carteira — ${vn(v)}* (${v.filial})`,
          `📋 *${N(D.length)} clientes* na carteira`,
          `✅ Compraram no mês: *${N(comp)}*` + (voltou ? ` (${N(voltou)} não tinham comprado no mês passado)` : ''),
          `⏳ Com pedido a faturar: *${N(cart)}*`,
          `🔴 Sem compra e sem pedido: *${N(semNada)}*`,
          `📅 Compraram no mês passado: *${N(m1)}*`,
          v.metaPos ? `🎯 Positivação: *${N(comp)}* de ${N(Math.round(v.metaPos))} da meta (${Math.round(comp / v.metaPos * 100)}%)` : '',
          '', `👉 Digite *5* no menu para a lista de quem falta.`].filter((x) => x !== '').join('\n');
      }
    } catch (e) { /* sem GEROT por cliente: segue o roteiro */ }
  }
  const R = Array.isArray(v.roteiroMes) ? v.roteiroMes : [];
  const ids = new Set(R.map((c) => String(c.id_cliente)));
  const { vendasEscopo } = await import('./vendas.js'); const VM = await vendasEscopo(B, { filiais: [v.filial], rca: v.rca, vend: [v] }).catch(() => null);
  const compraram = new Set(((VM && VM.linhas) || []).filter((l) => String(l.r) === String(v.rca)).map((l) => String(l.c)));
  for (const k of await clientesComPedidoNoMes(B, [v.filial], v.rca)) compraram.add(k.split('|')[1]);
  // MESMA CONTA DA CURVA (5) (auditoria Tamara 10/11/2026: carteira 42 x curva 46): status positivado no roteiro ou ultima compra dentro do mes tambem conta
  { const m1 = hojeSP().slice(0, 7) + '-01'; for (const c of (Array.isArray(v.roteiroMes) ? v.roteiroMes : [])) if (/POSITIVADO|EFETIVADO/.test(String(c.status || '')) || String(c.data_ultima_compra || '').slice(0, 10) >= m1) compraram.add(String(c.id_cliente)); }
  const jaNaCarteira = [...ids].filter((k) => compraram.has(k)).length;
  return [`👥 *Minha carteira — ${vn(v)}* (${v.filial})`,
    ids.size ? `📋 Clientes no seu roteiro do mês: *${ids.size}*` : '📋 Roteiro do mês: sem dado na base',
    `🎯 Positivação (painel do ${v.reforco && v.reforco.financeiro && /GEROT.*positiva/i.test(String(v.reforco.financeiro.fonte || '')) ? 'GEROT' : 'base'}): *${v.pos ?? 'sem dado'}* de ${v.metaPos ?? 'sem dado'} clientes da meta`,
    ...(ids.size ? [`✅ Do roteiro, já compraram no mês (faturado ou pedido): *${jaNaCarteira}* · faltam *${ids.size - jaNaCarteira}*`] : []),
    '', '👉 Digite *5* no menu para a lista de quem falta.'].join('\n');
}

// CAMPANHAS E TAGS DA EQUIPE (menu do supervisor, 12; Vitorio 10/11/2026): mesma conta do 15 do vendedor, somada por TAG; escolha = uma TAG aberta por vendedor
export async function respCampanhasEquipe(B, E, escolha = null) {
  const { vendasEscopo } = await import('./vendas.js');
  const m1 = hojeSP().slice(0, 7) + '-01', T = new Map();
  for (const v of (E.vend || [])) {
    const R = Array.isArray(v.roteiroMes) ? v.roteiroMes : []; if (!R.length) continue;
    const VM = await vendasEscopo(B, { filiais: [v.filial], rca: v.rca, vend: [v] }).catch(() => null);
    const comp = new Set(((VM && VM.linhas) || []).filter((l) => String(l.r) === String(v.rca)).map((l) => String(l.c)));
    for (const k of await clientesComPedidoNoMes(B, [v.filial], v.rca)) comp.add(k.split('|')[1]);
    for (const c of R) if (/POSITIVADO|EFETIVADO/.test(String(c.status || '')) || String(c.data_ultima_compra || '').slice(0, 10) >= m1) comp.add(String(c.id_cliente));
    for (const c of R) for (const f of c.focos || []) {
      const tag = titulo(String(f.industria_foco || '').trim()); if (!tag || /recorr/i.test(tag)) continue;
      if (!T.has(tag)) T.set(tag, new Map()); const pv = T.get(tag); if (!pv.has(v)) pv.set(v, { tot: new Set(), comp: 0 }); const x = pv.get(v);
      if (!x.tot.has(String(c.id_cliente))) { x.tot.add(String(c.id_cliente)); if (comp.has(String(c.id_cliente))) x.comp++; }
    }
  }
  if (!T.size) return `🏷️ *Campanhas — ${E.nome}*: nenhum cliente do roteiro do mês da equipe tem tag de campanha.`;
  const L = [...T.entries()].map(([tag, pv]) => { let tot = 0, comp = 0; for (const x of pv.values()) { tot += x.tot.size; comp += x.comp; } return { tag, pv, tot, comp }; }).sort((a, b) => (b.tot - b.comp) - (a.tot - a.comp));
  if (escolha) {
    const x = L.find((y) => y.tag === escolha); if (!x) return `🏷️ Não achei a campanha *${escolha}* na equipe.`;
    return [`🏷️ *${x.tag} — ${E.nome}*`, `*${x.comp} de ${x.tot}* clientes já compraram · faltam *${x.tot - x.comp}*`, '', '*Por vendedor:*',
      ...[...x.pv.entries()].sort((a, b) => (b[1].tot.size - b[1].comp) - (a[1].tot.size - a[1].comp)).map(([v, y]) => `• ${vn(v)}: ${y.comp} de ${y.tot.size} · faltam *${y.tot.size - y.comp}*`),
      '', SUGESTAO + 'para ver os clientes de um vendedor, use o *15* do menu e abra a campanha no menu dele.'].join('\n');
  }
  return [`🏷️ *Campanhas e TAGs do mês — ${E.nome}*`, '_Todas as TAGs do roteiro do mês da equipe (combos, foco, P11…), menos recorrência (essa é o 6)_', '',
    ...L.map((x, i) => `${i + 1}. *${x.tag}*: ${x.comp} de ${x.tot} clientes já compraram · faltam *${x.tot - x.comp}*`),
    '', '👉 *Digite o número da campanha* para ver por vendedor.'].join('\n');
}

// "QUEM FALTA VISITAR HOJE" do vendedor (18/11/2026): mesma conta da "minha rota" (semCompraNaRota: rota do Clube, check-in do Clube, pedido do mes e ultima compra
// da ficha) — so os ⏳. Antes os dias vinham da ultima compra gravada pelo CEVEN e nao batiam com a "minha rota" (Posto Pegoraro: comprou no mes x '22 dias').
export async function respFaltaVisitar(B, v) {
  const { rota, sem: semC, valorMes, pedidoHoje } = await semCompraNaRota(B, v);
  if (!rota.length) return `📍 *${vn(v)}* — sem clientes na rota de hoje.`;
  const semMap = new Map(semC.map((x) => [String(x.c.id_cliente), x]));
  const falta = rota.filter((c) => emojiVisita(c, pedidoHoje) === '⏳');
  const dias = (c) => { const x = semMap.get(String(c.id_cliente)); return x ? x.dias : -1; };
  falta.sort((a, b) => (dias(b) ?? 9999) - (dias(a) ?? 9999));
  const fim = (c) => { const x = semMap.get(String(c.id_cliente)); if (x) return diasTxt(x.dias); const r = valorMes.get(String(c.id_cliente)); return r ? R$(r) : '✔️'; };
  const L = [`📍 *${vn(v)}* — faltam *${falta.length}* de ${rota.length} na rota de hoje`];
  if (!falta.length) return [...L, '✅ Rota de hoje toda visitada.'].join('\n');
  L.push('_⏳ a visitar · nº = dias sem compra · 🆕 sem compra registrada · R$ = já comprou no mês · 🏷️ tag_', '');
  falta.slice(0, 30).forEach((c, i) => L.push(`${i + 1}. ${titulo(c.nome_cliente || c.razao_social || 'cliente')} (#${c.id_cliente}) · ⏳ · ${fim(c)}${tagsCurtas(c)}`));
  if (falta.length > 30) L.push(`… e mais ${falta.length - 30}`);
  L.push('', '*Digite o número* do cliente para ver a ficha dele.');
  return L.join('\n');
}

// ULTIMA COMPRA = DATA DO PEDIDO mais recente (18/11/2026): no GEROT a data do pedido faturado e a da NOTA (Posto Pegoraro: pediu 17/11, faturou 18/11 e aparecia
// '0 dias'). Vale a ENTRADA do pedido (gerot_pedido_entrada, desde 17/11) ou, sem ela, a data da nota; o pedido do Clube (clube_pedido) e a ficha. A mais recente.
// Altera e devolve o mapa id_cliente -> 'AAAA-MM-DD'.
export async function ultimaCompraGerot(B, filial, ids, mapa = new Map()) {
  if (!B || !B.env || !B.env.DB || !ids || !ids.length) return mapa;
  const poe = (cli, d0) => { const d = String(d0 || '').slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d <= hojeSP() && !(String(mapa.get(String(cli)) || '') > d)) mapa.set(String(cli), d); };
  try {
    for (let i = 0; i < ids.length; i += 80) {
      const p = ids.slice(i, i + 80).map(String), q = p.map(() => '?').join(',');
      const [{ results: G }, { results: C }] = await Promise.all([
        B.env.DB.prepare(`SELECT p.cliente, MAX(COALESCE(e.entrada, p.data)) d FROM gerot_pedido p LEFT JOIN gerot_pedido_entrada e ON e.filial = p.filial AND e.pedido = p.pedido WHERE p.filial = ? AND p.cliente IN (${q}) GROUP BY p.cliente`).bind(String(filial), ...p).all(),
        B.env.DB.prepare(`SELECT cliente, MAX(dia) d FROM clube_pedido WHERE filial = ? AND cliente IN (${q}) GROUP BY cliente`).bind(String(filial), ...p).all().catch(() => ({ results: [] })),
      ]);
      for (const r of G || []) poe(r.cliente, r.d);
      for (const r of C || []) poe(r.cliente, r.d);
    }
  } catch (e) { /* sem GEROT: fica a ficha */ }
  return mapa;
}
