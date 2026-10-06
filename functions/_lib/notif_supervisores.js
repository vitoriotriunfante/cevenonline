// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/notif_supervisores.js
// O QUE É: monta as NOTIFICAÇÕES DE LANCES PARA OS SUPERVISORES (Vitório, 06/10/2026: "TODOS os lances da equipe dele (supervisor), a cada UMA hora").
//          Para cada supervisor, junta os lances da equipe dele que ainda não foram avisados e monta UMA mensagem. Função pura (sem rede nem banco): testável.
//          Quem envia é o cron-notificacoes-supervisores.js (usa functions/_lib/ceven_notificacao.js). Pedidos na rota (centenas por dia, +1 cada) entram só como contagem.
//          A notificação do CEVEN chega para TODOS de Master/Gerente/Supervisor da filial: por isso a mensagem começa com o NOME do supervisor.
// =========================================================================
export const LIMITE_TEXTO = 900;
const NAO_SUPERVISOR = (n) => { const x = String(n || '').trim().toUpperCase(); return !x || x.startsWith('GERENTE ') || x.startsWith('RCAS INATIVOS') || x.startsWith('VENDA EMPRESA') || x === 'DIRETO AO GERENTE'; };
const sinal = (p) => (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p);
const hm = (h) => String(h || '').slice(0, 5);
const curto = (s, n) => { const t = String(s || '').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

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
const PLURAL = { gol: 'gols', 'hat-trick': 'hat-tricks', defesa: 'defesas', pênalti: 'pênaltis', impedimento: 'impedimentos', amarelo: 'amarelos', 'gol contra': 'gols contra', vermelho: 'vermelhos', 'pedido na rota': 'pedidos na rota', lance: 'lances' };

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
  const saida = [];
  for (const g of porSup.values()) {
    const cont = {};
    let pontos = 0;
    for (const l of g.lances) { const c = categoria(l); cont[c] = (cont[c] || 0) + 1; pontos += Number(l.pontos) || 0; }
    const resumo = Object.entries(cont).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${n} ${n === 1 ? c : (PLURAL[c] || c)}`).join(', ');
    const cab = `${String(g.supervisor).toUpperCase()} · sua equipe${de && ate ? ` (${hm(de)} às ${hm(ate)})` : ''}: ${resumo}. Saldo ${sinal(Math.round(pontos * 10) / 10)} pts.`;
    // detalhe: tudo menos pedido na rota, os de maior impacto primeiro; corta no limite e avisa quantos ficaram de fora
    const det = g.lances.filter((l) => categoria(l) !== 'pedido na rota').sort((a, b) => Math.abs(b.pontos) - Math.abs(a.pontos) || String(a.hora).localeCompare(String(b.hora)));
    const linhas = det.map((l) => `${hm(l.hora)} ${curto(l.vendedor, 26)}: ${curto(String(l.pontos_nome || l.nivel).replace(/^[^\p{L}\p{N}]+/u, ''), 34)} (${sinal(Number(l.pontos))})`);
    let texto = cab, usados = 0;
    for (const ln of linhas) { if ((texto + '\n' + ln).length > LIMITE_TEXTO - 40) break; texto += '\n' + ln; usados++; }
    if (usados < linhas.length) texto += `\n(+${linhas.length - usados} lances: veja na Liga)`;
    saida.push({ filial: g.filial, supervisor: g.supervisor, texto, chaves: g.lances.map((l) => l.chave), qtd: g.lances.length, pontos: Math.round(pontos * 10) / 10 });
  }
  return saida.sort((a, b) => a.filial.localeCompare(b.filial) || a.supervisor.localeCompare(b.supervisor));
}
