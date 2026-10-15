// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/liga_as.js
// O QUE É: regras da LIGA AS (Autosserviço) — FASEAMENTO da meta do mês (Vitório e o Diretor, 07/10/2026). Função pura (sem rede nem banco): testável.
//          Doc das decisões: docs/LIGA_AS_DECISOES.md. OFICIAL desde 07/10/2026 (decisão do Vitório: não há modo sombra; a Liga AS faz parte do Brasileirão).
// REGRAS:  Faseamento (% da meta do mês no fim de cada semana): 1ª (até dia 7) 20% = 10 pts · 2ª (até dia 14) 40% = 20 pts · 3ª (até dia 20) 60% = 30 pts · 4ª (até o fim do mês) 110% = 40 pts.
//          Bônus: bater 100% da meta até o dia 15 = +50 · bater 100% até o dia 25 = +25.
//          % da meta = (faturado + pendente) / meta, o MESMO número que o app do CEVEN mostra (ex.: 41,8% = faturado + pendente sobre a meta).
//          Sem meta cadastrada = fora (nunca inventa). Supervisor = soma da equipe (faturado+pendente da equipe sobre a meta da equipe), mesmas faixas.
// =========================================================================
export const AS_FASES = [
  { n: 1, ate: 7, meta: 20, pontos: 10 },
  { n: 2, ate: 14, meta: 40, pontos: 20 },
  { n: 3, ate: 20, meta: 60, pontos: 30 },
  { n: 4, ate: 31, meta: 110, pontos: 40, fimDoMes: true }
];
export const AS_BONUS = [
  { id: 'quinzena', ate: 15, meta: 100, pontos: 50, nome: 'Meta batida até o dia 15' },
  { id: 'dia25', ate: 25, meta: 100, pontos: 25, nome: 'Meta batida até o dia 25' }
];
export const AS_MODO = 'oficial';
export const AS_VALE_DESDE = '2026-10-13';

import { ehFeriado } from './feriados.js';
const pad = (n) => String(n).padStart(2, '0');
export const ultimoDiaDoMes = (mes) => { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };

// =========================================================================
// SEMANAS DO AS POR SEMANA DE TRABALHO (Vitório, 15/10/2026 — vale JÁ, desde o início da liga em 13/10/2026; antes era 1-7 / 8-14 / 15-20 / 21-fim).
// POR QUE: cortar a semana pelo dia do mês fazia o fim de mês cair no meio da semana (ex.: fecha numa terça 31) e a 'semana' seguinte
//          ficava com 2 ou 3 dias logo depois do fechamento, em que o AS quase não tira pedido: derrota certa sem culpa do vendedor.
// COMO:  1) semana = segunda a sexta (dias úteis, sem feriado) dentro do mês;
//        2) pedaço de semana com 3 DIAS ÚTEIS OU MENOS se junta à vizinha (no começo do mês com a seguinte; no fim, com a anterior);
//        3) o FASEAMENTO NÃO MUDA (inegociável): 20% até o dia 7, 40% até o 14, 60% até o 20, 110% no fim do mês = 10/20/30/40 pontos;
//           os pontos de cada corte entram no placar da semana de trabalho em que cai o dia do corte;
//        4) vitória = placar acima de 2 pontos por dia útil da semana (5 dias = acima de 10, igual ao Varejo; 8 dias = acima de 16).
// =========================================================================
export const AS_SEMANAS_NOVAS_DESDE = '2026-10';   // Vitorio, 15/10/2026: "coloca valendo essa semana" (outubro: semana 2 = 13 a 16/10, a 1a da liga)
export const MIN_DIAS_SEMANA_AS = 4;   // 3 dias ou menos se junta (ex.: mes que fecha numa terca deixa qua-qui-sex no comeco do mes seguinte)
export function semanasAS(mes) {
  const ult = ultimoDiaDoMes(mes), [a, m] = mes.split('-').map(Number);
  const blocos = []; let atual = null;
  for (let d = 1; d <= ult; d++) {
    const iso = `${mes}-${pad(d)}`, dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
    if (dow === 1 || !atual) { atual = { dias: [], de: d, ate: d }; blocos.push(atual); }
    atual.ate = d;
    if (dow >= 1 && dow <= 5 && !ehFeriado(iso)) atual.dias.push(iso);
  }
  let L = blocos.filter((b) => b.dias.length);
  // junta pedaços curtos: o primeiro com o seguinte, os demais com o anterior
  for (let i = 0; i < L.length && L.length > 1; ) {
    if (L[i].dias.length >= MIN_DIAS_SEMANA_AS) { i++; continue; }
    const j = i === 0 ? 1 : i - 1, alvo = L[j], b = L[i];
    alvo.dias = j < i ? alvo.dias.concat(b.dias) : b.dias.concat(alvo.dias);
    alvo.de = Math.min(alvo.de, b.de); alvo.ate = Math.max(alvo.ate, b.ate);
    L.splice(i, 1); i = 0;
  }
  return L.map((b, i) => {
    const ultima = i === L.length - 1;
    return { n: i + 1, de: b.de, ate: ultima ? ult : b.ate, dias_uteis: b.dias.length, dias: b.dias, fim_util: b.dias[b.dias.length - 1],
      vitoria_acima_de: 2 * b.dias.length, fimDoMes: ultima };
  });
}
export const usaSemanasNovas = (mes) => String(mes) >= AS_SEMANAS_NOVAS_DESDE;

