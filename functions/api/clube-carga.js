// =========================================================================
// FICHA DO ARQUIVO: functions/api/clube-carga.js (POST /api/clube-carga, header X-Evo-Key)
// O QUE É: recebe do coletor do Clube da Venda (pipeline/clube_coletor.mjs)
//   vendedores do dia, check-in/out e justificativas e grava no D1 de forma idempotente.
// Nao chama o CEVEN.
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';

const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: J });

// GET ?roteiro_dia=AAAA-MM-DD -> quando a rota do dia foi lida (o coletor so rele depois de 3 h)
// GET ?status_dia=AAAA-MM-DD  -> ultima leitura gravada em clube_venda_dia para conferir se o dia anterior fechou apos a meia-noite BRT
export async function onRequestGet({ request, env }) {
  if (!(await chaveEvoValida(request, env))) return resp({ erro: 'nao autorizado' }, 401);
  const u = new URL(request.url);
  const sd = u.searchParams.get('status_dia') || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(sd)) {
    try {
      const r = await env.DB.prepare('SELECT MAX(lido_em) lido_em, COUNT(*) vendedores FROM clube_venda_dia WHERE dia = ?').bind(sd).first();
      return resp({ dia: sd, lido_em: (r && r.lido_em) || null, vendedores: Number(r && r.vendedores) || 0 });
    } catch (e) { return resp({ dia: sd, lido_em: null, vendedores: 0 }); }
  }
  const d = u.searchParams.get('roteiro_dia') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return resp({ erro: 'roteiro_dia obrigatorio' }, 400);
  try { return resp((await env.DB.prepare('SELECT dia, filiais, linhas, lido_em FROM clube_roteiro_leitura WHERE dia = ?').bind(d).first()) || { dia: d, filiais: 0 }); } catch (e) { return resp({ dia: d, filiais: 0 }); }
}

