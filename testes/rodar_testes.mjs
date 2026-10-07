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
  ok(r.corrigidos === 0 && mapa.ABC_1.supNome === 'SUP ANTIGO', 'supervisor do CEVEN (arvore viva) NAO e trocado pelo nome da Gestao de Equipe (06/10/2026: a Gestao estava velha e bagunçou o WhatsApp)');
  ok(mapa.ABC_3 && mapa.ABC_3.supNome === 'MESMO', 'quem nao mudou fica como estava');
  writeFileSync(arquivoEquipe, JSON.stringify({ origem: 'teste', filiais: { TPH: [{ rca: '10', supervisor: 'X', grupo: 'VAGNER', mostra: true }, { rca: '11', supervisor: 'Y', grupo: 'FABIO', mostra: true }] } }));
  const mapaG = { TPH_10: { supNome: 'X', gerente: 'Fábio' }, TPH_11: { supNome: 'Y', gerente: 'Vagner' } };
  aplicar(mapaG);
  ok(mapaG.TPH_10.gerente === 'Vagner' && mapaG.TPH_11.gerente === 'Fábio', 'a planilha (campo grupo) manda no gerente: VAGNER e FABIO viram Vagner e Fábio, acima da lista de nomes do codigo');
  writeFileSync(arquivoEquipe, JSON.stringify(lista));
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
  { const w = ler('.github/workflows/ceven-cron-marca-propria.yml'); const i = w.indexOf('Gerar relatórios de Marca Própria'); const trecho = w.slice(i, i + 700);
    ok(trecho.includes('EVO_URL: ${{ secrets.EVO_URL }}') && trecho.includes('EVO_KEY: ${{ secrets.EVO_KEY }}') && trecho.includes('CEVEN_ADMIN_PASS'), 'passo que gera a marca propria recebe os segredos do WhatsApp (EVO_*) e do CEVEN'); }
  ok(!ler('public/brasileirao.html').includes('+${s.plus_lideranca} pts</span></td>') && ler('public/brasileirao.html').includes('s.plus_lideranca == null'), 'Brasileirao: coluna Plus Lideranca nao mostra "+undefined pts" quando o campo nao existe');
  { const bd = JSON.parse(ler('public/dados_brasileirao.json')); const fer = ['2026-09-07','2026-10-12','2026-11-02','2026-11-15','2026-11-20','2026-12-25'];
    ok(bd.dias_rodada.length > 0 && bd.dias_rodada.every(d => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 5 && !fer.includes(d); }), 'jogos do Brasileirao so em dias uteis (segunda a sexta) e sem feriados: ' + bd.dias_rodada.join(', '));
    ok(bd.vendedores.every(v => v.jogos <= bd.dias_rodada.length), 'nenhum vendedor tem mais jogos do que os dias de rodada'); }
  { const c = JSON.parse(ler('config/pontuacao_brasileirao.json')).plus_lideranca_supervisor; const ap = ler('public/apresentacao-diretoria.html');
    ok(c && c.compromisso_matinal_ate_10h00.pontos === 5 && c.ret_inicio_e_execucao.obrigatorio === false && c.ret_inicio_e_execucao.pontos === 5 && !c.zero_devolucoes_equipe_no_dia && !JSON.stringify(c).includes('destravamento_de_bloqueados'), 'plus de lideranca so bonus: +5 compromisso (ate 10:00), +5 RET (recomendado), sem Fair Play, sem destravamento');
    ok(!/Destravamento de Bloqueados no Dia/.test(ap) && !/se atrasar: -15|se faltar: -35/.test(ap), 'apresentacao da diretoria sem destravamento e sem punicao no Plus'); }
  { const bd = JSON.parse(ler('public/dados_brasileirao.json')); const nomes = bd.gerentes.map(g => g.nome);
    ok(new Set(nomes).size === nomes.length && nomes.includes('Fábio Machado') && nomes.includes('Fábio Colares') && !nomes.includes('Fábio'), 'Brasileirao: gerentes homonimos de filiais diferentes ficam separados (Fábio Machado TBL e Fábio Colares TPH)');
    ok(bd.gerentes.every(g => g.filiais.length === 1 || g.nome.includes('/')), 'Brasileirao: cada gerente pertence a uma filial'); }
  { const bd = JSON.parse(ler('public/dados_brasileirao.json'));
    ok(!bd.supervisores.some(s => /^GERENTE /i.test(s.supervisor)), 'Liga dos Supervisores nao tem supervisor falso ("GERENTE MCD", "GERENTE TPH"...): sao vendedores ligados direto ao gerente');
    ok(bd.vendedores.some(v => /^GERENTE /i.test(v.supervisor)), 'os vendedores ligados direto ao gerente continuam no ranking de vendedores'); }
  { const mz = ler('public/matrizapp.html'), tv = ler('public/tvapp.html'), ge = ler('public/gestao-equipe.html');
    ok(mz.includes('const ehSupFalso') && mz.includes('sups = supsAll.filter(s => !ehSupFalso(s.nome))') && tv.includes('const ehSupFalso') && tv.includes('if (ehSupFalso(x.sup)) return;') && ge.includes('direto ao gerente'), 'supervisor falso fora das telas: "GERENTE <FILIAL>" nao aparece como supervisor na Matriz, na TV da filial e na Gestao de Equipe'); }
  { const tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), api = ler('functions/api/metas-mes.js');
    ok(tv.includes("j('/api/metas-mes'") && mz.includes("j('/api/metas-mes'") && !tv.includes("/metas_mes.json") && !mz.includes("'/metas_mes.json") && api.includes('mes_meta_faturado') && api.includes('mes_meta_positivados'), 'metas do mes vem do CEVEN ao vivo (/api/metas-mes), nao do metas_mes.json estatico');
    ok(!/Meta do mês (PNA)/.test(tv + mz), 'rotulo da meta nao diz mais PNA (e do CEVEN)'); }
  { const wf = ler('.github/workflows/brasileirao-dataset.yml'), dl = ler('.github/workflows/ceven-cron-datalake.yml'), pg = ler('public/brasileirao.html');
    ok(wf.includes('scripts/coletar_plus_lideranca.js') && wf.includes('scratch/build_brasileirao_dataset.py') && wf.includes('git push') && !/\n\s*schedule:/.test(wf) && wf.includes('CEVEN_ADMIN_PASS'), 'Brasileirao gerado online: workflow coleta o Plus, gera o dataset e grava na main (sem schedule proprio)');
    ok(dl.includes('gh workflow run brasileirao-dataset.yml') && dl.includes('actions: write'), 'o Data Lake dispara o gerador do Brasileirao no fim');
    ok(pg.includes('raw.githubusercontent.com/vitoriotriunfante/cevenonline/main/public/dados_brasileirao.json') && pg.includes('gerado_em'), 'pagina do Brasileirao usa o dataset mais recente entre o do GitHub e o do site'); }
  { const bd = JSON.parse(ler('public/dados_brasileirao.json'));
    ok(!bd.supervisores.some(s => /^(GERENTE |RCAS INATIVOS|VENDA EMPRESA)/i.test(s.supervisor)), 'pseudo-supervisores (GERENTE X, RCAS INATIVOS, VENDA EMPRESA) fora da Liga dos Supervisores'); }
  { const bd = JSON.parse(ler('public/dados_brasileirao.json')); const s = bd.supervisores; let certo = true;
    for (let i = 1; i < s.length; i++) { if (s[i - 1].pts_tabela === s[i].pts_tabela && (s[i - 1].plus_lideranca || 0) < (s[i].plus_lideranca || 0)) certo = false; }
    ok(certo, 'Liga dos Supervisores: o Plus desempata (com pontos iguais, quem tem mais Plus fica na frente) e nao soma pontos');
    ok(ler('scratch/build_brasileirao_dataset.py').includes("x['pts_tabela'], x['plus_lideranca'] or 0"), 'gerador ordena por pontos, depois Plus, vitorias e saldo'); }
  { const { aplicaNaoSupervisores } = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'nao_supervisores.js')).href);
    const corpo = { filiais: {
      TBL: [{ rca: '198', supervisor: 'FABIO FURLAN MACHADO', gerente: 'Fábio' }, { rca: '1', supervisor: 'CIRLENE DE FATIMA GOMES VITORINO', gerente: 'Fábio' }],
      TPH_FABIO: [{ rca: '47', supervisor: 'CLT - Rodrigo Bertoni', gerente: 'Fábio' }],
      TBE: [{ rca: '284', supervisor: 'Alessandro de Oliveira Almeida', gerente: 'Diego' }],
      API: [{ rca: '9', supervisor: 'FABIO FURLAN MACHADO', gerente: 'Marcelo' }] } };
    aplicaNaoSupervisores(corpo); aplicaNaoSupervisores(corpo); // idempotente
    ok(corpo.filiais.TBL[0].supervisor === '' && corpo.filiais.TBL[0].supervisor_original === 'FABIO FURLAN MACHADO' && corpo.filiais.TBL[0].gerente === 'Fábio', 'nao sao supervisores: Fabio Furlan Machado (TBL) fica sem supervisor, guarda o original e continua com o gerente');
    ok(corpo.filiais.TPH_FABIO[0].supervisor === '' && corpo.filiais.TBE[0].supervisor === '', 'nao sao supervisores: Rodrigo Bertoni (TPH, com grupo e CLT) e Alessandro de Oliveira Almeida (TBE) tambem');
    ok(corpo.filiais.TBL[1].supervisor === 'CIRLENE DE FATIMA GOMES VITORINO', 'supervisor de verdade nao e tocado');
    ok(corpo.filiais.API[0].supervisor === 'FABIO FURLAN MACHADO', 'a regra e por filial: mesmo nome em outra filial nao e tocado');
    ok(corpo.nao_supervisores && corpo.nao_supervisores.lista.length === 3 && corpo.nao_supervisores.por.includes('Vitório'), 'a resposta da equipe registra a lista e quem decidiu (auditoria)');
    ok(ler('functions/api/tv-mostra.js').includes('aplicaNaoSupervisores(o)'), 'tv-mostra aplica a regra em todas as fontes (D1 e copia)'); }
  ok(ler('scratch/build_brasileirao_dataset.py').includes("if item.get('mostra') is False:"), 'Brasileirao: vendedores ocultos pela equipe (mostra:false) nao disputam a liga (ocultos pela equipe nao disputam)');
  { const cr = ler('functions/api/cron-mapa-executivo.js'), lv = ler('functions/api/mapa-executivo-live.js'), tx = ler('public/tv_executiva.html');
    ok(cr.includes('prod?.dia?.positivacao') && !/comVenda\+\+; aNac\.comVenda\+\+; aFil\.pedidos\+\+/.test(cr) && cr.includes('aF.pedidos += pedDigRca') && cr.includes('pegaRec(sig).pedidosCampo'), 'pedidos colocados da TV executiva = pedidos digitados hoje de TODOS os vendedores (rota e fora da rota); so a media pedidos/visita usa o varejo');
    ok(cr.includes('recorrencia_resumo_live') && cr.includes('ocultos.add') && lv.includes('recorrencia'), 'recorrencia na rota conta TODOS os clientes com a tag (com ou sem coordenada), sem vendedor oculto');
    ok(tx.includes('MAPA_PDVS.recorrencia'), 'TV executiva mostra o total real de recorrencia (chip, card e tabela por filial)'); }
  { const an = ler('public/animacoes/tv-animacoes.js'); const dir = join(RAIZ, 'public', 'animacoes', 'videos');
    ok(an.includes('function proximoDoBaralho') && an.includes('proximoDoBaralho(nivel, prontos)') && !/prontos\[Math\.floor\(Math\.random\(\) \* prontos\.length\)\]/.test(an), 'baralho dos videos: sorteio sem repetir e sem o mesmo duas vezes seguidas (nao e mais Math.random puro)');
    const listados = [...an.matchAll(/'\/animacoes\/videos\/([a-z_0-9]+\.mp4)'/g)].map(m => m[1]);
    const faltam = [...new Set(listados)].filter(f => !existsSync(join(dir, f)));
    ok(listados.filter(f => f.startsWith('gol_')).length >= 20, 'a TV lista os 20 videos de gol (gol_1 a gol_20)');
    ok(faltam.every(f => f === 'gol_20.mp4' || ['defesa_1.mp4','defesa_2.mp4','defesa_3.mp4','defesa_4.mp4','defesa_5.mp4','defesa_6.mp4','hattrick_1.mp4','semanainvicta_1.mp4','golcontra_1.mp4','golcontra_2.mp4','campeao_1.mp4','goleada_1.mp4'].includes(f)), 'todo video de gol/lance listado existe na pasta (faltando: ' + (faltam.join(', ') || 'nenhum') + ')'); }
  { const vs = ler('functions/api/varredura-status.js').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    ok(vs.includes('SELECT rca_codigo, updated_at FROM varredura_central_rca') && !/\b(INSERT|UPDATE|DELETE)\b/.test(vs) && !vs.includes('fetch('), 'varredura-status e so leitura do D1 (nao grava e nao chama o CEVEN)'); }
  { const cr = ler('functions/api/cron-mapa-executivo.js'), tv = ler('functions/api/tv-vendedor.js'), mz = ler('public/matrizapp.html');
    ok(!cr.includes('DELETE FROM resumo_executivo_live') && cr.includes('ON CONFLICT (filial_sigla, data_ref) DO UPDATE SET') && !/INSERT OR REPLACE INTO resumo_executivo_live/.test(cr) && !cr.includes('mes_faturado = excluded'), 'totais do mes da TV executiva nao sao zerados: o mapa grava so as colunas do dia (o mes e do cron-faturado-mes)');
    ok(cr.includes('dia.total_programado') && cr.includes('dia.visitas_na_rota') && cr.includes('dia.visitas_com_venda') && cr.includes('&& !ocultoRca'), 'visitas da TV executiva = contadores oficiais do CEVEN (programadas, na rota, com venda) e sem vendedores ocultos');
    ok(tv.includes('visitas_na_rota') && tv.includes('valorVendaAtual') && tv.includes('valorAtual'), 'tv-vendedor expoe as visitas oficiais e o valor do pedido de hoje por cliente');
    ok(mz.includes('feitasCeven') && mz.includes('rotaCeven') && mz.includes('(CEVEN)'), 'Matriz mostra as mesmas visitas oficiais do CEVEN que a TV executiva'); }
  { const cl = ler('functions/api/cron-lances.js'), tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), an = ler('public/animacoes/tv-animacoes.js');
    const semDuplo = (src) => src.includes('ehInativo && !ehRecorrencia') && !/\(ehInativo \|\| ehRecorrencia\)/.test(src);
    ok(semDuplo(cl) && semDuplo(tv) && semDuplo(mz), 'recorrencia vira so defesa: cliente com a tag RECORRENCIA nao gera mais gol de resgate junto com a defesa (coletor, TV e Matriz)');
    ok(/defesa: \['\/animacoes\/videos\/defesa_1\.mp4'/.test(an) && an.includes('defesa_6.mp4'), 'a TV lista os videos de defesa (defesa_1 a defesa_6)');
    ok(mz.includes('${vPed > 0 ?'), 'popup da Defesa na Matriz nao mostra "VALOR DA VENDA R$ 0" quando nao ha valor'); }
  { const fontes = ['functions/api/cron-lances.js', 'public/tvapp.html', 'public/matrizapp.html'].map(f => ler(f));
    ok(fontes.every(s => s.includes('function impedimentoGpsConfiavel') && s.includes('IMP_GPS_MAX_M = 5000') && !/distM > 500 && distM <= 20000/.test(s)), 'impedimento de GPS so com dado confiavel: entre 500 m e 5 km e sem ponto de check-out repetido (coletor, TV e Matriz iguais)');
    const corpo = fontes[0].slice(fontes[0].indexOf('const IMP_GPS_MIN_M'), fontes[0].indexOf('function horariosCheckinDoDia'));
    const dist = (a, b, c2, d) => { const R = 6371000, rad = x => x * Math.PI / 180, dLa = rad(c2 - a), dLo = rad(d - b); const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c2)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); };
    const f = new Function('distanciaM', corpo + '; return impedimentoGpsConfiavel;')(dist);
    const mk = (clat, clon) => ({ checkout_lat: clat, checkout_lon: clon });
    const v1 = { cl: [mk(-23.2496, -45.8313), mk(-23.2496, -45.8313), mk(-22.9, -45.6)] };   // Fernanda: o MESMO ponto em 2 visitas
    ok(f(v1, v1.cl[0], 8394) === false, 'GPS parado (mesmo check-out em 2 visitas) nao vira impedimento, mesmo a 8 km');
    const v2 = { cl: [mk(-23.6433, -45.4404)] };
    ok(f(v2, v2.cl[0], 19752) === false && f(v2, v2.cl[0], 537000) === false, 'check-out acima de 5 km (posicao aproximada ou ponto-padrao) nao vira impedimento');
    const v3 = { cl: [mk(-23.50, -46.10), mk(-23.60, -46.20)] };
    ok(f(v3, v3.cl[0], 1200) === true, 'check-out entre 500 m e 5 km, em ponto que nao se repete, continua sendo impedimento');
    ok(f(v3, v3.cl[0], 480) === false && f(v3, v3.cl[0], null) === false, 'ate 500 m ou sem coordenada nao e impedimento');
    const vE = { cl: [mk(-23.2493, -45.9245)] };      // check-out na sede (Rua Miracema, SJC), cliente a 3 km: antes virava impedimento
    ok(f(vE, vE.cl[0], 3000) === false, 'ponto da empresa nunca vira impedimento: check-out na sede (Rua Miracema, SJC) nao pune o vendedor, mesmo com o cliente a 3 km');
    const vE2 = { cl: [mk(-22.8903, -47.0498)] };      // Campinas (outro ponto da empresa), a ~50 m do ponto
    ok(f(vE2, vE2.cl[0], 2500) === false, 'o ponto de Campinas (Triunfante) tambem nao pune'); }
  { const cl = ler('functions/api/cron-lances.js');
    const semProva = ['gol_super|', 'gol_relampago|', 'gol_acrescimos|', 'gol_hattrick|', 'gol_meta1t|', 'gol_conversao|', 'gol_goleada|', 'gol_campeao|', 'golcontra_dev|', 'ver_dev|', 'vis11|', 'ven10|']
      .filter(k => !new RegExp('chave: `' + k.replace('|', '\\|') + '[^\\n]*prova:').test(cl));
    ok(semProva.length === 0 && cl.includes('obs: l.prova'), 'todo lance do vendedor grava a PROVA (numero que o gerou) em obs, para auditoria' + (semProva.length ? ' — faltam: ' + semProva.join(', ') : '')); }
  { const vc = ler('functions/api/cron-varredura-central.js');
    ok(/getJson\(urlRca\('produtividade', rca\)\)\), CONC, t0 \+ PRAZO_PRODUTIVIDADE_MS\)/.test(vc) && vc.includes('updated_at AS ua') && vc.includes('const prazoFria'), 'varredura: etapa quente tem PRAZO, vai do mais antigo ao mais novo e a etapa fria tem fatia propria (sem prazo a funcao era cortada antes de gravar e a varredura parava)'); }
  { const a = ler('public/matrizapp.html'), b = ler('public/tvapp.html');
    ok([a, b].every(t => t.includes("if (!poolAlertas.length && P.get('replay') !== '1') return;")), 'lance automatico NAO recicla lance antigo (so com ?replay=1): acabou o mesmo gol/penalti reaparecendo centenas de vezes'); }
  { const g = ler('public/gestao-equipe.html'), dv = ler('public/divergencias.html');
    ok(g.includes('id="painel-divergencias"') && g.includes('function incluirDivergencia') && g.includes("/api/divergencias") && /grupo, mostra: !!mostra/.test(g), 'Gestao de Equipe tem o painel de divergencias com o CEVEN (Diretoria decide aqui; o grupo TPH/MCD vai junto)');
    ok(!/planilha/i.test(dv.replace(/[a-z_]*planilha[a-z_]*/g, '')) && dv.includes('/gestao-equipe'), 'pagina de divergencias fala em Gestao de Equipe (a planilha do Drive nao e fonte) e leva para ela'); }
  { const an2 = ler('public/animacoes/tv-animacoes.js'), tv2 = ler('public/tvapp.html'), mz2 = ler('public/matrizapp.html');
    ok(['hattrick_1', 'hattrick_2', 'semanainvicta_1', 'semanainvicta_2', 'golcontra_1', 'golcontra_2', 'golcontra_3', 'vermelho_4'].every(n => an2.includes('/animacoes/videos/' + n + '.mp4')), 'a TV lista os videos novos (hat-trick, semana invicta, gol contra, vermelho_4)');
    ok(tv2.includes("videoNome = 'golcontra'") && mz2.includes("videoNome = 'golcontra'") && !mz2.includes("animGolContra) { duracaoAnim = 12000 + variaMs(); videoNome = 'amarelo'"), 'gol contra toca video de gol contra (antes tocava penalti na TV da filial e amarelo na Matriz)'); }
  { const wa = ler('.github/workflows/ceven-cron-whatsapp.yml'), mp = ler('.github/workflows/ceven-cron-marca-propria.yml'), mzz = ler('public/matrizapp.html'), tvv = ler('public/tvapp.html'), ep = ler('functions/api/brasileirao-lances.js'), cl2 = ler('functions/api/cron-lances.js');
    ok(!wa.includes('reset --soft') && !mp.includes('reset --soft') && wa.includes('reset --mixed') && mp.includes('reset --mixed'), 'commit automatico dos workflows do WhatsApp usa reset --mixed (o --soft desfazia o trabalho de outras sessoes)');
    ok([mzz, tvv].every(h => h.includes('TEMPO NO CLIENTE') && h.includes('bt-gc') && h.includes('Vendedor ligado direto ao gerente')), 'popup de todo lance de cliente mostra check-in, check-out e TEMPO NO CLIENTE; supervisor vazio vira "ligado direto ao gerente"; botao Gol Contra na barra de testes');
    ok(mzz.includes('METRICA_FILIAL') && mzz.includes('Score da filial'), 'Matriz: score/criticidade da filial iguais no foco, na lista e nos popups');
    ok(ep.includes('lances_excluidos_liga') && cl2.includes('tagsConhecidas'), 'lances retirados da liga ficam numa tabela com motivo; gol de resgate nao nasce sem a tag de recorrencia informada'); }
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
    '*/2 * * * *': ['/api/cron-varredura-central', '/api/cron-piloto-pedidos'],
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
  try { await w.scheduled({ cron: '*/2 * * * *' }, {}, {}); } catch (e) { derrubou = true; }
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
  const rot = [{ id_cliente: '11', id: '11', nome_cliente: 'A', status: 'EFETIVADO', checkin_horario: '00:01:00' }, { id_cliente: '12', id: '12', nome_cliente: 'B', status: 'ABERTO' }];
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
  { // DADO DE ONTEM: roteiro com cliente de outra data, ou com check-in depois da hora de agora, nao pode gerar lance
    const copia = rot.map((c) => ({ ...c }));
    rot.splice(0, rot.length, { ...copia[0], data_visita: '2026-01-01' }, copia[1]);
    let r = await chamar('&central=1', linha(3));
    ok(r.corpo.rota_antiga === true && r.corpo.clientes.length === 0, 'roteiro com cliente de OUTRA data (ontem) e descartado: rota_antiga e nenhum cliente');
    rot.splice(0, rot.length, { ...copia[0], data_visita: hoje, checkin_horario: '23:59:00' }, copia[1]);
    r = await chamar('&central=1', linha(3));
    ok(r.corpo.rota_antiga === true && r.corpo.clientes.length === 0, 'roteiro com check-in as 23:59 (depois da hora de agora) e descartado como dado de ontem');
    rot.splice(0, rot.length, { ...copia[0], data_visita: hoje }, copia[1]);
    r = await chamar('&central=1', linha(3));
    ok(r.corpo.rota_antiga === false && r.corpo.clientes.length === 2, 'roteiro de hoje com check-in ja ocorrido continua valendo');
    rot.splice(0, rot.length, ...copia);
  }
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

