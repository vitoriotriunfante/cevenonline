// =========================================================================
// FICHA DO ARQUIVO: functions/api/liga-repara-pedido.js
// O QUE É: RECUPERACAO dos lances "Pedido na Rota" que faltaram na Liga de outubro (auditoria 01/11/2026). Mesmo metodo de liga-repara-devolucao.js.
// CAUSA: o lance exigia o status POSITIVADO da rota, que vem do Clube da Venda. Positivado = tem pedido (Vitorio). Corrigido em tv-vendedor.js em 01/11/2026.
// O QUE FAZ: cliente da rota do dia, com check-in e pedido do mesmo vendedor no dia (pedido_status, nao cancelado), sem lance pedido_rota: cria o lance no dia do pedido.
//   Nunca chama o CEVEN e nunca assume: sem pedido gravado, sem check-in ou fora de quem joga a Liga = nada. So cobre "Pedido na Rota" (+1); gols que dependem do historico nao entram.
// MODOS: padrao = ENSAIO, so mostra o que mudaria. ?grava=1 grava em tv_lances e no dia fechado e atualiza o total do fechamento. Protegido pela chave administrativa (?chave=).
// =========================================================================
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { ehFeriado, ehFimDeSemana } from '../_lib/feriados.js';
import { ehRepresentante } from '../_lib/participacao.js';

const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const j = (x, s = 200) => new Response(JSON.stringify(x, null, 1), { status: s, headers: cors });
const brl = (v) => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR');

