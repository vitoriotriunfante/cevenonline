// =========================================================================
// FICHA DO ARQUIVO: functions/api/brasileirao-lances.js
// O QUE É: Consulta todos os lances de auditoria no D1 para a tela /brasileirao
//          Aba "Lances do Dia — Auditoria Completa"
// =========================================================================

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const resp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });

function agoraSP() {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  return `${p.year}-${p.month}-${p.day}`;
}

const REGRAS_PONTOS = {
  gol_campeao: { nome: 'Campeão da Rodada', pontos: 8, motivo: 'Bateu 100% da meta do mês' },
  gol_goleada: { nome: 'Goleada', pontos: 7, motivo: 'Volume excepcional de clientes positivados no dia' },
  gol_meta1t: { nome: 'Meta do 1º Tempo', pontos: 6, motivo: 'Bateu a meta do dia antes das 14h' },
  gol_inativo: { nome: 'Resgate de Inativo / Drible da Vaca', pontos: 6, motivo: 'Recuperou cliente parado >30d (ou >90d), sem a tag RECORRÊNCIA (com a tag o lance é a Defesa)' },
  gol_hattrick: { nome: 'Hat-Trick', pontos: 6, motivo: '3 pedidos seguidos em curto intervalo' },
  hattrick: { nome: 'Hat-Trick', pontos: 6, motivo: '3 pedidos seguidos em curto intervalo' },
  gol_super: { nome: 'Super Pedido', pontos: 5, motivo: 'Pedido de valor muito acima do padrão do vendedor' },
  gol_conversao: { nome: 'Máquina de Conversão', pontos: 5, motivo: 'Alto aproveitamento de visitas em vendas (>=50%)' },
  gol_relampago: { nome: 'Gol Relâmpago', pontos: 4, motivo: 'Pedido fechado logo no início do dia' },
  gol_acrescimos: { nome: 'Gol nos Acréscimos', pontos: 4, motivo: 'Pedido fechado no fim do expediente, sem desistir' },
  gol_mix: { nome: 'Dobrou o Mix', pontos: 4, motivo: 'Vendeu o dobro de SKUs do que costuma no cliente' },
  gol_quinzenas: { nome: 'Dobradinha das Quinzenas', pontos: 3, motivo: 'Comprou na 1ª e na 2ª quinzena do mês' },
  defesa: { nome: 'Defesa (Recorrência)', pontos: 3, motivo: 'Cliente recorrente positivado, mantendo a base ativa' },
  pedido_rota: { nome: 'Pedido Feito na Rota', pontos: 1, motivo: 'Pedido faturado/positivado em cliente da rota do dia com visita/check-in' },
  amarelo: { nome: 'Cartão Amarelo', pontos: -3, motivo: 'Rota ativa sem nenhuma venda até 10h' },
  ven10: { nome: 'Cartão Amarelo', pontos: -3, motivo: 'Rota ativa sem nenhuma venda até 10h' },
  golcontra: { nome: 'Gol Contra', pontos: -4, motivo: 'Devolução de mercadoria registrada hoje' },
  golcontra_dev: { nome: 'Gol Contra', pontos: -4, motivo: 'Devolução de mercadoria registrada hoje' },
  impedimento: { nome: 'Impedimento', pontos: -5, motivo: 'Check-in fora do local (GPS) ou às 00:00' },
  penalti_estoque: { nome: 'Pênalti (Estoque)', pontos: -6, motivo: 'Cliente sem visita há dias por falta de estoque' },
  penalti_fechado: { nome: 'Pênalti (Cliente Fechado)', pontos: -6, motivo: 'Cliente sem visita há dias por estar fechado' },
  penalti: { nome: 'Pênalti', pontos: -6, motivo: 'Justificativa de não-visita em cliente parado' },
  ver_dev: { nome: 'Cartão Vermelho (Devolução "Não Pediu")', pontos: -10, motivo: 'Devolução grave: cliente não pediu o pedido' },
  ver_bonif: { nome: 'Cartão Vermelho (Bonificação Disfarçada)', pontos: -10, motivo: 'Pedido com 2+ itens e soma de valor R$0' },
  vis10: { nome: 'Cartão Vermelho (Abandono de Campo)', pontos: -10, motivo: 'Nenhuma visita feita até às 10h com rota ativa' },
  venda10: { nome: 'Cartão Vermelho (Sem Venda)', pontos: -10, motivo: 'Rota completa sem nenhuma venda até o fim do dia' },
  visita10: { nome: 'Expulsão (Sem Visita)', pontos: -10, motivo: 'Nenhuma visita registrada no dia inteiro' },
  vermelho: { nome: 'Cartão Vermelho', pontos: -10, motivo: 'Infração grave disciplinar de rota' }
};

