// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: entrega à TV, à Matriz, ao WhatsApp e às demais telas a lista de vendedores da GESTÃO DE EQUIPE (/gestao-equipe).
// FONTE: D1 `config_equipe_soberana`, salvo pela tela Gestão de Equipe (equipe-salvar / aprovação em equipe-solicitacoes).
//        A planilha do Drive NÃO é mais lida (decisão do Vitório, 05/10/2026: "esqueça a planilha").
// RESERVA: só se o D1 estiver indisponível, usa public/mostra_vendedores.json (cópia da Gestão de Equipe tirada em cada publicação por gerar_mostra_tv.js)
//          e a TV avisa na tela que está usando cópia, não a fonte viva.
// CACHE: 1 minuto.
// =========================================================================
import { aplicaNaoSupervisores } from '../_lib/nao_supervisores.js';
import { aplicaArvore } from '../_lib/arvore_ceven.js'; // supervisor = arvore viva do CEVEN (muda todo dia) // nomes que NAO sao supervisores (decisao 04/10/2026)

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
let cache = { exp: 0, corpo: null };

// UNIVERSO = ARVORE VIVA DO CEVEN (Vitorio, 13/10/2026: "a Gestao com APENAS os vendedores que tem na arvore agora"). A Gestao guarda decisoes (mostra/canal/vinculo), mas
// quem nao esta na arvore do CEVEN e fantasma do cadastro antigo: TV, Matriz, WhatsApp, Liga e incentivo nao o veem. A tela de Gestao pede ?completo=1 para ve-los
// marcados (na_arvore:false) e decidir. Sem arvore carregada (menos de 300 RCAs) nao filtra nada.
async function aplicaUniverso(env, corpo, completo) {
  try {
    if (!env.DB || !corpo || !corpo.filiais) return corpo;
    const { results } = await env.DB.prepare('SELECT filial, rca, nome, sup_id, sup_nome, canal FROM arvore_supervisores').all();
    if (!results || results.length < 300) return corpo;
    // VENDEDOR ATIVO NO CEVEN (Vitorio, 26/10/2026: "se o vendedor nao esta no CEVEN ele nao existe... o que soma para TUDO e CEVEN ativo"): a arvore traz codigos de rota
    // vaga (TCG 466) que o cadastro de representante do CEVEN nao tem. Codigo com canal_ceven.existe = 0 (conferido todo dia) sai do universo: nenhuma tela, total, WhatsApp ou Liga o ve.
    let inexistentes = new Set();
    try { const { results: ne } = await env.DB.prepare('SELECT filial, rca FROM canal_ceven WHERE existe = 0').all(); inexistentes = new Set((ne || []).map((x) => String(x.filial).toUpperCase() + '|' + String(x.rca))); } catch { /* coluna ainda nao existe */ }
    const supCod = new Map(results.map((a) => [String(a.filial).toUpperCase() + '|' + String(a.rca), a.sup_id]));   /* codigo do supervisor (Vitorio, 26/10/2026: 'sempre o codigo na frente') */
    const ok = new Set(results.map((a) => String(a.filial).toUpperCase() + '|' + String(a.rca)).filter((k) => !inexistentes.has(k)));
    const novo = { ...corpo, filiais: {} };
    let fora = 0, sim = 0, nao = 0, novos = 0;
    // O NUMERO DO CEVEN E UM SO: toda pessoa da arvore entra no universo. Quem a Gestao ainda nao conhece entra como "novo na arvore" (conta nos totais; mostra=false ate
    // o Vitorio decidir em Gestao -> Divergencias): "mostra / nao mostra" so decide em qual LISTA a pessoa aparece, nunca se ela existe.
    const naGestao = new Set();
    for (const [k, lista] of Object.entries(corpo.filiais)) for (const v of Array.isArray(lista) ? lista : []) naGestao.add(k.split('_')[0].toUpperCase() + '|' + String(v.rca));
    for (const [k, lista] of Object.entries(corpo.filiais)) {
      const sig = k.split('_')[0].toUpperCase();
      novo.filiais[k] = [];
      for (const v of Array.isArray(lista) ? lista : []) {
        const na = ok.has(sig + '|' + String(v.rca));
        if (!na) fora++;
        if (!na && !completo) continue;
        novo.filiais[k].push({ ...v, na_arvore: na, sup_cod: supCod.get(sig + '|' + String(v.rca)) || '' });
        if (v.mostra === false) nao++; else sim++;
      }
    }
    for (const a of results) {
      const sig = String(a.filial).toUpperCase();
      if (naGestao.has(sig + '|' + String(a.rca))) continue;
      if (inexistentes.has(sig + '|' + String(a.rca))) continue;   // nao existe no CEVEN hoje
      (novo.filiais[sig] = novo.filiais[sig] || []).push({
        rca: /^\d+$/.test(String(a.rca)) ? Number(a.rca) : a.rca, nome: a.nome || ('RCA ' + a.rca), supervisor: a.sup_nome || '', gerente: '', grupo: '',
        canal: String(a.canal || '').toUpperCase(), mostra: false, motivo: 'Novo na arvore do CEVEN: decidir em Gestao de Equipe > Divergencias', auto_arvore: true, na_arvore: true, novo_na_arvore: true
      });
      nao++; novos++;
    }
    novo.total_sim = sim; novo.total_nao = nao; novo.fora_da_arvore = fora; novo.novos_na_arvore = novos; novo.universo = completo ? 'gestao_completa' : 'arvore_viva';
    return novo;
  } catch { return corpo; }
}

export async function onRequestGet({ env, request }) {
  const completoQ = new URL(request.url).searchParams.get('completo') === '1';
  const resp = (o, s = 200) => new Response(JSON.stringify(s === 200 ? aplicaNaoSupervisores(o) : o), { status: s, headers: CORS });
  const url = new URL(request.url);
  const bypassCache = url.searchParams.has('nocache') || url.searchParams.has('t');
  if (!bypassCache && cache.corpo && Date.now() < cache.exp) return resp(await aplicaUniverso(env, cache.corpo, completoQ));

  // FONTE DA EQUIPE (decisao do Vitorio, 03/10/2026, reforcada em 05/10/2026): a tela Gestao de Equipe e a fonte unica.
  // So se o D1 estiver indisponivel cai para a copia estatica da propria Gestao de Equipe.
  if (env.DB) {
    try {
      const row = await env.DB.prepare('SELECT conteudo_json, atualizado_por, atualizado_em FROM config_equipe_soberana WHERE id = 1').first();
      if (row && row.conteudo_json) {
        const corpo = { ...JSON.parse(row.conteudo_json), origem: 'd1', atualizado_por: row.atualizado_por, atualizado_em: row.atualizado_em, gerado_em: new Date().toISOString() };
        await aplicaArvore(env, corpo); // 06/10/2026: o supervisor guardado na Gestao estava velho (equipes de TPA trocadas); vale o do CEVEN de hoje
        cache = { exp: Date.now() + 60 * 1000, corpo };
        return resp(await aplicaUniverso(env, corpo, completoQ));
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
