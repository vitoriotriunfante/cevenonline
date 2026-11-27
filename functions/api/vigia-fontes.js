// =========================================================================
// FICHA DO ARQUIVO: functions/api/vigia-fontes.js   (GET, worker-cron a cada 15 min, seg-sab 07h-21h)
// O QUE E: ALARME DE FONTE PARADA (Vitorio, 22/11/2026: "vamos correr o risco de ficar fora? tudo tem redundancia?").
//   Confere a hora da ultima leitura de cada fonte no D1 e manda WhatsApp para o Vitorio quando uma passa do limite.
//   1 aviso por fonte por dia; quando a fonte volta, avisa que voltou. So le o D1 (nao chama o CEVEN, o GEROT nem o Clube).
// LIMITES (horario de Brasilia): Clube 60 min (roda de 30 em 30) · GEROT 3h (atualiza de 2 em 2) · CEVEN compromisso/RET 45 min (06h-20h)
//   · lances da Liga 90 min (09h-19h, dia util) · agendador: se este vigia nao rodar ha 40 min, a propria rodada seguinte avisa.
// Chave: x-chave (jota_admin_token) ou MONITORIA_CRON_KEY do worker. ?teste=1 = so devolve o quadro, nao avisa.
// =========================================================================
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { chaveEvoValida } from '../_lib/chave_evo.js';
import { ehFeriado } from '../_lib/feriados.js';
import R from '../../public/regras.js';

