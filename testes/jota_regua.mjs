// RÉGUA DE QUALIDADE DO JOTA (16/11/2026) — regras objetivas, verificáveis por código, que reprovam uma resposta.
// Documento: docs/REGUA_QUALIDADE_JOTA.md (mesmos ids). Uso:
//   import { avaliar } from './jota_regua.mjs';
//   avaliar(pergunta, resposta, { papel, hora: 'HH:MM' (Brasília), data: 'AAAA-MM-DD', ultimaResposta, cadastrado })
//     -> [{ id, nome, severidade: 'bloqueia'|'alerta', detalhe }]
// Testes embutidos (casos reais de docs/AUDITORIA_JOTA_2026-11-16.md e de bot_msgs de 16/11): node testes/jota_regua.mjs
// Não depende do D1 nem do código do JOTA: só texto da pergunta + texto da resposta + contexto.

export const BLOQUEIA = 'bloqueia', ALERTA = 'alerta';
export const LIMITE_LINHAS = 35;

export const REGRAS = {
  R01: { nome: 'FONTE_CEVEN', severidade: BLOQUEIA, descricao: 'Resposta menciona "CEVEN" (o time não deve ver o nome do sistema-fonte nem comparação com ele).' },
  R02: { nome: 'NOTA_TECNICA', severidade: ALERTA, descricao: 'Nota técnica de fonte/leitura para o time (GEROT, Winthor, D1, "lidos até", "Fontes:", "(lido HH:MM)", DOSSIÊ...). O rodapé padrão "Hoje (Clube da Venda · HH:MM)" é permitido.' },
  R03: { nome: 'ZERO_SEM_LEITURA', severidade: BLOQUEIA, descricao: '"R$ 0" / "0 pedidos" / "0 visitas" / "sem rota" do DIA sem leitura do dia (hora de leitura >= 06:00 e no máximo 3 h antes da resposta).' },
  R04: { nome: 'ROTA_ZERO', severidade: BLOQUEIA, descricao: '"Rota: 0 PDVs" / "rota 0" em card de equipe ou filial em dia útil.' },
  R05: { nome: 'PERIODO_TROCADO', severidade: BLOQUEIA, descricao: 'Pergunta do DIA respondida com ficha do MÊS (ou fechamento de outro mês), ou pergunta do MÊS respondida só com o dia.' },
  R06: { nome: 'ASSUNTO_ERRADO', severidade: BLOQUEIA, descricao: 'Pergunta de um assunto (curva negativa, recorrência, devolução, pedido nº, indústria, prospects, liga, pendentes, cortes, menu, aceleradores...) respondida com outro assunto.' },
  R07: { nome: 'LISTA_PEDIDA_SEM_LISTA', severidade: BLOQUEIA, descricao: 'Pediu "quais clientes / quem / lista" e a resposta não traz nenhum cliente.' },
  R08: { nome: 'NEGATIVA_CONTRADITORIA', severidade: BLOQUEIA, descricao: 'Resposta negativa ("nenhum cliente...") que contradiz um número da própria resposta (ex.: "faltam 18") ou que olha a tag do roteiro em vez da lista pedida.' },
  R09: { nome: 'CONTESTACAO_COM_CARD', severidade: BLOQUEIA, descricao: 'Contestação ou recado ("não procede", "já fez check-in", "está com 3 pedidos") respondido com card de números.' },
  R10: { nome: 'NUMERO_COMO_NOTA', severidade: BLOQUEIA, descricao: 'Número solto (menu/lista) tratado como nota de avaliação.' },
  R11: { nome: 'DUAS_CONTAS', severidade: BLOQUEIA, descricao: 'Duas contas diferentes da mesma métrica na mesma resposta (positivação, faltam positivar, vendido hoje, visitas, faturado).' },
  R12: { nome: 'SEM_ACAO_FINAL', severidade: ALERTA, descricao: 'Pergunta que pede ação (curva, zerados, recorrência, positivar, o que fazer, rota, fechamento, equipe) sem ação final (👉, sugestão, ligar para, comece por...).' },
  R13: { nome: 'SEM_DADO_ATENDIVEL', severidade: BLOQUEIA, descricao: '"Sem dado" / "não está na base" / "não achei" / "não tenho acesso" quando a pergunta é de um assunto que o JOTA atende.' },
  R14: { nome: 'SEM_RESPOSTA', severidade: BLOQUEIA, descricao: 'Ninguém respondeu (inclui pessoa sem cadastro: precisa receber o caminho do cadastro).' },
  R15: { nome: 'VAGO_NO_NOME', severidade: BLOQUEIA, descricao: '"Vago" em nome de equipe/supervisor.' },
  R16: { nome: 'TEXTO_LONGO', severidade: ALERTA, descricao: `Mais de ${LIMITE_LINHAS} linhas com texto.` },
  R17: { nome: 'INDICADOR_VAZIO', severidade: BLOQUEIA, descricao: 'Indicador exibido sem dado: "0 de 0", "(sem dado)", "ticket sem dado". Indicador sem dado não aparece.' },
  R18: { nome: 'PLURAL_ERRADO', severidade: BLOQUEIA, descricao: '"1 pedidos", "1 clientes"... (singular com palavra no plural).' },
  R19: { nome: 'SUGESTAO_CONTRADIZ', severidade: BLOQUEIA, descricao: 'Sugestão que contradiz o dado da própria resposta (ex.: "foco nos zerados" com 0 zerados; "comece pelos ⚠️" sem nenhum ⚠️).' },
  R20: { nome: 'EQUIPE_SEM_VENDEDOR', severidade: BLOQUEIA, descricao: 'Fechamento/dia da equipe (supervisor/gerente) sem a lista por vendedor de quem ficou sem pedido/visita.' },
  R21: { nome: 'ONTEM_DOMINGO', severidade: BLOQUEIA, descricao: '"Ontem (DD/MM)" apontando para um domingo.' },
  R22: { nome: 'FATURADO_NEGATIVO', severidade: ALERTA, descricao: 'Valor negativo (R$ -X) sem explicar que é devolução.' },
  R23: { nome: 'IA_GENERICA', severidade: ALERTA, descricao: 'Texto genérico de modelo ("Infelizmente", "DOSSIÊ 360°", "Peço desculpas", "não tenho acesso").' },
  R24: { nome: 'EXPECTATIVA_DO_CASO', severidade: BLOQUEIA, descricao: 'Caso-chave: a resposta não cumpre o que o diretor definiu para aquela pergunta (deve/não deve).' }
};

