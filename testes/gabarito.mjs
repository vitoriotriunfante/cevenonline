// GABARITO = a régua nova do JOTA (docs/CONTRATO_RESPOSTAS.md §6). 23/11/2026.
// Lê testes/gabarito_perguntas.json, pergunta SECO ao JOTA de produção (/api/jota-seco, nada enviado), calcula no D1 o número oficial
// da ficha do dicionário (docs/DICIONARIO_KPIS.md) e confere: (a) assunto, (b) números, (c) total = soma das linhas, (d) rodapé fonte+hora, (e) escopo.
// Uso: node testes/gabarito.mjs [--so=vendedor] [--caso=V01]     chave: env JOTA_CHAVE ou %TEMP%\.tk
// Saída: resumo na tela + saida_auditoria/GABARITO_<data>.json. Código 1 se (b),(c),(e) < 100% ou (a),(d) < 95%.
import fs from 'fs'; import path from 'path'; import { spawnSync } from 'child_process';
import { ehFeriado } from '../functions/_lib/feriados.js';

const SITE = 'https://ceven-cftv-matrix.pages.dev';
const CHAVE = (process.env.JOTA_CHAVE || (() => { try { return fs.readFileSync(path.join(process.env.TEMP || '', '.tk'), 'utf8'); } catch { return ''; } })()).trim();
if (!CHAVE) { console.error('sem chave: defina JOTA_CHAVE ou grave %TEMP%\\.tk'); process.exit(2); }
const ARG = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const CASOS = JSON.parse(fs.readFileSync(new URL('./gabarito_perguntas.json', import.meta.url), 'utf8')).casos
  .filter((c) => (!ARG.so || c.contato.papel === ARG.so) && (!ARG.caso || c.id === ARG.caso));

