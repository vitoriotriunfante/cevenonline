// =========================================================================
// FICHA DO ARQUIVO: functions/api/liga-repara-devolucao.js
// O QUE É: RECUPERACAO dos lances de DEVOLUCAO que faltaram na Liga de 14 a 25/10/2026 (Vitorio, 26/10/2026: "RESOLVE... vale uma moto essa liga").
// CAUSA: a coleta so buscava a lista de devolucoes de quem "mudou"; 160-270 vendedores por dia ficaram sem a lista na base e as devolucoes deles nao viraram
//   Gol Contra (-4) nem Cartao Vermelho (-10). Corrigido na coleta em 26/10. A lista do CEVEN traz o MES inteiro com a data de cada nota, entao a base de
//   hoje tem todas as notas de outubro com a data real.
// O QUE FAZ: para cada nota (valor > 0) com data entre ?de e ?ate (dia util), de vendedor do universo de hoje e da filial dele, que ainda NAO tem lance:
//   motivo oficial da nota (devolucao_nota_motivo, gravado pelo coletor de lances; esta rotina NAO chama o CEVEN) -> mesma regra do coletor
//   (CLIENTE NAO PEDIU = ver_dev -10; motivo comercial = golcontra_dev -4; outro motivo = nada). Nota sem motivo confirmado = nada (nunca assume).
// MODOS: ?ensaio=1 (padrao) so mostra o que mudaria; ?grava=1 grava em tv_lances no DIA DA NOTA e acrescenta ao dia ja fechado (liga_dia_fechado), atualizando
//   o total do fechamento. Protegido pela chave administrativa (?chave=).
// =========================================================================
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { ehFeriado, ehFimDeSemana } from '../_lib/feriados.js';
import { ehRepresentante } from '../_lib/participacao.js';

const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const j = (x, s = 200) => new Response(JSON.stringify(x, null, 1), { status: s, headers: cors });
const DEV_MOTIVO_COMERCIAL = /SEM DINHEIRO|COND.{1,3}PAGTO|EMITIU COD|PEDIDO DUPLICADO|RECUSOU MERC|PRECO DIFERENTE/;   // igual ao cron-lances
const brl = (v) => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR');

