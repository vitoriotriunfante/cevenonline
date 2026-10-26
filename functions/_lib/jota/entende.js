// =========================================================================
// JOTA · functions/_lib/jota/entende.js
// O QUE É: ENTENDER a pergunta e escolher a resposta (roteamento) + IA de reserva.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { FILIAIS, FRX, R$, SUGESTAO, VAREJO, fraca, nome2, sem, titulo } from './base.js';
import { PAL, achaPessoa, agrupa, carregaEscopo, pctTxt, supChave, supNome, supReal } from './escopo.js';
import { SEM_HISTORICO, respCarteira, respComparar, respDobradinha, respInfoEquipe, respMaiorGap, respMetaBatida, respPontosPerdidos, respRankingGerentes, respRankingSupervisores, respRitmo } from './respostas/gestao.js';
import { respBola, respDevMotivos, respDivergencias, respIncentivoOficial, respLigaAs, respSemana } from './respostas/indicadores.js';
import { respAjuda, respCompromisso, respGlossario, respLances, respLiga, respMix } from './respostas/liga_mix.js';
import { respMetasIndustria } from './respostas/metas_industria.js';
import { respGestaoCampo, respOperacao, respRecorrenciaLances, respRelatorio } from './respostas/operacao.js';
import { respJustificativas, respOferecer, respSemDado } from './respostas/oportunidades.js';
import { respClientesSemComprar, respComparaMes, respDiasSemPedido } from './respostas/periodos.js';
import { respFalta, respHoje, respPorSupervisor, respResumo, respSupervisor, respVendedor } from './respostas/resumo.js';
import { respAVisitar, respClientesDia, respDevolucao, respPositivacao, respRanking, respVisitas, respZerados } from './respostas/rota.js';
import { SEM_VENDAS, naoVende, respCliente, respIndustria, respMarcaPropriaVivo, respPreco, respProduto, respRecuperacao, respTopProdutos } from './respostas/vendas.js';

