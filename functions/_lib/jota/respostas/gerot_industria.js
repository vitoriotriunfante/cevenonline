// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/jota/respostas/gerot_industria.js
// O QUE É: resposta do JOTA para INDÚSTRIA, lendo só o D1 gerot_vendas (coleta online do GEROT, número oficial).
//   Decisão do Vitório (semana de 02/11/2026): indústria vem do GEROT. Pedido do Rudinei (05 e 09/11/2026): indústria por filial,
//   supervisor e vendedor, com META, faturado, carteira e positivação, no MÊS pedido, e os vendedores SEM VENDA.
//   Ver docs/GEROT_ESTADO_E_PLANO.md (testes obrigatórios na seção 5; testes/gerot_industria.mjs).
// Regras: nunca inventa; escopo por papel (diretoria/ceo = Brasil; gerente = filial; supervisor = equipe; vendedor = ele);
//   listas numeradas; a indústria é reconhecida por PALAVRA INTEIRA (nunca "contém", que casou Condor com Aeroflex em 09/11).
// =========================================================================
import { R$, sem, titulo, nome2, FILIAIS, hojeSP } from '../base.js';
import { DE_PARA_INDUSTRIAS } from '../dicionario_industrias.js';

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const GENERICAS = new Set(['BRASIL', 'BRAZIL', 'LTDA', 'IND', 'INDUSTRIA', 'INDUSTRIAS', 'COMERCIO', 'COMERCIAL', 'ALIMENTOS', 'DISTRIBUIDORA', 'PRODUTOS', 'DO', 'DA', 'DE', 'E', 'S', 'SA', 'S.A.', 'EIRELI', 'ME', 'EPP', 'GRUPO', 'CIA', 'BEBIDAS', 'COSMETICOS', 'HIGIENE']);
const F = (d, k) => { const v = d && d[k]; return typeof v === 'number' ? v : (v == null || v === '' ? null : Number(v)); };
const palavra = (t, w) => new RegExp(`(^|[^A-Z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z0-9]|$)`).test(t);
export const limpaNome = (n) => String(n || '').replace(/^[A-Z]\s*-\s*\d?\s*/, '').replace(/\.{2,}.*$/, '').trim();

// nomes "chave" de cada indústria do GEROT: as 2 primeiras palavras que não são genéricas (CONDOR, MONDELEZ, SUPER FOODS...)
export function chavesDe(nome) {
  const ws = sem(limpaNome(nome)).split(/[^A-Z0-9&]+/).filter((w) => w.length >= 3 && !GENERICAS.has(w));
  return ws.slice(0, 2);
}
// "TRIUNFANTE" sozinho é o grupo (todas as filiais), não a Marca Própria: a MP só entra pelo apelido (mp, marca própria)
const SO_POR_APELIDO = new Set(['TRIUNFANTE']);

