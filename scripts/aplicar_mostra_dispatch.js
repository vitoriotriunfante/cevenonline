const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '..', 'VENDEDORES AUDITADOS.xlsx');

// As abas por filial no arquivo atual já estão limpas (sem colunas extras) — usa como fonte
const wbOriginal = XLSX.readFile(file);
const wb = XLSX.readFile(file);

const abasFilial = ['ABC','API','MCD_CLEVERSON','MCD_ADRIANO','TCG','TBE','TBL','TCA','TCV','TPA','TPH_VAGNER','TPH_FABIO','TSJ'];

const MOTIVO_POR_TAG = {
  'GERENTE': 'Conta de gerente',
  'GER': 'Conta de gerente (canal GER)',
  'SUPERVISOR': 'Conta pessoal do supervisor (duplicada)',
  'SUP': 'Canal real é Supervisão (SUP), não vendedor de campo',
  'SUPRVISORA': 'Conta pessoal da supervisora (duplicada)',
  'SUPERVISOR COBRINDO A ROTA': null,
  'INATIVOS': 'Marcado como inativo',
  'VAGO': 'Rota vaga, sem vendedor',
  'DESLIGADO': 'Desligado da empresa',
  'DESLIGADO DA EMPRESA': 'Desligado da empresa',
  'SAIU DA EMPRESA': 'Saiu da empresa',
  'PEDIU DESLIGAMENTO': 'Pediu desligamento',
  'PEDIU DEMISSÃO': 'Pediu demissão',
  'LICENÇA MATERNIDADE': 'Licença maternidade (afastada)',
  'AFASTADA PROBLEMA SAÚDE': 'Afastada por problema de saúde',
  'NÃO EXISTE': 'RCA não existe / fantasma',
  'NÃO EXISTE - FOI SUBTITUIDO PELO 549': 'RCA fantasma, substituído por outro código',
  'NÃO EXISTE SEGUNDO SUPERVISOR': 'RCA fantasma',
  'NÃO TEM NO CEVEN???': 'RCA não encontrado no CEVEN',
  'TESTE - EXCLUIR': 'Conta de teste',
  'TRANSFERIDO PARA TBE': 'Transferido para outra filial',
};

const OVERRIDES = {
  'TCV_1078': { mostra: false, motivo: 'Consultora sem faturamento/meta/positivação — papel indefinido' },
  'MCD_CLEVERSON_1070': { mostra: true, motivo: null },
  'TCG_489': { mostra: true, motivo: null },
  'TPA_1035': { mostra: false, motivo: 'Transferido para TBE, não encontrado lá — rota descontinuada' },
  'TCV_357': { mostra: true, motivo: null },
  // TBL: NOK genérico pegava "ALTERAR O SUPERVISOR PARA..." como se fosse conta de supervisor (falso positivo).
  // Resolvido individualmente por RCA em 22/09/2026 — vendedores reais do Everton, só supervisor errado no CEVEN.
  'TBL_517': { mostra: false, motivo: 'Supervisora (conta duplicada)' },
  'TBL_177': { mostra: true, motivo: '', supervisorNovo: { cod: 118, nome: 'IGOR RODRIGUES DUARTE' } },
  'TBL_179': { mostra: true, motivo: '', supervisorNovo: { cod: 118, nome: 'IGOR RODRIGUES DUARTE' } },
  'TBL_185': { mostra: true, motivo: '', supervisorNovo: { cod: 118, nome: 'IGOR RODRIGUES DUARTE' } },
  'TBL_186': { mostra: true, motivo: '', supervisorNovo: { cod: 118, nome: 'IGOR RODRIGUES DUARTE' } },
  'TBL_189': { mostra: true, motivo: '', supervisorNovo: { cod: 118, nome: 'IGOR RODRIGUES DUARTE' } },
  'TBL_192': { mostra: true, motivo: '', supervisorNovo: { cod: 118, nome: 'IGOR RODRIGUES DUARTE' } },
  'TBL_196': { mostra: true, motivo: '', supervisorNovo: { cod: 118, nome: 'IGOR RODRIGUES DUARTE' } },
  'TBL_519': { mostra: false, motivo: 'Supervisor desligado (conta duplicada)' },
  'TBL_198': { mostra: true, motivo: '' },
  'TBL_516': { mostra: false, motivo: 'Conta de gerente (confirmado no CEVEN)' },
  'TBL_521': { mostra: false, motivo: 'Conta duplicada de supervisor (confirmado no CEVEN)' },
  'TBL_1113': { mostra: false, motivo: 'Conta duplicada de supervisor (confirmado no CEVEN)' },
  'TBL_522': { mostra: false, motivo: 'Conta duplicada de supervisor (confirmado no CEVEN)' },
};

