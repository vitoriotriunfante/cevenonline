// Base unica do motor do WhatsApp: le da varredura central quando fresca; senao vai ao CEVEN; nunca inventa.
import { createRequire } from 'module';
import { join } from 'path';
import { readFileSync } from 'fs';
export default async function t(ok, RAIZ) {
  const req = createRequire(import.meta.url);
  const fb = req(join(RAIZ, 'pipeline', 'fonte_base.js'));
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => ({ ok: true, json: async () => ({ rcas: { '123': { idade_s: 60, produtividade: { dia: { dig_pedido: 500 } }, dashboard: { financeiro: { meta: 1 } }, devolucoes: [], roteiro: null }, '456': { idade_s: 5000, produtividade: { dia: {} }, dashboard: null, devolucoes: [], roteiro: [] } } }) });
    fb.limpar();
    const r = await fb.carregarBase(['tbl1'], '2026-10-07');
    ok(r.rcas === 2 && r.filiais === 1, 'base unica: carrega a filial e conta os RCAs');
    const U = 'https://ceven.x/api/rca';
    ok(fb.lerBase(`${U}/produtividade?filial=tbl1&id=123`).dia.dig_pedido === 500, 'base unica: produtividade fresca vem da base');
    ok(Array.isArray(fb.lerBase(`${U}/devolucoes?filial=tbl1&id=123`)), 'base unica: devolucoes (lista vazia e dado valido) vem da base');
    ok(fb.lerBase(`${U}/roteiro-hoje?filial=tbl1&id=123`) === undefined, 'base unica: parte que a varredura nao gravou (null) vai ao CEVEN, nunca vira vazio inventado');
    ok(fb.lerBase(`${U}/produtividade?filial=tbl1&id=456`) === undefined, 'base unica: linha mais velha que o limite vai ao CEVEN');
    ok(fb.lerBase(`${U}/produtividade?filial=tbl1&id=999`) === undefined, 'base unica: RCA que nao esta na base vai ao CEVEN');
    ok(fb.lerBase(`${U}/historico-cliente/55?filial=tbl1&id=123`) === undefined, 'base unica: historico-cliente nao e centralizado, sempre vai ao CEVEN');
    globalThis.fetch = async () => { throw new Error('rede'); };
    fb.limpar(); await fb.carregarBase(['tph1'], '2026-10-07');
    ok(fb.lerBase(`${U}/produtividade?filial=tph1&id=1`) === undefined, 'base unica: base fora do ar = tudo ao CEVEN como antes (nao quebra o disparo)');
  } finally { globalThis.fetch = original; fb.limpar(); }
  const motor = readFileSync(join(RAIZ, 'pipeline', 'ceven_unified_engine.js'), 'utf8');
  ok(motor.includes("require('./fonte_base')") && motor.includes('fonteBase.lerBase(url)') && motor.includes('fonteBase.carregarBase(Object.keys(FILIAIS_MAP), dataRef)'), 'motor do WhatsApp: le da base unica antes de perguntar ao CEVEN');
  ok(readFileSync(join(RAIZ, 'functions/api/central-snapshot.js'), 'utf8').includes('varredura_central_rca') && readFileSync(join(RAIZ, '.github/workflows/ceven-cron-whatsapp.yml'), 'utf8').includes('pipeline'), 'base unica: endpoint /api/central-snapshot le a varredura central');
}