// ---------- D1 ----------
const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
const WR = fs.readdirSync(npxDir).map((d) => path.join(npxDir, d, 'node_modules/wrangler/bin/wrangler.js')).find((x) => fs.existsSync(x));
const CF_ENV = { ...process.env };
try {
  for (const linha of fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) CF_ENV[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2').trim();
  }
} catch {}
CF_ENV.CLOUDFLARE_ACCOUNT_ID = 'bd949e0c32a033372ff64b74521e2fe1';
const cacheSql = new Map();
function sql(q, semCache = false) {
  if (!semCache && cacheSql.has(q)) return cacheSql.get(q);
  const r = spawnSync(process.execPath, [WR, 'd1', 'execute', 'ceven_noc_d1', '--remote', '--json', '--command', q], { encoding: 'utf8', maxBuffer: 1 << 28, env: CF_ENV });
  const s = r.stdout || ''; let out;
  try { out = JSON.parse(s.slice(s.indexOf('[')))[0].results; } catch { throw new Error('D1 falhou: ' + q.slice(0, 120) + ' :: ' + (r.stderr || s).slice(0, 300)); }
  cacheSql.set(q, out); return out;
}
const esc = (s) => String(s).replace(/'/g, "''");
const J = (row) => { try { return JSON.parse(row.dados); } catch { return {}; } };
const agoraBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const HOJE = `${agoraBRT.getFullYear()}-${String(agoraBRT.getMonth() + 1).padStart(2, '0')}-${String(agoraBRT.getDate()).padStart(2, '0')}`;
const MES = HOJE.slice(0, 7);
const SEM_DIA_UTIL = agoraBRT.getDay() === 0 || ehFeriado(HOJE);
const FILIAIS = ['ABC', 'API', 'MCD', 'TBE', 'TBL', 'TCA', 'TCG', 'TCV', 'TPA', 'TPH', 'TSJ'];

console.log('carregando D1...');
const POSICAO = (sql('SELECT posicao FROM gerot_coleta_status ORDER BY id DESC LIMIT 1')[0] || {}).posicao || '';
const FIL = {}; for (const r of sql("SELECT mes, filial, dados FROM gerot_filial_mes WHERE mes >= '2026-08'")) (FIL[r.mes] = FIL[r.mes] || {})[r.filial] = J(r);
const VEND = {}; for (const r of sql(`SELECT mes, filial, rca, cod_sup, dados FROM gerot_vendedor_mes WHERE mes >= '2026-08'`)) { const k = `${r.mes}|${r.filial}|${String(+r.rca)}`; (VEND[k] = VEND[k] || []).push({ cod_sup: r.cod_sup, d: J(r) }); }
const CART = sql("SELECT filial, CAST(rca AS INTEGER) rca, situacao, count(*) n, sum(valor) v FROM gerot_carteira GROUP BY 1,2,3");
const GEST = JSON.parse(sql('SELECT conteudo_json FROM config_equipe_soberana')[0].conteudo_json);
const ARV = sql('SELECT filial, rca, sup_nome FROM arvore_supervisores');
const SUP_M = sql(`SELECT filial, cod_sup, supervisor FROM gerot_supervisor_mes WHERE mes = '${MES}'`);
const VEND_AT = sql(`SELECT filial, rca, cod_sup, supervisor, COALESCE(fat_liq,0) f, COALESCE(meta,0) m, COALESCE(carteira,0) c FROM gerot_vendedor_mes WHERE mes = '${MES}' AND rca NOT LIKE '%|%'`);
const LEIT_CLUBE = sql(`SELECT count(*) n, max(lido_em) l FROM clube_venda_dia WHERE dia = '${HOJE}'`)[0] || {};
const SEM_LEITURA_HOJE = !(LEIT_CLUBE.n > 0);

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const GEST_EFETIVO = (() => {
  const out = {}, supGrupo = {}, codToSup = {}, arvMap = {};
  for (const s of SUP_M) if (s.supervisor && s.cod_sup) codToSup[`${s.filial}|${s.cod_sup}`] = s.supervisor;
  for (const a of ARV) if (a.sup_nome) arvMap[`${a.filial}|${String(+a.rca)}`] = a.sup_nome;
  for (const [k, L] of Object.entries(GEST.filiais || {})) {
    const f = k.split('_')[0];
    out[f] = out[f] || [];
    for (const v of L || []) {
      if (!v || v.rca == null) continue;
      out[f].push(v);
      if (v.supervisor && v.grupo) supGrupo[`${f}|${norm(v.supervisor)}`] = v.grupo;
    }
  }
  const vistos = {};
  for (const f of FILIAIS) vistos[f] = new Set((out[f] || []).map((v) => String(+v.rca)));
  const gerotMelhores = new Map();
  for (const r of VEND_AT) {
    const rNum = /^\d+$/.test(String(r.rca).trim()) ? Number(r.rca) : NaN;
    if (!Number.isInteger(rNum) || rNum <= 0 || rNum === 2) continue;
    const f = r.filial, rN = String(rNum), k = `${f}|${rN}`;
    if (vistos[f] && vistos[f].has(rN)) continue;
    const peso = Math.abs(r.f || 0) + Math.abs(r.m || 0) + Math.abs(r.c || 0);
    const sup = String(r.supervisor || '').trim() || (r.cod_sup && codToSup[`${f}|${r.cod_sup}`]) || arvMap[k] || '';
    const prev = gerotMelhores.get(k);
    if (!prev || (!prev.sup && sup) || (!!sup === !!prev.sup && peso > prev.peso)) gerotMelhores.set(k, { f, rN, sup, peso });
  }
  for (const { f, rN, sup } of gerotMelhores.values()) {
    if (!sup) continue;
    out[f] = out[f] || [];
    out[f].push({ rca: rN, supervisor: sup, grupo: supGrupo[`${f}|${norm(sup)}`] || '' });
    if (vistos[f]) vistos[f].add(rN);
  }
  for (const a of ARV) {
    const rNum = /^\d+$/.test(String(a.rca).trim()) ? Number(a.rca) : NaN;
    if (!Number.isInteger(rNum) || rNum <= 0 || rNum === 2 || !a.sup_nome) continue;
    const f = a.filial, rN = String(rNum);
    if (vistos[f] && vistos[f].has(rN)) continue;
    out[f] = out[f] || [];
    out[f].push({ rca: rN, supervisor: a.sup_nome, grupo: supGrupo[`${f}|${norm(a.sup_nome)}`] || '' });
    if (vistos[f]) vistos[f].add(rN);
  }
  return out;
})();
const gest = (f) => GEST_EFETIVO[f] || [];
const rcasEquipe = (f, sup) => gest(f).filter((v) => norm(v.supervisor) === norm(sup)).map((v) => String(+v.rca));
const rcasGrupo = (f, g) => gest(f).filter((v) => norm(v.grupo) === norm(g)).map((v) => String(+v.rca));
const somaV = (mes, f, rcas, campo) => rcas.reduce((s, r) => s + (VEND[`${mes}|${f}|${r}`] || []).reduce((a, x) => a + (+x.d[campo] || 0), 0), 0);
const campoV = (mes, f, rca, campo) => somaV(mes, f, [String(+rca)], campo);
const cart = (f, rcas, filtro) => CART.filter((c) => (!f || c.filial === f) && (!rcas || rcas.includes(String(c.rca))) && filtro(c.situacao || '')).reduce((a, c) => ({ v: a.v + (c.v || 0), n: a.n + c.n }), { v: 0, n: 0 });
const bloq = (s) => /^Bloqueado/i.test(s), todos = () => true;
const posRegra4 = (f, rcas) => (sql(`SELECT count(*) n FROM (SELECT coalesce(cnpj, cliente) k, sum(json_extract(dados, '$."Faturado líquido (R$)"')) s FROM gerot_cliente_mes WHERE mes = '${MES}' AND filial = '${f}'${rcas ? ` AND CAST(rca AS INTEGER) IN (${rcas.map(Number).join(',') || -1})` : ''} GROUP BY k) WHERE s > 0`)[0] || {}).n || 0;
const F = (mes, f, campo) => +((FIL[mes] || {})[f] || {})[campo] || 0;
const rs = (rotulo, valor) => ({ rotulo, valor, tipo: 'rs' }), n = (rotulo, valor) => ({ rotulo, valor, tipo: 'n' }), pc = (rotulo, frac) => ({ rotulo, valor: frac * 100, tipo: 'pct' });

// ---------- verificações (fichas do dicionário) ----------
const V = {
  fat_liq_vendedor_mes: (p) => [rs('faturado líquido (3.1)', campoV(p.mes || MES, p.filial, p.rca, 'Faturado líquido (R$)'))],
  fechamento_vendedor_mes: (p) => [rs(`faturado líquido ${p.mes} (3.26)`, campoV(p.mes, p.filial, p.rca, 'Faturado líquido (R$)'))],
  meta_vendedor_mes: (p) => [rs('meta R$ (3.4)', campoV(MES, p.filial, p.rca, 'Meta (R$)'))],
  necessidade_vendedor: (p) => [rs('necessidade dia captação (3.8)', campoV(MES, p.filial, p.rca, 'Necessidade dia captação (R$)'))],
  positivacao_vendedor: (p) => [n('positivação (3.9)', campoV(MES, p.filial, p.rca, 'Positivação (filial + CNPJ)'))],
  devolucao_vendedor_mes: (p) => [rs('devolução (3.3)', campoV(MES, p.filial, p.rca, 'Devolução (R$)'))],
  cortes_vendedor_mes: (p) => [rs('cortes total (3.21)', campoV(MES, p.filial, p.rca, 'Cortes total (R$)'))],
  carteira_vendedor: (p) => { const c = cart(p.filial, [String(+p.rca)], todos); return [rs('carteira pendente (3.12)', c.v)]; },
  bloq_vendedor: (p) => { const c = cart(p.filial, [String(+p.rca)], bloq); return c.n ? [rs('bloqueados R$ (3.11)', c.v), n('bloqueados qtd', c.n)] : []; },
  recorrencia_nivel: (p) => {
    let rows = sql(`SELECT * FROM gerot_recorrencia_pasta WHERE mes = '${MES}' AND filial = '${p.filial}' AND nivel = '${p.nivel}' AND ${p.cod ? `cod = '${esc(p.cod)}'` : `upper(nome) LIKE '%${esc(norm(p.nome))}%'`} ORDER BY em DESC`);
    if (p.nivel === 'vendedor') { const sup = ((VEND[`${MES}|${p.filial}|${+p.cod}`] || [])[0] || {}).cod_sup; rows = rows.filter((r) => r.sup === sup).concat(rows).slice(0, 1); }
    const r = rows[0]; return r ? [n('recorrência objetivo (3.18)', r.objetivo), n('recorrência meta', r.meta), n('recorrência positivados', r.positivados)] : [];
  },
  fat_liq_equipe: (p) => [rs('faturado da equipe Gestão (3.1)', somaV(MES, p.filial, rcasEquipe(p.filial, p.supervisor), 'Faturado líquido (R$)'))],
  positivacao_equipe: (p) => [n('positivação da equipe, regra 4 (3.9)', posRegra4(p.filial, rcasEquipe(p.filial, p.supervisor)))],
  bloq_equipe: (p) => { const c = cart(p.filial, rcasEquipe(p.filial, p.supervisor), bloq); return [rs('bloqueados equipe R$ (3.11)', c.v), n('bloqueados equipe qtd', c.n)]; },
  fat_liq_filial_mes: (p) => [rs('faturado líquido filial (3.1)', F(MES, p.filial, 'Faturado líquido (R$)'))],
  fechamento_filial_mes: (p) => [rs(`faturado líquido filial ${p.mes} (3.26)`, F(p.mes, p.filial, 'Faturado líquido (R$)'))],
  meta_filial_mes: (p) => [rs('meta filial (3.4)', F(MES, p.filial, 'Meta (R$)'))],
  carteira_total_filial: (p) => [rs('carteira pendente filial (3.12)', F(MES, p.filial, 'Carteira pendente (R$)'))],
  positivacao_filial: (p) => [n('positivação filial (3.9)', F(MES, p.filial, 'Positivação (filial + CNPJ)'))],
  devolucao_filial_mes: (p) => [rs('devolução filial (3.3)', F(MES, p.filial, 'Devolução (R$)'))],
  margem_filial: (p) => [rs('margem R$ filial (3.20)', F(MES, p.filial, 'Margem de contribuição (R$)'))],
  ritmo_filial: (p) => [pc('% meta ideal captação (3.7)', F(MES, p.filial, '% Meta Ideal captação'))],
  bloq_total_filial: (p) => { const c = cart(p.filial, null, bloq); return [rs('bloqueados filial R$ (3.11)', c.v), n('bloqueados filial qtd', c.n)]; },
  fat_liq_grupo: (p) => [rs(`faturado grupo ${p.grupo} (3.1)`, somaV(MES, p.filial, rcasGrupo(p.filial, p.grupo), 'Faturado líquido (R$)'))],
  positivacao_grupo: (p) => [n(`positivação grupo ${p.grupo}, regra 4 (3.9)`, posRegra4(p.filial, rcasGrupo(p.filial, p.grupo)))],
  bloq_comercial_filial: (p) => { const c = cart(p.filial, p.grupo ? rcasGrupo(p.filial, p.grupo) : null, (s) => /Comercial/i.test(s)); return [rs('bloqueado comercial R$ (3.11)', c.v), n('bloqueado comercial qtd', c.n)]; },
  bloq_total_grupo: (p) => { const c = cart(p.filial, rcasGrupo(p.filial, p.grupo), bloq); return [rs(`bloqueados grupo ${p.grupo} R$`, c.v), n('bloqueados grupo qtd', c.n)]; },
  margem_grupo: (p) => [rs(`margem R$ grupo ${p.grupo} (3.20)`, somaV(MES, p.filial, rcasGrupo(p.filial, p.grupo), 'Margem de contribuição (R$)'))],
  devolucao_grupo: (p) => [rs(`devolução grupo ${p.grupo} (3.3)`, somaV(MES, p.filial, rcasGrupo(p.filial, p.grupo), 'Devolução (R$)'))],
  fat_liq_brasil_mes: () => [rs('faturado líquido Brasil (3.1)', FILIAIS.reduce((s, f) => s + F(MES, f, 'Faturado líquido (R$)'), 0))],
  positivacao_brasil: () => [n('positivação Brasil (3.9)', FILIAIS.reduce((s, f) => s + F(MES, f, 'Positivação (filial + CNPJ)'), 0))],
  devolucao_brasil: () => [rs('devolução Brasil (3.3)', FILIAIS.reduce((s, f) => s + F(MES, f, 'Devolução (R$)'), 0))],
  bloq_total_brasil: () => { const c = cart(null, null, bloq); return [rs('bloqueados Brasil R$ (3.11)', c.v), n('bloqueados Brasil qtd', c.n)]; },
  bloq_por_filial: () => FILIAIS.map((f) => cart(f, null, bloq)).map((c, i) => c.n ? rs(`bloqueados ${FILIAIS[i]}`, c.v) : null).filter(Boolean),
  margem_por_filial: () => FILIAIS.map((f) => rs(`margem ${f}`, F(MES, f, 'Margem de contribuição (R$)'))),
  fat_liq_por_filial: () => FILIAIS.map((f) => rs(`faturado ${f}`, F(MES, f, 'Faturado líquido (R$)'))),
  desvio_brasil: () => { const r = sql(`SELECT fat_liq, meta FROM gerot_desvio_mes WHERE mes = '${MES}' AND nivel = 'brasil' LIMIT 1`)[0]; return r ? [rs('faturado desvio Brasil', r.fat_liq), rs('meta desvio Brasil', r.meta)] : []; },
  desvio_vendedor: (p) => { const r = sql(`SELECT fat_liq, meta FROM gerot_desvio_mes WHERE mes = '${MES}' AND nivel = 'vendedor' AND filial = '${p.filial}' AND CAST(cod AS INTEGER) = ${+p.rca} LIMIT 1`)[0]; return r ? [rs('faturado desvio vendedor', r.fat_liq), rs('meta desvio vendedor', r.meta)] : []; },
  curva_neg_brasil: () => { const r = sql(`SELECT COUNT(*) n, COALESCE(SUM(margem_rs), 0) m FROM gerot_curva_neg_margem WHERE mes = '${MES}'`)[0]; return r ? [n('pedidos curva neg Brasil', r.n), rs('margem neg Brasil', r.m)] : []; },
  // dia (Clube): só confere quando há leitura de hoje; aceita as duas somas do Clube (3.13 ainda em decisão)
  clube_dia: (p) => {
    const w = [p.filial && `filial = '${p.filial}'`, p.rca && `CAST(rca AS INTEGER) = ${+p.rca}`, p.supervisor && `CAST(rca AS INTEGER) IN (${rcasEquipe(p.filial, p.supervisor).map(Number).join(',') || -1})`, p.grupo && `CAST(rca AS INTEGER) IN (${rcasGrupo(p.filial, p.grupo).map(Number).join(',') || -1})`].filter(Boolean);
    // 23/11/2026: o Clube e lido a cada ~15 min; o valor certo e o da hora da resposta. Mede antes (p._antes) e depois da pergunta, sem cache, e aceita a faixa
    const le = () => { const a = sql(`SELECT sum(total_pedido) v FROM clube_venda_dia WHERE dia = '${HOJE}'${w.length ? ' AND ' + w.join(' AND ') : ''}`, true)[0] || {}; const b = sql(`SELECT sum(total) v FROM clube_pedido WHERE dia = '${HOJE}'${w.length ? ' AND ' + w.join(' AND ') : ''}`, true)[0] || {}; return [a.v || 0, b.v || 0]; };
    const depois = le(), antes = p._antes || depois;
    return [{ rotulo: 'pedido colocado hoje (3.13)', tipo: 'rs', alternativas: [...depois, ...antes], faixas: [[Math.min(antes[0], depois[0]), Math.max(antes[0], depois[0])], [Math.min(antes[1], depois[1]), Math.max(antes[1], depois[1])]] }];
  },
};

// ---------- leitura dos números da resposta ----------
function numeros(txt) {
  const out = []; const re = /(-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?)(\s*(?:mi\b|milh[õo]es|milh[ãa]o|mil\b|k\b))?(\s*%)?/gi; let m;
  while ((m = re.exec(txt))) {
    const s = m[1], dec = (s.split(',')[1] || '').length; let v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    const suf = (m[2] || '').trim().toLowerCase(), mult = /^mi|milh/.test(suf) ? 1e6 : /^(mil|k)/.test(suf) ? 1e3 : 1;
    out.push({ v: v * mult, prec: 0.5 * Math.pow(10, -dec) * mult, pct: !!m[3] });
  }
  return out;
}
function acha(esperado, toks) {
  const alvos = esperado.alternativas || [esperado.valor];
  if (esperado.faixas && toks.some((t) => !t.pct && esperado.faixas.some(([a, b]) => t.v >= a - Math.max(t.prec, 1.01) && t.v <= b + Math.max(t.prec, 1.01)))) return true;
  return alvos.some((alvo) => toks.some((t) => {
    if (esperado.tipo === 'pct') return t.pct && Math.abs(t.v - alvo) <= Math.max(t.prec, 0.1) + 0.06;
    if (t.pct) return false;
    if (esperado.tipo === 'n') return Math.abs(t.v - alvo) <= Math.max(t.prec, 0.5);
    return Math.abs(Math.abs(t.v) - Math.abs(alvo)) <= Math.max(t.prec, 1.01, Math.abs(alvo) * 0.00005);   /* 0,005%: carga do GEROT que mudou centavos entre a resposta e o SELECT */
  })) || (alvos.every((a) => !a) && /nenhum|sem pedido|n[ãa]o h[áa]/i.test(toks.texto || ''));
}
const fmt = (v) => (v == null ? '-' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));

