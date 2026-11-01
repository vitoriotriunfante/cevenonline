// =========================================================================
// JOTA · functions/_lib/jota/motor_ficha.js — MOTOR POR FICHA (Vitório, 01/11/2026: "um commit por pergunta de supervisor?")
// O QUE É: toda pergunta de indicador vira uma FICHA (indicadores, abertura, ordem, quantidade) e UMA função monta a resposta a partir do escopo
//   já carregado (E.vend, restrito ao que a pessoa pode ver). Pergunta nova com os mesmos campos não precisa de regra nova. O número nunca vem da IA.
// ESTADO: NÃO LIGADO. Só roda na comparação de testes/motor_ficha_comparar.mjs. Entra no JOTA por indicador, depois de provar que acerta mais.
// =========================================================================
import { N, R$, sem, titulo } from './base.js';
import { agrupa, supChave, supNome, supReal, pessoaReal } from './escopo.js';

const IND = {
  faturado: { re: /\bFATUR|\bVENDA|\bVENDEU|\bVENDI|\bVENDEMOS/, nome: 'Faturado', v: (x) => x.fat, fmt: R$ },
  pendente: { re: /PENDENT|CARTEIRA|A FATURAR/, nome: 'Pendente', v: (x) => x.pend, fmt: R$ },
  devolucao: { re: /DEVOLU/, nome: 'Devolução', v: (x) => x.dev, fmt: R$ },
  positivacao: { re: /POSITIVA/, nome: 'Positivação', v: (x) => x.pos, fmt: N, meta: (x) => x.metaPos },
  digitado: { re: /DIGITAD/, nome: 'Digitado hoje', v: (x) => x.dig, fmt: R$ },
  meta: { re: /\bMETAS?\b|ATINGIMENTO/, nome: 'Faturado x meta', v: (x) => x.fat, fmt: R$, meta: (x) => x.meta },
};
// assuntos que o motor ainda NAO responde: ficam com o caminho atual, nunca com uma resposta parecida
const FORA = /CLIENTE|PRODUTO|SKU|INDUSTRIA|FORNECEDOR|ROTA|VISITA|CHAMPION|\bLIGA\b|LANCE|PENALTI|MIX|OFERECER|\bRET\b|CORTE|PEDIDO|PROSPECT|CNPJ|SUGEST|MES PASSADO|ANTERIOR|ONTEM|SEMANA|FECHA|JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO/;

const f0 = (q, c) => (q ? null : c);
const CONHECIDAS = new Set('JOTA COMO ESTA TA QUE O A OS AS E DE DO DA DOS DAS EM NO NA NOS NAS POR PARA PRA QUAL QUAIS QUANTO QUANTA ME MANDA PASSA MOSTRA VER AGORA MES HOJE HJ MEU MINHA MEUS MINHAS NOSSO NOSSA TEMOS ESTAMOS ESTOU EU VENDEDOR VENDEDORA VENDEDORES CADA SUPERVISOR SUPERVISORES EQUIPE TIME FILIAL FILIAIS BRASIL GERAL TOTAL ABERTO ABERTA APENAS SO PIOR PIORES MENOR MENORES MELHOR MELHORES MAIOR MAIORES TOP RANKING LIDER MAIS ATRAS ABAIXO TOTAL BATEMOS'.split(' '));
export function fichaDaPergunta(texto) {
  const t = sem(texto);
  if (FORA.test(t)) return null;
  const indicadores = Object.keys(IND).filter((k) => IND[k].re.test(t));
  if (!indicadores.length) return null;
  // SO ASSUME O QUE ENTENDEU POR INTEIRO: sobrou palavra que nao e campo da ficha (nome de pessoa, marca, motivo) = fica com o caminho atual. Comparacao de 01/11/2026: "meta da colgate" viraria a meta geral.
  const codigo = (t.match(/\b(\d{1,4})\b/) || [])[1] || null;
  const resto = t.replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !/^\d+$/.test(w) && !CONHECIDAS.has(w) && !Object.values(IND).some((d) => d.re.test(w)));
  if (resto.length) return null;
  if (/\bHOJE\b|\bHJ\b/.test(t) && !indicadores.includes('digitado')) return null;
  const abertura = /POR VENDEDOR|VENDEDORES|CADA VENDEDOR/.test(t) ? 'vendedor' : /POR SUPERVISOR|SUPERVISORES|CADA SUPERVISOR|QUAL SUPERVISOR|QUAL EQUIPE/.test(t) ? 'supervisor' : /POR FILIAL|FILIAIS|CADA FILIAL|QUAL FILIAL/.test(t) ? 'filial' : null;
  const ordem = /PIOR|MENOR|MAIS ATRAS|ABAIXO/.test(t) ? 'pior' : /MELHOR|MAIOR|TOP|RANKING|LIDER/.test(t) ? 'melhor' : null;
  const q = t.match(/\bTOP (\d{1,2})\b|\b(\d{1,2}) (?:MELHORES|PIORES|MAIORES|MENORES)\b/);
  return { indicadores, abertura, ordem, codigo: f0(q, codigo), quantidade: q ? Number(q[1] || q[2]) : null };
}