export async function onRequestPost({ request, env }) {
  if (!(await chaveEvoValida(request, env))) return resp({ erro: 'nao autorizado' }, 401);
  let body = {};
  try { body = await request.json(); } catch { return resp({ erro: 'json invalido' }, 400); }
  const dia = String(body.dia || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return resp({ erro: 'dia obrigatorio (AAAA-MM-DD)' }, 400);
  const lidoEm = String(body.lido_em || new Date().toISOString());
  const db = env.DB;

  const cols = ['total_pedido', 'total_faturado', 'roteiros', 'visitas_rota', 'ped_rota', 'ped_fora', 'ped_total', 'media_sku', 'eficiencia', 'eficacia'];
  const stmts = [];

  for (const v of body.vendedores || []) {
    if (!v || !v.filial || !v.rca) continue;
    stmts.push(
      db.prepare(`INSERT INTO clube_venda_dia (dia, filial, rca, sup_cod, nome, ${cols.join(', ')}, lido_em, mudou_em) VALUES (${new Array(7 + cols.length).fill('?').join(',')}) ON CONFLICT (dia, filial, rca) DO UPDATE SET sup_cod = excluded.sup_cod, nome = excluded.nome, ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}, lido_em = excluded.lido_em, mudou_em = excluded.mudou_em WHERE ${cols.map((c) => `coalesce(clube_venda_dia.${c}, -1e9) <> coalesce(excluded.${c}, -1e9)`).join(' OR ')}`)
        .bind(dia, String(v.filial), String(v.rca), v.sup_cod || null, v.nome || null, ...cols.map((c) => v[c] ?? null), lidoEm, lidoEm)
    );
  }
  const chavesVend = [...new Set((body.vendedores || []).filter((v) => v && v.filial && v.rca).map((v) => `${v.filial}|${v.rca}`))];
  for (let i = 0; i < chavesVend.length; i += 40) {
    const ch = chavesVend.slice(i, i + 40);
    stmts.push(
      db.prepare(`UPDATE clube_venda_dia SET lido_em = ? WHERE dia = ? AND (filial || '|' || rca) IN (${ch.map(() => '?').join(',')})`)
        .bind(lidoEm, dia, ...ch)
    );
  }
  for (const c of body.checkins || []) {
    if (!c || !c.codigo || !c.rca) continue;
    stmts.push(
      db.prepare('INSERT OR IGNORE INTO clube_checkin (codigo, dia, filial, rca, nome, tipo, data_hora, cliente, cnpj, razao, fantasia) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .bind(String(c.codigo), dia, c.filial || null, String(c.rca), c.nome || null, c.tipo || null, c.data_hora || null, c.cliente || null, c.cnpj || null, c.razao || null, c.fantasia || null)
    );
  }
  for (const j of body.justificativas || []) {
    if (!j || !j.id) continue;
    stmts.push(
      db.prepare('INSERT OR IGNORE INTO clube_justificativa (id, dia, filial, sup_cod, rca, nome, cliente, cnpj, razao, fantasia, dias_sem_comprar, motivo, data_hora, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(String(j.id), /^\d{4}-\d{2}-\d{2}/.test(String(j.data_hora || '')) ? String(j.data_hora).slice(0, 10) : dia, j.filial || null,   /* 21/11/2026: dia = quando a justificativa foi feita (antes: dia da coleta; 324 no dia errado e penalti com justificativa de outubro) */ j.sup_cod || null, j.rca || null, j.nome || null, j.cliente || null, j.cnpj || null, j.razao || null, j.fantasia || null, j.dias_sem_comprar ?? null, j.motivo || null, j.data_hora || null, j.obs || null)
    );
  }
  // 17/11/2026: PEDIDOS DO DIA do Clube (Relatorio de Pedido): um por pedido, so grava o que mudou
  if (Array.isArray(body.pedidos) && body.pedidos.length) {
    await db.prepare('CREATE TABLE IF NOT EXISTS clube_pedido (filial TEXT NOT NULL, pedido TEXT NOT NULL, dia TEXT, rca TEXT, id TEXT, pedido_winthor TEXT, cliente TEXT, razao TEXT, total REAL, confirmado TEXT, sincronizado TEXT, origem TEXT, tipo_bloqueio TEXT, data_inicial TEXT, data_emissao TEXT, data_recebimento TEXT, data_liberacao TEXT, hash TEXT, lido_em TEXT, PRIMARY KEY (filial, pedido))').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS ix_clube_pedido_dia ON clube_pedido (dia, filial, rca, cliente)').run();
    for (const x of body.pedidos) {
      if (!x || !x.filial || !(x.pedido || x.id)) continue;
      const h = [x.pedido_winthor, x.total, x.confirmado, x.sincronizado, x.tipo_bloqueio, x.data_emissao, x.data_liberacao, x.cliente, x.rca].join('|');
      stmts.push(db.prepare('INSERT INTO clube_pedido (filial, pedido, dia, rca, id, pedido_winthor, cliente, razao, total, confirmado, sincronizado, origem, tipo_bloqueio, data_inicial, data_emissao, data_recebimento, data_liberacao, hash, lido_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (filial, pedido) DO UPDATE SET rca = excluded.rca, pedido_winthor = excluded.pedido_winthor, cliente = excluded.cliente, razao = excluded.razao, total = excluded.total, confirmado = excluded.confirmado, sincronizado = excluded.sincronizado, origem = excluded.origem, tipo_bloqueio = excluded.tipo_bloqueio, data_emissao = excluded.data_emissao, data_recebimento = excluded.data_recebimento, data_liberacao = excluded.data_liberacao, hash = excluded.hash, lido_em = excluded.lido_em WHERE clube_pedido.hash IS NOT excluded.hash')
        .bind(String(x.filial), String(x.pedido || 'ID' + x.id), dia, x.rca || null, x.id ? String(x.id) : null, x.pedido_winthor || null, x.cliente || null, x.razao ? String(x.razao).slice(0, 120) : null, Number(x.total) || 0, x.confirmado || null, x.sincronizado || null, x.origem || null, x.tipo_bloqueio || null, x.data_inicial || null, x.data_emissao || null, x.data_recebimento || null, x.data_liberacao || null, h, lidoEm));
    }
  }
  // 18/11/2026: ROTA DO DIA COM OS NOMES (Clube, Roteiro Consolidado Geral) — so grava o que mudou; sai da tabela quem saiu da rota da filial lida
  let rot = null;
  if (Array.isArray(body.roteiro) && Array.isArray(body.roteiro_filiais) && body.roteiro_filiais.length) {
    await db.prepare('CREATE TABLE IF NOT EXISTS clube_roteiro (dia TEXT NOT NULL, filial TEXT NOT NULL, rca TEXT NOT NULL, cliente TEXT NOT NULL, nome TEXT, cnpj TEXT, razao TEXT, fantasia TEXT, cidade TEXT, bairro TEXT, endereco TEXT, recorrencia TEXT, dia_semana TEXT, hash TEXT, lido_em TEXT, PRIMARY KEY (dia, filial, rca, cliente))').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS ix_clube_roteiro_cli ON clube_roteiro (dia, filial, cliente)').run();
    const novos = new Set(), rs = [];
    for (const x of body.roteiro) {
      if (!x || !x.filial || !x.rca || !x.cliente) continue;
      const k = x.filial + '|' + x.rca + '|' + x.cliente; if (novos.has(k)) continue; novos.add(k);
      const h = [x.nome, x.razao, x.fantasia, x.cidade, x.bairro, x.endereco, x.recorrencia].join('|');
      rs.push(db.prepare('INSERT INTO clube_roteiro (dia, filial, rca, cliente, nome, cnpj, razao, fantasia, cidade, bairro, endereco, recorrencia, dia_semana, hash, lido_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (dia, filial, rca, cliente) DO UPDATE SET nome = excluded.nome, cnpj = excluded.cnpj, razao = excluded.razao, fantasia = excluded.fantasia, cidade = excluded.cidade, bairro = excluded.bairro, endereco = excluded.endereco, recorrencia = excluded.recorrencia, dia_semana = excluded.dia_semana, hash = excluded.hash, lido_em = excluded.lido_em WHERE clube_roteiro.hash IS NOT excluded.hash')
        .bind(dia, String(x.filial), String(x.rca), String(x.cliente), x.nome || null, x.cnpj || null, x.razao ? String(x.razao).slice(0, 120) : null, x.fantasia ? String(x.fantasia).slice(0, 120) : null, x.cidade || null, x.bairro || null, x.endereco ? String(x.endereco).slice(0, 160) : null, x.recorrencia || null, x.dia_semana || null, h, lidoEm));
    }
    const F = body.roteiro_filiais.map(String);
    const { results: ex } = await db.prepare(`SELECT filial, rca, cliente FROM clube_roteiro WHERE dia = ? AND filial IN (${F.map(() => '?').join(',')})`).bind(dia, ...F).all();
    const sai = (ex || []).filter((r) => !novos.has(r.filial + '|' + r.rca + '|' + r.cliente));
    for (const r of sai) rs.push(db.prepare('DELETE FROM clube_roteiro WHERE dia = ? AND filial = ? AND rca = ? AND cliente = ?').bind(dia, r.filial, r.rca, r.cliente));
    for (let i = 0; i < rs.length; i += 80) await db.batch(rs.slice(i, i + 80));
    // marca da leitura (1 linha por dia): o coletor so rele depois de 3 h
    const totR = await db.prepare('SELECT COUNT(DISTINCT filial) f, COUNT(*) n FROM clube_roteiro WHERE dia = ?').bind(dia).first().catch(() => null);
    await db.prepare('CREATE TABLE IF NOT EXISTS clube_roteiro_leitura (dia TEXT PRIMARY KEY, filiais INTEGER, linhas INTEGER, lido_em TEXT)').run();
    await db.prepare('INSERT INTO clube_roteiro_leitura (dia, filiais, linhas, lido_em) VALUES (?,?,?,?) ON CONFLICT (dia) DO UPDATE SET filiais = excluded.filiais, linhas = excluded.linhas, lido_em = excluded.lido_em').bind(dia, Number(totR && totR.f) || F.length, Number(totR && totR.n) || novos.size, new Date().toISOString()).run();
    // conferencia: o vendedor da rota existe no Relatorio de Vendas do Clube na mesma filial?
    let conf = null; try { conf = (await db.prepare("SELECT COUNT(DISTINCT r.filial || '|' || r.rca) n, COUNT(DISTINCT CASE WHEN v.rca IS NOT NULL THEN r.filial || '|' || r.rca END) ok FROM clube_roteiro r LEFT JOIN clube_venda_dia v ON v.dia = r.dia AND v.filial = r.filial AND v.rca = r.rca WHERE r.dia = ?").bind(dia).first()); } catch (e) { /* sem conferencia */ }
    rot = { linhas: novos.size, sairam: sai.length, filiais: F.length, vendedores: conf && conf.n, batem_relatorio_vendas: conf && conf.ok };
  }
  if (body.rodada) {
    const rd = body.rodada;
    stmts.push(
      db.prepare('INSERT INTO clube_rodada (dia, lido_em, vendedores, checkins, justificativas, nao_sinc, falhas, duracao_s) VALUES (?,?,?,?,?,?,?,?)')
        .bind(dia, lidoEm, rd.vendedores ?? null, rd.checkins ?? null, rd.justificativas ?? null, rd.nao_sinc ?? null, rd.falhas || '', rd.duracao_s ?? null)
    );
  }

  for (let i = 0; i < stmts.length; i += 40) {
    await db.batch(stmts.slice(i, i + 40));
  }
  // 17/11/2026: pedido_status (lido por ~15 respostas do JOTA) volta a ter dado: pedido do Clube + status do GEROT
  let sinc = null;
  if (Array.isArray(body.pedidos) && body.pedidos.length && !body.sem_sync_status) { try { const { sincronizaPedidoStatus } = await import('../_lib/pedido_status_fontes.js'); sinc = await sincronizaPedidoStatus(env, dia);   /* so o dia (17/11: 7 dias de uma vez sobrecarregou o D1 logo apos a carga) */ } catch (e) { sinc = { erro: String(e && e.message || e).slice(0, 160) }; } }
  return resp({ ok: true, dia, gravados: stmts.length, pedido_status: sinc, roteiro: rot });
}

