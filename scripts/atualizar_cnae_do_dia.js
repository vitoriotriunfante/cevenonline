/**
 * FICHA DO ARQUIVO
 * O QUE É: escolhe automaticamente o CNAE foco do dia (rotação seg-sex por dia da
 *          semana, sem precisar de decisão manual toda manhã) e recalcula o
 *          ratios_por_filial correspondente — não dá pra só trocar o código do CNAE
 *          sem recalcular esse ratio, porque ele é específico por CNAE (usado pra
 *          estimar prospects = visitas * ratio, ver ceven_unified_engine.js linha ~771).
 * RODA: no início do ciclo 04:00 (ceven-cron-whatsapp.yml), antes do motor principal.
 * LÊ: config/ranking_cnae_nacional.json (versionado no git de propósito — precisa
 *     estar disponível no runner do GitHub Actions, que não tem acesso a
 *     auditoria_mensagens/, essa sim gitignorada por ser saída diária).
 *     Gerado por scripts/amostrar_cnae_nacional.js — NÃO roda toda vez, é caro/lento
 *     (~15min via API do CEVEN); atualizar manualmente de vez em quando e copiar
 *     o resultado pra config/ranking_cnae_nacional.json.
 * ESCREVE: config/diretrizes_operacionais.json (só o campo cnae_foco + data_vigencia;
 *          preserva produtos_foco/campanhas_ativas/controles_dia como estão).
 * USADO POR: pipeline/ceven_unified_engine.js (carregarDiretrizesOperacionais) — lido
 *            pelo ciclo 04:00 (aquecimento_matinal) pra estimar prospects por filial.
 * METODOLOGIA DO RATIO (documentada pra poder ser contestada/ajustada):
 *   ratio_filial = 1.0 + (clientes_desse_cnae_na_filial / maior_contagem_entre_filiais) * 3.0
 *   → normaliza pra faixa 1.0–4.0 (mesma ordem de grandeza dos ratios manuais antigos
 *   de CNAE 5611, que iam de 1.35 a 3.90). Filial com mais clientes reais desse CNAE
 *   recebe ratio mais alto (mais prospects esperados por visita).
 * REGRA DE NEGÓCIO: CNAE "Tabacaria" sempre por último na ordem de prioridade, mesmo
 *   que tenha volume alto (decisão do Vitório em 22/09/2026) — não presente na amostra
 *   atual, mas o filtro já está pronto caso apareça.
 * FRESCOR ESPERADO: a ROTAÇÃO roda toda manhã (troca o CNAE do dia); os DADOS de
 *   contagem por CNAE (o ranking em si) só precisam ser regerados de vez em quando
 *   (rodar scripts/amostrar_cnae_nacional.js manualmente quando quiser atualizar).
 */
const fs = require('fs');
const path = require('path');

const RANKING_PATH = path.join(__dirname, '..', 'config', 'ranking_cnae_nacional.json');
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'diretrizes_operacionais.json');
const AMOSTRA_MINIMA_NACIONAL = 20; // ignora CNAEs com amostra nacional muito pequena (ruído)
const MAX_CANDIDATOS = 5; // top N CNAEs reais viram o "pool" da rotação seg-sex

function main() {
  if (!fs.existsSync(RANKING_PATH)) {
    console.log('⚠️  config/ranking_cnae_nacional.json não encontrado — mantendo CNAE do dia anterior sem alteração.');
    return;
  }
  const rankingPath = RANKING_PATH;
  const ranking = JSON.parse(fs.readFileSync(rankingPath, 'utf8'));
  console.log(`Usando ranking de ${rankingPath} (gerado em ${ranking.geradoEm}).`);

  const candidatos = (ranking.rankingNacional || [])
    .filter(c => c.clientes >= AMOSTRA_MINIMA_NACIONAL)
    .filter(c => !/tabacaria/i.test(c.exemplo || ''))
    .sort((a, b) => b.clientes - a.clientes)
    .slice(0, MAX_CANDIDATOS);

  if (candidatos.length === 0) {
    console.log('⚠️  Nenhum CNAE com amostra suficiente — mantendo CNAE do dia anterior.');
    return;
  }

  const diaSemana = new Date().getDay(); // 0=domingo ... 6=sabado
  const idxSegSex = Math.max(0, Math.min(diaSemana - 1, 4)); // sab/dom caem no ultimo (sexta) por segurança
  const escolhido = candidatos[idxSegSex % candidatos.length];

  const porFilial = ranking.porFilial || {};
  const contagensDoCnae = Object.values(porFilial).map(f => f[escolhido.familia] || 0);
  const maiorContagem = Math.max(1, ...contagensDoCnae);

  const ratiosPorFilial = {};
  Object.keys(porFilial).forEach(sigla => {
    const contagem = porFilial[sigla][escolhido.familia] || 0;
    ratiosPorFilial[sigla] = Number((1.0 + (contagem / maiorContagem) * 3.0).toFixed(2));
  });

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  config.data_vigencia = new Date().toISOString().split('T')[0];
  config.cnae_foco = {
    codigo: escolhido.familia,
    descricao: escolhido.exemplo,
    justificativa: `Rotação automática seg-sex — CNAE nacional #${candidatos.indexOf(escolhido) + 1} entre os ${candidatos.length} candidatos com amostra >= ${AMOSTRA_MINIMA_NACIONAL} (${escolhido.clientes} clientes na amostra nacional).`,
    ratios_por_filial: ratiosPorFilial
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  console.log(`✅ CNAE do dia: ${escolhido.familia} (${escolhido.exemplo}) — ratios por filial: ${JSON.stringify(ratiosPorFilial)}`);
}

main();
