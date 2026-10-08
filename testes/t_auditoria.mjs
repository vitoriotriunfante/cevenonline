// Testes da AUDITORIA LANCE POR LANCE (functions/_lib/auditoria_lance.js): lances corretos passam; lances com prova faltando ou fora da regra falham.
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export default async function (ok) {
  const { auditaLance, auditaLista } = await import(pathToFileURL(join(RAIZ, 'functions', '_lib', 'auditoria_lance.js')).href);
  const base = { vendedor: 'FULANO', rca: '10', supervisor: 'SICRANO', hora: '10:00:00', pontos: 5 };
  const a = (extra) => auditaLance({ ...base, ...extra });
  const passa = (extra) => a(extra).falhas.length === 0;
  const falhaCom = (extra, trecho) => a(extra).falhas.some((f) => f.includes(trecho));

  ok(passa({ chave: 'gol_goleada|10', obs: '10 clientes positivados na rota (12 pedidos, digitado R$ 6.033)' }), 'goleada com 10 clientes comprovados passa');
  ok(falhaCom({ chave: 'gol_goleada|10', obs: '9 clientes positivados na rota (12 pedidos)' }, 'mínimo 10'), 'goleada com 9 clientes falha');
  ok(falhaCom({ chave: 'gol_goleada|10', obs: null }, 'sem a prova'), 'goleada sem prova falha (era o caso das 549 antigas)');
  ok(passa({ chave: 'gol_super|10', obs: 'digitado do dia R$ 15.003 (minimo R$ 15.000)' }) && falhaCom({ chave: 'gol_super|10', obs: 'digitado do dia R$ 14.900 (minimo R$ 15.000)' }, 'mínimo R$ 15.000'), 'super pedido: R$ 15.003 passa, R$ 14.900 falha');
  ok(passa({ chave: 'gol_conversao|10', obs: '20 com venda em 20 visitas = 100%' }) && falhaCom({ chave: 'gol_conversao|10', obs: '3 com venda em 7 visitas = 43%' }, 'mínimo 8'), 'conversão: 8+ visitas e 50%+');
  ok(passa({ chave: 'gol_relampago|10', obs: 'check-in as 07:42 (antes das 10h)' }) && falhaCom({ chave: 'gol_relampago|10', obs: 'check-in as 10:05 (antes das 10h)' }, 'limite 10h'), 'relâmpago: check-in antes do limite');
  ok(passa({ chave: 'gol_acrescimos|10', hora: '18:30:00', obs: 'check-in as 17:13 (janela 16h30 ate 18h00)' }) && falhaCom({ chave: 'gol_acrescimos|10', obs: 'check-in as 15:59 (janela)' }, 'janela 16h30'), 'acréscimos: dentro da janela da tarde');
  ok(passa({ chave: 'gol_hattrick|10', obs: '3 check-ins em 105 min: 08:15, 09:02, 10:00' }) && passa({ chave: 'gol_hattrick|10', obs: '3 vendas seguidas (3 check-ins em 130 min): 08:00, 09:30, 10:10' }) && falhaCom({ chave: 'gol_hattrick|10', obs: '2 check-ins em 30 min' }, 'check-ins'), 'hat-trick: 3 vendas seguidas, sem teto de tempo (08/10/2026)');
  ok(passa({ chave: 'ver_dev|10|99', pontos: -10, obs: 'nota 10166 de 2026-10-06 | R$ 31 | CLIENTE LTDA | motivo oficial: CLIENTE NAO PEDIU' }) && falhaCom({ chave: 'ver_dev|10|99', pontos: -10, obs: 'nota 1 de 2026-10-06 | R$ 31 | X | motivo oficial: PRODUTO AVARIADO' }, 'não pediu'), 'cartão vermelho de devolução só com motivo "cliente não pediu"');
  ok(passa({ chave: 'golcontra_dev|10|9', pontos: -4, obs: 'nota 2 de 2026-10-06 | R$ 27 | X | motivo oficial: CLIENTE SEM DINHEIRO' }) && falhaCom({ chave: 'golcontra_dev|10|9', pontos: -4, obs: 'nota 3 de 2026-10-06 | R$ 27 | X | motivo oficial: PRODUTO AVARIADO' }, 'não é comercial') && falhaCom({ chave: 'golcontra_dev|10|9', pontos: -4, obs: 'nota 4 de 2026-10-06 | R$ 0 | X | motivo oficial: CLIENTE SEM DINHEIRO' }, 'R$ 0'), 'gol contra só com motivo comercial e valor maior que zero');
  ok(passa({ chave: 'imp|gps|10|5', pontos: -5, obs: 'check-in 07:25 | check-out a 1968 m do cadastro do cliente' }) && falhaCom({ chave: 'imp|gps|10|5', pontos: -5, obs: 'check-out a 300 m do cadastro do cliente' }, 'mínimo 501'), 'impedimento de GPS só acima de 500 m');
  ok(passa({ chave: 'pen|estoque|10|5', pontos: -4, motivo: 'ESTOQUE SUFICIENTE', dias_sem_compra: 31 }) && falhaCom({ chave: 'pen|estoque|10|5', pontos: -4, motivo: 'ESTOQUE SUFICIENTE', dias_sem_compra: 20 }, 'mínimo 31') && falhaCom({ chave: 'pen|fechado|10|5', pontos: -4, motivo: 'FECHADO', dias_sem_compra: 40 }, 'mínimo 46'), 'pênalti: 31+ dias (estoque) e 46+ dias (fechado)');
  ok(passa({ chave: 'ven10|10', pontos: -3, obs: '1 visitas feitas, 0 pedidos e digitado R$ 0 as 10h (limite 10h)' }) && falhaCom({ chave: 'ven10|10', pontos: -3, obs: '4 visitas feitas, 2 pedidos e digitado R$ 900 as 10h' }, 'amarelo de vendedor'), 'amarelo só para quem não tem pedido ou visita');
  ok(passa({ chave: 'vis11|10', pontos: -10, obs: '1 clientes na rota, 0 visitas feitas as 11h (limite 11h)' }) && falhaCom({ chave: 'vis11|10', pontos: -10, obs: '5 clientes na rota, 2 visitas feitas as 11h' }, 'abandono'), 'vermelho de abandono só com zero visitas');
  ok(falhaCom({ chave: 'gol_mix|10|5', obs: 'QUALIFICAÇÃO: BRONZE (+0 pts) [QUALIF:BRONZE:+2]' }, 'deveria ser +0'), 'nível do gol com extra que não bate com o nível falha');
  ok(passa({ chave: 'gol_mix|10|5', obs: 'PEDIDO DE HOJE: 100000469 · BLOQUEADO · R$ 1.201 | QUALIFICAÇÃO: PRATA (+1 pts) [QUALIF:PRATA:+1]' }), 'gol de cliente com pedido de hoje e nível coerente passa');
  ok(falhaCom({ chave: 'gol_inativo|10|5', obs: 'PEDIDO DE HOJE: 1', dias_sem_compra: 12 }, 'mais de 30 dias'), 'resgate de cliente que não está parado há 30 dias falha');
  ok(passa({ chave: 'ven10|10', pontos: -3, obs: 'nenhuma visita nem check-in de varejo (3 clientes na rota) as 10h (limite 10h)' }), 'amarelo de quem nao fez nenhuma visita nem check-in passa');
  ok(auditaLance({ ...base, chave: 'gol_inativo|1|2', obs: 'PEDIDO DE HOJE: 5 | QUALIF', dias_sem_compra: null, ultima_compra: '2026-08-31' }, { dia: '2026-10-06' }).falhas.length === 0, 'resgate: dias sem compra calculados pela ultima compra gravada (36 dias)');
  ok(auditaLance({ ...base, chave: 'gol_inativo|1|2', obs: 'PEDIDO DE HOJE: 5', dias_sem_compra: null, ultima_compra: '2026-09-20' }, { dia: '2026-10-06' }).falhas.some((f) => f.includes('mais de 30')), 'resgate com ultima compra ha 16 dias falha');
  ok(auditaLance({ ...base, chave: 'pen|estoque|1|2', pontos: -4, motivo: 'ESTOQUE SUFICIENTE', dias_sem_compra: null, ultima_compra: '1900-01-01' }, { dia: '2026-10-06' }).falhas.length === 0, 'pênalti de cliente sem nenhuma compra registrada (1900-01-01) passa');
  ok(auditaLance({ ...base, chave: 'sup|1', nivel: 'supervisor', pontos: 0 }).falhas.length === 0, 'aviso de supervisor nao pontua e fica fora da auditoria');
  ok(falhaCom({ chave: 'imp|visita0|380|390316', pontos: -5, hora: '06:07:46', obs: 'check-in 10:49 | check-out 10:49 | tempo 00:00 | visita de 00:00' }, 'dado de ontem') && passa({ chave: 'imp|visita0|380|390316', pontos: -5, hora: '11:07:46', obs: 'check-in 10:49 | check-out 10:49 | tempo 00:00 | visita de 00:00' }), 'lance com check-in DEPOIS da hora do registro falha (dado de ontem); com check-in antes passa');
  // comuns
  ok(falhaCom({ chave: 'gol_super|10', vendedor: '', obs: 'digitado do dia R$ 15.003' }, 'sem vendedor') && falhaCom({ chave: 'gol_super|10', hora: '03:10:00', obs: 'digitado do dia R$ 15.003' }, 'madrugada') && falhaCom({ chave: 'gol_super|10', supervisor: '', obs: 'digitado do dia R$ 15.003' }, 'sem supervisor'), 'regras comuns: vendedor, supervisor e horário (não madrugada)');
  const r = auditaLista([{ ...base, chave: 'gol_goleada|1', obs: null }, { ...base, chave: 'gol_super|2', obs: 'digitado do dia R$ 20.000' }]);
  ok(r.auditados === 2 && r.ok === 1 && r.com_falha === 1 && r.por_regra.gol_goleada.falhas === 1, 'resumo da lista: 2 auditados, 1 ok, 1 com falha');
}
