const https = require('https');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

const DB_PATH = path.join(__dirname, 'pedidos_historico_ceven.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000');

const HIERARQUIA = JSON.parse(fs.readFileSync(path.join(__dirname, 'hierarquia_completa_ceven.json'), 'utf8'));
const CEVEN_BASE = 'https://ceven.drivetriunfante-locomotiva.com.br';

// ====================================================================
// HELPERS
// ====================================================================
function fetchJsonUmaVez(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': `${CEVEN_BASE}/dashboard` },
      timeout: 15000,
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// Trava de segurança independente do timeout interno do https.get — alguns endpoints do
// CEVEN (roteiro-mes/roteiro-hoje de RCAs específicos) já demonstraram ficar pendurados
// sem nunca disparar o evento 'timeout' nativo. Isso garante que NENHUMA chamada trava o loop.
function comTimeoutForcado(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

// Esse endpoint responde em <1s no caso normal (testado à exaustão) — não é como o
// prospeccao-roteiro que legitimamente demora minutos. Se travar, é anomalia pontual de
// rede, então o timeout pode (e deve) ser curto pra não desperdiçar tempo à toa.
async function fetchJson(url, retries = 2) {
  for (let n = retries; n >= 1; n--) {
    const resultado = await comTimeoutForcado(fetchJsonUmaVez(url), 6000);
    if (resultado !== null) return resultado;
    if (n > 1) await new Promise(r => setTimeout(r, 300));
  }
  return null;
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

// ====================================================================
// ETAPA 0: EVOLUIR SCHEMA DO BANCO
// ====================================================================
function initSchema() {
  console.log('🔧 Evoluindo schema do banco...');

  // Ampliar clientes_roteiro com dados completos
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes_roteiro (
      id_cliente TEXT,
      cnpj TEXT,
      nome_cliente TEXT,
      razao_social TEXT,
      rca_id INTEGER,
      filial_codigo TEXT,
      status_visita TEXT,
      PRIMARY KEY (id_cliente, filial_codigo, rca_id)
    );

    CREATE TABLE IF NOT EXISTS clientes_completo (
      id_cliente    TEXT,
      filial_codigo TEXT,
      filial_sigla  TEXT,
      cnpj          TEXT,
      nome_cliente  TEXT,
      razao_social  TEXT,
      endereco      TEXT,
      numero        TEXT,
      complemento   TEXT,
      bairro        TEXT,
      cidade        TEXT,
      estado        TEXT,
      cep           TEXT,
      telefone      TEXT,
      latitude      REAL,
      longitude     REAL,
      rca_id        INTEGER,
      rca_nome      TEXT,
      supervisor_nome TEXT,
      gerente_nome  TEXT,
      dias_sem_compra INTEGER,
      status_cliente  TEXT,
      ultimo_pedido   TEXT,
      teve_ret        INTEGER DEFAULT 0,
      PRIMARY KEY (id_cliente, filial_codigo)
    );

    CREATE TABLE IF NOT EXISTS pedidos_historico (
      chave         TEXT PRIMARY KEY,
      num_pedido    TEXT,
      filial_codigo TEXT,
      filial_sigla  TEXT,
      id_cliente    TEXT,
      cnpj_cliente  TEXT,
      nome_cliente  TEXT,
      rca_id        INTEGER,
      rca_nome      TEXT,
      supervisor_nome TEXT,
      gerente_nome  TEXT,
      data_pedido   TEXT,
      data_pedido_br TEXT,
      status_pedido TEXT,
      categoria_corte TEXT,
      vl_faturado   REAL,
      vl_cortado    REAL,
      total_clube   REAL,
      qtd_skus      INTEGER,
      qtd_cortados  INTEGER
    );

    CREATE TABLE IF NOT EXISTS pedidos_historico_itens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chave_pedido  TEXT,
      num_pedido    TEXT,
      filial_codigo TEXT,
      id_cliente    TEXT,
      tipo_registro TEXT,
      codprod       TEXT,
      descricao     TEXT,
      quantidade    REAL,
      valor_total   REAL
    );

    CREATE INDEX IF NOT EXISTS idx_ph_filial    ON pedidos_historico (filial_codigo);
    CREATE INDEX IF NOT EXISTS idx_ph_data      ON pedidos_historico (data_pedido);
    CREATE INDEX IF NOT EXISTS idx_ph_cliente   ON pedidos_historico (id_cliente);
    CREATE INDEX IF NOT EXISTS idx_ph_rca       ON pedidos_historico (rca_id);
    CREATE INDEX IF NOT EXISTS idx_phi_pedido   ON pedidos_historico_itens (chave_pedido);
    CREATE INDEX IF NOT EXISTS idx_cc_filial    ON clientes_completo (filial_codigo);
    CREATE INDEX IF NOT EXISTS idx_cc_cidade    ON clientes_completo (cidade, estado);
  `);

  console.log('✅ Schema atualizado.');
}

// ====================================================================
// ETAPA 1: COLETAR ROTEIROS + DADOS COMPLETOS DOS CLIENTES (11 FILIAIS)
// ====================================================================
async function coletarClientes() {
  console.log('\n' + '='.repeat(70));
  console.log('👥 ETAPA 1: COLETANDO CLIENTES COMPLETOS DE TODAS AS 11 FILIAIS...');
  console.log('='.repeat(70));

  const insertCliente = db.prepare(`
    INSERT OR REPLACE INTO clientes_completo (
      id_cliente, filial_codigo, filial_sigla, cnpj, nome_cliente, razao_social,
      endereco, numero, complemento, bairro, cidade, estado, cep, telefone,
      latitude, longitude, rca_id, rca_nome, supervisor_nome, gerente_nome,
      dias_sem_compra, status_cliente, ultimo_pedido, teve_ret
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `);

  const insertClienteRoteiro = db.prepare(`
    INSERT OR REPLACE INTO clientes_roteiro (id_cliente, cnpj, nome_cliente, razao_social, rca_id, filial_codigo, status_visita)
    VALUES (?,?,?,?,?,?,?)
  `);

  let totalClientes = 0;

  for (const filial of HIERARQUIA) {
    const filialKey  = filial.codigoFilial;
    const filialSigla = normalizarFilial(filial.filial);
    const gerNome = Array.isArray(filial.gerentes) ? filial.gerentes.join(', ') : (filial.gerentes || '');

    console.log(`\n🏢 ${filialSigla} [${filialKey}] — Gerente: ${gerNome}`);

    const clientesMap = new Map();

    for (const sup of filial.supervisores) {
      for (const rca of sup.rcas) {
        if (!rca.rcaId) continue;

        // Roteiro Mês (clientes da carteira)
        const roteiroMes = await fetchJson(`${CEVEN_BASE}/api/rca/roteiro-mes?filial=${filialKey}&id=${rca.rcaId}`);
        if (Array.isArray(roteiroMes)) {
          for (const c of roteiroMes) {
            const cid = String(c.id_cliente || c.id || c.codcli || '').trim();
            if (!cid || cid === '0') continue;
            if (!clientesMap.has(cid)) {
              clientesMap.set(cid, {
                id_cliente: cid,
                filial_codigo: filialKey.toUpperCase(),
                filial_sigla: filialSigla,
                cnpj: c.cnpj || '',
                nome_cliente: c.nome_cliente || c.fantasia || c.FANTASIA || '',
                razao_social: c.razao_social || c.razaosocial || '',
                endereco: c.endereco || c.logradouro || '',
                numero: c.numero || '',
                complemento: c.complemento || '',
                bairro: c.bairro || '',
                cidade: c.cidade || c.municipio || '',
                estado: c.estado || c.uf || '',
                cep: c.cep || '',
                telefone: c.telefone || c.fone || '',
                latitude: parseFloat(c.latitude || c.lat) || 0,
                longitude: parseFloat(c.longitude || c.lng || c.lon) || 0,
                rca_id: rca.rcaId,
                rca_nome: rca.rcaNome,
                supervisor_nome: sup.supervisorNome,
                gerente_nome: gerNome,
                dias_sem_compra: parseInt(c.dias_sem_compra) || 0,
                status_cliente: c.status || c.status_visita || '',
                ultimo_pedido: c.data_ultimo_pedido || c.ultima_compra || '',
                teve_ret: c.tem_ret || c.teve_ret ? 1 : 0
              });
            }
          }
        }

        // Roteiro Hoje (dados de status do dia)
        const roteiroHoje = await fetchJson(`${CEVEN_BASE}/api/rca/roteiro-hoje?filial=${filialKey}&id=${rca.rcaId}`);
        if (Array.isArray(roteiroHoje)) {
          for (const c of roteiroHoje) {
            const cid = String(c.id_cliente || c.id || c.codcli || '').trim();
            if (!cid || cid === '0') continue;
            const existing = clientesMap.get(cid);
            if (existing) {
              // Enriquecer com dados mais completos do roteiro de hoje
              if (c.latitude && parseFloat(c.latitude)) existing.latitude = parseFloat(c.latitude);
              if (c.longitude && parseFloat(c.longitude)) existing.longitude = parseFloat(c.longitude);
              if (c.endereco) existing.endereco = c.endereco;
              if (c.cidade) existing.cidade = c.cidade;
              if (c.estado || c.uf) existing.estado = c.estado || c.uf;
            }
          }
        }
      }
    }

    process.stdout.write(`   ${filialSigla}: ${clientesMap.size} clientes únicos encontrados. Salvando...`);

    const clientesList = Array.from(clientesMap.values());
    db.transaction((rows) => {
      for (const r of rows) {
        insertCliente.run(
          r.id_cliente, r.filial_codigo, r.filial_sigla, r.cnpj, r.nome_cliente,
          r.razao_social, r.endereco, r.numero, r.complemento, r.bairro,
          r.cidade, r.estado, r.cep, r.telefone, r.latitude, r.longitude,
          r.rca_id, r.rca_nome, r.supervisor_nome, r.gerente_nome,
          r.dias_sem_compra, r.status_cliente, r.ultimo_pedido, r.teve_ret
        );
        insertClienteRoteiro.run(
          r.id_cliente, r.cnpj, r.nome_cliente, r.razao_social,
          r.rca_id, r.filial_codigo, r.status_cliente
        );
      }
    })(clientesList);

    console.log(` ✅`);
    totalClientes += clientesMap.size;
  }

  console.log(`\n✅ Total de ${totalClientes.toLocaleString()} clientes coletados das 11 filiais.`);
}

// ====================================================================
// ETAPA 2: HISTÓRICO COMPLETO DE PEDIDOS (11 FILIAIS — todos os clientes)
// ====================================================================
async function extrairHistoricoPedidos() {
  console.log('\n' + '='.repeat(70));
  console.log('📦 ETAPA 2: EXTRAINDO HISTÓRICO COMPLETO DE PEDIDOS (11 FILIAIS)...');
  console.log('='.repeat(70));

  const insertPedido = db.prepare(`
    INSERT OR REPLACE INTO pedidos_historico (
      chave, num_pedido, filial_codigo, filial_sigla,
      id_cliente, cnpj_cliente, nome_cliente,
      rca_id, rca_nome, supervisor_nome, gerente_nome,
      data_pedido, data_pedido_br, status_pedido, categoria_corte,
      vl_faturado, vl_cortado, total_clube, qtd_skus, qtd_cortados
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO pedidos_historico_itens (
      chave_pedido, num_pedido, filial_codigo, id_cliente,
      tipo_registro, codprod, descricao, quantidade, valor_total
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `);
  const deleteItensDoPedido = db.prepare(`DELETE FROM pedidos_historico_itens WHERE chave_pedido = ?`);

  // Pegar todos os clientes do banco
  const todosClientes = db.prepare(`
    SELECT id_cliente, filial_codigo, filial_sigla, cnpj, nome_cliente,
           rca_id, rca_nome, supervisor_nome, gerente_nome
    FROM clientes_completo
    ORDER BY filial_codigo, rca_id
  `).all();

  console.log(`Total de ${todosClientes.length.toLocaleString()} clientes para buscar histórico.`);

  // Mapear filial_codigo -> filial_key (para a URL)
  const filialKeyMap = {};
  HIERARQUIA.forEach(f => {
    const sigla = normalizarFilial(f.filial);
    filialKeyMap[sigla] = f.codigoFilial;
    filialKeyMap[f.codigoFilial.toUpperCase()] = f.codigoFilial;
  });

  // Reprocessa TODOS os clientes sempre (não só os novos) — o INSERT OR REPLACE
  // pela chave (filial+cliente+num_pedido) garante que isso é seguro e idempotente,
  // e é o que permite pegar pedidos novos e status que mudaram (ex: bloqueado -> liberado -> faturado).
  const paraProcessar = todosClientes;
  console.log(`Clientes a processar agora: ${paraProcessar.length.toLocaleString()}`);

  let totalPedidos = 0, totalItens = 0, totalCortes = 0, totalValor = 0;
  let erros = 0;

  const CONCURRENCY = 16;
  let idx = 0;

  function parseDateBR(str) {
    if (!str) return { iso: '', br: '' };
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const p = str.slice(0, 10).split('-');
      return { iso: str.slice(0, 10), br: `${p[2]}/${p[1]}/${p[0]}` };
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
      const p = str.slice(0, 10).split('/');
      return { iso: `${p[2]}-${p[1]}-${p[0]}`, br: str.slice(0, 10) };
    }
    return { iso: '', br: '' };
  }

  async function worker(workerId) {
    while (idx < paraProcessar.length) {
      const i = idx++;
      const cli = paraProcessar[i];

      const filialKey = filialKeyMap[cli.filial_sigla] || filialKeyMap[cli.filial_codigo] || cli.filial_codigo.toLowerCase();
      const url = `${CEVEN_BASE}/api/rca/historico-cliente/${cli.id_cliente}?filial=${filialKey}`;

      const hist = await fetchJson(url);

      if (hist && Array.isArray(hist.ultimas_visitas) && hist.ultimas_visitas.length > 0) {
        try {
          db.transaction(() => {
            for (const v of hist.ultimas_visitas) {
              const numPed = String(v.num_pedido || v.numpedido || '').trim();
              if (!numPed) continue;

              const dtParsed = parseDateBR(v.data_visita || v.data_pedido || v.data || '');
              const chave = `${cli.filial_codigo}_${cli.id_cliente}_${numPed}`;
              const vlFat = parseFloat(v.vl_faturado_winthor || v.vl_faturado || 0) || 0;
              const vlCort = parseFloat(v.vl_perdido_logistica || v.vl_cortado || 0) || 0;
              const skus = Array.isArray(v.skus) ? v.skus : (Array.isArray(v.skus_winthor) ? v.skus_winthor : []);
              const cortes = Array.isArray(v.itens_cortados) ? v.itens_cortados : [];

              insertPedido.run(
                chave, numPed, cli.filial_codigo, cli.filial_sigla,
                cli.id_cliente, cli.cnpj, cli.nome_cliente,
                cli.rca_id, cli.rca_nome, cli.supervisor_nome, cli.gerente_nome,
                dtParsed.iso, dtParsed.br,
                v.status_pedido || v.status || 'FATURADO',
                v.categoria_corte || 'SEM CORTE',
                vlFat, vlCort,
                parseFloat(v.total_clube) || vlFat,
                skus.length, cortes.length
              );
              deleteItensDoPedido.run(chave);

              totalPedidos++;
              totalValor += vlFat;

              for (const s of skus) {
                insertItem.run(
                  chave, numPed, cli.filial_codigo, cli.id_cliente,
                  'VENDA',
                  String(s.codigo || s.codprod || ''), s.descricao || '',
                  parseFloat(s.quantidade || s.qt_vendida || 1) || 1,
                  parseFloat(s.total || s.vl_faturado || 0) || 0
                );
                totalItens++;
              }

              for (const c of cortes) {
                insertItem.run(
                  chave, numPed, cli.filial_codigo, cli.id_cliente,
                  'CORTE',
                  String(c.codprod || c.codigo || ''), c.descricao || '',
                  parseFloat(c.qtdev || c.quantidade_cortada || c.quantidade || 1) || 1,
                  parseFloat(c.vl_devolvido || c.valor_cortado || 0) || 0
                );
                totalCortes++;
              }
            }
          })();
        } catch(e) { erros++; }
      }

      if ((i + 1) % 200 === 0 || i + 1 === paraProcessar.length) {
        const pct = (((i + 1) / paraProcessar.length) * 100).toFixed(1);
        process.stdout.write(`\r  Progresso: ${(i+1).toLocaleString()}/${paraProcessar.length.toLocaleString()} (${pct}%) | Pedidos: ${totalPedidos.toLocaleString()} | Itens: ${totalItens.toLocaleString()} | Erros: ${erros}`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);

  console.log(`\n\n✅ Histórico extraído:`);
  console.log(`   Pedidos:    ${totalPedidos.toLocaleString()}`);
  console.log(`   Itens:      ${totalItens.toLocaleString()}`);
  console.log(`   Cortes:     ${totalCortes.toLocaleString()}`);
  console.log(`   Faturado:   R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Erros:      ${erros}`);
}

// ====================================================================
// ETAPA 3: GERAR PLANILHA COMPLETA AUDITORIA_COMPLETA_11_FILIAIS.xlsx
// ====================================================================
function gerarPlanilhaCompleta() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 ETAPA 3: GERANDO PLANILHA COMPLETA...');
  console.log('='.repeat(70));

  const wb = XLSX.utils.book_new();

  // ABA 1: Histórico de Pedidos
  console.log('  Gerando aba: Histórico_Pedidos...');
  const pedidos = db.prepare(`
    SELECT 
      filial_sigla AS "Filial", gerente_nome AS "Gerente", supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA", rca_nome AS "Nome_RCA",
      id_cliente AS "Cód_Cliente", nome_cliente AS "Nome_Cliente", cnpj_cliente AS "CNPJ",
      num_pedido AS "Número_Pedido", data_pedido_br AS "Data_Pedido",
      status_pedido AS "Status_Pedido", categoria_corte AS "Categoria_Corte",
      vl_faturado AS "Valor_Faturado_R$", vl_cortado AS "Valor_Cortado_R$",
      qtd_skus AS "Qtd_SKUs_Vendidos", qtd_cortados AS "Qtd_Itens_Cortados"
    FROM pedidos_historico
    ORDER BY filial_codigo, data_pedido DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pedidos), 'Histórico_Pedidos');
  console.log(`    → ${pedidos.length.toLocaleString()} linhas`);

  // ABA 2: Resumo Pedidos por Filial/Mês
  console.log('  Gerando aba: Resumo_Por_Filial_Mês...');
  const resumoFilialMes = db.prepare(`
    SELECT 
      filial_sigla AS "Filial", gerente_nome AS "Gerente",
      SUBSTR(data_pedido, 1, 7) AS "Ano_Mês",
      COUNT(DISTINCT id_cliente) AS "Clientes_Distintos_Atendidos",
      COUNT(*) AS "Total_Pedidos",
      ROUND(SUM(vl_faturado), 2) AS "Faturamento_R$",
      ROUND(SUM(vl_cortado), 2) AS "Valor_Cortado_R$",
      ROUND(AVG(qtd_skus), 1) AS "Média_SKUs_Por_Pedido"
    FROM pedidos_historico
    WHERE data_pedido != '' AND data_pedido >= '2025-01-01'
    GROUP BY filial_codigo, SUBSTR(data_pedido, 1, 7)
    ORDER BY filial_codigo, "Ano_Mês" DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoFilialMes), 'Resumo_Por_Filial_Mês');
  console.log(`    → ${resumoFilialMes.length.toLocaleString()} linhas`);

  // ABA 3: Resumo Pedidos por RCA
  console.log('  Gerando aba: Resumo_Por_RCA...');
  const resumoRca = db.prepare(`
    SELECT 
      filial_sigla AS "Filial", supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA", rca_nome AS "Nome_RCA",
      COUNT(DISTINCT id_cliente) AS "Clientes_Atendidos",
      COUNT(*) AS "Total_Pedidos",
      ROUND(SUM(vl_faturado), 2) AS "Faturamento_R$",
      ROUND(AVG(vl_faturado), 2) AS "Ticket_Médio_R$",
      ROUND(SUM(vl_cortado), 2) AS "Valor_Cortado_R$",
      ROUND(AVG(qtd_skus), 1) AS "Média_SKUs"
    FROM pedidos_historico
    GROUP BY filial_codigo, rca_id
    ORDER BY "Faturamento_R$" DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRca), 'Resumo_Por_RCA');
  console.log(`    → ${resumoRca.length.toLocaleString()} linhas`);

  // ABA 4: Clientes Completos (com endereço, lat/long, cidade, estado)
  console.log('  Gerando aba: Clientes_Completos...');
  const clientesCompletos = db.prepare(`
    SELECT 
      filial_sigla AS "Filial", gerente_nome AS "Gerente", supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA", rca_nome AS "Nome_RCA",
      id_cliente AS "Cód_Cliente", cnpj AS "CNPJ",
      nome_cliente AS "Nome_Fantasia", razao_social AS "Razão_Social",
      endereco AS "Endereço", numero AS "Número", complemento AS "Complemento",
      bairro AS "Bairro", cidade AS "Cidade", estado AS "UF", cep AS "CEP",
      telefone AS "Telefone",
      latitude AS "Latitude", longitude AS "Longitude",
      dias_sem_compra AS "Dias_Sem_Compra",
      status_cliente AS "Status_Cliente",
      ultimo_pedido AS "Último_Pedido",
      CASE WHEN teve_ret = 1 THEN 'SIM' ELSE 'NÃO' END AS "Teve_RET"
    FROM clientes_completo
    ORDER BY filial_codigo, rca_id, nome_cliente
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientesCompletos), 'Clientes_Completos');
  console.log(`    → ${clientesCompletos.length.toLocaleString()} linhas`);

  // ABA 5: PDVs por Cidade (para análise de penetração + IBGE)
  console.log('  Gerando aba: PDVs_Por_Cidade_IBGE...');
  const pdvCidadeIBGE = db.prepare(`
    SELECT 
      c.filial_sigla AS "Filial",
      c.estado AS "UF",
      c.cidade AS "Cidade",
      COUNT(DISTINCT c.id_cliente) AS "PDVs_Ativos_Carteira",
      COUNT(DISTINCT CASE WHEN c.dias_sem_compra <= 30 THEN c.id_cliente END) AS "Comprou_Últimos_30d",
      COUNT(DISTINCT CASE WHEN c.dias_sem_compra > 30 AND c.dias_sem_compra <= 60 THEN c.id_cliente END) AS "Inativos_31_60d",
      COUNT(DISTINCT CASE WHEN c.dias_sem_compra > 60 THEN c.id_cliente END) AS "Inativos_60d+",
      COALESCE(i.populacao_estimada, 0) AS "População_Censo_2022_IBGE",
      COALESCE(i.pib_per_capita, 0) AS "PIB_Per_Capita_R$",
      CASE 
        WHEN i.populacao_estimada > 0 THEN 
          ROUND(COUNT(DISTINCT c.id_cliente) * 1000.0 / i.populacao_estimada, 2)
        ELSE NULL 
      END AS "PDVs_Por_Mil_Hab",
      i.mesorregiao AS "Mesorregião_IBGE",
      i.microrregiao AS "Microrregião_IBGE"
    FROM clientes_completo c
    LEFT JOIN ibge_municipios i ON UPPER(TRIM(i.nome)) = UPPER(TRIM(c.cidade)) AND UPPER(TRIM(i.uf_sigla)) = UPPER(TRIM(c.estado))
    WHERE c.cidade != '' AND c.estado != ''
    GROUP BY c.filial_sigla, c.estado, c.cidade
    ORDER BY c.filial_sigla, c.estado, "PDVs_Ativos_Carteira" DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pdvCidadeIBGE), 'PDVs_Por_Cidade_IBGE');
  console.log(`    → ${pdvCidadeIBGE.length.toLocaleString()} linhas`);

  // ABA 6: Itens Vendidos (Top SKUs)
  console.log('  Gerando aba: Top_SKUs_Vendidos...');
  const topSkus = db.prepare(`
    SELECT 
      i.filial_codigo AS "Filial",
      i.codprod AS "Cód_Produto", i.descricao AS "Descrição",
      COUNT(DISTINCT i.id_cliente) AS "Clientes_Distintos",
      COUNT(DISTINCT i.num_pedido) AS "Pedidos_Com_Produto",
      SUM(i.quantidade) AS "Qtd_Total_Vendida",
      ROUND(SUM(i.valor_total), 2) AS "Faturamento_R$",
      ROUND(AVG(i.valor_total / NULLIF(i.quantidade, 0)), 4) AS "Preço_Médio_Unit"
    FROM pedidos_historico_itens i
    WHERE i.tipo_registro = 'VENDA' AND i.codprod != ''
    GROUP BY i.filial_codigo, i.codprod
    ORDER BY "Faturamento_R$" DESC
    LIMIT 10000
  `).all().map(r => ({ ...r, Filial: normalizarFilial(r.Filial) }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topSkus), 'Top_SKUs_Vendidos');
  console.log(`    → ${topSkus.length.toLocaleString()} linhas`);

  // ABA 7: Itens Cortados
  console.log('  Gerando aba: Itens_Cortados_Histórico...');
  const cortados = db.prepare(`
    SELECT 
      i.filial_codigo AS "Filial",
      i.codprod AS "Cód_Produto", i.descricao AS "Descrição",
      COUNT(DISTINCT i.id_cliente) AS "Clientes_Afetados",
      COUNT(DISTINCT i.num_pedido) AS "Pedidos_Com_Corte",
      SUM(i.quantidade) AS "Qtd_Total_Cortada",
      ROUND(SUM(i.valor_total), 2) AS "Valor_Cortado_R$"
    FROM pedidos_historico_itens i
    WHERE i.tipo_registro = 'CORTE' AND i.codprod != ''
    GROUP BY i.filial_codigo, i.codprod
    ORDER BY "Valor_Cortado_R$" DESC
    LIMIT 5000
  `).all().map(r => ({ ...r, Filial: normalizarFilial(r.Filial) }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cortados), 'Itens_Cortados_Histórico');
  console.log(`    → ${cortados.length.toLocaleString()} linhas`);

  // ABA 8: Clientes Inativos (> 30 dias sem compra)
  console.log('  Gerando aba: Clientes_Inativos...');
  const inativos = db.prepare(`
    SELECT 
      filial_sigla AS "Filial", gerente_nome AS "Gerente", supervisor_nome AS "Supervisor",
      rca_id AS "Cód_RCA", rca_nome AS "Nome_RCA",
      id_cliente AS "Cód_Cliente", cnpj AS "CNPJ",
      nome_cliente AS "Nome_Fantasia", razao_social AS "Razão_Social",
      cidade AS "Cidade", estado AS "UF",
      dias_sem_compra AS "Dias_Sem_Compra",
      ultimo_pedido AS "Último_Pedido",
      status_cliente AS "Status_Cliente"
    FROM clientes_completo
    WHERE dias_sem_compra >= 30
    ORDER BY filial_sigla, dias_sem_compra DESC
  `).all();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inativos), 'Clientes_Inativos');
  console.log(`    → ${inativos.length.toLocaleString()} linhas`);

  const outPath = path.join(__dirname, 'AUDITORIA_COMPLETA_11_FILIAIS.xlsx');
  try { XLSX.writeFile(wb, outPath); }
  catch(e) {
    const fallback = outPath.replace('.xlsx', '_NOVA.xlsx');
    XLSX.writeFile(wb, fallback);
    console.log(`⚠️ Arquivo salvo como: ${fallback}`);
    return;
  }
  console.log(`\n✅ Planilha gerada: ${outPath}`);

  // Stats finais
  const stats = {
    clientes: db.prepare("SELECT COUNT(*) as c FROM clientes_completo").get().c,
    pedidos:  db.prepare("SELECT COUNT(*) as c FROM pedidos_historico").get().c,
    itens:    db.prepare("SELECT COUNT(*) as c FROM pedidos_historico_itens WHERE tipo_registro='VENDA'").get().c,
    cortes:   db.prepare("SELECT COUNT(*) as c FROM pedidos_historico_itens WHERE tipo_registro='CORTE'").get().c,
  };

  console.log('\n' + '='.repeat(70));
  console.log('📋 RESUMO FINAL:');
  console.log('='.repeat(70));
  console.log(`  👥 Clientes completos:   ${stats.clientes.toLocaleString()}`);
  console.log(`  📦 Pedidos histórico:    ${stats.pedidos.toLocaleString()}`);
  console.log(`  🛒 Itens vendidos:       ${stats.itens.toLocaleString()}`);
  console.log(`  ✂️  Itens cortados:      ${stats.cortes.toLocaleString()}`);
}

// ====================================================================
// MAIN
// ====================================================================
async function main() {
  const inicio = Date.now();
  console.log('🚀 EXTRAÇÃO COMPLETA — HISTÓRICO + CLIENTES — 11 FILIAIS');
  console.log(`📅 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`);
  console.log('⚠️  Este processo pode levar 20-40 minutos dependendo da quantidade de clientes.\n');

  initSchema();
  await coletarClientes();
  await extrairHistoricoPedidos();
  gerarPlanilhaCompleta();

  const min = ((Date.now() - inicio) / 60000).toFixed(1);
  db.close();
  console.log(`\n🎯 FINALIZADO EM ${min} minutos!`);
}

main().catch(err => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});
