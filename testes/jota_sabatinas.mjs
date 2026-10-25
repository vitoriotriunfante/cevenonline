// =========================================================================
// SABATINAS DO JOTA (Vitório, 25/10/2026: "faça mais umas 500 sabatinas... CEO com o diretor, diretor com cada gerente... gerentes apertando cada
// supervisor... supervisores perguntando para os vendedores como foi a rota do dia... valide dado por dado, informação por informação... profundidade").
// Quem RESPONDE é o JOTA com o perfil/escopo de quem está sendo sabatinado. Nada é enviado no WhatsApp; nada é gravado na Cloudflare.
// VALIDAÇÃO INDEPENDENTE: cada número verificável é RECALCULADO das fontes brutas (saude, central-snapshot, tv-mostra, Liga, vendas item a item)
// e comparado com o texto da resposta. Resultado: MAIS_MIX/JOTA/sabatinas/<data>/{dialogos.json, RELATORIO.md}
// uso: node testes/jota_sabatinas.mjs [--dia=2026-10-23 (finge esse dia: rota real)] [--max=500] [--so=rota|mes]
// =========================================================================
import fs from 'fs'; import os from 'os'; import path from 'path'; import { pathToFileURL, fileURLToPath } from 'url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const DIA = arg('dia', ''), MAX = Number(arg('max', 500)), SO = arg('so', '');
if (DIA) { const REAL = Date; const FIXO = REAL.parse(DIA + 'T21:40:00Z'); globalThis.Date = class extends REAL { constructor(...a) { super(...(a.length ? a : [FIXO])); } static now() { return FIXO; } }; }
const ORIGIN = 'https://ceven-cftv-matrix.pages.dev', GH = 'https://raw.githubusercontent.com/vitoriotriunfante/cevenonline/main/';
const tmp = path.join(os.tmpdir(), 'jota_sab_' + process.pid + '.mjs'); fs.writeFileSync(tmp, fs.readFileSync(path.join(raiz, 'functions/api/whatsapp/bot.js'), 'utf8').replace("'../../../public/regras.js'", JSON.stringify(new URL('../public/regras.js', import.meta.url).href)));
const { _teste } = await import(pathToFileURL(tmp).href);
const j = async (u) => (await fetch(u)).json();
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const R$ = (n) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');
const N = (n) => Math.round(n).toLocaleString('pt-BR');
const FIL = ['TPH', 'ABC', 'API', 'TBL', 'TCV', 'TSJ', 'TCA', 'TBE', 'TPA', 'MCD', 'TCG'];
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
console.log('dia de referência:', hoje, DIA ? '(fingido)' : '');
// ---------- FONTES BRUTAS (para validar) ----------
const saude = await j(ORIGIN + '/api/saude'), mostra = await j(ORIGIN + '/api/tv-mostra'), liga = await j(GH + 'public/dados_brasileirao.json');
const snap = {}; for (const f of FIL) snap[f] = await j(`${ORIGIN}/api/central-snapshot?filial=${f}&dia=${hoje}`).catch(() => ({ rcas: {} }));
const vendas = {}; for (const f of FIL) vendas[f] = await j(GH + `public/vendas_mes/${f}.json`).catch(() => null);
const vendasAnt = {}; for (const f of FIL) vendasAnt[f] = await j(GH + `public/vendas_mes_anterior/${f}.json`).catch(() => null);
const EQ = new Map(); for (const [k, L] of Object.entries(mostra.filiais || {})) for (const v of L) EQ.set(k.split('_')[0] + '|' + v.rca, { ...v, filial: k.split('_')[0] });
const VAREJO = /^(VJ|PET VJ|FARMA|ESP)$/;
const vendMostrados = (f) => [...EQ.values()].filter((v) => v.filial === f && v.mostra !== false);
const fin = (f, rca) => ((snap[f].rcas || {})[rca] || {}).dashboard?.financeiro || {};
const pos = (f, rca) => ((snap[f].rcas || {})[rca] || {}).dashboard?.positivacao || {};
const prodDia = (f, rca) => ((snap[f].rcas || {})[rca] || {}).produtividade?.dia || {};
const rota = (f, rca) => (((snap[f].rcas || {})[rca] || {}).roteiro || []).filter((c) => String(c.data_visita || '').slice(0, 10) === hoje);
// ---------- PERFIS ----------
const { results: _c } = { results: [] };
const contatos = JSON.parse(fs.readFileSync(path.join(raiz, 'MAIS_MIX/JOTA/sabatinas/_contatos.json'), 'utf8'));
const dir = (nome) => ({ nome, papel: 'diretoria' });
const gerentes = contatos.filter((c) => c.papel === 'gerente');
const supervisores = [...new Map([...EQ.values()].filter((v) => v.mostra !== false && v.supervisor && !/^(GERENTE|VAGO|SEM )/i.test(v.supervisor)).map((v) => [v.filial + '|' + v.supervisor, { filial: v.filial, nome: v.supervisor, grupo: v.grupo || null }])).values()];
// ---------- VALIDADORES (recalculo independente) ----------
const tem = (r, s) => String(r).includes(s);
// Premiacao RV (metas por industria) direto da fonte + utilitarios de produto
const RVB = 'https://mapa.drivetriunfante-lastmile.com.br/rv/api', MES = hoje.slice(0, 7);
const RV = await Promise.all([j(`${RVB}/metas?mes=${MES}`), j(`${RVB}/apuracao-agregada?mes=${MES}`)]).then(([m, a]) => ({ metas: m.rows, apu: a.fornecedores })).catch(() => null);
const DSEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dU = (d) => new Date(Date.UTC(Math.floor(d / 10000), Math.floor(d / 100) % 100 - 1, d % 100));
const linhasProd = (f, termo, fonte = vendas) => { const vm = fonte[f]; if (!vm) return []; const T = sem(termo).split(/\s+/); const cods = new Set(Object.entries(vm.produtos).filter(([, p]) => T.every((w) => sem(p[0]).includes(w))).map(([c]) => c)); return vm.l.filter((l) => cods.has(l[3])); };
const V = {
  fat_filial: (r, ctx) => { const f = (saude.filiais || []).find((x) => x.filial === ctx.filial); if (!f) return null; return tem(r, R$(f.faturado)) ? 'ok' : `faturado esperado ${R$(f.faturado)}`; },
  pos_filial: (r, ctx) => { const f = (saude.filiais || []).find((x) => x.filial === ctx.filial); if (!f) return null; return tem(r, N(f.positivados)) ? 'ok' : `positivados esperado ${N(f.positivados)}`; },
  fat_brasil: (r) => { const t = (saude.filiais || []).reduce((a, f) => a + (f.faturado || 0), 0); return tem(r, R$(t)) ? 'ok' : `faturado Brasil esperado ${R$(t)}`; },
  liga_filial: (r, ctx) => { const f = (liga.filiais || []).find((x) => x.sigla === ctx.filial); if (!f) return null; return tem(r, `${f.pos}º`) && tem(r, `${f.pts_tabela} p`) ? 'ok' : `Liga esperado ${f.pos}º / ${f.pts_tabela} pts`; },
  fat_equipe: (r, ctx) => { const L = vendMostrados(ctx.filial).filter((v) => sem(v.supervisor) === sem(ctx.sup)); const t = L.reduce((a, v) => a + (fin(ctx.filial, String(v.rca)).faturado || 0), 0); return L.length ? (tem(r, R$(t)) ? 'ok' : `faturado da equipe esperado ${R$(t)}`) : null; },
  zerados_equipe: (r, ctx) => { const L = vendMostrados(ctx.filial).filter((v) => (!ctx.sup || sem(v.supervisor) === sem(ctx.sup)) && VAREJO.test(String(v.canal))); const z = L.filter((v) => (prodDia(ctx.filial, String(v.rca)).total_programado || 0) > 0 && !(prodDia(ctx.filial, String(v.rca)).dig_pedido > 0)).length; return new RegExp(`(Zerados hoje[^\\n]*\\*?${z}[.*\\s])|: \\*${z}\\*|Zerados hoje — [^:]*: ${z}\\.`).test(r) ? 'ok' : `zerados esperado ${z}`; },
  fat_vend: (r, ctx) => { const x = fin(ctx.filial, ctx.rca); if (x.faturado == null) return null; return tem(r, R$(x.faturado)) && tem(r, R$(x.meta)) ? 'ok' : `vendedor esperado ${R$(x.faturado)} de ${R$(x.meta)}`; },
  pos_vend: (r, ctx) => { const x = pos(ctx.filial, ctx.rca); if (x.realizado == null) return null; return tem(r, `${x.realizado} de ${x.meta}`) ? 'ok' : `positivação esperada ${x.realizado} de ${x.meta}`; },
  rota_vend: (r, ctx) => { const R = rota(ctx.filial, ctx.rca).filter((c) => !/FORA/i.test(c.status)); if (!R.length) return /sem rota|não tem clientes na rota/.test(r) ? 'ok' : 'esperado "sem rota"'; const vis = R.filter((c) => c.checkin_horario || /VISITADO|JUSTIFICADO|POSITIVADO|EFETIVADO/i.test(c.status)).length; return tem(r, `${vis} visitados de ${R.length}`) ? 'ok' : `rota esperada ${vis} visitados de ${R.length}`; },
  dig_vend: (r, ctx) => { const d = prodDia(ctx.filial, ctx.rca); return tem(r, R$(d.dig_pedido || 0)) ? 'ok' : `digitado esperado ${R$(d.dig_pedido || 0)}`; },
  produto_vend: (r, ctx) => { const vm = vendas[ctx.filial]; if (!vm) return null; const cods = new Set(Object.entries(vm.produtos).filter(([, p]) => sem(p[0]).includes(sem(ctx.prodTermo))).map(([c]) => c)); const tot = vm.l.filter((l) => l[1] === ctx.rca && cods.has(l[3])).reduce((a, l) => a + l[5], 0); if (!tot) return /nenhuma venda|Não achei/.test(r) ? 'ok' : 'esperado "nenhuma venda"'; return tem(r, R$(tot)) ? 'ok' : `produto esperado ${R$(tot)}`; },
  compara_mes: (r, ctx) => { const A = vendas[ctx.filial], Z = vendasAnt[ctx.filial]; if (!A || !Z) return null; const ate = A.l.reduce((m, l) => Math.max(m, l[0]), 0), dc = ate % 100; const f = (l) => !ctx.rca || l[1] === ctx.rca; const vA = A.l.filter(f).reduce((a, l) => a + l[5], 0), vZ = Z.l.filter((l) => f(l) && l[0] % 100 <= dc).reduce((a, l) => a + l[5], 0); return tem(r, R$(vA)) && tem(r, R$(vZ)) ? 'ok' : `comparação esperada ${R$(vA)} × ${R$(vZ)}`; },
  // PREMIACAO RV (25/10/2026): meta x faturado por industria, conferido direto na fonte (/rv/api), sem passar pelo JOTA
  meta_ind: (r, ctx) => { if (!RV) return null; const ok = (c) => !ctx.rcas || ctx.rcas.includes(c); const ids = new Set(); let meta = 0, fat = 0;
    for (const m of RV.metas) if (ok(String(m.cod_vendedor)) && (!ctx.ind || String(m.id_fornecedor) === ctx.ind)) { ids.add(String(m.id_fornecedor)); if (m.tipo_meta === 1) meta += m.meta; }
    for (const a of RV.apu) if (ok(String(a.CODUSUR)) && ids.has(String(a.cnpj_fornecedor))) fat += a.fat_f;
    if (!ids.size) return /Nenhuma meta/.test(r) ? 'ok' : 'esperado "nenhuma meta"'; return tem(r, R$(fat)) && tem(r, R$(meta)) ? 'ok' : `meta esperada ${R$(fat)} de ${R$(meta)}`; },
  dia_semana: (r, ctx) => { const L = linhasProd(ctx.filial, ctx.termo); if (!L.length) return null; const W = Array.from({ length: 7 }, () => ({ v: 0, d: new Set() })); for (const l of L) { const w = dU(l[0]).getUTCDay(); W[w].v += l[5]; W[w].d.add(l[0]); }
    const best = W.map((x, i) => ({ i, m: x.d.size ? x.v / x.d.size : -1 })).sort((a, b) => b.m - a.m)[0]; return tem(r, `*${DSEM[best.i]}*`) ? 'ok' : `melhor dia esperado ${DSEM[best.i]}`; },
  semanas: (r, ctx) => { const L = linhasProd(ctx.filial, ctx.termo); if (!L.length) return null; const S = new Map(); for (const l of L) { const d = dU(l[0]); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); const k = d.toISOString().slice(0, 10); S.set(k, (S.get(k) || 0) + l[5]); }
    const falta = [...S.values()].filter((v) => !tem(r, R$(v))); return falta.length ? `semanas esperadas ${[...S.values()].map(R$).join(' / ')}` : 'ok'; },
  mes_a_mes: (r, ctx) => { const L = linhasProd(ctx.filial, ctx.termo), Z = linhasProd(ctx.filial, ctx.termo, vendasAnt); if (!L.length || !vendasAnt[ctx.filial]) return null; const dia = L.reduce((m, l) => Math.max(m, l[0]), 0) % 100;
    const a = L.reduce((s, l) => s + l[5], 0), z = Z.filter((l) => l[0] % 100 <= dia).reduce((s, l) => s + l[5], 0); return tem(r, R$(a)) && tem(r, R$(z)) ? 'ok' : `mês a mês esperado ${R$(a)} × ${R$(z)}`; },
  escopo: (r) => (/Você vê só|outras filiais são com a diretoria/.test(r) ? 'ok' : 'gerente/supervisor viu outra filial sem aviso'),
  sugestao: (r) => (/Sugestão do Jota/.test(r) ? 'ok' : 'sem sugestão'),
};
// ---------- ROTEIROS DE SABATINA ----------
const IND = ['Mondelez', 'Mars', 'Arcor', 'Bagley', 'Condor', 'Ferrero', 'Nestle'];
const pr = (q, checks = [], ctx = {}) => ({ q, checks, ctx });
const sabs = [];
if (SO !== 'rota') {
  sabs.push({ tipo: 'CEO → Diretor Evandro', perfil: dir('EVANDRO SERVAT'), perguntas: [pr('como estamos no mês?', ['fat_brasil']), pr('qual filial está pior?'), pr('quanto falta e quanto precisa por dia?'), pr('ranking das filiais somando a carteira'), pr('quem são os 10 melhores vendedores de varejo?'), pr('e os 10 piores?'), pr('positivação do grupo, quanto falta?'), pr('como está a Champions?'), pr('quanto vendemos de marca própria no mês?'), pr('produtos mais vendidos no mês'), pr('estamos no ritmo da meta?'), pr('compare TPH com MCD'), pr('ranking dos supervisores do grupo'), pr('devoluções do mês por motivo'), pr('quantos vendedores vão ganhar o incentivo?')] });
  sabs.push({ tipo: 'Evandro → Gerente de AS (Paulo)', perfil: dir('PAULO MICHELETO JUNIOR'), perguntas: [pr('ranking dos vendedores AS'), pr('liga AS'), pr('quem é o melhor AS da TPH?'), pr('5 piores AS em faturamento'), pr('como está o AS da API?'), pr('quanto o AS faturou no mês?'), pr('qual AS mais deve meta?')] });
  sabs.push({ tipo: 'Diretor → Gerente de rota varejo (Vitório)', perfil: dir('VITORIO'), perguntas: [pr('visitas de hoje'), pr('eficácia da rota no mês'), pr('quem tem rota e não visitou ninguém?'), pr('zerados por supervisor'), pr('quantos clientes faltam visitar hoje?'), pr('impedimentos de hoje'), pr('recorrência positivada hoje'), pr('dobradinha por vendedor'), pr('quem mais usa o +mix?'), pr('10 melhores de varejo em positivação')] });
  for (const ind of IND) sabs.push({ tipo: 'Diretor → Gerente de Relacionamento com Indústrias', perfil: dir('VITORIO'), perguntas: [pr(`positivação de ${ind} por filial`), pr(`quanto vendemos de ${ind} no mês?`), pr(`quem comprava ${ind} e parou?`), pr(`positivação de ${ind} na TPH por vendedor`), pr(`como está ${ind} na API?`)] });
  // DIRETOR APRESENTANDO PARA A INDUSTRIA (Vitorio, 25/10/2026): metas da Premiacao + dia da semana, vendedor especifico, semanal e mensal
  if (RV) {
    const filDe = new Map([...EQ.values()].map((v) => [String(v.rca), v.filial]));
    const porInd = new Map(); for (const m of RV.metas) if (m.tipo_meta === 1) { const id = String(m.id_fornecedor), x = porInd.get(id) || { nome: m.fornecedor, meta: 0, fil: new Map(), vend: new Map() }; x.meta += m.meta; const f = filDe.get(String(m.cod_vendedor)); if (f) x.fil.set(f, (x.fil.get(f) || 0) + m.meta); x.vend.set(String(m.cod_vendedor), (x.vend.get(String(m.cod_vendedor)) || 0) + m.meta); porInd.set(id, x); }
    const nomeI = (n) => titulo(String(n).replace(/^[A-Z0-9]{1,3}\s*-\s*/i, '').replace(/\(.*?\)|\.{2,}/g, '').split(/\s+/).slice(0, 2).join(' '));
    const GENERICO = /^(BISC|LAVA|ROUP|CHOC|CHOCOLATE|BALA|PIR|PANO|LUVA|DESOD|REPEL|BATATA|SALGAD|BARRA|TABL|BOMBOM|AO|LEITE|COM|SEM|PO|LIQ|CT|UN|KG|ORIGINAL)$/;
    for (const [id, x] of [...porInd].sort((a, b) => b[1].meta - a[1].meta).slice(0, 14)) {
      const fil = [...x.fil].sort((a, b) => b[1] - a[1]).map(([f]) => f);
      for (const F of fil.slice(0, 3)) {
        const vm = vendas[F]; if (!vm) continue;
        // produto da industria mais vendido na filial -> palavra distintiva (marca)
        const w0 = sem(nomeI(x.nome)).split(' ')[0]; const cnt = new Map();
        for (const l of vm.l) { const p = vm.produtos[l[3]]; if (p && sem(p[1]).includes(w0)) cnt.set(l[3], (cnt.get(l[3]) || 0) + l[5]); }
        const top = [...cnt].sort((a, b) => b[1] - a[1])[0]; if (!top) continue;
        const termo = titulo((sem(vm.produtos[top[0]][0]).split(/\s+/).find((w) => w.length > 3 && !GENERICO.test(w)) || ''));
        if (!termo) continue;
        const vs = [...x.vend].filter(([c]) => filDe.get(c) === F).sort((a, b) => b[1] - a[1]); const v0 = vs.length ? EQ.get(F + '|' + vs[0][0]) : null;
        const I = nomeI(x.nome), ctxF = { filial: F, termo };
        const perg = [pr(`como está a meta da ${I} no Brasil?`, ['meta_ind'], { rcas: null, ind: id }),
          pr(`qual dia da semana mais vende ${termo} em ${F}?`, ['dia_semana'], ctxF),
          pr(`tem algum vendedor específico que vende mais ${termo} em ${F}?`),
          pr(`vendas semanais de ${termo} em ${F}`, ['semanas'], ctxF),
          pr(`vendas mensais de ${termo} em ${F}`, ['mes_a_mes'], ctxF)];
        if (v0) { const n = titulo(v0.nome.split(' ').slice(0, 2).join(' ')); perg.push(pr(`como está a meta da ${I} do vendedor ${n} ${v0.rca}?`, ['meta_ind'], { rcas: [String(v0.rca)], ind: id }), pr(`estamos batendo as metas das indústrias do vendedor ${n} ${v0.rca}?`, ['meta_ind'], { rcas: [String(v0.rca)], ind: null })); }
        sabs.push({ tipo: `Diretor apresentando para a Indústria (${I})`, perfil: dir('EVANDRO SERVAT'), perguntas: perg });
      }
    }
    // o exemplo do Vitorio: vendedora 181 de TBL
    sabs.push({ tipo: 'Diretor apresentando para a Indústria (exemplo Giovana 181 TBL)', perfil: dir('EVANDRO SERVAT'), perguntas: [pr('estamos batendo as metas das indústrias da Giovana 181?', ['meta_ind'], { rcas: ['181'], ind: null }), pr('como está a meta da Mars Choc da Giovana 181?', ['meta_ind'], { rcas: ['181'], ind: '13136' }), pr('qual dia da semana mais vende Snickers em TBL?', ['dia_semana'], { filial: 'TBL', termo: 'Snickers' }), pr('vendas semanais de Snickers em TBL', ['semanas'], { filial: 'TBL', termo: 'Snickers' }), pr('vendas mensais de Snickers em TBL', ['mes_a_mes'], { filial: 'TBL', termo: 'Snickers' })] });
  }
  for (const nac of ['PAULO MICHELETO JUNIOR', 'VITORIO', 'RUDINEI RIZATTI']) for (const g of gerentes) {
    const sups = supervisores.filter((s) => s.filial === g.filial && (!g.grupo || String(s.grupo || '').toUpperCase() === String(g.grupo).toUpperCase()));
    const s0 = sups[Math.floor(Math.random() * Math.max(1, sups.length))] || {};
    const outra = FIL.find((f) => f !== g.filial);
    sabs.push({ tipo: `Gerente nacional (${titulo(nac.split(' ')[0])}) → Gerente ${g.filial}${g.grupo ? '/' + titulo(g.grupo) : ''}`, perfil: g, perguntas: [pr('como está a filial?', g.grupo ? [] : ['fat_filial', 'sugestao'], { filial: g.filial }), pr('quanto falta e qual o MN?'), pr('qual supervisor está puxando pra baixo?'), pr(`supervisor ${titulo(String(s0.nome || '').split(' ').slice(0, 2).join(' '))}`, s0.nome ? ['fat_equipe'] : [], { filial: g.filial, sup: s0.nome }), pr('quem são os zerados hoje?'), pr('positivação por supervisor'), pr('posição na Champions', ['liga_filial'], { filial: g.filial }), pr('quanto tem na carteira?'), pr('5 piores vendedores'), pr('quanto devolveu no mês?'), pr('quantos vão ganhar o incentivo?'), pr('produtos mais vendidos no mês'), pr('como estamos em relação ao mês passado?', g.grupo ? [] : ['compara_mes'], { filial: g.filial }), pr('quem está há 3 dias sem pedido?'), pr('clientes curva A sem comprar há mais de 30 dias'), pr('o que vendemos de Turron essa semana?'), pr(`como está ${outra}?`, ['escopo'])] });
  }
  for (const s of supervisores) {
    const perfil = { nome: s.nome, papel: 'supervisor', filial: s.filial, grupo: s.grupo, supervisor: s.nome };
    const vs = vendMostrados(s.filial).filter((v) => sem(v.supervisor) === sem(s.nome)); const v0 = vs[0];
    sabs.push({ tipo: `Gerente ${s.filial} → Supervisor`, perfil, perguntas: [pr('como está minha equipe?', ['fat_equipe'], { filial: s.filial, sup: s.nome }), pr('quem está zerado?', ['zerados_equipe'], { filial: s.filial, sup: s.nome }), pr('quanto falta pra meta da equipe?'), pr('positivação da equipe'), pr('ranking da equipe'), ...(v0 ? [pr(`vendedor ${titulo(v0.nome.split(' ').slice(0, 2).join(' '))}`, ['fat_vend', 'pos_vend'], { filial: s.filial, rca: String(v0.rca) })] : []), pr('liga'), pr('incentivo da equipe'), pr('quanto tem na carteira?'), pr('a equipe caiu em relação ao mês passado?'), ...(v0 ? [pr(`o vendedor ${titulo(v0.nome.split(' ').slice(0, 2).join(' '))} está melhor ou pior que o mês passado?`, ['compara_mes'], { filial: s.filial, rca: String(v0.rca) })] : []), pr('como está a TPH?', s.filial === 'TPH' ? [] : ['escopo'])] });
  }
}
if (SO !== 'mes') {
  // supervisor pergunta ao Jota sobre CADA vendedor da equipe (rota do dia em detalhe)
  const prods = ['Snickers', 'Oreo', 'Tortug', 'Trident', 'Bis', 'Club Social', 'Turron', 'Halls'];
  for (const s of supervisores) {
    const perfil = { nome: s.nome, papel: 'supervisor', filial: s.filial, grupo: s.grupo, supervisor: s.nome };
    for (const v of vendMostrados(s.filial).filter((x) => sem(x.supervisor) === sem(s.nome) && VAREJO.test(String(x.canal)))) {
      const n = titulo(v.nome.split(' ').slice(0, 2).join(' ')), ctx = { filial: s.filial, rca: String(v.rca) }, prod = prods[Number(v.rca) % prods.length];
      sabs.push({ tipo: `Supervisor ${s.filial} → Vendedor (rota do dia)`, perfil, perguntas: [pr(`quais clientes o vendedor ${n} visitou hoje?`, ['rota_vend'], ctx), pr(`quais clientes o vendedor ${n} visitou e não vendeu? quais as justificativas?`, ['rota_vend'], ctx), pr(`quanto o vendedor ${n} vendeu hoje e qual o ticket?`, ['dig_vend'], ctx), pr(`quais clientes faltam visitar do vendedor ${n}?`), pr(`o que o vendedor ${n} vendeu de ${prod} no mês?`, ['produto_vend'], { ...ctx, prodTermo: prod })] });
    }
  }
}
sabs.length = Math.min(sabs.length, MAX);
console.log('sabatinas:', sabs.length, '· perguntas:', sabs.reduce((a, s) => a + s.perguntas.length, 0));
// ---------- RODA ----------
const B = _teste.criaBase(ORIGIN, {});
const out = []; let k = 0; const t0 = Date.now();
for (const s of sabs) {
  const hist = []; const reg = { tipo: s.tipo, quem: titulo(s.perfil.nome), papel: s.perfil.papel, filial: s.perfil.filial || 'Brasil', dialogo: [] };
  for (const p of s.perguntas) {
    let r = null, erro = null;
    try { r = await _teste.respostaPronta(B, s.perfil, p.q, hist.slice(-3)); } catch (e) { erro = String(e.message || e); }
    hist.push(p.q);
    const val = {};
    if (!erro && r != null) for (const c of p.checks) { const v = V[c] ? V[c](r, p.ctx) : null; if (v != null) val[c] = v; }
    const status = erro ? 'erro' : r == null ? 'sem resposta (IA)' : /undefined|NaN|\[object/.test(r) ? 'texto quebrado' : Object.values(val).some((x) => x !== 'ok') ? 'dado divergente' : 'ok';
    reg.dialogo.push({ pergunta: p.q, resposta: erro || r, status, validacao: val });
    if (++k % 100 === 0) console.log(`  ${k} perguntas (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  out.push(reg);
}
fs.unlinkSync(tmp);
// ---------- RELATÓRIO ----------
const pasta = path.join(raiz, 'MAIS_MIX/JOTA/sabatinas', hoje + (DIA ? '_rota' : '')); fs.mkdirSync(pasta, { recursive: true });
fs.writeFileSync(path.join(pasta, 'dialogos.json'), JSON.stringify(out, null, 1));
const todas = out.flatMap((s) => s.dialogo.map((d) => ({ ...d, tipo: s.tipo, quem: s.quem })));
const c = (f) => todas.filter(f).length, pc = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '-');
const val = todas.flatMap((d) => Object.entries(d.validacao).map(([k2, v]) => ({ k: k2, v, d })));
const porTipo = {}; for (const d of todas) { const t = d.tipo.replace(/\(.*?\)|TPH|ABC|API|TBL|TCV|TSJ|TCA|TBE|TPA|MCD|TCG|\/\w+/g, '').replace(/\s+/g, ' ').trim(); const x = porTipo[t] || (porTipo[t] = { n: 0, ok: 0, ia: 0, div: 0 }); x.n++; if (d.status === 'ok') x.ok++; if (d.status.startsWith('sem resposta')) x.ia++; if (d.status === 'dado divergente') x.div++; }
const porCheck = {}; for (const x of val) { const y = porCheck[x.k] || (porCheck[x.k] = { n: 0, ok: 0, ex: [] }); y.n++; if (x.v === 'ok') y.ok++; else if (y.ex.length < 4) y.ex.push(`${x.d.quem}: "${x.d.pergunta}" → ${x.v}`); }
const md = [`# Sabatinas do JOTA — ${hoje}${DIA ? ' (rota real de ' + DIA + ')' : ''}`, '', `**${out.length} sabatinas · ${todas.length} perguntas** · ok ${pc(c((d) => d.status === 'ok'), todas.length)} · sem resposta pronta (IA) ${pc(c((d) => d.status.startsWith('sem resposta')), todas.length)} · dado divergente ${pc(c((d) => d.status === 'dado divergente'), todas.length)} · erro/texto quebrado ${c((d) => d.status === 'erro' || d.status === 'texto quebrado')}`, '',
  `**Validação dado por dado:** ${val.length} números conferidos com recálculo independente das fontes · **${pc(val.filter((x) => x.v === 'ok').length, val.length)} batem**`, '',
  '## Por tipo de sabatina', '| Sabatina | Perguntas | OK | Sem resposta (IA) | Dado divergente |', '|---|---|---|---|---|', ...Object.entries(porTipo).map(([t, x]) => `| ${t} | ${x.n} | ${pc(x.ok, x.n)} | ${pc(x.ia, x.n)} | ${pc(x.div, x.n)} |`), '',
  '## Por dado validado', '| Dado | Conferidos | Batem | Exemplos de divergência |', '|---|---|---|---|', ...Object.entries(porCheck).map(([k2, y]) => `| ${k2} | ${y.n} | ${pc(y.ok, y.n)} | ${y.ex.join('<br>').replace(/\|/g, '/')} |`), '',
  '## Perguntas sem resposta pronta (amostra)', ...todas.filter((d) => d.status.startsWith('sem resposta')).slice(0, 40).map((d) => `- ${d.quem} (${d.tipo}): "${d.pergunta}"`)].join('\n');
fs.writeFileSync(path.join(pasta, 'RELATORIO.md'), md + '\n');
console.log('\n' + md.split('\n').slice(0, 4).join('\n') + `\nrelatório: ${path.relative(raiz, pasta)}`);
