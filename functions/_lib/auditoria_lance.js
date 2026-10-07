// =========================================================================
// FICHA DO ARQUIVO: functions/_lib/auditoria_lance.js
// O QUE É: AUDITORIA LANCE POR LANCE da Liga Triunfante (Vitório, 06/10/2026: "coloque na sua rotina auditar lance por lance").
//          Para CADA lance que conta pontos, confere se a PROVA gravada no próprio lance sustenta a regra oficial (config/pontuacao_brasileirao.json).
//          Lance que não passa vira "falha de auditoria" e aparece em /divergencias. NUNCA inventa: só usa o que o lance guardou (obs, motivo, dias sem compra, nota...).
//          Função pura (sem rede, sem banco) para poder ser testada.
// =========================================================================

const MOTIVO_COMERCIAL = /SEM DINHEIRO|COND.{1,3}PAGTO|EMITIU COD|PEDIDO DUPLICADO|RECUSOU MERC|PRECO DIFERENTE/;
const EXTRA_NIVEL = { BRONZE: 0, PRATA: 1, OURO: 2, DIAMANTE: 3, PLATINA: 4 };
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const hm = (h, m) => h * 60 + m;

// tipo do lance = 1o pedaco da chave, sem o prefixo de filial "TBL|"
export function tipoDoLance(chave) {
  const c = String(chave || '').replace(/^[A-Z]{3}[|]/, '');
  return c.split('|')[0];
}

// Dias sem compra: usa o campo gravado; se faltar, calcula pela ultima compra gravada (dado real do CEVEN). Ultima compra 1900-01-01 = o CEVEN nao tem compra registrada.
function diasSemCompra(l, dia) {
  if (l.dias_sem_compra != null && l.dias_sem_compra !== '' && Number.isFinite(Number(l.dias_sem_compra))) return Number(l.dias_sem_compra);
  const u = String(l.ultima_compra || '').slice(0, 10);
  if (/^\d{4}-\d\d-\d\d$/.test(u)) {
    if (+u.slice(0, 4) < 2000) return Infinity; // sem compra registrada
    if (dia) return Math.round((Date.parse(dia + 'T12:00:00Z') - Date.parse(u + 'T12:00:00Z')) / 86400000);
  }
  return null;
}