// (c) blocos "Por x:" com bullets: soma do 1º R$ de cada linha = algum R$ antes do bloco
function checaLinhas(resp) {
  const ls = resp.split('\n'), achados = [];
  for (let i = 0; i < ls.length; i++) {
    if (!/^\W*(por|aberto por)\s+(filial|filiais|supervisor|supervisores|vendedor|vendedores|grupo|gerente)\b/i.test(ls[i].replace(/[*_]/g, ''))) continue;
    const linhas = []; let j = i + 1, cortado = false;
    for (; j < ls.length && ls[j].trim(); j++) { if (/e mais \d+/i.test(ls[j])) { cortado = true; break; } if (/^\s*[•\-▪·]/.test(ls[j])) linhas.push(ls[j]); }
    if (cortado || !linhas.length) continue;
    const vals = linhas.map((l) => { const m = l.match(/R\$\s*(-?[\d.,]+\s*(?:mi|mil)?)/i); return m ? numeros(m[1])[0] : null; });
    if (vals.some((x) => !x)) continue;
    const soma = vals.reduce((s, x) => s + x.v, 0), tol = vals.reduce((s, x) => s + x.prec, 0) + 1.01;
    const antes = ls.slice(0, i).join('\n'), cabeca = [...antes.matchAll(/R\$\s*(-?[\d.,]+\s*(?:mi|mil)?)/gi)].map((m) => numeros(m[1])[0]).filter(Boolean);
    const ok = cabeca.some((t) => Math.abs(t.v - soma) <= tol + t.prec);
    achados.push({ bloco: ls[i].replace(/[*_]/g, '').trim(), linhas: linhas.length, soma: Math.round(soma), ok, cabeca: cabeca.slice(0, 4).map((t) => Math.round(t.v)) });
  }
  return achados;
}
const RODAPE = /(GEROT|Clube|CEVEN admin|CEVEN|Liga|Carteira Total|Fonte)[^\n]{0,160}?(\d{1,2}:\d{2}|\d{2}\/\d{2})/i;
const AVISO_DIA = /domingo|feriado|sem rota hoje|último dia útil|ultimo dia util|sábado|sabado|sexta/i;
const AVISO_SEM_LEITURA = /aguardando|sem leitura|ainda n[ãa]o (foi |há |tem )?(lid|leitura)|1[ªa] leitura|primeira leitura|não lido/i;
const FORA_ESCOPO = /n[ãa]o (é|e) d[ao] sua equipe|fora d[oa] seu escopo|n[ãa]o (faz parte|pertence)|n[ãa]o tenho acesso|sem acesso|n[ãa]o (é|e) da sua filial|s[óo] (posso|consigo) (mostrar|responder).{0,40}(sua|seu)/i;

