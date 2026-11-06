import { resolverIndustria } from '../../../../pipeline/dicionario_industrias.js';

export async function responderPerguntaGerotIndustria(env, texto, c) {
  const t = texto.toLowerCase();

  // 1. Identificar se é pergunta sobre indústrias / marcas / MP / fornecedores
  const termosGatilho = [
    'industria', 'indústria', 'fornecedor', 'marca', 'mp', 'marcas proprias',
    'marcas próprias', 'baly', 'mondelez', 'mars', 'ferrero', 'marilan',
    'ype', 'ypê', 'heinz', 'hemmer', 'pepsico', 'toddy', 'red bull', 'sc johnson',
    'arcor', 'gomes da costa', 'gdc', 'colgate', 'nivea', 'bombril'
  ];

  const temGatilho = termosGatilho.some(g => t.includes(g)) || /\b(como estamos de|como foi|venda de|meta de|atingimento de)\b/i.test(texto);
  if (!temGatilho) return null;

  // 2. Extrair o nome da marca / indústria mencionada
  let termoResolvido = null;
  for (const g of termosGatilho) {
    if (t.includes(g)) {
      termoResolvido = resolverIndustria(g);
      break;
    }
  }

  if (!termoResolvido) return null;

  // 3. Consultar no D1 o histórico oficial de 4 meses
  try {
    const { results } = await env.DB.prepare(
      `SELECT mes, fornecedor, media_ponderada, faturado, faturado_carteira, captacao, positivacao, mix, cortes, devolucao ` +
      `FROM gerot_historico_industrias ` +
      `WHERE fornecedor_limpo LIKE ? ` +
      `ORDER BY mes ASC;`
    ).bind(`%${termoResolvido}%`).all();

    if (!results || results.length === 0) return null;

    // 4. Montar resposta executiva padrão Sênior / Indústria
    const nomeAmigavel = results[0].fornecedor.replace(/^\d+º/, '').replace(/—/, '').replace(/\d{14}$/, '').trim();
    
    let resposta = `📊 *Raio-X Oficial GEROT — ${nomeAmigavel}*\n\n`;
    resposta += `📈 *Evolução Histórica*: \n`;

    const mapaMeses = {
      '2026-08': 'Agosto',
      '2026-09': 'Setembro',
      '2026-10': 'Outubro',
      '2026-11': 'Novembro (em andamento)'
    };

    for (const r of results) {
      const rotulo = mapaMeses[r.mes] || r.mes;
      resposta += `• *${rotulo}*:\n`;
      resposta += `   └ Ponderado: *${r.media_ponderada || '—'}* | Fat: *${r.faturado || '—'}* | Positivação: *${r.positivacao || '—'}*\n`;
      if (r.cortes && r.cortes !== '—') resposta += `   └ Cortes: ${r.cortes} | Devolução: ${r.devolucao || '0%'}\n`;
    }

    resposta += `\n💡 _Dados oficiais consolidados do fechamento contábil Triunfante._`;
    return resposta;

  } catch (err) {
    console.error('Erro ao consultar GEROT no D1:', err);
    return null;
  }
}
