/**
 * FICHA DO ARQUIVO
 * O QUE É: VIGIA dos disparos oficiais de WhatsApp (Vitório, 05/10/2026). Em 05/10 o disparo das 17:00 saiu no horário certo,
 *          mas a GitHub ficou 15 min sem máquina ("The job was not acquired by Runner") e o job foi cancelado sem enviar nada.
 *          Ninguém foi avisado. Agora, a cada 2 minutos, o vigia confere se cada disparo oficial do dia realmente começou.
 * REGRA:   passados 8 min do horário, se o disparo NÃO começou (sem run, run parada na fila sem máquina, ou run que falhou/foi
 *          cancelada SEM ter executado nenhum passo), ele cancela a run parada e dispara UMA vez de novo. Run que já executou passos
 *          (pode ter mandado mensagem) NUNCA é refeita: duplicaria mensagem para os gerentes. Máximo de 2 tentativas por horário.
 * AVISO:   quem avisa o Vitório é a Matriz (faixa vermelha, /api/disparo-status). Este worker não envia WhatsApp (ver ficha do index.js).
 * LÊ/ESCREVE: só a API do GitHub (listar runs, cancelar run parada, disparar workflow).
 */
const REPO = 'vitoriotriunfante/cevenonline';
const REF = 'main';
export const ESPERA_MIN = 8;   // minutos depois do horario oficial para considerar que "nao comecou"
export const JANELA_MIN = 45;  // depois disso nao se refaz mais (mensagem velha demais)

// horario oficial (BRT) -> workflow e inputs (espelha GATILHOS de index.js, so os que mandam mensagem de verdade)
export const SLOTS = [
  { hm: '07:45', workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '07:45', destino: 'todos' } },
  { hm: '10:00', workflow: 'ceven-cron-marca-propria.yml', inputs: {} },
  { hm: '11:30', workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '11:30', destino: 'todos' } },
  { hm: '14:30', workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '14:30', destino: 'todos' } },
  { hm: '17:00', workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '17:00', destino: 'todos' } },
  { hm: '18:30', workflow: 'ceven-cron-whatsapp.yml', inputs: { ciclo: '18:30', destino: 'todos' } }
];
const FERIADOS = ['2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25'];

function agoraBrt(now = new Date()) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(now).forEach((x) => (p[x.type] = x.value));
  return { iso: `${p.year}-${p.month}-${p.day}`, ano: +p.year, mes: +p.month, dia: +p.day, util: !['Sat', 'Sun'].includes(p.weekday) };
}
export const diaUtilBrt = (now) => { const b = agoraBrt(now); return b.util && !FERIADOS.includes(b.iso); };
export function inicioSlotMs(hm, now = new Date()) {
  const b = agoraBrt(now); const [h, m] = hm.split(':').map(Number);
  return Date.UTC(b.ano, b.mes - 1, b.dia, h + 3, m); // Brasil sem horario de verao: UTC = BRT + 3
}

// Estado de um horario a partir das runs (funcao pura: usada pelo vigia e igual a do endpoint /api/disparo-status).
// runs: [{id, status, conclusion, created_at}]; jobsIniciados(runId) -> true se algum passo do job executou
export function estadoSlot(runs, ini, agora, jobsIniciados = () => false) {
  const cand = (runs || []).filter((r) => { const t = Date.parse(r.created_at); return t >= ini - 3 * 60000 && t <= ini + JANELA_MIN * 60000; });
  const idade = (agora - ini) / 60000;
  if (cand.some((r) => r.conclusion === 'success')) return { estado: 'ok', cand };
  if (cand.some((r) => r.status === 'in_progress')) return { estado: 'rodando', cand };
  if (idade < ESPERA_MIN) return { estado: 'aguardando', cand };
  const paradas = cand.filter((r) => ['queued', 'waiting', 'pending', 'requested'].includes(r.status) && (agora - Date.parse(r.created_at)) / 60000 >= ESPERA_MIN);
  const semInicio = cand.filter((r) => r.status === 'completed' && !jobsIniciados(r.id));
  const comInicio = cand.filter((r) => r.status === 'completed' && r.conclusion !== 'success' && jobsIniciados(r.id));
  if (comInicio.length) return { estado: 'falhou_apos_iniciar', cand, paradas, semInicio, comInicio }; // pode ter enviado parte: nao refaz
  if (cand.length >= 2) return { estado: 'esgotado', cand, paradas, semInicio };
  if (!cand.length || paradas.length || semInicio.length) return { estado: 'refazer', cand, paradas, semInicio };
  return { estado: 'aguardando', cand }; // run recente ainda na fila (menos de 8 min)
}

async function gh(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ceven-cron-trigger', 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
}

export async function vigiarDisparos(env, now = new Date()) {
  if (!env.GITHUB_TOKEN || !diaUtilBrt(now)) return [];
  const agora = now.getTime();
  const log = [];
  for (const slot of SLOTS) {
    const ini = inicioSlotMs(slot.hm, now);
    const idadeMin = (agora - ini) / 60000;
    if (idadeMin < ESPERA_MIN || idadeMin > JANELA_MIN) continue;
    try {
      const rl = await gh(env, `/actions/workflows/${slot.workflow}/runs?event=workflow_dispatch&per_page=15`);
      if (!rl.ok) { log.push(`${slot.hm}: nao consegui listar runs (${rl.status})`); continue; }
      const runs = (await rl.json()).workflow_runs || [];
      const iniciou = new Map();
      for (const r of runs) {
        const t = Date.parse(r.created_at);
        if (r.status !== 'completed' || r.conclusion === 'success' || t < ini - 3 * 60000 || t > ini + JANELA_MIN * 60000) continue;
        const rj = await gh(env, `/actions/runs/${r.id}/jobs`);
        const jobs = rj.ok ? (await rj.json()).jobs || [] : [];
        iniciou.set(r.id, jobs.some((j) => Array.isArray(j.steps) && j.steps.length > 0));
      }
      const e = estadoSlot(runs, ini, agora, (id) => iniciou.get(id) === true);
      if (e.estado !== 'refazer') { if (['esgotado', 'falhou_apos_iniciar'].includes(e.estado)) log.push(`${slot.hm}: ${e.estado} (nao refaz; a Matriz avisa)`); continue; }
      for (const r of e.paradas || []) await gh(env, `/actions/runs/${r.id}/cancel`, { method: 'POST' }); // run parada sem maquina nao pode acordar depois e duplicar
      const rd = await gh(env, `/actions/workflows/${slot.workflow}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: REF, inputs: slot.inputs }) });
      log.push(`${slot.hm}: disparo NAO tinha comecado -> refeito (status ${rd.status})`);
    } catch (err) {
      log.push(`${slot.hm}: erro do vigia ${err && err.message ? err.message : err}`);
    }
  }
  return log;
}