const soma = (L, f) => L.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const pctDe = (v, m) => (m > 0 ? (v / m * 100).toFixed(1).replace('.', ',') + '%' : null);
function linha(k, L) {
  const d = IND[k], v = soma(L, d.v), m = d.meta ? soma(L, d.meta) : 0;
  return { valor: v, meta: m, txt: `${d.fmt(v)}${m > 0 ? ` de ${d.fmt(m)} (${pctDe(v, m)})` : ''}` };
}
// a devolucao e o unico indicador em que "pior" e o MAIOR valor
const chaveOrdem = (k, x) => (x.meta > 0 ? x.valor / x.meta : x.valor) * (k === 'devolucao' ? -1 : 1);

export function respondeFicha(E0, f) {
  let E = E0;
  if (!f || !E || !E.vend || !E.vend.length) return null;
  const [k0] = f.indicadores;
  if (f.codigo) { const L = E.vend.filter((v) => String(v.rca) === String(f.codigo)); if (L.length !== 1) return null; E = { ...E, nome: `${L[0].rca} - ${titulo(L[0].nome)} (${L[0].filial})`, vend: L }; }
  const cab = `📊 *${f.indicadores.map((k) => IND[k].nome).join(' · ')} — ${E.nome}*`;
  const total = f.indicadores.map((k) => `*${IND[k].nome}:* ${linha(k, E.vend).txt}`);
  if (!f.abertura) return [cab, ...total].join('\n');
  // quem so ve a propria equipe nao abre por filial nem por supervisor: nao existe essa abertura no escopo dele
  if ((f.abertura === 'filial' && E.filiais.length < 2) || (f.abertura === 'supervisor' && (E.supervisor || E.rca))) return null;
  const grupos = f.abertura === 'filial' ? [...agrupaLista(E.vend, (v) => v.filial)].map(([g, L]) => [g, L])
    : f.abertura === 'supervisor' ? [...agrupaLista(E.vend, (v) => supChave(v, E.nacional))].filter(([g]) => supReal(g)).map(([g, L]) => [supNome(g), L])
    : E.vend.filter(pessoaReal).map((v) => [`${v.rca} - ${titulo(v.nome)}`, [v]]);
  const lin = grupos.map(([g, L]) => ({ g, ...linha(k0, L) })).sort((a, b) => chaveOrdem(k0, f.ordem === 'pior' ? a : b) - chaveOrdem(k0, f.ordem === 'pior' ? b : a));
  const n = f.quantidade || (f.ordem ? 5 : 15), vis = lin.slice(0, n);
  return [cab, ...total, '', `*Por ${f.abertura}${f.ordem ? ` — ${f.ordem === 'pior' ? 'piores' : 'melhores'}` : ''}:*`, ...vis.map((x, i) => `${i + 1}. ${x.g}: ${x.txt}`), lin.length > vis.length ? `_Mostrando ${vis.length} de ${lin.length}._` : ''].filter((x) => x !== '').join('\n');
}
function agrupaLista(V, chave) { const m = new Map(); for (const v of V) { const k = chave(v); if (!m.has(k)) m.set(k, []); m.get(k).push(v); } return m; }
export { agrupa };
