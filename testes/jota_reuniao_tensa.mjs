// =========================================================================
// REUNIÃO TENSA DE 5 H com o JOTA (Vitório, 25/10/2026): CEO, diretores, 14 gerentes, supervisores, 20 vendedores e um representante
// de cada indústria perguntando sobre passado, presente, futuro e oportunidades. Roda contra a base REAL (só leitura, nada é enviado).
// Resultado por tema e por papel: acerto (trouxe o que pede) · honesto (disse que não tem o dado) · errada · sem resposta (IA) · erro.
// uso: node testes/jota_reuniao_tensa.mjs [--por=6] [--seed=11]  -> MAIS_MIX/JOTA/reuniao/REUNIAO_TENSA_<dia>.md e .json
// =========================================================================
import fs from 'fs'; import path from 'path';
import { carregaJota } from './_jota_loader.mjs';
const { casos, SALA, raiz } = await import('./_casos_reuniao.mjs');
const J = await carregaJota(raiz); const { _teste } = J;
// ---------- reunião ----------
const HON = /não tenho|sem dado|ainda não|não está na base|não consigo|não projeto|não faço projeção/i;
const B = _teste.criaBase(ORIGIN, {});
const t0 = Date.now(); let k = 0; const out = [];
for (const c of casos) {
  let r = null, erro = null;
  try { r = await _teste.respostaPronta(B, c.perfil, c.pergunta, []); } catch (e) { erro = String(e.message || e); }
  const quebrado = r && /undefined|NaN|\[object/.test(r);
  const st = erro ? 'erro' : r == null ? 'sem_resposta' : quebrado ? 'texto_quebrado' : c.re.test(r) ? (c.honesto ? 'honesto' : 'acerto') : HON.test(r) ? 'honesto' : 'errada';
  out.push({ tema: c.tema, papel: c.papel, quem: c.quem, pergunta: c.pergunta, status: st, resposta: String(erro || r || '').slice(0, 1500) });
  if (++k % 200 === 0) console.log(`  ${k}/${casos.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
J.limpa();
// ---------- ata ----------
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const dir = path.join(raiz, 'MAIS_MIX/JOTA/reuniao');
fs.writeFileSync(path.join(dir, `reuniao_tensa_${dia}.json`), JSON.stringify(out, null, 1));
const pc = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '-');
const agrupa = (f) => { const m = new Map(); for (const x of out) { const kk = f(x); const y = m.get(kk) || { n: 0, acerto: 0, honesto: 0, errada: 0, sem_resposta: 0, erro: 0, texto_quebrado: 0, ex: [] }; y.n++; y[x.status]++; if (!['acerto', 'honesto'].includes(x.status) && y.ex.length < 2) y.ex.push(x); m.set(kk, y); } return m; };
const tot = agrupa(() => 'tudo').get('tudo');
const linha = (nome, y) => `| ${nome} | ${y.n} | ${pc(y.acerto, y.n)} | ${pc(y.honesto, y.n)} | ${pc(y.errada, y.n)} | ${pc(y.sem_resposta, y.n)} | ${y.erro + y.texto_quebrado} |`;
const md = [`# Reunião tensa de 5 h com o JOTA — ${dia}`, '',
  `**${tot.n} perguntas** de ${Object.values(SALA).reduce((a, v) => a + v.length, 0)} participantes · acerto **${pc(tot.acerto, tot.n)}** · disse que não tem o dado ${pc(tot.honesto, tot.n)} · **resposta errada ${pc(tot.errada, tot.n)}** · sem resposta pronta ${pc(tot.sem_resposta, tot.n)} · erro ${tot.erro + tot.texto_quebrado}`, '',
  '## Por papel', '| Quem | Perguntas | Acerto | Sem o dado (honesto) | Errada | Sem resposta | Erro |', '|---|---|---|---|---|---|---|',
  ...[...agrupa((x) => x.papel)].map(([kk, y]) => linha(kk, y)), '',
  '## Por tema', '| Tema | Perguntas | Acerto | Sem o dado (honesto) | Errada | Sem resposta | Erro |', '|---|---|---|---|---|---|---|',
  ...[...agrupa((x) => x.tema)].map(([kk, y]) => linha(kk, y)), '',
  '## Falhas (exemplos por tema)', ...[...agrupa((x) => x.tema)].flatMap(([kk, y]) => y.ex.map((x) => `- **${kk}** · ${x.quem}: "${x.pergunta}" → *${x.status}*: ${x.resposta.split('\n')[0].slice(0, 160)}`))].join('\n');
fs.writeFileSync(path.join(dir, `REUNIAO_TENSA_${dia}.md`), md + '\n');
console.log(`\nACERTO ${pc(tot.acerto, tot.n)} | honesto ${pc(tot.honesto, tot.n)} | ERRADA ${pc(tot.errada, tot.n)} | sem resposta ${pc(tot.sem_resposta, tot.n)} | erro ${tot.erro + tot.texto_quebrado} | ${Math.round((Date.now() - t0) / 1000)} s`);
