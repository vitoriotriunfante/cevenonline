/**
 * FICHA DO ARQUIVO
 * O QUE É: coleta e acumula, dia a dia, o motivo/justificativa que o vendedor
 *          registra quando visita um cliente e não vende (campo
 *          motivo_nao_visita da API, que aparece mesmo em visitas com status
 *          VISITADO -- pedido do Vitório em 23/09/2026: "agora quando o
 *          vendedor não vende ele precisa justificar... precisa começar a
 *          tabular junto com as visitas diárias"). Ainda sem relatório —
 *          só acumula o dataset pra análise futura.
 * RODA: manual por enquanto (node scripts/coletar_justificativas_visitas.js).
 *       Ainda não está em nenhum workflow agendado.
 * LÊ: API do CEVEN ao vivo (/api/rca/roteiro-hoje) via pipeline/ceven_unified_engine.js
 *     + scripts/supervisores_11_filiais_completo.json (árvore de vendedores).
 * ESCREVE: analises/historico_justificativas_visitas.jsonl (append-only, 1 linha
 *          por visita-com-justificativa-registrada, 1 dia por rodada).
 * USADO POR: análises futuras de motivo de zerado (ainda não construídas).
 * FRESCOR ESPERADO: cada linha vale só pro dia em que rodou (roteiro-hoje é
 *          sempre o dia corrente da API, não retroativo).
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const engine = require('../pipeline/ceven_unified_engine.js');

const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';
const OUT_PATH = path.join(__dirname, '../analises/historico_justificativas_visitas.jsonl');

async function main() {
  const token = await engine.getAdminToken();
  const headers = { Authorization: 'Bearer ' + token };
  const repsMap = engine.carregarValidacaoVendedores();
  const reps = Object.values(repsMap);
  const hoje = new Date().toISOString().slice(0, 10);

  console.log(`📋 Coletando justificativas de visita de ${reps.length} vendedores para ${hoje}...`);

  const linhas = [];
  const BATCH = 10;
  for (let i = 0; i < reps.length; i += BATCH) {
    const lote = reps.slice(i, i + BATCH);
    await Promise.all(lote.map(async v => {
      const filEntry = Object.entries(engine.FILIAIS_MAP).find(([k, fv]) => fv.sigla === v.filial);
      if (!filEntry) return;
      const fKey = filEntry[0];
      try {
        const clients = await axios.get(`${CEVEN_BASE}/api/rca/roteiro-hoje?filial=${fKey}&id=${v.rca}`, { headers, timeout: 10000 }).then(r => r.data || []);
        clients.forEach(c => {
          const motivo = (c.motivo_nao_visita || '').trim();
          if (!motivo) return; // só grava quando o vendedor de fato justificou algo
          const dataUltimaCompra = c.data_ultima_compra ? String(c.data_ultima_compra).slice(0, 10) : null;
          const diasSemCompra = dataUltimaCompra
            ? Math.floor((new Date(hoje) - new Date(dataUltimaCompra)) / (1000 * 60 * 60 * 24))
            : null;
          linhas.push({
            data: hoje,
            filial: v.filial,
            rca: v.rca,
            vendedor: v.nome,
            supervisor: v.supNome,
            gerente: v.gerente,
            id_cliente: c.id_cliente,
            cliente: c.nome_cliente,
            cnpj: c.cnpj,
            status_visita: c.status,
            motivo,
            observacao: (c.observacao_nao_visita || '').trim() || null,
            data_ultima_compra: dataUltimaCompra,
            dias_sem_compra: diasSemCompra
          });
        });
      } catch (e) {}
    }));
  }

  if (linhas.length === 0) {
    console.log('⚠️ Nenhuma justificativa encontrada hoje (ou API fora do ar).');
    return;
  }

  const bloco = linhas.map(l => JSON.stringify(l)).join('\n') + '\n';
  fs.appendFileSync(OUT_PATH, bloco, 'utf8');
  console.log(`✅ ${linhas.length} justificativas de ${hoje} adicionadas em ${OUT_PATH}`);
}

main().catch(e => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
