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
export function rodaAgora(cadenciaMin, d = new Date()) {
  if (!foraDoHorario(d)) return true;
  const { h, m } = agoraBrasilia(d);
  return ((h * 60 + m) % 30) < cadenciaMin;
}
