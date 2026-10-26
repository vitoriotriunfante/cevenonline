// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/supervisores_coleta.js
// O QUE É: COMPROMISSOS e RET dos supervisores na BASE ÚNICA (Vitório, 26/10/2026; docs/BASE_UNICA.md §4). Antes /api/tv-supervisores, a semana e o
//   motor do WhatsApp liam isso AO VIVO do CEVEN e nada ficava gravado.
// QUEM CHAMA: só o coletor (functions/api/cron-varredura-central.js), a cada rodada; esta função decide se é hora:
//   - compromissos (matriz-compromissos, 1 chamada para a rede): a cada 5 min das 06:00 às 10:30 (prazo do compromisso é 10h); depois, 1x por hora até 19h.
//   - RET (matriz-ret, 1 chamada para a rede): a cada 15 min das 07:00 às 19:30 (supervisor faz ~1 visita a cada 30 min).
//   - detalhe do RET (admin/ret/periodo, 1 por supervisor que iniciou rota): junto com a RET.
// GRAVA: supervisores_dia (data_ref, tipo, json, atualizado_em) e supervisores_ret_detalhe (data_ref, filial, supervisor, json, atualizado_em).
// CAMINHO: admin (token compartilhado), fora da cota de /api/rca/*. Nunca inventa: falhou, mantém o último gravado.
// =========================================================================
import { tokenAdmin } from './ceven_admin_token.js';
import { CEVEN_APP_SECRET } from './ceven_auth.js';
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';

async function getJson(url, tk, ms = 20000) {
  try {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET }, signal: AbortSignal.timeout(ms) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function tabelas(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS supervisores_dia (data_ref TEXT NOT NULL, tipo TEXT NOT NULL, json TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (data_ref, tipo))').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS supervisores_ret_detalhe (data_ref TEXT NOT NULL, filial TEXT NOT NULL, supervisor TEXT NOT NULL, json TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (data_ref, filial, supervisor))').run();
}
const idadeMin = (t) => (t ? (Date.now() - Date.parse(String(t).replace(' ', 'T') + 'Z')) / 60000 : Infinity);
const feito = (s) => !!(s && ((s.porDia && s.porDia[0]) || (s.dias && s.dias[0])));

export async function coletaSupervisores(env, forcar = false) {
  if (!env.DB || !env.CEVEN_ADMIN_USER) return { status: 'SEM_D1_OU_SEGREDO' };
  await tabelas(env);
  const rel = R.relogioSP(), dia = rel.dia, m = rel.min, res = {};
  const { results } = await env.DB.prepare('SELECT tipo, atualizado_em FROM supervisores_dia WHERE data_ref = ?').bind(dia).all();
  const ult = new Map((results || []).map((x) => [x.tipo, x.atualizado_em]));
  const querComp = forcar || (m >= 6 * 60 && m <= 10 * 60 + 30 ? idadeMin(ult.get('compromissos')) >= 5 : m <= 19 * 60 && idadeMin(ult.get('compromissos')) >= 60);
  const querRet = forcar || (m >= 7 * 60 && m <= 19 * 60 + 30 && idadeMin(ult.get('ret')) >= 15);
  if (!querComp && !querRet) return { status: 'nao_e_hora' };
  const tk = await tokenAdmin(env);
  if (!tk) return { status: 'login_admin_falhou' };
  const grava = (tipo, j) => env.DB.prepare("INSERT INTO supervisores_dia (data_ref, tipo, json, atualizado_em) VALUES (?, ?, ?, datetime('now')) ON CONFLICT (data_ref, tipo) DO UPDATE SET json = excluded.json, atualizado_em = excluded.atualizado_em").bind(dia, tipo, JSON.stringify(j)).run();
  if (querComp) {
    const comp = await getJson(`${CEVEN}/api/admin/supervisores/matriz-compromissos?dataInicio=${dia}&dataFim=${dia}`, tk);
    if (comp) { await grava('compromissos', comp); res.compromissos = (comp.supervisores || []).length; } else res.compromissos = 'falhou';
  }
  if (querRet) {
    const ret = await getJson(`${CEVEN}/api/admin/supervisores/matriz-ret?dataInicio=${dia}&dataFim=${dia}`, tk);
    if (ret) {
      await grava('ret', ret);
      const comRota = (ret.supervisores || []).filter(feito);
      res.ret = (ret.supervisores || []).length; res.ret_iniciados = comRota.length; res.detalhes = 0;
      for (let i = 0; i < comRota.length; i += 6) {
        await Promise.all(comRota.slice(i, i + 6).map(async (s) => {
          const fil = String(s.filial || '').toLowerCase();
          if (!/^[a-z]{3}1$/.test(fil)) return;
          const det = await getJson(`${CEVEN}/api/admin/ret/periodo?filial=${fil}&supervisorName=${encodeURIComponent(s.nome)}&dataInicio=${dia}&dataFim=${dia}`, tk);
          if (!det) return;
          await env.DB.prepare("INSERT INTO supervisores_ret_detalhe (data_ref, filial, supervisor, json, atualizado_em) VALUES (?, ?, ?, ?, datetime('now')) ON CONFLICT (data_ref, filial, supervisor) DO UPDATE SET json = excluded.json, atualizado_em = excluded.atualizado_em")
            .bind(dia, fil, String(s.nome), JSON.stringify(det)).run();
          res.detalhes++;
        }));
      }
    } else res.ret = 'falhou';
  }
  return res;
}

// LEITURA (telas e WhatsApp): o que a base tem hoje. null = sem dado (a tela mostra "sem dado", nunca vai ao CEVEN)
export async function lerSupervisoresDia(env, dia) {
  try {
    await tabelas(env);
    const { results } = await env.DB.prepare('SELECT tipo, json, atualizado_em FROM supervisores_dia WHERE data_ref = ?').bind(dia).all();
    const o = {};
    for (const r of results || []) o[r.tipo] = { j: JSON.parse(r.json), em: r.atualizado_em };
    const { results: det } = await env.DB.prepare('SELECT filial, supervisor, json FROM supervisores_ret_detalhe WHERE data_ref = ?').bind(dia).all();
    o.detalhe = new Map((det || []).map((d) => [d.filial + '|' + d.supervisor, JSON.parse(d.json)]));
    return o;
  } catch { return null; }
}