// snaps: { 'AAAA-MM-DD': { meta, faturado, pendente } }  (foto do fim de cada dia, vinda da varredura central)
// hoje: 'AAAA-MM-DD' (data de hoje em Brasilia). Devolve a situacao de uma pessoa (ou de uma equipe somada).
export function calculaFaseamento(snaps, mes, hoje) {
  const ult = ultimoDiaDoMes(mes);
  const dia = (n) => `${mes}-${pad(Math.min(n, ult))}`;
  const pct = (s) => (s && Number(s.meta) > 0 ? ((Number(s.faturado) || 0) + (Number(s.pendente) || 0)) / Number(s.meta) * 100 : null);
  // foto mais recente ate uma data (o dia pode nao ter linha)
  const fotoAte = (d) => { const ks = Object.keys(snaps).filter((k) => k <= d && k <= hoje).sort(); return ks.length ? snaps[ks[ks.length - 1]] : null; };
  const atual = fotoAte(hoje);
  const metaMes = atual ? Number(atual.meta) || 0 : 0;
  // FASEAMENTO E INEGOCIAVEL (Vitorio, 15/10/2026: "a venda ate dia 20... o vendedor precisa se mexer; so pedi para ajustar as semanas"): 20% ate o dia 7, 40% ate o 14,
  // 60% ate o 20 e 110% no fim do mes, sempre. A semana de trabalho so decide em qual JOGO os pontos de cada corte entram (o gerador soma pela data).
  const fases = AS_FASES.map((f) => {
    const dFim = f.fimDoMes ? dia(ult) : dia(f.ate);
    if (dFim > hoje) return { ...f, ate: f.fimDoMes ? ult : f.ate, data: dFim, status: 'futuro', pct: null, ganhou: 0 };
    const p = pct(fotoAte(dFim));
    // o dia do fechamento da semana ainda esta rolando: mostra o % de agora, mas so pontua quando o dia terminar
    if (dFim === hoje) return { ...f, ate: f.fimDoMes ? ult : f.ate, data: dFim, status: p == null ? 'sem_meta' : 'em_andamento', pct: p == null ? null : Math.round(p * 10) / 10, ganhou: 0 };
    const batida = p != null && p >= f.meta;
    return { ...f, ate: f.fimDoMes ? ult : f.ate, data: dFim, status: p == null ? 'sem_meta' : (batida ? 'batida' : 'nao_batida'), pct: p == null ? null : Math.round(p * 10) / 10, ganhou: batida ? f.pontos : 0 };
  });
  // bonus: algum dia ate o limite em que a foto do dia ja estava em 100% ou mais
  const bonus = AS_BONUS.map((b) => {
    const dLim = dia(b.ate), dias = Object.keys(snaps).filter((k) => k.startsWith(mes) && k <= dLim && k <= hoje).sort();
    const quando = dias.find((k) => { const p = pct(snaps[k]); return p != null && p >= b.meta; });
    if (quando) return { ...b, status: 'batido', quando, ganhou: b.pontos };
    return { ...b, status: dLim >= hoje ? 'em_andamento' : 'perdido', quando: null, ganhou: 0 };
  });
  return { mes, hoje, meta_mes: metaMes, pct_hoje: atual ? (pct(atual) == null ? null : Math.round(pct(atual) * 10) / 10) : null, faturado_hoje: atual ? (Number(atual.faturado) || 0) : null, pendente_hoje: atual ? (Number(atual.pendente) || 0) : null,
    fases, bonus, pontos: fases.reduce((s, f) => s + f.ganhou, 0) + bonus.reduce((s, b) => s + b.ganhou, 0) };
}

// soma de fotos de varias pessoas (equipe do supervisor): so entra quem tem meta
export function somaSnaps(lista) {
  const out = {};
  for (const snaps of lista) for (const [d, s] of Object.entries(snaps)) {
    if (!(Number(s.meta) > 0)) continue;
    const o = (out[d] = out[d] || { meta: 0, faturado: 0, pendente: 0 });
    o.meta += Number(s.meta); o.faturado += Number(s.faturado) || 0; o.pendente += Number(s.pendente) || 0;
  }
  return out;
}
