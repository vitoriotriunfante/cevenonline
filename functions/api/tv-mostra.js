// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: entrega à TV, à Matriz, ao WhatsApp e às demais telas a lista de vendedores da GESTÃO DE EQUIPE (/gestao-equipe).
// FONTE: D1 `config_equipe_soberana`, salvo pela tela Gestão de Equipe (equipe-salvar / aprovação em equipe-solicitacoes).
//        A planilha do Drive NÃO é mais lida (decisão do Vitório, 05/10/2026: "esqueça a planilha").
// RESERVA: só se o D1 estiver indisponível, usa public/mostra_vendedores.json (cópia da Gestão de Equipe tirada em cada publicação por gerar_mostra_tv.js)
//          e a TV avisa na tela que está usando cópia, não a fonte viva.
// CACHE: 1 minuto.
// =========================================================================
import { aplicaNaoSupervisores } from '../_lib/nao_supervisores.js'; // nomes que NAO sao supervisores (decisao 04/10/2026)

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
let cache = { exp: 0, corpo: null };

export async function onRequestGet({ env, request }) {
  const resp = (o, s = 200) => new Response(JSON.stringify(s === 200 ? aplicaNaoSupervisores(o) : o), { status: s, headers: CORS });
  const url = new URL(request.url);
  const bypassCache = url.searchParams.has('nocache') || url.searchParams.has('t');
  if (!bypassCache && cache.corpo && Date.now() < cache.exp) return resp(cache.corpo);

  // FONTE DA EQUIPE (decisao do Vitorio, 03/10/2026, reforcada em 05/10/2026): a tela Gestao de Equipe e a fonte unica.
  // So se o D1 estiver indisponivel cai para a copia estatica da propria Gestao de Equipe.
  if (env.DB) {
    try {
      const row = await env.DB.prepare('SELECT conteudo_json, atualizado_por, atualizado_em FROM config_equipe_soberana WHERE id = 1').first();
      if (row && row.conteudo_json) {
        const corpo = { ...JSON.parse(row.conteudo_json), origem: 'd1', atualizado_por: row.atualizado_por, atualizado_em: row.atualizado_em, gerado_em: new Date().toISOString() };
        cache = { exp: Date.now() + 60 * 1000, corpo };
        return resp(corpo);
      }
    } catch (e) {
      // tabela ainda nao existe ou D1 indisponivel: segue para a copia
    }
  }

  // Fallback: cópia estática publicada no último deploy (gerada por gerar_mostra_tv.js).
  try {
    const assetUrl = new URL('/mostra_vendedores.json', request.url);
    const r = env.ASSETS ? await env.ASSETS.fetch(new Request(assetUrl)) : await fetch(assetUrl, { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      data.origem = 'copia';
      cache = { exp: Date.now() + 60 * 1000, corpo: data };
      return resp(data);
    }
  } catch (err) {}

  return resp({ erro: 'lista MOSTRA indisponivel (D1 e copia falharam)' }, 502);
}
