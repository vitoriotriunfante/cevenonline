// BATERIA DE REGRESSÃO DO JOTA (16/11/2026) — perguntas REAIS do dia + casos-chave do diretor, rodadas no JOTA ATUAL (código desta pasta)
// contra o D1 de produção SÓ LEITURA, avaliadas pela régua (testes/jota_regua.mjs, docs/REGUA_QUALIDADE_JOTA.md).
//
// Uso:
//   node testes/jota_regressao.mjs --rapido                  casos-chave + amostra de 30 perguntas reais do dia (padrão)
//   node testes/jota_regressao.mjs --completo                casos-chave + todas as perguntas reais do dia (horas)
//   opções: --data=AAAA-MM-DD (dia das perguntas; padrão hoje em Brasília) · --amostra=30 · --paralelo=3 (máx. 3)
//           --so-chave (só casos-chave) · --so-producao (só aplica a régua nas respostas que saíram no dia, sem rodar o JOTA)
// Saída: docs/REGRESSAO_JOTA_<data>.md (taxa por regra, casos-chave, piores casos). Código de saída 1 se algum caso-chave tiver
// violação BLOQUEANTE (ou erro de execução). NÃO está plugado no testes/rodar_testes.mjs (decisão pendente do Vitório).
//
// Como roda o JOTA: o mesmo bot.js do webhook (onRequestPost) em modo "seco" (não grava, não envia: sem EVO_URL/EVO_KEY no env),
// carregado por testes/_jota_loader.mjs. O banco é o D1 de produção via `wrangler d1 execute --remote` e SÓ aceita SELECT/WITH.
// As consultas a bot_msgs veem o banco "como estava" no momento da pergunta original (id <= id da pergunta e 'now' = hora da
// pergunta), para o JOTA ter o mesmo histórico de conversa (menu anterior, nota, continuidade). Os DADOS (vendas, rota, Clube) são
// os de AGORA: a bateria mede o código atual com o dado atual. Sem chave de IA no env: caminhos de IA ficam desligados.
// Cache de consultas idênticas (20 min) em <tmp>/jota_regressao_cache, compartilhado entre os processos paralelos.
import fs from 'fs'; import os from 'os'; import path from 'path'; import crypto from 'crypto';
import { spawn, spawnSync, execSync } from 'child_process'; import { fileURLToPath } from 'url';
import { avaliar, REGRAS, BLOQUEIA, bloqueantes, pontuacao, rodaTestesUnitarios } from './jota_regua.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const ARG = process.argv.slice(2), opt = (n, d) => { const a = ARG.find((x) => x.startsWith('--' + n + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const tem = (n) => ARG.includes('--' + n);
const BRT = (d = new Date()) => new Date(d.getTime() - 3 * 3600e3);
const hojeBRT = () => BRT().toISOString().slice(0, 10);
const horaBRT = (d = new Date()) => BRT(d).toISOString().slice(11, 16);
const CACHE = path.join(os.tmpdir(), 'jota_regressao_cache'); fs.mkdirSync(CACHE, { recursive: true });
const TTL = 20 * 60e3;

