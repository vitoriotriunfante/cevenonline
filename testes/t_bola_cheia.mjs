// Bola Cheia (18h): regra do vencedor por filial, congelamento e ligacao nas telas/coletor.
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export default async function t(ok) {
  const bc = await import(pathToFileURL(join(RAIZ, 'functions/_lib/bola_cheia.js')).href);
  const c = (filial, rca, vendedor, pontos, visitas, positivados = 1, digitado = 100) => ({ filial, rca, vendedor, pontos, visitas, positivados, digitado });
  // 1 vencedor por filial: o de mais pontos
  let v = bc.escolheVencedores([c('TBL', '1', 'ANA', 12, 8), c('TBL', '2', 'BIA', 20, 9), c('TPH', '3', 'CAIO', 5, 6)]);
  ok(v.length === 2 && v.find((x) => x.filial === 'TBL').vendedor === 'BIA' && v.find((x) => x.filial === 'TPH').vendedor === 'CAIO', 'Bola Cheia: um vencedor por filial, o de mais pontos no dia');
  // minimo de 5 visitas (sem trabalhar nao ganha), mesmo com mais pontos
  v = bc.escolheVencedores([c('TBL', '1', 'ANA', 50, 4), c('TBL', '2', 'BIA', 10, 5)]);
  ok(v.length === 1 && v[0].vendedor === 'BIA', 'Bola Cheia: so concorre quem fez ao menos 5 visitas (4 visitas fica fora, mesmo com mais pontos)');
  // pontos zero ou negativos: sem Bola Cheia (nunca inventa vencedor)
  v = bc.escolheVencedores([c('TBL', '1', 'ANA', 0, 9), c('TBL', '2', 'BIA', -4, 9)]);
  ok(v.length === 0, 'Bola Cheia: nenhum vendedor com pontos positivos = filial fica sem Bola Cheia');
  // desempate: positivados, depois digitado, depois nome
  v = bc.escolheVencedores([c('TBL', '1', 'ANA', 10, 8, 5, 1000), c('TBL', '2', 'BIA', 10, 8, 6, 500)]);
  ok(v[0].vendedor === 'BIA', 'Bola Cheia: empate em pontos decide por mais clientes positivados');
  v = bc.escolheVencedores([c('TBL', '1', 'ANA', 10, 8, 5, 1000), c('TBL', '2', 'BIA', 10, 8, 5, 2000)]);
  ok(v[0].vendedor === 'BIA', 'Bola Cheia: depois, por mais digitado');
  v = bc.escolheVencedores([c('TBL', '2', 'BIA', 10, 8, 5, 1000), c('TBL', '1', 'ANA', 10, 8, 5, 1000)]);
  ok(v[0].vendedor === 'ANA', 'Bola Cheia: por fim, ordem alfabetica fixa (o resultado nao depende da ordem de entrada)');
  // TEM QUE TER VENDIDO: pontos de processo sem venda nao ganham
  v = bc.escolheVencedores([c('TBL', '1', 'ANA', 40, 12, 0, 0), c('TBL', '2', 'BIA', 10, 8, 2, 900)]);
  ok(v.length === 1 && v[0].vendedor === 'BIA', 'Bola Cheia: tem que ter vendido (0 positivados e R$ 0 digitado fica fora, mesmo com mais pontos)');
  v = bc.escolheVencedores([c('TBL', '1', 'ANA', 40, 12, 3, 0)]);
  ok(v.length === 0, 'Bola Cheia: positivado mas com digitado R$ 0 tambem nao conta como venda');
  ok(bc.MIN_VISITAS === 5 && bc.HORA_CONGELA_MIN === 18 * 60 && JSON.stringify(bc.CANAIS_VAREJO) === JSON.stringify(['VJ', 'FARMA', 'PET VJ', 'ESP']), 'Bola Cheia: 18h, minimo 5 visitas, so canais do Varejo');
  // ligacao: coletor congela, endpoint existe, TV e Matriz avisam, video prevê arquivo
  const lib = readFileSync(join(RAIZ, 'functions/_lib/bola_cheia.js'), 'utf8'), cl = readFileSync(join(RAIZ, 'functions/api/cron-lances.js'), 'utf8');
  ok(cl.includes('/api/bola-cheia?rodar=1') && cl.includes('t.agoraMin >= 18 * 60') && lib.includes('INSERT OR IGNORE INTO bola_cheia ') && lib.includes('bola_cheia_dia') && lib.indexOf('INSERT OR IGNORE INTO bola_cheia (') < lib.indexOf('INSERT OR IGNORE INTO bola_cheia_dia'), 'Bola Cheia: o coletor congela a partir das 18h; grava uma vez (INSERT OR IGNORE) e o cabecalho por ultimo');
  const tv = readFileSync(join(RAIZ, 'public/tvapp.html'), 'utf8'), mz = readFileSync(join(RAIZ, 'public/matrizapp.html'), 'utf8'), an = readFileSync(join(RAIZ, 'public/animacoes/tv-animacoes.js'), 'utf8');
  ok(tv.includes("tipo: 'bolacheia'") && mz.includes("tipo: 'bolacheia'") && tv.includes('animBolaCheia') && mz.includes('animBolaCheia') && an.includes('bolacheia_2.mp4') && tv.includes("x.tipo === 'bolacheia'") && mz.includes("x.tipo === 'bolacheia'"), 'Bola Cheia: TV da filial e Matriz avisam depois das 18h, saem sozinhas na frente; video bolacheia previsto (sem arquivo usa a animacao em tela)');
  // a copia publica do regulamento (a que a tela le) tem que ser IGUAL a config (a que vale): achado da mega auditoria de 07/10/2026
  ok(JSON.stringify(JSON.parse(readFileSync(join(RAIZ, 'config/pontuacao_brasileirao.json'), 'utf8'))) === JSON.stringify(JSON.parse(readFileSync(join(RAIZ, 'public/pontuacao_brasileirao.json'), 'utf8'))), 'regulamento: public/pontuacao_brasileirao.json e IDENTICO a config/pontuacao_brasileirao.json');
  // SEM COMPROVACAO NAO TEM LANCE: o fechamento retira o lance reprovado pela auditoria (trilha em lances_excluidos_liga); falha de cadastro nao retira
  const lf = await import(pathToFileURL(join(RAIZ, 'functions/_lib/liga_fechamento.js')).href);
  const base = { vendedor: 'X', rca: '1', supervisor: 'S', hora: '12:00:00', pontos: 6, filial: 'TBL' };
  const rep = lf.lancesReprovados([{ ...base, chave: 'gol_inativo|1|2', obs: 'TBL' }, { ...base, chave: 'gol_super|1', pontos: 5, obs: 'digitado do dia R$ 16.000 (minimo R$ 15.000)' }, { ...base, supervisor: '', chave: 'gol_super|2', pontos: 5, obs: 'digitado do dia R$ 16.000 (minimo R$ 15.000)' }], '2026-10-13');
  ok(rep.length === 1 && rep[0].chave === 'gol_inativo|1|2', 'fechamento: lance sem prova (so a sigla no obs) e retirado; lance com prova e lance so sem supervisor ficam');
  ok(readFileSync(join(RAIZ, 'functions/_lib/liga_fechamento.js'), 'utf8').includes('INSERT OR IGNORE INTO lances_excluidos_liga') && readFileSync(join(RAIZ, 'functions/_lib/liga_fechamento.js'), 'utf8').includes('AUDITORIA DO FECHAMENTO'), 'fechamento: a retirada fica gravada com o motivo (trilha auditavel)');
  // HAT-TRICK = 3 VENDAS SEGUIDAS, sem teto de tempo; e a TV nao grava lance que pontua sem prova
  const cl2 = readFileSync(join(RAIZ, 'functions/api/cron-lances.js'), 'utf8'), tl = readFileSync(join(RAIZ, 'functions/api/tv-lances.js'), 'utf8');
  ok(cl2.includes('3 vendas seguidas') && !cl2.includes('janelaMin <= 120') && readFileSync(join(RAIZ, 'public/tvapp.html'), 'utf8').includes('visitas[i].venda && visitas[i + 1].venda && visitas[i + 2].venda') && readFileSync(join(RAIZ, 'public/matrizapp.html'), 'utf8').includes('visitas[i].venda && visitas[i + 1].venda && visitas[i + 2].venda'), 'Hat-Trick: 3 vendas seguidas (visitas consecutivas todas com venda), sem limite de 2 horas, no coletor, na TV e na Matriz');
  const tlm = await import(pathToFileURL(join(RAIZ, 'functions/api/tv-lances.js')).href);
  const P = tlm.PRECISA_PROVA;
  ok(P.test('ven10|487') && P.test('TCG|ven10|487') && P.test('gol_mix|1|2') && P.test('imp|gps|1|2') && P.test('gol_hattrick|1|09:00') && !P.test('pen|estoque|1|2') && !P.test('def|1|2') && !P.test('ver_dev|1|2') && !P.test('pedido_rota|1|2'), 'tv-lances: tipos que precisam de prova (amarelo, gols, impedimento) x os que se provam pelos campos (penalti, defesa, devolucao, pedido na rota)');
  ok(tl.includes('PRECISA_PROVA.test(validos[i].chave)') && tl.includes('sem_prova_ignorados'), 'tv-lances: lance que pontua so com a sigla no obs nao entra no registro (sem comprovacao nao tem lance)');
  ok(readFileSync(join(RAIZ, 'functions/api/brasileirao-lances.js'), 'utf8').includes('HAT-TRICK = UM POR VENDEDOR POR DIA') && tl.includes('Hat-trick: UM por vendedor por dia'), 'Hat-Trick: um por vendedor por dia (lance repetido por check-in sincronizado tarde nao pontua de novo), na API da liga e no registro');
}
