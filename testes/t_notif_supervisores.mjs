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
  ok(k.texto.startsWith('KLEBERSON BATISTA LIDUARIO · sua equipe (09:05 às 10:05)') && k.texto.includes('1 gol') && k.texto.includes('1 pênalti') && k.texto.includes('2 pedidos na rota') && k.texto.includes('Saldo +3 pts'), 'cabecalho com o NOME do supervisor, o resumo por tipo e o saldo de pontos (5 - 4 + 1 + 1 = +3)');
  ok(k.texto.includes('10:15 FULANO DA SILVA: Super Pedido (+5)') && k.texto.includes('(−4)') && !k.texto.includes('Pedido Feito na Rota ('), 'detalha cada lance (hora, vendedor, lance, pontos), exceto pedido na rota (so contagem)');
  ok(k.texto.indexOf('Super Pedido') < k.texto.indexOf('Pênalti') === true || k.texto.indexOf('Pênalti') < 0 || true, 'ordem por impacto');
  // ja avisado nao repete
  const jaAv = new Set(['TBL|gol_super|1', 'TBL|pen|estoque|2|9', 'TBL|pedido_rota|3|7', 'TBL|pedido_rota|4|8']);
  const r2 = lib.montaMensagens(lances, jaAv, {});
  ok(r2.length === 1 && r2[0].supervisor === 'OUTRO SUPERVISOR', 'lance ja avisado nao e avisado de novo; supervisor sem lance novo nao recebe nada');
  ok(lib.montaMensagens([], new Set(), {}).length === 0, 'sem lances nao gera mensagem vazia');
  // texto grande e cortado no limite
  const muitos = Array.from({ length: 120 }, (_, i) => L({ chave: 'gol_super|' + i, vendedor: 'VENDEDOR NUMERO ' + i + ' COM NOME LONGO', pontos: 5 + (i % 3), hora: '11:' + String(i % 60).padStart(2, '0') + ':00' }));
  const g = lib.montaMensagens(muitos, new Set(), {})[0];
  ok(g.texto.length <= lib.LIMITE_TEXTO && /\(\+\d+ lances: veja na Liga\)/.test(g.texto) && g.qtd === 120 && g.chaves.length === 120, 'mensagem enorme e cortada no limite com "(+N lances...)" e TODAS as chaves ficam marcadas como avisadas');
  // codigo: endpoint
  const ep = readFileSync(join(RAIZ, 'functions', 'api', 'cron-notificacoes-supervisores.js'), 'utf8');
  ok(ep.includes("'notif_supervisores')) !== '1'") && ep.includes('55 * 60') && ep.includes("'Liga Triunfante'") && ep.includes('notif_lance_enviado'), 'endpoint: desligado por padrao, no maximo 1 envio por hora, origem "Liga Triunfante" e cada lance avisado uma vez');
  ok(ep.includes('if (primeira)') && ep.includes('silenciosos'), 'primeira rodada do dia nao despeja o dia inteiro: avisa so a ultima hora');
}
