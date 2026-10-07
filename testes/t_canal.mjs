// Testes do CANAL (Varejo | AS) em public/brasileirao.html: semanas do AS, filtro dos lances por canal e dados do gerador.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export default async function (ok) {
  const t = readFileSync(join(RAIZ, 'public', 'brasileirao.html'), 'utf8').replace(/\r\n/g, '\n');
  const a = t.indexOf('const AS_SEMANAS'), b = t.indexOf('async function buscarLancesPeriodo');
  const f = new Function('DADOS', 'CANAL', t.slice(a, b) + '; return { semanaAS, rcasDoAS, lanceDoCanal, ddmm };');
  const DADOS = { vendedores: [{ rca: '10', canal: 'AS' }, { rca: '20', canal: 'VAREJO' }] };
  const as = f(DADOS, 'AS'), vj = f(DADOS, 'VAREJO');
  const w1 = as.semanaAS('2026-10-07'), w3 = as.semanaAS('2026-10-20'), w4 = as.semanaAS('2026-10-21');
  ok(w1.n === 1 && w1.de === '2026-10-01' && w1.ate === '2026-10-07' && w1.dias.join() === '2026-10-01,2026-10-02,2026-10-05,2026-10-06,2026-10-07', 'AS: semana 1 = dias 1 a 7 (so dias uteis)');
  ok(w3.n === 3 && w3.de === '2026-10-15' && w3.ate === '2026-10-20', 'AS: a 3a semana termina no dia 20');
  ok(w4.n === 4 && w4.de === '2026-10-21' && w4.ate === '2026-10-31' && !w4.dias.includes('2026-10-24') && !w4.dias.includes('2026-10-25'), 'AS: semana 4 vai do dia 21 ao fim do mes, sem sabado nem domingo');
  ok(as.semanaAS('2026-02-28').ate === '2026-02-28', 'AS: fevereiro termina no dia 28 (nao inventa dia 31)');
  const set = as.rcasDoAS();
  ok(set.has('10') && !set.has('20'), 'rcas do AS vem do canal do dataset');
  ok(as.lanceDoCanal({ rca: '10' }, set) === true && as.lanceDoCanal({ rca: '20' }, set) === false && vj.lanceDoCanal({ rca: '20' }, vj.rcasDoAS()) === true && vj.lanceDoCanal({ rca: '10' }, vj.rcasDoAS()) === false, 'cada canal so enxerga os lances dos seus vendedores');
  ok(t.includes("id=\"canal-v\"") && t.includes("id=\"canal-a\"") && t.includes("Lances da Semana") && t.includes("Gabarito da Semana") && t.includes('id="reg-as"') && t.includes("renderVendedoresAS()") && t.includes("renderSupervisoresAS()") && t.includes("montaGabaritoFase()"), 'tela: seletor Varejo/AS e as visoes semanais de artilharia, supervisores, lances, gabarito e regulamento');
  ok(t.includes("(s.canal || 'VAREJO') !== 'AS'") && t.includes("(v.canal || 'VAREJO') !== 'AS'"), 'tabelas do Varejo nao misturam vendedores e supervisores do AS');
  const g = readFileSync(join(RAIZ, 'scratch', 'build_brasileirao_dataset.py'), 'utf8');
  ok(g.includes("'canal': 'AS' if str(item.get('canal', '')).upper() in ('AS', 'PET AS') else 'VAREJO'") && g.includes("'as': bloco_as") && g.includes("AS_LANCES_FORA = ('ven10', 'vis10', 'vis11', 'gol_relampago'") && g.includes("AS_SEMANAS = [(1, 1, 7), (2, 8, 14), (3, 15, 20), (4, 21, 31)]"), 'gerador: canal de cada vendedor, bloco AS semanal e lances que dependem do horario ou das visitas do dia fora do AS, a semana como jogo (V/E/D)');
  const tv = readFileSync(join(RAIZ, 'functions', 'api', 'tv-vendedor.js'), 'utf8');
  ok(tv.includes("if (canal === 'AS') return skusAtual >= mediaHistorica + 2;") && tv.includes('canalVend'), 'AS: gol de mix = 2 SKUs a mais que a media do cliente (nao dobra); so para canal AS');
  const cl = readFileSync(join(RAIZ, 'functions', 'api', 'cron-lances.js'), 'utf8');
  ok(cl.includes("'&canal=AS'") && readFileSync(join(RAIZ, 'public', 'tvapp.html'), 'utf8').includes("'&canal=AS'") && readFileSync(join(RAIZ, 'public', 'matrizapp.html'), 'utf8').includes("'&canal=AS'"), 'coletor, TV e Matriz pedem o gol de mix do AS (&canal=AS) para vendedor AS');
  ok(t.includes("'gol_campeao']") && g.includes("'gol_goleada', 'gol_campeao')") && t.includes("'campeao da rodada'"), 'AS: Campeao da Rodada fora (o bonus de 100% da meta ja cumpre esse papel)');
}
