// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/liga_as.js
// O QUE É: regras da LIGA AS (Autosserviço) — FASEAMENTO da meta do mês (Vitório e o Diretor, 07/10/2026). Função pura (sem rede nem banco): testável.
//          Doc das decisões: docs/LIGA_AS_DECISOES.md. MODO SOMBRA: calcula e mostra, NÃO vale pontos até 01/11/2026.
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
export const AS_MODO = 'sombra';
export const AS_VALE_DESDE = '2026-11-01';

const pad = (n) => String(n).padStart(2, '0');
export const ultimoDiaDoMes = (mes) => { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };

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
  const fases = AS_FASES.map((f) => {
    const dFim = f.fimDoMes ? dia(ult) : dia(f.ate);
    if (dFim > hoje) return { ...f, ate: f.fimDoMes ? ult : f.ate, data: dFim, status: 'futuro', pct: null, ganhou: 0 };
    const p = pct(fotoAte(dFim));
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
