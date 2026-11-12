// =========================================================================
// FICHA DO ARQUIVO: functions/api/central-snapshot.js
// O QUE É: a BASE ÚNICA de dados dos RCAs para os consumidores que rodam FORA do Cloudflare (hoje: o motor do WhatsApp no GitHub Actions).
//   Devolve, por filial, o que a varredura central (cron-varredura-central, a cada 2 min) já gravou em varredura_central_rca:
//   produtividade, dashboard, devolucoes e roteiro de cada RCA, JÁ em JSON, com a idade de cada linha.
// POR QUÊ (Vitório, 07/10/2026, "um motor só alimentando várias fontes", pedido ~15x): o motor do WhatsApp perguntava ao CEVEN, RCA por RCA,
//   as MESMAS coisas que a varredura central já tinha (coleta de 3 a 13 min; o disparo das 18:30 estourou o tempo). Agora ele lê daqui e só
//   vai ao CEVEN no que a base não tem ou está velho. TV, Matriz, liga e WhatsApp passam a ver os MESMOS números.
// USO: GET /api/central-snapshot?filial=TBL[&dia=AAAA-MM-DD]  (dia padrão = hoje, horário de Brasília)
// REGRA: nunca inventa dado. Parte que não veio do CEVEN na varredura aparece como null (o consumidor busca no CEVEN).
// =========================================================================
import { gravaCascataFilial } from '../_lib/arvore_ceven.js';
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const hojeSP = () => R.hojeSP();
const parse = (s) => { if (s == null || s === '') return null; try { return JSON.parse(s); } catch (e) { return null; } };
const memSnap = new Map(); // filial|dia -> { exp, json }

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: cors });
  const u = new URL(request.url);
  const filial = String(u.searchParams.get('filial') || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(filial)) return new Response(JSON.stringify({ erro: 'filial (sigla de 3 letras) obrigatoria' }), { status: 400, headers: cors });
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : hojeSP();
  const chaveMem = `${filial}|${dia}`;
  const hit = memSnap.get(chaveMem);
  if (hit && Date.now() < hit.exp && !u.searchParams.has('fresco')) {
    return new Response(hit.json, { headers: cors });
  }
  try {
    const { results } = await env.DB.prepare('SELECT * FROM varredura_central_rca WHERE data_ref = ? AND filial_sigla = ?').bind(dia, filial).all();
    const agora = Date.now(), rcas = {};
    for (const r of results || []) {
      const t = Date.parse(String(r.updated_at || '').replace(' ', 'T') + 'Z');
      rcas[r.rca_codigo] = { idade_s: Number.isFinite(t) ? Math.max(0, Math.round((agora - t) / 1000)) : null, produtividade: parse(r.produtividade_json), dashboard: parse(r.dashboard_json), devolucoes: parse(r.devolucoes_json), roteiro: parse(r.roteiro_json), roteiro_mes: parse(r.roteiro_mes_json) };   // roteiro_mes: 26/10/2026
    }
    // CEVEN + GEROT, UM COBRE O OUTRO (Vitorio, 12/11/2026: "pedi os dados do CEVEN e do GEROT, nao do CEVEN ou do GEROT... se um nao funciona o outro roda";
    // o CEVEN devolveu 500 de 11/11 17:34 em diante e o JOTA mostrou "R$ 0 de R$ 93.000" para a Tamara). Nada inventado: cada parte que falta hoje vem de uma leitura real,
    // com a fonte e a hora em `reforco` (quem mostra diz de onde veio):
    //  - faturado e carteira pendente do mes = GEROT (soma das industrias do vendedor, posicao gravada);
    //  - meta, meta e realizado de positivacao = ultima leitura do CEVEN neste mes;
    //  - rota de hoje = clientes de HOJE no roteiro do mes (ultima leitura do CEVEN; status do momento da leitura).
    try {
      const faltam = Object.entries(rcas).filter(([, r]) => !r.dashboard || !Array.isArray(r.roteiro));
      if (faltam.length) {
        const mes = String(dia).slice(0, 7);
        const { results: ant } = await env.DB.prepare("SELECT v.rca_codigo, v.data_ref, v.dashboard_json, v.dash_em, v.roteiro_mes_json, v.updated_at FROM varredura_central_rca v WHERE v.filial_sigla = ? AND v.data_ref < ? AND v.data_ref >= ? AND v.data_ref = (SELECT max(x.data_ref) FROM varredura_central_rca x WHERE x.filial_sigla = v.filial_sigla AND x.rca_codigo = v.rca_codigo AND x.data_ref < ? AND x.data_ref >= ? AND x.dashboard_json IS NOT NULL)").bind(filial, dia, mes + '-01', dia, mes + '-01').all();
        const A = new Map((ant || []).map((x) => [String(x.rca_codigo), x]));
        const G = new Map();
        try {
          const { results: gv } = await env.DB.prepare("SELECT rca, sum(coalesce(json_extract(dados,'$.\"Faturado líquido (R$)\"'),0)) fat, sum(coalesce(json_extract(dados,'$.\"Carteira pendente (R$)\"'),0)) pend, sum(coalesce(json_extract(dados,'$.\"Devolução (R$)\"'),0)) dev, max(em) em FROM gerot_vendas WHERE mes = ? AND filial = ? GROUP BY rca").bind(mes, filial).all();
          for (const g of gv || []) G.set(String(g.rca), g);
        } catch { /* GEROT sem dado: fica so o CEVEN anterior */ }
        for (const [rca, r] of faltam) {
          const a = A.get(rca), g = G.get(rca), ref = r.reforco = {};
          if (!r.dashboard) {
            const da = a && parse(a.dashboard_json);
            if (da || g) {
              const fin = { ...((da && da.financeiro) || {}) };
              // 12/11/2026 conferido: GEROT = CEVEN em TBL 189 (R$ 67.080), mas so parte das industrias em TCV 352 (R$ 4.424 x R$ 14.851): GEROT so quando nao ha leitura do CEVEN no mes
              if (g && !da) { fin.faturado = Number(g.fat) || 0; fin.pendente = Number(g.pend) || 0; fin.devolucao = Number(g.dev) || 0; ref.financeiro = { fonte: 'GEROT', em: g.em }; }
              else ref.financeiro = { fonte: 'CEVEN', em: a.dash_em || a.updated_at };
              r.dashboard = { ...(da || {}), financeiro: fin };
              if (da) ref.meta_positivacao = { fonte: 'CEVEN', em: a.dash_em || a.updated_at };
            }
          }
          if (!Array.isArray(r.roteiro)) {
            const rm = Array.isArray(r.roteiro_mes) ? r.roteiro_mes : (a && parse(a.roteiro_mes_json));
            if (Array.isArray(rm)) { r.roteiro = rm.filter((c) => c && String(c.data_visita || '').slice(0, 10) === dia); if (!r.roteiro_mes) r.roteiro_mes = rm; ref.roteiro = { fonte: 'CEVEN roteiro do mes', em: a ? a.updated_at : null }; }
          }
          if (!Object.keys(ref).length) delete r.reforco;
        }
      }
    } catch { /* reforco nunca derruba o snapshot */ }
    // META DA HIERARQUIA (27/10/2026, Thiago/MCD sup. 62: "a meta no CEVEN e de 4.332.386,48"; o JOTA dizia 5.287.235): o painel do vendedor (dashboard do RCA)
    // ainda mostra meta de quem foi zerado/transferido na hierarquia (MCD 416 Claudimir: R$ 954.849 no painel x R$ 0 na tela do supervisor/gerente). meta_hier = a
    // meta da cascata do gerente gravada na base (cascata_dia, mesmo numero da tela do supervisor). Quem le decide usar; null = vendedor fora da cascata.
    try {
      let c = await env.DB.prepare('SELECT json, atualizado_em FROM cascata_dia WHERE filial = ? AND data_ref = ?').bind(filial, dia).first();
      // SE CASCATA ESTIVER VELHA (> 5 MIN) OU NAO EXISTIR PARA HOJE: busca na hora para esta filial!
      const idadeCascata = c && c.atualizado_em ? Math.round((agora - Date.parse(String(c.atualizado_em).replace(' ', 'T') + 'Z')) / 1000) : Infinity;
      let j = null;
      // SO PARA HOJE (auditoria 01/11/2026): consultar dia antigo gravava a cascata de AGORA por cima da daquele dia (em 01/11, a de 30/10 e 31/10 viraram dados de novembro)
      if (dia === hojeSP() && (!c || idadeCascata > 300)) {
        try { j = await gravaCascataFilial(env, filial, dia, 5000); } catch {}
      }
      if (!j && c) {
        try { j = JSON.parse(c.json); } catch {}
      }
      if (!j) {
        const ult = await env.DB.prepare('SELECT json FROM cascata_dia WHERE filial = ? ORDER BY data_ref DESC LIMIT 1').bind(filial).first();
        if (ult) try { j = JSON.parse(ult.json); } catch {}
      }
      if (j) {
        for (const s of j.supervisores || []) {
          for (const v of (s.tabelas && s.tabelas.faturamento) || []) if (v && v.id != null && rcas[String(v.id)]) rcas[String(v.id)].meta_hier = Number(v.meta) || 0;
          for (const v of (s.tabelas && s.tabelas.produtividade) || []) {
            if (v && v.id != null && rcas[String(v.id)]) {
              const r = rcas[String(v.id)];
              if (!r.produtividade) r.produtividade = { dia: {}, mes: {} };
              if (!r.produtividade.dia) r.produtividade.dia = {};
              const vr = Number(v.visit_real_hoje) || 0;
              if (vr > (r.produtividade.dia.visitas_na_rota || 0)) r.produtividade.dia.visitas_na_rota = vr;
              const vp = Number(v.visit_plan_hoje) || 0;
              if (vp > (r.produtividade.dia.total_programado || 0)) r.produtividade.dia.total_programado = vp;
              const ef = Number(v.eficacia_hoje_pct) || 0;
              if (ef > 0) {
                r.produtividade.dia.eficacia_pct = ef;   // positivacao do dia nao e mais estimada por visitas x eficacia (31/10/2026: proibido inventar dado)
              }
            }
          }
        }
      }
    } catch { /* sem cascata: fica so o painel */ }
    // META OFICIAL = tela "Filiais" do CEVEN (admin/filiais/hierarquia), gravada por filial e vendedor em meta_hierarquia (27/10/2026): manda sobre a cascata
    try {
      const { results: mh } = await env.DB.prepare('SELECT rca, meta, meta_pos FROM meta_hierarquia WHERE filial = ?').bind(filial).all();
      for (const x of mh || []) if (rcas[String(x.rca)]) { rcas[String(x.rca)].meta_hier = Number(x.meta) || 0; rcas[String(x.rca)].meta_pos_hier = Number(x.meta_pos) || 0; }
    } catch { /* tabela ainda nao existe: fica a cascata */ }
    // MACRO SOMA TUDO (Vitorio, 31/10/2026: "macro numero e macro numero, tem que somar"): devolucao de quem nao tem linha na base; quem tem linha ja entra pela lista dele
    let macro_fora = null;
    try {
      const { results: mf } = await env.DB.prepare('SELECT rca, dev_mes, notas_json FROM macro_fora_arvore WHERE filial = ? AND mes = ?').bind(filial, String(dia).slice(0, 7)).all();
      const X = (mf || []).filter((x) => !(rcas[String(x.rca)] && rcas[String(x.rca)].devolucoes != null));
      macro_fora = { dev_dia: X.reduce((a, x) => a + parse(x.notas_json || '[]').filter((n) => n.d === dia).reduce((s, n) => s + (Number(n.v) || 0), 0), 0), dev_mes: X.reduce((a, x) => a + (Number(x.dev_mes) || 0), 0) };
    } catch { /* tabela ainda sem dado */ }
    const outJson = JSON.stringify({ filial, dia, gerado_em: new Date().toISOString(), total: Object.keys(rcas).length, rcas, macro_fora });
    if (Object.keys(rcas).length > 0) memSnap.set(chaveMem, { exp: Date.now() + 20000, json: outJson });
    return new Response(outJson, { headers: cors });
  } catch (e) { return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: cors }); }
}
