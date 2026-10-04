// =========================================================================
// FICHA DO ARQUIVO
// O QUE É: lista de nomes que aparecem como "supervisor" na equipe (planilha / Gestão de Equipe) mas NÃO são
//          supervisores. Registrada na fonte única da equipe (/api/tv-mostra), então vale para TODAS as telas
//          (TV da filial, Matriz, Gestão de Equipe, Brasileirão) e para o WhatsApp, que lê essa mesma resposta.
// DECISÃO DO VITÓRIO (04/10/2026): "tira das contas e registra lá no equipes".
// COMO FUNCIONA: o vendedor continua na equipe, na filial e com o gerente. Só o campo `supervisor` fica vazio
//          (o original é guardado em `supervisor_original`). Vazio = "direto ao gerente". O motor do WhatsApp só
//          troca o supervisor quando a equipe traz um nome; vazio mantém o que o CEVEN informa ("o CEVEN manda").
// PARA ADICIONAR OUTRO CASO: incluir uma linha em NAO_SUPERVISORES (nome sem acento/CLT em maiúsculas + filial).
// =========================================================================

export const NAO_SUPERVISORES = [
  { nome: 'FABIO FURLAN MACHADO', filial: 'TBL', motivo: 'É o gerente de TBL (Fábio Machado); os vendedores são ligados direto a ele. Não é supervisor no CEVEN.' },
  { nome: 'RODRIGO BERTONI', filial: 'TPH', motivo: 'Não é supervisor no CEVEN; os 2 vendedores ficam ligados direto ao gerente (Fábio Colares).' },
  { nome: 'ALESSANDRO DE OLIVEIRA ALMEIDA', filial: 'TBE', motivo: 'Não é supervisor no CEVEN; os 2 vendedores ficam ligados direto ao gerente (Diego).' }
];
const DECIDIDO = { por: 'Vitório Neto (Diretoria)', em: '2026-10-04' };

export const normNome = (n) => String(n || '').replace(/^CLT\s*-\s*/i, '').replace(/^CLT\s+/i, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();

// Aplica a regra na resposta da equipe. Muta e devolve o próprio objeto (idempotente).
export function aplicaNaoSupervisores(corpo) {
  if (!corpo || typeof corpo !== 'object' || !corpo.filiais) return corpo;
  let ajustados = 0;
  for (const chave of Object.keys(corpo.filiais)) {
    const sigla = chave.split('_')[0].toUpperCase(); // SIGLA_GRUPO -> SIGLA
    for (const item of corpo.filiais[chave] || []) {
      if (!item || !item.supervisor) continue;
      const n = normNome(item.supervisor);
      if (NAO_SUPERVISORES.some((x) => x.nome === n && x.filial === sigla)) {
        item.supervisor_original = item.supervisor;
        item.supervisor = '';
        ajustados++;
      }
    }
  }
  corpo.nao_supervisores = { ...DECIDIDO, regra: 'supervisor vazio = direto ao gerente', lista: NAO_SUPERVISORES, vendedores_ajustados_na_ultima_resposta: ajustados || (corpo.nao_supervisores ? corpo.nao_supervisores.vendedores_ajustados_na_ultima_resposta : 0) };
  return corpo;
}
