// =========================================================================
// JOTA · functions/_lib/jota/entende.js
// O QUE É: ENTENDER a pergunta e escolher a resposta (roteamento) + IA de reserva.
// Parte do JOTA (functions/api/whatsapp/bot.js), dividido por assunto em 25/10/2026. Mesmas regras: nunca inventar nem estimar.
// =========================================================================
import { sn } from './escopo.js';
import { FILIAIS, FRX, N, R$, SUGESTAO, VAREJO, fraca, hojeSP, nome2, sem, titulo, vn } from './base.js';
const x0 = (V) => (V[0] ? V[0].v.rca : '');
import { PAL, achaPessoa, agrupa, carregaEscopo, pctTxt, supChave, supNome, supReal } from './escopo.js';
import { SEM_HISTORICO, respCarteira, respComparar, respDobradinha, respInfoEquipe, respMaiorGap, respMetaBatida, respPontosPerdidos, respRankingGerentes, respRankingSupervisores, respRitmo, respTendencia } from './respostas/gestao.js';
import { respBola, respDevMotivos, respDivergencias, respIncentivoOficial, respLigaAs, respSemana } from './respostas/indicadores.js';
import { respAjuda, respCompromisso, respGlossario, respLances, respLiga, respMix } from './respostas/liga_mix.js';
import { respKpisPremiacao, respMetasIndustria } from './respostas/metas_industria.js';
import { respGestaoCampo, respOperacao, respRecorrenciaLances, respRelatorio } from './respostas/operacao.js';
import { respJustificativas, respOferecer, respSemDado } from './respostas/oportunidades.js';
import { pedePeriodo, respClientesSemComprar, respComparaMes, respDiasSemPedido, respPeriodoDias } from './respostas/periodos.js';
import { respDiaVendedor, respFalta, respHoje, respTodosVendedores, totaisOficiais, respPorSupervisor, respResumo, respSupervisor, respVendedor } from './respostas/resumo.js';
import { respAVisitar, respCheckinEquipe, respClientesVend, respDiaEquipe, respRotaFiltro, respSemVisita, respMixRotaHoje, respRecorrenciaClientes, respRotaHojeCompleta, respRotaHojeResumo, respClientesDia, respDevolucao, respPositivacao, respRanking, respVisitas, respZerados } from './respostas/rota.js';
import { SEM_VENDAS, naoVende, respCliente, respIndustria, respMarcaPropriaVivo, respPreco, respPedidoNumero, respPedidosStatus, respProduto, respRecuperacao, respTopProdutos } from './respostas/vendas.js';

