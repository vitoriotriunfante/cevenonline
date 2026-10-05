// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: detecta e registra lances (gols, cartões, pênaltis, impedimentos, defesas, hat-trick,
//          gol contra) de TODOS os vendedores de TODAS as 11 filiais, SEM depender de nenhuma TV
//          estar aberta num navegador. Replica no servidor a mesma lógica de vend()+calcAlertas()
//          que já existe em public/tvapp.html/matrizapp.html — ver REGRAS_CFTV/LIVRO_DE_REGRAS_CFTV.md
//          pro catálogo completo de lances (G01-G12, V01-V03, A01, P01-P02, I01-I02, D01).
// POR QUE EXISTE (achado 29/09/2026): a detecção só rodava no JavaScript da TV a cada 90s — se a
//          aba ficasse em background (Chrome suspende `setInterval` de abas inativas) ou nenhuma
//          TV estivesse aberta numa filial, os lances simplesmente paravam de ser detectados.
//          Vitório às 14h49: "to aqui assistindo a TV de API e não tá tendo gol nenhum" — último
//          lance registrado era das 11:47, quase 3h parado.
// PRIORIDADE (decisão do Vitório, 29/09/2026): "quero de 5 em 5 minutos" — separado do WhatsApp e
//          dos outros crons da TV, escalonado pra nunca coincidir, respeitando o lock global
//          (cron-lock.js) — pula o ciclo se o WhatsApp estiver ativo.
// COMO: chama /api/tv-vendedor?filial=X&id=Y pra cada RCA (mesmo endpoint que a TV já usa —
//          reaproveita toda a lógica de historico-cliente/dobrouMix/bonificacao já testada, não
//          reimplementa), calcula os lances com a mesma função de tvapp.html, e grava via o mesmo
//          POST /api/tv-lances que a TV usaria (INSERT OR IGNORE — nunca duplica lance).
// LOTE: 15 vendedores em paralelo por vez (tv-vendedor.js já faz várias chamadas internas por
//          vendedor — mais pesado que roteiro-hoje/produtividade sozinhos).
// REGRA: nunca inventa dado. RCA sem resposta simplesmente não gera lance nesse ciclo.
// =========================================================================

const LOTE = 3; // 3 vendedores em paralelo; com central=1 so o historico dos positivados vai ao CEVEN (no maximo 2 simultaneas por vendedor = 6)
const CAMPO = ['VJ', 'PET VJ', 'FARMA', 'ESP'];
const DIAS_PENALTI_ESTOQUE = 30, DIAS_PENALTI_FECHADO = 45;
const FRESCOR_MAX_MIN = 30; // só considera lance de horário "novo" se detectado nos últimos 30min

function agoraSP() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  const h = (+p.hour) % 24;
  return { dia: `${p.year}-${p.month}-${p.day}`, h, m: +p.minute, hms: `${String(h).padStart(2, '0')}:${p.minute}:${p.second}`, agoraMin: h * 60 + +p.minute };
}

function diasDesde(dataISO, hojeISO) {
  if (!dataISO || +dataISO.slice(0, 4) < 2000) return null;
  const a = Date.UTC(...hojeISO.split('-').map((x, i) => (i === 1 ? +x - 1 : +x)));
  const b = Date.UTC(...dataISO.split('-').map((x, i) => (i === 1 ? +x - 1 : +x)));
  return Math.round((a - b) / 86400000);
}

function diasUteisMes(hojeISO) {
  const [ano, mes] = hojeISO.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  let totalUteis = 0, uteisAteHoje = 0;
  const hoje = +hojeISO.split('-')[2];
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      totalUteis++;
      if (dia <= hoje) uteisAteHoje++;
    }
  }
  return { totalUteis, uteisAteHoje };
}

function distanciaM(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || isNaN(v))) return null;
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function horariosCheckinDoDia(cl) {
  if (!Array.isArray(cl)) return [];
  return cl
    .filter((c) => ['POSITIVADO', 'EFETIVADO'].includes(c.status) && c.checkin_horario)
    .map((c) => {
      const [h, m] = String(c.checkin_horario).split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return { horaMin: h * 60 + m, hora: h, hms: c.checkin_horario, valor: c.valor_ultima || null };
    })
    .filter(Boolean)
    .sort((a, b) => a.horaMin - b.horaMin);
}