// ---------------------------------------------------------------- 8b. conta do Plus de Lideranca (sem rede)
secao('8b. Plus de Lideranca do supervisor: +5 compromisso (ate 10:00), +5 RET, sem punicao');
{
  const r = spawnSync('python', [join(RAIZ, 'testes', 't_plus.py')], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.error && r.error.code === 'ENOENT') {
    console.log('  pulado - Python nao encontrado neste computador');
  } else {
    (r.stdout || '').split('\n').filter(l => /^\s+(ok|FALHOU)/.test(l)).forEach(l => ok(/ok\s+-/.test(l), l.replace(/^\s+(ok|FALHOU)\s+-\s+/, '')));
    ok(r.status === 0, 'teste da conta do Plus terminou sem erro');
  }
}

// ---------------------------------------------------------------- 8c. varredura central em camadas (pedidos quase em tempo real)
secao('8c. Varredura central em camadas: pedido a cada 2 min, resto em fatias, trava unica e teto de 6 chamadas');
{
  const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_varredura.mjs')).href)).default;
  await t(ok);
  const toml = ler('worker-cron/wrangler.toml'), idx = ler('worker-cron/src/index.js');
  ok(toml.includes('"*/2 * * * *"') && idx.includes("'*/2 * * * *'") && idx.includes('/api/cron-varredura-central'), 'o relogio do Worker chama a varredura central a cada 2 minutos (wrangler.toml e index.js iguais)');
}

