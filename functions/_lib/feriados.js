// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/feriados.js
// O QUE É: lista ÚNICA de feriados nacionais para as functions (mesma de scratch/build_brasileirao_dataset.py e do worker-cron).
// REGRA (Vitório, 13/10/2026: "feriado não pode contar para a liga!!! já falamos"): em feriado o coletor NÃO gera lance
//        (nem cartão, nem pênalti, nem gol): nada aparece na TV, no VAR, na notificação dos supervisores nem no fechamento.
// =========================================================================
export const FERIADOS = new Set([
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01',
  '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25',
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21', '2027-05-01', '2027-05-27', '2027-09-07', '2027-10-12', '2027-11-02', '2027-11-15', '2027-11-20', '2027-12-25'   // 2027 (Carnaval 08-09/02, Sexta Santa 26/03, Corpus Christi 27/05)
]);
export const ehFeriado = (diaISO) => FERIADOS.has(String(diaISO || '').slice(0, 10));
