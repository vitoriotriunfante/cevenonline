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
// 18/11/2026: colunas da Liga (mp, nforn, skus) criadas uma vez por instancia
let colunasLiga = false;
let tabelasGarantidas = false;
const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const r = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: J });
const MES = /^\d{4}-\d{2}$/;

async function tabelas(db) {
  if (tabelasGarantidas) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_vendas (mes TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, fornecedor TEXT NOT NULL, cod_sup TEXT NOT NULL DEFAULT "", supervisor TEXT, vendedor TEXT, dados TEXT NOT NULL, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, rca, fornecedor, cod_sup))'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_gerot_vendas_forn ON gerot_vendas (mes, fornecedor, filial)'),
    // 11/11/2026 (Vitorio: 'temos em filiais pastas diferentes... precisa pensar em primary keys'): o mesmo vendedor aparece em 2 pastas (supervisores);
    // a chave tem o supervisor (sup = sup_cod; '' para filial e supervisor). A tabela antiga (sem pasta) deixou de ser gravada: a 2a pasta apagava a 1a.
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_recorrencia_pasta (mes TEXT NOT NULL, filial TEXT NOT NULL, nivel TEXT NOT NULL, cod TEXT NOT NULL, sup TEXT NOT NULL DEFAULT "", nome TEXT, objetivo INTEGER, meta INTEGER, positivados INTEGER, faturado REAL, pdvs_afat INTEGER, vlr_afat REAL, pdvs_vend INTEGER, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, nivel, cod, sup))'),
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_recorrencia (mes TEXT NOT NULL, filial TEXT NOT NULL, nivel TEXT NOT NULL, cod TEXT NOT NULL, nome TEXT, sup_cod TEXT, objetivo INTEGER, meta INTEGER, positivados INTEGER, faturado REAL, pdvs_afat INTEGER, vlr_afat REAL, pdvs_vend INTEGER, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, nivel, cod))'),
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_vendedor_mes (mes TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, cod_sup TEXT NOT NULL DEFAULT "", supervisor TEXT, vendedor TEXT, dados TEXT NOT NULL, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, rca, cod_sup))'),
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_supervisor_mes (mes TEXT NOT NULL, filial TEXT NOT NULL, cod_sup TEXT NOT NULL, supervisor TEXT, dados TEXT NOT NULL, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, cod_sup))'),
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_filial_mes (mes TEXT NOT NULL, filial TEXT NOT NULL, dados TEXT NOT NULL, hash TEXT, em TEXT, PRIMARY KEY (mes, filial))'),
    // 16/11/2026: carteira por cliente (Mes x Filial x Vendedor x Cliente) = fonte da curva negativa e de 'quem nao comprou'
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_cliente_mes (mes TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, cliente TEXT NOT NULL, cnpj TEXT, nome TEXT, dados TEXT NOT NULL, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, rca, cliente))'),
    // 21/11/2026: CLIENTE x INDUSTRIA (curva negativa por industria); so linhas com algum numero; nome/CNPJ ficam em gerot_cliente_mes
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_cliente_forn_mes (mes TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, cliente TEXT NOT NULL, forn_cod TEXT NOT NULL, fornecedor TEXT, dados TEXT NOT NULL, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, rca, cliente, forn_cod))'),
    // 16/11/2026: teste de horario do GEROT (pipeline/gerot_horario.mjs): uma linha por leitura, so as horas que o painel mostra
    // 17/11/2026 (Vitorio: 'mostrando pedidos do dia 12? ja nao mostrei que tem todos os pedidos no GEROT?'): um pedido por linha (pedido x NF), do 'Extrair dados'
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_pedido (mes TEXT NOT NULL, filial TEXT NOT NULL, pedido TEXT NOT NULL, nf TEXT NOT NULL DEFAULT "", rca TEXT, cliente TEXT, cnpj TEXT, nome TEXT, data TEXT, dados TEXT NOT NULL, hash TEXT, em TEXT, PRIMARY KEY (mes, filial, pedido, nf))'),
    db.prepare('CREATE INDEX IF NOT EXISTS ix_gerot_pedido_rca ON gerot_pedido (filial, rca, data)'),
    // 17/11/2026: CARTEIRA TOTAL por pedido (pipeline/gerot_carteira.mjs): status, situacao, motivo de bloqueio e valor do que esta em aberto
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_carteira (filial TEXT NOT NULL, pedido TEXT NOT NULL, rca TEXT, vendedor TEXT, sup_cod TEXT, entrada TEXT, origem TEXT, status TEXT, situacao TEXT, motivo TEXT, cliente TEXT, cnpj TEXT, status_cliente TEXT, positivado TEXT, valor REAL, itens INTEGER, qped REAL, qfat REAL, fornecedores TEXT, hash TEXT, em TEXT, PRIMARY KEY (filial, pedido))'),
    db.prepare('CREATE INDEX IF NOT EXISTS ix_gerot_carteira_rca ON gerot_carteira (filial, rca)'),
    // 17/11/2026: DATA DO PEDIDO guardada para sempre (a carteira perde o pedido quando ele fatura, e no 'Pedidos' a data vira a do faturamento) = base da Liga sem o CEVEN
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_pedido_entrada (filial TEXT NOT NULL, pedido TEXT NOT NULL, rca TEXT, cnpj TEXT, entrada TEXT, visto_em TEXT, PRIMARY KEY (filial, pedido))'),
    db.prepare('CREATE INDEX IF NOT EXISTS ix_gerot_pedido_entrada_dia ON gerot_pedido_entrada (entrada, filial, rca)'),
    // 18/11/2026: faturado (e todos os calculos) por FILIAL x DIA = 'ate a data' x mes passado
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_filial_dia (mes TEXT NOT NULL, filial TEXT NOT NULL, data TEXT NOT NULL, dados TEXT NOT NULL, hash TEXT, em TEXT, PRIMARY KEY (filial, data))'),
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_horario (id INTEGER PRIMARY KEY AUTOINCREMENT, lido_em TEXT, ok INTEGER, ultima TEXT, carga TEXT, posicao TEXT, segundos INTEGER, erro TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_coleta_status (id INTEGER PRIMARY KEY AUTOINCREMENT, mes TEXT, linhas INTEGER, enviadas INTEGER, posicao TEXT, colunas TEXT, em TEXT)'),
    // 24/11/2026: foto diaria do GEROT por vendedor para a Liga AS (substitui varredura_central_rca do CEVEN, parada em 16/11)
    db.prepare('CREATE TABLE IF NOT EXISTS liga_as_foto_dia (dia TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, meta REAL, faturado REAL, pendente REAL, em TEXT, PRIMARY KEY (dia, filial, rca))'),
    db.prepare('CREATE TABLE IF NOT EXISTS gerot_carga_controle (lote_id TEXT NOT NULL, mes TEXT NOT NULL, etapa TEXT NOT NULL, status TEXT NOT NULL, filiais INTEGER NOT NULL DEFAULT 0, linhas INTEGER NOT NULL DEFAULT 0, gravadas INTEGER NOT NULL DEFAULT 0, removidas INTEGER NOT NULL DEFAULT 0, posicao TEXT, detalhe TEXT, iniciado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (lote_id, mes, etapa))')
  ]);
  tabelasGarantidas = true;
}

