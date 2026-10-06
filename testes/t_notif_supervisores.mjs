// Testes da MONTAGEM das notificacoes de lances para supervisores (functions/_lib/notif_supervisores.js), sem rede.
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export default async function (ok) {
  const lib = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'notif_supervisores.js')).href);
  const L = (o) => ({ filial: 'TBL', supervisor: 'KLEBERSON BATISTA LIDUARIO', hora: '10:15:00', vendedor: 'FULANO DA SILVA', nivel: 'gol', chave: 'gol_super|1', pontos: 5, pontos_nome: '💎 Super Pedido', ...o });
  const lances = [
    L({}), L({ chave: 'pen|estoque|2|9', nivel: 'penalti', pontos: -4, pontos_nome: '🚨 Pênalti', hora: '10:20:00' }),
    L({ chave: 'pedido_rota|3|7', nivel: 'pedido_rota', pontos: 1, pontos_nome: 'Pedido Feito na Rota' }), L({ chave: 'pedido_rota|4|8', nivel: 'pedido_rota', pontos: 1 }),
    L({ supervisor: 'OUTRO SUPERVISOR', chave: 'gol_mix|5|5', pontos: 4 }),
    L({ supervisor: 'GERENTE TBL', chave: 'gol_super|9' }), L({ nivel: 'supervisor', chave: 'sup|1', pontos: 0 }), L({ filial: 'MTZ', chave: 'ABC|gol_super|9' }), L({ chave: 'gol_x|1', pontos: 0 })
  ];
  const r = lib.montaMensagens(lances, new Set(), { de: '09:05:00', ate: '10:05:00' });
  const k = r.find((m) => m.supervisor.startsWith('KLEBERSON'));
  ok(r.length === 2 && k && k.qtd === 4, 'uma mensagem por supervisor (2 supervisores); GERENTE, MTZ, aviso de supervisor e lance sem ponto ficam fora');
  ok(k.texto.startsWith('📊 Kleberson Batista Liduario · sua equipe (09:05–10:05)\nSaldo: +3 pts') && k.texto.includes('⚽ 1 gol (+5)') && k.texto.includes('🚨 1 pênalti (−4)') && k.texto.includes('📝 2 pedidos na rota (+2)'), 'cabecalho com o NOME do supervisor, saldo e o resumo por tipo com emoji (5 - 4 + 1 + 1 = +3)');
  ok(k.texto.includes('✅ O QUE DEU CERTO\n• Fulano Silva — Super Pedido (+5)') && k.texto.includes('⚠️ ATENÇÃO\n• Fulano Silva — pênalti (−4)') && !k.texto.includes('Pedido Feito na Rota'), 'blocos "o que deu certo" e "atencao", um vendedor por linha com nome em formato de leitura; pedido na rota so na contagem');
  const rep = lib.montaMensagens([...Array(6)].map((_, i) => L({ chave: 'imp|gps|7|' + i, nivel: 'impedimento', pontos: -5, vendedor: 'BRUNO GUSTAVO NATAL', pontos_nome: 'Impedimento' })), new Set(), {})[0];
  ok(rep.texto.includes('• Bruno Natal — 6 impedimentos (−30)') && rep.texto.includes('🚩 6 impedimentos (−30)'), 'o mesmo lance repetido vira "6 impedimentos (−30)" numa linha so');
  const niv = lib.montaMensagens([L({ chave: 'gol_mix|1|1', pontos: 8, pontos_nome: 'Dobrou o Mix PLATINA' })], new Set(), {})[0];
  ok(niv.texto.includes('Dobrou o Mix Platina (+8)'), 'nivel do gol aparece em formato de leitura (Platina)');
  // ja avisado nao repete
  const jaAv = new Set(['TBL|gol_super|1', 'TBL|pen|estoque|2|9', 'TBL|pedido_rota|3|7', 'TBL|pedido_rota|4|8']);
  const r2 = lib.montaMensagens(lances, jaAv, {});
  ok(r2.length === 1 && r2[0].supervisor === 'OUTRO SUPERVISOR', 'lance ja avisado nao e avisado de novo; supervisor sem lance novo nao recebe nada');
  ok(lib.montaMensagens([], new Set(), {}).length === 0, 'sem lances nao gera mensagem vazia');
  // texto grande e cortado no limite
  const muitos = Array.from({ length: 120 }, (_, i) => L({ chave: 'gol_super|' + i, vendedor: 'VENDEDOR NUMERO ' + i + ' COM NOME LONGO', pontos: 5 + (i % 3), hora: '11:' + String(i % 60).padStart(2, '0') + ':00' }));
  const g = lib.montaMensagens(muitos, new Set(), {})[0];
  ok(g.texto.length <= lib.LIMITE_TEXTO && /\(\+\d+ vendedor\(es\): veja na Liga\)/.test(g.texto) && g.qtd === 120 && g.chaves.length === 120, 'mensagem enorme e cortada no limite com "(+N lances...)" e TODAS as chaves ficam marcadas como avisadas');
  // codigo: endpoint
  const ep = readFileSync(join(RAIZ, 'functions', 'api', 'cron-notificacoes-supervisores.js'), 'utf8');
  ok(ep.includes("'notif_supervisores')) !== '1'") && ep.includes('55 * 60') && ep.includes("'Brasileirão Triunfante'") && ep.includes('notif_lance_enviado'), 'endpoint: desligado por padrao, no maximo 1 envio por hora, origem "Brasileirão Triunfante" e cada lance avisado uma vez');
  ok(ep.includes('if (primeira)') && ep.includes('silenciosos'), 'primeira rodada do dia nao despeja o dia inteiro: avisa so a ultima hora');
  const cl = readFileSync(join(RAIZ, 'functions', 'api', 'cron-lances.js'), 'utf8');
  ok(cl.includes('cron-notificacoes-supervisores?rodar=1') && cl.includes('t.h >= 9 && t.h <= 20 && t.m < 5'), 'o coletor chama as notificacoes no comeco de cada hora cheia, das 09h as 20h');
}
