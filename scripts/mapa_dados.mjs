// =========================================================================
// FICHA DO ARQUIVO: scripts/mapa_dados.mjs
// O QUE É: o MAPA DOS DADOS gerado a partir do CÓDIGO, não da memória de ninguém (Vitório, 26/10/2026: "se vc que é uma IA e que desenhou o projeto não sabe...
//   imagina eu... como corrigir isso?"). Varre o projeto e escreve docs/MAPA_DADOS_GERADO.md com, por arquivo:
//   1. QUEM CHAMA O CEVEN e quais endpoints;
//   2. ONDE GRAVA: tabela do D1, banco SQLite (.db), Google Drive (rclone), arquivo JSON do site;
//   3. SE RODA SOZINHO: site (Cloudflare Functions), cron do site (worker-cron), GitHub Actions (workflow ou orquestrador), ou só manual.
// TRAVA: `node scripts/mapa_dados.mjs --verificar` FALHA (exit 1) se aparecer arquivo NOVO chamando o CEVEN ou lugar NOVO de gravação
//   fora de docs/mapa_dados_base.json. A base só encolhe (cada leitor migrado para o D1 sai dela); nunca acrescentar sem o Vitório pedir.
// USO: node scripts/mapa_dados.mjs            (regera o mapa)
//      node scripts/mapa_dados.mjs --verificar (trava)
//      node scripts/mapa_dados.mjs --congelar  (grava a base atual — só com ordem do Vitório)
// =========================================================================
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PASTAS = ['functions', 'pipeline', 'analises', 'scripts', 'worker-cron/src', 'scratch', 'public', '.github/workflows'];
const EXT = /\.(js|mjs|cjs|py|html|yml)$/;
const BASE = join(RAIZ, 'docs', 'mapa_dados_base.json');
const rel = (p) => relative(RAIZ, p).replace(/\\/g, '/');

function* arquivos(d) {
  if (!existsSync(d)) return;
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.wrangler') || n === '__pycache__') continue;
    const p = join(d, n), s = statSync(p);
    if (s.isDirectory()) yield* arquivos(p); else if (EXT.test(n) && s.size < 3e6) yield p;
  }
}
const ler = (p) => { try { return readFileSync(p, 'utf8'); } catch (e) { return ''; } };

// --- o que roda sozinho ---
const wf = [...arquivos(join(RAIZ, '.github/workflows'))].map(ler).join('\n');
const orq = ler(join(RAIZ, 'pipeline/orquestrador_diario.js'));
const worker = ler(join(RAIZ, 'worker-cron/src/index.js'));
function quemRoda(f) {
  if (f.startsWith('functions/api/cron-') && worker.includes(f.replace('functions', '').replace('.js', ''))) return 'cron do site (worker-cron)';
  if (f.startsWith('functions/')) return 'site (Cloudflare)';
  if (f.startsWith('.github/')) return 'GitHub Actions';
  const nome = f.split('/').pop();
  if (wf.includes(f) || wf.includes(nome)) return 'GitHub Actions (workflow)';
  if (f.startsWith('analises/') && orq.includes(`'${nome}'`)) return 'GitHub Actions (datalake 03:00)';
  if (f.startsWith('public/') && f.endsWith('.html')) return 'navegador (tela)';
  return 'manual';
}

