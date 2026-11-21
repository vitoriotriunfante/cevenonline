// BATERIA COMPLETA COM AS PERGUNTAS REAIS (plano do JOTA, bloco C; Vitorio 17/11/2026: "manda bala... faca").
// Le do D1 as mensagens recebidas no periodo (bot_msgs, direcao 'in'), com o perfil de quem mandou (bot_contatos), e pergunta SECO ao JOTA de producao
// (/api/jota-seco, na ordem da conversa de cada pessoa, nada enviado). Passa cada resposta na regua. Relatorio LOCAL (saida_auditoria/, fora do git) + resumo no D1.
// Uso: JOTA_CHAVE=... node testes/bateria_real.mjs [desde=2026-11-16] [ate=2026-11-17]
import fs from 'fs'; import path from 'path'; import { spawnSync } from 'child_process';
import { avaliar } from './jota_regua.mjs';
const CHAVE = process.env.JOTA_CHAVE, SITE = 'https://ceven-cftv-matrix.pages.dev';
if (!CHAVE) { console.error('JOTA_CHAVE nao definida'); process.exit(1); }
const [desde = '2026-11-16', ate = '2026-11-17'] = process.argv.slice(2);
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const sql = (q) => { const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28 }); const s = r.stdout || ''; return JSON.parse(s.slice(s.indexOf('[')))[0].results; };
const M = sql(`SELECT m.celular, m.quando, m.texto, c.nome, c.papel, c.filial, c.rca, c.grupo FROM bot_msgs m LEFT JOIN bot_contatos c ON c.celular = m.celular WHERE m.direcao = 'in' AND m.quando >= '${desde}' AND m.quando < date('${ate}', '+1 day') ORDER BY m.celular, m.quando`);
// fora da bateria: avaliacao (👍/👎), sugestao, pare, so emoji, vazio, audio sem transcricao, numero solto de menu (depende da tela anterior)
const fora = (t) => !t || t.length < 3 || /^\s*(👍|👎|ok|obrigad|valeu|sim|nao|não)\W*$/i.test(t) || /^\W*sugest/i.test(t) || /^\W*(pare|para|chega)\W*$/i.test(t) || /^\W*\d{1,2}(\.\d)?\W*$/.test(t) || /^\[(imagem|figurinha|sticker|documento)/i.test(t);
const porPessoa = new Map();
for (const m of M) { if (!m.papel || m.papel === 'grupo' || fora(String(m.texto || '').trim())) continue;   /* grupo = conversa entre pessoas, nao pergunta ao Jota */ if (!porPessoa.has(m.celular)) porPessoa.set(m.celular, { c: { nome: m.nome, papel: m.papel, filial: m.filial, rca: m.rca, grupo: m.grupo, celular: m.celular, filiais: m.papel === 'diretoria' ? [] : undefined }, q: [] }); porPessoa.get(m.celular).q.push(String(m.texto).replace(/^\[áudio\]\s*/i, '').trim()); }
// 21/11/2026: hora da RESPOSTA (fixada no inicio, a R03 reprovava leitura fresca do Clube)
const horaAgora = () => new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
let tot = 0, ok = 0; const porRegra = {}, porPapel = {}, falhas = [];
// 6 pessoas em paralelo (cada uma na ordem da propria conversa); parcial gravado a cada lote
const PESSOAS = [...porPessoa.values()]; let prox = 0;
async function trabalhador() { while (prox < PESSOAS.length) await umaPessoa(PESSOAS[prox++]); }
async function umaPessoa(p) {
  const Q = [...new Set(p.q)];
  for (let i = 0; i < Q.length; i += 5) {
    const lote = Q.slice(i, i + 5);
    const rs = await fetch(`${SITE}/api/jota-seco?chave=${encodeURIComponent(CHAVE)}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ contato: p.c, perguntas: lote, conversa: true }), signal: AbortSignal.timeout(290000) }).then((x) => x.json()).catch((e) => lote.map((q) => ({ pergunta: q, resposta: 'ERRO: ' + e.message })));
    for (const x of Array.isArray(rs) ? rs : []) {
      tot++; const pp = (porPapel[p.c.papel] = porPapel[p.c.papel] || { ok: 0, total: 0 }); pp.total++;
      const resp = String(x.resposta || ''), v = avaliar(x.pergunta, resp, { papel: p.c.papel, hora: horaAgora() }) || [];
      const bloq = v.filter((f) => f.severidade === 'bloqueia'), vazio = !resp.trim() || /^ERRO/.test(resp);
      if (!bloq.length && !vazio) { ok++; pp.ok++; continue; }
      for (const f of (vazio ? [{ id: 'VAZIO' }] : bloq)) porRegra[f.id] = (porRegra[f.id] || 0) + 1;
      falhas.push({ papel: p.c.papel, quem: `${p.c.nome} ${p.c.filial || ''}`, pergunta: x.pergunta, regras: vazio ? ['VAZIO'] : bloq.map((f) => `${f.id} ${f.detalhe || ''}`), resposta: resp.slice(0, 500) });
    }
    process.stdout.write(`\r${ok}/${tot}`);
    fs.mkdirSync('saida_auditoria', { recursive: true }); fs.writeFileSync('saida_auditoria/BATERIA_PARCIAL.json', JSON.stringify({ tot, ok, porPapel, porRegra, falhas }));
  }
}
await Promise.all(Array.from({ length: 2 }, trabalhador));   // 17/11: 6 em paralelo sobrecarregou o D1 (usuarios reais no mesmo minuto)
console.log(`\nAPROVADAS ${ok} de ${tot} (${(ok / Math.max(1, tot) * 100).toFixed(1)}%) · reprovadas ${tot - ok} (${((tot - ok) / Math.max(1, tot) * 100).toFixed(1)}%)`);
console.log('por papel', JSON.stringify(porPapel)); console.log('por regra', JSON.stringify(porRegra));
fs.mkdirSync('saida_auditoria', { recursive: true });
fs.writeFileSync(`saida_auditoria/BATERIA_REAL_${desde}_${ate}.json`, JSON.stringify({ tot, ok, porPapel, porRegra, falhas }, null, 1));
await fetch(`${SITE}/api/jota-auditoria?chave=${encodeURIComponent(CHAVE)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origem: `bateria ${desde}..${ate}`, resumo: porPapel, falhas: falhas.slice(0, 200) }) }).catch(() => null);
