// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: registro dos LANCES da TV (pênaltis, cartões, supervisores) no D1 (tabela tv_lances,
//          migrations/0004_tv_lances.sql). É o que garante que um lance seja apitado UMA vez só,
//          mesmo com várias TVs abertas, recarregamentos ou aparelhos diferentes.
// PROJETO: CFTV/TV (não é WhatsApp).
// PREMISSA: 100% ONLINE - nada aqui pode depender do PC do Vitório (ver PREMISSA_ONLINE.md).
// POST {filial, lances:[{chave,nivel,rca,vendedor,...}]} -> registra (INSERT OR IGNORE) e devolve
//          { baseline, novos:[chaves realmente novas], total }.
//          "baseline" = primeira sincronização do dia dessa filial: o que já existia NÃO é apitado.
// GET  ?filial=TBL[&dia=YYYY-MM-DD] -> lances do dia (para histórico, ranking e "Revisar 30 min").
// AVISO: endpoint público (igual ao resto do site). Só guarda texto curto; validado e limitado.
// =========================================================================

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });

function agoraSP() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${String(+p.hour % 24).padStart(2, '0')}:${p.minute}:${p.second}` };
}
const txt = (v, n = 200) => (v == null ? null : String(v).slice(0, n));
const int = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.trunc(+v) : null);

export async function onRequestGet({ request, env }) {
  if (!env.DB) return resp({ erro: 'banco indisponivel' }, 503);
  const u = new URL(request.url);
  const filial = (u.searchParams.get('filial') || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(filial)) return resp({ erro: 'filial invalida' }, 400);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : agoraSP().dia;
  try {
    const { results } = await env.DB.prepare(
      `SELECT chave, nivel, rca, vendedor, supervisor, cliente_id, cliente, motivo, dias_sem_compra, ultima_compra, tempo_visita, obs, hora_sp, baseline
       FROM tv_lances WHERE dia = ? AND filial = ? AND nivel != 'marker' ORDER BY hora_sp`
    ).bind(dia, filial).all();
    return resp({ dia, filial, lances: results || [] });
  } catch (e) {
    return resp({ erro: 'falha ao ler: ' + e.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return resp({ erro: 'banco indisponivel' }, 503);
  let b;
  try { b = await request.json(); } catch { return resp({ erro: 'json invalido' }, 400); }
  const filial = String(b.filial || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(filial)) return resp({ erro: 'filial invalida' }, 400);
  const lances = Array.isArray(b.lances) ? b.lances.slice(0, 200) : [];
  const { dia, hora } = agoraSP();
  const iso = new Date().toISOString();
  try {
    // marcador do dia: se acabou de ser criado, esta é a 1ª sincronização do dia (baseline)
    const m = await env.DB.prepare(
      `INSERT OR IGNORE INTO tv_lances (dia, filial, chave, nivel, hora_sp, visto_em, baseline) VALUES (?, ?, '__marker__', 'marker', ?, ?, 1)`
    ).bind(dia, filial, hora, iso).run();
    const baseline = (m.meta && m.meta.changes) === 1;

    const validos = lances.filter((l) => l && typeof l.chave === 'string' && l.chave.length <= 120 && ['penalti', 'venda10', 'visita10', 'supervisor'].includes(l.nivel));
    let novos = [];
    if (validos.length) {
      const stmts = validos.map((l) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO tv_lances (dia, filial, chave, nivel, rca, vendedor, supervisor, cliente_id, cliente, motivo, dias_sem_compra, ultima_compra, tempo_visita, obs, hora_sp, visto_em, baseline)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(dia, filial, l.chave, l.nivel, txt(l.rca, 20), txt(l.vendedor), txt(l.supervisor), txt(l.cliente_id, 30), txt(l.cliente), txt(l.motivo), int(l.dias_sem_compra), txt(l.ultima_compra, 10), txt(l.tempo_visita, 8), txt(l.obs, 300), hora, iso, baseline ? 1 : 0)
      );
      const rs = await env.DB.batch(stmts);
      novos = validos.filter((_, i) => rs[i].meta && rs[i].meta.changes === 1).map((l) => l.chave);
    }
    return resp({ dia, filial, baseline, novos, total: validos.length });
  } catch (e) {
    return resp({ erro: 'falha ao gravar: ' + e.message }, 500);
  }
}