// ---------------------------------------------------------------- 8d. WhatsApp: TPH e MCD divididos por gerente em todos os ciclos
secao('8d. WhatsApp: TPH e MCD saem divididos por gerente em 11:30, 14:30, 17:00 e 18:30');
{
  const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_whatsapp_gerentes.mjs')).href)).default;
  await t(ok, RAIZ);
}

// ---------------------------------------------------------------- 8e. Semana Invicta: gatilho do lance (TV e Matriz)
secao('8e. Semana Invicta: o servidor confere a semana fechada e grava o lance; TV e Matriz mostram o popup com video');
{
  const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_semana_invicta.mjs')).href)).default;
  await t(ok, RAIZ);
  const tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), pr = ler('scratch/build_brasileirao_dataset.py'), tl = ler('functions/api/tv-lances.js');
  ok([tv, mz].every(h => h.includes("item.tipo === 'semanainvicta'") && h.includes('INVICTA_AVISADA') && h.includes('SEMANA INVICTA')), 'TV da filial e Matriz tem o popup da Semana Invicta e avisam uma vez');
  ok(tl.includes("'semanainvicta'") && pr.includes('_pts_api'), 'tv-lances aceita o lance semanainvicta e o ranking usa os pontos do endpoint (os do popup)');
}

// ---------------------------------------------------------------- 8f. Gol Qualificado (bronze a platina)
secao('8f. Gol Qualificado: nivel pelas industrias do pedido, carteira so Mondelez, extra nos pontos');
{
  const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_qualificacao_gol.mjs')).href)).default;
  await t(ok, RAIZ);
  const tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), cl = ler('functions/api/cron-lances.js'), tvv = ler('functions/api/tv-vendedor.js');
  ok([tv, mz].every(h => h.includes('qualificaGolUI') && h.includes('QUALIFICAÇÃO')) && cl.includes('qualificaGol(v.carteira, c)') && tvv.includes('industriasDoPedido'), 'TV, Matriz, cron de lances e tv-vendedor usam o Gol Qualificado');
  // motor do WhatsApp: corte/bloqueio/comprou so do pedido do proprio RCA (numero = RCA + 6 digitos)
  {
    const eng = ler('pipeline/ceven_unified_engine.js');
    const ini = eng.indexOf('function ehPedidoDoRca'), fim = eng.indexOf('}\n', ini) + 1;
    const ehDono = new Function(eng.slice(ini, eng.indexOf('function donoDoPedido')) + '; return ehPedidoDoRca;')();
    const dono = new Function(eng.slice(ini, eng.indexOf("n.slice(0, -6) : '';")) + "n.slice(0, -6) : ''; }; return donoDoPedido;")();
    ok(dono('108600094', ['1086', '60']) === '1086' && dono('5500000561', ['550', '55']) === '550' && dono('10000123', ['10', '100']) === '10' && dono('100000123', ['10', '100']) === '100' && dono('1045000160', ['79', '1045']) === '1045', 'dono do pedido: formatos com 5 ou 7 digitos e codigos parecidos (10 x 100) resolvidos pelo codigo conhecido mais longo');
    ok(ehDono('60000403', 60) && ehDono('177000874', '177') && ehDono('1043000083', 1043), 'pedido do proprio RCA (RCA + 6 digitos) e reconhecido');
    ok(!ehDono('1043000083', 60) && !ehDono('60000403', 6) && !ehDono('60000403', 600) && !ehDono('', 60) && !ehDono(null, 60) && !ehDono('60000403', ''), 'pedido de outro vendedor (caso Twix do TPH 60) e prefixo parecido NAO sao reconhecidos');
    ok(eng.includes('PEDIDOS_APURADOS.has(numPed)') && eng.includes('donosPorCodigo.get(codDono)') && eng.includes('find(v => ehPedidoDoRca(v.num_pedido, rca.codigo) || ehPedidoTolerante(v.num_pedido, rca.codigo))'), 'cortes/bloqueados: cada pedido contado UMA vez (por numero), no vendedor dono; recuperados usa so o pedido do dono');
  }
}