// ---------- utilitários ----------
export const sem = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const plano = (s) => String(s || '').replace(/[*_~]/g, '');
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const RE_MES_NOME = new RegExp('\\b(' + MESES.join('|') + ')\\b');
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const RODAPE = /^_?🟢 Hoje \(Clube da Venda[^)]*\): pedidos colocados\._?$|^_?Essa resposta ajudou\?.*$|^_?Clube da Venda · \d{1,2}:\d{2}_?$/;
const linhas = (r) => String(r || '').split('\n').map((l) => l.trim()).filter(Boolean);
const ehSaudacao = (l) => {
  const p = sem(plano(l));
  if (/^🎙️|^entendi:/.test(p)) return true;
  if (/r\$|\d{2,}/.test(p)) return false;
  return /^(aqui esta|olha os numeros|seguem os dados|na mao|bom dia|boa tarde|boa noite|opa|ola|oi|tudo certo|e ai|fala|valeu|perfeito)\b/.test(p) || (/[:!]\s*$/.test(p) && p.split(/\s+/).length <= 12 && !/\d/.test(p));
};
// linhas com conteúdo (sem saudação, sem rodapé)
export const substantivas = (r) => linhas(r).filter((l) => !ehSaudacao(l) && !RODAPE.test(l));
// linha de cabeçalho (não é item de lista por vendedor/cliente)
const ehItem = (l) => /^(•|-|·|\d+\.|\*?\d+\.\*?|🥇|🥈|🥉|⚠️|✅|◻️|🟡|🔴|🟢)\s?/.test(plano(l).trim()) && !/^🟢 Hoje/.test(l);
const hhmm = (s) => { const m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const linhasCliente = (r) => linhas(r).filter((l) => /#\d{3,}/.test(l) || /\b\d+ dias sem compr/.test(sem(l))).length;
const linhasVendedor = (r) => linhas(r).filter((l) => ehItem(l) && /\b\d{1,4} - [A-Za-zÀ-ú]/.test(plano(l))).length;
const ehCard = (r) => {
  const p = plano(r), n = (p.match(/R\$/g) || []).length;
  return n >= 2 || /Dia da Equipe|Opera[cç][aã]o de hoje|Faturado:|Digitado|Pedidos Pendentes|Check-in e check-out|Sua equipe|quanto falta|🧑‍💼|Matinal|DOSSI[ÊE]/i.test(p);
};

// ---------- classificação de período ----------
const RE_Q_DIA = /\bhoje\b|\bdo dia\b|\bdia \d{1,2}\/\d{1,2}|neste momento|agora ha pouco|\bate agora\b.*\bhoje\b/;
const RE_Q_MES = /\bmes\b|mensal|acumulad|fechamento de |\bno mes\b/;
export function periodoPergunta(q, ctx = {}) {
  const s = sem(q);
  if (RE_Q_DIA.test(s)) return 'dia';
  if (RE_Q_MES.test(s) || (RE_MES_NOME.test(s) && !/\d{1,2}\/\d{1,2}/.test(s))) return 'mes';
  // "fechamento" sem mês depois das 17h = fechamento do DIA (Vitório, 16/11/2026)
  if (/\bfechamento\b/.test(s) && ctx.hora && hhmm(ctx.hora) >= 17 * 60) return 'dia';
  return null;
}
const RE_R_DIA = /\bhoje\b|digitado|dia da equipe|opera[cç][aã]o de hoje|vendeu|vendido|apito final|seu dia|placar|fechamento do dia|zerados hoje/i;
const RE_R_MES = /faturad|da meta|fechamento de [a-zç]+|foto de \d|\bm[eê]s\b|positiva[cç][aã]o:|matinal|ontem/i;
export function periodoResposta(r) {
  const top = substantivas(r).slice(0, 3).map(plano).join('\n');
  if (RE_R_DIA.test(top)) return 'dia';
  if (RE_R_MES.test(top)) return 'mes';
  return null;
}

// ---------- assuntos (R06) ----------
const INDUSTRIAS = ['arcor', 'condor', 'mondelez', 'colgate', 'heinz', 'marilan', 'bombril', 'red bull', 'ferrero', 'lindt', 'haribo', 'camil', 'gdc', 'mili', 'medix', 'ducoco', 'duracell', 'energizer', 'hemmer', 'bagley', 'ingleza', 'aeroflex', 'amparo', 'gallo', 'hero', 'leao', 'limppano', 'santa maria', 'fantoni', 'best pop', 'super foods', 'brown-forman', 'grassi', '3m'];
const RE_IND = new RegExp('\\b(' + INDUSTRIAS.map((x) => x.replace(/[-]/g, '\\-')).join('|') + ')\\b');
export const ASSUNTOS = [
  { id: 'curva_negativa', q: /curva\s*negativ|clientes? sem compra|sem compra no mes|nao (compraram|comprou|positivad)|ainda nao positiv|quem (nao comprou|parou)|e parou/, r: /curva negativa|ainda nao compraram|clientes sem compra|nao compraram|nao comprou|parou de comprar/, lista: true },
  { id: 'recorrencia', q: /recorr/, r: /recorr/ },
  { id: 'devolucao', q: /devolu|devolv/, r: /devolu|devolv/ },
  { id: 'prospects', q: /prospec/, r: /prospec/ },
  { id: 'liga', q: /\bliga\b|champions|ranking|classifica/, r: /\bliga\b|champions|o no brasil|º no brasil|\bpts\b/ },
  { id: 'pendentes', q: /pendent|bloquead|travad/, r: /pendent|bloquead|liberad/ },
  { id: 'cortes', q: /\bcortes?\b/, r: /\bcorte/ },
  { id: 'menu', q: /^\W*menu\b|menu do jota/, r: /menu do jota/ },
  { id: 'aceleradores', q: /acelerador/, r: /acelerador/ },
  { id: 'hora_do_dado', q: /ultima atualiza|atualizado quando|que horas.*(dado|atualiz)|hora do dado/, r: /atualiz|leitura|\d{1,2}:\d{2}/ },
  { id: 'mix', q: /\+\s*mix|\bmix\b/, r: /mix/ },
  { id: 'prospect_cnpj', q: /\bcnpj\b/, r: /cnpj|cliente/ }
];
const pedidoNoTexto = (q) => {
  const s = sem(q);
  if (/cnpj|cpf|\btel\b|telefone|celular|fone|whats/.test(s)) return null;
  const m = String(q).replace(/\[áudio\]/g, '').match(/(?<![\d.,])(\d{8,10})(?![\d.,]\d)/);
  return m ? m[1] : null;
};
export function assuntosDaPergunta(q) {
  const s = sem(q), out = ASSUNTOS.filter((a) => a.q.test(s)).map((a) => a.id);
  if (pedidoNoTexto(q)) out.push('pedido_numero');
  if (RE_IND.test(s) || /\bindustri|fornecedor/.test(s)) out.push('industria');
  return out;
}

// ---------- contestação / recado (R09) ----------
const RE_CONTESTA = /nao procede|nao confere|nao bate|(esta|estao|ta|tao) errad|incorret|\berrad[oa]s?\b|nao e isso|discord|ja (havia|tinha|fez|realizou)|fez check|(esta|ta) com \d+ pedido|todos (estao|ja) (com|vend)|favor verificar|verificar isso|nao tem o kpi|\be pj\b|confirmar sobre|nao conseguiu digitar|(esta|ta) na rota|\bfalta (a|o) [a-z]+\s*$|^\s*[\d.]+,\d{2}\b|compra e centralizada|ja acionad|no feriado|outro setor/;
export const ehContestacao = (q) => RE_CONTESTA.test(sem(q).replace(/^\[audio\]\s*/, ''));

// ---------- avaliação ----------
export function avaliar(pergunta, resposta, ctx = {}) {
  const v = [], add = (id, detalhe) => v.push({ id, nome: REGRAS[id].nome, severidade: REGRAS[id].severidade, detalhe });
  const q = String(pergunta || '').replace(/^\[áudio\]\s*/i, '').trim(), qs = sem(q);
  const r = String(resposta == null ? '' : resposta), rp = plano(r), rs = sem(rp);
  const L = linhas(r), Ls = substantivas(r);
  const papel = String(ctx.papel || '').toLowerCase();

  // R14 sem resposta
  if (!r.trim() || /^(ok|ok \(.*\)|—|-)$/i.test(r.trim())) { add('R14', ctx.cadastrado === false ? 'pessoa sem cadastro e ninguém respondeu' : 'resposta vazia'); return v; }

  // R01 CEVEN
  if (/\bceven\b/i.test(rp)) add('R01', trecho(rp, /ceven/i));
  // R02 nota técnica (fora o rodapé padrão)
  {
    const corpo = L.filter((l) => !RODAPE.test(l)).map(plano).join('\n');
    const m = corpo.match(/\bGEROT\b|Winthor|\bD1\b|lidos? (at[eé]|[àa]s)|leitura mais recente|🕒 Fontes|\bFontes?:|confer[eê]ncia de cada pedido|\(lido [^)]*\)|DOSSI[ÊE]|base de dados|varredura|conferidos na [uú]ltima hora/i);
    if (m) add('R02', trecho(corpo, new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')));
  }
  // R03 zero do dia sem leitura do dia
  {
    const zero = [
      /(digitado|vendido|vendeu|hoje)[^\n]{0,25}R\$ 0(?![\d,.])/i, /(?<![\d.,])0 pedidos?\b/i, /visitas?:?\s*0 de \d/i,
      /(?<![\d.,])0\/\d+ visitas/i, /\bsem rota\b/i, /n[aã]o tem clientes na rota de hoje/i, /visitou 0 de/i
    ].find((re) => re.test(rp));
    if (zero) {
      const horaResp = hhmm(ctx.hora);
      const leit = [...rp.matchAll(/(?:Clube da Venda[^\n]{0,4}?·?\s*|hoje Clube\s*|lidos? at[eé]\s*)(\d{1,2}:\d{2})/gi)].map((m) => hhmm(m[1]));
      const boa = leit.some((h) => h >= 6 * 60 && (horaResp == null || (horaResp - h <= 180 && horaResp - h >= -5)));
      if (!boa) add('R03', `${trecho(rp, zero)}${leit.length ? ' · leitura ' + leit.map(fmtH).join(', ') : ' · sem hora de leitura do dia'}`);
    }
  }
  // R04 rota zero
  {
    const m = rp.match(/Rota:?\s*0\s*PDVs|\brota 0\b/i);
    if (m && diaUtil(ctx.data)) add('R04', trecho(rp, /Rota:?\s*0\s*PDVs|\brota 0\b/i));
  }
  // R05 período
  {
    const pq = periodoPergunta(q, ctx), pr = periodoResposta(r);
    const mesErrado = pq === 'dia' && /fechamento de (janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i.test(rp);
    if ((pq && pr && pq !== pr) || mesErrado) add('R05', `pergunta do ${pq === 'dia' ? 'DIA' : 'MÊS'}; resposta começa com ${pr === 'dia' ? 'o dia' : 'o mês'}: "${(Ls.slice(0, 2).map(plano).join(' / ')).slice(0, 120)}"`);
  }
  // R06 assunto
  const assuntos = assuntosDaPergunta(q);
  const contesta = ehContestacao(q);
  if (!contesta) {
    for (const a of assuntos) {
      if (a === 'pedido_numero') { const n = pedidoNoTexto(q); if (!rp.includes(n)) add('R06', `pediu o pedido ${n}; a resposta não fala desse pedido`); continue; }
      if (a === 'industria') {
        const ind = (qs.match(RE_IND) || [])[1];
        const analitica = /compar|quem|oportunidade|mais vend|parou|produtos|nao comprou/.test(qs);
        if (ind && !new RegExp(ind, 'i').test(rs)) add('R06', `perguntou de ${ind.toUpperCase()}; a resposta não fala dela`);
        else if (analitica && /metas das industrias|^🏭/m.test(rs) && linhasCliente(r) === 0 && !/\b1\. /.test(rp)) add('R06', 'pergunta analítica de indústria respondida com card de metas');
        continue;
      }
      const def = ASSUNTOS.find((x) => x.id === a);
      if (def && !def.r.test(rs)) add('R06', `assunto "${a}" esperado; resposta começa com "${(Ls[0] ? plano(Ls[0]) : '').slice(0, 90)}"`);
      else if (def && def.lista && linhasCliente(r) < 1 && !/todos (ja )?compraram|nenhum cliente sem compra/.test(rs)) add('R06', `assunto "${a}" sem a lista de clientes`);
    }
  }
  // R07 lista pedida
  if (/\b(quais|quem|lista|liste|listar|relacao)\b|me (manda|passa|envia) (os |meus )?clientes/.test(qs) && /client|loja|pdv|positivar/.test(qs) && !contesta) {
    if (linhasCliente(r) < 1 && !/\b1\. .*\(#?\d+\)/.test(rp)) add('R07', 'pediu quais clientes e não veio nenhum cliente');
  }
  // R08 negativa contraditória
  {
    const neg = rs.match(/nenhum cliente[^\n.]{0,80}/);
    const falta = [...rs.matchAll(/faltam \*?(\d+)/g)].map((m) => Number(m[1])).filter((n) => n > 0);
    if (neg && falta.length) add('R08', `"${neg[0].slice(0, 80)}" mas a própria resposta diz "faltam ${falta[0]}"`);
    else if (neg && /recorr/.test(qs) && /com a tag/.test(neg[0])) add('R08', `"${neg[0].slice(0, 80)}": olhou a tag do roteiro, não a lista de recorrência`);
  }
  // R09 contestação
  if (contesta && ehCard(r) && !/^(anotad|registr|valeu|obrigad|certo|entendi)/i.test(sem(plano(Ls[0] || '')))) add('R09', `recado/contestação respondido com card: "${(Ls[0] ? plano(Ls[0]) : '').slice(0, 90)}"`);
  // R10 número como nota
  if (/^\s*\d{1,3}\s*$/.test(q) && /obrigad[oa] pela nota|nota \d+ anotada|nota \d+ registrada/i.test(rp) && !/nota de 1 a 5|d[eê] uma nota|sua nota/i.test(String(ctx.ultimaResposta || ''))) add('R10', `"${q}" virou nota`);
  // R11 duas contas
  {
    const cab = L.filter((l) => !ehItem(l) && !/recorr/i.test(l)).map(plano).join('\n');
    const mets = { positivados: new Set(), base: new Set(), faltam: new Set(), vendido_hoje: new Set(), visitas: new Set(), faturado: new Set() };
    for (const m of cab.matchAll(/positiva\S*:?\s*(\d+)\s*(?:de|\/)\s*(\d[\d.]*)/gi)) { mets.positivados.add(num(m[1])); mets.base.add(num(m[2])); mets.faltam.add(num(m[2]) - num(m[1])); }
    for (const m of cab.matchAll(/j[aá] compraram:?\s*(\d+)/gi)) mets.positivados.add(num(m[1]));
    for (const m of cab.matchAll(/ainda n[aã]o compraram:?\s*(\d+)/gi)) mets.faltam.add(num(m[1]));
    for (const m of cab.matchAll(/faltam\s*(\d+)\s*(clientes|positiva)/gi)) mets.faltam.add(num(m[1]));
    for (const m of cab.matchAll(/(?:Digitado(?: hoje)?|Vendido hoje|Vendeu)\s*:?\s*R\$\s*([\d.]+)/gi)) mets.vendido_hoje.add(num(m[1]));
    for (const m of cab.matchAll(/visit\S*:?\s*(\d+)\s*de\s*(\d+)/gi)) mets.visitas.add(m[1] + '/' + m[2]);
    for (const m of cab.matchAll(/Faturado(?: l[ií]quido)?:\s*R\$\s*(-?[\d.]+)/gi)) mets.faturado.add(num(m[1]));
    const dif = Object.entries(mets).filter(([, s]) => s.size > 1);
    if (dif.length) add('R11', dif.map(([k, s]) => `${k}: ${[...s].join(' x ')}`).join('; '));
  }
  // R12 ação final
  if (/curva|sem compra|zerad|recorr|positivar|o que (fazer|melhorar)|oque melhorar|como (melhor|bater|chego|chegar)|minha rota|rota de hoje|fechamento|minha equipe|meu time/.test(qs) && !contesta) {
    if (!/👉|sugest[aã]o do jota|amanh[aã]|ligar para|ligue|comece|priori|\bfoco\b|o que fazer|pr[oó]ximo passo|visite|visitar|cobrar|aten[cç][aã]o/i.test(rp)) add('R12', 'sem ação no fim');
  }
  // R13 sem dado em pergunta atendível
  {
    const m = rs.match(/sem a produtividade|nao esta na base|sem dado na base|sem [a-z ]{0,30} na base|nao tenho (acesso|essa informa)|nao (achei|encontrei)|sem informac|nao consegui (achar|encontrar|ler)|ainda nao sei responder|estou em treinamento/);
    const atendivel = assuntos.length || /venda|vendeu|faturad|meta|positiv|cliente|pedido|rota|visita|curva|recorr|equipe|\btime\b|hoje|\bmes\b|corte|loja/.test(qs);
    if (m && atendivel && !contesta) add('R13', `"${m[0]}"`);
  }
  // R15 Vago
  if (/\bvago\b/i.test(rp)) add('R15', trecho(rp, /\bvago\b/i));
  // R16 longo
  if (L.length > LIMITE_LINHAS) add('R16', `${L.length} linhas`);
  // R17 indicador vazio
  {
    const m = rp.match(/(?<![\d.,])0 de 0\b|\(sem dado\)|ticket sem dado|:\s*sem dado/i);
    if (m) add('R17', trecho(rp, /(?<![\d.,])0 de 0\b|\(sem dado\)|ticket sem dado|:\s*sem dado/i));
  }
  // R18 plural (fora item de menu "1 Pedidos a faturar" e fração "0 de 1 vendedores")
  {
    const re = /(^|[^\d.,/$])\b1\s+(pedidos|clientes|vendedores|visitas|dias|pontos|notas|PDVs|zerados|lojas)\b/i;
    for (const l of L.map(plano)) {
      const m = l.match(re); if (!m) continue;
      const antes = l.slice(0, m.index + m[1].length);
      if (/^\s*$/.test(antes) || /\bde\s*$/i.test(antes) || /〕\s*$/.test(antes) || /\b2\s+(pedidos|clientes)/i.test(l.slice(m.index + m[0].length))) continue;
      add('R18', '…' + l.slice(Math.max(0, m.index - 30), m.index + m[0].length + 20) + '…'); break;
    }
  }
  // R19 sugestão contradiz o dado
  {
    const zeradosZero = /zerados?:?\s*0\b|zerados hoje[^:\n]*:\s*0\b/i.test(rp);
    if (/foco nos zerados|comece pelos zerados|cobrar os zerados/i.test(rp) && (zeradosZero || !/zerad/i.test(rp.replace(/foco nos zerados|comece pelos zerados|cobrar os zerados/gi, '')))) add('R19', 'sugere focar nos zerados, mas a resposta mostra 0 zerados');
    if (/comece pelos ⚠️/.test(rp) && !L.some((l) => /^•\s*⚠️|^⚠️/.test(plano(l)))) add('R19', 'manda começar pelos ⚠️ e não há nenhum ⚠️');
  }
  // R20 fechamento/dia da equipe sem vendedores
  if (['supervisor', 'gerente'].includes(papel) && (/fechamento|meu time|minha equipe|\bequipe\b/.test(qs)) && periodoPergunta(q, ctx) === 'dia' && !contesta) {
    if (linhasVendedor(r) < 1 && !/todos (os vendedores )?(com|venderam|positivaram)/i.test(rp)) add('R20', 'sem a lista por vendedor (quem ficou sem pedido/visita)');
  }
  // R21 ontem = domingo
  for (const m of rp.matchAll(/Ontem \((\d{2})\/(\d{2})\)/g)) {
    const ano = Number(String(ctx.data || new Date().toISOString()).slice(0, 4));
    const d = new Date(Date.UTC(ano, Number(m[2]) - 1, Number(m[1]), 12));
    if (d.getUTCDay() === 0) { add('R21', `"Ontem (${m[1]}/${m[2]})" é domingo`); break; }
  }
  // R22 negativo sem explicação
  if (/R\$\s*-\s?\d/.test(rp) && !/devolu/i.test(rp)) add('R22', trecho(rp, /R\$\s*-\s?\d/));
  // R23 IA genérica
  {
    const m = rp.match(/infelizmente|DOSSI[ÊE] 360|pe[cç]o desculpas|n[aã]o tenho acesso/i);
    if (m) add('R23', trecho(rp, new RegExp(m[0], 'i')));
  }
  // R24 expectativas do caso (só casos-chave)
  for (const e of ctx.expectativas || []) {
    if (e.so && e.so(ctx) === false) continue;
    const alvo = e.topo ? Ls.slice(0, e.topo).map(plano).join('\n') : rp;
    if (e.deve && !e.deve.test(alvo)) add('R24', e.msg || `deveria conter ${e.deve}`);
    if (e.naoDeve && e.naoDeve.test(alvo)) add('R24', e.msg || `não deveria conter ${e.naoDeve}`);
    if (e.minClientes && linhasCliente(r) < e.minClientes) add('R24', e.msg || `deveria listar ao menos ${e.minClientes} cliente(s)`);
    if (e.minVendedores && linhasVendedor(r) < e.minVendedores) add('R24', e.msg || `deveria listar ao menos ${e.minVendedores} vendedor(es)`);
  }
  return v;
}
const fmtH = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function trecho(txt, re) { const s = String(txt); const m = s.match(re); if (!m) return ''; const i = Math.max(0, m.index - 30); return '…' + s.slice(i, m.index + m[0].length + 30).replace(/\s+/g, ' ') + '…'; }
function diaUtil(data) { const d = data ? new Date(data + 'T12:00:00Z') : new Date(); const w = d.getUTCDay(); return w >= 1 && w <= 5; }
export const bloqueantes = (v) => v.filter((x) => x.severidade === BLOQUEIA);
export const pontuacao = (v) => v.reduce((s, x) => s + (x.severidade === BLOQUEIA ? 3 : 1), 0);

// =====================================================================================================
// TESTES UNITÁRIOS (casos reais de 16/11/2026). node testes/jota_regua.mjs  -> sai 1 se algum falhar
// =====================================================================================================
const CTX = { data: '2026-11-16' };
export const CASOS_UNITARIOS = [
  // R01 / R11: curva negativa da Tamara com "Painel do CEVEN" e duas contas (59 x 49)
  { q: 'Curva Negativa Tamara de TCV', r: `Aqui está, Vitorio:\n\n📉 *Curva negativa — 352 - Tamara Guedes* (TCV)\nCarteira do mês: *133 clientes* · já compraram: *74* · *ainda não compraram: 59*\n_Painel do CEVEN: positivação 50 de 99. Esta lista segue o roteiro do mês, que é outra conta._\n_Cliente · Última compra · Dias sem compra_\n1. Mercado Cisne (#18271) · 30/10 · 17 dias\n2. Posto Paravis (#4714) · 30/10 · 17 dias\n3. Mercado Rei Do Pao (#9360) · 30/10 · 17 dias\n👉 Comece pelo Mercado Cisne.`, ctx: { ...CTX, papel: 'diretoria', hora: '17:55' }, tem: ['R01', 'R11'], naoTem: ['R06', 'R07'] },
  // R13 / R06: "sem a produtividade do mês na base" para curva negativa
  { q: 'Curva negativa de hoje', r: 'Seguem os dados, Aleksandro:\n\n224 - Aleksandro Rodrigo De Faria (ABC): sem a produtividade do mês na base agora.\n\n*0* Voltar ao menu', ctx: { ...CTX, papel: 'vendedor', hora: '07:16' }, tem: ['R13', 'R06'] },
  // R06: curva negativa da vendedora 10 respondida com a ficha
  { q: 'Curva negativa Vendedora 10 de TSJ', r: 'Olha os números aí, Vitorio:\n\n🧑‍💼 *10 - Fernanda Ferreira Barros* — TSJ · sup. 63 - Ana Yamato · VJ\n💰 Faturado: *R$ 62.168* + pendente R$ 21.264 de R$ 180.000 → *46,4%* da meta\n👥 Positivação: 80 de 104 (76,9%) · faltam 24 clientes\n📝 Hoje: R$ 13.201 em 11 pedidos\n👉 *Amanhã cedo:* ligar para *Armazem Da Pousada* (47 dias sem comprar) e marcar o pedido.', ctx: { ...CTX, papel: 'diretoria', hora: '18:22' }, tem: ['R06'], naoTem: ['R11', 'R13'] },
  // R05: venda de hoje respondida com a ficha do mês
  { q: 'Venda Tamara TCV hoje', r: 'Olha os números aí, Vitorio:\n\n🧑‍💼 *352 - Tamara Guedes* — TCV · sup. 543 - Vago Gabriel · VJ\n💰 Faturado: *R$ 29.885* + pendente R$ 5.556 de R$ 93.000 → *38,1%* da meta\n🎯 Falta: R$ 57.559 · R$ 5.756 por dia útil (10 dias)\n📝 Hoje: R$ 1.569 em 4 pedidos · ticket R$ 392 · visitas 10 de 10 · com venda 4\n\n_🟢 Hoje (Clube da Venda · 17:58): pedidos colocados._', ctx: { ...CTX, papel: 'diretoria', hora: '17:58' }, tem: ['R05', 'R15'], naoTem: ['R03'] },
  // negativo de R05: resposta do dia para pergunta do dia
  { q: 'venda Tamara hoje', r: 'Olha os números aí, Vitorio:\n\n📝 *352 - Tamara Guedes (varejo)* (TCV) — *hoje*\n🎯 Meta do dia: *R$ 5.756* → vendeu *R$ 1.569* (27%) 🔴\n🚶 Rota: visitou *10 de 10* · rota completa\n📝 Vendeu *R$ 1.569* em *4* pedido(s)\n\n🟡 *Visitou e não vendeu (6):*\n• Restaurante Boia Da Roca Ltda (#372791) · *39 dias sem comprar*\n\n👉 *Amanhã cedo:* ligar para *Restaurante Boia Da Roca Ltda*.\n_Clube da Venda · 18:09_', ctx: { ...CTX, papel: 'diretoria', hora: '18:16' }, tem: [], naoTem: ['R05', 'R03', 'R11', 'R02'] },
  // R05: "Fechamento" às 18:16 virou fechamento de outubro
  { q: 'Fechamento', r: 'Olha os números aí, Luis:\n\n🏁 *Fechamento de Outubro — Equipe Luis Boeira (TBE)* (foto de 31/10/2026)\n💰 Faturado líquido: *R$ 2.301.793* de R$ 1.665.000 → *138,2%*\n👥 Positivação: *89* de 110 (80,9%)\n\n*0* Voltar ao menu', ctx: { ...CTX, papel: 'supervisor', hora: '18:16' }, tem: ['R05', 'R20'] },
  // ... mas "Fechamento" às 10h não exige o dia
  { q: 'Fechamento', r: 'Olha os números aí, Luis:\n\n🏁 *Fechamento de Outubro — Equipe Luis Boeira (TBE)* (foto de 31/10/2026)\n💰 Faturado líquido: *R$ 2.301.793* de R$ 1.665.000 → *138,2%*\n👉 Bora repetir em novembro.', ctx: { ...CTX, papel: 'supervisor', hora: '10:00' }, tem: [], naoTem: ['R05', 'R20'] },
  // R17 / R18 / R19 / R20: "Fechamento do dia 16/11/2026" do Luis
  { q: 'Fechamento do dia 16/11/2026', r: 'Na mão, Luis:\n\n📊 *Operação de hoje — Equipe Luis Boeira (TBE)* (18:19)\n💰 Digitado: *R$ 49.468* · 📦 *1* pedidos\n🎯 Varejo com rota: *0 de 0* com venda (sem dado) · 🚨 zerados: 0\n✂️ Cortes: *R$ 0* (0 pedidos) · 🔒 Bloqueados: *R$ 0* (0 pedidos)\n\n*Por supervisor (ordem: digitado):*\n🥇 *Luis Boeira* R$ 49.468 · 1 ped.\n\n🎯 *Sugestão do Jota:* sem bloqueio relevante; foco nos zerados.\n\n_🟢 Hoje (Clube da Venda · 18:09): pedidos colocados._', ctx: { ...CTX, papel: 'supervisor', hora: '18:19' }, tem: ['R17', 'R18', 'R19', 'R20'], naoTem: ['R05'] },
  // R08: recorrência "nenhum cliente com a tag" com "faltam 18"
  { q: 'Quais clientes posso positivar na recorrência ainda?', r: 'Na mão, Renan:\n\n🎯 *Meta de recorrência (GEROT)*: objetivo *39* clientes · meta 80% = *30* · positivados *12* (40,0% da meta · faltam *18*) · R$ 7.750\n_Lista do dia 1º do GEROT: clientes com compra de 31 a 90 dias e nenhuma nos 30 dias antes do dia 1º._\n\n🔄 128 - Renan Lechuk (varejo): nenhum cliente com a tag *Recorrência* no roteiro (hoje e no mês).\n\n*0* Voltar ao menu', ctx: { ...CTX, papel: 'vendedor', hora: '18:21' }, tem: ['R08', 'R07', 'R02'], naoTem: ['R11'] },
  // R06 pedido nº: pediu o pedido e veio lista de pendentes
  { q: 'Qual o status do pedido 1038000485', r: 'Seguem os dados, Jonathan:\n\n💼 *Clientes com Pedidos Pendentes de Faturamento (Liberados) — Equipe Jonathan Fernandes (TPH)*\nTotal: *35 pedido(s)* · *R$ 19.166*\n_Status da última conferência de cada pedido (hora ao lado) · 0 de 35 conferidos na última hora._\n• Pedido 124000824 (13/11) · cliente #76183 · *R$ 1.226* · LIBERADO _(lido 01:04)_', ctx: { ...CTX, papel: 'supervisor', hora: '10:12' }, tem: ['R06', 'R02'] },
  // pedido nº solto (Lielson)
  { q: '382000940', r: 'Olha os números aí, Lielson:\n\n🧑‍💼 *382 - Lielson Carlos Machado* — TCA · sup. 104 - Ivayr Miranda · VJ\n💰 Faturado: *R$ 23.876* + pendente R$ 3.221 de R$ 55.000', ctx: { ...CTX, papel: 'vendedor', hora: '15:21' }, tem: ['R06'] },
  // negativo: pedido encontrado
  { q: 'Queria saber se o pedido 477000212. Foi faturado', r: 'Aqui está, Elisandra:\n\n📦 Pedido *477000212* (12/11) · cliente #12345 · R$ 1.926 · *Faturado* em 13/11.', ctx: { ...CTX, papel: 'vendedor', hora: '14:34' }, tem: [], naoTem: ['R06'] },
  // R03 zero sem leitura (pedidos lidos de madrugada) + R09 contestação + R17 ticket sem dado
  { q: 'Vendedora fez check-in antes das 10hs. Informação recebida dr não checkin não procede.', r: 'Seguem os dados, Washington:\n\n📝 *Equipe Washington Rosa (API) hoje (varejo de rota)* (11:30)\nDigitado: *R$ 0* em *0* pedidos · ticket sem dado\n_Pedidos lidos até 03:11 (leitura mais recente)_', ctx: { ...CTX, papel: 'supervisor', hora: '11:30' }, tem: ['R03', 'R09', 'R17', 'R02'] },
  // negativo de R03: zero com leitura do Clube recente
  { q: 'minha equipe hoje', r: 'Na mão, Sueli:\n\n📋 *Dia da Equipe Sueli Polli (API)* (16/11)\n💰 Digitado hoje: *R$ 0* em *0 pedidos*\n• ⚠️ *1200 - Karina Silva (varejo)*: R$ 0 · sem pedido\n🎯 *Sugestão do Jota:* comece pelos ⚠️ (rota e sem pedido).\n\n_🟢 Hoje (Clube da Venda · 09:58): pedidos colocados._', ctx: { ...CTX, papel: 'supervisor', hora: '10:05' }, tem: [], naoTem: ['R03', 'R19', 'R20'] },
  // R03: "Vendido hoje: R$ 0" às 14:36 sem leitura
  { q: 'Boa tarde', r: '🍽️ Tudo certo, Alex? Aqui vai o seu parcial:\n\n📊 *Mês:* *34,5%* da meta · Positivação: *28/37*\n📝 Vendido hoje: *R$ 0*\n💰 Para o ritmo da meta faltam *R$ 33.427*', ctx: { ...CTX, papel: 'vendedor', hora: '14:36' }, tem: ['R03'], naoTem: ['R05'] },
  // R04: matinal "Rota 0 PDVs"
  { q: 'Matinal', r: 'Seguem os dados, Alyfer:\n\n☀️ *Matinal — Equipe Alyfer Mendes (MCD)* (10/19 du · faltam 10 · GEROT Atual · 16/11/2026)\n📅 *Ontem (13/11):* *R$ 75.149* em *21* ped.\n👥 Positivação: *422* / 1.157 (36,5%) · 🗺️ Rota: *0* PDVs · 🚫 Bloq.: *84*', ctx: { ...CTX, papel: 'supervisor', hora: '08:24' }, tem: ['R04', 'R02'], naoTem: ['R21'] },
  // R21: "Ontem (15/11)" = domingo
  { q: 'Bom dia', r: '☀️ Opa, Alan, bom dia! Seu resumo antes de pegar a estrada:\n\n📅 *Ontem (15/11):* sem pedido no Clube\n💰 *Acumulado:* *36,5%* da meta (R$ 38.319 de R$ 105.002)', ctx: { ...CTX, papel: 'vendedor', hora: '08:01' }, tem: ['R21'] },
  // R10: número lido como nota
  { q: '4', r: 'Obrigado pela nota 4, Alex! Isso me ajuda a melhorar.', ctx: { ...CTX, papel: 'vendedor', hora: '14:38', ultimaResposta: '📋 *MENU DO JOTA*\n*1.* Hoje\n*4.* Faseamento' }, tem: ['R10'] },
  { q: '55', r: 'Olha os números aí, Ailton: Esse número não está no menu. Escolha de 1 a 15.\n\n📋 *MENU DO JOTA* — Ailton (supervisor)', ctx: { ...CTX, papel: 'supervisor', hora: '08:51' }, tem: [], naoTem: ['R10'] },
  // R09: "Todos estão com pedido" respondido com pendentes
  { q: 'Todos estão com pedido', r: 'Na mão, Sueli:\n\n💼 *Clientes com Pedidos Pendentes de Faturamento (Liberados) — Equipe Sueli Polli (API)*\nTotal: *21 pedido(s)* · *R$ 10.842*\n• Pedido 529000597 (12/11) · cliente #86700 · *R$ 131* · LIBERADO', ctx: { ...CTX, papel: 'supervisor', hora: '11:17' }, tem: ['R09'] },
  // negativo R09: recado anotado
  { q: 'Corte loja', r: 'Anotado, Ana! Já registrei sua sugestão com o time que me treina. 🙏', ctx: { ...CTX, papel: 'vendedor', hora: '08:41' }, tem: [], naoTem: ['R09', 'R13'] },
  // R06 devolução respondida com pendentes
  { q: 'Quais são do cliente que devolveram o pedido em novembro', r: 'Olha os números aí, Ivayr:\n\n💼 *Clientes com Pedidos Pendentes de Faturamento (Liberados) — Equipe Ivayr Miranda (TCA)*\nTotal: *11 pedido(s)* · *R$ 7.961*', ctx: { ...CTX, papel: 'supervisor', hora: '09:26' }, tem: ['R06'] },
  // negativo devolução
  { q: 'Minhas devolução', r: 'Aqui está, Willian:\n\n↩️ *Devoluções no mês — 225 - Willian Santos (varejo)*: *R$ 1.250* em 1 nota(s)\n• 05/11 · nota 73 · Supermercado Frutolandia Eireli (#10292)', ctx: { ...CTX, papel: 'vendedor', hora: '14:21' }, tem: [], naoTem: ['R06', 'R18'] },
  // R06 indústria analítica respondida com card de metas
  { q: '[áudio] Quem comprou o Arcor em outubro e não comprou em novembro?', r: 'Na mão, Vitorio:\n\n🏆 *Metas das indústrias — API* · novembro · _apuração até 20/11_\n🔴 *Arcor*: faturado R$ 416.072 de R$ 1.772.677 (23,5%)', ctx: { ...CTX, papel: 'diretoria', hora: '13:19' }, tem: ['R06'] },
  // R06 menu pedido, veio IA; R23
  { q: 'Menu do jota', r: 'Bom dia, Alyfer!  *RESUMO OFICIAL GEROT*: R$ 432.535 (24.7%).\n💡 *O que fazer agora*: 1. Ajustar rota para *Cintia Cruz (AS)*', ctx: { ...CTX, papel: 'supervisor', hora: '10:37' }, tem: ['R06'] },
  { q: 'Consegue me passar oque teve de corte para loja 34', r: 'Bom dia, Ana! Infelizmente, não tenho acesso a informações específicas sobre cortes para lojas individuais, como a loja 34, no DOSSIÊ 360° que temos disponível.', ctx: { ...CTX, papel: 'vendedor', hora: '08:38' }, tem: ['R13', 'R23', 'R02'], naoTem: ['R06'] },
  // R14: sem cadastro, sem resposta
  { q: 'Bom dia jota', r: '', ctx: { ...CTX, cadastrado: false, hora: '08:14' }, tem: ['R14'] },
  // R15 Vago
  { q: 'matinal', r: 'Olha os números aí, Gabriel:\n\n📍 *Check-in e check-out de hoje — Equipe Vago Gabriel (TCV)* (16/11)', ctx: { ...CTX, papel: 'supervisor', hora: '13:24' }, tem: ['R15'] },
  // R22 faturado negativo
  { q: 'Meu faturado ate o momento', r: 'Bom dia, Ana! Bora pra cima hoje. Seguem os números:\n\n🧑‍💼 *483 - Ana Carolina Martins Dourado* — TCG · sup. 39 - Pedro Salazar · AS\n💰 Faturado: *R$ -32.139* + pendente R$ 480.199 de R$ 1.120.000', ctx: { ...CTX, papel: 'vendedor', hora: '08:33' }, tem: ['R22'], naoTem: ['R05'] },
  // negativo geral: liga
  { q: 'Como está o meu time na liga?', r: 'Olha os números aí, Alex:\n\n🏆 *Champions Triunfante — Equipe Alex Elias (TBE)*\nFilial: *5º de 11*, 22 pts (0V 22E 1D)', ctx: { ...CTX, papel: 'supervisor', hora: '10:39' }, tem: [], naoTem: ['R06', 'R20', 'R05'] },
  // R16: texto longo
  { q: 'pendentes', r: 'Na mão:\n' + Array.from({ length: 40 }, (_, i) => `• Pedido 5290005${String(i).padStart(2, '0')} · LIBERADO`).join('\n'), ctx: { ...CTX, papel: 'supervisor', hora: '11:00' }, tem: ['R16'] },
  // R12 sem ação: dia da equipe sem sugestão
  { q: 'Atualiza os números de hoje do meu time', r: 'Aqui está, Alex:\n\n📋 *Dia da Equipe Alex Elias (TBE)* (16/11)\n💰 Digitado hoje: *R$ 34.088* em *8 pedido(s)*\n• ✅ *309 - Anderson Moraes (AS)*: R$ 25.364 · 3 ped.\n• ◻️ *1096 - Willian Pedrosc (AS)*: R$ 0 · sem pedido hoje\n\n_🟢 Hoje (Clube da Venda · 16:54): pedidos colocados._', ctx: { ...CTX, papel: 'supervisor', hora: '17:00' }, tem: ['R12'], naoTem: ['R20', 'R05', 'R03'] }
];

export function rodaTestesUnitarios(log = console.log) {
  let falhas = 0;
  CASOS_UNITARIOS.forEach((c, i) => {
    const ids = new Set(avaliar(c.q, c.r, c.ctx).map((x) => x.id));
    const faltou = (c.tem || []).filter((x) => !ids.has(x)), sobrou = (c.naoTem || []).filter((x) => ids.has(x));
    if (faltou.length || sobrou.length) { falhas++; log(`  FALHOU #${i + 1} "${c.q.slice(0, 50)}": esperava ${JSON.stringify(c.tem)} sem ${JSON.stringify(c.naoTem || [])}; veio ${JSON.stringify([...ids])}`); }
  });
  log(`Régua do JOTA: ${CASOS_UNITARIOS.length - falhas}/${CASOS_UNITARIOS.length} testes unitários ok`);
  return falhas;
}

if ((process.argv[1] || '').split('\\').join('/').endsWith('testes/jota_regua.mjs')) {
  process.exit(rodaTestesUnitarios() ? 1 : 0);
}
