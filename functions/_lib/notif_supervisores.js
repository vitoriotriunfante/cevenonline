// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/notif_supervisores.js
// O QUE É: monta as NOTIFICAÇÕES DE LANCES PARA OS SUPERVISORES (Vitório, 06/10/2026: "TODOS os lances da equipe dele (supervisor), a cada UMA hora").
//          Para cada supervisor, junta os lances da equipe dele que ainda não foram avisados e monta UMA mensagem. Função pura (sem rede nem banco): testável.
//          Quem envia é o cron-notificacoes-supervisores.js (usa functions/_lib/ceven_notificacao.js). Pedidos na rota (centenas por dia, +1 cada) entram só como contagem.
//          A notificação do CEVEN chega para TODOS de Master/Gerente/Supervisor da filial: por isso a mensagem começa com o NOME do supervisor.
// FORMATO (Vitório, 06/10/2026: "ficou bem feinho"): cabeçalho com saldo e resumo por tipo (emoji), depois "O QUE DEU CERTO" e "ATENÇÃO", um vendedor por linha,
//          lance repetido vira "6 impedimentos (−30)". O CEVEN mostra texto simples (sem negrito): a organização vem de emojis, linhas em branco e marcadores.
// =========================================================================
export const LIMITE_TEXTO = 900;
const NAO_SUPERVISOR = (n) => { const x = String(n || '').trim().toUpperCase(); return !x || x.startsWith('GERENTE ') || x.startsWith('RCAS INATIVOS') || x.startsWith('VENDA EMPRESA') || x === 'DIRETO AO GERENTE'; };
const sinal = (p) => (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p);
const hm = (h) => String(h || '').slice(0, 5);
const MINUSCULAS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
// "BRUNO GUSTAVO NATAL" -> "Bruno Gustavo Natal" (com max=2: primeiro e ultimo nome, "Bruno Natal")
export function titulo(nome, max) {
  let p = String(nome || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (max && p.length > max) p = [p[0], p[p.length - 1]];
  return p.map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}
// tira o emoji do comeco do nome do lance e deixa o nivel (BRONZE...PLATINA) em formato de leitura
const limpa = (s) => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim().replace(/\b(BRONZE|PRATA|OURO|DIAMANTE|PLATINA)\b/, (n) => n.charAt(0) + n.slice(1).toLowerCase());

export function tipoDoLance(chave) { return String(chave || '').replace(/^[A-Z]{3}[|]/, '').split('|')[0]; }

// categoria para o resumo da mensagem
function categoria(l) {
  const t = tipoDoLance(l.chave);
  if (l.nivel === 'pedido_rota' || t === 'pedido_rota') return 'pedido na rota';
  if (l.nivel === 'hattrick' || t === 'gol_hattrick') return 'hat-trick';
  if (l.nivel === 'gol') return 'gol';
  if (l.nivel === 'defesa') return 'defesa';
  if (l.nivel === 'penalti') return 'pênalti';
  if (l.nivel === 'impedimento') return 'impedimento';
  if (l.nivel === 'amarelo') return 'amarelo';
  if (l.nivel === 'golcontra') return 'gol contra';
  if (l.nivel === 'vermelho' || l.nivel === 'visita10' || l.nivel === 'venda10') return 'vermelho';
  return 'lance';
}
const PLURAL = { gol: 'gols', 'hat-trick': 'hat-tricks', defesa: 'defesas', 'pênalti': 'pênaltis', impedimento: 'impedimentos', amarelo: 'amarelos', 'gol contra': 'gols contra', vermelho: 'vermelhos', 'pedido na rota': 'pedidos na rota', lance: 'lances' };
const NOME_NEGATIVO = { 'pênalti': 'pênalti', impedimento: 'impedimento', amarelo: 'cartão amarelo', vermelho: 'cartão vermelho', 'gol contra': 'gol contra', lance: 'lance' };
const EMOJI = { gol: '⚽', 'hat-trick': '🔥', defesa: '🧤', 'pênalti': '🚨', impedimento: '🚩', amarelo: '🟨', 'gol contra': '😬', vermelho: '🟥', 'pedido na rota': '📝', lance: '•' };

// lances: lista do /api/brasileirao-lances; jaAvisados: Set de "filial|chave". Devolve [{filial, supervisor, texto, chaves, qtd, pontos}]
export function montaMensagens(lances, jaAvisados, { de, ate } = {}) {
  const porSup = new Map();
  for (const l of lances || []) {
    if (!l || l.nivel === 'supervisor' || l.nivel === 'marker' || l.nivel === 'semanainvicta') continue;
    if (NAO_SUPERVISOR(l.supervisor)) continue;
    const filial = String(l.filial || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(filial) || filial === 'MTZ') continue;
    if (jaAvisados && jaAvisados.has(filial + '|' + l.chave)) continue;
    if (!Number.isFinite(Number(l.pontos)) || Number(l.pontos) === 0) continue;
    const k = filial + '|' + l.supervisor;
    if (!porSup.has(k)) porSup.set(k, { filial, supervisor: l.supervisor, lances: [] });
    porSup.get(k).lances.push(l);
  }
  const arred = (x) => Math.round(x * 10) / 10;
  const saida = [];
  for (const g of porSup.values()) {
    const cont = {};
    let pontos = 0;
    for (const l of g.lances) { const c = categoria(l); cont[c] = (cont[c] || 0) + 1; pontos += Number(l.pontos) || 0; }
    const soma = (c) => arred(g.lances.filter((l) => categoria(l) === c).reduce((x, l) => x + (Number(l.pontos) || 0), 0));
    const resumo = Object.entries(cont).sort((x, y) => y[1] - x[1]).map(([c, n]) => `${EMOJI[c] || '•'} ${n} ${n === 1 ? c : (PLURAL[c] || c)} (${sinal(soma(c))})`).join('\n');
    const cab = `📊 ${titulo(g.supervisor)} · sua equipe${de && ate ? ` (${hm(de)}–${hm(ate)})` : ''}\nSaldo: ${sinal(arred(pontos))} pts\n${resumo}`;

    // detalhe por VENDEDOR: o mesmo lance repetido vira "6 impedimentos"; separado entre o que deu certo e o que pede atenção
    const porVend = new Map();
    for (const l of g.lances) {
      const c = categoria(l);
      if (c === 'pedido na rota') continue;
      const nomeV = l.vendedor || '—';
      if (!porVend.has(nomeV)) porVend.set(nomeV, { nome: nomeV, bons: new Map(), maus: new Map(), total: 0 });
      const v = porVend.get(nomeV), bom = Number(l.pontos) >= 0;
      const rotulo = bom ? limpa(l.pontos_nome || l.nivel) : (NOME_NEGATIVO[c] || c);
      const m = bom ? v.bons : v.maus, e = m.get(rotulo) || { n: 0, p: 0, cat: c };
      e.n++; e.p += Number(l.pontos) || 0; m.set(rotulo, e); v.total += Number(l.pontos) || 0;
    }
    const item = ([rotulo, e]) => `${e.n > 1 ? (e.p < 0 ? `${e.n} ${PLURAL[e.cat] || rotulo}` : `${e.n}× ${rotulo}`) : rotulo} (${sinal(arred(e.p))})`;
    const linha = (v, mapa) => `• ${titulo(v.nome, 2)} — ${[...mapa.entries()].map(item).join(' · ')}`;
    const bons = [...porVend.values()].filter((v) => v.bons.size).sort((x, y) => y.total - x.total);
    const maus = [...porVend.values()].filter((v) => v.maus.size).sort((x, y) => x.total - y.total);

    // monta respeitando o limite: corta as linhas do fim de cada bloco e avisa quantas ficaram de fora
    let texto = cab, fora = 0;
    const bloco = (tit, vs, mapaDe) => {
      if (!vs.length) return;
      let t = '\n\n' + tit, usou = 0;
      for (const v of vs) { const ln = linha(v, mapaDe(v)); if ((texto + t + '\n' + ln).length > LIMITE_TEXTO - 50) break; t += '\n' + ln; usou++; }
      if (usou) texto += t;
      fora += vs.length - usou;
    };
    bloco('✅ O QUE DEU CERTO', bons, (v) => v.bons);
    bloco('⚠️ ATENÇÃO', maus, (v) => v.maus);
    if (fora) texto += `\n\n(+${fora} vendedor(es): veja na Liga)`;
    saida.push({ filial: g.filial, supervisor: g.supervisor, texto, chaves: g.lances.map((l) => l.chave), qtd: g.lances.length, pontos: arred(pontos) });
  }
  return saida.sort((a, b) => a.filial.localeCompare(b.filial) || a.supervisor.localeCompare(b.supervisor));
}
