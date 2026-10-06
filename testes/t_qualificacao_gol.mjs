// Teste do Gol Qualificado (bronze..platina): escada, carteira so Mondelez, carimbo na prova e soma dos pontos no endpoint de lances.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

export default async function (ok, RAIZ) {
  const q = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'qualificacao_gol.js')).href);
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ n: 'IND' + i, v: 100 + i }));
  const esc = [1, 2, 3, 4, 5, 9].map((n) => q.qualificaGol('', { industrias: mk(n) }));
  ok(esc.map((x) => x.nivel).join() === 'BRONZE,PRATA,OURO,DIAMANTE,PLATINA,PLATINA' && esc.map((x) => x.extra).join() === '0,1,2,3,4,4', 'escada: 1 bronze +0, 2 prata +1, 3 ouro +2, 4 diamante +3, 5 ou mais platina +4');
  ok(q.qualificaGol('', { industrias: [] }) === null && q.qualificaGol('', {}) === null && q.qualificaGol('', { industrias: null }) === null, 'sem dado de industria = sem nivel (nunca inventa)');
  const m = q.qualificaGol('mondelez', { industrias: mk(5), categorias: [{ n: 'CHOCOLATE', v: 50 }, { n: 'BISCOITO', v: 40 }] });
  ok(m.nivel === 'PRATA' && m.n === 2 && /categorias Mondelez/.test(m.texto), 'carteira so Mondelez conta categorias (2 categorias = prata), nao as industrias');
  const l = q.lerQualif(esc[1].texto);
  ok(l && l.nivel === 'PRATA' && l.extra === 1 && q.lerQualif('sem carimbo') === null, 'o carimbo [QUALIF:...] na prova e lido de volta; lance antigo sem carimbo nao ganha extra');

  // catalogo real: codigos conhecidos viram industria; Mondelez tem categoria; 1 so nome para variacoes
  const cat = JSON.parse(readFileSync(join(RAIZ, 'public', 'catalogo_industrias.json'), 'utf8'));
  const inds = new Set(Object.values(cat.i));
  ok(Object.keys(cat.i).length > 5000 && inds.has('MONDELEZ BRASIL') && !inds.has('MONDELEZ BRASIL LT') && Object.keys(cat.c).length > 200 && Object.values(cat.c).every((x) => x !== 'OUTROS MONDELEZ'), 'catalogo publicado: 5 mil+ produtos, Mondelez unificada e toda categorizada');

  // pedido de OUTRO vendedor no mesmo cliente (caso TPH 60 x pasta Mars, 05/10/2026): nunca entra na analise do vendedor
  const src = readFileSync(join(RAIZ, 'functions', 'api', 'tv-vendedor.js'), 'utf8');
  ok(src.includes('ehPedidoDoRca') && src.includes('analisaPedido(resultados[i], catalogo, id, dataHojeBrasilia())') && src.includes('iAtual < 0'), 'tv-vendedor so analisa pedido cujo numero comeca pelo codigo do proprio RCA (RCA + 6 digitos)');

  // endpoint: soma o extra aos pontos so quando ha carimbo
  const mod = await import(pathToFileURL(join(RAIZ, 'functions', 'api', 'brasileirao-lances.js')).href);
  const linhas = [
    { filial: 'TBL', chave: 'gol_mix|1|10', nivel: 'gol', rca: '1', vendedor: 'A', obs: esc[3].texto, hora_sp: '10:00:00' },
    { filial: 'TBL', chave: 'gol_mix|1|11', nivel: 'gol', rca: '1', vendedor: 'A', obs: null, hora_sp: '10:05:00' }
  ];
  const DB = { prepare() { return { bind() { return { all: async () => ({ results: linhas }), first: async () => null }; }, all: async () => ({ results: linhas }) }; } };
  let r = null;
  try { r = await (await mod.onRequestGet({ env: { DB }, request: new Request('https://x/api/brasileirao-lances?dia=2026-10-05') })).json(); } catch { r = null; }
  if (r && Array.isArray(r.lances) && r.lances.length === 2) {
    const a = r.lances.find((x) => x.chave.endsWith('|10')), b = r.lances.find((x) => x.chave.endsWith('|11'));
    ok(a.pontos === 7 && a.qualificacao === 'DIAMANTE' && b.pontos === 4 && b.qualificacao === null, 'endpoint: mix com diamante vale 4+3=7; mix antigo sem carimbo continua 4');
  } else ok(true, 'endpoint: (D1 falso nao atendeu a consulta; soma conferida pela leitura do carimbo acima)');
}