// ---------------------------------------------------------------- 8g. Vigia dos disparos de WhatsApp
secao('8g. Vigia dos disparos: refaz so o que nao comecou (caso das 17h de 05/10/2026), nunca duplica');
{
  const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_vigia_disparos.mjs')).href)).default;
  await t(ok, RAIZ);
  ok(ler('worker-cron/src/index.js').includes('vigiarDisparos(env)') && ler('public/matrizapp.html').includes('faixa-disparo') && existsSync(join(RAIZ, 'functions', 'api', 'disparo-status.js')), 'worker chama o vigia a cada 2 min e a Matriz tem a faixa vermelha de aviso');
}

// ---------------------------------------------------------------- 8h. Supervisores: botao na Matriz, formato da filial com fotos, painel da semana
secao('8h. Supervisores: botao na Matriz, cards com fotos e painel gerencial da semana (fez / nao fez)');
{
  const mz = ler('public/matrizapp.html'), tv = ler('public/tvapp.html'), an = ler('public/animacoes/tv-animacoes.js'), se = ler('functions/api/tv-supervisores-semana.js'), su = ler('functions/api/tv-supervisores.js');
  ok(mz.includes('id="bsup"') && mz.includes('SUP_MANUAL') && mz.includes('renderSupFormatoFilial') && mz.includes('supSemanaHtml'), 'Matriz tem o botao Supervisores, que mostra o formato da filial (cards com fotos) e a semana');
  ok(tv.includes('supSemanaHtml') && tv.includes('/api/tv-supervisores-semana'), 'TV da filial mostra o painel gerencial da semana abaixo dos supervisores');
  ok(an.includes('window.supCardsHtml') && an.includes('window.supSemanaHtml') && an.includes('NÃO FEZ') && an.includes('PENDENTE'), 'modulo unico: cards com fotos + tabela FEZ / PARCIAL / NAO FEZ; o dia de hoje sem nada e PENDENTE (nao punido)');
  ok(se.includes('NAO_SUPERVISORES') && su.includes('NAO_SUPERVISORES') && se.includes('porDia') && se.includes('feriado'), 'endpoints tiram os nao-supervisores (decisao 04/10), usam o porDia do CEVEN e marcam feriado');
}

