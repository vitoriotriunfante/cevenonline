// Gol qualificado (Vitório, 05/10/2026): o gol que nasce de um cliente (resgate, mix, quinzenas) ganha nível pela quantidade de
// INDÚSTRIAS diferentes no pedido do dia. Carteira "MONDELEZ" (só vende Mondelez: TBE e parte de TCG/TSJ) conta CATEGORIAS da Mondelez.
// Sem valor mínimo: 1 produto da indústria já conta (só linha com valor > 0; bonificação R$ 0 não conta). Vale a partir de 05/10/2026.
export const ESCADA = [
  { min: 5, nivel: 'PLATINA', extra: 4 },
  { min: 4, nivel: 'DIAMANTE', extra: 3 },
  { min: 3, nivel: 'OURO', extra: 2 },
  { min: 2, nivel: 'PRATA', extra: 1 },
  { min: 1, nivel: 'BRONZE', extra: 0 }
];
export const GOLS_QUALIFICAVEIS = ['gol_inativo', 'gol_mix', 'gol_quinzenas'];

const brl = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// c.industrias / c.categorias = [{n, v}] vindos de /api/tv-vendedor. Devolve null quando não há dado (nunca inventa nível).
export function qualificaGol(carteira, c) {
  const soMondelez = String(carteira || '').toUpperCase() === 'MONDELEZ';
  const lista = soMondelez ? c && c.categorias : c && c.industrias;
  if (!Array.isArray(lista) || !lista.length) return null;
  const degrau = ESCADA.find((e) => lista.length >= e.min);
  const unidade = soMondelez ? 'categoria' : 'indústria';
  const detalhe = lista.map((x) => `${x.n} ${brl(x.v)}`).join('; ');
  return {
    nivel: degrau.nivel, extra: degrau.extra, n: lista.length,
    texto: `QUALIFICAÇÃO: ${degrau.nivel} (+${degrau.extra} pts) — ${lista.length} ${unidade}${lista.length > 1 ? 's' : ''}${soMondelez ? ' Mondelez' : ''} no pedido: ${detalhe} [QUALIF:${degrau.nivel}:+${degrau.extra}]`
  };
}

// Lê o carimbo gravado na obs do lance (endpoint brasileirao-lances soma o extra aos pontos do gol).
export function lerQualif(obs) {
  const m = /\[QUALIF:([A-Z]+):\+(\d+)\]/.exec(String(obs || ''));
  return m ? { nivel: m[1], extra: Number(m[2]) } : null;
}

// Carteira AUTO (TSJ): vendedor com MAIS de 90% do valor dos pedidos de hoje em Mondelez conta como carteira so Mondelez (Vitorio, 05/10/2026).
export function carteiraEfetiva(carteira, clientes) {
  const c0 = String(carteira || '').toUpperCase();
  if (c0 !== 'AUTO') return c0;
  let mond = 0, total = 0;
  for (const c of Array.isArray(clientes) ? clientes : []) for (const x of (c && c.industrias) || []) { total += Number(x.v) || 0; if (x.n === 'MONDELEZ BRASIL') mond += Number(x.v) || 0; }
  return total > 0 && mond / total > 0.9 ? 'MONDELEZ' : '';
}
