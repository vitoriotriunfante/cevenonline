// Estado dos disparos oficiais de WhatsApp de HOJE (so le a API publica da GitHub). Alimenta a faixa vermelha da Matriz (Vitorio, 05/10/2026).
// A conta (estadoSlot) e a mesma do vigia do worker-cron: um disparo que nao comecou depois de 8 min aparece como problema.
import { SLOTS, ESPERA_MIN, JANELA_MIN, estadoSlot, inicioSlotMs, diaUtilBrt } from '../../worker-cron/src/vigia.js';

const REPO = 'vitoriotriunfante/cevenonline';
const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
let cache = { exp: 0, corpo: null };

export async function onRequestGet({ env }) {
  if (cache.corpo && Date.now() < cache.exp) return new Response(JSON.stringify(cache.corpo), { headers: CORS });
  const agora = new Date();
  
  // SUSPENSÃO TEMPORÁRIA DOS AVISOS (03/11/2026: Chip do WhatsApp em 24h de recuperação)
  // Limpa imediatamente a faixa vermelha da TV da Matriz e Sala de Controle
  const corpo = { gerado_em: agora.toISOString(), dia_util: diaUtilBrt(agora), suspenso: true, problemas: [], horarios: [] };
  corpo.aviso = 'Disparos oficiais de WhatsApp em pausa programada (aquecimento do chip pós-restrição).';
  cache = { exp: Date.now() + 60 * 1000, corpo };
  return new Response(JSON.stringify(corpo), { headers: CORS });
}
