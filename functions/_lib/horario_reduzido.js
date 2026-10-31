// =========================================================================
// FICHA: functions/_lib/horario_reduzido.js
// O QUE É: corte inteligente de custo da Cloudflare (Vitório, 25/10 e 31/10/2026: calendário sazonal comercial + feriados).
//   1. Fora do horário comercial (antes das 06h, a partir das 21h), DOMINGOS o dia todo e FERIADOS NACIONAIS o dia todo:
//      os crons da TV rodam só a cada 30 min em vez de a cada 2/5/15 min.
//   2. SAZONALIDADE COMERCIAL (Vitório, 31/10/2026 — Mapa de Calor de Positivações):
//      - Fechamento de mês (dia >= 25): NUNCA trava no freio de 30 min durante o horário comercial (precisa monitorar venda,
//        positivação e pedidos em tempo real no sprint final!).
//      - Início de mês (dias 01 a 05): volume de pedidos até 7x menor; se o freio estiver ligado ou em horário de baixa,
//        opera em cadência econômica sem prejudicar o fechamento.
//   Sem estado: decide pelo relógio de Brasília. ?forcar=1 sempre roda.
// =========================================================================
import R from '../../public/regras.js'; // regras unicas (public/regras.js)
import { ehFeriado } from './feriados.js';

export function agoraBrasilia(d = new Date()) {
  const c = R.relogioSP(d);
  const diaNum = Number(String(c.dia || '').slice(8, 10)) || 15;
  return {
    dia: c.dia,
    diaNum,
    dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][c.dow],
    h: c.h,
    m: c.m,
    feriado: ehFeriado(c.dia),
    fechamentoMes: diaNum >= 25,
    inicioMes: diaNum <= 5
  };
}

export function foraDoHorario(d = new Date()) {
  const { dow, h, feriado } = agoraBrasilia(d);
  // Domingo o dia todo, Feriado Nacional o dia todo (ex: 02/11 Finados), ou fora das 06h-21h
  return dow === 'Sun' || feriado || h < 6 || h >= 21;
}

// true = pode rodar agora. cadenciaMin = de quanto em quanto o cron é chamado (2, 5, 15).
// No fechamento de mês (dia >= 25) em horário comercial de dia útil/sábado (não feriado), NUNCA aplica o freio de 30 min!
export function rodaAgora(cadenciaMin, d = new Date(), freio = false) {
  const ag = agoraBrasilia(d);
  if (foraDoHorario(d)) {
    return ((ag.h * 60 + ag.m) % 30) < cadenciaMin;
  }
  // Horário comercial (06h às 21h, seg-sáb, exceto feriado):
  // Em fechamento de mês (dias 25 a 31), ignora o freio para garantir monitoramento em tempo real!
  if (!freio || ag.fechamentoMes) return true;
  // Se o freio estiver ligado fora da reta final do mês, usa cadência intermediária de 10 min (em vez de travar 30 min)
  return ((ag.h * 60 + ag.m) % 10) < cadenciaMin;
}

// FREIO DE CUSTO (25/10/2026): lido do D1 (config_custo, gravado por /api/custo-freio) no máximo 1 vez a cada 10 min por instância.
let _freio = { v: false, em: 0 };
export async function freioCusto(env) {
  // Em fechamento de mês (dias 25 a 31) durante horário comercial, o freio fica sempre desligado para não travar a operação
  const ag = agoraBrasilia();
  if (ag.fechamentoMes && !foraDoHorario()) return false;
  if (Date.now() - _freio.em < 10 * 60 * 1000) return _freio.v;
  let v = false;
  try { const r = await env.DB.prepare("SELECT valor FROM config_custo WHERE chave = 'freio'").first(); v = !!(r && JSON.parse(r.valor || '{}').ligado); } catch (e) { /* sem tabela = sem freio */ }
  _freio = { v, em: Date.now() };
  return v;
}
