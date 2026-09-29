// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: normalização ÚNICA da aba MOSTRA_DISPAROS (linha da planilha -> vendedor da TV).
// PROJETO: CFTV/TV. Usado por gerar_mostra_tv.js (Node, local) e functions/_lib/xlsx_mostra.js
//          (Cloudflare Worker). Mudou a regra de negócio? Mexe só aqui.
// REGRA: uma filial pode vir dividida na coluna Filial (ex.: TPH_VAGNER, TPH_FABIO,
//        MCD_CLEVERSON). Aqui vira filial canônica (TPH) + campo `grupo` (VAGNER).
//        Divisão nova = só escrever SIGLA_NOME na planilha, sem mexer em código.
// =========================================================================

const clean = (s) => String(s == null ? '' : s).replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '').trim();

// linha: objeto já com as chaves de coluna (Filial, Gerente Geral, Nome Supervisor,
// Cód. Vendedor (RCA), Nome do Vendedor, Canal Oficial, MOSTRA NOS DISPAROS, MOTIVO (se NÃO))
function normalizaLinha(r) {
  const bruto = String(r['Filial'] || '').toUpperCase().trim();
  const f = bruto.split('_')[0];
  const grupo = bruto.split('_').slice(1).join('_');
  const rca = String(r['Cód. Vendedor (RCA)'] == null ? '' : r['Cód. Vendedor (RCA)']).trim().replace(/\.0+$/, '');
  if (!f || !rca) return null;
  const mostra = String(r['MOSTRA NOS DISPAROS'] || '').toUpperCase().trim() === 'SIM';
  return {
    filial: f,
    grupo,
    vendedor: {
      rca,
      grupo,
      nome: clean(r['Nome do Vendedor']),
      supervisor: clean(r['Nome Supervisor']),
      gerente: String(r['Gerente Geral'] || '').trim(),
      canal: String(r['Canal Oficial'] || '').trim(),
      mostra,
      motivo: mostra ? '' : String(r['MOTIVO (se NÃO)'] || '')
    }
  };
}

// linhas: array de objetos {Filial, 'Cód. Vendedor (RCA)', ...} (uma por vendedor)
function montaMostraDeObjetos(linhas) {
  const filiais = {}, grupos = {};
  let sim = 0, nao = 0;
  for (const r of linhas) {
    const n = normalizaLinha(r);
    if (!n) continue;
    if (n.grupo) (grupos[n.filial] = grupos[n.filial] || new Set()).add(n.grupo);
    n.vendedor.mostra ? sim++ : nao++;
    (filiais[n.filial] = filiais[n.filial] || []).push(n.vendedor);
  }
  const g = {};
  Object.keys(grupos).forEach((k) => (g[k] = [...grupos[k]]));
  return { total_sim: sim, total_nao: nao, grupos: g, filiais };
}

module.exports = { normalizaLinha, montaMostraDeObjetos };
