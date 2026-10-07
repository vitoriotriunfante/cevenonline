const fs = require('fs');
const f = 'functions/api/cron-lances.js';
let s = fs.readFileSync(f, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const cut = (ini, fim, r) => { const a = s.indexOf(ini), b = s.indexOf(fim, a); if (a < 0 || b < 0) throw new Error('bloco ' + r); const bloco = s.slice(a, b); s = s.slice(0, a) + s.slice(b); return bloco; };

// 1) tira os tres ganchos internos do fim do coletor (so rodavam se o coletor chegasse ate la)
cut("  // AUDITORIA LANCE POR LANCE (Vitório, 06/10/2026", "  // FECHAMENTO E CONFERENCIA DO DIA", 'auditoria');
const ant = s.indexOf("  let fechamento = 'pulado', conferencia = 'pulado';");
if (ant < 0) throw new Error('decl');
s = s.replace("  let fechamento = 'pulado', conferencia = 'pulado';", "  let conferencia = 'pulado';");
cut("  // o dia fecha as 22h (depois das 23h o CEVEN ja virou o dia)", "  if (t.agoraMin >= 22 * 60 + 5) {", 'fecha');

// 2) novo: ganchos internos (D1 apenas, idempotentes) rodam ANTES do lock/cache, a cada chamada do cron
const novo = `  // GANCHOS INTERNOS (so D1, idempotentes): rodam ANTES das travas de lock/cache. Antes ficavam no fim do coletor e nao rodavam quando a coleta
  // pulava (cache fresco porque as TVs gravam o tempo todo, ou WhatsApp ativo): a Bola Cheia das 18h de 07/10/2026 nao congelou por isso.
  let auditoria = 'pulado', fechamento = 'pulado', bolaCheia = 'pulado';
  {
    const chama = async (rota, ms) => { try { const r = await fetch(\`\${new URL(request.url).origin}\${rota}\`, { signal: AbortSignal.timeout(ms) }); return await r.json().catch(() => ({})); } catch (e) { return { status: 'falhou' }; } };
    const [ja, jf, jb] = await Promise.all([
      t.h >= 8 ? chama('/api/cron-auditoria-lances?rodar=1&se_velho=1', 60000) : null, // AUDITORIA LANCE POR LANCE (a cada ~25 min)
      (t.agoraMin >= 22 * 60 || (t.h >= 6 && t.h < 9)) ? chama('/api/cron-fechamento-dia', 50000) : null, // o dia fecha as 22h; de manha pega o dia anterior ainda aberto
      (t.agoraMin >= 18 * 60 && t.agoraMin < 22 * 60) ? chama('/api/bola-cheia?rodar=1', 50000) : null // BOLA CHEIA: congela o vencedor de cada filial as 18h
    ]);
    if (ja) auditoria = ja.auditados != null ? String(ja.auditados) : (ja.status || 'ok');
    if (jf) fechamento = jf.status || 'ok';
    if (jb) bolaCheia = jb.status || 'ok';
  }

`;
const alvo = "  if (!forcar) {\n    const lock = await env.DB.prepare(\"SELECT dono, criado_em FROM cron_lock_global WHERE id = 1\")";
if (s.split(alvo).length !== 2) throw new Error('alvo');
s = s.replace(alvo, novo + alvo);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('ok');
