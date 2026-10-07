// Testes da LIGA AS (functions/_lib/liga_as.js): faseamento 20/40/60/110 (10/20/30/40 pts) e bonus 100% ate dia 15 (+50) e dia 25 (+25).
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export default async function (ok) {
  const lib = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'liga_as.js')).href);
  const S = (fat, pend = 0, meta = 1000) => ({ meta, faturado: fat, pendente: pend });
  // dia 21: semana 1 batida (22%), semana 2 NAO (38%), semana 3 batida (61%), semana 4 ainda futura
  const snaps = { '2026-10-07': S(200, 20), '2026-10-14': S(380), '2026-10-20': S(600, 10), '2026-10-21': S(620) };
  const r = lib.calculaFaseamento(snaps, '2026-10', '2026-10-21');
  ok(r.fases[0].status === 'batida' && r.fases[1].status === 'nao_batida' && r.fases[2].status === 'batida' && r.fases[3].status === 'futuro', 'faseamento: semana 1 (22%) e 3 (61%) batidas, semana 2 (38% < 40%) nao, semana 4 futura');
  ok(r.fases[0].ganhou === 10 && r.fases[2].ganhou === 30 && r.fases[1].ganhou === 0, 'pontos das fases: 10, 20, 30 e 40 (semana 1 e 3 ganharam 10 + 30)');
  ok(r.bonus[0].status === 'perdido' && r.bonus[1].status === 'em_andamento' && r.pontos === 40, 'bonus: ate o dia 15 sem bater = perdido; ate o dia 25 ainda em andamento; total 40 pts');
  ok(r.pct_hoje === 62 && r.meta_mes === 1000, '% de hoje = (faturado + pendente) / meta (62%)');
  // semana 3 termina no dia 20 (nao 21): foto do dia 21 nao conta para a semana 3
  const r3 = lib.calculaFaseamento({ '2026-10-20': S(500), '2026-10-21': S(700) }, '2026-10', '2026-10-21');
  ok(r3.fases[2].status === 'nao_batida' && r3.fases[2].pct === 50, 'a 3a semana termina no dia 20: 70% do dia 21 NAO salva uma semana 3 de 50%');
  // bateu a meta no dia 12: bonus da quinzena (+50) e do dia 25 (+25)
  const rb = lib.calculaFaseamento({ '2026-10-07': S(250), '2026-10-12': S(1000), '2026-10-14': S(1050) }, '2026-10', '2026-10-26');
  ok(rb.bonus[0].status === 'batido' && rb.bonus[0].quando === '2026-10-12' && rb.bonus[1].status === 'batido' && rb.bonus[0].ganhou === 50 && rb.bonus[1].ganhou === 25, 'meta batida no dia 12: bonus da quinzena +50 e do dia 25 +25');
  const rt = lib.calculaFaseamento({ '2026-10-20': S(1000) }, '2026-10', '2026-10-26');
  ok(rt.bonus[0].status === 'perdido' && rt.bonus[1].status === 'batido', 'meta batida so no dia 20: perde o bonus da quinzena, ganha o do dia 25');
  const rf = lib.calculaFaseamento({ '2026-10-31': S(1100) }, '2026-10', '2026-11-01');
  ok(rf.fases[3].status === 'batida' && rf.fases[3].ganhou === 40 && rf.fases[3].pct === 110, 'semana 4: 110% no ultimo dia do mes ganha 40 (depois que o dia terminar)');
  // o dia que fecha a semana ainda esta rolando: mostra o %, mas so pontua quando o dia terminar
  const rh = lib.calculaFaseamento({ '2026-10-07': S(250) }, '2026-10', '2026-10-07');
  ok(rh.fases[0].status === 'em_andamento' && rh.fases[0].pct === 25 && rh.fases[0].ganhou === 0 && rh.pontos === 0, 'no proprio dia 7 a semana 1 aparece em andamento (25%) e so pontua depois que o dia terminar');
  const rh2 = lib.calculaFaseamento({ '2026-10-07': S(250) }, '2026-10', '2026-10-08');
  ok(rh2.fases[0].status === 'batida' && rh2.fases[0].ganhou === 10, 'no dia 8 a semana 1 fica batida e vale 10 pontos');
  // sem meta: nunca inventa
  const rs = lib.calculaFaseamento({ '2026-10-07': { meta: 0, faturado: 100, pendente: 0 } }, '2026-10', '2026-10-21');
  ok(rs.fases[0].status === 'sem_meta' && rs.pontos === 0 && rs.pct_hoje === null, 'sem meta cadastrada: nao pontua e nao mostra %');
  // equipe somada
  const eq = lib.somaSnaps([{ '2026-10-07': S(100, 0, 500) }, { '2026-10-07': S(300, 0, 500) }, { '2026-10-07': { meta: 0, faturado: 999, pendente: 0 } }]);
  ok(eq['2026-10-07'].meta === 1000 && eq['2026-10-07'].faturado === 400, 'equipe: soma meta e faturado de quem tem meta (quem nao tem meta fica fora)');
  const ep = readFileSync(join(RAIZ, 'functions', 'api', 'liga-as.js'), 'utf8');
  ok(ep.includes("=== 'AS'") && ep.includes("mostra !== false") && ep.includes('AS_MODO') && ep.includes('AS_VALE_DESDE') && lib.AS_MODO === 'oficial' && lib.AS_VALE_DESDE === '2026-10-07', 'Liga AS: so canal AS que aparece na equipe, OFICIAL desde 07/10/2026 (sem modo sombra)');
}
