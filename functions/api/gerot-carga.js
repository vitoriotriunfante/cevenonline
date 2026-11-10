// =========================================================================
// FICHA DO ARQUIVO: functions/api/gerot-carga.js   (GET/POST /api/gerot-carga, header X-Evo-Key)
// O QUE É: recebe do GitHub (pipeline/gerot_coletor_online.mjs, depois de cada janela do GEROT) a extracao oficial
//   mes x filial x supervisor x vendedor x fornecedor (meta, faturado, devolucao, positivacao, carteira) e grava no D1.
//   Decisao do Vitorio (semana de 02/11/2026): industria se responde pelo GEROT. Ver docs/GEROT_ESTADO_E_PLANO.md.
// GET  ?mes=2026-11        -> { hashes: {chave: hash} } : o coletor so envia o que mudou (custo D1 = linhas gravadas)
// GET  ?status=1           -> ultimas cargas (mes, linhas, posicao do GEROT, quando)
// POST { linhas: [{mes, filial, rca, fornecedor, cod_sup, supervisor, vendedor, hash, dados}] } (no maximo 200 por chamada)
// POST { status: {mes, linhas, posicao, colunas} } : registra a carga concluida
// POST { recorrencia: [{mes, filial, nivel, cod, nome, sup_cod, objetivo, meta, positivados, faturado, pdvs_afat, vlr_afat, pdvs_vend, hash}] }
//   tela COBERTURA > Recorrencia, 'Lista do dia 1 - recuperacao' (Vitorio 10/11/2026: 'a meta de recorrencia tem no GEROT'); grava so o que mudou
// Nao chama o CEVEN.
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const r = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: J });
const MES = /^\d{4}-\d{2}$/;

async function tabelas(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_vendas (mes TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, fornecedor TEXT NOT NULL, cod_sup TEXT NOT NULL DEFAULT "", supervisor TEXT, vendedor TEXT, dados TEXT NOT NULL, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, rca, fornecedor, cod_sup))'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_gerot_vendas_forn ON gerot_vendas (mes, fornecedor, filial)'),
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_recorrencia (mes TEXT NOT NULL, filial TEXT NOT NULL, nivel TEXT NOT NULL, cod TEXT NOT NULL, nome TEXT, sup_cod TEXT, objetivo INTEGER, meta INTEGER, positivados INTEGER, faturado REAL, pdvs_afat INTEGER, vlr_afat REAL, pdvs_vend INTEGER, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, nivel, cod))'),
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_coleta_status (id INTEGER PRIMARY KEY AUTOINCREMENT, mes TEXT, linhas INTEGER, enviadas INTEGER, posicao TEXT, colunas TEXT, em TEXT)')
  ]);
}

export async function onRequestGet({ request, env }) {
  if (!(await chaveEvoValida(request, env))) return r({ erro: 'nao autorizado' }, 401);
  await tabelas(env.DB);
  const u = new URL(request.url);
  if (u.searchParams.get('status') === '1') {
    const { results } = await env.DB.prepare('SELECT mes, linhas, enviadas, posicao, colunas, em FROM gerot_coleta_status ORDER BY id DESC LIMIT 20').all();
    return r({ cargas: results || [] });
  }
  const mes = String(u.searchParams.get('mes') || '');
  if (!MES.test(mes)) return r({ erro: 'mes obrigatorio (AAAA-MM)' }, 400);
  const { results } = await env.DB.prepare('SELECT filial, rca, fornecedor, cod_sup, hash FROM gerot_vendas WHERE mes = ?').bind(mes).all();
  return r({ hashes: Object.fromEntries((results || []).map((x) => [`${x.filial}|${x.rca}|${x.fornecedor}|${x.cod_sup}`, x.hash])) });
}

export async function onRequestPost({ request, env }) {
  if (!(await chaveEvoValida(request, env))) return r({ erro: 'nao autorizado' }, 401);
  let b = {}; try { b = await request.json(); } catch (e) { return r({ erro: 'json invalido' }, 400); }
  await tabelas(env.DB);
  const agora = new Date().toISOString();
  const L = Array.isArray(b.linhas) ? b.linhas : [];
  if (L.length > 200) return r({ erro: 'no maximo 200 linhas por chamada' }, 400);
  const ruins = L.filter((x) => !MES.test(String(x.mes || '')) || !/^[A-Z]{3}$/.test(String(x.filial || '')) || !String(x.rca || '').trim() || !String(x.fornecedor || '').trim());
  if (ruins.length) return r({ erro: 'linha sem mes/filial/rca/fornecedor', exemplo: ruins[0] }, 400);
  if (L.length) {
    await env.DB.batch(L.map((x) => env.DB.prepare(
      'INSERT INTO gerot_vendas (mes, filial, rca, fornecedor, cod_sup, supervisor, vendedor, dados, hash, em) VALUES (?,?,?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT (mes, filial, rca, fornecedor, cod_sup) DO UPDATE SET supervisor = excluded.supervisor, vendedor = excluded.vendedor, dados = excluded.dados, hash = excluded.hash, em = excluded.em WHERE gerot_vendas.hash IS NOT excluded.hash'
    ).bind(String(x.mes), String(x.filial), String(x.rca), String(x.fornecedor), x.cod_sup == null ? '' : String(x.cod_sup), x.supervisor || null, x.vendedor || null, JSON.stringify(x.dados || {}), String(x.hash || ''), agora)));
  }
  const RC = Array.isArray(b.recorrencia) ? b.recorrencia.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && /^(filial|supervisor|vendedor)$/.test(String(x.nivel || '')) && String(x.cod || '').trim()) : [];
  for (let i = 0; i < RC.length; i += 100) await env.DB.batch(RC.slice(i, i + 100).map((x) => env.DB.prepare(
    'INSERT INTO gerot_recorrencia (mes, filial, nivel, cod, nome, sup_cod, objetivo, meta, positivados, faturado, pdvs_afat, vlr_afat, pdvs_vend, hash, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ' +
    'ON CONFLICT (mes, filial, nivel, cod) DO UPDATE SET nome = excluded.nome, sup_cod = excluded.sup_cod, objetivo = excluded.objetivo, meta = excluded.meta, positivados = excluded.positivados, faturado = excluded.faturado, pdvs_afat = excluded.pdvs_afat, vlr_afat = excluded.vlr_afat, pdvs_vend = excluded.pdvs_vend, hash = excluded.hash, em = excluded.em WHERE gerot_recorrencia.hash IS NOT excluded.hash'
  ).bind(String(x.mes), String(x.filial), String(x.nivel), String(x.cod), x.nome || null, x.sup_cod == null ? null : String(x.sup_cod), x.objetivo ?? null, x.meta ?? null, x.positivados ?? null, x.faturado ?? null, x.pdvs_afat ?? null, x.vlr_afat ?? null, x.pdvs_vend ?? null, String(x.hash || ''), agora)));
  if (b.status && MES.test(String(b.status.mes || ''))) {
    const s = b.status;
    await env.DB.prepare('INSERT INTO gerot_coleta_status (mes, linhas, enviadas, posicao, colunas, em) VALUES (?,?,?,?,?,?)')
      .bind(String(s.mes), Number(s.linhas) || 0, Number(s.enviadas) || 0, String(s.posicao || ''), JSON.stringify(s.colunas || []).slice(0, 4000), agora).run();
    if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM gerot_coleta_status WHERE em < datetime('now','-30 days')").run();
  }
  return r({ ok: true, linhas: L.length, recorrencia: RC.length });
}
