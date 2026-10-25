// =========================================================================
// FICHA: functions/_lib/horario_reduzido.js
// O QUE É: corte de custo da Cloudflare (Vitório, 25/10/2026, após a conta de US$ 170: "faça os 5").
//   Fora do horário comercial (antes das 06h, a partir das 21h, e domingo o dia todo — horário de Brasília) os crons da TV
//   rodam só a cada 30 min em vez de a cada 2/5/15 min. Sábado conta como dia útil (pode ter venda).
//   Sem estado: decide pelo relógio. ?forcar=1 sempre roda.
// =========================================================================
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
export function agoraBrasilia(d = new Date()) {
  const c = R.relogioSP(d);
  return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][c.dow], h: c.h, m: c.m };
}
export function foraDoHorario(d = new Date()) {
  const { dow, h } = agoraBrasilia(d);
  return dow === 'Sun' || h < 6 || h >= 21;
}
// true = pode rodar agora. cadenciaMin = de quanto em quanto o cron é chamado (2, 5, 15): só a 1ª chamada de cada meia hora passa.
// freio = true quando o guarda de custo ligou o freio (projeção do mês > US$ 15): aí vale a cadência de 30 min o dia todo.
export function rodaAgora(cadenciaMin, d = new Date(), freio = false) {
  if (!freio && !foraDoHorario(d)) return true;
  const { h, m } = agoraBrasilia(d);
  return ((h * 60 + m) % 30) < cadenciaMin;
}
// FREIO DE CUSTO (25/10/2026): lido do D1 (config_custo, gravado por /api/custo-freio) no máximo 1 vez a cada 10 min por instância.
let _freio = { v: false, em: 0 };
export async function freioCusto(env) {
  if (Date.now() - _freio.em < 10 * 60 * 1000) return _freio.v;
  let v = false;
  try { const r = await env.DB.prepare("SELECT valor FROM config_custo WHERE chave = 'freio'").first(); v = !!(r && JSON.parse(r.valor || '{}').ligado); } catch (e) { /* sem tabela = sem freio */ }
  _freio = { v, em: Date.now() };
  return v;
}