// Mesma lógica de vend() em tvapp.html: transforma resposta de /api/tv-vendedor no objeto usado
// por calcAlertas.
function vend(id, canal, sup, d) {
  const cl = Array.isArray(d.clientes) ? d.clientes : null;
  const st = (s) => (cl ? cl.filter((c) => s.includes(c.status)).length : null);
  const feitas = cl ? cl.filter((c) => !['AGENDADO', 'ABERTO'].includes(c.status)).length : null;
  const campo = CAMPO.includes(canal);
  return {
    id, nome: d.nome, canal, sup: sup || '', campo, cl,
    meta: num(d.meta_fat), fat: num(d.faturado),
    devolucoesHoje: Array.isArray(d.devolucoes_hoje) ? d.devolucoes_hoje : [],
    dig: num(d.dig_hoje), pos: num(d.pos_hoje),
    feitas, comVenda: st(['POSITIVADO', 'EFETIVADO']),
    temRota: !!(cl && cl.length)
  };
}
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

// Mesma lógica de calcAlertas() em tvapp.html/matrizapp.html — ver ficha do arquivo.
function calcAlertas(vs, t) {
  const fuso1h = false; // aqui roda por filial; fuso1h é decidido por chamada (ver loop principal)
  const out = [];
  vs.forEach((v) => {
    if (!v.cl) return;
    if ((v.dig || 0) >= 15000) out.push({ chave: `gol_super|${v.id}`, nivel: 'gol', v });

    const checkins = horariosCheckinDoDia(v.cl);
    const ultimoCheckin = checkins.length ? checkins[checkins.length - 1] : null;
    if (ultimoCheckin && t.agoraMin - ultimoCheckin.horaMin <= FRESCOR_MAX_MIN) {
      const limiteRelampago = v.fuso1h ? 10 : 9;
      if (ultimoCheckin.hora < limiteRelampago) out.push({ chave: `gol_relampago|${v.id}`, nivel: 'gol', v });
      const limiteAcrescimos = v.fuso1h ? 18 : 17;
      if (ultimoCheckin.hora >= limiteAcrescimos) out.push({ chave: `gol_acrescimos|${v.id}`, nivel: 'gol', v });
    }
    if (checkins.length >= 3) {
      for (let i = 0; i <= checkins.length - 3; i++) {
        const janelaMin = checkins[i + 2].horaMin - checkins[i].horaMin;
        if (janelaMin <= 120 && janelaMin >= 0 && t.agoraMin - checkins[i + 2].horaMin <= FRESCOR_MAX_MIN) {
          out.push({ chave: `gol_hattrick|${v.id}|${checkins[i + 2].hms}`, nivel: 'hattrick', v });
          break;
        }
      }
    }
    if ((v.meta || 0) > 0 && ultimoCheckin && t.agoraMin - ultimoCheckin.horaMin <= FRESCOR_MAX_MIN) {
      const { totalUteis, uteisAteHoje } = diasUteisMes(t.dia);
      const metaDiaria = totalUteis > 0 ? (v.meta / totalUteis) * uteisAteHoje : 0;
      if (metaDiaria > 0 && (v.dig || 0) >= metaDiaria && ultimoCheckin.hora < 14) out.push({ chave: `gol_meta1t|${v.id}`, nivel: 'gol', v });
    }
    if ((v.feitas || 0) >= 8 && v.comVenda != null) {
      const txConv = v.feitas > 0 ? (v.comVenda / v.feitas) * 100 : 0;
      if (txConv >= 50) out.push({ chave: `gol_conversao|${v.id}`, nivel: 'gol', v });
    }
    if ((v.pos || 0) >= 10) out.push({ chave: `gol_goleada|${v.id}`, nivel: 'gol', v });
    if ((v.meta || 0) > 0 && (v.fat || 0) >= v.meta) out.push({ chave: `gol_campeao|${v.id}|${t.dia.slice(0, 7)}`, nivel: 'gol', v });

    (v.devolucoesHoje || []).forEach((dv) => {
      if (!dv.nota) return;
      if (dv.naoPediu === false) out.push({ chave: `golcontra_dev|${v.id}|${dv.nota}`, nivel: 'golcontra', v, valor: dv.valor, cliente: dv.cliente });
      else out.push({ chave: `ver_dev|${v.id}|${dv.nota}`, nivel: 'vermelho', v, valor: dv.valor, cliente: dv.cliente });
    });

    v.cl.forEach((c) => {
      const diasC = diasDesde(c.ultima_compra, t.dia);
      const ehInativo = diasC != null && diasC > 30;
      const ehRecorrencia = !!c.recorrencia;
      // RECORRENCIA = DEFESA (+3), nunca gol (decisao do Vitorio, 05/10/2026): antes o mesmo cliente com a tag gerava gol de
      // resgate (+6) E defesa (+3). O gol de resgate fica so para cliente parado ha mais de 30 dias SEM a tag.
      if (['POSITIVADO', 'EFETIVADO'].includes(c.status) && ehInativo && !ehRecorrencia) {
        out.push({ chave: `gol_inativo|${v.id}|${c.id}`, nivel: 'gol', v, c });
      }
      if (['POSITIVADO', 'EFETIVADO'].includes(c.status) && c.checkin_horario) {
        out.push({ chave: `pedido_rota|${v.id}|${c.id}`, nivel: 'pedido_rota', v, c });
      }
      if (c.dobrouMix) out.push({ chave: `gol_mix|${v.id}|${c.id}`, nivel: 'gol', v, c });
      if (c.dobradinhaQuinzenas) out.push({ chave: `gol_quinzenas|${v.id}|${c.id}`, nivel: 'gol', v, c });
      if (c.bonificacao) out.push({ chave: `ver_bonif|${v.id}|${c.id}`, nivel: 'vermelho', v, c });
      if (c.recorrencia && ['POSITIVADO', 'EFETIVADO'].includes(c.status)) out.push({ chave: `def|${v.id}|${c.id}`, nivel: 'defesa', v, c });
      if (v.campo) {
        const distM = distanciaM(c.lat, c.lon, c.checkout_lat, c.checkout_lon);
        if (distM != null && distM > 500 && distM <= 20000) out.push({ chave: `imp|gps|${v.id}|${c.id}`, nivel: 'impedimento', v, c });
      }
      if (['POSITIVADO', 'EFETIVADO'].includes(c.status) || !c.motivo) return;
      const m = c.motivo.toUpperCase();
      const dias = diasDesde(c.ultima_compra, t.dia);
      if (!v.campo) return;
      if (m.includes('ESTOQUE SUFICIENTE') && (dias == null || dias > DIAS_PENALTI_ESTOQUE)) {
        out.push({ chave: `pen|estoque|${v.id}|${c.id}`, nivel: 'penalti', v, c, dias });
      } else if ((m.includes('FECHADO') || m.includes('ENCERROU')) && (dias == null || dias > DIAS_PENALTI_FECHADO)) {
        out.push({ chave: `pen|fechado|${v.id}|${c.id}`, nivel: 'penalti', v, c, dias });
      } else if (c.tempo_visita === '00:00') {
        out.push({ chave: `imp|visita0|${v.id}|${c.id}`, nivel: 'impedimento', v, c });
      }
    });

    const limiteHora = v.fuso1h ? 11 : 10;
    const depois10 = t.h >= limiteHora && t.h < 19;
    if (v.campo && v.temRota && depois10) {
      if (v.feitas === 0) out.push({ chave: `vis10|${v.id}`, nivel: 'vermelho', v });
      else if (!(v.dig > 0) && !(v.pos > 0)) out.push({ chave: `ven10|${v.id}`, nivel: 'amarelo', v });
    }
  });
  return out;
}

