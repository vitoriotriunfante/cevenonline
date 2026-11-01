// =========================================================================
// JOTA · functions/_lib/jota/resumo_mix.js — RESUMO DO VENDEDOR: "vendeu isso no PDV X; no +MIX tinha aquilo" (Vitorio, 01/11/2026)
// O QUE É: funcao pura. Recebe os itens vendidos no dia, a rota e as listas do +MIX e monta o texto. Nao le base, nao envia nada, nao inventa: cliente sem lista fica sem sugestao.
// ESTADO: NAO LIGADO. Nenhum job chama esta funcao ainda; o envio so entra com ordem do Vitorio.
// =========================================================================
const tit = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const brl = (v) => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR');

// itens: [{ c: id_cliente, p: codprod, v: valor }]; rota: [{ id_cliente, cnpj, nome_cliente }]; prod: { codprod: [descricao] }; mix: { cnpj: { rec: [[cod, nome, industria, penetracao]] } }
export function montaResumoMix({ vendedor, itens, rota, prod, mix, maxClientes = 5, maxItens = 3 }) {
  const porCli = new Map();
  for (const l of itens || []) { const k = String(l.c); if (!porCli.has(k)) porCli.set(k, []); porCli.get(k).push(l); }
  const rotaPor = new Map((rota || []).map((c) => [String(c.id_cliente), c]));
  const blocos = [];
  for (const [id, L] of porCli) {
    const c = rotaPor.get(id), cnpj = String((c && c.cnpj) || '').replace(/\D/g, ''), rec = (mix[cnpj] || {}).rec || [], comprou = new Set(L.map((l) => String(l.p)));
    const naoLevou = rec.filter(([cod]) => !comprou.has(String(cod))), acertou = rec.filter(([cod]) => comprou.has(String(cod)));
    blocos.push({ id, nome: tit((c && c.nome_cliente) || `cliente ${id}`), total: L.reduce((a, l) => a + (Number(l.v) || 0), 0), vendidos: [...L].sort((a, b) => b.v - a.v).slice(0, maxItens).map((l) => tit((prod[l.p] || [l.p])[0])), qtd: comprou.size, naoLevou, acertou });
  }
  if (!blocos.length) return null;
  blocos.sort((a, b) => b.naoLevou.length - a.naoLevou.length || b.total - a.total);
  const linhas = [`🧺 *Resumo das suas vendas — ${vendedor}*`, `${blocos.length} cliente(s) · ${brl(blocos.reduce((a, b) => a + b.total, 0))}`];
  for (const b of blocos.slice(0, maxClientes)) {
    linhas.push('', `*${b.nome}* (#${b.id}) — ${brl(b.total)}, ${b.qtd} item(ns)`, `Vendeu: ${b.vendidos.join(', ')}${b.qtd > b.vendidos.length ? '...' : ''}`);
    if (b.acertou.length) linhas.push(`✅ Do +MIX: ${b.acertou.slice(0, maxItens).map(([, n]) => tit(n)).join(', ')}`);
    linhas.push(b.naoLevou.length ? `💡 No +MIX tinha: ${b.naoLevou.slice(0, maxItens).map(([, n]) => tit(n)).join(', ')}` : '_+MIX sem outra sugestão para este cliente._');
  }
  if (blocos.length > maxClientes) linhas.push('', `_Mostrando ${maxClientes} de ${blocos.length} clientes._`);
  return linhas.join('\n');
}
