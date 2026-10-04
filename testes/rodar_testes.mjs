// TESTES DE SEGURANCA ANTES DE PUBLICAR (criado em 03/10/2026).
// Objetivo: mexer no CFTV/TV nao pode quebrar o WhatsApp (e vice-versa). Roda sozinho antes de cada
// publicacao (publicar_tv.js) e pode ser rodado a qualquer hora:   node testes/rodar_testes.mjs
// Sai com codigo 1 se algum teste falhar. Nao acessa o CEVEN nem o banco de producao: tudo local.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(RAIZ, 'package.json'));
const ler = (rel) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const imp = (rel) => import(pathToFileURL(join(RAIZ, rel)).href);

let total = 0, falhas = 0;
const ok = (cond, msg) => { total++; if (!cond) { falhas++; console.log('  FALHOU - ' + msg); } else console.log('  ok     - ' + msg); };
const secao = (t) => console.log('\n== ' + t);

function d1(db) {
  return {
    prepare(sql) {
      let a = [];
      const st = {
        bind(...x) { a = x; return st; },
        async run() { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; },
        async first() { return db.prepare(sql).get(...a) || null; },
        async all() { return { results: db.prepare(sql).all(...a) }; }
      };
      return st;
    }
  };
}

// ---------------------------------------------------------------- 1. sintaxe de todo o codigo publicado
secao('1. Sintaxe de todos os arquivos (functions, pipeline, worker-cron)');
{
  const arquivos = [];
  const anda = (rel) => {
    const abs = join(RAIZ, rel);
    if (!existsSync(abs)) return;
    for (const nome of readdirSync(abs)) {
      const r = rel + '/' + nome;
      const st = statSync(join(RAIZ, r));
      if (st.isDirectory()) { if (nome !== 'node_modules') anda(r); } else if (/\.js$/.test(nome)) arquivos.push(r);
    }
  };
  ['functions', 'pipeline', 'worker-cron/src'].forEach(anda);
  let ruins = [];
  for (const rel of arquivos) {
    const src = ler(rel);
    const esm = /^\s*(export|import)\s/m.test(src);
    const r = esm
      ? spawnSync(process.execPath, ['--input-type=module', '--check'], { input: src, encoding: 'utf8' })
      : spawnSync(process.execPath, ['--check', join(RAIZ, rel)], { encoding: 'utf8' });
    if (r.status !== 0) ruins.push(rel);
  }
  ok(ruins.length === 0, `${arquivos.length} arquivos com sintaxe valida` + (ruins.length ? ' (com erro: ' + ruins.join(', ') + ')' : ''));
}

// ---------------------------------------------------------------- 2. teto de 6 chamadas simultaneas ao CEVEN
secao('2. Teto de 6 chamadas simultaneas ao CEVEN');
{
  const src = ler('functions/api/cron-varredura-central.js');
  ok(/const CONC = 6;/.test(src), 'varredura central usa pool de 6');
  const ini = src.indexOf('async function poolLimitado');
  const fim = src.indexOf('\n}\n', ini) + 3;
  const pool = new Function(src.slice(ini, fim) + '\nreturn poolLimitado;')();
  let ativos = 0, maximo = 0;
  const tarefas = Array.from({ length: 600 }, (_, i) => async () => { ativos++; maximo = Math.max(maximo, ativos); await new Promise(r => setTimeout(r, 1)); ativos--; return i; });
  const out = await pool(tarefas, 6);
  ok(maximo <= 6, `pool nunca passa de 6 simultaneas (maximo observado: ${maximo})`);
  ok(out.every((v, i) => v === i), 'resultados voltam na ordem certa');
  const lote = (arq, re) => { const m = re.exec(ler(arq)); return m ? +m[1] : null; };
  ok(lote('functions/api/cron-mapa-executivo.js', /const LOTE = (\d+)/) <= 6, 'mapa executivo: lote <= 6');
  const dl = [
    ['analises/coletar_todos_os_pdvs_e_prospects_100pct.py', /max_workers=(\d+)/g],
    ['analises/extrair_produtividade_ret_dashboard_todos.py', /max_workers=(\d+)/g],
    ['analises/extrair_historico_completo_11_filiais.js', /const CONCURRENCY = (\d+)/g],
    ['analises/extrair_tudo_devolucoes_cadastros.js', /const BATCH_SIZE = (\d+)/g],
    ['analises/extrair_segmentos_rcas.js', /const CONCURRENCY = (\d+)/g],
    ['analises/extrair_metas_dashboard_rcas.js', /const CONCURRENCY = (\d+)/g],
    ['analises/gerar_mix_gap_real.js', /const BATCH = (\d+)/g]
  ];
  for (const [arq, re] of dl) {
    const valores = [...ler(arq).matchAll(re)].map(m => +m[1]);
    ok(valores.length > 0 && valores.every(v => v <= 6), `Data Lake: nenhum passo passa de 6 simultaneas em ${arq.split('/').pop()} (${valores.join(', ')})`);
  }
}

