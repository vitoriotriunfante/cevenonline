// Testes do envio de NOTIFICACAO ao sino do CEVEN (functions/_lib/ceven_notificacao.js), sem rede: fetch falso.
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export default async function (ok) {
  const lib = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'ceven_notificacao.js')).href);
  const chamadas = [];
  globalThis.fetch = async (url, init) => { chamadas.push({ url, init }); return { ok: true, status: 200 }; };
  const env = { CEVEN_WEBHOOK_SECRET: 'segredo-de-teste' };

  const r = await lib.enviaNotificacao(env, 'TBL', 'Liga Triunfante', 'Teste de mensagem');
  const c = chamadas[0];
  ok(r.ok && c.url === 'https://ceven.drivetriunfante-locomotiva.com.br/api/notificacoes/webhook/tbl1' && c.init.method === 'POST', 'envia POST para /api/notificacoes/webhook/{filial} (TBL vira tbl1)');
  ok(c.init.headers['X-Webhook-Secret'] === 'segredo-de-teste' && c.init.headers['Content-Type'] === 'application/json' && JSON.parse(c.init.body).origem === 'Liga Triunfante' && JSON.parse(c.init.body).mensagem === 'Teste de mensagem', 'cabecalhos e corpo {origem, mensagem} corretos');
  ok(!(await lib.enviaNotificacao(env, 'XXX', 'a', 'b')).ok && chamadas.length === 1, 'filial invalida nao envia nada');
  ok(!(await lib.enviaNotificacao({}, 'tbl1', 'a', 'b')).ok && chamadas.length === 1, 'sem o segredo configurado nao envia');
  ok(!(await lib.enviaNotificacao(env, 'tbl1', '', 'b')).ok && !(await lib.enviaNotificacao(env, 'tbl1', 'a', '  ')).ok && chamadas.length === 1, 'origem e mensagem vazias nao enviam');
  ok(lib.chaveFilial('mcd') === 'mcd1' && lib.chaveFilial('TSJ1') === 'tsj1' && lib.chaveFilial('zzz1') === null && lib.FILIAIS_NOTIFICACAO.length === 11, '11 filiais validas; "mcd" e "TSJ1" normalizam');
  globalThis.fetch = async () => { throw new Error('sem rede'); };
  const f = await lib.enviaNotificacao(env, 'abc1', 'a', 'b');
  ok(!f.ok && !JSON.stringify(f).includes('segredo-de-teste'), 'falha de rede devolve erro sem vazar o segredo');
  // SEGREDO NUNCA NO CODIGO: varre o repositorio atras de qualquer texto de 64 hexadecimais cujo sha256 seja o do segredo real (o segredo em si nao fica aqui)
  const alvoHash = '655be11f7879405df7d186e56747fb8493f20c62fec32976bda84639ff1337f6';
  const acha = [];
  const anda = (rel) => { for (const n of readdirSync(join(RAIZ, rel))) { if (['node_modules', '.git', '.wrangler'].includes(n)) continue; const r = rel ? rel + '/' + n : n; const st = statSync(join(RAIZ, r)); if (st.isDirectory()) anda(r); else if (st.size < 3e6 && /\.(js|mjs|html|json|md|py|toml|yml|yaml|bat|txt)$/.test(n)) { try { for (const t of (readFileSync(join(RAIZ, r), 'utf8').match(/[0-9a-f]{64}/gi) || [])) if (createHash('sha256').update(t).digest('hex') === alvoHash) { acha.push(r); break; } } catch {} } } };
  anda('');
  const resto = acha.filter((x) => x !== 'testes/t_notificacao.mjs');
  ok(resto.length === 0, 'o segredo do webhook nao aparece em nenhum arquivo do repositorio' + (resto.length ? ' (achei em: ' + resto.join(', ') + ')' : ''));
}