// Devolve { regra, falhas: [texto...] } (falhas vazio = lance auditado e correto). ctx.dia = dia do lance (AAAA-MM-DD)
export function auditaLance(l, ctx = {}) {
  const falhas = [];
  const chave = String(l.chave || '').replace(/^[A-Z]{3}[|]/, '');
  const tipo = tipoDoLance(chave);
  const obs = String(l.obs || '');
  const falha = (t) => falhas.push(t);
  if (tipo === 'sup' || l.nivel === 'supervisor' || l.nivel === 'marker') return { regra: tipo, falhas: [] }; // aviso de supervisor nao pontua: fora da auditoria de pontos
  const dias = diasSemCompra(l, ctx.dia);

  // --- regras comuns a qualquer lance que pontua
  if (!String(l.vendedor || '').trim()) falha('lance sem vendedor identificado');
  if (l.rca == null || String(l.rca).trim() === '') falha('lance sem código do vendedor (RCA)');
  if (!String(l.supervisor || '').trim()) falha('lance sem supervisor identificado');
  if (String(l.hora || '') && String(l.hora) < '06:00:00') falha('lance registrado antes das 06h (madrugada: roteiro de ontem)');
  if (!Number.isFinite(Number(l.pontos)) || Number(l.pontos) === 0) falha('lance sem pontos definidos');

  // --- regra de cada tipo de lance
  let m;
  if (tipo === 'gol_goleada') {
    m = /(\d+) clientes positivados na rota/.exec(obs);
    if (!m) falha('goleada sem a prova de clientes positivados na rota'); else if (+m[1] < 10) falha(`goleada com ${m[1]} clientes (mínimo 10)`);
  } else if (tipo === 'gol_super') {
    m = /digitado do dia R\$ ([\d.,]+)/.exec(obs);
    if (!m) falha('super pedido sem o valor digitado do dia'); else if (num(m[1]) < 15000) falha(`super pedido com digitado R$ ${m[1]} (mínimo R$ 15.000)`);
  } else if (tipo === 'gol_conversao') {
    m = /(\d+) com venda em (\d+) visitas = (\d+)%/.exec(obs);
    if (!m) falha('conversão sem a prova de visitas e vendas'); else { if (+m[2] < 8) falha(`conversão com ${m[2]} visitas (mínimo 8)`); if (+m[3] < 50) falha(`conversão de ${m[3]}% (mínimo 50%)`); }
  } else if (tipo === 'gol_relampago') {
    m = /check-in as (\d\d):(\d\d).*antes das (\d+)h/.exec(obs);
    if (!m) falha('relâmpago sem a prova do horário do check-in'); else if (hm(+m[1], +m[2]) >= hm(+m[3], 0)) falha(`relâmpago com check-in às ${m[1]}:${m[2]} (limite ${m[3]}h)`);
  } else if (tipo === 'gol_acrescimos') {
    m = /check-in as (\d\d):(\d\d)/.exec(obs);
    if (!m) falha('acréscimos sem a prova do horário do check-in'); else { const t = hm(+m[1], +m[2]); if (t < hm(16, 30) || t >= hm(19, 0)) falha(`acréscimos com check-in às ${m[1]}:${m[2]} (janela 16h30 a 19h)`); }
  } else if (tipo === 'gol_hattrick' || tipo === 'hattrick') {
    m = /(\d+) check-ins em (\d+) min/.exec(obs);
    if (!m) falha('hat-trick sem a prova dos check-ins'); else { if (+m[1] < 3) falha(`hat-trick com ${m[1]} check-ins`); if (+m[2] > 120) falha(`hat-trick em ${m[2]} min (máximo 120)`); }
  } else if (tipo === 'gol_campeao') {
    m = /faturado do mes R\$ ([\d.,]+) >= meta R\$ ([\d.,]+)/.exec(obs);
    if (!m) falha('campeão sem a prova faturado x meta'); else if (num(m[1]) < num(m[2])) falha('campeão com faturado abaixo da meta');
  } else if (tipo === 'gol_meta1t') {
    m = /digitado R\$ ([\d.,]+) >= meta proporcional do dia R\$ ([\d.,]+)/.exec(obs);
    if (!m) falha('meta do 1º tempo sem a prova digitado x meta'); else if (num(m[1]) < num(m[2])) falha('meta do 1º tempo com digitado abaixo da meta do dia');
  } else if (tipo === 'gol_mix' || tipo === 'gol_inativo' || tipo === 'gol_quinzenas') {
    if (!/PEDIDO DE HOJE: \d+|QUINZENA|quinzena/.test(obs) && !/QUALIF/.test(obs)) falha('gol de cliente sem o pedido de hoje comprovado');
    if (tipo === 'gol_inativo' && !(dias > 30)) falha(dias == null ? 'resgate sem como provar os dias sem compra' : 'resgate sem cliente parado há mais de 30 dias');
  } else if (tipo === 'ver_dev' || tipo === 'golcontra_dev') {
    m = /nota (\d+) de (\d{4}-\d\d-\d\d) [|] R\$ ([\d.,]+) [|].*motivo oficial: (.+)$/.exec(obs);
    if (!m) falha('devolução sem nota, valor e motivo oficial');
    else {
      if (!(num(m[3]) > 0)) falha('devolução de R$ 0 (bonificação voltando não é devolução)');
      const naoPediu = /NAO PEDIU|NÃO PEDIU/.test(m[4]);
      if (tipo === 'ver_dev' && !naoPediu) falha('cartão vermelho de devolução sem o motivo "cliente não pediu"');
      if (tipo === 'golcontra_dev' && !MOTIVO_COMERCIAL.test(m[4])) falha('gol contra com motivo que não é comercial');
    }
  } else if (tipo === 'imp') {
    if (/gps/.test(chave)) {
      m = /a (\d+) m do cadastro/.exec(obs);
      if (!m) falha('impedimento de GPS sem a distância gravada'); else if (+m[1] <= 500) falha(`impedimento com check-out a ${m[1]} m (mínimo 501 m)`);
    } else if (!/00:00/.test(obs) && !/tempo 00:00/.test(obs) && String(l.tempo_visita || '') !== '00:00') falha('impedimento sem a prova (GPS fora ou visita de 00:00)');
  } else if (tipo === 'pen') {
    const mot = String(l.motivo || '').toUpperCase(), dtxt = dias == null ? '?' : dias;
    if (/fechado/.test(chave)) { if (!(dias > 45)) falha(`pênalti de cliente fechado com ${dtxt} dias sem compra (mínimo 46)`); }
    else if (!(dias > 30)) falha(`pênalti de estoque com ${dtxt} dias sem compra (mínimo 31)`);
    if (!mot) falha('pênalti sem a justificativa do vendedor');
  } else if (tipo === 'ven10') {
    m = /(\d+) visitas feitas, (\d+) pedidos e digitado R\$ ([\d.,]+) as (\d+)h/.exec(obs);
    if (m) { if (+m[2] > 0 && +m[1] > 0) falha(`amarelo de vendedor com ${m[1]} visitas e ${m[2]} pedidos`); }
    else if (!/nenhuma visita nem check-in de varejo \(\d+ clientes na rota\)/.test(obs)) falha('amarelo sem a prova de visitas e pedidos');
  } else if (tipo === 'vis11' || tipo === 'vis10') {
    m = /(\d+) clientes na rota, (\d+) visitas feitas/.exec(obs);
    if (!m) falha('vermelho de abandono sem a prova de clientes e visitas'); else { if (+m[1] <= 0) falha('abandono de vendedor sem clientes na rota'); if (+m[2] > 0) falha(`abandono de vendedor com ${m[2]} visitas feitas`); }
  } else if (tipo === 'def') {
    if (!String(l.cliente_id || l.cliente || '').trim()) falha('defesa sem o cliente recorrente');
  } else if (tipo === 'pedido_rota') {
    if (!String(l.cliente_id || l.cliente || '').trim()) falha('pedido na rota sem cliente');
  }

  // --- lance de ONTEM disfarçado de hoje: o check-in citado na prova nao pode ser DEPOIS da hora em que o lance foi registrado
  m = /check-in (?:as )?(\d\d):(\d\d)/.exec(obs);
  if (m && String(l.hora || '') && hm(+m[1], +m[2]) > hm(+String(l.hora).slice(0, 2), +String(l.hora).slice(3, 5))) falha(`check-in às ${m[1]}:${m[2]} é depois da hora do registro (${String(l.hora).slice(0, 5)}): dado de ontem`);

  // --- nível do gol qualificado: o extra gravado tem que bater com o nível
  m = /\[QUALIF:([A-Z]+):\+(\d)\]/.exec(obs);
  if (m && EXTRA_NIVEL[m[1]] !== +m[2]) falha(`nível ${m[1]} com extra +${m[2]} (deveria ser +${EXTRA_NIVEL[m[1]]})`);
  if (m && l.qualificacao && String(l.qualificacao).toUpperCase() !== m[1]) falha('nível exibido diferente do gravado na prova');

  return { regra: tipo, falhas };
}

export function auditaLista(lances, dia) {
  const falhos = [], porRegra = {};
  let ok = 0;
  for (const l of lances) {
    const r = auditaLance(l, { dia });
    const p = (porRegra[r.regra] = porRegra[r.regra] || { auditados: 0, falhas: 0 });
    p.auditados++;
    if (r.falhas.length) { p.falhas++; falhos.push({ chave: l.chave, filial: l.filial, rca: l.rca, vendedor: l.vendedor, hora: l.hora, regra: r.regra, pontos: l.pontos, falhas: r.falhas }); } else ok++;
  }
  return { auditados: lances.length, ok, com_falha: falhos.length, por_regra: porRegra, falhos };
}