function decidir(filial, rca, nome, tag, nota) {
  const key = `${filial}_${rca}`;
  if (OVERRIDES[key]) return { ...OVERRIDES[key] };

  const nomeUp = (nome || '').toUpperCase();
  if (/^GERENTE\b/.test(nomeUp)) return { mostra: false, motivo: 'Conta de gerente' };

  const tagUp = (tag || '').trim().toUpperCase();
  if (!tagUp || tagUp === 'OK') return { mostra: true, motivo: '' };

  if (tagUp === 'NOK') {
    const notaUp = (nota || '').toUpperCase();
    if (notaUp.includes('SUPERVISOR') || notaUp.includes('GERENTE')) {
      return { mostra: false, motivo: 'Conta duplicada de supervisor/gerente (confirmado NOK)' };
    }
    return { mostra: true, motivo: '' };
  }

  if (Object.prototype.hasOwnProperty.call(MOTIVO_POR_TAG, tagUp)) {
    const motivo = MOTIVO_POR_TAG[tagUp];
    if (motivo === null) return { mostra: true, motivo: '' };
    return { mostra: false, motivo };
  }

  return { mostra: true, motivo: '' };
}

const linhas = [];
abasFilial.forEach(nomeAba => {
  const ws = wbOriginal.Sheets[nomeAba];
  if (!ws) return;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const header = data[0];
  const idxGerente = header.findIndex(h => String(h).includes('Gerente Geral'));
  const idxCodSup = header.findIndex(h => String(h).includes('Cód. Supervisor'));
  const idxSup = header.findIndex(h => String(h).includes('Nome Supervisor'));
  const idxRca = header.findIndex(h => String(h).includes('Vendedor (RCA)'));
  const idxNome = header.findIndex(h => String(h).includes('Nome do Vendedor'));
  const idxCanal = header.findIndex(h => String(h).includes('Canal Oficial'));

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rca = String(row[idxRca] || '');
    const nome = row[idxNome];
    const tag = row[17];
    const nota = row[18];
    const { mostra, motivo, supervisorNovo } = decidir(nomeAba, rca, nome, tag, nota);
    const codSup = supervisorNovo ? supervisorNovo.cod : row[idxCodSup];
    const nomeSup = supervisorNovo ? supervisorNovo.nome : row[idxSup];
    linhas.push([
      nomeAba,
      row[idxGerente],
      codSup,
      nomeSup,
      rca,
      nome,
      row[idxCanal],
      mostra ? 'SIM' : 'NÃO',
      motivo || '',
    ]);
  }
});

const header = ['Filial', 'Gerente Geral', 'Cód. Supervisor', 'Nome Supervisor', 'Cód. Vendedor (RCA)', 'Nome do Vendedor', 'Canal Oficial', 'MOSTRA NOS DISPAROS', 'MOTIVO (se NÃO)'];
const aoa = [header, ...linhas];
const wsUnica = XLSX.utils.aoa_to_sheet(aoa);
wsUnica['!cols'] = [{wch:8},{wch:14},{wch:14},{wch:32},{wch:12},{wch:32},{wch:10},{wch:18},{wch:55}];

// Reconstrói workbook: abas originais (limpas) + 1 aba única de controle
delete wb.Sheets['RESUMO_EXCLUSOES'];
wb.SheetNames = wb.SheetNames.filter(n => n !== 'RESUMO_EXCLUSOES' && n !== 'MOSTRA_DISPAROS');
wb.Sheets['MOSTRA_DISPAROS'] = wsUnica;
wb.SheetNames.push('MOSTRA_DISPAROS');

XLSX.writeFile(wb, file);
console.log(`Concluído. ${linhas.length} vendedores listados na aba única MOSTRA_DISPAROS. ${linhas.filter(l=>l[7]==='NÃO').length} marcados NÃO.`);
