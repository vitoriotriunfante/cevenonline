/**
 * FICHA DO ARQUIVO: analises/gerar_dados_mix.js
 * O QUE É: base do acompanhamento do +MIX (Vitório, 20/10/2026: "preciso de dados, fatos e análises para provar que vendedores que usam a ferramenta
 *          têm mais mix, fidelizam melhor o cliente... e se não for, talvez mudar a estratégia"). Dados ATÉ ONTEM (não é ao vivo).
 * COMO:
 *   1) Equipe de VAREJO = Gestão de Equipe (/api/tv-mostra, canais VJ, FARMA, PET VJ, ESP).
 *   2) Pedidos do mês e dos 90 dias anteriores = banco do Drive (analises/pedidos_historico_ceven.db), item a item.
 *   3) Recomendação do +MIX de cada cliente positivado no mês = o MESMO cálculo do app (/mixapi/mix/gap): universo = carteira do vendedor
 *      (roteiro do mês) num raio de 3 km, no mínimo os 8 mais próximos. Guarda a resposta inteira em analises/mix_gap_hist.db (vai para o Drive).
 *   4) "USOU O +MIX" = o cliente comprou no mês um produto NOVO para ele (não comprou nos 90 dias antes do mês) que ESTÁ na recomendação do +MIX dele.
 *   5) Compara os vendedores por faixa de uso: mix por cliente, SKUs novos, recompra (fidelização), dobradinha das quinzenas, faturado por cliente.
 *   6) Estudo das quinzenas: nos clientes que compraram nas duas quinzenas, quanto do pedido da 2ª é produto novo em relação à 1ª.
 * ESCREVE: public/dados_mix.json (lido pela tela /mix via GitHub) + analises/mix_gap_hist.db (histórico completo das recomendações).
 * RESSALVA (escrita no próprio JSON): a recomendação é buscada hoje (o CEVEN calcula na hora); para o passado ela é uma aproximação.
 * Uso: node --require ./pipeline/ceven_header.js analises/gerar_dados_mix.js [AAAA-MM]
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const CEVEN = 'https://ceven.drivetriunfante-locomotiva.com.br';
const SITE = 'https://ceven-cftv-matrix.pages.dev';
const hojeSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const MES = process.argv[2] || hojeSP.slice(0, 7);
const ATE = (() => { const d = new Date(hojeSP + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); const o = d.toISOString().slice(0, 10); return o.slice(0, 7) === MES ? o : `${MES}-31`; })();
const INI = `${MES}-01`;
const ANTES = (() => { const d = new Date(INI + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 90); return d.toISOString().slice(0, 10); })();
const VAREJO = ['VJ', 'FARMA', 'PET VJ', 'ESP'];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, opts = {}, tent = 4) {
  for (let t = 1; t <= tent; t++) {
    try {
      const r = await fetch(url, { ...opts, headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', ...(opts.headers || {}) }, signal: AbortSignal.timeout(45000) });
      if (r.status === 429) { await espera(((Number(r.headers.get('x-ratelimit-reset')) || 20) + 2) * 1000); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { await espera(2000 * t); }
  }
  return null;
}
const dist = (a, b, c, d) => { const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); };
const so = (x) => String(x || '').replace(/\D/g, '');
const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
function corr(a, b) {
  const n = a.length; if (n < 3) return null;
  const ma = media(a), mb = media(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? r2(num / Math.sqrt(da * db)) : null;
}

async function main() {
  console.log(`+MIX: mês ${MES} (${INI} a ${ATE}); histórico desde ${ANTES}`);
  // 1) equipe de varejo
  const eq = await getJson(`${SITE}/api/tv-mostra`);
  if (!eq || !eq.filiais) throw new Error('sem a Gestão de Equipe');
  const vend = new Map();
  for (const [k, lst] of Object.entries(eq.filiais)) for (const v of lst) if (VAREJO.includes(String(v.canal || '').toUpperCase())) vend.set(`${k.split('_')[0].toUpperCase()}|${v.rca}`, { filial: k.split('_')[0].toUpperCase(), rca: String(v.rca), nome: v.nome, supervisor: v.supervisor || '', mostra: v.mostra !== false });
  console.log(`vendedores de varejo: ${vend.size}`);

  // 1b) RESULTADO DE CADA VENDEDOR (Vitorio, 20/10/2026: "verificar se quem usa bate a meta... ganha mais dinheiro e tudo mais"):
  //     % da meta de faturamento (painel do CEVEN, base central), incentivo do mes (% e gatilhos = premio) e Liga (pontos, aproveitamento, gols).
  const res = new Map();
  for (const f of [...new Set([...vend.values()].map((v) => v.filial))]) {
    const sn = await getJson(`${SITE}/api/central-snapshot?filial=${f}`);
    for (const [r, x] of Object.entries((sn && sn.rcas) || {})) {
      const fin = x && x.dashboard && x.dashboard.financeiro, pos = x && x.dashboard && x.dashboard.positivacao;
      if (!fin) continue;
      res.set(`${f}|${r}`, { meta: Number(fin.meta) || 0, fat_pend: (Number(fin.faturado) || 0) + (Number(fin.pendente) || 0), pos_meta: pos ? Number(pos.meta) || 0 : 0, pos_real: pos ? Number(pos.realizado) || 0 : 0 });
    }
  }
  const inc = await getJson(`${SITE}/api/incentivo-outubro`);
  for (const x of (inc && inc.vendedores) || []) { const k = `${String(x.filial).toUpperCase()}|${x.rca}`; const o = res.get(k) || {}; o.inc_pct = Number(x.pct); o.premio_g1 = !!x.g1; o.premio_g2 = !!x.g2; res.set(k, o); }
  const liga = await getJson('https://raw.githubusercontent.com/vitoriotriunfante/cevenonline/main/public/dados_brasileirao.json');
  for (const x of (liga && liga.vendedores) || []) { const k = `${String(x.filial).toUpperCase()}|${x.rca}`; const o = res.get(k) || {}; o.liga_pts = Number(x.pts_tabela) || 0; o.liga_aprov = Number(x.aprov) || 0; o.liga_gols = Number(x.gp) || 0; res.set(k, o); }
  console.log(`resultados por vendedor: ${res.size} (incentivo ${((inc && inc.vendedores) || []).length}, liga ${((liga && liga.vendedores) || []).length})`);

  // 2) pedidos
  const db = new Database(path.join(__dirname, 'pedidos_historico_ceven.db'), { readonly: true });
  const linhas = db.prepare(`SELECT ph.filial_sigla f, CAST(ph.rca_id AS TEXT) r, ph.id_cliente c, ph.cnpj_cliente cnpj, ph.nome_cliente nome, substr(ph.data_pedido,1,10) d, ph.num_pedido p, i.codprod cod, i.descricao des, i.valor_total v
    FROM pedidos_historico ph JOIN pedidos_historico_itens i ON i.chave_pedido = ph.chave
    WHERE i.tipo_registro = 'VENDA' AND i.codprod <> '12229' AND i.codprod <> '' AND substr(ph.data_pedido,1,10) >= ? AND substr(ph.data_pedido,1,10) <= ?`).all(ANTES, ATE);
  db.close();
  const nomeProd = new Map();
  const cli = new Map();   // filial|cliente -> {rca, cnpj, nome, mes:{q1:Set,q2:Set, peds:Set, valor, skusPed: Map(p->Set)}, antes:Set, antesMes:Set(mes anterior)}
  const mesAnt = (() => { const d = new Date(INI + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  for (const x of linhas) {
    const k = x.f + '|' + x.c;
    let o = cli.get(k);
    if (!o) cli.set(k, (o = { filial: x.f, id: String(x.c), rca: null, cnpj: so(x.cnpj), nome: x.nome, q1: new Set(), q2: new Set(), peds: new Set(), pedsQ: { q1: new Set(), q2: new Set() }, valor: 0, antes: new Set(), comprouMesAnt: false, skusPed: new Map() }));
    nomeProd.set(String(x.cod), x.des);
    if (x.d >= INI) {
      o.rca = x.r; if (!o.cnpj) o.cnpj = so(x.cnpj);
      const q = Number(x.d.slice(8, 10)) <= 15 ? 'q1' : 'q2';
      o[q].add(String(x.cod)); o.peds.add(x.p); o.pedsQ[q].add(x.p); o.valor += Number(x.v) || 0; o.vsku = o.vsku || new Map(); o.vsku.set(String(x.cod), (o.vsku.get(String(x.cod)) || 0) + (Number(x.v) || 0));
      if (!o.skusPed.has(x.p)) o.skusPed.set(x.p, new Set()); o.skusPed.get(x.p).add(String(x.cod));
    } else { o.antes.add(String(x.cod)); if (x.d.slice(0, 7) === mesAnt) o.comprouMesAnt = true; }
  }
  const alvo = [...cli.values()].filter((o) => o.rca && vend.has(o.filial + '|' + o.rca) && o.cnpj.length === 14);
  console.log(`clientes positivados no mês por vendedores de varejo: ${alvo.length}`);

  // 3) carteira (roteiro do mês) de cada vendedor e +MIX de cada cliente
  const hist = new Database(path.join(__dirname, 'mix_gap_hist.db'));
  hist.exec('CREATE TABLE IF NOT EXISTS mix_gap (dia TEXT, filial TEXT, rca TEXT, cnpj TEXT, id_cliente TEXT, universo_json TEXT, resposta_json TEXT, PRIMARY KEY (dia, filial, cnpj))');
  const insH = hist.prepare('INSERT OR REPLACE INTO mix_gap VALUES (?,?,?,?,?,?,?)');
  const carteira = new Map();
  const rcas = [...new Set(alvo.map((o) => o.filial + '|' + o.rca))];
  const t0 = Date.now();
  for (let i = 0; i < rcas.length; i++) {
    const [f, r] = rcas[i].split('|');
    const alvoT = t0 + (i * 60000) / 80; if (Date.now() < alvoT) await espera(alvoT - Date.now());
    const rm = await getJson(`${CEVEN}/api/rca/roteiro-mes?filial=${f.toLowerCase()}1&id=${r}`);
    const m = new Map();
    for (const c of Array.isArray(rm) ? rm : []) { const cn = so(c.cnpj); if (cn.length === 14 && Number(c.latitude) && Number(c.longitude)) m.set(cn, { cnpj: cn, nome: c.nome_cliente, lat: Number(c.latitude), lon: Number(c.longitude) }); }
    carteira.set(rcas[i], m);
  }
  console.log(`carteiras lidas: ${carteira.size} (${[...carteira.values()].filter((m) => m.size).length} com clientes)`);
  let ok = 0, semCoord = 0, falha = 0, idx = 0;
  const rec = new Map();
  const worker = async () => {
    while (idx < alvo.length) {
      const o = alvo[idx++];
      const cart = carteira.get(o.filial + '|' + o.rca) || new Map();
      const eu = cart.get(o.cnpj);
      if (!eu) { semCoord++; continue; }
      const todos = [...cart.values()].map((c) => ({ ...c, d: dist(eu.lat, eu.lon, c.lat, c.lon) }));
      let uni = todos.filter((c) => c.d <= 3);
      if (uni.length < 8) uni = todos.sort((a, b) => a.d - b.d).slice(0, 8);
      const cnpjs = uni.map((c) => c.cnpj).slice(0, 400);
      const g = await getJson(`${CEVEN}/mixapi/mix/gap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_cnpj: o.cnpj, universo_cnpjs: cnpjs, limite: 100, raio_km: 3, cod_rca: Number(o.rca) }) }, 3);
      if (!g || !g.disponivel) { falha++; continue; }
      ok++;
      insH.run(hojeSP, o.filial, o.rca, o.cnpj, o.id, JSON.stringify(uni.filter((c) => c.cnpj !== o.cnpj).map((c) => ({ cnpj: c.cnpj, nome: c.nome, km: r1(c.d) }))), JSON.stringify(g));
      const cods = new Map();
      for (const ind of g.industrias_gap || []) for (const p of ind.produtos || []) cods.set(String(p.codprod), { ind: ind.industria, pen: p.penetracao, n: p.n_clientes, nome: p.produto });
      for (const p of g.produtos_top || []) if (!cods.has(String(p.codprod))) cods.set(String(p.codprod), { ind: p.industria, pen: p.penetracao, n: p.n_clientes, nome: p.produto });
      for (const [c, v] of cods) if (v.nome) nomeProd.set(c, v.nome);
      rec.set(o.filial + '|' + o.id, { cods, universo: g.total_universo, impacto: g.impacto_total_estimado });
      if ((ok + falha + semCoord) % 500 === 0) console.log(`  +MIX ${ok + falha + semCoord}/${alvo.length} | ok ${ok} | sem coordenada ${semCoord} | falha ${falha}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  hist.close();
  console.log(`+MIX buscado: ok ${ok} | sem coordenada na carteira ${semCoord} | falha ${falha}`);
  if (!ok) throw new Error('nenhuma recomendação do +MIX lida: não é sucesso');

  // 4) métricas por cliente
  const porV = new Map();
  const itensMix = new Map();   // codprod -> {nome, clientes, valor}
  const estudoQ = { clientes: 0, skus_q1: [], skus_q2: [], novos_q2: [], repetidos: [] };
  for (const o of alvo) {
    const r = rec.get(o.filial + '|' + o.id);
    const mesSkus = new Set([...o.q1, ...o.q2]);
    const novos = [...mesSkus].filter((c) => !o.antes.has(c));
    const novosMix = r ? novos.filter((c) => r.cods.has(c)) : [];
    const dob = o.pedsQ.q1.size > 0 && o.pedsQ.q2.size > 0;
    if (dob) {
      estudoQ.clientes++; estudoQ.skus_q1.push(o.q1.size); estudoQ.skus_q2.push(o.q2.size);
      const nq2 = [...o.q2].filter((c) => !o.q1.has(c)).length; estudoQ.novos_q2.push(nq2); estudoQ.repetidos.push(o.q2.size - nq2);
    }
    const k = o.filial + '|' + o.rca;
    let v = porV.get(k);
    if (!v) porV.set(k, (v = { ...vend.get(k), clientes: 0, com_mix: 0, clientes_usou: 0, skus_mix_vendidos: 0, mix: [], novos: [], valor: 0, recompra_base: 0, recompra: 0, dobradinha: 0, skus_ped: [] }));
    v.clientes++; if (r) v.com_mix++;
    if (novosMix.length) v.clientes_usou++;
    v.skus_mix_vendidos += novosMix.length;
    v.mix.push(mesSkus.size); v.novos.push(novos.length); v.valor += o.valor;
    if (o.comprouMesAnt) { v.recompra_base++; }
    if (dob) v.dobradinha++;
    for (const s of o.skusPed.values()) v.skus_ped.push(s.size);
    // COMPARATIVO ENTRE VENDEDORES (20/10/2026, estilo da apresentacao de 18/09: "clientes do mesmo perfil, vendas diferentes"): penetracao de cada produto na carteira positivada
    v.skus = v.skus || new Map();
    for (const [c, val] of (o.vsku || new Map())) { const it = v.skus.get(c) || { cli: 0, val: 0 }; it.cli++; it.val += val; v.skus.set(c, it); }
    v.cnpjsPos = v.cnpjsPos || new Map(); v.cnpjsPos.set(o.cnpj, novosMix.length ? 2 : 1);
    for (const c of novosMix) { const it = itensMix.get(c) || { cod: c, nome: nomeProd.get(c) || '', clientes: 0, industria: r.cods.get(c).ind }; it.clientes++; itensMix.set(c, it); }
  }
  // fidelizacao: dos clientes positivados no mes ANTERIOR por esse vendedor, quantos voltaram a comprar neste mes
  const voltou = new Map();
  for (const o of cli.values()) if (o.comprouMesAnt) { const k = o.filial + '|' + (o.rca || ''); if (o.rca) voltou.set(k, (voltou.get(k) || 0) + 1); }
  const vendedores = [...porV.values()].filter((v) => v.com_mix >= 5).map((v) => ({
    filial: v.filial, rca: v.rca, nome: v.nome, supervisor: v.supervisor, clientes: v.clientes, clientes_com_mix: v.com_mix,
    uso_pct: r1(v.clientes_usou / v.com_mix * 100), clientes_usou: v.clientes_usou, skus_mix_vendidos: v.skus_mix_vendidos,
    mix_medio: r1(media(v.mix)), skus_novos_medio: r1(media(v.novos)), skus_por_pedido: r1(media(v.skus_ped)),
    faturado_por_cliente: Math.round(v.valor / v.clientes), dobradinha_pct: r1(v.dobradinha / v.clientes * 100),
    ja_eram_clientes_pct: r1(v.recompra_base / v.clientes * 100),
    carteira: (carteira.get(v.filial + '|' + v.rca) || new Map()).size || null,
    cobertura_pct: (carteira.get(v.filial + '|' + v.rca) || new Map()).size ? r1(v.clientes / carteira.get(v.filial + '|' + v.rca).size * 100) : null,
    top_skus: [...(v.skus || new Map()).entries()].sort((a, b) => b[1].cli - a[1].cli).slice(0, 15).map(([c, x]) => ({ c, n: nomeProd.get(c) || '', cli: x.cli, pct: r1(x.cli / v.clientes * 100), val: Math.round(x.val) })),
    // pontos do mapa: [lat, lon, 0 = carteira sem compra no mes | 1 = positivado | 2 = positivado com produto novo do +MIX]
    pontos: [...(carteira.get(v.filial + '|' + v.rca) || new Map()).values()].map((c) => [Math.round(c.lat * 1e4) / 1e4, Math.round(c.lon * 1e4) / 1e4, (v.cnpjsPos && v.cnpjsPos.get(c.cnpj)) || 0]),
    ...(() => { const x = res.get(v.filial + '|' + v.rca) || {}; return {
      pct_meta_fat: x.meta ? r1(x.fat_pend / x.meta * 100) : null, pct_meta_pos: x.pos_meta ? r1(x.pos_real / x.pos_meta * 100) : null,
      incentivo_pct: x.inc_pct == null || isNaN(x.inc_pct) ? null : r1(x.inc_pct), premio: x.premio_g2 ? 2 : x.premio_g1 ? 1 : (x.inc_pct == null ? null : 0),
      liga_pts: x.liga_pts == null ? null : x.liga_pts, liga_aprov: x.liga_aprov == null ? null : x.liga_aprov, liga_gols: x.liga_gols == null ? null : x.liga_gols }; })()
  })).sort((a, b) => b.uso_pct - a.uso_pct);
  // 5) faixas de uso (quartis)
  const ord = vendedores.slice().sort((a, b) => a.uso_pct - b.uso_pct), q = Math.ceil(ord.length / 4);
  const faixas = [0, 1, 2, 3].map((i) => {
    const g = ord.slice(i * q, (i + 1) * q);
    return { faixa: ['25% que MENOS usam', '2º quartil', '3º quartil', '25% que MAIS usam'][i], vendedores: g.length, uso_pct: r1(media(g.map((x) => x.uso_pct))), mix_medio: r1(media(g.map((x) => x.mix_medio))), skus_novos_medio: r1(media(g.map((x) => x.skus_novos_medio))), skus_por_pedido: r1(media(g.map((x) => x.skus_por_pedido))), faturado_por_cliente: Math.round(media(g.map((x) => x.faturado_por_cliente))), dobradinha_pct: r1(media(g.map((x) => x.dobradinha_pct))), ja_eram_clientes_pct: r1(media(g.map((x) => x.ja_eram_clientes_pct))), clientes: g.reduce((s, x) => s + x.clientes, 0),
      pct_meta_fat: r1(media(g.filter((x) => x.pct_meta_fat != null).map((x) => x.pct_meta_fat))), pct_meta_pos: r1(media(g.filter((x) => x.pct_meta_pos != null).map((x) => x.pct_meta_pos))),
      com_premio_pct: (() => { const h = g.filter((x) => x.premio != null); return h.length ? r1(h.filter((x) => x.premio > 0).length / h.length * 100) : null; })(),
      liga_pts: r1(media(g.filter((x) => x.liga_pts != null).map((x) => x.liga_pts))), liga_gols: r1(media(g.filter((x) => x.liga_gols != null).map((x) => x.liga_gols))) };
  });
  const U = vendedores.map((v) => v.uso_pct);
  const saida = {
    gerado_em: new Date().toISOString(), mes: MES, dados_ate: ATE, historico_desde: ANTES,
    definicoes: {
      usou_mix: 'o cliente comprou no mês um produto NOVO para ele (não comprou nos 90 dias antes do mês) que está na recomendação do +MIX dele',
      uso_pct: '% dos clientes positivados do vendedor (com +MIX disponível) em que ele vendeu ao menos 1 produto novo vindo do +MIX',
      mix_medio: 'produtos diferentes comprados pelo cliente no mês', skus_novos_medio: 'produtos novos por cliente (não comprados nos 90 dias antes)',
      dobradinha_pct: '% dos clientes que compraram nas duas quinzenas', pct_meta_fat: '(faturado + pendente) / meta de faturamento do mês, igual ao app', pct_meta_pos: 'positivados / meta de positivação do mês',
      premio: 'incentivo de outubro: 0 = sem prêmio, 1 = gatilho 1, 2 = gatilho 2', liga_pts: 'pontos na tabela da Liga (Champions Triunfante)', ja_eram_clientes_pct: '% dos clientes do mês que também compraram no mês anterior (fidelização)',
      ressalva: 'a recomendação do +MIX é calculada pelo CEVEN na hora da consulta; para dias passados ela é uma aproximação do que o vendedor viu. A partir de hoje a recomendação de cada dia fica gravada.'
    },
    resumo: { vendedores: vendedores.length, clientes: alvo.length, clientes_com_mix: ok, sem_coordenada: semCoord, falha_mix: falha,
      clientes_que_usaram: vendedores.reduce((s, v) => s + v.clientes_usou, 0), skus_mix_vendidos: vendedores.reduce((s, v) => s + v.skus_mix_vendidos, 0),
      correlacao_uso_x_mix: corr(U, vendedores.map((v) => v.mix_medio)), correlacao_uso_x_faturado_cliente: corr(U, vendedores.map((v) => v.faturado_por_cliente)),
      correlacao_uso_x_dobradinha: corr(U, vendedores.map((v) => v.dobradinha_pct)), correlacao_uso_x_fidelizacao: corr(U, vendedores.map((v) => v.ja_eram_clientes_pct)),
      ...(() => { const par = (k) => { const L = vendedores.filter((v) => v[k] != null); return corr(L.map((v) => v.uso_pct), L.map((v) => v[k])); };
        return { correlacao_uso_x_meta_fat: par('pct_meta_fat'), correlacao_uso_x_meta_pos: par('pct_meta_pos'), correlacao_uso_x_incentivo: par('incentivo_pct'), correlacao_uso_x_liga_pts: par('liga_pts') }; })() },
    faixas,
    estudo_quinzenas: { clientes_dobradinha: estudoQ.clientes, skus_q1_medio: r1(media(estudoQ.skus_q1)), skus_q2_medio: r1(media(estudoQ.skus_q2)), skus_novos_na_q2_medio: r1(media(estudoQ.novos_q2)), skus_repetidos_na_q2_medio: r1(media(estudoQ.repetidos)),
      pct_q2_que_e_novo: r1(media(estudoQ.novos_q2) / media(estudoQ.skus_q2) * 100) },
    itens_mais_vendidos_via_mix: [...itensMix.values()].sort((a, b) => b.clientes - a.clientes).slice(0, 60),
    vendedores
  };
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'dados_mix.json'), JSON.stringify(saida));
  console.log(JSON.stringify({ resumo: saida.resumo, faixas, estudo_quinzenas: saida.estudo_quinzenas }, null, 1));
}
main().catch((e) => { console.error('❌', e.message); process.exit(1); });
