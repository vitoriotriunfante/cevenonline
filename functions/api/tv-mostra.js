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

const semN = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const rcaN = (r) => (/^\d+$/.test(String(r ?? '').trim()) ? String(Number(r)) : String(r ?? '').trim());

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
    const ativoGerot = new Set(), supCodGerot = new Map(), supCodCliven = new Map(), supCodNome = new Map(), supNomePorCod = new Map(), gerotInfo = new Map();
    try {
      const mesBrt = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
      let mesRef = mesBrt;
      let gv = (await env.DB.prepare('SELECT filial, rca, cod_sup, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ?').bind(mesRef).all()).results || [];
      if (!gv.length) {
        const ultM = await env.DB.prepare('SELECT MAX(mes) AS m FROM gerot_vendedor_mes').first();
        if (ultM && ultM.m) { mesRef = ultM.m; gv = (await env.DB.prepare('SELECT filial, rca, cod_sup, supervisor, vendedor, dados FROM gerot_vendedor_mes WHERE mes = ?').bind(mesRef).all()).results || []; }
      }
      const [crRes, supRes] = await Promise.all([
        env.DB.prepare('SELECT filial, rca, cod_sup FROM gerot_cliven_resumo WHERE mes = ? AND cod_sup IS NOT NULL AND cod_sup != ""').bind(mesRef).all().catch(() => ({ results: [] })),
        env.DB.prepare('SELECT filial, cod_sup, supervisor FROM gerot_supervisor_mes WHERE mes = ?').bind(mesRef).all().catch(() => ({ results: [] }))
      ]);
      for (const c of (crRes && crRes.results) || []) {
        if (c.cod_sup) supCodCliven.set(String(c.filial).toUpperCase() + '|' + rcaN(c.rca), String(c.cod_sup));
      }
      for (const s of (supRes && supRes.results) || []) {
        if (s.supervisor && s.cod_sup) {
          const fSig = String(s.filial).toUpperCase();
          supCodNome.set(fSig + '|' + semN(s.supervisor), String(s.cod_sup));
          supNomePorCod.set(fSig + '|' + String(s.cod_sup), String(s.supervisor));
        }
      }
      for (const x of gv) {
        let d = {}; try { d = JSON.parse(x.dados || '{}'); } catch { }
        const tot = Math.abs(Number(d['Meta (R$)']) || 0) + Math.abs(Number(d['Faturado líquido (R$)']) || 0) + Math.abs(Number(d['Carteira pendente (R$)']) || 0) + Math.abs(Number(d['Positivação (filial + CNPJ)']) || 0);
        if (tot > 0) {
          const rN = rcaN(x.rca);
          const sig = String(x.filial).toUpperCase();
          const key = sig + '|' + rN;
          ativoGerot.add(key);
          const codSup = x.cod_sup ? String(x.cod_sup) : '';
          if (codSup) supCodGerot.set(key, codSup);
          const rNum = /^\d+$/.test(rN) ? Number(rN) : NaN;
          if (!String(x.rca || '').includes('|') && Number.isInteger(rNum) && rNum > 0 && rNum !== 2) {
            const supNom = String(x.supervisor || '').trim() || (codSup && supNomePorCod.get(sig + '|' + codSup)) || '';
            const vendNom = String(x.vendedor || '').trim();
            const prev = gerotInfo.get(key);
            if (!prev || tot > prev.peso) {
              gerotInfo.set(key, { nome: vendNom || (prev && prev.nome) || '', supervisor: supNom || (prev && prev.supervisor) || '', cod_sup: codSup || (prev && prev.cod_sup) || '', peso: tot });
            } else {
              if (!prev.nome && vendNom) prev.nome = vendNom;
              if (!prev.supervisor && supNom) prev.supervisor = supNom;
              if (!prev.cod_sup && codSup) prev.cod_sup = codSup;
            }
          }
        }
      }
    } catch { /* sem GEROT: segue so com arvore */ }
    const supCod = new Map(results.map((a) => [String(a.filial).toUpperCase() + '|' + String(a.rca), a.sup_id]));   /* codigo do supervisor (Vitorio, 26/10/2026: 'sempre o codigo na frente') */
    const ok = new Set(results.map((a) => String(a.filial).toUpperCase() + '|' + String(a.rca)).filter((k) => !inexistentes.has(k)));
    const novo = { ...corpo, filiais: {} };
    let fora = 0, sim = 0, nao = 0, novos = 0;
    // O NUMERO DO CEVEN E UM SO: toda pessoa da arvore entra no universo. Quem a Gestao ainda nao conhece entra como "novo na arvore" (conta nos totais; mostra=false ate
    // o Vitorio decidir em Gestao -> Divergencias): "mostra / nao mostra" so decide em qual LISTA a pessoa aparece, nunca se ela existe.
    const naGestao = new Set(), supGrupoGestao = new Map();
    for (const [k, lista] of Object.entries(corpo.filiais)) {
      const sig = k.split('_')[0].toUpperCase();
      for (const v of Array.isArray(lista) ? lista : []) {
        naGestao.add(sig + '|' + rcaN(v.rca));
        if (v.supervisor && v.grupo) supGrupoGestao.set(sig + '|' + semN(v.supervisor), String(v.grupo));
      }
    }
    for (const [k, lista] of Object.entries(corpo.filiais)) {
      const sig = k.split('_')[0].toUpperCase();
      novo.filiais[k] = [];
      for (const v of Array.isArray(lista) ? lista : []) {
        const _keyG = sig + '|' + rcaN(v.rca), _naArv = ok.has(_keyG), _noGerot = ativoGerot.has(_keyG), na = _naArv || _noGerot;
        if (!na) fora++;
        if (!na && !completo) continue;
        const supCodRes = supCodNome.get(sig + '|' + semN(v.supervisor)) || supCodCliven.get(_keyG) || supCodGerot.get(_keyG) || supCod.get(_keyG) || '';
        novo.filiais[k].push({ ...v, na_arvore: _naArv, ativo_gerot: _noGerot, sup_cod: supCodRes });
        if (v.mostra === false) nao++; else sim++;
      }
    }
    const adicionados = new Set();
    for (const a of results) {
      const sig = String(a.filial).toUpperCase(), rN = rcaN(a.rca), keyA = sig + '|' + rN;
      if (naGestao.has(keyA) || adicionados.has(keyA)) continue;
      if (inexistentes.has(sig + '|' + String(a.rca)) || inexistentes.has(keyA)) continue;   // nao existe no CEVEN hoje
      const gi = gerotInfo.get(keyA);
      const supRes = (gi && gi.supervisor) || a.sup_nome || '';
      const supCodRes = (gi && gi.cod_sup) || supCodNome.get(sig + '|' + semN(supRes)) || supCodCliven.get(keyA) || supCodGerot.get(keyA) || String(a.sup_id || '');
      const grpRes = supGrupoGestao.get(sig + '|' + semN(supRes)) || '';
      adicionados.add(keyA);
      (novo.filiais[sig] = novo.filiais[sig] || []).push({
        rca: /^\d+$/.test(String(a.rca)) ? Number(a.rca) : a.rca, nome: a.nome || (gi && gi.nome) || ('RCA ' + a.rca), supervisor: supRes, sup_cod: supCodRes, gerente: '', grupo: grpRes,
        canal: String(a.canal || '').toUpperCase(), mostra: false, motivo: 'Novo na arvore do CEVEN: decidir em Gestao de Equipe > Divergencias', auto_arvore: true, na_arvore: true, ativo_gerot: ativoGerot.has(keyA), novo_na_arvore: true
      });
      nao++; novos++;
    }
    for (const [keyG, gi] of gerotInfo.entries()) {
      if (naGestao.has(keyG) || adicionados.has(keyG) || inexistentes.has(keyG)) continue;
      const [sig, rN] = keyG.split('|');
      const supRes = gi.supervisor || '';
      const supCodRes = gi.cod_sup || supCodNome.get(sig + '|' + semN(supRes)) || supCodCliven.get(keyG) || '';
      const grpRes = supGrupoGestao.get(sig + '|' + semN(supRes)) || '';
      (novo.filiais[sig] = novo.filiais[sig] || []).push({
        rca: Number(rN), nome: gi.nome || ('RCA ' + rN), supervisor: supRes, sup_cod: supCodRes, gerente: '', grupo: grpRes,
        canal: '', mostra: false, motivo: 'Ativo no GEROT fora da Gestao de Equipe: decidir em Gestao de Equipe > Divergencias', auto_arvore: true, na_arvore: false, ativo_gerot: true, novo_na_arvore: true
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
  } catch (err) { }

  return resp({ erro: 'lista MOSTRA indisponivel (D1 e copia falharam)' }, 502);
}
