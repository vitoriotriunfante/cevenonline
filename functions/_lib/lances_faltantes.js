// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/lances_faltantes.js
// O QUE É: acha os lances que deveriam existir num dia e nao existem (Vitorio, 01/11/2026). Cliente da rota, com check-in e pedido do vendedor no dia, nao cancelado:
//   Pedido na Rota; Defesa se tem a tag RECORRENCIA; Resgate de Inativo se parado ha mais de 30 dias (AS: 90) sem a tag. Mesma regra do cron-lances. So le a base.
// QUEM USA: liga-repara-pedido (recuperacao) e cron-fechamento-dia (alarme de lance faltando no fechamento).
// =========================================================================
const brl = (v) => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR');

export async function lancesFaltantes(env, dia, vend) {
  const { results: P } = await env.DB.prepare("SELECT filial f, rca r, id_cliente c, num, status s, valor v FROM pedido_status WHERE data_pedido = ? AND status NOT LIKE '%CANCEL%'").bind(dia).all();
  const { results: Ro } = await env.DB.prepare('SELECT filial_sigla f, rca_codigo r, roteiro_json j FROM varredura_central_rca WHERE data_ref = ? AND roteiro_json IS NOT NULL').bind(dia).all();
  const { results: Lc } = await env.DB.prepare("SELECT filial, chave FROM tv_lances WHERE dia = ? AND (chave LIKE 'pedido_rota|%' OR chave LIKE 'def|%' OR chave LIKE 'gol_inativo|%')").bind(dia).all();
  const tem = new Set((Lc || []).map((l) => l.filial + '|' + l.chave)), rota = new Map();
  for (const v of Ro || []) { let a = null; try { a = JSON.parse(v.j); } catch { continue; } for (const c of Array.isArray(a) ? a : []) rota.set(`${String(v.f).toUpperCase()}|${v.r}|${c.id_cliente}`, c); }
  const vistos = new Set(), out = [];
  for (const p of P || []) {
    const k = `${p.f}|${p.r}|${p.c}`; if (vistos.has(k)) continue; vistos.add(k);
    const c = rota.get(k), v = vend ? vend.get(p.f + '|' + String(p.r)) : { nome: null };
    if (!c || !c.checkin_horario || !v) continue;
    const base = { dia, f: p.f, rca: String(p.r), v, cid: String(p.c), cliente: c.nome_cliente || c.razao_social || null };
    const prova = `PEDIDO DE HOJE: ${p.num} · ${p.s || 'sem status'} · ${brl(p.v)} | check-in ${c.checkin_horario} [RECUPERADO 01/11: rota estava como ${c.status}; positivado = tem pedido]`;
    const add = (tipo, nivel, extra = '') => { const chave = `${tipo}|${p.r}|${p.c}`; if (!tem.has(p.f + '|' + chave)) out.push({ ...base, tipo, nivel, chave, obs: prova + extra }); };
    add('pedido_rota', 'pedido_rota');
    if (/POSITIVADO|EFETIVADO/.test(String(c.status))) continue;   // com esse status os lances abaixo ja nasceram pelo caminho normal
    const rec = Array.isArray(c.focos) ? c.focos.some((f) => String((f && f.industria_foco) || '').toUpperCase().includes('RECORRENCIA')) : null;
    if (rec) { add('def', 'defesa'); continue; }
    if (rec === null) continue;   // tag desconhecida: o coletor tambem nao cria o gol
    const uc = String(c.data_ultima_compra || '').slice(0, 10); if (!uc || uc < '2000') continue;
    const d = (Date.parse(dia) - Date.parse(uc)) / 864e5, ehAS = ['AS', 'PET AS'].includes(String((v && v.canal) || '').toUpperCase());
    if (d > (ehAS ? 90 : 30)) add('gol_inativo', 'gol', ` | parado ha ${Math.round(d)} dias`);
  }
  return out;
}
