// TESTE-GUARDA DA REGRA ÚNICA (Vitório, 25/10/2026: "A recomendação é uma biblioteca única de regras, mais um teste que
// falhe se alguém reescrever a regra em outro lugar. ISSO JÁ DEVERIA TER FEITO!!!!").
// FALHA (exit 1) se, fora de public/regras.js, alguém escrever à mão:
//   1. a lista de canais do varejo (VJ, PET VJ, FARMA, ESP)
//   2. a "data de hoje" de Brasília (en-CA / sv-SE / fr-CA / formatToParts com ano)
//   3. a chamada HTTP da Evolution (sendText, sendSticker, getBase64)
//   4. a chave do app do CEVEN (fica só em functions/_lib/ceven_auth.js; no motor vem do segredo do GitHub)
// Uso: node testes/regra_unica.mjs
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PASTAS = ['functions', 'pipeline', 'worker-cron', 'analises', 'public'];
const EXT = /\.(js|mjs|cjs|html)$/;
// Exceções conhecidas. os 12 endpoints mortos foram apagados em 25/10/2026 (docs/AUDITORIA_LIMPEZA_2026-10-25.md). Nunca acrescentar arquivo novo nesta lista sem o Vitório pedir.
const EXCECOES = new Set([
  'public/regras.js', 'functions/_lib/ceven_auth.js',
  // worker separado (dispara o WhatsApp; publicar o worker troca o login do wrangler): migra no proximo deploy dele
  'worker-cron/src/vigia.js',
]);
const REGRAS = [
  ['lista de canais do varejo escrita à mão (use R.CANAIS_VAREJO / REGRAS.CANAIS_VAREJO)', /['"]VJ['"]\s*,\s*['"](PET VJ|FARMA)['"]|\(VJ\|PET VJ\|FARMA/],
  ['data de hoje de Brasília escrita à mão (use R.hojeSP() / R.relogioSP())', /(en-CA|sv-SE|fr-CA)['"][^\n]*America\/Sao_Paulo|America\/Sao_Paulo['"][^\n]*year:[^\n]*formatToParts/],
  ['chamada da Evolution escrita à mão (use R.evolution / R.enviarTexto)', /\/message\/send(Text|Sticker|Media)\/|\/chat\/getBase64FromMediaMessage\//],
  ['chave do app do CEVEN no código (importe de functions/_lib/ceven_auth.js)', /['"][0-9a-f]{64}['"]/],
];
const ehComentario = (l) => /^\s*(\/\/|\*|\/\*|<!--|#)/.test(l);

function* arquivos(d) {
  for (const n of readdirSync(join(RAIZ, d))) {
    const rel = d + '/' + n, st = statSync(join(RAIZ, rel));
    if (st.isDirectory()) { if (!/node_modules|desligados|animacoes|jota$/.test(n)) yield* arquivos(rel); }
    else if (EXT.test(n) && st.size < 3e6) yield rel;
  }
}
const falhas = [];
let lidos = 0;
for (const p of PASTAS) for (const f of arquivos(p)) {
  if (EXCECOES.has(f)) continue;
  lidos++;
  const conteudo = readFileSync(join(RAIZ, f), 'utf8');
  // caractere invisivel (backspace) no lugar de \b numa regex: a regra para de funcionar sem dar erro (aconteceu 3x em 25/10/2026)
  if (conteudo.includes('\x08')) falhas.push(`${f}: caractere invisível (backspace) no código — provavelmente um \\b de regex estragado`);
  conteudo.split('\n').forEach((l, i) => {
    if (ehComentario(l)) return;
    for (const [nome, rx] of REGRAS) if (rx.test(l)) falhas.push(`${f}:${i + 1}  ${nome}\n      ${l.trim().replace(/[0-9a-f]{64}/g, '<chave>').slice(0, 160)}`);
  });
}
// a própria biblioteca tem que existir e ser coerente
const R = (await import('../public/regras.js')).default;
const ok = R && R.CANAIS_VAREJO.join() === 'VJ,PET VJ,FARMA,ESP' && R.ehVarejo('pet vj') && !R.ehVarejo('AS') && R.canalCurto('PET AS') === 'AS'
  && /^\d{4}-\d{2}-\d{2}$/.test(R.hojeSP()) && R.relogioSP(new Date('2026-10-26T02:30:00Z')).dia === '2026-10-25' && R.brl(1234.6) === 'R$ 1.235';
if (!ok) falhas.push('public/regras.js: a biblioteca não passou na conferência básica');
if (falhas.length) { console.log(`❌ REGRA ÚNICA VIOLADA (${falhas.length}):\n  ` + falhas.join('\n  ')); process.exit(1); }
console.log(`✅ regra única: ${lidos} arquivos conferidos, nenhuma regra reescrita fora de public/regras.js`);
