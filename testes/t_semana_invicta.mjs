// Teste do gatilho da Semana Invicta (functions/api/cron-semana-invicta.js) com dados falsos: quem entra, quem nao entra, feriado, simulacao e nao repetir.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export default async function (ok, RAIZ) {
  const mod = await import(pathToFileURL(join(RAIZ, 'functions', 'api', 'cron-semana-invicta.js')).href);

  // ---- D1 falso (so as 2 instrucoes que a rotina usa) ----
  const checadas = new Map();
  const DB = { prepare(sql) { return { bind(...a) { return {
    run: async () => { if (/INSERT OR REPLACE INTO semana_invicta_checada/.test(sql)) checadas.set(a[1] === undefined ? a[0] : a[0], a[1]); return { meta: { changes: 1 } }; },
    first: async () => (/FROM semana_invicta_checada/.test(sql) ? (checadas.has(a[0]) ? { semana: a[0], qtd: checadas.get(a[0]) } : null) : null)
  }; }, run: async () => ({}), first: async () => null }; } };

  // ---- Pages falso: equipe, regua, lances por dia; captura POST /api/tv-lances ----
  const original = globalThis.fetch;
  const postados = [];
  const EQUIPE = { filiais: { TBL: [
    { rca: '1', nome: 'A INVICTO', supervisor: 'SUP X', mostra: true },
    { rca: '2', nome: 'B TROPECOU', supervisor: 'SUP X', mostra: true },
    { rca: '3', nome: 'C OCULTO', supervisor: 'SUP X', mostra: false },
    { rca: '4', nome: 'D NO LIMITE', supervisor: 'SUP Y', mostra: true }
  ] } };
  // pontos por dia (rca -> lista de dias): A sempre 15; B tem um dia com 10 (<11); C oculto (nao conta); D exatamente 11 todo dia
  const PTS = (rca, i) => ({ '1': 15, '2': i === 2 ? 10 : 20, '3': 30, '4': 11 }[rca]);
  globalThis.fetch = async (url, opts) => {
    const u = new URL(url);
    const resp = (o) => ({ ok: true, json: async () => o });
    if (u.pathname === '/pontuacao_brasileirao.json') return resp({ faixas_pontos_liga: { vitoria: { min_pontos: 11 } } });
    if (u.pathname === '/api/tv-mostra') return resp(EQUIPE);
    if (u.pathname === '/api/brasileirao-lances') {
      const dias = globalThis.__diasDaSemana; const i = dias.indexOf(u.searchParams.get('dia'));
      return resp({ lances: ['1', '2', '3', '4'].map((r) => ({ rca: r, pontos: PTS(r, i), nivel: 'gol', chave: 'x|' + r })) });
    }
    if (u.pathname === '/api/tv-lances' && opts && opts.method === 'POST') { const b = JSON.parse(opts.body); postados.push(b); return resp({ novos: b.lances.map((l) => l.chave) }); }
    return { ok: false, json: async () => ({}) };
  };

  try {
    const chama = async (qs) => (await mod.onRequestGet({ env: { DB }, request: new Request('https://x/api/cron-semana-invicta?' + qs) })).json();

    // semana 05/10 a 09/10 (sem feriado): seg a sex
    globalThis.__diasDaSemana = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
    const sim = await chama('semana=2026-10-07&dry=1');
    ok(sim.status === 'SIMULACAO' && sim.semana === '2026-W41' && sim.dias.length === 5, 'simulacao da semana 05 a 09/10 (2026-W41, 5 dias uteis)');
    ok(sim.invictas === 2 && sim.lista.map((v) => v.rca).sort().join() === '1,4', 'entram so quem teve Vitoria (>= 11) em TODOS os dias: A (15 em todos) e D (exatamente 11); B (um dia com 10) e C (oculto) ficam de fora');
    ok(postados.length === 0 && checadas.size === 0, 'simulacao (?dry=1) nao grava nada nem marca a semana como checada');

    const real = await chama('semana=2026-10-07');
    ok(real.status === 'CHECADA' && real.invictas === 2 && real.gravados >= 2, 'rodada real grava os lances dos invictos');
    const todos = postados.flatMap((p) => p.lances.map((l) => ({ filial: p.filial, ...l })));
    ok(todos.every((l) => l.nivel === 'semanainvicta' && l.supervisor && l.obs && /Vitória em 5 de 5/.test(l.obs)), 'cada lance leva o supervisor e a prova (Vitoria em 5 de 5 dias, pontos por dia)');
    ok(postados.some((p) => p.filial === 'TBL' && p.lances.some((l) => l.chave === 'semanainvicta|1|2026-W41')) && postados.some((p) => p.filial === 'MTZ' && p.lances.some((l) => l.chave === 'TBL|semanainvicta|1|2026-W41')), 'grava na filial do vendedor e tambem em MTZ (Matriz), 1 chave por vendedor e semana');
    ok(!todos.some((l) => l.rca === '2' || l.rca === '3'), 'quem tropecou ou esta oculto nao ganha o lance');
    const antes = postados.length;
    const de_novo = await chama('semana=2026-10-07');
    ok(de_novo.status === 'JA_CHECADA' && postados.length === antes, 'segunda chamada da mesma semana nao repete (JA_CHECADA)');

    // semana com feriado: 12/10 (segunda) e feriado => 4 dias uteis esperados (13 a 16)
    globalThis.__diasDaSemana = ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
    const fer = await chama('semana=2026-10-14&dry=1');
    ok(fer.dias.length === 4 && fer.dias[0] === '2026-10-13' && fer.semana === '2026-W42', 'semana com feriado nacional na segunda (12/10) exige so os 4 dias uteis restantes');

    // fora da temporada (antes de 28/09)
    const fora = await chama('semana=2026-09-21&dry=1');
    ok(fora.status === 'SEMANA_FORA_DA_TEMPORADA', 'semana anterior ao inicio da temporada (28/09) nao conta');
  } finally {
    globalThis.fetch = original;
  }
}
