// =========================================================================
// JOTA · functions/_lib/jota/entende.js
// O QUE É: ENTENDER a pergunta e escolher a resposta (roteamento) + IA de reserva.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { sn } from './escopo.js';
import { FILIAIS, FRX, R$, SUGESTAO, VAREJO, fraca, hojeSP, nome2, sem, titulo, vn } from './base.js';
const x0 = (V) => (V[0] ? V[0].v.rca : '');
import { PAL, achaPessoa, agrupa, carregaEscopo, pctTxt, supChave, supNome, supReal } from './escopo.js';
import { SEM_HISTORICO, respCarteira, respComparar, respDobradinha, respInfoEquipe, respMaiorGap, respMetaBatida, respPontosPerdidos, respRankingGerentes, respRankingSupervisores, respRitmo } from './respostas/gestao.js';
import { respBola, respDevMotivos, respDivergencias, respIncentivoOficial, respLigaAs, respSemana } from './respostas/indicadores.js';
import { respAjuda, respCompromisso, respGlossario, respLances, respLiga, respMix } from './respostas/liga_mix.js';
import { respKpisPremiacao, respMetasIndustria } from './respostas/metas_industria.js';
import { respGestaoCampo, respOperacao, respRecorrenciaLances, respRelatorio } from './respostas/operacao.js';
import { respJustificativas, respOferecer, respSemDado } from './respostas/oportunidades.js';
import { pedePeriodo, respClientesSemComprar, respComparaMes, respDiasSemPedido, respPeriodoDias } from './respostas/periodos.js';
import { respFalta, respHoje, respPorSupervisor, respResumo, respSupervisor, respVendedor } from './respostas/resumo.js';
import { respAVisitar, respClientesDia, respDevolucao, respPositivacao, respRanking, respVisitas, respZerados } from './respostas/rota.js';
import { SEM_VENDAS, naoVende, respCliente, respIndustria, respMarcaPropriaVivo, respPreco, respProduto, respRecuperacao, respTopProdutos } from './respostas/vendas.js';

