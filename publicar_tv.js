/**
 * FICHA DO ARQUIVO
 * O QUE É: publica a TV/CFTV no Cloudflare Pages (ceven-cftv-matrix) e GARANTE que todas as
 *          TVs abertas se atualizem sozinhas.
 * PROJETO: CFTV/TV (não é WhatsApp). Ver CLAUDE.md.
 * COMO: node publicar_tv.js "mensagem curta"   (ou duplo clique em PUBLICAR_TV.bat)
 * REGRA (Vitório, 23/09/2026): toda mudança publicada tem que chegar sozinha nas TVs já conectadas.
 *       Isso funciona porque tv.html consulta /api/version a cada 30s e recarrega quando muda.
 *       Este script troca a versão AUTOMATICAMENTE a cada publicação (ninguém precisa lembrar).
 * FAZ: 1) grava nova versão em functions/api/version.js  2) wrangler pages deploy (produção)
 *      3) confere que /api/version no ar mudou.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const msg = process.argv.slice(2).join(' ') || 'publicacao TV';

// TRAVA DE SEGURANCA (03/10/2026): antes de publicar, roda os testes (sintaxe de tudo, teto de 6 chamadas ao
// CEVEN, equipe no WhatsApp, agenda do Worker, senha, aprovacao, contagem de lances). Se algum falhar, CANCELA.
// Assim, ajustar o CFTV nao quebra o WhatsApp sem avisar. Ver testes/rodar_testes.mjs.
{
  const { spawnSync } = require('child_process');
  const teste = spawnSync(process.execPath, [path.join(__dirname, 'testes', 'rodar_testes.mjs')], { stdio: 'inherit' });
  if (teste.status !== 0) {
    console.error('\nTESTES FALHARAM: publicacao CANCELADA. Corrija o que falhou acima e rode de novo.');
    process.exit(1);
  }
}
const agora = new Date();
const p2 = n => String(n).padStart(2, '0');
const stamp = `${agora.getFullYear()}${p2(agora.getMonth() + 1)}${p2(agora.getDate())}-${p2(agora.getHours())}${p2(agora.getMinutes())}${p2(agora.getSeconds())}`;
const versao = `tv-${stamp}`;

const arq = path.join(__dirname, 'functions', 'api', 'version.js');
const src = fs.readFileSync(arq, 'utf8');
if (!/const RELEASE_VERSION = '[^']*';/.test(src)) { console.error('version.js fora do formato esperado'); process.exit(1); }
fs.writeFileSync(arq, src.replace(/const RELEASE_VERSION = '[^']*';/, `const RELEASE_VERSION = '${versao}';`));
console.log('Versao:', versao);

try { execSync('node gerar_mostra_tv.js', { stdio: 'inherit', cwd: __dirname }); } catch { console.warn('AVISO: nao consegui atualizar a lista MOSTRA (mantendo a anterior).'); }

execSync(`npx wrangler pages deploy public --project-name ceven-cftv-matrix --branch main --commit-dirty=true --commit-message "${msg.replace(/"/g, "'")} (${versao})"`, { stdio: 'inherit', cwd: __dirname });

(async () => {
  for (let i = 0; i < 12; i++) {
    try {
      const r = await fetch('https://ceven-cftv-matrix.pages.dev/api/version', { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const d = await r.json();
      if (d.version === versao) { console.log('NO AR:', d.version, '- as TVs abertas recarregam sozinhas em ate 30s.'); return; }
    } catch {}
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log('Publicado, mas a versao nova ainda nao apareceu em /api/version (pode levar mais alguns segundos).');
})();
