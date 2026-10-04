/**
 * FICHA DO ARQUIVO
 * O QUE É: coleta os DADOS BRUTOS do "Plus de Liderança" do supervisor (Brasileirão), por dia útil da temporada:
 *          - compromisso matinal (feito/não feito) e RET (feito/não feito), vindos do CEVEN
 *            (/api/admin/supervisores/matriz-compromissos e matriz-ret, que aceitam dataInicio/dataFim);
 *          - devoluções por supervisor e dia, vindas do banco do Data Lake (tabela devolucoes_notas), se o
 *            arquivo do banco existir na máquina (no workflow ele é baixado do Drive).
 * REGRAS (decididas pelo Vitório, 03-04/10/2026): o CEVEN trava o compromisso às 10:00, então "feito" = feito
 *          até as 10:00; RET é recomendado; só segunda a sexta sem feriados; só bônus (sem punição).
 * ESCREVE: scratch/plus_inputs.json (arquivo de passagem; NÃO é commitado). Quem calcula os pontos é
 *          scratch/build_brasileirao_dataset.py.
 * SEGREDOS: CEVEN_ADMIN_USER / CEVEN_ADMIN_PASS (variáveis de ambiente; nunca no código).
 * REGRA: nunca inventa dado. Se o CEVEN não responde, sai com erro e NÃO grava arquivo.
 * Uso: node scripts/coletar_plus_lideranca.js [dataInicio=2026-09-28] [dataFim=hoje em Brasília]
 */
const fs = require('fs');
const path = require('path');

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'scratch', 'plus_inputs.json');
const DB_PATH = process.env.PLUS_DB || path.join(RAIZ, 'analises', 'pedidos_historico_ceven.db');

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const INICIO = process.argv[2] || '2026-09-28'; // início oficial da temporada (decisão do Vitório)
const FIM = process.argv[3] || hojeBrasilia();

const norm = (n) => String(n || '').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();
const sigla = (f) => String(f || '').toUpperCase().replace(/1$/, '').slice(0, 3);

function feriados() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'diretrizes_operacionais.json'), 'utf8'));
    const lista = (cfg.calendario && (cfg.calendario.feriados_nacionais_2026 || cfg.calendario.feriados_nacionais)) || [];
    return new Set((Array.isArray(lista) ? lista : Object.keys(lista)).map((x) => String(x.data || x).slice(0, 10)));
  } catch { return new Set(); }
}

function diasUteis(ini, fim, fer) {
  const out = [];
  for (let d = new Date(ini + 'T12:00:00Z'); d <= new Date(fim + 'T12:00:00Z'); d = new Date(d.getTime() + 86400000)) {
    const iso = d.toISOString().slice(0, 10), w = d.getUTCDay();
    if (w >= 1 && w <= 5 && !fer.has(iso)) out.push(iso);
  }
  return out;
}

async function login() {
  const user = process.env.CEVEN_ADMIN_USER, pass = process.env.CEVEN_ADMIN_PASS;
  if (!user || !pass) throw new Error('segredos CEVEN_ADMIN_USER / CEVEN_ADMIN_PASS não configurados');
  const r = await fetch(`${CEVEN}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ username: user, password: pass }), signal: AbortSignal.timeout(20000)
  });
  if (!r.ok) throw new Error('login no CEVEN falhou (HTTP ' + r.status + ')');
  const j = await r.json();
  if (!j.access_token) throw new Error('login no CEVEN sem token');
  return j.access_token;
}

async function matriz(tk, tipo) {
  const r = await fetch(`${CEVEN}/api/admin/supervisores/${tipo}?dataInicio=${INICIO}&dataFim=${FIM}`, {
    headers: { Authorization: 'Bearer ' + tk, 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(60000)
  });
  if (!r.ok) throw new Error(`${tipo}: HTTP ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j.dias) || !Array.isArray(j.supervisores)) throw new Error(`${tipo}: formato inesperado (${Object.keys(j).join(',')})`);
  return j;
}

function devolucoesDoBanco(dias) {
  if (!fs.existsSync(DB_PATH)) return { disponivel: false, motivo: 'arquivo do banco não encontrado', porSupDia: {}, ate: null };
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  const cols = db.prepare('PRAGMA table_info(devolucoes_notas)').all().map((c) => c.name);
  const amostra = db.prepare('SELECT data_devolucao, filial_codigo, supervisor_nome FROM devolucoes_notas ORDER BY data_devolucao DESC LIMIT 2').all();
  console.log('devolucoes_notas: colunas =', cols.join(','), '| amostra (data, filial):', amostra.map((a) => `${a.data_devolucao}/${a.filial_codigo}`).join(' ; '));
  const ate = db.prepare('SELECT MAX(substr(data_devolucao,1,10)) AS m FROM devolucoes_notas').get().m;
  const rows = db.prepare(
    `SELECT filial_codigo, supervisor_nome, substr(data_devolucao,1,10) AS dia, COUNT(*) AS notas, SUM(vl_devolvido_total) AS valor
       FROM devolucoes_notas WHERE substr(data_devolucao,1,10) >= ? AND substr(data_devolucao,1,10) <= ?
      GROUP BY filial_codigo, supervisor_nome, substr(data_devolucao,1,10)`
  ).all(dias[0] || INICIO, FIM);
  const porSupDia = {};
  for (const r of rows) porSupDia[`${sigla(r.filial_codigo)}|${norm(r.supervisor_nome)}|${r.dia}`] = { notas: r.notas, valor: r.valor };
  return { disponivel: true, ate, porSupDia };
}

(async () => {
  const fer = feriados();
  const dias = diasUteis(INICIO, FIM, fer);
  const tk = await login();
  const [comp, ret] = await Promise.all([matriz(tk, 'matriz-compromissos'), matriz(tk, 'matriz-ret')]);

  const sup = {};
  const aplicar = (j, campo) => {
    for (const s of j.supervisores) {
      const chave = `${sigla(s.filial)}|${norm(s.nome)}`;
      const o = (sup[chave] = sup[chave] || { filial: sigla(s.filial), nome: s.nome, compromisso: {}, ret: {} });
      j.dias.forEach((d, i) => { o[campo][String(d).slice(0, 10)] = !!(s.porDia && s.porDia[i]); });
    }
  };
  aplicar(comp, 'compromisso');
  aplicar(ret, 'ret');

  const dev = devolucoesDoBanco(dias);
  const saida = {
    gerado_em: new Date().toISOString(), inicio: INICIO, fim: FIM, dias_uteis: dias,
    cevenDias: comp.dias, supervisores: sup, devolucoes: dev
  };
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify(saida));

  const n = Object.keys(sup).length;
  const feitos = Object.values(sup).reduce((a, s) => a + dias.filter((d) => s.compromisso[d]).length, 0);
  const rets = Object.values(sup).reduce((a, s) => a + dias.filter((d) => s.ret[d]).length, 0);
  console.log(`Plus: ${n} supervisores | dias úteis ${dias.join(', ')} | compromissos feitos ${feitos} | RET feitos ${rets} | devoluções ${dev.disponivel ? 'até ' + dev.ate : 'INDISPONÍVEIS (' + dev.motivo + ')'}`);
  console.log(`Plus: dias devolvidos pelo CEVEN: ${comp.dias.join(', ')}`);
})().catch((e) => { console.error('❌ coleta do Plus falhou:', e.message); process.exit(1); });