// ---------------------------------------------------------------- 8i. Gol de cliente: so pedido de HOJE e dados reais (nada estimado)
secao('8i. Gol de cliente: so com pedido de hoje do vendedor; quinzenas e pedido com dados reais, sem estimativa');
{
  const tvv = ler('functions/api/tv-vendedor.js'), mz = ler('public/matrizapp.html'), tv = ler('public/tvapp.html'), cl = ler('functions/api/cron-lances.js');
  ok(tvv.includes('if (hoje && dataAtual !== hoje) return null') && tvv.includes('analisaPedido(resultados[i], catalogo, id, dataHojeBrasilia(), canalVend)'), 'gol de cliente so nasce de pedido DE HOJE (pedido antigo do cliente nao vira gol)');
  ok(!mz.includes('vFatTotal * 0.48') && !mz.includes('valor_ultima * 2') && mz.includes('golClienteLinhasHtml') && tv.includes('golClienteLinhasHtml'), 'popup nao estima mais as quinzenas (48%/52% e dobro da ultima compra foram removidos); usa os pedidos reais');
  ok(cl.includes('provaPedidoHoje(c)') && cl.includes('provaQuinzenas(c)') && tvv.includes('pedidoHoje') && tvv.includes('quinzenas'), 'prova do lance leva o numero, status e valor do pedido de hoje e os pedidos de cada quinzena');
  ok(mz.includes("const sairSup") && mz.includes('sairSup();'), 'botao Painel sai do modo Supervisores');
}

// ---------------------------------------------------------------- 8j. Madrugada: nenhum lance de ontem registrado como de hoje
secao('8j. Trava da madrugada: antes das 06h nao coleta nem grava lance (a meia-noite o CEVEN ainda serve o roteiro de ontem)');
{
  const cl = ler('functions/api/cron-lances.js'), tl = ler('functions/api/tv-lances.js');
  ok(cl.includes('MADRUGADA_SEM_COLETA') && cl.includes('t.h < 6'), 'coletor de lances nao roda antes das 06h');
  ok(tl.includes("String(hora) < '06:00:00'") && tl.includes("ignorado: 'madrugada'"), 'gravacao de lances (TV/Matriz) tambem ignora a madrugada');
}

// ---------------------------------------------------------------- 8k. Supervisores: filtro, trava e painel fixo no topo; nada inventado
secao('8k. Supervisores com filtro/trava e painel gerencial fixo no topo; sem preco inventado nos cortes');
{
  const mz = ler('public/matrizapp.html'), tv = ler('public/tvapp.html'), eng = ler('pipeline/ceven_unified_engine.js');
  ok(mz.includes('supFiltro') && mz.includes('supTravar') && mz.includes('supSoPend') && mz.includes("'TODAS'") && mz.includes('position:sticky'), 'Matriz: filtro por filial/todas, trava do giro, so pendentes e painel gerencial fixo no topo');
  ok(tv.includes('topoSem') && tv.includes('position:sticky'), 'TV da filial: painel gerencial fixo no topo');
  ok(!eng.includes('it.preco || 15') && eng.includes('vl_perdido_logistica'), 'cortes: sem preco padrao de R$ 15 inventado; usa o valor perdido real do CEVEN');
}

// ---------------------------------------------------------------- 8l. Paineis escolhiveis (vermelhos/amarelos...), gabarito e tela responsiva
secao('8l. Paineis escolhidos pelo gestor (cartoes vermelhos/amarelos), aba Gabarito e Brasileirao responsivo');
{
  const mz = ler('public/matrizapp.html'), tv = ler('public/tvapp.html'), an = ler('public/animacoes/tv-animacoes.js'), br = ler('public/brasileirao.html');
  ok(an.includes('PAINEIS_OPCOES') && an.includes('Cartões vermelhos de hoje') && an.includes('Cartões amarelos de hoje') && an.includes('painelLancesBlocoHtml'), 'opcoes de painel incluem cartoes vermelhos e amarelos, gols, defesas, impedimentos e gol contra');
  ok(mz.includes('painelSlotSet') && mz.includes('PNL_HTML') && mz.includes('painelComSeletor(i, id,'), 'Matriz: cada quadro do Painel Nacional tem seletor e so redesenha quando muda');
  ok(tv.includes('painelSlotSet') && tv.includes('PNL_CACHE') && tv.includes('BUFP'), 'TV da filial: cada quadro do Painel tem seletor');
  ok(!br.includes('max-width: 1500px;') && br.includes('tab-gabarito') && br.includes('carregarGabarito') && br.includes("switchTab('gabarito')"), 'Brasileirao: largura responsiva e aba Gabarito do Dia ao lado de Lances do Dia');
}