// interpreta a pergunta (função pura: testada em testes/gerot_industria.mjs)
// nomes = lista de nomes de fornecedor do GEROT (ex.: 'A - CONDOR SA'); anterior = filtros da pergunta anterior (continuação)
export function entendeGerot(texto, nomes, hoje = hojeSP(), anterior = null) {
  const t = ' ' + sem(texto).replace(/\s+/g, ' ').replace(/\bCOTAS?\b/g, 'META') + ' ';   // COTA = META (09/11/2026)
  if (/^\s*\d{1,2}([.,]\d{1,2})?\s*$/.test(t) || /\bPAINEL\b/.test(t)) return null;   // numero do menu/painel e o PAINEL DAS INDUSTRIAS (10/11/2026) nao sao pergunta de industria
  // indústria: apelido do dicionário (palavra inteira, 3+ letras) ou chave do nome no GEROT
  const achadas = new Set();
  for (const [ap, razao] of Object.entries(DE_PARA_INDUSTRIAS)) {
    const a = sem(ap); if (a.length < 3 || !palavra(t, a)) continue;
    const k = chavesDe(razao)[0]; if (!k) continue;
    nomes.filter((n) => chavesDe(n)[0] === k).forEach((n) => achadas.add(n));
  }
  for (const n of nomes) { const k = chavesDe(n)[0]; if (k && k.length >= 4 && !SO_POR_APELIDO.has(k) && palavra(t, k)) achadas.add(n); }
  // mesma 1ª palavra em nomes diferentes (SUPER FOODS x SUPER SAUDE): se a 2ª palavra de algum estiver na frase, fica só ele
  { const porK = new Map(); for (const n of achadas) { const k = chavesDe(n)[0]; if (!porK.has(k)) porK.set(k, []); porK.get(k).push(n); }
    for (const ns of porK.values()) { if (ns.length < 2) continue; const com2 = ns.filter((n) => { const k2 = chavesDe(n)[1]; return k2 && palavra(t, k2); }); if (com2.length) ns.filter((n) => !com2.includes(n)).forEach((n) => achadas.delete(n)); } }
  const industrias = [...achadas];
  const porIndustria = /INDUSTRI|FORNECEDOR/.test(t);
  if (!industrias.length && !porIndustria && !(anterior && /^\W*\w+\W*$/.test(sem(texto)))) return null;   // não é pergunta de indústria
  // so resultado da industria (venda, meta, faturado...). "+mix oreo", "quem compra oreo", cliente, SKU continuam no +MIX/ficha
  const soNome = /^\W*[A-Z0-9& ]{2,30}\W*$/.test(sem(texto)) && industrias.length && !!anterior;
  if (/\+ ?MIX|\bMIX\b|QUEM COMPRA|QUEM COMPROU|QUEM PAROU|CLIENTES? |\bSKU|PRODUTO|O QUE OFERECER|#\d/.test(t) && !porIndustria) return null;
  if (!soNome && !porIndustria && !/VENDA|VENDE|VENDID|META|FATUR|POSITIV|RESULTAD|COMO (ESTA|TA|ANDA|VAI)|PERFORMANCE|DESEMPENHO|CARTEIRA|ATINGI|NUMEROS|SITUACAO/.test(t)) return null;
  // filiais citadas
  const filiais = FILIAIS.filter((f) => palavra(t, f));
  const todasFiliais = /TODAS AS FILIAIS|CADA FILIAL|POR FILIAL|DAS FILIAIS|\bFILIAIS\b|\bBRASIL\b|GRUPO|TRIUNFANTE/.test(t);
  // mês
  const [ay, am] = hoje.split('-').map(Number);
  let mes = null;
  const mi = MESES.findIndex((m) => palavra(t, m) || (m === 'MARCO' && palavra(t, 'MARÇO')));
  if (mi >= 0) { const y = mi + 1 > am ? ay - 1 : ay; mes = `${y}-${String(mi + 1).padStart(2, '0')}`; }
  else if (/MES PASSADO|MES ANTERIOR|ULTIMO MES/.test(t)) { const d = new Date(Date.UTC(ay, am - 2, 1)); mes = d.toISOString().slice(0, 7); }
  // recorte
  const temV = /VENDEDOR|POR RCA|\bRCA\b/.test(t), temS = /SUPERVISOR/.test(t);
  let recorte = temV && temS ? 'supervisor_vendedor' : temV ? 'vendedor' : temS ? 'supervisor' : (todasFiliais || /FILIAIS|POR FILIAL|CADA FILIAL/.test(t)) ? 'filial' : null;
  const zerados = /ZERAD|VENDA ZERO|SEM VENDA|NAO VENDE|NAO VENDEU|COM VENDA ZERO/.test(t);
  const q = { industrias, porIndustria: porIndustria && !industrias.length, filiais, todasFiliais, mes, recorte, zerados };
  if (anterior) {   // continuação: "CONDOR" sozinho, "e de outubro?", "por vendedor"
    if (!q.industrias.length && !q.porIndustria) { q.industrias = anterior.industrias || []; q.porIndustria = !!anterior.porIndustria; }
    if (!q.filiais.length && !q.todasFiliais) { q.filiais = anterior.filiais || []; q.todasFiliais = !!anterior.todasFiliais; }
    if (!q.mes) q.mes = anterior.mes || null;
    if (!q.recorte) q.recorte = anterior.recorte || null;
    if (!q.industrias.length && !q.porIndustria) return null;
  }
  return q;
}

// escopo por papel: o que a pessoa pode ver
function escopo(c) {
  const p = String((c && c.papel) || '').toLowerCase();
  if (p === 'diretoria' || p === 'ceo') return { tudo: true };
  if (p === 'gerente') return { filial: c.filial };
  if (p === 'supervisor') return { filial: c.filial, sup: c.rca || null, supNome: c.supervisor || c.nome };
  if (p === 'vendedor') return { filial: c.filial, rca: c.rca };
  return { nada: true };
}

const linhaKpi = (meta, fat, cart, pos) => [
  `💰 Meta: *${R$(meta)}*`,
  `✅ Faturado: *${R$(fat)}*${meta ? ` (${(fat / meta * 100).toFixed(1).replace('.', ',')}%)` : ''}`,
  ...(cart != null ? [`⏳ Carteira pendente: ${R$(cart)} · Fat + carteira: ${R$(fat + cart)}${meta ? ` (${((fat + cart) / meta * 100).toFixed(1).replace('.', ',')}%)` : ''}`] : []),
  ...(pos != null ? [`👥 Positivação (soma dos vendedores): ${pos}`] : [])
];

export async function respGerotIndustria(env, texto, c, anteriorTexto = null) {
  const db = env && env.DB; if (!db) return null;
  const esc = escopo(c); if (esc.nada) return null;
  let ult; try { ult = await db.prepare('SELECT MAX(mes) mes FROM gerot_vendas').first(); } catch (e) { return null; }
  if (!ult || !ult.mes) return null;
  const nomesRes = await db.prepare("SELECT DISTINCT json_extract(dados,'$.Fornecedor') n FROM gerot_vendas WHERE mes >= ?").bind(ult.mes.slice(0, 4) + '-01').all().catch(() => ({ results: [] }));
  const nomes = (nomesRes.results || []).map((x) => x.n).filter(Boolean);
  const ant = anteriorTexto ? entendeGerot(anteriorTexto, nomes) : null;
  const q = entendeGerot(texto, nomes, hojeSP(), ant);
  if (!q) return null;
  // DIRETORIA SEM INDUSTRIA CITADA = PAINEL DAS INDUSTRIAS navegavel (Rudinei, 09/11/2026; painel_industrias.js, chamado pelo Jota)
  if (esc.tudo || (esc.filial && !esc.sup && !esc.rca)) return null;   // diretoria E GERENTE (filial dele) vao para o painel; supervisor/vendedor = menu de perguntas prontas. 10/11/2026 (Vitorio: 'o Rudinei vai usar muito o GEROT'): toda pergunta de industria da diretoria vai para o painel (layout do Rudinei + GEROT x CEVEN)
  const mes = q.mes || ult.mes;
  const nm = NOME_MES[Number(mes.slice(5)) - 1];
  // filtros de escopo
  let filiais = q.filiais;
  if (!esc.tudo) filiais = [esc.filial];
  const where = ['mes = ?'], bind = [mes];
  if (filiais.length) { where.push(`filial IN (${filiais.map(() => '?').join(',')})`); bind.push(...filiais); }
  if (esc.rca) { where.push('rca = ?'); bind.push(String(esc.rca)); }
  if (esc.sup) { where.push('(cod_sup = ? OR supervisor LIKE ?)'); bind.push(String(esc.sup), '%' + String(esc.supNome || '').split(' ')[0] + '%'); }
  if (q.industrias.length) { where.push(`json_extract(dados,'$.Fornecedor') IN (${q.industrias.map(() => '?').join(',')})`); bind.push(...q.industrias); }
  const { results: L } = await db.prepare(`SELECT filial, rca, vendedor, cod_sup, supervisor, dados FROM gerot_vendas WHERE ${where.join(' AND ')}`).bind(...bind).all();
  const st = await db.prepare('SELECT posicao, em FROM gerot_coleta_status WHERE mes = ? ORDER BY id DESC LIMIT 1').bind(mes).first().catch(() => null);
  const pos = st && st.posicao ? st.posicao.replace(/^Atual\s*·\s*/, '') : null;
  const fonte = `_Fonte: GEROT${pos ? ' · posição ' + pos : ''}. Sem meta cadastrada = "sem dado"._`;
  const onde = filiais.length ? filiais.join(', ') : 'Brasil (11 filiais)';
  if (!L || !L.length) return `🏭 *${q.industrias.length ? titulo(limpaNome(q.industrias[0])) : 'Indústrias'}* — ${onde} · ${nm}\nNão há linha dessa indústria no GEROT para esse recorte e mês. Não vou estimar.\n\n${fonte}`;
  const rows = L.map((r) => { const d = JSON.parse(r.dados || '{}'); return { ...r, forn: d.Fornecedor, meta: F(d, 'Meta (R$)'), fat: F(d, 'Faturado líquido (R$)') || 0, cart: F(d, 'Carteira pendente (R$)'), pos: F(d, 'Positivação (filial + CNPJ)') || 0 }; });
  const soma = (rs, k) => rs.reduce((a, r) => a + (r[k] || 0), 0);
  const temCart = rows.some((r) => r.cart != null);
  const agrupa = (rs, chave, rot) => { const m = new Map(); for (const r of rs) { const k = chave(r); if (!m.has(k)) m.set(k, { rot: rot(r), rs: [] }); m.get(k).rs.push(r); } return [...m.values()].map((g) => ({ rot: g.rot, meta: soma(g.rs, 'meta'), fat: soma(g.rs, 'fat'), cart: temCart ? soma(g.rs, 'cart') : null, pos: soma(g.rs, 'pos') })); };
  const pct = (g) => g.meta ? ` de ${R$(g.meta)} (${(g.fat / g.meta * 100).toFixed(1).replace('.', ',')}%)` : ' · sem meta';
  const L2 = [];
  // sem indústria: ranking das indústrias do recorte
  if (q.porIndustria) {
    const gs = agrupa(rows, (r) => r.forn, (r) => titulo(limpaNome(r.forn))).filter((g) => g.meta || g.fat).sort((a, b) => (b.meta || 0) - (a.meta || 0));
    L2.push(`🏭 *Indústrias — ${onde}* · ${nm}`, ...linhaKpi(soma(rows, 'meta'), soma(rows, 'fat'), temCart ? soma(rows, 'cart') : null, null), '');
    gs.slice(0, 30).forEach((g, i) => L2.push(`${i + 1}. *${g.rot}*: ${R$(g.fat)}${pct(g)}${g.cart ? ` · cart. ${R$(g.cart)}` : ''}`));
    if (gs.length > 30) L2.push(`… e mais ${gs.length - 30} indústrias`);
    L2.push('', '👉 Peça "indústria <nome> por vendedor" para abrir uma delas.', '', fonte);
    return L2.join('\n');
  }
  const nomeInd = [...new Set(rows.map((r) => titulo(limpaNome(r.forn))))].join(' + ');
  L2.push(`🏭 *${nomeInd} — ${onde}* · ${nm}`, ...linhaKpi(soma(rows, 'meta'), soma(rows, 'fat'), temCart ? soma(rows, 'cart') : null, soma(rows, 'pos')), '');
  let recorte = q.recorte || (esc.rca ? null : filiais.length === 1 ? 'supervisor' : 'filial');
  if (recorte === 'filial' && filiais.length === 1) recorte = 'supervisor';   // uma filial so: abre por supervisor
  // "sem venda" = faturado zero E carteira zero; quem tem pedido na carteira aparece a parte (09/11: Edinei vendeu Condor hoje, ainda a faturar)
  const zero = (g) => !(g.fat > 0) && !(g.cart > 0), soCart = (g) => !(g.fat > 0) && g.cart > 0;
  const blocoZeros = (lista) => {
    const z = lista.filter(zero), c = lista.filter(soCart);
    if (c.length) { L2.push('', `⏳ *Só com pedido na carteira, ainda sem faturar (${c.length}):*`); c.slice(0, 40).forEach((g, i) => L2.push(`${i + 1}. ${g.rot} · carteira ${R$(g.cart)}${g.meta ? ' · meta ' + R$(g.meta) : ''}`)); }
    if (q.zerados || z.length) { L2.push('', `❌ *Sem venda no mês (${z.length}):*`); z.slice(0, 40).forEach((g, i) => L2.push(`${i + 1}. ${g.rot}${g.meta ? ' · meta ' + R$(g.meta) : ''}`)); if (z.length > 40) L2.push(`… e mais ${z.length - 40}`); }
    L2.push('', '_Lista = vendedores com linha da indústria no GEROT no mês (meta, faturado ou carteira)._');
  };
  if (recorte === 'filial') {
    const gs = agrupa(rows, (r) => r.filial, (r) => r.filial).sort((a, b) => b.fat - a.fat);
    L2.push('*Por filial:*'); gs.forEach((g, i) => L2.push(`${i + 1}. *${g.rot}*: ${R$(g.fat)}${pct(g)} · ${g.pos} positivações`));
  } else if (recorte === 'supervisor') {
    const gs = agrupa(rows, (r) => r.filial + '|' + r.cod_sup, (r) => `${r.cod_sup ? r.cod_sup + ' - ' : ''}${nome2(r.supervisor)}${filiais.length === 1 ? '' : ' (' + r.filial + ')'}`).sort((a, b) => b.fat - a.fat);
    L2.push('*Por supervisor:*'); gs.forEach((g, i) => L2.push(`${i + 1}. *${g.rot}*: ${R$(g.fat)}${pct(g)} · ${g.pos} positivações`));
  } else if (recorte === 'vendedor') {
    const gs = agrupa(rows, (r) => r.filial + '|' + r.rca, (r) => `${r.rca} - ${nome2(r.vendedor)}${filiais.length === 1 ? '' : ' (' + r.filial + ')'}`).sort((a, b) => b.fat - a.fat);
    const comVenda = gs.filter((g) => g.fat > 0);
    L2.push(`*Por vendedor (${comVenda.length} com faturado):*`); comVenda.slice(0, 40).forEach((g, i) => L2.push(`${i + 1}. *${g.rot}*: ${R$(g.fat)}${pct(g)} · ${g.pos} cli.${g.cart ? ' · cart. ' + R$(g.cart) : ''}`));
    if (comVenda.length > 40) L2.push(`… e mais ${comVenda.length - 40}`);
    blocoZeros(gs);
  } else if (recorte === 'supervisor_vendedor') {
    const rotS = (r) => `${r.cod_sup ? r.cod_sup + ' - ' : ''}${nome2(r.supervisor)}${filiais.length === 1 ? '' : ' (' + r.filial + ')'}`;
    const sups = agrupa(rows, rotS, rotS).sort((a, b) => b.fat - a.fat);
    const todos = []; let n = 0;
    for (const g of sups) {
      L2.push(`*${g.rot}*: ${R$(g.fat)}${pct(g)} · ${g.pos} positivações`);
      const vs = agrupa(rows.filter((r) => rotS(r) === g.rot), (r) => r.rca, (r) => `${r.rca} - ${nome2(r.vendedor)}`).sort((a, b) => b.fat - a.fat);
      vs.filter((v) => v.fat > 0).forEach((v) => { n++; L2.push(`   ${n}. ${v.rot}: ${R$(v.fat)}${pct(v)} · ${v.pos} cli.`); });
      vs.forEach((v) => todos.push({ ...v, rot: `${v.rot} (sup. ${nome2(g.rot.replace(/^\d+ - /, '').split(' (')[0])})` }));
      L2.push('');
    }
    blocoZeros(todos);
  }
  L2.push('', fonte);
  return L2.join('\n');
}