function escopo(caso, resp) {
  const c = caso.contato, prob = [];
  if (caso.fora_escopo) { if (!FORA_ESCOPO.test(resp)) prob.push('pergunta fora do escopo sem o aviso "não é da sua equipe"'); if (/R\$\s*[1-9]/.test(resp)) prob.push('deu R$ de quem está fora do escopo'); return prob; }
  if (c.papel === 'diretoria' || caso.escopo_livre) return prob;
  const outras = FILIAIS.filter((f) => f !== c.filial && new RegExp(`\\b${f}\\b`).test(resp));
  if (outras.length) prob.push('cita filial fora do escopo: ' + outras.join(','));
  let ok = null;
  if (c.papel === 'vendedor') ok = new Set([String(+c.rca)]);
  else if (c.papel === 'supervisor') ok = new Set(rcasEquipe(c.filial, c.nome));
  else if (c.papel === 'gerente' && c.grupo) ok = new Set(rcasGrupo(c.filial, c.grupo));
  if (ok && ok.size) {
    const fora = [...resp.matchAll(/(sup\.?\s*|supervisor[a]?:?\s*)?(?:^|[•\n(]\s*|\s)(\d{1,4}) - [A-ZÀ-Úa-zà-ú]{3}/gi)].filter((m) => !m[1]).map((m) => String(+m[2])).filter((r) => !ok.has(r));   /* "sup. 103 - Nome" = o próprio supervisor, não é vendedor */
    if (fora.length) prob.push('vendedor fora do escopo: ' + [...new Set(fora)].slice(0, 6).join(','));
  }
  if (c.papel === 'gerente' && c.grupo) {
    const meus = new Set(gest(c.filial).filter((v) => norm(v.grupo) === norm(c.grupo)).map((v) => norm(v.supervisor)));
    const outros = [...new Set(gest(c.filial).filter((v) => v.grupo && norm(v.grupo) !== norm(c.grupo)).map((v) => norm(v.supervisor)))].filter((s) => s && !meus.has(s));
    const R = norm(resp); const vistos = outros.filter((s) => { const p = s.split(' '); return p.length > 1 && R.includes(p[0] + ' ' + p[1]); });
    if (vistos.length) prob.push('supervisor do outro grupo: ' + vistos.join(', '));
  }
  return prob;
}

// ---------- perguntar ----------
async function perguntar(caso, i) {
  const contato = { ...caso.contato, celular: `55000${String(Date.now() % 1e6).padStart(6, '0')}${String(i).padStart(3, '0')}` };
  if (contato.papel === 'diretoria') contato.filiais = [];
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`${SITE}/api/jota-seco`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-chave': CHAVE }, body: JSON.stringify({ contato, perguntas: [caso.pergunta] }), signal: AbortSignal.timeout(240000) });
      const j = await r.json(); if (Array.isArray(j)) return String(j[0]?.resposta ?? '');
      if (t === 2) return 'ERRO: ' + JSON.stringify(j).slice(0, 200);
    } catch (e) { if (t === 2) return 'ERRO: ' + e.message; }
  }
}