export async function onRequestGet({ env, request }) {
  if (!(await chaveAdminOk(env, request))) return j({ erro: 'nao autorizado' }, 401);
  const u = new URL(request.url), origin = u.origin;
  const de = u.searchParams.get('de') || '2026-10-14', ate = u.searchParams.get('ate') || '2026-10-25', grava = u.searchParams.get('grava') === '1';
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

  // universo de hoje (Gestao de Equipe + arvore do CEVEN): filial, nome e supervisor de cada vendedor
  const mostra = await (await fetch(origin + '/api/tv-mostra', { signal: AbortSignal.timeout(20000) })).json();
  const vend = new Map();
  for (const [k, L] of Object.entries(mostra.filiais || {})) for (const v of L) vend.set(k.split('_')[0] + '|' + String(v.rca), v);

  const { results } = await env.DB.prepare('SELECT rca_codigo, filial_sigla, devolucoes_json FROM varredura_central_rca WHERE data_ref = ? AND devolucoes_json IS NOT NULL').bind(hoje).all();
  const notas = [];
  for (const r of results || []) {
    const f = String(r.filial_sigla).toUpperCase(), v = vend.get(f + '|' + String(r.rca_codigo));
    if (!v || ehRepresentante(v) || v.mostra === false || /^(VAGO|GERENTE|RCA\b|VENDA )/i.test(String(v.nome || ''))) continue;   /* so quem joga a Liga (oculto, vago e gerente nao jogam) */
    let L = null; try { L = JSON.parse(r.devolucoes_json); } catch { continue; }
    for (const n of Array.isArray(L) ? L : []) {
      const d = String(n.data || '').slice(0, 10);
      if (!n.numnota || d < de || d > ate || ehFimDeSemana(d) || ehFeriado(d) || !(Number(n.vl_devolvido) > 0)) continue;
      notas.push({ f, rca: String(r.rca_codigo), v, nota: String(n.numnota), dia: d, valor: Number(n.vl_devolvido), cliente: n.nomecli || null, cid: n.codcli ? String(n.codcli) : null });
    }
  }
  // ja tem lance (em qualquer dia) = nao mexe
  const { results: ex } = await env.DB.prepare("SELECT filial, chave FROM tv_lances WHERE chave LIKE 'ver_dev|%' OR chave LIKE 'golcontra_dev|%' OR chave LIKE '%|ver_dev|%' OR chave LIKE '%|golcontra_dev|%'").all();
  const temLance = new Set((ex || []).map((x) => x.filial + '|' + String(x.chave).replace(/^[A-Z]{3}[|]/, '').split('|').slice(1).join('|')));
  const pend = notas.filter((n) => !temLance.has(n.f + '|' + n.rca + '|' + n.nota));

  // motivo oficial
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS devolucao_nota_motivo (rca TEXT NOT NULL, nota TEXT NOT NULL, nao_pediu INTEGER, motivos TEXT, resolvido_em TEXT, PRIMARY KEY (rca, nota))').run();
  const { results: mt } = await env.DB.prepare('SELECT rca, nota, nao_pediu, motivos FROM devolucao_nota_motivo').all();
  const mot = new Map((mt || []).map((x) => [x.rca + '|' + x.nota, x]));
  const consultas = 0, bloqueado = false;   /* base unica: o motivo vem do coletor de lances (cron-lances resolve as notas do mes e grava em devolucao_nota_motivo) */

  const lances = [], semMotivo = [];
  for (const n of pend) {
    const m = mot.get(n.rca + '|' + n.nota);
    if (!m) { semMotivo.push(n); continue; }
    const tipo = m.nao_pediu === 1 ? 'ver_dev' : DEV_MOTIVO_COMERCIAL.test(m.motivos || '') ? 'golcontra_dev' : null;
    if (!tipo) continue;   // motivo de estoque/logistica: nao pune (regra do coletor)
    lances.push({ ...n, tipo, pontos: tipo === 'ver_dev' ? -10 : -4, nivel: tipo === 'ver_dev' ? 'vermelho' : 'golcontra',
      chave: `${tipo}|${n.rca}|${n.nota}`, obs: `nota ${n.nota} de ${n.dia} | ${brl(n.valor)} | ${n.cliente || 'cliente sem nome'} | motivo oficial: ${m.motivos} [RECUPERADO 26/10: nota estava na lista do CEVEN mas a coleta nao tinha a lista do vendedor no dia]` });
  }

  // resumo do impacto
  const porFilial = {}, porVend = {};
  for (const l of lances) {
    const pf = porFilial[l.f] || (porFilial[l.f] = { lances: 0, pontos: 0 }); pf.lances++; pf.pontos += l.pontos;
    const k = `${l.f} ${l.rca} - ${l.v.nome}`; const pv = porVend[k] || (porVend[k] = { lances: 0, pontos: 0, dias: new Set() }); pv.lances++; pv.pontos += l.pontos; pv.dias.add(l.dia.slice(8, 10) + '/' + l.dia.slice(5, 7));
  }
  const saida = { modo: grava ? 'GRAVA' : 'ENSAIO', de, ate, notas_no_periodo: notas.length, ja_tinham_lance: notas.length - pend.length,
    lances_a_criar: lances.length, sem_motivo_ainda: semMotivo.length, consultas_ceven_nesta_chamada: consultas, ceven_bloqueou: bloqueado,
    por_filial: porFilial, por_vendedor: Object.fromEntries(Object.entries(porVend).sort((a, b) => a[1].pontos - b[1].pontos).map(([k, x]) => [k, { lances: x.lances, pontos: x.pontos, dias: [...x.dias].sort().join(', ') }])) };
  if (!grava) return j(saida);

  // GRAVA: no dia da nota (tv_lances) + no dia fechado da Liga (liga_dia_fechado) + total do fechamento
  let gravados = 0;
  for (const l of lances) {
    const hora = '23:59:00', iso = new Date().toISOString();
    const r = await env.DB.prepare(`INSERT OR IGNORE INTO tv_lances (dia, filial, chave, nivel, rca, vendedor, supervisor, cliente_id, cliente, motivo, dias_sem_compra, ultima_compra, tempo_visita, obs, hora_sp, visto_em, baseline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, 0)`).bind(l.dia, l.f, l.chave, l.nivel, l.rca, l.v.nome || null, l.v.supervisor || null, l.cid, l.cliente, l.obs.slice(0, 700), hora, iso).run();
    if (r.meta && r.meta.changes === 1) gravados++;
  }
  const dias = [...new Set(lances.map((l) => l.dia))].sort(), fechamento = [];
  for (const dia of dias) {
    const fc = await env.DB.prepare('SELECT dia FROM liga_fechamento WHERE dia = ?').bind(dia).first();
    if (!fc) { fechamento.push({ dia, status: 'dia ainda aberto: entra no fechamento normal' }); continue; }
    const lj = await (await fetch(`${origin}/api/brasileirao-lances?dia=${dia}&ao_vivo=1`, { signal: AbortSignal.timeout(40000) })).json().catch(() => null);
    if (!lj || !Array.isArray(lj.lances)) { fechamento.push({ dia, status: 'FALHOU leitura' }); continue; }
    const meus = new Set(lances.filter((l) => l.dia === dia).map((l) => l.chave));
    const novos = lj.lances.filter((x) => meus.has(String(x.chave || '').replace(/^[A-Z]{3}[|]/, '')));
    for (const x of novos) await env.DB.prepare('INSERT OR IGNORE INTO liga_dia_fechado (dia, chave, filial, lance_json) VALUES (?, ?, ?, ?)').bind(dia, String(x.chave || ''), String(x.filial || ''), JSON.stringify(x)).run();
    const tot = await env.DB.prepare('SELECT COUNT(*) n, SUM(CAST(json_extract(lance_json, \'$.pontos\') AS REAL)) p FROM liga_dia_fechado WHERE dia = ?').bind(dia).first();
    await env.DB.prepare('UPDATE liga_fechamento SET total_lances = ?, total_pontos = ? WHERE dia = ?').bind(tot.n, tot.p, dia).run();
    fechamento.push({ dia, acrescentados_ao_fechado: novos.length, de: meus.size });
  }
  return j({ ...saida, gravados_em_tv_lances: gravados, fechamento });
}