export async function respostaPronta(B, c, texto, anteriores) {
  const fm = sem(texto).match(FRX);
  const outra = (c.papel === 'gerente' || c.papel === 'supervisor' || c.papel === 'vendedor') && c.filial && fm && fm[1] !== c.filial ? `_Você vê só ${c.filial}${c.grupo ? ' · ' + titulo(c.grupo) : ''}; outras filiais são com a diretoria._\n\n` : '';
  const r = await respostaInterna(B, c, texto, anteriores);
  // pergunta composta (Vitorio, 25/10/2026: "nao tem positivacao aberta por vendedor? ranking? e o ranking da champions?" -> so a 1a parte foi respondida)
  const tc = sem(texto);
  if (r && /Champions Triunfante/.test(r) && /PENALTI|IMPEDIMENTO|CARTAO|LANCE/.test(tc)) { const l = await respostaInterna(B, c, /IMPEDIMENTO/.test(tc) ? 'impedimentos' : /CARTAO/.test(tc) ? 'cartoes' : 'penaltis', anteriores); if (l) return outra + r + '\n\n' + l; }
  if (r && /CHAMPION|CHMAPION|CHAMPIOS|CAMPIONS|CHAMPI|\bLIGA\b/.test(tc) && !/Champions Triunfante|Liga AS/.test(r) && /\bE (O|A)\b|\?.*\?|\bTAMBEM\b/.test(tc)) { const l = await respostaInterna(B, c, 'liga', anteriores); if (l) return outra + r + '\n\n' + l; }
  return r && (r.fraca ? fraca(outra + r) : outra + r);
}
export async function respostaInterna(B, c, texto, anteriores) {
  const t = sem(texto);
  // escopo: gerente = a filial dele; diretoria = a filial citada, senao o Brasil
  const fm = t.match(FRX);
  if (c.papel === 'vendedor' && !(c.filial && c.rca)) return 'Seu cadastro no Jota está sem filial ou código RCA. Peça para a diretoria completar na tela de contatos.';
  const preso = (c.papel === 'gerente' || c.papel === 'supervisor' || c.papel === 'vendedor') && c.filial;
  const fil = preso ? c.filial : fm ? fm[1] : null;
  const grupo = preso ? c.grupo || null : null;
  const supervisor = c.papel === 'supervisor' ? c.supervisor || c.nome : null;
  const rcaV = c.papel === 'vendedor' ? String(c.rca) : null;
  const esc = rcaV ? { nome: nome2(c.nome) + ' (RCA ' + rcaV + ')', filiais: [fil], grupo: null, supervisor: null, rca: rcaV, nacional: false }
    : fil ? { nome: supervisor ? 'Equipe ' + nome2(supervisor) + ' (' + fil + ')' : fil + (grupo ? ' · ' + titulo(grupo) : ''), filiais: [fil], grupo: supervisor ? null : grupo, supervisor, nacional: false } : { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true };
  if (/^(OI|OLA|E AI|AJUDA|MENU|INICIO|COMECAR|BOM DIA|BOA TARDE|BOA NOITE)\b[ !?.]*$|O QUE (VOCE|VC) (SABE|FAZ|RESPONDE)|^AJUDA/.test(t)) return respAjuda(c);
  if (/O QUE (E|EH|SIGNIFICA)|COMO FUNCIONA|COMO (E|EH) CALCULAD|QUE QUER DIZER|DEFINICAO/.test(t)) { const g = respGlossario(t); if (g) return g; }
  if (/DIVERGENC/.test(t) && c.papel === 'diretoria') return respDivergencias(B);
  if (/BOLA CHEIA/.test(t)) return respBola(B, esc);
  if (/SEMANA/.test(t) && /COMPROMISSO|\bRETS?\b|SUPERVISOR/.test(t)) return respSemana(B, await carregaEscopo(B, esc));
  if (/ATESTADO|DEMITID|DESLIGAD|FERIAS|AFASTAD|LICENCA|DESCONSIDER|SAIU DA EMPRESA|PEDIU DEMISSAO/.test(t) && c.papel !== 'vendedor') return respInfoEquipe(B.env, c, texto);
  if (/DOBRADINHA|DUAS QUINZENAS/.test(t)) return respDobradinha(B, await carregaEscopo(B, esc));
  if (/HISTORICO DIARIO/.test(t)) return SEM_HISTORICO;
  if (/HORARIOS? DAS? ATUALIZA|QUANDO (VOCE|VC) ATUALIZA|DE QUANTO EM QUANTO/.test(t)) return '⏱️ *Atualizações:* a base do CEVEN é lida a cada 2 min (06h–21h, seg–sáb; fora disso a cada 30 min). Lances da Liga a cada 5 min. Vendas item a item: toda madrugada (até ontem). Relatórios do WhatsApp: 07:45, 10:00, 11:30, 14:30, 17:00 e 18:30.';
  if (/\bTAGS?\b|FALTA FOCO|COMBO|CHAMP KITEKAT|SEM COMPRAS P11|VOLTA COMIGO|CAMPANHA/.test(t) && !/RECORRENCIA/.test(t)) return 'As *tags de campanha* (FALTA FOCO MARS, COMBO, SEM COMPRAS P11…) eu só enxergo nos clientes da *rota de hoje*. A positivação por tag no mês ainda não está na base (está na lista da reunião de metas). Para a RECORRÊNCIA eu tenho: peça "recorrência".';
  const ehMP = /MARCAS? PROPRIAS?|ZIPOCA|CALIRA|MITBIT|BELLARONE|SKIVE/.test(t);
  if (/RELATORIO|BOLETIM|DISPARO|MENSAGEM DAS|COMO FECHOU|\bONTEM\b/.test(t) && !/COMPR|PRODUTO|CLIENTE/.test(t) || (ehMP && /RELATORIO|10[:H ]?00|\b10H\b/.test(t))) return respRelatorio(B, c, t);
  if (/GESTAO DE CAMPO|SUPERVISORES EM CAMPO|EM ROTA \(RET\)|RANKING DE ATIVIDADE/.test(t) || (/COMPROMISSO|\bRET\b/.test(t) && /POR FILIAL|RANKING|PERCENT|%/.test(t))) return respGestaoCampo(B, await carregaEscopo(B, esc));
  if (/CORTE|CORTAD|BLOQUEAD|RETID|PERDAS|OPERACAO|RANKING DE VENDAS|RANKING FINAL|FECHAMENTO DO DIA|DEVOLUC\w* (DE |ENTRADAS? )?HOJE|ENTRADAS? HOJE/.test(t)) return respOperacao(B, await carregaEscopo(B, esc), t);
  if (/RECORRENCIA|RESGAT|REATIVAD|INATIVOS? (RECUPERAD|REATIVAD)/.test(t) && !/O QUE (E|EH)/.test(t)) return respRecorrenciaLances(B, await carregaEscopo(B, esc));
  if (/MOTIVO|POR ?QUE/.test(t) && /DEVOLU|DEVOLVID|VOLTOU DE MERCADORIA/.test(t)) return respDevMotivos(B);
  if (/COMPROMISSO|MATINAL|\bRET\b|\bRETS\b|ROTA DO SUPERVISOR/.test(t)) return respCompromisso(B, await carregaEscopo(B, esc));
  if (/PENALTI|PENALIDADE|IMPEDIMENTO|CARTA|VERMELHO|AMARELO|GOL CONTRA|\bGOLS?\b|LANCES?\b|HAT ?TRICK|DEFESAS?\b|CHECK.?IN FORA|FORA DO CLIENTE|00:00|CARTO(ES|ESS)?\b/.test(t) && !/LIGA|CHAMPIONS|CLASSIFICA|PONTOS? (FOMOS|PERDID|PENALIZ)|PENALIZAD/.test(t)) return respLances(B, await carregaEscopo(B, esc), t);
  if (/\+ ?MIX|MAIS ?MIX|\bMIX\b/.test(t) && !/COMPROU|COMPRARAM|PRECO/.test(t)) return respMix(B, await carregaEscopo(B, esc), t);
  { const sd = respSemDado(t); if (sd) return sd; }
  const E = await carregaEscopo(B, esc);
  // PROJECAO (regra do Vitorio: nunca estimar/projetar): diz que nao projeta e mostra quanto precisa por dia
  if (/PROJE|PREVISAO|VAMOS FECHAR|VAI FECHAR|QUANTO (VAMOS|VAI|IREMOS) FECHAR|FECHAMENTO DO MES|ESTIMATIVA/.test(t)) return '🚫 *Projeção eu não faço* (regra da casa: só número real, nunca estimativa). O que eu mostro é quanto *precisa* por dia para bater a meta:\n\n' + await respFalta(B, E);
  if (/PERDENDO VENDA|PERDEMOS VENDA|ONDE (ESTAMOS )?PERDE|OPORTUNIDADES?\b/.test(t) && !/\+ ?MIX|MAIS ?MIX/.test(t)) return '🔎 *Onde estamos perdendo venda* (o que mais caiu contra o mês passado até o mesmo dia):\n\n' + await respComparaMes(B, E, 'MES PASSADO', null);
  if (/OFERECER|O QUE (EU )?(POSSO |DEVO )?(VENDER|LEVAR) (PRO|PARA|NO|NA)|SUGESTAO PARA O CLIENTE|(LEVAR|SUGERIR) (PRO|PARA O|PARA A|NO|NA) |PRODUTOS? (LEVAR|OFERECER|SUGERIR)/.test(t)) { const r = await respOferecer(B, E, t); if (r) return r; }
  let pessoa = achaPessoa(E, t);
  if (E.rca && E.vend[0]) pessoa = { tipo: 'vend', alvo: E.vend[0], empate: [E.vend[0]] };   /* vendedor: toda pergunta e sobre ele mesmo */
  if (!pessoa && /\b(ELA|ELE|DELA|DELE|DESSA|DESSE|ESSA|ESSE|NELA|NELE|PRA ELA|PRA ELE|MESMA|MESMO)\b/.test(t)) for (const h of anteriores || []) { pessoa = achaPessoa(E, sem(h)); if (pessoa) break; }
  // motivos de nao venda NO PERIODO (mes, semana, mes passado) ou do grupo: resumo noturno; os de HOJE seguem para a rota do dia
  if (/MOTIVO|JUSTIFICATIV|DESCULPA|POR ?QUE .{0,30}NAO .{0,15}COMPR|POR QUE (OS )?CLIENTES? NAO (COMPRA|COMPRAM)|PORQUE (OS )?CLIENTES? NAO COMPRA|NAO VENDA/.test(t) && !/DEVOLU/.test(t) && (/\bMES\b|SEMANA|PASSAD|NO MES|DO MES|SETEMBRO|OUTUBRO/.test(t) || !pessoa)) return respJustificativas(B, E, t, pessoa);
  if (pessoa && pessoa.tipo === 'vend' && !/COMPR|PRODUTO|SKU/.test(t) && /QUA(L|IS) (OS )?CLIENTES?|QUAIS\??$|JUSTIFICATIV|MOTIVO|NAO VENDEU|SEM VENDA|VISITOU|VISITAD|CHECK|ONDE (ELA|ELE) (FOI|ESTA)|POSITIVOU|VENDEU (PARA|PRA)/.test(t)) return respClientesDia(pessoa.alvo, t);
  // PERIODOS (25/10/2026): comparacao com o mes passado, dias sem pedido, clientes sem comprar
  if (/CLIENTE/.test(t) && /SEM COMPRAR|NAO COMPRA|PARADOS?|HA MAIS DE|DIAS SEM/.test(t)) return respClientesSemComprar(B, E, t);
  if (/DIAS (SEGUIDOS )?SEM (VENDER|PEDIDO|VENDA)|HA \d+ DIAS SEM|HA MAIS DE \d+ DIAS|\d+ DIAS SEM|SEM PEDIDO HA/.test(t)) return respDiasSemPedido(B, E, t);
  if (/MES PASSADO|MES ANTERIOR|SETEMBRO|AGOSTO|\bM-1\b|COMPARAD|EM RELACAO AO MES|CAIU|CRESCEU|EVOLUCAO|ESTE MES X|ESSE MES X/.test(t) && !/LIGA|CHAMPI|POSICAO|RANKING DA LIGA/.test(t) && !/SEMANA(L|IS)|POR SEMANA|SEMANA A SEMANA|DIA DA SEMANA|QUE DIA/.test(t) && !(t.match(new RegExp(FRX.source, 'g')) || []).slice(1).length) return respComparaMes(B, E, t, pessoa);
  // METAS DAS INDUSTRIAS = Premiacao RV do CEVEN (Vitorio, 25/10/2026)
  if (/\bMETAS?\b|OBJETIVOS?\b/.test(t)) { const r = await respMetasIndustria(B, E, t, pessoa); if (r) return r; }
  // vendas item a item (produto, industria, cliente, preco, top produtos, marca propria ao vivo)
  if (ehMP) { const r = await respMarcaPropriaVivo(B, E, t); return r || respRelatorio(B, c, t); }
  if (/PRECO|QUANTO SAIU/.test(t)) { const r = await respPreco(B, E, t); if (r) return r; }
  if (/COMPRAVA|PAROU|PARARAM|DEIXOU DE COMPRAR|DEIXARAM DE COMPRAR|RECUPERACAO D/.test(t)) { const r = await respRecuperacao(B, E, t); if (r) return r; }
  if (/PRODUTOS? (QUE )?MAIS VEND|TOP \d* ?PRODUTOS|\d+ PRODUTOS|QUAL PRODUTO MAIS|MAIS VENDIDOS/.test(t)) return respTopProdutos(B, E, t);
  if (/CLIENTE|LOJA/.test(t) && /COMPROU|COMPRA|ULTIMO PEDIDO|SEM COMPRAR|OFERECER|PRODUTOS D/.test(t) && !/CLIENTES QUE|QUAIS (OS )?CLIENTES|QUEM/.test(t)) { const r = await respCliente(B, E, t); if (r) return r; if (/OFERECER|ULTIMO PEDIDO|PRODUTOS D/.test(t)) return `🔎 Não achei esse cliente em ${E.nome} (vendas do mês). Confira o nome ou mande o código do cliente (ex.: #212704).`; }
  if (/COMPRA|COMPROU|COMPRARAM|VENDEU DE |VENDERAM DE |VENDEU (O|A) |VENDE DE |POSITIVACAO D[OEA]S? |(VENDE MAIS|MAIS VENDE)(?!U)(?!.*(SUPERVISOR|VENDEDOR|FILIAL|GERENTE))|EM QUANTOS CLIENTES|CLIENTES COMPRARAM|PDVS COMPRARAM|SEMANA(L|IS)|MENSA(L|IS)|DIA DA SEMANA|QUAL DIA|QUE DIA|MELHOR DIA|MES A MES|POR SEMANA|POSITIVAND|(SEGUNDA|TERCA|QUARTA|QUINTA|SEXTA|SABADO) OU /.test(t) || /\b(MONDELEZ|MARS|ARCOR|BAGLEY|CONDOR|FERRERO|NESTLE|HERSHEY|FINI|DORI|PEPSICO|KELLOGG|LACTA|DIVERSAO)\b/.test(t)) {
    const ri = await respIndustria(B, E, t, pessoa); if (ri && ri !== SEM_VENDAS) return ri;
    const rp = await respProduto(B, E, t, pessoa);
    if (rp === SEM_VENDAS || (!rp && !ri)) { const m = await respMix(B, E, t); if (m && !/^Não achei|^🧺 \*\+MIX —/.test(m)) return m; }   /* sem vendas item a item ainda: reserva = +MIX */
    if (rp) return rp;
    if (ri) return ri;
    const ind = (t.match(/\b(MONDELEZ|MARS|ARCOR|BAGLEY|CONDOR|FERRERO|NESTLE|HERSHEY|FINI|DORI|PEPSICO|KELLOGG|LACTA|DIVERSAO)\b/) || [])[1];
    if (ind) return naoVende(E, titulo(ind));   /* industria citada que a filial nao vende: dizer, nunca cair em outra resposta */
  }
  if (/CARTEIRA|A FATURAR|FATURADO (\+|MAIS|E) (CARTEIRA|PENDENTE)|SOMANDO|VOLUME FINANCEIRO|\bPENDENTE\b/.test(t)) return respCarteira(B, E);
  if (/RITMO|NO RITMO|VAMOS BATER|DA PRA BATER|PROJECAO/.test(t)) return respRitmo(B, E);
  if (/MAIOR GAP|MAIS LONGE DA META|MAIOR BURACO|\bGAP\b/.test(t) && !pessoa) return respMaiorGap(E);
  if (/PONTOS? (FOMOS |PERDID|PENALIZ)|PENALIZAD|PERDEMOS PONTOS/.test(t)) return respPontosPerdidos(B, E);
  if (/RANKING (DOS |DE )?GERENTES|QUAL GERENTE|GERENTE (ESTA |TA )?MELHOR/.test(t)) return respRankingGerentes(E.nacional ? E : await carregaEscopo(B, { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true }));
  if (/SUPERVISOR/.test(t) && /MAIS VENDEU|MAIS VENDE|VENDEU MAIS/.test(t)) { const S = [...agrupa(E.vend, (v) => supChave(v, E.nacional))].filter(([k]) => supReal(k)).sort((a, b) => b[1].dig - a[1].dig); return [`💰 *Supervisores que mais venderam hoje — ${E.nome}* (digitado)`, ...S.slice(0, 10).map(([k, x], i) => `${i + 1}. ${supNome(k)} — ${R$(x.dig)} · ${x.ped} ped.`)].join('\n'); }
  if (/SUPERVISOR/.test(t) && /RANKING|MELHORES|POR % DA META/.test(t) && E.nacional) return respRankingSupervisores(E);
  { const fs2 = [...new Set((t.match(new RegExp(FRX.source, 'g')) || []))]; if (fs2.length >= 2 && /COMPARA|\bX\b|VERSUS|\bVS\b|CONTRA|COM /.test(t) && c.papel === 'diretoria') { const r = await respComparar(B, fs2); if (r) return r; } }
  if (/BATERAM (A )?META|BATEU (A )?META|ATINGIRAM (A )?META|META BATIDA/.test(t) && !pessoa) return respMetaBatida(E);
  if (/INCENTIVO|GATILHO|110 ?%|\b110\b|BONUS|PREMIA|PREMIO|PREMIAC/.test(t)) return respIncentivoOficial(B, E, pessoa);
  if (/\bAS\b/.test(t) && /RANKING|VENCEDOR|LIGA|PONTOS/.test(t)) return respLigaAs(B, E, pessoa);
  if (/LIGA (DO |DOS |DA )?AS\b|LIGA DO ATACADO/.test(t) || (pessoa && pessoa.tipo === 'vend' && /^(AS|PET AS)$/.test(pessoa.alvo.canal) && /LIGA|PONTOS|POSICAO|CHAMPIONS/.test(t))) return respLigaAs(B, E, pessoa);
  if (/LIGA|CHAMPION|CHMAPION|CHAMPIOS|CAMPIONS|CHAMPI|CLASSIFICA|TABELA|POSICAO|PONTOS|PONTUACAO|COLOCAD/.test(t) && !(/POSITIVA|FATURA/.test(t) && /RANKING|POR VENDEDOR|ABERTA/.test(t))) return respLiga(B, E, pessoa && pessoa.tipo === 'vend' ? pessoa.alvo : null);
  if (/FALTA(M)? (SER )?VISITA|NAO (FOI |FORAM )?VISITAD|AINDA (NAO )?(FORAM )?VISITAD|CLIENTES? (EM )?ABERTO|PENDENTES? (DE |NA )?(VISITA|ROTA)|SEM VISITA AINDA|CLIENTES? (NA|DA) ROTA|FALTA VISITAR|FALTAM VISITAR|QUEM FALTA VISITAR/.test(t)) return respAVisitar(E, pessoa);
  if (pessoa && pessoa.tipo === 'sup' && /ZERAD|ZEROU|SEM PEDIDO/.test(t)) return respZerados({ ...E, nome: 'Equipe ' + nome2(pessoa.alvo.nome), vend: E.vend.filter((v) => v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial) });
  if (pessoa && pessoa.tipo === 'sup' && /MAIS VENDEU|MAIS VENDE/.test(t)) pessoa = null;
  if (pessoa) {
    const amb = pessoa.empate.length > 1 ? `\n\n_Achei mais de um: ${pessoa.empate.slice(0, 5).map((x) => titulo(x.nome) + ' ' + x.filial).join(' · ')}. Mande o nome completo se não for este._` : '';
    return (pessoa.tipo === 'sup' ? respSupervisor(E, pessoa.alvo) : await respVendedor(B, E, pessoa.alvo)) + amb;
  }
  if (/ZERAD|ZEROU|SEM PEDIDO|SEM VENDA|NAO VENDEU|NAO VENDERAM|NINGUEM VENDEU/.test(t)) return respZerados(E);
  if (/DEVOL/.test(t)) { const a = respDevolucao(E); const m = E.nacional ? await respDevMotivos(B) : null; return m ? a + '\n\n' + m : a; }
  if (/POSITIV/.test(t) && /QUANTOS|QUANTO/.test(t) && !/110/.test(t)) return respPositivacao(B, E);
  if (/QUANTO FALTA|FALTA (PARA|PRA|BATER)|\bFALTA\b|POR DIA UTIL|\bMN\b|PRECISA (VENDER|FATURAR)|POR DIA PRA|COMO BATER|BATER A META/.test(t)) return respFalta(B, E);
  if (/RANKING|MELHOR|PIOR|\bTOP\b|DESTAQUE|MAIS ATRAS|QUEM (ESTA|TA) (BEM|MAL)/.test(t)) return respRanking(E, t);
  if (/VISIT|EFICACIA|EFICIENCIA|ROTEIRO|CHECK.?IN/.test(t) && !/ACUMULADO|DIGITAD/.test(t)) return respVisitas(E);
  if (/POSITIVA/.test(t) && /POR VENDEDOR|RANKING|ABERTA POR|MELHORES|PIORES|TOP/.test(t)) return respRanking(E, t);
  if (/POSITIVA/.test(t)) return respPositivacao(B, E);
  if (/COMO (ESTA|TA|VAI|ESTAMOS|ANDA)|RESUMO|PANORAMA|STATUS|GERAL|SITUACAO/.test(t) && !/ACUMULADO|DIGITAD/.test(t)) return respResumo(B, E);
  if (/HOJE|\bHJ\b|ACUMULADO|DIGITAD|PEDIDOS?\b|TICKET|VENDEU|VENDERAM|\bDIA\b|ROTA|VAREJO/.test(t)) return respHoje(B, E, t);
  if (/QUEM COBRAR|PLANO DO DIA|O QUE (EU )?FACO|ONDE ATACAR/.test(t)) return respFalta(B, E);
  if (/SUPERVIS/.test(t) && /PIOR|PRA BAIXO|PARA BAIXO|ATRAS|PUXANDO|MAL\b/.test(t)) { const S = [...agrupa(E.vend, (v) => supChave(v, E.nacional))].filter(([k]) => supReal(k) && !/^VAGO/.test(k)).filter(([, x]) => x.meta > 0).sort((a, b) => (a[1].pct ?? 999) - (b[1].pct ?? 999)); if (S.length) { const [k, x] = S[0]; return [`🔻 *Quem está puxando ${E.nome} para baixo:* ${supNome(k)} — *${pctTxt(x.pct)}* da meta (fat. ${R$(x.fat)} de ${R$(x.meta)}, pend. ${R$(x.pend)})`, '', '*Os mais atrás:*', ...S.slice(0, 4).map(([k2, y], i) => `${i + 1}. ${supNome(k2)} — ${pctTxt(y.pct)} · gap ${R$(Math.max(0, y.meta - y.fat - y.pend))}`), '', SUGESTAO + `sentar hoje com ${supNome(k)} e abrir vendedor por vendedor (peça "supervisor ${supNome(k).split(' ')[0]}").`].join('\n'); } }
  if (/SUPERVIS|POR EQUIPE|ABERT|POR GERENTE/.test(t)) return respPorSupervisor(E);
  if (fm || /BRASIL|TODAS|NACIONAL|REDE|FILIAIS|QUAL FILIAL/.test(t)) { const r = await respResumo(B, E); const resto = t.split(/[^A-Z0-9]+/).filter((w) => w.length > 2 && !PAL.has(w) && !FILIAIS.includes(w) && !/^(BRASIL|TODAS|NACIONAL|REDE|FILIAIS|FILIAL|QUAL)$/.test(w)); return resto.length >= 2 ? fraca(r) : r; }
  return null;
}