function avaliar(caso, resp) {
  const r = { a: true, b: true, c: true, d: true, e: true }, motivos = [];
  const vazio = !resp.trim() || /^ERRO/.test(resp);
  if (vazio) { motivos.push({ c: 'a', m: 'resposta vazia/erro: ' + resp.slice(0, 120) }); return { r: { a: false, b: false, c: false, d: false, e: true }, motivos, esperados: [] }; }
  const ehDia = !!caso.dia, toks = numeros(resp.replace(/\b\d{1,2}\/\d{2}(\/\d{2,4})?\b|\b\d{1,2}:\d{2}\b/g, ' ')); toks.texto = resp;
  // (a)
  if (ehDia && SEM_DIA_UTIL) { if (!AVISO_DIA.test(resp)) { r.a = false; motivos.push({ c: 'a', m: 'pergunta do dia sem o aviso de domingo/feriado' }); } }
  else if (ehDia && SEM_LEITURA_HOJE) { if (!AVISO_SEM_LEITURA.test(resp) && !AVISO_DIA.test(resp)) { r.a = false; motivos.push({ c: 'a', m: 'dia sem leitura do Clube e a resposta não diz "aguardando a 1ª leitura"' }); } if (/(digitado|pedido|venda)[^\n]{0,30}R\$\s*0(?![\d.,])/i.test(resp)) { r.b = false; motivos.push({ c: 'b', m: 'mostra R$ 0 do dia sem leitura do Clube (sem dado ≠ zero)' }); } }
  else if (caso.assunto && !new RegExp(caso.assunto, 'i').test(resp)) { r.a = false; motivos.push({ c: 'a', m: `assunto esperado /${caso.assunto}/` }); }
  if (caso.proibido && new RegExp(caso.proibido, 'i').test(resp)) { r.a = false; motivos.push({ c: 'a', m: `proibido /${caso.proibido}/ apareceu` }); }
  // (b)
  const esperados = [];
  const diaSemNumero = ehDia && (SEM_DIA_UTIL || SEM_LEITURA_HOJE);
  for (const ch of caso.checagens || []) {
    if (diaSemNumero && ch.id === 'clube_dia') continue;
    let es; try { es = V[ch.id](ch.p || {}); } catch (e) { motivos.push({ c: 'b', m: `verificação ${ch.id} falhou no D1: ${e.message.slice(0, 80)}` }); r.b = false; continue; }
    for (const e of es) { const ok = acha(e, toks); esperados.push({ ...e, ok }); if (!ok) { r.b = false; motivos.push({ c: 'b', m: `${e.rotulo}: esperado ${e.tipo === 'pct' ? fmt(e.valor) + '%' : (e.tipo === 'rs' ? 'R$ ' : '') + (e.valor != null ? fmt(e.valor) : e.alternativas.map(fmt).join(' ou '))} (${ch.id})` }); } }
  }
  // (c)
  const blocos = checaLinhas(resp);
  for (const b of blocos) if (!b.ok) { r.c = false; motivos.push({ c: 'c', m: `"${b.bloco}": soma das ${b.linhas} linhas R$ ${fmt(b.soma)} ≠ total (${b.cabeca.map(fmt).join(' / ')})` }); }
  if (caso.linhas && !diaSemNumero && !blocos.length && !/e mais \d+/i.test(resp) && !esperados.every((e) => !e.valor)) { r.c = false; motivos.push({ c: 'c', m: 'contrato pede total + linhas que fecham; resposta sem linhas' }); }
  // (d)
  if (caso.rodape !== false && !caso.fora_escopo && !diaSemNumero && !RODAPE.test(resp.split('\n').slice(-6).join('\n'))) { r.d = false; motivos.push({ c: 'd', m: 'sem rodapé com fonte e hora' }); }
  // (e)
  for (const p of escopo(caso, resp)) { r.e = false; motivos.push({ c: 'e', m: p }); }
  return { r, motivos, esperados };
}

