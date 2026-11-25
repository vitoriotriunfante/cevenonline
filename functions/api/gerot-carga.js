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
    const limpa = new Set([...porFil].filter(([, n]) => n >= 10).map(([fl]) => fl));
    const sai = (ex || []).filter((x) => limpa.has(x.filial) && !quer.has(k(x)));
    for (let i = 0; i < sai.length; i += 80) await env.DB.batch(sai.slice(i, i + 80).map((x) => env.DB.prepare('DELETE FROM gerot_vendedor_mes WHERE mes = ? AND filial = ? AND rca = ? AND cod_sup = ?').bind(mes, x.filial, x.rca, x.cod_sup == null ? '' : x.cod_sup)));
    return r({ ok: true, mes, apagadas_vend: sai.length, vigentes_vend: quer.size, filiais_limpas: [...limpa], filiais_intactas: [...exFil.keys()].filter((fl) => !limpa.has(fl)) });
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
    if (!L.length && !V.length && !SUP.length && !FIL.length && !RC.length && !b.status) return r({ ok: true, controle: true });
  }
  return r({ ok: true, linhas: L.length, vendedores: V.length, supervisores: SUP.length, filiais: FIL.length, recorrencia: RC.length });
}
