// Vigia dos disparos de WhatsApp: refaz so o que NAO comecou; nunca duplica.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export default async function (ok, RAIZ) {
  const v = await import(pathToFileURL(join(RAIZ, 'worker-cron', 'src', 'vigia.js')).href);
  const ini = Date.parse('2026-10-05T20:00:00Z'); // 17:00 BRT
  const min = (n) => new Date(ini + n * 60000).toISOString();
  const run = (id, status, conclusion, criada) => ({ id, status, conclusion, created_at: min(criada) });

  ok(v.estadoSlot([], ini, ini + 5 * 60000).estado === 'aguardando', 'ate 8 min do horario: so aguardando (nao mexe)');
  ok(v.estadoSlot([run(1, 'completed', 'success', 0)], ini, ini + 20 * 60000).estado === 'ok', 'disparo com sucesso: tudo certo');
  ok(v.estadoSlot([run(1, 'in_progress', null, 0)], ini, ini + 20 * 60000).estado === 'rodando', 'disparo rodando: nao refaz');
  ok(v.estadoSlot([], ini, ini + 9 * 60000).estado === 'refazer', 'nenhuma run 9 min depois do horario: refaz (cron perdido)');
  const e17 = v.estadoSlot([run(1, 'queued', null, 0)], ini, ini + 10 * 60000);
  ok(e17.estado === 'refazer' && e17.paradas.length === 1, 'caso real das 17h: run parada na fila sem maquina ha 10 min -> cancela a parada e refaz');
  ok(v.estadoSlot([run(1, 'completed', 'cancelled', 0)], ini, ini + 16 * 60000, () => false).estado === 'refazer', 'run cancelada sem ter executado passo: refaz');
  ok(v.estadoSlot([run(1, 'completed', 'failure', 0)], ini, ini + 16 * 60000, () => true).estado === 'falhou_apos_iniciar', 'run que ja executou passos e falhou: NAO refaz (poderia duplicar mensagem)');
  // 07/10/2026 (18:30): job executou passos mas foi cancelado por tempo ainda na coleta; o log prova que nada foi enviado -> refaz. Com envio (ou log nao lido) continua sem refazer.
  ok(v.estadoSlot([run(1, 'completed', 'cancelled', 0)], ini, ini + 30 * 60000, () => true, () => true).estado === 'refazer', 'job iniciado, cancelado por tempo e SEM nenhum envio no log: refaz');
  ok(v.estadoSlot([run(1, 'completed', 'cancelled', 0)], ini, ini + 30 * 60000, () => true, () => false).estado === 'falhou_apos_iniciar', 'job iniciado e sem prova de que nada foi enviado: NAO refaz');
  ok(v.estadoSlot([run(1, 'completed', 'cancelled', 0), run(2, 'completed', 'cancelled', 9)], ini, ini + 30 * 60000, () => true, () => true).estado === 'esgotado', 'mesmo sem envio, no maximo 2 tentativas');
  { const sv = await import('../worker-cron/src/vigia.js'); const orig = globalThis.fetch; try {
    const log = (extra) => 'x'.repeat(2500) + ' Executando Ciclo: 18:30 ' + extra;
    globalThis.fetch = async (u) => (String(u).includes('api.github.com') ? { headers: { get: () => 'https://blob.example/log' }, ok: false, status: 302 } : { ok: true, text: async () => log('coleta... Apurando Cortes') });
    ok(await sv.jobSemEnvio({ GITHUB_TOKEN: 'x' }, 1) === true, 'jobSemEnvio: log completo sem a linha de envio = nada foi enviado');
    globalThis.fetch = async (u) => (String(u).includes('api.github.com') ? { headers: { get: () => 'https://blob.example/log' }, ok: false, status: 302 } : { ok: true, text: async () => log('Enviando Consolidado para Vitorio') });
    ok(await sv.jobSemEnvio({ GITHUB_TOKEN: 'x' }, 1) === false, 'jobSemEnvio: com a linha Enviando = ja enviou, nao refaz');
    globalThis.fetch = async () => { throw new Error('rede'); };
    ok(await sv.jobSemEnvio({ GITHUB_TOKEN: 'x' }, 1) === false, 'jobSemEnvio: log nao lido = na duvida, nao refaz');
  } finally { globalThis.fetch = orig; } }
  ok(v.estadoSlot([run(1, 'completed', 'cancelled', 0), run(2, 'completed', 'cancelled', 9)], ini, ini + 30 * 60000).estado === 'esgotado', 'ja houve 2 tentativas: para (a Matriz avisa)');
  ok(v.estadoSlot([run(1, 'queued', null, 7)], ini, ini + 10 * 60000).estado === 'aguardando', 'run recente (3 min) ainda na fila: espera');

  // vigiarDisparos com GitHub falso: no caso das 17h faz cancel + 1 dispatch; segunda passada (ja ha 2 runs) nao dispara mais
  const original = globalThis.fetch; const chamadas = [];
  let runs = [{ id: 7, status: 'queued', conclusion: null, created_at: min(0) }];
  globalThis.fetch = async (url, init) => {
    const u = String(url); chamadas.push((init && init.method || 'GET') + ' ' + u.replace('https://api.github.com/repos/vitoriotriunfante/cevenonline', ''));
    if (/\/runs\?/.test(u)) return { ok: true, status: 200, json: async () => ({ workflow_runs: runs }) };
    if (/\/cancel$/.test(u)) return { ok: true, status: 202, json: async () => ({}) };
    if (/\/dispatches$/.test(u)) { runs = [...runs, { id: 8, status: 'queued', conclusion: null, created_at: min(10) }]; return { ok: true, status: 204, json: async () => ({}) }; }
    return { ok: true, status: 200, json: async () => ({ jobs: [] }) };
  };
  try {
    const agora = new Date(ini + 10 * 60000);
    const l1 = await v.vigiarDisparos({ GITHUB_TOKEN: 'x' }, agora);
    ok(chamadas.some((c) => /POST .*runs\/7\/cancel/.test(c)) && chamadas.filter((c) => /POST .*dispatches/.test(c)).length === 1 && l1.some((x) => /refeito/.test(x)), 'vigia: cancela a run parada (7) e dispara UMA vez');
    const antes = chamadas.filter((c) => /dispatches/.test(c)).length;
    await v.vigiarDisparos({ GITHUB_TOKEN: 'x' }, new Date(ini + 12 * 60000));
    ok(chamadas.filter((c) => /dispatches/.test(c)).length === antes, 'passada seguinte nao dispara de novo (sem duplicar)');
    const sab = await v.vigiarDisparos({ GITHUB_TOKEN: 'x' }, new Date('2026-10-10T20:10:00Z'));
    ok(sab.length === 0, 'sabado: o vigia nao faz nada');
  } finally { globalThis.fetch = original; }
}
