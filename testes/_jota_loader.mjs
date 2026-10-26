// Carrega o JOTA (functions/api/whatsapp/bot.js e os módulos que ele importa) no Node para os testes.
// As Functions são ESM em arquivos .js e o projeto não é "type: module": copia a árvore functions/ para uma pasta temporária com
// extensão .mjs, corrige os imports e aponta public/regras.js para o arquivo real. Opcional: fonteBot = outro conteúdo para o bot.js
// (usado para comparar a versão antiga com a nova).
import fs from 'fs'; import os from 'os'; import path from 'path'; import { pathToFileURL } from 'url';

export async function carregaJota(raiz, fonteBot = null) {
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'jota_'));
  const regras = pathToFileURL(path.join(raiz, 'public', 'regras.js')).href;
  const copia = (rel) => {
    const src = path.join(raiz, 'functions', rel);
    for (const n of fs.readdirSync(src)) {
      const r = path.join(rel, n), s = path.join(src, n);
      if (fs.statSync(s).isDirectory()) { fs.mkdirSync(path.join(dst, r), { recursive: true }); copia(r); continue; }
      if (!n.endsWith('.js')) continue;
      let txt = (fonteBot != null && r.replace(/\\/g, '/') === 'api/whatsapp/bot.js') ? fonteBot : fs.readFileSync(s, 'utf8');
      txt = txt.replace(/(from\s+|import\s*\(\s*)(['"])([^'"]+)\2/g, (m, a, q, spec) => {
        if (/public\/regras\.js$/.test(spec)) return `${a}${q}${regras}${q}`;
        if (spec.startsWith('.') && spec.endsWith('.js')) return `${a}${q}${spec.slice(0, -3)}.mjs${q}`;
        return m;
      });
      fs.writeFileSync(path.join(dst, r.slice(0, -3) + '.mjs'), txt);
    }
  };
  copia('.');
  const mod = await import(pathToFileURL(path.join(dst, 'api', 'whatsapp', 'bot.mjs')).href);
  return { ...mod, limpa: () => { try { fs.rmSync(dst, { recursive: true, force: true }); } catch (e) {} } };
}
