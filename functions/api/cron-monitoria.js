// =========================================================================
// API: GET/POST /api/cron-monitoria
// Agendador/executor do ciclo de Supervisores do MONITOR.IA (S1..S5).
// Protegido por chaveEvoValida ou chaveAdminOk.
// =========================================================================
import { chaveEvoValida } from '../_lib/chave_evo.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { executarCicloSupervisores } from '../_lib/monitoria/supervisores.js';

const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: J });

function regraDoHorarioSP() {
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  if (hhmm >= '07:30' && hhmm <= '08:15') return 'S1';
  if (hhmm >= '09:15' && hhmm <= '10:00') return 'S2';
  if (hhmm >= '10:15' && hhmm <= '11:00') return 'S3';
  if (hhmm >= '17:45' && hhmm <= '18:30') return 'S5';
  return 'S4';
}

async function handle(request, env, body = {}) {
  try {
    const evoOk = await chaveEvoValida(request, env);
    const admOk = !evoOk && await chaveAdminOk(env, request);
    if (!evoOk && !admOk) return resp({ erro: 'nao autorizado' }, 401);

    const u = new URL(request.url);
    const origin = u.origin;
    const regra = (body.regra || u.searchParams.get('regra') || 'auto').toUpperCase();
    const filiaisParam = body.filiais || (u.searchParams.get('filiais') ? u.searchParams.get('filiais').split(',') : null);
    const enviarVitorio = body.enviarVitorio === true || u.searchParams.get('teste') === '1';

    if (regra === 'AUTO') {
      const rHorario = regraDoHorarioSP();
      const saida = [];
      saida.push(await executarCicloSupervisores(origin, env, { regra: 'S4', filiais: filiaisParam, enviarVitorio }));
      if (rHorario !== 'S4') {
        saida.push(await executarCicloSupervisores(origin, env, { regra: rHorario, filiais: filiaisParam, enviarVitorio }));
      }
      return resp({ ok: true, modo: 'auto', regra_horario: rHorario, ciclos: saida });
    }

    return resp(await executarCicloSupervisores(origin, env, {
      regra,
      filiais: filiaisParam,
      enviarVitorio,
      celularVitorio: body.celularVitorio,
      forcar: body.forcar === true,
      limite: body.limite,
    }));
  } catch (e) {
    return resp({ ok: false, erro: String((e && e.message) || e) }, 500);
  }
}

export const onRequestGet = ({ request, env }) => handle(request, env, {});
export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch {}
  return handle(request, env, body);
}

