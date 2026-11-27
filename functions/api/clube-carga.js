// =========================================================================
// FICHA DO ARQUIVO: functions/api/clube-carga.js (POST/GET /api/clube-carga, header X-Evo-Key)
// O QUE É: recebe do coletor do Clube da Venda (clube_motor_coleta.mjs / clube_coletor.mjs)
//   vendedores, fornecedores ao vivo, acompanhamento diario, pedidos (29 cols), check-in/out,
//   justificativas e roteiro, gravando no D1 por Delta-by-Hash sem DDL em runtime.
// Nao chama o CEVEN. Schema gerenciado exclusivamente via migrations/0017_clube_completo.sql.
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
    } catch { return resp({ dia: sd, lido_em: null, vendedores: 0 }); }
  }
  const d = u.searchParams.get('roteiro_dia') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return resp({ erro: 'roteiro_dia obrigatorio' }, 400);
  try { return resp((await env.DB.prepare('SELECT dia, filiais, linhas, lido_em FROM clube_roteiro_leitura WHERE dia = ?').bind(d).first()) || { dia: d, filiais: 0 }); } catch { return resp({ dia: d, filiais: 0 }); }
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

  for (const f of body.fornecedores_dia || []) {
    if (!f || !f.filial || !f.fornecedor) continue;
    const h = [f.venda, f.pct_venda, f.positivacao, f.pct_positivacao, f.skus, f.skus_total, f.skus_vendidos, f.filiais_lista].join('|');
    stmts.push(
      db.prepare('INSERT INTO clube_fornecedor_dia (dia, filial, fornecedor, venda, pct_venda, positivacao, pct_positivacao, skus, skus_total, skus_vendidos, filiais_lista, hash, lido_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (dia, filial, fornecedor) DO UPDATE SET venda = excluded.venda, pct_venda = excluded.pct_venda, positivacao = excluded.positivacao, pct_positivacao = excluded.pct_positivacao, skus = excluded.skus, skus_total = excluded.skus_total, skus_vendidos = excluded.skus_vendidos, filiais_lista = excluded.filiais_lista, hash = excluded.hash, lido_em = excluded.lido_em WHERE clube_fornecedor_dia.hash IS NOT excluded.hash')
        .bind(dia, String(f.filial), String(f.fornecedor), f.venda ?? null, f.pct_venda ?? null, f.positivacao ?? null, f.pct_positivacao ?? null, f.skus ?? null, f.skus_total ?? null, f.skus_vendidos ?? null, f.filiais_lista || null, h, lidoEm)
    );
  }

  for (const a of body.acompanhamento_dia || []) {
    if (!a || !a.filial || !a.rca) continue;
    const h = [a.sup_cod, a.carteira, a.objetivo_visitas, a.visitas, a.pedidos_venda, a.pedidos_rota, a.pedidos_fora, a.total_pedidos, a.nao_visita, a.nao_venda, a.primeiro_pedido, a.ultimo_pedido, a.valor, a.eficiencia, a.eficacia].join('|');
    stmts.push(
      db.prepare('INSERT INTO clube_acompanhamento_dia (dia, filial, rca, sup_cod, sup_nome, nome, carteira, objetivo_visitas, visitas, pedidos_venda, pedidos_rota, pedidos_fora, total_pedidos, nao_visita, nao_venda, primeiro_pedido, ultimo_pedido, valor, eficiencia, eficacia, hash, lido_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (dia, filial, rca) DO UPDATE SET sup_cod = excluded.sup_cod, sup_nome = excluded.sup_nome, nome = excluded.nome, carteira = excluded.carteira, objetivo_visitas = excluded.objetivo_visitas, visitas = excluded.visitas, pedidos_venda = excluded.pedidos_venda, pedidos_rota = excluded.pedidos_rota, pedidos_fora = excluded.pedidos_fora, total_pedidos = excluded.total_pedidos, nao_visita = excluded.nao_visita, nao_venda = excluded.nao_venda, primeiro_pedido = excluded.primeiro_pedido, ultimo_pedido = excluded.ultimo_pedido, valor = excluded.valor, eficiencia = excluded.eficiencia, eficacia = excluded.eficacia, hash = excluded.hash, lido_em = excluded.lido_em WHERE clube_acompanhamento_dia.hash IS NOT excluded.hash')
        .bind(dia, String(a.filial), String(a.rca), a.sup_cod || null, a.sup_nome || null, a.nome || null, a.carteira ?? null, a.objetivo_visitas ?? null, a.visitas ?? null, a.pedidos_venda ?? null, a.pedidos_rota ?? null, a.pedidos_fora ?? null, a.total_pedidos ?? null, a.nao_visita ?? null, a.nao_venda ?? null, a.primeiro_pedido || null, a.ultimo_pedido || null, a.valor ?? null, a.eficiencia ?? null, a.eficacia ?? null, h, lidoEm)
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
        .bind(String(j.id), /^\d{4}-\d{2}-\d{2}/.test(String(j.data_hora || '')) ? String(j.data_hora).slice(0, 10) : dia, j.filial || null, j.sup_cod || null, j.rca || null, j.nome || null, j.cliente || null, j.cnpj || null, j.razao || null, j.fantasia || null, j.dias_sem_comprar ?? null, j.motivo || null, j.data_hora || null, j.obs || null)
    );
  }

  // PEDIDOS DO DIA do Clube (Relatorio de Pedido — ate 29 colunas do .xls): um por pedido, Delta-by-Hash
  if (Array.isArray(body.pedidos) && body.pedidos.length) {
    for (const x of body.pedidos) {
      if (!x || !x.filial || !(x.pedido || x.id)) continue;
      const h = [x.pedido_winthor, x.total, x.confirmado, x.sincronizado, x.tipo_bloqueio, x.data_emissao, x.data_liberacao, x.cliente, x.rca, x.excluido, x.codigo_integracao, x.portador, x.operacao].join('|');
      stmts.push(
        db.prepare('INSERT INTO clube_pedido (filial, pedido, dia, rca, id, pedido_winthor, cliente, razao, total, confirmado, sincronizado, origem, tipo_bloqueio, data_inicial, data_emissao, data_recebimento, data_liberacao, atividade_comercial, movimento, operacao, portador, prazo_1, prazo_2, prazo_3, prazo_4, prazo_5, total_desconto, saldo_dm, excluido, telefone, codigo_integracao, hash, lido_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (filial, pedido) DO UPDATE SET rca = excluded.rca, pedido_winthor = excluded.pedido_winthor, cliente = excluded.cliente, razao = excluded.razao, total = excluded.total, confirmado = excluded.confirmado, sincronizado = excluded.sincronizado, origem = excluded.origem, tipo_bloqueio = excluded.tipo_bloqueio, data_emissao = excluded.data_emissao, data_recebimento = excluded.data_recebimento, data_liberacao = excluded.data_liberacao, atividade_comercial = COALESCE(excluded.atividade_comercial, clube_pedido.atividade_comercial), movimento = COALESCE(excluded.movimento, clube_pedido.movimento), operacao = COALESCE(excluded.operacao, clube_pedido.operacao), portador = COALESCE(excluded.portador, clube_pedido.portador), prazo_1 = COALESCE(excluded.prazo_1, clube_pedido.prazo_1), prazo_2 = COALESCE(excluded.prazo_2, clube_pedido.prazo_2), prazo_3 = COALESCE(excluded.prazo_3, clube_pedido.prazo_3), prazo_4 = COALESCE(excluded.prazo_4, clube_pedido.prazo_4), prazo_5 = COALESCE(excluded.prazo_5, clube_pedido.prazo_5), total_desconto = COALESCE(excluded.total_desconto, clube_pedido.total_desconto), saldo_dm = COALESCE(excluded.saldo_dm, clube_pedido.saldo_dm), excluido = COALESCE(excluded.excluido, clube_pedido.excluido), telefone = COALESCE(excluded.telefone, clube_pedido.telefone), codigo_integracao = COALESCE(excluded.codigo_integracao, clube_pedido.codigo_integracao), hash = excluded.hash, lido_em = excluded.lido_em WHERE clube_pedido.hash IS NOT excluded.hash')
          .bind(
            String(x.filial), String(x.pedido || 'ID' + x.id), dia, x.rca || null, x.id ? String(x.id) : null,
            x.pedido_winthor || null, x.cliente || null, x.razao ? String(x.razao).slice(0, 120) : null,
            Number(x.total) || 0, x.confirmado || null, x.sincronizado || null, x.origem || null,
            x.tipo_bloqueio || null, x.data_inicial || null, x.data_emissao || null, x.data_recebimento || null, x.data_liberacao || null,
            x.atividade_comercial || null, x.movimento || null, x.operacao || null, x.portador || null,
            x.prazo_1 || null, x.prazo_2 || null, x.prazo_3 || null, x.prazo_4 || null, x.prazo_5 || null,
            x.total_desconto ?? null, x.saldo_dm ?? null, x.excluido || null, x.telefone || null, x.codigo_integracao || null,
            h, lidoEm
          )
      );
    }
  }

  // ROTA DO DIA COM OS NOMES (Clube, Roteiro Consolidado Geral)
  let rot = null;
  if (Array.isArray(body.roteiro) && Array.isArray(body.roteiro_filiais) && body.roteiro_filiais.length) {
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
    for (let i = 0; i < rs.length; i += 40) await db.batch(rs.slice(i, i + 40));
    const totR = await db.prepare('SELECT COUNT(DISTINCT filial) f, COUNT(*) n FROM clube_roteiro WHERE dia = ?').bind(dia).first().catch(() => null);
    await db.prepare('INSERT INTO clube_roteiro_leitura (dia, filiais, linhas, lido_em) VALUES (?,?,?,?) ON CONFLICT (dia) DO UPDATE SET filiais = excluded.filiais, linhas = excluded.linhas, lido_em = excluded.lido_em')
      .bind(dia, Number(totR && totR.f) || F.length, Number(totR && totR.n) || novos.size, new Date().toISOString()).run();
    let conf = null;
    try { conf = await db.prepare("SELECT COUNT(DISTINCT r.filial || '|' || r.rca) n, COUNT(DISTINCT CASE WHEN v.rca IS NOT NULL THEN r.filial || '|' || r.rca END) ok FROM clube_roteiro r LEFT JOIN clube_venda_dia v ON v.dia = r.dia AND v.filial = r.filial AND v.rca = r.rca WHERE r.dia = ?").bind(dia).first(); } catch {}
    rot = { linhas: novos.size, sairam: sai.length, filiais: F.length, vendedores: conf && conf.n, batem_relatorio_vendas: conf && conf.ok };
  }

  if (body.rodada) {
    const rd = body.rodada;
    stmts.push(
      db.prepare('INSERT INTO clube_rodada (dia, lido_em, vendedores, checkins, justificativas, nao_sinc, falhas, duracao_s, gate_json) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(dia, lidoEm, rd.vendedores ?? null, rd.checkins ?? null, rd.justificativas ?? null, rd.nao_sinc ?? null, rd.falhas || '', rd.duracao_s ?? null, rd.gate_json ? JSON.stringify(rd.gate_json) : null)
    );
  }

  for (let i = 0; i < stmts.length; i += 40) {
    await db.batch(stmts.slice(i, i + 40));
  }

  let sinc = null;
  if (Array.isArray(body.pedidos) && body.pedidos.length && !body.sem_sync_status) {
    try {
      const { sincronizaPedidoStatus } = await import('../_lib/pedido_status_fontes.js');
      sinc = await sincronizaPedidoStatus(env, dia);
    } catch (e) {
      sinc = { erro: String(e && e.message || e).slice(0, 160) };
    }
  }
  return resp({ ok: true, dia, gravados: stmts.length, pedido_status: sinc, roteiro: rot });
}
