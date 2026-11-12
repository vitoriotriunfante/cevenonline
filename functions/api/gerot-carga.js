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
    // 11/11/2026 (Vitorio: 'temos em filiais pastas diferentes... precisa pensar em primary keys'): o mesmo vendedor aparece em 2 pastas (supervisores);
    // a chave tem o supervisor (sup = sup_cod; '' para filial e supervisor). A tabela antiga (sem pasta) deixou de ser gravada: a 2a pasta apagava a 1a.
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_recorrencia_pasta (mes TEXT NOT NULL, filial TEXT NOT NULL, nivel TEXT NOT NULL, cod TEXT NOT NULL, sup TEXT NOT NULL DEFAULT "", nome TEXT, objetivo INTEGER, meta INTEGER, positivados INTEGER, faturado REAL, pdvs_afat INTEGER, vlr_afat REAL, pdvs_vend INTEGER, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, nivel, cod, sup))'),
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
  // LIMPEZA DA LINHA QUE SUMIU DO GEROT (12/11/2026, Baly/TPH: vendedor 93 em 2 supervisores; 1.678 de 3.332 linhas de novembro nao vieram na carga do dia):
  // o coletor manda a lista COMPLETA das chaves da extracao; apaga do mes so o que nao veio. Trava: a lista tem que ter >= 80% das linhas existentes
  // (extracao parcial nunca esvazia a tabela). Devolve quantas apagou.
  if (b.vigentes && MES.test(String(b.vigentes.mes || '')) && Array.isArray(b.vigentes.chaves)) {
    const mes = String(b.vigentes.mes), quer = new Set(b.vigentes.chaves.map(String));
    const { results: ex } = await env.DB.prepare('SELECT filial, rca, fornecedor, cod_sup FROM gerot_vendas WHERE mes = ?').bind(mes).all();
    const k = (x) => `${x.filial}|${x.rca}|${x.fornecedor}|${x.cod_sup == null ? '' : x.cod_sup}`;
    // TRAVA POR FILIAL (auditoria 12/11/2026): a de 80% no mes todo recusava o caso real (1.654 chaves x 3.332 linhas velhas) e deixaria apagar uma filial inteira que
    // faltasse no Excel. Agora: so limpa a filial que VEIO na extracao com pelo menos 20 linhas; filial que nao veio fica intacta.
    const porFil = new Map(); for (const c of quer) { const fl = c.split('|')[0]; porFil.set(fl, (porFil.get(fl) || 0) + 1); }
    const exFil = new Map(); for (const x of ex || []) exFil.set(x.filial, (exFil.get(x.filial) || 0) + 1);
    // o Excel do GEROT vem inteiro por filial (falha tira a filial toda, nao metade): filial presente com >= 20 linhas = extracao dela completa
    const limpa = new Set([...porFil].filter(([, n]) => n >= 20).map(([fl]) => fl));
    const sai = (ex || []).filter((x) => limpa.has(x.filial) && !quer.has(k(x)));
    for (let i = 0; i < sai.length; i += 80) await env.DB.batch(sai.slice(i, i + 80).map((x) => env.DB.prepare('DELETE FROM gerot_vendas WHERE mes = ? AND filial = ? AND rca = ? AND fornecedor = ? AND cod_sup = ?').bind(mes, x.filial, x.rca, x.fornecedor, x.cod_sup == null ? '' : x.cod_sup)));
    return r({ ok: true, mes, apagadas: sai.length, vigentes: quer.size, filiais_limpas: [...limpa], filiais_intactas: [...exFil.keys()].filter((fl) => !limpa.has(fl)) });
  }
  const RC = Array.isArray(b.recorrencia) ? b.recorrencia.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && /^(filial|supervisor|vendedor)$/.test(String(x.nivel || '')) && String(x.cod || '').trim()) : [];
  for (let i = 0; i < RC.length; i += 100) await env.DB.batch(RC.slice(i, i + 100).map((x) => env.DB.prepare(
    'INSERT INTO gerot_recorrencia_pasta (mes, filial, nivel, cod, nome, sup, objetivo, meta, positivados, faturado, pdvs_afat, vlr_afat, pdvs_vend, hash, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ' +
    'ON CONFLICT (mes, filial, nivel, cod, sup) DO UPDATE SET nome = excluded.nome, objetivo = excluded.objetivo, meta = excluded.meta, positivados = excluded.positivados, faturado = excluded.faturado, pdvs_afat = excluded.pdvs_afat, vlr_afat = excluded.vlr_afat, pdvs_vend = excluded.pdvs_vend, hash = excluded.hash, em = excluded.em WHERE gerot_recorrencia_pasta.hash IS NOT excluded.hash'
  ).bind(String(x.mes), String(x.filial), String(x.nivel), String(x.cod), x.nome || null, x.nivel === 'vendedor' && x.sup_cod != null ? String(x.sup_cod) : '', x.objetivo ?? null, x.meta ?? null, x.positivados ?? null, x.faturado ?? null, x.pdvs_afat ?? null, x.vlr_afat ?? null, x.pdvs_vend ?? null, String(x.hash || ''), agora)));
  if (b.status && MES.test(String(b.status.mes || ''))) {
    const s = b.status;
    await env.DB.prepare('INSERT INTO gerot_coleta_status (mes, linhas, enviadas, posicao, colunas, em) VALUES (?,?,?,?,?,?)')
      .bind(String(s.mes), Number(s.linhas) || 0, Number(s.enviadas) || 0, String(s.posicao || ''), JSON.stringify(s.colunas || []).slice(0, 4000), agora).run();
    if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM gerot_coleta_status WHERE em < datetime('now','-30 days')").run();
  }
  return r({ ok: true, linhas: L.length, recorrencia: RC.length });
}
