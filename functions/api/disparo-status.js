// Estado dos disparos oficiais de WhatsApp de HOJE (so le a API publica da GitHub). Alimenta a faixa vermelha da Matriz (Vitorio, 05/10/2026).
// A conta (estadoSlot) e a mesma do vigia do worker-cron: um disparo que nao comecou depois de 8 min aparece como problema.
import { SLOTS, ESPERA_MIN, JANELA_MIN, estadoSlot, inicioSlotMs, diaUtilBrt } from '../../worker-cron/src/vigia.js';

const REPO = 'vitoriotriunfante/cevenonline';
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
let cache = { exp: 0, corpo: null };

export async function onRequestGet() {
  if (cache.corpo && Date.now() < cache.exp) return new Response(JSON.stringify(cache.corpo), { headers: CORS });
  const agora = new Date();
  const corpo = { gerado_em: agora.toISOString(), dia_util: diaUtilBrt(agora), problemas: [], horarios: [] };
  if (corpo.dia_util) {
    try {
      const porWf = {};
      for (const wf of [...new Set(SLOTS.map((s) => s.workflow))]) {
        const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${wf}/runs?event=workflow_dispatch&per_page=20`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ceven-disparo-status' }, signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error('GitHub ' + r.status);
        porWf[wf] = (await r.json()).workflow_runs || [];
      }
      for (const s of SLOTS) {
        const ini = inicioSlotMs(s.hm, agora);
        if (agora.getTime() < ini) { corpo.horarios.push({ hm: s.hm, estado: 'futuro' }); continue; }
        // sem ler os jobs (limite de chamadas): run concluida sem sucesso conta como "refazer/esgotado" pelo nº de tentativas
        const e = estadoSlot(porWf[s.workflow], ini, agora.getTime(), () => false);
        const falhou = ['refazer', 'esgotado', 'falhou_apos_iniciar'].includes(e.estado) && (agora.getTime() - ini) / 60000 >= ESPERA_MIN;
        corpo.horarios.push({ hm: s.hm, estado: e.estado });
        if (falhou) corpo.problemas.push({ hm: s.hm, estado: e.estado, texto: `Disparo das ${s.hm} NÃO saiu (${e.estado === 'refazer' ? 'não começou; o vigia tenta de novo' : 'sem sucesso após as tentativas'})` });
      }
    } catch (e) {
      corpo.erro = String(e.message || e);
    }
  }
  cache = { exp: Date.now() + 90 * 1000, corpo };
  return new Response(JSON.stringify(corpo), { headers: CORS });
}
