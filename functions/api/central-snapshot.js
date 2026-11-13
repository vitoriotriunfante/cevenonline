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
import { lerClubeFilial, diaDoClube } from '../_lib/clube.js';
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
      rcas[r.rca_codigo] = { idade_s: Number.isFinite(t) ? Math.max(0, Math.round((agora - t) / 1000)) : null, produtividade: parse(r.produtividade_json), dashboard: parse(r.dashboard_json), devolucoes: parse(r.devolucoes_json), roteiro: parse(r.roteiro_json), roteiro_mes: parse(r.roteiro_mes_json), prod_em: r.prod_em || null, roteiro_em: r.roteiro_em || null };   // roteiro_mes: 26/10/2026
    }
    // VENDEDOR SEM LINHA HOJE (auditoria 12/11/2026): a linha do dia so nasce se o CEVEN responder; com o CEVEN fora a madrugada inteira, hoje viria vazio e o JOTA
    // cairia nos numeros de ontem, sem Clube nem reserva. Quem tinha linha no ultimo dia lido entra vazio, para receber a reserva e o Clube abaixo (nunca inventado).
    if (dia === hojeSP()) {
      try {
        const { results: ul } = await env.DB.prepare('SELECT rca_codigo FROM varredura_central_rca WHERE filial_sigla = ? AND data_ref = (SELECT max(data_ref) FROM varredura_central_rca WHERE filial_sigla = ? AND data_ref < ?)').bind(filial, filial, dia).all();
        for (const x of ul || []) if (!rcas[x.rca_codigo]) rcas[x.rca_codigo] = { idade_s: null, produtividade: null, dashboard: null, devolucoes: null, roteiro: null, roteiro_mes: null, prod_em: null, sem_linha_hoje: true };
      } catch { /* segue */ }
    }
    // RESERVA DA ULTIMA LEITURA REAL (Vitorio 12/11/2026: CEVEN em 500 desde 11/11 17:34; revisado pelo arquiteto de dados no mesmo dia):
    // NUNCA por cima do dado de hoje. Vai em campos SEPARADOS, que so quem sabe mostrar a etiqueta usa:
    //  - dashboard_reserva = ultima leitura do CEVEN neste mes (com fonte/hora em reserva.dashboard). O motor do WhatsApp nao le esse campo: a trava dele continua valendo.
    //  - roteiro_planejado = clientes de HOJE no roteiro do mes, SEM status de visita de hoje (nao prova visita nem falta de visita).
    //  - GEROT NAO vira total do vendedor (incompleto em parte da rede: TCV 352 R$ 4.424 x R$ 14.851).
    try {
      const faltam = Object.entries(rcas);   // 13/11/2026: todos passam (GEROT de hoje vale para todos; reserva so onde falta)
      if (faltam.length) {
        const mes = String(dia).slice(0, 7);
        // 12/11/2026 (Vitorio: "se eu tenho todos os dados dos clientes populados, pq nao consigo calcular?"): roteiro do MES e produtividade do MES tambem vem
        // da ultima leitura do mes — sao a carteira, as TAGs e as visitas acumuladas ate ontem (a parte de HOJE da produtividade nunca e reaproveitada).
        const { results: ant } = await env.DB.prepare("SELECT v.rca_codigo, v.dashboard_json, v.dash_em, v.roteiro_mes_json, v.produtividade_json, v.prod_em, v.updated_at, v.data_ref FROM varredura_central_rca v WHERE v.filial_sigla = ? AND v.data_ref = (SELECT max(x.data_ref) FROM varredura_central_rca x WHERE x.filial_sigla = v.filial_sigla AND x.rca_codigo = v.rca_codigo AND x.data_ref < ? AND x.data_ref >= ? AND x.dashboard_json IS NOT NULL)").bind(filial, dia, mes + '-01').all();
        const A = new Map((ant || []).map((x) => [String(x.rca_codigo), x]));
        // A MAIS RECENTE DAS DUAS (13/11/2026, Vitorio: "o melhor e mais atualizado possivel... conecta no GEROT"): com o CEVEN fora desde 11/11 17:34, a ultima leitura dele
        // ficou 2 dias velha e o GEROT carrega a cada ~2 h. Faturado, a faturar (carteira) e devolucao do vendedor vem da fonte MAIS RECENTE; a meta e a positivacao
        // continuam as do CEVEN (o GEROT nao traz a meta de clientes por vendedor). Conferido em 11/11: faturado igual em 327 vendedores; fat. + carteira fecha o total.
        let G = new Map(), GV = new Map(), gEm = null;
        try {
          const st = await env.DB.prepare("SELECT max(em) em FROM gerot_coleta_status WHERE mes = ? AND posicao LIKE ?").bind(mes, '%' + dia.split('-').reverse().join('/') + '%').first();
          gEm = st && st.em;
          if (gEm) {
            const { results: gv } = await env.DB.prepare("SELECT rca, sum(coalesce(json_extract(dados,'$.\"Faturado líquido (R$)\"'),0)) fat, sum(coalesce(json_extract(dados,'$.\"Carteira pendente (R$)\"'),0)) cart, sum(coalesce(json_extract(dados,'$.\"Devolução (R$)\"'),0)) dev FROM gerot_vendas WHERE mes = ? AND filial = ? GROUP BY rca").bind(mes, filial).all();
            for (const g of gv || []) G.set(String(g.rca), g);
            try {
              const { results: gvm } = await env.DB.prepare("SELECT rca, max(coalesce(json_extract(dados,'$.\"Positivação (filial + CNPJ)\"'), json_extract(dados,'$.\"Positivação (filial)\"'))) pos, max(coalesce(json_extract(dados,'$.\"Meta de positivação\"'), json_extract(dados,'$.\"Meta clientes\"'))) meta_pos FROM gerot_vendedor_mes WHERE mes = ? AND filial = ? GROUP BY rca").bind(mes, filial).all();
              for (const v of gvm || []) GV.set(String(v.rca), v);
            } catch { /* tabela gerot_vendedor_mes ainda nao populada */ }
          }
        } catch { G = new Map(); GV = new Map(); }
        for (const [rca, r] of faltam) {
          const a = A.get(rca), ref = {};
          if (!r.dashboard && a) { const da = parse(a.dashboard_json); if (da) { r.dashboard_reserva = da; ref.dashboard = { fonte: 'CEVEN', em: a.dash_em || a.updated_at }; } }
          if (gEm && (G.has(rca) || GV.has(rca))) {   // 13/11/2026 (Vitorio: 'esquece o CEVEN... o GEROT e atualizado, mesmo que de 2 em 2 h'): GEROT de hoje vale para TODOS
            if (r.dashboard) { r.dashboard_reserva = r.dashboard; r.dashboard = null; }
            { const g = G.get(rca) || {}, gv = GV.get(rca) || {}, base = r.dashboard_reserva || {};
              const posGerot = gv.pos != null ? { realizado: Number(gv.pos) || 0, ...(gv.meta_pos != null ? { meta: Number(gv.meta_pos) || 0 } : {}) } : {};
              r.dashboard_reserva = { ...base, financeiro: { ...(base.financeiro || {}), ...(G.has(rca) ? { faturado: Number(g.fat) || 0, pendente: Number(g.cart) || 0, devolucao: Number(g.dev) || 0 } : {}) }, positivacao: { ...(base.positivacao || {}), ...posGerot } };
              ref.dashboard = { fonte: gv.pos != null ? 'GEROT (faturado, carteira, devolução e positivação)' : 'GEROT (faturado, carteira e devolução) + CEVEN (meta e positivação)', em: gEm }; }
          }
          if (!Array.isArray(r.roteiro_mes) && a) { const rm = parse(a.roteiro_mes_json); if (Array.isArray(rm)) { r.roteiro_mes = rm; ref.roteiro_mes = { fonte: 'CEVEN roteiro do mes', em: a.updated_at }; } }
          if (!r.produtividade && a) { const pa = parse(a.produtividade_json); if (pa && pa.mes) { r.produtividade_mes_reserva = pa.mes; ref.produtividade_mes = { fonte: 'CEVEN', em: a.prod_em || a.updated_at, ate: a.data_ref }; } }
          if (!Array.isArray(r.roteiro) && Array.isArray(r.roteiro_mes)) { r.roteiro_planejado = r.roteiro_mes.filter((c) => c && String(c.data_visita || '').slice(0, 10) === dia); ref.roteiro = { fonte: 'CEVEN roteiro do mes (planejado, sem status de hoje)' }; }
          if (Object.keys(ref).length) r.reserva = ref;
        }
      }
    } catch { /* reforco nunca derruba o snapshot */ }
    // CLUBE DA VENDA (12/11/2026, Vitorio: 'bora pegar do clube visitas e vendas'): a ORIGEM do digitado e da visita, lida a cada 15 min. Sem a produtividade do CEVEN
    // de hoje, o 'dia' vem do Clube (dado de HOJE, com fonte e hora em produtividade.dia._fonte/_lido_em); o mes continua da ultima leitura do CEVEN. r.clube vai sempre junto.
    let clube_lido_em = null;
    try {
      const C = await lerClubeFilial(env, filial, dia);
      if (C && C.fresco) {
        clube_lido_em = C.lido_em;
        // ROTA COM O CHECK-IN DO CLUBE (12/11/2026; conferencia 11/11: 98,8% dos check-ins iguais ao CEVEN, hora:minuto): quando o roteiro de hoje e da madrugada
        // (+45 min) ou so o planejado do mes, o status de cada cliente vem do check-in/out do Clube (rede inteira, a cada 15 min). So o JOTA e as telas leem; a Liga nao.
        let CK = null;
        try { const { results } = await env.DB.prepare('SELECT rca, cliente, tipo, data_hora FROM clube_checkin WHERE dia = ? AND filial = ?').bind(dia, filial).all(); CK = new Map(); for (const x of results || []) { const k = x.rca + '|' + x.cliente; const y = CK.get(k) || { ci: null, co: null }; const h = String(x.data_hora || '').slice(11, 16); if (x.tipo === 'CHECKIN' && (!y.ci || h < y.ci)) y.ci = h; if (x.tipo === 'CHECKOUT' && (!y.co || h > y.co)) y.co = h; CK.set(k, y); } } catch { CK = null; }
        if (CK) for (const [rca, r] of Object.entries(rcas)) {
          if (!C.rcas.get(rca)) continue;
          const rotVelho = Array.isArray(r.roteiro) && !(Date.now() - Date.parse(String(r.roteiro_em || '').replace(' ', 'T') + 'Z') < 45 * 60000);
          const base = Array.isArray(r.roteiro) && !rotVelho ? null : Array.isArray(r.roteiro) ? r.roteiro : Array.isArray(r.roteiro_planejado) ? r.roteiro_planejado : null;
          if (!base) continue;
          r.roteiro = base.filter((c) => c && String(c.data_visita || '').slice(0, 10) === dia).map((c) => { const y = CK.get(rca + '|' + String(c.id_cliente)); return y && y.ci ? { ...c, status: /POSITIVADO|EFETIVADO/i.test(String(c.status || '')) ? c.status : 'VISITADO', checkin_horario: y.ci, checkout_horario: y.co } : { ...c, status: 'ABERTO', checkin_horario: null, checkout_horario: null }; });
          r.rota_clube = true; (r.reserva = r.reserva || {}).rota_clube = { fonte: 'Clube da Venda (check-in/out)', em: C.lido_em };
          if (r.reserva.roteiro) delete r.reserva.roteiro;
        }
        for (const [rca, r] of Object.entries(rcas)) {
          const c = C.rcas.get(rca); if (!c) continue;
          r.clube = { total_pedido: c.total_pedido, ped_total: c.ped_total, ped_rota: c.ped_rota, ped_fora: c.ped_fora, roteiros: c.roteiros, visitas_rota: c.visitas_rota, eficiencia: c.eficiencia, eficacia: c.eficacia, lido_em: c.lido_em };
          // 12/11/2026 (TSJ e TBE: produtividade do CEVEN lida de madrugada, antes da queda, ficou valendo o dia todo — R$ 59 mil x R$ 207 mil no Clube): leitura do CEVEN
          // de hoje com mais de 45 min perde para o Clube fresco no DIA; o MES continua o do CEVEN
          const pEm = r.prod_em ? Date.parse(String(r.prod_em).replace(' ', 'T') + 'Z') : NaN, cevenVelho = !(Date.now() - pEm < 45 * 60000);
          if (!r.produtividade || cevenVelho) { r.produtividade = { dia: diaDoClube(c), mes: (r.produtividade && r.produtividade.mes) || r.produtividade_mes_reserva || {} }; (r.reserva = r.reserva || {}).dia_clube = { fonte: 'Clube da Venda', em: c.lido_em }; }
        }
      }
    } catch { /* sem Clube: fica o que a base tem */ }
    // META DA HIERARQUIA (27/10/2026, Thiago/MCD sup. 62: "a meta no CEVEN e de 4.332.386,48"; o JOTA dizia 5.287.235): o painel do vendedor (dashboard do RCA)
    // ainda mostra meta de quem foi zerado/transferido na hierarquia (MCD 416 Claudimir: R$ 954.849 no painel x R$ 0 na tela do supervisor/gerente). meta_hier = a
    // meta da cascata do gerente gravada na base (cascata_dia, mesmo numero da tela do supervisor). Quem le decide usar; null = vendedor fora da cascata.
    try {
      let c = await env.DB.prepare('SELECT json, atualizado_em FROM cascata_dia WHERE filial = ? AND data_ref = ?').bind(filial, dia).first();
      // SE CASCATA ESTIVER VELHA (> 5 MIN) OU NAO EXISTIR PARA HOJE: busca na hora para esta filial!
      const idadeCascata = c && c.atualizado_em ? Math.round((agora - Date.parse(String(c.atualizado_em).replace(' ', 'T') + 'Z')) / 1000) : Infinity;
      let j = null;
      // SO PARA HOJE (auditoria 01/11/2026): consultar dia antigo gravava a cascata de AGORA por cima da daquele dia (em 01/11, a de 30/10 e 31/10 viraram dados de novembro)
      // 12/11/2026 (arquiteto): leitor nao chama o CEVEN; a cascata de hoje e gravada pelo coletor no inicio de cada rodada (gravaCascatas). idadeCascata fica so como informacao.
      void idadeCascata; void gravaCascataFilial;
      if (!j && c) {
        try { j = JSON.parse(c.json); } catch {}
      }
      let cascataDeHoje = !!j;
      if (!j) {   // cascata de outro dia: so a META serve; visitas de ontem nunca entram como de hoje (12/11/2026)
        const ult = await env.DB.prepare('SELECT json FROM cascata_dia WHERE filial = ? ORDER BY data_ref DESC LIMIT 1').bind(filial).first();
        if (ult) try { j = JSON.parse(ult.json); cascataDeHoje = false; } catch {}
      }
      if (j) {
        for (const s of j.supervisores || []) {
          for (const v of (s.tabelas && s.tabelas.faturamento) || []) if (v && v.id != null && rcas[String(v.id)]) rcas[String(v.id)].meta_hier = Number(v.meta) || 0;
          for (const v of (cascataDeHoje && s.tabelas && s.tabelas.produtividade) || []) {
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
    const outJson = JSON.stringify({ filial, dia, gerado_em: new Date().toISOString(), total: Object.keys(rcas).length, rcas, macro_fora, clube_lido_em });
    if (Object.keys(rcas).length > 0) memSnap.set(chaveMem, { exp: Date.now() + 20000, json: outJson });
    return new Response(outJson, { headers: cors });
  } catch (e) { return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: cors }); }
}