// ---------- rodar ----------
console.log(`hoje ${HOJE} · GEROT "${POSICAO}" · Clube hoje: ${SEM_LEITURA_HOJE ? 'sem leitura' : LEIT_CLUBE.l}${SEM_DIA_UTIL ? ' · DOMINGO/FERIADO' : ''} · ${CASOS.length} casos`);
const res = []; let prox = 0;
async function trab() { while (prox < CASOS.length) { const i = prox++, caso = CASOS[i]; const t0 = Date.now(); for (const ch of caso.checagens || []) if (ch.id === 'clube_dia' && !SEM_DIA_UTIL && !SEM_LEITURA_HOJE) { try { const w = { ...(ch.p || {}) }; const r = V.clube_dia(w)[0]; ch.p = { ...(ch.p || {}), _antes: r.alternativas.slice(0, 2) }; } catch (e) { /* sem D1 */ } } const resp = await perguntar(caso, i); const av = avaliar(caso, resp); res[i] = { caso, resp, ms: Date.now() - t0, ...av }; process.stdout.write(`\r${res.filter(Boolean).length}/${CASOS.length}`); } }
await Promise.all(Array.from({ length: 3 }, trab));
console.log();

const CRIT = ['a', 'b', 'c', 'd', 'e'], NOME = { a: 'assunto', b: 'números', c: 'total=linhas', d: 'rodapé', e: 'escopo' };
const nota = (lista) => Object.fromEntries(CRIT.map((k) => [k, lista.length ? Math.round(1000 * lista.filter((x) => x.r[k]).length / lista.length) / 10 : null]));
const geral = nota(res), porPapel = {};
for (const p of ['vendedor', 'supervisor', 'gerente', 'gerente_grupo', 'diretoria']) {
  const l = res.filter((x) => p === 'gerente_grupo' ? x.caso.contato.papel === 'gerente' && x.caso.contato.grupo : p === 'gerente' ? x.caso.contato.papel === 'gerente' && !x.caso.contato.grupo : x.caso.contato.papel === p);
  if (l.length) porPapel[p] = { casos: l.length, aprovados: l.filter((x) => CRIT.every((k) => x.r[k])).length, ...nota(l) };
}
const PESO = { e: 5, b: 4, c: 3, a: 2, d: 1 };
const falhas = res.filter((x) => x.motivos.length).map((x) => ({ id: x.caso.id, papel: x.caso.contato.papel + (x.caso.contato.grupo ? '/' + x.caso.contato.grupo : ''), quem: `${x.caso.contato.nome} ${x.caso.contato.filial || ''}${x.caso.contato.rca ? ' ' + x.caso.contato.rca : ''}`, linha: x.caso.linha, pergunta: x.caso.pergunta, gravidade: x.motivos.reduce((s, m) => s + PESO[m.c], 0), criterios: [...new Set(x.motivos.map((m) => m.c))], motivos: x.motivos.map((m) => `(${m.c}) ${m.m}`), resposta: x.resp.slice(0, 700) })).sort((a, b) => b.gravidade - a.gravidade);
const passou = geral.b === 100 && geral.c === 100 && geral.e === 100 && geral.a >= 95 && geral.d >= 95;

