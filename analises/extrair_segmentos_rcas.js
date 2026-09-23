const https = require('https');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

const DB_PATH = path.join(__dirname, 'pedidos_historico_ceven.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const HIERARQUIA = JSON.parse(fs.readFileSync(path.join(__dirname, 'hierarquia_completa_ceven.json'), 'utf8'));

console.log('='.repeat(70));
console.log('🎯 EXTRAÇÃO DE SEGMENTO / ÁREA DE ATUAÇÃO DOS RCAs (11 FILIAIS)');
console.log('='.repeat(70));

// 1. Criar tabela de segmentos dos RCAs
db.exec(`
  CREATE TABLE IF NOT EXISTS rca_segmentos (
    rca_id          INTEGER,
    filial_codigo   TEXT,
    filial_sigla    TEXT,
    rca_nome        TEXT,
    supervisor_nome TEXT,
    gerente_nome    TEXT,
    versao_sistema  TEXT,
    area_atuacao    TEXT,
    segmento_nome   TEXT,
    PRIMARY KEY (rca_id, filial_codigo)
  );
`);

function fetchJsonUmaVez(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://ceven.drivetriunfante-locomotiva.com.br/dashboard'
      },
      timeout: 8000
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
function comTimeoutForcado(promessa, ms) {
  return Promise.race([promessa, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}
async function fetchJson(url, retries = 2) {
  for (let n = retries; n >= 1; n--) {
    const r = await comTimeoutForcado(fetchJsonUmaVez(url), 6000);
    if (r !== null) return r;
    if (n > 1) await new Promise(res => setTimeout(res, 300));
  }
  return null;
}

function normalizarSegmento(sigla) {
  if (!sigla) return 'NÃO INFORMADO';
  const s = String(sigla).trim().toUpperCase();
  if (s === 'VJ' || s === 'V') return 'VAREJO (VJ)';
  if (s === 'AS' || s === 'A') return 'AUTO SERVIÇO (AS)';
  if (s === 'ESP' || s === 'E') return 'ESPECIALISTA (ESP)';
  if (s === 'FARMA' || s === 'F') return 'FARMACÊUTICO (FARMA)';
  if (s === 'GER' || s === 'G') return 'GERENTE (GER)';
  if (s === 'PET VJ' || s === 'P') return 'PET VAREJO (PET VJ)';
  if (s === 'PET AS' || s === 'Q') return 'PET AS (PET AS)';
  if (s === 'SUP' || s === 'S') return 'SUPERVISOR (SUP)';
  return s;
}

function normalizarFilial(val) {
  if (!val) return '';
  let s = String(val).trim().toUpperCase();
  if (s.includes('TSJ')) return 'TSJ';
  if (s.includes('TCV')) return 'TCV';
  if (s.includes('TBE')) return 'TBE';
  if (s.includes('ABC')) return 'ABC';
  if (s.includes('TPH')) return 'TPH';
  if (s.includes('MCD')) return 'MCD';
  if (s.includes('TCA')) return 'TCA';
  if (s.includes('API')) return 'API';
  if (s.includes('TCG')) return 'TCG';
  if (s.includes('TPA')) return 'TPA';
  if (s.includes('TBL')) return 'TBL';
  return s;
}

async function coletarSegmentos() {
  const listaRcas = [];
  for (const filial of HIERARQUIA) {
    const filialKey = filial.codigoFilial;
    const filialSigla = normalizarFilial(filial.filial);
    const gerNome = Array.isArray(filial.gerentes) ? filial.gerentes.join(', ') : (filial.gerentes || '');

    for (const sup of filial.supervisores) {
      for (const rca of sup.rcas) {
        if (!rca.rcaId) continue;
        listaRcas.push({
          rcaId: rca.rcaId,
          rcaNome: rca.rcaNome,
          filialKey: filialKey,
          filialSigla: filialSigla,
          supervisorNome: sup.supervisorNome,
          gerenteNome: gerNome
        });
      }
    }
  }

  console.log(`📋 Total de ${listaRcas.length} representantes para consultar área de atuação...`);

  const insertRca = db.prepare(`
    INSERT OR REPLACE INTO rca_segmentos (
      rca_id, filial_codigo, filial_sigla, rca_nome, supervisor_nome,
      gerente_nome, versao_sistema, area_atuacao, segmento_nome
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const CONCURRENCY = 12;
  let idx = 0;
  let sucesso = 0;

  async function worker() {
    while (idx < listaRcas.length) {
      const item = listaRcas[idx++];
      const url = `https://ceven.drivetriunfante-locomotiva.com.br/api/filiais/${item.filialKey}/representante/${item.rcaId}`;
      const data = await fetchJson(url);

      const area = (data && data.area_atuacao) ? data.area_atuacao : '';
      const versao = (data && data.versao_sistema) ? data.versao_sistema : '';

      insertRca.run(
        item.rcaId,
        item.filialKey.toUpperCase(),
        item.filialSigla,
        item.rcaNome,
        item.supervisorNome,
        item.gerenteNome,
        versao,
        area,
        normalizarSegmento(area)
      );

      if (area) sucesso++;
      if (idx % 40 === 0 || idx === listaRcas.length) {
        process.stdout.write(`  Progresso: ${idx}/${listaRcas.length} | Com segmento identificado: ${sucesso}\r`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\n✅ Extração de segmentos concluída: ${sucesso} de ${listaRcas.length} com área mapeada.`);

  // Estatísticas por Segmento
  const stats = db.prepare(`
    SELECT segmento_nome, COUNT(*) as qtd
    FROM rca_segmentos
    GROUP BY segmento_nome
    ORDER BY qtd DESC
  `).all();
  console.log('\n📊 Distribuição dos Representantes por Segmento:');
  console.table(stats);

  // --------------------------------------------------------------------
  // Atualizar tabelas com segmento_rca
  // --------------------------------------------------------------------
  console.log('\n🔄 Atualizando segmento nas tabelas do banco...');

  // Adicionar coluna se não existir em clientes_completo
  try { db.exec("ALTER TABLE clientes_completo ADD COLUMN segmento_rca TEXT;"); } catch(e) {}
  try { db.exec("ALTER TABLE pedidos_historico ADD COLUMN segmento_rca TEXT;"); } catch(e) {}

  db.exec(`
    UPDATE clientes_completo
    SET segmento_rca = (
      SELECT r.segmento_nome 
      FROM rca_segmentos r 
      WHERE r.rca_id = clientes_completo.rca_id 
        AND r.filial_sigla = clientes_completo.filial_sigla
      LIMIT 1
    );

    UPDATE pedidos_historico
    SET segmento_rca = (
      SELECT r.segmento_nome 
      FROM rca_segmentos r 
      WHERE r.rca_id = pedidos_historico.rca_id 
        AND r.filial_sigla = pedidos_historico.filial_sigla
      LIMIT 1
    );
  `);

  console.log('✅ Tabelas atualizadas com o segmento do RCA.');
}

function exportarPlanilhaComSegmento() {
  console.log('\n📊 Atualizando AUDITORIA_COMPLETA_11_FILIAIS.xlsx com a coluna de Segmento...');
  const wb = XLSX.utils.book_new();

  // 1. Histórico de Pedidos com Segmento
  console.log('  1. Histórico_Pedidos...');
  const peds = db.prepare(`
    SELECT 
      filial_sigla AS "Filial",
      gerente_nome AS "Gerente",
      supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA",
      rca_nome AS "Nome_RCA",
      COALESCE(segmento_rca, 'NÃO INFORMADO') AS "Segmento_RCA",
      id_cliente AS "Cód_Cliente",
      cnpj_cliente AS "CNPJ_Cliente",
      nome_cliente AS "Nome_Cliente",
      num_pedido AS "Num_Pedido",
      data_pedido_br AS "Data_Pedido",
      status_pedido AS "Status_Pedido",
      vl_faturado AS "Valor_Faturado_R$",
      vl_cortado AS "Valor_Cortado_R$",
      (vl_faturado + vl_cortado) AS "Valor_Emitido_R$",
      CASE WHEN (vl_faturado + vl_cortado) > 0 THEN 
        ROUND(vl_cortado * 100.0 / (vl_faturado + vl_cortado), 2)
      ELSE 0 END AS "Perc_Corte_Pct",
      qtd_skus AS "Qtd_SKUs",
      qtd_cortados AS "Qtd_SKUs_Cortados"
    FROM pedidos_historico
    ORDER BY filial_sigla, data_pedido DESC, num_pedido DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peds), 'Histórico_Pedidos');

  // 2. Resumo por Filial
  console.log('  2. Resumo_Por_Filial...');
  const resFilial = db.prepare(`
    SELECT 
      filial_sigla AS "Filial",
      SUBSTR(data_pedido, 1, 7) AS "Ano_Mês",
      COUNT(DISTINCT num_pedido) AS "Total_Pedidos",
      COUNT(DISTINCT id_cliente) AS "Clientes_Compradores",
      ROUND(SUM(vl_faturado), 2) AS "Faturamento_Total_R$",
      ROUND(SUM(vl_cortado), 2) AS "Valor_Cortado_R$",
      CASE WHEN SUM(vl_faturado + vl_cortado) > 0 THEN
        ROUND(SUM(vl_cortado) * 100.0 / SUM(vl_faturado + vl_cortado), 2)
      ELSE 0 END AS "Taxa_Corte_Pct",
      ROUND(AVG(vl_faturado), 2) AS "Ticket_Médio_Pedido_R$"
    FROM pedidos_historico
    WHERE data_pedido != ''
    GROUP BY filial_sigla, SUBSTR(data_pedido, 1, 7)
    ORDER BY filial_sigla, "Ano_Mês" DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resFilial), 'Resumo_Por_Filial');

  // 3. Resumo por RCA com Segmento
  console.log('  3. Resumo_Por_RCA...');
  const resRca = db.prepare(`
    SELECT 
      p.filial_sigla AS "Filial",
      p.gerente_nome AS "Gerente",
      p.supervisor_nome AS "Supervisor",
      p.rca_id AS "Cód_RCA",
      p.rca_nome AS "Nome_RCA",
      COALESCE(r.segmento_nome, 'NÃO INFORMADO') AS "Segmento_Canal",
      r.versao_sistema AS "Versão_CEVEN",
      COUNT(DISTINCT p.num_pedido) AS "Total_Pedidos",
      COUNT(DISTINCT p.id_cliente) AS "Clientes_Atendidos",
      ROUND(SUM(p.vl_faturado), 2) AS "Faturamento_Total_R$",
      ROUND(SUM(p.vl_cortado), 2) AS "Valor_Cortado_R$",
      ROUND(AVG(p.vl_faturado), 2) AS "Ticket_Médio_R$"
    FROM pedidos_historico p
    LEFT JOIN rca_segmentos r ON r.rca_id = p.rca_id AND r.filial_sigla = p.filial_sigla
    GROUP BY p.filial_sigla, p.rca_id
    ORDER BY p.filial_sigla, "Faturamento_Total_R$" DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resRca), 'Resumo_Por_RCA');

  // 4. Clientes com Geoloc + Segmento RCA
  console.log('  4. Clientes_Completos_Geoloc...');
  const clis = db.prepare(`
    SELECT 
      c.filial_sigla AS "Filial",
      c.gerente_nome AS "Gerente",
      c.supervisor_nome AS "Supervisor",
      c.rca_id AS "Cód_RCA",
      c.rca_nome AS "Nome_RCA",
      COALESCE(c.segmento_rca, 'NÃO INFORMADO') AS "Segmento_RCA",
      c.id_cliente AS "Cód_Cliente",
      c.cnpj AS "CNPJ",
      c.nome_cliente AS "Nome_Fantasia",
      c.razao_social AS "Razão_Social",
      c.endereco AS "Endereço",
      c.cidade AS "Cidade",
      c.estado AS "UF",
      c.cep AS "CEP",
      c.latitude AS "Latitude",
      c.longitude AS "Longitude",
      c.dias_sem_compra AS "Dias_Sem_Compra",
      CASE 
        WHEN c.dias_sem_compra < 30 THEN 'ATIVO (<30d)'
        WHEN c.dias_sem_compra < 60 THEN 'ALERTA (30-59d)'
        ELSE 'INATIVO (60d+)'
      END AS "Classificação_Carteira",
      c.ultimo_pedido AS "Último_Pedido"
    FROM clientes_completo c
    ORDER BY c.filial_sigla, c.estado, c.cidade, c.dias_sem_compra ASC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clis), 'Clientes_Completos_Geoloc');

  // 5. Oportunidades +MIX
  console.log('  5. Oportunidades_Mais_MIX...');
  const mixData = db.prepare(`
    SELECT 
      filial_sigla AS "Filial",
      estado AS "UF",
      cidade AS "Cidade",
      codprod AS "Cód_Produto",
      produto_nome AS "Descrição_Produto",
      universo_clientes AS "Universo_Clientes_Região",
      clientes_compram AS "Clientes_Que_Compram",
      aderencia_pct AS "Aderência_Pct",
      valor_total_vendido AS "Faturamento_Região_R$",
      ticket_medio_produto AS "Ticket_Médio_R$"
    FROM mix_aderencia_regional
    ORDER BY filial_sigla, estado, cidade, aderencia_pct DESC
    LIMIT 25000
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mixData), 'Oportunidades_Mais_MIX');

  // 6. Penetração por Cidade + População IBGE
  console.log('  6. PDVs_Por_Cidade_IBGE...');
  const pdvCidade = db.prepare(`
    SELECT 
      c.filial_sigla AS "Filial",
      c.estado AS "UF",
      c.cidade AS "Cidade",
      COUNT(DISTINCT c.id_cliente) AS "PDVs_Cadastrados",
      COUNT(DISTINCT CASE WHEN c.dias_sem_compra < 30 THEN c.id_cliente END) AS "PDVs_Ativos_30d",
      COUNT(DISTINCT CASE WHEN c.dias_sem_compra >= 30 THEN c.id_cliente END) AS "PDVs_Inativos_30d_Mais",
      COALESCE(i.populacao_estimada, 0) AS "População_IBGE_2022",
      COALESCE(i.pib_per_capita, 0) AS "PIB_Per_Capita_R$",
      CASE 
        WHEN i.populacao_estimada > 0 THEN 
          ROUND(COUNT(DISTINCT c.id_cliente) * 1000.0 / i.populacao_estimada, 2)
        ELSE NULL 
      END AS "PDVs_Por_Mil_Habitantes"
    FROM clientes_completo c
    LEFT JOIN ibge_municipios i 
      ON UPPER(TRIM(i.nome)) = UPPER(TRIM(c.cidade)) AND UPPER(TRIM(i.uf_sigla)) = UPPER(TRIM(c.estado))
    WHERE c.cidade != '' AND c.estado != ''
    GROUP BY c.filial_sigla, c.estado, c.cidade
    ORDER BY c.filial_sigla, c.estado, "PDVs_Cadastrados" DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pdvCidade), 'PDVs_Por_Cidade_IBGE');

  // 7. Clientes Inativos
  console.log('  7. Clientes_Inativos...');
  const inat = db.prepare(`
    SELECT 
      filial_sigla AS "Filial",
      gerente_nome AS "Gerente",
      supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA",
      rca_nome AS "Nome_RCA",
      COALESCE(segmento_rca, 'NÃO INFORMADO') AS "Segmento_RCA",
      id_cliente AS "Cód_Cliente",
      cnpj AS "CNPJ",
      nome_cliente AS "Nome_Fantasia",
      cidade AS "Cidade",
      estado AS "UF",
      dias_sem_compra AS "Dias_Sem_Compra",
      ultimo_pedido AS "Último_Pedido"
    FROM clientes_completo
    WHERE dias_sem_compra >= 30
    ORDER BY filial_sigla, estado, dias_sem_compra DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inat), 'Clientes_Inativos');

  // 8. Top SKUs
  console.log('  8. Top_SKUs_Vendidos...');
  const topSkus = db.prepare(`
    SELECT 
      filial_codigo AS "Filial",
      codprod AS "Cód_Produto",
      descricao AS "Descrição",
      COUNT(DISTINCT id_cliente) AS "Clientes_Distintos",
      COUNT(DISTINCT num_pedido) AS "Pedidos_Com_Produto",
      SUM(quantidade) AS "Qtd_Total_Vendida",
      ROUND(SUM(valor_total), 2) AS "Faturamento_R$"
    FROM pedidos_historico_itens
    WHERE tipo_registro = 'VENDA' AND codprod != ''
    GROUP BY filial_codigo, codprod
    ORDER BY "Faturamento_R$" DESC
    LIMIT 10000
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topSkus), 'Top_SKUs_Vendidos');

  // 9. Itens Cortados
  console.log('  9. Itens_Cortados_Histórico...');
  const cortados = db.prepare(`
    SELECT 
      filial_codigo AS "Filial",
      codprod AS "Cód_Produto",
      descricao AS "Descrição",
      COUNT(DISTINCT id_cliente) AS "Clientes_Afetados",
      COUNT(DISTINCT num_pedido) AS "Pedidos_Com_Corte",
      SUM(quantidade) AS "Qtd_Total_Cortada",
      ROUND(SUM(valor_total), 2) AS "Valor_Cortado_R$"
    FROM pedidos_historico_itens
    WHERE tipo_registro = 'CORTE' AND codprod != ''
    GROUP BY filial_codigo, codprod
    ORDER BY "Valor_Cortado_R$" DESC
    LIMIT 5000
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cortados), 'Itens_Cortados_Histórico');

  // 10. Devoluções por Filial
  console.log('  10. Resumo_Devoluções_Filial...');
  const dev = db.prepare(`
    SELECT 
      filial_codigo AS "Filial",
      COUNT(DISTINCT numnota) AS "Qtd_Notas_Devolução",
      ROUND(SUM(vl_devolvido_total), 2) AS "Valor_Total_Devolvido_R$",
      COUNT(DISTINCT rca_id) AS "RCAs_Com_Devolução",
      COUNT(DISTINCT codcli) AS "Clientes_Com_Devolução"
    FROM devolucoes_notas
    GROUP BY filial_codigo
    ORDER BY "Valor_Total_Devolvido_R$" DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dev), 'Resumo_Devoluções_Filial');

  const outPath = path.join(__dirname, 'AUDITORIA_COMPLETA_11_FILIAIS.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log(`\n🎉 PLANILHA ATUALIZADA COM SUCESSO: ${outPath}`);
}

async function main() {
  await coletarSegmentos();
  exportarPlanilhaComSegmento();
  db.close();
  console.log('\n🎯 PROCESSO DE SEGMENTAÇÃO DOS RCAs FINALIZADO!');
}

main().catch(err => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});