// ---------------------------------------------------------------- 3. equipe no WhatsApp (fonte unica)
secao('3. WhatsApp aplica a equipe vinda de /api/tv-mostra');
{
  const eng = ler('pipeline/ceven_unified_engine.js');
  const ini = eng.indexOf('function aplicarMostraDisparos(repsMap) {');
  const fim = eng.indexOf('\n}\n\n// 3. Auditoria de Campo', ini) + 2;
  ok(ini > 0 && fim > ini, 'funcao aplicarMostraDisparos encontrada');
  const tmp = mkdtempSync(join(os.tmpdir(), 'equipe-'));
  const aplicar = new Function('fs', 'path', '__dirname', eng.slice(ini, fim) + '\nreturn aplicarMostraDisparos;')(
    require('node:fs'), require('node:path'), join(tmp, 'pipeline'));
  const arquivoEquipe = join(tmp, 'mostra_equipe.json');
  const lista = { origem: 'teste', filiais: { ABC: [{ rca: '1', supervisor: 'Sup Novo', mostra: true }, { rca: '2', supervisor: 'X', mostra: false }, { rca: '3', supervisor: 'MESMO', mostra: true }] } };
  writeFileSync(arquivoEquipe, JSON.stringify(lista));
  const mapa = { ABC_1: { supNome: 'SUP ANTIGO' }, ABC_2: { supNome: 'X' }, ABC_3: { supNome: 'MESMO' } };
  const r = aplicar(mapa);
  ok(r.excluidos === 1 && !mapa.ABC_2, 'vendedor marcado como fora sai do mapa');
  ok(r.corrigidos === 1 && mapa.ABC_1.supNome === 'SUP NOVO', 'supervisor e ajustado pela equipe');
  ok(mapa.ABC_3 && mapa.ABC_3.supNome === 'MESMO', 'quem nao mudou fica como estava');
  writeFileSync(arquivoEquipe, '{nao e json');
  const r2 = aplicar({ ABC_1: { supNome: 'A' } });
  ok(r2.excluidos === 0 && r2.corrigidos === 0, 'arquivo invalido nao quebra o envio');
  // o nome do arquivo que o motor le tem que ser o mesmo que os workflows baixam
  for (const wf of ['.github/workflows/ceven-cron-whatsapp.yml', '.github/workflows/ceven-cron-marca-propria.yml']) {
    const y = ler(wf);
    ok(y.includes('/api/tv-mostra') && y.includes('-o mostra_equipe.json'), `${wf.split('/').pop()} baixa a equipe em mostra_equipe.json`);
  }
  ok(eng.includes("'mostra_equipe.json'"), 'motor le o mesmo arquivo mostra_equipe.json');
  // Login do administrador do CEVEN: nunca escrito no codigo (repositorio publico) e falha de login nao pode ser silenciosa
  ok(!/const CEVEN_USER = '/.test(eng) && !/const CEVEN_PASS = '/.test(eng), 'motor nao tem o login do administrador escrito no codigo');
  ok(eng.includes('process.env.CEVEN_ADMIN_USER') && eng.includes('process.env.CEVEN_ADMIN_PASS'), 'motor le o login dos segredos CEVEN_ADMIN_USER / CEVEN_ADMIN_PASS');
  ok(/Erro ao autenticar no CEVEN Admin[\s\S]{0,300}process\.exit\(1\)/.test(eng), 'falha de login do administrador derruba o ciclo (nao termina como sucesso sem enviar)');
  ok(/FALHAS_ENVIO\+\+/.test(eng) && /FALHAS_ENVIO > 0 && destino !== 'dry_run'[\s\S]{0,250}process\.exit\(1\)[\s\S]{0,200}marcarCicloDisparado\(\);\n  console\.log\(`\\n🏁/.test(eng), 'envio que falha derruba o ciclo e o ciclo nao e marcado como disparado');
  ok(/const LIMITE_CHAMADAS = 6;/.test(eng) && eng.includes('axios.interceptors.request.use') && eng.includes('axios.interceptors.response.use'), 'motor tem limite global de 6 chamadas simultaneas');
  { const mapa = ler('functions/api/cron-mapa-executivo.js'); const tvx = ler('public/tv_executiva.html');
    ok(mapa.includes('ehRecorrencia') && !mapa.includes('cnpjsOuro') && mapa.includes("includes('RECORRENCIA')"), 'TV executiva usa a tag RECORRENCIA do roteiro (nao mais a lista estatica de ouro)');
    ok(!/Ouro na Mesa|OURO NA MESA|13\.634/.test(tvx), 'tela da TV executiva nao mostra mais Ouro na Mesa nem numero fixo de alvos'); }
  { const mp = ler('scripts/gerar_marca_propria.js'); const wfmp = ler('.github/workflows/ceven-cron-marca-propria.yml');
    ok(mp.includes('FORNECEDOR_MARCA_PROPRIA = 24318') && mp.includes('catalogo_produtos_por_filial.json') && !mp.includes("readFile(path.join(__dirname, '..', 'Produtos"), 'lista de marca propria vem do catalogo (fornecedor 24318), nao do xls do Drive');
    const cat = JSON.parse(ler('config/catalogo_produtos_por_filial.json')); const iF = cat.campos.indexOf('cod_fornecedor'); const iC = cat.campos.indexOf('codprod');
    const skus = new Set(cat.linhas.filter(l => Number(l[iF]) === 24318).map(l => l[iC]));
    ok(skus.size === 36 && !skus.has(12229), `catalogo tem 36 produtos da marca propria (24318) e nao inclui o SKU 12229 (achou ${skus.size})`);
    ok(!wfmp.includes('Marcas Exclusivas.xls" .'), 'workflow de marca propria nao baixa mais o xls do Drive'); }
  { const mp = ler('scripts/gerar_marca_propria.js'); const wf = ler('.github/workflows/ceven-cron-marca-propria.yml');
    ok(mp.includes("const enviaVitorio = destino === 'todos' || destino === 'vitorio'") && (mp.match(/destino === 'todos'/g) || []).length >= 4, 'marca propria: destino=vitorio nunca envia a gerentes nem marca o ciclo (so o destino todos faz isso)');
    ok(wf.includes('github.event.inputs.destino') && wf.includes("default: 'todos'"), 'workflow de marca propria tem a opcao destino (padrao todos para o Worker, vitorio para teste)'); }
  ok(!/const EVO_KEY = '/.test(eng) && !/const EVO_URL = '/.test(eng) && eng.includes('process.env.EVO_URL') && eng.includes('process.env.EVO_KEY'), 'servidor de WhatsApp vem dos segredos EVO_URL / EVO_KEY (nada no codigo)');
  for (const wf of ['.github/workflows/ceven-cron-whatsapp.yml', '.github/workflows/ceven-cron-marca-propria.yml']) {
    const y = ler(wf);
    ok(y.includes('EVO_URL: ${{ secrets.EVO_URL }}') && y.includes('EVO_KEY: ${{ secrets.EVO_KEY }}'), `${wf.split('/').pop()} entrega EVO_URL/EVO_KEY ao motor`);
  }
  for (const wf of ['.github/workflows/ceven-cron-whatsapp.yml', '.github/workflows/ceven-cron-marca-propria.yml']) {
    const y = ler(wf);
    ok(y.includes('.esporadicos.datas_autorizadas') && !y.includes('grep -q "\\"$DATA_HOJE\\"" config/diretrizes'), `${wf.split('/').pop()}: autorizacao esporadica so olha a lista de autorizadas (feriado nao se autoriza sozinho)`);
  }
  for (const wf of ['.github/workflows/ceven-cron-whatsapp.yml', '.github/workflows/ceven-cron-marca-propria.yml']) {
    const y = ler(wf);
    ok(y.includes('CEVEN_ADMIN_USER: ${{ secrets.CEVEN_ADMIN_USER }}') && y.includes('CEVEN_ADMIN_PASS: ${{ secrets.CEVEN_ADMIN_PASS }}'), `${wf.split('/').pop()} entrega o login do administrador ao motor`);
  }
}

// ---------------------------------------------------------------- 4. contrato da lista de equipe
secao('4. Contrato da lista de equipe (o que TVs e WhatsApp esperam)');
{
  const j = JSON.parse(ler('public/mostra_vendedores.json'));
  const siglas = Object.keys(j.filiais || {});
  ok(siglas.length >= 11, `lista traz as filiais (${siglas.length})`);
  let total_ = 0, defeitos = 0;
  for (const s of siglas) for (const v of j.filiais[s]) { total_++; if (!v.rca || typeof v.mostra !== 'boolean' || typeof v.supervisor !== 'string') defeitos++; }
  ok(total_ >= 400, `lista tem vendedores suficientes (${total_})`);
  ok(defeitos === 0, 'todo vendedor tem rca, supervisor e mostra verdadeiro/falso');
}

// ---------------------------------------------------------------- 5. agenda do Worker coerente
secao('5. Agenda do Worker (wrangler.toml x index.js)');
{
  const toml = ler('worker-cron/wrangler.toml');
  const bloco = toml.slice(toml.indexOf('crons = ['), toml.indexOf(']', toml.indexOf('crons = [')));
  const cronsToml = [...bloco.matchAll(/"([0-9*\/, -]+ [0-9*\/, -]+ [0-9*] [0-9*] [0-9*,\/-]+)"/g)].map(m => m[1]).sort();
  const js = ler('worker-cron/src/index.js');
  const cronsJs = [...js.matchAll(/'([0-9*\/, -]+ [0-9*\/, -]+ [0-9*] [0-9*] [0-9*,\/-]+)'\s*:/g)].map(m => m[1]).sort();
  ok(cronsToml.length >= 8, `wrangler.toml tem os gatilhos (${cronsToml.length})`);
  ok(JSON.stringify(cronsToml) === JSON.stringify(cronsJs), 'gatilhos do wrangler.toml e do index.js sao os mesmos (se mudar um, tem que mudar o outro)');
  ok(!cronsToml.some(c => /\* \* 1-5$/.test(c)), 'nenhum gatilho usa dia da semana 1-5 (no Cloudflare 1 = domingo)');
  ok(cronsToml.filter(c => /\* \* 2-6$/.test(c)).length === 6, 'os 6 gatilhos comerciais usam 2-6 (segunda a sexta)');
}

// ---------------------------------------------------------------- 5b. relogios da TV no Worker
secao('5b. Relogios da TV no Worker (varredura, lances, mapa, faturado)');
{
  const w = (await imp('worker-cron/src/index.js')).default;
  const original = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async (url) => { chamadas.push(String(url)); return { status: 200 }; };
  const esperado = {
    '*/5 * * * *': ['/api/cron-varredura-central', '/api/cron-piloto-pedidos'],
    '4-59/5 * * * *': ['/api/cron-lances'],
    '2-59/5 * * * *': ['/api/cron-mapa-executivo'],
    '2-59/15 * * * *': ['/api/cron-faturado-mes']
  };
  for (const [cron, rotas] of Object.entries(esperado)) {
    chamadas.length = 0;
    await w.scheduled({ cron }, {}, {});
    ok(JSON.stringify(chamadas) === JSON.stringify(rotas.map(x => 'https://ceven-cftv-matrix.pages.dev' + x)), `gatilho "${cron}" chama ${rotas.join(' e ')}, nessa ordem`);
  }
  for (const wf of ['tv-varredura-central-cron', 'tv-lances-cron', 'tv-executiva-mapa-live', 'tv-faturado-mes-cron', 'ceven-cron-datalake']) {
    const y = ler(`.github/workflows/${wf}.yml`);
    ok(!/^\s*schedule:/m.test(y) && /workflow_dispatch/.test(y), `${wf}.yml sem agendamento proprio no GitHub (quem dispara e o Worker) e com execucao manual`);
  }
  // uma chamada que falha nao derruba o gatilho
  globalThis.fetch = async () => { throw new Error('site fora do ar'); };
  let derrubou = false;
  try { await w.scheduled({ cron: '*/5 * * * *' }, {}, {}); } catch (e) { derrubou = true; }
  ok(!derrubou, 'erro em uma chamada nao derruba o gatilho da TV');
  // gatilho desconhecido e ignorado sem chamar nada
  chamadas.length = 0; globalThis.fetch = async (u) => { chamadas.push(String(u)); return { status: 200 }; };
  await w.scheduled({ cron: '1 2 3 4 5' }, {}, {});
  ok(chamadas.length === 0, 'gatilho desconhecido nao chama nada');
  globalThis.fetch = original;
}

// ---------------------------------------------------------------- 5c. coleta de lances reaproveita a coleta central
secao('5c. Coleta de lances usa os dados da varredura central (menos chamadas ao CEVEN)');
{
  const cl = ler('functions/api/cron-lances.js');
  ok(cl.includes('&central=1'), 'cron-lances pede ao tv-vendedor os dados da varredura central (central=1)');
  const lote = +(/const LOTE = (\d+)/.exec(cl) || [])[1];
  ok(lote * 2 <= 6, `lote de ${lote} vendedores x 2 historicos simultaneos <= 6 chamadas ao CEVEN`);
  const { onRequestGet } = await imp('functions/api/tv-vendedor.js');
  const agoraUtc = (menosMin) => new Date(Date.now() - menosMin * 60000).toISOString().replace('T', ' ').slice(0, 19);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const dash = { nome: 'TESTE', financeiro: { meta: 1000, faturado: 500, pendente: 10, devolucao: 0 }, positivacao: { meta: 10, realizado: 4 } };
  const prod = { dia: { dig_pedido: 300, positivacao: 1, total_programado: 3, visitas_com_venda: 1 } };
  const rot = [{ id_cliente: '11', id: '11', nome_cliente: 'A', status: 'EFETIVADO', checkin_horario: '09:00:00' }, { id_cliente: '12', id: '12', nome_cliente: 'B', status: 'ABERTO' }];
  const linha = (minAtras, extra = {}) => ({ roteiro_json: JSON.stringify(rot), produtividade_json: JSON.stringify(prod), dashboard_json: JSON.stringify(dash), updated_at: agoraUtc(minAtras), ...extra });
  const envCom = (row) => ({ DB: { prepare: () => ({ bind: () => ({ first: async () => row }) }) } });
  const original = globalThis.fetch;
  const chamar = async (query, row) => {
    const urls = [];
    globalThis.fetch = async (u) => { urls.push(String(u)); return { ok: true, text: async () => JSON.stringify(String(u).includes('historico-cliente') ? { ultimas_visitas: [] } : (String(u).includes('dashboard') ? dash : String(u).includes('produtividade') ? prod : rot)) }; };
    const r = await onRequestGet({ request: { url: `https://x.pages.dev/api/tv-vendedor?filial=tbl&id=5${query}` }, env: envCom(row) });
    const corpo = await r.json();
    const base = urls.filter(u => /\/api\/rca\/(dashboard|produtividade|roteiro-hoje)/.test(u)).length;
    const hist = urls.filter(u => u.includes('historico-cliente')).length;
    return { corpo, base, hist };
  };
  { const r = await chamar('&central=1', linha(3)); ok(r.base === 0 && r.hist === 1, `com dado central recente: 0 chamadas base ao CEVEN e ${r.hist} de historico (so do positivado)`); ok(r.corpo.meta_fat === 1000 && r.corpo.clientes.length === 2, 'e o resultado traz os mesmos campos (meta, clientes)'); }
  { const r = await chamar('&central=1', linha(20)); ok(r.base === 3, 'com dado central velho (20 min): volta a consultar o CEVEN (3 chamadas base)'); }
  { const r = await chamar('&central=1', linha(3, { dashboard_json: null })); ok(r.base === 3, 'com dado central incompleto: volta a consultar o CEVEN'); }
  { const r = await chamar('&central=1', null); ok(r.base === 3, 'sem dado central do vendedor: consulta o CEVEN'); }
  { const r = await chamar('', linha(3)); ok(r.base === 3, 'a tela da TV (sem central=1) segue consultando o CEVEN ao vivo'); }
  globalThis.fetch = original;
}

// ---------------------------------------------------------------- 6. senha da equipe
secao('6. Senha da Diretoria (entrar, salvar e aprovar)');
const { exigeSenhaEquipe } = await imp('functions/_lib/senha_equipe.js');
{
  const raw = new (require('better-sqlite3'))(':memory:');
  const DB = d1(raw);
  const env = { EQUIPE_SENHA: 'segredo-de-teste', DB };
  const req = (senha, ip = '1.1.1.1') => ({ headers: { get: (k) => (k === 'X-Equipe-Senha' ? senha : k === 'CF-Connecting-IP' ? ip : null) } });
  const st = (r) => (r ? r.status : 'liberado');
  ok(st(await exigeSenhaEquipe(req('x'), { DB }, {})) === 503, 'sem o segredo configurado: bloqueado (503)');
  ok(st(await exigeSenhaEquipe(req(null), env, {})) === 401, 'sem senha: 401');
  ok(st(await exigeSenhaEquipe(req('errada'), env, {})) === 401, 'senha errada: 401');
  ok(st(await exigeSenhaEquipe(req('segredo-de-teste'), env, {})) === 'liberado', 'senha certa: liberado');
  for (let i = 0; i < 4; i++) await exigeSenhaEquipe(req('chute' + i), env, {});
  ok(st(await exigeSenhaEquipe(req('segredo-de-teste'), env, {})) === 429, 'apos 5 erros o IP fica bloqueado, mesmo com a senha certa');
  ok(st(await exigeSenhaEquipe(req('segredo-de-teste', '9.9.9.9'), env, {})) === 'liberado', 'outro IP nao e afetado');
}

// ---------------------------------------------------------------- 7. aprovacao da equipe (fluxo completo)
secao('7. Aprovacao da Gestao de Equipe de ponta a ponta');
{
  const { onRequestPost } = await imp('functions/api/equipe-solicitacoes.js');
  const Database = require('better-sqlite3');
  const novo = () => {
    const raw = new Database(':memory:');
    raw.exec("CREATE TABLE solicitacoes_ajuste_equipe (id INTEGER PRIMARY KEY AUTOINCREMENT, criado_em TEXT, filial TEXT NOT NULL, gerente_nome TEXT, rca_id TEXT NOT NULL, rca_nome TEXT NOT NULL, tipo_acao TEXT NOT NULL, motivo TEXT, dados_extras TEXT, status TEXT DEFAULT 'PENDENTE', respondido_por TEXT, respondido_em TEXT, parecer_diretoria TEXT)");
    raw.exec("INSERT INTO solicitacoes_ajuste_equipe (id, criado_em, filial, gerente_nome, rca_id, rca_nome, tipo_acao, status) VALUES (2,'x','ABC','Marcos','1104','TESTE','ATIVAR','PENDENTE')");
    return raw;
  };
  const viva = () => ({ origem: 'drive', filiais: { ABC: [{ rca: '1104', nome: 'TESTE', canal: 'VJ', supervisor: 'S', gerente: 'G', mostra: false }, { rca: '236', nome: 'OUTRO', canal: 'VJ', supervisor: 'S', gerente: 'G', mostra: true }] } });
  const req = (corpo, senha) => ({ url: 'https://x.pages.dev/api/equipe-solicitacoes', headers: { get: (k) => (k === 'X-Equipe-Senha' ? senha : '2.2.2.2') }, json: async () => corpo });
  const corpo = { acao: 'APROVAR', solicitacao_id: 2, usuario: 'V', parecer: 'ok' };
  const fetchOriginal = globalThis.fetch;
  {
    const raw = novo(); const env = { DB: d1(raw), EQUIPE_SENHA: 'abc', ASSETS: { fetch: async () => ({ ok: false }) } };
    globalThis.fetch = async () => ({ ok: true, json: async () => viva() });
    const r = await onRequestPost({ request: req(corpo, 'errada'), env });
    ok(r.status === 401, 'senha errada: 401');
    ok(raw.prepare('SELECT status FROM solicitacoes_ajuste_equipe WHERE id=2').get().status === 'PENDENTE', 'e a solicitacao continua pendente');
  }
  {
    const raw = novo(); const env = { DB: d1(raw), EQUIPE_SENHA: 'abc', ASSETS: { fetch: async () => ({ ok: false }) } };
    globalThis.fetch = async () => ({ ok: true, json: async () => viva() });
    const r = await onRequestPost({ request: req(corpo, 'abc'), env });
    ok(r.status === 200, 'senha certa: aprovado');
    ok(raw.prepare('SELECT status FROM solicitacoes_ajuste_equipe WHERE id=2').get().status === 'APROVADO', 'status vira APROVADO');
    const b = JSON.parse(raw.prepare('SELECT conteudo_json FROM config_equipe_soberana WHERE id=1').get().conteudo_json);
    ok(b.filiais.ABC.find(v => v.rca === '1104').mostra === true, 'a base e gravada com o vendedor ativo');
    ok(raw.prepare('SELECT COUNT(*) n FROM audit_alteracoes_equipe').get().n === 1, 'auditoria gravada');
  }
  {
    const raw = novo(); const env = { DB: d1(raw), EQUIPE_SENHA: 'abc', ASSETS: { fetch: async () => ({ ok: false }) } };
    globalThis.fetch = async () => { throw new Error('fora do ar'); };
    const r = await onRequestPost({ request: req(corpo, 'abc'), env });
    ok(r.status === 502, 'sem nenhuma base disponivel: erro 502');
    ok(raw.prepare('SELECT status FROM solicitacoes_ajuste_equipe WHERE id=2').get().status === 'PENDENTE', 'nao fica "aprovado" sem ter aplicado');
  }
  globalThis.fetch = fetchOriginal;
}

// ---------------------------------------------------------------- 8. contagem de lances (sem duplicata)
secao('8. Lances do Brasileirao contados uma vez so');
{
  const { onRequestGet } = await imp('functions/api/brasileirao-lances.js');
  const linhas = [
    { chave: 'TBL|gol_super|1', filial: 'MTZ', nivel: 'gol', hora_sp: '10:00:05' },
    { chave: 'gol_super|1', filial: 'TBL', nivel: 'gol', hora_sp: '10:00:00' },
    { chave: 'sup|2026-10-03', filial: 'TBL', nivel: 'supervisor', hora_sp: '11:00:00' },
    { chave: 'sup|2026-10-03', filial: 'API', nivel: 'supervisor', hora_sp: '11:00:00' },
    { chave: 'MTZ|sup|2026-10-03', filial: 'MTZ', nivel: 'supervisor', hora_sp: '11:30:00' }
  ];
  const env = { DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: linhas }) }) }) } };
  const r = await onRequestGet({ request: { url: 'https://x.pages.dev/api/brasileirao-lances?dia=2026-10-03' }, env });
  const j = await r.json();
  ok(j.total === 4 && j.duplicados_removidos === 1, `5 linhas viram 4 lances (1 duplicata removida) -> total ${j.total}, removidas ${j.duplicados_removidos}`);
  const gol = (j.lances || []).find(l => l.nivel === 'gol');
  ok(gol && gol.filial === 'TBL' && gol.hora === '10:00:00', 'o gol fica na filial real e com a menor hora');
  ok((j.lances || []).filter(l => l.nivel === 'supervisor').length === 3, 'lances de supervisor de filiais diferentes continuam separados');
}

// ---------------------------------------------------------------- 9. prospects do Data Lake (aciona, espera, busca de novo)
secao('9. Prospects do Data Lake: aciona, espera 1 minuto e busca de novo');
{
  const r = spawnSync('python', [join(RAIZ, 'testes', 't_prospects.py')], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.error && r.error.code === 'ENOENT') {
    console.log('  pulado - Python nao encontrado neste computador');
  } else {
    (r.stdout || '').split('\n').filter(l => /^\s+(ok|FALHOU)/.test(l)).forEach(l => ok(/ok\s+-/.test(l), l.replace(/^\s+(ok|FALHOU)\s+-\s+/, '')));
    ok(r.status === 0, 'teste do extrator de prospects terminou sem erro');
  }
}

console.log(`\nRESULTADO: ${total - falhas} de ${total} verificacoes OK` + (falhas ? ` | ${falhas} FALHARAM` : ''));
process.exit(falhas ? 1 : 0);