console.log('\n=== GABARITO ' + HOJE + ' ===');
console.log('GERAL  ' + CRIT.map((k) => `${NOME[k]} ${geral[k]}%`).join(' · ') + ` · casos aprovados ${res.filter((x) => CRIT.every((k) => x.r[k])).length}/${res.length}`);
for (const [p, v] of Object.entries(porPapel)) console.log(`${p.padEnd(14)} ${v.aprovados}/${v.casos} · ` + CRIT.map((k) => `${k} ${v[k]}%`).join(' · '));
console.log('\n15 falhas mais graves:');
for (const f of falhas.slice(0, 15)) console.log(`- [${f.id}] ${f.papel} ${f.quem} · "${f.pergunta}"\n    ${f.motivos.join('\n    ')}\n    resp: ${f.resposta.replace(/\n+/g, ' ⏎ ').slice(0, 220)}`);
console.log(passou ? '\nPASSOU: pode publicar' : '\nNÃO PASSOU: (b),(c),(e) precisam 100% e (a),(d) 95%');
fs.mkdirSync('saida_auditoria', { recursive: true });
const arq = `saida_auditoria/GABARITO_${HOJE}_${String(agoraBRT.getHours()).padStart(2, '0')}${String(agoraBRT.getMinutes()).padStart(2, '0')}.json`;
fs.writeFileSync(arq, JSON.stringify({ hoje: HOJE, posicao_gerot: POSICAO, clube_hoje: SEM_LEITURA_HOJE ? null : LEIT_CLUBE.l, domingo_feriado: SEM_DIA_UTIL, geral, porPapel, passou, falhas, todos: res.map((x) => ({ id: x.caso.id, pergunta: x.caso.pergunta, r: x.r, esperados: x.esperados, ms: x.ms, resposta: x.resp })) }, null, 1));
console.log('relatório: ' + arq);
process.exit(passou ? 0 : 1);
