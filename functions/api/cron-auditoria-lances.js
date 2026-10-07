// =========================================================================
// FICHA DO ARQUIVO: functions/api/cron-auditoria-lances.js
// O QUE É: roda a AUDITORIA LANCE POR LANCE (functions/_lib/auditoria_lance.js) sobre os lances que contam pontos no dia e guarda o resultado.
//          GET /api/cron-auditoria-lances?dia=AAAA-MM-DD            -> resumo guardado (e a lista de lances com falha)
//          GET /api/cron-auditoria-lances?dia=AAAA-MM-DD&rodar=1    -> audita agora (chamado pelo coletor de lances a cada ~30 min e depois do fechamento)
//          SOMENTE LEITURA dos lances. Nunca apaga nem corrige lance: aponta. Quem decide retirar da liga é o Vitório.
// =========================================================================
import { auditaLista } from '../_lib/auditoria_lance.js';
import { agoraSP } from '../_lib/liga_fechamento.js';
const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

export async function onRequestGet({ env, request }) {
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 nao configurado' }), { status: 503, headers: cors });
  const u = new URL(request.url), t = agoraSP();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : t.dia;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS auditoria_lance_resumo (dia TEXT PRIMARY KEY, auditados INTEGER, ok INTEGER, com_falha INTEGER, por_regra_json TEXT, em TEXT)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS auditoria_lance_falha (dia TEXT NOT NULL, chave TEXT NOT NULL, filial TEXT NOT NULL, regra TEXT, falhas_json TEXT, hora TEXT, vendedor TEXT, rca TEXT, pontos REAL, em TEXT, PRIMARY KEY (dia, chave, filial))').run();
    let pular = false;
    if (u.searchParams.get('rodar') === '1' && u.searchParams.get('se_velho') === '1') {
      const rec = await env.DB.prepare("SELECT dia FROM auditoria_lance_resumo WHERE dia = ? AND em > datetime('now', '-25 minutes')").bind(dia).first();
      pular = !!rec;
    }
    if (u.searchParams.get('rodar') === '1' && !pular) {
      const r = await fetch(`${u.origin}/api/brasileirao-lances?dia=${dia}`, { signal: AbortSignal.timeout(40000) });
      const j = await r.json().catch(() => null);
      if (!j || !Array.isArray(j.lances)) return new Response(JSON.stringify({ dia, status: 'FALHOU', motivo: 'nao consegui ler os lances do dia' }), { headers: cors });
      const a = auditaLista(j.lances, dia);
      await env.DB.prepare('DELETE FROM auditoria_lance_falha WHERE dia = ?').bind(dia).run();
      const stmts = a.falhos.map((f) => env.DB.prepare("INSERT OR REPLACE INTO auditoria_lance_falha (dia, chave, filial, regra, falhas_json, hora, vendedor, rca, pontos, em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))")
        .bind(dia, String(f.chave || ''), String(f.filial || ''), f.regra, JSON.stringify(f.falhas), f.hora || null, f.vendedor || null, String(f.rca == null ? '' : f.rca), Number(f.pontos) || 0));
      for (let i = 0; i < stmts.length; i += 80) await env.DB.batch(stmts.slice(i, i + 80));
      await env.DB.prepare("INSERT OR REPLACE INTO auditoria_lance_resumo (dia, auditados, ok, com_falha, por_regra_json, em) VALUES (?, ?, ?, ?, ?, datetime('now'))").bind(dia, a.auditados, a.ok, a.com_falha, JSON.stringify(a.por_regra)).run();
    }
    const res = await env.DB.prepare('SELECT auditados, ok, com_falha, por_regra_json, em FROM auditoria_lance_resumo WHERE dia = ?').bind(dia).first();
    if (!res) return new Response(JSON.stringify({ dia, auditado: false }), { headers: cors });
    const { results } = await env.DB.prepare('SELECT chave, filial, regra, falhas_json, hora, vendedor, rca, pontos FROM auditoria_lance_falha WHERE dia = ? ORDER BY hora DESC LIMIT 300').bind(dia).all();
    return new Response(JSON.stringify({ dia, auditado: true, auditados: res.auditados, ok: res.ok, com_falha: res.com_falha, em: res.em, por_regra: JSON.parse(res.por_regra_json || '{}'),
      falhos: (results || []).map((x) => ({ ...x, falhas: JSON.parse(x.falhas_json || '[]'), falhas_json: undefined })) }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e.message || e).slice(0, 300) }), { status: 500, headers: cors });
  }
}
