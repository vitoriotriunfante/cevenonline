// =========================================================================
// FICHA DO ARQUIVO: pipeline/fonte_base.js
// O QUE É: camada de BASE ÚNICA do motor do WhatsApp (Vitório, 07/10/2026: "um motor só alimentando várias fontes").
//   Antes de perguntar ao CEVEN, o motor consulta a base que a varredura central já gravou (/api/central-snapshot).
//   Só o que a base não tem (ou está mais velho que MAX_IDADE_S) continua indo ao CEVEN. Resultado: a mesma informação da TV, da Matriz e da liga.
// LIGA/DESLIGA: variável CEVEN_FONTE_BASE=0 desliga (volta a perguntar tudo ao CEVEN). CEVEN_FONTE_BASE_URL muda o endereço da base.
// PÚBLICO: carregarBase(siglas), lerBase(url), resumo(). Não altera nenhuma outra regra do motor.
// =========================================================================
const BASE_URL = process.env.CEVEN_FONTE_BASE_URL || 'https://ceven-cftv-matrix.pages.dev';
const LIGADA = process.env.CEVEN_FONTE_BASE !== '0';
const MAX_IDADE_S = Number(process.env.CEVEN_FONTE_MAX_IDADE_S || 900); // 15 min: a varredura central roda a cada 2 min; mais velho que isso = pergunta ao CEVEN
const PARTE = { produtividade: 'produtividade', dashboard: 'dashboard', devolucoes: 'devolucoes', 'roteiro-hoje': 'roteiro' };

const mapa = new Map(); // 'tbl1|123' -> { idade_s, produtividade, dashboard, devolucoes, roteiro }
const contagem = { base: 0, ceven: 0, velho: 0, filiais: 0, rcas: 0 };

async function carregarBase(chavesFilial, dia) { // chavesFilial = ['tbl1', 'tph1', ...] (as mesmas do FILIAIS_MAP)
  if (!LIGADA) return resumo();
  await Promise.all(chavesFilial.map(async (fKey) => {
    const sigla = String(fKey).replace(/1$/, '').toUpperCase();
    try {
      const r = await fetch(`${BASE_URL}/api/central-snapshot?filial=${sigla}${dia ? '&dia=' + dia : ''}`, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) return;
      const j = await r.json();
      if (!j || !j.rcas) return;
      contagem.filiais++;
      for (const [rca, v] of Object.entries(j.rcas)) { mapa.set(`${fKey}|${rca}`, v); contagem.rcas++; }
    } catch (e) { /* sem base para essa filial: o motor pergunta ao CEVEN, como antes */ }
  }));
  return resumo();
}

// url do CEVEN -> valor da base, ou undefined (pergunte ao CEVEN). So responde pelas 4 coisas que a varredura central guarda.
function lerBase(url) {
  if (!LIGADA) return undefined;
  const m = /\/api\/rca\/(produtividade|dashboard|devolucoes|roteiro-hoje)\?filial=([a-z]+1)&id=(\d+)$/i.exec(String(url));
  if (!m) return undefined;
  const linha = mapa.get(`${m[2].toLowerCase()}|${m[3]}`);
  const valor = linha ? linha[PARTE[m[1].toLowerCase()]] : null;
  if (!linha || valor == null) { contagem.ceven++; return undefined; }
  if (linha.idade_s == null || linha.idade_s > MAX_IDADE_S) { contagem.velho++; contagem.ceven++; return undefined; }
  contagem.base++;
  return valor;
}

function resumo() { return { ligada: LIGADA, ...contagem, max_idade_s: MAX_IDADE_S }; }
function limpar() { mapa.clear(); contagem.base = contagem.ceven = contagem.velho = contagem.filiais = contagem.rcas = 0; }

module.exports = { carregarBase, lerBase, resumo, limpar, MAX_IDADE_S };
