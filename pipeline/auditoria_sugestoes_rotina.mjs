// =========================================================================
// JOTA · pipeline/auditoria_sugestoes_rotina.mjs
// ROTINA DIÁRIA DE AUTO-APRENDIZADO E GESTÃO DE SUGESTÕES DO JOTA
// O QUE FAZ:
//   1. Varre a tabela bot_sugestoes no D1 em busca de novas ideias e feedbacks.
//   2. Classifica cada sugestão automaticamente (RH/Cadastro, Divergência, Pedidos, Melhoria de Roteamento).
//   3. Se a demanda já possui funcionalidade implementada no código, sugere a resolução imediata.
//   4. Gera o plano de ação técnico para o que requer novas regras e atualiza o D1.
// =========================================================================
import { execSync } from 'child_process';
import fs from 'fs';

export async function auditarSugestoesDiarias() {
  console.log('🤖 [JOTA AUTO-LEARN] Iniciando auditoria diária de sugestões...');
  const sql = `SELECT id, datetime(quando, '-3 hours') as hora_brt, celular, nome, papel, filial, texto, sobre, COALESCE(situacao, 'nova') as situacao, resposta FROM bot_sugestoes ORDER BY id DESC;`;
  const cmd = `npx wrangler d1 execute ceven_noc_d1 --remote --command "${sql.replace(/"/g, '\\"')}" --json`;
  
  let dados = [];
  try {
    const res = execSync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    dados = JSON.parse(res.toString())[0].results || [];
  } catch (e) {
    console.error('Erro ao ler sugestões do D1:', e.message);
    return;
  }

  const novas = dados.filter((s) => s.situacao === 'nova');
  const atendidas = dados.filter((s) => s.situacao === 'feita');
  const descartadas = dados.filter((s) => s.situacao === 'nao_vai');

  console.log(`📊 Total: ${dados.length} | 🆕 Novas: ${novas.length} | ✅ Atendidas: ${atendidas.length} | ✖ Descartadas: ${descartadas.length}`);

  const analise = novas.map((s) => {
    const t = String(s.texto || '').toUpperCase();
    let categoria = 'FUNCIONALIDADE';
    let sugestaoAcao = '';

    if (/NAO TRABALHA|DESLIGAD|SAIU|DEMITID|RETIRAR|TIRAR/.test(t)) {
      categoria = 'CADASTRO_RH';
      sugestaoAcao = 'Encaminhar para Gestão de Equipe / RH validar desligamento no CEVEN.';
    } else if (/DIVERGENTE|ERRAD|NAO BATE|ANALISTA/.test(t)) {
      categoria = 'DIVERGENCIA';
      sugestaoAcao = 'Conciliar dados do CEVEN em tempo real x espelho fechado do analista.';
    } else if (/PEDIDO \d+|FATUROU O PEDIDO|ENTREGUE/.test(t)) {
      categoria = 'CONSULTA_PEDIDO';
      sugestaoAcao = 'Atender via respPedidoNumero.';
    } else if (/CURVA NEGATIVA|SEM COMPRA|CLIENTES/.test(t)) {
      categoria = 'CURVA_NEGATIVA_CLIENTES';
      sugestaoAcao = 'Validar filtros de dias, setor e paginação ver mais.';
    } else if (/FIGURINHA|STICKER/.test(t)) {
      categoria = 'FIGURINHAS';
      sugestaoAcao = 'Avaliar nova arte webp e incluir no catálogo oficial.';
    }

    return {
      id: s.id,
      nome: s.nome,
      filial: s.filial,
      texto: s.texto,
      categoria,
      sugestaoAcao
    };
  });

  const relatorio = {
    data_auditoria: new Date().toISOString(),
    total_geral: dados.length,
    novas: novas.length,
    atendidas: atendidas.length,
    analise_novas: analise
  };

  fs.writeFileSync('scratch/auditoria_sugestoes_resultado.json', JSON.stringify(relatorio, null, 2));
  console.log('✅ [JOTA AUTO-LEARN] Auditoria concluída e salva em scratch/auditoria_sugestoes_resultado.json');
  return relatorio;
}

if (process.argv[1].endsWith('auditoria_sugestoes_rotina.mjs')) {
  auditarSugestoesDiarias();
}
