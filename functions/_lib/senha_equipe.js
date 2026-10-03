// SENHA DE APROVACAO DA EQUIPE (decisao do Vitorio, 03/10/2026).
// Entrar como Diretoria, salvar a base da equipe e aprovar/rejeitar solicitacoes exigem a senha da
// Diretoria, enviada no cabecalho X-Equipe-Senha e conferida contra o segredo EQUIPE_SENHA do
// Cloudflare Pages. A senha NUNCA fica no codigo nem na pagina. Sem o segredo configurado, as
// gravacoes ficam bloqueadas (falha fechada). Apos 5 erros em 10 minutos, o IP fica bloqueado (429).
// Criar o segredo:  npx wrangler pages secret put EQUIPE_SENHA --project-name ceven-cftv-matrix

const MAX_ERROS = 5, JANELA_MS = 10 * 60 * 1000;

function iguais(a, b) {
  const x = String(a || ''), y = String(b || '');
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return dif === 0;
}

// Retorna null se a senha confere; senao retorna a Response de erro a devolver.
export async function exigeSenhaEquipe(request, env, cors) {
  const json = (o, status) => new Response(JSON.stringify(o), { status, headers: cors });
  if (!env.EQUIPE_SENHA) {
    return json({ sucesso: false, erro: 'Senha de aprovacao nao configurada no servidor (segredo EQUIPE_SENHA). Gravacao bloqueada.' }, 503);
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'desconhecido';
  if (env.DB) {
    try {
      await env.DB.prepare('CREATE TABLE IF NOT EXISTS equipe_tentativas (ip TEXT NOT NULL, ts INTEGER NOT NULL)').run();
      const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM equipe_tentativas WHERE ip = ? AND ts > ?').bind(ip, Date.now() - JANELA_MS).first();
      if (r && r.n >= MAX_ERROS) return json({ sucesso: false, erro: 'Muitas tentativas erradas. Aguarde 10 minutos.' }, 429);
    } catch (e) { /* sem D1: segue so com a conferencia da senha */ }
  }
  const enviada = request.headers.get('X-Equipe-Senha');
  if (!enviada || !iguais(enviada, env.EQUIPE_SENHA)) {
    if (env.DB) { try { await env.DB.prepare('INSERT INTO equipe_tentativas (ip, ts) VALUES (?, ?)').bind(ip, Date.now()).run(); } catch (e) {} }
    return json({ sucesso: false, erro: 'Senha incorreta ou nao informada.' }, 401);
  }
  return null;
}
