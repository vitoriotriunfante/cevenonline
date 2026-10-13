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
export const MAX_PARTES = 3;   // no maximo 3 notificacoes por supervisor por hora (13/10/2026)
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

// detalhe de um lance negativo: "Cliente X (justificativa)" quando tem cliente; senao a observacao (ex.: "2 visitas feitas, 0 pedidos as 13h")
const corta = (x, n) => (x.length > n ? x.slice(0, n - 1).trim() + '…' : x);
function detalhe(l) {
  if (l.cliente) return corta(titulo(l.cliente), 24) + (l.motivo ? ` (${corta(String(l.motivo).toLowerCase(), 30)})` : '');
  return l.obs ? corta(String(l.obs).replace(/\s*\(limite[^)]*\)/gi, '').trim(), 70) : '';
}

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
      // NEGATIVO VAI COM O PORQUÊ (Vitório, 13/10/2026: "especialmente quando for cartão... tem que ir o porque; um supervisor me cobrou"):
      // agrupa por tipo + motivo da regra e lista o detalhe de cada lance (cliente e justificativa, ou a observação do cartão)
      const motivo = bom ? '' : corta(String(l.pontos_motivo || '').replace(/\s*\(regra[^)]*\)/gi, '').trim(), 50);
      const rotulo = bom ? limpa(l.pontos_nome || l.nivel) : (NOME_NEGATIVO[c] || c) + (motivo ? '|' + motivo : '');
      const m = bom ? v.bons : v.maus, e = m.get(rotulo) || { n: 0, p: 0, cat: c, nome: bom ? rotulo : (NOME_NEGATIVO[c] || c), motivo, det: [] };
      e.n++; e.p += Number(l.pontos) || 0; m.set(rotulo, e); v.total += Number(l.pontos) || 0;
      if (!bom) { const d = detalhe(l); if (d && !e.det.includes(d)) e.det.push(d); }
    }
    const dets = (e) => !e.det.length ? '' : ' — ' + e.det.slice(0, 2).join('; ') + (e.det.length > 2 ? ` (+${e.det.length - 2})` : '');
    const item = ([rotulo, e]) => e.p < 0
      ? `${e.n > 1 ? `${e.n} ${PLURAL[e.cat] || e.nome}` : e.nome} (${sinal(arred(e.p))})${e.motivo ? ': ' + e.motivo : ''}${dets(e)}`
      : `${e.n > 1 ? `${e.n}× ${rotulo}` : rotulo} (${sinal(arred(e.p))})`;
    const linhaMaus = (v) => `• ${titulo(v.nome, 2)}` + [...v.maus.entries()].map((x) => '\n   ' + item(x)).join('');
    const linha = (v, mapa) => `• ${titulo(v.nome, 2)} — ${[...mapa.entries()].map(item).join(' · ')}`;
    const bons = [...porVend.values()].filter((v) => v.bons.size).sort((x, y) => y.total - x.total);
    const maus = [...porVend.values()].filter((v) => v.maus.size).sort((x, y) => x.total - y.total);

    // monta respeitando o limite do CEVEN: ATENCAO primeiro (Vitório, 13/10/2026: o porquê do negativo nao pode ficar de fora), depois o que deu certo.
    // Se nao couber numa notificacao, continua em outra(s) ("continuação 2/3"), no maximo MAX_PARTES; o que ainda sobrar vira o rodape "(+N ...)".
    const linhas = [...maus.map((v) => ['⚠️ ATENÇÃO', linhaMaus(v)]), ...bons.map((v) => ['✅ O QUE DEU CERTO', linha(v, v.bons)])];
    const partes = [];
    let atual = cab, tituloAtual = '', fora = 0;
    for (const [tit, ln] of linhas) {
      const add = (tit !== tituloAtual ? '\n\n' + tit : '') + '\n' + ln;
      if ((atual + add).length > LIMITE_TEXTO - 50 && atual !== cab) {
        if (partes.length + 1 >= MAX_PARTES) { fora++; continue; }
        partes.push(atual); atual = `📊 ${titulo(g.supervisor)} · continuação`; tituloAtual = '';
      }
      const add2 = (tit !== tituloAtual ? '\n\n' + tit : '') + '\n' + ln;
      atual += corta(add2, LIMITE_TEXTO - 50 - atual.length); tituloAtual = tit;
    }
    if (fora) atual += `\n\n(+${fora} vendedor(es): veja na Liga)`;
    partes.push(atual);
    const n = partes.length;
    partes.forEach((texto, i) => saida.push({
      filial: g.filial, supervisor: g.supervisor, parte: i + 1, partes: n,
      texto: n > 1 && i > 0 ? texto.replace('· continuação', `· continuação ${i + 1}/${n}`) : texto,
      // as chaves vao na ultima parte: so marca como avisado depois que tudo saiu
      chaves: i === n - 1 ? g.lances.map((l) => l.chave) : [], qtd: g.lances.length, pontos: arred(pontos)
    }));
  }
  return saida.sort((a, b) => a.filial.localeCompare(b.filial) || a.supervisor.localeCompare(b.supervisor));
}