// pergunta livre: IA gratuita com o resumo do escopo (nunca inventar)
export async function respondeIA(env, B, c, texto, historico) {
  if (!env.AI) return null;
  const t = sem(texto); const fm = t.match(FRX); const fil = c.papel === 'gerente' && c.filial ? c.filial : fm ? fm[1] : null;
  let base; try { base = await respResumo(B, await carregaEscopo(B, fil ? { nome: fil, filiais: [fil], grupo: c.papel === 'gerente' ? c.grupo : null, nacional: false } : { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true })); } catch (e) { base = 'sem dado'; }
  const sys = `Você é o JOTA, o assistente do +MIX da Triunfante no WhatsApp: colega de vendas animado e direto, que usa a linguagem do futebol da Champions Triunfante quando cabe. Responde em português do Brasil como um gerente comercial experiente.
Quem fala com você: ${titulo(c.nome)}, ${c.papel}${c.filial ? ' da filial ' + c.filial : ' (diretoria nacional: sem filial citada = Brasil todo)'}${c.grupo ? ', grupo ' + c.grupo : ''}.
REGRAS: use SÓ os números do RESUMO abaixo, exatamente como estão; nunca invente, estime ou projete; sem o dado, diga que não tem e sugira uma pergunta que o Jota responde (ex.: "hoje", "zerados", "por supervisor", "vendedor Nome", "falta", "liga", "+mix", "quem compra Oreo", "compromisso", "devoluções", "pênaltis", "incentivo").
Rota, visitas e eficácia = só varejo de campo. Faturado e pendente sempre separados. Formato WhatsApp: *negrito* com UM asterisco; no máximo 10 linhas; termine com "🎯 *Sugestão do Jota:*" e UMA ação concreta.
RESUMO: ${base.slice(0, 6000)}`;
  try { const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [{ role: 'system', content: sys }, ...historico, { role: 'user', content: texto }], max_tokens: 600 }); const s = String((r && (r.response || r.result)) || '').trim().replace(/\*\*/g, '*').replace(/^#+\s*/gm, ''); return s || null; } catch (e) { return null; }
}