export async function respostaPronta(B, c, texto, anteriores) {
  const fm = sem(texto).match(FRX);
  const outra = (c.papel === 'gerente' || c.papel === 'supervisor' || c.papel === 'vendedor') && c.filial && fm && fm[1] !== c.filial ? `_Você vê só ${c.filial}${c.grupo ? ' · ' + titulo(c.grupo) : ''}; outras filiais são com a diretoria._\n\n` : '';
  const r0 = await respostaInterna(B, c, texto, anteriores);
  const bd = B.baseDe && B.baseDe();   /* base de hoje ainda vazia: avisa de que dia sao os numeros (nunca mostrar ontem como se fosse hoje) */
  const r = r0 && bd ? (r0.fraca ? fraca(`_⏳ A base de hoje ainda não carregou (a coleta começa cedo). Números de ${bd.split('-').reverse().slice(0, 2).join('/')}._\n\n` + r0, r0.fraca, r0.termo) : `_⏳ A base de hoje ainda não carregou (a coleta começa cedo). Números de ${bd.split('-').reverse().slice(0, 2).join('/')}._\n\n` + r0) : r0;
  // pergunta composta (Vitorio, 25/10/2026: "nao tem positivacao aberta por vendedor? ranking? e o ranking da champions?" -> so a 1a parte foi respondida)
  const tc = sem(texto);
  if (r && /Champions Triunfante/.test(r) && /PENALTI|IMPEDIMENTO|CARTAO|LANCE/.test(tc)) { const l = await respostaInterna(B, c, /IMPEDIMENTO/.test(tc) ? 'impedimentos' : /CARTAO/.test(tc) ? 'cartoes' : 'penaltis', anteriores); if (l) return outra + r + '\n\n' + l; }
  if (r && /CHAMPION|CHMAPION|CHAMPIOS|CAMPIONS|CHAMPI|\bLIGA\b/.test(tc) && !/Champions Triunfante|Liga AS/.test(r) && /\bE (O|A)\b|\?.*\?|\bTAMBEM\b/.test(tc)) { const l = await respostaInterna(B, c, 'liga', anteriores); if (l) return outra + r + '\n\n' + l; }
  return r && (r.fraca ? fraca(outra + r, r.fraca, r.termo) : outra + r);
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
  const ehMP = /MARCAS? PROPRIAS?|NOSSAS MARCAS|ZIPOCA|CALIRA|MITBIT|BELLARONE|SKIVE/.test(t);
  if (/RELATORIO|BOLETIM|DISPARO|MENSAGEM DAS|COMO FECHOU|\bONTEM\b/.test(t) && !/COMPR|PRODUTO|CLIENTE/.test(t) || (ehMP && /RELATORIO|10[:H ]?00|\b10H\b/.test(t))) return respRelatorio(B, c, t);
  if (/GESTAO DE CAMPO|SUPERVISORES EM CAMPO|EM ROTA \(RET\)|RANKING DE ATIVIDADE/.test(t) || (/COMPROMISSO|\bRET\b/.test(t) && /POR FILIAL|RANKING|PERCENT|%/.test(t))) return respGestaoCampo(B, await carregaEscopo(B, esc));
  if (/CORTE|CORTAD|BLOQUEAD|RETID|PERDAS|OPERACAO|RANKING DE VENDAS|RANKING FINAL|FECHAMENTO DO DIA/.test(t) && !/DEVOL/.test(t)) return respOperacao(B, await carregaEscopo(B, esc), t);
  if (/RECORRENCIA|RESGAT|REATIVAD|INATIVOS? (RECUPERAD|REATIVAD)/.test(t) && !/O QUE (E|EH)/.test(t) && !/\bMETAS?\b|KPI|PREMIA/.test(t)) return respRecorrenciaLances(B, await carregaEscopo(B, esc));
  if (/MOTIVO|POR ?QUE/.test(t) && /DEVOLU|DEVOLVID|VOLTOU DE MERCADORIA/.test(t)) return respDevMotivos(B);
  if (/COMPROMISSO|MATINAL|\bRET\b|\bRETS\b|ROTA DO SUPERVISOR/.test(t)) return respCompromisso(B, await carregaEscopo(B, esc));
  if (/PENALTI|PENALIDADE|IMPEDIMENTO|CARTA|VERMELHO|AMARELO|GOL CONTRA|\bGOLS?\b|LANCES?\b|HAT ?TRICK|DEFESAS?\b|CHECK.?IN FORA|FORA DO CLIENTE|00:00|CARTO(ES|ESS)?\b/.test(t) && !/LIGA|CHAMPIONS|CLASSIFICA|PONTOS? (FOMOS|PERDID|PENALIZ)|PENALIZAD/.test(t)) return respLances(B, await carregaEscopo(B, esc), t);
  if (/\+ ?MIX|MAIS ?MIX|\bMIX\b/.test(t) && !/COMPROU|COMPRARAM|PRECO/.test(t) && !(/\bMETAS?\b|KPI|PREMIA/.test(t) && !/\+ ?MIX|MAIS ?MIX/.test(t))) {
    // 26/10/2026 (Cristiano, equipe AS: 'foco em mix' -> '0 de 0 clientes'): o +MIX (lista de recomendacao) cobre o varejo; sem dado de uso no escopo, mostra o
    // MIX DA PREMIACAO por vendedor (itens por cliente, todos os canais), nunca uma resposta vazia
    const Em = await carregaEscopo(B, esc), rm = await respMix(B, Em, t);
    if (rm && !/de \*0\* clientes com lista/.test(String(rm))) return rm;
    return respKpisPremiacao(B, Em, 'META MIX', null);
  }
  { const sd = respSemDado(t); if (sd) return sd; }
  const E = await carregaEscopo(B, esc);
  // PEDIDOS QUE O JOTA NAO EXECUTA (26/10/2026): "247 nao trabalha mais", "retirar a Claudete dos controles" (a IA respondia "vou considerar que nao esta mais na
  // equipe" e nada acontecia) e "mande 3 vezes ao dia o acompanhamento". O JOTA registra para a diretoria e diz a verdade: quem muda e a Gestao de Equipe / a diretoria.
  // AUDITORIA 26/10/2026 (Priscila, Leandro, Vitorio): "digitados/citados do mes" = pedidos do mes dia a dia; faturamento do mes / faturamento e positivacao /
  // faturamento atualizado = resumo completo; "como esta a rota hoje" = hoje so varejo de rota.
  if (/DIGITAD|CITAD/.test(t) && /\bMES\b|OUTUBRO|NOVEMBRO|DEZEMBRO/.test(t) && !pedePeriodo(t)) return respPeriodoDias(B, E, t, { de: 1, ate: null });
  if (/FATURAMENTO|FATURADO/.test(t) && (/POSITIVA/.test(t) || /\bMES\b|OUTUBRO|COMO (EU )?(ESTOU|TO|ESTAMOS)|ATUALIZAD/.test(t)) && !/PREMIA|KPI|INDUSTRIA|SEMANA|PASSADO|ANTERIOR/.test(t) && !pedePeriodo(t)) return respResumo(B, E);
  if (/\bROTA\b/.test(t) && /HOJE|\bHJ\b/.test(t) && /COMO (ESTA|TA|VAI|ANDA)/.test(t)) return respHoje(B, E, t);
  if (/(EM RELACAO|SOBRE|SABER) (A |DA )?MINHA EQUIPE|^MINHA EQUIPEW*$/.test(t)) return respResumo(B, E);
  if (/NAO TRABALHA MAIS|SAIU DA EMPRESA|FOI DESLIGAD|DESLIGAD[OA]|FOI DEMITID|PEDIU (AS )?CONTAS?|PEDIU DEMISSAO|RETIRAR .{0,40}(EQUIPE|CONTROLE|LISTA|RELATORIO)|TIRAR .{0,40}(DA EQUIPE|DOS CONTROLES|DA LISTA)|NAO E MAIS (DA|DO) (EQUIPE|TIME)/.test(t)) {
    const p = achaPessoa(E, t) || null; const quem = p && p.tipo === 'vend' ? `${nome2(p.alvo.nome)} (${p.alvo.rca} · ${p.alvo.filial})` : 'o vendedor citado';
    await B.registraPedido('equipe', t, quem, c);
    return `📝 Anotado: *${quem}* não está mais na equipe. Mandei para a *Gestão de Equipe*; quem tira dos controles é a diretoria, e até ela confirmar ele continua aparecendo nos números (eu não mexo na equipe sozinho).`;
  }
  if (/(MANDE|MANDA|ENVIE|ENVIA|QUERO RECEBER|PRECISO (QUE|RECEBER)).{0,60}(VEZES? (AO|POR) DIA|TODO DIA|TODOS OS DIAS|DIARIAMENTE|DE HORA EM HORA|AS \d{1,2}H?)/.test(t)) {
    await B.registraPedido('envio', t, null, c);
    return `📝 Anotado o seu pedido de envio automático. Isso precisa ser ligado pela diretoria; já mandei o pedido. Enquanto isso, é só me perguntar a qualquer hora ("como está minha equipe?", "hoje", "zerados").`;
  }
  // DEVOLUCAO TEM RESPOSTA PROPRIA (26/10/2026: "como esta a devolucao hoje?" caia na operacao do dia e listava o DIGITADO; "o Brasil estava com 3 milhoes de devolucao"
  // virava comparacao de produto). Hoje = devolucao entrada hoje; sem "hoje" = mes. Motivos: a lista de motivos.
  if (/DEVOL/.test(t)) {
    if (/MOTIVO|POR QUE|PORQUE/.test(t) && !/DEVOLU\w*\s+(DE\s+)?(HOJE|HJ)\b/.test(t)) { const m = await respDevMotivos(B); if (m) { const tot = E.vend.reduce((s, v) => s + (v.dev || 0), 0); return m + `
_Devolução do mês no painel do CEVEN (${E.nome}): *${R$(tot)}*. Os motivos acima cobrem só as notas cujo motivo já foi lido; o resto ainda não tem motivo na base._`; } }
    return respDevolucao(E, t);
  }
  // VENDEDORES BATENDO A META DE POSITIVACAO (26/10/2026: listava filiais)
  if (/POSITIVA/.test(t) && /VENDEDOR|QUEM|QUAIS/.test(t) && /BAT|ATING|ACIMA DA META|CUMPRI/.test(t)) {
    const n = Math.min(Number((t.match(/\b(\d{1,3})\b/) || [])[1]) || 30, 100);
    const V = E.vend.filter((v) => (v.metaPos || 0) > 0 && (v.pos || 0) >= v.metaPos).sort((a, b) => b.pos / b.metaPos - a.pos / a.metaPos);
    if (!V.length) return `👥 *Positivação — ${E.nome}*: nenhum vendedor bateu a meta de positivação ainda.`;
    return [`👥 *Vendedores que já bateram a meta de positivação — ${E.nome}*: *${V.length}*`, `_Mostrando ${Math.min(n, V.length)} (ordem: % da meta)._`, '',
      ...V.slice(0, n).map((v, i) => `${i + 1}. ${nome2(v.nome)} (${v.rca}) ${E.nacional ? v.filial : ''} — *${Math.round(v.pos / v.metaPos * 100)}%* · ${v.pos} de ${Math.round(v.metaPos)} clientes`)].join('\n');
  }
  // PROJECAO (regra do Vitorio: nunca estimar/projetar): diz que nao projeta e mostra quanto precisa por dia
  if (/PROJE|PREVISAO|TENDENCIA|VAMOS FECHAR|VAI FECHAR|QUANTO (VAMOS|VAI|IREMOS) FECHAR|FECHAMENTO DO MES|ESTIMATIVA/.test(t)) return '🚫 *Projeção eu não faço* (regra da casa: só número real, nunca estimativa). O que eu mostro é quanto *precisa* por dia para bater a meta:\n\n' + await respFalta(B, E);
  if (/PERDENDO VENDA|PERDEMOS VENDA|ONDE (ESTAMOS )?PERDE|OPORTUNIDADES?\b/.test(t) && !/\+ ?MIX|MAIS ?MIX/.test(t)) return '🔎 *Onde estamos perdendo venda* (o que mais caiu contra o mês passado até o mesmo dia):\n\n' + await respComparaMes(B, E, 'MES PASSADO', null);
  if (/OFERECER|O QUE (EU )?(POSSO |DEVO )?(VENDER|LEVAR) (PRO|PARA|NO|NA)|SUGESTAO PARA O CLIENTE|(LEVAR|SUGERIR) (PRO|PARA O|PARA A|NO|NA) |PRODUTOS? (LEVAR|OFERECER|SUGERIR)/.test(t)) { const r = await respOferecer(B, E, t); if (r) return r; }
  let pessoa = achaPessoa(E, t);
  if (E.rca && E.vend[0]) pessoa = { tipo: 'vend', alvo: E.vend[0], empate: [E.vend[0]] };   /* vendedor: toda pergunta e sobre ele mesmo */
  if (!pessoa && /\b(ELA|ELE|DELA|DELE|DESSA|DESSE|ESSA|ESSE|NELA|NELE|PRA ELA|PRA ELE|MESMA|MESMO)\b/.test(t)) for (const h of anteriores || []) { pessoa = achaPessoa(E, sem(h)); if (pessoa) break; }
  // MES DO VENDEDOR (26/10/2026, Missaid: "desde o dia 1 ate hoje, quantos clientes o setor 1108 nao vendeu, a curva negativa" -> respondia so o dia)
  // QUEM FALTA POSITIVAR (Vitorio, 26/10/2026: "se ele pergunta quem falta positivar ele quer saber para quem falta o vendedor dele vender"): carteira do mes (roteiro do mes)
  // sem compra no mes, qualquer canal (AS inclusive). Equipe: por vendedor; vendedor citado: a lista de clientes (bloco do mes, abaixo).
  if (/FALTA(M)? (SER )?POSITIV|FALTA POSITIVAR|AINDA NAO (COMPROU|COMPRARAM|POSITIV)|NAO POSITIVAD|CURVA NEGATIVA/.test(t) && !(pessoa && pessoa.tipo === 'vend')) {
    const ini = hojeSP().slice(0, 7) + '-01';
    const V = E.vend.filter((v) => Array.isArray(v.roteiroMes) && v.roteiroMes.length && (!pessoa || (v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial))).map((v) => {
      const cli = new Map(); for (const c of v.roteiroMes) { const k = String(c.id_cliente); const u = String(c.data_ultima_compra || '').slice(0, 10); if (!cli.has(k) || u > cli.get(k)) cli.set(k, u); }
      return { v, tot: cli.size, falta: [...cli.values()].filter((u) => !u || u < ini).length };
    }).filter((x) => x.falta > 0).sort((a, b) => b.falta - a.falta);
    if (!V.length) return `👥 *Quem falta positivar — ${E.nome}*: a carteira do mês ainda não está completa na base (ela é lida vendedor a vendedor ao longo do dia). Tente de novo mais tarde ou cite o vendedor.`;
    return [`👥 *Quem falta positivar — ${E.nome}* (clientes da carteira do mês sem compra no mês)`, `Total: *${V.reduce((a, x) => a + x.falta, 0)}* clientes · ${V.length} vendedor(es)`, '',
      ...V.slice(0, 25).map((x) => `• ${vn(x.v)}: *${x.falta}* de ${x.tot} clientes`), '', SUGESTAO + `peça "curva negativa vendedor ${x0(V)}" para a lista de clientes.`].join('\n');
  }
  if (pessoa && pessoa.tipo === 'vend' && /DESDE O DIA|NO MES|DO MES|ESTE MES|ESSE MES|NESTE MES|CURVA NEGATIVA|ATE HOJE/.test(t) && /NAO VEND|NAO COMPR|SEM VENDA|SEM PEDIDO|CURVA|NAO POSITIV/.test(t) || (pessoa && pessoa.tipo === 'vend' && /FALTA(M)? (SER )?POSITIV|FALTA POSITIVAR|AINDA NAO (COMPROU|COMPRARAM|POSITIV)|NAO POSITIVAD|CURVA NEGATIVA/.test(t))) {
    const v = pessoa.alvo, m = v.mesV || {};
    // CURVA NEGATIVA = clientes da carteira do mes (roteiro do mes) que ainda NAO compraram neste mes (data da ultima compra antes do dia 1)
    if (Array.isArray(v.roteiroMes) && v.roteiroMes.length) {
      const ini = hojeSP().slice(0, 7) + '-01', cli = new Map();
      for (const c of v.roteiroMes) { const k = String(c.id_cliente); const u = String(c.data_ultima_compra || '').slice(0, 10); if (!cli.has(k) || u > cli.get(k).u) cli.set(k, { c, u }); }
      const nao = [...cli.values()].filter((x) => !x.u || x.u < ini).sort((a, b) => (a.u || '').localeCompare(b.u || ''));
      const dias = (u) => (u ? Math.round((Date.parse(hojeSP()) - Date.parse(u)) / 864e5) + ' dias' : 'nunca comprou');
      return [`📉 *Curva negativa — ${v.rca} - ${titulo(v.nome)}* (${v.filial} · sup. ${sn(v.supervisor, v.supCod)})`, `Carteira do mês: *${cli.size} clientes* · já compraram: *${cli.size - nao.length}* · *ainda não compraram: ${nao.length}*`, '',
        ...nao.slice(0, 40).map((x) => `• ${titulo(x.c.nome_cliente || x.c.razao_social || 'cliente')} (#${x.c.id_cliente}) — última compra ${x.u ? x.u.slice(8, 10) + '/' + x.u.slice(5, 7) + ' (' + dias(x.u) + ')' : 'nunca'}`),
        nao.length > 40 ? `… e mais ${nao.length - 40}` : '', '', SUGESTAO + (nao.length ? `começar pelos parados há mais tempo: ${titulo(nao[0].c.nome_cliente || '')}.` : 'carteira inteira já comprou no mês.')].filter((x) => x !== '').join('\n');
    }
    if (m.plan == null) return `${v.rca} - ${titulo(v.nome)} (${v.filial}): sem a produtividade do mês na base agora.`;
    const semVenda = m.real != null && m.pedRota != null ? Math.max(0, m.real - m.pedRota) : null;
    return [`📅 *${v.rca} - ${titulo(v.nome)}* (${v.filial} · sup. ${sn(v.supervisor, v.supCod)}) — *mês até hoje*`,
      `Visitas planejadas: *${m.plan}* · realizadas: *${m.real}*` + (m.efic != null ? ` (eficiência ${String(m.efic).replace('.', ',')}%)` : ''),
      `Pedidos na rota: *${m.pedRota}*` + (semVenda != null ? ` → *${semVenda} visitas sem venda* no mês` : ''),
      `Positivação do mês: ${v.pos ?? 'sem dado'} de ${v.metaPos != null ? Math.round(v.metaPos) : 'sem meta'} clientes`,
      '', '_A lista cliente a cliente do mês (a curva negativa) depende do roteiro do mês, que ainda não está gravado na base; os números acima são do CEVEN._',
      '', SUGESTAO + (semVenda ? `rever com ${nome2(v.nome)} as ${semVenda} visitas sem venda do mês.` : 'manter o ritmo.')].join('\n');
  }
  // motivos de nao venda NO PERIODO (mes, semana, mes passado) ou do grupo: resumo noturno; os de HOJE seguem para a rota do dia
  if (/MOTIVO|JUSTIFICATIV|DESCULPA|POR ?QUE .{0,30}NAO .{0,15}COMPR|POR QUE (OS )?CLIENTES? NAO (COMPRA|COMPRAM)|PORQUE (OS )?CLIENTES? NAO COMPRA|NAO VENDA/.test(t) && !/DEVOLU/.test(t) && (/\bMES\b|SEMANA|PASSAD|NO MES|DO MES|SETEMBRO|OUTUBRO/.test(t) || !pessoa)) return respJustificativas(B, E, t, pessoa);
  if (pessoa && pessoa.tipo === 'vend' && !/COMPR|PRODUTO|SKU/.test(t) && /QUA(L|IS) (OS )?CLIENTES?|QUAIS\??$|JUSTIFICATIV|MOTIVO|NAO VENDEU|SEM VENDA|VISITOU|VISITAD|CHECK|ONDE (ELA|ELE) (FOI|ESTA)|POSITIVOU|VENDEU (PARA|PRA)|NENHUMA VISITA|FEZ .{0,20}VISITA|VISITAS? HOJE|NAO VISITOU/.test(t) && !/ROTA DO MES|NO MES|DO MES/.test(t)) return respClientesDia(pessoa.alvo, t);   // 26/10/2026: 'Ronaldo Bica nao fez nenhuma visita?' trazia o resumo
  // PERIODOS (25/10/2026): comparacao com o mes passado, dias sem pedido, clientes sem comprar
  if (/CLIENTE/.test(t) && /SEM COMPRAR|NAO COMPRA|\bN COMPRA|PARADOS?|HA MAIS DE|DIAS SEM/.test(t)) return respClientesSemComprar(B, E, t);
  if (/DIAS (SEGUIDOS )?SEM (VENDER|PEDIDO|VENDA)|HA \d+ DIAS SEM|HA MAIS DE \d+ DIAS|\d+ DIAS SEM|SEM PEDIDO HA/.test(t)) return respDiasSemPedido(B, E, t);
  { const per = pedePeriodo(t); if (per && /PEDIDO|CAPTA|VEND|DIGITA|FATUR|QUANTO/.test(t)) return respPeriodoDias(B, E, t, per); }
  if (/MES PASSADO|MES ANTERIOR|SETEMBRO|AGOSTO|\bM-1\b|COMPARAD|EM RELACAO AO MES|CAIU|CRESCEU|EVOLUCAO|ESTE MES X|ESSE MES X/.test(t) && !/LIGA|CHAMPI|POSICAO|RANKING DA LIGA/.test(t) && !/SEMANA(L|IS)|POR SEMANA|SEMANA A SEMANA|DIA DA SEMANA|QUE DIA/.test(t) && !(t.match(new RegExp(FRX.source, 'g')) || []).slice(1).length) return respComparaMes(B, E, t, pessoa);
  // METAS DAS INDUSTRIAS = Premiacao RV do CEVEN (Vitorio, 25/10/2026)
  // KPIs DA PREMIACAO (26/10/2026: meta de ticket medio, mix, faseamento, recorrencia)
  if (/\bMETAS?\b|KPI|PREMIA/.test(t) && /TICKET|\bMIX\b|FASEAMENTO|FASIAMENTO|FASAMENTO|RECORRENCIA|\bKPIS?\b/.test(t)) return respKpisPremiacao(B, E, t, pessoa);
  if (/\bMETAS?\b|OBJETIVOS?\b/.test(t)) { const r = await respMetasIndustria(B, E, t, pessoa); if (r) return r; }
  // vendas item a item (produto, industria, cliente, preco, top produtos, marca propria ao vivo)
  if (ehMP) { const r = await respMarcaPropriaVivo(B, E, t); return r || respRelatorio(B, c, t); }
  if (/PRECO|QUANTO SAIU/.test(t)) { const r = await respPreco(B, E, t); if (r) return r; }
  if (/COMPRAVA|PAROU|PARARAM|DEIXOU DE COMPRAR|DEIXARAM DE COMPRAR|RECUPERACAO D/.test(t)) { const r = await respRecuperacao(B, E, t); if (r) return r; }
  if (/PRODUTOS? (QUE )?MAIS VEND|TOP \d* ?PRODUTOS|\d+ PRODUTOS|QUAL PRODUTO MAIS|MAIS VENDIDOS/.test(t)) return respTopProdutos(B, E, t);
  if (/CLIENTE|LOJA/.test(t) && /COMPROU|COMPRA|ULTIMO PEDIDO|SEM COMPRAR|OFERECER|PRODUTOS D/.test(t) && !/CLIENTES QUE|QUAIS (OS )?CLIENTES|QUEM/.test(t)) { const r = await respCliente(B, E, t); if (r) return r; if (/OFERECER|ULTIMO PEDIDO|PRODUTOS D/.test(t)) return `🔎 Não achei esse cliente em ${E.nome} (vendas do mês). Confira o nome ou mande o código do cliente (ex.: #212704).`; }
  if (/COMPRA|COMPROU|COMPRARAM|VENDEU DE |VENDERAM DE |VENDEU (O|A) |VENDE DE |POSITIVACAO D[OEA]S? |(VENDE MAIS|MAIS VENDE)(?!U)(?!.*(SUPERVISOR|VENDEDOR|FILIAL|GERENTE))|EM QUANTOS CLIENTES|CLIENTES COMPRARAM|PDVS COMPRARAM|SEMANA(L|IS)|MENSA(L|IS)|DIA DA SEMANA|QUAL DIA|QUE DIA|MELHOR DIA|MES A MES|POR SEMANA|SEMANA A SEMANA|POSITIVAND|(SEGUNDA|TERCA|QUARTA|QUINTA|SEXTA|SABADO) OU /.test(t) || /\b(MONDELEZ|MARS|ARCOR|BAGLEY|CONDOR|FERRERO|NESTLE|HERSHEY|FINI|DORI|PEPSICO|KELLOGG|LACTA|DIVERSAO)\b/.test(t)) {
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
  // PREMIACAO = holerite simulado do CEVEN (RV: metas por industria, faturamento, positivacao, ticket, faseamento, mix, recorrencia). INCENTIVO = campanha de outubro
  // (110%). CHAMPIONS = Liga/Brasileirao. (Vitorio, 26/10/2026: 'premiacao vem dessa aba aqui... a champions e a liga ou brasileirao, entendeu?')
  if (/PREMIA|SALARIO|HOLERITE|\bRV\b|REMUNERA/.test(t) && !/INCENTIVO|GATILHO|110/.test(t)) return respKpisPremiacao(B, E, t, pessoa);
  if (/INCENTIVO|GATILHO|110 ?%|\b110\b|BONUS|PREMIO/.test(t)) return respIncentivoOficial(B, E, pessoa);
  if (/\bAS\b/.test(t) && /RANKING|VENCEDOR|LIGA|PONTOS/.test(t)) return respLigaAs(B, E, pessoa);
  if (/LIGA (DO |DOS |DA )?AS\b|LIGA DO ATACADO/.test(t) || (pessoa && pessoa.tipo === 'vend' && /^(AS|PET AS)$/.test(pessoa.alvo.canal) && /LIGA|PONTOS|POSICAO|CHAMPIONS/.test(t))) return respLigaAs(B, E, pessoa);
  if (/LIGA|CHAMPION|CHMAPION|CHAMPIOS|CAMPIONS|CHAMPI|CLASSIFICA|TABELA|POSICAO|PONTOS|PONTUACAO|COLOCAD|COLOCACAO|BRASILEIRAO/.test(t) && !(/POSITIVA|FATURA/.test(t) && /RANKING|POR VENDEDOR|ABERTA/.test(t))) return respLiga(B, E, pessoa && pessoa.tipo === 'vend' ? pessoa.alvo : null, t);
  if (/FALTA(M)? (SER )?VISITA|NAO (FOI |FORAM )?VISITAD|AINDA (NAO )?(FORAM )?VISITAD|CLIENTES? (EM )?ABERTO|PENDENTES? (DE |NA )?(VISITA|ROTA)|SEM VISITA AINDA|CLIENTES? (NA|DA) ROTA|FALTA VISITAR|FALTAM VISITAR|QUEM FALTA VISITAR/.test(t)) return respAVisitar(E, pessoa);
  if (pessoa && pessoa.tipo === 'sup' && /ZERAD|ZEROU|SEM PEDIDO/.test(t)) return respZerados({ ...E, nome: 'Equipe ' + nome2(pessoa.alvo.nome), vend: E.vend.filter((v) => v.supervisor === pessoa.alvo.nome && v.filial === pessoa.alvo.filial) });
  if (pessoa && pessoa.tipo === 'sup' && /MAIS VENDEU|MAIS VENDE/.test(t)) pessoa = null;
  if (pessoa) {
    const amb = pessoa.empate.length > 1 ? `\n\n_Achei mais de um: ${pessoa.empate.slice(0, 5).map((x) => titulo(x.nome) + ' ' + x.filial).join(' · ')}. Mande o nome completo se não for este._` : '';
    return (pessoa.tipo === 'sup' ? respSupervisor(E, pessoa.alvo) : await respVendedor(B, E, pessoa.alvo)) + amb;
  }
  if (/ZERAD|ZEROU|SEM PEDIDO|SEM VENDA|NAO VENDEU|NAO VENDERAM|NINGUEM VENDEU/.test(t)) return respZerados(E);
  if (/POSITIV/.test(t) && /QUANTOS|QUANTO/.test(t) && !/110/.test(t)) return respPositivacao(B, E);
  if (/QUANTO FALTA|FALTA (PARA|PRA|BATER)|\bFALTA\b|POR DIA UTIL|\bMN\b|PRECISA (VENDER|FATURAR)|POR DIA PRA|COMO BATER|BATER A META/.test(t)) return respFalta(B, E);
  if (/RANKING|MELHOR|PIOR|\bTOP\b|DESTAQUE|MAIS ATRAS|QUEM (ESTA|TA) (BEM|MAL)/.test(t)) {
    // "piores vendedores E supervisores" (26/10/2026: so vinham vendedores): junta o ranking de supervisores
    if (/SUPERVIS/.test(t) && /VENDEDOR/.test(t)) return [await respRanking(E, t), respRankingSupervisores(E)].filter(Boolean).join('\n\n');
    return respRanking(E, t);
  }
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
NUNCA prometa o que você não faz: você NÃO é programável, NÃO envia relatório automático, NÃO muda equipe nem cadastro, NÃO "vai considerar" nada; se pedirem isso, diga que anotou e que a diretoria decide. Nunca mostre dado de fora da equipe/filial de quem pergunta. Cobrança (Liga, eficácia, zerados) = só varejo de campo; para mostrar roteiro e clientes, todos os canais. Faturado e pendente sempre separados. Formato WhatsApp: *negrito* com UM asterisco; no máximo 10 linhas; termine com "🎯 *Sugestão do Jota:*" e UMA ação concreta.
RESUMO: ${base.slice(0, 6000)}`;
  try { const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [{ role: 'system', content: sys }, ...historico, { role: 'user', content: texto }], max_tokens: 600 }); const s = String((r && (r.response || r.result)) || '').trim().replace(/\*\*/g, '*').replace(/^#+\s*/gm, ''); return s || null; } catch (e) { return null; }
}