// CONTINUACAO (Vitorio, 27/10/2026: "precisa ir salvando a mensagem anterior para que vc continue a conversa... pergunto como foi o dia do vendedor X, dai
// pergunto e o mes, vc responde outra coisa"). Mensagem que so MODIFICA a anterior ("e o mes?", "do mes", "apenas em TPA", "por vendedor", "sim, ...faturou o pedido")
// vira a pergunta anterior + o modificador. Comandos completos ("liga", "hoje", "+mix") seguem sozinhos.
export function juntaComAnterior(texto, anteriores) {
  const t = sem(texto).trim(), ant = (anteriores || []).length ? String(anteriores[0] || '') : '';
  if (!ant || /^\d{1,5}\W*$/.test(t)) return texto;
  // pergunta nova e completa (cliente pelo codigo, frase longa com assunto proprio) nao gruda na anterior (27/10/2026: "quero saber APENAS se o cliente codigo 1891
  // comprou" virou a carteira da Nilva)
  if (/\bCLIENTE\b.{0,25}\d{3,}|\bPEDIDO\b.{0,15}\d{7,}/.test(t) || (t.split(/\s+/).length > 9 && !/^(DESSES|DESTES|DELES|DESSAS|DESTAS|DELAS)\b/.test(t))) return texto;
  const modificador = /^(DESSES|DESTES|DELES|DESSAS|DESTAS|DELAS)\b|^(E|E O|E A|E NO|E NA|E DO|E DA|E OS|E AS)\b|^(APENAS|SO|SOMENTE|AGORA)\b|^(QUERO|QUERIA|PRECISO)( SABER)? (APENAS|SO|SOMENTE)\b|^(DO|DA|NO|NA) (MES|SEMANA|DIA)\W*$|^(DE |EM )?(ONTEM|HOJE)\W*$|^(POR|ABERTO POR|ABERTA POR) (VENDEDOR|SUPERVISOR|FILIAL|CLIENTE|INDUSTRIA)|^SIM\b|^(QUAIS|QUEM) SAO( ELES| ELAS)?\W*$|^(EM|DE) (TPH|ABC|API|TBL|TCV|TSJ|TCA|TBE|TPA|MCD|TCG)\W*$/.test(t);
  if (!modificador) return texto;
  const ta = sem(ant);
  if (/^SIM\b/.test(t) && !/\d{7,}/.test(t) && /\d{7,}/.test(ta)) return texto + ' ' + (ta.match(/\d{7,}/) || [''])[0];   /* "sim, ...faturou o pedido" + numero anterior */
  // periodo novo ("e o mes?") substitui o da pergunta anterior ("como foi o DIA da Luciana")
  const PER = /\b(HOJE|HJ|ONTEM|DIA|SEMANA|MES|OUTUBRO)\b/g;
  let antSemPer = PER.test(t) ? ta.replace(PER, ' ').replace(/\s+/g, ' ') : ant;
  // lugar novo ("e no Brasil?", "e em TPH?") substitui a filial da pergunta anterior
  if (/\bBRASIL\b|\b(TPH|ABC|API|TBL|TCV|TSJ|TCA|TBE|TPA|MCD|TCG)\b/.test(t)) antSemPer = sem(antSemPer).replace(/\b(TPH|ABC|API|TBL|TCV|TSJ|TCA|TBE|TPA|MCD|TCG|BRASIL)\b/g, ' ').replace(/\s+/g, ' ');
  return antSemPer + ' ' + texto;
}
export async function respostaPronta(B, c, texto0, anteriores) {
  // ESTADO DA CONVERSA (dialogue state tracking / slot carryover, 27/10/2026): cada campo (filial, vendedor) e HERDADO da conversa ate a pessoa citar outro ou
  // abrir o escopo (Brasil, "minha equipe", "por filial"). Vale 2 h. Brasil zera filial e vendedor; filial nova zera vendedor de outra filial.
  const ctx = (c && c.celular && B.ctxLer ? await B.ctxLer(c.celular) : null) || {};
  let texto = juntaComAnterior(String(texto0 || '').replace(/\bvendedores gerados\b/gi, 'vendedores zerados'), anteriores);   /* audio: "gerados" = zerados (27/10/2026) */
  const t0 = sem(texto), filCit = (t0.match(FRX) || [])[1] || null;
  const abre = /\bBRASIL\b|TODAS AS FILIAIS|NACIONAL|GRUPO TODO|\bREDE\b|POR FILIAL/.test(t0);
  const equipe = /\bEQUIPE\b|\bTIME\b|\bFILIAL\b|DOS VENDEDORES|TODOS (OS )?VENDEDORES|POR SUPERVISOR|POR VENDEDOR|UM POR UM|ZERADOS|RANKING|SEM VISITA|SEM NENHUMA VISITA/.test(t0);
  if (c.papel === 'diretoria' && !filCit && !abre && ctx.filial) texto += ' ' + ctx.filial;   /* filial da conversa */
  B._ctxVend = !abre && !equipe && (!filCit || !ctx.vend || ctx.vend.filial === filCit) ? ctx.vend || null : null;   /* vendedor da conversa (usado se nenhum for citado) */
  B._ultPessoa = null;
  if (B._ctxVend) {   /* ninguem citado nesta pergunta -> completa com o vendedor da conversa (todas as respostas passam a ve-lo) */
    try {
      const ec = escopoDoContato(c, sem(texto).match(FRX));
      const escX = ec.rcaV ? null : ec.fil ? { nome: ec.fil, filiais: [ec.fil], grupo: ec.supervisor ? null : ec.grupo, supervisor: ec.supervisor, nacional: false } : { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true };
      if (escX) { const Ex = await carregaEscopo(B, escX); const vOk = Ex.vend.concat(Ex.ocultos || []).find((v) => v.filial === B._ctxVend.filial && String(v.rca) === String(B._ctxVend.rca));
        if (vOk && !achaPessoa(Ex, sem(texto))) texto += ` vendedor ${vOk.rca} ${vOk.filial}`; }
    } catch (e) { /* segue sem */ }
  }
  const fm = sem(texto).match(FRX);
  const outra = (c.papel === 'gerente' || c.papel === 'supervisor' || c.papel === 'vendedor') && c.filial && fm && fm[1] !== c.filial ? `_Você vê só ${c.filial}${c.grupo ? ' · ' + titulo(c.grupo) : ''}; outras filiais são com a diretoria._\n\n` : '';
  const r0 = await respostaInterna(B, c, texto, anteriores);
  const bd = B.baseDe && B.baseDe();   /* base de hoje ainda vazia: avisa de que dia sao os numeros (nunca mostrar ontem como se fosse hoje) */
  const r = r0 && bd ? (r0.fraca ? fraca(`_⏳ A base de hoje ainda não carregou (a coleta começa cedo). Números de ${bd.split('-').reverse().slice(0, 2).join('/')}._\n\n` + r0, r0.fraca, r0.termo) : `_⏳ A base de hoje ainda não carregou (a coleta começa cedo). Números de ${bd.split('-').reverse().slice(0, 2).join('/')}._\n\n` + r0) : r0;
  // pergunta composta (Vitorio, 25/10/2026: "nao tem positivacao aberta por vendedor? ranking? e o ranking da champions?" -> so a 1a parte foi respondida)
  const tc = sem(texto);
  if (r && /Champions Triunfante/.test(r) && /PENALTI|IMPEDIMENTO|CARTAO|LANCE/.test(tc)) { const l = await respostaInterna(B, c, /IMPEDIMENTO/.test(tc) ? 'impedimentos' : /CARTAO/.test(tc) ? 'cartoes' : 'penaltis', anteriores); if (l) return outra + r + '\n\n' + l; }
  if (r && /CHAMPION|CHMAPION|CHAMPIOS|CAMPIONS|CHAMPI|\bLIGA\b/.test(tc) && !/Champions Triunfante|Liga AS/.test(r) && /\bE (O|A)\b|\?.*\?|\bTAMBEM\b/.test(tc)) { const l = await respostaInterna(B, c, 'liga', anteriores); if (l) return outra + r + '\n\n' + l; }
  // grava o novo estado da conversa (vendedor = o citado nesta pergunta, ou o da conversa)
  try {
    let up = null;
    try { const ec = escopoDoContato(c, sem(texto).match(FRX)); const escX = ec.rcaV ? null : ec.fil ? { nome: ec.fil, filiais: [ec.fil], grupo: ec.supervisor ? null : ec.grupo, supervisor: ec.supervisor, nacional: false } : { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true };
      if (escX) { const Ex = await carregaEscopo(B, escX); const p = achaPessoa(Ex, sem(texto)); if (p && p.tipo === 'vend' && !/^(GERENTE|VAGO|RCA\b|VENDA )/i.test(String(p.alvo.nome || ''))) up = p.alvo; } } catch (e) { up = null; }
    const novo = { filial: abre ? null : filCit || (up && up.filial) || ctx.filial || null, vend: abre || equipe ? null : up ? { rca: String(up.rca), filial: up.filial, nome: up.nome } : (filCit && ctx.vend && ctx.vend.filial !== filCit ? null : ctx.vend || null), assunto: t0.slice(0, 200) };
    if (c && c.celular && B.ctxGravar) await B.ctxGravar(c.celular, novo);
  } catch (e) { /* sem estado */ }
  return r && (r.fraca ? fraca(outra + r, r.fraca, r.termo) : outra + r);
}
export async function respostaInterna(B, c, texto, anteriores) {
  const t = sem(texto);
  // "Sugestao" sozinha (27/10/2026, Thiago/Sueli/Rodrigo: a IA inventava uma resposta): pede a sugestao
  if (/^\W*SUGEST(AO|OES|AO DO JOTA)?\W*$/.test(t)) return '💡 Pode mandar! Escreva *"sugestão:"* e o que você quer que eu faça diferente (ex.: "sugestão: mandar a meta de cada vendedor"). Vai direto para o time que me treina.';
  // escopo: gerente = a filial dele; diretoria = a filial citada, senao o Brasil
  const fm = t.match(FRX);
  if (c.papel === 'vendedor' && !(c.filial && c.rca)) return 'Seu cadastro no Jota está sem filial ou código RCA. Peça para a diretoria completar na tela de contatos.';
  const { fil, grupo, supervisor, rcaV, preso } = escopoDoContato(c, fm);
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
  // RELATORIO AUTOMATICO so para diretoria/gerente pedindo O RELATORIO (27/10/2026: supervisor com "relatorio de positivacao por industria do Fabio" e
  // "como foi a venda do vendedor 60 ontem" recebia "os relatorios automaticos sao da gerencia"). "Ontem" com equipe/vendedor = pedidos de ontem (abaixo).
  const pedeRelatorio = /RELATORIO (DAS|DE HOJE|DO DIA|DA MANHA|DA TARDE|DE ONTEM|AUTOMATIC)|BOLETIM|DISPARO|MENSAGEM DAS|COMO FECHOU/.test(t) && !/VENDEDOR|EQUIPE|INDUSTRIA|POSITIVA|CLIENTE|CHE?C?K.?IN|CHE?C?K.?OUT|PRODUTO|COMPR/.test(t);
  if ((pedeRelatorio && (c.papel === 'diretoria' || c.papel === 'gerente')) || (ehMP && /RELATORIO|10[:H ]?00|\b10H\b/.test(t))) return respRelatorio(B, c, t);
  if (/GESTAO DE CAMPO|SUPERVISORES EM CAMPO|EM ROTA \(RET\)|RANKING DE ATIVIDADE/.test(t) || (/COMPROMISSO|\bRET\b/.test(t) && /POR FILIAL|RANKING|PERCENT|%/.test(t))) return respGestaoCampo(B, await carregaEscopo(B, esc));
  // LISTA de pedidos por status do escopo (bloqueados, liberados sem faturar, com corte): antes da Operacao, que so da o total (26/10/2026)
  // + pendentes/nao faturados (Jefferson: "pedidos pendentes do vendedor 128, de quais clientes"; Allison: "pendente/nao faturado aberto por cliente") e cortes
  // (Vagner: "detalhes dos cortes de hoje", "quais produtos estao com cortes") -> lista; vendedor citado filtra so ele (27/10/2026)
  if ((/PEDIDOS?/.test(t) && /BLOQUEAD|LIBERAD|CORTAD|COM CORTE|SEM FATURAR|NAO FATUR|PENDENTE/.test(t) || /(DETALHE|QUAIS|LISTA).{0,25}CORTE/.test(t)) && !/[0-9]{7,}/.test(t)) {
    const Ep = await carregaEscopo(B, esc), pp = achaPessoa(Ep, t);
    return respPedidosStatus(B, pp && pp.tipo === 'vend' ? { ...Ep, nome: vn(pp.alvo), vend: [pp.alvo], ocultos: [] } : Ep, /CORTE/.test(t) ? 'CORTE' : (/PENDENTE|NAO FATUR|SEM FATURAR/.test(t) && !/BLOQUEAD|LIBERAD/.test(t)) || (/BLOQUEAD/.test(t) && /LIBERAD/.test(t)) ? 'PENDENTES' : t);   /* "bloqueados e liberados" = os dois (27/10/2026) */
  }
  if (/CORTE|CORTAD|BLOQUEAD|RETID|PERDAS|OPERACAO|RANKING DE VENDAS|RANKING FINAL|FECHAMENTO DO DIA/.test(t) && !/DEVOL/.test(t)) return respOperacao(B, await carregaEscopo(B, esc), t);
  if (/RECORRENCIA|RESGAT|REATIVAD|INATIVOS? (RECUPERAD|REATIVAD)/.test(t) && !/O QUE (E|EH)/.test(t) && !/\bMETAS?\b|KPI|PREMIA/.test(t)) { const Er = await carregaEscopo(B, esc), pr = achaPessoa(Er, t);
    // RECORRENCIA POR TAG (27/10/2026): clientes com a tag no roteiro (hoje e mes) = a pergunta normal; os lances (defesa +3, reativados) so quando pedir pontos/defesa/liga
    if (/RECORRENCIA/.test(t) && !/DEFESA|PONTO|LANCE|LIGA|REATIVAD|RESGAT/.test(t)) return respRecorrenciaClientes(B, Er, pr && pr.tipo === 'vend' ? pr.alvo : null, t);
    return respRecorrenciaLances(B, pr && pr.tipo === 'vend' ? { ...Er, nome: vn(pr.alvo), vend: [pr.alvo] } : Er); }   /* vendedor citado = so ele (27/10/2026, "Tania em recorrencia") */
  if (/MOTIVO|POR ?QUE/.test(t) && /DEVOLU|DEVOLVID|VOLTOU DE MERCADORIA/.test(t)) return respDevMotivos(B);
  if (/COMPROMISSO|MATINAL|\bRET\b|\bRETS\b|ROTA DO SUPERVISOR/.test(t)) return respCompromisso(B, await carregaEscopo(B, esc));
  if (/PENALTI|PENALIDADE|IMPEDIMENTO|CARTA|VERMELHO|AMARELO|GOL CONTRA|\bGOLS?\b|LANCES?\b|HAT ?TRICK|DEFESAS?\b|CHECK.?IN FORA|FORA DO CLIENTE|00:00|CARTO(ES|ESS)?\b/.test(t) && !/LIGA|CHAMPIONS|CLASSIFICA|PONTOS? (FOMOS|PERDID|PENALIZ)|PENALIZAD/.test(t)) return respLances(B, await carregaEscopo(B, esc), t);
  // "VER MAIS" logo depois do detalhe de um vendedor: a lista completa dos clientes sem compra (27/10/2026)
  if (/^\W*(VER MAIS|MAIS|MOSTRA(R)? MAIS|ABRIR( A)? LISTA|ABRE( A)? LISTA|LISTA COMPLETA|QUERO VER (TODOS|MAIS|A LISTA))\W*$/.test(t) && (anteriores || []).length) {
    const Ev = await carregaEscopo(B, esc), pv = achaPessoa(Ev, sem(String(anteriores[0] || '')));
    if (pv && pv.tipo === 'vend') return respVendedor(B, Ev, pv.alvo, { tudo: true });
  }
  // "+MIX" logo depois de "rota de hoje": o que oferecer aos clientes da rota que ainda nao compraram no mes (Vitorio, 27/10/2026: 'ele pergunta apenas mais mix e vc ja entende')
  // "+ mix" chega como "MIX" depois da normalizacao (27/10/2026: foi para o Brasil todo); "dos 3", "desses clientes" tambem
  // "+mix" + vendedor da conversa (o estado completa o texto com "vendedor 352 TCV"): mix da rota de hoje dele
  if (/^\W*(\+ ?)?(MIX|MAIS ?MIX)\b/.test(t) && !/METAS?\b|PREMIA|INDUSTRIA|EQUIPE|FILIAL|BRASIL/.test(t)) { const Ea = await carregaEscopo(B, esc), pa = achaPessoa(Ea, t); if (pa && pa.tipo === 'vend') return respMixRotaHoje(B, pa.alvo); }
  if (/^\W*(\+ ?)?(MIX|MAIS ?MIX)\W*(DELES|DESSES|DESTES|PARA ELES|DESSES CLIENTES|DOS \d+|DELA|DELE)?\W*$|^(E )?O MIX (DELES|DESSES|DOS \d+)/.test(t) && (anteriores || []).length) { const ant = sem(String(anteriores[0] || '')); if (/ROTA|CLIENTES?|HOJE|VISITA|VENDEDOR|COMO ESTA/.test(ant)) {   /* 27/10/2026: "clientes giovana tlb hoje" -> "+mix" ia para o Brasil (so aceitava "rota") */ const Ea = await carregaEscopo(B, esc); const pa = achaPessoa(Ea, ant) || (Ea.rca && Ea.vend[0] ? { tipo: 'vend', alvo: Ea.vend[0] } : null); if (pa && pa.tipo === 'vend') return respMixRotaHoje(B, pa.alvo); } }
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
  // AUDITORIA 27/10 (Vitorio e Evandro): sem visita na hierarquia; clientes da filial/equipe; rota de hoje filtrada (parados ha N dias, visitados sem venda)
  if (/SEM (NENHUMA )?VISITA|NENHUMA VISITA|NAO (FEZ|FIZERAM) (NENHUMA )?VISITA/.test(t) && /VENDEDOR|LISTA|QUEM|QUAIS|POR FILIAL/.test(t)) return respSemVisita(E);
  if (/CLIENTES (DOS VENDEDORES|DA FILIAL|DA EQUIPE|DA MINHA EQUIPE)/.test(t) && !/ROTA DE HOJE.{0,40}VISITOU|PAROU|COMPRAVA/.test(t)) return respRotaHojeResumo(B, E, null);
  if (/ROTA/.test(t) && /\bHOJE\b|\bHJ\b/.test(t) && /\d{1,3}\s*DIAS|VISITOU E NAO VENDEU|VISITADO E NAO VENDEU|JA VISITOU/.test(t) && !/VENDEDORA?\s+\d|VENDEDORA?\s+[A-Z]{3,}/.test(t)) return respRotaFiltro(B, E, t);
  if (/(EM RELACAO|SOBRE|SABER) (A |DA )?MINHA EQUIPE|^(MINHA |A )?EQUIPE( AGORA| HOJE| JA)?\W*$|^(E )?(A )?(MINHA )?EQUIPE\W*$/.test(t)) return respResumo(B, E);   /* "equipe agora" (27/10/2026, Cristiano) */
  // "NAO BATE / DIVERGENTE DO CEVEN" (27/10/2026, Andrey e Leandro: a IA pedia desculpas e dizia que nao tem o CEVEN): de onde vem cada numero + registra para auditoria
  if (/DIVERGENTE|DIFERENTE(S)? D[OA] (CEVEN|ANALISTA|ACOMPANHAMENTO)|NAO BATE|NAO ESTA BATENDO|NUMEROS? ERRAD|ESTA ERRAD/.test(t)) {
    try { await B.registraPedido('divergencia', texto, c.nome, c); } catch (e) {}
    const x = await totaisOficiais(B, E);
    return [`🔎 *Anotei a divergência para conferir hoje, ${titulo(String(c.nome || '').split(' ')[0])}.* De onde vêm os meus números (${E.nome}):`,
      `• *Faturado e pendente:* painel de cada vendedor no CEVEN (atualiza ao longo do dia): ${R$(x.fat)} + ${R$(x.pend)}`,
      `• *Meta:* a da hierarquia do CEVEN (tela do supervisor/gerente): ${R$(x.meta)}`,
      `• *Positivação:* clientes com faturamento no mês, do CEVEN: ${N(x.pos)} de ${N(x.metaPos)}`,
      '', 'Me diga *qual número* e *qual valor* você vê (ou mande o print) que eu comparo vendedor a vendedor.'].join('\n');
  }
  // EQUIPE (Vitorio, 27/10/2026): "como esta o dia da minha equipe" = 1 mensagem, 1 linha por vendedor (rota) + sugestao do que pedir; "panorama da minha equipe" =
  // 1 linha por vendedor com o mes; "um por um" = uma mensagem por vendedor (o bot separa no ⟪⟫)
  if (/UM POR UM|UMA MENSAGEM POR VENDEDOR|SEPARADO POR VENDEDOR/.test(t) && E.vend.length > 1) {
    const V = E.vend.filter((v) => v.varejo ? v.visP > 0 || v.dig > 0 : v.meta > 0 || v.dig > 0).slice(0, 20);
    const partes = []; for (const v of V) partes.push(await respDiaVendedor(B, E, v));
    return [`📋 *${E.nome}* — ${V.length} vendedores, um por mensagem:`, ...partes].join('\n⟪⟫\n');
  }
  if (/DIA DA (MINHA )?EQUIPE|COMO (ESTA|FOI|TA|VAI) (O DIA|A ROTA) DA (MINHA )?EQUIPE|ROTA DA (MINHA )?EQUIPE|COMO (ESTA|TA) (A )?MINHA EQUIPE HOJE|MINHA EQUIPE HOJE/.test(t) && !/LIGA|MIX|ZERAD|POSITIVA|META|FATUR/.test(t)) return respDiaEquipe(B, E);
  if (/PANORAMA DA (MINHA )?EQUIPE|TODOS (OS )?(MEUS )?VENDEDORES|CADA (UM DOS )?VENDEDOR(ES)?\b|VENDEDOR POR VENDEDOR/.test(t) && !/POSITIVA|RECORRENCIA|MIX|LIGA|ZERAD|ROTA|VISITA|PREMIA|META DE |INDUSTRIA|DEVOLU|PEDIDO/.test(t)) return respTodosVendedores(E);
  // ONTEM (27/10/2026: Allison "como foi a venda do vendedor 60 ontem?", Cristiano "desempenho da equipe ontem"): pedidos de ontem do escopo ou do vendedor citado
  if (/\bONTEM\b/.test(t) && !/LIGA|CHAMPIONS|BRASILEIRAO|DEVOLU|COMO FECHOU|RELATORIO DE ONTEM|^(OS )?CLIENTES?\b|\bCLIENTES (D[AOE]|DA VENDEDORA|DO VENDEDOR)\b/.test(t)) {   /* "clientes X ontem" = lista de clientes (abaixo) */ const po = achaPessoa(E, t); const Eo = po && po.tipo === 'vend' ? { ...E, nome: vn(po.alvo), vend: [po.alvo], rca: po.alvo.rca, filiais: [po.alvo.filial] } : E; return respPeriodoDias(B, Eo, t, { de: 1, ate: 1, ontem: true }); }
  // "minha meta (de faturamento)?" (Priscila, 26/10/2026, caiu na IA com numero da filial): meta, faturado, pendente e falta DO ESCOPO, sempre resposta pronta
  if (/\bMETAS?\b/.test(t) && !/PREMIA|KPI|\bMIX\b|TICKET|FASEAMENTO|RECORRENCIA|INDUSTRIA|FORNECEDOR|BATER(AM)?\b|BATEU|BATIDA|QUEM|QUAIS|POSITIVA/.test(t) && !pessoa0(E, t)) { const ri = await respMetasIndustria(B, E, t, achaPessoa(E, t)); if (ri) return ri; return respFalta(B, E); }   /* industria citada (Condor, Colgate) = meta da industria (27/10/2026, Jorge/Anderson) */
  if (/CHE?C?K.?IN|CHE?C?K.?OUT/.test(t) && !/FORA DO CLIENTE|CHE?C?K.?IN FORA/.test(t)) { const pc = achaPessoa(E, t); return pc && pc.tipo === 'vend' ? respClientesDia(pc.alvo, t) : respCheckinEquipe(E); }
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
    // devolucao do VENDEDOR citado (ou da conversa) e do GERENTE citado (grupo) (27/10/2026: "devolucao do vendedor 1067", "apenas da MCD do gerente Adriano" -> Brasil)
    const pd = achaPessoa(E, t), gd = (t.match(/GERENTE\s+([A-Z]{3,})/) || [])[1];
    if (pd && pd.tipo === 'vend') return respDevolucao({ ...E, nome: vn(pd.alvo), vend: [pd.alvo], nacional: false, filiais: [pd.alvo.filial] }, t);
    if (gd && E.vend.some((v) => sem(v.grupo || '') === gd)) return respDevolucao({ ...E, nome: `${E.vend.find((v) => sem(v.grupo || '') === gd).filial} · ${titulo(gd)}`, vend: E.vend.filter((v) => sem(v.grupo || '') === gd), nacional: false }, t);
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
  // TENDENCIA liberada (Vitorio, 26/10/2026: "e matematica pura... so deixa claro que isso e tendencia"): ritmo de faturado+pendente x dias uteis, sempre rotulado
  if (/PROJE|PREVISAO|TENDENCIA|VAMOS FECHAR|VAI FECHAR|QUANTO (VAMOS|VAI|IREMOS) FECHAR|FECHAMENTO DO MES|ESTIMATIVA/.test(t)) return respTendencia(B, E);
  if (/PERDENDO VENDA|PERDEMOS VENDA|ONDE (ESTAMOS )?PERDE|OPORTUNIDADES?\b/.test(t) && !/\+ ?MIX|MAIS ?MIX/.test(t)) return '🔎 *Onde estamos perdendo venda* (o que mais caiu contra o mês passado até o mesmo dia):\n\n' + await respComparaMes(B, E, 'MES PASSADO', null);
  if (/OFERECER|O QUE (EU )?(POSSO |DEVO )?(VENDER|LEVAR) (PRO|PARA|NO|NA)|SUGESTAO PARA O CLIENTE|(LEVAR|SUGERIR) (PRO|PARA O|PARA A|NO|NA) |PRODUTOS? (LEVAR|OFERECER|SUGERIR)/.test(t)) { const r = await respOferecer(B, E, t); if (r) return r; }
  let pessoa = achaPessoa(E, t);
  if (E.rca && E.vend[0]) pessoa = { tipo: 'vend', alvo: E.vend[0], empate: [E.vend[0]] };   /* vendedor: toda pergunta e sobre ele mesmo */
  if (!pessoa && /\b(ELA|ELE|DELA|DELE|DESSA|DESSE|ESSA|ESSE|NELA|NELE|PRA ELA|PRA ELE|MESMA|MESMO)\b/.test(t)) for (const h of anteriores || []) { pessoa = achaPessoa(E, sem(h)); if (pessoa) break; }
  // VENDEDOR CITADO PELO CODIGO E FORA DO ESCOPO (27/10/2026, Cristiano/TSJ "meta de mix do vendedor 59" -> recebia a equipe inteira): diz que nao e da equipe
  { const mc = t.match(/(VENDEDORA?|RCA|SETOR|COD(?:IGO)?)\s*(\d{1,5})\b/); if (!pessoa && mc && !/CLIENTE.{0,15}(COD(IGO)?|#)?\s*\d/.test(t) && (E.supervisor || E.grupo || E.rca || !E.nacional) && !/TOP|ULTIMOS|DIAS/.test(t)) return `🔎 O código *${mc[2]}* não está ${E.supervisor ? 'na sua equipe' : 'em ' + E.nome}. Confere o número? Se for de outra equipe, quem vê é o supervisor dela ou a diretoria.`; }
  // CONTINUACAO DA CONVERSA (Vitorio, 27/10/2026: "pergunto como foi o dia do vendedor X... dai pergunto e o mes, vc respondeu outra coisa totalmente diferente"):
  // pergunta curta ou que comeca com "e ..." sem pessoa citada herda o vendedor/supervisor da ultima pergunta (a mais recente primeiro).
  if (!pessoa && (/^E\b/.test(t) || t.split(/\s+/).filter(Boolean).length <= 4) && !/\bEQUIPE\b|\bTIME\b|\bFILIAL\b|\bBRASIL\b|TODAS|VENDEDORES|ZERADOS|RANKING|\bCLIENTE\b.{0,20}\d/.test(t))   /* "equipe agora" depois do vendedor 32 = a equipe (27/10/2026) */ for (const h of (anteriores || [])) { pessoa = achaPessoa(E, sem(h)); if (pessoa) break; }
  // "CLIENTES <VENDEDOR> [hoje|ontem|acumulado/mes]" (27/10/2026): quem comprou, quem nao (e ha quantos dias), quem foi visitado, quantos ja compraram
  if (pessoa && pessoa.tipo === 'vend' && /^(OS )?CLIENTES?\b|\bCLIENTES (D[AOE]|DA VENDEDORA|DO VENDEDOR)\b/.test(t) && !/PRODUTO|SKU|\bMIX\b|RECORRENCIA|PAROU|COMPRAVA|INDUSTRIA|CHE?C?K|JUSTIF|MOTIVO|QUANTOS CLIENTES.{0,70}ROTA|SEM COMPRA|NAO COMPR|NAO VEND|NAO POSITIV|CURVA/.test(t)) {
    const per = /\bONTEM\b/.test(t) ? 'ontem' : /ACUMULAD|\bMES\b|OUTUBRO|CARTEIRA/.test(t) ? 'mes' : 'hoje';
    return respClientesVend(B, pessoa.alvo, per);
  }
  // ROTA DE HOJE x MES (27/10/2026, Marcio/ABC: "dos clientes que a Nilva vai visitar HOJE, quais ainda nao positivou esse mes" ia para a curva do mes inteiro;
  // Vitorio: "misturando mes com dia"). Hoje/visitar/rota + nao comprou = so a rota de hoje; "quais clientes vai visitar hoje" = rota completa com compra e tags.
  { const hojeRota = /(VISITAR|VISITA|ROTA|PASSAR).{0,30}\b(HOJE|HJ)\b|\b(HOJE|HJ)\b.{0,40}(VISITAR|ROTA)|VAI VISITAR|IRA VISITAR|VAO SER VISITAD|^CLIENTES? .{0,40}\b(HOJE|HJ)\b/.test(t);   /* "cliente da Luciana de API hoje" (27/10/2026) */
    if (pessoa && pessoa.tipo === 'vend' && hojeRota && /NAO (COMPR|POSITIV|VEND)|SEM COMPRA|AINDA NAO/.test(t)) return respRotaHojeCompleta(B, pessoa.alvo, true);
    if (pessoa && pessoa.tipo === 'vend' && hojeRota && /QUA(L|IS)|QUE CLIENTES|LISTA|^CLIENTES?\b/.test(t) && !/VISITOU|VISITADOS|JUSTIF|CHE?C?K|HORARIO|MOTIVO/.test(t)) return respRotaHojeCompleta(B, pessoa.alvo, false); }
  // DIA x MES DO VENDEDOR (27/10/2026): "como foi o dia do X" = so hoje; "e o mes?" / "como foi o mes" = resumo do mes dele (respVendedor)
  if (pessoa && pessoa.tipo === 'vend' && /\bE (O |NO )?MES\W*$|^(E )?(O |NO |DO )?MES\W*$|COMO (FOI|ESTA|TA|VAI) O MES/.test(t) && !/NAO VEND|NAO COMPR|CURVA|SEM VENDA/.test(t)) return respVendedor(B, E, pessoa.alvo);
  if (pessoa && pessoa.tipo === 'vend' && /COMO FOI O DIA|O DIA D[AOE]\b|COMO FOI (HOJE|O DIA)/.test(t) && !/LIGA|BRASILEIRAO|CHAMPIONS/.test(t)) return respDiaVendedor(B, E, pessoa.alvo);
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
  if ((pessoa && pessoa.tipo === 'vend' && /^(E )?(O |NO |DO |E NO )?MES\W*$|COMO (FOI|ESTA|TA|VAI) O MES|^E NO MES|\bE (O |NO )?MES\W*$/.test(t)) || pessoa && pessoa.tipo === 'vend' && /DESDE O DIA|NO MES|DO MES|ESTE MES|ESSE MES|NESTE MES|CURVA NEGATIVA|ATE HOJE|SEM COMPRA|AINDA NAO (VENDEU|COMPROU)|RELACAO D[OE] (TODOS )?(OS )?CLIENTES|LISTA COMPLETA/.test(t) && /NAO VEND|NAO COMPR|SEM VENDA|SEM PEDIDO|CURVA|NAO POSITIV|SEM COMPRA/.test(t) || (pessoa && pessoa.tipo === 'vend' && /FALTA(M)? (SER )?POSITIV|FALTA POSITIVAR|AINDA NAO (COMPROU|COMPRARAM|POSITIV)|NAO POSITIVAD|CURVA NEGATIVA/.test(t))) {
    const v = pessoa.alvo, m = v.mesV || {};
    // CURVA NEGATIVA = clientes da carteira do mes (roteiro do mes) que ainda NAO compraram neste mes (data da ultima compra antes do dia 1)
    if (Array.isArray(v.roteiroMes) && v.roteiroMes.length) {
      // 27/10/2026: a data_ultima_compra do roteiro vem com valor-padrao do CEVEN (01/01/1900, 05/12/2025) -> "46.320 dias". Agora: comprou no mes = vendas item
      // a item (ate ontem) + positivado no roteiro do mes; ultima compra real = historico do +MIX (60 dias antes do mes); formato limpo Cliente · Ultima compra · Dias.
      const mes = hojeSP().slice(0, 7), cli = new Map();
      const { vendasEscopo } = await import('./respostas/vendas.js');
      const VM = await vendasEscopo(B, { filiais: [v.filial], rca: v.rca, vend: [v] }).catch(() => null);
      const compraram = new Set(((VM && VM.linhas) || []).filter((l) => String(l.r) === String(v.rca)).map((l) => String(l.c)));
      let H = {}; try { H = JSON.parse(await B.raw(`public/mix_hist/${v.filial}.json`) || '{}').c || {}; } catch (e) { H = {}; }
      const ultH = (cnpj) => { const x = H[String(cnpj || '').replace(/\D/g, '')]; if (!x) return null; const m2 = String(x).split(',').map((p) => p.split(':')[1]).filter(Boolean).sort().pop(); return m2 ? `20${m2.slice(0, 2)}-${m2.slice(2, 4)}-${m2.slice(4, 6)}` : null; };
      for (const c of v.roteiroMes) { const k = String(c.id_cliente); const x = cli.get(k) || { c, comprou: false }; if (/POSITIVADO|EFETIVADO/.test(String(c.status || ''))) x.comprou = true; cli.set(k, x); }
      const nao = [...cli.entries()].filter(([k, x]) => !x.comprou && !compraram.has(k)).map(([k, x]) => { const u = ultH(x.c.cnpj); return { c: x.c, u, d: u ? Math.round((Date.parse(hojeSP()) - Date.parse(u)) / 864e5) : null }; }).sort((a, b) => (a.d ?? 999) - (b.d ?? 999));
      const n = /VER MAIS|LISTA COMPLETA|TODOS|COMPLETA/.test(t) ? 80 : 25;
      return [`📉 *Curva negativa — ${v.rca} - ${titulo(v.nome)}* (${v.filial})`, `Carteira do mês: *${cli.size} clientes* · já compraram: *${cli.size - nao.length}* · *ainda não compraram: ${nao.length}*`, '',
        ...(nao.length ? ['_Cliente · Última compra · Dias sem compra_'] : []),
        ...nao.slice(0, n).map((x) => `${titulo(x.c.nome_cliente || x.c.razao_social || 'cliente')} · ${x.u ? x.u.slice(8, 10) + '/' + x.u.slice(5, 7) + ' · ' + x.d + ' dias' : '— · +60 dias'}`),
        nao.length > n ? `… e mais ${nao.length - n} (peça "ver mais")` : '', '', SUGESTAO + (nao.length ? 'começar por quem comprou há menos tempo: é mais fácil de recuperar.' : 'carteira inteira já comprou no mês.')].filter((x) => x !== '').join('\n');
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
  // ROTA DE HOJE = QUANTOS + QUEM AINDA NAO COMPROU NO MES (Vitorio, 27/10/2026). Detalhe de visita/justificativa/horario segue para a rota cliente a cliente.
  const querRotaQtd = /QUANTOS CLIENTES.{0,70}ROTA|NA ROTA (DE )?HOJE|ROTA DE HOJE|CLIENTES (DA|NA) ROTA/.test(t) && !/VISITOU|VISITAD|NAO VENDEU|SEM VENDA|JUSTIFIC|MOTIVO|CHE?C?K|HORARIO|FALTA(M)? VISITAR|COMO ESTA/.test(t);
  if (querRotaQtd && pessoa && pessoa.tipo === 'vend') return respRotaHojeResumo(B, E, pessoa.alvo);
  if (querRotaQtd && !pessoa && /QUANTOS|QUAIS/.test(t)) return respRotaHojeResumo(B, E, null);
  if (pessoa && pessoa.tipo === 'vend' && !/COMPR|PRODUTO|SKU/.test(t) && /QUANTOS CLIENTES.{0,70}ROTA|NA ROTA (DE )?HOJE|ROTA DE HOJE|QUA(L|IS) (OS )?CLIENTES?|QUAIS\??$|JUSTIFICATIV|MOTIVO|NAO VENDEU|SEM VENDA|VISITOU|VISITAD|CHECK|ONDE (ELA|ELE) (FOI|ESTA)|POSITIVOU|VENDEU (PARA|PRA)|NENHUMA VISITA|FEZ .{0,20}VISITA|VISITAS? HOJE|NAO VISITOU/.test(t) && !/ROTA DO MES|NO MES|DO MES/.test(t)) return respClientesDia(pessoa.alvo, t);   // 26/10/2026: 'Ronaldo Bica nao fez nenhuma visita?' trazia o resumo
  // PERIODOS (25/10/2026): comparacao com o mes passado, dias sem pedido, clientes sem comprar
  if (/CLIENTE/.test(t) && /SEM COMPRAR|NAO COMPRA|\bN COMPRA|PARADOS?|HA MAIS DE|DIAS SEM/.test(t) && !/COMPRAVA|PAROU|PARARAM/.test(t)) return respClientesSemComprar(B, E, t);   /* "quem comprava X e parou... desses" = recuperacao (27/10/2026) */
  if (/DIAS (SEGUIDOS )?SEM (VENDER|PEDIDO|VENDA)|HA \d+ DIAS SEM|HA MAIS DE \d+ DIAS|\d+ DIAS SEM|SEM PEDIDO HA/.test(t)) return respDiasSemPedido(B, E, t);
  { const per = pedePeriodo(t); if (per && /PEDIDO|CAPTA|VEND|DIGITA|FATUR|QUANTO/.test(t)) return respPeriodoDias(B, E, t, per); }
  if (/MES PASSADO|MES ANTERIOR|SETEMBRO|AGOSTO|\bM-1\b|COMPARAD|EM RELACAO AO MES|CAIU|CRESCEU|EVOLUCAO|ESTE MES X|ESSE MES X/.test(t) && !/LIGA|CHAMPI|POSICAO|RANKING DA LIGA/.test(t) && !/SEMANA(L|IS)|POR SEMANA|SEMANA A SEMANA|DIA DA SEMANA|QUE DIA/.test(t) && !(t.match(new RegExp(FRX.source, 'g')) || []).slice(1).length) return respComparaMes(B, E, t, pessoa);
  // METAS DAS INDUSTRIAS = Premiacao RV do CEVEN (Vitorio, 25/10/2026)
  // KPIs DA PREMIACAO (26/10/2026: meta de ticket medio, mix, faseamento, recorrencia)
  if (/\bMETAS?\b|KPI|PREMIA/.test(t) && /TICKET|\bMIX\b|FASEAMENTO|FASIAMENTO|FASAMENTO|RECORRENCIA|\bKPIS?\b/.test(t)) return respKpisPremiacao(B, E, t, pessoa);
  // "performance de vendas POR INDUSTRIA da filial" (Rudinei/TPA, 26/10/2026: caia no resumo): mesma resposta das metas por industria da Premiacao
  if (/POR (INDUSTRIA|FORNECEDOR)|INDUSTRIAS\b|DESEMPENHO DAS INDUSTRIAS|PERFORMANCE (DAS |DE )?(VENDAS )?(POR |DAS )?INDUSTRIA/.test(t)) { const r = await respMetasIndustria(B, E, t, pessoa); if (r) return r; }
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
  if (/CARTEIRA|A FATURAR|FATURADO (\+|MAIS|E) (CARTEIRA|PENDENTE)|SOMANDO|VOLUME FINANCEIRO|\bPENDENTE\b/.test(t)) return respCarteira(B, pessoa && pessoa.tipo === 'vend' ? { ...E, nome: vn(pessoa.alvo), vend: [pessoa.alvo], rca: pessoa.alvo.rca } : E);   /* "carteira do vendedor 59" = so ele (27/10/2026, Allison) */
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
  // PEDIDO POR NUMERO (Ivayr/TCA, 26/10/2026: "ja faturou o pedido 1190000030" -> recebeu o resumo da equipe). O numero/status do pedido ainda NAO esta na base (D1);
  // fica no banco do Data Lake, que esta sendo levado para o D1. Ate la: diz a verdade e registra o pedido para a diretoria.
  if (/PEDIDO\D{0,12}\d{7,}|\b\d{9,11}\b.{0,20}(FATUROU|FATURADO|STATUS)/.test(t)) { const rp = await respPedidoNumero(B, E, t); if (rp && rp.includes('não está na base')) { try { await B.registraPedido('pedido_por_numero', texto, c.nome, c); } catch (e) {} } if (rp) return rp; }
  // CEO, 26/10/2026: "quantos clientes a Triunfante ja vendeu esse mes de outubro" caiu no "hoje" -> clientes que compraram no mes = positivacao do mes
  if (/QUANTOS CLIENTES|CLIENTES (JA )?(COMPRARAM|POSITIVAD|ATENDID)|CLIENTES? (QUE )?(A \w+ )?(JA )?(VENDEU|VENDEMOS|VENDERAM)/.test(t) && !/PRODUTO|SKU|INDUSTRIA|PAROU|NAO COMPR|SEM COMPR/.test(t)) return respPositivacao(B, E);
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
// ESCOPO DE QUEM PERGUNTA (um lugar so): gerente = filial/grupo; supervisor = equipe; vendedor = ele; diretoria = Brasil ou a filial citada
// pessoa citada (vendedor/supervisor) -> a pergunta de meta e sobre ela, nao sobre o escopo
const pessoa0 = (E, t) => { const p = achaPessoa(E, t); return p && p.tipo === 'vend' ? p : null; };
export function escopoDoContato(c, fm) {
  const preso = (c.papel === 'gerente' || c.papel === 'supervisor' || c.papel === 'vendedor') && c.filial;
  const fil = preso ? c.filial : fm ? fm[1] : null;
  return { preso, fil, grupo: preso ? c.grupo || null : null, supervisor: c.papel === 'supervisor' ? c.supervisor || c.nome : null, rcaV: c.papel === 'vendedor' ? String(c.rca) : null };
}
export async function respondeIA(env, B, c, texto, historico) {
  if (!env.AI) return null;
  const t = sem(texto); const fm = t.match(FRX);
  // VAZAMENTO CORRIGIDO (26/10/2026, Priscila/TPH supervisora: 'minha meta de faturamento?' -> R$ 12,06 mi): a IA recebia o resumo do Brasil (supervisor) ou da filial.
  // Agora o MESMO escopo das respostas prontas: supervisor ve so a equipe, vendedor so ele.
  const ec = escopoDoContato(c, fm);
  const escIA = ec.rcaV ? { nome: nome2(c.nome) + ' (RCA ' + ec.rcaV + ')', filiais: [ec.fil], grupo: null, supervisor: null, rca: ec.rcaV, nacional: false }
    : ec.fil ? { nome: ec.supervisor ? 'Equipe ' + nome2(ec.supervisor) + ' (' + ec.fil + ')' : ec.fil + (ec.grupo ? ' · ' + titulo(ec.grupo) : ''), filiais: [ec.fil], grupo: ec.supervisor ? null : ec.grupo, supervisor: ec.supervisor, nacional: false } : { nome: 'Brasil', filiais: FILIAIS, grupo: null, nacional: true };
  let base; try { base = await respResumo(B, await carregaEscopo(B, escIA)); } catch (e) { base = 'sem dado'; }
  const sys = `Você é o JOTA, o assistente do +MIX da Triunfante no WhatsApp: colega de vendas animado e direto, que usa a linguagem do futebol da Champions Triunfante quando cabe. Responde em português do Brasil como um gerente comercial experiente.
Quem fala com você: ${titulo(c.nome)}, ${c.papel}${c.filial ? ' da filial ' + c.filial : ' (diretoria nacional: sem filial citada = Brasil todo)'}${c.grupo ? ', grupo ' + c.grupo : ''}.
REGRAS: use SÓ os números do RESUMO abaixo, exatamente como estão; nunca invente, estime ou projete; sem o dado, diga que não tem e sugira uma pergunta que o Jota responde (ex.: "hoje", "zerados", "por supervisor", "vendedor Nome", "falta", "liga", "+mix", "quem compra Oreo", "compromisso", "devoluções", "pênaltis", "incentivo").
NUNCA prometa o que você não faz: você NÃO é programável, NÃO envia relatório automático, NÃO muda equipe nem cadastro, NÃO "vai considerar" nada; se pedirem isso, diga que anotou e que a diretoria decide. Nunca mostre dado de fora da equipe/filial de quem pergunta. Cobrança (Liga, eficácia, zerados) = só varejo de campo; para mostrar roteiro e clientes, todos os canais. Faturado e pendente sempre separados. Formato WhatsApp: *negrito* com UM asterisco; no máximo 10 linhas; termine com "🎯 *Sugestão do Jota:*" e UMA ação concreta.
RESUMO: ${base.slice(0, 6000)}`;
  try { const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [{ role: 'system', content: sys }, ...historico, { role: 'user', content: texto }], max_tokens: 600 }); const s = String((r && (r.response || r.result)) || '').trim().replace(/\*\*/g, '*').replace(/^#+\s*/gm, ''); return s || null; } catch (e) { return null; }
}
