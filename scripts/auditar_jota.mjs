// =========================================================================
// FICHA DO ARQUIVO: scripts/auditar_jota.mjs
// O QUE É: AUDITORIA DIARIA das conversas do JOTA (Vitorio, 26/10/2026: "reveja todas as conversas... audite todas as perguntas e respostas... vamos fazer
//   isso diariamente... vai anotando tudo que ja checou para nao ter retrabalho... organizar as respostas para caso outros supervisores facam a mesma pergunta").
// COMO: le do D1 (bot_msgs + bot_contatos) TODA mensagem depois do ultimo id auditado (MAIS_MIX/JOTA/auditoria/estado.json) e escreve
//   MAIS_MIX/JOTA/auditoria/<AAAA-MM-DD>.md: por pessoa, cada pergunta com a resposta, com uma coluna VEREDITO para preencher (certo / errado + causa).
//   Depois de auditar: cada pergunta errada vira caso em MAIS_MIX/JOTA/perguntas_reais.json (teste: node testes/jota_perguntas_reais.mjs) e o
//   estado avanca (node scripts/auditar_jota.mjs --fechar <ultimo_id>).
// USO: node scripts/auditar_jota.mjs            (gera o arquivo do dia com o que falta auditar)
//      node scripts/auditar_jota.mjs --fechar N  (marca ate o id N como auditado)
// =========================================================================
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DIR = join(RAIZ, 'MAIS_MIX', 'JOTA', 'auditoria'), EST = join(DIR, 'estado.json');
mkdirSync(DIR, { recursive: true });
const estado = existsSync(EST) ? JSON.parse(readFileSync(EST, 'utf8')) : { ultimo_id: 0, historico: [] };
if (process.argv[2] === '--fechar') {
  const n = Number(process.argv[3]); if (!n) { console.error('informe o id'); process.exit(1); }
  estado.historico.push({ ate_id: n, em: new Date().toISOString() }); estado.ultimo_id = n; writeFileSync(EST, JSON.stringify(estado, null, 1));
  console.log('auditado ate o id', n); process.exit(0);
}
const sql = `SELECT m.id, datetime(m.quando,'-3 hours') q, m.celular, COALESCE(c.nome, m.nome) nome, c.papel, c.filial, m.direcao, m.tipo, m.nota, m.texto FROM bot_msgs m LEFT JOIN bot_contatos c ON c.celular = m.celular WHERE m.id > ${estado.ultimo_id} AND m.direcao IN ('in','out') ORDER BY m.celular, m.id`;
const out = execSync(`npx wrangler d1 execute ceven_noc_d1 --remote --json --command "${sql}"`, { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 }).toString();
const linhas = JSON.parse(out)[0].results || [];
if (!linhas.length) { console.log('nada novo desde o id', estado.ultimo_id); process.exit(0); }
const porPessoa = new Map();
for (const l of linhas) { const k = l.celular; if (!porPessoa.has(k)) porPessoa.set(k, []); porPessoa.get(k).push(l); }
const dia = linhas[linhas.length - 1].q.slice(0, 10), maxId = Math.max(...linhas.map((l) => l.id));
let md = `# Auditoria do JOTA — ${dia}\n\nMensagens dos ids ${estado.ultimo_id + 1} a ${maxId} · ${linhas.filter((l) => l.direcao === 'in').length} perguntas · ${porPessoa.size} pessoas.\n`;
md += `\nComo auditar: para cada pergunta, VEREDITO = ✅ certo / ❌ errado (causa) / ⚠️ fraco. Cada ❌ vira caso em perguntas_reais.json. Ao terminar: \`node scripts/auditar_jota.mjs --fechar ${maxId}\`.\n`;
for (const [cel, L] of porPessoa) {
  const p = L[0]; md += `\n## ${p.nome || cel} (${p.papel || 'sem cadastro'}${p.filial ? ' · ' + p.filial : ''})\n\n| Hora | Pergunta | Resposta (início) | Tipo | Nota | VEREDITO |\n|---|---|---|---|---|---|\n`;
  for (let i = 0; i < L.length; i++) {
    if (L[i].direcao !== 'in') continue;
    const r = L.slice(i + 1).find((x) => x.direcao === 'out') || {};
    const cel2 = (s) => String(s || '').replace(/\|/g, '/').replace(/\n/g, ' ⏎ ').slice(0, 260);
    md += `| ${L[i].q.slice(11, 16)} | ${cel2(L[i].texto)} | ${cel2(r.texto)} | ${r.tipo || ''} | ${r.nota || ''} |  |\n`;
  }
}
const arq = join(DIR, `${dia}.md`);
writeFileSync(arq, md);
console.log(`gerado ${arq}: ${linhas.filter((l) => l.direcao === 'in').length} perguntas de ${porPessoa.size} pessoas (ids ${estado.ultimo_id + 1}-${maxId})`);