function achaPontuacao(chave, nivel) {
  const partes = String(chave || '').split('|');
  for (const p of partes) {
    if (REGRAS_PONTOS[p]) return REGRAS_PONTOS[p];
  }
  if (REGRAS_PONTOS[nivel]) return REGRAS_PONTOS[nivel];
  return { nome: nivel ? nivel.toUpperCase() : 'LANCE', pontos: 0, motivo: 'Lance auditado' };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return resp({ erro: 'banco indisponivel' }, 503);
  const u = new URL(request.url);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('dia') || '') ? u.searchParams.get('dia') : agoraSP();
  const filial = (u.searchParams.get('filial') || '').toUpperCase();

  try {
    let query = `SELECT chave, filial, nivel, rca, vendedor, supervisor, cliente_id, cliente, motivo, dias_sem_compra, ultima_compra, tempo_visita, obs, hora_sp, baseline
                 FROM tv_lances WHERE dia = ? AND nivel != 'marker'`;
    const params = [dia];

    if (filial && filial !== 'TODAS' && /^[A-Z]{3}$/.test(filial)) {
      query += ` AND filial = ?`;
      params.push(filial);
    }

    query += ` ORDER BY hora_sp DESC LIMIT 8000`;

    const { results } = await env.DB.prepare(query).bind(...params).all();
    // Campeao da Rodada (gol_campeao) vale UMA vez por vendedor no mes: some do dia se a mesma chave ja apareceu em dia anterior.
    const campeaoAntes = new Set();
    try {
      const { results: ant } = await env.DB.prepare("SELECT DISTINCT filial, chave FROM tv_lances WHERE chave LIKE '%gol_campeao|%' AND dia < ? AND dia >= ?").bind(dia, dia.slice(0, 7) + '-01').all();
      for (const a of ant || []) campeaoAntes.add(a.filial + '#' + a.chave);
    } catch (e) { /* sem historico: nao filtra */ }
    // Impedimento de GPS anterior a 05/10/2026 nao tem comprovacao (auditoria do GPS de check-out: ~metade dos
    // check-outs vinha com ponto-padrao/endereco da empresa e o lance antigo nao guarda distancia, entao nao da
    // para separar o legitimo). Fica no banco, mas nao conta na liga. Decisao do Vitorio: "quero tudo corrigido".
    const GPS_CONFIAVEL_DESDE = '2026-10-06';
    // Devolucao (cartao vermelho / gol contra) anterior a 06/10 tambem sai: sem cliente nem prova gravada, e a rotina que gerava parou em 29/09.
    // Devolucao: vale quando tem a PROVA gravada (nota, cliente, valor e motivo oficial em obs); sem prova nao conta, em qualquer dia.
    const GPS_ANTIGO = /(^|\|)imp\|gps\|/, DEVOLUCAO = /(^|\|)(ver_dev|golcontra_dev)\|/;
    const lancesBrutos = (results || []).filter(l => {
      const ch = String(l.chave || '');
      if (dia < GPS_CONFIAVEL_DESDE && GPS_ANTIGO.test(ch)) return false;
      if (l.nivel === 'semanainvicta') return false; // aviso da Semana Invicta e so para a TV; o +3 do ranking vem da conta semanal do gerador, nunca desta linha
      if (/gol_campeao[|]/.test(ch) && campeaoAntes.has((l.filial || '') + '#' + ch)) return false;
      if (DEVOLUCAO.test(ch)) {
        const o = String(l.obs || '');
        if (!/motivo oficial/.test(o)) return false;
        if (/ [|] R[$] 0 [|] /.test(o)) return false; // bonificacao voltando (nota de R$ 0)
        if (/golcontra_dev/.test(ch) && !/SEM DINHEIRO|COND.{1,3}PAGTO|EMITIU COD|PEDIDO DUPLICADO|RECUSOU MERC|PRECO DIFERENTE/.test(o)) return false; // so motivo comercial
      }
      return true;
    });

    // Um mesmo lance pode estar gravado duas vezes: pela TV da matriz (filial MTZ, chave com prefixo
    // "SIG|") e pela TV de filial ou pelo cron (filial real, chave sem prefixo). Conta cada lance UMA
    // vez. Identidade = filial real + chave sem prefixo (a filial entra para nao juntar, por exemplo,
    // o lance de supervisor de filiais diferentes). Fica a linha da filial real, com a menor hora.
    const prefixo = (c) => { const m = /^([A-Z]{3})\|/.exec(String(c || '')); return m ? m[1] : null; };
    const grupos = new Map();
    for (const l of lancesBrutos) {
      const pre = prefixo(l.chave);
      const filialReal = (l.filial === 'MTZ' && pre) ? pre : (l.filial || pre || '');
      const canon = String(l.chave || '').replace(/^[A-Z]{3}\|/, '');
      const id = filialReal + '|' + canon;
      const g = grupos.get(id);
      if (!g) { grupos.set(id, { ...l, _real: l.filial !== 'MTZ' }); continue; }
      const menor = String(g.hora_sp || '') <= String(l.hora_sp || '') ? g.hora_sp : l.hora_sp;
      const base = (l.filial !== 'MTZ' && !g._real) ? { ...l, _real: true } : g;
      grupos.set(id, { ...base, hora_sp: menor });
    }
    const lancesRaw = [...grupos.values()].sort((a, b) => String(b.hora_sp || '').localeCompare(String(a.hora_sp || '')));
    const duplicadosRemovidos = lancesBrutos.length - lancesRaw.length;

    const porNivel = {};
    const lances = lancesRaw.map(l => {
      porNivel[l.nivel] = (porNivel[l.nivel] || 0) + 1;
      const pont = achaPontuacao(l.chave, l.nivel);
      return {
        hora: l.hora_sp,
        filial: l.filial || (l.chave ? l.chave.split('|')[0] : '—'),
        nivel: l.nivel,
        rca: l.rca,
        vendedor: l.vendedor,
        supervisor: l.supervisor,
        cliente: l.cliente,
        cliente_id: l.cliente_id,
        ultima_compra: l.ultima_compra,
        tempo_visita: l.tempo_visita,
        motivo: l.motivo,
        dias_sem_compra: l.dias_sem_compra,
        obs: l.obs,
        chave: l.chave,
        pontos: pont.pontos,
        pontos_nome: pont.nome,
        pontos_motivo: pont.motivo
      };
    });

    return resp({ dia, filial: filial || 'TODAS', total: lances.length, duplicados_removidos: duplicadosRemovidos, porNivel, lances });
  } catch (e) {
    return resp({ erro: 'falha ao ler lances: ' + e.message }, 500);
  }
}
