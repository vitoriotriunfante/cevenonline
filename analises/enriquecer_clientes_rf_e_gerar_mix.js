const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

const DB_PATH = path.join(__dirname, 'pedidos_historico_ceven.db');
// Cadastro oficial do WinThor (ERP) — muito mais completo e confiável que a
// planilha de Receita Federal antiga, e já vem com Município/UF/lat/long/CNAE
// direto do cadastro real de cliente. Vitório atualiza esse arquivo manualmente
// de vez em quando (é um export do WinThor, não tem endpoint de API pra isso).
const XLSX_PATH = path.join(__dirname, '..', 'Cadastro clientes WinThor 2026-09-16.xlsx');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

console.log('='.repeat(70));
console.log('🚀 ENRIQUECIMENTO DE CLIENTES RF 2026 (CIDADE, UF, RS, MT, MS, COORDENADAS) + TABELA +MIX');
console.log('='.repeat(70));

function cleanCNPJ(v) {
  if (!v) return '';
  return String(v).replace(/\D/g, '');
}

function parseCoord(val) {
  if (!val) return null;
  let str = String(val).trim();
  // Tratar formatos tipo -2.289.431.559 -> -22.89431559
  if (str.startsWith('-') && str.split('.').length > 2) {
    const parts = str.split('.');
    const clean = parts[0] + parts[1] + '.' + parts.slice(2).join('');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  }
  const num = parseFloat(str.replace(',', '.'));
  return isNaN(num) ? null : num;
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

// --------------------------------------------------------------------
// ETAPA 1: Carregar Clientes RF e Enriquecer clientes_completo
// --------------------------------------------------------------------
async function carregarClientesRF() {
  console.log(`\n📖 Lendo ${path.basename(XLSX_PATH)}...`);

  // Criar tabela de referência (cadastro oficial WinThor) se não existir
  db.exec(`
    CREATE TABLE IF NOT EXISTS rf_clientes_2026 (
      cnpj_limpo   TEXT PRIMARY KEY,
      cnpj         TEXT,
      filial       TEXT,
      cidade       TEXT,
      uf           TEXT,
      cep          TEXT,
      endereco     TEXT,
      bairro       TEXT,
      latitude     REAL,
      longitude    REAL,
      atividade    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_rfc_cnpj ON rf_clientes_2026 (cnpj_limpo);
    CREATE INDEX IF NOT EXISTS idx_rfc_uf   ON rf_clientes_2026 (uf);
    CREATE INDEX IF NOT EXISTS idx_rfc_cid  ON rf_clientes_2026 (cidade);
  `);
  db.exec('DELETE FROM rf_clientes_2026;');

  const insertRf = db.prepare(`
    INSERT OR REPLACE INTO rf_clientes_2026 (
      cnpj_limpo, cnpj, filial, cidade, uf, cep, endereco, bairro, latitude, longitude, atividade
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const wb = XLSX.readFile(XLSX_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

  let count = 0;
  const flushBatch = db.transaction((linhas) => {
    for (const r of linhas) {
      const cnpjRaw = String(r['CNPJ/CPF (como está no cadastro)'] || '').trim();
      const cnpjLimpo = cleanCNPJ(String(r['CNPJ/CPF (só dígitos)'] || cnpjRaw));
      if (!cnpjLimpo) continue;

      let uf = String(r['UF'] || '').toUpperCase().trim();

      insertRf.run(
        cnpjLimpo,
        cnpjRaw,
        '', // filial não vem direto nessa planilha (cruza por CNPJ/rota, não por sigla aqui)
        String(r['Município'] || '').trim(),
        uf,
        String(r['CEP'] || '').trim(),
        String(r['Endereço'] || '').trim(),
        String(r['Bairro'] || '').trim(),
        parseCoord(r['Latitude']),
        parseCoord(r['Longitude']),
        String(r['Cód. atividade'] || '').trim()
      );
      count++;
    }
  });

  const BATCH = 2000;
  for (let i = 0; i < rows.length; i += BATCH) {
    flushBatch(rows.slice(i, i + BATCH));
    process.stdout.write(`  Linhas carregadas do cadastro WinThor: ${Math.min(i + BATCH, rows.length).toLocaleString()}\r`);
  }
  console.log(`\n✅ ${count.toLocaleString()} registros do cadastro WinThor importados.`);

  // --------------------------------------------------------------------
  // ETAPA 2: Atualizar clientes_completo com Cidade, UF e Coordenadas
  // --------------------------------------------------------------------
  console.log('\n🔄 Atualizando clientes_completo cruzando com RF...');
  
  db.exec(`
    UPDATE clientes_completo
    SET 
      cidade = COALESCE((
        SELECT r.cidade FROM rf_clientes_2026 r 
        WHERE r.cnpj_limpo = REPLACE(REPLACE(REPLACE(REPLACE(clientes_completo.cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
          AND r.cidade != '' LIMIT 1
      ), cidade),
      estado = COALESCE((
        SELECT r.uf FROM rf_clientes_2026 r 
        WHERE r.cnpj_limpo = REPLACE(REPLACE(REPLACE(REPLACE(clientes_completo.cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
          AND r.uf != '' LIMIT 1
      ), estado),
      cep = COALESCE((
        SELECT r.cep FROM rf_clientes_2026 r 
        WHERE r.cnpj_limpo = REPLACE(REPLACE(REPLACE(REPLACE(clientes_completo.cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
          AND r.cep != '' LIMIT 1
      ), cep),
      latitude = COALESCE((
        SELECT r.latitude FROM rf_clientes_2026 r 
        WHERE r.cnpj_limpo = REPLACE(REPLACE(REPLACE(REPLACE(clientes_completo.cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
          AND r.latitude IS NOT NULL LIMIT 1
      ), latitude),
      longitude = COALESCE((
        SELECT r.longitude FROM rf_clientes_2026 r 
        WHERE r.cnpj_limpo = REPLACE(REPLACE(REPLACE(REPLACE(clientes_completo.cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
          AND r.longitude IS NOT NULL LIMIT 1
      ), longitude)
  `);

  const statUf = db.prepare(`
    SELECT estado, COUNT(*) as qtd 
    FROM clientes_completo 
    WHERE estado != '' 
    GROUP BY estado 
    ORDER BY qtd DESC
  `).all();
  console.log('\n📍 Clientes Atualizados por UF (incluindo RS, MT, MS, PR, SP, etc.):');
  console.table(statUf);

  const totalComCidade = db.prepare("SELECT COUNT(*) as c FROM clientes_completo WHERE cidade != ''").get().c;
  console.log(`Total de clientes com Cidade e UF oficiais: ${totalComCidade.toLocaleString()} de 43.549`);
}

// --------------------------------------------------------------------
// ETAPA 3: Gerar Tabela do +MIX (Aderência Regional de Produtos)
// --------------------------------------------------------------------
function calcularTabelaMix() {
  console.log('\n' + '='.repeat(70));
  console.log('🛍️ ETAPA 3: GERANDO TABELA DO +MIX (+ADERÊNCIA REGIONAL DE PRODUTOS)');
  console.log('='.repeat(70));

  // Criar tabela de oportunidades de Mix por Cidade/Região
  db.exec(`
    CREATE TABLE IF NOT EXISTS mix_aderencia_regional (
      filial_sigla     TEXT,
      estado           TEXT,
      cidade           TEXT,
      codprod          TEXT,
      produto_nome     TEXT,
      universo_clientes INTEGER,
      clientes_compram INTEGER,
      aderencia_pct    REAL,
      valor_total_vendido REAL,
      ticket_medio_produto REAL,
      PRIMARY KEY (filial_sigla, cidade, codprod)
    );
    DELETE FROM mix_aderencia_regional;
  `);

  console.log('  Calculando penetração e aderência de produtos por Praça/Cidade...');

  db.exec(`
    INSERT INTO mix_aderencia_regional (
      filial_sigla, estado, cidade, codprod, produto_nome,
      universo_clientes, clientes_compram, aderencia_pct,
      valor_total_vendido, ticket_medio_produto
    )
    SELECT 
      c.filial_sigla,
      c.estado,
      c.cidade,
      i.codprod,
      i.descricao AS produto_nome,
      uni.universo_total AS universo_clientes,
      COUNT(DISTINCT i.id_cliente) AS clientes_compram,
      ROUND(COUNT(DISTINCT i.id_cliente) * 100.0 / uni.universo_total, 1) AS aderencia_pct,
      ROUND(SUM(i.valor_total), 2) AS valor_total_vendido,
      ROUND(AVG(i.valor_total), 2) AS ticket_medio_produto
    FROM pedidos_historico_itens i
    JOIN clientes_completo c 
      ON c.id_cliente = i.id_cliente AND c.filial_codigo = i.filial_codigo
    JOIN (
      -- Universo de clientes com histórico na cidade
      SELECT filial_sigla, cidade, COUNT(DISTINCT id_cliente) as universo_total
      FROM clientes_completo
      WHERE cidade != ''
      GROUP BY filial_sigla, cidade
      HAVING COUNT(DISTINCT id_cliente) >= 5
    ) uni ON uni.filial_sigla = c.filial_sigla AND uni.cidade = c.cidade
    WHERE i.tipo_registro = 'VENDA' 
      AND i.codprod != '' 
      AND c.cidade != ''
    GROUP BY c.filial_sigla, c.cidade, i.codprod
    HAVING COUNT(DISTINCT i.id_cliente) >= 3
    ORDER BY c.filial_sigla, c.cidade, aderencia_pct DESC
  `);

  const totalMix = db.prepare("SELECT COUNT(*) as c FROM mix_aderencia_regional").get().c;
  console.log(`✅ Tabela +MIX calculada com ${totalMix.toLocaleString()} oportunidades de produtos regionais.`);

  const sampleMix = db.prepare(`
    SELECT filial_sigla AS Filial, cidade AS Cidade, produto_nome AS Produto, 
           universo_clientes AS Universo, clientes_compram AS "Compram", 
           aderencia_pct || '%' AS "Aderência"
    FROM mix_aderencia_regional
    ORDER BY universo_clientes DESC, aderencia_pct DESC
    LIMIT 6
  `).all();
  console.table(sampleMix);
}

// --------------------------------------------------------------------
// ETAPA 4: Regenerar Planilha Master com as novas abas
// --------------------------------------------------------------------
function exportarExcelConsolidado() {
  console.log('\n📊 Exportando AUDITORIA_COMPLETA_11_FILIAIS.xlsx com +MIX e IBGE...');
  const wb = XLSX.utils.book_new();

  // 1. Histórico de Pedidos
  console.log('  1. Histórico_Pedidos...');
  const peds = db.prepare(`
    SELECT 
      filial_sigla AS "Filial", gerente_nome AS "Gerente", supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA", rca_nome AS "Nome_RCA", id_cliente AS "Cód_Cliente",
      cnpj_cliente AS "CNPJ_Cliente", nome_cliente AS "Nome_Cliente", num_pedido AS "Num_Pedido",
      data_pedido_br AS "Data_Pedido", status_pedido AS "Status_Pedido",
      vl_faturado AS "Valor_Faturado_R$", vl_cortado AS "Valor_Cortado_R$",
      (vl_faturado + vl_cortado) AS "Valor_Emitido_R$",
      CASE WHEN (vl_faturado + vl_cortado) > 0 THEN 
        ROUND(vl_cortado * 100.0 / (vl_faturado + vl_cortado), 2)
      ELSE 0 END AS "Perc_Corte_Pct",
      qtd_skus AS "Qtd_SKUs", qtd_cortados AS "Qtd_SKUs_Cortados"
    FROM pedidos_historico
    ORDER BY filial_sigla, data_pedido DESC, num_pedido DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peds), 'Histórico_Pedidos');

  // 2. Resumo por Filial
  console.log('  2. Resumo_Por_Filial...');
  const resFilial = db.prepare(`
    SELECT 
      filial_sigla AS "Filial", SUBSTR(data_pedido, 1, 7) AS "Ano_Mês",
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

  // 3. Resumo por RCA
  console.log('  3. Resumo_Por_RCA...');
  const resRca = db.prepare(`
    SELECT 
      filial_sigla AS "Filial", gerente_nome AS "Gerente", supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA", rca_nome AS "Nome_RCA",
      COUNT(DISTINCT num_pedido) AS "Total_Pedidos",
      COUNT(DISTINCT id_cliente) AS "Clientes_Atendidos",
      ROUND(SUM(vl_faturado), 2) AS "Faturamento_Total_R$",
      ROUND(SUM(vl_cortado), 2) AS "Valor_Cortado_R$",
      ROUND(AVG(vl_faturado), 2) AS "Ticket_Médio_R$"
    FROM pedidos_historico
    GROUP BY filial_sigla, rca_id
    ORDER BY filial_sigla, "Faturamento_Total_R$" DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resRca), 'Resumo_Por_RCA');

  // 4. Clientes com Cidade, UF e Inatividade Real
  console.log('  4. Clientes_Completos_Geoloc...');
  const clis = db.prepare(`
    SELECT 
      filial_sigla AS "Filial", gerente_nome AS "Gerente", supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA", rca_nome AS "Nome_RCA", id_cliente AS "Cód_Cliente",
      cnpj AS "CNPJ", nome_cliente AS "Nome_Fantasia", razao_social AS "Razão_Social",
      endereco AS "Endereço", cidade AS "Cidade", estado AS "UF", cep AS "CEP",
      latitude AS "Latitude", longitude AS "Longitude",
      dias_sem_compra AS "Dias_Sem_Compra",
      CASE 
        WHEN dias_sem_compra < 30 THEN 'ATIVO (<30d)'
        WHEN dias_sem_compra < 60 THEN 'ALERTA (30-59d)'
        ELSE 'INATIVO (60d+)'
      END AS "Classificação_Carteira",
      ultimo_pedido AS "Último_Pedido"
    FROM clientes_completo
    ORDER BY filial_sigla, estado, cidade, dias_sem_compra ASC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clis), 'Clientes_Completos_Geoloc');

  // 5. NOVA ABA: +MIX Oportunidades Regionais
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

  // 6. Penetração por Cidade + População IBGE (MT, MS, RS, PR, SC, SP)
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

  // 7. Clientes Inativos (30+ dias)
  console.log('  7. Clientes_Inativos...');
  const inat = db.prepare(`
    SELECT 
      filial_sigla AS "Filial", gerente_nome AS "Gerente", supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA", rca_nome AS "Nome_RCA", id_cliente AS "Cód_Cliente",
      cnpj AS "CNPJ", nome_cliente AS "Nome_Fantasia", cidade AS "Cidade", estado AS "UF",
      dias_sem_compra AS "Dias_Sem_Compra", ultimo_pedido AS "Último_Pedido"
    FROM clientes_completo
    WHERE dias_sem_compra >= 30
    ORDER BY filial_sigla, estado, dias_sem_compra DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inat), 'Clientes_Inativos');

  // 8. Top SKUs
  console.log('  8. Top_SKUs_Vendidos...');
  const topSkus = db.prepare(`
    SELECT 
      filial_codigo AS "Filial", codprod AS "Cód_Produto", descricao AS "Descrição",
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
      filial_codigo AS "Filial", codprod AS "Cód_Produto", descricao AS "Descrição",
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
  await carregarClientesRF();
  calcularTabelaMix();
  exportarExcelConsolidado();
  db.close();
  console.log('\n🎯 PROCESSO COMPLETO FINALIZADO COM SUCESSO!');
}

main().catch(err => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});
