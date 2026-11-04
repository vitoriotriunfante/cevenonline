// =========================================================================
// FICHA DO ARQUIVO: functions/api/ficha-carga.js   (GET/POST /api/ficha-carga, header X-Evo-Key)
// O QUE É: recebe do GitHub (scripts/carregar_ficha_d1.py, depois do Data Lake) a FICHA de cada cliente e os PROSPECTS e grava no D1 (Vitorio, 31/10/2026: "tem tudo dentro do CEVEN").
//   ficha_cliente = 1 linha por cliente por filial (pedidos com o vendedor de cada um, itens, o que parou). O JOTA le 1 linha pela chave primaria.
// GET  ?hashes=1&filial=TBL -> { hashes: {id_cliente: hash} }: o script so envia quem mudou (custo D1 = linhas gravadas; nunca regravar tudo).
// POST { fichas: [{filial, id_cliente, hash, json}] } e/ou { prospects: [{...}] } : no maximo 200 por chamada. Nao chama o CEVEN.
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const r = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: J });
const ok = (request, env) => chaveEvoValida(request, env);
const tabela = (db) => db.prepare('CREATE TABLE IF NOT EXISTS ficha_cliente (filial TEXT NOT NULL, id_cliente TEXT NOT NULL, hash TEXT, json TEXT NOT NULL, em TEXT, PRIMARY KEY (filial, id_cliente))').run();
const tabelaProsp = (db) => db.prepare('CREATE TABLE IF NOT EXISTS prospects_mapa (filial TEXT NOT NULL, rca TEXT NOT NULL, cnpj TEXT NOT NULL, json TEXT NOT NULL, em TEXT, PRIMARY KEY (filial, rca, cnpj))').run();
const tabelaProspStatus = (db) => db.prepare('CREATE TABLE IF NOT EXISTS prospects_coleta_status (filial TEXT NOT NULL, rca TEXT NOT NULL, data_ref TEXT NOT NULL, estado TEXT NOT NULL, total INTEGER, em TEXT, PRIMARY KEY (filial, rca))').run();

export async function onRequestGet({ request, env }) {
  if (!(await ok(request, env))) return r({ erro: 'nao autorizado' }, 401);
  await tabela(env.DB);
  const f = String(new URL(request.url).searchParams.get('filial') || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(f)) return r({ erro: 'filial obrigatoria' }, 400);
  const { results } = await env.DB.prepare('SELECT id_cliente, hash FROM ficha_cliente WHERE filial = ?').bind(f).all();
  return r({ hashes: Object.fromEntries((results || []).map((x) => [x.id_cliente, x.hash])) });
}

export async function onRequestPost({ request, env }) {
  if (!(await ok(request, env))) return r({ erro: 'nao autorizado' }, 401);
  let b = {}; try { b = await request.json(); } catch (e) { return r({ erro: 'json invalido' }, 400); }
  const agora = new Date().toISOString(), F = (b.fichas || []).slice(0, 200), P = (b.prospects || []);
  const PS = b.prospects_status || [];
  if (!Array.isArray(P) || P.length > 200) return r({ erro: 'prospects deve conter no máximo 200 itens' }, 400);
  if (F.length) {
    await tabela(env.DB);
    await env.DB.batch(F.map((x) => env.DB.prepare('INSERT INTO ficha_cliente (filial, id_cliente, hash, json, em) VALUES (?,?,?,?,?) ON CONFLICT (filial, id_cliente) DO UPDATE SET hash = excluded.hash, json = excluded.json, em = excluded.em').bind(String(x.filial), String(x.id_cliente), String(x.hash), String(x.json), agora)));
  }
  if (PS.length) {
    if (!Array.isArray(PS) || PS.length !== 1) return r({ erro: 'envie o estado de um RCA por chamada' }, 400);
    await tabelaProsp(env.DB);
    await tabelaProspStatus(env.DB);
    const s = PS[0], filial = String(s.filial || '').toUpperCase(), rca = String(s.rca || '');
    if (!/^[A-Z]{3}$/.test(filial) || !/^\d+$/.test(rca) || !/^\d{4}-\d{2}-\d{2}$/.test(String(s.data_ref || '')) || !['ok', 'sem_retorno'].includes(s.estado)) {
      return r({ erro: 'estado de coleta de prospects inválido' }, 400);
    }
    if (P.some((x) => String(x.filial).toUpperCase() !== filial || String(x.rca) !== rca)) {
      return r({ erro: 'prospects não correspondem ao RCA do estado informado' }, 400);
    }
    if (s.estado !== 'ok' && P.length) return r({ erro: 'coleta sem retorno não pode incluir prospects' }, 400);
    const sql = [];
    if (s.estado === 'ok') {
      sql.push(env.DB.prepare('DELETE FROM prospects_mapa WHERE filial = ? AND rca = ?').bind(filial, rca));
      sql.push(...P.map((x) => env.DB.prepare('INSERT INTO prospects_mapa (filial, rca, cnpj, json, em) VALUES (?,?,?,?,?)').bind(filial, rca, String(x.cnpj), JSON.stringify(x.dados), agora)));
    }
    sql.push(env.DB.prepare('INSERT INTO prospects_coleta_status (filial, rca, data_ref, estado, total, em) VALUES (?,?,?,?,?,?) ON CONFLICT (filial, rca) DO UPDATE SET data_ref = excluded.data_ref, estado = excluded.estado, total = excluded.total, em = excluded.em').bind(filial, rca, String(s.data_ref), s.estado, s.estado === 'ok' ? P.length : null, agora));
    await env.DB.batch(sql);
  } else if (P.length) {
    await tabelaProsp(env.DB);
    await env.DB.batch(P.map((x) => env.DB.prepare('INSERT INTO prospects_mapa (filial, rca, cnpj, json, em) VALUES (?,?,?,?,?) ON CONFLICT (filial, rca, cnpj) DO NOTHING').bind(String(x.filial), String(x.rca), String(x.cnpj), JSON.stringify(x.dados), agora)));
  }
  if (b.limpar_prospects_antes) { await tabelaProsp(env.DB); await env.DB.prepare('DELETE FROM prospects_mapa WHERE em < ?').bind(String(b.limpar_prospects_antes)).run(); }
  return r({ ok: true, fichas: F.length, prospects: P.length });
}