export async function onRequestGet({ env, request }) {
  if (!(await chaveAdminOk(env, request))) return j({ erro: 'nao autorizado' }, 401);
  const u = new URL(request.url), origin = u.origin;
  const de = u.searchParams.get('de') || '2026-10-13', ate = u.searchParams.get('ate') || '2026-10-30', grava = u.searchParams.get('grava') === '1';
  if (ate >= new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)) return j({ erro: 'so dias passados' }, 400);

  const mostra = await (await fetch(origin + '/api/tv-mostra', { signal: AbortSignal.timeout(20000) })).json();
  const vend = new Map();
  for (const [k, L] of Object.entries(mostra.filiais || {})) for (const v of L) vend.set(k.split('_')[0] + '|' + String(v.rca), v);

  const { results: dr } = await env.DB.prepare('SELECT DISTINCT data_pedido d FROM pedido_status WHERE data_pedido >= ? AND data_pedido <= ? ORDER BY 1').bind(de, ate).all();
  const lances = [];
  for (const { d: dia } of dr || []) {
    if (ehFimDeSemana(dia) || ehFeriado(dia)) continue;
    const { results: P } = await env.DB.prepare("SELECT filial f, rca r, id_cliente c, num, status s, valor v FROM pedido_status WHERE data_pedido = ? AND status NOT LIKE '%CANCEL%'").bind(dia).all();
    const { results: Ro } = await env.DB.prepare('SELECT filial_sigla f, rca_codigo r, roteiro_json j FROM varredura_central_rca WHERE data_ref = ? AND roteiro_json IS NOT NULL').bind(dia).all();
    const { results: Lc } = await env.DB.prepare("SELECT filial, chave FROM tv_lances WHERE dia = ? AND chave LIKE 'pedido_rota|%'").bind(dia).all();
    const tem = new Set((Lc || []).map((l) => l.filial + '|' + l.chave));
    const rota = new Map();
    for (const v of Ro || []) { let a = null; try { a = JSON.parse(v.j); } catch { continue; } for (const c of Array.isArray(a) ? a : []) rota.set(`${String(v.f).toUpperCase()}|${v.r}|${c.id_cliente}`, c); }
    const vistos = new Set();
    for (const p of P || []) {
      const k = `${p.f}|${p.r}|${p.c}`; if (vistos.has(k)) continue; vistos.add(k);
      const c = rota.get(k), v = vend.get(p.f + '|' + String(p.r)), chave = `pedido_rota|${p.r}|${p.c}`;
      if (!c || !c.checkin_horario || !v || tem.has(p.f + '|' + chave)) continue;
      if (ehRepresentante(v) || v.mostra === false || /^(VAGO|GERENTE|RCA\b|VENDA )/i.test(String(v.nome || ''))) continue;   // so quem joga a Liga
      lances.push({ dia, f: p.f, rca: String(p.r), v, cid: String(p.c), cliente: c.nome_cliente || c.razao_social || null, chave, obs: `PEDIDO DE HOJE: ${p.num} · ${p.s || 'sem status'} · ${brl(p.v)} | check-in ${c.checkin_horario} [RECUPERADO 01/11: rota estava como ${c.status}; positivado = tem pedido]` });
    }
  }
  const porFilial = {}, porVend = {};
  for (const l of lances) { porFilial[l.f] = (porFilial[l.f] || 0) + 1; const k = `${l.f} ${l.rca} - ${l.v.nome}`; porVend[k] = (porVend[k] || 0) + 1; }
  const saida = { modo: grava ? 'GRAVA' : 'ENSAIO', de, ate, lances_a_criar: lances.length, pontos_cada: 1, por_filial: porFilial, por_vendedor: Object.fromEntries(Object.entries(porVend).sort((a, b) => b[1] - a[1])) };
  if (!grava) return j(saida);

  const iso = new Date().toISOString(), st = lances.map((l) => env.DB.prepare(`INSERT OR IGNORE INTO tv_lances (dia, filial, chave, nivel, rca, vendedor, supervisor, cliente_id, cliente, motivo, dias_sem_compra, ultima_compra, tempo_visita, obs, hora_sp, visto_em, baseline)
    VALUES (?, ?, ?, 'pedido_rota', ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, '23:59:00', ?, 0)`).bind(l.dia, l.f, l.chave, l.rca, l.v.nome || null, l.v.supervisor || null, l.cid, l.cliente, l.obs.slice(0, 700), iso));
  for (let i = 0; i < st.length; i += 80) await env.DB.batch(st.slice(i, i + 80));
  const fechamento = [];
  for (const dia of [...new Set(lances.map((l) => l.dia))].sort()) {
    const fc = await env.DB.prepare('SELECT dia FROM liga_fechamento WHERE dia = ?').bind(dia).first();
    if (!fc) { fechamento.push({ dia, status: 'sem fechamento: entra no normal' }); continue; }
    const lj = await (await fetch(`${origin}/api/brasileirao-lances?dia=${dia}&ao_vivo=1`, { signal: AbortSignal.timeout(40000) })).json().catch(() => null);
    if (!lj || !Array.isArray(lj.lances)) { fechamento.push({ dia, status: 'FALHOU leitura' }); continue; }
    const meus = new Set(lances.filter((l) => l.dia === dia).map((l) => l.f + '|' + l.chave));
    const novos = lj.lances.filter((x) => meus.has(String(x.filial || '') + '|' + String(x.chave || '').replace(/^[A-Z]{3}[|]/, '')));
    const ins = novos.map((x) => env.DB.prepare('INSERT OR IGNORE INTO liga_dia_fechado (dia, chave, filial, lance_json) VALUES (?, ?, ?, ?)').bind(dia, String(x.chave || ''), String(x.filial || ''), JSON.stringify(x)));
    for (let i = 0; i < ins.length; i += 80) await env.DB.batch(ins.slice(i, i + 80));
    const tot = await env.DB.prepare("SELECT COUNT(*) n, SUM(CAST(json_extract(lance_json, '$.pontos') AS REAL)) p FROM liga_dia_fechado WHERE dia = ?").bind(dia).first();
    await env.DB.prepare('UPDATE liga_fechamento SET total_lances = ?, total_pontos = ? WHERE dia = ?').bind(tot.n, tot.p, dia).run();
    fechamento.push({ dia, acrescentados_ao_fechado: novos.length, de: meus.size });
  }
  return j({ ...saida, fechamento });
}
