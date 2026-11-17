// ==========================================================================================
// FICHA DO ARQUIVO: functions/_lib/jota/respostas/pedidos_gerot.js
// O QUE FAZ: "meus pedidos" do vendedor pelo GEROT (gerot_pedido: um pedido x NF por linha, com data, cliente, faturado e carteira)
//   + o dia de hoje pelo Clube da Venda (clube_venda_dia: total e quantidade; o Clube nao traz pedido a pedido).
//   Vitorio, 17/11/2026: "mostrando pedidos do dia 12? ja nao mostrei que tem todos os pedidos no GEROT?"
// Sem linha do vendedor no GEROT devolve null (quem chama cai na linha do tempo antiga). Nada estimado.
// ==========================================================================================
import { N, R$, hojeSP, titulo } from '../base.js';

export async function respPedidosGerot(B, filial, rca, soFaturados = false) {
  const db = B.env && B.env.DB; if (!db) return null;
  const hoje = hojeSP(), de = new Date(Date.parse(hoje) - 7 * 864e5).toISOString().slice(0, 10);
  let R = [];
  try { R = (await db.prepare('SELECT pedido, nf, data, nome, cliente, dados, em FROM gerot_pedido WHERE filial = ? AND rca = ? AND data >= ? ORDER BY data DESC, pedido DESC LIMIT 200').bind(String(filial), String(rca), de).all()).results || []; } catch (e) { return null; }
  if (!R.length) return null;
  const P = new Map();
  for (const r of R) {
    let d = {}; try { d = JSON.parse(r.dados || '{}'); } catch (e) { d = {}; }
    const x = P.get(r.pedido) || { pedido: r.pedido, data: r.data, nome: r.nome, cliente: r.cliente, fat: 0, cart: 0, nfs: [] };
    x.fat += Number(d['Faturado líquido (R$)']) || 0; x.cart += Number(d['Carteira pendente (R$)']) || 0;
    if (r.nf && !x.nfs.includes(r.nf)) x.nfs.push(r.nf);
    if (r.data && (!x.data || r.data > x.data)) x.data = r.data;
    P.set(r.pedido, x);
  }
  let temCart = false;
  // CARTEIRA TOTAL (gerot_carteira): status, situacao, motivo de bloqueio e valor do pedido em aberto; pedido so na carteira (ainda nao no 'Pedidos') entra tambem
  try {
    const { results: C } = await db.prepare('SELECT pedido, entrada, status, situacao, motivo, cliente, valor FROM gerot_carteira WHERE filial = ? AND rca = ?').bind(String(filial), String(rca)).all();
    temCart = !!(C && C.length) || !!(await db.prepare('SELECT 1 FROM gerot_carteira WHERE filial = ? LIMIT 1').bind(String(filial)).first());
    for (const c of C || []) {
      let x = P.get(c.pedido);
      if (!x) { if (!c.entrada || c.entrada < de) continue; x = { pedido: c.pedido, data: c.entrada, nome: c.cliente, cliente: '', fat: 0, cart: 0, nfs: [] }; P.set(c.pedido, x); }
      x.ct = { status: c.status, situacao: c.situacao, motivo: c.motivo, valor: Number(c.valor) || 0 };
    }
  } catch (e) { /* sem a tabela ainda: fica so o 'Pedidos' */ }
  let L = [...P.values()].sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.pedido).localeCompare(String(a.pedido)));
  if (soFaturados) L = L.filter((x) => x.fat > 0);
  const dm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '--/--');
  // 17/11/2026 (carga real): pedido sem NF: o GEROT nao traz valor nem status nesse nivel (faturado 0, carteira vazia); status (liberado/bloqueado/cancelado) vem da Carteira Total, entao nao mostramos valor (nunca R$ 0 falso).
  // Faturado liquido negativo = devolucao da NF.
  const linha = (x) => {
    const cli = titulo(String(x.nome || '').toLowerCase()).slice(0, 32) || 'cliente #' + x.cliente;
    if (x.ct) { const st = [x.ct.status, x.ct.situacao].filter(Boolean).map((s) => titulo(String(s).toLowerCase())).filter((s, i, a) => a.indexOf(s) === i).join(' · '), bloq = /BLOQ/i.test(`${x.ct.status} ${x.ct.situacao}`) || !!x.ct.motivo;
      return `${bloq ? '🚫' : '⏳'} ${dm(x.data)} · nº ${x.pedido} · ${cli} · ${R$(x.ct.valor)} · ${st || 'na carteira'}${x.ct.motivo ? ` · motivo: ${titulo(String(x.ct.motivo).toLowerCase())}` : ''}`; }
    if (!x.nfs.length && !x.fat) return temCart ? `❔ ${dm(x.data)} · nº ${x.pedido} · ${cli} · sem nota fiscal e fora da carteira do GEROT (cancelado ou faturado depois da carga)` : `⏳ ${dm(x.data)} · nº ${x.pedido} · ${cli} · sem nota fiscal ainda`;
    if (x.fat < 0) return `↩️ ${dm(x.data)} · nº ${x.pedido} · ${cli} · devolução ${R$(-x.fat)}${x.nfs.length ? ` (NF ${x.nfs.slice(0, 2).join(', ')})` : ''}`;
    return `✅ ${dm(x.data)} · nº ${x.pedido} · ${cli} · faturado ${R$(x.fat)}${x.nfs.length ? ` (NF ${x.nfs.slice(0, 2).join(', ')})` : ''}`;
  };
  const out = [`📦 *Seus pedidos${soFaturados ? ' faturados' : ''}, últimos 7 dias* (GEROT)`];
  if (!L.length) out.push('Nenhum pedido nesse recorte no GEROT.'); else out.push(...L.slice(0, 25).map(linha));
  if (L.length > 25) out.push(`… e mais ${L.length - 25} pedido(s)`);
  const tf = L.reduce((a, x) => a + Math.max(0, x.fat), 0), nCart = L.filter((x) => x.ct || (!x.nfs.length && !x.fat)).length, vCart = L.reduce((a, x) => a + (x.ct ? x.ct.valor : 0), 0);
  out.push('', `Total: *${N(L.length)}* pedido(s) · faturado ${R$(tf)}${nCart ? ` · *${N(nCart)}* sem nota fiscal${vCart ? ` (${R$(vCart)} na carteira)` : ''}` : ''}`);
  // hoje pelo Clube (o GEROT so mostra o pedido quando ele entra na carteira)
  try {
    const c = await db.prepare('SELECT total_pedido, ped_total, lido_em FROM clube_venda_dia WHERE dia = ? AND filial = ? AND rca = ?').bind(hoje, String(filial), String(rca)).first();
    if (c) out.push(`🟢 Hoje (Clube da Venda${c.lido_em ? ' · ' + new Date(c.lido_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : ''}): *${N(c.ped_total || 0)}* pedido(s) · ${R$(c.total_pedido || 0)}`);
  } catch (e) { /* sem Clube: fica so o GEROT */ }
  let pos = null; try { const st = await db.prepare("SELECT MAX(em) em FROM gerot_pedido WHERE filial = ? AND rca = ?").bind(String(filial), String(rca)).first(); pos = st && st.em ? new Date(st.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null; } catch (e) { /* sem hora */ }
  out.push(`_GEROT${pos ? ' · carga ' + pos : ''} · ✅ faturado${temCart ? ' · ⏳ na carteira · 🚫 bloqueado (status e motivo da Carteira Total)' : ' · ⏳ sem nota fiscal ainda'} · ↩️ devolução._`);
  return out.join('\n');
}