// ---------------------------------------------------------------- 8m. Tela exclusiva dos supervisores + tabelas que nao cortam
secao('8m. Tela exclusiva /supervisores (compromisso, RET, semana) e tabelas do Brasileirao sem corte lateral');
{
  const su = ler('public/supervisores.html'), br = ler('public/brasileirao.html');
  ok(su.includes('/api/tv-supervisores-semana') && su.includes('/api/tv-supervisores?filial=') && su.includes('supCardsHtml') && su.includes('supSemanaHtml') && su.includes('position:sticky'), 'pagina /supervisores: cards do dia com fotos + painel da semana fixo no topo, tudo do CEVEN');
  ok(su.includes('fFilial') && su.includes('fBusca') && su.includes('bPend') && su.includes('bPrev'), 'pagina /supervisores: filtro por filial, busca por nome, so pendentes e navegacao de semana');
  ok(br.includes('#tab-gabarito .tb-league td { white-space: normal') && br.includes('href="/supervisores"'), 'Brasileirao: gabarito e lances quebram linha (nao cortam os pontos) e tem atalho para /supervisores');
}

// ---------------------------------------------------------------- 8n. Popup compacto
secao('8n. Popup de decisao compacto: campos curtos lado a lado, texto longo em linha inteira, nunca maior que a tela');
{
  const tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), an = ler('public/animacoes/tv-animacoes.js');
  ok([tv, mz].every(h => h.includes('POPUP "DECISAO DO VAR" v2') && h.includes('max-height:94vh') && h.includes('compactaDecHtml(dec)')), 'TV da filial e Matriz: popup em 3 colunas, limitado a 94% da altura da tela');
  ok(an.includes('window.compactaDecHtml') && !mz.includes('<b>CLIENTE</b><span>${esc(cObj.nome)}'), 'campos de texto longo ocupam a linha inteira; o gol nao repete cliente nem valor');
}

// ---------------------------------------------------------------- 8o. Regras de 06/10/2026: amarelo 10h, vermelho 11h, penalti -4
secao('8o. Regras novas: amarelo as 10h (sem pedido e/ou sem visita), vermelho de abandono as 11h, penalti -4 a partir de 06/10');
{
  const cl = ler('functions/api/cron-lances.js'), bl = ler('functions/api/brasileirao-lances.js'), tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), cj = JSON.parse(ler('config/pontuacao_brasileirao.json')), pj = JSON.parse(ler('public/pontuacao_brasileirao.json')), br = ler('public/brasileirao.html');
  ok(cl.includes('limAmarelo = v.fuso1h ? 11 : 10, limVermelho = v.fuso1h ? 12 : 11') && cl.includes('v.feitas === 0 || (!(v.dig > 0)') && cl.includes('t.h >= limVermelho') && cl.includes('chave: `vis11|${v.id}`') && cl.includes('v.feitas === 0) {'), 'coletor: amarelo as 10h (sem pedido e/ou sem visita), vermelho de abandono as 11h (12h no fuso)');
  ok([tv, mz].every(h => h.includes("subtipo: v.feitas === 0 ? 'sem_checkin' : 'sem_venda'") && h.includes('limVerm = limiteHora + 1') && h.includes('-4 PONTOS NA LIGA')), 'TV e Matriz: mesma regra nos popups e penalti -4 no selo');
  ok(cj.pontos_por_lance.penalti_estoque.pontos === -4 && cj.pontos_por_lance.penalti_fechado.pontos === -4 && pj.pontos_por_lance.penalti_estoque.pontos === -4 && /11h00/.test(cj.pontos_por_lance.visita10.motivo) && /nenhuma visita/.test(cj.pontos_por_lance.amarelo.motivo), 'regulamento (config e copia publica): penalti -4, abandono 11h, amarelo com sem-visita/check-in');
  ok(bl.includes("dia >= '2026-10-06'") && bl.includes('pontos: -4'), 'endpoint: penalti vale -4 so a partir de 06/10/2026 (dias anteriores continuam -6)');
  ok(br.includes('table-layout: fixed') && !br.includes('clientes recuperados') && br.includes('@media (max-width: 1560px)') && br.includes('/api/version'), 'Brasileirao: tabelas cabem na tela (sem rolagem lateral), cabecalhos Super Pedidos/Inativos explicados, recarrega com versao nova');
}

// ---------------------------------------------------------------- 8p. Lances com horario, painel travado no topo, lance de hoje de verdade
secao('8p. Horarios dos lances (acrescimos 16h30-18h00), amarelos agrupados, painel com menu no cabecalho, TV sem lance de madrugada');
{
  const cl = ler('functions/api/cron-lances.js'), tl = ler('functions/api/tv-lances.js'), tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), an = ler('public/animacoes/tv-animacoes.js'), br = ler('public/brasileirao.html');
  ok(cl.includes('acrIni = (v.fuso1h ? 17 : 16) * 60 + 30, acrFim = (v.fuso1h ? 19 : 18) * 60') && [tv, mz].every(h => h.includes('ultimoCheckin.horaMin >= acrIni && ultimoCheckin.horaMin <= acrFim')), 'Gol nos Acrescimos: check-in so entre 16h30 e 18h00 (17h30 e 19h00 no fuso); depois nao e aceito (coletor, TV e Matriz)');
  ok(tl.includes("String(r.hora_sp || '') >= '06:00:00'") && tl.includes('lances_excluidos_liga') && tv.includes('ceven_tv_log2_') && mz.includes('ceven_mtz_log2_'), 'TV e Matriz so mostram lance de hoje de verdade: sem madrugada repetida e sem lance tirado da liga; log local do navegador renovado');
  ok([tv, mz].every(h => h.includes("tipo: 'amarelos'") && h.includes('CARTÕES AMARELOS')), 'cartoes amarelos aparecem em UM popup com a lista (nao 1 popup por vendedor)');
  ok(an.includes('painelComSeletor') && an.includes("replace('<b>', sel + '<b>')"), 'menu do painel fica no cabecalho do quadro (fixo no topo), ao lado do titulo');
  ok(!br.includes('Gerente Regional') && [tv, mz].every(h => h.includes('dias sem compra</span>')), 'sem "Gerente Regional"; detalhe do penalti mostra a hora e os dias sem compra');
}

// ---------------------------------------------------------------- 8q. Responsividade
secao('8q. Responsividade: abas e rodapes quebram linha, tabelas encolhem, sem colunas cortadas');
{
  const br = ler('public/brasileirao.html'), tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), ex = ler('public/tv_executiva.html'), dv = ler('public/divergencias.html'), ge = ler('public/gestao-equipe.html');
  ok(br.includes('.nav-tabs { flex-wrap: wrap; overflow-x: visible') && br.includes('@media (max-width: 1360px)') && br.includes('@media (max-width: 700px)') && !br.includes('${f.super_pedidos}') && !br.includes('${v.inativos_resgatados}'), 'Brasileirao: abas quebram linha, tabelas encolhem e escondem colunas secundarias em tela estreita; Super Pedido/Inativos removidos');
  ok([tv, mz].every(h => h.includes('#ctl { display: flex; flex-wrap: wrap') && h.includes('footer { flex-wrap: wrap')), 'TV da filial e Matriz: rodape com botoes que quebram linha (nada cortado)');
  ok(ex.includes('header { height: auto !important') && dv.includes('clamp(5px,.6vw,8px)') && ge.includes('white-space: normal !important'), 'Executiva, Divergencias e Gestao de Equipe: cabecalho/tabelas fluidos');
}

