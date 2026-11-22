// =========================================================================
// FICHA DO ARQUIVO: functions/api/liga-clube.js
// O QUE É: LANCES DA LIGA (Champions) SEM O CEVEN — Clube da Venda (check-ins, justificativas, totais do dia) + GEROT (pedidos do dia por cliente,
//   meta e faturado do mes). Vitorio, 17/11/2026: "colocar no ar urgente a Champions... o CEVEN nao vai voltar tao cedo" e "eu preciso colocar tudo no ar hoje".
//   MESMAS CHAVES, LIMITES E PROVAS do coletor antigo (functions/api/cron-lances.js -> calcAlertas), para a pontuacao, a auditoria do fechamento
//   (functions/_lib/auditoria_lance.js) e as telas continuarem iguais.
// LANCES COM FONTE: pedido na rota, defesa (tag RECORRENCIA), resgate de inativo (+30 d varejo / +90 d AS, sem a tag), hat-trick (3 visitas seguidas com venda),
//   conversao (8+ visitas, 50%+ com venda), goleada (10+ clientes positivados na rota), super pedido (digitado do dia no Clube), relampago (check-in antes das 9h/10h fuso),
//   acrescimos (check-in 16h30-18h / 17h30-19h fuso), campeao (faturado GEROT >= meta, 1x no mes), penalti (justificativa estoque +30 d / fechado +45 d),
//   impedimento de visita 00:00 (check-in = check-out), amarelo (sem check-in ate 10h/11h fuso) e vermelho de abandono (sem visita ate 11h/12h fuso).
// SEM FONTE AINDA (ficam de fora, nunca estimados): marca propria / tripla / dobrou o mix / bonificacao (itens do pedido), meta do 1o tempo (digitado ate 14h),
//   impedimento de GPS (o Clube nao traz coordenada), devolucoes (tela Devolucoes do GEROT, proxima etapa), dobradinha das quinzenas.
// "VISITOU E COMPROU" = check-in do cliente no Clube + pedido do mesmo cliente, do mesmo vendedor, com data do dia no GEROT (gerot_pedido).
// USO: GET ?dia=AAAA-MM-DD (ensaio: so conta) · &grava=1 grava em tv_lances (INSERT OR IGNORE) · &refecha=1 refaz o fechamento do dia (guarda copia antes).
//   Chave: ?chave= (jota_admin_token) ou X-Evo-Key.
// =========================================================================
import R from '../../public/regras.js';
import { chaveAdminOk } from '../_lib/chave_admin_jota.js';
import { chaveEvoValida } from '../_lib/chave_evo.js';
import { ocultosDaEquipe, lanceDeOculto } from '../_lib/equipe_ocultos.js';
import { diaSemLance, ehFeriado } from '../_lib/feriados.js';
import { fechaDia } from '../_lib/liga_fechamento.js';

// GPS (copia da regra de functions/api/cron-lances.js): distancia em metros e pontos da empresa (GPS nao captado = nunca impedimento)
const DEV_COMERCIAL = /SEM DINHEIRO|COND.{1,3}PAGTO|EMITIU COD|PEDIDO DUPLICADO|RECUSOU MERC|PRECO DIFERENTE/;   // igual ao cron-lances.js
const PONTOS_EMPRESA =[[-23.2493, -45.9245], [-22.8952, -47.0475]];
function distM(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || isNaN(v) || Number(v) === 0)) return null;
  const R0 = 6371000, rad = (x) => (x * Math.PI) / 180, dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R0 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const CORS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });
const FUSO1H = ['TCG', 'MCD', 'TCA'];
const CAMPO = R.CANAIS_VAREJO || ['VJ', 'PET VJ', 'FARMA', 'ESP'];
const DIAS_PENALTI_ESTOQUE = 30, DIAS_PENALTI_FECHADO = 45;
const brl = (x) => 'R$ ' + Math.round(x || 0).toLocaleString('pt-BR');
const hmDe = (s) => { const m = /(\d{2}):(\d{2})/.exec(String(s || '')); return m ? { min: +m[1] * 60 + +m[2], hms: `${m[1]}:${m[2]}` } : null; };
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const hhmmss = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;
const lote = async (db, sql, ids, extra = []) => { const out = []; for (let i = 0; i < ids.length; i += 80) { const p = ids.slice(i, i + 80); const { results } = await db.prepare(sql.replace('(?)', `(${p.map(() => '?').join(',')})`)).bind(...extra, ...p).all(); out.push(...(results || [])); } return out; };