const RX_CEVEN = /drivetriunfante-locomotiva|CEVEN_BASE|\$\{CEVEN\}|CEVEN\s*\+\s*['"`]\/api/;
const RX_EP = /\/api\/(rca|admin|gerente|gerente-auth|supervisor|ceven|linkup|filiais|notificacoes|checkin|industrias|metas)\b[A-Za-z0-9_\-\/{}$.]*/g;
const RX_D1 = /\b(INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_][a-z0-9_]*)/gi;
const RX_DB = /['"`]([A-Za-z0-9_\-]+\.db)['"`]/g;
const RX_DRIVE = /rclone\s+(copy|sync|copyto)\s+[^\n]*gdrive:[^\n]*/g;
const RX_JSON = /writeFileSync\([^)]*?['"`]([A-Za-z0-9_\-\/]+\.json)['"`]/g;

const mapa = [];
for (const pasta of PASTAS) for (const p of arquivos(join(RAIZ, pasta))) {
  const f = rel(p), t = ler(p), linhas = t.split('\n');
  const codigo = linhas.filter((l) => !/^\s*(\/\/|\*|\/\*|#|<!--)/.test(l)).join('\n');
  const ceven = RX_CEVEN.test(codigo) && !f.startsWith('public/') ? [...new Set((codigo.match(RX_EP) || []).map((e) => e.replace(/\$\{[^}]*\}|\/\d+/g, '/{id}').replace(/[/.]+$/, '')))].sort() : [];
  const usaD1 = !/better-sqlite3|import sqlite3|sqlite3\.connect|new Database\(/.test(codigo);   // banco LOCAL so se o arquivo usa SQLite; o resto escreve no D1
  const tabs = [...new Set([...codigo.matchAll(RX_D1)].map((m) => m[2].toLowerCase()).filter((x) => !['set', 'or', 'into', 'from', 'excluded'].includes(x)))].sort();
  const d1 = usaD1 ? tabs : [], tabSqlite = usaD1 ? [] : tabs;
  const dbs = [...new Set([...codigo.matchAll(RX_DB)].map((m) => m[1]))].sort();
  const drive = [...new Set([...codigo.matchAll(RX_DRIVE)].map((m) => m[0].replace(/\s+/g, ' ').slice(0, 90)))];
  const json = [...new Set([...codigo.matchAll(RX_JSON)].map((m) => m[1]))].sort();
  const chamaCeven = RX_CEVEN.test(codigo) && !f.startsWith('public/');
  if (!chamaCeven && !tabs.length && !dbs.length && !drive.length && !json.length) continue;
  mapa.push({ f, roda: quemRoda(f), chamaCeven, ceven, d1, tabSqlite, dbs, drive, json });
}

const MODO = process.argv[2] || '';
const atual = { ceven: mapa.filter((m) => m.chamaCeven).map((m) => m.f).sort(), sqlite: [...new Set(mapa.flatMap((m) => m.dbs))].sort(), drive: mapa.filter((m) => m.drive.length).map((m) => m.f).sort() };

if (MODO === '--congelar') { writeFileSync(BASE, JSON.stringify(atual, null, 1)); console.log('base congelada:', atual.ceven.length, 'arquivos chamam o CEVEN'); process.exit(0); }
if (MODO === '--verificar') {
  const base = JSON.parse(ler(BASE) || '{"ceven":[],"sqlite":[],"drive":[]}');
  const novos = [...atual.ceven.filter((x) => !base.ceven.includes(x)).map((x) => 'chama o CEVEN: ' + x), ...atual.sqlite.filter((x) => !base.sqlite.includes(x)).map((x) => 'banco SQLite novo: ' + x), ...atual.drive.filter((x) => !base.drive.includes(x)).map((x) => 'grava no Drive: ' + x)];
  if (novos.length) { console.error('FALHOU — fora da base única (docs/BASE_UNICA.md):\n  ' + novos.join('\n  ')); process.exit(1); }
  console.log(`ok — ${atual.ceven.length} arquivos chamam o CEVEN (base: ${base.ceven.length}); nenhum novo`); process.exit(0);
}

const roda = (m) => m.roda !== 'manual';
const ativos = mapa.filter((m) => m.chamaCeven && roda(m)), manuais = mapa.filter((m) => m.chamaCeven && !roda(m));
const tabD1 = new Map(); mapa.forEach((m) => m.d1.forEach((t) => tabD1.set(t, [...(tabD1.get(t) || []), m.f])));
const tabDb = new Map(); mapa.forEach((m) => m.dbs.forEach((t) => tabDb.set(t, [...(tabDb.get(t) || []), m.f])));
let md = `# MAPA DOS DADOS — GERADO DO CÓDIGO\n\n> **Não editar à mão.** Gerado por \`node scripts/mapa_dados.mjs\` em ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Plano e decisões: [BASE_UNICA.md](BASE_UNICA.md).\n\n`;
md += `## 1. Quem chama o CEVEN e RODA SOZINHO (${ativos.length})\nMeta: só \`functions/api/cron-varredura-central.js\`.\n\n| Arquivo | Roda | Endpoints |\n|---|---|---|\n`;
ativos.sort((a, b) => a.roda.localeCompare(b.roda) || a.f.localeCompare(b.f)).forEach((m) => { md += `| \`${m.f}\` | ${m.roda} | ${m.ceven.join(', ') || '(monta a URL dinamicamente)'} |\n`; });
md += `\n## 2. Onde os dados são GRAVADOS\n### 2a. Tabelas do D1 (base única) e quem escreve\n| Tabela | Escrita por |\n|---|---|\n`;
[...tabD1].sort().forEach(([t, fs]) => { md += `| \`${t}\` | ${[...new Set(fs)].map((x) => '`' + x + '`').join(', ')} |\n`; });
md += `\n### 2b. Bancos SQLite (FORA da base única)\n| Banco | Usado por |\n|---|---|\n`;
[...tabDb].sort().forEach(([t, fs]) => { md += `| \`${t}\` | ${[...new Set(fs)].map((x) => '`' + x + '`').join(', ')} |\n`; });
md += `\n### 2b2. Tabelas gravadas nesses bancos SQLite (FORA da base única)\n| Tabela | Escrita por |\n|---|---|\n`;
{ const t = new Map(); mapa.forEach((m) => m.tabSqlite.forEach((x) => t.set(x, [...(t.get(x) || []), m.f]))); [...t].sort().forEach(([x, fs]) => { md += `| \`${x}\` | ${[...new Set(fs)].map((y) => '`' + y + '`').join(', ')} |\n`; }); }
md += `\n### 2c. Google Drive (FORA da base única)\n`; mapa.filter((m) => m.drive.length).forEach((m) => { md += `- \`${m.f}\`: ${m.drive.map((d) => '`' + d + '`').join('; ')}\n`; });
md += `\n### 2d. Arquivos JSON gerados para o site\n`; mapa.filter((m) => m.json.length && !m.f.startsWith('functions/')).forEach((m) => { md += `- \`${m.f}\` (${m.roda}): ${m.json.map((d) => '`' + d + '`').join(', ')}\n`; });
md += `\n## 3. Chamam o CEVEN mas só rodam à mão (${manuais.length})\n${manuais.map((m) => '`' + m.f + '`').join(', ')}\n`;
writeFileSync(join(RAIZ, 'docs', 'MAPA_DADOS_GERADO.md'), md);
console.log(`mapa gerado: ${ativos.length} rodam sozinhos chamando o CEVEN; ${manuais.length} manuais; ${tabD1.size} tabelas D1; ${tabDb.size} bancos SQLite`);