// ---------------------------------------------------------------- 8r. Goleada comprovada, aviso dos cartoes por horario, texto do regulamento
secao('8r. Goleada so com clientes comprovados na rota; aviso unico dos cartoes de 10h/11h vindos do servidor; regulamento sem justificativa literal');
{
  const cl = ler('functions/api/cron-lances.js'), tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), an = ler('public/animacoes/tv-animacoes.js'), cj = JSON.parse(ler('config/pontuacao_brasileirao.json'));
  ok(cl.includes('(v.comVenda || 0) >= 10') && !cl.includes('(v.pos || 0) >= 10') && tv.includes('(v.comVenda || 0) >= 10') && mz.includes('(v.comVenda || 0) >= 10'), 'Goleada: 10 clientes positivados COMPROVADOS na rota (pedidos nao provam clientes: MCD 420 tinha 12 pedidos e 0 clientes na rota)');
  ok(an.includes('window.cartoesDoServidor') && tv.includes('cartoesDoServidor(d.lances') && mz.includes('cartoesDoServidor(d.lances'), 'cartoes de 10h (amarelo) e 11h (vermelho) avisam a partir do que o servidor registrou, 1 vez por dia em cada navegador');
  ok(!/ninguém trabalha/.test(cj.pontos_por_lance.gol_acrescimos.motivo) && /18h00/.test(cj.pontos_por_lance.gol_acrescimos.motivo), 'regulamento do Gol nos Acrescimos sem a justificativa interna');
}

// ---------------------------------------------------------------- 8s. Arvore viva do CEVEN (supervisor muda todo dia)
secao('8s. Arvore viva do CEVEN: supervisor vem do CEVEN de hoje (Gestao nao sobrescreve), TV e WhatsApp');
{
  const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_arvore.mjs')).href)).default;
  await t(ok, RAIZ);
  const eng = ler('pipeline/ceven_unified_engine.js'), tm = ler('functions/api/tv-mostra.js'), cl = ler('functions/api/cron-lances.js');
  ok(!eng.includes('val.supNome = supNovo') && eng.includes('SUPERVISOR = ARVORE VIVA DO CEVEN'), 'motor do WhatsApp nao troca mais o supervisor do CEVEN pelo nome da Gestao de Equipe');
  ok(tm.includes('aplicaArvore(env, corpo)') && cl.includes('garanteArvore(env, 45)'), 'tv-mostra aplica a arvore viva e o coletor a renova sozinho (45 min)');
}

// ---------------------------------------------------------------- 8t. Divergencias da arvore viva
secao('8t. /divergencias lista: vendedores novos da arvore, supervisor trocado pelo CEVEN e so na Gestao');
{
  const api = ler('functions/api/divergencias.js'), pg = ler('public/divergencias.html');
  ok(api.includes('aplicaArvore(env, cop)') && api.includes('supervisor_mudou') && api.includes('so_gestao') && api.includes('arvore,'), 'endpoint de divergencias devolve a arvore: novos, supervisor trocado e so na Gestao');
  ok(pg.indexOf('const ar = d.arvore') > 0 && pg.indexOf('const ar = d.arvore') < pg.indexOf('(ar.novos'), 'divergencias: a variavel da arvore e criada antes de ser usada (erro "Cannot access ar before initialization" de 06/10)');
  ok(pg.includes('0. Árvore do CEVEN: vendedores NOVOS') && pg.includes('0.1 Árvore do CEVEN: supervisor trocado') && pg.includes('0.2 Só na Gestão de Equipe'), 'pagina /divergencias mostra as 3 secoes novas no topo');
}

// ---------------------------------------------------------------- 8u. Nome do vendedor e do estabelecimento em destaque no popup
secao('8u. Popup: vendedor e estabelecimento com nome grande');
{
  const tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), an = ler('public/animacoes/tv-animacoes.js');
  ok([tv, mz].every(h => h.includes('.ln.vend>span{font-size:clamp(26px') && h.includes('.ln.est>span') && h.includes('ln w est') && h.includes('ln hot why') && h.includes('POR QUE É PÊNALTI') && h.includes('porqueHtml(it)')) && an.includes("' vend'"), 'vendedor sobe logo abaixo dos pontos em nome grande; no penalti o MOTIVO (por que e penalti) e o destaque grande e os clientes vem abaixo com os dias sem compra');
}

