// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/ceven_admin_token.js
// O QUE É: token de ADMIN do CEVEN compartilhado entre todas as cópias do site (Vitório, 15/10/2026: /supervisores com "login no CEVEN falhou" em ABC, TSJ...).
// POR QUE: cada cópia (isolate) do Cloudflare fazia o próprio login; a tela de supervisores pede as 11 filiais ao mesmo tempo e o CEVEN recusava parte dos logins.
// COMO:   1) token em memória; 2) senão, o token guardado no D1 (config_flags 'ceven_admin_token', vale 20 min); 3) senão, faz login (1 nova tentativa após 1,5 s)
//         e grava no D1 para as outras cópias. Token recusado (401/403) -> chamar invalidaTokenAdmin(env) e pedir de novo.
// SEGREDOS: usuário e senha só vêm de env (CEVEN_ADMIN_USER / CEVEN_ADMIN_PASS); nunca registrados em log nem devolvidos.
// =========================================================================
import { CEVEN_APP_SECRET } from './ceven_auth.js';
const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const VALIDADE_MS = 20 * 60 * 1000;
let mem = { v: null, ate: 0 };
let emAndamento = null;
// motivo da ultima falha de login (codigo HTTP / erro de rede), sem segredo; mostrado na tela para diagnostico
export let ultimaFalhaLogin = '';
// 15/10/2026: com o CEVEN travado, cada tela esperava 32 s pelo login. Depois de uma falha, so tenta de novo apos 3 min (as telas usam a reserva).
let falhouAte = 0;

async function lerD1(env) {
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS config_flags (chave TEXT PRIMARY KEY, valor TEXT)').run();
    const r = await env.DB.prepare("SELECT valor FROM config_flags WHERE chave = 'ceven_admin_token'").first();
    const o = r && JSON.parse(r.valor);
    return o && o.v && Date.now() < o.ate ? o : null;
  } catch { return null; }
}
async function gravarD1(env, o) {
  try { await env.DB.prepare("INSERT OR REPLACE INTO config_flags (chave, valor) VALUES ('ceven_admin_token', ?)").bind(JSON.stringify(o)).run(); } catch { /* sem D1: fica so em memoria */ }
}
async function login(env) {
  for (let t = 0; t < 2; t++) {
    try {
      const r = await fetch(`${CEVEN}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'X-App-Secret': CEVEN_APP_SECRET },
        body: JSON.stringify({ username: env.CEVEN_ADMIN_USER, password: env.CEVEN_ADMIN_PASS }),
        signal: AbortSignal.timeout(10000)
      });
      if (r.ok) { const j = await r.json().catch(() => null); if (j && j.access_token) return j.access_token; ultimaFalhaLogin = 'HTTP 200 sem access_token'; }
      else ultimaFalhaLogin = `HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`;
    } catch (e) { ultimaFalhaLogin = `rede: ${e && e.message}`; }
    if (/^rede/.test(ultimaFalhaLogin)) break; // travou (timeout): nao insiste
    if (t === 0) await new Promise((ok) => setTimeout(ok, 1500));
  }
  return null;
}

export async function tokenAdmin(env) {
  if (!env || !env.CEVEN_ADMIN_USER || !env.CEVEN_ADMIN_PASS) return null;
  if (mem.v && Date.now() < mem.ate) return mem.v;
  if (!emAndamento) {
    emAndamento = (async () => {
      try {
        const d = env.DB ? await lerD1(env) : null;
        if (d) { mem = d; return d.v; }
        if (Date.now() < falhouAte) return null;
        const v = await login(env);
        if (!v) { falhouAte = Date.now() + 3 * 60 * 1000; return null; }
        mem = { v, ate: Date.now() + VALIDADE_MS };
        if (env.DB) await gravarD1(env, mem);
        return v;
      } finally { emAndamento = null; }
    })();
  }
  return emAndamento;
}

export async function invalidaTokenAdmin(env) {
  mem = { v: null, ate: 0 };
  if (env && env.DB) await gravarD1(env, { v: null, ate: 0 });
}