export async function onRequestGet({ request, env }) {
  if (!(await chaveEvoValida(request, env))) return r({ erro: 'nao autorizado' }, 401);
  await tabelas(env.DB);
  const u = new URL(request.url);
  if (u.searchParams.get('status') === '1') {
    const { results } = await env.DB.prepare('SELECT mes, linhas, enviadas, posicao, colunas, em FROM gerot_coleta_status ORDER BY id DESC LIMIT 20').all();
    return r({ cargas: results || [] });
  }
  if (u.searchParams.get('carteira') === '1') {
    const { results } = await env.DB.prepare('SELECT filial, pedido, hash FROM gerot_carteira').all();
    return r({ hashes: Object.fromEntries((results || []).map((x) => [`${x.filial}|${x.pedido}`, x.hash])) });
  }
  const mes = String(u.searchParams.get('mes') || '');
  if (!MES.test(mes)) return r({ erro: 'mes obrigatorio (AAAA-MM)' }, 400);
  if (u.searchParams.get('vendedor') === '1') {
    const { results } = await env.DB.prepare('SELECT filial, rca, cod_sup, hash FROM gerot_vendedor_mes WHERE mes = ?').bind(mes).all();
    return r({ hashes: Object.fromEntries((results || []).map((x) => [`${x.filial}|${x.rca}|${x.cod_sup}`, x.hash])) });
  }
  if (u.searchParams.get('supervisor') === '1') {
    const { results } = await env.DB.prepare('SELECT filial, cod_sup, hash FROM gerot_supervisor_mes WHERE mes = ?').bind(mes).all();
    return r({ hashes: Object.fromEntries((results || []).map((x) => [`${x.filial}|${x.cod_sup}`, x.hash])) });
  }
  if (u.searchParams.get('dia') === '1') {
    const { results } = await env.DB.prepare('SELECT filial, data, hash FROM gerot_filial_dia WHERE mes = ?').bind(mes).all();
    return r({ hashes: Object.fromEntries((results || []).map((x) => [`${x.filial}|${x.data}`, x.hash])) });
  }
  if (u.searchParams.get('pedido') === '1') {
    const { results } = await env.DB.prepare('SELECT filial, pedido, nf, hash FROM gerot_pedido WHERE mes = ?').bind(mes).all();
    return r({ hashes: Object.fromEntries((results || []).map((x) => [`${x.filial}|${x.pedido}|${x.nf}`, x.hash])) });
  }
  if (u.searchParams.get('clienteforn') === '1') {
    const { results } = await env.DB.prepare('SELECT filial, rca, cliente, forn_cod, hash FROM gerot_cliente_forn_mes WHERE mes = ?').bind(mes).all();
    return r({ hashes: Object.fromEntries((results || []).map((x) => [`${x.filial}|${x.rca}|${x.cliente}|${x.forn_cod}`, x.hash])) });
  }
  if (u.searchParams.get('cliente') === '1') {
    const { results } = await env.DB.prepare('SELECT filial, rca, cliente, hash FROM gerot_cliente_mes WHERE mes = ?').bind(mes).all();
    return r({ hashes: Object.fromEntries((results || []).map((x) => [`${x.filial}|${x.rca}|${x.cliente}`, x.hash])) });
  }
  if (u.searchParams.get('filial') === '1') {
    const { results } = await env.DB.prepare('SELECT filial, hash FROM gerot_filial_mes WHERE mes = ?').bind(mes).all();
    return r({ hashes: Object.fromEntries((results || []).map((x) => [x.filial, x.hash])) });
  }
  if (u.searchParams.get('dim') === '1') {
    const { results } = await env.DB.prepare('SELECT dim, filial, chave, hash FROM gerot_dim_agregado WHERE mes = ?').bind(mes).all();
    return r({ hashes: Object.fromEntries((results || []).map((x) => [`${x.dim}|${x.filial}|${x.chave}`, x.hash])) });
  }
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
  if (b.horario && typeof b.horario === 'object') {
    const h = b.horario;
    await env.DB.prepare('INSERT INTO gerot_horario (lido_em, ok, ultima, carga, posicao, segundos, erro) VALUES (?,?,?,?,?,?,?)').bind(String(h.lido_em || agora), h.ok ? 1 : 0, h.ultima ? String(h.ultima).slice(0, 60) : null, h.carga ? String(h.carga).slice(0, 40) : null, h.posicao ? String(h.posicao).slice(0, 40) : null, Number(h.segundos) || null, h.erro ? String(h.erro).slice(0, 200) : null).run();
    // 21/11/2026 (Vitorio: 'le ele de 20 em 20 minutos'): a SONDA (15 em 15 min) diz se o GEROT mudou desde a ultima coleta.
    // Mudou e ainda nao pedimos coleta para essa atualizacao (ou pedimos ha mais de 45 min sem ela chegar) -> coletar:true, uma vez por atualizacao.
    const hm = (s) => { const m = String(s || '').match(/(\d{2}\/\d{2}\/\d{2})\s+(\d{1,2}:\d{2})/); return m ? m[1] + ' ' + m[2].padStart(5, '0') : ''; };
    const nova = hm(h.ultima);
    let coletar = false, ultColeta = '';
    if (nova) {
      const st = await env.DB.prepare('SELECT posicao FROM gerot_coleta_status ORDER BY id DESC LIMIT 1').first().catch(() => null);
      ultColeta = hm(st && st.posicao);
      if (nova !== ultColeta) {
        const p = await env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'gerot_coleta_pedida'").first().catch(() => null);
        let ped = {}; try { ped = JSON.parse((p && p.valor) || '{}'); } catch (e) { ped = {}; }
        if (ped.ultima !== nova || Date.now() - Date.parse(ped.em || 0) > 45 * 60e3) {
          coletar = true;
          await env.DB.prepare("INSERT OR REPLACE INTO config_flags (chave, valor) VALUES ('gerot_coleta_pedida', ?)").bind(JSON.stringify({ ultima: nova, em: agora })).run();
        }
      }
    }
    return r({ ok: true, horario: true, ultima: nova, ultima_coletada: ultColeta, coletar });
  }
  // 18/11/2026: DEVOLUCAO POR MOTIVO ATE O VENDEDOR (Motivo -> Filial -> Supervisor -> Vendedor na tela Devolucoes): grava so o que mudou
  const DV = Array.isArray(b.devmotivo_vend) ? b.devmotivo_vend : [];
  if (DV.length) {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS gerot_devolucao_motivo_vend (mes TEXT NOT NULL, motivo TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, sup_cod TEXT, vendedor TEXT, valor REAL, clientes INTEGER, em TEXT, PRIMARY KEY (mes, motivo, filial, rca))').run();
    const ok = DV.filter((x) => x && x.motivo && /^[A-Z]{3}$/.test(String(x.filial || '')) && /^\d+$/.test(String(x.rca || '')) && MES.test(String(x.mes || ''))).slice(0, 400);
    await env.DB.batch(ok.map((x) => env.DB.prepare('INSERT INTO gerot_devolucao_motivo_vend (mes, motivo, filial, rca, sup_cod, vendedor, valor, clientes, em) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (mes, motivo, filial, rca) DO UPDATE SET sup_cod = excluded.sup_cod, vendedor = excluded.vendedor, valor = excluded.valor, clientes = excluded.clientes, em = excluded.em WHERE gerot_devolucao_motivo_vend.valor IS NOT excluded.valor OR gerot_devolucao_motivo_vend.clientes IS NOT excluded.clientes')
      .bind(String(x.mes), String(x.motivo).slice(0, 80), String(x.filial), String(x.rca), x.sup_cod ? String(x.sup_cod).slice(0, 12) : null, x.vendedor ? String(x.vendedor).slice(0, 80) : null, Number(x.valor) || 0, Math.round(Number(x.clientes) || 0), agora)));
    return r({ ok: true, devmotivo_vend: ok.length });
  }
  // 18/11/2026: DEVOLUCAO POR MOTIVO (tela Devolucoes do GEROT; pipeline/gerot_devolucoes.mjs): foto do mes, trocada a cada leitura
  const DM = Array.isArray(b.devmotivo) ? b.devmotivo : [];
  if (DM.length) {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS gerot_devolucao_motivo (mes TEXT NOT NULL, motivo TEXT NOT NULL, filial TEXT NOT NULL DEFAULT "", valor REAL, notas INTEGER, clientes INTEGER, em TEXT, PRIMARY KEY (mes, motivo, filial))').run();
    const mesD = String(b.devmotivo_mes || ''); if (!MES.test(mesD)) return r({ erro: 'devmotivo_mes obrigatorio' }, 400);
    if (b.devmotivo_primeiro) await env.DB.prepare('DELETE FROM gerot_devolucao_motivo WHERE mes = ?').bind(mesD).run();
    const ok = DM.filter((x) => x && x.motivo).slice(0, 400);
    await env.DB.batch(ok.map((x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_devolucao_motivo (mes, motivo, filial, valor, notas, clientes, em) VALUES (?,?,?,?,?,?,?)').bind(mesD, String(x.motivo).slice(0, 80), String(x.filial || '').slice(0, 3), Number(x.valor) || 0, Math.round(Number(x.notas) || 0), Math.round(Number(x.clientes) || 0), agora)));
    return r({ ok: true, devmotivo: ok.length });
  }
  const DI = Array.isArray(b.dias) ? b.dias : [];
  if (DI.length > 200) return r({ erro: 'no maximo 200 dias por chamada' }, 400);
  if (DI.length) {
    const ok = DI.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.data || '')));
    await env.DB.batch(ok.map((x) => env.DB.prepare('INSERT INTO gerot_filial_dia (mes, filial, data, dados, hash, em) VALUES (?,?,?,?,?,?) ON CONFLICT (filial, data) DO UPDATE SET mes = excluded.mes, dados = excluded.dados, hash = excluded.hash, em = excluded.em WHERE gerot_filial_dia.hash IS NOT excluded.hash').bind(String(x.mes), String(x.filial), String(x.data), JSON.stringify(x.dados || {}), String(x.hash || ''), agora)));
    return r({ ok: true, dias: ok.length, recusados: DI.length - ok.length });
  }
  const CT = Array.isArray(b.carteira) ? b.carteira : [];
  // 18/11/2026: marca propria, industrias e SKUs por pedido (Liga: gol de marca propria / tripla / industrias do pedido). Colunas novas, criadas uma vez.
  if (CT.length && !colunasLiga) { for (const sql of ['ALTER TABLE gerot_carteira ADD COLUMN mp REAL', 'ALTER TABLE gerot_carteira ADD COLUMN nforn INTEGER', 'ALTER TABLE gerot_carteira ADD COLUMN skus INTEGER', 'ALTER TABLE gerot_pedido_entrada ADD COLUMN mp REAL', 'ALTER TABLE gerot_pedido_entrada ADD COLUMN nforn INTEGER', 'ALTER TABLE gerot_pedido_entrada ADD COLUMN skus INTEGER']) { try { await env.DB.prepare(sql).run(); } catch (e) { /* ja existe */ } } colunasLiga = true; }
  if (CT.length > 200) return r({ erro: 'no maximo 200 pedidos de carteira por chamada' }, 400);
  if (CT.length) {
    const ok = CT.filter((x) => /^[A-Z]{3}$/.test(String(x.filial || '')) && String(x.pedido || '').trim());
    const t = (v, n = 120) => (v == null || v === '' ? null : String(v).slice(0, n));
    await env.DB.batch(ok.map((x) => env.DB.prepare(
      'INSERT INTO gerot_carteira (filial, pedido, rca, vendedor, sup_cod, entrada, origem, status, situacao, motivo, cliente, cnpj, status_cliente, positivado, valor, itens, qped, qfat, fornecedores, hash, em, mp, nforn, skus) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT (filial, pedido) DO UPDATE SET rca = excluded.rca, vendedor = excluded.vendedor, sup_cod = excluded.sup_cod, entrada = excluded.entrada, origem = excluded.origem, status = excluded.status, situacao = excluded.situacao, motivo = excluded.motivo, cliente = excluded.cliente, cnpj = excluded.cnpj, status_cliente = excluded.status_cliente, positivado = excluded.positivado, valor = excluded.valor, itens = excluded.itens, qped = excluded.qped, qfat = excluded.qfat, fornecedores = excluded.fornecedores, hash = excluded.hash, em = excluded.em, mp = excluded.mp, nforn = excluded.nforn, skus = excluded.skus WHERE gerot_carteira.hash IS NOT excluded.hash'
    ).bind(String(x.filial), String(x.pedido), t(x.rca, 12), t(x.vendedor), t(x.sup_cod, 12), t(x.entrada, 10), t(x.origem, 40), t(x.status, 60), t(x.situacao, 60), t(x.motivo, 200), t(x.cliente), t(x.cnpj, 14), t(x.status_cliente, 40), t(x.positivado, 20), x.valor == null ? null : (Number.isFinite(Number(x.valor)) ? Number(x.valor) : null), Number(x.itens) || 0, Number(x.qped) || 0, Number(x.qfat) || 0, JSON.stringify(x.fornecedores || []).slice(0, 600), String(x.hash || ''), agora, x.mp == null ? null : Number(x.mp) || 0, x.nforn == null ? null : Number(x.nforn) || 0, x.skus == null ? null : Number(x.skus) || 0)));
    await env.DB.batch(ok.filter((x) => x.entrada).map((x) => env.DB.prepare('INSERT INTO gerot_pedido_entrada (filial, pedido, rca, cnpj, entrada, visto_em, mp, nforn, skus) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (filial, pedido) DO UPDATE SET rca = COALESCE(excluded.rca, gerot_pedido_entrada.rca), cnpj = COALESCE(excluded.cnpj, gerot_pedido_entrada.cnpj), mp = MAX(COALESCE(gerot_pedido_entrada.mp, 0), COALESCE(excluded.mp, 0)), nforn = MAX(COALESCE(gerot_pedido_entrada.nforn, 0), COALESCE(excluded.nforn, 0)), skus = MAX(COALESCE(gerot_pedido_entrada.skus, 0), COALESCE(excluded.skus, 0)) WHERE gerot_pedido_entrada.rca IS NOT excluded.rca OR gerot_pedido_entrada.cnpj IS NOT excluded.cnpj OR COALESCE(excluded.mp, 0) > COALESCE(gerot_pedido_entrada.mp, 0) OR COALESCE(excluded.nforn, 0) > COALESCE(gerot_pedido_entrada.nforn, 0) OR COALESCE(excluded.skus, 0) > COALESCE(gerot_pedido_entrada.skus, 0)')
      .bind(String(x.filial), String(x.pedido), t(x.rca, 12), t(x.cnpj, 14), t(x.entrada, 10), agora, x.mp == null ? null : Number(x.mp) || 0, x.nforn == null ? null : Number(x.nforn) || 0, x.skus == null ? null : Number(x.skus) || 0)));   // 18/11: mp/nforn/skus = o MAIOR ja visto (a carteira perde itens quando fatura parcial)
    return r({ ok: true, carteira: ok.length, recusados: CT.length - ok.length });
  }
  const CR = Array.isArray(b.carteira_remover) ? b.carteira_remover : [];
  if (CR.length > 400) return r({ erro: 'no maximo 400 remocoes por chamada' }, 400);
  if (CR.length) {
    const ok = CR.map((k) => String(k).split('|')).filter(([f, pd]) => /^[A-Z]{3}$/.test(f || '') && pd);
    await env.DB.batch(ok.map(([f, pd]) => env.DB.prepare('DELETE FROM gerot_carteira WHERE filial = ? AND pedido = ?').bind(f, pd)));
    return r({ ok: true, removidos: ok.length });
  }
  const PD = Array.isArray(b.pedidos) ? b.pedidos : [];
  if (PD.length > 200) return r({ erro: 'no maximo 200 pedidos por chamada' }, 400);
  if (PD.length) {
    const ok = PD.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && String(x.pedido || '').trim());
    await env.DB.batch(ok.map((x) => env.DB.prepare(
      'INSERT INTO gerot_pedido (mes, filial, pedido, nf, rca, cliente, cnpj, nome, data, dados, hash, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT (mes, filial, pedido, nf) DO UPDATE SET rca = excluded.rca, cliente = excluded.cliente, cnpj = excluded.cnpj, nome = excluded.nome, data = excluded.data, dados = excluded.dados, hash = excluded.hash, em = excluded.em WHERE gerot_pedido.hash IS NOT excluded.hash'
    ).bind(String(x.mes), String(x.filial), String(x.pedido), String(x.nf || ''), x.rca ? String(x.rca) : null, x.cliente ? String(x.cliente) : null, x.cnpj || null, x.nome || null, x.data || null, JSON.stringify(x.dados || {}), String(x.hash || ''), agora)));
    return r({ ok: true, pedidos: ok.length, recusados: PD.length - ok.length });
  }
  const CF = Array.isArray(b.clientes_forn) ? b.clientes_forn : [];
  if (CF.length > 200) return r({ erro: 'no maximo 200 linhas cliente x industria por chamada' }, 400);
  if (CF.length) {
    const ok = CF.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && String(x.rca || '').trim() && String(x.cliente || '').trim() && String(x.forn_cod || '').trim());
    await env.DB.batch(ok.map((x) => env.DB.prepare(
      'INSERT INTO gerot_cliente_forn_mes (mes, filial, rca, cliente, forn_cod, fornecedor, dados, hash, em) VALUES (?,?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT (mes, filial, rca, cliente, forn_cod) DO UPDATE SET fornecedor = excluded.fornecedor, dados = excluded.dados, hash = excluded.hash, em = excluded.em WHERE gerot_cliente_forn_mes.hash IS NOT excluded.hash'
    ).bind(String(x.mes), String(x.filial), String(x.rca), String(x.cliente), String(x.forn_cod).slice(0, 40), x.fornecedor ? String(x.fornecedor).slice(0, 80) : null, JSON.stringify(x.dados || {}), String(x.hash || ''), agora)));
    return r({ ok: true, clientes_forn: ok.length, recusados: CF.length - ok.length });
  }
  const C = Array.isArray(b.clientes) ? b.clientes : [];
  if (C.length > 200) return r({ erro: 'no maximo 200 clientes por chamada' }, 400);
  if (C.length) {
    const ok = C.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && String(x.rca || '').trim() && String(x.cliente || '').trim());
    await env.DB.batch(ok.map((x) => env.DB.prepare(
      'INSERT INTO gerot_cliente_mes (mes, filial, rca, cliente, cnpj, nome, dados, hash, em) VALUES (?,?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT (mes, filial, rca, cliente) DO UPDATE SET cnpj = excluded.cnpj, nome = excluded.nome, dados = excluded.dados, hash = excluded.hash, em = excluded.em WHERE gerot_cliente_mes.hash IS NOT excluded.hash'
    ).bind(String(x.mes), String(x.filial), String(x.rca), String(x.cliente), x.cnpj || null, x.nome || null, JSON.stringify(x.dados || {}), String(x.hash || ''), agora)));
    if (!b.vendedores && !b.linhas && !b.supervisores && !b.filiais && !b.status) return r({ ok: true, clientes: ok.length, recusados: C.length - ok.length });
  }
  const V = Array.isArray(b.vendedores) ? b.vendedores : [];
  if (V.length > 200) return r({ erro: 'no maximo 200 vendedores por chamada' }, 400);
  const vRuins = V.filter((x) => !MES.test(String(x.mes || '')) || !/^[A-Z]{3}$/.test(String(x.filial || '')) || !String(x.rca || '').trim());
  if (vRuins.length) return r({ erro: 'vendedor sem mes/filial/rca', exemplo: vRuins[0] }, 400);
  if (V.length) {
    await env.DB.batch(V.map((x) => env.DB.prepare(
      'INSERT INTO gerot_vendedor_mes (mes, filial, rca, cod_sup, supervisor, vendedor, dados, hash, em) VALUES (?,?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT (mes, filial, rca, cod_sup) DO UPDATE SET supervisor = excluded.supervisor, vendedor = excluded.vendedor, dados = excluded.dados, hash = excluded.hash, em = excluded.em WHERE gerot_vendedor_mes.hash IS NOT excluded.hash'
    ).bind(String(x.mes), String(x.filial), String(x.rca), x.cod_sup == null ? '' : String(x.cod_sup), x.supervisor || null, x.vendedor || null, JSON.stringify(x.dados || {}), String(x.hash || ''), agora)));
  }
  if (b.vigentes_vend && MES.test(String(b.vigentes_vend.mes || '')) && Array.isArray(b.vigentes_vend.chaves)) {
    const mes = String(b.vigentes_vend.mes), quer = new Set(b.vigentes_vend.chaves.map(String));
    const { results: ex } = await env.DB.prepare('SELECT filial, rca, cod_sup FROM gerot_vendedor_mes WHERE mes = ?').bind(mes).all();
    const k = (x) => `${x.filial}|${x.rca}|${x.cod_sup == null ? '' : x.cod_sup}`;
    const porFil = new Map(); for (const c of quer) { const fl = c.split('|')[0]; porFil.set(fl, (porFil.get(fl) || 0) + 1); }
    const exFil = new Map(); for (const x of ex || []) exFil.set(x.filial, (exFil.get(x.filial) || 0) + 1);
    const limpa = new Set([...porFil].filter(([fl, n]) => n >= Math.max(10, Math.floor((exFil.get(fl) || 0) * 0.8))).map(([fl]) => fl));
    const sai = (ex || []).filter((x) => limpa.has(x.filial) && !quer.has(k(x)));
    for (let i = 0; i < sai.length; i += 80) await env.DB.batch(sai.slice(i, i + 80).map((x) => env.DB.prepare('DELETE FROM gerot_vendedor_mes WHERE mes = ? AND filial = ? AND rca = ? AND cod_sup = ?').bind(mes, x.filial, x.rca, x.cod_sup == null ? '' : x.cod_sup)));
    return r({ ok: true, mes, apagadas_vend: sai.length, vigentes_vend: quer.size, filiais_limpas: [...limpa], filiais_intactas: [...exFil.keys()].filter((fl) => !limpa.has(fl)) });
  }
  if (b.vigentes_sup && MES.test(String(b.vigentes_sup.mes || '')) && Array.isArray(b.vigentes_sup.chaves)) {
    const mesS = String(b.vigentes_sup.mes), querS = new Set(b.vigentes_sup.chaves.map(String));
    const { results: exS } = await env.DB.prepare('SELECT filial, cod_sup FROM gerot_supervisor_mes WHERE mes = ?').bind(mesS).all();
    const kS = (x) => `${x.filial}|${x.cod_sup}`;
    const porFilS = new Map(); for (const c of querS) { const fl = c.split('|')[0]; porFilS.set(fl, (porFilS.get(fl) || 0) + 1); }
    const exFilS = new Map(); for (const x of exS || []) exFilS.set(x.filial, (exFilS.get(x.filial) || 0) + 1);
    const limpaS = new Set([...porFilS].filter(([fl, n]) => n >= Math.max(2, Math.floor((exFilS.get(fl) || 0) * 0.8))).map(([fl]) => fl));
    const saiS = (exS || []).filter((x) => limpaS.has(x.filial) && !querS.has(kS(x)));
    for (let i = 0; i < saiS.length; i += 80) await env.DB.batch(saiS.slice(i, i + 80).map((x) => env.DB.prepare('DELETE FROM gerot_supervisor_mes WHERE mes = ? AND filial = ? AND cod_sup = ?').bind(mesS, x.filial, x.cod_sup)));
    return r({ ok: true, mes: mesS, apagadas_sup: saiS.length, vigentes_sup: querS.size, filiais_limpas: [...limpaS], filiais_intactas: [...exFilS.keys()].filter((fl) => !limpaS.has(fl)) });
  }
  const SUP = Array.isArray(b.supervisores) ? b.supervisores : [];
  if (SUP.length > 200) return r({ erro: 'no maximo 200 supervisores por chamada' }, 400);
  if (SUP.length) {
    const sRuins = SUP.filter((x) => !MES.test(String(x.mes || '')) || !/^[A-Z]{3}$/.test(String(x.filial || '')) || !String(x.cod_sup || '').trim());
    if (sRuins.length) return r({ erro: 'supervisor sem mes/filial/cod_sup', exemplo: sRuins[0] }, 400);
    await env.DB.batch(SUP.map((x) => env.DB.prepare(
      'INSERT INTO gerot_supervisor_mes (mes, filial, cod_sup, supervisor, dados, hash, em) VALUES (?,?,?,?,?,?,?) ' +
      'ON CONFLICT (mes, filial, cod_sup) DO UPDATE SET supervisor = excluded.supervisor, dados = excluded.dados, hash = excluded.hash, em = excluded.em WHERE gerot_supervisor_mes.hash IS NOT excluded.hash'
    ).bind(String(x.mes), String(x.filial), String(x.cod_sup), x.supervisor || null, JSON.stringify(x.dados || {}), String(x.hash || ''), agora)));
  }
  const FIL = Array.isArray(b.filiais) ? b.filiais : [];
  if (FIL.length) {
    const fRuins = FIL.filter((x) => !MES.test(String(x.mes || '')) || !/^[A-Z]{3}$/.test(String(x.filial || '')));
    if (fRuins.length) return r({ erro: 'filial sem mes/filial', exemplo: fRuins[0] }, 400);
    await env.DB.batch(FIL.map((x) => env.DB.prepare(
      'INSERT INTO gerot_filial_mes (mes, filial, dados, hash, em) VALUES (?,?,?,?,?) ' +
      'ON CONFLICT (mes, filial) DO UPDATE SET dados = excluded.dados, hash = excluded.hash, em = excluded.em WHERE gerot_filial_mes.hash IS NOT excluded.hash'
    ).bind(String(x.mes), String(x.filial), JSON.stringify(x.dados || {}), String(x.hash || ''), agora)));
  }
  const RC = Array.isArray(b.recorrencia) ? b.recorrencia.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && /^(filial|supervisor|vendedor)$/.test(String(x.nivel || '')) && String(x.cod || '').trim()) : [];
  for (let i = 0; i < RC.length; i += 100) await env.DB.batch(RC.slice(i, i + 100).map((x) => env.DB.prepare(
    'INSERT INTO gerot_recorrencia_pasta (mes, filial, nivel, cod, nome, sup, objetivo, meta, positivados, faturado, pdvs_afat, vlr_afat, pdvs_vend, hash, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ' +
    'ON CONFLICT (mes, filial, nivel, cod, sup) DO UPDATE SET nome = excluded.nome, objetivo = excluded.objetivo, meta = excluded.meta, positivados = excluded.positivados, faturado = excluded.faturado, pdvs_afat = excluded.pdvs_afat, vlr_afat = excluded.vlr_afat, pdvs_vend = excluded.pdvs_vend, hash = excluded.hash, em = excluded.em WHERE gerot_recorrencia_pasta.hash IS NOT excluded.hash'
  ).bind(String(x.mes), String(x.filial), String(x.nivel), String(x.cod), x.nome || null, x.nivel === 'vendedor' && x.sup_cod != null ? String(x.sup_cod) : '', x.objetivo ?? null, x.meta ?? null, x.positivados ?? null, x.faturado ?? null, x.pdvs_afat ?? null, x.vlr_afat ?? null, x.pdvs_vend ?? null, String(x.hash || ''), agora)));
  if (b.status && MES.test(String(b.status.mes || ''))) {
    const s = b.status;
    const diaSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    if (String(s.mes) === diaSP.slice(0, 7)) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO liga_as_foto_dia (dia, filial, rca, meta, faturado, pendente, em)
         SELECT ?, filial, CAST(CAST(rca AS INTEGER) AS TEXT),
                SUM(COALESCE(json_extract(dados, '$."Meta (R$)"'), 0)),
                SUM(COALESCE(json_extract(dados, '$."Faturado líquido (R$)"'), 0)),
                SUM(COALESCE(json_extract(dados, '$."Carteira pendente (R$)"'), 0)),
                ?
           FROM gerot_vendedor_mes
          WHERE mes = ? AND rca NOT LIKE '%|%' AND CAST(rca AS INTEGER) > 0
          GROUP BY filial, CAST(CAST(rca AS INTEGER) AS TEXT)`
      ).bind(diaSP, agora, String(s.mes)).run().catch(() => {});
    }
    await env.DB.prepare('INSERT INTO gerot_coleta_status (mes, linhas, enviadas, posicao, colunas, em) VALUES (?,?,?,?,?,?)')
      .bind(String(s.mes), Number(s.linhas) || 0, Number(s.enviadas) || 0, String(s.posicao || ''), JSON.stringify(s.colunas || []).slice(0, 4000), agora).run();
    if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM gerot_coleta_status WHERE em < datetime('now','-30 days')").run();
  }
  if (b.controle && MES.test(String(b.controle.mes || ''))) {
    const c = b.controle;
    await env.DB.prepare('INSERT OR REPLACE INTO gerot_carga_controle (lote_id, mes, etapa, status, filiais, linhas, gravadas, removidas, posicao, detalhe, iniciado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(c.lote_id || agora).slice(0, 40), String(c.mes), String(c.etapa || 'geral').slice(0, 40), String(c.status || 'OK').slice(0, 20), Number(c.filiais) || 0, Number(c.linhas) || 0, Number(c.gravadas) || 0, Number(c.removidas) || 0, String(c.posicao || '').slice(0, 120), String(c.detalhe || '').slice(0, 200), String(c.iniciado_em || agora).slice(0, 40), agora).run();
    if (!L.length && !V.length && !SUP.length && !FIL.length && !RC.length && !b.status && !b.portao_contabil) return r({ ok: true, controle: true });
  }
  if (b.portao_contabil && MES.test(String(b.portao_contabil.mes || ''))) {
    const pc = b.portao_contabil, mes = String(pc.mes), loteId = String(pc.lote_id || agora).slice(0, 40), linhasN = Number(pc.linhas) || 0;
    const diaSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const [rFil, rVend, rForn, rPrev] = await Promise.all([
      env.DB.prepare('SELECT filial, json_extract(dados, \'$."Faturado líquido (R$)"\') fat FROM gerot_filial_mes WHERE mes = ?').bind(mes).all(),
      env.DB.prepare('SELECT filial, SUM(COALESCE(json_extract(dados, \'$."Faturado líquido (R$)"\'), 0)) fat, SUM(CASE WHEN COALESCE(json_extract(dados, \'$."Faturado líquido (R$)"\'), 0) > 0 AND json_extract(dados, \'$."Meta (R$)"\') IS NULL THEN 1 ELSE 0 END) meta_null FROM gerot_vendedor_mes WHERE mes = ? GROUP BY filial').bind(mes).all(),
      env.DB.prepare('SELECT filial, SUM(COALESCE(json_extract(dados, \'$."Faturado líquido (R$)"\'), 0)) fat FROM gerot_vendas WHERE mes = ? GROUP BY filial').bind(mes).all(),
      env.DB.prepare('SELECT linhas FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first().catch(() => null)
    ]);
    const mV = new Map((rVend.results || []).map((x) => [x.filial, x]));
    const mF = new Map((rForn.results || []).map((x) => [x.filial, x]));
    const motivos = [], diffs = [];
    const fils = rFil.results || [];
    if (!fils.length) motivos.push('sem gerot_filial_mes');
    for (const f of fils) {
      const fFat = Number(f.fat) || 0, v = mV.get(f.filial) || { fat: 0, meta_null: 0 }, fr = mF.get(f.filial) || { fat: 0 };
      const dV = Math.abs(fFat - (Number(v.fat) || 0)), dF = Math.abs(fFat - (Number(fr.fat) || 0));
      if (dV > 5 || dF > 5) diffs.push(`${f.filial}:dv=${dV.toFixed(2)},df=${dF.toFixed(2)}`);
    }
    if (diffs.length) motivos.push('divergencia_filial:' + diffs.join(';'));
    if (diaSP.slice(8, 10) > '05' && rPrev && Number(rPrev.linhas) > 100 && linhasN > 0 && linhasN < Number(rPrev.linhas) * 0.85) {
      motivos.push(`linhas ${linhasN} < 85% anterior ${rPrev.linhas}`);
    }
    const aprovado = motivos.length === 0;
    if (aprovado || pc.forcar) {
      if (mes === diaSP.slice(0, 7)) {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO liga_as_foto_dia (dia, filial, rca, meta, faturado, pendente, em)
           SELECT ?, filial, CAST(CAST(rca AS INTEGER) AS TEXT),
                  SUM(COALESCE(json_extract(dados, '$."Meta (R$)"'), 0)),
                  SUM(COALESCE(json_extract(dados, '$."Faturado líquido (R$)"'), 0)),
                  SUM(COALESCE(json_extract(dados, '$."Carteira pendente (R$)"'), 0)),
                  ?
             FROM gerot_vendedor_mes
            WHERE mes = ? AND rca NOT LIKE '%|%' AND CAST(rca AS INTEGER) > 0
            GROUP BY filial, CAST(CAST(rca AS INTEGER) AS TEXT)`
        ).bind(diaSP, agora, mes).run().catch(() => {});
      }
      await env.DB.prepare('INSERT INTO gerot_coleta_status (mes, linhas, enviadas, posicao, colunas, em) VALUES (?,?,?,?,?,?)')
        .bind(mes, linhasN, Number(pc.enviadas) || 0, String(pc.posicao || ''), JSON.stringify(pc.colunas || []).slice(0, 4000), agora).run();
      await env.DB.prepare("INSERT OR REPLACE INTO config_flags (chave, valor) VALUES ('gerot_versao_ativa', ?)")
        .bind(JSON.stringify({ carga_id: loteId, mes, posicao: String(pc.posicao || ''), gerado_em: agora })).run();
      await env.DB.prepare('INSERT OR REPLACE INTO gerot_carga_controle (lote_id, mes, etapa, status, filiais, linhas, gravadas, removidas, posicao, detalhe, iniciado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(loteId, mes, 'portao_contabil', aprovado ? 'OK' : 'FORCADO', fils.length, linhasN, Number(pc.enviadas) || 0, 0, String(pc.posicao || '').slice(0, 120), motivos.join(' | ').slice(0, 200), String(pc.iniciado_em || agora).slice(0, 40), agora).run();
      return r({ ok: true, aprovado, forcou: !aprovado && !!pc.forcar, carga_id: loteId, filiais: fils.length, motivos });
    }
    await env.DB.prepare('INSERT OR REPLACE INTO gerot_carga_controle (lote_id, mes, etapa, status, filiais, linhas, gravadas, removidas, posicao, detalhe, iniciado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(loteId, mes, 'portao_contabil', 'BLOQUEADO_PORTAO', fils.length, linhasN, 0, 0, String(pc.posicao || '').slice(0, 120), motivos.join(' | ').slice(0, 200), String(pc.iniciado_em || agora).slice(0, 40), agora).run();
    return r({ ok: false, bloqueado: true, motivos });
  }
  const emLotes = async (lista, fn) => { for (let i = 0; i < lista.length; i += 80) await env.DB.batch(lista.slice(i, i + 80).map(fn)); };
  const nz = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const tz = (v, n = 120) => (v == null || v === '' ? null : String(v).slice(0, n));
  if (Array.isArray(b.dim_agregado)) {
    const ok = b.dim_agregado.filter((x) => MES.test(String(x.mes || '')) && x.dim && x.chave != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT INTO gerot_dim_agregado (mes, dim, filial, chave, nome, dados, hash, em) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (mes, dim, filial, chave) DO UPDATE SET nome = excluded.nome, dados = excluded.dados, hash = excluded.hash, em = excluded.em WHERE gerot_dim_agregado.hash IS NOT excluded.hash')
      .bind(String(x.mes), String(x.dim).slice(0, 30), String(x.filial || '').slice(0, 3), String(x.chave).slice(0, 120), tz(x.nome), JSON.stringify(x.dados || {}), String(x.hash || ''), agora));
    return r({ ok: true, dim_agregado: ok.length });
  }
  if (Array.isArray(b.cliven_resumo)) {
    if (MES.test(String(b.cliven_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_cliven_resumo WHERE mes = ?').bind(String(b.cliven_limpar_mes)).run();
    const ok = b.cliven_resumo.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && x.rca != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_cliven_resumo (mes, filial, cod_sup, rca, vendedor, supervisor, gerente, perfil, clientes_carteira, clientes_ativos, clientes_bloq, positivados, aproveitamento_pct, fat_mes, m1, media_3m, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial), String(x.cod_sup || ''), String(x.rca), tz(x.vendedor), tz(x.supervisor), tz(x.gerente), tz(x.perfil, 40), nz(x.clientes_carteira), nz(x.clientes_ativos), nz(x.clientes_bloq), nz(x.positivados), nz(x.aproveitamento_pct), nz(x.fat_mes), nz(x.m1), nz(x.media_3m), agora));
    return r({ ok: true, cliven_resumo: ok.length });
  }
  if (Array.isArray(b.fefo)) {
    if (b.fefo_limpar) await env.DB.prepare('DELETE FROM gerot_fefo').run();
    const ok = b.fefo.filter((x) => /^[A-Z]{3}$/.test(String(x.filial || '')) && x.sku != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_fefo (filial, sku, lote, produto, fornecedor, depto, secao, marca, faixa, validade, dias_vencer, pct_vida, saldo, valor, venda_90d, cobertura_dias, risco, quarentena, acao_sugerida, prox_faixa_30, prox_faixa_60, prox_faixa_90, carga, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.filial), String(x.sku), String(x.lote || ''), tz(x.produto), tz(x.fornecedor), tz(x.depto, 60), tz(x.secao, 60), tz(x.marca, 60), tz(x.faixa, 30), tz(x.validade, 15), nz(x.dias_vencer), nz(x.pct_vida), nz(x.saldo), nz(x.valor), nz(x.venda_90d), nz(x.cobertura_dias), x.risco ? 1 : 0, x.quarentena ? 1 : 0, tz(x.acao_sugerida, 160), tz(x.prox_faixa_30, 30), tz(x.prox_faixa_60, 30), tz(x.prox_faixa_90, 30), tz(x.carga, 30), agora));
    return r({ ok: true, fefo: ok.length });
  }
  if (Array.isArray(b.est_winthor)) {
    if (b.est_winthor_limpar) await env.DB.prepare('DELETE FROM gerot_est_winthor').run();
    const ok = b.est_winthor.filter((x) => /^[A-Z]{3}$/.test(String(x.filial || '')) && x.sku != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_est_winthor (filial, sku, produto, fornecedor, depto, secao, dias_estoque, valor, caixas, peso_kg, disponivel, estoque, reservado, bloqueado, parado_90d, ruptura, curva_abc, carga, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.filial), String(x.sku), tz(x.produto), tz(x.fornecedor), tz(x.depto, 60), tz(x.secao, 60), nz(x.dias_estoque), nz(x.valor), nz(x.caixas), nz(x.peso_kg), nz(x.disponivel), nz(x.estoque), nz(x.reservado), nz(x.bloqueado), x.parado_90d ? 1 : 0, x.ruptura ? 1 : 0, tz(x.curva_abc, 10), tz(x.carga, 30), agora));
    return r({ ok: true, est_winthor: ok.length });
  }
  if (Array.isArray(b.dre_mes)) {
    if (MES.test(String(b.dre_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_dre_mes WHERE mes = ?').bind(String(b.dre_limpar_mes)).run();
    const ok = b.dre_mes.filter((x) => MES.test(String(x.mes || '')) && x.filial != null && x.nivel && x.cod != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_dre_mes (mes, filial, nivel, cod, nome, caixas, peso_kg, fat_bruto, devolucao, receita_liq, cmv, comissao, bonif_custo, impostos, custos_var, mc_rs, mc_pct, desconto_rs, desc_pct, preco_tabela, desc_politica, desc_campanha, desc_pol_encerrada, desc_comercial, acima_tabela, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial).slice(0, 10), String(x.nivel).slice(0, 20), String(x.cod).slice(0, 60), tz(x.nome), nz(x.caixas), nz(x.peso_kg), nz(x.fat_bruto), nz(x.devolucao), nz(x.receita_liq), nz(x.cmv), nz(x.comissao), nz(x.bonif_custo), nz(x.impostos), nz(x.custos_var), nz(x.mc_rs), nz(x.mc_pct), nz(x.desconto_rs), nz(x.desc_pct), nz(x.preco_tabela), nz(x.desc_politica), nz(x.desc_campanha), nz(x.desc_pol_encerrada), nz(x.desc_comercial), nz(x.acima_tabela), agora));
    return r({ ok: true, dre_mes: ok.length });
  }
  if (Array.isArray(b.curva_neg_margem)) {
    if (MES.test(String(b.curva_neg_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_curva_neg_margem WHERE mes = ?').bind(String(b.curva_neg_limpar_mes)).run();
    const ok = b.curva_neg_margem.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && x.pedido != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_curva_neg_margem (mes, filial, pedido, nf, data, rca, vendedor, sup_cod, cliente, cnpj, itens, fat_bruto, desconto_pct, custo, margem_rs, margem_pct, margem_perdida, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial), String(x.pedido), String(x.nf || ''), tz(x.data, 10), tz(x.rca, 20), tz(x.vendedor), tz(x.sup_cod, 20), tz(x.cliente), tz(x.cnpj, 20), nz(x.itens), nz(x.fat_bruto), nz(x.desconto_pct), nz(x.custo), nz(x.margem_rs), nz(x.margem_pct), nz(x.margem_perdida), agora));
    return r({ ok: true, curva_neg_margem: ok.length });
  }
  if (Array.isArray(b.histograma_margem)) {
    if (MES.test(String(b.hist_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_histograma_margem WHERE mes = ?').bind(String(b.hist_limpar_mes)).run();
    const ok = b.histograma_margem.filter((x) => MES.test(String(x.mes || '')) && x.filial != null && x.tipo && x.faixa).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_histograma_margem (mes, filial, tipo, faixa, itens, fat_bruto, margem_rs, margem_pct, em) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial).slice(0, 10), String(x.tipo).slice(0, 30), String(x.faixa).slice(0, 40), nz(x.itens), nz(x.fat_bruto), nz(x.margem_rs), nz(x.margem_pct), agora));
    return r({ ok: true, histograma_margem: ok.length });
  }
  if (Array.isArray(b.rfv_resumo)) {
    if (MES.test(String(b.rfv_res_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_rfv_resumo WHERE mes = ?').bind(String(b.rfv_res_limpar_mes)).run();
    const ok = b.rfv_resumo.filter((x) => MES.test(String(x.mes || '')) && x.filial != null && x.segmento).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_rfv_resumo (mes, filial, sup_cod, rca, segmento, clientes, valor_120d, em) VALUES (?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial).slice(0, 10), String(x.sup_cod || ''), String(x.rca || ''), String(x.segmento).slice(0, 40), nz(x.clientes), nz(x.valor_120d), agora));
    return r({ ok: true, rfv_resumo: ok.length });
  }
  if (Array.isArray(b.rfv_clientes)) {
    if (MES.test(String(b.rfv_cli_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_rfv_clientes WHERE mes = ?').bind(String(b.rfv_cli_limpar_mes)).run();
    const ok = b.rfv_clientes.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && x.rca != null && x.cliente != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_rfv_clientes (mes, filial, rca, sup_cod, cliente, cnpj, nome, segmento, r_score, f_score, v_score, dias_sem_compra, valor_120d, ultima_compra, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial), String(x.rca), tz(x.sup_cod, 20), String(x.cliente), tz(x.cnpj, 20), tz(x.nome), tz(x.segmento, 40), nz(x.r_score), nz(x.f_score), nz(x.v_score), nz(x.dias_sem_compra), nz(x.valor_120d), tz(x.ultima_compra, 15), agora));
    return r({ ok: true, rfv_clientes: ok.length });
  }
  if (Array.isArray(b.pmi_mes)) {
    if (MES.test(String(b.pmi_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_pmi_mes WHERE mes = ?').bind(String(b.pmi_limpar_mes)).run();
    const ok = b.pmi_mes.filter((x) => MES.test(String(x.mes || '')) && x.filial != null && x.nivel && x.cod != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_pmi_mes (mes, filial, nivel, cod, nome, ja_compra, pmi_historico, pmi_mix, reativar, recuperar, aumentar_mix, desenvolver_share, abrir_novos, potencial_total, clientes_ativos, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial).slice(0, 10), String(x.nivel).slice(0, 20), String(x.cod).slice(0, 60), tz(x.nome), nz(x.ja_compra), nz(x.pmi_historico), nz(x.pmi_mix), nz(x.reativar), nz(x.recuperar), nz(x.aumentar_mix), nz(x.desenvolver_share), nz(x.abrir_novos), nz(x.potencial_total), nz(x.clientes_ativos), agora));
    return r({ ok: true, pmi_mes: ok.length });
  }
  if (Array.isArray(b.cadastro_clientes)) {
    if (MES.test(String(b.cad_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_cadastro_clientes WHERE mes = ?').bind(String(b.cad_limpar_mes)).run();
    const ok = b.cadastro_clientes.filter((x) => MES.test(String(x.mes || '')) && x.filial != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_cadastro_clientes (mes, filial, sup_cod, rca, cadastrados, cadastrados_dia, ja_compraram, pct_primeira_compra, bloqueados, excluidos, saldo, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial).slice(0, 10), String(x.sup_cod || ''), String(x.rca || ''), nz(x.cadastrados), nz(x.cadastrados_dia), nz(x.ja_compraram), nz(x.pct_primeira_compra), nz(x.bloqueados), nz(x.excluidos), nz(x.saldo), agora));
    return r({ ok: true, cadastro_clientes: ok.length });
  }
  if (Array.isArray(b.recorrencia_faixas)) {
    if (MES.test(String(b.rec_fx_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_recorrencia_faixas WHERE mes = ?').bind(String(b.rec_fx_limpar_mes)).run();
    const ok = b.recorrencia_faixas.filter((x) => MES.test(String(x.mes || '')) && x.filial != null && x.faixa).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_recorrencia_faixas (mes, filial, sup_cod, rca, faixa, clientes, valor_3m, em) VALUES (?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial).slice(0, 10), String(x.sup_cod || ''), String(x.rca || ''), String(x.faixa).slice(0, 30), nz(x.clientes), nz(x.valor_3m), agora));
    return r({ ok: true, recorrencia_faixas: ok.length });
  }
  if (Array.isArray(b.recorrencia_clientes)) {
    if (MES.test(String(b.rec_cli_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_recorrencia_clientes WHERE mes = ?').bind(String(b.rec_cli_limpar_mes)).run();
    const ok = b.recorrencia_clientes.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && x.rca != null && x.cliente != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_recorrencia_clientes (mes, filial, rca, cliente, cnpj, nome, dias_sem_compra, ultima_compra, fat_mes, captado, carteira, faixa, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial), String(x.rca), String(x.cliente), tz(x.cnpj, 20), tz(x.nome), nz(x.dias_sem_compra), tz(x.ultima_compra, 15), nz(x.fat_mes), nz(x.captado), nz(x.carteira), tz(x.faixa, 30), agora));
    return r({ ok: true, recorrencia_clientes: ok.length });
  }
  if (Array.isArray(b.campo_mes)) {
    if (MES.test(String(b.campo_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_campo_mes WHERE mes = ?').bind(String(b.campo_limpar_mes)).run();
    const ok = b.campo_mes.filter((x) => MES.test(String(x.mes || '')) && x.filial != null && x.nivel && x.cod != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_campo_mes (mes, filial, nivel, cod, nome, sup_cod, eficiencia_pct, eficacia_pct, hora_checkin, hora_checkout, min_visita, min_rota, hora_ped1, pct_ped18, venda_captada, pedidos_captados, venda_sem_visita, pct_sem_visita, cobertura_pdv_pct, carteira_visitada_pct, gerado_em, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial).slice(0, 10), String(x.nivel).slice(0, 20), String(x.cod).slice(0, 60), tz(x.nome), String(x.sup_cod || ''), nz(x.eficiencia_pct), nz(x.eficacia_pct), tz(x.hora_checkin, 10), tz(x.hora_checkout, 10), nz(x.min_visita), nz(x.min_rota), tz(x.hora_ped1, 10), nz(x.pct_ped18), nz(x.venda_captada), nz(x.pedidos_captados), nz(x.venda_sem_visita), nz(x.pct_sem_visita), nz(x.cobertura_pdv_pct), nz(x.carteira_visitada_pct), tz(x.gerado_em, 30), agora));
    return r({ ok: true, campo_mes: ok.length });
  }
  if (Array.isArray(b.jbp_sku)) {
    if (MES.test(String(b.jbp_limpar_mes || ''))) await env.DB.prepare('DELETE FROM gerot_jbp_sku WHERE mes = ?').bind(String(b.jbp_limpar_mes)).run();
    const ok = b.jbp_sku.filter((x) => MES.test(String(x.mes || '')) && /^[A-Z]{3}$/.test(String(x.filial || '')) && x.sku != null).slice(0, 300);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO gerot_jbp_sku (mes, filial, fornecedor, forn_cod, sku, produto, fat_liq, meta, fat_m1, delta_m1, fat_3m, fat_a1, fat_ytd, fat_lytd, pos, bench, em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(String(x.mes), String(x.filial), tz(x.fornecedor), tz(x.forn_cod, 40), String(x.sku), tz(x.produto), nz(x.fat_liq), nz(x.meta), nz(x.fat_m1), nz(x.delta_m1), nz(x.fat_3m), nz(x.fat_a1), nz(x.fat_ytd), nz(x.fat_lytd), nz(x.pos), nz(x.bench), agora));
    return r({ ok: true, jbp_sku: ok.length });
  }
  if (Array.isArray(b.briefing_cache)) {
    const ok = b.briefing_cache.filter((x) => x.chave && MES.test(String(x.mes || '')) && x.payload_json).slice(0, 40);
    await emLotes(ok, (x) => env.DB.prepare('INSERT OR REPLACE INTO fatos_briefing_cache (chave, mes, carga_id, nivel, filial, payload_json, tokens_est, gerado_em) VALUES (?,?,?,?,?,?,?,?)')
      .bind(String(x.chave).slice(0, 40), String(x.mes), String(x.carga_id || agora).slice(0, 40), String(x.nivel || 'filial').slice(0, 20), tz(x.filial, 10), typeof x.payload_json === 'string' ? x.payload_json : JSON.stringify(x.payload_json), nz(x.tokens_est), String(x.gerado_em || agora)));
    return r({ ok: true, briefing_cache: ok.length });
  }
  return r({ ok: true, linhas: L.length, vendedores: V.length, supervisores: SUP.length, filiais: FIL.length, recorrencia: RC.length });
}