export async function calculaLances(env, origin, dia, conferir = false) {
  const hojeAgora = R.relogioSP();
  const db = env.DB, ocultos = await ocultosDaEquipe(origin).catch(() => new Set());
  // EQUIPE (Gestao de Equipe via /api/tv-mostra): nome, supervisor, canal; quem nao participa da Liga fica fora
  const eq = new Map(); const semLances = new Set();
  try { const m = await (await fetch(`${origin}/api/tv-mostra`, { signal: AbortSignal.timeout(15000) })).json(); for (const [fil, lista] of Object.entries(m.filiais || {})) for (const v of lista || []) { if (!v || v.rca == null) continue; const k = String(fil).toUpperCase().slice(0, 3) + '|' + v.rca; eq.set(k, { filial: String(fil).toUpperCase().slice(0, 3), rca: String(v.rca), nome: v.nome, sup: v.supervisor || '', canal: String(v.canal || '').toUpperCase() }); if (v.participa && v.participa.lances === false) semLances.add(k); } } catch (e) { return { erro: 'sem a Gestao de Equipe (tv-mostra)' }; }
  const [{ results: VD }, { results: CK }, { results: JU }] = await Promise.all([
    db.prepare('SELECT filial, rca, roteiros, visitas_rota, ped_rota, ped_total, total_pedido FROM clube_venda_dia WHERE dia = ?').bind(dia).all(),
    db.prepare('SELECT filial, rca, tipo, data_hora, cliente, cnpj, fantasia, razao FROM clube_checkin WHERE dia = ? ORDER BY data_hora').bind(dia).all(),
    db.prepare('SELECT filial, rca, cliente, cnpj, fantasia, razao, dias_sem_comprar, motivo, data_hora FROM clube_justificativa WHERE dia = ?').bind(dia).all(),
  ]);
  if (!VD || !VD.length) return { erro: 'sem leitura do Clube nesse dia' };
  // PEDIDOS DO DIA (GEROT): filial|rca|cliente -> pedidos
  const { results: PD } = await db.prepare('SELECT filial, rca, cliente, pedido, dados FROM gerot_pedido WHERE data = ?').bind(dia).all();
  const ped = new Map(); for (const p of PD || []) { const k = `${p.filial}|${p.rca}|${p.cliente}`; if (!ped.has(k)) ped.set(k, []); if (!ped.get(k).includes(p.pedido)) ped.get(k).push(p.pedido); }
  // 17/11/2026: no 'Pedidos' do GEROT a data do pedido JA FATURADO e a do faturamento; a data do pedido vem da ENTRADA na Carteira Total (guardada em gerot_pedido_entrada)
  const pedC = new Map(); const addC = (r) => { const k = `${r.filial}|${r.rca}|${String(r.cnpj || '').replace(/\D/g, '')}`; if (!r.rca || !r.cnpj) return; if (!pedC.has(k)) pedC.set(k, []); if (!pedC.get(k).includes(r.pedido)) pedC.get(k).push(r.pedido); };
  for (const sql of ['SELECT filial, rca, cnpj, pedido FROM gerot_pedido_entrada WHERE entrada = ?', 'SELECT filial, rca, cnpj, pedido FROM gerot_carteira WHERE entrada = ?']) { try { const { results } = await db.prepare(sql).bind(dia).all(); for (const r of results || []) addC(r); } catch (e) { /* tabela ainda vazia */ } }
  // 18/11/2026: MARCA PROPRIA DO PEDIDO DO DIA pelos itens da Carteira Total do GEROT (mp = R$ de TRIUNFANTE BRASIL sem o palete 8171; o maior valor ja visto do pedido)
  const mpPorPed = new Map();
  for (const sql of ['SELECT filial, rca, cnpj, pedido, mp, skus FROM gerot_pedido_entrada WHERE entrada = ? AND (mp > 0 OR skus > 0)', 'SELECT filial, rca, cnpj, pedido, mp, skus FROM gerot_carteira WHERE entrada = ? AND (mp > 0 OR skus > 0)']) { try { const { results } = await db.prepare(sql).bind(dia).all(); for (const r of results || []) { const kp = r.filial + '|' + r.pedido; const o = mpPorPed.get(kp), cn = String(r.cnpj || '').replace(/\D/g, ''); mpPorPed.set(kp, { k: `${r.filial}|${r.rca}|${cn}`, filial: r.filial, cnpj: cn, pedido: r.pedido, mp: Math.max(Number(r.mp) || 0, o ? o.mp : 0), skus: Math.max(Number(r.skus) || 0, o ? o.skus : 0) }); } } catch (e) { /* colunas ainda nao existem */ } }
  const mpPed = new Map(); for (const o of mpPorPed.values()) { const x = mpPed.get(o.k) || { mp: 0, pedido: o.pedido, skus: 0, pedSkus: o.pedido }; x.mp += o.mp; if (o.skus > x.skus) { x.skus = o.skus; x.pedSkus = o.pedido; } mpPed.set(o.k, x); }
  // DOBROU O MIX (mesma regra de tv-vendedor.js mixDobrado): SKUs do pedido de hoje x media de SKUs dos pedidos ANTERIORES do cliente.
  // gerot_pedido_entrada guarda os SKUs por pedido desde 18/11/2026; sem pedido anterior gravado = sem gol (nunca estimado)
  const mixHist = new Map();
  for (const fil of [...new Set([...mpPorPed.values()].filter((o) => o.skus > 0).map((o) => o.filial))]) {
    const cn = [...new Set([...mpPorPed.values()].filter((o) => o.filial === fil && o.skus > 0 && o.cnpj).map((o) => o.cnpj))];
    for (const r of await lote(db, 'SELECT cnpj, AVG(skus) m, COUNT(*) n FROM gerot_pedido_entrada WHERE filial = ? AND entrada < ? AND skus > 0 AND cnpj IN (?) GROUP BY cnpj', cn, [fil, dia]).catch(() => [])) mixHist.set(fil + '|' + r.cnpj, { m: Number(r.m) || 0, n: Number(r.n) || 0 });
  }
  const mixDobrado = (atual, media, canal) => (atual == null || media == null ? false : canal === 'AS' ? atual >= media + 2 : media <= 5 ? atual >= 10 : atual >= 2 * media);
  // 17/11/2026: PEDIDO DO CLUBE (Relatorio de Pedido): vendedor + cliente + dia, na hora — a prova mais direta de 'comprou na visita'
  const pedCl = new Map(); try { const { results } = await db.prepare('SELECT filial, rca, cliente, pedido, pedido_winthor FROM clube_pedido WHERE dia = ?').bind(dia).all(); for (const r of results || []) { const k = r.filial + '|' + r.rca + '|' + r.cliente, n = r.pedido_winthor && Number(r.pedido_winthor) > 0 ? r.pedido_winthor : r.pedido; if (!pedCl.has(k)) pedCl.set(k, []); pedCl.get(k).push(n); } } catch (e) { /* dia sem a tabela */ }
  // VISITAS por vendedor: cliente -> entrada/saida
  const vis = new Map();
  for (const c of CK || []) {
    const k = `${c.filial}|${c.rca}`; if (!vis.has(k)) vis.set(k, new Map()); const M = vis.get(k), cid = String(c.cliente || ''); if (!cid) continue;
    const x = M.get(cid) || { id: cid, cnpj: String(c.cnpj || '').replace(/\D/g, ''), nome: c.fantasia || c.razao || `Cliente #${cid}`, ini: null, fim: null };
    const h = hmDe(c.data_hora); if (!h) continue;
    if (/IN/i.test(c.tipo) && (!x.ini || h.min < x.ini.min)) x.ini = h; if (/OUT/i.test(c.tipo) && (!x.fim || h.min > x.fim.min)) x.fim = h;
    M.set(cid, x);
  }
  const jus = new Map(); for (const j of JU || []) { const k = `${j.filial}|${j.rca}`; if (!jus.has(k)) jus.set(k, new Map()); jus.get(k).set(String(j.cliente), j); }
  // ULTIMA COMPRA ANTES DO DIA (resgate de inativo): ficha do cliente (historico ate 11/11) + pedidos do GEROT antes do dia
  const vendidos = []; for (const [k, M] of vis) for (const x of M.values()) if (pedCl.has(`${k}|${x.id}`) || ped.has(`${k}|${x.id}`) || (x.cnpj && pedC.has(`${k}|${x.cnpj}`))) vendidos.push({ fil: k.slice(0, 3), id: x.id });
  // DOBRADINHA DAS QUINZENAS (G04): cliente com pedido hoje (2a quinzena) e pedido na 1a quinzena do mesmo mes (data do GEROT: faturamento ou entrada na carteira;
  // faturado depois do dia 15 nao conta = na duvida, sem gol)
  const q1 = new Map();
  if (Number(dia.slice(8, 10)) >= 16) for (const fil of [...new Set(vendidos.map((x) => x.fil))]) {
    const ids = [...new Set(vendidos.filter((x) => x.fil === fil).map((x) => x.id))];
    for (const r of await lote(db, 'SELECT cliente, MIN(data) d, MIN(pedido) p FROM gerot_pedido WHERE filial = ? AND data >= ? AND data <= ? AND cliente IN (?) GROUP BY cliente', ids, [fil, dia.slice(0, 8) + '01', dia.slice(0, 8) + '15']).catch(() => [])) q1.set(fil + '|' + r.cliente, { d: r.d, p: r.p });
  }
  const ult = new Map();
  for (const fil of [...new Set(vendidos.map((x) => x.fil))]) {
    const ids = [...new Set(vendidos.filter((x) => x.fil === fil).map((x) => x.id))];
    for (const r of await lote(db, "SELECT id_cliente, json_extract(json, '$.ult') u FROM ficha_cliente WHERE filial = ? AND id_cliente IN (?)", ids, [fil]).catch(() => [])) { const u = String(r.u || '').slice(0, 10); if (/^\d{4}-\d\d-\d\d$/.test(u) && u < dia) ult.set(fil + '|' + r.id_cliente, u); }
    for (const r of await lote(db, 'SELECT cliente, MAX(data) u FROM gerot_pedido WHERE filial = ? AND data < ? AND cliente IN (?) GROUP BY cliente', ids, [fil, dia]).catch(() => [])) { const k = fil + '|' + r.cliente; if (r.u && (!ult.has(k) || r.u > ult.get(k))) ult.set(k, r.u); }
  }
  // TAGS (Clientes Foco): recorrencia por CNPJ; vendedor sem nenhuma tag gravada = tags desconhecidas (nao cria resgate, igual ao coletor antigo)
  const tags = new Map(), comTag = new Set();
  try { const { results } = await db.prepare('SELECT filial, rca, id_cliente, tag FROM cliente_focos').all(); for (const t of results || []) { comTag.add(`${t.filial}|${t.rca}`); if (/RECORR/i.test(t.tag || '')) tags.set(`${t.filial}|${String(t.id_cliente).replace(/\D/g, '')}`, true); } } catch (e) { /* sem tags */ }
  // META x FATURADO DO MES (GEROT) para o campeao + campeao ja dado no mes
  const metaFat = new Map(); try { const { results } = await db.prepare(`SELECT filial, rca, json_extract(dados, '$."Meta (R$)"') m, json_extract(dados, '$."Faturado líquido (R$)"') f FROM gerot_vendedor_mes WHERE mes = ?`).bind(dia.slice(0, 7)).all(); for (const r of results || []) metaFat.set(`${r.filial}|${r.rca}`, { meta: Number(r.m) || 0, fat: Number(r.f) || 0 }); } catch (e) { /* sem GEROT */ }
  const campeaoJa = new Set(); try { const { results } = await db.prepare("SELECT filial, rca FROM tv_lances WHERE chave LIKE 'gol_campeao|%' AND dia >= ? AND dia < ?").bind(dia.slice(0, 8) + '01', dia).all(); for (const r of results || []) campeaoJa.add(`${r.filial}|${r.rca}`); } catch (e) { /* segue */ }
  const hatJa = new Set(); if (!conferir) try { const { results } = await db.prepare("SELECT filial, rca FROM tv_lances WHERE dia = ? AND chave LIKE 'gol_hattrick|%'").bind(dia).all(); for (const r of results || []) hatJa.add(`${r.filial}|${r.rca}`); } catch (e) { /* segue */ }

  // DEVOLUCOES do dia com motivo oficial (CEVEN admin -> ceven_devolucao_nota + devolucao_nota_motivo)
  const devs = new Map(); try { const { results } = await db.prepare('SELECT d.filial, d.rca, d.nota, d.data, d.valor, d.cliente_id, d.cliente, m.nao_pediu, m.motivos FROM ceven_devolucao_nota d JOIN devolucao_nota_motivo m ON m.rca = d.rca AND m.nota = d.nota WHERE d.data = ? AND d.valor > 0').bind(dia).all(); for (const r of results || []) { const kk = r.filial + '|' + r.rca; if (!devs.has(kk)) devs.set(kk, []); devs.get(kk).push(r); } } catch (e) { /* tabela ainda nao existe */ }
  // GPS das visitas (CEVEN do gerente, functions/_lib/gps_gerente.js)
  const gps = new Map(); try { const { results } = await db.prepare('SELECT filial, rca, cliente, cli_lat, cli_lon, co_lat, co_lon, checkin, checkout FROM ceven_gps_visita WHERE dia = ?').bind(dia).all(); for (const r of results || []) { const kk = r.filial + '|' + r.rca; if (!gps.has(kk)) gps.set(kk, []); gps.get(kk).push(r); } } catch (e) { /* tabela ainda nao existe */ }
  const L = [];
  const fonte = ' | FONTE: Clube da Venda + GEROT';
  for (const d of VD) {
    const k = `${d.filial}|${d.rca}`, e = eq.get(k);
    if (!e || semLances.has(k) || lanceDeOculto({ filial: d.filial, rca: d.rca }, ocultos)) continue;
    const fuso = FUSO1H.includes(d.filial), as = ['AS', 'PET AS'].includes(e.canal), campo = CAMPO.includes(e.canal);
    const base = { filial: d.filial, rca: e.rca, vendedor: e.nome, supervisor: e.sup };
    const add = (l) => L.push({ ...base, ...l });
    const M = vis.get(k) || new Map(), V = [...M.values()].filter((x) => x.ini).sort((a, b) => a.ini.min - b.ini.min);
    // VENDA NA VISITA (so com prova): pedido do dia no GEROT, pedido com entrada no dia na carteira (CNPJ), ou o vendedor cuja conta do Clube fecha exata
    // (visitados sem justificativa = pedidos na rota do Clube)
    const Jv = jus.get(k) || new Map(), semJus = [...M.values()].filter((x) => x.ini && !Jv.has(x.id)), clubeOk = semJus.length > 0 && semJus.length === (Number(d.ped_rota) || 0);
    const pedDe = (x) => (pedCl.get(`${k}|${x.id}`) || ped.get(`${k}|${x.id}`) || pedC.get(`${k}|${x.cnpj}`) || [])[0] || null;
    // 22/11/2026 (auditoria lance por lance): a 'conta do Clube que fecha' (visitas sem justificativa = pedidos na rota) dava venda SEM pedido do cliente
    //   (18-19/11: ~220 lances sem pedido em nenhuma base). Positivado = pedido (Vitorio): so vale com pedido do cliente no Clube ou no GEROT.
    const venda = (x) => !!pedDe(x);
    const feitas = V.length, comVenda = V.filter(venda).length, dig = Number(d.total_pedido) || 0;
    // clientes visitados com pedido: pedido na rota, defesa, resgate
    for (const x of V.filter(venda)) {
      const pn = pedDe(x), u = ult.get(`${d.filial}|${x.id}`) || null, dias = u ? diasEntre(u, dia) : null;
      const rec = !!(x.cnpj && tags.get(`${d.filial}|${x.cnpj}`)), conhecidas = comTag.has(k);
      const prova = (pn ? `PEDIDO DE HOJE: ${pn} · GEROT` : `venda confirmada pelo Clube (${semJus.length} visitas sem justificativa = ${Number(d.ped_rota) || 0} pedidos na rota)`) + ` | check-in ${x.ini.hms}${x.fim ? ` | check-out ${x.fim.hms}` : ''}${fonte}`;
      const h = hhmmss(Math.max(x.ini.min, 6 * 60));
      add({ chave: `pedido_rota|${e.rca}|${x.id}`, nivel: 'pedido_rota', cliente_id: x.id, cliente: x.nome, ultima_compra: u, obs: prova, hora_sp: h });
      if (rec) add({ chave: `def|${e.rca}|${x.id}`, nivel: 'defesa', cliente_id: x.id, cliente: x.nome, ultima_compra: u, obs: prova, hora_sp: h });
      if (pn && dias != null && dias > (as ? 90 : 30) && !rec && conhecidas) add({ chave: `gol_inativo|${e.rca}|${x.id}`, nivel: 'gol', cliente_id: x.id, cliente: x.nome, ultima_compra: u, dias_sem_compra: dias, obs: prova, hora_sp: h });
    }
    // hat-trick: 3 visitas seguidas com venda (1 por dia)
    if (!hatJa.has(k)) for (let i = 0; i + 2 < V.length; i++) if (venda(V[i]) && venda(V[i + 1]) && venda(V[i + 2])) { add({ chave: `gol_hattrick|${e.rca}|${V[i + 2].ini.hms}`, nivel: 'hattrick', obs: `3 vendas seguidas (3 check-ins em ${V[i + 2].ini.min - V[i].ini.min} min): ${V[i].ini.hms}, ${V[i + 1].ini.hms}, ${V[i + 2].ini.hms}${fonte}`, hora_sp: hhmmss(V[i + 2].ini.min) }); break; }
    if (feitas >= 8 && comVenda / feitas >= 0.5) add({ chave: `gol_conversao|${e.rca}`, nivel: 'gol', obs: `${comVenda} com venda em ${feitas} visitas = ${Math.round(comVenda / feitas * 100)}%${fonte}`, hora_sp: hhmmss(Math.max(V[V.length - 1].ini.min, 6 * 60)) });
    if (comVenda >= 10) add({ chave: `gol_goleada|${e.rca}`, nivel: 'gol', obs: `${comVenda} clientes positivados na rota (${Number(d.ped_total) || 0} pedidos, digitado ${brl(dig)})${fonte}`, hora_sp: hhmmss(Math.max(V[V.length - 1].ini.min, 6 * 60)) });
    const minSuper = as ? 75000 : 15000;
    if (dig >= minSuper) add({ chave: `gol_super|${e.rca}`, nivel: 'gol', obs: `digitado do dia ${brl(dig)} (minimo R$ ${minSuper.toLocaleString('pt-BR')})${fonte}`, hora_sp: '19:00:00' });
    // relampago / acrescimos pelo horario do check-in (mesma regra do coletor antigo)
    const limR = (fuso ? 10 : 9) * 60, cedo = V.find((x) => x.ini.min < limR && x.ini.min >= 6 * 60 && venda(x));   /* regulamento: PEDIDO fechado com check-in antes das 9h */
    if (cedo) add({ chave: `gol_relampago|${e.rca}`, nivel: 'gol', obs: `check-in as ${cedo.ini.hms} (antes das ${limR / 60}h)${fonte}`, hora_sp: hhmmss(cedo.ini.min) });
    const acrIni = (fuso ? 17 : 16) * 60 + 30, acrFim = (fuso ? 19 : 18) * 60, tarde = V.slice().reverse().find((x) => x.ini.min >= acrIni && x.ini.min <= acrFim && venda(x));   /* regulamento: PEDIDO fechado no fim do expediente */
    if (tarde) add({ chave: `gol_acrescimos|${e.rca}`, nivel: 'gol', obs: `check-in as ${tarde.ini.hms} (janela ${Math.floor(acrIni / 60)}h${String(acrIni % 60).padStart(2, '0')} ate ${acrFim / 60}h00)${fonte}`, hora_sp: hhmmss(tarde.ini.min) });
    // dobradinha: o cliente visitado com pedido hoje que ja tinha comprado na 1a quinzena
    for (const x of V.filter(venda)) { const a = q1.get(`${d.filial}|${x.id}`), pn = pedDe(x); if (a && pn) add({ chave: `gol_quinzenas|${e.rca}|${x.id}`, nivel: 'gol', cliente_id: x.id, cliente: x.nome, obs: `PEDIDO DE HOJE: ${pn} · GEROT | QUINZENAS: 1a quinzena pedido ${a.p} em ${a.d.slice(8, 10)}/${a.d.slice(5, 7)} · 2a quinzena hoje${fonte}`, hora_sp: hhmmss(Math.max(x.ini.min, 6 * 60)) }); }
    // GOL DE MARCA PROPRIA (R$ 50+ de MP no pedido do cliente visitado) e TRIPLA (3+ clientes assim no dia) — 18/11/2026, itens da Carteira Total do GEROT
    { const mpCli = [];
      for (const x of V.filter(venda)) { const m = x.cnpj ? mpPed.get(`${k}|${x.cnpj}`) : null; if (!m || m.mp < 50) continue; mpCli.push({ x, m });
        add({ chave: `gol_marca_propria|${e.rca}|${x.id}`, nivel: 'gol', cliente_id: x.id, cliente: x.nome, obs: `MARCA PROPRIA R$ ${m.mp.toFixed(2).replace('.', ',')} (minimo R$ 50) | PEDIDO DE HOJE: ${m.pedido} · GEROT Carteira Total | check-in ${x.ini.hms}${fonte}`, hora_sp: hhmmss(Math.max(x.ini.min, 6 * 60)) }); }
      for (const x of V.filter(venda)) { const m = x.cnpj ? mpPed.get(`${k}|${x.cnpj}`) : null, h = m && mixHist.get(`${d.filial}|${x.cnpj}`); if (m && h && h.n >= 1 && m.skus > 0 && mixDobrado(m.skus, h.m, e.canal)) add({ chave: `gol_mix|${e.rca}|${x.id}`, nivel: 'gol', cliente_id: x.id, cliente: x.nome, obs: `PEDIDO DE HOJE: ${m.pedSkus} · GEROT Carteira Total | MIX: ${m.skus} SKUs hoje x média ${h.m.toFixed(1).replace('.', ',')} em ${h.n} pedido(s) anterior(es) | check-in ${x.ini.hms}${fonte}`, hora_sp: hhmmss(Math.max(x.ini.min, 6 * 60)) }); }
      if (mpCli.length >= 3) add({ chave: `gol_mp_tripla|${e.rca}`, nivel: 'gol', obs: `${mpCli.length} clientes com R$ 50+ de MARCA PROPRIA no dia (minimo 3): ` + mpCli.map(({ x, m }) => `${x.nome} R$ ${m.mp.toFixed(2).replace('.', ',')}`).join('; ') + fonte, hora_sp: hhmmss(Math.max(mpCli[mpCli.length - 1].x.ini.min, 6 * 60)) }); }
    // META DO 1o TEMPO (so ao vivo, antes das 14h: o digitado do Clube NAQUELE momento >= meta proporcional do dia, a mesma conta do coletor antigo)
    if (dia === hojeAgora.dia && hojeAgora.min < 14 * 60 && V.length) {
      const mf1 = metaFat.get(k), [yy, mm] = dia.split('-').map(Number), fimM = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
      let totU = 0, ateH = 0; for (let dd = 1; dd <= fimM; dd++) { const iso = `${dia.slice(0, 8)}${String(dd).padStart(2, '0')}`, w = new Date(iso + 'T12:00:00Z').getUTCDay(); if (w > 0 && w < 6 && !ehFeriado(iso)) { totU++; if (iso <= dia) ateH++; } }
      const metaDia = mf1 && mf1.meta > 0 && totU ? mf1.meta / totU * ateH : 0;
      if (metaDia > 0 && dig >= metaDia) add({ chave: `gol_meta1t|${e.rca}`, nivel: 'gol', obs: `digitado R$ ${Math.round(dig).toLocaleString('pt-BR')} >= meta proporcional do dia R$ ${Math.round(metaDia).toLocaleString('pt-BR')}; check-in as ${V[V.length - 1].ini.hms}${fonte}`, hora_sp: hhmmss(hojeAgora.min) });
    }
    const mf = metaFat.get(k);
    if (mf && mf.meta > 0 && mf.fat >= mf.meta && !campeaoJa.has(k)) add({ chave: `gol_campeao|${e.rca}|${dia.slice(0, 7)}`, nivel: 'gol', obs: `faturado do mes ${brl(mf.fat)} >= meta ${brl(mf.meta)} | FONTE: GEROT`, hora_sp: '19:00:00' });
    // DEVOLUCAO (22/11/2026): nota registrada NO DIA (data da nota no CEVEN, lida pelo admin como o vendedor) com o MOTIVO OFICIAL da nota.
    //   'CLIENTE NAO PEDIU' = vermelho (ver_dev); motivo comercial = gol contra (golcontra_dev); outro motivo ou sem motivo lido = nada (mesma regra do cron-lances.js)
    for (const n of devs.get(k) || []) {
      const base = `nota ${n.nota} de ${n.data} | ${brl(n.valor)} | ${n.cliente || 'cliente sem nome'} | motivo oficial: ${n.motivos} | FONTE: CEVEN (admin)`;
      if (n.nao_pediu === 1) add({ chave: `ver_dev|${e.rca}|${n.nota}`, nivel: 'vermelho', cliente_id: n.cliente_id, cliente: n.cliente, motivo: n.motivos, obs: base, hora_sp: '18:00:00' });
      else if (DEV_COMERCIAL.test(n.motivos || '')) add({ chave: `golcontra_dev|${e.rca}|${n.nota}`, nivel: 'golcontra', cliente_id: n.cliente_id, cliente: n.cliente, motivo: n.motivos, obs: base, hora_sp: '18:00:00' });
    }
    if (!campo) continue;
    // penalti / impedimento: cliente com justificativa (nao vendeu)
    const J = jus.get(k) || new Map();
    for (const [cid, j] of J) {
      { const xv = M.get(cid); if (xv && xv.ini && venda(xv)) continue; if (ped.has(`${k}|${cid}`)) continue; }
      const m = String(j.motivo || '').toUpperCase(), dias = j.dias_sem_comprar != null && j.dias_sem_comprar !== '' ? Number(j.dias_sem_comprar) : null, x = M.get(cid);
      const h = hmDe(j.data_hora), hora = hhmmss(Math.max(h ? h.min : 12 * 60, 6 * 60)), nome = j.fantasia || j.razao || `Cliente #${cid}`;
      if (m.includes('ESTOQUE SUFICIENTE') && (dias != null && dias > DIAS_PENALTI_ESTOQUE)) add({ chave: `pen|estoque|${e.rca}|${cid}`, nivel: 'penalti', cliente_id: cid, cliente: nome, motivo: j.motivo, dias_sem_compra: dias, obs: `justificativa ${j.motivo} · ${dias ?? '?'} dias sem comprar${fonte}`, hora_sp: hora });
      else if ((m.includes('FECHADO') || m.includes('ENCERROU')) && (dias != null && dias > DIAS_PENALTI_FECHADO)) add({ chave: `pen|fechado|${e.rca}|${cid}`, nivel: 'penalti', cliente_id: cid, cliente: nome, motivo: j.motivo, dias_sem_compra: dias, obs: `justificativa ${j.motivo} · ${dias ?? '?'} dias sem comprar${fonte}`, hora_sp: hora });
      else if (x && x.ini && x.fim && x.ini.min === x.fim.min) add({ chave: `imp|visita0|${e.rca}|${cid}`, nivel: 'impedimento', cliente_id: cid, cliente: nome, motivo: j.motivo, tempo_visita: '00:00', obs: `check-in ${x.ini.hms} | check-out ${x.fim.hms} | tempo 00:00 | visita de 00:00 (sem permanencia)${fonte}`, hora_sp: hhmmss(Math.max(x.fim.min, 6 * 60)) });
    }
    // IMPEDIMENTO POR GPS (22/11/2026): GPS do check-out pelo CEVEN do GERENTE (ceven_gps_visita). Mesma regra do coletor antigo (cron-lances.js, 05/10/2026):
    //   500 m < distancia do cadastro <= 5 km; fora dos pontos da empresa (GPS nao captado); ponto nao repetido (+-100 m) em outra visita do mesmo vendedor
    { const G = gps.get(k) || [];
      for (const c of G) {
        const dM = distM(c.cli_lat, c.cli_lon, c.co_lat, c.co_lon);
        if (dM == null || !(dM > 500 && dM <= 5000)) continue;
        if (PONTOS_EMPRESA.some((p) => distM(c.co_lat, c.co_lon, p[0], p[1]) <= 1000)) continue;
        if (G.filter((x) => distM(x.co_lat, x.co_lon, c.co_lat, c.co_lon) <= 100).length >= 2) continue;
        const xv = M.get(String(c.cliente)), hc = hmDe(String(c.checkout || '').replace('T', ' ')) || (xv && xv.fim) || null;
        add({ chave: `imp|gps|${e.rca}|${c.cliente}`, nivel: 'impedimento', cliente_id: String(c.cliente), cliente: (xv && xv.nome) || `Cliente #${c.cliente}`, obs: `check-out a ${Math.round(dM)} m do cadastro do cliente; cadastro ${c.cli_lat},${c.cli_lon}; check-out ${c.co_lat},${c.co_lon}${c.checkin ? ' | check-in ' + c.checkin : ''}${c.checkout ? ' | check-out ' + c.checkout : ''} | FONTE: CEVEN (gerente)`, hora_sp: hc ? hhmmss(Math.max(hc.min, 6 * 60)) : '12:00:00' });
      } }
    // cartoes de rota: rota no Clube e nenhum check-in ate o limite
    const rot = Number(d.roteiros) || 0, prim = V.length ? V[0].ini.min : null, limA = (fuso ? 11 : 10) * 60, limV = (fuso ? 12 : 11) * 60;
    if (rot > 0 && (prim == null || prim >= limA)) add({ chave: `ven10|${e.rca}`, nivel: 'amarelo', obs: `nenhuma visita nem check-in de varejo (${rot} clientes na rota) as ${limA / 60}h (limite ${limA / 60}h)${fonte}`, hora_sp: hhmmss(limA) });
    if (rot > 0 && (prim == null || prim >= limV)) add({ chave: `vis11|${e.rca}`, nivel: 'vermelho', obs: `${rot} clientes na rota, 0 visitas feitas as ${limV / 60}h (limite ${limV / 60}h)${fonte}`, hora_sp: hhmmss(limV) });
  }
  return { L, vendedores: VD.length, pedidos_gerot: (PD || []).length };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return resp({ erro: 'banco indisponivel' }, 503);
  if (!(await chaveAdminOk(env, request)) && !(await chaveEvoValida(request, env))) return resp({ erro: 'nao autorizado' }, 401);
  const u = new URL(request.url), hoje = R.relogioSP().dia, agora = R.relogioSP();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : hoje;
  if (diaSemLance(dia)) return resp({ dia, status: 'fim de semana ou feriado: sem lance' });
  if (dia > hoje) return resp({ erro: 'dia futuro' }, 400);
  const c = await calculaLances(env, u.origin, dia, u.searchParams.get('conferir') === '1');
  if (c.erro) return resp({ dia, erro: c.erro });
  // no dia de hoje so grava o que ja aconteceu (cartao so depois do limite; nada antes das 06h)
  const agoraHms = `${String(agora.h).padStart(2, '0')}:${String(agora.m).padStart(2, '0')}:00`;
  let L = c.L; if (dia === hoje) L = L.filter((l) => l.hora_sp <= agoraHms);
  const porTipo = {}; for (const l of L) { const t = l.chave.split('|')[0]; porTipo[t] = (porTipo[t] || 0) + 1; }
  const porFilial = {}; for (const l of L) porFilial[l.filial] = (porFilial[l.filial] || 0) + 1;
  const saida = { dia, vendedores_clube: c.vendedores, pedidos_gerot_no_dia: c.pedidos_gerot, lances: L.length, por_tipo: porTipo, por_filial: porFilial };
  { const ver = String(u.searchParams.get('ver') || '').toUpperCase(); if (/^[A-Z]{3}\|\d+$/.test(ver)) saida.do_vendedor = c.L.filter((l) => `${l.filial}|${l.rca}` === ver).map((l) => ({ chave: l.chave, hora: l.hora_sp, obs: String(l.obs || '').slice(0, 160) })); }
  // CONFERENCIA LANCE POR LANCE (22/11/2026, Vitorio: 'auditoria em TODOS os lances... um por um'): recalcula das fontes e compara com o gravado.
  //   faltam = a regra da hoje e nao esta gravado · sobram = gravado por este motor (FONTE: Clube) e a regra nao da mais · lances de outro motor (CEVEN antigo) so contados
  if (u.searchParams.get('conferir') === '1') {
    const { results: G } = await env.DB.prepare('SELECT filial, chave, nivel, rca, obs FROM tv_lances WHERE dia = ?').bind(dia).all();
    // hat-trick vale 1 por vendedor no dia: compara por vendedor (a chave carrega a hora do 3o check-in, que muda com a sincronizacao do aparelho)
    const nk = (f, ch) => f + '#' + (/^gol_hattrick\|/.test(ch) ? ch.split('|').slice(0, 2).join('|') : ch);
    const calc = new Map(L.map((l) => [nk(l.filial, l.chave), l])), grav = new Map((G || []).map((g) => [nk(g.filial, g.chave), g]));
    const tipo = (ch) => ch.split('|')[0] + (/^(imp|pen)\|/.test(ch) ? '|' + ch.split('|')[1] : '');
    const faltam = [...calc].filter(([k]) => !grav.has(k)).map(([, l]) => ({ f: l.filial, chave: l.chave, obs: String(l.obs || '').slice(0, 140) }));
    const sobram = [...grav].filter(([k, g]) => !calc.has(k) && /FONTE: Clube/.test(g.obs || '')).map(([, g]) => ({ f: g.filial, chave: g.chave, obs: String(g.obs || '').slice(0, 140) }));
    const outros = [...grav].filter(([k, g]) => !calc.has(k) && !/FONTE: Clube/.test(g.obs || '')).length;
    const cont = (a) => a.reduce((o, x) => { const t = tipo(x.chave); o[t] = (o[t] || 0) + 1; return o; }, {});
    saida.conferencia = { gravados: grav.size, calculados: calc.size, iguais: [...calc.keys()].filter((k) => grav.has(k)).length, faltam: faltam.length, sobram: sobram.length, de_outro_motor: outros, faltam_por_tipo: cont(faltam), sobram_por_tipo: cont(sobram), exemplos_faltam: faltam.slice(0, 15), exemplos_sobram: sobram.slice(0, 15) };
    if (u.searchParams.get('lista') === '1') saida.conferencia.sobram_lista = sobram.map((x) => ({ f: x.f, chave: (grav.get(nk(x.f, x.chave)) || {}).chave || x.chave }));
  }
  if (u.searchParams.get('grava') === '1') {
    // 22/11/2026 (auditoria): (1) lance retirado pela auditoria nunca volta; (2) defesa e resgate de inativo nunca os dois no mesmo cliente e dia (vale o que ja esta gravado)
    try {
      const ret = new Set(((await env.DB.prepare('SELECT filial, chave FROM tv_lances_retirados WHERE dia = ?').bind(dia).all()).results || []).map((x) => x.filial + '#' + x.chave));
      const ja = ((await env.DB.prepare("SELECT filial, rca, cliente_id, substr(chave, 1, instr(chave, '|') - 1) t FROM tv_lances WHERE dia = ? AND (chave LIKE 'def|%' OR chave LIKE 'gol_inativo|%')").bind(dia).all()).results || []);
      const tem = new Map(ja.map((x) => [x.filial + '|' + x.rca + '|' + x.cliente_id, x.t]));
      L = L.filter((l) => { if (ret.has(l.filial + '#' + l.chave)) return false; const t0 = l.chave.split('|')[0]; if (t0 !== 'def' && t0 !== 'gol_inativo') return true; const o = tem.get(l.filial + '|' + l.rca + '|' + l.cliente_id); return !o || o === t0; });
    } catch (e) { /* tabela de retirados ainda nao existe */ }
    const iso = new Date().toISOString(), t = (v, n = 200) => (v == null ? null : String(v).slice(0, n));
    const st = L.map((l) => env.DB.prepare('INSERT OR IGNORE INTO tv_lances (dia, filial, chave, nivel, rca, vendedor, supervisor, cliente_id, cliente, motivo, dias_sem_compra, ultima_compra, tempo_visita, obs, hora_sp, visto_em, baseline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)')
      .bind(dia, l.filial, l.chave, l.nivel, t(l.rca, 20), t(l.vendedor), t(l.supervisor), t(l.cliente_id, 30), t(l.cliente), t(l.motivo), l.dias_sem_compra == null ? null : Math.trunc(l.dias_sem_compra), t(l.ultima_compra, 10), t(l.tempo_visita, 8), t(l.obs, 700), l.hora_sp, iso));
    let novos = 0; for (let i = 0; i < st.length; i += 80) { const rs = await env.DB.batch(st.slice(i, i + 80)); novos += rs.filter((r) => r.meta && r.meta.changes === 1).length; }
    saida.gravados_novos = novos;
    // CARTAO DE ROTA REFEITO A CADA RODADA (17/11/2026: Tatiana MCD 453 levou amarelo + vermelho as 13h com visitas desde 08:05 — o aparelho sincronizou depois):
    // vale a hora do check-in; se a visita apareceu depois, o cartao gravado por este motor sai. Cartao de outro motor (sem 'FONTE: Clube') nao e tocado.
    const vale = new Set(c.L.filter((l) => /^(ven10|vis11)\|/.test(l.chave)).map((l) => l.filial + '#' + l.chave));
    const { results: cart } = await env.DB.prepare("SELECT filial, chave FROM tv_lances WHERE dia = ? AND (chave LIKE 'ven10|%' OR chave LIKE 'vis11|%') AND obs LIKE '%FONTE: Clube%'").bind(dia).all();
    const sai = (cart || []).filter((x) => !vale.has(x.filial + '#' + x.chave));
    if (sai.length) await env.DB.batch(sai.map((x) => env.DB.prepare('DELETE FROM tv_lances WHERE dia = ? AND filial = ? AND chave = ?').bind(dia, x.filial, x.chave)));
    saida.cartoes_retirados = sai.map((x) => x.filial + ' ' + x.chave);
  }
  if (u.searchParams.get('refecha') === '1' && dia < hoje) {
    // copia do fechamento anterior antes de refazer (nada se perde)
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS liga_fechamento_copia (dia TEXT, copiado_em TEXT, fechamento_json TEXT, lances_json TEXT)').run();
    const f = await env.DB.prepare('SELECT * FROM liga_fechamento WHERE dia = ?').bind(dia).first().catch(() => null);
    if (f) {
      const { results: lf } = await env.DB.prepare('SELECT chave, filial, lance_json FROM liga_dia_fechado WHERE dia = ?').bind(dia).all();
      await env.DB.prepare('INSERT INTO liga_fechamento_copia (dia, copiado_em, fechamento_json, lances_json) VALUES (?, ?, ?, ?)').bind(dia, new Date().toISOString(), JSON.stringify(f), JSON.stringify(lf || [])).run();
      await env.DB.batch([env.DB.prepare('DELETE FROM liga_dia_fechado WHERE dia = ?').bind(dia), env.DB.prepare('DELETE FROM liga_fechamento WHERE dia = ?').bind(dia)]);
    }
    saida.fechamento = await fechaDia(env, u.origin, dia, { forcar: true });
  }
  return resp(saida);
}
