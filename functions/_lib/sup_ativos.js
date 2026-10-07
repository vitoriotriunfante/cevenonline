// Supervisores ATIVOS = os que têm vendedor na árvore viva do CEVEN (tabela arvore_supervisores, mesma base do
// relatório "Vendas Coordenadores"). A matriz de compromissos do CEVEN ainda lista contas antigas/duplicadas
// (ex.: Cleber da Silva Bezeera e Everton Aparecido da Silva em TBL, 07/10/2026) que não existem na árvore.
// Devolve Set de "SIG|NOME NORMALIZADO"; null = não deu para ler (aí não filtra, para não esconder ninguém).
import { normNome } from './nao_supervisores.js';
export async function supervisoresAtivos(env) {
  try {
    const { results } = await env.DB.prepare('SELECT DISTINCT filial, sup_nome FROM arvore_supervisores WHERE sup_nome IS NOT NULL').all();
    if (!results || !results.length) return null;
    return new Set(results.map((r) => String(r.filial).toUpperCase().replace(/1$/, '') + '|' + normNome(r.sup_nome)));
  } catch (e) { return null; }
}
export const ehAtivo = (set, sig, nome) => !set || set.has(String(sig).toUpperCase() + '|' + normNome(nome));