// ---------- acesso ao D1 (só leitura) ----------
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
const WR = fs.existsSync(npxDir) ? fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x)) : null;
const lit = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const soLeitura = (sql) => { const semTexto = sql.replace(/'(?:[^']|'')*'/g, "''"); return /^\s*(SELECT|WITH)\b/i.test(sql) && !/;\s*\S/.test(semTexto) && !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|PRAGMA)\b/i.test(semTexto); };
let nConsultas = 0, nErros = 0, nCache = 0;
function d1(sql) {
  if (!soLeitura(sql)) return [];
  const k = path.join(CACHE, crypto.createHash('sha1').update(sql).digest('hex') + '.json');
  try { const st = fs.statSync(k); if (Date.now() - st.mtimeMs < TTL) { nCache++; return JSON.parse(fs.readFileSync(k, 'utf8')); } } catch {}
  const args = WR ? [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', sql] : null;
  for (let t = 0; t < 2; t++) {
    nConsultas++;
    const r = args ? spawnSync(process.execPath, args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 120e3, env: { ...process.env, NO_COLOR: '1' } })
      : spawnSync('npx', ['wrangler', 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', sql], { cwd: RAIZ, shell: true, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 120e3 });
    try { const res = JSON.parse(r.stdout)[0].results || []; try { fs.writeFileSync(k, JSON.stringify(res)); } catch {} return res; } catch { nErros++; }
  }
  return [];
}
// DB "como estava" na pergunta: bot_msgs limitado ao id da pergunta e 'now' = hora da pergunta
function criaDB(snap) {
  const ajusta = (q) => {
    if (!snap || !/\bbot_msgs\b/.test(q)) return q;
    let s = q.replace(/\bFROM\s+bot_msgs\b/g, `FROM (SELECT * FROM bot_msgs WHERE id <= ${Number(snap.id) || 0}) AS bot_msgs`);
    if (snap.quando) s = s.replace(/(datetime|date)\(\s*'now'/g, `$1('${snap.quando}'`);
    return s;
  };
  return { prepare(sql) { let a = []; const roda = () => { let i = 0; const q = sql.replace(/\?(\d+)?/g, (_, n) => lit(a[n ? n - 1 : i++])); return d1(ajusta(q)); }; const o = { bind(...x) { a = x; return o; }, async all() { return { results: roda() }; }, async first() { return roda()[0] || null; }, async run() { return { meta: {} }; }, async raw() { return roda().map((r) => Object.values(r)); } }; return o; }, async batch(st) { return Promise.all(st.map((s) => s.all())); } };
}

// ---------- CASOS-CHAVE (diretor) ----------
const MESES = 'Janeiro|Fevereiro|Mar[cç]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro';
const depoisDas17 = (ctx) => Number(String(ctx.hora || '00').slice(0, 2)) >= 17;
function casosChave(data) {
  const dm = data.split('-').reverse().join('/');
  const VIT = '554187525605';
  return [
    { chave: 'K01', celular: VIT, texto: 'Venda Tamara TCV hoje', exp: [{ deve: /Tamara/i, topo: 3, msg: 'deveria abrir pela Tamara' }, { deve: /hoje|vendeu|digitado/i, topo: 2, msg: 'deveria abrir pelo DIA (venda de hoje), não pela ficha do mês' }] },
    { chave: 'K02', celular: VIT, texto: 'Quanto a Tamara de TCV vendeu hoje', exp: [{ deve: /Tamara/i, topo: 3, msg: 'deveria abrir pela Tamara' }, { deve: /hoje|vendeu|digitado/i, topo: 2, msg: 'deveria abrir pelo DIA (venda de hoje), não pela ficha do mês' }] },
    { chave: 'K03', celular: VIT, texto: 'Curva Negativa vendedora Tamara TCV', exp: [{ deve: /curva negativa|ainda n[aã]o compraram|sem compra/i, msg: 'deveria ser a curva negativa (clientes sem compra no mês)' }, { minClientes: 3, msg: 'deveria listar os clientes sem compra no mês' }, { naoDeve: /sem a produtividade/i, msg: '"sem a produtividade do mês na base"' }] },
    { chave: 'K04', celular: VIT, texto: 'Curva negativa Vendedora 10 de TSJ', exp: [{ deve: /curva negativa|ainda n[aã]o compraram|sem compra/i, topo: 3, msg: 'devolveu outra coisa (ficha) em vez da lista de clientes sem compra no mês' }, { minClientes: 3, msg: 'deveria listar os clientes sem compra no mês' }] },
    { chave: 'K05', celular: '554188481593', texto: 'Quais clientes posso positivar na recorrência ainda?', exp: [{ minClientes: 1, msg: 'deveria listar os clientes da lista de recorrência ainda não positivados' }, { naoDeve: /nenhum cliente com a tag/i, msg: 'resposta negativa pela tag do roteiro, sem consultar a lista de recorrência' }] },
    { chave: 'K06', celular: '555195546100', texto: 'Atualiza os números de hoje do meu time', exp: [{ minVendedores: 2, msg: 'deveria abrir por vendedor' }, { deve: /hoje|digitado/i, topo: 2, msg: 'deveria ser o dia da equipe' }] },
    { chave: 'K07', celular: '554188068783', texto: 'status do pedido 1038000485', exp: [{ deve: /1038000485/, msg: 'deveria responder o pedido 1038000485' }, { naoDeve: /Clientes com Pedidos Pendentes/i, msg: 'lista genérica de pendentes em vez do pedido' }] },
    { chave: 'K08', celular: '554188995783', texto: 'Karina já vendeu hoje', exp: [{ deve: /Karina/i, topo: 2, msg: 'deveria abrir pela Karina' }, { naoDeve: /Edinei|Felipe Cardoso|Paola Franco/i, msg: 'respondeu a equipe inteira em vez da Karina' }] },
    { chave: 'K09', celular: '555197226396', texto: 'Fechamento', exp: [{ so: depoisDas17, naoDeve: new RegExp('Fechamento de (' + MESES + ')', 'i'), msg: 'depois das 17h "fechamento" sem mês = fechamento do DIA' }, { so: depoisDas17, minVendedores: 1, msg: 'fechamento do dia sem quem ficou sem pedido/visita por vendedor' }] },
    { chave: 'K10', celular: '555197226396', texto: `Fechamento do dia ${dm}`, exp: [{ naoDeve: /(?<![\d.,])0 de 0\b|\(sem dado\)/i, msg: 'indicador "0 de 0 (sem dado)"' }, { minVendedores: 1, msg: 'sem quem ficou sem pedido/visita por vendedor' }, { naoDeve: /foco nos zerados/i, msg: 'sugestão "foco nos zerados" com 0 zerados' }] }
  ];
}

// ---------- WORKER: roda uma fatia de casos no JOTA ----------
async function worker(entrada, saida) {
  const casos = JSON.parse(fs.readFileSync(entrada, 'utf8'));
  const { carregaJota } = await import('./_jota_loader.mjs');
  const J = await carregaJota(RAIZ);
  for (const c of casos) {
    const t0 = Date.now(), q0 = nConsultas, e0 = nErros, h0 = nCache;
    let resposta = null, erro = null;
    try {
      const u = `https://ceven-cftv-matrix.pages.dev/api/whatsapp/bot?k=regressao&seco=1&como=${encodeURIComponent(c.celular)}`;
      const body = { data: { key: { remoteJid: c.celular + '@s.whatsapp.net', id: 'regressao-' + c.uid }, message: { conversation: c.texto } } };
      const r = await J.onRequestPost({ request: new Request(u, { method: 'POST', body: JSON.stringify(body) }), env: { DB: criaDB(c.snap), BOT_WEBHOOK_KEY: 'regressao' }, waitUntil: () => {} });
      const txt = await r.text();
      if (r.status >= 500 || /^ERRO: /.test(txt)) erro = txt.slice(0, 800); else resposta = (txt === 'ok' ? '' : txt);
    } catch (e) { erro = String(e && e.stack || e).slice(0, 800); }
    const out = { uid: c.uid, resposta, erro, hora: horaBRT(), ms: Date.now() - t0, consultas: nConsultas - q0, cache: nCache - h0, errosD1: nErros - e0 };
    fs.appendFileSync(saida, JSON.stringify(out) + '\n');
    console.log(`[${c.uid}] ${(out.ms / 1000).toFixed(0)}s · ${out.consultas} consultas (${out.cache} cache)${erro ? ' · ERRO' : ''} · ${c.texto.slice(0, 50).replace(/\n/g, ' ')}`);
  }
  J.limpa();
}

// ---------- PRINCIPAL ----------
async function principal() {
  const modo = tem('completo') ? 'completo' : 'rapido';
  const data = opt('data', hojeBRT()), amostra = Number(opt('amostra', 30)), P = Math.max(1, Math.min(3, Number(opt('paralelo', 3))));
  const ini = `${data} 03:00:00`, fimD = new Date(Date.parse(data + 'T03:00:00Z') + 86400e3).toISOString().slice(0, 19).replace('T', ' ');
  const t0 = Date.now();
  if (rodaTestesUnitarios(() => {})) { console.error('A régua falhou nos testes unitários (node testes/jota_regua.mjs). Corrija antes.'); process.exit(2); }
  console.log(`Regressão do JOTA · modo ${modo} · perguntas de ${data} · paralelo ${P}`);

  // 1) perguntas reais do dia + resposta que saiu + resposta anterior (contexto)
  const msgs = d1(`SELECT m.id, m.quando, m.celular, m.nome, m.texto,
      (SELECT o.texto FROM bot_msgs o WHERE o.celular = m.celular AND o.direcao = 'out' AND o.id > m.id AND o.id < COALESCE((SELECT MIN(i2.id) FROM bot_msgs i2 WHERE i2.celular = m.celular AND i2.direcao = 'in' AND i2.id > m.id), 999999999) ORDER BY o.id LIMIT 1) resp,
      (SELECT MIN(i3.quando) FROM bot_msgs i3 WHERE i3.celular = m.celular AND i3.direcao = 'in' AND i3.id > m.id) prox_in,
      (SELECT o.texto FROM bot_msgs o WHERE o.celular = m.celular AND o.direcao = 'out' AND o.id < m.id ORDER BY o.id DESC LIMIT 1) ant
    FROM bot_msgs m WHERE m.direcao = 'in' AND m.quando >= '${ini}' AND m.quando < '${fimD}' AND m.celular NOT LIKE '%@g.us' ORDER BY m.id`);
  const chaves = casosChave(data);
  const cels = [...new Set([...msgs.map((m) => m.celular), ...chaves.map((k) => k.celular)])];
  const contatos = {};
  for (let i = 0; i < cels.length; i += 80) for (const c of d1(`SELECT * FROM bot_contatos WHERE celular IN (${cels.slice(i, i + 80).map(lit).join(',')})`)) contatos[c.celular] = c;
  const papel = (cel) => contatos[cel] ? contatos[cel].papel : null;
  const cadastrado = (cel) => !!(contatos[cel] && Number(contatos[cel].ativo) === 1);
  const texto = (t) => String(t || '').replace(/^\[áudio\]\s*/i, '').trim();
  const reais = msgs.filter((m) => texto(m.texto) && !/^\[(figurinha|imagem)/i.test(m.texto) && !/^\(não transcrito/.test(m.texto));
  console.log(`${msgs.length} mensagens recebidas no dia (${reais.length} com texto) · ${Object.keys(contatos).length} contatos`);

  // 2) PRODUÇÃO: régua nas respostas que saíram no dia (barato: não roda o JOTA)
  const prod = reais.map((m) => {
    const agrupada = !m.resp && m.prox_in && (Date.parse(m.prox_in.replace(' ', 'T') + 'Z') - Date.parse(m.quando.replace(' ', 'T') + 'Z')) < 180e3;
    const v = agrupada ? [] : avaliar(m.texto, m.resp || '', { papel: papel(m.celular), hora: horaBRT(new Date(m.quando.replace(' ', 'T') + 'Z')), data, ultimaResposta: m.ant, cadastrado: cadastrado(m.celular) });
    return { id: m.id, quem: quem(m.celular, m.nome), texto: m.texto, resposta: m.resp, v, agrupada };
  }).filter((x) => !x.agrupada);

  if (opt('despeja')) fs.writeFileSync(opt('despeja'), JSON.stringify(prod, null, 1));
  // 3) monta a bateria
  const casos = [];
  for (const k of chaves) {
    const orig = [...msgs].reverse().find((m) => m.celular === k.celular && texto(m.texto).toLowerCase().includes(k.texto.toLowerCase()));
    casos.push({ uid: k.chave, chave: k.chave, celular: k.celular, texto: k.texto, exp: k.exp, quem: quem(k.celular), snap: orig ? { id: orig.id, quando: orig.quando } : { id: 999999999, quando: null }, ant: orig ? orig.ant : null, original: orig ? orig.resp : null });
  }
  if (!tem('so-chave') && !tem('so-producao')) {
    const vistos = new Set(casos.map((c) => c.celular + '|' + c.texto.toLowerCase()));
    let pool = reais.filter((m) => !vistos.has(m.celular + '|' + texto(m.texto).toLowerCase()));
    const dedup = new Map(); for (const m of pool) { const k = m.celular + '|' + texto(m.texto).toLowerCase(); if (!dedup.has(k)) dedup.set(k, m); } pool = [...dedup.values()];
    if (modo === 'rapido') {
      const h = (m) => crypto.createHash('md5').update(data + m.id).digest('hex');
      const porPessoa = {}; const sel = [];
      for (const m of pool.sort((a, b) => h(a) < h(b) ? -1 : 1)) { if (sel.length >= amostra) break; if ((porPessoa[m.celular] = (porPessoa[m.celular] || 0) + 1) > 2) continue; sel.push(m); }
      pool = sel;
    }
    for (const m of pool) casos.push({ uid: 'Q' + m.id, celular: m.celular, texto: texto(m.texto), quem: quem(m.celular, m.nome), snap: { id: m.id, quando: m.quando }, ant: m.ant, original: m.resp });
  }

  // 4) roda no JOTA (P processos, cada um com uma fatia)
  const resultados = {};
  if (!tem('so-producao')) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jota_regressao_'));
    const fatias = Array.from({ length: P }, () => []); casos.forEach((c, i) => fatias[i % P].push(c));
    console.log(`Rodando ${casos.length} casos (${chaves.length} casos-chave) em ${P} processo(s)... (~30-150 s por pergunta)`);
    await Promise.all(fatias.map((f, i) => new Promise((ok) => {
      if (!f.length) return ok();
      const ent = path.join(tmp, `in_${i}.json`), sai = path.join(tmp, `out_${i}.jsonl`); fs.writeFileSync(ent, JSON.stringify(f)); fs.writeFileSync(sai, '');
      const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker', ent, sai], { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] });
      p.stdout.on('data', (d) => process.stdout.write(`  w${i} ` + String(d).replace(/\n(?=.)/g, `\n  w${i} `)));
      p.stderr.on('data', () => {});
      p.on('close', () => { for (const l of fs.readFileSync(sai, 'utf8').split('\n').filter(Boolean)) { const o = JSON.parse(l); resultados[o.uid] = o; } ok(); });
    })));
  }
  for (const c of casos) {
    c.vOrig = c.original != null ? avaliar(c.texto, c.original, { papel: papel(c.celular), hora: c.snap.quando ? horaBRT(new Date(c.snap.quando.replace(' ', 'T') + 'Z')) : null, data, ultimaResposta: c.ant, cadastrado: cadastrado(c.celular), expectativas: c.exp }) : null;
    const r = resultados[c.uid];
    if (!r) { c.naoRodou = true; continue; }
    c.resposta = r.resposta; c.erro = r.erro; c.ms = r.ms; c.hora = r.hora; c.consultas = r.consultas; c.errosD1 = r.errosD1;
    c.v = r.erro ? [] : avaliar(c.texto, r.resposta, { papel: papel(c.celular), hora: r.hora, data: hojeBRT(), ultimaResposta: c.ant, cadastrado: cadastrado(c.celular), expectativas: c.exp });
  }

  // 5) relatório
  const md = relatorio({ modo, data, casos, prod, dur: Date.now() - t0 });
  const arq = path.join(RAIZ, 'docs', `REGRESSAO_JOTA_${data}.md`);
  fs.writeFileSync(arq, md);
  const chaveRuim = casos.filter((c) => c.chave && (c.erro || c.naoRodou || bloqueantes(c.v || []).length));
  console.log(`\nRelatório: ${arq}`);
  console.log(`Casos-chave reprovados: ${chaveRuim.length}/${casos.filter((c) => c.chave).length}${chaveRuim.length ? ' -> ' + chaveRuim.map((c) => c.chave).join(', ') : ''}`);
  if (tem('so-producao')) process.exit(0);
  process.exit(chaveRuim.length ? 1 : 0);

  function quem(cel, nome) { const c = contatos[cel]; return c ? `${titulo(c.nome)} (${c.papel}${c.filial ? ' ' + c.filial : ''}${c.rca ? ' ' + c.rca : ''})` : `${nome || 'sem cadastro'} (${String(cel).slice(-4)})`; }
}
const titulo = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());
const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const corta = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; };

function taxaPorRegra(lista) {
  const n = lista.length, cont = {};
  for (const x of lista) for (const id of new Set((x.v || []).map((y) => y.id))) cont[id] = (cont[id] || 0) + 1;
  return { n, cont, comBloq: lista.filter((x) => bloqueantes(x.v || []).length).length, comAlgum: lista.filter((x) => (x.v || []).length).length };
}
function relatorio({ modo, data, casos, prod, dur }) {
  const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '—';
  let commit = ''; try { commit = execSync('git rev-parse --short HEAD', { cwd: RAIZ, encoding: 'utf8' }).trim() + (execSync('git status --porcelain functions', { cwd: RAIZ, encoding: 'utf8' }).trim() ? ' + alterações locais em functions/' : ''); } catch {}
  const rodados = casos.filter((c) => !c.naoRodou && !c.erro), chave = casos.filter((c) => c.chave), amostra = rodados.filter((c) => !c.chave);
  const tR = taxaPorRegra(rodados), tA = taxaPorRegra(amostra), tP = taxaPorRegra(prod);
  const o = [];
  o.push(`# Regressão do JOTA — ${data} (${modo})`, '');
  o.push(`Gerado por \`node testes/jota_regressao.mjs --${modo}\` em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · código ${commit || '?'} · duração ${(dur / 60000).toFixed(1)} min.`);
  o.push('Régua: `testes/jota_regua.mjs` (regras em `docs/REGUA_QUALIDADE_JOTA.md`). O JOTA atual roda em modo seco contra o D1 de produção só leitura; histórico da conversa como estava na pergunta original, dados de agora; sem IA.', '');
  o.push('## Resumo', '');
  o.push('| Conjunto | Respostas | Com violação bloqueante | Com qualquer violação |', '|---|---:|---:|---:|');
  o.push(`| Casos-chave (JOTA atual) | ${chave.filter((c) => !c.naoRodou).length} | ${chave.filter((c) => c.erro || bloqueantes(c.v || []).length).length} | ${chave.filter((c) => c.erro || (c.v || []).length).length} |`);
  o.push(`| Amostra de perguntas reais (JOTA atual) | ${tA.n} | ${tA.comBloq} (${pct(tA.comBloq, tA.n)}) | ${tA.comAlgum} (${pct(tA.comAlgum, tA.n)}) |`);
  o.push(`| Respostas que saíram em ${data} (produção, todas) | ${tP.n} | ${tP.comBloq} (${pct(tP.comBloq, tP.n)}) | ${tP.comAlgum} (${pct(tP.comAlgum, tP.n)}) |`);
  const erros = casos.filter((c) => c.erro), nao = casos.filter((c) => c.naoRodou);
  if (erros.length || nao.length) o.push('', `Erros de execução: ${erros.length} · não rodaram: ${nao.length}.`);
  o.push('', '## Casos-chave do diretor', '', '| # | Quem | Pergunta | Resultado | Violações |', '|---|---|---|---|---|');
  for (const c of chave) {
    const b = bloqueantes(c.v || []);
    const res = c.naoRodou ? 'NÃO RODOU' : c.erro ? 'ERRO' : b.length ? '❌ REPROVADO' : (c.v || []).length ? '⚠️ alerta' : '✅ aprovado';
    o.push(`| ${c.chave} | ${esc(c.quem)} | ${esc(c.texto)} | ${res} | ${esc(c.erro ? corta(c.erro, 120) : (c.v || []).map((x) => `${x.id} ${x.nome}: ${x.detalhe}`).join(' · '))} |`);
  }
  o.push('', '## Taxa de reprovação por regra', '', '| Regra | Severidade | JOTA atual (todos os casos rodados, n=' + tR.n + ') | Amostra real (n=' + tA.n + ') | Produção do dia (n=' + tP.n + ') |', '|---|---|---:|---:|---:|');
  for (const [id, r] of Object.entries(REGRAS)) {
    const a = tR.cont[id] || 0, b = tA.cont[id] || 0, p = tP.cont[id] || 0;
    if (!a && !b && !p) continue;
    o.push(`| ${id} ${r.nome} | ${r.severidade} | ${a} (${pct(a, tR.n)}) | ${b} (${pct(b, tA.n)}) | ${p} (${pct(p, tP.n)}) |`);
  }
  const piores = [...rodados].sort((a, b) => pontuacao(b.v || []) - pontuacao(a.v || [])).filter((c) => (c.v || []).length).slice(0, 10);
  o.push('', '## Piores casos (JOTA atual)', '');
  piores.forEach((c, i) => {
    o.push(`### ${i + 1}. ${c.chave ? c.chave + ' · ' : ''}${esc(c.quem)} — "${esc(corta(c.texto, 100))}"`, '');
    o.push(...(c.v || []).map((x) => `- **${x.id} ${x.nome}** (${x.severidade}): ${x.detalhe}`), '');
    o.push('```', corta(c.resposta, 1400), '```', '');
  });
  o.push('## Todos os casos rodados', '', '| Caso | Quem | Pergunta | s | Violações (atual) | Violações (resposta que saiu) |', '|---|---|---|---:|---|---|');
  for (const c of casos) {
    const vo = c.vOrig ? c.vOrig.map((x) => x.id).join(' ') : '—';
    o.push(`| ${c.uid} | ${esc(c.quem)} | ${esc(corta(c.texto, 70))} | ${c.ms ? (c.ms / 1000).toFixed(0) : '—'} | ${c.naoRodou ? 'não rodou' : c.erro ? 'ERRO' : (c.v || []).map((x) => x.id).join(' ') || '✅'} | ${vo || '✅'} |`);
  }
  const pioresP = [...prod].sort((a, b) => pontuacao(b.v) - pontuacao(a.v)).slice(0, 5);
  o.push('', '## Piores respostas que saíram no dia (produção)', '');
  for (const c of pioresP) o.push(`- **${esc(c.quem)}** — "${esc(corta(c.texto, 80))}": ${c.v.map((x) => x.id + ' ' + x.nome).join(', ')}`);
  o.push('');
  return o.join('\n');
}

if (ARG[0] === '--worker') await worker(ARG[1], ARG[2]);
else await principal();