const J = (o, s = 200) => new Response(JSON.stringify(o, null, 1), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const VITORIO = '554187525605';
const minDesde = (iso) => { if (!iso) return Infinity; const s = String(iso); const t = Date.parse(/T/.test(s) ? s : s.replace(' ', 'T') + 'Z'); return isNaN(t) ? Infinity : (Date.now() - t) / 60000; };

export async function onRequest({ request, env }) {
  const u = new URL(request.url), k = request.headers.get('x-chave') || u.searchParams.get('chave') || '';
  const soSaude = u.searchParams.get('saude') === '1';   // 22/11/2026: painel de saude (public/saude.html) — so horas de leitura, sem dado de venda, sem chave
  if (!soSaude && !(await chaveAdminOk(env, request)) && !(env.MONITORIA_CRON_KEY && k === env.MONITORIA_CRON_KEY) && !(await chaveEvoValida(request, env))) return J({ erro: 'nao autorizado' }, 401);
  const db = env.DB, rel = R.relogioSP(), dia = rel.dia, h = rel.h, util = !ehFeriado(dia) && new Date(dia + 'T12:00:00Z').getUTCDay() >= 1 && new Date(dia + 'T12:00:00Z').getUTCDay() <= 5;
  const um = async (sql, ...b) => { try { const r = await db.prepare(sql).bind(...b).first(); return { ok: true, v: r ? Object.values(r)[0] : null }; } catch (e) { return { ok: false, erro: String(e && e.message || e).slice(0, 80) }; } };
  const clubeR = await um('SELECT MAX(lido_em) FROM clube_rodada WHERE dia = ?', dia);
  const clubeRes = (clubeR.ok && !clubeR.v) ? await um('SELECT MAX(lido_em) FROM clube_venda_dia WHERE dia = ?', dia) : clubeR;
  const partnerRes = await um("SELECT MAX(ultimo_sync_em) FROM ceven_api_cursor WHERE status = 'ok'");
  const F = [];
  F.push({ id: 'clube', nome: 'Clube da Venda', r: clubeRes, lim: 45, vale: h >= 8 && h <= 20 });
  F.push({ id: 'ceven_partner', nome: 'CEVEN Partner API', r: partnerRes, lim: 30, vale: partnerRes.ok && !!partnerRes.v && h >= 7 && h <= 21 });
  F.push({ id: 'gerot', nome: 'GEROT', r: await um('SELECT MAX(em) FROM gerot_coleta_status'), lim: 180, vale: h >= 9 && h <= 21 });
  F.push({ id: 'ceven_sup', nome: 'CEVEN admin (compromisso e RET)', r: await um('SELECT MAX(atualizado_em) FROM supervisores_dia WHERE data_ref = ?', dia), lim: 45, vale: h >= 7 && h <= 19 });
  F.push({ id: 'liga', nome: 'Lances da Liga', r: await um("SELECT MAX(visto_em) FROM tv_lances WHERE dia = ? AND nivel <> 'marker'", dia), lim: 45, vale: util && h >= 10 && h <= 19 });
  F.push({ id: 'vigia', nome: 'Agendador (worker-cron)', r: await um("SELECT valor FROM config_flags WHERE chave = 'vigia_ultima'"), lim: 40, vale: h >= 8 && h <= 20 });
  F.push({ id: 'wa_inbound', nome: 'WhatsApp (entrada Evolution)', r: await um("SELECT MAX(quando) FROM bot_msgs WHERE direcao = 'in'"), lim: 45, vale: util && h >= 8 && h <= 19 });
  const quadro = F.map((f) => {
    const ult = f.r.ok ? f.r.v : null;
    const min = f.r.ok && Number.isFinite(minDesde(ult)) ? Math.round(minDesde(ult)) : null;
    return { fonte: f.nome, ultima: ult, minutos: min, limite: f.lim, vale_agora: f.vale, parada: f.r.ok && f.vale && minDesde(ult) > f.lim, erro_d1: !f.r.ok };
  });
  if (u.searchParams.get('teste') === '1' || soSaude) return J({ dia, hora: rel.hm, quadro });
  const avisos = [], marcar = [];
  for (const f of F) {
    if (!f.r.ok) continue; // erro transitorio no D1 jamais dispara falso alarme de fonte parada
    const ult = f.r.v;
    const parada = f.vale && minDesde(ult) > f.lim && !(f.id === 'vigia' && !ult), chave = `vigia_${f.id}_${dia}`;
    const jaRes = await um('SELECT valor FROM config_flags WHERE chave = ?', chave);
    if (!jaRes.ok) continue;
    const ja = jaRes.v;
    if (parada && ja !== 'parada') {
      const m = minDesde(ult);
      avisos.push(`⚠️ *${f.nome} parou*: última leitura ${Number.isFinite(m) ? `há ${Math.round(m)} min` : 'nenhuma hoje'} (limite ${f.lim} min). As respostas e telas que dependem dela ficam com o último dado.`);
      marcar.push([chave, 'parada']);
    } else if (!parada && ja === 'parada') {
      avisos.push(`✅ *${f.nome} voltou* (última leitura há ${Math.round(minDesde(ult))} min).`);
      marcar.push([chave, 'ok']);
    }
  }
  // ?externo=1 (reserva do GitHub) NAO marca a passagem do agendador: se o worker-cron parar, a reserva enxerga e avisa
  if (u.searchParams.get('externo') !== '1') await db.prepare("INSERT INTO config_flags (chave, valor) VALUES ('vigia_ultima', ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor").bind(new Date().toISOString()).run();
  // so marca 'avisei' se a mensagem SAIU (inventario 22/11: marcava antes e nunca repetia)
  let envio = null;
  if (avisos.length) { try { const { enviar } = await import('../_lib/jota/base.js'); envio = await enviar(env, VITORIO, `🛰️ *Vigia das fontes* · ${rel.hm}\n\n` + avisos.join('\n\n'), { alertaOperacional: true }); } catch (e) { envio = { ok: false, erro: String(e.message || e).slice(0, 80) }; } }
  if (envio && envio.ok) for (const [ch, val] of marcar) await db.prepare('INSERT INTO config_flags (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor').bind(ch, val).run();
  return J({ dia, hora: rel.hm, avisos: avisos.length, envio, quadro });
}
