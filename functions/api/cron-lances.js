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

// IMPEDIMENTO POR GPS (auditoria de 05/10/2026, pedido do Vitorio): o check-out so vira Impedimento quando o dado e CONFIAVEL.
// Medido em 219 visitas de hoje: 49% dos check-outs vinham com ponto-padrao (o mesmo ponto em 55 visitas de 8 filiais, a centenas de km),
// e os que sobravam entre 5 e 20 km eram posicao parada/aproximada do palm (ex.: dois clientes diferentes com o MESMO check-out) ou
// coordenada de cadastro errada (check-out igual ao de outro vendedor, a 600 m). Valia -5 pontos na liga. Regra nova:
//   1) distancia entre 500 m e 5 km (acima disso e GPS aproximado/ponto-padrao, nao e o vendedor longe do cliente);
//   2) o ponto de check-out NAO pode se repetir (+-100 m) em outra visita do mesmo vendedor (repetido = GPS parado na ultima posicao).
const IMP_GPS_MIN_M = 500, IMP_GPS_MAX_M = 5000, IMP_GPS_REPETIDO_M = 100;
// PONTOS DA EMPRESA (confirmado pelo Vitorio em 05/10/2026 abrindo o pino do check-out no CEVEN: "deu na Triunfante"): quando o app nao
// capta o GPS do vendedor, o CEVEN grava o ENDERECO DA EMPRESA como posicao do check-out. 55 check-outs de 24 vendedores de 8 filiais
// em (-23,2493 / -45,9245) = Rua Miracema, Sao Jose dos Campos; outro ponto da empresa: Campinas.
// Check-out nesses pontos = GPS NAO CAPTURADO: nunca e Impedimento nem punicao (o vendedor nao tem culpa do aparelho/app).
// Confirmados pelo Vitorio (05/10/2026, vendo no mapa): A = Rua Miracema/SJC e C = Campinas sao Triunfante. Cascavel, Cruzeiro e Lins
// (pontos repetidos) NAO sao da empresa ('alguma casa', 'estranho'): ficam fora; sao tratados so pela regra de ponto repetido.
const PONTOS_EMPRESA_GPS = [[-23.2493, -45.9245], [-22.8952, -47.0475]];
const PONTO_EMPRESA_RAIO_M = 1000;
function checkoutNoPontoDaEmpresa(c) {
  return PONTOS_EMPRESA_GPS.some((p) => distanciaM(c.checkout_lat, c.checkout_lon, p[0], p[1]) <= PONTO_EMPRESA_RAIO_M);
}
function impedimentoGpsConfiavel(v, c, distM) {
  if (distM == null || !(distM > IMP_GPS_MIN_M && distM <= IMP_GPS_MAX_M)) return false;
  if (checkoutNoPontoDaEmpresa(c)) return false; // o CEVEN gravou o endereco da empresa no lugar do GPS
  const repetidos = (v.cl || []).filter((x) => x.checkout_lat && x.checkout_lon && x.checkout_lat !== 0 &&
    distanciaM(x.checkout_lat, x.checkout_lon, c.checkout_lat, c.checkout_lon) <= IMP_GPS_REPETIDO_M).length;
  return repetidos < 2; // 1 = so a propria visita; 2 ou mais = o mesmo ponto em varias visitas
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
import { qualificaGol, carteiraEfetiva } from '../_lib/qualificacao_gol.js';
import { garanteArvore } from '../_lib/arvore_ceven.js';
// Prova do gol de cliente: pedido de hoje (numero, status, valor) e, na dobradinha, os pedidos reais de cada quinzena do mes
function provaPedidoHoje(c) {
  const p = c && c.pedidoHoje;
  return p && p.num ? `PEDIDO DE HOJE: ${p.num} · ${p.status_pedido || 'sem status'} · ${brl(p.valor)}` : '';
}
function provaQuinzenas(c) {
  const q = c && c.quinzenas;
  if (!q) return '';
  const fmt = (g) => `${brl(g.valor)} (${g.pedidos.map((p) => p.data.slice(8, 10) + '/' + p.data.slice(5, 7) + ' ped ' + p.num + ' ' + brl(p.valor)).join('; ') || 'sem pedido'})`;
  return `QUINZENAS: total ${brl(q.q1.valor + q.q2.valor)} · 1a ${fmt(q.q1)} · 2a ${fmt(q.q2)}`;
}
// Nivel (bronze a platina) do gol que nao e de um cliente so: usa as industrias de TODOS os pedidos do vendedor no dia
const provaQ = (v) => (qualificaGol(v.carteira, { industrias: v.industriasDia, categorias: v.categoriasDia }) || {}).texto;
const comQ = (v, p) => [p, provaQ(v)].filter(Boolean).join(' | ');
function vend(id, canal, sup, d, carteira) {
  const cl = Array.isArray(d.clientes) ? d.clientes : null;
  const st = (s) => (cl ? cl.filter((c) => s.includes(c.status)).length : null);
  const feitas = cl ? cl.filter((c) => !['AGENDADO', 'ABERTO'].includes(c.status)).length : null;
  const campo = CAMPO.includes(canal);
  return {
    id, nome: d.nome, canal, sup: sup || '',     carteira: carteiraEfetiva(carteira, cl), campo, cl,
    industriasDia: Array.isArray(d.industrias_dia) ? d.industrias_dia : null, categoriasDia: Array.isArray(d.categorias_dia) ? d.categorias_dia : null,
    meta: num(d.meta_fat), fat: num(d.faturado),
    devolucoesHoje: Array.isArray(d.devolucoes_hoje) ? d.devolucoes_hoje : [],
    dig: num(d.dig_hoje), pos: num(d.pos_hoje),
    feitas, comVenda: st(['POSITIVADO', 'EFETIVADO']),
    temRota: !!(cl && cl.length)
  };
}
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

// Mesma lógica de calcAlertas() em tvapp.html/matrizapp.html — ver ficha do arquivo.
// PROVA DO LANCE (decisao do Vitorio, 05/10/2026): lance sem prova nao pode ser auditado. O lance do vendedor nasce de um numero do dia
// (visitas, digitado, devolucao...) e esse numero vai gravado em obs, para a auditoria conferir depois com o CEVEN.
const provaVisita = (c, txt) => [`check-in ${c.checkin_horario || 'sem hora'}`, `check-out ${c.checkout_horario || 'sem hora'}`, `tempo ${c.tempo_visita || 'sem dado'}`, txt].join(' | ').slice(0, 300);
const brl = (x) => 'R$ ' + Math.round(x || 0).toLocaleString('pt-BR');
function calcAlertas(vs, t) {
  const fuso1h = false; // aqui roda por filial; fuso1h é decidido por chamada (ver loop principal)
  const out = [];
  vs.forEach((v) => {
    if (!v.cl) return;
    if ((v.dig || 0) >= 15000) out.push({ chave: `gol_super|${v.id}`, nivel: 'gol', v, prova: comQ(v, `digitado do dia ${brl(v.dig)} (minimo R$ 15.000)`) });

    const checkins = horariosCheckinDoDia(v.cl);
    const ultimoCheckin = checkins.length ? checkins[checkins.length - 1] : null;
    if (ultimoCheckin && t.agoraMin - ultimoCheckin.horaMin <= FRESCOR_MAX_MIN) {
      const limiteRelampago = v.fuso1h ? 10 : 9;
      if (ultimoCheckin.hora < limiteRelampago) out.push({ chave: `gol_relampago|${v.id}`, nivel: 'gol', v, prova: comQ(v, `check-in as ${ultimoCheckin.hms} (antes das ${limiteRelampago}h)`) });
      // Acrescimos: check-in entre 16h30 e 18h00 (17h30 e 19h00 no fuso: TCG, MCD, TCA). Depois do limite NAO e aceito: ninguem trabalha fora do horario (Vitorio, 06/10/2026)
      const acrIni = (v.fuso1h ? 17 : 16) * 60 + 30, acrFim = (v.fuso1h ? 19 : 18) * 60;
      if (ultimoCheckin.horaMin >= acrIni && ultimoCheckin.horaMin <= acrFim) out.push({ chave: `gol_acrescimos|${v.id}`, nivel: 'gol', v, prova: comQ(v, `check-in as ${ultimoCheckin.hms} (janela ${Math.floor(acrIni / 60)}h${String(acrIni % 60).padStart(2, '0')} ate ${acrFim / 60}h00)`) });
    }
    if (checkins.length >= 3) {
      for (let i = 0; i <= checkins.length - 3; i++) {
        const janelaMin = checkins[i + 2].horaMin - checkins[i].horaMin;
        if (janelaMin <= 120 && janelaMin >= 0 && t.agoraMin - checkins[i + 2].horaMin <= FRESCOR_MAX_MIN) {
          out.push({ chave: `gol_hattrick|${v.id}|${checkins[i + 2].hms}`, nivel: 'hattrick', v, prova: comQ(v, `3 check-ins em ${janelaMin} min: ${checkins[i].hms}, ${checkins[i + 1].hms}, ${checkins[i + 2].hms}`) });
          break;
        }
      }
    }
    if ((v.meta || 0) > 0 && ultimoCheckin && t.agoraMin - ultimoCheckin.horaMin <= FRESCOR_MAX_MIN) {
      const { totalUteis, uteisAteHoje } = diasUteisMes(t.dia);
      const metaDiaria = totalUteis > 0 ? (v.meta / totalUteis) * uteisAteHoje : 0;
      if (metaDiaria > 0 && (v.dig || 0) >= metaDiaria && ultimoCheckin.hora < 14) out.push({ chave: `gol_meta1t|${v.id}`, nivel: 'gol', v, prova: comQ(v, `digitado ${brl(v.dig)} >= meta proporcional do dia ${brl(metaDiaria)}; check-in as ${ultimoCheckin.hms}`) });
    }
    if ((v.feitas || 0) >= 8 && v.comVenda != null) {
      const txConv = v.feitas > 0 ? (v.comVenda / v.feitas) * 100 : 0;
      if (txConv >= 50) out.push({ chave: `gol_conversao|${v.id}`, nivel: 'gol', v, prova: comQ(v, `${v.comVenda} com venda em ${v.feitas} visitas = ${Math.round(txConv)}%`) });
    }
    // Goleada = 10 ou mais CLIENTES positivados, comprovados na rota (status POSITIVADO/EFETIVADO). A contagem de pedidos do CEVEN (positivacao) NAO prova clientes:
    // 06/10/2026, MCD 420: 12 pedidos de R$ 164 em media, 0 visitas, 0 clientes positivados na rota.
    if ((v.comVenda || 0) >= 10) out.push({ chave: `gol_goleada|${v.id}`, nivel: 'gol', v, prova: comQ(v, `${v.comVenda} clientes positivados na rota (${v.pos || 0} pedidos, digitado ${brl(v.dig)})`) });
    if ((v.meta || 0) > 0 && (v.fat || 0) >= v.meta) out.push({ chave: `gol_campeao|${v.id}|${t.dia.slice(0, 7)}`, nivel: 'gol', v, prova: `faturado do mes ${brl(v.fat)} >= meta ${brl(v.meta)}` });

    (v.devolucoesHoje || []).forEach((dv) => {
      if (!dv.nota) return;
      const base = `nota ${dv.nota} de ${dv.data || '?'} | ${brl(dv.valor)} | ${dv.cliente || 'cliente sem nome'} | motivo oficial: ${dv.motivos || 'sem motivo'}`;
      if (dv.naoPediu === true) out.push({ chave: `ver_dev|${v.id}|${dv.nota}`, nivel: 'vermelho', v, valor: dv.valor, cliente: dv.cliente, cid: dv.cid, prova: base });
      else if (dv.naoPediu === false && DEV_MOTIVO_COMERCIAL.test(dv.motivos || '')) out.push({ chave: `golcontra_dev|${v.id}|${dv.nota}`, nivel: 'golcontra', v, valor: dv.valor, cliente: dv.cliente, cid: dv.cid, prova: base });
    });

    v.cl.forEach((c) => {
      const diasC = diasDesde(c.ultima_compra, t.dia);
      const ehInativo = diasC != null && diasC > 30;
      const ehRecorrencia = !!c.recorrencia;
      const tagsConhecidas = c.recorrencia !== null; // false = informou e nao tem; null = nao informou (nao cria gol de resgate)
      // RECORRENCIA = DEFESA (+3), nunca gol (decisao do Vitorio, 05/10/2026): antes o mesmo cliente com a tag gerava gol de
      // resgate (+6) E defesa (+3). O gol de resgate fica so para cliente parado ha mais de 30 dias SEM a tag.
      if (['POSITIVADO', 'EFETIVADO'].includes(c.status) && ehInativo && !ehRecorrencia && tagsConhecidas) {
        out.push({ chave: `gol_inativo|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: [provaPedidoHoje(c), (qualificaGol(v.carteira, c) || {}).texto].filter(Boolean).join(' | ') });
      }
      if (['POSITIVADO', 'EFETIVADO'].includes(c.status) && c.checkin_horario) {
        out.push({ chave: `pedido_rota|${v.id}|${c.id}`, nivel: 'pedido_rota', v, c, prova: [provaPedidoHoje(c), (qualificaGol(v.carteira, c) || {}).texto].filter(Boolean).join(' | ') });
      }
      if (c.dobrouMix) out.push({ chave: `gol_mix|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: [provaPedidoHoje(c), (qualificaGol(v.carteira, c) || {}).texto].filter(Boolean).join(' | ') });
      if (c.dobradinhaQuinzenas) out.push({ chave: `gol_quinzenas|${v.id}|${c.id}`, nivel: 'gol', v, c, prova: [provaPedidoHoje(c), provaQuinzenas(c), (qualificaGol(v.carteira, c) || {}).texto].filter(Boolean).join(' | ') });
      if (c.bonificacao) out.push({ chave: `ver_bonif|${v.id}|${c.id}`, nivel: 'vermelho', v, c });
      if (c.recorrencia && ['POSITIVADO', 'EFETIVADO'].includes(c.status)) out.push({ chave: `def|${v.id}|${c.id}`, nivel: 'defesa', v, c });
      if (v.campo) {
        const distM = distanciaM(c.lat, c.lon, c.checkout_lat, c.checkout_lon);
        if (impedimentoGpsConfiavel(v, c, distM)) out.push({ chave: `imp|gps|${v.id}|${c.id}`, nivel: 'impedimento', v, c, prova: provaVisita(c, `check-out a ${Math.round(distM)} m do cadastro do cliente; cadastro ${c.lat},${c.lon}; check-out ${c.checkout_lat},${c.checkout_lon}`) });
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
        out.push({ chave: `imp|visita0|${v.id}|${c.id}`, nivel: 'impedimento', v, c, prova: provaVisita(c, 'visita de 00:00 (sem permanencia)') });
      }
    });

    // Amarelo as 10h (11h no fuso): rota ativa sem nenhum pedido e/ou sem nenhuma visita (inclui quem nao fez nenhum check-in de varejo).
    // Vermelho de abandono as 11h (12h no fuso): rota ativa ainda sem nenhuma visita feita. Regra de 06/10/2026 (antes o vermelho era as 10h).
    const limAmarelo = v.fuso1h ? 11 : 10, limVermelho = v.fuso1h ? 12 : 11;
    const hh = String(t.h).padStart(2, '0');
    if (v.campo && v.temRota && t.h >= limAmarelo && t.h < 19 && (v.feitas === 0 || (!(v.dig > 0) && !(v.pos > 0)))) {
      out.push({ chave: `ven10|${v.id}`, nivel: 'amarelo', v, prova: v.feitas === 0 ? `nenhuma visita nem check-in de varejo (${v.cl.length} clientes na rota) as ${hh}h (limite ${limAmarelo}h)` : `${v.feitas} visitas feitas, 0 pedidos e digitado R$ 0 as ${hh}h (limite ${limAmarelo}h)` });
    }
    if (v.campo && v.temRota && t.h >= limVermelho && t.h < 19 && v.feitas === 0) {
      out.push({ chave: `vis11|${v.id}`, nivel: 'vermelho', v, prova: `${v.cl.length} clientes na rota, 0 visitas feitas as ${hh}h (limite ${limVermelho}h)` });
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

// DEVOLUCOES (Vitorio, 05/10/2026: "devolucao nao fez pedido e PENALTI gravissimo, o endpoint esta na cara do gol"):
// fonte = lista oficial do CEVEN (/api/rca/devolucoes, ja guardada pela varredura) + motivo oficial por nota
// (/api/rca/devolucoes/{nota}). motivo CLIENTE NAO PEDIU = Cartao Vermelho (-10); qualquer outro motivo = Gol Contra (-4).
// Nota sem motivo confirmado NAO gera lance (nunca assume). Janela: notas do mes corrente; uma nota gera UM lance (tv-lances nao repete).
const CEVEN_API = 'https://ceven.drivetriunfante-locomotiva.com.br';
const DEV_MAX_MOTIVOS_POR_RODADA = 90; // a janela e o MES CORRENTE (Vitorio, 05/10/2026: "desde 01/10"); o que nao couber numa rodada entra na proxima
// Gol Contra so para motivo COMERCIAL (Vitorio, 05/10/2026: "so registre os motivos comerciais"). Estoque/logistica/ambiguo nao pune.
const DEV_MOTIVO_COMERCIAL = /SEM DINHEIRO|COND.{1,3}PAGTO|EMITIU COD|PEDIDO DUPLICADO|RECUSOU MERC|PRECO DIFERENTE/;
async function carregaDevolucoes(env, t, filialDoRca) {
  const out = new Map();
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS devolucao_nota_motivo (rca TEXT NOT NULL, nota TEXT NOT NULL, nao_pediu INTEGER, motivos TEXT, resolvido_em TEXT, PRIMARY KEY (rca, nota))').run();
    const { results } = await env.DB.prepare('SELECT rca_codigo, devolucoes_json FROM varredura_central_rca WHERE data_ref = ? AND devolucoes_json IS NOT NULL').bind(t.dia).all();
    const notas = [];
    for (const r of results || []) {
      let lista = null; try { lista = JSON.parse(r.devolucoes_json); } catch { continue; }
      if (!Array.isArray(lista)) continue;
      for (const n of lista) {
        const idade = diasDesde(String(n.data || '').slice(0, 10), t.dia);
        if (!n.numnota || idade == null || idade < 0 || idade > +t.dia.slice(8, 10) - 1) continue; // so notas do mes corrente
        if (!(Number(n.vl_devolvido) > 0)) continue; // nota de R$ 0 = bonificacao voltando (Vitorio, 05/10/2026): nao e devolucao de venda, nao registra
        notas.push({ rca: String(r.rca_codigo), nota: String(n.numnota), valor: Number(n.vl_devolvido) || 0, cliente: n.nomecli || null, cid: n.codcli ? String(n.codcli) : null, data: String(n.data).slice(0, 10) });
      }
    }
    const { results: ja } = await env.DB.prepare('SELECT rca, nota, nao_pediu FROM devolucao_nota_motivo').all();
    const cache = new Map((ja || []).map((x) => [x.rca + '|' + x.nota, x.nao_pediu]));
    const faltam = notas.filter((n) => !cache.has(n.rca + '|' + n.nota)).slice(0, DEV_MAX_MOTIVOS_POR_RODADA);
    for (let i = 0; i < faltam.length; i += 6) {
      await Promise.all(faltam.slice(i, i + 6).map(async (n) => {
        const fil = filialDoRca.get(n.rca); if (!fil) return;
        const det = await getJson(`${CEVEN_API}/api/rca/devolucoes/${encodeURIComponent(n.nota)}?filial=${fil.toLowerCase()}1&id=${n.rca}`);
        if (!Array.isArray(det) || !det.length) return; // sem detalhe: nao assume nada
        const motivos = [...new Set(det.map((x) => String(x.motivo || '').trim().toUpperCase()).filter(Boolean))];
        if (!motivos.length) return;
        const naoPediu = motivos.some((m) => m.includes('NAO PEDIU') || m.includes('NÃO PEDIU')) ? 1 : 0;
        await env.DB.prepare("INSERT OR REPLACE INTO devolucao_nota_motivo (rca, nota, nao_pediu, motivos, resolvido_em) VALUES (?, ?, ?, ?, datetime('now'))").bind(n.rca, n.nota, naoPediu, motivos.join(' / ').slice(0, 200)).run();
        cache.set(n.rca + '|' + n.nota, naoPediu);
      }));
    }
    const { results: mot } = await env.DB.prepare('SELECT rca, nota, motivos FROM devolucao_nota_motivo').all();
    const motivoDe = new Map((mot || []).map((x) => [x.rca + '|' + x.nota, x.motivos]));
    for (const n of notas) {
      const np = cache.get(n.rca + '|' + n.nota);
      if (np == null) continue;
      (out.get(n.rca) || out.set(n.rca, []).get(n.rca)).push({ nota: n.nota, valor: n.valor, cliente: n.cliente, cid: n.cid, data: n.data, naoPediu: np === 1, motivos: motivoDe.get(n.rca + '|' + n.nota) || '' });
    }
  } catch (e) { /* sem devolucao nesta rodada: nunca inventa */ }
  return out;
}

export async function onRequestGet({ env, request }) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!env.DB) return new Response(JSON.stringify({ erro: 'D1 (env.DB) não configurado' }), { status: 503, headers: cors });

  const t0 = Date.now();
  const t = agoraSP();
  // TRAVA DA MADRUGADA (06/10/2026): a meia-noite o CEVEN ainda serve o roteiro de ONTEM com o dia novo; o coletor registrava os lances de ontem como se
  // fossem de hoje (845 lances em 06/10, 793 repetidos de 05/10; 1.813 em 01/10). Antes das 06h nao ha venda do dia: nao coleta nada.
  if (t.h < 6 && !new URL(request.url).searchParams.has('madrugada')) {
    return new Response(JSON.stringify({ status: 'MADRUGADA_SEM_COLETA', dia: t.dia, hora: t.hms }), { headers: cors });
  }
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

  // canal/supervisor por RCA: mesma fonte que a TV usa (Gestao de Equipe via /api/tv-mostra)
  const canalMapa = new Map();
  try {
    const m = await getJson(`${origin}/api/tv-mostra`);
    const filiais = m?.filiais || {};
    for (const lista of Object.values(filiais)) {
      if (!Array.isArray(lista)) continue;
      for (const v2 of lista) if (v2 && v2.rca != null) canalMapa.set(String(v2.rca), { canal: String(v2.canal || '').toUpperCase(), sup: v2.supervisor || '', carteira: String(v2.carteira || '').toUpperCase() });
    }
  } catch {}

  const rcasPorFilial = {};
  // LISTA = banco (representantes) + PLANILHA (tv-mostra): vendedor novo entra na planilha antes de entrar no banco (05/10/2026: RCAs 1121-1128 e 1097 ficavam fora da varredura,
  // da Executiva e do painel do mes; ex.: Jeferson/TPA R$ 93,7 mil faturados nao apareciam). Nunca inventa: so soma quem a planilha lista.
  try {
    const jaTem = new Set(canalRows.map((r) => String(r.codigo)));
    const mp = await (await fetch(new URL('/api/tv-mostra', request.url), { signal: AbortSignal.timeout(8000) })).json();
    for (const [sg, lista] of Object.entries((mp && mp.filiais) || {})) for (const x of Array.isArray(lista) ? lista : []) {
      if (x && x.rca != null && !jaTem.has(String(x.rca))) { canalRows.push({ codigo: String(x.rca), filial: String(sg).toUpperCase() }); jaTem.add(String(x.rca)); }
    }
  } catch { /* sem planilha: segue so com o banco */ }
  for (const r of canalRows) (rcasPorFilial[r.filial] = rcasPorFilial[r.filial] || []).push(r.codigo);
  const devPorRca = await carregaDevolucoes(env, t, new Map(canalRows.map((r) => [String(r.codigo), r.filial])));

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
        const v = vend(codigo, info.canal, info.sup, d, info.carteira);
        v.fuso1h = FUSO1H.includes(filial);
        v.devolucoesHoje = devPorRca.get(String(codigo)) || [];
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
        cliente_id: l.c?.id || l.cid, cliente: l.c?.nome || l.cliente, motivo: l.c?.motivo, dias_sem_compra: l.dias, ultima_compra: l.c?.ultima_compra, tempo_visita: l.c?.tempo_visita, obs: l.prova || null
      }))
    };
    const resReal = await fetch(`${origin}/api/tv-lances`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }).catch(() => null);
    const j = resReal && resReal.ok ? await resReal.json().catch(() => null) : null;
    const novos = j?.novos?.length || 0;
    totalNovos += novos;
    porFilial[filial] = novos;
  }

  // Semana Invicta: confere a semana fechada (sexta apos as 19h) e grava o lance. Idempotente; so custa uma leitura rapida quando nao ha nada a fazer.
  let invicta = 'pulado';
  try { const ri = await fetch(`${origin}/api/cron-semana-invicta`, { signal: AbortSignal.timeout(40000) }); const ji = await ri.json().catch(() => ({})); invicta = ji.status || String(ri.status); } catch { invicta = 'falhou'; }

  // Arvore viva do CEVEN (supervisor de cada vendedor muda todo dia): renova se passou de 45 min
  let arvore = 'pulado';
  try { if (t.h >= 5) { const a = await garanteArvore(env, 45); arvore = a.status + (a.filiais_falharam && a.filiais_falharam.length ? ' (falharam: ' + a.filiais_falharam.join(',') + ')' : ''); } } catch { arvore = 'falhou'; }

  // AUDITORIA LANCE POR LANCE (Vitório, 06/10/2026): a cada ~30 min (e depois do fechamento) confere a prova de cada lance que conta pontos
  let auditoria = 'pulado';
  if (t.h >= 8 && (t.m % 30) < 5) {
    try { const ra = await fetch(`${origin}/api/cron-auditoria-lances?rodar=1`, { signal: AbortSignal.timeout(60000) }); const ja = await ra.json().catch(() => ({})); auditoria = ja.auditado ? `${ja.com_falha} falha(s) em ${ja.auditados}` : (ja.status || String(ra.status)); } catch { auditoria = 'falhou'; }
  }

  // FECHAMENTO E CONFERENCIA DO DIA (Vitório, 06/10/2026: "tem que estar tudo cravado"): depois das 19h30 congela o dia da liga e confere o D1 contra o CEVEN (fatias de 60 vendedores)
  let fechamento = 'pulado', conferencia = 'pulado';
  if (t.agoraMin >= 19 * 60 + 30) {
    try { const rf = await fetch(`${origin}/api/cron-fechamento-dia`, { signal: AbortSignal.timeout(50000) }); const jf = await rf.json().catch(() => ({})); fechamento = jf.status || String(rf.status); } catch { fechamento = 'falhou'; }
    try { const rc = await fetch(`${origin}/api/cron-conferencia-dia?rodar=1`, { signal: AbortSignal.timeout(60000) }); const jc = await rc.json().catch(() => ({})); conferencia = jc.conferidos != null ? `${jc.conferidos}/${jc.total} (${(jc.divergentes || []).length} divergencia(s))` : String(rc.status); } catch { conferencia = 'falhou'; }
  }

  return new Response(JSON.stringify({
    status: 'ATUALIZADO', dia: t.dia, hora: t.hms, semana_invicta: invicta, arvore, auditoria, fechamento, conferencia, filiais_processadas: Object.keys(porFilial).length,
    novos_lances: totalNovos, falhas_rca: totalFalhas, por_filial: porFilial, duracao_ms: Date.now() - t0
  }), { headers: cors });
}
