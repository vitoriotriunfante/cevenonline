// SENHA DO +MIX (Vitorio, 25/10/2026: "so eu deveria ter acesso a esses dados... coloque senha imediatamente").
// A tela /mix e todos os dados de cliente (dados_mix, mix_*, vendas_mes*) exigem o cookie dado por
// /api/mix-login (senha da Diretoria = segredo EQUIPE_SENHA). O public/_routes.json limita este
// middleware a esses caminhos + /api/*, para nao criar requisicao paga nas outras telas.
const PROTEGIDO = /^\/(mix(\.html)?(\/|$)|dados_mix\.json|mix_cubo\.json|mix_(rec|vend|cli|hist)\/|vendas_mes(_anterior)?\/|api\/mix-teste)/;

export async function marcaMix(env) {
  const b = new TextEncoder().encode('mix|' + (env.EQUIPE_SENHA || ''));
  const h = await crypto.subtle.digest('SHA-256', b);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const LOGIN = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>+MIX — acesso restrito</title>
<style>body{font-family:system-ui;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0}form{background:#1e293b;padding:28px;border-radius:12px;width:min(320px,90vw)}input,button{width:100%;padding:10px;margin-top:10px;border-radius:8px;border:1px solid #334155;font-size:16px;box-sizing:border-box}button{background:#22c55e;border:0;font-weight:700;cursor:pointer}#e{color:#f87171;min-height:1em;margin-top:8px}</style></head>
<body><form id="f"><b>🔒 +MIX — acesso restrito</b><input id="s" type="password" placeholder="Senha da Diretoria" autofocus><button>Entrar</button><div id="e"></div></form>
<script>f.onsubmit=async(ev)=>{ev.preventDefault();const r=await fetch('/api/mix-login',{method:'POST',headers:{'X-Equipe-Senha':s.value}});if(r.ok)location.reload();else e.textContent=(await r.json().catch(()=>({}))).erro||'Senha incorreta';}</script></body></html>`;

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const p = new URL(request.url).pathname;
  if (!PROTEGIDO.test(p)) return next();
  const ck = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)mix_ok=([0-9a-f]{64})/);
  if (env.EQUIPE_SENHA && ck && ck[1] === await marcaMix(env)) {
    const r = await next();
    const h = new Headers(r.headers); h.set('Cache-Control', 'private, no-store');
    return new Response(r.body, { status: r.status, headers: h });
  }
  if (/^\/mix(\.html)?\/?$/.test(p)) return new Response(LOGIN, { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  return new Response(JSON.stringify({ erro: 'acesso restrito' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
}
