// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/lances_faltantes.js
// O QUE É: acha os lances que deveriam existir num dia e nao existem.
//   Cliente da rota, com check-in e pedido do vendedor no dia, nao cancelado:
//   Pedido na Rota; Defesa se tem a tag RECORRENCIA; Resgate de Inativo se
//   parado ha mais de 30 dias (AS: 90) sem a tag.
//   FONTES OFICIAIS: pedido_status (ou clube_pedido) + clube_checkin +
//   clube_roteiro + cliente_focos + gerot_cliente_mes. Zero varredura_central_rca.
// =========================================================================
const brl = (v) => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR');

async function allSeguro(db, sql, ...binds) {
  try {
    const { results } = await db.prepare(sql).bind(...binds).all();
    return results || [];
  } catch {
    return [];
  }
}

export async function lancesFaltantes(env, dia, vend) {
  const mes = String(dia).slice(0, 7);
  const [P, CK, ROT, FOC, GC, Lc] = await Promise.all([
    allSeguro(env.DB, "SELECT UPPER(filial) AS f, rca AS r, id_cliente AS c, num, status AS s, valor AS v FROM pedido_status WHERE data_pedido = ? AND status NOT LIKE '%CANCEL%'", dia),
    allSeguro(env.DB, 'SELECT UPPER(filial) AS f, rca AS r, cliente AS c, data_hora, fantasia, razao, tipo FROM clube_checkin WHERE dia = ? ORDER BY data_hora', dia),
    allSeguro(env.DB, 'SELECT UPPER(filial) AS f, rca AS r, cliente AS c, data_ultima_compra, status FROM clube_roteiro WHERE dia = ?', dia),
    allSeguro(env.DB, 'SELECT UPPER(filial) AS f, cliente AS c, foco FROM cliente_focos'),
    allSeguro(env.DB, "SELECT UPPER(filial) AS f, cliente AS c, MAX(json_extract(dados, '$.\"Última compra\"')) AS uc FROM gerot_cliente_mes WHERE mes = ? GROUP BY UPPER(filial), cliente", mes),
    allSeguro(env.DB, "SELECT UPPER(filial) AS filial, chave FROM tv_lances WHERE dia = ? AND (chave LIKE 'pedido_rota|%' OR chave LIKE 'def|%' OR chave LIKE 'gol_inativo|%')", dia),
  ]);

  const tem = new Set(Lc.map((l) => l.filial + '|' + l.chave));

  const checkinMap = new Map();
  for (const x of CK) {
    const k = `${x.f}|${x.r}|${x.c}`;
    if (!checkinMap.has(k)) {
      checkinMap.set(k, {
        checkin_horario: x.data_hora,
        nome_cliente: x.fantasia || x.razao || null,
        tipo: x.tipo || null,
      });
    }
  }

  const rotaMap = new Map();
  for (const x of ROT) {
    rotaMap.set(`${x.f}|${x.r}|${x.c}`, x);
  }

  const focoMap = new Map();
  for (const x of FOC) {
    const kf = `${x.f}|${x.c}`;
    const lista = focoMap.get(kf) || [];
    if (x.foco) lista.push(String(x.foco).toUpperCase());
    focoMap.set(kf, lista);
  }

  const gerotUcMap = new Map();
  for (const x of GC) {
    if (x.uc) gerotUcMap.set(`${x.f}|${x.c}`, String(x.uc).slice(0, 10));
  }

  const vistos = new Set();
  const out = [];

  for (const p of P) {
    const k = `${p.f}|${p.r}|${p.c}`;
    if (vistos.has(k)) continue;
    vistos.add(k);

    const ck = checkinMap.get(k);
    const rt = rotaMap.get(k);
    const v = vend ? vend.get(p.f + '|' + String(p.r)) : { nome: null };
    if (!ck || !ck.checkin_horario || !v) continue;

    // Se clube_roteiro existe no dia, confirma se esta na rota (fallback: tipo do checkin diferente de FORA)
    const naRota = rt ? true : !/FORA/i.test(String(ck.tipo || ''));
    if (!naRota) continue;

    const base = { dia, f: p.f, rca: String(p.r), v, cid: String(p.c), cliente: ck.nome_cliente || null };
    const statusRota = (rt && rt.status) || ck.tipo || 'check-in';
    const prova = `PEDIDO DE HOJE: ${p.num} · ${p.s || 'sem status'} · ${brl(p.v)} | check-in ${ck.checkin_horario} [RECUPERADO: rota ${statusRota}; positivado = tem pedido]`;
    const add = (tipo, nivel, extra = '') => {
      const chave = `${tipo}|${p.r}|${p.c}`;
      if (!tem.has(p.f + '|' + chave)) out.push({ ...base, tipo, nivel, chave, obs: prova + extra });
    };

    add('pedido_rota', 'pedido_rota');
    if (/POSITIVADO|EFETIVADO/.test(String(statusRota))) continue;

    const focos = focoMap.get(`${p.f}|${p.c}`);
    const rec = focos ? focos.some((f) => f.includes('RECORRENCIA')) : (FOC.length ? false : null);
    if (rec) {
      add('def', 'defesa');
      continue;
    }
    if (rec === null) continue;

    const ucRaw = (rt && rt.data_ultima_compra) || gerotUcMap.get(`${p.f}|${p.c}`) || '';
    const uc = String(ucRaw).slice(0, 10);
    if (!uc || uc < '2000') continue;

    const d = (Date.parse(dia) - Date.parse(uc)) / 864e5;
    const ehAS = ['AS', 'PET AS'].includes(String((v && v.canal) || '').toUpperCase());
    if (d > (ehAS ? 90 : 30)) add('gol_inativo', 'gol', ` | parado ha ${Math.round(d)} dias`);
  }
  return out;
}
