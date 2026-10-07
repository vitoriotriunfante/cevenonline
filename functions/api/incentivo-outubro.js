// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: dados do dashboard ao vivo do INCENTIVO EXTRAORDINÁRIO DE VAREJO — OUTUBRO/2026 (tela /incentivo).
// REGRA (Vitório, 07/10/2026): vale a POSITIVAÇÃO FECHADA do dashboard do CEVEN (positivacao.realizado / positivacao.meta de cada RCA).
//   Pedido digitado/pendente entra como "vendido" e NÃO conta. Nada de estimativa: só o que o CEVEN informou.
// FONTE: D1 `varredura_central_rca.dashboard_json` (cópia crua de /api/rca/dashboard, varredura central do dia) + equipe da Gestão de Equipe (/api/tv-mostra).
// PÚBLICO: Macro Varejo (canais VJ, FARMA, PET VJ, ESP do CEVEN); AS, SUP, GER e quem o CEVEN não classifica ficam fora; ocultos na Gestão ficam fora.
// PRÊMIOS: ver public/incentivo_outubro_2026.json (Gatilho 1 ≥60% até 17/10 = R$150 · Gatilho 2 ≥110% no fechamento = R$350 · Supervisor ≥110% = R$300 · Gerente: filial ≥110% da Coluna N = R$500).
// =========================================================================
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const sigDe = (k) => String(k || '').split('_')[0].toUpperCase().replace(/1$/, '');
const pct = (r, m) => (m > 0 ? Math.round((r / m) * 1000) / 10 : null); // sem meta = sem percentual (nunca inventa)

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  try {
    const cfg = await (await fetch(new URL('/incentivo_outubro_2026.json', url.origin), { cache: 'no-store' })).json();
    const eq = await (await fetch(new URL('/api/tv-mostra', url.origin), { cache: 'no-store' })).json();
    const ref = await env.DB.prepare('SELECT MAX(data_ref) d FROM varredura_central_rca').first();
    const dia = ref && ref.d; if (!dia) return new Response(JSON.stringify({ erro: 'sem varredura do CEVEN no banco' }), { status: 503, headers: CORS });
    const { results } = await env.DB.prepare("SELECT rca_codigo r, filial_sigla f, json_extract(dashboard_json,'$.positivacao.meta') m, json_extract(dashboard_json,'$.positivacao.realizado') p, updated_at u FROM varredura_central_rca WHERE data_ref = ? AND dashboard_json IS NOT NULL").bind(dia).all();
    const dash = new Map((results || []).map((x) => [x.f + '|' + x.r, x]));
    const varejo = new Set(cfg.canais_varejo);

    const vend = []; const fora = { sem_dashboard: [], sem_canal: 0, as: 0, ocultos: 0, outros: 0 };
    for (const [k, lista] of Object.entries(eq.filiais || {})) {
      const sig = sigDe(k);
      for (const x of lista || []) {
        if (!x || x.rca == null) continue;
        if (x.mostra === false) { fora.ocultos++; continue; }
        const canal = String(x.canal || '').trim();
        if (!canal) { fora.sem_canal++; continue; }
        if (!varejo.has(canal)) { if (canal === 'AS' || canal === 'PET AS') fora.as++; else fora.outros++; continue; }
        const d = dash.get(sig + '|' + x.rca);
        if (!d || d.m == null || d.p == null) { fora.sem_dashboard.push({ filial: sig, rca: String(x.rca), nome: x.nome }); continue; }
        const meta = Number(d.m) || 0, real = Number(d.p) || 0;
        vend.push({ filial: sig, grupo: x.grupo || '', gerente: x.gerente || '', rca: String(x.rca), nome: x.nome, supervisor: x.supervisor || '', canal, meta, real, pct: pct(real, meta),
          g1: meta > 0 && real >= meta * cfg.gatilho1.pct / 100, g2: meta > 0 && real >= meta * cfg.gatilho2.pct / 100,
          falta_g1: meta > 0 ? Math.max(0, Math.ceil(meta * cfg.gatilho1.pct / 100 - 1e-9) - real) : null,
          falta_g2: meta > 0 ? Math.max(0, Math.ceil(meta * cfg.gatilho2.pct / 100 - 1e-9) - real) : null });
      }
    }
    const soma = (l) => l.reduce((a, x) => ({ rcas: a.rcas + 1, meta: a.meta + x.meta, real: a.real + x.real }), { rcas: 0, meta: 0, real: 0 });
    // supervisores (vazio = ligado direto ao gerente: sem prêmio de supervisor)
    const ms = new Map();
    for (const v of vend) { if (!v.supervisor) continue; const kk = v.filial + '|' + v.supervisor; (ms.get(kk) || ms.set(kk, []).get(kk)).push(v); }
    const sups = [...ms.entries()].map(([kk, l]) => { const s = soma(l), [filial, nome] = kk.split('|'); return { filial, nome, ...s, pct: pct(s.real, s.meta), ok: s.meta > 0 && s.real >= s.meta * cfg.superacao_pct / 100, falta: s.meta > 0 ? Math.max(0, Math.ceil(s.meta * cfg.superacao_pct / 100 - 1e-9) - s.real) : null }; })
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
    // filiais / gerências (TPH e MCD: uma linha por gerente = por pasta; o alvo da pasta é a soma das metas dos seus RCAs)
    const filiais = Object.keys(cfg.coluna_n).map((sig) => {
      const l = vend.filter((v) => v.filial === sig), s = soma(l), colN = cfg.coluna_n[sig];
      const grupos = [...new Set(l.map((v) => v.grupo).filter(Boolean))];
      const gerencias = grupos.length > 1 ? grupos.map((g) => { const lg = l.filter((v) => v.grupo === g), sg = soma(lg); return { grupo: g, gerente: (lg[0] || {}).gerente || g, ...sg, pct: pct(sg.real, sg.meta), ok: sg.meta > 0 && sg.real >= sg.meta * cfg.superacao_pct / 100 }; }) : [];
      return { filial: sig, coluna_n: colN, ...s, pct_coluna_n: pct(s.real, colN), pct_pastas: pct(s.real, s.meta), alvo110_coluna_n: Math.ceil(colN * cfg.superacao_pct / 100), ok: s.real >= colN * cfg.superacao_pct / 100, falta: Math.max(0, Math.ceil(colN * cfg.superacao_pct / 100) - s.real), gerentes: gerencias };
    });
    const tot = soma(vend), colNTot = Object.values(cfg.coluna_n).reduce((a, b) => a + b, 0);
    const premio = { g1: vend.filter((v) => v.g1).length * cfg.gatilho1.premio, g2: vend.filter((v) => v.g2).length * cfg.gatilho2.premio, sup: sups.filter((s) => s.ok).length * cfg.premio_supervisor, ger: filiais.filter((f) => (f.gerentes.length ? false : f.ok)).length * cfg.premio_gerente + filiais.reduce((a, f) => a + f.gerentes.filter((g) => g.ok).length, 0) * cfg.premio_gerente };
    const atualizado = (results || []).map((x) => x.u).sort().pop() || null;
    return new Response(JSON.stringify({
      versao: cfg.versao, cfg, dia_dados: dia, atualizado_em: atualizado, gerado_em: new Date().toISOString(),
      nacional: { ...tot, coluna_n: colNTot, meta_regulamento: cfg.meta_nacional_regulamento, meta_superacao: cfg.meta_nacional_superacao, pct_regulamento: pct(tot.real, cfg.meta_nacional_regulamento), pct_superacao: pct(tot.real, cfg.meta_nacional_superacao), supervisores: sups.length },
      premio_se_fechasse_hoje: { ...premio, total: premio.g1 + premio.g2 + premio.sup + premio.ger },
      filiais, supervisores: sups, vendedores: vend.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)),
      fora_do_calculo: { ...fora, sem_dashboard_n: fora.sem_dashboard.length }
    }), { headers: CORS });
  } catch (e) { return new Response(JSON.stringify({ erro: 'falha ao montar o incentivo: ' + (e && e.message) }), { status: 502, headers: CORS }); }
}