async function getJson(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}

export async function onRequestGet({ env, request }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 (env.DB) não configurado' }), { status: 503, headers: cors });

  const t0 = Date.now();
  const t = agoraSP();
  const forcar = new URL(request.url).searchParams.has('forcar');

  if (!forcar) {
    const lock = await env.DB.prepare("SELECT dono, criado_em FROM cron_lock_global WHERE id = 1").first().catch(() => null);
    if (lock) {
      const idadeLockMs = Date.now() - new Date(lock.criado_em + 'Z').getTime();
      if (idadeLockMs < 20 * 60 * 1000) {
        return new Response(JSON.stringify({ status: 'PULADO_WHATSAPP_ATIVO', dono: lock.dono }), { headers: cors });
      }
    }
    const ultima = await env.DB.prepare("SELECT MAX(visto_em) as u FROM tv_lances WHERE dia = ?").bind(t.dia).first();
    if (ultima && ultima.u) {
      const idadeMs = Date.now() - new Date(ultima.u).getTime();
      if (idadeMs < 4 * 60 * 1000) {
        return new Response(JSON.stringify({ status: 'CACHE_FRESCO', idade_s: Math.round(idadeMs / 1000) }), { headers: cors });
      }
    }
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const { results: canalRows } = await env.DB.prepare(
    "SELECT r.codigo, UPPER(COALESCE(f.codigo, r.filial_id)) as filial FROM representantes r LEFT JOIN filiais f ON r.filial_id = f.id WHERE r.ativo = 1"
  ).all();
  if (!canalRows || !canalRows.length) {
    return new Response(JSON.stringify({ erro: 'nenhum representante ativo no D1' }), { status: 502, headers: cors });
  }

  // canal/supervisor por RCA: mesma fonte que a TV usa (planilha MOSTRA_DISPAROS via /api/tv-mostra)
  const canalMapa = new Map();
  try {
    const m = await getJson(`${origin}/api/tv-mostra`);
    const filiais = m?.filiais || {};
    for (const lista of Object.values(filiais)) {
      if (!Array.isArray(lista)) continue;
      for (const v2 of lista) if (v2 && v2.rca != null) canalMapa.set(String(v2.rca), { canal: String(v2.canal || '').toUpperCase(), sup: v2.supervisor || '' });
    }
  } catch {}

  const rcasPorFilial = {};
  for (const r of canalRows) (rcasPorFilial[r.filial] = rcasPorFilial[r.filial] || []).push(r.codigo);

  const FUSO1H = ['TCG', 'MCD', 'TCA'];
  let totalNovos = 0, totalFalhas = 0;
  const porFilial = {};

  for (const [filial, codigos] of Object.entries(rcasPorFilial)) {
    const vs = [];
    for (let i = 0; i < codigos.length; i += LOTE) {
      const lote = codigos.slice(i, i + LOTE);
      const resultados = await Promise.all(
        lote.map(async (codigo) => {
          const d = await getJson(`${origin}/api/tv-vendedor?filial=${filial}&id=${codigo}&central=1`);
          return { codigo, d };
        })
      );
      for (const { codigo, d } of resultados) {
        if (!d || d.erro || (d.falhas && d.falhas.length === 3)) { totalFalhas++; continue; }
        const info = canalMapa.get(String(codigo)) || {};
        const v = vend(codigo, info.canal, info.sup, d);
        v.fuso1h = FUSO1H.includes(filial);
        vs.push(v);
      }
    }
    if (!vs.length) continue;
    const lances = calcAlertas(vs, t);
    if (!lances.length) { porFilial[filial] = 0; continue; }

    const body = {
      filial,
      lances: lances.slice(0, 200).map((l) => ({
        chave: l.chave, nivel: l.nivel, rca: l.v?.id, vendedor: l.v?.nome, supervisor: l.v?.sup,
        cliente_id: l.c?.id, cliente: l.c?.nome || l.cliente, motivo: l.c?.motivo, dias_sem_compra: l.dias, ultima_compra: l.c?.ultima_compra, tempo_visita: l.c?.tempo_visita
      }))
    };
    const resReal = await fetch(`${origin}/api/tv-lances`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }).catch(() => null);
    const j = resReal && resReal.ok ? await resReal.json().catch(() => null) : null;
    const novos = j?.novos?.length || 0;
    totalNovos += novos;
    porFilial[filial] = novos;
  }

  return new Response(JSON.stringify({
    status: 'ATUALIZADO', dia: t.dia, hora: t.hms, filiais_processadas: Object.keys(porFilial).length,
    novos_lances: totalNovos, falhas_rca: totalFalhas, por_filial: porFilial, duracao_ms: Date.now() - t0
  }), { headers: cors });
}