// PEDIDO PELO NUMERO (GEROT): Carteira Total (status, situacao, motivo de bloqueio, valor, itens) + 'Pedidos' (NF, faturado, devolucao) + data de entrada.
// O mesmo numero pode existir em mais de uma filial: mostra so o que e do escopo de quem pergunta. Sem linha no GEROT devolve null (segue a base antiga).
export async function respPedidoGerot(B, E, num) {
  const db = B.env && B.env.DB; if (!db || !num) return null;
  let C = [], P = [], EN = [];
  try {
    [C, P, EN] = await Promise.all([
      db.prepare('SELECT filial, rca, vendedor, entrada, origem, status, situacao, motivo, cliente, valor, itens, qfat, em FROM gerot_carteira WHERE pedido = ?').bind(String(num)).all().then((r) => r.results || []),
      db.prepare('SELECT filial, rca, nf, data, nome, cliente, dados FROM gerot_pedido WHERE pedido = ?').bind(String(num)).all().then((r) => r.results || []),
      db.prepare('SELECT filial, rca, entrada FROM gerot_pedido_entrada WHERE pedido = ?').bind(String(num)).all().then((r) => r.results || []).catch(() => []),
    ]);
  } catch (e) { return null; }
  if (!C.length && !P.length) return null;
  const meu = (f, r) => E.nacional || (E.vend || []).concat(E.ocultos || []).some((v) => v.filial === f && String(v.rca) === String(r)) || (!E.supervisor && !E.rca && (E.filiais || []).includes(f) && !E.grupo);
  const fils = [...new Set([...C.map((x) => x.filial), ...P.map((x) => x.filial)])].filter((f) => meu(f, (C.find((x) => x.filial === f) || P.find((x) => x.filial === f) || {}).rca));
  if (!fils.length) return `🔎 O pedido ${num} não é da sua equipe.`;
  const dm = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}` : '--/--');
  const out = [];
  for (const f of fils) {
    const c = C.find((x) => x.filial === f), ps = P.filter((x) => x.filial === f), en = (EN.find((x) => x.filial === f) || {}).entrada || (c && c.entrada);
    const rca = (c && c.rca) || (ps[0] && ps[0].rca), cli = titulo(String((c && c.cliente) || (ps[0] && ps[0].nome) || '').toLowerCase());
    out.push(`🧾 *Pedido ${num}* (${f}) · vendedor ${rca || '?'}${cli ? ` · ${cli}` : ''}${en ? ` · pedido de ${dm(en)}` : ''}`);
    if (c) out.push(`📌 *Na carteira:* ${[c.status, c.situacao].filter(Boolean).map((s) => titulo(String(s).toLowerCase())).filter((s, i, a) => a.indexOf(s) === i).join(' · ') || 'em aberto'}${c.motivo ? `\n🚫 *Motivo do bloqueio:* ${titulo(String(c.motivo).toLowerCase())}` : ''}`,
      `💰 Valor em aberto: ${R$(c.valor)} · ${N(c.itens)} item(ns)${c.origem ? ` · origem ${c.origem}` : ''}`);
    let fat = 0, dev = 0; const nfs = [];
    for (const p of ps) { let d = {}; try { d = JSON.parse(p.dados || '{}'); } catch (e) { d = {}; } const v = Number(d['Faturado líquido (R$)']) || 0; if (v >= 0) fat += v; else dev += -v; if (p.nf && !nfs.includes(p.nf)) nfs.push(`${p.nf} (${dm(p.data)})`); }
    if (nfs.length || fat) out.push(`✅ *Faturado:* ${R$(fat)}${nfs.length ? ` · NF ${nfs.slice(0, 4).join(', ')}` : ''}${dev ? ` · ↩️ devolução ${R$(dev)}` : ''}`);
    if (!c && !nfs.length && !fat) out.push('⏳ Sem nota fiscal e fora da carteira na última carga do GEROT (pode ter sido cancelado ou faturado depois da carga).');
    out.push('');
  }
  let pos = null; try { const st = await db.prepare('SELECT MAX(em) em FROM gerot_carteira').first(); pos = st && st.em ? new Date(st.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null; } catch (e) { /* sem hora */ }
  out.push(`_GEROT (Carteira Total + Pedidos)${pos ? ` · carga ${pos}` : ''}._`);
  return out.join('\n');
}

// PEDIDO QUE AINDA NAO ESTA NO GEROT (17/11/2026, bateria real: "nao achei" sem explicar). Uma mensagem so para todas as rotas.
export async function msgPedidoNaoEncontrado(B, num) {
  let em = null;
  try { const r = await B.env.DB.prepare('SELECT MAX(em) em FROM gerot_carteira').first(); em = r && r.em ? new Date(r.em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : null; } catch (e) { /* sem hora */ }
  return `🔎 *Pedido ${num}*: ainda não aparece no GEROT${em ? ` (última carga às ${em})` : ''}, nem na carteira nem nos faturados.\n• Pedido digitado hoje entra na próxima carga (a cada ~2 h).\n• Se for mais antigo, confere o número (o mesmo número pode existir em outra filial).`;
}
