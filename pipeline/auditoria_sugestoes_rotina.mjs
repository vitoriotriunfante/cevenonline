// =========================================================================
// JOTA · pipeline/auditoria_sugestoes_rotina.mjs
// ROTINA DIÁRIA DE AUTO-APRENDIZADO E GESTÃO DE SUGESTÕES DO JOTA
// O QUE FAZ:
//   1. Varre a tabela bot_sugestoes no D1 em busca de novas ideias e feedbacks.
//   2. Classifica cada sugestão automaticamente:
//      - AÇÃO DA DIRETORIA (alteração cadastral direta em config_equipe_soberana, desativação de RCA, separação de pastas/equipes).
//      - ATENDIDA / FUNCIONALIDADE EXISTENTE (regras já em produção no motor Jota).
//      - EM ANDAMENTO / ATENÇÃO (demandas técnicas específicas requerendo implementação de código).
//   3. Gera plano de ação técnico direto e salva auditoria.
// =========================================================================
import { execSync } from 'child_process';
import fs from 'fs';

export async function auditarSugestoesDiarias() {
  console.log('🤖 [JOTA AUTO-LEARN] Iniciando auditoria diária de sugestões...');
  const sql = `SELECT id, datetime(quando, '-3 hours') as hora_brt, celular, nome, papel, filial, texto, sobre, COALESCE(situacao, 'nova') as situacao, resposta FROM bot_sugestoes ORDER BY id DESC;`;
  const cmd = `npx wrangler d1 execute ceven_noc_d1 --remote --command="${sql.replace(/"/g, '\\"')}"`;
  
  let dados = [];
  try {
    const res = execSync(cmd, { maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' });
    const jsonStart = res.indexOf('[');
    if (jsonStart !== -1) {
      dados = JSON.parse(res.slice(jsonStart))[0]?.results || [];
    }
  } catch (e) {
    console.error('Erro ao ler sugestões do D1:', e.message);
    return;
  }

  const novas = dados.filter((s) => s.situacao === 'nova');
  const atencao = dados.filter((s) => s.situacao === 'atencao');
  const atendidas = dados.filter((s) => s.situacao === 'feita');
  const descartadas = dados.filter((s) => s.situacao === 'nao_vai');

  console.log(`📊 Total: ${dados.length} | 🆕 Novas: ${novas.length} | ⚡ Precisa de Ação: ${atencao.length} | ✅ Atendidas: ${atendidas.length} | ✖ Descartadas: ${descartadas.length}`);

  const analise = novas.map((s) => {
    const t = String(s.texto || '').toUpperCase();
    let categoria = 'FUNCIONALIDADE';
    let planoAcao = '';

    if (/NAO TRABALHA|DESLIGAD|SAIU|DEMITID|RETIRAR|TIRAR/.test(t)) {
      categoria = 'CADASTRO_EQUIPE_DIRETORIA';
      planoAcao = 'Ação da Diretoria: inativar vendedor/RCA em config_equipe_soberana (mostra = false) e desvincular do supervisor.';
    } else if (/PASTA|MARCAS PROPRIAS|MP |COLGATE|RED BULL|MAURI/.test(t)) {
      categoria = 'SEPARACAO_PASTAS_DIRETORIA';
      planoAcao = 'Ação da Diretoria: alinhar pastas e travar relatórios de Marcas Próprias para não impactar gestores de outras linhas.';
    } else if (/DIVERGENTE|ERRAD|NAO BATE|ANALISTA/.test(t)) {
      categoria = 'DIVERGENCIA';
      planoAcao = 'Explicar conciliação online em tempo real x espelho consolidado.';
    } else if (/PEDIDO \d+|FATUROU O PEDIDO|ENTREGUE/.test(t)) {
      categoria = 'CONSULTA_PEDIDO';
      planoAcao = 'Atender via busca de pedido por número ou verificar integração de canhoto/entrega.';
    } else if (/CURVA NEGATIVA|SEM COMPRA|CLIENTES/.test(t)) {
      categoria = 'CURVA_NEGATIVA_CLIENTES';
      planoAcao = 'Verificar limite de envio e suporte a paginação ver mais para listas grandes.';
    } else if (/FIGURINHA|STICKER/.test(t)) {
      categoria = 'FIGURINHAS';
      planoAcao = 'Verificar se já existe no catálogo de figurinhas ou desenhar nova arte.';
    }

    return {
      id: s.id,
      nome: s.nome,
      filial: s.filial,
      texto: s.texto,
      categoria,
      planoAcao
    };
  });

  const relatorio = {
    data_auditoria: new Date().toISOString(),
    total_geral: dados.length,
    novas: novas.length,
    precisa_de_acao: atencao.length,
    atendidas: atendidas.length,
    itens_em_atencao: atencao.map(a => ({ id: a.id, nome: a.nome, filial: a.filial, texto: a.texto, resposta: a.resposta })),
    analise_novas: analise
  };

  fs.writeFileSync('scratch/auditoria_sugestoes_resultado.json', JSON.stringify(relatorio, null, 2));
  console.log('✅ [JOTA AUTO-LEARN] Auditoria concluída e salva em scratch/auditoria_sugestoes_resultado.json');
  return relatorio;
}

if (process.argv[1] && process.argv[1].endsWith('auditoria_sugestoes_rotina.mjs')) {
  auditarSugestoesDiarias();
}