// ---------------------------------------------------------------- 8v. Nivel (bronze a platina) em TODOS os gols
secao('8v. Nivel do gol vale para TODOS os gols (menos Campeao da Rodada); sem "Regional"');
{
  const cl = ler('functions/api/cron-lances.js'), tvv = ler('functions/api/tv-vendedor.js'), tl = ler('functions/api/tv-lances.js'), tv = ler('public/tvapp.html'), mz = ler('public/matrizapp.html'), br = ler('public/brasileirao.html'), cj = ler('config/pontuacao_brasileirao.json');
  const gols = ['gol_super', 'gol_relampago', 'gol_acrescimos', 'gol_hattrick', 'gol_meta1t', 'gol_conversao', 'gol_goleada'];
  const linhasCl = cl.split(String.fromCharCode(10));
  const semNivel = gols.filter(g => !linhasCl.some(l => l.includes('chave: `' + g + '|') && l.includes('comQ(v,')));
  ok(semNivel.length === 0 && !linhasCl.some(l => l.includes('gol_campeao') && l.includes('comQ(v,')), 'coletor: todos os gols do dia levam o nivel pelas industrias de todos os pedidos do vendedor (Campeao da Rodada fica de fora)' + (semNivel.length ? ' - faltam: ' + semNivel.join(',') : ''));
  ok(tvv.includes('industrias_dia') && cl.includes('industriasDia') && tl.includes("NOT LIKE '%[QUALIF:%'") && tl.includes('txt(l.obs, 700)'), 'industrias do dia chegam do tv-vendedor; o gol de hoje ja gravado recebe o nivel; obs cabe o texto completo');
  ok([tv, mz].every(h => h.includes('subDia = [') && h.includes('industrias_dia')), 'popup da TV e da Matriz mostra o nivel em todos os gols');
  ok(!br.includes('Gerências Regionais') && !cj.includes('Gerente Regional'), 'sem "Regional" no Brasileirao e no regulamento (gerencia e gerencia)');
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

secao('8d. Lances na tela: o que o coletor registrou nos ultimos 12 min tambem apita; depois das 16h o VAR acelera');
for (const arq of ['public/tvapp.html', 'public/matrizapp.html']) {
  const t = ler(arq);
  ok(t.includes('const RECENTES = new Set()') && t.includes('ehRecente') && t.includes('RECENTES.has(a.key)') && t.includes('EXIB.add(a.key)') && t.includes('ANTES de dar o lance como visto'), arq + ': lance registrado pelo coletor nos ultimos 12 min entra na fila do VAR (a tela nao fica muda)');
  ok(t.includes('(sp().h >= 15 ? 90 : 180)') && t.includes('(sp().h >= 15 ? 40 : 20)') && t.includes('varGapS()') && t.includes('varMaxH()'), arq + ': depois das 15h o VAR roda a cada 90 s e ate 40 por hora');
  ok(t.includes('const ehBomLance') && t.includes('podeVAR(ESPERA.some(ehBomLance), ESPERA.some(ehMarcaPropria))') && t.includes('ESPERA.splice(iBom, 1)[0]') && t.includes('Math.min(varGapS(), sp().h >= 15 ? 30 : 40)') && t.includes('ruimLiberado()') && t.includes('10 * 60e3'), arq + ': gol, hat-trick e defesa saem sozinhos (nunca dentro de resumo), passam na frente e com intervalo de 30 s depois das 15h; lance ruim so em resumo e no maximo 1 a cada 10 min');
}

secao('8e. Liga cravada: regras congeladas por versao, fechamento do dia (19h30) e conferencia diaria contra o CEVEN');
{
  const cfgTxt = ler('config/pontuacao_brasileirao.json'); const cfg = JSON.parse(cfgTxt);
  const LOCK_HASH = 'edd2939f2d5cf31321c68bd1ab3e0f3d567f2d50d10ba895822c92fde3b14cd9'; // sha256 do regulamento na versao 2026-10-09.1 (Tripla de Marca Propria +10, vale a partir de 09/10; Gol de Marca Propria +8 desde 08/10)
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256').update(JSON.stringify(cfg)).digest('hex');
  const lib = ler('functions/_lib/liga_fechamento.js');
  ok(lib.includes("REGRAS_VERSAO = '" + cfg.versao_regras + "'") && JSON.parse(ler('public/pontuacao_brasileirao.json')).versao_regras === cfg.versao_regras, 'versao das regras: config (' + cfg.versao_regras + '), copia publica (a que aparece no regulamento) e liga_fechamento.js dizem a mesma versao');
  ok(hash === LOCK_HASH, 'REGRAS CONGELADAS: o regulamento (config/pontuacao_brasileirao.json) nao mudou desde a versao ' + cfg.versao_regras + '. Se mudou de proposito: suba versao_regras e REGRAS_VERSAO, atualize LOCK_HASH aqui e avise os gerentes (hash atual ' + hash + ')');
  ok(lib.includes('t.min >= 22 * 60') && lib.includes('INSERT OR IGNORE INTO liga_fechamento') && lib.indexOf('INSERT OR IGNORE INTO liga_dia_fechado') < lib.indexOf('INSERT OR IGNORE INTO liga_fechamento'), 'fechamento: so depois das 22h, grava as linhas ANTES do cabecalho e nunca sobrescreve dia ja fechado');
  const bl = ler('functions/api/brasileirao-lances.js');
  ok(bl.includes('lerDiaFechado(env, dia, filial)') && bl.includes("ao_vivo') !== '1'"), 'endpoint da liga devolve o dia FECHADO sem recalcular (so o fechamento usa ao_vivo=1)');
  const cr = ler('functions/api/cron-lances.js');
  ok(cr.includes('cron-fechamento-dia') && cr.includes('cron-conferencia-dia?rodar=1') && cr.includes('t.agoraMin >= 22 * 60 ||') && cr.includes('t.agoraMin >= 22 * 60 + 5'), 'coletor chama o fechamento depois das 22h (e pela manha, se perdeu) e a conferencia depois das 22h05');
  const cf = ler('functions/api/cron-conferencia-dia.js');
  ok(cf.includes('const FATIA = 60, CONC = 6') && cf.includes('/api/rca/produtividade') && cf.includes('/api/rca/devolucoes') && !/method:\s*['"]POST/.test(cf), 'conferencia: so leitura do CEVEN, 6 chamadas simultaneas no maximo, fatias de 60 vendedores');
  { const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_fechamento.mjs')).href)).default; await t(ok); }
  { const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_auditoria.mjs')).href)).default; await t(ok); }
  { const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_notificacao.mjs')).href)).default; await t(ok); }
  { const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_notif_supervisores.mjs')).href)).default; await t(ok); }
  { const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_fila_var.mjs')).href)).default; await t(ok); }
  { const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_liga_as.mjs')).href)).default; await t(ok); }
  { const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_canal.mjs')).href)).default; await t(ok); }
  { const t = (await import(pathToFileURL(join(RAIZ, 'testes', 't_canal_ceven.mjs')).href)).default; await t(ok); }
  { const tv = ler('functions/api/tv-vendedor.js'); ok(tv.includes('data_visita') && tv.includes('rotaAntiga') && tv.includes("hm < '10:00'") && tv.includes('saida.rota_antiga'), 'tv-vendedor: roteiro de OUTRO dia ou com check-in no futuro e descartado (nenhum lance de ontem nasce hoje de manha)'); }
  ok(ler('functions/api/tv-lances.js').includes('length(obs) <= 3'), 'lance gravado pela TV com obs so de sigla (sem prova) recebe a prova do coletor depois');
  const fe = ler('functions/api/cron-fechamento-dia.js');
  ok(fe.includes("DIA_INICIAL = '2026-10-06'") && fe.includes('manual'), 'fechamento automatico so de 06/10/2026 em diante; dias anteriores so de proposito (manual=1)');
}

secao('8f. Score de desempenho da Matriz: 0 a 100, nunca negativo, lider = 100');
{
  const t = ler('public/matrizapp.html');
  const ini = t.indexOf('const SCORE_PESOS'), fim = t.indexOf('const METRICA_FILIAL');
  const fn = new Function(t.slice(ini, fim) + '; return scoresRelativos;')();
  const mk = (sig, pctFat, pctPos, gols, pen, nZer, n, campo) => ({ sig, tem: true, pctFat, pctPos, gols, pen, nZer, n, campo: new Array(campo).fill(0) });
  // numeros parecidos com os de 06/10/2026 (TCA e TCG tinham score NEGATIVO na formula antiga)
  const stats = [mk('TBL', 9.6, 11.5, 11, 19, 3, 33, 30), mk('TPH', 14, 12.4, 11, 41, 7, 88, 62), mk('TCG', 1.1, 0.7, 4, 2, 6, 20, 15), mk('TCA', 3.1, 7, 7, 15, 12, 28, 25), mk('API', 5.3, 7.6, 14, 4, 2, 30, 28)];
  const r = fn(stats);
  const v = Object.values(r);
  ok(v.every(x => x >= 0 && x <= 100), 'score de todas as filiais fica entre 0 e 100 (nenhum negativo): ' + JSON.stringify(r));
  ok(Math.max(...v) === 100, 'o lider vale exatamente 100');
  ok(r.TCG < r.TBL && r.TCA < r.API, 'quem tem menos resultado e mais perda fica abaixo (ordem faz sentido)');
  ok(JSON.stringify(fn([mk('A', 0, 0, 0, 0, 0, 10, 8), mk('B', 0, 0, 0, 0, 0, 10, 8)])) === '{"A":100,"B":100}', 'sem nenhum dado nao inventa diferenca: todas empatam em 100');
}

console.log(`\nRESULTADO: ${total - falhas} de ${total} verificacoes OK` + (falhas ? ` | ${falhas} FALHARAM` : ''));
process.exit(falhas ? 1 : 0);
