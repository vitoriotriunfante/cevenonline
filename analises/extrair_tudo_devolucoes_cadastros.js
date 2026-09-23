const https = require('https');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

const DB_PATH = path.join(__dirname, 'pedidos_historico_ceven.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const HIERARQUIA = JSON.parse(fs.readFileSync(path.join(__dirname, 'hierarquia_completa_ceven.json'), 'utf8'));

// Helper HTTP com trava de timeout FORÇADA (independente do timeout nativo do https.get,
// que já demonstrou não disparar em alguns casos e travar o processo por horas).
function fetchJsonUmaVez(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://ceven.drivetriunfante-locomotiva.com.br/dashboard'
      },
      timeout: 12000,
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function comTimeoutForcado(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

async function fetchJson(url, retries = 2) {
  for (let n = retries; n >= 1; n--) {
    const resultado = await comTimeoutForcado(fetchJsonUmaVez(url), 6000);
    if (resultado !== null) return resultado;
    if (n > 1) await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

function parseMoney(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  let str = String(val).replace('R$', '').replace('r$', '').trim();
  if (str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(',', '.');
  else if (str.includes(',')) str = str.replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseDateBR(str) {
  if (!str) return null;
  // Se for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const p = str.slice(0, 10).split('-');
    return { iso: `${p[0]}-${p[1]}-${p[2]}`, br: `${p[2]}/${p[1]}/${p[0]}`, obj: new Date(`${p[0]}-${p[1]}-${p[2]}T12:00:00Z`) };
  }
  // Se for DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const p = str.slice(0, 10).split('/');
    return { iso: `${p[2]}-${p[1]}-${p[0]}`, br: `${p[0]}/${p[1]}/${p[2]}`, obj: new Date(`${p[2]}-${p[1]}-${p[0]}T12:00:00Z`) };
  }
  return null;
}

function parseDateTimeBR(str) {
  if (!str) return null;
  // Ex: "04/09/2026 09:49"
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (m) {
    const [_, d, mo, y, h, mi] = m;
    const dateObj = new Date(Date.UTC(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(mi)));
    return {
      iso: `${y}-${mo}-${d} ${h}:${mi}:00`,
      dataIso: `${y}-${mo}-${d}`,
      br: `${d}/${mo}/${y} ${h}:${mi}`,
      dataBr: `${d}/${mo}/${y}`,
      timestamp: dateObj.getTime(),
      dateObj
    };
  }
  return null;
}

// Inicializar tabelas no banco de dados
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS devolucoes_notas (
      chave_nota TEXT PRIMARY KEY,
      filial_codigo TEXT,
      filial_key TEXT,
      rca_id INTEGER,
      rca_nome TEXT,
      supervisor_id INTEGER,
      supervisor_nome TEXT,
      gerente_nome TEXT,
      numnota TEXT,
      data_devolucao TEXT,
      data_devolucao_br TEXT,
      codcli TEXT,
      nomecli TEXT,
      cnpj TEXT,
      vl_devolvido_total REAL,
      qtd_itens INTEGER
    );

    CREATE TABLE IF NOT EXISTS devolucoes_itens (
      chave_item TEXT PRIMARY KEY,
      filial_codigo TEXT,
      rca_id INTEGER,
      rca_nome TEXT,
      supervisor_nome TEXT,
      numnota TEXT,
      data_devolucao TEXT,
      data_devolucao_br TEXT,
      codcli TEXT,
      nomecli TEXT,
      cnpj TEXT,
      codprod TEXT,
      descricao TEXT,
      qtdev REAL,
      vl_devolvido REAL,
      motivo TEXT
    );

    CREATE TABLE IF NOT EXISTS cadastros_linkup (
      id INTEGER PRIMARY KEY,
      tipo TEXT,
      status TEXT,
      em_aberto INTEGER,
      nome_cliente TEXT,
      cpf_cnpj TEXT,
      cidade TEXT,
      vendedor_linkup TEXT,
      vendedor_email TEXT,
      rca_id TEXT,
      rca_nome TEXT,
      filial_codigo TEXT,
      supervisor_nome TEXT,
      gerente_nome TEXT,
      responsavel_linkup TEXT,
      responsavel_email TEXT,
      criado_em TEXT,
      criado_em_data TEXT,
      atualizado_em TEXT,
      atualizado_em_data TEXT,
      tempo_horas REAL,
      tempo_dias REAL,
      data_finalizacao_calculada TEXT,
      data_finalizacao_br TEXT
    );
  `);
}

// 1. Extração de Cadastros LinkUp
async function extrairLinkUp() {
  console.log('\n======================================================');
  console.log('📡 1. EXTRAINDO HISTÓRICO COMPLETO DO LINKUP...');
  console.log('======================================================');

  // Construir mapa de correspondência de vendedores da hierarquia
  const repsList = [];
  HIERARQUIA.forEach(f => {
    f.supervisores.forEach(s => {
      s.rcas.forEach(r => {
        repsList.push({
          filial_codigo: f.filial,
          filial_key: f.codigoFilial,
          gerente_nome: f.gerentes,
          supervisor_id: s.supervisorId,
          supervisor_nome: s.supervisorNome,
          rca_id: String(r.rcaId),
          rca_nome: r.rcaNome,
          rca_norm: r.rcaNome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^(clt|pj)\s*-\s*/, '').trim()
        });
      });
    });
  });

  const url = 'https://ceven.drivetriunfante-locomotiva.com.br/api/linkup/solicitacoes?dias=365&limite=20000';
  const res = await fetchJson(url);
  const solicitacoes = res?.solicitacoes || [];
  console.log(`📥 Total de solicitações retornadas pela API LinkUp: ${solicitacoes.length}`);

  const insertLinkup = db.prepare(`
    INSERT OR REPLACE INTO cadastros_linkup (
      id, tipo, status, em_aberto, nome_cliente, cpf_cnpj, cidade,
      vendedor_linkup, vendedor_email, rca_id, rca_nome, filial_codigo,
      supervisor_nome, gerente_nome, responsavel_linkup, responsavel_email,
      criado_em, criado_em_data, atualizado_em, atualizado_em_data,
      tempo_horas, tempo_dias, data_finalizacao_calculada, data_finalizacao_br
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  const rowsToInsert = [];

  for (const s of solicitacoes) {
    const rawCnpj = (s.cpf_cnpj || '').trim();
    const vLink = (s.vendedor || '').replace(/_/g, ' ').trim();
    const vEmail = (s.vendedor_email || '').trim().toLowerCase();
    const respEmail = (s.responsavel_email || '').trim().toLowerCase();
    const vNorm = vLink.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    // Cruzar com hierarquia
    let matchedRep = repsList.find(r => {
      if (r.rca_norm === vNorm) return true;
      const partes = vNorm.split(/\s+/).filter(p => p.length > 2);
      if (partes.length >= 2 && partes.every(p => r.rca_norm.includes(p))) return true;
      return false;
    });

    let filial = matchedRep ? matchedRep.filial_codigo : null;
    let rcaId = matchedRep ? matchedRep.rca_id : '';
    let rcaNome = matchedRep ? matchedRep.rca_nome : vLink;
    let supNome = matchedRep ? matchedRep.supervisor_nome : '';
    let gerNome = matchedRep ? matchedRep.gerente_nome : '';

    // Se não encontrou por nome, tentar identificar a filial pelo e-mail
    if (!filial) {
      if (respEmail.startsWith('tsj') || vEmail.includes('tsj')) filial = 'TSJ';
      else if (respEmail.startsWith('tcg') || vEmail.includes('tcg')) filial = 'TCG';
      else if (respEmail.startsWith('tcv') || vEmail.includes('tcv')) filial = 'TCV';
      else if (respEmail.startsWith('tca') || vEmail.includes('tca')) filial = 'TCA';
      else if (respEmail.startsWith('tbe') || vEmail.includes('tbe')) filial = 'TBE';
      else if (respEmail.startsWith('tpa') || vEmail.includes('tpa')) filial = 'TPA';
      else if (respEmail.startsWith('tph') || vEmail.includes('tph')) filial = 'TPH';
      else if (respEmail.startsWith('tbl') || vEmail.includes('tbl')) filial = 'TBL';
      else if (respEmail.startsWith('mcd') || vEmail.includes('mcd')) filial = 'MCD';
      else if (respEmail.startsWith('api') || vEmail.includes('api')) filial = 'API';
      else if (respEmail.startsWith('abc') || vEmail.includes('abc')) filial = 'ABC';
    }

    // Tratamento de datas
    const dtCriado = parseDateTimeBR(s.criado_em);
    const dtAtualizado = parseDateTimeBR(s.atualizado_em);
    const horas = typeof s.tempo_horas === 'number' ? s.tempo_horas : parseFloat(s.tempo_horas) || 0;
    const dias = parseFloat((horas / 24).toFixed(1));

    // Cálculo da data de finalização
    // Regra solicitada: se criação foi dia 01 e finalizado com 4d, então finalizou dia 05
    let dataFinCalculada = '';
    let dataFinBR = '';
    if (dtCriado && horas > 0) {
      const finMs = dtCriado.timestamp + Math.round(horas * 3600 * 1000);
      const finDate = new Date(finMs);
      const fy = finDate.getUTCFullYear();
      const fmo = String(finDate.getUTCMonth() + 1).padStart(2, '0');
      const fd = String(finDate.getUTCDate()).padStart(2, '0');
      const fh = String(finDate.getUTCHours()).padStart(2, '0');
      const fmi = String(finDate.getUTCMinutes()).padStart(2, '0');

      dataFinCalculada = `${fy}-${fmo}-${fd} ${fh}:${fmi}:00`;
      dataFinBR = `${fd}/${fmo}/${fy} ${fh}:${fmi}`;
    } else if (dtAtualizado && s.status === 'Finalizado') {
      dataFinCalculada = dtAtualizado.iso;
      dataFinBR = dtAtualizado.br;
    }

    rowsToInsert.push([
      s.id,
      s.tipo || 'Novo Cliente',
      s.status || 'Pendente',
      s.em_aberto ? 1 : 0,
      s.nome_cliente || '',
      rawCnpj,
      s.cidade || '',
      vLink,
      vEmail,
      rcaId,
      rcaNome,
      filial || 'A DEFINIR',
      supNome,
      gerNome,
      s.responsavel || '',
      s.responsavel_email || '',
      s.criado_em || '',
      dtCriado ? dtCriado.dataIso : '',
      s.atualizado_em || '',
      dtAtualizado ? dtAtualizado.dataIso : '',
      horas,
      dias,
      dataFinCalculada,
      dataFinBR
    ]);
  }

  const insertMany = db.transaction((rows) => {
    for (const r of rows) insertLinkup.run(...r);
  });

  insertMany(rowsToInsert);
  console.log(`✅ ${rowsToInsert.length} solicitações inseridas no SQLite.`);

  return rowsToInsert;
}

// 2. Extração de Devoluções de Todas as 11 Filiais
async function extrairDevolucoes() {
  console.log('\n======================================================');
  console.log('📦 2. EXTRAINDO DEVOLUÇÕES DE TODAS AS 11 FILIAIS...');
  console.log('======================================================');

  const todosRcas = [];
  HIERARQUIA.forEach(f => {
    f.supervisores.forEach(s => {
      s.rcas.forEach(r => {
        todosRcas.push({
          filial_codigo: f.filial,
          filial_key: f.codigoFilial,
          gerente_nome: f.gerentes,
          supervisor_id: s.supervisorId,
          supervisor_nome: s.supervisorNome,
          rca_id: r.rcaId,
          rca_nome: r.rcaNome
        });
      });
    });
  });

  console.log(`Total de ${todosRcas.length} RCAs para consultar em 11 filiais.`);

  const insertNota = db.prepare(`
    INSERT OR REPLACE INTO devolucoes_notas (
      chave_nota, filial_codigo, filial_key, rca_id, rca_nome,
      supervisor_id, supervisor_nome, gerente_nome, numnota,
      data_devolucao, data_devolucao_br, codcli, nomecli, cnpj,
      vl_devolvido_total, qtd_itens
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?
    )
  `);

  const insertItem = db.prepare(`
    INSERT OR REPLACE INTO devolucoes_itens (
      chave_item, filial_codigo, rca_id, rca_nome, supervisor_nome,
      numnota, data_devolucao, data_devolucao_br, codcli, nomecli,
      cnpj, codprod, descricao, qtdev, vl_devolvido, motivo
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  let totalNotasEncontradas = 0;
  let totalItensEncontrados = 0;
  let totalValorDevolvido = 0;

  const notasParaGravar = [];
  const itensParaGravar = [];

  // Processar em lotes de 15 RCAs simultâneos
  const BATCH_SIZE = 15;
  for (let i = 0; i < todosRcas.length; i += BATCH_SIZE) {
    const batch = todosRcas.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\rProcessando RCAs ${i + 1} a ${Math.min(i + BATCH_SIZE, todosRcas.length)} de ${todosRcas.length}...`);

    await Promise.all(batch.map(async (rca) => {
      const devUrl = `https://ceven.drivetriunfante-locomotiva.com.br/api/rca/devolucoes?filial=${rca.filial_key}&id=${rca.rca_id}`;
      const devList = await fetchJson(devUrl);

      if (Array.isArray(devList) && devList.length > 0) {
        for (const d of devList) {
          const numnota = String(d.numnota || d.nota || '').trim();
          if (!numnota) return;

          const vlNota = parseMoney(d.vl_devolvido || d.valor || d.total);
          const dtParsed = parseDateBR(d.data || d.data_nota);
          const codcli = String(d.codcli || d.id_cliente || '');
          const nomecli = String(d.nomecli || d.cliente || '');
          const cnpj = String(d.cnpj || '');

          const chaveNota = `${rca.filial_codigo}_${rca.rca_id}_${numnota}`;

          // Buscar os itens da nota fiscal devolvida
          const itensUrl = `https://ceven.drivetriunfante-locomotiva.com.br/api/rca/devolucoes/${numnota}?filial=${rca.filial_key}&id=${rca.rca_id}`;
          const itensList = await fetchJson(itensUrl);

          let qtdItensNaNota = 0;

          if (Array.isArray(itensList) && itensList.length > 0) {
            qtdItensNaNota = itensList.length;
            itensList.forEach((it, idx) => {
              const codprod = String(it.codprod || '').trim();
              const desc = String(it.descricao || '').trim();
              const qtdev = parseFloat(it.qtdev) || 0;
              const vlItem = parseMoney(it.vl_devolvido || it.valor);
              const motivo = String(it.motivo || 'NÃO INFORMADO').trim();

              const chaveItem = `${chaveNota}_${codprod}_${idx}`;

              itensParaGravar.push([
                chaveItem,
                rca.filial_codigo,
                rca.rca_id,
                rca.rca_nome,
                rca.supervisor_nome,
                numnota,
                dtParsed ? dtParsed.iso : '',
                dtParsed ? dtParsed.br : '',
                codcli,
                nomecli,
                cnpj,
                codprod,
                desc,
                qtdev,
                vlItem,
                motivo
              ]);

              totalItensEncontrados++;
            });
          }

          notasParaGravar.push([
            chaveNota,
            rca.filial_codigo,
            rca.filial_key,
            rca.rca_id,
            rca.rca_nome,
            rca.supervisor_id,
            rca.supervisor_nome,
            rca.gerente_nome,
            numnota,
            dtParsed ? dtParsed.iso : '',
            dtParsed ? dtParsed.br : '',
            codcli,
            nomecli,
            cnpj,
            vlNota,
            qtdItensNaNota
          ]);

          totalNotasEncontradas++;
          totalValorDevolvido += vlNota;
        }
      }
    }));
  }

  console.log(`\n\nGravando ${notasParaGravar.length} notas e ${itensParaGravar.length} itens no SQLite...`);

  const insertNotasTx = db.transaction((rows) => {
    for (const r of rows) insertNota.run(...r);
  });
  insertNotasTx(notasParaGravar);

  const insertItensTx = db.transaction((rows) => {
    for (const r of rows) insertItem.run(...r);
  });
  insertItensTx(itensParaGravar);

  console.log(`✅ Extração de devoluções concluída:`);
  console.log(`   - Notas Fiscais Devolvidas: ${totalNotasEncontradas}`);
  console.log(`   - Itens Devolvidos: ${totalItensEncontrados}`);
  console.log(`   - Valor Total Devolvido: R$ ${totalValorDevolvido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

// 3. Geração do Relatório Excel Dedicado
function gerarPlanilhaExcel() {
  console.log('\n======================================================');
  console.log('📊 3. GERANDO EXCEL AUDITORIA_DEVOLUCOES_E_CADASTROS.XLSX...');
  console.log('======================================================');

  const wb = XLSX.utils.book_new();

  // ABA 1: Devoluções Itens Detalhados
  const itens = db.prepare(`
    SELECT 
      filial_codigo AS "Filial",
      rca_id AS "Cód_RCA",
      rca_nome AS "Nome_RCA",
      supervisor_nome AS "Supervisor",
      numnota AS "Número_NF",
      data_devolucao_br AS "Data_Devolução",
      codcli AS "Cód_Cliente",
      nomecli AS "Razão_Social_Cliente",
      cnpj AS "CNPJ",
      codprod AS "Cód_Produto",
      descricao AS "Descrição_Produto",
      qtdev AS "Quantidade_Devolvida",
      vl_devolvido AS "Valor_Devolvido_R$",
      motivo AS "Motivo_Devolução"
    FROM devolucoes_itens
    ORDER BY filial_codigo, rca_id, numnota, vl_devolvido DESC
  `).all();

  const wsItens = XLSX.utils.json_to_sheet(itens);
  XLSX.utils.book_append_sheet(wb, wsItens, 'Devoluções_Itens');

  // ABA 2: Devoluções Resumo por Nota Fiscal
  const notas = db.prepare(`
    SELECT 
      filial_codigo AS "Filial",
      gerente_nome AS "Gerente",
      supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA",
      rca_nome AS "Nome_RCA",
      numnota AS "Número_NF",
      data_devolucao_br AS "Data_Devolução",
      codcli AS "Cód_Cliente",
      nomecli AS "Razão_Social_Cliente",
      cnpj AS "CNPJ",
      qtd_itens AS "Qtd_Itens_Devolvidos",
      vl_devolvido_total AS "Valor_Total_Nota_R$"
    FROM devolucoes_notas
    ORDER BY filial_codigo, vl_devolvido_total DESC
  `).all();

  const wsNotas = XLSX.utils.json_to_sheet(notas);
  XLSX.utils.book_append_sheet(wb, wsNotas, 'Devoluções_Notas');

  // ABA 3: Consolidação por Motivo de Devolução
  const motivos = db.prepare(`
    SELECT 
      filial_codigo AS "Filial",
      motivo AS "Motivo_Devolução",
      COUNT(*) AS "Qtd_Ocorrências",
      SUM(qtdev) AS "Qtd_Peças_Devolvidas",
      ROUND(SUM(vl_devolvido), 2) AS "Total_Devolvido_R$"
    FROM devolucoes_itens
    GROUP BY filial_codigo, motivo
    ORDER BY filial_codigo, "Total_Devolvido_R$" DESC
  `).all();

  const wsMotivos = XLSX.utils.json_to_sheet(motivos);
  XLSX.utils.book_append_sheet(wb, wsMotivos, 'Devoluções_Por_Motivo');

  // ABA 4: Novos Cadastros LinkUp (Filtro 'Novo Cliente')
  const novosCadastros = db.prepare(`
    SELECT 
      id AS "ID_LinkUp",
      filial_codigo AS "Filial",
      gerente_nome AS "Gerente",
      supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA",
      rca_nome AS "Vendedor_RCA",
      nome_cliente AS "Razão_Social_Cliente",
      cpf_cnpj AS "CNPJ_CPF",
      cidade AS "Cidade",
      status AS "Status_Atual",
      CASE WHEN em_aberto = 1 THEN 'SIM' ELSE 'NAO' END AS "Em_Aberto?",
      responsavel_linkup AS "Responsável_Atual",
      criado_em AS "Data_Criação",
      tempo_dias AS "Idade_Decorridos_Dias",
      tempo_horas AS "Tempo_Atendimento_Horas",
      data_finalizacao_br AS "Data_Finalização_Calculada",
      atualizado_em AS "Data_Última_Atualização"
    FROM cadastros_linkup
    WHERE tipo = 'Novo Cliente'
    ORDER BY id DESC
  `).all();

  const wsNovos = XLSX.utils.json_to_sheet(novosCadastros);
  XLSX.utils.book_append_sheet(wb, wsNovos, 'Novos_Cadastros_LinkUp');

  // ABA 5: Todas as Solicitações LinkUp (Histórico Completo)
  const todasSolicitacoes = db.prepare(`
    SELECT 
      id AS "ID_LinkUp",
      tipo AS "Tipo_Solicitação",
      filial_codigo AS "Filial",
      vendedor_linkup AS "Solicitante",
      nome_cliente AS "Cliente",
      cpf_cnpj AS "CNPJ_CPF",
      cidade AS "Cidade",
      status AS "Status",
      responsavel_linkup AS "Responsável",
      criado_em AS "Data_Criação",
      tempo_dias AS "Dias_Decorridos",
      data_finalizacao_br AS "Data_Finalização_Calculada"
    FROM cadastros_linkup
    ORDER BY id DESC
  `).all();

  const wsTodas = XLSX.utils.json_to_sheet(todasSolicitacoes);
  XLSX.utils.book_append_sheet(wb, wsTodas, 'Todas_Solicitações_LinkUp');

  // ABA 6: KPIs de Cadastros por RCA (Ranking e Produtividade)
  const kpisRca = db.prepare(`
    SELECT 
      filial_codigo AS "Filial",
      vendedor_linkup AS "Vendedor_LinkUp",
      rca_nome AS "Nome_RCA_Oficial",
      COUNT(*) AS "Total_Novos_Cadastros",
      SUM(CASE WHEN status = 'Finalizado' THEN 1 ELSE 0 END) AS "Cadastros_Finalizados",
      SUM(CASE WHEN em_aberto = 1 THEN 1 ELSE 0 END) AS "Cadastros_Em_Aberto",
      ROUND(AVG(tempo_dias), 1) AS "Tempo_Médio_Dias",
      ROUND(CAST(SUM(CASE WHEN status = 'Finalizado' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) AS "Taxa_Aprovação_Pct"
    FROM cadastros_linkup
    WHERE tipo = 'Novo Cliente' AND filial_codigo != 'A DEFINIR'
    GROUP BY filial_codigo, vendedor_linkup
    ORDER BY "Total_Novos_Cadastros" DESC
  `).all();

  const wsKpisRca = XLSX.utils.json_to_sheet(kpisRca);
  XLSX.utils.book_append_sheet(wb, wsKpisRca, 'KPIs_Cadastros_Por_RCA');

  // ABA 7: KPIs de Cadastros por Filial
  const kpisFilial = db.prepare(`
    SELECT 
      filial_codigo AS "Filial",
      COUNT(*) AS "Total_Cadastros_Solicitados",
      SUM(CASE WHEN status = 'Finalizado' THEN 1 ELSE 0 END) AS "Cadastros_Finalizados",
      SUM(CASE WHEN em_aberto = 1 THEN 1 ELSE 0 END) AS "Cadastros_Em_Aberto",
      ROUND(AVG(tempo_dias), 1) AS "Tempo_Médio_Conclusão_Dias",
      ROUND(CAST(SUM(CASE WHEN status = 'Finalizado' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) AS "Taxa_Conclusão_Pct"
    FROM cadastros_linkup
    WHERE tipo = 'Novo Cliente' AND filial_codigo != 'A DEFINIR'
    GROUP BY filial_codigo
    ORDER BY "Total_Cadastros_Solicitados" DESC
  `).all();

  const wsKpisFilial = XLSX.utils.json_to_sheet(kpisFilial);
  XLSX.utils.book_append_sheet(wb, wsKpisFilial, 'KPIs_Cadastros_Por_Filial');

  const outExcel = path.join(__dirname, 'AUDITORIA_DEVOLUCOES_E_CADASTROS.xlsx');
  try {
    XLSX.writeFile(wb, outExcel);
    console.log(`✅ Planilha Excel gerada com sucesso em: ${outExcel}`);
  } catch(e) {
    const fallbackExcel = path.join(__dirname, 'AUDITORIA_DEVOLUCOES_E_CADASTROS_NOVA.xlsx');
    XLSX.writeFile(wb, fallbackExcel);
    console.log(`⚠️ Arquivo original ocupado. Gravado em: ${fallbackExcel}`);
  }
}

async function main() {
  console.log('🚀 INICIANDO PIPELINE DE DEVOLUÇÕES E NOVOS CADASTROS (11 FILIAIS)');
  initDatabase();
  await extrairLinkUp();
  await extrairDevolucoes();
  gerarPlanilhaExcel();
  console.log('\n🎯 PROCESSO COMPLETO FINALIZADO COM SUCESSO!');
}

main().catch(console.error);
